// watchlist.js — 관심종목 · 알림 · 실적 캘린더 · 클라우드 동기화
// ============================================================
// app.js 에서 기계적으로 분리한 클래식 스크립트(모듈 아님). index.html 이 app.js 보다
// 먼저 싣고 같은 전역 스코프를 공유한다. 선언만 있고 로드 시점 실행문이 없다.
// 담는 것: 관심종목 저장/이관/렌더(migrateLegacyWatchlist·initWatchlist·
// persistWatchlist·toggleWatchlist·renderWatchlistBar·renderWatchlistStats),
// 관심종목 알림(watchAlert*·renderWatchAlerts), 시장 실적 캘린더
// (loadEarningsCalendar·renderEarningsCalendarMarket·setupEarningsEvents),
// 클라우드 동기화(cloudSyncPayload·pushCloudSync·pullCloudSync).
// 이름 충돌은 scripts/check_global_name_collisions.py 가 감시한다.

// ===== 관심종목 (localStorage) =====
// 구형 공유 키(mir_watchlist_v1)를 시장별 키로 1회 이관한다. 옛 목록엔 두 시장의
// 티커가 섞여 있을 수 있으므로 6자리 숫자(KR 종목코드) 패턴으로 나눠 각각 넣는다.
function migrateLegacyWatchlist() {
  let legacy = null;
  try { legacy = JSON.parse(window.safeStorage.get(WATCHLIST_LEGACY_KEY) || "null"); } catch (e) { /* ignore */ }
  if (!Array.isArray(legacy)) return;
  const norm = [...new Set(legacy.map((t) => String(t || "").trim().toUpperCase()).filter(Boolean))];
  const kr = norm.filter((t) => /^\d{6}$/.test(t));
  const us = norm.filter((t) => !/^\d{6}$/.test(t));
  try {
    if (us.length && !window.safeStorage.get(watchlistStorageKey("us"))) {
      window.safeStorage.set(watchlistStorageKey("us"), JSON.stringify(us));
    }
    if (kr.length && !window.safeStorage.get(watchlistStorageKey("kr"))) {
      window.safeStorage.set(watchlistStorageKey("kr"), JSON.stringify(kr));
    }
    window.safeStorage.remove(WATCHLIST_LEGACY_KEY);
  } catch (e) { /* ignore */ }
}

function initWatchlist(urlList) {
  migrateLegacyWatchlist();
  try {
    const saved = JSON.parse(window.safeStorage.get(watchlistStorageKey()) || "[]");
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
  try { window.safeStorage.set(watchlistStorageKey(), JSON.stringify(watchlist)); } catch (e) { /* ignore */ }
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
    if (base) facts.innerHTML = stockFacts(applyLive(withDetail(base)), "선택 종목");
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
    return { ...defaults, ...(JSON.parse(window.safeStorage.get(WATCH_ALERT_STORAGE_KEY) || "{}") || {}) };
  } catch (e) {
    return defaults;
  }
}

function saveWatchAlertSettings(settings) {
  try { window.safeStorage.set(WATCH_ALERT_STORAGE_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
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
  delegateTickerClicks(results, ".watch-alert-item");
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

  delegateTickerClicks(body, "[data-ticker]");
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

// ===== Cloud sync (watchlist + portfolio + alerts) =====
const CLOUD_SYNC_KEY = "mir_cloud_sync_v1";

// 반대 시장의 저장분을 읽는다(현재 시장은 메모리의 watchlist 가 최신).
function storedWatchlist(marketId) {
  const current = isKrMarket() ? "kr" : "us";
  if (marketId === current) return watchlist.slice();
  try {
    const saved = JSON.parse(window.safeStorage.get(watchlistStorageKey(marketId)) || "[]");
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
    window.safeStorage.set(CLOUD_SYNC_KEY, String(Date.now()));
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
        window.safeStorage.set(watchlistStorageKey(otherId),
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
