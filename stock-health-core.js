// stock-health-core.js — 종목 체력(스노우플레이크)·유사종목·위험 프로파일의 순수 계산(DOM 없음).
// 화면은 stock-health.js(종목 상세 밸류·개요 탭 + AI 모드 대시보드가 같이 쓴다).
// node 테스트: scripts/tests/test_stock_health_core.mjs
(function (root) {
  "use strict";

  function num(v) {
    if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  // 지도 펀더멘털(결측 보완)에 종목 상세 값을 덮는다 — 상세 쪽 값이 있으면 그쪽이 우선.
  function mergeFundamentals(mapFund, detailFund) {
    const f = { ...(mapFund || {}) };
    const d = detailFund || {};
    for (const k in d) if (d[k] != null) f[k] = d[k];
    return f;
  }

  // 5축(밸류·성장·건전성·과거성과·배당) × 고정 기준 체크 최대 6개. 축 점수 = 통과 개수.
  // 판단할 값이 없는 체크는 분모(ev)에서 빠진다 — 통과 수를 n/m 으로 그대로 보여 주기 위해.
  function computeSnowflake(f) {
    f = f || {};
    const n = num;
    const asRatio = (v) => (v == null ? null : (v > 10 ? v / 100 : v)); // %로 오면 배수로
    const pe = n(f.pe), fpe = n(f.forwardPE), pb = n(f.pb ?? f.pbr), ps = n(f.ps), peg = n(f.peg);
    const dy = n(f.divYield), payout = n(f.payoutRatio);
    const roe = n(f.roe), roa = n(f.roa), nm = n(f.netMargin ?? f.profitMargin);
    const debt = asRatio(n(f.debtEq)) ?? (n(f.debtRatio) != null ? n(f.debtRatio) / 100 : null);
    const cur = asRatio(n(f.currentRatio)) ?? asRatio(n(f.quickRatio));
    const rg = n(f.revenueGrowth), og = n(f.operatingGrowth), ng = n(f.netGrowth);
    const eps = n(f.epsTtm ?? f.eps);
    const axis = (checks) => {
      let pass = 0, ev = 0;
      for (const [has, ok] of checks) { if (has) { ev++; if (ok) pass++; } }
      return { pass, ev, score: ev > 0 ? pass : null };
    };
    return {
      value: axis([[pe > 0, pe < 15], [pe > 0, pe < 25], [pb > 0, pb < 1.5], [pb > 0, pb < 3], [ps > 0, ps < 2], [peg > 0, peg > 0 && peg < 1.5]]),
      growth: axis([[peg > 0, peg < 1], [peg > 0, peg < 1.5], [pe > 0 && fpe > 0, fpe < pe], [rg != null, rg > 10], [rg != null, rg > 0], [og != null || ng != null, (og != null ? og > 0 : ng > 0)]]),
      health: axis([[debt != null, debt < 0.5], [debt != null, debt < 1], [cur != null, cur > 1.5], [cur != null, cur > 1], [nm != null, nm > 5], [nm != null, nm > 0]]),
      past: axis([[roe != null, roe > 15], [roe != null, roe > 8], [roa != null, roa > 5], [nm != null, nm > 10], [nm != null, nm > 0], [eps != null, eps > 0]]),
      dividend: axis([[dy != null, dy > 0], [dy != null, dy > 2], [dy != null, dy > 3.5], [payout != null, payout > 0 && payout < 80], [payout != null, payout > 0 && payout < 60], [dy != null, dy > 0 && dy < 12]]),
    };
  }

  const SNOWFLAKE_AXES = [["value", "밸류"], ["growth", "성장"], ["health", "건전성"], ["past", "과거성과"], ["dividend", "배당"]];

  // 화면용 요약. 판단 가능한 축이 2개 미만이면 null(카드를 숨긴다).
  function snowflakeSummary(sf) {
    if (!sf) return null;
    const axes = SNOWFLAKE_AXES.map(([k, label]) => ({ key: k, label, ...(sf[k] || { pass: 0, ev: 0, score: null }) }));
    if (axes.filter((a) => a.ev > 0).length < 2) return null;
    const total = axes.reduce((s, a) => s + (a.score ?? 0), 0);
    return { axes, total, max: 30 };
  }

  // 같은 산업군(3개 미만이면 섹터) 시총 상위 피어. 현재 종목은 빠진다.
  function selectPeers(stocks, item, limit = 6) {
    if (!Array.isArray(stocks) || !item || !item.ticker) return null;
    const others = stocks.filter((s) => s && s.ticker && s.ticker !== item.ticker);
    const sameInd = item.industry ? others.filter((s) => s.industry === item.industry) : [];
    const useInd = sameInd.length >= 3;
    const pool = useInd ? sameInd : (item.sector ? others.filter((s) => s.sector === item.sector) : []);
    if (!pool.length) return null;
    const peers = pool.slice().sort((a, b) => (num(b.marketCapB) || 0) - (num(a.marketCapB) || 0)).slice(0, limit);
    return { basis: useInd ? "같은 산업군" : "같은 섹터", peers };
  }

  // 가격 이력(일봉 {d, c}) → 연율 변동성·최대 낙폭·1년 수익률·월별 평균 수익률(21거래일 환산).
  // 종가가 60개 미만이면 null.
  function riskStats(rows) {
    if (!Array.isArray(rows)) return null;
    const pts = rows.filter((r) => r && num(r.c) > 0).map((r) => ({ d: r.d, c: Number(r.c) }));
    if (pts.length < 60) return null;
    const closes = pts.map((p) => p.c);
    const rets = [];
    for (let i = 1; i < closes.length; i++) rets.push(closes[i] / closes[i - 1] - 1);
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const varc = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
    const volPct = Math.sqrt(varc) * Math.sqrt(252) * 100;
    let peak = closes[0], mdd = 0;
    for (const c of closes) { if (c > peak) peak = c; const dd = c / peak - 1; if (dd < mdd) mdd = dd; }
    const oneYearPct = closes.length > 252 ? (closes[closes.length - 1] / closes[closes.length - 252] - 1) * 100 : null;
    const byMonth = Array.from({ length: 12 }, () => []);
    for (let i = 1; i < pts.length; i++) {
      const d = pts[i].d;
      if (!d) continue;
      const m = Number(String(d).slice(5, 7)) - 1;
      if (m >= 0 && m < 12) byMonth[m].push(closes[i] / closes[i - 1] - 1);
    }
    const monthly = byMonth.map((a) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length) * 21 * 100 : null));
    return {
      volPct, mddPct: mdd * 100, oneYearPct, monthly,
      n: closes.length, from: pts[0].d || null, to: pts[pts.length - 1].d || null,
    };
  }

  const api = { mergeFundamentals, computeSnowflake, snowflakeSummary, selectPeers, riskStats, SNOWFLAKE_AXES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirStockHealthCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
