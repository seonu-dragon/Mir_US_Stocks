// watchlist.js — 관심종목 · 알림 · 실적 캘린더 · 클라우드 동기화
// ============================================================
// app.js 에서 기계적으로 분리한 클래식 스크립트(모듈 아님). index.html 이 app.js 보다
// 먼저 싣고 같은 전역 스코프를 공유한다. 선언만 있고 로드 시점 실행문이 없다.
// 담는 것: 관심종목 저장/이관/렌더(migrateLegacyWatchlist·initWatchlist·
// persistWatchlist·toggleWatchlist·renderWatchlistStats),
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
  // 기본 목록은 저장 키가 아예 없을 때(첫 방문)만 채운다. 사용자가 일부러 비운 목록([])은 그대로 둔다.
  let hasSaved = false;
  try {
    const raw = window.safeStorage.get(watchlistStorageKey());
    hasSaved = raw != null;
    const saved = JSON.parse(raw || "[]");
    watchlist = Array.isArray(saved) ? saved.map((t) => normalizeTickerKey(t)).filter(Boolean) : [];
  } catch (e) {
    watchlist = [];
  }
  if (urlList) {
    // 공유 링크(?watchlist=)는 받는 사람의 목록을 덮어쓰지 않는다 — 예전엔 교체 후 저장·클라우드
    // 푸시까지 해서 내 관심종목이 영구히 사라졌다. 공유 종목을 앞에 두고 기존 목록을 뒤에 합친다.
    const fromUrl = String(urlList).split(",").map((t) => normalizeTickerKey(t.trim())).filter((t) => stockByTicker(t));
    if (fromUrl.length) watchlist = [...new Set([...fromUrl, ...watchlist])];
    persistWatchlist();
  }
  if (!watchlist.length && !hasSaved) watchlist = defaultWatchlist().slice();
  persistWatchlist();
}

const WATCHLIST_DIRTY_KEY = "mir_watchlist_dirty_at";

function persistWatchlist() {
  // 스냅샷에 없는 티커도 버리지 않는다 — 저장 시점 필터는 시장 전환/스냅샷 누락 때
  // 목록을 조용히 갉아먹는다. 화면에 뿌릴 때만 stockByTicker 로 거른다.
  watchlist = [...new Set(watchlist.map((t) => normalizeTickerKey(t)).filter(Boolean))];
  let changed = true;
  try {
    const key = watchlistStorageKey();
    const prev = window.safeStorage.get(key);
    const next = JSON.stringify(watchlist);
    // 이미 있던 목록이 바뀌었으면 '클라우드에 아직 안 올린 로컬 편집'으로 표시한다. 부팅 때 pull 이
    // 이 편집을 옛 클라우드 사본으로 덮어쓰지 않게(예전엔 공유 링크 병합·직전 편집이 다음 부팅에 사라졌다).
    // 새 기기의 기본 목록(prev 없음)은 표시하지 않는다 — 다른 기기의 클라우드 목록이 이겨야 한다.
    changed = prev !== next;
    if (prev != null && changed) window.safeStorage.set(WATCHLIST_DIRTY_KEY, String(Date.now()));
    window.safeStorage.set(key, next);
  } catch (e) { /* ignore */ }
  const input = byId("bulkInput");
  // 편집창도 표시 규칙을 따른다(국내: 회사명, 미국: 티커). 회사명은 resolveTickerQuery 가
  // 다시 코드로 해석하므로 저장/불러오기 왕복에 문제가 없다. 이름을 모르는 코드는 코드 그대로.
  if (input) input.value = watchlist.map((t) => (typeof stockLabel === "function" ? stockLabel(t) : t)).join(", ");
  // 내용이 그대로면 올리지 않는다 — 예전엔 부팅마다(initWatchlist) PUT 을 보내 IP 당 10회/분 한도(429)에
  // 걸렸고, 정작 사용자의 편집이 그 한도에 막혔다.
  if (changed) scheduleCloudSyncPush();
}

