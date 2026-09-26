// calendar-panel.js — 통합 캘린더(오늘 탭 › 캘린더 › 전체 일정)
// =====================================================
// 실적·배당·공모주·경제지표·휴장·만기를 한 달력에 모은다. 계산은 calendar-panel-core.js
// (window.MirCalendarCore, node 테스트 있음). 여기는 데이터 모으기와 렌더만.
//
// renderCalendarPanel(host, opts) 는 host 하나에 독립적으로 그린다(상태를 host 에 붙여 둔다) —
// 나중에 오른쪽 레일에서 { compact: true } 로 같은 컴포넌트를 쓸 수 있게.
// 데이터: MARKET_CALENDAR(휴장·만기·FOMC) · KR_IR_SCHEDULE(국내 실적 IR) · US_STOCK_CALENDAR +
// EARNINGS_CALENDAR_SNAPSHOT(미국 실적·배당락) · KR_DIVIDENDS · IPO_CALENDAR(시장별) ·
// calendarEventsCache(경제지표, app.js loadCalendar 가 워커에서 받음). 늦게 도착하면
// refreshFeatureViews 와 renderCalendarFiltered 가 renderUnifiedCalendarIfVisible 을 부른다.

const _calPanelStates = new WeakMap();
const CAL_PANEL_KIND_DOT = {
  earnings: "var(--primary)", dividend: "var(--good)", ipo: "var(--warn)",
  econ: "var(--text-2)", holiday: "var(--bad)", expiry: "var(--teal)",
};

function calPanelWatchSet() {
  const set = new Set();
  const add = (t) => { if (t) set.add(String(t).toUpperCase()); };
  (typeof watchlist !== "undefined" && Array.isArray(watchlist) ? watchlist : []).forEach(add);
  (typeof portfolio !== "undefined" && Array.isArray(portfolio) ? portfolio : []).forEach((p) => add(p && p.ticker));
  return set;
}

function calPanelNames() {
  const out = {};
  ((typeof data !== "undefined" && data && data.stocks) || []).forEach((s) => { if (s && s.ticker) out[s.ticker] = s.company || ""; });
  return out;
}

// 이 시장에서 쓸 데이터셋을 요청한다(이미 있으면 즉시). 도착하면 다시 그린다.
function calPanelEnsureData() {
  const cfg = marketCfg();
  const keys = ["marketCalendar", "ipo"];
  if (cfg.id === "us") keys.push("usCalendar");
  else keys.push("krIrSchedule", "krDividends");
  keys.forEach((k) => {
    if (typeof FEATURE_DATA === "undefined" || !FEATURE_DATA[k]) return;
    const meta = FEATURE_DATA[k];
    if (window[meta.global]) return;
    ensureFeatureData(k).then((ok) => { if (ok) renderUnifiedCalendarIfVisible(); });
  });
  if (cfg.id === "us" && !window.EARNINGS_CALENDAR_SNAPSHOT && typeof loadEarningsCalendarSnapshot === "function") {
    loadEarningsCalendarSnapshot(cfg).then((ok) => { if (ok) renderUnifiedCalendarIfVisible(); });
  }
}

function calPanelCollect(today) {
  const core = window.MirCalendarCore;
  const cfg = marketCfg();
  const names = calPanelNames();
  let ev = core.fromMarketCalendar(window.MARKET_CALENDAR);
  if (cfg.id === "us") {
    ev = ev.concat(core.fromUsCalendar(window.US_STOCK_CALENDAR, window.EARNINGS_CALENDAR_SNAPSHOT, names, core.addDays(today, -7)));
    ev = ev.concat(core.fromIpo(window.IPO_CALENDAR, "us"));
  } else {
    ev = ev.concat(core.fromKrIr(window.KR_IR_SCHEDULE), core.fromKrDividends(window.KR_DIVIDENDS), core.fromIpo(window.IPO_CALENDAR, "kr"));
  }
  const econ = (typeof calendarEventsCache !== "undefined" && Array.isArray(calendarEventsCache)) ? calendarEventsCache : [];
  ev = ev.concat(core.fromEcon(econ));
  return core.dedupe(ev);
}

