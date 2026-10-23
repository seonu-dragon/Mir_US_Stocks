// 종목별 기술적 신호 — 순수 계산 모듈(DOM·네트워크 없음).
// 브라우저에서는 window.MirTechCore, node 테스트(scripts/tests/test_tech_signals_core.mjs)에서는
// module.exports 로 같은 코드를 쓴다. IIFE 라 최상위 이름을 전역에 흘리지 않는다.
//
// 원천: data/tech_signals.js(window.TECH_SIGNALS) — scripts/build_market_breadth.py 가 시장 폭과 같은
// 순회에서 쓴다. { cols: [...], tickers: { TICKER: [값...] } } 꼴의 압축 행이고, 계산 정의는
// scripts/tech_signals_core.py 한 곳에 있다(RS 가중치·백분위·교차 규칙).
//
// 여기서 하는 일은 두 가지다.
//  1) 압축 행 → 이름 있는 값(decode).
//  2) '며칠 전 교차'(bars) → `...Within5` 같은 불리언 파생(fields). 수식 스크리너의 필드 타입은
//     전부 숫자라 불리언은 1/0 으로 낸다(없는 값은 null — 0 으로 채우지 않는다).
(function (root) {
  "use strict";

  // 교차·신고가를 되짚는 최대 봉(tech_signals_core.py LOOKBACK 과 같아야 한다).
  const LOOKBACK = 10;

  function num(v) {
    if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  // 압축 행 → { col: 값 }. 없으면 null.
  function decode(payload, ticker) {
    if (!payload || !payload.tickers || !Array.isArray(payload.cols)) return null;
    const key = String(ticker || "");
    const arr = payload.tickers[key] || payload.tickers[key.toUpperCase()];
    if (!Array.isArray(arr)) return null;
    const out = {};
    payload.cols.forEach((c, i) => { out[c] = arr[i] === undefined ? null : arr[i]; });
    return out;
  }

  // 'n봉 전에 일어났다' → n <= within 이면 1, 아니면 0. 값이 없으면(그 창에 사건이 없었음) 0.
  // bars 가 없다는 건 '관측 창 안에 사건이 없었다'는 뜻이라 거짓이지 결측이 아니다.
  function within(bars, limit) {
    const n = num(bars);
    if (n === null) return 0;
    return n <= limit ? 1 : 0;
  }

  // 이름 있는 파생 필드. row = decode() 결과. 반환 { 필드: 숫자|null }.
  function fields(row) {
    if (!row) return null;
    const rsi = num(row.r14);
    const rsiPrev = num(row.r14p);
    return {
      rsRating: num(row.rs),
      rsNewHigh: row.rsnh === null || row.rsnh === undefined ? null : (row.rsnh ? 1 : 0),
      rsNewHighBeforePrice: row.rsnhb === null || row.rsnhb === undefined ? null : (row.rsnhb ? 1 : 0),
      close_1d: num(row.c1),
      sma20: num(row.s20),
      sma20_1d: num(row.s20p),
      sma50: num(row.s50),
      sma50_1d: num(row.s50p),
      rsi_1d: rsiPrev,
      rsiChg1d: rsi === null || rsiPrev === null ? null : Math.round((rsi - rsiPrev) * 100) / 100,
      crossUpSma20Bars: num(row.xu20),
      crossDownSma20Bars: num(row.xd20),
      crossUpSma50Bars: num(row.xu50),
      crossDownSma50Bars: num(row.xd50),
      newHigh20Bars: num(row.nh20),
      macdCrossUpBars: num(row.mxu),
      macdCrossDownBars: num(row.mxd),
      crossUpSma20Within5: within(row.xu20, 5),
      crossDownSma20Within5: within(row.xd20, 5),
      crossUpSma50Within5: within(row.xu50, 5),
      crossDownSma50Within5: within(row.xd50, 5),
      newHigh20Within5: within(row.nh20, 5),
      macdCrossUpWithin3: within(row.mxu, 3),
      macdCrossDownWithin3: within(row.mxd, 3),
    };
  }

  function rowFields(payload, ticker) {
    return fields(decode(payload, ticker));
  }

  // RS 등급 구간 문구(화면 표기용 — 예측이 아니라 등급 위치 설명).
  function rsBand(rating) {
    const v = num(rating);
    if (v === null) return "";
    if (v >= 90) return "상위 10%";
    if (v >= 70) return "상위 30%";
    if (v >= 50) return "중상위";
    if (v >= 30) return "중하위";
    return "하위 30%";
  }

  const api = { LOOKBACK, decode, fields, rowFields, within, rsBand };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirTechCore = api;
})(typeof window !== "undefined" ? window : null);
