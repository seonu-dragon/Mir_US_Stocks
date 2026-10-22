// company-kpis.js — 종목 분석 › 재무 탭의 '회사 KPI' 카드 (미국 전용)
// =====================================================
// 데이터: data/company_kpis.js(window.COMPANY_KPIS, lazy — scripts/build_earnings_releases.py 가 실적 보도자료 요약과
// 같은 호출에서 뽑은 운영 지표(인도량·가입자·매장 수 등)를 보도자료마다 쌓은 것. 숫자는 원문에 있는 것만).
// 계산은 company-kpis-core.js(MirCompanyKpisCore). KPI 가 없는 종목은 카드를 숨긴다.

function renderCompanyKpis(item) {
  const host = byId("companyKpisSection");
  if (!host) return;
  const hide = () => { host.hidden = true; host.innerHTML = ""; };
  const core = window.MirCompanyKpisCore;
  const ticker = item && item.ticker;
  if (!ticker || !core || isKrMarket() || featureOff("companyKpis")) return hide();
  const p = window.COMPANY_KPIS;
  if (!p) {
    ensureFeatureData("companyKpis").then((ok) => { if (ok && selectedTicker === ticker) renderCompanyKpis(item); });
    return;
  }
  const t = core.table(p, ticker);
  if (!t) return hide();
  host.hidden = false;
  const head = t.columns.map((c) => `<th scope="col">${c.url ? `<a href="${escapeHtml(safeHttpHref(c.url))}" target="_blank" rel="noopener">${escapeHtml(core.columnLabel(c))}</a>` : escapeHtml(core.columnLabel(c))}</th>`).join("");
  const body = t.rows.map((r) => `<tr><th scope="row">${escapeHtml(r.label)}</th>${r.cells.map((c) => c
    ? `<td>${escapeHtml(c.value)}${c.change ? `<span class="kp-chg">${escapeHtml(c.change)}</span>` : ""}</td>`
    : '<td class="muted">—</td>').join("")}</tr>`).join("");
  host.innerHTML = `<div class="fundamental-head"><h3>회사 KPI</h3><span>${escapeHtml(t.columns[t.columns.length - 1].fileDate)} 보도자료 기준</span></div>
    <div class="bk-table-wrap"><table class="bk-table kp-table"><thead><tr><th scope="col">지표</th>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}
