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
    epsTtm: Math.round(price * 0.04 * 100) / 100, // 데모 전용(실측은 스냅샷 빌더가 채움)
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

// ===== 티커 → 스냅샷 row 인덱스 =====
// normalizeTickerKey(= marketCfg().formatTicker) 로 정규화한 키. chart-indicators.js 의
// stockByTicker 가 이 Map 을 먼저 보고(O(1)), 없을 때만 배열을 훑는다. 스냅샷이 바뀌는
// 곳(loadData·시장 전환·폴백)마다 rebuildStockIndex() 로 다시 채운다.
window.MirStockIndex = new Map();
function rebuildStockIndex() {
  const idx = window.MirStockIndex;
  idx.clear();
  (data && Array.isArray(data.stocks) ? data.stocks : []).forEach((row) => {
    const key = normalizeTickerKey(row && row.ticker);
    if (key && !idx.has(key)) idx.set(key, row);
  });
  // 스냅샷 파생 캐시는 전부 무효화한다.
  _issuerTickerIndex = null;
  _issuerResolveCache.clear();
  _chartItemCache = null;
  _treemapPeerIndex = null;
  liveStubs.clear();
}
// 스냅샷에 없는 티커를 실시간(워커)으로만 볼 때 쓰는 대체 row. 스냅샷 배열과 섞지 않고
// 따로 둔다 — 예전엔 못 찾으면 data.stocks[0] 로 조용히 떨어져 엉뚱한 종목이 나왔다.
const liveStubs = new Map();
function liveStubFor(ticker) {
  return liveStubs.get(normalizeTickerKey(ticker)) || null;
}
// 선택 종목의 렌더 대상 row(스냅샷 우선, 없으면 실시간 스텁). 없으면 null — 폴백 없음.
function selectedBaseRow(ticker = selectedTicker) {
  if (!ticker) return null;
  return stockByTicker(ticker) || liveStubFor(ticker);
}

// Tickers with bad/synthetic snapshot data (e.g. pre-IPO placeholders).
const TICKER_BLOCKLIST = new Set(["SPCX"]);


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
// 기능 판정은 항상 `=== false` — 키가 없는 시장은 켜진 것으로 본다(CLAUDE.md '데이터 정직성').
// `!features.x` 로 쓰면 키 없는 시장까지 꺼진다.
function featureOff(key, cfg = marketCfg()) {
  return !!(cfg && cfg.features && cfg.features[key] === false);
}
// 거장 포트폴리오 서브탭 → 기능 키. dart/krown 은 KR 전용.
const INST_SUB_FEATURE = {
  congress: "congress", "13f": "sec13f", insider: "insider", activist: "activist",
  events: "materialEvents", ipo: "ipo", dart: "krDart", krown: "krOwnership",
};
const INST_SUB_KR_ONLY = new Set(["dart", "krown"]);
function instSubHidden(sub, cfg = marketCfg()) {
  if ((cfg.hiddenInstitutionalSubs || []).includes(sub)) return true;
  if (INST_SUB_KR_ONLY.has(sub) && cfg.id !== "kr") return true;
  const key = INST_SUB_FEATURE[sub];
  return key ? featureOff(key, cfg) : false;
}
// 탭 버튼 숨김/표시(hidden 속성 + display 를 같이 만진다 — CSS 가 display 를 덮어쓰는 곳이 있다).
function setTabHidden(btn, hidden) {
  if (!btn) return;
  btn.hidden = hidden;
  btn.style.display = hidden ? "none" : "";
}

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

// RS/EPS 합성 점수를 제거하고 실측 신호(모멘텀·신고가·거래량·RSI)로 재정의.
// minRsi / maxRsi 는 RSI(14) 범위 필터(0 = 미설정). 실제 종목 선별은 topPresetMatches() 가 담당.
const TOP_PRESETS = {
  leaders:  { metric: "threeMonthChangePct", minRsi: 50, maxRsi: 0,  minVolume: 0,   minMarketCap: 10, newHigh: "All",   recency: "All" },
  breakout: { metric: "volumeRatio",         minRsi: 0,  maxRsi: 0,  minVolume: 1.5, minMarketCap: 1,  newHigh: "0-2%",  recency: "All" },
  pullback: { metric: "monthChangePct",      minRsi: 0,  maxRsi: 55, minVolume: 0,   minMarketCap: 5,  newHigh: "5-10%", recency: "All" },
  growth:   { metric: "monthChangePct",      minRsi: 50, maxRsi: 0,  minVolume: 0,   minMarketCap: 2,  newHigh: "All",   recency: "All" },
  value:    { metric: "forwardPE",           minRsi: 0,  maxRsi: 0,  minVolume: 0,   minMarketCap: 10, newHigh: "All",   recency: "All" },
  lows:     { metric: "low52Dist",           minRsi: 0,  maxRsi: 0,  minVolume: 0,   minMarketCap: 1,  newHigh: "All",   recency: "All" },
  volsurge: { metric: "volumeRatio",         minRsi: 0,  maxRsi: 0,  minVolume: 3,   minMarketCap: 1,  newHigh: "All",   recency: "All" },
  oversold: { metric: "rsi14",               minRsi: 0,  maxRsi: 30, minVolume: 0,   minMarketCap: 2,  newHigh: "All",   recency: "All" }
};

// 프리셋의 minMarketCap 은 미국 기준 "달러 10억($B)" 단위다(US 스냅샷 marketCapB).
// KR 스냅샷의 시총은 marketCapT = "조 원" 단위여서 같은 숫자를 그대로 비교하면
// 스케일이 어긋난다(예: oversold 하한 2 → "2조" 로 읽혀 과매도 소형주 88종목이 전멸).
// 게다가 KR 은 시장 전체가 소형주 편중이라 단순 FX 환산이 아니라 KR 시총 분포에
// 맞춘 별도 하한을 둔다(값 단위 = 조 원):
//   · 대형주 지향(leaders·value): 1조 → 상위 ~10%. value 프리셋 술어의 기존 KR 하한(1조)과 정합.
//   · 눌림목(pullback): 0.5조,  성장(growth): 0.2조 → 중대형.
//   · 기술·역추세(breakout·lows·volsurge·oversold): 0.05조(≈500억) → 페니/초소형만 배제하고
//     중소형주를 폭넓게 허용(US 에서 이 프리셋들이 $1~2B 하한으로 사실상 나노캡만 걸러내던 의도와 동일).
const TOP_PRESET_MIN_CAP_KR = {
  leaders: 1, breakout: 0.05, pullback: 0.5, growth: 0.2,
  value: 1, lows: 0.05, volsurge: 0.05, oversold: 0.05,
};
// 현재 시장에 맞는 프리셋 시총 하한. US 는 설정값($B) 그대로, KR 은 조 원 하한.
function presetMinMarketCap(key) {
  const p = TOP_PRESETS[key];
  if (!p) return 0;
  if (isKrMarket()) return TOP_PRESET_MIN_CAP_KR[key] ?? p.minMarketCap ?? 0;
  return p.minMarketCap ?? 0;
}

