// 다크풀(ATS) 주간 거래 비중 — 순수 계산 모듈(DOM 없음).
// 브라우저 window.MirAtsCore, node 테스트 scripts/tests/test_ats_core.mjs.
// 입력 window.FINRA_ATS(scripts/build_finra_ats.py, 미국 전용):
//   { latest: {T1, T2}, weeks: {T1: [주 시작일…], T2: [...]}, tickers: {T: [티어, 최근 주 ATS 주식수, [주별 비중%|null…]]} }
(function (root) {
  "use strict";

  function addDays(iso, n) {
    const [y, m, d] = String(iso).split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d) + n * 86400000);
    return `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}`;
  }

  /** '2026-09-28' → '9/28~10/2'(월~금). */
  function weekLabel(iso) {
    return iso ? `${addDays(iso, 0)}~${addDays(iso, 4)}` : "";
  }

  /** 종목 하나의 요약. 비중이 하나도 없으면 null. */
  function summarize(payload, ticker) {
    const rec = payload && payload.tickers && payload.tickers[ticker];
    if (!Array.isArray(rec) || rec.length < 3 || !Array.isArray(rec[2])) return null;
    const [tier, ats, pcts] = rec;
    const weeks = ((payload.weeks || {})[tier]) || [];
    const series = pcts.map((v, i) => ({ week: weeks[i] || null, pct: Number.isFinite(v) ? v : null }));
    const vals = series.filter((p) => p.pct !== null);
    if (!vals.length) return null;
    const last = series[series.length - 1].pct !== null ? series[series.length - 1] : vals[vals.length - 1];
    const avg = vals.reduce((s, p) => s + p.pct, 0) / vals.length;
    return {
      tier, ats: Number.isFinite(ats) ? ats : null, series,
      lastWeek: last.week, lastPct: last.pct,
      avgPct: Math.round(avg * 10) / 10, weeksWithData: vals.length,
      diffPct: Math.round((last.pct - avg) * 10) / 10,
    };
  }

  /** 막대 높이(0~h) — 최대값 기준. null 은 null. */
  function bars(series, h) {
    const vals = series.map((p) => p.pct).filter((v) => v !== null);
    const max = vals.length ? Math.max(...vals) : 0;
    return series.map((p) => (p.pct === null || max <= 0 ? null : Math.max(1, Math.round((p.pct / max) * h))));
  }

  /** 주식 수 → '1,234만 주' · '2.5억 주' · '8,500주'. */
  function fmtShares(n) {
    if (n === null || n === undefined || n === "") return "";
    const v = Number(n);
    if (!Number.isFinite(v) || v < 0) return "";
    if (v >= 1e8) return `${(v / 1e8).toFixed(v >= 1e9 ? 0 : 1)}억 주`;
    if (v >= 1e4) return `${Math.round(v / 1e4).toLocaleString("ko-KR")}만 주`;
    return `${Math.round(v).toLocaleString("ko-KR")}주`;
  }

  const api = { weekLabel, summarize, bars, fmtShares };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirAtsCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
