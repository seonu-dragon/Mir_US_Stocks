// ext-hours.js — 오늘 탭 › 요약 '프리·애프터 급등락' 카드(상승 / 하락 / 거래량 급증)
// =====================================================
// 계산(세션 판정·요청 바디·응답 파싱·표기)은 ext-hours-core.js(window.MirExtHoursCore).
// 데이터: 브라우저가 TradingView 스크리너(scanner.tradingview.com/america/scan)를 직접 부른다 — 커밋된
//   스냅샷이 아닌 몇 안 되는 라이브 표면이다(홈 지수 차트와 같은 원칙: 브라우저 탭과 오늘 › 요약이
//   보일 때만, 프리 04:00~09:30 · 정규 · 애프터 16:00~20:00 ET 동안 2분마다, 장외엔 한 번만).
//   Content-Type 헤더를 넣지 않는다(preflight 허용 헤더가 Referer,Accept 뿐 — 넣으면 CORS 실패).
// 실패: 받은 적 없으면 카드를 숨기고, 받은 적 있으면 직전 값을 두고 머리에 '갱신 실패'만 적는다.
// KR 은 TradingView 에 장전·장후 시간외 값이 없어(premarket_*/postmarket_* 전부 null) market_config
//   features.extHoursBoard: false 로 끈다.
// 클래식 스크립트(전역 공유). 최상위 이름은 extHours 접두로 충돌을 피한다.

const EXT_HOURS_TABS = { up: "상승", down: "하락", surge: "거래량 급증" };
const EXT_HOURS_TAB_KEY = "mir_ext_hours_tab";
const EXT_HOURS_TICK_MS = 5000;

const extHoursState = {
  tab: "up",
  cache: {}, // `${session}:${tab}` → { rows, delayMin, sessionTime, at }
  lastTry: {}, // 같은 키 재시도 간격(실패 포함)
  failed: {}, // 키 → 마지막 시도가 실패했는가
  loading: false,
  timer: 0,
  started: false,
  sessionKey: "",
};

function extHoursCore() { return window.MirExtHoursCore || null; }

function extHoursEnabled() {
  const cfg = typeof marketCfg === "function" ? marketCfg() : null;
  if (!cfg || cfg.id !== "us") return false;
  return !(cfg.features && cfg.features.extHoursBoard === false);
}

function extHoursEvents() {
  const c = window.MARKET_CALENDAR;
  return c && Array.isArray(c.events) ? c.events : [];
}

function extHoursSession() {
  const core = extHoursCore();
  return core ? core.sessionAt(Date.now(), extHoursEvents()) : null;
}

// 브라우저 탭과 오늘 › 요약이 보이는가(카드 자체는 첫 응답 전엔 hidden 이라 부모로 본다).
function extHoursVisible() {
  const leaf = byId("tab-today-summary");
  return Boolean(leaf && leaf.offsetParent !== null && !document.hidden);
}

function extHoursKey(sess, tab) { return `${sess.session}:${sess.sinceSec || "last"}:${tab}`; }

function extHoursSavedTab() {
  try {
    const t = window.safeStorage ? window.safeStorage.get(EXT_HOURS_TAB_KEY) : null;
    return EXT_HOURS_TABS[t] ? t : "up";
  } catch (_) { return "up"; }
}

function extHoursFetch(sess, tab) {
  const core = extHoursCore();
  if (!core || extHoursState.loading || typeof fetch !== "function") return;
  const key = extHoursKey(sess, tab);
  extHoursState.loading = true;
  extHoursState.lastTry[key] = Date.now();
  const body = core.buildScanBody(sess.session, tab, { sinceSec: sess.sinceSec });
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const kill = ctl ? setTimeout(() => ctl.abort(), 10000) : 0;
  // 헤더를 넣지 않는다 — 문자열 body 는 text/plain 단순 요청이라 preflight 가 없다.
  fetch(core.ENDPOINT, { method: "POST", body: JSON.stringify(body), cache: "no-store", credentials: "omit", signal: ctl ? ctl.signal : undefined })
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => {
      const parsed = core.parseScanResponse(json, sess.session, tab, {});
      if (!parsed) { extHoursState.failed[key] = true; return; }
      extHoursState.cache[key] = { ...parsed, at: Date.now() };
      extHoursState.failed[key] = false;
    })
    .catch(() => { extHoursState.failed[key] = true; })
    .finally(() => {
      clearTimeout(kill);
      extHoursState.loading = false;
      renderExtHoursBoard();
    });
}