let _cloudSyncPushTimer = null;
function scheduleCloudSyncPush() {
  clearTimeout(_cloudSyncPushTimer);
  _cloudSyncPushTimer = setTimeout(() => pushCloudSync(), 1200);
  // 푸시 알림 구독 중이면 워커의 관심·보유 목록도 같이 맞춘다(web-push.js, 목록이 바뀐 경우만 전송).
  if (window.MirPush) window.MirPush.scheduleListSync();
}

function isInWatchlist(ticker) {
  return watchlist.includes(normalizeTickerKey(ticker));
}

function watchStarLabel(ticker) {
  const s = typeof stockByTicker === "function" ? stockByTicker(ticker) : null;
  const name = s && typeof stockLabel === "function" ? stockLabel(s) : String(ticker || "");
  return `${name} 관심종목`;
}

function watchStarButton(ticker) {
  const on = isInWatchlist(ticker);
  return `<button type="button" class="watch-star${on ? " is-on" : ""}" data-watch="${escapeHtml(ticker)}" title="관심종목" aria-label="${escapeHtml(watchStarLabel(ticker))}" aria-pressed="${on ? "true" : "false"}">${on ? "★" : "☆"}</button>`;
}

function toggleWatchlist(ticker) {
  const t = normalizeTickerKey(ticker);
  if (!stockByTicker(t)) return;
  if (isInWatchlist(t)) watchlist = watchlist.filter((x) => x !== t);
  else watchlist.push(t);
  persistWatchlist();
  // ★ 한 번에 무거운 렌더(시장 요약·알림·내 투자 표+상관행렬·오늘 액션보드)를 다 돌리지 않는다 —
  // 지금 보이는 화면만 바로 그리고, 가려진 화면은 다음에 보일 때(탭 전환·접힘 펼침) 그린다.
  watchRenderWhenVisible("summary", "marketSummary", renderSummary);
  watchRenderWhenVisible("alerts", "watchAlertPanel", renderWatchAlerts);
  watchRenderWhenVisible("bulk", "tab-bulk", () => { renderBulk(); renderMyInvestSummary(); });
  watchRenderWhenVisible("action", "dailyActionGrid", renderActionBoard);
  document.querySelectorAll(`[data-watch="${t}"]`).forEach((btn) => {
    const on = isInWatchlist(t);
    btn.classList.toggle("is-on", on);
    btn.textContent = on ? "★" : "☆";
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
  const facts = byId("searchFacts");
  if (facts && selectedTicker === t) {
    const base = selectedBaseRow(t);
    if (base) renderSearchFacts(applyLive(withDetail(base)));
  }
}

// ----- 관심종목 변경 후 '보일 때 다시 그리기' -----
const _watchDeferredRenders = new Map(); // key → { id, fn }
function watchElVisible(id) {
  const el = byId(id);
  return Boolean(el && el.getClientRects().length);
}
function watchRenderWhenVisible(key, id, fn) {
  if (watchElVisible(id)) {
    _watchDeferredRenders.delete(key);
    try { fn(); } catch (e) { /* 한 화면 실패가 나머지를 막지 않게 */ }
  } else {
    _watchDeferredRenders.set(key, { id, fn });
  }
}
// activateTab(탭 전환)·details 펼침 뒤에 부른다. 이제 보이는 것만 그리고 나머지는 계속 미룬다.
function flushWatchDeferredRenders() {
  if (!_watchDeferredRenders.size) return;
  [..._watchDeferredRenders.entries()].forEach(([key, { id, fn }]) => {
    if (!watchElVisible(id)) return;
    _watchDeferredRenders.delete(key);
    try { fn(); } catch (e) { /* ignore */ }
  });
}
document.addEventListener("toggle", (e) => {
  if (e.target && e.target.open) flushWatchDeferredRenders();
}, true);

// ===== 관심 리스트 여러 개(2026-10-03) =====
// '전체' 는 기존 watchlist(★) 그대로다. 사용자가 만든 리스트는 시장별 [{ id, name, tickers }] 로 따로 저장하고,
// 리스트에 넣은 종목은 전체(★)에도 넣는다. 리스트에서 빼면 그 리스트에서만 빠진다(★ 는 유지).
// 리스트도 클라우드에 동기화한다(2026-10-21, watchGroupsUs/Kr) — 편집은 ★ 목록과 같은 '로컬 편집' 표시를 남긴다.
const WL_GROUPS_MAX = 12;
let wlActiveGroup = "";
function wlGroupsKey(marketId) { return `mir_watch_groups_${marketId || (isKrMarket() ? "kr" : "us")}`; }
function wlGroups(marketId) {
  try {
    const raw = JSON.parse(window.safeStorage.get(wlGroupsKey(marketId)) || "[]");
    return Array.isArray(raw) ? raw.filter((g) => g && g.id && g.name && Array.isArray(g.tickers)) : [];
  } catch (_) { return []; }
}
// opts.marketId: 다른 시장 저장분, opts.push === false: 클라우드에서 받은 값(로컬 편집 아님)
function wlSaveGroups(list, opts = {}) {
  const key = wlGroupsKey(opts.marketId);
  try {
    const prev = window.safeStorage.get(key);
    const next = JSON.stringify(list.slice(0, WL_GROUPS_MAX));
    window.safeStorage.set(key, next);
    if (opts.push !== false && prev !== next) {
      window.safeStorage.set(WATCHLIST_DIRTY_KEY, String(Date.now()));
      scheduleCloudSyncPush();
    }
  } catch (_) { /* 저장 실패 무시 */ }
}

// ===== 종목 메모(2026-10-21) =====
// 시장별 { TICKER: { t: 글(200자), u: 고친 시각 } }. 빈 글은 삭제 표식으로 남겨 다른 기기에도 지워지게 한다.
// 클라우드와는 종목마다 더 나중에 고친 쪽으로 병합한다(watchlist-core.js mergeNotes) — 바디 상한 때문에
// 일부만 올라가도 다른 기기에서 지워지지 않는다.
function wlNotesKey(marketId) { return `mir_watch_notes_${marketId || (isKrMarket() ? "kr" : "us")}`; }
function wlNotes(marketId) {
  const core = window.MirWatchCore;
  try {
    const raw = JSON.parse(window.safeStorage.get(wlNotesKey(marketId)) || "{}");
    return core ? core.normalizeNotes(raw) : {};
  } catch (_) { return {}; }
}
function wlNoteText(ticker) {
  const n = wlNotes()[normalizeTickerKey(ticker)];
  return n && n.t ? n.t : "";
}
function wlSaveNotes(notes, opts = {}) {
  const key = wlNotesKey(opts.marketId);
  try {
    const prev = window.safeStorage.get(key);
    const next = JSON.stringify(notes);
    window.safeStorage.set(key, next);
    if (opts.push !== false && prev !== next) {
      window.safeStorage.set(WATCHLIST_DIRTY_KEY, String(Date.now()));
      scheduleCloudSyncPush();
    }
  } catch (_) { /* 저장 실패 무시 */ }
}
function wlSetNote(ticker, text) {
  const core = window.MirWatchCore;
  if (!core) return;
  wlSaveNotes(core.setNote(wlNotes(), normalizeTickerKey(ticker), text, Date.now()));
}
function wlActiveTickers() {
  if (!wlActiveGroup) return watchlist.slice();
  const g = wlGroups().find((x) => x.id === wlActiveGroup);
  if (!g) { wlActiveGroup = ""; return watchlist.slice(); }
  return g.tickers.slice();
}
function wlAddTicker(raw) {
  const t = normalizeTickerKey(resolveCommunityTickerInput ? (resolveCommunityTickerInput(raw) || raw) : raw);
  if (!t || !stockByTicker(t)) { showAppToast(`'${raw}' 종목을 찾지 못했습니다.`); return false; }
  if (wlActiveGroup) {
    const list = wlGroups();
    const g = list.find((x) => x.id === wlActiveGroup);
    if (g && !g.tickers.includes(t)) { g.tickers.push(t); wlSaveGroups(list); }
  }
  if (!isInWatchlist(t)) toggleWatchlist(t);
  else renderBulk();
  showAppToast(`${stockLabel(t)} 추가했습니다.`);
  return true;
}
function wlRemoveTicker(t) {
  if (wlActiveGroup) {
    const list = wlGroups();
    const g = list.find((x) => x.id === wlActiveGroup);
    if (g) { g.tickers = g.tickers.filter((x) => x !== t); wlSaveGroups(list); }
    renderBulk();
    return;
  }
  toggleWatchlist(t);
}
function wlCreateGroup(name) {
  const nm = String(name || "").trim().slice(0, 20);
  if (!nm) return;
  const list = wlGroups();
  if (list.length >= WL_GROUPS_MAX) { showAppToast(`리스트는 ${WL_GROUPS_MAX}개까지 만들 수 있습니다.`); return; }
  const id = `g${Date.now().toString(36)}`;
  list.push({ id, name: nm, tickers: [] });
  wlSaveGroups(list);
  wlActiveGroup = id;
  renderBulk();
}
function wlDeleteGroup(id) {
  wlSaveGroups(wlGroups().filter((g) => g.id !== id));
  if (wlActiveGroup === id) wlActiveGroup = "";
  renderBulk();
}

function renderWatchGroups() {
  const host = byId("wlGroups");
  if (!host) return;
  const groups = wlGroups();
  const chip = (id, name, n) => `<button type="button" class="wl-group${wlActiveGroup === id ? " is-active" : ""}" data-wl-group="${escapeHtml(id)}" aria-pressed="${wlActiveGroup === id}">${escapeHtml(name)} <small>${n}</small></button>`;
  const active = groups.find((g) => g.id === wlActiveGroup);
  host.innerHTML = `${chip("", "전체", watchlist.filter((t) => stockByTicker(t)).length)}${groups.map((g) => chip(g.id, g.name, g.tickers.filter((t) => stockByTicker(t)).length)).join("")}
    <span class="wl-new"><button type="button" class="ghost compact-btn" data-wl-new="1">+ 새 리스트</button></span>
    ${active ? `<button type="button" class="ghost compact-btn wl-del" data-wl-del="${escapeHtml(active.id)}">'${escapeHtml(active.name)}' 삭제</button>` : ""}`;
  if (host.dataset.bound) return;
  host.dataset.bound = "1";
  host.addEventListener("click", (ev) => {
    const g = ev.target.closest("[data-wl-group]");
    if (g) { wlActiveGroup = g.dataset.wlGroup; renderBulk(); return; }
    if (ev.target.closest("[data-wl-new]")) {
      const box = host.querySelector(".wl-new");
      box.innerHTML = `<form class="wl-new-form"><input maxlength="20" placeholder="리스트 이름 (예: AI, 배당)" aria-label="새 리스트 이름"><button type="submit" class="primary compact-btn">만들기</button></form>`;
      const input = box.querySelector("input");
      input.focus();
      box.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); wlCreateGroup(input.value); });
      return;
    }
    const del = ev.target.closest("[data-wl-del]");
    if (del) {
      if (del.dataset.armed !== "1") {
        del.dataset.armed = "1";
        del.textContent = "한 번 더 누르면 삭제(종목 ★ 는 유지)";
        setTimeout(() => { if (del.isConnected) renderWatchGroups(); }, 4000);
        return;
      }
      wlDeleteGroup(del.dataset.wlDel);
    }
  });
}