function calPanelState(host, opts) {
  let st = _calPanelStates.get(host);
  if (!st) {
    const today = window.MirCalendarCore.kstToday();
    st = { kind: "all", view: "week", anchor: today, selected: null, watchOnly: false, compact: !!(opts && opts.compact) };
    try {
      const saved = window.safeStorage && window.safeStorage.getJSON("mir_calendar_panel_v1", null);
      if (saved && (saved.view === "week" || saved.view === "month")) st.view = saved.view;
      if (saved && typeof saved.watchOnly === "boolean") st.watchOnly = saved.watchOnly;
    } catch (e) { /* 저장소가 막혀도 기본값으로 */ }
    _calPanelStates.set(host, st);
  }
  return st;
}

function calPanelSave(st) {
  try { window.safeStorage && window.safeStorage.setJSON("mir_calendar_panel_v1", { view: st.view, watchOnly: st.watchOnly }); } catch (e) { /* 무시 */ }
}

function calPanelItemHtml(e) {
  const core = window.MirCalendarCore;
  const mkt = e.market === "kr" ? "한국" : e.market === "us" ? "미국" : "";
  let who = "";
  if (e.ticker || e.name) {
    const row = e.ticker && typeof stockByTicker === "function" ? stockByTicker(e.ticker) : null;
    const main = row ? stockLabel(row) : (e.market === "kr" ? (e.name || e.ticker) : (e.ticker || e.name));
    const sub = row ? stockSubLabel(row) : (e.market === "kr" ? "" : (e.ticker ? e.name : ""));
    const logo = e.ticker && typeof companyLogoHtml === "function"
      ? companyLogoHtml(row ? row.ticker : e.ticker, e.market === "kr" || e.market === "us" ? e.market : null, row ? row.name : e.name, 18) : "";
    const label = `${logo}<strong>${escapeHtml(main)}</strong>${sub ? ` <span class="calp-sub">${escapeHtml(sub)}</span>` : ""}`;
    who = row
      ? `<button type="button" class="calp-who" data-cal-ticker="${escapeHtml(row.ticker)}">${label}</button>`
      : `<span class="calp-who">${label}</span>`;
  }
  const head = who ? `${who}<span class="calp-what">${escapeHtml(e.title)}${e.sub ? ` · ${escapeHtml(e.sub)}` : ""}</span>`
    : `<strong class="calp-what-main">${escapeHtml(e.title)}</strong>${e.name ? `<span class="calp-what">${escapeHtml(e.name)}</span>` : ""}${e.sub ? `<span class="calp-what">${escapeHtml(e.sub)}</span>` : ""}`;
  const info = e.info ? `<div class="calp-info">${escapeHtml(e.info)}</div>` : "";
  const link = e.link ? ` <a class="calp-link" href="${escapeHtml(e.link)}" target="_blank" rel="noopener">원문</a>` : "";
  return `<li class="calp-item${e.important ? " is-important" : ""}">
    <span class="calp-tag" style="--calp-dot:${CAL_PANEL_KIND_DOT[e.kind] || "var(--muted)"}">${escapeHtml(core.KIND_LABEL[e.kind] || "")}</span>
    <div class="calp-main"><div class="calp-line">${head}</div>${info}</div>
    <span class="calp-meta">${e.time ? `<span class="calp-time">${escapeHtml(e.time)}</span>` : ""}${mkt ? `<span class="calp-mkt">${mkt}</span>` : ""}${link}</span>
  </li>`;
}

