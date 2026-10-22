// short-interest-core.js — 미국 공매도 잔고 보드(Nasdaq/FINRA short interest)의 순수 계산(DOM 없음).
// 브라우저 window.MirShortInterest, node 테스트 scripts/tests/test_short_interest_core.mjs.
// - 잔고일수(DTC)는 Nasdaq 표기상 1 아래를 1.0 으로 올려 준다(잔고 445주 / 일평균 52,244주 → 1.0).
//   잔고·평균거래량이 둘 다 있으면 실제 비율로 '<1' 을 가려낸다.
// - 일평균 거래량이 아주 작은 종목(SPAC 등, 평균 45주)은 DTC 가 수백 일로 튀어 1위를 차지한다 —
//   유동성 기준 미달 행은 정렬에서 뒤로 보낸다(지우지 않는다).
// - 값이 없으면 null → 화면 '—'. 0 으로 채우지 않는다.
(function (root) {
  "use strict";

  const MIN_AVG_VOLUME = 50000;        // 주
  const MIN_DOLLAR_VOLUME = 1e6;       // USD(가격을 알 때만)

  function num(v) {
    if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  /** 유동성 미달인가 — 평균거래량을 모르거나 5만 주 미만, 또는 가격을 알면 일평균 거래대금 $100만 미만. */
  function isIlliquid(row, price) {
    const v = num(row && row.avgVolume);
    if (v == null || v < MIN_AVG_VOLUME) return true;
    const p = num(price);
    return p != null && p > 0 && v * p < MIN_DOLLAR_VOLUME;
  }

  /** 잔고일수 { value, floored } — 없으면 null. floored: Nasdaq 의 1.0 이 실제로는 1 미만. */
  function dtc(row) {
    const d = num(row && row.daysToCover);
    if (d == null) return null;
    const s = num(row.shortShares), v = num(row.avgVolume);
    if (d <= 1 && s != null && v != null && v > 0 && s / v < 1) return { value: s / v, floored: true };
    return { value: d, floored: false };
  }

  function fmtDtc(row, digits = 2) {
    const x = dtc(row);
    if (!x) return "—";
    return x.floored ? "<1" : x.value.toFixed(digits);
  }

  /** DTC 내림차순. 유동성 미달 행은 뒤로, DTC 없는 행은 맨 뒤. priceOf(ticker) → 가격|null. */
  function sortByDtc(rows, priceOf) {
    const p = typeof priceOf === "function" ? priceOf : () => null;
    return (rows || []).map((r) => ({ r, ill: isIlliquid(r, p(r.ticker)), d: dtc(r) }))
      .sort((a, b) => (a.d == null) - (b.d == null) || a.ill - b.ill || ((b.d ? b.d.value : 0) - (a.d ? a.d.value : 0)))
      .map((x) => x.r);
  }

  const api = { MIN_AVG_VOLUME, MIN_DOLLAR_VOLUME, isIlliquid, dtc, fmtDtc, sortByDtc };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirShortInterest = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
