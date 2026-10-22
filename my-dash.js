// my-dash.js — 내 투자 › '대시보드' 서브탭: 원하는 위젯을 골라 순서대로 놓는 내 화면(2026-10-22)
// =====================================================
// 위젯은 다른 화면의 렌더러를 빌리지 않고(그쪽은 고정 id 에 그린다) 이미 받은 데이터로 짧은 요약만 그린다.
// 데이터가 lazy 인 위젯(시장 폭·오늘의 이슈·특징주·이상 옵션 거래)은 이 탭을 열 때만 받는다.
// 레이아웃은 시장별로 이 브라우저에 저장한다(mir_dash_us / mir_dash_kr). 계산은 my-dash-core.js(MirDashCore).
// 등락은 시장별 등락색(cls)을 따른다.

const DASH_KEY = (m) => `mir_dash_${m}`;

function dashMarket() { return isKrMarket() ? "kr" : "us"; }

function dashLayout() {
  const core = window.MirDashCore;
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(DASH_KEY(dashMarket())) || "null"); } catch (_) { raw = null; }
  return core.sanitize(raw, dashMarket());
}

function dashSave(layout) {
  try { localStorage.setItem(DASH_KEY(dashMarket()), JSON.stringify(layout)); } catch (_) { /* 저장소 없음 — 이번 방문만 */ }
}

function dashPct(v) {
  const n = Number(v);
  return Number.isFinite(n) ? `<span class="${cls(n)}">${n > 0 ? "+" : ""}${n.toFixed(2)}%</span>` : '<span class="muted">—</span>';
}

function dashTickerBtn(t, label) {
  return `<button type="button" class="ins-ticker" data-dash-ticker="${escapeHtml(String(t))}">${escapeHtml(String(label || t))}</button>`;
}

