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
let selectedEtfRsCategory = null;
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
const detailCache = {};
const detailPromises = {};

// Optional Cloudflare Worker proxy that fetches Yahoo news + real charts live when a
// stock-analysis page opens. Leave "" to fall back to the pre-generated detail files.
// After deploying worker/yahoo-proxy.js, paste its URL here, e.g.
//   const LIVE_DATA_PROXY = "https://mir-yahoo.yourname.workers.dev";
const LIVE_DATA_PROXY = "https://mirusstocks.planbesides.workers.dev";
const liveNewsCache = {};
const liveChartCache = {};
const liveSummaryCache = {};
const liveFetched = {};
const liveDone = {};

let chartState = {
  range: "1Y",
  barTf: "D", // D=일봉, W=주봉, M=월봉
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
  showVolume: true,
  showRsi: true,
  showMacd: false,
  showStoch: false
};

const fmtPct = (value) => `${value > 0 ? "+" : ""}${Number(value).toFixed(1)}%`;
const cls = (value) => value > 0 ? "pos" : value < 0 ? "neg" : "muted";
const byId = (id) => document.getElementById(id);

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
  if (route.get("ticker")) selectedTicker = route.get("ticker").toUpperCase();
  byId("updatedAt").textContent = data.updatedAtKst || data.updated_at_kst || "스냅샷 데이터";
  renderCardNews();
  setupLightbox();
  setupChatbot();
  renderSummary();
  setupTabs();
  setupFilters();
  renderAll();
  setupEvents();
  setupBriefingToggles();
  fetchMarketHeader();
  history.replaceState({ tab: currentTab, ticker: null }, "");
  if (route.get("tab")) {
    const tab = document.querySelector(`[data-tab="${route.get("tab")}"]`);
    if (tab) tab.click();
  }
  if (route.get("ticker")) selectTicker(route.get("ticker"));
}

