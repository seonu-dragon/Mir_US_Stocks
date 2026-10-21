// chart-multi.js — 종목 분석 차트 멀티 레이아웃(1·2·4칸): 메인 차트 옆에 다른 종목·다른 봉 미니 차트
// =====================================================
// classic script(모듈 아님). chart.js·chart-ind-picker.js 다음에 로드되고 같은 전역 스코프를 쓴다. 로드 시점 실행문 없음.
// drawChart(item, { svgElement }) 는 보조 SVG 를 받긴 하지만 lastChartGeom·세로 스케일 키·드로잉 레이어·
// 요소 id(chartCrosshair 등)를 전역으로 덮어써 메인 차트의 크로스헤어·드로잉이 미니 칸 좌표로 바뀐다. 그래서 칸은
// 같은 재료(resampleBars·getChartRows·chartIntradayState·chartMaOverlaysSvg·MirYScale)로 가볍게 따로 그린다.
// 상태(칸 수·칸별 종목/봉)는 시장별로 localStorage. 폰(≤768px)은 1칸 고정. 레이아웃 판정은 chart-ind-core.js.

const CHART_LAYOUT_KEY = "mir_chart_layout_v1";
const CHART_MINI_W = 600;
let chartLayout = null;
let chartLayoutMarket = "";
const chartMiniGeoms = [null, null, null];
const chartMiniMemo = [null, null, null];

function chartLayoutStoreKey() {
  return `${CHART_LAYOUT_KEY}:${typeof isKrMarket === "function" && isKrMarket() ? "kr" : "us"}`;
}

function chartLayoutState() {
  const core = window.MirChartInd;
  const mk = chartLayoutStoreKey();
  if (!chartLayout || chartLayoutMarket !== mk) {
    let raw = null;
    try { raw = JSON.parse(window.safeStorage.get(mk) || "null"); } catch (e) { raw = null; }
    chartLayout = core ? core.sanitizeLayout(raw) : { n: 1, cells: [] };
    chartLayoutMarket = mk;
    chartMiniMemo.fill(null);
  }
  return chartLayout;
}

function saveChartLayout() {
  try { window.safeStorage.set(chartLayoutStoreKey(), JSON.stringify(chartLayout)); } catch (e) { /* ignore */ }
}

function chartMultiMobile() {
  return window.matchMedia("(max-width: 768px)").matches;
}

function chartMultiActive() {
  if (!window.MirChartInd || chartMultiMobile()) return false;
  return chartLayoutState().n > 1;
}

function chartMultiBench() {
  const b = typeof etfRsSecondaryBenchmarks === "function" ? etfRsSecondaryBenchmarks() : null;
  return b && b[0] ? b[0][0] : "";
}

function chartMiniTicker(cell) {
  if (!cell || !cell.ticker) return selectedTicker || "";
  if (cell.ticker === "@bench") return chartMultiBench();
  return cell.ticker;
}

function chartMiniItem(ticker) {
  if (!ticker) return null;
  if (ticker === selectedTicker) return currentChartItem();
  const base = stockByTicker(ticker);
  if (!base) return null;
  const key = safeTicker(base.ticker);
  if (key && !detailCache[key] && !detailPromises[key]) {
    loadStockDetail(key).then(() => chartMultiRefresh(true)).catch(() => {});
  }
  return applyLive(withDetail(base));
}

function chartMiniTfOptions(sel) {
  const opts = [["D", "일봉"], ["W", "주봉"], ["M", "월봉"]]
    .concat(Object.keys(CHART_INTRADAY).map((k) => [k, `${CHART_INTRADAY[k].label}봉`]));
  return opts.map(([v, l]) => `<option value="${v}"${v === sel ? " selected" : ""}>${l}</option>`).join("");
}

