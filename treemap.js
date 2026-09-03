// treemap.js — 시장지도(트리맵) 전용
// ==================================
// app.js 에서 기계적으로 분리한 클래식 스크립트(모듈 아님). index.html 이 app.js 보다
// 먼저 싣고 같은 전역 스코프를 공유한다. 선언만 있고 로드 시점 실행문이 없다.
// 담는 것: 필터(filteredStocks·bucketMatches), MAP_METRIC_CONFIG 와 색 스케일,
// 커버리지 게이트, 피어 인덱스, 렌더/줌/범례, 타일 배치(squarify), 호버 캐시와
// 툴팁, 클릭 위임, 히트맵 공유 딥링크.
// 이름 충돌은 scripts/check_global_name_collisions.py 가 감시한다.

function filteredStocks() {
  const bucket = byId("bucketFilter").value;
  const sector = byId("sectorFilter").value;
  return data.stocks.filter((item) => {
    const groups = item.groups || [item.bucket].filter(Boolean);
    const bucketOk = bucketMatches(item, groups, bucket);
    const sectorOk = sector === "All" || item.sector === sector;
    return bucketOk && sectorOk;
  });
}

function bucketMatches(item, groups, bucket) {
  const cfg = marketCfg();
  if (cfg.matchBucket) return cfg.matchBucket(item, groups, bucket);
  return groups.includes(bucket) || item.bucket === bucket;
}

// 시장지도 펀더멘털 지표 설정 (finviz map 스타일: 지표별 임계값으로 초록↔빨강)
//  good:'low'  → 값이 낮을수록 초록(저평가·저비용), 높을수록 빨강 (예: P/E 20 미만 초록)
//  good:'high' → 값이 높을수록 초록(고수익성·고배당), 낮을수록 빨강
//  stops 는 오름차순 경계값. fmt: num(배수) | pct(%) | usd($)
const MAP_METRIC_CONFIG = {
  pe:        { label: "P/E",            good: "low",  fmt: "num", stops: [10, 15, 20, 30, 50] },
  forwardPE: { label: "Forward P/E",    good: "low",  fmt: "num", stops: [10, 15, 20, 30, 50] },
  peg:       { label: "PEG",            good: "low",  fmt: "num", stops: [0.5, 1, 1.5, 2, 3] },
  ps:        { label: "P/S",            good: "low",  fmt: "num", stops: [1, 2, 4, 8, 12] },
  pb:        { label: "P/B",            good: "low",  fmt: "num", stops: [1, 2, 3, 6, 10] },
  pfcf:      { label: "P/FCF",          good: "low",  fmt: "num", stops: [15, 25, 40, 60, 90] },
  evEbitda:  { label: "EV/EBITDA",      good: "low",  fmt: "num", stops: [6, 9, 12, 18, 25] },
  // KR 전용. DART 는 감가상각비를 본문에 싣는 회사가 9% 뿐이라 EBITDA 를 만들 수 없어
  // 분모를 영업이익(EBIT)으로 둔다. EBITDA 보다 분모가 작아 배수가 높게 나오므로
  // 구간도 EV/EBITDA 보다 위로 잡는다. 두 지표를 한 옵션으로 합치지 않는 이유는
  // 감가상각이 큰 업종일수록 둘이 크게 벌어져 같은 이름으로 부를 수 없기 때문이다.
  evEbit:    { label: "EV/EBIT",        good: "low",  fmt: "num", stops: [8, 12, 16, 24, 35] },
  // DART 가 완제품으로 주는 지표(KR 전용). 직접 계산하면 분기/연간 혼동과 업종별 계정
  // 차이에 다시 걸리므로 DART 값을 그대로 쓴다. 미국 상세엔 이 키가 없어서 커버리지
  // 게이트가 알아서 숨긴다.
  revenueGrowth:   { label: "매출 성장률(YoY)",   good: "high", fmt: "pct", stops: [-10, 0, 10, 25, 50] },
  operatingGrowth: { label: "영업이익 성장률(YoY)", good: "high", fmt: "pct", stops: [-20, 0, 15, 40, 80] },
  netGrowth:       { label: "순이익 성장률(YoY)",  good: "high", fmt: "pct", stops: [-20, 0, 15, 40, 80] },
  debtRatio:       { label: "부채비율",          good: "low",  fmt: "pct", stops: [50, 100, 150, 250, 400] },
  currentRatio:    { label: "유동비율",          good: "high", fmt: "pct", stops: [80, 120, 160, 220, 300] },
  payoutRatio:     { label: "배당성향",          good: "high", fmt: "pct", stops: [0, 10, 20, 35, 55] },
  divYield:  { label: "Dividend Yield", good: "high", fmt: "pct", stops: [0.5, 1, 2, 3, 5] },
  eps:       { label: "EPS",            good: "high", fmt: "usd", stops: [0, 1, 3, 6, 10] },
  roe:       { label: "ROE",            good: "high", fmt: "pct", stops: [0, 5, 10, 17, 25] },
  roa:       { label: "ROA",            good: "high", fmt: "pct", stops: [0, 3, 6, 10, 15] },
  netMargin: { label: "Net Margin",     good: "high", fmt: "pct", stops: [0, 5, 10, 20, 30] },
  // KRX 공식(build_kr_krx_metrics.py) — KR 전용. 한도소진율은 외국인 보유한도가 있는
  // 통신·유틸 외엔 지분율과 같다(SKT 지분 38% vs 한도소진 78%). '높을수록 초록'은
  // 가치판단이 아니라 외국인 관심/여력을 초록으로 읽는 관례적 방향이다.
  foreignPct:        { label: "외국인 지분율",     good: "high", fmt: "pct", stops: [3, 8, 15, 25, 40] },
  foreignExhaustion: { label: "외국인 한도소진율",  good: "high", fmt: "pct", stops: [10, 25, 45, 65, 85] },
  // 저평가 종합(멀티플 백분위 평균, build_map_fundamentals.add_value_score). 100=저평가.
  // 예측 점수가 아니라 PER·PBR·배당수익률 상 상대적으로 싼지를 한 값으로 요약한 것.
  valueScore:        { label: "저평가 종합(멀티플)", good: "high", fmt: "num", stops: [30, 45, 55, 70, 85] },
};
const MAP_METRIC_STOPS_KR = {
  pe: [8, 12, 18, 28, 45],
  forwardPE: [8, 12, 18, 28, 45],
  pb: [0.8, 1.5, 2.5, 4, 8],
  ps: [0.8, 2, 4, 8, 15],
  evEbitda: [5, 8, 12, 18, 28],
};
const VAL_CAP_BUCKETS = {
  us: [
    ["all", "전체"],
    ["gte10b", "대형(10B+)"],
    ["1to10b", "중형(1~10B)"],
    ["lt1b", "소형(<1B)"],
  ],
  kr: [
    ["all", "전체"],
    ["gte10t", "시총 10조 이상"],
    ["gte1t", "시총 1조~10조"],
    ["gte100b", "시총 1천억~1조"],
    ["lt100b", "시총 1천억 미만"],
  ],
};

