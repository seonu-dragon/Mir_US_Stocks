// 국내 미상환 CB·BW 오버행 — 순수 계산 모듈(DOM 없음).
// 브라우저에서는 window.MirCbOverhangCore, node 테스트(scripts/tests/test_cb_overhang_core.mjs)에서는 module.exports.
// 데이터: window.KR_CB_OVERHANG(scripts/build_kr_cb_overhang.py) — companies{ticker: {company, report, link, baseDate,
// totalShares, convShares, pct, verified?, rows[{kind CB|BW, seq, issueDate, maturity, price, remaining, shares}]}}.
// 값은 정기보고서 기준일 현재다. 화면 시점에 만기가 지난 행은 여기서 다시 뺀다.
(function (root) {
  "use strict";

  const WARN_PCT = 10;

  function fmtNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n.toLocaleString("en-US") : "";
  }

  /** 주식수 → '1,234만 주' · '2.5억 주' · '8,500주'. */
  function fmtShares(n) {
    const v = Number(n);
    if (!Number.isFinite(v) || v <= 0) return "";
    if (v >= 1e8) return `${(v / 1e8).toFixed(v >= 1e9 ? 0 : 1)}억 주`;
    if (v >= 1e4) return `${fmtNum(Math.round(v / 1e4))}만 주`;
    return `${fmtNum(v)}주`;
  }

  /** 원 → '1.2조 원' · '100억 원' · '3,400만 원'. */
  function fmtWon(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return "";
    if (n >= 1e12) return `${(n / 1e12).toFixed(1)}조 원`;
    if (n >= 1e8) return `${fmtNum(Math.round(n / 1e8))}억 원`;
    return `${fmtNum(Math.round(n / 1e4))}만 원`;
  }

  function fmtPct(p) {
    const n = Number(p);
    if (!Number.isFinite(n)) return "";
    return `${n >= 10 ? n.toFixed(0) : n.toFixed(1)}%`;
  }

  function kindLabel(kind) { return kind === "BW" ? "BW" : "CB"; }

  /**
   * 한 종목의 오버행. 기록이 없거나 살아 있는 행이 없으면 null.
   * pct 는 남은 행의 주식수 ÷ 같은 보고서의 발행주식총수 — 총수를 모르면 null(비율을 만들지 않는다).
   * warn: 10% 이상이고 표 합계가 행 합과 맞을 때(verified !== false)만.
   */
  function forTicker(payload, ticker, today) {
    const book = payload && payload.companies;
    const rec = book && book[String(ticker || "")];
    if (!rec || !Array.isArray(rec.rows)) return null;
    const t = String(today || "");
    const rows = rec.rows.filter((r) => r && !(t && r.maturity && r.maturity < t));
    if (!rows.length) return null;
    const shares = rows.reduce((s, r) => s + (Number(r.shares) > 0 ? Number(r.shares) : 0), 0);
    const total = Number(rec.totalShares);
    const pct = shares > 0 && total > 0 ? Math.round((shares / total) * 10000) / 100 : null;
    const remaining = rows.reduce((s, r) => s + (Number(r.remaining) > 0 ? Number(r.remaining) : 0), 0);
    const sorted = rows.slice().sort((a, b) => (Number(b.shares) || 0) - (Number(a.shares) || 0));
    return {
      company: rec.company || "",
      report: rec.report || "",
      link: rec.link || "",
      baseDate: rec.baseDate || "",
      shares,
      remaining: remaining || null,
      pct,
      verified: rec.verified !== false,
      warn: pct != null && pct >= WARN_PCT && rec.verified !== false,
      rows: sorted,
    };
  }

  /** 배지 문구 — '오버행 주의: 미상환 사채 27%'. warn 이 아니면 ''. */
  function badgeText(info) {
    if (!info || !info.warn) return "";
    return `오버행 주의: 미상환 사채 ${fmtPct(info.pct)}`;
  }

  const api = { WARN_PCT, fmtShares, fmtWon, fmtPct, kindLabel, forTicker, badgeText };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirCbOverhangCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