// 위젯 본문 — 그릴 게 없으면 "" (위젯 틀은 남기고 '자료 없음').
const DASH_RENDER = {
  regime() {
    try {
      const r = computeMarketRegime();
      const s = typeof computeSectorRanks === "function" ? computeSectorRanks() : { strong: [], weak: [] };
      const parts = [s.strong?.[0] ? `${s.strong[0].ko} 강세` : "", s.weak?.[0] ? `${s.weak[0].ko} 약세` : ""].filter(Boolean);
      return `<p class="dash-regime"><strong>${escapeHtml(r.ko)}</strong>${parts.length ? ` · ${escapeHtml(parts.join(", "))}` : ""}</p>`;
    } catch (_) { return ""; }
  },
  watch() {
    const rows = (watchlist || []).slice(0, 10).map((t) => stockByTicker(t)).filter(Boolean);
    if (!rows.length) return '<p class="muted">관심 종목이 없습니다.</p>';
    return `<table class="dash-table"><tbody>${rows.map((s) => `<tr><td>${dashTickerBtn(s.ticker, stockLabel(s))}</td><td class="ins-num">${escapeHtml(priceOrDash(s.price))}</td><td class="ins-num">${dashPct(s.changePct)}</td></tr>`).join("")}</tbody></table>`;
  },
  sectors() {
    let s;
    try { s = computeSectorRanks(); } catch (_) { return ""; }
    const li = (list) => list.slice(0, 3).map((r) => `<li><span>${escapeHtml(String(r.ko))}</span>${dashPct(r.avg)}</li>`).join("");
    return `<div class="dash-two"><div><h5>강한 섹터</h5><ul class="dash-list">${li(s.strong || [])}</ul></div><div><h5>약한 섹터</h5><ul class="dash-list">${li(s.weak || [])}</ul></div></div>`;
  },
  breadth() {
    const p = window.MARKET_BREADTH;
    if (!p || p.market !== dashMarket()) { ensureFeatureData("marketBreadth").then((ok) => { if (ok) renderMyDash(); }); return ""; }
    const last = (p.rows || [])[p.rows.length - 1];
    if (!last) return "";
    const f = (v, unit = "%") => (Number.isFinite(v) ? `${v.toFixed(1)}${unit}` : "—");
    return `<dl class="dash-kv"><div><dt>50일선 위</dt><dd>${f(last.above50)}</dd></div><div><dt>200일선 위</dt><dd>${f(last.above200)}</dd></div>
      <div><dt>맥클렐런</dt><dd>${Number.isFinite(last.mcclellan) ? last.mcclellan.toFixed(1) : "—"}</dd></div><div><dt>신고 − 신저</dt><dd>${last.nh - last.nl}</dd></div></dl>
      <p class="muted dash-asof">${escapeHtml(String(last.d))} 기준</p>`;
  },
  issues() {
    const p = window.MARKET_ISSUES;
    if (!p || p.market !== dashMarket()) { ensureFeatureData("marketIssues").then((ok) => { if (ok) renderMyDash(); }); return ""; }
    const issues = (p.issues || []).slice(0, 4);
    if (!issues.length) return '<p class="muted">오늘은 묶인 이슈가 없습니다.</p>';
    return `<ul class="dash-list dash-issues">${issues.map((i) => `<li><strong>${escapeHtml(i.title)}</strong> <span class="muted">${(i.tickers || []).slice(0, 4).map((t) => escapeHtml(String(t.name || t.t))).join(", ")}</span></li>`).join("")}</ul>`;
  },
  movers() {
    const p = typeof moversPayload === "function" ? moversPayload() : null;
    if (!p) { ensureFeatureData("movers").then((ok) => { if (ok) renderMyDash(); }); return ""; }
    const li = (list) => list.slice(0, 5).map((s) => `<li>${dashTickerBtn(s.ticker, s.company || s.ticker)}${dashPct(s.changePct)}</li>`).join("");
    return `<div class="dash-two"><div><h5>상승</h5><ul class="dash-list">${li(p.up || [])}</ul></div><div><h5>하락</h5><ul class="dash-list">${li(p.down || [])}</ul></div></div>`;
  },
  uoa() {
    const p = window.OPTIONS_FLOW;
    const core = window.MirOptionsFlowCore;
    if (!core) return "";
    if (!p) { ensureFeatureData("optionsFlow").then((ok) => { if (ok) renderMyDash(); }); return ""; }
    const rows = core.marketUoa(p, 6);
    if (!rows.length) return "";
    return `<ul class="dash-list">${rows.map((r) => `<li>${dashTickerBtn(r.ticker)} <span>${escapeHtml(core.shortExpiry(r.expiry))} ${r.type === "C" ? "콜" : "풋"} ${escapeHtml(core.fmtStrike(r.strike))}</span><span class="muted">${escapeHtml(core.fmtUsd(r.premium))}</span></li>`).join("")}</ul>`;
  },
};

// 관심 + 보유 종목(중복 제거, 관심 먼저).
function dashMyTickers() {
  return [...new Set([...(watchlist || []), ...(portfolio || []).map((p) => p && p.ticker).filter(Boolean)])];
}

Object.assign(DASH_RENDER, {
  upcoming() {
    const mine = dashMyTickers();
    if (!mine.length) return '<p class="muted">관심·보유 종목이 없습니다.</p>';
    const today = new Date().toLocaleDateString("en-CA", { timeZone: isKrMarket() ? "Asia/Seoul" : "America/New_York" });
    const rows = window.MirDashCore.upcomingEarnings(staticEarningsRowsForTickers(mine), today, 30).slice(0, 8);
    if (!rows.length) return '<p class="muted">30일 안에 실적 발표가 잡힌 내 종목이 없습니다.</p>';
    return `<ul class="dash-list">${rows.map((r) => {
      const s = stockByTicker(r.ticker);
      return `<li>${dashTickerBtn(r.ticker, s ? stockLabel(s) : r.ticker)}<span>${escapeHtml(String(r.nextDate).slice(5, 10))} <span class="muted">${r.daysAhead === 0 ? "오늘" : `D-${r.daysAhead}`}</span></span></li>`;
    }).join("")}</ul>`;
  },
  industry() {
    const mine = dashMyTickers();
    if (!mine.length) return '<p class="muted">관심·보유 종목이 없습니다.</p>';
    if (!window.INDUSTRY_BY_TICKER || !window.INDUSTRY_INDICATORS) {
      Promise.all([ensureFeatureData("industryByTicker"), ensureFeatureData("industry")]).then((r) => { if (r.every(Boolean)) renderMyDash(); });
      return "";
    }
    const rows = window.MirDashCore.relatedIndicators(window.INDUSTRY_BY_TICKER.byTicker, mine, 6)
      .map((r) => ({ ...r, ind: industryIndicator(r.id) })).filter((r) => r.ind);
    if (!rows.length) return '<p class="muted">내 종목과 연결된 산업 지표가 없습니다.</p>';
    return `<ul class="dash-list">${rows.map(({ ind, tickers }) => {
      const chg = ind.latest_yoy != null ? `<span class="${indCls(ind.latest_yoy)}">${indFmtSigned(ind.latest_yoy, "%", 1)}</span>` : "";
      return `<li><span>${escapeHtml(ind.name_kr)} <span class="muted">${escapeHtml(tickers.slice(0, 3).join(", "))}</span></span><span>${indFmtNum(ind.latest_value)} ${chg}</span></li>`;
    }).join("")}</ul>`;
  },
});