// 5초마다 네트워크 없이 확인만 하고, 받을 때(세션이 바뀜 · 이 탭 값이 없음 · 2분 지남)만 요청한다.
function extHoursTick() {
  clearTimeout(extHoursState.timer);
  extHoursState.timer = 0;
  if (!extHoursEnabled()) return;
  extHoursState.timer = setTimeout(extHoursTick, EXT_HOURS_TICK_MS);
  if (!extHoursVisible() || extHoursState.loading) return;
  const core = extHoursCore();
  const sess = extHoursSession();
  if (!core || !sess) return;
  const key = extHoursKey(sess, extHoursState.tab);
  const sessionChanged = extHoursState.sessionKey !== `${sess.session}:${sess.sinceSec || "last"}`;
  if (sessionChanged) extHoursState.sessionKey = `${sess.session}:${sess.sinceSec || "last"}`;
  const tried = extHoursState.lastTry[key] || 0;
  const have = extHoursState.cache[key];
  // 장외(closed)엔 한 번 받은 값이 바뀌지 않으므로 다시 받지 않는다(실패했으면 2분 뒤 재시도).
  const due = !tried
    || (Date.now() - tried >= core.POLL_MS && (sess.polling || !have));
  if (due) extHoursFetch(sess, extHoursState.tab);
  else if (sessionChanged) renderExtHoursBoard();
}

// 첫 요청은 첫 화면을 막지 않게, 그리고 딥링크로 다른 탭이 열리는 경우 그 전환이 끝난 뒤에 확인하도록 늦춘다.
function extHoursStart() {
  if (extHoursState.started) return false;
  extHoursState.started = true;
  extHoursState.tab = extHoursSavedTab();
  // 휴장·단축 거래 판정용 달력(없어도 주말·시간대 판정은 된다).
  if (typeof ensureFeatureData === "function") ensureFeatureData("marketCalendar");
  document.addEventListener("visibilitychange", () => { if (!document.hidden && extHoursEnabled()) extHoursTick(); });
  if (typeof requestIdleCallback === "function") requestIdleCallback(() => extHoursTick(), { timeout: 4000 });
  else setTimeout(extHoursTick, 1500);
  return true;
}

function extHoursRowHtml(row, sess, core) {
  const metaParts = [];
  metaParts.push(`<span>${escapeHtml(typeof priceOrDash === "function" ? priceOrDash(row.price) : `$${row.price.toFixed(2)}`)}</span>`);
  const volLabel = sess.session === "pre" ? "프리 거래량" : sess.session === "regular" ? "거래량" : "애프터 거래량";
  if (row.vol != null) metaParts.push(`<span>${volLabel} ${escapeHtml(core.fmtVol(row.vol))}</span>`);
  const rel = core.fmtRel(row);
  if (rel) metaParts.push(`<span class="${extHoursState.tab === "surge" ? "ext-strong" : ""}">${escapeHtml(rel)}</span>`);
  if ((sess.session === "post" || sess.session === "closed") && row.regularChg != null) {
    metaParts.push(`<span>정규장 <b class="${cls(row.regularChg)}">${fmtDailyPct(row.regularChg)}</b></span>`);
  }
  const label = { ticker: row.ticker, company: row.name };
  const sub = stockSubLabel(row.ticker, label);
  return `
        <li class="movers-row">
          <button type="button" class="movers-go" data-ticker="${escapeHtml(row.ticker)}" title="종목 분석 열기">
            <span class="movers-name">${(typeof companyLogoHtml === "function" ? companyLogoHtml(row.ticker, null, row.name, 34) : "")}<span class="movers-nm"><b>${escapeHtml(stockLabel(row.ticker, label))}</b>${sub ? `<small title="${escapeHtml(sub)}">${escapeHtml(sub)}</small>` : ""}</span></span>
            <strong class="movers-chg ${cls(row.chg)}">${fmtDailyPct(row.chg)}</strong>
          </button>
          <div class="movers-why ext-meta">${metaParts.join('<span class="movers-sep" aria-hidden="true"> · </span>')}</div>
        </li>`;
}