function mapMetricConfig(metric) {
  const base = MAP_METRIC_CONFIG[metric];
  if (!base || !isKrMarket()) return base;
  const stops = MAP_METRIC_STOPS_KR[metric];
  return stops ? { ...base, stops } : base;
}

// 지표를 고를 수 있게 하려면 '값이 있는 종목' 이 이 정도는 돼야 한다. 개수만 보면
// US pfcf(26건)·evEbitda(47건) 처럼 몇십 건 있는 지표가 통과해버린다 — 그건 화면의
// 99% 가 중립색이라는 뜻이라 없느니만 못하다. 그래서 비율을 함께 본다.
const METRIC_MIN_COVERAGE = 20;      // 절대 개수 하한(아주 작은 유니버스 보호)
const METRIC_MIN_COVERAGE_RATIO = 0.1;
let _metricCoverage = null;

// MAP_FUNDAMENTALS 안에 각 지표가 몇 종목이나 있는지. 시장이 바뀌면 다시 센다.
function fundamentalMetricCoverage() {
  if (_metricCoverage) return _metricCoverage;
  const counts = {};
  const rows = Object.values(window.MAP_FUNDAMENTALS || {});
  for (const row of rows) {
    if (!row) continue;
    for (const [k, v] of Object.entries(row)) {
      if (Number.isFinite(v)) counts[k] = (counts[k] || 0) + 1;
    }
  }
  _metricCoverage = { counts, total: rows.length };
  return _metricCoverage;
}

function metricHasEnoughData(metric) {
  const { counts, total } = fundamentalMetricCoverage();
  const n = counts[metric] || 0;
  if (!total) return true;            // 아직 로드 전이면 막지 않는다
  return n >= METRIC_MIN_COVERAGE && n / total >= METRIC_MIN_COVERAGE_RATIO;
}

// 데이터가 없는 지표를 고르면 히트맵이 통째로 '데이터 없음'(중립색)이 된다. 시장마다
// 커버리지가 달라서 옵션을 HTML 에 하드코딩해두면 그 사실이 화면 어디에도 안 드러난다
// — KR 은 ROA·P/S 가 아예 없었고, PEG·P/FCF·EV/EBITDA 는 US 에서도 1% 미만이다.
// 값이 생기면 자동으로 다시 나타나므로 목록을 손으로 관리할 필요가 없다.
function pruneFundamentalMetricOptions(selectId, fallback) {
  const sel = byId(selectId);
  if (!sel) return;
  let hidSelected = false;
  sel.querySelectorAll("option").forEach((opt) => {
    if (!MAP_METRIC_CONFIG[opt.value]) return;      // 등락률·점수는 스냅샷에 항상 있다
    const enough = metricHasEnoughData(opt.value);
    opt.hidden = !enough;
    opt.disabled = !enough;
    if (!enough && sel.value === opt.value) hidSelected = true;
  });
  if (hidSelected) sel.value = fallback;
}

function refreshFundamentalMetricOptions() {
  _metricCoverage = null;
  pruneFundamentalMetricOptions("metricFilter", "changePct");
  pruneFundamentalMetricOptions("valMetric", "pe");
}

function itemCapForValuation(item) {
  if (isKrMarket()) return Number(item.marketCapT ?? item.marketCapB ?? 0);
  return Number(item.marketCapB ?? 0);
}
// 초록(저평가/우수) → 빨강(고평가/부진) 6단계 팔레트
const MAP_FUND_PALETTE = ["#006b35", "#20a05a", "#64ad65", "#b26a4a", "#b6463f", "#6f1d2a"];
const MAP_NODATA_COLOR = "#475467"; // 데이터 없음 중립색

function mapFundamentalsFor(ticker) {
  const key = normalizeTickerKey(ticker);
  return (window.MAP_FUNDAMENTALS || {})[key] || (window.MAP_FUNDAMENTALS || {})[ticker] || null;
}