function renderMyDash() {
  const host = byId("myDash");
  if (!host) return;
  const core = window.MirDashCore;
  if (!core) { host.innerHTML = ""; return; }
  if (typeof bulkSubTab !== "undefined" && bulkSubTab !== "dash") return;   // 탭을 열 때만(lazy 데이터 요청 포함)
  const market = dashMarket();
  const layout = dashLayout();
  const addable = core.addable(layout, market);
  const cards = layout.map((id, i) => {
    let body = "";
    try { body = DASH_RENDER[id] ? DASH_RENDER[id]() : ""; } catch (_) { body = ""; }
    return `<section class="dash-card" data-dash-id="${id}">
      <header class="dash-card-head"><h4>${escapeHtml(core.WIDGETS[id].label)}</h4>
        <span class="dash-tools">
          <button type="button" class="dash-btn" data-dash-move="-1" aria-label="위로"${i === 0 ? " disabled" : ""}>↑</button>
          <button type="button" class="dash-btn" data-dash-move="1" aria-label="아래로"${i === layout.length - 1 ? " disabled" : ""}>↓</button>
          <button type="button" class="dash-btn" data-dash-remove aria-label="빼기">✕</button>
        </span></header>
      <div class="dash-card-body">${body || '<p class="muted">자료를 불러오는 중이거나 아직 없습니다.</p>'}</div>
    </section>`;
  }).join("");
  host.innerHTML = `<div class="dash-bar">
      ${addable.length ? `<label class="dash-add">위젯 추가 <select data-dash-add aria-label="추가할 위젯"><option value="">선택</option>${addable.map((w) => `<option value="${w.id}">${escapeHtml(w.label)}</option>`).join("")}</select></label>` : ""}
      <button type="button" class="dash-btn dash-reset" data-dash-reset>기본으로</button>
    </div>
    ${layout.length ? `<div class="dash-grid">${cards}</div>` : '<p class="muted">위젯을 추가해 보세요.</p>'}`;
}

// 한 번만 붙이는 이벤트(위젯을 다시 그려도 유지).
document.addEventListener("click", (e) => {
  const host = byId("myDash");
  if (!host || !host.contains(e.target)) return;
  const core = window.MirDashCore;
  const tickerBtn = e.target.closest("[data-dash-ticker]");
  if (tickerBtn) { selectTicker(tickerBtn.dataset.dashTicker, { openSearch: true }); return; }
  const card = e.target.closest("[data-dash-id]");
  let layout = dashLayout();
  if (e.target.closest("[data-dash-reset]")) layout = core.sanitize(null, dashMarket());
  else if (card && e.target.closest("[data-dash-remove]")) layout = core.remove(layout, card.dataset.dashId);
  else if (card && e.target.closest("[data-dash-move]")) layout = core.move(layout, card.dataset.dashId, Number(e.target.closest("[data-dash-move]").dataset.dashMove));
  else return;
  dashSave(layout);
  renderMyDash();
});
document.addEventListener("change", (e) => {
  const sel = e.target.closest && e.target.closest("[data-dash-add]");
  if (!sel || !sel.value) return;
  dashSave(window.MirDashCore.add(dashLayout(), sel.value, dashMarket()));
  renderMyDash();
});