// 오늘의 카드뉴스 갤러리: data.cardNews = { title, images: ["data/content/<date>/02-topic.png", ...] }
function renderCardNews() {
  const band = byId("contentBand");
  const strip = byId("cardnewsStrip");
  if (!band || !strip) return;
  const cardNews = data.cardNews || {};
  const images = Array.isArray(cardNews.images) ? cardNews.images : [];
  if (!images.length) {
    band.hidden = true;
    return;
  }
  band.hidden = false;
  const meta = byId("contentBandMeta");
  if (meta) meta.textContent = cardNews.title || "";
  strip.innerHTML = images.map((src, i) =>
    `<button class="cardnews-thumb" type="button" data-index="${i}" aria-label="카드뉴스 ${i + 1}장 크게 보기">
      <img src="${escapeHtml(src)}" alt="카드뉴스 ${i + 1}장" loading="lazy">
    </button>`
  ).join("");
  strip.querySelectorAll(".cardnews-thumb").forEach((btn) => {
    btn.addEventListener("click", () => openLightbox(images, Number(btn.dataset.index)));
  });
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
const CHAT_SUGGESTIONS = ["PER이 뭐야?", "ROE 설명해줘", "시장 지도 보는 법", "RS 점수가 뭐야?"];
let chatHistory = [];
let chatBusy = false;

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

  function openPanel() {
    panel.hidden = false;
    toggle.hidden = true;
    input.focus();
    if (!greeted) {
      greeted = true;
      addChatMessage("bot", "안녕하세요! 미르 도우미예요. 사이트 사용법이나 PER·ROE 같은 용어를 물어보세요.");
    }
  }

  function closePanel() {
    panel.hidden = true;
    toggle.hidden = false;
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
      const res = await fetch(`${LIVE_DATA_PROXY.replace(/\/$/, "")}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: chatHistory.slice(-10) }),
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

  toggle.addEventListener("click", openPanel);
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
}

const marketHeader = { fng: null, fx: [] };

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
  // Fallback proxy from market breadth until the live CNN value loads.
  const eq = data.stocks.filter((s) => s.sector !== "EXCHANGE TRADED FUNDS");
  const up = eq.filter((s) => Number(s.changePct) > 0).length;
  return eq.length ? Math.round((up / eq.length) * 100) : 50;
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
  const label = fngLabel(score);
  const color = fngColor(score);
  const live = !!(marketHeader.fng && Number.isFinite(marketHeader.fng.score));
  const cx = 100, cy = 96, r = 76, w = 16;
  // score 0 -> 180deg (left), 100 -> 0deg (right)
  const deg = (s) => 180 - (s / 100) * 180;
  const arcs =
    gaugeArc(cx, cy, r, deg(0), deg(25), "#dc2626", w) +
    gaugeArc(cx, cy, r, deg(25), deg(45), "#f97316", w) +
    gaugeArc(cx, cy, r, deg(45), deg(55), "#eab308", w) +
    gaugeArc(cx, cy, r, deg(55), deg(75), "#84cc16", w) +
    gaugeArc(cx, cy, r, deg(75), deg(100), "#16a34a", w);
  const [nx, ny] = gaugePolar(cx, cy, r - 6, deg(score));
  return `
    <div class="summary-card fng-card">
      <span>Fear &amp; Greed${live ? " · CNN" : " · 추정"}</span>
      <svg class="fng-gauge" viewBox="0 0 200 118" role="img" aria-label="Fear and Greed gauge">
        ${arcs}
        <line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="#0f172a" stroke-width="3" stroke-linecap="round"></line>
        <circle cx="${cx}" cy="${cy}" r="5" fill="#0f172a"></circle>
        <text x="${cx}" y="${cy - 18}" text-anchor="middle" class="fng-score" fill="${color}">${score}</text>
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

function renderSummary() {
  const sectors = computeSectorRanks();
  byId("marketSummary").innerHTML =
    fngCardHtml() +
    sectorTopCardHtml("강한 섹터 TOP5", sectors.strong, true) +
    sectorTopCardHtml("약한 섹터 TOP5", sectors.weak, false) +
    fxCardHtml();
}

function renderIndexStrip(indices) {
  const el = byId("indexStrip");
  if (!el) return;
  if (!indices || !indices.length) { el.innerHTML = ""; return; }
  el.innerHTML = indices.map((ix) => `
    <div class="index-card">
      <div class="index-head">
        <strong>${escapeHtml(ix.name)}</strong>
        <em class="${cls(ix.changePct)}">${fmtPct(ix.changePct)}</em>
      </div>
      <div class="index-price">${Number(ix.price).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
      ${indexSparkline(ix.series, ix.changePct >= 0)}
    </div>
  `).join("");
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

function fetchMarketHeader() {
  if (!LIVE_DATA_PROXY) { renderIndexStrip([]); return; }
  const base = LIVE_DATA_PROXY.replace(/\/$/, "");
  fetch(`${base}/?fng=1`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((p) => {
    if (p && p.fng) { marketHeader.fng = p.fng; renderSummary(); }
  }).catch(() => {});
  fetch(`${base}/?fx=1`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((p) => {
    if (p && Array.isArray(p.fx)) { marketHeader.fx = p.fx; renderSummary(); }
  }).catch(() => {});
  fetch(`${base}/?indices=1`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((p) => {
    if (p && Array.isArray(p.indices)) renderIndexStrip(p.indices);
  }).catch(() => {});
}

// ===== 경제 캘린더 (한국 + 미국, investing.com via Worker) =====
let calendarLoaded = false;

function loadCalendar() {
  if (calendarLoaded) return;
  const body = byId("calendarBody");
  if (!body) return;
  if (!LIVE_DATA_PROXY) {
    body.innerHTML = `<p class="muted">경제 캘린더는 실시간 프록시(Cloudflare Worker) 연결 시 표시됩니다.</p>`;
    return;
  }
  calendarLoaded = true;
  fetch(`${LIVE_DATA_PROXY.replace(/\/$/, "")}/?calendar=1`, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((p) => renderCalendar((p && p.calendar) || []))
    .catch(() => {
      calendarLoaded = false;
      body.innerHTML = `<p class="muted">경제 캘린더를 불러오지 못했습니다.</p>`;
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
    const key = e.day || "";
    if (idx[key] === undefined) { idx[key] = groups.length; groups.push({ day: key, rows: [] }); }
    groups[idx[key]].rows.push(e);
  });
  body.innerHTML = groups.map((g) => `
    <div class="cal-day">
      <h3>${escapeHtml(g.day)}</h3>
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

function activateTab(name, { push = true, ticker = null } = {}) {
  const tabBtn = document.querySelector(`[data-tab="${name}"]`);
  if (!tabBtn) return;
  document.querySelectorAll(".tab").forEach((item) => item.classList.remove("is-active"));
  document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("is-active"));
  tabBtn.classList.add("is-active");
  byId(`tab-${name}`).classList.add("is-active");
  currentTab = name;
  if (name === "calendar") loadCalendar();
  if (push) {
    history.pushState({ tab: name, ticker }, "");
  }
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const name = tab.dataset.tab;
      activateTab(name, { push: name !== currentTab });
    });
  });
  // Browser back/forward restores the previous tab (and ticker) instead of leaving the site.
  window.addEventListener("popstate", (event) => {
    const state = event.state || { tab: "map", ticker: null };
    if (state.ticker) selectTicker(state.ticker, { openSearch: false });
    activateTab(state.tab || "map", { push: false });
  });
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

  byId("tickerOptions").innerHTML = data.stocks
    .map((item) => `<option value="${item.ticker}">${item.company}</option>`)
    .join("");
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
  ["topMetric", "topBucket", "topSector", "topNewHighRecency", "topNewHigh"].forEach((id) => {
    byId(id).addEventListener("change", renderTopStocks);
  });
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
    });
  });

  // Sector tab ETF RS panel controls
  ["sectorEtfRsBenchmark", "sectorEtfRsPeriod", "sectorEtfRsGroup", "sectorEtfRsSort"].forEach((id) => {
    byId(id).addEventListener("change", renderSectorEtfRelativeStrength);
  });
  byId("sectorEtfGrid").addEventListener("click", (event) => {
    const card = event.target.closest(".etf-rs-card");
    if (!card) return;
    showConstituentPanel(card.dataset.category, byId("sectorEtfRsPeriod").value);
  });
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
  byId("stockTreemap").addEventListener("mousemove", handleHeatmapPointer);
  byId("stockTreemap").addEventListener("mouseleave", hideHeatmapTooltip);
  setupChartControls();
  window.addEventListener("resize", debounce(renderTreemap, 120));

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
   "showEma20", "showEma60", "showBoll", "showVolume", "showRsi", "showMacd", "showStoch"].forEach((id) => {
    const el = byId(id);
    if (el) el.addEventListener("change", (event) => {
      chartState[id] = event.target.checked;
      redrawChart();
    });
  });
  setupChartInteractions();
}

// TradingView-style mouse: wheel to zoom (cursor anchored), drag to pan.
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
  renderHealth();
  renderAiBriefing();
  renderSocialSentiment();
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

function metricColor(value, metric) {
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

function renderTreemap() {
  const metric = byId("metricFilter").value;
  const sizeMetric = byId("tileSizeFilter").value;
  const query = byId("heatmapSearch").value.trim().toUpperCase();
  const map = byId("stockTreemap");
  const width = map.clientWidth || 1100;
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

function renderLegend(metric) {
  const legend = byId("heatmapLegend");
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
  const value = item[metric] ?? 0;
  const isSelected = item.ticker === selectedTicker;
  const haystack = `${item.ticker} ${item.company} ${item.sector} ${item.industry}`.toUpperCase();
  const isMatch = query && haystack.includes(query);
  const isDimmed = query && !isMatch;
  const label = fmtMetric(value, metric);
  const area = rect.w * rect.h;
  const sizeClass = area > 55000 ? " is-large" : area > 18000 ? " is-medium" : area > 6500 ? " is-small" : " is-tiny";
  const showTicker = rect.w > 42 && rect.h > 26;
  const showCompany = rect.w > 110 && rect.h > 70;
  const showMetric = rect.w > 62 && rect.h > 48;
  return `
    <button
      class="heat-tile${sizeClass}${isSelected ? " is-selected" : ""}${isMatch ? " is-match" : ""}${isDimmed ? " is-dimmed" : ""}"
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
      ${miniFact("Metric", fmtMetric(item[metric] ?? 0, metric))}
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
  if (!items.length) return 0;
  return items.reduce((sum, item) => sum + Number(item[metric] || 0), 0) / items.length;
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
  return `
    <span class="muted">${title}</span>
    <h3>${item.ticker}</h3>
    <p class="muted">${item.company} · ${item.sector} · ${item.industry}</p>
    <div class="facts">
      ${fact("가격", `$${item.price.toFixed(2)}`)}
      ${fact("당일", `<span class="${cls(item.changePct)}">${fmtPct(item.changePct)}</span>`)}
      ${fact("1개월", `<span class="${cls(item.monthChangePct)}">${fmtPct(item.monthChangePct)}</span>`)}
      ${fact("RS", item.rsScore)}
      ${fact("EPS Rev", item.epsRevScore)}
      ${fact("거래량", `${item.volumeRatio.toFixed(1)}x`)}
      ${fact("StochK", item.stochK)}
      ${fact("신고가 거리", fmtPct(-item.newHighDistancePct))}
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
  const rows = data.stocks
    .filter((item) => bucketMatches(item, item.groups || [item.bucket].filter(Boolean), bucket))
    .filter((item) => sector === "All" || item.sector === sector)
    .filter((item) => recency === "All" || String(item.newHighRecency4w) === recency)
    .filter((item) => newHighMatches(item, newHigh))
    .map((item) => ({ item, value: metricValue(item, metric) }))
    .filter(({ value }) => Number.isFinite(value))
    .sort((a, b) => metricSortDirection(metric) * (b.value - a.value))
    .slice(0, 24);

  byId("topStocksMeta").textContent = `${labelForSelect("topBucket")} · ${sector} · ${labelForSelect("topMetric")} 기준 상위 ${rows.length}개`;

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
        ${miniMetric("신고가", newHighLabel(item))}
        ${miniMetric("4W", item.newHighRecency4w)}
      </div>
    </article>
  `).join("");

  byId("topStocks").querySelectorAll(".top-stock-card").forEach((card) => {
    card.addEventListener("click", () => selectTicker(card.dataset.ticker, { openSearch: true }));
  });
}

function metricValue(item, metric) {
  if (metric === "pe") return Number(item.fundamentals?.pe);
  if (metric === "forwardPE") return Number(item.fundamentals?.forwardPE);
  if (metric === "ps") return Number(item.fundamentals?.ps);
  if (metric === "pb") return Number(item.fundamentals?.pb);
  return Number(item[metric]);
}

function metricSortDirection(metric) {
  return ["pe", "forwardPE", "ps", "pb"].includes(metric) ? -1 : 1;
}

function formatMetricValue(value, metric) {
  if (metric === "marketCapB") return fmtBillions(value);
  if (metric === "volumeRatio") return `${Number(value).toFixed(1)}x`;
  if (["rsScore", "epsRevScore", "rsi14", "stochK"].includes(metric)) return `${Math.round(value)}`;
  if (["pe", "forwardPE", "ps", "pb"].includes(metric)) return Number(value).toFixed(2);
  return fmtPct(value);
}

function metricClass(value, metric) {
  if (["pe", "forwardPE", "ps", "pb", "marketCapB", "volumeRatio"].includes(metric)) return "";
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
  const found = data.stocks.find((item) => item.ticker.toUpperCase() === String(ticker).trim().toUpperCase());
  if (!found) return;
  selectedTicker = found.ticker;
  byId("tickerSearch").value = selectedTicker;
  renderTreemap();
  renderSearch();
  if (options.openSearch !== false) {
    if (currentTab !== "search") {
      activateTab("search", { ticker: selectedTicker, push: true });
    } else {
      activateTab("search", { push: false });
      history.replaceState({ tab: "search", ticker: selectedTicker }, "");
    }
  }
}

function renderSearch() {
  const base = data.stocks.find((row) => row.ticker === selectedTicker) || data.stocks[0];
  const item = applyLive(withDetail(base));
  byId("chartTitle").textContent = `${item.ticker} · ${item.company}`;
  byId("searchFacts").innerHTML = stockFacts(item, "Search Ticker");
  drawChart(item);
  renderFundamentals(item);
  renderNews(item);
  maybeFetchLiveData(base);
  loadStockDetail(item.ticker).then((detail) => {
    if (!detail || selectedTicker !== item.ticker) return;
    const refreshed = applyLive(withDetail(base));
    byId("chartTitle").textContent = `${refreshed.ticker} · ${refreshed.company}`;
    byId("searchFacts").innerHTML = stockFacts(refreshed, "Search Ticker");
    drawChart(refreshed);
    renderFundamentals(refreshed);
    renderNews(refreshed);
  });
}

// Merge any live (proxy-fetched) chart/news over the snapshot+detail data.
function applyLive(item) {
  if (!item) return item;
  const chart = liveChartCache[item.ticker];
  const news = liveNewsCache[item.ticker];
  if (!chart && !news) return item;
  const out = { ...item };
  if (Array.isArray(chart) && chart.length) {
    out.chartSeries = chart;
    out.historySource = "yahoo";
  }
  if (Array.isArray(news) && news.length) out.news = news;
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
      if (typeof payload.summary === "string") liveSummaryCache[ticker] = payload.summary;
      liveDone[ticker] = true;
      if (selectedTicker !== ticker) return;
      const refreshedBase = data.stocks.find((row) => row.ticker === ticker) || base;
      const merged = applyLive(withDetail(refreshedBase));
      drawChart(merged);
      renderFundamentals(merged);
      renderNews(merged);
    })
    .catch(() => {
      liveDone[ticker] = true;
      if (selectedTicker === ticker) renderNews(applyLive(withDetail(base)));
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
  const detail = detailCache[item.ticker];
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
  detailPromises[key] = window.location.protocol === "file:"
    ? loadStockDetailScript(key)
    : fetch(`data/details/${encodeURIComponent(key)}.json`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((detail) => {
        if (detail) detailCache[key] = detail;
        return detail;
      })
      .catch(() => null);
  return detailPromises[key];
}

function loadStockDetailScript(key) {
  window.STOCK_DETAILS = window.STOCK_DETAILS || {};
  return new Promise((resolve) => {
    const existing = window.STOCK_DETAILS[key];
    if (existing) {
      detailCache[key] = existing;
      resolve(existing);
      return;
    }
    const script = document.createElement("script");
    script.src = `data/details/${key}.js`;
    script.onload = () => {
      const detail = window.STOCK_DETAILS?.[key] || null;
      if (detail) detailCache[key] = detail;
      resolve(detail);
    };
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

function drawChart(item) {
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

  // Bottom panels stack below the price plot (dynamic height).
  const gap = 18;
  const panels = [];
  if (chartState.showVolume) panels.push({ t: "volume", h: 46 });
  if (chartState.showRsi) panels.push({ t: "rsi", h: 60 });
  if (chartState.showMacd) panels.push({ t: "macd", h: 70 });
  if (chartState.showStoch) panels.push({ t: "stoch", h: 60 });
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

  const overlays = [
    chartState.showSma5 ? averagePath(closes, 5, xFor, yFor, "#60a5fa") : "",
    chartState.showSma10 ? averagePath(closes, 10, xFor, yFor, "#34d399") : "",
    chartState.showSma20 ? averagePath(closes, 20, xFor, yFor, "#a855f7") : "",
    chartState.showSma60 ? averagePath(closes, 60, xFor, yFor, "#d98a2b") : "",
    chartState.showSma120 ? averagePath(closes, 120, xFor, yFor, "#facc15") : "",
    chartState.showEma20 ? pathFromSeries(emaArray(closes, 20), xFor, yFor, "#f472b6", 1.6, "") : "",
    chartState.showEma60 ? pathFromSeries(emaArray(closes, 60), xFor, yFor, "#38bdf8", 1.6, "") : ""
  ].join("");

  // Stacked indicator panels.
  let cursorY = padT + plotH + gap;
  let panelsSvg = "";
  for (const p of panels) {
    if (p.t === "volume") panelsSvg += renderVolumePanel(rows, xFor, cursorY, p.h, candleW);
    else if (p.t === "rsi") panelsSvg += renderRsiPanel(closes, xFor, padL, padL + plotW, cursorY, p.h);
    else if (p.t === "macd") panelsSvg += renderMacdPanel(closes, xFor, padL, padL + plotW, cursorY, p.h, candleW);
    else if (p.t === "stoch") panelsSvg += renderStochPanel(rows, xFor, padL, padL + plotW, cursorY, p.h);
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

  svg.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" rx="8" class="chart-bg"></rect>
    ${vGuides}
    ${grid}
    <path d="${area}" class="chart-area"></path>
    ${bollSvg}
    ${candles}
    <path d="${linePath}" class="chart-line"></path>
    ${overlays}
    ${panelsSvg}
    <line x1="${padL}" y1="${padT + plotH}" x2="${padL + plotW}" y2="${padT + plotH}" class="chart-base"></line>
    ${dateLabels}
    <text x="${padL}" y="20" class="chart-label">${item.ticker} ${chartState.range} · ${tfLabel} · ${rows.length} bars · ${fmtPct(chartChange)}</text>
    <text x="${padL}" y="36" class="chart-axis">${activeSmaLabels()}</text>
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

// ----- Indicator panels -----
function renderVolumePanel(rows, xFor, top, height, candleW) {
  const volMax = Math.max(...rows.map((row) => row.v), 1);
  const bars = rows.map((row, index) => {
    const x = xFor(index) - candleW / 2;
    const h = Math.max(1, (row.v / volMax) * height);
    const up = row.c >= row.o;
    return `<rect x="${x.toFixed(1)}" y="${(top + height - h).toFixed(1)}" width="${candleW.toFixed(1)}" height="${h.toFixed(1)}" class="${up ? "vol-up" : "vol-down"}"></rect>`;
  }).join("");
  return `<text x="${xFor(0).toFixed(1)}" y="${(top + 10).toFixed(1)}" class="chart-axis">Volume</text>${bars}`;
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

function activeSmaLabels() {
  return [
    chartState.showSma5 ? "SMA5" : "",
    chartState.showSma10 ? "SMA10" : "",
    chartState.showSma20 ? "SMA20" : "",
    chartState.showSma60 ? "SMA60" : "",
    chartState.showSma120 ? "SMA120" : ""
  ].filter(Boolean).join(" ");
}

function pctFrom(now, then) {
  if (!then) return 0;
  return ((now / then) - 1) * 100;
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
    ["Index", indexLabel(item), "P/E", fmtNum(f.pe), "EPS TTM", moneyOrDash(f.epsTtm), "Perf Week", fmtPct(item.weekChangePct)],
    ["Market Cap", fmtBillions(f.marketCapB || item.marketCapB), "Forward P/E", fmtNum(f.forwardPE), "EPS Next Y", moneyOrDash(f.epsNextY), "Perf Month", fmtPct(item.monthChangePct)],
    ["Sales", fmtBillions(f.salesB), "P/S", fmtNum(f.ps), "EPS Next Q", moneyOrDash(f.epsNextQ), "Perf Quarter", fmtPct(item.threeMonthChangePct)],
    ["Income", fmtBillions(f.incomeB), "P/B", fmtNum(f.pb), "Gross Margin", fmtPercent(f.grossMargin), "Perf YTD", fmtPct(item.ytdChangePct)],
    ["Cash", fmtBillions(f.cashB), "Debt/Eq", fmtNum(f.debtEq), "Oper Margin", fmtPercent(f.operMargin), "52W High", priceOrDash(f.week52High)],
    ["Shares Out", fmtBillions(f.sharesB), "Current Ratio", fmtRatio(f.currentRatio), "Profit Margin", fmtPercent(f.profitMargin), "52W Low", priceOrDash(f.week52Low)],
    ["Avg Volume", fmtCompact(f.avgVolume), "Quick Ratio", fmtRatio(f.quickRatio), "ROE", fmtPercent(f.roe), "Target Price", priceOrDash(f.targetPrice)],
    ["Volume", fmtCompact(f.volume), "Prev Close", priceOrDash(f.prevClose), "RS Score", item.rsScore, "Price", priceOrDash(item.price)]
  ];
  byId("fundamentalTable").innerHTML = `
    <div class="fundamental-head">
      <h3>Fundamentals</h3>
      <span>${hasFundamentals ? "Nasdaq detail snapshot" : (detailMode ? "상세 데이터를 불러오는 중이거나 해당 종목 상세값이 없습니다." : "일부 지표는 다음 스냅샷 갱신 후 표시됩니다.")}</span>
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

function renderBulk() {
  const minRs = Number(byId("bulkRs").value || 0);
  const tickers = byId("bulkInput").value.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean);
  const rows = tickers
    .map((ticker) => data.stocks.find((item) => item.ticker === ticker))
    .filter(Boolean)
    .filter((item) => item.rsScore >= minRs);
  byId("bulkTable").innerHTML = rows.map((item) => `
    <tr>
      <td><strong>${item.ticker}</strong></td>
      <td>${item.company}</td>
      <td>${item.sector}</td>
      <td class="${cls(item.changePct)}">${fmtPct(item.changePct)}</td>
      <td>${item.rsScore}</td>
      <td>${item.epsRevScore}</td>
      <td>${item.volumeRatio.toFixed(1)}x</td>
      <td>${signalFor(item)}</td>
    </tr>
  `).join("");
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

function renderHealth() {
  renderMarkets();
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
    monthChangePct: "1개월",
    threeMonthChangePct: "3개월",
    ytdChangePct: "YTD",
    changePct: "당일"
  }[key] || key;
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

function renderSectorEtfRelativeStrength() {
  const container = byId("sectorEtfGrid");
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
      return b.activeRelative - a.activeRelative; // default: relative
    });

  byId("sectorEtfRsMeta").textContent = `총 ${payload.universeCount || 0}개 ETF 기반 · ${rows.length}개 세부 그룹 표시 중`;

  if (!rows.length) {
    container.innerHTML = `<div class="empty-state">ETF 상대강도 데이터가 없습니다. 스냅샷을 다시 생성해 주세요.</div>`;
    return;
  }
  container.innerHTML = rows.map((item, idx) => {
    const rankBadge = idx < 3 ? `<span class="rank-medal rank-${idx + 1}">${["🥇","🥈","🥉"][idx]}</span>` : `<span class="rank-num">${idx + 1}</span>`;
    const spy = item.relative?.SPY?.[period] ?? 0;
    const qqq = item.relative?.QQQ?.[period] ?? 0;
    const sortedPeers = (item.peers || []).slice().sort((a, b) => (b[period] ?? 0) - (a[period] ?? 0));
    const totalPeers = sortedPeers.length;
    // Show up to 8 peer chips, with count badge if more
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
  }).join("");
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

function renderSocialSentiment() {
  const social = data.social_sentiment || {};
  
  // Reddit WSB
  const redditRows = social.reddit || [];
  if (redditRows.length > 0) {
    byId("socialRedditTable").innerHTML = redditRows.map((item, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${escapeHtml(item.ticker)}</strong></td>
        <td>${escapeHtml(item.name || '')}</td>
        <td>${Number(item.mentions || 0).toLocaleString()}</td>
        <td class="${cls(item.change24h || 0)}">${fmtPct(item.change24h || 0)}</td>
      </tr>
    `).join("");
  } else {
    byId("socialRedditTable").innerHTML = `<tr><td colspan="5" class="text-center" style="padding: 20px; text-align: center; color: var(--text-muted);">데이터 없음</td></tr>`;
  }
  
  // Stocktwits
  const stocktwitsRows = social.stocktwits || [];
  if (stocktwitsRows.length > 0) {
    byId("socialStocktwitsTable").innerHTML = stocktwitsRows.map((item, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${escapeHtml(item.ticker)}</strong></td>
        <td>${escapeHtml(item.name || '')}</td>
        <td>${Number(item.watchlist_count || 0).toLocaleString()}</td>
      </tr>
    `).join("");
  } else {
    byId("socialStocktwitsTable").innerHTML = `<tr><td colspan="4" class="text-center" style="padding: 20px; text-align: center; color: var(--text-muted);">데이터 없음</td></tr>`;
  }
  
  // Yahoo Trending
  const yahooRows = social.yahoo || [];
  if (yahooRows.length > 0) {
    byId("socialYahooTable").innerHTML = yahooRows.map((item, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${escapeHtml(item.ticker)}</strong></td>
        <td>${escapeHtml(item.name || '')}</td>
        <td class="${cls(item.changePct || 0)}">${escapeHtml(item.price || '-')}${item.changePct ? ` (${fmtPct(item.changePct)})` : ''}</td>
      </tr>
    `).join("");
  } else {
    byId("socialYahooTable").innerHTML = `<tr><td colspan="4" class="text-center" style="padding: 20px; text-align: center; color: var(--text-muted);">데이터 없음</td></tr>`;
  }
}

loadData();
