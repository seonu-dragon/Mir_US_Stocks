// 거래 원장 2단계 — 기간 수익률(TWR·XIRR)과 상세 이벤트(배당·분할) 제안. 순수 계산(DOM·저장소 없음).
// 브라우저에서는 window.MirLedgerPerfCore, node 테스트(scripts/tests/test_ledger_perf_core.mjs)에서는 module.exports.
// 설계: mir_design/2026-10-23_거래원장_설계.md §7
//
// 입력 일봉은 상세 파일 chartSeries([o,h,l,c,v,date])다. 미국(야후)·국내(네이버 수정주가) 모두 분할이 소급 반영된
// '수정 종가'라서, 원장 수량(분할 전 날짜엔 분할 전 주식 수)과 곱하려면 실제 종가로 되돌린다:
//   실제 종가(d) = 수정 종가(d) × Π(그 뒤 분할 비율)  — 분할 목록 = 상세 splits ∪ 상세에 없는 원장 분할 거래.
// 모르는 값은 메우지 않는다: 봉이 없는 구간(시작 전·10일 넘는 공백·보유 중인데 그날 종가 없음)이 기간에 걸리면 null('—').
// 휴장 차이로 그날 봉만 없는 종목은 직전 종가(7일 이내)를 그대로 쓴다(보간 아님 — 마지막 체결가).
(function (root) {
  "use strict";

  const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  const EPS = 1e-9;
  const CARRY_DAYS = 7;   // 다른 종목만 거래한 날: 직전 종가를 쓸 수 있는 최대 간격
  const GAP_DAYS = 10;    // 연속 봉 간격이 이보다 길면 그 사이를 '봉 없음'으로 본다
  const XIRR_MIN_DAYS = 30; // 이보다 짧으면 연환산이 과장된다 → null
  const DIV_MATCH_DAYS = 60; // 배당락일 ~ +60일 안에 기록한 배당이 있으면 그 배당락은 기록된 것으로 본다
  const SPLIT_MATCH_DAYS = 7;
  const PERIODS = ["1M", "3M", "YTD", "1Y", "ALL"];
  const PERIOD_LABEL = { "1M": "1M", "3M": "3M", YTD: "YTD", "1Y": "1Y", ALL: "전체" };

  function isIso(s) { return typeof s === "string" && ISO_RE.test(s); }
  function dayNum(iso) { const t = Date.parse(`${iso}T00:00:00Z`); return Number.isFinite(t) ? Math.round(t / 86400000) : NaN; }
  function isoOf(n) { return new Date(n * 86400000).toISOString().slice(0, 10); }
  function addDays(iso, n) { return isoOf(dayNum(iso) + n); }
  function fnum(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

  function dcaCore() {
    if (root && root.MirDcaCore) return root.MirDcaCore;
    if (typeof require === "function") { try { return require("./dca-core.js"); } catch (_) { /* 없음 */ } }
    return null;
  }

  // chartSeries → [{date, close}] 날짜 오름차순(종가 > 0 인 봉만).
  function normBars(series) {
    const out = [];
    (Array.isArray(series) ? series : []).forEach((b) => {
      let date, close;
      if (Array.isArray(b)) { date = b[5]; close = b[3]; } else if (b && typeof b === "object") { date = b.date; close = b.close; }
      close = Number(close);
      if (isIso(date) && close > 0) out.push({ date, close });
    });
    out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return out.filter((b, i) => i === 0 || b.date !== out[i - 1].date);
  }

  // 상세 splits([date, 분자, 분모] 또는 {date, ratio}) → [{date, ratio}] (ratio = 1주당 새 주식 수).
  function normSplits(list) {
    const out = [];
    (Array.isArray(list) ? list : []).forEach((s) => {
      let date, ratio;
      if (Array.isArray(s)) { date = s[0]; const a = Number(s[1]); const b = Number(s[2]); ratio = b > 0 ? a / b : a; } else if (s && typeof s === "object") { date = s.date; ratio = Number(s.ratio); }
      if (isIso(date) && ratio > 0 && Math.abs(ratio - 1) > EPS) out.push({ date, ratio });
    });
    return out.sort((a, b) => (a.date < b.date ? -1 : 1));
  }

  // 상세 dividends([date, 주당] 또는 {date, amount}) → [{exDate, dps}]
  function normDividends(list) {
    const out = [];
    (Array.isArray(list) ? list : []).forEach((d) => {
      let date, amt;
      if (Array.isArray(d)) { date = d[0]; amt = Number(d[1]); } else if (d && typeof d === "object") { date = d.date || d.exDate; amt = Number(d.amount != null ? d.amount : d.dps); }
      if (isIso(date) && amt > 0) out.push({ exDate: date, dps: amt });
    });
    return out.sort((a, b) => (a.exDate < b.exDate ? -1 : 1));
  }

  // 분할 목록(그 날짜부터 새 주식 수로 거래) 기준, date 이후(초과) 분할 비율의 곱.
  function factorAfter(splits, date) {
    let f = 1;
    (splits || []).forEach((s) => { if (s.date > date) f *= s.ratio; });
    return f;
  }

  // 상세 분할 + 상세에 없는 원장 분할 거래(±7일 안에 상세 분할이 없으면) — 수정 종가를 되돌릴 때 쓰는 목록.
  function effectiveSplits(detailSplits, txs) {
    const base = normSplits(detailSplits);
    const extra = [];
    (txs || []).forEach((t) => {
      if (!t || t.type !== "split" || !isIso(t.date) || !(t.ratio > 0)) return;
      const near = base.some((s) => Math.abs(dayNum(s.date) - dayNum(t.date)) <= SPLIT_MATCH_DAYS);
      if (!near) extra.push({ date: t.date, ratio: Number(t.ratio) });
    });
    return base.concat(extra).sort((a, b) => (a.date < b.date ? -1 : 1));
  }

  // 수정 종가 → 실제 종가.
  function rawCloses(bars, splits) {
    const sp = splits || [];
    return (bars || []).map((b) => ({ date: b.date, close: b.close * factorAfter(sp, b.date) }));
  }

  function sortTxs(txs) {
    return (Array.isArray(txs) ? txs : []).map((tx, i) => ({ tx, i }))
      .sort((a, b) => { const da = a.tx.date || ""; const db = b.tx.date || ""; if (da !== db) return da < db ? -1 : 1; return a.i - b.i; })
      .map((x) => x.tx);
  }

  function divGross(t) { return fnum(t.qty) > 0 ? fnum(t.qty) * fnum(t.price) : fnum(t.price); }
  function feeAmount(t) { return (fnum(t.price) > 0 ? fnum(t.price) : fnum(t.qty)) + fnum(t.fee) + fnum(t.tax); }

  // 투자자 쪽 현금흐름(XIRR 부호): 매수 −, 매도·배당 +, 단독 수수료 −. 분할은 0.
  function txFlow(t) {
    if (t.type === "buy" || t.type === "open") return -(fnum(t.qty) * fnum(t.price) + fnum(t.fee) + fnum(t.tax));
    if (t.type === "sell") return fnum(t.qty) * fnum(t.price) - fnum(t.fee) - fnum(t.tax);
    if (t.type === "dividend") return divGross(t) - fnum(t.tax) - fnum(t.fee);
    if (t.type === "fee") return -feeAmount(t);
    return 0;
  }

  // 같은 날 순서: 분할(그날 시가부터 새 주식 수) → 나머지는 입력 순.
  function dayOrder(list) {
    return list.filter((t) => t.type === "split").concat(list.filter((t) => t.type !== "split"));
  }

  /**
   * 기간 수익률.
   * inputs: [{ ticker, txs(그 종목 거래, 형식 검사 통과분), bars([{date, close}] 실제 종가 — rawCloses 결과) }]
   * opts: { endDate?(기본: 모든 봉의 마지막 날 중 가장 늦은 날), periods? }
   * → { endDate, twr: {1M,3M,YTD,1Y,ALL: % | null}, why: {기간: 사유}, xirr: % | null, xirrWhy, value, inception }
   *
   * TWR: 거래가 있는 날을 '거래 시점'에서 두 구간으로 나눈다(현금흐름마다 구간 분할).
   *   거래 직전 평가액 Vpre = Σ 직전 수량 × (그날 거래한 종목은 그 체결가, 아닌 종목은 그날 종가)
   *   r_a = Vpre / V(전날 종가)      — 흐름 전 구간
   *   r_b = (V(그날 종가) + 유출) / (Vpre + 유입)   — 흐름 뒤 구간
   *   유입 = 매수금액+수수료·세금, 유출 = 매도금액−수수료·세금 + 배당(세후) − 단독 수수료.
   *   거래 없는 날은 V/V(전날). 기간 TWR = Π(1+r) − 1.
   */
  function performance(inputs, opts) {
    const o = opts || {};
    const list = (Array.isArray(inputs) ? inputs : []).filter((x) => x && x.ticker);
    const out = { endDate: "", twr: {}, why: {}, xirr: null, xirrWhy: "", value: null, inception: "" };
    PERIODS.forEach((p) => { out.twr[p] = null; out.why[p] = "nodata"; });
    if (!list.length) return out;
    let endDate = isIso(o.endDate) ? o.endDate : "";
    if (!endDate) list.forEach((x) => { const b = x.bars || []; if (b.length && b[b.length - 1].date > endDate) endDate = b[b.length - 1].date; });
    if (!endDate) return out;
    out.endDate = endDate;

    // 날짜 축 = 모든 종목 봉 날짜의 합집합(endDate 까지)
    const dateSet = new Set();
    list.forEach((x) => (x.bars || []).forEach((b) => { if (b.date <= endDate) dateSet.add(b.date); }));
    const D = [...dateSet].sort();
    const n = D.length;
    if (!n) return out;
    const dn = D.map(dayNum);

    // 종목별 그날 종가(직전 종가 7일 이내 이월) / 거래를 그 날짜 이후 첫 봉에 배정
    let anyUndated = false;
    let inception = "";
    const tk = list.map((x) => {
      const m = new Map((x.bars || []).map((b) => [b.date, b.close]));
      const close = new Array(n).fill(null);
      let lastD = NaN, lastC = null;
      for (let i = 0; i < n; i += 1) {
        if (m.has(D[i])) { lastD = dn[i]; lastC = m.get(D[i]); close[i] = lastC; } else if (lastC !== null && dn[i] - lastD <= CARRY_DAYS) close[i] = lastC;
      }
      const byDay = Array.from({ length: n }, () => []);
      const initial = [];
      sortTxs(x.txs).forEach((t) => {
        if (!t || !t.type) return;
        if (!t.date) { if (t.type === "open") { initial.push(t); anyUndated = true; } return; }
        if (t.date > endDate) return; // 마지막 봉 뒤 거래는 기간 밖
        if (!inception || t.date < inception) inception = t.date;
        let lo = 0, hi = n - 1, idx = -1;
        while (lo <= hi) { const mid = (lo + hi) >> 1; if (D[mid] >= t.date) { idx = mid; hi = mid - 1; } else lo = mid + 1; }
        if (idx >= 0) byDay[idx].push(t);
      });
      let qty = 0;
      initial.forEach((t) => { qty += fnum(t.qty); });
      const firstBar = (x.bars || []).length ? x.bars[0].date : "";
      return { ticker: x.ticker, close, byDay, qty, firstBar };
    });
    out.inception = anyUndated ? "" : inception;

    // 일별 시뮬레이션
    const V = new Array(n).fill(0);
    const growth = new Array(n).fill(1);
    const missing = new Array(n).fill(false); // 그날 수익률(전날 → 그날)을 모름
    const valMiss = new Array(n).fill(false); // 그날 종가 평가액을 모름
    const exposed = new Array(n).fill(false); // 그날 보유했거나 흐름이 있었는가
    const flowsX = [];
    // 날짜 모르는 시작 잔고가 있으면 첫 봉 전날 평가액은 모른다(첫날 수익률 = 모름, 평가액은 앎).
    let prevV = tk.some((t) => t.qty > 0) ? NaN : 0;
    for (let i = 0; i < n; i += 1) {
      let vpre = 0, vend = 0, inflow = 0, outflow = 0, anyFlow = false, miss = false, held = false;
      const gap = i > 0 && dn[i] - dn[i - 1] > GAP_DAYS && prevV > EPS; // 긴 공백: 그 사이 수익률을 모름(평가액은 앎)
      tk.forEach((t) => {
        const day = dayOrder(t.byDay[i]);
        day.filter((x) => x.type === "split").forEach((x) => { if (t.qty > 0) t.qty *= fnum(x.ratio); });
        const trade = day.find((x) => x.type === "buy" || x.type === "sell" || x.type === "open");
        const c = t.close[i];
        const qPrev = t.qty;
        if (qPrev > EPS) {
          held = true;
          if (trade) vpre += qPrev * fnum(trade.price);
          else if (c === null) miss = true;
          else vpre += qPrev * c;
        }
        day.forEach((x) => {
          if (x.type === "split") return;
          const f = txFlow(x);
          if (x.type === "buy" || x.type === "open") { t.qty += fnum(x.qty); inflow += -f; anyFlow = true; } else if (x.type === "sell") {
            if (fnum(x.qty) > t.qty + EPS) return; // 과매도는 원장이 적용하지 않는다
            t.qty -= fnum(x.qty); if (t.qty < EPS) t.qty = 0; outflow += f; anyFlow = true;
          } else if (x.type === "dividend" || x.type === "fee") { outflow += f; anyFlow = true; }
          if (f) flowsX.push({ date: x.date, amount: f });
        });
        if (t.qty > EPS) {
          held = true;
          if (c === null) miss = true; else vend += t.qty * c;
        }
      });
      V[i] = vend;
      exposed[i] = held || anyFlow;
      valMiss[i] = miss;
      missing[i] = miss || gap || !Number.isFinite(prevV);
      if (!missing[i]) {
        const ra = prevV > EPS ? vpre / prevV : 1;
        const den = vpre + inflow;
        const rb = den > EPS ? (vend + outflow) / den : 1;
        growth[i] = ra * rb;
      } else growth[i] = NaN;
      prevV = miss ? NaN : vend;
    }

    const last = n - 1;
    const rangeOk = (a, b) => { for (let i = a; i <= b; i += 1) if (missing[i]) return false; return true; };
    const product = (a, b) => { let g = 1; for (let i = a; i <= b; i += 1) g *= growth[i]; return g; };
    const anyExposure = (a, b) => { for (let i = a; i <= b; i += 1) if (exposed[i]) return true; return false; };
    const startOf = (p) => {
      if (p === "1M") return addDays(endDate, -30);
      if (p === "3M") return addDays(endDate, -91);
      if (p === "1Y") return addDays(endDate, -365);
      if (p === "YTD") return `${Number(endDate.slice(0, 4)) - 1}-12-31`;
      return "";
    };
    const firstBarAll = tk.reduce((m, t) => (t.firstBar && (!m || t.firstBar < m) ? t.firstBar : m), "");
    PERIODS.forEach((p) => {
      if (p === "ALL") {
        if (anyUndated) { out.why[p] = "undated"; return; }
        if (!inception) { out.why[p] = "nodata"; return; }
        // 첫 거래가 봉 시작 전이면 그 사이 가격을 모른다
        const firstTx = tk.map((t) => t.byDay.findIndex((d) => d.length)).filter((k) => k >= 0);
        if (!firstTx.length) { out.why[p] = "nodata"; return; }
        const k = Math.min(...firstTx);
        if (inception < D[0] || tk.some((t) => t.byDay.some((d) => d.some((x) => x.date && x.date < (t.firstBar || "9999"))))) { out.why[p] = "nodata"; return; }
        if (!rangeOk(k, last)) { out.why[p] = "nodata"; return; }
        out.twr[p] = (product(k, last) - 1) * 100; out.why[p] = "";
        return;
      }
      const start = startOf(p);
      if (!anyUndated && (!inception || inception > start)) { out.why[p] = "short"; return; }
      let s = -1;
      for (let i = last; i >= 0; i -= 1) if (D[i] <= start) { s = i; break; }
      if (s < 0 || (firstBarAll && firstBarAll > start)) { out.why[p] = "nodata"; return; }
      if (valMiss[s] || !rangeOk(s + 1, last)) { out.why[p] = "nodata"; return; }
      if (!(V[s] > EPS) && !anyExposure(s + 1, last)) { out.why[p] = "none"; return; }
      out.twr[p] = (product(s + 1, last) - 1) * 100; out.why[p] = "";
    });

    // XIRR(전체) — 날짜 있는 모든 흐름 + 마지막 봉 평가액(양수)
    // XIRR 은 사용자가 넣은 현금흐름과 마지막 평가액만 쓴다(중간 봉은 필요 없다).
    out.value = valMiss[last] ? null : V[last];
    if (anyUndated) out.xirrWhy = "undated";
    else if (out.value === null || !flowsX.length) out.xirrWhy = "nodata";
    else if (!inception || dayNum(endDate) - dayNum(inception) < XIRR_MIN_DAYS) out.xirrWhy = "short";
    else {
      const dca = dcaCore();
      const flows = flowsX.slice();
      if (V[last] > EPS) flows.push({ date: endDate, amount: V[last] });
      const r = dca && typeof dca.xirr === "function" ? dca.xirr(flows) : null;
      if (r === null || !Number.isFinite(r)) out.xirrWhy = "nodata"; else out.xirr = r * 100;
    }
    return out;
  }

  // 원장 상태를 날짜 직전까지(< date) 굴려 보유 수량을 낸다(분할 반영, 과매도 무시).
  function qtyBefore(txs, date) {
    let q = 0;
    sortTxs(txs).forEach((t) => {
      if (t.date && t.date >= date) return;
      if (t.type === "buy" || t.type === "open") q += fnum(t.qty);
      else if (t.type === "sell") { if (fnum(t.qty) <= q + EPS) q = Math.max(0, q - fnum(t.qty)); } else if (t.type === "split" && q > 0) q *= fnum(t.ratio);
    });
    return q;
  }

  function firstDated(txs) {
    let f = "";
    (txs || []).forEach((t) => { if (t && isIso(t.date) && (!f || t.date < f)) f = t.date; });
    return f;
  }

  /**
   * '받았을 배당(추정)' 제안. 원장의 첫 날짜 거래 뒤 배당락일마다, 배당락 전날까지의 보유 수량 × 주당 배당.
   * 상세 배당은 분할 소급(현재 주식 수 기준)이라 그 뒤 분할 비율을 곱해 그때 주식 수 기준 주당 금액으로 되돌린다.
   * 이미 기록한 배당(exDate 같음, 또는 exDate 없이 배당락 ~ +60일 안에 기록)·무시한 것·오늘 이후는 뺀다.
   * → [{ kind:"dividend", key, ticker, exDate, qty, dps, amount, estimated:true }]
   */
  function dividendSuggestions(args) {
    const a = args || {};
    const txs = (a.txs || []).filter((t) => t && t.ticker === a.ticker);
    const start = firstDated(txs);
    if (!start) return [];
    const today = isIso(a.today) ? a.today : "9999-12-31";
    const dismissed = a.dismissed instanceof Set ? a.dismissed : new Set(a.dismissed || []);
    const splits = effectiveSplits(a.splits, txs);
    // 아직 기록하지 않은 분할이 있으면 그 뒤 배당락은 원장 수량(분할 전 주식 수)이 틀리므로 제안하지 않는다(분할 제안이 먼저).
    const pending = splitSuggestions({ ticker: a.ticker, txs, splits: a.splits, today, dismissed: new Set() });
    const stopAt = pending.length ? pending[0].date : "9999-12-31";
    const recorded = txs.filter((t) => t.type === "dividend");
    const out = [];
    normDividends(a.dividends).forEach((d) => {
      if (d.exDate <= start || d.exDate > today || d.exDate >= stopAt) return;
      const key = `${a.ticker}|div|${d.exDate}`;
      if (dismissed.has(key)) return;
      const done = recorded.some((t) => (t.exDate ? t.exDate === d.exDate : (isIso(t.date) && dayNum(t.date) >= dayNum(d.exDate) && dayNum(t.date) - dayNum(d.exDate) <= DIV_MATCH_DAYS)));
      if (done) return;
      const qty = qtyBefore(txs, d.exDate);
      if (!(qty > EPS)) return;
      const dps = d.dps * factorAfter(splits, d.exDate);
      out.push({ kind: "dividend", key, ticker: a.ticker, exDate: d.exDate, qty, dps, amount: qty * dps, estimated: true });
    });
    return out;
  }

  /**
   * 분할 제안. 원장 첫 날짜 거래 뒤(초과)·오늘까지의 상세 분할 중, 그 직전에 보유가 있고 ±7일 안에 기록한 분할이 없는 것.
   * → [{ kind:"split", key, ticker, date, ratio }]
   */
  function splitSuggestions(args) {
    const a = args || {};
    const txs = (a.txs || []).filter((t) => t && t.ticker === a.ticker);
    const start = firstDated(txs);
    if (!start) return [];
    const today = isIso(a.today) ? a.today : "9999-12-31";
    const dismissed = a.dismissed instanceof Set ? a.dismissed : new Set(a.dismissed || []);
    const recorded = txs.filter((t) => t.type === "split" && isIso(t.date));
    const out = [];
    normSplits(a.splits).forEach((s) => {
      if (s.date <= start || s.date > today) return;
      const key = `${a.ticker}|split|${s.date}`;
      if (dismissed.has(key)) return;
      if (recorded.some((t) => Math.abs(dayNum(t.date) - dayNum(s.date)) <= SPLIT_MATCH_DAYS)) return;
      if (!(qtyBefore(txs, s.date) > EPS)) return;
      out.push({ kind: "split", key, ticker: a.ticker, date: s.date, ratio: s.ratio });
    });
    return out;
  }

  // 원장 배당 기록 → 연도·종목별 합계(세전·원천징수·세후). → { gross, tax, net, count, byTicker: {T: {gross, tax, net, count}} }
  function dividendTotals(txs, year) {
    const y = String(year || "");
    const out = { gross: 0, tax: 0, net: 0, count: 0, byTicker: {} };
    (txs || []).forEach((t) => {
      if (!t || t.type !== "dividend" || !isIso(t.date)) return;
      if (y && t.date.slice(0, 4) !== y) return;
      const g = divGross(t);
      const tax = fnum(t.tax) + fnum(t.fee);
      const row = out.byTicker[t.ticker] || (out.byTicker[t.ticker] = { gross: 0, tax: 0, net: 0, count: 0 });
      [out, row].forEach((r) => { r.gross += g; r.tax += tax; r.net += g - tax; r.count += 1; });
    });
    return out;
  }

  const api = {
    PERIODS,
    PERIOD_LABEL,
    normBars,
    normSplits,
    normDividends,
    factorAfter,
    effectiveSplits,
    rawCloses,
    txFlow,
    performance,
    qtyBefore,
    dividendSuggestions,
    splitSuggestions,
    dividendTotals,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirLedgerPerfCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