function setupChartMulti() {
  const wrap = byId("chartMulti");
  if (!wrap || wrap.dataset.bound) return;
  wrap.dataset.bound = "1";
  const L = chartLayoutState();
  const holder = document.createElement("div");
  holder.innerHTML = [0, 1, 2].map((i) => `<div class="chart-mini" data-cell="${i}" hidden>`
    + `<div class="chart-mini-head">`
    + `<input class="chart-mini-ticker" list="tickerOptions" autocomplete="off" placeholder="현재 종목" aria-label="칸 ${i + 2} 종목">`
    + `<select class="chart-mini-tf" aria-label="칸 ${i + 2} 봉">${chartMiniTfOptions(L.cells[i] ? L.cells[i].tf : "D")}</select>`
    + `</div>`
    + `<svg class="chart-mini-svg" viewBox="0 0 ${CHART_MINI_W} 276" role="button" tabindex="0" aria-label="칸 ${i + 2} 메인 차트로 전환"></svg>`
    + `</div>`).join("");
  Array.from(holder.children).forEach((el) => wrap.appendChild(el));

  wrap.querySelectorAll(".chart-mini").forEach((cellEl) => {
    const i = Number(cellEl.dataset.cell);
    const input = cellEl.querySelector(".chart-mini-ticker");
    const sel = cellEl.querySelector(".chart-mini-tf");
    const svg = cellEl.querySelector(".chart-mini-svg");
    const commitTicker = () => {
      const raw = input.value.trim();
      const S = chartLayoutState();
      if (!raw) {
        S.cells[i] = { ...S.cells[i], ticker: "" };
      } else {
        const { ticker, hits } = resolveTickerEntry(raw);
        if (!ticker || !stockByTicker(ticker)) {
          notifyAmbiguousTicker(raw, hits);
          input.value = S.cells[i].ticker ? chartMiniTicker(S.cells[i]) : "";
          return;
        }
        S.cells[i] = { ...S.cells[i], ticker: ticker === selectedTicker ? "" : ticker };
      }
      saveChartLayout();
      chartMultiRefresh(true);
    };
    input.addEventListener("change", commitTicker);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); input.blur(); } });
    sel.addEventListener("change", () => {
      const S = chartLayoutState();
      S.cells[i] = { ...S.cells[i], tf: sel.value };
      saveChartLayout();
      chartMultiRefresh(true);
    });
    let down = null;
    svg.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY }; });
    svg.addEventListener("click", (e) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
      chartMultiSwap(i);
    });
    svg.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); chartMultiSwap(i); }
    });
    svg.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch") return;
      const g = chartMiniGeoms[i];
      if (!g || !g.dates.length) return;
      const rect = svg.getBoundingClientRect();
      if (!rect.width) return;
      const vbX = ((e.clientX - rect.left) / rect.width) * g.width;
      const n = g.dates.length;
      const idx = Math.max(0, Math.min(n - 1, Math.round(((vbX - g.padL) / Math.max(1, g.dataW)) * (n - 1))));
      const d = g.dates[idx];
      drawChartMiniXhair(i, idx);
      chartMultiSyncCrosshair(d, i);
      if (typeof renderChartCrosshairAtDate === "function") renderChartCrosshairAtDate(d);
    });
    svg.addEventListener("pointerleave", () => {
      chartMultiSyncCrosshair(null);
      if (typeof renderChartCrosshairAtDate === "function") renderChartCrosshairAtDate(null);
    });
  });

  const seg = byId("chartLayoutSeg");
  if (seg) {
    seg.addEventListener("click", (e) => {
      const b = e.target.closest("[data-layout]");
      if (!b) return;
      const S = chartLayoutState();
      S.n = Number(b.dataset.layout) || 1;
      chartLayout = window.MirChartInd.sanitizeLayout(S);
      saveChartLayout();
      chartMiniMemo.fill(null);
      redrawChart();
    });
  }
  const mq = window.matchMedia("(max-width: 768px)");
  const onMq = () => { chartMiniMemo.fill(null); redrawChart(); };
  if (mq.addEventListener) mq.addEventListener("change", onMq);
  else if (mq.addListener) mq.addListener(onMq);
}

