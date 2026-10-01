// 업데이트 소식(체인지로그) + 화면별 '새 기능' 안내 카드 — index.html · analysis.html 공용.
//
// - 데이터: data/changelog.js(window.MIR_CHANGELOG, 손으로 쓰는 파일). 부팅 뒤 한 번 지연 로드한다.
// - 계산: changelog-core.js(MirChangelogCore) — 안 읽은 소식, 화면별 카드 고르기. 여기는 DOM 만.
// - 들어가는 곳: 헤더 '업데이트 소식' 버튼(안 읽음 점, 폰에서는 숨기고 설정 톱니에 점) · 설정 팝오버 항목
//   (index.html 의 [data-open="changelog"]) · ⌘K 팔레트(app.js cmdkBuildActions) → window.MirChangelog.open().
// - 안내 카드: 항목의 targets(요소 id)가 화면에 보이면 그 맨 위에 1장. 닫으면(✕·해보기) 다시 안 뜬다.
//   페이지를 3번 열어도 안 닫으면 더 띄우지 않는다. 45일 지난 항목은 카드로 안 띄운다(목록에는 남음).
// - 저장: localStorage 3개 키(try/catch — 막힌 환경에서도 화면은 그대로 동작, 저장만 안 됨).
// 전역은 window.MirChangelog 하나.
(function () {
  "use strict";

  const KEY_SEEN = "mir_changelog_seen_v1";
  const KEY_DISMISSED = "mir_changelog_dismissed_v1";
  const KEY_IMPR = "mir_changelog_impr_v1";
  const CARD_MAX_AGE_DAYS = 45;
  const CARD_MAX_IMPRESSIONS = 3;
  const NEW_WINDOW_DAYS = 14;

  const core = () => window.MirChangelogCore;
  let entries = null;
  let loadPromise = null;
  let dialog = null;
  let headerBtn = null;
  let checkTimers = [];
  const shownThisLoad = new Set();   // 이번 페이지에서 노출 수를 센 항목
  const observed = new WeakSet();    // 카드가 지워지는지 지켜보는 화면 요소
  const suppressed = new Set();      // 이번 페이지에서 카드를 닫은 화면 — 닫자마자 다음 카드가 뜨지 않게

  const SVG_SPARK = '<svg class="mir-cl-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3.5l1.6 4.4a2 2 0 0 0 1.2 1.2l4.4 1.6-4.4 1.6a2 2 0 0 0-1.2 1.2L12 17.9l-1.6-4.4a2 2 0 0 0-1.2-1.2L4.8 10.7l4.4-1.6a2 2 0 0 0 1.2-1.2z"/><path d="M18.5 15.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z"/></svg>';
  const SVG_NEWS = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 4.5h11a1.5 1.5 0 0 1 1.5 1.5v12.5a1.5 1.5 0 0 0 1.5 1.5H6.5A2.5 2.5 0 0 1 4 17.5V5.5a1 1 0 0 1 1-1z"/><path d="M17.5 9H20v9.5a1.5 1.5 0 0 1-3 0M7.5 8.5h6M7.5 12h6M7.5 15.5h4"/></svg>';

  // ----- 저장소(try/catch) -----
  function readJSON(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) { return fallback; }
  }
  function writeJSON(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* 저장 불가 — 무시 */ }
  }

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function todayKst() {
    try {
      // en-CA 는 YYYY-MM-DD 로 찍는다.
      return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    } catch (_) {
      const d = new Date(Date.now() + 9 * 3600000);
      return d.toISOString().slice(0, 10);
    }
  }

  function currentMarket() {
    const m = window.MIR_MARKET_MODE || document.documentElement.getAttribute("data-market") || "us";
    return m === "kr" ? "kr" : "us";
  }

  function aiModeActive() {
    return !!(document.body && document.body.classList.contains("ai-mode-active"));
  }

  // ----- 데이터 로드 -----
  function load() {
    if (entries) return Promise.resolve(entries);
    if (loadPromise) return loadPromise;
    loadPromise = new Promise((resolve) => {
      const done = () => {
        const c = core();
        entries = c ? c.normalizeEntries(window.MIR_CHANGELOG) : [];
        resolve(entries);
      };
      if (window.MIR_CHANGELOG) { done(); return; }
      const s = document.createElement("script");
      const v = encodeURIComponent(window.MIR_BUILD_ID || "dev");
      s.src = `data/changelog.js?v=${v}`;
      s.async = true;
      s.onload = done;
      s.onerror = () => { entries = []; resolve(entries); };
      document.head.appendChild(s);
    });
    return loadPromise;
  }

  // ----- 안 읽음 -----
  function unread() {
    const c = core();
    if (!c || !entries) return [];
    return c.unreadEntries(entries, readJSON(KEY_SEEN, null), { today: todayKst(), newWindowDays: NEW_WINDOW_DAYS });
  }

  function updateBadges() {
    const n = unread().length;
    document.querySelectorAll("[data-cl-dot]").forEach((el) => { el.hidden = n === 0; });
    if (headerBtn) {
      headerBtn.setAttribute("aria-label", n ? `업데이트 소식 (새 소식 ${n}개)` : "업데이트 소식");
      headerBtn.classList.toggle("has-unread", n > 0);
    }
    const gear = document.getElementById("settingsToggle");
    if (gear) gear.classList.toggle("mir-cl-has-unread", n > 0);
  }

  // ----- 헤더 버튼(index.html 만) -----
  function ensureHeaderEntry() {
    const right = document.querySelector(".ia-topbar-right");
    const gearWrap = right && right.querySelector(".ia-gear-wrap");
    if (!right || !gearWrap) return;
    if (!headerBtn) {
      headerBtn = document.createElement("button");
      headerBtn.type = "button";
      headerBtn.className = "mir-cl-btn";
      headerBtn.id = "changelogToggle";
      headerBtn.title = "업데이트 소식";
      headerBtn.setAttribute("aria-haspopup", "dialog");
      headerBtn.innerHTML = `${SVG_NEWS}<span class="mir-cl-dot" data-cl-dot hidden></span>`;
      headerBtn.addEventListener("click", () => open());
      right.insertBefore(headerBtn, gearWrap);
    }
    const gear = document.getElementById("settingsToggle");
    if (gear && !gear.querySelector("[data-cl-dot]")) {
      const dot = document.createElement("span");
      dot.className = "mir-cl-dot mir-cl-dot-gear";
      dot.setAttribute("data-cl-dot", "");
      dot.hidden = true;
      gear.appendChild(dot);
    }
  }

  // ----- 목록 다이얼로그 -----
  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.className = "mir-cl-dialog";
    dialog.id = "changelogDialog";
    dialog.setAttribute("aria-labelledby", "changelogTitle");
    dialog.innerHTML = `
      <div class="mir-cl-head">
        <div>
          <h2 id="changelogTitle">업데이트 소식</h2>
          <p>새로 들어온 기능과 고친 점을 최신순으로 모았습니다.</p>
        </div>
        <button type="button" class="mir-cl-close" data-cl-close aria-label="닫기" title="닫기">✕</button>
      </div>
      <ol class="mir-cl-list" id="changelogList"></ol>`;
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog || e.target.closest("[data-cl-close]")) dialog.close();
    });
    document.body.appendChild(dialog);
    return dialog;
  }

  function renderList(unreadIds) {
    const c = core();
    const list = dialog && dialog.querySelector("#changelogList");
    if (!list || !c) return;
    if (!entries || !entries.length) {
      list.innerHTML = `<li class="mir-cl-empty">아직 소식이 없습니다.</li>`;
      return;
    }
    const mk = currentMarket();
    list.innerHTML = entries.map((e) => {
      const isNew = unreadIds.has(e.id);
      const other = e.market !== "all" && e.market !== mk;
      return `<li class="mir-cl-item${isNew ? " is-new" : ""}">
        <div class="mir-cl-meta">
          <time datetime="${esc(e.date)}">${esc(c.fmtDate(e.date))}</time>
          <span class="mir-cl-tag mir-cl-tag-${esc(e.market)}">${esc(c.marketLabel(e.market))}</span>
          ${isNew ? '<span class="mir-cl-new">새 소식</span>' : ""}
        </div>
        <h3 class="mir-cl-title">${esc(e.title)}</h3>
        ${e.desc ? `<p class="mir-cl-desc">${esc(e.desc)}</p>` : ""}
        ${e.link ? `<a class="mir-cl-open" href="${esc(e.link)}" data-cl-open="${esc(e.id)}">열기${other ? ` <small>(${esc(c.marketLabel(e.market))} 모드로)</small>` : ""}</a>` : ""}
      </li>`;
    }).join("");
  }

  function open() {
    return load().then(() => {
      const c = core();
      if (!c) return;
      if (typeof window.cmdkClose === "function") { try { window.cmdkClose(); } catch (_) { /* ignore */ } }
      const unreadIds = new Set(unread().map((e) => e.id));
      ensureDialog();
      renderList(unreadIds);
      if (!dialog.open) {
        try { dialog.showModal(); } catch (_) { dialog.setAttribute("open", ""); }
      }
      dialog.querySelector(".mir-cl-list").scrollTop = 0;
      const marker = c.seenMarker(entries);
      if (marker) writeJSON(KEY_SEEN, marker);
      updateBadges();
    });
  }

  // ----- 화면별 '새 기능' 카드 -----
  function isShown(el) {
    if (!el || !el.isConnected) return false;
    if (typeof el.checkVisibility === "function") {
      if (!el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true, visibilityProperty: true })) return false;
    } else {
      if (!el.getClientRects().length) return false;
      if (getComputedStyle(el).visibility === "hidden") return false;
    }
    if (el.closest("[inert]")) return false;
    return true;
  }

  // 종목 상세 탭(.sd-view)은 보이는 카드가 하나도 없으면(데이터 없음 안내만) 카드를 띄우지 않는다.
  function hasOwnContent(el) {
    if (!el.classList.contains("sd-view")) return true;
    return [...el.children].some((c) => !c.classList.contains("mir-cl-card") && !c.hidden && c.innerHTML.trim() !== "");
  }

  function cardHtml(entry) {
    const c = core();
    const desc = String(entry.desc || "");
    // 카드에는 첫 문장만(목록에 전문).
    const m = desc.match(/^(.+?[.!?](?=\s|$))/);
    const line = m ? m[1] : desc;
    return `${SVG_SPARK}
      <div class="mir-cl-card-body">
        <p class="mir-cl-card-head"><span class="mir-cl-label">새 기능</span><strong>${esc(entry.title)}</strong>${entry.market !== "all" ? `<span class="mir-cl-tag mir-cl-tag-${esc(entry.market)}">${esc(c.marketLabel(entry.market))}</span>` : ""}</p>
        <p class="mir-cl-card-desc">${esc(line)}</p>
        <div class="mir-cl-card-actions">
          ${entry.link || (entry.focus && entry.focus.length) ? `<a class="mir-cl-try" href="${esc(entry.link || "#")}" data-cl-try>해보기</a>` : ""}
          <button type="button" class="mir-cl-all" data-cl-all>업데이트 소식 전체</button>
        </div>
      </div>
      <button type="button" class="mir-cl-x" data-cl-x aria-label="이 안내 닫기" title="닫기">✕</button>`;
  }

  function dismiss(id) {
    const c = core();
    const list = readJSON(KEY_DISMISSED, []);
    const next = c ? c.pruneDismissed([...(Array.isArray(list) ? list : []), id], entries || []) : [id];
    writeJSON(KEY_DISMISSED, next);
    document.querySelectorAll(".mir-cl-card").forEach((n) => {
      if (n.dataset.clId !== id) return;
      if (n.parentElement && n.parentElement.id) suppressed.add(n.parentElement.id);
      n.remove();
    });
  }

  function noteImpression(id) {
    if (shownThisLoad.has(id)) return;
    shownThisLoad.add(id);
    const c = core();
    const map = c ? c.pruneImpressions(readJSON(KEY_IMPR, {}), entries || []) : {};
    map[id] = (map[id] || 0) + 1;
    writeJSON(KEY_IMPR, map);
  }

  function focusTarget(entry) {
    const ids = Array.isArray(entry.focus) ? entry.focus : [];
    for (const id of ids) {
      const el = id.startsWith(".")
        ? [...document.querySelectorAll(id)].find((n) => !n.hidden && (isShown(n) || n.tagName === "DETAILS")) || null
        : document.getElementById(id);
      if (!el || el.hidden) continue;
      if (isShown(el)) return el;
      // 목차형 화면(toc-layout.js)의 닫힌 <details> 는 펼치면 그 항목이 선택된다 — 부모가 보이면 후보.
      if (el.tagName === "DETAILS" && el.parentElement && isShown(el.parentElement)) return el;
    }
    return null;
  }

  function onCardClick(event) {
    const card = event.target.closest(".mir-cl-card");
    if (!card) return;
    const id = card.dataset.clId;
    const entry = (entries || []).find((e) => e.id === id);
    if (event.target.closest("[data-cl-x]")) { dismiss(id); return; }
    if (event.target.closest("[data-cl-all]")) { open(); return; }
    if (event.target.closest("[data-cl-try]") && entry) {
      // 같은 화면에 그 기능이 이미 보이면 거기로 내리고, 아니면 링크(딥링크)로 간다.
      const el = focusTarget(entry);
      dismiss(id);
      if (el) {
        event.preventDefault();
        if (el.tagName === "DETAILS") el.open = true;
        // 펼침·목차 전환이 레이아웃에 반영된 뒤에 내린다.
        setTimeout(() => {
          el.scrollIntoView({ block: "start", behavior: "smooth" });
          el.classList.add("mir-cl-flash");
          setTimeout(() => el.classList.remove("mir-cl-flash"), 1600);
        }, 60);
      }
      // 링크가 있으면 기본 동작(이동)에 맡긴다.
    }
  }

  function placeCard(target, entry) {
    const el = document.getElementById(target);
    if (!el) return;
    let card = el.querySelector(`:scope > .mir-cl-card`);
    if (card && card.dataset.clId === entry.id) return;
    if (card) card.remove();
    card = document.createElement("aside");
    card.className = "mir-cl-card";
    card.dataset.clId = entry.id;
    card.setAttribute("role", "note");
    card.setAttribute("aria-label", `새 기능 안내: ${entry.title}`);
    card.innerHTML = cardHtml(entry);
    el.insertBefore(card, el.firstChild);
    noteImpression(entry.id);
    // 렌더러가 화면을 통째로 다시 그려(innerHTML) 카드가 사라지면 다음 점검에서 다시 붙인다.
    if (!observed.has(el) && typeof MutationObserver === "function") {
      observed.add(el);
      new MutationObserver(() => {
        if (!el.querySelector(":scope > .mir-cl-card")) scheduleCheck();
      }).observe(el, { childList: true });
    }
  }

  function check() {
    const c = core();
    if (!c || !entries || !entries.length) return;
    const mk = currentMarket();
    const today = todayKst();
    const dismissed = readJSON(KEY_DISMISSED, []);
    const impressions = readJSON(KEY_IMPR, {});
    const visible = aiModeActive() ? [] : c.allTargets(entries).filter((t) => {
      const el = document.getElementById(t);
      return !suppressed.has(t) && el && isShown(el) && hasOwnContent(el);
    });
    const picks = c.pickInlineCards(entries, {
      visibleTargets: visible, market: mk, dismissed, impressions, showing: [...shownThisLoad],
      today, maxAgeDays: CARD_MAX_AGE_DAYS, maxImpressions: CARD_MAX_IMPRESSIONS,
    });
    const keep = new Set(picks.map((p) => `${p.target}|${p.entry.id}`));
    // 시장이 바뀌었거나 더 이상 해당 없는 카드는 걷는다(보이지 않는 화면의 카드는 그대로 둔다).
    document.querySelectorAll(".mir-cl-card").forEach((n) => {
      const host = n.parentElement;
      if (!host || !host.id) { n.remove(); return; }
      const entry = (entries || []).find((e) => e.id === n.dataset.clId);
      if (!entry || !c.matchesMarket(entry, mk) || (Array.isArray(dismissed) && dismissed.includes(entry.id))) { n.remove(); return; }
      if (visible.includes(host.id) && !keep.has(`${host.id}|${entry.id}`)) n.remove();
    });
    picks.forEach((p) => placeCard(p.target, p.entry));
  }

  function scheduleCheck() {
    checkTimers.forEach((t) => clearTimeout(t));
    // 탭 전환·렌더가 끝난 뒤를 두 번 본다(늦게 그려지는 화면 대비).
    checkTimers = [setTimeout(check, 150), setTimeout(check, 900)];
  }

  function bindTriggers() {
    document.addEventListener("click", (e) => {
      if (e.target.closest && e.target.closest(".mir-cl-card")) { onCardClick(e); return; }
      if (e.target.closest && e.target.closest('[data-open="changelog"]')) { open(); return; }
      scheduleCheck();
    }, true);
    window.addEventListener("popstate", scheduleCheck);
    window.addEventListener("resize", scheduleCheck, { passive: true });
    try {
      // AI 모드 진입/이탈(body class) 과 시장 전환(html data-market).
      new MutationObserver(scheduleCheck).observe(document.body, { attributes: true, attributeFilter: ["class"] });
      new MutationObserver(() => { updateBadges(); scheduleCheck(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-market"] });
    } catch (_) { /* ignore */ }
  }

  function init() {
    ensureHeaderEntry();
    bindTriggers();
    // 첫 화면 렌더·딥링크 스크롤을 방해하지 않게 조금 뒤에 받는다.
    setTimeout(() => {
      load().then(() => {
        ensureHeaderEntry();
        updateBadges();
        check();
        // 데이터가 늦게 도착해 화면(종목 상세 탭 등)이 나중에 채워지는 경우를 위해 가볍게 다시 본다.
        // 요소 수십 개의 가시성만 보는 일이라 비용이 거의 없고, 탭이 백그라운드면 건너뛴다.
        setInterval(() => { if (!document.hidden) check(); }, 2500);
      });
    }, 600);
  }

  window.MirChangelog = {
    open,
    refresh: scheduleCheck,
    unreadCount: () => unread().length,
    _check: check,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
