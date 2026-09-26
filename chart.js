// chart.js — 가격 차트 엔진(그리기·오버레이·줌/팬·드로잉)
// =====================================================
// app.js 에서 기계적으로 분리한 클래식 스크립트(모듈 아님). index.html 이 app.js 보다
// 먼저 싣고 같은 전역 스코프를 공유한다. 로드 시점 실행문은 window.MirChartOverlays
// 대입 하나뿐이고(참조 없는 순수 대입), 그마저도 예전보다 이르게 실행되므로 안전하다.
// 담는 것: currentChartItem 캐시, 팬/줌, 오버레이 프리셋과 계산(VWAP·PSAR·갭·추세선·
// 시장구조·거래량프로파일), 기술 점수 패널, 차트 컨트롤/프리셋/비교, 포인터 인터랙션,
// 드로잉(추세선·피보) 영속화, drawChart 본체.
// 지표 계산 자체는 chart-indicators.js 가 갖는다 — 여기로 옮기지 말 것.
// 이름 충돌은 scripts/check_global_name_collisions.py 가 감시한다.

// Re-derive the currently shown stock (snapshot + detail + live data).
// 팬/줌 프레임마다 불리므로 (base row · 상세 · 실시간 캐시) 참조가 그대로면 캐시를 돌려준다.
// 상세/실시간 데이터는 도착 시 캐시 객체가 교체되므로 참조 비교만으로 자동 무효화된다.
let _chartItemCache = null;
function currentChartItem() {
  const base = selectedBaseRow();
  if (!base) return null;
  const t = base.ticker;
  const detailRef = detailCache[safeTicker(t)] || detailCache[t] || null;
  const live = [liveChartCache[t], liveNewsCache[t], liveEarningsCache[t], liveSummaryCache[t], liveNewsSourceCache[t]];
  const c = _chartItemCache;
  if (c && c.base === base && c.detailRef === detailRef && c.live.every((v, i) => v === live[i])) return c.item;
  const item = applyLive(withDetail(base));
  _chartItemCache = { base, detailRef, live, item };
  return item;
}

// Redraw only the price chart (no news/facts re-render) — used by zoom/pan/wheel/drag.
function redrawChart() {
  const item = currentChartItem();
  if (item) drawChart(item);
}

// 줌·오프셋 초기화. '초기화' 버튼, 차트 더블클릭, 터치 더블탭이 모두 이 함수를 부른다.
// 세로 축도 자동 맞춤으로 돌린다(로그 여부는 사용자 선택이라 유지).
function resetChartView() {
  chartState = { ...chartState, zoom: 1, offset: 0 };
  chartYScale = window.MirYScale.withAuto(chartYScale);
  redrawChart();
}

// ===== 가격 축 세로 스케일(TradingView 식) =====
// 계산은 chart-yscale-core.js(window.MirYScale) 가 하고 여기는 상태·이벤트만 붙인다.
// auto=true 면 지금처럼 보이는 봉의 고가·저가로 맞추고, 가격 축을 드래그·휠하면 수동(min/max)
// 으로 바뀐다. 종목·기간·봉이 바뀌면(chartYScaleKey) 자동 맞춤으로 돌아간다.
let chartYScale = { auto: true, log: false, min: null, max: null };
let chartYScaleKey = "";

function setChartYAuto() {
  if (chartYScale.auto) return;
  chartYScale = window.MirYScale.withAuto(chartYScale);
  redrawChart();
}

function toggleChartYLog() {
  chartYScale = window.MirYScale.withLog(chartYScale, !chartYScale.log);
  redrawChart();
}

// 현재 화면 범위를 기준으로 수동 범위를 만든다(처음 조작하는 순간 자동 → 수동).
function chartYCurrentRange() {
  const g = lastChartGeom;
  return g ? { min: g.min, max: g.max } : null;
}

function chartYAutoRef() {
  const g = lastChartGeom;
  return g && Number.isFinite(g.autoMin) ? { min: g.autoMin, max: g.autoMax } : null;
}

function setChartYManual(range) {
  if (!range || !window.MirYScale.validRange(range, chartYScale.log)) return;
  chartYScale = window.MirYScale.withManual(chartYScale, range);
}

// 명령바(보기 그룹)의 '자동'·'로그' 버튼 상태를 맞춘다. SVG 모서리 버튼은 drawChart 가 그린다.
function syncChartYScaleButtons() {
  const autoBtn = byId("chartYAuto");
  const logBtn = byId("chartYLog");
  if (autoBtn) {
    autoBtn.classList.toggle("is-active", chartYScale.auto);
    autoBtn.setAttribute("aria-pressed", chartYScale.auto ? "true" : "false");
  }
  if (logBtn) {
    logBtn.classList.toggle("is-active", chartYScale.log);
    logBtn.setAttribute("aria-pressed", chartYScale.log ? "true" : "false");
  }
}

// 가격 축 눈금 라벨: 눈금은 간격(step)의 배수라 소수 자리를 간격에 맞춘다 — 세로로 크게
// 확대하면 $0.5 간격인데 "$150" 으로 겹쳐 찍히거나, $10 간격인데 "$45.0" 처럼 군더더기가
// 붙지 않게. 원화는 1원 미만 간격일 때만 소수를 쓴다.
function chartAxisPriceLabel(value, step) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  if (!(step > 0)) return chartPriceLabel(n);
  const dec = Math.min(4, window.MirYScale.stepDecimals(step));
  if (isKrMarket()) return n.toLocaleString("ko-KR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
}

let chartPanActive = false;
let chartPanRafId = 0;
let patternConfirmCache = { ticker: "", len: 0, lastD: "", data: null };
let lastTechLevelsOverlay = null;

function invalidatePatternConfirmCache() {
  patternConfirmCache = { ticker: "", len: 0, lastD: "", data: null };
}

function getCachedPatternConfirmations(ticker, dailyRows) {
  const n = dailyRows.length;
  const lastD = dailyRows[n - 1]?.d || "";
  if (patternConfirmCache.ticker === ticker && patternConfirmCache.len === n && patternConfirmCache.lastD === lastD) {
    return patternConfirmCache.data;
  }
  const data = window.MirProb.detectConfirmations(dailyRows);
  patternConfirmCache = { ticker, len: n, lastD, data };
  return data;
}

function scheduleChartPanRedraw() {
  if (chartPanRafId) return;
  chartPanRafId = requestAnimationFrame(() => {
    chartPanRafId = 0;
    redrawChart();
  });
}

function endChartPan() {
  chartPanActive = false;
  if (chartPanRafId) {
    cancelAnimationFrame(chartPanRafId);
    chartPanRafId = 0;
  }
  redrawChart();
}

function ctxIdxForVisibleRow(ctxRows, visRow) {
  if (!visRow?.d) return -1;
  for (let i = ctxRows.length - 1; i >= 0; i -= 1) {
    if (ctxRows[i].d === visRow.d) return i;
  }
  return -1;
}

function volumeProfileOverlayLines(rows) {
  const fn = window.MirProb && window.MirProb.volumeProfileNodes;
  if (!fn) return [];
  const nodes = fn(rows);
  if (!nodes.length) return [];
  const sorted = nodes.slice().sort((a, b) => b.vol - a.vol);
  const poc = sorted[0];
  const lines = [{ price: poc.price, label: "POC", color: "#eab308", weight: 2 }];
  sorted.slice(1, 4).forEach((node, i) => {
    if (node.vol >= poc.vol * 0.45) {
      lines.push({ price: node.price, label: `HVN${i + 1}`, color: "#94a3b8", weight: 1 });
    }
  });
  return lines;
}

function detectUnfilledGapZones(rows, minPct = 0.003) {
  const gaps = [];
  for (let i = 1; i < rows.length; i += 1) {
    const prev = rows[i - 1];
    const cur = rows[i];
    let zone = null;
    if (cur.l > prev.h * (1 + minPct)) zone = { type: "up", lo: prev.h, hi: cur.l, startIdx: i - 1 };
    else if (cur.h < prev.l * (1 - minPct)) zone = { type: "down", lo: cur.h, hi: prev.l, startIdx: i - 1 };
    if (!zone) continue;
    let filled = false;
    // 갭 발생 봉(i) 자신은 존 경계(zone.hi = cur.l 등)에 항상 닿아 있다 — j=i 로 돌면
    // 모든 갭이 즉시 '메움' 처리돼 오버레이가 영영 비었다(analysis.js:169 와 같은 규칙).
    for (let j = i + 1; j < rows.length; j += 1) {
      if (rows[j].l <= zone.hi && rows[j].h >= zone.lo) { filled = true; break; }
    }
    if (!filled) gaps.push(zone);
  }
  return gaps.slice(-4);
}

function computeAutoTrendlines(rows, win = 3) {
  const pivots = [];
  for (let i = win; i < rows.length - win; i += 1) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - win; j <= i + win; j += 1) {
      if (j === i) continue;
      if (rows[j].h >= rows[i].h) isHigh = false;
      if (rows[j].l <= rows[i].l) isLow = false;
    }
    if (isHigh) pivots.push({ idx: i, price: rows[i].h, type: "H" });
    if (isLow) pivots.push({ idx: i, price: rows[i].l, type: "L" });
  }
  const lines = [];
  const highs = pivots.filter((p) => p.type === "H").slice(-3);
  const lows = pivots.filter((p) => p.type === "L").slice(-3);
  if (highs.length >= 2) {
    const a = highs[highs.length - 2];
    const b = highs[highs.length - 1];
    lines.push({ kind: "res", x1: a.idx, y1: a.price, x2: b.idx, y2: b.price, color: "#f87171" });
  }
  if (lows.length >= 2) {
    const a = lows[lows.length - 2];
    const b = lows[lows.length - 1];
    lines.push({ kind: "sup", x1: a.idx, y1: a.price, x2: b.idx, y2: b.price, color: "#4ade80" });
  }
  return lines;
}

// AI 모드 차트(cosmos) 오버레이 계산: 바 배열({o,h,l,c,v,d})에서 지지/저항·추세선·
// 기하학적 차트 패턴을 산출한다. 종목 분석 탭과 "동일한" 엔진/데이터 구조를 재사용해
// (supportResistanceLevels·computeAutoTrendlines·getCachedPatternConfirmations)
// 분석 페이지 차트와 같은 오버레이가 나오도록 한다. ai-mode-welcome이 morphToChart에 넘김.
window.MirChartOverlays = function (bars, ticker) {
  const P = window.MirProb || {};
  const empty = { sr: [], trendlines: [], patterns: [], totalBars: (bars || []).length };
  if (!Array.isArray(bars) || bars.length < 12) return empty;
  let sr = [], trendlines = [], patterns = [];
  // 지지/저항: 리치 레벨 객체(price/hi/lo/type/tier) 그대로 — 분석 탭과 동일.
  try { sr = (P.supportResistanceLevels ? P.supportResistanceLevels(bars) : []) || []; } catch (_) {}
  // 추세선: 분석 탭과 동일한 자동 추세선({kind,x1,y1,x2,y2,color}).
  try { trendlines = computeAutoTrendlines(bars) || []; } catch (_) {}
  // 차트 패턴: 분석 탭과 동일한 기하학적 패턴(points/lines/necklinePts). 캔들패턴 아님.
  try {
    const labels = P.patternLabels || {};
    const enabled = chartState.patternTypes || {};
    patterns = (typeof getCachedPatternConfirmations === "function" ? getCachedPatternConfirmations(ticker || "", bars) : [])
      .filter((p) => p.points || p.lines)
      .filter((p) => { const c = patternCategory(p.pattern); return c && enabled[c] !== false; })
      .sort((a, b) => b.confirm_idx - a.confirm_idx)
      .slice(0, 3)
      .map((p) => ({
        dir: p.dir, pattern: p.pattern, name: labels[p.pattern] || p.pattern,
        points: p.points || [], lines: p.lines || [], necklinePts: p.necklinePts || null,
      }));
  } catch (_) {}
  return { sr, trendlines, patterns, totalBars: bars.length };
};

