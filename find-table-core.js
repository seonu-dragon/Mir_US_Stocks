// 찾기 › 상위 종목 표 — 열 목록·열 설정(보이는 열·순서) 순수 로직(DOM 없음).
// 브라우저에서는 window.MirFindTableCore, node 테스트(scripts/tests/test_find_table_core.mjs)에서는
// module.exports 로 같은 코드를 쓴다. IIFE 라 최상위 이름을 전역에 흘리지 않는다.
//
// 열은 실제로 데이터가 있는 필드만 둔다(2026-09-26 스냅샷 기준).
//   · US 스냅샷에는 거래량·거래대금 필드가 없다 → US 에서는 거래량 배율만.
//   · 외국인 비율(foreignPct)은 국내 MAP_FUNDAMENTALS 에만 있다.
//   · PER·PBR·ROE·배당수익률은 MAP_FUNDAMENTALS(부팅 몇 초 뒤 도착) — 값이 없으면 화면은 "—".
(function (root) {
  "use strict";

  // metric: 헤더를 누르면 정렬 기준(#topMetric 옵션 값)으로 쓴다. 없으면 정렬 불가 열.
  const COLUMNS = [
    { key: "price", label: "현재가", markets: ["us", "kr"], num: true },
    { key: "changePct", label: "등락률", markets: ["us", "kr"], num: true, metric: "changePct" },
    { key: "weekChangePct", label: "1주", markets: ["us", "kr"], num: true, metric: "weekChangePct" },
    { key: "monthChangePct", label: "1개월", markets: ["us", "kr"], num: true, metric: "monthChangePct" },
    { key: "ytdChangePct", label: "연초 대비", markets: ["us", "kr"], num: true, metric: "ytdChangePct" },
    { key: "volume", label: "거래량", markets: ["kr"], num: true, metric: "volume" },
    { key: "amount", label: "거래대금", markets: ["kr"], num: true, metric: "amount" },
    { key: "volumeRatio", label: "거래량 배율", markets: ["us", "kr"], num: true, metric: "volumeRatio" },
    { key: "marketCap", label: "시가총액", markets: ["us", "kr"], num: true, metric: "marketCapB" },
    { key: "pe", label: "PER", markets: ["us", "kr"], num: true, metric: "pe" },
    { key: "pb", label: "PBR", markets: ["us", "kr"], num: true, metric: "pb" },
    { key: "roe", label: "ROE", markets: ["us", "kr"], num: true },
    { key: "divYield", label: "배당수익률", markets: ["us", "kr"], num: true },
    { key: "foreignPct", label: "외국인 비율", markets: ["kr"], num: true },
    { key: "rsi14", label: "RSI", markets: ["us", "kr"], num: true, metric: "rsi14" },
    { key: "epsTtm", label: "EPS", markets: ["us", "kr"], num: true, metric: "epsTtm" },
    { key: "newHigh", label: "52주 고점 대비", markets: ["us", "kr"], num: true, metric: "newHighDistancePct" },
    { key: "sector", label: "섹터", markets: ["us", "kr"], num: false },
  ];

  const DEFAULTS = {
    us: ["price", "changePct", "monthChangePct", "volumeRatio", "marketCap", "pe", "rsi14"],
    kr: ["price", "changePct", "volume", "amount", "marketCap", "pe", "foreignPct"],
  };

  function mkt(market) {
    return market === "kr" ? "kr" : "us";
  }

  function availableColumns(market) {
    const m = mkt(market);
    return COLUMNS.filter((c) => c.markets.includes(m));
  }

  function columnByKey(key) {
    return COLUMNS.find((c) => c.key === key) || null;
  }

  function defaultColumns(market) {
    return DEFAULTS[mkt(market)].slice();
  }

  // 저장된 목록을 현재 시장에서 쓸 수 있는 열만, 순서 유지·중복 제거로 정리한다. 비면 기본값.
  function sanitizeColumns(saved, market) {
    if (!Array.isArray(saved)) return defaultColumns(market);
    const ok = new Set(availableColumns(market).map((c) => c.key));
    const out = [];
    saved.forEach((k) => {
      if (typeof k === "string" && ok.has(k) && !out.includes(k)) out.push(k);
    });
    return out.length ? out : defaultColumns(market);
  }

  function parseSaved(text) {
    if (typeof text !== "string" || !text) return null;
    try {
      const v = JSON.parse(text);
      return Array.isArray(v) ? v : null;
    } catch (_) {
      return null;
    }
  }

  // 켜면 맨 끝에 붙이고, 끄면 뺀다(마지막 한 열은 끌 수 없다).
  function toggleColumn(list, key, on, market) {
    const cur = sanitizeColumns(list, market);
    const ok = availableColumns(market).some((c) => c.key === key);
    if (!ok) return cur;
    if (on) return cur.includes(key) ? cur : cur.concat([key]);
    if (cur.length <= 1) return cur;
    return cur.filter((k) => k !== key);
  }

  // delta: -1(앞으로) / +1(뒤로). 범위를 넘으면 그대로.
  function moveColumn(list, key, delta) {
    const cur = list.slice();
    const i = cur.indexOf(key);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= cur.length) return cur;
    [cur[i], cur[j]] = [cur[j], cur[i]];
    return cur;
  }

  const api = { COLUMNS, availableColumns, columnByKey, defaultColumns, sanitizeColumns, parseSaved, toggleColumn, moveColumn };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirFindTableCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