function renderExtHoursBoard() {
  const el = byId("extHoursBoard");
  if (!el) return;
  const core = extHoursCore();
  if (!core || !extHoursEnabled()) {
    el.hidden = true;
    el.innerHTML = "";
    clearTimeout(extHoursState.timer);
    extHoursState.timer = 0;
    return;
  }
  // 시장 전환(KR → US)으로 멈춘 루프는 다시 건다.
  if (!extHoursStart() && !extHoursState.timer) extHoursTick();
  const sess = extHoursSession();
  if (!sess) { el.hidden = true; return; }
  const tab = extHoursState.tab;
  const key = extHoursKey(sess, tab);
  const data = extHoursState.cache[key];
  // 받은 적 없는 상태 — 다른 탭 값이 있으면 카드는 두고 목록 자리에 '불러오는 중', 아무것도 없으면 숨김.
  const anyData = Object.keys(extHoursState.cache).some((k) => k.startsWith(`${sess.session}:${sess.sinceSec || "last"}:`));
  if (!data && !anyData) { el.hidden = true; el.innerHTML = ""; return; }
  el.hidden = false;
  const failed = extHoursState.failed[key];
  const status = [];
  status.push(escapeHtml(core.sessionLabel(sess, data && data.sessionTime)));
  if (data) status.push(`갱신 ${escapeHtml(core.kstClock(data.at))} KST`);
  if (data && data.delayMin > 0) status.push(`${data.delayMin}분 지연`);
  const warn = failed
    ? `<span class="ext-warn">${data ? "갱신 실패 · 직전 값" : "불러오지 못함"}</span>`
    : (sess.polling && data && Date.now() - data.at > core.POLL_MS * 3 ? `<span class="ext-warn">지연</span>` : "");
  const tabBtn = (t) => `<button type="button" class="movers-tab${tab === t ? " is-active" : ""}" data-ext-tab="${t}" aria-pressed="${tab === t}">${EXT_HOURS_TABS[t]}</button>`;
  let body;
  if (!data) body = `<p class="muted">${failed ? "" : "불러오는 중…"}</p>`;
  else if (!data.rows.length) body = `<p class="muted">조건을 넘은 종목이 아직 없습니다.</p>`;
  else body = `<ol class="movers-list">${data.rows.map((row) => extHoursRowHtml(row, sess, core)).join("")}</ol>`;
  el.innerHTML = `
    <div class="section-title movers-head">
      <div>
        <h2>프리·애프터 급등락</h2>
        <p class="ext-status">${status.join(" · ")}${warn ? ` ${warn}` : ""}</p>
      </div>
      <div class="movers-tabs" role="group" aria-label="상승·하락·거래량 급증 전환">${Object.keys(EXT_HOURS_TABS).map(tabBtn).join("")}</div>
    </div>
    ${body}`;
  el.querySelectorAll("[data-ext-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = EXT_HOURS_TABS[btn.dataset.extTab] ? btn.dataset.extTab : "up";
      extHoursState.tab = t;
      try { if (window.safeStorage) window.safeStorage.set(EXT_HOURS_TAB_KEY, t); } catch (_) { /* ignore */ }
      renderExtHoursBoard();
      extHoursTick();
    });
  });
  delegateTickerClicks(el, ".movers-go");
}
