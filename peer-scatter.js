// peer-scatter.js — 종목 › 비교 '피어 산점도'(#comparePeerCard).
// ====================================================================================
// 계산은 peer-scatter-core.js(window.MirPeerScatterCore). 기준 종목(비교 목록 중 하나)과 같은 산업군 종목을
// MAP_FUNDAMENTALS 의 X·Y 지표로 찍는다. 값이 없는 종목은 빼고 'N개 중 M개 표시'. 점선 = 업종 중앙값(그 외 선 없음).
// 비교 목록의 다른 종목도 같은 업종이면 이름을 단다. 점을 누르면 그 종목 화면으로.
// compare-board.js renderData 가 window.renderComparePeerScatter(tickers) 를 부른다.
(function () {
  "use strict";

  const core = () => window.MirPeerScatterCore;
  const state = { anchor: "", x: "pe", y: "roe" };
  const M = { l: 56, r: 18, t: 14, b: 40 };
  // 뷰박스를 실제 폭에 맞춘다(좁은 화면에서 800 폭을 축소하면 글자가 읽히지 않는다).
  let W = 800, H = 360;
  let lastTickers = [];
  let resizeTimer = null;

  const $ = (id) => document.getElementById(id);
  const esc = (s) => (typeof escapeHtml === "function" ? escapeHtml(s) : String(s == null ? "" : s));
  const label = (t) => (typeof stockLabel === "function" ? stockLabel(t) : t);
  const stocks = () => ((typeof data !== "undefined" && data && Array.isArray(data.stocks)) ? data.stocks : []);
  const fundFor = (t) => (typeof mapFundamentalsFor === "function" ? mapFundamentalsFor(t) : (window.MAP_FUNDAMENTALS || {})[t]) || null;
  const sectorKo = (s) => (typeof sectorLabelKo === "function" ? sectorLabelKo(s) : s);

  function ticks(lo, hi, n = 5) {
    const span = hi - lo;
    if (!(span > 0)) return [lo];
    const raw = span / n;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw) || raw;
    const out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(10)));
    return out;
  }

  function fmt(v, m) {
    if (v === null || !Number.isFinite(v)) return "—";
    const d = Math.abs(v) >= 100 || Number.isInteger(v) ? 0 : 1;
    return `${v.toFixed(d)}${m && m.unit === "%" ? "%" : m && m.unit === "배" ? "배" : ""}`;
  }

  function options(sel, list, value) {
    sel.innerHTML = list.map((m) => `<option value="${esc(m.key)}"${m.key === value ? " selected" : ""}>${esc(m.label)}</option>`).join("");
  }

  function draw(svg, res, mx, my, cmpSet) {
    const [x0, x1] = res.domainX, [y0, y1] = res.domainY;
    const iw = W - M.l - M.r, ih = H - M.t - M.b;
    const sx = (v) => M.l + (v - x0) / (x1 - x0) * iw;
    const sy = (v) => M.t + (1 - (v - y0) / (y1 - y0)) * ih;
    let g = "";
    ticks(x0, x1).forEach((v) => {
      const x = sx(v).toFixed(1);
      g += `<line class="chart-grid" x1="${x}" x2="${x}" y1="${M.t}" y2="${H - M.b}"/><text class="chart-axis" x="${x}" y="${H - M.b + 14}" text-anchor="middle">${esc(fmt(v, null))}</text>`;
    });
    ticks(y0, y1).forEach((v) => {
      const y = sy(v).toFixed(1);
      g += `<line class="chart-grid" x1="${M.l}" x2="${W - M.r}" y1="${y}" y2="${y}"/><text class="chart-axis" x="${M.l - 6}" y="${(Number(y) + 3).toFixed(1)}" text-anchor="end">${esc(fmt(v, null))}</text>`;
    });
    g += `<text class="chart-axis ps-axis-title" x="${(M.l + iw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(mx.label)} →</text>`;
    g += `<text class="chart-axis ps-axis-title" x="12" y="${(M.t + ih / 2).toFixed(1)}" text-anchor="middle" transform="rotate(-90 12 ${(M.t + ih / 2).toFixed(1)})">${esc(my.label)} →</text>`;
    // 업종 중앙값 점선(범위 안일 때만)
    if (res.medX !== null && res.medX >= x0 && res.medX <= x1) {
      const x = sx(res.medX).toFixed(1);
      g += `<line class="ps-med" x1="${x}" x2="${x}" y1="${M.t}" y2="${H - M.b}"><title>업종 중앙값 ${esc(mx.label)} ${esc(fmt(res.medX, mx))}</title></line>`;
    }
    if (res.medY !== null && res.medY >= y0 && res.medY <= y1) {
      const y = sy(res.medY).toFixed(1);
      g += `<line class="ps-med" x1="${M.l}" x2="${W - M.r}" y1="${y}" y2="${y}"><title>업종 중앙값 ${esc(my.label)} ${esc(fmt(res.medY, my))}</title></line>`;
    }
    const labels = [];
    res.points.forEach((p) => {
      const cx = sx(p.px).toFixed(1), cy = sy(p.py).toFixed(1);
      const out = p.outX || p.outY;
      const named = p.self || cmpSet.has(p.ticker);
      const cls = `ps-dot${p.self ? " is-self" : named ? " is-cmp" : ""}${out ? " is-out" : ""}`;
      const r = p.self ? 7 : named ? 5 : 3.6;
      const tip = `${label(p.ticker)} · ${mx.label} ${fmt(p.x, mx)} · ${my.label} ${fmt(p.y, my)}${out ? " (축 범위 밖)" : ""}`;
      g += `<circle class="${cls}" cx="${cx}" cy="${cy}" r="${r}" data-ticker="${esc(p.ticker)}" tabindex="0"><title>${esc(tip)}</title></circle>`;
      if (named) labels.push(`<text class="ps-label${p.self ? " is-self" : ""}" x="${(Number(cx) + r + 3).toFixed(1)}" y="${(Number(cy) + 4).toFixed(1)}">${esc(label(p.ticker))}</text>`);
    });
    svg.innerHTML = g + labels.join("");
  }

  function render(tickers) {
    const card = $("comparePeerCard");
    const c = core();
    if (!card || !c) return;
    lastTickers = Array.isArray(tickers) ? tickers.slice() : [];
    const list = (Array.isArray(tickers) ? tickers : []).filter((t) => stocks().some((s) => s.ticker === t));
    const table = window.MAP_FUNDAMENTALS || {};
    const metrics = c.availableMetrics(table);
    if (!list.length || metrics.length < 2) { card.hidden = true; return; }
    card.hidden = false;
    if (!list.includes(state.anchor)) state.anchor = list[0];
    if (!metrics.some((m) => m.key === state.x)) state.x = metrics[0].key;
    if (!metrics.some((m) => m.key === state.y) || state.y === state.x) state.y = (metrics.find((m) => m.key === "roe" && m.key !== state.x) || metrics.find((m) => m.key !== state.x)).key;
    const anchorSel = $("comparePeerAnchor");
    if (anchorSel) anchorSel.innerHTML = list.map((t) => `<option value="${esc(t)}"${t === state.anchor ? " selected" : ""}>${esc(label(t))}</option>`).join("");
    if ($("comparePeerX")) options($("comparePeerX"), metrics, state.x);
    if ($("comparePeerY")) options($("comparePeerY"), metrics, state.y);
    const anchor = stocks().find((s) => s.ticker === state.anchor);
    const res = c.buildScatter({ stocks: stocks(), anchor, fundFor, xKey: state.x, yKey: state.y });
    const svg = $("comparePeerChart");
    const meta = $("comparePeerMeta");
    const width = svg ? Math.round(svg.getBoundingClientRect().width) : 0;
    W = width > 0 ? Math.max(320, Math.min(800, width)) : 800;
    H = W < 600 ? Math.round(W * 0.82) : 360;
    if (svg) svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    if (!res || !res.shown || !res.domainX || !res.domainY) {
      if (svg) svg.innerHTML = `<text class="chart-axis" x="${W / 2}" y="${H / 2}" text-anchor="middle">표시할 값이 없습니다</text>`;
      if (meta) meta.textContent = res ? `${res.total}개 중 0개 표시` : "같은 업종 종목이 없습니다";
      return;
    }
    const mx = c.metricByKey(state.x), my = c.metricByKey(state.y);
    if (svg) draw(svg, res, mx, my, new Set(list));
    const group = res.basis === "industry" ? res.group : `${sectorKo(res.group)}(섹터)`;
    if (meta) {
      meta.textContent = `${group} · ${res.total}개 중 ${res.shown}개 표시${res.anchorShown ? "" : ` · ${label(state.anchor)} 값 없음`} · 점선 = 업종 중앙값`;
    }
  }

  function setup() {
    const card = $("comparePeerCard");
    if (!card || card.dataset.psBound) return;
    card.dataset.psBound = "1";
    card.addEventListener("change", (e) => {
      const id = e.target && e.target.id;
      if (id === "comparePeerAnchor") state.anchor = e.target.value;
      else if (id === "comparePeerX") state.x = e.target.value;
      else if (id === "comparePeerY") state.y = e.target.value;
      else return;
      render(typeof compareTickersFromInput === "function" ? compareTickersFromInput() : []);
    });
    const open = (e) => {
      const dot = e.target.closest && e.target.closest(".ps-dot[data-ticker]");
      if (dot && typeof selectTicker === "function") selectTicker(dot.getAttribute("data-ticker"), { openSearch: true });
    };
    $("comparePeerChart")?.addEventListener("click", open);
    $("comparePeerChart")?.addEventListener("keydown", (e) => { if (e.key === "Enter") open(e); });
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { if (!card.hidden && card.offsetParent) render(lastTickers); }, 180);
    });
  }

  window.renderComparePeerScatter = (tickers) => { setup(); render(tickers); };
})();
