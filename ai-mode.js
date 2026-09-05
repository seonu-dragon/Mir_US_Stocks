// 이 파일은 app.js 에서 기계적으로 분리된 코드다 (refactor/appjs-split-stage1).
// AI 모드 클러스터: 전용 AI 챗 모드/세션/스트리밍/MirProb 히어로/JARVIS 대시보드 (원본 app.js 18838-21687).
// index.html 에서 app.js 보다 먼저 로드되는 classic script. 최상위 function/let/const 는
// 전역 렉시컬 환경을 공유하므로 app.js 와 양방향 참조가 호출 시점에 해결된다.

// setupAiChatModeEvents()/setupAiStreamStopEvents() 호출만 app.js 에 남김(로드 시점에 app.js 의 byId 등이 필요).
// AI 모드 진입/종료(toggle)와 입력 제출은 ai-mode-welcome.js(window.MirAI)가 단일 창구다.

// 이 파일의 모든 저장소 접근은 window.safeStorage(storage.js — index.html 첫 스크립트) 를 거친다.

// ===== Dedicated AI Chat Mode Handler =====
let aiChatBusy = false;
let aiChatHistory = [];
let aiChatSessions = {}; // Structure: { [sessionId]: { name: string, history: Array, timestamp: string } }
let currentSessionId = null;

// 로컬스토리지 대화 기록 저장
// localStorage 는 ~5MB 한도가 있다. 세션·메시지를 무한히 쌓으면 언젠가
// setItem 이 QuotaExceededError 로 터지고, 그 뒤로는 아무 것도 저장되지 않는다.
const AI_SESSIONS_MAX = 30;          // 최신 30개 세션만 보관
const AI_SESSION_MESSAGES_MAX = 200; // 세션당 최신 200개 메시지만 보관

function pruneAiSessions() {
  const entries = Object.entries(aiChatSessions)
    .sort((a, b) => new Date(b[1].timestamp) - new Date(a[1].timestamp));
  entries.slice(AI_SESSIONS_MAX).forEach(([id]) => {
    if (id !== currentSessionId) delete aiChatSessions[id];
  });
  Object.values(aiChatSessions).forEach((session) => {
    if (Array.isArray(session.history) && session.history.length > AI_SESSION_MESSAGES_MAX) {
      session.history.splice(0, session.history.length - AI_SESSION_MESSAGES_MAX);
    }
  });
}

function saveAiSessionsToStorage() {
  pruneAiSessions();
  // 쿼터 초과·저장소 차단은 safeStorage 가 흡수한다 — 저장 실패해도 화면 동작은 유지.
  window.safeStorage.setJSON("mir_ai_sessions", aiChatSessions);
  window.safeStorage.set("mir_ai_current_session", currentSessionId || "");
}

// 대화 기록 불러오기 및 사이드바 렌더링
function loadAndRenderAiHistory() {
  const saved = window.safeStorage.getJSON("mir_ai_sessions", {});
  aiChatSessions = {};
  if (saved && typeof saved === "object" && !Array.isArray(saved)) {
    // 손상된 세션(이름 누락·history 비배열)은 정규화해 렌더가 죽지 않게 한다.
    Object.entries(saved).forEach(([id, session]) => {
      if (!session || typeof session !== "object") return;
      aiChatSessions[id] = {
        name: String(session.name || "새로운 대화"),
        history: Array.isArray(session.history) ? session.history.filter((m) => m && typeof m === "object") : [],
        timestamp: session.timestamp || new Date(0).toISOString(),
      };
    });
  }
  const savedCurrent = window.safeStorage.get("mir_ai_current_session", "");
  currentSessionId = savedCurrent || null;
  renderAiHistoryList();
}

function renderAiHistoryList() {
  const historyList = byId("aiHistoryList");
  if (!historyList) return;
  
  historyList.innerHTML = "";
  const sortedSessions = Object.entries(aiChatSessions).sort((a, b) => {
    return new Date(b[1].timestamp) - new Date(a[1].timestamp);
  });
  
  if (sortedSessions.length === 0) {
    historyList.innerHTML = `<li class="muted font-small" style="text-align:center;padding:12px;">이전 기록이 없습니다.</li>`;
    return;
  }
  
  sortedSessions.forEach(([id, session]) => {
    const item = document.createElement("li");
    item.className = `ai-history-item${id === currentSessionId ? " active" : ""}`;
    item.dataset.id = id;
    
    // 대화방 이름 줄임표 처리(손상된 세션은 name 이 없을 수 있다)
    const name = String(session.name || "");
    const shortName = name.length > 18 ? name.substring(0, 18) + "..." : name;
    const dateStr = new Date(session.timestamp).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    
    item.innerHTML = `
      <div class="session-info-wrap">
        <strong>${escapeHtml(shortName)}</strong>
        <span>${escapeHtml(dateStr)}</span>
      </div>
      <div class="session-menu-wrapper">
        <button class="session-menu-trigger" title="대화방 옵션" aria-label="대화방 옵션">⋯</button>
        <div class="session-context-menu">
          <button class="context-rename-btn">이름 변경</button>
          <button class="context-delete-btn">삭제</button>
        </div>
      </div>
    `;
    
    item.addEventListener("click", () => {
      switchAiChatSession(id);
    });
    
    // 더블클릭 인라인 이름 변경 (PC 편의용)
    item.addEventListener("dblclick", (e) => {
      if (e.target.closest(".session-menu-wrapper")) return;
      triggerInlineRename(item, session);
    });
    
    const trigger = item.querySelector(".session-menu-trigger");
    const menu = item.querySelector(".session-context-menu");
    
    if (trigger && menu) {
      trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelectorAll(".session-context-menu.is-open").forEach(m => {
          if (m !== menu) m.classList.remove("is-open");
        });
        menu.classList.toggle("is-open");
      });
      
      const renameBtn = menu.querySelector(".context-rename-btn");
      if (renameBtn) {
        renameBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          menu.classList.remove("is-open");
          triggerInlineRename(item, session);
        });
      }
      
      const deleteBtn = menu.querySelector(".context-delete-btn");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          menu.classList.remove("is-open");
          if (await showAppConfirm("이 대화 기록을 삭제하시겠습니까?", { title: "대화 기록 삭제", okLabel: "삭제", danger: true })) {
            deleteAiChatSession(id);
          }
        });
      }
    }
    
    historyList.appendChild(item);
  });

  // 바깥 클릭 시 컨텍스트 메뉴 닫기 — 세션×렌더 횟수만큼 document 리스너가
  // 쌓이던 것을 위임 리스너 1개로 대체한다.
  if (!renderAiHistoryList._outsideBound) {
    renderAiHistoryList._outsideBound = true;
    document.addEventListener("click", (e) => {
      document.querySelectorAll(".session-context-menu.is-open").forEach((m) => {
        if (!m.contains(e.target) && !e.target.closest(".session-menu-trigger")) {
          m.classList.remove("is-open");
        }
      });
    });
  }
}

// 인라인 세션 이름 편집 실행 헬퍼
function triggerInlineRename(item, session) {
  const infoWrap = item.querySelector(".session-info-wrap");
  const strong = infoWrap?.querySelector("strong");
  if (!strong || infoWrap.querySelector(".rename-session-input")) return;
  
  const prevName = String(session.name || "");
  strong.style.display = "none";
  
  const input = document.createElement("input");
  input.type = "text";
  input.className = "rename-session-input";
  input.value = prevName;
  
  input.addEventListener("click", (evt) => evt.stopPropagation());
  input.addEventListener("dblclick", (evt) => evt.stopPropagation());
  
  const saveRename = () => {
    const val = input.value.trim();
    if (val && val !== prevName) {
      session.name = val;
      saveAiSessionsToStorage();
    }
    renderAiHistoryList();
  };
  
  input.addEventListener("keydown", (evt) => {
    if (evt.key === "Enter") {
      evt.preventDefault();
      saveRename();
    } else if (evt.key === "Escape") {
      renderAiHistoryList();
    }
  });
  
  input.addEventListener("blur", saveRename);
  
  infoWrap.insertBefore(input, strong);
  input.focus();
  input.select();
}

// 세션 개별 삭제
function deleteAiChatSession(sessionId) {
  if (!aiChatSessions[sessionId]) return;
  
  delete aiChatSessions[sessionId];
  saveAiSessionsToStorage();
  
  if (currentSessionId === sessionId) {
    const remaining = Object.keys(aiChatSessions);
    if (remaining.length > 0) {
      switchAiChatSession(remaining[0]);
    } else {
      startNewAiChatSession();
    }
  } else {
    renderAiHistoryList();
  }
}

// 세션 전환
function switchAiChatSession(sessionId) {
  if (!aiChatSessions[sessionId]) return;
  
  currentSessionId = sessionId;
  aiChatHistory = aiChatSessions[sessionId].history;
  saveAiSessionsToStorage();
  renderAiHistoryList();
  
  // 채팅창 로그 리빌
  const log = byId("aiChatLog");
  const welcome = byId("aiChatWelcome");
  if (log) {
    log.innerHTML = "";
    if (welcome) welcome.style.display = "none";
    
    // 복원 시에는 타이핑 효과 없이 즉시 렌더링.
    // 저장된 role 은 API 형식("user"/"assistant")이고 화면 클래스는 "user"/"bot" 이다.
    // assistant 를 그대로 넘기면 예전 raw-HTML 분기로 들어가 저장된 답변이 이스케이프
    // 없이 삽입됐다(저장형 XSS) — 사용자가 아닌 메시지는 전부 마크다운 파서(이스케이프)로.
    aiChatHistory.forEach((msg) => {
      if (!msg) return;
      appendAiChatMessage(msg.role === "user" ? "user" : "bot", String(msg.content || ""));
    });
    
    log.scrollTop = log.scrollHeight;
  }
}

function getPersonalizedWelcomeData() {
  let bestTicker = "NVDA";
  let bestName = "엔비디아";
  let maxChange = 0;
  
  // 모듈 변수 watchlist 를 직접 참조한다 — window.watchlist 는 존재하지 않고,
  // 스냅샷의 등락률 필드명은 changePercent 가 아니라 changePct 다.
  if (Array.isArray(watchlist) && watchlist.length > 0) {
    watchlist.forEach(t => {
      const stock = stockByTicker(t);
      if (stock && stock.changePct != null) {
        const absChange = Math.abs(parseFloat(stock.changePct));
        if (absChange > maxChange) {
          maxChange = absChange;
          bestTicker = t;
          bestName = stock.company;
        }
      }
    });
  }
  
  return { ticker: bestTicker, name: bestName, change: maxChange };
}

// 새 대화 시작
function startNewAiChatSession() {
  currentSessionId = "session_" + Date.now();
  aiChatHistory = [];
  aiChatSessions[currentSessionId] = {
    name: "새로운 대화",
    history: aiChatHistory,
    timestamp: new Date().toISOString()
  };
  
  saveAiSessionsToStorage();
  renderAiHistoryList();
  
  const log = byId("aiChatLog");
  const welcome = byId("aiChatWelcome");
  if (log) {
    log.innerHTML = "";
    if (welcome) {
      welcome.style.display = "block";
      
      // 관심종목 변동 정보 연동 개인화
      const welcomeData = getPersonalizedWelcomeData();
      const mutedP = welcome.querySelector("p.muted");
      if (mutedP) {
        mutedP.innerHTML = `오늘 관심 종목 중 등락률이 높은 <strong>${escapeHtml(welcomeData.name)} (${escapeHtml(welcomeData.ticker)})</strong>의 정밀 AI 리포트를 확인해 보시겠어요? 아래 카드를 누르거나 무엇이든 질문해 주세요.`;
      }
      
      const firstCard = welcome.querySelector(".welcome-suggestions .ai-chat-suggest-card");
      if (firstCard) {
        firstCard.dataset.query = `${welcomeData.ticker} 분석해줘`;
        const cardStrong = firstCard.querySelector("strong");
        const cardSpan = firstCard.querySelector("span");
        if (cardStrong) cardStrong.textContent = `${stockLabel(welcomeData)} 분석해줘`; // 표시만 회사명(국내) — dataset.query 는 티커 유지
        if (cardSpan) cardSpan.textContent = `${welcomeData.name}의 핵심 기술 지표, 실적 상황을 종합 점검합니다.`; // textContent 라 escape 불필요(이중 이스케이프 방지)
      }
    }
  }
}

function generateAiBadges(text) {
  const badges = [];
  const lower = text.toLowerCase();
  
  // 1. 호재/악재 감지
  if (lower.includes("호재") || lower.includes("긍정") || lower.includes("상승") || lower.includes("매수 신호") || lower.includes("강세")) {
    badges.push('<span class="ai-badge-tag bullish">종합: 호재</span>');
  } else if (lower.includes("악재") || lower.includes("경계") || lower.includes("하락") || lower.includes("위험") || lower.includes("우려")) {
    badges.push('<span class="ai-badge-tag bearish">종합: 경계</span>');
  } else {
    badges.push('<span class="ai-badge-tag neutral">종합: 중립</span>');
  }
  
  // 2. 테마 감지
  if (lower.includes("반도체") || lower.includes("hbm") || lower.includes("메모리") || lower.includes("삼성전자") || lower.includes("하이닉스") || lower.includes("nvda") || lower.includes("엔비디아")) {
    badges.push('<span class="ai-badge-tag neutral">테마: 반도체</span>');
  } else if (lower.includes("금리") || lower.includes("연준") || lower.includes("fomc") || lower.includes("인플레이션")) {
    badges.push('<span class="ai-badge-tag neutral">매크로: 금리</span>');
  } else if (lower.includes("수출") || lower.includes("수입") || lower.includes("무역")) {
    badges.push('<span class="ai-badge-tag neutral">실물: 수출</span>');
  } else if (lower.includes("부동산") || lower.includes("규제") || lower.includes("동탄") || lower.includes("기흥")) {
    badges.push('<span class="ai-badge-tag neutral">자산: 부동산</span>');
  }
  
  if (badges.length > 0) {
    return `<div class="ai-badge-tags-container">${badges.join("")}</div>`;
  }
  return "";
}

function typeWriterMarkdown(element, rawText, onComplete) {
  let i = 0;
  const text = String(rawText || "");
  // 타이핑 중엔 textContent 만 갱신한다 — 매 16ms 마다 전체 문자열을 마크다운 파싱하면
  // 긴 답변에서 CPU 를 다 먹었다. 마크다운 HTML 은 끝에 한 번만 만든다.
  element.textContent = "";

  const interval = setInterval(() => {
    if (i >= text.length) {
      clearInterval(interval);
      element.innerHTML = formatMarkdownToHtml(text);
      if (onComplete) onComplete();
      return;
    }

    // 타이핑 속도 보정 (한 번에 3글자씩 누적하여 부드러운 가속 제공)
    const step = Math.min(3, text.length - i);
    i += step;
    element.textContent = text.substring(0, i);
  }, 16);
}

// ===== AI 챗 스트리밍 · 중단 인프라 =====
// 워커 /chat 이 SSE(text/event-stream)를 지원하면 토큰 단위로 받아 점진 렌더하고,
// 옛 워커(JSON 응답)가 아직 배포돼 있으면 Content-Type 으로 감지해 기존 비스트리밍
// 경로로 자동 폴백한다(워커 배포는 수동이라 신구 혼재 기간이 반드시 생긴다).
const aiActiveStreams = new Set();

function syncAiSendButton() {
  const btn = document.querySelector("#aiChatForm .ai-send-btn");
  if (!btn) return;
  const streaming = aiActiveStreams.size > 0;
  btn.classList.toggle("is-stop", streaming);
  const glyph = btn.querySelector(".ai-send-glyph");
  if (glyph) glyph.textContent = streaming ? "■" : "↑";
  const label = streaming ? "생성 중단" : "질문 전송";
  btn.title = label;
  btn.setAttribute("aria-label", label);
}

function aiStreamBegin() {
  const controller = new AbortController();
  aiActiveStreams.add(controller);
  syncAiSendButton();
  return controller;
}

function aiStreamEnd(controller) {
  aiActiveStreams.delete(controller);
  syncAiSendButton();
}

function aiAbortAllStreams() {
  aiActiveStreams.forEach((controller) => {
    try { controller.abort(); } catch (_) { /* ignore */ }
  });
}

