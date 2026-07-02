/**
 * AI Mode — welcome screen, input handling, cosmos morph trigger
 */
(function () {
  "use strict";

  let isAiChatMode = false;
  let isStockView = false;
  const AI_SERVICE_READY = false;
  const SERVICE_PREP_MSG = "서비스 준비 중입니다.";

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

  function resolveTickerFromQuery(query) {
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

    document.documentElement.style.setProperty("--ai-vv-height", `${Math.round(vv.height)}px`);
    document.documentElement.style.setProperty("--ai-vv-top", `${Math.round(vv.offsetTop)}px`);

    const wrapper = byId("aiChatInput")?.closest(".ai-chat-input-wrapper");
    const dockH = wrapper ? Math.ceil(wrapper.getBoundingClientRect().height) + 6 : 58;
    document.documentElement.style.setProperty("--ai-dock-offset", `${dockH}px`);

    document.body.classList.toggle("ai-keyboard-open", keyboardOpen);
    window.MirCosmos?.relayout?.();
    window.dispatchEvent(new Event("resize"));
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

  async function handleStockQuery(query) {
    if (!AI_SERVICE_READY) {
      setInputHint(SERVICE_PREP_MSG, true);
      return;
    }

    const ticker = resolveTickerFromQuery(query);
    if (!ticker) {
      setInputHint("종목을 찾지 못했습니다. 티커(NVDA) 또는 한글명(엔비디아)으로 입력해 보세요.", true);
      return;
    }

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
          ? `${ticker}는 미국 종목입니다. 상단에서 🇺🇸 미국 주식 모드로 전환한 뒤 다시 시도해 보세요.`
          : `${ticker} 상세 파일을 찾지 못했습니다.`,
        true,
      );
      return;
    }
    if (detail?.__emptyChart) {
      setInputHint(`${ticker} 파일은 있지만 chartSeries 데이터가 비어 있습니다.`, true);
      return;
    }

    const bars = parseChartSeries(detail?.chartSeries);
    if (!bars.length) {
      setInputHint(`${ticker} 차트 데이터가 없습니다.`, true);
      return;
    }

    const ok = window.MirCosmos?.morphToChart?.({
      ticker,
      name: detail?.name || detail?.company || ticker,
      bars,
      range: "6M",
      onComplete() {
        isStockView = true;
        document.body.classList.remove("ai-welcome-view");
        const container = byId("tab-ai-chat")?.querySelector(".ai-chat-container");
        container?.classList.remove("is-welcome-view");
        document.body.classList.add("ai-stock-analysis-view");
        setInputHint(`${ticker} · 6개월 차트`, false);
      },
    });

    if (!ok) {
      setInputHint("차트 변환에 실패했습니다.", true);
    }
  }

  function toggleAiChatMode(active) {
    isAiChatMode = active;
    const toggleBtn = byId("aiModeToggle");
    const tabChat = byId("tab-ai-chat");

    if (active) {
      document.documentElement.dataset.aiMode = "1";
      if (!document.documentElement.dataset.aiPrevTheme) {
        document.documentElement.dataset.aiPrevTheme =
          document.documentElement.getAttribute("data-theme") || "dark";
      }
      document.documentElement.setAttribute("data-theme", "dark");
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
    const prevTheme = document.documentElement.dataset.aiPrevTheme;
    if (prevTheme) {
      document.documentElement.setAttribute("data-theme", prevTheme);
      delete document.documentElement.dataset.aiPrevTheme;
    }
    document.body.classList.remove("ai-mode-active", "ai-mode-entering", "ai-stock-analysis-view");
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
      const input = byId("aiChatInput");
      const query = input?.value?.trim();
      if (!query) return;

      if (isStockView && window.MirCosmos?.getMode?.() === "chart") {
        window.MirCosmos.resetToLandscape?.();
        document.body.classList.remove("ai-stock-analysis-view");
        document.body.classList.add("ai-welcome-view");
        const container = byId("tab-ai-chat")?.querySelector(".ai-chat-container");
        container?.classList.add("is-welcome-view");
        isStockView = false;
      }

      await handleStockQuery(query);
    }, true);

    const bindSuggestQuery = (el) => {
      el.addEventListener("click", async (e) => {
        const query = el.dataset.query || el.textContent || "";
        if (!query.trim()) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const input = byId("aiChatInput");
        if (input) input.value = query;
        await handleStockQuery(query);
      }, true);
    };

    document.querySelectorAll(".ai-chat-suggest-card").forEach(bindSuggestQuery);

    byId("aiChatInput")?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.shiftKey) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const query = e.target.value?.trim();
      if (!query) return;
      if (!AI_SERVICE_READY) {
        setInputHint(SERVICE_PREP_MSG, true);
        return;
      }
      byId("aiChatForm")?.requestSubmit();
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
    queryStock: handleStockQuery,
  };
})();