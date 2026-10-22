// market-issues.js — 오늘 탭 '오늘의 이슈' 카드(미국·국내)
// =====================================================
// 데이터: data/market_issues.js · data/korea/market_issues.js(window.MARKET_ISSUES, 시장별 lazy —
// scripts/build_market_issues.py, 그날 특징주 보드를 같은 원인끼리 묶은 것). 이슈가 0건인 날은 한 줄 상태만 남긴다.
// renderMoversBoard 옆(app.js)에서 불린다. 종목 칩은 그 종목 분석으로, 근거는 원문 기사로 간다.

function renderMarketIssues() {
  const el = byId("marketIssues");
  if (!el) return;
  const hide = () => { el.hidden = true; el.innerHTML = ""; };
  if (featureOff("marketIssues")) return hide();
  const p = window.MARKET_ISSUES;
  const market = isKrMarket() ? "kr" : "us";
  if (!p || p.market !== market) {
    if (p && p.market !== market) return hide();
    ensureFeatureData("marketIssues").then((ok) => { if (ok) renderMarketIssues(); });
    return;
  }
  const issues = Array.isArray(p.issues) ? p.issues.filter((i) => i && i.title && Array.isArray(i.tickers) && i.tickers.length) : [];
  el.hidden = false;
  const head = `<div class="movers-head"><div><h2>오늘의 이슈</h2><p class="muted">${escapeHtml(String(p.tradeDate || ""))} 거래일</p></div></div>`;
  // 이슈 0건인 날도 카드를 지우지 않고 한 줄로 상태만 알린다(특징주 보드는 그대로).
  if (!issues.length) { el.innerHTML = `${head}<p class="muted mi-empty">오늘은 이슈로 묶지 못함</p>`; return; }
  el.innerHTML = `${head}
    <div class="mi-list">${issues.map(marketIssueHtml).join("")}</div>`;
  el.querySelectorAll("[data-mi-ticker]").forEach((b) => b.addEventListener("click", () => selectTicker(b.dataset.miTicker, { openSearch: true })));
}

function marketIssueHtml(issue) {
  const chips = issue.tickers.map((t) => {
    const chg = Number(t.chg);
    const pct = Number.isFinite(chg) ? `<span class="${cls(chg)}">${chg > 0 ? "+" : ""}${chg.toFixed(1)}%</span>` : "";
    return `<button type="button" class="mi-chip" data-mi-ticker="${escapeHtml(String(t.t))}">${escapeHtml(String(t.name || t.t))} ${pct}</button>`;
  }).join("");
  const ev = (issue.evidence || []).map((e) => `<a href="${escapeHtml(safeHttpHref(e.link))}" target="_blank" rel="noopener" title="${escapeHtml([e.source, e.title].filter(Boolean).join(" · "))}">${escapeHtml(String(e.title || ""))}</a>`).join("");
  return `<article class="mi-item">
      <h3>${escapeHtml(String(issue.title))}</h3>
      ${issue.summary ? `<p>${escapeHtml(String(issue.summary))}</p>` : ""}
      <div class="mi-chips">${chips}</div>
      ${ev ? `<div class="mi-ev">${ev}</div>` : ""}
    </article>`;
}