// /chat 호출 공용 헬퍼. stream:true 를 요청하되, 응답이 JSON 이면(구 워커) 그대로
// 파싱해 비스트리밍으로 처리한다. 중단(abort) 시에도 지금까지 받은 부분 텍스트를 돌려준다.
async function requestAiChatReply(payload, { signal, onDelta, endpoint } = {}) {
  const res = await fetch(endpoint || `${LIVE_DATA_PROXY.replace(/\/$/, "")}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, stream: true }),
    signal,
  });
  if (!res.ok) {
    // 워커의 429("잠시 후 다시 시도")·4xx 메시지를 살려 사용자에게 보여준다. 예전엔 오류
    // 본문을 그냥 JSON 으로 읽고 reply 가 비어 "답변을 가져오지 못했습니다" 만 남았다.
    let data = null;
    try { data = await res.json(); } catch (_) { data = null; }
    const err = new Error(String((data && (data.message || data.error)) || `HTTP ${res.status}`));
    err.status = res.status;
    throw err;
  }
  const ctype = (res.headers.get("Content-Type") || "").toLowerCase();
  if (!ctype.includes("text/event-stream")) {
    const data = await res.json();
    return { reply: (data && data.reply) || "", streamed: false, aborted: false };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let full = "";
  let aborted = false;
  const consume = (block) => {
    for (const rawLine of block.split("\n")) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        if (typeof parsed.delta === "string" && parsed.delta) {
          full += parsed.delta;
          if (onDelta) onDelta(parsed.delta, full);
        }
      } catch (_) { /* 불완전 청크는 무시 */ }
    }
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let sep;
      while ((sep = buf.indexOf("\n\n")) >= 0) {
        consume(buf.slice(0, sep));
        buf = buf.slice(sep + 2);
      }
    }
    if (buf.trim()) consume(buf);
  } catch (err) {
    if (err && err.name === "AbortError") aborted = true;
    else if (!full) throw err; // 아무것도 못 받았으면 실제 오류로 전파
  }
  return { reply: full, streamed: true, aborted };
}

async function sendAiChat(queryText = null) {
  if (aiChatBusy) return;
  
  const input = byId("aiChatInput");
  const text = queryText !== null ? queryText.trim() : (input ? input.value.trim() : "");
  if (!text) return;
  
  if (input && queryText === null) {
    input.value = "";
  }
  
  // 임머시브 AI 모드에서는 app.js 쪽 toggle(세션 로드)이 welcome 스크립트에 가로채여
  // 실행되지 않는다 — 첫 채팅 시점에 세션이 없으면 여기서 만들어 준다(내보내기·이력 저장용).
  if (!currentSessionId || !aiChatSessions[currentSessionId]) {
    loadAndRenderAiHistory(); // 저장된 세션을 먼저 불러와야 새 세션 저장 때 덮어쓰지 않는다
    startNewAiChatSession();
  }

  const log = byId("aiChatLog");
  const welcome = byId("aiChatWelcome");
  if (welcome) {
    welcome.style.display = "none";
  }

  // AI 모드(임머시브)에서는 대화 로그가 CSS 로 감춰져 있으므로,
  // 채팅 답변이 시작되면 대화 뷰 클래스를 붙여 로그를 화면에 되살린다.
  if (document.body.classList.contains("ai-mode-active")) {
    document.body.classList.add("ai-conversation-view");
  }

  // 첫 질문 시 대화 세션명 업데이트
  if (aiChatSessions[currentSessionId] && aiChatSessions[currentSessionId].name === "새로운 대화") {
    aiChatSessions[currentSessionId].name = text;
  }

  // 1. Add User Message bubble
  appendAiChatMessage("user", text);
  aiChatHistory.push({ role: "user", content: text, ts: Date.now() });
  
  aiChatBusy = true;
  
  // 2. Add Bot Loading/Typing bubble
  let matchedTicker = extractStockTickerFromQuery(text);
  let matchedStock = matchedTicker ? stockByTicker(matchedTicker) : null;
  if (!matchedStock && typeof resolveTickerAcrossMarkets === "function") {
    // 반대 시장 종목(US 모드의 "삼성전자", KR 모드의 "AAPL")이면 시장을 바꿔서라도 찾는다.
    // 예전엔 "전환해 보세요" 힌트만 띄우고 종목 데이터 없이 답했다.
    try {
      const cross = await resolveTickerAcrossMarkets(text);
      if (cross && stockByTicker(cross)) {
        matchedTicker = cross;
        matchedStock = stockByTicker(cross);
      }
    } catch (_) { /* 분류 실패 → 아래 일반 답변 */ }
  }
  if (matchedTicker && !matchedStock) matchedTicker = null;
  const loadingText = matchedTicker
    ? `${matchedStock.company} (${matchedTicker}) 데이터를 분석하여 심층 투자 보고서를 요약하고 있습니다...`
    : "답변을 작성하고 있습니다...";

  const typingBubble = appendAiChatMessage("bot", loadingText);
  typingBubble.classList.add("typing");

  if (matchedTicker) {
    const chartMessage = appendAiChatMessage("bot", "");
    if (chartMessage) {
      chartMessage.classList.add("chart-message");
      chartMessage.querySelector(".msg-bubble")?.remove();
      renderInlineStockWidget(matchedTicker, chartMessage);
    }
  }
  
  if (log) log.scrollTop = log.scrollHeight;
  
  const controller = aiStreamBegin();
  try {
    if (!LIVE_DATA_PROXY) throw new Error("no proxy configured");

    const stockContext = matchedTicker ? await buildStockChatContext(matchedTicker) : "";
    const bubbleDiv = typingBubble.querySelector(".msg-bubble");

    // 답변 확정(스트리밍/타이핑 종료) 시 공통 마무리: 이력 저장 + 배지 부착
    const finalizeReply = (replyText, abortedMark) => {
      aiChatHistory.push({ role: "assistant", content: replyText, ts: Date.now() });
      // 로딩 문구 기준으로 미리 붙은 배지는 걷어내고 실제 답변 기준으로 다시 단다
      typingBubble.querySelectorAll(".ai-badge-tags-container").forEach((el) => el.remove());
      const badgesHtml = generateAiBadges(replyText);
      if (badgesHtml) {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = badgesHtml;
        typingBubble.insertBefore(tempDiv.firstChild, bubbleDiv);
      }
      if (abortedMark && bubbleDiv) {
        bubbleDiv.insertAdjacentHTML("beforeend", `<span class="ai-abort-note muted">(중단됨)</span>`);
      }
      if (aiChatSessions[currentSessionId]) {
        aiChatSessions[currentSessionId].history = aiChatHistory;
        aiChatSessions[currentSessionId].timestamp = new Date().toISOString();
        saveAiSessionsToStorage();
        renderAiHistoryList();
      }
    };

    // 스트리밍 점진 렌더 — rAF 로 스로틀해 매 토큰마다 파싱 폭주를 막는다.
    let streamStarted = false;
    let paintQueued = false;
    let latestFull = "";
    const paintStream = () => {
      paintQueued = false;
      if (bubbleDiv) bubbleDiv.innerHTML = formatMarkdownToHtml(latestFull);
      if (log) log.scrollTop = log.scrollHeight;
    };
    const onDelta = (_delta, full) => {
      latestFull = full;
      if (!streamStarted) {
        streamStarted = true;
        typingBubble.classList.remove("typing");
        typingBubble.classList.add("is-streaming");
      }
      if (!paintQueued) {
        paintQueued = true;
        requestAnimationFrame(paintStream);
      }
    };

    const result = await requestAiChatReply({
      messages: aiChatHistory.slice(-10).map(({ role, content }) => ({ role, content })),
      stockContext,
      snapshotContext: buildMarketChatContext(),
      market: isKrMarket() ? "kr" : "us",
      searchHints: matchedTicker ? { tickers: [matchedTicker], companies: [matchedStock.company].filter(Boolean) } : {},
    }, { signal: controller.signal, onDelta });

    typingBubble.classList.remove("typing", "is-streaming");

    // 깨진 답변('of the. the of the…' 반복)은 화면에 남기지 않는다 — 워커 가드를 지나쳐도
    // 프런트에서 한 번 더 거른다(09-05 모바일 국내 모드에서 실제로 새어 나옴).
    const broken = typeof isDegenerateLlmText === "function" && result.reply && isDegenerateLlmText(result.reply, /[가-힣]/.test(text));
    if (broken) result.reply = "답변 생성이 불안정해 다시 시도해야 합니다. 같은 질문을 한 번 더 보내 주세요.";
    if (result.streamed) {
      const reply = result.reply || (result.aborted ? "" : "답변을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      if (bubbleDiv) bubbleDiv.innerHTML = reply ? formatMarkdownToHtml(reply) : `<span class="muted">답변이 중단되었습니다.</span>`;
      if (reply) finalizeReply(reply, result.aborted);
      else if (result.aborted && bubbleDiv) bubbleDiv.insertAdjacentHTML("beforeend", ` <span class="ai-abort-note muted">(중단됨)</span>`);
    } else {
      // 구 워커(JSON) 폴백 — 오늘과 동일한 타이핑 라이터 렌더 유지
      const reply = result.reply || "답변을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.";
      typeWriterMarkdown(bubbleDiv, reply, () => finalizeReply(reply, false));
    }
  } catch (err) {
    typingBubble.classList.remove("typing", "is-streaming");
    const bubbleDiv = typingBubble.querySelector(".msg-bubble");
    if (bubbleDiv) {
      if (err && err.name === "AbortError") {
        bubbleDiv.innerHTML = `<span class="muted">답변 생성을 중단했습니다. <span class="ai-abort-note">(중단됨)</span></span>`;
      } else {
        bubbleDiv.innerHTML = `연결 실패: ${escapeHtml(String((err && err.message) || err))}`;
      }
    }
  } finally {
    aiStreamEnd(controller);
    aiChatBusy = false;
  }
}

// ai-mode-welcome.js 가 쓰는 창구. 웰컴 화면이 submit 을 capture 단계에서 가로채므로
// 폼 경로로는 sendAiChat 에 닿을 수 없다. 종목이 아닌 질문은 웰컴이 여기로 넘긴다.
// resolveTicker 도 함께 넘겨, 웰컴이 자체 해석기를 따로 두지 않게 한다
// (자체 해석기는 문자열 전체가 티커일 때만 맞아서 "NVDA 분석해줘" 를 놓쳤다).
window.MirAiChat = {
  send: (text) => sendAiChat(text),
  resolveTicker: (text) => extractStockTickerFromQuery(text),
  // autocomplete: setupAiChatModeEvents 가 채운다 — { highlightedTicker(), hide() }
  autocomplete: null,
};

// role: "user" | "bot". 텍스트만 받는다 — 사용자 메시지는 escapeHtml, 나머지는 마크다운
// 파서(내부에서 <,>,& 이스케이프)를 거친다. 예전의 raw-HTML 인자는 저장된 LLM 답변을
// 그대로 innerHTML 에 넣는 구멍이라 없앴다.
function appendAiChatMessage(role, text) {
  const log = byId("aiChatLog");
  if (!log) return null;

  const content = String(text ?? "");
  const msg = document.createElement("div");
  msg.className = `chat-msg ${role === "user" ? "user" : "bot"}`;

  if (role === "user") {
    msg.innerHTML = `<div class="msg-bubble">${escapeHtml(content)}</div>`;
  } else {
    const badgesHtml = generateAiBadges(content);
    const parsedContent = formatMarkdownToHtml(content);
    msg.innerHTML = `
      ${badgesHtml}
      <div class="msg-bubble">
        ${parsedContent}
        ${content ? `<button class="copy-msg-btn" title="답변 복사" aria-label="답변 복사">복사</button>` : ""}
      </div>
    `;
    
    const copyBtn = msg.querySelector(".copy-msg-btn");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        // 복사 버튼 자신을 제외한 텍스트만 복사하기 위해, 복제 후 복사 버튼 노드를 제거하고 텍스트를 파싱
        const bubble = msg.querySelector(".msg-bubble");
        if (bubble) {
          const clone = bubble.cloneNode(true);
          clone.querySelector(".copy-msg-btn")?.remove();
          const textToCopy = clone.innerText.trim();
          
          navigator.clipboard.writeText(textToCopy).then(() => {
            copyBtn.textContent = "✓";
            copyBtn.classList.add("copied");
            setTimeout(() => {
              copyBtn.textContent = "복사";
              copyBtn.classList.remove("copied");
            }, 1500);
          }).catch(err => {
            console.error("복사 실패:", err);
          });
        }
      });
    }
  }
  
  log.appendChild(msg);
  log.scrollTop = log.scrollHeight;
  return msg;
}

const aiLiveDataPromises = {};

function createAiChartState() {
  return {
    ...chartState,
    range: "1Y",
    barTf: "D",
    chartType: "candle",
    zoom: 1,
    offset: 0,
    showSma20: true,
    showSma60: true,
    showVolume: true,
    showRsi: true,
    showMacd: false,
    showStoch: false,
    showSupportResistance: true,
    showPatterns: true,
    showTechLevels: true,
    showVolumeProfile: false,
    showTrendlines: true,
    showGapZones: false,
    showTtmSqueeze: false,
    showMarketStructure: false,
    showChandelier: false,
    showAnchoredVwap: false,
    showRsSpy: false,
    showRsQqq: false,
    showRsSector: false,
    showMansfield: false,
    techLevelTypes: { ...chartState.techLevelTypes },
    patternTypes: { ...chartState.patternTypes },
  };
}

async function ensureAiWidgetStock(ticker) {
  const base = stockByTicker(ticker) || data.stocks.find((row) => row.ticker === ticker);
  if (!base) return null;
  await Promise.all([
    loadStockDetail(ticker),
    ...["inst13f", "insider", "short", "congress", "activist", "events"].map((key) =>
      (typeof ensureFeatureData === "function" ? ensureFeatureData(key) : Promise.resolve(false)).catch(() => false)),
  ]);

  if (LIVE_DATA_PROXY && !liveDone[ticker]) {
    if (!aiLiveDataPromises[ticker]) {
      liveFetched[ticker] = true;
      const endpoint = `${LIVE_DATA_PROXY.replace(/\/$/, "")}/?ticker=${encodeURIComponent(liveProxyTicker(base))}`;
      aiLiveDataPromises[ticker] = fetch(endpoint, { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => {
          if (!payload) return;
          if (Array.isArray(payload.news)) liveNewsCache[ticker] = payload.news;
          if (typeof payload.newsSource === "string") liveNewsSourceCache[ticker] = payload.newsSource;
          if (Array.isArray(payload.chart)) liveChartCache[ticker] = payload.chart;
          if (payload.earnings) liveEarningsCache[ticker] = payload.earnings;
          if (typeof payload.summary === "string") liveSummaryCache[ticker] = payload.summary;
          liveDone[ticker] = true;
        })
        .catch(() => {
          liveDone[ticker] = true;
        });
    }
    await aiLiveDataPromises[ticker].catch(() => {});
  }

  const refreshed = stockByTicker(ticker) || base;
  return applyLive(withDetail(refreshed));
}

function aiEvidenceCard(title, value, detail, tone = "") {
  return `
    <article class="ai-evidence-card${tone ? ` ${tone}` : ""}">
      <span>${escapeHtml(title)}</span>
      <strong>${escapeHtml(value || "-")}</strong>
      <p>${escapeHtml(detail || "확인된 데이터가 아직 없습니다.")}</p>
    </article>
  `;
}

function aiSectorEvidence(item) {
  const peers = (data.stocks || []).filter((row) => row.sector === item.sector && row.ticker !== item.ticker);
  const sectorAvg = peers.length
    ? peers.reduce((sum, row) => sum + Number(row.changePct || 0), 0) / peers.length
    : 0;
  const ranked = peers.concat(item).sort((a, b) => (Number(rsiValue(b)) || 0) - (Number(rsiValue(a)) || 0));
  const rank = ranked.findIndex((row) => row.ticker === item.ticker) + 1;
  const rel = Number(item.changePct || 0) - sectorAvg;
  return aiEvidenceCard(
    "섹터 흐름",
    `${item.sector || "섹터"} ${rel >= 0 ? "대비 강함" : "대비 약함"}`,
    `섹터 평균 ${fmtPct(sectorAvg)} · 종목 ${fmtDailyPct(item.changePct)} · RS 순위 ${rank || "-"}/${ranked.length || "-"}`,
    rel >= 0 ? "is-positive" : "is-negative"
  );
}

function aiSmartMoneyEvidence(item) {
  if (isKrMarket()) {
    return aiEvidenceCard("스마트머니", "국내 종목", "미국식 내부자·13F·의회 매매 데이터는 국내 종목에 제한적으로만 적용됩니다.");
  }
  const t = item.ticker;
  const bits = [];
  const ins = ((window.INSIDER_TRADES || {}).trades || []).filter((row) => row.ticker === t);
  if (ins.length) {
    const buys = ins.filter((row) => row.kind === "buy").length;
    const sells = ins.filter((row) => row.kind === "sell").length;
    bits.push(`내부자 매수 ${buys} / 매도 ${sells}`);
  }
  const cg = ((window.CONGRESS_TRADES || {}).byTicker || {})[t];
  if (cg) bits.push(`의회 매수 ${cg.netBuys || 0} / 매도 ${cg.netSells || 0}`);
  const f13 = (typeof inst13fIndex === "function" ? inst13fIndex() : {})[t];
  if (f13) bits.push(`13F 보유 ${f13.holders}곳`);
  const act = ((window.ACTIVIST_STAKES || {}).filings || []).filter((row) => row.ticker === t);
  if (act.length) bits.push(`대량보유 ${act.length}건`);
  const shortRow = ((window.SHORT_INTEREST || {}).rows || []).find((row) => row.ticker === t);
  if (shortRow) bits.push(shortIsBalance() ? `공매도 잔고비중 ${Number(shortRow.balanceRatio || 0).toFixed(2)}%` : `공매도 DTC ${Number(shortRow.daysToCover || 0).toFixed(1)}일`);

  return aiEvidenceCard(
    "스마트머니",
    bits.length ? "신호 확인" : "특이 신호 적음",
    bits.slice(0, 4).join(" · ") || "내부자·기관·의회·대량보유 신호가 아직 뚜렷하지 않습니다.",
    bits.length ? "is-info" : ""
  );
}

function aiDisclosureEvidence(item) {
  const events = ((window.MATERIAL_EVENTS || {}).events || []).filter((event) => String(event.ticker || "").toUpperCase() === item.ticker);
  const earnings = item.liveEarnings || {};
  if (events.length) {
    const latest = events[0];
    const labels = (latest.items || []).map((entry) => entry.label).filter(Boolean).slice(0, 3).join(", ");
    return aiEvidenceCard("공시·이벤트", `${events.length}건`, `${latest.fileDate || "최근"} · ${labels || latest.type || "주요 이벤트"}`, latest.hot ? "is-warning" : "is-info");
  }
  if (earnings.nextDate) {
    return aiEvidenceCard("공시·이벤트", "실적 예정", `${earnings.nextDate}${earnings.epsEstimate != null ? ` · EPS 예상 ${earnings.epsEstimate}` : ""}`, "is-info");
  }
  return aiEvidenceCard("공시·이벤트", "특이 공시 없음", "최근 수집된 주요 8-K·실적 이벤트가 없습니다.");
}

function aiNewsEvidence(item) {
  const news = Array.isArray(item.news) ? item.news : [];
  if (!news.length) return aiEvidenceCard("뉴스", "뉴스 부족", "이 종목의 최신 뉴스가 아직 수집되지 않았습니다.");
  const headline = news[0].title || "최신 헤드라인";
  const source = news[0].source || news[0].publisher || "";
  return aiEvidenceCard("뉴스", headline.slice(0, 34), `${source}${news.length > 1 ? ` · 추가 ${news.length - 1}건` : ""}`, "is-info ai-news-dup");
}

function renderAiEvidenceGrid(item) {
  return [
    aiSectorEvidence(item),
    aiSmartMoneyEvidence(item),
    aiDisclosureEvidence(item),
    aiNewsEvidence(item),
  ].join("");
}

function aiModePanel(title, subtitle, body, extraClass = "") {
  return `
    <section class="ai-mode-data-panel${extraClass ? ` ${extraClass}` : ""}">
      <div class="ai-mode-data-head">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(subtitle || "")}</span>
      </div>
      ${body || `<p class="muted">표시할 데이터가 아직 없습니다.</p>`}
    </section>
  `;
}

function aiMetricGrid(metrics) {
  return `<div class="ai-mode-metric-grid">${metrics.map((metric) => `
    <article>
      <span>${escapeHtml(metric.label)}</span>
      <strong class="${metric.tone || ""}">${escapeHtml(String(metric.value ?? "-"))}</strong>
      ${metric.detail ? `<em>${escapeHtml(metric.detail)}</em>` : ""}
    </article>
  `).join("")}</div>`;
}

function aiMiniTable(headers, rows, emptyText = "데이터가 없습니다.") {
  if (!rows.length) return `<p class="muted ai-mode-empty">${escapeHtml(emptyText)}</p>`;
  return `
    <div class="ai-mode-table-wrap">
      <table class="ai-mode-table">
        <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
    </div>
  `;
}

function aiTechnicalPanel(item) {
  const rows = getChartRows(item);
  const closes = rows.map((row) => Number(row.c)).filter(Number.isFinite);
  const last = closes[closes.length - 1];
  const rsi = closes.length > 14 ? lastN(rsiSeries(closes, 14), 1)[0] : null;
  const macdPack = closes.length > 35 ? macdSeries(closes) : null;
  const macd = macdPack ? lastN(macdPack.macd, 1)[0] : null;
  const signal = macdPack ? lastN(macdPack.signal, 1)[0] : null;
  const sma20 = closes.length >= 20 ? closes.slice(-20).reduce((sum, value) => sum + value, 0) / 20 : null;
  const sma60 = closes.length >= 60 ? closes.slice(-60).reduce((sum, value) => sum + value, 0) / 60 : null;
  return aiModePanel("기술 지표", "추세·모멘텀·이평", aiMetricGrid([
    { label: "현재가", value: priceOrDash(last || item.price) },
    { label: "1개월", value: fmtPct(item.monthChangePct), tone: cls(item.monthChangePct) },
    { label: "RSI", value: fmtRsi(item), detail: "상대강도지수(14)" },
    { label: "거래량", value: `${Number(item.volumeRatio || 0).toFixed(1)}x`, detail: "평균 대비" },
    { label: "RSI(14)", value: rsi == null ? "-" : rsi.toFixed(1), tone: rsi >= 70 ? "warn" : rsi <= 30 ? "pos" : "" },
    { label: "MACD", value: macd == null ? "-" : macd.toFixed(2), detail: signal == null ? "" : `Signal ${signal.toFixed(2)}`, tone: macd != null && signal != null ? cls(macd - signal) : "" },
    { label: "SMA20", value: sma20 == null ? "-" : chartPriceLabel(sma20), tone: last != null && sma20 != null ? cls(last - sma20) : "" },
    { label: "SMA60", value: sma60 == null ? "-" : chartPriceLabel(sma60), tone: last != null && sma60 != null ? cls(last - sma60) : "" },
  ]));
}

function aiFundamentalPanel(item) {
  const f = normalizedFundamentalsForItem(item);
  return aiModePanel("밸류에이션", "재무·가치", aiMetricGrid([
    { label: "시가총액", value: fmtBillions(f.marketCapDisplay ?? f.marketCapB ?? item.marketCapB) },
    { label: "PER", value: fmtMultiple(f.pe) },
    { label: "Forward PER", value: fmtMultiple(f.forwardPE) },
    { label: "P/S", value: fmtMultiple(f.ps) },
    { label: "EPS Next Y", value: moneyOrDash(f.epsNextY) },
    { label: "매출", value: fmtFinancialB(f.salesB) },
    { label: "순이익", value: fmtFinancialB(f.incomeB) },
    { label: "ROE", value: fmtPercent(f.roe) },
  ]));
}

function aiNewsPanel(item) {
  const news = Array.isArray(item.news) ? item.news : [];
  const rows = news.slice(0, 8).map((newsItem) => {
    const href = newsItem.url || newsItem.link || "#";
    const title = escapeHtml(newsItem.title || "제목 없음");
    const source = escapeHtml(newsItem.source || newsItem.publisher || "뉴스");
    const time = escapeHtml(newsItem.time || newsItem.publishedAt || "");
    return [
      `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${title}</a>`,
      source,
      time || "-",
    ];
  });
  return aiModePanel("뉴스", `${news.length}건`, aiMiniTable(["헤드라인", "출처", "시간"], rows, "이 종목의 뉴스가 아직 수집되지 않았습니다."), "is-wide ai-news-dup");
}

function aiEventsPanel(item) {
  const events = ((window.MATERIAL_EVENTS || {}).events || []).filter((event) => String(event.ticker || "").toUpperCase() === item.ticker);
  const rows = events.slice(0, 8).map((event) => {
    const labels = (event.items || []).map((entry) => entry.label).filter(Boolean).slice(0, 3).join(", ") || event.type || "-";
    return [
      escapeHtml(event.fileDate || event.date || "-"),
      escapeHtml(labels),
      `<span class="${event.hot ? "warn" : "muted"}">${event.hot ? "주요" : "일반"}</span>`,
    ];
  });
  return aiModePanel("공시·이벤트", "8-K·실적", aiMiniTable(["일자", "내용", "구분"], rows, "수집된 주요 공시·이벤트가 없습니다."));
}

function aiSectorPanel(item) {
  // 점수 대신 3개월 모멘텀으로 섹터 내 순위를 매기고 RSI 를 함께 보여준다.
  const peers = (data.stocks || [])
    .filter((row) => row.sector === item.sector)
    .sort((a, b) => (Number(b.threeMonthChangePct) || 0) - (Number(a.threeMonthChangePct) || 0));
  const rows = peers.slice(0, 8).map((row, index) => [
    `${index + 1}`,
    `<strong>${escapeHtml(stockLabel(row))}</strong>`,
    escapeHtml(stockSubLabel(row)),
    `<span class="${cls(row.changePct)}">${fmtDailyPct(row.changePct)}</span>`,
    fmtRsi(row),
  ]);
  return aiModePanel("섹터 흐름", `${item.sector || "-"} 3개월 강도`, aiMiniTable(["#", "티커", "회사", "당일", "RSI"], rows, "동일 섹터 비교 데이터가 없습니다."));
}

// 시장별 기능 게이트(market_config.js features). 키가 없으면 켜진 것으로 본다(=== false 판정).
// KR 에서 US 전용 패널을 그리면 전부 "데이터 없음" 빈 상자만 남는다 — 없는 데이터는 기능을 끈다.
function aiPanelEnabled(key) {
  const features = (typeof marketCfg === "function" ? marketCfg().features : null) || {};
  return features[key] !== false;
}

function aiInsiderPanel(item) {
  if (!aiPanelEnabled("insider")) return "";
  const rowsRaw = ((window.INSIDER_TRADES || {}).trades || []).filter((row) => row.ticker === item.ticker);
  const rows = rowsRaw.slice(0, 8).map((row) => [
    escapeHtml(row.date || row.filingDate || "-"),
    escapeHtml(row.owner || row.name || row.insider || "-"),
    `<span class="${row.kind === "buy" ? "pos" : row.kind === "sell" ? "neg" : "muted"}">${escapeHtml(row.kind || row.transaction || "-")}</span>`,
    escapeHtml(row.valueText || (row.valueM ? `$${Number(row.valueM || 0).toFixed(1)}M` : row.shares ? `${row.shares}주` : "-")),
  ]);
  return aiModePanel("내부자 거래", "Form 4", aiMiniTable(["일자", "내부자", "구분", "규모"], rows, "최근 내부자 거래 데이터가 없습니다."));
}

function aiCongressPanel(item) {
  if (!aiPanelEnabled("congress")) return "";
  const meta = ((window.CONGRESS_TRADES || {}).byTicker || {})[item.ticker];
  const recent = ((window.CONGRESS_TRADES || {}).trades || []).filter((row) => row.ticker === item.ticker);
  const summary = meta ? aiMetricGrid([
    { label: "순매수", value: meta.netBuys ?? "-" },
    { label: "순매도", value: meta.netSells ?? "-" },
    { label: "정치인 수", value: meta.politicianCount ?? "-" },
  ]) : "";
  const rows = recent.slice(0, 6).map((row) => [
    escapeHtml(row.transactionDate || row.date || "-"),
    escapeHtml(row.representative || row.politician || "-"),
    `<span class="${String(row.side || "").toLowerCase().includes("buy") ? "pos" : String(row.side || "").toLowerCase().includes("sell") ? "neg" : "muted"}">${escapeHtml(row.side || row.type || "-")}</span>`,
    escapeHtml(row.amount || row.amountText || "-"),
  ]);
  return aiModePanel("의회 매매", "PTR", summary + aiMiniTable(["일자", "인물", "구분", "규모"], rows, meta ? "상세 거래 목록이 없습니다." : "의회 매매 데이터가 없습니다."));
}

function aiInstitutionalPanel(item) {
  if (!aiPanelEnabled("sec13f") && !aiPanelEnabled("activist")) return "";
  const f13 = (typeof inst13fIndex === "function" ? inst13fIndex() : {})[item.ticker];
  const act = ((window.ACTIVIST_STAKES || {}).filings || []).filter((row) => row.ticker === item.ticker);
  const body = aiMetricGrid([
    { label: "13F 보유기관", value: f13 ? `${f13.holders}곳` : "-" },
    { label: "13F 평가액", value: f13 ? `$${(Number(f13.valueM || 0) / 1000).toFixed(1)}B` : "-" },
    { label: "13D/G", value: act.length ? `${act.length}건` : "-" },
    { label: "액티비스트", value: act.filter((row) => row.kind === "activist").length || "-" },
  ]);
  return aiModePanel("기관·대량보유", "13F·13D/G", body);
}

function aiShortInterestPanel(item) {
  const shortRow = ((window.SHORT_INTEREST || {}).rows || []).find((row) => row.ticker === item.ticker);
  if (!shortRow) return aiModePanel("공매도", "숏 인터레스트", `<p class="muted ai-mode-empty">공매도 데이터가 없습니다.</p>`);
  const isBal = shortIsBalance();
  const shares = isBal ? shortRow.shortShares : shortRow.shortInterest;
  return aiModePanel("공매도", "숏 인터레스트", aiMetricGrid([
    isBal
      ? { label: "잔고비중", value: `${Number(shortRow.balanceRatio || 0).toFixed(2)}%` }
      : { label: "Days To Cover", value: Number(shortRow.daysToCover || 0).toFixed(1) },
    { label: "변화율", value: Number.isFinite(Number(shortRow.changePct)) ? fmtPct(shortRow.changePct) : "-", tone: cls(shortRow.changePct) },
    { label: isBal ? "공매도 잔고" : "공매도 수량", value: shares ? Number(shares).toLocaleString() : "-" },
    { label: "기준일", value: shortRow.settlementDate || shortRow.date || "-" },
  ]));
}

function aiEarningsPanel(item) {
  if (!aiPanelEnabled("earningsCalendar")) return "";
  const earnings = item.liveEarnings || {};
  const reactions = earningsReactionRows(item).slice(0, 4).map((row) => [
    escapeHtml(row.date || "-"),
    row.surprise == null ? "-" : `<span class="${cls(row.surprise)}">${fmtPct(row.surprise)}</span>`,
    row.post5 == null ? "-" : `<span class="${cls(row.post5)}">${fmtPct(row.post5)}</span>`,
  ]);
  const next = aiMetricGrid([
    { label: "다음 실적", value: earnings.nextDate || "-" },
    { label: "EPS 예상", value: earnings.epsEstimate ?? "-" },
    { label: "EPS", value: fmtEps(item) },
  ]);
  return aiModePanel("실적", "캘린더·반응", next + aiMiniTable(["발표일", "EPS 서프라이즈", "발표 후 5D"], reactions, "실적 발표 반응 데이터가 부족합니다."));
}

function aiDataQualityPanel(item) {
  const f = normalizedFundamentalsForItem(item);
  const chartRows = getChartRows(item);
  const missing = missingFundamentalFields(f);
  return aiModePanel("데이터 품질", "출처", aiMetricGrid([
    { label: "스냅샷", value: data.updatedAtKst || data.updated_at_kst || "-" },
    { label: "가격 이력", value: `${chartRows.length} bars`, detail: sourceLabel(item.historySource) },
    { label: "재무 출처", value: sourceLabel(f.source) },
    { label: "누락 지표", value: missing.length ? `${missing.length}개` : "없음", tone: missing.length > 5 ? "warn" : "" },
  ]));
}

// KR 전용 — 흩어진 공시·수급 신호를 종목 하나로 모은다(공매도추세·자사주·증자·배당·
// 외국인·실적반응·수주). 전부 이미 로드된 전역에서 조합, 없으면 그 줄만 뺀다.
// 중대 리스크 공시만 골라낸다(DART 공시). 거래정지는 병합·스팩 등 루틴이 많아 사유가
// 중대할 때만(상장폐지·불성실·감사의견·횡령) 잡는다 — 루틴을 리스크로 오탐하지 않는다.
function krRiskFlags(ticker) {
  const flags = [];
  for (const d of ((window.KR_DISCLOSURES || {}).disclosures || [])) {
    if (d.ticker !== ticker) continue;
    const t = d.title || "";
    if (t.includes("상장폐지")) flags.push("상장폐지 사유");
    else if (t.includes("불성실공시")) flags.push("불성실공시 지정");
    else if (t.includes("관리종목")) flags.push("관리종목(우려)");
    else if (t.includes("횡령") || t.includes("배임")) flags.push("횡령·배임");
    else if (t.includes("자본잠식")) flags.push("자본잠식");
    else if (t.includes("거래정지") && /상장폐지|불성실|감사의견|횡령|배임/.test(t)) flags.push("거래정지(중대)");
  }
  return [...new Set(flags)];
}

function aiKrEventsPanel(item) {
  if (typeof isKrMarket === "function" ? !isKrMarket() : (marketCfg().id !== "kr")) return "";
  const t = item.ticker;
  const bits = [];
  const risks = krRiskFlags(t);
  if (risks.length) bits.push({ label: "리스크 공시", value: risks.join(" · "), tone: "warn" });
  const si = ((window.SHORT_INTEREST || {}).rows || []).find((r) => r.ticker === t);
  if (si && Number.isFinite(si.balanceRatio)) {
    let trend = "";
    if (Array.isArray(si.history) && si.history.length >= 2) {
      const dlt = si.history[si.history.length - 1].r - si.history[0].r;
      trend = ` ${dlt > 0 ? "▲" : "▼"}${Math.abs(dlt).toFixed(1)}p`;
    }
    bits.push({ label: "공매도 잔고비중", value: `${si.balanceRatio.toFixed(2)}%${trend}`, tone: si.balanceRatio > 5 ? "warn" : "" });
  }
  const mf = (window.MAP_FUNDAMENTALS || {})[String(t).padStart(6, "0")] || (window.MAP_FUNDAMENTALS || {})[t];
  if (mf && Number.isFinite(mf.foreignPct)) bits.push({ label: "외국인 지분율", value: `${mf.foreignPct.toFixed(1)}%` });
  const disc = ((window.KR_DISCLOSURES || {}).disclosures || []).filter((d) => d.ticker === t);
  const details = (window.KR_EVENT_DETAILS || {}).details || {};
  const rcpt = (l) => { const m = /rcpNo=(\d+)/.exec(l || ""); return m ? m[1] : ""; };
  const buy = disc.find((d) => (d.title || "").includes("자기주식취득"));
  if (buy) { const dt = details[rcpt(buy.link)] || {}; bits.push({ label: "자사주 취득", value: dt.amount ? `${Math.round(dt.amount / 1e8).toLocaleString()}억` : "공시" }); }
  const dil = disc.find((d) => dilutionCategory(d.title));
  if (dil) { const dt = details[rcpt(dil.link)] || {}; const cat = dilutionCategory(dil.title); bits.push({ label: `${cat.label}(희석)`, value: dt.dilutionPct != null ? `희석 ${dt.dilutionPct.toFixed(1)}%` : "공시", tone: "warn" }); }
  const dv = ((window.KR_DIVIDENDS || {}).rows || []).find((r) => r.ticker === t);
  if (dv) bits.push({ label: "배당", value: Number.isFinite(dv.yieldPct) ? `${dv.yieldPct.toFixed(2)}% · 기준일 ${dv.recordDate || "-"}` : `기준일 ${dv.recordDate || "-"}` });
  const ct = ((window.KR_CONTRACTS || {}).rows || []).find((r) => r.ticker === t);
  if (ct && Number.isFinite(ct.salesRatio)) bits.push({ label: "수주", value: `매출대비 ${ct.salesRatio.toFixed(1)}%` });
  const er = ((window.KR_EARNINGS_REACTIONS || {}).rows || []).find((r) => r.ticker === t);
  if (er) bits.push({ label: "실적발표", value: `${er.date} · 공시일 ${fmtPct(er.dayPct)} · 익일 ${fmtPct(er.nextPct)}`, tone: cls(er.dayPct) });
  if (!bits.length) return aiModePanel("KR 이벤트·수급", "공시 종합", `<p class="muted ai-mode-empty">최근 공시·수급 이벤트가 없습니다.</p>`);
  return aiModePanel("KR 이벤트·수급", "공시 종합", aiMetricGrid(bits));
}

// 종목 체력 스노우플레이크(Simply Wall St 벤치마크). 5축(밸류·성장·건전성·과거성과·배당)
// 각각을 6개 재무 체크 통과 개수(0~6)로 채운다. 블랙박스 점수가 아니라 '통과한 체크'를
// 그대로 보여주는 게 핵심 — Mir 정직성 원칙과 맞다. 예측 신호가 아니라 재무 체크 요약.
function computeSnowflake(f) {
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
  const asRatio = (v) => (v == null ? null : (v > 10 ? v / 100 : v)); // %로 오면 배수로
  const pe = n(f.pe), fpe = n(f.forwardPE), pb = n(f.pb ?? f.pbr), ps = n(f.ps), peg = n(f.peg);
  const dy = n(f.divYield), payout = n(f.payoutRatio);
  const roe = n(f.roe), roa = n(f.roa), nm = n(f.netMargin ?? f.profitMargin);
  const debt = asRatio(n(f.debtEq)) ?? (n(f.debtRatio) != null ? n(f.debtRatio) / 100 : null);
  const cur = asRatio(n(f.currentRatio)) ?? asRatio(n(f.quickRatio));
  const rg = n(f.revenueGrowth), og = n(f.operatingGrowth), ng = n(f.netGrowth);
  const eps = n(f.epsTtm ?? f.eps), epsN = n(f.epsNextY);
  const axis = (checks) => {
    let pass = 0, ev = 0;
    for (const [has, ok] of checks) { if (has) { ev++; if (ok) pass++; } }
    return { pass, ev, score: ev > 0 ? pass : null };
  };
  return {
    value: axis([[pe > 0, pe < 15], [pe > 0, pe < 25], [pb > 0, pb < 1.5], [pb > 0, pb < 3], [ps > 0, ps < 2], [peg > 0, peg > 0 && peg < 1.5]]),
    growth: axis([[peg > 0, peg < 1], [peg > 0, peg < 1.5], [pe > 0 && fpe > 0, fpe < pe], [rg != null, rg > 10], [rg != null, rg > 0], [og != null || ng != null, (og != null ? og > 0 : ng > 0)]]),
    health: axis([[debt != null, debt < 0.5], [debt != null, debt < 1], [cur != null, cur > 1.5], [cur != null, cur > 1], [nm != null, nm > 5], [nm != null, nm > 0]]),
    past: axis([[roe != null, roe > 15], [roe != null, roe > 8], [roa != null, roa > 5], [nm != null, nm > 10], [nm != null, nm > 0], [eps != null, eps > 0]]),
    dividend: axis([[dy != null, dy > 0], [dy != null, dy > 2], [dy != null, dy > 3.5], [payout != null, payout > 0 && payout < 80], [payout != null, payout > 0 && payout < 60], [dy != null, dy > 0 && dy < 12]]),
  };
}

function snowflakeSvg(sf) {
  const axes = [["밸류", sf.value], ["성장", sf.growth], ["건전성", sf.health], ["과거성과", sf.past], ["배당", sf.dividend]];
  const cx = 96, cy = 100, R = 62, N = 5;
  const ang = (i) => (-Math.PI / 2) + i * (2 * Math.PI / N);
  const pt = (i, r) => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))];
  let grid = "";
  for (const g of [2, 4, 6]) grid += `<polygon points="${axes.map((_, i) => pt(i, g / 6 * R).map((v) => v.toFixed(1)).join(",")).join(" ")}" fill="none" stroke="var(--muted)" stroke-opacity="0.16" stroke-width="1"/>`;
  let spokes = "", labels = "";
  axes.forEach(([name], i) => {
    const [x, y] = pt(i, R);
    spokes += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--muted)" stroke-opacity="0.16"/>`;
    const [lx, ly] = pt(i, R + 14);
    const anchor = Math.abs(lx - cx) < 6 ? "middle" : (lx > cx ? "start" : "end");
    labels += `<text x="${lx.toFixed(1)}" y="${(ly + 3).toFixed(1)}" font-size="11" fill="var(--muted)" text-anchor="${anchor}">${name}</text>`;
  });
  const dp = axes.map(([_, a], i) => pt(i, (a.score ?? 0) / 6 * R).map((v) => v.toFixed(1)).join(",")).join(" ");
  const total = axes.reduce((s, [_, a]) => s + (a.score ?? 0), 0);
  const col = total >= 20 ? "#2fa25f" : total >= 12 ? "#5b8def" : "#d98a2b";
  const dots = axes.map(([_, a], i) => { const [x, y] = pt(i, (a.score ?? 0) / 6 * R); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.4" fill="${col}"/>`; }).join("");
  return `<svg viewBox="0 0 192 206" width="180" height="192" role="img" aria-label="종목 체력 레이더">${grid}${spokes}<polygon points="${dp}" fill="${col}" fill-opacity="0.22" stroke="${col}" stroke-width="1.6" stroke-linejoin="round"/>${dots}${labels}</svg>`;
}

function aiSnowflakePanel(item) {
  // 소스: 종목 상세 fundamentals + 지도 펀더멘털(MAP_FUNDAMENTALS)을 결측 보완으로 병합.
  // 홈의 light 종목은 fundamentals 가 비어 있어 map 이 주 소스가 된다.
  const mf = (typeof mapFundamentalsFor === "function" ? mapFundamentalsFor(item.ticker) : null) || {};
  const norm = normalizedFundamentalsForItem(item) || {};
  const f = { ...mf };
  for (const k in norm) if (norm[k] != null) f[k] = norm[k];
  const sf = computeSnowflake(f);
  const axes = [["밸류", sf.value], ["성장", sf.growth], ["건전성", sf.health], ["과거성과", sf.past], ["배당", sf.dividend]];
  if (axes.filter(([_, a]) => a.ev > 0).length < 2) return ""; // 데이터 부족하면 숨김
  const total = axes.reduce((s, [_, a]) => s + (a.score ?? 0), 0);
  const checks = axes.map(([name, a]) => `<div style="display:flex;justify-content:space-between;gap:8px"><span style="color:var(--muted)">${name}</span><b>${a.ev > 0 ? `${a.pass}/${a.ev}` : "—"}</b></div>`).join("");
  const body = `<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
    ${snowflakeSvg(sf)}
    <div style="flex:1;min-width:150px">
      <div style="font-size:13px;color:var(--muted);margin-bottom:8px">종합 <b style="color:var(--text)">${total}/30</b> · 통과한 재무 체크</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px 16px;font-size:12px">${checks}</div>
      <div style="font-size:var(--fs-cap);color:var(--muted);margin-top:10px;line-height:1.65">각 축 = PER·PBR·성장·부채·ROE·배당 등 최대 6개 체크 중 통과 개수. 예측 점수가 아니라 재무 상태 요약입니다.</div>
    </div>
  </div>`;
  return aiModePanel("종목 체력", "스노우플레이크 · 재무 체크", body);
}

// DCF 적정주가(Simply Wall St 벤치마크). 2단계(10년 성장 + 영구성장) 현금흐름 할인.
// 가정(성장률·할인율·영구성장)에 매우 민감해 '정답'이 아니라 한 참고 앵커다 — 라벨로 명시.
function computeDcf(f, price) {
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
  const pfcf = n(f.pfcf), eps = n(f.epsTtm ?? f.eps), pe = n(f.pe), peg = n(f.peg);
  const rg = n(f.revenueGrowth), og = n(f.operatingGrowth);
  const fcfps = (pfcf > 0 && price > 0) ? price / pfcf : (eps > 0 ? eps : null); // FCF/주 우선, 없으면 EPS
  if (!(fcfps > 0) || !(price > 0)) return null;
  let g = rg != null ? rg : (og != null ? og : (peg > 0 && pe > 0 ? pe / peg : 6));
  g = Math.max(-2, Math.min(18, g)) / 100;          // 과도한 가정 방지(-2%~18%)
  const r = 0.09, tg = 0.025;                        // 할인율 9% · 영구성장 2.5%
  let pv = 0, ff = fcfps;
  for (let t = 1; t <= 10; t++) { ff *= (1 + g); pv += ff / Math.pow(1 + r, t); }
  pv += (ff * (1 + tg) / (r - tg)) / Math.pow(1 + r, 10);
  return { fair: pv, upside: pv / price - 1, growth: g * 100, basedOn: pfcf > 0 ? "FCF" : "EPS" };
}

function aiDcfPanel(item) {
  const mf = (typeof mapFundamentalsFor === "function" ? mapFundamentalsFor(item.ticker) : null) || {};
  const norm = normalizedFundamentalsForItem(item) || {};
  const f = { ...mf };
  for (const k in norm) if (norm[k] != null) f[k] = norm[k];
  const price = Number(item.price ?? f.price);
  const d = computeDcf(f, price);
  if (!d) return "";
  const cfg = marketCfg();
  const up = d.upside * 100;
  const tone = up > 15 ? "good" : up < -15 ? "warn" : "";
  const body = aiMetricGrid([
    { label: "적정주가", value: cfg.formatPrice(d.fair) },
    { label: "현재가", value: cfg.formatPrice(price) },
    { label: "상/하방", value: `${up > 0 ? "+" : ""}${up.toFixed(0)}%`, tone },
    { label: "가정 성장률", value: `${d.growth.toFixed(0)}%` },
  ]) + `<div style="font-size:var(--fs-cap);color:var(--muted);margin-top:10px;line-height:1.65">2단계 DCF · ${d.basedOn} 기준 · 할인율 9% · 영구성장 2.5%. <b>가정에 매우 민감</b>해 정답이 아니라 참고 앵커입니다.</div>`;
  return aiModePanel("적정주가 DCF", "현금흐름 할인 · 참고용", body);
}

// 다년 재무 추이(stockanalysis.com 벤치마크). build_kr_financials_history.py 가 DART 연간
// 주요계정을 모아 종목 detail 의 financialsHistory 로 붙인다(현재 KR 만). 연도별 매출·
// 영업이익·순이익·영업이익률 테이블.
function finMoney(v) {
  // KR 재무는 원(→조/억), US 재무는 달러(→$B/$M). 통화별로 포맷.
  if (!Number.isFinite(Number(v))) return "—";
  if (isKrMarket()) return krMoneyEok(v);
  const n = Number(v), a = Math.abs(n);
  if (a >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}
function aiFinancialsPanel(item) {
  const rows = item && item.financialsHistory;
  if (!Array.isArray(rows) || rows.length < 2) return "";
  const sorted = rows.slice().sort((a, b) => b.y - a.y).slice(0, 10);
  const body = sorted.map((r) => {
    const margin = (r.op != null && r.rev > 0) ? (r.op / r.rev * 100) : null;
    return `<tr>
      <td class="ins-date">${r.y}</td>
      <td class="ins-num">${finMoney(r.rev)}</td>
      <td class="ins-num ${r.op < 0 ? "ins-sell" : ""}">${finMoney(r.op)}</td>
      <td class="ins-num ${r.net < 0 ? "ins-sell" : ""}">${finMoney(r.net)}</td>
      <td class="ins-num">${margin != null ? `${margin.toFixed(1)}%` : "—"}</td>
    </tr>`;
  }).join("");
  const table = `<table class="insider-table" style="table-layout:fixed;width:100%;min-width:0">
    <colgroup><col style="width:14%"><col style="width:24%"><col style="width:22%"><col style="width:22%"><col style="width:18%"></colgroup>
    <thead><tr><th>연도</th><th class="ins-num">매출</th><th class="ins-num">영업이익</th><th class="ins-num">순이익</th><th class="ins-num">이익률</th></tr></thead><tbody>${body}</tbody></table>`;
  return aiModePanel("다년 재무", `연간 추이 · ${sorted[sorted.length - 1].y}~${sorted[0].y} (${isKrMarket() ? "DART" : "SEC"})`, `<div class="insider-table-wrap">${table}</div>`);
}

// 위험 프로파일 — 가격 이력(getChartRows)으로 연율변동성·최대낙폭·1년수익률 + 월별
// 시즈널리티. 예측이 아니라 과거 위험/계절 패턴 요약.
function seasonalitySvg(monthly) {
  const W = 250, H = 54, n = 12, bw = W / n;
  const vals = monthly.map((v) => (Number.isFinite(v) ? v : 0));
  const mx = Math.max(1, ...vals.map(Math.abs));
  const mid = H / 2;
  let bars = "", labels = "";
  const M = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
  for (let i = 0; i < n; i++) {
    const v = vals[i]; const h = Math.abs(v) / mx * (H / 2 - 3);
    const y = v >= 0 ? mid - h : mid; const col = v >= 0 ? "#30a46c" : "#e5484d";
    bars += `<rect x="${(i * bw + 3).toFixed(1)}" y="${y.toFixed(1)}" width="${(bw - 6).toFixed(1)}" height="${Math.max(1, h).toFixed(1)}" fill="${col}" rx="1.5"/>`;
    labels += `<text x="${(i * bw + bw / 2).toFixed(1)}" y="${H + 9}" font-size="8" fill="var(--muted)" text-anchor="middle">${M[i]}</text>`;
  }
  return `<svg viewBox="0 0 ${W} ${H + 12}" width="100%" height="${H + 12}"><line x1="0" y1="${mid}" x2="${W}" y2="${mid}" stroke="var(--muted)" stroke-opacity="0.2"/>${bars}${labels}</svg>`;
}
function aiRiskPanel(item) {
  const rows = getChartRows(item);
  if (!Array.isArray(rows) || rows.length < 60) return "";
  const closes = rows.map((r) => Number(r.c)).filter((c) => c > 0);
  if (closes.length < 60) return "";
  const rets = [];
  for (let i = 1; i < closes.length; i++) rets.push(closes[i] / closes[i - 1] - 1);
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const varc = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
  const vol = Math.sqrt(varc) * Math.sqrt(252) * 100;
  let peak = closes[0], mdd = 0;
  for (const c of closes) { if (c > peak) peak = c; const dd = c / peak - 1; if (dd < mdd) mdd = dd; }
  const oneY = closes.length > 252 ? (closes[closes.length - 1] / closes[closes.length - 252] - 1) * 100 : null;
  const byMonth = Array.from({ length: 12 }, () => []);
  for (let i = 1; i < rows.length && i < closes.length; i++) {
    const d = rows[i] && rows[i].d; if (!d) continue;
    const m = Number(String(d).slice(5, 7)) - 1;
    if (m >= 0 && m < 12 && closes[i] && closes[i - 1]) byMonth[m].push(closes[i] / closes[i - 1] - 1);
  }
  const seasonal = byMonth.map((a) => a.length ? (a.reduce((x, y) => x + y, 0) / a.length) * 21 * 100 : null);
  const grid = aiMetricGrid([
    { label: "연율 변동성", value: Number.isFinite(vol) ? `${vol.toFixed(0)}%` : "—", tone: vol > 45 ? "warn" : "" },
    { label: "최대 낙폭", value: Number.isFinite(mdd) ? `${(mdd * 100).toFixed(0)}%` : "—", tone: "warn" },
    { label: "1년 수익률", value: oneY != null ? `${oneY > 0 ? "+" : ""}${oneY.toFixed(0)}%` : "—", tone: cls(oneY) },
    { label: "표본", value: `${closes.length}일` },
  ]);
  const body = grid + `<div style="font-size:12px;color:var(--muted);margin:12px 0 4px">월별 시즈널리티 (평균 수익률)</div>${seasonalitySvg(seasonal)}`;
  return aiModePanel("위험 · 시즈널리티", "가격 이력 기반 · 참고용", body);
}

// 팩터 스코어 — 시장 내 백분위(밸류·모멘텀·퀄리티·성장·규모). 스노우플레이크의 정량
// 상대평가 버전. 예측이 아니라 '동종 대비 위치'.
function factorPercentiles(item) {
  const stocks = (typeof data !== "undefined" && data && Array.isArray(data.stocks)) ? data.stocks : [];
  if (stocks.length < 30) return null;
  const mfFor = (t) => ((typeof mapFundamentalsFor === "function" ? mapFundamentalsFor(t) : null) || {});
  const cols = { value: [], momentum: [], quality: [], growth: [], size: [] };
  const push = (arr, t, v) => { if (Number.isFinite(v)) arr.push([t, v]); };
  for (const s of stocks) {
    const mf = mfFor(s.ticker);
    const val = Number.isFinite(mf.valueScore) ? mf.valueScore
      : (mf.pe > 0 && mf.pb > 0 ? -(mf.pe + mf.pb * 8) : NaN); // 높을수록 저평가
    push(cols.value, s.ticker, val);
    push(cols.momentum, s.ticker, Number(s.threeMonthChangePct));
    const roe = Number(mf.roe), nm = Number(mf.netMargin), dr = Number(mf.debtRatio);
    if (Number.isFinite(roe) || Number.isFinite(nm)) push(cols.quality, s.ticker, (roe || 0) + (nm || 0) - (Number.isFinite(dr) ? dr / 5 : 0));
    push(cols.growth, s.ticker, Number.isFinite(mf.revenueGrowth) ? mf.revenueGrowth
      : ((Number.isFinite(Number(s.epsNextY)) && Number.isFinite(Number(s.epsTtm)) && Number(s.epsTtm) > 0)
          ? (Number(s.epsNextY) / Number(s.epsTtm) - 1) * 100 : NaN));
    push(cols.size, s.ticker, Number(s.marketCapB));
  }
  const pct = (arr) => {
    if (arr.length < 20) return null;
    const sorted = arr.slice().sort((a, b) => a[1] - b[1]);
    const idx = sorted.findIndex((x) => x[0] === item.ticker);
    return idx < 0 ? null : Math.round(idx / (sorted.length - 1) * 100);
  };
  return { value: pct(cols.value), momentum: pct(cols.momentum), quality: pct(cols.quality), growth: pct(cols.growth), size: pct(cols.size) };
}
function aiFactorPanel(item) {
  const f = factorPercentiles(item);
  if (!f) return "";
  const axes = [["밸류", f.value], ["모멘텀", f.momentum], ["퀄리티", f.quality], ["성장", f.growth], ["규모", f.size]];
  if (axes.filter(([_, v]) => v != null).length < 3) return "";
  const bar = (name, v) => {
    const col = v == null ? "var(--muted)" : v >= 70 ? "#30a46c" : v >= 40 ? "#5b8def" : "#d98a2b";
    const w = v == null ? 0 : v;
    return `<div style="display:flex;align-items:center;gap:8px;margin:5px 0">
      <span style="width:44px;font-size:12px;color:var(--muted)">${name}</span>
      <div style="flex:1;height:7px;border-radius:4px;background:var(--panel-soft);overflow:hidden"><div style="width:${w}%;height:100%;background:${col}"></div></div>
      <span style="width:34px;text-align:right;font-size:12px;font-weight:600">${v == null ? "—" : v}</span>
    </div>`;
  };
  const body = axes.map(([n, v]) => bar(n, v)).join("")
    + `<div style="font-size:var(--fs-cap);color:var(--muted);margin-top:8px;line-height:1.65">시장 내 백분위(0~100). 밸류=저평가·모멘텀=3개월 상대강세·퀄리티=ROE·마진·저부채·성장=매출성장/RS·규모=시총. 예측이 아니라 동종 대비 위치입니다.</div>`;
  return aiModePanel("팩터 스코어", "시장 내 백분위", body);
}

// 유사종목 비교 — 같은 산업군(폴백 섹터) 시총 상위 피어 표. stockanalysis·Simply Wall St
// 공통 기능. 예측이 아니라 동종 기업과의 밸류·수익성·모멘텀 나란히 보기.
function aiPeerPanel(item) {
  const stocks = (typeof data !== "undefined" && data && Array.isArray(data.stocks)) ? data.stocks : [];
  if (stocks.length < 10 || !item || !item.ticker) return "";
  const sameInd = stocks.filter((s) => s.ticker !== item.ticker && item.industry && s.industry === item.industry);
  const pool = sameInd.length >= 3 ? sameInd
    : stocks.filter((s) => s.ticker !== item.ticker && item.sector && s.sector === item.sector);
  if (!pool.length) return "";
  const basis = sameInd.length >= 3 ? "같은 산업군" : "같은 섹터";
  const peers = pool.slice().sort((a, b) => (Number(b.marketCapB) || 0) - (Number(a.marketCapB) || 0)).slice(0, 6);
  const list = [item, ...peers];
  const mf = (t) => (typeof mapFundamentalsFor === "function" ? mapFundamentalsFor(t) : null) || {};
  const num = (v, d = 1) => Number.isFinite(Number(v)) ? Number(v).toFixed(d) : "—";
  const rows = list.map((s) => {
    const f = mf(s.ticker);
    const self = s.ticker === item.ticker;
    const tkCell = self
      ? `<strong>${escapeHtml(stockLabel(s))}</strong>`
      : `<strong class="ticker-link ai-peer-link" data-ticker="${escapeHtml(s.ticker)}" role="button" tabindex="0">${escapeHtml(stockLabel(s))}</strong>`;
    const chg = Number(s.threeMonthChangePct);
    const rt = "text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap";
    return `<tr style="${self ? "background:var(--panel-soft)" : ""}">
      <td style="overflow:hidden">${tkCell}<div style="font-size:var(--fs-cap);color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(s.company || "")}</div></td>
      <td style="${rt}">${fmtBillions(s.marketCapB)}</td>
      <td style="${rt}">${num(f.pe)}</td>
      <td style="${rt}">${num(f.pb)}</td>
      <td style="${rt}" class="${Number.isFinite(chg) ? cls(chg) : ""}">${Number.isFinite(chg) ? fmtPct(chg) : "—"}</td>
    </tr>`;
  }).join("");
  const body = `<div class="ai-mode-table-wrap"><table class="ai-mode-table" style="table-layout:fixed;width:100%;min-width:0">
    <colgroup><col style="width:34%"><col style="width:18%"><col style="width:13%"><col style="width:13%"><col style="width:22%"></colgroup>
    <thead><tr><th>종목</th><th style="text-align:right">시총</th><th style="text-align:right">PER</th><th style="text-align:right">PBR</th><th style="text-align:right">3개월</th></tr></thead>
    <tbody>${rows}</tbody></table></div>
    <div style="font-size:var(--fs-cap);color:var(--muted);margin-top:8px">${basis} 시총 상위 비교(강조행이 현재 종목). 종목명을 누르면 해당 분석으로 이동합니다.</div>`;
  return aiModePanel("유사종목 비교", basis + " · 시총순", body);
}

// 유사종목 표의 종목 클릭(위임, 문서에 한 번만). 인라인 onclick 에 티커를 문자열로 박던
// 것을 data-ticker 로 바꿨다 — 인라인은 이스케이프가 안 돼 있었고 CSP 에도 걸린다.
// AI 모드 안에서는 같은 AI 분석으로, 밖(종목검색 탭)에서는 종목 분석으로 이동한다.
function onAiPeerLinkActivate(e) {
  const link = e.target && e.target.closest ? e.target.closest(".ai-peer-link[data-ticker]") : null;
  if (!link) return;
  if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
  const t = link.dataset.ticker;
  if (!t) return;
  e.preventDefault();
  if (window.MirAI?.isActive?.() && window.MirAI.queryStock) {
    const input = byId("aiChatInput");
    if (input) input.value = `${t} 분석해줘`;
    window.MirAI.queryStock(`${t} 분석해줘`);
    return;
  }
  selectTicker(t, { openSearch: true });
}
document.addEventListener("click", onAiPeerLinkActivate);
document.addEventListener("keydown", onAiPeerLinkActivate);

// 일일 공매도 거래량(FINRA) — 격주 공매도잔고를 보완하는 매일 지표. 공매도량/총거래량
// 비율 + 10일 추이. MM 헤지·데이트레이딩도 포함되니 '포지션'이 아니라 '참여도'다(참고용).
function aiShortVolumePanel(item) {
  if (!aiPanelEnabled("finraShortVolume")) return "";
  const fs = window.FINRA_SHORT_VOLUME;
  if (!fs || !fs.stocks || !item || !item.ticker) return "";
  const s = fs.stocks[String(item.ticker).toUpperCase()];
  if (!s || !Number.isFinite(Number(s.ratio))) return "";
  const ratio = Number(s.ratio);
  const mkt = Number(fs.market && fs.market.avgShortRatio);
  const hist = Array.isArray(s.hist) ? s.hist.map(Number).filter(Number.isFinite) : [];
  const vsMkt = Number.isFinite(mkt) ? ratio - mkt : null;
  const spark = hist.length > 3 ? sparklineSvg(hist, { width: 240, height: 44, color: ratio >= (mkt || 50) ? "#e5484d" : "#5b8def" }) : "";
  const grid = aiMetricGrid([
    { label: "공매도 거래량 비율", value: `${ratio.toFixed(1)}%`, tone: Number.isFinite(vsMkt) && vsMkt > 8 ? "warn" : "",
      detail: fs.asOf ? String(fs.asOf) : "" },
    { label: "시장 평균 대비", value: vsMkt != null ? `${vsMkt > 0 ? "+" : ""}${vsMkt.toFixed(1)}%p` : "—",
      detail: Number.isFinite(mkt) ? `평균 ${mkt.toFixed(1)}%` : "" },
    { label: `${hist.length}일 범위`, value: hist.length ? `${Math.min(...hist).toFixed(0)}~${Math.max(...hist).toFixed(0)}%` : "—" },
  ]);
  const body = grid + (spark ? `<div style="font-size:12px;color:var(--muted);margin:12px 0 4px">최근 ${hist.length}일 추이</div>${spark}` : "")
    + `<p style="font-size:var(--fs-cap);color:var(--muted);margin:10px 0 0;line-height:1.65">FINRA 규정 SHO 통합 공매도 거래량 ÷ 총거래량. 마켓메이커 헤지·데이트레이딩도 포함되어 시장 평균이 ~50% 안팎으로 높습니다. 공매도 '잔고(포지션)'가 아니라 그날 매도 흐름의 '참여도'이며, 예측·매매 신호가 아닙니다.</p>`;
  return aiModePanel("일일 공매도량", `FINRA · ${fs.asOf || ""}`, body);
}

// US 배당 — 배당수익률·주당배당·배당성향·배당락일·5년평균(Yahoo). 배당주만.
function aiDividendPanel(item) {
  const cal = window.US_STOCK_CALENDAR;
  if (!cal || !cal.stocks || !item || !item.ticker) return "";
  const s = cal.stocks[String(item.ticker).toUpperCase()];
  if (!s || !Number.isFinite(Number(s.divYield)) || Number(s.divYield) <= 0) return "";
  const y = Number(s.divYield);
  const avg = Number(s.avg5yYield);
  const vsAvg = Number.isFinite(avg) && avg > 0 ? y - avg : null;
  const grid = aiMetricGrid([
    { label: "배당수익률", value: `${y.toFixed(2)}%`, detail: Number.isFinite(avg) ? `5년평균 ${avg.toFixed(2)}%` : "" },
    { label: "주당 배당", value: Number.isFinite(Number(s.divRate)) ? `$${Number(s.divRate).toFixed(2)}` : "—" },
    { label: "배당성향", value: Number.isFinite(Number(s.payout)) ? `${Number(s.payout).toFixed(0)}%` : "—",
      tone: Number(s.payout) > 80 ? "warn" : "" },
    { label: "배당락일", value: s.exDate ? escapeHtml(s.exDate) : "—" },
  ]);
  const cmp = vsAvg != null ? `<p style="font-size:var(--fs-cap);color:var(--muted);margin:10px 0 0;line-height:1.65">현재 수익률이 5년 평균보다 ${vsAvg > 0 ? `<b style="color:var(--green)">${vsAvg.toFixed(2)}%p 높습니다</b>(가격 하락 또는 배당 증가)` : `<b>${Math.abs(vsAvg).toFixed(2)}%p 낮습니다</b>`}. 배당성향이 높을수록 이익 대비 배당 부담이 큽니다. 참고용입니다.</p>` : "";
  return aiModePanel("배당", "Yahoo · 연간 기준", grid + cmp);
}

// 애널리스트 컨센서스 — 추천 분포(강력매수~강력매도) + 분기 EPS 서프라이즈(Finnhub).
// 목표주가는 무료 티어 제외. 참고용이며 예측·매매 신호가 아니다.
function aiAnalystPanel(item) {
  const ac = window.ANALYST_CONSENSUS;
  if (!ac || !ac.stocks || !item || !item.ticker) return "";
  const s = ac.stocks[String(item.ticker).toUpperCase()];
  if (!s) return "";
  const rec = s.rec;
  let recHtml = "";
  if (rec && rec.total > 0) {
    const segs = [
      ["강력매수", rec.strongBuy, "#1a7f4b"], ["매수", rec.buy, "#30a46c"],
      ["보유", rec.hold, "#8a8f98"], ["매도", rec.sell, "#d98a2b"], ["강력매도", rec.strongSell, "#e5484d"],
    ];
    const bar = segs.map(([, n, c]) => n > 0 ? `<div style="width:${(n / rec.total * 100).toFixed(1)}%;background:${c}" title="${n}"></div>` : "").join("");
    // 가중 컨센서스: 강매+2 매수+1 보유0 매도-1 강매도-2
    const score = (rec.strongBuy * 2 + rec.buy - rec.sell - rec.strongSell * 2) / rec.total;
    const label = score >= 1 ? "강력 매수" : score >= 0.4 ? "매수 우위" : score > -0.4 ? "중립" : score > -1 ? "매도 우위" : "매도";
    const lcol = score >= 0.4 ? "var(--green)" : score <= -0.4 ? "var(--red)" : "var(--muted)";
    const legend = segs.filter(([, n]) => n > 0).map(([lbl, n, c]) =>
      `<span style="display:inline-flex;align-items:center;gap:4px;font-size:var(--fs-cap);color:var(--muted);margin-right:10px"><i style="width:8px;height:8px;border-radius:2px;background:${c};display:inline-block"></i>${lbl} ${n}</span>`).join("");
    recHtml = `<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
        <span style="font-size:12px;color:var(--muted)">애널리스트 ${rec.total}명${rec.period ? ` · ${escapeHtml(String(rec.period).slice(0, 7))}` : ""}</span>
        <strong style="color:${lcol}">${label}</strong></div>
      <div style="display:flex;height:12px;border-radius:6px;overflow:hidden;background:var(--panel-soft)">${bar}</div>
      <div style="margin-top:8px">${legend}</div>`;
  }
  let earnHtml = "";
  const earn = Array.isArray(s.earnings) ? s.earnings.filter((e) => Number.isFinite(Number(e.surprisePercent))).slice(0, 4) : [];
  if (earn.length) {
    const pills = earn.map((e) => {
      const sp = Number(e.surprisePercent); const beat = sp >= 0;
      return `<span style="display:inline-block;font-size:var(--fs-cap);padding:3px 8px;border-radius:6px;margin:2px 4px 2px 0;background:var(--panel-soft);color:${beat ? "var(--green)" : "var(--red)"};font-variant-numeric:tabular-nums">${escapeHtml(String(e.period || "").slice(2, 7))} ${beat ? "+" : ""}${sp.toFixed(1)}%</span>`;
    }).join("");
    earnHtml = `<div style="font-size:12px;color:var(--muted);margin:12px 0 4px">최근 EPS 서프라이즈 (추정 대비)</div><div>${pills}</div>`;
  }
  // 다음 실적 예정일(US_STOCK_CALENDAR)
  const cal = window.US_STOCK_CALENDAR;
  const nextE = cal && cal.stocks && cal.stocks[String(item.ticker).toUpperCase()] && cal.stocks[String(item.ticker).toUpperCase()].nextEarnings;
  const nextHtml = nextE ? `<div style="background:var(--panel-soft);border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:12px"><span style="color:var(--muted)">다음 실적 발표 예정</span> <strong style="margin-left:6px">${escapeHtml(nextE)}</strong></div>` : "";
  if (!recHtml && !earnHtml && !nextHtml) return "";
  const note = `<p style="font-size:var(--fs-cap);color:var(--muted);margin:10px 0 0;line-height:1.65">Finnhub 애널리스트 추천 분포·분기 EPS 서프라이즈와 예정 실적일(Yahoo)입니다. 목표주가는 무료 데이터에 없어 제외했습니다. 참고용이며 예측·매매 신호가 아닙니다.</p>`;
  return aiModePanel("애널리스트 컨센서스", "추천 분포 · EPS 서프라이즈", nextHtml + recHtml + earnHtml + note);
}

// 옵션 심리 — 풋/콜 비율(미결제약정) + 맥스페인. 둘 다 참고용 심리·수급 지표이지 매매
// 신호가 아니다(맥스페인 '끌림'설은 논쟁적, 풋콜은 헤지·베팅이 섞여 해석이 갈린다).
function aiOptionsPanel(item) {
  const os = window.OPTIONS_STATS;
  if (!os || !os.stocks || !item || !item.ticker) return "";
  const s = os.stocks[normalizeTickerKey(item.ticker)] || os.stocks[String(item.ticker).toUpperCase()];
  if (!s) return "";
  const price = Number(item.price) || Number(s.price);
  const mp = Number(s.maxPain);
  const dist = (Number.isFinite(mp) && price > 0) ? (mp - price) / price * 100 : null;
  const pcOI = Number(s.putCallOI);
  const pcVol = Number(s.putCallVol);
  const pcTone = (v) => Number.isFinite(v) ? (v >= 1.2 ? "warn" : v <= 0.7 ? "up" : "") : "";
  const kfmt = (n) => { n = Number(n) || 0; return n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K` : `${n}`; };
  const em = Number(s.expectedMovePct);
  const grid = aiMetricGrid([
    { label: "예상 변동폭", value: Number.isFinite(em) ? `±${em.toFixed(1)}%` : "—",
      detail: s.expiry ? `만기 ${escapeHtml(String(s.expiry).slice(5))}까지` : "" },
    { label: "맥스페인", value: Number.isFinite(mp) ? `$${mp.toLocaleString(undefined, { maximumFractionDigits: 1 })}` : "—",
      detail: dist != null ? `현재가 대비 ${dist > 0 ? "+" : ""}${dist.toFixed(1)}%` : "" },
    { label: "풋/콜 (미결제)", value: Number.isFinite(pcOI) ? pcOI.toFixed(2) : "—", tone: pcTone(pcOI),
      detail: Number.isFinite(pcOI) ? (pcOI >= 1 ? "풋 우위" : "콜 우위") : "" },
    { label: "풋/콜 (거래량)", value: Number.isFinite(pcVol) ? pcVol.toFixed(2) : "—", tone: pcTone(pcVol) },
    { label: "미결제약정", value: `${kfmt(s.callOI)} C / ${kfmt(s.putOI)} P` },
  ]);
  const note = `<p style="font-size:var(--fs-cap);color:var(--muted);margin:10px 0 0;line-height:1.65">최근접 만기 ${escapeHtml(s.expiry || "")} 기준. 예상 변동폭=등가격 스트래들 프리미엄이 시사하는 만기까지의 ±변동 크기(만기가 가까우면 작습니다). 맥스페인=만기에 옵션 매수자 총손실이 최대가 되는 행사가(‘주가가 그쪽으로 끌린다’는 속설은 논쟁적). 풋/콜은 헤지·방향성 베팅이 섞인 심리 지표입니다. 예측·매매 신호가 아닙니다. 출처: Yahoo.</p>`;
  return aiModePanel("옵션 심리", `풋/콜 · 맥스페인 · 만기 ${escapeHtml(s.expiry || "")}`, grid + note);
}

// 연방 계약(USASpending) — 정부 매출이 큰 종목만. 최근 12개월 prime award 규모·건수.
// 계약 '사실'이지 예측·매매 신호가 아니다(참고용 alt-data).
function aiFederalContractsPanel(item) {
  const fc = window.FEDERAL_CONTRACTS;
  if (!fc || !fc.stocks || !item || !item.ticker) return "";
  const s = fc.stocks[String(item.ticker).toUpperCase()];
  if (!s || !(Number(s.total) > 0)) return "";
  const usd = (n) => { n = Number(n) || 0; return n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(0)}M` : `$${n.toLocaleString()}`; };
  const approx = !!s.approx;
  const grid = aiMetricGrid([
    { label: "연방 집행액", value: usd(s.total), detail: approx ? "최근 12개월 · 근사" : "최근 12개월" },
    { label: "최대 단일 집행", value: usd(s.top) },
    { label: "집행 건수", value: `${(Number(s.count) || 0).toLocaleString()}${approx ? "+" : ""}건` },
  ]);
  const note = `<p style="font-size:var(--fs-cap);color:var(--muted);margin:10px 0 0;line-height:1.65">USASpending.gov 계약(A/B/C/D) 트랜잭션의 <b>실제 집행액(obligation)</b> 합입니다. 다년 계약 상한이 아니라 그 기간에 집행된 금액이며, 금액 큰 순 상위만 합산해 총액은 근사치입니다. 정부라는 '고객'의 규모를 보여주는 참고용 대체 데이터로 예측·매매 신호가 아닙니다. 기간 ${escapeHtml(fc.windowStart || "")}~${escapeHtml(fc.windowEnd || "")}.</p>`;
  return aiModePanel("연방 계약", "USASpending · 최근 12개월 집행액", grid + note);
}

function renderAiModeDataBoard(item) {
  return `
    <div class="ai-mode-data-board">
      ${aiTechnicalPanel(item)}
      ${aiSnowflakePanel(item)}
      ${aiDcfPanel(item)}
      ${aiFactorPanel(item)}
      ${aiRiskPanel(item)}
      ${aiPeerPanel(item)}
      ${aiFundamentalPanel(item)}
      ${aiAnalystPanel(item)}
      ${aiDividendPanel(item)}
      ${aiFinancialsPanel(item)}
      ${aiNewsPanel(item)}
      ${aiEventsPanel(item)}
      ${aiKrEventsPanel(item)}
      ${aiSectorPanel(item)}
      ${aiInsiderPanel(item)}
      ${aiCongressPanel(item)}
      ${aiInstitutionalPanel(item)}
      ${aiShortInterestPanel(item)}
      ${aiShortVolumePanel(item)}
      ${aiOptionsPanel(item)}
      ${aiFederalContractsPanel(item)}
      ${aiEarningsPanel(item)}
      ${aiDataQualityPanel(item)}
    </div>
  `;
}

function aiChartRangeBarCount(total, state) {
  const dailyMap = { "1M": 22, "3M": 66, "6M": 132, "1Y": 252, "5Y": 1260 };
  const div = state.barTf === "W" ? 5 : (state.barTf === "M" ? 21 : 1);
  const want = Math.round((dailyMap[state.range] || total) / div);
  return Math.min(total, Math.max(10, want));
}

function aiChartWindowInfo(item, state) {
  const allRows = resampleBars(getChartRows(item), state.barTf);
  const rangeSize = aiChartRangeBarCount(allRows.length, state);
  const base = allRows.slice(-rangeSize);
  const windowSize = Math.max(12, Math.floor(base.length / state.zoom));
  const maxOffset = Math.max(0, base.length - windowSize);
  state.offset = Math.min(state.offset, maxOffset);
  return { total: base.length, windowSize, maxOffset };
}

function aiSetZoomAnchored(item, state, frac, requestedZoom) {
  const info = aiChartWindowInfo(item, state);
  const minWindow = Math.min(12, Math.max(1, info.total));
  const oldWindow = Math.max(minWindow, Math.floor(info.total / state.zoom));
  const oldStart = Math.max(0, info.total - state.offset - oldWindow);
  const anchor = oldStart + frac * (oldWindow - 1);
  const newZoom = Math.min(40, Math.max(1, requestedZoom));
  const newWindow = Math.max(minWindow, Math.floor(info.total / newZoom));
  let newStart = Math.round(anchor - frac * (newWindow - 1));
  newStart = Math.max(0, Math.min(Math.max(0, info.total - newWindow), newStart));
  state.zoom = newZoom;
  state.offset = Math.max(0, info.total - newWindow - newStart);
}

function drawAiWidgetChart(item, svg, state, metaEl) {
  if (!item || !svg || !state) return;
  const prevState = chartState;
  const prevCompare = compareTickers;
  const prevGeom = lastChartGeom;
  try {
    chartState = state;
    compareTickers = [];
    drawChart(item, { svgElement: svg });
  } finally {
    chartState = prevState;
    compareTickers = prevCompare;
    lastChartGeom = prevGeom;
  }
  const info = aiChartWindowInfo(item, state);
  if (metaEl) {
    metaEl.textContent = `${state.range} · ${info.windowSize}봉 표시 · 휠 확대/축소 · 드래그 이동`;
  }

  // 크로스헤어 트래커 바인딩
  if (svg.dataset.crosshairBound !== "true") {
    svg.dataset.crosshairBound = "true";
    let guideLine = null;
    let tooltip = null;

    const removeCrosshair = () => {
      if (guideLine) { guideLine.remove(); guideLine = null; }
      if (tooltip) { tooltip.remove(); tooltip = null; }
    };

    const updateCrosshair = (event) => {
      const rect = svg.getBoundingClientRect();
      const g = priceChartGeom();
      
      const vbAttr = svg.getAttribute("viewBox") || "0 0 860 520";
      const vbTokens = vbAttr.split(" ");
      const vbWidth = parseFloat(vbTokens[2]) || g.width;
      const vbHeight = parseFloat(vbTokens[3]) || 520;
      
      const clientX = event.touches ? event.touches[0].clientX : event.clientX;
      const clientY = event.touches ? event.touches[0].clientY : event.clientY;
      
      const vbX = ((clientX - rect.left) / Math.max(1, rect.width)) * vbWidth;
      const vbY = ((clientY - rect.top) / Math.max(1, rect.height)) * vbHeight;

      const padL = g.padL;
      const padR = g.padR;
      const plotW = vbWidth - padL - padR;

      if (vbX < padL || vbX > vbWidth - padR) {
        removeCrosshair();
        return;
      }

      // visibleBars 직접 역추출
      const allRows = resampleBars(getChartRows(item), state.barTf);
      const rangeSize = aiChartRangeBarCount(allRows.length, state);
      const base = allRows.slice(-rangeSize);
      const windowSize = Math.max(12, Math.floor(base.length / state.zoom));
      const offset = state.offset;
      const visibleBars = base.slice(base.length - offset - windowSize, base.length - offset);

      if (!visibleBars || visibleBars.length === 0) return;

      const frac = Math.max(0, Math.min(1, (vbX - padL) / plotW));
      const barIdx = Math.min(visibleBars.length - 1, Math.floor(frac * visibleBars.length));
      const targetBar = visibleBars[barIdx];
      if (!targetBar) return;

      const targetX = padL + (barIdx + 0.5) * (plotW / visibleBars.length);

      // 세로선 그리기
      if (!guideLine) {
        guideLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        guideLine.setAttribute("class", "chart-crosshair-line");
        guideLine.setAttribute("y1", "0");
        guideLine.setAttribute("y2", vbHeight.toString());
        svg.appendChild(guideLine);
      }
      guideLine.setAttribute("x1", targetX.toString());
      guideLine.setAttribute("x2", targetX.toString());

      // 툴팁 박스 그리기
      if (!tooltip) {
        tooltip = document.createElementNS("http://www.w3.org/2000/svg", "g");
        tooltip.setAttribute("class", "chart-tooltip-box");
        tooltip.innerHTML = `
          <rect width="135" height="58" rx="8" fill="rgba(15,23,42,0.9)" />
          <text x="10" y="18" fill="#fff" font-size="10.5" font-weight="600" class="tip-date"></text>
          <text x="10" y="34" fill="#10b981" font-size="11.5" font-weight="700" class="tip-price"></text>
          <text x="10" y="47" fill="#c084fc" font-size="9" class="tip-volume"></text>
        `;
        svg.appendChild(tooltip);
      }

      // 바는 {o,h,l,c,v,d} 구조다 — .close/.volume/.time 으로 읽으면 항상 0/빈값이 나온다.
      const priceVal = isKrMarket() ? `${parseFloat(targetBar.c || 0).toLocaleString()}원` : `$${parseFloat(targetBar.c || 0).toFixed(2)}`;
      const volVal = `거래량: ${parseFloat(targetBar.v || 0).toLocaleString()}`;

      tooltip.querySelector(".tip-date").textContent = targetBar.d || "";
      tooltip.querySelector(".tip-price").textContent = `종가: ${priceVal}`;
      tooltip.querySelector(".tip-volume").textContent = volVal;

      let tooltipX = targetX + 15;
      if (tooltipX + 135 > vbWidth) {
        tooltipX = targetX - 150;
      }
      let tooltipY = vbY - 26;
      if (tooltipY < 8) tooltipY = 8;
      if (tooltipY + 58 > vbHeight) tooltipY = vbHeight - 66;

      tooltip.setAttribute("transform", `translate(${tooltipX}, ${tooltipY})`);
    };

    svg.addEventListener("pointermove", updateCrosshair);
    svg.addEventListener("pointerleave", removeCrosshair);
    svg.addEventListener("pointerup", removeCrosshair);
  }
}

function toggleAiWidgetFullscreen(widget) {
  const isModal = widget.classList.contains("is-fullscreen-modal");
  
  if (isModal) {
    widget.classList.remove("is-fullscreen-modal");
    const overlay = document.querySelector(".ai-modal-overlay");
    if (overlay) overlay.remove();
  } else {
    const overlay = document.createElement("div");
    overlay.className = "ai-modal-overlay";
    document.body.appendChild(overlay);
    
    widget.classList.add("is-fullscreen-modal");
    
    // 오버레이 클릭 시 닫기
    overlay.addEventListener("click", () => {
      widget.classList.remove("is-fullscreen-modal");
      overlay.remove();
    });
  }
}

async function exportWidgetAsImage(widget, ticker) {
  const shareBtn = widget.querySelector(".widget-share-btn");
  const prevText = shareBtn ? shareBtn.textContent : "공유";
  
  if (shareBtn) {
    shareBtn.textContent = "캡처 중...";
    shareBtn.disabled = true;
  }
  
  try {
    // 1. html2canvas 동적 로딩 — 로컬 벤더 사본(assets/vendor) 우선, 실패 시 CDN 폴백.
    // CDN 단독이던 시절엔 오프라인·차단망에서 캡처가 통째로 죽었다. stamp_build_id.py
    // 의 ?v= 재작성은 HTML 정적 참조만 대상이라(동적 로딩은 대상 밖), 여기는 라이브러리
    // 버전 고정 쿼리를 쓴다 — 파일 내용이 버전과 함께만 바뀌므로 캐시 무효화에 충분하다.
    if (!window.html2canvas) {
      const loadScript = (src, cross) => new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        if (cross) script.crossOrigin = "anonymous";
        script.onload = resolve;
        script.onerror = () => { script.remove(); reject(new Error(`load failed: ${src}`)); };
        document.head.appendChild(script);
      });
      try {
        await loadScript("assets/vendor/html2canvas.min.js?v=1.4.1");
      } catch (_) {
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js", true)
          .catch(() => { throw new Error("캡처 라이브러리를 로드하지 못했습니다."); });
      }
      if (!window.html2canvas) throw new Error("캡처 라이브러리를 로드하지 못했습니다.");
    }
    
    // SVG 가이드라인 충돌 제거
    const crosshair = widget.querySelector(".chart-crosshair-line");
    const tooltip = widget.querySelector(".chart-tooltip-box");
    if (crosshair) crosshair.remove();
    if (tooltip) tooltip.remove();
    
    // 2. 캔버스 캡처 실행 (다크/라이트 모드 배경 보정)
    const isLight = document.body.getAttribute("data-theme") === "light";
    const bgColor = isLight ? "#ffffff" : "#0f172a";
    
    const canvas = await window.html2canvas(widget, {
      backgroundColor: bgColor,
      scale: 2, // 고해상도 2배 출력
      useCORS: true,
      logging: false,
      ignoreElements: (el) => {
        return el.classList.contains("ai-widget-chart-tools") || el.classList.contains("widget-assembly-overlay");
      }
    });
    
    // 3. 파일 다운로드 실행
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().substring(0, 10).replace(/-/g, "");
    link.download = `mir_ai_report_${ticker}_${dateStr}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
  } catch (err) {
    showAppToast("이미지 캡처 중 오류가 발생했습니다: " + err.message, 3200);
  } finally {
    if (shareBtn) {
      shareBtn.textContent = prevText;
      shareBtn.disabled = false;
    }
  }
}

function setupAiWidgetChartControls(widget, item, state) {
  const svg = widget.querySelector(".ai-widget-chart");
  const meta = widget.querySelector(".ai-widget-chart-meta");
  const render = () => drawAiWidgetChart(item, svg, state, meta);

  // 지표 설정 드롭다운 토글 및 외부 클릭 감지
  const dropdownTrigger = widget.querySelector(".ai-dropdown-trigger-btn");
  const dropdownMenu = widget.querySelector(".ai-indicators-dropdown");
  
  if (dropdownTrigger && dropdownMenu) {
    dropdownTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle("is-open");
    });

    // 외부 클릭 닫기는 위임 리스너 1개로 — 위젯이 만들어질 때마다 document 에
    // 리스너를 더하면 사라진 위젯의 메뉴 참조가 계속 쌓인다.
    if (!setupAiWidgetChartControls._outsideBound) {
      setupAiWidgetChartControls._outsideBound = true;
      document.addEventListener("click", (e) => {
        document.querySelectorAll(".ai-indicators-dropdown.is-open").forEach((menu) => {
          if (!menu.contains(e.target) && !e.target.closest(".ai-dropdown-trigger-btn")) {
            menu.classList.remove("is-open");
          }
        });
      });
    }
  }

  // 지표 체크박스 바인딩
  widget.querySelectorAll(".ai-indicators-dropdown input[type='checkbox']").forEach((cb) => {
    cb.addEventListener("change", () => {
      const type = cb.dataset.indicator;
      const active = cb.checked;
      
      if (type === "sma") {
        state.showSma20 = active;
        state.showSma60 = active;
      } else if (type === "volume") {
        state.showVolume = active;
      } else if (type === "rsi") {
        state.showRsi = active;
      } else if (type === "trendlines") {
        state.showTrendlines = active;
      } else if (type === "support") {
        state.showSupportResistance = active;
      } else if (type === "patterns") {
        state.showPatterns = active;
      } else if (type === "levels") {
        state.showTechLevels = active;
      }
      render();
    });
  });

  widget.querySelectorAll("[data-ai-chart-range]").forEach((button) => {
    button.addEventListener("click", () => {
      state.range = button.dataset.aiChartRange || "1Y";
      state.zoom = 1;
      state.offset = 0;
      widget.querySelectorAll("[data-ai-chart-range]").forEach((item) => item.classList.toggle("is-active", item === button));
      render();
    });
  });

  widget.querySelectorAll("[data-ai-chart-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.aiChartAction;
      const info = aiChartWindowInfo(item, state);
      if (action === "zoom-in") aiSetZoomAnchored(item, state, 0.5, state.zoom * 1.35);
      else if (action === "zoom-out") aiSetZoomAnchored(item, state, 0.5, state.zoom / 1.35);
      else if (action === "pan-left") state.offset = Math.min(info.maxOffset, state.offset + Math.max(5, Math.round(12 / state.zoom)));
      else if (action === "pan-right") state.offset = Math.max(0, state.offset - Math.max(5, Math.round(12 / state.zoom)));
      else if (action === "reset") { state.zoom = 1; state.offset = 0; }
      else if (action === "fullscreen") toggleAiWidgetFullscreen(widget);
      else if (action === "share") exportWidgetAsImage(widget, item.ticker);
      render();
    });
  });

  if (!svg) return;
  
  // 더블클릭 뷰 리셋 제스처
  svg.addEventListener("dblclick", (e) => {
    e.preventDefault();
    state.zoom = 1;
    state.offset = 0;
    render();
  });
  svg.addEventListener("wheel", (event) => {
    event.preventDefault();
    const rect = svg.getBoundingClientRect();
    const g = priceChartGeom();
    const vbX = ((event.clientX - rect.left) / Math.max(1, rect.width)) * g.width;
    const plotW = g.width - g.padL - g.padR;
    const frac = Math.max(0, Math.min(1, (vbX - g.padL) / plotW));
    aiSetZoomAnchored(item, state, frac, event.deltaY < 0 ? state.zoom * 1.2 : state.zoom / 1.2);
    render();
  }, { passive: false });

  let dragPointerId = null;
  let startX = 0;
  let startOffset = 0;
  let dragInfo = null;
  let dragPlotPx = 1;
  let raf = 0;
  const schedule = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      render();
    });
  };

  svg.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragPointerId = event.pointerId;
    startX = event.clientX;
    startOffset = state.offset;
    dragInfo = aiChartWindowInfo(item, state);
    const rect = svg.getBoundingClientRect();
    const g = priceChartGeom();
    dragPlotPx = rect.width * ((g.width - g.padL - g.padR) / g.width);
    svg.classList.add("is-dragging");
    try { svg.setPointerCapture(event.pointerId); } catch (e) { /* ignore */ }
    event.preventDefault();
  });

  svg.addEventListener("pointermove", (event) => {
    if (dragPointerId == null || event.pointerId !== dragPointerId || !dragInfo) return;
    const dx = event.clientX - startX;
    const barsPerPx = dragInfo.windowSize / Math.max(1, dragPlotPx);
    let next = Math.round(startOffset + dx * barsPerPx);
    next = Math.max(0, Math.min(dragInfo.maxOffset, next));
    if (next !== state.offset) {
      state.offset = next;
      schedule();
    }
    event.preventDefault();
  });

  const endDrag = (event) => {
    if (dragPointerId == null || event.pointerId !== dragPointerId) return;
    dragPointerId = null;
    dragInfo = null;
    svg.classList.remove("is-dragging");
    try { svg.releasePointerCapture(event.pointerId); } catch (e) { /* ignore */ }
    render();
  };
  svg.addEventListener("pointerup", endDrag);
  svg.addEventListener("pointercancel", endDrag);
}

// ===== AI 모드: 상승확률(MirProb) 히어로 & 시각화 헬퍼 =====
let aiProbHorizon = 20; // 5=1주, 20=1개월, 60=3개월

// 5년 일봉이 있으면 차트 확률 엔진으로 정밀 분석, 없으면 스냅샷 지표로 간이 추정.
async function computeAiProbability(item, horizon) {
  const hz = horizon || aiProbHorizon;
  const rows = getChartRows(item);
  const quick = () => {
    const q = scanQuickProb(item, hz);
    return { fallback: true, headlineUp: q.up, horizon: hz, signals: [], patterns: [] };
  };
  if (!window.MirProb || !window.MirProb.analyzeRows || !Array.isArray(rows) || rows.length < 60) {
    return quick();
  }
  try {
    await Promise.all([
      window.MirProb.ensureStats ? window.MirProb.ensureStats() : Promise.resolve(),
      (typeof ensureAnalysisFeatureData === "function" ? ensureAnalysisFeatureData() : Promise.resolve()),
    ]);
    const result = window.MirProb.analyzeRows(rows, hz, {
      ticker: item.ticker, company: item.company, statsMode: "population",
    });
    if (!result || result.error) return quick();
    return result;
  } catch (e) {
    return quick();
  }
}

// 270° 원형 게이지 SVG. CSS 애니메이션(aiGaugeSweep)으로 아크가 그려진다.
function aiRadialGauge(pct, opts = {}) {
  const size = opts.size || 176;
  const stroke = opts.stroke || 15;
  const r = (size - stroke) / 2 - 2;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const track = circ * 0.75;                       // 270° 아크
  const val = Math.max(0, Math.min(100, Number(pct) || 0));
  const filled = track * (val / 100);
  const color = scanProbColor(val);
  const rot = 135;                                 // 하단 중앙에 갭
  return `
    <svg class="ai-gauge" viewBox="0 0 ${size} ${size}" role="img" aria-label="상승확률 ${Math.round(val)}%">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" style="stroke:var(--line)" stroke-width="${stroke}"
        stroke-dasharray="${track.toFixed(1)} ${circ.toFixed(1)}" stroke-linecap="round"
        transform="rotate(${rot} ${cx} ${cy})"/>
      <circle class="ai-gauge-fill" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke-width="${stroke}"
        stroke-dasharray="${filled.toFixed(1)} ${circ.toFixed(1)}" stroke-linecap="round"
        style="stroke:${color};--gauge-dash:${filled.toFixed(1)}" transform="rotate(${rot} ${cx} ${cy})"/>
      <text x="${cx}" y="${cy - 2}" class="ai-gauge-num" text-anchor="middle" style="fill:${color}">${Math.round(val)}<tspan class="ai-gauge-pct">%</tspan></text>
      <text x="${cx}" y="${cy + 22}" class="ai-gauge-cap" text-anchor="middle">상승확률</text>
    </svg>`;
}

function aiProbStat(label, value, detail, tone) {
  return `<article class="ai-prob-stat">
      <span>${escapeHtml(label)}</span>
      <strong class="${tone || ""}">${escapeHtml(String(value))}</strong>
      <em>${escapeHtml(detail || "")}</em>
    </article>`;
}

function aiSignalBar(s) {
  const dir = Math.max(-1, Math.min(1, Number(s.dir) || 0));
  const pct = Math.round(Math.abs(dir) * 100);
  const bull = dir >= 0;
  return `<div class="ai-sig-row" title="${escapeHtml(s.detail || "")}">
      <span class="ai-sig-label">${escapeHtml(s.label || "신호")}</span>
      <span class="ai-sig-track"><span class="ai-sig-fill ${bull ? "is-bull" : "is-bear"}" style="width:${pct}%"></span></span>
      <span class="ai-sig-dir ${bull ? "pos" : "neg"}">${bull ? "▲" : "▼"}</span>
    </div>`;
}

function aiProbabilityHero(result) {
  const up = Math.round(result.headlineUp ?? 50);
  const color = scanProbColor(up);
  const verdict = (window.MirProb && window.MirProb.verdictText) ? window.MirProb.verdictText(up) : scanVerdict(up);
  const hz = result.horizon || aiProbHorizon;
  const hzLabel = hz <= 5 ? "1주" : hz >= 60 ? "3개월" : "1개월";
  const base = result.base;
  const consensus = result.consensus ? Math.round(result.consensus.up) : null;

  const stats = [];
  if (consensus != null) stats.push(aiProbStat("신호 합의", `${consensus}%`, "기술 지표 종합"));
  if (base && base.samples) stats.push(aiProbStat("과거 실측", `${Math.round(base.upProb)}%`, `유사 ${base.samples}회`));
  if (result.adxVal != null) stats.push(aiProbStat("추세 강도", result.adxVal.toFixed(0), "ADX"));

  const analog = base && base.samples ? `
    <div class="ai-prob-analog">
      <div class="ai-prob-analog-head">지금 차트, 과거엔 어땠나 <span>지난 5년 · ${hzLabel} 뒤</span></div>
      <p>지금과 비슷했던 <b>${base.samples}회</b> 중
         <b style="color:${scanProbColor(base.upProb)}">${Math.round(base.upProb)}%</b>가 ${hzLabel} 뒤 상승했어요.</p>
      <div class="ai-prob-analog-grid">
        <div><span>평균</span><b class="${cls(base.avgReturn)}">${base.avgReturn >= 0 ? "+" : ""}${base.avgReturn.toFixed(1)}%</b></div>
        <div><span>최고</span><b class="pos">+${base.best.toFixed(0)}%</b></div>
        <div><span>최저</span><b class="neg">${base.worst.toFixed(0)}%</b></div>
      </div>
    </div>` : (result.fallback ? `<div class="ai-prob-analog is-lite"><p class="muted">5년 일봉이 부족해 스냅샷 지표로 간이 추정했습니다.</p></div>` : "");

  const signals = (result.signals || []).slice()
    .sort((a, b) => Math.abs(b.dir * b.weight) - Math.abs(a.dir * a.weight)).slice(0, 5);
  const signalBars = signals.length
    ? `<div class="ai-prob-signals"><div class="ai-prob-sub-head">핵심 신호</div>${signals.map(aiSignalBar).join("")}</div>`
    : "";

  const pats = (result.patterns || []).slice(0, 6);
  const patChips = pats.length ? `<div class="ai-prob-patterns">${pats.map((p) => {
    const d = Number(p.nominalDir) || 0;
    const when = p.barsAgo === 0 ? "오늘 확정" : `${p.barsAgo || 0}봉 전 확정`;
    return `<span class="ai-pat-chip ${d > 0 ? "is-bull" : d < 0 ? "is-bear" : ""}" title="${escapeHtml(when)}">${escapeHtml(p.label || p.pattern)}</span>`;
  }).join("")}</div>` : "";

  return `
    <section class="ai-prob-hero" style="--prob-color:${color}">
      <div class="ai-prob-gauge-col">
        ${aiRadialGauge(up)}
        <div class="ai-prob-verdict" style="color:${color}">${escapeHtml(verdict)}</div>
        <div class="ai-prob-hznote">${hzLabel} 기준 종합 추정${result.fallback ? " · 간이" : ""}</div>
      </div>
      <div class="ai-prob-detail">
        <div class="ai-prob-stats">${stats.join("")}</div>
        ${analog}
        ${signalBars}
        ${patChips}
      </div>
    </section>`;
}

function aiProbSkeleton() {
  return `
    <div class="ai-prob-skeleton">
      <div class="ai-prob-skel-gauge shimmer-loading"></div>
      <div class="ai-prob-skel-lines">
        <div class="shimmer-loading shimmer-line mid"></div>
        <div class="shimmer-loading shimmer-line"></div>
        <div class="shimmer-loading shimmer-line short"></div>
        <div class="shimmer-loading shimmer-line mid"></div>
      </div>
    </div>`;
}

// 블록을 Claude 웹처럼 순차적으로 blur-in 리빌.
function revealAiBlocksStaggered(container, step = 130) {
  if (!container) return;
  const blocks = Array.from(container.querySelectorAll(".ai-block.animate-reveal"));
  blocks.forEach((block, index) => {
    setTimeout(() => block.classList.add("reveal-active"), index * step);
  });
}

async function renderInlineStockWidget(ticker, parentBubble) {
  const base = stockByTicker(ticker) || data.stocks.find((row) => row.ticker === ticker);
  if (!base) return;
  const initialItem = applyLive(withDetail(base));
  const itemPromise = ensureAiWidgetStock(ticker);
  
  const widgetId = "widget_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  
  const widgetContainer = document.createElement("div");
  widgetContainer.className = "chat-msg-widget ai-chart-widget";
  widgetContainer.id = widgetId;
  
  widgetContainer.innerHTML = `
    <div class="widget-assembly-overlay">
      <div class="ai-assembly-orb">
        <span class="ai-orb-core"></span>
        <span class="ai-orb-ring"></span>
        <span class="ai-orb-ring is-2"></span>
      </div>
      <p class="widget-status" id="status_${widgetId}">${escapeHtml(initialItem.company)} 투자 데이터를 모으는 중...</p>
      <div class="ai-assembly-track"><span class="ai-assembly-track-fill"></span></div>
    </div>
    <div class="widget-content-grid" id="grid_${widgetId}" style="opacity: 0; display: none; transition: opacity 0.5s ease-in-out;">
      <div class="ai-prob-host ai-block animate-reveal" id="prob_${widgetId}"></div>
      <div class="widget-chart-box ai-block animate-reveal">
        <div class="ai-widget-chart-head">
          <div>
            <strong>${escapeHtml(initialItem.company)} <span>${escapeHtml(initialItem.ticker)}</span></strong>
            <small class="ai-widget-chart-meta">차트 준비 중</small>
          </div>
          <div class="ai-widget-chart-tools" aria-label="AI 차트 조작">
            <div class="ai-dropdown-wrapper">
              <button type="button" class="ai-dropdown-trigger-btn" title="차트 분석 레이어 설정">지표 설정 </button>
              <div class="ai-indicators-dropdown">
                <label><input type="checkbox" data-indicator="trendlines" checked> 자동 추세선</label>
                <label><input type="checkbox" data-indicator="support" checked> 지지/저항선</label>
                <label><input type="checkbox" data-indicator="patterns" checked> 차트 패턴</label>
                <label><input type="checkbox" data-indicator="levels" checked> 매물대 가이드</label>
                <label><input type="checkbox" data-indicator="sma" checked> 이동평균선</label>
                <label><input type="checkbox" data-indicator="volume" checked> 거래량 차트</label>
                <label><input type="checkbox" data-indicator="rsi" checked> RSI 보조지표</label>
              </div>
            </div>
            <span style="border-left:1px solid rgba(255,255,255,0.1);height:14px;margin:0 4px;"></span>
            <button type="button" data-ai-chart-range="5Y">5Y</button>
            <button type="button" class="is-active" data-ai-chart-range="1Y">1Y</button>
            <button type="button" data-ai-chart-range="6M">6M</button>
            <button type="button" data-ai-chart-range="3M">3M</button>
            <button type="button" data-ai-chart-range="1M">1M</button>
            <button type="button" data-ai-chart-action="pan-left" title="이전 구간">‹</button>
            <button type="button" data-ai-chart-action="zoom-out" title="축소">−</button>
            <button type="button" data-ai-chart-action="zoom-in" title="확대">+</button>
            <button type="button" data-ai-chart-action="pan-right" title="다음 구간">›</button>
            <button type="button" data-ai-chart-action="reset" title="초기화">Reset</button>
            <button type="button" data-ai-chart-action="fullscreen" title="풀스크린 분석" class="fullscreen-toggle-btn">⤢</button>
            <button type="button" class="widget-share-btn" data-ai-chart-action="share" title="리포트 이미지 저장">공유</button>
          </div>
        </div>
        <svg id="chart_${widgetId}" class="ai-widget-chart" viewBox="0 0 860 520" role="img" aria-label="${escapeHtml(stockLabel(initialItem))} interactive chart"></svg>
        <p class="ai-widget-chart-hint">마우스 휠로 확대/축소하고, 차트를 좌우로 드래그해서 구간을 이동할 수 있습니다.</p>
      </div>
      <div class="widget-info-grid">
        <div class="ai-evidence-grid ai-block animate-reveal" id="evidence_${widgetId}"></div>
        <div class="ai-mode-data-host ai-block animate-reveal" id="modeData_${widgetId}"></div>
        <div class="widget-facts ai-block animate-reveal">
          <h4>핵심 투자 지표</h4>
          <div id="facts_${widgetId}"></div>
        </div>
        <div class="widget-news ai-block animate-reveal">
          <h4>관련 최신 소식</h4>
          <div id="news_${widgetId}" class="widget-news-list"></div>
        </div>
      </div>
    </div>
  `;
  
  parentBubble.appendChild(widgetContainer);
  
  const log = byId("aiChatLog");
  
  const statusLabel = byId("status_" + widgetId);
  const overlay = widgetContainer.querySelector(".widget-assembly-overlay");
  const grid = byId("grid_" + widgetId);
  
  // Step-by-step assembly animation inline
  setTimeout(() => {
    if (statusLabel) statusLabel.textContent = "가격 이력과 보조지표를 불러오는 중...";
  }, 400);
  
  setTimeout(() => {
    if (statusLabel) statusLabel.textContent = "차트 확대/이동 컨트롤을 연결하는 중...";
  }, 800);
  
  setTimeout(() => {
    if (statusLabel) statusLabel.textContent = "실시간 뉴스와 핵심 지표를 정리하는 중...";
  }, 1200);
  
  setTimeout(async () => {
    const item = await itemPromise || initialItem;
    // Fade out overlay
    if (overlay) overlay.style.opacity = "0";
    
    setTimeout(() => {
      if (overlay) overlay.style.display = "none";
      if (grid) {
        grid.style.display = "grid";
        // Force reflow
        grid.offsetHeight;
        grid.style.opacity = "1";
      }

      // 상승확률 히어로: 먼저 스켈레톤을 보여주고, 분석이 끝나면 교체(Claude 웹 스타일).
      const probContainer = byId("prob_" + widgetId);
      if (probContainer) {
        probContainer.innerHTML = aiProbSkeleton();
      }

      // Render components inside the bubble!
      const factsContainer = byId("facts_" + widgetId);
      if (factsContainer) {
        factsContainer.innerHTML = stockFacts(item, "AI Mode");
      }

      const evidenceContainer = byId("evidence_" + widgetId);
      if (evidenceContainer) {
        evidenceContainer.innerHTML = renderAiEvidenceGrid(item);
      }

      const modeDataContainer = byId("modeData_" + widgetId);
      if (modeDataContainer) {
        modeDataContainer.innerHTML = renderAiModeDataBoard(item);
      }
      
      const newsContainer = byId("news_" + widgetId);
      if (newsContainer) {
        if (item.news && item.news.length > 0) {
          newsContainer.innerHTML = item.news.slice(0, 3).map(n => `
            <div class="widget-news-item">
              <a href="${escapeHtml(n.url || "#")}" target="_blank" rel="noopener">${escapeHtml(n.title)}</a>
              <small>${escapeHtml(n.source)} · ${escapeHtml(n.time || "")}</small>
            </div>
          `).join("");
        } else {
          newsContainer.innerHTML = `<p class="muted font-small">최근 뉴스 정보가 없습니다.</p>`;
        }
      }
      
      // Draw interactive SVG price chart inside bubble!
      const chartSvg = byId("chart_" + widgetId);
      if (chartSvg) {
        const aiState = createAiChartState();
        drawAiWidgetChart(item, chartSvg, aiState, widgetContainer.querySelector(".ai-widget-chart-meta"));
        setupAiWidgetChartControls(widgetContainer, item, aiState);
      }
      
      // Reveal widget (차트 레이어 애니메이션 트리거) + 블록을 순차 blur-in.
      widgetContainer.classList.add("reveal-active");
      revealAiBlocksStaggered(widgetContainer);

      // 상승확률 분석은 무겁게 걸릴 수 있어 리빌을 막지 않고 끝나면 스켈레톤을 교체한다.
      computeAiProbability(item).then((probResult) => {
        if (!probContainer || !probContainer.isConnected) return;
        probContainer.innerHTML = aiProbabilityHero(probResult);
        probContainer.classList.add("is-loaded");
      }).catch(() => { /* 실패 시 스켈레톤 유지 */ });
    }, 400);
  }, 1600);
}

// ===== JARVIS 종목 대시보드 (AI 모드) =====
// 티커 입력 시 배경 차트(ai-cosmos morph) 위로 종목 카드·투자의견·핵심근거·
// 기관/내부자/의회/공매도/실적·뉴스 패널이 페이드인한다. 모든 데이터는 사이트에 이미 있는 것을 재사용.
let aiDashSeq = 0;
// 차트 영역 폭이 바뀐 뒤 cosmos 캔버스를 새 크기에 맞춰 다시 그린다(여러 번 호출로 확실히).
function aiCosmosRelayoutSoon() {
  const relayout = () => { try { window.MirCosmos?.relayout?.(); } catch (_) {} };
  requestAnimationFrame(relayout);
  setTimeout(relayout, 200);
}
// ===== 4구역 드래그 리사이즈 =====
// 좌/우 열 폭과 하단 행 높이를 CSS 커스텀 프로퍼티(--ai-left-w/--ai-right-w/--ai-bottom-h)로
// 조절한다. 중앙(차트)은 1fr 트랙이라 좌/우가 커지면 자연히 줄고, 하단이 커지면 위 행이 준다.
// 크기는 localStorage 에 저장돼 재진입에도 유지, 핸들 더블클릭으로 해당 축만 초기화한다.
const AI_DASH_LS_KEY = "mir_ai_dash_layout";
const AI_DASH_DEFAULTS = { left: 264, right: 352, bottomPct: 40 };
const AI_DASH_CLAMP = { leftMin: 180, leftMax: 420, rightMin: 240, rightMax: 520, bottomMin: 20, bottomMax: 70 };
function aiDashClampNum(v, min, max, dflt) {
  v = Number(v);
  if (!Number.isFinite(v)) return dflt;
  return Math.min(max, Math.max(min, v));
}
function readAiDashLayout() {
  const s = window.safeStorage.getJSON(AI_DASH_LS_KEY, {}) || {};
  return {
    left: aiDashClampNum(s.left, AI_DASH_CLAMP.leftMin, AI_DASH_CLAMP.leftMax, AI_DASH_DEFAULTS.left),
    right: aiDashClampNum(s.right, AI_DASH_CLAMP.rightMin, AI_DASH_CLAMP.rightMax, AI_DASH_DEFAULTS.right),
    bottomPct: aiDashClampNum(s.bottomPct, AI_DASH_CLAMP.bottomMin, AI_DASH_CLAMP.bottomMax, AI_DASH_DEFAULTS.bottomPct),
  };
}
function writeAiDashLayout(l) {
  window.safeStorage.setJSON(AI_DASH_LS_KEY, l);
}
function applyAiDashLayout(l) {
  const s = document.body.style;
  s.setProperty("--ai-left-w", `${l.left}px`);
  s.setProperty("--ai-right-w", `${l.right}px`);
  s.setProperty("--ai-bottom-h", `${l.bottomPct}%`);
}
function bindAiDashResize(host) {
  const grid = host.querySelector(".ai-dash-grid");
  if (!grid) return;
  grid.querySelectorAll(".ai-dash-handle").forEach((h) => {
    const axis = h.dataset.axis; // "left" | "right" | "bottom"
    h.addEventListener("pointerdown", (e) => {
      if (document.body.classList.contains("ai-dash-collapsed")) return;
      if (!window.matchMedia("(min-width: 901px)").matches) return; // 데스크톱 전용
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const startL = readAiDashLayout();
      const gridH = grid.getBoundingClientRect().height || 1;
      let pending = { ...startL };
      let raf = 0;
      try { h.setPointerCapture(e.pointerId); } catch (_) {}
      h.classList.add("is-dragging");
      document.body.classList.add("ai-dash-resizing");
      const onMove = (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const next = { ...startL };
        if (axis === "left") next.left = aiDashClampNum(startL.left + dx, AI_DASH_CLAMP.leftMin, AI_DASH_CLAMP.leftMax, startL.left);
        else if (axis === "right") next.right = aiDashClampNum(startL.right - dx, AI_DASH_CLAMP.rightMin, AI_DASH_CLAMP.rightMax, startL.right);
        else if (axis === "bottom") next.bottomPct = aiDashClampNum(startL.bottomPct - (dy / gridH) * 100, AI_DASH_CLAMP.bottomMin, AI_DASH_CLAMP.bottomMax, startL.bottomPct);
        pending = next;
        applyAiDashLayout(next);
        if (!raf) raf = requestAnimationFrame(() => { raf = 0; aiCosmosRelayoutSoon(); });
      };
      const onUp = () => {
        h.classList.remove("is-dragging");
        document.body.classList.remove("ai-dash-resizing");
        h.removeEventListener("pointermove", onMove);
        h.removeEventListener("pointerup", onUp);
        h.removeEventListener("pointercancel", onUp);
        try { h.releasePointerCapture(e.pointerId); } catch (_) {}
        writeAiDashLayout(pending);
        aiCosmosRelayoutSoon();
      };
      h.addEventListener("pointermove", onMove);
      h.addEventListener("pointerup", onUp);
      h.addEventListener("pointercancel", onUp);
    });
    // 더블클릭: 해당 축만 기본값으로 초기화
    h.addEventListener("dblclick", () => {
      const l = readAiDashLayout();
      if (axis === "left") l.left = AI_DASH_DEFAULTS.left;
      else if (axis === "right") l.right = AI_DASH_DEFAULTS.right;
      else if (axis === "bottom") l.bottomPct = AI_DASH_DEFAULTS.bottomPct;
      applyAiDashLayout(l);
      writeAiDashLayout(l);
      aiCosmosRelayoutSoon();
    });
  });
}

async function renderAiStockDashboard(ticker) {
  const host = byId("aiStockDashboard");
  if (!host) return false;
  document.body.classList.remove("ai-conversation-view"); // 대화 뷰 → 종목 대시보드 전환
  const t = normalizeTickerKey(ticker);
  const base = stockByTicker(t) || data.stocks.find((r) => r.ticker === t);
  if (!base) return false;
  const seq = ++aiDashSeq;
  const initial = applyLive(withDetail(base));
  let dashItem = initial; // 칩 핸들러가 참조(리페인트에도 최신 item 유지)

  host.innerHTML = `
    <div class="ai-dash-grid">
      <section class="ai-dash-panel ai-dash-card-panel ai-block animate-reveal" id="aiDashCard"></section>
      <aside class="ai-dash-col ai-dash-col-right">
        <section class="ai-dash-panel ai-dash-verdict-panel ai-block animate-reveal" id="aiDashVerdict"></section>
        <section class="ai-dash-panel ai-block animate-reveal" id="aiDashNews">
          <h4 class="ai-dash-h">관련 소식</h4>
          <div class="ai-dash-news-list"></div>
        </section>
      </aside>
      <div class="ai-dash-bottom ai-block animate-reveal">
        <section class="ai-dash-subpanel" id="aiDashMetrics"></section>
        <section class="ai-dash-subpanel" id="aiDashData"></section>
      </div>
      <div class="ai-dash-handle ai-dash-handle-col ai-dash-handle-left" data-axis="left" title="드래그하여 좌측 폭 조절 · 더블클릭 초기화"></div>
      <div class="ai-dash-handle ai-dash-handle-col ai-dash-handle-right" data-axis="right" title="드래그하여 우측 폭 조절 · 더블클릭 초기화"></div>
      <div class="ai-dash-handle ai-dash-handle-row ai-dash-handle-bottom" data-axis="bottom" title="드래그하여 하단 높이 조절 · 더블클릭 초기화"></div>
    </div>
    <div class="ai-dash-rangebar" id="aiDashRange">
      ${["1W", "1M", "3M", "6M", "YTD", "1Y", "5Y"].map((r) => `<button type="button" data-range="${r}"${r === "6M" ? ' class="is-active"' : ""}>${r}</button>`).join("")}
    </div>
    <div class="ai-dash-stylebar" id="aiDashStyle" role="group" aria-label="차트 캔들 유형">
      ${[["candle", "캔들", "캔들(OHLC)"], ["line", "라인", "종가 라인"], ["heikin", "헤이킨", "헤이킨아시(Heikin-Ashi)"]].map(([k, label, title]) => `<button type="button" data-style="${k}" title="${title}">${label}</button>`).join("")}
    </div>
    <button type="button" class="ai-dash-collapse" id="aiDashCollapse" aria-label="정보 패널 접기/펼치기" title="정보 패널 접기/펼치기"></button>`;
  host.classList.add("is-active");
  host.setAttribute("aria-hidden", "false");
  // 사이드바 접기 토글 (차트를 전체 폭으로)
  const collapseBtn = byId("aiDashCollapse");
  const syncCollapseGlyph = () => { if (collapseBtn) collapseBtn.textContent = document.body.classList.contains("ai-dash-collapsed") ? "‹" : "›"; };
  syncCollapseGlyph();
  if (collapseBtn) collapseBtn.addEventListener("click", () => {
    document.body.classList.toggle("ai-dash-collapsed");
    syncCollapseGlyph();
    aiCosmosRelayoutSoon();
  });
  // 저장된 4구역 크기를 복원하고 드래그 핸들을 바인딩(핸들은 매 렌더마다 새로 생성되므로 리스너 누적 없음).
  applyAiDashLayout(readAiDashLayout());
  bindAiDashResize(host);
  // 사이드바가 차트 폭을 줄였으니 cosmos 캔버스를 새 영역에 맞춰 다시 그린다.
  aiCosmosRelayoutSoon();
  const rangeKo = { "1W": "1주(5거래일)", "1M": "1개월", "3M": "3개월", "6M": "6개월", "YTD": "연초이후", "1Y": "1년", "5Y": "5년" };
  const rangeBar = byId("aiDashRange");
  if (rangeBar) rangeBar.querySelectorAll("[data-range]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const r = btn.dataset.range;
      if (window.MirCosmos?.setChartRange?.(r)) {
        rangeBar.querySelectorAll("[data-range]").forEach((b) => b.classList.toggle("is-active", b === btn));
        const hint = byId("aiInputHint"); // 하단 라벨 동기화
        if (hint) hint.textContent = `${t} · ${rangeKo[r] || r} 차트`;
      }
    });
  });
  // 캔들 유형 선택(캔들·라인·헤이킨아시). 저장된 유형을 활성 표시하고, 클릭 시 cosmos 에 반영.
  const styleBar = byId("aiDashStyle");
  if (styleBar) {
    const cur = window.MirCosmos?.getChartStyle?.() || "candle";
    styleBar.querySelectorAll("[data-style]").forEach((b) => b.classList.toggle("is-active", b.dataset.style === cur));
    styleBar.querySelectorAll("[data-style]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (window.MirCosmos?.setChartStyle?.(btn.dataset.style)) {
          styleBar.querySelectorAll("[data-style]").forEach((b) => b.classList.toggle("is-active", b === btn));
        }
      });
    });
  }

  // 후속 질문 칩(위임): 리페인트에도 살아남도록 host에 한 번만 바인딩
  host.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-dash-q]");
    if (!chip) return;
    const q = chip.getAttribute("data-dash-q");
    const label = chip.getAttribute("data-dash-l") || "질문";
    host.querySelectorAll("[data-dash-q]").forEach((c) => c.classList.toggle("is-active", c === chip));
    fetchAiDashLlmComment(dashItem, aiDashSeq, {
      query: `${dashItem.company || dashItem.ticker}(${dashItem.ticker}) — ${q}`,
      label,
    });
  });

  const paint = (item) => {
    if (seq !== aiDashSeq) return; // 새 종목 요청이 들어오면 이전 렌더 중단
    const card = byId("aiDashCard"); if (card) card.innerHTML = aiDashCardHtml(item);
    const metrics = byId("aiDashMetrics"); if (metrics) metrics.innerHTML = `<h4 class="ai-dash-h">핵심 신호 · 이벤트</h4><div class="ai-evidence-grid">${renderAiEvidenceGrid(item)}</div>`;
    const dataB = byId("aiDashData"); if (dataB) dataB.innerHTML = `<h4 class="ai-dash-h">기술 지표 · 밸류에이션</h4>${renderAiModeDataBoard(item)}`;
    const verdict = byId("aiDashVerdict"); if (verdict) verdict.innerHTML = aiVerdictPanel(item);
    const newsList = host.querySelector("#aiDashNews .ai-dash-news-list");
    if (newsList) newsList.innerHTML = aiDashNewsHtml(item);
  };
  paint(initial);
  revealAiBlocksStaggered(host);
  const item = (await ensureAiWidgetStock(t)) || initial;
  if (seq !== aiDashSeq) return false;
  dashItem = item;
  paint(item);
  // 규칙 기반 verdict 위에 워커 LLM 자연어 코멘트를 덧붙인다 — 단, 대시보드가 실제로
  // 보일 때(또는 첫 상호작용) 한 번만 요청한다.
  scheduleAiDashAutoComment(item, seq, host);
  return true;
}

// 자동 요약 코멘트는 종목을 열 때마다 즉시 LLM 을 부르지 않는다. 지나가는 종목마다
// 요청하면 연타·스크롤만으로 과금과 429 로 이어졌다. verdict 패널이 뷰포트에 들어오거나
// 사용자가 대시보드에 처음 손을 대면 그때 한 번 요청하고, 캐시가 있으면 바로 채운다.
function scheduleAiDashAutoComment(item, seq, host) {
  const slot = byId("aiDashLlm");
  if (!slot || !host) return;
  if (aiDashLlmCacheGet(aiDashLlmCacheKey(item)) != null) {
    fetchAiDashLlmComment(item, seq); // 캐시 적중 — 네트워크 없이 즉시 렌더
    return;
  }
  let fired = false;
  let io = null;
  const events = ["pointerdown", "keydown", "wheel", "touchstart"];
  const cleanup = () => {
    events.forEach((ev) => host.removeEventListener(ev, onInteract));
    if (io) { io.disconnect(); io = null; }
  };
  const fire = () => {
    if (fired) return;
    fired = true;
    cleanup();
    if (seq !== aiDashSeq) return;
    const cur = byId("aiDashLlm");
    if (!cur || cur.dataset.mode === "custom") return; // 후속 질문이 이미 슬롯을 차지함
    fetchAiDashLlmComment(item, seq);
  };
  function onInteract(e) {
    // 후속 질문 칩은 자기 요청을 따로 보내므로 자동 코멘트를 함께 띄우지 않는다.
    if (e.target && e.target.closest && e.target.closest("[data-dash-q]")) return;
    fire();
  }
  events.forEach((ev) => host.addEventListener(ev, onInteract, { passive: true }));
  const target = byId("aiDashVerdict") || slot;
  if (typeof IntersectionObserver === "function") {
    io = new IntersectionObserver((entries) => {
      if (entries.some((en) => en.isIntersecting)) fire();
    }, { threshold: 0.25 });
    io.observe(target);
  } else {
    setTimeout(fire, 1500);
  }
}

function aiDashCardHtml(item) {
  const f = (typeof normalizedFundamentalsForItem === "function") ? normalizedFundamentalsForItem(item) : (item.fundamentals || {});
  const chg = Number(item.changePct);
  const chgCls = chg > 0 ? "pos" : chg < 0 ? "neg" : "muted";
  const secKo = item.sector ? (SECTOR_KO[item.sector] || item.sector) : "";
  const stat = (label, val) => `<div class="ai-dash-stat"><span>${escapeHtml(label)}</span><b>${val}</b></div>`;
  // 목표주가 + 상승 여력
  const price = Number(item.price) || Number(f.prevClose);
  const tgt = Number(f.targetPrice);
  let targetVal = "—";
  if (Number.isFinite(tgt)) {
    const up = (Number.isFinite(price) && price) ? (tgt - price) / price * 100 : null;
    targetVal = `${priceOrDash(tgt)}${up != null ? ` <em class="${up >= 0 ? "pos" : "neg"}">${fmtPct(up)}</em>` : ""}`;
  }
  // 기관 보유(13F)
  let instVal = "—";
  try {
    const g = (typeof inst13fIndex === "function") ? inst13fIndex()[item.ticker] : null;
    if (g && g.holders) instVal = `${g.holders}곳${g.valueM ? " · " + fmtBillions(g.valueM / 1000) : ""}`;
  } catch (_) {}
  return `
    <div class="ai-dash-card-head">
      <div class="ai-dash-idname">
        <strong class="ai-dash-ticker">${escapeHtml(stockLabel(item))}</strong>
        <span class="ai-dash-company">${escapeHtml(stockSubLabel(item))}${secKo ? " · " + escapeHtml(secKo) : ""}</span>
      </div>
      <div class="ai-dash-price">
        <b>${priceOrDash(item.price)}</b>
        <span class="${chgCls}">${fmtDailyPct(chg)}</span>
      </div>
    </div>
    <div class="ai-dash-stats">
      ${stat("시가총액", fmtBillions(f.marketCapDisplay ?? f.marketCapB ?? item.marketCapB))}
      ${stat("목표주가", targetVal)}
      ${stat("PER", fmtMultiple(f.pe))}
      ${stat("Fwd PER", fmtMultiple(f.forwardPE))}
      ${stat("RSI", fmtRsi(item))}
      ${stat("기관 보유(13F)", instVal)}
      ${stat("52주 고", priceOrDash(f.week52High))}
      ${stat("52주 저", priceOrDash(f.week52Low))}
    </div>`;
}

function aiDashNewsHtml(item) {
  const news = Array.isArray(item.news) ? item.news.slice(0, 4) : [];
  if (!news.length) return `<p class="muted font-small">최근 뉴스 정보가 없습니다.</p>`;
  return news.map((n) => `
    <a class="ai-dash-news-item" href="${escapeHtml(n.url || "#")}" target="_blank" rel="noopener">
      <span>${escapeHtml(n.title || "")}</span>
      <small>${escapeHtml(n.source || "")}${n.time ? " · " + escapeHtml(n.time) : ""}</small>
    </a>`).join("");
}

// AI 투자 의견 verdict — 사이트에 이미 있는 신호(RS·모멘텀·52주위치·목표가여력·밸류·
// 내부자)를 종합한 규칙 기반 스코어카드. 오프라인 즉시 계산(투자 조언 아님).
function aiVerdictPanel(item) {
  const f = (typeof normalizedFundamentalsForItem === "function") ? normalizedFundamentalsForItem(item) : (item.fundamentals || {});
  const price = Number(item.price) || Number(f.prevClose);
  const sig = []; // {s: score, k: 'strength'|'risk'|'neutral', t: text}

  // RS 점수(백분위) 대신 실측 RSI(14) 로 판정 — 스케일이 달라 임계도 RSI 기준.
  // 55~70=건강한 상승 모멘텀, >70=과매수 경계, 45~55=중립, <30=과매도(약세/반등).
  const rsi = rsiValue(item);
  if (rsi != null) {
    if (rsi > 70) sig.push({ s: -1, k: "risk", t: `RSI ${Math.round(rsi)} · 과매수 구간` });
    else if (rsi >= 55) sig.push({ s: 1, k: "strength", t: `RSI ${Math.round(rsi)} · 상승 모멘텀` });
    else if (rsi < 30) sig.push({ s: -2, k: "risk", t: `RSI ${Math.round(rsi)} · 과매도·약세` });
    else if (rsi < 45) sig.push({ s: -1, k: "risk", t: `RSI ${Math.round(rsi)} · 모멘텀 둔화` });
  }
  const m3 = Number(item.threeMonthChangePct);
  if (Number.isFinite(m3)) {
    if (m3 >= 15) sig.push({ s: 1.5, k: "strength", t: `3개월 +${m3.toFixed(0)}% 상승 추세` });
    else if (m3 <= -15) sig.push({ s: -1.5, k: "risk", t: `3개월 ${m3.toFixed(0)}% 하락 추세` });
  }
  const hi = Number(f.week52High), lo = Number(f.week52Low);
  if (Number.isFinite(hi) && Number.isFinite(lo) && hi > lo && Number.isFinite(price)) {
    const pos = Math.round((price - lo) / (hi - lo) * 100);
    if (pos >= 90) sig.push({ s: 0.5, k: "neutral", t: `52주 신고가 근접 (상위 ${pos}%)` });
    else if (pos <= 25) sig.push({ s: -0.5, k: "risk", t: `52주 저점권 (하위 ${pos}%)` });
  }
  const tgt = Number(f.targetPrice);
  if (Number.isFinite(tgt) && Number.isFinite(price) && price) {
    const up = (tgt - price) / price * 100;
    if (up >= 15) sig.push({ s: 1.5, k: "strength", t: `목표가 +${up.toFixed(0)}% 상승 여력` });
    else if (up <= -5) sig.push({ s: -1, k: "risk", t: `현재가가 목표가 상회 (${up.toFixed(0)}%)` });
  }
  const fpe = Number(f.forwardPE);
  if (Number.isFinite(fpe) && fpe > 0) {
    if (fpe > 40) sig.push({ s: -1, k: "risk", t: `Forward PER ${fpe.toFixed(0)}배 · 고평가 부담` });
    else if (fpe < 15) sig.push({ s: 1, k: "strength", t: `Forward PER ${fpe.toFixed(0)}배 · 밸류 매력` });
  }
  const ins = ((window.INSIDER_TRADES || {}).trades || []).filter((r) => r.ticker === item.ticker);
  const insBuy = ins.filter((r) => r.kind === "buy").length;
  const insSell = ins.filter((r) => r.kind === "sell").length;
  if (insBuy || insSell) {
    if (insBuy > insSell) sig.push({ s: 1, k: "strength", t: `내부자 순매수 (매수 ${insBuy} / 매도 ${insSell})` });
    else if (insSell > insBuy * 2) sig.push({ s: -1, k: "risk", t: `내부자 순매도 (매도 ${insSell}건)` });
  }

  const total = sig.reduce((a, x) => a + x.s, 0);
  const strengths = sig.filter((x) => x.k === "strength").sort((a, b) => b.s - a.s);
  const risks = sig.filter((x) => x.k === "risk").sort((a, b) => a.s - b.s);

  // 사이트 정책: 매수/매도/목표가 추천 금지 — 방향 판정 대신 신호 관찰 요약만 보여준다.
  let verdict, vcls;
  if (total >= 3.5) { verdict = "긍정 신호 뚜렷"; vcls = "buy"; }
  else if (total >= 1.5) { verdict = "긍정 신호 우세"; vcls = "buy"; }
  else if (total > -1.5) { verdict = "중립 · 혼조"; vcls = "hold"; }
  else if (total > -3.5) { verdict = "부정 신호 우세"; vcls = "sell"; }
  else { verdict = "부정 신호 뚜렷"; vcls = "sell"; }

  const absSum = sig.reduce((a, x) => a + Math.abs(x.s), 0) || 1;
  const agree = Math.abs(total) / absSum;
  const conf = sig.length ? Math.round(Math.min(94, 42 + sig.length * 7 + agree * 22)) : 30;

  const name = item.company || item.ticker;
  const dir = vcls === "buy" ? "긍정 신호가 우세합니다" : vcls === "sell" ? "부정 신호가 우세합니다" : "신호가 엇갈려 뚜렷한 방향성이 약합니다";
  const comment = `${escapeHtml(name)}은(는) 현재 ${dir}.` +
    (strengths[0] ? ` 눈에 띄는 신호는 ${escapeHtml(strengths[0].t)}` + (risks[0] ? `이며, 유의할 점은 ${escapeHtml(risks[0].t)}입니다.` : `입니다.`) : (risks[0] ? ` 유의할 점은 ${escapeHtml(risks[0].t)}입니다.` : ""));

  const li = (arr, empty) => arr.length ? arr.slice(0, 3).map((x) => `<li>${escapeHtml(x.t)}</li>`).join("") : `<li class="muted">${empty}</li>`;

  return `
    <div class="ai-verdict-head">
      <h4 class="ai-dash-h">AI 의견</h4>
      <span class="ai-verdict-badge ai-verdict-${vcls}">${verdict}</span>
    </div>
    <div class="ai-verdict-conf">
      <span>신호 합의도</span>
      <div class="ai-verdict-gauge"><i class="ai-verdict-${vcls}" style="width:${conf}%"></i></div>
      <b>${conf}%</b>
    </div>
    <p class="ai-verdict-comment">${comment}</p>
    <div class="ai-verdict-cols">
      <div class="ai-verdict-pts">
        <span class="ai-verdict-pts-h up">관찰 포인트</span>
        <ul>${li(strengths, "특이 긍정 신호 없음")}</ul>
      </div>
      <div class="ai-verdict-pts">
        <span class="ai-verdict-pts-h down">리스크</span>
        <ul>${li(risks, "특이 리스크 신호 없음")}</ul>
      </div>
    </div>
    <div class="ai-verdict-llm" id="aiDashLlm"></div>
    <div class="ai-dash-chips" aria-label="후속 질문">
      <span class="ai-dash-chips-h">이어서 묻기</span>
      ${AI_DASH_CHIPS.map((c) => `<button type="button" data-dash-q="${escapeHtml(c.q)}" data-dash-l="${escapeHtml(c.l)}">${escapeHtml(c.l)}</button>`).join("")}
    </div>
    <small class="ai-verdict-disc">규칙 기반 참고 지표 · 매수/매도 추천이 아닙니다</small>`;
}

const AI_DASH_CHIPS = [
  { l: "기술적 위치", q: "현재 주가의 기술적 위치(추세·지지/저항·모멘텀)를 매수/매도 추천 없이 짚어줘" },
  { l: "핵심 리스크", q: "이 종목의 핵심 하방 리스크 요인을 짚어줘" },
  { l: "동종업체 비교", q: "주요 동종업체 대비 강점과 약점을 비교해줘" },
  { l: "실적 전망", q: "다가오는 실적과 향후 실적 전망을 정리해줘" },
  { l: "밸류에이션 점검", q: "현재 밸류에이션이 과거 평균·동종업체 대비 어느 수준인지 매수/매도 추천 없이 점검해줘" },
];

// 자동 요약 코멘트 캐시 — (시장, 스냅샷 날짜, 티커) 키로 12시간. 같은 종목을 다시 열 때
// LLM 을 또 부르지 않는다(메모리 + localStorage). 후속 질문(Q&A)은 캐시하지 않는다.
const AI_DASH_LLM_CACHE_KEY = "mir_ai_dash_llm_cache_v1";
const AI_DASH_LLM_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const AI_DASH_LLM_CACHE_MAX = 40;
const aiDashLlmMemCache = new Map();

function aiDashLlmCacheKey(item) {
  const snap = String((typeof data !== "undefined" && data && (data.updatedAtKst || data.updated_at_kst)) || "");
  return `${isKrMarket() ? "kr" : "us"}|${snap}|${item.ticker}`;
}

function aiDashLlmCacheGet(key) {
  const now = Date.now();
  const mem = aiDashLlmMemCache.get(key);
  if (mem && now - Number(mem.ts) < AI_DASH_LLM_CACHE_TTL_MS) return mem.text;
  const store = window.safeStorage.getJSON(AI_DASH_LLM_CACHE_KEY, {}) || {};
  const hit = store[key];
  if (hit && typeof hit.text === "string" && now - Number(hit.ts) < AI_DASH_LLM_CACHE_TTL_MS) {
    aiDashLlmMemCache.set(key, hit);
    return hit.text;
  }
  return null;
}

function aiDashLlmCacheSet(key, text) {
  const now = Date.now();
  const entry = { text: String(text), ts: now };
  aiDashLlmMemCache.set(key, entry);
  const store = window.safeStorage.getJSON(AI_DASH_LLM_CACHE_KEY, {}) || {};
  store[key] = entry;
  const pruned = {};
  Object.keys(store)
    .filter((k) => store[k] && now - Number(store[k].ts || 0) < AI_DASH_LLM_CACHE_TTL_MS)
    .sort((a, b) => Number(store[b].ts) - Number(store[a].ts))
    .slice(0, AI_DASH_LLM_CACHE_MAX)
    .forEach((k) => { pruned[k] = store[k]; });
  window.safeStorage.setJSON(AI_DASH_LLM_CACHE_KEY, pruned);
}

// 워커 LLM(/chat)으로 자연어 코멘트/후속답변을 받아 verdict 패널의 슬롯에 채운다.
// opts.query가 있으면 후속 질문 답변(Q&A), 없으면 자동 심층 코멘트.
// 프록시가 없으면 자동 코멘트는 조용히 비우고, 실패하면 워커가 준 메시지(429 등)를 보여준다.
let aiDashLlmController = null;

async function fetchAiDashLlmComment(item, seq, opts) {
  const slot = byId("aiDashLlm");
  if (!slot) return;
  const custom = opts && opts.query;
  const headLabel = custom ? `${escapeHtml(opts.label || "질문")}` : "AI 요약 의견";
  slot.dataset.mode = custom ? "custom" : "auto";
  const cacheKey = custom ? "" : aiDashLlmCacheKey(item);
  if (!custom) {
    const cached = aiDashLlmCacheGet(cacheKey);
    if (cached) {
      slot.innerHTML = `<div class="ai-verdict-llm-head">${headLabel}</div><div class="ai-verdict-llm-body">${formatMarkdownToHtml(cached)}</div>`;
      return;
    }
  }
  if (!LIVE_DATA_PROXY) {
    if (custom) slot.innerHTML = `<div class="ai-verdict-llm-head">${headLabel}</div><p class="ai-verdict-llm-body muted">AI 답변은 서버(Worker) 연결 후 이용할 수 있습니다.</p>`;
    return;
  }
  slot.innerHTML = `<div class="ai-verdict-llm-head">${headLabel}</div><p class="ai-verdict-llm-body ai-verdict-llm-loading">작성 중…</p>`;
  // 이전 요청이 아직 흐르고 있으면 끊는다(종목 이동·칩 연타 대비)
  if (aiDashLlmController) {
    try { aiDashLlmController.abort(); } catch (_) { /* ignore */ }
    aiStreamEnd(aiDashLlmController);
  }
  const controller = aiStreamBegin();
  aiDashLlmController = controller;
  try {
    // 참고 레이아웃(1.png)의 AI 의견 카드: 요약 + 포인트/리스크 불릿.
    // 단, 사이트 정책상 매수/매도/목표가 추천은 절대 하지 않는다.
    const query = custom || `${item.company || item.ticker}(${item.ticker})의 현재 차트·펀더멘탈·수급을 종합해 아래 형식의 한국어 요약 의견을 작성해줘.\n형식:\n(2문장 이내의 종합 요약)\n**관찰 포인트**\n- (2~3개, 각 1줄)\n**리스크**\n- (2~3개, 각 1줄)\n규칙: 매수/매도/목표가 추천·단정 금지, 제공된 데이터에 있는 사실만 사용, 형식 외 다른 머리말 금지.`;
    const stockContext = await buildStockChatContext(item.ticker);
    if (seq !== aiDashSeq) return; // 사용자가 다른 종목으로 이동함

    const paint = (text, loading) => {
      const cur = byId("aiDashLlm");
      if (!cur || seq !== aiDashSeq) return;
      cur.innerHTML = `<div class="ai-verdict-llm-head">${headLabel}</div><div class="ai-verdict-llm-body${loading ? " is-streaming" : ""}">${formatMarkdownToHtml(text)}</div>`;
    };
    let paintQueued = false;
    let latestFull = "";
    const onDelta = (_d, full) => {
      latestFull = full;
      if (paintQueued) return;
      paintQueued = true;
      requestAnimationFrame(() => { paintQueued = false; paint(latestFull, true); });
    };

    const result = await requestAiChatReply({
      messages: [{ role: "user", content: query }],
      stockContext,
      snapshotContext: (typeof buildMarketChatContext === "function" ? buildMarketChatContext() : ""),
      market: isKrMarket() ? "kr" : "us",
      searchHints: { tickers: [item.ticker], companies: [item.company].filter(Boolean) },
    }, { signal: controller.signal, onDelta });

    if (seq !== aiDashSeq) return;
    let reply = (result.reply || "").trim();
    if (reply && typeof isDegenerateLlmText === "function" && isDegenerateLlmText(reply)) reply = ""; // 깨진 답변은 버린다
    const cur = byId("aiDashLlm");
    if (!cur) return;
    if (reply) {
      cur.innerHTML = `<div class="ai-verdict-llm-head">${headLabel}</div><div class="ai-verdict-llm-body">${formatMarkdownToHtml(reply)}${result.aborted ? ` <span class="ai-abort-note muted">(중단됨)</span>` : ""}</div>`;
      if (!custom && !result.aborted) aiDashLlmCacheSet(cacheKey, reply);
    } else if (result.aborted) {
      cur.innerHTML = `<div class="ai-verdict-llm-head">${headLabel}</div><p class="ai-verdict-llm-body muted">(중단됨)</p>`;
    } else {
      cur.innerHTML = custom ? `<div class="ai-verdict-llm-head">${headLabel}</div><p class="ai-verdict-llm-body muted">답변을 받지 못했습니다.</p>` : "";
    }
  } catch (err) {
    const cur = byId("aiDashLlm");
    if (cur && seq === aiDashSeq) {
      if (err && err.name === "AbortError") {
        cur.innerHTML = `<div class="ai-verdict-llm-head">${headLabel}</div><p class="ai-verdict-llm-body muted">(중단됨)</p>`;
      } else {
        // 워커가 상태코드와 함께 준 메시지(429 "잠시 후 다시" 등)는 그대로, 네트워크 단절은 일반 문구.
        const msg = err && err.status ? String(err.message) : "지금은 AI 답변을 불러올 수 없습니다.";
        cur.innerHTML = `<div class="ai-verdict-llm-head">${headLabel}</div><p class="ai-verdict-llm-body muted">${escapeHtml(msg)}</p>`;
      }
    }
  } finally {
    aiStreamEnd(controller);
    if (aiDashLlmController === controller) aiDashLlmController = null;
  }
}

window.MirDash = {
  render: renderAiStockDashboard,
  hide() {
    const host = byId("aiStockDashboard");
    if (host) { host.classList.remove("is-active"); host.setAttribute("aria-hidden", "true"); host.innerHTML = ""; }
    aiDashSeq++;
    // 사이드바가 사라졌으니 차트를 다시 전체 폭으로 되돌린다.
    aiCosmosRelayoutSoon();
  },
};

function setupAiChatModeEvents() {
  const sidebarToggleBtn = byId("sidebarToggleBtn");
  const newChatBtn = byId("newChatBtn");
  const sidebar = byId("aiChatSidebar");

  // AI 모드 진입/종료 버튼, 추천 카드, 폼 제출, Enter 는 ai-mode-welcome.js 가 단일 창구
  // (window.MirAI.queryStock)로 처리한다. 예전엔 여기서도 같은 요소에 리스너를 달았지만
  // welcome 이 capture 단계에서 stopImmediatePropagation 하므로 한 번도 실행되지 않는
  // 죽은 코드였고, 자동완성 ↓+Enter 는 하이라이트 대신 입력창 원문을 보냈다.

  if (sidebarToggleBtn && sidebar) {
    sidebarToggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
      sidebarToggleBtn.classList.toggle("active");
    });
  }

  if (newChatBtn) {
    newChatBtn.addEventListener("click", () => {
      startNewAiChatSession();
    });
  }

  const form = byId("aiChatForm");
  const input = byId("aiChatInput");
  const popup = byId("aiAutoComplete");

  if (form && input && popup) {
    let activeIndex = -1;
    let results = [];
    const hidePopup = () => {
      popup.hidden = true;
      activeIndex = -1;
      results = [];
    };
    // 자동완성 선택·음성 인식도 Enter 와 같은 단일 진입점으로 보낸다.
    const submitQuery = (query) => {
      hidePopup();
      if (window.MirAI?.queryStock) window.MirAI.queryStock(query);
      else sendAiChat(query);
    };
    const submitTicker = (ticker) => {
      const query = `${ticker} 분석해줘`;
      input.value = query;
      submitQuery(query);
    };
    // welcome 의 Enter(capture) 핸들러가 하이라이트된 항목을 우선 쓰도록 노출.
    window.MirAiChat.autocomplete = {
      highlightedTicker: () => (!popup.hidden && activeIndex >= 0 && results[activeIndex] ? results[activeIndex].ticker : null),
      hide: hidePopup,
    };

    // 시장 배지 — 6자리 숫자를 무조건 KOSPI, 나머지를 NASDAQ 으로 찍으면
    // 코스닥 종목·NYSE 종목이 전부 오표기된다. 스냅샷의 market/groups 를 우선
    // 사용하고, 알 수 없으면 중립 라벨(KRX/US)로 둔다.
    const autocompleteMarketBadge = (s) => {
      const market = String(s.market || "").toLowerCase();
      if (market === "kospi") return "KOSPI";
      if (market === "kosdaq") return "KOSDAQ";
      const groups = s.groups || [];
      if (groups.includes("idx_nasdaq") || groups.includes("idx_ndx100")) return "NASDAQ";
      if (groups.includes("idx_nyse")) return "NYSE";
      return /^\d{6}$/.test(s.ticker) ? "KRX" : "US";
    };

    // 자동완성 추천 입력 리스너
    input.addEventListener("input", () => {
      const value = input.value.trim().toLowerCase();
      if (value.length < 1) {
        hidePopup();
        return;
      }

      const stocks = (typeof data !== "undefined" && data && Array.isArray(data.stocks)) ? data.stocks : [];
      results = stocks.filter((s) => {
        // company 가 비어 있는 스냅샷 행(일부 ETF·신규상장)에서 toLowerCase 가 죽지 않게.
        return String(s.ticker || "").toLowerCase().includes(value) || String(s.company || "").toLowerCase().includes(value);
      }).slice(0, 5);

      if (results.length === 0) {
        hidePopup();
        return;
      }

      activeIndex = -1;
      popup.innerHTML = results.map((s, idx) => `
        <div class="autocomplete-item" data-ticker="${escapeHtml(s.ticker)}" data-index="${idx}">
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="ticker-badge">${escapeHtml(stockLabel(s))}</span>
            <span class="company-name">${escapeHtml(stockSubLabel(s))}</span>
          </div>
          <span class="market-badge">${escapeHtml(autocompleteMarketBadge(s))}</span>
        </div>
      `).join("");
      popup.hidden = false;

      popup.querySelectorAll(".autocomplete-item").forEach((item) => {
        item.addEventListener("click", () => submitTicker(item.dataset.ticker));
      });
    });

    // ↑↓/Esc 만 여기서. Enter 는 welcome 의 capture 리스너가 highlightedTicker() 를 읽어 처리한다.
    input.addEventListener("keydown", (e) => {
      if (popup.hidden) return;
      const items = popup.querySelectorAll(".autocomplete-item");
      if (!items.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % items.length;
        items.forEach((item, idx) => item.classList.toggle("active", idx === activeIndex));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        items.forEach((item, idx) => item.classList.toggle("active", idx === activeIndex));
      } else if (e.key === "Escape") {
        hidePopup();
      }
    });

    // 외부 클릭 시 자동완성 닫기
    document.addEventListener("click", (e) => {
      if (!input.contains(e.target) && !popup.contains(e.target)) {
        hidePopup();
      }
    });

    // 음성인식 STT 바인딩
    const voiceBtn = byId("aiVoiceBtn");
    if (voiceBtn) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = "ko-KR";
        recognition.interimResults = false;

        let isListening = false;

        voiceBtn.addEventListener("click", () => {
          if (isListening) {
            recognition.stop();
          } else {
            try {
              recognition.start();
            } catch (e) { /* ignore */ }
          }
        });

        recognition.onstart = () => {
          isListening = true;
          voiceBtn.classList.add("is-recording");
          input.placeholder = "듣고 있습니다... 말씀해 주세요.";
        };

        recognition.onerror = (e) => {
          console.error("STT Error:", e);
          recognition.stop();
        };

        recognition.onend = () => {
          isListening = false;
          voiceBtn.classList.remove("is-recording");
          input.placeholder = "종목 분석 또는 투자 질문을 입력하세요...";
        };

        recognition.onresult = (e) => {
          const resultText = e.results[0][0].transcript;
          if (resultText) {
            input.value = resultText;
            submitQuery(resultText);
          }
        };
      } else {
        voiceBtn.style.opacity = "0.3";
        voiceBtn.style.cursor = "not-allowed";
        voiceBtn.title = "이 브라우저에서는 음성 인식을 지원하지 않습니다.";
      }
    }
  }
}


// ===== 스트리밍 중단 버튼 (전송 버튼 ⇄ ■) =====
// 스트리밍 중 전송 버튼 클릭은 폼 제출로 흐르기 전에 capture 단계에서 가로채 중단한다.
function setupAiStreamStopEvents() {
  if (setupAiStreamStopEvents._bound) return;
  setupAiStreamStopEvents._bound = true;
  const btn = document.querySelector("#aiChatForm .ai-send-btn");
  if (!btn) return;
  btn.addEventListener("click", (e) => {
    if (!aiActiveStreams.size) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    aiAbortAllStreams();
  }, true);
}

// ===== 대화 .md 내보내기 =====
function exportAiChatMarkdown() {
  const session = aiChatSessions[currentSessionId]
    || { name: "MIR AI 대화", history: aiChatHistory, timestamp: new Date().toISOString() };
  const history = Array.isArray(session.history) ? session.history : [];
  if (!history.length) {
    if (typeof showAppToast === "function") showAppToast("내보낼 대화가 없습니다.", 2400);
    return false;
  }
  const fmtTs = (v) => {
    const d = v instanceof Date ? v : new Date(v);
    return Number.isFinite(d.getTime()) ? d.toLocaleString("ko-KR", { hour12: false }) : "";
  };
  const lines = [
    `# ${session.name || "MIR AI 대화"}`,
    "",
    `- 세션 시각: ${fmtTs(session.timestamp || Date.now())}`,
    `- 내보낸 시각: ${fmtTs(Date.now())}`,
    `- 메시지 수: ${history.length}`,
    "",
    "---",
    "",
  ];
  history.forEach((msg) => {
    const who = msg.role === "user" ? "사용자" : "MIR AI";
    const when = msg.ts ? ` · ${fmtTs(msg.ts)}` : "";
    lines.push(`## ${who}${when}`, "", String(msg.content || "").trim(), "");
  });
  const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  a.href = url;
  a.download = `mir_ai_chat_${stamp}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  if (typeof showAppToast === "function") showAppToast("대화를 Markdown 파일로 저장했습니다.", 2400);
  return true;
}
