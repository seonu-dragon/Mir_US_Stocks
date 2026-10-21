// 배당 성장 이력 — 순수 표기 모듈(DOM 없음).
// 브라우저 window.MirDivGrowthCore, node 테스트 scripts/tests/test_dividend_growth_core.mjs.
// 입력 window.DIVIDEND_GROWTH(시장별 — 미국 scripts/build_dividend_growth.py, 국내 build_kr_dividend_growth.py):
//   { lastYear, cols: [up, paid, cagr5, cagr10, last, since, capped, paidCapped, lastCut, specials], tickers: {T: [...]} }
// up = 연속 증가 연수, paid = 연속 지급 연수(둘 다 lastYear 까지), capped/paidCapped = 연속이 기록 첫머리(since)에
// 닿아 그 앞은 모름 → 화면은 'N년+' 로 적는다.
(function (root) {
  "use strict";

  const COLS = ["up", "paid", "cagr5", "cagr10", "last", "since", "capped", "paidCapped", "lastCut", "specials"];

  function record(payload, ticker) {
    const arr = payload && payload.tickers && payload.tickers[ticker];
    if (!Array.isArray(arr)) return null;
    const cols = Array.isArray(payload.cols) && payload.cols.length ? payload.cols : COLS;
    const o = { lastYear: payload.lastYear || null };
    cols.forEach((c, i) => { o[c] = arr[i] === undefined ? null : arr[i]; });
    return o;
  }

  function years(n, capped) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "—";
    return `${v}년${capped && v > 0 ? "+" : ""}`;
  }

  // 연속 증가 칸: '12년' · '39년+' · '0년'(작년에 늘리지 않음).
  function streakText(rec) { return rec ? years(rec.up, rec.capped) : "—"; }
  function paidText(rec) { return rec ? years(rec.paid, rec.paidCapped) : "—"; }

  function cagrText(v) {
    const n = Number(v);
    if (v == null || !Number.isFinite(n)) return "—";
    return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
  }

  // 정렬용 값: 연속 증가 연수(없으면 −1 → 맨 뒤).
  function sortValue(rec) {
    const v = rec ? Number(rec.up) : NaN;
    return Number.isFinite(v) ? v : -1;
  }

  // KPI 타일 보조 줄: '2025년까지 · 5년 연평균 +6.0% · 최근 감액 2023'
  function subText(rec) {
    if (!rec) return "";
    const parts = [];
    if (rec.lastYear) parts.push(`${rec.lastYear}년까지`);
    if (rec.cagr5 != null) parts.push(`5년 연평균 ${cagrText(rec.cagr5)}`);
    if ((rec.capped || rec.paidCapped) && rec.since) parts.push(`기록 시작 ${rec.since}`);
    if (rec.lastCut) parts.push(`최근 감액 ${rec.lastCut}`);
    return parts.join(" · ");
  }

  const api = { COLS, record, streakText, paidText, cagrText, sortValue, subText };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirDivGrowthCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
