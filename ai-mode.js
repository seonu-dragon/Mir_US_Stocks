// 이 파일은 app.js 에서 기계적으로 분리된 코드다 (refactor/appjs-split-stage1).
// AI 모드 클러스터: 전용 AI 챗 모드/세션/스트리밍/JARVIS 대시보드 (원본 app.js 18838-21687).
// 2026-09-15: 인라인 종목 위젯(renderInlineStockWidget)과 MirProb '상승확률' 히어로 클러스터를
// 통째로 삭제했다 — scanProbColor/scanVerdict 가 f25c88487 에서 사라져 히어로는 항상 throw 했고
// (.catch 가 삼켜 스켈레톤만 남음), 위젯 자체도 웰컴(MirDash)이 단일 창구가 되면서 도달 불가였다.
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
// 30세션 × 200메시지는 최악 12MB 로 5MB 한도를 우습게 넘겼다(QuotaExceeded → 이후
// 저장이 통째로 조용히 실패). 개수 상한을 현실적으로 낮추고, 그래도 넘치면 바이트
// 예산으로 오래된 세션부터 버린다.
const AI_SESSIONS_MAX = 10;          // 최신 10개 세션만 보관
const AI_SESSION_MESSAGES_MAX = 60;  // 세션당 최신 60개 메시지만 보관
const AI_SESSIONS_BYTE_BUDGET = 3 * 1024 * 1024; // 직렬화 3MB 상한(localStorage 5MB 중)

function pruneAiSessions() {
  const byRecent = () => Object.entries(aiChatSessions)
    .sort((a, b) => new Date(b[1].timestamp) - new Date(a[1].timestamp));
  byRecent().slice(AI_SESSIONS_MAX).forEach(([id]) => {
    if (id !== currentSessionId) delete aiChatSessions[id];
  });
  Object.values(aiChatSessions).forEach((session) => {
    if (Array.isArray(session.history) && session.history.length > AI_SESSION_MESSAGES_MAX) {
      session.history.splice(0, session.history.length - AI_SESSION_MESSAGES_MAX);
    }
  });
  // 바이트 예산: 긴 답변 몇 개만으로도 개수 상한을 지키면서 수 MB 가 된다.
  let entries = byRecent();
  while (entries.length > 1 && JSON.stringify(aiChatSessions).length > AI_SESSIONS_BYTE_BUDGET) {
    const [oldestId] = entries[entries.length - 1];
    if (oldestId === currentSessionId) {
      if (entries.length < 2) break;
      const [prevId] = entries[entries.length - 2];
      delete aiChatSessions[prevId];
    } else {
      delete aiChatSessions[oldestId];
    }
    entries = byRecent();
  }
}

// 답변이 확정될 때마다 전체 세션을 stringify 하면(긴 대화에서 수 MB) 메인 스레드가 멎는다.
// 500ms 디바운스로 모아 쓴다. 탭을 닫을 때는 flush 로 마지막 상태를 확실히 남긴다.
let aiSessionSaveTimer = 0;
function flushAiSessionsToStorage() {
  if (aiSessionSaveTimer) { clearTimeout(aiSessionSaveTimer); aiSessionSaveTimer = 0; }
  pruneAiSessions();
  // 쿼터 초과·저장소 차단은 safeStorage 가 흡수한다 — 저장 실패해도 화면 동작은 유지.
  window.safeStorage.setJSON("mir_ai_sessions", aiChatSessions);
  window.safeStorage.set("mir_ai_current_session", currentSessionId || "");
}

function saveAiSessionsToStorage({ immediate = false } = {}) {
  if (immediate) { flushAiSessionsToStorage(); return; }
  if (aiSessionSaveTimer) return;
  aiSessionSaveTimer = setTimeout(() => {
    aiSessionSaveTimer = 0;
    flushAiSessionsToStorage();
  }, 500);
}

window.addEventListener("pagehide", () => { if (aiSessionSaveTimer) flushAiSessionsToStorage(); });

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
      saveAiSessionsToStorage({ immediate: true });
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
  saveAiSessionsToStorage({ immediate: true });
  
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
  saveAiSessionsToStorage({ immediate: true });
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
  
  saveAiSessionsToStorage({ immediate: true });
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
        mutedP.innerHTML = `오늘 관심 종목 중 등락률이 높은 <strong>${escapeHtml(welcomeData.name)}${isKrCodeTicker(welcomeData.ticker) ? "" : ` (${escapeHtml(welcomeData.ticker)})`}</strong>의 정밀 AI 리포트를 확인해 보시겠어요? 아래 카드를 누르거나 무엇이든 질문해 주세요.`;
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

