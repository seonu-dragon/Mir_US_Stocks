// 회사 KPI(실적 보도자료 운영 지표) — 순수 계산 모듈(DOM 없음).
// 브라우저 window.MirCompanyKpisCore, node 테스트 scripts/tests/test_company_kpis_core.mjs.
// 입력 window.COMPANY_KPIS(scripts/build_earnings_releases.py merge_kpis, 미국 전용):
//   { tickers: {T: [{period, fileDate, accession, exhibitUrl, kpis: [{label, value, change}]}, …최신순]} }
(function (root) {
  "use strict";

  /** 종목 표 — 열 = 최근 보도자료(최대 maxCols, 오래된 → 최신), 행 = KPI 라벨(최신 보도자료에 나온 순서 먼저).
   *  같은 라벨이 다른 보도자료에 없으면 그 칸은 null. 없으면 null. */
  function table(payload, ticker, maxCols = 4) {
    const rows = payload && payload.tickers && payload.tickers[String(ticker || "").toUpperCase()];
    if (!Array.isArray(rows) || !rows.length) return null;
    const cols = rows.filter((r) => r && Array.isArray(r.kpis) && r.kpis.length).slice(0, maxCols).reverse();
    if (!cols.length) return null;
    const labels = [];
    for (let i = cols.length - 1; i >= 0; i -= 1) {
      for (const k of cols[i].kpis) if (k && k.label && !labels.includes(k.label)) labels.push(k.label);
    }
    const body = labels.map((label) => ({
      label,
      cells: cols.map((c) => {
        const k = c.kpis.find((x) => x && x.label === label);
        return k ? { value: String(k.value || ""), change: String(k.change || "") } : null;
      }),
    }));
    return {
      columns: cols.map((c) => ({ period: String(c.period || ""), fileDate: String(c.fileDate || ""), url: /^https?:\/\//.test(c.exhibitUrl || "") ? c.exhibitUrl : "" })),
      rows: body,
    };
  }

  /** 열 머리 — 'third quarter 2026' 같은 원문 기간이 길면 접수일 'YY.MM'. */
  function columnLabel(col) {
    const p = String(col.period || "");
    if (p && p.length <= 16) return p;
    const m = /^(\d{4})-(\d{2})/.exec(String(col.fileDate || ""));
    return m ? `${m[1].slice(2)}.${m[2]} 발표` : p.slice(0, 16);
  }

  const api = { table, columnLabel };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirCompanyKpisCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
