// 은행 건전성(FDIC 분기) — 순수 계산 모듈(DOM 없음).
// 브라우저 window.MirFdicBanksCore, node 테스트 scripts/tests/test_fdic_banks_core.mjs.
// 입력 window.FDIC_BANKS(scripts/build_fdic_banks.py, 미국 전용):
//   { latestQuarter, columns: [quarter, nim, npl, nco, roa, roe, cet1, assets, deposits, loans], banks: {T: {cert, q: [[…], …]}} }
(function (root) {
  "use strict";

  // 파일을 받기 전에 '은행주인가'를 판단한다(은행이 아닌 종목은 파일을 받지 않는다). build_fdic_banks.py BANKS 와 같은 목록.
  const BANK_TICKERS = new Set(["JPM", "BAC", "WFC", "C", "USB", "PNC", "TFC", "COF", "GS", "MS", "SCHW", "BK", "STT", "NTRS",
    "AXP", "FITB", "HBAN", "KEY", "RF", "CFG", "MTB", "FCNCA", "ZION", "WAL", "FLG", "EWBC", "ALLY", "SYF"]);

  const METRICS = [
    { key: "nim", label: "순이자마진", hint: "이자수익 − 이자비용, 자산 대비(연율)" },
    { key: "npl", label: "부실채권비율", hint: "90일+ 연체·무수익 대출 / 대출" },
    { key: "nco", label: "순상각률", hint: "손실 처리한 대출(회수분 차감) / 대출, 연율" },
    { key: "roa", label: "ROA", hint: "순이익 / 자산, 연율" },
    { key: "roe", label: "ROE", hint: "순이익 / 자기자본, 연율" },
    { key: "cet1", label: "보통주자본비율", hint: "CET1 / 위험가중자산" },
  ];

  function isBank(ticker) {
    return BANK_TICKERS.has(String(ticker || "").toUpperCase());
  }

  function rowsOf(payload, ticker) {
    const b = payload && payload.banks && payload.banks[String(ticker || "").toUpperCase()];
    const cols = (payload && payload.columns) || [];
    if (!b || !Array.isArray(b.q) || !cols.length) return [];
    return b.q.filter(Array.isArray).map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i] === undefined ? null : r[i]])));
  }

  /** 'YYYY-Qn' 의 1년 전 분기. */
  function yearAgo(q) {
    const m = /^(\d{4})-Q([1-4])$/.exec(String(q || ""));
    return m ? `${Number(m[1]) - 1}-Q${m[2]}` : null;
  }

  function pctChange(cur, prev) {
    if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev === 0) return null;
    return Math.round(((cur / prev) - 1) * 1000) / 10;
  }

  /** 종목 요약 — 최신 분기 지표와 전년 같은 분기 대비 차(%p), 예금·대출 전년비(%), 최근 5분기 표. 없으면 null. */
  function summarize(payload, ticker) {
    const rows = rowsOf(payload, ticker);
    if (!rows.length) return null;
    const last = rows[rows.length - 1];
    const prev = rows.find((r) => r.quarter === yearAgo(last.quarter)) || null;
    const metrics = METRICS.map((m) => {
      const v = last[m.key];
      const p = prev ? prev[m.key] : null;
      return { ...m, value: Number.isFinite(v) ? v : null, yoy: Number.isFinite(v) && Number.isFinite(p) ? Math.round((v - p) * 100) / 100 : null };
    }).filter((m) => m.value !== null);
    if (!metrics.length) return null;
    return {
      quarter: last.quarter,
      stale: payload.latestQuarter && last.quarter !== payload.latestQuarter,
      metrics,
      deposits: last.deposits, loans: last.loans,
      depositsYoy: prev ? pctChange(last.deposits, prev.deposits) : null,
      loansYoy: prev ? pctChange(last.loans, prev.loans) : null,
      table: rows.slice(-5),
    };
  }

  /** 천 USD → '$2.82조' · '$251억'. */
  function fmtUsdThousands(v) {
    if (!Number.isFinite(v) || v <= 0) return "";
    const usd = v * 1000;
    if (usd >= 1e12) return `$${(usd / 1e12).toFixed(2)}조`;
    return `$${Math.round(usd / 1e8).toLocaleString("ko-KR")}억`;
  }

  function fmtPct(v) {
    return Number.isFinite(v) ? `${v.toFixed(2)}%` : "–";
  }

  function fmtPp(v) {
    if (!Number.isFinite(v)) return "";
    return `${v > 0 ? "+" : ""}${v.toFixed(2)}%p`;
  }

  /** '2026-Q2' → "26년 2분기". */
  function quarterLabel(q) {
    const m = /^(\d{4})-Q([1-4])$/.exec(String(q || ""));
    return m ? `${m[1].slice(2)}년 ${m[2]}분기` : "";
  }

  const api = { BANK_TICKERS, METRICS, isBank, rowsOf, yearAgo, summarize, fmtUsdThousands, fmtPct, fmtPp, quarterLabel };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirFdicBanksCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