// 지도 타일/평균에서 쓸 지표 값. 펀더멘털 지표는 별도 lookup, 그 외는 종목 객체.
// 펀더멘털 누락 시 null(→데이터 없음), 변동률/점수 누락 시 0(기존 동작 유지).
// (주의: 화면 하단 종목 스크리너용 metricValue 와 별개 함수 — 이름 충돌 방지)
function mapMetricValue(item, metric) {
  if (!item) return null;
  if (MAP_METRIC_CONFIG[metric]) {
    const f = mapFundamentalsFor(item.ticker);
    const v = f ? f[metric] : null;
    return Number.isFinite(v) ? v : null;
  }
  const v = Number(item[metric]);
  // RSI·EPS 는 결측 시 0 이 아니라 null(→ 중립색·"—")로 취급해 색을 칠하지 않는다.
  if (metric === "rsi14" || metric === "epsTtm") return Number.isFinite(v) ? v : null;
  return Number.isFinite(v) ? v : 0;
}

function fundamentalColor(value, cfg) {
  if (!Number.isFinite(value)) return MAP_NODATA_COLOR;
  const stops = cfg.stops;
  let idx = stops.findIndex((s) => value < s);
  if (idx === -1) idx = stops.length; // 모든 경계 이상
  const bins = stops.length + 1;
  let p = idx / (bins - 1); // 0(작음)~1(큼)
  if (cfg.good === "high") p = 1 - p;
  const pi = Math.round(p * (MAP_FUND_PALETTE.length - 1));
  return MAP_FUND_PALETTE[Math.max(0, Math.min(MAP_FUND_PALETTE.length - 1, pi))];
}

function metricColor(value, metric) {
  const cfg = MAP_METRIC_CONFIG[metric];
  if (cfg) {
    const num = (value === null || value === undefined || value === "") ? NaN : Number(value);
    return fundamentalColor(num, cfg);
  }
  // RSI(14): 발산형 색상 — 과매도(<30) 초록(반등 여지) ↔ 과매수(>70) 빨강(과열), 50 중립.
  if (metric === "rsi14") {
    const r = (value === null || value === undefined || value === "") ? NaN : Number(value);
    if (!Number.isFinite(r)) return MAP_NODATA_COLOR; // 합성 히스토리 등 결측 → 중립
    if (r >= 80) return "#9f2f2f";
    if (r >= 70) return "#b6463f";
    if (r >= 60) return "#a86933";
    if (r > 40) return "#7a8088";
    if (r > 30) return "#5ca044";
    if (r > 20) return "#159447";
    return "#007a3d";
  }
  // EPS(TTM): 높을수록 초록, 적자(≤0)는 빨강. 통화 스케일이 시장마다 달라 구간을 분리.
  if (metric === "epsTtm") {
    const e = (value === null || value === undefined || value === "") ? NaN : Number(value);
    if (!Number.isFinite(e)) return MAP_NODATA_COLOR;
    if (e <= 0) return "#9f2f2f";
    if (isKrMarket()) {
      if (e >= 3000) return "#006b35";
      if (e >= 1000) return "#159447";
      if (e >= 300) return "#5ca044";
      return "#7a8088";
    }
    if (e >= 5) return "#006b35";
    if (e >= 2) return "#159447";
    if (e >= 0.5) return "#5ca044";
    return "#7a8088";
  }
  const v = Number(value);
  if (metric === "stochK") {
    if (v >= 85) return "#007a3d";
    if (v >= 70) return "#159447";
    if (v >= 55) return "#5ca044";
    if (v >= 45) return "#7a8088";
    if (v >= 30) return "#a86933";
    return "#9f2f2f";
  }
  if (v >= 5) return "#006b35";
  if (v >= 3) return "#008f46";
  if (v >= 1) return "#20a05a";
  if (v > 0) return "#64ad65";
  if (v === 0) return "#667085";
  if (v > -1) return "#b26a4a";
  if (v > -3) return "#b6463f";
  if (v > -5) return "#982f36";
  return "#6f1d2a";
}

let zoomView = null; // null | { sector } | { sector, industry }
let treemapFocusTicker = null;
let treemapFocusTimer = null;
// 툴팁 피어 목록(산업군/섹터별, 시총순) — 스냅샷당 한 번만 만든다. 예전엔 마우스가 움직일
// 때마다 전 종목을 두 번씩 필터했다.
let _treemapPeerIndex = null;
function treemapPeerIndex() {
  if (_treemapPeerIndex) return _treemapPeerIndex;
  const byIndustry = new Map();
  const bySector = new Map();
  (data.stocks || []).slice()
    .sort((a, b) => sizeWeight(b, "marketCapB") - sizeWeight(a, "marketCapB"))
    .forEach((s) => {
      const ind = s.industry || "Other";
      const sec = s.sector || "Other";
      if (!byIndustry.has(ind)) byIndustry.set(ind, []);
      byIndustry.get(ind).push(s);
      if (!bySector.has(sec)) bySector.set(sec, []);
      bySector.get(sec).push(s);
    });
  _treemapPeerIndex = { byIndustry, bySector };
  return _treemapPeerIndex;
}
// 폭 0 이라 못 그린 렌더 요청. 지도가 보이게 되면(폭 > 0) 한 번 그린다.
let _treemapPending = false;
function setupTreemapVisibilityWatch() {
  const map = byId("stockTreemap");
  if (!map || map.dataset.visWatch || typeof ResizeObserver === "undefined") return;
  map.dataset.visWatch = "1";
  new ResizeObserver((entries) => {
    const w = entries[0]?.contentRect?.width || 0;
    if (w > 0 && _treemapPending && currentTab === "map") renderTreemap();
  }).observe(map);
}
// 마지막으로 hover 한 대상 키("t:티커" | "i:섹터|산업" | "s:섹터"). 같은 대상 위에서 움직이면
// 툴팁 위치만 옮기고 패널·툴팁 HTML 은 다시 만들지 않는다.
let _lastHoverKey = null;

