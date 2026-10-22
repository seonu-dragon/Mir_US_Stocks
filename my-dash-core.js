// 내 대시보드(위젯 고르기·순서) — 순수 계산 모듈(DOM 없음).
// 브라우저 window.MirDashCore, node 테스트 scripts/tests/test_my_dash_core.mjs.
// 레이아웃 = 위젯 id 배열(위에서 아래 순서). 시장마다 따로(같은 위젯도 미국·국내 데이터가 다르다).
(function (root) {
  "use strict";

  // id → { label, markets } — 국내에 없는 데이터(이상 옵션 거래)는 미국에서만 고를 수 있다.
  const WIDGETS = {
    regime: { label: "오늘 시장 한 줄", markets: ["us", "kr"] },
    watch: { label: "관심 종목 시세", markets: ["us", "kr"] },
    sectors: { label: "섹터 강약", markets: ["us", "kr"] },
    breadth: { label: "시장 폭", markets: ["us", "kr"] },
    issues: { label: "오늘의 이슈", markets: ["us", "kr"] },
    movers: { label: "오늘의 특징주", markets: ["us", "kr"] },
    uoa: { label: "이상 옵션 거래", markets: ["us"] },
  };
  const DEFAULT = ["regime", "watch", "issues", "movers"];

  function available(market) {
    return Object.keys(WIDGETS).filter((id) => WIDGETS[id].markets.includes(market));
  }

  /** 저장값 → 유효한 레이아웃(모르는 id·다른 시장 전용·중복 제거). 비었거나 깨졌으면 기본값. */
  function sanitize(raw, market) {
    const ok = new Set(available(market));
    const list = Array.isArray(raw) ? raw : null;
    if (!list) return DEFAULT.filter((id) => ok.has(id));
    return [...new Set(list.map(String))].filter((id) => ok.has(id));
  }

  function add(layout, id, market) {
    return available(market).includes(id) && !layout.includes(id) ? [...layout, id] : layout.slice();
  }

  function remove(layout, id) {
    return layout.filter((x) => x !== id);
  }

  /** delta -1 위로 · +1 아래로. 끝을 넘으면 그대로. */
  function move(layout, id, delta) {
    const i = layout.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= layout.length) return layout.slice();
    const out = layout.slice();
    [out[i], out[j]] = [out[j], out[i]];
    return out;
  }

  /** 아직 추가하지 않은 위젯 [{id, label}]. */
  function addable(layout, market) {
    return available(market).filter((id) => !layout.includes(id)).map((id) => ({ id, label: WIDGETS[id].label }));
  }

  const api = { WIDGETS, DEFAULT, available, sanitize, add, remove, move, addable };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirDashCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
