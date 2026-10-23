// 업종(산업군) 순위표 — 순수 계산 모듈(DOM 없음).
// 브라우저 window.MirIndustryGroupsCore, node 테스트 scripts/tests/test_industry_groups_core.mjs.
// 입력 window.MARKET_BREADTH.groups(scripts/build_market_breadth.py industry_groups):
//   [{ name, sector, n, cap, above50, above200,
//      r: {"1d": [시총 가중, 동일 가중], "1w": …, "1m": …, "3m": …},   // 마지막 거래일 기준 수익률(%)
//      p: { 같은 모양 },                                                // 5거래일 전 시점 기준(순위 변화용)
//      top: {"1d": [[ticker, 이름, 수익률], [ticker, 이름, 수익률]], …} } ]  // 상승 1위 · 하락 1위
(function (root) {
  "use strict";

  const PERIODS = [
    { key: "1d", label: "1일" },
    { key: "1w", label: "1주" },
    { key: "1m", label: "1개월" },
    { key: "3m", label: "3개월" },
  ];
  const WEIGHTS = [
    { key: "cap", label: "시총 가중", idx: 0 },
    { key: "eq", label: "동일 가중", idx: 1 },
  ];

  function weightIdx(weight) {
    const w = WEIGHTS.find((x) => x.key === weight);
    return w ? w.idx : 0;
  }

  function pick(obj, period, wi) {
    const pair = obj && obj[period];
    const v = Array.isArray(pair) ? pair[wi] : null;
    return Number.isFinite(v) ? v : null;
  }

  /** 값 → 순위(1 = 가장 높음). 같은 값은 같은 순위, null 은 순위 없음. 반환: Map(index → rank). */
  function ranks(values) {
    const idx = values.map((v, i) => [v, i]).filter(([v]) => v !== null).sort((a, b) => b[0] - a[0]);
    const out = new Map();
    let prev = null;
    let prevRank = 0;
    idx.forEach(([v, i], pos) => {
      const r = v === prev ? prevRank : pos + 1;
      out.set(i, r);
      prev = v;
      prevRank = r;
    });
    return out;
  }

  /**
   * 고른 기간·가중으로 순위를 매긴다. 같은 기준의 5거래일 전 값으로 매긴 순위와 비교해 delta(+ 는 순위 상승).
   * sector 를 주면 그 섹터 업종만(순위도 그 안에서). 값이 없는 업종은 맨 뒤(rank null).
   */
  function rankGroups(payload, period = "1w", weight = "cap", sector = "") {
    const all = (payload && Array.isArray(payload.groups)) ? payload.groups : [];
    const list = all.filter((g) => g && g.name && (!sector || g.sector === sector));
    const wi = weightIdx(weight);
    const cur = list.map((g) => pick(g.r, period, wi));
    const prev = list.map((g) => pick(g.p, period, wi));
    const rc = ranks(cur);
    const rp = ranks(prev);
    const rows = list.map((g, i) => {
      const rank = rc.has(i) ? rc.get(i) : null;
      const prevRank = rp.has(i) ? rp.get(i) : null;
      const top = g.top && g.top[period];
      return {
        name: g.name, sector: g.sector || "", n: g.n, value: cur[i], rank, prevRank,
        delta: rank !== null && prevRank !== null ? prevRank - rank : null,
        rets: Object.fromEntries(PERIODS.map((p) => [p.key, pick(g.r, p.key, wi)])),
        above50: Number.isFinite(g.above50) ? g.above50 : null,
        above200: Number.isFinite(g.above200) ? g.above200 : null,
        best: Array.isArray(top) && top[0] ? { ticker: top[0][0], name: top[0][1], ret: top[0][2] } : null,
        worst: Array.isArray(top) && top[1] ? { ticker: top[1][0], name: top[1][1], ret: top[1][2] } : null,
      };
    });
    rows.sort((a, b) => {
      if (a.rank === null && b.rank === null) return (b.n || 0) - (a.n || 0);
      if (a.rank === null) return 1;
      if (b.rank === null) return -1;
      return a.rank - b.rank || (b.n || 0) - (a.n || 0);
    });
    return rows;
  }

  /** 업종들이 속한 섹터 목록(업종 수 많은 순). */
  function sectorsOf(payload) {
    const counts = new Map();
    for (const g of (payload && payload.groups) || []) {
      if (g && g.sector) counts.set(g.sector, (counts.get(g.sector) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).map(([s]) => s);
  }

  function fmtPct(v) {
    if (!Number.isFinite(v)) return "–";
    return `${v > 0 ? "+" : ""}${v.toFixed(Math.abs(v) >= 100 ? 0 : 1)}%`;
  }

  /** 순위 변화 표기 — ▲3 · ▼2 · '–'(같음) · ''(비교 불가). */
  function fmtDelta(d) {
    if (!Number.isFinite(d)) return "";
    if (d === 0) return "–";
    return d > 0 ? `▲${d}` : `▼${-d}`;
  }

  const api = { PERIODS, WEIGHTS, ranks, rankGroups, sectorsOf, fmtPct, fmtDelta };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirIndustryGroupsCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