// 답변 위에 붙는 태그. '종합: 호재/경계/중립' 배지는 삭제했다(2026-09-15) — 본문에
// "하락"·"우려" 같은 낱말이 있는지만 보고 투자 판단처럼 보이는 라벨을 붙이는 건
// 사이트 정책(매수/매도·전망 단정 금지, aiVerdictPanel 주석)에 어긋났고, 답변이 빈
// 중단 상태에서도 '중립'이 남았다. 중립적인 주제 태그만 유지한다.
function generateAiBadges(text) {
  const badges = [];
  const lower = String(text || "").toLowerCase();

  // 주제(테마) 감지
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

// ===== 봇 버블 구조 =====
// .msg-bubble > (.msg-md 본문 + .copy-msg-btn 복사 버튼).
// 마크다운은 반드시 .msg-md 안에만 쓴다 — 예전엔 스트리밍·최종 렌더가 .msg-bubble 의
// innerHTML 을 통째로 덮어써서 appendAiChatMessage 가 달아 둔 복사 버튼이 사라졌다
// (새 답변에는 복사 버튼이 아예 없었다).
function aiBubbleBody(bubble) {
  if (!bubble) return null;
  let body = bubble.querySelector(".msg-md");
  if (!body) {
    body = document.createElement("div");
    body.className = "msg-md";
    // 기존 내용(로딩 문구 등)을 본문 칸으로 옮긴다.
    while (bubble.firstChild && bubble.firstChild !== body) {
      const node = bubble.firstChild;
      if (node.nodeType === 1 && node.classList.contains("copy-msg-btn")) break;
      body.appendChild(node);
    }
    bubble.insertBefore(body, bubble.firstChild);
  }
  return body;
}

function ensureAiCopyButton(bubble) {
  if (!bubble || bubble.querySelector(".copy-msg-btn")) return;
  const btn = document.createElement("button");
  btn.className = "copy-msg-btn";
  btn.type = "button";
  btn.title = "답변 복사";
  btn.setAttribute("aria-label", "답변 복사");
  btn.textContent = "복사";
  btn.addEventListener("click", () => {
    const body = bubble.querySelector(".msg-md") || bubble;
    const textToCopy = body.innerText.trim();
    navigator.clipboard.writeText(textToCopy).then(() => {
      btn.textContent = "✓";
      btn.classList.add("copied");
      setTimeout(() => {
        btn.textContent = "복사";
        btn.classList.remove("copied");
      }, 1500);
    }).catch((err) => {
      console.error("복사 실패:", err);
    });
  });
  bubble.appendChild(btn);
}

// 답변 텍스트를 버블에 쓰는 단일 창구. stripEmoji 를 항상 먼저 거친다
// (사이트는 장식 이모지를 쓰지 않는다 — app.js:1345/7842/7888 과 같은 규칙).
function setAiBubbleMarkdown(bubble, text, { copyButton = true } = {}) {
  const body = aiBubbleBody(bubble);
  if (!body) return;
  const clean = stripEmoji(String(text ?? ""));
  body.innerHTML = formatMarkdownToHtml(clean);
  if (copyButton && clean.trim()) ensureAiCopyButton(bubble);
}

function typeWriterMarkdown(bubble, rawText, onComplete) {
  let i = 0;
  const text = stripEmoji(String(rawText || ""));
  const element = aiBubbleBody(bubble) || bubble;
  // 타이핑 중엔 textContent 만 갱신한다 — 매 16ms 마다 전체 문자열을 마크다운 파싱하면
  // 긴 답변에서 CPU 를 다 먹었다. 마크다운 HTML 은 끝에 한 번만 만든다.
  element.textContent = "";

  const interval = setInterval(() => {
    if (i >= text.length) {
      clearInterval(interval);
      element.innerHTML = formatMarkdownToHtml(text);
      if (text.trim()) ensureAiCopyButton(bubble);
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

// 워커 에러(영어 코드)를 한국어로. 표는 community.js 의 MIR_WORKER_ERROR_KO 를 함께 쓴다
// (index.html 에서 community.js 가 먼저 로드되고, 호출은 전부 로드 후에 일어난다).
function aiWorkerErrorMessage(err, fallback) {
  if (!err) return fallback || "요청을 처리하지 못했습니다.";
  if (err.name === "AbortError") return "답변 생성을 중단했습니다.";
  const raw = String(err.message || "");
  const data = { error: err.code || raw, message: raw };
  if (typeof mirWorkerErrorKo === "function") return mirWorkerErrorKo(data, err.status || 0, fallback);
  return raw || fallback || "요청을 처리하지 못했습니다.";
}

// SSE done 프레임이 준 모델·RAG 출처 수를 답변 아래 한 줄로 남긴다.
function renderAiReplyMeta(msgEl, meta) {
  if (!msgEl || !meta) return;
  const bits = [];
  if (meta.model) bits.push(String(meta.model));
  const rag = Number(meta.ragCount);
  if (Number.isFinite(rag) && rag > 0) bits.push(`참고 자료 ${rag}건`);
  if (!bits.length) return;
  msgEl.querySelectorAll(".ai-reply-meta").forEach((el) => el.remove());
  const note = document.createElement("p");
  note.className = "ai-reply-meta muted font-small";
  note.textContent = bits.join(" · ");
  msgEl.appendChild(note);
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
    err.code = String((data && data.error) || ""); // forbidden_origin 등 — 한국어 변환용
    throw err;
  }
  const ctype = (res.headers.get("Content-Type") || "").toLowerCase();
  if (!ctype.includes("text/event-stream")) {
    const data = await res.json();
    return { reply: (data && data.reply) || "", streamed: false, aborted: false, meta: data ? { model: data.model || "", ragCount: Number((data.rag && data.rag.newsCount) || 0) } : null };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let full = "";
  let aborted = false;
  // 워커는 마지막에 `{done:true, model, rag:{newsCount, sources}}` 프레임을 보낸다
  // (yahoo-proxy.js:2647). 예전엔 이걸 버려서 어떤 모델이·무슨 근거로 답했는지 알 수 없었다.
  let meta = null;
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
        } else if (parsed.done) {
          meta = {
            model: typeof parsed.model === "string" ? parsed.model : "",
            ragCount: Number((parsed.rag && parsed.rag.newsCount) || 0),
            ragSources: Array.isArray(parsed.rag && parsed.rag.sources) ? parsed.rag.sources : [],
          };
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
  return { reply: full, streamed: true, aborted, meta };
}

async function sendAiChat(queryText = null, { skipCrossMarket = false } = {}) {
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
  // skipCrossMarket: ai-mode-welcome.js 가 이미 같은 해석기를 돌린 뒤 넘긴 질문이다
  // (시장 전환까지 await 하는 무거운 경로라 두 번 돌면 전환이 한 번 더 일어날 수 있다).
  if (!skipCrossMarket && !matchedStock && typeof resolveTickerAcrossMarkets === "function") {
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

  if (log) log.scrollTop = log.scrollHeight;
  
  const controller = aiStreamBegin();
  // 스트림이 중단되면 예약해 둔 rAF 페인트도 취소한다 — 예전엔 중단 후 도착한 rAF 가
  // 최종 렌더('(중단됨)' 표시)를 덮어썼고, AI 모드를 나간 뒤에도 분리된 DOM 에 썼다.
  let pendingPaintRaf = 0;
  const cancelPendingPaint = () => {
    if (pendingPaintRaf) { cancelAnimationFrame(pendingPaintRaf); pendingPaintRaf = 0; }
  };
  try {
    if (!LIVE_DATA_PROXY) throw new Error("no proxy configured");

    const stockContext = matchedTicker ? await buildStockChatContext(matchedTicker) : "";
    const bubbleDiv = typingBubble.querySelector(".msg-bubble");

    // 답변 확정(스트리밍/타이핑 종료) 시 공통 마무리: 이력 저장 + 배지 부착
    const finalizeReply = (replyText, abortedMark, { store = true } = {}) => {
      // 깨진 답변 대체 문구는 히스토리에 넣지 않는다 — 다음 질문의 컨텍스트로 실려
      // 나가면 모델이 그 문장을 대화 내용으로 착각한다.
      if (store) aiChatHistory.push({ role: "assistant", content: replyText, ts: Date.now() });
      // 로딩 문구 기준으로 미리 붙은 배지는 걷어내고 실제 답변 기준으로 다시 단다
      typingBubble.querySelectorAll(".ai-badge-tags-container").forEach((el) => el.remove());
      const badgesHtml = generateAiBadges(replyText);
      if (badgesHtml) {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = badgesHtml;
        typingBubble.insertBefore(tempDiv.firstChild, bubbleDiv);
      }
      if (abortedMark && bubbleDiv) {
        aiBubbleBody(bubbleDiv)?.insertAdjacentHTML("beforeend", `<span class="ai-abort-note muted">(중단됨)</span>`);
      }
      if (store && aiChatSessions[currentSessionId]) {
        aiChatSessions[currentSessionId].history = aiChatHistory;
        aiChatSessions[currentSessionId].timestamp = new Date().toISOString();
        saveAiSessionsToStorage();
        renderAiHistoryList();
      }
    };

    // 스트리밍 점진 렌더 — rAF 로 스로틀해 매 토큰마다 파싱 폭주를 막는다.
    let streamStarted = false;
    let latestFull = "";
    const paintStream = () => {
      pendingPaintRaf = 0;
      if (!bubbleDiv || !bubbleDiv.isConnected) return;
      setAiBubbleMarkdown(bubbleDiv, latestFull, { copyButton: false });
      if (log) log.scrollTop = log.scrollHeight;
    };
    const onDelta = (_delta, full) => {
      latestFull = full;
      if (!streamStarted) {
        streamStarted = true;
        typingBubble.classList.remove("typing");
        typingBubble.classList.add("is-streaming");
      }
      if (!pendingPaintRaf) pendingPaintRaf = requestAnimationFrame(paintStream);
    };

    const result = await requestAiChatReply({
      messages: aiChatHistory.slice(-10).map(({ role, content }) => ({ role, content })),
      stockContext,
      snapshotContext: buildMarketChatContext(),
      market: isKrMarket() ? "kr" : "us",
      searchHints: matchedTicker ? { tickers: [matchedTicker], companies: [matchedStock.company].filter(Boolean) } : {},
    }, { signal: controller.signal, onDelta });

    cancelPendingPaint();
    typingBubble.classList.remove("typing", "is-streaming");

    // 깨진 답변('of the. the of the…' 반복)은 화면에 남기지 않는다 — 워커 가드를 지나쳐도
    // 프런트에서 한 번 더 거른다(09-05 모바일 국내 모드에서 실제로 새어 나옴).
    const broken = typeof isDegenerateLlmText === "function" && result.reply && isDegenerateLlmText(result.reply, /[가-힣]/.test(text));
    if (broken) result.reply = "답변 생성이 불안정해 다시 시도해야 합니다. 같은 질문을 한 번 더 보내 주세요.";
    if (result.streamed) {
      const reply = result.reply || (result.aborted ? "" : "답변을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      if (bubbleDiv) {
        if (reply) setAiBubbleMarkdown(bubbleDiv, reply);
        else aiBubbleBody(bubbleDiv).innerHTML = `<span class="muted">답변이 중단되었습니다.</span>`;
      }
      if (reply) finalizeReply(reply, result.aborted, { store: !broken });
      else if (result.aborted && bubbleDiv) aiBubbleBody(bubbleDiv)?.insertAdjacentHTML("beforeend", ` <span class="ai-abort-note muted">(중단됨)</span>`);
    } else {
      // 구 워커(JSON) 폴백 — 오늘과 동일한 타이핑 라이터 렌더 유지
      const reply = result.reply || "답변을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.";
      typeWriterMarkdown(bubbleDiv, reply, () => finalizeReply(reply, false, { store: !broken }));
    }
    // SSE done 프레임이 준 모델·RAG 출처 수를 답변 아래에 남긴다(무엇을 근거로 답했는지).
    renderAiReplyMeta(typingBubble, result.meta);
  } catch (err) {
    cancelPendingPaint();
    typingBubble.classList.remove("typing", "is-streaming");
    const bubbleDiv = typingBubble.querySelector(".msg-bubble");
    const body = aiBubbleBody(bubbleDiv);
    if (body) {
      if (err && err.name === "AbortError") {
        body.innerHTML = `<span class="muted">답변 생성을 중단했습니다. <span class="ai-abort-note">(중단됨)</span></span>`;
      } else {
        body.textContent = aiWorkerErrorMessage(err, "지금은 AI 답변을 불러올 수 없습니다.");
      }
    }
  } finally {
    cancelPendingPaint();
    aiStreamEnd(controller);
    aiChatBusy = false;
  }
}

// ai-mode-welcome.js 가 쓰는 창구. 웰컴 화면이 submit 을 capture 단계에서 가로채므로
// 폼 경로로는 sendAiChat 에 닿을 수 없다. 종목이 아닌 질문은 웰컴이 여기로 넘긴다.
// resolveTicker 도 함께 넘겨, 웰컴이 자체 해석기를 따로 두지 않게 한다
// (자체 해석기는 문자열 전체가 티커일 때만 맞아서 "NVDA 분석해줘" 를 놓쳤다).
window.MirAiChat = {
  // opts.skipCrossMarket: 웰컴이 이미 resolveTickerAcrossMarkets 를 돌렸으면 다시 돌리지 않는다.
  send: (text, opts) => sendAiChat(text, opts),
  resolveTicker: (text) => extractStockTickerFromQuery(text),
  // AI 모드를 나갈 때 진행 중인 /chat 스트림을 끊는 창구. 예전엔 나가도 스트림이
  // 계속 흘러 과금이 이어졌고, 분리된 DOM 에 rAF 로 innerHTML 을 썼다.
  abort: () => aiAbortAllStreams(),
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
    msg.innerHTML = `${badgesHtml}<div class="msg-bubble"><div class="msg-md"></div></div>`;
    setAiBubbleMarkdown(msg.querySelector(".msg-bubble"), content);
  }

  log.appendChild(msg);
  log.scrollTop = log.scrollHeight;
  return msg;
}

const aiLiveDataPromises = {};

async function ensureAiWidgetStock(ticker) {
  const base = stockByTicker(ticker) || data.stocks.find((row) => row.ticker === ticker);
  if (!base) return null;
  await Promise.all([
    loadStockDetail(ticker),
    // 뒤쪽 패널(컨센서스·목표주가·옵션·연방계약·FINRA·배당/실적 예정일)이 쓰는 지연 데이터도 기다린다 —
    // 두 번째 paint 전에 도착하지 않으면 그 패널이 통째로 빠졌다(390px 에서 컨센서스 패널이 안 뜨던 경합).
    ...["inst13f", "insider", "short", "congress", "activist", "events",
      "analystConsensus", "usPriceTargets", "optionsStats", "federalContracts", "finraShort", "usCalendar"].map((key) =>
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
      <strong>${escapeHtml(value || "—")}</strong>
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
    `섹터 평균 ${fmtPct(sectorAvg)} · 종목 ${fmtDailyPct(item.changePct)} · RS 순위 ${rank || "—"}/${ranked.length || "—"}`,
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
  // 8-K/실적 이벤트는 US 전용 수집물이다. KR 은 market_config 의 materialEvents:false 로
  // 꺼져 있고(없는 데이터는 기능을 끈다), KR 공시는 aiKrEventsPanel 이 따로 그린다.
  if (!aiPanelEnabled("materialEvents")) return "";
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
  ].filter(Boolean).join("");
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
      <strong class="${metric.tone || ""}">${escapeHtml(String(metric.value ?? "—"))}</strong>
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
    { label: "거래량", value: `${Number(item.volumeRatio || 0).toFixed(1)}x`, detail: "평균 대비" },
    // 예전에는 스냅샷 RSI와 실측 RSI(14) 칸이 나란히 둘 다 있었다 — 같은 지표가 두 칸.
    { label: "RSI(14)", value: rsi == null ? "—" : rsi.toFixed(1), detail: "상대강도지수", tone: rsi >= 70 ? "warn" : rsi <= 30 ? "pos" : "" },
    { label: "MACD", value: macd == null ? "—" : macd.toFixed(2), detail: signal == null ? "" : `Signal ${signal.toFixed(2)}`, tone: macd != null && signal != null ? cls(macd - signal) : "" },
    { label: "SMA20", value: sma20 == null ? "—" : chartPriceLabel(sma20), tone: last != null && sma20 != null ? cls(last - sma20) : "" },
    { label: "SMA60", value: sma60 == null ? "—" : chartPriceLabel(sma60), tone: last != null && sma60 != null ? cls(last - sma60) : "" },
  ]));
}

function aiFundamentalPanel(item) {
  const f = normalizedFundamentalsForItem(item);
  return aiModePanel("밸류에이션", "재무·가치", aiMetricGrid([
    { label: "시가총액", value: fmtBillions(f.marketCapDisplay ?? f.marketCapB ?? item.marketCapB) },
    { label: f.peLabel || "PER", value: fmtMultiple(f.pe) },
    { label: "Forward PER", value: fmtMultiple(f.forwardPE) },
    { label: "P/S", value: fmtMultiple(f.ps) },
    { label: "EPS Next Y", value: moneyOrDash(f.epsNextY) },
    { label: "매출", value: fmtFinancialB(f.salesB) },
    { label: "순이익", value: fmtFinancialB(f.incomeB) },
    { label: "ROE", value: fmtPercent(f.roe) },
  ]));
}

// 뉴스 링크는 외부(워커 프록시 → 야후/구글뉴스)에서 온 문자열이다. javascript: · data:
// 같은 스킴이 섞이면 클릭 한 번으로 스크립트가 돈다 — http(s) 만 통과시킨다.
// app.js 에 전역 safeHttpHref 가 생기면 그쪽을 쓰고, 없으면 여기 로컬 검사로.
function _href(raw) {
  if (typeof safeHttpHref === "function") return safeHttpHref(raw);
  const url = String(raw || "").trim();
  return /^https?:\/\//i.test(url) ? url : "#";
}

function aiNewsPanel(item) {
  const news = Array.isArray(item.news) ? item.news : [];
  const rows = news.slice(0, 8).map((newsItem) => {
    const href = _href(newsItem.url || newsItem.link);
    const title = escapeHtml(newsItem.title || "제목 없음");
    const source = escapeHtml(newsItem.source || newsItem.publisher || "뉴스");
    const time = escapeHtml(newsItem.time || newsItem.publishedAt || "");
    return [
      `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${title}</a>`,
      source,
      time || "—",
    ];
  });
  return aiModePanel("뉴스", `${news.length}건`, aiMiniTable(["헤드라인", "출처", "시간"], rows, "이 종목의 뉴스가 아직 수집되지 않았습니다."), "is-wide ai-news-dup");
}

function aiEventsPanel(item) {
  if (!aiPanelEnabled("materialEvents")) return ""; // KR: 8-K·실적 빈 상자 방지
  const events = ((window.MATERIAL_EVENTS || {}).events || []).filter((event) => String(event.ticker || "").toUpperCase() === item.ticker);
  const rows = events.slice(0, 8).map((event) => {
    const labels = (event.items || []).map((entry) => entry.label).filter(Boolean).slice(0, 3).join(", ") || event.type || "—";
    return [
      escapeHtml(event.fileDate || event.date || "—"),
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
    ...(isKrMarket() ? [] : [escapeHtml(stockSubLabel(row))]),
    `<span class="${cls(row.changePct)}">${fmtDailyPct(row.changePct)}</span>`,
    fmtRsi(row),
  ]);
  return aiModePanel("섹터 흐름", `${item.sector || "—"} 3개월 강도`, aiMiniTable(isKrMarket() ? ["#", "종목", "당일", "RSI"] : ["#", "티커", "회사", "당일", "RSI"], rows, "동일 섹터 비교 데이터가 없습니다."));
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
    escapeHtml(row.date || row.filingDate || "—"),
    escapeHtml(row.owner || row.name || row.insider || "—"),
    `<span class="${row.kind === "buy" ? "pos" : row.kind === "sell" ? "neg" : "muted"}">${escapeHtml(({ buy: "매수", sell: "매도" })[row.kind] || row.kind || row.transaction || "—")}</span>`,
    escapeHtml(row.valueText || (row.valueM ? `$${Number(row.valueM || 0).toFixed(1)}M` : row.shares ? `${row.shares}주` : "—")),
  ]);
  return aiModePanel("내부자 거래", "Form 4", aiMiniTable(["일자", "내부자", "구분", "규모"], rows, "최근 내부자 거래 데이터가 없습니다."));
}

function aiCongressPanel(item) {
  if (!aiPanelEnabled("congress")) return "";
  const meta = ((window.CONGRESS_TRADES || {}).byTicker || {})[item.ticker];
  const recent = ((window.CONGRESS_TRADES || {}).trades || []).filter((row) => row.ticker === item.ticker);
  const summary = meta ? aiMetricGrid([
    { label: "순매수", value: meta.netBuys ?? "—" },
    { label: "순매도", value: meta.netSells ?? "—" },
    { label: "정치인 수", value: meta.politicianCount ?? "—" },
  ]) : "";
  const rows = recent.slice(0, 6).map((row) => [
    escapeHtml(row.transactionDate || row.date || "—"),
    escapeHtml(row.representative || row.politician || "—"),
    `<span class="${String(row.side || "").toLowerCase().includes("buy") ? "pos" : String(row.side || "").toLowerCase().includes("sell") ? "neg" : "muted"}">${escapeHtml(row.side || row.type || "—")}</span>`,
    escapeHtml(row.amount || row.amountText || "—"),
  ]);
  return aiModePanel("의회 매매", "PTR", summary + aiMiniTable(["일자", "인물", "구분", "규모"], rows, meta ? "상세 거래 목록이 없습니다." : "의회 매매 데이터가 없습니다."));
}

function aiInstitutionalPanel(item) {
  if (!aiPanelEnabled("sec13f") && !aiPanelEnabled("activist")) return "";
  const f13 = (typeof inst13fIndex === "function" ? inst13fIndex() : {})[item.ticker];
  const act = ((window.ACTIVIST_STAKES || {}).filings || []).filter((row) => row.ticker === item.ticker);
  const body = aiMetricGrid([
    { label: "13F 보유기관", value: f13 ? `${f13.holders}곳` : "—" },
    { label: "13F 평가액", value: f13 ? `$${(Number(f13.valueM || 0) / 1000).toFixed(1)}B` : "—" },
    { label: "13D/G", value: act.length ? `${act.length}건` : "—" },
    { label: "액티비스트", value: act.filter((row) => row.kind === "activist").length || "—" },
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
    { label: "변화율", value: Number.isFinite(Number(shortRow.changePct)) ? fmtPct(shortRow.changePct) : "—", tone: cls(shortRow.changePct) },
    { label: isBal ? "공매도 잔고" : "공매도 수량", value: shares ? Number(shares).toLocaleString() : "—" },
    { label: "기준일", value: shortRow.settlementDate || shortRow.date || "—" },
  ]));
}

function aiEarningsPanel(item) {
  if (!aiPanelEnabled("earningsCalendar")) return "";
  const earnings = item.liveEarnings || {};
  const reactions = earningsReactionRows(item).slice(0, 4).map((row) => [
    escapeHtml(row.date || "—"),
    row.surprise == null ? "—" : `<span class="${cls(row.surprise)}">${fmtPct(row.surprise)}</span>`,
    row.post5 == null ? "—" : `<span class="${cls(row.post5)}">${fmtPct(row.post5)}</span>`,
  ]);
  const next = aiMetricGrid([
    { label: "다음 실적", value: earnings.nextDate || "—" },
    { label: "EPS 예상", value: earnings.epsEstimate ?? "—" },
    { label: "EPS", value: fmtEps(item) },
  ]);
  return aiModePanel("실적", "캘린더·반응", next + aiMiniTable(["발표일", "EPS 서프라이즈", "발표 후 5D"], reactions, "실적 발표 반응 데이터가 부족합니다."));
}

function aiDataQualityPanel(item) {
  const f = normalizedFundamentalsForItem(item);
  const chartRows = getChartRows(item);
  const missing = missingFundamentalFields(f);
  return aiModePanel("데이터 품질", "출처", aiMetricGrid([
    { label: "데이터 기준", value: data.updatedAtKst || data.updated_at_kst || "—" },
    { label: "가격 이력", value: `${chartRows.length.toLocaleString()}거래일`, detail: sourceLabel(item.historySource) },
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
  if (dv) bits.push({ label: "배당", value: Number.isFinite(dv.yieldPct) ? `${dv.yieldPct.toFixed(2)}% · 기준일 ${dv.recordDate || "—"}` : `기준일 ${dv.recordDate || "—"}` });
  const ct = ((window.KR_CONTRACTS || {}).rows || []).find((r) => r.ticker === t);
  if (ct && Number.isFinite(ct.salesRatio)) bits.push({ label: "수주", value: `매출대비 ${ct.salesRatio.toFixed(1)}%` });
  const er = ((window.KR_EARNINGS_REACTIONS || {}).rows || []).find((r) => r.ticker === t);
  if (er) bits.push({ label: "실적발표", value: `${er.date} · 공시일 ${fmtPct(er.dayPct)} · 익일 ${fmtPct(er.nextPct)}`, tone: cls(er.dayPct) });
  if (!bits.length) return aiModePanel("KR 이벤트·수급", "공시 종합", `<p class="muted ai-mode-empty">최근 공시·수급 이벤트가 없습니다.</p>`);
  return aiModePanel("KR 이벤트·수급", "공시 종합", aiMetricGrid(bits));
}

// 종목 체력 스노우플레이크 · 팩터 스코어 · 위험 · 유사종목 — 본문은 stock-health.js 가 만들고
// 종목 상세(밸류·개요 탭)와 같이 쓴다. 여기서는 AI 대시보드 패널로 감싸기만 한다.
function aiSnowflakePanel(item) {
  const body = typeof stockSnowflakeBodyHtml === "function" ? stockSnowflakeBodyHtml(item) : "";
  return body ? aiModePanel("종목 체력", "스노우플레이크 · 절대 기준 재무 체크", body) : "";
}

// 역DCF(dcf.js) — 재무 확장 파일(SEC/DART)의 FCF·희석 주식수·순차입금으로 '현재가에 들어 있는 성장률' 을 역산.
// 예전의 고정 가정 DCF(할인율 9%·영구성장 2.5%, P/FCF 로 FCF 역추정)는 이것으로 대체했다.
// 재무 파일·금리·기저율이 아직 없으면 자리(data-dcf-ai)만 두고 받아지는 대로 바꿔 끼운다. 재무 파일이 없는 종목은 패널 없음.
function aiDcfPanel(item) {
  if (!item || !item.ticker || typeof financialsCached !== "function" || typeof dcfAiPanelHtml !== "function") return "";
  const file = financialsCached(item.ticker);
  if (file === null) return "";
  const inputsReady = window.DCF_BASE_RATES && (typeof dcfRiskFree === "function" && dcfRiskFree());
  if (file && inputsReady) return dcfAiPanelHtml(item, file);
  setTimeout(() => hydrateDcfAiPanels(item), 0);
  return `<div data-dcf-ai="${escapeHtml(dcfKey(item.ticker))}" hidden></div>`;
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
  // 재무 확장 데이터(financials.js, SEC/DART 종목별 파일)가 있으면 그쪽으로. 아직 안 받았으면
  // 옛 financialsHistory 표를 자리(data-fin-ai)에 두고 받아지는 대로 바꿔 끼운다.
  if (item && item.ticker && typeof financialsCached === "function") {
    const file = financialsCached(item.ticker);
    if (file) return financialsAiPanelHtml(file);
    if (file === undefined && typeof hydrateFinancialsAiPanels === "function") {
      const key = mfTickerKey(item.ticker);
      setTimeout(() => hydrateFinancialsAiPanels(item.ticker), 0);
      const legacy = aiLegacyFinancialsPanel(item);
      return legacy ? `<div data-fin-ai="${escapeHtml(key)}">${legacy}</div>` : `<div data-fin-ai="${escapeHtml(key)}" hidden></div>`;
    }
  }
  return aiLegacyFinancialsPanel(item);
}
function aiLegacyFinancialsPanel(item) {
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

function aiRiskPanel(item) {
  const body = typeof stockRiskBodyHtml === "function" ? stockRiskBodyHtml(item) : "";
  return body ? aiModePanel("위험 · 시즈널리티", "가격 이력 기반 · 과거 통계", body) : "";
}
function aiFactorPanel(item) {
  const body = typeof stockFactorPctBodyHtml === "function" ? stockFactorPctBodyHtml(item) : "";
  return body ? aiModePanel("팩터 스코어", "시장 전체 백분위 · 예측 아님", body) : "";
}
function aiPeerPanel(item) {
  const body = typeof stockPeerBodyHtml === "function" ? stockPeerBodyHtml(item) : "";
  return body ? aiModePanel("유사종목 비교", `${stockPeerBasis(item)} · 시총순`, body) : "";
}

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

// 애널리스트 컨센서스 — 추천 분포(강력매수~강력매도) + 분기 EPS 서프라이즈(Finnhub)
// + 목표주가 범위(Nasdaq US_PRICE_TARGETS, company-info.js 의 범위 바를 자리에 늦게 채운다).
// 참고용이며 예측·매매 신호가 아니다.
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
  const ptSlot = typeof priceTargetSlotHtml === "function" ? priceTargetSlotHtml(item) : "";
  const note = `<p style="font-size:var(--fs-cap);color:var(--muted);margin:10px 0 0;line-height:1.65">출처: Finnhub(추천 분포·EPS 서프라이즈) · Nasdaq(목표주가) · Yahoo(실적 예정일). 애널리스트 추정치이며 예측이나 투자 권유가 아닙니다.</p>`;
  return aiModePanel("애널리스트 컨센서스", "추천 분포 · 목표주가 · EPS 서프라이즈", nextHtml + recHtml + ptSlot + earnHtml + note);
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

// 산업 선행지표 — 이 종목이 따라가는 지표 3개(INDUSTRY_BY_TICKER 역인덱스). 값은 빌드 시 계산한
// 서술 통계이고 주가 방향이 아니다. 데이터가 아직 없으면 받기만 시작하고 빈 문자열(다음 렌더에 뜬다).
function aiIndustryPanel(item) {
  if (!item || !item.ticker || typeof industryReverseIds !== "function") return "";
  const idx = window.INDUSTRY_BY_TICKER;
  const d = window.INDUSTRY_INDICATORS;
  if (!idx || !d) {
    if (typeof ensureFeatureData === "function") { ensureFeatureData("industryByTicker"); ensureFeatureData("industry"); }
    return "";
  }
  const ids = industryReverseIds(item.ticker).slice(0, 3);
  if (!ids.length) return "";
  const rt = "text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap";
  const rows = ids.map((id) => {
    const ind = d.indicators[id];
    if (!ind) return "";
    const yoy = ind.latest_yoy;
    const dir = (ind.regime || {}).direction;
    const dirLabel = { improving: "개선", deteriorating: "악화", flat: "보합" }[dir] || "—";
    return `<tr><td style="overflow:hidden"><strong class="ai-industry-link" data-ind="${escapeHtml(id)}" role="button" tabindex="0">${escapeHtml(ind.name_kr)}</strong><div style="font-size:var(--fs-cap);color:var(--muted)">${escapeHtml(ind.latest_date)} · ${escapeHtml(String(ind.source || "").replace(/\s*OpenAPI/gi, ""))}</div></td>
      <td style="${rt}">${escapeHtml(indFmtNum(ind.latest_value))}<div style="color:var(--muted);font-size:var(--fs-cap)">${escapeHtml(ind.unit || "")}</div></td>
      <td style="${rt}" class="${Number.isFinite(Number(yoy)) ? cls(Number(yoy)) : ""}">${yoy != null ? escapeHtml(indFmtSigned(yoy, "%", 1)) : "—"}</td>
      <td style="${rt}">${escapeHtml(dirLabel)}</td></tr>`;
  }).join("");
  const body = `<div class="ai-mode-table-wrap"><table class="ai-mode-table" style="table-layout:fixed;width:100%;min-width:0">
    <colgroup><col style="width:42%"><col style="width:22%"><col style="width:19%"><col style="width:17%"></colgroup>
    <thead><tr><th>지표</th><th style="text-align:right;white-space:nowrap">최신</th><th style="text-align:right;white-space:nowrap">전년비</th><th style="text-align:right;white-space:nowrap">방향</th></tr></thead>
    <tbody>${rows}</tbody></table></div>
    <div style="font-size:var(--fs-cap);color:var(--muted);margin-top:8px;line-height:1.65">이 종목의 업황을 앞서 보여 주는 공식 통계(FRED·TWSE·한국은행·OECD). 신호등은 증가율의 방향이며 주가 방향이 아닙니다. 지표명을 누르면 산업 지표 탭으로 갑니다.</div>`;
  return aiModePanel("산업 선행지표", "이 종목이 따라가는 지표 · 서술 통계", body);
}

function renderAiModeDataBoard(item) {
  return `
    <div class="ai-mode-data-board">
      ${aiTechnicalPanel(item)}
      ${aiSnowflakePanel(item)}
      ${typeof aiFactorGradePanel === "function" ? aiFactorGradePanel(item) : ""}
      ${aiDcfPanel(item)}
      ${aiFactorPanel(item)}
      ${aiRiskPanel(item)}
      ${aiPeerPanel(item)}
      ${aiIndustryPanel(item)}
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

// 블록을 Claude 웹처럼 순차적으로 blur-in 리빌.
function revealAiBlocksStaggered(container, step = 130) {
  if (!container) return;
  const blocks = Array.from(container.querySelectorAll(".ai-block.animate-reveal"));
  blocks.forEach((block, index) => {
    setTimeout(() => block.classList.add("reveal-active"), index * step);
  });
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
  const syncCollapseGlyph = () => {
    if (!collapseBtn) return;
    const collapsed = document.body.classList.contains("ai-dash-collapsed");
    // 모바일은 글자 있는 필(시트 위 가운데) — '›' 하나로는 무슨 버튼인지 알 수 없었다.
    const mobile = window.matchMedia && window.matchMedia("(max-width: 900px)").matches;
    collapseBtn.textContent = mobile ? (collapsed ? "정보 패널 보기" : "차트 크게 보기") : (collapsed ? "‹" : "›");
  };
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
        <span class="ai-dash-company">${joinSubParts(stockSubLabel(item), secKo)}</span>
      </div>
      <div class="ai-dash-price">
        <b>${priceOrDash(item.price)}</b>
        <span class="${chgCls}">${fmtDailyPct(chg)}</span>
      </div>
    </div>
    <div class="ai-dash-stats">
      ${stat("시가총액", fmtBillions(f.marketCapDisplay ?? f.marketCapB ?? item.marketCapB))}
      ${stat("목표주가", targetVal)}
      ${stat(f.peLabel || "PER", fmtMultiple(f.pe))}
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
    <a class="ai-dash-news-item" href="${escapeHtml(_href(n.url))}" target="_blank" rel="noopener">
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
    if (up >= 15) sig.push({ s: 1.5, k: "strength", t: `애널리스트 평균 목표가가 현재가보다 ${up.toFixed(0)}% 높음` });
    else if (up <= -5) sig.push({ s: -1, k: "risk", t: `현재가가 애널리스트 평균 목표가를 ${Math.abs(up).toFixed(0)}% 웃돎` });
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
// 스트리밍 페인트 rAF 핸들 — 스트림이 끝나거나 다른 종목으로 넘어가면 취소한다.
let dashPaintRaf = 0;
function cancelAiDashPaint() {
  if (dashPaintRaf) { cancelAnimationFrame(dashPaintRaf); dashPaintRaf = 0; }
}

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
      slot.innerHTML = `<div class="ai-verdict-llm-head">${headLabel}</div><div class="ai-verdict-llm-body">${formatMarkdownToHtml(stripEmoji(cached))}</div>`;
      return;
    }
  }
  if (!LIVE_DATA_PROXY) {
    if (custom) slot.innerHTML = `<div class="ai-verdict-llm-head">${headLabel}</div><p class="ai-verdict-llm-body muted">AI 답변을 지금 불러올 수 없습니다.</p>`;
    return;
  }
  slot.innerHTML = `<div class="ai-verdict-llm-head">${headLabel}</div><p class="ai-verdict-llm-body ai-verdict-llm-loading">작성 중…</p>`;
  // 이전 요청이 아직 흐르고 있으면 끊는다(종목 이동·칩 연타 대비)
  if (aiDashLlmController) {
    try { aiDashLlmController.abort(); } catch (_) { /* ignore */ }
    aiStreamEnd(aiDashLlmController);
  }
  cancelAiDashPaint(); // 직전 요청이 예약해 둔 rAF 가 새 답변을 덮지 않게
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
      cur.innerHTML = `<div class="ai-verdict-llm-head">${headLabel}</div><div class="ai-verdict-llm-body${loading ? " is-streaming" : ""}">${formatMarkdownToHtml(stripEmoji(text))}</div>`;
    };
    let latestFull = "";
    const onDelta = (_d, full) => {
      latestFull = full;
      if (dashPaintRaf) return;
      dashPaintRaf = requestAnimationFrame(() => { dashPaintRaf = 0; paint(latestFull, true); });
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
      cur.innerHTML = `<div class="ai-verdict-llm-head">${headLabel}</div><div class="ai-verdict-llm-body">${formatMarkdownToHtml(stripEmoji(reply))}${result.aborted ? ` <span class="ai-abort-note muted">(중단됨)</span>` : ""}</div>`;
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
        // 워커 에러코드(forbidden_origin 등)는 한국어로 옮겨 보여준다.
        const msg = aiWorkerErrorMessage(err, "지금은 AI 답변을 불러올 수 없습니다.");
        cur.innerHTML = `<div class="ai-verdict-llm-head">${headLabel}</div><p class="ai-verdict-llm-body muted">${escapeHtml(msg)}</p>`;
      }
    }
  } finally {
    cancelAiDashPaint();
    aiStreamEnd(controller);
    if (aiDashLlmController === controller) aiDashLlmController = null;
  }
}

window.MirDash = {
  render: renderAiStockDashboard,
  hide() {
    // 진행 중인 /chat 스트림을 먼저 끊는다 — 대시보드를 지우고 나면 rAF 페인트가
    // 분리된 DOM 을 건드리고, 끊지 않은 스트림은 계속 과금된다.
    aiAbortAllStreams();
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
      const query = `${stockInputValue(ticker)} 분석해줘`;
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

    // 자동완성 추천 입력 리스너. 200ms 디바운스(community.js:1451 과 같은 값) + 시총
    // 정렬 인덱스 우선 — 예전엔 키를 누를 때마다 전 종목(US 5천·KR 3천)을 풀스캔했다.
    const renderAutocomplete = (value) => {
      const stocks = (typeof data !== "undefined" && data && Array.isArray(data.stocks)) ? data.stocks : [];
      // app.js 의 tickerSearchIndex 는 시총 내림차순 + companyLower 가 미리 계산돼 있다.
      const pool = (typeof tickerSearchIndex !== "undefined" && tickerSearchIndex && Array.isArray(tickerSearchIndex.byMarketCap))
        ? tickerSearchIndex.byMarketCap
        : null;
      const hits = [];
      if (pool) {
        for (let i = 0; i < pool.length && hits.length < 5; i += 1) {
          const row = pool[i];
          if (String(row.ticker || "").toLowerCase().includes(value) || row.companyLower.includes(value)) {
            const full = stockByTicker(row.ticker);
            if (full) hits.push(full);
          }
        }
      } else {
        for (let i = 0; i < stocks.length && hits.length < 5; i += 1) {
          const s = stocks[i];
          // company 가 비어 있는 스냅샷 행(일부 ETF·신규상장)에서 toLowerCase 가 죽지 않게.
          if (String(s.ticker || "").toLowerCase().includes(value) || String(s.company || "").toLowerCase().includes(value)) hits.push(s);
        }
      }
      results = hits;

      if (results.length === 0) {
        hidePopup();
        return;
      }

      activeIndex = -1;
      popup.innerHTML = results.map((s, idx) => `
        <div class="autocomplete-item" data-ticker="${escapeHtml(s.ticker)}" data-index="${idx}">
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="ticker-badge">${escapeHtml(stockLabel(s))}</span>
            <span class="company-name">${escapeHtml(stockSubLabel(s) || (isKrCodeTicker(s.ticker) ? (stockByTicker(s.ticker)?.industry || "") : ""))}</span>
          </div>
          <span class="market-badge">${escapeHtml(autocompleteMarketBadge(s))}</span>
        </div>
      `).join("");
      popup.hidden = false;

      popup.querySelectorAll(".autocomplete-item").forEach((item) => {
        item.addEventListener("click", () => submitTicker(item.dataset.ticker));
      });
    };
    let autocompleteTimer = 0;
    input.addEventListener("input", () => {
      clearTimeout(autocompleteTimer);
      const value = input.value.trim().toLowerCase();
      if (value.length < 1) {
        hidePopup();
        return;
      }
      autocompleteTimer = setTimeout(() => renderAutocomplete(value), 200);
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
