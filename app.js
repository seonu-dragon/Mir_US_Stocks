const fallbackData = {
  updatedAtKst: "2026-06-13 06:00 KST",
  policy: "Daily snapshot. Update once at 06:00 KST.",
  summary: {
    marketTone: "대형 기술주 우세",
    strongSector: "Semiconductors",
    weakSector: "Utilities",
    aiBreadth: "AI 성장주 12개 중 8개 단기 상승"
  },
  stocks: [
    stock("NVDA", "Nvidia", "Semiconductors", "CHIPS", "idx_ndx100", 141.1, 2.4, 5.2, 12.1, 94, 88, 1.9, 78, 4.2, [118, 120, 124, 126, 127, 130, 132, 131, 135, 137, 140, 141]),
    stock("MSFT", "Microsoft", "Software", "SOFTWARE", "idx_ndx100", 486.3, 0.7, 1.8, 4.5, 83, 72, 1.1, 62, 3.5, [452, 456, 461, 463, 466, 469, 472, 476, 478, 481, 484, 486]),
    stock("AAPL", "Apple", "Consumer Electronics", "COMPUTER", "idx_ndx100", 203.8, -0.4, -1.2, 2.8, 66, 54, 0.9, 48, 8.5, [198, 201, 204, 207, 206, 204, 202, 200, 201, 203, 204, 203]),
    stock("AMZN", "Amazon", "Internet Retail", "INTERNET", "idx_ndx100", 218.2, 1.2, 3.8, 7.7, 81, 69, 1.3, 71, 5.1, [196, 199, 201, 204, 207, 208, 210, 212, 214, 215, 217, 218]),
    stock("GOOGL", "Alphabet", "Internet Services", "INTERNET", "idx_ndx100", 191.5, 0.5, 2.2, 6.1, 76, 63, 1.0, 65, 6.3, [177, 179, 181, 183, 184, 185, 187, 188, 189, 190, 191, 192]),
    stock("META", "Meta Platforms", "Social Media", "INTERNET", "idx_ndx100", 705.4, 1.8, 4.4, 10.8, 89, 82, 1.4, 74, 2.8, [630, 638, 645, 651, 660, 672, 681, 690, 698, 702, 704, 705]),
    stock("AVGO", "Broadcom", "Semiconductors", "CHIPS", "idx_ndx100", 263.6, 2.1, 6.9, 15.2, 92, 86, 1.7, 82, 1.9, [218, 224, 229, 235, 241, 248, 252, 256, 259, 261, 262, 264]),
    stock("TSLA", "Tesla", "EV Automaker", "AUTO", "idx_ndx100", 181.9, -1.1, -3.5, -8.2, 41, 35, 1.2, 32, 24.5, [211, 205, 201, 198, 195, 191, 188, 185, 183, 184, 182, 182]),
    stock("JPM", "JPMorgan Chase", "Banks", "BANKS", "idx_sp500", 289.4, 0.9, 2.1, 8.4, 78, 70, 1.0, 68, 4.0, [260, 263, 266, 270, 272, 275, 278, 282, 284, 286, 288, 289]),
    stock("XOM", "Exxon Mobil", "Energy", "ENERGY", "idx_sp500", 110.2, -0.8, -2.8, -1.4, 46, 40, 0.8, 44, 12.2, [117, 116, 115, 114, 113, 112, 111, 110, 109, 110, 111, 110]),
    stock("LLY", "Eli Lilly", "Pharma", "MEDICAL", "idx_sp500", 875.6, 1.3, 5.4, 13.9, 91, 90, 1.2, 79, 3.1, [770, 785, 795, 811, 828, 840, 851, 860, 866, 871, 874, 876]),
    stock("PLTR", "Palantir", "AI Software", "SOFTWARE", "gte10b", 143.9, 3.9, 14.8, 38.1, 96, 84, 2.4, 88, 0.8, [92, 96, 101, 108, 114, 122, 128, 133, 137, 140, 142, 144]),
    stock("APP", "AppLovin", "Ad Tech", "SOFTWARE", "gte10b", 352.2, 2.8, 11.5, 31.6, 95, 87, 2.1, 85, 1.4, [250, 260, 272, 285, 298, 310, 323, 334, 343, 348, 351, 352]),
    stock("HOOD", "Robinhood", "Brokerage", "FINANCE", "gte10b", 74.1, 2.2, 9.1, 18.8, 88, 76, 1.8, 77, 2.5, [57, 58, 60, 62, 65, 67, 69, 70, 72, 73, 74, 74]),
    stock("RKLB", "Rocket Lab", "Space", "AEROSPACE/DEFENSE", "1to10b", 21.4, 5.7, 18.2, 44.0, 93, 65, 3.6, 91, 0.3, [12, 13, 14, 15, 16, 17, 18, 19, 20, 20.5, 21, 21.4]),
    stock("IONQ", "IonQ", "Quantum", "COMPUTER", "1to10b", 39.2, 4.8, 16.0, 22.3, 90, 48, 2.9, 84, 6.8, [30, 31, 32, 33, 34, 35, 36.5, 37, 38, 38.5, 39, 39.2]),
    stock("SOXX", "iShares Semiconductor ETF", "ETF", "ETF/ETN/CEF", "all_misc", 260.7, 1.9, 6.4, 14.7, 87, 60, 1.3, 80, 2.2, [226, 230, 234, 238, 243, 248, 252, 255, 258, 259, 260, 261]),
    stock("XLK", "Technology Select Sector SPDR", "ETF", "ETF/ETN/CEF", "all_misc", 242.5, 1.0, 4.1, 8.9, 82, 55, 1.0, 70, 3.9, [224, 226, 229, 231, 234, 237, 239, 240, 241, 242, 243, 243]),
    stock("XLF", "Financial Select Sector SPDR", "ETF", "ETF/ETN/CEF", "all_misc", 51.2, 0.6, 2.3, 6.0, 70, 58, 0.9, 63, 5.0, [48, 48.5, 49, 49.4, 49.8, 50.1, 50.4, 50.7, 50.9, 51, 51.1, 51.2]),
    stock("XLU", "Utilities Select Sector SPDR", "ETF", "ETF/ETN/CEF", "all_misc", 72.4, -0.9, -2.1, -3.0, 34, 43, 0.8, 35, 15.0, [77, 76, 75.5, 75, 74.5, 74, 73.5, 73.2, 72.8, 72.5, 72.6, 72.4])
  ],
  health: {
    major: [
      health("SPY", "S&P 500", 1.8, "상승 추세"),
      health("QQQ", "Nasdaq 100", 3.6, "기술주 우세"),
      health("IWM", "Russell 2000", -0.7, "소형주 약세"),
      health("IBIT", "Bitcoin ETF", 2.9, "위험선호 유지"),
      health("GLD", "Gold", -1.1, "방어자산 약세"),
      health("VIXY", "Volatility", -4.4, "변동성 안정")
    ],
    etf: [
      health("XLK", "Technology", 4.1, "Microsoft / Apple"),
      health("SOXX", "Semiconductors", 6.4, "Nvidia / Broadcom"),
      health("XLF", "Financials", 2.3, "JPMorgan"),
      health("XLE", "Energy", -2.8, "Exxon Mobil"),
      health("XLV", "Health Care", 1.7, "Eli Lilly"),
      health("XLU", "Utilities", -2.1, "Defensive lagging")
    ],
    ai: [
      health("NVDA", "Nvidia", 5.2, "AI leader"),
      health("PLTR", "Palantir", 14.8, "Momentum leader"),
      health("APP", "AppLovin", 11.5, "Strong uptrend"),
      health("HOOD", "Robinhood", 9.1, "Risk-on"),
      health("RKLB", "Rocket Lab", 18.2, "High beta"),
      health("IONQ", "IonQ", 16.0, "Spec growth")
    ],
    etfRelative: { rows: [], universeCount: 0, method: "" }
  }
};

function stock(ticker, company, industry, sector, bucket, price, changePct, weekChangePct, monthChangePct, rsScore, epsRevScore, volumeRatio, stochK, newHighDistancePct, series) {
  return {
    ticker,
    company,
    industry,
    sector,
    bucket,
    price,
    changePct,
    weekChangePct,
    monthChangePct,
    threeMonthChangePct: monthChangePct * 2.1,
    ytdChangePct: monthChangePct * 3.3,
    marketCapB: Math.max(1, Math.round(price * (rsScore + 30) / 2)),
    volumeRatio,
    rsScore,
    epsRevScore,
    rsi14: Math.round((rsScore + stochK) / 2),
    stochK,
    newHighDistancePct,
    newHighRecency4w: newHighDistancePct < 2 ? 1 : newHighDistancePct < 5 ? 2 : "None",
    closeSeries: series
  };
}

function health(ticker, name, changePct, note) {
  return { ticker, name, changePct, note };
}

let data = fallbackData;
let selectedTicker = "NVDA";
let chatFocusTicker = selectedTicker;
let selectedEtfRsCategory = null;
let scoreHelpOpen = null;
const SECTOR_ETFS = [
  { ticker: "XLK", name: "정보기술 (Technology)", desc: "Technology Select Sector SPDR ETF", sectorName: "TECHNOLOGY" },
  { ticker: "SOXX", name: "반도체 (Semiconductors)", desc: "iShares Semiconductor ETF", sectorName: "Semiconductors" },
  { ticker: "XLF", name: "금융 (Financials)", desc: "Financial Select Sector SPDR ETF", sectorName: "FINANCIAL" },
  { ticker: "XLE", name: "에너지 (Energy)", desc: "Energy Select Sector SPDR ETF", sectorName: "ENERGY" },
  { ticker: "XLV", name: "헬스케어 (Health Care)", desc: "Health Care Select Sector SPDR ETF", sectorName: "HEALTHCARE" },
  { ticker: "XLU", name: "유틸리티 (Utilities)", desc: "Utilities Select Sector SPDR ETF", sectorName: "UTILITIES" },
  { ticker: "XLI", name: "산업재 (Industrials)", desc: "Industrials Select Sector SPDR ETF", sectorName: "INDUSTRIALS" },
  { ticker: "XLY", name: "임의소비재 (Consumer Discretionary)", desc: "Consumer Discretionary Select Sector SPDR ETF", sectorName: "CONSUMER CYCLICAL" },
  { ticker: "XLP", name: "필수소비재 (Consumer Staples)", desc: "Consumer Staples Select Sector SPDR ETF", sectorName: "CONSUMER DEFENSIVE" },
  { ticker: "XLC", name: "통신 서비스 (Communication Services)", desc: "Communication Services Select Sector SPDR ETF", sectorName: "COMMUNICATION SERVICES" },
  { ticker: "JETS", name: "항공 (Airlines)", desc: "U.S. Global Jets ETF", sectorName: "Airlines" },
  { ticker: "XBI", name: "바이오테크 (Biotech)", desc: "SPDR S&P Biotech ETF", sectorName: "Biotech" },
  { ticker: "KRE", name: "지역은행 (Regional Banks)", desc: "SPDR S&P Regional Banking ETF", sectorName: "Banks" },
  { ticker: "IGV", name: "소프트웨어 (Software)", desc: "iShares Expanded Tech-Software ETF", sectorName: "Software" },
  { ticker: "ITA", name: "항공우주·방산 (Aerospace & Defense)", desc: "iShares U.S. Aerospace & Defense ETF", sectorName: "Aerospace" },
  { ticker: "XOP", name: "석유·가스 E&P (Oil & Gas)", desc: "SPDR S&P Oil & Gas Exploration & Production ETF", sectorName: "Oil & Gas" },
  { ticker: "XME", name: "금속·광업 (Metals & Mining)", desc: "SPDR S&P Metals & Mining ETF", sectorName: "Metals & Mining" },
  { ticker: "XRT", name: "소매 (Retail)", desc: "SPDR S&P Retail ETF", sectorName: "Retail" },
  { ticker: "DRIV", name: "자동차 (Autos)", desc: "Global X Autonomous & Electric Vehicles ETF", sectorName: "Autos" },
  { ticker: "XLRE", name: "리츠·부동산 (Real Estate)", desc: "Real Estate Select Sector SPDR ETF", sectorName: "REAL ESTATE" }
];
// Many airlines are misclassified by the data provider under "Air Freight/Delivery
// Services", so detect them by ticker as well as by industry keyword.
const AIRLINE_TICKERS = new Set([
  "UAL", "DAL", "AAL", "LUV", "ALK", "JBLU", "ALGT", "SAVE", "HA", "SKYW",
  "MESA", "SNCY", "ULCC", "CPA", "VLRS", "AVAV", "GOL", "AZUL", "RYAAY",
  "LTM", "ZNH", "CEA", "JETBLUE"
]);

let selectedSectorEtf = "XLK";
let selectedSectorRange = "1D";
let selectedSectorBenchmark = "SPY";
let selectedInstitutionId = "berkshire";
let selectedInstitutionQuarterIdx = 0;
let institutionalSearchQuery = "";
let institutionalUiReady = false;
let institutionalSubTab = "13f";
let congressSearchQuery = "";
let selectedPoliticianId = "";
let congressRankPage = 0;
const CONGRESS_RANK_PAGE_SIZE = 20;
let congressMatrixHelpOpen = false;
let congressUiReady = false;
let calendarEventsCache = [];
let calendarFiltersReady = false;
const calendarCountryFilters = { korea: true, us: true, whitehouse: true };
const calendarImportanceFilters = { high: true, medium: true, low: true };
const detailCache = {};
const detailPromises = {};

// Optional Cloudflare Worker proxy that fetches Yahoo news + real charts live when a
// stock-analysis page opens. Leave "" to fall back to the pre-generated detail files.
// After deploying worker/yahoo-proxy.js, paste its URL here, e.g.
//   const LIVE_DATA_PROXY = "https://mir-yahoo.yourname.workers.dev";
const LIVE_DATA_PROXY = "https://mirusstocks.planbesides.workers.dev";
const liveNewsCache = {};
const liveChartCache = {};
const liveEarningsCache = {};
const liveSummaryCache = {};
const liveFetched = {};
const liveDone = {};

let chartState = {
  range: "1Y",
  barTf: "D", // D=일봉, W=주봉, M=월봉
  chartType: "candle", // candle | line
  zoom: 1,
  offset: 0,
  showSma5: false,
  showSma10: false,
  showSma20: true,
  showSma60: true,
  showSma120: false,
  showEma20: false,
  showEma60: false,
  showBoll: false,
  showVwap: false,
  showSupertrend: false,
  showIchimoku: false,
  showKeltner: false,
  showDonchian: false,
  showVolume: true,
  showVolMa20: false,
  showVolumeRatio: false,
  showObv: false,
  showAd: false,
  showRsi: true,
  showMacd: false,
  showStoch: false,
  showRoc: false,
  showMomentum: false,
  showWilliams: false,
  showAtr: false,
  showAdx: false,
  showCci: false,
  showRsSpy: false,
  showRsQqq: false,
  showRsSector: false,
  showMansfield: false
};

let compareTickers = [];
const WATCHLIST_STORAGE_KEY = "mir_watchlist_v1";
const CHART_PRESET_STORAGE_KEY = "mir_chart_presets_v1";
const WATCH_ALERT_STORAGE_KEY = "mir_watch_alerts_v1";
const VIEW_MODE_STORAGE_KEY = "mir_view_mode_v1";
const SAVED_SCREENER_STORAGE_KEY = "mir_saved_screeners_v1";

const DEFAULT_WATCHLIST = ["NVDA", "MSFT", "AAPL", "PLTR", "SOXX"];
let watchlist = [];
let chartPresets = {};
let moveAnalysisState = null;
let earningsCalendarCache = null;
let earningsCalendarLoading = false;
let deferredInstallPrompt = null;

const TOP_PRESETS = {
  leaders: { metric: "rsScore", minRs: 85, minEps: 70, minVolume: 0, minMarketCap: 10, newHigh: "All", recency: "All" },
  breakout: { metric: "volumeRatio", minRs: 75, minEps: 0, minVolume: 1.5, minMarketCap: 1, newHigh: "0-2%", recency: "All" },
  pullback: { metric: "rsScore", minRs: 80, minEps: 60, minVolume: 0, minMarketCap: 5, newHigh: "5-10%", recency: "All" },
  growth: { metric: "epsRevScore", minRs: 70, minEps: 80, minVolume: 0, minMarketCap: 2, newHigh: "All", recency: "All" },
  value: { metric: "forwardPE", minRs: 50, minEps: 50, minVolume: 0, minMarketCap: 10, newHigh: "All", recency: "All" },
  lows: { metric: "low52Dist", minRs: 0, minEps: 0, minVolume: 0, minMarketCap: 1, newHigh: "All", recency: "All" }
};

// 52주 저가 대비 상승률(%) — MAP_FUNDAMENTALS.low52 + 스냅샷 price 로 계산.
function low52DistPct(item) {
  const f = (window.MAP_FUNDAMENTALS || {})[item?.ticker];
  const low = f && Number(f.low52);
  const price = Number(item?.price);
  if (!Number.isFinite(low) || low <= 0 || !Number.isFinite(price)) return NaN;
  return (price / low - 1) * 100;
}

const fmtPct = (value) => {
  const n = Number(value) || 0;
  const marker = n > 0 ? "▲ " : n < 0 ? "▼ " : "";
  return `${marker}${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
};
const cls = (value) => value > 0 ? "pos" : value < 0 ? "neg" : "muted";
const byId = (id) => document.getElementById(id);

function formatKstDateTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")} KST`;
}

function updateDataLoadedAt(date = new Date()) {
  const el = byId("updatedAt");
  if (!el) return;
  const snapshotTime = data && (data.updatedAtKst || data.updated_at_kst);
  el.textContent = snapshotTime || formatKstDateTime(date);
}

async function loadData() {
  let loaded = false;
  try {
    if (window.location.protocol !== "file:") {
      const response = await fetch("data/market_snapshot.json", { cache: "no-store" });
      if (response.ok) {
        data = await response.json();
        loaded = true;
      }
    }
  } catch (error) {
    console.warn("Unable to load JSON snapshot", error);
  }

  if (!loaded && window.MARKET_SNAPSHOT) {
    data = window.MARKET_SNAPSHOT;
    loaded = true;
  }

  if (!loaded) {
    console.warn("Using fallback snapshot. Open through scripts/serve.ps1 or regenerate data/market_snapshot.js.");
  }
  boot();
}

function boot() {
  const route = new URLSearchParams(window.location.search);
  if (route.get("cadmin")) setCommunityAdminKey(route.get("cadmin"));
  if (route.get("ticker")) selectedTicker = route.get("ticker").toUpperCase();
  initWatchlist(route.get("watchlist"));
  loadPortfolio();
  document.documentElement.removeAttribute("data-theme");
  setupPwa();
  updateDataLoadedAt();
  renderCardNews();
  setupLightbox();
  setupChatbot();
  renderSummary();
  setupViewMode(route.get("tab"));
  setupTabs();
  setupFilters();
  setupTickerSearchHelpers();
  renderAll();
  setupActionBoard();
  loadCalendar();
  setupEvents();
  setupBriefingToggles();
  fetchMarketHeader();
  const initialTab = route.get("tab");
  const initialSub = route.get("sub");
  const initialCommunityTicker = route.get("cticker") || route.get("communityTicker");
  if (initialCommunityTicker) applyCommunityBoardTickerFilter(initialCommunityTicker);
  if (initialTab) {
    const resolved = normalizeTabRequest(initialTab, initialSub);
    activateTab(resolved.tab, {
      push: false,
      sub: resolved.sub,
      communityTicker: initialCommunityTicker,
    });
  }
  if (route.get("ticker")) selectTicker(route.get("ticker"));
  // 뒤로가기 가드: 현재(시작) 상태를 breadcrumb 루트로 두고 히스토리 센티넬 설치
  navStack = [navCurrentState()];
  setupBackGuard();
}

// 오늘의 카드뉴스 미니 캐러셀(헤더): data.cardNews = { us:{title,images}, kr:{title,images} }
// 두 버전(미국 뉴스 / 국내 뉴스)을 스위치로 선택, 헤더 높이에 맞춰 자동 전환, 클릭 시 라이트박스.
let cardnewsTimer = null;
let cardnewsView = "us";  // 기본: 미국 뉴스(미국 주식 사이트)
let cardnewsIdx = 0;
let cardnewsImages = [];
let cardnewsSwipeBound = false;

function showCardNewsSlide(idx) {
  const img = byId("cardnewsCarouselImg");
  if (!img || !cardnewsImages.length) return;
  cardnewsIdx = ((idx % cardnewsImages.length) + cardnewsImages.length) % cardnewsImages.length;
  img.src = cardnewsImages[cardnewsIdx];
}

function startCardNewsTimer() {
  if (cardnewsTimer) { clearInterval(cardnewsTimer); cardnewsTimer = null; }
  if (cardnewsImages.length > 1) {
    cardnewsTimer = setInterval(() => showCardNewsSlide(cardnewsIdx + 1), 3000);
  }
}

function stepCardNews(delta) {
  if (cardnewsImages.length <= 1) return;
  showCardNewsSlide(cardnewsIdx + delta);
  startCardNewsTimer();
}

function bindCardNewsSwipe(host) {
  if (!host || cardnewsSwipeBound) return;
  cardnewsSwipeBound = true;
  let touchStartX = 0;
  let touchStartY = 0;
  let swiped = false;
  host.addEventListener("touchstart", (event) => {
    const t = event.changedTouches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    swiped = false;
  }, { passive: true });
  host.addEventListener("touchend", (event) => {
    const t = event.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      swiped = true;
      stepCardNews(dx < 0 ? 1 : -1);
    }
  }, { passive: true });
  const band = byId("contentBand");
  if (band) {
    band.addEventListener("click", (event) => {
      if (swiped) { event.preventDefault(); event.stopPropagation(); swiped = false; }
    });
  }
}

function renderCardNews() {
  const host = byId("cardnewsHost");
  const band = byId("contentBand");
  const img = byId("cardnewsCarouselImg");
  const prevBtn = byId("cardnewsPrev");
  const nextBtn = byId("cardnewsNext");
  const switchEl = byId("cardnewsSwitch");
  if (!host || !band || !img) return;

  const cn = data.cardNews || {};
  const sets = {
    us: cn.us && Array.isArray(cn.us.images) && cn.us.images.length ? cn.us : null,
    kr: cn.kr && Array.isArray(cn.kr.images) && cn.kr.images.length ? cn.kr : null,
  };
  if (cardnewsTimer) { clearInterval(cardnewsTimer); cardnewsTimer = null; }

  if (!sets.us && !sets.kr) {
    host.hidden = true;
    if (switchEl) switchEl.hidden = true;
    cardnewsImages = [];
    return;
  }
  // 선택된 버전이 없으면 us 우선, 없으면 kr
  if (!sets[cardnewsView]) cardnewsView = sets.us ? "us" : "kr";

  if (switchEl) {
    switchEl.hidden = false;
    switchEl.querySelectorAll("[data-cn]").forEach((btn) => {
      const v = btn.dataset.cn;
      btn.disabled = !sets[v];
      btn.classList.toggle("is-active", v === cardnewsView && !!sets[v]);
      btn.onclick = () => {
        if (!sets[v] || v === cardnewsView) return;
        cardnewsView = v;
        cardnewsIdx = 0;
        renderCardNews();
      };
    });
  }

  const active = sets[cardnewsView];
  cardnewsImages = active.images;
  cardnewsIdx = 0;
  host.hidden = false;
  showCardNewsSlide(0);
  const multi = cardnewsImages.length > 1;
  host.classList.toggle("has-nav", multi);
  if (prevBtn) prevBtn.onclick = (event) => { event.stopPropagation(); stepCardNews(-1); };
  if (nextBtn) nextBtn.onclick = (event) => { event.stopPropagation(); stepCardNews(1); };
  band.title = active.title ? `${active.title} — 클릭하면 크게 보기` : "클릭하면 크게 보기";
  band.onclick = () => openLightbox(cardnewsImages, cardnewsIdx);
  bindCardNewsSwipe(host);
  startCardNewsTimer();
  syncCardNewsHeight();
}

// 카드뉴스 박스 높이를 오른쪽 '데이터 기준' 박스와 픽셀 단위로 동일하게 맞춤.
// 모바일에서는 CSS aspect-ratio로 높이를 잡고 가로 폭 100%를 유지한다.
function syncCardNewsHeight() {
  const host = byId("cardnewsHost");
  const band = byId("contentBand");
  const card = document.querySelector(".update-card");
  if (!host || !band || !card || host.hidden) return;
  if (window.matchMedia("(max-width: 768px)").matches) {
    band.style.height = "";
    host.style.height = "";
    return;
  }
  const h = `${card.offsetHeight}px`;
  band.style.height = h;
  host.style.height = h;
}

// 카드뉴스 크게 보기 라이트박스
let lightboxImages = [];
let lightboxIndex = 0;

function updateLightboxImg() {
  const img = byId("lightboxImg");
  if (img) img.src = lightboxImages[lightboxIndex] || "";
}

function openLightbox(images, index) {
  const lb = byId("lightbox");
  if (!lb) return;
  lightboxImages = images;
  lightboxIndex = index || 0;
  updateLightboxImg();
  lb.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  const lb = byId("lightbox");
  if (lb) lb.hidden = true;
  document.body.style.overflow = "";
}

function lightboxStep(delta) {
  if (!lightboxImages.length) return;
  lightboxIndex = (lightboxIndex + delta + lightboxImages.length) % lightboxImages.length;
  updateLightboxImg();
}

function setupLightbox() {
  const lb = byId("lightbox");
  if (!lb) return;
  const close = byId("lightboxClose");
  const prev = byId("lightboxPrev");
  const next = byId("lightboxNext");
  if (close) close.addEventListener("click", closeLightbox);
  if (prev) prev.addEventListener("click", () => lightboxStep(-1));
  if (next) next.addEventListener("click", () => lightboxStep(1));
  lb.addEventListener("click", (event) => {
    if (event.target === lb) closeLightbox();
  });
  document.addEventListener("keydown", (event) => {
    if (lb.hidden) return;
    if (event.key === "Escape") closeLightbox();
    else if (event.key === "ArrowLeft") lightboxStep(-1);
    else if (event.key === "ArrowRight") lightboxStep(1);
  });
}

// 사이트 도우미 챗봇 (Cloudflare Worker /chat → Workers AI)
const CHAT_SUGGESTIONS = ["PER이 뭐야?", "NVDA 요약해줘", "시장 지도 보는 법", "RS 점수가 뭐야?"];
let chatHistory = [];
let chatBusy = false;
let rotationHorizon = "1M";
let etfRsPage = 1;
const ETF_RS_PAGE_COUNT = 4;
const ROTATION_HORIZONS = {
  "1W": { short: "weekChangePct", long: "monthChangePct", shortLabel: "1주", longLabel: "1개월" },
  "1M": { short: "monthChangePct", long: "threeMonthChangePct", shortLabel: "1개월", longLabel: "3개월" },
  "3M": { short: "threeMonthChangePct", long: "ytdChangePct", shortLabel: "3개월", longLabel: "YTD" }
};

function updateChatSafeArea() {
  const chatbot = byId("chatbot");
  const toggle = byId("chatToggle");
  if (!chatbot || !toggle) return;
  const bubble = toggle.querySelector(".chat-bubble");
  const bottomGap = window.matchMedia("(max-width: 640px)").matches ? 12 : 24;
  const bubbleGap = bubble ? bubble.offsetHeight + 8 : 0;
  const safe = Math.ceil((bottomGap + toggle.offsetHeight + bubbleGap + 24) * 0.36);
  document.documentElement.style.setProperty("--chat-safe-bottom", `${safe}px`);
}

function setupChatbot() {
  const panel = byId("chatPanel");
  const toggle = byId("chatToggle");
  const close = byId("chatClose");
  const form = byId("chatForm");
  const input = byId("chatInput");
  const log = byId("chatLog");
  const suggest = byId("chatSuggest");
  if (!panel || !toggle || !form || !input || !log) return;

  let greeted = false;

  function addChatMessage(role, text) {
    const div = document.createElement("div");
    div.className = `chat-msg ${role === "user" ? "user" : "bot"}`;
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  // 드래그로 옮긴 뒤 패널을 열면 화면 밖으로 넘칠 수 있어, 열린 패널 전체가 보이도록 위치 보정
  function clampIntoView() {
    const el = byId("chatbot");
    if (!el) return;
    // 드래그로 left/top이 지정된 경우에만 보정(기본 right/bottom 위치는 그대로 둠)
    if (!el.style.left && !el.style.top) return;
    const margin = 8;
    const rect = el.getBoundingClientRect();
    let left = rect.left;
    let top = rect.top;
    if (rect.right > window.innerWidth - margin) left -= rect.right - (window.innerWidth - margin);
    if (rect.bottom > window.innerHeight - margin) top -= rect.bottom - (window.innerHeight - margin);
    left = Math.max(margin, left);
    top = Math.max(margin, top);
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }

  // 모바일: 키보드가 올라오면 하단 입력칸이 가려져 무엇을 입력하는지 안 보이는 문제 방지.
  // visualViewport로 키보드 높이를 감지해 패널을 키보드 위로 띄우고 높이를 보이는 영역에 맞춘다.
  const vv = window.visualViewport;
  const chatbotEl = byId("chatbot");
  const isMobileChat = () => window.matchMedia("(max-width: 640px)").matches;

  function resetChatbotPosition() {
    if (!chatbotEl) return;
    chatbotEl.style.left = "";
    chatbotEl.style.top = "";
    chatbotEl.style.right = "";
    chatbotEl.style.bottom = "";
    chatbotEl.classList.remove("is-chat-open");
    panel.style.maxHeight = "";
  }

  function adjustForKeyboard() {
    const el = chatbotEl;
    if (!el) return;
    if (panel.hidden || !vv) {
      panel.style.maxHeight = "";
      if (!el.classList.contains("is-chat-open") && !el.style.left && !el.style.top) el.style.bottom = "";
      return;
    }
    const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    if (isMobileChat() && el.classList.contains("is-chat-open")) {
      el.style.bottom = `${overlap}px`;
      panel.style.maxHeight = `${Math.max(180, vv.height - 4)}px`;
      return;
    }
    const base = isMobileChat() ? 12 : 24;
    if (!el.style.left && !el.style.top) {
      el.style.bottom = `${base + overlap}px`;
    }
    panel.style.maxHeight = `${Math.max(220, vv.height - base - 16)}px`;
    if (el.style.left || el.style.top) clampIntoView();
  }
  if (vv) {
    vv.addEventListener("resize", adjustForKeyboard);
    vv.addEventListener("scroll", adjustForKeyboard);
  }

  function openPanel() {
    panel.hidden = false;
    toggle.hidden = true;
    if (chatbotEl) chatbotEl.classList.add("is-chat-open");
    clampIntoView();
    input.focus();
    adjustForKeyboard();
    if (!greeted) {
      greeted = true;
      addChatMessage("bot", "안녕하세요! 미르 도우미예요. 사이트 사용법·투자 용어는 물론, 그냥 편하게 말 걸어 주셔도 좋아요. 😊");
    }
  }

  function closePanel() {
    panel.hidden = true;
    toggle.hidden = false;
    resetChatbotPosition();
    adjustForKeyboard();
    updateChatSafeArea();
  }

  async function sendChat() {
    if (chatBusy) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    addChatMessage("user", text);
    chatHistory.push({ role: "user", content: text });
    chatBusy = true;
    const typing = addChatMessage("bot", "답변을 준비하고 있어요…");
    typing.classList.add("typing");
    try {
      if (!LIVE_DATA_PROXY) throw new Error("no proxy configured");
      const stockContext = buildStockChatContext(text);
      const res = await fetch(`${LIVE_DATA_PROXY.replace(/\/$/, "")}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: chatHistory.slice(-10), stockContext }),
      });
      const payload = await res.json();
      const reply = (payload && payload.reply) || "답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.";
      typing.classList.remove("typing");
      typing.textContent = reply;
      chatHistory.push({ role: "assistant", content: reply });
    } catch (err) {
      typing.classList.remove("typing");
      typing.textContent = "지금은 도우미에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.";
    } finally {
      chatBusy = false;
      log.scrollTop = log.scrollHeight;
    }
  }

  // 캐릭터를 좌클릭 홀드로 드래그 이동(드래그 중엔 '날아가는 미르'로 교체)
  const mascotImg = toggle.querySelector(".chat-mascot");
  const mascotNormal = mascotImg ? mascotImg.getAttribute("src") : "";
  const mascotFly = "assets/mir-mascot-fly.png?v=1";
  let drag = null;
  let justDragged = false;

  function onPointerMove(event) {
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    if (!drag.moved) {
      drag.moved = true;
      chatbotEl.classList.add("dragging");
      chatbotEl.style.right = "auto";
      chatbotEl.style.bottom = "auto";
      if (mascotImg) mascotImg.src = mascotFly;
    }
    const w = chatbotEl.offsetWidth;
    const h = chatbotEl.offsetHeight;
    let left = event.clientX - drag.offsetX;
    let top = event.clientY - drag.offsetY;
    left = Math.max(4, Math.min(left, window.innerWidth - w - 4));
    top = Math.max(4, Math.min(top, window.innerHeight - h - 4));
    chatbotEl.style.left = `${left}px`;
    chatbotEl.style.top = `${top}px`;
  }

  function endDrag(event) {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    toggle.removeEventListener("pointermove", onPointerMove);
    toggle.removeEventListener("pointerup", endDrag);
    toggle.removeEventListener("pointercancel", endDrag);
    try { if (event) toggle.releasePointerCapture(event.pointerId); } catch (e) { /* ignore */ }
    if (moved) {
      justDragged = true;
      setTimeout(() => { justDragged = false; }, 0);  // 직후 click만 무시하고 곧 해제
    }
    // 드래그 여부와 상관없이 항상 원래 포즈로 복귀
    chatbotEl.classList.remove("dragging");
    if (mascotImg && mascotImg.getAttribute("src") !== mascotNormal) {
      mascotImg.src = mascotNormal;
    }
  }

  toggle.addEventListener("pointerdown", (event) => {
    if (event.button && event.button !== 0) return;
    if (!chatbotEl) return;
    const rect = chatbotEl.getBoundingClientRect();
    drag = {
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      moved: false,
    };
    try { toggle.setPointerCapture(event.pointerId); } catch (e) { /* ignore */ }
    toggle.addEventListener("pointermove", onPointerMove);
    toggle.addEventListener("pointerup", endDrag);
    toggle.addEventListener("pointercancel", endDrag);
  });

  toggle.addEventListener("click", () => {
    if (justDragged) return;  // 드래그였으면 패널 열지 않음(justDragged는 곧 자동 해제)
    openPanel();
  });
  if (close) close.addEventListener("click", closePanel);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    sendChat();
  });

  if (suggest) {
    CHAT_SUGGESTIONS.forEach((q) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chat-chip";
      chip.textContent = q;
      chip.addEventListener("click", () => {
        input.value = q;
        sendChat();
      });
      suggest.appendChild(chip);
    });
  }

  updateChatSafeArea();
  window.addEventListener("resize", updateChatSafeArea);
  if (mascotImg) {
    if (mascotImg.complete) updateChatSafeArea();
    else mascotImg.addEventListener("load", updateChatSafeArea, { once: true });
  }
}

const CNN_FNG_URL = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata";
const marketHeader = { fng: null, fngStatus: "loading", fx: [] };

const SECTOR_KO = {
  "TECHNOLOGY": "정보기술", "HEALTHCARE": "헬스케어", "FINANCIAL": "금융",
  "CONSUMER CYCLICAL": "임의소비재", "CONSUMER DEFENSIVE": "필수소비재",
  "INDUSTRIALS": "산업재", "ENERGY": "에너지", "UTILITIES": "유틸리티",
  "REAL ESTATE": "부동산", "BASIC MATERIALS": "소재", "COMMUNICATION SERVICES": "커뮤니케이션"
};

function computeSectorRanks() {
  const agg = {};
  data.stocks.forEach((s) => {
    if (!SECTOR_KO[s.sector]) return;
    const a = (agg[s.sector] = agg[s.sector] || { sum: 0, n: 0 });
    a.sum += Number(s.changePct) || 0;
    a.n += 1;
  });
  const arr = Object.entries(agg)
    .filter(([, v]) => v.n >= 5)
    .map(([sec, v]) => ({ ko: SECTOR_KO[sec], avg: v.sum / v.n }));
  arr.sort((a, b) => b.avg - a.avg);
  return { strong: arr.slice(0, 5), weak: arr.slice(-5).reverse() };
}

function fngScore() {
  if (marketHeader.fng && Number.isFinite(marketHeader.fng.score)) return marketHeader.fng.score;
  return null;
}

function fngLabel(score) {
  if (score < 25) return "극단적 공포";
  if (score < 45) return "공포";
  if (score <= 55) return "중립";
  if (score <= 75) return "욕심";
  return "극단적 욕심";
}

function fngColor(score) {
  if (score < 25) return "#dc2626";
  if (score < 45) return "#f97316";
  if (score <= 55) return "#eab308";
  if (score <= 75) return "#84cc16";
  return "#16a34a";
}

function gaugePolar(cx, cy, r, deg) {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
}

function gaugeArc(cx, cy, r, startDeg, endDeg, color, w) {
  const [x1, y1] = gaugePolar(cx, cy, r, startDeg);
  const [x2, y2] = gaugePolar(cx, cy, r, endDeg);
  // startDeg > endDeg (going clockwise over the top), so sweep-flag = 1.
  return `<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${color}" stroke-width="${w}"></path>`;
}

function fngCardHtml() {
  const score = fngScore();
  const live = Number.isFinite(score);
  const gaugeScore = live ? score : 50;
  const label = live ? fngLabel(score) : (marketHeader.fngStatus === "error" ? "CNN 연결 실패" : "CNN 지수 로딩 중");
  const color = live ? fngColor(score) : "#94a3b8";
  const cx = 100, cy = 96, r = 76, w = 16;
  // score 0 -> 180deg (left), 100 -> 0deg (right)
  const deg = (s) => 180 - (s / 100) * 180;
  const arcs =
    gaugeArc(cx, cy, r, deg(0), deg(25), "#dc2626", w) +
    gaugeArc(cx, cy, r, deg(25), deg(45), "#f97316", w) +
    gaugeArc(cx, cy, r, deg(45), deg(55), "#eab308", w) +
    gaugeArc(cx, cy, r, deg(55), deg(75), "#84cc16", w) +
    gaugeArc(cx, cy, r, deg(75), deg(100), "#16a34a", w);
  const [nx, ny] = gaugePolar(cx, cy, r - 6, deg(gaugeScore));
  return `
    <div class="summary-card fng-card">
      <span>CNN Fear &amp; Greed</span>
      <svg class="fng-gauge" viewBox="0 0 200 118" role="img" aria-label="Fear and Greed gauge">
        ${arcs}
        <line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="#0f172a" stroke-width="3" stroke-linecap="round"></line>
        <circle cx="${cx}" cy="${cy}" r="5" fill="#0f172a"></circle>
        <text x="${cx}" y="${cy - 18}" text-anchor="middle" class="fng-score" fill="${color}">${live ? score : "--"}</text>
      </svg>
      <strong class="fng-label" style="color:${color}">${label}</strong>
    </div>
  `;
}

function sectorTopCardHtml(title, list, strong) {
  const rows = (list || []).map((s, i) => `
    <div class="hx-row">
      <span>${i + 1}. ${escapeHtml(s.ko)}</span>
      <em class="${cls(s.avg)}">${fmtPct(s.avg)}</em>
    </div>
  `).join("") || `<div class="hx-row"><span class="muted">데이터 없음</span></div>`;
  return `<div class="summary-card hx-card"><span>${title}</span>${rows}</div>`;
}

function fxCardHtml() {
  const find = (sym) => (marketHeader.fx || []).find((f) => f.symbol === sym);
  const row = (label, f, dec, suffix = "") => f
    ? `<div class="hx-row"><span>${label}</span><strong>${Number(f.price).toFixed(dec)}${suffix}</strong><em class="${cls(f.changePct)}">${fmtPct(f.changePct)}</em></div>`
    : `<div class="hx-row"><span>${label}</span><strong class="muted">불러오는 중…</strong></div>`;
  return `
    <div class="summary-card hx-card fx-card">
      <span>환율 · 금 · 금리</span>
      ${row("달러/원", find("KRW=X"), 1)}
      ${row("엔/원", find("JPYKRW=X"), 2)}
      ${row("금 ($/oz)", find("GC=F"), 1)}
      ${row("미국채 10년", find("^TNX"), 2, "%")}
      ${row("미국채 30년", find("^TYX"), 2, "%")}
    </div>
  `;
}

function computeMarketRegime() {
  const fng = fngScore();
  const eq = data.stocks.filter((s) => s.sector !== "EXCHANGE TRADED FUNDS");
  const upPct = eq.length ? eq.filter((s) => Number(s.changePct) > 0).length / eq.length : 0.5;
  const avgChange = (tickers, key) => {
    const vals = tickers.map((t) => stockByTicker(t)).filter(Boolean).map((s) => Number(s[key]) || 0);
    return vals.length ? vals.reduce((sum, v) => sum + v, 0) / vals.length : 0;
  };
  const growthLead = avgChange(["XLK", "QQQ", "SOXX"], "monthChangePct") - avgChange(["XLU", "XLP", "XLV"], "monthChangePct");
  const sectors = computeSectorRanks();
  let score = 0;
  if (Number.isFinite(fng) && fng >= 55) score += 1;
  else if (Number.isFinite(fng) && fng < 45) score -= 1;
  if (upPct >= 0.55) score += 1;
  else if (upPct < 0.45) score -= 1;
  if (growthLead > 1) score += 1;
  else if (growthLead < -0.5) score -= 1;
  if ((sectors.strong[0]?.avg || 0) > Math.abs(sectors.weak[0]?.avg || 0)) score += 0.5;

  if (score >= 2) {
    return { label: "Risk-On", ko: "리스크 온", tone: "on", desc: "성장·기술주 우세, 상승 종목 비중이 높은 구간", fng, upPct, growthLead };
  }
  if (score <= -1) {
    return { label: "Risk-Off", ko: "리스크 오프", tone: "off", desc: "방어주 선호, 시장 심리·브레드스가 약한 구간", fng, upPct, growthLead };
  }
  return { label: "Mixed", ko: "혼조", tone: "mixed", desc: "섹터 간 격차와 심리가 엇갈리는 구간", fng, upPct, growthLead };
}

function marketRegimeCardHtml() {
  const regime = computeMarketRegime();
  const fngLive = !!(marketHeader.fng && Number.isFinite(marketHeader.fng.score));
  const fngNote = fngLive ? "CNN Fear &amp; Greed Index" : "CNN 지수를 불러오는 중입니다";
  return `
    <div class="summary-card regime-card regime-${regime.tone}">
      <span>시장 국면</span>
      <strong class="regime-label">${regime.label}</strong>
      <em class="regime-ko">${regime.ko}</em>
      <p class="regime-desc">${regime.desc}</p>
      <div class="regime-stats">
        <span class="regime-stat" title="${fngNote}">
          <b>공포탐욕</b>
          <em>${fngLive ? regime.fng : "--"}</em>
        </span>
        <span class="regime-stat" title="당일 상승한 종목 비율">
          <b>상승 비중</b>
          <em>${Math.round(regime.upPct * 100)}%</em>
        </span>
        <span class="regime-stat" title="성장 ETF(XLK·QQQ·SOXX) − 방어 ETF(XLU·XLP·XLV) 1개월 수익률 차이">
          <b>성장-방어</b>
          <em>${fmtPct(regime.growthLead)}</em>
        </span>
      </div>
    </div>
  `;
}

function renderSummary() {
  const sectors = computeSectorRanks();
  byId("marketSummary").innerHTML =
    marketRegimeCardHtml() +
    fngCardHtml() +
    sectorTopCardHtml("강한 섹터 TOP5", sectors.strong, true) +
    sectorTopCardHtml("약한 섹터 TOP5", sectors.weak, false) +
    fxCardHtml();
}

function actionBoardCard(title, hint, rows, emptyText, target) {
  const body = rows.length ? rows.join("") : `<p class="daily-action-empty">${escapeHtml(emptyText)}</p>`;
  return `
    <article class="daily-action-card">
      <div class="daily-action-card-head">
        <div><h3>${title}</h3><p>${escapeHtml(hint)}</p></div>
        ${target ? `<button type="button" class="daily-action-more" data-action-tab="${target.tab}"${target.sub ? ` data-action-sub="${target.sub}"` : ""}>전체 보기</button>` : ""}
      </div>
      <div class="daily-action-list">${body}</div>
    </article>`;
}

function actionStockRow(item, note) {
  return `
    <button type="button" class="daily-action-row" data-action-ticker="${escapeHtml(item.ticker)}">
      <span><strong>${escapeHtml(item.ticker)}</strong><small>${escapeHtml(note || item.company || "")}</small></span>
      <em class="${cls(item.changePct)}">${fmtPct(item.changePct)}</em>
    </button>`;
}

function portfolioActionRows() {
  if (!portfolio.length) return [];
  return portfolio.map((position) => {
    const item = stockByTicker(position.ticker);
    if (!item) return null;
    const value = Number(position.qty || 0) * Number(item.price || 0);
    const cost = Number(position.qty || 0) * Number(position.avgCost || 0);
    const plPct = cost > 0 ? ((value - cost) / cost) * 100 : 0;
    return { item, value, plPct };
  }).filter(Boolean).sort((a, b) => b.value - a.value).slice(0, 4).map(({ item, value, plPct }) => `
    <button type="button" class="daily-action-row" data-action-ticker="${escapeHtml(item.ticker)}">
      <span><strong>${escapeHtml(item.ticker)}</strong><small>평가 $${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</small></span>
      <em class="${cls(plPct)}">${fmtPct(plPct)}</em>
    </button>`);
}

function upcomingActionRows() {
  const today = formatKstDateTime().slice(0, 10);
  const calendarRows = (calendarEventsCache || [])
    .map((event) => ({ event, date: calendarIsoFromEvent(event) }))
    .filter(({ date }) => date && date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3)
    .map(({ event, date }) => {
      const title = event.title || event.name || event.event || event.indicator || "주요 일정";
      const country = event.country || event.source || "일정";
      return `<button type="button" class="daily-action-row daily-action-schedule-row" data-action-tab="calendar"><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(country)} · ${escapeHtml(date)}</small></span><em class="info">일정</em></button>`;
    });
  if (calendarRows.length) return calendarRows;
  return watchlist.map((ticker) => {
    const item = stockByTicker(ticker);
    const f = (window.MAP_FUNDAMENTALS || {})[ticker] || {};
    const date = f.earningsDate || f.nextEarningsDate || item?.earningsDate;
    if (!item || !date || String(date) < today) return null;
    return `<button type="button" class="daily-action-row daily-action-schedule-row" data-action-ticker="${escapeHtml(ticker)}"><span><strong>${escapeHtml(ticker)} 실적</strong><small>${escapeHtml(String(date))}</small></span><em class="info">예정</em></button>`;
  }).filter(Boolean).slice(0, 3);
}

function filingActionRows() {
  const watched = new Set(watchlist);
  const events = ((window.MATERIAL_EVENTS || {}).events || []);
  let rows = events.filter((event) => watched.has(String(event.ticker || "").toUpperCase()));
  if (!rows.length) rows = events.filter((event) => event.hot);
  return rows.slice(0, 4).map((event) => {
    const labels = (event.items || []).map((item) => item.label).filter(Boolean).slice(0, 2).join(" · ") || "8-K 공시";
    return `<button type="button" class="daily-action-row" data-action-ticker="${escapeHtml(event.ticker)}"><span><strong>${escapeHtml(event.ticker)}</strong><small>${escapeHtml(labels)} · ${escapeHtml(event.fileDate || "")}</small></span><em class="${event.hot ? "warn" : "info"}">${event.hot ? "주요" : "신규"}</em></button>`;
  });
}

function renderActionBoard() {
  const grid = byId("dailyActionGrid");
  if (!grid) return;
  const watched = watchlist.map((ticker) => stockByTicker(ticker)).filter(Boolean);
  const movers = watched.slice().sort((a, b) => Math.abs(Number(b.changePct || 0)) - Math.abs(Number(a.changePct || 0))).slice(0, 4);
  const alerts = watched.map((item) => ({ item, reasons: watchAlertReasons(item, watchAlertSettings()) }))
    .filter((row) => row.reasons.length).slice(0, 4);
  const portfolioRows = portfolioActionRows();
  const scheduleRows = upcomingActionRows();
  const filingRows = filingActionRows();
  const attentionCount = alerts.length + scheduleRows.length + filingRows.filter((row) => row.includes('class="warn"')).length;
  const count = byId("dailyActionCount");
  if (count) count.textContent = attentionCount ? `우선 확인 ${attentionCount}건` : "새 긴급 항목 없음";
  const alertOrPortfolio = alerts.length
    ? alerts.map(({ item, reasons }) => actionStockRow(item, reasons.join(" · ")))
    : portfolioRows;
  grid.innerHTML =
    actionBoardCard("관심종목 변동", "등락폭이 큰 순서", movers.map((item) => actionStockRow(item, item.company)), "관심종목을 추가하면 변동을 추적합니다.", { tab: "bulk" }) +
    actionBoardCard(alerts.length ? "조건 감지" : "내 포트폴리오", alerts.length ? "저장한 조건에 맞는 종목" : "평가손익 상위 보유 종목", alertOrPortfolio, "조건 감지 또는 보유 종목이 없습니다.", { tab: "bulk" }) +
    actionBoardCard("다가오는 일정", "경제지표와 관심종목 실적", scheduleRows, "가까운 일정이 아직 없습니다.", { tab: "calendar" }) +
    actionBoardCard("새 공시", "관심종목 우선 · SEC 8-K", filingRows, "새로 확인할 주요 공시가 없습니다.", { tab: "institutional", sub: "events" });
  grid.querySelectorAll("[data-action-ticker]").forEach((button) => button.addEventListener("click", () => selectTicker(button.dataset.actionTicker, { openSearch: true })));
  grid.querySelectorAll("[data-action-tab]").forEach((button) => button.addEventListener("click", () => activateTab(button.dataset.actionTab, { sub: button.dataset.actionSub || null })));
}

function setupActionBoard() {
  const refresh = byId("dailyActionRefresh");
  if (!refresh || refresh.dataset.bound) return;
  refresh.dataset.bound = "1";
  refresh.addEventListener("click", () => {
    calendarLoaded = false;
    earningsCalendarCache = null;
    renderActionBoard();
    loadCalendar();
    showAppToast("오늘의 확인 항목을 새로 불러옵니다");
  });
}

const INDEX_ANALYSIS_TICKER = {
  "^DJI": "DIA",
  "^IXIC": "QQQ",
  "^GSPC": "SPY",
  "^RUT": "IWM",
  "^KS11": "EWY",
  "^KQ11": "FLKR",
  "BTC-USD": "GBTC",
  "ETH-USD": "ETHA",
};

function indexAnalysisTicker(symbol) {
  const mapped = INDEX_ANALYSIS_TICKER[symbol];
  return mapped && stockByTicker(mapped) ? mapped : null;
}

function renderIndexStrip(indices) {
  const el = byId("indexStrip");
  if (!el) return;
  if (!indices || !indices.length) { el.innerHTML = ""; return; }
  el.innerHTML = indices.map((ix) => {
    const analysisTicker = indexAnalysisTicker(ix.symbol);
    const clickable = !!analysisTicker;
    return `
    <div class="index-card${clickable ? " index-card-clickable" : ""}"${clickable ? ` data-ticker="${escapeHtml(analysisTicker)}" role="button" tabindex="0" title="${escapeHtml(ix.name)} → ${escapeHtml(analysisTicker)} 종목 분석"` : ""}>
      <div class="index-head">
        <strong>${escapeHtml(ix.name)}</strong>
        <em class="${cls(ix.changePct)}">${fmtPct(ix.changePct)}</em>
      </div>
      <div class="index-price">${Number(ix.price).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
      ${indexSparkline(ix.series, ix.changePct >= 0)}
    </div>
  `;
  }).join("");
  el.querySelectorAll(".index-card-clickable").forEach((card) => {
    const open = () => selectTicker(card.dataset.ticker, { openSearch: true });
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });
}

function indexSparkline(series, up) {
  const vals = (series || []).filter((v) => Number.isFinite(v));
  if (vals.length < 2) return `<div class="spark-empty"></div>`;
  const w = 200, h = 44;
  const min = Math.min(...vals), max = Math.max(...vals), rng = max - min || 1;
  const pts = vals.map((v, i) => `${((i / (vals.length - 1)) * w).toFixed(1)},${(h - ((v - min) / rng) * h).toFixed(1)}`).join(" ");
  const color = up ? "#16a34a" : "#dc2626";
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6"></polyline></svg>`;
}

function normalizeCnnFng(payload) {
  const fg = payload && (payload.fear_and_greed || payload.fng);
  const rawScore = Number(fg && fg.score);
  if (!Number.isFinite(rawScore)) return null;
  return {
    score: Math.round(rawScore),
    rawScore,
    rating: String(fg.rating || ""),
    timestamp: fg.timestamp || null,
    previousClose: Number.isFinite(Number(fg.previous_close)) ? Number(fg.previous_close) : null,
    source: "CNN",
  };
}

async function fetchCnnFng(base) {
  const urls = [CNN_FNG_URL, `${base}/?fng=1`];
  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) continue;
      const fng = normalizeCnnFng(await response.json());
      if (fng) return fng;
    } catch (_) {
      // Try the Worker fallback when CNN cannot be reached directly.
    }
  }
  return null;
}

function fetchMarketHeader() {
  if (!LIVE_DATA_PROXY) { renderIndexStrip([]); return; }
  const base = LIVE_DATA_PROXY.replace(/\/$/, "");
  const fngReq = fetchCnnFng(base).then((fng) => {
    marketHeader.fng = fng;
    marketHeader.fngStatus = fng ? "loaded" : "error";
    renderSummary();
  });
  const fxReq = fetch(`${base}/?fx=1`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((p) => {
    if (p && Array.isArray(p.fx)) { marketHeader.fx = p.fx; renderSummary(); }
  }).catch(() => {});
  const idxReq = fetch(`${base}/?indices=1`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((p) => {
    if (p && Array.isArray(p.indices)) renderIndexStrip(p.indices);
  }).catch(() => {});
  Promise.allSettled([fngReq, fxReq, idxReq]).then(() => updateDataLoadedAt());
}

// ===== 경제 캘린더 (한국 + 미국, investing.com via Worker) =====
let calendarLoaded = false;

function whiteHouseCalendarEvents() {
  const payload = window.WHITE_HOUSE_SCHEDULE || {};
  return Array.isArray(payload.events) ? payload.events : [];
}

function calendarCountryBucket(event) {
  const country = String(event.country || event.currency || "").trim();
  if (country === "백악관" || country.toLowerCase().includes("white house")) return "whitehouse";
  if (country.includes("한국") || country === "KRW" || country.toLowerCase().includes("south korea")) return "korea";
  if (country.includes("미국") || country === "USD" || country.toLowerCase().includes("united states")) return "us";
  return "other";
}

function calendarImportanceBucket(event) {
  const imp = Number(event.importance) || 0;
  if (imp >= 3) return "high";
  if (imp === 2) return "medium";
  return "low";
}

function setupCalendarFilters() {
  if (calendarFiltersReady) return;
  const map = [
    ["calFilterKorea", "korea"],
    ["calFilterUs", "us"],
    ["calFilterWhiteHouse", "whitehouse"],
    ["calFilterHigh", "high"],
    ["calFilterMedium", "medium"],
    ["calFilterLow", "low"],
  ];
  map.forEach(([id, key]) => {
    const el = byId(id);
    if (!el) return;
    el.addEventListener("change", () => {
      if (id.startsWith("calFilterK") || id === "calFilterUs" || id === "calFilterWhiteHouse") {
        calendarCountryFilters[key] = el.checked;
      } else {
        calendarImportanceFilters[key] = el.checked;
      }
      renderCalendarFiltered();
    });
  });
  calendarFiltersReady = true;
}

const CAL_WEEKDAY_KO = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

/** investing.com(한국어 날짜) · 백악관(YYYY-MM-DD) 등 서로 다른 day 문자열을 YYYY-MM-DD로 통일 */
function calendarIsoFromEvent(event) {
  const dt = String(event.datetime || "").trim();
  if (dt) {
    const iso = dt.match(/^(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];
    const slash = dt.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    if (slash) {
      return `${slash[1]}-${String(slash[2]).padStart(2, "0")}-${String(slash[3]).padStart(2, "0")}`;
    }
  }
  const day = String(event.day || "").trim();
  const wh = day.match(/^(\d{4}-\d{2}-\d{2})/);
  if (wh) return wh[1];
  const kr = day.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (kr) {
    return `${kr[1]}-${String(kr[2]).padStart(2, "0")}-${String(kr[3]).padStart(2, "0")}`;
  }
  return day || "unknown";
}

function calendarDayLabel(isoKey, rows) {
  const krLabel = (rows || []).map((e) => String(e.day || "").trim()).find((d) => /년.*월.*일/.test(d));
  if (krLabel) return krLabel;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoKey)) return isoKey;
  const parts = isoKey.split("-").map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  if (Number.isNaN(date.getTime())) return isoKey;
  return `${parts[0]}년 ${parts[1]}월 ${parts[2]}일 ${CAL_WEEKDAY_KO[date.getDay()]}`;
}

function mergeCalendarEvents(macroEvents, whEvents) {
  const merged = [...(macroEvents || []), ...(whEvents || [])];
  merged.sort((a, b) => {
    const ad = calendarIsoFromEvent(a);
    const bd = calendarIsoFromEvent(b);
    if (ad !== bd) return ad.localeCompare(bd);
    return String(a.time || "").localeCompare(String(b.time || ""));
  });
  return merged;
}

function calendarEventPassesFilters(event) {
  const country = calendarCountryBucket(event);
  const imp = calendarImportanceBucket(event);
  if (country === "korea" && !calendarCountryFilters.korea) return false;
  if (country === "us" && !calendarCountryFilters.us) return false;
  if (country === "whitehouse" && !calendarCountryFilters.whitehouse) return false;
  if (country === "other" && !calendarCountryFilters.korea && !calendarCountryFilters.us) return false;
  if (imp === "high" && !calendarImportanceFilters.high) return false;
  if (imp === "medium" && !calendarImportanceFilters.medium) return false;
  if (imp === "low" && !calendarImportanceFilters.low) return false;
  return true;
}

function renderCalendarFiltered() {
  const filtered = calendarEventsCache.filter(calendarEventPassesFilters);
  renderCalendar(filtered);
}

function loadCalendar() {
  if (calendarLoaded) {
    renderCalendarFiltered();
    return;
  }
  const body = byId("calendarBody");
  if (!body) return;
  setupCalendarFilters();
  const whEvents = whiteHouseCalendarEvents();
  if (!LIVE_DATA_PROXY) {
    calendarEventsCache = mergeCalendarEvents([], whEvents);
    calendarLoaded = true;
    renderCalendarFiltered();
    if (!calendarEventsCache.length) {
      body.innerHTML = `<p class="muted">경제 캘린더는 실시간 프록시 연결 시 표시됩니다. 백악관 일정 데이터가 없습니다.</p>`;
    }
    return;
  }
  calendarLoaded = true;
  body.innerHTML = `<p class="muted">경제 캘린더를 불러오는 중…</p>`;
  fetch(`${LIVE_DATA_PROXY.replace(/\/$/, "")}/?calendar=1`, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((p) => {
      calendarEventsCache = mergeCalendarEvents((p && p.calendar) || [], whEvents);
      renderCalendarFiltered();
      renderActionBoard();
    })
    .catch(() => {
      calendarLoaded = false;
      calendarEventsCache = mergeCalendarEvents([], whEvents);
      if (calendarEventsCache.length) {
        calendarLoaded = true;
        renderCalendarFiltered();
        renderActionBoard();
      } else {
        body.innerHTML = `<p class="muted">경제 캘린더를 불러오지 못했습니다.</p>`;
      }
    });
}

function impDots(n) {
  const full = Math.max(0, Math.min(3, n || 0));
  const lvl = full >= 3 ? "imp-3" : (full === 2 ? "imp-2" : "imp-1");
  let out = "";
  for (let i = 0; i < 3; i += 1) out += i < full ? `<b class="imp ${lvl}">●</b>` : `<span class="imp-dim">●</span>`;
  return out;
}

function renderCalendar(events) {
  const body = byId("calendarBody");
  if (!body) return;
  if (!events.length) {
    body.innerHTML = `<p class="muted">표시할 일정이 없습니다. (investing.com 접근이 일시적으로 차단되었을 수 있습니다)</p>`;
    return;
  }
  const groups = [];
  const idx = {};
  events.forEach((e) => {
    const key = calendarIsoFromEvent(e);
    if (idx[key] === undefined) { idx[key] = groups.length; groups.push({ key, rows: [] }); }
    groups[idx[key]].rows.push(e);
  });
  groups.sort((a, b) => a.key.localeCompare(b.key));
  body.innerHTML = groups.map((g) => `
    <div class="cal-day">
      <h3>${escapeHtml(calendarDayLabel(g.key, g.rows))}</h3>
      <div class="table-wrap">
        <table class="cal-table">
          <thead><tr><th>시간</th><th>국가</th><th>중요성</th><th>이벤트</th><th>실제</th><th>예측</th><th>이전</th></tr></thead>
          <tbody>
            ${g.rows.map((e) => `
              <tr>
                <td class="cal-time">${escapeHtml(e.time || "")}</td>
                <td class="cal-country">${escapeHtml(e.country || e.currency || "")}</td>
                <td class="cal-imp">${impDots(e.importance)}</td>
                <td class="cal-event">${escapeHtml(e.event || "")}</td>
                <td class="cal-actual">${escapeHtml(e.actual || "")}</td>
                <td>${escapeHtml(e.forecast || "")}</td>
                <td>${escapeHtml(e.previous || "")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `).join("");
}

let currentTab = "map";
let searchSubTab = "analysis";
let calendarSubTab = "macro";
let communitySubTab = "trending";
let communityCardnewsView = "us";
let communityBoardTickerFilter = "";

// ===== 뒤로가기 내비게이션 (이전 탭 복귀 N회 → '한 번 더 누르면 종료' → 종료) =====
const NAV_MAX_BACK = 2;     // 뒤로가기로 이전 탭 복귀 가능 횟수
let navStack = [];          // 방문한 탭 상태 breadcrumb (현재 + 최대 NAV_MAX_BACK개)
let backExitArmed = false;  // '한 번 더 누르면 종료' 대기 상태
let backExitTimer = null;

function navCurrentSub(tab) {
  if (tab === "search") return searchSubTab;
  if (tab === "calendar") return calendarSubTab;
  if (tab === "community") return communitySubTab;
  if (tab === "institutional") return (typeof institutionalSubTab !== "undefined" ? institutionalSubTab : null);
  return null;
}

function navCurrentState() {
  return {
    tab: currentTab,
    sub: navCurrentSub(currentTab),
    ticker: selectedTicker || null,
    communityTicker: communityBoardTickerFilter || null,
  };
}

function navStatesEqual(a, b) {
  return a && b && a.tab === b.tab && a.sub === b.sub
    && a.ticker === b.ticker && a.communityTicker === b.communityTicker;
}

// 사용자 주도 탭/하위탭 이동을 breadcrumb에 기록(중복 제거 + 깊이 제한)
function recordNav() {
  const state = navCurrentState();
  const top = navStack[navStack.length - 1];
  if (navStatesEqual(top, state)) return;
  navStack.push(state);
  if (navStack.length > NAV_MAX_BACK + 1) navStack.shift();
  disarmBackExit();
}

function applyNavState(state) {
  if (!state) return;
  if (state.ticker) selectTicker(state.ticker, { openSearch: false });
  if (state.communityTicker != null) applyCommunityBoardTickerFilter(state.communityTicker);
  activateTab(state.tab || "map", {
    push: false,
    sub: state.sub,
    ticker: state.ticker,
    communityTicker: state.communityTicker,
  });
}

function disarmBackExit() {
  backExitArmed = false;
  if (backExitTimer) { clearTimeout(backExitTimer); backExitTimer = null; }
}

// 히스토리에는 [base][sentinel] 두 칸만 유지하고, 뒤로가기 판단은 navStack으로 한다.
function setupBackGuard() {
  history.replaceState({ _app: true }, "");
  history.pushState({ _sentinel: true }, "");
  window.addEventListener("popstate", () => {
    if (navStack.length > 1) {
      // 이전 탭으로 복귀하고 앱에 머문다.
      navStack.pop();
      applyNavState(navStack[navStack.length - 1]);
      history.pushState({ _sentinel: true }, "");
      disarmBackExit();
      return;
    }
    // 최상위(루트) — 한 번 더 누르면 종료
    if (backExitArmed) {
      disarmBackExit();
      history.back(); // base 까지 빠져나가 앱 종료
      return;
    }
    backExitArmed = true;
    showAppToast("한 번 더 뒤로 가기하면 종료됩니다");
    history.pushState({ _sentinel: true }, "");
    backExitTimer = setTimeout(disarmBackExit, 2000);
  });
}

function showAppToast(message, ms = 2000) {
  let el = byId("appToast");
  if (!el) {
    el = document.createElement("div");
    el.id = "appToast";
    el.className = "app-toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add("is-visible");
  clearTimeout(showAppToast._timer);
  showAppToast._timer = setTimeout(() => el.classList.remove("is-visible"), ms);
}

const TAB_REDIRECT = {
  top: { tab: "search", sub: "top" },
  jump: { tab: "search", sub: "jump" },
  compare: { tab: "search", sub: "compare" },
  screener: { tab: "search", sub: "screener" },
  earnings: { tab: "calendar", sub: "earnings" },
};

function normalizeTabRequest(name, sub) {
  const redirect = TAB_REDIRECT[name];
  if (redirect) return { tab: redirect.tab, sub: sub || redirect.sub };
  return { tab: name, sub: sub || null };
}

function activateSearchSub(name, { push = false } = {}) {
  searchSubTab = name || "analysis";
  const nav = byId("searchSubTabs");
  if (nav) {
    nav.querySelectorAll(".sub-tab").forEach((btn) => btn.classList.toggle("is-active", btn.dataset.sub === searchSubTab));
    document.querySelectorAll("#tab-search .sub-panel").forEach((panel) => panel.classList.remove("is-active"));
    const panel = byId(`sub-${searchSubTab}`);
    if (panel) panel.classList.add("is-active");
  }
  if (searchSubTab === "top") renderTopStocks();
  if (searchSubTab === "jump") renderJump();
  if (searchSubTab === "compare") renderCompareBoard();
  if (searchSubTab === "screener") renderScreener();
  if (searchSubTab === "valuation") renderValuation();
  if (searchSubTab === "short") renderShortInterest();
  if (searchSubTab === "analysis") renderSearch();
  if (push) recordNav();
}

function activateInstitutionalSub(name, { push = false } = {}) {
  institutionalSubTab = name || "13f";
  const nav = byId("institutionalSubTabs");
  if (nav) {
    nav.querySelectorAll(".sub-tab").forEach((btn) => btn.classList.toggle("is-active", btn.dataset.sub === institutionalSubTab));
    document.querySelectorAll("#tab-institutional .sub-panel").forEach((panel) => panel.classList.remove("is-active"));
    const panel = byId(`sub-inst-${institutionalSubTab}`) || byId("sub-inst-13f");
    if (panel) panel.classList.add("is-active");
  }
  if (institutionalSubTab === "13f") renderInstitutional13f();
  if (institutionalSubTab === "congress") renderCongressTrades();
  if (institutionalSubTab === "insider") renderInsiderTrades();
  if (institutionalSubTab === "activist") renderActivistStakes();
  if (institutionalSubTab === "events") renderMaterialEvents();
  if (institutionalSubTab === "ipo") renderIpoCalendar();
  if (push) {
    recordNav();
  }
}

// ==================== 내부자 거래 (SEC Form 4) ====================
let insiderKind = "all";
let insiderQuery = "";

function insiderFmtShares(n) {
  return Number.isFinite(n) ? Math.round(n).toLocaleString() : "—";
}
function insiderFmtUsd(n) {
  if (!Number.isFinite(n) || n === 0) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
function insiderKindClass(kind) {
  if (kind === "buy") return "ins-buy";
  if (kind === "sell") return "ins-sell";
  return "ins-neutral";
}

function setupInsiderControls() {
  const filter = byId("insiderKindFilter");
  if (filter && !filter.dataset.bound) {
    filter.dataset.bound = "1";
    filter.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        insiderKind = btn.dataset.kind || "all";
        filter.querySelectorAll("button").forEach((b) => b.classList.toggle("is-active", b === btn));
        renderInsiderTrades();
      });
    });
  }
  const search = byId("insiderSearch");
  if (search && !search.dataset.bound) {
    search.dataset.bound = "1";
    search.addEventListener("input", () => { insiderQuery = search.value; renderInsiderTrades(); });
  }
}

function renderInsiderTrades() {
  setupInsiderControls();
  renderInsiderCluster();
  const wrap = byId("insiderTable");
  const meta = byId("insiderMeta");
  if (!wrap) return;
  const payload = window.INSIDER_TRADES;
  if (!payload || !Array.isArray(payload.trades) || !payload.trades.length) {
    if (meta) meta.innerHTML = "";
    wrap.innerHTML = `<p class="muted">아직 내부자 거래 데이터가 없습니다. 데이터 수집(GitHub Actions) 후 표시됩니다.</p>`;
    return;
  }
  if (meta) {
    meta.innerHTML = `업데이트 ${escapeHtml(payload.updatedAtKst || "")} · 총 ${Number(payload.count || 0).toLocaleString()}건 · 출처 ${escapeHtml(payload.source || "SEC Form 4")}`;
  }
  const q = insiderQuery.trim().toLowerCase();
  let rows = payload.trades;
  if (insiderKind !== "all") rows = rows.filter((r) => r.kind === insiderKind);
  if (q) {
    rows = rows.filter((r) =>
      (r.ticker || "").toLowerCase().includes(q) ||
      (r.issuer || "").toLowerCase().includes(q) ||
      (r.owner || "").toLowerCase().includes(q));
  }
  const shown = rows.slice(0, 300);
  if (!shown.length) {
    wrap.innerHTML = `<p class="muted">조건에 맞는 거래가 없습니다.</p>`;
    return;
  }
  const body = shown.map((r) => {
    const kc = insiderKindClass(r.kind);
    const price = Number.isFinite(r.price) && r.price > 0 ? `$${Number(r.price).toFixed(2)}` : "—";
    return `
      <tr>
        <td class="ins-date">${escapeHtml(r.txDate || r.fileDate || "")}</td>
        <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.ticker || "")}">${escapeHtml(r.ticker || "")}</button></td>
        <td class="ins-owner"><span>${escapeHtml(r.owner || "")}</span><em>${escapeHtml(r.relation || "")}</em></td>
        <td><span class="ins-code ${kc}">${escapeHtml(r.codeLabel || r.code || "")}</span></td>
        <td class="ins-num">${insiderFmtShares(r.shares)}</td>
        <td class="ins-num">${price}</td>
        <td class="ins-num ins-value ${kc}">${insiderFmtUsd(r.value)}</td>
      </tr>`;
  }).join("");
  wrap.innerHTML = `
    <div class="insider-count">${rows.length.toLocaleString()}건 중 ${shown.length.toLocaleString()}건 표시${rows.length > 300 ? " (검색으로 좁혀보세요)" : ""}</div>
    <table class="insider-table">
      <thead><tr>
        <th>거래일</th><th>종목</th><th>보고자 / 직책</th><th>유형</th>
        <th class="ins-num">수량</th><th class="ins-num">단가</th><th class="ins-num">금액</th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table>`;
  wrap.querySelectorAll(".ins-ticker").forEach((btn) => {
    btn.addEventListener("click", () => selectTicker(btn.dataset.ticker, { openSearch: true }));
  });
}

// ===== #1 내부자 클러스터 매수 시그널 =====
function renderInsiderCluster() {
  const el = byId("insiderCluster");
  if (!el) return;
  const payload = window.INSIDER_TRADES;
  if (!payload || !Array.isArray(payload.trades)) { el.innerHTML = ""; return; }
  const byTicker = {};
  for (const r of payload.trades) {
    if (r.kind !== "buy" || !r.ticker) continue;
    const g = byTicker[r.ticker] || (byTicker[r.ticker] = { ticker: r.ticker, owners: new Set(), value: 0, count: 0 });
    g.owners.add(r.owner || "?");
    g.value += Number(r.value) || 0;
    g.count += 1;
  }
  const clusters = Object.values(byTicker)
    .filter((g) => g.owners.size >= 2)
    .sort((a, b) => b.owners.size - a.owners.size || b.value - a.value)
    .slice(0, 12);
  if (!clusters.length) { el.innerHTML = ""; return; }
  el.innerHTML = `
    <div class="cluster-head">🟢 클러스터 매수 <span>보관 기간 내 2인 이상 임원이 공개시장 매수(P)한 종목 — 강한 내부자 신뢰 신호</span></div>
    <div class="cluster-grid">
      ${clusters.map((g) => `
        <button type="button" class="cluster-card" data-ticker="${escapeHtml(g.ticker)}" title="${g.owners.size}명 매수 · ${g.count}건">
          <strong>${escapeHtml(g.ticker)}</strong>
          <span>${g.owners.size}명 · ${g.count}건</span>
          <em>${insiderFmtUsd(g.value)}</em>
        </button>`).join("")}
    </div>`;
  el.querySelectorAll(".cluster-card").forEach((b) =>
    b.addEventListener("click", () => selectTicker(b.dataset.ticker, { openSearch: true })));
}

// ===== #5 액티비스트 13D/G =====
let activistKind = "all";
let activistQuery = "";
function setupActivistControls() {
  const f = byId("activistKindFilter");
  if (f && !f.dataset.bound) {
    f.dataset.bound = "1";
    f.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      activistKind = b.dataset.kind || "all";
      f.querySelectorAll("button").forEach((x) => x.classList.toggle("is-active", x === b));
      renderActivistStakes();
    }));
  }
  const s = byId("activistSearch");
  if (s && !s.dataset.bound) { s.dataset.bound = "1"; s.addEventListener("input", () => { activistQuery = s.value; renderActivistStakes(); }); }
}
function renderActivistStakes() {
  setupActivistControls();
  const wrap = byId("activistTable");
  const meta = byId("activistMeta");
  if (!wrap) return;
  const payload = window.ACTIVIST_STAKES;
  if (!payload || !Array.isArray(payload.filings) || !payload.filings.length) {
    if (meta) meta.innerHTML = "";
    wrap.innerHTML = `<p class="muted">아직 13D/G 데이터가 없습니다. 데이터 수집 후 표시됩니다.</p>`;
    return;
  }
  if (meta) meta.innerHTML = `업데이트 ${escapeHtml(payload.updatedAtKst || "")} · 총 ${Number(payload.count || 0).toLocaleString()}건 · 출처 ${escapeHtml(payload.source || "SEC 13D/G")}`;
  const q = activistQuery.trim().toLowerCase();
  let rows = payload.filings;
  if (activistKind !== "all") rows = rows.filter((r) => r.kind === activistKind);
  if (q) rows = rows.filter((r) => (r.ticker || "").toLowerCase().includes(q) || (r.company || "").toLowerCase().includes(q) || (r.filer || "").toLowerCase().includes(q));
  const shown = rows.slice(0, 300);
  if (!shown.length) { wrap.innerHTML = `<p class="muted">조건에 맞는 공시가 없습니다.</p>`; return; }
  const body = shown.map((r) => {
    const kc = r.kind === "activist" ? "ins-buy" : "ins-neutral";
    return `<tr>
      <td class="ins-date">${escapeHtml(r.fileDate || "")}</td>
      <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.ticker || "")}">${escapeHtml(r.ticker || "")}</button><div class="ins-sub">${escapeHtml(r.company || "")}</div></td>
      <td><span class="ins-code ${kc}">${escapeHtml(r.form || "")}</span><div class="ins-sub">${escapeHtml(r.kindLabel || "")}</div></td>
      <td>${escapeHtml(r.filer || "")}</td>
      <td class="ins-num"><a href="${escapeHtml(r.link || "#")}" target="_blank" rel="noopener">원문</a></td>
    </tr>`;
  }).join("");
  wrap.innerHTML = `<div class="insider-count">${rows.length.toLocaleString()}건 중 ${shown.length.toLocaleString()}건</div>
    <table class="insider-table"><thead><tr><th>공시일</th><th>종목</th><th>유형</th><th>신고자</th><th class="ins-num">링크</th></tr></thead><tbody>${body}</tbody></table>`;
  wrap.querySelectorAll(".ins-ticker").forEach((b) => b.addEventListener("click", () => selectTicker(b.dataset.ticker, { openSearch: true })));
}

// ===== #6 주요 공시 8-K =====
let eventsHot = "all";
let eventsQuery = "";
function setupEventsControls() {
  const f = byId("eventsHotFilter");
  if (f && !f.dataset.bound) {
    f.dataset.bound = "1";
    f.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      eventsHot = b.dataset.hot || "all";
      f.querySelectorAll("button").forEach((x) => x.classList.toggle("is-active", x === b));
      renderMaterialEvents();
    }));
  }
  const s = byId("eventsSearch");
  if (s && !s.dataset.bound) { s.dataset.bound = "1"; s.addEventListener("input", () => { eventsQuery = s.value; renderMaterialEvents(); }); }
}
function renderMaterialEvents() {
  setupEventsControls();
  const wrap = byId("eventsTable");
  const meta = byId("eventsMeta");
  if (!wrap) return;
  const payload = window.MATERIAL_EVENTS;
  if (!payload || !Array.isArray(payload.events) || !payload.events.length) {
    if (meta) meta.innerHTML = "";
    wrap.innerHTML = `<p class="muted">아직 8-K 데이터가 없습니다. 데이터 수집 후 표시됩니다.</p>`;
    return;
  }
  if (meta) meta.innerHTML = `업데이트 ${escapeHtml(payload.updatedAtKst || "")} · 총 ${Number(payload.count || 0).toLocaleString()}건 · 출처 ${escapeHtml(payload.source || "SEC 8-K")}`;
  const q = eventsQuery.trim().toLowerCase();
  let rows = payload.events;
  if (eventsHot === "hot") rows = rows.filter((r) => r.hot);
  if (q) rows = rows.filter((r) => (r.ticker || "").toLowerCase().includes(q) || (r.company || "").toLowerCase().includes(q) || (r.items || []).some((i) => (i.label || "").toLowerCase().includes(q)));
  const shown = rows.slice(0, 300);
  if (!shown.length) { wrap.innerHTML = `<p class="muted">조건에 맞는 공시가 없습니다.</p>`; return; }
  const body = shown.map((r) => {
    const items = (r.items || []).map((i) => `<span class="ev-item${r.hot ? " ev-hot" : ""}">${escapeHtml(i.label)}</span>`).join(" ");
    return `<tr>
      <td class="ins-date">${escapeHtml(r.fileDate || "")}</td>
      <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.ticker || "")}">${escapeHtml(r.ticker || "")}</button><div class="ins-sub">${escapeHtml(r.company || "")}</div></td>
      <td>${items}</td>
      <td class="ins-num"><a href="${escapeHtml(r.link || "#")}" target="_blank" rel="noopener">원문</a></td>
    </tr>`;
  }).join("");
  wrap.innerHTML = `<div class="insider-count">${rows.length.toLocaleString()}건 중 ${shown.length.toLocaleString()}건</div>
    <table class="insider-table"><thead><tr><th>공시일</th><th>종목</th><th>이벤트</th><th class="ins-num">링크</th></tr></thead><tbody>${body}</tbody></table>`;
  wrap.querySelectorAll(".ins-ticker").forEach((b) => b.addEventListener("click", () => selectTicker(b.dataset.ticker, { openSearch: true })));
}

// ===== #7 IPO 캘린더 =====
let ipoStage = "all";
let ipoQuery = "";
function setupIpoControls() {
  const f = byId("ipoStageFilter");
  if (f && !f.dataset.bound) {
    f.dataset.bound = "1";
    f.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      ipoStage = b.dataset.stage || "all";
      f.querySelectorAll("button").forEach((x) => x.classList.toggle("is-active", x === b));
      renderIpoCalendar();
    }));
  }
  const s = byId("ipoSearch");
  if (s && !s.dataset.bound) { s.dataset.bound = "1"; s.addEventListener("input", () => { ipoQuery = s.value; renderIpoCalendar(); }); }
}
function renderIpoCalendar() {
  setupIpoControls();
  const wrap = byId("ipoTable");
  const meta = byId("ipoMeta");
  if (!wrap) return;
  const payload = window.IPO_CALENDAR;
  if (!payload || !Array.isArray(payload.ipos) || !payload.ipos.length) {
    if (meta) meta.innerHTML = "";
    wrap.innerHTML = `<p class="muted">아직 IPO 데이터가 없습니다. 데이터 수집 후 표시됩니다.</p>`;
    return;
  }
  if (meta) meta.innerHTML = `업데이트 ${escapeHtml(payload.updatedAtKst || "")} · 총 ${Number(payload.count || 0).toLocaleString()}건 · 출처 ${escapeHtml(payload.source || "SEC S-1/424B4")}`;
  const q = ipoQuery.trim().toLowerCase();
  let rows = payload.ipos;
  if (ipoStage !== "all") rows = rows.filter((r) => r.stage === ipoStage);
  if (q) rows = rows.filter((r) => (r.ticker || "").toLowerCase().includes(q) || (r.company || "").toLowerCase().includes(q));
  const shown = rows.slice(0, 300);
  if (!shown.length) { wrap.innerHTML = `<p class="muted">조건에 맞는 IPO가 없습니다.</p>`; return; }
  const body = shown.map((r) => {
    const sc = r.stage === "priced" ? "ins-buy" : "ins-neutral";
    return `<tr>
      <td class="ins-date">${escapeHtml(r.fileDate || "")}</td>
      <td><span class="ins-code ${sc}">${escapeHtml(r.stageLabel || "")}</span></td>
      <td>${escapeHtml(r.ticker || "—")}</td>
      <td>${escapeHtml(r.company || "")}</td>
      <td class="ins-num"><a href="${escapeHtml(r.link || "#")}" target="_blank" rel="noopener">원문</a></td>
    </tr>`;
  }).join("");
  wrap.innerHTML = `<div class="insider-count">${rows.length.toLocaleString()}건 중 ${shown.length.toLocaleString()}건</div>
    <table class="insider-table"><thead><tr><th>제출일</th><th>단계</th><th>티커</th><th>회사</th><th class="ins-num">링크</th></tr></thead><tbody>${body}</tbody></table>`;
}

// ===== #3 밸류에이션 랭킹 =====
let valOrder = "asc";
let valQuery = "";
function setupValuationControls() {
  const sectorSel = byId("valSector");
  if (sectorSel && !sectorSel.dataset.filled) {
    sectorSel.dataset.filled = "1";
    const sectors = [...new Set(data.stocks.filter((s) => s.sector !== "EXCHANGE TRADED FUNDS").map((s) => s.sector))].sort();
    sectorSel.innerHTML = `<option value="All">전체 섹터</option>` + sectors.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
  }
  ["valMetric", "valSector", "valCap"].forEach((id) => {
    const el = byId(id);
    if (el && !el.dataset.bound) { el.dataset.bound = "1"; el.addEventListener("change", renderValuation); }
  });
  const order = byId("valOrder");
  if (order && !order.dataset.bound) {
    order.dataset.bound = "1";
    order.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      valOrder = b.dataset.order; order.querySelectorAll("button").forEach((x) => x.classList.toggle("is-active", x === b)); renderValuation();
    }));
  }
  const s = byId("valSearch");
  if (s && !s.dataset.bound) { s.dataset.bound = "1"; s.addEventListener("input", () => { valQuery = s.value; renderValuation(); }); }
}
function renderValuation() {
  setupValuationControls();
  const wrap = byId("valuationTable");
  const meta = byId("valMeta");
  if (!wrap) return;
  const metric = byId("valMetric")?.value || "pe";
  const sector = byId("valSector")?.value || "All";
  const cap = byId("valCap")?.value || "all";
  const q = valQuery.trim().toLowerCase();
  const cfg = MAP_METRIC_CONFIG[metric] || {};
  const mf = window.MAP_FUNDAMENTALS || {};
  let rows = data.stocks.filter((s) => s.sector !== "EXCHANGE TRADED FUNDS")
    .filter((s) => sector === "All" || s.sector === sector)
    .filter((s) => bucketMatches(s, s.groups || [s.bucket].filter(Boolean), cap))
    .map((s) => ({ item: s, value: Number((mf[s.ticker] || {})[metric]) }))
    .filter((r) => Number.isFinite(r.value) && (metric === "divYield" ? r.value >= 0 : r.value > 0));
  if (q) rows = rows.filter((r) => r.item.ticker.toLowerCase().includes(q) || (r.item.company || "").toLowerCase().includes(q));
  rows.sort((a, b) => (valOrder === "asc" ? a.value - b.value : b.value - a.value));
  const shown = rows.slice(0, 200);
  if (meta) meta.innerHTML = `${rows.length.toLocaleString()}개 종목 · ${cfg.label || metric}`;
  if (!shown.length) { wrap.innerHTML = `<p class="muted">펀더멘털 데이터가 있는 종목이 없습니다.</p>`; return; }
  const fmtv = (v) => cfg.fmt === "pct" ? `${v.toFixed(1)}%` : cfg.fmt === "usd" ? `$${v.toFixed(2)}` : v.toFixed(2);
  const body = shown.map((r, i) => `<tr>
    <td class="ins-date">${i + 1}</td>
    <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.item.ticker)}">${escapeHtml(r.item.ticker)}</button><div class="ins-sub">${escapeHtml(r.item.company || "")}</div></td>
    <td class="ins-sub">${escapeHtml(r.item.sector)}</td>
    <td class="ins-num"><strong>${fmtv(r.value)}</strong></td>
    <td class="ins-num">$${Number(r.item.marketCapB || 0).toFixed(1)}B</td>
    <td class="ins-num ${cls(r.item.changePct)}">${fmtPct(r.item.changePct)}</td>
  </tr>`).join("");
  wrap.innerHTML = `<table class="insider-table"><thead><tr><th>#</th><th>종목</th><th>섹터</th><th class="ins-num">${escapeHtml(cfg.label || metric)}</th><th class="ins-num">시총</th><th class="ins-num">당일</th></tr></thead><tbody>${body}</tbody></table>`;
  wrap.querySelectorAll(".ins-ticker").forEach((b) => b.addEventListener("click", () => selectTicker(b.dataset.ticker, { openSearch: true })));
}

// ===== #7 공매도 잔고 =====
let shortSort = "dtc";
let shortQuery = "";
function setupShortControls() {
  const sort = byId("shortSort");
  if (sort && !sort.dataset.bound) {
    sort.dataset.bound = "1";
    sort.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      shortSort = b.dataset.sort; sort.querySelectorAll("button").forEach((x) => x.classList.toggle("is-active", x === b)); renderShortInterest();
    }));
  }
  const s = byId("shortSearch");
  if (s && !s.dataset.bound) { s.dataset.bound = "1"; s.addEventListener("input", () => { shortQuery = s.value; renderShortInterest(); }); }
}
function renderShortInterest() {
  setupShortControls();
  const wrap = byId("shortTable");
  const meta = byId("shortMeta");
  if (!wrap) return;
  const payload = window.SHORT_INTEREST;
  if (!payload || !Array.isArray(payload.rows) || !payload.rows.length) {
    if (meta) meta.innerHTML = "";
    wrap.innerHTML = `<p class="muted">아직 공매도 데이터가 없습니다. 데이터 수집 후 표시됩니다.</p>`;
    return;
  }
  if (meta) meta.innerHTML = `업데이트 ${escapeHtml(payload.updatedAtKst || "")} · ${Number(payload.count || 0).toLocaleString()}종목 · 기준일 ${escapeHtml(payload.settlementDate || "")}`;
  const q = shortQuery.trim().toLowerCase();
  let rows = payload.rows.slice();
  if (q) rows = rows.filter((r) => (r.ticker || "").toLowerCase().includes(q) || (r.company || "").toLowerCase().includes(q));
  rows.sort((a, b) => (shortSort === "dtc" ? (b.daysToCover || 0) - (a.daysToCover || 0) : (b.changePct ?? -999) - (a.changePct ?? -999)));
  const shown = rows.slice(0, 200);
  if (!shown.length) { wrap.innerHTML = `<p class="muted">조건에 맞는 종목이 없습니다.</p>`; return; }
  const body = shown.map((r, i) => {
    const chg = Number.isFinite(r.changePct) ? `${r.changePct > 0 ? "+" : ""}${r.changePct.toFixed(1)}%` : "—";
    const chgCls = r.changePct > 0 ? "ins-sell" : r.changePct < 0 ? "ins-buy" : "";
    return `<tr>
      <td class="ins-date">${i + 1}</td>
      <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.ticker)}">${escapeHtml(r.ticker)}</button><div class="ins-sub">${escapeHtml(r.company || "")}</div></td>
      <td class="ins-num"><strong>${Number(r.daysToCover || 0).toFixed(2)}</strong></td>
      <td class="ins-num">${insiderFmtShares(r.shortShares)}</td>
      <td class="ins-num ${chgCls}">${chg}</td>
    </tr>`;
  }).join("");
  wrap.innerHTML = `<table class="insider-table"><thead><tr><th>#</th><th>종목</th><th class="ins-num">잔고일수</th><th class="ins-num">공매도 주식수</th><th class="ins-num">전기대비</th></tr></thead><tbody>${body}</tbody></table>`;
  wrap.querySelectorAll(".ins-ticker").forEach((b) => b.addEventListener("click", () => selectTicker(b.dataset.ticker, { openSearch: true })));
}

// ===== #6 13F 변동 하이라이트 =====
function compute13fChanges() {
  const insts = (window.INSTITUTIONAL_13F || {}).institutions || [];
  const newBuys = {}, soldOut = {};
  for (const inst of insts) {
    const qs = (inst.quarters || []).slice().sort((a, b) => (a.reportDate || "").localeCompare(b.reportDate || ""));
    if (qs.length < 2) continue;
    const cur = new Set((qs[qs.length - 1].holdings || []).map((h) => h.ticker).filter(Boolean));
    const prev = new Set((qs[qs.length - 2].holdings || []).map((h) => h.ticker).filter(Boolean));
    for (const t of cur) if (!prev.has(t)) (newBuys[t] = newBuys[t] || { ticker: t, n: 0 }).n++;
    for (const t of prev) if (!cur.has(t)) (soldOut[t] = soldOut[t] || { ticker: t, n: 0 }).n++;
  }
  const top = (o) => Object.values(o).sort((a, b) => b.n - a.n).slice(0, 15);
  return { newBuys: top(newBuys), soldOut: top(soldOut) };
}
function render13fHighlights() {
  const el = byId("inst13fHighlights");
  if (!el) return;
  const { newBuys, soldOut } = compute13fChanges();
  if (!newBuys.length && !soldOut.length) { el.innerHTML = ""; return; }
  const list = (arr, c) => arr.map((x) => `<button type="button" class="hl-chip ${c}" data-ticker="${escapeHtml(x.ticker)}">${escapeHtml(x.ticker)} <em>${x.n}</em></button>`).join("");
  el.innerHTML = `
    <div class="hl-col"><h4>🟢 분기 신규 매수 Top <span>(기관 수)</span></h4><div class="hl-chips">${list(newBuys, "hl-buy")}</div></div>
    <div class="hl-col"><h4>🔴 분기 전량 매도 Top <span>(기관 수)</span></h4><div class="hl-chips">${list(soldOut, "hl-sell")}</div></div>`;
  el.querySelectorAll(".hl-chip").forEach((b) => b.addEventListener("click", () => selectTicker(b.dataset.ticker, { openSearch: true })));
}

// ===== #8 52주 레인지 바 =====
function render52wRange(item) {
  const el = byId("range52Bar");
  if (!el || !item) return;
  const f = (window.MAP_FUNDAMENTALS || {})[item.ticker] || {};
  const low = Number(f.low52), high = Number(f.high52), price = Number(item.price);
  if (!Number.isFinite(low) || !Number.isFinite(high) || high <= low || !Number.isFinite(price)) { el.innerHTML = ""; return; }
  const pct = Math.max(0, Math.min(100, (price - low) / (high - low) * 100));
  el.innerHTML = `
    <div class="r52-head"><span>52주 레인지</span><strong>저가 대비 ${pct.toFixed(0)}%</strong></div>
    <div class="r52-bar"><div class="r52-fill" style="width:${pct}%"></div><div class="r52-marker" style="left:${pct}%"></div></div>
    <div class="r52-ends"><span>저 $${low.toFixed(2)}</span><span>현 $${price.toFixed(2)}</span><span>고 $${high.toFixed(2)}</span></div>`;
}

// ===== #9 오늘의 시그널 통합 대시보드 =====
function signalCard(title, items, note) {
  const body = items.length
    ? items.map((x) => `<li><button type="button" class="ins-ticker" data-ticker="${escapeHtml(x.ticker)}">${escapeHtml(x.ticker)}</button><span>${escapeHtml(x.note || "")}</span></li>`).join("")
    : `<li class="muted">해당 신호 없음</li>`;
  return `<div class="signal-card"><h3>${title}</h3>${note ? `<p class="sig-note">${escapeHtml(note)}</p>` : ""}<ul>${body}</ul></div>`;
}
function renderSignals() {
  const el = byId("signalsGrid");
  if (!el) return;
  const cards = [];
  // 내부자 클러스터 매수
  const ins = (window.INSIDER_TRADES || {}).trades || [];
  const byT = {};
  for (const r of ins) {
    if (r.kind !== "buy" || !r.ticker) continue;
    const g = byT[r.ticker] || (byT[r.ticker] = { t: r.ticker, owners: new Set(), v: 0 });
    g.owners.add(r.owner || "?"); g.v += Number(r.value) || 0;
  }
  const clusters = Object.values(byT).filter((g) => g.owners.size >= 2).sort((a, b) => b.owners.size - a.owners.size || b.v - a.v).slice(0, 8);
  cards.push(signalCard("🟢 내부자 클러스터 매수", clusters.map((g) => ({ ticker: g.t, note: `${g.owners.size}명 · ${insiderFmtUsd(g.v)}` })), "2인+ 임원 공개시장 매수"));
  // 52주 신고가 근접
  const highs = data.stocks.filter((s) => s.sector !== "EXCHANGE TRADED FUNDS" && Number(s.newHighDistancePct) <= 0.5 && (s.marketCapB || 0) >= 2)
    .sort((a, b) => b.marketCapB - a.marketCapB).slice(0, 8);
  cards.push(signalCard("🚀 52주 신고가 근접", highs.map((s) => ({ ticker: s.ticker, note: `$${Number(s.price).toFixed(2)} · ${fmtPct(s.changePct)}` })), "고점 0.5% 이내"));
  // 주요 8-K
  const ev = ((window.MATERIAL_EVENTS || {}).events || []).filter((e) => e.hot).slice(0, 8);
  cards.push(signalCard("📣 주요 공시 8-K", ev.map((e) => ({ ticker: e.ticker, note: (e.items || []).map((i) => i.label).slice(0, 2).join(", ") }))));
  // 액티비스트 13D
  const act = ((window.ACTIVIST_STAKES || {}).filings || []).filter((a) => a.kind === "activist").slice(0, 8);
  cards.push(signalCard("📐 액티비스트 13D", act.map((a) => ({ ticker: a.ticker, note: a.filer || "" }))));
  // 신규 상장
  const ipo = ((window.IPO_CALENDAR || {}).ipos || []).filter((i) => i.stage === "priced").slice(0, 8);
  cards.push(signalCard("🆕 신규 상장(가격확정)", ipo.map((i) => ({ ticker: i.ticker || "—", note: i.company || "" }))));
  el.innerHTML = cards.join("");
  el.querySelectorAll(".ins-ticker").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.ticker && b.dataset.ticker !== "—") selectTicker(b.dataset.ticker, { openSearch: true });
  }));
  renderAggregateInsights();
}

// ===== 집계 인사이트 (의회·내부자 종합) =====
function aggBars(items, fmtVal, color) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return items.map((i) => {
    const lbl = i.ticker
      ? `<button type="button" class="agg-label ins-ticker" data-ticker="${escapeHtml(i.ticker)}">${escapeHtml(i.label)}</button>`
      : `<span class="agg-label">${escapeHtml(i.label)}</span>`;
    return `<div class="agg-row">${lbl}<div class="agg-bar-wrap"><div class="agg-bar" style="width:${(i.value / max * 100).toFixed(1)}%;background:${color}"></div></div><span class="agg-val">${fmtVal(i.value)}</span></div>`;
  }).join("");
}
function renderAggregateInsights() {
  const el = byId("aggInsights");
  if (!el) return;
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const usd = (v) => v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${v.toFixed(0)}`;
  const cards = [];
  // 의회 30일 순매수 TOP5
  const cg = (window.CONGRESS_TRADES || {}).byTicker || {};
  const netByT = [];
  for (const [t, info] of Object.entries(cg)) {
    let net = 0;
    for (const tr of (info.trades || [])) {
      if ((tr.transactionDate || "") < cutoff) continue;
      const amt = Number(tr.amountMid) || 0;
      net += (tr.side === "buy" || tr.type === "Purchase") ? amt : -amt;
    }
    if (net > 0) netByT.push({ ticker: t, label: t, value: net });
  }
  netByT.sort((a, b) => b.value - a.value);
  cards.push(`<div class="agg-card"><h3>🏛 의원 순매수 TOP5</h3>${netByT.length ? aggBars(netByT.slice(0, 5), usd, "#3b82f6") : '<p class="muted">최근 30일 순매수 데이터 없음</p>'}</div>`);
  // 내부자 매수 거래대금 섹터 랭킹 (30일)
  const ins = (window.INSIDER_TRADES || {}).trades || [];
  const bySec = {};
  for (const r of ins) {
    if (r.kind !== "buy" || (r.fileDate || "") < cutoff) continue;
    const st = stockByTicker(r.ticker);
    if (!st || !st.sector) continue;
    bySec[st.sector] = (bySec[st.sector] || 0) + (Number(r.value) || 0);
  }
  const secRows = Object.entries(bySec).map(([s, v]) => ({ label: s, value: v })).sort((a, b) => b.value - a.value).slice(0, 8);
  cards.push(`<div class="agg-card"><h3>🧑‍💼 내부자 매수대금 섹터 랭킹</h3>${secRows.length ? aggBars(secRows, usd, "#16a34a") : '<p class="muted">최근 30일 내부자 매수 데이터 없음</p>'}</div>`);
  el.innerHTML = cards.join("");
  el.querySelectorAll(".ins-ticker[data-ticker]").forEach((b) => b.addEventListener("click", () => selectTicker(b.dataset.ticker, { openSearch: true })));
}

function activateCalendarSub(name, { push = false } = {}) {
  calendarSubTab = name || "macro";
  const nav = byId("calendarSubTabs");
  if (nav) {
    nav.querySelectorAll(".sub-tab").forEach((btn) => btn.classList.toggle("is-active", btn.dataset.sub === calendarSubTab));
    document.querySelectorAll("#tab-calendar .sub-panel").forEach((panel) => panel.classList.remove("is-active"));
    const panel = byId(`sub-${calendarSubTab}`);
    if (panel) panel.classList.add("is-active");
  }
  if (calendarSubTab === "macro") loadCalendar();
  if (calendarSubTab === "earnings") loadEarningsCalendar();
  if (push) {
    recordNav();
  }
}

function applyCommunityBoardTickerFilter(ticker) {
  const resolved = ticker
    ? (resolveCommunityTickerInput(ticker) || String(ticker).trim().toUpperCase())
    : "";
  communityBoardTickerFilter = resolved;
  communityBoardPage = 1;
  const filterEl = byId("communityFilter");
  const tickerEl = byId("communityFilterTicker");
  if (filterEl) filterEl.value = "all";
  if (tickerEl) tickerEl.value = resolved;
}

function activateCommunitySub(name, { push = false, communityTicker = null } = {}) {
  if (name === "sns") name = "news";
  communitySubTab = name || "trending";
  if (communityTicker != null) applyCommunityBoardTickerFilter(communityTicker);
  const nav = byId("communitySubTabs");
  if (nav) {
    nav.querySelectorAll(".sub-tab").forEach((btn) => btn.classList.toggle("is-active", btn.dataset.sub === communitySubTab));
    document.querySelectorAll("#tab-community .sub-panel").forEach((panel) => panel.classList.remove("is-active"));
    const panel = byId(`sub-community-${communitySubTab}`);
    if (panel) panel.classList.add("is-active");
  }
  if (communitySubTab === "trending") {
    stopCommunityPolling();
    renderCommunityTrending();
  }
  if (communitySubTab === "board") {
    communityClearNewBanner();
    fetchCommunityPosts();
    startCommunityPolling();
  }
  if (communitySubTab === "news" || communitySubTab === "sns") {
    stopCommunityPolling();
    renderCommunityNews();
  }
  if (communitySubTab === "vote") {
    stopCommunityPolling();
    renderCommunityVote();
  }
  if (push) recordNav();
}

let currentViewMode = "basic";

function setViewMode(mode, { persist = true } = {}) {
  currentViewMode = mode === "advanced" ? "advanced" : "basic";
  const tabs = byId("mainTabs");
  if (tabs) tabs.dataset.viewMode = currentViewMode;
  document.documentElement.dataset.viewMode = currentViewMode;
  byId("viewModeSwitch")?.querySelectorAll("[data-view-mode]").forEach((button) => {
    const active = button.dataset.viewMode === currentViewMode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (persist) {
    try { localStorage.setItem(VIEW_MODE_STORAGE_KEY, currentViewMode); } catch (_) {}
  }
  requestAnimationFrame(layoutMobileTabs);
}

function setupViewMode(requestedTab) {
  let saved = "basic";
  try { saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY) || "basic"; } catch (_) {}
  const requestedButton = requestedTab ? document.querySelector(`[data-tab="${requestedTab}"]`) : null;
  if (requestedButton?.dataset.advanced === "true") saved = "advanced";
  setViewMode(saved, { persist: false });
  byId("viewModeSwitch")?.querySelectorAll("[data-view-mode]").forEach((button) => {
    button.addEventListener("click", () => setViewMode(button.dataset.viewMode));
  });
}

const MOBILE_TABS_MQ = "(max-width: 960px)";

function layoutMobileTabs() {
  const wrap = byId("tabsScrollWrap");
  const tabsEl = byId("mainTabs");
  if (!wrap || !tabsEl) return;

  const isCarousel = window.matchMedia(MOBILE_TABS_MQ).matches;
  wrap.classList.toggle("is-carousel", isCarousel);
  tabsEl.classList.toggle("is-carousel", isCarousel);

  if (!isCarousel) {
    tabsEl.style.removeProperty("--tab-width");
    tabsEl.querySelectorAll(".tab").forEach((tab) => {
      tab.style.removeProperty("width");
      tab.style.removeProperty("flex");
      tab.style.removeProperty("minWidth");
      tab.style.removeProperty("maxWidth");
    });
    updateTabsScrollHints();
    return;
  }

  const gap = 6;
  const width = wrap.clientWidth;
  const visible = width >= 560 ? 4 : width >= 400 ? 3.5 : 3;
  const gapCount = visible >= 4 ? 3 : visible >= 3.5 ? 2.5 : 2;
  const tabWidth = Math.max(96, Math.floor((width - gap * gapCount) / visible));

  tabsEl.style.setProperty("--tab-width", `${tabWidth}px`);
  tabsEl.querySelectorAll(".tab").forEach((tab) => {
    const px = `${tabWidth}px`;
    tab.style.width = px;
    tab.style.flex = `0 0 ${px}`;
    tab.style.minWidth = px;
    tab.style.maxWidth = px;
  });

  updateTabsScrollHints();
}

function scrollTabIntoView(tabBtn) {
  if (!tabBtn) return;
  const tabsEl = byId("mainTabs");
  if (!tabsEl || !tabsEl.classList.contains("is-carousel")) return;
  const tabsLeft = tabsEl.getBoundingClientRect().left;
  const tabsWidth = tabsEl.clientWidth;
  const btnLeft = tabBtn.offsetLeft;
  const btnWidth = tabBtn.offsetWidth;
  const target = btnLeft - tabsLeft - (tabsWidth - btnWidth) / 2;
  tabsEl.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
}

function updateTabsScrollHints() {
  const wrap = byId("tabsScrollWrap");
  const tabsEl = byId("mainTabs");
  if (!wrap || !tabsEl) return;
  if (!wrap.classList.contains("is-carousel")) {
    wrap.classList.remove("can-scroll-left", "can-scroll-right");
    return;
  }
  const maxScroll = tabsEl.scrollWidth - tabsEl.clientWidth;
  wrap.classList.toggle("can-scroll-left", tabsEl.scrollLeft > 4);
  wrap.classList.toggle("can-scroll-right", maxScroll > 4 && tabsEl.scrollLeft < maxScroll - 4);
}

function activateTab(name, { push = true, ticker = null, sub = null, communityTicker = null } = {}) {
  const resolved = normalizeTabRequest(name, sub);
  name = resolved.tab;
  sub = resolved.sub;
  const tabBtn = document.querySelector(`[data-tab="${name}"]`);
  if (!tabBtn) return;
  if (tabBtn.dataset.advanced === "true" && currentViewMode !== "advanced") setViewMode("advanced");
  document.querySelectorAll(".tab").forEach((item) => item.classList.remove("is-active"));
  document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("is-active"));
  tabBtn.classList.add("is-active");
  byId(`tab-${name}`).classList.add("is-active");
  scrollTabIntoView(tabBtn);
  currentTab = name;
  if (name === "search") activateSearchSub(sub || searchSubTab, { push: false });
  if (name === "calendar") activateCalendarSub(sub || calendarSubTab, { push: false });
  if (name === "institutional") activateInstitutionalSub(sub || institutionalSubTab, { push: false });
  if (name === "community") activateCommunitySub(sub || communitySubTab, { push: false, communityTicker });
  if (name !== "community") stopCommunityPolling();
  if (name === "map") renderTreemap();
  if (name === "signals") renderSignals();
  if (push) recordNav();
}

function setupTabs() {
  const tabsEl = byId("mainTabs");
  if (tabsEl) applySavedTabOrder(tabsEl);

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      // 드래그(순서 변경) 직후의 클릭은 탭 전환으로 처리하지 않는다.
      if (tabDragJustHappened) { tabDragJustHappened = false; return; }
      const name = tab.dataset.tab;
      activateTab(name, { push: name !== currentTab });
    });
  });

  const wrap = byId("tabsScrollWrap");
  if (tabsEl && wrap) {
    tabsEl.addEventListener("scroll", updateTabsScrollHints, { passive: true });
    window.addEventListener("resize", layoutMobileTabs);
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(() => layoutMobileTabs()).observe(wrap);
    }
    requestAnimationFrame(layoutMobileTabs);
  }

  if (tabsEl) setupTabReorder(tabsEl);

  // 뒤로가기 동작은 setupBackGuard()의 popstate 핸들러가 담당한다.
}

// ===== 메인 탭 순서 변경(드래그) =====
const TAB_ORDER_KEY = "mir_tab_order_v1";
let tabDragJustHappened = false;

function saveTabOrder(nav) {
  const order = [...nav.querySelectorAll(".tab")].map((t) => t.dataset.tab);
  try { localStorage.setItem(TAB_ORDER_KEY, JSON.stringify(order)); } catch (_) {}
}

function applySavedTabOrder(nav) {
  let order = null;
  try { order = JSON.parse(localStorage.getItem(TAB_ORDER_KEY) || "null"); } catch (_) { order = null; }
  if (!Array.isArray(order)) return;
  const all = [...nav.querySelectorAll(".tab")];
  const byName = new Map(all.map((t) => [t.dataset.tab, t]));
  const seen = new Set();
  const final = [];
  order.forEach((n) => { if (byName.has(n)) { final.push(byName.get(n)); seen.add(n); } });
  all.forEach((t) => { if (!seen.has(t.dataset.tab)) final.push(t); }); // 새 탭은 뒤에 유지
  final.forEach((t) => nav.appendChild(t));
}

// PC: 좌클릭 후 일정 거리 이동하면 그랩 / 모바일: 길게 눌러(롱프레스) 그랩
function setupTabReorder(nav) {
  const LONG_PRESS_MS = 320;
  const MOVE_THRESHOLD = 8;
  let dragEl = null, placeholder = null, pointerId = null;
  let startX = 0, grabOffsetX = 0, fixedTop = 0, dragW = 0, dragH = 0;
  let dragging = false, moved = false, longPressTimer = null;

  const clearLongPress = () => { if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; } };

  // 그랩한 탭을 커서 아래에 '띄워서'(position:fixed) 따라오게 하고, 빈 자리는 placeholder가 차지한다.
  function beginDrag() {
    if (!dragEl) return;
    dragging = true;
    const rect = dragEl.getBoundingClientRect();
    grabOffsetX = startX - rect.left;
    fixedTop = rect.top;
    dragW = rect.width;
    dragH = rect.height;

    placeholder = document.createElement("div");
    placeholder.className = "tab-placeholder";
    placeholder.style.width = `${dragW}px`;
    placeholder.style.height = `${dragH}px`;
    nav.insertBefore(placeholder, dragEl);

    dragEl.classList.add("is-dragging");
    nav.classList.add("is-reordering");
    Object.assign(dragEl.style, {
      position: "fixed",
      left: `${rect.left}px`,
      top: `${fixedTop}px`,
      width: `${dragW}px`,
      height: `${dragH}px`,
      margin: "0",
      zIndex: "1000",
      pointerEvents: "none",
      transform: "none",
    });
    try { dragEl.setPointerCapture(pointerId); } catch (_) {}
  }

  function movePlaceholder(pointerX) {
    const tabs = [...nav.querySelectorAll(".tab")].filter((t) => t !== dragEl);
    for (const other of tabs) {
      const r = other.getBoundingClientRect();
      if (pointerX < r.left + r.width / 2) {
        if (placeholder.nextSibling !== other) nav.insertBefore(placeholder, other);
        return;
      }
    }
    if (nav.lastElementChild !== placeholder) nav.appendChild(placeholder);
  }

  function onDown(e) {
    if (e.button != null && e.button > 0) return; // 좌클릭/터치만
    const tab = e.target.closest(".tab");
    if (!tab || !nav.contains(tab)) return;
    dragEl = tab; pointerId = e.pointerId; startX = e.clientX;
    dragging = false; moved = false;
    clearLongPress();
    if (e.pointerType === "touch") {
      longPressTimer = setTimeout(() => { if (dragEl && !moved) beginDrag(); }, LONG_PRESS_MS);
    }
  }

  function onMove(e) {
    if (!dragEl || e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > MOVE_THRESHOLD) moved = true;
    if (!dragging) {
      if (e.pointerType !== "touch" && Math.abs(dx) > MOVE_THRESHOLD) {
        beginDrag(); // 마우스: 임계 이동 시 그랩
      } else if (e.pointerType === "touch" && moved) {
        clearLongPress(); // 롱프레스 전에 움직이면 스크롤로 간주 → 그랩 취소
        dragEl = null;
        return;
      }
      if (!dragging) return;
    }
    e.preventDefault();
    // 그랩한 탭은 항상 커서에 정확히 붙어 따라온다(끊김 없음).
    dragEl.style.left = `${e.clientX - grabOffsetX}px`;
    dragEl.style.top = `${fixedTop}px`;
    movePlaceholder(e.clientX);
  }

  function finishDrag() {
    if (!dragging || !dragEl) return;
    if (placeholder && placeholder.parentNode === nav) {
      nav.insertBefore(dragEl, placeholder);
    }
    dragEl.classList.remove("is-dragging");
    nav.classList.remove("is-reordering");
    ["position", "left", "top", "width", "height", "margin", "zIndex", "pointerEvents", "transform"]
      .forEach((p) => dragEl.style.removeProperty(p.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())));
    if (placeholder) { placeholder.remove(); placeholder = null; }
    try { dragEl.releasePointerCapture(pointerId); } catch (_) {}
    saveTabOrder(nav);
    layoutMobileTabs();
    tabDragJustHappened = true; // 뒤따르는 click 무시
    setTimeout(() => { tabDragJustHappened = false; }, 60);
  }

  function onUp() {
    clearLongPress();
    if (dragging) finishDrag();
    dragEl = null; pointerId = null; dragging = false; moved = false;
  }

  // 모바일 롱프레스 시 뜨는 컨텍스트 메뉴/선택 방지
  nav.addEventListener("contextmenu", (e) => { if (dragging) e.preventDefault(); });
  nav.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove, { passive: false });
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
}

function setupFilters() {
  const buckets = [
    ["all", "All US Stocks"],
    ["all_with_etf", "All incl. ETFs"],
    ["idx_sp500", "S&P 500"],
    ["idx_ndx100", "Nasdaq 100"],
    ["idx_nasdaq", "Nasdaq Listed"],
    ["idx_nyse", "NYSE Listed"],
    ["gte10b", "Stocks >= 10B"],
    ["1to10b", "Stocks 1B-10B"],
    ["lt1b", "Stocks < 1B"],
    ["all_misc", "ETF / Misc"]
  ];
  byId("bucketFilter").innerHTML = buckets.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
  byId("bucketFilter").value = "idx_sp500";
  byId("topBucket").innerHTML = buckets.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
  byId("topBucket").value = "idx_sp500";

  const sectors = ["All", ...[...new Set(data.stocks.map((item) => item.sector))].sort()];
  byId("sectorFilter").innerHTML = sectors.map((sector) => `<option value="${sector}">${sector}</option>`).join("");
  byId("sectorFilter").value = "All";
  byId("topSector").innerHTML = sectors.map((sector) => `<option value="${sector}">${sector}</option>`).join("");
  byId("topSector").value = "All";

  byId("tickerOptions").innerHTML = data.stocks.flatMap((item) => {
    const aliases = (window.TICKER_ALIASES_KO || {})[item.ticker] || [];
    const rows = [`<option value="${escapeHtml(item.ticker)}">${escapeHtml(item.company)}</option>`];
    aliases.slice(0, 2).forEach((alias) => {
      rows.push(`<option value="${escapeHtml(item.ticker)}">${escapeHtml(alias)} · ${escapeHtml(item.ticker)}</option>`);
    });
    return rows;
  }).join("");
  byId("tickerSearch").value = selectedTicker;

  const etfRows = data.health?.etfRelative?.rows || [];
  const etfGroups = ["All", ...[...new Set(etfRows.map((item) => item.group).filter(Boolean))].sort()];
  const etfRsGroupSel = byId("etfRsGroup");
  if (etfRsGroupSel) etfRsGroupSel.innerHTML = etfGroups.map((group) => `<option value="${group}">${group}</option>`).join("");
  const benchmarks = data.health?.etfRelative?.benchmarks?.length
    ? data.health.etfRelative.benchmarks
    : ["SPY", "QQQ", "TQQQ", "DIA", "IWM"];
  const etfRsBenchSel = byId("etfRsBenchmark");
  if (etfRsBenchSel) etfRsBenchSel.innerHTML = benchmarks
    .map((ticker) => `<option value="${ticker}">${ticker} 대비</option>`)
    .join("");

  // Also populate sectorEtfRsGroup (same groups as etfRsGroup)
  byId("sectorEtfRsGroup").innerHTML = etfGroups.map((group) => `<option value="${group}">${group}</option>`).join("");

  const scrBucket = byId("scrBucket");
  if (scrBucket) scrBucket.innerHTML = buckets.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
  const scrSector = byId("scrSector");
  if (scrSector) scrSector.innerHTML = sectors.map((sector) => `<option value="${sector}">${sector}</option>`).join("");
}

function setupEvents() {
  ["bucketFilter", "sectorFilter", "metricFilter", "tileSizeFilter"].forEach((id) => byId(id).addEventListener("change", renderTreemap));
  byId("heatmapSearch").addEventListener("input", renderTreemap);
  byId("resetFilters").addEventListener("click", () => {
    byId("bucketFilter").value = "idx_sp500";
    byId("sectorFilter").value = "All";
    byId("metricFilter").value = "changePct";
    byId("tileSizeFilter").value = "marketCapB";
    byId("heatmapSearch").value = "";
    renderTreemap();
  });
  ["topMetric", "topBucket", "topSector", "topNewHighRecency", "topNewHigh", "topMinRs", "topMinEps", "topMinVolume", "topMinMarketCap", "topLimit"].forEach((id) => {
    const el = byId(id);
    if (el) el.addEventListener("change", () => {
      const preset = byId("topPreset");
      if (preset) preset.value = "custom";
      renderTopStocks();
    });
  });
  const topPreset = byId("topPreset");
  if (topPreset) topPreset.addEventListener("change", applyTopPreset);
  const topReset = byId("topResetFilters");
  if (topReset) topReset.addEventListener("click", resetTopScreener);
  ["etfRsBenchmark", "etfRsPeriod", "etfRsGroup"].forEach((id) => {
    const el = byId(id);
    if (el) el.addEventListener("change", () => {
      if (id === "etfRsGroup") selectedEtfRsCategory = null;
      renderEtfRelativeStrength();
    });
  });
  const etfRsGrid = byId("etfRelativeStrength");
  if (etfRsGrid) etfRsGrid.addEventListener("click", (event) => {
    const card = event.target.closest(".etf-rs-card");
    if (!card) return;
    showConstituentPanel(card.dataset.category, byId("etfRsPeriod").value);
  });

  // Sector tab sub-tab switching
  byId("sectorSubTabs").querySelectorAll(".sub-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      byId("sectorSubTabs").querySelectorAll(".sub-tab").forEach((b) => b.classList.remove("is-active"));
      document.querySelectorAll("#tab-sector .sub-panel").forEach((p) => p.classList.remove("is-active"));
      btn.classList.add("is-active");
      byId(`sub-${btn.dataset.sub}`).classList.add("is-active");
      closeConstituentPanel();
      if (btn.dataset.sub === "etf-rs") renderSectorEtfRelativeStrength();
      if (btn.dataset.sub === "etf-lev") renderLeveragedEtfPage();
      if (btn.dataset.sub === "rrg") renderRrg();
    });
  });
  byId("rrgTail")?.addEventListener("change", renderRrg);

  const searchSubTabs = byId("searchSubTabs");
  if (searchSubTabs) {
    searchSubTabs.querySelectorAll(".sub-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (currentTab !== "search") activateTab("search", { push: false });
        activateSearchSub(btn.dataset.sub, { push: true });
      });
    });
  }

  const calendarSubTabs = byId("calendarSubTabs");
  if (calendarSubTabs) {
    calendarSubTabs.querySelectorAll(".sub-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (currentTab !== "calendar") activateTab("calendar", { push: false });
        activateCalendarSub(btn.dataset.sub, { push: true });
      });
    });
  }

  const institutionalSubTabs = byId("institutionalSubTabs");
  if (institutionalSubTabs) {
    institutionalSubTabs.querySelectorAll(".sub-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (currentTab !== "institutional") activateTab("institutional", { push: false });
        activateInstitutionalSub(btn.dataset.sub, { push: true });
      });
    });
  }

  const communitySubTabs = byId("communitySubTabs");
  if (communitySubTabs) {
    communitySubTabs.querySelectorAll(".sub-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (currentTab !== "community") activateTab("community", { push: false });
        activateCommunitySub(btn.dataset.sub, { push: true });
      });
    });
  }
  setupCommunityBoard();

  // Sector tab ETF RS panel controls
  ["sectorEtfRsBenchmark", "sectorEtfRsPeriod", "sectorEtfRsGroup", "sectorEtfRsSort"].forEach((id) => {
    byId(id).addEventListener("change", renderSectorEtfRelativeStrength);
  });
  byId("sectorEtfGrid").addEventListener("click", (event) => {
    const card = event.target.closest(".etf-rs-card");
    if (!card) return;
    showConstituentPanel(card.dataset.category, byId("sectorEtfRsPeriod").value);
  });
  ["levEtfType", "levEtfScope", "levEtfSort"].forEach((id) => {
    byId(id)?.addEventListener("change", renderLeveragedEtfPage);
  });
  const levSearch = byId("levEtfSearch");
  if (levSearch) {
    let levSearchTimer = null;
    levSearch.addEventListener("input", () => {
      clearTimeout(levSearchTimer);
      levSearchTimer = setTimeout(renderLeveragedEtfPage, 180);
    });
  }

  byId("constituentPanelClose").addEventListener("click", closeConstituentPanel);
  byId("constituentBackdrop").addEventListener("click", closeConstituentPanel);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeConstituentPanel();
  });
  byId("jumpCategory").addEventListener("change", renderJump);
  byId("jumpSort").addEventListener("change", renderJump);
  byId("sectorSort").addEventListener("change", renderSectors);
  byId("searchButton").addEventListener("click", () => selectTicker(byId("tickerSearch").value));
  byId("tickerSearch").addEventListener("keydown", (event) => {
    if (event.key === "Enter") selectTicker(event.target.value);
  });
  byId("bulkRun").addEventListener("click", renderBulk);
  const bulkSave = byId("bulkSave");
  if (bulkSave) bulkSave.addEventListener("click", () => {
    saveWatchlistFromInput(byId("bulkInput").value);
    renderBulk();
  });
  const bulkCompare = byId("bulkCompare");
  if (bulkCompare) bulkCompare.addEventListener("click", () => {
    byId("compareInput").value = watchlist.join(", ");
    activateTab("search", { sub: "compare", push: true });
  });
  setupWatchlistUi();
  setupScreenerEvents();
  setupNlScreener();
  setupCompareEvents();
  setupBacktestEvents();
  setupEarningsEvents();
  document.addEventListener("click", (event) => {
    const scoreButton = event.target.closest("[data-score-help]");
    if (scoreButton) {
      event.preventDefault();
      event.stopPropagation();
      const kind = scoreButton.dataset.scoreHelp;
      scoreHelpOpen = scoreHelpOpen === kind ? null : kind;
      const base = data.stocks.find((row) => row.ticker === selectedTicker);
      if (base) byId("searchFacts").innerHTML = stockFacts(applyLive(withDetail(base)), "Search Ticker");
      return;
    }
    const moveButton = event.target.closest("[data-move-analysis]");
    if (moveButton) {
      event.preventDefault();
      event.stopPropagation();
      runMoveAnalysis(moveButton.dataset.moveAnalysis);
      return;
    }
    const communityBoardButton = event.target.closest("[data-community-board]");
    if (communityBoardButton) {
      event.preventDefault();
      event.stopPropagation();
      openCommunityBoardForTicker(communityBoardButton.dataset.communityBoard);
      return;
    }
    const communityWriteButton = event.target.closest("[data-community-write]");
    if (communityWriteButton) {
      event.preventDefault();
      event.stopPropagation();
      openCommunityComposeForTicker(communityWriteButton.dataset.communityWrite);
      return;
    }
    const star = event.target.closest("[data-watch]");
    if (star) {
      event.preventDefault();
      event.stopPropagation();
      toggleWatchlist(star.dataset.watch);
    }
  });
  byId("stockTreemap").addEventListener("mousemove", handleHeatmapPointer);
  byId("stockTreemap").addEventListener("mouseleave", hideHeatmapTooltip);
  setupChartControls();
  setupWatchAlertEvents();
  window.addEventListener("resize", debounce(renderTreemap, 120));
  window.addEventListener("resize", syncCardNewsHeight);
  // 폰트가 늦게 로드되면 데이터박스 높이가 바뀔 수 있어 한 번 더 맞춤
  window.addEventListener("load", syncCardNewsHeight);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncCardNewsHeight);

  // Sector chart: timeframe and benchmark listeners
  byId("sectorTimeframeControls").querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      byId("sectorTimeframeControls").querySelectorAll("button").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      selectedSectorRange = btn.dataset.range;
      renderSectorDetail();
    });
  });
  byId("sectorBenchmarkSelect").addEventListener("change", (e) => {
    selectedSectorBenchmark = e.target.value;
    renderSectorDetail();
  });
}

// Re-derive the currently shown stock (snapshot + detail + live data).
function currentChartItem() {
  const base = data.stocks.find((row) => row.ticker === selectedTicker) || data.stocks[0];
  return applyLive(withDetail(base));
}

// Redraw only the price chart (no news/facts re-render) — used by zoom/pan/wheel/drag.
function redrawChart() {
  const item = currentChartItem();
  if (item) drawChart(item);
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
  byId("chartReset").addEventListener("click", () => {
    chartState = { ...chartState, zoom: 1, offset: 0 };
    redrawChart();
  });
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
   "showEma20", "showEma60", "showBoll", "showVwap", "showSupertrend", "showIchimoku", "showKeltner", "showDonchian",
   "showVolume", "showVolMa20", "showVolumeRatio", "showObv", "showAd",
   "showRsi", "showMacd", "showStoch", "showRoc", "showMomentum", "showWilliams", "showAtr", "showAdx", "showCci",
   "showRsSpy", "showRsQqq", "showRsSector", "showMansfield"].forEach((id) => {
    const el = byId(id);
    if (el) el.addEventListener("change", (event) => {
      chartState[id] = event.target.checked;
      redrawChart();
    });
  });
  setupChartPresetControls();
  setupChartInteractions();
  setupChartCompareControls();
}

function chartSettingIds() {
  return [
    "showSma5", "showSma10", "showSma20", "showSma60", "showSma120",
    "showEma20", "showEma60", "showBoll", "showVwap", "showSupertrend", "showIchimoku", "showKeltner", "showDonchian",
    "showVolume", "showVolMa20", "showVolumeRatio", "showObv", "showAd",
    "showRsi", "showMacd", "showStoch", "showRoc", "showMomentum", "showWilliams", "showAtr", "showAdx", "showCci",
    "showRsSpy", "showRsQqq", "showRsSector", "showMansfield"
  ];
}

function loadChartPresets() {
  try {
    const raw = JSON.parse(localStorage.getItem(CHART_PRESET_STORAGE_KEY) || "{}");
    chartPresets = raw && typeof raw === "object" ? raw : {};
  } catch (e) {
    chartPresets = {};
  }
}

function saveChartPresets() {
  try { localStorage.setItem(CHART_PRESET_STORAGE_KEY, JSON.stringify(chartPresets)); } catch (e) { /* ignore */ }
}

function currentChartPreset() {
  const settings = {};
  chartSettingIds().forEach((id) => { settings[id] = Boolean(chartState[id]); });
  return {
    range: chartState.range,
    barTf: chartState.barTf,
    settings,
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
  chartSettingIds().forEach((id) => {
    const el = byId(id);
    if (el) el.checked = Boolean(chartState[id]);
  });
}

function applyChartPreset(name) {
  const preset = chartPresets[name];
  if (!preset) return;
  chartState = {
    ...chartState,
    range: preset.range || chartState.range,
    barTf: preset.barTf || chartState.barTf,
    zoom: 1,
    offset: 0,
    ...(preset.settings || {})
  };
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
  byId("chartPresetSave")?.addEventListener("click", () => {
    const name = window.prompt("저장할 차트 프리셋 이름", "내 차트 설정");
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
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addChartCompareTicker(input.value);
    }
  });
  renderCompareChips();
}

function addChartCompareTicker(raw) {
  const ticker = String(raw || "").trim().toUpperCase();
  if (!ticker || ticker === selectedTicker || compareTickers.includes(ticker)) return;
  if (!stockByTicker(ticker)) {
    const input = byId("chartCompareInput");
    if (input) input.value = "";
    return;
  }
  compareTickers = compareTickers.concat(ticker).slice(-5);
  const input = byId("chartCompareInput");
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
}// TradingView-style mouse: wheel to zoom (cursor anchored), drag to pan.
function setupChartInteractions() {
  const svg = byId("priceChart");
  if (!svg) return;

  svg.addEventListener("wheel", (event) => {
    event.preventDefault();
    const g = priceChartGeom();
    const rect = svg.getBoundingClientRect();
    const vbX = ((event.clientX - rect.left) / rect.width) * g.width;
    const plotW = g.width - g.padL - g.padR;
    const frac = Math.max(0, Math.min(1, (vbX - g.padL) / plotW));
    zoomChartAt(frac, event.deltaY < 0 ? 1.2 : 1 / 1.2);
  }, { passive: false });

  let dragging = false;
  let startX = 0;
  let startOffset = 0;
  let dragN = 0;
  let dragWindow = 0;
  let dragPlotPx = 1;

  svg.addEventListener("mousedown", (event) => {
    const item = currentChartItem();
    if (!item) return;
    dragging = true;
    startX = event.clientX;
    startOffset = chartState.offset;
    dragN = chartBaseLength(item);
    dragWindow = Math.max(16, Math.floor(dragN / chartState.zoom));
    const rect = svg.getBoundingClientRect();
    const g = priceChartGeom();
    dragPlotPx = rect.width * ((g.width - g.padL - g.padR) / g.width);
    svg.classList.add("is-dragging");
    event.preventDefault();
  });

  window.addEventListener("mousemove", (event) => {
    if (!dragging) return;
    const dx = event.clientX - startX;
    const barsPerPx = dragWindow / Math.max(1, dragPlotPx);
    let next = Math.round(startOffset + dx * barsPerPx); // drag right -> older bars
    next = Math.max(0, Math.min(Math.max(0, dragN - dragWindow), next));
    if (next !== chartState.offset) {
      chartState.offset = next;
      redrawChart();
    }
  });

  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    svg.classList.remove("is-dragging");
  });

  // Touch: one finger pans, two fingers pinch-zoom.
  let touchMode = null;
  let pinchStartDist = 0;
  let pinchStartZoom = 1;
  const touchDist = (touches) => Math.hypot(
    touches[0].clientX - touches[1].clientX,
    touches[0].clientY - touches[1].clientY
  );

  svg.addEventListener("touchstart", (event) => {
    const item = currentChartItem();
    if (!item) return;
    if (event.touches.length === 1) {
      touchMode = "pan";
      startX = event.touches[0].clientX;
      startOffset = chartState.offset;
      dragN = chartBaseLength(item);
      dragWindow = Math.max(16, Math.floor(dragN / chartState.zoom));
      const rect = svg.getBoundingClientRect();
      const g = priceChartGeom();
      dragPlotPx = rect.width * ((g.width - g.padL - g.padR) / g.width);
    } else if (event.touches.length === 2) {
      touchMode = "pinch";
      pinchStartDist = touchDist(event.touches);
      pinchStartZoom = chartState.zoom;
    }
  }, { passive: true });

  svg.addEventListener("touchmove", (event) => {
    if (touchMode === "pan" && event.touches.length === 1) {
      const dx = event.touches[0].clientX - startX;
      const barsPerPx = dragWindow / Math.max(1, dragPlotPx);
      let next = Math.round(startOffset + dx * barsPerPx);
      next = Math.max(0, Math.min(Math.max(0, dragN - dragWindow), next));
      if (next !== chartState.offset) {
        chartState.offset = next;
        redrawChart();
      }
      if (Math.abs(dx) > 6) event.preventDefault();
    } else if (touchMode === "pinch" && event.touches.length === 2) {
      const dist = touchDist(event.touches);
      if (pinchStartDist > 0) setZoomAnchored(0.5, pinchStartZoom * (dist / pinchStartDist));
      event.preventDefault();
    }
  }, { passive: false });

  svg.addEventListener("touchend", (event) => {
    if (event.touches.length === 0) touchMode = null;
    else if (event.touches.length === 1) { touchMode = null; }
  });
}

function renderAll() {
  renderTreemap();
  renderSectors();
  renderTopStocks();
  renderJump();
  renderSearch();
  renderBulk();
  renderWatchlistBar();
  renderWatchAlerts();
  renderActionBoard();
  renderHealth();
  activateInstitutionalSub(institutionalSubTab, { push: false });
  renderDataFreshnessStatus();
  renderAiBriefing();
  renderSocialSentiment();
  renderCommunityNews();
}

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
  if (bucket === "all") return item.sector !== "EXCHANGE TRADED FUNDS";
  if (bucket === "all_with_etf") return true;
  if (bucket === "gte10b") return item.sector !== "EXCHANGE TRADED FUNDS" && Number(item.marketCapB || 0) >= 10;
  if (bucket === "1to10b") {
    const cap = Number(item.marketCapB || 0);
    return item.sector !== "EXCHANGE TRADED FUNDS" && cap >= 1 && cap < 10;
  }
  if (bucket === "lt1b") return item.sector !== "EXCHANGE TRADED FUNDS" && Number(item.marketCapB || 0) < 1;
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
  divYield:  { label: "Dividend Yield", good: "high", fmt: "pct", stops: [0.5, 1, 2, 3, 5] },
  eps:       { label: "EPS",            good: "high", fmt: "usd", stops: [0, 1, 3, 6, 10] },
  roe:       { label: "ROE",            good: "high", fmt: "pct", stops: [0, 5, 10, 17, 25] },
  roa:       { label: "ROA",            good: "high", fmt: "pct", stops: [0, 3, 6, 10, 15] },
  netMargin: { label: "Net Margin",     good: "high", fmt: "pct", stops: [0, 5, 10, 20, 30] },
};
// 초록(저평가/우수) → 빨강(고평가/부진) 6단계 팔레트
const MAP_FUND_PALETTE = ["#006b35", "#20a05a", "#64ad65", "#b26a4a", "#b6463f", "#6f1d2a"];
const MAP_NODATA_COLOR = "#475467"; // 데이터 없음 중립색

function mapFundamentalsFor(ticker) {
  return (window.MAP_FUNDAMENTALS || {})[ticker] || null;
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
  const v = Number(value);
  if (metric === "rsScore" || metric === "epsRevScore" || metric === "stochK") {
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

function renderTreemap() {
  const metric = byId("metricFilter").value;
  const sizeMetric = byId("tileSizeFilter").value;
  const query = byId("heatmapSearch").value.trim();
  const map = byId("stockTreemap");
  const width = map.clientWidth;
  // 숨겨진 탭(폭 0)에서 그리면 레이아웃이 깨진 채 남으므로 렌더하지 않음.
  // 지도 탭이 보이는데도 일시적으로 0이면 다음 프레임에 다시 시도.
  if (!width) {
    if (currentTab === "map") requestAnimationFrame(renderTreemap);
    return;
  }
  const height = map.clientHeight || 720;

  renderLegend(metric);

  const all = filteredStocks();
  if (!all.length) {
    map.innerHTML = `<div class="heatmap-empty">조건에 맞는 종목이 없습니다.</div>`;
    zoomView = null;
    renderSelected(data.stocks[0]);
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
        <div class="sector-title" data-zoom-sector="${escapeHtml(sector.sector)}" title="클릭하면 ${escapeHtml(sector.sector)} 확대">${sector.sector} · ${fmtMetric(sector.change, metric)} 🔍</div>
        ${industryRects.map(({ item: industry, rect: industryRect }) => industryBox(sector.sector, industry, industryRect, metric, sizeMetric, query)).join("")}
      </section>
    `;
  }).join("");

  // Click an industry box (e.g. Semiconductors) -> zoom it to fill the heatmap.
  map.querySelectorAll(".industry-box").forEach((box) => {
    box.addEventListener("click", (event) => {
      event.stopPropagation();
      zoomView = { sector: box.dataset.sector, industry: box.dataset.industry };
      renderTreemap();
    });
  });
  // Click a sector title -> zoom the whole sector.
  map.querySelectorAll(".sector-title[data-zoom-sector]").forEach((title) => {
    title.addEventListener("click", (event) => {
      event.stopPropagation();
      zoomView = { sector: title.dataset.zoomSector };
      renderTreemap();
    });
  });

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
      if (currentTab === "map") renderTreemap();
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
    map.querySelectorAll(".heat-tile").forEach((tile) => {
      tile.addEventListener("click", () => selectTicker(tile.dataset.ticker, { openSearch: true }));
    });
  } else {
    const industries = groupIndustries(scoped, metric, sizeMetric);
    const industryRects = squarify(industries, inner, (item) => item.weight);
    map.innerHTML = header + industryRects
      .map(({ item: industry, rect }) => industryBox(zoomView.sector, industry, rect, metric, sizeMetric, query)).join("");
    map.querySelectorAll(".industry-box").forEach((box) => {
      box.addEventListener("click", (event) => {
        event.stopPropagation();
        zoomView = { sector: box.dataset.sector, industry: box.dataset.industry };
        renderTreemap();
      });
    });
  }

  byId("treemapBack").addEventListener("click", () => { zoomView = null; renderTreemap(); });
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
  const cells = metric.includes("Score") || metric === "stochK"
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
  const showTicker = rect.w > 42 && rect.h > 26;
  const showCompany = rect.w > 110 && rect.h > 70;
  const showMetric = rect.w > 62 && rect.h > 48;
  return `
    <button
      class="heat-tile${sizeClass}${isSelected ? " is-selected" : ""}${isFocused ? " is-focus-pulse" : ""}${isMatch ? " is-match" : ""}${isDimmed ? " is-dimmed" : ""}"
      style="${rectStyle(rect)} background:${metricColor(value, metric)}"
      data-ticker="${item.ticker}"
      data-sector="${escapeHtml(item.sector)}"
      data-industry="${escapeHtml(item.industry)}"
      title="${item.ticker} · ${item.company} · ${label} · $${Number(item.price).toFixed(2)}"
    >
      ${showTicker ? `<strong>${escapeHtml(item.ticker)}</strong>` : ""}
      ${showCompany ? `<span>${escapeHtml(item.company)}</span>` : ""}
      ${showMetric ? `<small>${label}</small>` : ""}
    </button>
  `;
}

function handleHeatmapPointer(event) {
  const map = byId("stockTreemap");
  const tile = event.target.closest(".heat-tile");
  if (tile && map.contains(tile)) {
    const item = data.stocks.find((stockItem) => stockItem.ticker === tile.dataset.ticker);
    if (item) {
      renderSelected(item);
      showHeatmapTooltip(stockTooltip(item), event);
    }
    return;
  }

  const industry = event.target.closest(".industry-box");
  if (industry && map.contains(industry)) {
    showHeatmapTooltip(groupTooltip({
      type: "industry",
      sector: industry.dataset.sector,
      industry: industry.dataset.industry
    }), event);
    return;
  }

  const sector = event.target.closest(".sector-box");
  if (sector && map.contains(sector)) {
    showHeatmapTooltip(groupTooltip({
      type: "sector",
      sector: sector.dataset.sector
    }), event);
    return;
  }

  hideHeatmapTooltip();
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
  const tooltip = byId("heatmapTooltip");
  if (tooltip) tooltip.classList.remove("is-visible");
}

function stockTooltip(item) {
  const metric = byId("metricFilter").value;
  const metricCfg = MAP_METRIC_CONFIG[metric];
  const peers = data.stocks
    .filter((stockItem) => stockItem.ticker !== item.ticker && stockItem.industry === item.industry)
    .sort((a, b) => sizeWeight(b, "marketCapB") - sizeWeight(a, "marketCapB"))
    .slice(0, 6);
  const peerRows = peers.length ? peers : data.stocks
    .filter((stockItem) => stockItem.ticker !== item.ticker && stockItem.sector === item.sector)
    .sort((a, b) => sizeWeight(b, "marketCapB") - sizeWeight(a, "marketCapB"))
    .slice(0, 6);

  return `
    <div class="tooltip-head">
      <div>
        <strong>${escapeHtml(item.ticker)}</strong>
        <span>${escapeHtml(item.company)}</span>
      </div>
      <div class="tooltip-price">
        <b>$${Number(item.price).toFixed(2)}</b>
        <em class="${cls(item.changePct)}">${fmtPct(item.changePct)}</em>
      </div>
    </div>
    ${sparklineSvg(item.closeSeries, { width: 260, height: 76, color: item.changePct >= 0 ? "#22c55e" : "#ef4444" })}
    <div class="tooltip-facts">
      ${miniFact("Sector", item.sector)}
      ${miniFact("Industry", item.industry)}
      ${miniFact(metricCfg ? metricCfg.label : "Metric", fmtMetric(mapMetricValue(item, metric), metric))}
      ${miniFact("Volume", `${Number(item.volumeRatio).toFixed(1)}x`)}
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
      <span>$${Number(item.price).toFixed(2)}</span>
      <em class="${cls(item.changePct)}">${fmtPct(item.changePct)}</em>
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
  if (metric.includes("Score") || metric === "stochK" || metric === "rsi14") {
    return `${Math.round(Number(value) || 0)}`;
  }
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

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[char]);
}

function debounce(fn, delay) {
  let id;
  return (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...args), delay);
  };
}

function renderSelected(item) {
  byId("selectedStock").innerHTML = stockFacts(item, "선택 종목");
}

function stockFacts(item, title) {
  const isSearchPanel = title === "Search Ticker";
  return `
    <span class="muted">${title}</span>
    <h3 class="stock-facts-head">${watchStarButton(item.ticker)} ${item.ticker}</h3>
    <p class="muted">${item.company} · ${item.sector} · ${item.industry}</p>
    <div class="facts">
      ${fact("가격", `$${item.price.toFixed(2)}`)}
      ${fact("당일", `<span class="${cls(item.changePct)}">${fmtPct(item.changePct)}</span>`)}
      ${fact("1개월", `<span class="${cls(item.monthChangePct)}">${fmtPct(item.monthChangePct)}</span>`)}
      ${isSearchPanel ? scoreFact("RS", item.rsScore, "rs") : fact("RS", item.rsScore)}
      ${isSearchPanel ? scoreFact("EPS Rev", item.epsRevScore, "eps") : fact("EPS Rev", item.epsRevScore)}
      ${fact("거래량", `${item.volumeRatio.toFixed(1)}x`)}
      ${fact("StochK", item.stochK)}
      ${fact("신고가 거리", fmtPct(-item.newHighDistancePct))}
    </div>
  `;
}

function fact(label, value) {
  return `<div class="fact"><span>${label}</span><strong>${value}</strong></div>`;
}

function scoreFact(label, value, kind) {
  const active = scoreHelpOpen === kind;
  return `
    <div class="fact fact-score${active ? " is-active" : ""}">
      <span>${label}</span>
      <strong>${value ?? "-"}</strong>
      <button type="button" class="score-help-button" data-score-help="${kind}" aria-expanded="${active}" title="${label} 산정 기준">!</button>
      ${active ? scoreHelpHtml(kind) : ""}
    </div>
  `;
}

function scoreHelpHtml(kind) {
  const title = kind === "eps" ? "EPS 추정 점수" : "RS 점수";
  const body = kind === "eps"
    ? "EPS Next Y, EPS TTM, Forward PER 등 이익 전망과 밸류에이션 데이터를 우선 반영합니다. 재무 데이터가 부족한 소형주는 가격 모멘텀으로 일부 보완될 수 있어, 점수는 선별용 참고 지표로 봐야 합니다."
    : "3개월, 6개월, 1년 가격 모멘텀을 가중해 0~100점으로 환산한 상대강도 지표입니다. 높을수록 최근 중기 추세가 강하다는 뜻이며, 절대 수익률 보장은 아닙니다.";
  return `
    <div class="score-help-popover">
      <strong>${title}</strong>
      <p>${body}</p>
    </div>
  `;
}

function getSectorStocks(meta) {
  return data.stocks.filter((stock) => {
    if (!stock.sector) return false;
    const s = stock.sector.toUpperCase();
    const ind = (stock.industry || "").toLowerCase();
    
    if (meta.ticker === "XLK") return s === "TECHNOLOGY";
    if (meta.ticker === "SOXX") return ind.includes("semiconductor");
    if (meta.ticker === "XLF") return s === "FINANCIAL";
    if (meta.ticker === "XLE") return s === "ENERGY";
    if (meta.ticker === "XLV") return s === "HEALTHCARE";
    if (meta.ticker === "XLU") return s === "UTILITIES";
    if (meta.ticker === "XLI") return s === "INDUSTRIALS";
    if (meta.ticker === "XLY") return s === "CONSUMER CYCLICAL";
    if (meta.ticker === "XLP") return s === "CONSUMER DEFENSIVE";
    if (meta.ticker === "XLC") return s === "COMMUNICATION SERVICES";
    if (meta.ticker === "JETS") return ind.includes("airline") || AIRLINE_TICKERS.has(stock.ticker);
    if (meta.ticker === "XBI") return ind.includes("biotech") || ind.includes("biotechnology");
    if (meta.ticker === "KRE") return ind.includes("regional bank") || ind.includes("regional banks") || ind.includes("commercial bank") || ind.includes("commercial banks") || ind.includes("banks");
    if (meta.ticker === "IGV") return ind.includes("software");
    if (meta.ticker === "ITA") return ind.includes("aerospace") || ind.includes("defense");
    if (meta.ticker === "XOP") return s === "ENERGY" && (ind.includes("oil") || ind.includes("gas") || ind.includes("petroleum") || ind.includes("oilfield"));
    if (meta.ticker === "XME") return ind.includes("mining") || ind.includes("metal") || ind.includes("steel") || ind.includes("precious metals");
    if (meta.ticker === "XRT") return ind.includes("retail");
    if (meta.ticker === "DRIV") return ind.includes("auto") || ind.includes("motor vehicle");
    if (meta.ticker === "XLRE") return s === "REAL ESTATE";
    return false;
  });
}

function renderSectors() {
  const sortBy = byId("sectorSort")?.value || "avg";
  const groups = SECTOR_ETFS.map((meta) => {
    const rows = getSectorStocks(meta);
    const avg = rows.length ? rows.reduce((sum, item) => sum + item.changePct, 0) / rows.length : 0;
    const avg1w = rows.length ? rows.reduce((sum, item) => sum + (item.weekChangePct || 0), 0) / rows.length : 0;
    const avg1m = rows.length ? rows.reduce((sum, item) => sum + (item.monthChangePct || 0), 0) / rows.length : 0;
    const avg3m = rows.length ? rows.reduce((sum, item) => sum + (item.threeMonthChangePct || 0), 0) / rows.length : 0;
    const rs = rows.length ? rows.reduce((sum, item) => sum + item.rsScore, 0) / rows.length : 50;
    
    const upCount = rows.filter((item) => item.changePct > 0).length;
    const downCount = rows.filter((item) => item.changePct < 0).length;
    const upPct = rows.length ? (upCount / rows.length) * 100 : 0;
    
    // Top 3 sector leaders by RS Score
    const topLeaders = [...rows]
      .sort((a, b) => b.rsScore - a.rsScore)
      .slice(0, 3);
      
    return { ...meta, avg, avg1w, avg1m, avg3m, rs, upCount, downCount, upPct, count: rows.length, topLeaders };
  });

  // Sort groups
  groups.sort((a, b) => b[sortBy] - a[sortBy]);

  byId("sectorList").innerHTML = groups.map((item) => {
    const isActive = item.ticker === selectedSectorEtf;
    return `
      <article class="sector-card${isActive ? " is-active" : ""}" data-ticker="${item.ticker}">
        <div class="sector-card-header">
          <h3>${item.name} (${item.ticker})</h3>
          <span class="symbol-badge">${item.count} 종목</span>
        </div>
        
        <div class="sector-main-stats">
          <div class="stat-group">
            <span class="stat-label">당일 평균</span>
            <strong class="stat-value ${cls(item.avg)}">${fmtPct(item.avg)}</strong>
          </div>
          <div class="stat-group">
            <span class="stat-label">상승 / 하락</span>
            <span class="stat-value font-sm" style="color: ${item.upCount >= item.downCount ? 'var(--green)' : 'var(--red)'}; font-weight: 700;">
              ${item.upCount} ▲ / ${item.downCount} ▼
            </span>
          </div>
        </div>
        
        <!-- Breadth Progress Gauge -->
        <div class="breadth-gauge-bar" title="상승 ${item.upCount}개 / 하락 ${item.downCount}개">
          <div class="gauge-up" style="width: ${item.upPct}%"></div>
          <div class="gauge-down" style="width: ${100 - item.upPct}%"></div>
        </div>
        
        <!-- Timeframe Returns & RS -->
        <div class="timeframe-grid">
          <div class="tf-col">
            <span class="tf-lbl">1주</span>
            <span class="tf-val ${cls(item.avg1w)}">${fmtPct(item.avg1w)}</span>
          </div>
          <div class="tf-col">
            <span class="tf-lbl">1달</span>
            <span class="tf-val ${cls(item.avg1m)}">${fmtPct(item.avg1m)}</span>
          </div>
          <div class="tf-col">
            <span class="tf-lbl">3달</span>
            <span class="tf-val ${cls(item.avg3m)}">${fmtPct(item.avg3m)}</span>
          </div>
          <div class="tf-col">
            <span class="tf-lbl">평균 RS</span>
            <span class="tf-val rs-badge">${Math.round(item.rs)}</span>
          </div>
        </div>
        
        <!-- Sector Leaders list -->
        <div class="sector-leaders-section">
          <span class="lbl-sub">주도주 (RS 순)</span>
          <div class="leader-chips">
            ${item.topLeaders.map(stock => `
              <span class="leader-chip" data-ticker="${stock.ticker}">
                <strong class="ticker">${stock.ticker}</strong>
                <span class="change ${cls(stock.changePct)}">${fmtPct(stock.changePct)}</span>
              </span>
            `).join("")}
          </div>
        </div>
      </article>
    `;
  }).join("");

  // Setup click events
  byId("sectorList").querySelectorAll(".sector-card").forEach((card) => {
    card.addEventListener("click", () => {
      selectedSectorEtf = card.dataset.ticker;
      renderSectors(); // Redraw list to toggle is-active class
    });
  });

  byId("sectorList").querySelectorAll(".leader-chip").forEach((chip) => {
    chip.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent card select trigger
      selectTicker(chip.dataset.ticker, { openSearch: true });
    });
  });

  // Render detail on the right
  renderSectorDetail();
}

function renderSectorDetail() {
  const meta = SECTOR_ETFS.find((item) => item.ticker === selectedSectorEtf) || SECTOR_ETFS[0];
  const rows = getSectorStocks(meta);
  
  // Update detail texts
  byId("sectorDetailEtf").textContent = meta.ticker;
  byId("sectorDetailTitle").textContent = meta.name;
  byId("sectorDetailDesc").textContent = meta.desc;
  
  const avgRs = rows.length ? rows.reduce((sum, item) => sum + item.rsScore, 0) / rows.length : 50;
  const upCount = rows.filter((item) => item.changePct > 0).length;
  const upPct = rows.length ? (upCount / rows.length) * 100 : 0;
  
  byId("sectorDetailRs").textContent = Math.round(avgRs);
  byId("sectorDetailUpPct").textContent = `${Math.round(upPct)}%`;
  byId("sectorConstituentsCount").textContent = `${rows.length}개 종목`;
  
  // Render constituents table
  const sortedRows = [...rows].sort((a, b) => b.rsScore - a.rsScore);
  byId("sectorConstituentsBody").innerHTML = sortedRows.map((stock, index) => `
    <tr class="constituent-row" data-ticker="${stock.ticker}" style="cursor: pointer;">
      <td class="rank-cell">${index + 1}</td>
      <td><strong>${stock.ticker}</strong></td>
      <td>${stock.company}</td>
      <td>$${stock.price.toFixed(2)}</td>
      <td class="${cls(stock.changePct)}">${fmtPct(stock.changePct)}</td>
      <td class="${cls(stock.weekChangePct)}">${fmtPct(stock.weekChangePct)}</td>
      <td class="${cls(stock.monthChangePct)}">${fmtPct(stock.monthChangePct)}</td>
      <td><span class="rs-badge">${stock.rsScore}</span></td>
    </tr>
  `).join("");
  
  // Setup click events for table rows
  byId("sectorConstituentsBody").querySelectorAll(".constituent-row").forEach((row) => {
    row.addEventListener("click", () => {
      selectTicker(row.dataset.ticker, { openSearch: true });
    });
  });
  
  // Draw comparison chart
  drawSectorComparisonChart(selectedSectorEtf, selectedSectorRange, selectedSectorBenchmark);
}

function formatTimestamp(t, range) {
  const d = new Date(t * 1000);
  if (range === "1D") {
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  if (range === "1W") {
    return (d.getMonth() + 1) + "/" + d.getDate() + " " + d.toLocaleDateString('ko-KR', { weekday: 'short' });
  }
  return (d.getMonth() + 1) + "/" + d.getDate();
}

function buildSectorSeriesFromConstituents(sectorTicker, benchmarkSeries) {
  const meta = SECTOR_ETFS.find((m) => m.ticker === sectorTicker);
  if (!meta) return [];
  const seriesList = getSectorStocks(meta).map((stock) => {
    const detail = detailCache[safeTicker(stock.ticker)];
    const fromDetail = detail && Array.isArray(detail.chartSeries) && detail.chartSeries.length
      ? detail.chartSeries.map((r) => (Array.isArray(r) ? Number(r[3]) : Number(r.c)))
      : null;
    const closes = fromDetail || (Array.isArray(stock.closeSeries) ? stock.closeSeries.map(Number) : []);
    return closes.filter(Number.isFinite);
  }).filter((closes) => closes.length >= 2);
  if (!seriesList.length) return [];

  const n = benchmarkSeries.length;
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const frac = n === 1 ? 0 : i / (n - 1);
    let sum = 0;
    let count = 0;
    for (const closes of seriesList) {
      const base = closes[0];
      if (!base) continue;
      const idx = Math.round(frac * (closes.length - 1));
      sum += closes[idx] / base;
      count += 1;
    }
    if (!count) return [];
    out.push({ t: benchmarkSeries[i].t, c: sum / count });
  }
  return out;
}

function drawSectorComparisonChart(sectorTicker, timeframe, benchmarkTicker) {
  const svg = byId("sectorComparisonChart");
  const tooltip = byId("chartTooltip");

  // Update legend labels
  byId("legendSectorLabel").textContent = `${sectorTicker} (섹터)`;
  byId("legendBenchmarkLabel").textContent = `${benchmarkTicker} (벤치)`;
  
  let sectorSeries = data.sector_charts?.[sectorTicker]?.[timeframe] || [];
  const benchmarkSeries = data.sector_charts?.[benchmarkTicker]?.[timeframe] || [];

  // Sub-sectors added on the front-end may not have a precomputed ETF chart series yet.
  // Approximate one from the sector's constituents so the comparison still renders.
  let approximate = false;
  if (!sectorSeries.length && benchmarkSeries.length) {
    const built = buildSectorSeriesFromConstituents(sectorTicker, benchmarkSeries);
    if (built.length) {
      sectorSeries = built;
      approximate = true;
    }
  }
  byId("legendSectorLabel").textContent = `${sectorTicker} (섹터${approximate ? " · 근사" : ""})`;

  const mobile = window.matchMedia("(max-width: 768px)").matches;
  const width = mobile ? 480 : 860;
  const height = mobile ? 380 : 420;
  const padL = mobile ? 48 : 65;
  const padR = mobile ? 14 : 20;
  const padT = 24;
  const padB = 48;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  
  // Update SVG viewBox
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  
  if (!sectorSeries.length || !benchmarkSeries.length) {
    svg.innerHTML = `
      <rect x="0" y="0" width="${width}" height="${height}" fill="#101827" rx="10"></rect>
      <text x="${width / 2}" y="${height / 2 - 10}" font-size="15" fill="#64748b" text-anchor="middle" font-weight="700">차트 데이터 없음</text>
      <text x="${width / 2}" y="${height / 2 + 14}" font-size="12" fill="#475569" text-anchor="middle">이 섹터의 비교 차트는 다음 데이터 갱신에서 추가됩니다.</text>
    `;
    tooltip.style.display = "none";
    return;
  }
  
  // Normalize returns relative to initial close price (starting at 0%)
  const startSectorClose = sectorSeries[0].c;
  const startBenchmarkClose = benchmarkSeries[0].c;
  
  const normSector = sectorSeries.map((p) => ({
    t: p.t,
    r: ((p.c / startSectorClose) - 1) * 100,
    originalClose: p.c
  }));
  
  const normBenchmark = benchmarkSeries.map((p) => ({
    t: p.t,
    r: ((p.c / startBenchmarkClose) - 1) * 100,
    originalClose: p.c
  }));
  
  // Calculate ranges
  const allTimestamps = [...normSector.map((p) => p.t), ...normBenchmark.map((p) => p.t)];
  const minT = Math.min(...allTimestamps);
  const maxT = Math.max(...allTimestamps);
  const rangeT = maxT - minT || 1;
  
  const allReturns = [...normSector.map((p) => p.r), ...normBenchmark.map((p) => p.r)];
  let minR = Math.min(...allReturns, 0);
  let maxR = Math.max(...allReturns, 0);
  let rangeR = maxR - minR;
  if (rangeR < 0.5) rangeR = 0.5;
  
  // Add margin
  minR -= rangeR * 0.08;
  maxR += rangeR * 0.08;
  const finalRangeR = maxR - minR;
  
  const xFor = (t) => padL + ((t - minT) / rangeT) * plotW;
  const yFor = (r) => padT + ((maxR - r) / finalRangeR) * plotH;
  const yBase = yFor(0);
  
  // Compute nice grid lines (aim for 6 levels)
  function niceGridLevels(min, max, count) {
    const step = (max - min) / count;
    const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(step) || 1)));
    const nicedStep = Math.ceil(step / mag) * mag;
    const levels = [];
    const startVal = Math.ceil(min / nicedStep) * nicedStep;
    for (let v = startVal; v <= max + 0.001; v += nicedStep) {
      levels.push(parseFloat(v.toFixed(4)));
    }
    return levels;
  }
  const gridLevels = niceGridLevels(minR, maxR, 6);
  
  // X axis date format
  function xDateLabel(t, tf) {
    const d = new Date(t * 1000);
    if (tf === "1D") {
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      return `${h}:${m}`;
    }
    if (tf === "1W") {
      const days = ["일","월","화","수","목","금","토"];
      return `${d.getMonth()+1}/${d.getDate()} (${days[d.getDay()]})`;
    }
    return `${d.getMonth()+1}/${d.getDate()}`;
  }
  
  // Horizontal grid lines
  const gridLinesSvg = gridLevels.map((r) => {
    const y = yFor(r);
    if (y < padT - 1 || y > padT + plotH + 1) return "";
    const isZero = Math.abs(r) < 0.001;
    const color = isZero ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.07)";
    const w = isZero ? 1.5 : 1;
    const dash = isZero ? "" : `stroke-dasharray="4 4"`;
    const labelColor = isZero ? "#e2e8f0" : "#64748b";
    const labelWeight = isZero ? "800" : "600";
    return `
      <line x1="${padL}" y1="${y.toFixed(1)}" x2="${padL + plotW}" y2="${y.toFixed(1)}" stroke="${color}" stroke-width="${w}" ${dash}></line>
      <text x="${padL - 8}" y="${(y + 4).toFixed(1)}" font-size="10.5" fill="${labelColor}" text-anchor="end" font-weight="${labelWeight}">${r >= 0 ? "+" : ""}${r.toFixed(2)}%</text>
    `;
  }).join("");
  
  // X axis labels (pick 5 evenly spaced points)
  const xLabelCount = 5;
  const xLabelIndices = Array.from({length: xLabelCount}, (_, i) =>
    Math.round(i * (normSector.length - 1) / (xLabelCount - 1))
  ).filter(idx => idx >= 0 && idx < normSector.length);

  const xLabelsSvg = xLabelIndices.map((idx) => {
    const p = normSector[idx];
    const x = xFor(p.t);
    return `
      <line x1="${x.toFixed(1)}" y1="${(padT + plotH).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(padT + plotH + 6).toFixed(1)}" stroke="rgba(255,255,255,0.2)" stroke-width="1"></line>
      <text x="${x.toFixed(1)}" y="${(padT + plotH + 20).toFixed(1)}" font-size="10.5" fill="#94a3b8" text-anchor="middle">${xDateLabel(p.t, timeframe)}</text>
    `;
  }).join("");
  
  // SVG path generation
  const sectorPoints = normSector.map((p) => [xFor(p.t), yFor(p.r)]);
  const benchmarkPoints = normBenchmark.map((p) => [xFor(p.t), yFor(p.r)]);
  
  const pathFrom = (pts) => pts.map(([x, y], i) => `${i ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const sectorPath = pathFrom(sectorPoints);
  const benchmarkPath = pathFrom(benchmarkPoints);
  
  // Area fill under sector line
  const yClip = Math.min(yBase, padT + plotH);
  const sectorAreaPath = sectorPath + ` L ${sectorPoints[sectorPoints.length-1][0].toFixed(1)} ${yClip.toFixed(1)} L ${sectorPoints[0][0].toFixed(1)} ${yClip.toFixed(1)} Z`;
  
  svg.innerHTML = `
    <defs>
      <linearGradient id="sectorGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.02"/>
      </linearGradient>
      <clipPath id="chartClip">
        <rect x="${padL}" y="${padT}" width="${plotW}" height="${plotH}"/>
      </clipPath>
    </defs>
    <!-- Background -->
    <rect x="0" y="0" width="${width}" height="${height}" fill="#101827" rx="0"></rect>
    <!-- Chart area background -->
    <rect x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" fill="rgba(255,255,255,0.02)" rx="4"></rect>
    <!-- Grid lines (clipped) -->
    <g clip-path="url(#chartClip)">${gridLinesSvg}</g>
    <!-- X axis labels -->
    <g>${xLabelsSvg}</g>
    <!-- Sector fill area -->
    <path d="${sectorAreaPath}" fill="url(#sectorGrad)" clip-path="url(#chartClip)"></path>
    <!-- Benchmark line -->
    <path d="${benchmarkPath}" class="benchmark-line" fill="none" clip-path="url(#chartClip)"></path>
    <!-- Sector line -->
    <path d="${sectorPath}" class="sector-line" fill="none" clip-path="url(#chartClip)"></path>
    <!-- Y Axis border -->
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="rgba(255,255,255,0.15)" stroke-width="1"></line>
    <!-- X Axis border -->
    <line x1="${padL}" y1="${padT + plotH}" x2="${padL + plotW}" y2="${padT + plotH}" stroke="rgba(255,255,255,0.15)" stroke-width="1"></line>
    <!-- Hover Elements -->
    <line id="trackerLine" class="chart-tracker-line" x1="0" y1="${padT}" x2="0" y2="${padT + plotH}" style="display: none;"></line>
    <circle id="sectorTrackerDot" class="sector-dot" r="5" style="display: none;"></circle>
    <circle id="benchmarkTrackerDot" class="benchmark-dot" r="5" style="display: none;"></circle>
  `;
  
  const trackerLine = svg.querySelector("#trackerLine");
  const sectorDot = svg.querySelector("#sectorTrackerDot");
  const benchmarkDot = svg.querySelector("#benchmarkTrackerDot");
  
  // Event logic for hover tracking
  svg.addEventListener("mousemove", (event) => {
    const rect = svg.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    const clientX = (event.clientX - rect.left) * scaleX;
    
    if (clientX < padL || clientX > padL + plotW) {
      hideHover();
      return;
    }
    
    let closestPoint = null;
    let closestDist = Infinity;
    let closestIndex = -1;
    
    normSector.forEach((p, idx) => {
      const x = xFor(p.t);
      const dist = Math.abs(x - clientX);
      if (dist < closestDist) {
        closestDist = dist;
        closestPoint = p;
        closestIndex = idx;
      }
    });
    
    if (!closestPoint) return;
    
    const x = xFor(closestPoint.t);
    const sectorY = yFor(closestPoint.r);
    
    let benchmarkPoint = normBenchmark[closestIndex];
    if (!benchmarkPoint || Math.abs(benchmarkPoint.t - closestPoint.t) > 3600 * 24) {
      let bestB = null;
      let bestDist = Infinity;
      normBenchmark.forEach((p) => {
        const dist = Math.abs(p.t - closestPoint.t);
        if (dist < bestDist) {
          bestDist = dist;
          bestB = p;
        }
      });
      benchmarkPoint = bestB;
    }
    
    if (!benchmarkPoint) return;
    
    const benchmarkY = yFor(benchmarkPoint.r);
    
    trackerLine.setAttribute("x1", x);
    trackerLine.setAttribute("x2", x);
    trackerLine.style.display = "block";
    
    sectorDot.setAttribute("cx", x);
    sectorDot.setAttribute("cy", sectorY);
    sectorDot.style.display = "block";
    
    benchmarkDot.setAttribute("cx", x);
    benchmarkDot.setAttribute("cy", benchmarkY);
    benchmarkDot.style.display = "block";
    
    // HTML Tooltip positioning (ensure it doesn't go offscreen)
    const svgScreenW = rect.width;
    const tooltipPx = x / scaleX;
    const isRightHalf = tooltipPx > svgScreenW / 2;
    
    const formattedDate = new Date(closestPoint.t * 1000).toLocaleString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    
    const relDiff = closestPoint.r - benchmarkPoint.r;
    const diffText = `${relDiff >= 0 ? "+" : ""}${relDiff.toFixed(2)}%p`;
    const diffClass = relDiff >= 0 ? "pos" : "neg";
    
    tooltip.innerHTML = `
      <strong>${formattedDate}</strong>
      <div class="item"><span style="width:120px;display:inline-block">📈 ${sectorTicker}:</span><b>${closestPoint.r >= 0 ? "+" : ""}${closestPoint.r.toFixed(2)}%</b></div>
      <div class="item"><span style="width:120px;display:inline-block">📊 ${benchmarkTicker}:</span><b>${benchmarkPoint.r >= 0 ? "+" : ""}${benchmarkPoint.r.toFixed(2)}%</b></div>
      <div class="item" style="margin-top: 5px; border-top: 1px dashed rgba(255,255,255,0.2); padding-top: 4px;">
        <span>상대 수익률:</span><strong class="${diffClass}" style="margin-left:8px">${diffText}</strong>
      </div>
    `;
    
    const tipLeft = isRightHalf ? (tooltipPx - 175) : (tooltipPx + 16);
    const topY = Math.min(sectorY, benchmarkY) / scaleY;
    const tipTop = Math.max(8, topY - 10);
    tooltip.style.left = `${tipLeft}px`;
    tooltip.style.top = `${tipTop}px`;
    tooltip.style.display = "block";
    
    const summaryValueEl = byId("relativePerfValue");
    summaryValueEl.textContent = diffText;
    summaryValueEl.className = relDiff >= 0 ? "pos" : "neg";
  });
  
  svg.addEventListener("mouseleave", () => {
    hideHover();
  });
  
  function hideHover() {
    trackerLine.style.display = "none";
    sectorDot.style.display = "none";
    benchmarkDot.style.display = "none";
    tooltip.style.display = "none";
    
    const lastS = normSector[normSector.length - 1];
    const lastB = normBenchmark[normBenchmark.length - 1];
    if (lastS && lastB) {
      const relDiff = lastS.r - lastB.r;
      const summaryValueEl = byId("relativePerfValue");
      summaryValueEl.textContent = `${relDiff >= 0 ? "+" : ""}${relDiff.toFixed(2)}%p`;
      summaryValueEl.className = relDiff >= 0 ? "pos" : "neg";
    }
  }
  
  // Set initial performance summary values
  hideHover();
}

function renderTopStocks() {
  const metric = byId("topMetric").value;
  const bucket = byId("topBucket").value;
  const sector = byId("topSector").value;
  const recency = byId("topNewHighRecency").value;
  const newHigh = byId("topNewHigh").value;
  const minRs = numberInputValue("topMinRs", 0);
  const minEps = numberInputValue("topMinEps", 0);
  const minVolume = numberInputValue("topMinVolume", 0);
  const minMarketCap = numberInputValue("topMinMarketCap", 0);
  const limit = Math.max(1, numberInputValue("topLimit", 24));
  const preset = byId("topPreset")?.value || "custom";
  const rows = data.stocks
    .filter((item) => bucketMatches(item, item.groups || [item.bucket].filter(Boolean), bucket))
    .filter((item) => sector === "All" || item.sector === sector)
    .filter((item) => recency === "All" || String(item.newHighRecency4w) === recency)
    .filter((item) => newHighMatches(item, newHigh))
    .filter((item) => (Number(item.rsScore) || 0) >= minRs)
    .filter((item) => (Number(item.epsRevScore) || 0) >= minEps)
    .filter((item) => (Number(item.volumeRatio) || 0) >= minVolume)
    .filter((item) => (Number(item.marketCapB) || 0) >= minMarketCap)
    .filter((item) => topPresetMatches(item, preset))
    .map((item) => ({ item, value: metricValue(item, metric) }))
    .filter(({ value }) => Number.isFinite(value))
    .sort((a, b) => metricSortDirection(metric) * (b.value - a.value))
    .slice(0, limit);

  const filterText = [
    labelForSelect("topBucket"),
    sector,
    labelForSelect("topMetric"),
    preset !== "custom" ? labelForSelect("topPreset") : "",
    minRs ? `RS >= ${minRs}` : "",
    minEps ? `EPS >= ${minEps}` : "",
    minVolume ? `Vol >= ${minVolume}x` : "",
    minMarketCap ? `MktCap >= $${minMarketCap}B` : ""
  ].filter(Boolean).join(" · ");
  byId("topStocksMeta").textContent = `${filterText} · ${rows.length}개`;

  if (!rows.length) {
    byId("topStocks").innerHTML = `<article class="rank-card"><h3>조건에 맞는 종목이 없습니다.</h3><p class="muted">필터를 완화해보세요.</p></article>`;
    return;
  }

  byId("topStocks").innerHTML = rows.map(({ item, value }, index) => `
    <article class="stock-card top-stock-card" data-ticker="${item.ticker}">
      <div class="rank-line">
        <span>${index + 1}</span>
        <strong>${item.ticker}</strong>
        <em class="${metricClass(value, metric)}">${formatMetricValue(value, metric)}</em>
      </div>
      <p class="muted">${escapeHtml(item.company)}</p>
      <p>${escapeHtml(item.sector)} · ${escapeHtml(item.industry)}</p>
      <div class="mini-facts">
        ${miniMetric("가격", priceOrDash(item.price))}
        ${miniMetric("당일", `<span class="${cls(item.changePct)}">${fmtPct(item.changePct)}</span>`)}
        ${miniMetric("RS", item.rsScore)}
        ${miniMetric("EPS", item.epsRevScore)}
        ${miniMetric("거래량", `${Number(item.volumeRatio || 0).toFixed(1)}x`)}
        ${miniMetric("신고가", newHighLabel(item))}
      </div>
    </article>
  `).join("");

  byId("topStocks").querySelectorAll(".top-stock-card").forEach((card) => {
    card.addEventListener("click", () => selectTicker(card.dataset.ticker, { openSearch: true }));
  });
}

function numberInputValue(id, fallback = 0) {
  const value = Number(byId(id)?.value);
  return Number.isFinite(value) ? value : fallback;
}

function applyTopPreset() {
  const key = byId("topPreset")?.value || "custom";
  const preset = TOP_PRESETS[key];
  if (!preset) {
    renderTopStocks();
    return;
  }
  byId("topMetric").value = preset.metric;
  byId("topNewHigh").value = preset.newHigh;
  byId("topNewHighRecency").value = preset.recency;
  byId("topMinRs").value = preset.minRs || "";
  byId("topMinEps").value = preset.minEps || "";
  byId("topMinVolume").value = preset.minVolume || "";
  byId("topMinMarketCap").value = preset.minMarketCap || "";
  renderTopStocks();
}

function resetTopScreener() {
  byId("topPreset").value = "custom";
  byId("topMetric").value = "changePct";
  byId("topBucket").value = "idx_sp500";
  byId("topSector").value = "All";
  byId("topNewHighRecency").value = "All";
  byId("topNewHigh").value = "All";
  ["topMinRs", "topMinEps", "topMinVolume", "topMinMarketCap"].forEach((id) => { byId(id).value = ""; });
  byId("topLimit").value = "24";
  renderTopStocks();
}

function topPresetMatches(item, preset) {
  if (!preset || preset === "custom") return true;
  const distance = Number(item.newHighDistancePct);
  if (preset === "leaders") return item.rsScore >= 85 && item.monthChangePct > 0;
  if (preset === "breakout") return item.rsScore >= 75 && item.volumeRatio >= 1.5 && Number.isFinite(distance) && distance <= 5;
  if (preset === "pullback") return item.rsScore >= 80 && item.monthChangePct > 0 && item.changePct < 1 && Number.isFinite(distance) && distance >= 3;
  if (preset === "growth") return item.epsRevScore >= 80 && item.rsScore >= 65;
  if (preset === "value") {
    const pe = Number(item.fundamentals?.forwardPE ?? item.fundamentals?.pe);
    return item.marketCapB >= 10 && Number.isFinite(pe) && pe > 0 && pe <= 25;
  }
  if (preset === "lows") { const d = low52DistPct(item); return Number.isFinite(d) && d <= 15; }
  return true;
}

function metricValue(item, metric) {
  if (metric === "pe") return Number(item.fundamentals?.pe);
  if (metric === "forwardPE") return Number(item.fundamentals?.forwardPE);
  if (metric === "ps") return Number(item.fundamentals?.ps);
  if (metric === "pb") return Number(item.fundamentals?.pb);
  if (metric === "low52Dist") return low52DistPct(item);
  return Number(item[metric]);
}

function metricSortDirection(metric) {
  return ["pe", "forwardPE", "ps", "pb", "low52Dist"].includes(metric) ? -1 : 1;
}

function formatMetricValue(value, metric) {
  if (metric === "marketCapB") return fmtBillions(value);
  if (metric === "volumeRatio") return `${Number(value).toFixed(1)}x`;
  if (metric === "newHighDistancePct") return `${Number(value).toFixed(1)}%↓`;
  if (metric === "low52Dist") return `저가 +${Number(value).toFixed(1)}%`;
  if (["rsScore", "epsRevScore", "rsi14", "stochK"].includes(metric)) return `${Math.round(value)}`;
  if (["pe", "forwardPE", "ps", "pb"].includes(metric)) return fmtMultiple(value);
  return fmtPct(value);
}

function metricClass(value, metric) {
  if (["pe", "forwardPE", "ps", "pb", "marketCapB", "volumeRatio", "low52Dist"].includes(metric)) return "";
  if (metric === "newHighDistancePct") return "neg";
  return cls(value);
}

function newHighMatches(item, filter) {
  if (filter === "All") return true;
  const distance = Number(item.newHighDistancePct);
  if (!Number.isFinite(distance)) return filter === "NA";
  if (filter === "New_High") return distance <= 0.2;
  if (filter === "0-2%") return distance > 0.2 && distance <= 2;
  if (filter === "2-5%") return distance > 2 && distance <= 5;
  if (filter === "5-10%") return distance > 5 && distance <= 10;
  if (filter === "10-20%") return distance > 10 && distance <= 20;
  if (filter === "20+%") return distance > 20;
  return false;
}

function newHighLabel(item) {
  const distance = Number(item.newHighDistancePct);
  if (!Number.isFinite(distance)) return "NA";
  if (distance <= 0.2) return "New";
  return `${distance.toFixed(1)}%↓`;
}

function labelForSelect(id) {
  const select = byId(id);
  return select.options[select.selectedIndex]?.textContent || select.value;
}

function miniMetric(label, value) {
  return `<span><i>${escapeHtml(label)}</i><b>${value}</b></span>`;
}

function renderJump() {
  const category = byId("jumpCategory").value;
  const sort = byId("jumpSort").value;
  const rows = data.stocks.filter((item) => {
    if (category === "rsVolume") return item.rsScore >= 85 && item.volumeRatio >= 1.5;
    if (category === "volume") return item.volumeRatio >= 1.5;
    return item.changePct >= 2;
  }).sort((a, b) => b[sort] - a[sort]).slice(0, 12);

  byId("jumpGrid").innerHTML = rows.map((item) => `
    <article class="stock-card jump-stock-card" data-ticker="${item.ticker}" style="cursor: pointer;">
      <h3>${item.ticker}</h3>
      <p class="muted">${item.company}</p>
      <p><strong class="${cls(item.changePct)}">${fmtPct(item.changePct)}</strong> · Vol ${item.volumeRatio.toFixed(1)}x</p>
      <p>RS ${item.rsScore} · EPS ${item.epsRevScore}</p>
    </article>
  `).join("");

  byId("jumpGrid").querySelectorAll(".jump-stock-card").forEach((card) => {
    card.addEventListener("click", () => selectTicker(card.dataset.ticker, { openSearch: true }));
  });
}

function selectTicker(ticker, options = {}) {
  const resolved = resolveTickerQuery(ticker) || String(ticker || "").trim().toUpperCase();
  const found = data.stocks.find((item) => item.ticker.toUpperCase() === resolved.toUpperCase());
  if (!found) return;
  if (found.ticker !== selectedTicker) scoreHelpOpen = null;
  if (found.ticker !== selectedTicker) moveAnalysisState = null;
  selectedTicker = found.ticker;
  byId("tickerSearch").value = selectedTicker;
  renderTreemap();
  renderSearch();
  chatFocusTicker = found.ticker;
  if (options.openSearch !== false) {
    if (currentTab !== "search" || searchSubTab !== "analysis") {
      activateTab("search", { sub: "analysis", ticker: selectedTicker, push: true });
    } else {
      history.replaceState({ tab: "search", sub: "analysis", ticker: selectedTicker }, "");
    }
  }
}

function renderSearch() {
  const base = data.stocks.find((row) => row.ticker === selectedTicker) || data.stocks[0];
  const item = applyLive(withDetail(base));
  byId("chartTitle").textContent = `${item.ticker} · ${item.company}`;
  byId("searchFacts").innerHTML = stockFacts(item, "Search Ticker");
  drawChart(item);
  renderEarningsCalendar(item);
  renderCongressTradesForTicker(item);
  renderSmartMoney(item);
  renderMoveExplanation(item);
  renderInvestmentChecklist(item);
  render52wRange(item);
  renderStockEvents(item);
  renderEarningsReaction(item);
  renderDataQualityPanel(item);
  renderFundamentals(item);
  renderNews(item);
  fetchCommunityPosts({ silent: true });
  maybeFetchLiveData(base);
  loadStockDetail(item.ticker).then((detail) => {
    if (!detail || selectedTicker !== item.ticker) return;
    const refreshed = applyLive(withDetail(base));
    byId("chartTitle").textContent = `${refreshed.ticker} · ${refreshed.company}`;
    byId("searchFacts").innerHTML = stockFacts(refreshed, "Search Ticker");
    drawChart(refreshed);
    renderEarningsCalendar(refreshed);
    renderCongressTradesForTicker(refreshed);
    renderSmartMoney(refreshed);
    renderMoveExplanation(refreshed);
    renderInvestmentChecklist(refreshed);
    render52wRange(refreshed);
    renderStockEvents(refreshed);
    renderEarningsReaction(refreshed);
    renderDataQualityPanel(refreshed);
    renderFundamentals(refreshed);
    renderNews(refreshed);
  });
}

function moveEvidenceRow(kind, title, detail, options = {}) {
  const body = `<span class="move-evidence-icon" aria-hidden="true">${options.icon || "•"}</span><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail || "")}</small></span>`;
  return options.href
    ? `<a class="move-evidence-row" href="${escapeHtml(options.href)}" target="_blank" rel="noopener">${body}<em>원문</em></a>`
    : `<div class="move-evidence-row">${body}<em class="${options.tone || "info"}">${escapeHtml(kind)}</em></div>`;
}

function renderMoveExplanation(item) {
  const box = byId("moveExplanation");
  if (!box || !item) return;
  const change = Number(item.changePct || 0);
  const direction = change > 0 ? "상승" : change < 0 ? "하락" : "보합";
  const peers = (data.stocks || []).filter((row) => row.sector === item.sector && row.ticker !== item.ticker && Number.isFinite(Number(row.changePct)));
  const sectorAvg = peers.length ? peers.reduce((sum, row) => sum + Number(row.changePct), 0) / peers.length : 0;
  const relative = change - sectorAvg;
  const evidence = [];
  evidence.push(moveEvidenceRow("시장", `${item.sector} 대비 ${relative >= 0 ? "강함" : "약함"}`, `종목 ${fmtPct(change)} · 섹터 평균 ${fmtPct(sectorAvg)} · 차이 ${relative >= 0 ? "+" : ""}${relative.toFixed(1)}%p`, { icon: "M", tone: relative >= 0 ? "pos" : "neg" }));

  const volume = Number(item.volumeRatio || 0);
  if (volume > 0) {
    const volumeLabel = volume >= 2 ? "평균보다 크게 증가" : volume >= 1.2 ? "평균보다 증가" : "평균 수준 이하";
    evidence.push(moveEvidenceRow("수급", `거래량 ${volume.toFixed(1)}배`, volumeLabel, { icon: "V", tone: volume >= 2 ? "warn" : "info" }));
  }

  const technical = [];
  if (Number(item.rsScore) >= 80) technical.push(`RS ${item.rsScore}`);
  if (Number(item.newHighDistancePct) <= 3) technical.push(`52주 고점 ${Number(item.newHighDistancePct).toFixed(1)}% 이내`);
  if (Number(item.rsi14) >= 70) technical.push(`RSI ${Math.round(item.rsi14)} 과열권`);
  else if (Number(item.rsi14) <= 30) technical.push(`RSI ${Math.round(item.rsi14)} 침체권`);
  if (technical.length) evidence.push(moveEvidenceRow("기술", "가격·모멘텀 신호", technical.join(" · "), { icon: "T", tone: "info" }));

  const filing = ((window.MATERIAL_EVENTS || {}).events || []).find((event) => String(event.ticker || "").toUpperCase() === item.ticker);
  if (filing) {
    const labels = (filing.items || []).map((row) => row.label).filter(Boolean).slice(0, 3).join(" · ") || "8-K 공시";
    evidence.push(moveEvidenceRow("공시", `SEC 8-K · ${filing.fileDate || "최근"}`, labels, { icon: "F", tone: filing.hot ? "warn" : "info", href: filing.link }));
  }

  const news = Array.isArray(item.news) ? item.news[0] : null;
  if (news) {
    const newsTitle = news.title || news.headline || "최근 관련 뉴스";
    const source = news.publisher || news.source || "뉴스";
    evidence.push(moveEvidenceRow("뉴스", newsTitle, `${source} · 가격 변동과의 인과관계는 원문 확인 필요`, { icon: "N", href: news.link || news.url }));
  }

  const insiderRows = ((window.INSIDER_TRADES || {}).trades || []).filter((row) => row.ticker === item.ticker);
  if (insiderRows.length) {
    const buys = insiderRows.filter((row) => row.kind === "buy").length;
    const sells = insiderRows.filter((row) => row.kind === "sell").length;
    evidence.push(moveEvidenceRow("공시", "내부자 거래", `공개시장 매수 ${buys}건 · 매도 ${sells}건`, { icon: "I", tone: buys > sells ? "pos" : sells > buys ? "neg" : "info" }));
  }

  const magnitude = Math.abs(change) >= 5 ? "큰 폭" : Math.abs(change) >= 2 ? "뚜렷한" : "제한적인";
  box.innerHTML = `
    <div class="move-explanation-head">
      <div><span>WHY IT MOVED</span><h3>왜 ${direction}했나?</h3></div>
      <strong class="${cls(change)}">${fmtPct(change)}</strong>
    </div>
    <p class="move-explanation-summary">${escapeHtml(item.ticker)}는 오늘 ${magnitude} ${direction}을 보였습니다. 아래는 확인 가능한 데이터 근거이며 원인을 확정하는 설명은 아닙니다.</p>
    <div class="move-evidence-list">${evidence.join("") || `<p class="muted">연결할 수 있는 근거 데이터가 아직 없습니다.</p>`}</div>
    <p class="move-explanation-note">스냅샷·뉴스·공시의 기준 시각이 다를 수 있습니다. 투자 판단 전 원문과 최신 시세를 확인하세요.</p>`;
}

function checklistRow(label, result) {
  const icon = result.status === "pass" ? "✓" : result.status === "warn" ? "!" : "?";
  const state = result.status === "pass" ? "통과" : result.status === "warn" ? "주의" : "확인 필요";
  return `
    <div class="investment-check-row checklist-${result.status}">
      <span class="investment-check-icon" aria-hidden="true">${icon}</span>
      <span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(result.detail)}</small></span>
      <em>${state}</em>
    </div>`;
}

function sectorForwardPeMedian(item) {
  const values = (data.stocks || []).filter((row) => row.sector === item.sector).map((row) => {
    const f = row.fundamentals || (window.MAP_FUNDAMENTALS || {})[row.ticker] || {};
    return Number(f.forwardPE);
  }).filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (!values.length) return null;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

function investmentChecklistResults(item) {
  const f = item.fundamentals || (window.MAP_FUNDAMENTALS || {})[item.ticker] || {};
  const rows = getChartRows(item);
  const closes = rows.map((row) => Number(row.c)).filter(Number.isFinite);
  const last = closes[closes.length - 1] || Number(item.price || 0);
  const sma20 = closes.length >= 20 ? closes.slice(-20).reduce((sum, value) => sum + value, 0) / 20 : null;
  const trendPass = Number(item.monthChangePct) > 0 && Number(item.rsScore) >= 70 && (sma20 == null || last >= sma20);
  const trendWarn = Number(item.monthChangePct) < 0 || (sma20 != null && last < sma20);

  const epsScore = Number(item.epsRevScore || 0);
  const earningsKnown = epsScore > 0 || f.epsNextY != null || f.epsTtm != null;
  const earningsPass = epsScore >= 70 || (Number(f.epsNextY) > Number(f.epsTtm) && Number.isFinite(Number(f.epsTtm)));

  const forwardPe = Number(f.forwardPE);
  const sectorMedian = sectorForwardPeMedian(item);
  const valuationKnown = Number.isFinite(forwardPe) && forwardPe > 0;
  const valuationPass = valuationKnown && sectorMedian != null && forwardPe <= sectorMedian;
  const valuationWarn = valuationKnown && sectorMedian != null && forwardPe > sectorMedian * 1.35;

  const volume = Number(item.volumeRatio || 0);
  const insider = ((window.INSIDER_TRADES || {}).trades || []).filter((row) => row.ticker === item.ticker);
  const buys = insider.filter((row) => row.kind === "buy").length;
  const sells = insider.filter((row) => row.kind === "sell").length;
  const flowPass = volume >= 1.2 || buys > sells;
  const flowWarn = volume < 0.7 || sells > buys + 2;

  const rsi = Number(item.rsi14);
  const debtEq = Number(f.debtEq);
  const highDistance = Number(item.newHighDistancePct);
  const riskFlags = [];
  if (Number.isFinite(rsi) && rsi >= 75) riskFlags.push(`RSI ${Math.round(rsi)} 과열`);
  if (Number.isFinite(debtEq) && debtEq > 2) riskFlags.push(`부채비율 ${debtEq.toFixed(1)}배`);
  if (Number.isFinite(highDistance) && highDistance > 30) riskFlags.push(`52주 고점 대비 ${highDistance.toFixed(0)}% 하락`);

  return [
    { label: "추세", status: trendPass ? "pass" : trendWarn ? "warn" : "check", detail: `1개월 ${fmtPct(item.monthChangePct)} · RS ${item.rsScore}${sma20 != null ? ` · SMA20 ${last >= sma20 ? "위" : "아래"}` : ""}` },
    { label: "실적·추정", status: !earningsKnown ? "check" : earningsPass ? "pass" : epsScore < 45 ? "warn" : "check", detail: earningsKnown ? `EPS 추정 점수 ${Math.round(epsScore)}${f.epsNextY != null ? ` · EPS Next Y ${moneyOrDash(f.epsNextY)}` : ""}` : "EPS 추정 데이터가 부족합니다." },
    { label: "밸류에이션", status: !valuationKnown || sectorMedian == null ? "check" : valuationPass ? "pass" : valuationWarn ? "warn" : "check", detail: valuationKnown ? `Forward P/E ${forwardPe.toFixed(1)}${sectorMedian != null ? ` · 섹터 중앙값 ${sectorMedian.toFixed(1)}` : " · 섹터 비교값 없음"}` : "Forward P/E 데이터가 없습니다." },
    { label: "수급", status: flowPass ? "pass" : flowWarn ? "warn" : "check", detail: `거래량 ${volume.toFixed(1)}배 · 내부자 매수 ${buys} / 매도 ${sells}` },
    { label: "리스크", status: riskFlags.length ? "warn" : "pass", detail: riskFlags.length ? riskFlags.join(" · ") : "현재 규칙에서 과열·부채·낙폭 경고가 없습니다." }
  ];
}

function renderInvestmentChecklist(item) {
  const box = byId("investmentChecklist");
  if (!box || !item) return;
  const results = investmentChecklistResults(item);
  const passed = results.filter((row) => row.status === "pass").length;
  const warned = results.filter((row) => row.status === "warn").length;
  box.innerHTML = `
    <div class="investment-check-head">
      <div><span>DECISION CHECK</span><h3>투자 체크리스트</h3></div>
      <strong>${passed}/${results.length} 통과</strong>
    </div>
    <div class="investment-check-progress"><i style="width:${(passed / results.length) * 100}%"></i></div>
    <div class="investment-check-list">${results.map((row) => checklistRow(row.label, row)).join("")}</div>
    <p class="investment-check-note">${warned ? `주의 항목 ${warned}개를 원문 데이터와 함께 확인하세요.` : "규칙 기반 요약이며 매수·매도 추천이 아닙니다."}</p>`;
}

// ===== #2 스마트머니 통합 뷰 (내부자 + 의회 + 13F + 13D/G) =====
let _inst13fIndex = null;
function inst13fIndex() {
  if (_inst13fIndex) return _inst13fIndex;
  const idx = {};
  const insts = (window.INSTITUTIONAL_13F || {}).institutions || [];
  for (const inst of insts) {
    for (const h of (inst.holdings || [])) {
      const t = h.ticker;
      if (!t) continue;
      const g = idx[t] || (idx[t] = { holders: 0, valueM: 0 });
      g.holders += 1;
      g.valueM += Number(h.valueM) || 0;
    }
  }
  _inst13fIndex = idx;
  return idx;
}

function renderSmartMoney(item) {
  const el = byId("stockSmartMoney");
  if (!el || !item) return;
  const t = item.ticker;
  const ins = ((window.INSIDER_TRADES || {}).trades || []).filter((r) => r.ticker === t);
  const insBuy = ins.filter((r) => r.kind === "buy").length;
  const insSell = ins.filter((r) => r.kind === "sell").length;
  const cg = ((window.CONGRESS_TRADES || {}).byTicker || {})[t];
  const f = inst13fIndex()[t];
  const act = ((window.ACTIVIST_STAKES || {}).filings || []).filter((r) => r.ticker === t);

  if (!(ins.length || cg || f || act.length)) {
    el.innerHTML = `<h3>🐳 스마트머니 종합</h3><p class="muted">이 종목에 대한 내부자·의회·기관·대량보유 신호가 없습니다.</p>`;
    return;
  }
  const row = (label, val, tone) => `<div class="sm-row"><span>${label}</span><strong${tone ? ` class="${tone}"` : ""}>${val}</strong></div>`;
  const insTone = insBuy > insSell ? "ins-buy" : insSell > insBuy ? "ins-sell" : "";
  el.innerHTML = `
    <h3>🐳 스마트머니 종합 · ${escapeHtml(t)}</h3>
    ${row("내부자 (Form 4)", ins.length ? `매수 ${insBuy} · 매도 ${insSell}` : "—", insTone)}
    ${row("의회 매매", cg ? `매수 ${cg.netBuys} · 매도 ${cg.netSells} · ${cg.politicianCount}명` : "—")}
    ${row("기관 13F 보유", f ? `${f.holders}곳 · $${(f.valueM / 1000).toFixed(1)}B` : "—")}
    ${row("대량보유 13D/G", act.length ? `${act.length}건 (액티비스트 ${act.filter((a) => a.kind === "activist").length})` : "—")}
    <p class="sm-note">내부자·의회·기관·대량보유 공시 종합 — 상세는 ‘거장 포트폴리오’ 탭 참조</p>`;
}

// Merge any live (proxy-fetched) chart/news over the snapshot+detail data.
function applyLive(item) {
  if (!item) return item;
  const chart = liveChartCache[item.ticker];
  const news = liveNewsCache[item.ticker];
  const earnings = liveEarningsCache[item.ticker];
  if (!chart && !news && !earnings) return item;
  const out = { ...item };
  if (Array.isArray(chart) && chart.length) {
    out.chartSeries = chart;
    out.historySource = "yahoo";
  }
  if (Array.isArray(news) && news.length) out.news = news;
  if (earnings) out.liveEarnings = earnings;
  const summary = liveSummaryCache[item.ticker];
  if (typeof summary === "string" && summary.trim()) out.newsSummary = summary.trim();
  return out;
}

// On opening an analysis page, fetch live news + real chart from the proxy (if set).
function maybeFetchLiveData(base) {
  if (!LIVE_DATA_PROXY || !base) return;
  const ticker = base.ticker;
  if (liveFetched[ticker]) return;
  liveFetched[ticker] = true;
  setNewsLoading();
  const endpoint = `${LIVE_DATA_PROXY.replace(/\/$/, "")}/?ticker=${encodeURIComponent(ticker)}`;
  fetch(endpoint, { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .then((payload) => {
      if (!payload) return;
      if (Array.isArray(payload.news)) liveNewsCache[ticker] = payload.news;
      if (Array.isArray(payload.chart)) liveChartCache[ticker] = payload.chart;
      if (payload.earnings) liveEarningsCache[ticker] = payload.earnings;
      if (typeof payload.summary === "string") liveSummaryCache[ticker] = payload.summary;
      liveDone[ticker] = true;
      if (selectedTicker !== ticker) return;
      const refreshedBase = data.stocks.find((row) => row.ticker === ticker) || base;
      const merged = applyLive(withDetail(refreshedBase));
      drawChart(merged);
      renderEarningsCalendar(merged);
      renderStockEvents(merged);
      renderEarningsReaction(merged);
      renderDataQualityPanel(merged);
      renderFundamentals(merged);
      renderNews(merged);
      renderMoveExplanation(merged);
      renderInvestmentChecklist(merged);
    })
    .catch(() => {
      liveDone[ticker] = true;
      if (selectedTicker === ticker) {
        const merged = applyLive(withDetail(base));
        renderNews(merged);
        renderMoveExplanation(merged);
        renderInvestmentChecklist(merged);
      }
    });
}

function setNewsLoading() {
  const box = byId("searchNews");
  if (!box) return;
  box.innerHTML = `
    <span class="muted">주요 뉴스</span>
    <p class="news-empty">실시간 뉴스를 불러오는 중…</p>
  `;
}

function isSyntheticChart(item) {
  // Real history comes from Yahoo (chartSeries in the detail file).
  // Snapshot/synthetic tickers only carry a generated mini closeSeries.
  if (Array.isArray(item.chartSeries) && item.chartSeries.length) return false;
  return item.historySource !== "yahoo";
}

function renderNews(item) {
  const box = byId("searchNews");
  if (!box) return;
  const news = Array.isArray(item.news) ? item.news : [];
  const estimate = isSyntheticChart(item)
    ? `<p class="news-note">⚠ 실시간 야후 가격 이력이 없어 차트는 <strong>추정(합성) 차트</strong>입니다. 데이터 갱신 시 실제 차트로 채워집니다.</p>`
    : "";

  if (!news.length) {
    box.innerHTML = `
      <span class="muted">주요 뉴스</span>
      ${estimate}
      <p class="news-empty">이 종목의 뉴스가 아직 수집되지 않았습니다. 데이터 갱신 스크립트 실행 시 자동으로 채워집니다.</p>
    `;
    return;
  }

  const summaryHtml = newsSummaryHtml(item);
  box.innerHTML = `
    <span class="muted">주요 뉴스</span>
    ${estimate}
    ${summaryHtml}
    <div class="news-list-head">최신 헤드라인 <span class="muted">(스크롤)</span></div>
    <ul class="news-list">
      ${news.slice(0, 12).map((n) => `
        <li class="news-item">
          <a href="${escapeHtml(n.link || "#")}" target="_blank" rel="noopener noreferrer">${escapeHtml(n.title || "")}</a>
          <span class="news-meta">${escapeHtml(n.publisher || "")}${n.publishedAt ? ` · ${escapeHtml(n.publishedAt)}` : ""}</span>
        </li>
      `).join("")}
    </ul>
  `;
}

function newsSummaryHtml(item) {
  if (typeof item.newsSummary === "string" && item.newsSummary.trim()) {
    const paras = item.newsSummary.trim().split(/\n+/).map((line) => line.trim()).filter(Boolean);
    return `
      <div class="news-summary">
        <div class="news-summary-head">🧠 한국어 요약</div>
        ${paras.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
      </div>
    `;
  }
  // Show "generating" only while the live fetch is still in flight.
  if (LIVE_DATA_PROXY && !liveDone[item.ticker]) {
    return `
      <div class="news-summary is-pending">
        <div class="news-summary-head">🧠 한국어 요약</div>
        <p class="muted">요약을 생성하는 중…</p>
      </div>
    `;
  }
  return "";
}

function withDetail(item) {
  if (!item) return item;
  const key = safeTicker(item.ticker);
  const detail = detailCache[key] || detailCache[item.ticker];
  return detail ? { ...item, ...detail } : item;
}

function safeTicker(ticker) {
  const safe = String(ticker || "").toUpperCase().replace(/[^A-Z0-9._-]/g, "_");
  const root = safe.split(".")[0];
  const reserved = new Set(["CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"]);
  return reserved.has(root) ? `_${safe}` : safe;
}

function loadStockDetail(ticker) {
  const key = safeTicker(ticker);
  if (!key) return Promise.resolve(null);
  if (detailCache[key]) return Promise.resolve(detailCache[key]);
  if (detailPromises[key]) return detailPromises[key];
  detailPromises[key] = fetch(`data/details/${encodeURIComponent(key)}.json`, { cache: "no-store" })
    .then((response) => response.ok ? response.json() : null)
    .then((detail) => {
      if (detail) {
        detailCache[key] = detail;
        if (ticker && ticker !== key) detailCache[ticker] = detail;
      }
      return detail;
    })
    .catch(() => null);
  return detailPromises[key];
}

// ===== 차트 드로잉(추세선·피보나치 되돌림) =====
let lastChartGeom = null;
const chartDrawings = {};          // ticker -> [{type, x1,p1,x2,p2}]  (x: 플롯 가로비율 0~1, p: 가격)
let drawTool = null;               // null | "trend" | "fib"
let drawStart = null;
let drawPreview = null;
const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

function renderChartDrawings() {
  const g = lastChartGeom;
  if (!g) return "";
  const items = (chartDrawings[g.ticker] || []).slice();
  if (drawPreview) items.push(drawPreview);
  if (!items.length) return "";
  const pxX = (xn) => g.padL + xn * g.plotW;
  const pxY = (price) => g.padT + ((g.max - price) / g.range) * g.plotH;
  let out = "";
  for (const d of items) {
    if (d.type === "trend") {
      out += `<line x1="${pxX(d.x1).toFixed(1)}" y1="${pxY(d.p1).toFixed(1)}" x2="${pxX(d.x2).toFixed(1)}" y2="${pxY(d.p2).toFixed(1)}" class="draw-line"></line>`;
    } else if (d.type === "fib") {
      const hi = Math.max(d.p1, d.p2), lo = Math.min(d.p1, d.p2), span = hi - lo || 1;
      const xa = pxX(Math.min(d.x1, d.x2)), xb = pxX(Math.max(d.x1, d.x2));
      out += FIB_LEVELS.map((lv) => {
        const price = hi - span * lv;
        const y = pxY(price);
        return `<line x1="${xa.toFixed(1)}" y1="${y.toFixed(1)}" x2="${xb.toFixed(1)}" y2="${y.toFixed(1)}" class="draw-fib"></line>`
          + `<text x="${(xb + 4).toFixed(1)}" y="${(y + 3).toFixed(1)}" class="draw-fib-label">${(lv * 100).toFixed(1)}% · $${price.toFixed(2)}</text>`;
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
  const price = g.max - ((py - g.padT) / g.plotH) * g.range;
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
  if (svg) svg.classList.toggle("is-drawing", Boolean(drawTool));
}

function setupChartDrawing() {
  // 차트 유형(캔들/라인) 토글
  const typeCtl = byId("chartTypeControls");
  if (typeCtl && !typeCtl.dataset.bound) {
    typeCtl.dataset.bound = "1";
    typeCtl.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      chartState.chartType = b.dataset.ctype || "candle";
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
      if (lastChartGeom) chartDrawings[lastChartGeom.ticker] = [];
      drawPreview = null; updateDrawLayer();
    });
  }
  // 차트 위 드래그
  const svg = byId("priceChart");
  if (svg && !svg.dataset.drawBound) {
    svg.dataset.drawBound = "1";
    svg.addEventListener("mousedown", (e) => {
      if (!drawTool) return;
      e.preventDefault();
      drawStart = chartPointToData(e);
    });
    svg.addEventListener("mousemove", (e) => {
      if (!drawTool || !drawStart) return;
      const p = chartPointToData(e);
      if (!p) return;
      drawPreview = { type: drawTool, x1: drawStart.xn, p1: drawStart.price, x2: p.xn, p2: p.price };
      updateDrawLayer();
    });
    window.addEventListener("mouseup", (e) => {
      if (!drawTool || !drawStart) return;
      const p = chartPointToData(e);
      const t = lastChartGeom && lastChartGeom.ticker;
      if (p && t && (Math.abs(p.xn - drawStart.xn) > 0.005 || Math.abs(p.price - drawStart.price) > 1e-9)) {
        (chartDrawings[t] = chartDrawings[t] || []).push({ type: drawTool, x1: drawStart.xn, p1: drawStart.price, x2: p.xn, p2: p.price });
      }
      drawStart = null; drawPreview = null; updateDrawLayer();
    });
  }
}

function drawChart(item) {
  setupChartDrawing();
  const svg = byId("priceChart");
  const allRows = resampleBars(getChartRows(item), chartState.barTf);
  const rows = visibleChartRows(allRows);
  const geom = priceChartGeom();
  const width = geom.width;
  const padL = geom.padL;
  const padR = geom.padR;
  const padT = 28;
  const plotW = width - padL - padR;
  const plotH = 300;

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
  if (hasRelativePanel(item)) panels.push({ t: "relative", h: 70 });
  if (compareTickers.length) panels.push({ t: "compare", h: 72 });
  const panelsH = panels.reduce((sum, p) => sum + p.h + gap, 0);
  const axisH = 26;
  const height = padT + plotH + panelsH + axisH;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const closes = rows.map((row) => row.c);
  const lows = rows.map((row) => row.l);
  const highs = rows.map((row) => row.h);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const range = max - min || 1;
  const xFor = (index) => padL + (index / Math.max(1, rows.length - 1)) * plotW;
  const yFor = (value) => padT + ((max - value) / range) * plotH;
  const candleW = Math.max(2, Math.min(11, (plotW / rows.length) * 0.62));

  const linePath = closes.map((value, index) => `${index ? "L" : "M"} ${xFor(index).toFixed(1)} ${yFor(value).toFixed(1)}`).join(" ");
  const area = `${linePath} L ${(padL + plotW).toFixed(1)} ${(padT + plotH).toFixed(1)} L ${padL} ${(padT + plotH).toFixed(1)} Z`;
  const grid = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = padT + plotH * ratio;
    const value = max - range * ratio;
    return `<line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" class="chart-grid"></line><text x="${width - 8}" y="${y + 4}" class="chart-axis" text-anchor="end">$${value.toFixed(2)}</text>`;
  }).join("");
  const overlayYFor = (value) => yFor(Math.max(min, Math.min(max, value)));


  // Bollinger Bands (20, 2σ) overlay.
  let bollSvg = "";
  if (chartState.showBoll) {
    const bb = bollinger(closes, 20, 2);
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

  const candles = rows.map((row, index) => {
    const x = xFor(index);
    const up = row.c >= row.o;
    const yOpen = yFor(row.o);
    const yClose = yFor(row.c);
    const bodyY = Math.min(yOpen, yClose);
    const bodyH = Math.max(1.2, Math.abs(yClose - yOpen));
    return `<g class="${up ? "candle-up" : "candle-down"}"><line x1="${x.toFixed(1)}" y1="${yFor(row.h).toFixed(1)}" x2="${x.toFixed(1)}" y2="${yFor(row.l).toFixed(1)}"></line><rect x="${(x - candleW / 2).toFixed(1)}" y="${bodyY.toFixed(1)}" width="${candleW.toFixed(1)}" height="${bodyH.toFixed(1)}"></rect></g>`;
  }).join("");

  const keltner = chartState.showKeltner ? keltnerChannels(rows, 20, 2) : null;
  const donchian = chartState.showDonchian ? donchianChannels(rows, 20) : null;
  const ichimoku = chartState.showIchimoku ? ichimokuArrays(rows) : null;
  const supertrend = chartState.showSupertrend ? supertrendArray(rows, 10, 3) : null;

  const overlays = [
    chartState.showSma5 ? averagePath(closes, 5, xFor, yFor, "#60a5fa") : "",
    chartState.showSma10 ? averagePath(closes, 10, xFor, yFor, "#34d399") : "",
    chartState.showSma20 ? averagePath(closes, 20, xFor, yFor, "#a855f7") : "",
    chartState.showSma60 ? averagePath(closes, 60, xFor, yFor, "#d98a2b") : "",
    chartState.showSma120 ? averagePath(closes, 120, xFor, yFor, "#facc15") : "",
    chartState.showEma20 ? pathFromSeries(emaArray(closes, 20), xFor, yFor, "#f472b6", 1.6, "") : "",
    chartState.showEma60 ? pathFromSeries(emaArray(closes, 60), xFor, yFor, "#38bdf8", 1.6, "") : "",
    chartState.showVwap ? pathFromSeries(vwapArray(rows), xFor, overlayYFor, "#f97316", 1.7, "") : "",
    supertrend ? pathFromSeries(supertrend, xFor, overlayYFor, "#22c55e", 1.6, "5 3") : "",
    ichimoku ? renderIchimokuOverlay(ichimoku, xFor, overlayYFor) : "",
    keltner ? renderChannelOverlay(keltner.upper, keltner.lower, keltner.mid, xFor, overlayYFor, "#fb7185") : "",
    donchian ? renderChannelOverlay(donchian.upper, donchian.lower, donchian.mid, xFor, overlayYFor, "#818cf8") : ""
  ].join("");

  // Stacked indicator panels.
  let cursorY = padT + plotH + gap;
  let panelsSvg = "";
  for (const p of panels) {
    if (p.t === "volume") panelsSvg += renderVolumePanel(rows, xFor, padL, padL + plotW, cursorY, p.h, candleW);
    else if (p.t === "obv") panelsSvg += renderObvPanel(rows, xFor, padL, padL + plotW, cursorY, p.h);
    else if (p.t === "ad") panelsSvg += renderAdPanel(rows, xFor, padL, padL + plotW, cursorY, p.h);
    else if (p.t === "rsi") panelsSvg += renderRsiPanel(closes, xFor, padL, padL + plotW, cursorY, p.h);
    else if (p.t === "macd") panelsSvg += renderMacdPanel(closes, xFor, padL, padL + plotW, cursorY, p.h, candleW);
    else if (p.t === "stoch") panelsSvg += renderStochPanel(rows, xFor, padL, padL + plotW, cursorY, p.h);
    else if (p.t === "roc") panelsSvg += renderRocPanel(closes, xFor, padL, padL + plotW, cursorY, p.h);
    else if (p.t === "momentum") panelsSvg += renderMomentumPanel(closes, xFor, padL, padL + plotW, cursorY, p.h);
    else if (p.t === "williams") panelsSvg += renderWilliamsPanel(rows, xFor, padL, padL + plotW, cursorY, p.h);
    else if (p.t === "atr") panelsSvg += renderAtrPanel(rows, xFor, padL, padL + plotW, cursorY, p.h);
    else if (p.t === "adx") panelsSvg += renderAdxPanel(rows, xFor, padL, padL + plotW, cursorY, p.h);
    else if (p.t === "cci") panelsSvg += renderCciPanel(rows, xFor, padL, padL + plotW, cursorY, p.h);
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

  // 드로잉(추세선/피보) 좌표 매핑용 지오메트리 저장.
  lastChartGeom = { padL, plotW, padT, plotH, min, max, range, width, height, ticker: item.ticker };
  const isLine = chartState.chartType === "line";

  svg.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" rx="8" class="chart-bg"></rect>
    ${vGuides}
    ${grid}
    ${isLine ? `<path d="${area}" class="chart-area"></path>` : ""}
    ${bollSvg}
    ${isLine ? "" : candles}
    ${isLine ? `<path d="${linePath}" class="chart-line"></path>` : ""}
    ${overlays}
    <g id="chartDrawLayer">${renderChartDrawings()}</g>
    ${panelsSvg}
    <line x1="${padL}" y1="${padT + plotH}" x2="${padL + plotW}" y2="${padT + plotH}" class="chart-base"></line>
    ${dateLabels}
    <text x="${padL}" y="20" class="chart-label">${item.ticker} ${chartState.range} · ${tfLabel} · ${rows.length} bars · ${fmtPct(chartChange)}</text>
    <text x="${padL}" y="36" class="chart-axis">${activeIndicatorLabels(item)}</text>
    <text x="${width - 10}" y="20" text-anchor="end" class="chart-label">$${last.c.toFixed(2)}</text>
  `;
}

// ----- Timeframe resampling (daily -> weekly / monthly) -----
function resampleBars(rows, tf) {
  if (tf !== "W" && tf !== "M") return rows;
  const keyFor = tf === "W" ? isoWeekKey : (d) => String(d).slice(0, 7);
  const groups = new Map();
  const order = [];
  for (const row of rows) {
    const key = keyFor(row.d || "");
    if (!groups.has(key)) {
      groups.set(key, { o: row.o, h: row.h, l: row.l, c: row.c, v: row.v || 0, d: row.d });
      order.push(key);
    } else {
      const g = groups.get(key);
      g.h = Math.max(g.h, row.h);
      g.l = Math.min(g.l, row.l);
      g.c = row.c;
      g.v += row.v || 0;
      g.d = row.d;
    }
  }
  return order.map((key) => groups.get(key));
}

function isoWeekKey(dateStr) {
  const parts = String(dateStr).split("-");
  if (parts.length < 3) return dateStr;
  const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const tmp = new Date(dt);
  tmp.setDate(tmp.getDate() + 4 - ((tmp.getDay() + 6) % 7)); // ISO: shift to Thursday
  const yearStart = new Date(tmp.getFullYear(), 0, 1);
  const week = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
  return `${tmp.getFullYear()}-W${week}`;
}

// ----- Indicator math -----
function pathFromSeries(values, xFor, yFor, color, strokeW, dash) {
  const pts = values.map((v, i) => (v == null || !Number.isFinite(v) ? null : [xFor(i), yFor(v)])).filter(Boolean);
  if (pts.length < 2) return "";
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${strokeW}"${dash ? ` stroke-dasharray="${dash}"` : ""} stroke-linecap="round"></path>`;
}

function emaRaw(values, period) {
  const out = [];
  const k = 2 / (period + 1);
  let ema = values.length ? values[0] : 0;
  for (let i = 0; i < values.length; i += 1) {
    ema = i ? values[i] * k + ema * (1 - k) : values[i];
    out.push(ema);
  }
  return out;
}

function emaArray(values, period) {
  const out = emaRaw(values, period);
  for (let i = 0; i < Math.min(period - 1, out.length); i += 1) out[i] = null;
  return out;
}

function bollinger(values, period, mult) {
  const mid = Array(values.length).fill(null);
  const upper = Array(values.length).fill(null);
  const lower = Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i += 1) {
    const chunk = values.slice(i - period + 1, i + 1);
    const m = chunk.reduce((a, b) => a + b, 0) / period;
    const variance = chunk.reduce((a, b) => a + (b - m) * (b - m), 0) / period;
    const sd = Math.sqrt(variance);
    mid[i] = m;
    upper[i] = m + mult * sd;
    lower[i] = m - mult * sd;
  }
  return { mid, upper, lower };
}

function macdSeries(values) {
  const fast = emaRaw(values, 12);
  const slow = emaRaw(values, 26);
  const macd = values.map((_, i) => fast[i] - slow[i]);
  const signal = emaRaw(macd, 9);
  const hist = macd.map((v, i) => v - signal[i]);
  const warm = Math.min(25, values.length);
  for (let i = 0; i < warm; i += 1) {
    macd[i] = null;
    signal[i] = null;
    hist[i] = null;
  }
  return { macd, signal, hist };
}

function stochArrays(rows, kPeriod, dPeriod) {
  const k = Array(rows.length).fill(null);
  for (let i = kPeriod - 1; i < rows.length; i += 1) {
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j += 1) {
      hi = Math.max(hi, rows[j].h);
      lo = Math.min(lo, rows[j].l);
    }
    k[i] = hi === lo ? 50 : ((rows[i].c - lo) / (hi - lo)) * 100;
  }
  const d = Array(rows.length).fill(null);
  for (let i = kPeriod - 1 + dPeriod - 1; i < rows.length; i += 1) {
    let sum = 0;
    let count = 0;
    for (let j = i - dPeriod + 1; j <= i; j += 1) {
      if (k[j] != null) { sum += k[j]; count += 1; }
    }
    if (count) d[i] = sum / count;
  }
  return { k, d };
}

function smaArray(values, period) {
  const out = Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i += 1) {
    const chunk = values.slice(i - period + 1, i + 1);
    out[i] = chunk.reduce((sum, value) => sum + value, 0) / period;
  }
  return out;
}

function vwapArray(rows) {
  const out = Array(rows.length).fill(null);
  let pv = 0;
  let volume = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const v = row.v || 0;
    const typical = (row.h + row.l + row.c) / 3;
    pv += typical * v;
    volume += v;
    out[i] = volume ? pv / volume : typical;
  }
  return out;
}

function trueRangeArray(rows) {
  return rows.map((row, i) => {
    if (!i) return row.h - row.l;
    const prevClose = rows[i - 1].c;
    return Math.max(row.h - row.l, Math.abs(row.h - prevClose), Math.abs(row.l - prevClose));
  });
}

function wilderArray(values, period) {
  const out = Array(values.length).fill(null);
  if (values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i += 1) sum += values[i] || 0;
  out[period - 1] = sum / period;
  for (let i = period; i < values.length; i += 1) {
    out[i] = ((out[i - 1] * (period - 1)) + (values[i] || 0)) / period;
  }
  return out;
}

function atrArray(rows, period = 14) {
  return wilderArray(trueRangeArray(rows), period);
}

function keltnerChannels(rows, period = 20, mult = 2) {
  const closes = rows.map((row) => row.c);
  const mid = emaArray(closes, period);
  const atr = atrArray(rows, period);
  return {
    mid,
    upper: mid.map((v, i) => (v == null || atr[i] == null ? null : v + mult * atr[i])),
    lower: mid.map((v, i) => (v == null || atr[i] == null ? null : v - mult * atr[i]))
  };
}

function donchianChannels(rows, period = 20) {
  const upper = Array(rows.length).fill(null);
  const lower = Array(rows.length).fill(null);
  const mid = Array(rows.length).fill(null);
  for (let i = period - 1; i < rows.length; i += 1) {
    const slice = rows.slice(i - period + 1, i + 1);
    upper[i] = Math.max(...slice.map((row) => row.h));
    lower[i] = Math.min(...slice.map((row) => row.l));
    mid[i] = (upper[i] + lower[i]) / 2;
  }
  return { upper, lower, mid };
}

function ichimokuArrays(rows) {
  const midRange = (period) => {
    const out = Array(rows.length).fill(null);
    for (let i = period - 1; i < rows.length; i += 1) {
      const slice = rows.slice(i - period + 1, i + 1);
      out[i] = (Math.max(...slice.map((row) => row.h)) + Math.min(...slice.map((row) => row.l))) / 2;
    }
    return out;
  };
  const tenkan = midRange(9);
  const kijun = midRange(26);
  const spanB = midRange(52);
  const spanA = tenkan.map((v, i) => (v == null || kijun[i] == null ? null : (v + kijun[i]) / 2));
  return { tenkan, kijun, spanA, spanB };
}

function supertrendArray(rows, period = 10, mult = 3) {
  const atr = atrArray(rows, period);
  const out = Array(rows.length).fill(null);
  const upper = Array(rows.length).fill(null);
  const lower = Array(rows.length).fill(null);
  let trendUp = true;
  for (let i = 0; i < rows.length; i += 1) {
    if (atr[i] == null) continue;
    const hl2 = (rows[i].h + rows[i].l) / 2;
    const basicUpper = hl2 + mult * atr[i];
    const basicLower = hl2 - mult * atr[i];
    upper[i] = i && upper[i - 1] != null && rows[i - 1].c <= upper[i - 1]
      ? Math.min(basicUpper, upper[i - 1])
      : basicUpper;
    lower[i] = i && lower[i - 1] != null && rows[i - 1].c >= lower[i - 1]
      ? Math.max(basicLower, lower[i - 1])
      : basicLower;
    if (i && out[i - 1] != null) {
      if (trendUp && rows[i].c < lower[i]) trendUp = false;
      else if (!trendUp && rows[i].c > upper[i]) trendUp = true;
    } else {
      trendUp = rows[i].c >= hl2;
    }
    out[i] = trendUp ? lower[i] : upper[i];
  }
  return out;
}

function obvArray(rows) {
  const out = Array(rows.length).fill(null);
  let obv = 0;
  for (let i = 0; i < rows.length; i += 1) {
    if (!i) obv = rows[i].v || 0;
    else if (rows[i].c > rows[i - 1].c) obv += rows[i].v || 0;
    else if (rows[i].c < rows[i - 1].c) obv -= rows[i].v || 0;
    out[i] = obv;
  }
  return out;
}

function accumulationDistributionArray(rows) {
  const out = Array(rows.length).fill(null);
  let line = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const range = row.h - row.l;
    const multiplier = range ? (((row.c - row.l) - (row.h - row.c)) / range) : 0;
    line += multiplier * (row.v || 0);
    out[i] = line;
  }
  return out;
}

function rocArray(values, period = 12) {
  return values.map((value, i) => i < period || !values[i - period] ? null : ((value / values[i - period]) - 1) * 100);
}

function momentumArray(values, period = 10) {
  return values.map((value, i) => i < period ? null : value - values[i - period]);
}

function williamsArray(rows, period = 14) {
  const out = Array(rows.length).fill(null);
  for (let i = period - 1; i < rows.length; i += 1) {
    const slice = rows.slice(i - period + 1, i + 1);
    const hi = Math.max(...slice.map((row) => row.h));
    const lo = Math.min(...slice.map((row) => row.l));
    out[i] = hi === lo ? -50 : ((hi - rows[i].c) / (hi - lo)) * -100;
  }
  return out;
}

function adxArrays(rows, period = 14) {
  const plusDm = Array(rows.length).fill(0);
  const minusDm = Array(rows.length).fill(0);
  for (let i = 1; i < rows.length; i += 1) {
    const upMove = rows[i].h - rows[i - 1].h;
    const downMove = rows[i - 1].l - rows[i].l;
    plusDm[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDm[i] = downMove > upMove && downMove > 0 ? downMove : 0;
  }
  const atr = atrArray(rows, period);
  const smoothPlus = wilderArray(plusDm, period);
  const smoothMinus = wilderArray(minusDm, period);
  const plusDi = rows.map((_, i) => atr[i] ? (100 * smoothPlus[i]) / atr[i] : null);
  const minusDi = rows.map((_, i) => atr[i] ? (100 * smoothMinus[i]) / atr[i] : null);
  const dx = rows.map((_, i) => {
    if (plusDi[i] == null || minusDi[i] == null || plusDi[i] + minusDi[i] === 0) return null;
    return 100 * Math.abs(plusDi[i] - minusDi[i]) / (plusDi[i] + minusDi[i]);
  });
  const adx = wilderArray(dx.map((v) => v ?? 0), period);
  for (let i = 0; i < period * 2 - 2 && i < adx.length; i += 1) adx[i] = null;
  return { adx, plusDi, minusDi };
}

function cciArray(rows, period = 20) {
  const typical = rows.map((row) => (row.h + row.l + row.c) / 3);
  const out = Array(rows.length).fill(null);
  for (let i = period - 1; i < rows.length; i += 1) {
    const chunk = typical.slice(i - period + 1, i + 1);
    const avg = chunk.reduce((sum, value) => sum + value, 0) / period;
    const meanDev = chunk.reduce((sum, value) => sum + Math.abs(value - avg), 0) / period;
    out[i] = meanDev ? (typical[i] - avg) / (0.015 * meanDev) : 0;
  }
  return out;
}

function renderChannelOverlay(upper, lower, mid, xFor, yFor, color) {
  return [
    pathFromSeries(upper, xFor, yFor, color, 1.1, "4 3"),
    pathFromSeries(lower, xFor, yFor, color, 1.1, "4 3"),
    pathFromSeries(mid, xFor, yFor, color, 1.0, "")
  ].join("");
}

function renderIchimokuOverlay(lines, xFor, yFor) {
  return [
    pathFromSeries(lines.spanA, xFor, yFor, "#22c55e", 1, "3 3"),
    pathFromSeries(lines.spanB, xFor, yFor, "#ef4444", 1, "3 3"),
    pathFromSeries(lines.tenkan, xFor, yFor, "#38bdf8", 1.2, ""),
    pathFromSeries(lines.kijun, xFor, yFor, "#f59e0b", 1.2, "")
  ].join("");
}

function finiteValues(values) {
  return values.filter((v) => v != null && Number.isFinite(v));
}

function panelDomain(series, fallback = [-1, 1]) {
  const vals = finiteValues(series.flatMap((s) => s.values || []));
  if (!vals.length) return fallback;
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (min === max) {
    min -= Math.abs(min || 1) * 0.05;
    max += Math.abs(max || 1) * 0.05;
  }
  return [min, max];
}

function renderLinePanel(series, xFor, x1, x2, top, height, title, options = {}) {
  const guideValues = options.guides || [];
  const domainSource = options.domain ? null : series.concat([{ values: guideValues }]);
  const [min, max] = options.domain || panelDomain(domainSource);
  const span = max - min || 1;
  const yFor = (value) => top + ((max - value) / span) * height;
  const guides = guideValues.map((value) => `
    <line x1="${x1}" y1="${yFor(value).toFixed(1)}" x2="${x2}" y2="${yFor(value).toFixed(1)}" class="rsi-guide"></line>
    <text x="${x2 + 44}" y="${(yFor(value) + 4).toFixed(1)}" text-anchor="end" class="chart-axis">${options.formatGuide ? options.formatGuide(value) : value}</text>
  `).join("");
  const paths = series.map((s) => pathFromSeries(s.values, xFor, yFor, s.color, s.width || 1.4, s.dash || "")).join("");
  const legend = series.map((s) => `<tspan fill="${s.color}">${escapeHtml(s.name)}</tspan>`).join("  ");
  return `
    <rect x="${x1}" y="${top}" width="${x2 - x1}" height="${height}" class="rsi-bg"></rect>
    ${guides}
    ${options.zeroLine && min < 0 && max > 0 ? `<line x1="${x1}" y1="${yFor(0).toFixed(1)}" x2="${x2}" y2="${yFor(0).toFixed(1)}" class="rsi-guide"></line>` : ""}
    ${paths}
    <text x="${x1 + 4}" y="${top + 12}" class="chart-axis">${escapeHtml(title)} ${legend}</text>
  `;
}

function stockByTicker(ticker) {
  const key = String(ticker || "").toUpperCase();
  return (data.stocks || []).find((row) => String(row.ticker || "").toUpperCase() === key) || null;
}

// ===== 한국어/회사명 → 티커 검색 =====
const TICKER_SEARCH_TOP_N = 1500;
const TICKER_SEARCH_COMPANY_SCAN_N = 2800;

let tickerKoAliasIndex = null;
let tickerKoAliasEntries = null;
let tickerSearchIndex = null;

function buildTickerKoAliasIndex() {
  const byKo = new Map();
  const raw = window.TICKER_ALIASES_KO || {};
  Object.entries(raw).forEach(([ticker, aliases]) => {
    if (!stockByTicker(ticker)) return;
    (aliases || []).forEach((alias) => {
      const key = String(alias || "").trim();
      if (!key) return;
      if (!byKo.has(key)) byKo.set(key, []);
      if (!byKo.get(key).includes(ticker)) byKo.get(key).push(ticker);
    });
  });
  tickerKoAliasIndex = byKo;
  tickerKoAliasEntries = [];
  byKo.forEach((tickers, alias) => tickerKoAliasEntries.push({ alias, tickers }));
}

function buildTickerSearchIndex() {
  buildTickerKoAliasIndex();
  const stocks = (data.stocks || []).slice().sort((a, b) => (Number(b.marketCapB) || 0) - (Number(a.marketCapB) || 0));
  tickerSearchIndex = {
    byMarketCap: stocks.map((s) => ({
      ticker: s.ticker,
      company: s.company || "",
      companyLower: String(s.company || "").toLowerCase(),
      marketCapB: Number(s.marketCapB) || 0,
    })),
  };
}

function tickerKoHaystack(ticker) {
  const stock = stockByTicker(ticker);
  if (!stock) return "";
  const aliases = (window.TICKER_ALIASES_KO || {})[ticker] || [];
  return `${stock.ticker} ${stock.company} ${aliases.join(" ")}`;
}

function heatmapItemMatchesQuery(item, rawQuery) {
  const q = String(rawQuery || "").trim();
  if (!q) return true;
  const hayUpper = `${item.ticker} ${item.company} ${item.sector} ${item.industry}`.toUpperCase();
  if (hayUpper.includes(q.toUpperCase())) return true;
  const aliases = (window.TICKER_ALIASES_KO || {})[item.ticker] || [];
  return aliases.some((alias) => alias.includes(q) || q.includes(alias));
}

function searchTickerSuggestions(query, limit = 8) {
  const q = String(query || "").trim();
  if (!q || !tickerSearchIndex) return [];
  const qUpper = q.toUpperCase();
  const qLower = q.toLowerCase();
  const scored = [];
  const seen = new Set();

  function push(ticker, score, hint) {
    const stock = stockByTicker(ticker);
    if (!stock || seen.has(stock.ticker)) return;
    seen.add(stock.ticker);
    scored.push({ ticker: stock.ticker, company: stock.company, hint: hint || null, score });
  }

  const exactTicker = stockByTicker(qUpper);
  if (exactTicker) push(exactTicker.ticker, 1000, "티커");

  (tickerKoAliasEntries || []).forEach(({ alias, tickers }) => {
    let score = 0;
    if (alias === q) score = 980;
    else if (alias.startsWith(q)) score = 900 - alias.length;
    else if (alias.includes(q)) score = 760 - alias.length;
    if (score > 0) tickers.forEach((t) => push(t, score, alias));
  });

  const pool = tickerSearchIndex.byMarketCap;
  const maxScan = q.length <= 2
    ? Math.min(pool.length, TICKER_SEARCH_TOP_N)
    : Math.min(pool.length, TICKER_SEARCH_COMPANY_SCAN_N);
  for (let i = 0; i < maxScan && seen.size < limit + 4; i += 1) {
    const row = pool[i];
    const ticker = String(row.ticker || "").toUpperCase();
    if (ticker === qUpper) push(ticker, 995, null);
    else if (ticker.startsWith(qUpper)) push(ticker, 620 - i * 0.001, null);
    else if (row.companyLower.includes(qLower)) push(ticker, 500 - i * 0.01, null);
  }
  if (seen.size < limit && q.length >= 3 && maxScan < pool.length) {
    for (let i = maxScan; i < pool.length && seen.size < limit + 2; i += 1) {
      const row = pool[i];
      if (row.companyLower.includes(qLower)) push(row.ticker, 320 - i * 0.001, null);
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

function resolveTickerQuery(raw) {
  const q = String(raw || "").trim();
  if (!q) return null;
  const direct = stockByTicker(q);
  if (direct) return direct.ticker;
  const hits = searchTickerSuggestions(q, 6);
  if (!hits.length) return null;
  const exactKo = hits.find((h) => h.hint === q);
  if (exactKo) return exactKo.ticker;
  if (hits.length === 1) return hits[0].ticker;
  if (hits[0].score - (hits[1]?.score || 0) >= 180) return hits[0].ticker;
  return hits[0].ticker;
}

function resolveTickerListInput(text) {
  return [...new Set(
    String(text || "").split(",")
      .map((part) => resolveTickerQuery(part.trim()))
      .filter(Boolean),
  )];
}

function tickerInputActiveToken(input) {
  const val = input.value;
  const pos = input.selectionStart ?? val.length;
  const before = val.slice(0, pos);
  const lastComma = before.lastIndexOf(",");
  const segment = before.slice(lastComma + 1);
  const lead = segment.match(/^\s*/)?.[0]?.length || 0;
  const token = segment.slice(lead).trim();
  const start = lastComma + 1 + lead;
  const end = pos;
  return { token, start, end, val };
}

function setupTickerAutocomplete(inputId, options = {}) {
  const input = byId(inputId);
  if (!input || input.dataset.tickerAcReady) return;
  input.dataset.tickerAcReady = "1";
  const multi = Boolean(options.multi);
  const label = input.closest("label");
  let wrap = input.parentElement;
  if (label && label.parentElement) {
    wrap = document.createElement("div");
    wrap.className = "ticker-ac-wrap";
    if (label.classList.contains("grow")) {
      label.classList.remove("grow");
      wrap.classList.add("grow");
    }
    label.parentElement.insertBefore(wrap, label);
    wrap.appendChild(label);
  } else if (wrap) {
    wrap.classList.add("ticker-ac-wrap");
  } else {
    return;
  }
  const list = document.createElement("div");
  list.className = "ticker-ac-list";
  list.hidden = true;
  wrap.appendChild(list);

  let timer = null;
  let activeIdx = -1;

  function closeList() {
    list.hidden = true;
    list.innerHTML = "";
    activeIdx = -1;
  }

  function applySuggestion(ticker) {
    if (!multi) {
      input.value = ticker;
      closeList();
      if (typeof options.onSelect === "function") options.onSelect(ticker);
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    const { start, end, val } = tickerInputActiveToken(input);
    const next = `${val.slice(0, start)}${ticker}${val.slice(end)}`;
    input.value = next.includes(",") ? next.replace(/\s*,\s*/g, ", ") : next;
    closeList();
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function renderList(items, token) {
    if (!items.length) {
      closeList();
      return;
    }
    list.innerHTML = items.map((item, index) => `
      <button type="button" class="ticker-ac-item${index === activeIdx ? " is-active" : ""}" data-ticker="${escapeHtml(item.ticker)}" data-index="${index}">
        <strong>${escapeHtml(item.ticker)}</strong>
        <span>${escapeHtml(item.company)}</span>
        ${item.hint && item.hint !== item.ticker ? `<em>${escapeHtml(item.hint)}</em>` : ""}
      </button>
    `).join("");
    list.hidden = false;
    list.querySelectorAll(".ticker-ac-item").forEach((btn) => {
      btn.addEventListener("mousedown", (event) => {
        event.preventDefault();
        applySuggestion(btn.dataset.ticker);
      });
    });
  }

  function refresh() {
    const token = multi ? tickerInputActiveToken(input).token : input.value.trim();
    if (token.length < 1) {
      closeList();
      return;
    }
    renderList(searchTickerSuggestions(token, 8), token);
    activeIdx = -1;
  }

  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(refresh, 120);
  });
  input.addEventListener("focus", () => {
    if ((multi ? tickerInputActiveToken(input).token : input.value.trim()).length) refresh();
  });
  input.addEventListener("keydown", (event) => {
    const items = [...list.querySelectorAll(".ticker-ac-item")];
    if (!items.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      activeIdx = (activeIdx + 1) % items.length;
      items.forEach((el, i) => el.classList.toggle("is-active", i === activeIdx));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      activeIdx = activeIdx <= 0 ? items.length - 1 : activeIdx - 1;
      items.forEach((el, i) => el.classList.toggle("is-active", i === activeIdx));
    } else if (event.key === "Enter" && activeIdx >= 0) {
      event.preventDefault();
      applySuggestion(items[activeIdx].dataset.ticker);
    } else if (event.key === "Escape") {
      closeList();
    }
  });
  input.addEventListener("blur", () => setTimeout(closeList, 140));
  document.addEventListener("click", (event) => {
    if (!wrap.contains(event.target)) closeList();
  });
}

function setupTickerSearchHelpers() {
  buildTickerSearchIndex();
  setupTickerAutocomplete("tickerSearch");
  setupTickerAutocomplete("bulkInput", { multi: true });
  setupTickerAutocomplete("compareInput", { multi: true });
  setupTickerAutocomplete("backtestTickerInput");
  setupTickerAutocomplete("communityTicker");
  setupTickerAutocomplete("communityFilterTicker");
  setupTickerAutocomplete("heatmapSearch", {
    onSelect: (ticker) => focusTreemapTicker(ticker, { push: false, openMap: false }),
  });
}

function sectorBenchmarkTickerForItem(item) {
  const sector = String(item.sector || "").toUpperCase();
  const industry = String(item.industry || "").toUpperCase();
  if (industry.includes("SEMICONDUCTOR") || sector.includes("SEMICONDUCTOR")) return "SOXX";
  const exact = SECTOR_ETFS.find((meta) => String(meta.sectorName || "").toUpperCase() === sector);
  if (exact) return exact.ticker;
  const fuzzy = SECTOR_ETFS.find((meta) => {
    const name = String(meta.sectorName || "").toUpperCase();
    return name && (sector.includes(name) || industry.includes(name));
  });
  return fuzzy ? fuzzy.ticker : null;
}

function relativeBenchmarkTickers(item) {
  const tickers = [];
  if (chartState.showRsSpy || chartState.showMansfield) tickers.push("SPY");
  if (chartState.showRsQqq) tickers.push("QQQ");
  if (chartState.showRsSector) {
    const sectorTicker = sectorBenchmarkTickerForItem(item);
    if (sectorTicker && sectorTicker !== item.ticker) tickers.push(sectorTicker);
  }
  return [...new Set(tickers)];
}

function requestBenchmarkDetails(item) {
  relativeBenchmarkTickers(item).forEach((ticker) => {
    const key = safeTicker(ticker);
    if (!stockByTicker(key) || detailCache[key] || detailPromises[key]) return;
    loadStockDetail(key).then((detail) => {
      if (detail && selectedTicker === item.ticker) redrawChart();
    });
  });
}

function hasRelativePanel(item) {
  return relativeBenchmarkTickers(item).length > 0;
}

function benchmarkRowsForTicker(ticker) {
  const base = stockByTicker(ticker);
  return base ? resampleBars(getChartRows(withDetail(base)), chartState.barTf) : [];
}

function visibleRowsForBenchmark(rows, targetLength) {
  if (!rows.length) return [];
  const rangeSize = rangeBarCount(rows.length);
  const base = rows.slice(-rangeSize);
  const windowSize = Math.min(base.length, Math.max(12, targetLength || base.length));
  const maxOffset = Math.max(0, base.length - windowSize);
  const offset = Math.min(chartState.offset, maxOffset);
  const end = base.length - offset;
  return base.slice(Math.max(0, end - windowSize), end);
}
function alignBenchmarkRows(rows, benchmarkRows) {
  if (!rows.length || !benchmarkRows.length) return [];
  const dateMap = new Map(benchmarkRows.filter((row) => row.d).map((row) => [row.d, row]));
  if (dateMap.size) {
    const aligned = rows.map((row) => row.d && dateMap.get(row.d) ? dateMap.get(row.d) : null);
    if (aligned.filter(Boolean).length >= Math.max(3, Math.floor(rows.length * 0.45))) return aligned;
  }
  const start = Math.max(0, benchmarkRows.length - rows.length);
  const slice = benchmarkRows.slice(start);
  return rows.map((_, i) => slice[i] || null);
}

function relativePerformanceSeries(rows, benchmarkRows) {
  const aligned = alignBenchmarkRows(rows, benchmarkRows);
  const firstIndex = aligned.findIndex((row, i) => row && rows[i]?.c);
  if (firstIndex < 0) return Array(rows.length).fill(null);
  const baseStock = rows[firstIndex].c;
  const baseBench = aligned[firstIndex].c;
  return rows.map((row, i) => {
    const bench = aligned[i];
    if (!row || !bench || !baseStock || !baseBench) return null;
    return (((row.c / baseStock) / (bench.c / baseBench)) - 1) * 100;
  });
}

function mansfieldSeries(rows, benchmarkRows) {
  const aligned = alignBenchmarkRows(rows, benchmarkRows);
  const ratio = rows.map((row, i) => (row && aligned[i]?.c ? row.c / aligned[i].c : null));
  const period = Math.min(52, Math.max(10, Math.floor(rows.length / 3)));
  const out = Array(rows.length).fill(null);
  for (let i = period - 1; i < ratio.length; i += 1) {
    const chunk = ratio.slice(i - period + 1, i + 1).filter((v) => v != null);
    if (chunk.length < Math.max(5, Math.floor(period * 0.7))) continue;
    const avg = chunk.reduce((sum, value) => sum + value, 0) / chunk.length;
    out[i] = avg ? ((ratio[i] / avg) - 1) * 100 : null;
  }
  return out;
}

// ----- Indicator panels -----
function renderVolumePanel(rows, xFor, x1, x2, top, height, candleW) {
  const volumes = rows.map((row) => row.v || 0);
  const ma20 = smaArray(volumes, 20);
  const maxSource = chartState.showVolMa20 ? volumes.concat(ma20.filter((v) => v != null)) : volumes;
  const volMax = Math.max(...maxSource, 1);
  const yFor = (value) => top + height - (value / volMax) * height;
  const bars = chartState.showVolume ? rows.map((row, index) => {
    const x = xFor(index) - candleW / 2;
    const h = Math.max(1, (row.v / volMax) * height);
    const up = row.c >= row.o;
    return `<rect x="${x.toFixed(1)}" y="${(top + height - h).toFixed(1)}" width="${candleW.toFixed(1)}" height="${h.toFixed(1)}" class="${up ? "vol-up" : "vol-down"}"></rect>`;
  }).join("") : "";
  const lastVol = volumes[volumes.length - 1] || 0;
  const recentAvg = finiteValues(ma20).slice(-1)[0] || (volumes.reduce((sum, value) => sum + value, 0) / Math.max(1, volumes.length));
  const ratioLabel = chartState.showVolumeRatio && recentAvg ? ` · Vol ${Number(lastVol / recentAvg).toFixed(2)}x` : "";
  return `
    <rect x="${x1}" y="${top}" width="${x2 - x1}" height="${height}" class="rsi-bg"></rect>
    ${bars}
    ${chartState.showVolMa20 ? pathFromSeries(ma20, xFor, yFor, "#facc15", 1.3, "") : ""}
    <text x="${x1 + 4}" y="${top + 12}" class="chart-axis">Volume${chartState.showVolMa20 ? " · MA20" : ""}${ratioLabel}</text>
  `;
}

function renderObvPanel(rows, xFor, x1, x2, top, height) {
  return renderLinePanel([{ name: "OBV", values: obvArray(rows), color: "#60a5fa" }], xFor, x1, x2, top, height, "OBV");
}

function renderAdPanel(rows, xFor, x1, x2, top, height) {
  return renderLinePanel([{ name: "A/D", values: accumulationDistributionArray(rows), color: "#34d399" }], xFor, x1, x2, top, height, "Accum/Dist");
}

function renderRocPanel(closes, xFor, x1, x2, top, height) {
  return renderLinePanel([{ name: "ROC", values: rocArray(closes, 12), color: "#38bdf8" }], xFor, x1, x2, top, height, "ROC(12)", { zeroLine: true, guides: [0] });
}

function renderMomentumPanel(closes, xFor, x1, x2, top, height) {
  return renderLinePanel([{ name: "MOM", values: momentumArray(closes, 10), color: "#f59e0b" }], xFor, x1, x2, top, height, "Momentum(10)", { zeroLine: true, guides: [0] });
}

function renderWilliamsPanel(rows, xFor, x1, x2, top, height) {
  return renderLinePanel([{ name: "%R", values: williamsArray(rows, 14), color: "#c084fc" }], xFor, x1, x2, top, height, "Williams %R(14)", { domain: [-100, 0], guides: [-20, -80] });
}

function renderAtrPanel(rows, xFor, x1, x2, top, height) {
  return renderLinePanel([{ name: "ATR", values: atrArray(rows, 14), color: "#fb7185" }], xFor, x1, x2, top, height, "ATR(14)");
}

function renderAdxPanel(rows, xFor, x1, x2, top, height) {
  const adx = adxArrays(rows, 14);
  return renderLinePanel([
    { name: "ADX", values: adx.adx, color: "#facc15", width: 1.5 },
    { name: "+DI", values: adx.plusDi, color: "#22c55e", width: 1.2 },
    { name: "-DI", values: adx.minusDi, color: "#ef4444", width: 1.2 }
  ], xFor, x1, x2, top, height, "ADX(14)", { domain: [0, 60], guides: [20, 40] });
}

function renderCciPanel(rows, xFor, x1, x2, top, height) {
  return renderLinePanel([{ name: "CCI", values: cciArray(rows, 20), color: "#818cf8" }], xFor, x1, x2, top, height, "CCI(20)", { zeroLine: true, guides: [-100, 0, 100] });
}

function renderRelativePanel(item, rows, xFor, x1, x2, top, height) {
  const series = [];
  if (chartState.showRsSpy) {
    const bench = benchmarkRowsForTicker("SPY");
    if (bench.length) series.push({ name: "RS/SPY", values: relativePerformanceSeries(rows, visibleRowsForBenchmark(bench, rows.length)), color: "#60a5fa" });
  }
  if (chartState.showRsQqq) {
    const bench = benchmarkRowsForTicker("QQQ");
    if (bench.length) series.push({ name: "RS/QQQ", values: relativePerformanceSeries(rows, visibleRowsForBenchmark(bench, rows.length)), color: "#a78bfa" });
  }
  if (chartState.showRsSector) {
    const sectorTicker = sectorBenchmarkTickerForItem(item);
    const bench = sectorTicker ? benchmarkRowsForTicker(sectorTicker) : [];
    if (bench.length) series.push({ name: `RS/${sectorTicker}`, values: relativePerformanceSeries(rows, visibleRowsForBenchmark(bench, rows.length)), color: "#34d399" });
  }
  if (chartState.showMansfield) {
    const bench = benchmarkRowsForTicker("SPY");
    if (bench.length) series.push({ name: "Mansfield", values: mansfieldSeries(rows, visibleRowsForBenchmark(bench, rows.length)), color: "#f59e0b", dash: "4 3" });
  }
  if (!series.length) {
    return `
      <rect x="${x1}" y="${top}" width="${x2 - x1}" height="${height}" class="rsi-bg"></rect>
      <text x="${x1 + 4}" y="${top + 14}" class="chart-axis">Relative Strength · benchmark data loading</text>
    `;
  }
  return renderLinePanel(series, xFor, x1, x2, top, height, "Relative Strength", { zeroLine: true, guides: [0], formatGuide: (v) => `${v}%` });
}

function renderComparePanel(item, rows, xFor, x1, x2, top, height) {
  requestCompareDetails(item);
  const series = [{
    name: item.ticker,
    values: indexedReturnSeries(rows),
    color: "#f8fafc",
    width: 1.5
  }];
  const colors = ["#60a5fa", "#34d399", "#f59e0b", "#f472b6", "#818cf8"];
  compareTickers.forEach((ticker, index) => {
    const bench = benchmarkRowsForTicker(ticker);
    if (!bench.length) return;
    series.push({
      name: ticker,
      values: indexedReturnSeries(alignBenchmarkRows(rows, visibleRowsForBenchmark(bench, rows.length))),
      color: colors[index % colors.length],
      width: 1.4
    });
  });
  return renderLinePanel(series, xFor, x1, x2, top, height, "Indexed Compare", { zeroLine: true, guides: [0], formatGuide: (v) => `${v}%` });
}

function indexedReturnSeries(rows) {
  const first = rows.find((row) => row && row.c);
  if (!first) return Array(rows.length).fill(null);
  return rows.map((row) => (row && row.c ? ((row.c / first.c) - 1) * 100 : null));
}

function requestCompareDetails(item) {
  compareTickers.forEach((ticker) => {
    const key = safeTicker(ticker);
    if (!key || key === item.ticker || detailCache[key] || detailPromises[key]) return;
    loadStockDetail(key).then((detail) => {
      if (detail && selectedTicker === item.ticker) redrawChart();
    });
  });
}
function renderMacdPanel(closes, xFor, x1, x2, top, height, candleW) {
  const { macd, signal, hist } = macdSeries(closes);
  const all = [...macd, ...signal, ...hist].filter((v) => v != null && Number.isFinite(v));
  const m = Math.max(0.001, ...all.map((v) => Math.abs(v)));
  const yFor = (v) => top + (1 - (v / m + 1) / 2) * height;
  const zeroY = yFor(0);
  const bars = hist.map((v, i) => {
    if (v == null) return "";
    const y = Math.min(zeroY, yFor(v));
    const h = Math.max(0.5, Math.abs(yFor(v) - zeroY));
    return `<rect x="${(xFor(i) - candleW / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${candleW.toFixed(1)}" height="${h.toFixed(1)}" class="${v >= 0 ? "macd-hist-up" : "macd-hist-down"}"></rect>`;
  }).join("");
  return `
    <rect x="${x1}" y="${top}" width="${x2 - x1}" height="${height}" class="rsi-bg"></rect>
    <line x1="${x1}" y1="${zeroY}" x2="${x2}" y2="${zeroY}" class="rsi-guide"></line>
    ${bars}
    ${pathFromSeries(macd, xFor, yFor, "#60a5fa", 1.4, "")}
    ${pathFromSeries(signal, xFor, yFor, "#f59e0b", 1.4, "")}
    <text x="${x1 + 4}" y="${top + 12}" class="chart-axis">MACD(12,26,9)</text>
  `;
}

function renderStochPanel(rows, xFor, x1, x2, top, height) {
  const { k, d } = stochArrays(rows, 14, 3);
  const yFor = (v) => top + ((100 - v) / 100) * height;
  return `
    <rect x="${x1}" y="${top}" width="${x2 - x1}" height="${height}" class="rsi-bg"></rect>
    <line x1="${x1}" y1="${yFor(80)}" x2="${x2}" y2="${yFor(80)}" class="rsi-guide"></line>
    <line x1="${x1}" y1="${yFor(20)}" x2="${x2}" y2="${yFor(20)}" class="rsi-guide"></line>
    ${pathFromSeries(k, xFor, yFor, "#22d3ee", 1.4, "")}
    ${pathFromSeries(d, xFor, yFor, "#f472b6", 1.4, "")}
    <text x="${x1 + 4}" y="${top + 12}" class="chart-axis">Stoch(14,3)</text>
    <text x="${x2 + 44}" y="${yFor(80) + 4}" text-anchor="end" class="chart-axis">80</text>
    <text x="${x2 + 44}" y="${yFor(20) + 4}" text-anchor="end" class="chart-axis">20</text>
  `;
}

function formatChartDate(d) {
  const parts = String(d).split("-");
  if (parts.length < 3) return String(d);
  const [y, m, day] = parts;
  if (chartState.range === "5Y" || chartState.range === "1Y") return `${y.slice(2)}.${m}`;
  return `${Number(m)}/${Number(day)}`;
}

function getChartRows(item) {
  let rows;
  if (Array.isArray(item.chartSeries) && item.chartSeries.length) {
    rows = item.chartSeries.map((row) => {
      if (Array.isArray(row)) {
        return { o: Number(row[0]), h: Number(row[1]), l: Number(row[2]), c: Number(row[3]), v: Number(row[4] || 0), d: row[5] || null };
      }
      return {
        o: Number(row.o ?? row.c),
        h: Number(row.h ?? row.c),
        l: Number(row.l ?? row.c),
        c: Number(row.c),
        v: Number(row.v || 0),
        d: row.d ?? row.date ?? null
      };
    }).filter((row) => Number.isFinite(row.c));
  } else {
    const closes = item.closeSeries || [];
    rows = closes.map((close, index) => {
      const previous = Number(closes[Math.max(0, index - 1)] || close);
      const c = Number(close);
      const high = Math.max(previous, c) * 1.004;
      const low = Math.min(previous, c) * 0.996;
      return { o: previous, h: high, l: low, c, v: 1, d: null };
    });
  }
  // When the data carries no dates (older detail files / synthetic series), infer
  // approximate daily dates client-side so the x-axis works without the proxy.
  if (rows.length && !rows[rows.length - 1].d) fillInferredDates(rows);
  return rows;
}

function snapshotBaseDate() {
  const raw = (data && (data.updatedAtKst || data.updated_at_kst)) || "";
  const match = String(raw).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Date();
}

function fillInferredDates(rows) {
  const d = snapshotBaseDate();
  const iso = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    rows[i].d = iso(d);
    do {
      d.setDate(d.getDate() - 1);
    } while (d.getDay() === 0 || d.getDay() === 6); // skip weekends
  }
}

// How many bars the active range maps to, expressed in the active timeframe's units.
function rangeBarCount(total) {
  const dailyMap = { "1M": 22, "3M": 66, "6M": 132, "1Y": 252, "5Y": 1260 };
  const div = chartState.barTf === "W" ? 5 : (chartState.barTf === "M" ? 21 : 1);
  const want = Math.round((dailyMap[chartState.range] || total) / div);
  return Math.min(total, Math.max(10, want));
}

function visibleChartRows(rows) {
  const rangeSize = rangeBarCount(rows.length);
  const base = rows.slice(-rangeSize);
  const windowSize = Math.max(12, Math.floor(base.length / chartState.zoom));
  const maxOffset = Math.max(0, base.length - windowSize);
  chartState.offset = Math.min(chartState.offset, maxOffset);
  const end = base.length - chartState.offset;
  return base.slice(Math.max(0, end - windowSize), end);
}

function averagePath(values, period, xFor, yFor, color) {
  const points = values.map((_, index) => {
    if (index < period - 1) return null;
    const chunk = values.slice(index - period + 1, index + 1);
    const avg = chunk.reduce((sum, value) => sum + value, 0) / chunk.length;
    return [xFor(index), yFor(avg)];
  }).filter(Boolean);
  if (points.length < 2) return "";
  const path = points.map(([x, y], index) => `${index ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return `<path d="${path}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round"></path>`;
}

function renderRsiPanel(closes, xFor, x1, x2, top, height) {
  const values = rsiSeries(closes, 14);
  const yFor = (value) => top + ((100 - value) / 100) * height;
  const points = values.map((value, index) => Number.isFinite(value) ? [xFor(index), yFor(value)] : null).filter(Boolean);
  const path = points.map(([x, y], index) => `${index ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return `
    <rect x="${x1}" y="${top}" width="${x2 - x1}" height="${height}" class="rsi-bg"></rect>
    <line x1="${x1}" y1="${yFor(70)}" x2="${x2}" y2="${yFor(70)}" class="rsi-guide"></line>
    <line x1="${x1}" y1="${yFor(30)}" x2="${x2}" y2="${yFor(30)}" class="rsi-guide"></line>
    ${path ? `<path d="${path}" class="rsi-line"></path>` : ""}
    <text x="${x1 + 4}" y="${top + 14}" class="chart-axis">RSI(14)</text>
    <text x="${x2 + 44}" y="${yFor(70) + 4}" text-anchor="end" class="chart-axis">70</text>
    <text x="${x2 + 44}" y="${yFor(30) + 4}" text-anchor="end" class="chart-axis">30</text>
  `;
}

function rsiSeries(values, period) {
  const out = Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i += 1) {
    const change = values[i] - values[i - 1];
    gain += Math.max(0, change);
    loss += Math.max(0, -change);
  }
  gain /= period;
  loss /= period;
  out[period] = rsiValue(gain, loss);
  for (let i = period + 1; i < values.length; i += 1) {
    const change = values[i] - values[i - 1];
    gain = (gain * (period - 1) + Math.max(0, change)) / period;
    loss = (loss * (period - 1) + Math.max(0, -change)) / period;
    out[i] = rsiValue(gain, loss);
  }
  return out;
}

function rsiValue(avgGain, avgLoss) {
  if (!avgLoss) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function activeIndicatorLabels(item) {
  const labels = [
    chartState.showSma5 ? "SMA5" : "",
    chartState.showSma10 ? "SMA10" : "",
    chartState.showSma20 ? "SMA20" : "",
    chartState.showSma60 ? "SMA60" : "",
    chartState.showSma120 ? "SMA120" : "",
    chartState.showEma20 ? "EMA20" : "",
    chartState.showEma60 ? "EMA60" : "",
    chartState.showBoll ? "BOLL" : "",
    chartState.showVwap ? "VWAP" : "",
    chartState.showSupertrend ? "Supertrend" : "",
    chartState.showIchimoku ? "Ichimoku" : "",
    chartState.showKeltner ? "Keltner" : "",
    chartState.showDonchian ? "Donchian" : "",
    chartState.showRsSector ? `RS/${sectorBenchmarkTickerForItem(item) || "Sector"}` : ""
  ].filter(Boolean);
  const visible = labels.slice(0, 9);
  if (labels.length > visible.length) visible.push(`+${labels.length - visible.length}`);
  return visible.join(" ");
}

function pctFrom(now, then) {
  if (!then) return 0;
  return ((now / then) - 1) * 100;
}

function extractTickerCandidates(text) {
  const words = String(text || "").toUpperCase().match(/\b[A-Z][A-Z0-9.\-]{0,5}\b/g) || [];
  return [...new Set(words.filter((w) => stockByTicker(w)))];
}

function buildStockChatContext(userText) {
  const tickers = new Set();
  if (chatFocusTicker) tickers.add(chatFocusTicker);
  if (selectedTicker) tickers.add(selectedTicker);
  extractTickerCandidates(userText).forEach((t) => tickers.add(t));
  if (!tickers.size) return "";

  const lines = [];
  tickers.forEach((ticker) => {
    const base = stockByTicker(ticker);
    if (!base) return;
    const item = applyLive(withDetail(base));
    const f = item.fundamentals || {};
    const earnings = item.liveEarnings || {};
    lines.push(
      `[${item.ticker} ${item.company}] 섹터:${item.sector} · 가격:$${Number(item.price).toFixed(2)} · 당일:${fmtPct(item.changePct)} · 1주:${fmtPct(item.weekChangePct)} · 1M:${fmtPct(item.monthChangePct)} · RS:${item.rsScore} · EPS점수:${item.epsRevScore} · 거래량:${Number(item.volumeRatio || 0).toFixed(1)}x · 신고가거리:${fmtPct(-item.newHighDistancePct)} · 신호:${signalFor(item)}` +
      (f.pe ? ` · PER:${fmtMultiple(f.pe)}` : "") +
      (f.forwardPE ? ` · FwdPER:${fmtMultiple(f.forwardPE)}` : "") +
      (f.ps ? ` · P/S:${fmtMultiple(f.ps)}` : "") +
      (f.pb ? ` · P/B:${fmtMultiple(f.pb)}` : "") +
      (earnings.nextDate ? ` · 다음실적:${earnings.nextDate}` : "") +
      (earnings.epsEstimate != null ? ` · EPS예상:${earnings.epsEstimate}` : "")
    );
  });
  return lines.length
    ? `다음은 사이트 스냅샷/프록시 기준 종목 데이터입니다(실시간 투자 조언 아님, 참고용):\n${lines.join("\n")}`
    : "";
}

function renderEarningsCalendar(item) {
  const box = byId("stockEarnings");
  if (!box) return;
  if (item.sector === "EXCHANGE TRADED FUNDS") {
    box.innerHTML = "";
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const f = item.fundamentals || {};
  const live = item.liveEarnings || {};
  const nextDate = live.nextDate || f.earningsDate || f.nextEarningsDate || item.earningsDate || null;
  const epsEstimate = live.epsEstimate ?? f.epsNextQ ?? null;
  const history = normalizeEarningsHistory(item).slice(-4).reverse();
  const daysUntil = nextDate ? Math.ceil((new Date(nextDate) - snapshotBaseDate()) / 86400000) : null;

  box.innerHTML = `
    <div class="earnings-inline-head">
      <strong>일정 · 컨센서스</strong>
      <span>${escapeHtml(item.ticker)}</span>
    </div>
    <div class="earnings-summary">
      <article class="earnings-upcoming">
        <span>다음 실적 발표</span>
        <strong>${nextDate ? escapeHtml(String(nextDate)) : "데이터 없음"}</strong>
        <p>${nextDate && Number.isFinite(daysUntil) ? (daysUntil >= 0 ? `약 ${daysUntil}일 후` : `${Math.abs(daysUntil)}일 지남`) : "Yahoo Finance에서 일정을 가져오면 자동 표시됩니다."}</p>
      </article>
      <article class="earnings-upcoming">
        <span>EPS 컨센서스</span>
        <strong>${epsEstimate != null ? moneyOrDash(epsEstimate) : "—"}</strong>
        <p>${f.epsNextY != null ? `연간 EPS 예상 ${moneyOrDash(f.epsNextY)}` : "Nasdaq/야후 데이터가 있으면 함께 표시됩니다."}</p>
      </article>
    </div>
    ${history.length ? `
      <details class="earnings-inline-history">
        <summary>최근 분기 EPS 기록 <span>${history.length}개 분기</span></summary>
        <div class="table-wrap compact-table-wrap">
        <table class="compact-table earnings-table">
          <thead>
            <tr>
              <th>분기</th>
              <th>실제 EPS</th>
              <th>예상 EPS</th>
              <th>서프라이즈</th>
            </tr>
          </thead>
          <tbody>
            ${history.map((row) => `
              <tr>
                <td>${escapeHtml(row.date || "—")}</td>
                <td>${row.epsActual != null ? moneyOrDash(row.epsActual) : "—"}</td>
                <td>${row.epsEstimate != null ? moneyOrDash(row.epsEstimate) : "—"}</td>
                <td class="${cls(earningsSurprisePct(row) || 0)}">${earningsSurprisePct(row) == null ? "—" : fmtPct(earningsSurprisePct(row))}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        </div>
      </details>
    ` : `<p class="muted earnings-empty">최근 분기 실적 히스토리는 프록시 연결 후 자동으로 채워집니다.</p>`}
  `;
}

function earningsSurprisePct(row) {
  const actual = Number(row?.epsActual);
  const estimate = Number(row?.epsEstimate);
  if (!Number.isFinite(actual) || !Number.isFinite(estimate) || estimate === 0) return null;
  return ((actual - estimate) / Math.abs(estimate)) * 100;
}

function communityPostsForTicker(ticker) {
  const t = String(ticker || "").toUpperCase();
  return communityPostsCache
    .filter((post) => post.ticker === t)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function stockEventCommunityCardHtml(item) {
  const loading = Boolean(communityFetchPromise) && !communityPostsCache.length;
  const posts = communityPostsForTicker(item.ticker);
  const count = posts.length;
  const previews = posts.slice(0, 2);
  const previewHtml = loading
    ? `<p class="event-community-empty">커뮤니티 글을 불러오는 중…</p>`
    : previews.length
      ? `<div class="event-community-previews">${previews.map((post) => `
          <div class="event-community-preview">
            <div class="event-community-preview-meta">
              <span>${escapeHtml(post.author || "익명")}</span>
              <time>${escapeHtml(formatCommunityTime(post.createdAt))}</time>
            </div>
            <p class="event-community-preview-body">${escapeHtml(post.content)}</p>
          </div>
        `).join("")}</div>`
      : `<p class="event-community-empty">${escapeHtml(item.ticker)} 관련 의견이 아직 없습니다. 첫 의견을 남겨보세요.</p>`;
  const ctaLabel = `${count}개의 의견 보기`;
  return `
    <article class="event-card event-card-community event-info">
      <span>Community</span>
      <strong>커뮤니티</strong>
      <b>${loading ? "불러오는 중…" : (count ? `${count}개 의견` : "의견 없음")}</b>
      ${previewHtml}
      <div class="event-community-actions">
        <button type="button" class="event-action event-community-cta" data-community-board="${escapeHtml(item.ticker)}">${escapeHtml(ctaLabel)}</button>
        <button type="button" class="event-action event-community-write" data-community-write="${escapeHtml(item.ticker)}">✏️ 글쓰기</button>
      </div>
    </article>
  `;
}

function openCommunityBoardForTicker(ticker) {
  if (!ticker) return;
  applyCommunityBoardTickerFilter(ticker);
  activateTab("community", { push: true, sub: "board", communityTicker: ticker });
}

// 분석 페이지 → 해당 종목으로 바로 글쓰기(작성칸에 티커 채우고 포커스).
function openCommunityComposeForTicker(ticker) {
  activateTab("community", { push: true, sub: "board" });
  const tickerInput = byId("communityTicker");
  if (tickerInput) tickerInput.value = ticker || "";
  setTimeout(() => {
    byId("communityCompose")?.scrollIntoView({ behavior: "smooth", block: "center" });
    byId("communityContent")?.focus();
  }, 140);
}

function renderStockEvents(item) {
  const box = byId("stockEvents");
  if (!box) return;
  const events = stockEventRows(item);
  const earningsEvent = events.find((event) => event.type === "Earnings");
  const restEvents = events.filter((event) => event.type !== "Earnings");
  box.innerHTML = `
    <div class="event-head">
      <div>
        <h3>종목 이벤트</h3>
        <p class="muted">실적, 옵션 만기, 컨센서스 목표가, 뉴스, 가격 변동, 커뮤니티 의견을 한곳에 모았습니다.</p>
      </div>
      <span class="event-badge">${escapeHtml(item.ticker)}</span>
    </div>
    <div class="event-grid">
      ${earningsEvent ? eventCardHtml(earningsEvent) : ""}
      <section class="smart-money-card event-card-smart" id="stockSmartMoney"></section>
      ${restEvents.map(eventCardHtml).join("")}
      ${stockEventCommunityCardHtml(item)}
    </div>
    ${moveAnalysisHtml(item, events.find((event) => event.type === "Move")?.move || null)}
  `;
  renderEarningsCalendar(item);
  renderEarningsReaction(item);
  renderSmartMoney(item);
}

function stockEventRows(item) {
  const f = item.fundamentals || {};
  const rows = getChartRows(item);
  const latestNews = Array.isArray(item.news) ? item.news[0] : null;
  const target = Number(f.targetPrice);
  const price = Number(item.price || f.prevClose);
  const targetUpside = Number.isFinite(target) && Number.isFinite(price) && price ? pctFrom(target, price) : null;
  const bigMove = recentBigMove(rows);
  const earningsDate = item.liveEarnings?.nextDate || f.earningsDate || f.nextEarningsDate || item.earningsDate || null;
  const dividend = f.dividendRate || f.dividendYield || item.dividendYield || null;
  return [
    {
      type: "Earnings",
      title: earningsDate ? "다음 실적 발표" : "실적 일정",
      value: earningsDate ? String(earningsDate) : "데이터 없음",
      note: f.epsNextQ != null ? `EPS next Q ${moneyOrDash(f.epsNextQ)} · EPS next Y ${moneyOrDash(f.epsNextY)}` : "상세 데이터에 실적 날짜가 없으면 표시하지 않습니다.",
      tone: earningsDate ? "info" : "muted"
    },
    {
      type: "Options",
      title: "월간 옵션 만기",
      value: nextMonthlyOptionsExpiration(),
      note: "미국 주식 옵션의 일반적인 월간 만기 기준입니다. 개별 옵션 체인은 별도 데이터가 필요합니다.",
      tone: "info"
    },
    {
      type: "Target",
      title: "Nasdaq 1Y 컨센서스 목표가",
      value: Number.isFinite(target) ? priceOrDash(target) : "데이터 없음",
      note: targetUpside == null ? "Nasdaq 제공 목표가 데이터 없음" : `현재가 대비 ${fmtPct(targetUpside)} · Nasdaq 제공 집계값`,
      tone: targetUpside == null ? "muted" : cls(targetUpside)
    },
    {
      type: "Dividend",
      title: "배당 정보",
      value: dividend ? String(dividend) : "해당 없음/데이터 없음",
      note: f.dividendExDate ? `배당락 ${f.dividendExDate}` : "배당락일 데이터가 있으면 여기에 표시됩니다.",
      tone: dividend ? "info" : "muted"
    },
    {
      type: "News",
      title: "최근 뉴스",
      value: latestNews?.publishedAt || "데이터 없음",
      note: latestNews?.title || "뉴스 데이터가 있으면 최신 제목을 표시합니다.",
      tone: latestNews ? "info" : "muted"
    },
    {
      type: "Move",
      title: "최근 가격 이벤트",
      value: bigMove ? `${bigMove.date} · ${fmtPct(bigMove.change)}` : "데이터 없음",
      note: bigMove ? "최근 45거래일 중 절대 변동폭이 가장 컸던 날입니다." : "차트 데이터가 부족합니다.",
      tone: bigMove ? cls(bigMove.change) : "muted",
      move: bigMove,
      action: bigMove ? `<button type="button" class="event-action" data-move-analysis="${escapeHtml(bigMove.date)}">원인 분석</button>` : ""
    }
  ];
}

function eventCardHtml(event) {
  if (event.type === "Earnings") {
    return `
      <article class="event-card event-${escapeHtml(event.tone)} event-card-earnings">
        <div class="earnings-card-title">
          <span>EARNINGS</span>
          <strong>실적 일정과 발표 반응</strong>
        </div>
        <div id="stockEarnings" class="earnings-inline-calendar"></div>
        <div id="earningsReaction" class="earnings-inline-reaction-host"></div>
      </article>`;
  }
  return `
    <article class="event-card event-${escapeHtml(event.tone)}">
      <span>${escapeHtml(event.type)}</span>
      <strong>${escapeHtml(event.title)}</strong>
      <b>${escapeHtml(event.value)}</b>
      <p>${escapeHtml(event.note)}</p>
      ${event.action || ""}
    </article>
  `;
}

function recentBigMove(rows) {
  if (!rows || rows.length < 3) return null;
  return rows.slice(-45).map((row, index, arr) => {
    const prev = index ? arr[index - 1] : rows[Math.max(0, rows.length - arr.length - 1)];
    return { date: row.d || "-", change: pctFrom(row.c, prev?.c || row.o) };
  }).filter((row) => Number.isFinite(row.change))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))[0] || null;
}

function dateDistanceDays(a, b) {
  const da = new Date(`${a}T00:00:00`);
  const db = new Date(`${b}T00:00:00`);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return Infinity;
  return Math.abs((da - db) / 86400000);
}

function volumeContext(rows, date) {
  const idx = rows.findIndex((row) => row.d === date);
  if (idx < 0) return null;
  const start = Math.max(0, idx - 20);
  const sample = rows.slice(start, idx).map((row) => Number(row.v || 0)).filter(Boolean);
  if (!sample.length || !rows[idx].v) return null;
  const avg = sample.reduce((sum, value) => sum + value, 0) / sample.length;
  return avg ? rows[idx].v / avg : null;
}

function localMoveAnalysis(item, move) {
  if (!move) return "";
  const rows = getChartRows(item);
  const relatedNews = (item.news || [])
    .filter((news) => news.publishedAt && dateDistanceDays(news.publishedAt, move.date) <= 2)
    .slice(0, 3);
  const volumeRatio = volumeContext(rows, move.date);
  const direction = move.change > 0 ? "상승" : "하락";
  const newsText = relatedNews.length
    ? `해당 날짜 전후 저장 뉴스 ${relatedNews.length}건이 있습니다: ${relatedNews.map((news) => news.title).join(" / ")}`
    : "저장된 뉴스 중 해당 날짜 전후 2일 안에 직접 연결되는 제목은 없습니다.";
  const volText = volumeRatio == null
    ? "거래량 비교 데이터는 부족합니다."
    : `거래량은 직전 20거래일 평균의 약 ${volumeRatio.toFixed(1)}배였습니다.`;
  return `${move.date}에는 종가 기준 ${fmtPct(move.change)} ${direction}했습니다. ${volText} ${newsText} 저장된 뉴스와 가격 데이터 기준의 보조 분석입니다.`;
}

function moveAnalysisHtml(item, move) {
  if (!move || !moveAnalysisState || moveAnalysisState.ticker !== item.ticker || moveAnalysisState.date !== move.date) return "";
  const isLoading = moveAnalysisState.status === "loading";
  const isError = moveAnalysisState.status === "error";
  const text = isLoading ? "해당 날짜 전후의 과거 뉴스와 SPY·QQQ 시장 흐름을 검색하고 있습니다." : (moveAnalysisState.text || localMoveAnalysis(item, move));
  const sources = Array.isArray(moveAnalysisState.sources) ? moveAnalysisState.sources : [];
  const sourceHtml = !isLoading && sources.length ? `
    <div class="move-analysis-sources">
      <b>분석 근거</b>
      ${sources.slice(0, 5).map((source) => {
        const href = /^https?:\/\//i.test(source.link || "") ? source.link : "#";
        return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"><span>${escapeHtml(source.publisher || source.provider || "뉴스")}</span>${escapeHtml(source.publishedAt || "")} · ${escapeHtml(source.title || "원문 보기")}</a>`;
      }).join("")}
    </div>` : "";
  const confidenceHtml = !isLoading && moveAnalysisState.confidence
    ? `<span class="move-confidence confidence-${moveAnalysisState.confidence === "높음" ? "high" : moveAnalysisState.confidence === "보통" ? "medium" : "low"}">근거 신뢰도 ${escapeHtml(moveAnalysisState.confidence)}</span>`
    : "";
  const note = isLoading
    ? "분석 중입니다. 잠시만 기다려주세요."
    : isError
      ? "날짜 기준 뉴스를 충분히 찾지 못했거나 AI 분석을 불러오지 못해 저장 데이터 기준으로 표시했습니다."
      : `이벤트 날짜 전후 ${moveAnalysisState.searchWindowDays || 2}일 뉴스와 시장 흐름을 함께 비교했습니다.`;
  return `
    <div class="move-analysis-box ${isLoading ? "is-loading" : ""}">
      <div class="move-analysis-title">
        <strong>${escapeHtml(item.ticker)} ${escapeHtml(move.date)} 원인 분석</strong>
        ${confidenceHtml}
      </div>
      <p>${escapeHtml(text)}</p>
      ${sourceHtml}
      <span class="muted">${escapeHtml(note)}</span>
    </div>
  `;
}

async function runMoveAnalysis(date) {
  const base = data.stocks.find((row) => row.ticker === selectedTicker);
  if (!base) return;
  const item = applyLive(withDetail(base));
  const move = recentBigMove(getChartRows(item));
  if (!move || move.date !== date) return;
  moveAnalysisState = {
    ticker: item.ticker,
    date,
    status: "loading",
    text: ""
  };
  renderStockEvents(item);
  if (!LIVE_DATA_PROXY) {
    moveAnalysisState = { ticker: item.ticker, date, status: "error", text: localMoveAnalysis(item, move) };
    renderStockEvents(item);
    return;
  }
  try {
    const baseUrl = LIVE_DATA_PROXY.replace(/\/$/, "");
    const endpoint = `${baseUrl}/?ticker=${encodeURIComponent(item.ticker)}&company=${encodeURIComponent(item.company || item.ticker)}&move_analysis=1&date=${encodeURIComponent(date)}&change=${encodeURIComponent(move.change)}`;
    const response = await fetch(endpoint, { cache: "no-store" });
    const payload = response.ok ? await response.json() : null;
    const hasAnalysis = typeof payload?.analysis === "string" && Boolean(payload.analysis.trim());
    const text = hasAnalysis ? payload.analysis.trim() : localMoveAnalysis(item, move);
    moveAnalysisState = {
      ticker: item.ticker,
      date,
      status: hasAnalysis ? "done" : "error",
      text,
      confidence: payload?.confidence || "",
      sources: Array.isArray(payload?.sources) ? payload.sources : [],
      newsProviders: Array.isArray(payload?.newsProviders) ? payload.newsProviders : [],
      searchWindowDays: Number(payload?.searchWindowDays || 0),
      marketContext: payload?.marketContext || null
    };
  } catch (error) {
    console.warn("move analysis failed", error);
    moveAnalysisState = { ticker: item.ticker, date, status: "error", text: localMoveAnalysis(item, move) };
  }
  if (selectedTicker !== item.ticker) return;
  const refreshedBase = data.stocks.find((row) => row.ticker === item.ticker) || base;
  renderStockEvents(applyLive(withDetail(refreshedBase)));
}

function normalizeEarningsHistory(item) {
  const f = item.fundamentals || {};
  const live = item.liveEarnings || {};
  const raw = live.history || live.quarters || item.earningsHistory || f.earningsHistory || f.quarterlyEarnings || [];
  return (Array.isArray(raw) ? raw : []).map((row) => {
    let date = row.date || row.reportDate || row.earningsDate || row.period || row.fiscalDateEnding;
    if (!date && row.quarter) {
      const q = String(row.quarter);
      if (/^\d{4}-\d{2}-\d{2}/.test(q)) date = q.slice(0, 10);
    }
    return {
      date: date ? String(date).slice(0, 10) : "",
      epsActual: row.epsActual ?? row.actual ?? row.reportedEPS ?? row.eps,
      epsEstimate: row.epsEstimate ?? row.estimate ?? row.estimatedEPS,
      revenue: row.revenue ?? row.sales
    };
  }).filter((row) => row.date);
}

function nearestTradingIndex(rows, date) {
  const target = new Date(`${date}T00:00:00`).getTime();
  if (!Number.isFinite(target)) return -1;
  let best = -1;
  let bestDist = Infinity;
  rows.forEach((row, index) => {
    const t = new Date(`${row.d}T00:00:00`).getTime();
    const dist = Math.abs(t - target);
    if (dist < bestDist) {
      best = index;
      bestDist = dist;
    }
  });
  return best;
}

function earningsReactionRows(item) {
  const rows = getChartRows(item);
  const history = normalizeEarningsHistory(item);
  if (rows.length < 30 || !history.length) return [];
  return history.slice(-8).reverse().map((event) => {
    const idx = nearestTradingIndex(rows, event.date);
    if (idx < 0) return null;
    const before = rows[Math.max(0, idx - 5)];
    const eventRow = rows[idx];
    const after = rows[Math.min(rows.length - 1, idx + 5)];
    const oneDay = idx > 0 ? pctFrom(eventRow.c, rows[idx - 1].c) : null;
    const pre5 = before ? pctFrom(eventRow.c, before.c) : null;
    const post5 = after ? pctFrom(after.c, eventRow.c) : null;
    const surprise = event.epsActual != null && event.epsEstimate != null && Number(event.epsEstimate)
      ? ((Number(event.epsActual) - Number(event.epsEstimate)) / Math.abs(Number(event.epsEstimate))) * 100
      : null;
    return { ...event, tradingDate: eventRow.d, oneDay, pre5, post5, surprise };
  }).filter(Boolean);
}

function renderEarningsReaction(item) {
  const box = byId("earningsReaction");
  if (!box || !item) return;
  const rows = earningsReactionRows(item);
  box.innerHTML = `
    ${rows.length ? `
      <details class="earnings-inline-reaction">
        <summary>실적 발표 전후 주가 반응 <span>최근 ${Math.min(rows.length, 4)}회</span></summary>
        <div class="table-wrap">
        <table class="compact-table earnings-reaction-table">
          <thead><tr><th>발표일</th><th>거래일</th><th>EPS 서프라이즈</th><th>-5D→발표</th><th>발표일</th><th>발표→+5D</th></tr></thead>
          <tbody>
            ${rows.slice(0, 4).map((row) => `
              <tr>
                <td>${escapeHtml(row.date)}</td>
                <td>${escapeHtml(row.tradingDate)}</td>
                <td class="${cls(row.surprise || 0)}">${row.surprise == null ? "-" : fmtPct(row.surprise)}</td>
                <td class="${cls(row.pre5 || 0)}">${row.pre5 == null ? "-" : fmtPct(row.pre5)}</td>
                <td class="${cls(row.oneDay || 0)}">${row.oneDay == null ? "-" : fmtPct(row.oneDay)}</td>
                <td class="${cls(row.post5 || 0)}">${row.post5 == null ? "-" : fmtPct(row.post5)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        </div>
      </details>
    ` : `<p class="muted earnings-reaction-empty">실적 발표 반응을 계산할 가격·실적 히스토리가 부족합니다.</p>`}
  `;
}

function nextMonthlyOptionsExpiration(base = snapshotBaseDate()) {
  const thirdFriday = (year, month) => {
    const d = new Date(year, month, 1);
    const firstFriday = 1 + ((5 - d.getDay() + 7) % 7);
    return new Date(year, month, firstFriday + 14);
  };
  let exp = thirdFriday(base.getFullYear(), base.getMonth());
  if (exp < base) exp = thirdFriday(base.getFullYear(), base.getMonth() + 1);
  return `${exp.getFullYear()}-${String(exp.getMonth() + 1).padStart(2, "0")}-${String(exp.getDate()).padStart(2, "0")}`;
}

function sourceLabel(source) {
  const src = String(source || "").toLowerCase();
  if (!src) return "데이터 없음";
  if (src.includes("nasdaq") && src.includes("sec") && src.includes("yahoo")) return "Nasdaq + SEC + Yahoo";
  if (src.includes("nasdaq") && src.includes("sec")) return "Nasdaq + SEC";
  if (src.includes("nasdaq")) return "Nasdaq";
  if (src.includes("yahoo")) return "Yahoo Finance";
  if (src.includes("sec")) return "SEC EDGAR";
  if (src.includes("snapshot")) return "스냅샷 생성값";
  return source;
}

function missingFundamentalFields(f) {
  const fields = [
    ["pe", "PER"],
    ["forwardPE", "Forward PER"],
    ["epsTtm", "EPS TTM"],
    ["epsNextY", "EPS Next Y"],
    ["salesB", "Sales"],
    ["incomeB", "Income"],
    ["roe", "ROE"],
    ["targetPrice", "1Y Target"]
  ];
  return fields.filter(([key]) => f[key] == null || f[key] === "").map(([, label]) => label);
}

function renderDataQualityPanel(item) {
  const box = byId("dataQualityPanel");
  if (!box || !item) return;
  const f = item.fundamentals || {};
  const hasDetail = Boolean(detailCache[safeTicker(item.ticker)] || item.chartSeries || Object.keys(f).length);
  const missing = missingFundamentalFields(f);
  const chartRows = getChartRows(item);
  const source = sourceLabel(f.source);
  const history = sourceLabel(item.historySource);
  const detailStatus = hasDetail ? "상세 데이터 로드됨" : "상세 데이터 로딩 전/없음";
  const quality = missing.length <= 2 && chartRows.length > 240 ? "good" : missing.length <= 5 ? "warn" : "muted";
  const toneText = quality === "good" ? "양호" : quality === "warn" ? "일부 누락" : "제한적";
  box.innerHTML = `
    <div class="quality-head">
      <div>
        <h3>데이터 품질 / 출처</h3>
        <p class="muted">가격·재무·뉴스가 어디서 왔고 무엇이 비어 있는지 먼저 확인합니다.</p>
      </div>
      <span class="quality-badge quality-${quality}">${toneText}</span>
    </div>
    <div class="quality-grid">
      <article><span>스냅샷 기준</span><strong>${escapeHtml(data.updatedAtKst || data.updated_at_kst || "-")}</strong></article>
      <article><span>가격 이력</span><strong>${escapeHtml(history)}</strong><em>${chartRows.length ? `${chartRows.length} bars` : "차트 없음"}</em></article>
      <article><span>재무 데이터</span><strong>${escapeHtml(source)}</strong><em>${Object.keys(f).length ? `${Object.keys(f).length} fields` : "없음"}</em></article>
      <article><span>뉴스</span><strong>${Array.isArray(item.news) && item.news.length ? `${item.news.length}건` : "없음"}</strong><em>${detailStatus}</em></article>
    </div>
    <p class="quality-note">
      ${missing.length ? `누락 지표: ${escapeHtml(missing.slice(0, 6).join(", "))}${missing.length > 6 ? " 외" : ""}` : "핵심 재무 지표가 대부분 채워져 있습니다."}
    </p>
  `;
}

function parseSnapshotDate(raw) {
  const text = String(raw || "").replace(" KST", "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}))?/);
  if (!match) return null;
  const [, y, m, d, hh = "0", mm = "0"] = match;
  return new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm));
}

function renderDataFreshnessStatus() {
  const box = byId("aiDataStatus");
  if (!box) return;
  const raw = data.updatedAtKst || data.updated_at_kst || "";
  const snap = parseSnapshotDate(raw);
  const ageHours = snap ? Math.max(0, (Date.now() - snap.getTime()) / 36e5) : null;
  const stale = ageHours != null && ageHours > 30;
  const aiKeys = Object.keys(data.ai_briefing || {});
  const social = data.social_sentiment || {};
  const socialCount = Object.values(social).reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0);
  box.classList.toggle("is-stale", stale);
  box.innerHTML = `
    <strong>데이터 상태</strong>
    <span>스냅샷 ${escapeHtml(raw || "-")} · AI 브리핑 ${aiKeys.length}종 · 소셜 트렌딩 ${socialCount}개</span>
    <span>${stale ? "스냅샷이 30시간 이상 지나 오래된 데이터일 수 있습니다." : "주식 데이터는 하루 1회 스냅샷이며, AI/소셜 블록은 별도 생성기가 채운 값을 표시합니다."}</span>
  `;
}

function renderFundamentals(item) {
  // ETFs don't need fundamentals — show their constituent stocks (by RS) instead.
  if (item.sector === "EXCHANGE TRADED FUNDS") {
    renderEtfConstituents(item);
    return;
  }
  const f = item.fundamentals || {};
  const detailMode = data.detailPolicy?.mode === "split";
  const hasFundamentals = Object.keys(f).length > 0;
  const rows = [
    ["Index", indexLabel(item), "P/E", fmtMultiple(f.pe), "EPS TTM", moneyOrDash(f.epsTtm), "Perf Week", fmtPct(item.weekChangePct)],
    ["Market Cap", fmtBillions(f.marketCapB || item.marketCapB), "Forward P/E", fmtMultiple(f.forwardPE), "EPS Next Y", moneyOrDash(f.epsNextY), "Perf Month", fmtPct(item.monthChangePct)],
    ["Sales", fmtBillions(f.salesB), "P/S", fmtMultiple(f.ps), "EPS Next Q", moneyOrDash(f.epsNextQ), "Perf Quarter", fmtPct(item.threeMonthChangePct)],
    ["Income", fmtBillions(f.incomeB), "P/B", fmtMultiple(f.pb), "Gross Margin", fmtPercent(f.grossMargin), "Perf YTD", fmtPct(item.ytdChangePct)],
    ["Cash", fmtBillions(f.cashB), "Debt/Eq", fmtNum(f.debtEq), "Oper Margin", fmtPercent(f.operMargin), "52W High", priceOrDash(f.week52High)],
    ["Shares Out", fmtBillions(f.sharesB), "Current Ratio", fmtRatio(f.currentRatio), "Profit Margin", fmtPercent(f.profitMargin), "52W Low", priceOrDash(f.week52Low)],
    ["Avg Volume", fmtCompact(f.avgVolume), "Quick Ratio", fmtRatio(f.quickRatio), "ROE", fmtPercent(f.roe), "Nasdaq 1Y Target", priceOrDash(f.targetPrice)],
    ["Volume", fmtCompact(f.volume), "Prev Close", priceOrDash(f.prevClose), "RS Score", item.rsScore, "Price", priceOrDash(item.price)]
  ];
  byId("fundamentalTable").innerHTML = `
    <div class="fundamental-head">
      <h3>Fundamentals</h3>
      <span>${hasFundamentals ? (f.source === "yahoo" ? "Yahoo Finance · Nasdaq/SEC 보완" : f.source === "sec" ? "SEC EDGAR · 분기 재무 공시" : f.source === "nasdaq+sec" || f.source === "nasdaq+sec+yahoo" ? "Nasdaq + SEC + Yahoo · NYSE 등 전 거래소" : "Nasdaq + SEC/Yahoo 스냅샷") : (detailMode ? "상세 데이터를 불러오는 중이거나 해당 종목 상세값이 없습니다." : "일부 지표는 다음 스냅샷 갱신 후 표시됩니다.")}</span>
    </div>
    <div class="fund-scroll">
      <table>
        <tbody>
          ${rows.map((row) => `
            <tr>
              ${metricPair(row[0], row[1])}
              ${metricPair(row[2], row[3])}
              ${metricPair(row[4], row[5])}
              ${metricPair(row[6], row[7])}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

// Resolve an ETF's constituent stocks (best available), as {name, list}.
function etfConstituentStocks(ticker) {
  const rows = data.health?.etfRelative?.rows || [];
  const row = rows.find((r) => r.representative === ticker
    || (r.peers || []).some((p) => (p.ticker || p) === ticker));
  if (row && Array.isArray(row.stockLeaders) && row.stockLeaders.length) {
    return { name: row.category, list: row.stockLeaders.slice() };
  }
  const meta = SECTOR_ETFS.find((m) => m.ticker === ticker);
  if (meta) {
    return {
      name: meta.name,
      list: getSectorStocks(meta).map((s) => ({
        ticker: s.ticker, name: s.company, rsScore: s.rsScore,
        changePct: s.changePct, monthChangePct: s.monthChangePct
      }))
    };
  }
  return null;
}

function renderEtfConstituents(item) {
  const result = etfConstituentStocks(item.ticker);
  const head = `<div class="fundamental-head"><h3>구성 종목 (상대강도순)</h3><span>${result ? escapeHtml(result.name) : "ETF"}</span></div>`;
  const box = byId("fundamentalTable");
  if (!result || !result.list.length) {
    box.innerHTML = head + `<p class="muted" style="padding:12px;">이 ETF의 구성 종목 데이터가 없습니다.</p>`;
    return;
  }
  const list = result.list.slice().sort((a, b) => (b.rsScore || 0) - (a.rsScore || 0));
  box.innerHTML = head + `
    <div class="table-wrap">
      <table class="etf-constituents-table">
        <thead><tr><th>#</th><th>티커</th><th>회사명</th><th>RS</th><th>당일</th><th>1개월</th></tr></thead>
        <tbody>
          ${list.map((s, i) => `
            <tr class="etf-con-row" data-ticker="${escapeHtml(s.ticker)}" style="cursor:pointer;">
              <td class="rank-cell">${i + 1}</td>
              <td><strong>${escapeHtml(s.ticker)}</strong></td>
              <td>${escapeHtml(s.name || "")}</td>
              <td><span class="rs-badge">${Math.round(s.rsScore || 0)}</span></td>
              <td class="${cls(s.changePct)}">${s.changePct != null ? fmtPct(s.changePct) : "-"}</td>
              <td class="${cls(s.monthChangePct)}">${s.monthChangePct != null ? fmtPct(s.monthChangePct) : "-"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
  box.querySelectorAll(".etf-con-row").forEach((tr) => {
    tr.addEventListener("click", () => selectTicker(tr.dataset.ticker, { openSearch: true }));
  });
}

function metricPair(label, value) {
  return `<th>${escapeHtml(label)}</th><td>${valueWithClass(value)}</td>`;
}

function valueWithClass(value) {
  const text = String(value ?? "-");
  const numeric = Number(text.replace(/[$,%MBK]/g, ""));
  const className = text.startsWith("+") ? "pos" : text.startsWith("-") ? "neg" : "";
  return `<strong class="${className}">${escapeHtml(text)}</strong>`;
}

function indexLabel(item) {
  const groups = item.groups || [];
  const labels = [];
  if (groups.includes("idx_ndx100")) labels.push("Nasdaq 100");
  if (groups.includes("idx_sp500")) labels.push("S&P 500");
  if (groups.includes("idx_nasdaq")) labels.push("Nasdaq");
  if (groups.includes("idx_nyse")) labels.push("NYSE");
  return labels.slice(0, 2).join(", ") || "-";
}

function fmtNum(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(2) : "-";
}

function fmtMultiple(value, digits = 2) {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(digits)}배` : "-";
}

function moneyOrDash(value) {
  return Number.isFinite(Number(value)) ? `$${Number(value).toFixed(2)}` : "-";
}

function priceOrDash(value) {
  return Number.isFinite(Number(value)) ? `$${Number(value).toFixed(2)}` : "-";
}

function fmtRatio(value) {
  return Number.isFinite(Number(value)) ? (Number(value) / 100).toFixed(2) : "-";
}

function fmtPercent(value) {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(2)}%` : "-";
}

function fmtBillions(value) {
  if (!Number.isFinite(Number(value))) return "-";
  const num = Number(value);
  if (Math.abs(num) >= 1000) return `${(num / 1000).toFixed(2)}T`;
  if (Math.abs(num) >= 1) return `${num.toFixed(2)}B`;
  return `${(num * 1000).toFixed(0)}M`;
}

function fmtCompact(value) {
  if (!Number.isFinite(Number(value))) return "-";
  const num = Number(value);
  if (Math.abs(num) >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return `${num.toFixed(0)}`;
}

// ===== 가상 포트폴리오 시뮬레이터 (#24) =====
const PORTFOLIO_KEY = "mir_portfolio_v1";
let portfolio = [];
const PIE_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#64748b", "#14b8a6", "#eab308"];

function loadPortfolio() {
  try {
    const saved = JSON.parse(localStorage.getItem(PORTFOLIO_KEY));
    portfolio = Array.isArray(saved) ? saved.filter((p) => p && p.ticker) : [];
  } catch (e) { portfolio = []; }
}
function savePortfolio() {
  try { localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(portfolio)); } catch (e) { /* ignore */ }
}

function setupPortfolio() {
  const add = byId("pfAdd");
  if (add && !add.dataset.bound) {
    add.dataset.bound = "1";
    const doAdd = () => {
      const t = resolveCommunityTickerInput(byId("pfTicker").value) || String(byId("pfTicker").value || "").trim().toUpperCase();
      const qty = Number(byId("pfQty").value);
      const cost = Number(byId("pfCost").value);
      if (!t || !stockByTicker(t) || !(qty > 0) || !(cost > 0)) { return; }
      const existing = portfolio.find((p) => p.ticker === t);
      if (existing) { existing.qty = qty; existing.avgCost = cost; }
      else portfolio.push({ ticker: t, qty, avgCost: cost });
      savePortfolio();
      byId("pfTicker").value = ""; byId("pfQty").value = ""; byId("pfCost").value = "";
      renderPortfolio();
    };
    add.addEventListener("click", doAdd);
    byId("pfClear")?.addEventListener("click", () => { portfolio = []; savePortfolio(); renderPortfolio(); });
    ["pfTicker", "pfQty", "pfCost"].forEach((id) => byId(id)?.addEventListener("keydown", (e) => { if (e.key === "Enter") doAdd(); }));
  }
}

function donutSvg(slices) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const r = 52, cx = 60, cy = 60, sw = 22;
  const C = 2 * Math.PI * r;
  let acc = 0;
  const segs = slices.map((s, i) => {
    const frac = s.value / total;
    const dash = `${(frac * C).toFixed(2)} ${(C - frac * C).toFixed(2)}`;
    const off = (-acc * C).toFixed(2);
    acc += frac;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${PIE_COLORS[i % PIE_COLORS.length]}" stroke-width="${sw}" stroke-dasharray="${dash}" stroke-dashoffset="${off}" transform="rotate(-90 ${cx} ${cy})"></circle>`;
  }).join("");
  return `<svg viewBox="0 0 120 120" class="pf-donut">${segs}</svg>`;
}

function renderPortfolio() {
  setupPortfolio();
  const summaryEl = byId("pfSummary");
  const tableEl = byId("pfTable");
  const pieEl = byId("pfPie");
  if (!tableEl) return;
  if (!portfolio.length) {
    if (summaryEl) summaryEl.innerHTML = "";
    tableEl.innerHTML = `<p class="muted">보유 종목을 추가하면 손익과 섹터 분산이 표시됩니다.</p>`;
    if (pieEl) pieEl.innerHTML = "";
    return;
  }
  const rows = portfolio.map((p) => {
    const stock = stockByTicker(p.ticker);
    const price = stock ? Number(stock.price) : 0;
    const value = p.qty * price;
    const cost = p.qty * p.avgCost;
    const pl = value - cost;
    const plPct = cost > 0 ? (pl / cost) * 100 : 0;
    return { ...p, stock, price, value, cost, pl, plPct, sector: stock?.sector || "기타", changePct: Number(stock?.changePct) || 0 };
  });
  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalPL = totalValue - totalCost;
  const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
  // 일간 기여도 = Σ(비중 × 종목 당일등락률)
  const dayContribution = rows.reduce((s, r) => s + (totalValue > 0 ? (r.value / totalValue) * r.changePct : 0), 0);

  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="pf-stat"><span>평가금액</span><strong>$${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong></div>
      <div class="pf-stat"><span>투자원금</span><strong>$${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong></div>
      <div class="pf-stat"><span>평가손익</span><strong class="${cls(totalPL)}">${totalPL >= 0 ? "+" : ""}$${Math.abs(totalPL).toLocaleString(undefined, { maximumFractionDigits: 0 })} (${fmtPct(totalPLPct)})</strong></div>
      <div class="pf-stat"><span>오늘 기여도</span><strong class="${cls(dayContribution)}">${fmtPct(dayContribution)}</strong></div>`;
  }

  rows.sort((a, b) => b.value - a.value);
  const body = rows.map((r) => `<tr>
    <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.ticker)}">${escapeHtml(r.ticker)}</button></td>
    <td class="ins-num">${r.qty.toLocaleString()}</td>
    <td class="ins-num">$${r.avgCost.toFixed(2)}</td>
    <td class="ins-num">$${r.price.toFixed(2)}</td>
    <td class="ins-num">$${r.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
    <td class="ins-num">${totalValue > 0 ? (r.value / totalValue * 100).toFixed(1) : "0"}%</td>
    <td class="ins-num ${cls(r.pl)}">${fmtPct(r.plPct)}</td>
    <td class="ins-num"><button type="button" class="pf-del" data-ticker="${escapeHtml(r.ticker)}" title="삭제">✕</button></td>
  </tr>`).join("");
  tableEl.innerHTML = `<table class="insider-table"><thead><tr><th>종목</th><th class="ins-num">수량</th><th class="ins-num">평단</th><th class="ins-num">현재가</th><th class="ins-num">평가액</th><th class="ins-num">비중</th><th class="ins-num">손익</th><th></th></tr></thead><tbody>${body}</tbody></table>`;
  tableEl.querySelectorAll(".ins-ticker").forEach((b) => b.addEventListener("click", () => selectTicker(b.dataset.ticker, { openSearch: true })));
  tableEl.querySelectorAll(".pf-del").forEach((b) => b.addEventListener("click", () => {
    portfolio = portfolio.filter((p) => p.ticker !== b.dataset.ticker); savePortfolio(); renderPortfolio();
  }));

  // 섹터 분산 도넛
  if (pieEl) {
    const bySector = {};
    rows.forEach((r) => { bySector[r.sector] = (bySector[r.sector] || 0) + r.value; });
    const slices = Object.entries(bySector).map(([sector, value]) => ({ sector, value })).sort((a, b) => b.value - a.value);
    const legend = slices.map((s, i) => `<div class="pf-leg"><i style="background:${PIE_COLORS[i % PIE_COLORS.length]}"></i>${escapeHtml(s.sector)} <b>${(s.value / totalValue * 100).toFixed(0)}%</b></div>`).join("");
    pieEl.innerHTML = `<div class="pf-pie-title">섹터 분산</div>${donutSvg(slices)}<div class="pf-legend">${legend}</div>`;
  }
}

function renderBulk() {
  renderPortfolio();
  renderCorrelationMatrix();
  const minRs = Number(byId("bulkRs").value || 0);
  const input = byId("bulkInput");
  if (input && !input.value.trim()) input.value = watchlist.join(", ");
  const tickers = resolveTickerListInput(input.value);
  const rows = tickers
    .map((ticker) => stockByTicker(ticker))
    .filter(Boolean)
    .filter((item) => item.rsScore >= minRs);
  renderWatchlistStats(rows);
  byId("bulkTable").innerHTML = rows.length ? rows.map((item) => `
    <tr>
      <td>${watchStarButton(item.ticker)}</td>
      <td><button type="button" class="ticker-link" data-ticker="${escapeHtml(item.ticker)}">${escapeHtml(item.ticker)}</button></td>
      <td>${escapeHtml(item.company)}</td>
      <td>${escapeHtml(item.sector)}</td>
      <td class="${cls(item.changePct)}">${fmtPct(item.changePct)}</td>
      <td>${item.rsScore}</td>
      <td>${item.epsRevScore}</td>
      <td>${Number(item.volumeRatio || 0).toFixed(1)}x</td>
      <td>${signalFor(item)}</td>
    </tr>
  `).join("") : `<tr><td colspan="9" class="muted">관심종목을 추가하거나 티커를 입력하세요.</td></tr>`;
  byId("bulkTable").querySelectorAll(".ticker-link").forEach((btn) => {
    btn.addEventListener("click", () => selectTicker(btn.dataset.ticker, { openSearch: true }));
  });
}

function signalFor(item) {
  if (item.rsScore >= 85 && item.epsRevScore >= 75 && item.changePct > 0) return "강한 상승 후보";
  if (item.rsScore >= 70 && item.changePct > 0) return "상승 추세";
  if (item.stochK < 30) return "과매도 관찰";
  return "중립";
}

// ===== 마켓 데이터 탭 (SeekingAlpha key_markets 스타일) =====
const MARKET_GROUPS = [
  { title: "주요 지수 · 자산", tickers: [
    ["SPY", "S&P 500"], ["QQQ", "Nasdaq 100"], ["DIA", "Dow Jones"], ["IWM", "Russell 2000"],
    ["TQQQ", "3x Nasdaq"], ["IBIT", "Bitcoin (IBIT)"], ["GLD", "Gold"], ["VIXY", "변동성 (VIX)"]
  ] },
  { title: "국가 · 지역", tickers: [
    ["EWY", "한국 (Korea)"], ["SPY", "미국 (US)"], ["EFA", "선진국 (EAFE)"], ["VEA", "선진국 (ex-US)"],
    ["EEM", "신흥국"], ["VWO", "신흥국 (Vanguard)"], ["FXI", "중국 대형주"], ["MCHI", "중국"],
    ["KWEB", "중국 인터넷"], ["EWJ", "일본"], ["DXJ", "일본 (환헤지)"], ["VGK", "유럽"], ["EZU", "유로존"],
    ["EWG", "독일"], ["EWU", "영국"], ["INDA", "인도"], ["EWZ", "브라질"], ["ILF", "중남미"],
    ["EWT", "대만"], ["EWC", "캐나다"], ["EWA", "호주"]
  ] },
  { title: "채권", tickers: [
    ["SHY", "미국채 1-3년"], ["IEF", "미국채 7-10년"], ["TLT", "미국채 20년+"], ["TIP", "물가연동채 (TIPS)"],
    ["LQD", "투자등급 회사채"], ["HYG", "하이일드"], ["MUB", "지방채"], ["AGG", "종합채권 (AGG)"], ["BND", "종합채권 (BND)"]
  ] },
  { title: "원자재", tickers: [
    ["GLD", "금"], ["SLV", "은"], ["USO", "WTI 원유"], ["UNG", "천연가스"], ["CPER", "구리"],
    ["URA", "우라늄"], ["DBA", "농산물"], ["WOOD", "목재"], ["DBC", "종합 원자재 (DBC)"],
    ["PDBC", "종합 원자재 (PDBC)"], ["GSG", "종합 원자재 (GSG)"]
  ] }
];

const ISSUER_TICKER_HINTS = {
  "APPLE INC": "AAPL",
  "AMAZON COM INC": "AMZN",
  "ALPHABET INC": "GOOGL",
  "MICROSOFT CORP": "MSFT",
  "META PLATFORMS INC": "META",
  "NVIDIA CORP": "NVDA",
  "TESLA INC": "TSLA",
  "BERKSHIRE HATHAWAY INC": "BRK.B",
  "JPMORGAN CHASE & CO": "JPM",
  "BANK AMERICA CORP": "BAC",
  "CHEVRON CORP NEW": "CVX",
  "CHEVRON CORPORATION": "CVX",
  "COCA COLA CO": "KO",
  "AMERICAN EXPRESS CO": "AXP",
  "WELLS FARGO & CO NEW": "WFC",
  "CITIGROUP INC": "C",
  "GOLDMAN SACHS GROUP INC": "GS",
  "MORGAN STANLEY": "MS",
  "VISA INC": "V",
  "MASTERCARD INC": "MA",
  "UNITEDHEALTH GROUP INC": "UNH",
  "JOHNSON & JOHNSON": "JNJ",
  "ELI LILLY & CO": "LLY",
  "PROCTER & GAMBLE CO": "PG",
  "COSTCO WHSL CORP NEW": "COST",
  "HOME DEPOT INC": "HD",
  "NETFLIX INC": "NFLX",
  "PALANTIR TECHNOLOGIES INC": "PLTR",
  "ADVANCED MICRO DEVICES INC": "AMD",
  "BROADCOM INC": "AVGO",
};

function normalizeIssuerName(name) {
  return String(name || "")
    .toUpperCase()
    .replace(/[.,]/g, "")
    .replace(/\s+(INC|CORP|CO|LTD|PLC|NEW|HLDGS|HOLDINGS|GROUP)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveIssuerTicker(issuer) {
  const upper = String(issuer || "").toUpperCase().trim();
  if (ISSUER_TICKER_HINTS[upper]) return ISSUER_TICKER_HINTS[upper];
  const norm = normalizeIssuerName(issuer);
  const byCompany = data.stocks.find((stock) => normalizeIssuerName(stock.company) === norm);
  if (byCompany) return byCompany.ticker;
  const first = norm.split(" ")[0];
  if (!first || first.length < 3) return null;
  const fuzzy = data.stocks.find((stock) => normalizeIssuerName(stock.company).startsWith(first));
  return fuzzy?.ticker || null;
}

function institutional13fData() {
  return window.INSTITUTIONAL_13F || { institutions: [] };
}

function institutionQuarterRows(inst) {
  if (Array.isArray(inst.quarters) && inst.quarters.length) return inst.quarters;
  if ((inst.holdings || []).length) {
    return [{
      reportDate: inst.reportDate,
      reportLabel: inst.reportDate,
      filedDate: inst.filedDate,
      accession: inst.accession,
      holdings: inst.holdings,
    }];
  }
  return [];
}

function holdingKey(row) {
  return `${row.issuer || ""}|${row.titleOfClass || ""}|${row.putCall || ""}`;
}

function holdingPositionMeta(row) {
  const pc = String(row?.putCall || "").toLowerCase();
  if (pc === "put") {
    return { badge: "PUT", label: "풋 옵션", cls: "is-put", hint: "하락 베팅 (주식 숏 아님)" };
  }
  if (pc === "call") {
    return { badge: "CALL", label: "콜 옵션", cls: "is-call", hint: "콜 옵션 보유" };
  }
  return { badge: "", label: "주식", cls: "is-stock", hint: "" };
}

function formatHoldingShares(row) {
  const shares = Number(row?.shares || 0);
  const pc = String(row?.putCall || "").toLowerCase();
  if (pc === "put" || pc === "call") {
    const contracts = Math.round(shares / 100);
    return `${contracts.toLocaleString()}계약 <span class="muted">(명목 ${shares.toLocaleString()}주)</span>`;
  }
  return shares.toLocaleString();
}

function resolveHoldingTicker(row) {
  const fromRow = String(row?.ticker || "").toUpperCase().trim();
  if (fromRow && stockByTicker(fromRow)) return fromRow;
  return resolveIssuerTicker(row?.issuer);
}

function holdingQuarterDelta(current, prior, row) {
  const key = holdingKey(row);
  const prev = (prior?.holdings || []).find((h) => holdingKey(h) === key);
  if (!prev) return { text: "신규", cls: "is-new" };
  const delta = Number(row.shares || 0) - Number(prev.shares || 0);
  if (!delta) return { text: "유지", cls: "is-flat" };
  const pct = prev.shares ? ((delta / prev.shares) * 100) : null;
  const sign = delta > 0 ? "+" : "";
  const pctText = pct != null ? ` (${sign}${pct.toFixed(1)}%)` : "";
  return {
    text: `${sign}${delta.toLocaleString()}${pctText}`,
    cls: delta > 0 ? "is-up" : "is-down",
  };
}

function setupInstitutionalUi() {
  if (institutionalUiReady) return;
  const search = byId("institutionalSearch");
  const select = byId("institutionalSelect");
  if (search) {
    search.addEventListener("input", () => {
      institutionalSearchQuery = search.value.trim().toLowerCase();
      renderInstitutional13f();
    });
  }
  if (select) {
    select.addEventListener("change", () => {
      selectedInstitutionId = select.value;
      selectedInstitutionQuarterIdx = 0;
      renderInstitutional13f();
    });
  }
  institutionalUiReady = true;
}

function renderInstitutional13f() {
  setupInstitutionalUi();
  render13fHighlights();
  const payload = institutional13fData();
  const institutions = (payload.institutions || []).filter((inst) => {
    if (inst.status !== "ok") return false;
    return institutionQuarterRows(inst).length > 0;
  });
  const meta = byId("institutionalMeta");
  const select = byId("institutionalSelect");
  const detail = byId("institutionalDetail");
  if (!meta || !detail) return;

  const schedule = payload.updateSchedule === "quarterly"
    ? "분기별 갱신 (13F 공시 주기)"
    : "스냅샷 갱신";
  meta.innerHTML = `
    <div class="institutional-meta-grid">
      <article><span>데이터 출처</span><strong>${escapeHtml(payload.source || "SEC EDGAR 13F-HR")}</strong></article>
      <article><span>갱신 주기</span><strong>${escapeHtml(schedule)}</strong></article>
      <article><span>마지막 빌드</span><strong>${escapeHtml(payload.updatedAtKst || "-")}</strong></article>
    </div>
    <p>${escapeHtml(payload.note || "")}</p>
  `;

  if (!institutions.length) {
    if (select) select.innerHTML = "";
    detail.innerHTML = `<p class="muted">13F 데이터를 불러오지 못했습니다. <code>python scripts/build_13f_snapshot.py</code> 실행 후 다시 시도하세요.</p>`;
    return;
  }

  const filtered = institutions.filter((inst) => {
    if (!institutionalSearchQuery) return true;
    const hay = `${inst.name} ${inst.manager || ""} ${inst.id}`.toLowerCase();
    return hay.includes(institutionalSearchQuery);
  });
  const list = filtered.length ? filtered : institutions;

  if (!list.some((inst) => inst.id === selectedInstitutionId)) {
    selectedInstitutionId = list[0].id;
    selectedInstitutionQuarterIdx = 0;
  }

  if (select) {
    const prev = select.value;
    select.innerHTML = list.map((inst) => {
      const q = institutionQuarterRows(inst)[0];
      const label = inst.manager
        ? `${inst.name} · ${inst.manager}`
        : inst.name;
      const suffix = q?.reportLabel || q?.reportDate || "";
      return `<option value="${escapeHtml(inst.id)}">${escapeHtml(label)}${suffix ? ` (${escapeHtml(suffix)})` : ""}</option>`;
    }).join("");
    select.value = list.some((inst) => inst.id === selectedInstitutionId) ? selectedInstitutionId : list[0].id;
    if (prev !== select.value) selectedInstitutionQuarterIdx = 0;
    selectedInstitutionId = select.value;
  }

  const active = list.find((inst) => inst.id === selectedInstitutionId) || list[0];
  const quarters = institutionQuarterRows(active);
  if (selectedInstitutionQuarterIdx >= quarters.length) selectedInstitutionQuarterIdx = 0;
  const current = quarters[selectedInstitutionQuarterIdx] || quarters[0];
  const prior = quarters[selectedInstitutionQuarterIdx + 1] || null;
  const rows = (current?.holdings || []).slice(0, 25);

  const quarterTabs = quarters.length > 1
    ? `<div class="inst-quarter-tabs" role="tablist" aria-label="분기 선택">
        ${quarters.map((q, idx) => `
          <button type="button" class="inst-quarter-btn ${idx === selectedInstitutionQuarterIdx ? "is-active" : ""}" data-qidx="${idx}">
            ${escapeHtml(q.reportLabel || q.reportDate || `분기 ${idx + 1}`)}
          </button>
        `).join("")}
      </div>`
    : "";

  detail.innerHTML = `
    <div class="inst-detail-head">
      <div>
        <h3>${escapeHtml(active.name)}</h3>
        <p>${escapeHtml(active.manager || "")} · ${escapeHtml(current?.reportLabel || current?.reportDate || "-")} · 제출 ${escapeHtml(current?.filedDate || "-")}</p>
      </div>
      <p>상위 ${rows.length}개 · 전분기 대비 수량 변화 · <span class="muted">풋/콜 옵션은 13F에 기초자산명으로 표기됩니다</span></p>
    </div>
    ${quarterTabs}
    <div class="table-wrap">
      <table class="inst-holdings-table">
        <thead>
          <tr>
            <th>#</th>
            <th>종목</th>
            <th>티커</th>
            <th>보유가치</th>
            <th>비중</th>
            <th>수량</th>
            <th>전분기</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row, idx) => {
            const pos = holdingPositionMeta(row);
            const ticker = resolveHoldingTicker(row);
            const tickerCell = ticker && stockByTicker(ticker)
              ? `<button type="button" class="ticker-link" data-ticker="${escapeHtml(ticker)}">${escapeHtml(ticker)}</button>`
              : `<span class="muted">-</span>`;
            const delta = holdingQuarterDelta(current, prior, row);
            const posBadge = pos.badge
              ? `<span class="inst-pos-badge ${pos.cls}" title="${escapeHtml(pos.hint)}">${escapeHtml(pos.badge)}</span>`
              : "";
            const posLabel = pos.badge
              ? `<span class="inst-pos-label ${pos.cls}">${escapeHtml(pos.label)}</span>`
              : (row.titleOfClass ? `<span class="muted">(${escapeHtml(row.titleOfClass)})</span>` : "");
            return `
              <tr data-ticker="${escapeHtml(ticker || "")}" class="${pos.cls}">
                <td>${idx + 1}</td>
                <td>${posBadge}${escapeHtml(row.issuer || "")} ${posLabel}</td>
                <td>${tickerCell}</td>
                <td>$${Number(row.valueM || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}M</td>
                <td>${Number(row.weightPct || 0).toFixed(2)}%</td>
                <td>${formatHoldingShares(row)}</td>
                <td><span class="inst-delta ${delta.cls}">${escapeHtml(delta.text)}</span></td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;

  detail.querySelectorAll(".inst-quarter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedInstitutionQuarterIdx = Number(btn.dataset.qidx || 0);
      renderInstitutional13f();
    });
  });
  detail.querySelectorAll(".ticker-link").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      selectTicker(btn.dataset.ticker, { openSearch: true });
    });
  });
  detail.querySelectorAll("tbody tr[data-ticker]").forEach((row) => {
    if (!row.dataset.ticker) return;
    row.addEventListener("click", () => selectTicker(row.dataset.ticker, { openSearch: true }));
  });
}

function congressTradesData() {
  return window.CONGRESS_TRADES || {};
}

function congressSideBadge(side) {
  if (side === "buy") return `<span class="congress-side buy">매수</span>`;
  if (side === "sell") return `<span class="congress-side sell">매도</span>`;
  return `<span class="congress-side other">${escapeHtml(side || "기타")}</span>`;
}

function setupCongressUi() {
  if (congressUiReady) return;
  const search = byId("congressSearch");
  const select = byId("congressSelect");
  if (search) {
    search.addEventListener("input", () => {
      congressSearchQuery = search.value.trim().toLowerCase();
      renderCongressTrades();
    });
  }
  if (select) {
    select.addEventListener("change", () => {
      selectedPoliticianId = select.value;
      renderCongressTrades();
    });
  }
  congressUiReady = true;
}

function scrollToCongressDetail() {
  const target = byId("congressDetail");
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function congressMatrixHelpHtml() {
  return `
    <div class="congress-help-popover" role="dialog" aria-label="상임위원회 크로스 분석 설명">
      <strong>이 기능은 무엇을 보여주나요?</strong>
      <p>미국 의원이 <b>어느 상임위원회에 속해 있는지</b>와, 그 의원들이 <b>실제로 어떤 종목을 매수했는지</b>를 묶어서 보여줍니다.</p>
      <p>카드 상단 업종(Financials · Technology 등)은 위원회가 <b>통상 다루는 정책·산업 분야</b>를 참고용으로 표시한 것입니다.</p>
      <p>아래 티커 칩은 <b>업종과 무관하게</b>, 해당 위원회 소속으로 등록된 의원들의 <b>매수 횟수 상위 종목</b>입니다. 그래서 금융위원회 카드에 MSFT·TSLA 같은 기술주가 나올 수 있습니다.</p>
      <p>매수·매도 숫자는 그 위원회 소속 의원 전체의 누적 거래 건수이며, 데이터에 위원회가 등록된 의원만 집계됩니다.</p>
    </div>
  `;
}

function renderCongressTrades() {
  setupCongressUi();
  const payload = congressTradesData();
  const politicians = Array.isArray(payload.politicians) ? payload.politicians : [];
  const meta = byId("congressMeta");
  const rankings = byId("congressRankings");
  const matrix = byId("congressMatrix");
  const select = byId("congressSelect");
  const detail = byId("congressDetail");
  if (!meta || !detail) return;

  meta.innerHTML = `
    <div class="institutional-meta-grid">
      <article><span>데이터 출처</span><strong>${escapeHtml(payload.source || "Congress PTR")}</strong></article>
      <article><span>갱신 주기</span><strong>매일 06:00 KST (미국 장마감 브리핑)</strong></article>
      <article><span>마지막 빌드</span><strong>${escapeHtml(payload.updatedAtKst || "-")}</strong></article>
    </div>
    <p>${escapeHtml(payload.note || "")}</p>
  `;

  if (!politicians.length) {
    if (rankings) rankings.innerHTML = `<p class="muted">의회 매매 데이터가 없습니다. <code>python scripts/build_congress_trades.py</code> 실행 후 다시 시도하세요.</p>`;
    if (matrix) matrix.innerHTML = "";
    if (select) select.innerHTML = "";
    detail.innerHTML = `<p class="muted">데이터를 불러오지 못했습니다.</p>`;
    return;
  }

  const rankingRows = Array.isArray(payload.rankings) ? payload.rankings : [];
  const rankTotal = rankingRows.length;
  const rankPageCount = Math.max(1, Math.ceil(rankTotal / CONGRESS_RANK_PAGE_SIZE));
  if (congressRankPage >= rankPageCount) congressRankPage = 0;
  const rankStart = congressRankPage * CONGRESS_RANK_PAGE_SIZE;
  const rankPageRows = rankingRows.slice(rankStart, rankStart + CONGRESS_RANK_PAGE_SIZE);
  if (rankings) {
    rankings.innerHTML = `
      <div class="congress-section-head">
        <h3>의원별 추정 수익률 랭킹</h3>
        <p class="congress-section-note">최근 18개월 매수 거래 기준 추정 수익률 · 정당: <b>R</b>=공화당 · <b>D</b>=민주당 · <b>I</b>=무소속</p>
      </div>
      <div class="table-wrap">
        <table class="congress-rank-table">
          <thead>
            <tr><th>#</th><th>의원</th><th>의회</th><th>정당</th><th>추정 수익률</th><th>매수</th><th>매도</th></tr>
          </thead>
          <tbody>
            ${rankPageRows.length ? rankPageRows.map((row) => `
              <tr data-pol-id="${escapeHtml(row.id || "")}">
                <td>${row.rank}</td>
                <td><button type="button" class="congress-pol-link" data-pol-id="${escapeHtml(row.id || "")}">${escapeHtml(row.name || "")}</button></td>
                <td>${escapeHtml(row.chamber || "")}</td>
                <td>${escapeHtml(row.party || "-")}</td>
                <td class="${cls(row.estReturnPct || 0)}">${row.estReturnPct != null ? fmtPct(row.estReturnPct) : "—"}</td>
                <td>${row.buyCount || 0}</td>
                <td>${row.sellCount || 0}</td>
              </tr>
            `).join("") : `<tr><td colspan="7" class="muted">랭킹 데이터가 없습니다.</td></tr>`}
          </tbody>
        </table>
      </div>
      ${rankTotal > CONGRESS_RANK_PAGE_SIZE ? `
        <nav class="congress-rank-pagination" aria-label="랭킹 페이지">
          <button type="button" class="congress-page-btn" data-rank-page="prev" ${congressRankPage <= 0 ? "disabled" : ""}>이전</button>
          <span class="congress-page-label">${congressRankPage + 1} / ${rankPageCount} · ${rankStart + 1}–${Math.min(rankStart + CONGRESS_RANK_PAGE_SIZE, rankTotal)}위</span>
          <button type="button" class="congress-page-btn" data-rank-page="next" ${congressRankPage >= rankPageCount - 1 ? "disabled" : ""}>다음</button>
        </nav>
      ` : ""}
    `;
    rankings.querySelectorAll(".congress-pol-link").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedPoliticianId = btn.dataset.polId || "";
        if (select) select.value = selectedPoliticianId;
        renderCongressTrades();
        scrollToCongressDetail();
      });
    });
    rankings.querySelectorAll(".congress-page-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        if (btn.dataset.rankPage === "prev") congressRankPage = Math.max(0, congressRankPage - 1);
        if (btn.dataset.rankPage === "next") congressRankPage = Math.min(rankPageCount - 1, congressRankPage + 1);
        renderCongressTrades();
      });
    });
  }

  const matrixRows = Array.isArray(payload.committeeSectorMatrix) ? payload.committeeSectorMatrix : [];
  if (matrix) {
    matrix.innerHTML = matrixRows.length ? `
      <div class="congress-section-head congress-section-head--help${congressMatrixHelpOpen ? " is-open" : ""}">
        <h3 class="congress-title-row">
          <span>상임위원회 × 업종 크로스 분석</span>
          <button type="button" class="congress-help-button" data-congress-matrix-help aria-expanded="${congressMatrixHelpOpen}" title="기능 설명">!</button>
        </h3>
        ${congressMatrixHelpOpen ? congressMatrixHelpHtml() : ""}
        <p class="congress-section-note">위원회 소속 의원 매수·매도 패턴 요약 (등록된 의원 기준)</p>
      </div>
      <div class="congress-matrix-grid">
        ${matrixRows.slice(0, 12).map((row) => `
          <article class="congress-matrix-card">
            <h4>${escapeHtml(row.committee || "")}</h4>
            <p class="muted">${(row.sectors || []).map((s) => escapeHtml(s)).join(" · ") || "섹터 미지정"}</p>
            <div class="congress-matrix-stats">
              <span>매수 <b>${row.buyCount || 0}</b></span>
              <span>매도 <b>${row.sellCount || 0}</b></span>
            </div>
            <p class="congress-matrix-tickers">${(row.topTickers || []).slice(0, 5).map((t) => `<button type="button" class="congress-ticker-chip" data-ticker="${escapeHtml(t.ticker)}">${escapeHtml(t.ticker)} <span class="muted">×${t.count || 0}</span></button>`).join(" ") || "—"}</p>
            ${(row.topPoliticians || []).length ? `<p class="congress-matrix-pols muted">${(row.topPoliticians || []).slice(0, 3).map((p) => escapeHtml(p.name)).join(" · ")}</p>` : ""}
          </article>
        `).join("")}
      </div>
    ` : `<p class="muted">위원회 매칭 데이터가 아직 없습니다.</p>`;
    matrix.querySelectorAll(".congress-ticker-chip").forEach((btn) => {
      btn.addEventListener("click", () => selectTicker(btn.dataset.ticker, { openSearch: true }));
    });
    const helpBtn = matrix.querySelector("[data-congress-matrix-help]");
    if (helpBtn) {
      helpBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        congressMatrixHelpOpen = !congressMatrixHelpOpen;
        renderCongressTrades();
      });
    }
  }

  const filtered = politicians.filter((pol) => {
    if (!congressSearchQuery) return true;
    const hay = `${pol.name} ${pol.chamber} ${pol.party} ${(pol.committees || []).join(" ")}`.toLowerCase();
    return hay.includes(congressSearchQuery);
  });
  const list = filtered.length ? filtered : politicians;
  if (!list.some((pol) => pol.id === selectedPoliticianId)) {
    selectedPoliticianId = list[0].id;
  }
  if (select) {
    select.innerHTML = list.map((pol) => {
      const ret = pol.estReturnPct != null ? ` · ${fmtPct(pol.estReturnPct)}` : "";
      return `<option value="${escapeHtml(pol.id)}">${escapeHtml(pol.name)} (${escapeHtml(pol.chamber)})${ret}</option>`;
    }).join("");
    select.value = selectedPoliticianId;
  }

  const active = list.find((pol) => pol.id === selectedPoliticianId) || list[0];
  const trades = Array.isArray(active.recentTrades) ? active.recentTrades : [];
  detail.innerHTML = `
    <div class="inst-detail-head">
      <div>
        <h3>${escapeHtml(active.name)}</h3>
        <p>${escapeHtml(active.chamber || "")} · ${escapeHtml(active.party || "-")} · ${escapeHtml((active.committees || []).join(", ") || "위원회 정보 없음")}</p>
      </div>
      <p>최근 매매 ${active.tradeCount || 0}건 · 매수 ${active.buyCount || 0} · 매도 ${active.sellCount || 0} · 추정 수익률 ${active.estReturnPct != null ? fmtPct(active.estReturnPct) : "—"}</p>
    </div>
    <div class="table-wrap">
      <table class="congress-trades-table">
        <thead>
          <tr><th>일자</th><th>구분</th><th>티커</th><th>종목</th><th>금액</th><th>소유</th></tr>
        </thead>
        <tbody>
          ${trades.length ? trades.map((t) => `
            <tr>
              <td>${escapeHtml(t.transactionDate || "")}</td>
              <td>${congressSideBadge(t.side)}</td>
              <td>${t.ticker ? `<button type="button" class="ticker-link" data-ticker="${escapeHtml(t.ticker)}">${escapeHtml(t.ticker)}</button>` : "—"}</td>
              <td>${escapeHtml(t.asset || "")}</td>
              <td>${escapeHtml(t.amount || "")}</td>
              <td>${escapeHtml(t.owner || "")}</td>
            </tr>
          `).join("") : `<tr><td colspan="6" class="muted">최근 매매 기록이 없습니다.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
  detail.querySelectorAll(".ticker-link").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      selectTicker(btn.dataset.ticker, { openSearch: true });
    });
  });
}

function renderCongressTradesForTicker(item) {
  const box = byId("stockCongress");
  if (!box) return;
  if (!item || item.sector === "EXCHANGE TRADED FUNDS") {
    box.innerHTML = "";
    box.hidden = true;
    return;
  }
  const payload = congressTradesData();
  const cell = (payload.byTicker || {})[item.ticker];
  if (!cell || !(cell.trades || []).length) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  box.hidden = false;
  const trades = cell.trades.slice(0, 12);
  box.innerHTML = `
    <div class="event-head">
      <div>
        <h3>정치인 매수·매도 현황</h3>
        <p class="muted">미국 의회 PTR 공시 기준 · 매수 ${cell.netBuys || 0} · 매도 ${cell.netSells || 0} · 의원 ${cell.politicianCount || 0}명</p>
      </div>
      <span class="event-badge">${escapeHtml(item.ticker)}</span>
    </div>
    <div class="table-wrap compact-table-wrap">
      <table class="compact-table congress-trades-table">
        <thead>
          <tr><th>일자</th><th>의원</th><th>구분</th><th>금액</th></tr>
        </thead>
        <tbody>
          ${trades.map((t) => `
            <tr>
              <td>${escapeHtml(t.transactionDate || "")}</td>
              <td>${escapeHtml(t.politician || "")}</td>
              <td>${congressSideBadge(t.side)}</td>
              <td>${escapeHtml(t.amount || "")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    <p class="muted congress-stock-note">공시 지연으로 실제 거래 시점과 차이가 있을 수 있습니다.</p>
  `;
}

function renderHealth() {
  renderMarketBreadth();
  renderDataTrustCenter();
  renderMarkets();
}

// ===== 시장 폭(Market Breadth) — 스냅샷 종목군 기반 시장 체력 지표 =====
function breadthBar(label, upPct, sub) {
  const p = Math.max(0, Math.min(100, upPct));
  const tone = p >= 60 ? "pos" : p <= 40 ? "neg" : "muted";
  return `
    <div class="breadth-row">
      <div class="breadth-row-head"><span>${escapeHtml(label)}</span><strong class="${tone}">${p.toFixed(0)}%</strong></div>
      <div class="breadth-track"><i class="breadth-fill bf-${tone}" style="width:${p.toFixed(1)}%"></i></div>
      ${sub ? `<small class="muted">${escapeHtml(sub)}</small>` : ""}
    </div>`;
}

function renderMarketBreadth() {
  const box = byId("marketBreadthCard");
  if (!box) return;
  const stocks = (data.stocks || []).filter((s) =>
    s && s.sector && s.sector !== "EXCHANGE TRADED FUNDS" && Number.isFinite(Number(s.changePct)));
  const n = stocks.length;
  if (n < 5) { box.innerHTML = ""; return; }

  const adv = stocks.filter((s) => Number(s.changePct) > 0).length;
  const dec = stocks.filter((s) => Number(s.changePct) < 0).length;
  const unch = n - adv - dec;
  const advPct = (adv / n) * 100;
  const upPctOf = (key) => (stocks.filter((s) => Number(s[key]) > 0).length / n) * 100;
  const weekUp = upPctOf("weekChangePct");
  const monthUp = upPctOf("monthChangePct");

  const strong = stocks.filter((s) => Number(s.rsScore) >= 80).length;
  const weak = stocks.filter((s) => Number(s.rsScore) <= 20).length;
  const strongPct = (strong / n) * 100;

  const nearHigh = stocks.filter((s) => Number(s.newHighDistancePct) <= 2).length;
  const nearLow = stocks.filter((s) => { const d = low52DistPct(s); return Number.isFinite(d) && d <= 5; }).length;
  const volAdv = stocks.filter((s) => Number(s.changePct) > 0 && Number(s.volumeRatio) >= 1.5).length;
  const volAdvPct = (volAdv / Math.max(1, adv)) * 100;

  // McClellan-식 단순 지표: (상승-하락)/전체
  const adLine = ((adv - dec) / n) * 100;
  const regime = adLine >= 25 ? { k: "pos", t: "강세 우위" } : adLine <= -25 ? { k: "neg", t: "약세 우위" } : { k: "muted", t: "혼조" };

  // 섹터별 상승 비율
  const bySector = {};
  stocks.forEach((s) => {
    const k = s.sector || "기타";
    if (!bySector[k]) bySector[k] = { up: 0, total: 0 };
    bySector[k].total += 1;
    if (Number(s.changePct) > 0) bySector[k].up += 1;
  });
  const sectorRows = Object.entries(bySector)
    .filter(([, v]) => v.total >= 3)
    .map(([sec, v]) => ({ sec, pct: (v.up / v.total) * 100, total: v.total }))
    .sort((a, b) => b.pct - a.pct);
  const sectorHtml = sectorRows.map((r) => {
    const tone = r.pct >= 60 ? "pos" : r.pct <= 40 ? "neg" : "muted";
    return `<div class="breadth-sector"><span title="${escapeHtml(r.sec)}">${escapeHtml(sectorShortName(r.sec))}</span><div class="breadth-track sm"><i class="breadth-fill bf-${tone}" style="width:${r.pct.toFixed(1)}%"></i></div><b class="${tone}">${r.pct.toFixed(0)}%</b></div>`;
  }).join("");

  box.innerHTML = `
    <div class="breadth-head">
      <div>
        <span class="daily-action-kicker">MARKET BREADTH</span>
        <h2>시장 폭 지표</h2>
        <p>스냅샷 ${n.toLocaleString()}개 종목(ETF 제외) 기준 시장 전체의 참여도·체력입니다.</p>
      </div>
      <span class="breadth-regime breadth-${regime.k}">${regime.t} · A/D ${adLine >= 0 ? "+" : ""}${adLine.toFixed(0)}</span>
    </div>
    <div class="breadth-stats">
      <article><span>상승 / 하락</span><strong><b class="pos">${adv.toLocaleString()}</b> / <b class="neg">${dec.toLocaleString()}</b></strong><em class="muted">보합 ${unch}</em></article>
      <article><span>52주 신고가 근접</span><strong class="pos">${nearHigh.toLocaleString()}</strong><em class="muted">≤ 2%</em></article>
      <article><span>52주 신저가 근접</span><strong class="neg">${nearLow.toLocaleString()}</strong><em class="muted">≤ 5%</em></article>
      <article><span>RS 강세(≥80)</span><strong class="pos">${strong.toLocaleString()}</strong><em class="muted">약세(≤20) ${weak}</em></article>
      <article><span>거래량 동반 상승</span><strong>${volAdv.toLocaleString()}</strong><em class="muted">상승종목의 ${volAdvPct.toFixed(0)}%</em></article>
      <article><span>당일 상승 비율</span><strong class="${advPct >= 50 ? "pos" : "neg"}">${advPct.toFixed(0)}%</strong><em class="muted">참여도</em></article>
    </div>
    <div class="breadth-bars">
      ${breadthBar("당일 상승 비율", advPct, `${adv} / ${n}개 상승`)}
      ${breadthBar("1주 상승 비율", weekUp, "주간 추세 참여도")}
      ${breadthBar("1개월 상승 비율", monthUp, "중기 추세 참여도")}
      ${breadthBar("RS 강세 비율", strongPct, "상대강도 80 이상")}
    </div>
    <div class="breadth-sectors">
      <div class="breadth-sectors-title">섹터별 상승 비율</div>
      ${sectorHtml}
    </div>
    <p class="breadth-note">참여도가 넓을수록(상승 비율·RS 강세 높을수록) 추세가 건강합니다. 지수만 오르고 폭이 좁으면(소수 종목 주도) 되돌림 위험을 함께 봐야 합니다.</p>
  `;
}

function sectorShortName(sector) {
  const map = {
    "TECHNOLOGY": "기술", "FINANCIAL": "금융", "FINANCIAL SERVICES": "금융",
    "HEALTHCARE": "헬스케어", "ENERGY": "에너지", "INDUSTRIALS": "산업재",
    "CONSUMER CYCLICAL": "경기소비재", "CONSUMER DEFENSIVE": "필수소비재",
    "COMMUNICATION SERVICES": "커뮤니케이션", "UTILITIES": "유틸리티",
    "REAL ESTATE": "부동산", "BASIC MATERIALS": "소재", "MATERIALS": "소재"
  };
  return map[String(sector || "").toUpperCase()] || sector;
}

function trustPayloadCount(payload, keys = []) {
  if (!payload) return 0;
  if (Number.isFinite(Number(payload.count))) return Number(payload.count);
  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === "object") return Object.keys(value).length;
  }
  return 0;
}

function trustStatus(timestamp, count, maxHours) {
  if (!count) return { key: "missing", label: "데이터 없음", age: null };
  const parsed = parseSnapshotDate(timestamp);
  if (!parsed) return { key: "unknown", label: "시각 확인 필요", age: null };
  const age = Math.max(0, (Date.now() - parsed.getTime()) / 36e5);
  if (age > maxHours) return { key: "stale", label: "갱신 지연", age };
  if (age > maxHours * 0.72) return { key: "warn", label: "갱신 임박", age };
  return { key: "good", label: "정상", age };
}

function trustAgeLabel(hours) {
  if (hours == null) return "경과 시간 미확인";
  if (hours < 1) return "1시간 이내";
  if (hours < 48) return `${Math.floor(hours)}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

function dataTrustSources() {
  const snapshotTime = data.updatedAtKst || data.updated_at_kst || "";
  const fundamentals = window.MAP_FUNDAMENTALS || {};
  const source = (name, provider, payload, keys, maxHours, cadence, fallbackTime = "") => {
    const count = trustPayloadCount(payload, keys);
    const timestamp = payload?.updatedAtKst || payload?.updated_at_kst || payload?.updated || fallbackTime;
    return { name, provider, count, timestamp, maxHours, cadence, status: trustStatus(timestamp, count, maxHours) };
  };
  return [
    { name: "시장 스냅샷", provider: "Nasdaq · Yahoo", count: (data.stocks || []).length, timestamp: snapshotTime, maxHours: 36, cadence: "매일 06:00 KST", status: trustStatus(snapshotTime, (data.stocks || []).length, 36) },
    { name: "펀더멘털", provider: "Nasdaq · SEC · Yahoo", count: Object.keys(fundamentals).length, timestamp: snapshotTime, maxHours: 36, cadence: "시장 스냅샷과 동시", status: trustStatus(snapshotTime, Object.keys(fundamentals).length, 36) },
    source("내부자 거래", "SEC Form 4", window.INSIDER_TRADES, ["trades"], 72, "영업일 기준 수집"),
    source("주요 공시", "SEC 8-K", window.MATERIAL_EVENTS, ["events"], 72, "매일"),
    source("대량보유", "SEC 13D/G", window.ACTIVIST_STAKES, ["filings"], 168, "매주"),
    source("IPO", "SEC S-1 · 424B4", window.IPO_CALENDAR, ["ipos"], 168, "매주"),
    source("공매도", "FINRA · Nasdaq", window.SHORT_INTEREST, ["rows", "stocks"], 1080, "월 2회"),
    source("기관 13F", "SEC EDGAR", window.INSTITUTIONAL_13F, ["institutions"], 2880, "분기 공시 후"),
    source("정치인 매매", "Congress PTR", window.CONGRESS_TRADES, ["trades", "byTicker"], 336, "주기적 수집"),
    source("백악관 일정", "The White House", window.WHITE_HOUSE_SCHEDULE, ["events", "schedule"], 48, "06 · 16 · 21시")
  ];
}

function renderDataTrustCenter() {
  const grid = byId("dataTrustGrid");
  const summary = byId("dataTrustSummary");
  if (!grid || !summary) return;
  const sources = dataTrustSources();
  const counts = sources.reduce((acc, row) => { acc[row.status.key] = (acc[row.status.key] || 0) + 1; return acc; }, {});
  summary.innerHTML = `
    <div><span>정상</span><strong class="pos">${counts.good || 0}</strong></div>
    <div><span>주의·지연</span><strong class="warn">${(counts.warn || 0) + (counts.stale || 0)}</strong></div>
    <div><span>확인 필요</span><strong>${(counts.missing || 0) + (counts.unknown || 0)}</strong></div>
    <div><span>마지막 점검</span><strong>${escapeHtml(formatKstDateTime().slice(5))}</strong></div>`;
  grid.innerHTML = sources.map((row) => `
    <article class="data-trust-card trust-${row.status.key}">
      <div class="data-trust-card-head"><strong>${escapeHtml(row.name)}</strong><span>${escapeHtml(row.status.label)}</span></div>
      <p>${escapeHtml(row.provider)}</p>
      <dl>
        <div><dt>기준 시각</dt><dd>${escapeHtml(row.timestamp || "확인 불가")}</dd></div>
        <div><dt>로드 수량</dt><dd>${Number(row.count || 0).toLocaleString()}건</dd></div>
        <div><dt>갱신 정책</dt><dd>${escapeHtml(row.cadence)}</dd></div>
      </dl>
      <small>${escapeHtml(trustAgeLabel(row.status.age))}</small>
    </article>`).join("");
  const refresh = byId("dataTrustRefresh");
  if (refresh && !refresh.dataset.bound) {
    refresh.dataset.bound = "1";
    refresh.addEventListener("click", () => { renderDataTrustCenter(); showAppToast("로드된 데이터 상태를 다시 확인했습니다"); });
  }
}

function renderMarkets() {
  const container = byId("marketsTables");
  if (!container) return;
  const byTicker = {};
  data.stocks.forEach((s) => { byTicker[s.ticker] = s; });

  const sections = MARKET_GROUPS.map((group) => {
    const seen = new Set();
    const rows = [];
    group.tickers.forEach(([ticker, name]) => {
      const s = byTicker[ticker];
      if (!s || seen.has(ticker)) return;
      seen.add(ticker);
      rows.push({ ticker, name, s });
    });
    if (!rows.length) return "";
    return marketTableHtml(group.title, rows);
  }).join("");

  container.innerHTML = sections + currencySectionShell();

  container.querySelectorAll(".market-row[data-ticker]").forEach((tr) => {
    tr.addEventListener("click", () => selectTicker(tr.dataset.ticker, { openSearch: true }));
  });

  loadCurrencies();
}

function marketTableHtml(title, rows) {
  return `
    <div class="market-section">
      <h3>${escapeHtml(title)}</h3>
      <div class="table-wrap">
        <table class="market-table">
          <thead>
            <tr>
              <th>이름</th><th>티커</th><th>현재가</th><th>당일</th>
              <th>1주</th><th>1개월</th><th>3개월</th><th>YTD</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(({ ticker, name, s }) => `
              <tr class="market-row" data-ticker="${ticker}" style="cursor:pointer;" title="${escapeHtml(ticker)} 분석 보기">
                <td>${escapeHtml(name)}</td>
                <td><strong>${escapeHtml(ticker)}</strong></td>
                <td>$${Number(s.price).toFixed(2)}</td>
                <td class="${cls(s.changePct)}">${fmtPct(s.changePct)}</td>
                <td class="${cls(s.weekChangePct)}">${fmtPct(s.weekChangePct)}</td>
                <td class="${cls(s.monthChangePct)}">${fmtPct(s.monthChangePct)}</td>
                <td class="${cls(s.threeMonthChangePct)}">${fmtPct(s.threeMonthChangePct)}</td>
                <td class="${cls(s.ytdChangePct)}">${fmtPct(s.ytdChangePct)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function currencySectionShell() {
  const body = LIVE_DATA_PROXY
    ? `<p class="muted" id="currencyStatus">환율 불러오는 중…</p>`
    : `<p class="muted">환율은 실시간 프록시(Cloudflare Worker) 연결 시 표시됩니다. (app.js의 LIVE_DATA_PROXY)</p>`;
  return `
    <div class="market-section" id="currencySection">
      <h3>환율 <span class="muted" style="font-size:12px;font-weight:600;">실시간</span></h3>
      <div id="currencyTableWrap">${body}</div>
    </div>
  `;
}

function loadCurrencies() {
  if (!LIVE_DATA_PROXY) return;
  const endpoint = `${LIVE_DATA_PROXY.replace(/\/$/, "")}/?fx=1`;
  fetch(endpoint, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((payload) => {
      const wrap = byId("currencyTableWrap");
      if (!wrap) return;
      const fx = (payload && Array.isArray(payload.fx)) ? payload.fx : [];
      if (!fx.length) {
        wrap.innerHTML = `<p class="muted">환율 데이터를 불러오지 못했습니다.</p>`;
        return;
      }
      wrap.innerHTML = `
        <div class="table-wrap">
          <table class="market-table">
            <thead><tr><th>통화쌍</th><th>현재가</th><th>당일</th><th>1개월</th></tr></thead>
            <tbody>
              ${fx.map((f) => {
                const price = Number(f.price);
                const decimals = price >= 100 ? 2 : 4;
                return `
                  <tr>
                    <td>${escapeHtml(f.name || f.symbol)}</td>
                    <td><strong>${price.toFixed(decimals)}</strong></td>
                    <td class="${cls(f.changePct)}">${fmtPct(f.changePct)}</td>
                    <td class="${cls(f.monthChangePct)}">${fmtPct(f.monthChangePct)}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `;
    })
    .catch(() => {
      const wrap = byId("currencyTableWrap");
      if (wrap) wrap.innerHTML = `<p class="muted">환율 데이터를 불러오지 못했습니다.</p>`;
    });
}

function periodLabel(key) {
  return {
    weekChangePct: "1주",
    monthChangePct: "1개월",
    threeMonthChangePct: "3개월",
    ytdChangePct: "YTD",
    changePct: "당일"
  }[key] || key;
}

function etfPeriodRelative(item, benchmark, periodKey) {
  const rel = item.relative?.[benchmark]?.[periodKey];
  if (Number.isFinite(rel)) return rel;
  const rep = stockByTicker(item.representative);
  const bench = stockByTicker(benchmark);
  if (rep && bench) return (Number(rep[periodKey]) || 0) - (Number(bench[periodKey]) || 0);
  return Number(item[periodKey]) || 0;
}

function etfRsCardHtml(item, period, benchmark) {
  const spy = item.relative?.SPY?.[period] ?? 0;
  const qqq = item.relative?.QQQ?.[period] ?? 0;
  // Show all peers (no limit) sorted by period return descending
  const sortedPeers = (item.peers || [])
    .slice()
    .sort((a, b) => (b[period] ?? 0) - (a[period] ?? 0));
  const peers = sortedPeers.map((peer) => `
    <span class="peer-chip ${cls(peer[period])}">
      ${peer.ticker} ${fmtPct(peer[period] ?? 0)}
    </span>
  `).join("");
  const totalPeers = sortedPeers.length;
  return `
    <article class="etf-rs-card" data-category="${item.category}" title="클릭해서 전체 ${totalPeers}개 구성 종목 보기">
      <div class="etf-rs-topline">
        <span class="group-badge">${item.group}</span>
        <strong class="${cls(item.activeRelative)}">${benchmark} 대비 ${fmtPct(item.activeRelative)}</strong>
      </div>
      <h4>${item.category}</h4>
      <div class="etf-rs-main">
        <div>
          <span class="ticker-pill">${item.representative}</span>
          <strong>${item.name}</strong>
        </div>
        <div class="etf-rs-score ${cls(item.rsScore - 50)}">${item.rsScore}</div>
      </div>
      <div class="etf-rs-stats">
        <span>${periodLabel(period)} 수익률 <strong class="${cls(item.activeReturn)}">${fmtPct(item.activeReturn)}</strong></span>
        <span>SPY 대비 <strong class="${cls(spy)}">${fmtPct(spy)}</strong></span>
        <span>QQQ 대비 <strong class="${cls(qqq)}">${fmtPct(qqq)}</strong></span>
      </div>
      <div class="peer-list">${peers}</div>
      <p class="drilldown-hint">👆 클릭해서 전체 ${totalPeers}개 종목 상세 보기</p>
    </article>
  `;
}

function renderEtfRelativeStrength() {
  const container = byId("etfRelativeStrength");
  const payload = data.health?.etfRelative || { rows: [], universeCount: 0, method: "" };
  const benchmark = byId("etfRsBenchmark")?.value || "SPY";
  const period = byId("etfRsPeriod")?.value || "monthChangePct";
  const group = byId("etfRsGroup")?.value || "All";
  const rows = (payload.rows || [])
    .filter((item) => group === "All" || item.group === group)
    .map((item) => ({
      ...item,
      activeRelative: item.relative?.[benchmark]?.[period] ?? 0,
      activeReturn: item[period] ?? 0
    }))
    .sort((a, b) => b.activeRelative - a.activeRelative);

  byId("etfRsMeta").textContent = `${payload.universeCount || 0}개 ETF 기반 · ${rows.length}개 세부 그룹`;
  byId("etfRsMethod").textContent = payload.method || "";

  if (!rows.length) {
    container.innerHTML = `<div class="empty-state">ETF 상대강도 데이터가 없습니다. 스냅샷을 다시 생성해 주세요.</div>`;
    return;
  }
  container.innerHTML = rows.map((item) => etfRsCardHtml(item, period, benchmark)).join("");
}

function getSectorEtfRows() {
  const payload = data.health?.etfRelative || { rows: [], universeCount: 0, method: "" };
  const benchmark = byId("sectorEtfRsBenchmark")?.value || "SPY";
  const period = byId("sectorEtfRsPeriod")?.value || "monthChangePct";
  const group = byId("sectorEtfRsGroup")?.value || "All";
  const sort = byId("sectorEtfRsSort")?.value || "relative";
  const rows = (payload.rows || [])
    .filter((item) => group === "All" || item.group === group)
    .map((item) => ({
      ...item,
      activeRelative: item.relative?.[benchmark]?.[period] ?? 0,
      activeReturn: item[period] ?? 0
    }))
    .sort((a, b) => {
      if (sort === "return") return b.activeReturn - a.activeReturn;
      if (sort === "rs") return b.rsScore - a.rsScore;
      return b.activeRelative - a.activeRelative;
    });
  return { rows, payload, benchmark, period };
}

function sectorEtfCardHtml(item, rankIdx, period, benchmark) {
  const rankBadge = rankIdx < 3
    ? `<span class="rank-medal rank-${rankIdx + 1}">${["🥇", "🥈", "🥉"][rankIdx]}</span>`
    : `<span class="rank-num">${rankIdx + 1}</span>`;
  const spy = item.relative?.SPY?.[period] ?? 0;
  const qqq = item.relative?.QQQ?.[period] ?? 0;
  const sortedPeers = (item.peers || []).slice().sort((a, b) => (b[period] ?? 0) - (a[period] ?? 0));
  const totalPeers = sortedPeers.length;
  const peersToShow = sortedPeers.slice(0, 8);
  const remainCount = totalPeers - peersToShow.length;
  const peerChips = peersToShow.map((peer) => `
    <span class="peer-chip ${cls(peer[period])}">${peer.ticker} ${fmtPct(peer[period] ?? 0)}</span>
  `).join("") + (remainCount > 0 ? `<span class="peer-more">+${remainCount}개 더</span>` : "");
  return `
    <article class="etf-rs-card" data-category="${item.category}" title="클릭해서 전체 ${totalPeers}개 구성 종목 보기">
      <div class="etf-rs-topline">
        ${rankBadge}
        <span class="group-badge">${item.group}</span>
        <strong class="${cls(item.activeRelative)}">${benchmark} 대비 ${fmtPct(item.activeRelative)}</strong>
      </div>
      <h4>${item.category}</h4>
      <div class="etf-rs-main">
        <div>
          <span class="ticker-pill">${item.representative}</span>
          <strong>${item.name}</strong>
        </div>
        <div class="etf-rs-score ${cls(item.rsScore - 50)}">${item.rsScore}</div>
      </div>
      <div class="etf-rs-stats">
        <span>${periodLabel(period)} <strong class="${cls(item.activeReturn)}">${fmtPct(item.activeReturn)}</strong></span>
        <span>SPY 대비 <strong class="${cls(spy)}">${fmtPct(spy)}</strong></span>
        <span>QQQ 대비 <strong class="${cls(qqq)}">${fmtPct(qqq)}</strong></span>
      </div>
      <div class="peer-list">${peerChips}</div>
      <p class="drilldown-hint">👆 클릭해서 전체 ${totalPeers}개 종목 상세 보기</p>
    </article>
  `;
}

function renderSectorEtfGrid(rows, period, benchmark) {
  const container = byId("sectorEtfGrid");
  const footer = byId("sectorEtfRsFooter");
  if (!container) return;

  const perPage = Math.max(1, Math.ceil(rows.length / ETF_RS_PAGE_COUNT));
  const maxPage = rows.length ? Math.min(ETF_RS_PAGE_COUNT, Math.ceil(rows.length / perPage)) : 1;
  etfRsPage = Math.min(Math.max(1, etfRsPage), maxPage);
  const pageItems = rows.slice((etfRsPage - 1) * perPage, etfRsPage * perPage);
  const pageStart = rows.length ? (etfRsPage - 1) * perPage + 1 : 0;
  const pageEnd = rows.length ? pageStart + pageItems.length - 1 : 0;
  const globalOffset = (etfRsPage - 1) * perPage;

  if (!rows.length) {
    container.innerHTML = `<div class="empty-state">ETF 상대강도 데이터가 없습니다. 스냅샷을 다시 생성해 주세요.</div>`;
    if (footer) footer.innerHTML = "";
    return;
  }

  container.innerHTML = pageItems.map((item, idx) => sectorEtfCardHtml(item, globalOffset + idx, period, benchmark)).join("");

  if (footer) {
    footer.innerHTML = `
      <span class="muted sector-etf-rs-range">${pageStart}–${pageEnd} / ${rows.length}개</span>
      <div class="segmented sector-etf-rs-pagination" aria-label="ETF 상대강도 페이지">
        ${Array.from({ length: ETF_RS_PAGE_COUNT }, (_, idx) => {
          const page = idx + 1;
          const disabled = page > maxPage;
          return `<button type="button" data-etf-page="${page}" class="${etfRsPage === page ? "is-active" : ""}" ${disabled ? "disabled" : ""}>${page}</button>`;
        }).join("")}
      </div>
    `;
    footer.querySelectorAll("[data-etf-page]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        etfRsPage = Number(btn.dataset.etfPage);
        const current = getSectorEtfRows();
        renderSectorEtfGrid(current.rows, current.period, current.benchmark);
      });
    });
  }
}

function renderSectorEtfRelativeStrength() {
  etfRsPage = 1;
  const { rows, payload, benchmark, period } = getSectorEtfRows();
  byId("sectorEtfRsMeta").textContent = `총 ${payload.universeCount || 0}개 ETF 기반 · ${rows.length}개 세부 그룹 표시 중`;
  renderSectorRotationBoard(rows, period, benchmark);
  renderSectorEtfGrid(rows, period, benchmark);
}

function renderSectorRotationBoard(rows, period, benchmark) {
  const board = byId("sectorRotationBoard");
  if (!board) return;
  const horizon = ROTATION_HORIZONS[rotationHorizon] || ROTATION_HORIZONS["1M"];
  const enriched = rows.map((item) => {
    const relShort = etfPeriodRelative(item, benchmark, horizon.short);
    const relLong = etfPeriodRelative(item, benchmark, horizon.long);
    let quadrant = "lagging";
    if (relShort > 0 && relLong > 0) quadrant = "leading";
    else if (relShort > 0 && relLong <= 0) quadrant = "improving";
    else if (relShort <= 0 && relLong > 0) quadrant = "weakening";
    return { ...item, relShort, relLong, quadrant, activeRelative: relShort };
  });
  const groups = [
    ["leading", "Leading", `${horizon.shortLabel}/${horizon.longLabel} 모두 벤치마크 초과`],
    ["improving", "Improving", `최근 ${horizon.shortLabel} 상대강도 개선`],
    ["weakening", "Weakening", `${horizon.longLabel}은 강하지만 최근 둔화`],
    ["lagging", "Lagging", "벤치마크 대비 약세"]
  ];
  board.innerHTML = `
    <div class="rotation-head">
      <div>
        <h3>Sector Rotation Map</h3>
        <p class="muted">${benchmark} 대비 ${horizon.shortLabel}/${horizon.longLabel} 상대강도로 ETF 그룹을 사분면으로 나눕니다.</p>
      </div>
      <div class="rotation-head-actions">
        <div class="segmented rotation-horizon-tabs" aria-label="Rotation horizon">
          ${Object.keys(ROTATION_HORIZONS).map((key) => `
            <button type="button" data-horizon="${key}" class="${rotationHorizon === key ? "is-active" : ""}">${key}</button>
          `).join("")}
        </div>
        <span class="event-badge">${periodLabel(period)}</span>
      </div>
    </div>
    <div class="rotation-grid">
      ${groups.map(([key, title, desc]) => {
        const list = enriched.filter((item) => item.quadrant === key)
          .sort((a, b) => b.relShort - a.relShort)
          .slice(0, 7);
        return `
          <section class="rotation-quadrant rotation-${key}">
            <h4>${title}</h4>
            <p>${desc}</p>
            <div>
              ${list.length ? list.map((item) => `
                <button type="button" class="rotation-chip" data-category="${escapeHtml(item.category)}">
                  <strong>${escapeHtml(item.representative)}</strong>
                  <span>${escapeHtml(item.category)}</span>
                  <b class="${cls(item.relShort)}">${fmtPct(item.relShort)}</b>
                </button>
              `).join("") : `<span class="muted">해당 그룹 없음</span>`}
            </div>
          </section>
        `;
      }).join("")}
    </div>
  `;
  board.querySelectorAll("[data-horizon]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.horizon === rotationHorizon) return;
      rotationHorizon = btn.dataset.horizon;
      renderSectorEtfRelativeStrength();
    });
  });
  board.querySelectorAll(".rotation-chip").forEach((chip) => {
    chip.addEventListener("click", () => showConstituentPanel(chip.dataset.category, period));
  });
}

const LEV_ETF_TYPE_LABEL = {
  leveraged: "레버리지",
  inverse: "인버스",
  "covered-call": "커버드콜",
  volatility: "변동성",
  buffer: "버퍼",
  "defined-outcome": "디파인드",
};

const LEV_ETF_SCOPE_LABEL = {
  index: "지수",
  sector: "섹터",
  "single-stock": "개별종목",
  commodity: "원자재",
  international: "국제",
  thematic: "테마",
};

const LEV_ETF_DISCOVER_PATTERNS = [
  /\b2x\b/i, /\b3x\b/i, /\b4x\b/i, /\bultra\b/i, /\binverse\b/i, /\bshort\b/i,
  /\bbear\b/i, /\bbull\b/i, /\bleverag/i, /\bcovered call\b/i, /\bbuywrite\b/i,
  /\boption income\b/i, /\bdaily target\b/i, /\bdefined outcome\b/i, /\bbuffer\b/i,
];

function inferLeveragedEtfMeta(stock) {
  const name = `${stock.company || ""} ${stock.industry || ""}`;
  let type = "leveraged";
  if (/inverse|short|bear/i.test(name)) type = "inverse";
  else if (/covered call|buywrite|option income|premium income/i.test(name)) type = "covered-call";
  else if (/vix|volatility/i.test(name)) type = "volatility";
  else if (/buffer|defined outcome/i.test(name)) type = "buffer";
  let leverage = "—";
  const levMatch = name.match(/(\d+(?:\.\d+)?)\s*x/i);
  if (levMatch) leverage = `${levMatch[1]}x`;
  else if (/ultrapro/i.test(name)) leverage = "3x";
  else if (/ultra(?!pro)/i.test(name)) leverage = "2x";
  return {
    ticker: stock.ticker,
    name: stock.company || stock.ticker,
    type,
    leverage,
    direction: type === "inverse" ? "short" : (type === "covered-call" ? "neutral" : "long"),
    underlying: "—",
    underlyingLabel: "미분류",
    scope: "thematic",
    group: "스냅샷 자동 분류",
    issuer: "—",
    discovered: true,
  };
}

function leveragedEtfCatalogItems() {
  const catalog = (window.LEVERAGED_ETF_CATALOG && window.LEVERAGED_ETF_CATALOG.items) || [];
  const byTicker = new Map(catalog.map((item) => [item.ticker, { ...item }]));
  (data.stocks || []).forEach((stock) => {
    if (stock.sector !== "EXCHANGE TRADED FUNDS") return;
    const text = `${stock.company || ""} ${stock.industry || ""}`;
    if (!LEV_ETF_DISCOVER_PATTERNS.some((re) => re.test(text))) return;
    if (!byTicker.has(stock.ticker)) byTicker.set(stock.ticker, inferLeveragedEtfMeta(stock));
  });
  return [...byTicker.values()];
}

function levEtfLiveRow(ticker) {
  return stockByTicker(ticker);
}

function levEtfTypeBadge(type) {
  const label = LEV_ETF_TYPE_LABEL[type] || type;
  return `<span class="lev-etf-badge lev-etf-badge-${type}">${escapeHtml(label)}</span>`;
}

function levEtfCardHtml(item) {
  const live = levEtfLiveRow(item.ticker);
  const hasLive = !!live;
  const price = hasLive ? priceOrDash(live.price) : "—";
  const chg = hasLive ? fmtPct(live.changePct) : "—";
  const chgCls = hasLive ? cls(live.changePct) : "";
  const month = hasLive && Number.isFinite(live.monthChangePct) ? fmtPct(live.monthChangePct) : "—";
  const monthCls = hasLive ? cls(live.monthChangePct) : "";
  const rs = hasLive ? live.rsScore : "—";
  const scopeLabel = LEV_ETF_SCOPE_LABEL[item.scope] || item.scope;
  return `
    <article class="lev-etf-card ${hasLive ? "has-live" : "no-live"}" data-ticker="${escapeHtml(item.ticker)}" tabindex="0" role="button">
      <div class="lev-etf-card-head">
        <span class="ticker-pill">${escapeHtml(item.ticker)}</span>
        ${levEtfTypeBadge(item.type)}
        <span class="lev-etf-lev">${escapeHtml(item.leverage || "—")}</span>
      </div>
      <h4>${escapeHtml(item.name)}</h4>
      <p class="lev-etf-underlying">
        <span>기초</span>
        <strong>${escapeHtml(item.underlying)}</strong>
        <em>${escapeHtml(item.underlyingLabel)}</em>
      </p>
      <div class="lev-etf-stats">
        <span>범위 <b>${escapeHtml(scopeLabel)}</b></span>
        <span>발행 <b>${escapeHtml(item.issuer || "—")}</b></span>
      </div>
      <div class="lev-etf-quote">
        <span>가격 <strong>${price}</strong></span>
        <span>당일 <strong class="${chgCls}">${chg}</strong></span>
        <span>1M <strong class="${monthCls}">${month}</strong></span>
        <span>RS <strong>${rs}</strong></span>
      </div>
      ${hasLive ? "" : `<p class="lev-etf-note muted">스냅샷 미포함 · 카탈로그 참고용</p>`}
    </article>
  `;
}

// ===== RRG · 섹터 상대회전 그래프 (SPY 대비) =====
const RRG_QUADRANTS = [
  { key: "leading", label: "주도 (Leading)", color: "#16a34a" },
  { key: "weakening", label: "둔화 (Weakening)", color: "#d97706" },
  { key: "lagging", label: "소외 (Lagging)", color: "#dc2626" },
  { key: "improving", label: "회복 (Improving)", color: "#2563eb" },
];

function rrgBenchmarkSeries() {
  for (const t of ["SPY", "VOO", "IVV", "QQQ"]) {
    const s = stockByTicker(t);
    if (s && Array.isArray(s.closeSeries) && s.closeSeries.length >= 40) return { ticker: t, series: s.closeSeries };
  }
  return null;
}

function rrgComputePoint(etfCloses, benchCloses, tailLen) {
  const L = Math.min(etfCloses.length, benchCloses.length);
  if (L < 40) return null;
  const e = etfCloses.slice(-L);
  const b = benchCloses.slice(-L);
  const rel = [];
  for (let i = 0; i < L; i++) rel.push(b[i] ? e[i] / b[i] : NaN);
  const sma = (arr, idx, w) => {
    let sum = 0, count = 0;
    for (let k = idx - w + 1; k <= idx; k++) { if (k >= 0 && Number.isFinite(arr[k])) { sum += arr[k]; count++; } }
    return count ? sum / count : NaN;
  };
  const ratio = rel.map((v, i) => { const m = sma(rel, i, 20); return (Number.isFinite(v) && m) ? (v / m) * 100 : NaN; });
  const mom = ratio.map((v, i) => { const m = sma(ratio, i, 10); return (Number.isFinite(v) && m) ? (v / m) * 100 : NaN; });
  const last = ratio.length - 1;
  if (!Number.isFinite(ratio[last]) || !Number.isFinite(mom[last])) return null;
  const tail = [];
  for (let i = Math.max(0, ratio.length - tailLen); i < ratio.length; i++) {
    if (Number.isFinite(ratio[i]) && Number.isFinite(mom[i])) tail.push({ x: ratio[i], y: mom[i] });
  }
  return { x: ratio[last], y: mom[last], tail };
}

function rrgQuadrant(x, y) {
  if (x >= 100 && y >= 100) return "leading";
  if (x >= 100 && y < 100) return "weakening";
  if (x < 100 && y < 100) return "lagging";
  return "improving";
}

function renderRrg() {
  const wrap = byId("rrgWrap");
  const legendEl = byId("rrgLegend");
  const metaEl = byId("rrgMeta");
  if (!wrap) return;
  const bench = rrgBenchmarkSeries();
  if (!bench) {
    wrap.innerHTML = `<p class="muted">벤치마크(SPY 등) 가격 데이터를 찾지 못했습니다.</p>`;
    if (legendEl) legendEl.innerHTML = "";
    return;
  }
  const tailLen = Number(byId("rrgTail")?.value || 5);
  const points = [];
  SECTOR_ETFS.forEach((etf) => {
    const s = stockByTicker(etf.ticker);
    if (!s || !Array.isArray(s.closeSeries) || s.closeSeries.length < 40) return;
    const p = rrgComputePoint(s.closeSeries, bench.series, tailLen);
    if (p) points.push({ ...p, ticker: etf.ticker, name: etf.name, quad: rrgQuadrant(p.x, p.y) });
  });
  if (!points.length) {
    wrap.innerHTML = `<p class="muted">RRG를 그릴 ETF 가격 데이터가 부족합니다.</p>`;
    if (legendEl) legendEl.innerHTML = "";
    return;
  }
  const allX = points.flatMap((p) => [p.x, ...p.tail.map((t) => t.x)]);
  const allY = points.flatMap((p) => [p.y, ...p.tail.map((t) => t.y)]);
  const maxDev = Math.max(2, ...allX.map((v) => Math.abs(v - 100)), ...allY.map((v) => Math.abs(v - 100))) * 1.18;
  const lo = 100 - maxDev, hi = 100 + maxDev;
  const W = 640, H = 520, pad = 46;
  const sx = (x) => pad + ((x - lo) / (hi - lo)) * (W - pad * 2);
  const sy = (y) => H - pad - ((y - lo) / (hi - lo)) * (H - pad * 2);
  const cx = sx(100), cy = sy(100);
  const quads = `
    <rect x="${cx}" y="${pad}" width="${W - pad - cx}" height="${cy - pad}" fill="rgba(34,197,94,0.08)"/>
    <rect x="${cx}" y="${cy}" width="${W - pad - cx}" height="${H - pad - cy}" fill="rgba(245,158,11,0.08)"/>
    <rect x="${pad}" y="${cy}" width="${cx - pad}" height="${H - pad - cy}" fill="rgba(239,68,68,0.08)"/>
    <rect x="${pad}" y="${pad}" width="${cx - pad}" height="${cy - pad}" fill="rgba(59,130,246,0.08)"/>`;
  const quadLabels = `
    <text x="${W - pad - 6}" y="${pad + 15}" text-anchor="end" class="rrg-quad-label" fill="#16a34a">주도</text>
    <text x="${W - pad - 6}" y="${H - pad - 7}" text-anchor="end" class="rrg-quad-label" fill="#d97706">둔화</text>
    <text x="${pad + 6}" y="${H - pad - 7}" class="rrg-quad-label" fill="#dc2626">소외</text>
    <text x="${pad + 6}" y="${pad + 15}" class="rrg-quad-label" fill="#2563eb">회복</text>`;
  const axes = `
    <line x1="${pad}" y1="${cy}" x2="${W - pad}" y2="${cy}" stroke="#cbd5e1" stroke-width="1"/>
    <line x1="${cx}" y1="${pad}" x2="${cx}" y2="${H - pad}" stroke="#cbd5e1" stroke-width="1"/>
    <text x="${W - pad}" y="${cy - 7}" text-anchor="end" class="rrg-axis-label">상대강도 →</text>
    <text x="${cx + 6}" y="${pad + 2}" class="rrg-axis-label">상대모멘텀 ↑</text>`;
  const dots = points.map((p) => {
    const q = RRG_QUADRANTS.find((qq) => qq.key === p.quad);
    const color = q ? q.color : "#475569";
    const tailPath = p.tail.length > 1
      ? `<polyline points="${p.tail.map((t) => `${sx(t.x).toFixed(1)},${sy(t.y).toFixed(1)}`).join(" ")}" fill="none" stroke="${color}" stroke-width="1.4" stroke-opacity="0.45"/>`
      : "";
    const px = sx(p.x), py = sy(p.y);
    return `${tailPath}<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="5" fill="${color}"/><text x="${(px + 7).toFixed(1)}" y="${(py + 3).toFixed(1)}" class="rrg-dot-label">${escapeHtml(p.ticker)}</text>`;
  }).join("");
  wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="rrg-svg" role="img" aria-label="RRG 섹터 회전 그래프">${quads}${axes}${quadLabels}${dots}</svg>`;
  if (metaEl) metaEl.textContent = `벤치마크 ${bench.ticker} · ${points.length}개 섹터 ETF`;
  if (legendEl) {
    const byQuad = {};
    points.forEach((p) => { (byQuad[p.quad] = byQuad[p.quad] || []).push(p.ticker); });
    legendEl.innerHTML = RRG_QUADRANTS.map((q) => `
      <div class="rrg-leg-item">
        <span class="rrg-leg-dot" style="background:${q.color}"></span>
        <div><strong>${q.label}</strong><small>${(byQuad[q.key] || []).join(", ") || "—"}</small></div>
      </div>`).join("");
  }
}

// ===== 관심종목 상관관계 히트맵 =====
function corrPearson(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 10) return NaN;
  let sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { sa += a[i]; sb += b[i]; }
  const ma = sa / n, mb = sb / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y; }
  const den = Math.sqrt(da * db);
  return den ? num / den : NaN;
}

function corrDailyReturns(closes, lookback) {
  const arr = closes.slice(-lookback - 1);
  const out = [];
  for (let i = 1; i < arr.length; i++) { if (arr[i - 1]) out.push(arr[i] / arr[i - 1] - 1); }
  return out;
}

function corrColor(c) {
  if (!Number.isFinite(c)) return "#f1f5f9";
  if (c >= 0) return `rgba(239,68,68,${(0.10 + 0.80 * Math.min(1, c)).toFixed(2)})`;
  return `rgba(37,99,235,${(0.10 + 0.80 * Math.min(1, -c)).toFixed(2)})`;
}

function renderCorrelationMatrix() {
  const box = byId("corrMatrix");
  const meta = byId("corrMeta");
  if (!box) return;
  const lookback = 60;
  const tickers = (watchlist || []).slice(0, 14).filter((t) => {
    const s = stockByTicker(t);
    return s && Array.isArray(s.closeSeries) && s.closeSeries.length >= 20;
  });
  if (tickers.length < 2) {
    box.innerHTML = `<p class="muted">관심종목을 2개 이상 추가하면 상관관계가 표시됩니다. (가격 이력이 있는 종목 기준)</p>`;
    if (meta) meta.textContent = "";
    return;
  }
  const returns = {};
  tickers.forEach((t) => { returns[t] = corrDailyReturns(stockByTicker(t).closeSeries, lookback); });
  const head = `<th class="corr-corner"></th>` + tickers.map((t) => `<th class="corr-th">${escapeHtml(t)}</th>`).join("");
  const bodyRows = tickers.map((rt) => {
    const cells = tickers.map((ct) => {
      if (rt === ct) return `<td class="corr-cell corr-diag">1.00</td>`;
      const c = corrPearson(returns[rt], returns[ct]);
      const txt = Number.isFinite(c) ? c.toFixed(2) : "–";
      const strong = Number.isFinite(c) && Math.abs(c) >= 0.6;
      return `<td class="corr-cell${strong ? " corr-strong" : ""}" style="background:${corrColor(c)}" title="${escapeHtml(rt)} vs ${escapeHtml(ct)}: ${txt}">${txt}</td>`;
    }).join("");
    return `<tr><th class="corr-rowhead">${escapeHtml(rt)}</th>${cells}</tr>`;
  }).join("");
  box.innerHTML = `<table class="corr-table"><thead><tr>${head}</tr></thead><tbody>${bodyRows}</tbody></table>`;
  let sum = 0, cnt = 0, maxPair = null;
  for (let i = 0; i < tickers.length; i++) {
    for (let j = i + 1; j < tickers.length; j++) {
      const c = corrPearson(returns[tickers[i]], returns[tickers[j]]);
      if (Number.isFinite(c)) { sum += c; cnt++; if (!maxPair || c > maxPair.c) maxPair = { c, a: tickers[i], b: tickers[j] }; }
    }
  }
  if (meta) {
    meta.textContent = cnt
      ? `최근 ${lookback}거래일 · 평균 상관 ${(sum / cnt).toFixed(2)}${maxPair ? ` · 최고 ${maxPair.a}–${maxPair.b} ${maxPair.c.toFixed(2)}` : ""}`
      : `최근 ${lookback}거래일`;
  }
}

function renderLeveragedEtfPage() {
  const host = byId("levEtfGroups");
  const meta = byId("levEtfMeta");
  if (!host) return;

  const typeFilter = byId("levEtfType")?.value || "All";
  const scopeFilter = byId("levEtfScope")?.value || "All";
  const sort = byId("levEtfSort")?.value || "group";
  const query = (byId("levEtfSearch")?.value || "").trim().toLowerCase();

  let items = leveragedEtfCatalogItems().filter((item) => {
    if (typeFilter === "buffer" && !["buffer", "defined-outcome"].includes(item.type)) return false;
    else if (typeFilter !== "All" && item.type !== typeFilter) return false;
    if (scopeFilter !== "All" && item.scope !== scopeFilter) return false;
    if (!query) return true;
    const blob = `${item.ticker} ${item.name} ${item.underlying} ${item.underlyingLabel} ${item.group} ${item.issuer}`.toLowerCase();
    return blob.includes(query);
  });

  const liveCount = items.filter((item) => levEtfLiveRow(item.ticker)).length;
  if (meta) {
    meta.textContent = `총 ${items.length}개 · 스냅샷 시세 ${liveCount}개 · ${window.LEVERAGED_ETF_CATALOG?.updated || ""}`;
  }

  if (!items.length) {
    host.innerHTML = `<div class="empty-state">조건에 맞는 레버리지·인버스 ETF가 없습니다.</div>`;
    return;
  }

  if (sort === "change" || sort === "month") {
    const key = sort === "change" ? "changePct" : "monthChangePct";
    items.sort((a, b) => {
      const av = Number(levEtfLiveRow(a.ticker)?.[key]);
      const bv = Number(levEtfLiveRow(b.ticker)?.[key]);
      if (!Number.isFinite(av) && !Number.isFinite(bv)) return a.ticker.localeCompare(b.ticker);
      if (!Number.isFinite(av)) return 1;
      if (!Number.isFinite(bv)) return -1;
      return bv - av;
    });
    host.innerHTML = `
      <section class="lev-etf-section">
        <div class="lev-etf-section-head">
          <h3>검색 결과</h3>
          <span class="muted">${items.length}개</span>
        </div>
        <div class="rank-grid lev-etf-grid">${items.map((item) => levEtfCardHtml(item)).join("")}</div>
      </section>
    `;
  } else if (sort === "underlying") {
    items.sort((a, b) => `${a.underlyingLabel}|${a.ticker}`.localeCompare(`${b.underlyingLabel}|${b.ticker}`, "ko"));
    const groups = [];
    const map = new Map();
    items.forEach((item) => {
      const g = item.underlyingLabel || item.underlying || "기타";
      if (!map.has(g)) { map.set(g, []); groups.push(g); }
      map.get(g).push(item);
    });
    host.innerHTML = groups.map((group) => `
      <section class="lev-etf-section">
        <div class="lev-etf-section-head">
          <h3>${escapeHtml(group)}</h3>
          <span class="muted">${map.get(group).length}개</span>
        </div>
        <div class="rank-grid lev-etf-grid">${map.get(group).map((item) => levEtfCardHtml(item)).join("")}</div>
      </section>
    `).join("");
  } else {
    items.sort((a, b) => `${a.group}|${a.ticker}`.localeCompare(`${b.group}|${b.ticker}`, "ko"));
    const groups = [];
    const map = new Map();
    items.forEach((item) => {
      const g = item.group || "기타";
      if (!map.has(g)) { map.set(g, []); groups.push(g); }
      map.get(g).push(item);
    });
    host.innerHTML = groups.map((group) => `
      <section class="lev-etf-section">
        <div class="lev-etf-section-head">
          <h3>${escapeHtml(group)}</h3>
          <span class="muted">${map.get(group).length}개</span>
        </div>
        <div class="rank-grid lev-etf-grid">${map.get(group).map((item) => levEtfCardHtml(item)).join("")}</div>
      </section>
    `).join("");
  }

  host.querySelectorAll(".lev-etf-card").forEach((card) => {
    const open = () => {
      const ticker = card.dataset.ticker;
      if (!ticker) return;
      if (stockByTicker(ticker)) selectTicker(ticker, { openSearch: true });
    };
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
    });
  });
}

function showConstituentPanel(categoryName, period) {
  const payload = data.health?.etfRelative || { rows: [] };
  const row = (payload.rows || []).find((r) => r.category === categoryName);
  if (!row) return;

  const panel = byId("constituentPanel");
  byId("constituentPanelTicker").textContent = row.representative;
  byId("constituentPanelName").textContent = `${row.category} — ${row.name}`;
  
  // Sort ALL peers by the active period descending
  const allPeers = (row.peers || []).slice().sort((a, b) => (b[period] ?? 0) - (a[period] ?? 0));
  byId("constituentPanelCount").textContent = `${allPeers.length}개 구성 종목`;
  byId("constituentPeriodHeader").textContent = periodLabel(period) + " 수익률";

  byId("constituentPanelBody").innerHTML = allPeers.map((peer, idx) => {
    const spyRel = peer.relSPY?.[period] ?? (row.relative?.SPY?.[period] ?? 0);
    const qqqRel = peer.relQQQ?.[period] ?? (row.relative?.QQQ?.[period] ?? 0);
    const pct = peer[period] ?? 0;
    const rankIcon = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}`;
    return `
      <tr>
        <td><strong>${rankIcon}</strong></td>
        <td><strong class="ticker-link" onclick="selectTicker('${peer.ticker}');document.querySelector('[data-tab=search]').click()">${peer.ticker}</strong></td>
        <td>${peer.name || ""}</td>
        <td class="${cls(pct)}"><strong>${fmtPct(pct)}</strong></td>
        <td class="${cls(spyRel)}">${fmtPct(spyRel)}</td>
        <td class="${cls(qqqRel)}">${fmtPct(qqqRel)}</td>
      </tr>
    `;
  }).join("");

  panel.classList.add("is-open");
  byId("constituentBackdrop").classList.add("is-open");
}

function closeConstituentPanel() {
  byId("constituentPanel").classList.remove("is-open");
  byId("constituentBackdrop").classList.remove("is-open");
}


// AI briefing data pipeline: data.ai_briefing supports 4 keys (filled by the
// external generator). 국내 장전 / 미국 장마감 are wired but may be empty for now.
const BRIEFING_LABELS = {
  korea_premarket: "국내 증시 개장 전 심층 브리핑",
  korea_close: "국내 증시 장마감 시황 브리핑",
  us_premarket: "미국 증시 개장 전 심층 브리핑",
  us_close: "미국 증시 장마감 시황 브리핑"
};
const briefingSel = { kor: "korea_close", us: "us_premarket" };

function renderAiBriefing() {
  renderBriefingSide("kor");
  renderBriefingSide("us");
}

function renderBriefingSide(side) {
  const key = briefingSel[side];
  const el = byId(side === "kor" ? "koreaBriefingContent" : "usBriefingContent");
  if (!el) return;
  const html = (data.ai_briefing || {})[key];
  el.innerHTML = html || `
    <div class="empty-briefing">
      <strong>${BRIEFING_LABELS[key]}</strong><br>
      데이터가 아직 없습니다. 수집 파이프라인 실행 시 자동으로 표시됩니다.
    </div>`;
  const group = document.querySelector(`.briefing-toggle[data-side="${side}"]`);
  if (group) group.querySelectorAll("button").forEach((b) => b.classList.toggle("is-active", b.dataset.key === key));
}

function setupBriefingToggles() {
  document.querySelectorAll(".briefing-toggle").forEach((group) => {
    group.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        briefingSel[group.dataset.side] = btn.dataset.key;
        renderBriefingSide(group.dataset.side);
      });
    });
  });
}

function openSocialTicker(ticker) {
  if (!ticker || !stockByTicker(ticker)) return;
  selectTicker(ticker, { openSearch: true });
}

// 종목 분석 탭으로 이동한 뒤 차트 영역이 보이도록 스크롤한다.
function scrollCommunityToChart() {
  setTimeout(() => {
    const el = byId("chartTitle") || byId("sub-analysis");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 120);
}

function socialTickerCell(ticker) {
  const known = stockByTicker(ticker);
  if (!known) return `<strong>${escapeHtml(ticker)}</strong>`;
  return `<button type="button" class="ticker-link" data-ticker="${escapeHtml(ticker)}" title="종목 분석 보기">${escapeHtml(ticker)}</button>`;
}

function bindSocialSentimentClicks(tableIds) {
  const ids = tableIds || {
    reddit: "socialRedditTable",
    stocktwits: "socialStocktwitsTable",
    yahoo: "socialYahooTable",
  };
  const selector = [
    `#${ids.reddit} .ticker-link`,
    `#${ids.stocktwits} .ticker-link`,
    `#${ids.yahoo} .ticker-link`,
  ].join(", ");
  document.querySelectorAll(selector).forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      openSocialTicker(btn.dataset.ticker);
    });
  });
  [
    `#${ids.reddit} tr[data-ticker]`,
    `#${ids.stocktwits} tr[data-ticker]`,
    `#${ids.yahoo} tr[data-ticker]`,
  ].forEach((rowSel) => {
    document.querySelectorAll(rowSel).forEach((row) => {
      row.addEventListener("click", () => openSocialTicker(row.dataset.ticker));
    });
  });
}

function renderSocialSentimentTables(tableIds) {
  const ids = tableIds || {
    reddit: "socialRedditTable",
    stocktwits: "socialStocktwitsTable",
    yahoo: "socialYahooTable",
  };
  const social = data.social_sentiment || {};
  const redditEl = byId(ids.reddit);
  const stocktwitsEl = byId(ids.stocktwits);
  const yahooEl = byId(ids.yahoo);
  if (!redditEl || !stocktwitsEl || !yahooEl) return;

  const redditRows = social.reddit || [];
  if (redditRows.length > 0) {
    redditEl.innerHTML = redditRows.map((item, idx) => `
      <tr class="social-row" data-ticker="${escapeHtml(item.ticker)}">
        <td>${idx + 1}</td>
        <td>${socialTickerCell(item.ticker)}</td>
        <td>${escapeHtml(item.name || "")}</td>
        <td>${Number(item.mentions || 0).toLocaleString()}</td>
        <td class="${cls(item.change24h || 0)}">${fmtPct(item.change24h || 0)}</td>
      </tr>
    `).join("");
  } else {
    redditEl.innerHTML = `<tr><td colspan="5" class="text-center" style="padding: 20px; text-align: center; color: var(--text-muted);">데이터 없음</td></tr>`;
  }

  const stocktwitsRows = social.stocktwits || [];
  if (stocktwitsRows.length > 0) {
    stocktwitsEl.innerHTML = stocktwitsRows.map((item, idx) => `
      <tr class="social-row" data-ticker="${escapeHtml(item.ticker)}">
        <td>${idx + 1}</td>
        <td>${socialTickerCell(item.ticker)}</td>
        <td>${escapeHtml(item.name || "")}</td>
        <td>${Number(item.watchlist_count || 0).toLocaleString()}</td>
      </tr>
    `).join("");
  } else {
    stocktwitsEl.innerHTML = `<tr><td colspan="4" class="text-center" style="padding: 20px; text-align: center; color: var(--text-muted);">데이터 없음</td></tr>`;
  }

  const yahooRows = social.yahoo || [];
  if (yahooRows.length > 0) {
    yahooEl.innerHTML = yahooRows.map((item, idx) => `
      <tr class="social-row" data-ticker="${escapeHtml(item.ticker)}">
        <td>${idx + 1}</td>
        <td>${socialTickerCell(item.ticker)}</td>
        <td>${escapeHtml(item.name || "")}</td>
        <td class="${cls(item.changePct || 0)}">${escapeHtml(item.price || "-")}${item.changePct ? ` (${fmtPct(item.changePct)})` : ""}</td>
      </tr>
    `).join("");
  } else {
    yahooEl.innerHTML = `<tr><td colspan="4" class="text-center" style="padding: 20px; text-align: center; color: var(--text-muted);">데이터 없음</td></tr>`;
  }
  bindSocialSentimentClicks(ids);
}

function renderSocialSentiment() {
  renderSocialSentimentTables();
}

const COMMUNITY_SNS_CHANNELS = [
  {
    id: "instagram",
    name: "Instagram",
    className: "sl-instagram",
    href: "https://www.instagram.com/seonu_dragon/",
    tag: "카드뉴스",
    desc: "매일 정리된 시장 카드뉴스와 핵심 차트를 이미지로 빠르게 확인할 수 있습니다.",
    cta: "인스타그램 보기",
  },
  {
    id: "x",
    name: "X (Twitter)",
    className: "sl-x",
    href: "https://x.com/dragon_seonu",
    tag: "장 전·후 요약",
    desc: "미국·국내 장 전·후 핵심 포인트를 짧게 정리해 올립니다. 실시간 시황 코멘트의 메인 채널입니다.",
    cta: "X 팔로우",
  },
  {
    id: "threads",
    name: "Threads",
    className: "sl-threads",
    href: "https://www.threads.com/@seonu_dragon",
    tag: "짧은 코멘트",
    desc: "시장 이슈에 대한 짧은 코멘트와 소식을 가볍게 받아볼 수 있습니다.",
    cta: "Threads 보기",
  },
  {
    id: "naver",
    name: "네이버 블로그",
    className: "sl-naver",
    href: "https://blog.naver.com/ted_inc",
    tag: "심층 분석",
    desc: "더 긴 호흡의 시장 분석, 데이터 해설, 투자 아이디어를 글로 깊게 읽을 수 있습니다.",
    cta: "블로그 방문",
  },
];

function getCardNewsSets() {
  const cn = data.cardNews || {};
  return {
    us: cn.us && Array.isArray(cn.us.images) && cn.us.images.length ? cn.us : null,
    kr: cn.kr && Array.isArray(cn.kr.images) && cn.kr.images.length ? cn.kr : null,
  };
}

function renderCommunityCardNews() {
  const block = byId("communityCardnewsBlock");
  const gallery = byId("communityCardnewsGallery");
  const titleEl = byId("communityCardnewsTitle");
  const switchEl = byId("communityCardnewsSwitch");
  if (!block || !gallery) return;

  const sets = getCardNewsSets();
  if (!sets.us && !sets.kr) {
    block.hidden = true;
    return;
  }
  block.hidden = false;
  if (!sets[communityCardnewsView]) communityCardnewsView = sets.us ? "us" : "kr";

  if (switchEl) {
    switchEl.querySelectorAll("[data-cn]").forEach((btn) => {
      const v = btn.dataset.cn;
      btn.disabled = !sets[v];
      btn.classList.toggle("is-active", v === communityCardnewsView && !!sets[v]);
      btn.onclick = () => {
        if (!sets[v] || v === communityCardnewsView) return;
        communityCardnewsView = v;
        renderCommunityCardNews();
      };
    });
  }

  const active = sets[communityCardnewsView];
  if (titleEl) {
    titleEl.textContent = active.title || (communityCardnewsView === "us" ? "미국 시장 카드뉴스" : "국내 시장 카드뉴스");
  }

  const cardHtml = (src, idx) => `
    <figure class="community-cardnews-card" data-idx="${idx}" role="button" tabindex="0" aria-label="카드뉴스 ${idx + 1} 크게 보기">
      <img src="${escapeHtml(src)}" alt="카드뉴스 ${idx + 1}" loading="lazy" decoding="async">
    </figure>
  `;
  const row3 = active.images.slice(0, 3);
  const row2 = active.images.slice(3);
  gallery.innerHTML = `
    <div class="community-cardnews-row community-cardnews-row-3">
      ${row3.map((src, idx) => cardHtml(src, idx)).join("")}
    </div>
    ${row2.length ? `
    <div class="community-cardnews-row community-cardnews-row-2">
      ${row2.map((src, idx) => cardHtml(src, idx + 3)).join("")}
    </div>
    ` : ""}
  `;

  gallery.querySelectorAll(".community-cardnews-card").forEach((card) => {
    const open = () => openLightbox(active.images, Number(card.dataset.idx) || 0);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });
}

function renderCommunityNews() {
  renderCommunityCardNews();
  const grid = byId("communitySnsGrid");
  if (!grid) return;
  grid.innerHTML = COMMUNITY_SNS_CHANNELS.map((ch) => `
    <article class="community-sns-card ${ch.className}">
      <div class="community-sns-head">
        <span class="community-sns-tag">${escapeHtml(ch.tag)}</span>
        <h3>${escapeHtml(ch.name)}</h3>
      </div>
      <p>${escapeHtml(ch.desc)}</p>
      <a class="community-sns-cta" href="${escapeHtml(ch.href)}" target="_blank" rel="noopener">${escapeHtml(ch.cta)} →</a>
    </article>
  `).join("");
}

function computeCommunityHotTopics(limit = 8) {
  const social = data.social_sentiment || {};
  const scores = new Map();
  const add = (ticker, weight, source) => {
    const t = String(ticker || "").toUpperCase();
    if (!t) return;
    const prev = scores.get(t) || { ticker: t, score: 0, sources: new Set() };
    prev.score += weight;
    prev.sources.add(source);
    scores.set(t, prev);
  };
  (social.reddit || []).forEach((item, idx) => add(item.ticker, Math.max(1, 12 - idx) + Math.min(6, (item.mentions || 0) / 200), "reddit"));
  (social.stocktwits || []).forEach((item, idx) => add(item.ticker, Math.max(1, 10 - idx), "stocktwits"));
  (social.yahoo || []).forEach((item, idx) => add(item.ticker, Math.max(1, 8 - idx), "yahoo"));
  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function renderCommunityHotTopics() {
  const el = byId("communityHotTopics");
  if (!el) return;
  const topics = computeCommunityHotTopics();
  if (!topics.length) {
    el.innerHTML = `<p class="muted">소셜 트렌드 데이터가 아직 없습니다. AI 브리핑 파이프라인 실행 후 표시됩니다.</p>`;
    return;
  }
  el.innerHTML = `
    <div class="community-hot-head">
      <strong>지금 가장 뜨거운 종목</strong>
      <span class="muted">Reddit · Stocktwits · Yahoo 종합</span>
    </div>
    <div class="community-hot-grid">
      ${topics.map((topic, idx) => {
        const stock = stockByTicker(topic.ticker);
        const sources = [...topic.sources].map((s) => ({
          reddit: "Reddit",
          stocktwits: "Stocktwits",
          yahoo: "Yahoo",
        }[s] || s)).join(" · ");
        const change = stock ? stock.changePct : null;
        return `
          <button type="button" class="community-hot-card" data-ticker="${escapeHtml(topic.ticker)}">
            <div class="community-hot-top">
              <span class="community-hot-rank">#${idx + 1}</span>
              <span class="community-hot-ticker">${escapeHtml(topic.ticker)}</span>
              <span class="community-hot-change ${change == null ? "" : cls(change)}">${change == null ? "—" : fmtPct(change)}</span>
            </div>
            <span class="community-hot-name" title="${escapeHtml(stock ? stock.company : "")}">${escapeHtml(stock ? stock.company : "—")}</span>
            <span class="community-hot-sources">${escapeHtml(sources)}</span>
          </button>
        `;
      }).join("")}
    </div>
  `;
  el.querySelectorAll(".community-hot-card").forEach((card) => {
    card.addEventListener("click", () => openSocialTicker(card.dataset.ticker));
  });
}

function renderCommunityTrending() {
  renderSocialSentimentTables({
    reddit: "communityRedditTable",
    stocktwits: "communityStocktwitsTable",
    yahoo: "communityYahooTable",
  });
  renderCommunityHotTopics();
}

const COMMUNITY_NICKNAME_KEY = "mir_community_nickname_v1";
const COMMUNITY_CLIENT_KEY = "mir_community_client_v1";
const COMMUNITY_POLL_MS = 12000;

let communityPostsCache = [];
let communityBoardError = "";
let communityPollTimer = null;
let communityFetchPromise = null;
let communityReplyPostId = null;
let communitySortMode = "latest";
const COMMUNITY_PAGE_SIZE = 10;
let communityBoardPage = 1;
const COMMUNITY_MINICHART_KEY = "mir_community_minichart_v1";
let communityShowMiniChart = localStorage.getItem(COMMUNITY_MINICHART_KEY) !== "0";
// 새 글/댓글 배너용 — 마지막으로 본 글·댓글 id 집합(null이면 첫 로드 전).
let communitySeenPostIds = null;
let communitySeenCommentIds = null;
let communityNewCount = 0;
const COMMUNITY_HIDDEN_KEY = "mir_community_hidden_v1";
const COMMUNITY_ADMIN_KEY_LS = "mir_community_admin_key_v1";
let communityVotePeriod = "day";

function getCommunityHiddenIds() {
  try {
    const arr = JSON.parse(localStorage.getItem(COMMUNITY_HIDDEN_KEY) || "[]");
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (_) {
    return new Set();
  }
}

function addCommunityHiddenId(id) {
  const set = getCommunityHiddenIds();
  set.add(id);
  localStorage.setItem(COMMUNITY_HIDDEN_KEY, JSON.stringify([...set]));
}

function clearCommunityHiddenIds() {
  localStorage.removeItem(COMMUNITY_HIDDEN_KEY);
}

function getCommunityAdminKey() {
  return localStorage.getItem(COMMUNITY_ADMIN_KEY_LS) || "";
}

function setCommunityAdminKey(key) {
  if (key) localStorage.setItem(COMMUNITY_ADMIN_KEY_LS, String(key));
}

function isCommunityAdmin() {
  return Boolean(getCommunityAdminKey());
}

function getCommunityNickname() {
  return (localStorage.getItem(COMMUNITY_NICKNAME_KEY) || "").trim();
}

function setCommunityNickname(name) {
  localStorage.setItem(COMMUNITY_NICKNAME_KEY, String(name || "").trim().slice(0, 20));
}

function getCommunityClientId() {
  let id = localStorage.getItem(COMMUNITY_CLIENT_KEY);
  if (!id) {
    id = `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(COMMUNITY_CLIENT_KEY, id);
  }
  return id;
}

function communityApiUrl(path = "") {
  if (!LIVE_DATA_PROXY) return "";
  const base = LIVE_DATA_PROXY.replace(/\/$/, "");
  return `${base}${path}`;
}

function startCommunityPolling() {
  stopCommunityPolling();
  if (!LIVE_DATA_PROXY) return;
  communityPollTimer = setInterval(() => {
    if (currentTab === "community" && communitySubTab === "board") {
      fetchCommunityPosts({ silent: true });
    }
  }, COMMUNITY_POLL_MS);
}

function stopCommunityPolling() {
  if (communityPollTimer) {
    clearInterval(communityPollTimer);
    communityPollTimer = null;
  }
}

function resolveCommunityTickerInput(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";
  const direct = text.toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
  if (direct && stockByTicker(direct)) return direct;
  const resolved = resolveTickerQuery(text);
  return resolved || direct;
}

function formatCommunityTime(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function communityLikeCount(post) {
  return Array.isArray(post && post.likes) ? post.likes.length : 0;
}

function communityLikedByMe(post) {
  return Array.isArray(post && post.likes) && post.likes.includes(getCommunityClientId());
}

function communityCommentCount(post) {
  return Array.isArray(post && post.comments) ? post.comments.length : 0;
}

function communityTimeVal(post) {
  const t = Date.parse(post && post.createdAt);
  return Number.isFinite(t) ? t : 0;
}

// 게시판에 등장한 작성자 닉네임 목록(긴 이름 우선 — 부분 일치 충돌 방지).
function communityKnownAuthors() {
  const names = new Set();
  communityPostsCache.forEach((p) => {
    if (p && p.author) names.add(p.author);
    (Array.isArray(p && p.comments) ? p.comments : []).forEach((c) => {
      if (c && c.author) names.add(c.author);
    });
  });
  return [...names].filter(Boolean).sort((a, b) => b.length - a.length);
}

// 본문·댓글의 @닉네임 멘션을 강조 span으로 변환한다(이미 escapeHtml 된 문자열에 적용).
// 닉네임에 공백이 있을 수 있어(예: "젠슨 황") 실제 참여자 이름만 1패스로 매칭한다.
function highlightCommunityMentions(escaped) {
  const text = String(escaped);
  const names = communityKnownAuthors();
  if (!names.length || text.indexOf("@") < 0) return text;
  const pattern = names
    .map((n) => escapeHtml(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const re = new RegExp(`@(${pattern})`, "g");
  return text.replace(re, (m, name) => `<span class="community-mention">@${name}</span>`);
}

// 종목 글 하단 미니 스파크라인(스냅샷 closeSeries 사용, 비동기 없음).
function communityMiniChartHtml(ticker) {
  if (!communityShowMiniChart) return "";
  const stock = ticker ? stockByTicker(ticker) : null;
  const series = stock && Array.isArray(stock.closeSeries) ? stock.closeSeries : null;
  if (!series || series.length < 2) return "";
  const color = (stock.changePct ?? 0) >= 0 ? "#138a4d" : "#c03535";
  return `<div class="community-post-spark">${sparklineSvg(series, { width: 160, height: 40, color })}</div>`;
}

// 닉네임 기반 일관 색상 아바타(로그인 없는 익명 작성자 시각 구분).
function communityAvatarColor(name) {
  const str = String(name || "익명");
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return `hsl(${hash % 360}, 55%, 45%)`;
}

function communityAvatarHtml(name) {
  const label = String(name || "익명").trim();
  const initial = label ? Array.from(label)[0].toUpperCase() : "?";
  return `<span class="community-avatar" style="background:${communityAvatarColor(label)}" aria-hidden="true">${escapeHtml(initial)}</span>`;
}

// ----- 신고: 신고자 본인 화면에서만 가림 + 관리자에게 신고 로그 전송 -----
async function reportCommunityPost(postId) {
  if (!postId) return;
  const reason = prompt("신고 사유를 적어주세요(선택). 신고한 글은 내 화면에서 가려지고, 관리자가 검토합니다.", "");
  if (reason === null) return; // 취소
  addCommunityHiddenId(postId);
  renderCommunityBoard();
  const url = communityApiUrl("/community/report");
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, clientId: getCommunityClientId(), reason: String(reason || "").slice(0, 200) }),
    });
  } catch (_) {}
}

// ===== 투표 페이지 (하루 1표 · 일/주/월 순위) =====
let communityVoteSelectedChoice = null;
let communityVoteMyToday = null;

const COMMUNITY_VOTE_META = {
  buy: { label: "매수", color: "var(--green)" },
  sell: { label: "매도", color: "var(--red)" },
};

function renderCommunityVote() {
  const choicesBox = byId("communityVoteChoices");
  if (choicesBox) {
    choicesBox.querySelectorAll(".community-vote-choice").forEach((btn) => {
      btn.classList.toggle("is-selected", btn.dataset.choice === communityVoteSelectedChoice);
    });
  }
  byId("communityVoteRankTabs")?.querySelectorAll(".community-rank-tab").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.period === communityVotePeriod);
  });
  const mine = byId("communityVoteMine");
  if (mine) {
    mine.textContent = communityVoteMyToday
      ? `오늘 내 투표: ${escapeHtml(communityVoteMyToday.ticker)} · ${COMMUNITY_VOTE_META[communityVoteMyToday.choice]?.label || communityVoteMyToday.choice} (다시 투표하면 교체됩니다)`
      : "오늘은 아직 투표하지 않았습니다.";
  }
  fetchCommunityVotes();
}

async function fetchCommunityVotes() {
  const box = byId("communityVoteRanking");
  if (!box) return;
  const url = communityApiUrl(`/community/votes?period=${encodeURIComponent(communityVotePeriod)}&clientId=${encodeURIComponent(getCommunityClientId())}`);
  if (!url) { box.innerHTML = `<div class="community-empty">투표 기능을 사용할 수 없습니다.</div>`; return; }
  box.innerHTML = `<div class="community-empty">순위를 불러오는 중…</div>`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "load_failed");
    communityVoteMyToday = data.myToday || null;
    const mine = byId("communityVoteMine");
    if (mine) {
      mine.textContent = communityVoteMyToday
        ? `오늘 내 투표: ${communityVoteMyToday.ticker} · ${COMMUNITY_VOTE_META[communityVoteMyToday.choice]?.label || communityVoteMyToday.choice} (다시 투표하면 교체됩니다)`
        : "오늘은 아직 투표하지 않았습니다.";
    }
    renderCommunityVoteRanking(data.buyRanking || [], data.sellRanking || [], data.totalVotes || 0);
  } catch (err) {
    box.innerHTML = `<div class="community-empty">순위를 불러오지 못했습니다.</div>`;
  }
}

function communityVoteRankColHtml(rows, kind) {
  const meta = COMMUNITY_VOTE_META[kind];
  if (!rows.length) {
    return `
      <div class="community-vote-rank-col">
        <h3 class="community-vote-rank-title community-vote-${kind}">${kind === "buy" ? "📈" : "📉"} ${meta.label} 순위</h3>
        <div class="community-empty">아직 ${meta.label} 투표가 없습니다.</div>
      </div>`;
  }
  return `
    <div class="community-vote-rank-col">
      <h3 class="community-vote-rank-title community-vote-${kind}">${kind === "buy" ? "📈" : "📉"} ${meta.label} 순위</h3>
      <div class="community-vote-rank-list">
        ${rows.map((row, i) => {
          const stock = stockByTicker(row.ticker);
          const count = kind === "buy" ? row.buy : row.sell;
          return `
            <div class="community-vote-rank-row">
              <span class="community-vote-rank-num">${i + 1}</span>
              <button type="button" class="ticker-pill community-vote-rank-ticker" data-ticker="${escapeHtml(row.ticker)}">${escapeHtml(row.ticker)}</button>
              <span class="community-vote-rank-company muted">${stock ? escapeHtml(stock.company) : ""}</span>
              <span class="community-vote-rank-count community-vote-${kind}">${count}표</span>
              <span class="community-vote-rank-sub muted">전체 ${row.total}</span>
            </div>`;
        }).join("")}
      </div>
    </div>`;
}

function renderCommunityVoteRanking(buyRanking, sellRanking, totalVotes) {
  const box = byId("communityVoteRanking");
  if (!box) return;
  const periodLabel = communityVotePeriod === "month" ? "월간" : communityVotePeriod === "week" ? "주간" : "일간";
  if (!buyRanking.length && !sellRanking.length) {
    box.innerHTML = `<div class="community-empty">${periodLabel} 투표가 아직 없습니다. 첫 투표를 남겨보세요.</div>`;
    return;
  }
  box.innerHTML = `
    <p class="muted community-vote-rank-meta">${periodLabel} 총 ${totalVotes}표</p>
    <div class="community-vote-rank-cols">
      ${communityVoteRankColHtml(buyRanking, "buy")}
      ${communityVoteRankColHtml(sellRanking, "sell")}
    </div>
  `;
  box.querySelectorAll(".community-vote-rank-ticker").forEach((btn) => {
    btn.addEventListener("click", () => openSocialTicker(btn.dataset.ticker));
  });
}

async function submitCommunityVote() {
  const tickerInput = byId("communityVoteTicker");
  const raw = (tickerInput?.value || "").trim();
  const ticker = raw ? resolveCommunityTickerInput(raw) : "";
  if (!ticker) { alert("투표할 종목을 입력해주세요."); return; }
  if (!communityVoteSelectedChoice) { alert("매수·매도·관망 중 하나를 선택해주세요."); return; }
  const url = communityApiUrl("/community/vote");
  if (!url) { alert("투표 기능을 사용할 수 없습니다."); return; }
  const btn = byId("communityVoteSubmit");
  if (btn) btn.disabled = true;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker, choice: communityVoteSelectedChoice, clientId: getCommunityClientId() }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.message || data.error || "투표 실패");
      return;
    }
    communityVoteSelectedChoice = null;
    if (tickerInput) tickerInput.value = "";
    renderCommunityVote();
  } catch (err) {
    alert((err && err.message) || "투표에 실패했습니다.");
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ===== 관리자 신고 내역 패널 =====
async function renderCommunityAdminPanel() {
  const panel = byId("communityAdminPanel");
  if (!panel) return;
  if (!isCommunityAdmin()) { panel.hidden = true; panel.innerHTML = ""; return; }
  const url = communityApiUrl(`/community/reports?adminKey=${encodeURIComponent(getCommunityAdminKey())}`);
  if (!url) { panel.hidden = true; return; }
  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      panel.hidden = false;
      panel.innerHTML = `<div class="community-admin-head"><strong>🛡 관리자 · 신고 내역</strong></div><p class="muted">권한 확인 실패(키를 확인하세요).</p>`;
      return;
    }
    const posts = data.posts || [];
    panel.hidden = false;
    panel.innerHTML = `
      <div class="community-admin-head">
        <strong>🛡 관리자 · 신고 내역 ${posts.length}건</strong>
        <button type="button" class="ghost compact-btn" id="communityAdminRefresh">새로고침</button>
      </div>
      ${posts.length ? posts.map((p) => `
        <div class="community-admin-item">
          <div class="community-admin-item-head">
            <span class="community-admin-count">신고 ${p.reportCount}</span>
            ${p.ticker ? `<span class="community-post-tag">${escapeHtml(p.ticker)}</span>` : ""}
            <span class="community-post-author">${escapeHtml(p.author || "익명")}</span>
            <time class="muted">${escapeHtml(formatCommunityTime(p.createdAt))}</time>
            <button type="button" class="ghost compact-btn community-admin-delete" data-id="${escapeHtml(p.id)}">글 삭제</button>
          </div>
          <p class="community-admin-item-body">${escapeHtml(p.content)}</p>
          <p class="community-admin-reasons muted">사유: ${escapeHtml((p.reports || []).map((r) => r.reason || "(없음)").join(" · "))}</p>
        </div>
      `).join("") : `<p class="muted">신고된 글이 없습니다.</p>`}
    `;
    byId("communityAdminRefresh")?.addEventListener("click", renderCommunityAdminPanel);
    panel.querySelectorAll(".community-admin-delete").forEach((btn) => {
      btn.addEventListener("click", () => adminDeleteCommunityPost(btn.dataset.id));
    });
  } catch (_) {
    panel.hidden = true;
  }
}

async function adminDeleteCommunityPost(id) {
  if (!id || !confirm("이 글을 삭제할까요? (관리자 권한)")) return;
  const url = communityApiUrl("/community");
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, clientId: getCommunityClientId(), adminKey: getCommunityAdminKey() }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || "삭제 실패"); return; }
    await fetchCommunityPosts({ silent: true });
    renderCommunityAdminPanel();
  } catch (err) {
    alert((err && err.message) || "삭제 실패");
  }
}

// ----- 작성 후 내 글로 스크롤 + 강조 -----
function communityHighlightPost(id) {
  setTimeout(() => {
    const feed = byId("communityFeed");
    const el = feed?.querySelector(`.community-post[data-id="${CSS.escape(id)}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("is-mine-new");
    setTimeout(() => el.classList.remove("is-mine-new"), 2400);
  }, 120);
}

// ----- 새 글/댓글 배너 -----
function communityCollectIds(posts) {
  const postIds = new Set();
  const commentIds = new Set();
  (posts || []).forEach((p) => {
    postIds.add(p.id);
    (Array.isArray(p.comments) ? p.comments : []).forEach((c) => commentIds.add(c.id));
  });
  return { postIds, commentIds };
}

function communityUpdateNewBanner(posts) {
  const { postIds, commentIds } = communityCollectIds(posts);
  if (communitySeenPostIds === null) {
    communitySeenPostIds = postIds;
    communitySeenCommentIds = commentIds;
    return;
  }
  let newPosts = 0;
  let newComments = 0;
  postIds.forEach((id) => { if (!communitySeenPostIds.has(id)) newPosts += 1; });
  commentIds.forEach((id) => { if (!communitySeenCommentIds.has(id)) newComments += 1; });
  communityNewCount += newPosts + newComments;
  const banner = byId("communityNewBanner");
  if (banner && communityNewCount > 0) {
    banner.hidden = false;
    banner.textContent = `🔔 새 소식 ${communityNewCount}건 · 맨 위로`;
  }
  communitySeenPostIds = postIds;
  communitySeenCommentIds = commentIds;
}

function communityClearNewBanner() {
  communityNewCount = 0;
  const banner = byId("communityNewBanner");
  if (banner) { banner.hidden = true; banner.textContent = ""; }
}

async function toggleCommunityLike(postId) {
  if (!postId) return;
  const url = communityApiUrl("/community/like");
  if (!url) {
    alert("게시판을 일시적으로 사용할 수 없습니다.");
    return;
  }
  const clientId = getCommunityClientId();
  // 낙관적 업데이트(서버 응답 전 즉시 반영)
  const cached = communityPostsCache.find((p) => p.id === postId);
  if (cached) {
    const likes = Array.isArray(cached.likes) ? cached.likes.slice() : [];
    const i = likes.indexOf(clientId);
    if (i >= 0) likes.splice(i, 1); else likes.push(clientId);
    cached.likes = likes;
    renderCommunityBoard();
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, clientId }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error === "no_community_kv" ? "게시판을 일시적으로 사용할 수 없습니다." : (data.error || "공감 처리 실패"));
    }
    await fetchCommunityPosts({ silent: true });
  } catch (err) {
    await fetchCommunityPosts({ silent: true });
  }
}

// 댓글의 작성자를 멘션하며 답글 입력칸을 연다(@닉네임 프리필).
function openCommunityReplyWithMention(postId, author) {
  const feed = byId("communityFeed");
  if (!feed) return;
  communityReplyPostId = postId;
  renderCommunityBoard();
  const input = feed.querySelector(`.community-reply-input[data-post-id="${CSS.escape(postId)}"]`);
  if (input) {
    const mention = `@${String(author || "익명").trim()} `;
    if (!input.value.startsWith(mention)) input.value = mention + input.value;
    input.focus();
    const end = input.value.length;
    try { input.setSelectionRange(end, end); } catch (_) {}
  }
}

// 인기 종목 토론 랭킹(글 수 기준 TOP5) 칩 렌더 + 클릭 시 해당 종목 필터.
function renderCommunityHotTickersPanel() {
  const box = byId("communityHotTickers");
  if (!box) return;
  const counts = new Map();
  communityPostsCache.forEach((p) => {
    if (p.ticker) counts.set(p.ticker, (counts.get(p.ticker) || 0) + 1);
  });
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (!top.length) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  const activeTicker = resolveCommunityTickerInput(byId("communityFilterTicker")?.value || "");
  box.hidden = false;
  box.innerHTML = `
    <span class="community-hot-tickers-label">🔥 인기 종목</span>
    ${top.map(([ticker, count]) => `
      <button type="button" class="community-hot-ticker${activeTicker === ticker ? " is-active" : ""}" data-ticker="${escapeHtml(ticker)}">
        ${escapeHtml(ticker)}<em>${count}</em>
      </button>
    `).join("")}
    ${activeTicker ? `<button type="button" class="community-hot-ticker community-hot-clear" data-clear="1">전체 보기</button>` : ""}
  `;
  box.querySelectorAll(".community-hot-ticker[data-ticker]").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyCommunityBoardTickerFilter(btn.dataset.ticker);
      renderCommunityBoard();
    });
  });
  box.querySelector(".community-hot-clear")?.addEventListener("click", () => {
    const input = byId("communityFilterTicker");
    if (input) input.value = "";
    communityBoardTickerFilter = "";
    communityBoardPage = 1;
    renderCommunityBoard();
  });
}

function filterCommunityPostsView(posts) {
  const filterMode = byId("communityFilter")?.value || "all";
  const filterTicker = resolveCommunityTickerInput(byId("communityFilterTicker")?.value || "");
  const clientId = getCommunityClientId();
  const hidden = getCommunityHiddenIds();
  let filtered = posts.filter((p) => !hidden.has(p.id));
  if (filterMode === "mine") {
    filtered = filtered.filter((p) => p.clientId === clientId);
  } else if (filterMode === "watchlist") {
    const set = new Set((Array.isArray(watchlist) ? watchlist : []).map((t) => String(t).toUpperCase()));
    filtered = filtered.filter((p) => p.ticker && set.has(String(p.ticker).toUpperCase()));
  }
  if (filterTicker) {
    filtered = filtered.filter((p) => p.ticker === filterTicker);
  }
  // 정렬: 인기순(공감+댓글) / 댓글순 / 최신순
  if (communitySortMode === "popular") {
    filtered.sort((a, b) =>
      (communityLikeCount(b) + communityCommentCount(b)) - (communityLikeCount(a) + communityCommentCount(a))
      || communityTimeVal(b) - communityTimeVal(a));
  } else if (communitySortMode === "comments") {
    filtered.sort((a, b) => communityCommentCount(b) - communityCommentCount(a) || communityTimeVal(b) - communityTimeVal(a));
  } else {
    filtered.sort((a, b) => communityTimeVal(b) - communityTimeVal(a));
  }
  return filtered;
}

function renderCommunityBoard() {
  const feed = byId("communityFeed");
  const meta = byId("communityBoardMeta");
  const nickInput = byId("communityNickname");
  if (!feed || !meta) return;

  if (nickInput && !nickInput.value) nickInput.value = getCommunityNickname();

  const filterTicker = resolveCommunityTickerInput(byId("communityFilterTicker")?.value || "");
  const posts = filterCommunityPostsView(communityPostsCache);
  const clientId = getCommunityClientId();

  renderCommunityHotTickersPanel();
  renderCommunityAdminPanel();

  if (communityFetchPromise && !communityPostsCache.length && !communityBoardError) {
    meta.textContent = "글을 불러오는 중…";
    feed.innerHTML = `<div class="community-empty">게시판을 연결하는 중입니다.</div>`;
    return;
  }

  if (!posts.length) {
    meta.textContent = communityBoardError ? "글을 불러오지 못했습니다." : "아직 등록된 글이 없습니다. 첫 글을 남겨보세요.";
    feed.innerHTML = `<div class="community-empty">${communityBoardError ? "게시판 연결을 확인한 뒤 새로고침해 주세요." : "트렌딩 탭에서 관심 종목을 보고, 종목 없이도 시장 의견을 남길 수 있습니다."}</div>`;
    renderCommunityPagination(0);
    return;
  }

  // 10개 단위 페이지네이션
  const totalPages = Math.max(1, Math.ceil(posts.length / COMMUNITY_PAGE_SIZE));
  if (communityBoardPage > totalPages) communityBoardPage = totalPages;
  if (communityBoardPage < 1) communityBoardPage = 1;
  const pageStart = (communityBoardPage - 1) * COMMUNITY_PAGE_SIZE;
  const pagePosts = posts.slice(pageStart, pageStart + COMMUNITY_PAGE_SIZE);

  meta.textContent = `${posts.length}개 글${filterTicker ? ` · ${filterTicker} 필터` : ""}`
    + (totalPages > 1 ? ` · ${communityBoardPage}/${totalPages}페이지` : "");

  // 재렌더(특히 12초 자동 새로고침) 시 작성 중이던 댓글 입력이 사라지지 않도록
  // 열려 있는 답글 입력칸의 내용·커서·포커스를 미리 보존한다.
  const openReply = communityReplyPostId
    ? feed.querySelector(`.community-reply-input[data-post-id="${CSS.escape(communityReplyPostId)}"]`)
    : null;
  const replyDraft = openReply
    ? {
        value: openReply.value,
        start: openReply.selectionStart,
        end: openReply.selectionEnd,
        focused: document.activeElement === openReply,
      }
    : null;

  feed.innerHTML = pagePosts.map((post) => {
    const stock = post.ticker ? stockByTicker(post.ticker) : null;
    const canDelete = post.clientId === clientId;
    const comments = Array.isArray(post.comments) ? post.comments : [];
    const replyOpen = communityReplyPostId === post.id;
    return `
      <article class="community-post" data-id="${escapeHtml(post.id)}">
        <div class="community-post-head">
          ${post.ticker
            ? `<button type="button" class="ticker-pill community-post-ticker" data-ticker="${escapeHtml(post.ticker)}" title="이 종목 글만 보기">${escapeHtml(post.ticker)}</button>`
            : `<span class="community-post-tag">일반</span>`}
          ${communityAvatarHtml(post.author)}
          <span class="community-post-author">${escapeHtml(post.author || "익명")}</span>
          <time class="muted">${escapeHtml(formatCommunityTime(post.createdAt))}</time>
        </div>
        ${stock ? `<p class="community-post-company muted">${escapeHtml(stock.company)} · 당일 ${fmtPct(stock.changePct)}</p>` : ""}
        ${post.ticker ? communityMiniChartHtml(post.ticker) : ""}
        <p class="community-post-body">${highlightCommunityMentions(escapeHtml(post.content))}</p>
        ${comments.length ? `
          <div class="community-comments">
            ${comments.map((comment) => {
              const canDeleteComment = comment.clientId === clientId;
              return `
                <div class="community-comment" data-comment-id="${escapeHtml(comment.id)}">
                  <div class="community-comment-head">
                    <span class="community-comment-author">${escapeHtml(comment.author || "익명")}</span>
                    <time class="muted">${escapeHtml(formatCommunityTime(comment.createdAt))}</time>
                    <div class="community-comment-actions">
                      <button type="button" class="ghost compact-btn community-comment-reply" data-post-id="${escapeHtml(post.id)}" data-author="${escapeHtml(comment.author || "익명")}">답글</button>
                      ${canDeleteComment ? `<button type="button" class="ghost compact-btn community-comment-delete" data-post-id="${escapeHtml(post.id)}" data-comment-id="${escapeHtml(comment.id)}">삭제</button>` : ""}
                    </div>
                  </div>
                  <p class="community-comment-body">${highlightCommunityMentions(escapeHtml(comment.content))}</p>
                </div>
              `;
            }).join("")}
          </div>
        ` : ""}
        <div class="community-post-actions">
          <button type="button" class="ghost compact-btn community-post-like${communityLikedByMe(post) ? " is-liked" : ""}" data-post-id="${escapeHtml(post.id)}" aria-pressed="${communityLikedByMe(post)}">👍 <span class="community-like-count">${communityLikeCount(post)}</span></button>
          <button type="button" class="ghost compact-btn community-post-reply" data-post-id="${escapeHtml(post.id)}">${comments.length ? `댓글 ${comments.length}개 · 답글` : "댓글 달기"}</button>
          ${post.ticker ? `<button type="button" class="ghost compact-btn community-post-analyze" data-ticker="${escapeHtml(post.ticker)}">종목 분석</button>` : ""}
          ${canDelete
            ? `<button type="button" class="ghost compact-btn community-post-delete" data-id="${escapeHtml(post.id)}">삭제</button>`
            : `<button type="button" class="ghost compact-btn community-post-report" data-post-id="${escapeHtml(post.id)}" title="부적절한 글 신고">🚩 신고</button>`}
        </div>
        ${replyOpen ? `
          <div class="community-reply-form">
            <textarea class="community-reply-input" data-post-id="${escapeHtml(post.id)}" rows="2" placeholder="댓글을 입력하세요 (2자 이상)"></textarea>
            <div class="community-reply-actions">
              <button type="button" class="community-reply-submit" data-post-id="${escapeHtml(post.id)}">댓글 등록</button>
              <button type="button" class="ghost community-reply-cancel" data-post-id="${escapeHtml(post.id)}">취소</button>
              <span class="community-reply-hint muted">Ctrl·⌘+Enter로 등록</span>
            </div>
          </div>
        ` : ""}
      </article>
    `;
  }).join("");

  feed.querySelectorAll(".community-post-ticker").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyCommunityBoardTickerFilter(btn.dataset.ticker);
      renderCommunityBoard();
    });
  });
  feed.querySelectorAll(".community-post-analyze").forEach((btn) => {
    btn.addEventListener("click", () => {
      openSocialTicker(btn.dataset.ticker);
      scrollCommunityToChart();
    });
  });
  feed.querySelectorAll(".community-post-like").forEach((btn) => {
    btn.addEventListener("click", () => toggleCommunityLike(btn.dataset.postId));
  });
  feed.querySelectorAll(".community-post-report").forEach((btn) => {
    btn.addEventListener("click", () => reportCommunityPost(btn.dataset.postId));
  });
  feed.querySelectorAll(".community-comment-reply").forEach((btn) => {
    btn.addEventListener("click", () => openCommunityReplyWithMention(btn.dataset.postId, btn.dataset.author));
  });
  feed.querySelectorAll(".community-post-delete").forEach((btn) => {
    btn.addEventListener("click", () => deleteCommunityPost(btn.dataset.id));
  });
  feed.querySelectorAll(".community-post-reply").forEach((btn) => {
    btn.addEventListener("click", () => {
      const postId = btn.dataset.postId;
      communityReplyPostId = communityReplyPostId === postId ? null : postId;
      renderCommunityBoard();
      if (communityReplyPostId === postId) {
        const input = feed.querySelector(`.community-reply-input[data-post-id="${CSS.escape(postId)}"]`);
        input?.focus();
      }
    });
  });
  feed.querySelectorAll(".community-reply-cancel").forEach((btn) => {
    btn.addEventListener("click", () => {
      communityReplyPostId = null;
      renderCommunityBoard();
    });
  });
  feed.querySelectorAll(".community-reply-submit").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const postId = btn.dataset.postId;
      const input = feed.querySelector(`.community-reply-input[data-post-id="${CSS.escape(postId)}"]`);
      if (btn.disabled) return;
      btn.disabled = true;
      const prevLabel = btn.textContent;
      btn.textContent = "등록 중…";
      try {
        await postCommunityComment(postId, input?.value || "");
      } finally {
        // 성공 시 폼이 재렌더로 사라지지만, 실패 시엔 버튼을 되살린다.
        btn.disabled = false;
        btn.textContent = prevLabel;
      }
    });
  });
  // Ctrl/⌘ + Enter 로 댓글 바로 등록
  feed.querySelectorAll(".community-reply-input").forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        postCommunityComment(input.dataset.postId, input.value || "");
      }
    });
  });
  feed.querySelectorAll(".community-comment-delete").forEach((btn) => {
    btn.addEventListener("click", () => deleteCommunityComment(btn.dataset.postId, btn.dataset.commentId));
  });

  // 보존해 둔 답글 입력 내용·커서·포커스를 복원한다.
  if (replyDraft && communityReplyPostId) {
    const nextReply = feed.querySelector(`.community-reply-input[data-post-id="${CSS.escape(communityReplyPostId)}"]`);
    if (nextReply) {
      nextReply.value = replyDraft.value;
      if (replyDraft.focused) {
        nextReply.focus();
        try { nextReply.setSelectionRange(replyDraft.start, replyDraft.end); } catch (_) {}
      }
    }
  }

  renderCommunityPagination(totalPages);
}

// 10개 단위 페이지네이션 컨트롤(< 1 2 3 >). totalPages<=1 이면 숨김.
function renderCommunityPagination(totalPages) {
  const box = byId("communityPagination");
  if (!box) return;
  if (!totalPages || totalPages <= 1) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  const page = communityBoardPage;
  const go = (p) => {
    communityBoardPage = Math.min(totalPages, Math.max(1, p));
    renderCommunityBoard();
    byId("communityFeed")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  // 현재 페이지 주변 최대 5개 번호만 노출
  const windowSize = 5;
  let from = Math.max(1, page - 2);
  let to = Math.min(totalPages, from + windowSize - 1);
  from = Math.max(1, to - windowSize + 1);
  const nums = [];
  for (let p = from; p <= to; p++) nums.push(p);
  box.hidden = false;
  box.innerHTML = `
    <button type="button" class="community-page-btn" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>‹</button>
    ${from > 1 ? `<button type="button" class="community-page-btn" data-page="1">1</button>${from > 2 ? `<span class="community-page-ellipsis">…</span>` : ""}` : ""}
    ${nums.map((p) => `<button type="button" class="community-page-btn${p === page ? " is-active" : ""}" data-page="${p}">${p}</button>`).join("")}
    ${to < totalPages ? `${to < totalPages - 1 ? `<span class="community-page-ellipsis">…</span>` : ""}<button type="button" class="community-page-btn" data-page="${totalPages}">${totalPages}</button>` : ""}
    <button type="button" class="community-page-btn" data-page="${page + 1}" ${page >= totalPages ? "disabled" : ""}>›</button>
  `;
  box.querySelectorAll(".community-page-btn").forEach((btn) => {
    if (btn.disabled) return;
    btn.addEventListener("click", () => go(Number(btn.dataset.page)));
  });
}

async function fetchCommunityPosts({ silent = false } = {}) {
  const url = communityApiUrl("/community");
  if (!url) {
    communityBoardError = "board_unavailable";
    communityPostsCache = [];
    renderCommunityBoard();
    return;
  }
  if (!silent) {
    const meta = byId("communityBoardMeta");
    if (meta) meta.textContent = "글을 불러오는 중…";
  }
  if (communityFetchPromise) return communityFetchPromise;

  communityFetchPromise = (async () => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok && data.error !== "no_community_kv") {
        throw new Error(data.message || data.error || `HTTP ${res.status}`);
      }
      communityBoardError = data.error === "no_community_kv" ? "no_community_kv" : "";
      communityPostsCache = Array.isArray(data.posts) ? data.posts : [];
      communityUpdateNewBanner(communityPostsCache);
    } catch (err) {
      if (!silent) communityBoardError = (err && err.message) || "네트워크 오류";
      else if (!communityPostsCache.length) communityBoardError = (err && err.message) || "네트워크 오류";
    } finally {
      communityFetchPromise = null;
      if (currentTab === "community" && communitySubTab === "board") {
        // 자동(silent) 새로고침이 답글 작성 중인 입력칸을 건드리지 않도록,
        // 사용자가 답글 입력칸에 포커스를 둔 동안에는 재렌더를 건너뛴다.
        const active = document.activeElement;
        const typingReply = silent && active && active.classList
          && active.classList.contains("community-reply-input");
        if (!typingReply) renderCommunityBoard();
      }
      if (currentTab === "search" && searchSubTab === "analysis" && selectedTicker) {
        const base = stockByTicker(selectedTicker);
        if (base) renderStockEvents(applyLive(withDetail(base)));
      }
    }
  })();

  return communityFetchPromise;
}

async function postCommunityMessage() {
  const nickInput = byId("communityNickname");
  const contentInput = byId("communityContent");
  const postBtn = byId("communityPost");
  const author = (nickInput?.value || "").trim() || "익명";
  setCommunityNickname(author);
  const rawTicker = (byId("communityTicker")?.value || "").trim();
  const ticker = rawTicker ? resolveCommunityTickerInput(rawTicker) : "";
  const content = (contentInput?.value || "").trim();
  if (!content || content.length < 2) {
    alert("의견을 2자 이상 입력해주세요.");
    return;
  }
  const url = communityApiUrl("/community");
  if (!url) {
    alert("게시판을 일시적으로 사용할 수 없습니다.");
    return;
  }
  if (postBtn) postBtn.disabled = true;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        author,
        ticker: ticker || "",
        content,
        clientId: getCommunityClientId(),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data.error === "no_community_kv"
        ? "게시판을 일시적으로 사용할 수 없습니다."
        : (data.message || data.error || "등록 실패");
      alert(msg);
      return;
    }
    if (contentInput) contentInput.value = "";
    communityBoardError = "";
    // 내 새 글이 필터/정렬에 가려지지 않도록 보기 상태를 초기화한 뒤 글로 스크롤·강조한다.
    const filterEl = byId("communityFilter");
    const tickerEl = byId("communityFilterTicker");
    const sortEl = byId("communitySort");
    if (filterEl) filterEl.value = "all";
    if (tickerEl) tickerEl.value = "";
    if (sortEl) sortEl.value = "latest";
    communityBoardTickerFilter = "";
    communitySortMode = "latest";
    communityBoardPage = 1;
    communityClearNewBanner();
    await fetchCommunityPosts();
    if (data.post && data.post.id) communityHighlightPost(data.post.id);
  } catch (err) {
    alert((err && err.message) || "글 등록에 실패했습니다.");
  } finally {
    if (postBtn) postBtn.disabled = false;
  }
}

async function postCommunityComment(postId, rawContent) {
  const content = String(rawContent || "").trim();
  if (!postId || content.length < 2) {
    alert("댓글을 2자 이상 입력해주세요.");
    return;
  }
  const nickInput = byId("communityNickname");
  const author = (nickInput?.value || "").trim() || getCommunityNickname() || "익명";
  setCommunityNickname(author);
  const url = communityApiUrl("/community/comment");
  if (!url) {
    alert("게시판을 일시적으로 사용할 수 없습니다.");
    return;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postId,
        author,
        content,
        clientId: getCommunityClientId(),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error === "no_community_kv" ? "게시판을 일시적으로 사용할 수 없습니다." : (data.message || data.error || "댓글 등록 실패"));
      return;
    }
    communityReplyPostId = null;
    communityBoardError = "";
    await fetchCommunityPosts();
  } catch (err) {
    alert((err && err.message) || "댓글 등록에 실패했습니다.");
  }
}

async function deleteCommunityComment(postId, commentId) {
  if (!postId || !commentId || !confirm("이 댓글을 삭제할까요?")) return;
  const url = communityApiUrl("/community/comment");
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postId,
        commentId,
        clientId: getCommunityClientId(),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error === "forbidden" ? "본인 댓글만 삭제할 수 있습니다." : (data.error || "삭제 실패"));
      return;
    }
    await fetchCommunityPosts();
  } catch (err) {
    alert((err && err.message) || "댓글 삭제에 실패했습니다.");
  }
}

async function deleteCommunityPost(id) {
  if (!id || !confirm("이 글을 삭제할까요?")) return;
  const url = communityApiUrl("/community");
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, clientId: getCommunityClientId() }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error === "forbidden" ? "본인 글만 삭제할 수 있습니다." : (data.error || "삭제 실패"));
      return;
    }
    await fetchCommunityPosts();
  } catch (err) {
    alert((err && err.message) || "삭제에 실패했습니다.");
  }
}

async function clearCommunityPostsMine() {
  if (!confirm("이 브라우저에서 작성한 글을 모두 삭제할까요?")) return;
  const url = communityApiUrl("/community/clear");
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: getCommunityClientId() }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.message || data.error || "삭제 실패");
      return;
    }
    await fetchCommunityPosts();
  } catch (err) {
    alert((err && err.message) || "삭제에 실패했습니다.");
  }
}

function setupCommunityBoard() {
  const nickInput = byId("communityNickname");
  const postBtn = byId("communityPost");
  if (!postBtn) return;

  if (nickInput) {
    nickInput.value = getCommunityNickname();
    nickInput.addEventListener("change", () => setCommunityNickname(nickInput.value));
    nickInput.addEventListener("blur", () => setCommunityNickname(nickInput.value));
  }

  postBtn.addEventListener("click", () => {
    postCommunityMessage().then(() => {
      if (currentTab !== "community" || communitySubTab !== "board") {
        activateTab("community", { push: true, sub: "board" });
      }
    });
  });

  // 본문 Ctrl/⌘+Enter 로 바로 등록
  byId("communityContent")?.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      postBtn.click();
    }
  });

  byId("communityRefresh")?.addEventListener("click", () => fetchCommunityPosts());
  byId("communityFilter")?.addEventListener("change", () => {
    communityBoardPage = 1;
    renderCommunityBoard();
  });
  byId("communitySort")?.addEventListener("change", (event) => {
    communitySortMode = event.target.value || "latest";
    communityBoardPage = 1;
    renderCommunityBoard();
  });
  byId("communityFilterTicker")?.addEventListener("input", () => {
    clearTimeout(setupCommunityBoard._filterTimer);
    setupCommunityBoard._filterTimer = setTimeout(() => {
      communityBoardPage = 1;
      renderCommunityBoard();
    }, 200);
  });
  byId("communityClearMine")?.addEventListener("click", clearCommunityPostsMine);

  const miniToggle = byId("communityMiniChartToggle");
  if (miniToggle) {
    miniToggle.checked = communityShowMiniChart;
    miniToggle.addEventListener("change", () => {
      communityShowMiniChart = miniToggle.checked;
      localStorage.setItem(COMMUNITY_MINICHART_KEY, communityShowMiniChart ? "1" : "0");
      renderCommunityBoard();
    });
  }

  byId("communityNewBanner")?.addEventListener("click", () => {
    communityClearNewBanner();
    byId("communityFeed")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // ----- 투표 페이지 -----
  const voteChoices = byId("communityVoteChoices");
  if (voteChoices) {
    voteChoices.querySelectorAll(".community-vote-choice").forEach((btn) => {
      btn.addEventListener("click", () => {
        communityVoteSelectedChoice = communityVoteSelectedChoice === btn.dataset.choice ? null : btn.dataset.choice;
        voteChoices.querySelectorAll(".community-vote-choice").forEach((b) =>
          b.classList.toggle("is-selected", b.dataset.choice === communityVoteSelectedChoice));
      });
    });
  }
  byId("communityVoteSubmit")?.addEventListener("click", submitCommunityVote);
  const rankTabs = byId("communityVoteRankTabs");
  if (rankTabs) {
    rankTabs.querySelectorAll(".community-rank-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        communityVotePeriod = btn.dataset.period || "day";
        rankTabs.querySelectorAll(".community-rank-tab").forEach((b) =>
          b.classList.toggle("is-active", b.dataset.period === communityVotePeriod));
        fetchCommunityVotes();
      });
    });
  }
  setupTickerAutocomplete("communityVoteTicker");
}

// ===== 관심종목 (localStorage) =====
function initWatchlist(urlList) {
  try {
    const saved = JSON.parse(localStorage.getItem(WATCHLIST_STORAGE_KEY) || "[]");
    watchlist = Array.isArray(saved) ? saved.map((t) => String(t).toUpperCase()).filter(Boolean) : [];
  } catch (e) {
    watchlist = [];
  }
  if (urlList) {
    const fromUrl = String(urlList).split(",").map((t) => t.trim().toUpperCase()).filter((t) => stockByTicker(t));
    if (fromUrl.length) watchlist = [...new Set(fromUrl)];
    persistWatchlist();
  }
  if (!watchlist.length) watchlist = DEFAULT_WATCHLIST.slice();
  persistWatchlist();
}

function persistWatchlist() {
  watchlist = [...new Set(watchlist.filter((t) => stockByTicker(t)))];
  try { localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist)); } catch (e) { /* ignore */ }
  const input = byId("bulkInput");
  if (input) input.value = watchlist.join(", ");
}

function isInWatchlist(ticker) {
  return watchlist.includes(String(ticker || "").toUpperCase());
}

function watchStarButton(ticker) {
  const on = isInWatchlist(ticker);
  return `<button type="button" class="watch-star${on ? " is-on" : ""}" data-watch="${escapeHtml(ticker)}" title="관심종목">${on ? "★" : "☆"}</button>`;
}

function toggleWatchlist(ticker) {
  const t = String(ticker || "").toUpperCase();
  if (!stockByTicker(t)) return;
  if (isInWatchlist(t)) watchlist = watchlist.filter((x) => x !== t);
  else watchlist.push(t);
  persistWatchlist();
  renderWatchlistBar();
  renderWatchAlerts();
  renderBulk();
  renderActionBoard();
  document.querySelectorAll(`[data-watch="${t}"]`).forEach((btn) => {
    const on = isInWatchlist(t);
    btn.classList.toggle("is-on", on);
    btn.textContent = on ? "★" : "☆";
  });
  const facts = byId("searchFacts");
  if (facts && selectedTicker === t) {
    const base = data.stocks.find((row) => row.ticker === t);
    if (base) facts.innerHTML = stockFacts(applyLive(withDetail(base)), "Search Ticker");
  }
}

function saveWatchlistFromInput(text) {
  const tickers = resolveTickerListInput(text);
  if (!tickers.length) return;
  watchlist = [...new Set(tickers)];
  persistWatchlist();
  renderWatchlistBar();
  renderWatchAlerts();
  renderActionBoard();
}

function renderWatchlistBar() {
  const bar = byId("watchlistBar");
  const chips = byId("watchlistChips");
  const summary = byId("watchlistSummary");
  if (!bar || !chips) return;
  if (!watchlist.length) { bar.hidden = true; return; }
  bar.hidden = false;
  const items = watchlist.map((t) => stockByTicker(t)).filter(Boolean);
  const up = items.filter((s) => Number(s.changePct) > 0).length;
  if (summary) summary.textContent = `${items.length}개 · 상승 ${items.length ? Math.round((up / items.length) * 100) : 0}%`;
  chips.innerHTML = items.map((item) => `
    <button type="button" class="watch-chip" data-ticker="${escapeHtml(item.ticker)}">
      <strong>${escapeHtml(item.ticker)}</strong>
      <em class="${cls(item.changePct)}">${fmtPct(item.changePct)}</em>
      <span class="watch-chip-remove" data-remove="${escapeHtml(item.ticker)}" title="제거">×</span>
    </button>
  `).join("");
  chips.querySelectorAll(".watch-chip").forEach((chip) => {
    chip.addEventListener("click", (event) => {
      if (event.target.closest("[data-remove]")) return;
      selectTicker(chip.dataset.ticker, { openSearch: true });
    });
  });
  chips.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleWatchlist(btn.dataset.remove);
    });
  });
}

function renderWatchlistStats(rows) {
  const box = byId("watchlistStats");
  if (!box) return;
  const items = rows || watchlist.map((t) => stockByTicker(t)).filter(Boolean);
  if (!items.length) { box.innerHTML = ""; return; }
  const up = items.filter((s) => Number(s.changePct) > 0).length;
  const avgRs = items.reduce((sum, s) => sum + Number(s.rsScore || 0), 0) / items.length;
  const avgChg = items.reduce((sum, s) => sum + Number(s.changePct || 0), 0) / items.length;
  box.innerHTML = `
    <article class="watch-stat-card"><span>종목 수</span><strong>${items.length}</strong></article>
    <article class="watch-stat-card"><span>상승 비중</span><strong>${Math.round((up / items.length) * 100)}%</strong></article>
    <article class="watch-stat-card"><span>평균 RS</span><strong>${avgRs.toFixed(0)}</strong></article>
    <article class="watch-stat-card"><span>평균 당일</span><strong class="${cls(avgChg)}">${fmtPct(avgChg)}</strong></article>
  `;
}

function watchAlertSettings() {
  const defaults = {
    useRs: true,
    minRs: 80,
    useEps: false,
    minEps: 75,
    useHigh: true,
    highDist: 3,
    useVol: true,
    minVol: 2,
    useSma20: false
  };
  try {
    return { ...defaults, ...(JSON.parse(localStorage.getItem(WATCH_ALERT_STORAGE_KEY) || "{}") || {}) };
  } catch (e) {
    return defaults;
  }
}

function saveWatchAlertSettings(settings) {
  try { localStorage.setItem(WATCH_ALERT_STORAGE_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
}

function readWatchAlertSettingsFromUi() {
  return {
    useRs: Boolean(byId("alertUseRs")?.checked),
    minRs: numberInputValue("alertMinRs", 80),
    useEps: Boolean(byId("alertUseEps")?.checked),
    minEps: numberInputValue("alertMinEps", 75),
    useHigh: Boolean(byId("alertUseHigh")?.checked),
    highDist: numberInputValue("alertHighDist", 3),
    useVol: Boolean(byId("alertUseVol")?.checked),
    minVol: numberInputValue("alertMinVol", 2),
    useSma20: Boolean(byId("alertUseSma20")?.checked)
  };
}

function applyWatchAlertSettingsToUi(settings) {
  const pairs = [
    ["alertUseRs", "useRs"], ["alertMinRs", "minRs"],
    ["alertUseEps", "useEps"], ["alertMinEps", "minEps"],
    ["alertUseHigh", "useHigh"], ["alertHighDist", "highDist"],
    ["alertUseVol", "useVol"], ["alertMinVol", "minVol"],
    ["alertUseSma20", "useSma20"]
  ];
  pairs.forEach(([id, key]) => {
    const el = byId(id);
    if (!el) return;
    if (el.type === "checkbox") el.checked = Boolean(settings[key]);
    else el.value = settings[key];
  });
}

function sma20Recovered(item) {
  const rows = getChartRows(item);
  if (rows.length < 22) return false;
  const closes = rows.map((row) => row.c);
  const sma = smaArray(closes, 20);
  const last = rows.length - 1;
  const prev = last - 1;
  return rows[prev].c <= sma[prev] && rows[last].c > sma[last];
}

function watchAlertReasons(item, settings) {
  const reasons = [];
  if (settings.useRs && Number(item.rsScore || 0) >= settings.minRs) reasons.push(`RS ${item.rsScore}`);
  if (settings.useEps && Number(item.epsRevScore || 0) >= settings.minEps) reasons.push(`EPS ${item.epsRevScore}`);
  if (settings.useHigh && Number.isFinite(Number(item.newHighDistancePct)) && Number(item.newHighDistancePct) <= settings.highDist) {
    reasons.push(`신고가 ${Number(item.newHighDistancePct).toFixed(1)}% 이내`);
  }
  if (settings.useVol && Number(item.volumeRatio || 0) >= settings.minVol) reasons.push(`거래량 ${Number(item.volumeRatio || 0).toFixed(1)}x`);
  if (settings.useSma20 && sma20Recovered(item)) reasons.push("SMA20 회복");
  return reasons;
}

function renderWatchAlerts() {
  const panel = byId("watchAlertPanel");
  if (!panel) return;
  const settings = watchAlertSettings();
  applyWatchAlertSettingsToUi(settings);
  const results = byId("watchAlertResults");
  const count = byId("watchAlertCount");
  const rows = watchlist
    .map((ticker) => stockByTicker(ticker))
    .filter(Boolean)
    .map((item) => applyLive(withDetail(item)))
    .filter(Boolean)
    .map((item) => ({ item, reasons: watchAlertReasons(item, settings) }))
    .filter((row) => row.reasons.length);
  if (count) count.textContent = `${rows.length}건`;
  if (!results) return;
  results.innerHTML = rows.length
    ? rows.map(({ item, reasons }) => `
      <button type="button" class="watch-alert-item" data-ticker="${escapeHtml(item.ticker)}">
        <strong>${escapeHtml(item.ticker)}</strong>
        <span>${reasons.map(escapeHtml).join(" · ")}</span>
        <em class="${cls(item.changePct)}">${fmtPct(item.changePct)}</em>
      </button>
    `).join("")
    : `<p class="muted">현재 조건에 걸린 관심종목이 없습니다.</p>`;
  results.querySelectorAll(".watch-alert-item").forEach((btn) => {
    btn.addEventListener("click", () => selectTicker(btn.dataset.ticker, { openSearch: true }));
  });
}

function setupWatchAlertEvents() {
  const panel = byId("watchAlertPanel");
  if (!panel) return;
  applyWatchAlertSettingsToUi(watchAlertSettings());
  ["alertUseRs", "alertMinRs", "alertUseEps", "alertMinEps", "alertUseHigh", "alertHighDist", "alertUseVol", "alertMinVol", "alertUseSma20"].forEach((id) => {
    const el = byId(id);
    if (!el) return;
    el.addEventListener("change", () => {
      const settings = readWatchAlertSettingsFromUi();
      saveWatchAlertSettings(settings);
      renderWatchAlerts();
    });
  });
  renderWatchAlerts();
}

function setupWatchlistUi() {
  const openBulk = byId("watchlistOpenBulk");
  if (openBulk) openBulk.addEventListener("click", () => activateTab("bulk", { push: true }));
  const share = byId("watchlistShare");
  if (share) share.addEventListener("click", async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("watchlist", watchlist.join(","));
    url.searchParams.delete("tab");
    try {
      await navigator.clipboard.writeText(url.toString());
      share.textContent = "복사됨!";
      setTimeout(() => { share.textContent = "링크 공유"; }, 1500);
    } catch (e) {
      window.prompt("관심종목 링크", url.toString());
    }
  });
}

// ===== PWA =====
const SW_VERSION = "20260617x";

function setupPwa() {
  if ("serviceWorker" in navigator) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker.getRegistration().then((registration) => {
      if (!registration) return;
      registration.update();
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            worker.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });
    }).catch(() => {});
  }
  const installBtn = byId("installApp");
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
  // 설치 버튼은 모바일에서만(데스크톱 웹에서는 숨김), 이미 설치(standalone)된 경우에도 숨김
  const isMobile = window.matchMedia("(pointer: coarse)").matches
    || /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
  const showInstall = isMobile && !isStandalone;
  if (installBtn) installBtn.hidden = !showInstall;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (installBtn && showInstall) installBtn.hidden = false;
  });
  // 설치 완료 시 버튼 즉시 숨김
  window.addEventListener("appinstalled", () => {
    if (installBtn) installBtn.hidden = true;
  });
  if (installBtn) {
    installBtn.addEventListener("click", async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        installBtn.hidden = true;
        return;
      }
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      window.alert(isIOS
        ? "Safari 공유 버튼 → '홈 화면에 추가'를 선택하세요."
        : "브라우저 메뉴에서 '앱 설치' 또는 '홈 화면에 추가'를 선택하세요.");
    });
  }
}

// ===== 스크리너 =====
let savedScreeners = [];
let selectedSavedScreenerId = "";
let applyingSavedScreener = false;

function screenerSnapshotKey() {
  return String(data.updatedAtKst || data.updated_at_kst || "unknown");
}

function currentScreenerConfig() {
  return {
    bucket: byId("scrBucket")?.value || "idx_sp500",
    sector: byId("scrSector")?.value || "All",
    preset: byId("scrPreset")?.value || "custom",
    metric: byId("scrMetric")?.value || "rsScore",
    minRs: numberInputValue("scrMinRs", 0),
    minEps: numberInputValue("scrMinEps", 0),
    minVol: numberInputValue("scrMinVol", 0),
    minCap: numberInputValue("scrMinCap", 0),
    limit: Math.max(1, numberInputValue("scrLimit", 100))
  };
}

function applyScreenerConfig(config) {
  if (!config) return;
  applyingSavedScreener = true;
  const values = {
    scrBucket: config.bucket,
    scrSector: config.sector,
    scrPreset: config.preset,
    scrMetric: config.metric,
    scrMinRs: config.minRs || "",
    scrMinEps: config.minEps || "",
    scrMinVol: config.minVol || "",
    scrMinCap: config.minCap || "",
    scrLimit: config.limit || 100
  };
  Object.entries(values).forEach(([id, value]) => { const el = byId(id); if (el) el.value = value; });
  applyingSavedScreener = false;
}

function loadSavedScreeners() {
  try {
    const rows = JSON.parse(localStorage.getItem(SAVED_SCREENER_STORAGE_KEY) || "[]");
    savedScreeners = Array.isArray(rows) ? rows.filter((row) => row && row.id && row.name && row.config) : [];
  } catch (_) { savedScreeners = []; }
}

function persistSavedScreeners() {
  try { localStorage.setItem(SAVED_SCREENER_STORAGE_KEY, JSON.stringify(savedScreeners)); } catch (_) {}
}

function savedScreenerById(id = selectedSavedScreenerId) {
  return savedScreeners.find((row) => row.id === id) || null;
}

function renderSavedScreenerPicker() {
  const select = byId("savedScreenerSelect");
  const badge = byId("savedScreenerBadge");
  const del = byId("savedScreenerDelete");
  if (badge) badge.textContent = `저장 ${savedScreeners.length}개`;
  if (!select) return;
  select.innerHTML = `<option value="">저장된 조건 선택</option>` + savedScreeners.map((row) => `<option value="${escapeHtml(row.id)}">${escapeHtml(row.name)}</option>`).join("");
  select.value = selectedSavedScreenerId;
  if (del) del.disabled = !selectedSavedScreenerId;
}

function savedScreenerDeltaHtml(record) {
  const delta = record?.lastDelta || { added: [], removed: [] };
  const chips = (rows, tone, empty) => rows.length
    ? rows.map((ticker) => `<button type="button" class="screener-delta-chip ${tone}" data-ticker="${escapeHtml(ticker)}">${escapeHtml(ticker)}</button>`).join("")
    : `<span class="muted">${empty}</span>`;
  return `
    <div class="screener-delta-meta">
      <strong>${escapeHtml(record.name)}</strong>
      <span>기준 ${escapeHtml(record.lastSnapshotKey || "-")} · 결과 ${(record.lastTickers || []).length}개</span>
    </div>
    <div class="screener-delta-cols">
      <div><b>신규 편입 ${delta.added.length}</b><div>${chips(delta.added, "is-added", "신규 편입 없음")}</div></div>
      <div><b>이탈 ${delta.removed.length}</b><div>${chips(delta.removed, "is-removed", "이탈 없음")}</div></div>
    </div>`;
}

function renderSavedScreenerDelta(record) {
  const box = byId("savedScreenerDelta");
  if (!box) return;
  if (!record) {
    box.innerHTML = `<p class="muted">조건을 저장하면 다음 스냅샷부터 편입·이탈을 비교합니다.</p>`;
    return;
  }
  box.innerHTML = savedScreenerDeltaHtml(record);
  box.querySelectorAll("[data-ticker]").forEach((button) => button.addEventListener("click", () => selectTicker(button.dataset.ticker, { openSearch: true })));
}

function compareSavedScreener(record, tickers) {
  if (!record) return;
  const snapshotKey = screenerSnapshotKey();
  const previous = Array.isArray(record.lastTickers) ? record.lastTickers : [];
  if (!record.lastSnapshotKey) {
    record.lastSnapshotKey = snapshotKey;
    record.lastTickers = tickers;
    record.lastDelta = { added: [], removed: [] };
  } else if (record.lastSnapshotKey !== snapshotKey) {
    const before = new Set(previous);
    const now = new Set(tickers);
    record.lastDelta = {
      added: tickers.filter((ticker) => !before.has(ticker)),
      removed: previous.filter((ticker) => !now.has(ticker))
    };
    record.lastSnapshotKey = snapshotKey;
    record.lastTickers = tickers;
  }
  record.lastCheckedAt = formatKstDateTime();
  persistSavedScreeners();
  renderSavedScreenerDelta(record);
}

function saveCurrentScreener() {
  const input = byId("savedScreenerName");
  const name = String(input?.value || "").trim();
  if (!name) { showAppToast("저장할 스크리너 이름을 입력하세요"); input?.focus(); return; }
  const rows = screenerRows();
  let record = savedScreenerById();
  if (!record) {
    record = { id: `scr_${Date.now().toString(36)}`, name, config: {}, createdAt: formatKstDateTime() };
    savedScreeners.push(record);
  }
  record.name = name;
  record.config = currentScreenerConfig();
  record.lastSnapshotKey = screenerSnapshotKey();
  record.lastTickers = rows.map(({ item }) => item.ticker);
  record.lastDelta = { added: [], removed: [] };
  record.lastCheckedAt = formatKstDateTime();
  selectedSavedScreenerId = record.id;
  persistSavedScreeners();
  renderSavedScreenerPicker();
  renderSavedScreenerDelta(record);
  showAppToast(`'${name}' 조건을 저장했습니다`);
}

function deleteSelectedScreener() {
  const record = savedScreenerById();
  if (!record) return;
  savedScreeners = savedScreeners.filter((row) => row.id !== record.id);
  selectedSavedScreenerId = "";
  persistSavedScreeners();
  renderSavedScreenerPicker();
  renderSavedScreenerDelta(null);
  const input = byId("savedScreenerName");
  if (input) input.value = "";
  showAppToast("저장 조건을 삭제했습니다");
}

function screenerRows() {
  const bucket = byId("scrBucket")?.value || "idx_sp500";
  const sector = byId("scrSector")?.value || "All";
  const preset = byId("scrPreset")?.value || "custom";
  const metric = byId("scrMetric")?.value || "rsScore";
  const minRs = numberInputValue("scrMinRs", 0);
  const minEps = numberInputValue("scrMinEps", 0);
  const minVol = numberInputValue("scrMinVol", 0);
  const minCap = numberInputValue("scrMinCap", 0);
  const limit = Math.max(1, numberInputValue("scrLimit", 100));
  return data.stocks
    .filter((item) => item.sector !== "EXCHANGE TRADED FUNDS")
    .filter((item) => bucketMatches(item, item.groups || [item.bucket].filter(Boolean), bucket))
    .filter((item) => sector === "All" || item.sector === sector)
    .filter((item) => (Number(item.rsScore) || 0) >= minRs)
    .filter((item) => (Number(item.epsRevScore) || 0) >= minEps)
    .filter((item) => (Number(item.volumeRatio) || 0) >= minVol)
    .filter((item) => (Number(item.marketCapB) || 0) >= minCap)
    .filter((item) => topPresetMatches(item, preset))
    .map((item) => ({ item, value: metricValue(item, metric) }))
    .filter(({ value }) => Number.isFinite(value))
    .sort((a, b) => metricSortDirection(metric) * (b.value - a.value))
    .slice(0, limit);
}

function renderScreener({ trackSaved = false } = {}) {
  const body = byId("screenerTable");
  const meta = byId("screenerMeta");
  if (!body) return;
  const rows = screenerRows();
  if (trackSaved && selectedSavedScreenerId) compareSavedScreener(savedScreenerById(), rows.map(({ item }) => item.ticker));
  if (meta) meta.textContent = `${rows.length}개 종목 · ${byId("scrBucket")?.selectedOptions?.[0]?.textContent || ""}`;
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="11" class="muted">조건에 맞는 종목이 없습니다.</td></tr>`;
    return;
  }
  body.innerHTML = rows.map(({ item }) => `
    <tr>
      <td>${watchStarButton(item.ticker)}</td>
      <td><button type="button" class="ticker-link" data-ticker="${escapeHtml(item.ticker)}">${escapeHtml(item.ticker)}</button></td>
      <td>${escapeHtml(item.company)}</td>
      <td>${escapeHtml(item.sector)}</td>
      <td class="${cls(item.changePct)}">${fmtPct(item.changePct)}</td>
      <td class="${cls(item.monthChangePct)}">${fmtPct(item.monthChangePct)}</td>
      <td>${item.rsScore}</td>
      <td>${item.epsRevScore}</td>
      <td>${Number(item.volumeRatio || 0).toFixed(1)}x</td>
      <td>$${Number(item.marketCapB || 0).toFixed(1)}B</td>
      <td>${signalFor(item)}</td>
    </tr>
  `).join("");
  body.querySelectorAll(".ticker-link").forEach((btn) => {
    btn.addEventListener("click", () => selectTicker(btn.dataset.ticker, { openSearch: true }));
  });
}

// ===== AI 자연어 스크리너 (규칙 기반 파서 · 백엔드 불필요) =====
const NL_EXAMPLES = [
  "RSI 30 이하 반도체주",
  "RS 80 이상 신고가 근접 대형주",
  "PER 15 이하 ROE 15 이상",
  "1개월 20% 이상 거래량 2배 이상",
  "과매도 기술주",
];

const NL_SECTORS = [
  { kw: ["반도체", "semiconduct", "칩"], label: "반도체", test: (it) => /semiconduct/i.test(it.industry || "") },
  { kw: ["바이오", "biotech", "제약", "pharma"], label: "바이오/제약", test: (it) => /(biotech|pharma|drug|life science)/i.test(it.industry || "") || (it.sector || "").toUpperCase() === "HEALTHCARE" },
  { kw: ["헬스케어", "healthcare", "의료"], label: "헬스케어", test: (it) => (it.sector || "").toUpperCase() === "HEALTHCARE" },
  { kw: ["기술주", "기술", "테크", "tech", "소프트웨어", "software"], label: "기술", test: (it) => (it.sector || "").toUpperCase() === "TECHNOLOGY" },
  { kw: ["금융", "은행", "bank", "financ"], label: "금융", test: (it) => /FINANCIAL/.test((it.sector || "").toUpperCase()) },
  { kw: ["에너지", "energy", "석유", "oil"], label: "에너지", test: (it) => (it.sector || "").toUpperCase() === "ENERGY" },
  { kw: ["소비재", "소비", "consumer", "리테일", "retail", "유통"], label: "소비재", test: (it) => /CONSUMER/.test((it.sector || "").toUpperCase()) },
  { kw: ["산업재", "industrial"], label: "산업재", test: (it) => (it.sector || "").toUpperCase() === "INDUSTRIALS" },
  { kw: ["유틸", "utilit"], label: "유틸리티", test: (it) => (it.sector || "").toUpperCase() === "UTILITIES" },
  { kw: ["부동산", "reit", "real estate"], label: "부동산", test: (it) => /REAL ESTATE/.test((it.sector || "").toUpperCase()) },
  { kw: ["소재", "material", "mining", "금속", "철강"], label: "소재", test: (it) => /MATERIAL/.test((it.sector || "").toUpperCase()) },
  { kw: ["커뮤니케이션", "communication", "미디어", "media"], label: "커뮤니케이션", test: (it) => /COMMUNICATION/.test((it.sector || "").toUpperCase()) },
];

const NL_FLAGS = [
  { kw: ["과매도", "oversold"], label: "과매도 RSI≤30", test: (it) => Number(it.rsi14) <= 30 },
  { kw: ["과매수", "overbought"], label: "과매수 RSI≥70", test: (it) => Number(it.rsi14) >= 70 },
  { kw: ["신고가", "new high", "고점 근접"], label: "신고가 근접", test: (it) => Number(it.newHighDistancePct) <= 2 },
  { kw: ["신저가", "저점 근접", "52주 저가"], label: "신저가 근접", test: (it) => { const d = low52DistPct(it); return Number.isFinite(d) && d <= 10; } },
  { kw: ["급등"], label: "당일 급등 ≥5%", test: (it) => Number(it.changePct) >= 5 },
  { kw: ["급락"], label: "당일 급락 ≤-5%", test: (it) => Number(it.changePct) <= -5 },
  { kw: ["대형주", "large cap", "largecap"], label: "대형주 시총≥10B", test: (it) => Number(it.marketCapB) >= 10 },
  { kw: ["소형주", "중소형", "스몰캡", "small cap"], label: "소형주 시총≤2B", test: (it) => Number(it.marketCapB) <= 2 },
  { kw: ["주도주", "강세주", "리더", "leader"], label: "주도주 RS≥80", test: (it) => Number(it.rsScore) >= 80 },
  { kw: ["저평가", "value"], label: "저평가 PER≤15", test: (it, f) => Number(f.pe) > 0 && Number(f.pe) <= 15 },
];

const NL_METRICS = [
  { keys: ["rsi"], label: "RSI", unit: "", get: (it) => Number(it.rsi14), dir: "max" },
  { keys: ["per", "pe", "p/e", "주가수익"], label: "PER", unit: "", get: (it, f) => Number(f.pe != null ? f.pe : f.forwardPE), dir: "max" },
  { keys: ["pbr", "pb", "p/b"], label: "PBR", unit: "", get: (it, f) => Number(f.pb), dir: "max" },
  { keys: ["psr", "ps", "p/s"], label: "PSR", unit: "", get: (it, f) => Number(f.ps), dir: "max" },
  { keys: ["roe", "자기자본"], label: "ROE", unit: "%", get: (it, f) => Number(f.roe), dir: "min" },
  { keys: ["시총", "시가총액", "market cap", "marketcap"], label: "시총", unit: "B", get: (it) => Number(it.marketCapB), dir: "min", cap: true },
  { keys: ["거래량", "volume", "vol"], label: "거래량", unit: "x", get: (it) => Number(it.volumeRatio), dir: "min" },
  { keys: ["eps점수", "eps추정", "eps rev"], label: "EPS점수", unit: "", get: (it) => Number(it.epsRevScore), dir: "min" },
  { keys: ["당일", "오늘"], label: "당일등락", unit: "%", get: (it) => Number(it.changePct), dir: "min" },
  { keys: ["1개월", "한달", "월간"], label: "1개월", unit: "%", get: (it) => Number(it.monthChangePct), dir: "min" },
  { keys: ["1주", "주간"], label: "1주", unit: "%", get: (it) => Number(it.weekChangePct), dir: "min" },
  { keys: ["rs"], label: "RS", unit: "", get: (it) => Number(it.rsScore), dir: "min" },
];

function nlScaleCap(v, unit) {
  if (unit === "조" || unit === "t") return v * 1000;
  if (unit === "억") return v * 0.1;
  return v;
}

function nlDirFromText(s) {
  if (/<=|≤|이하|미만|아래|이내|under|below/.test(s)) return "max";
  if (/>=|≥|이상|초과|위|넘|over|above/.test(s)) return "min";
  if (s.includes("<")) return "max";
  if (s.includes(">")) return "min";
  return null;
}

function nlExtractMetric(text, metric) {
  for (const key of metric.keys) {
    const k = key.toLowerCase();
    let startWin = -1;
    if (/^[\x00-\x7f]+$/.test(k)) {
      const re = new RegExp("(^|[^a-z0-9])" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![a-z])", "i");
      const m = re.exec(text);
      if (m) startWin = m.index + m[0].length;
    } else {
      const i = text.indexOf(k);
      if (i >= 0) startWin = i + k.length;
    }
    if (startWin < 0) continue;
    const win = text.slice(startWin, startWin + 18);
    const m2 = win.match(/^\s*(<=|>=|≤|≥|이하|미만|이상|초과|under|below|over|above)?\s*(-?\d+(?:\.\d+)?)\s*(%|배|조|억|b|t|x)?\s*(이하|미만|이상|초과|아래|위|넘는|이내|under|below|over|above)?/i);
    if (m2 && m2[2] != null) {
      let value = parseFloat(m2[2]);
      const unit = (m2[3] || "").toLowerCase();
      if (metric.cap) value = nlScaleCap(value, unit);
      const dir = nlDirFromText(((m2[1] || "") + " " + (m2[4] || "")).trim()) || metric.dir;
      return { value, dir };
    }
  }
  return null;
}

function parseNlQuery(rawText) {
  const text = String(rawText || "").toLowerCase().trim();
  if (!text) return { conditions: [], warnings: [], error: "검색할 문장을 입력하세요." };
  const conditions = [];
  const warnings = [];
  NL_SECTORS.forEach((s) => {
    if (s.kw.some((k) => text.includes(k.toLowerCase()))) conditions.push({ label: s.label, test: s.test });
  });
  const usedLabels = new Set();
  NL_METRICS.forEach((metric) => {
    if (usedLabels.has(metric.label)) return;
    const r = nlExtractMetric(text, metric);
    if (r && Number.isFinite(r.value)) {
      usedLabels.add(metric.label);
      const get = metric.get;
      const { value, dir } = r;
      conditions.push({
        label: `${metric.label} ${dir === "max" ? "≤" : "≥"} ${value}${metric.unit || ""}`,
        sortKey: get, sortDir: dir,
        test: (it, f) => { const v = get(it, f); return Number.isFinite(v) && (dir === "max" ? v <= value : v >= value); }
      });
    }
  });
  NL_FLAGS.forEach((fl) => {
    if (fl.kw.some((k) => text.includes(k.toLowerCase()))) conditions.push({ label: fl.label, test: fl.test });
  });
  if (text.includes("배당")) warnings.push("배당 데이터가 없어 배당 조건은 검색에 반영되지 않았습니다.");
  return { conditions, warnings, error: conditions.length ? "" : "이해할 수 있는 조건을 찾지 못했어요. 아래 예시를 참고해 주세요." };
}

function runNlScreener() {
  const input = byId("nlQuery");
  const chips = byId("nlChips");
  const meta = byId("nlMeta");
  const wrap = byId("nlResultsWrap");
  const body = byId("nlResults");
  if (!input || !body || !wrap) return;
  const parsed = parseNlQuery(input.value);
  if (chips) {
    chips.innerHTML = parsed.conditions.map((c) => `<span class="nl-chip">${escapeHtml(c.label)}</span>`).join("")
      + parsed.warnings.map((w) => `<span class="nl-chip nl-chip-warn">${escapeHtml(w)}</span>`).join("");
  }
  if (parsed.error) {
    if (meta) meta.textContent = parsed.error;
    wrap.hidden = true;
    body.innerHTML = "";
    return;
  }
  const universe = (data.stocks || []).filter((s) => s && s.sector !== "EXCHANGE TRADED FUNDS");
  let rows = universe.filter((it) => {
    const f = mapFundamentalsFor(it.ticker) || {};
    return parsed.conditions.every((c) => c.test(it, f));
  });
  const sorter = parsed.conditions.find((c) => c.sortKey);
  if (sorter) {
    rows.sort((a, b) => {
      const av = sorter.sortKey(a, mapFundamentalsFor(a.ticker) || {});
      const bv = sorter.sortKey(b, mapFundamentalsFor(b.ticker) || {});
      const an = Number.isFinite(av) ? av : (sorter.sortDir === "max" ? Infinity : -Infinity);
      const bn = Number.isFinite(bv) ? bv : (sorter.sortDir === "max" ? Infinity : -Infinity);
      return sorter.sortDir === "max" ? an - bn : bn - an;
    });
  } else {
    rows.sort((a, b) => Number(b.rsScore) - Number(a.rsScore));
  }
  const total = rows.length;
  rows = rows.slice(0, 100);
  if (meta) meta.textContent = total ? `${total.toLocaleString()}개 종목 일치 (상위 ${rows.length}개 표시)` : "조건에 맞는 종목이 없습니다.";
  wrap.hidden = !rows.length;
  body.innerHTML = rows.map((it) => {
    const f = mapFundamentalsFor(it.ticker) || {};
    const pe = Number(f.pe != null ? f.pe : f.forwardPE);
    return `<tr>
      <td>${watchStarButton(it.ticker)}</td>
      <td><button type="button" class="ticker-link" data-ticker="${escapeHtml(it.ticker)}">${escapeHtml(it.ticker)}</button></td>
      <td>${escapeHtml(it.company)}</td>
      <td>${escapeHtml(it.sector)}</td>
      <td class="${cls(it.changePct)}">${fmtPct(it.changePct)}</td>
      <td class="${cls(it.monthChangePct)}">${fmtPct(it.monthChangePct)}</td>
      <td>${it.rsScore}</td>
      <td>${Number.isFinite(Number(it.rsi14)) ? it.rsi14 : "-"}</td>
      <td>${Number.isFinite(pe) ? pe.toFixed(1) : "-"}</td>
      <td>$${Number(it.marketCapB || 0).toFixed(1)}B</td>
      <td>${signalFor(it)}</td>
    </tr>`;
  }).join("");
  body.querySelectorAll(".ticker-link").forEach((btn) => btn.addEventListener("click", () => selectTicker(btn.dataset.ticker, { openSearch: true })));
}

function setupNlScreener() {
  const run = byId("nlRun");
  if (!run || run.dataset.bound) return;
  run.dataset.bound = "1";
  run.addEventListener("click", runNlScreener);
  byId("nlQuery")?.addEventListener("keydown", (e) => { if (e.key === "Enter") runNlScreener(); });
  byId("nlClear")?.addEventListener("click", () => {
    const q = byId("nlQuery"); if (q) q.value = "";
    if (byId("nlChips")) byId("nlChips").innerHTML = "";
    if (byId("nlResults")) byId("nlResults").innerHTML = "";
    if (byId("nlResultsWrap")) byId("nlResultsWrap").hidden = true;
    if (byId("nlMeta")) byId("nlMeta").textContent = "문장을 입력하고 검색을 눌러보세요.";
  });
  const ex = byId("nlExamples");
  if (ex) {
    ex.innerHTML = NL_EXAMPLES.map((q) => `<button type="button" class="nl-example" data-q="${escapeHtml(q)}">${escapeHtml(q)}</button>`).join("");
    ex.querySelectorAll(".nl-example").forEach((b) => b.addEventListener("click", () => {
      const q = byId("nlQuery"); if (q) q.value = b.dataset.q; runNlScreener();
    }));
  }
}

function setupScreenerEvents() {
  loadSavedScreeners();
  renderSavedScreenerPicker();
  renderSavedScreenerDelta(null);
  const run = (trackSaved = false) => renderScreener({ trackSaved });
  ["scrBucket", "scrSector", "scrMetric", "scrLimit"].forEach((id) => {
    const el = byId(id);
    if (el) el.addEventListener("change", () => {
      if (!applyingSavedScreener) { selectedSavedScreenerId = ""; renderSavedScreenerPicker(); renderSavedScreenerDelta(null); }
      run(false);
    });
  });
  const preset = byId("scrPreset");
  if (preset) preset.addEventListener("change", () => {
    const key = preset.value;
    const p = TOP_PRESETS[key];
    if (p) {
      byId("scrMetric").value = p.metric;
      byId("scrMinRs").value = p.minRs || "";
      byId("scrMinEps").value = p.minEps || "";
      byId("scrMinVol").value = p.minVolume || "";
      byId("scrMinCap").value = p.minMarketCap || "";
    }
    if (!applyingSavedScreener) { selectedSavedScreenerId = ""; renderSavedScreenerPicker(); renderSavedScreenerDelta(null); }
    run(false);
  });
  const btn = byId("scrRun");
  if (btn) btn.addEventListener("click", () => run(true));
  const reset = byId("scrReset");
  if (reset) reset.addEventListener("click", () => {
    byId("scrPreset").value = "custom";
    byId("scrBucket").value = "idx_sp500";
    byId("scrSector").value = "All";
    byId("scrMetric").value = "rsScore";
    ["scrMinRs", "scrMinEps", "scrMinVol", "scrMinCap"].forEach((id) => { const el = byId(id); if (el) el.value = ""; });
    selectedSavedScreenerId = "";
    renderSavedScreenerPicker();
    renderSavedScreenerDelta(null);
    run(false);
  });
  ["scrMinRs", "scrMinEps", "scrMinVol", "scrMinCap"].forEach((id) => byId(id)?.addEventListener("change", () => {
    if (!applyingSavedScreener) { selectedSavedScreenerId = ""; renderSavedScreenerPicker(); renderSavedScreenerDelta(null); }
  }));
  byId("savedScreenerSelect")?.addEventListener("change", (event) => {
    selectedSavedScreenerId = event.target.value;
    const record = savedScreenerById();
    const input = byId("savedScreenerName");
    if (input) input.value = record?.name || "";
    if (record) { applyScreenerConfig(record.config); renderScreener({ trackSaved: true }); }
    else renderSavedScreenerDelta(null);
    renderSavedScreenerPicker();
  });
  byId("savedScreenerSave")?.addEventListener("click", saveCurrentScreener);
  byId("savedScreenerDelete")?.addEventListener("click", deleteSelectedScreener);
}

// ===== 종목 비교 =====
const COMPARE_METRICS = [
  ["가격", (i) => `$${Number(i.price).toFixed(2)}`],
  ["당일", (i) => fmtPct(i.changePct), (i) => cls(i.changePct)],
  ["1주", (i) => fmtPct(i.weekChangePct), (i) => cls(i.weekChangePct)],
  ["1개월", (i) => fmtPct(i.monthChangePct), (i) => cls(i.monthChangePct)],
  ["3개월", (i) => fmtPct(i.threeMonthChangePct), (i) => cls(i.threeMonthChangePct)],
  ["RS", (i) => String(i.rsScore)],
  ["EPS Rev", (i) => String(i.epsRevScore)],
  ["거래량", (i) => `${Number(i.volumeRatio || 0).toFixed(1)}x`],
  ["시총", (i) => `$${Number(i.marketCapB || 0).toFixed(1)}B`],
  ["신고가 거리", (i) => fmtPct(-i.newHighDistancePct)],
  ["PER", (i) => fmtMultiple(i.fundamentals?.pe)],
  ["Fwd PER", (i) => fmtMultiple(i.fundamentals?.forwardPE)],
  ["P/S", (i) => fmtMultiple(i.fundamentals?.ps)],
  ["P/B", (i) => fmtMultiple(i.fundamentals?.pb)],
  ["섹터", (i) => i.sector],
  ["신호", (i) => signalFor(i)],
];

function compareTickersFromInput() {
  const raw = byId("compareInput")?.value || "";
  return resolveTickerListInput(raw).slice(0, 6);
}

function renderCompareBoard() {
  const table = byId("compareBoard");
  if (!table) return;
  const tickers = compareTickersFromInput();
  if (!tickers.length) {
    table.innerHTML = `<tr><td class="muted">비교할 티커를 입력하세요. (최대 6개)</td></tr>`;
    return;
  }
  const items = tickers.map((t) => withDetail(stockByTicker(t)));
  let html = `<thead><tr><th>지표</th>${items.map((i) => `<th><button type="button" class="ticker-link" data-ticker="${escapeHtml(i.ticker)}">${escapeHtml(i.ticker)}</button><div class="muted" style="font-size:11px;font-weight:400">${escapeHtml(i.company)}</div></th>`).join("")}</tr></thead><tbody>`;
  COMPARE_METRICS.forEach(([label, fmt, toneFn]) => {
    html += `<tr><td class="metric-label">${label}</td>${items.map((item) => {
      const tone = toneFn ? toneFn(item) : "";
      return `<td${tone ? ` class="${tone}"` : ""}>${fmt(item)}</td>`;
    }).join("")}</tr>`;
  });
  html += "</tbody>";
  table.innerHTML = html;
  table.querySelectorAll(".ticker-link").forEach((btn) => {
    btn.addEventListener("click", () => selectTicker(btn.dataset.ticker, { openSearch: true }));
  });
  tickers.forEach((t) => {
    const key = safeTicker(t);
    if (detailCache[key]) return;
    loadStockDetail(t).then((detail) => {
      if (!detail) return;
      if (compareTickersFromInput().join() === tickers.join()) renderCompareBoard();
    });
  });
}

function setupCompareEvents() {
  const run = () => renderCompareBoard();
  byId("compareRun")?.addEventListener("click", run);
  byId("compareFromWatchlist")?.addEventListener("click", () => {
    const input = byId("compareInput");
    if (input) input.value = watchlist.slice(0, 6).join(", ");
    run();
  });
  const input = byId("compareInput");
  if (input && !input.value) input.value = watchlist.slice(0, 4).join(", ");
}

// ===== 시장 실적 캘린더 =====
function earningsTickerPool() {
  const scope = byId("earnScope")?.value || "watchlist";
  const pool = new Set(watchlist);
  if (scope === "watchlist+top" || scope === "sp500") {
    sp500TopTickers(scope === "sp500" ? 80 : 35).forEach((t) => pool.add(t));
  }
  return [...pool].filter((t) => stockByTicker(t) && stockByTicker(t).sector !== "EXCHANGE TRADED FUNDS").slice(0, 60);
}

function sp500TopTickers(limit = 50) {
  return data.stocks
    .filter((s) => s.sector !== "EXCHANGE TRADED FUNDS")
    .filter((s) => bucketMatches(s, s.groups || [s.bucket].filter(Boolean), "idx_sp500"))
    .sort((a, b) => (Number(b.marketCapB) || 0) - (Number(a.marketCapB) || 0))
    .slice(0, limit)
    .map((s) => s.ticker);
}

function loadEarningsCalendar(force = false) {
  const body = byId("earningsCalendarBody");
  if (!body) return;
  if (!LIVE_DATA_PROXY) {
    body.innerHTML = `<p class="muted">실적 캘린더는 Cloudflare Worker 연결 후 표시됩니다.</p>`;
    return;
  }
  if (earningsCalendarLoading) return;
  if (earningsCalendarCache && !force) {
    renderEarningsCalendarMarket(earningsCalendarCache);
    return;
  }
  earningsCalendarLoading = true;
  body.innerHTML = `<p class="muted">실적 일정을 불러오는 중… (${earningsTickerPool().length}종목)</p>`;
  const tickers = earningsTickerPool().join(",");
  fetch(`${LIVE_DATA_PROXY.replace(/\/$/, "")}/?earnings_calendar=1&tickers=${encodeURIComponent(tickers)}`, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((payload) => {
      earningsCalendarCache = (payload && payload.earnings) || [];
      renderEarningsCalendarMarket(earningsCalendarCache);
    })
    .catch(() => {
      body.innerHTML = `<p class="muted">실적 일정을 불러오지 못했습니다.</p>`;
    })
    .finally(() => { earningsCalendarLoading = false; });
}

function renderEarningsCalendarMarket(rows) {
  const body = byId("earningsCalendarBody");
  if (!body) return;
  const horizon = Number(byId("earnHorizon")?.value || 14);
  const today = snapshotBaseDate();
  const end = new Date(today.getTime() + horizon * 86400000);
  const grouped = {};
  (rows || []).forEach((row) => {
    const date = row.nextDate;
    if (!date) return;
    const d = new Date(date);
    if (Number.isNaN(d.getTime()) || d < today || d > end) return;
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(row);
  });
  const dates = Object.keys(grouped).sort();
  if (!dates.length) {
    body.innerHTML = `<p class="muted">선택 기간에 실적 일정이 있는 종목이 없습니다. 범위를 넓히거나 새로고침해 보세요.</p>`;
    return;
  }
  body.innerHTML = dates.map((date) => {
    const list = grouped[date].sort((a, b) => (Number(b.marketCapB) || 0) - (Number(a.marketCapB) || 0));
    const days = Math.ceil((new Date(date) - today) / 86400000);
    return `
      <section class="earnings-day-group">
        <div class="earnings-day-head">
          <strong>${escapeHtml(date)}</strong>
          <span>${days === 0 ? "오늘" : days === 1 ? "내일" : `${days}일 후`} · ${list.length}종목</span>
        </div>
        <div class="earnings-day-rows table-wrap">
          <table class="compact-table">
            <thead><tr><th>티커</th><th>회사</th><th>시총</th><th>EPS 예상</th><th>RS</th></tr></thead>
            <tbody>
              ${list.map((row) => {
                const stock = stockByTicker(row.ticker) || {};
                return `<tr>
                  <td><button type="button" class="ticker-link" data-ticker="${escapeHtml(row.ticker)}">${escapeHtml(row.ticker)}</button></td>
                  <td>${escapeHtml(stock.company || row.ticker)}</td>
                  <td>$${Number(stock.marketCapB || 0).toFixed(1)}B</td>
                  <td>${row.epsEstimate != null ? moneyOrDash(row.epsEstimate) : "—"}</td>
                  <td>${stock.rsScore ?? "—"}</td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }).join("");
  body.querySelectorAll(".ticker-link").forEach((btn) => {
    btn.addEventListener("click", () => selectTicker(btn.dataset.ticker, { openSearch: true }));
  });
}

function setupEarningsEvents() {
  byId("earnRefresh")?.addEventListener("click", () => {
    earningsCalendarCache = null;
    loadEarningsCalendar(true);
  });
  ["earnHorizon", "earnScope"].forEach((id) => {
    byId(id)?.addEventListener("change", () => {
      earningsCalendarCache = null;
      loadEarningsCalendar(true);
    });
  });
}

// ===== 포트폴리오 시뮬레이터 (buy-and-hold) =====
const BACKTEST_MAX_TICKERS = 10;
let backtestTickers = [];
const BACKTEST_BENCHMARK_OPTIONS = [
  ["SPY", "S&P 500"],
  ["QQQ", "Nasdaq 100"],
  ["DIA", "다우존스"],
  ["IWM", "러셀 2000"],
  ["VTI", "전체 시장"],
  ["VOO", "S&P 500 (VOO)"],
  ["XLK", "기술 섹터"],
  ["SOXX", "반도체"],
];
let backtestRunning = false;
let backtestDatesProgrammatic = false;

function backtestTickersFromInput() {
  return backtestTickers.slice(0, BACKTEST_MAX_TICKERS);
}

function renderBacktestTickerChips() {
  const box = byId("backtestTickerList");
  if (!box) return;
  box.innerHTML = backtestTickers.length
    ? backtestTickers.map((ticker) => {
      const stock = stockByTicker(ticker);
      const label = stock?.company ? `${ticker} · ${stock.company}` : ticker;
      return `<button type="button" class="compare-chip" data-ticker="${escapeHtml(ticker)}" title="${escapeHtml(label)}">${escapeHtml(ticker)} <span>x</span></button>`;
    }).join("")
    : `<span class="muted">종목을 하나씩 추가하세요. (최대 ${BACKTEST_MAX_TICKERS}개)</span>`;
  box.querySelectorAll(".compare-chip").forEach((chip) => {
    chip.addEventListener("click", () => removeBacktestTicker(chip.dataset.ticker));
  });
  const weightsInput = byId("backtestWeights");
  if (weightsInput && byId("backtestWeightMode")?.value === "custom" && backtestTickers.length) {
    const each = Math.round(100 / backtestTickers.length);
    const parts = backtestTickers.map((_, i) => (i === backtestTickers.length - 1
      ? 100 - each * (backtestTickers.length - 1)
      : each));
    weightsInput.placeholder = parts.join(",");
  }
}

function addBacktestTicker(raw) {
  const resolved = resolveTickerListInput(String(raw || "").trim());
  const ticker = resolved[0];
  if (!ticker) {
    setBacktestStatus("유효한 티커를 입력하세요.");
    return false;
  }
  if (backtestTickers.includes(ticker)) {
    setBacktestStatus(`${ticker}는 이미 추가되어 있습니다.`);
    return false;
  }
  if (backtestTickers.length >= BACKTEST_MAX_TICKERS) {
    setBacktestStatus(`최대 ${BACKTEST_MAX_TICKERS}개까지 추가할 수 있습니다.`);
    return false;
  }
  backtestTickers.push(ticker);
  renderBacktestTickerChips();
  setBacktestStatus("");
  return true;
}

function removeBacktestTicker(ticker) {
  backtestTickers = backtestTickers.filter((item) => item !== ticker);
  renderBacktestTickerChips();
}

function setBacktestTickers(list) {
  backtestTickers = [...new Set((list || []).map((t) => String(t).toUpperCase()).filter((t) => stockByTicker(t)))].slice(0, BACKTEST_MAX_TICKERS);
  renderBacktestTickerChips();
}

function setBacktestStatus(text) {
  const el = byId("backtestStatus");
  if (el) el.textContent = text || "";
}

function closeSeriesToDateMap(rows) {
  const map = new Map();
  rows.forEach((row) => {
    if (row.d && Number.isFinite(row.c)) map.set(row.d, row.c);
  });
  return map;
}

function backtestSnapshotIsoDate() {
  const raw = (data && (data.updatedAtKst || data.updated_at_kst)) || "";
  const match = String(raw).match(/(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

function backtestPeriodMode() {
  const value = byId("backtestPeriod")?.value || "756";
  return value === "custom" ? "custom" : "preset";
}

function backtestPeriodBars() {
  const value = byId("backtestPeriod")?.value || "756";
  if (value === "custom") return null;
  return Number(value) || 756;
}

function backtestCustomStartDate() {
  if (backtestPeriodMode() !== "custom") return null;
  const raw = byId("backtestStartDate")?.value || "";
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

function backtestCustomEndDate() {
  if (backtestPeriodMode() !== "custom") return null;
  const raw = byId("backtestEndDate")?.value || "";
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

function backtestInvestmentUsd() {
  const value = Number(byId("backtestInvestment")?.value);
  return Number.isFinite(value) && value > 0 ? value : 10000;
}

function backtestBenchmarkTicker() {
  const sel = byId("backtestBenchmark");
  const value = String(sel?.value || "SPY").toUpperCase();
  return stockByTicker(value) ? value : "SPY";
}

function backtestBenchmarkLabel(ticker) {
  const found = BACKTEST_BENCHMARK_OPTIONS.find(([t]) => t === ticker);
  if (found) return found[1];
  const stock = stockByTicker(ticker);
  return stock?.company ? `${ticker} · ${stock.company}` : ticker;
}

function fmtBacktestUsd(value) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function backtestWeightsForTickers(tickers) {
  const mode = byId("backtestWeightMode")?.value || "equal";
  if (mode !== "custom") {
    const each = 100 / tickers.length;
    return { weights: tickers.map(() => each) };
  }
  const raw = byId("backtestWeights")?.value || "";
  const parts = raw.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
  if (parts.length !== tickers.length) return { error: `비중은 티커 ${tickers.length}개와 같은 개수로 입력하세요.` };
  const sum = parts.reduce((acc, n) => acc + n, 0);
  if (sum <= 0) return { error: "비중 합계가 0보다 커야 합니다." };
  return { weights: parts.map((n) => (n / sum) * 100) };
}

function backtestCommonDateList(seriesList) {
  if (!seriesList.length) return [];
  const dated = seriesList.filter((s) => s.rows.some((r) => r.d));
  if (!dated.length) return [];
  const ref = dated.reduce((a, b) => (a.rows.length <= b.rows.length ? a : b));
  const refDates = ref.rows.map((r) => r.d).filter(Boolean);
  return refDates.filter((d) => dated.every((s) => s.dateMap.has(d)));
}

function backtestResolveDates(seriesList, periodBars, customStart, customEnd) {
  const allDates = backtestCommonDateList(seriesList);
  if (!allDates.length) return { dates: [], error: "공통 거래일을 찾지 못했습니다." };
  const latest = allDates[allDates.length - 1];
  let endDate = latest;
  if (customEnd) {
    const capped = allDates.filter((d) => d <= customEnd);
    if (!capped.length) {
      return { dates: [], error: `종료일(${customEnd})이 모든 종목 데이터보다 이릅니다.` };
    }
    endDate = capped[capped.length - 1];
  }
  let dates;
  if (customStart) {
    const first = allDates.find((d) => d >= customStart);
    if (!first) {
      return { dates: [], error: `시작일(${customStart})이 모든 종목 데이터보다 늦습니다. 더 이른 날짜를 선택하세요.` };
    }
    if (first > endDate) {
      return { dates: [], error: "시작일이 종료일보다 늦습니다." };
    }
    dates = allDates.filter((d) => d >= first && d <= endDate);
  } else {
    const endIdx = allDates.indexOf(endDate);
    const startIdx = Math.max(0, endIdx - periodBars + 1);
    dates = allDates.slice(startIdx, endIdx + 1);
  }
  if (dates.length < 22) {
    return { dates: [], error: `공통 거래일이 부족합니다 (${dates.length}일). 기간을 줄이거나 종목을 바꿔 보세요.` };
  }
  return { dates, startDate: dates[0], endDate: dates[dates.length - 1] };
}

function backtestPortfolioSeries(seriesList, dates, weights) {
  const startDate = dates[0];
  const startPrices = seriesList.map((s) => s.dateMap.get(startDate));
  const units = startPrices.map((p, i) => (weights[i] / 100) / p);
  return dates.map((d) => {
    let value = 0;
    seriesList.forEach((s, i) => {
      value += units[i] * s.dateMap.get(d);
    });
    return { d, v: value };
  });
}

function backtestIndexedSeries(dateMap, dates) {
  const start = dateMap.get(dates[0]);
  if (!start) return [];
  return dates.map((d) => ({ d, v: (dateMap.get(d) / start) * 100 }));
}

function backtestAnnualizedPct(startVal, endVal, tradingDays) {
  if (!Number.isFinite(startVal) || !Number.isFinite(endVal) || startVal <= 0 || tradingDays < 2) return null;
  const years = tradingDays / 252;
  if (years <= 0) return null;
  return (Math.pow(endVal / startVal, 1 / years) - 1) * 100;
}

function drawBacktestChart(portfolioSeries, benchmarkSeries, startDate, endDate, benchmarkTicker) {
  const svg = byId("backtestChart");
  if (!svg || !portfolioSeries.length) return;
  const width = 800;
  const height = 260;
  const padL = 52;
  const padR = 16;
  const padT = 18;
  const padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const allVals = portfolioSeries.map((p) => p.v);
  if (benchmarkSeries.length) benchmarkSeries.forEach((p) => allVals.push(p.v));
  const minV = Math.min(...allVals) * 0.98;
  const maxV = Math.max(...allVals) * 1.02;
  const span = maxV - minV || 1;
  const xFor = (i) => padL + (i / Math.max(1, portfolioSeries.length - 1)) * plotW;
  const yFor = (v) => padT + plotH - ((v - minV) / span) * plotH;
  const baseY = yFor(100);
  const portPath = pathFromSeries(portfolioSeries.map((p) => p.v), xFor, yFor, "#2563eb", 2.2, "");
  const benchPath = benchmarkSeries.length
    ? pathFromSeries(benchmarkSeries.map((p) => p.v), xFor, yFor, "#94a3b8", 1.8, "6 4")
    : "";
  const y100 = yFor(100);
  const tickCount = 4;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => minV + (span * i) / tickCount);
  const xLabels = [
    { i: 0, label: startDate },
    { i: portfolioSeries.length - 1, label: endDate },
  ];
  if (portfolioSeries.length > 2) {
    const mid = Math.floor((portfolioSeries.length - 1) / 2);
    xLabels.splice(1, 0, { i: mid, label: portfolioSeries[mid].d });
  }
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" rx="8" class="chart-bg"></rect>
    ${yTicks.map((v) => `<line x1="${padL}" y1="${yFor(v).toFixed(1)}" x2="${width - padR}" y2="${yFor(v).toFixed(1)}" class="chart-grid"></line>`).join("")}
    <line x1="${padL}" y1="${y100.toFixed(1)}" x2="${width - padR}" y2="${y100.toFixed(1)}" class="rsi-guide"></line>
    ${portPath}
    ${benchPath}
    ${yTicks.map((v) => `<text x="${padL - 6}" y="${yFor(v) + 4}" text-anchor="end" class="chart-axis">${Math.round(v)}</text>`).join("")}
    ${xLabels.map(({ i, label }) => `<text x="${xFor(i).toFixed(1)}" y="${height - 8}" text-anchor="middle" class="chart-axis">${escapeHtml(String(label || "").slice(2))}</text>`).join("")}
    <text x="${padL + 4}" y="${padT + 12}" class="chart-axis">포트폴리오</text>
    <text x="${padL + 84}" y="${padT + 12}" class="chart-axis" fill="#94a3b8">${escapeHtml(benchmarkTicker)}</text>
    <text x="${padL - 6}" y="${baseY + 4}" text-anchor="end" class="chart-axis">100</text>
  `;
}

function renderBacktestResults(payload) {
  const box = byId("backtestResults");
  const summary = byId("backtestSummary");
  const table = byId("backtestTable");
  if (!box || !summary || !table) return;
  const {
    tickers,
    startDate,
    endDate,
    tradingDays,
    totalReturn,
    annReturn,
    benchmarkReturn,
    alpha,
    stockReturns,
    warnings,
    portfolioSeries,
    benchmarkSeries,
    investment,
    finalValue,
    profit,
    benchmarkTicker,
    benchmarkLabel,
    periodLabel,
    weightLabel,
  } = payload;
  summary.innerHTML = `
    <article class="backtest-metric"><span>포트폴리오 수익률</span><strong class="${cls(totalReturn)}">${fmtPct(totalReturn)}</strong></article>
    <article class="backtest-metric"><span>연환산</span><strong class="${cls(annReturn)}">${annReturn == null ? "—" : fmtPct(annReturn)}</strong></article>
    <article class="backtest-metric"><span>투자금</span><strong class="is-money">${fmtBacktestUsd(investment)}</strong></article>
    <article class="backtest-metric"><span>최종 평가액</span><strong class="is-money ${cls(totalReturn)}">${fmtBacktestUsd(finalValue)}</strong></article>
    <article class="backtest-metric"><span>${escapeHtml(benchmarkTicker)} (${escapeHtml(benchmarkLabel)})</span><strong class="${cls(benchmarkReturn)}">${benchmarkReturn == null ? "—" : fmtPct(benchmarkReturn)}</strong></article>
    <article class="backtest-metric"><span>초과 수익 (α)</span><strong class="${cls(alpha)}">${alpha == null ? "—" : fmtPct(alpha)}</strong></article>
    <article class="backtest-metric"><span>수익금</span><strong class="is-money ${cls(profit)}">${profit >= 0 ? "+" : ""}${fmtBacktestUsd(profit)}</strong></article>
  `;
  const warnHtml = warnings.length
    ? `<p class="backtest-warn">${warnings.map((w) => escapeHtml(w)).join(" ")}</p>`
    : "";
  renderPortfolioRiskPanel({
    stockReturns,
    portfolioSeries,
    benchmarkSeries,
    benchmarkTicker,
    weights: stockReturns.map((row) => row.weightPct / 100)
  });
  table.innerHTML = `
    <caption class="backtest-meta">${escapeHtml(tickers.join(", "))} · ${escapeHtml(periodLabel)} · ${escapeHtml(startDate)} → ${escapeHtml(endDate)} (${tradingDays}거래일) · ${escapeHtml(weightLabel)} · buy-and-hold</caption>
    ${warnHtml}
    <thead><tr><th>티커</th><th>회사</th><th>시작가</th><th>종가</th><th>수익률</th><th>비중</th><th>투자액</th><th>평가액</th></tr></thead>
    <tbody>
      ${stockReturns.map((row) => `
        <tr>
          <td><button type="button" class="ticker-link" data-ticker="${escapeHtml(row.ticker)}">${escapeHtml(row.ticker)}</button></td>
          <td>${escapeHtml(row.company)}</td>
          <td>$${row.startPrice.toFixed(2)}</td>
          <td>$${row.endPrice.toFixed(2)}</td>
          <td class="${cls(row.returnPct)}">${fmtPct(row.returnPct)}</td>
          <td>${row.weightPct.toFixed(1)}%</td>
          <td>${fmtBacktestUsd(row.invested)}</td>
          <td class="${cls(row.returnPct)}">${fmtBacktestUsd(row.finalValue)}</td>
        </tr>
      `).join("")}
    </tbody>
  `;
  table.querySelectorAll(".ticker-link").forEach((btn) => {
    btn.addEventListener("click", () => selectTicker(btn.dataset.ticker, { openSearch: true }));
  });
  drawBacktestChart(portfolioSeries, benchmarkSeries, startDate, endDate, benchmarkTicker);
  box.hidden = false;
  setBacktestStatus("");
}

function percentReturnSeries(series) {
  if (!Array.isArray(series) || series.length < 2) return [];
  const out = [];
  for (let i = 1; i < series.length; i += 1) {
    const prev = Number(series[i - 1]?.v);
    const now = Number(series[i]?.v);
    if (Number.isFinite(prev) && Number.isFinite(now) && prev) out.push((now / prev) - 1);
  }
  return out;
}

function annualizedVolPct(series) {
  const returns = percentReturnSeries(series);
  if (returns.length < 3) return null;
  const avg = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / Math.max(1, returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

function maxDrawdownPct(series) {
  if (!Array.isArray(series) || !series.length) return null;
  let peak = Number(series[0].v);
  let maxDd = 0;
  series.forEach((point) => {
    const value = Number(point.v);
    if (!Number.isFinite(value)) return;
    peak = Math.max(peak, value);
    if (peak) maxDd = Math.min(maxDd, (value / peak - 1) * 100);
  });
  return maxDd;
}

function betaAndCorrelation(portfolioSeries, benchmarkSeries) {
  const p = percentReturnSeries(portfolioSeries);
  const b = percentReturnSeries(benchmarkSeries);
  const n = Math.min(p.length, b.length);
  if (n < 5) return { beta: null, corr: null };
  const pr = p.slice(-n);
  const br = b.slice(-n);
  const avgP = pr.reduce((s, v) => s + v, 0) / n;
  const avgB = br.reduce((s, v) => s + v, 0) / n;
  let cov = 0;
  let varB = 0;
  let varP = 0;
  for (let i = 0; i < n; i += 1) {
    const dp = pr[i] - avgP;
    const db = br[i] - avgB;
    cov += dp * db;
    varB += db * db;
    varP += dp * dp;
  }
  const beta = varB ? cov / varB : null;
  const corr = varB && varP ? cov / Math.sqrt(varB * varP) : null;
  return { beta, corr };
}

function sectorConcentration(stockReturns) {
  const sectors = {};
  stockReturns.forEach((row) => {
    const sector = stockByTicker(row.ticker)?.sector || "Unknown";
    sectors[sector] = (sectors[sector] || 0) + Number(row.weightPct || 0);
  });
  return Object.entries(sectors).sort((a, b) => b[1] - a[1]);
}

function renderPortfolioRiskPanel(payload) {
  const box = byId("portfolioRiskPanel");
  if (!box) return;
  const { stockReturns, portfolioSeries, benchmarkSeries, benchmarkTicker } = payload;
  const maxDd = maxDrawdownPct(portfolioSeries);
  const vol = annualizedVolPct(portfolioSeries);
  const bench = betaAndCorrelation(portfolioSeries, benchmarkSeries);
  const sectors = sectorConcentration(stockReturns);
  const topSector = sectors[0];
  const topPosition = stockReturns.slice().sort((a, b) => b.weightPct - a.weightPct)[0];
  const warnings = [];
  if (topSector && topSector[1] >= 50) warnings.push(`섹터 쏠림: ${topSector[0]} 비중 ${topSector[1].toFixed(0)}% (점검 기준 50% 이상).`);
  if (topPosition && topPosition.weightPct >= 35) warnings.push(`단일 종목 쏠림: ${topPosition.ticker} 비중 ${topPosition.weightPct.toFixed(0)}% (점검 기준 35% 이상).`);
  if (maxDd != null && maxDd <= -30) warnings.push(`하락 위험: 과거 구간 최대낙폭 ${fmtPct(maxDd)} (점검 기준 -30% 이하).`);
  box.innerHTML = `
    <div class="risk-head">
      <div>
        <h3>포트폴리오 위험 분석</h3>
        <p class="muted">수익률뿐 아니라 하락폭, 변동성, 섹터 쏠림을 같이 봅니다.</p>
      </div>
      <span class="quality-badge ${warnings.length ? "quality-warn" : "quality-good"}">${warnings.length ? "점검 필요" : "균형 양호"}</span>
    </div>
    <div class="risk-grid">
      <article><span>최대 낙폭</span><strong class="${cls(maxDd)}">${maxDd == null ? "-" : fmtPct(maxDd)}</strong></article>
      <article><span>연환산 변동성</span><strong>${vol == null ? "-" : fmtPct(vol)}</strong></article>
      <article><span>${escapeHtml(benchmarkTicker)} 베타</span><strong>${bench.beta == null ? "-" : bench.beta.toFixed(2)}</strong></article>
      <article><span>상관계수</span><strong>${bench.corr == null ? "-" : bench.corr.toFixed(2)}</strong></article>
      <article><span>최대 섹터</span><strong>${topSector ? escapeHtml(topSector[0]) : "-"}</strong><em>${topSector ? `${topSector[1].toFixed(1)}%` : ""}</em></article>
      <article><span>최대 종목</span><strong>${topPosition ? escapeHtml(topPosition.ticker) : "-"}</strong><em>${topPosition ? `${topPosition.weightPct.toFixed(1)}%` : ""}</em></article>
    </div>
    ${warnings.length ? `<p class="risk-warn">${warnings.map((w) => escapeHtml(w)).join(" ")}</p>` : `<p class="risk-note">점검 기준: 섹터 50% 이상, 단일 종목 35% 이상, 최대낙폭 -30% 이하. 리밸런싱, 배당, 세금, 거래비용은 반영하지 않습니다.</p>`}
  `;
}

async function runPortfolioBacktest() {
  if (backtestRunning) return;
  const tickers = backtestTickersFromInput();
  const periodMode = backtestPeriodMode();
  const periodBars = backtestPeriodBars();
  const customStart = backtestCustomStartDate();
  const customEnd = backtestCustomEndDate();
  if (tickers.length < 2) {
    setBacktestStatus("2개 이상의 종목을 추가하세요.");
    byId("backtestResults").hidden = true;
    return;
  }
  if (periodMode === "custom") {
    if (!customStart || !customEnd) {
      setBacktestStatus("시작일과 종료일을 모두 선택하세요.");
      byId("backtestResults").hidden = true;
      return;
    }
    if (customStart > customEnd) {
      setBacktestStatus("시작일이 종료일보다 늦을 수 없습니다.");
      byId("backtestResults").hidden = true;
      return;
    }
  }
  const weightResult = backtestWeightsForTickers(tickers);
  if (weightResult.error) {
    setBacktestStatus(weightResult.error);
    byId("backtestResults").hidden = true;
    return;
  }
  const weights = weightResult.weights;
  const investment = backtestInvestmentUsd();
  const benchmarkTicker = backtestBenchmarkTicker();
  const benchmarkLabel = backtestBenchmarkLabel(benchmarkTicker);
  backtestRunning = true;
  setBacktestStatus("가격 이력을 불러오는 중…");
  byId("backtestResults").hidden = true;
  try {
    const loaded = await Promise.all(tickers.map(async (ticker) => {
      const stock = stockByTicker(ticker);
      const detail = await loadStockDetail(ticker);
      const merged = detail ? { ...stock, ...detail } : stock;
      const rows = getChartRows(merged);
      return {
        ticker,
        company: stock?.company || ticker,
        rows,
        dateMap: closeSeriesToDateMap(rows),
        synthetic: isSyntheticChart(merged),
      };
    }));
    const warnings = [];
    const invalid = loaded.filter((s) => s.synthetic || s.dateMap.size < 30);
    invalid.forEach((s) => {
      warnings.push(`${s.ticker}: 실제 일봉 이력 없음 — 제외됨.`);
    });
    const valid = loaded.filter((s) => !s.synthetic && s.dateMap.size >= 30);
    if (valid.length < 2) {
      setBacktestStatus("실제 가격 이력이 있는 종목이 2개 이상 필요합니다. (상위 ~1,400종목 지원)");
      return;
    }
    const weightByTicker = new Map(tickers.map((ticker, index) => [ticker, weights[index]]));
    let activeWeights = valid.map((s) => weightByTicker.get(s.ticker) || 0);
    const weightSum = activeWeights.reduce((sum, w) => sum + w, 0);
    if (weightSum <= 0) {
      setBacktestStatus("유효 종목에 적용할 비중이 없습니다.");
      return;
    }
    activeWeights = activeWeights.map((w) => (w / weightSum) * 100);
    let dateResult = backtestResolveDates(valid, periodBars, customStart, customEnd);
    if (!dateResult.dates.length && periodMode === "preset" && periodBars) {
      dateResult = backtestResolveDates(
        valid,
        Math.min(periodBars, valid.reduce((m, s) => Math.min(m, s.dateMap.size), Infinity)),
        null,
        null,
      );
    }
    if (!dateResult.dates.length) {
      setBacktestStatus(dateResult.error || "시뮬레이션 기간을 계산하지 못했습니다.");
      return;
    }
    const { dates, startDate, endDate } = dateResult;
    if (periodMode === "preset" && periodBars && dates.length < periodBars * 0.6) {
      warnings.push(`선택 종목 중 가격 이력이 짧은 종목이 있어 공통으로 겹치는 ${dates.length}거래일만 시뮬레이션했습니다.`);
    }
    const portfolioRaw = backtestPortfolioSeries(valid, dates, activeWeights);
    const portfolioSeries = portfolioRaw.map((p) => ({ d: p.d, v: (p.v / portfolioRaw[0].v) * 100 }));
    const benchStock = stockByTicker(benchmarkTicker);
    const benchDetail = await loadStockDetail(benchmarkTicker);
    const benchMerged = benchDetail ? { ...benchStock, ...benchDetail } : benchStock;
    const benchRows = getChartRows(benchMerged);
    const benchMap = closeSeriesToDateMap(benchRows);
    const benchmarkSeries = benchMap.has(startDate) ? backtestIndexedSeries(benchMap, dates) : [];
    if (!benchmarkSeries.length) warnings.push(`${benchmarkTicker} 벤치마크 데이터가 시작일에 없어 비교를 생략했습니다.`);
    const portStart = portfolioSeries[0].v;
    const portEnd = portfolioSeries[portfolioSeries.length - 1].v;
    const totalReturn = (portEnd / portStart - 1) * 100;
    const annReturn = backtestAnnualizedPct(portStart, portEnd, dates.length);
    const finalValue = investment * (portEnd / portStart);
    const profit = finalValue - investment;
    let benchmarkReturn = null;
    let alpha = null;
    if (benchmarkSeries.length) {
      benchmarkReturn = benchmarkSeries[benchmarkSeries.length - 1].v - 100;
      alpha = totalReturn - benchmarkReturn;
    }
    const stockReturns = valid.map((s, i) => {
      const startPrice = s.dateMap.get(startDate);
      const endPrice = s.dateMap.get(endDate);
      const returnPct = (endPrice / startPrice - 1) * 100;
      const weightPct = activeWeights[i];
      const invested = investment * (weightPct / 100);
      const finalStockValue = invested * (endPrice / startPrice);
      return { ticker: s.ticker, company: s.company, startPrice, endPrice, returnPct, weightPct, invested, finalValue: finalStockValue };
    }).sort((a, b) => b.returnPct - a.returnPct);
    const periodLabel = periodMode === "custom"
      ? `${startDate} → ${endDate}`
      : (byId("backtestPeriod")?.selectedOptions?.[0]?.textContent || "");
    const weightLabel = byId("backtestWeightMode")?.value === "custom" ? "직접 비중" : "동일 비중";
    renderBacktestResults({
      tickers: valid.map((s) => s.ticker),
      startDate,
      endDate,
      tradingDays: dates.length,
      totalReturn,
      annReturn,
      benchmarkReturn,
      alpha,
      stockReturns,
      warnings,
      portfolioSeries,
      benchmarkSeries,
      investment,
      finalValue,
      profit,
      benchmarkTicker,
      benchmarkLabel,
      periodLabel,
      weightLabel,
    });
  } catch (err) {
    console.warn("backtest failed", err);
    setBacktestStatus("시뮬레이션 중 오류가 발생했습니다.");
  } finally {
    backtestRunning = false;
  }
}

function populateBacktestBenchmarks() {
  const sel = byId("backtestBenchmark");
  if (!sel) return;
  const fromHealth = data.health?.etfRelative?.benchmarks || [];
  const merged = [...new Set([...BACKTEST_BENCHMARK_OPTIONS.map(([t]) => t), ...fromHealth])]
    .filter((t) => stockByTicker(t));
  sel.innerHTML = merged.map((ticker) => {
    const label = backtestBenchmarkLabel(ticker);
    return `<option value="${escapeHtml(ticker)}">${escapeHtml(ticker)} · ${escapeHtml(label)}</option>`;
  }).join("");
  if (!sel.value) sel.value = "SPY";
}

function backtestSnapshotEndDate() {
  return backtestSnapshotIsoDate() || new Date().toISOString().slice(0, 10);
}

function shiftIsoDateByYears(iso, years) {
  const d = new Date(`${iso}T12:00:00`);
  d.setFullYear(d.getFullYear() + years);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function backtestPresetYears(periodValue) {
  if (periodValue === "252") return 1;
  if (periodValue === "1260") return 5;
  if (periodValue === "756") return 3;
  return null;
}

function applyBacktestPresetDates() {
  const period = byId("backtestPeriod")?.value || "756";
  const years = backtestPresetYears(period);
  if (!years) return;
  const startInput = byId("backtestStartDate");
  const endInput = byId("backtestEndDate");
  if (!startInput || !endInput) return;
  const end = backtestSnapshotEndDate();
  const min = "2021-06-17";
  startInput.min = min;
  endInput.min = min;
  startInput.max = end;
  endInput.max = end;
  backtestDatesProgrammatic = true;
  endInput.value = end;
  startInput.value = shiftIsoDateByYears(end, -years);
  backtestDatesProgrammatic = false;
}

function initBacktestDateRange() {
  applyBacktestPresetDates();
}

function syncBacktestCustomUi() {
  const period = byId("backtestPeriod")?.value;
  if (period !== "custom") applyBacktestPresetDates();
  const weightMode = byId("backtestWeightMode")?.value;
  const weightsWrap = byId("backtestWeightsWrap");
  if (weightsWrap) weightsWrap.hidden = weightMode !== "custom";
}

function setBacktestPeriodToCustom() {
  if (backtestDatesProgrammatic) return;
  const sel = byId("backtestPeriod");
  if (sel && sel.value !== "custom") sel.value = "custom";
}

function submitBacktestTickerAdd() {
  const input = byId("backtestTickerInput");
  if (!input) return;
  if (addBacktestTicker(input.value)) input.value = "";
}

function setupBacktestEvents() {
  populateBacktestBenchmarks();
  initBacktestDateRange();
  syncBacktestCustomUi();
  if (!backtestTickers.length) setBacktestTickers(watchlist.slice(0, 5));
  else renderBacktestTickerChips();
  const run = () => runPortfolioBacktest();
  byId("backtestRun")?.addEventListener("click", run);
  byId("backtestTickerAdd")?.addEventListener("click", submitBacktestTickerAdd);
  byId("backtestTickerInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitBacktestTickerAdd();
    }
  });
  byId("backtestFromWatchlist")?.addEventListener("click", () => {
    setBacktestTickers(watchlist.slice(0, BACKTEST_MAX_TICKERS));
    run();
  });
  byId("backtestPeriod")?.addEventListener("change", () => {
    syncBacktestCustomUi();
    if (byId("backtestResults")?.hidden) setBacktestStatus("");
    if (!byId("backtestResults")?.hidden) run();
  });
  byId("backtestWeightMode")?.addEventListener("change", () => {
    syncBacktestCustomUi();
    renderBacktestTickerChips();
  });
  ["backtestBenchmark", "backtestInvestment", "backtestWeights"].forEach((id) => {
    byId(id)?.addEventListener("change", () => {
      if (!byId("backtestResults")?.hidden) run();
    });
  });
  ["backtestStartDate", "backtestEndDate"].forEach((id) => {
    byId(id)?.addEventListener("change", () => {
      setBacktestPeriodToCustom();
      const start = byId("backtestStartDate")?.value;
      const end = byId("backtestEndDate")?.value;
      if (start && end && start > end) setBacktestStatus("시작일이 종료일보다 늦습니다.");
      else if (byId("backtestResults")?.hidden) setBacktestStatus("");
      if (!byId("backtestResults")?.hidden) run();
    });
  });
}

loadData();
