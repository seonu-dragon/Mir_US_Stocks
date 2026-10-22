// fdic-banks.js — 종목 분석 › 재무 탭의 '은행 건전성' 카드 (미국 은행주 전용)
// =====================================================
// 데이터: data/fdic_banks.js(window.FDIC_BANKS, lazy — scripts/build_fdic_banks.py, FDIC 콜 리포트 분기).
// 계산은 fdic-banks-core.js(MirFdicBanksCore). 은행 목록에 있는 종목일 때만 파일을 받는다.
// selectTicker(renderSearch)·refreshFeatureViews 에서 불린다. 자료가 없으면 카드를 숨긴다.

function renderBankHealth(item) {
  const host = byId("bankHealthSection");
  if (!host) return;
  const hide = () => { host.hidden = true; host.innerHTML = ""; };
  const core = window.MirFdicBanksCore;
  const ticker = item && item.ticker;
  if (!ticker || !core || isKrMarket() || featureOff("fdicBanks") || !core.isBank(ticker)) return hide();
  const p = window.FDIC_BANKS;
  if (!p) {
    ensureFeatureData("fdicBanks").then((ok) => { if (ok && selectedTicker === ticker) renderBankHealth(item); });
    return;
  }
  const s = core.summarize(p, ticker);
  if (!s) return hide();
  host.hidden = false;
  host.innerHTML = bankHealthHtml(s, core);
}

function bankHealthHtml(s, core) {
  // 지표마다 좋고 나쁨의 방향이 달라(마진↑ 좋음, 부실↑ 나쁨) 등락색을 쓰지 않는다 — 값과 전년 대비 차만.
  const stats = s.metrics.map((m) => `<div class="ih-stat" title="${escapeHtml(m.hint)}"><span class="ih-stat-l">${escapeHtml(m.label)}</span><strong class="ih-stat-v">${escapeHtml(core.fmtPct(m.value))}</strong>${m.yoy !== null ? `<span class="ih-stat-s">전년 대비 ${escapeHtml(core.fmtPp(m.yoy))}</span>` : ""}</div>`).join("");
  const money = [
    s.deposits ? `예금 ${core.fmtUsdThousands(s.deposits)}${s.depositsYoy !== null ? ` (전년비 ${s.depositsYoy > 0 ? "+" : ""}${s.depositsYoy.toFixed(1)}%)` : ""}` : "",
    s.loans ? `대출 ${core.fmtUsdThousands(s.loans)}${s.loansYoy !== null ? ` (전년비 ${s.loansYoy > 0 ? "+" : ""}${s.loansYoy.toFixed(1)}%)` : ""}` : "",
  ].filter(Boolean).join(" · ");
  const head = ["분기", ...core.METRICS.map((m) => m.label)];
  const body = s.table.slice().reverse().map((r) => `<tr><th scope="row">${escapeHtml(core.quarterLabel(r.quarter))}</th>${core.METRICS.map((m) => `<td>${escapeHtml(core.fmtPct(r[m.key]))}</td>`).join("")}</tr>`).join("");
  return `<div class="fundamental-head"><h3>은행 건전성</h3><span>${escapeHtml(core.quarterLabel(s.quarter))} 기준${s.stale ? " · 최신 분기 미제출" : ""}</span></div>
    <div class="ih-stats bk-stats">${stats}</div>
    ${money ? `<p class="bk-money">${escapeHtml(money)}</p>` : ""}
    <div class="bk-table-wrap"><table class="bk-table"><thead><tr>${head.map((h) => `<th scope="col">${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
}