function renderPsarDots(psarValues, ctxRows, rows, xFor, overlayYFor) {
  if (!psarValues || !psarValues.length) return "";
  let out = "";
  for (let i = 0; i < rows.length; i += 1) {
    const gi = ctxIdxForVisibleRow(ctxRows, rows[i]);
    const v = gi >= 0 ? psarValues[gi] : null;
    if (v == null) continue;
    const x = xFor(i);
    const y = overlayYFor(v);
    const up = rows[i].c >= v;
    out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="${up ? "var(--pos)" : "var(--neg)"}" opacity="0.9"></circle>`;
  }
  return out;
}

function heikinAshiRows(rows) {
  const out = [];
  let prev = null;
  for (const r of rows) {
    const haC = (r.o + r.h + r.l + r.c) / 4;
    const haO = prev ? (prev.o + prev.c) / 2 : (r.o + r.c) / 2;
    const haH = Math.max(r.h, haO, haC);
    const haL = Math.min(r.l, haO, haC);
    const bar = { o: haO, h: haH, l: haL, c: haC, v: r.v, d: r.d };
    out.push(bar);
    prev = bar;
  }
  return out;
}

function computeMarketStructureLabels(rows, win = 3) {
  const pivots = [];
  for (let i = win; i < rows.length - win; i += 1) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - win; j <= i + win; j += 1) {
      if (j === i) continue;
      if (rows[j].h >= rows[i].h) isHigh = false;
      if (rows[j].l <= rows[i].l) isLow = false;
    }
    if (isHigh) pivots.push({ idx: i, price: rows[i].h, type: "H" });
    if (isLow) pivots.push({ idx: i, price: rows[i].l, type: "L" });
  }
  pivots.sort((a, b) => a.idx - b.idx);
  let lastHigh = null;
  let lastLow = null;
  const labels = [];
  for (const p of pivots) {
    if (p.type === "H") {
      const lbl = lastHigh == null ? "H" : p.price >= lastHigh ? "HH" : "LH";
      lastHigh = p.price;
      labels.push({ ...p, label: lbl });
    } else {
      const lbl = lastLow == null ? "L" : p.price >= lastLow ? "HL" : "LL";
      lastLow = p.price;
      labels.push({ ...p, label: lbl });
    }
  }
  return labels.slice(-8);
}

function anchoredVwapOverlays(allRows, item) {
  const anchors = [];
  const n = allRows.length;
  if (n < 10) return [];
  let swingIdx = Math.max(0, n - 60);
  let swingPrice = Infinity;
  for (let i = Math.max(0, n - 80); i < n; i += 1) {
    if (allRows[i].l < swingPrice) { swingPrice = allRows[i].l; swingIdx = i; }
  }
  anchors.push({ idx: swingIdx, label: "스윙저", color: "#38bdf8" });
  const f = (window.MAP_FUNDAMENTALS || {})[item.ticker] || {};
  const findNear = (target) => {
    if (!Number.isFinite(target)) return -1;
    let best = -1;
    let bestDiff = Infinity;
    for (let i = 0; i < n; i += 1) {
      const diff = Math.abs(allRows[i].c - target);
      if (diff < bestDiff) { bestDiff = diff; best = i; }
    }
    return bestDiff < target * 0.06 ? best : -1;
  };
  const iLo = findNear(Number(f.low52));
  const iHi = findNear(Number(f.high52));
  if (iLo >= 0) anchors.push({ idx: iLo, label: "52주저", color: "#22c55e" });
  if (iHi >= 0) anchors.push({ idx: iHi, label: "52주고", color: "#f87171" });
  const seen = new Set();
  return anchors.filter((a) => {
    if (seen.has(a.idx)) return false;
    seen.add(a.idx);
    return true;
  }).map((a) => ({
    label: a.label,
    color: a.color,
    startIdx: a.idx,
    vwap: vwapArray(allRows.slice(a.idx)),
  }));
}

// 내장 프리셋(스윙·데이·수급)은 토글이다: 같은 버튼을 다시 누르면 프리셋을 적용하기
// 직전의 오버레이 상태로 되돌리고 활성 표시를 끈다. 다른 프리셋을 누르면 먼저 되돌린 뒤
// 새 프리셋을 얹는다(프리셋끼리 설정이 겹쳐 쌓이지 않도록).
let activeBuiltinPreset = null;
let builtinPresetRestore = null;

function syncBuiltinPresetButtons() {
  byId("chartBuiltinPresets")?.querySelectorAll("[data-bpreset]").forEach((btn) => {
    const active = btn.dataset.bpreset === activeBuiltinPreset;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
}

function applyBuiltinOverlayPreset(key) {
  const preset = BUILTIN_OVERLAY_PRESETS[key];
  if (!preset) return;
  const wasActive = activeBuiltinPreset === key;
  if (activeBuiltinPreset && builtinPresetRestore) Object.assign(chartState, builtinPresetRestore);
  activeBuiltinPreset = null;
  builtinPresetRestore = null;
  if (!wasActive) {
    builtinPresetRestore = Object.fromEntries(Object.keys(preset.settings).map((k) => [k, chartState[k]]));
    Object.assign(chartState, preset.settings);
    activeBuiltinPreset = key;
  }
  syncBuiltinPresetButtons();
  syncChartControlUi();
  syncCprobChartControlChips();
  redrawChart();
}

function syncChartOverlayCheckboxes() {
  ["showSma20", "showSma60", "showSupportResistance", "showPatterns", "showTechLevels",
    "showVolumeProfile", "showTrendlines", "showGapZones", "showTtmSqueeze",
    "showMarketStructure", "showChandelier", "showAnchoredVwap"].forEach((id) => {
    const el = byId(id);
    if (el) el.checked = chartState[id];
  });
}

function snapshotChartOverlaysForProb() {
  chartProbOverlaySnapshot = {
    showSma20: chartState.showSma20,
    showSma60: chartState.showSma60,
    showSupportResistance: chartState.showSupportResistance,
    showTechLevels: chartState.showTechLevels,
    techLevelTypes: { ...chartState.techLevelTypes },
    showVolumeProfile: chartState.showVolumeProfile,
    showTrendlines: chartState.showTrendlines,
    showGapZones: chartState.showGapZones,
    showTtmSqueeze: chartState.showTtmSqueeze,
    showMarketStructure: chartState.showMarketStructure,
    showChandelier: chartState.showChandelier,
    showAnchoredVwap: chartState.showAnchoredVwap,
    showPatterns: chartState.showPatterns,
    patternTypes: { ...chartState.patternTypes },
  };
}

function restoreChartOverlaysFromProb() {
  const snap = chartProbOverlaySnapshot;
  if (!snap) {
    chartState.showSupportResistance = false;
    chartState.showTechLevels = false;
    chartState.showVolumeProfile = false;
    chartState.showTrendlines = false;
    chartState.showGapZones = false;
    chartState.showTtmSqueeze = false;
    chartState.showMarketStructure = false;
    chartState.showChandelier = false;
    chartState.showAnchoredVwap = false;
    chartState.showPatterns = false;
    chartState.lastProbResult = null;
    syncChartOverlayCheckboxes();
    return;
  }
  chartState.showSma20 = snap.showSma20;
  chartState.showSma60 = snap.showSma60;
  chartState.showSupportResistance = snap.showSupportResistance;
  chartState.showTechLevels = snap.showTechLevels ?? false;
  chartState.techLevelTypes = { ...chartState.techLevelTypes, ...(snap.techLevelTypes || {}) };
  chartState.showVolumeProfile = snap.showVolumeProfile ?? false;
  chartState.showTrendlines = snap.showTrendlines ?? false;
  chartState.showGapZones = snap.showGapZones ?? false;
  chartState.showTtmSqueeze = snap.showTtmSqueeze ?? false;
  chartState.showMarketStructure = snap.showMarketStructure ?? false;
  chartState.showChandelier = snap.showChandelier ?? false;
  chartState.showAnchoredVwap = snap.showAnchoredVwap ?? false;
  chartState.showPatterns = snap.showPatterns;
  chartState.patternTypes = { ...snap.patternTypes };
  chartProbOverlaySnapshot = null;
  syncChartOverlayCheckboxes();
}

// ===== 차트 기술 점수 분석 (analysis.js 엔진 재사용) =====
// 2026-09-15: 점수는 예측 확률이 아니라 지표 투표의 가중합(0~100)이다. '확률' 표기 금지.
let chartProbHorizon = 20; // 5=1주, 20=1개월, 60=3개월
let chartProbStatsMode = "population"; // population | individual
let chartProbPanelOpen = false;
let chartProbOverlaySnapshot = null;
const watchPatternCache = new Map(); // ticker → [{ pattern, label, barsAgo }]
const patternScreenerCache = new Map(); // ticker → string[] patterns

function buildChartProbPanel(result) {
  const hz = [[5, "1주"], [20, "1개월"], [60, "3개월"]];
  const btns = hz.map(([k, l]) =>
    `<button type="button" class="cprob-hz${k === chartProbHorizon ? " is-active" : ""}" data-cphz="${k}">${l}</button>`).join("");
  const statsBtns = [["population", "전체 통계"], ["individual", "종목 실측"]].map(([k, l]) =>
    `<button type="button" class="cprob-hz cprob-stats-btn${k === chartProbStatsMode ? " is-active" : ""}" data-cpstats="${k}">${l}</button>`).join("");
  const toolbar = `<div class="cprob-toolbar">
      <span class="cprob-title">기술 점수 분석</span>
      <div class="cprob-hz-group" role="group" aria-label="예측 기간">${btns}</div>
      <div class="cprob-hz-group" role="group" aria-label="패턴 통계 기준">${statsBtns}</div>
    </div>`;
  // 결론(판정·브리핑·확률)이 먼저 보여야 한다. 차트에 무엇을 그릴지 고르는 토글
  // 51개는 결과 아래 접힌 섹션으로 둔다(2026-09-04: 토글이 결론 위에 3줄로
  // 나열돼 주요 기능이 설정 화면처럼 보였다).
  return toolbar + window.MirProb.buildResultHTML(result) + `<div id="cprobChartControls"></div>`;
}

function bindChartProbHorizon() {
  const panel = byId("chartProbPanel");
  if (!panel || panel.dataset.hzBound) return;
  panel.dataset.hzBound = "1";
  panel.addEventListener("click", (event) => {
    const hzBtn = event.target.closest(".cprob-hz[data-cphz]");
    if (hzBtn) {
      chartProbHorizon = Number(hzBtn.dataset.cphz);
      runChartProbAnalysis();
      return;
    }
    const stBtn = event.target.closest(".cprob-stats-btn[data-cpstats]");
    if (stBtn) {
      chartProbStatsMode = stBtn.dataset.cpstats;
      runChartProbAnalysis();
    }
  });
}

// 패턴 → 종류(체크박스 카테고리) 매핑.
function patternCategory(p) {
  if (p === "hns" || p === "inv_hns" || p === "complex_hns") return p === "complex_hns" ? "complex_hns" : "hns";
  if (p === "double_top" || p === "double_bottom" || p === "two_b_bottom" || p === "two_b_top") return p.startsWith("two_b") ? "reversal" : "double";
  if (p === "ascending_triangle" || p === "descending_triangle" || p === "symmetrical_triangle") return "triangle";
  if (p === "falling_wedge" || p === "rising_wedge") return "wedge";
  if (p === "box_breakout" || p === "box_breakdown") return "box";
  if (p === "bull_flag" || p === "bear_flag") return "flag";
  if (p === "bull_pennant" || p === "bear_pennant") return "pennant";
  if (p === "triple_top" || p === "triple_bottom") return "triple";
  if (p === "broadening_triangle") return "broadening";
  if (p === "diamond_top" || p === "diamond_bottom") return "diamond";
  if (p === "rounding_bottom" || p === "cup_and_handle") return p === "cup_and_handle" ? "cup" : "rounding";
  if (p === "ascending_channel_breakout" || p === "descending_channel_breakout") return "channel";
  if (p === "reversal_123_up" || p === "reversal_123_down") return "reversal";
  if (p === "bull_trap" || p === "bear_trap") return "trap";
  if (/gap|island/.test(p)) return "gap";
  if (p === "volume_climax_up" || p === "volume_climax_down") return "volume";
  if (/nr4|inside_bar/.test(p)) return "squeeze";
  if (/harmonic/.test(p)) return "harmonic";
  if (/engulfing|hammer|shooting_star|doji|morning_star|evening_star|soldiers|crows|piercing|dark_cloud/.test(p)) return "candle";
  if (p === "resistance_breakout" || p === "support_breakdown") return "breakout";
  return null;
}

const CHART_OVERLAY_LABELS = [
  ["showSma20", "SMA20"], ["showSma60", "SMA60"], ["showSupportResistance", "지지/저항"],
  ["showVolumeProfile", "VP(POC/HVN)"], ["showTrendlines", "추세선"], ["showGapZones", "갭 존"],
  ["showMarketStructure", "시장구조"], ["showChandelier", "Chandelier"], ["showAnchoredVwap", "앵커 VWAP"],
  ["showTtmSqueeze", "TTM Squeeze"],
];
const BUILTIN_OVERLAY_PRESETS = {
  swing: {
    label: "스윙",
    settings: {
      showSma20: true, showSma60: true, showSupportResistance: true, showTrendlines: true,
      showVolumeProfile: true, showGapZones: true, showMarketStructure: true, showPatterns: true,
      showTechLevels: false, showVwap: false, showCmf: false, showMfi: false, showTtmSqueeze: false,
    },
  },
  day: {
    label: "데이",
    settings: {
      showVwap: true, showVolume: true, showVolMa20: true, showTtmSqueeze: true,
      showBoll: true, showChandelier: true, showGapZones: true, showAnchoredVwap: true,
      showSma20: false, showSma60: false, showTrendlines: false,
    },
  },
  flow: {
    label: "수급",
    settings: {
      showObv: true, showCmf: true, showMfi: true, showAd: true, showVolumeProfile: true,
      showVolume: true, showVolMa20: true, showAnchoredVwap: false, showTrendlines: false,
    },
  },
};
const TECH_LEVEL_LABELS = [
  ["pivot", "Pivot (P)"], ["r1", "R1"], ["r2", "R2"], ["s1", "S1"], ["s2", "S2"],
  ["fib0", "Fib 0%"], ["fib236", "Fib 23.6%"], ["fib382", "Fib 38.2%"], ["fib50", "Fib 50%"],
  ["fib618", "Fib 61.8%"], ["fib100", "Fib 100%"],
  ["stop", "−2ATR"], ["tgt", "+2ATR"], ["tgt2", "+4ATR"],
  ["lrUpper", "LR+"], ["lrLower", "LR-"], ["psar", "PSAR"],
];
const FIB_LEVEL_KEYS = {
  fib0: "0%", fib236: "23.6%", fib382: "38.2%", fib50: "50%", fib618: "61.8%", fib100: "100%",
};
// 결과 패널의 ② 카드 안에 종류별 '차트에 패턴 표시' 체크박스를 넣고 차트 오버레이를 제어.
const PATTERN_TYPE_LABELS = [
  ["hns", "헤드앤숄더"], ["double", "쌍바닥/쌍천장"], ["triangle", "삼각수렴"], ["wedge", "쐐기형"],
  ["box", "박스권"], ["flag", "깃발형"], ["pennant", "페넌트"], ["triple", "삼중 천장/바닥"],
  ["broadening", "확산형"], ["diamond", "다이아몬드"], ["rounding", "라운딩"], ["complex_hns", "복합 H&S"],
  ["cup", "컵앤핸들"], ["channel", "채널"], ["reversal", "1-2-3/2B"], ["trap", "가짜돌파"],
  ["gap", "갭"], ["volume", "거래량"], ["squeeze", "NR4/인사이드"], ["harmonic", "하모닉"],
  ["candle", "캔들"], ["breakout", "지지/저항 돌파"],
];
function syncCprobChartControlChips() {
  const host = byId("cprobChartControls");
  if (!host || !host.querySelector("input[data-overlay]")) return;
  host.querySelectorAll("input[data-overlay]").forEach((cb) => {
    cb.checked = Boolean(chartState[cb.dataset.overlay]);
  });
  host.querySelectorAll("input[data-tl]").forEach((cb) => {
    cb.checked = Boolean(chartState.showTechLevels && chartState.techLevelTypes[cb.dataset.tl]);
  });
  host.querySelectorAll("input[data-pt]").forEach((cb) => {
    cb.checked = Boolean(chartState.patternTypes[cb.dataset.pt]);
  });
}

function fillCprobChartControls() {
  const host = byId("cprobChartControls");
  if (!host) return;
  const overlayBoxes = CHART_OVERLAY_LABELS.map(([k, l]) =>
    `<label class="cprob-chip"><input type="checkbox" data-overlay="${k}"${chartState[k] ? " checked" : ""}><span>${l}</span></label>`).join("");
  const levelBoxes = TECH_LEVEL_LABELS.map(([k, l]) =>
    `<label class="cprob-chip"><input type="checkbox" data-tl="${k}"${chartState.showTechLevels && chartState.techLevelTypes[k] ? " checked" : ""}><span>${l}</span></label>`).join("");
  const pt = chartState.patternTypes;
  const patternBoxes = PATTERN_TYPE_LABELS.map(([k, l]) =>
    `<label class="cprob-chip"><input type="checkbox" data-pt="${k}"${pt[k] ? " checked" : ""}><span>${l}</span></label>`).join("");
  host.innerHTML = `<details class="cprob-chart-toggles">
    <summary>차트에 표시할 요소 <span class="muted">오버레이 · 레벨선 · 패턴</span></summary>
    <div class="cprob-chart-toggle">
      <span class="cprob-toggle-title">차트 오버레이</span>
      <div class="cprob-checkbox-group" role="group" aria-label="차트 오버레이">${overlayBoxes}</div>
    </div>
    <div class="cprob-chart-toggle">
      <span class="cprob-toggle-title">기술 레벨선</span>
      <div class="cprob-checkbox-group" role="group" aria-label="기술 레벨선">${levelBoxes}</div>
    </div>
    <div class="cprob-chart-toggle">
      <span class="cprob-toggle-title">차트 패턴</span>
      <div class="cprob-checkbox-group" role="group" aria-label="차트 패턴">${patternBoxes}</div>
    </div>
  </details>`;
  host.querySelectorAll("input[data-overlay]").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const id = e.target.dataset.overlay;
      chartState[id] = e.target.checked;
      const mirror = byId(id);
      if (mirror) mirror.checked = e.target.checked;
      redrawChart();
    });
  });
  host.querySelectorAll("input[data-tl]").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      chartState.techLevelTypes[e.target.dataset.tl] = e.target.checked;
      chartState.showTechLevels = Object.values(chartState.techLevelTypes).some(Boolean);
      syncChartOverlayCheckboxes();
      redrawChart();
    });
  });
  host.querySelectorAll("input[data-pt]").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      chartState.patternTypes[e.target.dataset.pt] = e.target.checked;
      chartState.showPatterns = Object.values(chartState.patternTypes).some(Boolean);
      syncChartOverlayCheckboxes();
      redrawChart();
    });
  });
}

function setChartProbBtnActive(active) {
  const probBtn = byId("chartProbBtn");
  if (probBtn) probBtn.classList.toggle("is-active", !!active);
}

function closeChartProbPanel() {
  const panel = byId("chartProbPanel");
  if (!panel) return;
  chartProbPanelOpen = false;
  panel.hidden = true;
  panel.innerHTML = "";
  chartState.lastProbResult = null;
  lastTechLevelsOverlay = null;
  restoreChartOverlaysFromProb();
  setChartProbBtnActive(false);
  redrawChart();
}

function toggleChartProbAnalysis() {
  const panel = byId("chartProbPanel");
  if (panel && chartProbPanelOpen && !panel.hidden) {
    closeChartProbPanel();
    return;
  }
  runChartProbAnalysis();
}

// "기술 점수 분석" 버튼: 이동평균선+지지/저항을 켜고, 엔진으로 기술 점수를 계산해 패널에 표시.
function runChartProbAnalysis() {
  const panel = byId("chartProbPanel");
  if (!panel) return;
  if (!window.MirProb) {
    chartProbPanelOpen = true;
    panel.hidden = false;
    setChartProbBtnActive(true);
    panel.innerHTML = '<div class="notice err">분석 엔진을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.</div>';
    return;
  }
  const item = currentChartItem();
  if (!item) {
    chartProbPanelOpen = true;
    panel.hidden = false;
    setChartProbBtnActive(true);
    panel.innerHTML = '<div class="notice">먼저 종목을 검색해 차트를 띄워 주세요.</div>';
    return;
  }
  if (!chartProbOverlaySnapshot) snapshotChartOverlaysForProb();
  // 디폴트 오버레이: SMA20·60 + 지지/저항 + 추세선. 기술 레벨선은 전부 비활성화,
  // 차트 패턴은 전부 활성화.
  chartState.showSma20 = true;
  chartState.showSma60 = true;
  chartState.showSupportResistance = true;
  chartState.showTrendlines = true;
  chartState.showTechLevels = false;
  chartState.techLevelTypes = Object.fromEntries(TECH_LEVEL_LABELS.map(([k]) => [k, false]));
  chartState.showPatterns = true;
  Object.keys(chartState.patternTypes || {}).forEach((k) => { chartState.patternTypes[k] = true; });
  ["showSma20", "showSma60", "showSupportResistance", "showTrendlines", "showPatterns"].forEach((id) => {
    const el = byId(id);
    if (el) el.checked = true;
  });
  const techEl = byId("showTechLevels");
  if (techEl) techEl.checked = false;
  redrawChart();

  chartProbPanelOpen = true;
  setChartProbBtnActive(true);
  panel.hidden = false;
  panel.innerHTML = '<div class="notice">분석 중…</div>';
  Promise.all([window.MirProb.ensureStats(), ensureAnalysisFeatureData()]).then(() => {
    const rows = getChartRows(item); // 전체 일봉(백테스트·패턴에 5년 이력 사용)
    const result = window.MirProb.analyzeRows(rows, chartProbHorizon, {
      ticker: item.ticker, company: item.company, statsMode: chartProbStatsMode,
    });
    if (result.patterns && result.patterns.length) {
      watchPatternCache.set(item.ticker, result.patterns.map((p) => ({
        pattern: p.pattern, label: p.label, barsAgo: p.barsAgo,
      })));
    }
    chartState.lastProbResult = result;
    invalidatePatternConfirmCache();
    lastTechLevelsOverlay = null;
    panel.innerHTML = buildChartProbPanel(result);
    bindChartProbHorizon();
    fillCprobChartControls();
    redrawChart();
  }).catch(() => {
    panel.innerHTML = '<div class="notice err">분석 중 오류가 발생했습니다.</div>';
  });
}

// Number of bars available for the active range (matches visibleChartRows logic).
function chartBaseLength(item) {
  const rows = resampleBars(getChartRows(item), chartState.barTf);
  return rangeBarCount(rows.length);
}

// Set an absolute zoom, keeping the bar at `frac` (0 left … 1 right) anchored.
function setZoomAnchored(frac, requestedZoom) {
  const item = currentChartItem();
  if (!item) return;
  const n = chartBaseLength(item);
  const minWindow = 16;
  const oldWindow = Math.max(minWindow, Math.floor(n / chartState.zoom));
  const oldStart = Math.max(0, n - chartState.offset - oldWindow);
  const anchor = oldStart + frac * (oldWindow - 1);
  const newZoom = Math.min(40, Math.max(1, requestedZoom));
  const newWindow = Math.max(minWindow, Math.floor(n / newZoom));
  let newStart = Math.round(anchor - frac * (newWindow - 1));
  newStart = Math.max(0, Math.min(Math.max(0, n - newWindow), newStart));
  chartState.zoom = newZoom;
  chartState.offset = Math.max(0, n - newWindow - newStart);
  redrawChart();
}

function zoomChartAt(frac, factor) {
  setZoomAnchored(frac, chartState.zoom * factor);
}

// Narrower viewBox on phones gives the chart a taller, more readable aspect ratio.
function priceChartGeom() {
  return window.matchMedia("(max-width: 768px)").matches
    ? { width: 480, padL: 42, padR: 46 }
    : { width: 860, padL: 54, padR: 58 };
}

function setupChartControls() {
  byId("rangeControls").querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      chartState.range = button.dataset.range;
      chartState.zoom = 1;
      chartState.offset = 0;
      byId("rangeControls").querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item === button));
      redrawChart();
    });
  });
  byId("chartZoomIn").addEventListener("click", () => zoomChartAt(0.5, 1.35));
  byId("chartZoomOut").addEventListener("click", () => zoomChartAt(0.5, 1 / 1.35));
  byId("chartPanLeft").addEventListener("click", () => {
    chartState.offset += Math.max(5, Math.round(12 / chartState.zoom));
    redrawChart();
  });
  byId("chartPanRight").addEventListener("click", () => {
    chartState.offset = Math.max(0, chartState.offset - Math.max(5, Math.round(12 / chartState.zoom)));
    redrawChart();
  });
  byId("chartReset").addEventListener("click", resetChartView);
  const tfControls = byId("barTimeframeControls");
  if (tfControls) {
    tfControls.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        chartState.barTf = btn.dataset.tf;
        chartState.zoom = 1;
        chartState.offset = 0;
        tfControls.querySelectorAll("button").forEach((b) => b.classList.toggle("is-active", b === btn));
        redrawChart();
      });
    });
  }
  ["showSma5", "showSma10", "showSma20", "showSma60", "showSma120",
   "showEma20", "showEma60", "showBoll", "showVwap", "showSupertrend", "showIchimoku", "showKeltner", "showDonchian", "showSupportResistance", "showTechLevels", "showPatterns",
   "showVolume", "showVolMa20", "showVolumeRatio", "showObv", "showAd",
   "showRsi", "showMacd", "showStoch", "showRoc", "showMomentum", "showWilliams", "showAtr", "showAdx", "showCci", "showCmf", "showMfi",
   "showVolumeProfile", "showTrendlines", "showGapZones", "showTtmSqueeze",
   "showMarketStructure", "showChandelier", "showAnchoredVwap",
   "showRsSpy", "showRsQqq", "showRsSector", "showMansfield"].forEach((id) => {
    const el = byId(id);
    if (el) el.addEventListener("change", (event) => {
      chartState[id] = event.target.checked;
      if (id === "showTechLevels" && event.target.checked && !Object.values(chartState.techLevelTypes).some(Boolean)) {
        chartState.techLevelTypes = Object.fromEntries(TECH_LEVEL_LABELS.map(([k]) => [k, true]));
      }
      syncCprobChartControlChips();
      redrawChart();
    });
  });
  const probBtn = byId("chartProbBtn");
  if (probBtn) probBtn.addEventListener("click", toggleChartProbAnalysis);
  setupChartPresetControls();
  setupChartInteractions();
  setupChartCompareControls();
  setupMobileChartViewControls();
}

// 모바일에서는 스크롤·드래그가 어려우므로, 차트 위 명령바의 '보기' 그룹
// (‹ − + › Reset)을 차트 바로 아래로 옮겨 엄지로 쉽게 조작하게 한다.
// 데스크톱에서는 원래 명령바 위치로 복원한다(같은 버튼/리스너 그대로 사용).
function setupMobileChartViewControls() {
  const group = byId("chartViewGroup");
  const chart = byId("priceChart");
  if (!group || !chart) return;
  const homeParent = group.parentNode;
  const homeNext = group.nextSibling; // 복원 시 이 노드 앞에 다시 삽입
  const mq = window.matchMedia("(max-width: 640px)");
  const apply = () => {
    if (mq.matches) {
      if (chart.nextElementSibling !== group) chart.insertAdjacentElement("afterend", group);
      group.classList.add("chart-view-mobile");
    } else {
      if (group.parentNode !== homeParent || group.nextSibling !== homeNext) {
        homeParent.insertBefore(group, homeNext);
      }
      group.classList.remove("chart-view-mobile");
    }
  };
  apply();
  if (mq.addEventListener) mq.addEventListener("change", apply);
  else if (mq.addListener) mq.addListener(apply);
}

function chartSettingIds() {
  return [
    "showSma5", "showSma10", "showSma20", "showSma60", "showSma120",
    "showEma20", "showEma60", "showBoll", "showVwap", "showSupertrend", "showIchimoku", "showKeltner", "showDonchian", "showSupportResistance", "showTechLevels", "showPatterns",
    "showVolume", "showVolMa20", "showVolumeRatio", "showObv", "showAd",
    "showRsi", "showMacd", "showStoch", "showRoc", "showMomentum", "showWilliams", "showAtr", "showAdx", "showCci", "showCmf", "showMfi",
    "showVolumeProfile", "showTrendlines", "showGapZones", "showTtmSqueeze",
    "showMarketStructure", "showChandelier", "showAnchoredVwap",
    "showRsSpy", "showRsQqq", "showRsSector", "showMansfield"
  ];
}

function loadChartPresets() {
  try {
    const raw = JSON.parse(window.safeStorage.get(CHART_PRESET_STORAGE_KEY) || "{}");
    chartPresets = raw && typeof raw === "object" ? raw : {};
  } catch (e) {
    chartPresets = {};
  }
}

function saveChartPresets() {
  try { window.safeStorage.set(CHART_PRESET_STORAGE_KEY, JSON.stringify(chartPresets)); } catch (e) { /* ignore */ }
}

function currentChartPreset() {
  const settings = {};
  chartSettingIds().forEach((id) => { settings[id] = Boolean(chartState[id]); });
  return {
    range: chartState.range,
    barTf: chartState.barTf,
    chartType: chartState.chartType,
    settings,
    // 체크박스 그룹 상태도 함께 저장해야 프리셋이 완전히 복원된다
    // (마스터 토글만 저장하면 기술레벨·패턴 세부 선택이 유실).
    techLevelTypes: { ...chartState.techLevelTypes },
    patternTypes: { ...chartState.patternTypes },
    compareTickers: compareTickers.slice()
  };
}

function renderChartPresetOptions() {
  const select = byId("chartPresetSelect");
  if (!select) return;
  const names = Object.keys(chartPresets).sort((a, b) => a.localeCompare(b));
  select.innerHTML = `<option value="">프리셋 선택</option>` +
    names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
}

function syncChartControlUi() {
  byId("rangeControls")?.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.range === chartState.range);
  });
  byId("barTimeframeControls")?.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tf === chartState.barTf);
  });
  byId("chartTypeControls")?.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("is-active", (button.dataset.ctype || "candle") === chartState.chartType);
  });
  chartSettingIds().forEach((id) => {
    const el = byId(id);
    if (el) el.checked = Boolean(chartState[id]);
  });
  // 기술레벨·패턴 체크박스 그룹(기술 점수 패널 칩)도 프리셋 상태로 맞춘다.
  syncCprobChartControlChips();
}

function applyChartPreset(name) {
  const preset = chartPresets[name];
  if (!preset) return;
  chartState = {
    ...chartState,
    range: preset.range || chartState.range,
    barTf: preset.barTf || chartState.barTf,
    chartType: preset.chartType || chartState.chartType,
    zoom: 1,
    offset: 0,
    ...(preset.settings || {})
  };
  // 구버전 프리셋(그룹 키 없음)과의 하위호환: 키가 없으면 현재 상태 유지,
  // 있으면 저장된 그룹 상태로 통째로 교체(빠진 세부키는 현재값 유지).
  if (preset.techLevelTypes && typeof preset.techLevelTypes === "object") {
    chartState.techLevelTypes = { ...chartState.techLevelTypes, ...preset.techLevelTypes };
  }
  if (preset.patternTypes && typeof preset.patternTypes === "object") {
    chartState.patternTypes = { ...chartState.patternTypes, ...preset.patternTypes };
  }
  compareTickers = Array.isArray(preset.compareTickers)
    ? preset.compareTickers.filter((ticker) => stockByTicker(ticker)).slice(0, 5)
    : [];
  syncChartControlUi();
  renderCompareChips();
  Promise.all(compareTickers.map((ticker) => loadStockDetail(ticker))).finally(redrawChart);
}

function setupChartPresetControls() {
  loadChartPresets();
  renderChartPresetOptions();
  const builtinBar = byId("chartBuiltinPresets");
  if (builtinBar && !builtinBar.dataset.bound) {
    builtinBar.dataset.bound = "1";
    builtinBar.innerHTML = Object.entries(BUILTIN_OVERLAY_PRESETS).map(([k, p]) =>
      `<button type="button" class="ghost chart-builtin-preset" data-bpreset="${k}" aria-pressed="false">${escapeHtml(p.label)}</button>`).join("");
    builtinBar.querySelectorAll("[data-bpreset]").forEach((btn) => {
      btn.addEventListener("click", () => applyBuiltinOverlayPreset(btn.dataset.bpreset));
    });
  }
  byId("chartPresetSave")?.addEventListener("click", async () => {
    const name = await showAppPrompt("저장할 차트 프리셋 이름", "내 차트 설정", { title: "차트 프리셋 저장", okLabel: "저장" });
    if (!name || !name.trim()) return;
    chartPresets[name.trim()] = currentChartPreset();
    saveChartPresets();
    renderChartPresetOptions();
    const select = byId("chartPresetSelect");
    if (select) select.value = name.trim();
  });
  byId("chartPresetApply")?.addEventListener("click", () => {
    const name = byId("chartPresetSelect")?.value;
    if (name) applyChartPreset(name);
  });
  byId("chartPresetDelete")?.addEventListener("click", () => {
    const name = byId("chartPresetSelect")?.value;
    if (!name) return;
    delete chartPresets[name];
    saveChartPresets();
    renderChartPresetOptions();
  });
}


function setupChartCompareControls() {
  const input = byId("chartCompareInput");
  const add = byId("chartCompareAdd");
  if (!input || !add) return;
  add.addEventListener("click", () => addChartCompareTicker(input.value));
  // 비교 입력도 다른 티커 입력 상자와 같은 자동완성·같은 리졸버·같은 키보드 모델을 쓴다.
  // 예전엔 여기만 자동완성이 없고 toUpperCase() 만 해서 '삼전' 같은 한국어 별칭이
  // 조용히 무시됐다.
  setupTickerAutocomplete("chartCompareInput", { onCommit: (ticker) => addChartCompareTicker(ticker) });
  renderCompareChips();
}

function addChartCompareTicker(raw) {
  const input = byId("chartCompareInput");
  const { query, ticker, hits } = resolveTickerEntry(raw);
  if (!query) return;
  if (!ticker) {
    notifyAmbiguousTicker(query, hits);
    if (input) input.value = "";
    return;
  }
  if (ticker === selectedTicker || compareTickers.includes(ticker)) {
    if (input) input.value = "";
    return;
  }
  if (!stockByTicker(ticker)) {
    notifyAmbiguousTicker(query, hits);
    if (input) input.value = "";
    return;
  }
  compareTickers = compareTickers.concat(ticker).slice(-5);
  if (input) input.value = "";
  loadStockDetail(ticker).finally(() => {
    renderCompareChips();
    redrawChart();
  });
}

function removeChartCompareTicker(ticker) {
  compareTickers = compareTickers.filter((item) => item !== ticker);
  renderCompareChips();
  redrawChart();
}

function renderCompareChips() {
  const box = byId("chartCompareList");
  if (!box) return;
  box.innerHTML = compareTickers.length
    ? compareTickers.map((ticker) => `<button type="button" class="compare-chip" data-ticker="${escapeHtml(ticker)}">${escapeHtml(ticker)} <span>x</span></button>`).join("")
    : `<span class="muted">비교 종목을 추가하면 같은 기간 수익률 패널에 표시됩니다.</span>`;
  box.querySelectorAll(".compare-chip").forEach((chip) => {
    chip.addEventListener("click", () => removeChartCompareTicker(chip.dataset.ticker));
  });
}// TradingView-style: wheel=봉 확대/축소, pointer drag=봉 이동 (기술 점수 분석 중에도 동작).
// 클라이언트 좌표 → SVG viewBox 좌표 + 가격 축 판정. lastChartGeom(마지막 그린 차트) 기준.
function chartYAxisPoint(event) {
  const g = lastChartGeom;
  const svg = byId("priceChart");
  if (!g || !svg) return null;
  const rect = svg.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const vbX = ((event.clientX - rect.left) / rect.width) * g.width;
  const vbY = ((event.clientY - rect.top) / rect.height) * g.height;
  const onAxis = window.MirYScale.hitPriceAxis(vbX, vbY, {
    plotRight: g.padL + g.plotW, axisEnd: g.width, top: g.padT, height: g.plotH,
  });
  // 플롯 높이의 화면 픽셀(드래그 거리 → 배율/이동량 환산용)
  const plotPxH = rect.height * (g.plotH / g.height);
  return { g, vbX, vbY, onAxis, plotPxH, price: g.scale.value(vbY) };
}

function setupChartInteractions() {
  const svg = byId("priceChart");
  if (!svg || svg.dataset.panBound) return;
  svg.dataset.panBound = "1";

  // 모서리 A/L 토글(SVG 안 버튼). 클릭·Enter/Space. 팬 시작은 beginPan 에서 걸러 낸다.
  const yBtnAction = (btn) => {
    const key = btn.dataset.yscale;
    const hadFocus = document.activeElement === btn;
    if (key === "auto") {
      if (chartYScale.auto) return; // 이미 켜져 있으면 그대로(자동 맞춤을 끄는 건 축 조작)
      setChartYAuto();
    } else if (key === "log") {
      toggleChartYLog();
    }
    // 다시 그리면 버튼 노드가 바뀌므로 키보드 포커스를 새 노드로 옮긴다.
    if (hadFocus) svg.querySelector(`[data-yscale="${key}"]`)?.focus();
  };
  svg.addEventListener("click", (event) => {
    const btn = event.target.closest && event.target.closest("[data-yscale]");
    if (btn) { event.preventDefault(); yBtnAction(btn); }
  });
  svg.addEventListener("keydown", (event) => {
    const btn = event.target.closest && event.target.closest("[data-yscale]");
    if (btn && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); yBtnAction(btn); }
  });

  svg.addEventListener("wheel", (event) => {
    event.preventDefault();
    // 가격 축 위 휠 = 세로 줌(커서 가격 고정). 본문 휠은 예전처럼 가로 줌.
    const yp = chartYAxisPoint(event);
    if (yp && yp.onAxis) {
      const start = chartYCurrentRange();
      if (!start) return;
      const f = window.MirYScale.wheelZoomFactor(event.deltaY);
      setChartYManual(window.MirYScale.zoomRange(start, f, yp.price, chartYScale.log, chartYAutoRef()));
      scheduleChartPanRedraw();
      return;
    }
    const g = priceChartGeom();
    const rect = svg.getBoundingClientRect();
    const vbX = ((event.clientX - rect.left) / rect.width) * g.width;
    const plotW = g.width - g.padL - g.padR;
    const frac = Math.max(0, Math.min(1, (vbX - g.padL) / plotW));
    zoomChartAt(frac, event.deltaY < 0 ? 1.2 : 1 / 1.2);
  }, { passive: false });

  let dragPointerId = null;
  let startX = 0;
  let startY = 0;
  let startOffset = 0;
  let dragN = 0;
  let dragWindow = 0;
  let dragPlotPx = 1;
  // 세로 조작: "yzoom"=가격 축 드래그, "pan"=본문 드래그(수동 범위면 세로 이동도 함께)
  let dragMode = "pan";
  let dragYStart = null;   // 드래그 시작 시 세로 범위 {min,max}
  let dragYAnchor = NaN;   // 축 드래그 줌 고정 가격(가시 범위 가운데)
  let dragYRef = null;     // 과도한 확대 방지 기준(자동 맞춤 범위)
  let dragPlotPxH = 1;
  let lastAxisTapAt = 0;
  // 더블탭(터치) → 초기화. 마우스는 dblclick 이벤트로 같은 동작.
  let lastTapAt = 0;
  let lastTapX = 0;
  let lastTapY = 0;

  const beginPan = (event) => {
    if (event.target.closest && event.target.closest("[data-yscale]")) return; // A/L 버튼
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const yp = chartYAxisPoint(event);
    const onAxis = Boolean(yp && yp.onAxis);
    if (drawTool && !onAxis) return; // 드로잉 중에도 가격 축 드래그는 받는다
    if (touchMode === "pinch" || touchMode === "ypinch") return;
    const item = currentChartItem();
    if (!item) return;
    const Y = window.MirYScale;
    dragMode = onAxis ? "yzoom" : "pan";
    dragYStart = chartYCurrentRange();
    dragYRef = chartYAutoRef();
    dragYAnchor = dragYStart
      ? Y.fromT((Y.toT(dragYStart.min, chartYScale.log) + Y.toT(dragYStart.max, chartYScale.log)) / 2, chartYScale.log)
      : NaN;
    dragPlotPxH = yp ? Math.max(1, yp.plotPxH) : 1;
    dragPointerId = event.pointerId;
    chartPanActive = true;
    startX = event.clientX;
    startY = event.clientY;
    startOffset = chartState.offset;
    dragN = chartBaseLength(item);
    dragWindow = Math.max(16, Math.floor(dragN / chartState.zoom));
    const rect = svg.getBoundingClientRect();
    const g = priceChartGeom();
    dragPlotPx = rect.width * ((g.width - g.padL - g.padR) / g.width);
    svg.classList.add("is-dragging");
    try { svg.setPointerCapture(event.pointerId); } catch (e) { /* ignore */ }
    event.preventDefault();
  };

  const movePan = (event) => {
    if (dragPointerId == null || event.pointerId !== dragPointerId) return;
    const dy = event.clientY - startY;
    if (dragMode === "yzoom") {
      // 가격 축 드래그: 위로 끌면 늘리고(확대) 아래로 끌면 압축. 움직였을 때만 수동으로 전환.
      if (dragYStart && Math.abs(dy) >= 1) {
        const f = window.MirYScale.dragZoomFactor(dy, dragPlotPxH);
        setChartYManual(window.MirYScale.zoomRange(dragYStart, f, dragYAnchor, chartYScale.log, dragYRef));
        scheduleChartPanRedraw();
      }
      event.preventDefault();
      return;
    }
    // 자동 맞춤이 꺼져 있으면 본문 드래그가 세로로도 움직인다(켜져 있으면 가로만 — 예전 동작).
    if (!chartYScale.auto && dragYStart && dy !== 0) {
      setChartYManual(window.MirYScale.panRange(dragYStart, dy, dragPlotPxH, chartYScale.log));
      scheduleChartPanRedraw();
    }
    const dx = event.clientX - startX;
    const barsPerPx = dragWindow / Math.max(1, dragPlotPx);
    let next = Math.round(startOffset + dx * barsPerPx);
    next = Math.max(0, Math.min(Math.max(0, dragN - dragWindow), next));
    if (next !== chartState.offset) {
      chartState.offset = next;
      scheduleChartPanRedraw();
    }
    event.preventDefault();
  };

  const endPan = (event) => {
    if (dragPointerId == null || event.pointerId !== dragPointerId) return;
    dragPointerId = null;
    svg.classList.remove("is-dragging");
    try { svg.releasePointerCapture(event.pointerId); } catch (e) { /* ignore */ }
    // 터치 더블탭 감지: 거의 움직이지 않은 탭이 350ms 안에 같은 자리에서 두 번.
    // 판정은 리드로우(endChartPan, 수백 ms) 앞에서 이벤트 타임스탬프로 한다 — 리드로우 뒤에 Date.now()
    // 로 재면 첫 탭의 리드로우 시간이 간격에 더해져 실제 더블탭을 놓친다.
    let doubleTap = false;
    if (dragMode === "yzoom") {
      // 가격 축 더블클릭/더블탭 → 세로 자동 맞춤. 포인터 업마다 차트를 다시 그려(innerHTML)
      // 첫 클릭의 대상 노드가 사라지므로 브라우저 dblclick 이 안 올 수 있어 여기서 직접 판정한다.
      if (event.type === "pointerup") {
        const moved = Math.hypot(event.clientX - startX, event.clientY - startY);
        const now = event.timeStamp || Date.now();
        if (moved < (event.pointerType === "touch" ? 12 : 5) && now - lastAxisTapAt < 400) {
          lastAxisTapAt = 0;
          chartYScale = window.MirYScale.withAuto(chartYScale);
        } else {
          lastAxisTapAt = moved < 12 ? now : 0;
        }
      }
      dragMode = "pan";
      endChartPan();
      return;
    }
    if (event.type === "pointerup" && event.pointerType === "touch" && !touchMode) {
      const moved = Math.hypot(event.clientX - startX, event.clientY - startY);
      const now = event.timeStamp || Date.now();
      if (moved < 12) {
        const near = Math.hypot(event.clientX - lastTapX, event.clientY - lastTapY) < 40;
        if (now - lastTapAt < 350 && near) {
          lastTapAt = 0;
          doubleTap = true;
        } else {
          lastTapAt = now; lastTapX = event.clientX; lastTapY = event.clientY;
        }
      } else {
        lastTapAt = 0;
      }
    }
    if (doubleTap) { // resetChartView 와 같은 상태; 리드로우는 아래 한 번
      chartState = { ...chartState, zoom: 1, offset: 0 };
      chartYScale = window.MirYScale.withAuto(chartYScale);
    }
    endChartPan();
  };

  svg.addEventListener("pointerdown", beginPan);
  document.addEventListener("pointermove", movePan);
  document.addEventListener("pointerup", endPan);
  document.addEventListener("pointercancel", endPan);
  // 마우스 더블클릭 → 초기화(상단 '초기화' 버튼과 동일). 드로잉 중엔 무시.
  // 가격 축 더블클릭 → 세로 자동 맞춤만(가로 줌은 유지). A/L 버튼 더블클릭은 무시.
  svg.addEventListener("dblclick", (event) => {
    if (event.target.closest && event.target.closest("[data-yscale]")) return;
    const yp = chartYAxisPoint(event);
    if (yp && yp.onAxis) {
      event.preventDefault();
      chartYScale = window.MirYScale.withAuto(chartYScale);
      redrawChart();
      return;
    }
    if (drawTool) return;
    event.preventDefault();
    resetChartView();
  });

  let touchMode = null;     // null | "pinch"(가로 줌) | "ypinch"(세로 줌)
  let pinchStartDist = 0;
  let pinchStartZoom = 1;
  let pinchYStart = null;
  let pinchYAnchor = NaN;
  let pinchYRef = null;
  const touchDist = (touches) => Math.hypot(
    touches[0].clientX - touches[1].clientX,
    touches[0].clientY - touches[1].clientY
  );
  const touchDy = (touches) => Math.abs(touches[0].clientY - touches[1].clientY);

  svg.addEventListener("touchstart", (event) => {
    if (event.touches.length === 2) {
      // 두 손가락이 세로로 벌어져 있거나(세로 간격 > 가로 간격 × 1.5) 가격 축 위에서 시작하면
      // 세로 핀치(가격 배율), 아니면 예전처럼 가로 핀치(기간 줌).
      const t0 = event.touches[0];
      const t1 = event.touches[1];
      const dxAbs = Math.abs(t0.clientX - t1.clientX);
      const dyAbs = Math.abs(t0.clientY - t1.clientY);
      const mid = { clientX: (t0.clientX + t1.clientX) / 2, clientY: (t0.clientY + t1.clientY) / 2 };
      const yp = chartYAxisPoint(mid);
      const vertical = (yp && yp.onAxis) || dyAbs > dxAbs * 1.5;
      dragPointerId = null;
      dragMode = "pan";
      chartPanActive = false;
      svg.classList.remove("is-dragging");
      if (vertical && yp && dyAbs > 8) {
        touchMode = "ypinch";
        pinchStartDist = dyAbs;
        pinchYStart = chartYCurrentRange();
        pinchYAnchor = yp.price;
        pinchYRef = chartYAutoRef();
      } else {
        touchMode = "pinch";
        pinchStartDist = touchDist(event.touches);
        pinchStartZoom = chartState.zoom;
      }
    }
  }, { passive: true });

  svg.addEventListener("touchmove", (event) => {
    if (touchMode === "pinch" && event.touches.length === 2) {
      const dist = touchDist(event.touches);
      if (pinchStartDist > 0) setZoomAnchored(0.5, pinchStartZoom * (dist / pinchStartDist));
      event.preventDefault();
    } else if (touchMode === "ypinch" && event.touches.length === 2) {
      const f = window.MirYScale.pinchZoomFactor(pinchStartDist, Math.max(1, touchDy(event.touches)));
      if (pinchYStart && Math.abs(f - 1) > 0.005) {
        setChartYManual(window.MirYScale.zoomRange(pinchYStart, f, pinchYAnchor, chartYScale.log, pinchYRef));
        scheduleChartPanRedraw();
      }
      event.preventDefault();
    }
  }, { passive: false });

  svg.addEventListener("touchend", (event) => {
    if (event.touches.length < 2) touchMode = null;
  });

  // 명령바 '보기' 그룹의 자동·로그 버튼(모바일에선 차트 바로 아래로 옮겨진다).
  byId("chartYAuto")?.addEventListener("click", () => setChartYAuto());
  byId("chartYLog")?.addEventListener("click", () => toggleChartYLog());
  syncChartYScaleButtons();
}

// ===== 차트 드로잉(추세선·피보나치 되돌림) =====
let lastChartGeom = null;
// ticker -> [{type, t1,p1,t2,p2}]  (t: 봉 날짜 기반 타임스탬프 ms, p: 가격).
// 날짜+가격 앵커라 기간·줌·타임프레임을 바꿔도 같은 자리에 다시 그려진다.
// (드래그 중 미리보기만 화면비율 x1/x2 를 임시로 쓴다.)
const chartDrawings = {};
let drawTool = null;               // null | "trend" | "fib"
let drawStart = null;
let drawPreview = null;
const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

// ----- 드로잉 영속화: 시장:티커별 localStorage, 최근에 그린 50개 종목만 보관 -----
const CHART_DRAWINGS_STORAGE_KEY = "mir_chart_drawings_v1";
const CHART_DRAWINGS_MAX_TICKERS = 50;

function chartDrawStorageKey(ticker) {
  return `${isKrMarket() ? "kr" : "us"}:${ticker}`;
}

function loadStoredChartDrawings() {
  try {
    const raw = JSON.parse(window.safeStorage.get(CHART_DRAWINGS_STORAGE_KEY) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch (_) {
    return {};
  }
}

function persistChartDrawings(ticker) {
  if (!ticker) return;
  const store = loadStoredChartDrawings();
  const key = chartDrawStorageKey(ticker);
  // 날짜 앵커가 있는 항목만 저장(미리보기·비정상 좌표 제외)
  const items = (chartDrawings[ticker] || []).filter((d) => d && Number.isFinite(d.t1) && Number.isFinite(d.t2));
  if (items.length) store[key] = { at: Date.now(), items };
  else delete store[key];
  const keys = Object.keys(store);
  if (keys.length > CHART_DRAWINGS_MAX_TICKERS) {
    keys.sort((a, b) => ((store[b] && store[b].at) || 0) - ((store[a] && store[a].at) || 0))
      .slice(CHART_DRAWINGS_MAX_TICKERS)
      .forEach((k) => delete store[k]);
  }
  try { window.safeStorage.set(CHART_DRAWINGS_STORAGE_KEY, JSON.stringify(store)); } catch (_) { /* quota */ }
}

function hydrateChartDrawings(ticker) {
  if (!ticker || Object.prototype.hasOwnProperty.call(chartDrawings, ticker)) return;
  const entry = loadStoredChartDrawings()[chartDrawStorageKey(ticker)];
  chartDrawings[ticker] = entry && Array.isArray(entry.items)
    ? entry.items.filter((d) => d && Number.isFinite(d.t1) && Number.isFinite(d.t2))
    : [];
}

// 봉 인덱스 → 타임스탬프(ms). 날짜가 없는 봉이 섞이면 Date.parse 가 NaN 을 주고,
// chartXnFromTime 의 이분 탐색(배열이 단조 증가라는 전제)이 조용히 틀린 답을 낸다.
// 앞뒤 유효값으로 선형 보간하고, 하나도 없으면 인덱스를 하루 간격으로 쓴다.
function buildChartTimes(rows) {
  const t = rows.map((r) => Date.parse(r && r.d));
  const n = t.length;
  const DAY = 86400000;
  let firstValid = -1;
  for (let i = 0; i < n; i += 1) { if (Number.isFinite(t[i])) { firstValid = i; break; } }
  if (firstValid < 0) return rows.map((_, i) => i * DAY);
  for (let i = firstValid - 1; i >= 0; i -= 1) t[i] = t[i + 1] - DAY;
  for (let i = firstValid + 1; i < n; i += 1) {
    if (Number.isFinite(t[i])) continue;
    let j = i + 1;
    while (j < n && !Number.isFinite(t[j])) j += 1;
    if (j < n) {
      const step = (t[j] - t[i - 1]) / (j - (i - 1));
      for (let k = i; k < j; k += 1) t[k] = t[i - 1] + step * (k - (i - 1));
      i = j - 1;
    } else {
      for (let k = i; k < n; k += 1) t[k] = t[k - 1] + DAY;
      break;
    }
  }
  return t;
}

// 날짜(ms) ↔ 플롯 가로비율(0~1). 보이는 봉 날짜 배열(geom.times)로 변환하고,
// 범위 밖 날짜는 가장자리 봉 간격으로 선형 외삽한다(렌더 시 clipPath 로 잘림).
function chartXnFromTime(g, ts) {
  const t = g && g.times;
  const n = t ? t.length : 0;
  if (!n || !Number.isFinite(ts)) return null;
  if (n === 1) return 0;
  if (ts <= t[0]) {
    const step = (t[1] - t[0]) || 1;
    return -((t[0] - ts) / step) / (n - 1);
  }
  if (ts >= t[n - 1]) {
    const step = (t[n - 1] - t[n - 2]) || 1;
    return 1 + ((ts - t[n - 1]) / step) / (n - 1);
  }
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (t[mid] <= ts) lo = mid; else hi = mid;
  }
  const frac = (ts - t[lo]) / ((t[hi] - t[lo]) || 1);
  return (lo + frac) / (n - 1);
}

function chartTimeFromXn(g, xn) {
  const t = g && g.times;
  const n = t ? t.length : 0;
  if (!n || !Number.isFinite(xn)) return null;
  if (n === 1) return t[0];
  const fidx = Math.max(0, Math.min(n - 1, xn * (n - 1)));
  const lo = Math.floor(fidx);
  const hi = Math.min(n - 1, lo + 1);
  return Math.round(t[lo] + (t[hi] - t[lo]) * (fidx - lo));
}

// 저장 항목(날짜 앵커) 또는 미리보기(비율 좌표)를 현재 화면 비율로 통일한다.
function drawingScreenXn(g, d) {
  if (Number.isFinite(d.t1) || Number.isFinite(d.t2)) {
    const x1 = chartXnFromTime(g, d.t1);
    const x2 = chartXnFromTime(g, d.t2);
    if (x1 == null || x2 == null) return null;
    return { x1, x2 };
  }
  return { x1: d.x1, x2: d.x2 };
}

function renderChartDrawings() {
  const g = lastChartGeom;
  if (!g) return "";
  const items = (chartDrawings[g.ticker] || []).slice();
  if (drawPreview) items.push(drawPreview);
  if (!items.length) return "";
  const pxX = (xn) => g.padL + xn * g.plotW;
  const pxY = (price) => {
    const y = g.scale.y(price); // 선형·로그 공통(chart-yscale-core)
    return Number.isFinite(y) ? y : g.padT + g.plotH * 4;
  };
  let out = "";
  for (const d of items) {
    const xs = drawingScreenXn(g, d);
    if (!xs) continue;
    if (d.type === "trend") {
      out += `<line x1="${pxX(xs.x1).toFixed(1)}" y1="${pxY(d.p1).toFixed(1)}" x2="${pxX(xs.x2).toFixed(1)}" y2="${pxY(d.p2).toFixed(1)}" class="draw-line"></line>`;
    } else if (d.type === "fib") {
      const hi = Math.max(d.p1, d.p2), lo = Math.min(d.p1, d.p2), span = hi - lo || 1;
      const xa = pxX(Math.min(xs.x1, xs.x2)), xb = pxX(Math.max(xs.x1, xs.x2));
      out += FIB_LEVELS.map((lv) => {
        const price = hi - span * lv;
        const y = pxY(price);
        return `<line x1="${xa.toFixed(1)}" y1="${y.toFixed(1)}" x2="${xb.toFixed(1)}" y2="${y.toFixed(1)}" class="draw-fib"></line>`
          + `<text x="${(xb + 4).toFixed(1)}" y="${(y + 3).toFixed(1)}" class="draw-fib-label">${(lv * 100).toFixed(1)}% · ${chartPriceLabel(price)}</text>`;
      }).join("");
    }
  }
  return out;
}

function chartPointToData(evt) {
  const g = lastChartGeom;
  const svg = byId("priceChart");
  if (!g || !svg) return null;
  const rect = svg.getBoundingClientRect();
  const px = (evt.clientX - rect.left) * (g.width / rect.width);
  const py = (evt.clientY - rect.top) * (g.height / rect.height);
  const xn = Math.max(0, Math.min(1, (px - g.padL) / g.plotW));
  const price = g.scale.value(py);
  return { xn, price };
}

function updateDrawLayer() {
  const layer = byId("chartDrawLayer");
  if (layer) layer.innerHTML = renderChartDrawings();
}

function setDrawTool(tool) {
  drawTool = (drawTool === tool) ? null : tool;
  drawStart = null; drawPreview = null;
  byId("chartDrawControls")?.querySelectorAll("button[data-draw]").forEach((b) => b.classList.toggle("is-active", b.dataset.draw === drawTool));
  const svg = byId("priceChart");
  if (svg) {
    svg.classList.toggle("is-drawing", Boolean(drawTool));
    // 드로잉 중엔 브라우저 터치 제스처(스크롤·핀치줌)를 확실히 끈다. 끝나면 인라인 값을 지워
    // 스타일시트의 #priceChart 규칙으로 되돌린다.
    svg.style.touchAction = drawTool ? "none" : "";
  }
}

// 축·지지저항·피보·손절/목표·헤더 가격 라벨. US 는 가격대별 소수 자리(<$10 → 2, <$100 → 1,
// 그 외 0) — 정수로 반올림하면 $10 미만 2,300여 종목이 "$3/$4" 로만 찍혔다. KR 은 원 단위 정수.
function chartPriceLabel(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  if (isKrMarket()) return Math.round(n).toLocaleString("ko-KR", { maximumFractionDigits: 0 });
  const abs = Math.abs(n);
  const dec = abs < 10 ? 2 : abs < 100 ? 1 : 0;
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
}

function setupChartDrawing() {
  // 차트 유형(캔들/라인) 토글
  const typeCtl = byId("chartTypeControls");
  if (typeCtl && !typeCtl.dataset.bound) {
    typeCtl.dataset.bound = "1";
    typeCtl.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      chartState.chartType = b.dataset.ctype || "candle";
      if (chartState.chartType !== "candle" && chartState.chartType !== "line" && chartState.chartType !== "heikin") chartState.chartType = "candle";
      typeCtl.querySelectorAll("button").forEach((x) => x.classList.toggle("is-active", x === b));
      const item = stockByTicker(selectedTicker);
      if (item) drawChart(applyLive(withDetail(item)));
    }));
  }
  // 드로잉 도구
  const drawCtl = byId("chartDrawControls");
  if (drawCtl && !drawCtl.dataset.bound) {
    drawCtl.dataset.bound = "1";
    drawCtl.querySelectorAll("button[data-draw]").forEach((b) => b.addEventListener("click", () => setDrawTool(b.dataset.draw)));
    byId("chartDrawClear")?.addEventListener("click", () => {
      if (lastChartGeom) {
        chartDrawings[lastChartGeom.ticker] = [];
        persistChartDrawings(lastChartGeom.ticker); // 삭제도 저장소에 반영
      }
      drawPreview = null; updateDrawLayer();
    });
  }
  // 차트 위 드래그
  const svg = byId("priceChart");
  if (svg && !svg.dataset.drawBound) {
    svg.dataset.drawBound = "1";
    // 포인터 이벤트(마우스·터치·펜 공통). 예전엔 mousedown/mousemove/mouseup 이라 모바일에서
    // 추세선·피보를 그릴 수 없었다(터치는 팬 제스처·스크롤에 먹혔다). 드로잉 도구가 켜져 있으면
    // 팬(beginPan)은 pointerdown 에서 스스로 물러나므로(drawTool 가드) 여기서 우선권을 가진다.
    let drawPointerId = null;
    const cancelDraw = () => {
      drawPointerId = null;
      drawStart = null; drawPreview = null; updateDrawLayer();
    };
    svg.addEventListener("pointerdown", (e) => {
      if (!drawTool) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.target.closest && e.target.closest("[data-yscale]")) return;
      const yp = chartYAxisPoint(e);
      if (yp && yp.onAxis) return; // 가격 축은 세로 배율 조작(beginPan)이 받는다
      if (drawPointerId != null) return; // 두 번째 손가락은 무시(핀치는 touch 핸들러가 처리)
      e.preventDefault();
      const start = chartPointToData(e);
      if (!start) return;
      drawPointerId = e.pointerId;
      drawStart = start;
      try { svg.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    });
    const moveDraw = (e) => {
      if (!drawTool || !drawStart || drawPointerId == null || e.pointerId !== drawPointerId) return;
      const p = chartPointToData(e);
      if (!p) return;
      drawPreview = { type: drawTool, x1: drawStart.xn, p1: drawStart.price, x2: p.xn, p2: p.price };
      updateDrawLayer();
      e.preventDefault();
    };
    const endDraw = (e) => {
      if (drawPointerId == null || e.pointerId !== drawPointerId) return;
      try { svg.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      if (!drawTool || !drawStart) { cancelDraw(); return; }
      const p = chartPointToData(e);
      const t = lastChartGeom && lastChartGeom.ticker;
      if (p && t && (Math.abs(p.xn - drawStart.xn) > 0.005 || Math.abs(p.price - drawStart.price) > 1e-9)) {
        // 화면비율 → 봉 날짜 앵커로 변환해 저장(줌·기간 변경에도 유지)
        const t1 = chartTimeFromXn(lastChartGeom, drawStart.xn);
        const t2 = chartTimeFromXn(lastChartGeom, p.xn);
        (chartDrawings[t] = chartDrawings[t] || []).push(
          Number.isFinite(t1) && Number.isFinite(t2)
            ? { type: drawTool, t1, p1: drawStart.price, t2, p2: p.price }
            : { type: drawTool, x1: drawStart.xn, p1: drawStart.price, x2: p.xn, p2: p.price },
        );
        persistChartDrawings(t);
      }
      cancelDraw();
    };
    // 캡처가 실패해도(구형 브라우저) SVG 밖에서 뗀 포인터를 놓치지 않도록 document 에서 받는다
    // (SVG 에서 시작한 이벤트도 버블링으로 여기 도착하므로 SVG 에 따로 달지 않는다).
    document.addEventListener("pointermove", moveDraw);
    document.addEventListener("pointerup", endDraw);
    document.addEventListener("pointercancel", (e) => {
      if (drawPointerId == null || e.pointerId !== drawPointerId) return;
      try { svg.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      cancelDraw();
    });
  }
}

function drawChart(item, options = {}) {
  setupChartDrawing();
  const svg = options.svgElement || byId("priceChart");
  const allRows = resampleBars(getChartRows(item), chartState.barTf);
  const rows = visibleChartRows(allRows);
  const geom = priceChartGeom();
  const width = geom.width;
  const padL = geom.padL;
  const padR = geom.padR;
  const padT = 28;
  const plotW = width - padL - padR;
  const plotH = 300;
  const xPlotRight = padL + plotW;

  if (!rows.length) {
    svg.setAttribute("viewBox", `0 0 ${width} 360`);
    svg.innerHTML = `<rect x="0" y="0" width="${width}" height="360" rx="8" class="chart-bg"></rect><text x="${width / 2}" y="180" text-anchor="middle" class="chart-axis">차트 데이터 없음</text>`;
    return;
  }

  requestBenchmarkDetails(item);

  // Bottom panels stack below the price plot (dynamic height).
  const gap = 18;
  const panels = [];
  if (chartState.showVolume || chartState.showVolMa20 || chartState.showVolumeRatio) panels.push({ t: "volume", h: 52 });
  if (chartState.showObv) panels.push({ t: "obv", h: 56 });
  if (chartState.showAd) panels.push({ t: "ad", h: 56 });
  if (chartState.showRsi) panels.push({ t: "rsi", h: 60 });
  if (chartState.showMacd) panels.push({ t: "macd", h: 70 });
  if (chartState.showStoch) panels.push({ t: "stoch", h: 60 });
  if (chartState.showRoc) panels.push({ t: "roc", h: 58 });
  if (chartState.showMomentum) panels.push({ t: "momentum", h: 58 });
  if (chartState.showWilliams) panels.push({ t: "williams", h: 58 });
  if (chartState.showAtr) panels.push({ t: "atr", h: 58 });
  if (chartState.showAdx) panels.push({ t: "adx", h: 62 });
  if (chartState.showCci) panels.push({ t: "cci", h: 58 });
  if (chartState.showCmf) panels.push({ t: "cmf", h: 56 });
  if (chartState.showMfi) panels.push({ t: "mfi", h: 56 });
  if (chartState.showTtmSqueeze) panels.push({ t: "ttm", h: 58 });
  if (hasRelativePanel(item)) panels.push({ t: "relative", h: 70 });
  if (compareTickers.length) panels.push({ t: "compare", h: 72 });
  const panelsH = panels.reduce((sum, p) => sum + p.h + gap, 0);
  const axisH = 26;
  const height = padT + plotH + panelsH + axisH;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const plotRows = chartState.chartType === "heikin" ? heikinAshiRows(rows) : rows;
  const closes = plotRows.map((row) => row.c);
  const lows = plotRows.map((row) => row.l);
  const highs = plotRows.map((row) => row.h);
  const autoLo = Math.min(...lows);
  const autoHi = Math.max(...highs);
  // 세로 축: 자동 맞춤이면 보이는 봉 고가·저가, 수동이면 사용자가 정한 범위. 로그면 log10 공간.
  // 종목·기간·봉이 바뀌면 자동 맞춤으로 돌아간다(로그 선택은 유지).
  const yKey = `${item.ticker}|${chartState.range}|${chartState.barTf}`;
  if (yKey !== chartYScaleKey) {
    chartYScaleKey = yKey;
    chartYScale = window.MirYScale.withAuto(chartYScale);
  }
  const yRes = window.MirYScale.resolveRange(chartYScale, autoLo, autoHi, 0);
  const autoRef = window.MirYScale.autoRange(autoLo, autoHi, 0, yRes.log);
  const yScale = window.MirYScale.createScale({ min: yRes.min, max: yRes.max, log: yRes.log, top: padT, height: plotH });
  const min = yScale.min;
  const max = yScale.max;
  const yLog = yRes.log;
  const yManual = !yRes.auto;
  const xFor = (index) => padL + (index / Math.max(1, rows.length - 1)) * plotW;
  const yFor = (value) => yScale.y(value);
  const candleW = Math.max(2, Math.min(11, (plotW / rows.length) * 0.62));

  const linePath = closes.map((value, index) => `${index ? "L" : "M"} ${xFor(index).toFixed(1)} ${yFor(value).toFixed(1)}`).join(" ");
  const area = `${linePath} L ${(padL + plotW).toFixed(1)} ${(padT + plotH).toFixed(1)} L ${padL} ${(padT + plotH).toFixed(1)} Z`;
  // 가격 눈금: 범위에 맞춰 1·2·2.5·5 배수(로그면 10^k × 가수)로 다시 잡는다.
  const yTicks = window.MirYScale.ticks(min, max, yLog, plotH >= 260 ? 6 : 5);
  const grid = yTicks.ticks.map((value) => {
    const y = yFor(value);
    if (!Number.isFinite(y)) return "";
    return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${padL + plotW}" y2="${y.toFixed(1)}" class="chart-grid"></line><text x="${width - 8}" y="${(y + 4).toFixed(1)}" class="chart-axis" text-anchor="end">${chartAxisPriceLabel(value, yTicks.step)}</text>`;
  }).join("");
  // 오버레이 y. 자동 맞춤에서는 예전처럼 화면 범위로 클램프한다(화면이 곧 보이는 봉 범위라
  // 클램프되는 건 채널 채움 가장자리 정도). 수동(세로 확대·이동)에서는 클램프하면 범위 밖
  // 수평선이 가장자리에 가짜로 깔리므로 클램프하지 않고 플롯 clipPath(#chartPlotClip)로 자른다.
  // 로그에서 0 이하 값은 좌표가 없으므로 화면 아래 멀리 보낸다(잘려서 안 보임).
  const overlayYFor = (value) => {
    const y = yFor(yManual ? value : Math.max(min, Math.min(max, value)));
    return Number.isFinite(y) ? y : padT + plotH * 4;
  };

  // 지표 계산용 컨텍스트(보이는 구간 + 앞쪽 이력). 보이는 rows는 ctxRows의 꼬리이므로
  // 지표를 ctxRows로 계산한 뒤 lastN(..., visN)으로 잘라 그린다(좌측 워밍업 잘림 방지).
  const ctxRows = chartAnalysisContextRows(allRows);
  const visN = rows.length;
  const ctxCloses = ctxRows.map((r) => r.c);
  const tailCh = (ch) => ch ? { upper: lastN(ch.upper, visN), lower: lastN(ch.lower, visN), mid: lastN(ch.mid, visN) } : null;
  const tailObj = (o) => { const r = {}; for (const k in o) r[k] = Array.isArray(o[k]) ? lastN(o[k], visN) : o[k]; return r; };
  // 화면 가격범위 밖 값은 가장자리에 평평하게 깔리지 않도록 null 처리(선이 끊김) — 가짜 수평선 방지.
  // 자동 맞춤에서는 예전처럼 화면 범위 밖을 끊고(가장자리 잡선 방지), 수동(세로 확대·이동)
  // 에서는 선이 플롯 경계를 지나가도록 두고 clipPath 로 자른다. 로그에서 0 이하는 항상 끊는다.
  const clipRange = (arr) => arr.map((v) => {
    if (v == null || !Number.isFinite(v) || (yLog && v <= 0)) return null;
    if (!yManual && (v < min || v > max)) return null;
    return v;
  });

  // Bollinger Bands (20, 2σ) overlay.
  let bollSvg = "";
  if (chartState.showBoll) {
    const bb0 = bollinger(ctxCloses, 20, 2);
    const bb = { upper: lastN(bb0.upper, visN), lower: lastN(bb0.lower, visN), mid: lastN(bb0.mid, visN) };
    const upPts = bb.upper.map((v, i) => (v == null ? null : [xFor(i), yFor(v)])).filter(Boolean);
    const loPts = bb.lower.map((v, i) => (v == null ? null : [xFor(i), yFor(v)])).filter(Boolean);
    let fill = "";
    if (upPts.length > 1 && loPts.length > 1) {
      const top = upPts.map(([x, y], i) => `${i ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
      const bot = loPts.slice().reverse().map(([x, y]) => `L ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
      fill = `<path d="${top} ${bot} Z" fill="rgba(34,211,238,0.07)" stroke="none"></path>`;
    }
    bollSvg = fill
      + pathFromSeries(bb.upper, xFor, yFor, "#22d3ee", 1.2, "4 3")
      + pathFromSeries(bb.lower, xFor, yFor, "#22d3ee", 1.2, "4 3")
      + pathFromSeries(bb.mid, xFor, yFor, "#94a3b8", 1, "");
  }

  const candles = plotRows.map((row, index) => {
    const x = xFor(index);
    const up = row.c >= row.o;
    const yOpen = yFor(row.o);
    const yClose = yFor(row.c);
    const bodyY = Math.min(yOpen, yClose);
    const bodyH = Math.max(1.2, Math.abs(yClose - yOpen));
    return `<g class="${up ? "candle-up" : "candle-down"}"><line x1="${x.toFixed(1)}" y1="${yFor(row.h).toFixed(1)}" x2="${x.toFixed(1)}" y2="${yFor(row.l).toFixed(1)}"></line><rect x="${(x - candleW / 2).toFixed(1)}" y="${bodyY.toFixed(1)}" width="${candleW.toFixed(1)}" height="${bodyH.toFixed(1)}"></rect></g>`;
  }).join("");

  const keltner = chartState.showKeltner ? tailCh(keltnerChannels(ctxRows, 20, 2)) : null;
  const donchian = chartState.showDonchian ? tailCh(donchianChannels(ctxRows, 20)) : null;
  const ichimoku = chartState.showIchimoku ? tailObj(ichimokuArrays(ctxRows)) : null;
  const supertrend = chartState.showSupertrend ? lastN(supertrendArray(ctxRows, 10, 3), visN) : null;

  // 이평/지표는 컨텍스트로 계산 후 보이는 구간으로 잘라 그린다. 단일 라인은 clipRange로
  // 화면 밖 구간을 끊고, 채널(밴드 채움)은 기존 overlayYFor(클램프)를 유지한다.
  const overlays = [
    chartState.showSma5 ? pathFromSeries(clipRange(lastN(smaSeries(ctxCloses, 5), visN)), xFor, yFor, "#3b82f6", 1.8, "") : "",
    chartState.showSma10 ? pathFromSeries(clipRange(lastN(smaSeries(ctxCloses, 10), visN)), xFor, yFor, "#0d9488", 1.8, "") : "",
    chartState.showSma20 ? pathFromSeries(clipRange(lastN(smaSeries(ctxCloses, 20), visN)), xFor, yFor, "#8b5cf6", 1.8, "") : "",
    chartState.showSma60 ? pathFromSeries(clipRange(lastN(smaSeries(ctxCloses, 60), visN)), xFor, yFor, "#d97706", 1.8, "") : "",
    chartState.showSma120 ? pathFromSeries(clipRange(lastN(smaSeries(ctxCloses, 120), visN)), xFor, yFor, "#a16207", 1.8, "") : "",
    chartState.showEma20 ? pathFromSeries(clipRange(lastN(emaArray(ctxCloses, 20), visN)), xFor, yFor, "#db2777", 1.6, "") : "",
    chartState.showEma60 ? pathFromSeries(clipRange(lastN(emaArray(ctxCloses, 60), visN)), xFor, yFor, "#0284c7", 1.6, "") : "",
    chartState.showVwap ? pathFromSeries(clipRange(lastN(vwapArray(ctxRows), visN)), xFor, yFor, "#ea580c", 1.7, "") : "",
    supertrend ? pathFromSeries(clipRange(supertrend), xFor, yFor, "#22c55e", 1.6, "5 3") : "",
    ichimoku ? renderIchimokuOverlay(ichimoku, xFor, overlayYFor) : "",
    keltner ? renderChannelOverlay(keltner.upper, keltner.lower, keltner.mid, xFor, overlayYFor, "#fb7185") : "",
    donchian ? renderChannelOverlay(donchian.upper, donchian.lower, donchian.mid, xFor, overlayYFor, "#818cf8") : ""
  ].join("");

  // 지지/저항 오버레이: 확률 패널에 표시된 레벨(분석 결과)이 있으면 그대로 사용해
  // 패널 숫자와 차트 선을 일치시킨다. 없으면 컨텍스트 봉으로 계산(이력 포함, 안정적).
  let srSvg = "";
  if (!chartPanActive && chartState.showSupportResistance && window.MirProb && window.MirProb.supportResistanceLevels) {
    const srProb = chartState.lastProbResult;
    const baseLevels = (srProb && srProb.ticker === item.ticker && srProb.sr && srProb.sr.levels && srProb.sr.levels.length)
      ? srProb.sr.levels
      : window.MirProb.supportResistanceLevels(ctxRows);
    const levels = baseLevels.filter((lvl) => lvl.hi >= min && lvl.lo <= max);
    srSvg = levels.map((lvl) => {
      const yMid = overlayYFor(lvl.price);
      const yHi = overlayYFor(lvl.hi); // 높은 가격 = 작은 y
      const yLo = overlayYFor(lvl.lo);
      const color = lvl.type === "sup" ? "#16a34a" : "#dc2626";
      const bandH = Math.max(2, yLo - yHi);
      const dots = "●".repeat(lvl.tier) + "○".repeat(3 - lvl.tier);
      const label = `${lvl.type === "sup" ? "지지" : "저항"} ${chartPriceLabel(lvl.price)} ${dots}`;
      return `<rect x="${padL.toFixed(1)}" y="${yHi.toFixed(1)}" width="${plotW.toFixed(1)}" height="${bandH.toFixed(1)}" fill="${color}" opacity="0.08"></rect>`
        + `<line x1="${padL.toFixed(1)}" y1="${yMid.toFixed(1)}" x2="${xPlotRight.toFixed(1)}" y2="${yMid.toFixed(1)}" stroke="${color}" stroke-width="1.1" stroke-dasharray="6 4" opacity="0.85"></line>`
        + `<text x="${(padL + 5).toFixed(1)}" y="${(yMid - 3).toFixed(1)}" fill="${color}" font-size="10" font-weight="700">${label}</text>`;
    }).join("");
  }

  // 차트 패턴 도형 오버레이(역H&S·쌍바닥 등): 패턴을 이루는 피벗을 선으로 잇고
  // 좌어깨/머리/우어깨를 라벨링, 목선을 점선으로 표시. 전체 일봉으로 감지하고
  // 날짜로 보이는 봉에 매핑한다(확대해도 일관).
  let patSvg = "";
  if (!chartPanActive && chartState.showPatterns && window.MirProb && window.MirProb.detectConfirmations) {
    const dailyRows = getChartRows(item);
    const labels = window.MirProb.patternLabels || {};
    const firstD = rows[0].d;
    const lastD = rows[rows.length - 1].d;
    // 보이는 구간 안에서 확정된 패턴 중, 체크된 종류만, 가장 최근 것들을 그린다.
    const enabled = chartState.patternTypes || {};
    const pats = getCachedPatternConfirmations(item.ticker, dailyRows)
      .filter((p) => p.points || p.lines)
      .filter((p) => { const cat = patternCategory(p.pattern); return cat && enabled[cat]; })
      .filter((p) => {
        const cd = dailyRows[p.confirm_idx] && dailyRows[p.confirm_idx].d;
        return cd && cd >= firstD && cd <= lastD;
      })
      .sort((a, b) => b.confirm_idx - a.confirm_idx)
      .slice(0, 3);
    const days = (d) => (d ? Date.parse(d) / 86400000 : NaN);
    const visIdxForDate = (d) => {
      if (!d || d < firstD || d > lastD) return -1; // 보이는 구간 밖
      let best = -1;
      let bestDiff = Infinity;
      const td = days(d);
      for (let i = 0; i < rows.length; i += 1) {
        const diff = Math.abs(days(rows[i].d) - td);
        if (diff < bestDiff) { bestDiff = diff; best = i; }
      }
      return best;
    };
    const mapPt = (p) => {
      const dt = dailyRows[p.idx] && dailyRows[p.idx].d;
      const vi = visIdxForDate(dt);
      return vi < 0 ? null : { x: xFor(vi), y: overlayYFor(p.price), label: p.label };
    };
    patSvg = pats.map((pat) => {
      const color = pat.dir > 0 ? "#0ea5e9" : "#a855f7"; // S/R(초록·빨강)과 구분되는 색
      let svg = "";
      let anchor = null; // 패턴 이름 라벨 기준점
      // 추세선/레벨(실선) — 삼각수렴·돌파
      if (pat.lines) {
        for (const ln of pat.lines) {
          const lp = ln.pts.map(mapPt).filter(Boolean);
          if (lp.length === 2) {
            svg += `<line x1="${lp[0].x.toFixed(1)}" y1="${lp[0].y.toFixed(1)}" x2="${lp[1].x.toFixed(1)}" y2="${lp[1].y.toFixed(1)}" stroke="${color}" stroke-width="1.5" opacity="0.9"></line>`;
            anchor = anchor || lp[0];
          }
        }
      }
      const pts = (pat.points || []).map(mapPt).filter(Boolean);
      // 반전 패턴 윤곽선(피벗 3개 이상을 선으로 연결)
      if (pts.length >= 3) {
        const poly = pts.map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
        svg += `<path d="${poly}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" opacity="0.9"></path>`;
      }
      // 목선(점선)
      if (pat.necklinePts) {
        const nl = pat.necklinePts.map(mapPt).filter(Boolean);
        if (nl.length === 2) {
          svg += `<line x1="${nl[0].x.toFixed(1)}" y1="${nl[0].y.toFixed(1)}" x2="${nl[1].x.toFixed(1)}" y2="${nl[1].y.toFixed(1)}" stroke="${color}" stroke-width="1.1" stroke-dasharray="5 4" opacity="0.8"></line>`;
        }
      }
      // 피벗/돌파 점 + 라벨
      for (const p of pts) {
        svg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.2" fill="${color}"></circle>`;
        if (p.label) svg += `<text x="${p.x.toFixed(1)}" y="${(p.y - 7).toFixed(1)}" text-anchor="middle" fill="${color}" font-size="10" font-weight="700">${escapeHtml(p.label)}</text>`;
      }
      if (pts.length) anchor = anchor || pts[0];
      if (!anchor) return ""; // 전부 화면 밖이면 생략
      const name = labels[pat.pattern] || pat.pattern;
      svg += `<text x="${anchor.x.toFixed(1)}" y="${(anchor.y + 14).toFixed(1)}" fill="${color}" font-size="10.5" font-weight="800">${escapeHtml(name)}</text>`;
      return svg;
    }).join("");
  }

  let vpSvg = "";
  if (!chartPanActive && chartState.showVolumeProfile) {
    volumeProfileOverlayLines(rows).forEach((ln) => {
      const y = overlayYFor(ln.price);
      const w = ln.weight || 1;
      vpSvg += `<line x1="${padL.toFixed(1)}" y1="${y.toFixed(1)}" x2="${xPlotRight.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${ln.color}" stroke-width="${w}" stroke-dasharray="10 5" opacity="0.8"></line>`
        + `<text x="${(padL + 5).toFixed(1)}" y="${(y - 3).toFixed(1)}" fill="${ln.color}" font-size="10" font-weight="700">${escapeHtml(ln.label)} ${chartPriceLabel(ln.price)}</text>`;
    });
  }

  let msSvg = "";
  if (!chartPanActive && chartState.showMarketStructure) {
    computeMarketStructureLabels(rows).forEach((p) => {
      const x = xFor(p.idx);
      const y = overlayYFor(p.price) + (p.type === "H" ? -6 : 12);
      const col = p.label.includes("H") ? "#f87171" : "#4ade80";
      msSvg += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" fill="${col}" font-size="10" font-weight="800">${p.label}</text>`;
    });
  }

  let chandelierSvg = "";
  if (!chartPanActive && chartState.showChandelier && window.MirProb && window.MirProb.chandelierExitArray) {
    const ce = window.MirProb.chandelierExitArray(ctxRows);
    const mapped = rows.map((r) => {
      const gi = ctxIdxForVisibleRow(ctxRows, r);
      if (gi < 0 || !ce[gi]) return null;
      return r.c >= ce[gi].longStop ? ce[gi].longStop : ce[gi].shortStop;
    });
    chandelierSvg = pathFromSeries(clipRange(mapped), xFor, yFor, "#fb923c", 1.5, "5 3")
      + `<text x="${(padL + 5).toFixed(1)}" y="${(padT + 14).toFixed(1)}" fill="#fb923c" font-size="9.5" font-weight="700">Chandelier</text>`;
  }

  let avwapSvg = "";
  if (!chartPanActive && chartState.showAnchoredVwap) {
    anchoredVwapOverlays(ctxRows, item).forEach((ln) => {
      const mapped = rows.map((r) => {
        const gi = ctxIdxForVisibleRow(ctxRows, r);
        if (gi < ln.startIdx) return null;
        return ln.vwap[gi - ln.startIdx];
      });
      avwapSvg += pathFromSeries(clipRange(mapped), xFor, yFor, ln.color, 1.5, "8 4");
      const lastV = mapped.filter((v) => v != null).slice(-1)[0];
      if (lastV != null) {
        avwapSvg += `<text x="${(xPlotRight - 4).toFixed(1)}" y="${(overlayYFor(lastV) - 3).toFixed(1)}" text-anchor="end" fill="${ln.color}" font-size="9.5" font-weight="600">${escapeHtml(ln.label)} AVWAP</text>`;
      }
    });
  }

  let trendSvg = "";
  if (!chartPanActive && chartState.showTrendlines) {
    const extendTo = rows.length - 1;
    computeAutoTrendlines(rows).forEach((ln) => {
      const dx = ln.x2 - ln.x1 || 1;
      const slope = (ln.y2 - ln.y1) / dx;
      const yEnd = ln.y2 + slope * (extendTo - ln.x2);
      const x1 = xFor(ln.x1);
      const x2 = xFor(extendTo);
      trendSvg += `<line x1="${x1.toFixed(1)}" y1="${overlayYFor(ln.y1).toFixed(1)}" x2="${x2.toFixed(1)}" y2="${overlayYFor(yEnd).toFixed(1)}" stroke="${ln.color}" stroke-width="1.5" stroke-dasharray="7 4" opacity="0.85"></line>`
        + `<text x="${x1.toFixed(1)}" y="${(overlayYFor(ln.y1) - 4).toFixed(1)}" fill="${ln.color}" font-size="9.5" font-weight="700">${ln.kind === "sup" ? "지지 추세선" : "저항 추세선"}</text>`;
    });
  }

  let gapSvg = "";
  if (!chartPanActive && chartState.showGapZones) {
    detectUnfilledGapZones(rows).forEach((g) => {
      const x1 = xFor(g.startIdx);
      const yTop = overlayYFor(g.hi);
      const yBot = overlayYFor(g.lo);
      const h = Math.max(2, yBot - yTop);
      const stroke = g.type === "up" ? "var(--pos)" : "var(--neg)";
      gapSvg += `<rect x="${x1.toFixed(1)}" y="${yTop.toFixed(1)}" width="${(xPlotRight - x1).toFixed(1)}" height="${h.toFixed(1)}" fill="${stroke}" fill-opacity="0.12" stroke="${stroke}" stroke-width="0.8" stroke-dasharray="4 3" opacity="0.9"></rect>`
        + `<text x="${(x1 + 4).toFixed(1)}" y="${(yTop + 11).toFixed(1)}" fill="${stroke}" font-size="9.5" font-weight="700">${g.type === "up" ? "상승 갭" : "하락 갭"}</text>`;
    });
  }

  let techLevelSvg = "";
  const probRes = chartState.lastProbResult;
  const probTickerMatch = probRes && probRes.ticker === item.ticker;
  let tl = null;
  if (chartPanActive) {
    tl = lastTechLevelsOverlay;
  } else if (chartState.showTechLevels && window.MirProb && window.MirProb.computeTechnicalLevels) {
    tl = window.MirProb.computeTechnicalLevels(ctxRows, rows[rows.length - 1].c);
    lastTechLevelsOverlay = tl;
  } else if (chartState.showTechLevels && probTickerMatch) {
    tl = probRes.techLevels;
  }
  const tlTypes = chartState.techLevelTypes || {};
  if (tl && chartState.showTechLevels) {
    const hLine = (price, label, color, dash) => {
      const y = overlayYFor(price);
      return `<line x1="${padL.toFixed(1)}" y1="${y.toFixed(1)}" x2="${xPlotRight.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${color}" stroke-width="1" stroke-dasharray="${dash}" opacity="0.75"></line>`
        + `<text x="${(xPlotRight - 4).toFixed(1)}" y="${(y - 3).toFixed(1)}" text-anchor="end" fill="${color}" font-size="9.5" font-weight="600">${escapeHtml(label)}</text>`;
    };
    if (tl.pivots) {
      if (tlTypes.pivot) techLevelSvg += hLine(tl.pivots.pivot, `P ${chartPriceLabel(tl.pivots.pivot)}`, "#6366f1", "4 3");
      if (tlTypes.r1) techLevelSvg += hLine(tl.pivots.r1, `R1 ${chartPriceLabel(tl.pivots.r1)}`, "#a855f7", "3 4");
      if (tlTypes.r2) techLevelSvg += hLine(tl.pivots.r2, `R2 ${chartPriceLabel(tl.pivots.r2)}`, "#c084fc", "3 4");
      if (tlTypes.s1) techLevelSvg += hLine(tl.pivots.s1, `S1 ${chartPriceLabel(tl.pivots.s1)}`, "#0ea5e9", "3 4");
      if (tlTypes.s2) techLevelSvg += hLine(tl.pivots.s2, `S2 ${chartPriceLabel(tl.pivots.s2)}`, "#38bdf8", "3 4");
    }
    if (tl.fib && tl.fib.levels) {
      const fibColors = { fib0: "#78716c", fib236: "#d6d3d1", fib382: "#fbbf24", fib50: "#f59e0b", fib618: "#ea580c", fib100: "#57534e" };
      Object.entries(FIB_LEVEL_KEYS).forEach(([key, pct]) => {
        if (tlTypes[key] && tl.fib.levels[pct] != null) {
          techLevelSvg += hLine(tl.fib.levels[pct], `Fib ${pct}`, fibColors[key] || "#f59e0b", "6 4");
        }
      });
    }
    if (tl.atr) {
      if (tlTypes.stop) techLevelSvg += hLine(tl.atr.stop, `−2ATR ${chartPriceLabel(tl.atr.stop)}`, "#94a3b8", "2 3");
      if (tlTypes.tgt) techLevelSvg += hLine(tl.atr.target, `+2ATR ${chartPriceLabel(tl.atr.target)}`, "#94a3b8", "2 3");
      if (tlTypes.tgt2 && tl.atr.target2 != null) techLevelSvg += hLine(tl.atr.target2, `+4ATR ${chartPriceLabel(tl.atr.target2)}`, "#94a3b8", "2 3");
    }
    if (tl.linreg) {
      if (tlTypes.lrUpper) techLevelSvg += hLine(tl.linreg.upper, "LR+", "#94a3b8", "8 4");
      if (tlTypes.lrLower) techLevelSvg += hLine(tl.linreg.lower, "LR-", "#94a3b8", "8 4");
    }
    if (tlTypes.psar && tl.psar && tl.psar.values) {
      techLevelSvg += renderPsarDots(tl.psar.values, ctxRows, rows, xFor, overlayYFor);
    }
  }

  // Stacked indicator panels.
  let cursorY = padT + plotH + gap;
  let panelsSvg = "";
  for (const p of panels) {
    if (p.t === "volume") panelsSvg += renderVolumePanel(rows, xFor, padL, padL + plotW, cursorY, p.h, candleW);
    else if (p.t === "obv") panelsSvg += renderObvPanel(rows, xFor, padL, padL + plotW, cursorY, p.h);
    else if (p.t === "ad") panelsSvg += renderAdPanel(rows, xFor, padL, padL + plotW, cursorY, p.h);
    else if (p.t === "rsi") panelsSvg += renderRsiPanel(ctxCloses, xFor, padL, padL + plotW, cursorY, p.h, visN);
    else if (p.t === "macd") panelsSvg += renderMacdPanel(ctxCloses, xFor, padL, padL + plotW, cursorY, p.h, candleW, visN);
    else if (p.t === "stoch") panelsSvg += renderStochPanel(ctxRows, xFor, padL, padL + plotW, cursorY, p.h, visN);
    else if (p.t === "roc") panelsSvg += renderRocPanel(ctxCloses, xFor, padL, padL + plotW, cursorY, p.h, visN);
    else if (p.t === "momentum") panelsSvg += renderMomentumPanel(ctxCloses, xFor, padL, padL + plotW, cursorY, p.h, visN);
    else if (p.t === "williams") panelsSvg += renderWilliamsPanel(ctxRows, xFor, padL, padL + plotW, cursorY, p.h, visN);
    else if (p.t === "atr") panelsSvg += renderAtrPanel(ctxRows, xFor, padL, padL + plotW, cursorY, p.h, visN);
    else if (p.t === "adx") panelsSvg += renderAdxPanel(ctxRows, xFor, padL, padL + plotW, cursorY, p.h, visN);
    else if (p.t === "cci") panelsSvg += renderCciPanel(ctxRows, xFor, padL, padL + plotW, cursorY, p.h, visN);
    else if (p.t === "cmf") panelsSvg += renderCmfPanel(ctxRows, xFor, padL, padL + plotW, cursorY, p.h, visN);
    else if (p.t === "mfi") panelsSvg += renderMfiPanel(ctxRows, xFor, padL, padL + plotW, cursorY, p.h, visN);
    else if (p.t === "ttm") panelsSvg += renderTtmSqueezePanel(ctxRows, xFor, padL, padL + plotW, cursorY, p.h, candleW, visN);
    else if (p.t === "relative") panelsSvg += renderRelativePanel(item, rows, xFor, padL, padL + plotW, cursorY, p.h);
    else if (p.t === "compare") panelsSvg += renderComparePanel(item, rows, xFor, padL, padL + plotW, cursorY, p.h);
    cursorY += p.h + gap;
  }

  // Shared x-axis: date (or index) ticks + light vertical guides on the price plot.
  const tickCount = Math.min(6, Math.max(2, rows.length));
  const ticks = [];
  for (let k = 0; k < tickCount; k += 1) {
    const idx = Math.round((k / (tickCount - 1)) * (rows.length - 1));
    const anchor = k === 0 ? "start" : (k === tickCount - 1 ? "end" : "middle");
    const label = rows[idx] && rows[idx].d ? formatChartDate(rows[idx].d) : `${idx + 1}`;
    ticks.push({ x: xFor(idx), label, anchor });
  }
  const vGuides = ticks.map((t) => `<line x1="${t.x.toFixed(1)}" y1="${padT}" x2="${t.x.toFixed(1)}" y2="${padT + plotH}" class="chart-grid"></line>`).join("");
  const dateLabels = ticks.map((t) => `<text x="${t.x.toFixed(1)}" y="${(height - 8).toFixed(1)}" text-anchor="${t.anchor}" class="chart-axis">${escapeHtml(t.label)}</text>`).join("");

  const first = rows[0];
  const last = rows[rows.length - 1];
  const chartChange = pctFrom(last.c, first.c);
  const tfLabel = { D: "일봉", W: "주봉", M: "월봉" }[chartState.barTf] || "일봉";

  // 드로잉(추세선/피보) 좌표 매핑용 지오메트리 저장. times 는 날짜 앵커 ↔ 화면비율
  // 변환용(보이는 봉들의 타임스탬프, 오름차순).
  hydrateChartDrawings(item.ticker); // 저장된 드로잉 복원(최초 1회)
  lastChartGeom = {
    padL, plotW, padT, plotH, min, max, width, height, ticker: item.ticker,
    log: yLog, manual: yManual, scale: yScale, autoMin: autoRef.min, autoMax: autoRef.max,
    times: buildChartTimes(rows),
  };
  const isLine = chartState.chartType === "line";
  const isHeikin = chartState.chartType === "heikin";

  // 가격 축(오른쪽 여백) — 드래그·휠로 세로 배율, 더블클릭으로 자동 맞춤. 투명 히트 영역이
  // 커서(ns-resize)와 터치 대상을 맡는다. 현재가 태그는 새 스케일 위 좌표로 축에 붙인다.
  const axisW = width - xPlotRight;
  const lastY = yFor(last.c);
  const prevClose = rows.length > 1 ? rows[rows.length - 2].c : last.o;
  const lastTag = Number.isFinite(lastY) && lastY >= padT - 1 && lastY <= padT + plotH + 1
    ? `<g class="chart-last-tag ${last.c >= prevClose ? "is-up" : "is-down"}"><rect x="${(xPlotRight + 2).toFixed(1)}" y="${(lastY - 8).toFixed(1)}" width="${(axisW - 4).toFixed(1)}" height="16" rx="3"></rect><text x="${(width - 6).toFixed(1)}" y="${(lastY + 3.5).toFixed(1)}" text-anchor="end">${escapeHtml(chartPriceLabel(last.c))}</text></g>`
    : "";
  const axisHit = `<rect class="chart-yaxis-hit" data-yaxis="1" x="${xPlotRight.toFixed(1)}" y="${padT}" width="${axisW.toFixed(1)}" height="${plotH}"><title>가격 축: 위아래로 끌어 세로 배율 조정 · 휠로 확대/축소 · 더블클릭 자동 맞춤</title></rect>`;
  // 모서리 토글(A=자동 맞춤, L=로그). 가격 축 아래 칸(플롯 바닥 ~ 다음 패널 사이)에 둔다.
  const btnW = Math.min(22, (axisW - 6) / 2);
  const btnY = padT + plotH + 2;
  const yBtn = (key, label, on, x, title) => `<g class="chart-yscale-btn${on ? " is-on" : ""}" data-yscale="${key}" role="button" tabindex="0" aria-pressed="${on ? "true" : "false"}" aria-label="${title}"><title>${title}</title><rect x="${x.toFixed(1)}" y="${btnY.toFixed(1)}" width="${btnW.toFixed(1)}" height="14" rx="3"></rect><text x="${(x + btnW / 2).toFixed(1)}" y="${(btnY + 10.5).toFixed(1)}" text-anchor="middle">${label}</text></g>`;
  const yBtns = yBtn("auto", "A", !yManual, width - 4 - btnW * 2 - 2, yManual ? "세로 자동 맞춤 켜기(꺼짐)" : "세로 자동 맞춤(켜짐)")
    + yBtn("log", "L", yLog, width - 4 - btnW, yLog ? "로그 스케일 끄기(켜짐)" : "로그 스케일 켜기(꺼짐)");
  // 수동 범위에서는 가격 플롯 밖(보조 패널·헤더)으로 캔들·선이 넘치지 않게 자른다.
  const candleHalf = candleW / 2 + 1;
  const plotClip = yManual
    ? `<clipPath id="chartPlotClip"><rect x="${(padL - candleHalf).toFixed(1)}" y="${padT}" width="${(plotW + candleHalf * 2).toFixed(1)}" height="${plotH}"></rect></clipPath>`
    : "";
  const plotOpen = yManual ? `<g clip-path="url(#chartPlotClip)">` : "";
  const plotClose = yManual ? "</g>" : "";
  syncChartYScaleButtons();

  svg.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" rx="8" class="chart-bg"></rect>
    ${plotClip}
    ${vGuides}
    ${grid}
    ${plotOpen}
    ${isLine ? `<path d="${area}" class="chart-area"></path>` : ""}
    ${bollSvg}
    ${isLine ? "" : candles}
    ${isLine ? `<path d="${linePath}" class="chart-line"></path>` : ""}
    ${overlays}
    ${avwapSvg}
    ${srSvg}
    ${vpSvg}
    ${gapSvg}
    ${trendSvg}
    ${msSvg}
    ${chandelierSvg}
    ${patSvg}
    ${techLevelSvg}
    ${plotClose}
    <clipPath id="chartDrawClip"><rect x="${padL}" y="${yManual ? padT : 0}" width="${(width - padL).toFixed(1)}" height="${(yManual ? plotH : padT + plotH + 2).toFixed(1)}"></rect></clipPath>
    <g id="chartDrawLayer" clip-path="url(#chartDrawClip)">${renderChartDrawings()}</g>
    ${panelsSvg}
    <line x1="${padL}" y1="${padT + plotH}" x2="${padL + plotW}" y2="${padT + plotH}" class="chart-base"></line>
    ${dateLabels}
    <text x="${padL}" y="20" class="chart-label">${escapeHtml(stockLabel(item))} ${chartState.range} · ${tfLabel}${isHeikin ? " · Heikin" : ""} · ${rows.length}봉 · 종가 ${chartPriceLabel(last.c)} · ${fmtPct(chartChange)}</text>
    <text x="${padL}" y="36" class="chart-axis">${activeIndicatorLabels(item)}</text>
    ${lastTag}
    ${axisHit}
    ${yBtns}
  `;
}
