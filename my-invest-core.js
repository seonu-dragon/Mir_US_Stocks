// 내 투자 — 순수 계산 모듈(DOM 없음).
// 브라우저에서는 window.MirMyInvestCore, node 테스트(scripts/tests/test_my_invest_core.mjs)에서는 module.exports.
//
// holdingsTrend: 지금 보유 수량을 과거 종가에 곱한 '현재 구성 기준' 평가액 추이.
//   미르는 매매 이력 없이 수량·평단만 저장하므로 실제 계좌 추이가 아니다 — 화면이 반드시 그렇게 밝힌다.
// 입력: holdings [{ t, qty }], maps { 티커: { 'YYYY-MM-DD': 종가 } | Map }, bench(같은 모양, 선택), bars(구간 거래일 수)
// 출력: { dates, values, pct, benchPct, used:[티커], excluded:[티커], start, end, change, changePct } | null
(function (root) {
  "use strict";

  function finite(v) { return typeof v === "number" && Number.isFinite(v); }
  function get(map, d) {
    if (!map) return undefined;
    const v = typeof map.get === "function" ? map.get(d) : map[d];
    return v == null ? undefined : Number(v);
  }
  function keys(map) {
    if (!map) return [];
    return typeof map.keys === "function" && typeof map.get === "function" ? [...map.keys()] : Object.keys(map);
  }

  // 구간 시작일에 가격이 없는(그 뒤 상장·이력 없음) 종목은 빼고 excluded 로 돌려준다 — 넣으면
  // 중간에 평가액이 계단처럼 뛰어 '수익'처럼 보인다. 구간 안 빈 날은 직전 종가로 채운다.
  function holdingsTrend(holdings, maps, bench, bars) {
    const list = (holdings || []).filter((h) => h && h.t && finite(Number(h.qty)) && Number(h.qty) > 0);
    if (!list.length) return null;
    const dateSet = new Set();
    list.forEach((h) => keys(maps && maps[h.t]).forEach((d) => dateSet.add(d)));
    const all = [...dateSet].filter((d) => /^\d{4}-\d{2}-\d{2}/.test(d)).sort();
    if (all.length < 2) return null;
    const n = Math.max(2, Math.min(all.length, bars || 21));
    const dates = all.slice(-n);
    const start = dates[0];
    const used = [], excluded = [];
    const lastClose = {};
    list.forEach((h) => {
      const m = maps && maps[h.t];
      // 시작일 이전(포함) 마지막 종가 — 없으면 이 구간을 온전히 덮지 못한다.
      let prior;
      keys(m).forEach((d) => { if (d <= start) { const v = get(m, d); if (finite(v) && v > 0 && (!prior || d > prior.d)) prior = { d, v }; } });
      if (!prior) { excluded.push(h.t); return; }
      used.push(h.t);
      lastClose[h.t] = prior.v;
    });
    if (!used.length) return null;
    const qty = {};
    list.forEach((h) => { qty[h.t] = Number(h.qty); });
    const values = dates.map((d) => {
      let total = 0;
      used.forEach((t) => {
        const v = get(maps[t], d);
        if (finite(v) && v > 0) lastClose[t] = v;
        total += qty[t] * lastClose[t];
      });
      return total;
    });
    const base = values[0];
    const pct = values.map((v) => (base > 0 ? (v / base - 1) * 100 : 0));
    let benchPct = null;
    if (bench) {
      let last;
      keys(bench).forEach((d) => { if (d <= start) { const v = get(bench, d); if (finite(v) && v > 0 && (!last || d > last.d)) last = { d, v }; } });
      if (last) {
        const b0 = last.v;
        let cur = b0;
        benchPct = dates.map((d) => { const v = get(bench, d); if (finite(v) && v > 0) cur = v; return (cur / b0 - 1) * 100; });
      }
    }
    const end = values[values.length - 1];
    return { dates, values, pct, benchPct, used, excluded, start: base, end, change: end - base, changePct: pct[pct.length - 1] };
  }

  // 배분 요약 — 비중 상위 그룹과 한 줄 결론(한 그룹 50%↑ 이면 '집중'). rows [{ key, value }]
  function allocation(rows) {
    const total = (rows || []).reduce((s, r) => s + (finite(r.value) && r.value > 0 ? r.value : 0), 0);
    if (!(total > 0)) return { total: 0, parts: [], top: null, concentrated: false };
    const agg = {};
    rows.forEach((r) => { if (finite(r.value) && r.value > 0) agg[r.key] = (agg[r.key] || 0) + r.value; });
    const parts = Object.entries(agg).map(([key, value]) => ({ key, value, pct: (value / total) * 100 })).sort((a, b) => b.value - a.value);
    return { total, parts, top: parts[0] || null, concentrated: !!(parts[0] && parts[0].pct >= 50) };
  }

  const api = { holdingsTrend, allocation };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirMyInvestCore = api;
})(typeof window !== "undefined" ? window : null);