function renderTreemap() {
  const metric = byId("metricFilter").value;
  const sizeMetric = byId("tileSizeFilter").value;
  const query = byId("heatmapSearch").value.trim();
  const map = byId("stockTreemap");
  const width = map.clientWidth;
  // 숨겨진 탭(폭 0)에서 그리면 레이아웃이 깨진 채 남으므로 렌더하지 않음. 예전엔 지도 탭이
  // current 인 채로 가려진 상태(AI 모드 차트 뷰)에서 rAF 로 초당 ~80회 재시도했다. 이제 '그려야
  // 함' 만 표시하고, 폭이 생기는 순간(ResizeObserver, setupTreemapVisibilityWatch) 한 번 그린다.
  if (!width) {
    _treemapPending = true;
    return;
  }
  _treemapPending = false;
  const height = map.clientHeight || 720;

  renderLegend(metric);
  treemapPeerIndex();
  _lastHoverKey = null;

  const all = filteredStocks();
  if (!all.length) {
    const bucket = byId("bucketFilter").value;
    let emptyMsg = "조건에 맞는 종목이 없습니다.";
    if (bucket === "watchlist") emptyMsg = "관심종목이 없습니다. 종목 분석에서 를 눌러 관심종목에 추가해 보세요.";
    else if (bucket === "portfolio") emptyMsg = "보유종목이 없습니다. 포트폴리오 탭에서 보유 종목을 추가해 보세요.";
    map.innerHTML = `<div class="heatmap-empty">${escapeHtml(emptyMsg)}</div>`;
    zoomView = null;
    const fallback = selectedBaseRow() || data.stocks[0];
    if (fallback) renderSelected(fallback);
    return;
  }

  // Zoomed view: a sector or a single industry fills the whole heatmap.
  if (zoomView) {
    const scoped = all.filter((s) => s.sector === zoomView.sector
      && (!zoomView.industry || (s.industry || "Other") === zoomView.industry));
    if (scoped.length) { renderTreemapZoom(scoped, metric, sizeMetric, query, width, height); return; }
    zoomView = null;
  }

  const stocks = all.slice().sort((a, b) => sizeWeight(b, sizeMetric) - sizeWeight(a, sizeMetric));
  const sectors = [...new Set(stocks.map((item) => item.sector))].map((sector) => {
    const children = stocks.filter((item) => item.sector === sector);
    return {
      sector,
      children,
      weight: children.reduce((sum, item) => sum + sizeWeight(item, sizeMetric), 0),
      change: average(children, metric)
    };
  }).sort((a, b) => sectorRank(a.sector) - sectorRank(b.sector) || b.weight - a.weight);

  const sectorRects = squarify(sectors, { x: 0, y: 0, w: width, h: height }, (item) => item.weight);
  map.innerHTML = sectorRects.map(({ item: sector, rect }) => {
    const inner = insetRect({ x: 0, y: 0, w: rect.w, h: rect.h }, 3, 22, 3, 3);
    const industries = groupIndustries(sector.children, metric, sizeMetric);
    const industryRects = squarify(industries, inner, (item) => item.weight);
    return `
      <section class="sector-box" data-sector="${escapeHtml(sector.sector)}" style="${rectStyle(rect)}">
        <div class="sector-title" data-zoom-sector="${escapeHtml(sector.sector)}" title="클릭하면 ${escapeHtml(sector.sector)} 확대">${escapeHtml(sector.sector)} · ${fmtMetric(sector.change, metric)} </div>
        ${industryRects.map(({ item: industry, rect: industryRect }) => industryBox(sector.sector, industry, industryRect, metric, sizeMetric, query)).join("")}
      </section>
    `;
  }).join("");
  // 클릭(타일 선택 / 산업·섹터 확대 / 전체 보기)은 handleHeatmapClick 이 위임으로 처리한다.

  renderSelected(stocks.find((item) => item.ticker === selectedTicker) || stocks[0] || data.stocks[0]);
  pulseTreemapFocusTile();
}

function focusTreemapTicker(ticker, options = {}) {
  const stock = stockByTicker(ticker);
  if (!stock) return;
  treemapFocusTicker = stock.ticker;
  selectedTicker = stock.ticker;
  zoomView = { sector: stock.sector, industry: stock.industry || "Other" };
  const search = byId("heatmapSearch");
  if (search) search.value = stock.ticker;
  if (options.openMap !== false && currentTab !== "map") {
    activateTab("map", { push: Boolean(options.push), ticker: stock.ticker });
    return;
  }
  renderTreemap();
  renderSelected(stock);
}

function pulseTreemapFocusTile() {
  if (!treemapFocusTicker) return;
  clearTimeout(treemapFocusTimer);
  treemapFocusTimer = setTimeout(() => {
    const tile = byId("stockTreemap")?.querySelector(`.heat-tile[data-ticker="${treemapFocusTicker}"]`);
    if (tile) tile.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    treemapFocusTimer = setTimeout(() => {
      treemapFocusTicker = null;
      // 클래스 하나 떼려고 지도를 통째로 다시 그리지 않는다.
      byId("stockTreemap")?.querySelectorAll(".heat-tile.is-focus-pulse").forEach((el) => el.classList.remove("is-focus-pulse"));
    }, 3200);
  }, 60);
}

