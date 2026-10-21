// chart-ind-picker.js — 종목 분석 차트의 지표 고르기 UI(검색·분류·즐겨찾기·파라미터)·켜진 지표 칩·보조 패널 높이
// =====================================================
// classic script(모듈 아님). chart.js 다음에 로드되고 같은 전역 스코프를 쓴다. 로드 시점 실행문은 없다.
// 목록·검색 매칭·파라미터 정규화는 chart-ind-core.js(window.MirChartInd) 가 갖고, 여기는 DOM·저장만 붙인다.
// 체크박스 id·chartState 키는 예전 그대로(showSma20 …) — 프리셋·기술 점수 분석이 이 키로 켜고 끈다.
// 이름 충돌은 scripts/check_global_name_collisions.py 가 감시한다.

const CHART_IND_PARAMS_KEY = "mir_chart_ind_params_v1";
const CHART_IND_FAV_KEY = "mir_chart_ind_fav_v1";
const CHART_IND_CAT_KEY = "mir_chart_ind_cat_v1";
const CHART_PANEL_H_KEY = "mir_chart_panel_h_v1";
let chartIndFavs = null;
let chartIndCat = "all";
let chartIndQuery = "";
let chartPanelHeights = null;
let chartIndChipsKey = "";
let chartIndPopId = "";

function chartIndCore() { return window.MirChartInd || null; }