// 52주 저가 대비 상승률(%) — MAP_FUNDAMENTALS.low52 + 스냅샷 price 로 계산.
function low52DistPct(item) {
  const f = (window.MAP_FUNDAMENTALS || {})[item?.ticker];
  const low = f && Number(f.low52);
  const price = Number(item?.price);
  if (!Number.isFinite(low) || low <= 0 || !Number.isFinite(price)) return NaN;
  return (price / low - 1) * 100;
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



// 경량 카드뉴스 페이로드. 파이프라인이 발행하는 data/cardnews.js(window.MIR_CARDNEWS)
// 의 JSON 쌍(data/cardnews.json)을 받는다. 파일이 아직 배포 전이면 null 을 돌려주고,
// 호출부가 레거시(대형 스냅샷) 폴백으로 넘어간다.
async function fetchCardNewsLight() {
  const g = window.MIR_CARDNEWS;
  if (g && (g.us || g.kr)) return { us: g.us || null, kr: g.kr || null };
  if (window.location.protocol === "file:") return null;
  try {
    const resp = await fetch("data/cardnews.json", { cache: "no-cache" });
    if (!resp.ok) return null;
    const payload = await resp.json();
    if (!payload || (!payload.us && !payload.kr)) return null;
    return { us: payload.us || null, kr: payload.kr || null };
  } catch (_) {
    return null;
  }
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
  rebuildStockIndex();

  await loadMapFundamentalsScript(cfg);
  loadEarningsCalendarSnapshot(cfg);

  // 카드뉴스 폴백 체인: ① 활성 스냅샷의 cardNews ② 메모리 백업 ③ 경량 데일리 파일
  // (data/cardnews.json, 수 KB) ④ 레거시 US 대형 스냅샷(~11MB). KR 스냅샷에 cardNews
  // 가 없다고 11MB 를 통째로 받던 것을 ③이 막는다. ④는 cardnews.json 이 모든 배포에
  // 깔릴 때까지 호환용으로만 남긴다.
  if (data && data.cardNews) {
    cardNewsBackup = data.cardNews;
  } else if (data && !data.cardNews) {
    if (cardNewsBackup) {
      data.cardNews = cardNewsBackup;
    } else {
      const light = await fetchCardNewsLight();
      if (light) {
        cardNewsBackup = light;
        data.cardNews = light;
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
  const clearObj = (o) => Object.keys(o).forEach((k) => delete o[k]);
  clearObj(detailCache);
  clearObj(detailPromises);
  tickerKoAliasIndex = null;
  tickerKoAliasEntries = null;
  tickerSearchIndex = null;
  // 종목별 실시간 캐시 — 티커 체계가 다른 시장으로 넘어가면 전부 무효.
  [liveNewsCache, liveChartCache, liveEarningsCache, liveSummaryCache, liveNewsSourceCache, liveFetched, liveDone].forEach(clearObj);
  liveStubs.clear();
  _chartItemCache = null;
  _inst13fIndex = null;
  _inst13fIndexSrc = null;
  _issuerTickerIndex = null;
  _issuerResolveCache.clear();
  _treemapPeerIndex = null;
  earningsCalendarCache = null;
  trustLoadAttempted.clear();
  clearFeatureDataFailures();
  _wsbTried = false;
  if (FEATURE_DATA.usDilution) FEATURE_DATA.usDilution.tried = false;
  signalsDirty = true;
  marketHeader.indices = [];
  marketHeader.indicesSource = null;
  if (typeof window.resetDisclosureTrackerCaches === "function") window.resetDisclosureTrackerCaches();

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
    // 커뮤니티는 IA 재편 후 숨은 5번째 탭 — 메뉴·⌘K·?tab=community 로만 연다.
    const hide = hiddenTabs.includes(btn.dataset.tab) || btn.dataset.tab === "community";
    btn.hidden = hide;
    btn.style.display = hide ? "none" : "";
  });
  document.querySelectorAll("#todaySubTabs .sub-tab[data-sub], #marketSubTabs .sub-tab[data-sub]").forEach((btn) => {
    setTabHidden(btn, hiddenTabs.includes(btn.dataset.sub));
  });
  if (currentTab && hiddenTabs.includes(currentTab)) activateTab("search", { push: false });
  // Market-aware placeholders + signal sections that have no KR data.
  const krMode = cfg.id === "kr";
  const setPh = (id, ph) => { const el = byId(id); if (el) el.placeholder = ph; };
  setPh("tickerSearch", krMode ? "종목명·종목코드·한국어 (예: 삼성전자, 005930)" : "한국어·티커·영문 (예: 테슬라, NVDA, Apple)");
  setPh("pfTicker", krMode ? "티커 (예: 005930)" : "티커 (예: NVDA)");
  setPh("pfCost", `평단가 ${cfg.currencySymbol || "$"}`);
  setPh("positionTicker", krMode ? "005930" : "NVDA");
  const sigIntro = byId("signalsIntro");
  if (sigIntro) {
    sigIntro.textContent = krMode
      ? "52주 신고가 근접 등 한국 시장 시그널을 한 화면에 모았습니다."
      : "내부자 클러스터 매수·52주 신고가 돌파·주요 공시(8-K)·액티비스트(13D)·신규 상장을 한 화면에 모았습니다.";
  }
  // 집계 인사이트(의회·내부자 종합)는 미국 전용 데이터 → KR에서는 빈 섹션이 되므로 숨긴다.
  const aggFold = byId("fold-aggInsights");
  const aggInsights = byId("aggInsights");
  if (aggFold) aggFold.hidden = krMode;
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
    instNav.querySelectorAll(".sub-tab").forEach((btn) => setTabHidden(btn, instSubHidden(btn.dataset.sub, cfg)));
    const instFallback = !instSubHidden("dart", cfg) ? "dart" : "events";
    if (instSubHidden(institutionalSubTab, cfg)) {
      activateInstitutionalSub(instFallback, { push: false });
    }
  }
  applySearchSubVisibility(cfg);
  const calendarNav = byId("calendarSubTabs");
  if (calendarNav) {
    // 키가 없는 시장(US)은 켜진 것으로 본다 — 이 파일의 다른 기능 판정과 같은 규칙.
    // 처음에 !cfg.features.earningsCalendar 로 썼다가 US 실적 탭까지 숨겼다.
    const earningsOff = featureOff("earningsCalendar", cfg);
    calendarNav.querySelectorAll(".sub-tab").forEach((btn) => setTabHidden(btn, btn.dataset.sub === "earnings" && earningsOff));
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
  // 여기서 data-theme 을 지우면 head 인라인 스크립트가 미리 적용한 다크 테마가
  // setupUiPrefs() 가 다시 붙일 때까지 라이트로 떨어져 화면이 번쩍인다(시장
  // 전환 시마다 재발). "다크모드 임시 제거" 시절(bec3096cce)의 잔재라 삭제했다 —
  // 테마는 head 스크립트와 setupUiPrefs 만 만진다.
  setupPwa();
  updateDataLoadedAt();
  renderCardNews();
  setupLightbox();
  setupChatbot();
  applyMarketHeader();
  setupViewMode(route.get("tab"));
  setupTabs();
  setupTabSemantics();
  setupIaShell();
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
  const routeTicker = route.get("ticker");
  const resolvedStart = initialTab ? normalizeTabRequest(initialTab, initialSub) : null;
  // 탭 콘텐츠는 여기서 처음 그린다(renderAll 은 탭 무관 표면만). 딥링크 탭이 없으면 현재 탭
  // (부팅 시 map, 시장 전환 시 보던 탭)만 그리고 나머지는 첫 진입 때 그린다.
  let activated = false;
  if (routeTicker && !initialTab) {
    // ?ticker= 단독 딥링크는 종목 리서치 화면(종목 탭)으로 바로 연다 — 원페이지 허브 URL.
    // selectTicker 가 탭 전환·렌더까지 한 번에 처리한다. tab= 이 함께 오면 그 탭을 존중한다.
    activated = selectTicker(routeTicker, { openSearch: true }) === true;
  } else if (routeTicker) {
    selectTicker(routeTicker, { openSearch: false, skipRender: true }); // 상태만 — 렌더는 아래 activateTab
  }
  if (!activated) {
    activateTab(resolvedStart ? resolvedStart.tab : (mapRoute ? "map" : currentTab), {
      push: false,
      sub: resolvedStart ? resolvedStart.sub : null,
      communityTicker: initialCommunityTicker,
    });
  }
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
      if (!res.ok) throw new Error(`chat ${res.status}`);
      const payload = await res.json();
      const reply = stripEmoji((payload && payload.reply) || "답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.");
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
  const row = (label, f, dec, suffix = "") => {
    const price = Number(f && f.price);
    if (!f || !Number.isFinite(price)) {
      const text = marketHeader.fxStatus === "error" ? "연결 실패" : "불러오는 중…";
      return `<div class="hx-row"><span>${label}</span><strong class="muted">${text}</strong></div>`;
    }
    const chg = Number(f.changePct);
    return `<div class="hx-row"><span>${label}</span><strong>${price.toFixed(dec)}${suffix}</strong><em class="${cls(chg)}">${Number.isFinite(chg) ? actionPct(chg) : "—"}</em></div>`;
  };
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
  const asOf = live && marketHeader.fng.source === "snapshot" && marketHeader.fng.asOf ? ` · 스냅샷 기준 ${marketHeader.fng.asOf}` : "";
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
        <span class="rf-fng" style="color:${color}">${escapeHtml(label)}${escapeHtml(asOf)}</span>
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
  renderTodayRegime();
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
let actionBoardMode = "actions"; // 뉴스 모드 DOM 은 남아 있지만 카드뉴스는 오늘 탭(renderTodayNews) 한 곳에서 보여준다
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
  if (title) title.textContent = isNews ? "오늘의 뉴스" : "내 종목 이벤트";
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

// ===== 이번 주 내 종목 이벤트 (관심 + 보유 종목의 D-7 일정 통합) =====
// US: 배당락·다음 실적(us_calendar) + 내부자 매수 클러스터(로드된 경우만 — heavy 라
// 이 카드가 3MB 를 당기지는 않는다). KR: 최근 2일 DART 공시. 데이터 전역이 늦게
// 도착해도 renderActionBoard 가 refreshFeatureViews 목록에 있어 다시 그려진다.
function myEventDday(iso, today) {
  const d = Math.round((new Date(`${iso}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000);
  return Number.isFinite(d) ? d : null;
}

function myEventBadge(dd) {
  if (dd == null) return "";
  if (dd === 0) return "D-DAY";
  if (dd > 0) return `D-${dd}`;
  return `${-dd}일 전`;
}

function myStockEventRows() {
  const tickers = [...new Set([
    ...watchlist,
    ...portfolio.map((p) => p.ticker),
  ].map((t) => normalizeTickerKey(t)).filter(Boolean))];
  if (!tickers.length) return [];
  const tickerSet = new Set(tickers);
  const today = formatKstDateTime().slice(0, 10);
  const events = [];
  if (!isKrMarket()) {
    const cal = (window.US_STOCK_CALENDAR || {}).stocks || {};
    tickers.forEach((t) => {
      const c = cal[t];
      if (!c) return;
      if (c.exDate && c.exDate >= today) {
        const dd = myEventDday(c.exDate, today);
        if (dd != null && dd <= 7) {
          const amt = Number.isFinite(Number(c.divRate)) ? ` $${c.divRate}` : "";
          events.push({ ticker: t, dd, label: `배당락${amt}`, tone: "info" });
        }
      }
      if (c.nextEarnings && c.nextEarnings >= today) {
        const dd = myEventDday(c.nextEarnings, today);
        if (dd != null && dd <= 7) events.push({ ticker: t, dd, label: "실적 발표", tone: dd <= 1 ? "warn" : "info" });
      }
    });
    // 내부자 매수 클러스터: INSIDER_TRADES 가 이미 로드돼 있을 때만(7일 · 매수 2건 이상)
    const trades = (window.INSIDER_TRADES || {}).trades;
    if (Array.isArray(trades) && trades.length) {
      const weekAgo = new Date(new Date(`${today}T00:00:00`).getTime() - 7 * 86400000).toISOString().slice(0, 10);
      const buyCount = {};
      trades.forEach((r) => {
        if (r.kind === "buy" && (r.fileDate || "") >= weekAgo && tickerSet.has(r.ticker)) {
          buyCount[r.ticker] = (buyCount[r.ticker] || 0) + 1;
        }
      });
      Object.entries(buyCount).forEach(([t, n]) => {
        if (n >= 2) events.push({ ticker: t, dd: 0, label: `내부자 매수 ${n}건 · 7일`, tone: "warn", badge: "클러스터" });
      });
    }
  } else {
    const disc = (window.KR_DISCLOSURES || {}).disclosures || [];
    const cutoff = new Date(new Date(`${today}T00:00:00`).getTime() - 2 * 86400000).toISOString().slice(0, 10);
    const seen = {};
    disc.forEach((d) => {
      if (!tickerSet.has(d.ticker) || (d.fileDate || "") < cutoff) return;
      const key = `${d.ticker}|${d.typeLabel || d.title}`;
      if (seen[key]) return;
      seen[key] = true;
      events.push({ ticker: d.ticker, dd: myEventDday(d.fileDate, today) ?? 0, label: d.typeLabel || d.title || "공시", tone: "info", badge: "공시" });
    });
  }
  events.sort((a, b) => a.dd - b.dd || a.ticker.localeCompare(b.ticker));
  // 4건 상한 — 다른 카드와 같은 높이를 유지해, 늦게 도착해도 그리드 행 높이를 안 바꾼다.
  return events.slice(0, 4).map((ev) => {
    const item = stockByTicker(ev.ticker);
    const name = isKrMarket() ? (item?.company || ev.ticker) : ev.ticker;
    const sub = isKrMarket() ? ev.label : `${item?.company ? `${item.company} · ` : ""}${ev.label}`;
    return `<button type="button" class="daily-action-row" data-action-ticker="${escapeHtml(ev.ticker)}">
      <span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(sub)}</small></span>
      <em class="${ev.tone}">${escapeHtml(ev.badge || myEventBadge(ev.dd))}</em>
    </button>`;
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
  const myEventRows = myStockEventRows();
  const attentionCount = alerts.length + scheduleRows.length + filingRows.filter((row) => row.includes('class="warn"')).length;
  const count = byId("dailyActionCount");
  if (count) count.textContent = attentionCount ? `우선 확인 ${attentionCount}건` : "새 긴급 항목 없음";
  const alertOrPortfolio = alerts.length
    ? alerts.map(({ item, reasons }) => actionStockRow(item, reasons.join(" · ")))
    : portfolioRows;
  // 이벤트 카드가 늦게(usCalendar·krDart 는 idle 프리로드) 도착해도 그리드가 한 줄을
  // 넘지 않게 총 5칸을 유지한다: US 는 이벤트 카드가 생기면 일정 카드를 1칸으로 줄이고
  // (1+1+1+1+1), 공시 카드가 없는 KR 은 일정 2칸을 유지한다(1+1+2+1). 새 행이 생기면
  // 딥링크 스크롤(scrollToTabContent) 뒤에 본문이 밀리는 레이아웃 시프트가 난다.
  const scheduleWide = !myEventRows.length || !showFilings;
  grid.innerHTML =
    actionBoardCard("관심종목 변동", "등락폭이 큰 순서", movers.map((item) => actionStockRow(item, item.company)), "관심종목을 추가하면 변동을 추적합니다.", { tab: "bulk" }) +
    actionBoardCard(alerts.length ? "조건 감지" : "내 포트폴리오", alerts.length ? "저장한 조건에 맞는 종목" : "평가손익 상위 보유 종목", alertOrPortfolio, "조건 감지 또는 보유 종목이 없습니다.", { tab: "bulk" }) +
    actionBoardCard("다가오는 일정", "경제지표와 관심종목 실적", scheduleRows, "가까운 일정이 아직 없습니다.", { tab: "calendar" }, scheduleWide ? "is-wide" : "") +
    (showFilings ? actionBoardCard("새 공시", isKrMarket() ? "관심종목 우선 · DART" : "관심종목 우선 · SEC 8-K", filingRows, "새로 확인할 주요 공시가 없습니다.", { tab: "institutional", sub: "events" }) : "") +
    // 이벤트가 하나도 없으면 카드 자체를 그리지 않는다 — 빈 껍데기 금지.
    (myEventRows.length ? actionBoardCard("이번 주 내 종목 이벤트", isKrMarket() ? "관심·보유 종목 최근 2일 공시" : "관심·보유 종목 D-7 일정", myEventRows, "", { tab: "calendar" }) : "");
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
    const price = Number(proxy?.price);
    return {
      symbol: ix.symbol,
      name: ix.name,
      // 0 은 '가격 없음' 이다 — 0 으로 찍지 말고 null → "—".
      price: Number.isFinite(price) && price > 0 ? price : null,
      changePct: ix.changePct ?? proxy?.changePct ?? 0,
      series: proxy?.closeSeries || [],
    };
  }).filter((ix) => ix.name);
  if (items.length) setHeaderIndices(items, "snapshot");
}

// 오늘 탭에는 지수 3개(S&P·Nasdaq·KOSPI, KR 은 KOSPI·KOSDAQ·S&P)만, 시장/시장 폭에는 전부.
const TODAY_INDEX_ORDER = { us: ["^GSPC", "^IXIC", "^KS11"], kr: ["^KS11", "^KQ11", "^GSPC"] };
function pickTodayIndices(indices) {
  const order = TODAY_INDEX_ORDER[isKrMarket() ? "kr" : "us"];
  const picked = order.map((sym) => indices.find((ix) => ix.symbol === sym)).filter(Boolean);
  indices.forEach((ix) => { if (picked.length < 3 && !picked.includes(ix)) picked.push(ix); });
  return picked.slice(0, 3);
}

function renderIndexStrip(indices) {
  const el = byId("indexStrip");
  if (!el) return;
  const full = byId("indexStripFull");
  if (!indices || !indices.length) { el.innerHTML = ""; if (full) full.innerHTML = ""; return; }
  // In KR mode, lead with KOSPI/KOSDAQ; the worker's index list is US-first.
  if (isKrMarket()) {
    const krOrder = ["^KS11", "^KQ11"];
    indices = [...indices].sort((a, b) => {
      const ai = krOrder.indexOf(a.symbol), bi = krOrder.indexOf(b.symbol);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }
  if (full) renderIndexStripInto(full, indices);
  renderIndexStripInto(el, pickTodayIndices(indices));
}

function renderIndexStripInto(el, indices) {
  el.innerHTML = indices.map((ix) => {
    const analysisTicker = indexAnalysisTicker(ix.symbol);
    const clickable = !!analysisTicker;
    return `
    <div class="index-card${clickable ? " index-card-clickable" : ""}"${clickable ? ` data-ticker="${escapeHtml(analysisTicker)}" role="button" tabindex="0" title="${escapeHtml(ix.name)} → ${escapeHtml(analysisTicker)} 종목 분석"` : ""}>
      <div class="index-head">
        <strong>${escapeHtml(ix.name)}</strong>
        <em class="${cls(ix.changePct)}">${fmtPct(ix.changePct)}</em>
      </div>
      <div class="index-price">${Number.isFinite(Number(ix.price)) && ix.price != null ? Number(ix.price).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}</div>
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
  // 비교자 안에서 매번 날짜를 파싱하지 않도록 키를 한 번만 만든다(n log n 회 → n 회).
  const keyed = [...(macroEvents || []), ...(whEvents || [])]
    .map((ev) => ({ ev, iso: calendarIsoFromEvent(ev), time: String(ev.time || "") }));
  keyed.sort((a, b) => (a.iso !== b.iso ? a.iso.localeCompare(b.iso) : a.time.localeCompare(b.time)));
  return keyed.map((k) => k.ev);
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
        <table class="cal-table table-wide">
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

// ===== 2026-09 IA 재편: 상단 탭 4개(오늘·시장·종목·내 투자) + 숨은 커뮤니티 =====
// currentTab 은 여전히 '잎(leaf)' 이름(map/sector/health/signals/calendar/ai-briefing/…)을
// 가진다 — 렌더러·피처 게이트·딥링크가 전부 이 이름을 보기 때문이다. 상단 탭 버튼은
// 그룹(today/market/search/bulk/community)이고, 잎은 그룹 패널 안의 .tab-leaf 로 보인다.
const TAB_GROUP_OF = {
  today: "today", calendar: "today", "ai-briefing": "today",
  map: "market", sector: "market", health: "market", signals: "market",
  search: "search", bulk: "bulk", community: "community",
};
const GROUP_LEAVES = {
  today: ["today", "ai-briefing", "calendar"],
  market: ["map", "sector", "health", "signals"],
};
// 그룹 탭을 눌렀을 때 돌아갈 마지막 잎(첫 방문은 첫 잎).
const lastGroupLeaf = { today: "today", market: "map" };
function leafPanelId(name) {
  return name === "today" ? "tab-today-summary" : `tab-${name}`;
}
// 잎/그룹 이름으로 실제 버튼(상단 탭 또는 그룹 안 서브탭)을 찾는다 — data-advanced 판정용.
function tabButtonFor(name) {
  const group = TAB_GROUP_OF[name] || name;
  const leafBtn = GROUP_LEAVES[group] ? document.querySelector(`#${group}SubTabs [data-sub="${name}"]`) : null;
  return leafBtn || document.querySelector(`#mainTabs [data-tab="${group}"]`);
}
let currentTab = "today";
let searchSubTab = "analysis";
// 종목 탭 서브탭은 4개(분석·찾기·비교·공시)지만 searchSubTab 은 잎 이름(top/screener/…/13f/…)을
// 유지한다 — 렌더 분기와 ?tab=search&sub= 딥링크가 그 이름을 쓴다. 그룹은 여기서 계산한다.
const FIND_SUBS = ["top", "screener", "scanner", "jump", "valuation"];
const DISC_SEARCH_SUBS = ["buyback", "earnreact", "dividend", "contract", "dilution", "short"];
const INST_SUBS = ["13f", "congress", "insider", "activist", "events", "ipo", "dart", "krown"];
// 공시 세그먼트 표시 순서(자사주 … IPO, KR: DART·5%룰·임원·지배구조)
const DISC_ORDER = ["buyback", "earnreact", "dividend", "contract", "dilution", "short", "13f", "congress", "insider", "activist", "events", "ipo", "dart", "krown"];
let lastFindSub = "top";
let lastDiscSub = null;
let discKrownKind = "major";
function searchSubGroup(sub) {
  if (FIND_SUBS.includes(sub)) return "find";
  if (DISC_SEARCH_SUBS.includes(sub) || INST_SUBS.includes(sub)) return "disclosures";
  if (sub === "compare") return "compare";
  return "analysis";
}
function discSubHidden(sub, cfg = marketCfg()) {
  return INST_SUBS.includes(sub) ? instSubHidden(sub, cfg) : searchSubTabHidden(sub, cfg);
}
function defaultDiscSub(cfg = marketCfg()) {
  return DISC_ORDER.find((s) => !discSubHidden(s, cfg)) || "events";
}
function disclosureViewActive() {
  return currentTab === "search" && INST_SUBS.includes(searchSubTab) && searchSubTab === institutionalSubTab;
}
// KR 전용(krDart) 종목검색 서브탭 — US 에선 가시성 게이트가 숨긴다.
const KR_DART_SUBTABS = new Set(["buyback", "earnreact", "dividend", "contract", "dilution"]);
// dividend·earnreact 는 US 자체 데이터(us_calendar·analyst_consensus+details)가 생겨
// 양시장 탭이 됐다. US 에선 항상 표시, KR 에선 종전대로 krDart 게이트를 따른다.
// buyback·dilution 도 US 데이터(8-K kind / us_dilution.js)가 생겨 양시장 탭이지만,
// 그 데이터가 아직 없으면 US 에선 탭 자체를 숨긴다 — 없는 데이터는 기능을 끈다.
const DUAL_MARKET_SUBTABS = new Set(["dividend", "earnreact", "buyback", "dilution"]);
function usBuybackRows() {
  return ((window.MATERIAL_EVENTS || {}).events || []).filter((e) => e && e.kind === "buyback");
}
function searchSubTabHidden(sub, cfg) {
  if (sub === "short") return featureOff("shortInterest", cfg);
  if (!KR_DART_SUBTABS.has(sub)) return false;
  if (DUAL_MARKET_SUBTABS.has(sub) && cfg.id === "us") {
    if (sub === "buyback") return !usBuybackRows().length;
    if (sub === "dilution") return !((window.US_DILUTION || {}).rows || []).length;
    return false;
  }
  // 나머지는 KR DART 전용 — US 에선 언제나 숨긴다.
  return cfg.id !== "kr" || featureOff("krDart", cfg);
}

// 종목검색 서브탭 표시/숨김을 현재 데이터 상태로 다시 적용한다. 부팅(시장 전환)과
// 피처 데이터 늦은 도착(refreshFeatureViews) 두 곳에서 부른다.
function applySearchSubVisibility(cfg = marketCfg()) {
  const searchNav = byId("searchSubTabs");
  if (!searchNav) return;
  // 공시 세그먼트: 검색 소유(자사주·배당…)와 SEC/DART 소유(13F·정치인…)를 한 줄에서 게이트한다.
  const disc = byId("discSubTabs");
  if (disc) {
    disc.querySelectorAll("[data-disc]").forEach((btn) => setTabHidden(btn, discSubHidden(btn.dataset.disc, cfg)));
    setTabHidden(searchNav.querySelector('[data-sub="disclosures"]'), !DISC_ORDER.some((s) => !discSubHidden(s, cfg)));
  }
  if (searchSubGroup(searchSubTab) === "disclosures" && discSubHidden(searchSubTab, cfg)) {
    lastDiscSub = null;
    activateSearchSub("disclosures", { push: false });
  } else if (searchSubTabHidden(searchSubTab, cfg)) {
    activateSearchSub("analysis", { push: false });
  }
}
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
  if (tab === "bulk") return bulkSubTab;
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
  if (state.ticker) selectTicker(state.ticker, { openSearch: false, skipRender: true }); // 렌더는 아래 activateTab 이 한 번
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
let _appDialogSeq = 0; // 다이얼로그가 겹칠 수 있어 제목 id 를 고유하게
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
      dlg.setAttribute("aria-labelledby", (h.id = `appDialogTitle-${++_appDialogSeq}`));
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
  // 구 URL 별칭 — 예전 10탭 이름은 전부 새 IA 의 잎으로 떨어진다.
  institutional: { tab: "search", sub: "disclosures" },
  disclosures: { tab: "search", sub: "disclosures" },
  find: { tab: "search", sub: "find" },
  breadth: { tab: "health", sub: null },
  marketdata: { tab: "health", sub: null },
  heatmap: { tab: "map", sub: null },
  briefing: { tab: "ai-briefing", sub: null },
  stocks: { tab: "search", sub: null },
  portfolio: { tab: "bulk", sub: null },
  tools: { tab: "bulk", sub: "tools" },
};

function normalizeTabRequest(name, sub) {
  const redirect = TAB_REDIRECT[name];
  if (redirect) return { tab: redirect.tab, sub: sub || redirect.sub };
  // 그룹 탭(today/market): ?sub= 가 그 그룹의 잎이면 그 잎으로, 아니면 마지막 잎으로.
  if (GROUP_LEAVES[name]) {
    if (sub && GROUP_LEAVES[name].includes(sub)) return { tab: sub, sub: null };
    if (sub && TAB_REDIRECT[sub] && GROUP_LEAVES[name].includes(TAB_REDIRECT[sub].tab)) return { tab: TAB_REDIRECT[sub].tab, sub: null };
    return { tab: lastGroupLeaf[name] || GROUP_LEAVES[name][0], sub: sub || null };
  }
  return { tab: name, sub: sub || null };
}

function activateSearchSub(name, { push = false, skipRender = false, renderOptions = null, krownKind = null } = {}) {
  // 그룹 이름으로 오면 그 그룹의 마지막 잎으로 푼다(찾기→상위 종목, 공시→첫 가시 공시).
  if (name === "find") name = lastFindSub;
  if (name === "disclosures") name = lastDiscSub || defaultDiscSub();
  if (name && name.startsWith("krown:")) { krownKind = name.slice(6); name = "krown"; }
  searchSubTab = name || "analysis";
  const group = searchSubGroup(searchSubTab);
  if (group === "find") lastFindSub = searchSubTab;
  if (group === "disclosures") lastDiscSub = searchSubTab;
  if (searchSubTab === "krown" && krownKind) discKrownKind = krownKind;
  const nav = byId("searchSubTabs");
  if (nav) {
    nav.querySelectorAll(".sub-tab").forEach((btn) => btn.classList.toggle("is-active", btn.dataset.sub === group));
    document.querySelectorAll("#tab-search .sub-panel").forEach((panel) => panel.classList.remove("is-active"));
    byId(`sub-${group}`)?.classList.add("is-active");
    if (group !== "analysis" && group !== "compare") byId(`sub-${searchSubTab}`)?.classList.add("is-active");
    byId("findModeSeg")?.querySelectorAll("[data-find]").forEach((btn) => btn.classList.toggle("is-active", btn.dataset.find === searchSubTab));
    byId("discSubTabs")?.querySelectorAll("[data-disc]").forEach((btn) => {
      const on = btn.dataset.disc === searchSubTab && (searchSubTab !== "krown" || (btn.dataset.krownKind || "major") === discKrownKind);
      btn.classList.toggle("is-active", on);
    });
    if (typeof syncFindPreset === "function") syncFindPreset();
  }
  if (INST_SUBS.includes(searchSubTab)) {
    activateInstitutionalSub(searchSubTab, { push: false });
    if (searchSubTab === "krown") {
      const kindBtn = byId("krOwnKinds")?.querySelector(`[data-krown="${discKrownKind}"]`);
      if (kindBtn && !kindBtn.classList.contains("is-active")) kindBtn.click();
    }
    if (push) recordNav();
    return;
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
  if (searchSubTab === "analysis" && !skipRender) renderSearch(renderOptions || {});
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
  // Only fetch the (often multi-MB) dataset when the 공시 view is actually
  // active — not during the boot pre-render (renderAll) or a hidden fallback.
  const load = disclosureViewActive();
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
  // '오늘의 뉴스' 서브탭은 IA 재편으로 삭제(카드뉴스는 오늘 탭 한 곳) — 옛 링크는 트렌딩으로.
  if (name === "sns" || name === "news") name = "trending";
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
    // WSB 댓글 감성 표는 AI 브리핑에서 커뮤니티 트렌딩으로 옮겨 왔다(소셜 표 한 벌만 유지).
    renderSocialSentiment();
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
  const requestedButton = requestedTab ? tabButtonFor(normalizeTabRequest(requestedTab, null).tab) : null;
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
// 라이브에서는 히어로 검색·카드뉴스 이미지가, 그리고 idle 프리로드(2500ms) 피처
// 데이터가 액션 보드 카드를 늦게 추가하는 경우가 2.4초보다 늦게 레이아웃을 키워
// 딥링크 스크롤이 목적지에 못 미쳤다(2026-07-23 smoke 실측 328px). 재정렬은
// 목표와 4px 이상 어긋났을 때만 발동하므로 창을 길게 잡아도 화면이 튀지 않는다.
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
  let resizeObs = null;
  const stop = () => {
    if (timer) { clearInterval(timer); timer = null; }
    if (resizeObs) { resizeObs.disconnect(); resizeObs = null; }
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

  // 고정 시간창(위 interval)만으로는 부족하다 — idle 프리로드 피처(액션 보드
  // 이벤트 카드·매크로 추이 행 등)가 느린 네트워크에서 창이 닫힌 뒤에 상단
  // 레이아웃을 키우면 탭 바가 다시 밀려 내려간다(상수를 2.4s→6s 로 늘려도
  // 라이브에서 재발한 이력, 2026-07-24). 문서 높이가 실제로 바뀔 때만 재정렬
  // 하도록 ResizeObserver 를 추가로 건다. 사용자 입력 시 위 stop 이 함께 끊고,
  // 관찰은 최장 20초 뒤 자동 해제한다.
  if (typeof ResizeObserver === "function") {
    resizeObs = new ResizeObserver(() => {
      if (Math.abs(window.pageYOffset - targetY()) > 4) align();
    });
    resizeObs.observe(document.body);
    setTimeout(() => { if (resizeObs) { resizeObs.disconnect(); resizeObs = null; } }, 20000);
  }
}

function activateTab(name, { push = true, ticker = null, sub = null, communityTicker = null, skipRender = false, renderOptions = null } = {}) {
  const resolved = normalizeTabRequest(name, sub);
  name = resolved.tab;
  sub = resolved.sub;
  // Tabs hidden for this market (e.g. KR 거장 포트폴리오) fall back to 종목 검색.
  if ((marketCfg().hiddenTabs || []).includes(name)) { name = "search"; sub = null; }
  const group = TAB_GROUP_OF[name] || name;
  const tabBtn = document.querySelector(`#mainTabs [data-tab="${group}"]`);
  if (!tabBtn) return;
  const leafBtn = tabButtonFor(name);
  if ((tabBtn.dataset.advanced === "true" || leafBtn?.dataset.advanced === "true") && currentViewMode !== "advanced") setViewMode("advanced");
  document.querySelectorAll("#mainTabs .tab").forEach((item) => item.classList.remove("is-active"));
  document.querySelectorAll("main > .panel").forEach((panel) => panel.classList.remove("is-active"));
  tabBtn.classList.add("is-active");
  const groupPanel = byId(`tab-${group}`);
  groupPanel?.classList.add("is-active");
  // 그룹 안의 잎 전환(오늘: 요약/브리핑/캘린더, 시장: 트리맵/섹터/시장폭/시그널)
  if (GROUP_LEAVES[group]) {
    lastGroupLeaf[group] = name;
    groupPanel?.querySelectorAll(":scope > .tab-leaf").forEach((leaf) => leaf.classList.remove("is-active"));
    byId(leafPanelId(name))?.classList.add("is-active");
    byId(`${group}SubTabs`)?.querySelectorAll(".sub-tab").forEach((btn) => btn.classList.toggle("is-active", btn.dataset.sub === name));
  }
  scrollTabIntoView(tabBtn);
  currentTab = name;
  if (name === "sector" && sub) byId("sectorSubTabs")?.querySelector(`[data-sub="${sub}"]`)?.click();
  if (name === "bulk") activateBulkSub(sub || bulkSubTab, { push: false });
  if (name === "health") renderIndexStrip(marketHeader.indices);
  // 첫 진입 탭은 여기서 처음 그린다(부팅 때 전 탭을 그리지 않는다 — renderAll 참고).
  renderTabContent(name);
  // US 증자·희석 데이터는 종목검색 서브탭에서만 쓰므로 탭 첫 진입 때 한 번만 시도.
  // 파일이 아직 배포 전이면 조용히 실패하고 서브탭이 숨은 채 유지된다.
  if (name === "search" && !isKrMarket() && !window.US_DILUTION && FEATURE_DATA.usDilution && !FEATURE_DATA.usDilution.tried) {
    FEATURE_DATA.usDilution.tried = true;
    ensureFeatureData("usDilution").then((ok) => { if (ok) applySearchSubVisibility(); });
  }
  if (name === "search") activateSearchSub(sub || searchSubTab, { push: false, skipRender, renderOptions });
  if (name === "calendar") activateCalendarSub(sub || calendarSubTab, { push: false });
  if (name === "institutional") activateInstitutionalSub(sub || institutionalSubTab, { push: false });
  if (name === "community") activateCommunitySub(sub || communitySubTab, { push: false, communityTicker });
  if (name !== "community") stopCommunityPolling();
  if (name === "map") renderTreemap();
  if (name === "signals") {
    // 한 번만 그린다(예전엔 진입마다 renderSignals + 데이터셋별 .then 렌더 ~10개 = 최대 15회).
    if (signalsDirty || !tabRendered.signals) renderSignalsIfVisible();
    // 아직 안 온 데이터셋만 요청하고, 도착은 refreshFeatureViews(250ms 디바운스) 한 번으로 합쳐 그린다.
    SIGNALS_FEATURE_KEYS.forEach((k) => {
      const meta = FEATURE_DATA[k];
      if (!meta || window[meta.global] || _featureDataFailed[k] || !featureDataEnabled(meta, marketCfg())) return;
      ensureFeatureData(k).then((ok) => { if (ok) scheduleFeatureViewRefresh(); });
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
  { nav: "todaySubTabs", attr: "data-sub", panelId: leafPanelId },
  { nav: "marketSubTabs", attr: "data-sub", panelId: leafPanelId },
  { nav: "bulkSubTabs", attr: "data-sub", panelId: (v) => `sub-bulk-${v}` },
  { nav: "findModeSeg", attr: "data-find", panelId: (v) => `sub-${v}` },
  { nav: "discSubTabs", attr: "data-disc", panelId: (v) => (INST_SUBS.includes(v) ? `sub-inst-${v}` : `sub-${v}`) },
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
      // 한 패널을 여러 탭이 가리킬 수 있다(공시 세그먼트의 5%룰·임원·지배구조 → sub-inst-krown).
      // aria-labelledby 는 id 목록을 허용하므로 덮어쓰지 않고 붙인다.
      const labelled = (panel.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean);
      if (!labelled.includes(btn.id)) labelled.push(btn.id);
      panel.setAttribute("aria-labelledby", labelled.join(" "));
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
const TAB_ORDER_KEY = "mir_tab_order_v2"; // v1 은 10탭 시절 이름 — 4탭 IA 와 섞이지 않게 키를 올렸다
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
    // 누르고 있는 동안만 window 에 붙인다 — 상시 pointermove 리스너는 스크롤마다 불렸다.
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
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
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
  }

  // 모바일 롱프레스 시 뜨는 컨텍스트 메뉴/선택 방지
  nav.addEventListener("contextmenu", (e) => { if (dragging) e.preventDefault(); });
  nav.addEventListener("pointerdown", onDown);
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
  // 히트맵 검색도 크로스마켓: 현재 시장에 없는 반대 시장 종목이면(Enter)
  // 시장을 전환한 뒤 트리맵에서 해당 종목을 포커스한다.
  byId("heatmapSearch").addEventListener("keydown", async (event) => {
    if (event.key !== "Enter") return;
    const q = byId("heatmapSearch").value.trim();
    if (!q || resolveTickerQuery(q)) return; // 현재 시장에서 찾으면 기존 흐름 유지
    const target = classifyQueryMarket(q);
    if (!target || target === marketCfg().id) return;
    event.preventDefault();
    await switchMarketMode(target);
    const ticker = extractStockTickerFromQuery(q) || resolveTickerQuery(q);
    if (ticker) focusTreemapTicker(ticker, { push: false, openMap: true });
  });
  byId("resetFilters").addEventListener("click", () => {
    byId("bucketFilter").value = marketCfg().defaultBucket || "idx_sp500";
    byId("sectorFilter").value = "All";
    byId("metricFilter").value = "changePct";
    byId("tileSizeFilter").value = "marketCapB";
    byId("heatmapSearch").value = "";
    renderTreemap();
  });
  ["topMetric", "topBucket", "topSector", "topNewHighRecency", "topNewHigh", "topMinRs", topMaxRsiInputId(), "topMinVolume", "topMinMarketCap", "topLimit"].forEach((id) => {
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
        if (currentTab !== "search") activateTab("search", { push: false });
        activateSearchSub(btn.dataset.sub, { push: true });
      });
    });
  }
  // IA 재편 그룹 서브탭(오늘·시장·내 투자) + 종목 안 찾기 세그먼트·공시 세그먼트
  ["today", "market"].forEach((group) => {
    byId(`${group}SubTabs`)?.querySelectorAll(".sub-tab").forEach((btn) => {
      btn.addEventListener("click", () => activateTab(btn.dataset.sub, { push: btn.dataset.sub !== currentTab }));
    });
  });
  byId("bulkSubTabs")?.querySelectorAll(".sub-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (currentTab !== "bulk") activateTab("bulk", { push: false });
      activateBulkSub(btn.dataset.sub, { push: true });
    });
  });
  byId("findModeSeg")?.querySelectorAll("[data-find]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (currentTab !== "search") activateTab("search", { push: false });
      activateSearchSub(btn.dataset.find, { push: true });
    });
  });
  byId("discSubTabs")?.querySelectorAll("[data-disc]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (currentTab !== "search") activateTab("search", { push: false });
      activateSearchSub(btn.dataset.disc, { push: true, krownKind: btn.dataset.krownKind || null });
    });
  });

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
  byId("stockTreemap").addEventListener("click", handleHeatmapClick);
  setupTreemapVisibilityWatch();
  setupChartControls();
  setupWatchAlertEvents();
  setupCloudSyncEvents();
  setupKrDartEvents();
  setupKrOwnershipEvents();
  byId("heatmapShare")?.addEventListener("click", shareHeatmapLink);
  byId("pfExportCsv")?.addEventListener("click", exportPortfolioCsv);
  byId("pfImportCsv")?.addEventListener("click", () => byId("pfImportFile")?.click());
  byId("pfImportFile")?.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importPortfolioCsv(String(reader.result || ""));
    reader.readAsText(file);
  });
  byId("shareTickerLink")?.addEventListener("click", () => {
    if (!selectedTicker) { showAppToast("먼저 종목을 선택하세요."); return; }
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("market", marketCfg().id);
    url.searchParams.set("ticker", selectedTicker);
    navigator.clipboard?.writeText(url.toString())
      .then(() => showAppToast("종목 링크를 복사했습니다."))
      .catch(() => showAppToast("복사에 실패했습니다 — 주소창 URL을 사용하세요."));
  });
  byId("backtestExportCsv")?.addEventListener("click", exportBacktestCsv);
  // 기업집단 계열사 칩 — stockFacts 는 여러 곳에서 innerHTML 로 갈리므로 위임 바인딩.
  document.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-group-ticker]");
    if (chip) selectTicker(chip.dataset.groupTicker, { openSearch: true });
  });
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


