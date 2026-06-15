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
const detailCache = {};
const detailPromises = {};
let chartState = {
  range: "1Y",
  zoom: 1,
  offset: 0,
  showSma5: false,
  showSma10: false,
  showSma20: true,
  showSma60: true,
  showSma120: false,
  showVolume: true,
  showRsi: true
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
  renderSummary();
  setupTabs();
  setupFilters();
  renderAll();
  setupEvents();
  if (route.get("tab")) {
    const tab = document.querySelector(`[data-tab="${route.get("tab")}"]`);
    if (tab) tab.click();
  }
  if (route.get("ticker")) selectTicker(route.get("ticker"));
}

function renderSummary() {
  const cards = [
    ["시장 톤", data.summary.marketTone],
    ["강한 섹터", data.summary.strongSector],
    ["약한 섹터", data.summary.weakSector],
    ["AI/Growth", data.summary.aiBreadth]
  ];
  byId("marketSummary").innerHTML = cards.map(([label, value]) => `
    <div class="summary-card"><span>${label}</span><strong>${value}</strong></div>
  `).join("");
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((item) => item.classList.remove("is-active"));
      document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("is-active"));
      tab.classList.add("is-active");
      byId(`tab-${tab.dataset.tab}`).classList.add("is-active");
    });
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
  byId("etfRsGroup").innerHTML = etfGroups.map((group) => `<option value="${group}">${group}</option>`).join("");
  const benchmarks = data.health?.etfRelative?.benchmarks?.length
    ? data.health.etfRelative.benchmarks
    : ["SPY", "QQQ", "TQQQ", "DIA", "IWM"];
  byId("etfRsBenchmark").innerHTML = benchmarks
    .map((ticker) => `<option value="${ticker}">${ticker} 대비</option>`)
    .join("");
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
    byId(id).addEventListener("change", () => {
      if (id === "etfRsGroup") selectedEtfRsCategory = null;
      renderEtfRelativeStrength();
    });
  });
  byId("etfRelativeStrength").addEventListener("click", (event) => {
    const card = event.target.closest(".etf-rs-card");
    if (!card) return;
    const params = new URLSearchParams({
      category: card.dataset.category,
      period: byId("etfRsPeriod").value,
      benchmark: byId("etfRsBenchmark").value,
      group: byId("etfRsGroup").value
    });
    window.location.href = `sector-detail.html?${params.toString()}`;
  });
  byId("jumpCategory").addEventListener("change", renderJump);
  byId("jumpSort").addEventListener("change", renderJump);
  byId("searchButton").addEventListener("click", () => selectTicker(byId("tickerSearch").value));
  byId("tickerSearch").addEventListener("keydown", (event) => {
    if (event.key === "Enter") selectTicker(event.target.value);
  });
  byId("bulkRun").addEventListener("click", renderBulk);
  byId("stockTreemap").addEventListener("mousemove", handleHeatmapPointer);
  byId("stockTreemap").addEventListener("mouseleave", hideHeatmapTooltip);
  setupChartControls();
  window.addEventListener("resize", debounce(renderTreemap, 120));
}

