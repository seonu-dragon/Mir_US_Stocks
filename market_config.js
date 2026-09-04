/**
 * US / Korea market mode configuration.
 * Loaded before app.js; exposes window.MirMarket helpers.
 */
(function () {
  const STORAGE_KEY = "mir_market_mode_v2";
  const DEFAULT_MARKET_MODE = "us";

  // storage.js(첫 스크립트) 가 보장하는 window.safeStorage 를 쓴다. 인라인 폴백은 제거(2026-09-04).
  const storage = window.safeStorage;

  const US = {
    id: "us",
    label: "미국",
    brandAccent: "미국 주식",
    eyebrow: "Financial Visualizations / US Stock Market Analysis",
    pageTitle: "미르의 미국 주식",
    currency: "USD",
    currencySymbol: "$",
    snapshotPath: "data/market_snapshot.json",
    snapshotJsPath: "data/market_snapshot.js",
    snapshotJsGlobal: "MARKET_SNAPSHOT",
    detailsDir: "data/details",
    defaultBucket: "idx_sp500",
    defaultTicker: "NVDA",
    searchPlaceholder: "한국어·티커·영문 (예: 테슬라, NVIDIA)",
    cardnewsDefault: "us",
    snapshotCadence: "매일 06:00 KST",
    liveTickerSuffix: "",
    formatTicker: (t) => String(t || "").toUpperCase(),
    yahooTicker: (t) => String(t || "").toUpperCase().replace(/\./g, "-"),
    buckets: [
      ["watchlist", "내 관심종목"],
      ["portfolio", "내 보유종목"],
      ["all", "All US Stocks"],
      ["all_with_etf", "All incl. ETFs"],
      ["idx_sp500", "S&P 500"],
      ["idx_ndx100", "Nasdaq 100"],
      ["idx_nasdaq", "Nasdaq Listed"],
      ["idx_nyse", "NYSE Listed"],
      ["gte10b", "Stocks >= 10B"],
      ["1to10b", "Stocks 1B-10B"],
      ["lt1b", "Stocks < 1B"],
      ["all_misc", "ETF / Misc"],
    ],
    groupLabels: {
      idx_sp500: "S&P 500",
      idx_ndx100: "Nasdaq 100",
      idx_nasdaq: "Nasdaq",
      idx_nyse: "NYSE",
      gte10b: "Mega Cap",
      "1to10b": "Mid Cap",
      lt1b: "Small Cap",
      all_misc: "ETF",
    },
    sectorEtfs: [
      { ticker: "XLK", name: "정보기술 (Technology)", desc: "Technology Select Sector SPDR ETF", sectorName: "TECHNOLOGY" },
      { ticker: "SOXX", name: "반도체 (Semiconductors)", desc: "iShares Semiconductor ETF", sectorName: "Semiconductors" },
      { ticker: "XLF", name: "금융 (Financials)", desc: "Financial Select Sector SPDR ETF", sectorName: "FINANCIAL" },
      { ticker: "XLE", name: "에너지 (Energy)", desc: "Energy Select Sector SPDR ETF", sectorName: "ENERGY" },
      { ticker: "XLV", name: "헬스케어 (Health Care)", desc: "Health Care Select Sector SPDR ETF", sectorName: "HEALTHCARE" },
      { ticker: "XLU", name: "유틸리티 (Utilities)", desc: "Utilities Select Sector SPDR ETF", sectorName: "UTILITIES" },
    ],
    etfBenchmarks: ["SPY", "QQQ", "TQQQ", "DIA", "IWM"],
    // 포트폴리오 벤치마크 비교·백테스트 셀렉트 옵션([티커, 라벨]). 시장별로 다르다 —
    // KR 모드에서 SPY 를 기본값으로 두면 korea/details/SPY.json 404 가 난다.
    backtestBenchmarks: [
      ["SPY", "S&P 500"],
      ["QQQ", "Nasdaq 100"],
      ["DIA", "다우존스"],
      ["IWM", "러셀 2000"],
      ["VTI", "전체 시장"],
      ["VOO", "S&P 500 (VOO)"],
      ["XLK", "기술 섹터"],
      ["SOXX", "반도체"],
    ],
    backtestDefaultInvestment: 10000,
    indexAnalysisMap: {
      "^DJI": "DIA",
      "^IXIC": "QQQ",
      "^GSPC": "SPY",
      "^RUT": "IWM",
    },
    hiddenTabs: [],
    hiddenInstitutionalSubs: [],
    features: {
      congress: true,
      sec13f: true,
      insider: true,
      activist: true,
      materialEvents: true,
      ipo: true,
      shortInterest: true,
      whiteHouse: true,
      finraShortVolume: true,
      earningsCalendar: true,
    },
    matchBucket(item, groups, bucket) {
      if (bucket === "watchlist") return window._mirWatchlistMatch?.(item) ?? false;
      if (bucket === "portfolio") return window._mirPortfolioMatch?.(item) ?? false;
      if (bucket === "all") return item.sector !== "EXCHANGE TRADED FUNDS" && item.sector !== "ETF";
      if (bucket === "all_with_etf") return true;
      if (bucket === "gte10b") return item.sector !== "EXCHANGE TRADED FUNDS" && item.sector !== "ETF" && Number(item.marketCapB || 0) >= 10;
      if (bucket === "1to10b") {
        const cap = Number(item.marketCapB || 0);
        return item.sector !== "EXCHANGE TRADED FUNDS" && item.sector !== "ETF" && cap >= 1 && cap < 10;
      }
      if (bucket === "lt1b") return item.sector !== "EXCHANGE TRADED FUNDS" && item.sector !== "ETF" && Number(item.marketCapB || 0) < 1;
      return groups.includes(bucket) || item.bucket === bucket;
    },
    formatPrice(value) {
      const n = Number(value);
      if (!Number.isFinite(n)) return "-";
      // 주가는 $1,000 미만이면 센트까지 고정(예: $12.50 이 "$12.5" 로 찍히지 않게).
      const digits = Math.abs(n) < 1000 ? 2 : 0;
      return `$${n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: 2 })}`;
    },
    // 금액(평가액·손익 등): 소수는 있으면 최대 2자리, 없으면 생략.
    formatMoney(value) {
      const n = Number(value);
      if (!Number.isFinite(n)) return "-";
      return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    },
    // 큰 금액(백테스트 투자금·평가액): 정수 달러.
    formatMoneyWhole(value) {
      const n = Number(value);
      if (!Number.isFinite(n)) return "-";
      return `$${Math.round(n).toLocaleString("en-US")}`;
    },
    // 가격 입력칸(type=number)에 넣을 값. KRW 는 정수, USD 는 센트까지.
    priceInputValue(value) {
      const n = Number(value);
      return Number.isFinite(n) ? n.toFixed(2) : "";
    },
    formatMarketCap(value) {
      const num = Number(value);
      if (!Number.isFinite(num)) return "-";
      if (Math.abs(num) >= 1000) return `${(num / 1000).toFixed(2)}T`;
      if (Math.abs(num) >= 1) return `${num.toFixed(2)}B`;
      return `${(num * 1000).toFixed(0)}M`;
    },
  };

  const KR = {
    id: "kr",
    label: "한국",
    brandAccent: "한국 주식",
    eyebrow: "Financial Visualizations / Korea Stock Market Analysis",
    pageTitle: "미르의 한국 주식",
    currency: "KRW",
    currencySymbol: "₩",
    snapshotPath: "data/korea/market_snapshot.json",
    snapshotJsPath: "data/korea/market_snapshot.js",
    snapshotJsGlobal: "KOREA_MARKET_SNAPSHOT",
    detailsDir: "data/korea/details",
    defaultBucket: "idx_kospi_stock",
    defaultTicker: "005930",
    searchPlaceholder: "종목명·종목코드 (예: 삼성전자, 005930)",
    cardnewsDefault: "kr",
    snapshotCadence: "매일 15:40 KST",
    liveTickerSuffix: ".KS",
    formatTicker: (t) => {
      // 국내 코드(005930)는 6자리로 채우되, 숫자가 아닌 티커는 그대로 둔다.
      // 무조건 padStart 하면 국내 모드에서 열린 미국 딥링크가 "AAPL" → "00AAPL"
      // 로 변형돼 analysis.html?t=AAPL 이 "데이터를 찾을 수 없습니다" 가 됐다.
      const raw = String(t || "").replace(/\.(KS|KQ)$/i, "");
      return /^\d{1,6}$/.test(raw) ? raw.padStart(6, "0") : raw.toUpperCase();
    },
    yahooTicker(itemOrTicker, market) {
      const raw = typeof itemOrTicker === "object"
        ? (itemOrTicker.yahooSymbol || itemOrTicker.ticker)
        : itemOrTicker;
      const rawCode = String(raw || "").replace(/\.(KS|KQ)$/i, "");
      const code = /^\d{1,6}$/.test(rawCode) ? rawCode.padStart(6, "0") : rawCode;
      if (String(raw).includes(".KQ") || market === "kosdaq") return `${code}.KQ`;
      if (String(raw).includes(".KS") || market === "kospi" || market === "etf") return `${code}.KS`;
      return `${code}.KS`;
    },
    buckets: [
      ["watchlist", "내 관심종목"],
      ["portfolio", "내 보유종목"],
      ["all", "전체 한국 주식"],
      ["all_with_etf", "ETF 포함 전체"],
      ["idx_kospi_stock", "코스피 개별 종목"],
      ["idx_kospi", "코스피"],
      ["idx_kospi200", "코스피 200"],
      ["idx_kosdaq", "코스닥"],
      ["idx_kosdaq150", "코스닥 150"],
      ["gte10t", "시총 10조 이상"],
      ["gte1t", "시총 1조~10조"],
      ["gte100b", "시총 1천억~1조"],
      ["lt100b", "시총 1천억 미만"],
      ["all_misc", "ETF / 기타"],
    ],
    groupLabels: {
      idx_kospi: "코스피",
      idx_kospi200: "코스피200",
      idx_kosdaq: "코스닥",
      idx_kosdaq150: "코스닥150",
      gte10t: "10조+",
      gte1t: "1조+",
      gte100b: "1천억+",
      lt100b: "소형",
      all_misc: "ETF",
      all_etf: "ETF",
    },
    sectorEtfs: [
      { ticker: "069500", name: "KODEX 200", desc: "코스피 200 추종 ETF", sectorName: "대형주" },
      { ticker: "091160", name: "KODEX 반도체", desc: "반도체 섹터 ETF", sectorName: "기술" },
      { ticker: "091170", name: "KODEX 은행", desc: "은행 섹터 ETF", sectorName: "금융" },
      { ticker: "091180", name: "KODEX 자동차", desc: "자동차 섹터 ETF", sectorName: "산업재" },
      { ticker: "305720", name: "KODEX 2차전지", desc: "2차전지 섹터 ETF", sectorName: "기술" },
      { ticker: "244580", name: "KODEX 바이오", desc: "바이오 섹터 ETF", sectorName: "헬스케어" },
    ],
    etfBenchmarks: ["069500", "102110", "091160"],
    backtestBenchmarks: [
      ["069500", "KODEX 200"],
      ["102110", "TIGER 200"],
      ["229200", "KODEX 코스닥150"],
      ["091160", "KODEX 반도체"],
    ],
    backtestDefaultInvestment: 10000000,
    indexAnalysisMap: {
      "^KS11": "069500",
      "^KQ11": "229200",
    },
    hiddenTabs: [],
    hiddenInstitutionalSubs: ["congress", "13f", "insider", "activist", "events"],
    features: {
      congress: false,
      sec13f: false,
      insider: false,
      activist: false,
      materialEvents: false,
      ipo: true,
      // KRX 공매도 잔고 실연동(2026-07-21). build_kr_short_interest.py 가 pykrx 포크로
      // KRX 회원 로그인(KRX_ID/KRX_PW) 후 종목별 잔고비중을 수집한다. 국내는 US 의
      // 'Days to Cover' 가 없어 잔고비중(잔고÷상장주식수)을 1차 지표로 쓴다
      // (payload.metric="balance"). 자격증명이 없으면 빌더가 0건으로 끝나 파일이 안 생기고,
      // 그때는 이 패널이 '데이터 없음'을 표시한다.
      shortInterest: true,
      whiteHouse: false,
      // 국내는 '실적 발표 예정일' 소스가 없다. build_kr_earnings.py 가 만드는 건
      // 지나간 분기 실적(매출·영업이익)이고, 그 빌더도 "애널리스트 추정치가 없어
      // 서프라이즈는 제공하지 않는다"고 적어 두었다. 워커의 Yahoo 조회도 KR 티커에
      // 대해 빈 배열을 준다(005930.KS 등 4종 실측 → {"earnings":[]}).
      // 있지도 않은 data/korea/earnings_calendar.js 를 계속 요청해 404 를 냈고,
      // 매 방문마다 4.4초짜리 워커 왕복 뒤 빈 화면만 남았다. 실데이터가 생기기 전엔
      // 닫아 둔다 — 공매도와 같은 판단이다.
      earningsCalendar: false,
      // 돌파/되돌림 통계(build_breakout_retest.py)는 US 만 산출한다.
      // 없는 파일을 요청해 콘솔에 404 를 남기지 않도록 꺼 둔다.
      breakoutStats: false,
      // FINRA 일일 공매도 거래량은 US 전용 데이터(finraShort, usOnly). AI 모드 패널 게이트용.
      finraShortVolume: false,
      krDart: true,
      krOwnership: true,
    },
    matchBucket(item, groups, bucket) {
      if (bucket === "watchlist") return window._mirWatchlistMatch?.(item) ?? false;
      if (bucket === "portfolio") return window._mirPortfolioMatch?.(item) ?? false;
      const stockOnly = !isKrEtfLike(item);
      if (bucket === "all") return stockOnly;
      if (bucket === "all_with_etf") return true;
      if (bucket === "idx_kospi_stock") return stockOnly && item.market === "kospi";
      // marketCapT 만 쓴다. marketCapB 는 US 스냅샷에선 '십억 달러', KR 빌더에선
      // marketCapT 의 별칭(조원)이라 폴백으로 섞으면 단위가 뒤바뀐다.
      const capT = Number(item.marketCapT ?? 0);
      if (bucket === "gte10t") return stockOnly && capT >= 10;
      if (bucket === "gte1t") return stockOnly && capT >= 1 && capT < 10;
      if (bucket === "gte100b") return stockOnly && capT >= 0.1 && capT < 1;
      if (bucket === "lt100b") return stockOnly && capT < 0.1;
      if (bucket === "idx_kospi" || bucket === "idx_kospi200" || bucket === "idx_kosdaq" || bucket === "idx_kosdaq150") {
        return stockOnly && (groups.includes(bucket) || item.bucket === bucket);
      }
      return groups.includes(bucket) || item.bucket === bucket;
    },
    formatPrice(value) {
      const n = Number(value);
      if (!Number.isFinite(n)) return "-";
      return `${Math.round(n).toLocaleString("ko-KR")}원`;
    },
    formatMoney(value) {
      return this.formatPrice(value);
    },
    formatMoneyWhole(value) {
      return this.formatPrice(value);
    },
    priceInputValue(value) {
      const n = Number(value);
      return Number.isFinite(n) ? String(Math.round(n)) : "";
    },
    formatMarketCap(value) {
      const num = Number(value);
      if (!Number.isFinite(num)) return "-";
      if (num >= 1) return `${num.toFixed(2)}조`;
      return `${(num * 10000).toFixed(0)}억`;  // 1조 = 10,000억
    },
  };

  function getMode() {
    return window.MIR_MARKET_MODE === "kr" ? "kr" : "us";
  }

  function isKrEtfLike(item) {
    const text = `${item?.company || ""} ${item?.industry || ""} ${item?.sector || ""}`.toUpperCase();
    return item?.market === "etf"
      || item?.sector === "ETF"
      || text.includes(" ETF")
      || text.includes(" ETN")
      || /^(KODEX|TIGER|ACE|RISE|KBSTAR|SOL|ARIRANG|HANARO)\b/.test(text);
  }

  function getConfig(mode) {
    return (mode || getMode()) === "kr" ? KR : US;
  }

  function getInitialMode() {
    try {
      const params = new URLSearchParams(window.location.search);
      const q = params.get("market");
      if (q === "kr" || q === "us") return q;
      const saved = storage.get(STORAGE_KEY);
      if (saved === "kr" || saved === "us") return saved;
    } catch (_) {}
    return DEFAULT_MARKET_MODE;
  }

  function setMode(mode, options) {
    const next = mode === "kr" ? "kr" : "us";
    window.MIR_MARKET_MODE = next;
    storage.set(STORAGE_KEY, next);
    document.documentElement.setAttribute("data-market", next);
    const cfg = getConfig(next);
    document.title = cfg.pageTitle;
    const accent = document.querySelector(".brand-accent");
    if (accent) accent.textContent = cfg.brandAccent;
    const eyebrow = document.querySelector(".brand-text .eyebrow");
    if (eyebrow) eyebrow.textContent = cfg.eyebrow;
    if (!options?.skipButtons) {
      document.querySelectorAll("[data-market-mode]").forEach((btn) => {
        const active = btn.dataset.marketMode === next;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }
    return next;
  }

  function detailPath(ticker) {
    const cfg = getConfig();
    const key = cfg.id === "kr" ? cfg.formatTicker(ticker) : String(ticker || "").toUpperCase();
    return `${cfg.detailsDir}/${encodeURIComponent(key)}.json`;
  }

  window.MirMarket = {
    US,
    KR,
    getMode,
    getConfig,
    getInitialMode,
    setMode,
    detailPath,
    isKrEtfLike,
    STORAGE_KEY,
  };
  window.MIR_MARKET_MODE = getInitialMode();
  document.documentElement.setAttribute("data-market", window.MIR_MARKET_MODE);
  if (window.MIR_MARKET_MODE === DEFAULT_MARKET_MODE) {
    storage.set(STORAGE_KEY, DEFAULT_MARKET_MODE);
  }
})();
