// peer-scatter-core.js — 종목 › 비교 '피어 산점도'의 순수 계산(DOM 없음).
// 브라우저 window.MirPeerScatterCore, node 테스트 scripts/tests/test_peer_scatter_core.mjs.
//
// 기준 종목과 같은 산업군(3개 미만이면 섹터, stock-health-core selectPeers 와 같은 규칙) 종목을
// MAP_FUNDAMENTALS(미국 data/map_fundamentals.js · 국내 data/korea/map_fundamentals.js)의 두 지표로 찍는다.
// 값이 없는 종목은 뺀다(메우지 않는다). 점선은 업종 중앙값뿐 — 회귀선·적정가 선은 그리지 않는다.
// 축 범위는 극단값에 눌리지 않게 사분위 울타리(Q1-3·IQR, Q3+3·IQR) 안으로 잡고, 밖의 점은 가장자리에
// 붙여 '범위 밖' 표시만 한다(값은 툴팁에 그대로).
(function (root) {
  "use strict";

  // 지표 후보. 실제로 쓰는 건 그 시장 표에 값이 충분히 있는 것만(availableMetrics).
  const METRICS = [
    { key: "pe", label: "PER", unit: "배" },
    { key: "forwardPE", label: "선행 PER", unit: "배" },
    { key: "pb", label: "PBR", unit: "배" },
    { key: "ps", label: "PSR", unit: "배" },
    { key: "evEbitda", label: "EV/EBITDA", unit: "배" },
    { key: "roe", label: "ROE", unit: "%" },
    { key: "roa", label: "ROA", unit: "%" },
    { key: "netMargin", label: "순이익률", unit: "%" },
    { key: "revenueGrowth", label: "매출 성장률", unit: "%" },
    { key: "operatingGrowth", label: "영업이익 성장률", unit: "%" },
    { key: "divYield", label: "배당수익률", unit: "%" },
    { key: "debtRatio", label: "부채비율", unit: "%" },
  ];

  function num(v) {
    if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function median(values) {
    const a = (Array.isArray(values) ? values : []).map(num).filter((v) => v !== null).sort((x, y) => x - y);
    if (!a.length) return null;
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  function quantile(sorted, p) {
    if (!sorted.length) return null;
    const i = (sorted.length - 1) * p;
    const lo = Math.floor(i), hi = Math.ceil(i);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
  }

  // 표 전체에서 값이 minCount 개 이상인 지표만.
  function availableMetrics(table, minCount = 20) {
    const rows = table && typeof table === "object" ? Object.values(table) : [];
    return METRICS.filter((m) => rows.reduce((n, r) => n + (r && num(r[m.key]) !== null ? 1 : 0), 0) >= minCount);
  }

  function metricByKey(key) {
    return METRICS.find((m) => m.key === key) || null;
  }

  // 같은 산업군(3개 미만이면 섹터) — 기준 종목 포함.
  function peerPool(stocks, anchor) {
    if (!Array.isArray(stocks) || !anchor || !anchor.ticker) return null;
    const list = stocks.filter((s) => s && s.ticker);
    const sameInd = anchor.industry ? list.filter((s) => s.industry === anchor.industry) : [];
    const useInd = sameInd.filter((s) => s.ticker !== anchor.ticker).length >= 3;
    const pool = useInd ? sameInd : (anchor.sector ? list.filter((s) => s.sector === anchor.sector) : []);
    if (!pool.some((s) => s.ticker === anchor.ticker)) pool.push(anchor);
    if (pool.length < 2) return null;
    return { basis: useInd ? "industry" : "sector", group: useInd ? anchor.industry : anchor.sector, stocks: pool };
  }

  function domain(values) {
    const a = values.slice().sort((x, y) => x - y);
    if (!a.length) return null;
    const q1 = quantile(a, 0.25), q3 = quantile(a, 0.75);
    const iqr = q3 - q1;
    let lo = a[0], hi = a[a.length - 1];
    if (iqr > 0) {
      lo = Math.max(lo, q1 - 3 * iqr);
      hi = Math.min(hi, q3 + 3 * iqr);
    }
    if (hi === lo) { const pad = Math.abs(hi) * 0.1 || 1; lo -= pad; hi += pad; }
    const pad = (hi - lo) * 0.06;
    return [lo - pad, hi + pad];
  }

  // fundFor(ticker) → 그 종목의 지표 객체(없으면 null).
  function buildScatter({ stocks, anchor, fundFor, xKey, yKey }) {
    const pool = peerPool(stocks, anchor);
    if (!pool || typeof fundFor !== "function" || !xKey || !yKey) return null;
    const rows = pool.stocks.map((s) => {
      const f = fundFor(s.ticker) || {};
      return { ticker: s.ticker, name: s.company || s.name || s.ticker, marketCapB: num(s.marketCapB), x: num(f[xKey]), y: num(f[yKey]), self: s.ticker === anchor.ticker };
    });
    const medX = median(rows.map((r) => r.x));
    const medY = median(rows.map((r) => r.y));
    const points = rows.filter((r) => r.x !== null && r.y !== null);
    const dx = domain(points.map((p) => p.x));
    const dy = domain(points.map((p) => p.y));
    if (dx && dy) {
      points.forEach((p) => {
        p.outX = p.x < dx[0] ? -1 : p.x > dx[1] ? 1 : 0;
        p.outY = p.y < dy[0] ? -1 : p.y > dy[1] ? 1 : 0;
        p.px = Math.min(dx[1], Math.max(dx[0], p.x));
        p.py = Math.min(dy[1], Math.max(dy[0], p.y));
      });
    }
    // 큰 종목이 작은 점을 가리지 않게 시총 큰 순 → 작은 순으로 그리고, 기준 종목은 맨 위.
    points.sort((a, b) => (a.self - b.self) || ((b.marketCapB || 0) - (a.marketCapB || 0)));
    return {
      basis: pool.basis, group: pool.group,
      total: pool.stocks.length, shown: points.length,
      anchorShown: points.some((p) => p.self),
      medX, medY, domainX: dx, domainY: dy, points,
    };
  }

  const api = { METRICS, median, availableMetrics, metricByKey, peerPool, buildScatter };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirPeerScatterCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