function chartIndStoreGet(key) {
  try { return JSON.parse(window.safeStorage.get(key) || "null"); } catch (e) { return null; }
}
function chartIndStoreSet(key, value) {
  try { window.safeStorage.set(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
}

// chartState.indParams 를 처음 쓸 때 저장값에서 읽는다(app.js 의 chartState 기본값엔 키가 없다).
function ensureChartIndParams() {
  if (chartState.indParams && typeof chartState.indParams === "object") return chartState.indParams;
  const core = chartIndCore();
  chartState.indParams = core ? core.normalize(chartIndStoreGet(CHART_IND_PARAMS_KEY)) : {};
  return chartState.indParams;
}

function saveChartIndParams() {
  const core = chartIndCore();
  if (!core) return;
  chartState.indParams = core.normalize(chartState.indParams);
  chartIndStoreSet(CHART_IND_PARAMS_KEY, chartState.indParams);
}

function chartIndFavList() {
  if (!chartIndFavs) {
    const core = chartIndCore();
    chartIndFavs = core ? core.sanitizeFavs(chartIndStoreGet(CHART_IND_FAV_KEY)) : [];
  }
  return chartIndFavs;
}

// ----- 보조 패널 높이(경계 드래그) -----
function chartPanelHeightMap() {
  if (!chartPanelHeights) {
    const core = chartIndCore();
    chartPanelHeights = core ? core.sanitizePanelHeights(chartIndStoreGet(CHART_PANEL_H_KEY)) : {};
  }
  return chartPanelHeights;
}

function chartPanelHeight(t, def) {
  const v = chartPanelHeightMap()[t];
  return Number.isFinite(v) ? v : def;
}

function setupChartPanelResize() {
  const svg = byId("priceChart");
  const core = chartIndCore();
  if (!svg || !core || svg.dataset.panelResizeBound) return;
  svg.dataset.panelResizeBound = "1";
  let drag = null;
  svg.addEventListener("pointerdown", (e) => {
    const hit = e.target.closest && e.target.closest("[data-panel-resize]");
    if (!hit || (e.pointerType === "mouse" && e.button !== 0)) return;
    const t = hit.dataset.panelResize;
    const rect = svg.getBoundingClientRect();
    const g = lastChartGeom;
    if (!g || !rect.width) return;
    const startH = chartPanelHeight(t, Number(hit.dataset.panelH) || 60);
    drag = { id: e.pointerId, t, startY: e.clientY, startH, k: g.width / rect.width, moved: false };
    try { svg.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    svg.classList.add("is-panel-resizing");
    e.preventDefault();
    e.stopPropagation();
  });
  svg.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = (e.clientY - drag.startY) * drag.k;
    if (Math.abs(dy) < 1 && !drag.moved) return;
    drag.moved = true;
    const map = chartPanelHeightMap();
    map[drag.t] = Math.round(Math.min(core.PANEL_H_MAX, Math.max(core.PANEL_H_MIN, drag.startH + dy)));
    chartPanActive = true; // 무거운 오버레이는 끌기가 끝난 뒤 한 번
    scheduleChartPanRedraw();
    e.preventDefault();
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const moved = drag.moved;
    drag = null;
    svg.classList.remove("is-panel-resizing");
    try { svg.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    if (!moved) return;
    chartPanelHeights = core.sanitizePanelHeights(chartPanelHeightMap());
    chartIndStoreSet(CHART_PANEL_H_KEY, chartPanelHeights);
    endChartPan();
  };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
  svg.addEventListener("dblclick", (e) => {
    const hit = e.target.closest && e.target.closest("[data-panel-resize]");
    if (!hit) return;
    e.preventDefault();
    const map = chartPanelHeightMap();
    delete map[hit.dataset.panelResize];
    chartIndStoreSet(CHART_PANEL_H_KEY, map);
    redrawChart();
  });
}

// ----- 지표 목록 -----
function chartIndRowName(id) {
  return chartIndLabel(id);
}

function setupChartIndPicker() {
  const root = byId("chartIndPicker");
  const core = chartIndCore();
  if (!root || !core || root.dataset.bound) return;
  root.dataset.bound = "1";
  ensureChartIndParams();
  const savedCat = chartIndStoreGet(CHART_IND_CAT_KEY);
  if (typeof savedCat === "string" && (savedCat === "all" || savedCat === "fav" || core.CATEGORIES.some(([k]) => k === savedCat))) chartIndCat = savedCat;

  const cats = [["all", "전체"], ["fav", "★"]].concat(core.CATEGORIES);
  const catBox = byId("chartIndCats");
  if (catBox) {
    catBox.innerHTML = cats.map(([k, label]) => `<button type="button" data-ind-cat="${k}" role="tab" aria-selected="false"${k === "fav" ? ' aria-label="즐겨찾기" title="즐겨찾기"' : ""}>${escapeHtml(label)}</button>`).join("");
    catBox.addEventListener("click", (e) => {
      const b = e.target.closest("[data-ind-cat]");
      if (!b) return;
      chartIndCat = b.dataset.indCat;
      chartIndStoreSet(CHART_IND_CAT_KEY, chartIndCat);
      syncChartIndPicker();
    });
  }

  const list = byId("chartIndList");
  if (list) {
    list.innerHTML = core.CATEGORIES.map(([cat, catLabel]) => {
      const rows = core.CATALOG.filter((e) => e.cat === cat).map((e) => {
        const hasParams = e.params.length > 0;
        const dot = e.overlay ? `<i class="cip-dot" style="background:${e.overlay}"></i>` : "";
        return `<div class="cip-row" data-ind="${e.id}">`
          + `<label class="check-label cip-check"><input id="${e.id}" type="checkbox"${chartState[e.id] ? " checked" : ""}>${dot}<span class="cip-name">${escapeHtml(chartIndRowName(e.id))}</span><span class="cip-ko">${escapeHtml(e.ko)}</span></label>`
          + (hasParams ? `<button type="button" class="cip-gear" data-ind-param="${e.id}" aria-label="${escapeHtml(e.ko)} 설정" title="설정">⚙</button>` : "")
          + `<button type="button" class="cip-star" data-ind-fav="${e.id}" aria-pressed="false" aria-label="${escapeHtml(e.ko)} 즐겨찾기" title="즐겨찾기">☆</button>`
          + `</div>`;
      }).join("");
      const extra = cat === "ma"
        ? `<div class="cip-extra" id="chartIndExtra">`
          + `<select id="chartIndExtraType" aria-label="이평 종류"><option value="sma">SMA</option><option value="ema">EMA</option></select>`
          + `<input id="chartIndExtraP" type="number" inputmode="numeric" min="2" max="250" step="1" value="200" aria-label="기간">`
          + `<button type="button" class="ghost" id="chartIndExtraAdd">+ 이평 추가</button>`
          + `<span class="cip-extra-list" id="chartIndExtraList"></span></div>`
        : "";
      return `<div class="cip-group" data-group="${cat}"><div class="cip-group-title">${escapeHtml(catLabel)}</div><div class="cip-rows">${rows}</div>${extra}</div>`;
    }).join("") + `<p class="cip-empty" id="chartIndEmpty" hidden>결과 없음</p>`;

    list.addEventListener("click", (e) => {
      const star = e.target.closest("[data-ind-fav]");
      if (star) {
        e.preventDefault();
        chartIndFavs = core.toggleFav(chartIndFavList(), star.dataset.indFav);
        chartIndStoreSet(CHART_IND_FAV_KEY, chartIndFavs);
        syncChartIndPicker();
        return;
      }
      const gear = e.target.closest("[data-ind-param]");
      if (gear) {
        e.preventDefault();
        openChartIndParams(gear.dataset.indParam, gear);
        return;
      }
      const xb = e.target.closest("[data-extra-idx]");
      if (xb) removeChartIndExtra(Number(xb.dataset.extraIdx));
    });
  }

  const search = byId("chartIndSearch");
  if (search) {
    search.addEventListener("input", () => { chartIndQuery = search.value; syncChartIndPicker(); });
    search.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && search.value) { e.preventDefault(); search.value = ""; chartIndQuery = ""; syncChartIndPicker(); }
      // Enter: 맨 위 결과 하나를 켜고 끈다.
      if (e.key === "Enter") {
        e.preventDefault();
        const first = core.filter(chartIndQuery, chartIndCat, chartIndFavList())[0];
        const el = first && byId(first);
        if (el) { el.checked = !el.checked; el.dispatchEvent(new Event("change")); }
      }
    });
  }

  byId("chartIndExtraAdd")?.addEventListener("click", addChartIndExtra);
  byId("chartIndExtraP")?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addChartIndExtra(); } });

  const chips = byId("chartIndChips");
  if (chips) {
    chips.addEventListener("click", (e) => {
      const off = e.target.closest("[data-chip-off]");
      if (off) {
        const id = off.dataset.chipOff;
        const el = byId(id);
        if (el) { el.checked = false; el.dispatchEvent(new Event("change")); }
        else if (id in chartState) { chartState[id] = false; redrawChart(); }
        return;
      }
      const xoff = e.target.closest("[data-chip-extra]");
      if (xoff) { removeChartIndExtra(Number(xoff.dataset.chipExtra)); return; }
      const lab = e.target.closest("[data-chip-param]");
      if (lab) { openChartIndParams(lab.dataset.chipParam, lab); return; }
      if (e.target.closest("[data-chip-add]")) {
        const panel = byId("chartSettingsPanel");
        if (panel && !panel.open) { panel.open = true; panel.dispatchEvent(new Event("toggle")); }
        const s = byId("chartIndSearch");
        if (s) { try { s.focus({ preventScroll: true }); } catch (_) { s.focus(); } root.scrollIntoView({ block: "nearest" }); }
      }
    });
  }
  setupChartPanelResize();
  syncChartIndPicker();
}

