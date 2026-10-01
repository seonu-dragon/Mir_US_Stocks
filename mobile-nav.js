// 폰(640px 이하) 전용 내비게이션 — 하단 탭 바 · 종목 미니 바 · 접는 종목 검색(2026-10-01).
//
// 1) 하단 탭 바: 오늘·시장·종목·내 투자·검색. 앞의 넷은 상단 #mainTabs 의 같은 버튼을 눌러 준다
//    (activateTab·URL 기록·탭 순서 저장 등 기존 경로를 그대로 탄다). '검색'은 헤더 검색 버튼(⌘K 팔레트)을
//    누른다. 바가 붙으면 html.mnav-on 이 켜지고, styles.css 가 폰에서 상단 탭 줄을 숨긴다 — JS 가 실패하면
//    클래스가 없으니 상단 탭이 그대로 남는다.
// 2) 종목 미니 바: 종목 › 분석에서 왼쪽 요약(이름·가격)이 화면 위로 지나가면 맨 위에 로고·이름·가격·등락·
//    관심(☆) 한 줄을 고정한다. 내용은 #searchFacts 의 렌더 결과를 그대로 복제한다(등락 색 클래스 포함 —
//    국내 빨강/파랑, 미국 초록/빨강은 시장 토큰이 정한다). 관심 토글은 watchlist.js 의 toggleWatchlist.
//    본문 6탭(.sd-tabs)은 stock-view.js 의 --sd-sticky-top 에 이 바 높이를 더해 바로 아래에 붙는다.
// 3) 종목 검색 줄: 종목이 열려 있으면 입력칸 줄을 접고 서브탭 줄 오른쪽 돋보기 버튼으로 편다.
// 데스크톱 폭에서는 아무것도 보이지 않는다(모두 CSS 의 640px 미디어 쿼리 안).
(function () {
  const PHONE_MQ = "(max-width: 640px)";
  const MINI_H = 54; // styles.css .mnav-mini 높이(안전 영역 제외)와 같아야 한다
  const mq = typeof window.matchMedia === "function" ? window.matchMedia(PHONE_MQ) : null;
  const isPhone = () => !!(mq && mq.matches);
  const $ = (id) => document.getElementById(id);
  const aiActive = () => document.body.classList.contains("ai-mode-active");

  const ICONS = {
    today: '<path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z"/>',
    market: '<rect x="4" y="4" width="7" height="9" rx="1"/><rect x="13" y="4" width="7" height="5" rx="1"/><rect x="13" y="11" width="7" height="9" rx="1"/><rect x="4" y="15" width="7" height="5" rx="1"/>',
    search: '<path d="M4 19h16"/><path d="M5 15.5 9.5 11l3 3L19 7.5"/><path d="M15 7.5h4v4"/>',
    bulk: '<path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5H12z"/><path d="M14.5 3.8V9.5h5.7a8.5 8.5 0 0 0-5.7-5.7z"/>',
    find: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  };
  const ITEMS = [
    { key: "today", label: "오늘" },
    { key: "market", label: "시장" },
    { key: "search", label: "종목" },
    { key: "bulk", label: "내 투자" },
    { key: "find", label: "검색" },
  ];
  const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[k]}</svg>`;

  // ── 1) 하단 탭 바 ────────────────────────────────────────────────────────────
  function buildBar() {
    if ($("mnavBar")) return $("mnavBar");
    const nav = document.createElement("nav");
    nav.className = "mnav-bar";
    nav.id = "mnavBar";
    nav.setAttribute("aria-label", "주요 화면");
    nav.innerHTML = ITEMS.map((it) => `<button type="button" class="mnav-item" data-mnav="${it.key}"${it.key === "find" ? ' aria-haspopup="dialog"' : ""}>${svg(it.key)}<span>${it.label}</span></button>`).join("");
    nav.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-mnav]");
      if (!btn) return;
      const key = btn.dataset.mnav;
      if (key === "find") {
        const hs = $("headerSearchBtn");
        if (hs) hs.click();
        return;
      }
      const tab = document.querySelector(`#mainTabs .tab[data-tab="${key}"]`);
      if (!tab) return;
      const same = document.documentElement.dataset.mainTab === key;
      tab.click();
      // 앱 하단 탭 관례: 다른 탭이면 그 탭 맨 위에서, 같은 탭을 다시 누르면 맨 위로.
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: same ? "smooth" : "auto" }));
    });
    document.body.appendChild(nav);
    document.documentElement.classList.add("mnav-on");
    return nav;
  }

  function syncBarActive() {
    const bar = $("mnavBar");
    if (!bar) return;
    const cur = document.documentElement.dataset.mainTab || "today";
    bar.querySelectorAll("[data-mnav]").forEach((b) => {
      const on = b.dataset.mnav === cur;
      b.classList.toggle("is-active", on);
      if (b.dataset.mnav === "find") return;
      if (on) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
  }

  // 입력칸에 포커스가 있으면(가상 키보드) 하단 바를 내린다 — 키보드 위로 떠올라 입력칸을 가렸다.
  function bindTyping() {
    const typing = (el) => el && el.matches && el.matches("input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]), textarea, select, [contenteditable=true]");
    document.addEventListener("focusin", (e) => { if (typing(e.target)) document.documentElement.classList.add("mnav-typing"); });
    document.addEventListener("focusout", () => {
      setTimeout(() => { if (!typing(document.activeElement)) document.documentElement.classList.remove("mnav-typing"); }, 50);
    });
  }

  // ── 2) 종목 미니 바 ──────────────────────────────────────────────────────────
  let mini = null;
  function buildMini() {
    if (mini) return mini;
    mini = document.createElement("div");
    mini.className = "mnav-mini";
    mini.id = "mnavMini";
    mini.hidden = true;
    mini.innerHTML = `<button type="button" class="mnav-mini-main" aria-label="종목 요약으로 올라가기">
        <span class="mnav-mini-logo"></span>
        <span class="mnav-mini-text"><strong class="mnav-mini-name"></strong><span class="mnav-mini-quote"><b class="mnav-mini-price"></b><span class="mnav-mini-chg"></span></span></span>
      </button>
      <button type="button" class="mnav-mini-star" aria-pressed="false" title="관심종목">☆</button>`;
    mini.querySelector(".mnav-mini-main").addEventListener("click", () => {
      const facts = $("searchFacts");
      if (!facts) return;
      window.scrollTo({ top: Math.max(0, facts.getBoundingClientRect().top + window.pageYOffset - 8), behavior: "smooth" });
    });
    mini.querySelector(".mnav-mini-star").addEventListener("click", () => {
      const t = mini.dataset.ticker;
      if (t && typeof toggleWatchlist === "function") toggleWatchlist(t);
      fillMini();
    });
    document.body.appendChild(mini);
    return mini;
  }

  function fillMini() {
    if (!mini) return;
    const facts = $("searchFacts");
    const nameEl = facts && facts.querySelector(".sd-name");
    if (!nameEl) { mini.dataset.ticker = ""; return; }
    const star = nameEl.querySelector("[data-watch]");
    const ticker = star ? star.dataset.watch : "";
    const logo = nameEl.querySelector(".co-logo");
    const logoHost = mini.querySelector(".mnav-mini-logo");
    logoHost.innerHTML = "";
    if (logo) {
      const c = logo.cloneNode(true);
      c.style.setProperty("--co-logo", "28px");
      c.querySelectorAll("img").forEach((img) => { img.width = 28; img.height = 28; img.loading = "eager"; });
      logoHost.appendChild(c);
    }
    // 이름: 로고·배지·별을 뺀 글자만
    const clone = nameEl.cloneNode(true);
    clone.querySelectorAll(".co-logo, [data-watch], .badge, .synthetic-badge, span[class*='badge']").forEach((n) => n.remove());
    mini.querySelector(".mnav-mini-name").textContent = (clone.textContent || "").replace(/\s+/g, " ").trim();
    const price = facts.querySelector(".sd-price");
    mini.querySelector(".mnav-mini-price").textContent = price ? price.textContent.trim() : "";
    const chg = facts.querySelector(".sd-change > span:not(.sd-asof)");
    const chgHost = mini.querySelector(".mnav-mini-chg");
    chgHost.innerHTML = "";
    if (chg) chgHost.appendChild(chg.cloneNode(true));
    mini.dataset.ticker = ticker;
    const on = !!(star && star.classList.contains("is-on"));
    const sb = mini.querySelector(".mnav-mini-star");
    sb.hidden = !ticker;
    sb.classList.toggle("is-on", on);
    sb.textContent = on ? "★" : "☆";
    sb.setAttribute("aria-pressed", on ? "true" : "false");
    sb.setAttribute("aria-label", on ? "관심종목에서 빼기" : "관심종목에 추가");
  }

  function analysisOpen() {
    const sub = $("sub-analysis");
    return document.documentElement.dataset.mainTab === "search" && !!sub && sub.classList.contains("is-active");
  }

  let miniShown = false;
  function syncMini() {
    if (!mini) return;
    let show = false;
    if (isPhone() && !aiActive() && analysisOpen() && mini.dataset.ticker) {
      const facts = $("searchFacts");
      const anchor = facts && (facts.querySelector(".sd-change") || facts.querySelector(".sd-name"));
      if (anchor && facts.offsetParent !== null) show = anchor.getBoundingClientRect().bottom < 4;
    }
    if (show === miniShown) return;
    miniShown = show;
    mini.hidden = !show;
    document.documentElement.classList.toggle("mnav-mini-on", show);
  }

  let scrollRaf = 0;
  function onScroll() {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => { scrollRaf = 0; syncMini(); });
  }

  // ── 3) 종목 검색 줄 접기 ─────────────────────────────────────────────────────
  function buildSearchToggle() {
    const panel = $("tab-search");
    const subTabs = $("searchSubTabs");
    const sub = $("sub-analysis");
    const toolbar = sub && sub.querySelector(":scope > .toolbar");
    if (!panel || !subTabs || !toolbar || $("mnavSearchToggle")) return;
    toolbar.id = toolbar.id || "stockSearchToolbar";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mnav-search-toggle";
    btn.id = "mnavSearchToggle";
    btn.setAttribute("aria-controls", toolbar.id);
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", "종목 검색 열기");
    btn.innerHTML = svg("find");
    subTabs.insertAdjacentElement("afterend", btn);
    const setOpen = (open, focus) => {
      sub.classList.toggle("mnav-search-open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.setAttribute("aria-label", open ? "종목 검색 닫기" : "종목 검색 열기");
      btn.classList.toggle("is-on", open);
      if (open && focus) {
        const input = $("tickerSearch");
        if (input) { input.focus(); try { input.select(); } catch (e) { /* noop */ } }
      }
    };
    btn.addEventListener("click", () => setOpen(!sub.classList.contains("mnav-search-open"), true));
    // 검색을 실행하면(분석 버튼·Enter) 다시 접는다 — 새 종목의 가격이 첫 화면에 올라오게.
    $("searchButton")?.addEventListener("click", () => setTimeout(() => setOpen(false), 0));
    $("tickerSearch")?.addEventListener("keydown", (e) => { if (e.key === "Enter") setTimeout(() => { setOpen(false); $("tickerSearch")?.blur(); }, 0); });
    $("tickerSearch")?.addEventListener("keydown", (e) => { if (e.key === "Escape") { setOpen(false); btn.focus(); } });
  }

  // 돋보기는 서브탭 줄 오른쪽 끝에 세로 가운데로 — 패널 안쪽 여백이 폭마다 달라 잰다.
  function placeSearchToggle() {
    const panel = $("tab-search");
    const subTabs = $("searchSubTabs");
    if (!panel || !subTabs || !$("mnavSearchToggle") || !isPhone() || subTabs.offsetParent === null) return;
    const top = subTabs.offsetTop + Math.max(0, (subTabs.offsetHeight - 44) / 2);
    const right = parseFloat(getComputedStyle(panel).paddingRight) || 0;
    panel.style.setProperty("--mnav-search-top", `${Math.round(top)}px`);
    panel.style.setProperty("--mnav-search-right", `${Math.max(0, Math.round(right) - 6)}px`);
  }

  // 종목이 없으면(빈 상태) 검색 줄을 접지 않는다 — 접을 이유가 없고, 입력할 곳이 사라진다.
  function syncSearchHasStock() {
    const sub = $("sub-analysis");
    const facts = $("searchFacts");
    if (!sub) return;
    sub.classList.toggle("mnav-has-stock", !!(facts && facts.querySelector(".sd-name")));
  }

  // ── 연결 ────────────────────────────────────────────────────────────────────
  function syncAll() {
    syncBarActive();
    syncSearchHasStock();
    placeSearchToggle();
    fillMini();
    syncMini();
  }

  function setup() {
    buildBar();
    buildMini();
    buildSearchToggle();
    bindTyping();
    syncAll();
    if (typeof MutationObserver === "function") {
      new MutationObserver(() => { syncBarActive(); syncMini(); requestAnimationFrame(placeSearchToggle); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-main-tab"] });
      const facts = $("searchFacts");
      if (facts) new MutationObserver(() => { syncSearchHasStock(); fillMini(); syncMini(); }).observe(facts, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class"] });
      const sub = $("sub-analysis");
      if (sub) new MutationObserver(() => { syncMini(); placeSearchToggle(); }).observe(sub, { attributes: true, attributeFilter: ["class"] });
      new MutationObserver(syncMini).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", () => { onScroll(); placeSearchToggle(); });
    if (mq && mq.addEventListener) mq.addEventListener("change", () => { syncMini(); if (typeof sdSyncStickyTop === "function") sdSyncStickyTop(); });
    if (typeof sdSyncStickyTop === "function") sdSyncStickyTop();
  }

  // stock-view.js 가 본문 탭 sticky 기준을 잴 때 더하는 높이(폰 + 바 사용 중일 때만).
  // 노치 기기의 위쪽 안전 영역(env)은 JS 로 바로 못 읽어 숨은 측정용 요소로 잰다.
  let safeProbe = null;
  function safeTop() {
    if (!safeProbe) {
      safeProbe = document.createElement("div");
      safeProbe.setAttribute("aria-hidden", "true");
      safeProbe.style.cssText = "position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none";
      document.body.appendChild(safeProbe);
    }
    return safeProbe.offsetHeight || 0;
  }
  window.mirMobileNavTopOffset = function () {
    if (!isPhone() || aiActive() || !document.documentElement.classList.contains("mnav-on")) return 0;
    return MINI_H + safeTop();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup);
  else setup();
})();
