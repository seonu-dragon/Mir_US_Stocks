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
let cardNewsBackup = null;
let usingFallbackSnapshot = false;

// Tickers with bad/synthetic snapshot data (e.g. pre-IPO placeholders).
const TICKER_BLOCKLIST = new Set(["SPCX"]);

function featureDataSrc(path) {
  const v = window.MIR_BUILD_ID || "dev";
  return `${path}?v=${v}`;
}

function filterBlockedStocks(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.stocks)) return snapshot;
  const stocks = snapshot.stocks.filter((item) => !TICKER_BLOCKLIST.has(String(item.ticker || "").toUpperCase()));
  if (stocks.length === snapshot.stocks.length) return snapshot;
  return { ...snapshot, stocks };
}
function marketCfg() {
  return (window.MirMarket && window.MirMarket.getConfig()) || {
    id: "us",
    formatTicker: (t) => String(t || "").toUpperCase(),
    defaultTicker: "NVDA",
    defaultBucket: "idx_sp500",
    buckets: [],
    matchBucket: () => true,
    formatPrice: (v) => (Number.isFinite(Number(v)) ? `$${Number(v).toFixed(2)}` : "-"),
    formatMoney: (v) => (Number.isFinite(Number(v)) ? `$${Number(v).toFixed(2)}` : "-"),
    formatMarketCap: (v) => String(v ?? "-"),
    sectorEtfs: [],
    etfBenchmarks: ["SPY"],
    indexAnalysisMap: {},
    cardnewsDefault: "us",
    snapshotPath: "data/market_snapshot.json",
    snapshotJsGlobal: "MARKET_SNAPSHOT",
    hiddenInstitutionalSubs: [],
    features: {},
  };
}
function isKrMarket() { return marketCfg().id === "kr"; }
function isStockEtf(item) {
  if (!item) return false;
  if (isKrMarket()) {
    const fn = window.MirMarket?.isKrEtfLike;
    return fn ? fn(item) : item.sector === "ETF" || item.market === "etf";
  }
  return item.sector === "EXCHANGE TRADED FUNDS" || item.sector === "ETF";
}
function normalizeTickerKey(ticker) { return marketCfg().formatTicker(ticker); }
function liveProxyTicker(itemOrTicker) {
  const cfg = marketCfg();
  if (cfg.id === "kr") {
    const item = typeof itemOrTicker === "object" ? itemOrTicker : stockByTicker(itemOrTicker);
    return cfg.yahooTicker(item || { ticker: itemOrTicker }, item?.market);
  }
  const raw = (itemOrTicker && typeof itemOrTicker === "object") ? (itemOrTicker.ticker || "") : itemOrTicker;
  return String(raw || "").toUpperCase();
}
let selectedTicker = (window.MirMarket && window.MirMarket.getInitialMode() === "kr") ? "005930" : "NVDA";
let chatFocusTicker = selectedTicker;
let scoreHelpOpen = null;
function getSectorEtfs() {
  const cfg = marketCfg();
  return (cfg.sectorEtfs && cfg.sectorEtfs.length) ? cfg.sectorEtfs : SECTOR_ETFS;
}

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
window.MIR_LIVE_PROXY = LIVE_DATA_PROXY;
const liveNewsCache = {};
const liveChartCache = {};
const liveEarningsCache = {};
const liveSummaryCache = {};
const liveNewsSourceCache = {}; // "naver" | "yahoo" — which source the proxy returned
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
  showSupportResistance: false, // 지지/저항 수평선 오버레이(상승확률 분석에서 켜짐)
  showTechLevels: false, // 피벗·Fib·ATR·LinReg 등 기술 레벨선 마스터
  techLevelTypes: {
    pivot: false, r1: false, r2: false, s1: false, s2: false,
    fib0: false, fib236: false, fib382: false, fib50: false, fib618: false, fib100: false,
    stop: false, tgt: false, tgt2: false,
    lrUpper: false, lrLower: false, psar: false,
  },
  showVolumeProfile: false,
  showTrendlines: false,
  showGapZones: false,
  showTtmSqueeze: false,
  showMarketStructure: false,
  showChandelier: false,
  showAnchoredVwap: false,
  showPatterns: false, // 차트 패턴(역H&S 등) 도형 오버레이 마스터
  patternTypes: {
    hns: true, double: true, triangle: true, wedge: true, box: true, flag: true, pennant: true,
    triple: true, broadening: true, diamond: true, rounding: true, complex_hns: true, breakout: true,
    cup: true, channel: true, reversal: true, trap: true, gap: true, volume: true, squeeze: true,
    harmonic: true, candle: true,
  },
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
  showCmf: false,
  showMfi: false,
  showRsSpy: false,
  showRsQqq: false,
  showRsSector: false,
  showMansfield: false
};

let compareTickers = [];
// 관심종목은 시장별로 따로 저장한다. 예전엔 US/KR 이 mir_watchlist_v1 하나를 공유했고
// persistWatchlist 가 현재 시장 스냅샷 기준으로 필터해 저장했기 때문에, 시장을 전환하는
// 순간 반대 시장 목록이 통째로 지워졌다(클라우드 동기화로 유실이 전파되기까지 했다).
const WATCHLIST_LEGACY_KEY = "mir_watchlist_v1"; // 마이그레이션 전용
function watchlistStorageKey(marketId) {
  const id = marketId || (isKrMarket() ? "kr" : "us");
  return id === "kr" ? "mir_watchlist_kr" : "mir_watchlist_us";
}
const CHART_PRESET_STORAGE_KEY = "mir_chart_presets_v1";
const WATCH_ALERT_STORAGE_KEY = "mir_watch_alerts_v1";
const VIEW_MODE_STORAGE_KEY = "mir_view_mode_v2";
// 첫 방문자 기본값. 탭 10개를 한꺼번에 보여주면 처음 온 사람에겐 과하다. 기존 사용자는
// setupViewMode 가 localStorage 를 먼저 읽으므로 영향이 없고, 고급 탭으로 들어오는
// 딥링크(?tab=signals 등)도 거기서 advanced 로 승격되므로 그대로 동작한다.
const DEFAULT_VIEW_MODE = "basic";
const SAVED_SCREENER_STORAGE_KEY = "mir_saved_screeners_v1";
const ESTIMATE_HISTORY_STORAGE_KEY = "mir_estimate_history_v1";

const DEFAULT_WATCHLIST_US = ["NVDA", "MSFT", "AAPL", "PLTR", "SOXX"];
const DEFAULT_WATCHLIST_KR = ["005930", "000660", "005380", "035420", "069500"];
function defaultWatchlist() { return isKrMarket() ? DEFAULT_WATCHLIST_KR : DEFAULT_WATCHLIST_US; }
let watchlist = [];
let chartPresets = {};
let moveAnalysisState = null;
let earningsCalendarCache = null;
let earningsCalendarLoading = false;
let earnView = "calendar";   // "calendar" | "list"
let earnSector = "all";
let earnSort = "date";       // "date" | "cap" | "rs"
let earnWatchOnly = false;
let deferredInstallPrompt = null;
let estimateHistoryStore = null;

const TOP_PRESETS = {
  leaders: { metric: "rsScore", minRs: 85, minEps: 70, minVolume: 0, minMarketCap: 10, newHigh: "All", recency: "All" },
  breakout: { metric: "volumeRatio", minRs: 75, minEps: 0, minVolume: 1.5, minMarketCap: 1, newHigh: "0-2%", recency: "All" },
  pullback: { metric: "rsScore", minRs: 80, minEps: 60, minVolume: 0, minMarketCap: 5, newHigh: "5-10%", recency: "All" },
  growth: { metric: "epsRevScore", minRs: 70, minEps: 80, minVolume: 0, minMarketCap: 2, newHigh: "All", recency: "All" },
  value: { metric: "forwardPE", minRs: 50, minEps: 50, minVolume: 0, minMarketCap: 10, newHigh: "All", recency: "All" },
  lows: { metric: "low52Dist", minRs: 0, minEps: 0, minVolume: 0, minMarketCap: 1, newHigh: "All", recency: "All" },
  volsurge: { metric: "volumeRatio", minRs: 0, minEps: 0, minVolume: 3, minMarketCap: 1, newHigh: "All", recency: "All" },
  oversold: { metric: "rsi14", minRs: 0, minEps: 0, minVolume: 0, minMarketCap: 2, newHigh: "All", recency: "All" }
};

// 52주 저가 대비 상승률(%) — MAP_FUNDAMENTALS.low52 + 스냅샷 price 로 계산.
function low52DistPct(item) {
  const f = (window.MAP_FUNDAMENTALS || {})[item?.ticker];
  const low = f && Number(f.low52);
  const price = Number(item?.price);
  if (!Number.isFinite(low) || low <= 0 || !Number.isFinite(price)) return NaN;
  return (price / low - 1) * 100;
}

const KR_PRICE_LIMIT_PCT = 30;

function krDisplayChangePct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (!isKrMarket()) return n;
  return Math.max(-KR_PRICE_LIMIT_PCT, Math.min(KR_PRICE_LIMIT_PCT, n));
}

// 범용 %포맷 — 클램프 없음. 1주·1개월·YTD 같은 기간 수익률은 KR 에서도 ±30% 를
// 정상적으로 넘을 수 있으므로 여기로 온다. (예전엔 모든 %가 krDisplayChangePct 를
// 거쳐 기간 수익률까지 "(상하한)" 으로 잘려 나갔다.)
const fmtPct = (value) => {
  const n = Number(value) || 0;
  const marker = n > 0 ? "▲ " : n < 0 ? "▼ " : "";
  return `${marker}${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
};

// 당일 등락률 전용 — KR 은 가격제한폭(±30%) 을 넘을 수 없으므로, 넘는 값은 데이터
// 오류(전일종가 어긋남 등)로 보고 상하한으로 클램프하고 "(상하한)" 을 표시한다.
const fmtDailyPct = (value) => {
  const raw = Number(value) || 0;
  const n = isKrMarket() ? krDisplayChangePct(raw) : raw;
  const atLimit = isKrMarket() && Math.abs(raw) > KR_PRICE_LIMIT_PCT + 0.05;
  const marker = n > 0 ? "▲ " : n < 0 ? "▼ " : "";
  const suffix = atLimit ? " (상하한)" : "";
  return `${marker}${n > 0 ? "+" : ""}${n.toFixed(1)}%${suffix}`;
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

// Inject the active market's snapshot .js (window global) on demand. Used as the
// file:// path and as an http fallback when the JSON fetch fails. Only the active
// market is ever loaded, so we never download the other market's snapshot.
function loadEarningsCalendarSnapshot(cfg) {
  return new Promise((resolve) => {
    // 이 시장에 실적 예정일 데이터가 없으면 아예 요청하지 않는다. KR 은 해당
    // 파일이 존재한 적이 없어 부팅 때마다 404 를 냈다(market_config 주석 참고).
    if (cfg.features && cfg.features.earningsCalendar === false) { resolve(false); return; }
    const isKr = cfg.id === "kr";
    const src = isKr ? "data/korea/earnings_calendar.js" : "data/earnings_calendar.js";
    const globalName = isKr ? "KOREA_EARNINGS_CALENDAR" : "EARNINGS_CALENDAR_SNAPSHOT";
    if (window[globalName]) { resolve(true); return; }
    const existing = document.querySelector(`script[data-earnings-calendar="${cfg.id}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.earningsCalendar = cfg.id;
    script.addEventListener("load", () => resolve(true), { once: true });
    script.addEventListener("error", () => resolve(false), { once: true });
    document.head.appendChild(script);
  });
}

function earningsSnapshotRows() {
  const payload = isKrMarket() ? window.KOREA_EARNINGS_CALENDAR : window.EARNINGS_CALENDAR_SNAPSHOT;
  return Array.isArray(payload?.earnings) ? payload.earnings : [];
}

function staticEarningsRowsForTickers(tickers) {
  const pool = new Set(tickers.map((t) => normalizeTickerKey(t)));
  return earningsSnapshotRows().filter((row) => pool.has(normalizeTickerKey(row.ticker)));
}

function staticEarningsForTicker(ticker) {
  const row = earningsSnapshotRows().find((item) => normalizeTickerKey(item.ticker) === normalizeTickerKey(ticker));
  if (!row?.nextDate) return null;
  return {
    nextDate: row.nextDate,
    epsEstimate: row.epsEstimate ?? null,
    dates: [row.nextDate],
    history: Array.isArray(row.history) ? row.history : [],
  };
}

function loadMapFundamentalsScript(cfg) {
  return new Promise((resolve) => {
    const isKr = cfg.id === "kr";
    const src = isKr ? "data/korea/map_fundamentals.js" : "data/map_fundamentals.js";
    const globalName = isKr ? "KOREA_MAP_FUNDAMENTALS" : "MAP_FUNDAMENTALS";
    const apply = () => {
      window.MAP_FUNDAMENTALS = window[globalName] || {};
      // 시장마다 있는 지표가 달라 옵션을 다시 걸러야 한다(KR 은 P/S 가 없는 등).
      refreshFundamentalMetricOptions();
      resolve(true);
    };
    if (window[globalName] && Object.keys(window[globalName]).length) {
      apply();
      return;
    }
    const existing = document.querySelector(`script[data-map-fundamentals="${cfg.id}"]`);
    if (existing) {
      existing.addEventListener("load", apply, { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.dataset.mapFundamentals = cfg.id;
    script.addEventListener("load", apply, { once: true });
    script.addEventListener("error", () => resolve(false), { once: true });
    document.head.appendChild(script);
  });
}

function loadSnapshotScript(cfg) {
  return new Promise((resolve) => {
    if (window[cfg.snapshotJsGlobal]) { resolve(true); return; }
    const src = cfg.snapshotJsPath || cfg.snapshotPath.replace(/\.json($|\?)/, ".js$1");
    const existing = document.querySelector(`script[data-snapshot="${cfg.id}"]`);
    const done = () => resolve(!!window[cfg.snapshotJsGlobal]);
    if (existing) {
      existing.addEventListener("load", done, { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.dataset.snapshot = cfg.id;
    script.addEventListener("load", done, { once: true });
    script.addEventListener("error", () => resolve(false), { once: true });
    document.head.appendChild(script);
  });
}

// Feature datasets that used to be eager <script> tags in index.html. They are
// multi-MB and many are US-only, so we load them on demand after boot, gated by
// the active market's feature flags. `feature` maps to cfg.features; `usOnly`
// loads only in US mode; datasets without either load in both markets.
const FEATURE_DATA = {
  inst13f:    { global: "INSTITUTIONAL_13F",     path: "data/institutional_13f.js",     feature: "sec13f",   heavy: true },
  congress:   { global: "CONGRESS_TRADES",       path: "data/congress_trades.js",       feature: "congress", heavy: true },
  insider:    { global: "INSIDER_TRADES",        path: "data/insider_trades.js",        feature: "insider",  heavy: true },
  activist:   { global: "ACTIVIST_STAKES",       path: "data/activist_stakes.js",       feature: "activist" },
  events:     { global: "MATERIAL_EVENTS",       path: "data/material_events.js",       feature: "materialEvents" },
  ipo:        { global: "IPO_CALENDAR",          path: "data/ipo_calendar.js",          feature: "ipo",          marketSpecific: true },
  short:      { global: "SHORT_INTEREST",        path: "data/short_interest.js",        feature: "shortInterest", marketSpecific: true },
  whitehouse: { global: "WHITE_HOUSE_SCHEDULE",  path: "data/white_house_schedule.js",  feature: "whiteHouse" },
  leveraged:  { global: "LEVERAGED_ETF_CATALOG", path: "data/leveraged_etf_catalog.js", usOnly: true },
  krDart:     { global: "KR_DISCLOSURES",        path: "data/kr_disclosures.js",        feature: "krDart", krOnly: true },
  krOwnership:{ global: "KR_OWNERSHIP",          path: "data/kr_ownership.js",          feature: "krOwnership", krOnly: true },
  // 지분 '상태'(유통물량·자사주·최대주주 지분율). 위 krOwnership 은 최근 지분공시
  // '이벤트' 라 성격이 다르지만 같은 패널에서 종류 탭으로 나눠 보여준다.
  krOwnProfile:{ global: "KR_OWNERSHIP_PROFILE",  path: "data/korea/ownership_profile.js", feature: "krOwnership", krOnly: true },
  // 공시 제목에 붙일 숫자(증자 희석률·CB 전환가·자사주 금액). rcept_no 로 조인한다.
  krEventDetails:{ global: "KR_EVENT_DETAILS",    path: "data/kr_event_details.js",      feature: "krDart", krOnly: true },
  // 감사의견. 비적정(의견거절·한정)은 상장폐지 사유라 종목 헤더에 경고로 띄운다.
  krAudit:    { global: "KR_AUDIT_OPINION",       path: "data/korea/audit_opinion.js",  feature: "krDart", krOnly: true },
  // 공시 유형별 과거 주가 반응(5년·55만건). 신호가 아니라 '신호가 아니다' 를 보여주는
  // 데이터다 — 41개 유형 중 무작위를 이긴 건 0개다(build_kr_disclosure_stats.py).
  krDiscStats:{ global: "KR_DISCLOSURE_STATS",    path: "data/korea/disclosure_stats.js", feature: "krDart", krOnly: true },
  // 수급(외국인·기관·개인 순매수, 외국인 보유율) + 컨센서스 목표주가. 484KB 라
  // heavy(3~5MB) 는 아니지만 KR 전용이라 미국에선 안 받는다.
  krFlow:     { global: "KR_INVESTOR_FLOW",       path: "data/korea/investor_flow.js", krOnly: true },
  // 잠정실적 발표 + 발표일·익일 주가반응(build_kr_earnings_reactions.py). KR 전용.
  krEarningsReact:{ global: "KR_EARNINGS_REACTIONS", path: "data/korea/earnings_reactions.js", feature: "krDart", krOnly: true },
  // 배당·공급계약 공시 원문 파싱(build_kr_corp_disclosures.py). KR 전용.
  krDividends:{ global: "KR_DIVIDENDS", path: "data/korea/dividends.js", feature: "krDart", krOnly: true },
  krContracts:{ global: "KR_CONTRACTS", path: "data/korea/contracts.js", feature: "krDart", krOnly: true },
  // 미국 국채 수익률 곡선(FRED). 매크로 컨텍스트라 두 시장 모두에서 로드(미국 금리는
  // 글로벌 위험자산에 공통 영향). 시그널 탭 상단에 곡선·장단기 스프레드로 표시.
  yieldCurve: { global: "YIELD_CURVE", path: "data/yield_curve.js" },
  // FRED 매크로 지표(인플레·고용·금리·신용스프레드·소비심리). 두 시장 모두 로드.
  macro: { global: "MACRO_INDICATORS", path: "data/macro_indicators.js" },
  // 옵션 심리(풋콜비율·맥스페인, Yahoo). 미국 대형주만 옵션이 있어 US 전용.
  optionsStats: { global: "OPTIONS_STATS", path: "data/options_stats.js", usOnly: true },
  // 연방 계약(USASpending). 정부 매출이 큰 방산·IT·헬스 종목만 있어 US 전용 alt-data.
  federalContracts: { global: "FEDERAL_CONTRACTS", path: "data/federal_contracts.js", usOnly: true },
  // 애널리스트 컨센서스(Finnhub 추천·실적 서프라이즈). 무료 티어가 미국만이라 US 전용.
  analystConsensus: { global: "ANALYST_CONSENSUS", path: "data/analyst_consensus.js", usOnly: true },
  // FINRA 일일 공매도 거래량(통합). 미국만 공개라 US 전용.
  finraShort: { global: "FINRA_SHORT_VOLUME", path: "data/finra_short_volume.js", usOnly: true },
  // 배당 + 다음 실적 예정일(Yahoo). US 전용(KR 은 별도 배당 트래커가 있음).
  usCalendar: { global: "US_STOCK_CALENDAR", path: "data/us_calendar.js", usOnly: true },
};
const _featureDataPromises = {};

function featureDataEnabled(meta, cfg) {
  if (meta.usOnly) return cfg.id === "us";
  if (meta.krOnly) return cfg.id === "kr";
  if (meta.feature) return !(cfg.features && cfg.features[meta.feature] === false);
  return true;
}

// Inject a feature dataset's <script> once. Resolves true when its window global
// is available, false if disabled for this market or the load failed. The result
// for a disabled feature is not cached, so a later market switch can still load it.
function ensureFeatureData(key) {
  const meta = FEATURE_DATA[key];
  if (!meta) return Promise.resolve(false);
  if (window[meta.global]) return Promise.resolve(true);
  if (!featureDataEnabled(meta, marketCfg())) return Promise.resolve(false);
  if (_featureDataPromises[key]) return _featureDataPromises[key];

  let path = meta.path;
  if (meta.marketSpecific && marketCfg().id === "kr") {
    path = `data/korea/${path.split("/").pop()}`;
  }
  const src = featureDataSrc(path);

  _featureDataPromises[key] = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.featureData = key;
    script.addEventListener("load", () => resolve(!!window[meta.global]), { once: true });
    script.addEventListener("error", () => { delete _featureDataPromises[key]; resolve(false); }, { once: true });
    document.head.appendChild(script);
  });
  return _featureDataPromises[key];
}

// After boot, stream in the *light* feature datasets — but only once the browser is
// idle, so the prefetch never competes with first paint or the market snapshot.
// Heavy datasets (13F / congress / insider, ~11MB combined) are excluded here and
// load lazily when their tab is first opened (see renderWithFeature / activateTab),
// so a visitor who never opens those tabs never downloads them.
function preloadFeatureData() {
  const run = () => Object.keys(FEATURE_DATA).forEach((key) => {
    if (FEATURE_DATA[key].heavy) return;
    ensureFeatureData(key).then((ok) => { if (ok) scheduleFeatureViewRefresh(); });
  });
  if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: 2500 });
  else setTimeout(run, 1200);
}

// Render a feature surface, lazy-loading its dataset on first use. While the dataset
// streams in, a loading notice is shown in `loadingTargetId` (if given); the surface
// re-renders once the data lands. Datasets already loaded render synchronously.
// `shouldLoad` gates the network fetch: pass false when rendering a hidden/pre-rendered
// surface (e.g. the boot pre-render) so heavy datasets only download once the surface
// is actually viewed.
function renderWithFeature(key, renderFn, loadingTargetId, shouldLoad = true) {
  const meta = FEATURE_DATA[key];
  if (shouldLoad && meta && featureDataEnabled(meta, marketCfg()) && !window[meta.global]) {
    const target = loadingTargetId ? byId(loadingTargetId) : null;
    if (target) target.innerHTML = '<p class="muted">데이터를 불러오는 중…</p>';
    ensureFeatureData(key).then(() => renderFn());
    return;
  }
  renderFn();
}

let _featureRefreshTimer = null;
function scheduleFeatureViewRefresh() {
  clearTimeout(_featureRefreshTimer);
  _featureRefreshTimer = setTimeout(refreshFeatureViews, 250);
}

// Re-render only the on-screen surfaces that read feature globals (no network).
function refreshFeatureViews() {
  const calls = [renderSignals, renderActionBoard, renderKrHighlights];
  if (currentTab === "institutional") {
    calls.push(() => activateInstitutionalSub(institutionalSubTab, { push: false }));
  } else if (currentTab === "search") {
    if (searchSubTab === "short") {
      calls.push(renderShortInterest);
    } else if (selectedTicker && data && Array.isArray(data.stocks)) {
      const base = data.stocks.find((r) => r.ticker === selectedTicker);
      if (base) {
        const item = applyLive(withDetail(base));
        calls.push(
          () => renderCongressTradesForTicker(item),
          () => renderSmartMoney(item),
          () => renderMoveExplanation(item),
          () => renderEstimateRevision(item),
          () => renderStockEvents(item),
        );
      }
    }
  }
  // 종목 요약 패널은 렌더 시점에 피처 전역이 없으면 카드(수급·감사의견)를 "" 로 빼고
  // 끝이라, 데이터가 늦게 도착하면 그 카드가 영영 안 나온다. 라이브에서 krFlow(484KB)가
  // 패널 렌더보다 늦게 도착해 수급 카드가 간헐적으로 통째로 빠졌다 — 로컬에선 데이터가
  // 빨라 거의 안 보이던 경합이다. 패널이 떠 있으면 다시 그린다.
  if (selectedTicker && data && Array.isArray(data.stocks)) {
    const base = data.stocks.find((r) => r.ticker === selectedTicker);
    if (base) {
      const item = applyLive(withDetail(base));
      if (byId("selectedStock")) calls.push(() => renderSelected(item));
      const facts = byId("searchFacts");
      if (facts) calls.push(() => { facts.innerHTML = stockFacts(item, "Search Ticker"); });
    }
  }
  if (byId("sub-etf-lev")?.classList.contains("is-active")) {
    calls.push(() => ensureFeatureData("leveraged").then(() => renderLeveragedEtfPage()));
  }
  calls.forEach((fn) => { try { fn(); } catch (e) { console.warn("refreshFeatureViews", e); } });
}

// The MirProb analysis engine (analysis.js) reads 13F / insider / short-interest
// globals as scoring inputs. Await them before a deep run so lazy loading never
// silently drops those signals. In KR mode these are disabled → resolves instantly.
function ensureAnalysisFeatureData() {
  return Promise.all([
    ensureFeatureData("inst13f"),
    ensureFeatureData("insider"),
    ensureFeatureData("short"),
    ensureFeatureData("optionsStats"),
    ensureFeatureData("federalContracts"),
    ensureFeatureData("analystConsensus"),
    ensureFeatureData("finraShort"),
    ensureFeatureData("usCalendar"),
  ]);
}

async function loadData(options = {}) {
  const cfg = marketCfg();
  let loaded = false;
  usingFallbackSnapshot = false;
  if (window.location.protocol !== "file:") {
    try {
      // no-cache 는 캐시를 쓰되 매번 서버에 재검증한다 — 데이터 신선도는 no-store 와
      // 같지만, 바뀐 게 없으면 GitHub Pages 가 ETag 로 304(0바이트)를 돌려준다.
      // no-store 는 캐시를 아예 쓰지 않아 재방문마다 스냅샷 전체를 다시 받았다.
      const response = await fetch(cfg.snapshotPath, { cache: "no-cache" });
      if (response.ok) {
        data = filterBlockedStocks(await response.json());
        loaded = true;
      }
    } catch (error) {
      // Not user-facing: we fall back to the .js snapshot below (and warn only if that
      // also fails). Keep this at debug level so a transient blip isn't console noise.
      console.debug("JSON snapshot fetch failed, falling back to script", error);
    }
  }

  // file:// (no fetch) or fetch failed → load the active market's snapshot script.
  if (!loaded) {
    await loadSnapshotScript(cfg);
    if (window[cfg.snapshotJsGlobal]) {
      data = filterBlockedStocks(window[cfg.snapshotJsGlobal]);
      loaded = true;
    }
  }

  if (!loaded) {
    console.warn(`Using fallback snapshot for ${cfg.id}. Regenerate ${cfg.snapshotPath}.`);
    data = fallbackData;
    usingFallbackSnapshot = true;
  }

  await loadMapFundamentalsScript(cfg);
  loadEarningsCalendarSnapshot(cfg);

  // 백업 및 복원 로직: 한쪽 마켓 스냅샷에 cardNews가 없는 경우 상대 마켓(기본적으로 US) 스냅샷에서 백업/복원
  if (data && data.cardNews) {
    cardNewsBackup = data.cardNews;
  } else if (data && !data.cardNews) {
    if (cardNewsBackup) {
      data.cardNews = cardNewsBackup;
    } else {
      try {
        const usSnapPath = "data/market_snapshot.json";
        const response = await fetch(usSnapPath);
        if (response.ok) {
          const usData = await response.json();
          if (usData && usData.cardNews) {
            cardNewsBackup = usData.cardNews;
            data.cardNews = cardNewsBackup;
          }
        }
      } catch (err) {
        console.warn("Failed to fetch fallback cardNews from US snapshot", err);
      }
    }
  }

  if (!options.skipBoot) boot(options);
  if (typeof refreshMirDataStatus === "function") refreshMirDataStatus();
  if (typeof updateOnlineStatus === "function") updateOnlineStatus();
}

function showFallbackBanner() {
  const existing = byId("fallbackDataBanner");
  if (!usingFallbackSnapshot) {
    if (existing) existing.hidden = true;
    return;
  }
  let banner = existing;
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "fallbackDataBanner";
    banner.className = "fallback-data-banner";
    banner.setAttribute("role", "alert");
    banner.innerHTML = `<strong>데모 데이터 표시 중</strong><span>시장 스냅샷을 불러오지 못해 샘플 데이터만 보여주고 있습니다. 새로고침하거나 잠시 후 다시 시도해 주세요.</span>`;
    document.body.prepend(banner);
  }
  banner.hidden = false;
}

function resetMarketCaches() {
  Object.keys(detailCache).forEach((k) => delete detailCache[k]);
  Object.keys(detailPromises).forEach((k) => delete detailPromises[k]);
  tickerKoAliasIndex = null;
  tickerKoAliasEntries = null;
  tickerSearchIndex = null;

  // Clear market-specific feature globals and promises so they reload for the new market!
  Object.keys(FEATURE_DATA).forEach((key) => {
    const meta = FEATURE_DATA[key];
    if (meta.marketSpecific) {
      delete _featureDataPromises[key];
      delete window[meta.global];
    }
  });
}

async function switchMarketMode(mode) {
  if (!window.MirMarket || window.MirMarket.getMode() === mode) return;
  window.MirMarket.setMode(mode);
  const cfg = marketCfg();
  cardnewsView = cfg.cardnewsDefault;
  selectedTicker = cfg.defaultTicker;
  selectedSectorEtf = (cfg.sectorEtfs[0] || {}).ticker || selectedSectorEtf;
  selectedSectorBenchmark = cfg.etfBenchmarks[0] || selectedSectorBenchmark;
  resetMarketCaches();
  await loadData({ preserveRoute: true });
}

let marketModeUiReady = false;

function setupMarketMode() {
  if (!window.MirMarket) return;
  if (!marketModeUiReady) {
    window.MirMarket.setMode(window.MirMarket.getInitialMode(), { skipButtons: false });
  } else {
    window.MirMarket.setMode(window.MirMarket.getMode(), { skipButtons: false });
  }
  window._mirWatchlistMatch = (item) => watchlist.includes(item.ticker);
  window._mirPortfolioMatch = (item) => portfolio.some((p) => p && p.ticker === item.ticker);
  const switchEl = byId("marketModeSwitch");
  if (switchEl && !marketModeUiReady) {
    switchEl.querySelectorAll("[data-market-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.marketMode;
        if (mode && mode !== window.MirMarket.getMode()) switchMarketMode(mode);
      });
    });
    marketModeUiReady = true;
  }
  applyMarketOnlyUi();
}

const SECTOR_BENCHMARK_LABELS = {
  SPY: "SPY (S&P 500)", QQQ: "QQQ (Nasdaq 100)", TQQQ: "TQQQ (3x Nasdaq)",
  DIA: "DIA (Dow Jones)", IWM: "IWM (Russell 2000)",
};

// The 섹터 차트 비교 benchmark dropdown is market-specific (US uses SPY/QQQ…, KR uses
// KODEX 200 등). Build it from cfg.etfBenchmarks so KR never offers US-only symbols
// (which have no entry in the KR snapshot's sector_charts → blank chart).
function populateSectorBenchmarkSelect(cfg) {
  const select = byId("sectorBenchmarkSelect");
  if (!select) return;
  const benches = (cfg.etfBenchmarks && cfg.etfBenchmarks.length) ? cfg.etfBenchmarks : ["SPY"];
  const sectorName = {};
  (cfg.sectorEtfs || []).forEach((e) => { sectorName[e.ticker] = e.name; });
  select.innerHTML = benches.map((t) => {
    const label = SECTOR_BENCHMARK_LABELS[t] || (sectorName[t] ? `${t} (${sectorName[t]})` : t);
    return `<option value="${t}">${escapeHtml(label)}</option>`;
  }).join("");
  if (!benches.includes(selectedSectorBenchmark)) selectedSectorBenchmark = benches[0];
  select.value = selectedSectorBenchmark;
}

const ETF_RS_BENCHMARK_OPTIONS = {
  us: [["SPY", "SPY (S&P 500)"], ["QQQ", "QQQ (Nasdaq 100)"], ["TQQQ", "TQQQ (3x Nasdaq)"], ["DIA", "DIA (Dow Jones)"], ["IWM", "IWM (Russell 2000)"]],
  kr: [["069500", "KODEX 200 (코스피200)"], ["229200", "KODEX 코스닥150"], ["102110", "TIGER 200"]],
};

// ETF 상대강도 순위 페이지의 "비교 기준" 드롭다운도 시장별로 다르게 채운다.
function populateEtfRsBenchmarkSelect(cfg) {
  const select = byId("sectorEtfRsBenchmark");
  if (!select) return;
  const opts = ETF_RS_BENCHMARK_OPTIONS[cfg.id] || ETF_RS_BENCHMARK_OPTIONS.us;
  const prev = select.value;
  select.innerHTML = opts.map(([v, l]) => `<option value="${v}">${escapeHtml(l)} 대비</option>`).join("");
  select.value = opts.some(([v]) => v === prev) ? prev : opts[0][0];
}

function applyMarketOnlyUi() {
  const cfg = marketCfg();
  document.title = cfg.pageTitle;
  // SEO·공유 메타도 시장에 맞춘다 — 타이틀만 바뀌고 description/og:* 가 "미국 주식"
  // 으로 남으면 KR 모드에서 공유 카드·검색 스니펫이 어긋난다.
  const metaDesc = cfg.id === "kr"
    ? "국내 주식(코스피·코스닥) 시장 트리맵, 섹터 흐름, 급등주, 관심 종목 분석 대시보드"
    : "미국 주식 시장 트리맵, 섹터 흐름, 급등주, 관심 종목 분석 대시보드";
  const setMeta = (selector, content) => {
    const el = document.querySelector(selector);
    if (el) el.setAttribute("content", content);
  };
  setMeta('meta[name="description"]', metaDesc);
  setMeta('meta[property="og:title"]', cfg.pageTitle);
  setMeta('meta[property="og:description"]', metaDesc);
  setMeta('meta[name="twitter:title"]', cfg.pageTitle);
  setMeta('meta[name="twitter:description"]', metaDesc);
  const search = byId("heatmapSearch");
  if (search) search.placeholder = cfg.searchPlaceholder;
  // Hide tabs with no data in this market (KR: 거장 포트폴리오는 미국 전용 데이터).
  const hiddenTabs = cfg.hiddenTabs || [];
  document.querySelectorAll("#mainTabs .tab[data-tab]").forEach((btn) => {
    const hide = hiddenTabs.includes(btn.dataset.tab);
    btn.hidden = hide;
    btn.style.display = hide ? "none" : "";
  });
  if (currentTab && hiddenTabs.includes(currentTab)) activateTab("search", { push: false });
  // Market-aware placeholders + signal sections that have no KR data.
  const krMode = cfg.id === "kr";
  const setPh = (id, ph) => { const el = byId(id); if (el) el.placeholder = ph; };
  setPh("tickerSearch", krMode ? "종목명·종목코드·한국어 (예: 삼성전자, 005930)" : "한국어·티커·영문 (예: 테슬라, NVDA, Apple)");
  setPh("pfTicker", krMode ? "티커 (예: 005930)" : "티커 (예: NVDA)");
  setPh("pfCost", `평단가 ${cfg.currencySymbol || "$"}`);
  setPh("positionTicker", krMode ? "005930" : "NVDA");
  const sigIntro = document.querySelector("#tab-signals .section-title p");
  if (sigIntro) {
    sigIntro.textContent = krMode
      ? "52주 신고가 근접 등 한국 시장 시그널을 한 화면에 모았습니다."
      : "내부자 클러스터 매수·52주 신고가 돌파·주요 공시(8-K)·액티비스트(13D)·신규 상장을 한 화면에 모았습니다.";
  }
  // 집계 인사이트(의회·내부자 종합)는 미국 전용 데이터 → KR에서는 빈 섹션이 되므로 숨긴다.
  const sigTitles = document.querySelectorAll("#tab-signals .section-title");
  const aggInsights = byId("aggInsights");
  if (sigTitles[1]) sigTitles[1].style.display = krMode ? "none" : "";
  if (aggInsights) aggInsights.style.display = krMode ? "none" : "";
  populateSectorBenchmarkSelect(cfg);
  populateEtfRsBenchmarkSelect(cfg);
  const pfBench = byId("portfolioBenchmark");
  if (pfBench) {
    const benches = cfg.etfBenchmarks || ["SPY"];
    const prev = pfBench.value;
    pfBench.innerHTML = benches.map((t) => `<option value="${t}">${escapeHtml(t)}</option>`).join("");
    pfBench.value = benches.includes(prev) ? prev : benches[0];
  }
  const valSector = byId("valSector");
  if (valSector) delete valSector.dataset.filled;
  const valCap = byId("valCap");
  if (valCap) delete valCap.dataset.marketCapKey;
  const krwCard = byId("krwPortfolioCard");
  if (krwCard) krwCard.hidden = cfg.id === "kr";
  // Chart RS-overlay toggle labels follow the market's benchmarks (SPY/QQQ vs 코스피200/코스닥150).
  const [[, rsB1], [, rsB2]] = etfRsSecondaryBenchmarks();
  const rsSpyLabel = byId("showRsSpy")?.parentElement;
  if (rsSpyLabel && rsSpyLabel.lastChild) rsSpyLabel.lastChild.textContent = ` RS vs ${rsB1}`;
  const rsQqqLabel = byId("showRsQqq")?.parentElement;
  if (rsQqqLabel && rsQqqLabel.lastChild) rsQqqLabel.lastChild.textContent = ` RS vs ${rsB2}`;
  const cadenceNote = byId("snapshotCadenceNote");
  if (cadenceNote) {
    cadenceNote.textContent = `주식 데이터는 ${cfg.snapshotCadence || "매일 06:00 KST"} 스냅샷 · 일부 보조 데이터는 별도 조회`;
  }
  const topMinCapText = byId("topMinMarketCapLabelText");
  if (topMinCapText) {
    topMinCapText.textContent = cfg.id === "kr" ? "최소 시총(조원)" : "Min MktCap($B)";
  }
  const scrMinCapText = byId("scrMinCapLabelText");
  if (scrMinCapText) {
    scrMinCapText.textContent = cfg.id === "kr" ? "시총(조원)" : "Cap($B)";
  }
  const instNav = byId("institutionalSubTabs");
  if (instNav) {
    instNav.querySelectorAll(".sub-tab").forEach((btn) => {
      const sub = btn.dataset.sub;
      const hidden = (cfg.hiddenInstitutionalSubs || []).includes(sub)
        || (sub === "congress" && cfg.features && !cfg.features.congress)
        || (sub === "13f" && cfg.features && !cfg.features.sec13f)
        || (sub === "insider" && cfg.features && !cfg.features.insider)
        || (sub === "activist" && cfg.features && !cfg.features.activist)
        || (sub === "events" && cfg.features && !cfg.features.materialEvents)
        || (sub === "ipo" && cfg.features && !cfg.features.ipo)
        || (sub === "dart" && (cfg.id !== "kr" || (cfg.features && !cfg.features.krDart)))
        || (sub === "krown" && (cfg.id !== "kr" || (cfg.features && !cfg.features.krOwnership)));
      btn.hidden = hidden;
      btn.style.display = hidden ? "none" : "";
    });
    const instFallback = cfg.id === "kr" && cfg.features?.krDart ? "dart" : "events";
    ["dart", "krown"].forEach((sub) => {
      const on = cfg.id === "kr" && cfg.features?.[sub === "dart" ? "krDart" : "krOwnership"];
      if (!on) return;
      const btn = instNav.querySelector(`[data-sub="${sub}"]`);
      if (btn) { btn.hidden = false; btn.style.display = ""; }
    });
    if ((cfg.hiddenInstitutionalSubs || []).includes(institutionalSubTab)
      || (institutionalSubTab === "insider" && cfg.features && !cfg.features.insider)
      || (institutionalSubTab === "activist" && cfg.features && !cfg.features.activist)
      || (institutionalSubTab === "dart" && (cfg.id !== "kr" || (cfg.features && !cfg.features.krDart)))
      || (institutionalSubTab === "krown" && (cfg.id !== "kr" || (cfg.features && !cfg.features.krOwnership)))) {
      activateInstitutionalSub(instFallback, { push: false });
    }
  }
  const searchNav = byId("searchSubTabs");
  if (searchNav) {
    searchNav.querySelectorAll(".sub-tab").forEach((btn) => {
      const sub = btn.dataset.sub;
      const krDartOnly = KR_DART_SUBTABS.has(sub) && !(cfg.features && cfg.features.krDart);
      const hidden = (sub === "short" && cfg.features && !cfg.features.shortInterest) || krDartOnly;
      btn.hidden = hidden;
      btn.style.display = hidden ? "none" : "";
    });
    const shortOff = searchSubTab === "short" && cfg.features && !cfg.features.shortInterest;
    const krDartSubOff = KR_DART_SUBTABS.has(searchSubTab) && !(cfg.features && cfg.features.krDart);
    if (shortOff || krDartSubOff) {
      activateSearchSub("analysis", { push: false });
    }
  }
  const calendarNav = byId("calendarSubTabs");
  if (calendarNav) {
    // 키가 없는 시장(US)은 켜진 것으로 본다 — 이 파일의 다른 기능 판정과 같은 규칙.
    // 처음에 !cfg.features.earningsCalendar 로 썼다가 US 실적 탭까지 숨겼다.
    const earningsOff = cfg.features && cfg.features.earningsCalendar === false;
    calendarNav.querySelectorAll(".sub-tab").forEach((btn) => {
      const hidden = (btn.dataset.sub === "earnings" && earningsOff);
      btn.hidden = hidden;
      btn.style.display = hidden ? "none" : "";
    });
    if (calendarSubTab === "earnings" && earningsOff) {
      activateCalendarSub("macro", { push: false });
    }
  }
  const calKr = document.querySelector('[data-cal-country="korea"]');
  const calUs = document.querySelector('[data-cal-country="us"]');
  if (calKr && calUs) {
    calendarCountryFilters.korea = cfg.id === "kr" ? true : calendarCountryFilters.korea;
    calendarCountryFilters.us = cfg.id === "us" ? true : calendarCountryFilters.us;
  }
}

function boot(options = {}) {
  const route = new URLSearchParams(window.location.search);
  setupMarketMode();
  showFallbackBanner();
  if (route.get("cadmin")) setCommunityAdminKey(route.get("cadmin"));
  if (route.get("ticker")) selectedTicker = normalizeTickerKey(route.get("ticker"));
  else if (!stockByTicker(selectedTicker)) selectedTicker = marketCfg().defaultTicker;
  initWatchlist(route.get("watchlist"));
  loadPortfolio();
  pullCloudSync().finally(() => {
    renderWatchlistBar();
    renderPortfolio();
    renderWatchAlerts();
  });
  loadPortfolioExtensions();
  document.documentElement.removeAttribute("data-theme");
  setupPwa();
  updateDataLoadedAt();
  renderCardNews();
  setupLightbox();
  setupChatbot();
  renderSummary();
  setupViewMode(route.get("tab"));
  setupTabs();
  setupTabSemantics();
  setupFilters();
  applyHeatmapRoute(route);
  setupTickerSearchHelpers();
  renderAll();
  setupActionBoard();
  setActionBoardMode(actionBoardMode);
  loadCalendar();
  setupEvents();
  setupBriefingToggles();
  fetchMarketHeader();
  renderSnapshotIndices();
  const initialTab = route.get("tab");
  const initialSub = route.get("sub");
  const initialCommunityTicker = route.get("cticker") || route.get("communityTicker");
  if (initialCommunityTicker) applyCommunityBoardTickerFilter(initialCommunityTicker);
  const mapRoute = route.get("map_bucket") || route.get("map_sector") || route.get("map_metric");
  if (initialTab) {
    const resolved = normalizeTabRequest(initialTab, initialSub);
    activateTab(resolved.tab, {
      push: false,
      sub: resolved.sub,
      communityTicker: initialCommunityTicker,
    });
  } else if (mapRoute) {
    activateTab("map", { push: false });
  }
  if (route.get("ticker")) selectTicker(route.get("ticker"));
  // 뒤로가기 가드: 현재(시작) 상태를 breadcrumb 루트로 두고 히스토리 센티넬 설치
  navStack = [navCurrentState()];
  setupBackGuard();
  // 탭을 지정해 들어온 경우에만 본문으로 내린다. 스크롤은 boot 맨 끝에서 —
  // 위의 selectTicker/renderAll 이 각자 scrollIntoView 를 부를 수 있어서,
  // 탭 전환 직후에 스크롤하면 그 뒤에 덮여버린다.
  if (initialTab || mapRoute) scrollToTabContent();
  // 초기 렌더 이후, 현재 시장에서 활성화된 feature 데이터를 백그라운드로 로드.
  preloadFeatureData();
}

// 오늘의 카드뉴스 미니 캐러셀(헤더): data.cardNews = { us:{title,images}, kr:{title,images} }
// 두 버전(미국 뉴스 / 국내 뉴스)을 스위치로 선택, 헤더 높이에 맞춰 자동 전환, 클릭 시 라이트박스.
let cardnewsTimer = null;
let cardnewsView = "us";  // 기본: 미국 뉴스(미국 주식 사이트)
let cardnewsIdx = 0;
let cardnewsImages = [];
let cardnewsSwipeBound = false;
let cardnewsInView = true;

function showCardNewsSlide(idx) {
  const img = byId("cardnewsCarouselImg");
  if (!img || !cardnewsImages.length) return;
  cardnewsIdx = ((idx % cardnewsImages.length) + cardnewsImages.length) % cardnewsImages.length;
  img.decoding = "async";
  img.src = cardnewsImages[cardnewsIdx];
}

function startCardNewsTimer() {
  if (cardnewsTimer) { clearInterval(cardnewsTimer); cardnewsTimer = null; }
  if (cardnewsImages.length > 1) {
    // Auto-advance lazy-loads the next ~1.3MB card image. Skip advancing while the tab is
    // backgrounded or the carousel is scrolled out of view, so a visitor who never looks
    // at it doesn't pull the whole ~7MB set. Manual prev/next/swipe still work anytime.
    cardnewsTimer = setInterval(() => {
      if (document.hidden || !cardnewsInView) return;
      showCardNewsSlide(cardnewsIdx + 1);
    }, 3000);
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
  // Track whether the carousel is on screen so startCardNewsTimer can pause off-screen.
  if (typeof IntersectionObserver !== "undefined") {
    new IntersectionObserver((entries) => {
      cardnewsInView = entries.some((e) => e.isIntersecting);
    }, { threshold: 0.1 }).observe(host);
  }
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

let lightboxBound = false;
function setupLightbox() {
  const lb = byId("lightbox");
  if (!lb) return;
  // boot() 은 시장 전환·오프라인 복구로 재진입한다. #lightbox 는 고정 DOM 이라
  // 두 번 붙으면 화살표 한 번에 두 장씩 넘어간다.
  if (lightboxBound) return;
  lightboxBound = true;
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

let chatbotBound = false;
function setupChatbot() {
  const panel = byId("chatPanel");
  const toggle = byId("chatToggle");
  const close = byId("chatClose");
  const form = byId("chatForm");
  const input = byId("chatInput");
  const log = byId("chatLog");
  const suggest = byId("chatSuggest");
  if (!panel || !toggle || !form || !input || !log) return;
  // 재부팅 시 재바인딩 금지 — 제안 칩이 중복 생성되고 submit 이 두 번 나간다.
  if (chatbotBound) return;
  chatbotBound = true;

  const chatRoot = byId("chatbot");
  const dismissBtn = byId("chatDismiss");
  // 이전 버전에서 영구 숨김으로 저장된 값은 제거 (새로고침 시 챗봇 복구)
  try { localStorage.removeItem("mir_chatbot_hidden_v1"); } catch (e) { /* ignore */ }
  if (dismissBtn) {
    dismissBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      if (chatRoot) chatRoot.style.display = "none";
    });
  }

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
      addChatMessage("bot", "안녕하세요! 미르 도우미예요. 사이트 사용법·투자 용어는 물론, 그냥 편하게 말 걸어 주셔도 좋아요. ");
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
    const typing = addChatMessage("bot", chatLikelyNeedsNews(text) ? "관련 뉴스를 찾고 있어요…" : "답변을 준비하고 있어요…");
    typing.classList.add("typing");
    try {
      if (!LIVE_DATA_PROXY) throw new Error("no proxy configured");
      const stockContext = await buildStockChatContext(text);
      const res = await fetch(`${LIVE_DATA_PROXY.replace(/\/$/, "")}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: chatHistory.slice(-10),
          stockContext,
          snapshotContext: buildMarketChatContext(),
          market: isKrMarket() ? "kr" : "us",
          searchHints: buildChatSearchHints(text),
        }),
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
  const kr = isKrMarket();
  data.stocks.forEach((s) => {
    if (isStockEtf(s) || !s.sector) return;
    if (!kr && !SECTOR_KO[s.sector]) return;
    const a = (agg[s.sector] = agg[s.sector] || { sum: 0, n: 0 });
    a.sum += Number(s.changePct) || 0;
    a.n += 1;
  });
  const minCount = kr ? 3 : 5;
  const arr = Object.entries(agg)
    .filter(([, v]) => v.n >= minCount)
    .map(([sec, v]) => ({ ko: kr ? sec : SECTOR_KO[sec], avg: v.sum / v.n }));
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
    ? `<div class="hx-row"><span>${label}</span><strong>${Number(f.price).toFixed(dec)}${suffix}</strong><em class="${cls(f.changePct)}">${actionPct(f.changePct)}</em></div>`
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
  const eq = data.stocks.filter((s) => !isStockEtf(s));
  const upPct = eq.length ? eq.filter((s) => Number(s.changePct) > 0).length / eq.length : 0.5;
  const avgChange = (tickers, key) => {
    const vals = tickers.map((t) => stockByTicker(t)).filter(Boolean).map((s) => Number(s[key]) || 0);
    return vals.length ? vals.reduce((sum, v) => sum + v, 0) / vals.length : 0;
  };
  const growthLead = isKrMarket()
    ? avgChange(["091160", "069500", "305720"], "monthChangePct") - avgChange(["091170", "091180", "244580"], "monthChangePct")
    : avgChange(["XLK", "QQQ", "SOXX"], "monthChangePct") - avgChange(["XLU", "XLP", "XLV"], "monthChangePct");
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

// 시장 국면 + CNN 공포탐욕을 하나의 카드로 병합
function regimeFngCardHtml() {
  const regime = computeMarketRegime();
  const score = fngScore();
  const live = Number.isFinite(score);
  const gaugeScore = live ? score : 50;
  const label = live ? fngLabel(score) : (marketHeader.fngStatus === "error" ? "연결 실패" : "로딩 중");
  const color = live ? fngColor(score) : "#94a3b8";
  const cx = 100, cy = 96, r = 76, w = 16;
  const deg = (s) => 180 - (s / 100) * 180;
  const arcs =
    gaugeArc(cx, cy, r, deg(0), deg(25), "#dc2626", w) +
    gaugeArc(cx, cy, r, deg(25), deg(45), "#f97316", w) +
    gaugeArc(cx, cy, r, deg(45), deg(55), "#eab308", w) +
    gaugeArc(cx, cy, r, deg(55), deg(75), "#84cc16", w) +
    gaugeArc(cx, cy, r, deg(75), deg(100), "#16a34a", w);
  const [nx, ny] = gaugePolar(cx, cy, r - 6, deg(gaugeScore));
  return `
    <div class="summary-card regime-fng-card regime-${regime.tone}">
      <span>시장 국면 · 공포탐욕</span>
      <div class="rf-head">
        <strong class="regime-label">${regime.label}</strong>
        <em class="regime-ko">${regime.ko}</em>
      </div>
      <svg class="fng-gauge" viewBox="0 0 200 118" role="img" aria-label="Fear and Greed gauge">
        ${arcs}
        <line class="gauge-needle" x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke-width="3" stroke-linecap="round"></line>
        <circle class="gauge-hub" cx="${cx}" cy="${cy}" r="5"></circle>
        <text x="${cx}" y="${cy - 18}" text-anchor="middle" class="fng-score" fill="${color}">${live ? score : "--"}</text>
      </svg>
      <div class="rf-foot">
        <span class="rf-fng" style="color:${color}">${escapeHtml(label)}</span>
        <span class="rf-stat" title="당일 상승 종목 비율">상승 ${Math.round(regime.upPct * 100)}%</span>
      </div>
    </div>`;
}

// 관심종목 요약 카드 (섹터 TOP5 형식: 티커 + 등락률, 클릭 시 분석)
function watchlistSummaryCardHtml() {
  const items = watchlist.map((t) => stockByTicker(t)).filter(Boolean);
  if (!items.length) {
    return `<div class="summary-card hx-card watchlist-summary-card">
      <span>관심종목</span>
      <div class="hx-row"><span class="muted">종목 옆 ★를 눌러 추가하세요</span></div>
    </div>`;
  }
  const sorted = items.slice().sort((a, b) => Math.abs(Number(b.changePct || 0)) - Math.abs(Number(a.changePct || 0)));
  const rows = sorted.slice(0, 6).map((s) => `
    <button type="button" class="hx-row watch-summary-row" data-ticker="${escapeHtml(s.ticker)}">
      <span>${escapeHtml(s.ticker)}</span>
      <em class="${cls(s.changePct)}">${actionPct(s.changePct)}</em>
    </button>`).join("");
  return `<div class="summary-card hx-card watchlist-summary-card">
    <span>관심종목 <b>${items.length}</b></span>
    ${rows}
  </div>`;
}

function renderSummary() {
  const sectors = computeSectorRanks();
  const el = byId("marketSummary");
  if (!el) return;
  el.innerHTML =
    regimeFngCardHtml() +
    sectorTopCardHtml("강한 섹터 TOP5", sectors.strong, true) +
    sectorTopCardHtml("약한 섹터 TOP5", sectors.weak, false) +
    fxCardHtml() +
    watchlistSummaryCardHtml();
  el.querySelectorAll(".watch-summary-row").forEach((row) =>
    row.addEventListener("click", () => selectTicker(row.dataset.ticker, { openSearch: true })));
}

function actionBoardCard(title, hint, rows, emptyText, target, extraClass = "") {
  const body = rows.length ? rows.join("") : `<p class="daily-action-empty">${escapeHtml(emptyText)}</p>`;
  return `
    <article class="daily-action-card${extraClass ? ` ${extraClass}` : ""}">
      <div class="daily-action-card-head">
        <div><h3>${title}</h3><p>${escapeHtml(hint)}</p></div>
        ${target ? `<button type="button" class="daily-action-more" data-action-tab="${target.tab}"${target.sub ? ` data-action-sub="${target.sub}"` : ""}>전체 보기</button>` : ""}
      </div>
      <div class="daily-action-list">${body}</div>
    </article>`;
}

// 액션보드 컴팩트 등락률: 화살표 없이 부호+숫자만(색으로 방향 표시) → 좁은 카드에서도 안 잘림
function actionPct(value) {
  const n = Number(value) || 0;
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function actionStockRow(item, note) {
  return `
    <button type="button" class="daily-action-row" data-action-ticker="${escapeHtml(item.ticker)}">
      <span><strong>${escapeHtml(item.ticker)}</strong><small>${escapeHtml(note || item.company || "")}</small></span>
      <em class="${cls(item.changePct)}">${actionPct(item.changePct)}</em>
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
      <span><strong>${escapeHtml(item.ticker)}</strong><small>평가 ${marketCfg().formatMoney(value)}</small></span>
      <em class="${cls(plPct)}">${actionPct(plPct)}</em>
    </button>`);
}

function upcomingActionRows() {
  const today = formatKstDateTime().slice(0, 10);
  const calendarRows = (calendarEventsCache || [])
    .map((event) => ({ event, date: calendarIsoFromEvent(event) }))
    .filter(({ date }) => date && date >= today)
    .filter(({ event }) => calendarEventPassesFilters(event))
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

// ===== 액션 보드 ↔ 오늘의 뉴스 전환 (웹) =====
let actionBoardMode = "news";
let actionBoardMqBound = false;

function renderActionNews() {
  const box = byId("dailyActionNews");
  if (!box) return;
  const cn = data.cardNews || {};
  const sets = {
    us: cn.us && Array.isArray(cn.us.images) && cn.us.images.length ? cn.us : null,
    kr: cn.kr && Array.isArray(cn.kr.images) && cn.kr.images.length ? cn.kr : null,
  };
  if (!sets.us && !sets.kr) {
    box.innerHTML = `<p class="muted daily-action-empty">오늘 카드뉴스가 아직 준비되지 않았습니다.</p>`;
    return;
  }
  if (!sets[cardnewsView]) cardnewsView = sets.us ? "us" : "kr";
  const active = sets[cardnewsView];
  const imgs = active.images;
  const head = `
    <div class="action-news-head">
      <strong>${escapeHtml(active.title || "오늘의 카드뉴스")}</strong>
      <div class="action-news-switch">
        ${sets.us ? `<button type="button" data-cn="us" class="${cardnewsView === "us" ? "is-active" : ""}">미국</button>` : ""}
        ${sets.kr ? `<button type="button" data-cn="kr" class="${cardnewsView === "kr" ? "is-active" : ""}">국내</button>` : ""}
      </div>
    </div>`;
  const row = `<div class="action-news-row">` + imgs.map((src, i) => `
    <button type="button" class="action-news-item" data-news-idx="${i}" title="크게 보기">
      <img src="${escapeHtml(src)}" alt="카드뉴스 ${i + 1}" loading="lazy" decoding="async" fetchpriority="low">
    </button>`).join("") + `</div>`;
  box.innerHTML = head + row;
  box.querySelectorAll("[data-cn]").forEach((btn) => btn.addEventListener("click", () => {
    if (btn.dataset.cn === cardnewsView) return;
    cardnewsView = btn.dataset.cn;
    renderActionNews();
  }));
  box.querySelectorAll("[data-news-idx]").forEach((btn) => btn.addEventListener("click", () => {
    openLightbox(imgs, Number(btn.dataset.newsIdx));
  }));
}

function setActionBoardMode(mode) {
  // 뉴스 모드는 웹(데스크톱) 전용. 모바일은 전환 UI가 없어 뉴스 모드로 두면
  // 액션 보드가 빈 채로 남으므로 항상 액션 보드로 강제한다.
  if (mode === "news" && window.matchMedia("(max-width: 768px)").matches) mode = "actions";
  actionBoardMode = mode === "news" ? "news" : "actions";
  const isNews = actionBoardMode === "news";
  const grid = byId("dailyActionGrid");
  const news = byId("dailyActionNews");
  const board = byId("dailyActionBoard");
  const title = byId("dailyActionTitle");
  const sw = byId("actionModeSwitch");
  if (sw) sw.querySelectorAll("[data-action-mode]").forEach((b) =>
    b.classList.toggle("is-active", b.dataset.actionMode === actionBoardMode));
  if (grid) grid.hidden = isNews;
  if (news) news.hidden = !isNews;
  if (board) board.classList.toggle("is-news", isNews);
  if (title) title.textContent = isNews ? "오늘의 뉴스" : "오늘의 액션 보드";
  if (isNews) renderActionNews();
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
  const showFilings = marketCfg().features?.materialEvents !== false;
  const filingRows = showFilings ? filingActionRows() : [];
  const attentionCount = alerts.length + scheduleRows.length + filingRows.filter((row) => row.includes('class="warn"')).length;
  const count = byId("dailyActionCount");
  if (count) count.textContent = attentionCount ? `우선 확인 ${attentionCount}건` : "새 긴급 항목 없음";
  const alertOrPortfolio = alerts.length
    ? alerts.map(({ item, reasons }) => actionStockRow(item, reasons.join(" · ")))
    : portfolioRows;
  grid.innerHTML =
    actionBoardCard("관심종목 변동", "등락폭이 큰 순서", movers.map((item) => actionStockRow(item, item.company)), "관심종목을 추가하면 변동을 추적합니다.", { tab: "bulk" }) +
    actionBoardCard(alerts.length ? "조건 감지" : "내 포트폴리오", alerts.length ? "저장한 조건에 맞는 종목" : "평가손익 상위 보유 종목", alertOrPortfolio, "조건 감지 또는 보유 종목이 없습니다.", { tab: "bulk" }) +
    actionBoardCard("다가오는 일정", "경제지표와 관심종목 실적", scheduleRows, "가까운 일정이 아직 없습니다.", { tab: "calendar" }, "is-wide") +
    (showFilings ? actionBoardCard("새 공시", isKrMarket() ? "관심종목 우선 · DART" : "관심종목 우선 · SEC 8-K", filingRows, "새로 확인할 주요 공시가 없습니다.", { tab: "institutional", sub: "events" }) : "");
  grid.querySelectorAll("[data-action-ticker]").forEach((button) => button.addEventListener("click", () => selectTicker(button.dataset.actionTicker, { openSearch: true })));
  grid.querySelectorAll("[data-action-tab]").forEach((button) => button.addEventListener("click", () => activateTab(button.dataset.actionTab, { sub: button.dataset.actionSub || null })));
}

function setupActionBoard() {
  const modeSwitch = byId("actionModeSwitch");
  if (modeSwitch && !modeSwitch.dataset.bound) {
    modeSwitch.dataset.bound = "1";
    modeSwitch.querySelectorAll("[data-action-mode]").forEach((b) =>
      b.addEventListener("click", () => setActionBoardMode(b.dataset.actionMode)));
  }
  // 데스크톱에서 '오늘의 뉴스'로 둔 채 모바일 폭으로 좁히면 보드가 비므로 액션 모드로 복구
  if (!actionBoardMqBound) {
    actionBoardMqBound = true;
    window.matchMedia("(max-width: 768px)").addEventListener("change", (e) => {
      if (e.matches && actionBoardMode === "news") setActionBoardMode("actions");
    });
  }
  const refresh = byId("dailyActionRefresh");
  if (!refresh || refresh.dataset.bound) return;
  refresh.dataset.bound = "1";
  refresh.addEventListener("click", () => {
    calendarLoaded = false;
    earningsCalendarCache = null;
    renderActionBoard();
    if (actionBoardMode === "news") renderActionNews();
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
  const mapped = (marketCfg().indexAnalysisMap || INDEX_ANALYSIS_TICKER || {})[symbol];
  return mapped && stockByTicker(mapped) ? mapped : null;
}

function renderSnapshotIndices() {
  if (!isKrMarket() || !Array.isArray(data.indices)) return;
  const items = data.indices.map((ix) => {
    const proxy = stockByTicker(ix.ticker);
    return {
      symbol: ix.symbol,
      name: ix.name,
      price: proxy?.price || 0,
      changePct: ix.changePct ?? proxy?.changePct ?? 0,
      series: proxy?.closeSeries || [],
    };
  }).filter((ix) => ix.name);
  if (items.length) renderIndexStrip(items);
}

function renderIndexStrip(indices) {
  const el = byId("indexStrip");
  if (!el) return;
  if (!indices || !indices.length) { el.innerHTML = ""; return; }
  // In KR mode, lead with KOSPI/KOSDAQ; the worker's index list is US-first.
  if (isKrMarket()) {
    const krOrder = ["^KS11", "^KQ11"];
    indices = [...indices].sort((a, b) => {
      const ai = krOrder.indexOf(a.symbol), bi = krOrder.indexOf(b.symbol);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }
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
  // CNN's endpoint (CNN_FNG_URL) sends no CORS headers, so a direct browser fetch always
  // fails with an uncatchable console error. Go straight through the Worker proxy, which
  // fetches CNN server-side and returns CORS-allowed JSON.
  try {
    const response = await fetch(`${base}/?fng=1`, { cache: "no-store" });
    if (response.ok) {
      const fng = normalizeCnnFng(await response.json());
      if (fng) return fng;
    }
  } catch (_) { /* Worker unreachable → gauge shows the loading state. */ }
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
    if (p && Array.isArray(p.fx)) { marketHeader.fx = p.fx; renderSummary(); renderPortfolio(); }
  }).catch(() => {});
  // KR mode renders KOSPI/KOSDAQ from the snapshot (renderSnapshotIndices); worker indices are US-only.
  const idxReq = isKrMarket()
    ? Promise.resolve()
    : fetch(`${base}/?indices=1`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((p) => {
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
      renderActionBoard();
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
// KR 전용(krDart) 종목검색 서브탭 — US 에선 가시성 게이트가 숨긴다.
const KR_DART_SUBTABS = new Set(["buyback", "earnreact", "dividend", "contract", "dilution"]);
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
let backGuardBound = false;
function setupBackGuard() {
  // 재부팅 시 popstate 가 중복되면 뒤로가기 한 번에 navStack 이 두 칸씩 빠지고,
  // 센티넬 pushState 가 쌓여 히스토리가 오염된다.
  if (backGuardBound) return;
  backGuardBound = true;
  history.replaceState({ _app: true }, "");
  history.pushState({ _sentinel: true }, "");
  window.addEventListener("popstate", () => {
    if (window.MirAI?.isActive?.()) {
      window.MirAI.exit();
      history.pushState({ _sentinel: true }, "");
      disarmBackExit();
      return;
    }
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

// ===== 앱 내 확인/입력 다이얼로그 =====
// 네이티브 alert/confirm/prompt 는 브라우저 크롬 UI 라 사이트 테마와 따로 놀고,
// 모바일에서는 "이 페이지 내용:" 같은 문구가 앞에 붙는다. <dialog> 로 바꾸면
// 포커스 트랩·Esc 취소·backdrop·inert 처리를 브라우저가 대신 해준다.
// 취소는 항상 false(confirm) / null(prompt) 로 떨어진다 — 네이티브와 같은 계약.
function appDialog({ title, message, defaultValue = null, okLabel = "확인", cancelLabel = "취소", danger = false }) {
  const isPrompt = defaultValue !== null;
  return new Promise((resolve) => {
    const dlg = document.createElement("dialog");
    dlg.className = "app-dialog" + (danger ? " is-danger" : "");

    const form = document.createElement("form");
    form.method = "dialog";

    if (title) {
      const h = document.createElement("h2");
      h.className = "app-dialog-title";
      h.textContent = title;
      dlg.setAttribute("aria-labelledby", (h.id = "appDialogTitle"));
      form.appendChild(h);
    }

    const p = document.createElement("p");
    p.className = "app-dialog-message";
    p.textContent = message;              // textContent — 메시지에 서버 문자열이 섞여 온다
    form.appendChild(p);

    let input = null;
    if (isPrompt) {
      input = document.createElement("input");
      input.type = "text";
      input.className = "app-dialog-input";
      input.value = defaultValue;
      input.setAttribute("aria-label", message);
      form.appendChild(input);
    }

    const actions = document.createElement("div");
    actions.className = "app-dialog-actions";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "app-dialog-btn";
    cancelBtn.textContent = cancelLabel;
    const okBtn = document.createElement("button");
    okBtn.type = "submit";
    okBtn.className = "app-dialog-btn is-primary";
    okBtn.textContent = okLabel;
    actions.append(cancelBtn, okBtn);
    form.appendChild(actions);
    dlg.appendChild(form);
    document.body.appendChild(dlg);

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
      // close 애니메이션이 끝난 뒤 DOM 에서 걷어낸다.
      dlg.addEventListener("close", () => dlg.remove(), { once: true });
      if (dlg.open) dlg.close(); else dlg.remove();
    };

    const cancelValue = isPrompt ? null : false;
    cancelBtn.addEventListener("click", () => finish(cancelValue));
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); finish(cancelValue); });  // Esc
    // backdrop 클릭 = 취소. 다이얼로그 자신이 이벤트 타깃일 때만(내부 클릭 제외).
    dlg.addEventListener("click", (e) => { if (e.target === dlg) finish(cancelValue); });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      finish(isPrompt ? input.value : true);
    });

    dlg.showModal();
    (isPrompt ? input : okBtn).focus();
    if (isPrompt) input.select();
  });
}

function showAppConfirm(message, options = {}) {
  return appDialog({ message, okLabel: "확인", ...options });
}

function showAppPrompt(message, defaultValue = "", options = {}) {
  return appDialog({ message, defaultValue: defaultValue ?? "", ...options });
}

const TAB_REDIRECT = {
  top: { tab: "search", sub: "top" },
  jump: { tab: "search", sub: "jump" },
  compare: { tab: "search", sub: "compare" },
  screener: { tab: "search", sub: "screener" },
  scanner: { tab: "search", sub: "scanner" },
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
  if (searchSubTab === "scanner") renderScanner();
  if (searchSubTab === "top") renderTopStocks();
  if (searchSubTab === "jump") renderJump();
  if (searchSubTab === "compare") renderCompareBoard();
  if (searchSubTab === "screener") renderScreener();
  if (searchSubTab === "valuation") renderValuation();
  if (searchSubTab === "short") renderShortInterest();
  if (searchSubTab === "buyback") renderBuyback();
  if (searchSubTab === "earnreact") renderEarningsReactions();
  if (searchSubTab === "dividend") renderDividends();
  if (searchSubTab === "contract") renderContracts();
  if (searchSubTab === "dilution") renderDilution();
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
  // Only fetch the (often multi-MB) dataset when the institutional tab is actually
  // active — not during the boot pre-render (renderAll), where currentTab is "map".
  const load = currentTab === "institutional";
  if (institutionalSubTab === "13f") renderWithFeature("inst13f", renderInstitutional13f, "institutionalDetail", load);
  if (institutionalSubTab === "congress") renderWithFeature("congress", renderCongressTrades, "congressRankings", load);
  if (institutionalSubTab === "insider") renderWithFeature("insider", renderInsiderTrades, "insiderTable", load);
  if (institutionalSubTab === "activist") renderWithFeature("activist", renderActivistStakes, "activistTable", load);
  if (institutionalSubTab === "events") renderWithFeature("events", renderMaterialEvents, "eventsTable", load);
  if (institutionalSubTab === "ipo") renderWithFeature("ipo", renderIpoCalendar, "ipoTable", load);
  if (institutionalSubTab === "dart") {
    renderWithFeature("krDart", renderKrDisclosures, "krDartTable", load);
    // 상세 숫자는 따로 온다. 늦게 도착하면 그때 다시 그린다 — 없어도 목록은 나온다.
    if (load) ensureFeatureData("krEventDetails").then((ok) => { if (ok) renderKrDisclosures(); });
  }
  if (institutionalSubTab === "krown") renderWithFeature("krOwnership", renderKrOwnership, "krOwnTable", load);
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
    search.addEventListener("input", debounce(() => { insiderQuery = search.value; renderInsiderTrades(); }, 300));
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
    <div class="cluster-head">클러스터 매수 <span>보관 기간 내 2인 이상 임원이 공개시장 매수(P)한 종목 — 강한 내부자 신뢰 신호</span></div>
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
  if (s && !s.dataset.bound) { s.dataset.bound = "1"; s.addEventListener("input", debounce(() => { activistQuery = s.value; renderActivistStakes(); }, 300)); }
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
  if (s && !s.dataset.bound) { s.dataset.bound = "1"; s.addEventListener("input", debounce(() => { eventsQuery = s.value; renderMaterialEvents(); }, 300)); }
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
    const sectors = [...new Set(data.stocks.filter((s) => !isStockEtf(s)).map((s) => s.sector))].sort();
    sectorSel.innerHTML = `<option value="All">전체 섹터</option>` + sectors.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
  }
  const capSel = byId("valCap");
  const capKey = isKrMarket() ? "kr" : "us";
  if (capSel && capSel.dataset.marketCapKey !== capKey) {
    capSel.dataset.marketCapKey = capKey;
    const prev = capSel.value;
    const buckets = VAL_CAP_BUCKETS[capKey] || VAL_CAP_BUCKETS.us;
    capSel.innerHTML = buckets.map(([v, l]) => `<option value="${v}">${escapeHtml(l)}</option>`).join("");
    capSel.value = buckets.some(([v]) => v === prev) ? prev : "all";
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
  const cfg = mapMetricConfig(metric) || {};
  const mf = window.MAP_FUNDAMENTALS || {};
  let rows = data.stocks.filter((s) => !isStockEtf(s))
    .filter((s) => sector === "All" || s.sector === sector)
    .filter((s) => bucketMatches(s, s.groups || [s.bucket].filter(Boolean), cap))
    .map((s) => ({ item: s, value: Number((mapFundamentalsFor(s.ticker) || {})[metric]) }))
    .filter((r) => Number.isFinite(r.value) && (metric === "divYield" ? r.value >= 0 : r.value > 0));
  if (q) rows = rows.filter((r) => r.item.ticker.toLowerCase().includes(q) || (r.item.company || "").toLowerCase().includes(q));
  rows.sort((a, b) => (valOrder === "asc" ? a.value - b.value : b.value - a.value));
  const shown = rows.slice(0, 200);
  const krNote = isKrMarket() ? " · 당일 등락은 상하한가 ±30% 기준 표시" : "";
  if (meta) meta.innerHTML = `${rows.length.toLocaleString()}개 종목 · ${cfg.label || metric}${krNote}`;
  if (!shown.length) { wrap.innerHTML = `<p class="muted">펀더멘털 데이터가 있는 종목이 없습니다.</p>`; return; }
  const fmtv = (v) => {
    if (cfg.fmt === "pct") return `${v.toFixed(1)}%`;
    if (cfg.fmt === "usd") return isKrMarket() ? marketCfg().formatMoney(v) : `$${v.toFixed(2)}`;
    return v.toFixed(2);
  };
  const body = shown.map((r, i) => `<tr>
    <td class="ins-date">${i + 1}</td>
    <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.item.ticker)}">${escapeHtml(isKrMarket() ? (r.item.company || r.item.ticker) : r.item.ticker)}</button><div class="ins-sub">${escapeHtml(isKrMarket() ? r.item.ticker : (r.item.company || ""))}</div></td>
    <td class="ins-sub">${escapeHtml(r.item.sector)}</td>
    <td class="ins-num"><strong>${fmtv(r.value)}</strong></td>
    <td class="ins-num">${fmtBillions(itemCapForValuation(r.item))}</td>
    <td class="ins-num ${cls(krDisplayChangePct(r.item.changePct))}">${fmtDailyPct(r.item.changePct)}</td>
  </tr>`).join("");
  wrap.innerHTML = `<table class="insider-table"><thead><tr><th>#</th><th>종목</th><th>섹터</th><th class="ins-num">${escapeHtml(cfg.label || metric)}</th><th class="ins-num">${isKrMarket() ? "시총(조)" : "시총"}</th><th class="ins-num">당일</th></tr></thead><tbody>${body}</tbody></table>`;
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
// KR(KRX)은 'Days to Cover'가 없다. 잔고비중(공매도잔고÷상장주식수)을 1차 지표로
// 쓰며, 빌더가 payload.metric="balance" 로 표시한다. US 는 종전대로 잔고일수.
function shortIsBalance() { return ((window.SHORT_INTEREST || {}).metric) === "balance"; }

// 정적 HTML(설명·정렬버튼·지연안내)은 US 문구라, KR 잔고비중 모드일 때 갈아끼운다.
function applyShortLabels(isBal) {
  const panel = byId("sub-short");
  if (!panel) return;
  const p = panel.querySelector(".section-title p");
  if (p) p.innerHTML = isBal
    ? `KRX 공매도 종합포털 기반. <b>잔고비중</b>(미상환 공매도 잔고 ÷ 상장주식수)이 높을수록 공매도 압력이 큽니다. <b>T+2 공시</b>라 기준일은 이틀 전입니다.`
    : `FINRA 격주 공시(Nasdaq) 기반. <b>잔고일수(Days to Cover)</b>가 높을수록 숏 커버에 오래 걸려 스퀴즈 가능성이 큽니다. <b>Nasdaq 상장 종목 한정</b>.`;
  const disc = panel.querySelector(".data-disclaimer span");
  if (disc) disc.textContent = isBal
    ? "공매도 잔고는 매 거래일 T+2 로 공시되며 실시간이 아닙니다. 투자 권유가 아닙니다."
    : "공매도 잔고는 한 달에 두 번(격주) 공시되며 실시간이 아닙니다. 투자 권유가 아닙니다.";
  const dtcBtn = panel.querySelector('#shortSort button[data-sort="dtc"]');
  if (dtcBtn) dtcBtn.textContent = isBal ? "잔고비중 높은순" : "잔고일수 높은순";
  // 거래비중 정렬은 KR(잔고 모드)에만 있는 지표라 US 에선 숨긴다.
  const tradeBtn = panel.querySelector('#shortSort button[data-sort="trade"]');
  if (tradeBtn) { tradeBtn.hidden = !isBal; tradeBtn.style.display = isBal ? "" : "none"; }
}

// KR 상위 종목의 공매도 잔고비중 시계열(빌더가 history 로 부착). 잔고 증가=공매도 압력↑
// 이라 상승 추세를 빨강으로 그린다. 없으면 빈 문자열.
function shortSparkline(hist) {
  if (!Array.isArray(hist) || hist.length < 3) return "";
  const vals = hist.map((p) => Number(p.r)).filter(Number.isFinite);
  if (vals.length < 3) return "";
  const min = Math.min(...vals), max = Math.max(...vals), range = (max - min) || 1;
  const W = 62, H = 18, n = vals.length;
  const pts = vals.map((v, i) => `${(i / (n - 1) * W).toFixed(1)},${(H - (v - min) / range * H).toFixed(1)}`).join(" ");
  const col = vals[vals.length - 1] >= vals[0] ? "#e5484d" : "#30a46c";
  return `<svg class="short-spark" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">`
    + `<polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
}

function renderShortInterest() {
  setupShortControls();
  const wrap = byId("shortTable");
  const meta = byId("shortMeta");
  if (!wrap) return;
  const payload = window.SHORT_INTEREST;
  const isBal = shortIsBalance();
  applyShortLabels(isBal);
  if (!payload || !Array.isArray(payload.rows) || !payload.rows.length) {
    if (meta) meta.innerHTML = "";
    wrap.innerHTML = `<p class="muted">아직 공매도 데이터가 없습니다. 데이터 수집 후 표시됩니다.</p>`;
    return;
  }
  let invStr = "";
  const inv = payload.investorShort;
  if (isBal && inv && typeof inv === "object") {
    const total = Object.values(inv).reduce((a, b) => a + (Number(b) || 0), 0);
    const parts = ["외국인", "기관", "개인"].filter((k) => inv[k]).map((k) => `${k} ${Math.round(inv[k] / total * 100)}%`);
    if (total > 0 && parts.length) invStr = ` · 시장 공매도 주체(거래대금) ${parts.join(" · ")}`;
  }
  if (meta) meta.innerHTML = `업데이트 ${escapeHtml(payload.updatedAtKst || "")} · ${Number(payload.count || 0).toLocaleString()}종목 · 기준일 ${escapeHtml(payload.settlementDate || "")}${isBal && payload.tradingDate ? ` · 거래일 ${escapeHtml(payload.tradingDate)}` : ""}${invStr}`;
  const q = shortQuery.trim().toLowerCase();
  let rows = payload.rows.slice();
  if (q) rows = rows.filter((r) => (r.ticker || "").toLowerCase().includes(q) || (r.company || "").toLowerCase().includes(q));
  const primaryKey = isBal ? "balanceRatio" : "daysToCover";
  rows.sort((a, b) => {
    if (shortSort === "change") return (b.changePct ?? -999) - (a.changePct ?? -999);
    if (shortSort === "trade") return (b.tradingRatio ?? -1) - (a.tradingRatio ?? -1);
    return (b[primaryKey] || 0) - (a[primaryKey] || 0);
  });
  const shown = rows.slice(0, 200);
  if (!shown.length) { wrap.innerHTML = `<p class="muted">조건에 맞는 종목이 없습니다.</p>`; return; }
  const body = shown.map((r, i) => {
    const chg = Number.isFinite(r.changePct) ? `${r.changePct > 0 ? "+" : ""}${r.changePct.toFixed(1)}%` : "—";
    const chgCls = r.changePct > 0 ? "ins-sell" : r.changePct < 0 ? "ins-buy" : "";
    const primary = isBal ? `${Number(r.balanceRatio || 0).toFixed(2)}%` : Number(r.daysToCover || 0).toFixed(2);
    const mainLabel = isBal ? (r.company || r.ticker) : r.ticker;
    const subLabel = isBal ? r.ticker : (r.company || "");
    const extra = isBal
      ? `<td class="ins-num short-spark-cell">${shortSparkline(r.history)}</td>`
        + `<td class="ins-num">${Number.isFinite(r.tradingRatio) ? `${r.tradingRatio.toFixed(2)}%` : "—"}</td>`
      : "";
    return `<tr>
      <td class="ins-date">${i + 1}</td>
      <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.ticker)}">${escapeHtml(mainLabel)}</button><div class="ins-sub">${escapeHtml(subLabel)}</div></td>
      <td class="ins-num"><strong>${primary}</strong></td>
      ${extra}
      <td class="ins-num">${insiderFmtShares(r.shortShares)}</td>
      <td class="ins-num ${chgCls}">${chg}</td>
    </tr>`;
  }).join("");
  const primaryHdr = isBal ? "잔고비중" : "잔고일수";
  const sharesHdr = isBal ? "공매도 잔고" : "공매도 주식수";
  const extraHdr = isBal ? `<th class="ins-num">잔고추이(6주)</th><th class="ins-num">거래비중</th>` : "";
  wrap.innerHTML = `<table class="insider-table"><thead><tr><th>#</th><th>종목</th><th class="ins-num">${primaryHdr}</th>${extraHdr}<th class="ins-num">${sharesHdr}</th><th class="ins-num">전기대비</th></tr></thead><tbody>${body}</tbody></table>`;
  wrap.querySelectorAll(".ins-ticker").forEach((b) => b.addEventListener("click", () => selectTicker(b.dataset.ticker, { openSearch: true })));
}

// ===== 자사주 매입·소각 트래커 (KR 전용) =====
// 새 DART 호출 없이 KR_DISCLOSURES(공시 이벤트) + KR_EVENT_DETAILS(취득/처분 주요정보
// 숫자) + 시장 스냅샷(시총)을 조합한다. '결정' 은 규모 숫자가 있고(event_details 가
// tsstkAqDecsn 등을 붙인다), 신탁해지·결과보고는 숫자 없이 사실만 표시한다.
let buybackSort = "size", buybackType = "all", buybackQuery = "", _buybackTried = false;

// 정직성 검증: build_kr_disclosure_stats.py 가 5년치로 공시유형별 '발표 후 초과수익 vs
// 무작위'를 검정해뒀다(41유형 중 무작위 이긴 것 0). 각 트래커 메타에 해당 유형 결과를
// 붙여, '예측 아님'을 문구가 아니라 데이터로 뒷받침한다. 데이터 없으면 빈 문자열.
function krDiscStatNote(type) {
  const st = ((window.KR_DISCLOSURE_STATS || {}).stats || {})[type];
  if (!st || !st.d1 || !Number.isFinite(st.d1.mean)) return "";
  const ev = st.d1.mean;
  const rnd = st.d1.random && Number.isFinite(st.d1.random.mean) ? st.d1.random.mean : null;
  const n = st.sample || st.d1.n || 0;
  return ` · <span class="muted">5년 ${Number(n).toLocaleString()}건 백테스트: 발표 후 D+1 초과수익 ${ev > 0 ? "+" : ""}${ev.toFixed(2)}%${rnd != null ? ` vs 무작위 ${rnd > 0 ? "+" : ""}${rnd.toFixed(2)}%` : ""} — 유의미한 우위 없음</span>`;
}

function buybackCategory(title) {
  const t = title || "";
  if (!t.includes("자기주식")) return null;
  if (t.includes("소각")) return { key: "buy", label: "소각", cls: "ins-buy" };
  if (t.includes("취득신탁계약해지")) return { key: "sell", label: "신탁해지", cls: "ins-sell" };
  if (t.includes("취득신탁계약체결")) return { key: "buy", label: "신탁취득", cls: "ins-buy" };
  if (t.includes("자기주식취득")) return { key: "buy", label: "취득", cls: "ins-buy" };
  if (t.includes("자기주식처분")) return { key: "sell", label: "처분", cls: "ins-sell" };
  return null;
}

function setupBuybackControls() {
  const bind = (id, apply) => {
    const el = byId(id);
    if (el && !el.dataset.bound) {
      el.dataset.bound = "1";
      el.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
        apply(b); el.querySelectorAll("button").forEach((x) => x.classList.toggle("is-active", x === b)); renderBuyback();
      }));
    }
  };
  bind("buybackSort", (b) => { buybackSort = b.dataset.sort; });
  bind("buybackType", (b) => { buybackType = b.dataset.type; });
  const s = byId("buybackSearch");
  if (s && !s.dataset.bound) { s.dataset.bound = "1"; s.addEventListener("input", () => { buybackQuery = s.value; renderBuyback(); }); }
}

function renderBuyback() {
  setupBuybackControls();
  const wrap = byId("buybackTable");
  const meta = byId("buybackMeta");
  if (!wrap) return;
  if (!window.KR_DISCLOSURES && !_buybackTried) {
    _buybackTried = true;
    wrap.innerHTML = '<p class="muted">데이터를 불러오는 중…</p>';
    Promise.all([ensureFeatureData("krDart"), ensureFeatureData("krEventDetails"), ensureFeatureData("krDiscStats")]).then(renderBuyback);
    return;
  }
  const disc = ((window.KR_DISCLOSURES || {}).disclosures) || [];
  const details = (window.KR_EVENT_DETAILS || {}).details || {};
  const capByTicker = {};
  const stocks = (typeof data !== "undefined" && data && Array.isArray(data.stocks)) ? data.stocks : [];
  stocks.forEach((s) => { if (s.ticker) capByTicker[s.ticker] = Number(s.marketCapT ?? s.marketCapB ?? 0); });
  const rcpt = (link) => { const m = /rcpNo=(\d+)/.exec(link || ""); return m ? m[1] : ""; };

  let rows = [];
  for (const d of disc) {
    const cat = buybackCategory(d.title);
    if (!cat) continue;
    const det = details[rcpt(d.link)] || {};
    const amount = Number(det.amount) || null;          // 원
    const capT = capByTicker[d.ticker] || null;         // 조원
    rows.push({
      ticker: d.ticker, company: d.company || d.ticker, date: d.fileDate || "",
      type: cat.label, typeKey: cat.key, cls: cat.cls,
      shares: Number(det.shares) || null, amount,
      capPct: (amount && capT) ? (amount / (capT * 1e12) * 100) : null,
      purpose: det.purpose || "",
    });
  }
  if (buybackType !== "all") rows = rows.filter((r) => r.typeKey === buybackType);
  const q = buybackQuery.trim().toLowerCase();
  if (q) rows = rows.filter((r) => (r.ticker || "").toLowerCase().includes(q) || (r.company || "").toLowerCase().includes(q));
  if (buybackSort === "date") rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  else rows.sort((a, b) => (b.capPct ?? -1) - (a.capPct ?? -1));

  const buyN = rows.filter((r) => r.typeKey === "buy").length;
  const sellN = rows.length - buyN;
  if (meta) meta.innerHTML = rows.length
    ? `업데이트 ${escapeHtml((window.KR_DISCLOSURES || {}).updatedAtKst || "")} · 매입/소각 ${buyN}건 · 처분/해지 ${sellN}건${krDiscStatNote("자기주식")}`
    : "";
  if (!rows.length) { wrap.innerHTML = `<p class="muted">최근 공시분에 자사주 취득·처분 공시가 없습니다.</p>`; return; }
  const body = rows.slice(0, 200).map((r) => `<tr>
    <td class="ins-date">${escapeHtml(r.date)}</td>
    <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.ticker)}">${escapeHtml(r.company)}</button><div class="ins-sub">${escapeHtml(r.ticker)}${r.purpose ? ` · ${escapeHtml(r.purpose)}` : ""}</div></td>
    <td class="ins-sub ${r.cls}">${escapeHtml(r.type)}</td>
    <td class="ins-num"><strong>${r.capPct != null ? `${r.capPct.toFixed(2)}%` : "—"}</strong></td>
    <td class="ins-num">${r.amount != null ? `${(r.amount / 1e8).toLocaleString(undefined, { maximumFractionDigits: 0 })}억` : "—"}</td>
    <td class="ins-num">${r.shares != null ? insiderFmtShares(r.shares) : "—"}</td>
  </tr>`).join("");
  wrap.innerHTML = `<table class="insider-table"><thead><tr><th>공시일</th><th>종목</th><th>유형</th><th class="ins-num">시총대비</th><th class="ins-num">금액</th><th class="ins-num">주식수</th></tr></thead><tbody>${body}</tbody></table>`;
  wrap.querySelectorAll(".ins-ticker").forEach((b) => b.addEventListener("click", () => selectTicker(b.dataset.ticker, { openSearch: true })));
}

// ===== 실적 발표(잠정) · 주가반응 (KR 전용) =====
// build_kr_earnings_reactions.py 가 만든 KR_EARNINGS_REACTIONS(잠정실적 공시 + 발표일·
// 익일 등락률)를 그대로 표로 보여준다. 예측 신호가 아니라 사실 피드다.
let earnReactSort = "date", earnReactQuery = "", _earnReactTried = false;

function setupEarnReactControls() {
  const sort = byId("earnReactSort");
  if (sort && !sort.dataset.bound) {
    sort.dataset.bound = "1";
    sort.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      earnReactSort = b.dataset.sort; sort.querySelectorAll("button").forEach((x) => x.classList.toggle("is-active", x === b)); renderEarningsReactions();
    }));
  }
  const s = byId("earnReactSearch");
  if (s && !s.dataset.bound) { s.dataset.bound = "1"; s.addEventListener("input", () => { earnReactQuery = s.value; renderEarningsReactions(); }); }
}

function renderEarningsReactions() {
  setupEarnReactControls();
  const wrap = byId("earnReactTable");
  const meta = byId("earnReactMeta");
  if (!wrap) return;
  if (!window.KR_EARNINGS_REACTIONS && !_earnReactTried) {
    _earnReactTried = true;
    wrap.innerHTML = '<p class="muted">데이터를 불러오는 중…</p>';
    Promise.all([ensureFeatureData("krEarningsReact"), ensureFeatureData("krDiscStats")]).then(renderEarningsReactions);
    return;
  }
  const payload = window.KR_EARNINGS_REACTIONS || {};
  let rows = (payload.rows || []).slice();
  const q = earnReactQuery.trim().toLowerCase();
  if (q) rows = rows.filter((r) => (r.ticker || "").toLowerCase().includes(q) || (r.company || "").toLowerCase().includes(q));
  if (earnReactSort === "react") rows.sort((a, b) => Math.abs(b.dayPct ?? 0) - Math.abs(a.dayPct ?? 0));
  else rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  if (meta) meta.innerHTML = rows.length ? `업데이트 ${escapeHtml(payload.updatedAtKst || "")} · ${rows.length}건 발표${krDiscStatNote("잠정실적")}` : "";
  if (!rows.length) { wrap.innerHTML = `<p class="muted">최근 공시분에 잠정실적 발표가 없습니다.</p>`; return; }
  // 주가 상승=초록(ins-buy)·하락=빨강(ins-sell). 공매도 패널과 방향이 반대인 데 주의.
  const pct = (v) => Number.isFinite(v) ? `<span class="${v > 0 ? "ins-buy" : v < 0 ? "ins-sell" : ""}">${v > 0 ? "+" : ""}${v.toFixed(1)}%</span>` : "—";
  const body = rows.slice(0, 200).map((r) => `<tr>
    <td class="ins-date">${escapeHtml(r.date)}</td>
    <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.ticker)}">${escapeHtml(r.company)}</button><div class="ins-sub">${escapeHtml(r.ticker)} · ${r.consolidated ? "연결" : "별도"}</div></td>
    <td class="ins-num">${pct(r.dayPct)}</td>
    <td class="ins-num">${pct(r.nextPct)}</td>
  </tr>`).join("");
  wrap.innerHTML = `<table class="insider-table"><thead><tr><th>공시일</th><th>종목</th><th class="ins-num">공시일 등락</th><th class="ins-num">익일 등락</th></tr></thead><tbody>${body}</tbody></table>`;
  wrap.querySelectorAll(".ins-ticker").forEach((b) => b.addEventListener("click", () => selectTicker(b.dataset.ticker, { openSearch: true })));
}

// ===== 배당 캘린더 (KR 전용) =====
// build_kr_corp_disclosures.py 가 배당결정 공시 원문에서 파싱한 KR_DIVIDENDS
// (1주당 배당금·시가배당률·배당기준일·지급예정일)를 그대로 표로 보여준다.
let dividendSort = "record", dividendQuery = "", _dividendTried = false;
function bindListControls(sortId, searchId, setSort, setQuery, rerender) {
  const sort = byId(sortId);
  if (sort && !sort.dataset.bound) {
    sort.dataset.bound = "1";
    sort.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      setSort(b.dataset.sort); sort.querySelectorAll("button").forEach((x) => x.classList.toggle("is-active", x === b)); rerender();
    }));
  }
  const s = byId(searchId);
  if (s && !s.dataset.bound) { s.dataset.bound = "1"; s.addEventListener("input", () => { setQuery(s.value); rerender(); }); }
}
function krMoneyEok(won) {
  const n = Number(won);
  if (!Number.isFinite(n) || n === 0) return "—";
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(2)}조`;
  return `${Math.round(n / 1e8).toLocaleString()}억`;
}
function renderDividends() {
  bindListControls("dividendSort", "dividendSearch", (v) => dividendSort = v, (v) => dividendQuery = v, renderDividends);
  const wrap = byId("dividendTable"); const meta = byId("dividendMeta");
  if (!wrap) return;
  if (!window.KR_DIVIDENDS && !_dividendTried) {
    _dividendTried = true; wrap.innerHTML = '<p class="muted">데이터를 불러오는 중…</p>';
    Promise.all([ensureFeatureData("krDividends"), ensureFeatureData("krDiscStats")]).then(renderDividends); return;
  }
  const payload = window.KR_DIVIDENDS || {};
  let rows = (payload.rows || []).slice();
  const q = dividendQuery.trim().toLowerCase();
  if (q) rows = rows.filter((r) => (r.ticker || "").toLowerCase().includes(q) || (r.company || "").toLowerCase().includes(q));
  if (dividendSort === "yield") rows.sort((a, b) => (b.yieldPct ?? -1) - (a.yieldPct ?? -1));
  else rows.sort((a, b) => (a.recordDate || "9999").localeCompare(b.recordDate || "9999")); // 배당락 임박순
  if (meta) meta.innerHTML = rows.length ? `업데이트 ${escapeHtml(payload.updatedAtKst || "")} · ${rows.length}건${krDiscStatNote("배당")}` : "";
  if (!rows.length) { wrap.innerHTML = `<p class="muted">최근 공시분에 배당 결정이 없습니다.</p>`; return; }
  const body = rows.slice(0, 200).map((r) => `<tr>
    <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.ticker)}">${escapeHtml(r.company)}</button><div class="ins-sub">${escapeHtml(r.ticker)} · ${escapeHtml(r.divKind || "배당")}</div></td>
    <td class="ins-num"><strong>${Number.isFinite(r.yieldPct) ? `${r.yieldPct.toFixed(2)}%` : "—"}</strong></td>
    <td class="ins-num">${Number.isFinite(r.dps) ? `₩${Number(r.dps).toLocaleString()}` : "—"}</td>
    <td class="ins-date">${escapeHtml(r.recordDate || "—")}</td>
    <td class="ins-date">${escapeHtml(r.payDate || "—")}</td>
  </tr>`).join("");
  wrap.innerHTML = `<table class="insider-table"><thead><tr><th>종목</th><th class="ins-num">시가배당률</th><th class="ins-num">주당배당금</th><th>배당기준일</th><th>지급예정일</th></tr></thead><tbody>${body}</tbody></table>`;
  wrap.querySelectorAll(".ins-ticker").forEach((b) => b.addEventListener("click", () => selectTicker(b.dataset.ticker, { openSearch: true })));
}

// ===== 공급계약(수주) 트래커 (KR 전용) =====
let contractSort = "ratio", contractQuery = "", _contractTried = false;
function renderContracts() {
  bindListControls("contractSort", "contractSearch", (v) => contractSort = v, (v) => contractQuery = v, renderContracts);
  const wrap = byId("contractTable"); const meta = byId("contractMeta");
  if (!wrap) return;
  if (!window.KR_CONTRACTS && !_contractTried) {
    _contractTried = true; wrap.innerHTML = '<p class="muted">데이터를 불러오는 중…</p>';
    Promise.all([ensureFeatureData("krContracts"), ensureFeatureData("krDiscStats")]).then(renderContracts); return;
  }
  const payload = window.KR_CONTRACTS || {};
  let rows = (payload.rows || []).slice();
  const q = contractQuery.trim().toLowerCase();
  if (q) rows = rows.filter((r) => (r.ticker || "").toLowerCase().includes(q) || (r.company || "").toLowerCase().includes(q));
  if (contractSort === "date") rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  else rows.sort((a, b) => (b.salesRatio ?? -1) - (a.salesRatio ?? -1));
  if (meta) meta.innerHTML = rows.length ? `업데이트 ${escapeHtml(payload.updatedAtKst || "")} · ${rows.length}건${krDiscStatNote("공급계약")}` : "";
  if (!rows.length) { wrap.innerHTML = `<p class="muted">최근 공시분에 공급계약이 없습니다.</p>`; return; }
  const body = rows.slice(0, 200).map((r) => {
    const period = (r.startDate || r.endDate) ? `${escapeHtml(r.startDate || "")}~${escapeHtml(r.endDate || "")}` : "";
    return `<tr>
    <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.ticker)}">${escapeHtml(r.company)}</button><div class="ins-sub">${escapeHtml(r.ticker)}${r.counterparty ? ` · ${escapeHtml(r.counterparty)}` : ""}</div></td>
    <td class="ins-num"><strong>${Number.isFinite(r.salesRatio) ? `${r.salesRatio.toFixed(1)}%` : "—"}</strong></td>
    <td class="ins-num">${krMoneyEok(r.amount)}</td>
    <td class="ins-date">${escapeHtml(r.date || "")}<div class="ins-sub">${period}</div></td>
  </tr>`;
  }).join("");
  wrap.innerHTML = `<table class="insider-table"><thead><tr><th>종목 · 계약상대</th><th class="ins-num">매출대비</th><th class="ins-num">계약금액</th><th>공시일 · 기간</th></tr></thead><tbody>${body}</tbody></table>`;
  wrap.querySelectorAll(".ins-ticker").forEach((b) => b.addEventListener("click", () => selectTicker(b.dataset.ticker, { openSearch: true })));
}

// ===== 증자·CB 희석(오버행) 트래커 (KR 전용) =====
// 자사주(매입=환원)의 정반대 리스크. KR_DISCLOSURES(유상증자·CB·BW·EB 발행결정) +
// KR_EVENT_DETAILS(희석률·전환가·발행금액, build_kr_event_details.py 가 이미 파싱) +
// 시총을 프론트에서 조합한다. 새 백엔드 0.
let dilutionSort = "dilution", dilutionQuery = "", _dilutionTried = false;
function dilutionCategory(title) {
  const t = title || "";
  if (t.includes("유상증자결정")) return { key: "증자", label: "유상증자" };
  if (t.includes("전환사채권발행")) return { key: "CB", label: "전환사채(CB)" };
  if (t.includes("신주인수권부사채권발행")) return { key: "BW", label: "신주인수권부사채(BW)" };
  if (t.includes("교환사채권발행")) return { key: "EB", label: "교환사채(EB)" };
  return null;
}
function renderDilution() {
  bindListControls("dilutionSort", "dilutionSearch", (v) => dilutionSort = v, (v) => dilutionQuery = v, renderDilution);
  const wrap = byId("dilutionTable"); const meta = byId("dilutionMeta");
  if (!wrap) return;
  if ((!window.KR_DISCLOSURES || !window.KR_EVENT_DETAILS) && !_dilutionTried) {
    _dilutionTried = true; wrap.innerHTML = '<p class="muted">데이터를 불러오는 중…</p>';
    Promise.all([ensureFeatureData("krDart"), ensureFeatureData("krEventDetails"), ensureFeatureData("krDiscStats")]).then(renderDilution); return;
  }
  const disc = ((window.KR_DISCLOSURES || {}).disclosures) || [];
  const details = (window.KR_EVENT_DETAILS || {}).details || {};
  const capByTicker = {};
  const stocks = (typeof data !== "undefined" && data && Array.isArray(data.stocks)) ? data.stocks : [];
  stocks.forEach((s) => { if (s.ticker) capByTicker[s.ticker] = Number(s.marketCapT ?? s.marketCapB ?? 0); });
  const rcpt = (link) => { const m = /rcpNo=(\d+)/.exec(link || ""); return m ? m[1] : ""; };

  let rows = [];
  for (const d of disc) {
    const cat = dilutionCategory(d.title);
    if (!cat) continue;
    const det = details[rcpt(d.link)] || {};
    if (det.dilutionPct == null && det.amount == null) continue; // 숫자 없으면 제외
    rows.push({
      ticker: d.ticker, company: d.company || d.ticker, date: d.fileDate || "",
      type: cat.label, typeKey: cat.key,
      dilutionPct: Number(det.dilutionPct) || null,
      amount: Number(det.amount) || null,
      convPrice: Number(det.convPrice) || null,
      method: det.method || "",
    });
  }
  const q = dilutionQuery.trim().toLowerCase();
  if (q) rows = rows.filter((r) => (r.ticker || "").toLowerCase().includes(q) || (r.company || "").toLowerCase().includes(q));
  if (dilutionSort === "date") rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  else if (dilutionSort === "amount") rows.sort((a, b) => (b.amount ?? -1) - (a.amount ?? -1));
  else rows.sort((a, b) => (b.dilutionPct ?? -1) - (a.dilutionPct ?? -1));
  if (meta) meta.innerHTML = rows.length ? `업데이트 ${escapeHtml((window.KR_DISCLOSURES || {}).updatedAtKst || "")} · ${rows.length}건${krDiscStatNote("증자·사채")}` : "";
  if (!rows.length) { wrap.innerHTML = `<p class="muted">최근 공시분에 증자·사채 발행이 없습니다.</p>`; return; }
  const body = rows.slice(0, 200).map((r) => `<tr>
    <td class="ins-date">${escapeHtml(r.date)}</td>
    <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.ticker)}">${escapeHtml(r.company)}</button><div class="ins-sub">${escapeHtml(r.ticker)}${r.method ? ` · ${escapeHtml(r.method)}` : ""}</div></td>
    <td class="ins-sub ins-sell">${escapeHtml(r.type)}</td>
    <td class="ins-num"><strong>${r.dilutionPct != null ? `${r.dilutionPct.toFixed(1)}%` : "—"}</strong></td>
    <td class="ins-num">${krMoneyEok(r.amount)}</td>
    <td class="ins-num">${r.convPrice != null ? `₩${Number(r.convPrice).toLocaleString()}` : "—"}</td>
  </tr>`).join("");
  wrap.innerHTML = `<table class="insider-table"><thead><tr><th>공시일</th><th>종목</th><th>유형</th><th class="ins-num">희석률</th><th class="ins-num">발행금액</th><th class="ins-num">전환·행사가</th></tr></thead><tbody>${body}</tbody></table>`;
  wrap.querySelectorAll(".ins-ticker").forEach((b) => b.addEventListener("click", () => selectTicker(b.dataset.ticker, { openSearch: true })));
}

// ===== 홈: 오늘의 KR 공시 하이라이트 (KR 전용) =====
// 13개 서브탭에 흩어진 이벤트를 홈에서 한눈에. 탭은 그대로 두고 발견성만 더한다.
// 각 유형의 대표 1건씩(공매도 최고·자사주 최대·희석 최고·수주 최대·배당 임박·실적 반응).
function renderKrHighlights() {
  const el = byId("krHighlights");
  if (!el) return;
  const isKr = (typeof isKrMarket === "function") ? isKrMarket() : (marketCfg().id === "kr");
  if (!isKr) { el.hidden = true; el.innerHTML = ""; return; }
  const items = [];
  const add = (label, r, extra, tone) => { if (r && r.ticker) items.push({ label, ticker: r.ticker, company: r.company || r.ticker, extra, tone }); };

  const si = ((window.SHORT_INTEREST || {}).rows || []).filter((r) => Number.isFinite(r.balanceRatio))
    .sort((a, b) => b.balanceRatio - a.balanceRatio)[0];
  if (si) add("공매도 최고", si, `잔고 ${si.balanceRatio.toFixed(1)}%`, "warn");

  // 자사주 최대 취득 · 최고 희석 증자 — 공시+상세 조합.
  const disc = (window.KR_DISCLOSURES || {}).disclosures || [];
  const det = (window.KR_EVENT_DETAILS || {}).details || {};
  const rcpt = (l) => { const m = /rcpNo=(\d+)/.exec(l || ""); return m ? m[1] : ""; };
  let topBuy = null, topDil = null;
  for (const d of disc) {
    const dt = det[rcpt(d.link)] || {};
    if ((d.title || "").includes("자기주식취득") && dt.amount && (!topBuy || dt.amount > topBuy.amt)) topBuy = { ticker: d.ticker, company: d.company, amt: dt.amount };
    const cat = dilutionCategory(d.title);
    if (cat && dt.dilutionPct != null && (!topDil || dt.dilutionPct > topDil.dil)) topDil = { ticker: d.ticker, company: d.company, dil: dt.dilutionPct, label: cat.label };
  }
  if (topBuy) add("자사주 매입", topBuy, `${Math.round(topBuy.amt / 1e8).toLocaleString()}억`, "good");
  if (topDil) add(`${topDil.label} 희석`, topDil, `희석 ${topDil.dil.toFixed(1)}%`, "warn");

  const ct = ((window.KR_CONTRACTS || {}).rows || []).filter((r) => Number.isFinite(r.salesRatio))
    .sort((a, b) => b.salesRatio - a.salesRatio)[0];
  if (ct) add("대형 수주", ct, `매출대비 ${ct.salesRatio.toFixed(0)}%`, "good");

  const dv = ((window.KR_DIVIDENDS || {}).rows || []).filter((r) => r.recordDate)
    .sort((a, b) => a.recordDate.localeCompare(b.recordDate))[0];
  if (dv) add("배당 임박", dv, `${dv.recordDate}${Number.isFinite(dv.yieldPct) ? ` · ${dv.yieldPct.toFixed(1)}%` : ""}`, "");

  const er = ((window.KR_EARNINGS_REACTIONS || {}).rows || []).filter((r) => Number.isFinite(r.dayPct))
    .sort((a, b) => Math.abs(b.dayPct) - Math.abs(a.dayPct))[0];
  if (er) add("실적 반응", er, `공시일 ${er.dayPct > 0 ? "+" : ""}${er.dayPct.toFixed(1)}%`, er.dayPct >= 0 ? "good" : "warn");

  // 중대 리스크 공시 종목이 있으면 맨 앞에 경고로(상장폐지·불성실·중대 거래정지·횡령).
  for (const d of ((window.KR_DISCLOSURES || {}).disclosures || [])) {
    const tt = d.title || "";
    let lbl = null;
    if (tt.includes("상장폐지")) lbl = "상장폐지 사유";
    else if (tt.includes("불성실공시")) lbl = "불성실공시";
    else if (tt.includes("횡령") || tt.includes("배임")) lbl = "횡령·배임";
    else if (tt.includes("거래정지") && /상장폐지|불성실|감사의견|횡령/.test(tt)) lbl = "거래정지(중대)";
    if (lbl && d.ticker) { items.unshift({ label: "리스크", ticker: d.ticker, company: d.company || d.ticker, extra: lbl, tone: "warn" }); break; }
  }

  if (!items.length) { el.hidden = true; el.innerHTML = ""; return; }
  el.hidden = false;
  const chip = (it) => {
    const c = it.tone === "good" ? "#30a46c" : it.tone === "warn" ? "#e5484d" : "var(--accent,#5b8def)";
    return `<button type="button" class="kr-hl-chip" data-ticker="${escapeHtml(it.ticker)}" style="display:inline-flex;align-items:baseline;flex-wrap:wrap;gap:3px 7px;padding:7px 12px;border-left:3px solid ${c};border-radius:8px;background:var(--panel-soft);color:var(--text);cursor:pointer;text-align:left;line-height:1.4;height:auto;min-height:0">
      <span style="font-size:14px;font-weight:600;color:var(--text)">${escapeHtml(it.company)}</span>
      <span style="font-size:11px;color:var(--muted)">${escapeHtml(it.label)}</span>
      <span style="font-size:12px;color:${c};font-weight:600">${escapeHtml(it.extra || "")}</span>
    </button>`;
  };
  el.innerHTML = `<div class="section-title" style="margin-bottom:8px"><h2>오늘의 KR 공시 하이라이트</h2><p>흩어진 공시·수급을 종목별 서브탭에서 한눈에</p></div>
    <div class="kr-hl-chips" style="display:flex;flex-wrap:wrap;gap:8px">${items.map(chip).join("")}</div>`;
  el.querySelectorAll(".kr-hl-chip").forEach((b) => b.addEventListener("click", () => selectTicker(b.dataset.ticker, { openSearch: true })));
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
    <div class="hl-col"><h4>분기 신규 매수 Top <span>(기관 수)</span></h4><div class="hl-chips">${list(newBuys, "hl-buy")}</div></div>
    <div class="hl-col"><h4>분기 전량 매도 Top <span>(기관 수)</span></h4><div class="hl-chips">${list(soldOut, "hl-sell")}</div></div>`;
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
    <div class="r52-ends"><span>저 ${priceOrDash(low)}</span><span>현 ${priceOrDash(price)}</span><span>고 ${priceOrDash(high)}</span></div>`;
}

// ===== #9 오늘의 시그널 통합 대시보드 =====
function signalCard(title, items, note) {
  const body = items.length
    ? items.map((x) => `<li><button type="button" class="ins-ticker" data-ticker="${escapeHtml(x.ticker)}">${escapeHtml(x.ticker)}</button><span>${escapeHtml(x.note || "")}</span></li>`).join("")
    : `<li class="muted">해당 신호 없음</li>`;
  return `<div class="signal-card"><h3>${title}</h3>${note ? `<p class="sig-note">${escapeHtml(note)}</p>` : ""}<ul>${body}</ul></div>`;
}
// ===== 미국 국채 수익률 곡선 (FRED) =====
// 매크로 컨텍스트: 곡선 모양과 장단기 스프레드. 역전(음수)은 역사적으로 경기침체를
// 앞서 나타난 적이 많지만 시점은 들쭉날쭉 — 신호가 아니라 현재 상태 요약이다.
function yieldCurveSvg(curve) {
  const W = 320, H = 96, padL = 28, padR = 10, padT = 10, padB = 20;
  const pts = curve.filter((c) => Number.isFinite(Number(c.y)));
  if (pts.length < 3) return "";
  const ys = pts.map((c) => c.y);
  const ymin = Math.floor(Math.min(...ys) * 2) / 2 - 0.25;
  const ymax = Math.ceil(Math.max(...ys) * 2) / 2 + 0.25;
  const span = Math.max(0.5, ymax - ymin);
  const x = (i) => padL + (W - padL - padR) * (pts.length === 1 ? 0.5 : i / (pts.length - 1));
  const y = (v) => padT + (H - padT - padB) * (1 - (v - ymin) / span);
  const line = pts.map((c, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(c.y).toFixed(1)}`).join(" ");
  const dots = pts.map((c, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(c.y).toFixed(1)}" r="2.4" fill="#5b8def"/>`).join("");
  const labels = pts.map((c, i) => (i % 2 === 0 || i === pts.length - 1)
    ? `<text x="${x(i).toFixed(1)}" y="${H - 6}" font-size="8" fill="var(--muted)" text-anchor="middle">${c.m}</text>` : "").join("");
  const gy = [ymin, (ymin + ymax) / 2, ymax];
  const grid = gy.map((v) => `<line x1="${padL}" y1="${y(v).toFixed(1)}" x2="${W - padR}" y2="${y(v).toFixed(1)}" stroke="var(--line)" stroke-opacity="0.5"/><text x="2" y="${(y(v) + 3).toFixed(1)}" font-size="8" fill="var(--muted)">${v.toFixed(1)}</text>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="xMidYMid meet">${grid}<path d="${line}" fill="none" stroke="#5b8def" stroke-width="1.6"/>${dots}${labels}</svg>`;
}

function renderYieldCurve() {
  const host = byId("yieldCurve");
  if (!host) return;
  const yc = window.YIELD_CURVE;
  if (!yc || !Array.isArray(yc.curve) || yc.curve.length < 3) { host.innerHTML = ""; return; }
  const sp = yc.spreads || {};
  const spTile = (label, v, sub) => {
    if (!Number.isFinite(Number(v))) return "";
    const inv = v < 0;
    const col = inv ? "var(--red)" : "var(--green)";
    return `<article style="background:var(--panel-soft);border-radius:12px;padding:12px 14px;min-width:120px">
      <div style="font-size:11.5px;color:var(--muted);margin-bottom:5px">${label}</div>
      <div style="font-size:20px;font-weight:700;font-variant-numeric:tabular-nums;color:${col}">${v > 0 ? "+" : ""}${Number(v).toFixed(2)}%p</div>
      <div style="font-size:10.5px;color:${inv ? "var(--red)" : "var(--muted)"}">${inv ? "역전(단기>장기)" : sub}</div>
    </article>`;
  };
  const spark = Array.isArray(yc.spreadHistory) && yc.spreadHistory.length > 5
    ? seasonalitySvgLine(yc.spreadHistory.map((h) => h.v)) : "";
  const last10 = (yc.curve.find((c) => c.m === "10Y") || {}).y;
  host.innerHTML = `
    <div class="section-title"><h2>미국 국채 수익률 곡선</h2>
      <p>FRED 기준 ${escapeHtml(yc.asOf || "")} · 지수·종목만으로 안 보이는 '돈의 값(금리)'과 장단기 스프레드입니다. 예측이 아니라 현재 상태 요약입니다.</p></div>
    <div style="background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin-bottom:8px">
      <div style="display:flex;gap:18px;flex-wrap:wrap;align-items:center">
        <div style="flex:1;min-width:240px">${yieldCurveSvg(yc.curve)}</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          ${Number.isFinite(Number(last10)) ? `<article style="background:var(--panel-soft);border-radius:12px;padding:12px 14px;min-width:120px"><div style="font-size:11.5px;color:var(--muted);margin-bottom:5px">10년물</div><div style="font-size:20px;font-weight:700;font-variant-numeric:tabular-nums">${Number(last10).toFixed(2)}%</div><div style="font-size:10.5px;color:var(--muted)">기준 만기</div></article>` : ""}
          ${spTile("10Y − 2Y", sp.t10y2y, "정상(우상향)")}
          ${spTile("10Y − 3M", sp.t10y3m, "정상(우상향)")}
        </div>
      </div>
      ${spark ? `<div style="margin-top:12px"><div style="font-size:11px;color:var(--muted);margin-bottom:4px">10Y − 2Y 스프레드 · 최근 1년</div>${spark}</div>` : ""}
      <p style="font-size:11px;color:var(--muted);margin:12px 0 0;line-height:1.5">장단기 금리 역전(스프레드 음수)은 과거 경기침체를 앞서 나타난 적이 많지만 시점 차이가 커 매매 신호로 쓰기 어렵습니다. 출처: ${escapeHtml(yc.source || "FRED")}.</p>
    </div>`;
}

// 스프레드 추이용 라인 스파크라인(0 기준선 + 음영). seasonalitySvg 가 막대라 별도.
function seasonalitySvgLine(vals) {
  const nums = vals.map(Number).filter(Number.isFinite);
  if (nums.length < 2) return "";
  const W = 320, H = 40, pad = 3;
  const mn = Math.min(...nums, 0), mx = Math.max(...nums, 0);
  const span = Math.max(0.01, mx - mn);
  const x = (i) => pad + (W - pad * 2) * i / (nums.length - 1);
  const y = (v) => pad + (H - pad * 2) * (1 - (v - mn) / span);
  const line = nums.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const zeroY = y(0).toFixed(1);
  const lastCol = nums[nums.length - 1] < 0 ? "#e5484d" : "#30a46c";
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none"><line x1="0" y1="${zeroY}" x2="${W}" y2="${zeroY}" stroke="var(--muted)" stroke-opacity="0.3" stroke-dasharray="2 2"/><path d="${line}" fill="none" stroke="${lastCol}" stroke-width="1.4"/></svg>`;
}

// 시장 심리 종합지수 (Fear & Greed) — 이미 수집하는 지표를 0~100 으로 종합. CNN 스타일의
// 구성요소별 정규화 평균. 예측이 아니라 '지금 시장이 공포인가 탐욕인가'의 상태 요약.
function fearGreedComponents() {
  const stocks = (data && Array.isArray(data.stocks) ? data.stocks : []).filter((s) => !isStockEtf(s));
  const comps = [];
  const clamp = (v) => Math.max(0, Math.min(100, v));
  if (stocks.length >= 20) {
    const up = stocks.filter((s) => Number(s.changePct) > 0).length;
    const down = stocks.filter((s) => Number(s.changePct) < 0).length;
    if (up + down > 0) comps.push({ key: "시장 폭", score: clamp(up / (up + down) * 100), detail: "상승/하락 종목" });
    let posM = 0, totM = 0;
    for (const s of stocks) { const v = Number(s.monthChangePct); if (Number.isFinite(v)) { totM++; if (v > 0) posM++; } }
    if (totM > 0) comps.push({ key: "모멘텀", score: clamp(posM / totM * 100), detail: "1개월 상승 비율" });
    const highs = stocks.filter((s) => Number(s.newHighDistancePct) <= 2).length;
    const lows = stocks.filter((s) => { const d = (typeof low52DistPct === "function") ? low52DistPct(s) : NaN; return Number.isFinite(d) && d <= 5; }).length;
    if (highs + lows > 0) comps.push({ key: "주가 강도", score: clamp(highs / (highs + lows) * 100), detail: "신고가 vs 신저가" });
  }
  const os = window.OPTIONS_STATS;
  const pc = os && os.market && Number(os.market.putCallOI);
  if (Number.isFinite(pc)) comps.push({ key: "옵션 (풋/콜)", score: clamp((1.25 - pc) / (1.25 - 0.65) * 100), detail: `풋콜 ${pc.toFixed(2)}` });
  const macro = window.MACRO_INDICATORS;
  if (macro && Array.isArray(macro.indicators)) {
    const hy = macro.indicators.find((i) => i.id === "BAMLH0A0HYM2");
    if (hy && Number.isFinite(Number(hy.value))) comps.push({ key: "정크본드 수요", score: clamp((6 - Number(hy.value)) / (6 - 2.5) * 100), detail: `HY 스프레드 ${hy.value}%p` });
    const vix = macro.indicators.find((i) => i.id === "VIXCLS");
    if (vix && Number.isFinite(Number(vix.value))) comps.push({ key: "변동성 (VIX)", score: clamp((30 - Number(vix.value)) / (30 - 12) * 100), detail: `VIX ${vix.value}` });
  }
  return comps;
}

function fearGreedLabel(v) {
  return v < 25 ? { t: "극단적 공포", c: "#e5484d" } : v < 45 ? { t: "공포", c: "#e5894d" }
    : v <= 55 ? { t: "중립", c: "#c2a63a" } : v <= 75 ? { t: "탐욕", c: "#57a83a" } : { t: "극단적 탐욕", c: "#30a46c" };
}

function renderFearGreed() {
  const host = byId("fearGreed");
  if (!host) return;
  const comps = fearGreedComponents();
  if (comps.length < 2) { host.innerHTML = ""; return; }
  const value = Math.round(comps.reduce((a, c) => a + c.score, 0) / comps.length);
  const lab = fearGreedLabel(value);
  // 그라디언트 바 + 마커
  const bar = `<div style="position:relative;height:14px;border-radius:8px;background:linear-gradient(90deg,#e5484d,#e5894d,#c2a63a,#57a83a,#30a46c)">
      <div style="position:absolute;left:${value}%;top:-4px;transform:translateX(-50%);width:4px;height:22px;background:var(--text);border-radius:2px;box-shadow:0 0 0 2px var(--panel)"></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-top:4px"><span>공포 0</span><span>중립 50</span><span>탐욕 100</span></div>`;
  const subs = comps.map((c) => {
    const cl = fearGreedLabel(c.score);
    return `<div style="display:flex;align-items:center;gap:8px;margin:4px 0">
      <span style="width:88px;font-size:11.5px;color:var(--muted)">${escapeHtml(c.key)}</span>
      <div style="flex:1;height:6px;border-radius:3px;background:var(--panel-soft);overflow:hidden"><div style="width:${c.score}%;height:100%;background:${cl.c}"></div></div>
      <span style="width:82px;text-align:right;font-size:10.5px;color:var(--muted)">${escapeHtml(c.detail)}</span>
    </div>`;
  }).join("");
  host.innerHTML = `
    <div class="section-title"><h2>시장 심리 종합지수</h2>
      <p>이미 수집하는 지표(시장 폭·모멘텀·주가 강도·옵션 풋콜·신용스프레드)를 0~100으로 종합했습니다. 예측이 아니라 현재 공포/탐욕 상태의 요약입니다.</p></div>
    <div style="background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin-bottom:8px">
      <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:12px">
        <strong style="font-size:34px;font-variant-numeric:tabular-nums;color:${lab.c}">${value}</strong>
        <strong style="font-size:16px;color:${lab.c}">${lab.t}</strong>
        <span style="font-size:11px;color:var(--muted);margin-left:auto">${comps.length}개 요소 평균</span>
      </div>
      ${bar}
      <div style="margin-top:14px">${subs}</div>
      <p style="font-size:11px;color:var(--muted);margin:12px 0 0;line-height:1.5">각 요소를 0(공포)~100(탐욕)으로 정규화해 단순 평균했습니다. 극단값에서 되돌림이 잦다는 해석이 있으나 시점 신호로 쓰긴 어렵습니다.</p>
    </div>`;
}

// FRED 매크로 지표 — 인플레·고용·금리·신용스프레드·소비심리. 현재값 + 전월/전주 대비.
// tone 으로 '오르는 게 나쁜' 지표(인플레·실업·스프레드)는 상승을 red 로 칠한다.
function renderMacroIndicators() {
  const host = byId("macroIndicators");
  if (!host) return;
  const m = window.MACRO_INDICATORS;
  if (!m || !Array.isArray(m.indicators) || !m.indicators.length) { host.innerHTML = ""; return; }
  const tile = (it) => {
    const ch = Number(it.change);
    let col = "var(--muted)";
    if (Number.isFinite(ch) && ch !== 0 && it.tone !== "neutral") {
      const goodUp = it.tone === "down"; // "down" tone = 높을수록 좋음
      const positive = goodUp ? ch > 0 : ch < 0;
      col = positive ? "var(--green)" : "var(--red)";
    }
    const arrow = Number.isFinite(ch) && ch !== 0 ? (ch > 0 ? "▲" : "▼") : "";
    return `<article style="background:var(--panel-soft);border-radius:12px;padding:12px 14px">
      <div style="font-size:11.5px;color:var(--muted);margin-bottom:6px;line-height:1.3">${escapeHtml(it.label)}</div>
      <div style="font-size:20px;font-weight:700;font-variant-numeric:tabular-nums">${it.value}${escapeHtml(it.unit || "")}</div>
      <div style="font-size:11px;color:${col};font-variant-numeric:tabular-nums;margin-top:3px">${arrow} ${Number.isFinite(ch) ? (ch > 0 ? "+" : "") + ch + (it.unit || "") : "—"} <span style="color:var(--muted)">· ${escapeHtml(String(it.date || "").slice(0, 7))}</span></div>
    </article>`;
  };
  host.innerHTML = `
    <div class="section-title"><h2>매크로 지표</h2>
      <p>FRED 기준 핵심 거시지표입니다. 화살표 색은 방향의 좋고 나쁨(인플레·실업·신용스프레드는 상승이 부정적). 예측이 아니라 현재값·직전 대비입니다.</p></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:8px">${m.indicators.map(tile).join("")}</div>`;
}

function renderSignals() {
  renderFearGreed();
  renderMacroIndicators();
  renderYieldCurve();
  const el = byId("signalsGrid");
  if (!el) return;
  const cards = [];
  const cfg = marketCfg();
  const minCapForHighs = isKrMarket() ? 1 : 2;
  if (!isKrMarket()) {
    // 내부자 클러스터 매수
    const ins = (window.INSIDER_TRADES || {}).trades || [];
    const byT = {};
    for (const r of ins) {
      if (r.kind !== "buy" || !r.ticker) continue;
      const g = byT[r.ticker] || (byT[r.ticker] = { t: r.ticker, owners: new Set(), v: 0 });
      g.owners.add(r.owner || "?"); g.v += Number(r.value) || 0;
    }
    const clusters = Object.values(byT).filter((g) => g.owners.size >= 2).sort((a, b) => b.owners.size - a.owners.size || b.v - a.v).slice(0, 8);
    cards.push(signalCard("내부자 클러스터 매수", clusters.map((g) => ({ ticker: g.t, note: `${g.owners.size}명 · ${insiderFmtUsd(g.v)}` })), "2인+ 임원 공개시장 매수"));
  }
  // 52주 신고가 근접 — 합성 이력은 52주 고점 자체가 랜덤워크가 만든 값이라 제외한다.
  const highs = data.stocks.filter((s) => !isStockEtf(s) && !isSyntheticHistory(s) && Number(s.newHighDistancePct) <= 0.5 && (s.marketCapB || 0) >= minCapForHighs)
    .sort((a, b) => b.marketCapB - a.marketCapB).slice(0, 8);
  cards.push(signalCard("52주 신고가 근접", highs.map((s) => ({ ticker: s.ticker, note: `${priceOrDash(s.price)} · ${fmtDailyPct(s.changePct)}` })), "고점 0.5% 이내"));
  if (cfg.features?.materialEvents !== false) {
    const ev = ((window.MATERIAL_EVENTS || {}).events || []).filter((e) => e.hot).slice(0, 8);
    cards.push(signalCard("주요 공시 8-K", ev.map((e) => ({ ticker: e.ticker, note: (e.items || []).map((i) => i.label).slice(0, 2).join(", ") }))));
  }
  if (!isKrMarket()) {
    const act = ((window.ACTIVIST_STAKES || {}).filings || []).filter((a) => a.kind === "activist").slice(0, 8);
    cards.push(signalCard("액티비스트 13D", act.map((a) => ({ ticker: a.ticker, note: a.filer || "" }))));
  }
  if (cfg.features?.ipo !== false) {
    const ipo = ((window.IPO_CALENDAR || {}).ipos || []).filter((i) => i.stage === "priced").slice(0, 8);
    cards.push(signalCard("신규 상장(가격확정)", ipo.map((i) => ({ ticker: i.ticker || "—", note: i.company || "" }))));
  }
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
  if (isKrMarket()) { el.innerHTML = ""; return; }
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
  cards.push(`<div class="agg-card"><h3>의원 순매수 TOP5</h3>${netByT.length ? aggBars(netByT.slice(0, 5), usd, "#3b82f6") : '<p class="muted">최근 30일 순매수 데이터 없음</p>'}</div>`);
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
  cards.push(`<div class="agg-card"><h3>‍내부자 매수대금 섹터 랭킹</h3>${secRows.length ? aggBars(secRows, usd, "#16a34a") : '<p class="muted">최근 30일 내부자 매수 데이터 없음</p>'}</div>`);
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

let currentViewMode = DEFAULT_VIEW_MODE;

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
  let saved = DEFAULT_VIEW_MODE;
  try { saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY) || DEFAULT_VIEW_MODE; } catch (_) {}
  const requestedButton = requestedTab ? document.querySelector(`[data-tab="${requestedTab}"]`) : null;
  if (requestedButton?.dataset.advanced === "true") saved = "advanced";
  setViewMode(saved, { persist: false });
  const modeSwitch = byId("viewModeSwitch");
  if (modeSwitch && !modeSwitch.dataset.bound) {
    modeSwitch.dataset.bound = "1";
    modeSwitch.querySelectorAll("[data-view-mode]").forEach((button) => {
      button.addEventListener("click", () => setViewMode(button.dataset.viewMode));
    });
  }
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

// 딥링크(?tab=...)로 들어온 사용자를 탭 본문까지 데려간다.
// 홈 상단은 시장 요약·지수 카드·카드뉴스가 차지하고 있어서, 특정 탭을 지정해
// 들어와도 첫 뷰포트는 홈과 사실상 같았다 — 목적을 가지고 온 사람이 매번
// 손으로 스크롤해야 했다. 탭 바가 화면 위쪽에 걸치도록(본문 시작점이 아니라)
// 맞춰서, 다른 탭으로 갈아탈 여지는 남긴다.
const TAB_SCROLL_GAP = 8;         // 탭 바 위에 남길 여백
// 라이브에서는 히어로 검색·카드뉴스 이미지가 2.4초보다 늦게 레이아웃을 키워
// 딥링크 스크롤이 328px 못 미쳤다(2026-07-23 smoke 실측). 재정렬은 목표와 4px
// 이상 어긋났을 때만 발동하므로 창을 길게 잡아도 화면이 튀지 않는다.
const TAB_SCROLL_SETTLE_MS = 6000; // 이 시간까지 늦게 도착하는 데이터에 맞춰 재정렬

function scrollToTabContent() {
  const wrap = byId("tabsScrollWrap");
  if (!wrap) return;

  // 한 번만 스크롤하면 안 된다. signals/institutional/calendar 처럼 데이터를 늦게
  // 받는 탭은 스크롤이 끝난 뒤에 위쪽(시장 요약·브리핑) 높이가 자라고, 그만큼
  // 탭 바가 아래로 밀려 내려가 목적지에 못 미친 화면이 된다. 위치가 안정될
  // 때까지 짧게 재정렬한다.
  // 부드러운 스크롤은 애니메이션 중 좌표가 계속 변해 재정렬과 싸우므로 쓰지 않는다.
  // 짧은 탭(예: 캘린더)은 문서 자체가 뷰포트보다 조금만 길어서 탭 바를 맨 위까지
  // 올릴 수 없다. 그럴 땐 스크롤 가능한 끝까지가 목표다 — 이 한계를 안 두면
  // 도달 못 하는 좌표를 향해 재정렬이 끝없이 돈다.
  const targetY = () => {
    const want = wrap.getBoundingClientRect().top + window.pageYOffset - TAB_SCROLL_GAP;
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    return Math.min(Math.max(0, want), max);
  };
  const align = () => window.scrollTo({ top: targetY(), behavior: "auto" });

  let timer = null;
  const stop = () => {
    if (timer) { clearInterval(timer); timer = null; }
    ["wheel", "touchstart", "keydown"].forEach((t) => window.removeEventListener(t, stop));
  };
  // 사용자가 직접 스크롤을 시작하면 즉시 손을 뗀다 — 읽는 중에 화면이 튀면 안 된다.
  ["wheel", "touchstart", "keydown"].forEach((t) => window.addEventListener(t, stop, { passive: true }));

  requestAnimationFrame(align);
  const until = Date.now() + TAB_SCROLL_SETTLE_MS;
  timer = setInterval(() => {
    if (Math.abs(window.pageYOffset - targetY()) > 4) align();
    if (Date.now() > until) stop();
  }, 150);
}

function activateTab(name, { push = true, ticker = null, sub = null, communityTicker = null } = {}) {
  const resolved = normalizeTabRequest(name, sub);
  name = resolved.tab;
  sub = resolved.sub;
  // Tabs hidden for this market (e.g. KR 거장 포트폴리오) fall back to 종목 검색.
  if ((marketCfg().hiddenTabs || []).includes(name)) { name = "search"; sub = null; }
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
  if (name === "signals") {
    renderSignals();
    ensureFeatureData("yieldCurve").then((ok) => { if (ok && currentTab === "signals") renderYieldCurve(); });
    ensureFeatureData("macro").then((ok) => { if (ok && currentTab === "signals") { renderMacroIndicators(); renderFearGreed(); } });
    ensureFeatureData("optionsStats").then((ok) => { if (ok && currentTab === "signals") renderFearGreed(); });
    // Smart-money signals read the heavy 13F/congress/insider datasets; load them on
    // first visit (they're excluded from the boot prefetch) and re-render as each lands.
    ["insider", "congress", "inst13f"].forEach((k) => {
      const meta = FEATURE_DATA[k];
      if (meta && featureDataEnabled(meta, marketCfg()) && !window[meta.global]) {
        ensureFeatureData(k).then((ok) => { if (ok && currentTab === "signals") renderSignals(); });
      }
    });
  }
  if (push) recordNav();
}

// ===== 탭 접근성(WAI-ARIA tablist 패턴) =====
// 탭이 <button> 이라 클릭은 되지만, 스크린리더에는 그냥 버튼 10개로 읽혔다
// (role/aria-selected 가 하나도 없었다). 무엇이 선택됐는지, 몇 개 중 몇 번째인지,
// 어느 패널을 제어하는지 알 수 없다.
//
// 마크업을 손으로 고치지 않고 여기서 입힌다: 탭 순서가 드래그로 바뀌고(setupTabReorder)
// 시장에 따라 숨겨지는 탭도 있어서, 정적 HTML 로는 상태를 따라갈 수 없다.
// 활성 상태는 어차피 `is-active` 클래스로 관리되므로 그 변화를 관찰해 동기화한다 —
// 그래야 activateTab/activateXSub 다섯 함수를 건드리지 않고도 항상 맞는다.
const TABLIST_SPECS = [
  { nav: "mainTabs", attr: "data-tab", panelId: (v) => `tab-${v}` },
  { nav: "sectorSubTabs", attr: "data-sub", panelId: (v) => `sub-${v}` },
  { nav: "searchSubTabs", attr: "data-sub", panelId: (v) => `sub-${v}` },
  { nav: "institutionalSubTabs", attr: "data-sub", panelId: (v) => `sub-inst-${v}` },
  { nav: "calendarSubTabs", attr: "data-sub", panelId: (v) => `sub-${v}` },
  { nav: "communitySubTabs", attr: "data-sub", panelId: (v) => `sub-community-${v}` },
];

function tablistButtons(nav, attr) {
  return [...nav.querySelectorAll(`[${attr}]`)];
}

// 숨겨진 탭은 키보드 순회에서 빼야 한다(KR 의 실적 일정, 공매도 등).
function visibleTablistButtons(nav, attr) {
  return tablistButtons(nav, attr).filter((b) => !b.hidden && b.offsetParent !== null);
}

function syncTablist(nav, attr) {
  const btns = tablistButtons(nav, attr);
  const active = btns.find((b) => b.classList.contains("is-active"));
  btns.forEach((btn) => {
    const on = btn === active;
    btn.setAttribute("aria-selected", on ? "true" : "false");
    // roving tabindex: 탭 묶음은 Tab 키 한 번으로 들어오고, 안에서는 화살표로 이동한다.
    btn.tabIndex = on ? 0 : -1;
  });
  // 활성 탭이 하나도 없으면(초기 렌더 등) 첫 번째를 Tab 진입점으로 남긴다.
  if (!active && btns.length) btns[0].tabIndex = 0;
}

function onTablistKeydown(event, nav, attr) {
  const keys = ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"];
  if (!keys.includes(event.key)) return;
  const btns = visibleTablistButtons(nav, attr);
  if (btns.length < 2) return;
  const current = btns.indexOf(document.activeElement);
  if (current < 0) return;
  let next;
  if (event.key === "Home") next = 0;
  else if (event.key === "End") next = btns.length - 1;
  else {
    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    next = (current + (forward ? 1 : -1) + btns.length) % btns.length;
  }
  event.preventDefault();
  btns[next].focus();
  btns[next].click();   // 이 앱의 탭은 포커스 이동 즉시 전환한다(automatic activation)
}

function setupTabSemantics() {
  TABLIST_SPECS.forEach((spec) => {
    const nav = byId(spec.nav);
    if (!nav) return;
    // boot() 은 한 번만 도는 게 아니다(스냅샷 로드 경로에 따라 재진입한다).
    // 가드가 없으면 keydown 핸들러가 두 번 붙어 화살표 한 번에 두 칸씩 넘어간다.
    if (nav.dataset.tablistBound) { syncTablist(nav, spec.attr); return; }
    nav.dataset.tablistBound = "1";
    nav.setAttribute("role", "tablist");
    tablistButtons(nav, spec.attr).forEach((btn) => {
      const value = btn.getAttribute(spec.attr);
      btn.setAttribute("role", "tab");
      if (!btn.id) btn.id = `tab-btn-${spec.nav}-${value}`;
      const panel = byId(spec.panelId(value));
      if (!panel) return;
      btn.setAttribute("aria-controls", panel.id);
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", btn.id);
      // 패널 안이 스크롤될 수 있어 키보드 사용자가 패널 자체에 포커스할 수 있어야 한다.
      if (!panel.hasAttribute("tabindex")) panel.tabIndex = 0;
    });
    nav.addEventListener("keydown", (e) => onTablistKeydown(e, nav, spec.attr));
    // is-active/hidden 이 바뀔 때마다 aria 를 맞춘다. aria-selected·tabindex 만 쓰므로
    // 이 관찰자가 자기 변경으로 다시 깨어나지 않는다(attributeFilter 참고).
    new MutationObserver(() => syncTablist(nav, spec.attr))
      .observe(nav, { attributes: true, subtree: true, attributeFilter: ["class", "hidden"] });
    syncTablist(nav, spec.attr);
  });
}

let tabsBound = false;
function setupTabs() {
  const tabsEl = byId("mainTabs");
  // 탭 버튼은 고정 DOM — 재부팅 시 click/scroll/resize 가 겹으로 붙는 것을 막는다.
  if (tabsBound) return;
  tabsBound = true;
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
  const cfg = marketCfg();
  const buckets = cfg.buckets || [];
  const defaultBucket = cfg.defaultBucket || "idx_sp500";
  byId("bucketFilter").innerHTML = buckets.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
  byId("bucketFilter").value = defaultBucket;
  byId("topBucket").innerHTML = buckets.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
  byId("topBucket").value = defaultBucket;

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
  byId("sectorEtfRsGroup").innerHTML = etfGroups.map((group) => `<option value="${group}">${group}</option>`).join("");

  const scrBucket = byId("scrBucket");
  if (scrBucket) scrBucket.innerHTML = buckets.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
  const scrSector = byId("scrSector");
  if (scrSector) scrSector.innerHTML = sectors.map((sector) => `<option value="${sector}">${sector}</option>`).join("");

  const scanBucket = byId("scanBucket");
  if (scanBucket) { scanBucket.innerHTML = buckets.map(([value, label]) => `<option value="${value}">${label}</option>`).join(""); scanBucket.value = defaultBucket; }
  const scanSector = byId("scanSector");
  if (scanSector) scanSector.innerHTML = sectors.map((sector) => `<option value="${sector}">${sector}</option>`).join("");
}

let eventsBound = false;
function setupEvents() {
  // 여기 리스너는 전부 index.html 고정 요소·document·window 대상이다. boot() 재진입
  // (시장 전환, 오프라인 복구)마다 다시 붙으면 관심종목 ★ 토글이 두 번 실행돼 무효가
  // 되는 식으로 깨진다. 데이터 의존 초기화만 재실행하고 바인딩은 1회로 제한한다.
  if (eventsBound) {
    populateBacktestBenchmarks();  // 시장별 벤치마크 목록 갱신
    initBacktestDateRange();       // 스냅샷 기준 날짜 범위 갱신
    return;
  }
  eventsBound = true;
  ["bucketFilter", "sectorFilter", "metricFilter", "tileSizeFilter"].forEach((id) => byId(id).addEventListener("change", renderTreemap));
  // 5천 타일 트리맵을 키 입력마다 다시 그리지 않도록 디바운스.
  byId("heatmapSearch").addEventListener("input", debounce(renderTreemap, 150));
  byId("resetFilters").addEventListener("click", () => {
    byId("bucketFilter").value = marketCfg().defaultBucket || "idx_sp500";
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
  ["scanBucket", "scanSector", "scanHorizon", "scanLimit", "scanDeep"].forEach((id) => {
    const el = byId(id);
    if (el) el.addEventListener("change", renderScanner);
  });
  const scanRefresh = byId("scanRefresh");
  if (scanRefresh) scanRefresh.addEventListener("click", renderScanner);
  // Sector tab sub-tab switching
  byId("sectorSubTabs").querySelectorAll(".sub-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      byId("sectorSubTabs").querySelectorAll(".sub-tab").forEach((b) => b.classList.remove("is-active"));
      document.querySelectorAll("#tab-sector .sub-panel").forEach((p) => p.classList.remove("is-active"));
      btn.classList.add("is-active");
      byId(`sub-${btn.dataset.sub}`).classList.add("is-active");
      closeConstituentPanel();
      if (btn.dataset.sub === "etf-rs") renderSectorEtfRelativeStrength();
      if (btn.dataset.sub === "etf-lev") ensureFeatureData("leveraged").then(() => renderLeveragedEtfPage());
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
  setupUiPrefs();
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
  setupCloudSyncEvents();
  setupKrDartEvents();
  setupKrOwnershipEvents();
  byId("heatmapShare")?.addEventListener("click", shareHeatmapLink);
  byId("pfExportCsv")?.addEventListener("click", exportPortfolioCsv);
  byId("backtestExportCsv")?.addEventListener("click", exportBacktestCsv);
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
    for (let j = i; j < rows.length; j += 1) {
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
    out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="${up ? "#22c55e" : "#ef4444"}" opacity="0.9"></circle>`;
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

function applyBuiltinOverlayPreset(key) {
  const preset = BUILTIN_OVERLAY_PRESETS[key];
  if (!preset) return;
  Object.assign(chartState, preset.settings);
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

// ===== 차트 상승확률 분석 (analysis.js 엔진 재사용) =====
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
      <span class="cprob-title">상승확률 분석</span>
      <div class="cprob-hz-group" role="group" aria-label="예측 기간">${btns}</div>
      <div class="cprob-hz-group" role="group" aria-label="패턴 통계 기준">${statsBtns}</div>
    </div>
    <div id="cprobChartControls"></div>`;
  return toolbar + window.MirProb.buildResultHTML(result);
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
  ["stop", "Stop"], ["tgt", "Tgt"], ["tgt2", "Tgt 2R"],
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
  host.innerHTML = `<div class="cprob-chart-toggle">
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
    </div>`;
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

// "상승확률 분석" 버튼: 이동평균선+지지/저항을 켜고, 엔진으로 확률을 계산해 패널에 표시.
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
  const builtinBar = byId("chartBuiltinPresets");
  if (builtinBar && !builtinBar.dataset.bound) {
    builtinBar.dataset.bound = "1";
    builtinBar.innerHTML = Object.entries(BUILTIN_OVERLAY_PRESETS).map(([k, p]) =>
      `<button type="button" class="ghost chart-builtin-preset" data-bpreset="${k}">${escapeHtml(p.label)}</button>`).join("");
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
}// TradingView-style: wheel=봉 확대/축소, pointer drag=봉 이동 (상승확률 분석 중에도 동작).
function setupChartInteractions() {
  const svg = byId("priceChart");
  if (!svg || svg.dataset.panBound) return;
  svg.dataset.panBound = "1";

  svg.addEventListener("wheel", (event) => {
    event.preventDefault();
    const g = priceChartGeom();
    const rect = svg.getBoundingClientRect();
    const vbX = ((event.clientX - rect.left) / rect.width) * g.width;
    const plotW = g.width - g.padL - g.padR;
    const frac = Math.max(0, Math.min(1, (vbX - g.padL) / plotW));
    zoomChartAt(frac, event.deltaY < 0 ? 1.2 : 1 / 1.2);
  }, { passive: false });

  let dragPointerId = null;
  let startX = 0;
  let startOffset = 0;
  let dragN = 0;
  let dragWindow = 0;
  let dragPlotPx = 1;

  const beginPan = (event) => {
    if (drawTool) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const item = currentChartItem();
    if (!item) return;
    dragPointerId = event.pointerId;
    chartPanActive = true;
    startX = event.clientX;
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
    endChartPan();
  };

  svg.addEventListener("pointerdown", beginPan);
  document.addEventListener("pointermove", movePan);
  document.addEventListener("pointerup", endPan);
  document.addEventListener("pointercancel", endPan);

  let touchMode = null;
  let pinchStartDist = 0;
  let pinchStartZoom = 1;
  const touchDist = (touches) => Math.hypot(
    touches[0].clientX - touches[1].clientX,
    touches[0].clientY - touches[1].clientY
  );

  svg.addEventListener("touchstart", (event) => {
    if (event.touches.length === 2) {
      touchMode = "pinch";
      dragPointerId = null;
      chartPanActive = false;
      pinchStartDist = touchDist(event.touches);
      pinchStartZoom = chartState.zoom;
    }
  }, { passive: true });

  svg.addEventListener("touchmove", (event) => {
    if (touchMode === "pinch" && event.touches.length === 2) {
      const dist = touchDist(event.touches);
      if (pinchStartDist > 0) setZoomAnchored(0.5, pinchStartZoom * (dist / pinchStartDist));
      event.preventDefault();
    }
  }, { passive: false });

  svg.addEventListener("touchend", (event) => {
    if (event.touches.length < 2) touchMode = null;
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
    const bucket = byId("bucketFilter").value;
    let emptyMsg = "조건에 맞는 종목이 없습니다.";
    if (bucket === "watchlist") emptyMsg = "관심종목이 없습니다. 종목 분석에서 를 눌러 관심종목에 추가해 보세요.";
    else if (bucket === "portfolio") emptyMsg = "보유종목이 없습니다. 포트폴리오 탭에서 보유 종목을 추가해 보세요.";
    map.innerHTML = `<div class="heatmap-empty">${escapeHtml(emptyMsg)}</div>`;
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
        <div class="sector-title" data-zoom-sector="${escapeHtml(sector.sector)}" title="클릭하면 ${escapeHtml(sector.sector)} 확대">${sector.sector} · ${fmtMetric(sector.change, metric)} </div>
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
      data-ticker="${item.ticker}"
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
        <b>${priceOrDash(item.price)}</b>
        <em class="${cls(item.changePct)}">${fmtDailyPct(item.changePct)}</em>
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
  if (metric.includes("Score") || metric === "stochK" || metric === "rsi14") {
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

// 감사의견 경고. 한국에서 '의견거절'·'한정'·'부적정' 은 상장폐지 사유라 가격보다 먼저
// 봐야 할 정보다. 실측(2,521종목): 비적정 47종목 — 금양·STX·삼부토건 등 지금도 거래 중.
// 강조사항(계속기업 불확실성 등)은 270종목(11%)이라 경고보다 한 단계 낮게 보여준다.
function auditOpinionNotice(item) {
  const book = window.KR_AUDIT_OPINION?.opinions;
  if (!book || !isKrMarket()) return "";
  const a = book[item?.ticker];
  if (!a) return "";
  if (a.adverse) {
    return `
      <p class="audit-notice audit-adverse">
        <b>감사의견 ${escapeHtml(a.opinion)}</b>
        <span>${escapeHtml(a.year)} · ${escapeHtml(a.auditor)} · 상장폐지 사유에 해당합니다</span>
      </p>`;
  }
  if (a.emphasis) {
    return `
      <p class="audit-notice audit-emphasis">
        <b>감사보고서 강조사항</b>
        <span>${escapeHtml(a.emphasis.slice(0, 120))}</span>
      </p>`;
  }
  return "";
}

// 수급·컨센서스 카드(국내 전용). 한국 투자자가 가장 많이 보는 숫자인데 이 사이트엔
// 시장 합계(브리핑)만 있고 종목별로는 없었다.
//
// 신호가 아니라 사실이다. validate_kr_flow.py 로 60거래일을 횡단면 검정했다 — 매일
// 수급으로 종목을 줄 세워 상위 10% 와 하위 10% 의 다음날 수익률 차이를 낸 결과:
//     외국인 t=+1.39 · 기관 t=-0.99  → 둘 다 무작위와 구분 안 됨
// 그래서 '누가 샀나'(사실)만 말하고 '그래서 오른다'(예측)로 팔지 않는다.
//
// 컨센서스 목표주가는 뺐다(아래 return 문 위 주석 참고). 검증이 불가능한 데다,
// 네이버가 주는 목표가 자체가 네이버의 현재가와 모순됐다.
function krFlowCard(item) {
  const book = window.KR_INVESTOR_FLOW?.stocks;
  if (!book || !isKrMarket()) return "";
  const f = book[item?.ticker];
  if (!f) return "";

  const shares = (v) => {
    if (!Number.isFinite(v)) return "-";
    const s = v < 0 ? "-" : "+";
    const a = Math.abs(v);
    if (a >= 1e8) return `${s}${(a / 1e8).toFixed(1)}억주`;
    if (a >= 1e4) return `${s}${Math.round(a / 1e4).toLocaleString()}만주`;
    return `${s}${Math.round(a).toLocaleString()}주`;
  };
  const cls = (v) => (Number.isFinite(v) ? (v > 0 ? "pos" : v < 0 ? "neg" : "") : "");
  // 순매수 '수량' 만 보면 종목 간 비교가 안 된다 — 삼성전자 100만주와 소형주 100만주는
  // 전혀 다른 얘기다. 20일 거래량 대비 몇 %인지를 같이 보여준다.
  const pct = (v) => (Number.isFinite(v) ? `${v > 0 ? "+" : ""}${v.toFixed(1)}%` : "-");
  const row = (label, v5, v20, ratio) => `
    <tr>
      <th>${label}</th>
      <td class="${cls(v5)}">${shares(v5)}</td>
      <td class="${cls(v20)}">${shares(v20)}</td>
      <td class="${cls(ratio)}">${pct(ratio)}</td>
    </tr>`;

  // 컨센서스 목표주가는 싣지 않는다. 네이버가 주는 목표가가 네이버 자신의 현재가와
  // 안 맞는다 — 삼성전자 255,000원에 목표가 513,958원(2.0배), 콘텐트리중앙 1,493원에
  // 11,875원(8.0배). 배율이 종목마다 달라 단위 착오도 아니다. 550종목 중 목표가가
  // 현재가보다 낮은 건 1% 뿐이고 괴리율 중앙값이 +71.7% 였다(실제 국내 시장은 +20~30%대).
  // 설명도 보정도 못 하는 수치를 '상승여력' 으로 보여주면 그건 지어낸 것과 같다.
  return `
    <div class="krflow-card">
      <div class="krflow-head">
        <b>수급</b>
        ${Number.isFinite(f.hold) ? `<span class="muted">외국인 보유율 ${f.hold}%</span>` : ""}
        ${f.asOf ? `<span class="muted">· ${escapeHtml(String(f.asOf).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"))} 기준</span>` : ""}
      </div>
      <table class="krflow-table">
        <thead><tr><th></th><th>5일</th><th>20일</th><th>거래량 대비</th></tr></thead>
        <tbody>
          ${row("외국인", f.f5, f.f20, f.fPct)}
          ${row("기관", f.o5, f.o20, f.oPct)}
          ${row("개인", f.i5, f.i20, null)}
        </tbody>
      </table>
      <p class="krflow-note">누가 샀는지를 보여줄 뿐, 다음날 주가와는 무관합니다
         — 외국인·기관 순매수 상위 10%와 하위 10%의 다음날 수익률은 무작위와 구분되지
         않았습니다(60거래일 검정).</p>
    </div>`;
}

function stockFacts(item, title) {
  const isSearchPanel = title === "Search Ticker";
  return `
    <span class="muted">${title}</span>
    <h3 class="stock-facts-head">${watchStarButton(item.ticker)} ${item.ticker} ${syntheticBadge(item)}</h3>
    <p class="muted">${item.company} · ${item.sector} · ${item.industry}</p>
    ${auditOpinionNotice(item)}
    ${krFlowCard(item)}
    <div class="facts">
      ${fact("가격", priceOrDash(item.price))}
      ${fact("당일", `<span class="${cls(item.changePct)}">${fmtDailyPct(item.changePct)}</span>`)}
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
    
    if (isKrMarket()) {
      const t = meta.ticker;
      if (t === "069500") return (stock.groups || []).includes("idx_kospi200");
      if (t === "091160") return ind.includes("반도체");
      if (t === "091170") return ind.includes("은행");
      if (t === "091180") return ind.includes("자동차");
      if (t === "305720") return ind.includes("2차전지");
      if (t === "244580") return ind.includes("바이오") || ind.includes("제약") || ind.includes("헬스케어");
      return false;
    }
    
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
  const groups = getSectorEtfs().map((meta) => {
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
                <span class="change ${cls(stock.changePct)}">${fmtDailyPct(stock.changePct)}</span>
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
  const meta = getSectorEtfs().find((item) => item.ticker === selectedSectorEtf) || getSectorEtfs()[0];
  // Keep the selection in sync with the resolved ETF so the comparison chart/legend
  // use the current market's ETF (e.g. KR 069500) instead of a stale default (XLK).
  if (meta && meta.ticker) selectedSectorEtf = meta.ticker;
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
      <td>${marketCfg().formatPrice(stock.price)}</td>
      <td class="${cls(stock.changePct)}">${fmtDailyPct(stock.changePct)}</td>
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
  const meta = getSectorEtfs().find((m) => m.ticker === sectorTicker);
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
  // #sectorComparisonChart 는 고정 SVG 라 렌더마다 addEventListener 를 쓰면 옛 시리즈를
  // 물고 있는 핸들러가 계속 쌓인다. on* 속성 할당은 이전 핸들러를 대체한다.
  svg.onmousemove = ((event) => {
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
      <div class="item"><span style="width:120px;display:inline-block">${sectorTicker}:</span><b>${closestPoint.r >= 0 ? "+" : ""}${closestPoint.r.toFixed(2)}%</b></div>
      <div class="item"><span style="width:120px;display:inline-block">${benchmarkTicker}:</span><b>${benchmarkPoint.r >= 0 ? "+" : ""}${benchmarkPoint.r.toFixed(2)}%</b></div>
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
  
  svg.onmouseleave = (() => {
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
    minMarketCap ? (isKrMarket() ? `시총 >= ${minMarketCap}조` : `MktCap >= $${minMarketCap}B`) : ""
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
        ${miniMetric("당일", `<span class="${cls(item.changePct)}">${fmtDailyPct(item.changePct)}</span>`)}
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

// ===== 상승확률 스캐너 =====
// 전 종목을 스냅샷 지표(추세·모멘텀·상대강도·거래량 등)로 빠르게 점수화해 상승확률 순위를 매기고,
// "정밀 분석" 옵션을 켜면 화면에 보이는 상위 종목만 5년 일봉을 받아 차트 확률 엔진(window.MirProb)으로 재계산한다.
let scannerRunId = 0;

const scanMean = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0);
const scanClamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const scanTanh = (x) => Math.tanh(x);

function scanHorizonLabel(h) {
  return ({ 1: "1일", 3: "3일", 5: "1주", 10: "2주", 20: "1개월", 60: "3개월" })[h] || `${h}거래일`;
}

function scanRsiBias(rsi) {
  if (!Number.isFinite(rsi)) return 0;
  if (rsi >= 70) return 0.25;   // 과매수: 추세는 강하나 과열
  if (rsi >= 55) return 0.7;
  if (rsi >= 50) return 0.35;
  if (rsi >= 40) return -0.3;
  if (rsi >= 30) return -0.55;
  return 0.15;                  // 과매도: 반등 여지
}

function scanSeriesBias(series) {
  const v = (Array.isArray(series) ? series : []).map(Number).filter(Number.isFinite);
  if (v.length < 20) return 0;
  const last = v[v.length - 1];
  const smaShort = scanMean(v.slice(-5));
  const smaLong = scanMean(v.slice(-20));
  let b = 0;
  b += smaShort > smaLong ? 0.5 : -0.5;        // 단기 > 장기 이평
  b += last > smaShort ? 0.25 : -0.25;         // 단기 이평 위/아래
  const ref = v[v.length - 10] || last || 1;   // 최근 10봉 기울기
  const slope = (last - ref) / Math.abs(ref || 1);
  b += scanClamp(slope * 5, -0.5, 0.5);
  return scanClamp(b, -1, 1);
}

const SCAN_MOMENTUM_LOOKBACK_3M = 39;

function periodChangeFromSeries(series, periods) {
  const vals = (Array.isArray(series) ? series : []).map(Number).filter(Number.isFinite);
  if (vals.length < 2) return null;
  const idx = Math.min(Math.max(1, periods), vals.length - 1);
  const last = vals[vals.length - 1];
  const ref = vals[vals.length - 1 - idx];
  if (!Number.isFinite(ref) || ref === 0) return null;
  return ((last - ref) / Math.abs(ref)) * 100;
}

function enrichScanMomentum(item) {
  if (!item || typeof item !== "object") return item;
  const series = item.closeSeries;
  if (!Array.isArray(series) || series.length < 20) return item;
  const patch = {};
  if (!Number.isFinite(item.threeMonthChangePct)) {
    const pct = periodChangeFromSeries(series, SCAN_MOMENTUM_LOOKBACK_3M);
    if (Number.isFinite(pct)) patch.threeMonthChangePct = Math.round(pct * 10) / 10;
  }
  if (!Number.isFinite(item.monthChangePct)) {
    const pct = periodChangeFromSeries(series, 21);
    if (Number.isFinite(pct)) patch.monthChangePct = Math.round(pct * 10) / 10;
  }
  return Object.keys(patch).length ? { ...item, ...patch } : item;
}

// 스냅샷 지표만으로 빠르게 추정하는 상승확률(12~88%).
function scanQuickProb(item, horizon) {
  item = enrichScanMomentum(item);
  // 예측 기간에 따라 단기/장기 신호 가중을 조절한다.
  const shortW = horizon <= 5 ? 1.4 : horizon >= 60 ? 0.5 : 0.9;
  const longW = horizon >= 60 ? 1.5 : horizon <= 5 ? 0.7 : 1.1;
  const signals = [];
  const push = (bias, weight) => { if (Number.isFinite(bias)) signals.push([bias, weight]); };

  if (Number.isFinite(item.rsScore)) push(scanClamp((item.rsScore - 50) / 45, -1, 1), 1.4);
  if (Number.isFinite(item.epsRevScore)) push(scanClamp((item.epsRevScore - 50) / 45, -1, 1), 1.0);
  if (Number.isFinite(item.threeMonthChangePct)) push(scanTanh(item.threeMonthChangePct / 15), 1.2 * longW);
  if (Number.isFinite(item.monthChangePct)) push(scanTanh(item.monthChangePct / 8), 0.9);
  if (Number.isFinite(item.weekChangePct)) push(scanTanh(item.weekChangePct / 4), 0.6 * shortW);
  push(scanRsiBias(Number(item.rsi14)), 0.7 * shortW);
  if (Number.isFinite(item.stochK)) push(scanClamp((item.stochK - 50) / 45, -1, 1) * 0.8, 0.4 * shortW);

  // 거래량 확인: 추세 방향과 거래량 증가가 같은 방향이면 강화
  const trendSign = Math.sign(Number(item.monthChangePct) || Number(item.weekChangePct) || 0);
  if (Number.isFinite(item.volumeRatio) && trendSign !== 0) {
    push(trendSign * scanClamp((item.volumeRatio - 1) / 1.5, -0.5, 1), 0.5);
  }
  // 신고가 근접도(고점 대비 하락폭이 작을수록 강세)
  const dist = Number(item.newHighDistancePct);
  if (Number.isFinite(dist)) push(scanClamp((10 - dist) / 10, -0.3, 1), 0.5);
  // 종가 시계열 구조(이평 정배열·기울기)
  push(scanSeriesBias(item.closeSeries), 0.8);

  const totW = signals.reduce((s, [, w]) => s + w, 0) || 1;
  const z = signals.reduce((s, [b, w]) => s + b * w, 0) / totW;  // -1 ~ 1
  const up = scanClamp(50 + 38 * z, 12, 88);
  return { up, z };
}

function scanVerdict(up) {
  if (window.MirProb && window.MirProb.verdictText) return window.MirProb.verdictText(up);
  if (up >= 60) return "상승 우위";
  if (up <= 40) return "하락 우위";
  return "중립";
}

function scanProbColor(up) {
  if (up >= 60) return "var(--pos, #138a4d)";
  if (up <= 40) return "var(--neg, #c03535)";
  return "var(--amber, #b7791f)";
}

function scanBadgeText(mode) {
  return mode === "deep" ? "정밀" : mode === "loading" ? "분석중" : "빠른";
}

function scanCardHtml(entry, rank) {
  const item = entry.item;
  const up = Math.round(entry.prob);
  const color = scanProbColor(entry.prob);
  const spark = sparklineSvg(item.closeSeries, { width: 240, height: 56, color: (item.changePct || 0) >= 0 ? "#22c55e" : "#ef4444" });
  return `
    <article class="stock-card scanner-card" data-ticker="${escapeHtml(item.ticker)}">
      <div class="rank-line">
        <span>${rank}</span>
        <strong>${escapeHtml(item.ticker)}</strong>
        <em class="scan-badge scan-badge-${entry.mode}">${scanBadgeText(entry.mode)}</em>
      </div>
      <p class="muted">${escapeHtml(item.company || "")}</p>
      <div class="scan-prob">
        <div class="scan-prob-head"><span>상승확률</span><b style="color:${color}">${up}%</b></div>
        <div class="scan-prob-bar"><div class="scan-prob-fill" style="width:${up}%;background:${color}"></div></div>
        <div class="scan-verdict">${scanVerdict(entry.prob)}</div>
      </div>
      <div class="scanner-spark">${spark}</div>
      <div class="mini-facts">
        ${miniMetric("당일", `<span class="${cls(item.changePct)}">${fmtDailyPct(item.changePct)}</span>`)}
        ${miniMetric("RS", Number.isFinite(item.rsScore) ? item.rsScore : "—")}
        ${miniMetric("RSI", Number.isFinite(item.rsi14) ? item.rsi14 : "—")}
        ${miniMetric("거래량", `${Number(item.volumeRatio || 0).toFixed(1)}x`)}
      </div>
    </article>`;
}

function renderScannerCards(entries) {
  const grid = byId("scannerCards");
  if (!grid) return;
  const sorted = entries.slice().sort((a, b) => b.prob - a.prob);
  grid.innerHTML = sorted.map((entry, i) => scanCardHtml(entry, i + 1)).join("");
  grid.querySelectorAll(".scanner-card").forEach((card) => {
    card.addEventListener("click", () => selectTicker(card.dataset.ticker, { openSearch: true }));
  });
}

function updateScanCardInPlace(entry) {
  const grid = byId("scannerCards");
  if (!grid) return;
  const card = grid.querySelector(`.scanner-card[data-ticker="${escapeHtml(entry.item.ticker)}"]`);
  if (!card) return;
  const up = Math.round(entry.prob);
  const color = scanProbColor(entry.prob);
  const b = card.querySelector(".scan-prob-head b");
  if (b) { b.textContent = `${up}%`; b.style.color = color; }
  const fill = card.querySelector(".scan-prob-fill");
  if (fill) { fill.style.width = `${up}%`; fill.style.background = color; }
  const v = card.querySelector(".scan-verdict");
  if (v) v.textContent = scanVerdict(entry.prob);
  const badge = card.querySelector(".scan-badge");
  if (badge) { badge.textContent = scanBadgeText(entry.mode); badge.className = `scan-badge scan-badge-${entry.mode}`; }
}

async function deepAnalyzeEntry(entry, horizon) {
  try {
    const detail = await loadStockDetail(entry.item.ticker);
    const series = detail && Array.isArray(detail.chartSeries) ? detail.chartSeries : null;
    if (!series || series.length < 60) { entry.mode = "quick"; return; }
    const rows = series.map((r) => ({ o: r[0], h: r[1], l: r[2], c: r[3], v: r[4] || 0, d: r[5] }));
    const res = window.MirProb.analyzeRows(rows, horizon, { ticker: entry.item.ticker, company: entry.item.company });
    if (res && Number.isFinite(res.headlineUp)) {
      entry.prob = res.headlineUp;
      entry.mode = "deep";
    } else {
      entry.mode = "quick";
    }
  } catch (e) {
    entry.mode = "quick";
  }
}

async function runDeepScan(entries, horizon, runId) {
  try { await window.MirProb.ensureStats(); } catch (e) { /* 통계 없어도 진행 */ }
  try { await ensureAnalysisFeatureData(); } catch (e) { /* 신호 데이터 없어도 진행 */ }
  if (runId !== scannerRunId) return;
  const queue = entries.slice();
  const CONCURRENCY = 5;
  let idx = 0, active = 0, done = 0;
  await new Promise((resolve) => {
    const pump = () => {
      if (runId !== scannerRunId) return resolve();
      if (done >= queue.length) return resolve();
      while (active < CONCURRENCY && idx < queue.length) {
        const entry = queue[idx++];
        active++;
        entry.mode = "loading";
        updateScanCardInPlace(entry);
        deepAnalyzeEntry(entry, horizon).then(() => {
          if (runId === scannerRunId) updateScanCardInPlace(entry);
        }).finally(() => {
          active--; done++;
          pump();
        });
      }
    };
    pump();
  });
  if (runId !== scannerRunId) return;
  renderScannerCards(entries);  // 정밀 확률 기준으로 최종 재정렬
  const meta = byId("scannerMeta");
  if (meta) meta.textContent = meta.textContent.replace(/· 정밀 분석 적용 중…$/, "· 정밀 분석 완료");
}

function renderScanner() {
  const bucketEl = byId("scanBucket");
  if (!bucketEl) return;
  const bucket = bucketEl.value;
  const sector = byId("scanSector").value;
  const horizon = Number(byId("scanHorizon").value) || 20;
  const limit = Math.max(1, Number(byId("scanLimit").value) || 24);
  const deep = byId("scanDeep").checked;
  const runId = ++scannerRunId;  // 진행 중이던 이전 정밀 분석은 무효화

  const scored = data.stocks
    .filter((item) => bucketMatches(item, item.groups || [item.bucket].filter(Boolean), bucket))
    .filter((item) => sector === "All" || item.sector === sector)
    .filter((item) => bucket === "watchlist" || bucket === "portfolio" || !isStockEtf(item))
    // 합성 이력에서 뽑은 확률은 랜덤워크의 성질일 뿐이다. 순위 자체가 무의미하므로 제외한다.
    .filter((item) => !isSyntheticHistory(item))
    .filter((item) => Array.isArray(item.closeSeries) && item.closeSeries.length >= 20)
    .map((item) => ({ item, prob: scanQuickProb(item, horizon).up, mode: "quick" }))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, limit);

  const scope = labelForSelect("scanBucket");
  const meta = byId("scannerMeta");
  if (meta) {
    meta.textContent = `${scope} · ${sector} · ${scanHorizonLabel(horizon)} · 상위 ${scored.length}개`
      + (deep && window.MirProb ? " · 정밀 분석 적용 중…" : " · 빠른 스캔");
  }

  if (!scored.length) {
    byId("scannerCards").innerHTML = `<article class="rank-card"><h3>분석할 종목이 없습니다.</h3><p class="muted">대상 범위나 섹터를 바꿔보세요.</p></article>`;
    return;
  }

  renderScannerCards(scored);
  if (deep && window.MirProb) runDeepScan(scored, horizon, runId);
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
  byId("topBucket").value = marketCfg().defaultBucket || "idx_sp500";
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
  if (preset === "volsurge") return Number(item.volumeRatio) >= 3;
  if (preset === "oversold") { const r = Number(item.rsi14); return Number.isFinite(r) && r <= 30; }
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
  if (metric === "changePct") return fmtDailyPct(value);
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
      <p><strong class="${cls(item.changePct)}">${fmtDailyPct(item.changePct)}</strong> · Vol ${item.volumeRatio.toFixed(1)}x</p>
      <p>RS ${item.rsScore} · EPS ${item.epsRevScore}</p>
    </article>
  `).join("");

  byId("jumpGrid").querySelectorAll(".jump-stock-card").forEach((card) => {
    card.addEventListener("click", () => selectTicker(card.dataset.ticker, { openSearch: true }));
  });
}

function createLiveSearchStub(resolved) {
  if (!resolved || !LIVE_DATA_PROXY) return null;
  if (isKrMarket()) {
    if (!/^\d{6}$/.test(resolved)) return null;
  } else if (!/^[A-Z][A-Z0-9._-]{0,11}$/.test(resolved)) {
    return null;
  }
  return {
    ticker: resolved,
    company: resolved,
    price: 0,
    changePct: 0,
    sector: "-",
    bucket: "live",
    groups: ["live"],
    historySource: "yahoo",
    __liveStub: true,
  };
}

function selectTicker(ticker, options = {}) {
  const resolved = normalizeTickerKey(resolveTickerQuery(ticker) || String(ticker || "").trim());
  let found = data.stocks.find((item) => normalizeTickerKey(item.ticker) === resolved);
  if (!found) found = createLiveSearchStub(resolved);
  if (!found) return;
  if (found.ticker !== selectedTicker) scoreHelpOpen = null;
  if (found.ticker !== selectedTicker) moveAnalysisState = null;
  selectedTicker = found.ticker;
  byId("tickerSearch").value = selectedTicker;
  renderTreemap();
  renderSearch(options);
  chatFocusTicker = found.ticker;
  if (options.openSearch !== false) {
    if (currentTab !== "search" || searchSubTab !== "analysis") {
      activateTab("search", { sub: "analysis", ticker: selectedTicker, push: true });
    } else {
      history.replaceState({ tab: "search", sub: "analysis", ticker: selectedTicker }, "");
    }
  }
}

function renderSearch(options = {}) {
  const base = data.stocks.find((row) => row.ticker === selectedTicker) || data.stocks[0];
  const item = applyLive(withDetail(base));
  // 감사의견은 종목 헤더에 경고로 나가므로 여기서 챙긴다. 늦게 와도 목록·차트는
  // 그대로 나오고, 도착하면 헤더만 다시 그린다.
  if (isKrMarket() && !window.KR_AUDIT_OPINION) {
    ensureFeatureData("krAudit").then((ok) => {
      if (ok && selectedTicker === base.ticker) {
        const el = byId("searchFacts");
        if (el) el.innerHTML = stockFacts(applyLive(withDetail(base)), "Search Ticker");
      }
    });
  }
  byId("chartTitle").textContent = `${item.ticker} · ${item.company}`;
  byId("searchFacts").innerHTML = stockFacts(item, "Search Ticker");
  drawChart(item);
  renderEarningsCalendar(item);
  renderCongressTradesForTicker(item);
  renderSmartMoney(item);
  renderMoveExplanation(item);
  renderInvestmentChecklist(item);
  renderEstimateRevision(item);
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
    renderEstimateRevision(refreshed);
    render52wRange(refreshed);
    renderStockEvents(refreshed);
    renderEarningsReaction(refreshed);
    renderDataQualityPanel(refreshed);
    renderFundamentals(refreshed);
    renderNews(refreshed);
  });

  // If not triggered via natural language AI search, instantly reveal dashboard components.
  if (!options.fromAiSearch) {
    document.querySelectorAll(".animate-reveal").forEach((card) => {
      card.classList.add("reveal-active");
    });
  }

  // Auto-load the AI report only when the analysis view is actually being viewed.
  // renderSearch also runs during the boot pre-render (map tab active) and as the
  // first of selectTicker's two render passes — firing here would waste an LLM /chat
  // call on every visit and force-load the heavy 13F/insider/congress datasets.
  // The natural-language search path issues its own loadAiDeepReport with a custom query.
  if (currentTab === "search" && !options.fromAiSearch) loadAiDeepReport(item.ticker);
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
  evidence.push(moveEvidenceRow("시장", `${item.sector} 대비 ${relative >= 0 ? "강함" : "약함"}`, `종목 ${fmtDailyPct(change)} · 섹터 평균 ${fmtPct(sectorAvg)} · 차이 ${relative >= 0 ? "+" : ""}${relative.toFixed(1)}%p`, { icon: "M", tone: relative >= 0 ? "pos" : "neg" }));

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
      <strong class="${cls(change)}">${fmtDailyPct(change)}</strong>
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
    { label: "수급", status: flowPass ? "pass" : flowWarn ? "warn" : "check", detail: `거래량 ${volume.toFixed(1)}배${isKrMarket() ? "" : ` · 내부자 매수 ${buys} / 매도 ${sells}`}` },
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

function loadEstimateHistoryStore() {
  if (estimateHistoryStore) return estimateHistoryStore;
  try { estimateHistoryStore = JSON.parse(localStorage.getItem(ESTIMATE_HISTORY_STORAGE_KEY) || "{}") || {}; }
  catch (_) { estimateHistoryStore = {}; }
  return estimateHistoryStore;
}

function currentEstimateSnapshot(item) {
  const f = item.fundamentals || (window.MAP_FUNDAMENTALS || {})[item.ticker] || {};
  const firstFinite = (...values) => {
    for (const value of values) {
      if (value == null || value === "") continue;
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  };
  return {
    date: formatKstDateTime().slice(0, 10),
    savedAt: Date.now(),
    epsScore: firstFinite(item.epsRevScore),
    epsNextQ: firstFinite(f.epsNextQ, item.epsNextQ),
    epsNextY: firstFinite(f.epsNextY, item.epsNextY),
    revenueNextQ: firstFinite(f.revenueEstimateNextQ, f.revenueNextQ, item.revenueEstimateNextQ),
    revenueNextY: firstFinite(f.revenueEstimateNextY, f.revenueNextY, item.revenueEstimateNextY),
    targetPrice: firstFinite(f.targetPrice, item.targetPrice),
  };
}

function recordEstimateSnapshot(item) {
  const store = loadEstimateHistoryStore();
  const snapshot = currentEstimateSnapshot(item);
  const hasEstimate = [snapshot.epsScore, snapshot.epsNextQ, snapshot.epsNextY, snapshot.revenueNextQ, snapshot.revenueNextY, snapshot.targetPrice].some(Number.isFinite);
  if (!hasEstimate) return [];
  const rows = Array.isArray(store[item.ticker]) ? store[item.ticker] : [];
  const index = rows.findIndex((row) => row.date === snapshot.date);
  if (index >= 0) rows[index] = snapshot;
  else rows.push(snapshot);
  rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  store[item.ticker] = rows.slice(-45);
  try { localStorage.setItem(ESTIMATE_HISTORY_STORAGE_KEY, JSON.stringify(store)); } catch (_) { /* ignore */ }
  return store[item.ticker];
}

function estimateBaseline(rows, days) {
  const cutoff = Date.now() - days * 86400000;
  const eligible = rows.filter((row) => {
    const time = Number(row.savedAt) || new Date(`${row.date}T00:00:00`).getTime();
    return Number.isFinite(time) && time <= cutoff;
  });
  return eligible.length ? eligible[eligible.length - 1] : null;
}

function estimateValue(value, kind) {
  if (!Number.isFinite(Number(value))) return "-";
  const number = Number(value);
  if (kind === "score") return `${Math.round(number)}점`;
  if (kind === "revenue") return isKrMarket() ? fmtFinancialB(number / 10) : `$${fmtCompact(number)}`;
  return marketCfg().formatMoney(number);
}

function estimateChange(current, baseline, kind) {
  if (!Number.isFinite(Number(current)) || !Number.isFinite(Number(baseline))) return { text: "기준 부족", tone: "muted" };
  const now = Number(current);
  const before = Number(baseline);
  if (kind === "score") {
    const points = now - before;
    return { text: `${points > 0 ? "+" : ""}${points.toFixed(0)}점`, tone: cls(points) };
  }
  if (before === 0) return { text: "비교 불가", tone: "muted" };
  const pct = (now / before - 1) * 100;
  return { text: `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`, tone: cls(pct) };
}

function renderEstimateRevision(item) {
  const box = byId("estimateRevisionCard");
  if (!box || !item) return;
  const rows = recordEstimateSnapshot(item);
  const current = rows[rows.length - 1] || currentEstimateSnapshot(item);
  const week = estimateBaseline(rows, 7);
  const month = estimateBaseline(rows, 30);
  const metrics = [
    { key: "epsScore", label: "EPS 추정 점수", kind: "score" },
    { key: "epsNextQ", label: "다음 분기 EPS", kind: "money" },
    { key: "epsNextY", label: "향후 1년 EPS", kind: "money" },
    { key: "revenueNextQ", label: "다음 분기 매출", kind: "revenue", optional: true },
    { key: "revenueNextY", label: "향후 1년 매출", kind: "revenue", optional: true },
    { key: "targetPrice", label: "평균 목표가", kind: "money" },
  ].filter((metric) => !metric.optional || Number.isFinite(current[metric.key]));
  const historyDays = rows.length > 1 ? Math.round((Date.now() - (Number(rows[0].savedAt) || Date.now())) / 86400000) : 0;
  box.innerHTML = `
    <div class="estimate-revision-head">
      <div><span>ESTIMATE TREND</span><h3>실적 추정치 변화</h3></div>
      <strong>${escapeHtml(item.ticker)} · ${historyDays ? `${historyDays}일 추적` : "오늘부터 추적"}</strong>
    </div>
    <div class="estimate-revision-grid">
      ${metrics.map((metric) => {
        const weekChange = estimateChange(current[metric.key], week?.[metric.key], metric.kind);
        const monthChange = estimateChange(current[metric.key], month?.[metric.key], metric.kind);
        return `<article><span>${escapeHtml(metric.label)}</span><strong>${estimateValue(current[metric.key], metric.kind)}</strong><div><em class="${weekChange.tone}">7일 ${weekChange.text}</em><em class="${monthChange.tone}">30일 ${monthChange.text}</em></div></article>`;
      }).join("")}
    </div>
    <p>이 브라우저가 확인한 일별 값을 최대 45일간 저장합니다. 매출 컨센서스는 원본 데이터가 제공되는 종목에만 표시됩니다.</p>`;
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
  // 내부자·의회·기관(13F)·행동주의는 미국 전용 데이터라 KR 종목엔 항상 비어 있다 → 패널 숨김.
  if (isKrMarket()) { el.hidden = true; el.innerHTML = ""; return; }
  el.hidden = false;
  const t = item.ticker;
  const ins = ((window.INSIDER_TRADES || {}).trades || []).filter((r) => r.ticker === t);
  const insBuy = ins.filter((r) => r.kind === "buy").length;
  const insSell = ins.filter((r) => r.kind === "sell").length;
  const cg = ((window.CONGRESS_TRADES || {}).byTicker || {})[t];
  const f = inst13fIndex()[t];
  const act = ((window.ACTIVIST_STAKES || {}).filings || []).filter((r) => r.ticker === t);

  if (!(ins.length || cg || f || act.length)) {
    el.innerHTML = `<h3>스마트머니 종합</h3><p class="muted">이 종목에 대한 내부자·의회·기관·대량보유 신호가 없습니다.</p>`;
    return;
  }
  const row = (label, val, tone) => `<div class="sm-row"><span>${label}</span><strong${tone ? ` class="${tone}"` : ""}>${val}</strong></div>`;
  const insTone = insBuy > insSell ? "ins-buy" : insSell > insBuy ? "ins-sell" : "";
  el.innerHTML = `
    <h3>스마트머니 종합 · ${escapeHtml(t)}</h3>
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
  // KR keeps the build's curated Korean (Naver) headlines unless the live proxy
  // also returns Naver news (worker updated) — then we prefer the fresher live
  // headlines + Korean summary. If the proxy still serves English Yahoo news
  // (older worker), we ignore it so it never overwrites the better Korean news.
  const krMode = isKrMarket();
  const allowLiveNews = !krMode || liveNewsSourceCache[item.ticker] === "naver";
  if (Array.isArray(news) && news.length && allowLiveNews) out.news = news;
  if (earnings) out.liveEarnings = earnings;
  const summary = liveSummaryCache[item.ticker];
  if (typeof summary === "string" && summary.trim() && allowLiveNews) out.newsSummary = summary.trim();
  return out;
}

// On opening an analysis page, fetch live news + real chart from the proxy (if set).
function maybeFetchLiveData(base) {
  if (!LIVE_DATA_PROXY || !base) return;
  const ticker = base.ticker;
  if (liveFetched[ticker]) return;
  liveFetched[ticker] = true;
  // KR uses curated Naver news from the build; don't flash a "loading" state over it.
  if (!isKrMarket()) setNewsLoading();
  const endpoint = `${LIVE_DATA_PROXY.replace(/\/$/, "")}/?ticker=${encodeURIComponent(liveProxyTicker(base))}`;
  fetch(endpoint, { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .then((payload) => {
      if (!payload) return;
      if (Array.isArray(payload.news)) liveNewsCache[ticker] = payload.news;
      if (typeof payload.newsSource === "string") liveNewsSourceCache[ticker] = payload.newsSource;
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
      renderEstimateRevision(merged);
    })
    .catch(() => {
      liveDone[ticker] = true;
      if (selectedTicker === ticker) {
        const merged = applyLive(withDetail(base));
        renderNews(merged);
        renderMoveExplanation(merged);
        renderInvestmentChecklist(merged);
        renderEstimateRevision(merged);
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

// 스냅샷 종목의 가격 이력이 합성인지. update_data.py 는 상위 MAX_REAL_HISTORY
// 종목만 야후 실이력을 받고 나머지는 synthetic_history() 로 랜덤워크를 만든다
// (끝점만 실제가에 맞춘다). 그래서 이 종목들은 price/changePct 외에
// weekChangePct·monthChangePct·ytdChangePct·rsi14·stochK·newHighDistancePct·
// closeSeries 가 전부 합성이다. 순위를 매기거나 추천하는 화면에서는 제외하고,
// 값을 그대로 보여주는 화면에서는 배지로 알린다.
function isSyntheticHistory(item) {
  return !!item && item.historySource !== "yahoo";
}

function syntheticBadge(item) {
  if (!isSyntheticHistory(item)) return "";
  return `<span class="synth-badge" title="야후 실시간 가격 이력이 없어 이력 기반 지표(1개월·StochK·신고가 거리 등)는 추정값입니다. 가격과 당일 등락률은 실제입니다.">추정</span>`;
}

function renderNews(item) {
  const box = byId("searchNews");
  if (!box) return;
  const news = Array.isArray(item.news) ? item.news : [];
  const estimate = isSyntheticChart(item)
    ? `<p class="news-note">실시간 야후 가격 이력이 없어 차트는 <strong>추정(합성) 차트</strong>입니다. 데이터 갱신 시 실제 차트로 채워집니다.</p>`
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
        <div class="news-summary-head">한국어 요약</div>
        ${paras.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
      </div>
    `;
  }
  // Show "generating" only while the live fetch is still in flight (US only — the
  // KR proxy summary is built from English news, so we don't surface it).
  if (LIVE_DATA_PROXY && !liveDone[item.ticker] && !isKrMarket()) {
    return `
      <div class="news-summary is-pending">
        <div class="news-summary-head">한국어 요약</div>
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
  if (isKrMarket()) return normalizeTickerKey(ticker);
  const safe = String(ticker || "").toUpperCase().replace(/[^A-Z0-9._-]/g, "_");
  const root = safe.split(".")[0];
  const reserved = new Set(["CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"]);
  return reserved.has(root) ? `_${safe}` : safe;
}

async function fetchLiveDetailForTicker(ticker) {
  if (!LIVE_DATA_PROXY || !ticker) return null;
  const base = stockByTicker(ticker) || { ticker };
  const endpoint = `${LIVE_DATA_PROXY.replace(/\/$/, "")}/?ticker=${encodeURIComponent(liveProxyTicker(base))}`;
  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) return null;
    const payload = await response.json();
    if (!Array.isArray(payload.chart) || !payload.chart.length) return null;
    const normalized = normalizeTickerKey(ticker);
    return {
      ticker: normalized,
      name: payload.name || normalized,
      company: payload.name || normalized,
      chartSeries: payload.chart,
      historySource: "yahoo",
      __liveGenerated: true,
    };
  } catch {
    return null;
  }
}

window.MirLiveDetail = {
  get proxyUrl() { return LIVE_DATA_PROXY; },
  fetch: fetchLiveDetailForTicker,
};

function loadStockDetail(ticker) {
  const key = safeTicker(ticker);
  if (!key) return Promise.resolve(null);
  if (detailCache[key]) return Promise.resolve(detailCache[key]);
  if (detailPromises[key]) return detailPromises[key];
  const detailUrl = (window.MirMarket && window.MirMarket.detailPath(key)) || `data/details/${encodeURIComponent(key)}.json`;
  detailPromises[key] = fetch(detailUrl, { cache: "no-cache" })
    .then((response) => (response.ok ? response.json() : null))
    .then(async (detail) => {
      if (detail) {
        detailCache[key] = detail;
        if (ticker && ticker !== key) detailCache[ticker] = detail;
        return detail;
      }
      const live = await fetchLiveDetailForTicker(ticker);
      if (live) {
        detailCache[key] = live;
        if (ticker && ticker !== key) detailCache[ticker] = live;
        liveChartCache[ticker] = live.chartSeries;
        liveDone[ticker] = true;
      }
      return live;
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

function chartPriceLabel(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  const text = Math.round(n).toLocaleString(isKrMarket() ? "ko-KR" : undefined, { maximumFractionDigits: 0 });
  return isKrMarket() ? text : `$${text}`;
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
    return `<line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" class="chart-grid"></line><text x="${width - 8}" y="${y + 4}" class="chart-axis" text-anchor="end">${chartPriceLabel(value)}</text>`;
  }).join("");
  const overlayYFor = (value) => yFor(Math.max(min, Math.min(max, value)));

  // 지표 계산용 컨텍스트(보이는 구간 + 앞쪽 이력). 보이는 rows는 ctxRows의 꼬리이므로
  // 지표를 ctxRows로 계산한 뒤 lastN(..., visN)으로 잘라 그린다(좌측 워밍업 잘림 방지).
  const ctxRows = chartAnalysisContextRows(allRows);
  const visN = rows.length;
  const ctxCloses = ctxRows.map((r) => r.c);
  const tailCh = (ch) => ch ? { upper: lastN(ch.upper, visN), lower: lastN(ch.lower, visN), mid: lastN(ch.mid, visN) } : null;
  const tailObj = (o) => { const r = {}; for (const k in o) r[k] = Array.isArray(o[k]) ? lastN(o[k], visN) : o[k]; return r; };
  // 화면 가격범위 밖 값은 가장자리에 평평하게 깔리지 않도록 null 처리(선이 끊김) — 가짜 수평선 방지.
  const clipRange = (arr) => arr.map((v) => (v == null || !Number.isFinite(v) || v < min || v > max) ? null : v);

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
    chartState.showSma5 ? pathFromSeries(clipRange(lastN(smaSeries(ctxCloses, 5), visN)), xFor, yFor, "#60a5fa", 1.8, "") : "",
    chartState.showSma10 ? pathFromSeries(clipRange(lastN(smaSeries(ctxCloses, 10), visN)), xFor, yFor, "#34d399", 1.8, "") : "",
    chartState.showSma20 ? pathFromSeries(clipRange(lastN(smaSeries(ctxCloses, 20), visN)), xFor, yFor, "#a855f7", 1.8, "") : "",
    chartState.showSma60 ? pathFromSeries(clipRange(lastN(smaSeries(ctxCloses, 60), visN)), xFor, yFor, "#d98a2b", 1.8, "") : "",
    chartState.showSma120 ? pathFromSeries(clipRange(lastN(smaSeries(ctxCloses, 120), visN)), xFor, yFor, "#facc15", 1.8, "") : "",
    chartState.showEma20 ? pathFromSeries(clipRange(lastN(emaArray(ctxCloses, 20), visN)), xFor, yFor, "#f472b6", 1.6, "") : "",
    chartState.showEma60 ? pathFromSeries(clipRange(lastN(emaArray(ctxCloses, 60), visN)), xFor, yFor, "#38bdf8", 1.6, "") : "",
    chartState.showVwap ? pathFromSeries(clipRange(lastN(vwapArray(ctxRows), visN)), xFor, yFor, "#f97316", 1.7, "") : "",
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
      const fill = g.type === "up" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)";
      const stroke = g.type === "up" ? "#22c55e" : "#ef4444";
      gapSvg += `<rect x="${x1.toFixed(1)}" y="${yTop.toFixed(1)}" width="${(xPlotRight - x1).toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="0.8" stroke-dasharray="4 3" opacity="0.9"></rect>`
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
      if (tlTypes.stop) techLevelSvg += hLine(tl.atr.stop, `Stop ${chartPriceLabel(tl.atr.stop)}`, "#dc2626", "2 3");
      if (tlTypes.tgt) techLevelSvg += hLine(tl.atr.target, `Tgt ${chartPriceLabel(tl.atr.target)}`, "#16a34a", "2 3");
      if (tlTypes.tgt2 && tl.atr.target2 != null) techLevelSvg += hLine(tl.atr.target2, `Tgt2 ${chartPriceLabel(tl.atr.target2)}`, "#15803d", "2 3");
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

  // 드로잉(추세선/피보) 좌표 매핑용 지오메트리 저장.
  lastChartGeom = { padL, plotW, padT, plotH, min, max, range, width, height, ticker: item.ticker };
  const isLine = chartState.chartType === "line";
  const isHeikin = chartState.chartType === "heikin";

  svg.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" rx="8" class="chart-bg"></rect>
    ${vGuides}
    ${grid}
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
    <g id="chartDrawLayer">${renderChartDrawings()}</g>
    ${panelsSvg}
    <line x1="${padL}" y1="${padT + plotH}" x2="${padL + plotW}" y2="${padT + plotH}" class="chart-base"></line>
    ${dateLabels}
    <text x="${padL}" y="20" class="chart-label">${item.ticker} ${chartState.range} · ${tfLabel}${isHeikin ? " · Heikin" : ""} · ${rows.length} bars · ${fmtPct(chartChange)}</text>
    <text x="${padL}" y="36" class="chart-axis">${activeIndicatorLabels(item)}</text>
    <text x="${width - 10}" y="20" text-anchor="end" class="chart-label">${chartPriceLabel(last.c)}</text>
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

// 보이는 구간(rows)은 분석 컨텍스트(ctxRows)의 꼬리다. 컨텍스트에서 계산한 지표 배열을
// 보이는 길이(visN)만큼 잘라 xFor(0..visN-1)에 정렬한다 → 확대해도 이평/지표 좌측이 잘리지 않는다.
function lastN(arr, n) {
  return (n != null && Array.isArray(arr) && arr.length > n) ? arr.slice(arr.length - n) : arr;
}
function smaSeries(values, period) {
  const out = Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i += 1) {
    let s = 0;
    for (let j = i - period + 1; j <= i; j += 1) s += values[j];
    out[i] = s / period;
  }
  return out;
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
  const key = normalizeTickerKey(ticker);
  return (data.stocks || []).find((row) => normalizeTickerKey(row.ticker) === key) || null;
}

// ===== 한국어/회사명 → 티커 검색 =====
const TICKER_SEARCH_TOP_N = 1500;
const TICKER_SEARCH_COMPANY_SCAN_N = 2800;
const KR_TICKER_NICKNAMES = {
  "005930": ["삼전", "삼성", "삼성전자"],
  "000660": ["하이닉", "하이닉스"],
  "035420": ["네이버", "NAVER"],
  "035720": ["카카오"],
  "005380": ["현대차", "현대자동차"],
  "000270": ["기아"],
  "373220": ["LG에너지", "엘지에너지", "LG에너지솔루션"],
  "006400": ["삼성SDI", "삼성에스디아이"],
  "051910": ["LG화학", "엘지화학"],
  "207940": ["삼바", "삼성바이오"],
  "068270": ["셀트리온"],
  "105560": ["KB", "KB금융", "국민은행"],
  "055550": ["신한", "신한지주"],
};

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
  if (isKrMarket()) {
    (data.stocks || []).forEach((stock) => {
      const name = String(stock.company || "").trim();
      if (!name) return;
      if (!byKo.has(name)) byKo.set(name, []);
      if (!byKo.get(name).includes(stock.ticker)) byKo.get(name).push(stock.ticker);
    });
    Object.entries(KR_TICKER_NICKNAMES).forEach(([ticker, aliases]) => {
      if (!stockByTicker(ticker)) return;
      (aliases || []).forEach((alias) => {
        const key = String(alias || "").trim();
        if (!key) return;
        if (!byKo.has(key)) byKo.set(key, []);
        if (!byKo.get(key).includes(ticker)) byKo.get(key).push(ticker);
      });
    });
  }
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
  const kr = isKrMarket();
  const qUpper = q.toUpperCase();
  const qLower = q.toLowerCase();
  const qTickerKey = kr ? normalizeTickerKey(q) : qUpper;
  const scored = [];
  const seen = new Set();

  function push(ticker, score, hint) {
    const stock = stockByTicker(ticker);
    if (!stock || seen.has(stock.ticker)) return;
    seen.add(stock.ticker);
    scored.push({ ticker: stock.ticker, company: stock.company, hint: hint || null, score });
  }

  const exactTicker = stockByTicker(kr ? qTickerKey : qUpper);
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
    const ticker = kr ? row.ticker : String(row.ticker || "").toUpperCase();
    if (kr) {
      if (ticker === qTickerKey) push(ticker, 995, null);
      else if (/^\d+$/.test(q) && ticker.startsWith(q)) push(ticker, 620 - i * 0.001, null);
      else if (row.companyLower.includes(qLower)) push(ticker, 500 - i * 0.01, null);
    } else {
      if (ticker === qUpper) push(ticker, 995, null);
      else if (ticker.startsWith(qUpper)) push(ticker, 620 - i * 0.001, null);
      else if (row.companyLower.includes(qLower)) push(ticker, 500 - i * 0.01, null);
    }
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
  if (isKrMarket()) {
    const ind = String(item.industry || "");
    const sec = String(item.sector || "");
    if (ind.includes("반도체")) return "091160";
    if (ind.includes("2차전지")) return "305720";
    if (ind.includes("은행")) return "091170";
    if (ind.includes("자동차")) return "091180";
    if (ind.includes("바이오") || ind.includes("제약") || ind.includes("헬스케어")) return "244580";
    
    if (sec === "기술") return "091160";
    if (sec === "금융") return "091170";
    if (sec === "헬스케어") return "244580";
    if (sec === "산업재" && ind.includes("자동차")) return "091180";
    return null;
  }

  const sector = String(item.sector || "").toUpperCase();
  const industry = String(item.industry || "").toUpperCase();
  if (industry.includes("SEMICONDUCTOR") || sector.includes("SEMICONDUCTOR")) return "SOXX";
  const exact = getSectorEtfs().find((meta) => String(meta.sectorName || "").toUpperCase() === sector);
  if (exact) return exact.ticker;
  const fuzzy = getSectorEtfs().find((meta) => {
    const name = String(meta.sectorName || "").toUpperCase();
    return name && (sector.includes(name) || industry.includes(name));
  });
  return fuzzy ? fuzzy.ticker : null;
}

function relativeBenchmarkTickers(item) {
  const [[b1], [b2]] = etfRsSecondaryBenchmarks();
  const tickers = [];
  if (chartState.showRsSpy || chartState.showMansfield) tickers.push(b1);
  if (chartState.showRsQqq) tickers.push(b2);
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
  const ma20 = smaSeries(volumes, 20);
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

function renderRocPanel(closes, xFor, x1, x2, top, height, visN) {
  return renderLinePanel([{ name: "ROC", values: lastN(rocArray(closes, 12), visN), color: "#38bdf8" }], xFor, x1, x2, top, height, "ROC(12)", { zeroLine: true, guides: [0] });
}

function renderMomentumPanel(closes, xFor, x1, x2, top, height, visN) {
  return renderLinePanel([{ name: "MOM", values: lastN(momentumArray(closes, 10), visN), color: "#f59e0b" }], xFor, x1, x2, top, height, "Momentum(10)", { zeroLine: true, guides: [0] });
}

function renderWilliamsPanel(rows, xFor, x1, x2, top, height, visN) {
  return renderLinePanel([{ name: "%R", values: lastN(williamsArray(rows, 14), visN), color: "#c084fc" }], xFor, x1, x2, top, height, "Williams %R(14)", { domain: [-100, 0], guides: [-20, -80] });
}

function renderAtrPanel(rows, xFor, x1, x2, top, height, visN) {
  return renderLinePanel([{ name: "ATR", values: lastN(atrArray(rows, 14), visN), color: "#fb7185" }], xFor, x1, x2, top, height, "ATR(14)");
}

function renderAdxPanel(rows, xFor, x1, x2, top, height, visN) {
  const adx = adxArrays(rows, 14);
  return renderLinePanel([
    { name: "ADX", values: lastN(adx.adx, visN), color: "#facc15", width: 1.5 },
    { name: "+DI", values: lastN(adx.plusDi, visN), color: "#22c55e", width: 1.2 },
    { name: "-DI", values: lastN(adx.minusDi, visN), color: "#ef4444", width: 1.2 }
  ], xFor, x1, x2, top, height, "ADX(14)", { domain: [0, 60], guides: [20, 40] });
}

function renderCciPanel(rows, xFor, x1, x2, top, height, visN) {
  return renderLinePanel([{ name: "CCI", values: lastN(cciArray(rows, 20), visN), color: "#818cf8" }], xFor, x1, x2, top, height, "CCI(20)", { zeroLine: true, guides: [-100, 0, 100] });
}

function cmfArray(rows, period = 20) {
  const fn = window.MirProb && window.MirProb.cmfArray;
  if (fn) return fn(rows, period);
  const out = Array(rows.length).fill(null);
  const mfv = rows.map((r) => {
    const range = r.h - r.l;
    const m = range ? (((r.c - r.l) - (r.h - r.c)) / range) : 0;
    return m * (r.v || 0);
  });
  for (let i = period - 1; i < rows.length; i += 1) {
    const volSum = rows.slice(i - period + 1, i + 1).reduce((a, r) => a + (r.v || 0), 0);
    const mfvSum = mfv.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    out[i] = volSum ? mfvSum / volSum : 0;
  }
  return out;
}

function mfiArray(rows, period = 14) {
  const fn = window.MirProb && window.MirProb.mfiArray;
  if (fn) return fn(rows, period);
  const tp = rows.map((r) => (r.h + r.l + r.c) / 3);
  const rmf = rows.map((r, i) => {
    const raw = tp[i] * (r.v || 0);
    if (!i) return { pos: 0, neg: 0 };
    return raw > tp[i - 1] * (rows[i - 1].v || 0) ? { pos: raw, neg: 0 } : { pos: 0, neg: raw };
  });
  const out = Array(rows.length).fill(null);
  for (let i = period; i < rows.length; i += 1) {
    let pos = 0;
    let neg = 0;
    for (let j = i - period + 1; j <= i; j += 1) { pos += rmf[j].pos; neg += rmf[j].neg; }
    const ratio = neg ? pos / neg : 100;
    out[i] = 100 - 100 / (1 + ratio);
  }
  return out;
}

function renderCmfPanel(rows, xFor, x1, x2, top, height, visN) {
  return renderLinePanel([{ name: "CMF", values: lastN(cmfArray(rows, 20), visN), color: "#2dd4bf" }], xFor, x1, x2, top, height, "CMF(20)", { domain: [-0.35, 0.35], zeroLine: true, guides: [-0.1, 0, 0.1] });
}

function renderMfiPanel(rows, xFor, x1, x2, top, height, visN) {
  return renderLinePanel([{ name: "MFI", values: lastN(mfiArray(rows, 14), visN), color: "#a78bfa" }], xFor, x1, x2, top, height, "MFI(14)", { domain: [0, 100], guides: [20, 50, 80] });
}

function ttmSqueezeSeries(rows) {
  const fn = window.MirProb && window.MirProb.ttmSqueezeSeries;
  if (fn) return fn(rows);
  const closes = rows.map((r) => r.c);
  const bb = bollinger(closes, 20, 2);
  const kc = keltnerChannels(rows, 20, 1.5);
  const squeezed = Array(rows.length).fill(false);
  for (let i = 0; i < rows.length; i += 1) {
    if (bb.upper[i] == null || kc.upper[i] == null) continue;
    squeezed[i] = bb.upper[i] < kc.upper[i] && bb.lower[i] > kc.lower[i];
  }
  return { squeezed, momentum: rocArray(closes, 12) };
}

function renderTtmSqueezePanel(rows, xFor, x1, x2, top, height, candleW, visN) {
  const ttm = ttmSqueezeSeries(rows);
  const squeezed = lastN(ttm.squeezed, visN);
  const momentum = lastN(ttm.momentum, visN);
  const moms = momentum.filter((v) => v != null && Number.isFinite(v));
  const mMax = Math.max(...moms.map((v) => Math.abs(v)), 1);
  const bandH = height * 0.28;
  const momTop = top + bandH + 6;
  const momH = height - bandH - 8;
  const yForMom = (v) => momTop + momH * 0.5 - (v / mMax) * momH * 0.45;
  const zeroY = yForMom(0);
  const sqRects = squeezed.map((sq, i) => {
    if (!sq) return "";
    const x = xFor(i) - candleW / 2;
    return `<rect x="${x.toFixed(1)}" y="${(top + 2).toFixed(1)}" width="${candleW.toFixed(1)}" height="${bandH.toFixed(1)}" fill="rgba(250,204,21,0.32)" rx="1"></rect>`;
  }).join("");
  const momBars = momentum.map((v, i) => {
    if (v == null || !Number.isFinite(v)) return "";
    const y = Math.min(zeroY, yForMom(v));
    const h = Math.max(0.5, Math.abs(yForMom(v) - zeroY));
    return `<rect x="${(xFor(i) - candleW / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${candleW.toFixed(1)}" height="${h.toFixed(1)}" class="${v >= 0 ? "macd-hist-up" : "macd-hist-down"}"></rect>`;
  }).join("");
  const sqNow = squeezed[squeezed.length - 1];
  return `
    <rect x="${x1}" y="${top}" width="${x2 - x1}" height="${height}" class="rsi-bg"></rect>
    ${sqRects}
    <line x1="${x1}" y1="${zeroY.toFixed(1)}" x2="${x2}" y2="${zeroY.toFixed(1)}" class="rsi-guide"></line>
    ${momBars}
    <text x="${x1 + 4}" y="${top + 12}" class="chart-axis">TTM Squeeze · ${sqNow ? "수축 중" : "해제"} · Mom(12)</text>
  `;
}

function renderRelativePanel(item, rows, xFor, x1, x2, top, height) {
  const series = [];
  const [[b1, b1Label], [b2, b2Label]] = etfRsSecondaryBenchmarks();
  if (chartState.showRsSpy) {
    const bench = benchmarkRowsForTicker(b1);
    if (bench.length) series.push({ name: `RS/${b1Label}`, values: relativePerformanceSeries(rows, visibleRowsForBenchmark(bench, rows.length)), color: "#60a5fa" });
  }
  if (chartState.showRsQqq) {
    const bench = benchmarkRowsForTicker(b2);
    if (bench.length) series.push({ name: `RS/${b2Label}`, values: relativePerformanceSeries(rows, visibleRowsForBenchmark(bench, rows.length)), color: "#a78bfa" });
  }
  if (chartState.showRsSector) {
    const sectorTicker = sectorBenchmarkTickerForItem(item);
    const bench = sectorTicker ? benchmarkRowsForTicker(sectorTicker) : [];
    if (bench.length) series.push({ name: `RS/${sectorTicker}`, values: relativePerformanceSeries(rows, visibleRowsForBenchmark(bench, rows.length)), color: "#34d399" });
  }
  if (chartState.showMansfield) {
    const bench = benchmarkRowsForTicker(b1);
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
function renderMacdPanel(closes, xFor, x1, x2, top, height, candleW, visN) {
  const full = macdSeries(closes);
  const macd = lastN(full.macd, visN);
  const signal = lastN(full.signal, visN);
  const hist = lastN(full.hist, visN);
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

function renderStochPanel(rows, xFor, x1, x2, top, height, visN) {
  const st = stochArrays(rows, 14, 3);
  const k = lastN(st.k, visN);
  const d = lastN(st.d, visN);
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

// 상승확률 분석 차트 오버레이: 보이는 구간 + 앞쪽 이력(피보·회귀 등)을 함께 쓴다.
function chartAnalysisContextRows(allRows) {
  const rangeSize = rangeBarCount(allRows.length);
  const base = allRows.slice(-rangeSize);
  const windowSize = Math.max(12, Math.floor(base.length / chartState.zoom));
  const maxOffset = Math.max(0, base.length - windowSize);
  const offset = Math.min(chartState.offset, maxOffset);
  const end = base.length - offset;
  const ctxStart = Math.max(0, end - Math.max(252, windowSize + 80));
  return base.slice(ctxStart, end);
}

// 지지/저항 레벨 계산은 analysis.js(window.MirProb.supportResistanceLevels)로 일원화했다.
// 차트 오버레이는 보이는 봉(rows) 기준 — 이동·확대 시 선이 따라 갱신된다.
// 확률 패널 숫자는 분석 시점 전체 일봉 기준(srSummary)을 유지한다.

function renderRsiPanel(closes, xFor, x1, x2, top, height, visN) {
  const values = lastN(rsiSeries(closes, 14), visN);
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
    chartState.showVolumeProfile ? "VP" : "",
    chartState.showTrendlines ? "Trend" : "",
    chartState.showGapZones ? "Gap" : "",
    chartState.showMarketStructure ? "MS" : "",
    chartState.showChandelier ? "Chand" : "",
    chartState.showAnchoredVwap ? "AVWAP" : "",
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
  const raw = String(text || "");
  const us = raw.toUpperCase().match(/\b[A-Z][A-Z0-9.\-]{0,5}\b/g) || [];
  const kr = raw.match(/\b\d{6}\b/g) || [];
  return [...new Set([...us, ...kr].filter((w) => stockByTicker(w)))];
}

function buildChatSearchHints(userText) {
  const tickers = new Set();
  if (chatFocusTicker) tickers.add(chatFocusTicker);
  if (selectedTicker) tickers.add(selectedTicker);
  extractTickerCandidates(userText).forEach((t) => tickers.add(t));
  const companies = [];
  tickers.forEach((ticker) => {
    const base = stockByTicker(ticker);
    if (base && base.company) companies.push(base.company);
  });
  return { tickers: [...tickers], companies };
}

function chatLikelyNeedsNews(text) {
  return /뉴스|왜\s*(올|하|떨|급|상|폭|조|강|쳤)|이슈|이유|배경|실적|어닝|공시|리포트|전망|하락|상승|급등|급락|수주|계약|인수|합병|소식|최근|무슨\s*일|요약해|분석해/i.test(String(text || ""));
}

async function buildStockChatContext(userText) {
  const tickers = new Set();
  if (chatFocusTicker) tickers.add(chatFocusTicker);
  if (selectedTicker) tickers.add(selectedTicker);
  extractTickerCandidates(userText).forEach((t) => tickers.add(t));
  if (!tickers.size) return "";

  // Wait for all tickers' details + 스마트머니/촉매 데이터셋이 로드되도록 보장한다.
  // (내부자·의회·13F·대량보유·공매도·주요공시 — AI가 함께 참고하려면 먼저 받아와야 함)
  await Promise.all([
    ...[...tickers].map((ticker) => loadStockDetail(ticker)),
    ...["inst13f", "insider", "short", "congress", "activist", "events"].map((k) =>
      (typeof ensureFeatureData === "function" ? ensureFeatureData(k) : Promise.resolve()).catch(() => {})),
  ]);

  const lines = [];
  tickers.forEach((ticker) => {
    const base = stockByTicker(ticker);
    if (!base) return;
    const item = applyLive(withDetail(base));
    const f = item.fundamentals || {};
    const earnings = item.liveEarnings || {};
    
    let techStr = "";
    const closes = (item.chartSeries || []).map((r) => (Array.isArray(r) ? Number(r[3]) : Number(r.c)));
    const volumes = (item.chartSeries || []).map((r) => (Array.isArray(r) ? Number(r[4]) : Number(r.v)));
    
    if (closes.length > 14) {
      const rsis = rsiSeries(closes, 14);
      const latestRsi = rsis[rsis.length - 1];
      const { macd, signal, hist } = macdSeries(closes);
      const latestMacd = macd[macd.length - 1];
      const latestMacdSignal = signal[signal.length - 1];
      const latestMacdHist = hist[hist.length - 1];
      
      let rsiState = "보통";
      if (latestRsi >= 70) rsiState = "과매수(Overbought)";
      else if (latestRsi <= 30) rsiState = "과매도(Oversold)";

      let macdState = "중립";
      if (latestMacd != null && latestMacdSignal != null) {
        if (latestMacd > latestMacdSignal) macdState = "강세(골든크로스 상태)";
        else if (latestMacd < latestMacdSignal) macdState = "약세(데드크로스 상태)";
      }

      techStr = ` · RSI(14):${latestRsi != null ? latestRsi.toFixed(1) : "—"} (${rsiState}) · MACD:${latestMacd != null ? latestMacd.toFixed(2) : "—"} (시그널:${latestMacdSignal != null ? latestMacdSignal.toFixed(2) : "—"}, 히스토그램:${latestMacdHist != null ? latestMacdHist.toFixed(2) : "—"}, 상태:${macdState})`;
    }
    
    if (volumes.length >= 20) {
      const latestVol = volumes[volumes.length - 1];
      const avgVol20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
      if (avgVol20 > 0) {
        const ratio = latestVol / avgVol20;
        techStr += ` · 거래량비율(최근20일평균대비):${ratio.toFixed(2)}x`;
      }
    }
    
    if (closes.length >= 60) {
      const price = Number(item.price || closes[closes.length - 1]);
      const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
      const sma60 = closes.slice(-60).reduce((a, b) => a + b, 0) / 60;
      techStr += ` · 이평선상태: 가격이 SMA20(${sma20.toFixed(0)}) 대비 ${price >= sma20 ? '상회' : '하회'}, SMA60(${sma60.toFixed(0)}) 대비 ${price >= sma60 ? '상회' : '하회'}`;
    }

    lines.push(
      `[${item.ticker} ${item.company}] 섹터:${item.sector} · 가격:${priceOrDash(item.price)} · 당일:${fmtDailyPct(item.changePct)} · 1주:${fmtPct(item.weekChangePct)} · 1M:${fmtPct(item.monthChangePct)} · RS:${item.rsScore} · EPS점수:${item.epsRevScore} · 거래량비율:${Number(item.volumeRatio || 0).toFixed(1)}x · 신고가거리:${fmtPct(-item.newHighDistancePct)} · 신호:${signalFor(item)}` +
      (f.pe ? ` · PER:${fmtMultiple(f.pe)}` : "") +
      (f.forwardPE ? ` · FwdPER:${fmtMultiple(f.forwardPE)}` : "") +
      (f.ps ? ` · P/S:${fmtMultiple(f.ps)}` : "") +
      (f.pb ? ` · P/B:${fmtMultiple(f.pb)}` : "") +
      (earnings.nextDate ? ` · 다음실적:${earnings.nextDate}` : "") +
      (earnings.epsEstimate != null ? ` · EPS예상:${earnings.epsEstimate}` : "") +
      techStr
    );

    // 스마트머니·촉매·상승확률 — 사이트의 차별화 데이터(내부자/의회/13F/대량보유/공매도/공시/MirProb)도
    // AI가 함께 보고 판단하도록 컨텍스트에 추가한다. 데이터가 없는 항목은 생략(주로 KR 종목).
    const smLines = [];
    const ins = ((window.INSIDER_TRADES || {}).trades || []).filter((r) => r.ticker === item.ticker);
    if (ins.length) {
      const insBuy = ins.filter((r) => r.kind === "buy").length;
      const insSell = ins.filter((r) => r.kind === "sell").length;
      smLines.push(`내부자(Form4) 매수 ${insBuy}·매도 ${insSell}`);
    }
    const cg = ((window.CONGRESS_TRADES || {}).byTicker || {})[item.ticker];
    if (cg) smLines.push(`의회매매 매수 ${cg.netBuys}·매도 ${cg.netSells}·${cg.politicianCount}명`);
    const f13 = (typeof inst13fIndex === "function" ? inst13fIndex() : {})[item.ticker];
    if (f13) smLines.push(`기관13F ${f13.holders}곳·$${(f13.valueM / 1000).toFixed(1)}B`);
    const act = ((window.ACTIVIST_STAKES || {}).filings || []).filter((r) => r.ticker === item.ticker);
    if (act.length) smLines.push(`대량보유13D/G ${act.length}건(액티비스트 ${act.filter((a) => a.kind === "activist").length})`);
    const si = ((window.SHORT_INTEREST || {}).rows || []).find((r) => r.ticker === item.ticker);
    if (si) smLines.push(`${shortIsBalance() ? `공매도 잔고비중 ${Number(si.balanceRatio || 0).toFixed(2)}%` : `공매도 잔고일수 ${Number(si.daysToCover || 0).toFixed(1)}일`}${Number.isFinite(si.changePct) ? `(전기대비 ${si.changePct > 0 ? "+" : ""}${si.changePct.toFixed(1)}%)` : ""}`);
    const evs = ((window.MATERIAL_EVENTS || {}).events || []).filter((e) => String(e.ticker || "").toUpperCase() === item.ticker);
    if (evs.length) {
      const labels = (evs[0].items || []).map((x) => x.label).filter(Boolean).slice(0, 3).join(", ") || "8-K";
      smLines.push(`주요공시(8-K) ${evs.length}건·최근 ${evs[0].fileDate || "—"}(${labels})`);
    }
    try {
      if (typeof scanQuickProb === "function") {
        const { up } = scanQuickProb(item, 20);
        if (Number.isFinite(up)) {
          const upR = Math.round(up);
          smLines.push(`MirProb 상승확률(약 1개월, 스냅샷 추정) ${upR}%(${typeof scanVerdict === "function" ? scanVerdict(upR) : ""})`);
        }
      }
    } catch (e) { /* 확률 계산 실패 시 생략 */ }
    if (smLines.length) lines.push(`  └ 스마트머니·촉매·확률: ${smLines.join(" · ")}`);
  });
  return lines.length
    ? `다음은 사이트 스냅샷/프록시 기준 종목 데이터입니다(실시간 투자 조언 아님, 참고용):\n${lines.join("\n")}`
    : "";
}

function renderEarningsCalendar(item) {
  const box = byId("stockEarnings");
  if (!box) return;
  if (isStockEtf(item)) {
    box.innerHTML = "";
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const f = normalizedFundamentalsForItem(item);
  const live = item.liveEarnings || staticEarningsForTicker(item.ticker) || {};
  const nextDate = live.nextDate || f.earningsDate || f.nextEarningsDate || item.earningsDate || null;
  const epsEstimate = live.epsEstimate ?? f.epsNextQ ?? null;
  const history = normalizeEarningsHistory(item).slice(-4).reverse();
  // new Date("YYYY-MM-DD") 는 UTC 자정으로 파싱돼 로컬 자정 기준인 snapshotBaseDate 와
  // 섞이면 KST 에서 하루가 어긋난다 — 로컬 자정으로 통일(localDateFromIso).
  const nextDateLocal = nextDate ? (localDateFromIso(nextDate) || new Date(nextDate)) : null;
  const daysUntil = nextDateLocal ? Math.ceil((nextDateLocal - snapshotBaseDate()) / 86400000) : null;

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
    ${history.length ? renderEarningsHistoryTable(history) : `<p class="muted earnings-empty">최근 분기 실적 히스토리는 프록시 연결 후 자동으로 채워집니다.</p>`}
  `;
}

// 미국(야후)은 EPS 실제/예상/서프라이즈를, 한국(DART)은 실제 손익을 준다. DART 에는
// 애널리스트 추정치가 없어서, KR 에 EPS 표를 그대로 쓰면 세 칸이 전부 "—" 인 빈 표가
// 나온다. 그래서 시장에 따라 컬럼을 바꾼다.
function renderEarningsHistoryTable(history) {
  const top = isKrMarket() ? krTopLineField(history) : null;
  const krMode = Boolean(top);

  const head = krMode
    ? `<tr><th>분기</th><th>${escapeHtml(top.label)}</th><th>영업이익</th><th>순이익</th></tr>`
    : `<tr><th>분기</th><th>실제 EPS</th><th>예상 EPS</th><th>서프라이즈</th></tr>`;

  const body = history.map((row) => {
    if (krMode) {
      return `
              <tr>
                <td title="${escapeHtml(row.period || "")}">${escapeHtml(row.label || row.date || "—")}</td>
                <td>${fmtKrwCompact(row[top.key])}</td>
                <td class="${cls(Number(row.operatingProfit) || 0)}">${fmtKrwCompact(row.operatingProfit)}</td>
                <td class="${cls(Number(row.netIncome) || 0)}">${fmtKrwCompact(row.netIncome)}</td>
              </tr>`;
    }
    return `
              <tr>
                <td>${escapeHtml(row.date || "—")}</td>
                <td>${row.epsActual != null ? moneyOrDash(row.epsActual) : "—"}</td>
                <td>${row.epsEstimate != null ? moneyOrDash(row.epsEstimate) : "—"}</td>
                <td class="${cls(earningsSurprisePct(row) || 0)}">${earningsSurprisePct(row) == null ? "—" : fmtPct(earningsSurprisePct(row))}</td>
              </tr>`;
  }).join("");

  return `
      <details class="earnings-inline-history">
        <summary>최근 분기 ${krMode ? "실적" : "EPS"} 기록 <span>${history.length}개 분기</span></summary>
        <div class="table-wrap compact-table-wrap">
        <table class="compact-table earnings-table">
          <thead>${head}</thead>
          <tbody>${body}</tbody>
        </table>
        </div>
      </details>`;
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
      <span class="event-type"><i aria-hidden="true"></i>커뮤니티</span>
      <strong>커뮤니티</strong>
      <b>${loading ? "불러오는 중…" : (count ? `${count}개 의견` : "의견 없음")}</b>
      ${previewHtml}
      <div class="event-community-actions">
        <button type="button" class="event-action event-community-cta" data-community-board="${escapeHtml(item.ticker)}">${escapeHtml(ctaLabel)}</button>
        <button type="button" class="event-action event-community-write" data-community-write="${escapeHtml(item.ticker)}">글쓰기</button>
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
  const f = normalizedFundamentalsForItem(item);
  const displayPrice = latestPriceForFundamentals(item, f);
  const rows = getChartRows(item);
  const latestNews = Array.isArray(item.news) ? item.news[0] : null;
  const target = Number(f.targetPrice);
  const price = Number(displayPrice || item.price || f.prevClose);
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

const EVENT_META = {
  Earnings: { icon: "", ko: "실적" },
  Options:  { icon: "", ko: "옵션 만기" },
  Target:   { icon: "", ko: "목표가" },
  Dividend: { icon: "", ko: "배당" },
  News:     { icon: "", ko: "뉴스" },
  Move:     { icon: "", ko: "가격 이벤트" },
};

function eventTypeLabel(type) {
  const meta = EVENT_META[type] || { icon: "•", ko: type };
  return `<span class="event-type"><i aria-hidden="true">${meta.icon}</i>${escapeHtml(meta.ko)}</span>`;
}

function eventCardHtml(event) {
  if (event.type === "Earnings") {
    return `
      <article class="event-card event-${escapeHtml(event.tone)} event-card-earnings">
        <div class="earnings-card-title">
          ${eventTypeLabel("Earnings")}
          <strong>실적 일정과 발표 반응</strong>
        </div>
        <div id="stockEarnings" class="earnings-inline-calendar"></div>
        <div id="earningsReaction" class="earnings-inline-reaction-host"></div>
      </article>`;
  }
  return `
    <article class="event-card event-${escapeHtml(event.tone)}">
      ${eventTypeLabel(event.type)}
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
  const benchLabel = isKrMarket() ? "코스피·코스닥" : "SPY·QQQ";
  const text = isLoading ? `해당 날짜 전후의 과거 뉴스와 ${benchLabel} 시장 흐름을 검색하고 있습니다.` : (moveAnalysisState.text || localMoveAnalysis(item, move));
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
    // Send the Yahoo-suffixed symbol (005930.KS) so the proxy detects Korean
    // stocks and uses Naver/Korean news + KOSPI·KOSDAQ benchmarks.
    const endpoint = `${baseUrl}/?ticker=${encodeURIComponent(liveProxyTicker(item))}&company=${encodeURIComponent(item.company || item.ticker)}&move_analysis=1&date=${encodeURIComponent(date)}&change=${encodeURIComponent(move.change)}`;
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
      revenue: row.revenue ?? row.sales,
      // KR(DART) 전용. 미국은 야후에서 EPS·서프라이즈가 오지만 DART 는 추정치를 주지
      // 않는 대신 실제 손익을 준다. 은행·보험·증권은 '매출액' 계정 자체가 없어서
      // revenue 가 없고 순이자손익/이자수익이 톱라인이다.
      label: row.label,
      period: row.period,
      operatingProfit: row.operatingProfit,
      netIncome: row.netIncome,
      netInterestIncome: row.netInterestIncome,
      interestIncome: row.interestIncome,
      netFeeIncome: row.netFeeIncome,
    };
  }).filter((row) => row.date);
}

// 업종마다 톱라인이 다르다. 제조·서비스업은 매출액이지만 금융업은 그 계정이 없다.
// 한 종목의 표 전체에 쓸 라벨이라 행이 아니라 히스토리 단위로 고른다.
function krTopLineField(history) {
  const has = (k) => history.some((r) => Number.isFinite(Number(r[k])));
  if (has("revenue")) return { key: "revenue", label: "매출" };
  if (has("netInterestIncome")) return { key: "netInterestIncome", label: "순이자손익" };
  if (has("interestIncome")) return { key: "interestIncome", label: "이자수익" };
  return null;
}

// DART 금액은 원 단위 정수로 온다(삼성전자 연매출 333,605,900,000,000).
function fmtKrwCompact(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const jo = n / 1e12;
  if (Math.abs(jo) >= 1) return `${jo.toFixed(2)}조`;
  return `${(jo * 10000).toFixed(0)}억`;
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
  // DART 에는 애널리스트 추정치가 없어 KR 은 서프라이즈가 항상 null 이다. 컬럼을 두면
  // 세로로 "-" 만 늘어서므로 계산 가능한 행이 하나라도 있을 때만 보여준다.
  const showSurprise = rows.some((row) => row.surprise != null);
  box.innerHTML = `
    ${rows.length ? `
      <details class="earnings-inline-reaction">
        <summary>실적 발표 전후 주가 반응 <span>최근 ${Math.min(rows.length, 4)}회</span></summary>
        <div class="table-wrap">
        <table class="compact-table earnings-reaction-table">
          <thead><tr><th>발표일</th><th>거래일</th>${showSurprise ? "<th>EPS 서프라이즈</th>" : ""}<th>-5D→발표</th><th>발표일</th><th>발표→+5D</th></tr></thead>
          <tbody>
            ${rows.slice(0, 4).map((row) => `
              <tr>
                <td>${escapeHtml(row.date)}</td>
                <td>${escapeHtml(row.tradingDate)}</td>
                ${showSurprise ? `<td class="${cls(row.surprise || 0)}">${row.surprise == null ? "-" : fmtPct(row.surprise)}</td>` : ""}
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
  if (src.includes("naver")) return "네이버 금융";
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

function firstFiniteNumber(...values) {
  for (const value of values) {
    if (value === null || value === "") continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function latestPriceForFundamentals(item, f = item?.fundamentals || {}) {
  const rows = getChartRows(item || {});
  const lastClose = rows.length ? Number(rows[rows.length - 1].c) : null;
  return firstFiniteNumber(lastClose, item?.price, f.prevClose, f.price);
}

function marketCapBillionForFundamentals(item, f = item?.fundamentals || {}) {
  const detailCap = firstFiniteNumber(f.marketCapB);
  if (isKrMarket()) {
    if (detailCap != null && detailCap > 1000) return detailCap;
    const snapshotCap = firstFiniteNumber(item?.marketCapT, item?.marketCapB);
    if (snapshotCap != null) return snapshotCap * 1000;
    return detailCap;
  }
  return firstFiniteNumber(detailCap, item?.marketCapB);
}

function normalizedFundamentalsForItem(item) {
  const raw = item?.fundamentals || {};
  const f = { ...raw };
  const price = latestPriceForFundamentals(item, f);
  const marketCapB = marketCapBillionForFundamentals(item, f);
  if (isKrMarket() && marketCapB != null) f.marketCapDisplay = marketCapB / 1000;

  let epsTtm = firstFiniteNumber(f.epsTtm, f.trailingEps, f.trailingEPS, f.eps);
  let sharesB = firstFiniteNumber(f.sharesB, f.sharesOutstandingB);
  if (isKrMarket() && marketCapB != null && price && price > 0) {
    const derivedSharesB = marketCapB / price;
    if (derivedSharesB > 0) sharesB = derivedSharesB;
  }
  if (!(epsTtm > 0) && sharesB > 0 && Number(f.incomeB) > 0) {
    epsTtm = Number(f.incomeB) / sharesB;
  }
  if (epsTtm > 0) f.epsTtm = epsTtm;
  if (sharesB > 0) f.sharesBDisplay = sharesB;
  if (price > 0 && epsTtm > 0) f.pe = price / epsTtm;

  const epsNextY = firstFiniteNumber(f.epsNextY, f.forwardEps, f.forwardEPS, f.epsForward);
  if (price > 0 && epsNextY > 0) {
    f.epsNextY = epsNextY;
    f.forwardPE = price / epsNextY;
  } else if (isKrMarket()) {
    f.forwardPE = null;
  } else if (Number.isFinite(Number(raw.forwardPE))) {
    const basePrice = firstFiniteNumber(f.prevClose, item?.price);
    f.forwardPE = basePrice > 0 && price > 0 ? Number(raw.forwardPE) * price / basePrice : Number(raw.forwardPE);
  }
  return f;
}

function renderDataQualityPanel(item) {
  const box = byId("dataQualityPanel");
  if (!box || !item) return;
  const f = normalizedFundamentalsForItem(item);
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
  if (isStockEtf(item)) {
    renderEtfConstituents(item);
    return;
  }
  const f = normalizedFundamentalsForItem(item);
  const displayPrice = latestPriceForFundamentals(item, f);
  const detailMode = data.detailPolicy?.mode === "split";
  const hasFundamentals = Object.keys(f).length > 0;
  const krT = isKrMarket();

  // Group the metrics by what they tell you, so the eye can jump to a theme (밸류에이션,
  // 수익성 …) instead of scanning a flat 30-cell grid.
  const groups = [
    { title: "밸류에이션", metrics: [
      ["P/E", fmtMultiple(f.pe)], ["Forward P/E", fmtMultiple(f.forwardPE)],
      ["P/S", fmtMultiple(f.ps)], ["P/B", fmtMultiple(f.pb)],
    ] },
    { title: "수익성", metrics: [
      ["Gross Margin", fmtPercent(f.grossMargin)], ["Oper Margin", fmtPercent(f.operMargin)],
      ["Profit Margin", fmtPercent(f.profitMargin)], ["ROE", fmtPercent(f.roe)],
    ] },
    { title: "실적 (EPS)", metrics: [
      ["EPS TTM", moneyOrDash(f.epsTtm)], ["EPS Next Y", moneyOrDash(f.epsNextY)],
      ["EPS Next Q", moneyOrDash(f.epsNextQ)], [krT ? "1Y 목표가" : "1Y Target", priceOrDash(f.targetPrice)],
    ] },
    { title: "기간 성과", metrics: [
      ["Perf Week", fmtPct(item.weekChangePct)], ["Perf Month", fmtPct(item.monthChangePct)],
      ["Perf Quarter", fmtPct(item.threeMonthChangePct)], ["Perf YTD", fmtPct(item.ytdChangePct)],
    ] },
    { title: "규모 · 유동성", wide: true, metrics: [
      ["Market Cap", krT ? fmtBillions(item.marketCapB) : fmtBillions(f.marketCapDisplay ?? f.marketCapB ?? item.marketCapB)],
      ["Sales", fmtFinancialB(f.salesB)], ["Income", fmtFinancialB(f.incomeB)], ["Cash", fmtFinancialB(f.cashB)],
      ["Shares Out", fmtShares(f.sharesBDisplay ?? f.sharesB)], ["Avg Volume", fmtCompact(f.avgVolume)],
      ["Volume", fmtCompact(f.volume)], ["Debt/Eq", fmtNum(f.debtEq)],
      ["Current Ratio", fmtRatio(f.currentRatio)], ["Quick Ratio", fmtRatio(f.quickRatio)],
    ] },
    { title: "가격", wide: true, metrics: [
      ["Price", priceOrDash(displayPrice)], ["Prev Close", priceOrDash(f.prevClose)],
      ["52W High", priceOrDash(f.week52High)], ["52W Low", priceOrDash(f.week52Low)],
      ["RS Score", item.rsScore ?? "-"], ["Index", indexLabel(item)],
    ] },
  ];

  const sourceText = hasFundamentals
    ? (krT ? "Yahoo Finance · 네이버 금융 보완 (KRX)" : f.source === "yahoo" ? "Yahoo Finance · Nasdaq/SEC 보완" : f.source === "sec" ? "SEC EDGAR · 분기 재무 공시" : f.source === "nasdaq+sec" || f.source === "nasdaq+sec+yahoo" ? "Nasdaq + SEC + Yahoo · NYSE 등 전 거래소" : "Nasdaq + SEC/Yahoo 스냅샷")
    : (detailMode ? "상세 데이터를 불러오는 중이거나 해당 종목 상세값이 없습니다." : "일부 지표는 다음 스냅샷 갱신 후 표시됩니다.");

  const groupHtml = (g) => `
    <div class="fund-group${g.wide ? " fund-group-wide" : ""}">
      <div class="fund-group-title">${escapeHtml(g.title)}</div>
      <div class="fund-metrics">
        ${g.metrics.map(([label, value]) => `
          <div class="fund-metric">
            <span class="fund-metric-label">${escapeHtml(label)}</span>
            ${valueWithClass(value)}
          </div>`).join("")}
      </div>
    </div>`;

  byId("fundamentalTable").innerHTML = `
    <div class="fundamental-head">
      <h3>Fundamentals</h3>
      <span>${sourceText}</span>
    </div>
    <div class="fund-groups">
      ${groups.map(groupHtml).join("")}
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
  const meta = getSectorEtfs().find((m) => m.ticker === ticker);
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
              <td class="${cls(s.changePct)}">${s.changePct != null ? fmtDailyPct(s.changePct) : "-"}</td>
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

function valueWithClass(value) {
  const text = String(value ?? "-");
  const numeric = Number(text.replace(/[$,%MBK]/g, ""));
  const className = text.startsWith("+") ? "pos" : text.startsWith("-") ? "neg" : "";
  return `<strong class="${className}">${escapeHtml(text)}</strong>`;
}

function indexLabel(item) {
  const groups = item.groups || [];
  const labels = [];
  const cfgLabels = marketCfg().groupLabels || {};
  groups.forEach((g) => {
    if (cfgLabels[g]) labels.push(cfgLabels[g]);
  });
  if (!labels.length) {
    if (groups.includes("idx_ndx100")) labels.push("Nasdaq 100");
    if (groups.includes("idx_sp500")) labels.push("S&P 500");
    if (groups.includes("idx_nasdaq")) labels.push("Nasdaq");
    if (groups.includes("idx_nyse")) labels.push("NYSE");
    if (groups.includes("idx_kospi200")) labels.push("코스피200");
    if (groups.includes("idx_kospi")) labels.push("코스피");
    if (groups.includes("idx_kosdaq150")) labels.push("코스닥150");
    if (groups.includes("idx_kosdaq")) labels.push("코스닥");
  }
  return labels.slice(0, 2).join(", ") || "-";
}

function hasFiniteNumber(value) {
  return value !== null && value !== "" && Number.isFinite(Number(value));
}

function fmtNum(value) {
  return hasFiniteNumber(value) ? Number(value).toFixed(2) : "-";
}

function fmtMultiple(value, digits = 2) {
  return hasFiniteNumber(value) ? `${Number(value).toFixed(digits)}배` : "-";
}

function moneyOrDash(value) {
  if (!hasFiniteNumber(value)) return "-";
  return marketCfg().formatMoney(value);
}

function priceOrDash(value) {
  if (!hasFiniteNumber(value)) return "-";
  return marketCfg().formatPrice(value);
}

function fmtRatio(value) {
  return hasFiniteNumber(value) ? (Number(value) / 100).toFixed(2) : "-";
}

function fmtPercent(value) {
  return hasFiniteNumber(value) ? `${Number(value).toFixed(2)}%` : "-";
}

function fmtBillions(value) {
  if (!hasFiniteNumber(value)) return "-";
  return marketCfg().formatMarketCap(value);
}

function fmtFinancialB(value) {
  if (!hasFiniteNumber(value)) return "-";
  const n = Number(value);
  return marketCfg().formatMarketCap(isKrMarket() ? n / 1000 : n);
}

function fmtShares(value) {
  if (!hasFiniteNumber(value)) return "-";
  const n = Number(value);
  if (isKrMarket()) {
    const valInEok = n * 10;
    if (Math.abs(valInEok) >= 10000) {
      const valInJo = valInEok / 10000;
      return `${parseFloat(valInJo.toFixed(2)).toLocaleString("ko-KR")}조`;
    }
    return `${parseFloat(valInEok.toFixed(2)).toLocaleString("ko-KR")}억`;
  }
  if (Math.abs(n) >= 1) return `${parseFloat(n.toFixed(2)).toLocaleString("en-US")}B`;
  return `${parseFloat((n * 1000).toFixed(0)).toLocaleString("en-US")}M`;
}

function fmtCompact(value) {
  if (!hasFiniteNumber(value)) return "-";
  const num = Number(value);
  if (Math.abs(num) >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return `${num.toFixed(0)}`;
}

// ===== 가상 포트폴리오 시뮬레이터 (#24) =====
const PORTFOLIO_KEY = "mir_portfolio_v1";
const DIVIDEND_PLAN_KEY = "mir_dividend_plan_v1";
const INVESTMENT_JOURNAL_KEY = "mir_investment_journal_v1";
const REBALANCE_TARGET_KEY = "mir_rebalance_targets_v1";
const REBALANCE_TOTAL_EPS = 0.01;
const PORTFOLIO_DONUT_MODE_KEY = "mir_portfolio_donut_mode_v1";
const STRESS_TEST_KEY = "mir_stress_test_v1";
const PORTFOLIO_FX_KEY = "mir_portfolio_entry_fx_v1";
let portfolio = [];
let dividendPlan = {};
let investmentJournal = [];
let rebalanceTargets = {};
let portfolioDonutMode = "sector";
let stressTestState = { scenario: "market", overrides: {} };
let portfolioEntryFx = {};
let benchmarkAttributionRequest = 0;
const PIE_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#64748b", "#14b8a6", "#eab308"];

function loadPortfolio() {
  try {
    const saved = JSON.parse(localStorage.getItem(PORTFOLIO_KEY));
    portfolio = Array.isArray(saved) ? saved.filter((p) => p && p.ticker) : [];
  } catch (e) { portfolio = []; }
}
function savePortfolio() {
  try { localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(portfolio)); } catch (e) { /* ignore */ }
  scheduleCloudSyncPush();
}

function loadPortfolioExtensions() {
  try { dividendPlan = JSON.parse(localStorage.getItem(DIVIDEND_PLAN_KEY) || "{}") || {}; } catch (_) { dividendPlan = {}; }
  try {
    const rows = JSON.parse(localStorage.getItem(INVESTMENT_JOURNAL_KEY) || "[]");
    investmentJournal = Array.isArray(rows) ? rows : [];
  } catch (_) { investmentJournal = []; }
  try { rebalanceTargets = JSON.parse(localStorage.getItem(REBALANCE_TARGET_KEY) || "{}") || {}; } catch (_) { rebalanceTargets = {}; }
  try { portfolioDonutMode = localStorage.getItem(PORTFOLIO_DONUT_MODE_KEY) === "stock" ? "stock" : "sector"; } catch (_) { portfolioDonutMode = "sector"; }
  try {
    const saved = JSON.parse(localStorage.getItem(STRESS_TEST_KEY) || "{}");
    stressTestState = { scenario: saved.scenario || "market", overrides: saved.overrides || {} };
  } catch (_) { stressTestState = { scenario: "market", overrides: {} }; }
  try { portfolioEntryFx = JSON.parse(localStorage.getItem(PORTFOLIO_FX_KEY) || "{}") || {}; } catch (_) { portfolioEntryFx = {}; }
}

function savePortfolioExtension(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* ignore */ }
}

function portfolioDetailRows() {
  return portfolio.map((position) => {
    const stock = stockByTicker(position.ticker);
    const price = Number(stock?.price) || 0;
    return { ...position, stock, price, value: Number(position.qty || 0) * price };
  }).filter((row) => row.stock);
}

function numericDividend(value) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

const DIVIDEND_PAYMENT_LAG_MONTHS = 1;

function parseIsoDateParts(dateStr) {
  const m = String(dateStr || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return { year, month, day };
}

function fmtPortfolioMoney(value) {
  return marketCfg().formatMoney(Number.isFinite(Number(value)) ? Number(value) : 0);
}

function fmtPortfolioMoneyDelta(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  const sign = n >= 0 ? "+" : "-";
  return `${sign}${fmtPortfolioMoney(Math.abs(n))}`;
}

function rebalanceTargetTotalOk(total) {
  return Math.abs(Number(total) - 100) < REBALANCE_TOTAL_EPS;
}

function rebalanceNormalizeTargetList(targets) {
  const total = targets.reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) return targets;
  return targets.map((value) => (value / total) * 100);
}

function rebalanceShareLabel(shares) {
  if (isKrMarket()) {
    const whole = Math.floor(shares);
    if (whole <= 0) return "1주 미만";
    return `${whole.toLocaleString()}주`;
  }
  return `${shares.toFixed(2)}주`;
}

function dividendDefaults(row) {
  const f = row.stock?.fundamentals || (window.MAP_FUNDAMENTALS || {})[row.ticker] || {};
  const direct = numericDividend(f.dividendRate || row.stock?.dividendRate);
  const rawYield = numericDividend(f.dividendYield || row.stock?.dividendYield);
  const yieldRatio = rawYield > 1 ? rawYield / 100 : rawYield;
  return {
    annualDps: direct || (yieldRatio > 0 ? row.price * yieldRatio : 0),
    frequency: 4,
    exDate: f.dividendExDate || row.stock?.dividendExDate || "",
  };
}

function dividendSetting(row) {
  return { ...dividendDefaults(row), ...(dividendPlan[row.ticker] || {}) };
}

function dividendMonthBuckets(rows) {
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, offset) => {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return { key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`, label: `${date.getMonth() + 1}월`, value: 0 };
  });
  rows.forEach((row) => {
    const setting = dividendSetting(row);
    const annualCash = numericDividend(setting.annualDps) * Number(row.qty || 0);
    const frequency = [1, 2, 4, 12].includes(Number(setting.frequency)) ? Number(setting.frequency) : 4;
    if (!(annualCash > 0) || !setting.exDate) return;
    const exParts = parseIsoDateParts(setting.exDate);
    if (!exParts) return;
    const exMonthIdx = exParts.month - 1;
    const step = 12 / frequency;
    const perPayment = annualCash / frequency;
    months.forEach((month, offset) => {
      const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      if (((date.getMonth() - exMonthIdx) + 12) % step !== 0) return;
      const payOffset = offset + DIVIDEND_PAYMENT_LAG_MONTHS;
      if (payOffset < months.length) months[payOffset].value += perPayment;
    });
  });
  return months;
}

function renderDividendPlanner() {
  const table = byId("dividendPlannerTable");
  const summary = byId("dividendPlannerSummary");
  const monthsBox = byId("dividendMonthGrid");
  if (!table || !summary || !monthsBox) return;
  const rows = portfolioDetailRows();
  if (!rows.length) {
    byId("dividendPlannerTotal").textContent = `연 ${marketCfg().formatMoney(0)}`;
    summary.innerHTML = "";
    table.innerHTML = `<p class="muted">가상 포트폴리오에 종목을 추가하면 배당 계획을 만들 수 있습니다.</p>`;
    monthsBox.innerHTML = "";
    return;
  }
  const detailed = rows.map((row) => {
    const setting = dividendSetting(row);
    const annualCash = numericDividend(setting.annualDps) * Number(row.qty || 0);
    return { ...row, setting, annualCash };
  });
  const annual = detailed.reduce((sum, row) => sum + row.annualCash, 0);
  const portfolioValue = detailed.reduce((sum, row) => sum + row.value, 0);
  byId("dividendPlannerTotal").textContent = `연 ${marketCfg().formatMoney(annual)}`;
  summary.innerHTML = `
    <div><span>연간 예상</span><strong>${marketCfg().formatMoney(annual)}</strong></div>
    <div><span>월평균</span><strong>${marketCfg().formatMoney(annual / 12)}</strong></div>
    <div><span>평가액 대비</span><strong>${portfolioValue > 0 ? (annual / portfolioValue * 100).toFixed(2) : "0.00"}%</strong></div>`;
  table.innerHTML = `<table><thead><tr><th>종목</th><th>연 DPS</th><th>주기</th><th>기준일</th><th>연 예상</th></tr></thead><tbody>${detailed.map((row) => `
    <tr><td><strong>${escapeHtml(row.ticker)}</strong><small>${Number(row.qty).toLocaleString()}주</small></td>
      <td><input type="number" min="0" step="0.01" value="${numericDividend(row.setting.annualDps) || ""}" data-dividend-ticker="${escapeHtml(row.ticker)}" data-dividend-field="annualDps" aria-label="${escapeHtml(row.ticker)} 연간 주당배당금"></td>
      <td><select data-dividend-ticker="${escapeHtml(row.ticker)}" data-dividend-field="frequency" aria-label="${escapeHtml(row.ticker)} 배당 주기">${[[12,"월"],[4,"분기"],[2,"반기"],[1,"연"]].map(([value, label]) => `<option value="${value}"${Number(row.setting.frequency) === value ? " selected" : ""}>${label}</option>`).join("")}</select></td>
      <td><input type="date" value="${escapeHtml(row.setting.exDate || "")}" data-dividend-ticker="${escapeHtml(row.ticker)}" data-dividend-field="exDate" aria-label="${escapeHtml(row.ticker)} 배당 기준일"></td>
      <td><strong>${marketCfg().formatMoney(row.annualCash)}</strong></td></tr>`).join("")}</tbody></table>`;
  table.querySelectorAll("[data-dividend-ticker]").forEach((control) => control.addEventListener("change", () => {
    const ticker = control.dataset.dividendTicker;
    const current = dividendSetting(rows.find((row) => row.ticker === ticker));
    current[control.dataset.dividendField] = control.dataset.dividendField === "exDate" ? control.value : Number(control.value || 0);
    dividendPlan[ticker] = current;
    savePortfolioExtension(DIVIDEND_PLAN_KEY, dividendPlan);
    renderDividendPlanner();
  }));
  const months = dividendMonthBuckets(rows);
  monthsBox.innerHTML = `${months.map((month) => `<div class="dividend-month"><span>${month.label}</span><strong>${fmtPortfolioMoney(month.value)}</strong></div>`).join("")}
    <p class="muted dividend-month-note">배당락일 기준 +${DIVIDEND_PAYMENT_LAG_MONTHS}개월 지급 가정(현금 유입 월)</p>`;
}

function renderRebalanceCalculator() {
  const table = byId("rebalanceTable");
  const summary = byId("rebalanceSummary");
  if (!table || !summary) return;
  const rows = portfolioDetailRows();
  if (!rows.length) {
    summary.innerHTML = "";
    table.innerHTML = `<p class="muted">보유 종목을 추가하면 목표 비중을 계산할 수 있습니다.</p>`;
    return;
  }
  const totalValue = rows.reduce((sum, row) => sum + row.value, 0);
  const equal = 100 / rows.length;
  const rawTargets = rows.map((row) => Number.isFinite(Number(rebalanceTargets[row.ticker])) ? Number(rebalanceTargets[row.ticker]) : equal);
  const targetTotal = rawTargets.reduce((sum, value) => sum + value, 0);
  const targets = rebalanceTargetTotalOk(targetTotal) ? rebalanceNormalizeTargetList(rawTargets) : rawTargets;
  const displayTotal = rebalanceTargetTotalOk(targetTotal) ? 100 : targetTotal;
  summary.innerHTML = `
    <div><span>평가금액</span><strong>${fmtPortfolioMoney(totalValue)}</strong></div>
    <div><span>목표 합계</span><strong class="${rebalanceTargetTotalOk(targetTotal) ? "pos" : "neg"}">${displayTotal.toFixed(1)}%</strong></div>
    <div><span>계산 기준</span><strong>현재 총액 유지</strong></div>`;
  table.innerHTML = `<table><thead><tr><th>종목</th><th>현재</th><th>목표</th><th>차이</th><th>주문 수량</th></tr></thead><tbody>${rows.map((row, index) => {
    const currentPct = totalValue > 0 ? row.value / totalValue * 100 : 0;
    const targetPct = targets[index];
    const difference = totalValue * (targetPct - currentPct) / 100;
    const shares = row.price > 0 ? Math.abs(difference) / row.price : 0;
    const action = Math.abs(difference) < Math.max(1, totalValue * 0.001)
      ? "유지"
      : difference > 0
        ? `매수 ${rebalanceShareLabel(shares)}`
        : `매도 ${rebalanceShareLabel(shares)}`;
    return `<tr><td><strong>${escapeHtml(row.ticker)}</strong><small>${priceOrDash(row.price)}</small></td><td>${currentPct.toFixed(1)}%</td><td><input type="number" min="0" max="100" step="0.1" value="${targetPct.toFixed(1)}" data-rebalance-ticker="${escapeHtml(row.ticker)}" aria-label="${escapeHtml(row.ticker)} 목표 비중">%</td><td class="${cls(difference)}">${fmtPortfolioMoneyDelta(difference)}</td><td><strong class="${difference > 0 ? "pos" : difference < 0 ? "neg" : "muted"}">${action}</strong></td></tr>`;
  }).join("")}</tbody></table>`;
  table.querySelectorAll("[data-rebalance-ticker]").forEach((input) => input.addEventListener("change", () => {
    rebalanceTargets[input.dataset.rebalanceTicker] = Math.max(0, Number(input.value) || 0);
    savePortfolioExtension(REBALANCE_TARGET_KEY, rebalanceTargets);
    renderRebalanceCalculator();
  }));
}

function setEqualRebalanceTargets() {
  const rows = portfolioDetailRows();
  if (!rows.length) return;
  const value = 100 / rows.length;
  rows.forEach((row) => { rebalanceTargets[row.ticker] = value; });
  normalizeRebalanceTargets();
}

function normalizeRebalanceTargets() {
  const rows = portfolioDetailRows();
  const total = rows.reduce((sum, row) => sum + Math.max(0, Number(rebalanceTargets[row.ticker]) || 0), 0);
  if (!(total > 0)) return setEqualRebalanceTargets();
  rows.forEach((row) => { rebalanceTargets[row.ticker] = (Math.max(0, Number(rebalanceTargets[row.ticker]) || 0) / total) * 100; });
  savePortfolioExtension(REBALANCE_TARGET_KEY, rebalanceTargets);
  renderRebalanceCalculator();
}

function stressSectorKind(sector) {
  const s = String(sector || "");
  const u = s.toUpperCase();
  if (u === "TECHNOLOGY" || /기술|반도체|정보|IT|소프트웨어/.test(s)) return "technology";
  if (u === "COMMUNICATION SERVICES" || /커뮤니케이션|통신|미디어/.test(s)) return "communication";
  if (u === "FINANCIAL" || /금융|은행|보험|증권/.test(s)) return "financial";
  if (u === "CONSUMER CYCLICAL" || /경기소비|자동차|호텔|레저/.test(s)) return "consumer_cyclical";
  if (u === "CONSUMER DEFENSIVE" || /필수소비/.test(s)) return "consumer_defensive";
  if (u === "HEALTHCARE" || /헬스|의료|바이오|제약/.test(s)) return "healthcare";
  if (u === "UTILITIES" || /유틸/.test(s)) return "utilities";
  if (u === "INDUSTRIALS" || /산업|기계|조선|항공/.test(s)) return "industrials";
  if (u === "ENERGY" || /에너지|석유|가스/.test(s)) return "energy";
  if (u === "REAL ESTATE" || /부동산|리츠|REIT/.test(s)) return "real_estate";
  if (u === "BASIC MATERIALS" || /소재|화학|철강/.test(s)) return "materials";
  return "other";
}

function presetStressShock(row, scenario) {
  const kind = stressSectorKind(row.stock?.sector);
  if (scenario === "market") return -10;
  if (scenario === "tech") {
    if (kind === "technology") return -15;
    if (kind === "communication") return -10;
    return -6;
  }
  if (scenario === "recession") {
    if (["consumer_cyclical", "financial", "industrials", "energy", "materials"].includes(kind)) return -15;
    if (["consumer_defensive", "healthcare", "utilities"].includes(kind)) return -5;
    return -10;
  }
  if (scenario === "rates") {
    if (kind === "financial") return 3;
    if (kind === "real_estate" || kind === "technology") return -12;
    if (kind === "utilities") return -8;
    return -5;
  }
  return -10;
}

function fmtStressMoney(value) {
  if (!Number.isFinite(Number(value))) return "-";
  if (isKrMarket()) return fmtKrw(value);
  return `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtStressDelta(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  const sign = n >= 0 ? "+" : "-";
  if (isKrMarket()) return `${sign}${fmtKrw(Math.abs(n))}`;
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function stressShockFor(row) {
  const override = stressTestState.overrides?.[row.ticker];
  return Number.isFinite(Number(override)) ? Number(override) : presetStressShock(row, stressTestState.scenario);
}

function saveStressTestState() {
  savePortfolioExtension(STRESS_TEST_KEY, stressTestState);
}

function renderStressTest() {
  const table = byId("stressTable");
  const summary = byId("stressSummary");
  const scenario = byId("stressScenario");
  if (!table || !summary || !scenario) return;
  scenario.value = stressTestState.scenario;
  const rows = portfolioDetailRows();
  if (!rows.length) {
    summary.innerHTML = "";
    table.innerHTML = `<p class="muted">보유 종목을 추가하면 시나리오별 예상 손실을 계산할 수 있습니다.</p>`;
    return;
  }
  const original = rows.reduce((sum, row) => sum + row.value, 0);
  const detailed = rows.map((row) => {
    const shock = stressShockFor(row);
    const stressedValue = Math.max(0, row.value * (1 + shock / 100));
    return { ...row, shock, stressedValue, impact: stressedValue - row.value };
  });
  const stressed = detailed.reduce((sum, row) => sum + row.stressedValue, 0);
  const impact = stressed - original;
  summary.innerHTML = `
    <div><span>현재 평가액</span><strong>${fmtStressMoney(original)}</strong></div>
    <div><span>스트레스 후</span><strong>${fmtStressMoney(stressed)}</strong></div>
    <div><span>예상 변화</span><strong class="${cls(impact)}">${fmtStressDelta(impact)} (${original > 0 ? (impact / original * 100).toFixed(1) : "0.0"}%)</strong></div>`;
  table.innerHTML = `<table><thead><tr><th>종목</th><th>현재 평가액</th><th>충격률</th><th>예상 영향</th><th>스트레스 후 비중</th></tr></thead><tbody>${detailed.map((row) => `
    <tr><td><strong>${escapeHtml(row.ticker)}</strong><small>${escapeHtml(row.stock?.sector || "기타")}</small></td>
      <td>${fmtStressMoney(row.value)}</td>
      <td><input type="number" min="-100" max="100" step="1" value="${row.shock.toFixed(1)}" data-stress-ticker="${escapeHtml(row.ticker)}" aria-label="${escapeHtml(row.ticker)} 충격률">%</td>
      <td class="${cls(row.impact)}">${fmtStressDelta(row.impact)}</td>
      <td>${stressed > 0 ? (row.stressedValue / stressed * 100).toFixed(1) : "0.0"}%</td></tr>`).join("")}</tbody></table>`;
  table.querySelectorAll("[data-stress-ticker]").forEach((input) => input.addEventListener("change", () => {
    if (stressTestState.scenario !== "custom") {
      stressTestState.overrides = Object.fromEntries(detailed.map((row) => [row.ticker, row.shock]));
    }
    stressTestState.scenario = "custom";
    stressTestState.overrides[input.dataset.stressTicker] = Math.max(-100, Math.min(100, Number(input.value) || 0));
    saveStressTestState();
    renderStressTest();
  }));
}

function renderPositionSizeCalculator(showErrors = false) {
  const box = byId("positionSizeResult");
  if (!box) return;
  const capital = Number(byId("positionCapital")?.value);
  const entry = Number(byId("positionEntry")?.value);
  const stop = Number(byId("positionStop")?.value);
  const riskPct = Number(byId("positionRiskPct")?.value);
  const maxPct = Number(byId("positionMaxPct")?.value);
  if (!(capital > 0) || !(entry > 0) || !(stop > 0) || !(stop < entry) || !(riskPct > 0) || !(maxPct > 0)) {
    box.innerHTML = `<p class="${showErrors ? "neg" : "muted"}">${showErrors ? "투자금·진입가·손절가를 확인하세요. 롱 포지션은 손절가가 진입가보다 낮아야 합니다." : "값을 입력하면 허용 손실 기준 적정 매수 수량을 계산합니다."}</p>`;
    return;
  }
  const riskBudget = capital * riskPct / 100;
  const riskPerShare = entry - stop;
  const riskShares = Math.floor(riskBudget / riskPerShare);
  const allocationShares = Math.floor((capital * Math.min(100, maxPct) / 100) / entry);
  const shares = Math.max(0, Math.min(riskShares, allocationShares));
  const positionValue = shares * entry;
  const plannedLoss = shares * riskPerShare;
  const binding = riskShares <= allocationShares ? "허용 손실" : "최대 비중";
  const fmtPosMoney = (v) => marketCfg().formatMoney(v);
  box.innerHTML = `
    <div><span>적정 수량</span><strong>${shares.toLocaleString()}주</strong></div>
    <div><span>예상 투자금</span><strong>${fmtPosMoney(positionValue)}</strong></div>
    <div><span>손절 시 손실</span><strong class="neg">-${fmtPosMoney(plannedLoss)}</strong></div>
    <div><span>적용 제한</span><strong>${binding}</strong></div>`;
}

function syncPositionTickerPrice() {
  const raw = byId("positionTicker")?.value || "";
  const ticker = resolveCommunityTickerInput(raw) || String(raw).trim().toUpperCase();
  const stock = stockByTicker(ticker);
  if (!stock) return;
  byId("positionTicker").value = ticker;
  byId("positionEntry").value = Number(stock.price).toFixed(2);
  renderPositionSizeCalculator(false);
}

function currentUsdKrw() {
  const row = (marketHeader.fx || []).find((item) => item.symbol === "KRW=X");
  const rate = Number(row?.price);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

function fmtKrw(value) {
  if (!Number.isFinite(Number(value))) return "-";
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(Number(value));
}

function isKrwQuotedTicker(ticker) {
  const key = String(ticker || "").replace(/\.(KS|KQ)$/i, "");
  if (isKrMarket()) return true;
  return /^\d{6}$/.test(key);
}

function renderKrwPortfolio() {
  const summary = byId("krwPortfolioSummary");
  const table = byId("krwPortfolioTable");
  const rateLabel = byId("krwCurrentRate");
  if (!summary || !table || !rateLabel) return;
  const rows = portfolioDetailRows();
  if (!rows.length) {
    summary.innerHTML = "";
    table.innerHTML = `<p class="muted">보유 종목을 추가하면 원화 평가손익을 계산할 수 있습니다.</p>`;
    rateLabel.textContent = "USD/KRW —";
    return;
  }
  const needsFx = rows.some((row) => !isKrwQuotedTicker(row.ticker));
  const currentFx = currentUsdKrw();
  if (needsFx) {
    rateLabel.textContent = currentFx ? `USD/KRW ${currentFx.toLocaleString(undefined, { maximumFractionDigits: 1 })}` : "USD/KRW 로딩 중";
  } else {
    rateLabel.textContent = "원화 종목 — 환율 미적용";
  }
  if (needsFx && !currentFx) {
    summary.innerHTML = "";
    table.innerHTML = `<p class="muted">실시간 USD/KRW 환율을 불러오는 중입니다.</p>`;
    return;
  }
  const detailed = rows.map((row) => {
    if (isKrwQuotedTicker(row.ticker)) {
      const krwCost = Number(row.qty || 0) * Number(row.avgCost || 0);
      const krwValue = row.value;
      const priceEffect = krwValue - krwCost;
      return {
        ...row,
        krwNative: true,
        entryFx: 1,
        hasSavedFx: false,
        usdCost: 0,
        usdValue: 0,
        krwCost,
        krwValue,
        priceEffect,
        fxEffect: 0,
        totalEffect: priceEffect,
      };
    }
    const savedEntryFx = Number(portfolioEntryFx[row.ticker]);
    const entryFx = Number.isFinite(savedEntryFx) && savedEntryFx > 0 ? savedEntryFx : currentFx;
    const usdCost = Number(row.qty || 0) * Number(row.avgCost || 0);
    const usdValue = row.value;
    const krwCost = usdCost * entryFx;
    const krwValue = usdValue * currentFx;
    const priceEffect = (usdValue - usdCost) * entryFx;
    const fxEffect = usdValue * (currentFx - entryFx);
    return { ...row, krwNative: false, entryFx, hasSavedFx: savedEntryFx > 0, usdCost, usdValue, krwCost, krwValue, priceEffect, fxEffect, totalEffect: krwValue - krwCost };
  });
  const totals = detailed.reduce((acc, row) => {
    ["krwCost", "krwValue", "priceEffect", "fxEffect", "totalEffect"].forEach((key) => { acc[key] += row[key]; });
    return acc;
  }, { krwCost: 0, krwValue: 0, priceEffect: 0, fxEffect: 0, totalEffect: 0 });
  summary.innerHTML = `
    <div><span>원화 평가액</span><strong>${fmtKrw(totals.krwValue)}</strong></div>
    <div><span>총 원화 손익</span><strong class="${cls(totals.totalEffect)}">${fmtKrw(totals.totalEffect)}</strong></div>
    <div><span>주가 효과</span><strong class="${cls(totals.priceEffect)}">${fmtKrw(totals.priceEffect)}</strong></div>
    <div><span>환율 효과</span><strong class="${cls(totals.fxEffect)}">${fmtKrw(totals.fxEffect)}</strong></div>`;
  table.innerHTML = `<table><thead><tr><th>종목</th><th>매입 환율</th><th>원화 원금</th><th>원화 평가액</th><th>주가 효과</th><th>환율 효과</th><th>총 손익</th></tr></thead><tbody>${detailed.map((row) => `
    <tr><td><strong>${escapeHtml(row.ticker)}</strong><small>${Number(row.qty).toLocaleString()}주</small></td>
      <td>${row.krwNative ? `<span class="muted">—</span>` : `<input type="number" min="1" step="0.1" value="${row.entryFx.toFixed(1)}" data-entry-fx-ticker="${escapeHtml(row.ticker)}" aria-label="${escapeHtml(row.ticker)} 매입 환율"><small>${row.hasSavedFx ? "저장됨" : "현재 환율 임시 적용"}</small>`}</td>
      <td>${fmtKrw(row.krwCost)}</td><td>${fmtKrw(row.krwValue)}</td>
      <td class="${cls(row.priceEffect)}">${fmtKrw(row.priceEffect)}</td><td class="${cls(row.fxEffect)}">${fmtKrw(row.fxEffect)}</td><td class="${cls(row.totalEffect)}"><strong>${fmtKrw(row.totalEffect)}</strong></td></tr>`).join("")}</tbody></table>`;
  table.querySelectorAll("[data-entry-fx-ticker]").forEach((input) => input.addEventListener("change", () => {
    const value = Number(input.value);
    if (!(value > 0)) return;
    portfolioEntryFx[input.dataset.entryFxTicker] = value;
    savePortfolioExtension(PORTFOLIO_FX_KEY, portfolioEntryFx);
    renderKrwPortfolio();
  }));
}

async function renderBenchmarkAttribution() {
  const summary = byId("benchmarkAttributionSummary");
  const table = byId("benchmarkAttributionTable");
  const status = byId("benchmarkAttributionStatus");
  if (!summary || !table || !status) return;
  const positions = portfolioDetailRows();
  const benchmarkTicker = normalizeTickerKey(byId("portfolioBenchmark")?.value || (isKrMarket() ? "069500" : "SPY"));
  const periodBars = Number(byId("portfolioBenchmarkPeriod")?.value || 63);
  const requestId = ++benchmarkAttributionRequest;
  if (!positions.length) {
    summary.innerHTML = "";
    table.innerHTML = `<p class="muted">보유 종목을 추가하면 벤치마크 대비 성과를 계산할 수 있습니다.</p>`;
    status.textContent = "";
    return;
  }
  status.textContent = "가격 이력을 불러오는 중입니다.";
  summary.innerHTML = "";
  table.innerHTML = "";
  try {
    const loaded = await Promise.all([...positions.map(async (position) => {
      const detail = await loadStockDetail(position.ticker);
      const merged = detail ? { ...position.stock, ...detail } : position.stock;
      const chartRows = getChartRows(merged);
      return { ...position, rows: chartRows, dateMap: closeSeriesToDateMap(chartRows), synthetic: isSyntheticChart(merged) };
    }), (async () => {
      const stock = stockByTicker(benchmarkTicker);
      const detail = await loadStockDetail(benchmarkTicker);
      const merged = detail ? { ...stock, ...detail } : stock;
      const chartRows = getChartRows(merged);
      return { ticker: benchmarkTicker, stock, rows: chartRows, dateMap: closeSeriesToDateMap(chartRows), synthetic: isSyntheticChart(merged), benchmark: true };
    })()]);
    if (requestId !== benchmarkAttributionRequest) return;
    const benchmark = loaded.find((row) => row.benchmark);
    const valid = loaded.filter((row) => !row.benchmark && !row.synthetic && row.dateMap.size >= 22);
    if (!benchmark || benchmark.synthetic || benchmark.dateMap.size < 22 || !valid.length) {
      status.textContent = "실제 가격 이력이 있는 보유종목과 벤치마크가 필요합니다.";
      return;
    }
    let dateResult = backtestResolveDates([...valid, benchmark], periodBars, null, null);
    if (!dateResult.dates.length) {
      const fallback = Math.min(periodBars, ...valid.map((row) => row.dateMap.size), benchmark.dateMap.size);
      dateResult = backtestResolveDates([...valid, benchmark], fallback, null, null);
    }
    if (!dateResult.dates.length) {
      status.textContent = dateResult.error || "공통 거래일을 계산하지 못했습니다.";
      return;
    }
    const startDate = dateResult.dates[0];
    const endDate = dateResult.dates[dateResult.dates.length - 1];
    const benchmarkReturn = (benchmark.dateMap.get(endDate) / benchmark.dateMap.get(startDate) - 1) * 100;
    const validValue = valid.reduce((sum, row) => sum + row.value, 0);
    const rows = valid.map((row) => {
      const weightPct = validValue > 0 ? row.value / validValue * 100 : 100 / valid.length;
      const returnPct = (row.dateMap.get(endDate) / row.dateMap.get(startDate) - 1) * 100;
      const contribution = returnPct * weightPct / 100;
      const alphaContribution = (returnPct - benchmarkReturn) * weightPct / 100;
      return { ...row, weightPct, returnPct, contribution, alphaContribution };
    });
    const portfolioReturn = rows.reduce((sum, row) => sum + row.contribution, 0);
    const alpha = portfolioReturn - benchmarkReturn;
    summary.innerHTML = `
      <div><span>포트폴리오</span><strong class="${cls(portfolioReturn)}">${fmtPct(portfolioReturn)}</strong></div>
      <div><span>${escapeHtml(benchmarkTicker)}</span><strong class="${cls(benchmarkReturn)}">${fmtPct(benchmarkReturn)}</strong></div>
      <div><span>초과수익</span><strong class="${cls(alpha)}">${fmtPct(alpha)}</strong></div>
      <div><span>비교 기간</span><strong>${escapeHtml(startDate)} ~ ${escapeHtml(endDate)}</strong></div>`;
    table.innerHTML = `<table><thead><tr><th>종목</th><th>현재 비중</th><th>기간 수익률</th><th>수익 기여도</th><th>${escapeHtml(benchmarkTicker)} 대비 기여도</th></tr></thead><tbody>${rows.sort((a, b) => b.alphaContribution - a.alphaContribution).map((row) => `
      <tr><td><button type="button" class="benchmark-ticker" data-benchmark-ticker="${escapeHtml(row.ticker)}">${escapeHtml(row.ticker)}</button></td><td>${row.weightPct.toFixed(1)}%</td><td class="${cls(row.returnPct)}">${fmtPct(row.returnPct)}</td><td class="${cls(row.contribution)}">${row.contribution >= 0 ? "+" : ""}${row.contribution.toFixed(2)}%p</td><td class="${cls(row.alphaContribution)}"><strong>${row.alphaContribution >= 0 ? "+" : ""}${row.alphaContribution.toFixed(2)}%p</strong></td></tr>`).join("")}</tbody></table>`;
    table.querySelectorAll("[data-benchmark-ticker]").forEach((button) => button.addEventListener("click", () => selectTicker(button.dataset.benchmarkTicker, { openSearch: true })));
    const excluded = positions.length - valid.length;
    status.textContent = excluded ? `가격 이력이 부족한 ${excluded}개 종목은 제외했습니다. 현재 비중을 유효 종목에 다시 배분한 근사치입니다.` : "현재 비중을 기간 시작점에 적용한 근사 기여도입니다.";
  } catch (_) {
    if (requestId === benchmarkAttributionRequest) status.textContent = "벤치마크 분석 데이터를 불러오지 못했습니다.";
  }
}

function setupPortfolioExtensions() {
  const equal = byId("rebalanceEqual");
  if (equal && !equal.dataset.bound) {
    equal.dataset.bound = "1";
    equal.addEventListener("click", setEqualRebalanceTargets);
    byId("rebalanceNormalize")?.addEventListener("click", normalizeRebalanceTargets);
  }
  const scenario = byId("stressScenario");
  if (scenario && !scenario.dataset.bound) {
    scenario.dataset.bound = "1";
    scenario.addEventListener("change", () => {
      stressTestState = { scenario: scenario.value, overrides: {} };
      saveStressTestState();
      renderStressTest();
    });
  }
  const positionButton = byId("positionCalculate");
  if (positionButton && !positionButton.dataset.bound) {
    positionButton.dataset.bound = "1";
    positionButton.addEventListener("click", () => renderPositionSizeCalculator(true));
    byId("positionTicker")?.addEventListener("change", syncPositionTickerPrice);
    ["positionCapital", "positionEntry", "positionStop", "positionRiskPct", "positionMaxPct"].forEach((id) => byId(id)?.addEventListener("change", () => renderPositionSizeCalculator(false)));
  }
  const benchmark = byId("portfolioBenchmark");
  if (benchmark && !benchmark.dataset.bound) {
    benchmark.dataset.bound = "1";
    benchmark.addEventListener("change", renderBenchmarkAttribution);
    byId("portfolioBenchmarkPeriod")?.addEventListener("change", renderBenchmarkAttribution);
  }
  const save = byId("journalSave");
  if (save && !save.dataset.bound) {
    save.dataset.bound = "1";
    const date = byId("journalDate");
    if (date && !date.value) date.value = formatKstDateTime().slice(0, 10);
    save.addEventListener("click", () => {
      const rawTicker = byId("journalTicker")?.value || "";
      const ticker = resolveCommunityTickerInput(rawTicker) || String(rawTicker).trim().toUpperCase();
      const thesis = String(byId("journalThesis")?.value || "").trim();
      if (!ticker || !stockByTicker(ticker) || !thesis) {
        showAppToast("유효한 티커와 투자 근거를 입력하세요");
        return;
      }
      investmentJournal.unshift({
        id: `${Date.now()}-${ticker}`,
        ticker,
        status: byId("journalStatus")?.value || "idea",
        date: byId("journalDate")?.value || formatKstDateTime().slice(0, 10),
        entry: Number(byId("journalEntry")?.value) || null,
        target: Number(byId("journalTarget")?.value) || null,
        stop: Number(byId("journalStop")?.value) || null,
        thesis,
      });
      investmentJournal = investmentJournal.slice(0, 100);
      savePortfolioExtension(INVESTMENT_JOURNAL_KEY, investmentJournal);
      ["journalTicker", "journalEntry", "journalTarget", "journalStop", "journalThesis"].forEach((id) => { const el = byId(id); if (el) el.value = ""; });
      renderInvestmentJournal();
    });
  }
}

function renderInvestmentJournal() {
  const list = byId("journalList");
  if (!list) return;
  setupPortfolioExtensions();
  byId("journalCount").textContent = `${investmentJournal.length}건`;
  if (!investmentJournal.length) {
    list.innerHTML = `<p class="muted">투자 근거를 기록하면 목표가·손절가와 함께 추적할 수 있습니다.</p>`;
    return;
  }
  const labels = { idea: "검토", open: "보유", closed: "종료" };
  list.innerHTML = investmentJournal.map((row) => `
    <article class="journal-entry">
      <button type="button" class="journal-ticker" data-journal-ticker="${escapeHtml(row.ticker)}">${escapeHtml(row.ticker)}</button>
      <div><strong>${escapeHtml(row.thesis)}</strong><small>${escapeHtml(row.date || "")} · 진입 ${row.entry ? `$${Number(row.entry).toFixed(2)}` : "-"} · 목표 ${row.target ? `$${Number(row.target).toFixed(2)}` : "-"} · 손절 ${row.stop ? `$${Number(row.stop).toFixed(2)}` : "-"}</small></div>
      <select data-journal-status="${escapeHtml(row.id)}" aria-label="${escapeHtml(row.ticker)} 기록 상태">${Object.entries(labels).map(([value, label]) => `<option value="${value}"${row.status === value ? " selected" : ""}>${label}</option>`).join("")}</select>
      <button type="button" class="journal-delete" data-journal-delete="${escapeHtml(row.id)}" aria-label="기록 삭제">삭제</button>
    </article>`).join("");
  list.querySelectorAll("[data-journal-ticker]").forEach((button) => button.addEventListener("click", () => selectTicker(button.dataset.journalTicker, { openSearch: true })));
  list.querySelectorAll("[data-journal-status]").forEach((select) => select.addEventListener("change", () => {
    const row = investmentJournal.find((item) => item.id === select.dataset.journalStatus);
    if (row) row.status = select.value;
    savePortfolioExtension(INVESTMENT_JOURNAL_KEY, investmentJournal);
    renderInvestmentJournal();
  }));
  list.querySelectorAll("[data-journal-delete]").forEach((button) => button.addEventListener("click", () => {
    investmentJournal = investmentJournal.filter((item) => item.id !== button.dataset.journalDelete);
    savePortfolioExtension(INVESTMENT_JOURNAL_KEY, investmentJournal);
    renderInvestmentJournal();
  }));
}

function setupPortfolio() {
  const add = byId("pfAdd");
  if (add && !add.dataset.bound) {
    add.dataset.bound = "1";
    const doAdd = () => {
      const t = resolveCommunityTickerInput(byId("pfTicker").value) || String(byId("pfTicker").value || "").trim().toUpperCase();
      const qty = Number(byId("pfQty").value);
      const cost = Number(byId("pfCost").value);
      if (!t) { showAppToast("종목 코드를 입력해 주세요."); return; }
      if (!stockByTicker(t)) { showAppToast(`'${t}' 종목을 찾지 못했습니다. 티커·종목명을 확인해 주세요.`); return; }
      if (!(qty > 0)) { showAppToast("수량은 0보다 커야 합니다."); return; }
      if (!(cost > 0)) { showAppToast("평단가는 0보다 커야 합니다."); return; }
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
  setupPortfolioExtensions();
  const summaryEl = byId("pfSummary");
  const tableEl = byId("pfTable");
  const pieEl = byId("pfPie");
  if (!tableEl) return;
  if (!portfolio.length) {
    if (summaryEl) summaryEl.innerHTML = "";
    tableEl.innerHTML = `<p class="muted">보유 종목을 추가하면 손익과 섹터 분산이 표시됩니다.</p>`;
    if (pieEl) pieEl.innerHTML = "";
    renderDividendPlanner();
    renderRebalanceCalculator();
    renderStressTest();
    renderPositionSizeCalculator(false);
    renderKrwPortfolio();
    renderBenchmarkAttribution();
    renderInvestmentJournal();
    renderPortfolioXray();
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

  const fmtPfMoney = (v) => marketCfg().formatMoney(v);
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="pf-stat"><span>평가금액</span><strong>${fmtPfMoney(totalValue)}</strong></div>
      <div class="pf-stat"><span>투자원금</span><strong>${fmtPfMoney(totalCost)}</strong></div>
      <div class="pf-stat"><span>평가손익</span><strong class="${cls(totalPL)}">${totalPL >= 0 ? "+" : ""}${fmtPfMoney(Math.abs(totalPL))} (${fmtPct(totalPLPct)})</strong></div>
      <div class="pf-stat"><span>오늘 기여도</span><strong class="${cls(dayContribution)}">${fmtPct(dayContribution)}</strong></div>`;
  }

  rows.sort((a, b) => b.value - a.value);
  const body = rows.map((r) => `<tr>
    <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.ticker)}">${escapeHtml(isKrMarket() ? (r.stock?.company || r.ticker) : r.ticker)}</button></td>
    <td class="ins-num">${r.qty.toLocaleString()}</td>
    <td class="ins-num">${fmtPfMoney(r.avgCost)}</td>
    <td class="ins-num">${fmtPfMoney(r.price)}</td>
    <td class="ins-num">${fmtPfMoney(r.value)}</td>
    <td class="ins-num">${totalValue > 0 ? (r.value / totalValue * 100).toFixed(1) : "0"}%</td>
    <td class="ins-num ${cls(r.pl)}">${fmtPct(r.plPct)}</td>
    <td class="ins-num"><button type="button" class="pf-del" data-ticker="${escapeHtml(r.ticker)}" title="삭제">✕</button></td>
  </tr>`).join("");
  tableEl.innerHTML = `<table class="insider-table"><thead><tr><th>종목</th><th class="ins-num">수량</th><th class="ins-num">평단</th><th class="ins-num">현재가</th><th class="ins-num">평가액</th><th class="ins-num">비중</th><th class="ins-num">손익</th><th></th></tr></thead><tbody>${body}</tbody></table>`;
  tableEl.querySelectorAll(".ins-ticker").forEach((b) => b.addEventListener("click", () => selectTicker(b.dataset.ticker, { openSearch: true })));
  tableEl.querySelectorAll(".pf-del").forEach((b) => b.addEventListener("click", () => {
    portfolio = portfolio.filter((p) => p.ticker !== b.dataset.ticker); savePortfolio(); renderPortfolio();
  }));

  // 섹터/종목 비중 도넛
  if (pieEl) {
    let slices;
    if (portfolioDonutMode === "stock") {
      slices = rows.map((row) => ({ label: row.ticker, ticker: row.ticker, value: row.value })).sort((a, b) => b.value - a.value);
    } else {
      const bySector = {};
      rows.forEach((row) => { bySector[row.sector] = (bySector[row.sector] || 0) + row.value; });
      slices = Object.entries(bySector).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    }
    const legend = slices.map((slice, index) => {
      const content = `<i style="background:${PIE_COLORS[index % PIE_COLORS.length]}"></i><span>${escapeHtml(slice.label)}</span><b>${totalValue > 0 ? (slice.value / totalValue * 100).toFixed(0) : "0"}%</b>`;
      return slice.ticker ? `<button type="button" class="pf-leg pf-leg-button" data-pie-ticker="${escapeHtml(slice.ticker)}">${content}</button>` : `<div class="pf-leg">${content}</div>`;
    }).join("");
    pieEl.innerHTML = `
      <div class="pf-pie-head">
        <div class="pf-pie-title">${portfolioDonutMode === "stock" ? "종목 비중" : "섹터 분산"}</div>
        <div class="pf-pie-switch" role="group" aria-label="포트폴리오 비중 표시 기준">
          <button type="button" data-pie-mode="sector" class="${portfolioDonutMode === "sector" ? "is-active" : ""}">섹터</button>
          <button type="button" data-pie-mode="stock" class="${portfolioDonutMode === "stock" ? "is-active" : ""}">종목</button>
        </div>
      </div>
      ${donutSvg(slices)}<div class="pf-legend">${legend}</div>`;
    pieEl.querySelectorAll("[data-pie-mode]").forEach((button) => button.addEventListener("click", () => {
      portfolioDonutMode = button.dataset.pieMode === "stock" ? "stock" : "sector";
      try { localStorage.setItem(PORTFOLIO_DONUT_MODE_KEY, portfolioDonutMode); } catch (_) { /* ignore */ }
      renderPortfolio();
    }));
    pieEl.querySelectorAll("[data-pie-ticker]").forEach((button) => button.addEventListener("click", () => selectTicker(button.dataset.pieTicker, { openSearch: true })));
  }
  renderDividendPlanner();
  renderRebalanceCalculator();
  renderStressTest();
  renderPositionSizeCalculator(false);
  renderKrwPortfolio();
  renderBenchmarkAttribution();
  renderInvestmentJournal();
  renderPortfolioXray();
}

// 포트폴리오 X-ray — 보유 비중 가중 팩터 노출(밸류·모멘텀·퀄리티·성장·규모 시장 백분위)
// + 집중도(HHI·상위3비중·유효종목수). 섹터 분산은 도넛, 배당 인컴은 배당 캘린더가 커버.
function renderPortfolioXray() {
  const host = byId("pfXrayBody");
  const card = byId("pfXrayCard");
  if (!host) return;
  const rows = portfolioDetailRows().filter((r) => r.value > 0);
  if (rows.length < 2) {
    if (card) card.style.display = "none";
    host.innerHTML = "";
    return;
  }
  if (card) card.style.display = "";
  const total = rows.reduce((s, r) => s + r.value, 0);
  // 가중 팩터 노출: Σ(비중 × 종목 팩터 백분위) / Σ비중(백분위 있는 것만)
  const axes = [["밸류", "value"], ["모멘텀", "momentum"], ["퀄리티", "quality"], ["성장", "growth"], ["규모", "size"]];
  const acc = {}; const wsum = {};
  for (const [, k] of axes) { acc[k] = 0; wsum[k] = 0; }
  for (const r of rows) {
    const f = (typeof factorPercentiles === "function") ? factorPercentiles({ ticker: r.ticker }) : null;
    if (!f) continue;
    for (const [, k] of axes) {
      if (Number.isFinite(f[k])) { acc[k] += r.value * f[k]; wsum[k] += r.value; }
    }
  }
  const bar = (name, v) => {
    const col = v == null ? "var(--muted)" : v >= 70 ? "#30a46c" : v >= 40 ? "#5b8def" : "#d98a2b";
    return `<div style="display:flex;align-items:center;gap:8px;margin:5px 0">
      <span style="width:44px;font-size:12px;color:var(--muted)">${name}</span>
      <div style="flex:1;height:7px;border-radius:4px;background:var(--panel-soft);overflow:hidden"><div style="width:${v == null ? 0 : v}%;height:100%;background:${col}"></div></div>
      <span style="width:34px;text-align:right;font-size:12px;font-weight:600">${v == null ? "—" : v}</span>
    </div>`;
  };
  const factorBars = axes.map(([label, k]) => bar(label, wsum[k] > 0 ? Math.round(acc[k] / wsum[k]) : null)).join("");
  // 집중도: HHI(비중 제곱합), 상위3 비중, 유효 종목수(1/HHI)
  const weights = rows.map((r) => r.value / total).sort((a, b) => b - a);
  const hhi = weights.reduce((s, w) => s + w * w, 0);
  const top3 = weights.slice(0, 3).reduce((s, w) => s + w, 0) * 100;
  const effN = hhi > 0 ? 1 / hhi : 0;
  const concGrid = aiMetricGrid([
    { label: "HHI 집중도", value: hhi.toFixed(3), tone: hhi > 0.25 ? "warn" : "", detail: hhi > 0.25 ? "높음" : hhi > 0.15 ? "보통" : "분산" },
    { label: "상위 3종목 비중", value: `${top3.toFixed(0)}%`, tone: top3 > 60 ? "warn" : "" },
    { label: "유효 종목수", value: effN.toFixed(1), detail: `보유 ${rows.length}종목` },
  ]);
  host.innerHTML = `<div style="font-size:12px;color:var(--muted);margin:2px 0 4px">팩터 노출 (비중 가중 백분위)</div>${factorBars}
    <div style="font-size:12px;color:var(--muted);margin:14px 0 6px">집중도</div>${concGrid}`;
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
      <td class="${cls(item.changePct)}">${fmtDailyPct(item.changePct)}</td>
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

// KR 마켓 데이터 탭: 한국 ETF 기반(전부 KR 스냅샷 data.stocks에 존재). 미국 ETF는
// KR 모드 data.stocks에 없어 빈 표가 되므로 한국 상품으로 대체한다.
const KR_MARKET_GROUPS = [
  { title: "주요 지수 · 레버리지", tickers: [
    ["069500", "코스피200 (KODEX 200)"], ["229200", "코스닥150"], ["102110", "TIGER 200"],
    ["122630", "코스피 레버리지"], ["252670", "코스피 인버스2X"]
  ] },
  { title: "섹터 ETF", tickers: [
    ["091160", "반도체"], ["305720", "2차전지"], ["091170", "은행"],
    ["091180", "자동차"], ["244580", "바이오"]
  ] },
  { title: "해외 ETF", tickers: [
    ["360750", "미국 S&P500"], ["133690", "미국 나스닥100"]
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
  // 미 의회 거래는 미국 전용 데이터 → KR/ETF에선 숨김.
  if (isKrMarket() || !item || isStockEtf(item)) {
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
    s && s.sector && !isStockEtf(s) && Number.isFinite(Number(s.changePct)));
  const n = stocks.length;
  if (n < 5) { box.innerHTML = ""; return; }

  const adv = stocks.filter((s) => Number(s.changePct) > 0).length;
  const dec = stocks.filter((s) => Number(s.changePct) < 0).length;
  const unch = n - adv - dec;
  const advPct = (adv / n) * 100;
  const upPctOf = (key) => (stocks.filter((s) => Number(s[key]) > 0).length / n) * 100;
  const weekUp = upPctOf("weekChangePct");
  const monthUp = upPctOf("monthChangePct");
  const quarterUp = upPctOf("threeMonthChangePct");

  const strong = stocks.filter((s) => Number(s.rsScore) >= 80).length;
  const weak = stocks.filter((s) => Number(s.rsScore) <= 20).length;
  const strongPct = (strong / n) * 100;

  // RSI 과매수/과매도 분포 — 단기 쏠림. rsi14 결측 종목은 분모에서 제외해 비율 왜곡 방지.
  const rsiN = stocks.filter((s) => Number.isFinite(Number(s.rsi14))).length;
  const overbought = stocks.filter((s) => Number(s.rsi14) >= 70).length;
  const oversold = stocks.filter((s) => Number(s.rsi14) <= 30).length;
  const obPct = rsiN ? (overbought / rsiN) * 100 : null;
  const osPct = rsiN ? (oversold / rsiN) * 100 : null;

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
      <article><span>과매수 / 과매도</span><strong><b class="pos">${overbought.toLocaleString()}</b> / <b class="neg">${oversold.toLocaleString()}</b></strong><em class="muted">RSI≥70 / ≤30${obPct != null ? ` · ${obPct.toFixed(0)}% / ${osPct.toFixed(0)}%` : ""}</em></article>
    </div>
    <div class="breadth-bars">
      ${breadthBar("당일 상승 비율", advPct, `${adv} / ${n}개 상승`)}
      ${breadthBar("1주 상승 비율", weekUp, "주간 추세 참여도")}
      ${breadthBar("1개월 상승 비율", monthUp, "중기 추세 참여도")}
      ${breadthBar("3개월 상승 비율", quarterUp, "분기 추세 참여도")}
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
  if (isKrMarket()) return sector || "기타";
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

function trustStatus(timestamp, count, maxHours, pending = false, allowEmpty = false) {
  // 무거운 데이터셋은 해당 탭을 처음 열 때 로드된다(FEATURE_DATA heavy).
  // 아직 안 받아온 것을 "데이터 없음"으로 보고하면 멀쩡한 파이프라인을 장애로
  // 오진하게 된다 — 실제로 신뢰도 센터가 늘 "확인 필요 8" 을 띄우던 원인이었다.
  if (pending) return { key: "pending", label: "불러오는 중", age: null };
  // allowEmpty: 배당·공급계약·실적발표처럼 비수기엔 0건이 정상인 이벤트 피드. 0건이어도
  // timestamp 가 최신이면(=빌더가 최근 돌았음) 정상으로 본다. timestamp 조차 없으면 결손.
  if (!count && !allowEmpty) return { key: "missing", label: "데이터 없음", age: null };
  const parsed = parseSnapshotDate(timestamp);
  if (!parsed) return count ? { key: "unknown", label: "시각 확인 필요", age: null }
    : { key: "missing", label: "데이터 없음", age: null };
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

const GITHUB_REPO = "https://github.com/seonu-dragon/Mir_US_Stocks";

// 상태가 나쁠 때 "그래서 뭘 해야 하나"에 답하기 위한 소스별 복구 정보.
// workflow 는 .github/workflows/*.yml 의 name: 과 정확히 일치해야 한다
// (deploy-pages.yml 의 workflow_run 목록과 같은 값).
// script 는 그 워크플로우가 실제로 실행하는 빌더다.
const TRUST_RECOVERY = {
  "시장 스냅샷": {
    us: { workflow: "Daily US market snapshot", script: "scripts/update_data.py" },
    kr: { workflow: "Daily Korea market snapshot", script: "scripts/update_korea_data.py" },
    tabs: "홈 시장 요약 · 히트맵 · 종목 검색 · 포트폴리오 평가액",
  },
  "펀더멘털": {
    us: { workflow: "Daily US market snapshot", script: "scripts/build_us_finnhub_metrics.py" },
    kr: { workflow: "Daily Korea market snapshot", script: "scripts/update_korea_data.py" },
    tabs: "종목 상세 지표 · 스크리너 · 히트맵 밸류 지표",
  },
  "내부자 거래": {
    us: { workflow: "Insider trades (SEC Form 4)", script: "scripts/build_insider_trades.py" },
    tabs: "스마트머니 신호",
  },
  "주요 공시": {
    us: { workflow: "Material events (SEC 8-K)", script: "scripts/build_material_events.py" },
    kr: { workflow: "KR DART disclosures + ownership", script: "scripts/build_kr_disclosures.py" },
    tabs: "공시 · 액션 보드 · 종목 이벤트",
  },
  "대량보유": {
    us: { workflow: "Activist stakes (SEC 13D/G)", script: "scripts/build_activist_stakes.py" },
    kr: { workflow: "KR DART disclosures + ownership", script: "scripts/build_kr_ownership.py" },
    tabs: "지분 변동",
  },
  "IPO": {
    us: { workflow: "IPO calendar (SEC S-1/424B4)", script: "scripts/build_ipo_calendar.py" },
    tabs: "IPO 캘린더",
  },
  "공매도": {
    us: { workflow: "Short interest (Nasdaq/FINRA)", script: "scripts/build_short_interest.py" },
    kr: { workflow: "Daily Korea market snapshot", script: "scripts/build_kr_short_interest.py" },
    tabs: "공매도 패널",
  },
  "배당 결정": {
    kr: { workflow: "Daily Korea market snapshot", script: "scripts/build_kr_corp_disclosures.py" },
    tabs: "종목검색 · 배당 서브탭",
  },
  "공급계약": {
    kr: { workflow: "Daily Korea market snapshot", script: "scripts/build_kr_corp_disclosures.py" },
    tabs: "종목검색 · 수주 서브탭",
  },
  "실적발표 반응": {
    kr: { workflow: "Daily Korea market snapshot", script: "scripts/build_kr_earnings_reactions.py" },
    tabs: "종목검색 · 실적발표 서브탭",
  },
  "기관 13F": {
    us: { workflow: "Institutional 13F quarterly refresh", script: "scripts/build_13f_snapshot.py" },
    tabs: "기관 13F · 스마트머니 신호",
  },
  "정치인 매매": {
    us: { workflow: "Congress trades refresh", script: "scripts/build_congress_trades.py" },
    tabs: "의회 거래 · 스마트머니 신호",
  },
  "백악관 일정": {
    us: { workflow: "White House schedule refresh", script: "scripts/schedule_store.py" },
    tabs: "백악관 일정",
  },
  "DART 공시": {
    kr: { workflow: "KR DART disclosures + ownership", script: "scripts/build_kr_disclosures.py" },
    tabs: "공시 · 액션 보드 · 종목 이벤트",
  },
  "지분 공시": {
    kr: { workflow: "KR DART disclosures + ownership", script: "scripts/build_kr_ownership.py" },
    tabs: "지분 변동 · 대량보유",
  },
};

// 상태별로 "무슨 일이 일어난 것인지"와 "무엇을 하면 되는지"를 나눠 쓴다.
// 두 문장이 붙어 있으면 사용자가 원인과 조치를 구분하지 못한다.
function trustDiagnosis(row) {
  const key = row.status.key;
  const wf = row.recovery?.workflow;
  const runHint = wf
    ? `GitHub Actions 에서 "${wf}" 워크플로우를 수동 실행(Run workflow)하면 다시 수집한다.`
    : "해당 빌더 스크립트를 로컬에서 실행하면 다시 수집한다.";
  if (key === "pending") {
    return {
      cause: "무거운 데이터셋이라 필요할 때 내려받는다. 아직 이 브라우저로 받아오는 중이며, 파이프라인 문제가 아니다.",
      fix: "잠시 후 자동으로 갱신된다. 계속 이 상태면 네트워크나 파일 배포를 확인한다.",
    };
  }
  if (key === "missing") {
    return {
      cause: "이 데이터셋이 브라우저에 로드되지 않았다. 빌드가 한 번도 성공하지 않았거나, 이 시장(US/KR)에서 제공하지 않는 소스일 수 있다.",
      fix: runHint,
    };
  }
  if (key === "unknown") {
    return {
      cause: "데이터는 있는데 기준 시각이 비어 있다. 빌더가 updatedAtKst 를 쓰지 않았을 때 나타난다.",
      fix: "빌더 출력에 기준 시각 필드가 들어가는지 확인한다. " + runHint,
    };
  }
  if (key === "stale") {
    return {
      cause: `갱신 주기(${row.cadence})를 넘겼다. 워크플로우가 실패했거나, 커밋은 됐지만 배포가 안 됐을 수 있다.`,
      fix: `먼저 Actions 실행 이력에서 실패 여부를 본다. 성공했는데도 오래됐다면 배포 쪽 문제다 — 커밋 메시지의 [skip ci] 나 deploy-pages.yml 의 workflow_run 목록에 이 워크플로우 이름이 빠졌는지 확인한다. ${runHint}`,
    };
  }
  if (key === "warn") {
    return {
      cause: "아직 유효하지만 다음 갱신 시점이 가까워졌다.",
      fix: "조치 불필요. 다음 예정 실행 후에도 시각이 그대로면 그때 확인한다.",
    };
  }
  return { cause: "정상 주기 안에서 갱신되고 있다.", fix: "조치 불필요." };
}

function dataTrustSources() {
  const snapshotTime = data.updatedAtKst || data.updated_at_kst || "";
  const fundamentals = window.MAP_FUNDAMENTALS || {};
  const cfg = marketCfg();
  // 시장별로 워크플로우가 다르다(US/KR). 현재 시장 것만 보여준다.
  const recoveryFor = (name) => {
    const meta = TRUST_RECOVERY[name];
    if (!meta) return null;
    const perMarket = meta[cfg.id] || meta.us || null;
    return perMarket ? { ...perMarket, tabs: meta.tabs } : null;
  };
  const source = (name, provider, payload, keys, maxHours, cadence, featureKey = "", fallbackTime = "", allowEmpty = false) => {
    const count = trustPayloadCount(payload, keys);
    const timestamp = payload?.updatedAtKst || payload?.updated_at_kst || payload?.updated || fallbackTime;
    // 이 시장에서 쓰는 데이터셋인데 전역이 아직 비어 있으면 = 로딩 전(장애 아님).
    const meta = FEATURE_DATA[featureKey];
    const pending = Boolean(meta && featureDataEnabled(meta, cfg) && !window[meta.global]);
    return { name, provider, count, timestamp, maxHours, cadence, featureKey, recovery: recoveryFor(name), status: trustStatus(timestamp, count, maxHours, pending, allowEmpty) };
  };
  const rows = [
    {
      name: "시장 스냅샷",
      provider: cfg.id === "kr" ? "KRX · Yahoo · 네이버 금융" : "Nasdaq · Yahoo",
      count: (data.stocks || []).length,
      timestamp: snapshotTime,
      maxHours: 36,
      cadence: cfg.snapshotCadence || "매일 06:00 KST",
      recovery: recoveryFor("시장 스냅샷"),
      status: trustStatus(snapshotTime, (data.stocks || []).length, 36),
    },
    {
      name: "펀더멘털",
      provider: cfg.id === "kr" ? "네이버 금융 · Yahoo" : "Nasdaq · SEC · Yahoo",
      count: Object.keys(fundamentals).length,
      timestamp: snapshotTime,
      maxHours: 36,
      cadence: "시장 스냅샷과 동시",
      recovery: recoveryFor("펀더멘털"),
      status: trustStatus(snapshotTime, Object.keys(fundamentals).length, 36),
    },
  ];
  if (cfg.features?.insider !== false) rows.push(source("내부자 거래", "SEC Form 4", window.INSIDER_TRADES, ["trades"], 72, "영업일 기준 수집", "insider"));
  if (cfg.features?.materialEvents !== false) rows.push(source("주요 공시", cfg.id === "kr" ? "DART · 공시" : "SEC 8-K", window.MATERIAL_EVENTS, ["events"], 72, "매일", "events"));
  if (cfg.features?.activist !== false) rows.push(source("대량보유", "SEC 13D/G", window.ACTIVIST_STAKES, ["filings"], 168, "매주", "activist"));
  if (cfg.features?.ipo !== false) rows.push(source("IPO", cfg.id === "kr" ? "KRX · 공시" : "SEC S-1 · 424B4", window.IPO_CALENDAR, ["ipos"], 168, "매주", "ipo"));
  if (cfg.features?.shortInterest !== false) rows.push(source("공매도", cfg.id === "kr" ? "KRX 공매도 종합포털" : "FINRA · Nasdaq", window.SHORT_INTEREST, ["rows", "stocks"], cfg.id === "kr" ? 120 : 1080, cfg.id === "kr" ? "T+2 매 거래일" : "월 2회", "short"));
  if (cfg.features?.sec13f !== false) rows.push(source("기관 13F", "SEC EDGAR", window.INSTITUTIONAL_13F, ["institutions"], 2880, "분기 공시 후", "inst13f"));
  if (cfg.features?.congress !== false) rows.push(source("정치인 매매", "Congress PTR", window.CONGRESS_TRADES, ["trades", "byTicker"], 336, "주기적 수집", "congress"));
  if (cfg.features?.whiteHouse !== false) rows.push(source("백악관 일정", "The White House", window.WHITE_HOUSE_SCHEDULE, ["events", "schedule"], 48, "06 · 16 · 21시", "whitehouse"));
  // KR 전용 소스. 이게 빠져 있어서 2026-07-17 에 DART 데이터가 배포 트리거 끊김으로
  // 사이트에 안 나가는 동안에도 신뢰도 센터는 "정상"만 보여줬다.
  if (cfg.features?.krDart) rows.push(source("DART 공시", "DART Open API", window.KR_DISCLOSURES, ["disclosures"], 48, "매일", "krDart"));
  if (cfg.features?.krOwnership) rows.push(source("지분 공시", "DART Open API", window.KR_OWNERSHIP, ["majorHolders", "insiders"], 72, "매일", "krOwnership"));
  // 파생 이벤트 피드 — 비수기엔 0건이 정상이라 allowEmpty(0건+최신이면 정상). 빌더가 안
  // 돌아 timestamp 가 낡으면 그때 '갱신 지연'으로 잡힌다.
  if (cfg.features?.krDart) {
    rows.push(source("배당 결정", "DART 원문 파싱", window.KR_DIVIDENDS, ["rows"], 72, "매일", "krDividends", "", true));
    rows.push(source("공급계약", "DART 원문 파싱", window.KR_CONTRACTS, ["rows"], 72, "매일", "krContracts", "", true));
    rows.push(source("실적발표 반응", "DART · Yahoo", window.KR_EARNINGS_REACTIONS, ["rows"], 72, "매일", "krEarningsReact", "", true));
  }
  return rows;
}

// 신뢰도 센터가 로드를 시도해 본 feature 키(성공/실패 무관). 재요청 폭주 방지용.
const trustLoadAttempted = new Set();

function renderDataTrustCenter() {
  const grid = byId("dataTrustGrid");
  const summary = byId("dataTrustSummary");
  if (!grid || !summary) return;
  const sources = dataTrustSources();

  // 아직 안 받아온 지연 로딩 데이터셋은 여기서 직접 받아온다. 신뢰도 센터가
  // 로드도 안 된 데이터를 "없음"이라고 보고하면 안 되기 때문이다.
  // 한 번 시도한 키는 다시 요청하지 않는다 — 성공 시 재렌더가 다시 이 코드를
  // 타는데, 실패한 키는 계속 pending 으로 남아 무한 재요청이 되기 때문이다.
  // (ensureFeatureData 는 script error 시 캐시를 지워 재요청을 허용한다.)
  sources.filter((row) => row.status.key === "pending" && !trustLoadAttempted.has(row.featureKey))
    .forEach((row) => {
      trustLoadAttempted.add(row.featureKey);
      ensureFeatureData(row.featureKey).then((ok) => {
        // 실패했으면 다시 그려도 pending 그대로다. 성공했을 때만 갱신한다.
        if (ok && byId("dataTrustGrid")) renderDataTrustCenter();
      });
    });

  const counts = sources.reduce((acc, row) => { acc[row.status.key] = (acc[row.status.key] || 0) + 1; return acc; }, {});
  summary.innerHTML = `
    <div><span>정상</span><strong class="pos">${counts.good || 0}</strong></div>
    <div><span>주의·지연</span><strong class="warn">${(counts.warn || 0) + (counts.stale || 0)}</strong></div>
    <div><span>확인 필요</span><strong>${(counts.missing || 0) + (counts.unknown || 0)}</strong></div>
    <div><span>${counts.pending ? "불러오는 중" : "마지막 점검"}</span><strong>${counts.pending ? counts.pending : escapeHtml(formatKstDateTime().slice(5))}</strong></div>`;
  grid.innerHTML = sources.map((row) => {
    const { cause, fix } = trustDiagnosis(row);
    // pending 은 곧 스스로 해소되므로 경고처럼 펼쳐두지 않는다.
    const needsAction = !["good", "warn", "pending"].includes(row.status.key);
    const wf = row.recovery?.workflow;
    // 실행 이력 링크: 워크플로우 파일명을 모르니 name 으로 검색되는 Actions 목록으로 보낸다.
    const actionsHref = `${GITHUB_REPO}/actions${wf ? `?query=${encodeURIComponent(wf)}` : ""}`;
    return `
    <article class="data-trust-card trust-${row.status.key}">
      <div class="data-trust-card-head"><strong>${escapeHtml(row.name)}</strong><span>${escapeHtml(row.status.label)}</span></div>
      <p>${escapeHtml(row.provider)}</p>
      <dl>
        <div><dt>기준 시각</dt><dd>${escapeHtml(row.timestamp || "확인 불가")}</dd></div>
        <div><dt>로드 수량</dt><dd>${Number(row.count || 0).toLocaleString()}건</dd></div>
        <div><dt>갱신 정책</dt><dd>${escapeHtml(row.cadence)}</dd></div>
      </dl>
      <small>${escapeHtml(trustAgeLabel(row.status.age))}</small>
      <details class="data-trust-detail"${needsAction ? " open" : ""}>
        <summary>${needsAction ? "왜 이 상태인가 · 어떻게 고치나" : "상세"}</summary>
        <dl>
          ${row.recovery?.tabs ? `<div><dt>영향받는 화면</dt><dd>${escapeHtml(row.recovery.tabs)}</dd></div>` : ""}
          <div><dt>원인</dt><dd>${escapeHtml(cause)}</dd></div>
          <div><dt>조치</dt><dd>${escapeHtml(fix)}</dd></div>
          ${wf ? `<div><dt>갱신 워크플로우</dt><dd><code>${escapeHtml(wf)}</code></dd></div>` : ""}
          ${row.recovery?.script ? `<div><dt>빌더</dt><dd><code>${escapeHtml(row.recovery.script)}</code></dd></div>` : ""}
        </dl>
        <a class="data-trust-link" href="${escapeHtml(actionsHref)}" target="_blank" rel="noopener">실행 이력 보기 →</a>
      </details>
    </article>`;
  }).join("");
  const refresh = byId("dataTrustRefresh");
  if (refresh && !refresh.dataset.bound) {
    refresh.dataset.bound = "1";
    refresh.addEventListener("click", () => {
      trustLoadAttempted.clear();   // 수동 재확인은 실패했던 로드도 다시 시도한다
      renderDataTrustCenter();
      showAppToast("데이터 상태를 다시 확인했습니다");
    });
  }
}

function renderMarkets() {
  const container = byId("marketsTables");
  if (!container) return;
  const byTicker = {};
  data.stocks.forEach((s) => { byTicker[s.ticker] = s; });

  const sections = (isKrMarket() ? KR_MARKET_GROUPS : MARKET_GROUPS).map((group) => {
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
                <td>${priceOrDash(s.price)}</td>
                <td class="${cls(s.changePct)}">${fmtDailyPct(s.changePct)}</td>
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
                    <td class="${cls(f.changePct)}">${fmtDailyPct(f.changePct)}</td>
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

// The two secondary benchmarks ([ticker, label]) used across the ETF RS surfaces.
function etfRsSecondaryBenchmarks() {
  return isKrMarket()
    ? [["069500", "코스피200"], ["229200", "코스닥150"]]
    : [["SPY", "SPY"], ["QQQ", "QQQ"]];
}

// The two "대비" secondary benchmarks shown on each ETF RS card, per market.
function etfRsSecondaryStatsHtml(item, period) {
  return etfRsSecondaryBenchmarks().map(([t, label]) => {
    const v = item.relative?.[t]?.[period] ?? 0;
    return `<span>${label} 대비 <strong class="${cls(v)}">${fmtPct(v)}</strong></span>`;
  }).join("");
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
    ? `<span class="rank-medal rank-${rankIdx + 1}"></span>`
    : `<span class="rank-num">${rankIdx + 1}</span>`;
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
        ${etfRsSecondaryStatsHtml(item, period)}
      </div>
      <div class="peer-list">${peerChips}</div>
      <p class="drilldown-hint">클릭해서 전체 ${totalPeers}개 종목 상세 보기</p>
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

const LEV_ETF_DISCOVER_EXCLUDE = /ultra[- ]short|ultrashort|short[- ]duration|short[- ]maturity|enhanced short maturity/i;

const LEV_ETF_DISCOVER_PATTERNS = [
  /\b2x\b/i, /\b3x\b/i, /\b4x\b/i, /\b-2x\b/i, /\b-3x\b/i,
  /\bultrapro\b/i, /\bultra\b/i, /\binverse\b/i, /\bshort\b/i,
  /\bbear\b/i, /\bbull\b/i, /\bleverag/i, /\bcovered call\b/i, /\bbuywrite\b/i,
  /\boption income\b/i, /\bweeklypay\b/i, /\b0dte\b/i,
  /\bdaily target\b/i, /\bdaily (bull|bear)\b/i, /\bdefined outcome\b/i, /\bbuffer\b/i,
  /\bdirexion daily\b/i, /\byieldmax\b/i, /\bgraniteshares\b/i, /\btradr\b/i,
  /\bdefiance\b/i, /\bt-?rex\b/i, /\bleverage shares\b/i, /\bkraneshares\b/i,
  /\bmicrosectors\b/i, /\bvolatility shares\b/i,
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

// Korean ETF names use 레버리지 / 인버스 / 2X for discovery from the snapshot.
const LEV_ETF_DISCOVER_PATTERNS_KR = [/레버리지/, /인버스/, /\d+\s*배/, /\b[234]x\b/i];

function isLeveragedOptionEtfStock(stock) {
  if (!stock || !isStockEtf(stock)) return false;
  const text = `${stock.company || ""} ${stock.industry || ""}`;
  if ((stock.industry || "").includes("Leveraged/Option ETF")) return true;
  if (Array.isArray(stock.groups) && stock.groups.includes("lev_etf")) return true;
  if (stock.bucket === "lev_etf") return true;
  if (LEV_ETF_DISCOVER_EXCLUDE.test(text)) return false;
  const patterns = isKrMarket() ? LEV_ETF_DISCOVER_PATTERNS_KR : LEV_ETF_DISCOVER_PATTERNS;
  return patterns.some((re) => re.test(text));
}

function leveragedEtfCatalogItems() {
  // KR ships a curated catalog inside the snapshot; US uses the LEVERAGED_ETF_CATALOG global.
  const catalog = (isKrMarket() && data.leveragedEtfCatalog?.items)
    || (window.LEVERAGED_ETF_CATALOG && window.LEVERAGED_ETF_CATALOG.items)
    || [];
  const byTicker = new Map(catalog.map((item) => [item.ticker, { ...item }]));
  (data.stocks || []).forEach((stock) => {
    if (!isLeveragedOptionEtfStock(stock)) return;
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
  const chg = hasLive ? fmtDailyPct(live.changePct) : "—";
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
  const candidates = isKrMarket() ? ["069500", "102110", "229200"] : ["SPY", "VOO", "IVV", "QQQ"];
  for (const t of candidates) {
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
    wrap.innerHTML = `<p class="muted">벤치마크 가격 데이터를 찾지 못했습니다.</p>`;
    if (legendEl) legendEl.innerHTML = "";
    return;
  }
  const tailLen = Number(byId("rrgTail")?.value || 5);
  const points = [];
  getSectorEtfs().forEach((etf) => {
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
  if (!Number.isFinite(c)) return "var(--surface-2)";
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
    const catUpdated = (isKrMarket() && data.leveragedEtfCatalog?.updated) || window.LEVERAGED_ETF_CATALOG?.updated || "";
    meta.textContent = `총 ${items.length}개 · 스냅샷 시세 ${liveCount}개 · ${catUpdated}`;
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
  const [[bench1, bench1Label], [bench2, bench2Label]] = etfRsSecondaryBenchmarks();
  if (byId("constituentBench1Header")) byId("constituentBench1Header").textContent = `${bench1Label} 대비`;
  if (byId("constituentBench2Header")) byId("constituentBench2Header").textContent = `${bench2Label} 대비`;

  byId("constituentPanelBody").innerHTML = allPeers.map((peer, idx) => {
    const spyRel = peer[`rel_${bench1}`]?.[period] ?? (row.relative?.[bench1]?.[period] ?? 0);
    const qqqRel = peer[`rel_${bench2}`]?.[period] ?? (row.relative?.[bench2]?.[period] ?? 0);
    const pct = peer[period] ?? 0;
    const rankIcon = idx === 0 ? "" : idx === 1 ? "" : idx === 2 ? "" : `${idx + 1}`;
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

const briefingFileCache = {};

function renderBriefingSide(side) {
  const key = briefingSel[side];
  const el = byId(side === "kor" ? "koreaBriefingContent" : "usBriefingContent");
  if (!el) return;
  const group = document.querySelector(`.briefing-toggle[data-side="${side}"]`);
  if (group) group.querySelectorAll("button").forEach((b) => b.classList.toggle("is-active", b.dataset.key === key));

  const emptyHtml = `
    <div class="empty-briefing">
      <strong>${BRIEFING_LABELS[key]}</strong><br>
      데이터가 아직 없습니다. 수집 파이프라인 실행 시 자동으로 표시됩니다.
    </div>`;
  // Snapshot ai_briefing (US) → standalone file fallback (KR 스냅샷엔 ai_briefing이 없음).
  const inline = (data.ai_briefing || {})[key] || briefingFileCache[key];
  if (inline) { el.innerHTML = inline; return; }
  el.innerHTML = `<div class="empty-briefing"><strong>${BRIEFING_LABELS[key]}</strong><br>브리핑을 불러오는 중…</div>`;
  fetch(`data/briefings/${key}.json`, { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((b) => {
      const html = b && b.html;
      if (html) briefingFileCache[key] = html;
      if (briefingSel[side] !== key) return; // user toggled away while loading
      el.innerHTML = html || emptyHtml;
    })
    .catch(() => { if (briefingSel[side] === key) el.innerHTML = emptyHtml; });
}

function setupBriefingToggles() {
  document.querySelectorAll(".briefing-toggle").forEach((group) => {
    // 고정 DOM — 재부팅 시 중복 바인딩 방지 (dataset 가드)
    if (group.dataset.bound) return;
    group.dataset.bound = "1";
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
        <td class="${cls(item.changePct || 0)}">${escapeHtml(item.price || "-")}${item.changePct ? ` (${fmtDailyPct(item.changePct)})` : ""}</td>
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
              <span class="community-hot-change ${change == null ? "" : cls(change)}">${change == null ? "—" : fmtDailyPct(change)}</span>
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

// 서버는 더 이상 clientId(=삭제 권한의 근거)나 좋아요 누른 사람 목록을 내려주지
// 않는다. 요청자 기준으로 계산된 mine/liked/likeCount 만 온다.
// `?? ` 폴백은 아직 옛 워커가 떠 있는 동안 UI 가 죽지 않게 하는 임시 경로다 —
// 워커를 재배포하면 응답에 likes/clientId 자체가 없어 자연히 새 경로만 탄다.
function communityLikeCount(post) {
  if (post && typeof post.likeCount === "number") return post.likeCount;
  return Array.isArray(post && post.likes) ? post.likes.length : 0;
}

function communityLikedByMe(post) {
  if (post && typeof post.liked === "boolean") return post.liked;
  return Array.isArray(post && post.likes) && post.likes.includes(getCommunityClientId());
}

// 이 글/댓글이 내 것인가. 서버 판정(mine)을 우선한다.
function communityIsMine(item) {
  if (item && typeof item.mine === "boolean") return item.mine;
  return Boolean(item) && item.clientId === getCommunityClientId();
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
  const reason = await showAppPrompt(
    "신고 사유를 적어주세요(선택). 신고한 글은 내 화면에서 가려지고, 관리자가 검토합니다.",
    "",
    { title: "글 신고", okLabel: "신고" },
  );
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
        <h3 class="community-vote-rank-title community-vote-${kind}">${meta.label} 순위</h3>
        <div class="community-empty">아직 ${meta.label} 투표가 없습니다.</div>
      </div>`;
  }
  return `
    <div class="community-vote-rank-col">
      <h3 class="community-vote-rank-title community-vote-${kind}">${meta.label} 순위</h3>
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
  if (!ticker) { showAppToast("투표할 종목을 입력해주세요."); return; }
  if (!communityVoteSelectedChoice) { showAppToast("매수 또는 매도를 선택해주세요."); return; }
  const url = communityApiUrl("/community/vote");
  if (!url) { showAppToast("투표 기능을 사용할 수 없습니다."); return; }
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
      showAppToast(data.message || data.error || "투표 실패", 3200);
      return;
    }
    communityVoteSelectedChoice = null;
    if (tickerInput) tickerInput.value = "";
    renderCommunityVote();
  } catch (err) {
    showAppToast((err && err.message) || "투표에 실패했습니다.", 3200);
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
      panel.innerHTML = `<div class="community-admin-head"><strong>관리자 · 신고 내역</strong></div><p class="muted">권한 확인 실패(키를 확인하세요).</p>`;
      return;
    }
    const posts = data.posts || [];
    panel.hidden = false;
    panel.innerHTML = `
      <div class="community-admin-head">
        <strong>관리자 · 신고 내역 ${posts.length}건</strong>
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
  if (!id) return;
  if (!await showAppConfirm("이 글을 삭제할까요?", { title: "관리자 삭제", okLabel: "삭제", danger: true })) return;
  const url = communityApiUrl("/community");
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, clientId: getCommunityClientId(), adminKey: getCommunityAdminKey() }),
    });
    const data = await res.json();
    if (!res.ok) { showAppToast(data.error || "삭제 실패", 3200); return; }
    await fetchCommunityPosts({ silent: true });
    renderCommunityAdminPanel();
  } catch (err) {
    showAppToast((err && err.message) || "삭제 실패", 3200);
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
    banner.textContent = `새 소식 ${communityNewCount}건 · 맨 위로`;
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
    showAppToast("게시판을 일시적으로 사용할 수 없습니다.");
    return;
  }
  const clientId = getCommunityClientId();
  // 낙관적 업데이트(서버 응답 전 즉시 반영). 서버가 좋아요 누른 사람 목록을
  // 더 이상 내려주지 않으므로 집계값(likeCount/liked)만 뒤집는다.
  const cached = communityPostsCache.find((p) => p.id === postId);
  if (cached) {
    const liked = communityLikedByMe(cached);
    cached.liked = !liked;
    cached.likeCount = Math.max(0, communityLikeCount(cached) + (liked ? -1 : 1));
    delete cached.likes;   // 옛 워커가 준 배열이 남아 있으면 판정이 엇갈린다
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
      showAppToast(data.error === "no_community_kv" ? "게시판을 일시적으로 사용할 수 없습니다." : (data.error || "공감 처리 실패"), 3200);
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
    <span class="community-hot-tickers-label">인기 종목</span>
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
    filtered = filtered.filter((p) => communityIsMine(p));
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
    const canDelete = communityIsMine(post);
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
        ${stock ? `<p class="community-post-company muted">${escapeHtml(stock.company)} · 당일 ${fmtDailyPct(stock.changePct)}</p>` : ""}
        ${post.ticker ? communityMiniChartHtml(post.ticker) : ""}
        <p class="community-post-body">${highlightCommunityMentions(escapeHtml(post.content))}</p>
        ${comments.length ? `
          <div class="community-comments">
            ${comments.map((comment) => {
              const canDeleteComment = communityIsMine(comment);
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
          <button type="button" class="ghost compact-btn community-post-like${communityLikedByMe(post) ? " is-liked" : ""}" data-post-id="${escapeHtml(post.id)}" aria-pressed="${communityLikedByMe(post)}"><span class="community-like-count">${communityLikeCount(post)}</span></button>
          <button type="button" class="ghost compact-btn community-post-reply" data-post-id="${escapeHtml(post.id)}">${comments.length ? `댓글 ${comments.length}개 · 답글` : "댓글 달기"}</button>
          ${post.ticker ? `<button type="button" class="ghost compact-btn community-post-analyze" data-ticker="${escapeHtml(post.ticker)}">종목 분석</button>` : ""}
          ${canDelete
            ? `<button type="button" class="ghost compact-btn community-post-delete" data-id="${escapeHtml(post.id)}">삭제</button>`
            : `<button type="button" class="ghost compact-btn community-post-report" data-post-id="${escapeHtml(post.id)}" title="부적절한 글 신고">신고</button>`}
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
      // 서버가 "이 글이 요청자 것인가"를 판정할 수 있게 내 clientId 를 보낸다.
      // 응답에는 남의 clientId 가 실리지 않고 mine/liked 불리언만 온다.
      const listUrl = `${url}${url.includes("?") ? "&" : "?"}clientId=${encodeURIComponent(getCommunityClientId())}`;
      const res = await fetch(listUrl, { cache: "no-store" });
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
    showAppToast("의견을 2자 이상 입력해주세요.");
    return;
  }
  const url = communityApiUrl("/community");
  if (!url) {
    showAppToast("게시판을 일시적으로 사용할 수 없습니다.");
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
      showAppToast(msg, 3200);
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
    showAppToast((err && err.message) || "글 등록에 실패했습니다.", 3200);
  } finally {
    if (postBtn) postBtn.disabled = false;
  }
}

async function postCommunityComment(postId, rawContent) {
  const content = String(rawContent || "").trim();
  if (!postId || content.length < 2) {
    showAppToast("댓글을 2자 이상 입력해주세요.");
    return;
  }
  const nickInput = byId("communityNickname");
  const author = (nickInput?.value || "").trim() || getCommunityNickname() || "익명";
  setCommunityNickname(author);
  const url = communityApiUrl("/community/comment");
  if (!url) {
    showAppToast("게시판을 일시적으로 사용할 수 없습니다.");
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
      showAppToast(data.error === "no_community_kv" ? "게시판을 일시적으로 사용할 수 없습니다." : (data.message || data.error || "댓글 등록 실패"), 3200);
      return;
    }
    communityReplyPostId = null;
    communityBoardError = "";
    await fetchCommunityPosts();
  } catch (err) {
    showAppToast((err && err.message) || "댓글 등록에 실패했습니다.", 3200);
  }
}

async function deleteCommunityComment(postId, commentId) {
  if (!postId || !commentId) return;
  if (!await showAppConfirm("이 댓글을 삭제할까요?", { title: "댓글 삭제", okLabel: "삭제", danger: true })) return;
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
      showAppToast(data.error === "forbidden" ? "본인 댓글만 삭제할 수 있습니다." : (data.error || "삭제 실패"), 3200);
      return;
    }
    await fetchCommunityPosts();
  } catch (err) {
    showAppToast((err && err.message) || "댓글 삭제에 실패했습니다.", 3200);
  }
}

async function deleteCommunityPost(id) {
  if (!id) return;
  if (!await showAppConfirm("이 글을 삭제할까요?", { title: "글 삭제", okLabel: "삭제", danger: true })) return;
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
      showAppToast(data.error === "forbidden" ? "본인 글만 삭제할 수 있습니다." : (data.error || "삭제 실패"), 3200);
      return;
    }
    await fetchCommunityPosts();
  } catch (err) {
    showAppToast((err && err.message) || "삭제에 실패했습니다.", 3200);
  }
}

async function clearCommunityPostsMine() {
  if (!await showAppConfirm("이 브라우저에서 작성한 글을 모두 삭제할까요? 되돌릴 수 없습니다.", { title: "내 글 전체 삭제", okLabel: "모두 삭제", danger: true })) return;
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
      showAppToast(data.message || data.error || "삭제 실패", 3200);
      return;
    }
    await fetchCommunityPosts();
  } catch (err) {
    showAppToast((err && err.message) || "삭제에 실패했습니다.", 3200);
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
// 구형 공유 키(mir_watchlist_v1)를 시장별 키로 1회 이관한다. 옛 목록엔 두 시장의
// 티커가 섞여 있을 수 있으므로 6자리 숫자(KR 종목코드) 패턴으로 나눠 각각 넣는다.
function migrateLegacyWatchlist() {
  let legacy = null;
  try { legacy = JSON.parse(localStorage.getItem(WATCHLIST_LEGACY_KEY) || "null"); } catch (e) { /* ignore */ }
  if (!Array.isArray(legacy)) return;
  const norm = [...new Set(legacy.map((t) => String(t || "").trim().toUpperCase()).filter(Boolean))];
  const kr = norm.filter((t) => /^\d{6}$/.test(t));
  const us = norm.filter((t) => !/^\d{6}$/.test(t));
  try {
    if (us.length && !localStorage.getItem(watchlistStorageKey("us"))) {
      localStorage.setItem(watchlistStorageKey("us"), JSON.stringify(us));
    }
    if (kr.length && !localStorage.getItem(watchlistStorageKey("kr"))) {
      localStorage.setItem(watchlistStorageKey("kr"), JSON.stringify(kr));
    }
    localStorage.removeItem(WATCHLIST_LEGACY_KEY);
  } catch (e) { /* ignore */ }
}

function initWatchlist(urlList) {
  migrateLegacyWatchlist();
  try {
    const saved = JSON.parse(localStorage.getItem(watchlistStorageKey()) || "[]");
    watchlist = Array.isArray(saved) ? saved.map((t) => normalizeTickerKey(t)).filter(Boolean) : [];
  } catch (e) {
    watchlist = [];
  }
  if (urlList) {
    const fromUrl = String(urlList).split(",").map((t) => normalizeTickerKey(t.trim())).filter((t) => stockByTicker(t));
    if (fromUrl.length) watchlist = [...new Set(fromUrl)];
    persistWatchlist();
  }
  if (!watchlist.length) watchlist = defaultWatchlist().slice();
  persistWatchlist();
}

function persistWatchlist() {
  // 스냅샷에 없는 티커도 버리지 않는다 — 저장 시점 필터는 시장 전환/스냅샷 누락 때
  // 목록을 조용히 갉아먹는다. 화면에 뿌릴 때만 stockByTicker 로 거른다.
  watchlist = [...new Set(watchlist.map((t) => normalizeTickerKey(t)).filter(Boolean))];
  try { localStorage.setItem(watchlistStorageKey(), JSON.stringify(watchlist)); } catch (e) { /* ignore */ }
  const input = byId("bulkInput");
  if (input) input.value = watchlist.join(", ");
  scheduleCloudSyncPush();
}

let _cloudSyncPushTimer = null;
function scheduleCloudSyncPush() {
  clearTimeout(_cloudSyncPushTimer);
  _cloudSyncPushTimer = setTimeout(() => pushCloudSync(), 1200);
}

function isInWatchlist(ticker) {
  return watchlist.includes(normalizeTickerKey(ticker));
}

function watchStarButton(ticker) {
  const on = isInWatchlist(ticker);
  return `<button type="button" class="watch-star${on ? " is-on" : ""}" data-watch="${escapeHtml(ticker)}" title="관심종목">${on ? "★" : "☆"}</button>`;
}

function toggleWatchlist(ticker) {
  const t = normalizeTickerKey(ticker);
  if (!stockByTicker(t)) return;
  if (isInWatchlist(t)) watchlist = watchlist.filter((x) => x !== t);
  else watchlist.push(t);
  persistWatchlist();
  renderWatchlistBar();
  renderSummary();
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
      <em class="${cls(item.changePct)}">${fmtDailyPct(item.changePct)}</em>
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
  scheduleCloudSyncPush();
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
    useSma20: Boolean(byId("alertUseSma20")?.checked),
    usePattern: Boolean(byId("alertUsePattern")?.checked),
    patternCat: byId("alertPatternCat")?.value || "any",
  };
}

function applyWatchAlertSettingsToUi(settings) {
  const pairs = [
    ["alertUseRs", "useRs"], ["alertMinRs", "minRs"],
    ["alertUseEps", "useEps"], ["alertMinEps", "minEps"],
    ["alertUseHigh", "useHigh"], ["alertHighDist", "highDist"],
    ["alertUseVol", "useVol"], ["alertMinVol", "minVol"],
    ["alertUseSma20", "useSma20"],
    ["alertUsePattern", "usePattern"], ["alertPatternCat", "patternCat"]
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
  const sma = smaSeries(closes, 20);
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
  if (settings.usePattern) {
    const cached = watchPatternCache.get(item.ticker) || [];
    const hit = cached.filter((p) => settings.patternCat === "any" || patternCategory(p.pattern) === settings.patternCat);
    if (hit.length) reasons.push(`패턴 ${hit[0].label}${hit.length > 1 ? ` 외 ${hit.length - 1}` : ""}`);
  }
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
        <em class="${cls(item.changePct)}">${fmtDailyPct(item.changePct)}</em>
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
  ["alertUseRs", "alertMinRs", "alertUseEps", "alertMinEps", "alertUseHigh", "alertHighDist", "alertUseVol", "alertMinVol", "alertUseSma20", "alertUsePattern", "alertPatternCat"].forEach((id) => {
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
const MIR_SW_BUILD_KEY = "mir_sw_build_id_v1";

async function detectHotUpdate() {
  const current = window.MIR_BUILD_ID || "dev";
  let stored = null;
  try { stored = localStorage.getItem(MIR_SW_BUILD_KEY); } catch (_) { /* ignore */ }
  if (stored && stored !== current) {
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        reg.waiting?.postMessage({ type: "SKIP_WAITING" });
        await reg.update();
      }
    } catch (_) { /* ignore */ }
    try { localStorage.setItem(MIR_SW_BUILD_KEY, current); } catch (_) { /* ignore */ }
    showAppToast("새 버전이 배포되었습니다. 최신 파일을 불러옵니다.", 2800);
    window.setTimeout(() => window.location.reload(), 700);
    return true;
  }
  try { localStorage.setItem(MIR_SW_BUILD_KEY, current); } catch (_) { /* ignore */ }
  return false;
}

let pwaBound = false;
function setupPwa() {
  // 재부팅 시 controllerchange/updatefound/beforeinstallprompt 가 중복되지 않게 1회만.
  if (pwaBound) return;
  pwaBound = true;
  if ("serviceWorker" in navigator) {
    detectHotUpdate().catch(() => {});
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
    bucket: byId("scrBucket")?.value || marketCfg().defaultBucket || "idx_sp500",
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
  const bucket = byId("scrBucket")?.value || marketCfg().defaultBucket || "idx_sp500";
  const sector = byId("scrSector")?.value || "All";
  const preset = byId("scrPreset")?.value || "custom";
  const metric = byId("scrMetric")?.value || "rsScore";
  const patternCat = byId("scrPattern")?.value || "any";
  const minRs = numberInputValue("scrMinRs", 0);
  const minEps = numberInputValue("scrMinEps", 0);
  const minVol = numberInputValue("scrMinVol", 0);
  const minCap = numberInputValue("scrMinCap", 0);
  const limit = Math.max(1, numberInputValue("scrLimit", 100));
  return data.stocks
    .filter((item) => !isStockEtf(item))
    .filter((item) => bucketMatches(item, item.groups || [item.bucket].filter(Boolean), bucket))
    .filter((item) => sector === "All" || item.sector === sector)
    .filter((item) => (Number(item.rsScore) || 0) >= minRs)
    .filter((item) => (Number(item.epsRevScore) || 0) >= minEps)
    .filter((item) => (Number(item.volumeRatio) || 0) >= minVol)
    .filter((item) => (Number(item.marketCapB) || 0) >= minCap)
    .filter((item) => topPresetMatches(item, preset))
    .filter((item) => {
      if (patternCat === "any") return true;
      const pats = patternScreenerCache.get(item.ticker);
      return pats && pats.some((p) => patternCategory(p) === patternCat);
    })
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
      <td class="${cls(item.changePct)}">${fmtDailyPct(item.changePct)}</td>
      <td class="${cls(item.monthChangePct)}">${fmtPct(item.monthChangePct)}</td>
      <td>${item.rsScore}</td>
      <td>${item.epsRevScore}</td>
      <td>${Number(item.volumeRatio || 0).toFixed(1)}x</td>
      <td>${fmtBillions(item.marketCapB)}</td>
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
  { kw: ["반도체", "semiconduct", "칩"], label: "반도체", test: (it) => /semiconduct|반도체/i.test(`${it.industry || ""} ${it.sector || ""}`) },
  { kw: ["바이오", "biotech", "제약", "pharma"], label: "바이오/제약", test: (it) => /(biotech|pharma|drug|life science|바이오|제약)/i.test(`${it.industry || ""} ${it.sector || ""}`) || /헬스케어|HEALTHCARE/i.test(it.sector || "") },
  { kw: ["헬스케어", "healthcare", "의료"], label: "헬스케어", test: (it) => /헬스케어|HEALTHCARE|의료/i.test(`${it.industry || ""} ${it.sector || ""}`) },
  { kw: ["기술주", "기술", "테크", "tech", "소프트웨어", "software"], label: "기술", test: (it) => /기술|TECHNOLOGY|소프트웨어|software/i.test(`${it.industry || ""} ${it.sector || ""}`) },
  { kw: ["금융", "은행", "bank", "financ"], label: "금융", test: (it) => /금융|FINANCIAL|은행|bank/i.test(`${it.industry || ""} ${it.sector || ""}`) },
  { kw: ["에너지", "energy", "석유", "oil"], label: "에너지", test: (it) => /에너지|ENERGY|석유|oil/i.test(`${it.industry || ""} ${it.sector || ""}`) },
  { kw: ["소비재", "소비", "consumer", "리테일", "retail", "유통"], label: "소비재", test: (it) => /소비|CONSUMER|리테일|retail|유통/i.test(`${it.industry || ""} ${it.sector || ""}`) },
  { kw: ["산업재", "industrial"], label: "산업재", test: (it) => /산업재|INDUSTRIAL/i.test(`${it.industry || ""} ${it.sector || ""}`) },
  { kw: ["유틸", "utilit"], label: "유틸리티", test: (it) => /유틸|UTILIT/i.test(`${it.industry || ""} ${it.sector || ""}`) },
  { kw: ["부동산", "reit", "real estate"], label: "부동산", test: (it) => /부동산|REAL ESTATE|reit/i.test(`${it.industry || ""} ${it.sector || ""}`) },
  { kw: ["소재", "material", "mining", "금속", "철강"], label: "소재", test: (it) => /소재|MATERIAL|금속|철강|mining/i.test(`${it.industry || ""} ${it.sector || ""}`) },
  { kw: ["커뮤니케이션", "communication", "미디어", "media"], label: "커뮤니케이션", test: (it) => /커뮤니케이션|COMMUNICATION|미디어|media/i.test(`${it.industry || ""} ${it.sector || ""}`) },
  { kw: ["2차전지", "배터리", "battery"], label: "2차전지", test: (it) => /2차전지|배터리|battery/i.test(`${it.industry || ""} ${it.sector || ""} ${it.company || ""}`) },
  { kw: ["자동차", "auto"], label: "자동차", test: (it) => /자동차|auto/i.test(`${it.industry || ""} ${it.sector || ""} ${it.company || ""}`) },
];

const NL_FLAGS = [
  { kw: ["과매도", "oversold"], label: "과매도 RSI≤30", test: (it) => Number(it.rsi14) <= 30 },
  { kw: ["과매수", "overbought"], label: "과매수 RSI≥70", test: (it) => Number(it.rsi14) >= 70 },
  { kw: ["신고가", "new high", "고점 근접"], label: "신고가 근접", test: (it) => Number(it.newHighDistancePct) <= 2 },
  { kw: ["신저가", "저점 근접", "52주 저가"], label: "신저가 근접", test: (it) => { const d = low52DistPct(it); return Number.isFinite(d) && d <= 10; } },
  { kw: ["급등"], label: "당일 급등 ≥5%", test: (it) => Number(it.changePct) >= 5 },
  { kw: ["급락"], label: "당일 급락 ≤-5%", test: (it) => Number(it.changePct) <= -5 },
  { kw: ["대형주", "large cap", "largecap"], label: "대형주", test: (it) => Number(it.marketCapB) >= 10 },
  { kw: ["소형주", "중소형", "스몰캡", "small cap"], label: "소형주", test: (it) => isKrMarket() ? Number(it.marketCapB) < 0.1 : Number(it.marketCapB) <= 2 },
  { kw: ["주도주", "강세주", "리더", "leader"], label: "주도주 RS≥80", test: (it) => Number(it.rsScore) >= 80 },
  { kw: ["저평가", "value"], label: "저평가 PER≤15", test: (it, f) => Number(f.pe) > 0 && Number(f.pe) <= 15 },
];

const NL_METRICS = [
  { keys: ["rsi"], label: "RSI", unit: "", get: (it) => Number(it.rsi14), dir: "max" },
  { keys: ["per", "pe", "p/e", "주가수익"], label: "PER", unit: "", get: (it, f) => Number(f.pe != null ? f.pe : f.forwardPE), dir: "max" },
  { keys: ["pbr", "pb", "p/b"], label: "PBR", unit: "", get: (it, f) => Number(f.pb), dir: "max" },
  { keys: ["psr", "ps", "p/s"], label: "PSR", unit: "", get: (it, f) => Number(f.ps), dir: "max" },
  { keys: ["roe", "자기자본"], label: "ROE", unit: "%", get: (it, f) => Number(f.roe), dir: "min" },
  { keys: ["시총", "시가총액", "market cap", "marketcap"], label: "시총", unit: "B", get: (it) => itemCapForValuation(it), dir: "min", cap: true },
  { keys: ["거래량", "volume", "vol"], label: "거래량", unit: "x", get: (it) => Number(it.volumeRatio), dir: "min" },
  { keys: ["eps점수", "eps추정", "eps rev"], label: "EPS점수", unit: "", get: (it) => Number(it.epsRevScore), dir: "min" },
  { keys: ["당일", "오늘"], label: "당일등락", unit: "%", get: (it) => Number(it.changePct), dir: "min" },
  { keys: ["1개월", "한달", "월간"], label: "1개월", unit: "%", get: (it) => Number(it.monthChangePct), dir: "min" },
  { keys: ["1주", "주간"], label: "1주", unit: "%", get: (it) => Number(it.weekChangePct), dir: "min" },
  { keys: ["rs"], label: "RS", unit: "", get: (it) => Number(it.rsScore), dir: "min" },
];

function nlScaleCap(v, unit) {
  const u = String(unit || "").toLowerCase();
  if (isKrMarket()) {
    if (u === "조" || u === "t") return v;
    if (u === "억") return v * 0.0001;
    return v;
  }
  if (u === "조" || u === "t") return v * 1000;
  if (u === "억") return v * 0.1;
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
        label: `${metric.label} ${dir === "max" ? "≤" : "≥"} ${value}${metric.cap && isKrMarket() ? "조" : (metric.unit || "")}`,
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
  const universe = (data.stocks || []).filter((s) => s && !isStockEtf(s));
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
      <td class="${cls(it.changePct)}">${fmtDailyPct(it.changePct)}</td>
      <td class="${cls(it.monthChangePct)}">${fmtPct(it.monthChangePct)}</td>
      <td>${it.rsScore}</td>
      <td>${Number.isFinite(Number(it.rsi14)) ? it.rsi14 : "-"}</td>
      <td>${Number.isFinite(pe) ? pe.toFixed(1) : "-"}</td>
      <td>${fmtBillions(it.marketCapB)}</td>
      <td>${signalFor(it)}</td>
    </tr>`;
  }).join("");
  body.querySelectorAll(".ticker-link").forEach((btn) => btn.addEventListener("click", () => selectTicker(btn.dataset.ticker, { openSearch: true })));
}

// ===== 화면 설정 (테마 · 밀도) 토글 =====
const UI_PREFS_KEY = "mir_ui_prefs_v1";
function getUiPrefs() {
  try { return JSON.parse(localStorage.getItem(UI_PREFS_KEY)) || {}; } catch (e) { return {}; }
}
function setUiPref(key, val) {
  const p = getUiPrefs();
  p[key] = val;
  try { localStorage.setItem(UI_PREFS_KEY, JSON.stringify(p)); } catch (e) { /* ignore */ }
}
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const btn = byId("themeToggle");
  if (btn) {
    const dark = theme === "dark";
    btn.textContent = dark ? "라이트" : "다크";
    btn.setAttribute("aria-pressed", dark ? "true" : "false");
  }
}
function applyDensity(density) {
  document.documentElement.setAttribute("data-density", density);
  const btn = byId("densityToggle");
  if (btn) {
    const compact = density === "compact";
    btn.textContent = compact ? "↕ 넓게" : "↕ 컴팩트";
    btn.setAttribute("aria-pressed", compact ? "true" : "false");
  }
}
function setupUiPrefs() {
  const prefs = getUiPrefs();
  const theme = prefs.theme || (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(theme);
  applyDensity(prefs.density || "comfortable");
  byId("themeToggle")?.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    setUiPref("theme", next);
    applyTheme(next);
  });
  byId("densityToggle")?.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-density") === "compact" ? "comfortable" : "compact";
    setUiPref("density", next);
    applyDensity(next);
  });
  const brandHome = byId("brandHome");
  if (brandHome && !brandHome.dataset.bound) {
    brandHome.dataset.bound = "1";
    const goTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
    brandHome.addEventListener("click", goTop);
    brandHome.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goTop(); }
    });
  }
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

async function scanPatternsForScreener(candidates) {
  if (!window.MirProb) return;
  await window.MirProb.ensureStats();
  // 최대 80개 상세 JSON — 순차 await 는 수십 초가 걸린다. runDeepScan 과 같은
  // 방식으로 동시 6개 펌프를 돌려 병렬화한다.
  const queue = candidates.slice(0, 80).filter((item) => !patternScreenerCache.has(item.ticker));
  const CONCURRENCY = 6;
  let idx = 0, active = 0, done = 0;
  const scanOne = async (item) => {
    try {
      const res = await fetch((window.MirMarket && window.MirMarket.detailPath(item.ticker)) || `data/details/${encodeURIComponent(item.ticker)}.json`, { cache: "no-cache" });
      if (!res.ok) return;
      const detail = await res.json();
      const rows = (detail.chartSeries || []).map((r) => ({ o: r[0], h: r[1], l: r[2], c: r[3], v: r[4] || 0, d: r[5] }));
      const cur = window.MirProb.detectCurrentPatterns(rows);
      patternScreenerCache.set(item.ticker, cur.map((p) => p.pattern));
    } catch (e) { /* skip */ }
  };
  await new Promise((resolve) => {
    const pump = () => {
      if (done >= queue.length) return resolve();
      while (active < CONCURRENCY && idx < queue.length) {
        const item = queue[idx++];
        active++;
        scanOne(item).finally(() => {
          active--; done++;
          pump();
        });
      }
    };
    pump();
  });
}

function setupScreenerEvents() {
  loadSavedScreeners();
  renderSavedScreenerPicker();
  renderSavedScreenerDelta(null);
  const run = async (trackSaved = false) => {
    const patternCat = byId("scrPattern")?.value || "any";
    if (patternCat !== "any") {
      const meta = byId("screenerMeta");
      if (meta) meta.textContent = "패턴 스캔 중… (최대 80종목)";
      const pre = data.stocks
        .filter((item) => !isStockEtf(item))
        .filter((item) => bucketMatches(item, item.groups || [item.bucket].filter(Boolean), byId("scrBucket")?.value || marketCfg().defaultBucket || "idx_sp500"))
        .slice(0, 120);
      await scanPatternsForScreener(pre);
    }
    renderScreener({ trackSaved });
  };
  ["scrBucket", "scrSector", "scrMetric", "scrLimit", "scrPattern"].forEach((id) => {
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
    byId("scrBucket").value = marketCfg().defaultBucket || "idx_sp500";
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
  ["가격", (i) => priceOrDash(i.price)],
  ["당일", (i) => fmtDailyPct(i.changePct), (i) => cls(i.changePct)],
  ["1주", (i) => fmtPct(i.weekChangePct), (i) => cls(i.weekChangePct)],
  ["1개월", (i) => fmtPct(i.monthChangePct), (i) => cls(i.monthChangePct)],
  ["3개월", (i) => fmtPct(i.threeMonthChangePct), (i) => cls(i.threeMonthChangePct)],
  ["RS", (i) => String(i.rsScore)],
  ["EPS Rev", (i) => String(i.epsRevScore)],
  ["거래량", (i) => `${Number(i.volumeRatio || 0).toFixed(1)}x`],
  ["시총", (i) => fmtBillions(i.marketCapB)],
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
  const items = tickers.map((t) => withDetail(stockByTicker(t))).filter(Boolean);
  let html = `<thead><tr><th>지표</th>${items.map((i) => `<th><button type="button" class="ticker-link" data-ticker="${escapeHtml(i.ticker)}">${escapeHtml(i.ticker)}</button><div class="muted" style="font-size:11px;font-weight:400">${escapeHtml(i.company || i.name || "")}</div></th>`).join("")}</tr></thead><tbody>`;
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
  return [...pool].filter((t) => stockByTicker(t) && !isStockEtf(stockByTicker(t))).slice(0, 60);
}

function sp500TopTickers(limit = 50) {
  return data.stocks
    .filter((s) => !isStockEtf(s))
    .filter((s) => bucketMatches(s, s.groups || [s.bucket].filter(Boolean), marketCfg().defaultBucket || "idx_sp500"))
    .sort((a, b) => (Number(b.marketCapB) || 0) - (Number(a.marketCapB) || 0))
    .slice(0, limit)
    .map((s) => s.ticker);
}

// Snapshot-first: the static earnings_calendar snapshot is rebuilt every morning by the
// daily-earnings-calendar workflow, so it's fresh — render it instantly with no worker
// wait. The worker is only used for an explicit "새로고침" (force) to pull intraday-latest,
// or when the snapshot is empty (e.g. first build hasn't run).
function loadEarningsCalendar(force = false) {
  const body = byId("earningsCalendarBody");
  if (!body) return;
  const cfg = marketCfg();
  if (cfg.features && cfg.features.earningsCalendar === false) {
    // 서브탭 자체를 숨기지만(setupMarketMode), 딥링크로 직접 들어오는 경로가 있어
    // 여기서도 막는다. 빈 표 대신 이유를 밝힌다 — 로딩 중으로 오해하지 않도록.
    body.innerHTML = `<p class="muted">국내는 실적 발표 예정일을 제공하는 공개 데이터 소스가 없어 이 표를 제공하지 않습니다.
      지나간 분기 실적은 종목 상세에서 확인할 수 있습니다.</p>`;
    return;
  }
  if (earningsCalendarCache && !force) {
    renderEarningsCalendarMarket(earningsCalendarCache);
    return;
  }
  const staticRows = staticEarningsRowsForTickers(earningsTickerPool());

  // 기본 경로: 매일 갱신되는 스냅샷을 즉시 렌더(대기 없음).
  if (!force && staticRows.length) {
    earningsCalendarCache = staticRows;
    renderEarningsCalendarMarket(staticRows);
    return;
  }

  // 새로고침(force) 또는 스냅샷이 비었을 때만 워커로 최신 데이터 조회.
  if (!LIVE_DATA_PROXY) {
    if (staticRows.length) { earningsCalendarCache = staticRows; renderEarningsCalendarMarket(staticRows); }
    else body.innerHTML = `<p class="muted">실적 일정 데이터가 아직 없습니다. (매일 아침 자동 갱신)</p>`;
    return;
  }
  if (earningsCalendarLoading) return;
  earningsCalendarLoading = true;
  body.innerHTML = `<p class="muted">최신 실적 일정을 불러오는 중…</p>`;
  // KR: send Yahoo symbols (005930.KS) so the proxy can query Yahoo; the response is
  // normalized back to the snapshot ticker in renderEarningsCalendarMarket.
  const tickers = earningsTickerPool().map((t) => liveProxyTicker(stockByTicker(t) || t)).join(",");
  fetch(`${LIVE_DATA_PROXY.replace(/\/$/, "")}/?earnings_calendar=1&tickers=${encodeURIComponent(tickers)}`, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((payload) => {
      const liveRows = (payload && payload.earnings) || [];
      earningsCalendarCache = liveRows.length ? liveRows : staticRows;
      if (earningsCalendarCache.length) renderEarningsCalendarMarket(earningsCalendarCache);
      else body.innerHTML = `<p class="muted">실적 일정 데이터가 없습니다.</p>`;
    })
    .catch(() => {
      if (staticRows.length) { earningsCalendarCache = staticRows; renderEarningsCalendarMarket(staticRows); }
      else body.innerHTML = `<p class="muted">실적 일정을 불러오지 못했습니다.</p>`;
    })
    .finally(() => { earningsCalendarLoading = false; });
}

function localDateFromIso(iso) {
  const parts = parseIsoDateParts(iso);
  return parts ? new Date(parts.year, parts.month - 1, parts.day) : null;
}

// Join an earnings-calendar row with the snapshot so the calendar can show sector,
// price/change, valuation, target upside, size tier and watchlist state.
function enrichEarningsRow(row) {
  const t = normalizeTickerKey(row.ticker);
  const stock = stockByTicker(t) || {};
  const f = stock.ticker ? normalizedFundamentalsForItem(stock) : {};
  const price = Number(latestPriceForFundamentals(stock, f) || stock.price || f.prevClose) || null;
  const target = Number(f.targetPrice ?? stock.targetPrice);
  const upside = (Number.isFinite(target) && Number.isFinite(price) && price) ? pctFrom(target, price) : null;
  const capB = Number(stock.marketCapB) || 0;
  const capTier = capB >= 200 ? "메가" : capB >= 10 ? "대형" : capB >= 2 ? "중형" : capB > 0 ? "소형" : "";
  return {
    ticker: t, date: row.nextDate, company: stock.company || t,
    sector: stock.sector || "", sectorKo: isKrMarket() ? (stock.sector || "") : (SECTOR_KO[stock.sector] || stock.sector || ""),
    marketCapB: capB, capTier, rsScore: (stock.rsScore ?? null),
    price, changePct: Number.isFinite(Number(stock.changePct)) ? Number(stock.changePct) : null,
    epsEstimate: (row.epsEstimate != null ? Number(row.epsEstimate) : null),
    target, upside, watch: isInWatchlist(t),
  };
}

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

function renderEarningsCalendarMarket(rows) {
  const body = byId("earningsCalendarBody");
  if (!body) return;
  const horizon = Number(byId("earnHorizon")?.value || 14);
  const today = snapshotBaseDate();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today.getTime() + horizon * 86400000);
  end.setHours(23, 59, 59, 999);

  // Enrich + filter (date range, sector, watchlist-only).
  let items = (rows || [])
    .filter((r) => r.nextDate)
    .map(enrichEarningsRow)
    .filter((it) => { const d = localDateFromIso(it.date); return d && d >= today && d <= end; });
  if (earnSector !== "all") items = items.filter((it) => it.sector === earnSector);
  if (earnWatchOnly) items = items.filter((it) => it.watch);

  if (!items.length) {
    const reason = earnWatchOnly ? "관심종목 중 " : earnSector !== "all" ? "이 섹터에서 " : "";
    body.innerHTML = `<p class="muted">선택 기간에 ${reason}실적 발표 예정 종목이 없습니다. 필터를 넓히거나 범위를 바꿔 보세요.</p>`;
    return;
  }

  // "이번 주 주목" — 향후 7일 내 시총 상위(관심종목 우선).
  const weekEnd = new Date(today.getTime() + 7 * 86400000);
  const highlights = items
    .filter((it) => { const d = localDateFromIso(it.date); return d && d <= weekEnd; })
    .sort((a, b) => (b.watch - a.watch) || (b.marketCapB - a.marketCapB))
    .slice(0, 6);
  const highlightHtml = highlights.length ? `
    <div class="earn-highlight">
      <span class="earn-highlight-label">이번 주 주목</span>
      <div class="earn-highlight-chips">
        ${highlights.map((it) => {
          const d = localDateFromIso(it.date);
          const dow = d ? WEEKDAY_KO[d.getDay()] : "";
          return `<button type="button" class="earn-hl-chip" data-ticker="${escapeHtml(it.ticker)}">
            ${it.watch ? "★ " : ""}<b>${escapeHtml(it.ticker)}</b><em>${dow}</em></button>`;
        }).join("")}
      </div>
    </div>` : "";

  const body_html = earnView === "calendar" ? earningsCalendarGrid(items, today) : earningsListView(items, today);
  body.innerHTML = highlightHtml + body_html;

  body.querySelectorAll("[data-ticker]").forEach((btn) => {
    btn.addEventListener("click", () => selectTicker(btn.dataset.ticker, { openSearch: true }));
  });
}

// Small colored change/EPS bits reused by both views.
function earnChange(pct) {
  if (pct == null) return "";
  return `<span class="earn-chg ${cls(pct)}">${fmtPct(pct)}</span>`;
}

function earningsCalendarGrid(items, today) {
  const byDate = {};
  items.forEach((it) => (byDate[it.date] = byDate[it.date] || []).push(it));
  const dates = Object.keys(byDate).sort();
  const cols = dates.map((date) => {
    const list = byDate[date].sort(earnSortCmp);
    const d = localDateFromIso(date);
    const dow = d ? WEEKDAY_KO[d.getDay()] : "";
    const days = Math.ceil((d - today) / 86400000);
    const rel = days === 0 ? "오늘" : days === 1 ? "내일" : `${days}일 후`;
    const isToday = days === 0;
    return `
      <div class="earn-cal-day${isToday ? " is-today" : ""}">
        <div class="earn-cal-date">
          <strong>${escapeHtml(date.slice(5))} <em>(${dow})</em></strong>
          <span>${rel} · ${list.length}</span>
        </div>
        <div class="earn-cal-chips">
          ${list.map((it) => `
            <button type="button" class="earn-cal-chip" data-ticker="${escapeHtml(it.ticker)}" title="${escapeHtml(it.company)}">
              <span class="earn-chip-top">${it.watch ? `<i class="earn-star">★</i>` : ""}<b>${escapeHtml(it.ticker)}</b>${earnChange(it.changePct)}</span>
              <span class="earn-chip-sub">${it.capTier ? `${escapeHtml(it.capTier)} · ` : ""}${escapeHtml(it.sectorKo || "-")}</span>
            </button>`).join("")}
        </div>
      </div>`;
  }).join("");
  return `<div class="earn-cal">${cols}</div>`;
}

function earningsListView(items, today) {
  const byDate = {};
  items.forEach((it) => (byDate[it.date] = byDate[it.date] || []).push(it));
  const dates = Object.keys(byDate).sort();
  return dates.map((date) => {
    const list = byDate[date].sort(earnSortCmp);
    const d = localDateFromIso(date);
    const dow = d ? WEEKDAY_KO[d.getDay()] : "";
    const days = Math.ceil((d - today) / 86400000);
    const rel = days === 0 ? "오늘" : days === 1 ? "내일" : `${days}일 후`;
    const capSum = list.reduce((s, it) => s + (it.marketCapB || 0), 0);
    return `
      <section class="earn-list-group">
        <div class="earn-list-head">
          <strong>${escapeHtml(date.slice(5))} <em>(${dow})</em></strong>
          <span>${rel} · ${list.length}종목 · 합산 ${fmtBillions(capSum)}</span>
        </div>
        <div class="earn-list-rows">
          ${list.map((it) => `
            <button type="button" class="earn-row" data-ticker="${escapeHtml(it.ticker)}">
              <span class="earn-row-id">
                ${it.watch ? `<i class="earn-star">★</i>` : ""}
                <b>${escapeHtml(it.ticker)}</b>
                <em>${escapeHtml(it.company)}</em>
              </span>
              <span class="earn-row-sector">${escapeHtml(it.sectorKo || "-")}</span>
              <span class="earn-row-price">${it.price != null ? priceOrDash(it.price) : "—"} ${earnChange(it.changePct)}</span>
              <span class="earn-row-eps"><i>EPS 예상</i>${it.epsEstimate != null ? moneyOrDash(it.epsEstimate) : "—"}</span>
              <span class="earn-row-target"><i>목표 여력</i>${it.upside != null ? `<b class="${cls(it.upside)}">${fmtPct(it.upside)}</b>` : "—"}</span>
              <span class="earn-row-cap"><i>시총</i>${fmtBillions(it.marketCapB)}${it.capTier ? ` <em class="earn-tier earn-tier-${it.capTier === "메가" ? "mega" : it.capTier === "대형" ? "large" : "mid"}">${escapeHtml(it.capTier)}</em>` : ""}</span>
              <span class="earn-row-rs"><i>RS</i>${it.rsScore ?? "—"}</span>
            </button>`).join("")}
        </div>
      </section>`;
  }).join("");
}

function earnSortCmp(a, b) {
  if (earnSort === "cap") return (b.marketCapB || 0) - (a.marketCapB || 0);
  if (earnSort === "rs") return (Number(b.rsScore) || 0) - (Number(a.rsScore) || 0);
  // date sort → within a day, keep biggest first
  return (b.marketCapB || 0) - (a.marketCapB || 0);
}

function setupEarningsEvents() {
  // Filters/sort/view/horizon only change the display → re-render from cache (no refetch).
  // Scope changes the ticker pool → refetch.
  const rerender = () => { if (earningsCalendarCache) renderEarningsCalendarMarket(earningsCalendarCache); else loadEarningsCalendar(); };
  // 새로고침: 워커로 최신 조회. 범위 변경: 종목 풀만 바뀌므로 스냅샷에서 즉시 재구성.
  byId("earnRefresh")?.addEventListener("click", () => { earningsCalendarCache = null; loadEarningsCalendar(true); });
  byId("earnScope")?.addEventListener("change", () => { earningsCalendarCache = null; loadEarningsCalendar(false); });
  byId("earnHorizon")?.addEventListener("change", rerender);
  byId("earnSector")?.addEventListener("change", (e) => { earnSector = e.target.value; rerender(); });
  byId("earnSort")?.addEventListener("change", (e) => { earnSort = e.target.value; rerender(); });
  byId("earnWatchOnly")?.addEventListener("change", (e) => { earnWatchOnly = e.target.checked; rerender(); });
  const vt = byId("earnViewToggle");
  if (vt) vt.querySelectorAll("[data-earn-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      earnView = btn.dataset.earnView;
      vt.querySelectorAll("[data-earn-view]").forEach((b) => b.classList.toggle("is-active", b === btn));
      rerender();
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
  const disclaimerHtml = `<p class="backtest-disclaimer muted"><strong>면책:</strong> 본 백테스트는 현재 스냅샷에 포함된 종목만 사용합니다. 기간 중 상장폐지·합병된 종목은 제외되어 <strong>생존 편향(survivorship bias)</strong>으로 실제 수익률보다 높게 나올 수 있습니다. 거래비용·세금·슬리피지는 반영되지 않은 총수익(buy-and-hold) 기준입니다.</p>`;
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
    ${disclaimerHtml}
    <thead><tr><th>티커</th><th>회사</th><th>시작가</th><th>종가</th><th>수익률</th><th>비중</th><th>투자액</th><th>평가액</th></tr></thead>
    <tbody>
      ${stockReturns.map((row) => `
        <tr>
          <td><button type="button" class="ticker-link" data-ticker="${escapeHtml(row.ticker)}">${escapeHtml(row.ticker)}</button></td>
          <td>${escapeHtml(row.company)}</td>
          <td>${priceOrDash(row.startPrice)}</td>
          <td>${priceOrDash(row.endPrice)}</td>
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
  lastBacktestExportPayload = payload;
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
  // 상세 JSON 의 가격 이력은 스냅샷 기준 약 5년 롤링 윈도우다. 하한을 고정 날짜로
  // 박아두면 시간이 갈수록 실제 데이터 시작일과 어긋난다 — 스냅샷 날짜에서 유도.
  const min = shiftIsoDateByYears(end, -5);
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

// ===== Market chat context (RAG) =====
function buildMarketChatContext() {
  const cfg = marketCfg();
  const summary = data.summary || {};
  const updated = data.updatedAtKst || data.updated_at_kst || "";
  const tone = summary.marketTone || summary.market_tone || "";
  const strong = summary.strongSector || summary.strong_sector || "";
  const weak = summary.weakSector || summary.weak_sector || "";
  const breadth = summary.aiBreadth || summary.ai_breadth || "";
  const stockCount = Array.isArray(data.stocks) ? data.stocks.length : 0;
  const majors = (data.health?.major || []).slice(0, 6).map((row) => {
    const chg = Number(row.changePct);
    const chgText = Number.isFinite(chg) ? `${chg >= 0 ? "+" : ""}${chg.toFixed(1)}%` : "-";
    return `${row.ticker || row.name}: ${chgText}`;
  }).join(", ");
  return [
    `[${cfg.label} 시장 스냅샷]`,
    `기준: ${updated}`,
    tone ? `국면: ${tone}` : "",
    strong ? `강세 섹터: ${strong}` : "",
    weak ? `약세 섹터: ${weak}` : "",
    breadth ? `AI breadth: ${breadth}` : "",
    `추적 종목: ${stockCount}개`,
    majors ? `주요 지표: ${majors}` : "",
  ].filter(Boolean).join("\n").slice(0, 2000);
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

// ===== CSV export =====
function downloadCsv(filename, rows) {
  const bom = "\uFEFF";
  const body = rows.map((row) => row.map((cell) => {
    const text = String(cell ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join(",")).join("\n");
  const blob = new Blob([bom + body], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportPortfolioCsv() {
  if (!portfolio.length) { showAppToast("보낼 보유 종목이 없습니다."); return; }
  const fmt = marketCfg().formatMoney;
  const rows = [["티커", "종목명", "수량", "평단", "현재가", "평가액", "손익%", "섹터"]];
  portfolio.forEach((p) => {
    const stock = stockByTicker(p.ticker);
    const price = stock ? Number(stock.price) : 0;
    const value = p.qty * price;
    const cost = p.qty * p.avgCost;
    const plPct = cost > 0 ? ((value - cost) / cost) * 100 : 0;
    rows.push([
      p.ticker,
      stock?.company || "",
      p.qty,
      p.avgCost,
      price,
      value,
      plPct.toFixed(2),
      stock?.sector || "",
    ]);
  });
  downloadCsv(`mir-portfolio-${marketCfg().id}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

let lastBacktestExportPayload = null;

function exportBacktestCsv() {
  if (!lastBacktestExportPayload) { showAppToast("먼저 시뮬레이션을 실행해 주세요."); return; }
  const p = lastBacktestExportPayload;
  const rows = [
    ["포트폴리오 수익률%", p.totalReturn],
    ["연환산%", p.annReturn ?? ""],
    ["벤치마크", p.benchmarkTicker],
    ["벤치마크 수익률%", p.benchmarkReturn ?? ""],
    ["초과수익 α%", p.alpha ?? ""],
    ["기간", `${p.startDate} → ${p.endDate}`],
    [],
    ["티커", "회사", "시작가", "종가", "수익률%", "비중%", "투자액", "평가액"],
  ];
  (p.stockReturns || []).forEach((row) => {
    rows.push([row.ticker, row.company, row.startPrice, row.endPrice, row.returnPct, row.weightPct, row.invested, row.finalValue]);
  });
  downloadCsv(`mir-backtest-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

// ===== Cloud sync (watchlist + portfolio + alerts) =====
const CLOUD_SYNC_KEY = "mir_cloud_sync_v1";

// 반대 시장의 저장분을 읽는다(현재 시장은 메모리의 watchlist 가 최신).
function storedWatchlist(marketId) {
  const current = isKrMarket() ? "kr" : "us";
  if (marketId === current) return watchlist.slice();
  try {
    const saved = JSON.parse(localStorage.getItem(watchlistStorageKey(marketId)) || "[]");
    return Array.isArray(saved) ? saved.filter(Boolean) : [];
  } catch (e) { return []; }
}

function cloudSyncPayload() {
  return {
    // legacy `watchlist`(현재 시장 목록)는 구형 클라이언트 호환용으로 남긴다.
    // 시장별 필드를 따로 실어 한쪽 시장 사용이 다른 쪽 목록을 덮어쓰지 않게 한다.
    watchlist,
    watchlistUs: storedWatchlist("us"),
    watchlistKr: storedWatchlist("kr"),
    portfolio,
    alertSettings: watchAlertSettings(),
    updatedAt: Date.now(),
  };
}

async function pushCloudSync() {
  if (!LIVE_DATA_PROXY) return;
  const url = communityApiUrl("/sync/prefs");
  if (!url) return;
  try {
    await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: getCommunityClientId(), prefs: cloudSyncPayload() }),
    });
    localStorage.setItem(CLOUD_SYNC_KEY, String(Date.now()));
    updateCloudSyncStatus("저장됨");
  } catch (e) { /* ignore */ }
}

async function pullCloudSync() {
  if (!LIVE_DATA_PROXY) return;
  const url = communityApiUrl(`/sync/prefs?clientId=${encodeURIComponent(getCommunityClientId())}`);
  if (!url) return;
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const payload = await res.json();
    const prefs = payload && payload.prefs;
    if (!prefs) return;
    const marketId = isKrMarket() ? "kr" : "us";
    const scoped = marketId === "kr" ? prefs.watchlistKr : prefs.watchlistUs;
    const other = marketId === "kr" ? prefs.watchlistUs : prefs.watchlistKr;
    if (Array.isArray(scoped) && scoped.length) {
      watchlist = [...new Set(scoped.map((t) => normalizeTickerKey(t)).filter(Boolean))].slice(0, 80);
      persistWatchlist();
    } else if (!Array.isArray(scoped) && Array.isArray(prefs.watchlist) && prefs.watchlist.length) {
      // 시장별 필드가 없는 구형 payload: 현재 시장 패턴(KR=6자리 숫자)에 맞는 것만 취한다.
      const mine = prefs.watchlist.map((t) => normalizeTickerKey(t)).filter(Boolean)
        .filter((t) => (marketId === "kr") === /^\d{6}$/.test(t));
      if (mine.length) {
        watchlist = [...new Set(mine)].slice(0, 80);
        persistWatchlist();
      }
    }
    // 반대 시장 목록은 저장소만 갱신한다(값이 실려 온 경우에만 — 빈 값으로 지우지 않는다).
    if (Array.isArray(other) && other.length) {
      const otherId = marketId === "kr" ? "us" : "kr";
      try {
        localStorage.setItem(watchlistStorageKey(otherId),
          JSON.stringify([...new Set(other.map((t) => String(t || "").trim().toUpperCase()).filter(Boolean))].slice(0, 80)));
      } catch (e) { /* ignore */ }
    }
    if (Array.isArray(prefs.portfolio) && prefs.portfolio.length) {
      portfolio = prefs.portfolio.filter((p) => p && p.ticker).slice(0, 60);
      savePortfolio();
    }
    if (prefs.alertSettings && typeof prefs.alertSettings === "object") {
      saveWatchAlertSettings({ ...watchAlertSettings(), ...prefs.alertSettings });
    }
    updateCloudSyncStatus("불러옴");
  } catch (e) { /* ignore */ }
}

function updateCloudSyncStatus(text) {
  const el = byId("cloudSyncStatus");
  if (!el) return;
  el.textContent = text;
  clearTimeout(updateCloudSyncStatus._timer);
  updateCloudSyncStatus._timer = setTimeout(() => { el.textContent = ""; }, 2500);
}

function setupCloudSyncEvents() {
  byId("cloudSyncPull")?.addEventListener("click", () => pullCloudSync().then(() => {
    renderWatchlistBar();
    renderPortfolio();
    renderWatchAlerts();
  }));
  byId("cloudSyncPush")?.addEventListener("click", () => pushCloudSync());
}

// ===== KR DART disclosures =====
let krDartQuery = "";

// 공시 제목 밑에 붙는 숫자 한 줄. 이 패널의 오랜 한계가 '제목만 있고 숫자가 없다'
// 였다 — "유상증자결정" 이 실제로 몇 % 희석인지 알려면 DART 문서를 열어야 했다.
// data/kr_event_details.js 가 rcept_no 키로 그 숫자를 갖고 있다(build_kr_event_details.py).
function krEventDetailLine(row) {
  const map = window.KR_EVENT_DETAILS?.details;
  if (!map) return "";
  const m = String(row.link || "").match(/rcpNo=(\d+)/);
  const d = m && map[m[1]];
  if (!d) return "";

  const won = (v) => {
    if (!Number.isFinite(v)) return null;
    if (Math.abs(v) >= 1e12) return `${(v / 1e12).toFixed(1)}조`;
    if (Math.abs(v) >= 1e8) return `${(v / 1e8).toLocaleString(undefined, { maximumFractionDigits: 1 })}억`;
    return `${Math.round(v).toLocaleString()}원`;
  };
  const parts = [];
  // 희석률이 이 공시들의 핵심 숫자다 — 맨 앞에, 강조해서 둔다.
  if (Number.isFinite(d.dilutionPct)) {
    const heavy = d.dilutionPct >= 10;
    parts.push(`<b class="${heavy ? "neg" : ""}">희석 ${d.dilutionPct.toFixed(2)}%</b>`);
  }
  if (Number.isFinite(d.amount)) parts.push(escapeHtml(won(d.amount)));
  if (Number.isFinite(d.convPrice)) parts.push(`전환가 ${d.convPrice.toLocaleString()}원`);
  if (Number.isFinite(d.couponPct)) parts.push(`표면 ${d.couponPct}%`);
  if (Number.isFinite(d.shares)) parts.push(`${d.shares.toLocaleString()}주`);
  if (d.method) parts.push(escapeHtml(d.method));
  if (d.purpose) parts.push(escapeHtml(d.purpose));
  if (!parts.length) return "";
  return `<div class="ins-sub">${parts.join(" · ")}</div>`;
}

// 공시 유형별 과거 반응. 5년 55만건을 재보니 41개 유형 중 무작위를 이긴 건 0개였다
// (build_kr_disclosure_stats.py 의 결론 참고).
//
// 그래서 이 줄의 목적은 신호를 파는 게 아니라 그 반대다 — "이 공시 뒤에 주가가 어떻게
// 되나" 라는 질문에 "무작위와 구분되지 않는다" 고 답한다. 판정을 먼저 쓰고 숫자를
// 뒤에 두는 이유가 그것이다. 숫자를 앞세우면 '+0.27%' 만 읽고 신호로 오해한다.
//
// 평균이 아니라 중앙값을 쓴다. 평균은 소형주 급등 몇 건에 끌려간다 — 증자·사채는
// D0 평균 +0.57% 인데 중앙값은 -0.06% 로 부호가 반대다. 중앙값이 '보통 어땠나' 에 가깝다.
function krDisclosureStatLine(row) {
  const book = window.KR_DISCLOSURE_STATS?.stats;
  const s = book && book[row.typeLabel];
  if (!s || !s.d1 || !Number.isFinite(s.d1.median)) return "";

  const sign = (v) => `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
  const rnd = s.d1.random;
  const verdict = s.edge
    ? `<b>무작위와 다름</b>`
    : `무작위와 구분 안 됨`;
  const bits = [
    `과거 ${s.sample.toLocaleString()}건`,
    `다음날 중앙값 ${sign(s.d1.median)}`,
  ];
  if (rnd && Number.isFinite(rnd.median)) bits.push(`무작위 ${sign(rnd.median)}`);
  // 증자·사채만 해당. 당일 반응은 통계적으로 실재하지만 공시 당일이라 행동할 수 없고,
  // 공시 전 5일에 이미 올라 있어 역인과로 보인다. 그 사실을 숨기지 않고 그대로 쓴다.
  const same = s.sameDayOnly ? ` · 당일 반응은 있으나 예측 아님` : "";
  return `<div class="ins-sub disc-stat">${bits.join(" · ")} · ${verdict}${same}</div>`;
}

// 방법론을 한 번만, 접어서 설명한다. 행마다 "무작위와 구분 안 됨" 만 반복되면
// 왜 그런지가 화면 어디에도 없다 — 근거를 볼 수 있어야 결론을 믿거나 반박할 수 있다.
// 숫자는 데이터에서 읽는다. 여기 하드코딩하면 통계를 다시 돌렸을 때 설명만 옛말이 된다.
function renderKrDisclosureMethod() {
  const box = byId("krDartMethodBody");
  const payload = window.KR_DISCLOSURE_STATS;
  if (!box) return;
  const wrap = byId("krDartMethod");
  if (!payload) { if (wrap) wrap.hidden = true; return; }
  if (wrap) wrap.hidden = false;
  const total = payload.typeCount || Object.keys(payload.stats || {}).length;
  const edges = payload.edgeCount || 0;
  box.innerHTML = `
    <p><b>${total}개 유형 중 무작위를 이긴 건 ${edges}개입니다.</b>
       공시 유형만으로 다음날 주가를 예측할 수 없다는 뜻입니다.</p>
    <p>같은 종목의 <b>무작위 날짜</b>를 대조군으로 두고 비교합니다. 시장 전체가 오른 날의
       상승을 호재로 읽지 않도록, 지수(KODEX 200 · 코스닥150) 대비 <b>초과수익</b>으로 잽니다.</p>
    <p>이벤트를 낱개로 세면 우위가 있는 것처럼 보입니다. 하지만 공시는 제출기한에 몰립니다
       — 지속가능경영보고서는 712건 중 115건이 2026-06-30 하루에 나왔습니다. 그 115종목의
       다음날 수익률은 독립된 115개 관측이 아니라 <b>그날 하루</b>입니다. 날짜로 묶어 다시
       재면 t값 +5.25가 -0.09로 사라집니다.</p>
    <p class="muted">${escapeHtml(payload.source || "")} · ${escapeHtml(payload.updatedAtKst || "")}</p>`;
}

function renderKrDisclosures() {
  const meta = byId("krDartMeta");
  const table = byId("krDartTable");
  if (!table) return;
  const payload = window.KR_DISCLOSURES;
  if (!payload) {
    table.innerHTML = `<p class="muted">DART 공시 데이터를 불러오는 중…</p>`;
    return;
  }
  if (meta) {
    // 빌더가 실제 커버 범위(종목수·기간)를 payload 에 싣는다. 예전엔 건수만 보여줘서
    // 120종목만 훑고 있다는 사실이 화면 어디에도 드러나지 않았다.
    const parts = [payload.updatedAtKst, `${payload.count || 0}건`];
    if (payload.companyCount) parts.push(`${payload.companyCount}종목`);
    if (payload.firstFileDate && payload.lastFileDate) {
      parts.push(`${payload.firstFileDate} ~ ${payload.lastFileDate}`);
    }
    parts.push(payload.source);
    meta.textContent = parts.filter(Boolean).join(" · ");
  }
  renderKrDisclosureMethod();
  let rows = payload.disclosures || [];
  const q = krDartQuery.trim().toLowerCase();
  if (q) {
    rows = rows.filter((row) =>
      [row.ticker, row.company, row.title, row.typeLabel].some((v) => String(v || "").toLowerCase().includes(q))
    );
  }
  if (!rows.length) {
    table.innerHTML = `<p class="muted">${payload.note || "표시할 공시가 없습니다."}</p>`;
    return;
  }
  table.innerHTML = `
    <table class="insider-table">
      <thead><tr><th>일자</th><th>종목</th><th>회사</th><th>유형</th><th>제목</th></tr></thead>
      <tbody>
        ${rows.slice(0, 200).map((row) => `
          <tr>
            <td>${escapeHtml(row.fileDate || "")}</td>
            <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(row.ticker)}">${escapeHtml(row.ticker)}</button></td>
            <td>${escapeHtml(row.company || "")}</td>
            <td>${escapeHtml(row.typeLabel || "")}</td>
            <td>
              ${row.link ? `<a href="${escapeHtml(row.link)}" target="_blank" rel="noopener">${escapeHtml(row.title || "")}</a>` : escapeHtml(row.title || "")}
              ${krEventDetailLine(row)}
              ${krDisclosureStatLine(row)}
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;
  table.querySelectorAll(".ins-ticker").forEach((btn) => {
    btn.addEventListener("click", () => selectTicker(btn.dataset.ticker, { openSearch: true }));
  });
}

function setupKrDartEvents() {
  const search = byId("krDartSearch");
  if (search) search.addEventListener("input", () => { krDartQuery = search.value; renderKrDisclosures(); });
}

// ===== KR 지분 변동 (대량보유 5%룰 / 임원·주요주주) =====
let krOwnQuery = "";
let krOwnKind = "major";

function krOwnNum(v, digits = 0) {
  return Number.isFinite(v) ? Number(v).toLocaleString(undefined, { maximumFractionDigits: digits }) : "-";
}

// 증감은 방향이 핵심이라 색과 부호를 같이 준다(색만으로 구분하지 않게 부호를 반드시 붙인다).
function krOwnDelta(v, suffix, digits = 0) {
  if (!Number.isFinite(v) || v === 0) return `<span class="muted">-</span>`;
  const sign = v > 0 ? "+" : "";
  return `<span class="${v > 0 ? "pos" : "neg"}">${sign}${krOwnNum(v, digits)}${suffix}</span>`;
}

// 지배구조·유통물량 — 최근 '이벤트'(대량보유/임원 공시)와 달리 종목별 '상태'다.
// 데이터가 티커 키 맵이라 회사명·시총은 스냅샷에서 붙인다.
function renderKrOwnProfile() {
  const meta = byId("krOwnMeta");
  const table = byId("krOwnTable");
  const payload = window.KR_OWNERSHIP_PROFILE;
  if (!payload) {
    table.innerHTML = `<p class="muted">지배구조 데이터를 불러오는 중…</p>`;
    return;
  }
  if (meta) {
    meta.textContent = [
      payload.updatedAtKst,
      `${payload.year || ""} 사업보고서 기준`,
      `${payload.companyCount || 0}종목`,
      payload.source,
    ].filter(Boolean).join(" · ");
  }

  const profiles = payload.profiles || {};
  const q = krOwnQuery.trim().toLowerCase();
  let rows = data.stocks
    .filter((s) => !isStockEtf(s) && profiles[s.ticker])
    .map((s) => ({ item: s, p: profiles[s.ticker] }));
  if (q) {
    rows = rows.filter(({ item, p }) =>
      [item.ticker, item.company, p.topHolder].some((v) => String(v || "").toLowerCase().includes(q))
    );
  }
  // 유통물량이 적을수록 수급이 타이트하다 — 그게 이 표를 보는 이유라 오름차순으로 둔다.
  rows.sort((a, b) => (a.p.freeFloatPct ?? 999) - (b.p.freeFloatPct ?? 999));
  if (!rows.length) {
    table.innerHTML = `<p class="muted">${escapeHtml(payload.note || "표시할 데이터가 없습니다.")}</p>`;
    return;
  }

  const pct = (v) => (Number.isFinite(v) ? `${v.toFixed(2)}%` : "—");
  const num = (v) => (Number.isFinite(v) ? Number(v).toLocaleString() : "—");
  const body = rows.slice(0, 200).map(({ item, p }) => `
    <tr>
      <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(item.ticker)}">${escapeHtml(item.ticker)}</button></td>
      <td>${escapeHtml(item.company || "")}</td>
      <td>${escapeHtml(p.topHolder || "—")}</td>
      <td>${pct(p.ownerStakePct)}</td>
      <td><b>${pct(p.freeFloatPct)}</b></td>
      <td>${num(p.treasuryShares)}</td>
      <td>${num(p.minorityHolders)}</td>
    </tr>`).join("");

  table.innerHTML = `
    <table class="insider-table">
      <thead><tr>
        <th>종목</th><th>회사</th><th>최대주주</th><th>지분율</th>
        <th>유통물량</th><th>자기주식</th><th>소액주주 수</th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table>`;
  table.querySelectorAll(".ins-ticker").forEach((btn) => {
    btn.addEventListener("click", () => selectTicker(btn.dataset.ticker, { openSearch: true }));
  });
}

function renderKrOwnership() {
  const meta = byId("krOwnMeta");
  const table = byId("krOwnTable");
  if (!table) return;
  if (krOwnKind === "profile") {
    renderKrOwnProfile();
    return;
  }
  const payload = window.KR_OWNERSHIP;
  if (!payload) {
    table.innerHTML = `<p class="muted">지분공시 데이터를 불러오는 중…</p>`;
    return;
  }
  if (meta) {
    meta.textContent = [
      payload.updatedAtKst,
      `최근 ${payload.windowDays || 7}일`,
      `대량보유 ${payload.majorCount || 0}건`,
      `임원 ${payload.insiderCount || 0}건`,
      payload.source,
    ].filter(Boolean).join(" · ");
  }

  const isMajor = krOwnKind === "major";
  let rows = (isMajor ? payload.majorHolders : payload.insiders) || [];
  const q = krOwnQuery.trim().toLowerCase();
  if (q) {
    rows = rows.filter((row) =>
      [row.ticker, row.company, row.filer, row.position, row.reportType]
        .some((v) => String(v || "").toLowerCase().includes(q))
    );
  }
  if (!rows.length) {
    table.innerHTML = `<p class="muted">${escapeHtml(payload.note || "표시할 지분공시가 없습니다.")}</p>`;
    return;
  }

  const head = isMajor
    ? `<tr><th>일자</th><th>종목</th><th>회사</th><th>보고자</th><th>보유비율</th><th>증감</th><th>보유주식</th><th>구분</th></tr>`
    : `<tr><th>일자</th><th>종목</th><th>회사</th><th>보고자</th><th>직위</th><th>소유주식</th><th>증감</th><th>등기</th></tr>`;

  const body = rows.slice(0, 200).map((row) => {
    const common = `
      <td>${escapeHtml(row.fileDate || "")}</td>
      <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(row.ticker)}">${escapeHtml(row.ticker)}</button></td>
      <td>${escapeHtml(row.company || "")}</td>
      <td>${row.link ? `<a href="${escapeHtml(row.link)}" target="_blank" rel="noopener">${escapeHtml(row.filer || "-")}</a>` : escapeHtml(row.filer || "-")}</td>`;
    return isMajor
      ? `<tr>${common}
          <td><b>${krOwnNum(row.ratio, 2)}%</b></td>
          <td>${krOwnDelta(row.ratioChange, "%p", 2)}</td>
          <td>${krOwnNum(row.shares)}</td>
          <td>${escapeHtml(row.reportType || "")}</td>
        </tr>`
      : `<tr>${common}
          <td>${escapeHtml(row.position || "-")}</td>
          <td>${krOwnNum(row.shares)}</td>
          <td>${krOwnDelta(row.sharesChange, "주")}</td>
          <td>${escapeHtml(row.registered || "-")}</td>
        </tr>`;
  }).join("");

  table.innerHTML = `<table class="insider-table"><thead>${head}</thead><tbody>${body}</tbody></table>`;
  table.querySelectorAll(".ins-ticker").forEach((btn) => {
    btn.addEventListener("click", () => selectTicker(btn.dataset.ticker, { openSearch: true }));
  });
}

function setupKrOwnershipEvents() {
  const search = byId("krOwnSearch");
  if (search) search.addEventListener("input", () => { krOwnQuery = search.value; renderKrOwnership(); });
  byId("krOwnKinds")?.querySelectorAll("[data-krown]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = btn.dataset.krown;
      krOwnKind = ["insider", "profile"].includes(kind) ? kind : "major";
      byId("krOwnKinds").querySelectorAll("[data-krown]").forEach((b) => {
        b.classList.toggle("is-active", b === btn);
      });
      // 지배구조 탭은 다른 데이터셋을 쓴다 — 처음 열 때 받아온다.
      if (krOwnKind === "profile") {
        renderWithFeature("krOwnProfile", renderKrOwnership, "krOwnTable");
      } else {
        renderWithFeature("krOwnership", renderKrOwnership, "krOwnTable");
      }
    });
  });
}

loadData();

// ===== PWA Offline / Stale Snapshot Banner =====
function getSnapshotTimestamp() {
  return (data && (data.updatedAtKst || data.updated_at_kst)) || "";
}

function snapshotAgeHours() {
  const snap = parseSnapshotDate(getSnapshotTimestamp());
  return snap ? Math.max(0, (Date.now() - snap.getTime()) / 36e5) : null;
}

function refreshMirDataStatus() {
  const isOnline = navigator.onLine;
  const snapshotTime = getSnapshotTimestamp();
  const ageHours = snapshotAgeHours();
  const isStale = ageHours != null && ageHours > 30;
  window.MirDataStatus = {
    isOnline,
    isOffline: !isOnline,
    isStale,
    snapshotTime,
    ageHours,
    showBanner: !isOnline || isStale,
  };
  return window.MirDataStatus;
}

function updateOnlineStatus() {
  const status = refreshMirDataStatus();
  const existing = byId("offlineBanner");
  if (status.showBanner) {
    const timeLabel = status.snapshotTime || "갱신 시각 미상";
    const reason = status.isOffline
      ? "네트워크 연결이 끊겼습니다"
      : "로컬 과거 데이터 표시 중";
    const detail = status.isOffline
      ? `오프라인 캐시 스냅샷(${timeLabel})입니다. 실시간 시세가 아닙니다.`
      : `스냅샷 기준 ${timeLabel} · ${Math.round(status.ageHours || 0)}시간 경과. 실시간 시세가 아닐 수 있습니다.`;
    if (!existing) {
      const banner = document.createElement("div");
      banner.id = "offlineBanner";
      banner.className = "offline-banner";
      document.body.appendChild(banner);
    }
    const banner = byId("offlineBanner");
    if (banner) {
      banner.innerHTML = `
        <div class="offline-banner-content">
          <span class="offline-icon"></span>
          <strong>${reason}</strong>
          <span>${detail}</span>
        </div>`;
    }
    return;
  }
  if (existing) {
    existing.remove();
    if (status.isOnline) {
      showAppToast("네트워크가 복구되었습니다. 최신 데이터를 받아옵니다.", 3000);
      loadData({ preserveRoute: true });
    }
  }
}
window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);
updateOnlineStatus();

// ===== AI Search and Deep Report UI Handler =====
let currentActiveReportTicker = null;
let aiReportBusy = false;

function extractStockTickerFromQuery(query) {
  const text = String(query || "").trim().toLowerCase();
  if (!text) return null;
  
  // 1. Try exact ticker match candidate
  const candidates = extractTickerCandidates(query);
  if (candidates && candidates.length > 0) {
    return candidates[0];
  }
  
  // 2. Try Korean nickname / alias lookup
  if (tickerKoAliasEntries) {
    const sorted = [...tickerKoAliasEntries].sort((a, b) => b.alias.length - a.alias.length);
    for (const entry of sorted) {
      if (text.includes(entry.alias.toLowerCase())) {
        if (entry.tickers && entry.tickers.length > 0) {
          return entry.tickers[0];
        }
      }
    }
  }
  
  // 3. Scan company name matches
  if (tickerSearchIndex && tickerSearchIndex.byMarketCap) {
    for (const row of tickerSearchIndex.byMarketCap) {
      const comp = String(row.companyLower || "").toLowerCase();
      if (comp.length > 1 && text.includes(comp)) {
        return row.ticker;
      }
    }
  }
  return null;
}

function formatMarkdownToHtml(md) {
  let html = String(md || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
    
  // Format bold **text** -> <strong>text</strong>
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  
  // Format headers ### title -> <h4>title</h4>
  html = html.replace(/^###\s+(.*?)$/gm, "<h4>$1</h4>");
  html = html.replace(/^##\s+(.*?)$/gm, "<h4>$1</h4>");
  html = html.replace(/^#\s+(.*?)$/gm, "<h4>$1</h4>");
  
  // Format bullet points
  html = html.replace(/^\s*[-*]\s+(.*?)$/gm, "<li>$1</li>");
  
  // Wrap list items in <ul> groups
  html = html.replace(/(<li>.*?<\/li>)/gs, "<ul>$1</ul>");
  html = html.replace(/<\/ul>\s*<ul>/g, "");

  // Convert double newlines to breaks
  html = html.replace(/\n\n/g, "<br><br>");
  
  return html;
}

async function loadAiDeepReport(ticker, customQuery = null) {
  const stock = stockByTicker(ticker);
  if (!stock) return;

  const card = byId("analysisAiReportCard");
  const body = byId("analysisAiReportBody");
  if (!body) return;

  if (card) card.style.display = "flex";

  currentActiveReportTicker = ticker;

  // Show shimmer loading skeleton
  body.innerHTML = `
    <div class="shimmer-loading shimmer-line mid"></div>
    <div class="shimmer-loading shimmer-line"></div>
    <div class="shimmer-loading shimmer-line short"></div>
    <div class="shimmer-loading shimmer-line mid"></div>
    <div class="shimmer-loading shimmer-line"></div>
  `;

  try {
    if (!LIVE_DATA_PROXY) throw new Error("no proxy configured");
    
    const query = customQuery || `${stock.company} (${stock.ticker}) 종목의 최근 차트 보조지표 상태와 펀더멘탈, 리스크 요인을 분석한 투자 의견 리포트`;
    const stockContext = await buildStockChatContext(ticker);
    
    const res = await fetch(`${LIVE_DATA_PROXY.replace(/\/$/, "")}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: query }],
        stockContext,
        snapshotContext: buildMarketChatContext(),
        market: isKrMarket() ? "kr" : "us",
        searchHints: { tickers: [ticker], companies: [stock.company] },
      }),
    });
    
    const payload = await res.json();
    
    // Check if the ticker has changed during the request
    if (currentActiveReportTicker !== ticker) return;
    
    const reply = (payload && payload.reply) || "리포트를 불러오는 데 실패했습니다. 잠시 후 다시 시도해 주세요.";
    body.innerHTML = formatMarkdownToHtml(reply);
    
    if (customQuery) {
      body.dataset.lastQuery = customQuery;
    } else {
      delete body.dataset.lastQuery;
    }
  } catch (err) {
    if (currentActiveReportTicker === ticker) {
      body.innerHTML = `<p class="muted">분석 리포트 로딩 실패: ${err.message || err}</p>`;
    }
  }
}

function handleHomeSearch(query) {
  const q = String(query || "").trim();
  if (!q) return;

  const matchedTicker = extractStockTickerFromQuery(q);
  if (matchedTicker) {
    const stock = stockByTicker(matchedTicker);
    if (stock) {
      const isKr = stock.market === "kospi" || stock.market === "kosdaq";
      const targetMarket = isKr ? "kr" : "us";
      
      if (marketCfg().id !== targetMarket) {
        switchMarketMode(targetMarket).then(() => {
          navigateToStockAnalysis(matchedTicker, q);
        });
      } else {
        navigateToStockAnalysis(matchedTicker, q);
      }
    }
  } else {
    // If no stock matched, open floating chatbot and ask it!
    const panel = byId("chatPanel");
    const input = byId("chatInput");
    if (panel) {
      panel.hidden = false;
      if (input) {
        input.value = q;
        // Trigger chatbot submit
        const form = byId("chatForm");
        if (form) {
          form.dispatchEvent(new Event("submit"));
        }
      }
    }
  }
}

function navigateToStockAnalysis(ticker, query) {
  // 1. Switch main tab to "search"
  const tabButton = document.querySelector('.tab[data-tab="search"]');
  if (tabButton) {
    tabButton.click();
  }
  
  // 2. Select sub-tab "analysis"
  const subTabButton = document.querySelector('.sub-tab[data-sub="analysis"]');
  if (subTabButton) {
    subTabButton.click();
  }
  
  // 3. Scroll smoothly to the analysis sub-panel first
  const analysisPanel = byId("sub-analysis");
  if (analysisPanel) {
    setTimeout(() => {
      analysisPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  }

  // 4. Run the visual assembly animation
  runAiReportAssemblyAnimation(ticker, () => {
    // Callback loads data and report once overlay transitions
    selectTicker(ticker, { fromAiSearch: true });
    loadAiDeepReport(ticker, query);
  });
}

function runAiReportAssemblyAnimation(ticker, callback) {
  const overlay = byId("aiAssemblyOverlay");
  const title = byId("aiAssemblyStatusTitle");
  if (!overlay) {
    if (typeof callback === "function") callback();
    return;
  }

  const stock = stockByTicker(ticker);
  const companyName = stock ? `${stock.company} (${stock.ticker})` : ticker;
  if (title) {
    title.textContent = `${companyName} 투자 보고서 데이터 조립 중`;
  }

  // 1. Reset all step logs to default states
  const steps = ["stepChart", "stepFund", "stepNews", "stepReport"];
  steps.forEach((id) => {
    const el = byId(id);
    if (el) {
      el.className = "assembly-step";
    }
  });

  // 2. Hide all the dashboard components by removing reveal-active
  document.querySelectorAll(".animate-reveal").forEach((card) => {
    card.classList.remove("reveal-active");
  });

  // 3. Show overlay
  overlay.hidden = false;
  overlay.style.opacity = "1";

  // 4. Run step-by-step progress logging
  setTimeout(() => {
    activateStep("stepChart");
  }, 150);

  setTimeout(() => {
    markStepDone("stepChart");
    activateStep("stepFund");
  }, 600);

  setTimeout(() => {
    markStepDone("stepFund");
    activateStep("stepNews");
  }, 1100);

  setTimeout(() => {
    markStepDone("stepNews");
    activateStep("stepReport");
  }, 1600);

  // 5. Fade out overlay and reveal dashboard components in staggered sequence
  setTimeout(() => {
    markStepDone("stepReport");
    
    // Smoothly fade out the overlay
    overlay.style.opacity = "0";
    setTimeout(() => {
      overlay.hidden = true;
      
      // Execute the load details callback
      if (typeof callback === "function") callback();

      // Trigger staggered component reveals
      revealComponentsStaggered();
    }, 500);
  }, 2200);
}

function activateStep(id) {
  const el = byId(id);
  if (el) {
    el.classList.add("active");
  }
}

function markStepDone(id) {
  const el = byId(id);
  if (el) {
    el.classList.remove("active");
    el.classList.add("done");
  }
}

function revealComponentsStaggered() {
  const cards = Array.from(document.querySelectorAll(".animate-reveal"));
  cards.forEach((card, index) => {
    setTimeout(() => {
      card.classList.add("reveal-active");
    }, index * 100); // 100ms staggered delay
  });
}

function setupAiSearchEvents() {
  const form = byId("homeSearchForm");
  const input = byId("homeSearchInput");
  if (form && input) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      handleHomeSearch(input.value);
    });
  }
  
  document.querySelectorAll(".search-suggest-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const q = btn.dataset.query;
      if (input) input.value = q;
      handleHomeSearch(q);
    });
  });

  const refreshBtn = byId("analysisAiReportRefresh");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      if (selectedTicker) {
        const body = byId("analysisAiReportBody");
        const lastQuery = body ? body.dataset.lastQuery : null;
        loadAiDeepReport(selectedTicker, lastQuery);
      }
    });
  }
}

// Initialize AI Search Events
setupAiSearchEvents();

// ===== Dedicated AI Chat Mode Handler =====
let isAiChatMode = false;
let aiChatBusy = false;
let aiChatHistory = [];
let aiChatSessions = {}; // Structure: { [sessionId]: { name: string, history: Array, timestamp: string } }
let currentSessionId = null;

// 로컬스토리지 대화 기록 저장
// localStorage 는 ~5MB 한도가 있다. 세션·메시지를 무한히 쌓으면 언젠가
// setItem 이 QuotaExceededError 로 터지고, 그 뒤로는 아무 것도 저장되지 않는다.
const AI_SESSIONS_MAX = 30;          // 최신 30개 세션만 보관
const AI_SESSION_MESSAGES_MAX = 200; // 세션당 최신 200개 메시지만 보관

function pruneAiSessions() {
  const entries = Object.entries(aiChatSessions)
    .sort((a, b) => new Date(b[1].timestamp) - new Date(a[1].timestamp));
  entries.slice(AI_SESSIONS_MAX).forEach(([id]) => {
    if (id !== currentSessionId) delete aiChatSessions[id];
  });
  Object.values(aiChatSessions).forEach((session) => {
    if (Array.isArray(session.history) && session.history.length > AI_SESSION_MESSAGES_MAX) {
      session.history.splice(0, session.history.length - AI_SESSION_MESSAGES_MAX);
    }
  });
}

function saveAiSessionsToStorage() {
  pruneAiSessions();
  try {
    localStorage.setItem("mir_ai_sessions", JSON.stringify(aiChatSessions));
    localStorage.setItem("mir_ai_current_session", currentSessionId);
  } catch (e) { /* 쿼터 초과 등 — 저장 실패해도 화면 동작은 유지 */ }
}

// 대화 기록 불러오기 및 사이드바 렌더링
function loadAndRenderAiHistory() {
  const saved = localStorage.getItem("mir_ai_sessions");
  const savedCurrent = localStorage.getItem("mir_ai_current_session");
  
  if (saved) {
    try {
      aiChatSessions = JSON.parse(saved);
    } catch (e) {
      aiChatSessions = {};
    }
  } else {
    aiChatSessions = {};
  }
  
  currentSessionId = savedCurrent || null;
  renderAiHistoryList();
}

function renderAiHistoryList() {
  const historyList = byId("aiHistoryList");
  if (!historyList) return;
  
  historyList.innerHTML = "";
  const sortedSessions = Object.entries(aiChatSessions).sort((a, b) => {
    return new Date(b[1].timestamp) - new Date(a[1].timestamp);
  });
  
  if (sortedSessions.length === 0) {
    historyList.innerHTML = `<li class="muted font-small" style="text-align:center;padding:12px;">이전 기록이 없습니다.</li>`;
    return;
  }
  
  sortedSessions.forEach(([id, session]) => {
    const item = document.createElement("li");
    item.className = `ai-history-item${id === currentSessionId ? " active" : ""}`;
    item.dataset.id = id;
    
    // 대화방 이름 줄임표 처리
    const shortName = session.name.length > 18 ? session.name.substring(0, 18) + "..." : session.name;
    const dateStr = new Date(session.timestamp).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    
    item.innerHTML = `
      <div class="session-info-wrap">
        <strong>${escapeHtml(shortName)}</strong>
        <span>${escapeHtml(dateStr)}</span>
      </div>
      <div class="session-menu-wrapper">
        <button class="session-menu-trigger" title="대화방 옵션" aria-label="대화방 옵션">⋯</button>
        <div class="session-context-menu">
          <button class="context-rename-btn">이름 변경</button>
          <button class="context-delete-btn">삭제</button>
        </div>
      </div>
    `;
    
    item.addEventListener("click", () => {
      switchAiChatSession(id);
    });
    
    // 더블클릭 인라인 이름 변경 (PC 편의용)
    item.addEventListener("dblclick", (e) => {
      if (e.target.closest(".session-menu-wrapper")) return;
      triggerInlineRename(item, session);
    });
    
    const trigger = item.querySelector(".session-menu-trigger");
    const menu = item.querySelector(".session-context-menu");
    
    if (trigger && menu) {
      trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelectorAll(".session-context-menu.is-open").forEach(m => {
          if (m !== menu) m.classList.remove("is-open");
        });
        menu.classList.toggle("is-open");
      });
      
      const renameBtn = menu.querySelector(".context-rename-btn");
      if (renameBtn) {
        renameBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          menu.classList.remove("is-open");
          triggerInlineRename(item, session);
        });
      }
      
      const deleteBtn = menu.querySelector(".context-delete-btn");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          menu.classList.remove("is-open");
          if (await showAppConfirm("이 대화 기록을 삭제하시겠습니까?", { title: "대화 기록 삭제", okLabel: "삭제", danger: true })) {
            deleteAiChatSession(id);
          }
        });
      }
    }
    
    historyList.appendChild(item);
  });

  // 바깥 클릭 시 컨텍스트 메뉴 닫기 — 세션×렌더 횟수만큼 document 리스너가
  // 쌓이던 것을 위임 리스너 1개로 대체한다.
  if (!renderAiHistoryList._outsideBound) {
    renderAiHistoryList._outsideBound = true;
    document.addEventListener("click", (e) => {
      document.querySelectorAll(".session-context-menu.is-open").forEach((m) => {
        if (!m.contains(e.target) && !e.target.closest(".session-menu-trigger")) {
          m.classList.remove("is-open");
        }
      });
    });
  }
}

// 인라인 세션 이름 편집 실행 헬퍼
function triggerInlineRename(item, session) {
  const infoWrap = item.querySelector(".session-info-wrap");
  const strong = infoWrap?.querySelector("strong");
  if (!strong || infoWrap.querySelector(".rename-session-input")) return;
  
  const prevName = session.name;
  strong.style.display = "none";
  
  const input = document.createElement("input");
  input.type = "text";
  input.className = "rename-session-input";
  input.value = prevName;
  
  input.addEventListener("click", (evt) => evt.stopPropagation());
  input.addEventListener("dblclick", (evt) => evt.stopPropagation());
  
  const saveRename = () => {
    const val = input.value.trim();
    if (val && val !== prevName) {
      session.name = val;
      saveAiSessionsToStorage();
    }
    renderAiHistoryList();
  };
  
  input.addEventListener("keydown", (evt) => {
    if (evt.key === "Enter") {
      evt.preventDefault();
      saveRename();
    } else if (evt.key === "Escape") {
      renderAiHistoryList();
    }
  });
  
  input.addEventListener("blur", saveRename);
  
  infoWrap.insertBefore(input, strong);
  input.focus();
  input.select();
}

// 세션 개별 삭제
function deleteAiChatSession(sessionId) {
  if (!aiChatSessions[sessionId]) return;
  
  delete aiChatSessions[sessionId];
  saveAiSessionsToStorage();
  
  if (currentSessionId === sessionId) {
    const remaining = Object.keys(aiChatSessions);
    if (remaining.length > 0) {
      switchAiChatSession(remaining[0]);
    } else {
      startNewAiChatSession();
    }
  } else {
    renderAiHistoryList();
  }
}

// 세션 전환
function switchAiChatSession(sessionId) {
  if (!aiChatSessions[sessionId]) return;
  
  currentSessionId = sessionId;
  aiChatHistory = aiChatSessions[sessionId].history;
  saveAiSessionsToStorage();
  renderAiHistoryList();
  
  // 채팅창 로그 리빌
  const log = byId("aiChatLog");
  const welcome = byId("aiChatWelcome");
  if (log) {
    log.innerHTML = "";
    if (welcome) welcome.style.display = "none";
    
    // 복원 시에는 타이핑 효과 없이 즉시 렌더링
    aiChatHistory.forEach(msg => {
      appendAiChatMessage(msg.role, msg.content, false); // 세 번째 인자로 typingEffect = false
    });
    
    log.scrollTop = log.scrollHeight;
  }
}

function getPersonalizedWelcomeData() {
  let bestTicker = "NVDA";
  let bestName = "엔비디아";
  let maxChange = 0;
  
  // 모듈 변수 watchlist 를 직접 참조한다 — window.watchlist 는 존재하지 않고,
  // 스냅샷의 등락률 필드명은 changePercent 가 아니라 changePct 다.
  if (Array.isArray(watchlist) && watchlist.length > 0) {
    watchlist.forEach(t => {
      const stock = stockByTicker(t);
      if (stock && stock.changePct != null) {
        const absChange = Math.abs(parseFloat(stock.changePct));
        if (absChange > maxChange) {
          maxChange = absChange;
          bestTicker = t;
          bestName = stock.company;
        }
      }
    });
  }
  
  return { ticker: bestTicker, name: bestName, change: maxChange };
}

// 새 대화 시작
function startNewAiChatSession() {
  currentSessionId = "session_" + Date.now();
  aiChatHistory = [];
  aiChatSessions[currentSessionId] = {
    name: "새로운 대화",
    history: aiChatHistory,
    timestamp: new Date().toISOString()
  };
  
  saveAiSessionsToStorage();
  renderAiHistoryList();
  
  const log = byId("aiChatLog");
  const welcome = byId("aiChatWelcome");
  if (log) {
    log.innerHTML = "";
    if (welcome) {
      welcome.style.display = "block";
      
      // 관심종목 변동 정보 연동 개인화
      const welcomeData = getPersonalizedWelcomeData();
      const mutedP = welcome.querySelector("p.muted");
      if (mutedP) {
        mutedP.innerHTML = `오늘 관심 종목 중 등락률이 높은 <strong>${escapeHtml(welcomeData.name)} (${escapeHtml(welcomeData.ticker)})</strong>의 정밀 AI 리포트를 확인해 보시겠어요? 아래 카드를 누르거나 무엇이든 질문해 주세요.`;
      }
      
      const firstCard = welcome.querySelector(".welcome-suggestions .ai-chat-suggest-card");
      if (firstCard) {
        firstCard.dataset.query = `${welcomeData.ticker} 분석해줘`;
        const cardStrong = firstCard.querySelector("strong");
        const cardSpan = firstCard.querySelector("span");
        if (cardStrong) cardStrong.textContent = `${welcomeData.ticker} 분석해줘`;
        if (cardSpan) cardSpan.textContent = `${welcomeData.name}의 핵심 기술 지표, 실적 상황을 종합 점검합니다.`; // textContent 라 escape 불필요(이중 이스케이프 방지)
      }
    }
  }
}

function toggleAiChatMode(active) {
  isAiChatMode = active;
  const toggleBtn = byId("aiModeToggle");
  
  if (active) {
    document.body.classList.add("ai-mode-active");
    if (toggleBtn) toggleBtn.classList.add("active");
    
    // Switch to chat panel
    const tabChat = byId("tab-ai-chat");
    if (tabChat) {
      tabChat.hidden = false;
    }
    
    // 사이드바 목록 로드
    loadAndRenderAiHistory();
    if (!currentSessionId || !aiChatSessions[currentSessionId]) {
      startNewAiChatSession();
    }
    
    // Scroll chat log to bottom
    const log = byId("aiChatLog");
    if (log) log.scrollTop = log.scrollHeight;
  } else {
    document.body.classList.remove("ai-mode-active");
    if (toggleBtn) toggleBtn.classList.remove("active");
    
    const tabChat = byId("tab-ai-chat");
    if (tabChat) {
      tabChat.hidden = true;
    }
  }
}

function generateAiBadges(text) {
  const badges = [];
  const lower = text.toLowerCase();
  
  // 1. 호재/악재 감지
  if (lower.includes("호재") || lower.includes("긍정") || lower.includes("상승") || lower.includes("매수 신호") || lower.includes("강세")) {
    badges.push('<span class="ai-badge-tag bullish">종합: 호재</span>');
  } else if (lower.includes("악재") || lower.includes("경계") || lower.includes("하락") || lower.includes("위험") || lower.includes("우려")) {
    badges.push('<span class="ai-badge-tag bearish">종합: 경계</span>');
  } else {
    badges.push('<span class="ai-badge-tag neutral">종합: 중립</span>');
  }
  
  // 2. 테마 감지
  if (lower.includes("반도체") || lower.includes("hbm") || lower.includes("메모리") || lower.includes("삼성전자") || lower.includes("하이닉스") || lower.includes("nvda") || lower.includes("엔비디아")) {
    badges.push('<span class="ai-badge-tag neutral">테마: 반도체</span>');
  } else if (lower.includes("금리") || lower.includes("연준") || lower.includes("fomc") || lower.includes("인플레이션")) {
    badges.push('<span class="ai-badge-tag neutral">매크로: 금리</span>');
  } else if (lower.includes("수출") || lower.includes("수입") || lower.includes("무역")) {
    badges.push('<span class="ai-badge-tag neutral">실물: 수출</span>');
  } else if (lower.includes("부동산") || lower.includes("규제") || lower.includes("동탄") || lower.includes("기흥")) {
    badges.push('<span class="ai-badge-tag neutral">자산: 부동산</span>');
  }
  
  if (badges.length > 0) {
    return `<div class="ai-badge-tags-container">${badges.join("")}</div>`;
  }
  return "";
}

function typeWriterMarkdown(element, rawText, onComplete) {
  let i = 0;
  element.innerHTML = "";
  
  const interval = setInterval(() => {
    if (i >= rawText.length) {
      clearInterval(interval);
      element.innerHTML = formatMarkdownToHtml(rawText); // 최종 HTML 정밀 파싱 적용
      if (onComplete) onComplete();
      return;
    }
    
    // 타이핑 속도 보정 (한 번에 3글자씩 누적하여 부드러운 가속 제공)
    const step = Math.min(3, rawText.length - i);
    i += step;
    element.innerHTML = formatMarkdownToHtml(rawText.substring(0, i));
  }, 16);
}

async function sendAiChat(queryText = null) {
  if (aiChatBusy) return;
  
  const input = byId("aiChatInput");
  const text = queryText !== null ? queryText.trim() : (input ? input.value.trim() : "");
  if (!text) return;
  
  if (input && queryText === null) {
    input.value = "";
  }
  
  const log = byId("aiChatLog");
  const welcome = byId("aiChatWelcome");
  if (welcome) {
    welcome.style.display = "none";
  }
  
  // 첫 질문 시 대화 세션명 업데이트
  if (aiChatSessions[currentSessionId] && aiChatSessions[currentSessionId].name === "새로운 대화") {
    aiChatSessions[currentSessionId].name = text;
  }
  
  // 1. Add User Message bubble
  appendAiChatMessage("user", text);
  aiChatHistory.push({ role: "user", content: text });
  
  aiChatBusy = true;
  
  // 2. Add Bot Loading/Typing bubble
  const matchedTicker = extractStockTickerFromQuery(text);
  const loadingText = matchedTicker 
    ? `${stockByTicker(matchedTicker).company} (${matchedTicker}) 데이터를 분석하여 심층 투자 보고서를 요약하고 있습니다...`
    : "답변을 작성하고 있습니다...";
    
  const typingBubble = appendAiChatMessage("bot", loadingText, false);
  typingBubble.classList.add("typing");

  if (matchedTicker) {
    const chartMessage = appendAiChatMessage("bot", "", false);
    if (chartMessage) {
      chartMessage.classList.add("chart-message");
      chartMessage.querySelector(".msg-bubble")?.remove();
      renderInlineStockWidget(matchedTicker, chartMessage);
    }
  }
  
  if (log) log.scrollTop = log.scrollHeight;
  
  try {
    if (!LIVE_DATA_PROXY) throw new Error("no proxy configured");
    
    const stockContext = matchedTicker ? await buildStockChatContext(matchedTicker) : "";
    const res = await fetch(`${LIVE_DATA_PROXY.replace(/\/$/, "")}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: aiChatHistory.slice(-10),
        stockContext,
        snapshotContext: buildMarketChatContext(),
        market: isKrMarket() ? "kr" : "us",
        searchHints: matchedTicker ? { tickers: [matchedTicker], companies: [stockByTicker(matchedTicker).company] } : {},
      }),
    });
    
    const payload = await res.json();
    const reply = (payload && payload.reply) || "답변을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.";
    
    typingBubble.classList.remove("typing");
    const bubbleDiv = typingBubble.querySelector(".msg-bubble");
    
    // 타이핑 라이터 효과 실행
    typeWriterMarkdown(bubbleDiv, reply, () => {
      aiChatHistory.push({ role: "assistant", content: reply });
      
      // 오토 태그 바인딩
      const badgesHtml = generateAiBadges(reply);
      if (badgesHtml) {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = badgesHtml;
        typingBubble.insertBefore(tempDiv.firstChild, bubbleDiv);
      }
      
      // 로컬스토리지 저장 및 사이드바 갱신
      if (aiChatSessions[currentSessionId]) {
        aiChatSessions[currentSessionId].history = aiChatHistory;
        aiChatSessions[currentSessionId].timestamp = new Date().toISOString();
        saveAiSessionsToStorage();
        renderAiHistoryList();
      }
    });
    
  } catch (err) {
    typingBubble.classList.remove("typing");
    const bubbleDiv = typingBubble.querySelector(".msg-bubble");
    if (bubbleDiv) {
      bubbleDiv.innerHTML = `연결 실패: ${err.message || err}`;
    }
  } finally {
    aiChatBusy = false;
  }
}

// ai-mode-welcome.js 가 쓰는 창구. 웰컴 화면이 submit 을 capture 단계에서 가로채므로
// 폼 경로로는 sendAiChat 에 닿을 수 없다. 종목이 아닌 질문은 웰컴이 여기로 넘긴다.
// resolveTicker 도 함께 넘겨, 웰컴이 자체 해석기를 따로 두지 않게 한다
// (자체 해석기는 문자열 전체가 티커일 때만 맞아서 "NVDA 분석해줘" 를 놓쳤다).
window.MirAiChat = {
  send: (text) => sendAiChat(text),
  resolveTicker: (text) => extractStockTickerFromQuery(text),
};

function appendAiChatMessage(role, htmlOrText, isMarkdown = false) {
  const log = byId("aiChatLog");
  if (!log) return null;
  
  const msg = document.createElement("div");
  msg.className = `chat-msg ${role}`;
  
  if (role === "user") {
    msg.innerHTML = `<div class="msg-bubble">${escapeHtml(htmlOrText)}</div>`;
  } else {
    const badgesHtml = role === "bot" ? generateAiBadges(htmlOrText) : "";
    const parsedContent = isMarkdown ? formatMarkdownToHtml(htmlOrText) : htmlOrText;
    msg.innerHTML = `
      ${badgesHtml}
      <div class="msg-bubble">
        ${parsedContent}
        ${role === "bot" && htmlOrText ? `<button class="copy-msg-btn" title="답변 복사" aria-label="답변 복사">복사</button>` : ""}
      </div>
    `;
    
    const copyBtn = msg.querySelector(".copy-msg-btn");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        // 복사 버튼 자신을 제외한 텍스트만 복사하기 위해, 복제 후 복사 버튼 노드를 제거하고 텍스트를 파싱
        const bubble = msg.querySelector(".msg-bubble");
        if (bubble) {
          const clone = bubble.cloneNode(true);
          clone.querySelector(".copy-msg-btn")?.remove();
          const textToCopy = clone.innerText.trim();
          
          navigator.clipboard.writeText(textToCopy).then(() => {
            copyBtn.textContent = "✓";
            copyBtn.classList.add("copied");
            setTimeout(() => {
              copyBtn.textContent = "복사";
              copyBtn.classList.remove("copied");
            }, 1500);
          }).catch(err => {
            console.error("복사 실패:", err);
          });
        }
      });
    }
  }
  
  log.appendChild(msg);
  log.scrollTop = log.scrollHeight;
  return msg;
}

const aiLiveDataPromises = {};

function createAiChartState() {
  return {
    ...chartState,
    range: "1Y",
    barTf: "D",
    chartType: "candle",
    zoom: 1,
    offset: 0,
    showSma20: true,
    showSma60: true,
    showVolume: true,
    showRsi: true,
    showMacd: false,
    showStoch: false,
    showSupportResistance: true,
    showPatterns: true,
    showTechLevels: true,
    showVolumeProfile: false,
    showTrendlines: true,
    showGapZones: false,
    showTtmSqueeze: false,
    showMarketStructure: false,
    showChandelier: false,
    showAnchoredVwap: false,
    showRsSpy: false,
    showRsQqq: false,
    showRsSector: false,
    showMansfield: false,
    techLevelTypes: { ...chartState.techLevelTypes },
    patternTypes: { ...chartState.patternTypes },
  };
}

async function ensureAiWidgetStock(ticker) {
  const base = stockByTicker(ticker) || data.stocks.find((row) => row.ticker === ticker);
  if (!base) return null;
  await Promise.all([
    loadStockDetail(ticker),
    ...["inst13f", "insider", "short", "congress", "activist", "events"].map((key) =>
      (typeof ensureFeatureData === "function" ? ensureFeatureData(key) : Promise.resolve(false)).catch(() => false)),
  ]);

  if (LIVE_DATA_PROXY && !liveDone[ticker]) {
    if (!aiLiveDataPromises[ticker]) {
      liveFetched[ticker] = true;
      const endpoint = `${LIVE_DATA_PROXY.replace(/\/$/, "")}/?ticker=${encodeURIComponent(liveProxyTicker(base))}`;
      aiLiveDataPromises[ticker] = fetch(endpoint, { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => {
          if (!payload) return;
          if (Array.isArray(payload.news)) liveNewsCache[ticker] = payload.news;
          if (typeof payload.newsSource === "string") liveNewsSourceCache[ticker] = payload.newsSource;
          if (Array.isArray(payload.chart)) liveChartCache[ticker] = payload.chart;
          if (payload.earnings) liveEarningsCache[ticker] = payload.earnings;
          if (typeof payload.summary === "string") liveSummaryCache[ticker] = payload.summary;
          liveDone[ticker] = true;
        })
        .catch(() => {
          liveDone[ticker] = true;
        });
    }
    await aiLiveDataPromises[ticker].catch(() => {});
  }

  const refreshed = stockByTicker(ticker) || base;
  return applyLive(withDetail(refreshed));
}

function aiEvidenceCard(title, value, detail, tone = "") {
  return `
    <article class="ai-evidence-card${tone ? ` ${tone}` : ""}">
      <span>${escapeHtml(title)}</span>
      <strong>${escapeHtml(value || "-")}</strong>
      <p>${escapeHtml(detail || "확인된 데이터가 아직 없습니다.")}</p>
    </article>
  `;
}

function aiSectorEvidence(item) {
  const peers = (data.stocks || []).filter((row) => row.sector === item.sector && row.ticker !== item.ticker);
  const sectorAvg = peers.length
    ? peers.reduce((sum, row) => sum + Number(row.changePct || 0), 0) / peers.length
    : 0;
  const ranked = peers.concat(item).sort((a, b) => Number(b.rsScore || 0) - Number(a.rsScore || 0));
  const rank = ranked.findIndex((row) => row.ticker === item.ticker) + 1;
  const rel = Number(item.changePct || 0) - sectorAvg;
  return aiEvidenceCard(
    "섹터 흐름",
    `${item.sector || "섹터"} ${rel >= 0 ? "대비 강함" : "대비 약함"}`,
    `섹터 평균 ${fmtPct(sectorAvg)} · 종목 ${fmtDailyPct(item.changePct)} · RS 순위 ${rank || "-"}/${ranked.length || "-"}`,
    rel >= 0 ? "is-positive" : "is-negative"
  );
}

function aiSmartMoneyEvidence(item) {
  if (isKrMarket()) {
    return aiEvidenceCard("스마트머니", "국내 종목", "미국식 내부자·13F·의회 매매 데이터는 국내 종목에 제한적으로만 적용됩니다.");
  }
  const t = item.ticker;
  const bits = [];
  const ins = ((window.INSIDER_TRADES || {}).trades || []).filter((row) => row.ticker === t);
  if (ins.length) {
    const buys = ins.filter((row) => row.kind === "buy").length;
    const sells = ins.filter((row) => row.kind === "sell").length;
    bits.push(`내부자 매수 ${buys} / 매도 ${sells}`);
  }
  const cg = ((window.CONGRESS_TRADES || {}).byTicker || {})[t];
  if (cg) bits.push(`의회 매수 ${cg.netBuys || 0} / 매도 ${cg.netSells || 0}`);
  const f13 = (typeof inst13fIndex === "function" ? inst13fIndex() : {})[t];
  if (f13) bits.push(`13F 보유 ${f13.holders}곳`);
  const act = ((window.ACTIVIST_STAKES || {}).filings || []).filter((row) => row.ticker === t);
  if (act.length) bits.push(`대량보유 ${act.length}건`);
  const shortRow = ((window.SHORT_INTEREST || {}).rows || []).find((row) => row.ticker === t);
  if (shortRow) bits.push(shortIsBalance() ? `공매도 잔고비중 ${Number(shortRow.balanceRatio || 0).toFixed(2)}%` : `공매도 DTC ${Number(shortRow.daysToCover || 0).toFixed(1)}일`);

  return aiEvidenceCard(
    "스마트머니",
    bits.length ? "신호 확인" : "특이 신호 적음",
    bits.slice(0, 4).join(" · ") || "내부자·기관·의회·대량보유 신호가 아직 뚜렷하지 않습니다.",
    bits.length ? "is-info" : ""
  );
}

function aiDisclosureEvidence(item) {
  const events = ((window.MATERIAL_EVENTS || {}).events || []).filter((event) => String(event.ticker || "").toUpperCase() === item.ticker);
  const earnings = item.liveEarnings || {};
  if (events.length) {
    const latest = events[0];
    const labels = (latest.items || []).map((entry) => entry.label).filter(Boolean).slice(0, 3).join(", ");
    return aiEvidenceCard("공시·이벤트", `${events.length}건`, `${latest.fileDate || "최근"} · ${labels || latest.type || "주요 이벤트"}`, latest.hot ? "is-warning" : "is-info");
  }
  if (earnings.nextDate) {
    return aiEvidenceCard("공시·이벤트", "실적 예정", `${earnings.nextDate}${earnings.epsEstimate != null ? ` · EPS 예상 ${earnings.epsEstimate}` : ""}`, "is-info");
  }
  return aiEvidenceCard("공시·이벤트", "특이 공시 없음", "최근 수집된 주요 8-K·실적 이벤트가 없습니다.");
}

function aiNewsEvidence(item) {
  const news = Array.isArray(item.news) ? item.news : [];
  if (!news.length) return aiEvidenceCard("뉴스", "뉴스 부족", "이 종목의 최신 뉴스가 아직 수집되지 않았습니다.");
  const headline = news[0].title || "최신 헤드라인";
  const source = news[0].source || news[0].publisher || "";
  return aiEvidenceCard("뉴스", headline.slice(0, 34), `${source}${news.length > 1 ? ` · 추가 ${news.length - 1}건` : ""}`, "is-info ai-news-dup");
}

function renderAiEvidenceGrid(item) {
  return [
    aiSectorEvidence(item),
    aiSmartMoneyEvidence(item),
    aiDisclosureEvidence(item),
    aiNewsEvidence(item),
  ].join("");
}

function aiModePanel(title, subtitle, body, extraClass = "") {
  return `
    <section class="ai-mode-data-panel${extraClass ? ` ${extraClass}` : ""}">
      <div class="ai-mode-data-head">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(subtitle || "")}</span>
      </div>
      ${body || `<p class="muted">표시할 데이터가 아직 없습니다.</p>`}
    </section>
  `;
}

function aiMetricGrid(metrics) {
  return `<div class="ai-mode-metric-grid">${metrics.map((metric) => `
    <article>
      <span>${escapeHtml(metric.label)}</span>
      <strong class="${metric.tone || ""}">${escapeHtml(String(metric.value ?? "-"))}</strong>
      ${metric.detail ? `<em>${escapeHtml(metric.detail)}</em>` : ""}
    </article>
  `).join("")}</div>`;
}

function aiMiniTable(headers, rows, emptyText = "데이터가 없습니다.") {
  if (!rows.length) return `<p class="muted ai-mode-empty">${escapeHtml(emptyText)}</p>`;
  return `
    <div class="ai-mode-table-wrap">
      <table class="ai-mode-table">
        <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
    </div>
  `;
}

function aiTechnicalPanel(item) {
  const rows = getChartRows(item);
  const closes = rows.map((row) => Number(row.c)).filter(Number.isFinite);
  const last = closes[closes.length - 1];
  const rsi = closes.length > 14 ? lastN(rsiSeries(closes, 14), 1)[0] : null;
  const macdPack = closes.length > 35 ? macdSeries(closes) : null;
  const macd = macdPack ? lastN(macdPack.macd, 1)[0] : null;
  const signal = macdPack ? lastN(macdPack.signal, 1)[0] : null;
  const sma20 = closes.length >= 20 ? closes.slice(-20).reduce((sum, value) => sum + value, 0) / 20 : null;
  const sma60 = closes.length >= 60 ? closes.slice(-60).reduce((sum, value) => sum + value, 0) / 60 : null;
  return aiModePanel("기술 지표", "추세·모멘텀·이평", aiMetricGrid([
    { label: "현재가", value: priceOrDash(last || item.price) },
    { label: "1개월", value: fmtPct(item.monthChangePct), tone: cls(item.monthChangePct) },
    { label: "RS 점수", value: item.rsScore ?? "-", detail: "상대강도" },
    { label: "거래량", value: `${Number(item.volumeRatio || 0).toFixed(1)}x`, detail: "평균 대비" },
    { label: "RSI(14)", value: rsi == null ? "-" : rsi.toFixed(1), tone: rsi >= 70 ? "warn" : rsi <= 30 ? "pos" : "" },
    { label: "MACD", value: macd == null ? "-" : macd.toFixed(2), detail: signal == null ? "" : `Signal ${signal.toFixed(2)}`, tone: macd != null && signal != null ? cls(macd - signal) : "" },
    { label: "SMA20", value: sma20 == null ? "-" : chartPriceLabel(sma20), tone: last != null && sma20 != null ? cls(last - sma20) : "" },
    { label: "SMA60", value: sma60 == null ? "-" : chartPriceLabel(sma60), tone: last != null && sma60 != null ? cls(last - sma60) : "" },
  ]));
}

function aiFundamentalPanel(item) {
  const f = normalizedFundamentalsForItem(item);
  return aiModePanel("밸류에이션", "재무·가치", aiMetricGrid([
    { label: "시가총액", value: fmtBillions(f.marketCapDisplay ?? f.marketCapB ?? item.marketCapB) },
    { label: "PER", value: fmtMultiple(f.pe) },
    { label: "Forward PER", value: fmtMultiple(f.forwardPE) },
    { label: "P/S", value: fmtMultiple(f.ps) },
    { label: "EPS Next Y", value: moneyOrDash(f.epsNextY) },
    { label: "매출", value: fmtFinancialB(f.salesB) },
    { label: "순이익", value: fmtFinancialB(f.incomeB) },
    { label: "ROE", value: fmtPercent(f.roe) },
  ]));
}

function aiNewsPanel(item) {
  const news = Array.isArray(item.news) ? item.news : [];
  const rows = news.slice(0, 8).map((newsItem) => {
    const href = newsItem.url || newsItem.link || "#";
    const title = escapeHtml(newsItem.title || "제목 없음");
    const source = escapeHtml(newsItem.source || newsItem.publisher || "뉴스");
    const time = escapeHtml(newsItem.time || newsItem.publishedAt || "");
    return [
      `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${title}</a>`,
      source,
      time || "-",
    ];
  });
  return aiModePanel("뉴스", `${news.length}건`, aiMiniTable(["헤드라인", "출처", "시간"], rows, "이 종목의 뉴스가 아직 수집되지 않았습니다."), "is-wide ai-news-dup");
}

function aiEventsPanel(item) {
  const events = ((window.MATERIAL_EVENTS || {}).events || []).filter((event) => String(event.ticker || "").toUpperCase() === item.ticker);
  const rows = events.slice(0, 8).map((event) => {
    const labels = (event.items || []).map((entry) => entry.label).filter(Boolean).slice(0, 3).join(", ") || event.type || "-";
    return [
      escapeHtml(event.fileDate || event.date || "-"),
      escapeHtml(labels),
      `<span class="${event.hot ? "warn" : "muted"}">${event.hot ? "주요" : "일반"}</span>`,
    ];
  });
  return aiModePanel("공시·이벤트", "8-K·실적", aiMiniTable(["일자", "내용", "구분"], rows, "수집된 주요 공시·이벤트가 없습니다."));
}

function aiSectorPanel(item) {
  const peers = (data.stocks || [])
    .filter((row) => row.sector === item.sector)
    .sort((a, b) => Number(b.rsScore || 0) - Number(a.rsScore || 0));
  const rows = peers.slice(0, 8).map((row, index) => [
    `${index + 1}`,
    `<strong>${escapeHtml(row.ticker)}</strong>`,
    escapeHtml(row.company || ""),
    `<span class="${cls(row.changePct)}">${fmtDailyPct(row.changePct)}</span>`,
    `${Math.round(Number(row.rsScore || 0))}`,
  ]);
  return aiModePanel("섹터 흐름", `${item.sector || "-"} 상대강도`, aiMiniTable(["#", "티커", "회사", "당일", "RS"], rows, "동일 섹터 비교 데이터가 없습니다."));
}

function aiInsiderPanel(item) {
  const rowsRaw = ((window.INSIDER_TRADES || {}).trades || []).filter((row) => row.ticker === item.ticker);
  const rows = rowsRaw.slice(0, 8).map((row) => [
    escapeHtml(row.date || row.filingDate || "-"),
    escapeHtml(row.owner || row.name || row.insider || "-"),
    `<span class="${row.kind === "buy" ? "pos" : row.kind === "sell" ? "neg" : "muted"}">${escapeHtml(row.kind || row.transaction || "-")}</span>`,
    escapeHtml(row.valueText || row.valueM ? `$${Number(row.valueM || 0).toFixed(1)}M` : row.shares ? `${row.shares}주` : "-"),
  ]);
  return aiModePanel("내부자 거래", "Form 4", aiMiniTable(["일자", "내부자", "구분", "규모"], rows, "최근 내부자 거래 데이터가 없습니다."));
}

function aiCongressPanel(item) {
  const meta = ((window.CONGRESS_TRADES || {}).byTicker || {})[item.ticker];
  const recent = ((window.CONGRESS_TRADES || {}).trades || []).filter((row) => row.ticker === item.ticker);
  const summary = meta ? aiMetricGrid([
    { label: "순매수", value: meta.netBuys ?? "-" },
    { label: "순매도", value: meta.netSells ?? "-" },
    { label: "정치인 수", value: meta.politicianCount ?? "-" },
  ]) : "";
  const rows = recent.slice(0, 6).map((row) => [
    escapeHtml(row.transactionDate || row.date || "-"),
    escapeHtml(row.representative || row.politician || "-"),
    `<span class="${String(row.side || "").toLowerCase().includes("buy") ? "pos" : String(row.side || "").toLowerCase().includes("sell") ? "neg" : "muted"}">${escapeHtml(row.side || row.type || "-")}</span>`,
    escapeHtml(row.amount || row.amountText || "-"),
  ]);
  return aiModePanel("의회 매매", "PTR", summary + aiMiniTable(["일자", "인물", "구분", "규모"], rows, meta ? "상세 거래 목록이 없습니다." : "의회 매매 데이터가 없습니다."));
}

function aiInstitutionalPanel(item) {
  const f13 = (typeof inst13fIndex === "function" ? inst13fIndex() : {})[item.ticker];
  const act = ((window.ACTIVIST_STAKES || {}).filings || []).filter((row) => row.ticker === item.ticker);
  const body = aiMetricGrid([
    { label: "13F 보유기관", value: f13 ? `${f13.holders}곳` : "-" },
    { label: "13F 평가액", value: f13 ? `$${(Number(f13.valueM || 0) / 1000).toFixed(1)}B` : "-" },
    { label: "13D/G", value: act.length ? `${act.length}건` : "-" },
    { label: "액티비스트", value: act.filter((row) => row.kind === "activist").length || "-" },
  ]);
  return aiModePanel("기관·대량보유", "13F·13D/G", body);
}

function aiShortInterestPanel(item) {
  const shortRow = ((window.SHORT_INTEREST || {}).rows || []).find((row) => row.ticker === item.ticker);
  if (!shortRow) return aiModePanel("공매도", "숏 인터레스트", `<p class="muted ai-mode-empty">공매도 데이터가 없습니다.</p>`);
  const isBal = shortIsBalance();
  const shares = isBal ? shortRow.shortShares : shortRow.shortInterest;
  return aiModePanel("공매도", "숏 인터레스트", aiMetricGrid([
    isBal
      ? { label: "잔고비중", value: `${Number(shortRow.balanceRatio || 0).toFixed(2)}%` }
      : { label: "Days To Cover", value: Number(shortRow.daysToCover || 0).toFixed(1) },
    { label: "변화율", value: Number.isFinite(Number(shortRow.changePct)) ? fmtPct(shortRow.changePct) : "-", tone: cls(shortRow.changePct) },
    { label: isBal ? "공매도 잔고" : "공매도 수량", value: shares ? Number(shares).toLocaleString() : "-" },
    { label: "기준일", value: shortRow.settlementDate || shortRow.date || "-" },
  ]));
}

function aiEarningsPanel(item) {
  const earnings = item.liveEarnings || {};
  const reactions = earningsReactionRows(item).slice(0, 4).map((row) => [
    escapeHtml(row.date || "-"),
    row.surprise == null ? "-" : `<span class="${cls(row.surprise)}">${fmtPct(row.surprise)}</span>`,
    row.post5 == null ? "-" : `<span class="${cls(row.post5)}">${fmtPct(row.post5)}</span>`,
  ]);
  const next = aiMetricGrid([
    { label: "다음 실적", value: earnings.nextDate || "-" },
    { label: "EPS 예상", value: earnings.epsEstimate ?? "-" },
    { label: "EPS 점수", value: item.epsRevScore ?? "-" },
  ]);
  return aiModePanel("실적", "캘린더·반응", next + aiMiniTable(["발표일", "EPS 서프라이즈", "발표 후 5D"], reactions, "실적 발표 반응 데이터가 부족합니다."));
}

function aiDataQualityPanel(item) {
  const f = normalizedFundamentalsForItem(item);
  const chartRows = getChartRows(item);
  const missing = missingFundamentalFields(f);
  return aiModePanel("데이터 품질", "출처", aiMetricGrid([
    { label: "스냅샷", value: data.updatedAtKst || data.updated_at_kst || "-" },
    { label: "가격 이력", value: `${chartRows.length} bars`, detail: sourceLabel(item.historySource) },
    { label: "재무 출처", value: sourceLabel(f.source) },
    { label: "누락 지표", value: missing.length ? `${missing.length}개` : "없음", tone: missing.length > 5 ? "warn" : "" },
  ]));
}

// KR 전용 — 흩어진 공시·수급 신호를 종목 하나로 모은다(공매도추세·자사주·증자·배당·
// 외국인·실적반응·수주). 전부 이미 로드된 전역에서 조합, 없으면 그 줄만 뺀다.
// 중대 리스크 공시만 골라낸다(DART 공시). 거래정지는 병합·스팩 등 루틴이 많아 사유가
// 중대할 때만(상장폐지·불성실·감사의견·횡령) 잡는다 — 루틴을 리스크로 오탐하지 않는다.
function krRiskFlags(ticker) {
  const flags = [];
  for (const d of ((window.KR_DISCLOSURES || {}).disclosures || [])) {
    if (d.ticker !== ticker) continue;
    const t = d.title || "";
    if (t.includes("상장폐지")) flags.push("상장폐지 사유");
    else if (t.includes("불성실공시")) flags.push("불성실공시 지정");
    else if (t.includes("관리종목")) flags.push("관리종목(우려)");
    else if (t.includes("횡령") || t.includes("배임")) flags.push("횡령·배임");
    else if (t.includes("자본잠식")) flags.push("자본잠식");
    else if (t.includes("거래정지") && /상장폐지|불성실|감사의견|횡령|배임/.test(t)) flags.push("거래정지(중대)");
  }
  return [...new Set(flags)];
}

function aiKrEventsPanel(item) {
  if (typeof isKrMarket === "function" ? !isKrMarket() : (marketCfg().id !== "kr")) return "";
  const t = item.ticker;
  const bits = [];
  const risks = krRiskFlags(t);
  if (risks.length) bits.push({ label: "리스크 공시", value: risks.join(" · "), tone: "warn" });
  const si = ((window.SHORT_INTEREST || {}).rows || []).find((r) => r.ticker === t);
  if (si && Number.isFinite(si.balanceRatio)) {
    let trend = "";
    if (Array.isArray(si.history) && si.history.length >= 2) {
      const dlt = si.history[si.history.length - 1].r - si.history[0].r;
      trend = ` ${dlt > 0 ? "▲" : "▼"}${Math.abs(dlt).toFixed(1)}p`;
    }
    bits.push({ label: "공매도 잔고비중", value: `${si.balanceRatio.toFixed(2)}%${trend}`, tone: si.balanceRatio > 5 ? "warn" : "" });
  }
  const mf = (window.MAP_FUNDAMENTALS || {})[String(t).padStart(6, "0")] || (window.MAP_FUNDAMENTALS || {})[t];
  if (mf && Number.isFinite(mf.foreignPct)) bits.push({ label: "외국인 지분율", value: `${mf.foreignPct.toFixed(1)}%` });
  const disc = ((window.KR_DISCLOSURES || {}).disclosures || []).filter((d) => d.ticker === t);
  const details = (window.KR_EVENT_DETAILS || {}).details || {};
  const rcpt = (l) => { const m = /rcpNo=(\d+)/.exec(l || ""); return m ? m[1] : ""; };
  const buy = disc.find((d) => (d.title || "").includes("자기주식취득"));
  if (buy) { const dt = details[rcpt(buy.link)] || {}; bits.push({ label: "자사주 취득", value: dt.amount ? `${Math.round(dt.amount / 1e8).toLocaleString()}억` : "공시" }); }
  const dil = disc.find((d) => dilutionCategory(d.title));
  if (dil) { const dt = details[rcpt(dil.link)] || {}; const cat = dilutionCategory(dil.title); bits.push({ label: `${cat.label}(희석)`, value: dt.dilutionPct != null ? `희석 ${dt.dilutionPct.toFixed(1)}%` : "공시", tone: "warn" }); }
  const dv = ((window.KR_DIVIDENDS || {}).rows || []).find((r) => r.ticker === t);
  if (dv) bits.push({ label: "배당", value: Number.isFinite(dv.yieldPct) ? `${dv.yieldPct.toFixed(2)}% · 기준일 ${dv.recordDate || "-"}` : `기준일 ${dv.recordDate || "-"}` });
  const ct = ((window.KR_CONTRACTS || {}).rows || []).find((r) => r.ticker === t);
  if (ct && Number.isFinite(ct.salesRatio)) bits.push({ label: "수주", value: `매출대비 ${ct.salesRatio.toFixed(1)}%` });
  const er = ((window.KR_EARNINGS_REACTIONS || {}).rows || []).find((r) => r.ticker === t);
  if (er) bits.push({ label: "실적발표", value: `${er.date} · 공시일 ${fmtPct(er.dayPct)} · 익일 ${fmtPct(er.nextPct)}`, tone: cls(er.dayPct) });
  if (!bits.length) return aiModePanel("KR 이벤트·수급", "공시 종합", `<p class="muted ai-mode-empty">최근 공시·수급 이벤트가 없습니다.</p>`);
  return aiModePanel("KR 이벤트·수급", "공시 종합", aiMetricGrid(bits));
}

// 종목 체력 스노우플레이크(Simply Wall St 벤치마크). 5축(밸류·성장·건전성·과거성과·배당)
// 각각을 6개 재무 체크 통과 개수(0~6)로 채운다. 블랙박스 점수가 아니라 '통과한 체크'를
// 그대로 보여주는 게 핵심 — Mir 정직성 원칙과 맞다. 예측 신호가 아니라 재무 체크 요약.
function computeSnowflake(f) {
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
  const asRatio = (v) => (v == null ? null : (v > 10 ? v / 100 : v)); // %로 오면 배수로
  const pe = n(f.pe), fpe = n(f.forwardPE), pb = n(f.pb ?? f.pbr), ps = n(f.ps), peg = n(f.peg);
  const dy = n(f.divYield), payout = n(f.payoutRatio);
  const roe = n(f.roe), roa = n(f.roa), nm = n(f.netMargin ?? f.profitMargin);
  const debt = asRatio(n(f.debtEq)) ?? (n(f.debtRatio) != null ? n(f.debtRatio) / 100 : null);
  const cur = asRatio(n(f.currentRatio)) ?? asRatio(n(f.quickRatio));
  const rg = n(f.revenueGrowth), og = n(f.operatingGrowth), ng = n(f.netGrowth);
  const eps = n(f.epsTtm ?? f.eps), epsN = n(f.epsNextY);
  const axis = (checks) => {
    let pass = 0, ev = 0;
    for (const [has, ok] of checks) { if (has) { ev++; if (ok) pass++; } }
    return { pass, ev, score: ev > 0 ? pass : null };
  };
  return {
    value: axis([[pe > 0, pe < 15], [pe > 0, pe < 25], [pb > 0, pb < 1.5], [pb > 0, pb < 3], [ps > 0, ps < 2], [peg > 0, peg > 0 && peg < 1.5]]),
    growth: axis([[peg > 0, peg < 1], [peg > 0, peg < 1.5], [pe > 0 && fpe > 0, fpe < pe], [rg != null, rg > 10], [rg != null, rg > 0], [og != null || ng != null, (og != null ? og > 0 : ng > 0)]]),
    health: axis([[debt != null, debt < 0.5], [debt != null, debt < 1], [cur != null, cur > 1.5], [cur != null, cur > 1], [nm != null, nm > 5], [nm != null, nm > 0]]),
    past: axis([[roe != null, roe > 15], [roe != null, roe > 8], [roa != null, roa > 5], [nm != null, nm > 10], [nm != null, nm > 0], [eps != null, eps > 0]]),
    dividend: axis([[dy != null, dy > 0], [dy != null, dy > 2], [dy != null, dy > 3.5], [payout != null, payout > 0 && payout < 80], [payout != null, payout > 0 && payout < 60], [dy != null, dy > 0 && dy < 12]]),
  };
}

function snowflakeSvg(sf) {
  const axes = [["밸류", sf.value], ["성장", sf.growth], ["건전성", sf.health], ["과거성과", sf.past], ["배당", sf.dividend]];
  const cx = 96, cy = 100, R = 62, N = 5;
  const ang = (i) => (-Math.PI / 2) + i * (2 * Math.PI / N);
  const pt = (i, r) => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))];
  let grid = "";
  for (const g of [2, 4, 6]) grid += `<polygon points="${axes.map((_, i) => pt(i, g / 6 * R).map((v) => v.toFixed(1)).join(",")).join(" ")}" fill="none" stroke="var(--muted)" stroke-opacity="0.16" stroke-width="1"/>`;
  let spokes = "", labels = "";
  axes.forEach(([name], i) => {
    const [x, y] = pt(i, R);
    spokes += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--muted)" stroke-opacity="0.16"/>`;
    const [lx, ly] = pt(i, R + 14);
    const anchor = Math.abs(lx - cx) < 6 ? "middle" : (lx > cx ? "start" : "end");
    labels += `<text x="${lx.toFixed(1)}" y="${(ly + 3).toFixed(1)}" font-size="11" fill="var(--muted)" text-anchor="${anchor}">${name}</text>`;
  });
  const dp = axes.map(([_, a], i) => pt(i, (a.score ?? 0) / 6 * R).map((v) => v.toFixed(1)).join(",")).join(" ");
  const total = axes.reduce((s, [_, a]) => s + (a.score ?? 0), 0);
  const col = total >= 20 ? "#2fa25f" : total >= 12 ? "#5b8def" : "#d98a2b";
  const dots = axes.map(([_, a], i) => { const [x, y] = pt(i, (a.score ?? 0) / 6 * R); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.4" fill="${col}"/>`; }).join("");
  return `<svg viewBox="0 0 192 206" width="180" height="192" role="img" aria-label="종목 체력 레이더">${grid}${spokes}<polygon points="${dp}" fill="${col}" fill-opacity="0.22" stroke="${col}" stroke-width="1.6" stroke-linejoin="round"/>${dots}${labels}</svg>`;
}

function aiSnowflakePanel(item) {
  // 소스: 종목 상세 fundamentals + 지도 펀더멘털(MAP_FUNDAMENTALS)을 결측 보완으로 병합.
  // 홈의 light 종목은 fundamentals 가 비어 있어 map 이 주 소스가 된다.
  const mf = (typeof mapFundamentalsFor === "function" ? mapFundamentalsFor(item.ticker) : null) || {};
  const norm = normalizedFundamentalsForItem(item) || {};
  const f = { ...mf };
  for (const k in norm) if (norm[k] != null) f[k] = norm[k];
  const sf = computeSnowflake(f);
  const axes = [["밸류", sf.value], ["성장", sf.growth], ["건전성", sf.health], ["과거성과", sf.past], ["배당", sf.dividend]];
  if (axes.filter(([_, a]) => a.ev > 0).length < 2) return ""; // 데이터 부족하면 숨김
  const total = axes.reduce((s, [_, a]) => s + (a.score ?? 0), 0);
  const checks = axes.map(([name, a]) => `<div style="display:flex;justify-content:space-between;gap:8px"><span style="color:var(--muted)">${name}</span><b>${a.ev > 0 ? `${a.pass}/${a.ev}` : "—"}</b></div>`).join("");
  const body = `<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
    ${snowflakeSvg(sf)}
    <div style="flex:1;min-width:150px">
      <div style="font-size:13px;color:var(--muted);margin-bottom:8px">종합 <b style="color:var(--text)">${total}/30</b> · 통과한 재무 체크</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px 16px;font-size:12px">${checks}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:10px;line-height:1.5">각 축 = PER·PBR·성장·부채·ROE·배당 등 최대 6개 체크 중 통과 개수. 예측 점수가 아니라 재무 상태 요약입니다.</div>
    </div>
  </div>`;
  return aiModePanel("종목 체력", "스노우플레이크 · 재무 체크", body);
}

// DCF 적정주가(Simply Wall St 벤치마크). 2단계(10년 성장 + 영구성장) 현금흐름 할인.
// 가정(성장률·할인율·영구성장)에 매우 민감해 '정답'이 아니라 한 참고 앵커다 — 라벨로 명시.
function computeDcf(f, price) {
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
  const pfcf = n(f.pfcf), eps = n(f.epsTtm ?? f.eps), pe = n(f.pe), peg = n(f.peg);
  const rg = n(f.revenueGrowth), og = n(f.operatingGrowth);
  const fcfps = (pfcf > 0 && price > 0) ? price / pfcf : (eps > 0 ? eps : null); // FCF/주 우선, 없으면 EPS
  if (!(fcfps > 0) || !(price > 0)) return null;
  let g = rg != null ? rg : (og != null ? og : (peg > 0 && pe > 0 ? pe / peg : 6));
  g = Math.max(-2, Math.min(18, g)) / 100;          // 과도한 가정 방지(-2%~18%)
  const r = 0.09, tg = 0.025;                        // 할인율 9% · 영구성장 2.5%
  let pv = 0, ff = fcfps;
  for (let t = 1; t <= 10; t++) { ff *= (1 + g); pv += ff / Math.pow(1 + r, t); }
  pv += (ff * (1 + tg) / (r - tg)) / Math.pow(1 + r, 10);
  return { fair: pv, upside: pv / price - 1, growth: g * 100, basedOn: pfcf > 0 ? "FCF" : "EPS" };
}

function aiDcfPanel(item) {
  const mf = (typeof mapFundamentalsFor === "function" ? mapFundamentalsFor(item.ticker) : null) || {};
  const norm = normalizedFundamentalsForItem(item) || {};
  const f = { ...mf };
  for (const k in norm) if (norm[k] != null) f[k] = norm[k];
  const price = Number(item.price ?? f.price);
  const d = computeDcf(f, price);
  if (!d) return "";
  const cfg = marketCfg();
  const up = d.upside * 100;
  const tone = up > 15 ? "good" : up < -15 ? "warn" : "";
  const body = aiMetricGrid([
    { label: "적정주가", value: cfg.formatPrice(d.fair) },
    { label: "현재가", value: cfg.formatPrice(price) },
    { label: "상/하방", value: `${up > 0 ? "+" : ""}${up.toFixed(0)}%`, tone },
    { label: "가정 성장률", value: `${d.growth.toFixed(0)}%` },
  ]) + `<div style="font-size:11px;color:var(--muted);margin-top:10px;line-height:1.5">2단계 DCF · ${d.basedOn} 기준 · 할인율 9% · 영구성장 2.5%. <b>가정에 매우 민감</b>해 정답이 아니라 참고 앵커입니다.</div>`;
  return aiModePanel("적정주가 DCF", "현금흐름 할인 · 참고용", body);
}

// 다년 재무 추이(stockanalysis.com 벤치마크). build_kr_financials_history.py 가 DART 연간
// 주요계정을 모아 종목 detail 의 financialsHistory 로 붙인다(현재 KR 만). 연도별 매출·
// 영업이익·순이익·영업이익률 테이블.
function finMoney(v) {
  // KR 재무는 원(→조/억), US 재무는 달러(→$B/$M). 통화별로 포맷.
  if (!Number.isFinite(Number(v))) return "—";
  if (isKrMarket()) return krMoneyEok(v);
  const n = Number(v), a = Math.abs(n);
  if (a >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}
function aiFinancialsPanel(item) {
  const rows = item && item.financialsHistory;
  if (!Array.isArray(rows) || rows.length < 2) return "";
  const sorted = rows.slice().sort((a, b) => b.y - a.y).slice(0, 10);
  const body = sorted.map((r) => {
    const margin = (r.op != null && r.rev > 0) ? (r.op / r.rev * 100) : null;
    return `<tr>
      <td class="ins-date">${r.y}</td>
      <td class="ins-num">${finMoney(r.rev)}</td>
      <td class="ins-num ${r.op < 0 ? "ins-sell" : ""}">${finMoney(r.op)}</td>
      <td class="ins-num ${r.net < 0 ? "ins-sell" : ""}">${finMoney(r.net)}</td>
      <td class="ins-num">${margin != null ? `${margin.toFixed(1)}%` : "—"}</td>
    </tr>`;
  }).join("");
  const table = `<table class="insider-table" style="table-layout:fixed;width:100%;min-width:0">
    <colgroup><col style="width:14%"><col style="width:24%"><col style="width:22%"><col style="width:22%"><col style="width:18%"></colgroup>
    <thead><tr><th>연도</th><th class="ins-num">매출</th><th class="ins-num">영업이익</th><th class="ins-num">순이익</th><th class="ins-num">이익률</th></tr></thead><tbody>${body}</tbody></table>`;
  return aiModePanel("다년 재무", `연간 추이 · ${sorted[sorted.length - 1].y}~${sorted[0].y} (${isKrMarket() ? "DART" : "SEC"})`, `<div class="insider-table-wrap">${table}</div>`);
}

// 위험 프로파일 — 가격 이력(getChartRows)으로 연율변동성·최대낙폭·1년수익률 + 월별
// 시즈널리티. 예측이 아니라 과거 위험/계절 패턴 요약.
function seasonalitySvg(monthly) {
  const W = 250, H = 54, n = 12, bw = W / n;
  const vals = monthly.map((v) => (Number.isFinite(v) ? v : 0));
  const mx = Math.max(1, ...vals.map(Math.abs));
  const mid = H / 2;
  let bars = "", labels = "";
  const M = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
  for (let i = 0; i < n; i++) {
    const v = vals[i]; const h = Math.abs(v) / mx * (H / 2 - 3);
    const y = v >= 0 ? mid - h : mid; const col = v >= 0 ? "#30a46c" : "#e5484d";
    bars += `<rect x="${(i * bw + 3).toFixed(1)}" y="${y.toFixed(1)}" width="${(bw - 6).toFixed(1)}" height="${Math.max(1, h).toFixed(1)}" fill="${col}" rx="1.5"/>`;
    labels += `<text x="${(i * bw + bw / 2).toFixed(1)}" y="${H + 9}" font-size="8" fill="var(--muted)" text-anchor="middle">${M[i]}</text>`;
  }
  return `<svg viewBox="0 0 ${W} ${H + 12}" width="100%" height="${H + 12}"><line x1="0" y1="${mid}" x2="${W}" y2="${mid}" stroke="var(--muted)" stroke-opacity="0.2"/>${bars}${labels}</svg>`;
}
function aiRiskPanel(item) {
  const rows = getChartRows(item);
  if (!Array.isArray(rows) || rows.length < 60) return "";
  const closes = rows.map((r) => Number(r.c)).filter((c) => c > 0);
  if (closes.length < 60) return "";
  const rets = [];
  for (let i = 1; i < closes.length; i++) rets.push(closes[i] / closes[i - 1] - 1);
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const varc = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
  const vol = Math.sqrt(varc) * Math.sqrt(252) * 100;
  let peak = closes[0], mdd = 0;
  for (const c of closes) { if (c > peak) peak = c; const dd = c / peak - 1; if (dd < mdd) mdd = dd; }
  const oneY = closes.length > 252 ? (closes[closes.length - 1] / closes[closes.length - 252] - 1) * 100 : null;
  const byMonth = Array.from({ length: 12 }, () => []);
  for (let i = 1; i < rows.length && i < closes.length; i++) {
    const d = rows[i] && rows[i].d; if (!d) continue;
    const m = Number(String(d).slice(5, 7)) - 1;
    if (m >= 0 && m < 12 && closes[i] && closes[i - 1]) byMonth[m].push(closes[i] / closes[i - 1] - 1);
  }
  const seasonal = byMonth.map((a) => a.length ? (a.reduce((x, y) => x + y, 0) / a.length) * 21 * 100 : null);
  const grid = aiMetricGrid([
    { label: "연율 변동성", value: Number.isFinite(vol) ? `${vol.toFixed(0)}%` : "—", tone: vol > 45 ? "warn" : "" },
    { label: "최대 낙폭", value: Number.isFinite(mdd) ? `${(mdd * 100).toFixed(0)}%` : "—", tone: "warn" },
    { label: "1년 수익률", value: oneY != null ? `${oneY > 0 ? "+" : ""}${oneY.toFixed(0)}%` : "—", tone: cls(oneY) },
    { label: "표본", value: `${closes.length}일` },
  ]);
  const body = grid + `<div style="font-size:12px;color:var(--muted);margin:12px 0 4px">월별 시즈널리티 (평균 수익률)</div>${seasonalitySvg(seasonal)}`;
  return aiModePanel("위험 · 시즈널리티", "가격 이력 기반 · 참고용", body);
}

// 팩터 스코어 — 시장 내 백분위(밸류·모멘텀·퀄리티·성장·규모). 스노우플레이크의 정량
// 상대평가 버전. 예측이 아니라 '동종 대비 위치'.
function factorPercentiles(item) {
  const stocks = (typeof data !== "undefined" && data && Array.isArray(data.stocks)) ? data.stocks : [];
  if (stocks.length < 30) return null;
  const mfFor = (t) => ((typeof mapFundamentalsFor === "function" ? mapFundamentalsFor(t) : null) || {});
  const cols = { value: [], momentum: [], quality: [], growth: [], size: [] };
  const push = (arr, t, v) => { if (Number.isFinite(v)) arr.push([t, v]); };
  for (const s of stocks) {
    const mf = mfFor(s.ticker);
    const val = Number.isFinite(mf.valueScore) ? mf.valueScore
      : (mf.pe > 0 && mf.pb > 0 ? -(mf.pe + mf.pb * 8) : NaN); // 높을수록 저평가
    push(cols.value, s.ticker, val);
    push(cols.momentum, s.ticker, Number(s.threeMonthChangePct));
    const roe = Number(mf.roe), nm = Number(mf.netMargin), dr = Number(mf.debtRatio);
    if (Number.isFinite(roe) || Number.isFinite(nm)) push(cols.quality, s.ticker, (roe || 0) + (nm || 0) - (Number.isFinite(dr) ? dr / 5 : 0));
    push(cols.growth, s.ticker, Number.isFinite(mf.revenueGrowth) ? mf.revenueGrowth : Number(s.rsScore));
    push(cols.size, s.ticker, Number(s.marketCapB));
  }
  const pct = (arr) => {
    if (arr.length < 20) return null;
    const sorted = arr.slice().sort((a, b) => a[1] - b[1]);
    const idx = sorted.findIndex((x) => x[0] === item.ticker);
    return idx < 0 ? null : Math.round(idx / (sorted.length - 1) * 100);
  };
  return { value: pct(cols.value), momentum: pct(cols.momentum), quality: pct(cols.quality), growth: pct(cols.growth), size: pct(cols.size) };
}
function aiFactorPanel(item) {
  const f = factorPercentiles(item);
  if (!f) return "";
  const axes = [["밸류", f.value], ["모멘텀", f.momentum], ["퀄리티", f.quality], ["성장", f.growth], ["규모", f.size]];
  if (axes.filter(([_, v]) => v != null).length < 3) return "";
  const bar = (name, v) => {
    const col = v == null ? "var(--muted)" : v >= 70 ? "#30a46c" : v >= 40 ? "#5b8def" : "#d98a2b";
    const w = v == null ? 0 : v;
    return `<div style="display:flex;align-items:center;gap:8px;margin:5px 0">
      <span style="width:44px;font-size:12px;color:var(--muted)">${name}</span>
      <div style="flex:1;height:7px;border-radius:4px;background:var(--panel-soft);overflow:hidden"><div style="width:${w}%;height:100%;background:${col}"></div></div>
      <span style="width:34px;text-align:right;font-size:12px;font-weight:600">${v == null ? "—" : v}</span>
    </div>`;
  };
  const body = axes.map(([n, v]) => bar(n, v)).join("")
    + `<div style="font-size:11px;color:var(--muted);margin-top:8px;line-height:1.5">시장 내 백분위(0~100). 밸류=저평가·모멘텀=3개월 상대강세·퀄리티=ROE·마진·저부채·성장=매출성장/RS·규모=시총. 예측이 아니라 동종 대비 위치입니다.</div>`;
  return aiModePanel("팩터 스코어", "시장 내 백분위", body);
}

// 유사종목 비교 — 같은 산업군(폴백 섹터) 시총 상위 피어 표. stockanalysis·Simply Wall St
// 공통 기능. 예측이 아니라 동종 기업과의 밸류·수익성·모멘텀 나란히 보기.
function aiPeerPanel(item) {
  const stocks = (typeof data !== "undefined" && data && Array.isArray(data.stocks)) ? data.stocks : [];
  if (stocks.length < 10 || !item || !item.ticker) return "";
  const sameInd = stocks.filter((s) => s.ticker !== item.ticker && item.industry && s.industry === item.industry);
  const pool = sameInd.length >= 3 ? sameInd
    : stocks.filter((s) => s.ticker !== item.ticker && item.sector && s.sector === item.sector);
  if (!pool.length) return "";
  const basis = sameInd.length >= 3 ? "같은 산업군" : "같은 섹터";
  const peers = pool.slice().sort((a, b) => (Number(b.marketCapB) || 0) - (Number(a.marketCapB) || 0)).slice(0, 6);
  const list = [item, ...peers];
  const mf = (t) => (typeof mapFundamentalsFor === "function" ? mapFundamentalsFor(t) : null) || {};
  const num = (v, d = 1) => Number.isFinite(Number(v)) ? Number(v).toFixed(d) : "—";
  const rows = list.map((s) => {
    const f = mf(s.ticker);
    const self = s.ticker === item.ticker;
    const tkCell = self
      ? `<strong>${escapeHtml(s.ticker)}</strong>`
      : `<strong class="ticker-link" onclick="selectTicker('${s.ticker}');document.querySelector('[data-tab=search]').click()">${escapeHtml(s.ticker)}</strong>`;
    const chg = Number(s.threeMonthChangePct);
    const rt = "text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap";
    return `<tr style="${self ? "background:var(--panel-soft)" : ""}">
      <td style="overflow:hidden">${tkCell}<div style="font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(s.company || "")}</div></td>
      <td style="${rt}">${fmtBillions(s.marketCapB)}</td>
      <td style="${rt}">${num(f.pe)}</td>
      <td style="${rt}">${num(f.pb)}</td>
      <td style="${rt}" class="${Number.isFinite(chg) ? cls(chg) : ""}">${Number.isFinite(chg) ? fmtPct(chg) : "—"}</td>
    </tr>`;
  }).join("");
  const body = `<div class="ai-mode-table-wrap"><table class="ai-mode-table" style="table-layout:fixed;width:100%;min-width:0">
    <colgroup><col style="width:34%"><col style="width:18%"><col style="width:13%"><col style="width:13%"><col style="width:22%"></colgroup>
    <thead><tr><th>종목</th><th style="text-align:right">시총</th><th style="text-align:right">PER</th><th style="text-align:right">PBR</th><th style="text-align:right">3개월</th></tr></thead>
    <tbody>${rows}</tbody></table></div>
    <div style="font-size:11px;color:var(--muted);margin-top:8px">${basis} 시총 상위 비교(강조행이 현재 종목). 종목명을 누르면 해당 분석으로 이동합니다.</div>`;
  return aiModePanel("유사종목 비교", basis + " · 시총순", body);
}

// 일일 공매도 거래량(FINRA) — 격주 공매도잔고를 보완하는 매일 지표. 공매도량/총거래량
// 비율 + 10일 추이. MM 헤지·데이트레이딩도 포함되니 '포지션'이 아니라 '참여도'다(참고용).
function aiShortVolumePanel(item) {
  const fs = window.FINRA_SHORT_VOLUME;
  if (!fs || !fs.stocks || !item || !item.ticker) return "";
  const s = fs.stocks[String(item.ticker).toUpperCase()];
  if (!s || !Number.isFinite(Number(s.ratio))) return "";
  const ratio = Number(s.ratio);
  const mkt = Number(fs.market && fs.market.avgShortRatio);
  const hist = Array.isArray(s.hist) ? s.hist.map(Number).filter(Number.isFinite) : [];
  const vsMkt = Number.isFinite(mkt) ? ratio - mkt : null;
  const spark = hist.length > 3 ? sparklineSvg(hist, { width: 240, height: 44, color: ratio >= (mkt || 50) ? "#e5484d" : "#5b8def" }) : "";
  const grid = aiMetricGrid([
    { label: "공매도 거래량 비율", value: `${ratio.toFixed(1)}%`, tone: Number.isFinite(vsMkt) && vsMkt > 8 ? "warn" : "",
      detail: fs.asOf ? String(fs.asOf) : "" },
    { label: "시장 평균 대비", value: vsMkt != null ? `${vsMkt > 0 ? "+" : ""}${vsMkt.toFixed(1)}%p` : "—",
      detail: Number.isFinite(mkt) ? `평균 ${mkt.toFixed(1)}%` : "" },
    { label: `${hist.length}일 범위`, value: hist.length ? `${Math.min(...hist).toFixed(0)}~${Math.max(...hist).toFixed(0)}%` : "—" },
  ]);
  const body = grid + (spark ? `<div style="font-size:12px;color:var(--muted);margin:12px 0 4px">최근 ${hist.length}일 추이</div>${spark}` : "")
    + `<p style="font-size:11px;color:var(--muted);margin:10px 0 0;line-height:1.5">FINRA 규정 SHO 통합 공매도 거래량 ÷ 총거래량. 마켓메이커 헤지·데이트레이딩도 포함되어 시장 평균이 ~50% 안팎으로 높습니다. 공매도 '잔고(포지션)'가 아니라 그날 매도 흐름의 '참여도'이며, 예측·매매 신호가 아닙니다.</p>`;
  return aiModePanel("일일 공매도량", `FINRA · ${fs.asOf || ""}`, body);
}

// US 배당 — 배당수익률·주당배당·배당성향·배당락일·5년평균(Yahoo). 배당주만.
function aiDividendPanel(item) {
  const cal = window.US_STOCK_CALENDAR;
  if (!cal || !cal.stocks || !item || !item.ticker) return "";
  const s = cal.stocks[String(item.ticker).toUpperCase()];
  if (!s || !Number.isFinite(Number(s.divYield)) || Number(s.divYield) <= 0) return "";
  const y = Number(s.divYield);
  const avg = Number(s.avg5yYield);
  const vsAvg = Number.isFinite(avg) && avg > 0 ? y - avg : null;
  const grid = aiMetricGrid([
    { label: "배당수익률", value: `${y.toFixed(2)}%`, detail: Number.isFinite(avg) ? `5년평균 ${avg.toFixed(2)}%` : "" },
    { label: "주당 배당", value: Number.isFinite(Number(s.divRate)) ? `$${Number(s.divRate).toFixed(2)}` : "—" },
    { label: "배당성향", value: Number.isFinite(Number(s.payout)) ? `${Number(s.payout).toFixed(0)}%` : "—",
      tone: Number(s.payout) > 80 ? "warn" : "" },
    { label: "배당락일", value: s.exDate ? escapeHtml(s.exDate) : "—" },
  ]);
  const cmp = vsAvg != null ? `<p style="font-size:11px;color:var(--muted);margin:10px 0 0;line-height:1.5">현재 수익률이 5년 평균보다 ${vsAvg > 0 ? `<b style="color:var(--green)">${vsAvg.toFixed(2)}%p 높습니다</b>(가격 하락 또는 배당 증가)` : `<b>${Math.abs(vsAvg).toFixed(2)}%p 낮습니다</b>`}. 배당성향이 높을수록 이익 대비 배당 부담이 큽니다. 참고용입니다.</p>` : "";
  return aiModePanel("배당", "Yahoo · 연간 기준", grid + cmp);
}

// 애널리스트 컨센서스 — 추천 분포(강력매수~강력매도) + 분기 EPS 서프라이즈(Finnhub).
// 목표주가는 무료 티어 제외. 참고용이며 예측·매매 신호가 아니다.
function aiAnalystPanel(item) {
  const ac = window.ANALYST_CONSENSUS;
  if (!ac || !ac.stocks || !item || !item.ticker) return "";
  const s = ac.stocks[String(item.ticker).toUpperCase()];
  if (!s) return "";
  const rec = s.rec;
  let recHtml = "";
  if (rec && rec.total > 0) {
    const segs = [
      ["강력매수", rec.strongBuy, "#1a7f4b"], ["매수", rec.buy, "#30a46c"],
      ["보유", rec.hold, "#8a8f98"], ["매도", rec.sell, "#d98a2b"], ["강력매도", rec.strongSell, "#e5484d"],
    ];
    const bar = segs.map(([, n, c]) => n > 0 ? `<div style="width:${(n / rec.total * 100).toFixed(1)}%;background:${c}" title="${n}"></div>` : "").join("");
    // 가중 컨센서스: 강매+2 매수+1 보유0 매도-1 강매도-2
    const score = (rec.strongBuy * 2 + rec.buy - rec.sell - rec.strongSell * 2) / rec.total;
    const label = score >= 1 ? "강력 매수" : score >= 0.4 ? "매수 우위" : score > -0.4 ? "중립" : score > -1 ? "매도 우위" : "매도";
    const lcol = score >= 0.4 ? "var(--green)" : score <= -0.4 ? "var(--red)" : "var(--muted)";
    const legend = segs.filter(([, n]) => n > 0).map(([lbl, n, c]) =>
      `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--muted);margin-right:10px"><i style="width:8px;height:8px;border-radius:2px;background:${c};display:inline-block"></i>${lbl} ${n}</span>`).join("");
    recHtml = `<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
        <span style="font-size:12px;color:var(--muted)">애널리스트 ${rec.total}명${rec.period ? ` · ${escapeHtml(String(rec.period).slice(0, 7))}` : ""}</span>
        <strong style="color:${lcol}">${label}</strong></div>
      <div style="display:flex;height:12px;border-radius:6px;overflow:hidden;background:var(--panel-soft)">${bar}</div>
      <div style="margin-top:8px">${legend}</div>`;
  }
  let earnHtml = "";
  const earn = Array.isArray(s.earnings) ? s.earnings.filter((e) => Number.isFinite(Number(e.surprisePercent))).slice(0, 4) : [];
  if (earn.length) {
    const pills = earn.map((e) => {
      const sp = Number(e.surprisePercent); const beat = sp >= 0;
      return `<span style="display:inline-block;font-size:11px;padding:3px 8px;border-radius:6px;margin:2px 4px 2px 0;background:var(--panel-soft);color:${beat ? "var(--green)" : "var(--red)"};font-variant-numeric:tabular-nums">${escapeHtml(String(e.period || "").slice(2, 7))} ${beat ? "+" : ""}${sp.toFixed(1)}%</span>`;
    }).join("");
    earnHtml = `<div style="font-size:12px;color:var(--muted);margin:12px 0 4px">최근 EPS 서프라이즈 (추정 대비)</div><div>${pills}</div>`;
  }
  // 다음 실적 예정일(US_STOCK_CALENDAR)
  const cal = window.US_STOCK_CALENDAR;
  const nextE = cal && cal.stocks && cal.stocks[String(item.ticker).toUpperCase()] && cal.stocks[String(item.ticker).toUpperCase()].nextEarnings;
  const nextHtml = nextE ? `<div style="background:var(--panel-soft);border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:12px"><span style="color:var(--muted)">다음 실적 발표 예정</span> <strong style="margin-left:6px">${escapeHtml(nextE)}</strong></div>` : "";
  if (!recHtml && !earnHtml && !nextHtml) return "";
  const note = `<p style="font-size:11px;color:var(--muted);margin:10px 0 0;line-height:1.5">Finnhub 애널리스트 추천 분포·분기 EPS 서프라이즈와 예정 실적일(Yahoo)입니다. 목표주가는 무료 데이터에 없어 제외했습니다. 참고용이며 예측·매매 신호가 아닙니다.</p>`;
  return aiModePanel("애널리스트 컨센서스", "추천 분포 · EPS 서프라이즈", nextHtml + recHtml + earnHtml + note);
}

// 옵션 심리 — 풋/콜 비율(미결제약정) + 맥스페인. 둘 다 참고용 심리·수급 지표이지 매매
// 신호가 아니다(맥스페인 '끌림'설은 논쟁적, 풋콜은 헤지·베팅이 섞여 해석이 갈린다).
function aiOptionsPanel(item) {
  const os = window.OPTIONS_STATS;
  if (!os || !os.stocks || !item || !item.ticker) return "";
  const s = os.stocks[normalizeTickerKey(item.ticker)] || os.stocks[String(item.ticker).toUpperCase()];
  if (!s) return "";
  const price = Number(item.price) || Number(s.price);
  const mp = Number(s.maxPain);
  const dist = (Number.isFinite(mp) && price > 0) ? (mp - price) / price * 100 : null;
  const pcOI = Number(s.putCallOI);
  const pcVol = Number(s.putCallVol);
  const pcTone = (v) => Number.isFinite(v) ? (v >= 1.2 ? "warn" : v <= 0.7 ? "up" : "") : "";
  const kfmt = (n) => { n = Number(n) || 0; return n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K` : `${n}`; };
  const em = Number(s.expectedMovePct);
  const grid = aiMetricGrid([
    { label: "예상 변동폭", value: Number.isFinite(em) ? `±${em.toFixed(1)}%` : "—",
      detail: s.expiry ? `만기 ${escapeHtml(String(s.expiry).slice(5))}까지` : "" },
    { label: "맥스페인", value: Number.isFinite(mp) ? `$${mp.toLocaleString(undefined, { maximumFractionDigits: 1 })}` : "—",
      detail: dist != null ? `현재가 대비 ${dist > 0 ? "+" : ""}${dist.toFixed(1)}%` : "" },
    { label: "풋/콜 (미결제)", value: Number.isFinite(pcOI) ? pcOI.toFixed(2) : "—", tone: pcTone(pcOI),
      detail: Number.isFinite(pcOI) ? (pcOI >= 1 ? "풋 우위" : "콜 우위") : "" },
    { label: "풋/콜 (거래량)", value: Number.isFinite(pcVol) ? pcVol.toFixed(2) : "—", tone: pcTone(pcVol) },
    { label: "미결제약정", value: `${kfmt(s.callOI)} C / ${kfmt(s.putOI)} P` },
  ]);
  const note = `<p style="font-size:11px;color:var(--muted);margin:10px 0 0;line-height:1.5">최근접 만기 ${escapeHtml(s.expiry || "")} 기준. 예상 변동폭=등가격 스트래들 프리미엄이 시사하는 만기까지의 ±변동 크기(만기가 가까우면 작습니다). 맥스페인=만기에 옵션 매수자 총손실이 최대가 되는 행사가(‘주가가 그쪽으로 끌린다’는 속설은 논쟁적). 풋/콜은 헤지·방향성 베팅이 섞인 심리 지표입니다. 예측·매매 신호가 아닙니다. 출처: Yahoo.</p>`;
  return aiModePanel("옵션 심리", `풋/콜 · 맥스페인 · 만기 ${escapeHtml(s.expiry || "")}`, grid + note);
}

// 연방 계약(USASpending) — 정부 매출이 큰 종목만. 최근 12개월 prime award 규모·건수.
// 계약 '사실'이지 예측·매매 신호가 아니다(참고용 alt-data).
function aiFederalContractsPanel(item) {
  const fc = window.FEDERAL_CONTRACTS;
  if (!fc || !fc.stocks || !item || !item.ticker) return "";
  const s = fc.stocks[String(item.ticker).toUpperCase()];
  if (!s || !(Number(s.total) > 0)) return "";
  const usd = (n) => { n = Number(n) || 0; return n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(0)}M` : `$${n.toLocaleString()}`; };
  const approx = !!s.approx;
  const grid = aiMetricGrid([
    { label: "연방 집행액", value: usd(s.total), detail: approx ? "최근 12개월 · 근사" : "최근 12개월" },
    { label: "최대 단일 집행", value: usd(s.top) },
    { label: "집행 건수", value: `${(Number(s.count) || 0).toLocaleString()}${approx ? "+" : ""}건` },
  ]);
  const note = `<p style="font-size:11px;color:var(--muted);margin:10px 0 0;line-height:1.5">USASpending.gov 계약(A/B/C/D) 트랜잭션의 <b>실제 집행액(obligation)</b> 합입니다. 다년 계약 상한이 아니라 그 기간에 집행된 금액이며, 금액 큰 순 상위만 합산해 총액은 근사치입니다. 정부라는 '고객'의 규모를 보여주는 참고용 대체 데이터로 예측·매매 신호가 아닙니다. 기간 ${escapeHtml(fc.windowStart || "")}~${escapeHtml(fc.windowEnd || "")}.</p>`;
  return aiModePanel("연방 계약", "USASpending · 최근 12개월 집행액", grid + note);
}

function renderAiModeDataBoard(item) {
  return `
    <div class="ai-mode-data-board">
      ${aiTechnicalPanel(item)}
      ${aiSnowflakePanel(item)}
      ${aiDcfPanel(item)}
      ${aiFactorPanel(item)}
      ${aiRiskPanel(item)}
      ${aiPeerPanel(item)}
      ${aiFundamentalPanel(item)}
      ${aiAnalystPanel(item)}
      ${aiDividendPanel(item)}
      ${aiFinancialsPanel(item)}
      ${aiNewsPanel(item)}
      ${aiEventsPanel(item)}
      ${aiKrEventsPanel(item)}
      ${aiSectorPanel(item)}
      ${aiInsiderPanel(item)}
      ${aiCongressPanel(item)}
      ${aiInstitutionalPanel(item)}
      ${aiShortInterestPanel(item)}
      ${aiShortVolumePanel(item)}
      ${aiOptionsPanel(item)}
      ${aiFederalContractsPanel(item)}
      ${aiEarningsPanel(item)}
      ${aiDataQualityPanel(item)}
    </div>
  `;
}

function aiChartRangeBarCount(total, state) {
  const dailyMap = { "1M": 22, "3M": 66, "6M": 132, "1Y": 252, "5Y": 1260 };
  const div = state.barTf === "W" ? 5 : (state.barTf === "M" ? 21 : 1);
  const want = Math.round((dailyMap[state.range] || total) / div);
  return Math.min(total, Math.max(10, want));
}

function aiChartWindowInfo(item, state) {
  const allRows = resampleBars(getChartRows(item), state.barTf);
  const rangeSize = aiChartRangeBarCount(allRows.length, state);
  const base = allRows.slice(-rangeSize);
  const windowSize = Math.max(12, Math.floor(base.length / state.zoom));
  const maxOffset = Math.max(0, base.length - windowSize);
  state.offset = Math.min(state.offset, maxOffset);
  return { total: base.length, windowSize, maxOffset };
}

function aiSetZoomAnchored(item, state, frac, requestedZoom) {
  const info = aiChartWindowInfo(item, state);
  const minWindow = Math.min(12, Math.max(1, info.total));
  const oldWindow = Math.max(minWindow, Math.floor(info.total / state.zoom));
  const oldStart = Math.max(0, info.total - state.offset - oldWindow);
  const anchor = oldStart + frac * (oldWindow - 1);
  const newZoom = Math.min(40, Math.max(1, requestedZoom));
  const newWindow = Math.max(minWindow, Math.floor(info.total / newZoom));
  let newStart = Math.round(anchor - frac * (newWindow - 1));
  newStart = Math.max(0, Math.min(Math.max(0, info.total - newWindow), newStart));
  state.zoom = newZoom;
  state.offset = Math.max(0, info.total - newWindow - newStart);
}

function drawAiWidgetChart(item, svg, state, metaEl) {
  if (!item || !svg || !state) return;
  const prevState = chartState;
  const prevCompare = compareTickers;
  const prevGeom = lastChartGeom;
  try {
    chartState = state;
    compareTickers = [];
    drawChart(item, { svgElement: svg });
  } finally {
    chartState = prevState;
    compareTickers = prevCompare;
    lastChartGeom = prevGeom;
  }
  const info = aiChartWindowInfo(item, state);
  if (metaEl) {
    metaEl.textContent = `${state.range} · ${info.windowSize}봉 표시 · 휠 확대/축소 · 드래그 이동`;
  }

  // 크로스헤어 트래커 바인딩
  if (svg.dataset.crosshairBound !== "true") {
    svg.dataset.crosshairBound = "true";
    let guideLine = null;
    let tooltip = null;

    const removeCrosshair = () => {
      if (guideLine) { guideLine.remove(); guideLine = null; }
      if (tooltip) { tooltip.remove(); tooltip = null; }
    };

    const updateCrosshair = (event) => {
      const rect = svg.getBoundingClientRect();
      const g = priceChartGeom();
      
      const vbAttr = svg.getAttribute("viewBox") || "0 0 860 520";
      const vbTokens = vbAttr.split(" ");
      const vbWidth = parseFloat(vbTokens[2]) || g.width;
      const vbHeight = parseFloat(vbTokens[3]) || 520;
      
      const clientX = event.touches ? event.touches[0].clientX : event.clientX;
      const clientY = event.touches ? event.touches[0].clientY : event.clientY;
      
      const vbX = ((clientX - rect.left) / Math.max(1, rect.width)) * vbWidth;
      const vbY = ((clientY - rect.top) / Math.max(1, rect.height)) * vbHeight;

      const padL = g.padL;
      const padR = g.padR;
      const plotW = vbWidth - padL - padR;

      if (vbX < padL || vbX > vbWidth - padR) {
        removeCrosshair();
        return;
      }

      // visibleBars 직접 역추출
      const allRows = resampleBars(getChartRows(item), state.barTf);
      const rangeSize = aiChartRangeBarCount(allRows.length, state);
      const base = allRows.slice(-rangeSize);
      const windowSize = Math.max(12, Math.floor(base.length / state.zoom));
      const offset = state.offset;
      const visibleBars = base.slice(base.length - offset - windowSize, base.length - offset);

      if (!visibleBars || visibleBars.length === 0) return;

      const frac = Math.max(0, Math.min(1, (vbX - padL) / plotW));
      const barIdx = Math.min(visibleBars.length - 1, Math.floor(frac * visibleBars.length));
      const targetBar = visibleBars[barIdx];
      if (!targetBar) return;

      const targetX = padL + (barIdx + 0.5) * (plotW / visibleBars.length);

      // 세로선 그리기
      if (!guideLine) {
        guideLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        guideLine.setAttribute("class", "chart-crosshair-line");
        guideLine.setAttribute("y1", "0");
        guideLine.setAttribute("y2", vbHeight.toString());
        svg.appendChild(guideLine);
      }
      guideLine.setAttribute("x1", targetX.toString());
      guideLine.setAttribute("x2", targetX.toString());

      // 툴팁 박스 그리기
      if (!tooltip) {
        tooltip = document.createElementNS("http://www.w3.org/2000/svg", "g");
        tooltip.setAttribute("class", "chart-tooltip-box");
        tooltip.innerHTML = `
          <rect width="135" height="58" rx="8" fill="rgba(15,23,42,0.9)" />
          <text x="10" y="18" fill="#fff" font-size="10.5" font-weight="600" class="tip-date"></text>
          <text x="10" y="34" fill="#10b981" font-size="11.5" font-weight="700" class="tip-price"></text>
          <text x="10" y="47" fill="#c084fc" font-size="9" class="tip-volume"></text>
        `;
        svg.appendChild(tooltip);
      }

      // 바는 {o,h,l,c,v,d} 구조다 — .close/.volume/.time 으로 읽으면 항상 0/빈값이 나온다.
      const priceVal = isKrMarket() ? `${parseFloat(targetBar.c || 0).toLocaleString()}원` : `$${parseFloat(targetBar.c || 0).toFixed(2)}`;
      const volVal = `거래량: ${parseFloat(targetBar.v || 0).toLocaleString()}`;

      tooltip.querySelector(".tip-date").textContent = targetBar.d || "";
      tooltip.querySelector(".tip-price").textContent = `종가: ${priceVal}`;
      tooltip.querySelector(".tip-volume").textContent = volVal;

      let tooltipX = targetX + 15;
      if (tooltipX + 135 > vbWidth) {
        tooltipX = targetX - 150;
      }
      let tooltipY = vbY - 26;
      if (tooltipY < 8) tooltipY = 8;
      if (tooltipY + 58 > vbHeight) tooltipY = vbHeight - 66;

      tooltip.setAttribute("transform", `translate(${tooltipX}, ${tooltipY})`);
    };

    svg.addEventListener("pointermove", updateCrosshair);
    svg.addEventListener("pointerleave", removeCrosshair);
    svg.addEventListener("pointerup", removeCrosshair);
  }
}

function toggleAiWidgetFullscreen(widget) {
  const isModal = widget.classList.contains("is-fullscreen-modal");
  
  if (isModal) {
    widget.classList.remove("is-fullscreen-modal");
    const overlay = document.querySelector(".ai-modal-overlay");
    if (overlay) overlay.remove();
  } else {
    const overlay = document.createElement("div");
    overlay.className = "ai-modal-overlay";
    document.body.appendChild(overlay);
    
    widget.classList.add("is-fullscreen-modal");
    
    // 오버레이 클릭 시 닫기
    overlay.addEventListener("click", () => {
      widget.classList.remove("is-fullscreen-modal");
      overlay.remove();
    });
  }
}

async function exportWidgetAsImage(widget, ticker) {
  const shareBtn = widget.querySelector(".widget-share-btn");
  const prevText = shareBtn ? shareBtn.textContent : "공유";
  
  if (shareBtn) {
    shareBtn.textContent = "캡처 중...";
    shareBtn.disabled = true;
  }
  
  try {
    // 1. html2canvas 동적 로딩
    if (!window.html2canvas) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        script.crossOrigin = "anonymous";
        script.onload = resolve;
        script.onerror = () => reject(new Error("캡처 라이브러리를 로드하지 못했습니다."));
        document.head.appendChild(script);
      });
    }
    
    // SVG 가이드라인 충돌 제거
    const crosshair = widget.querySelector(".chart-crosshair-line");
    const tooltip = widget.querySelector(".chart-tooltip-box");
    if (crosshair) crosshair.remove();
    if (tooltip) tooltip.remove();
    
    // 2. 캔버스 캡처 실행 (다크/라이트 모드 배경 보정)
    const isLight = document.body.getAttribute("data-theme") === "light";
    const bgColor = isLight ? "#ffffff" : "#0f172a";
    
    const canvas = await window.html2canvas(widget, {
      backgroundColor: bgColor,
      scale: 2, // 고해상도 2배 출력
      useCORS: true,
      logging: false,
      ignoreElements: (el) => {
        return el.classList.contains("ai-widget-chart-tools") || el.classList.contains("widget-assembly-overlay");
      }
    });
    
    // 3. 파일 다운로드 실행
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().substring(0, 10).replace(/-/g, "");
    link.download = `mir_ai_report_${ticker}_${dateStr}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
  } catch (err) {
    showAppToast("이미지 캡처 중 오류가 발생했습니다: " + err.message, 3200);
  } finally {
    if (shareBtn) {
      shareBtn.textContent = prevText;
      shareBtn.disabled = false;
    }
  }
}

function setupAiWidgetChartControls(widget, item, state) {
  const svg = widget.querySelector(".ai-widget-chart");
  const meta = widget.querySelector(".ai-widget-chart-meta");
  const render = () => drawAiWidgetChart(item, svg, state, meta);

  // 지표 설정 드롭다운 토글 및 외부 클릭 감지
  const dropdownTrigger = widget.querySelector(".ai-dropdown-trigger-btn");
  const dropdownMenu = widget.querySelector(".ai-indicators-dropdown");
  
  if (dropdownTrigger && dropdownMenu) {
    dropdownTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle("is-open");
    });

    // 외부 클릭 닫기는 위임 리스너 1개로 — 위젯이 만들어질 때마다 document 에
    // 리스너를 더하면 사라진 위젯의 메뉴 참조가 계속 쌓인다.
    if (!setupAiWidgetChartControls._outsideBound) {
      setupAiWidgetChartControls._outsideBound = true;
      document.addEventListener("click", (e) => {
        document.querySelectorAll(".ai-indicators-dropdown.is-open").forEach((menu) => {
          if (!menu.contains(e.target) && !e.target.closest(".ai-dropdown-trigger-btn")) {
            menu.classList.remove("is-open");
          }
        });
      });
    }
  }

  // 지표 체크박스 바인딩
  widget.querySelectorAll(".ai-indicators-dropdown input[type='checkbox']").forEach((cb) => {
    cb.addEventListener("change", () => {
      const type = cb.dataset.indicator;
      const active = cb.checked;
      
      if (type === "sma") {
        state.showSma20 = active;
        state.showSma60 = active;
      } else if (type === "volume") {
        state.showVolume = active;
      } else if (type === "rsi") {
        state.showRsi = active;
      } else if (type === "trendlines") {
        state.showTrendlines = active;
      } else if (type === "support") {
        state.showSupportResistance = active;
      } else if (type === "patterns") {
        state.showPatterns = active;
      } else if (type === "levels") {
        state.showTechLevels = active;
      }
      render();
    });
  });

  widget.querySelectorAll("[data-ai-chart-range]").forEach((button) => {
    button.addEventListener("click", () => {
      state.range = button.dataset.aiChartRange || "1Y";
      state.zoom = 1;
      state.offset = 0;
      widget.querySelectorAll("[data-ai-chart-range]").forEach((item) => item.classList.toggle("is-active", item === button));
      render();
    });
  });

  widget.querySelectorAll("[data-ai-chart-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.aiChartAction;
      const info = aiChartWindowInfo(item, state);
      if (action === "zoom-in") aiSetZoomAnchored(item, state, 0.5, state.zoom * 1.35);
      else if (action === "zoom-out") aiSetZoomAnchored(item, state, 0.5, state.zoom / 1.35);
      else if (action === "pan-left") state.offset = Math.min(info.maxOffset, state.offset + Math.max(5, Math.round(12 / state.zoom)));
      else if (action === "pan-right") state.offset = Math.max(0, state.offset - Math.max(5, Math.round(12 / state.zoom)));
      else if (action === "reset") { state.zoom = 1; state.offset = 0; }
      else if (action === "fullscreen") toggleAiWidgetFullscreen(widget);
      else if (action === "share") exportWidgetAsImage(widget, item.ticker);
      render();
    });
  });

  if (!svg) return;
  
  // 더블클릭 뷰 리셋 제스처
  svg.addEventListener("dblclick", (e) => {
    e.preventDefault();
    state.zoom = 1;
    state.offset = 0;
    render();
  });
  svg.addEventListener("wheel", (event) => {
    event.preventDefault();
    const rect = svg.getBoundingClientRect();
    const g = priceChartGeom();
    const vbX = ((event.clientX - rect.left) / Math.max(1, rect.width)) * g.width;
    const plotW = g.width - g.padL - g.padR;
    const frac = Math.max(0, Math.min(1, (vbX - g.padL) / plotW));
    aiSetZoomAnchored(item, state, frac, event.deltaY < 0 ? state.zoom * 1.2 : state.zoom / 1.2);
    render();
  }, { passive: false });

  let dragPointerId = null;
  let startX = 0;
  let startOffset = 0;
  let dragInfo = null;
  let dragPlotPx = 1;
  let raf = 0;
  const schedule = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      render();
    });
  };

  svg.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragPointerId = event.pointerId;
    startX = event.clientX;
    startOffset = state.offset;
    dragInfo = aiChartWindowInfo(item, state);
    const rect = svg.getBoundingClientRect();
    const g = priceChartGeom();
    dragPlotPx = rect.width * ((g.width - g.padL - g.padR) / g.width);
    svg.classList.add("is-dragging");
    try { svg.setPointerCapture(event.pointerId); } catch (e) { /* ignore */ }
    event.preventDefault();
  });

  svg.addEventListener("pointermove", (event) => {
    if (dragPointerId == null || event.pointerId !== dragPointerId || !dragInfo) return;
    const dx = event.clientX - startX;
    const barsPerPx = dragInfo.windowSize / Math.max(1, dragPlotPx);
    let next = Math.round(startOffset + dx * barsPerPx);
    next = Math.max(0, Math.min(dragInfo.maxOffset, next));
    if (next !== state.offset) {
      state.offset = next;
      schedule();
    }
    event.preventDefault();
  });

  const endDrag = (event) => {
    if (dragPointerId == null || event.pointerId !== dragPointerId) return;
    dragPointerId = null;
    dragInfo = null;
    svg.classList.remove("is-dragging");
    try { svg.releasePointerCapture(event.pointerId); } catch (e) { /* ignore */ }
    render();
  };
  svg.addEventListener("pointerup", endDrag);
  svg.addEventListener("pointercancel", endDrag);
}

// ===== AI 모드: 상승확률(MirProb) 히어로 & 시각화 헬퍼 =====
let aiProbHorizon = 20; // 5=1주, 20=1개월, 60=3개월

// 5년 일봉이 있으면 차트 확률 엔진으로 정밀 분석, 없으면 스냅샷 지표로 간이 추정.
async function computeAiProbability(item, horizon) {
  const hz = horizon || aiProbHorizon;
  const rows = getChartRows(item);
  const quick = () => {
    const q = scanQuickProb(item, hz);
    return { fallback: true, headlineUp: q.up, horizon: hz, signals: [], patterns: [] };
  };
  if (!window.MirProb || !window.MirProb.analyzeRows || !Array.isArray(rows) || rows.length < 60) {
    return quick();
  }
  try {
    await Promise.all([
      window.MirProb.ensureStats ? window.MirProb.ensureStats() : Promise.resolve(),
      (typeof ensureAnalysisFeatureData === "function" ? ensureAnalysisFeatureData() : Promise.resolve()),
    ]);
    const result = window.MirProb.analyzeRows(rows, hz, {
      ticker: item.ticker, company: item.company, statsMode: "population",
    });
    if (!result || result.error) return quick();
    return result;
  } catch (e) {
    return quick();
  }
}

// 270° 원형 게이지 SVG. CSS 애니메이션(aiGaugeSweep)으로 아크가 그려진다.
function aiRadialGauge(pct, opts = {}) {
  const size = opts.size || 176;
  const stroke = opts.stroke || 15;
  const r = (size - stroke) / 2 - 2;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const track = circ * 0.75;                       // 270° 아크
  const val = Math.max(0, Math.min(100, Number(pct) || 0));
  const filled = track * (val / 100);
  const color = scanProbColor(val);
  const rot = 135;                                 // 하단 중앙에 갭
  return `
    <svg class="ai-gauge" viewBox="0 0 ${size} ${size}" role="img" aria-label="상승확률 ${Math.round(val)}%">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" style="stroke:var(--line)" stroke-width="${stroke}"
        stroke-dasharray="${track.toFixed(1)} ${circ.toFixed(1)}" stroke-linecap="round"
        transform="rotate(${rot} ${cx} ${cy})"/>
      <circle class="ai-gauge-fill" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke-width="${stroke}"
        stroke-dasharray="${filled.toFixed(1)} ${circ.toFixed(1)}" stroke-linecap="round"
        style="stroke:${color};--gauge-dash:${filled.toFixed(1)}" transform="rotate(${rot} ${cx} ${cy})"/>
      <text x="${cx}" y="${cy - 2}" class="ai-gauge-num" text-anchor="middle" style="fill:${color}">${Math.round(val)}<tspan class="ai-gauge-pct">%</tspan></text>
      <text x="${cx}" y="${cy + 22}" class="ai-gauge-cap" text-anchor="middle">상승확률</text>
    </svg>`;
}

function aiProbStat(label, value, detail, tone) {
  return `<article class="ai-prob-stat">
      <span>${escapeHtml(label)}</span>
      <strong class="${tone || ""}">${escapeHtml(String(value))}</strong>
      <em>${escapeHtml(detail || "")}</em>
    </article>`;
}

function aiSignalBar(s) {
  const dir = Math.max(-1, Math.min(1, Number(s.dir) || 0));
  const pct = Math.round(Math.abs(dir) * 100);
  const bull = dir >= 0;
  return `<div class="ai-sig-row" title="${escapeHtml(s.detail || "")}">
      <span class="ai-sig-label">${escapeHtml(s.label || "신호")}</span>
      <span class="ai-sig-track"><span class="ai-sig-fill ${bull ? "is-bull" : "is-bear"}" style="width:${pct}%"></span></span>
      <span class="ai-sig-dir ${bull ? "pos" : "neg"}">${bull ? "▲" : "▼"}</span>
    </div>`;
}

function aiProbabilityHero(result) {
  const up = Math.round(result.headlineUp ?? 50);
  const color = scanProbColor(up);
  const verdict = (window.MirProb && window.MirProb.verdictText) ? window.MirProb.verdictText(up) : scanVerdict(up);
  const hz = result.horizon || aiProbHorizon;
  const hzLabel = hz <= 5 ? "1주" : hz >= 60 ? "3개월" : "1개월";
  const base = result.base;
  const consensus = result.consensus ? Math.round(result.consensus.up) : null;

  const stats = [];
  if (consensus != null) stats.push(aiProbStat("신호 합의", `${consensus}%`, "기술 지표 종합"));
  if (base && base.samples) stats.push(aiProbStat("과거 실측", `${Math.round(base.upProb)}%`, `유사 ${base.samples}회`));
  if (result.adxVal != null) stats.push(aiProbStat("추세 강도", result.adxVal.toFixed(0), "ADX"));

  const analog = base && base.samples ? `
    <div class="ai-prob-analog">
      <div class="ai-prob-analog-head">지금 차트, 과거엔 어땠나 <span>지난 5년 · ${hzLabel} 뒤</span></div>
      <p>지금과 비슷했던 <b>${base.samples}회</b> 중
         <b style="color:${scanProbColor(base.upProb)}">${Math.round(base.upProb)}%</b>가 ${hzLabel} 뒤 상승했어요.</p>
      <div class="ai-prob-analog-grid">
        <div><span>평균</span><b class="${cls(base.avgReturn)}">${base.avgReturn >= 0 ? "+" : ""}${base.avgReturn.toFixed(1)}%</b></div>
        <div><span>최고</span><b class="pos">+${base.best.toFixed(0)}%</b></div>
        <div><span>최저</span><b class="neg">${base.worst.toFixed(0)}%</b></div>
      </div>
    </div>` : (result.fallback ? `<div class="ai-prob-analog is-lite"><p class="muted">5년 일봉이 부족해 스냅샷 지표로 간이 추정했습니다.</p></div>` : "");

  const signals = (result.signals || []).slice()
    .sort((a, b) => Math.abs(b.dir * b.weight) - Math.abs(a.dir * a.weight)).slice(0, 5);
  const signalBars = signals.length
    ? `<div class="ai-prob-signals"><div class="ai-prob-sub-head">핵심 신호</div>${signals.map(aiSignalBar).join("")}</div>`
    : "";

  const pats = (result.patterns || []).slice(0, 6);
  const patChips = pats.length ? `<div class="ai-prob-patterns">${pats.map((p) => {
    const d = Number(p.nominalDir) || 0;
    const when = p.barsAgo === 0 ? "오늘 확정" : `${p.barsAgo || 0}봉 전 확정`;
    return `<span class="ai-pat-chip ${d > 0 ? "is-bull" : d < 0 ? "is-bear" : ""}" title="${escapeHtml(when)}">${escapeHtml(p.label || p.pattern)}</span>`;
  }).join("")}</div>` : "";

  return `
    <section class="ai-prob-hero" style="--prob-color:${color}">
      <div class="ai-prob-gauge-col">
        ${aiRadialGauge(up)}
        <div class="ai-prob-verdict" style="color:${color}">${escapeHtml(verdict)}</div>
        <div class="ai-prob-hznote">${hzLabel} 기준 종합 추정${result.fallback ? " · 간이" : ""}</div>
      </div>
      <div class="ai-prob-detail">
        <div class="ai-prob-stats">${stats.join("")}</div>
        ${analog}
        ${signalBars}
        ${patChips}
      </div>
    </section>`;
}

function aiProbSkeleton() {
  return `
    <div class="ai-prob-skeleton">
      <div class="ai-prob-skel-gauge shimmer-loading"></div>
      <div class="ai-prob-skel-lines">
        <div class="shimmer-loading shimmer-line mid"></div>
        <div class="shimmer-loading shimmer-line"></div>
        <div class="shimmer-loading shimmer-line short"></div>
        <div class="shimmer-loading shimmer-line mid"></div>
      </div>
    </div>`;
}

// 블록을 Claude 웹처럼 순차적으로 blur-in 리빌.
function revealAiBlocksStaggered(container, step = 130) {
  if (!container) return;
  const blocks = Array.from(container.querySelectorAll(".ai-block.animate-reveal"));
  blocks.forEach((block, index) => {
    setTimeout(() => block.classList.add("reveal-active"), index * step);
  });
}

async function renderInlineStockWidget(ticker, parentBubble) {
  const base = stockByTicker(ticker) || data.stocks.find((row) => row.ticker === ticker);
  if (!base) return;
  const initialItem = applyLive(withDetail(base));
  const itemPromise = ensureAiWidgetStock(ticker);
  
  const widgetId = "widget_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  
  const widgetContainer = document.createElement("div");
  widgetContainer.className = "chat-msg-widget ai-chart-widget";
  widgetContainer.id = widgetId;
  
  widgetContainer.innerHTML = `
    <div class="widget-assembly-overlay">
      <div class="ai-assembly-orb">
        <span class="ai-orb-core"></span>
        <span class="ai-orb-ring"></span>
        <span class="ai-orb-ring is-2"></span>
      </div>
      <p class="widget-status" id="status_${widgetId}">${escapeHtml(initialItem.company)} 투자 데이터를 모으는 중...</p>
      <div class="ai-assembly-track"><span class="ai-assembly-track-fill"></span></div>
    </div>
    <div class="widget-content-grid" id="grid_${widgetId}" style="opacity: 0; display: none; transition: opacity 0.5s ease-in-out;">
      <div class="ai-prob-host ai-block animate-reveal" id="prob_${widgetId}"></div>
      <div class="widget-chart-box ai-block animate-reveal">
        <div class="ai-widget-chart-head">
          <div>
            <strong>${escapeHtml(initialItem.company)} <span>${escapeHtml(initialItem.ticker)}</span></strong>
            <small class="ai-widget-chart-meta">차트 준비 중</small>
          </div>
          <div class="ai-widget-chart-tools" aria-label="AI 차트 조작">
            <div class="ai-dropdown-wrapper">
              <button type="button" class="ai-dropdown-trigger-btn" title="차트 분석 레이어 설정">지표 설정 </button>
              <div class="ai-indicators-dropdown">
                <label><input type="checkbox" data-indicator="trendlines" checked> 자동 추세선</label>
                <label><input type="checkbox" data-indicator="support" checked> 지지/저항선</label>
                <label><input type="checkbox" data-indicator="patterns" checked> 차트 패턴</label>
                <label><input type="checkbox" data-indicator="levels" checked> 매물대 가이드</label>
                <label><input type="checkbox" data-indicator="sma" checked> 이동평균선</label>
                <label><input type="checkbox" data-indicator="volume" checked> 거래량 차트</label>
                <label><input type="checkbox" data-indicator="rsi" checked> RSI 보조지표</label>
              </div>
            </div>
            <span style="border-left:1px solid rgba(255,255,255,0.1);height:14px;margin:0 4px;"></span>
            <button type="button" data-ai-chart-range="5Y">5Y</button>
            <button type="button" class="is-active" data-ai-chart-range="1Y">1Y</button>
            <button type="button" data-ai-chart-range="6M">6M</button>
            <button type="button" data-ai-chart-range="3M">3M</button>
            <button type="button" data-ai-chart-range="1M">1M</button>
            <button type="button" data-ai-chart-action="pan-left" title="이전 구간">‹</button>
            <button type="button" data-ai-chart-action="zoom-out" title="축소">−</button>
            <button type="button" data-ai-chart-action="zoom-in" title="확대">+</button>
            <button type="button" data-ai-chart-action="pan-right" title="다음 구간">›</button>
            <button type="button" data-ai-chart-action="reset" title="초기화">Reset</button>
            <button type="button" data-ai-chart-action="fullscreen" title="풀스크린 분석" class="fullscreen-toggle-btn">⤢</button>
            <button type="button" class="widget-share-btn" data-ai-chart-action="share" title="리포트 이미지 저장">공유</button>
          </div>
        </div>
        <svg id="chart_${widgetId}" class="ai-widget-chart" viewBox="0 0 860 520" role="img" aria-label="${escapeHtml(initialItem.ticker)} interactive chart"></svg>
        <p class="ai-widget-chart-hint">마우스 휠로 확대/축소하고, 차트를 좌우로 드래그해서 구간을 이동할 수 있습니다.</p>
      </div>
      <div class="widget-info-grid">
        <div class="ai-evidence-grid ai-block animate-reveal" id="evidence_${widgetId}"></div>
        <div class="ai-mode-data-host ai-block animate-reveal" id="modeData_${widgetId}"></div>
        <div class="widget-facts ai-block animate-reveal">
          <h4>핵심 투자 지표</h4>
          <div id="facts_${widgetId}"></div>
        </div>
        <div class="widget-news ai-block animate-reveal">
          <h4>관련 최신 소식</h4>
          <div id="news_${widgetId}" class="widget-news-list"></div>
        </div>
      </div>
    </div>
  `;
  
  parentBubble.appendChild(widgetContainer);
  
  const log = byId("aiChatLog");
  
  const statusLabel = byId("status_" + widgetId);
  const overlay = widgetContainer.querySelector(".widget-assembly-overlay");
  const grid = byId("grid_" + widgetId);
  
  // Step-by-step assembly animation inline
  setTimeout(() => {
    if (statusLabel) statusLabel.textContent = "가격 이력과 보조지표를 불러오는 중...";
  }, 400);
  
  setTimeout(() => {
    if (statusLabel) statusLabel.textContent = "차트 확대/이동 컨트롤을 연결하는 중...";
  }, 800);
  
  setTimeout(() => {
    if (statusLabel) statusLabel.textContent = "실시간 뉴스와 핵심 지표를 정리하는 중...";
  }, 1200);
  
  setTimeout(async () => {
    const item = await itemPromise || initialItem;
    // Fade out overlay
    if (overlay) overlay.style.opacity = "0";
    
    setTimeout(() => {
      if (overlay) overlay.style.display = "none";
      if (grid) {
        grid.style.display = "grid";
        // Force reflow
        grid.offsetHeight;
        grid.style.opacity = "1";
      }

      // 상승확률 히어로: 먼저 스켈레톤을 보여주고, 분석이 끝나면 교체(Claude 웹 스타일).
      const probContainer = byId("prob_" + widgetId);
      if (probContainer) {
        probContainer.innerHTML = aiProbSkeleton();
      }

      // Render components inside the bubble!
      const factsContainer = byId("facts_" + widgetId);
      if (factsContainer) {
        factsContainer.innerHTML = stockFacts(item, "AI Mode");
      }

      const evidenceContainer = byId("evidence_" + widgetId);
      if (evidenceContainer) {
        evidenceContainer.innerHTML = renderAiEvidenceGrid(item);
      }

      const modeDataContainer = byId("modeData_" + widgetId);
      if (modeDataContainer) {
        modeDataContainer.innerHTML = renderAiModeDataBoard(item);
      }
      
      const newsContainer = byId("news_" + widgetId);
      if (newsContainer) {
        if (item.news && item.news.length > 0) {
          newsContainer.innerHTML = item.news.slice(0, 3).map(n => `
            <div class="widget-news-item">
              <a href="${escapeHtml(n.url || "#")}" target="_blank" rel="noopener">${escapeHtml(n.title)}</a>
              <small>${escapeHtml(n.source)} · ${escapeHtml(n.time || "")}</small>
            </div>
          `).join("");
        } else {
          newsContainer.innerHTML = `<p class="muted font-small">최근 뉴스 정보가 없습니다.</p>`;
        }
      }
      
      // Draw interactive SVG price chart inside bubble!
      const chartSvg = byId("chart_" + widgetId);
      if (chartSvg) {
        const aiState = createAiChartState();
        drawAiWidgetChart(item, chartSvg, aiState, widgetContainer.querySelector(".ai-widget-chart-meta"));
        setupAiWidgetChartControls(widgetContainer, item, aiState);
      }
      
      // Reveal widget (차트 레이어 애니메이션 트리거) + 블록을 순차 blur-in.
      widgetContainer.classList.add("reveal-active");
      revealAiBlocksStaggered(widgetContainer);

      // 상승확률 분석은 무겁게 걸릴 수 있어 리빌을 막지 않고 끝나면 스켈레톤을 교체한다.
      computeAiProbability(item).then((probResult) => {
        if (!probContainer || !probContainer.isConnected) return;
        probContainer.innerHTML = aiProbabilityHero(probResult);
        probContainer.classList.add("is-loaded");
      }).catch(() => { /* 실패 시 스켈레톤 유지 */ });
    }, 400);
  }, 1600);
}

// ===== JARVIS 종목 대시보드 (AI 모드) =====
// 티커 입력 시 배경 차트(ai-cosmos morph) 위로 종목 카드·투자의견·핵심근거·
// 기관/내부자/의회/공매도/실적·뉴스 패널이 페이드인한다. 모든 데이터는 사이트에 이미 있는 것을 재사용.
let aiDashSeq = 0;
// 차트 영역 폭이 바뀐 뒤 cosmos 캔버스를 새 크기에 맞춰 다시 그린다(여러 번 호출로 확실히).
function aiCosmosRelayoutSoon() {
  const relayout = () => { try { window.MirCosmos?.relayout?.(); } catch (_) {} };
  requestAnimationFrame(relayout);
  setTimeout(relayout, 200);
}
async function renderAiStockDashboard(ticker) {
  const host = byId("aiStockDashboard");
  if (!host) return false;
  const t = normalizeTickerKey(ticker);
  const base = stockByTicker(t) || data.stocks.find((r) => r.ticker === t);
  if (!base) return false;
  const seq = ++aiDashSeq;
  const initial = applyLive(withDetail(base));
  let dashItem = initial; // 칩 핸들러가 참조(리페인트에도 최신 item 유지)

  host.innerHTML = `
    <div class="ai-dash-grid">
      <aside class="ai-dash-col ai-dash-col-left">
        <section class="ai-dash-panel ai-block animate-reveal" id="aiDashCard"></section>
      </aside>
      <aside class="ai-dash-col ai-dash-col-right">
        <section class="ai-dash-panel ai-dash-verdict-panel ai-block animate-reveal" id="aiDashVerdict"></section>
        <section class="ai-dash-panel ai-block animate-reveal" id="aiDashNews">
          <h4 class="ai-dash-h">관련 소식</h4>
          <div class="ai-dash-news-list"></div>
        </section>
      </aside>
      <div class="ai-dash-bottom ai-block animate-reveal">
        <section class="ai-dash-subpanel" id="aiDashMetrics"></section>
        <section class="ai-dash-subpanel" id="aiDashData"></section>
      </div>
    </div>
    <div class="ai-dash-rangebar" id="aiDashRange">
      ${["1M", "3M", "6M", "1Y", "5Y"].map((r) => `<button type="button" data-range="${r}"${r === "6M" ? ' class="is-active"' : ""}>${r}</button>`).join("")}
    </div>
    <button type="button" class="ai-dash-collapse" id="aiDashCollapse" aria-label="정보 패널 접기/펼치기" title="정보 패널 접기/펼치기"></button>`;
  host.classList.add("is-active");
  host.setAttribute("aria-hidden", "false");
  // 사이드바 접기 토글 (차트를 전체 폭으로)
  const collapseBtn = byId("aiDashCollapse");
  const syncCollapseGlyph = () => { if (collapseBtn) collapseBtn.textContent = document.body.classList.contains("ai-dash-collapsed") ? "‹" : "›"; };
  syncCollapseGlyph();
  if (collapseBtn) collapseBtn.addEventListener("click", () => {
    document.body.classList.toggle("ai-dash-collapsed");
    syncCollapseGlyph();
    aiCosmosRelayoutSoon();
  });
  // 사이드바가 차트 폭을 줄였으니 cosmos 캔버스를 새 영역에 맞춰 다시 그린다.
  aiCosmosRelayoutSoon();
  const rangeKo = { "1M": "1개월", "3M": "3개월", "6M": "6개월", "1Y": "1년", "5Y": "5년" };
  const rangeBar = byId("aiDashRange");
  if (rangeBar) rangeBar.querySelectorAll("[data-range]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const r = btn.dataset.range;
      if (window.MirCosmos?.setChartRange?.(r)) {
        rangeBar.querySelectorAll("[data-range]").forEach((b) => b.classList.toggle("is-active", b === btn));
        const hint = byId("aiInputHint"); // 하단 라벨 동기화
        if (hint) hint.textContent = `${t} · ${rangeKo[r] || r} 차트`;
      }
    });
  });

  // 후속 질문 칩(위임): 리페인트에도 살아남도록 host에 한 번만 바인딩
  host.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-dash-q]");
    if (!chip) return;
    const q = chip.getAttribute("data-dash-q");
    const label = chip.getAttribute("data-dash-l") || "질문";
    host.querySelectorAll("[data-dash-q]").forEach((c) => c.classList.toggle("is-active", c === chip));
    fetchAiDashLlmComment(dashItem, aiDashSeq, {
      query: `${dashItem.company || dashItem.ticker}(${dashItem.ticker}) — ${q}`,
      label,
    });
  });

  const paint = (item) => {
    if (seq !== aiDashSeq) return; // 새 종목 요청이 들어오면 이전 렌더 중단
    const card = byId("aiDashCard"); if (card) card.innerHTML = aiDashCardHtml(item);
    const metrics = byId("aiDashMetrics"); if (metrics) metrics.innerHTML = `<h4 class="ai-dash-h">핵심 신호 · 이벤트</h4>${renderAiEvidenceGrid(item)}`;
    const dataB = byId("aiDashData"); if (dataB) dataB.innerHTML = `<h4 class="ai-dash-h">기술 지표 · 밸류에이션</h4>${renderAiModeDataBoard(item)}`;
    const verdict = byId("aiDashVerdict"); if (verdict) verdict.innerHTML = aiVerdictPanel(item);
    const newsList = host.querySelector("#aiDashNews .ai-dash-news-list");
    if (newsList) newsList.innerHTML = aiDashNewsHtml(item);
  };
  paint(initial);
  revealAiBlocksStaggered(host);
  const item = (await ensureAiWidgetStock(t)) || initial;
  if (seq !== aiDashSeq) return false;
  dashItem = item;
  paint(item);
  // 규칙 기반 verdict 위에 워커 LLM 자연어 코멘트를 비동기로 덧붙인다(있으면).
  fetchAiDashLlmComment(item, seq);
  return true;
}

function aiDashCardHtml(item) {
  const f = (typeof normalizedFundamentalsForItem === "function") ? normalizedFundamentalsForItem(item) : (item.fundamentals || {});
  const chg = Number(item.changePct);
  const chgCls = chg > 0 ? "pos" : chg < 0 ? "neg" : "muted";
  const secKo = item.sector ? (SECTOR_KO[item.sector] || item.sector) : "";
  const stat = (label, val) => `<div class="ai-dash-stat"><span>${escapeHtml(label)}</span><b>${val}</b></div>`;
  // 목표주가 + 상승 여력
  const price = Number(item.price) || Number(f.prevClose);
  const tgt = Number(f.targetPrice);
  let targetVal = "—";
  if (Number.isFinite(tgt)) {
    const up = (Number.isFinite(price) && price) ? (tgt - price) / price * 100 : null;
    targetVal = `${priceOrDash(tgt)}${up != null ? ` <em class="${up >= 0 ? "pos" : "neg"}">${fmtPct(up)}</em>` : ""}`;
  }
  // 기관 보유(13F)
  let instVal = "—";
  try {
    const g = (typeof inst13fIndex === "function") ? inst13fIndex()[item.ticker] : null;
    if (g && g.holders) instVal = `${g.holders}곳${g.valueM ? " · " + fmtBillions(g.valueM / 1000) : ""}`;
  } catch (_) {}
  return `
    <div class="ai-dash-card-head">
      <div class="ai-dash-idname">
        <strong class="ai-dash-ticker">${escapeHtml(item.ticker)}</strong>
        <span class="ai-dash-company">${escapeHtml(item.company || "")}${secKo ? " · " + escapeHtml(secKo) : ""}</span>
      </div>
      <div class="ai-dash-price">
        <b>${priceOrDash(item.price)}</b>
        <span class="${chgCls}">${fmtDailyPct(chg)}</span>
      </div>
    </div>
    <div class="ai-dash-stats">
      ${stat("시가총액", fmtBillions(f.marketCapDisplay ?? f.marketCapB ?? item.marketCapB))}
      ${stat("목표주가", targetVal)}
      ${stat("PER", fmtMultiple(f.pe))}
      ${stat("Fwd PER", fmtMultiple(f.forwardPE))}
      ${stat("RS 점수", item.rsScore ?? "—")}
      ${stat("기관 보유(13F)", instVal)}
      ${stat("52주 고", priceOrDash(f.week52High))}
      ${stat("52주 저", priceOrDash(f.week52Low))}
    </div>`;
}

function aiDashNewsHtml(item) {
  const news = Array.isArray(item.news) ? item.news.slice(0, 4) : [];
  if (!news.length) return `<p class="muted font-small">최근 뉴스 정보가 없습니다.</p>`;
  return news.map((n) => `
    <a class="ai-dash-news-item" href="${escapeHtml(n.url || "#")}" target="_blank" rel="noopener">
      <span>${escapeHtml(n.title || "")}</span>
      <small>${escapeHtml(n.source || "")}${n.time ? " · " + escapeHtml(n.time) : ""}</small>
    </a>`).join("");
}

// AI 투자 의견 verdict — 사이트에 이미 있는 신호(RS·모멘텀·52주위치·목표가여력·밸류·
// 내부자)를 종합한 규칙 기반 스코어카드. 오프라인 즉시 계산(투자 조언 아님).
function aiVerdictPanel(item) {
  const f = (typeof normalizedFundamentalsForItem === "function") ? normalizedFundamentalsForItem(item) : (item.fundamentals || {});
  const price = Number(item.price) || Number(f.prevClose);
  const sig = []; // {s: score, k: 'strength'|'risk'|'neutral', t: text}

  const rs = Number(item.rsScore);
  if (Number.isFinite(rs)) {
    if (rs >= 80) sig.push({ s: 2, k: "strength", t: `RS ${rs} · 시장 상위 강세` });
    else if (rs >= 60) sig.push({ s: 1, k: "strength", t: `RS ${rs} · 평균 이상 강세` });
    else if (rs <= 30) sig.push({ s: -2, k: "risk", t: `RS ${rs} · 시장 대비 약세` });
    else if (rs <= 45) sig.push({ s: -1, k: "risk", t: `RS ${rs} · 상대적 부진` });
  }
  const m3 = Number(item.threeMonthChangePct);
  if (Number.isFinite(m3)) {
    if (m3 >= 15) sig.push({ s: 1.5, k: "strength", t: `3개월 +${m3.toFixed(0)}% 상승 추세` });
    else if (m3 <= -15) sig.push({ s: -1.5, k: "risk", t: `3개월 ${m3.toFixed(0)}% 하락 추세` });
  }
  const hi = Number(f.week52High), lo = Number(f.week52Low);
  if (Number.isFinite(hi) && Number.isFinite(lo) && hi > lo && Number.isFinite(price)) {
    const pos = Math.round((price - lo) / (hi - lo) * 100);
    if (pos >= 90) sig.push({ s: 0.5, k: "neutral", t: `52주 신고가 근접 (상위 ${pos}%)` });
    else if (pos <= 25) sig.push({ s: -0.5, k: "risk", t: `52주 저점권 (하위 ${pos}%)` });
  }
  const tgt = Number(f.targetPrice);
  if (Number.isFinite(tgt) && Number.isFinite(price) && price) {
    const up = (tgt - price) / price * 100;
    if (up >= 15) sig.push({ s: 1.5, k: "strength", t: `목표가 +${up.toFixed(0)}% 상승 여력` });
    else if (up <= -5) sig.push({ s: -1, k: "risk", t: `현재가가 목표가 상회 (${up.toFixed(0)}%)` });
  }
  const fpe = Number(f.forwardPE);
  if (Number.isFinite(fpe) && fpe > 0) {
    if (fpe > 40) sig.push({ s: -1, k: "risk", t: `Forward PER ${fpe.toFixed(0)}배 · 고평가 부담` });
    else if (fpe < 15) sig.push({ s: 1, k: "strength", t: `Forward PER ${fpe.toFixed(0)}배 · 밸류 매력` });
  }
  const ins = ((window.INSIDER_TRADES || {}).trades || []).filter((r) => r.ticker === item.ticker);
  const insBuy = ins.filter((r) => r.kind === "buy").length;
  const insSell = ins.filter((r) => r.kind === "sell").length;
  if (insBuy || insSell) {
    if (insBuy > insSell) sig.push({ s: 1, k: "strength", t: `내부자 순매수 (매수 ${insBuy} / 매도 ${insSell})` });
    else if (insSell > insBuy * 2) sig.push({ s: -1, k: "risk", t: `내부자 순매도 (매도 ${insSell}건)` });
  }

  const total = sig.reduce((a, x) => a + x.s, 0);
  const strengths = sig.filter((x) => x.k === "strength").sort((a, b) => b.s - a.s);
  const risks = sig.filter((x) => x.k === "risk").sort((a, b) => a.s - b.s);

  let verdict, vcls;
  if (total >= 3.5) { verdict = "적극 매수"; vcls = "buy"; }
  else if (total >= 1.5) { verdict = "매수 우위"; vcls = "buy"; }
  else if (total > -1.5) { verdict = "중립 · 관망"; vcls = "hold"; }
  else if (total > -3.5) { verdict = "비중 축소"; vcls = "sell"; }
  else { verdict = "매도 우위"; vcls = "sell"; }

  const absSum = sig.reduce((a, x) => a + Math.abs(x.s), 0) || 1;
  const agree = Math.abs(total) / absSum;
  const conf = sig.length ? Math.round(Math.min(94, 42 + sig.length * 7 + agree * 22)) : 30;

  const name = item.company || item.ticker;
  const dir = vcls === "buy" ? "매수 우위 신호가 우세합니다" : vcls === "sell" ? "하방 리스크 신호가 우세합니다" : "뚜렷한 방향성이 약해 관망이 유효합니다";
  const comment = `${escapeHtml(name)}은(는) 현재 ${dir}.` +
    (strengths[0] ? ` 핵심 강점은 ${escapeHtml(strengths[0].t)}` + (risks[0] ? `이며, 유의할 점은 ${escapeHtml(risks[0].t)}입니다.` : `입니다.`) : (risks[0] ? ` 유의할 점은 ${escapeHtml(risks[0].t)}입니다.` : ""));

  const li = (arr, empty) => arr.length ? arr.slice(0, 3).map((x) => `<li>${escapeHtml(x.t)}</li>`).join("") : `<li class="muted">${empty}</li>`;

  return `
    <div class="ai-verdict-head">
      <h4 class="ai-dash-h">AI 투자 의견</h4>
      <span class="ai-verdict-badge ai-verdict-${vcls}">${verdict}</span>
    </div>
    <div class="ai-verdict-conf">
      <span>신뢰도</span>
      <div class="ai-verdict-gauge"><i class="ai-verdict-${vcls}" style="width:${conf}%"></i></div>
      <b>${conf}%</b>
    </div>
    <p class="ai-verdict-comment">${comment}</p>
    <div class="ai-verdict-cols">
      <div class="ai-verdict-pts">
        <span class="ai-verdict-pts-h up">강점</span>
        <ul>${li(strengths, "특이 강점 신호 없음")}</ul>
      </div>
      <div class="ai-verdict-pts">
        <span class="ai-verdict-pts-h down">리스크</span>
        <ul>${li(risks, "특이 리스크 신호 없음")}</ul>
      </div>
    </div>
    <div class="ai-verdict-llm" id="aiDashLlm"></div>
    <div class="ai-dash-chips" aria-label="후속 질문">
      <span class="ai-dash-chips-h">이어서 묻기</span>
      ${AI_DASH_CHIPS.map((c) => `<button type="button" data-dash-q="${escapeHtml(c.q)}" data-dash-l="${escapeHtml(c.l)}">${escapeHtml(c.l)}</button>`).join("")}
    </div>
    <small class="ai-verdict-disc">규칙 기반 참고 지표 · 투자 조언이 아닙니다</small>`;
}

const AI_DASH_CHIPS = [
  { l: "매수 타이밍?", q: "지금 매수하기 좋은 시점인지 기술적·펀더멘탈 근거와 함께 판단해줘" },
  { l: "핵심 리스크", q: "이 종목의 핵심 하방 리스크 요인을 짚어줘" },
  { l: "동종업체 비교", q: "주요 동종업체 대비 강점과 약점을 비교해줘" },
  { l: "실적 전망", q: "다가오는 실적과 향후 실적 전망을 정리해줘" },
  { l: "적정 매수가", q: "기술적 지지선과 밸류에이션을 고려한 매수 고려 가격대를 알려줘" },
];

// 워커 LLM(/chat)으로 자연어 코멘트/후속답변을 받아 verdict 패널의 슬롯에 채운다.
// opts.query가 있으면 후속 질문 답변(Q&A), 없으면 자동 심층 코멘트.
// 프록시가 없거나 실패하면: 자동 코멘트는 조용히 비우고, 후속 질문은 안내 메시지를 표시.
async function fetchAiDashLlmComment(item, seq, opts) {
  const slot = byId("aiDashLlm");
  if (!slot) return;
  const custom = opts && opts.query;
  const headLabel = custom ? `${escapeHtml(opts.label || "질문")}` : "AI 심층 코멘트";
  if (!LIVE_DATA_PROXY) {
    if (custom) slot.innerHTML = `<div class="ai-verdict-llm-head">${headLabel}</div><p class="ai-verdict-llm-body muted">AI 답변은 서버(Worker) 연결 후 이용할 수 있습니다.</p>`;
    return;
  }
  slot.innerHTML = `<div class="ai-verdict-llm-head">${headLabel}</div><p class="ai-verdict-llm-body ai-verdict-llm-loading">작성 중…</p>`;
  try {
    const query = custom || `${item.company || item.ticker}(${item.ticker})의 현재 차트·펀더멘탈·수급을 종합해 2~3문장의 간결한 한국어 투자 코멘트를 작성해줘. 매수/매도 단정은 피하고 핵심 포인트와 주의점 위주로. 마크다운 없이 평문으로.`;
    const stockContext = await buildStockChatContext(item.ticker);
    if (seq !== aiDashSeq) return; // 사용자가 다른 종목으로 이동함
    const res = await fetch(`${LIVE_DATA_PROXY.replace(/\/$/, "")}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: query }],
        stockContext,
        snapshotContext: (typeof buildMarketChatContext === "function" ? buildMarketChatContext() : ""),
        market: isKrMarket() ? "kr" : "us",
        searchHints: { tickers: [item.ticker], companies: [item.company].filter(Boolean) },
      }),
    });
    if (seq !== aiDashSeq) return;
    const payload = await res.json();
    const reply = (payload && payload.reply || "").trim();
    const cur = byId("aiDashLlm");
    if (!cur || seq !== aiDashSeq) return;
    if (reply) {
      cur.innerHTML = `<div class="ai-verdict-llm-head">${headLabel}</div><p class="ai-verdict-llm-body">${formatMarkdownToHtml(reply)}</p>`;
    } else {
      cur.innerHTML = custom ? `<div class="ai-verdict-llm-head">${headLabel}</div><p class="ai-verdict-llm-body muted">답변을 받지 못했습니다.</p>` : "";
    }
  } catch (_) {
    const cur = byId("aiDashLlm");
    if (cur && seq === aiDashSeq) cur.innerHTML = custom ? `<div class="ai-verdict-llm-head">${headLabel}</div><p class="ai-verdict-llm-body muted">지금은 답변을 불러올 수 없습니다.</p>` : "";
  }
}

window.MirDash = {
  render: renderAiStockDashboard,
  hide() {
    const host = byId("aiStockDashboard");
    if (host) { host.classList.remove("is-active"); host.setAttribute("aria-hidden", "true"); host.innerHTML = ""; }
    aiDashSeq++;
    // 사이드바가 사라졌으니 차트를 다시 전체 폭으로 되돌린다.
    aiCosmosRelayoutSoon();
  },
};

function setupAiChatModeEvents() {
  const toggleBtn = byId("aiModeToggle");
  const exitBtn = byId("exitAiModeBtn");
  const sidebarToggleBtn = byId("sidebarToggleBtn");
  const newChatBtn = byId("newChatBtn");
  const sidebar = byId("aiChatSidebar");
  
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      if (window.MirAI?.toggle) return;
      toggleAiChatMode(!isAiChatMode);
    });
  }
  
  if (exitBtn) {
    exitBtn.addEventListener("click", () => {
      if (window.MirAI?.exit) return;
      toggleAiChatMode(false);
    });
  }

  if (sidebarToggleBtn && sidebar) {
    sidebarToggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
      sidebarToggleBtn.classList.toggle("active");
    });
  }

  if (newChatBtn) {
    newChatBtn.addEventListener("click", () => {
      startNewAiChatSession();
    });
  }
  
  // Suggestion cards click
  document.querySelectorAll(".ai-chat-suggest-card").forEach((card) => {
    card.addEventListener("click", () => {
      const query = card.dataset.query;
      sendAiChat(query);
      const input = byId("aiChatInput");
      if (input) {
        input.focus();
      }
    });
  });
  
  // Submit chat form
  const form = byId("aiChatForm");
  const input = byId("aiChatInput");
  const popup = byId("aiAutoComplete");
  
  if (form && input && popup) {
    let activeIndex = -1;
    let results = [];

    // 시장 배지 — 6자리 숫자를 무조건 KOSPI, 나머지를 NASDAQ 으로 찍으면
    // 코스닥 종목·NYSE 종목이 전부 오표기된다. 스냅샷의 market/groups 를 우선
    // 사용하고, 알 수 없으면 중립 라벨(KRX/US)로 둔다.
    const autocompleteMarketBadge = (s) => {
      const market = String(s.market || "").toLowerCase();
      if (market === "kospi") return "KOSPI";
      if (market === "kosdaq") return "KOSDAQ";
      const groups = s.groups || [];
      if (groups.includes("idx_nasdaq") || groups.includes("idx_ndx100")) return "NASDAQ";
      if (groups.includes("idx_nyse")) return "NYSE";
      return /^\d{6}$/.test(s.ticker) ? "KRX" : "US";
    };

    // 자동완성 추천 입력 리스너
    input.addEventListener("input", () => {
      const value = input.value.trim().toLowerCase();
      if (value.length < 1) {
        popup.hidden = true;
        results = [];
        return;
       }
       
       results = data.stocks.filter(s => {
         return s.ticker.toLowerCase().includes(value) || s.company.toLowerCase().includes(value);
       }).slice(0, 5);
       
       if (results.length === 0) {
         popup.hidden = true;
         return;
       }
       
       activeIndex = -1;
       popup.innerHTML = results.map((s, idx) => `
         <div class="autocomplete-item" data-ticker="${s.ticker}" data-index="${idx}">
           <div style="display:flex;align-items:center;gap:10px;">
             <span class="ticker-badge">${escapeHtml(s.ticker)}</span>
             <span class="company-name">${escapeHtml(s.company)}</span>
           </div>
           <span class="market-badge">${escapeHtml(autocompleteMarketBadge(s))}</span>
         </div>
       `).join("");
       popup.hidden = false;
       
       // 클릭 바인딩
       popup.querySelectorAll(".autocomplete-item").forEach(item => {
         item.addEventListener("click", () => {
           input.value = item.dataset.ticker + " 분석해줘";
           popup.hidden = true;
           sendAiChat();
         });
       });
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      popup.hidden = true;
      sendAiChat();
    });
    
    input.addEventListener("keydown", (e) => {
      if (popup.hidden) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendAiChat();
        }
        return;
      }
      
      const items = popup.querySelectorAll(".autocomplete-item");
      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % items.length;
        items.forEach((item, idx) => item.classList.toggle("active", idx === activeIndex));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        items.forEach((item, idx) => item.classList.toggle("active", idx === activeIndex));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (activeIndex >= 0 && results[activeIndex]) {
          input.value = results[activeIndex].ticker + " 분석해줘";
          popup.hidden = true;
          sendAiChat();
        } else {
          popup.hidden = true;
          sendAiChat();
        }
      } else if (e.key === "Escape") {
        popup.hidden = true;
      }
    });

    // 외부 클릭 시 자동완성 닫기
    document.addEventListener("click", (e) => {
      if (!input.contains(e.target) && !popup.contains(e.target)) {
        popup.hidden = true;
      }
    });

    // 음성인식 STT 바인딩
    const voiceBtn = byId("aiVoiceBtn");
    if (voiceBtn) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = "ko-KR";
        recognition.interimResults = false;
        
        let isListening = false;
        
        voiceBtn.addEventListener("click", () => {
          if (isListening) {
            recognition.stop();
          } else {
            try {
              recognition.start();
            } catch (e) { /* ignore */ }
          }
        });
        
        recognition.onstart = () => {
          isListening = true;
          voiceBtn.classList.add("is-recording");
          input.placeholder = "듣고 있습니다... 말씀해 주세요.";
        };
        
        recognition.onerror = (e) => {
          console.error("STT Error:", e);
          recognition.stop();
        };
        
        recognition.onend = () => {
          isListening = false;
          voiceBtn.classList.remove("is-recording");
          input.placeholder = "종목 분석 또는 투자 질문을 입력하세요...";
        };
        
        recognition.onresult = (e) => {
          const resultText = e.results[0][0].transcript;
          if (resultText) {
            input.value = resultText;
            popup.hidden = true;
            sendAiChat();
          }
        };
      } else {
        voiceBtn.style.opacity = "0.3";
        voiceBtn.style.cursor = "not-allowed";
        voiceBtn.title = "이 브라우저에서는 음성 인식을 지원하지 않습니다.";
      }
    }
  }
}

// Initialize AI Chat Mode Events
setupAiChatModeEvents();
