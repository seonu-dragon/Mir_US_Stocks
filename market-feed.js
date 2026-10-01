// market-feed.js — 오늘 탭 › 오늘 피드(시장 전체 하루 타임라인)
// =====================================================
// 계산은 market-feed-core.js(window.MirMarketFeed, node 테스트 있음). 여기는 데이터 요청과 렌더만.
// 데이터(새 수집 없음 — 이미 발행된 전역만):
//   US: MATERIAL_EVENTS · EARNINGS_RELEASES · US_STOCK_CALENDAR + EARNINGS_CALENDAR_SNAPSHOT · MOVERS_REASONS ·
//       INSIDER_TRADES(4MB, heavy) · FORM144_FILINGS(lazy) · 경제지표(calendarEventsCache, 워커 ?calendar=1)
//   KR: KR_DISCLOSURES · MOVERS_REASONS · KR_IR_SCHEDULE(lazy) · KR_LOCKUPS(lazy) · 경제지표
// 무거운 내부자 데이터는 이 잎을 처음 열 때만 요청한다(ensureFeatureData). 늦게 도착하면
// refreshFeatureViews(currentTab === "feed") 가 다시 그린다.
// 클래식 스크립트(전역 공유). 최상위 이름은 mfeed 접두로 충돌을 피한다.

const mfeedState = { market: "", date: "", type: "all" };
const mfeedLoading = {};

// 이 시장에서 피드가 읽는 FEATURE_DATA 키 → sourceBasis 의 payload 이름.
const MFEED_KEYS = {
  us: { events: "events", releases: "earningsReleases", usCalendar: "usCalendar", movers: "movers", insider: "insider", form144: "form144" },
  kr: { dart: "krDart", movers: "movers", ir: "krIrSchedule", lockups: "krLockups" },
};

function mfeedMarket() {
  return typeof marketCfg === "function" && marketCfg().id === "kr" ? "kr" : "us";
}

function mfeedVisible() {
  return typeof currentTab !== "undefined" && currentTab === "feed";
}

function renderMarketFeedIfVisible() {
  if (mfeedVisible()) renderMarketFeed();
}

// 필요한 데이터셋을 요청한다(이미 있으면 즉시). 도착하면 scheduleFeatureViewRefresh → refreshFeatureViews 가 다시 그린다.
function mfeedEnsureData(market) {
  const keys = MFEED_KEYS[market] || {};
  Object.keys(keys).forEach((g) => {
    const k = keys[g];
    const meta = typeof FEATURE_DATA !== "undefined" ? FEATURE_DATA[k] : null;
    if (!meta || window[meta.global] || !featureDataEnabled(meta, marketCfg())) return;
    if (typeof _featureDataFailed !== "undefined" && _featureDataFailed[k]) return;
    if (mfeedLoading[g]) return;
    mfeedLoading[g] = true;
    ensureFeatureData(k).then(() => {
      delete mfeedLoading[g];
      if (typeof scheduleFeatureViewRefresh === "function") scheduleFeatureViewRefresh();
      else renderMarketFeedIfVisible();
    });
  });
  if (market === "us" && !window.EARNINGS_CALENDAR_SNAPSHOT && typeof loadEarningsCalendarSnapshot === "function" && !mfeedLoading.earnSnap) {
    mfeedLoading.earnSnap = true;
    loadEarningsCalendarSnapshot(marketCfg()).then(() => { delete mfeedLoading.earnSnap; renderMarketFeedIfVisible(); });
  }
  // 경제지표: 캘린더 탭과 같은 캐시(워커 ?calendar=1 한 번). 도착하면 loadCalendar 가 이 화면도 다시 그린다.
  if (typeof calendarLoaded !== "undefined" && !calendarLoaded && typeof loadCalendar === "function") {
    try { loadCalendar(); } catch (e) { /* 캘린더가 없어도 피드는 그린다 */ }
  }
}

function mfeedPayload(g) {
  const map = {
    events: "MATERIAL_EVENTS", releases: "EARNINGS_RELEASES", usCalendar: "US_STOCK_CALENDAR", insider: "INSIDER_TRADES",
    form144: "FORM144_FILINGS", dart: "KR_DISCLOSURES", ir: "KR_IR_SCHEDULE", lockups: "KR_LOCKUPS",
  };
  if (g === "movers") return typeof moversPayload === "function" ? moversPayload() : null;
  if (g === "econ") return typeof calendarEventsCache !== "undefined" && Array.isArray(calendarEventsCache) ? calendarEventsCache : [];
  if (g === "earnSnap") return window.EARNINGS_CALENDAR_SNAPSHOT || null;
  return window[map[g]] || null;
}