function saveWatchlistFromInput(text) {
  const tickers = resolveTickerListInput(text);
  if (!tickers.length) return;
  watchlist = [...new Set(tickers)];
  persistWatchlist();
  renderWatchAlerts();
  renderActionBoard();
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
    useSma20: false,
    // 아래 둘이 빠져 있으면 select.value = undefined 가 되어 '차트 패턴' 셀렉트가 빈 칸으로 보였다.
    usePattern: false,
    patternCat: "any"
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
  const watchRows = watchlist
    .map((ticker) => stockByTicker(ticker))
    .filter(Boolean)
    .map((item) => applyLive(withDetail(item)))
    .filter(Boolean)
    .map((item) => ({ item, reasons: watchAlertReasons(item, settings) }))
    .filter((row) => row.reasons.length);
  // 투자 가설 점검(thesis.js)의 위반·근접·실적 후 재점검을 같은 목록 맨 앞에 합친다.
  const thesisRows = (window.MirThesis ? window.MirThesis.alertItems() : [])
    .map((a) => ({ item: stockByTicker(a.ticker), reasons: [a.note] }))
    .filter((row) => row.item);
  const merged = new Map();
  [...thesisRows, ...watchRows].forEach((row) => {
    const prev = merged.get(row.item.ticker);
    if (prev) prev.reasons.push(...row.reasons); else merged.set(row.item.ticker, { item: row.item, reasons: [...row.reasons] });
  });
  const rows = [...merged.values()];
  if (count) count.textContent = `${rows.length}건`;
  if (!results) return;
  results.innerHTML = rows.length
    ? rows.map(({ item, reasons }) => `
      <button type="button" class="watch-alert-item" data-ticker="${escapeHtml(item.ticker)}">
        <strong>${escapeHtml(stockLabel(item))}</strong>
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
  // 스냅샷 파일(data/[korea/]earnings_calendar.js)은 부팅 때 기다리지 않고 붙인다(app.js loadSnapshot). 딥링크
  // (&tab=calendar&sub=earnings)로 들어오면 이 함수가 그보다 먼저 불려, 예전엔 '스냅샷이 비었다'고 보고 워커로
  // 갔다 — 워커는 KR·US 모두 빈 배열을 주므로 "실적 일정 데이터가 없습니다."로 굳었다(2026-10-21 라이브 재현).
  // 도착(또는 실패)을 한 번 기다린 뒤 다시 판단한다. 실패한 시장은 다시 기다리지 않는다.
  if (!earningsSnapshotReady() && typeof loadEarningsCalendarSnapshot === "function" && !_earnSnapWaited[cfg.id]) {
    _earnSnapWaited[cfg.id] = true;
    body.innerHTML = `<p class="muted">실적 일정을 불러오는 중…</p>`;
    loadEarningsCalendarSnapshot(cfg).then(() => {
      if (marketCfg().id === cfg.id) loadEarningsCalendar(force);
    });
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
      // 기다리는 사이 스냅샷이 도착했을 수 있어 정적 행을 다시 뽑는다. 둘 다 비면 캐시하지 않는다(빈 배열을
      // 캐시하면 다음 진입도 빈 화면에 머문다).
      const rows = liveRows.length ? liveRows : staticEarningsRowsForTickers(earningsTickerPool());
      earningsCalendarCache = rows.length ? rows : null;
      if (rows.length) renderEarningsCalendarMarket(rows);
      else body.innerHTML = `<p class="muted">실적 일정 데이터가 없습니다.</p>`;
    })
    .catch(() => {
      const rows = staticEarningsRowsForTickers(earningsTickerPool());
      if (rows.length) { earningsCalendarCache = rows; renderEarningsCalendarMarket(rows); }
      else body.innerHTML = `<p class="muted">실적 일정을 불러오지 못했습니다.</p>`;
    })
    .finally(() => { earningsCalendarLoading = false; });
}

// 시장별로 스냅샷 도착을 한 번만 기다린다(실패한 <script> 는 load/error 를 다시 주지 않는다).
const _earnSnapWaited = {};
function earningsSnapshotReady() {
  return !!(isKrMarket() ? window.KOREA_EARNINGS_CALENDAR : window.EARNINGS_CALENDAR_SNAPSHOT);
}

function localDateFromIso(iso) {
  const parts = parseIsoDateParts(iso);
  return parts ? new Date(parts.year, parts.month - 1, parts.day) : null;
}

// D+n 은 '달력상 며칠 뒤' 다. 로컬 자정끼리 빼면 서머타임 경계에서 23h/25h 가 나와
// Math.ceil 이 하루를 틀린다 — UTC 자정으로 옮겨 일수를 센다(감사 2026-09-15 P2).
function calendarDayDiff(from, to) {
  if (!from || !to) return null;
  const utc = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((utc(to) - utc(from)) / 86400000);
}
function earningsRelativeDayLabel(target, today) {
  const days = calendarDayDiff(today, target);
  if (days == null) return { days: null, rel: "" };
  if (days === 0) return { days, rel: "오늘" };
  if (days === 1) return { days, rel: "내일" };
  if (days < 0) return { days, rel: `${Math.abs(days)}일 전` };
  return { days, rel: `${days}일 후` };
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
    // historySource 를 같이 실어야 fmtRsi 가 합성 이력을 가려낼 수 있다.
    marketCapB: capB, capTier, rsi14: (stock.rsi14 ?? null), historySource: stock.historySource,
    price, changePct: Number.isFinite(Number(stock.changePct)) ? Number(stock.changePct) : null,
    epsEstimate: (row.epsEstimate != null ? Number(row.epsEstimate) : null),
    target, upside, watch: isInWatchlist(t),
    // 국내 예정일은 작년 같은 분기 실제 발표일 기준 추정(build_kr_earnings_calendar.py).
    estimated: !!row.estimated, estimateNote: earnEstimateNote(row),
  };
}

function earnEstimateNote(row) {
  if (!row || !row.estimated) return "";
  if (row.basis === "deadline") return "법정 제출기한 기준 추정";
  const what = row.basis === "prelim" ? "잠정실적 공시일" : "분기·반기·사업보고서 제출일";
  return `작년 같은 분기 ${what}${row.lastYearDate ? `(${row.lastYearDate})` : ""} 기준 추정`;
}
function earnEstimateBadge(it) {
  return it.estimated ? ` <em class="earn-est" title="${escapeHtml(it.estimateNote)}">추정</em>` : "";
}

// 실적 일정 툴바는 미국 기준 문구라 국내 모드에서 범위 라벨만 바꾸고 미국 섹터 필터는 숨긴다.
function applyEarnToolbarMarket() {
  const kr = isKrMarket();
  const opt = byId("earnScope")?.querySelector('option[value="sp500"]');
  if (opt) opt.textContent = kr ? "시총 상위" : "S&P 500 상위";
  const sector = byId("earnSector");
  if (sector) {
    if (kr && sector.value !== "all") { sector.value = "all"; earnSector = "all"; }
    const label = sector.closest("label");
    if (label) label.style.display = kr ? "none" : "";
  }
}

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

function renderEarningsCalendarMarket(rows) {
  const body = byId("earningsCalendarBody");
  if (!body) return;
  applyEarnToolbarMarket();
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
    const board = typeof earningsScoreboardSectionHtml === "function" ? earningsScoreboardSectionHtml() : "";
    body.innerHTML = `${board}<p class="muted">선택 기간에 ${reason}실적 발표 예정 종목이 없습니다. 필터를 넓히거나 범위를 바꿔 보세요.</p>`;
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
            ${it.watch ? "★ " : ""}<b>${escapeHtml(stockLabel(it))}</b><em>${dow}</em></button>`;
        }).join("")}
      </div>
    </div>` : "";

  const body_html = earnView === "calendar" ? earningsCalendarGrid(items, today) : earningsListView(items, today);
  // 실적 전 비교(과거 반응 vs 옵션 예상변동폭) — earnings-insight.js, US 전용.
  const compareHtml = typeof earningsMoveCompareSectionHtml === "function" ? earningsMoveCompareSectionHtml(items) : "";
  // 실적 시즌 스코어보드(S&P 500 발표분 상회·하회 집계) — earnings-insight.js, US 전용.
  const boardHtml = typeof earningsScoreboardSectionHtml === "function" ? earningsScoreboardSectionHtml() : "";
  body.innerHTML = boardHtml + highlightHtml + compareHtml + body_html;

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
    const { days, rel } = earningsRelativeDayLabel(d, today);
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
              <span class="earn-chip-top">${it.watch ? `<i class="earn-star">★</i>` : ""}<b>${escapeHtml(stockLabel(it))}</b>${earnChange(it.changePct)}</span>
              <span class="earn-chip-sub">${it.capTier ? `${escapeHtml(it.capTier)} · ` : ""}${escapeHtml(it.sectorKo || "-")}${earnEstimateBadge(it)}</span>
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
    const { rel } = earningsRelativeDayLabel(d, today);
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
                <b>${escapeHtml(stockLabel(it))}</b>
                <em>${escapeHtml(stockSubLabel(it))}</em>${earnEstimateBadge(it)}
              </span>
              <span class="earn-row-sector">${escapeHtml(it.sectorKo || "-")}</span>
              <span class="earn-row-price">${it.price != null ? priceOrDash(it.price) : "—"} ${earnChange(it.changePct)}</span>
              <span class="earn-row-eps"><i>EPS 예상</i>${it.epsEstimate != null ? moneyOrDash(it.epsEstimate) : "—"}</span>
              <span class="earn-row-target"><i>목표 여력</i>${it.upside != null ? `<b class="${cls(it.upside)}">${fmtPct(it.upside)}</b>` : "—"}</span>
              <span class="earn-row-cap"><i>시총</i>${fmtBillions(it.marketCapB)}${it.capTier ? ` <em class="earn-tier earn-tier-${it.capTier === "메가" ? "mega" : it.capTier === "대형" ? "large" : "mid"}">${escapeHtml(it.capTier)}</em>` : ""}</span>
              <span class="earn-row-rs"><i>RSI</i>${fmtRsi(it)}</span>
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

// 워커 /sync/prefs 바디 상한(yahoo-proxy.js SYNC_PREFS_MAX_BODY_BYTES)에서 여유를 뺀 값.
const CLOUD_SYNC_BODY_BUDGET = 32 * 1024 - 512;

function cloudSyncPayload() {
  const core = window.MirWatchCore;
  const prefs = {
    // legacy `watchlist`(현재 시장 목록)는 구형 클라이언트 호환용으로 남긴다.
    // 시장별 필드를 따로 실어 한쪽 시장 사용이 다른 쪽 목록을 덮어쓰지 않게 한다.
    watchlist,
    watchlistUs: storedWatchlist("us"),
    watchlistKr: storedWatchlist("kr"),
    portfolio: typeof portfolioCloudPayload === "function" ? portfolioCloudPayload() : portfolio,
    alertSettings: watchAlertSettings(),
    // 투자 가설(thesis.js) — 워커 바디 상한(32KB) 안으로 줄인 사본. 로컬 원본은 그대로.
    theses: window.MirThesis ? window.MirThesis.cloudPayload() : undefined,
    updatedAt: Date.now(),
  };
  if (!core) return prefs;
  prefs.watchGroupsUs = core.sanitizeGroups(wlGroups("us"));
  prefs.watchGroupsKr = core.sanitizeGroups(wlGroups("kr"));
  // 메모는 남는 바이트만큼 최신 수정순으로 싣는다(못 실은 것은 로컬에 그대로 — 병합이 지우지 않는다).
  const used = core.utf8Bytes(JSON.stringify({ clientId: getCommunityClientId(), prefs: { ...prefs, watchNotesUs: {}, watchNotesKr: {} } }));
  const fit = core.fitNotes({ us: wlNotes("us"), kr: wlNotes("kr") }, Math.max(0, CLOUD_SYNC_BODY_BUDGET - used));
  prefs.watchNotesUs = fit.notes.us;
  prefs.watchNotesKr = fit.notes.kr;
  return prefs;
}

// 클라우드의 리스트·메모를 로컬에 반영한다. 리스트는 ★ 목록과 같은 규칙(아직 안 올린 로컬 편집이 있으면
// 로컬 유지, 필드가 없으면 — 옛 워커·옛 클라이언트 — 건드리지 않음), 메모는 종목별 수정 시각 병합.
function applyCloudWatchExtras(prefs, localNewer) {
  const core = window.MirWatchCore;
  if (!core) return false;
  let changed = false;
  ["us", "kr"].forEach((m) => {
    const groups = m === "kr" ? prefs.watchGroupsKr : prefs.watchGroupsUs;
    if (!localNewer && Array.isArray(groups)) {
      const next = core.sanitizeGroups(groups);
      if (JSON.stringify(next) !== JSON.stringify(wlGroups(m))) {
        wlSaveGroups(next, { marketId: m, push: false });
        changed = true;
      }
    }
    const notes = m === "kr" ? prefs.watchNotesKr : prefs.watchNotesUs;
    if (notes && typeof notes === "object") {
      const local = wlNotes(m);
      const merged = core.mergeNotes(local, notes);
      if (JSON.stringify(merged) !== JSON.stringify(local)) {
        wlSaveNotes(merged, { marketId: m, push: false });
        changed = true;
      }
    }
  });
  if (changed && wlActiveGroup && !wlGroups().some((g) => g.id === wlActiveGroup)) wlActiveGroup = "";
  return changed;
}

async function pushCloudSync() {
  if (!LIVE_DATA_PROXY) return;
  const url = communityApiUrl("/sync/prefs");
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: getCommunityClientId(), prefs: cloudSyncPayload() }),
    });
    // 4xx/5xx 인데 '저장됨'을 띄우던 것 — 실패면 로컬 편집 표시를 남겨 다음 pull 이 덮지 않게 한다.
    if (!res.ok) return;
    window.safeStorage.set(CLOUD_SYNC_KEY, String(Date.now()));
    window.safeStorage.remove(WATCHLIST_DIRTY_KEY);
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
    // 클라우드 사본보다 나중에 고친 로컬 관심종목이 아직 안 올라갔으면 로컬이 이긴다(올리기를 다시 예약).
    const dirtyAt = Number(window.safeStorage.get(WATCHLIST_DIRTY_KEY) || 0);
    const localNewer = dirtyAt > 0 && dirtyAt > Number(prefs.updatedAt || 0);
    if (localNewer) scheduleCloudSyncPush();
    const other = marketId === "kr" ? prefs.watchlistUs : prefs.watchlistKr;
    if (localNewer) {
      // 현재 시장 목록은 그대로 둔다.
    } else if (Array.isArray(scoped) && scoped.length) {
      watchlist = [...new Set(scoped.map((t) => normalizeTickerKey(t)).filter(Boolean))].slice(0, 80);
      persistWatchlist();
      window.safeStorage.remove(WATCHLIST_DIRTY_KEY); // 클라우드 사본을 받은 것 — 로컬 편집이 아니다
    } else if (!Array.isArray(scoped) && Array.isArray(prefs.watchlist) && prefs.watchlist.length) {
      // 시장별 필드가 없는 구형 payload: 현재 시장 패턴(KR=6자리 숫자)에 맞는 것만 취한다.
      const mine = prefs.watchlist.map((t) => normalizeTickerKey(t)).filter(Boolean)
        .filter((t) => (marketId === "kr") === /^\d{6}$/.test(t));
      if (mine.length) {
        watchlist = [...new Set(mine)].slice(0, 80);
        persistWatchlist();
        window.safeStorage.remove(WATCHLIST_DIRTY_KEY);
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
    if (applyCloudWatchExtras(prefs, localNewer)) {
      watchRenderWhenVisible("bulk", "tab-bulk", () => renderBulk());
      if (window.MirRail) window.MirRail.refresh();
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
      // 받은 값이 지금과 같으면 저장(→ 클라우드 PUT)하지 않는다 — 부팅마다 PUT 이 나가 429 한도를 먹었다.
      const merged = { ...watchAlertSettings(), ...prefs.alertSettings };
      if (JSON.stringify(merged) !== JSON.stringify(watchAlertSettings())) saveWatchAlertSettings(merged);
    }
    // 투자 가설: 로컬과 병합(같은 가설은 더 최근 수정본, 삭제 표식은 합집합).
    if (prefs.theses && typeof prefs.theses === "object" && window.MirThesis) {
      window.MirThesis.applyCloud(prefs.theses);
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
    renderPortfolio();
    renderWatchAlerts();
  }));
  byId("cloudSyncPush")?.addEventListener("click", () => pushCloudSync());
}
