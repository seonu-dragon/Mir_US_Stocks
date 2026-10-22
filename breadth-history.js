// breadth-history.js — 시장 탭 › 시장 폭의 '시장 폭 추이' 카드 (미국·국내)
// =====================================================
// 데이터: data/market_breadth.js · data/korea/market_breadth.js(window.MARKET_BREADTH, lazy·시장별 —
// scripts/build_market_breadth.py, 종목별 실측 일봉 집계). 계산은 breadth-history-core.js(MirBreadthHistoryCore).
// renderMarketBreadth(app.js) 끝에서 불린다. 파일이 없거나 점이 모자라면 카드를 숨긴다.

function renderBreadthHistory() {
  const host = byId("breadthHistoryCard");
  if (!host) return;
  const core = window.MirBreadthHistoryCore;
  const hide = () => { host.hidden = true; host.innerHTML = ""; };
  if (!core || featureOff("marketBreadth")) return hide();
  const p = window.MARKET_BREADTH;
  const market = isKrMarket() ? "kr" : "us";
  if (!p || p.market !== market) {
    if (p && p.market !== market) return hide();
    ensureFeatureData("marketBreadth").then((ok) => { if (ok) renderBreadthHistory(); });
    return;
  }
  const panels = core.PANELS.map((def) => ({ def, pts: core.series(p, def.key) })).filter((x) => x.pts.length >= 20);
  if (!panels.length) return hide();
  const lastD = panels[0].pts[panels[0].pts.length - 1].d;
  host.hidden = false;
  host.innerHTML = `<div class="breadth-head"><h3>시장 폭 추이</h3><span class="muted">${escapeHtml(lastD)} 기준</span></div>
    <div class="bh-grid">${panels.map(({ def, pts }) => breadthPanelHtml(core, def, pts)).join("")}</div>`;
}

function breadthPanelHtml(core, def, pts) {
  const w = 100;
  const h = 40;
  const dom = core.domain(pts, def.axis);
  const s = core.summary(pts);
  const base = core.baselineY(def.axis, h, dom).toFixed(2);
  // 시장 폭은 오르내림이 아니라 상태라 등락색을 쓰지 않는다(값 부호만 표시).
  return `<figure class="bh-panel">
      <figcaption><span>${escapeHtml(def.label)}</span><strong>${escapeHtml(core.fmtValue(s.v, def.unit))}</strong></figcaption>
      <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(`${def.label} 추이`)}">
        <line class="bh-base" x1="0" x2="${w}" y1="${base}" y2="${base}"></line>
        <path class="bh-line" d="${core.linePath(pts, w, h, dom)}"></path>
      </svg>
      <div class="bh-foot"><span>${escapeHtml(core.shortDate(pts[0].d, s.d))}</span><span>1개월 ${escapeHtml(core.fmtChange(s.change, def.unit))}</span><span>${escapeHtml(core.shortDate(s.d, s.d))}</span></div>
    </figure>`;
}
