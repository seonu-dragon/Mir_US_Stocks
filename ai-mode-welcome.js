/**
 * AI Mode — welcome screen, input handling, cosmos morph trigger
 */
(function () {
  "use strict";

  let isAiChatMode = false;
  let isStockView = false;
  // AI 모드 안에서 사용자가 테마를 직접 바꿨는지(data-theme 변이) 추적 — 나갈 때
  // 진입 전 테마로 되돌릴지, 지금 고른 테마를 유지할지 결정한다.
  let aiThemeTouched = false;
  let aiThemeObserver = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function setAiChromeHidden(hidden) {
    const tab = byId("tab-ai-chat");
    ["aiChatLog", "aiChatWelcome", "aiChatSidebar"].forEach((id) => {
      const el = byId(id);
      if (!el) return;
      el.hidden = hidden;
      el.style.display = hidden ? "none" : "";
    });
    const header = tab?.querySelector(".ai-chat-header");
    if (header) {
      header.hidden = hidden;
      header.style.display = hidden ? "none" : "";
    }
  }

  function enterAiWelcomeView() {
    document.body.classList.add("ai-welcome-view");
    const container = byId("tab-ai-chat")?.querySelector(".ai-chat-container");
    container?.classList.add("is-welcome-view");
    setAiChromeHidden(true);
    const auto = byId("aiAutoComplete");
    if (auto) auto.hidden = true;
  }

  function exitAiWelcomeView() {
    document.body.classList.remove("ai-welcome-view", "ai-stock-analysis-view");
    const container = byId("tab-ai-chat")?.querySelector(".ai-chat-container");
    container?.classList.remove("is-welcome-view");
    setAiChromeHidden(false);
    isStockView = false;
  }

  // app.js 의 해석기를 쓴다. 그쪽은 단어 경계로 티커를 찾고 실제 스냅샷 유니버스로
  // 검증하며(stockByTicker), 한글 별칭과 회사명까지 훑는다. 아래 fallback 은 app.js 가
  // 아직 안 붙었을 때만 쓰이며, 문자열 전체가 티커일 때만 맞는다는 한계가 있다 —
  // 그래서 "NVDA 분석해줘" 같은 입력은 반드시 위쪽 경로로 가야 한다.
  function resolveTickerFromQuery(query) {
    const shared = window.MirAiChat?.resolveTicker;
    if (shared) {
      try {
        return shared(query) || null;
      } catch (_) {
        /* app.js 데이터가 아직 준비 안 된 경우 아래로 폴백 */
      }
    }

    const text = String(query || "").trim().toLowerCase();
    if (!text) return null;

    const upper = text.toUpperCase();
    if (/^[A-Z0-9._-]{1,12}$/.test(upper)) return upper;

    const aliases = window.TICKER_ALIASES_KO || {};
    const hits = [];
    for (const [ticker, names] of Object.entries(aliases)) {
      for (const alias of names) {
        const a = String(alias).toLowerCase();
        if (a.length < 2) continue;
        if (text.includes(a)) hits.push({ ticker, len: a.length });
      }
    }
    if (hits.length) {
      hits.sort((a, b) => b.len - a.len);
      return hits[0].ticker;
    }
    return null;
  }

  function parseChartSeries(raw) {
    return (raw || []).map((row) => ({
      o: Number(row[0]),
      h: Number(row[1]),
      l: Number(row[2]),
      c: Number(row[3]),
      v: Number(row[4]) || 0,
      d: row[5] || "",
    })).filter((b) => Number.isFinite(b.c));
  }

  function detailPathsForTicker(ticker) {
    const key = String(ticker || "").toUpperCase();
    const isKrCode = /^\d{6}$/.test(key);
    const paths = [];
    if (isKrCode) {
      paths.push(`data/korea/details/${encodeURIComponent(key)}.json`);
    } else {
      paths.push(`data/details/${encodeURIComponent(key)}.json`);
      paths.push(`data/korea/details/${encodeURIComponent(key)}.json`);
    }
    const active = window.MirMarket?.detailPath?.(key);
    if (active && !paths.includes(active)) paths.unshift(active);
    return [...new Set(paths)];
  }

  async function fetchDetailFromPath(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) return { detail: null, status: res.status };
    const detail = await res.json();
    return { detail, status: res.status };
  }

  function liveProxySymbol(ticker) {
    const key = String(ticker || "").toUpperCase();
    const isKr = window.MirMarket?.getMode?.() === "kr";
    if (isKr && /^\d{6}$/.test(key)) {
      return window.MirMarket?.getConfig?.()?.yahooTicker?.({ ticker: key }, "kospi") || `${key}.KS`;
    }
    return key.replace(/\./g, "-");
  }

  async function fetchLiveDetailFromProxy(ticker) {
    if (window.MirLiveDetail?.fetch) {
      return window.MirLiveDetail.fetch(ticker);
    }
    const proxy = window.MIR_LIVE_PROXY || window.MirLiveDetail?.proxyUrl || null;
    if (!proxy) return null;
    const endpoint = `${String(proxy).replace(/\/$/, "")}/?ticker=${encodeURIComponent(liveProxySymbol(ticker))}`;
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      if (!res.ok) return null;
      const payload = await res.json();
      if (!Array.isArray(payload.chart) || !payload.chart.length) return null;
      return {
        ticker: String(ticker || "").toUpperCase(),
        name: payload.name || payload.company || ticker,
        company: payload.name || payload.company || ticker,
        chartSeries: payload.chart,
        historySource: "yahoo",
        __liveGenerated: true,
      };
    } catch {
      return null;
    }
  }

  async function loadTickerDetail(ticker) {
    const paths = detailPathsForTicker(ticker);
    let lastStatus = 0;
    let sawDetail = false;

    for (const path of paths) {
      try {
        const { detail, status } = await fetchDetailFromPath(path);
        lastStatus = status || lastStatus;
        if (!detail) continue;
        sawDetail = true;
        if (Array.isArray(detail.chartSeries) && detail.chartSeries.length) {
          return detail;
        }
      } catch (err) {
        if (String(err).includes("Failed to fetch") || err?.name === "TypeError") {
          return { __fetchError: "network" };
        }
      }
    }

    const live = await fetchLiveDetailFromProxy(ticker);
    if (live) return live;

    if (sawDetail) return { __emptyChart: true };
    if (lastStatus === 404) return { __notFound: true, paths };
    return { __fetchError: lastStatus ? `http-${lastStatus}` : "unknown" };
  }

  function isMobileViewport() {
    return window.matchMedia("(max-width: 768px)").matches;
  }

  let mobileViewportBound = false;

  function updateMobileVisualViewport() {
    if (!isAiChatMode || !isMobileViewport()) return;

    const vv = window.visualViewport;
    if (!vv) return;

    const keyboardGap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    const keyboardOpen = keyboardGap > 72;

    document.body.classList.toggle("ai-keyboard-open", keyboardOpen);

    if (keyboardOpen) {
      document.documentElement.style.setProperty("--ai-vv-height", `${Math.round(vv.height)}px`);
      document.documentElement.style.setProperty("--ai-vv-top", `${Math.round(vv.offsetTop)}px`);

      const wrapper = byId("aiChatInput")?.closest(".ai-chat-input-wrapper");
      const dockH = wrapper ? Math.ceil(wrapper.getBoundingClientRect().height) + 6 : 58;
      document.documentElement.style.setProperty("--ai-dock-offset", `${dockH}px`);
    } else {
      document.documentElement.style.removeProperty("--ai-vv-height");
      document.documentElement.style.removeProperty("--ai-vv-top");
      document.documentElement.style.removeProperty("--ai-dock-offset");
    }

    window.MirCosmos?.relayout?.();
  }

  function clearMobileVisualViewport() {
    document.documentElement.style.removeProperty("--ai-vv-height");
    document.documentElement.style.removeProperty("--ai-vv-top");
    document.documentElement.style.removeProperty("--ai-dock-offset");
    document.body.classList.remove("ai-keyboard-open", "ai-input-focused");
    window.MirCosmos?.relayout?.();
  }

  function bindMobileVisualViewport() {
    if (mobileViewportBound || !window.visualViewport) return;
    mobileViewportBound = true;
    const vv = window.visualViewport;
    vv.addEventListener("resize", updateMobileVisualViewport);
    vv.addEventListener("scroll", updateMobileVisualViewport);
  }

  function syncMobileChatUi() {
    const input = byId("aiChatInput");
    if (!input) return;
    input.placeholder = isMobileViewport()
      ? "종목 분석·질문 입력..."
      : "종목 분석 또는 투자 질문을 입력하세요...";
  }

  function setInputHint(msg, isError) {
    let hint = byId("aiInputHint");
    if (!hint) {
      hint = document.createElement("p");
      hint.id = "aiInputHint";
      hint.className = "ai-input-hint";
      byId("aiChatInput")?.closest(".ai-chat-input-wrapper")?.appendChild(hint);
    }
    hint.textContent = msg || "";
    hint.classList.toggle("is-error", !!isError);
  }

  // 종목이 아닌 질문("반도체 섹터 흐름 어때?")을 app.js 의 채팅으로 넘긴다. 웰컴 화면이
  // 감춰둔 채팅 로그·사이드바를 먼저 되살린 뒤 넘겨야 답변이 보인다.
  async function routeToChat(query) {
    const send = window.MirAiChat?.send;
    if (!send) {
      setInputHint("채팅을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.", true);
      return;
    }
    setInputHint("", false);
    exitAiWelcomeView();
    const input = byId("aiChatInput");
    if (input) input.value = "";
    await send(query);
  }

  async function handleStockQuery(query) {
    // 종목이면 3D 모핑 + 대시보드, 아니면 채팅. 예전엔 여기서 실패 힌트만 띄우는 바람에
    // 추천 칩 4개가 전부(섹터·관심종목 질문은 물론 "NVDA 분석해줘"까지) 막혀 있었다.
    const ticker = resolveTickerFromQuery(query);
    if (!ticker) {
      await routeToChat(query);
      return;
    }

    document.body.classList.remove("ai-conversation-view"); // 대화 뷰 → 차트 모핑 전환
    setInputHint("차트 데이터를 불러오는 중…", false);

    const detail = await loadTickerDetail(ticker);
    if (detail?.__fetchError === "network") {
      setInputHint(
        "차트 파일을 불러오지 못했습니다. 로컬 서버로 열어 주세요. (scripts/serve.ps1 → http://localhost:8080)",
        true,
      );
      return;
    }
    if (detail?.__notFound) {
      const inKr = window.MirMarket?.getMode?.() === "kr";
      setInputHint(
        inKr && !/^\d{6}$/.test(ticker)
          ? `${stockLabel(ticker)}는 미국 종목입니다. 상단에서 미국 주식 모드로 전환한 뒤 다시 시도해 보세요.`
          : `${stockLabel(ticker)} 차트를 불러오지 못했습니다. 네트워크·프록시 설정을 확인해 주세요.`,
        true,
      );
      return;
    }
    if (detail?.__emptyChart) {
      setInputHint(`${stockLabel(ticker)} 파일은 있지만 chartSeries 데이터가 비어 있습니다.`, true);
      return;
    }

    const bars = parseChartSeries(detail?.chartSeries);
    if (!bars.length) {
      setInputHint(`${stockLabel(ticker)} 차트 데이터가 없습니다.`, true);
      return;
    }

    // 지지/저항·추세선·차트 패턴 오버레이 계산(분석 엔진 재사용) → 차트에 자동 표시
    let overlays = null;
    try { overlays = (typeof window.MirChartOverlays === "function") ? window.MirChartOverlays(bars, ticker) : null; } catch (_) {}

    const ok = window.MirCosmos?.morphToChart?.({
      ticker,
      name: detail?.name || detail?.company || ticker,
      bars,
      range: "6M",
      overlays,
      onComplete() {
        isStockView = true;
        document.body.classList.remove("ai-welcome-view");
        const container = byId("tab-ai-chat")?.querySelector(".ai-chat-container");
        container?.classList.remove("is-welcome-view");
        document.body.classList.add("ai-stock-analysis-view");
        const liveTag = detail?.__liveGenerated ? " · 실시간" : "";
        const staleTag = window.MirDataStatus?.showBanner ? " · 캐시 데이터" : "";
        setInputHint(`${stockLabel(ticker)} · 6개월 차트${liveTag}${staleTag}`, false);
        // 배경 차트 위로 JARVIS 대시보드(종목 카드·투자의견·기관·뉴스) 페이드인
        try { window.MirDash?.render?.(ticker); } catch (_) {}
      },
    });

    if (!ok) {
      setInputHint("차트 변환에 실패했습니다.", true);
    }
  }

  // 단일 진입점 — 폼 제출/Enter, 자동완성 선택, 음성 인식, Ctrl+K, 유사종목 클릭이 전부
  // 여기로 온다. 차트 모드에서 새 질문이 오면 먼저 풍경(웰컴)으로 되돌린 뒤 처리한다.
  async function submitQuery(rawQuery) {
    const query = String(rawQuery || "").trim();
    if (!query) return;
    if (isStockView && window.MirCosmos?.getMode?.() === "chart") {
      window.MirCosmos.resetToLandscape?.();
      window.MirDash?.hide?.();
      document.body.classList.remove("ai-stock-analysis-view");
      document.body.classList.add("ai-welcome-view");
      const container = byId("tab-ai-chat")?.querySelector(".ai-chat-container");
      container?.classList.add("is-welcome-view");
      isStockView = false;
    }
    await handleStockQuery(query);
  }

  function watchThemeWhileActive() {
    aiThemeTouched = false;
    if (aiThemeObserver || typeof MutationObserver !== "function") return;
    aiThemeObserver = new MutationObserver(() => { aiThemeTouched = true; });
    aiThemeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }

  function unwatchTheme() {
    if (aiThemeObserver) aiThemeObserver.disconnect();
    aiThemeObserver = null;
  }

  function toggleAiChatMode(active) {
    isAiChatMode = active;
    const toggleBtn = byId("aiModeToggle");
    const tabChat = byId("tab-ai-chat");

    if (active) {
      document.body.classList.remove("ai-conversation-view"); // 이전 세션 잔여 뷰 제거
      document.documentElement.dataset.aiMode = "1";
      if (!document.documentElement.dataset.aiPrevTheme) {
        document.documentElement.dataset.aiPrevTheme =
          document.documentElement.getAttribute("data-theme") || "dark";
      }
      document.documentElement.setAttribute("data-theme", "dark");
      // observe() 는 위 setAttribute 이후에 시작하므로 우리가 건 다크는 변이로 잡히지 않는다.
      watchThemeWhileActive();
      document.body.classList.add("ai-mode-active", "ai-mode-entering");
      setTimeout(() => document.body.classList.remove("ai-mode-entering"), 600);
      toggleBtn?.classList.add("active");
      if (tabChat) tabChat.hidden = false;
      enterAiWelcomeView();
      syncMobileChatUi();
      if (isMobileViewport()) {
        bindMobileVisualViewport();
        updateMobileVisualViewport();
      }
      requestAnimationFrame(() => {
        window.MirCosmos?.start?.();
        requestAnimationFrame(() => {
          window.dispatchEvent(new Event("resize"));
          updateMobileVisualViewport();
          if (!isMobileViewport()) byId("aiChatInput")?.focus();
        });
      });
      return;
    }

    clearMobileVisualViewport();
    delete document.documentElement.dataset.aiMode;
    unwatchTheme();
    const prevTheme = document.documentElement.dataset.aiPrevTheme;
    // AI 모드 안에서 테마를 직접 바꿨다면 그 선택을 존중한다(진입 전 테마로 되돌리지 않음).
    if (prevTheme && !aiThemeTouched) {
      document.documentElement.setAttribute("data-theme", prevTheme);
    }
    delete document.documentElement.dataset.aiPrevTheme;
    aiThemeTouched = false;
    document.body.classList.remove("ai-mode-active", "ai-mode-entering", "ai-stock-analysis-view", "ai-conversation-view");
    window.MirDash?.hide?.();
    exitAiWelcomeView();
    window.MirCosmos?.stop?.();
    toggleBtn?.classList.remove("active");
    if (tabChat) tabChat.hidden = true;
    setInputHint("", false);
  }

  function setupAiModeEvents() {
    byId("aiModeToggle")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      toggleAiChatMode(!isAiChatMode);
    }, true);

    byId("exitAiModeBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      toggleAiChatMode(false);
    }, true);

    window.addEventListener("resize", () => {
      if (!isAiChatMode) return;
      syncMobileChatUi();
      updateMobileVisualViewport();
    });

    const chatInput = byId("aiChatInput");
    chatInput?.addEventListener("focus", () => {
      if (!isMobileViewport()) return;
      document.body.classList.add("ai-input-focused");
      window.scrollTo(0, 0);
      bindMobileVisualViewport();
      window.MirCosmos?.relayout?.();
      requestAnimationFrame(updateMobileVisualViewport);
      window.setTimeout(updateMobileVisualViewport, 90);
      window.setTimeout(updateMobileVisualViewport, 320);
      window.setTimeout(updateMobileVisualViewport, 520);
    });
    chatInput?.addEventListener("blur", () => {
      if (!isMobileViewport()) return;
      window.setTimeout(() => {
        if (document.activeElement === chatInput) return;
        document.body.classList.remove("ai-input-focused", "ai-keyboard-open");
        window.MirCosmos?.relayout?.();
        updateMobileVisualViewport();
      }, 120);
    });

    document.addEventListener("keydown", (e) => {
      if (!isAiChatMode || e.key !== "Escape") return;
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;
      toggleAiChatMode(false);
    });

    byId("aiChatForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      window.MirAiChat?.autocomplete?.hide?.();
      await submitQuery(byId("aiChatInput")?.value);
    }, true);

    const bindSuggestQuery = (el) => {
      el.addEventListener("click", async (e) => {
        const query = el.dataset.query || el.textContent || "";
        if (!query.trim()) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const input = byId("aiChatInput");
        if (input) input.value = query;
        await submitQuery(query);
      }, true);
    };

    document.querySelectorAll(".ai-chat-suggest-card").forEach(bindSuggestQuery);

    // Enter: 자동완성에 하이라이트된 항목이 있으면 그 종목을(입력창 원문이 아니라), 없으면
    // 입력창 내용을 보낸다. ai-mode.js 의 자동완성은 ↑↓/Esc 만 다루고 Enter 는 여기 하나다.
    byId("aiChatInput")?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const ac = window.MirAiChat?.autocomplete;
      const highlighted = ac?.highlightedTicker?.();
      let query = e.target.value?.trim();
      if (highlighted) {
        query = `${highlighted} 분석해줘`;
        e.target.value = query;
      }
      ac?.hide?.();
      if (!query) return;
      submitQuery(query);
    }, true);

    byId("aiChatInput")?.addEventListener("input", () => {
      if (byId("aiInputHint")?.classList.contains("is-error")) setInputHint("", false);
    });
  }

  setupAiModeEvents();

  window.MirAI = {
    toggle: toggleAiChatMode,
    exit: () => toggleAiChatMode(false),
    isActive: () => isAiChatMode,
    queryStock: submitQuery,
  };
})();