function renderTreemapZoom(scoped, metric, sizeMetric, query, width, height) {
  const map = byId("stockTreemap");
  const headerH = 34;
  const inner = { x: 0, y: headerH, w: width, h: height - headerH };
  const crumb = zoomView.industry ? `${zoomView.sector} · ${zoomView.industry}` : zoomView.sector;
  const header = `
    <div class="treemap-zoom-header">
      <button type="button" id="treemapBack" class="treemap-back">← 전체 보기</button>
      <span>${escapeHtml(crumb)} · ${fmtMetric(average(scoped, metric), metric)} · ${scoped.length}종목</span>
    </div>`;

  if (zoomView.industry) {
    const sorted = scoped.slice().sort((a, b) => sizeWeight(b, sizeMetric) - sizeWeight(a, sizeMetric));
    const rects = squarify(sorted, inner, (item) => sizeWeight(item, sizeMetric));
    map.innerHTML = header + rects.map(({ item, rect }) => heatTile(item, rect, metric, query)).join("");
  } else {
    const industries = groupIndustries(scoped, metric, sizeMetric);
    const industryRects = squarify(industries, inner, (item) => item.weight);
    map.innerHTML = header + industryRects
      .map(({ item: industry, rect }) => industryBox(zoomView.sector, industry, rect, metric, sizeMetric, query)).join("");
  }
  // 클릭은 handleHeatmapClick(위임) 이 처리한다.
  renderSelected(scoped.find((item) => item.ticker === selectedTicker) || scoped[0]);
  pulseTreemapFocusTile();
}

function sectorRank(sector) {
  const order = [
    "TECHNOLOGY",
    "COMMUNICATION SERVICES",
    "CONSUMER CYCLICAL",
    "HEALTHCARE",
    "FINANCIAL",
    "CONSUMER DEFENSIVE",
    "INDUSTRIALS",
    "REAL ESTATE",
    "ENERGY",
    "UTILITIES",
    "BASIC MATERIALS",
    "EXCHANGE TRADED FUNDS"
  ];
  const index = order.indexOf(sector);
  return index === -1 ? 99 : index;
}

function groupIndustries(children, metric, sizeMetric) {
  const groups = [...new Set(children.map((item) => item.industry || "Other"))].map((industry) => {
    const stocks = children
      .filter((item) => (item.industry || "Other") === industry)
      .sort((a, b) => sizeWeight(b, sizeMetric) - sizeWeight(a, sizeMetric));
    return {
      industry,
      stocks,
      weight: stocks.reduce((sum, item) => sum + sizeWeight(item, sizeMetric), 0),
      change: average(stocks, metric)
    };
  });
  return groups.sort((a, b) => b.weight - a.weight);
}

function industryBox(sector, industry, rect, metric, sizeMetric, query) {
  const showTitle = rect.w > 86 && rect.h > 42;
  const inner = showTitle
    ? insetRect({ x: 0, y: 0, w: rect.w, h: rect.h }, 2, 15, 2, 2)
    : insetRect({ x: 0, y: 0, w: rect.w, h: rect.h }, 1, 1, 1, 1);
  const stockRects = squarify(industry.stocks, inner, (item) => sizeWeight(item, sizeMetric));
  return `
    <section class="industry-box" data-sector="${escapeHtml(sector)}" data-industry="${escapeHtml(industry.industry)}" style="${rectStyle(rect)}">
      ${showTitle ? `<div class="industry-title">${escapeHtml(industry.industry)} · ${fmtMetric(industry.change, metric)}</div>` : ""}
      ${stockRects.map(({ item, rect: stockRect }) => heatTile(item, stockRect, metric, query)).join("")}
    </section>
  `;
}

function fmtLegendNum(v, cfg) {
  if (cfg.fmt === "pct") return `${v}%`;
  if (cfg.fmt === "usd") return `$${v}`;
  return `${v}`;
}

function renderLegend(metric) {
  const legend = byId("heatmapLegend");
  const cfg = MAP_METRIC_CONFIG[metric];
  if (cfg) {
    const stops = cfg.stops;
    // 각 구간 대표값(해당 bin에 들어가는 값)으로 색을 칠한다.
    const reps = [stops[0] - 0.001, ...stops];
    const labels = [`<${fmtLegendNum(stops[0], cfg)}`];
    for (let i = 0; i < stops.length - 1; i++) {
      labels.push(`${fmtLegendNum(stops[i], cfg)}–${fmtLegendNum(stops[i + 1], cfg)}`);
    }
    labels.push(`≥${fmtLegendNum(stops[stops.length - 1], cfg)}`);
    const cells = labels.map((label, i) => (
      `<div class="legend-cell" style="background:${metricColor(reps[i], metric)}">${label}</div>`
    ));
    cells.push(`<div class="legend-cell" style="background:${MAP_NODATA_COLOR}">데이터없음</div>`);
    legend.innerHTML = cells.join("");
    return;
  }
  if (metric === "rsi14") {
    const cells = [["과매도 ≤30", 25], ["30", 32], ["40", 40], ["50", 50], ["60", 62], ["70", 72], ["과매수 ≥80", 82]];
    legend.innerHTML = cells.map(([label, value]) => (
      `<div class="legend-cell" style="background:${metricColor(value, metric)}">${label}</div>`
    )).join("") + `<div class="legend-cell" style="background:${MAP_NODATA_COLOR}">데이터없음</div>`;
    return;
  }
  if (metric === "epsTtm") {
    const cells = isKrMarket()
      ? [["적자", -1], ["≥0", 1], ["≥300", 300], ["≥1천", 1000], ["≥3천", 3000]]
      : [["적자", -1], ["≥0", 0.1], ["≥0.5", 0.5], ["≥2", 2], ["≥5", 5]];
    legend.innerHTML = cells.map(([label, value]) => (
      `<div class="legend-cell" style="background:${metricColor(value, metric)}">${label}</div>`
    )).join("") + `<div class="legend-cell" style="background:${MAP_NODATA_COLOR}">데이터없음</div>`;
    return;
  }
  const cells = metric === "stochK"
    ? [
        ["0", 10], ["30", 30], ["45", 45], ["55", 55], ["70", 70], ["85", 85], ["100", 100]
      ]
    : [
        ["-5%↓", -6], ["-3%", -3], ["-1%", -1], ["0", 0], ["+1%", 1], ["+3%", 3], ["+5%↑", 6]
      ];
  legend.innerHTML = cells.map(([label, value]) => (
    `<div class="legend-cell" style="background:${metricColor(value, metric)}">${label}</div>`
  )).join("");
}

