// 종목 요약의 시세정보·투자정보 — 순수 계산 모듈(DOM·네트워크 없음).
// 브라우저에서는 window.MirQuoteCore, node 테스트(scripts/tests/test_quote_info_core.mjs)에서는 module.exports.
//
// - 52주 고저·날짜: 상세 파일 chartSeries([시, 고, 저, 종, 거래량, 날짜]) 최근 252봉의 고가·저가 + 현재가.
// - 세션 봉: 가격 기준일(priceDate)의 시가·고가·저가와 전일 종가. 기준일 봉이 없으면 시가·고가·저가는 비운다.
// - 재무비율 TTM: 재무 확장 파일(financials_common.py 스키마)의 ttm. 가격 배수는 주가 통화와 재무 통화가 같고
//   주식수 기준이 섞이지 않은(ADR·해외발행인 아님) 종목만. 정의상 무의미한 값은 fundamentals-sanity 규칙대로 뺀다.
// - 동일업종 중앙값: 업종(표본 5개 미만이면 섹터) 안에서 PER(양수·이상치 제외)과 당일 등락률의 중앙값.
(function (root) {
  "use strict";

  const WEEK52_BARS = 252;
  const MIN_WEEK52_BARS = 20;
  const MIN_PEERS = 5;
  // fundamentals-sanity-core.js 의 PLAUSIBLE 경계(pe·ps·pb 상한). 브라우저에선 MirFundSanity 가 있으면 그걸 쓴다.
  const FALLBACK_BOUNDS = { pe: [null, 1000], ps: [null, 200], pb: [null, 100], roe: [-300, 300], roa: [-100, 100], debtRatio: [null, 2000] };

  function num(v) {
    if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function sanity() {
    return (root && root.MirFundSanity) || null;
  }

  function isOutlier(key, v) {
    const s = sanity();
    if (s && typeof s.isOutlier === "function" && s.bounds(key)) return s.isOutlier(key, v);
    const b = FALLBACK_BOUNDS[key];
    const x = num(v);
    if (!b || x === null) return false;
    return (b[0] !== null && x < b[0]) || (b[1] !== null && x > b[1]);
  }

  function comma(n, digits) {
    const d = digits || 0;
    return Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function median(values) {
    const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
    if (!xs.length) return null;
    const mid = Math.floor(xs.length / 2);
    return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
  }

  // ── 숫자 표기 ──────────────────────────────────────────────────────────────
  // 큰 원화: 1,674조 9,588억 · 5,504억 · 3,210만 · 9,999 (단위 '원'은 붙이지 않는다)
  function fmtKrwLarge(won) {
    const n = num(won);
    if (n === null) return "—";
    const sign = n < 0 ? "-" : "";
    const a = Math.abs(n);
    if (a >= 1e12) {
      let jo = Math.floor(a / 1e12);
      let eok = Math.round((a - jo * 1e12) / 1e8);
      if (eok >= 10000) { jo += 1; eok -= 10000; }
      return `${sign}${comma(jo)}조${eok ? ` ${comma(eok)}억` : ""}`;
    }
    if (a >= 1e8) return `${sign}${comma(Math.round(a / 1e8))}억`;
    if (a >= 1e4) return `${sign}${comma(Math.round(a / 1e4))}만`;
    return `${sign}${comma(Math.round(a))}`;
  }

  // 원화 병기(해외 종목): ≈ 30만 6,000원 · ≈ 6,904조 1,234억원
  function fmtKrwApprox(won) {
    const n = num(won);
    if (n === null || n <= 0) return "";
    const a = Math.round(n);
    if (a >= 1e12) return `≈ ${fmtKrwLarge(a)}원`;
    if (a >= 1e8) {
      let eok = Math.floor(a / 1e8);
      let man = Math.round((a - eok * 1e8) / 1e4);
      if (man >= 10000) { eok += 1; man -= 10000; }
      return `≈ ${comma(eok)}억${man ? ` ${comma(man)}만` : ""}원`;
    }
    if (a >= 1e4) {
      const man = Math.floor(a / 1e4);
      const rest = a - man * 1e4;
      return `≈ ${comma(man)}만${rest ? ` ${comma(rest)}` : ""}원`;
    }
    return `≈ ${comma(a)}원`;
  }

  // 큰 달러: $4.98T · $123.45B · $45.6M · $12,345
  function fmtUsdLarge(usd) {
    const n = num(usd);
    if (n === null) return "—";
    const sign = n < 0 ? "-" : "";
    const a = Math.abs(n);
    if (a >= 1e12) return `${sign}$${(a / 1e12).toFixed(2)}T`;
    if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
    if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`;
    return `${sign}$${comma(Math.round(a))}`;
  }

  function fmtShares(n) {
    const v = num(n);
    return v === null ? "—" : `${comma(Math.round(v))}주`;
  }

  // 2026-09-23 → 2026.09.23
  function fmtDate(iso) {
    const s = String(iso || "");
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? `${s.slice(0, 4)}.${s.slice(5, 7)}.${s.slice(8, 10)}` : "";
  }

  // ── 시세 ──────────────────────────────────────────────────────────────────
  function barRows(series) {
    return (Array.isArray(series) ? series : []).filter((r) => Array.isArray(r) && r.length >= 6 && num(r[3]) !== null);
  }

  // 52주(최근 252봉) 최고·최저와 날짜, 현재가 위치(0=최저, 100=최고). 봉이 20개 미만이면 null.
  // opts.basis: "intraday"(기본, 고가·저가) | "close"(종가). 사이트의 기존 52주 값과 같은 기준을 고른다 —
  // KR 은 빌더가 종가로 산출(attach_week52_from_history), US 는 소스(나스닥)가 장중 고저다.
  function week52Range(series, opts) {
    const o = opts || {};
    const rows = barRows(series).slice(-WEEK52_BARS);
    if (rows.length < MIN_WEEK52_BARS) return null;
    const closeBasis = o.basis === "close";
    let high = -Infinity, low = Infinity, highDate = null, lowDate = null;
    for (const r of rows) {
      const h = closeBasis ? num(r[3]) : (num(r[1]) ?? num(r[3]));
      const l = closeBasis ? num(r[3]) : (num(r[2]) ?? num(r[3]));
      if (h !== null && h >= high) { high = h; highDate = r[5] || null; }
      if (l !== null && l <= low) { low = l; lowDate = r[5] || null; }
    }
    const price = num(o.price);
    if (price !== null && price > high) { high = price; highDate = o.priceDate || rows[rows.length - 1][5] || null; }
    if (price !== null && price < low) { low = price; lowDate = o.priceDate || rows[rows.length - 1][5] || null; }
    if (!Number.isFinite(high) || !Number.isFinite(low)) return null;
    const pos = price !== null && high > low ? Math.max(0, Math.min(100, (price - low) / (high - low) * 100)) : null;
    return { high, highDate, low, lowDate, pos, basis: closeBasis ? "close" : "intraday", bars: rows.length, from: rows[0][5] || null, to: rows[rows.length - 1][5] || null };
  }

  // 가격 기준일의 봉. { date, open, high, low, prevClose, volume, barMissing }.
  // 마지막 봉이 기준일보다 이르면(야후가 그날 봉을 아직 안 줌) 전일 종가만 확실하다.
  function sessionBar(series, priceDate) {
    const rows = barRows(series);
    if (!rows.length) return null;
    const last = rows[rows.length - 1];
    const lastDate = String(last[5] || "");
    const pd = String(priceDate || "");
    if (pd && lastDate && lastDate < pd) {
      return { date: pd, open: null, high: null, low: null, prevClose: num(last[3]), volume: null, barMissing: true };
    }
    const prev = rows.length >= 2 ? rows[rows.length - 2] : null;
    return {
      date: lastDate || null,
      open: num(last[0]),
      high: num(last[1]),
      low: num(last[2]),
      prevClose: prev ? num(prev[3]) : null,
      volume: num(last[4]),
      barMissing: false,
    };
  }

  // 최근 1년 주당 배당 합(ex-date 기준). dividends = [["YYYY-MM-DD", 금액], ...]
  function trailingDividend(dividends, asOf) {
    const list = Array.isArray(dividends) ? dividends : [];
    if (!list.length) return null;
    const end = String(asOf || list[list.length - 1][0] || "");
    if (!/^\d{4}-\d{2}-\d{2}/.test(end)) return null;
    const start = `${Number(end.slice(0, 4)) - 1}${end.slice(4, 10)}`;
    let sum = 0, n = 0;
    for (const e of list) {
      const d = String(e && e[0] || "");
      const amt = num(e && e[1]);
      if (amt !== null && amt > 0 && d > start && d <= end) { sum += amt; n += 1; }
    }
    return n ? { amount: sum, count: n } : null;
  }

  function navPremiumPct(price, nav) {
    const p = num(price), n = num(nav);
    return p !== null && n !== null && p > 0 && n > 0 ? (p / n - 1) * 100 : null;
  }

  // 액면분할 목록 → [{date, ratio: "4:1", kind: "분할"|"병합"}], 최신순.
  function splitEvents(splits) {
    const out = [];
    for (const e of Array.isArray(splits) ? splits : []) {
      const d = String(e && e[0] || "");
      const a = num(e && e[1]), b = num(e && e[2]);
      if (!/^\d{4}-\d{2}-\d{2}/.test(d) || !(a > 0) || !(b > 0) || a === b) continue;
      const fmt = (x) => (Number.isInteger(x) ? String(x) : String(Number(x.toFixed(4))));
      out.push({ date: d, ratio: `${fmt(a)}:${fmt(b)}`, kind: a > b ? "분할" : "병합" });
    }
    return out.sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0));
  }

  // ── 재무비율 TTM ───────────────────────────────────────────────────────────
  function div(a, b) {
    const x = num(a), y = num(b);
    return x !== null && y !== null && y !== 0 ? x / y : null;
  }

  function latestAnnual(file, key) {
    const rows = (file && Array.isArray(file.annual)) ? file.annual : [];
    for (let i = rows.length - 1; i >= 0; i--) {
      const v = num(rows[i] && rows[i][key]);
      if (v !== null) return v;
    }
    return null;
  }

  // ctx = { marketCap: 주가 통화 기준 시가총액(절대 금액), priceCurrency: "USD"|"KRW" }
  // 반환 { basis, label, currency, priceMultiples, values: {psr, pcfr, per, pbr, sps, cfps, bps, eps, opMargin, netMargin, roe, roa, debtRatio}, notes }
  function ttmRatios(file, ctx) {
    const t = file && file.ttm;
    if (!t || typeof t !== "object") return null;
    const c = ctx || {};
    const flags = Array.isArray(file.flags) ? file.flags : [];
    const financial = flags.includes("financial") || (file.industryType && file.industryType !== "general");
    const sameCurrency = !file.currency || !c.priceCurrency || file.currency === c.priceCurrency;
    const shareBasisOk = !flags.includes("adrShareBasis") && !flags.includes("foreignFiler");
    const priceMultiples = sameCurrency && shareBasisOk;
    const notes = [];
    if (!sameCurrency) notes.push("재무 통화가 주가 통화와 달라 가격 배수는 계산하지 않습니다.");
    else if (!shareBasisOk) notes.push("주식 기준(ADR 등)이 달라 가격 배수는 계산하지 않습니다.");

    const rev = num(t.rev), op = num(t.op), net = num(t.net), ocf = num(t.ocf);
    const equity = num(t.equity) ?? latestAnnual(file, "equity");
    const assets = num(t.assets) ?? latestAnnual(file, "assets");
    const liab = num(t.liab) ?? latestAnnual(file, "liab");
    const shares = num(t.sharesOut) ?? latestAnnual(file, "sharesOut") ?? num(t.sharesDilAvg);
    const mcap = num(c.marketCap);
    const v = {};
    const pos = (x) => (x !== null && x > 0 ? x : null);

    if (priceMultiples && mcap !== null && mcap > 0) {
      v.psr = pos(rev) !== null ? mcap / rev : null;
      v.per = pos(net) !== null ? mcap / net : null;
      v.pbr = pos(equity) !== null ? mcap / equity : null;
      v.pcfr = !financial && pos(ocf) !== null ? mcap / ocf : null;
    }
    if (priceMultiples && shares !== null && shares > 0) {
      v.sps = rev !== null ? rev / shares : null;
      v.cfps = !financial && ocf !== null ? ocf / shares : null;
      v.bps = equity !== null ? equity / shares : null;
      v.eps = net !== null ? net / shares : null;
    }
    const negEquity = equity !== null && equity <= 0;
    v.opMargin = !financial && pos(rev) !== null && op !== null ? op / rev * 100 : null;
    v.netMargin = pos(rev) !== null && net !== null ? net / rev * 100 : null;
    v.roe = !negEquity && pos(equity) !== null && net !== null ? net / equity * 100 : null;
    v.roa = pos(assets) !== null && net !== null ? net / assets * 100 : null;
    v.debtRatio = !financial && !negEquity && pos(equity) !== null && liab !== null ? liab / equity * 100 : null;

    // 정의상 무의미·이상치 정리(fundamentals-sanity 규칙): 배수 ≤ 0 은 결측, 경계 밖은 결측으로 두지 않고 표시만 남긴다.
    const outliers = [];
    [["psr", "ps"], ["per", "pe"], ["pbr", "pb"], ["roe", "roe"], ["roa", "roa"], ["debtRatio", "debtRatio"]].forEach(([k, sk]) => {
      if (v[k] !== null && v[k] !== undefined && isOutlier(sk, v[k])) outliers.push(k);
    });
    Object.keys(v).forEach((k) => { if (v[k] === null || !Number.isFinite(v[k])) delete v[k]; });
    if (!Object.keys(v).length) return null;
    const label = t.basis === "4Q" ? `최근 4분기(${(t.quarters || []).slice(-1)[0] || `${t.fy || ""}Q${t.fq || ""}`}까지)` : `FY${t.fy || ""} 연간`;
    return { basis: t.basis || null, label, end: t.end || null, currency: file.currency || null, financial: !!financial, priceMultiples, values: v, outliers, notes };
  }

  // ── 동일업종 ───────────────────────────────────────────────────────────────
  // rows: [{ticker, sector, industry, changePct, pe, etf}] — pe 는 map_fundamentals 값.
  function peerMedians(rows, target, opts) {
    const o = opts || {};
    const minPeers = o.minPeers || MIN_PEERS;
    const list = (Array.isArray(rows) ? rows : []).filter((r) => r && !r.etf);
    const t = target || {};
    const pick = (key) => {
      const val = String(t[key] || "").trim();
      if (!val) return null;
      const group = list.filter((r) => String(r[key] || "").trim() === val);
      return group.length >= minPeers ? { level: key, label: val, group } : null;
    };
    const chosen = pick("industry") || pick("sector");
    if (!chosen) return null;
    const pes = chosen.group.map((r) => num(r.pe)).filter((x) => x !== null && x > 0 && !isOutlier("pe", x));
    const chg = chosen.group.map((r) => num(r.changePct)).filter((x) => x !== null);
    return {
      level: chosen.level,
      label: chosen.label,
      count: chosen.group.length,
      peMedian: pes.length >= minPeers ? median(pes) : null,
      peCount: pes.length,
      changeMedian: chg.length ? median(chg) : null,
      changeCount: chg.length,
    };
  }

  const api = {
    WEEK52_BARS, MIN_PEERS, num, median, comma,
    fmtKrwLarge, fmtKrwApprox, fmtUsdLarge, fmtShares, fmtDate,
    week52Range, sessionBar, trailingDividend, navPremiumPct, splitEvents,
    ttmRatios, peerMedians,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MirQuoteCore = api;
})(typeof window !== "undefined" ? window : globalThis);