function syncChartLayoutSeg(n) {
  byId("chartLayoutSeg")?.querySelectorAll("[data-layout]").forEach((b) => {
    const on = Number(b.dataset.layout) === n;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

// 메인 차트를 그릴 때마다(chart.js drawChart 끝) 불린다. 끌기 중(chartPanActive)엔 건너뛰고, 칸마다 입력이
// 그대로면(같은 종목 객체·봉·기간·지표·마지막 봉) 다시 그리지 않는다. force = 끌기 중이어도(데이터 도착).
function chartMultiRefresh(force) {
  const wrap = byId("chartMulti");
  if (!wrap || !window.MirChartInd) return;
  setupChartMulti();
  const active = chartMultiActive();
  const L = chartLayoutState();
  const n = active ? L.n : 1;
  if (wrap.dataset.n !== String(n)) wrap.dataset.n = String(n);
  syncChartLayoutSeg(chartMultiMobile() ? 1 : L.n);
  const count = n === 4 ? 3 : n === 2 ? 1 : 0;
  wrap.querySelectorAll(".chart-mini").forEach((el) => { el.hidden = Number(el.dataset.cell) >= count; });
  if (!count || (chartPanActive && !force)) return;
  for (let i = 0; i < count; i += 1) renderChartMini(i);
}

function chartMiniBarCount(tf, total) {
  if (isIntradayTf(tf)) return Math.min(total, CHART_INTRADAY[tf].view);
  const dailyMap = { "1M": 22, "3M": 66, "6M": 132, "1Y": 252, "5Y": 1260 };
  const div = tf === "W" ? 5 : tf === "M" ? 21 : 1;
  return Math.min(total, Math.max(12, Math.round((dailyMap[chartState.range] || 252) / div)));
}

function chartMiniTickLabel(d, tf, sameDay) {
  const t = String(d || "");
  if (isIntradayTf(tf)) return sameDay ? t.slice(11, 16) : `${Number(t.slice(5, 7))}/${Number(t.slice(8, 10))} ${t.slice(11, 16)}`;
  if (tf === "D" && ["1M", "3M", "6M"].includes(chartState.range)) return `${Number(t.slice(5, 7))}/${Number(t.slice(8, 10))}`;
  return `${t.slice(2, 4)}.${t.slice(5, 7)}`;
}

function renderChartMini(i) {
  const wrap = byId("chartMulti");
  const cellEl = wrap && wrap.querySelector(`.chart-mini[data-cell="${i}"]`);
  if (!cellEl) return;
  const svg = cellEl.querySelector(".chart-mini-svg");
  const input = cellEl.querySelector(".chart-mini-ticker");
  const sel = cellEl.querySelector(".chart-mini-tf");
  const L = chartLayoutState();
  const cell = L.cells[i];
  const tf = cell.tf;
  const ticker = chartMiniTicker(cell);
  if (input && document.activeElement !== input) input.value = cell.ticker ? ticker : "";
  if (sel && sel.value !== tf) sel.value = tf;
  const item = chartMiniItem(ticker);
  let all = [];
  let msg = "";
  if (!item) msg = "데이터 없음";
  else if (isIntradayTf(tf)) {
    const st = chartIntradayState(item, tf);
    all = st.rows;
    if (!all.length) msg = st.status === "loading" ? `${CHART_INTRADAY[tf].label}봉 불러오는 중…` : (st.msg || "데이터 없음");
  } else {
    all = resampleBars(getChartRows(item), tf);
    if (!all.length) msg = "데이터 없음";
  }
  const last = all[all.length - 1];
  const maFlags = ["showSma5", "showSma10", "showSma20", "showSma60", "showSma120", "showEma20", "showEma60"].map((k) => (chartState[k] ? 1 : 0)).join("");
  const sig = [ticker, tf, chartState.range, chartState.chartType, maFlags, JSON.stringify(chartState.indParams || {}), chartState.showVolume ? 1 : 0, all.length, last ? `${last.d}|${last.c}` : "", msg].join("~");
  // 메인 종목은 currentChartItem 캐시 객체, 다른 종목은 상세 캐시 참조로 비교한다(applyLive 는 매번 새 객체).
  const ref = ticker === selectedTicker ? item : (detailCache[safeTicker(ticker)] || null);
  const memo = chartMiniMemo[i];
  if (memo && memo.ref === ref && memo.sig === sig) return;
  chartMiniMemo[i] = { ref, sig };

  const W = CHART_MINI_W;
  const padL = 8;
  const padR = 56;
  const padT = 24;
  const plotH = 190;
  const volGap = 6;
  const volH = chartState.showVolume ? 36 : 0;
  const axisH = 20;
  const H = padT + plotH + (volH ? volGap + volH : 0) + axisH;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  if (msg) {
    chartMiniGeoms[i] = null;
    svg.innerHTML = `<rect x="0" y="0" width="${W}" height="${H}" rx="8" class="chart-bg"></rect>`
      + `<text x="${padL + 4}" y="17" class="chart-label">${escapeHtml(item ? stockLabel(item) : ticker || "-")} · ${escapeHtml(chartTfLabel(tf))}</text>`
      + `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" class="chart-axis">${escapeHtml(msg)}</text>`;
    return;
  }
  const count = chartMiniBarCount(tf, all.length);
  const rows = all.slice(-count);
  const ctx = all.slice(-(count + CHART_IND_WARMUP));
  const plotRows = chartState.chartType === "heikin" ? lastN(heikinAshiRows(ctx), rows.length) : rows;
  const n = rows.length;
  const plotW = W - padL - padR;
  const tools = window.MirChartTools;
  const padBars = tools ? tools.rightPadBars(n) : 0;
  const dataW = n > 1 ? plotW * ((n - 1) / (n - 1 + padBars)) : plotW;
  const xFor = (k) => padL + (k / Math.max(1, n - 1)) * dataW;
  let lo = Math.min(...plotRows.map((r) => r.l));
  let hi = Math.max(...plotRows.map((r) => r.h));
  if (!(hi > lo)) { hi = lo * 1.01 + 1; lo *= 0.99; }
  const padV = (hi - lo) * 0.04;
  lo -= padV;
  hi += padV;
  const yFor = (v) => padT + ((hi - v) / (hi - lo)) * plotH;
  const candleW = Math.max(1.5, Math.min(9, (plotW / n) * 0.62));
  const isLine = chartState.chartType === "line";
  const body = isLine
    ? `<path d="${plotRows.map((r, k) => `${k ? "L" : "M"} ${xFor(k).toFixed(1)} ${yFor(r.c).toFixed(1)}`).join(" ")}" class="chart-line"></path>`
    : plotRows.map((r, k) => {
      const x = xFor(k);
      const yO = yFor(r.o);
      const yC = yFor(r.c);
      return `<g class="${r.c >= r.o ? "candle-up" : "candle-down"}"><line x1="${x.toFixed(1)}" y1="${yFor(r.h).toFixed(1)}" x2="${x.toFixed(1)}" y2="${yFor(r.l).toFixed(1)}"></line><rect x="${(x - candleW / 2).toFixed(1)}" y="${Math.min(yO, yC).toFixed(1)}" width="${candleW.toFixed(1)}" height="${Math.max(1, Math.abs(yC - yO)).toFixed(1)}"></rect></g>`;
    }).join("");
  const clip = (arr) => arr.map((v) => (v == null || !Number.isFinite(v) || v < lo || v > hi ? null : v));
  const ma = chartMaOverlaysSvg(ctx.map((r) => r.c), n, clip, xFor, yFor, 0.8);
  const yt = window.MirYScale.ticks(lo, hi, false, 4);
  const grid = yt.ticks.map((v) => {
    const y = yFor(v);
    return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${padL + plotW}" y2="${y.toFixed(1)}" class="chart-grid"></line><text x="${W - 6}" y="${(y + 4).toFixed(1)}" class="chart-axis" text-anchor="end">${chartAxisPriceLabel(v, yt.step)}</text>`;
  }).join("");
  let vol = "";
  if (volH) {
    const vTop = padT + plotH + volGap;
    const vMax = Math.max(1, ...rows.map((r) => r.v || 0));
    vol = `<rect x="${padL}" y="${vTop}" width="${plotW}" height="${volH}" class="rsi-bg"></rect>` + rows.map((r, k) => {
      const h = Math.max(0.5, ((r.v || 0) / vMax) * volH);
      return `<rect x="${(xFor(k) - candleW / 2).toFixed(1)}" y="${(vTop + volH - h).toFixed(1)}" width="${candleW.toFixed(1)}" height="${h.toFixed(1)}" class="${r.c >= r.o ? "vol-up" : "vol-down"}"></rect>`;
    }).join("");
  }
  const sameDay = String(rows[0].d || "").slice(0, 10) === String(rows[n - 1].d || "").slice(0, 10);
  const tickIdx = n > 2 ? [0, Math.round((n - 1) / 2), n - 1] : [0, n - 1];
  const xLabels = Array.from(new Set(tickIdx)).map((k, j, arr) => `<text x="${xFor(k).toFixed(1)}" y="${(H - 6).toFixed(1)}" text-anchor="${j === 0 ? "start" : j === arr.length - 1 ? "end" : "middle"}" class="chart-axis">${escapeHtml(chartMiniTickLabel(rows[k].d, tf, sameDay))}</text>`).join("");
  const first = rows[0];
  const lastRow = rows[n - 1];
  const prevClose = n > 1 ? rows[n - 2].c : lastRow.o;
  const lastY = yFor(lastRow.c);
  const lastTag = `<g class="chart-last-tag ${lastRow.c >= prevClose ? "is-up" : "is-down"}"><rect x="${(padL + plotW + 2).toFixed(1)}" y="${(lastY - 8).toFixed(1)}" width="${(padR - 4).toFixed(1)}" height="16" rx="3"></rect><text x="${(W - 6).toFixed(1)}" y="${(lastY + 3.5).toFixed(1)}" text-anchor="end">${escapeHtml(chartPriceLabel(lastRow.c))}</text></g>`;
  const title = `${escapeHtml(stockLabel(item))} · ${escapeHtml(chartTfLabel(tf))} · ${escapeHtml(chartPriceLabel(lastRow.c))} · ${escapeHtml(fmtPct(pctFrom(lastRow.c, first.c)))}`;
  chartMiniGeoms[i] = { padL, plotW, dataW, padT, plotH, width: W, height: H, axisBottom: H - axisH, dates: rows.map((r) => r.d), rows: plotRows, yFor, tf };
  svg.innerHTML = `<rect x="0" y="0" width="${W}" height="${H}" rx="8" class="chart-bg"></rect>${grid}${body}${ma}${vol}`
    + `<line x1="${padL}" y1="${padT + plotH}" x2="${padL + plotW}" y2="${padT + plotH}" class="chart-base"></line>`
    + `${xLabels}<text x="${padL + 4}" y="17" class="chart-label">${title}</text>${lastTag}<g class="chart-mini-xhair chart-crosshair"></g>`;
}

function drawChartMiniXhair(i, idx) {
  const wrap = byId("chartMulti");
  const layer = wrap && wrap.querySelector(`.chart-mini[data-cell="${i}"] .chart-mini-xhair`);
  const g = chartMiniGeoms[i];
  if (!layer) return;
  if (!g || idx == null || idx < 0 || !g.rows[idx]) { layer.innerHTML = ""; return; }
  const n = g.dates.length;
  const x = g.padL + (idx / Math.max(1, n - 1)) * g.dataW;
  const bar = g.rows[idx];
  const y = g.yFor(bar.c);
  const xR = g.padL + g.plotW;
  const dateTxt = isIntradayTf(g.tf) ? `${String(bar.d).slice(5, 10)} ${String(bar.d).slice(11, 16)}` : String(bar.d || "").slice(0, 10);
  const dw = Math.max(54, dateTxt.length * 6.4 + 10);
  const dx = Math.max(g.padL, Math.min(xR - dw, x - dw / 2));
  layer.innerHTML = `<line class="chart-xhair" x1="${x.toFixed(1)}" y1="${g.padT}" x2="${x.toFixed(1)}" y2="${g.axisBottom.toFixed(1)}"></line>`
    + (Number.isFinite(y) ? `<g class="chart-xhair-tag"><rect x="${(xR + 2).toFixed(1)}" y="${(y - 8).toFixed(1)}" width="${(g.width - xR - 4).toFixed(1)}" height="16" rx="3"></rect><text x="${(g.width - 6).toFixed(1)}" y="${(y + 3.5).toFixed(1)}" text-anchor="end">${escapeHtml(chartPriceLabel(bar.c))}</text></g>` : "")
    + `<g class="chart-xhair-tag"><rect x="${dx.toFixed(1)}" y="${(g.height - 19).toFixed(1)}" width="${dw.toFixed(1)}" height="17" rx="3"></rect><text x="${(dx + dw / 2).toFixed(1)}" y="${(g.height - 6.5).toFixed(1)}" text-anchor="middle">${escapeHtml(dateTxt)}</text></g>`;
}

// 다른 칸(메인 포함)이 가리킨 시각 d 를 보이는 칸들에 같은 날짜 세로선으로. skip = 지금 가리키는 칸(직접 그림).
function chartMultiSyncCrosshair(d, skip) {
  if (!chartMultiActive()) return;
  const core = window.MirChartInd;
  const L = chartLayoutState();
  const count = L.n === 4 ? 3 : L.n === 2 ? 1 : 0;
  for (let i = 0; i < count; i += 1) {
    if (i === skip) continue;
    const g = chartMiniGeoms[i];
    drawChartMiniXhair(i, d && g && core ? core.barIndexForDate(g.dates, d) : -1);
  }
}

// 칸 클릭 → 그 칸의 종목·봉을 메인으로, 메인의 종목·봉을 그 칸으로(chart-ind-core.js swapWithMain).
function chartMultiSwap(i) {
  const core = window.MirChartInd;
  if (!core || !chartMultiActive()) return;
  const res = core.swapWithMain(chartLayoutState(), i, { ticker: selectedTicker, tf: chartState.barTf, bench: chartMultiBench() });
  const nextTicker = res.main.ticker;
  if (nextTicker !== selectedTicker && !stockByTicker(nextTicker)) return;
  chartLayout = res.layout;
  saveChartLayout();
  chartMiniMemo.fill(null);
  chartState.barTf = res.main.tf;
  chartState.zoom = 1;
  chartState.offset = 0;
  chartIntradayFitPending = isIntradayTf(chartState.barTf);
  syncChartBarTfUi();
  if (nextTicker !== selectedTicker) selectTicker(nextTicker);
  else redrawChart();
}