function heatTile(item, rect, metric, query) {
  const value = mapMetricValue(item, metric);
  const isSelected = item.ticker === selectedTicker;
  const isFocused = item.ticker === treemapFocusTicker;
  const isMatch = query && heatmapItemMatchesQuery(item, query);
  const isDimmed = query && !isMatch;
  const label = fmtMetric(value, metric);
  const area = rect.w * rect.h;
  const sizeClass = area > 55000 ? " is-large" : area > 18000 ? " is-medium" : area > 6500 ? " is-small" : " is-tiny";
  const kr = isKrMarket();
  const showPrimary = rect.w > 42 && rect.h > 26;
  const showCompanySub = !kr && rect.w > 110 && rect.h > 70;
  const showMetric = rect.w > 62 && rect.h > 48;
  const primaryText = kr ? item.company : item.ticker;
  const titleText = kr
    ? `${item.company} · ${label} · ${marketCfg().formatPrice(item.price)}`
    : `${item.ticker} · ${item.company} · ${label} · ${priceOrDash(item.price)}`;
  return `
    <button
      class="heat-tile${sizeClass}${isSelected ? " is-selected" : ""}${isFocused ? " is-focus-pulse" : ""}${isMatch ? " is-match" : ""}${isDimmed ? " is-dimmed" : ""}"
      style="${rectStyle(rect)} background:${metricColor(value, metric)}"
      data-ticker="${escapeHtml(item.ticker)}"
      data-sector="${escapeHtml(item.sector)}"
      data-industry="${escapeHtml(item.industry)}"
      title="${escapeHtml(titleText)}"
    >
      ${showPrimary ? `<strong>${escapeHtml(primaryText)}</strong>` : ""}
      ${showCompanySub ? `<span>${escapeHtml(item.company)}</span>` : ""}
      ${showMetric ? `<small>${label}</small>` : ""}
    </button>
  `;
}

function handleHeatmapPointer(event) {
  const map = byId("stockTreemap");
  const tile = event.target.closest(".heat-tile");
  if (tile && map.contains(tile)) {
    const key = `t:${tile.dataset.ticker}`;
    if (key === _lastHoverKey) { positionHeatmapTooltip(event); return; }
    const item = stockByTicker(tile.dataset.ticker);
    if (item) {
      _lastHoverKey = key;
      renderSelected(item);
      showHeatmapTooltip(stockTooltip(item), event);
    }
    return;
  }

  const industry = event.target.closest(".industry-box");
  if (industry && map.contains(industry)) {
    const key = `i:${industry.dataset.sector}|${industry.dataset.industry}`;
    if (key === _lastHoverKey) { positionHeatmapTooltip(event); return; }
    _lastHoverKey = key;
    showHeatmapTooltip(groupTooltip({
      type: "industry",
      sector: industry.dataset.sector,
      industry: industry.dataset.industry
    }), event);
    return;
  }

  const sector = event.target.closest(".sector-box");
  if (sector && map.contains(sector)) {
    const key = `s:${sector.dataset.sector}`;
    if (key === _lastHoverKey) { positionHeatmapTooltip(event); return; }
    _lastHoverKey = key;
    showHeatmapTooltip(groupTooltip({
      type: "sector",
      sector: sector.dataset.sector
    }), event);
    return;
  }

  hideHeatmapTooltip();
}

// 지도 클릭 위임(렌더마다 리스너를 다시 붙이지 않는다). 타일 = 종목 선택(터치에서도 한 번에),
// 산업 상자/제목·섹터 제목 = 확대, ← 전체 보기 = 확대 해제.
function handleHeatmapClick(event) {
  const map = byId("stockTreemap");
  if (!map) return;
  const tile = event.target.closest(".heat-tile");
  if (tile && map.contains(tile)) {
    event.stopPropagation();
    selectTicker(tile.dataset.ticker, { openSearch: true });
    return;
  }
  if (event.target.closest("#treemapBack")) {
    event.stopPropagation();
    zoomView = null;
    renderTreemap();
    return;
  }
  const title = event.target.closest(".sector-title[data-zoom-sector]");
  if (title && map.contains(title)) {
    event.stopPropagation();
    zoomView = { sector: title.dataset.zoomSector };
    renderTreemap();
    return;
  }
  const box = event.target.closest(".industry-box");
  if (box && map.contains(box)) {
    event.stopPropagation();
    zoomView = { sector: box.dataset.sector, industry: box.dataset.industry };
    renderTreemap();
  }
}

function ensureHeatmapTooltip() {
  let tooltip = byId("heatmapTooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "heatmapTooltip";
    tooltip.className = "heatmap-tooltip";
    tooltip.setAttribute("role", "status");
    document.body.appendChild(tooltip);
  }
  return tooltip;
}

function showHeatmapTooltip(html, event) {
  const tooltip = ensureHeatmapTooltip();
  tooltip.innerHTML = html;
  positionHeatmapTooltip(event);
}

function positionHeatmapTooltip(event) {
  const tooltip = ensureHeatmapTooltip();
  tooltip.classList.add("is-visible");

  const gap = 16;
  const rect = tooltip.getBoundingClientRect();
  let left = event.clientX + gap;
  let top = event.clientY + gap;
  if (left + rect.width > window.innerWidth - 8) left = event.clientX - rect.width - gap;
  if (top + rect.height > window.innerHeight - 8) top = event.clientY - rect.height - gap;
  tooltip.style.left = `${Math.max(8, left)}px`;
  tooltip.style.top = `${Math.max(8, top)}px`;
}

