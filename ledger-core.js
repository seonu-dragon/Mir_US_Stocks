// 거래 원장(매수·매도·분할·배당·수수료) — 순수 계산 모듈(DOM·저장소 없음).
// 브라우저에서는 window.MirLedgerCore, node 테스트(scripts/tests/test_ledger_core.mjs)에서는
// module.exports 로 같은 코드를 쓴다. 설계: mir_design/2026-10-23_거래원장_설계.md
//
// 규칙 요약
// - 원가 계산은 이동평균(국내 증권사 '평균단가' 관행). 매수 때만 평단이 바뀌고 매도는 평단을 바꾸지 않는다.
// - 평단(avgCost)은 수수료를 넣지 않은 '체결가 평균'이다(증권사 앱의 평균단가와 같은 값 → 보유 표와 맞는다).
//   매수 수수료·세금은 종목별 feePool 에 쌓아 두었다가 매도 수량 비율만큼 실현손익에서 뺀다.
//   그래서 실현손익 = 매도금액 − 평단×수량 − 매도 수수료·세금 − 배분된 매수 수수료(순손익).
// - 전량 매도하면 수량·평단·feePool 이 0 으로 돌아간다(다음 매수는 새 평단).
// - 분할(split): ratio = 1주당 새 주식 수(4:1 액면분할 = 4, 1:10 병합 = 0.1). 수량×ratio, 평단÷ratio.
//   원가 총액은 그대로다. 단주 현금 정산은 다루지 않는다.
// - 보유보다 많이 팔면 그 거래를 적용하지 않고 errors 에 남긴다(지어내서 맞추지 않는다).
// - 'open'(시작 잔고)은 원장 이전부터 있던 보유를 옮긴 거래다. 날짜를 모르면 "" 이고 맨 앞에 정렬된다.
// - 환율(fx, 1달러당 원)은 사용자가 넣은 경우에만 쓴다. 그 포지션의 모든 매수에 fx 가 있고 매도에도 fx 가
//   있을 때만 원화 실현손익(pnlKrw)을 낸다. 하나라도 없으면 null — 추정하지 않는다.
(function (root) {
  "use strict";

  const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  const EPS = 1e-9;
  const TYPES = ["open", "buy", "sell", "split", "dividend", "fee"];
  const TYPE_LABEL = { open: "시작 잔고", buy: "매수", sell: "매도", split: "분할", dividend: "배당", fee: "수수료" };

  function isIso(s) {
    if (typeof s !== "string" || !ISO_RE.test(s)) return false;
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }

  function num(v) {
    if (v === null || v === undefined || v === "") return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  }

  function optNum(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  }

  function round(v, digits) {
    const f = Math.pow(10, digits);
    return Math.round(v * f) / f;
  }

  function currencyOf(market) {
    return market === "kr" ? "KRW" : "USD";
  }

  let idSeq = 0;
  function newId(now) {
    idSeq = (idSeq + 1) % 1e6;
    const t = (typeof now === "number" ? now : Date.now()).toString(36);
    return `tx_${t}${idSeq.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
  }

  // 입력값을 저장 형태로 정리한다. 숫자 문자열은 숫자로, 빈 칸은 0/null 로.
  function normalizeTx(raw, market) {
    const r = raw && typeof raw === "object" ? raw : {};
    const mk = r.market === "kr" || r.market === "us" ? r.market : (market === "kr" ? "kr" : "us");
    const type = TYPES.includes(r.type) ? r.type : String(r.type || "");
    const tx = {
      id: typeof r.id === "string" && r.id ? r.id : newId(),
      market: mk,
      ticker: String(r.ticker || "").trim().toUpperCase(),
      type,
      date: typeof r.date === "string" ? r.date.trim() : "",
      qty: num(r.qty),
      price: num(r.price),
      currency: typeof r.currency === "string" && r.currency ? r.currency : currencyOf(mk),
      fee: num(r.fee),
      tax: num(r.tax),
      note: typeof r.note === "string" ? r.note.slice(0, 200) : "",
    };
    if (type === "split") tx.ratio = num(r.ratio);
    const fx = optNum(r.fx);
    if (fx !== null) tx.fx = fx;
    if (typeof r.createdAt === "number" && Number.isFinite(r.createdAt)) tx.createdAt = r.createdAt;
    return tx;
  }

  // 거래 한 건의 형식 검사(보유 수량과 무관한 것만). 오류 메시지 배열(빈 배열 = 통과).
  function validateTx(tx) {
    const errs = [];
    if (!tx || typeof tx !== "object") return ["거래 형식이 아닙니다."];
    if (!TYPES.includes(tx.type)) errs.push("거래 구분이 올바르지 않습니다.");
    if (!tx.ticker) errs.push("종목이 비어 있습니다.");
    if (tx.type === "open") {
      if (tx.date && !isIso(tx.date)) errs.push("날짜 형식이 올바르지 않습니다.");
    } else if (!isIso(tx.date)) {
      errs.push("날짜를 입력해 주세요.");
    }
    const needQty = tx.type === "open" || tx.type === "buy" || tx.type === "sell";
    if (needQty) {
      if (!(tx.qty > 0)) errs.push("수량은 0보다 커야 합니다.");
      if (!(tx.price > 0)) errs.push("가격은 0보다 커야 합니다.");
    }
    if (tx.type === "split" && !(tx.ratio > 0)) errs.push("분할 비율은 0보다 커야 합니다.");
    if ((tx.type === "dividend" || tx.type === "fee") && !(Number(tx.price) > 0 || Number(tx.qty) > 0)) {
      errs.push("금액을 입력해 주세요.");
    }
    ["fee", "tax"].forEach((k) => {
      if (!Number.isFinite(tx[k]) || tx[k] < 0) errs.push(k === "fee" ? "수수료는 0 이상이어야 합니다." : "세금은 0 이상이어야 합니다.");
    });
    if (tx.fx !== undefined && !(tx.fx > 0)) errs.push("환율은 0보다 커야 합니다.");
    return errs;
  }

  // 적용 순서: 날짜 오름차순(시작 잔고의 빈 날짜가 맨 앞), 같은 날은 입력 순서(배열 순서) 그대로.
  function sortTxs(txs) {
    return (Array.isArray(txs) ? txs : [])
      .map((tx, i) => ({ tx, i }))
      .sort((a, b) => {
        const da = a.tx.date || "";
        const db = b.tx.date || "";
        if (da !== db) return da < db ? -1 : 1;
        return a.i - b.i;
      })
      .map((x) => x.tx);
  }

  function emptyPos(ticker, currency) {
    return { ticker, currency, qty: 0, avgCost: 0, feePool: 0, krwCost: 0, krwOk: true, realized: 0, firstDate: "", txCount: 0 };
  }

  // 원장 → 종목별 포지션·매도별 실현손익·연도별 합계.
  // 금액 단위는 거래 통화(US=USD, KR=KRW). 보유보다 많이 판 매도는 적용하지 않고 errors 에 남긴다.
  function applyLedger(txs) {
    const positions = {};
    const sales = [];
    const dividends = [];
    const errors = [];
    const fees = [];
    const byYear = {};
    const bump = (year, cur, v) => {
      if (!year) return;
      const k = `${year}`;
      if (!byYear[k]) byYear[k] = {};
      byYear[k][cur] = (byYear[k][cur] || 0) + v;
    };
    sortTxs(txs).forEach((tx) => {
      const errs = validateTx(tx);
      if (errs.length) { errors.push({ id: tx && tx.id, ticker: tx && tx.ticker, date: tx && tx.date, message: errs[0] }); return; }
      const cur = tx.currency || "USD";
      const pos = positions[tx.ticker] || (positions[tx.ticker] = emptyPos(tx.ticker, cur));
      pos.txCount += 1;
      const year = tx.date ? tx.date.slice(0, 4) : "";
      const hasFx = tx.fx > 0;
      if (tx.type === "open" || tx.type === "buy") {
        const gross = tx.qty * tx.price;
        const newQty = pos.qty + tx.qty;
        pos.avgCost = (pos.qty * pos.avgCost + gross) / newQty;
        pos.qty = newQty;
        pos.feePool += tx.fee + tx.tax;
        if (hasFx) pos.krwCost += (gross + tx.fee + tx.tax) * tx.fx; else pos.krwOk = false;
        if (!pos.firstDate && tx.date) pos.firstDate = tx.date;
      } else if (tx.type === "sell") {
        if (tx.qty > pos.qty + EPS) {
          pos.txCount -= 1;
          errors.push({ id: tx.id, ticker: tx.ticker, date: tx.date, message: `보유(${round(pos.qty, 6)}주)보다 많이 팔 수 없습니다.`, held: pos.qty });
          return;
        }
        const share = pos.qty > 0 ? tx.qty / pos.qty : 0;
        const proceeds = tx.qty * tx.price;
        const basis = tx.qty * pos.avgCost;
        const buyFees = pos.feePool * share;
        const sellCosts = tx.fee + tx.tax;
        const pnl = proceeds - basis - buyFees - sellCosts;
        const costTotal = basis + buyFees;
        let pnlKrw = null;
        const krwBasis = pos.krwCost * share;
        if (pos.krwOk && hasFx) pnlKrw = (proceeds - sellCosts) * tx.fx - krwBasis;
        sales.push({
          id: tx.id, ticker: tx.ticker, date: tx.date, year, currency: cur,
          qty: tx.qty, price: tx.price, avgCost: pos.avgCost,
          proceeds, basis, buyFees, sellCosts, pnl,
          pnlPct: costTotal > 0 ? (pnl / costTotal) * 100 : null,
          pnlKrw,
        });
        pos.realized += pnl;
        bump(year, cur, pnl);
        pos.qty -= tx.qty;
        pos.feePool -= buyFees;
        pos.krwCost -= krwBasis;
        if (pos.qty <= EPS) {
          // 전량 매도 — 다음 매수는 새 평단에서 시작한다.
          pos.qty = 0; pos.avgCost = 0; pos.feePool = 0; pos.krwCost = 0; pos.krwOk = true;
        }
      } else if (tx.type === "split") {
        if (pos.qty > 0) {
          pos.qty *= tx.ratio;
          pos.avgCost /= tx.ratio;
        }
      } else if (tx.type === "dividend") {
        // 배당: 금액 = price(총액) 또는 qty×price(주당 배당 × 주식 수). 세금은 원천징수액.
        const gross = tx.qty > 0 ? tx.qty * tx.price : tx.price;
        const net = gross - tx.tax - tx.fee;
        dividends.push({ id: tx.id, ticker: tx.ticker, date: tx.date, year, currency: cur, gross, net });
      } else if (tx.type === "fee") {
        const amt = (tx.price > 0 ? tx.price : tx.qty) + tx.fee + tx.tax;
        pos.realized -= amt;
        fees.push({ id: tx.id, ticker: tx.ticker, date: tx.date, year, currency: cur, amount: amt });
        bump(year, cur, -amt);
      }
    });
    Object.values(positions).forEach((p) => {
      p.avgCostInclFees = p.qty > 0 ? p.avgCost + p.feePool / p.qty : 0;
      if (Math.abs(p.qty - Math.round(p.qty)) < 1e-7) p.qty = Math.round(p.qty);
    });
    return { positions, sales, dividends, fees, errors, byYear };
  }

  // 실현손익 요약: 올해·전체, 통화별. year 는 "YYYY".
  function realizedSummary(result, year) {
    const out = { year: String(year || ""), thisYear: {}, allTime: {}, saleCount: 0, saleCountYear: 0, krwYear: null, krwAll: null };
    const sales = (result && result.sales) || [];
    sales.forEach((s) => {
      out.allTime[s.currency] = (out.allTime[s.currency] || 0) + s.pnl;
      out.saleCount += 1;
      if (s.pnlKrw !== null && s.pnlKrw !== undefined) out.krwAll = (out.krwAll || 0) + s.pnlKrw;
      if (s.year === out.year) {
        out.thisYear[s.currency] = (out.thisYear[s.currency] || 0) + s.pnl;
        out.saleCountYear += 1;
        if (s.pnlKrw !== null && s.pnlKrw !== undefined) out.krwYear = (out.krwYear || 0) + s.pnlKrw;
      }
    });
    // 단독 수수료(fee) 거래도 실현손익에서 뺀다.
    ((result && result.fees) || []).forEach((f) => {
      out.allTime[f.currency] = (out.allTime[f.currency] || 0) - f.amount;
      if (f.year === out.year) out.thisYear[f.currency] = (out.thisYear[f.currency] || 0) - f.amount;
    });
    return out;
  }

  // 원장에 거래를 넣거나(같은 id 면 교체) 빼 본 뒤 전체를 다시 계산해, 오류가 새로 생기면 거부한다.
  // 반환: { ok, txs, errors }  — ok=false 면 txs 는 원래 목록 그대로.
  function tryChange(txs, change) {
    const base = Array.isArray(txs) ? txs.slice() : [];
    let next = base.slice();
    if (change && change.remove) next = next.filter((t) => t.id !== change.remove);
    if (change && change.upsert) {
      const tx = change.upsert;
      const own = validateTx(tx);
      if (own.length) return { ok: false, txs: base, errors: own.map((m) => ({ id: tx.id, message: m })) };
      const i = next.findIndex((t) => t.id === tx.id);
      if (i >= 0) next[i] = tx; else next.push(tx);
    }
    const before = new Set(applyLedger(base).errors.map((e) => e.id));
    const after = applyLedger(next).errors.filter((e) => !before.has(e.id) || (change.upsert && e.id === change.upsert.id));
    if (after.length) return { ok: false, txs: base, errors: after };
    return { ok: true, txs: next, errors: [] };
  }

  // 기존 보유(수량·평단 스냅샷)를 원장의 '시작 잔고' 거래로 옮긴다. 날짜를 모르면 "".
  function openingFromHolding(holding, market, date) {
    if (!holding || !holding.ticker) return null;
    const qty = Number(holding.qty);
    const price = Number(holding.avgCost);
    if (!(qty > 0) || !(price > 0)) return null;
    return normalizeTx({
      type: "open", ticker: holding.ticker, market,
      date: isIso(date) ? date : "", qty, price, fee: 0, tax: 0,
      note: "원장 시작 전 보유",
    }, market);
  }

  // 원장이 있는 종목은 보유(수량·평단)를 원장 결과로 맞춘다. 원장이 없는 종목은 손대지 않는다.
  // holdings: [{ticker, qty, avgCost, ...}] → { next, changed }  (전량 매도한 종목은 보유에서 빠진다)
  function reconcileHoldings(holdings, result) {
    const list = Array.isArray(holdings) ? holdings.filter((h) => h && h.ticker) : [];
    const pos = (result && result.positions) || {};
    let changed = false;
    const seen = new Set();
    const next = [];
    list.forEach((h) => {
      const p = pos[h.ticker];
      if (!p) { next.push(h); return; }
      seen.add(h.ticker);
      if (!(p.qty > 0)) { changed = true; return; }
      const qty = round(p.qty, 8);
      const avgCost = round(p.avgCost, 6);
      if (Number(h.qty) !== qty || Number(h.avgCost) !== avgCost) changed = true;
      next.push({ ...h, qty, avgCost });
    });
    Object.values(pos).forEach((p) => {
      if (seen.has(p.ticker) || !(p.qty > 0)) return;
      next.push({ ticker: p.ticker, qty: round(p.qty, 8), avgCost: round(p.avgCost, 6) });
      changed = true;
    });
    return { next, changed };
  }

  // 백업 JSON. market 이 다르거나 형식이 틀린 행은 건너뛴다.
  function exportJson(txs, market, nowIso) {
    return JSON.stringify({ app: "mir-ledger", v: 1, market, exportedAt: nowIso || "", txs: Array.isArray(txs) ? txs : [] }, null, 1);
  }

  function parseImport(text, market) {
    let obj;
    try { obj = JSON.parse(String(text || "")); } catch (_) { return { ok: false, error: "JSON 형식이 아닙니다.", txs: [] }; }
    const rows = Array.isArray(obj) ? obj : (obj && Array.isArray(obj.txs) ? obj.txs : null);
    if (!rows) return { ok: false, error: "거래 목록(txs)이 없습니다.", txs: [] };
    if (obj && !Array.isArray(obj) && obj.market && obj.market !== market) {
      return { ok: false, error: `${obj.market === "kr" ? "국내" : "미국"} 시장 백업입니다. 시장을 바꾼 뒤 가져오세요.`, txs: [] };
    }
    let skipped = 0;
    const txs = [];
    rows.forEach((r) => {
      const tx = normalizeTx(r, market);
      if (tx.market !== market || validateTx(tx).length) { skipped += 1; return; }
      txs.push(tx);
    });
    return { ok: true, txs, skipped };
  }

  // 같은 id 는 가져온 쪽으로 교체, 새 id 는 추가. 합친 결과에 오류(과매도 등)가 있으면 거부.
  function mergeImport(existing, incoming) {
    const map = new Map();
    (Array.isArray(existing) ? existing : []).forEach((t) => map.set(t.id, t));
    let added = 0, replaced = 0;
    (Array.isArray(incoming) ? incoming : []).forEach((t) => {
      if (map.has(t.id)) replaced += 1; else added += 1;
      map.set(t.id, t);
    });
    const txs = [...map.values()];
    const errors = applyLedger(txs).errors;
    if (errors.length) return { ok: false, txs: existing, errors, added: 0, replaced: 0 };
    return { ok: true, txs, errors: [], added, replaced };
  }

  const api = {
    TYPES,
    TYPE_LABEL,
    isIso,
    currencyOf,
    newId,
    normalizeTx,
    validateTx,
    sortTxs,
    applyLedger,
    realizedSummary,
    tryChange,
    openingFromHolding,
    reconcileHoldings,
    exportJson,
    parseImport,
    mergeImport,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirLedgerCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