// 체크 상태·이름(파라미터)·즐겨찾기·검색/분류 필터를 지금 상태로 맞춘다.
function syncChartIndPicker() {
  const core = chartIndCore();
  const list = byId("chartIndList");
  if (!core || !list) return;
  const favs = chartIndFavList();
  const shown = new Set(core.filter(chartIndQuery, chartIndCat, favs));
  list.querySelectorAll(".cip-row").forEach((row) => {
    const id = row.dataset.ind;
    row.hidden = !shown.has(id);
    const input = byId(id);
    if (input) input.checked = Boolean(chartState[id]);
    row.classList.toggle("is-on", Boolean(chartState[id]));
    const name = row.querySelector(".cip-name");
    const txt = chartIndRowName(id);
    if (name && name.textContent !== txt) name.textContent = txt;
    const star = row.querySelector(".cip-star");
    if (star) {
      const on = favs.includes(id);
      star.textContent = on ? "★" : "☆";
      star.classList.toggle("is-on", on);
      star.setAttribute("aria-pressed", on ? "true" : "false");
    }
  });
  let any = false;
  list.querySelectorAll(".cip-group").forEach((grp) => {
    const vis = Array.from(grp.querySelectorAll(".cip-row")).some((r) => !r.hidden);
    // 추가 이평 칸은 이동평균 분류(또는 전체·검색어 없음)에서만
    const extra = grp.querySelector(".cip-extra");
    if (extra) extra.hidden = !(chartIndCat === "ma" || (chartIndCat === "all" && !chartIndQuery.trim()));
    grp.hidden = !vis && !(extra && !extra.hidden);
    if (!grp.hidden) any = true;
  });
  const empty = byId("chartIndEmpty");
  if (empty) empty.hidden = any;
  byId("chartIndCats")?.querySelectorAll("[data-ind-cat]").forEach((b) => {
    const on = b.dataset.indCat === chartIndCat;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });
  const exList = byId("chartIndExtraList");
  if (exList) {
    const extra = core.sanitizeExtra(chartState.indParams && chartState.indParams.extra);
    exList.innerHTML = extra.map((x, i) => `<button type="button" class="compare-chip" data-extra-idx="${i}" title="${escapeHtml(core.extraLabel(x))} 빼기"><i class="compare-chip-dot" style="background:${core.EXTRA_COLORS[i % core.EXTRA_COLORS.length]}"></i>${escapeHtml(core.extraLabel(x))} <span>x</span></button>`).join("");
    const add = byId("chartIndExtraAdd");
    if (add) add.disabled = extra.length >= core.EXTRA_MAX;
  }
  if (chartIndPopId) fillChartIndPop(chartIndPopId);
}