// 탭별 첫 렌더 플래그. 예전 renderAll 은 부팅 때 9개 탭을 전부 동기로 그렸다(기본 종목의
// 워커 실시간 조회까지 부팅에 딸려 들어갔다). 이제 탭과 무관한 표면만 그리고, 탭 콘텐츠는
// 첫 진입(activateTab → renderTabContent) 때 그린다. 시장 전환(boot 재실행)마다 리셋된다.
const tabRendered = {};
const TAB_RENDERERS = {
  sector: () => renderSectors(),
  bulk: () => { renderBulk(); renderMyInvestSummary(); },
  health: () => renderHealth(),
  "ai-briefing": () => renderAiBriefing(),
  // map(폭 의존이라 진입마다)·signals(dirty 플래그)·search/institutional/calendar/community
  // (서브탭 활성화가 그림)는 activateTab 이 직접 처리한다.
};
function renderTabContent(name, { force = false } = {}) {
  if (!force && tabRendered[name]) return;
  tabRendered[name] = true;
  const fn = TAB_RENDERERS[name];
  if (fn) fn();
}

function renderAll() {
  Object.keys(tabRendered).forEach((k) => delete tabRendered[k]);
  signalsDirty = true;
  // 탭과 무관하게 항상 보이는 표면
  renderWatchlistBar();
  renderWatchAlerts();
  renderActionBoard();
  renderDataFreshnessStatus();
  // 오늘 탭 요약(국면 한 문장·카드뉴스 1장)은 부팅 탭이라 여기서 그린다.
  renderTodayRegime();
  renderTodayNews();
  renderMyInvestSummary();
}



function renderSelected(item) {
  byId("selectedStock").innerHTML = stockFacts(item, "선택 종목");
}


function stockFacts(item, title) {
  return `
    <span class="muted">${title}</span>
    <h3 class="stock-facts-head">${watchStarButton(item.ticker)} ${escapeHtml(item.ticker)} ${syntheticBadge(item)}</h3>
    <p class="muted">${escapeHtml(item.company ?? "")} · ${escapeHtml(item.sector ?? "")} · ${escapeHtml(item.industry ?? "")}</p>
    ${item.__liveStub ? `<p class="muted">${liveDone[item.ticker] ? (liveChartCache[item.ticker] ? "스냅샷에 없는 종목 — 실시간 데이터만 표시" : "스냅샷에 없는 종목 — 실시간 데이터도 없음") : "스냅샷에 없는 종목 — 실시간 조회 중…"}</p>` : ""}
    ${auditOpinionNotice(item)}
    ${krFlowCard(item)}
    ${krGroupCard(item)}
    ${krNpsCard(item)}
    ${krConsensusCard(item)}
    <div class="facts">
      ${fact("가격", priceOrDash(item.price))}
      ${fact("당일", `<span class="${cls(item.changePct)}">${fmtDailyPct(item.changePct)}</span>`)}
      ${fact("1개월", `<span class="${cls(item.monthChangePct)}">${fmtPct(item.monthChangePct)}</span>`)}
      ${fact("RSI", fmtRsi(item))}
      ${fact("EPS", fmtEps(item))}
      ${fact("거래량", Number.isFinite(Number(item.volumeRatio)) ? `${Number(item.volumeRatio).toFixed(1)}x` : "—")}
      ${fact("StochK", Number.isFinite(Number(item.stochK)) ? Math.round(Number(item.stochK)) : "—")}
      ${fact("신고가 거리", Number.isFinite(Number(item.newHighDistancePct)) ? fmtPct(-Number(item.newHighDistancePct)) : "—")}
    </div>
  `;
}

