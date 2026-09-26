// 오른쪽 레일(UI 개편 4단계) — PC(≥1280px) 전용.
// 56px 아이콘 열(최근 본 · 관심 · 보유 · 캘린더 · AI 챗) + 누르면 레일 왼쪽에 320px 패널.
// 본문은 body 오른쪽 여백으로 밀어서 가리지 않는다. 열린 항목은 localStorage(try/catch)에 저장.
// 챗 FAB 는 PC 에서 숨기고, 기존 #chatPanel 노드를 패널 안으로 옮겨 담는다(모바일은 FAB 그대로).
// 전역은 window.MirRail 하나. 연결점: app.js selectTicker(최근 본 기록)·loadData 끝(시장 전환),
// feature-data.js refreshFeatureViews(피처 데이터 늦은 도착).
(function () {
  "use strict";

  const STATE_KEY = "mir_rail_state_v1";
  const RECENT_KEY = "mir_recent_viewed_v1";
  const RECENT_MAX = 20;
  const MQ = window.matchMedia ? window.matchMedia("(min-width: 1280px)") : null;

  const SVG = (inner) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${inner}</svg>`;
  const ITEMS = [
    { id: "recent", label: "최근 본", title: "최근 본 종목",
      icon: SVG('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>') },
    { id: "watch", label: "관심", title: "관심종목",
      icon: SVG('<path d="M12 3.8l2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8z"/>') },
    { id: "hold", label: "보유", title: "보유 종목",
      icon: SVG('<rect x="3.5" y="7" width="17" height="12.5" rx="2"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17"/>') },
    { id: "calendar", label: "캘린더", title: "캘린더",
      icon: SVG('<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>') },
    { id: "chat", label: "AI 챗", title: "미르 도우미",
      icon: SVG('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.4A.7.7 0 0 1 4.7 19v-3A2.5 2.5 0 0 1 4 13.5v-8Z"/><path d="M8.5 8.5h7M8.5 11.5h4.5"/>') },
  ];

  let root = null;
  let panelEl = null;
  let bodyEl = null;
  let titleEl = null;
  let chatSlot = null;
  let openId = "";
  let restoringChat = false;

  const esc = (v) => (typeof escapeHtml === "function" ? escapeHtml(v) : String(v == null ? "" : v));
  const html = document.documentElement;

  function readJSON(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function writeJSON(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 저장 불가(사생활 모드 등) — 무시 */ }
  }

  function marketId() {
    try { return (typeof isKrMarket === "function" && isKrMarket()) ? "kr" : "us"; } catch (e) { return "us"; }
  }
  function isWide() { return !MQ || MQ.matches; }
  function isAiMode() { return document.body && document.body.classList.contains("ai-mode-active"); }
  function enabled() { return isWide() && !isAiMode(); }

  // ----- 최근 본 종목 -----
  function recentKey() { return `${RECENT_KEY}:${marketId()}`; }
  function recentList() {
    const list = readJSON(recentKey(), []);
    return Array.isArray(list) ? list.filter((t) => typeof t === "string" && t) : [];
  }
  function noteViewed(ticker) {
    const t = String(ticker || "").trim();
    if (!t) return;
    const next = [t, ...recentList().filter((x) => x !== t)].slice(0, RECENT_MAX);
    writeJSON(recentKey(), next);
    if (openId === "recent") renderBody();
  }

  // ----- 데이터 헬퍼 -----
  function stockOf(t) {
    try { return typeof stockByTicker === "function" ? stockByTicker(t) : null; } catch (e) { return null; }
  }
  function priceText(v) {
    try { if (typeof priceOrDash === "function") { const s = priceOrDash(v); return s === "-" ? "—" : s; } } catch (e) { /* ignore */ }
    return Number.isFinite(Number(v)) ? String(v) : "—";
  }
  function pctText(v) {
    if (!Number.isFinite(Number(v))) return "—";
    try { if (typeof fmtDailyPct === "function") return fmtDailyPct(Number(v)); } catch (e) { /* ignore */ }
    const n = Number(v);
    return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
  }
  function dirCls(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n === 0) return "muted";
    return n > 0 ? "pos" : "neg";
  }
  function nameOf(t, s) {
    try { if (typeof stockLabel === "function") return stockLabel(t, s || undefined); } catch (e) { /* ignore */ }
    return (s && (s.company || s.name)) || t;
  }
  function subOf(t, s) {
    try { if (typeof stockSubLabel === "function") return stockSubLabel(t, s || undefined) || ""; } catch (e) { /* ignore */ }
    return "";
  }
  function asOfLine() {
    try {
      const d = typeof data !== "undefined" ? data : null;
      if (d && d.updatedAtKst) return `<p class="mir-rail-foot">스냅샷 기준 ${esc(d.updatedAtKst)} · 투자 권유 아님</p>`;
    } catch (e) { /* ignore */ }
    return "";
  }

  function rowsHtml(tickers, extra) {
    const rows = tickers.map((t) => {
      const s = stockOf(t);
      if (!s) return "";
      const sub = extra ? extra(t, s) : esc(subOf(t, s));
      return `<li><button type="button" class="mir-rail-row" data-rail-ticker="${esc(s.ticker)}">
        <span class="mir-rail-name-wrap">${typeof companyLogoHtml === "function" ? companyLogoHtml(s.ticker, null, s.name, 24) : ""}<span class="mir-rail-name"><strong>${esc(nameOf(s.ticker, s))}</strong>${sub ? `<small>${sub}</small>` : ""}</span></span>
        <span class="mir-rail-num">${esc(priceText(s.price))}</span>
        <span class="mir-rail-num ${dirCls(s.changePct)}">${esc(pctText(s.changePct))}</span>
      </button></li>`;
    }).join("");
    return rows;
  }

  function listBlock(rows, emptyText, head) {
    if (!rows) return `<p class="mir-rail-empty">${emptyText}</p>`;
    return `<div class="mir-rail-thead" aria-hidden="true"><span>${head || "종목"}</span><span>현재가</span><span>등락</span></div>
      <ul class="mir-rail-list">${rows}</ul>${asOfLine()}`;
  }

  function renderRecent() {
    const list = recentList();
    const rows = rowsHtml(list);
    const tools = list.length ? `<div class="mir-rail-tools"><button type="button" class="mir-rail-link" data-rail-clear-recent>기록 지우기</button></div>` : "";
    return tools + listBlock(rows, "종목 분석 화면에서 본 종목이 여기에 쌓입니다(최대 20개, 이 브라우저에만 저장).");
  }

  function renderWatch() {
    const list = (typeof watchlist !== "undefined" && Array.isArray(watchlist)) ? watchlist : [];
    const rows = rowsHtml(list);
    return listBlock(rows, "관심종목이 없습니다. 종목 분석 화면의 ☆ 로 추가하세요.")
      + `<div class="mir-rail-tools"><button type="button" class="mir-rail-link" data-rail-goto="bulk">관심 리스트 전체 보기</button></div>`;
  }

  function renderHold() {
    const list = (typeof portfolio !== "undefined" && Array.isArray(portfolio)) ? portfolio : [];
    const byT = new Map(list.map((p) => [p.ticker, p]));
    const rows = rowsHtml(list.map((p) => p.ticker), (t, s) => {
      const p = byT.get(t) || byT.get(s.ticker);
      if (!p) return "";
      const qty = Number(p.qty);
      const cost = Number(p.avgCost);
      const price = Number(s.price);
      const parts = [];
      if (Number.isFinite(qty) && qty > 0) parts.push(`${qty.toLocaleString("ko-KR")}주`);
      if (Number.isFinite(cost) && cost > 0 && Number.isFinite(price)) {
        const r = (price / cost - 1) * 100;
        parts.push(`<span class="${dirCls(r)}">수익률 ${r > 0 ? "+" : ""}${r.toFixed(1)}%</span>`);
      }
      return parts.join(" · ");
    });
    return listBlock(rows, "보유 종목이 없습니다. 내 투자 › 포트폴리오에서 추가하세요.")
      + `<div class="mir-rail-tools"><button type="button" class="mir-rail-link" data-rail-goto="portfolio">포트폴리오 전체 보기</button></div>`;
  }

  // 캘린더: calendar-panel.js(다른 작업)가 있으면 그 렌더를 쓰고, 없으면 실적 예정일 목록.
  function renderCalendarInto(el) {
    const cp = window.MirCalendarPanel;
    if (cp && typeof cp.render === "function") {
      try { cp.render(el, { market: marketId(), compact: true, container: "rail" }); return; } catch (e) { console.warn("MirCalendarPanel.render", e); }
    }
    let rows = [];
    try { rows = typeof earningsSnapshotRows === "function" ? earningsSnapshotRows() : []; } catch (e) { rows = []; }
    const today = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const mine = new Set([
      ...((typeof watchlist !== "undefined" && Array.isArray(watchlist)) ? watchlist : []),
      ...((typeof portfolio !== "undefined" && Array.isArray(portfolio)) ? portfolio.map((p) => p.ticker) : []),
    ]);
    const upcoming = rows
      .filter((r) => r && r.ticker && typeof r.nextDate === "string" && r.nextDate >= todayStr)
      .sort((a, b) => (a.nextDate < b.nextDate ? -1 : a.nextDate > b.nextDate ? 1 : 0))
      .slice(0, 20);
    const goto = `<div class="mir-rail-tools"><button type="button" class="mir-rail-link" data-rail-goto="calendar">캘린더 전체 보기</button></div>`;
    if (!upcoming.length) {
      el.innerHTML = `<p class="mir-rail-empty">${marketId() === "kr" ? "국내는 실적 예정일 데이터가 없습니다." : "다가오는 실적 일정이 없습니다."}</p>${goto}`;
      return;
    }
    const src = window.EARNINGS_CALENDAR_SNAPSHOT && window.EARNINGS_CALENDAR_SNAPSHOT.updatedAtKst;
    el.innerHTML = `<p class="mir-rail-caption">다가오는 실적 발표</p>
      <ul class="mir-rail-list mir-rail-cal">${upcoming.map((r) => {
        const s = stockOf(r.ticker);
        const d = r.nextDate.slice(5).replace("-", "/");
        return `<li><button type="button" class="mir-rail-row" data-rail-ticker="${esc(r.ticker)}">
          <span class="mir-rail-date">${esc(d)}</span>
          <span class="mir-rail-name"><strong>${esc(nameOf(r.ticker, s))}</strong>${mine.has(r.ticker) ? '<small class="mir-rail-mine">내 종목</small>' : (s && subOf(r.ticker, s) ? `<small>${esc(subOf(r.ticker, s))}</small>` : "")}</span>
          <span class="mir-rail-num muted">실적</span>
        </button></li>`;
      }).join("")}</ul>
      ${src ? `<p class="mir-rail-foot">예정일 기준 ${esc(src)} · 일정은 바뀔 수 있음</p>` : ""}${goto}`;
  }

  // ----- 챗 마운트 -----
  function chatPanelNode() { return document.getElementById("chatPanel"); }
  function mountChat() {
    const panel = chatPanelNode();
    if (!panel || !chatSlot) return;
    if (panel.parentNode !== chatSlot) chatSlot.appendChild(panel);
    chatSlot.hidden = false;
    if (panel.hidden) {
      const toggle = document.getElementById("chatToggle");
      if (toggle) toggle.click(); // 기존 openPanel(인사말·포커스)을 그대로 탄다
    } else {
      const input = document.getElementById("chatInput");
      if (input) input.focus();
    }
  }
  function unmountChat() {
    const panel = chatPanelNode();
    const home = document.getElementById("chatbot");
    if (chatSlot) chatSlot.hidden = true;
    if (!panel || !home || panel.parentNode === home) return;
    home.insertBefore(panel, home.firstChild);
    if (!panel.hidden) {
      const close = document.getElementById("chatClose");
      restoringChat = true;
      try { if (close) close.click(); } finally { restoringChat = false; }
    }
  }

  // ----- 패널 열고 닫기 -----
  function renderBody() {
    if (!bodyEl || !openId || openId === "chat") return;
    try {
      if (openId === "recent") bodyEl.innerHTML = renderRecent();
      else if (openId === "watch") bodyEl.innerHTML = renderWatch();
      else if (openId === "hold") bodyEl.innerHTML = renderHold();
      else if (openId === "calendar") renderCalendarInto(bodyEl);
    } catch (e) {
      console.warn("MirRail render", e);
      bodyEl.innerHTML = `<p class="mir-rail-empty">내용을 불러오지 못했습니다.</p>`;
    }
  }

  function syncButtons() {
    if (!root) return;
    root.querySelectorAll("[data-rail-item]").forEach((btn) => {
      const on = btn.dataset.railItem === openId;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-expanded", on ? "true" : "false");
    });
  }

  function open(id, { persist = true } = {}) {
    const item = ITEMS.find((it) => it.id === id);
    if (!item || !root) return;
    if (openId === "chat" && id !== "chat") unmountChat();
    openId = id;
    panelEl.hidden = false;
    html.classList.add("rail-open");
    titleEl.textContent = item.title;
    const isChat = id === "chat";
    bodyEl.hidden = isChat;
    panelEl.classList.toggle("is-chat", isChat);
    if (isChat) mountChat();
    else { if (chatSlot) chatSlot.hidden = true; renderBody(); }
    syncButtons();
    if (persist) writeJSON(STATE_KEY, { open: id });
  }

  function close({ persist = true } = {}) {
    if (openId === "chat") unmountChat();
    openId = "";
    if (panelEl) panelEl.hidden = true;
    html.classList.remove("rail-open");
    syncButtons();
    if (persist) writeJSON(STATE_KEY, { open: "" });
  }

  function refresh() {
    if (openId && openId !== "chat") renderBody();
  }

  function gotoTab(target) {
    try {
      if (target === "bulk" || target === "portfolio") activateTab("bulk");
      else if (target === "calendar") activateTab("calendar");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) { console.warn("MirRail goto", e); }
  }

  function build() {
    root = document.createElement("aside");
    root.className = "mir-rail";
    root.id = "mirRail";
    root.setAttribute("aria-label", "빠른 패널");
    root.innerHTML = `
      <div class="mir-rail-panel" id="mirRailPanel" role="region" aria-labelledby="mirRailTitle" hidden>
        <div class="mir-rail-head">
          <strong id="mirRailTitle"></strong>
          <button type="button" class="mir-rail-close" data-rail-close aria-label="패널 닫기" title="닫기">✕</button>
        </div>
        <div class="mir-rail-body" id="mirRailBody"></div>
        <div class="mir-rail-chat" id="mirRailChat" hidden></div>
      </div>
      <nav class="mir-rail-bar" aria-label="빠른 패널 메뉴">
        ${ITEMS.map((it) => `<button type="button" class="mir-rail-btn" data-rail-item="${it.id}" aria-expanded="false" aria-controls="mirRailPanel" title="${esc(it.title)}">
          ${it.icon}<span>${esc(it.label)}</span></button>`).join("")}
      </nav>`;
    document.body.appendChild(root);
    panelEl = root.querySelector("#mirRailPanel");
    bodyEl = root.querySelector("#mirRailBody");
    titleEl = root.querySelector("#mirRailTitle");
    chatSlot = root.querySelector("#mirRailChat");

    root.addEventListener("click", (event) => {
      const itemBtn = event.target.closest("[data-rail-item]");
      if (itemBtn) {
        const id = itemBtn.dataset.railItem;
        if (openId === id) close(); else open(id);
        return;
      }
      if (event.target.closest("[data-rail-close]")) { close(); return; }
      const row = event.target.closest("[data-rail-ticker]");
      if (row) {
        try { selectTicker(row.dataset.railTicker, { openSearch: true }); } catch (e) { console.warn("MirRail select", e); }
        return;
      }
      const go = event.target.closest("[data-rail-goto]");
      if (go) { gotoTab(go.dataset.railGoto); return; }
      if (event.target.closest("[data-rail-clear-recent]")) {
        writeJSON(recentKey(), []);
        renderBody();
      }
    });

    // 레일 안 챗의 ✕ 는 레일 패널을 닫는다(FAB 복귀가 아니라).
    document.addEventListener("click", (event) => {
      if (restoringChat) return;
      const btn = event.target.closest && event.target.closest("#chatClose");
      if (btn && chatSlot && chatSlot.contains(btn)) {
        event.stopPropagation();
        event.preventDefault();
        close();
      }
    }, true);

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !openId || !html.classList.contains("rail-enabled")) return;
      if (document.querySelector(".cmdk-overlay:not([hidden]), .lightbox:not([hidden])")) return;
      close();
    });

    // 관심 ☆ 토글 등 다른 화면의 변경은 다음 틱에 다시 그린다(watchlist 전역을 직접 읽음).
    document.addEventListener("click", (event) => {
      if (!openId || openId === "chat") return;
      if (event.target.closest && event.target.closest("[data-watch], .pf-del, #pfClear, #pfAdd, .watch-chip-remove")) {
        setTimeout(refresh, 0);
      }
    });
  }

  function applyMode() {
    const on = enabled();
    const was = html.classList.contains("rail-enabled");
    html.classList.toggle("rail-enabled", on);
    if (!on && was) {
      // 좁아지면 패널은 닫되 저장된 선택은 유지(다시 넓어지면 복원). 챗은 FAB 로 돌려보낸다.
      close({ persist: false });
    } else if (on && !was) {
      const st = readJSON(STATE_KEY, {});
      if (st && typeof st.open === "string" && st.open) open(st.open, { persist: false });
    }
  }

  function init() {
    if (root) return;
    build();
    applyMode();
    if (MQ) {
      if (typeof MQ.addEventListener === "function") MQ.addEventListener("change", applyMode);
      else if (typeof MQ.addListener === "function") MQ.addListener(applyMode);
    }
    // AI 모드 진입/이탈(body class)도 반영한다.
    try {
      new MutationObserver(applyMode).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    } catch (e) { /* ignore */ }
  }

  window.MirRail = { init, open, close, refresh, noteViewed, recent: recentList };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