function hideHeatmapTooltip() {
  _lastHoverKey = null;
  const tooltip = byId("heatmapTooltip");
  if (tooltip) tooltip.classList.remove("is-visible");
}

function stockTooltip(item) {
  const metric = byId("metricFilter").value;
  const metricCfg = MAP_METRIC_CONFIG[metric];
  const idx = treemapPeerIndex();
  const notSelf = (rows) => (rows || []).filter((stockItem) => stockItem.ticker !== item.ticker).slice(0, 6);
  const peers = notSelf(idx.byIndustry.get(item.industry || "Other"));
  const peerRows = peers.length ? peers : notSelf(idx.bySector.get(item.sector || "Other"));

  return `
    <div class="tooltip-head">
      <div>
        <strong>${escapeHtml(item.ticker)}</strong>
        <span>${escapeHtml(item.company)}</span>
      </div>
      <div class="tooltip-price">
        <b>${priceOrDash(item.price)}</b>
        <em class="${cls(item.changePct)}">${fmtDailyPct(item.changePct)}</em>
      </div>
    </div>
    ${sparklineSvg(item.closeSeries, { width: 260, height: 76, color: item.changePct >= 0 ? "#22c55e" : "#ef4444" })}
    <div class="tooltip-facts">
      ${miniFact("Sector", item.sector)}
      ${miniFact("Industry", item.industry)}
      ${miniFact(metricCfg ? metricCfg.label : "Metric", fmtMetric(mapMetricValue(item, metric), metric))}
      ${miniFact("Volume", Number.isFinite(Number(item.volumeRatio)) ? `${Number(item.volumeRatio).toFixed(1)}x` : "—")}
    </div>
    <div class="tooltip-peers">
      <span>같은 산업군 / 주요 비교 종목</span>
      ${peerRows.map((peer) => peerTooltipRow(peer)).join("")}
    </div>
  `;
}

function groupTooltip(group) {
  const metric = byId("metricFilter").value;
  let rows = filteredStocks().filter((item) => item.sector === group.sector);
  if (group.type === "industry") rows = rows.filter((item) => item.industry === group.industry);
  const averageChange = average(rows, metric);
  const leaders = [...rows].sort((a, b) => b.changePct - a.changePct).slice(0, 4);
  const largest = [...rows].sort((a, b) => b.marketCapB - a.marketCapB).slice(0, 6);
  const title = group.type === "industry" ? group.industry : group.sector;

  return `
    <div class="tooltip-head">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(group.sector)} · ${rows.length} symbols</span>
      </div>
      <div class="tooltip-price">
        <b>${fmtMetric(averageChange, metric)}</b>
        <em>AVG</em>
      </div>
    </div>
    <div class="tooltip-facts">
      ${miniFact("Leaders", leaders.map((item) => item.ticker).join(", ") || "-")}
      ${miniFact("Largest", largest.slice(0, 3).map((item) => item.ticker).join(", ") || "-")}
    </div>
    <div class="tooltip-peers">
      <span>섹터/산업군 포함 종목</span>
      ${largest.map((item) => peerTooltipRow(item)).join("")}
    </div>
  `;
}

function peerTooltipRow(item) {
  return `
    <div class="peer-row">
      <strong>${escapeHtml(item.ticker)}</strong>
      ${sparklineSvg(item.closeSeries, { width: 76, height: 20, color: item.changePct >= 0 ? "#22c55e" : "#ef4444" })}
      <span>${priceOrDash(item.price)}</span>
      <em class="${cls(item.changePct)}">${fmtDailyPct(item.changePct)}</em>
    </div>
  `;
}

function miniFact(label, value) {
  return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function sparklineSvg(series, options = {}) {
  const values = Array.isArray(series) && series.length > 1 ? series.map(Number).filter(Number.isFinite) : [0, 0];
  const width = options.width || 120;
  const height = options.height || 34;
  const pad = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = pad + (index / (values.length - 1)) * (width - pad * 2);
    const y = height - pad - ((value - min) / range) * (height - pad * 2);
    return [x, y];
  });
  const path = points.map(([x, y], index) => `${index ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${path} L ${width - pad} ${height - pad} L ${pad} ${height - pad} Z`;
  const color = options.color || "#22c55e";
  return `
    <svg class="sparkline" viewBox="0 0 ${width} ${height}" aria-hidden="true">
      <path d="${area}" fill="${color}" opacity="0.16"></path>
      <path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>
  `;
}

function fmtMetric(value, metric) {
  const cfg = MAP_METRIC_CONFIG[metric];
  if (cfg) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
    const n = Number(value);
    if (cfg.fmt === "pct") return `${n.toFixed(1)}%`;
    if (cfg.fmt === "usd") return `$${n.toFixed(2)}`;
    return n.toFixed(n >= 100 ? 0 : 1); // 배수(P/E 등)
  }
  if (metric === "rsi14") {
    return Number.isFinite(Number(value)) ? `${Math.round(Number(value))}` : "—";
  }
  if (metric === "epsTtm") {
    return fmtEpsValue(value);
  }
  if (metric === "stochK") {
    return `${Math.round(Number(value) || 0)}`;
  }
  // 당일 등락률만 KR 상하한 클램프 대상 — 기간 수익률은 그대로.
  if (metric === "changePct") return fmtDailyPct(value || 0);
  return fmtPct(value || 0);
}

function sizeWeight(item, sizeMetric) {
  if (sizeMetric === "equal") return 1;
  const raw = Number(item[sizeMetric]);
  if (!Number.isFinite(raw)) return 1;
  if (sizeMetric === "volumeRatio") return Math.max(0.25, raw);
  if (sizeMetric.includes("Score")) return Math.max(1, raw);
  return Math.max(1, raw);
}

