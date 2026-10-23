// breadth-history.js — 시장 탭 › 시장 폭의 '시장 폭 추이' 카드 (미국·국내)
// =====================================================
// 데이터: data/market_breadth.js · data/korea/market_breadth.js(window.MARKET_BREADTH, lazy·시장별 —
// scripts/build_market_breadth.py, 종목별 실측 일봉 집계). 계산은 breadth-history-core.js(MirBreadthHistoryCore).
// renderMarketBreadth(app.js) 끝에서 불린다. 파일이 없거나 점이 모자라면 카드를 숨긴다.
// 같은 파일의 sectors 로 '섹터별 시장 폭' 표(#sectorBreadthCard)도 그린다 — 50·200일선 위 비율, 1개월 변화, BPI.

// 공매도 거래량 비율 지수 — data/short_volume_index.js(window.SHORT_VOLUME_INDEX, lazy·US 전용).
// S&P 500 종목의 FINRA 장외 공매도 거래량 비율을 거래대금으로 가중 평균. 잔고가 아니고 매수·매도 해석을 붙이지 않는다.
function renderShortVolumeIndex() {
  const host = byId("shortVolIndexCard");
  if (!host) return;
  const core = window.MirBreadthHistoryCore;
  const hide = () => { host.hidden = true; host.innerHTML = ""; };
  if (!core || !core.svIndexStats || isKrMarket()) return hide();
  const p = window.SHORT_VOLUME_INDEX;
  if (!p) {
    hide();
    if (typeof ensureFeatureData === "function") ensureFeatureData("shortVolIndex").then((ok) => { if (ok && window.SHORT_VOLUME_INDEX) renderShortVolumeIndex(); });
    return;
  }
  const s = core.svIndexStats(p);
  if (!s) return hide();
  const w = 100;
  const h = 40;
  const pct = (v) => `${Number(v).toFixed(1)}%`;
  const avgY = (h - ((s.avg20 - s.dom[0]) / ((s.dom[1] - s.dom[0]) || 1)) * h).toFixed(2);
  const facts = [`20일 평균 ${pct(s.avg20)}`, `구간 ${pct(s.min)}~${pct(s.max)}`];
  if (s.pctile !== null) facts.push(`구간 내 백분위 ${s.pctile}`);
  host.hidden = false;
  host.innerHTML = `<div class="breadth-head"><h3>${escapeHtml(p.name || "공매도 거래량 비율 지수(S&P 500, 잔고 아님)")}</h3><span class="muted">${escapeHtml(s.last.d)} 기준</span></div>
    <figure class="bh-panel svi-panel">
      <figcaption><span>${escapeHtml(facts.join(" · "))}</span><strong>${escapeHtml(pct(s.last.v))}</strong></figcaption>
      <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="공매도 거래량 비율 지수 추이">
        <line class="bh-base" x1="0" x2="${w}" y1="${avgY}" y2="${avgY}"></line>
        <path class="bh-line" d="${core.linePath(s.pts, w, h, s.dom)}"></path>
      </svg>
      <div class="bh-foot"><span>${escapeHtml(core.shortDate(s.pts[0].d, s.last.d))}</span><span>점선 = 20일 평균</span><span>${escapeHtml(core.shortDate(s.last.d, s.last.d))}</span></div>
    </figure>
    <p class="muted svi-note">FINRA 장외 보고 거래량 중 공매도 비율의 거래대금 가중 평균 · ${s.last.n || ""}종목</p>`;
}

function renderBreadthHistory() {
  renderShortVolumeIndex();
  const host = byId("breadthHistoryCard");
  if (!host) return;
  const core = window.MirBreadthHistoryCore;
  const sectorHost = byId("sectorBreadthCard");
  const hide = () => {
    host.hidden = true; host.innerHTML = "";
    if (sectorHost) { sectorHost.hidden = true; sectorHost.innerHTML = ""; }
  };
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
    <div class="bh-grid">${panels.map(({ def, pts }) => breadthPanelHtml(core, def, pts, p)).join("")}</div>`;
  renderSectorBreadth(core, p, sectorHost);
}

function renderSectorBreadth(core, p, host) {
  if (!host) return;
  const rows = core.sectorRows(p);
  if (!rows.length) { host.hidden = true; host.innerHTML = ""; return; }
  const name = (n) => (typeof sectorShortName === "function" ? sectorShortName(n) : n);
  const pct = (v) => (Number.isFinite(v) ? `${v.toFixed(1)}%` : "–");
  const chg = (v) => (Number.isFinite(v) ? core.fmtChange(v, "%") : "–");
  host.hidden = false;
  host.innerHTML = `<div class="breadth-head"><h3>섹터별 시장 폭</h3></div>
    <div class="sb-table-wrap"><table class="sb-table">
      <thead><tr><th>섹터</th><th>종목</th><th>50일선 위</th><th>1개월</th><th>200일선 위</th><th>1개월</th><th>BPI</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><th scope="row">${escapeHtml(name(r.name))}</th><td>${r.n}</td>
        <td>${sbBar(r.above50)}${pct(r.above50)}</td><td class="muted">${chg(r.chg50)}</td>
        <td>${sbBar(r.above200)}${pct(r.above200)}</td><td class="muted">${chg(r.chg200)}</td>
        <td>${pct(r.bpi)}</td></tr>`).join("")}</tbody>
    </table></div>`;
}

function sbBar(v) {
  if (!Number.isFinite(v)) return "";
  return `<span class="sb-bar" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, v)).toFixed(0)}%"></i></span>`;
}

function breadthPanelHtml(core, def, pts, payload) {
  const label = core.panelLabel ? core.panelLabel(def, payload) : def.label;
  const w = 100;
  const h = 40;
  const dom = core.domain(pts, def.axis);
  const s = core.summary(pts);
  const base = core.baselineY(def.axis, h, dom).toFixed(2);
  // 시장 폭은 오르내림이 아니라 상태라 등락색을 쓰지 않는다(값 부호만 표시).
  return `<figure class="bh-panel">
      <figcaption><span>${escapeHtml(label)}</span><strong>${escapeHtml(core.fmtValue(s.v, def.unit))}</strong></figcaption>
      <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(`${label} 추이`)}">
        <line class="bh-base" x1="0" x2="${w}" y1="${base}" y2="${base}"></line>
        <path class="bh-line" d="${core.linePath(pts, w, h, dom)}"></path>
      </svg>
      <div class="bh-foot"><span>${escapeHtml(core.shortDate(pts[0].d, s.d))}</span><span>1개월 ${escapeHtml(core.fmtChange(s.change, def.unit))}</span><span>${escapeHtml(core.shortDate(s.d, s.d))}</span></div>
    </figure>`;
}
