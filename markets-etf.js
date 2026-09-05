// markets-etf.js — 마켓 데이터 탭 · 섹터 ETF 상대강도 · 순환/레버리지/RRG
// =====================================================================
// app.js 에서 기계적으로 분리한 클래식 스크립트(모듈 아님). index.html 이 app.js 보다
// 먼저 싣고 같은 전역 스코프를 공유한다. 선언만 있고 로드 시점 실행문이 없다.
// 담는 것: MARKET_GROUPS/KR_MARKET_GROUPS 와 renderMarkets·환율 섹션,
// 섹터 ETF 상대강도 카드/그리드, 섹터 순환 보드, 레버리지·인버스 ETF 카탈로그,
// RRG(상대순환그래프), 상관관계 행렬, 구성종목 확장 패널.
// 이름 충돌은 scripts/check_global_name_collisions.py 가 감시한다.

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
        <table class="market-table table-wide">
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
          <table class="market-table table-wide">
            <thead><tr><th>통화쌍</th><th>현재가</th><th>당일</th><th>1개월</th></tr></thead>
            <tbody>
              ${fx.map((f) => {
                const price = Number(f.price);
                const decimals = price >= 100 ? 2 : 4;
                return `
                  <tr>
                    <td>${escapeHtml(f.name || f.symbol)}</td>
                    <td><strong>${Number.isFinite(price) ? price.toFixed(decimals) : "—"}</strong></td>
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
    <span class="peer-chip ${cls(peer[period])}">${escapeHtml(stockLabel(peer))} ${fmtPct(peer[period] ?? 0)}</span>
  `).join("") + (remainCount > 0 ? `<span class="peer-more">+${remainCount}개 더</span>` : "");
  return `
    <article class="etf-rs-card" data-category="${escapeHtml(item.category)}" title="클릭해서 전체 ${totalPeers}개 구성 종목 보기">
      <div class="etf-rs-topline">
        ${rankBadge}
        <span class="group-badge">${escapeHtml(item.group ?? "")}</span>
        <strong class="${cls(item.activeRelative)}">${escapeHtml(benchmark)} 대비 ${fmtPct(item.activeRelative)}</strong>
      </div>
      <h4>${escapeHtml(item.category)}</h4>
      <div class="etf-rs-main">
        <div>
          <span class="ticker-pill">${escapeHtml(item.representative ?? "")}</span>
          <strong>${escapeHtml(item.name ?? "")}</strong>
        </div>
        <div class="etf-rs-score ${cls(item.activeReturn)}">${fmtPct(item.activeReturn)}</div>
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
  // KR 스냅샷 자동 발견분은 한국어 상품명이라 한국어 패턴도 본다("…인버스"가
  // 레버리지로 배지되던 문제). 인버스2X 같은 복합명은 인버스 우선.
  let type = "leveraged";
  if (/inverse|short|bear|인버스|곱버스/i.test(name)) type = "inverse";
  else if (/covered call|buywrite|option income|premium income|커버드콜/i.test(name)) type = "covered-call";
  else if (/vix|volatility|변동성/i.test(name)) type = "volatility";
  else if (/buffer|defined outcome/i.test(name)) type = "buffer";
  let leverage = "—";
  const levMatch = name.match(/(\d+(?:\.\d+)?)\s*[x배]/i);
  if (levMatch) leverage = `${levMatch[1]}x`;
  else if (/ultrapro/i.test(name)) leverage = "3x";
  else if (/ultra(?!pro)/i.test(name)) leverage = "2x";
  else if (/레버리지/.test(name)) leverage = "2x"; // 국내 '레버리지' 표기는 2배가 표준
  const krIssuer = (stock.company || "").match(/^(KODEX|TIGER|ACE|RISE|KBSTAR|SOL|ARIRANG|HANARO|KIWOOM|PLUS|WON|UNICORN|TIMEFOLIO)\b/i);
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
    issuer: krIssuer ? krIssuer[1].toUpperCase() : "—",
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
  const krCatalog = isKrMarket() && data.leveragedEtfCatalog?.items;
  const catalog = krCatalog
    || (window.LEVERAGED_ETF_CATALOG && window.LEVERAGED_ETF_CATALOG.items)
    || [];
  const byTicker = new Map(catalog.map((item) => {
    const copy = { ...item };
    // KR 카탈로그는 underlying 이 "—", underlyingLabel 이 scope 영문값("index" 등)으로
    // 온다. 카드에 영문 코드가 그대로 노출되지 않게 한국어 범위 라벨로 바꾼다.
    if (krCatalog && (LEV_ETF_SCOPE_LABEL[copy.underlyingLabel] || copy.underlyingLabel === copy.scope)) {
      copy.underlyingLabel = LEV_ETF_SCOPE_LABEL[copy.scope] || copy.scope || "";
    }
    return [copy.ticker, copy];
  }));
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
  const rs = hasLive && Number.isFinite(Number(live.rsi14)) ? Math.round(Number(live.rsi14)) : "—";
  const scopeLabel = LEV_ETF_SCOPE_LABEL[item.scope] || item.scope;
  return `
    <article class="lev-etf-card ${hasLive ? "has-live" : "no-live"}" data-ticker="${escapeHtml(item.ticker)}" tabindex="0" role="button">
      <div class="lev-etf-card-head">
        <span class="ticker-pill">${escapeHtml(stockLabel(item))}</span>
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
        <span>RSI <strong>${rs}</strong></span>
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
  if (metaEl) metaEl.textContent = `벤치마크 ${stockLabel(bench.ticker)} · ${points.length}개 섹터 ETF`;
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
    // 자동 발견분(메타 빈약)은 큐레이션 그룹 뒤로 — KR 에서 '스'가 '한'보다 앞서
    // 카탈로그(한국 레버리지·인버스)를 밀어내던 문제.
    const autoIdx = groups.indexOf("스냅샷 자동 분류");
    if (autoIdx >= 0) groups.push(groups.splice(autoIdx, 1)[0]);
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
    return `
      <tr>
        <td><strong>${idx + 1}</strong></td>
        <td><strong class="ticker-link" data-ticker="${escapeHtml(peer.ticker)}" role="button" tabindex="0">${escapeHtml(stockLabel(peer))}</strong></td>
        <td>${escapeHtml(stockSubLabel(peer) || "")}</td>
        <td class="${cls(pct)}"><strong>${fmtPct(pct)}</strong></td>
        <td class="${cls(spyRel)}">${fmtPct(spyRel)}</td>
        <td class="${cls(qqqRel)}">${fmtPct(qqqRel)}</td>
      </tr>
    `;
  }).join("");

  const body = byId("constituentPanelBody");
  if (body && !body.dataset.bound) {
    body.dataset.bound = "1";
    const open = (event) => {
      const link = event.target.closest(".ticker-link[data-ticker]");
      if (!link) return;
      if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      closeConstituentPanel();
      selectTicker(link.dataset.ticker, { openSearch: true });
    };
    body.addEventListener("click", open);
    body.addEventListener("keydown", open);
  }
  panel.classList.add("is-open");
  byId("constituentBackdrop").classList.add("is-open");
}

function closeConstituentPanel() {
  byId("constituentPanel").classList.remove("is-open");
  byId("constituentBackdrop").classList.remove("is-open");
}