function addChartIndExtra() {
  const core = chartIndCore();
  if (!core) return;
  ensureChartIndParams();
  const t = byId("chartIndExtraType")?.value === "ema" ? "ema" : "sma";
  const p = Number(byId("chartIndExtraP")?.value);
  const cur = core.sanitizeExtra(chartState.indParams.extra);
  const next = core.sanitizeExtra(cur.concat({ t, p }));
  if (next.length === cur.length) return; // 같은 선이 이미 있거나 가득 참
  chartState.indParams = { ...chartState.indParams, extra: next };
  saveChartIndParams();
  syncChartIndPicker();
  redrawChart();
}

function removeChartIndExtra(idx) {
  const core = chartIndCore();
  if (!core || !Number.isInteger(idx)) return;
  ensureChartIndParams();
  const cur = core.sanitizeExtra(chartState.indParams.extra);
  cur.splice(idx, 1);
  chartState.indParams = { ...chartState.indParams, extra: cur };
  saveChartIndParams();
  syncChartIndPicker();
  redrawChart();
}

// ----- 파라미터 팝오버(목록 ⚙ · 칩 이름 클릭 공통) -----
function chartIndPopEl() {
  let pop = byId("chartIndPop");
  if (pop) return pop;
  pop = document.createElement("div");
  pop.id = "chartIndPop";
  pop.className = "cip-pop";
  pop.setAttribute("role", "dialog");
  pop.hidden = true;
  document.body.appendChild(pop);
  pop.addEventListener("input", (e) => {
    const inp = e.target.closest("[data-pk]");
    if (!inp || !chartIndPopId) return;
    const v = Number(inp.value);
    if (!Number.isFinite(v) || inp.value === "") return;
    ensureChartIndParams();
    chartState.indParams = chartIndCore().setParam(chartState.indParams, chartIndPopId, inp.dataset.pk, v);
    saveChartIndParams();
    syncChartIndPickerNames();
    scheduleChartPanRedraw();
  });
  pop.addEventListener("change", () => { if (chartIndPopId) fillChartIndPop(chartIndPopId); endChartPan(); });
  pop.addEventListener("click", (e) => {
    if (e.target.closest("[data-pop-reset]") && chartIndPopId) {
      chartState.indParams = chartIndCore().resetParams(chartState.indParams, chartIndPopId);
      saveChartIndParams();
      syncChartIndPicker();
      redrawChart();
    } else if (e.target.closest("[data-pop-close]")) {
      closeChartIndParams();
    }
  });
  document.addEventListener("pointerdown", (e) => {
    if (pop.hidden) return;
    if (pop.contains(e.target) || (e.target.closest && e.target.closest("[data-ind-param], [data-chip-param]"))) return;
    closeChartIndParams();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !pop.hidden) closeChartIndParams(); });
  return pop;
}