function fact(label, value) {
  return `<div class="fact"><span>${label}</span><strong>${value}</strong></div>`;
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
    // 평균 RSI(14) — 실측값만 평균(합성/결측 제외). 값이 없으면 null.
    const rsiVals = rows.map((item) => rsiValue(item)).filter((v) => v != null);
    const rs = rsiVals.length ? rsiVals.reduce((sum, v) => sum + v, 0) / rsiVals.length : null;

    const upCount = rows.filter((item) => item.changePct > 0).length;
    const downCount = rows.filter((item) => item.changePct < 0).length;
    const upPct = rows.length ? (upCount / rows.length) * 100 : 0;

    // Top 3 sector leaders by 3-month momentum (RS 합성 점수 대체)
    const topLeaders = [...rows]
      .sort((a, b) => (Number(b.threeMonthChangePct) || 0) - (Number(a.threeMonthChangePct) || 0))
      .slice(0, 3);
      
    return { ...meta, avg, avg1w, avg1m, avg3m, rs, upCount, downCount, upPct, count: rows.length, topLeaders };
  });

  // Sort groups (평균 RSI 는 결측 시 null → 맨 뒤로)
  const sortKey = (g) => (Number.isFinite(Number(g[sortBy])) ? Number(g[sortBy]) : -Infinity);
  groups.sort((a, b) => sortKey(b) - sortKey(a));

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
            <span class="tf-lbl">평균 RSI</span>
            <span class="tf-val rs-badge">${item.rs == null ? "—" : Math.round(item.rs)}</span>
          </div>
        </div>
        
        <!-- Sector Leaders list -->
        <div class="sector-leaders-section">
          <span class="lbl-sub">주도주 (3개월 모멘텀순)</span>
          <div class="leader-chips">
            ${item.topLeaders.map(stock => `
              <span class="leader-chip" data-ticker="${stock.ticker}">
                <strong class="ticker">${escapeHtml(stock.ticker)}</strong>
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
  
  const rsiVals = rows.map((item) => rsiValue(item)).filter((v) => v != null);
  const avgRsi = rsiVals.length ? rsiVals.reduce((sum, v) => sum + v, 0) / rsiVals.length : null;
  const upCount = rows.filter((item) => item.changePct > 0).length;
  const upPct = rows.length ? (upCount / rows.length) * 100 : 0;

  byId("sectorDetailRs").textContent = avgRsi == null ? "—" : Math.round(avgRsi);
  byId("sectorDetailUpPct").textContent = `${Math.round(upPct)}%`;
  byId("sectorConstituentsCount").textContent = `${rows.length}개 종목`;

  // Render constituents table — RSI(14) 내림차순(결측은 뒤로)
  const sortedRows = [...rows].sort((a, b) => (rsiValue(b) ?? -Infinity) - (rsiValue(a) ?? -Infinity));
  byId("sectorConstituentsBody").innerHTML = sortedRows.map((stock, index) => `
    <tr class="constituent-row" data-ticker="${stock.ticker}" style="cursor: pointer;">
      <td class="rank-cell">${index + 1}</td>
      <td><strong>${escapeHtml(stock.ticker)}</strong></td>
      <td>${escapeHtml(stock.company ?? "")}</td>
      <td>${marketCfg().formatPrice(stock.price)}</td>
      <td class="${cls(stock.changePct)}">${fmtDailyPct(stock.changePct)}</td>
      <td class="${cls(stock.weekChangePct)}">${fmtPct(stock.weekChangePct)}</td>
      <td class="${cls(stock.monthChangePct)}">${fmtPct(stock.monthChangePct)}</td>
      <td><span class="rs-badge">${fmtRsi(stock)}</span></td>
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
      summaryValueEl.textContent = fmtSignedPct(relDiff, 2, "%p");
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
  const minRsi = numberInputValue("topMinRs", 0);
  const maxRsi = numberInputValue(topMaxRsiInputId(), 0);
  const minVolume = numberInputValue("topMinVolume", 0);
  const minMarketCap = numberInputValue("topMinMarketCap", 0);
  const limit = Math.max(1, numberInputValue("topLimit", 24));
  const preset = byId("topPreset")?.value || "custom";
  const rows = data.stocks
    .filter((item) => bucketMatches(item, item.groups || [item.bucket].filter(Boolean), bucket))
    .filter((item) => sector === "All" || item.sector === sector)
    .filter((item) => recency === "All" || String(item.newHighRecency4w) === recency)
    .filter((item) => newHighMatches(item, newHigh))
    .filter((item) => { if (minRsi <= 0) return true; const r = rsiValue(item); return r != null && r >= minRsi; })
    .filter((item) => { if (maxRsi <= 0) return true; const r = rsiValue(item); return r != null && r <= maxRsi; })
    .filter((item) => (Number(item.volumeRatio) || 0) >= minVolume)
    // 시총 하한 비교는 시장별 단위로: US=marketCapB($B), KR=marketCapT(조 원).
    // itemCapForValuation 이 그 시장별 값을 돌려준다(US 결과는 기존과 동일).
    .filter((item) => itemCapForValuation(item) >= minMarketCap)
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
    minRsi ? `RSI >= ${minRsi}` : "",
    maxRsi ? `RSI <= ${maxRsi}` : "",
    minVolume ? `Vol >= ${minVolume}x` : "",
    minMarketCap ? (isKrMarket() ? `시총 >= ${marketCfg().formatMarketCap(minMarketCap)}` : `MktCap >= $${minMarketCap}B`) : ""
  ].filter(Boolean).join(" · ");
  byId("topStocksMeta").textContent = `${filterText} · ${rows.length}개`;

  if (!rows.length) {
    byId("topStocks").innerHTML = `<article class="rank-card"><h3>조건에 맞는 종목이 없습니다.</h3><p class="muted">필터를 완화해보세요.</p></article>`;
    return;
  }

  byId("topStocks").innerHTML = rows.map(({ item, value }, index) => `
    <article class="stock-card top-stock-card" data-ticker="${escapeHtml(item.ticker)}">
      <div class="rank-line">
        <span>${index + 1}</span>
        <strong>${escapeHtml(item.ticker)}</strong>
        <em class="${metricClass(value, metric)}">${formatMetricValue(value, metric)}</em>
      </div>
      <p class="muted">${escapeHtml(item.company)}</p>
      <p>${escapeHtml(item.sector)} · ${escapeHtml(item.industry)}</p>
      <div class="mini-facts">
        ${miniMetric("가격", priceOrDash(item.price))}
        ${miniMetric("당일", `<span class="${cls(item.changePct)}">${fmtDailyPct(item.changePct)}</span>`)}
        ${miniMetric("RSI", fmtRsi(item))}
        ${miniMetric("EPS", fmtEps(item))}
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

  // RS/EPS 합성 점수 기여항 제거 — 실측 모멘텀·RSI(scanRsiBias) 로 대체.
  if (Number.isFinite(item.threeMonthChangePct)) push(scanTanh(item.threeMonthChangePct / 15), 1.4 * longW);
  if (Number.isFinite(item.monthChangePct)) push(scanTanh(item.monthChangePct / 8), 0.9);
  if (Number.isFinite(item.weekChangePct)) push(scanTanh(item.weekChangePct / 4), 0.6 * shortW);
  push(scanRsiBias(rsiValue(item) ?? NaN), 1.0 * shortW);
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
        ${miniMetric("EPS", fmtEps(item))}
        ${miniMetric("RSI", fmtRsi(item))}
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

// 주도주 필터 'RSI 상한' 입력. index.html 의 id 가 아직 topMinEps(옛 EPS 필터 시절 이름)라
// 새 id(topMaxRsi)가 생기면 그쪽을 먼저 본다 — 마크업이 바뀌어도 여기는 그대로.
function topMaxRsiInputId() {
  return byId("topMaxRsi") ? "topMaxRsi" : "topMinEps";
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
  byId("topMinRs").value = preset.minRsi || "";
  byId(topMaxRsiInputId()).value = preset.maxRsi || "";
  byId("topMinVolume").value = preset.minVolume || "";
  byId("topMinMarketCap").value = presetMinMarketCap(key) || "";
  renderTopStocks();
}

function resetTopScreener() {
  byId("topPreset").value = "custom";
  byId("topMetric").value = "changePct";
  byId("topBucket").value = marketCfg().defaultBucket || "idx_sp500";
  byId("topSector").value = "All";
  byId("topNewHighRecency").value = "All";
  byId("topNewHigh").value = "All";
  ["topMinRs", topMaxRsiInputId(), "topMinVolume", "topMinMarketCap"].forEach((id) => { byId(id).value = ""; });
  byId("topLimit").value = "24";
  renderTopStocks();
}

function topPresetMatches(item, preset) {
  if (!preset || preset === "custom") return true;
  const distance = Number(item.newHighDistancePct);
  const rsi = rsiValue(item);
  const m1 = Number(item.monthChangePct);
  const m3 = Number(item.threeMonthChangePct);
  // 강한 추세 리더: 3개월·1개월 모멘텀 양(+) + 52주 신고가 10% 이내 + RSI 과열(>85) 아님.
  if (preset === "leaders") return m3 > 0 && m1 > 0 && Number.isFinite(distance) && distance <= 10 && (rsi == null || rsi <= 85);
  // 신고가 근접 돌파: 거래량 1.5배↑ + 신고가 5% 이내 + 1개월 상승.
  if (preset === "breakout") return Number(item.volumeRatio) >= 1.5 && Number.isFinite(distance) && distance <= 5 && m1 > 0;
  // 강한 종목 눌림목: 중기(3개월) 상승추세 + 당일 눌림 + 신고가에서 3%+ 벌어짐 + RSI 과매수 아님(≤55).
  if (preset === "pullback") return m3 > 0 && Number(item.changePct) < 1 && Number.isFinite(distance) && distance >= 3 && (rsi == null || rsi <= 55);
  // 성장주: 중기 상승추세 + (내년 EPS 추정 > TTM EPS) 또는 (흑자 + 1개월 상승).
  if (preset === "growth") {
    const eps = epsTtmValue(item);
    const epsN = Number(item.epsNextY);
    return m3 > 0 && ((Number.isFinite(epsN) && eps != null && epsN > eps) || (eps != null && eps > 0 && m1 > 0));
  }
  if (preset === "value") {
    // 라이트 스냅샷엔 fundamentals 가 인라인되지 않으므로 MAP_FUNDAMENTALS 도 함께 조회.
    const mf = mapFundamentalsFor(item.ticker) || {};
    const pe = Number(item.fundamentals?.forwardPE ?? item.fundamentals?.pe ?? mf.forwardPE ?? mf.pe);
    const capOk = isKrMarket() ? Number(item.marketCapT ?? item.marketCapB) >= 1 : Number(item.marketCapB) >= 10;
    return capOk && Number.isFinite(pe) && pe > 0 && pe <= 25;
  }
  if (preset === "lows") { const d = low52DistPct(item); return Number.isFinite(d) && d <= 15; }
  if (preset === "volsurge") return Number(item.volumeRatio) >= 3;
  if (preset === "oversold") { const r = rsiValue(item); return r != null && r <= 30; }
  return true;
}

function metricValue(item, metric) {
  // 라이트 스냅샷엔 fundamentals 가 인라인되지 않아 MAP_FUNDAMENTALS 를 함께 조회한다
  // (없으면 forwardPE 등으로 정렬하는 옵션·프리셋이 통째로 비어 버린다).
  const f = item.fundamentals || mapFundamentalsFor(item.ticker) || {};
  if (metric === "pe") return Number(f.pe);
  if (metric === "forwardPE") return Number(f.forwardPE);
  if (metric === "ps") return Number(f.ps);
  if (metric === "pb") return Number(f.pb);
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
  if (metric === "epsTtm") return fmtEpsValue(value);
  if (["rsi14", "stochK"].includes(metric)) return `${Math.round(value)}`;
  if (["pe", "forwardPE", "ps", "pb"].includes(metric)) return fmtMultiple(value);
  if (metric === "changePct") return fmtDailyPct(value);
  return fmtPct(value);
}

function metricClass(value, metric) {
  if (["pe", "forwardPE", "ps", "pb", "marketCapB", "volumeRatio", "low52Dist", "rsi14", "stochK", "epsTtm"].includes(metric)) return "";
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
  const vol = (item) => Number(item.volumeRatio);
  const rows = data.stocks.filter((item) => {
    if (category === "rsVolume") return Number.isFinite(Number(item.newHighDistancePct)) && Number(item.newHighDistancePct) <= 5 && vol(item) >= 1.5;
    if (category === "volume") return vol(item) >= 1.5;
    return Number(item.changePct) >= 2;
  }).sort((a, b) => (Number(b[sort]) || 0) - (Number(a[sort]) || 0)).slice(0, 12);

  byId("jumpGrid").innerHTML = rows.map((item) => `
    <article class="stock-card jump-stock-card" data-ticker="${escapeHtml(item.ticker)}" style="cursor: pointer;">
      <h3>${escapeHtml(item.ticker)}</h3>
      <p class="muted">${escapeHtml(item.company ?? "")}</p>
      <p><strong class="${cls(item.changePct)}">${fmtDailyPct(item.changePct)}</strong> · Vol ${Number.isFinite(vol(item)) ? `${vol(item).toFixed(1)}x` : "—"}</p>
      <p>RSI ${fmtRsi(item)} · EPS ${fmtEps(item)}</p>
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
  const raw = String(ticker || "").trim();
  const resolved = normalizeTickerKey(resolveTickerQuery(raw) || raw);
  let found = stockByTicker(resolved) || liveStubFor(resolved);
  if (!found) {
    found = createLiveSearchStub(resolved);
    if (found) liveStubs.set(resolved, found);
  }
  if (!found) {
    // 여러 후보로 갈리는 질의(resolveTickerQuery 가 null) — 첫 후보를 몰래 고르지 않고 알린다.
    const hits = raw ? searchTickerSuggestions(raw, 4) : [];
    if (hits.length >= 2 && typeof showAppToast === "function") {
      showAppToast(`'${raw}' 후보 ${hits.length}개: ${hits.map((h) => h.ticker).join(", ")} — 목록에서 선택하세요`);
    }
    return false;
  }
  if (found.ticker !== selectedTicker) moveAnalysisState = null;
  selectedTicker = found.ticker;
  byId("tickerSearch").value = selectedTicker;
  chatFocusTicker = found.ticker;
  // 지도는 보일 때만(숨은 탭은 폭 0 이라 어차피 그리지 못한다 — 진입 때 다시 그린다).
  if (currentTab === "map") renderTreemap();
  const wantsSearch = options.openSearch !== false;
  if (wantsSearch && (currentTab !== "search" || searchSubTab !== "analysis")) {
    // activateTab → activateSearchSub("analysis") 가 renderSearch 를 한 번만 부른다
    // (예전엔 여기서 한 번, activateTab 에서 또 한 번 그렸다).
    activateTab("search", { sub: "analysis", ticker: selectedTicker, push: true, renderOptions: options });
  } else {
    if (!options.skipRender) renderSearch(options);
    if (wantsSearch) history.replaceState({ tab: "search", sub: "analysis", ticker: selectedTicker }, "");
  }
  return true;
}

// 스냅샷에도 실시간 스텁에도 없는 티커 — 첫 종목으로 떨어뜨리지 않고 상태를 그대로 보여준다.
function renderSearchMissing(ticker) {
  const t = escapeHtml(ticker || "");
  const title = byId("chartTitle");
  if (title) title.textContent = `${ticker || "—"} · 스냅샷에 없는 종목`;
  const facts = byId("searchFacts");
  if (facts) {
    facts.innerHTML = `
      <span class="muted">Search Ticker</span>
      <h3 class="stock-facts-head">${t}</h3>
      <p class="muted">스냅샷에 없는 종목입니다. 티커·종목명을 다시 확인하거나 자동완성 목록에서 선택해 주세요.</p>`;
  }
  const chart = byId("priceChart");
  if (chart) chart.innerHTML = "";
  const news = byId("searchNews");
  if (news) news.innerHTML = `<span class="muted">주요 뉴스</span><p class="news-empty">스냅샷에 없는 종목이라 뉴스를 불러오지 않습니다.</p>`;
}

function renderSearchFacts(item) {
  const el = byId("searchFacts");
  if (el && item) el.innerHTML = stockFacts(item, "Search Ticker");
}

function renderSearch(options = {}) {
  const base = selectedBaseRow();
  if (!base) { renderSearchMissing(selectedTicker); return; }
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
  if (currentTab === "search" && !options.fromAiSearch && !options.skipAiReport) loadAiDeepReport(item.ticker);
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
  evidence.push(moveEvidenceRow("시장", `${item.sector} 대비 ${relative >= 0 ? "강함" : "약함"}`, `종목 ${fmtDailyPct(change)} · 섹터 평균 ${fmtPct(sectorAvg)} · 차이 ${fmtSignedPct(relative, 1, "%p")}`, { icon: "M", tone: relative >= 0 ? "pos" : "neg" }));

  const volume = Number(item.volumeRatio || 0);
  if (volume > 0) {
    const volumeLabel = volume >= 2 ? "평균보다 크게 증가" : volume >= 1.2 ? "평균보다 증가" : "평균 수준 이하";
    evidence.push(moveEvidenceRow("수급", `거래량 ${volume.toFixed(1)}배`, volumeLabel, { icon: "V", tone: volume >= 2 ? "warn" : "info" }));
  }

  const technical = [];
  if (Number(item.newHighDistancePct) <= 3) technical.push(`52주 고점 ${Number(item.newHighDistancePct).toFixed(1)}% 이내`);
  const rsiMove = rsiValue(item);
  if (rsiMove != null && rsiMove >= 70) technical.push(`RSI ${Math.round(rsiMove)} 과열권`);
  else if (rsiMove != null && rsiMove <= 30) technical.push(`RSI ${Math.round(rsiMove)} 침체권`);
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
  // 추세: 1개월·3개월 모멘텀 양(+) + SMA20 위 (RS 합성 점수 대체)
  const trendPass = Number(item.monthChangePct) > 0 && Number(item.threeMonthChangePct) > 0 && (sma20 == null || last >= sma20);
  const trendWarn = Number(item.monthChangePct) < 0 || (sma20 != null && last < sma20);

  // 실적: 실측 EPS(TTM) 흑자 + 내년 추정 EPS 가 TTM 이상 (감소 아님)
  const epsTtmVal = epsTtmValue(item) ?? (Number.isFinite(Number(f.epsTtm)) ? Number(f.epsTtm) : null);
  const epsNextYVal = Number.isFinite(Number(item.epsNextY)) ? Number(item.epsNextY) : (Number.isFinite(Number(f.epsNextY)) ? Number(f.epsNextY) : null);
  const earningsKnown = epsTtmVal != null || epsNextYVal != null;
  const earningsPass = epsTtmVal != null && epsTtmVal > 0 && (epsNextYVal == null || epsNextYVal >= epsTtmVal);

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

  const rsi = rsiValue(item);
  const debtEq = Number(f.debtEq);
  const highDistance = Number(item.newHighDistancePct);
  const riskFlags = [];
  if (rsi != null && rsi >= 75) riskFlags.push(`RSI ${Math.round(rsi)} 과열`);
  if (Number.isFinite(debtEq) && debtEq > 2) riskFlags.push(`부채비율 ${debtEq.toFixed(1)}배`);
  if (Number.isFinite(highDistance) && highDistance > 30) riskFlags.push(`52주 고점 대비 ${highDistance.toFixed(0)}% 하락`);

  return [
    { label: "추세", status: trendPass ? "pass" : trendWarn ? "warn" : "check", detail: `1개월 ${fmtPct(item.monthChangePct)} · RSI ${fmtRsi(item)}${sma20 != null ? ` · SMA20 ${last >= sma20 ? "위" : "아래"}` : ""}` },
    { label: "실적·추정", status: !earningsKnown ? "check" : earningsPass ? "pass" : (epsTtmVal != null && epsTtmVal <= 0) ? "warn" : "check", detail: earningsKnown ? `EPS(TTM) ${fmtEpsValue(epsTtmVal)}${epsNextYVal != null ? ` · 내년 추정 ${fmtEpsValue(epsNextYVal)}` : ""}` : "EPS 데이터가 부족합니다." },
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
  const hasEstimate = [snapshot.epsNextQ, snapshot.epsNextY, snapshot.revenueNextQ, snapshot.revenueNextY, snapshot.targetPrice].some(Number.isFinite);
  if (!hasEstimate) return [];
  const rows = Array.isArray(store[item.ticker]) ? store[item.ticker] : [];
  const index = rows.findIndex((row) => row.date === snapshot.date);
  if (index >= 0) {
    // 같은 날 같은 값이면 쓰지 않는다 — 렌더마다 localStorage 직렬화를 하던 것.
    const prev = rows[index];
    const same = ["epsNextQ", "epsNextY", "revenueNextQ", "revenueNextY", "targetPrice"]
      .every((k) => (prev[k] ?? null) === (snapshot[k] ?? null));
    if (same) return rows;
    rows[index] = snapshot;
  } else {
    rows.push(snapshot);
  }
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
  return { text: fmtSignedPct(pct), tone: cls(pct) };
}

function renderEstimateRevision(item) {
  const box = byId("estimateRevisionCard");
  if (!box || !item) return;
  const rows = recordEstimateSnapshot(item);
  const current = rows[rows.length - 1] || currentEstimateSnapshot(item);
  const week = estimateBaseline(rows, 7);
  const month = estimateBaseline(rows, 30);
  const metrics = [
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
// 페이로드 객체 자체를 캐시 키로 쓴다 — INSTITUTIONAL_13F 가 늦게 도착해도(heavy lazy)
// 빈 {} 를 영영 돌려주지 않는다.
let _inst13fIndex = null;
let _inst13fIndexSrc = null;
function inst13fIndex() {
  const src = window.INSTITUTIONAL_13F || null;
  if (_inst13fIndex && _inst13fIndexSrc === src) return _inst13fIndex;
  const idx = {};
  const insts = (src || {}).institutions || [];
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
  _inst13fIndexSrc = src;
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

// 기관 보유 변화(13F QoQ) 패널은 index.html 에 대상 요소(#stockInst13f)가 없어 죽은 코드였다
// (85줄 삭제). chart-indicators.js 의 renderStockEvents 가 아직 호출하므로 빈 스텁만 남긴다.
function renderInst13fChange() {}

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
      const refreshedBase = stockByTicker(ticker) || base;
      const merged = applyLive(withDetail(refreshedBase));
      if (base.__liveStub) renderSearchFacts(merged);
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
        if (base.__liveStub) renderSearchFacts(merged);
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
  byKo.forEach((tickers, alias) => tickerKoAliasEntries.push({ alias, tickers, aliasLower: alias.toLowerCase() }));
  // 긴(구체적인) 별칭이 먼저 — extractStockTickerFromQuery 가 매 호출 정렬하던 것을 여기서 한 번만.
  tickerKoAliasEntries.sort((a, b) => b.alias.length - a.alias.length);
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
  // 점수 차가 작으면(< 180) 모호한 질의 — 첫 후보를 몰래 고르지 않고 null. 호출부(selectTicker)가 후보를 알린다.
  return null;
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

  // 3개월 모멘텀 기준 강세/약세 (RS 합성 점수 대체)
  const strong = stocks.filter((s) => Number(s.threeMonthChangePct) >= 10).length;
  const weak = stocks.filter((s) => Number(s.threeMonthChangePct) <= -10).length;
  const strongPct = (strong / n) * 100;

  // RSI 과매수/과매도 분포 — 단기 쏠림. rsi14 결측 종목은 분모에서 제외해 비율 왜곡 방지.
  const rsiN = stocks.filter((s) => rsiValue(s) != null).length;
  const overbought = stocks.filter((s) => { const r = rsiValue(s); return r != null && r >= 70; }).length;
  const oversold = stocks.filter((s) => { const r = rsiValue(s); return r != null && r <= 30; }).length;
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
      <article><span>3개월 강세(≥+10%)</span><strong class="pos">${strong.toLocaleString()}</strong><em class="muted">약세(≤-10%) ${weak}</em></article>
      <article><span>거래량 동반 상승</span><strong>${volAdv.toLocaleString()}</strong><em class="muted">상승종목의 ${volAdvPct.toFixed(0)}%</em></article>
      <article><span>당일 상승 비율</span><strong class="${advPct >= 50 ? "pos" : "neg"}">${advPct.toFixed(0)}%</strong><em class="muted">참여도</em></article>
      <article><span>과매수 / 과매도</span><strong><b class="pos">${overbought.toLocaleString()}</b> / <b class="neg">${oversold.toLocaleString()}</b></strong><em class="muted">RSI≥70 / ≤30${obPct != null ? ` · ${obPct.toFixed(0)}% / ${osPct.toFixed(0)}%` : ""}</em></article>
    </div>
    <div class="breadth-bars">
      ${breadthBar("당일 상승 비율", advPct, `${adv} / ${n}개 상승`)}
      ${breadthBar("1주 상승 비율", weekUp, "주간 추세 참여도")}
      ${breadthBar("1개월 상승 비율", monthUp, "중기 추세 참여도")}
      ${breadthBar("3개월 상승 비율", quarterUp, "분기 추세 참여도")}
      ${breadthBar("3개월 강세 비율", strongPct, "3개월 +10% 이상")}
    </div>
    <div class="breadth-sectors">
      <div class="breadth-sectors-title">섹터별 상승 비율</div>
      ${sectorHtml}
    </div>
    <p class="breadth-note">참여도가 넓을수록(상승 비율·모멘텀 강세 높을수록) 추세가 건강합니다. 지수만 오르고 폭이 좁으면(소수 종목 주도) 되돌림 위험을 함께 봐야 합니다.</p>
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
  "COT 포지셔닝": { us: { workflow: "Daily US market snapshot", script: "scripts/build_cftc_cot.py" }, tabs: "시그널 탭 · 선물 투기 포지셔닝" },
  "국채 경매": { us: { workflow: "Daily US market snapshot", script: "scripts/build_treasury_auctions.py" }, tabs: "시그널 탭 · 국채 경매 수요" },
  "리테일 관심도": { us: { workflow: "Daily US market snapshot", script: "scripts/build_wiki_attention.py" }, tabs: "시그널 탭 · 리테일 관심도(위키)" },
  "외부 공포탐욕": { us: { workflow: "Daily US market snapshot", script: "scripts/build_sentiment_gauges.py" }, tabs: "시그널 탭 · 심리지수 비교 타일" },
  "결제 불이행(FTD)": { us: { workflow: "Daily US market snapshot", script: "scripts/build_sec_ftd.py" }, tabs: "종목 탭 · 공매도 하단" },
  "WSB 감성": { us: { workflow: "Daily US market snapshot", script: "scripts/build_wsb_sentiment.py" }, tabs: "AI 브리핑 탭 · 소셜 표" },
  "ECOS 매크로": { kr: { workflow: "Korea close briefing", script: "scripts/build_kr_ecos_macro.py" }, tabs: "시그널 탭 · 한국 매크로" },
  "정부조달 낙찰": { kr: { workflow: "Korea close briefing", script: "scripts/build_kr_gov_contracts.py" }, tabs: "종목 탭 · 수주 하단" },
  "수출 모멘텀": { kr: { workflow: "Korea close briefing", script: "scripts/build_kr_trade_exports.py" }, tabs: "시그널 탭 · 수출 모멘텀" },
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
  // 2026-08-06 신규 무키 피드 — 등록하지 않으면 신뢰도 센터의 감시 사각지대가 된다.
  rows.push(source("COT 포지셔닝", "CFTC", window.COT_POSITIONING, ["markets"], 336, "매주 금요일 발표", "cotPositioning"));
  rows.push(source("국채 경매", "US Treasury FiscalData", window.TREASURY_AUCTIONS, ["recent"], 336, "경매 일정마다", "treasuryAuctions"));
  rows.push(source("리테일 관심도", "Wikimedia 조회수", window.WIKI_ATTENTION, [cfg.id === "kr" ? "kr" : "us"], 144, "매일", "wikiAttention"));
  rows.push(source("외부 공포탐욕", "alternative.me · CNN", window.SENTIMENT_GAUGES, ["crypto", "cnn"], 144, "매일", "sentimentGauges", "", true));
  if (cfg.id === "us") {
    rows.push(source("결제 불이행(FTD)", "SEC CNS", window.SEC_FTD, ["top"], 1080, "월 2회 · 약 2주 지연", "secFtd"));
    rows.push(source("WSB 감성", "Tradestie", window.WSB_SENTIMENT, ["rows"], 144, "매일", "wsbSentiment"));
  }
  if (cfg.id === "kr") {
    rows.push(source("ECOS 매크로", "한국은행 ECOS", window.KR_ECOS_MACRO, ["indicators"], 144, "매일 15:42", "ecosMacro"));
    rows.push(source("정부조달 낙찰", "나라장터 (data.go.kr)", window.KR_GOV_CONTRACTS, ["awards"], 192, "매일 15:42", "krGovContracts"));
    rows.push(source("수출 모멘텀", "관세청 (data.go.kr)", window.KR_TRADE_EXPORTS, ["items"], 192, "매일 15:42 · 월 단위 데이터", "tradeExports"));
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
      clearFeatureDataFailures();
      renderDataTrustCenter();
      showAppToast("데이터 상태를 다시 확인했습니다");
    });
  }
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
  if (inline) { el.innerHTML = sanitizeBriefingHtml(inline); return; }
  el.innerHTML = `<div class="empty-briefing"><strong>${BRIEFING_LABELS[key]}</strong><br>브리핑을 불러오는 중…</div>`;
  fetch(`data/briefings/${key}.json`, { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((b) => {
      const html = b && b.html;
      if (html) briefingFileCache[key] = html;
      if (briefingSel[side] !== key) return; // user toggled away while loading
      el.innerHTML = html ? sanitizeBriefingHtml(html) : emptyHtml;
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
        <td>${escapeHtml(stripEmoji(item.name || ""))}</td>
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
        <td>${escapeHtml(stripEmoji(item.name || ""))}</td>
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
        <td>${escapeHtml(stripEmoji(item.name || ""))}</td>
        <td class="${cls(item.changePct || 0)}">${escapeHtml(item.price || "-")}${item.changePct ? ` (${fmtDailyPct(item.changePct)})` : ""}</td>
      </tr>
    `).join("");
  } else {
    yahooEl.innerHTML = `<tr><td colspan="4" class="text-center" style="padding: 20px; text-align: center; color: var(--text-muted);">데이터 없음</td></tr>`;
  }
  bindSocialSentimentClicks(ids);
}

let _wsbTried = false;
function renderWsbSentimentTable() {
  const el = byId("socialWsbTable");
  if (!el) return;
  const rows = (window.WSB_SENTIMENT && window.WSB_SENTIMENT.rows) || [];
  if (!rows.length) {
    el.innerHTML = `<tr><td colspan="5" class="text-center" style="padding: 20px; text-align: center; color: var(--text-muted);">데이터 없음</td></tr>`;
    return;
  }
  el.innerHTML = rows.slice(0, 15).map((r, i) => {
    const bull = r.sentiment === "Bullish";
    const col = bull ? "var(--green)" : "var(--red)";
    return `<tr class="social-row" data-ticker="${escapeHtml(r.t)}">
      <td>${i + 1}</td>
      <td>${socialTickerCell(r.t)}</td>
      <td>${escapeHtml(stripEmoji(r.company || ""))}</td>
      <td>${Number(r.comments || 0).toLocaleString()}</td>
      <td style="color:${col}">${bull ? "강세" : "약세"}${Number.isFinite(r.score) ? ` ${r.score > 0 ? "+" : ""}${r.score}` : ""}</td>
    </tr>`;
  }).join("");
}

function renderSocialSentiment() {
  renderSocialSentimentTables();
  // WSB 감성(Tradestie)은 별도 파일 — 탭 첫 진입 때 한 번만 로드 시도.
  if (!window.WSB_SENTIMENT && !_wsbTried) {
    _wsbTried = true;
    ensureFeatureData("wsbSentiment").then((ok) => { if (ok) renderWsbSentimentTable(); });
  } else {
    renderWsbSentimentTable();
  }
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
    const base = selectedBaseRow(t);
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
  const rsiVals = items.map((s) => rsiValue(s)).filter((v) => v != null);
  const avgRsi = rsiVals.length ? rsiVals.reduce((sum, v) => sum + v, 0) / rsiVals.length : null;
  const avgChg = items.reduce((sum, s) => sum + Number(s.changePct || 0), 0) / items.length;
  box.innerHTML = `
    <article class="watch-stat-card"><span>종목 수</span><strong>${items.length}</strong></article>
    <article class="watch-stat-card"><span>상승 비중</span><strong>${Math.round((up / items.length) * 100)}%</strong></article>
    <article class="watch-stat-card"><span>평균 RSI</span><strong>${avgRsi == null ? "—" : avgRsi.toFixed(0)}</strong></article>
    <article class="watch-stat-card"><span>평균 당일</span><strong class="${cls(avgChg)}">${fmtPct(avgChg)}</strong></article>
  `;
}

function watchAlertSettings() {
  const defaults = {
    useRs: true,       // RSI ≥ 조건 (키 이름은 저장 호환 위해 유지)
    minRs: 60,
    useEps: false,     // 흑자(EPS TTM > 0) 조건
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
    minRs: numberInputValue("alertMinRs", 60),
    useEps: Boolean(byId("alertUseEps")?.checked),
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
    ["alertUseEps", "useEps"],
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
  const rsi = rsiValue(item);
  if (settings.useRs && rsi != null && rsi >= settings.minRs) reasons.push(`RSI ${Math.round(rsi)}`);
  const eps = epsTtmValue(item);
  if (settings.useEps && eps != null && eps > 0) reasons.push(`흑자 EPS ${fmtEps(item)}`);
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
  ["alertUseRs", "alertMinRs", "alertUseEps", "alertUseHigh", "alertHighDist", "alertUseVol", "alertMinVol", "alertUseSma20", "alertUsePattern", "alertPatternCat"].forEach((id) => {
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
    marketCapB: capB, capTier, rsi14: (stock.rsi14 ?? null),
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
              <span class="earn-row-rs"><i>RSI</i>${Number.isFinite(Number(it.rsi14)) ? Math.round(Number(it.rsi14)) : "—"}</span>
            </button>`).join("")}
        </div>
      </section>`;
  }).join("");
}

function earnSortCmp(a, b) {
  if (earnSort === "cap") return (b.marketCapB || 0) - (a.marketCapB || 0);
  if (earnSort === "rs") return (rsiValue(b) ?? -Infinity) - (rsiValue(a) ?? -Infinity);
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
    const chgText = Number.isFinite(chg) ? fmtSignedPct(chg) : "-";
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

// CSV 가져오기 — 내보내기 포맷(티커,종목명,수량,평단,…) 또는 최소 3열(티커,수량,평단)을
// 받는다. 현재 시장 스냅샷에 없는 티커는 건너뛰고 결과를 토스트로 요약한다.
function importPortfolioCsv(text) {
  const lines = String(text || "").replace(/^﻿/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) { showAppToast("빈 파일입니다."); return; }
  const delim = lines[0].includes("\t") ? "\t" : ",";
  let rows = lines.map((l) => l.split(delim).map((c) => c.trim().replace(/^"|"$/g, "")));
  // 헤더 감지: 첫 행에 숫자 열이 없으면 헤더로 보고 버린다.
  const looksHeader = rows[0].every((c) => !Number.isFinite(parseFloat(c.replace(/,/g, ""))));
  const header = looksHeader ? rows[0].map((c) => c.toLowerCase()) : null;
  if (looksHeader) rows = rows.slice(1);
  // 내보내기 포맷이면 수량=3열째·평단=4열째, 아니면 2·3열째.
  const exportShape = header && (header[0].includes("티커") || header[0].includes("ticker")) && header.length >= 4
    && (header[2].includes("수량") || header[2].includes("qty") || header[2].includes("quantity"));
  const qtyCol = exportShape ? 2 : 1;
  const costCol = exportShape ? 3 : 2;
  const num = (v) => parseFloat(String(v || "").replace(/,/g, ""));
  let added = 0, updated = 0, skipped = 0;
  rows.forEach((cols) => {
    const t = normalizeTickerKey(cols[0] || "");
    const qty = num(cols[qtyCol]);
    const cost = num(cols[costCol]);
    if (!t || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(cost) || cost <= 0 || !stockByTicker(t)) { skipped += 1; return; }
    const existing = portfolio.find((p) => p.ticker === t);
    if (existing) { existing.qty = qty; existing.avgCost = cost; updated += 1; }
    else if (portfolio.length < 60) { portfolio.push({ ticker: t, qty, avgCost: cost }); added += 1; }
    else skipped += 1;
  });
  if (added || updated) {
    savePortfolio();
    renderPortfolio();
    showAppToast(`가져오기 완료 — 추가 ${added} · 갱신 ${updated}${skipped ? ` · 건너뜀 ${skipped}` : ""}`);
  } else {
    showAppToast(`가져온 항목이 없습니다${skipped ? ` (건너뜀 ${skipped} — 티커·수량·평단 확인)` : ""}.`);
  }
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
    portfolio: typeof portfolioCloudPayload === "function" ? portfolioCloudPayload() : portfolio,
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
      if (typeof applyCloudPortfolio === "function") {
        applyCloudPortfolio(prefs.portfolio); // portfolio.js: 시장별 저장 키까지 반영
      } else {
        portfolio = prefs.portfolio.filter((p) => p && p.ticker).slice(0, 60);
        savePortfolio();
      }
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


// =====================================================================================
// 2026-09 IA 재편 — 셸(헤더 설정 팝오버·검색 버튼·푸터 링크), 오늘 탭 요약, 시그널 요약,
// 내 투자 빈 상태/4숫자, 찾기 프리셋 미러, 트리맵 색상 세그먼트, 차트 설정 버튼, 챗봇 FAB.
// 기존 렌더러는 그대로 두고(id 유지) 이 블록이 새 표면만 그린다.
// =====================================================================================

// ----- 내 투자 서브탭(보유·관심 / 도구) -----
let bulkSubTab = "holdings";
function activateBulkSub(name, { push = false } = {}) {
  bulkSubTab = name === "tools" ? "tools" : "holdings";
  byId("bulkSubTabs")?.querySelectorAll(".sub-tab").forEach((btn) => btn.classList.toggle("is-active", btn.dataset.sub === bulkSubTab));
  document.querySelectorAll("#tab-bulk > #myInvestBody > .sub-panel").forEach((p) => p.classList.remove("is-active"));
  byId(`sub-bulk-${bulkSubTab}`)?.classList.add("is-active");
  if (push) recordNav();
}

// ----- 오늘 탭: 국면 한 문장 -----
// computeMarketRegime(리스크온/오프/혼조) + 강한·약한 섹터 1개씩 → "혼조 · 에너지 강세, 소재 약세".
function renderTodayRegime() {
  const el = byId("todayRegime");
  if (!el || !data || !Array.isArray(data.stocks) || !data.stocks.length) return;
  let regime = null;
  let sectors = { strong: [], weak: [] };
  try { regime = computeMarketRegime(); sectors = computeSectorRanks(); } catch (_) { return; }
  const strong = sectors.strong?.[0];
  const weak = sectors.weak?.[0];
  const parts = [];
  if (strong && Number.isFinite(Number(strong.avg))) parts.push(`${strong.ko} 강세`);
  if (weak && Number.isFinite(Number(weak.avg))) parts.push(`${weak.ko} 약세`);
  const fng = Number.isFinite(regime.fng) ? ` · 심리 ${Math.round(regime.fng)}` : "";
  const up = Number.isFinite(regime.upPct) ? ` · 상승 종목 ${Math.round(regime.upPct * 100)}%` : "";
  el.innerHTML = `<strong class="ia-regime-tone ia-regime-${escapeHtml(regime.tone)}">${escapeHtml(regime.ko)}</strong>` +
    (parts.length ? ` <span class="ia-regime-sep">·</span> ${escapeHtml(parts.join(", "))}` : "") +
    `<span class="ia-regime-meta">${escapeHtml(fng + up)}</span>`;
  el.title = regime.desc || "";
}

// ----- 오늘 탭: 카드뉴스 1장 + 더 보기 -----
let todayNewsView = null;
let todayNewsExpanded = false;
function renderTodayNews() {
  const box = byId("todayNews");
  if (!box) return;
  const cn = (data && data.cardNews) || {};
  const sets = {
    us: cn.us && Array.isArray(cn.us.images) && cn.us.images.length ? cn.us : null,
    kr: cn.kr && Array.isArray(cn.kr.images) && cn.kr.images.length ? cn.kr : null,
  };
  if (!sets.us && !sets.kr) { box.hidden = true; box.innerHTML = ""; return; }
  if (!todayNewsView) todayNewsView = isKrMarket() ? "kr" : "us";
  if (!sets[todayNewsView]) todayNewsView = sets.us ? "us" : "kr";
  const active = sets[todayNewsView];
  const imgs = active.images;
  const rest = imgs.slice(1);
  box.hidden = false;
  box.innerHTML = `
    <div class="ia-today-news-head">
      <div>
        <h2>오늘의 뉴스</h2>
        <p class="muted">${escapeHtml(active.title || "오늘의 카드뉴스")}</p>
      </div>
      ${sets.us && sets.kr ? `<div class="segmented ia-seg ia-seg-sm" role="group" aria-label="카드뉴스 시장">
        <button type="button" data-cn="us" class="${todayNewsView === "us" ? "is-active" : ""}">미국</button>
        <button type="button" data-cn="kr" class="${todayNewsView === "kr" ? "is-active" : ""}">국내</button>
      </div>` : ""}
    </div>
    <button type="button" class="ia-today-news-hero" data-news-idx="0" title="크게 보기">
      <img src="${escapeHtml(imgs[0])}" alt="오늘의 카드뉴스 1" loading="lazy" decoding="async">
    </button>
    ${rest.length ? `<button type="button" class="ghost compact-btn ia-today-news-more" id="todayNewsMore" aria-expanded="${todayNewsExpanded}">${todayNewsExpanded ? "접기" : `더 보기 (${rest.length}장)`}</button>
    <div class="ia-today-news-grid" id="todayNewsGrid"${todayNewsExpanded ? "" : " hidden"}>
      ${rest.map((src, i) => `<button type="button" class="ia-today-news-thumb" data-news-idx="${i + 1}" title="크게 보기"><img src="${escapeHtml(src)}" alt="카드뉴스 ${i + 2}" loading="lazy" decoding="async"></button>`).join("")}
    </div>` : ""}`;
  box.querySelectorAll("[data-cn]").forEach((btn) => btn.addEventListener("click", () => {
    if (btn.dataset.cn === todayNewsView) return;
    todayNewsView = btn.dataset.cn;
    renderTodayNews();
  }));
  box.querySelectorAll("[data-news-idx]").forEach((btn) => btn.addEventListener("click", () => openLightbox(imgs, Number(btn.dataset.newsIdx))));
  byId("todayNewsMore")?.addEventListener("click", () => {
    todayNewsExpanded = !todayNewsExpanded;
    renderTodayNews();
  });
}

// ----- 시장/시그널: 오늘의 시그널 3개(절대 변화가 큰 순) -----
function signalCandidates() {
  const out = [];
  const g = window.SENTIMENT_GAUGES;
  if (g?.cnn && Number.isFinite(Number(g.cnn.value))) {
    const v = Number(g.cnn.value);
    const prev = Number(g.cnn.prevClose);
    const d = Number.isFinite(prev) ? v - prev : 0;
    out.push({ key: "fng", label: "공포·탐욕 (CNN)", value: `${Math.round(v)}`, unit: "", delta: d, deltaText: Number.isFinite(prev) ? `${d > 0 ? "+" : ""}${Math.round(d)} (전일 ${Math.round(prev)})` : "", norm: Math.abs(d) / 8, note: fearGreedLabel(v).t, tone: d > 0 ? "pos" : d < 0 ? "neg" : "muted" });
  }
  const yc = window.YIELD_CURVE;
  if (yc?.spreads && Number.isFinite(Number(yc.spreads.t10y2y))) {
    const v = Number(yc.spreads.t10y2y);
    const hist = Array.isArray(yc.spreadHistory) ? yc.spreadHistory.map((h) => Number(h.v)).filter(Number.isFinite) : [];
    const prev = hist.length >= 2 ? hist[hist.length - 2] : null;
    const d = prev != null ? v - prev : 0;
    out.push({ key: "yc", label: "10Y − 2Y 스프레드", value: `${v > 0 ? "+" : ""}${v.toFixed(2)}`, unit: "%p", delta: d, deltaText: prev != null ? `${d > 0 ? "+" : ""}${d.toFixed(2)}%p` : "", norm: Math.abs(d) / 0.08, note: v < 0 ? "역전(단기>장기)" : "정상(우상향)", tone: v < 0 ? "neg" : "pos" });
  }
  const m = window.MACRO_INDICATORS;
  const macro = (id, label, scale, noteFn) => {
    const it = (m?.indicators || []).find((x) => x.id === id);
    if (!it || !Number.isFinite(Number(it.value))) return;
    const v = Number(it.value);
    const d = Number(it.change) || 0;
    const goodUp = it.tone === "down";
    const tone = d === 0 || it.tone === "neutral" ? "muted" : ((goodUp ? d > 0 : d < 0) ? "pos" : "neg");
    out.push({ key: id, label, value: `${v}`, unit: it.unit || "", delta: d, deltaText: `${d > 0 ? "+" : ""}${d}${it.unit || ""} · ${String(it.date || "").slice(0, 7)}`, norm: Math.abs(d) / scale, note: noteFn ? noteFn(v, d) : "", tone });
  };
  macro("VIXCLS", "VIX 변동성", 1.5, (v) => (v >= 25 ? "불안 구간" : v <= 15 ? "안정 구간" : "보통"));
  macro("BAMLH0A0HYM2", "하이일드 스프레드", 0.12, (v) => (v >= 4 ? "신용 경계" : "신용 양호"));
  macro("DCOILWTICO", "WTI 유가", 3, null);
  macro("DTWEXBGS", "달러지수", 0.8, null);
  // 시장 폭: 상승 종목 비중이 50% 에서 얼마나 벗어났나
  const stocks = (data?.stocks || []).filter((s) => s && s.sector && !isStockEtf(s) && Number.isFinite(Number(s.changePct)));
  if (stocks.length >= 20) {
    const adv = stocks.filter((s) => Number(s.changePct) > 0).length;
    const pct = (adv / stocks.length) * 100;
    const d = pct - 50;
    out.push({ key: "breadth", label: "상승 종목 비중", value: `${pct.toFixed(0)}`, unit: "%", delta: d, deltaText: `${adv.toLocaleString()} / ${stocks.length.toLocaleString()} 종목`, norm: Math.abs(d) / 12, note: pct >= 60 ? "강세 우위" : pct <= 40 ? "약세 우위" : "혼조", tone: pct >= 55 ? "pos" : pct <= 45 ? "neg" : "muted" });
  }
  return out;
}
function renderSignalsSummary() {
  const host = byId("signalsSummary");
  if (!host) return;
  const top = signalCandidates().sort((a, b) => b.norm - a.norm).slice(0, 3);
  if (!top.length) { host.innerHTML = ""; host.hidden = true; return; }
  host.hidden = false;
  host.innerHTML = `
    <div class="section-title"><h2>오늘의 시그널 3개</h2><p>수집한 지표 중 오늘 변화가 가장 큰 세 가지입니다. 예측이 아니라 현재 상태 요약입니다.</p></div>
    <div class="ia-signal-grid">
      ${top.map((s) => `<article class="ia-signal-card ${escapeHtml(s.tone)}">
        <span class="ia-signal-label">${escapeHtml(s.label)}</span>
        <strong class="ia-signal-value">${escapeHtml(s.value)}<small>${escapeHtml(s.unit)}</small></strong>
        <span class="ia-signal-delta">${s.delta > 0 ? "▲" : s.delta < 0 ? "▼" : ""} ${escapeHtml(s.deltaText)}</span>
        ${s.note ? `<span class="ia-signal-note">${escapeHtml(s.note)}</span>` : ""}
      </article>`).join("")}
    </div>`;
}
// 데이터가 없어 비어 있는 위젯 폴드는 껍데기만 남기지 않는다.
function syncSignalFolds() {
  document.querySelectorAll("#tab-signals .ia-widget-fold").forEach((fold) => {
    const body = fold.querySelector(":scope > div");
    fold.hidden = !(body && body.innerHTML.trim());
  });
}

// ----- 내 투자: 빈 상태 + 4숫자 요약 -----
function watchlistIsSeed() {
  const seed = (typeof defaultWatchlist === "function" ? defaultWatchlist() : []) || [];
  if (!Array.isArray(watchlist) || watchlist.length !== seed.length) return false;
  const set = new Set(seed);
  return watchlist.every((t) => set.has(t));
}
function renderMyInvestSummary() {
  const empty = byId("myInvestEmpty");
  const body = byId("myInvestBody");
  const box = byId("myInvestSummary");
  if (!empty || !body) return;
  const hasPortfolio = Array.isArray(portfolio) && portfolio.length > 0;
  // 관심종목은 비면 기본 목록(defaultWatchlist)이 자동으로 채워진다 — 손대지 않은 기본
  // 목록은 '아직 내 종목이 없다' 로 본다. 그래야 첫 방문자에게 빈 상태가 보인다.
  const hasWatch = Array.isArray(watchlist) && watchlist.length > 0 && !watchlistIsSeed();
  const isEmpty = !hasPortfolio && !hasWatch;
  empty.hidden = !isEmpty;
  body.hidden = isEmpty;
  if (!box) return;
  if (!hasPortfolio) {
    box.innerHTML = hasWatch
      ? `<p class="muted">관심종목 ${watchlist.length}개를 추적 중입니다. 보유 종목을 추가하면 평가금액·손익이 여기에 표시됩니다.</p>`
      : `<p class="muted">기본 관심종목을 보고 있습니다. 보유 종목을 추가하면 평가금액·손익이 여기에 표시됩니다.</p>`;
    return;
  }
  const rows = portfolio.map((p) => {
    const stock = stockByTicker(p.ticker);
    if (!stock) return null;
    const price = Number(stock.price) || 0;
    const value = Number(p.qty) * price;
    const cost = Number(p.qty) * Number(p.avgCost);
    return { value, cost, changePct: Number(stock.changePct) || 0 };
  }).filter(Boolean);
  if (!rows.length) { box.innerHTML = `<p class="muted">저장된 ${portfolio.length}개 종목이 현재 시장 스냅샷에 없습니다.</p>`; return; }
  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const pl = totalValue - totalCost;
  const plPct = totalCost > 0 ? (pl / totalCost) * 100 : 0;
  const today = rows.reduce((s, r) => s + (totalValue > 0 ? (r.value / totalValue) * r.changePct : 0), 0);
  const fmt = (v) => marketCfg().formatMoney(v);
  const divTotal = (byId("dividendPlannerTotal")?.textContent || "").trim();
  box.innerHTML = `
    <article class="ia-stat"><span>평가금액</span><strong>${fmt(totalValue)}</strong></article>
    <article class="ia-stat"><span>평가손익</span><strong class="${cls(pl)}">${pl >= 0 ? "+" : "-"}${fmt(Math.abs(pl))} <small>${fmtPct(plPct)}</small></strong></article>
    <article class="ia-stat"><span>오늘</span><strong class="${cls(today)}">${fmtPct(today)}</strong></article>
    <article class="ia-stat"><span>배당 예상</span><strong>${escapeHtml(divTotal || "—")}</strong></article>`;
}

// ----- 찾기: #topPreset ↔ #scrPreset 값 미러(둘 다 살아 있어야 기존 핸들러가 동작) -----
function syncFindPreset(source) {
  const top = byId("topPreset");
  const scr = byId("scrPreset");
  if (!top || !scr) return;
  if (source === scr) { if (top.value !== scr.value) top.value = scr.value; return; }
  if (scr.value !== top.value) {
    scr.value = top.value;
    if (source === top && searchSubTab === "screener") scr.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

// ----- 트리맵 색상: 세그먼트(등락률·밸류·수익성) + 세부 select → #metricFilter 미러 -----
const METRIC_GROUP_SELECT = { change: "metricSelChange", value: "metricSelValue", profit: "metricSelProfit" };
function metricGroupOf(value) {
  for (const [g, id] of Object.entries(METRIC_GROUP_SELECT)) {
    if (byId(id)?.querySelector(`option[value="${value}"]`)) return g;
  }
  return "change";
}
function syncMetricSeg() {
  const master = byId("metricFilter");
  const seg = byId("metricSeg");
  if (!master || !seg) return;
  // 스냅샷에 데이터가 부족해 master 에서 숨긴 지표는 세부 select 에서도 숨긴다.
  Object.values(METRIC_GROUP_SELECT).forEach((id) => {
    byId(id)?.querySelectorAll("option").forEach((opt) => {
      const src = master.querySelector(`option[value="${opt.value}"]`);
      const off = !src || src.hidden || src.disabled;
      opt.hidden = off;
      opt.disabled = off;
    });
  });
  const group = metricGroupOf(master.value);
  seg.querySelectorAll("[data-metric-group]").forEach((btn) => btn.classList.toggle("is-active", btn.dataset.metricGroup === group));
  Object.entries(METRIC_GROUP_SELECT).forEach(([g, id]) => {
    const sel = byId(id);
    if (!sel) return;
    sel.hidden = g !== group;
    if (g === group && sel.value !== master.value) sel.value = master.value;
  });
}
function setupMetricSeg() {
  const master = byId("metricFilter");
  const seg = byId("metricSeg");
  if (!master || !seg || seg.dataset.bound) return;
  seg.dataset.bound = "1";
  const commit = (value) => {
    if (!value || master.value === value) return;
    master.value = value;
    master.dispatchEvent(new Event("change", { bubbles: true }));
  };
  seg.querySelectorAll("[data-metric-group]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sel = byId(METRIC_GROUP_SELECT[btn.dataset.metricGroup]);
      if (!sel) return;
      const first = [...sel.options].find((o) => !o.hidden && !o.disabled);
      const pick = (!sel.selectedOptions[0] || sel.selectedOptions[0].hidden) ? first : sel.selectedOptions[0];
      if (pick) { sel.value = pick.value; commit(pick.value); }
      syncMetricSeg();
    });
  });
  Object.values(METRIC_GROUP_SELECT).forEach((id) => byId(id)?.addEventListener("change", (e) => { commit(e.target.value); syncMetricSeg(); }));
  const legendBtn = byId("heatmapLegendBtn");
  const legendWrap = legendBtn?.closest(".ia-legend-wrap");
  if (legendBtn && legendWrap) {
    const set = (open) => { legendWrap.classList.toggle("is-open", open); legendBtn.setAttribute("aria-expanded", String(open)); };
    legendBtn.addEventListener("click", () => set(!legendWrap.classList.contains("is-open")));
    legendWrap.addEventListener("mouseenter", () => set(true));
    legendWrap.addEventListener("mouseleave", () => set(false));
    document.addEventListener("click", (e) => { if (!legendWrap.contains(e.target)) set(false); });
  }
  syncMetricSeg();
}

// ----- 차트 설정(⋯) 버튼: 기존 <details class="chart-settings-panel"> 를 연다 -----
function setupChartSettingsButton() {
  const btn = byId("chartSettingsBtn");
  const panel = byId("chartSettingsPanel");
  if (!btn || !panel || btn.dataset.bound) return;
  btn.dataset.bound = "1";
  const sync = () => { btn.setAttribute("aria-expanded", String(panel.open)); btn.classList.toggle("is-active", panel.open); };
  btn.addEventListener("click", () => { panel.open = !panel.open; sync(); });
  panel.addEventListener("toggle", sync);
  sync();
}

// ----- 헤더: 설정 팝오버 · 검색 버튼 · data-open 링크(커뮤니티/신뢰도 센터/시장 폭) -----
function setupSettingsPopover() {
  const btn = byId("settingsToggle");
  const pop = byId("settingsPopover");
  if (!btn || !pop || btn.dataset.bound) return;
  btn.dataset.bound = "1";
  const set = (open) => { pop.hidden = !open; btn.setAttribute("aria-expanded", String(open)); };
  btn.addEventListener("click", (e) => { e.stopPropagation(); set(pop.hidden); });
  document.addEventListener("click", (e) => { if (!pop.hidden && !pop.contains(e.target) && e.target !== btn) set(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !pop.hidden) set(false); });
  // 팝오버 안의 이동 항목을 누르면 닫는다(토글류는 열어 둔다).
  pop.querySelectorAll("[data-open], .social-link").forEach((el) => el.addEventListener("click", () => set(false)));
}
function setupHeaderSearch() {
  const btn = byId("headerSearchBtn");
  if (!btn || btn.dataset.bound) return;
  btn.dataset.bound = "1";
  btn.addEventListener("click", () => {
    if (typeof cmdkOpen === "function") { cmdkOpen(); return; }
    const input = byId("homeSearchInput");
    if (input) { input.scrollIntoView({ block: "center", behavior: "smooth" }); input.focus(); }
  });
}
function openDataTrustCenter() {
  const dlg = byId("dataTrustDialog");
  if (!dlg) return;
  renderDataTrustCenter();
  if (!dlg.open) dlg.showModal();
}
function setupDataTrustDialog() {
  const dlg = byId("dataTrustDialog");
  if (!dlg || dlg.dataset.bound) return;
  dlg.dataset.bound = "1";
  byId("dataTrustClose")?.addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
}
function setupOpenLinks() {
  if (document.body.dataset.iaOpenBound) return;
  document.body.dataset.iaOpenBound = "1";
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-open]");
    if (!el) return;
    const what = el.dataset.open;
    if (what === "trust") { openDataTrustCenter(); return; }
    if (what === "community") {
      if (window.MirAI?.isActive?.()) window.MirAI.exit();
      activateTab("community", { sub: el.dataset.openSub || null });
      scrollToTabContent();
      return;
    }
    if (what === "health" || what === "signals" || what === "map" || what === "sector") {
      activateTab(what);
      scrollToTabContent();
    }
  });
}

// ----- 내 투자 빈 상태 폼 + 포트폴리오 표 변화 감시 -----
function setupMyInvestEmpty() {
  const form = byId("myInvestEmptyForm");
  const input = byId("myInvestEmptyInput");
  if (form && input && !form.dataset.bound) {
    form.dataset.bound = "1";
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const raw = input.value.trim();
      if (!raw) return;
      const resolved = normalizeTickerKey(resolveTickerQuery(raw) || raw);
      if (!stockByTicker(resolved)) { showAppToast(`'${raw}' 을(를) 찾지 못했습니다. 티커나 종목명을 확인해 주세요.`); return; }
      // 손대지 않은 기본 목록이면 그 자리를 내 첫 종목으로 바꾼다(기본 5개에 섞이지 않게).
      if (watchlistIsSeed()) {
        watchlist = [resolved];
        persistWatchlist();
        renderWatchlistBar();
        renderActionBoard();
      } else if (!watchlist.includes(resolved)) {
        toggleWatchlist(resolved);
      }
      input.value = "";
      renderMyInvestSummary();
      renderTabContent("bulk", { force: true });
      showAppToast(`${resolved} 을(를) 관심종목에 추가했습니다`);
    });
  }
  const pfTable = byId("pfTable");
  if (pfTable && !pfTable.dataset.iaObserved && typeof MutationObserver === "function") {
    pfTable.dataset.iaObserved = "1";
    new MutationObserver(() => renderMyInvestSummary()).observe(pfTable, { childList: true });
  }
}

// ----- 챗봇 FAB: 첫 방문 1회 말풍선 + 푸터와 겹치지 않게 -----
const CHAT_BUBBLE_SEEN_KEY = "mir_chat_bubble_seen_v1";
function setupChatFabIa() {
  const chat = byId("chatbot");
  const bubble = byId("chatBubble");
  if (!chat || chat.dataset.iaBound) return;
  chat.dataset.iaBound = "1";
  const store = window.safeStorage;
  if (bubble && store && !store.get(CHAT_BUBBLE_SEEN_KEY)) {
    bubble.hidden = false;
    store.set(CHAT_BUBBLE_SEEN_KEY, "1");
    setTimeout(() => { bubble.hidden = true; updateChatSafeArea(); }, 9000);
  }
  const footer = document.querySelector("footer");
  if (footer && typeof IntersectionObserver === "function") {
    new IntersectionObserver((entries) => {
      const en = entries[0];
      // 드래그로 옮긴 뒤(left/top 지정)에는 손대지 않는다.
      if (chat.style.left || chat.style.top || chat.classList.contains("is-chat-open")) return;
      const lift = en.isIntersecting ? Math.ceil(en.intersectionRect.height) : 0;
      chat.style.setProperty("--ia-chat-lift", `${lift}px`);
      chat.classList.toggle("is-footer-lift", lift > 0);
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] }).observe(footer);
  }
}

// ----- 셸 부팅(boot 에서 setupTabs 뒤에 한 번; 재부팅은 각 함수의 bound 플래그가 막는다) -----
function setupIaShell() {
  setupSettingsPopover();
  setupHeaderSearch();
  setupDataTrustDialog();
  setupOpenLinks();
  setupMetricSeg();
  setupChartSettingsButton();
  setupMyInvestEmpty();
  setupChatFabIa();
  const topPreset = byId("topPreset");
  const scrPreset = byId("scrPreset");
  if (topPreset && !topPreset.dataset.iaMirror) {
    topPreset.dataset.iaMirror = "1";
    topPreset.addEventListener("change", () => syncFindPreset(topPreset));
  }
  if (scrPreset && !scrPreset.dataset.iaMirror) {
    scrPreset.dataset.iaMirror = "1";
    scrPreset.addEventListener("change", () => syncFindPreset(scrPreset));
  }
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
  // 첫 로드 순간엔 data 가 아직 fallbackData(6월 하드코딩 타임스탬프)라 나이가
  // 41일로 잡혀 "로컬 과거 데이터 표시 중" 배너가 번쩍 떴다가 실제 스냅샷이
  // 오면 사라졌다. fallback 상태에선 stale 판정을 억제한다 — fetch 실패로
  // 진짜 fallback 에 머무는 경우는 별도의 "데모 데이터 표시 중" 배너가 담당.
  const usingFallback = (data === fallbackData);
  const isStale = !usingFallback && ageHours != null && ageHours > 30;
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
      // fixed+left:50% 의 shrink-to-fit 은 가용폭을 절반으로 잡아 모바일에서 글자가
      // 세로로 흘렀다. max-content 로 펴고 화면폭 안에서만 줄바꿈하게 한다.
      banner.style.width = "max-content";
      banner.style.maxWidth = "calc(100vw - 24px)";
      // 재렌더마다 innerHTML 이 갈리므로 리스너는 배너 자체에 1회만 위임 바인딩.
      banner.addEventListener("click", (event) => {
        if (event.target.closest("#offlineRetryBtn")) retryOnlineRecovery();
      });
      document.body.appendChild(banner);
    }
    const banner = byId("offlineBanner");
    if (banner) {
      banner.innerHTML = `
        <div class="offline-banner-content" style="flex-wrap:wrap;justify-content:center;">
          <span class="offline-icon"></span>
          <strong>${reason}</strong>
          <span>${detail}</span>
          <button type="button" id="offlineRetryBtn" ${offlineRetryBusy ? "disabled" : ""}
            style="margin-left:6px;padding:4px 12px;border-radius:20px;border:1px solid currentColor;background:transparent;color:inherit;font:inherit;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;opacity:${offlineRetryBusy ? ".6" : "1"};white-space:nowrap;">${offlineRetryBusy ? `${OFFLINE_RETRY_SPINNER_SVG}재시도 중` : "재시도"}</button>
          <span id="offlineRetryMsg" class="muted" style="font-size:12px;" hidden></span>
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
// 재시도 버튼용 스피너(장식 이모지 금지 — 얇은 SVG, SMIL 회전이라 CSS 불필요)
const OFFLINE_RETRY_SPINNER_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-dasharray="42" stroke-dashoffset="14" opacity="0.9"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/></circle></svg>`;
let offlineRetryBusy = false;

// 오프라인 배너의 재시도: 온라인 복구 경로(loadData → updateOnlineStatus)를 그대로
// 다시 태운다. 성공하면 updateOnlineStatus 가 배너를 제거하고 복구 토스트를 띄우며,
// 여전히 오프라인이면 배너 안에 조용한 피드백만 남긴다.
async function retryOnlineRecovery() {
  if (offlineRetryBusy) return;
  offlineRetryBusy = true;
  updateOnlineStatus(); // 버튼을 스피너·비활성 상태로 재렌더
  // 실제로 닿는지 가벼운 HEAD 프로브로 먼저 확인한다. 안 닿는데 loadData 를 태우면
  // 스냅샷 fetch 실패 → fallback 데모 데이터로 화면이 격하되는 부작용이 있다.
  let reachable = false;
  if (navigator.onLine) {
    try {
      const probe = await fetch(marketCfg().snapshotPath, { method: "HEAD", cache: "no-store" });
      reachable = probe.ok;
    } catch (_) { reachable = false; }
  }
  try {
    if (reachable) await loadData({ preserveRoute: true });
  } catch (_) { /* 아래 상태 재판정으로 흡수 */ }
  offlineRetryBusy = false;
  updateOnlineStatus();
  const status = window.MirDataStatus || refreshMirDataStatus();
  if (status.showBanner) {
    const msg = byId("offlineRetryMsg");
    if (msg) {
      msg.textContent = status.isOffline ? "아직 연결되지 않았습니다." : "아직 최신 데이터를 받지 못했습니다.";
      msg.hidden = false;
    }
  }
}

window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);
updateOnlineStatus();

// ===== AI Search and Deep Report UI Handler =====
let currentActiveReportTicker = null;
let aiReportBusy = false;

// 지표·용어 약어 중 실제 티커와 겹치는 것들 — 2026-07-24 스냅샷 실측.
// RSI=Rush Street Interactive, PBR=Petrobras, ATR=AptarGroup, EMA=Emera …
// 이것 때문에 "RSI 지표가 뭐야" 같은 용어 질문이 종목 조회로 잡혀 엉뚱한
// 대시보드가 떴다. SPY·QQQ 처럼 사용자가 실제로 그 종목을 묻는 쪽이 자연스러운
// 티커는 일부러 뺐다.
const TERM_TICKER_COLLISIONS = new Set([
  "RSI", "ATR", "ADX", "CCI", "MFI", "SMA", "EMA", "ROC", "PBR", "PEG",
  "FCF", "ETN", "AI", "PMI", "USD", "DTI", "CAC", "MSCI",
]);
const TERM_QUESTION_RE = /(뭐|뭔|무엇|뜻|의미|설명|알려\s*줘|어떻게|어떤|왜|차이|방법|용어|개념|정의|계산|보는\s*법|읽는\s*법|활용|기준|what\s+is|how\s+to|explain|meaning)/i;
const TERM_CONTEXT_RE = /(지표|지수|보조\s*지표|인디케이터|개념|용어)/;
// "관련주"·"테마"는 일부러 뺐다 — 특정 종목이 아니라 테마 질문이라
// ("AI 관련주 알려줘") 티커로 못박으면 C3.ai 대시보드가 뜬다.
const STOCK_INTENT_RE = /(주가|차트|종목|실적|분석해|매수|매도|배당|시총|시가총액|목표주가|공매도|수급|전망|얼마|사도|팔아)/;

// 용어 질문일 때만 충돌 약어를 후보에서 뺀다. 종목 의도가 함께 보이면
// ("RSI 주가 어때") 그대로 티커로 본다. 후보를 통째로 버리지 않고 걸러내므로
// "엔비디아 RSI 뭐야" 는 RSI 만 빠지고 별칭 단계에서 NVDA 로 해석된다.
function filterTermCollisions(candidates, query) {
  if (!candidates || !candidates.length) return candidates;
  const text = String(query || "");
  if (STOCK_INTENT_RE.test(text)) return candidates;
  if (!TERM_QUESTION_RE.test(text) && !TERM_CONTEXT_RE.test(text)) return candidates;
  return candidates.filter((c) => !TERM_TICKER_COLLISIONS.has(String(c).toUpperCase()));
}

function extractStockTickerFromQuery(query) {
  const text = String(query || "").trim().toLowerCase();
  if (!text) return null;

  // 1. Try exact ticker match candidate
  const candidates = filterTermCollisions(extractTickerCandidates(query), query);
  if (candidates && candidates.length > 0) {
    return candidates[0];
  }
  
  // 2. Try Korean nickname / alias lookup
  if (tickerKoAliasEntries) {
    for (const entry of tickerKoAliasEntries) {
      if (text.includes(entry.aliasLower ?? entry.alias.toLowerCase())) {
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

// 종목 AI 리포트 12시간 캐시(localStorage). 키 = 시장·티커·스냅샷 날짜·질의 — 종목을 열 때마다
// LLM 을 부르지 않는다. 스냅샷이 바뀌면(날짜) 자연히 새 키가 된다.
const AI_REPORT_CACHE_KEY = "mir_ai_report_cache_v1";
const AI_REPORT_CACHE_TTL_MS = 12 * 3600 * 1000;
const AI_REPORT_CACHE_MAX = 40;
function aiReportCacheKey(ticker, customQuery) {
  const snapDate = String((data && (data.updatedAtKst || data.updated_at_kst)) || "").slice(0, 10);
  return `${marketCfg().id}|${normalizeTickerKey(ticker)}|${snapDate}|${customQuery || ""}`;
}
function readAiReportCache(key) {
  try {
    const store = JSON.parse(localStorage.getItem(AI_REPORT_CACHE_KEY) || "{}");
    const hit = store[key];
    if (hit && typeof hit.reply === "string" && Date.now() - Number(hit.at || 0) < AI_REPORT_CACHE_TTL_MS) return hit.reply;
  } catch (_) { /* ignore */ }
  return null;
}
function writeAiReportCache(key, reply) {
  try {
    const store = JSON.parse(localStorage.getItem(AI_REPORT_CACHE_KEY) || "{}");
    const now = Date.now();
    Object.keys(store).forEach((k) => { if (now - Number(store[k]?.at || 0) >= AI_REPORT_CACHE_TTL_MS) delete store[k]; });
    store[key] = { at: now, reply };
    const keys = Object.keys(store).sort((a, b) => Number(store[a].at) - Number(store[b].at));
    while (keys.length > AI_REPORT_CACHE_MAX) delete store[keys.shift()];
    localStorage.setItem(AI_REPORT_CACHE_KEY, JSON.stringify(store));
  } catch (_) { /* quota 등 — 캐시는 있으면 좋은 것 */ }
}

async function loadAiDeepReport(ticker, customQuery = null) {
  const stock = stockByTicker(ticker);
  if (!stock) return;

  const card = byId("analysisAiReportCard");
  const body = byId("analysisAiReportBody");
  if (!body) return;

  if (card) card.style.display = "flex";

  currentActiveReportTicker = ticker;

  const cacheKey = aiReportCacheKey(ticker, customQuery);
  const cached = readAiReportCache(cacheKey);
  if (cached) {
    body.innerHTML = formatMarkdownToHtml(stripEmoji(cached));
    if (customQuery) body.dataset.lastQuery = customQuery;
    else delete body.dataset.lastQuery;
    return;
  }

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
    
    if (!res.ok) throw new Error(`report ${res.status}`);
    const payload = await res.json();

    // Check if the ticker has changed during the request
    if (currentActiveReportTicker !== ticker) return;

    const rawReply = payload && typeof payload.reply === "string" ? payload.reply.trim() : "";
    if (rawReply) writeAiReportCache(cacheKey, rawReply);
    const reply = rawReply || "리포트를 불러오는 데 실패했습니다. 잠시 후 다시 시도해 주세요.";
    body.innerHTML = formatMarkdownToHtml(stripEmoji(reply));
    
    if (customQuery) {
      body.dataset.lastQuery = customQuery;
    } else {
      delete body.dataset.lastQuery;
    }
  } catch (err) {
    if (currentActiveReportTicker === ticker) {
      body.innerHTML = `<p class="muted">분석 리포트 로딩 실패: ${escapeHtml(err && err.message ? err.message : String(err))}</p>`;
    }
  }
}

// ===== 크로스마켓 검색 =====
// 검색어를 시장(us/kr)으로 사전 분류한다. 현재 시장 스냅샷에서 못 찾은 쿼리가
// 반대 시장 종목이면(US 모드에서 "삼성전자", KR 모드에서 "NVDA") 시장을 전환해
// 이어서 해석하기 위한 힌트다. 확신이 없으면 null.
function classifyQueryMarket(query) {
  const q = String(query || "").trim();
  if (!q) return null;
  if (/^\d{6}$/.test(q)) return "kr"; // 6자리 국내 종목코드
  const compact = q.replace(/\s+/g, "");
  // 국내 주요 종목 닉네임(스냅샷 없이도 아는 하드코딩 맵)
  for (const aliases of Object.values(KR_TICKER_NICKNAMES)) {
    if ((aliases || []).some((a) => a && compact.includes(String(a).replace(/\s+/g, "")))) return "kr";
  }
  // 한국어 별칭 → 미국 티커 맵(data/ticker_aliases_ko.js). "엔비디아" 등은 US.
  // 한 글자 별칭("델" 등)은 국내 종목명 오탐이 잦아 2자 이상만 본다.
  for (const aliases of Object.values(window.TICKER_ALIASES_KO || {})) {
    if ((aliases || []).some((a) => {
      const alias = String(a || "").replace(/\s+/g, "");
      return alias.length >= 2 && compact.includes(alias);
    })) return "us";
  }
  if (/^[A-Za-z][A-Za-z0-9.\-]{0,5}$/.test(q)) return "us"; // US 티커 형태
  // 공백 없는 짧은 한글은 국내 종목명일 가능성(문장형 질문은 챗봇 폴백으로 남긴다)
  if (/^[가-힣0-9]{2,12}$/.test(q)) return "kr";
  return null;
}

// 현재 시장에서 해석을 시도하고, 실패하면 분류된 반대 시장으로 전환한 뒤
// 새 스냅샷 로드가 끝난 다음(await — 경쟁 금지) 다시 해석한다.
// 전환했는데도 종목이 안 나오면(분류 오판) 원래 시장으로 되돌린다.
async function resolveTickerAcrossMarkets(query) {
  const q = String(query || "").trim();
  if (!q) return null;
  const direct = extractStockTickerFromQuery(q);
  if (direct) return direct;
  const target = classifyQueryMarket(q);
  const origin = marketCfg().id;
  if (!target || target === origin) return null;
  await switchMarketMode(target); // loadData(스냅샷 교체·인덱스 재구축)까지 대기
  const resolved = extractStockTickerFromQuery(q) || resolveTickerQuery(q);
  if (!resolved) {
    await switchMarketMode(origin);
    return null;
  }
  return resolved;
}

// ===== 홈 검색 인텐트 라우터 =====
// MIR INTELLIGENCE 검색창은 "질문에 답하는 챗봇"이 아니라 "질문에 답할 수 있는
// 화면으로 데려다주는 라우터"다. 티커가 잡히면(precedence 최우선) 종목 분석으로,
// 아니면 아래 키워드 표로 해당 탭/서브탭을 연다. 어디에도 안 걸리면 종목 검색으로.
// 규칙: 한국어+영어, 대소문자 무시, "가장 긴(구체적인) 키워드"가 이긴다.
const HOME_ROUTE_RULES = [
  // 시장 지도 / 히트맵 — 페이지 전용어(preempt): 티커 퍼지매칭(코스피→KOSS)보다 먼저 라우팅.
  { tab: "map", preempt: true, keywords: ["히트맵", "트리맵", "시장 지도", "시장지도", "시장 전체", "전체 흐름", "시장 지금", "시장 맵", "heatmap", "treemap", "market map"] },
  // 섹터 흐름 (섹터명 포함)
  { tab: "sector", keywords: ["섹터 흐름", "섹터흐름", "섹터", "업종", "반도체", "2차전지", "이차전지", "배터리", "바이오", "제약", "자동차", "금융", "은행", "방산", "조선", "화학", "인터넷", "게임", "엔터", "sector", "industry"] },
  // 스크리너 (조건 검색) — 페이지 전용어(preempt)
  { tab: "search", sub: "screener", preempt: true, keywords: ["스크리너", "스크리닝", "조건 검색", "조건검색", "종목 발굴", "발굴", "골라줘", "골라", "찾아줘", "필터링", "필터", "screener", "screening"] },
  // 상승확률 스캐너
  { tab: "search", sub: "scanner", keywords: ["상승확률", "상승 확률", "오를 종목", "오를까", "오를", "스캐너", "상승 가능성", "상승가능성", "scanner"] },
  // 주도주 / 상위 / 신고가
  { tab: "search", sub: "top", keywords: ["주도주", "강한 종목", "강한 주식", "강한", "리더", "상위 종목", "상위", "신고가", "모멘텀 강", "leader", "strongest"] },
  // 급등 / 거래량 급증
  { tab: "search", sub: "jump", keywords: ["급등주", "급등", "거래량 급증", "거래량 터", "거래량터", "거래량 폭발", "surge", "gainers"] },
  // 종목 비교
  { tab: "search", sub: "compare", keywords: ["비교", "대비", " vs ", "vs.", "versus", "compare"] },
  // 저평가 / 밸류
  { tab: "search", sub: "valuation", keywords: ["저평가", "밸류에이션", "밸류", "싼 종목", "싼 주식", "per", "pbr", "valuation", "undervalued"] },
  // 공매도
  { tab: "search", sub: "short", keywords: ["공매도", "숏", "short interest", "short"] },
  // 배당
  { tab: "search", sub: "dividend", keywords: ["배당주", "배당금", "배당", "dividend"] },
  // 자사주 / 바이백
  { tab: "search", sub: "buyback", keywords: ["자사주", "바이백", "buyback", "repurchase"] },
  // 증자 / 희석
  { tab: "search", sub: "dilution", keywords: ["유상증자", "증자", "희석", "dilution"] },
  // IPO / 신규 상장
  { tab: "search", sub: "ipo", keywords: ["신규 상장", "신규상장", "공모주", "공모", "따상", "ipo"] },
  // 실적 발표 반응
  { tab: "search", sub: "earnreact", keywords: ["실적 발표 후", "실적발표 후", "실적 반응", "어닝 반응", "실적 서프라이즈", "earnings reaction"] },
  // 공시 / DART
  { tab: "search", sub: "dart", keywords: ["공시", "dart", "전자공시"] },
  // 뉴스
  { tab: "search", sub: "news", keywords: ["뉴스", "헤드라인", "news", "headline"] },
  // 차트 / 기술적
  { tab: "search", sub: "chart", keywords: ["차트", "기술적", "캔들", "candle", "chart"] },
  // 실적 일정 (캘린더) — 실적 "반응"과 구분되도록 긴 키워드 우선
  { tab: "calendar", sub: "earnings", keywords: ["실적 발표 일정", "실적발표 일정", "실적 발표일", "실적발표일", "실적 일정", "어닝 일정", "실적 캘린더", "실적 발표 언제", "earnings calendar", "earnings date"] },
  // 경제 캘린더 / 지표
  { tab: "calendar", keywords: ["경제 지표", "경제지표", "경제 캘린더", "일정", "캘린더", "fomc", "cpi", "지표 발표", "calendar", "economic"] },
  // 매크로 / 마켓 데이터
  { tab: "health", keywords: ["금리", "환율", "매크로", "vix", "국채", "달러", "채권", "인플레이션", "macro", "yield", "rates", "fx"] },
  // AI 브리핑 — 페이지 전용어(preempt): "AI" 티커(C3.ai) 오탐 방지
  { tab: "ai-briefing", preempt: true, keywords: ["ai 브리핑", "브리핑", "오늘 요약", "시장 요약", "오늘의 시장 요약", "briefing"] },
  // 커뮤니티 — 페이지 전용어(preempt)
  { tab: "community", preempt: true, keywords: ["커뮤니티", "토론", "게시판", "인기글", "의견", "투표", "community"] },
  // 시그널
  { tab: "signals", keywords: ["매매 신호", "매매신호", "시그널", "신호", "signal"] },
  // 포트폴리오 / 내 투자
  { tab: "bulk", keywords: ["포트폴리오", "내 투자", "내투자", "수익률", "손익", "리밸런싱", "자산 배분", "자산배분", "보유 종목", "보유종목", "portfolio", "holdings"] },
  // 내부자
  { tab: "institutional", sub: "insider", keywords: ["내부자", "insider"] },
  // 의회 / 정치인
  { tab: "institutional", sub: "congress", keywords: ["의회", "정치인", "congress", "senator", "pelosi"] },
  // 액티비스트 / 행동주의
  { tab: "institutional", sub: "activist", keywords: ["액티비스트", "행동주의", "13d", "activist"] },
  // 기관 / 거장 / 13F
  { tab: "institutional", sub: "13f", keywords: ["기관 보유", "기관보유", "기관", "큰손", "13f", "거장", "버핏", "buffett", "guru"] },
];

// 가장 긴 매칭 키워드를 가진 규칙을 고른다(= 가장 구체적인 규칙 우선).
// preemptOnly=true 면 페이지 전용어(preempt:true) 규칙만 본다 — 티커 해석보다 먼저
// 돌려서 코스피→KOSS, AI→C3.ai 같은 퍼지 티커 오탐을 막는다.
function routeQueryToPage(query, { preemptOnly = false } = {}) {
  const q = String(query || "").toLowerCase();
  if (!q) return null;
  let best = null;
  let bestLen = 0;
  for (const rule of HOME_ROUTE_RULES) {
    if (preemptOnly && !rule.preempt) continue;
    for (const kw of rule.keywords) {
      const k = kw.toLowerCase();
      if (q.includes(k) && k.trim().length > bestLen) {
        bestLen = k.trim().length;
        best = { tab: rule.tab, sub: rule.sub || null };
      }
    }
  }
  return best;
}

// 라우팅 목적지가 현재 시장에서 숨겨졌는지 판정한다. 숨겨졌으면 종목 검색으로 폴백.
// (activateTab 은 hiddenTabs 는 스스로 search 로 폴백하지만, 시장별로 숨는 서브탭까지는
// 검사하지 않으므로 여기서 미리 걸러낸다 — 예: KR 의 기관/내부자/의회 서브탭.)
function homeRouteHidden(tab, sub, cfg = marketCfg()) {
  const norm = normalizeTabRequest(tab, sub);
  tab = norm.tab;
  sub = norm.sub;
  if (tab === "search" && sub) return searchSubTabHidden(sub, cfg);
  if (tab === "institutional" && sub) {
    if ((cfg.hiddenInstitutionalSubs || []).includes(sub)) return true;
    const f = cfg.features || {};
    if (sub === "congress" && f.congress === false) return true;
    if (sub === "13f" && f.sec13f === false) return true;
    if (sub === "insider" && f.insider === false) return true;
    if (sub === "activist" && f.activist === false) return true;
  }
  if (tab === "calendar" && sub === "earnings") {
    const f = cfg.features || {};
    if (f.earningsCalendar === false) return true;
  }
  return false;
}

async function handleHomeSearch(query) {
  const q = String(query || "").trim();
  if (!q) return;

  // 페이지 전용어(히트맵·브리핑·스크리너·커뮤니티 등)는 특정 종목 의도가 아니므로
  // 티커 퍼지매칭보다 먼저 라우팅한다(코스피→KOSS, AI→C3.ai 오탐 차단).
  const preempt = routeQueryToPage(q, { preemptOnly: true });
  if (preempt && !homeRouteHidden(preempt.tab, preempt.sub)) {
    activateTab(preempt.tab, { sub: preempt.sub || null });
    return;
  }

  const matchedTicker = await resolveTickerAcrossMarkets(q);
  if (matchedTicker) {
    // resolveTickerAcrossMarkets 가 필요하면 이미 시장을 바꿔 두었다 — 현재 시장이 곧 대상 시장.
    // (예전 `stock.market === "kospi" || "kosdaq"` 은 항상 참이라 KR ETF(market "etf")가 US 로 넘어갔다.)
    if (stockByTicker(matchedTicker)) navigateToStockAnalysis(matchedTicker, q);
    return;
  }

  // 티커가 안 잡히면 인텐트 라우터로 "답할 수 있는 화면"을 연다. 챗봇은 더 이상 열지 않는다.
  const route = routeQueryToPage(q);
  if (route && !homeRouteHidden(route.tab, route.sub)) {
    activateTab(route.tab, { sub: route.sub || null });
    return;
  }

  // 어디에도 안 걸리거나 목적지가 이 시장에서 숨겨졌으면 → 종목 검색(분석)으로 폴백.
  navigateHomeSearchFallback(q);
}

// 라우팅 실패 시 종목 검색 화면으로 안내한다. 티커가 없으므로 조립 애니메이션 대신
// 현재 선택 종목의 분석을 보여주고, 사용자가 입력한 질문은 종목 검색 입력창에 남긴다.
function navigateHomeSearchFallback(query) {
  activateTab("search", { sub: "analysis" });
  const input = byId("tickerSearch");
  if (input && query) {
    input.value = query;
  }
  const panel = byId("sub-analysis");
  if (panel) {
    setTimeout(() => panel.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  }
}

function navigateToStockAnalysis(ticker, query, { animate = true } = {}) {
  // 탭 버튼 .click() 흉내(히스토리 2회 push) 대신 직접 활성화. 종목 렌더는 아래 selectTicker 가 한 번.
  activateTab("search", { sub: "analysis", push: currentTab !== "search" || searchSubTab !== "analysis", skipRender: true });
  const analysisPanel = byId("sub-analysis");
  if (analysisPanel) {
    setTimeout(() => {
      analysisPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  }
  if (!animate) {
    // 명령 팔레트 등 즉시 이동: 조립 애니메이션 없이 렌더 + 리포트(자동 리포트는 건너뛰고 질의로 1회).
    selectTicker(ticker, { skipAiReport: true });
    loadAiDeepReport(ticker, query);
    return;
  }
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

// Initialize AI Chat Mode Events
setupAiChatModeEvents();
setupAiStreamStopEvents();

// ===== Ctrl+K 커맨드 팔레트 =====
// 앱 다이얼로그(app-dialog)와 같은 디자인 토큰의 오버레이 팔레트.
// Ctrl+K(또는 AI 모드에서 입력 중이 아닐 때 /)로 열고, ↑↓ + Enter, Esc 로 조작.
const cmdkState = { open: false, index: 0, items: [] };

function cmdkEnsureDom() {
  let overlay = byId("cmdkOverlay");
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.id = "cmdkOverlay";
  overlay.className = "cmdk-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="cmdk" role="dialog" aria-modal="true" aria-label="커맨드 팔레트">
      <div class="cmdk-input-row">
        <span class="cmdk-glyph" aria-hidden="true">⌘</span>
        <input id="cmdkInput" type="text" placeholder="명령 또는 종목 검색  (예: 새 대화, NVDA, 삼성전자)" autocomplete="off" spellcheck="false">
        <kbd>Esc</kbd>
      </div>
      <ul id="cmdkList" class="cmdk-list" role="listbox"></ul>
      <div class="cmdk-foot"><span>↑↓ 이동</span><span>Enter 실행</span><span>Ctrl+K 닫기</span></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) cmdkClose();
  });
  const input = overlay.querySelector("#cmdkInput");
  input.addEventListener("input", () => cmdkRender(input.value));
  return overlay;
}

function cmdkIsAiActive() {
  return !!(window.MirAI && typeof window.MirAI.isActive === "function"
    ? window.MirAI.isActive()
    : document.body.classList.contains("ai-mode-active"));
}

// 부분일치 > 순차(subsequence) 일치 순의 단순 퍼지 점수. 0 이면 탈락.
function cmdkFuzzyScore(label, query) {
  const l = label.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return 1;
  const idx = l.indexOf(q);
  if (idx >= 0) return 100 - idx;
  let li = 0;
  for (let qi = 0; qi < q.length; qi += 1) {
    const ch = q[qi];
    if (ch === " ") continue;
    li = l.indexOf(ch, li);
    if (li < 0) return 0;
    li += 1;
  }
  return 10;
}

function cmdkBuildActions(query) {
  const aiActive = cmdkIsAiActive();
  const actions = [];

  // 종목 검색 (티커·회사명·한글 별칭) — AI 모드면 AI 질문, 아니면 분석 탭 이동
  const q = String(query || "").trim();
  if (q.length >= 1) {
    const seen = new Set();
    const pushStock = (row) => {
      if (!row || seen.has(row.ticker) || seen.size >= 5) return;
      seen.add(row.ticker);
      actions.push({
        label: `${row.ticker} · ${row.company || ""}`,
        hint: aiActive ? "AI 모드 분석" : "종목 분석 이동",
        keep: true, // 종목은 퍼지 재필터 없이 그대로 노출
        run: () => {
          if (aiActive && window.MirAI?.queryStock) {
            const input = byId("aiChatInput");
            if (input) input.value = `${row.ticker} 분석해줘`;
            window.MirAI.queryStock(`${row.ticker} 분석해줘`);
          } else {
            navigateToStockAnalysis(row.ticker, `${row.ticker} 분석`, { animate: false });
          }
        },
      });
    };
    try {
      const resolved = extractStockTickerFromQuery(q);
      if (resolved) pushStock(stockByTicker(resolved));
    } catch (_) { /* ignore */ }
    const ql = q.toLowerCase();
    ((data && data.stocks) || []).some((row) => {
      if (String(row.ticker || "").toLowerCase().startsWith(ql)
        || String(row.company || "").toLowerCase().includes(ql)) pushStock(row);
      return seen.size >= 5;
    });
  }

  actions.push({ label: "새 대화 시작", hint: "AI 모드", run: () => {
    if (!aiActive) window.MirAI?.toggle?.(true);
    document.body.classList.remove("ai-conversation-view");
    startNewAiChatSession();
  } });
  actions.push({ label: "대화 내보내기 (.md)", hint: "현재 세션", run: () => exportAiChatMarkdown() });
  actions.push({ label: "테마 전환 (다크/라이트)", hint: "화면", run: () => byId("themeToggle")?.click() });
  if (selectedTicker) actions.push({ label: `종목 링크 복사 (${selectedTicker})`, hint: "공유", run: () => byId("shareTickerLink")?.click() });
  if (aiActive) {
    actions.push({ label: "AI 모드 나가기", hint: "Esc", run: () => window.MirAI?.exit?.() });
  } else {
    actions.push({ label: "AI 모드 열기", hint: "임머시브 리서치", run: () => window.MirAI?.toggle?.(true) });
  }

  // 주요 화면 이동 — 4탭 IA 의 잎(서브탭)까지 포함해 ⌘K 로 어디든 간다.
  const goto = (label, tab, sub = null) => actions.push({ label: `이동: ${label}`, hint: "화면", run: () => {
    if (cmdkIsAiActive()) window.MirAI?.exit?.();
    activateTab(tab, { sub });
    scrollToTabContent();
  } });
  goto("오늘 · 요약", "today");
  goto("오늘 · AI 브리핑", "ai-briefing");
  goto("오늘 · 캘린더", "calendar");
  goto("시장 · 트리맵", "map");
  goto("시장 · 섹터 흐름", "sector");
  goto("시장 · 시장 폭", "health");
  goto("시장 · 시그널", "signals");
  goto("종목 · 분석", "search", "analysis");
  goto("종목 · 찾기 (스크리너·스캐너)", "search", "find");
  goto("종목 · 비교", "search", "compare");
  goto("종목 · 공시 (13F·정치인·내부자·DART)", "search", "disclosures");
  goto("내 투자 · 보유·관심", "bulk", "holdings");
  goto("내 투자 · 도구", "bulk", "tools");
  goto("커뮤니티 · 트렌딩", "community", "trending");
  goto("커뮤니티 · 종목 토론", "community", "board");
  goto("커뮤니티 · 투표", "community", "vote");
  actions.push({ label: "데이터 신뢰도 센터", hint: "데이터 상태", run: () => openDataTrustCenter() });
  actions.push({ label: "설정 (테마·밀도·고급 모드)", hint: "헤더", run: () => byId("settingsToggle")?.click() });
  actions.push({ label: "고급 모드 전환", hint: "설정", run: () => setViewMode(currentViewMode === "advanced" ? "basic" : "advanced") });

  // 퍼지 필터 (종목 결과는 이미 질의로 골라졌으므로 keep)
  return actions
    .map((a) => ({ ...a, _s: a.keep ? 1000 : cmdkFuzzyScore(a.label, q) }))
    .filter((a) => a._s > 0)
    .sort((a, b) => b._s - a._s)
    .slice(0, 12);
}

function cmdkRender(query) {
  const list = byId("cmdkList");
  if (!list) return;
  cmdkState.items = cmdkBuildActions(query);
  cmdkState.index = Math.min(cmdkState.index, Math.max(0, cmdkState.items.length - 1));
  if (!cmdkState.items.length) {
    list.innerHTML = `<li class="cmdk-empty muted">일치하는 명령이 없습니다.</li>`;
    return;
  }
  list.innerHTML = cmdkState.items.map((a, i) => `
    <li class="cmdk-item${i === cmdkState.index ? " is-active" : ""}" role="option" aria-selected="${i === cmdkState.index}" data-index="${i}">
      <span class="cmdk-label">${escapeHtml(a.label)}</span>
      <span class="cmdk-hint">${escapeHtml(a.hint || "")}</span>
    </li>`).join("");
  list.querySelectorAll(".cmdk-item").forEach((el) => {
    el.addEventListener("click", () => cmdkRun(Number(el.dataset.index)));
    el.addEventListener("mousemove", () => {
      const i = Number(el.dataset.index);
      if (i !== cmdkState.index) { cmdkState.index = i; cmdkHighlight(); }
    });
  });
}

function cmdkHighlight() {
  const list = byId("cmdkList");
  if (!list) return;
  list.querySelectorAll(".cmdk-item").forEach((el) => {
    const on = Number(el.dataset.index) === cmdkState.index;
    el.classList.toggle("is-active", on);
    el.setAttribute("aria-selected", on ? "true" : "false");
    if (on) el.scrollIntoView({ block: "nearest" });
  });
}

function cmdkRun(index) {
  const action = cmdkState.items[index];
  if (!action) return;
  cmdkClose();
  try { action.run(); } catch (_) { /* ignore */ }
}

function cmdkOpen() {
  const overlay = cmdkEnsureDom();
  overlay.hidden = false;
  cmdkState.open = true;
  cmdkState.index = 0;
  const input = overlay.querySelector("#cmdkInput");
  input.value = "";
  cmdkRender("");
  requestAnimationFrame(() => input.focus());
}

function cmdkClose() {
  const overlay = byId("cmdkOverlay");
  if (overlay) overlay.hidden = true;
  cmdkState.open = false;
}

function setupCommandPalette() {
  if (setupCommandPalette._bound) return; // 부팅 재진입 가드
  setupCommandPalette._bound = true;
  document.addEventListener("keydown", (e) => {
    // 팔레트가 열려 있을 때의 키 조작 (capture 로 다른 전역 핸들러보다 먼저)
    if (cmdkState.open) {
      if (e.key === "Escape") {
        e.preventDefault(); e.stopPropagation(); cmdkClose(); return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault(); e.stopPropagation();
        const n = cmdkState.items.length;
        if (!n) return;
        cmdkState.index = (cmdkState.index + (e.key === "ArrowDown" ? 1 : n - 1)) % n;
        cmdkHighlight();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault(); e.stopPropagation(); cmdkRun(cmdkState.index); return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault(); e.stopPropagation(); cmdkClose(); return;
      }
      return;
    }
    // 열기: Ctrl+K 어디서나, / 는 AI 모드에서 입력 중이 아닐 때
    if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
      e.preventDefault(); e.stopPropagation(); cmdkOpen(); return;
    }
    if (e.key === "/" && cmdkIsAiActive()) {
      const el = document.activeElement;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (!typing) { e.preventDefault(); e.stopPropagation(); cmdkOpen(); }
    }
  }, true);
}
setupCommandPalette();