function average(items, metric) {
  if (!items || !items.length) return null;
  const vals = [];
  for (const item of items) {
    const v = mapMetricValue(item, metric);
    if (Number.isFinite(v)) vals.push(v);
  }
  if (!vals.length) return null;
  return vals.reduce((sum, v) => sum + v, 0) / vals.length;
}

function rectStyle(rect) {
  return `left:${rect.x.toFixed(2)}px;top:${rect.y.toFixed(2)}px;width:${Math.max(0, rect.w).toFixed(2)}px;height:${Math.max(0, rect.h).toFixed(2)}px;`;
}

function insetRect(rect, left, top, right, bottom) {
  return {
    x: rect.x + left,
    y: rect.y + top,
    w: Math.max(0, rect.w - left - right),
    h: Math.max(0, rect.h - top - bottom)
  };
}

function squarify(items, rect, weightFn) {
  if (!items.length || rect.w <= 0 || rect.h <= 0) return [];
  const totalWeight = items.reduce((sum, item) => sum + Math.max(0, weightFn(item)), 0) || 1;
  const totalArea = rect.w * rect.h;
  const queue = items
    .map((item) => ({ item, area: Math.max(0.1, weightFn(item)) / totalWeight * totalArea }))
    .sort((a, b) => b.area - a.area);
  const out = [];
  let box = { ...rect };
  let row = [];

  while (queue.length) {
    const next = queue[0];
    const side = Math.min(box.w, box.h);
    if (!row.length || worst(row.concat(next), side) <= worst(row, side)) {
      row.push(queue.shift());
    } else {
      box = layoutRow(row, box, out);
      row = [];
    }
  }
  if (row.length) layoutRow(row, box, out);
  return out;
}

function worst(row, side) {
  if (!row.length) return Infinity;
  const areas = row.map((entry) => entry.area);
  const sum = areas.reduce((acc, value) => acc + value, 0);
  const max = Math.max(...areas);
  const min = Math.min(...areas);
  const side2 = side * side || 1;
  return Math.max((side2 * max) / (sum * sum), (sum * sum) / (side2 * min));
}

function layoutRow(row, box, out) {
  const area = row.reduce((sum, entry) => sum + entry.area, 0);
  if (box.w >= box.h) {
    const colWidth = Math.min(box.w, area / Math.max(1, box.h));
    let y = box.y;
    row.forEach((entry, index) => {
      const h = index === row.length - 1 ? box.y + box.h - y : entry.area / Math.max(1, colWidth);
      out.push({ item: entry.item, rect: { x: box.x, y, w: colWidth, h: Math.max(0, h) } });
      y += h;
    });
    return { x: box.x + colWidth, y: box.y, w: Math.max(0, box.w - colWidth), h: box.h };
  }

  const rowHeight = Math.min(box.h, area / Math.max(1, box.w));
  let x = box.x;
  row.forEach((entry, index) => {
    const w = index === row.length - 1 ? box.x + box.w - x : entry.area / Math.max(1, rowHeight);
    out.push({ item: entry.item, rect: { x, y: box.y, w: Math.max(0, w), h: rowHeight } });
    x += w;
  });
  return { x: box.x, y: box.y + rowHeight, w: box.w, h: Math.max(0, box.h - rowHeight) };
}

function heatmapItemMatchesQuery(item, rawQuery) {
  const q = String(rawQuery || "").trim();
  if (!q) return true;
  const hayUpper = `${item.ticker} ${item.company} ${item.sector} ${item.industry}`.toUpperCase();
  if (hayUpper.includes(q.toUpperCase())) return true;
  const aliases = (window.TICKER_ALIASES_KO || {})[item.ticker] || [];
  return aliases.some((alias) => alias.includes(q) || q.includes(alias));
}

// ===== Heatmap share deeplink =====
function heatmapRouteParams() {
  const bucket = byId("bucketFilter")?.value;
  const sector = byId("sectorFilter")?.value;
  const metric = byId("metricFilter")?.value;
  const tile = byId("tileSizeFilter")?.value;
  const q = byId("heatmapSearch")?.value?.trim();
  const params = { tab: "map" };
  if (bucket) params.map_bucket = bucket;
  if (sector && sector !== "All") params.map_sector = sector;
  if (metric && metric !== "changePct") params.map_metric = metric;
  if (tile && tile !== "marketCapB") params.map_tile = tile;
  if (q) params.map_q = q;
  return params;
}

function applyHeatmapRoute(route) {
  const bucket = route.get("map_bucket");
  const sector = route.get("map_sector");
  const metric = route.get("map_metric");
  const tile = route.get("map_tile");
  const q = route.get("map_q");
  if (bucket && byId("bucketFilter")) byId("bucketFilter").value = bucket;
  if (sector && byId("sectorFilter")) byId("sectorFilter").value = sector;
  if (metric && byId("metricFilter")) byId("metricFilter").value = metric;
  if (tile && byId("tileSizeFilter")) byId("tileSizeFilter").value = tile;
  if (q != null && byId("heatmapSearch")) byId("heatmapSearch").value = q;
}

async function shareHeatmapLink() {
  const url = new URL(window.location.href);
  Object.entries(heatmapRouteParams()).forEach(([key, value]) => url.searchParams.set(key, value));
  try {
    await navigator.clipboard.writeText(url.toString());
    const btn = byId("heatmapShare");
    if (btn) {
      const prev = btn.textContent;
      btn.textContent = "복사됨!";
      setTimeout(() => { btn.textContent = prev; }, 1500);
    }
  } catch (e) {
    window.prompt("히트맵 링크", url.toString());
  }
}