function mfeedNames() {
  const out = {};
  ((typeof data !== "undefined" && data && data.stocks) || []).forEach((s) => {
    if (s && s.ticker) out[String(s.ticker).toUpperCase()] = s.company || s.name || "";
  });
  return out;
}

function mfeedHolidays(market) {
  const ev = (window.MARKET_CALENDAR && window.MARKET_CALENDAR.events) || [];
  return ev.filter((e) => e && e.kind === "holiday" && e.market === market);
}

function mfeedWho(e, market) {
  if (!e.ticker && !e.name) return `<span class="mfeed-who mfeed-who-plain">${market === "kr" ? "한국" : "미국"}</span>`;
  const row = e.ticker && typeof stockByTicker === "function" ? stockByTicker(e.ticker) : null;
  const ref = { ticker: row ? row.ticker : e.ticker, name: (row && (row.company || row.name)) || e.name };
  const kr = market === "kr";
  // 국내는 회사명만(코드는 화면에 내지 않는다), 미국은 티커 + 회사명.
  const main = kr ? (ref.name || "") : ref.ticker;
  const sub = kr ? "" : ref.name;
  const logo = ref.ticker && typeof companyLogoHtml === "function" ? companyLogoHtml(ref.ticker, market, ref.name, 18) : "";
  const label = `${logo}<span class="mfeed-who-text"><strong>${escapeHtml(main || ref.ticker || "")}</strong>${sub ? `<small>${escapeHtml(sub)}</small>` : ""}</span>`;
  return row
    ? `<button type="button" class="mfeed-who mfeed-go" data-ticker="${escapeHtml(row.ticker)}" title="종목 분석 열기">${label}</button>`
    : `<span class="mfeed-who">${label}</span>`;
}

function mfeedRowHtml(e, market) {
  const core = window.MirMarketFeed;
  const time = e.time
    ? `<span class="mfeed-time-main">${escapeHtml(e.time)}</span>${e.timeNote ? `<small>${escapeHtml(e.timeNote)}</small>` : ""}`
    : `<span class="mfeed-time-main">${escapeHtml(core.shortDate(e.date))}</span>`;
  const lines = Array.isArray(e.lines) && e.lines.length
    ? `<ul class="mfeed-lines">${e.lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>${e.linesLabel ? `<small class="mfeed-sub">${escapeHtml(e.linesLabel)}</small>` : ""}`
    : "";
  const sub = e.sub ? `<small class="mfeed-sub">${escapeHtml(e.sub)}</small>` : "";
  const href = e.link && typeof safeHttpHref === "function" ? safeHttpHref(e.link) : "";
  const link = href ? `<a class="mfeed-link" href="${escapeHtml(href)}" target="_blank" rel="noopener">원문</a>` : "";
  return `<li class="mfeed-row" data-type="${escapeHtml(e.type)}">
    <span class="mfeed-time">${time}</span>
    ${mfeedWho(e, market)}
    <span class="mfeed-tag">${escapeHtml(core.TYPE_LABEL[e.type] || "")}</span>
    <div class="mfeed-body"><p class="mfeed-text">${escapeHtml(e.text || "")}</p>${lines}${sub}</div>
    <span class="mfeed-src">${link}</span>
  </li>`;
}

function mfeedBasisHtml(basis, date) {
  const core = window.MirMarketFeed;
  const rows = basis.map((b) => {
    let state = "";
    if (b.status === "loading") state = "불러오는 중";
    else if (b.status === "missing") state = "자료 없음";
    else if (b.status === "behind") state = `이 날짜 자료 없음 · 최신 자료일 ${core.shortDate(b.latest)}`;
    else if (b.status === "empty") state = "이 날짜 0건";
    else state = `${b.n}건`;
    const upd = b.updatedAt ? `<span class="muted"> · 수집 ${escapeHtml(b.updatedAt)}</span>` : "";
    return `<li><strong>${escapeHtml(b.label)}</strong> <span>${escapeHtml(state)}</span>${upd}</li>`;
  }).join("");
  return `<details class="mfeed-basis"><summary>기준 시각 (${escapeHtml(core.shortDate(date))})</summary><ul>${rows}</ul></details>`;
}