function setupChartControls() {
  byId("rangeControls").querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      chartState.range = button.dataset.range;
      chartState.zoom = 1;
      chartState.offset = 0;
      byId("rangeControls").querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item === button));
      renderSearch();
    });
  });
  byId("chartZoomIn").addEventListener("click", () => {
    chartState.zoom = Math.min(8, chartState.zoom * 1.35);
    renderSearch();
  });
  byId("chartZoomOut").addEventListener("click", () => {
    chartState.zoom = Math.max(1, chartState.zoom / 1.35);
    chartState.offset = Math.max(0, Math.floor(chartState.offset / 1.35));
    renderSearch();
  });
  byId("chartPanLeft").addEventListener("click", () => {
    chartState.offset += Math.max(5, Math.round(12 / chartState.zoom));
    renderSearch();
  });
  byId("chartPanRight").addEventListener("click", () => {
    chartState.offset = Math.max(0, chartState.offset - Math.max(5, Math.round(12 / chartState.zoom)));
    renderSearch();
  });
  byId("chartReset").addEventListener("click", () => {
    chartState = { ...chartState, zoom: 1, offset: 0 };
    renderSearch();
  });
  ["showSma5", "showSma10", "showSma20", "showSma60", "showSma120", "showVolume", "showRsi"].forEach((id) => {
    byId(id).addEventListener("change", (event) => {
      chartState[id] = event.target.checked;
      renderSearch();
    });
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

function renderTreemap() {
  const metric = byId("metricFilter").value;
  const sizeMetric = byId("tileSizeFilter").value;
  const query = byId("heatmapSearch").value.trim().toUpperCase();
  const stocks = filteredStocks().sort((a, b) => sizeWeight(b, sizeMetric) - sizeWeight(a, sizeMetric));
  const map = byId("stockTreemap");
  const width = map.clientWidth || 1100;
  const height = map.clientHeight || 720;

  renderLegend(metric);

  if (!stocks.length) {
    map.innerHTML = `<div class="heatmap-empty">조건에 맞는 종목이 없습니다.</div>`;
    renderSelected(data.stocks[0]);
    return;
  }

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
  const html = sectorRects.map(({ item: sector, rect }) => {
    const inner = insetRect({ x: 0, y: 0, w: rect.w, h: rect.h }, 3, 22, 3, 3);
    const industries = groupIndustries(sector.children, metric, sizeMetric);
    const industryRects = squarify(industries, inner, (item) => item.weight);
    return `
      <section class="sector-box" data-sector="${escapeHtml(sector.sector)}" style="${rectStyle(rect)}">
        <div class="sector-title">${sector.sector} · ${fmtMetric(sector.change, metric)}</div>
        ${industryRects.map(({ item: industry, rect: industryRect }) => industryBox(sector.sector, industry, industryRect, metric, sizeMetric, query)).join("")}
      </section>
    `;
  }).join("");

  map.innerHTML = html;
  map.querySelectorAll(".heat-tile").forEach((tile) => {
    tile.addEventListener("click", () => selectTicker(tile.dataset.ticker, { openSearch: false }));
    tile.addEventListener("dblclick", () => selectTicker(tile.dataset.ticker, { openSearch: true }));
    tile.addEventListener("mouseenter", () => {
      const item = data.stocks.find((stockItem) => stockItem.ticker === tile.dataset.ticker);
      if (item) renderSelected(item);
    });
  });
  renderSelected(stocks.find((item) => item.ticker === selectedTicker) || stocks[0] || data.stocks[0]);
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

function renderSectors() {
  const groups = [...new Set(data.stocks.map((item) => item.sector))].map((sector) => {
    const rows = data.stocks.filter((item) => item.sector === sector);
    const avg = rows.reduce((sum, item) => sum + item.changePct, 0) / rows.length;
    const rs = rows.reduce((sum, item) => sum + item.rsScore, 0) / rows.length;
    const leader = [...rows].sort((a, b) => b.changePct - a.changePct)[0];
    return { sector, avg, rs, count: rows.length, leader };
  }).sort((a, b) => b.avg - a.avg);

  byId("sectorGrid").innerHTML = groups.map((item) => `
    <article class="sector-card">
      <h3>${item.sector}</h3>
      <p class="${cls(item.avg)}">${fmtPct(item.avg)} average</p>
      <div class="bar"><i style="width:${Math.max(5, item.rs)}%"></i></div>
      <p class="muted">${item.count} symbols · Leader ${item.leader.ticker}</p>
    </article>
  `).join("");
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
    <article class="stock-card">
      <h3>${item.ticker}</h3>
      <p class="muted">${item.company}</p>
      <p><strong class="${cls(item.changePct)}">${fmtPct(item.changePct)}</strong> · Vol ${item.volumeRatio.toFixed(1)}x</p>
      <p>RS ${item.rsScore} · EPS ${item.epsRevScore}</p>
    </article>
  `).join("");
}

function selectTicker(ticker, options = {}) {
  const found = data.stocks.find((item) => item.ticker.toUpperCase() === String(ticker).trim().toUpperCase());
  if (!found) return;
  selectedTicker = found.ticker;
  byId("tickerSearch").value = selectedTicker;
  renderTreemap();
  renderSearch();
  if (options.openSearch !== false) document.querySelector('[data-tab="search"]').click();
}

function renderSearch() {
  const base = data.stocks.find((row) => row.ticker === selectedTicker) || data.stocks[0];
  const item = withDetail(base);
  byId("chartTitle").textContent = `${item.ticker} · ${item.company}`;
  byId("searchFacts").innerHTML = stockFacts(item, "Search Ticker");
  drawChart(item);
  renderFundamentals(item);
  loadStockDetail(item.ticker).then((detail) => {
    if (!detail || selectedTicker !== item.ticker) return;
    const refreshed = withDetail(base);
    byId("chartTitle").textContent = `${refreshed.ticker} · ${refreshed.company}`;
    byId("searchFacts").innerHTML = stockFacts(refreshed, "Search Ticker");
    drawChart(refreshed);
    renderFundamentals(refreshed);
  });
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
  const rows = visibleChartRows(getChartRows(item));
  const width = 860;
  const height = 520;
  const padL = 54;
  const padR = 58;
  const padT = 28;
  const rsiH = chartState.showRsi ? 62 : 0;
  const volumeH = chartState.showVolume ? 48 : 0;
  const padB = 36 + volumeH + rsiH + (chartState.showVolume ? 18 : 0) + (chartState.showRsi ? 18 : 0);
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const volumeTop = padT + plotH + 16;
  const rsiTop = volumeTop + volumeH + (chartState.showVolume ? 18 : 0);
  const closes = rows.map((row) => row.c);
  const highs = rows.map((row) => row.h);
  const lows = rows.map((row) => row.l);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const range = max - min || 1;

  const xFor = (index) => padL + (index / Math.max(1, rows.length - 1)) * plotW;
  const yFor = (value) => padT + ((max - value) / range) * plotH;
  const linePath = closes.map((value, index) => `${index ? "L" : "M"} ${xFor(index).toFixed(1)} ${yFor(value).toFixed(1)}`).join(" ");
  const area = `${linePath} L ${padL + plotW} ${padT + plotH} L ${padL} ${padT + plotH} Z`;
  const grid = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = padT + plotH * ratio;
    const value = max - range * ratio;
    return `<line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" class="chart-grid"></line><text x="${width - 8}" y="${y + 4}" class="chart-axis" text-anchor="end">$${value.toFixed(2)}</text>`;
  }).join("");
  const volumeMax = Math.max(...rows.map((row) => row.v), 1);
  const candleW = Math.max(2, Math.min(9, plotW / rows.length * 0.62));
  const volumeBars = chartState.showVolume ? rows.map((row, index) => {
    const x = xFor(index) - candleW / 2;
    const h = Math.max(1, (row.v / volumeMax) * volumeH);
    const up = row.c >= row.o;
    return `<rect x="${x.toFixed(1)}" y="${(volumeTop + volumeH - h).toFixed(1)}" width="${candleW.toFixed(1)}" height="${h.toFixed(1)}" class="${up ? "vol-up" : "vol-down"}"></rect>`;
  }).join("") : "";
  const candles = rows.map((row, index) => {
    const x = xFor(index);
    const up = row.c >= row.o;
    const yOpen = yFor(row.o);
    const yClose = yFor(row.c);
    const yHigh = yFor(row.h);
    const yLow = yFor(row.l);
    const bodyY = Math.min(yOpen, yClose);
    const bodyH = Math.max(1.2, Math.abs(yClose - yOpen));
    return `<g class="${up ? "candle-up" : "candle-down"}"><line x1="${x.toFixed(1)}" y1="${yHigh.toFixed(1)}" x2="${x.toFixed(1)}" y2="${yLow.toFixed(1)}"></line><rect x="${(x - candleW / 2).toFixed(1)}" y="${bodyY.toFixed(1)}" width="${candleW.toFixed(1)}" height="${bodyH.toFixed(1)}"></rect></g>`;
  }).join("");
  const smaPaths = [
    chartState.showSma5 ? averagePath(closes, 5, xFor, yFor, "#60a5fa") : "",
    chartState.showSma10 ? averagePath(closes, 10, xFor, yFor, "#34d399") : "",
    chartState.showSma20 ? averagePath(closes, 20, xFor, yFor, "#a855f7") : "",
    chartState.showSma60 ? averagePath(closes, 60, xFor, yFor, "#d98a2b") : "",
    chartState.showSma120 ? averagePath(closes, 120, xFor, yFor, "#facc15") : ""
  ].join("");
  const rsiPanel = chartState.showRsi ? renderRsiPanel(closes, xFor, padL, padL + plotW, rsiTop, rsiH) : "";
  const first = rows[0];
  const last = rows[rows.length - 1];
  const chartChange = pctFrom(last.c, first.c);
  svg.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" rx="8" class="chart-bg"></rect>
    ${grid}
    <path d="${area}" class="chart-area"></path>
    ${volumeBars}
    ${candles}
    <path d="${linePath}" class="chart-line"></path>
    ${smaPaths}
    ${rsiPanel}
    <line x1="${padL}" y1="${padT + plotH}" x2="${padL + plotW}" y2="${padT + plotH}" class="chart-base"></line>
    <text x="${padL}" y="20" class="chart-label">${item.ticker} ${chartState.range} · ${rows.length} bars · ${fmtPct(chartChange)}</text>
    <text x="${padL}" y="${height - 12}" class="chart-axis">${activeSmaLabels()}</text>
    <text x="${width - 10}" y="20" text-anchor="end" class="chart-label">$${last.c.toFixed(2)}</text>
  `;
}

function getChartRows(item) {
  if (Array.isArray(item.chartSeries) && item.chartSeries.length) {
    return item.chartSeries.map((row) => {
      if (Array.isArray(row)) {
        return { o: Number(row[0]), h: Number(row[1]), l: Number(row[2]), c: Number(row[3]), v: Number(row[4] || 0) };
      }
      return {
        o: Number(row.o ?? row.c),
        h: Number(row.h ?? row.c),
        l: Number(row.l ?? row.c),
        c: Number(row.c),
        v: Number(row.v || 0)
      };
    }).filter((row) => Number.isFinite(row.c));
  }
  const closes = item.closeSeries || [];
  return closes.map((close, index) => {
    const previous = Number(closes[Math.max(0, index - 1)] || close);
    const c = Number(close);
    const high = Math.max(previous, c) * 1.004;
    const low = Math.min(previous, c) * 0.996;
    return { o: previous, h: high, l: low, c, v: 1 };
  });
}

function visibleChartRows(rows) {
  const rangeMap = { "1M": 22, "3M": 66, "6M": 132, "1Y": 252, "5Y": 1260 };
  const rangeSize = Math.min(rows.length, rangeMap[chartState.range] || rows.length);
  const base = rows.slice(-rangeSize);
  const windowSize = Math.max(16, Math.floor(base.length / chartState.zoom));
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
  `;
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

function renderHealth() {
  renderHealthGroup("majorHealth", data.health.major);
  renderHealthGroup("etfHealth", data.health.etf);
  renderEtfRelativeStrength();
  renderHealthGroup("aiHealth", data.health.ai);
}

function renderHealthGroup(id, rows) {
  byId(id).innerHTML = rows.map((item) => `
    <article class="mini-card">
      <h3>${item.ticker}</h3>
      <p class="muted">${item.name}</p>
      <p class="${cls(item.changePct)}"><strong>${fmtPct(item.changePct)}</strong></p>
      <p>${item.note}</p>
    </article>
  `).join("");
}

function periodLabel(key) {
  return {
    monthChangePct: "1개월",
    threeMonthChangePct: "3개월",
    ytdChangePct: "YTD",
    changePct: "당일"
  }[key] || key;
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

  byId("etfRsMeta").textContent = `${payload.universeCount || 0}개 ETF 목록 기반 · ${rows.length}개 세부 그룹`;
  byId("etfRsMethod").textContent = payload.method || "";

  if (!rows.length) {
    container.innerHTML = `<div class="empty-state">ETF 상대강도 데이터가 없습니다. 스냅샷을 다시 생성해 주세요.</div>`;
    return;
  }

  container.innerHTML = rows.map((item) => {
    const spy = item.relative?.SPY?.[period] ?? 0;
    const qqq = item.relative?.QQQ?.[period] ?? 0;
    const peers = (item.peers || []).slice(0, 6).map((peer) => `
      <span class="peer-chip ${cls(peer[period])}">
        ${peer.ticker} ${fmtPct(peer[period] ?? 0)}
      </span>
    `).join("");
    return `
      <article class="etf-rs-card" data-category="${item.category}">
        <div class="etf-rs-topline">
          <span>${item.group}</span>
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
        <p class="drilldown-hint">클릭해서 내부 주식 상대강도 보기</p>
      </article>
    `;
  }).join("");
}

function renderAiBriefing() {
  const briefing = data.ai_briefing || {};
  byId("koreaMarketBriefing").innerHTML = briefing.korea_close || `
    <div class="empty-briefing" style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
      국내 장마감 시황 브리핑 데이터가 아직 없습니다. 오후 4시 장마감 스크립트 실행 시 업데이트됩니다.
    </div>
  `;
  byId("usPremarketBriefing").innerHTML = briefing.us_premarket || `
    <div class="empty-briefing" style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
      미국 프리마켓 장전 브리핑 데이터가 아직 없습니다. 오후 9시 장전 스크립트 실행 시 업데이트됩니다.
    </div>
  `;
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