// 입력 중엔 팝오버 입력칸을 다시 만들지 않는다(커서가 튄다) — 이름만 바꾼다.
function syncChartIndPickerNames() {
  byId("chartIndList")?.querySelectorAll(".cip-row").forEach((row) => {
    const name = row.querySelector(".cip-name");
    if (name) name.textContent = chartIndRowName(row.dataset.ind);
  });
  const title = byId("chartIndPop")?.querySelector(".cip-pop-title");
  if (title && chartIndPopId) title.textContent = chartIndLabel(chartIndPopId);
}

function fillChartIndPop(id) {
  const core = chartIndCore();
  const pop = byId("chartIndPop");
  const e = core && core.entry(id);
  if (!pop || !e) return;
  const p = core.get(chartState.indParams, id);
  pop.setAttribute("aria-label", `${e.ko} 설정`);
  pop.innerHTML = `<div class="cip-pop-head"><strong class="cip-pop-title">${escapeHtml(chartIndLabel(id))}</strong><button type="button" class="cip-pop-x" data-pop-close aria-label="닫기">×</button></div>`
    + e.params.map((s) => `<label class="cip-pop-field"><span>${escapeHtml(s.label)}</span><input type="number" data-pk="${s.k}" value="${p[s.k]}" min="${s.min}" max="${s.max}" step="${s.step}" inputmode="${s.step < 1 ? "decimal" : "numeric"}"></label>`).join("")
    + `<div class="cip-pop-foot"><button type="button" class="ghost" data-pop-reset>기본값</button></div>`;
}

function openChartIndParams(id, anchor) {
  const core = chartIndCore();
  const e = core && core.entry(id);
  if (!e || !e.params.length) return;
  const pop = chartIndPopEl();
  chartIndPopId = id;
  fillChartIndPop(id);
  pop.hidden = false;
  const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: 16, bottom: 80 };
  const w = pop.offsetWidth || 220;
  const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left));
  const top = Math.min(window.innerHeight - (pop.offsetHeight || 160) - 8, r.bottom + 6);
  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(Math.max(8, top))}px`;
  const first = pop.querySelector("input");
  if (first) { try { first.focus({ preventScroll: true }); first.select(); } catch (_) { /* ignore */ } }
}

function closeChartIndParams() {
  const pop = byId("chartIndPop");
  if (pop) pop.hidden = true;
  chartIndPopId = "";
}

// ----- 켜진 지표 칩(차트 위) -----
function renderChartIndChips(item) {
  const box = byId("chartIndChips");
  const core = chartIndCore();
  if (!box || !core) return;
  const on = core.ids().filter((id) => chartState[id]);
  const extra = core.sanitizeExtra(chartState.indParams && chartState.indParams.extra);
  const labels = on.map((id) => (id === "showRsSector" && item ? `RS/${sectorBenchmarkTickerForItem(item) || "Sector"}` : chartIndLabel(id)));
  const key = JSON.stringify([on, labels, extra]);
  if (key === chartIndChipsKey && box.childElementCount) return;
  chartIndChipsKey = key;
  const chip = (inner, off, offLabel) => `<span class="ind-chip">${inner}<button type="button" class="ind-chip-x" ${off} aria-label="${escapeHtml(offLabel)} 끄기" title="끄기">×</button></span>`;
  box.innerHTML = on.map((id, i) => {
    const e = core.entry(id);
    const dot = e.overlay ? `<i class="cip-dot" style="background:${e.overlay}"></i>` : "";
    const name = e.params.length
      ? `<button type="button" class="ind-chip-label" data-chip-param="${id}" title="설정">${dot}${escapeHtml(labels[i])}</button>`
      : `<span class="ind-chip-label">${dot}${escapeHtml(labels[i])}</span>`;
    return chip(name, `data-chip-off="${id}"`, labels[i]);
  }).join("")
    + extra.map((x, i) => chip(`<span class="ind-chip-label"><i class="cip-dot" style="background:${core.EXTRA_COLORS[i % core.EXTRA_COLORS.length]}"></i>${escapeHtml(core.extraLabel(x))}</span>`, `data-chip-extra="${i}"`, core.extraLabel(x))).join("")
    + `<button type="button" class="ind-chip-add" data-chip-add aria-label="지표 추가">+ 지표</button>`;
}