function calPanelGridHtml(st, byDate, today) {
  const core = window.MirCalendarCore;
  const weeks = st.view === "month" ? core.monthGrid(st.anchor)
    : [Array.from({ length: 7 }, (_, i) => ({ iso: core.addDays(st.anchor, i), inMonth: true }))];
  // 요일 머리는 첫 줄의 실제 날짜에서 — 주 보기는 기준일부터 7일이라 일요일 시작이 아닐 수 있다.
  const head = weeks[0].map((c) => {
    const wd = core.weekday(c.iso);
    return `<th scope="col" class="${wd === 0 ? "is-sun" : wd === 6 ? "is-sat" : ""}">${core.WEEKDAY_KO[wd]}</th>`;
  }).join("");
  const rows = weeks.map((w) => `<tr>${w.map((c) => {
    const kinds = byDate[c.iso] ? [...byDate[c.iso]] : [];
    const dots = kinds.slice(0, 4).map((k) => `<i style="background:${CAL_PANEL_KIND_DOT[k] || "var(--muted)"}"></i>`).join("");
    const cls = ["calp-day", c.inMonth ? "" : "is-out", c.iso === today ? "is-today" : "", c.iso === st.selected ? "is-selected" : "",
      kinds.includes("holiday") ? "has-holiday" : ""].filter(Boolean).join(" ");
    const d = Number(c.iso.slice(8));
    const aria = `${core.dayLabel(c.iso)}${kinds.length ? ` 일정 ${kinds.map((k) => core.KIND_LABEL[k]).join("·")}` : ""}`;
    return `<td><button type="button" class="${cls}" data-cal-day="${c.iso}" aria-label="${escapeHtml(aria)}" aria-pressed="${c.iso === st.selected}"><span>${d}</span><span class="calp-dots">${dots}</span></button></td>`;
  }).join("")}</tr>`).join("");
  return `<table class="calp-grid"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

function calPanelFootHtml(cfg) {
  const mc = window.MARKET_CALENDAR;
  const parts = [];
  parts.push("휴장·만기는 거래소 규칙으로 계산(거래소 공지가 우선) · 경제지표는 investing.com 중요도 보통 이상, 이번 주·다음 주만");
  if (cfg.id === "us") parts.push("미국 실적일은 Yahoo Finance 예정일로 회사 확정 전에는 추정일일 수 있음");
  else parts.push(`국내 실적: ${(window.KR_IR_SCHEDULE && window.KR_IR_SCHEDULE.note) || "실적 전에 기업설명회(IR)를 여는 회사만 잡힙니다."}`);
  const stamp = mc && mc.updatedAtKst ? ` · 달력 기준 ${escapeHtml(mc.updatedAtKst)}` : "";
  return `<p class="calp-foot">${parts.map(escapeHtml).join("<br>")}${stamp}</p>`;
}

function renderCalendarPanel(host, opts) {
  if (!host || !window.MirCalendarCore) return;
  const core = window.MirCalendarCore;
  const cfg = marketCfg();
  const st = calPanelState(host, opts);
  const today = core.kstToday();
  const range = core.rangeFor(st.view, st.anchor);
  const watchSet = calPanelWatchSet();
  const all = calPanelCollect(today);
  const inRange = core.filterEvents(all, { start: range.start, end: range.end, watchOnly: st.watchOnly, watchSet });
  const counts = core.countByKind(inRange);
  const shown = core.filterEvents(inRange, { kind: st.kind, start: st.selected || undefined, end: st.selected || undefined });
  const byDate = core.kindsByDate(core.filterEvents(inRange, { kind: st.kind }));
  const loading = !window.MARKET_CALENDAR && !(typeof _featureDataFailed !== "undefined" && _featureDataFailed.marketCalendar);

  const chips = core.KINDS.map((k) => `<button type="button" data-cal-kind="${k.id}" class="${st.kind === k.id ? "is-active" : ""}" aria-pressed="${st.kind === k.id}">${escapeHtml(k.label)}<span class="calp-count">${counts[k.id] || 0}</span></button>`).join("");
  const [ay, am] = st.anchor.split("-").map(Number);
  const title = st.view === "month" ? `${ay}년 ${am}월`
    : `${Number(range.start.slice(5, 7))}월 ${Number(range.start.slice(8))}일 ~ ${Number(range.end.slice(5, 7))}월 ${Number(range.end.slice(8))}일`;

  let list;
  if (loading && !all.length) {
    list = `<p class="muted">일정을 불러오는 중…</p>`;
  } else if (st.watchOnly && !watchSet.size) {
    list = `<p class="muted">관심종목·보유 종목이 없습니다. 종목 화면의 ☆ 로 관심종목을 추가하세요.</p>`;
  } else if (!shown.length) {
    list = `<p class="muted">${st.selected ? `${escapeHtml(core.dayLabel(st.selected))}에는` : "이 기간에"} 표시할 일정이 없습니다.</p>`;
  } else {
    list = core.groupByDate(shown).map((g) => {
      const diff = core.dayDiff(today, g.date);
      const rel = diff === 0 ? "오늘" : diff === 1 ? "내일" : diff > 1 ? `D-${diff}` : "";
      return `<section class="calp-daygroup${g.date === today ? " is-today" : ""}">
        <h4>${escapeHtml(core.dayLabel(g.date))}${rel ? ` <span class="calp-rel">${rel}</span>` : ""}</h4>
        <ul class="calp-items">${g.rows.map(calPanelItemHtml).join("")}</ul>
      </section>`;
    }).join("");
  }

  host.innerHTML = `<div class="calp${st.compact ? " is-compact" : ""}">
    <div class="calp-toolbar">
      <div class="segmented calp-chips" role="group" aria-label="일정 종류">${chips}</div>
      <label class="check-label calp-watch" title="관심·보유 종목의 실적·배당·공모 일정만 봅니다. 휴장·만기·경제지표는 그대로 보입니다."><input type="checkbox" data-cal-watch${st.watchOnly ? " checked" : ""}> 관심·보유 종목만</label>
    </div>
    <div class="calp-body">
      <div class="calp-cal">
        <div class="calp-nav">
          <button type="button" class="ghost compact-btn" data-cal-move="-1" aria-label="이전">‹</button>
          <strong class="calp-title">${escapeHtml(title)}</strong>
          <button type="button" class="ghost compact-btn" data-cal-move="1" aria-label="다음">›</button>
          <button type="button" class="ghost compact-btn" data-cal-today>오늘</button>
          <div class="segmented calp-view" role="group" aria-label="보기">
            <button type="button" data-cal-view="week" class="${st.view === "week" ? "is-active" : ""}">주</button>
            <button type="button" data-cal-view="month" class="${st.view === "month" ? "is-active" : ""}">월</button>
          </div>
        </div>
        ${calPanelGridHtml(st, byDate, today)}
        ${st.selected ? `<button type="button" class="ghost compact-btn calp-clear" data-cal-clear>${escapeHtml(core.dayLabel(st.selected))} 선택 해제</button>` : ""}
      </div>
      <div class="calp-list" aria-live="polite">${list}</div>
    </div>
    ${calPanelFootHtml(cfg)}
    ${st.compact && opts && opts.container === "rail" ? `<div class="mir-rail-tools"><button type="button" class="mir-rail-link" data-rail-goto="calendar">캘린더 전체 보기</button></div>` : ""}
  </div>`;

  if (!host.dataset.calBound) {
    host.dataset.calBound = "1";
    host.addEventListener("click", (ev) => {
      const t = ev.target.closest("button, input");
      if (!t || !host.contains(t)) return;
      const s = _calPanelStates.get(host);
      if (!s) return;
      const c = window.MirCalendarCore;
      if (t.dataset.calKind) s.kind = t.dataset.calKind;
      else if (t.dataset.calView) { s.view = t.dataset.calView; s.selected = null; calPanelSave(s); }
      else if (t.dataset.calMove) {
        const n = Number(t.dataset.calMove);
        s.anchor = s.view === "month" ? c.addMonths(s.anchor, n) : c.addDays(s.anchor, 7 * n);
        s.selected = null;
      } else if (t.hasAttribute("data-cal-today")) { s.anchor = c.kstToday(); s.selected = null; }
      else if (t.dataset.calDay) s.selected = s.selected === t.dataset.calDay ? null : t.dataset.calDay;
      else if (t.hasAttribute("data-cal-clear")) s.selected = null;
      else if (t.dataset.calTicker) { selectTicker(t.dataset.calTicker, { openSearch: true }); return; }
      else if (t.hasAttribute("data-cal-watch")) { s.watchOnly = t.checked; calPanelSave(s); }
      else return;
      renderCalendarPanel(host, opts);
    });
  }
}

// 오늘 탭 › 캘린더 › 전체 일정.
function renderUnifiedCalendar() {
  const host = byId("calendarPanelHost");
  if (!host) return;
  calPanelEnsureData();
  if (typeof loadCalendar === "function" && typeof calendarLoaded !== "undefined" && !calendarLoaded) loadCalendar();
  renderCalendarPanel(host);
}

function renderUnifiedCalendarIfVisible() {
  const panel = byId("sub-all");
  if (panel && panel.classList.contains("is-active") && typeof currentTab !== "undefined" && currentTab === "calendar") {
    const host = byId("calendarPanelHost");
    if (host) renderCalendarPanel(host);
  }
}

// 오른쪽 레일(rail.js)이 window.MirCalendarPanel.render(el, { market, compact, container }) 로 부른다.
window.MirCalendarPanel = {
  render(host, opts) {
    calPanelEnsureData();
    if (typeof loadCalendar === "function" && typeof calendarLoaded !== "undefined" && !calendarLoaded) loadCalendar();
    renderCalendarPanel(host, opts);
  },
};