function renderMarketFeed() {
  const head = byId("marketFeedHead");
  const listHost = byId("marketFeedList");
  const foot = byId("marketFeedFoot");
  const core = window.MirMarketFeed;
  if (!head || !listHost || !foot || !core) return;
  const market = mfeedMarket();
  if (mfeedState.market !== market) { mfeedState.market = market; mfeedState.date = ""; mfeedState.type = "all"; }
  mfeedEnsureData(market);

  const today = core.marketToday(market);
  const pay = {};
  ["events", "releases", "usCalendar", "earnSnap", "insider", "form144", "dart", "ir", "lockups", "movers", "econ"].forEach((g) => { pay[g] = mfeedPayload(g); });
  const items = core.collect({ market, names: mfeedNames(), today, ...pay });
  const pick = core.pickDate(items, today, mfeedState.date, mfeedHolidays(market));
  const loadingAny = Object.keys(mfeedLoading).length > 0;

  if (!pick.date) {
    head.innerHTML = "";
    foot.innerHTML = "";
    listHost.innerHTML = `<div class="mfeed-empty">
      <p><strong>${loadingAny ? "자료를 불러오는 중입니다." : "표시할 자료가 없습니다."}</strong></p>
      <p class="muted">${loadingAny ? "공시·특징주 자료가 도착하면 이 화면에 바로 나옵니다." : "이 시장의 공시·특징주 자료를 불러오지 못했거나 아직 발행되지 않았습니다. 새로고침 후에도 같으면 발행 지연일 수 있습니다."}</p>
    </div>`;
    return;
  }
  // mfeedState.date 는 사용자가 ‹ › 로 고른 날짜만 담는다 — 자동 기준일은 데이터가 늦게 와도 따라간다.
  const dayItems = core.forDate(items, pick.date);
  const counts = core.countByType(dayItems);
  const chips = core.chips(counts, market);
  if (mfeedState.type !== "all" && !chips.some((c) => c.key === mfeedState.type)) mfeedState.type = "all";
  const list = core.filterType(dayItems, mfeedState.type);
  const prev = core.stepDate(pick.dates, pick.date, -1);
  const next = core.stepDate(pick.dates, pick.date, 1);
  const basis = core.sourceBasis(market, pay, counts, pick.date, mfeedLoading);

  const chip = (key, label, n) => `<button type="button" class="mfeed-chip${mfeedState.type === key ? " is-active" : ""}" data-mfeed-type="${key}" aria-pressed="${mfeedState.type === key}">${escapeHtml(label)} <span class="mfeed-chip-n">${n.toLocaleString("ko-KR")}</span></button>`;
  const note = core.dateNote(pick, market);
  const loadingLabels = basis.filter((b) => b.status === "loading").map((b) => b.label);
  const loadingNote = loadingLabels.length ? `<p class="mfeed-loading muted">${escapeHtml(loadingLabels.join("·"))} 자료를 불러오는 중입니다 — 도착하면 목록에 더해집니다.</p>` : "";

  head.innerHTML = `
    <div class="mfeed-head">
      <div class="mfeed-date">
        <button type="button" class="mfeed-step" data-mfeed-date="${escapeHtml(prev)}" ${prev ? "" : "disabled"} aria-label="이전 자료일">‹</button>
        <h3>${escapeHtml(core.dayLabel(pick.date))}</h3>
        <button type="button" class="mfeed-step" data-mfeed-date="${escapeHtml(next)}" ${next ? "" : "disabled"} aria-label="다음 자료일">›</button>
      </div>
      <p class="mfeed-note muted">${escapeHtml(note)}</p>
    </div>
    <div class="mfeed-chips" role="group" aria-label="종류별 필터">${chip("all", "전체", counts.all)}${chips.map((c) => chip(c.key, c.label, c.n)).join("")}</div>
    ${loadingNote}`;
  // 목록은 LIST_LIMITS(app.js)가 처음 40행(폰 20행) + '더 보기' 로 자른다.
  listHost.innerHTML = list.length
    ? `<ol class="mfeed-list">${list.map((e) => mfeedRowHtml(e, market)).join("")}</ol>`
    : `<p class="mfeed-empty muted">이 날짜에 표시할 항목이 없습니다.</p>`;
  foot.innerHTML = mfeedBasisHtml(basis, pick.date);

  head.querySelectorAll("[data-mfeed-type]").forEach((btn) => {
    btn.addEventListener("click", () => { mfeedState.type = btn.dataset.mfeedType || "all"; renderMarketFeed(); });
  });
  head.querySelectorAll("[data-mfeed-date]").forEach((btn) => {
    btn.addEventListener("click", () => { if (btn.dataset.mfeedDate) { mfeedState.date = btn.dataset.mfeedDate; renderMarketFeed(); } });
  });
  if (typeof delegateTickerClicks === "function") delegateTickerClicks(listHost, ".mfeed-go");
}
