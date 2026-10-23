// 애널리스트 의견 변경 · EPS 추정치 변화 — 순수 계산 모듈(DOM 없음).
// 브라우저 window.MirAnalystRevCore, node 테스트 scripts/tests/test_analyst_revisions_core.mjs.
// 입력: window.US_ESTIMATE_REVISIONS · window.US_RATING_CHANGES(scripts/build_us_analyst_revisions.py).
//
// 정의
// - 추정치 변화율 = 현재 컨센서스 EPS ÷ N일 전 컨센서스 EPS − 1. 기준값 절댓값이 0.05 미만(적자 근처)이면
//   비율이 터지므로 계산하지 않는다(null) — 화면은 '—'.
// - 의견 행동은 야후 원문 코드: up 상향 · down 하향 · init 신규 · main 유지 · reit 재확인.
(function (root) {
  "use strict";

  const PERIOD_LABEL = { "0q": "이번 분기", "+1q": "다음 분기", "0y": "올해 회계연도", "+1y": "내년 회계연도" };
  const ACTION_LABEL = { up: "상향", down: "하향", init: "신규", main: "유지", reit: "재확인" };
  const MIN_BASE = 0.05;

  function num(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function changePct(cur, base) {
    const c = num(cur), b = num(base);
    if (c == null || b == null || Math.abs(b) < MIN_BASE) return null;
    return (c / Math.abs(b) - Math.sign(b)) * 100;
  }

  // 배열 행 → 객체. cols 는 빌더가 함께 준다(없으면 기본 순서).
  const EST_COLS = ["period", "end", "cur", "d7", "d30", "d60", "d90", "up7", "up30", "dn7", "dn30", "n"];
  function estimateRows(payload, ticker) {
    const rec = payload && payload.tickers && payload.tickers[ticker];
    if (!rec || !Array.isArray(rec.p)) return [];
    const cols = Array.isArray(payload.cols) && payload.cols.length ? payload.cols : EST_COLS;
    return rec.p.map((arr) => {
      const o = {};
      cols.forEach((c, i) => { o[c] = arr[i] === undefined ? null : arr[i]; });
      o.label = PERIOD_LABEL[o.period] || o.period;
      o.chg7 = changePct(o.cur, o.d7);
      o.chg30 = changePct(o.cur, o.d30);
      o.chg90 = changePct(o.cur, o.d90);
      return o;
    });
  }

  // 매출 컨센서스(빌더 v · revCols · vc=통화). growth = 평균 ÷ 전년 동기 매출 − 1(%), 전년 값이 없으면 야후 growth.
  const REV_COLS = ["period", "end", "avg", "low", "high", "n", "yearAgo", "growth"];
  function revenueRows(payload, ticker) {
    const rec = payload && payload.tickers && payload.tickers[ticker];
    if (!rec || !Array.isArray(rec.v)) return [];
    const cols = Array.isArray(payload.revCols) && payload.revCols.length ? payload.revCols : REV_COLS;
    const cur = typeof rec.vc === "string" && rec.vc ? rec.vc : null;
    return rec.v.map((arr) => {
      const o = {};
      cols.forEach((c, i) => { o[c] = arr[i] === undefined ? null : arr[i]; });
      const avg = num(o.avg), ya = num(o.yearAgo), g = num(o.growth);
      if (avg === null || avg <= 0) return null;
      return {
        period: o.period,
        label: PERIOD_LABEL[o.period] || o.period,
        end: o.end || null,
        avg,
        low: num(o.low),
        high: num(o.high),
        n: num(o.n),
        yearAgo: ya,
        yoy: ya !== null && ya > 0 ? (avg / ya - 1) * 100 : (g !== null ? g * 100 : null),
        cur,
      };
    }).filter(Boolean);
  }

  const RATING_COLS = ["d", "firm", "act", "from", "to", "pt", "ptPrev"];
  function tickerRatings(payload, ticker) {
    const rec = payload && payload.tickers && payload.tickers[ticker];
    if (!rec || !Array.isArray(rec.r)) return [];
    const cols = Array.isArray(payload.ratingCols) && payload.ratingCols.length ? payload.ratingCols : RATING_COLS;
    return rec.r.map((arr) => {
      const o = {};
      cols.forEach((c, i) => { o[c] = arr[i] === undefined ? null : arr[i]; });
      return o;
    });
  }

  // 시장 전체 30일 상향·하향 상위. 기본 기간 '0y'(올해 회계연도), 추정 애널리스트 minAnalysts 명 이상.
  function revisionLeaders(payload, opts) {
    const o = opts || {};
    const period = o.period || "0y";
    const minN = o.minAnalysts == null ? 5 : o.minAnalysts;
    const limit = o.limit || 10;
    const out = [];
    const tickers = (payload && payload.tickers) || {};
    Object.keys(tickers).forEach((t) => {
      const row = estimateRows(payload, t).find((r) => r.period === period);
      if (!row || row.chg30 == null) return;
      if (num(row.n) == null || row.n < minN) return;
      out.push({ ticker: t, cur: row.cur, d30: row.d30, chg30: row.chg30, up30: row.up30, dn30: row.dn30, n: row.n, end: row.end });
    });
    const up = out.filter((r) => r.chg30 > 0).sort((a, b) => b.chg30 - a.chg30 || a.ticker.localeCompare(b.ticker)).slice(0, limit);
    const down = out.filter((r) => r.chg30 < 0).sort((a, b) => a.chg30 - b.chg30 || a.ticker.localeCompare(b.ticker)).slice(0, limit);
    // 시장 폭: 30일 동안 추정치가 오른 종목 수 vs 내린 종목 수(±0.1% 안은 보합).
    const breadth = { up: 0, down: 0, flat: 0, total: out.length };
    out.forEach((r) => { if (r.chg30 > 0.1) breadth.up += 1; else if (r.chg30 < -0.1) breadth.down += 1; else breadth.flat += 1; });
    return { up, down, breadth };
  }

  // US_RATING_CHANGES.rows → 객체.
  function feedRows(payload) {
    if (!payload || !Array.isArray(payload.rows)) return [];
    const cols = Array.isArray(payload.cols) && payload.cols.length ? payload.cols : ["t", "d", "firm", "act", "from", "to", "pt", "ptPrev", "ptAct"];
    return payload.rows.map((arr) => {
      const o = {};
      cols.forEach((c, i) => { o[c] = arr[i] === undefined ? null : arr[i]; });
      o.ptChg = changePct(o.pt, o.ptPrev);
      return o;
    });
  }

  const KIND_TEST = {
    all: () => true,
    up: (r) => r.act === "up",
    down: (r) => r.act === "down",
    init: (r) => r.act === "init",
    ptUp: (r) => r.ptChg != null && r.ptChg > 0,
    ptDown: (r) => r.ptChg != null && r.ptChg < 0,
  };
  const KIND_LABEL = { all: "전체", up: "의견 상향", down: "의견 하향", init: "신규", ptUp: "목표가 상향", ptDown: "목표가 하향" };

  function filterFeed(rows, kind, tickerSet) {
    const test = KIND_TEST[kind] || KIND_TEST.all;
    return (rows || []).filter((r) => test(r) && (!tickerSet || tickerSet.has(r.t)));
  }

  function kindCounts(rows) {
    const out = {};
    Object.keys(KIND_TEST).forEach((k) => { out[k] = filterFeed(rows, k).length; });
    return out;
  }

  // ----- 스크리너 필드(수식 스크리너·찾기 표·클래식 스크리너·필터 목록, 2026-10-21) -----
  // 의견 변경 행을 종목별로 한 번 묶는다. 창은 asOf 기준 days 일(기본 payload.windowDays 또는 30).
  // 반환 { asOf, byTicker: { T: { up, down, init, pt: [목표가 변화율 %...] } } }
  function ratingIndex(payload, opts) {
    const o = opts || {};
    const out = { asOf: (payload && payload.asOf) || null, byTicker: {} };
    const rows = feedRows(payload);
    const days = o.days || (payload && payload.windowDays) || 30;
    let floor = "";
    if (out.asOf && /^\d{4}-\d{2}-\d{2}$/.test(out.asOf)) {
      const d = new Date(`${out.asOf}T00:00:00Z`);
      floor = new Date(d.getTime() - days * 86400000).toISOString().slice(0, 10);
    }
    rows.forEach((r) => {
      if (!r.t || (floor && (!r.d || r.d < floor))) return;
      const rec = out.byTicker[r.t] || (out.byTicker[r.t] = { up: 0, down: 0, init: 0, pt: [] });
      if (r.act === "up") rec.up += 1;
      else if (r.act === "down") rec.down += 1;
      else if (r.act === "init") rec.init += 1;
      if (r.ptChg != null) rec.pt.push(r.ptChg);
    });
    return out;
  }

  function median(list) {
    const a = (list || []).filter((v) => Number.isFinite(v)).sort((x, y) => x - y);
    if (!a.length) return null;
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  // 한 종목의 스크리너 값. 값이 없으면 null(0 으로 채우지 않는다).
  //   epsRev7/30/90  올해 회계연도(0y) 컨센서스 EPS N일 변화율(%) — changePct 규칙(기준 |0.05| 미만은 null)
  //   epsUp30/epsDown30  30일 동안 그 추정치를 올린/내린 애널리스트 수
  //   ratingUp30/ratingDown30  30일 의견 상향/하향 건수 — 수집 대상(추정치 파일에 있거나 의견 행이 있는 종목)만 0 을 갖는다
  //   targetChg30  30일 목표가 변경(이전 → 새 값) 변화율의 중앙값(%)
  function screenMetrics(estPayload, ratingIdx, ticker) {
    const out = { epsRev7: null, epsRev30: null, epsRev90: null, epsUp30: null, epsDown30: null, ratingUp30: null, ratingDown30: null, targetChg30: null };
    if (!ticker) return out;
    const row = estPayload ? estimateRows(estPayload, ticker).find((r) => r.period === "0y") : null;
    if (row) {
      out.epsRev7 = row.chg7;
      out.epsRev30 = row.chg30;
      out.epsRev90 = row.chg90;
      out.epsUp30 = num(row.up30);
      out.epsDown30 = num(row.dn30);
    }
    const scanned = Boolean(estPayload && estPayload.tickers && estPayload.tickers[ticker]);
    const rec = ratingIdx && ratingIdx.byTicker ? ratingIdx.byTicker[ticker] : null;
    if (ratingIdx && (rec || scanned)) {
      out.ratingUp30 = rec ? rec.up : 0;
      out.ratingDown30 = rec ? rec.down : 0;
    }
    if (rec && rec.pt.length) {
      const m = median(rec.pt);
      out.targetChg30 = m == null ? null : Math.round(m * 100) / 100;
    }
    return out;
  }

  function actionLabel(act) { return ACTION_LABEL[act] || act || "—"; }

  // '매수 → 보유' / '비중확대 유지' / '신규 매수'
  function gradeText(r) {
    const from = String((r && r.from) || "").trim();
    const to = String((r && r.to) || "").trim();
    if (!to && !from) return "—";
    if (r.act === "init" || !from) return to || "—";
    if (from === to) return to;
    return `${from} → ${to}`;
  }

  function fmtPct(v, digits) {
    const n = num(v);
    if (n == null) return "—";
    return `${n > 0 ? "+" : ""}${n.toFixed(digits == null ? 1 : digits)}%`;
  }

  const api = { PERIOD_LABEL, ACTION_LABEL, KIND_LABEL, num, changePct, estimateRows, revenueRows, tickerRatings, revisionLeaders, feedRows, filterFeed, kindCounts, ratingIndex, screenMetrics, actionLabel, gradeText, fmtPct };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirAnalystRevCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
