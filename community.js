// 이 파일은 app.js 에서 기계적으로 분리된 코드다 (refactor/appjs-split-stage1).
// 커뮤니티 클러스터: 카드뉴스/SNS/게시판/투표/신고 (원본 app.js 14497-15814).
// index.html 에서 app.js 보다 먼저 로드되는 classic script. 최상위 function/let/const 는
// 전역 렉시컬 환경을 공유하므로 app.js 와 양방향 참조가 호출 시점에 해결된다.

const COMMUNITY_SNS_CHANNELS = [
  {
    id: "instagram",
    name: "Instagram",
    className: "sl-instagram",
    href: "https://www.instagram.com/seonu_dragon/",
    tag: "카드뉴스",
    desc: "매일 정리된 시장 카드뉴스와 핵심 차트를 이미지로 빠르게 확인할 수 있습니다.",
    cta: "인스타그램 보기",
  },
  {
    id: "x",
    name: "X (Twitter)",
    className: "sl-x",
    href: "https://x.com/dragon_seonu",
    tag: "장 전·후 요약",
    desc: "미국·국내 장 전·후 핵심 포인트를 짧게 정리해 올립니다. 실시간 시황 코멘트의 메인 채널입니다.",
    cta: "X 팔로우",
  },
  {
    id: "threads",
    name: "Threads",
    className: "sl-threads",
    href: "https://www.threads.com/@seonu_dragon",
    tag: "짧은 코멘트",
    desc: "시장 이슈에 대한 짧은 코멘트와 소식을 가볍게 받아볼 수 있습니다.",
    cta: "Threads 보기",
  },
  {
    id: "naver",
    name: "네이버 블로그",
    className: "sl-naver",
    href: "https://blog.naver.com/ted_inc",
    tag: "심층 분석",
    desc: "더 긴 호흡의 시장 분석, 데이터 해설, 투자 아이디어를 글로 깊게 읽을 수 있습니다.",
    cta: "블로그 방문",
  },
];

function getCardNewsSets() {
  const cn = data.cardNews || {};
  return {
    us: cn.us && Array.isArray(cn.us.images) && cn.us.images.length ? cn.us : null,
    kr: cn.kr && Array.isArray(cn.kr.images) && cn.kr.images.length ? cn.kr : null,
  };
}

function renderCommunityCardNews() {
  const block = byId("communityCardnewsBlock");
  const gallery = byId("communityCardnewsGallery");
  const titleEl = byId("communityCardnewsTitle");
  const switchEl = byId("communityCardnewsSwitch");
  if (!block || !gallery) return;

  const sets = getCardNewsSets();
  if (!sets.us && !sets.kr) {
    block.hidden = true;
    return;
  }
  block.hidden = false;
  if (!sets[communityCardnewsView]) communityCardnewsView = sets.us ? "us" : "kr";

  if (switchEl) {
    switchEl.querySelectorAll("[data-cn]").forEach((btn) => {
      const v = btn.dataset.cn;
      btn.disabled = !sets[v];
      btn.classList.toggle("is-active", v === communityCardnewsView && !!sets[v]);
      btn.onclick = () => {
        if (!sets[v] || v === communityCardnewsView) return;
        communityCardnewsView = v;
        renderCommunityCardNews();
      };
    });
  }

  const active = sets[communityCardnewsView];
  if (titleEl) {
    titleEl.textContent = active.title || (communityCardnewsView === "us" ? "미국 시장 카드뉴스" : "국내 시장 카드뉴스");
  }

  const cardHtml = (src, idx) => `
    <figure class="community-cardnews-card" data-idx="${idx}" role="button" tabindex="0" aria-label="카드뉴스 ${idx + 1} 크게 보기">
      <img src="${escapeHtml(src)}" alt="카드뉴스 ${idx + 1}" loading="lazy" decoding="async">
    </figure>
  `;
  const row3 = active.images.slice(0, 3);
  const row2 = active.images.slice(3);
  gallery.innerHTML = `
    <div class="community-cardnews-row community-cardnews-row-3">
      ${row3.map((src, idx) => cardHtml(src, idx)).join("")}
    </div>
    ${row2.length ? `
    <div class="community-cardnews-row community-cardnews-row-2">
      ${row2.map((src, idx) => cardHtml(src, idx + 3)).join("")}
    </div>
    ` : ""}
  `;

  gallery.querySelectorAll(".community-cardnews-card").forEach((card) => {
    const open = () => openLightbox(active.images, Number(card.dataset.idx) || 0);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });
}

function renderCommunityNews() {
  renderCommunityCardNews();
  const grid = byId("communitySnsGrid");
  if (!grid) return;
  grid.innerHTML = COMMUNITY_SNS_CHANNELS.map((ch) => `
    <article class="community-sns-card ${ch.className}">
      <div class="community-sns-head">
        <span class="community-sns-tag">${escapeHtml(ch.tag)}</span>
        <h3>${escapeHtml(ch.name)}</h3>
      </div>
      <p>${escapeHtml(ch.desc)}</p>
      <a class="community-sns-cta" href="${escapeHtml(ch.href)}" target="_blank" rel="noopener">${escapeHtml(ch.cta)} →</a>
    </article>
  `).join("");
}

function computeCommunityHotTopics(limit = 8) {
  const social = data.social_sentiment || {};
  const scores = new Map();
  const add = (ticker, weight, source) => {
    const t = String(ticker || "").toUpperCase();
    if (!t) return;
    const prev = scores.get(t) || { ticker: t, score: 0, sources: new Set() };
    prev.score += weight;
    prev.sources.add(source);
    scores.set(t, prev);
  };
  (social.reddit || []).forEach((item, idx) => add(item.ticker, Math.max(1, 12 - idx) + Math.min(6, (item.mentions || 0) / 200), "reddit"));
  (social.stocktwits || []).forEach((item, idx) => add(item.ticker, Math.max(1, 10 - idx), "stocktwits"));
  (social.yahoo || []).forEach((item, idx) => add(item.ticker, Math.max(1, 8 - idx), "yahoo"));
  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function renderCommunityHotTopics() {
  const el = byId("communityHotTopics");
  if (!el) return;
  const topics = computeCommunityHotTopics();
  if (!topics.length) {
    el.innerHTML = `<p class="muted">소셜 트렌드 데이터가 아직 없습니다. AI 브리핑 파이프라인 실행 후 표시됩니다.</p>`;
    return;
  }
  el.innerHTML = `
    <div class="community-hot-head">
      <strong>지금 가장 뜨거운 종목</strong>
      <span class="muted">Reddit · Stocktwits · Yahoo 종합</span>
    </div>
    <div class="community-hot-grid">
      ${topics.map((topic, idx) => {
        const stock = stockByTicker(topic.ticker);
        const sources = [...topic.sources].map((s) => ({
          reddit: "Reddit",
          stocktwits: "Stocktwits",
          yahoo: "Yahoo",
        }[s] || s)).join(" · ");
        const change = stock ? stock.changePct : null;
        return `
          <button type="button" class="community-hot-card" data-ticker="${escapeHtml(topic.ticker)}">
            <div class="community-hot-top">
              <span class="community-hot-rank">#${idx + 1}</span>
              <span class="community-hot-ticker">${escapeHtml(topic.ticker)}</span>
              <span class="community-hot-change ${change == null ? "" : cls(change)}">${change == null ? "—" : fmtDailyPct(change)}</span>
            </div>
            <span class="community-hot-name" title="${escapeHtml(stock ? stock.company : "")}">${escapeHtml(stock ? stock.company : "—")}</span>
            <span class="community-hot-sources">${escapeHtml(sources)}</span>
          </button>
        `;
      }).join("")}
    </div>
  `;
  el.querySelectorAll(".community-hot-card").forEach((card) => {
    card.addEventListener("click", () => openSocialTicker(card.dataset.ticker));
  });
}

function renderCommunityTrending() {
  renderSocialSentimentTables({
    reddit: "communityRedditTable",
    stocktwits: "communityStocktwitsTable",
    yahoo: "communityYahooTable",
  });
  renderCommunityHotTopics();
}

const COMMUNITY_NICKNAME_KEY = "mir_community_nickname_v1";
const COMMUNITY_CLIENT_KEY = "mir_community_client_v1";
const COMMUNITY_POLL_MS = 12000;

let communityPostsCache = [];
let communityBoardError = "";
let communityPollTimer = null;
let communityFetchPromise = null;
let communityReplyPostId = null;
let communitySortMode = "latest";
const COMMUNITY_PAGE_SIZE = 10;
let communityBoardPage = 1;
const COMMUNITY_MINICHART_KEY = "mir_community_minichart_v1";
let communityShowMiniChart = localStorage.getItem(COMMUNITY_MINICHART_KEY) !== "0";
// 새 글/댓글 배너용 — 마지막으로 본 글·댓글 id 집합(null이면 첫 로드 전).
let communitySeenPostIds = null;
let communitySeenCommentIds = null;
let communityNewCount = 0;
const COMMUNITY_HIDDEN_KEY = "mir_community_hidden_v1";
const COMMUNITY_ADMIN_KEY_LS = "mir_community_admin_key_v1";
let communityVotePeriod = "day";

function getCommunityHiddenIds() {
  try {
    const arr = JSON.parse(localStorage.getItem(COMMUNITY_HIDDEN_KEY) || "[]");
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (_) {
    return new Set();
  }
}

function addCommunityHiddenId(id) {
  const set = getCommunityHiddenIds();
  set.add(id);
  localStorage.setItem(COMMUNITY_HIDDEN_KEY, JSON.stringify([...set]));
}

function clearCommunityHiddenIds() {
  localStorage.removeItem(COMMUNITY_HIDDEN_KEY);
}

function getCommunityAdminKey() {
  return localStorage.getItem(COMMUNITY_ADMIN_KEY_LS) || "";
}

function setCommunityAdminKey(key) {
  if (key) localStorage.setItem(COMMUNITY_ADMIN_KEY_LS, String(key));
}

function isCommunityAdmin() {
  return Boolean(getCommunityAdminKey());
}

function getCommunityNickname() {
  return (localStorage.getItem(COMMUNITY_NICKNAME_KEY) || "").trim();
}

function setCommunityNickname(name) {
  localStorage.setItem(COMMUNITY_NICKNAME_KEY, String(name || "").trim().slice(0, 20));
}

function getCommunityClientId() {
  let id = localStorage.getItem(COMMUNITY_CLIENT_KEY);
  if (!id) {
    id = `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(COMMUNITY_CLIENT_KEY, id);
  }
  return id;
}

function communityApiUrl(path = "") {
  if (!LIVE_DATA_PROXY) return "";
  const base = LIVE_DATA_PROXY.replace(/\/$/, "");
  return `${base}${path}`;
}

function startCommunityPolling() {
  stopCommunityPolling();
  if (!LIVE_DATA_PROXY) return;
  communityPollTimer = setInterval(() => {
    if (currentTab === "community" && communitySubTab === "board") {
      fetchCommunityPosts({ silent: true });
    }
  }, COMMUNITY_POLL_MS);
}

function stopCommunityPolling() {
  if (communityPollTimer) {
    clearInterval(communityPollTimer);
    communityPollTimer = null;
  }
}

function resolveCommunityTickerInput(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";
  const direct = text.toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
  if (direct && stockByTicker(direct)) return direct;
  const resolved = resolveTickerQuery(text);
  return resolved || direct;
}

function formatCommunityTime(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

// 서버는 더 이상 clientId(=삭제 권한의 근거)나 좋아요 누른 사람 목록을 내려주지
// 않는다. 요청자 기준으로 계산된 mine/liked/likeCount 만 온다.
// `?? ` 폴백은 아직 옛 워커가 떠 있는 동안 UI 가 죽지 않게 하는 임시 경로다 —
// 워커를 재배포하면 응답에 likes/clientId 자체가 없어 자연히 새 경로만 탄다.
function communityLikeCount(post) {
  if (post && typeof post.likeCount === "number") return post.likeCount;
  return Array.isArray(post && post.likes) ? post.likes.length : 0;
}

function communityLikedByMe(post) {
  if (post && typeof post.liked === "boolean") return post.liked;
  return Array.isArray(post && post.likes) && post.likes.includes(getCommunityClientId());
}

// 이 글/댓글이 내 것인가. 서버 판정(mine)을 우선한다.
function communityIsMine(item) {
  if (item && typeof item.mine === "boolean") return item.mine;
  return Boolean(item) && item.clientId === getCommunityClientId();
}

function communityCommentCount(post) {
  return Array.isArray(post && post.comments) ? post.comments.length : 0;
}

function communityTimeVal(post) {
  const t = Date.parse(post && post.createdAt);
  return Number.isFinite(t) ? t : 0;
}

// 게시판에 등장한 작성자 닉네임 목록(긴 이름 우선 — 부분 일치 충돌 방지).
function communityKnownAuthors() {
  const names = new Set();
  communityPostsCache.forEach((p) => {
    if (p && p.author) names.add(p.author);
    (Array.isArray(p && p.comments) ? p.comments : []).forEach((c) => {
      if (c && c.author) names.add(c.author);
    });
  });
  return [...names].filter(Boolean).sort((a, b) => b.length - a.length);
}

// 본문·댓글의 @닉네임 멘션을 강조 span으로 변환한다(이미 escapeHtml 된 문자열에 적용).
// 닉네임에 공백이 있을 수 있어(예: "젠슨 황") 실제 참여자 이름만 1패스로 매칭한다.
function highlightCommunityMentions(escaped) {
  const text = String(escaped);
  const names = communityKnownAuthors();
  if (!names.length || text.indexOf("@") < 0) return text;
  const pattern = names
    .map((n) => escapeHtml(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const re = new RegExp(`@(${pattern})`, "g");
  return text.replace(re, (m, name) => `<span class="community-mention">@${name}</span>`);
}

// 종목 글 하단 미니 스파크라인(스냅샷 closeSeries 사용, 비동기 없음).
function communityMiniChartHtml(ticker) {
  if (!communityShowMiniChart) return "";
  const stock = ticker ? stockByTicker(ticker) : null;
  const series = stock && Array.isArray(stock.closeSeries) ? stock.closeSeries : null;
  if (!series || series.length < 2) return "";
  const color = (stock.changePct ?? 0) >= 0 ? "#138a4d" : "#c03535";
  return `<div class="community-post-spark">${sparklineSvg(series, { width: 160, height: 40, color })}</div>`;
}

// 닉네임 기반 일관 색상 아바타(로그인 없는 익명 작성자 시각 구분).
function communityAvatarColor(name) {
  const str = String(name || "익명");
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return `hsl(${hash % 360}, 55%, 45%)`;
}

function communityAvatarHtml(name) {
  const label = String(name || "익명").trim();
  const initial = label ? Array.from(label)[0].toUpperCase() : "?";
  return `<span class="community-avatar" style="background:${communityAvatarColor(label)}" aria-hidden="true">${escapeHtml(initial)}</span>`;
}

// ----- 신고: 신고자 본인 화면에서만 가림 + 관리자에게 신고 로그 전송 -----
async function reportCommunityPost(postId) {
  if (!postId) return;
  const reason = await showAppPrompt(
    "신고 사유를 적어주세요(선택). 신고한 글은 내 화면에서 가려지고, 관리자가 검토합니다.",
    "",
    { title: "글 신고", okLabel: "신고" },
  );
  if (reason === null) return; // 취소
  addCommunityHiddenId(postId);
  renderCommunityBoard();
  const url = communityApiUrl("/community/report");
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, clientId: getCommunityClientId(), reason: String(reason || "").slice(0, 200) }),
    });
  } catch (_) {}
}

// ===== 투표 페이지 (하루 1표 · 일/주/월 순위) =====
let communityVoteSelectedChoice = null;
let communityVoteMyToday = null;

const COMMUNITY_VOTE_META = {
  buy: { label: "매수", color: "var(--green)" },
  sell: { label: "매도", color: "var(--red)" },
};

function renderCommunityVote() {
  const choicesBox = byId("communityVoteChoices");
  if (choicesBox) {
    choicesBox.querySelectorAll(".community-vote-choice").forEach((btn) => {
      btn.classList.toggle("is-selected", btn.dataset.choice === communityVoteSelectedChoice);
    });
  }
  byId("communityVoteRankTabs")?.querySelectorAll(".community-rank-tab").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.period === communityVotePeriod);
  });
  const mine = byId("communityVoteMine");
  if (mine) {
    mine.textContent = communityVoteMyToday
      ? `오늘 내 투표: ${escapeHtml(communityVoteMyToday.ticker)} · ${COMMUNITY_VOTE_META[communityVoteMyToday.choice]?.label || communityVoteMyToday.choice} (다시 투표하면 교체됩니다)`
      : "오늘은 아직 투표하지 않았습니다.";
  }
  fetchCommunityVotes();
}

async function fetchCommunityVotes() {
  const box = byId("communityVoteRanking");
  if (!box) return;
  const url = communityApiUrl(`/community/votes?period=${encodeURIComponent(communityVotePeriod)}&clientId=${encodeURIComponent(getCommunityClientId())}`);
  if (!url) { box.innerHTML = `<div class="community-empty">투표 기능을 사용할 수 없습니다.</div>`; return; }
  box.innerHTML = `<div class="community-empty">순위를 불러오는 중…</div>`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "load_failed");
    communityVoteMyToday = data.myToday || null;
    const mine = byId("communityVoteMine");
    if (mine) {
      mine.textContent = communityVoteMyToday
        ? `오늘 내 투표: ${communityVoteMyToday.ticker} · ${COMMUNITY_VOTE_META[communityVoteMyToday.choice]?.label || communityVoteMyToday.choice} (다시 투표하면 교체됩니다)`
        : "오늘은 아직 투표하지 않았습니다.";
    }
    renderCommunityVoteRanking(data.buyRanking || [], data.sellRanking || [], data.totalVotes || 0);
  } catch (err) {
    box.innerHTML = `<div class="community-empty">순위를 불러오지 못했습니다.</div>`;
  }
}

function communityVoteRankColHtml(rows, kind) {
  const meta = COMMUNITY_VOTE_META[kind];
  if (!rows.length) {
    return `
      <div class="community-vote-rank-col">
        <h3 class="community-vote-rank-title community-vote-${kind}">${meta.label} 순위</h3>
        <div class="community-empty">아직 ${meta.label} 투표가 없습니다.</div>
      </div>`;
  }
  return `
    <div class="community-vote-rank-col">
      <h3 class="community-vote-rank-title community-vote-${kind}">${meta.label} 순위</h3>
      <div class="community-vote-rank-list">
        ${rows.map((row, i) => {
          const stock = stockByTicker(row.ticker);
          const count = kind === "buy" ? row.buy : row.sell;
          return `
            <div class="community-vote-rank-row">
              <span class="community-vote-rank-num">${i + 1}</span>
              <button type="button" class="ticker-pill community-vote-rank-ticker" data-ticker="${escapeHtml(row.ticker)}">${escapeHtml(row.ticker)}</button>
              <span class="community-vote-rank-company muted">${stock ? escapeHtml(stock.company) : ""}</span>
              <span class="community-vote-rank-count community-vote-${kind}">${count}표</span>
              <span class="community-vote-rank-sub muted">전체 ${row.total}</span>
            </div>`;
        }).join("")}
      </div>
    </div>`;
}

function renderCommunityVoteRanking(buyRanking, sellRanking, totalVotes) {
  const box = byId("communityVoteRanking");
  if (!box) return;
  const periodLabel = communityVotePeriod === "month" ? "월간" : communityVotePeriod === "week" ? "주간" : "일간";
  if (!buyRanking.length && !sellRanking.length) {
    box.innerHTML = `<div class="community-empty">${periodLabel} 투표가 아직 없습니다. 첫 투표를 남겨보세요.</div>`;
    return;
  }
  box.innerHTML = `
    <p class="muted community-vote-rank-meta">${periodLabel} 총 ${totalVotes}표</p>
    <div class="community-vote-rank-cols">
      ${communityVoteRankColHtml(buyRanking, "buy")}
      ${communityVoteRankColHtml(sellRanking, "sell")}
    </div>
  `;
  box.querySelectorAll(".community-vote-rank-ticker").forEach((btn) => {
    btn.addEventListener("click", () => openSocialTicker(btn.dataset.ticker));
  });
}

async function submitCommunityVote() {
  const tickerInput = byId("communityVoteTicker");
  const raw = (tickerInput?.value || "").trim();
  const ticker = raw ? resolveCommunityTickerInput(raw) : "";
  if (!ticker) { showAppToast("투표할 종목을 입력해주세요."); return; }
  if (!communityVoteSelectedChoice) { showAppToast("매수 또는 매도를 선택해주세요."); return; }
  const url = communityApiUrl("/community/vote");
  if (!url) { showAppToast("투표 기능을 사용할 수 없습니다."); return; }
  const btn = byId("communityVoteSubmit");
  if (btn) btn.disabled = true;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker, choice: communityVoteSelectedChoice, clientId: getCommunityClientId() }),
    });
    const data = await res.json();
    if (!res.ok) {
      showAppToast(data.message || data.error || "투표 실패", 3200);
      return;
    }
    communityVoteSelectedChoice = null;
    if (tickerInput) tickerInput.value = "";
    renderCommunityVote();
  } catch (err) {
    showAppToast((err && err.message) || "투표에 실패했습니다.", 3200);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ===== 관리자 신고 내역 패널 =====
async function renderCommunityAdminPanel() {
  const panel = byId("communityAdminPanel");
  if (!panel) return;
  if (!isCommunityAdmin()) { panel.hidden = true; panel.innerHTML = ""; return; }
  const url = communityApiUrl(`/community/reports?adminKey=${encodeURIComponent(getCommunityAdminKey())}`);
  if (!url) { panel.hidden = true; return; }
  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      panel.hidden = false;
      panel.innerHTML = `<div class="community-admin-head"><strong>관리자 · 신고 내역</strong></div><p class="muted">권한 확인 실패(키를 확인하세요).</p>`;
      return;
    }
    const posts = data.posts || [];
    panel.hidden = false;
    panel.innerHTML = `
      <div class="community-admin-head">
        <strong>관리자 · 신고 내역 ${posts.length}건</strong>
        <button type="button" class="ghost compact-btn" id="communityAdminRefresh">새로고침</button>
      </div>
      ${posts.length ? posts.map((p) => `
        <div class="community-admin-item">
          <div class="community-admin-item-head">
            <span class="community-admin-count">신고 ${p.reportCount}</span>
            ${p.ticker ? `<span class="community-post-tag">${escapeHtml(p.ticker)}</span>` : ""}
            <span class="community-post-author">${escapeHtml(p.author || "익명")}</span>
            <time class="muted">${escapeHtml(formatCommunityTime(p.createdAt))}</time>
            <button type="button" class="ghost compact-btn community-admin-delete" data-id="${escapeHtml(p.id)}">글 삭제</button>
          </div>
          <p class="community-admin-item-body">${escapeHtml(p.content)}</p>
          <p class="community-admin-reasons muted">사유: ${escapeHtml((p.reports || []).map((r) => r.reason || "(없음)").join(" · "))}</p>
        </div>
      `).join("") : `<p class="muted">신고된 글이 없습니다.</p>`}
    `;
    byId("communityAdminRefresh")?.addEventListener("click", renderCommunityAdminPanel);
    panel.querySelectorAll(".community-admin-delete").forEach((btn) => {
      btn.addEventListener("click", () => adminDeleteCommunityPost(btn.dataset.id));
    });
  } catch (_) {
    panel.hidden = true;
  }
}

async function adminDeleteCommunityPost(id) {
  if (!id) return;
  if (!await showAppConfirm("이 글을 삭제할까요?", { title: "관리자 삭제", okLabel: "삭제", danger: true })) return;
  const url = communityApiUrl("/community");
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, clientId: getCommunityClientId(), adminKey: getCommunityAdminKey() }),
    });
    const data = await res.json();
    if (!res.ok) { showAppToast(data.error || "삭제 실패", 3200); return; }
    await fetchCommunityPosts({ silent: true });
    renderCommunityAdminPanel();
  } catch (err) {
    showAppToast((err && err.message) || "삭제 실패", 3200);
  }
}

// ----- 작성 후 내 글로 스크롤 + 강조 -----
function communityHighlightPost(id) {
  setTimeout(() => {
    const feed = byId("communityFeed");
    const el = feed?.querySelector(`.community-post[data-id="${CSS.escape(id)}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("is-mine-new");
    setTimeout(() => el.classList.remove("is-mine-new"), 2400);
  }, 120);
}

// ----- 새 글/댓글 배너 -----
function communityCollectIds(posts) {
  const postIds = new Set();
  const commentIds = new Set();
  (posts || []).forEach((p) => {
    postIds.add(p.id);
    (Array.isArray(p.comments) ? p.comments : []).forEach((c) => commentIds.add(c.id));
  });
  return { postIds, commentIds };
}

function communityUpdateNewBanner(posts) {
  const { postIds, commentIds } = communityCollectIds(posts);
  if (communitySeenPostIds === null) {
    communitySeenPostIds = postIds;
    communitySeenCommentIds = commentIds;
    return;
  }
  let newPosts = 0;
  let newComments = 0;
  postIds.forEach((id) => { if (!communitySeenPostIds.has(id)) newPosts += 1; });
  commentIds.forEach((id) => { if (!communitySeenCommentIds.has(id)) newComments += 1; });
  communityNewCount += newPosts + newComments;
  const banner = byId("communityNewBanner");
  if (banner && communityNewCount > 0) {
    banner.hidden = false;
    banner.textContent = `새 소식 ${communityNewCount}건 · 맨 위로`;
  }
  communitySeenPostIds = postIds;
  communitySeenCommentIds = commentIds;
}

function communityClearNewBanner() {
  communityNewCount = 0;
  const banner = byId("communityNewBanner");
  if (banner) { banner.hidden = true; banner.textContent = ""; }
}

async function toggleCommunityLike(postId) {
  if (!postId) return;
  const url = communityApiUrl("/community/like");
  if (!url) {
    showAppToast("게시판을 일시적으로 사용할 수 없습니다.");
    return;
  }
  const clientId = getCommunityClientId();
  // 낙관적 업데이트(서버 응답 전 즉시 반영). 서버가 좋아요 누른 사람 목록을
  // 더 이상 내려주지 않으므로 집계값(likeCount/liked)만 뒤집는다.
  const cached = communityPostsCache.find((p) => p.id === postId);
  if (cached) {
    const liked = communityLikedByMe(cached);
    cached.liked = !liked;
    cached.likeCount = Math.max(0, communityLikeCount(cached) + (liked ? -1 : 1));
    delete cached.likes;   // 옛 워커가 준 배열이 남아 있으면 판정이 엇갈린다
    renderCommunityBoard();
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, clientId }),
    });
    const data = await res.json();
    if (!res.ok) {
      showAppToast(data.error === "no_community_kv" ? "게시판을 일시적으로 사용할 수 없습니다." : (data.error || "공감 처리 실패"), 3200);
    }
    await fetchCommunityPosts({ silent: true });
  } catch (err) {
    await fetchCommunityPosts({ silent: true });
  }
}

// 댓글의 작성자를 멘션하며 답글 입력칸을 연다(@닉네임 프리필).
function openCommunityReplyWithMention(postId, author) {
  const feed = byId("communityFeed");
  if (!feed) return;
  communityReplyPostId = postId;
  renderCommunityBoard();
  const input = feed.querySelector(`.community-reply-input[data-post-id="${CSS.escape(postId)}"]`);
  if (input) {
    const mention = `@${String(author || "익명").trim()} `;
    if (!input.value.startsWith(mention)) input.value = mention + input.value;
    input.focus();
    const end = input.value.length;
    try { input.setSelectionRange(end, end); } catch (_) {}
  }
}

// 인기 종목 토론 랭킹(글 수 기준 TOP5) 칩 렌더 + 클릭 시 해당 종목 필터.
function renderCommunityHotTickersPanel() {
  const box = byId("communityHotTickers");
  if (!box) return;
  const counts = new Map();
  communityPostsCache.forEach((p) => {
    if (p.ticker) counts.set(p.ticker, (counts.get(p.ticker) || 0) + 1);
  });
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (!top.length) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  const activeTicker = resolveCommunityTickerInput(byId("communityFilterTicker")?.value || "");
  box.hidden = false;
  box.innerHTML = `
    <span class="community-hot-tickers-label">인기 종목</span>
    ${top.map(([ticker, count]) => `
      <button type="button" class="community-hot-ticker${activeTicker === ticker ? " is-active" : ""}" data-ticker="${escapeHtml(ticker)}">
        ${escapeHtml(ticker)}<em>${count}</em>
      </button>
    `).join("")}
    ${activeTicker ? `<button type="button" class="community-hot-ticker community-hot-clear" data-clear="1">전체 보기</button>` : ""}
  `;
  box.querySelectorAll(".community-hot-ticker[data-ticker]").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyCommunityBoardTickerFilter(btn.dataset.ticker);
      renderCommunityBoard();
    });
  });
  box.querySelector(".community-hot-clear")?.addEventListener("click", () => {
    const input = byId("communityFilterTicker");
    if (input) input.value = "";
    communityBoardTickerFilter = "";
    communityBoardPage = 1;
    renderCommunityBoard();
  });
}

function filterCommunityPostsView(posts) {
  const filterMode = byId("communityFilter")?.value || "all";
  const filterTicker = resolveCommunityTickerInput(byId("communityFilterTicker")?.value || "");
  const clientId = getCommunityClientId();
  const hidden = getCommunityHiddenIds();
  let filtered = posts.filter((p) => !hidden.has(p.id));
  if (filterMode === "mine") {
    filtered = filtered.filter((p) => communityIsMine(p));
  } else if (filterMode === "watchlist") {
    const set = new Set((Array.isArray(watchlist) ? watchlist : []).map((t) => String(t).toUpperCase()));
    filtered = filtered.filter((p) => p.ticker && set.has(String(p.ticker).toUpperCase()));
  }
  if (filterTicker) {
    filtered = filtered.filter((p) => p.ticker === filterTicker);
  }
  // 정렬: 인기순(공감+댓글) / 댓글순 / 최신순
  if (communitySortMode === "popular") {
    filtered.sort((a, b) =>
      (communityLikeCount(b) + communityCommentCount(b)) - (communityLikeCount(a) + communityCommentCount(a))
      || communityTimeVal(b) - communityTimeVal(a));
  } else if (communitySortMode === "comments") {
    filtered.sort((a, b) => communityCommentCount(b) - communityCommentCount(a) || communityTimeVal(b) - communityTimeVal(a));
  } else {
    filtered.sort((a, b) => communityTimeVal(b) - communityTimeVal(a));
  }
  return filtered;
}

function renderCommunityBoard() {
  const feed = byId("communityFeed");
  const meta = byId("communityBoardMeta");
  const nickInput = byId("communityNickname");
  if (!feed || !meta) return;

  if (nickInput && !nickInput.value) nickInput.value = getCommunityNickname();

  const filterTicker = resolveCommunityTickerInput(byId("communityFilterTicker")?.value || "");
  const posts = filterCommunityPostsView(communityPostsCache);
  const clientId = getCommunityClientId();

  renderCommunityHotTickersPanel();
  renderCommunityAdminPanel();

  if (communityFetchPromise && !communityPostsCache.length && !communityBoardError) {
    meta.textContent = "글을 불러오는 중…";
    feed.innerHTML = `<div class="community-empty">게시판을 연결하는 중입니다.</div>`;
    return;
  }

  if (!posts.length) {
    meta.textContent = communityBoardError ? "글을 불러오지 못했습니다." : "아직 등록된 글이 없습니다. 첫 글을 남겨보세요.";
    feed.innerHTML = `<div class="community-empty">${communityBoardError ? "게시판 연결을 확인한 뒤 새로고침해 주세요." : "트렌딩 탭에서 관심 종목을 보고, 종목 없이도 시장 의견을 남길 수 있습니다."}</div>`;
    renderCommunityPagination(0);
    return;
  }

  // 10개 단위 페이지네이션
  const totalPages = Math.max(1, Math.ceil(posts.length / COMMUNITY_PAGE_SIZE));
  if (communityBoardPage > totalPages) communityBoardPage = totalPages;
  if (communityBoardPage < 1) communityBoardPage = 1;
  const pageStart = (communityBoardPage - 1) * COMMUNITY_PAGE_SIZE;
  const pagePosts = posts.slice(pageStart, pageStart + COMMUNITY_PAGE_SIZE);

  meta.textContent = `${posts.length}개 글${filterTicker ? ` · ${filterTicker} 필터` : ""}`
    + (totalPages > 1 ? ` · ${communityBoardPage}/${totalPages}페이지` : "");

  // 재렌더(특히 12초 자동 새로고침) 시 작성 중이던 댓글 입력이 사라지지 않도록
  // 열려 있는 답글 입력칸의 내용·커서·포커스를 미리 보존한다.
  const openReply = communityReplyPostId
    ? feed.querySelector(`.community-reply-input[data-post-id="${CSS.escape(communityReplyPostId)}"]`)
    : null;
  const replyDraft = openReply
    ? {
        value: openReply.value,
        start: openReply.selectionStart,
        end: openReply.selectionEnd,
        focused: document.activeElement === openReply,
      }
    : null;

  feed.innerHTML = pagePosts.map((post) => {
    const stock = post.ticker ? stockByTicker(post.ticker) : null;
    const canDelete = communityIsMine(post);
    const comments = Array.isArray(post.comments) ? post.comments : [];
    const replyOpen = communityReplyPostId === post.id;
    // 신고 누적 자동 숨김: 서버(hiddenByReports)가 작성자 본인에게만 이 마커를 실어
    // 준다 — 다른 사용자 목록에서는 글 자체가 빠지므로, 본인에게 상태를 안내한다.
    const hiddenByReports = Number(post.hiddenByReports) || 0;
    return `
      <article class="community-post${hiddenByReports ? " community-post-hidden" : ""}" data-id="${escapeHtml(post.id)}">
        ${hiddenByReports ? `
          <p class="muted" style="margin:0 0 6px;font-size:12px;padding:6px 10px;border:1px solid rgba(245,158,11,.35);border-radius:8px;background:rgba(245,158,11,.08);">
            신고 누적으로 숨김 처리됨 (신고 ${hiddenByReports}건) · 이 글은 작성자에게만 보입니다.
          </p>` : ""}
        <div class="community-post-head">
          ${post.ticker
            ? `<button type="button" class="ticker-pill community-post-ticker" data-ticker="${escapeHtml(post.ticker)}" title="이 종목 글만 보기">${escapeHtml(post.ticker)}</button>`
            : `<span class="community-post-tag">일반</span>`}
          ${communityAvatarHtml(post.author)}
          <span class="community-post-author">${escapeHtml(post.author || "익명")}</span>
          <time class="muted">${escapeHtml(formatCommunityTime(post.createdAt))}</time>
        </div>
        ${stock ? `<p class="community-post-company muted">${escapeHtml(stock.company)} · 당일 ${fmtDailyPct(stock.changePct)}</p>` : ""}
        ${post.ticker ? communityMiniChartHtml(post.ticker) : ""}
        <p class="community-post-body">${highlightCommunityMentions(escapeHtml(post.content))}</p>
        ${comments.length ? `
          <div class="community-comments">
            ${comments.map((comment) => {
              const canDeleteComment = communityIsMine(comment);
              const commentHidden = Number(comment.hiddenByReports) || 0;
              return `
                <div class="community-comment" data-comment-id="${escapeHtml(comment.id)}">
                  ${commentHidden ? `<p class="muted" style="margin:0 0 4px;font-size:11px;">신고 누적으로 숨김 처리됨 (신고 ${commentHidden}건) · 작성자에게만 보입니다.</p>` : ""}
                  <div class="community-comment-head">
                    <span class="community-comment-author">${escapeHtml(comment.author || "익명")}</span>
                    <time class="muted">${escapeHtml(formatCommunityTime(comment.createdAt))}</time>
                    <div class="community-comment-actions">
                      <button type="button" class="ghost compact-btn community-comment-reply" data-post-id="${escapeHtml(post.id)}" data-author="${escapeHtml(comment.author || "익명")}">답글</button>
                      ${canDeleteComment ? `<button type="button" class="ghost compact-btn community-comment-delete" data-post-id="${escapeHtml(post.id)}" data-comment-id="${escapeHtml(comment.id)}">삭제</button>` : ""}
                    </div>
                  </div>
                  <p class="community-comment-body">${highlightCommunityMentions(escapeHtml(comment.content))}</p>
                </div>
              `;
            }).join("")}
          </div>
        ` : ""}
        <div class="community-post-actions">
          <button type="button" class="ghost compact-btn community-post-like${communityLikedByMe(post) ? " is-liked" : ""}" data-post-id="${escapeHtml(post.id)}" aria-pressed="${communityLikedByMe(post)}"><span class="community-like-count">${communityLikeCount(post)}</span></button>
          <button type="button" class="ghost compact-btn community-post-reply" data-post-id="${escapeHtml(post.id)}">${comments.length ? `댓글 ${comments.length}개 · 답글` : "댓글 달기"}</button>
          ${post.ticker ? `<button type="button" class="ghost compact-btn community-post-analyze" data-ticker="${escapeHtml(post.ticker)}">종목 분석</button>` : ""}
          ${canDelete
            ? `<button type="button" class="ghost compact-btn community-post-delete" data-id="${escapeHtml(post.id)}">삭제</button>`
            : `<button type="button" class="ghost compact-btn community-post-report" data-post-id="${escapeHtml(post.id)}" title="부적절한 글 신고">신고</button>`}
        </div>
        ${replyOpen ? `
          <div class="community-reply-form">
            <textarea class="community-reply-input" data-post-id="${escapeHtml(post.id)}" rows="2" placeholder="댓글을 입력하세요 (2자 이상)"></textarea>
            <div class="community-reply-actions">
              <button type="button" class="community-reply-submit" data-post-id="${escapeHtml(post.id)}">댓글 등록</button>
              <button type="button" class="ghost community-reply-cancel" data-post-id="${escapeHtml(post.id)}">취소</button>
              <span class="community-reply-hint muted">Ctrl·⌘+Enter로 등록</span>
            </div>
          </div>
        ` : ""}
      </article>
    `;
  }).join("");

  feed.querySelectorAll(".community-post-ticker").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyCommunityBoardTickerFilter(btn.dataset.ticker);
      renderCommunityBoard();
    });
  });
  feed.querySelectorAll(".community-post-analyze").forEach((btn) => {
    btn.addEventListener("click", () => {
      openSocialTicker(btn.dataset.ticker);
      scrollCommunityToChart();
    });
  });
  feed.querySelectorAll(".community-post-like").forEach((btn) => {
    btn.addEventListener("click", () => toggleCommunityLike(btn.dataset.postId));
  });
  feed.querySelectorAll(".community-post-report").forEach((btn) => {
    btn.addEventListener("click", () => reportCommunityPost(btn.dataset.postId));
  });
  feed.querySelectorAll(".community-comment-reply").forEach((btn) => {
    btn.addEventListener("click", () => openCommunityReplyWithMention(btn.dataset.postId, btn.dataset.author));
  });
  feed.querySelectorAll(".community-post-delete").forEach((btn) => {
    btn.addEventListener("click", () => deleteCommunityPost(btn.dataset.id));
  });
  feed.querySelectorAll(".community-post-reply").forEach((btn) => {
    btn.addEventListener("click", () => {
      const postId = btn.dataset.postId;
      communityReplyPostId = communityReplyPostId === postId ? null : postId;
      renderCommunityBoard();
      if (communityReplyPostId === postId) {
        const input = feed.querySelector(`.community-reply-input[data-post-id="${CSS.escape(postId)}"]`);
        input?.focus();
      }
    });
  });
  feed.querySelectorAll(".community-reply-cancel").forEach((btn) => {
    btn.addEventListener("click", () => {
      communityReplyPostId = null;
      renderCommunityBoard();
    });
  });
  feed.querySelectorAll(".community-reply-submit").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const postId = btn.dataset.postId;
      const input = feed.querySelector(`.community-reply-input[data-post-id="${CSS.escape(postId)}"]`);
      if (btn.disabled) return;
      btn.disabled = true;
      const prevLabel = btn.textContent;
      btn.textContent = "등록 중…";
      try {
        await postCommunityComment(postId, input?.value || "");
      } finally {
        // 성공 시 폼이 재렌더로 사라지지만, 실패 시엔 버튼을 되살린다.
        btn.disabled = false;
        btn.textContent = prevLabel;
      }
    });
  });
  // Ctrl/⌘ + Enter 로 댓글 바로 등록
  feed.querySelectorAll(".community-reply-input").forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        postCommunityComment(input.dataset.postId, input.value || "");
      }
    });
  });
  feed.querySelectorAll(".community-comment-delete").forEach((btn) => {
    btn.addEventListener("click", () => deleteCommunityComment(btn.dataset.postId, btn.dataset.commentId));
  });

  // 보존해 둔 답글 입력 내용·커서·포커스를 복원한다.
  if (replyDraft && communityReplyPostId) {
    const nextReply = feed.querySelector(`.community-reply-input[data-post-id="${CSS.escape(communityReplyPostId)}"]`);
    if (nextReply) {
      nextReply.value = replyDraft.value;
      if (replyDraft.focused) {
        nextReply.focus();
        try { nextReply.setSelectionRange(replyDraft.start, replyDraft.end); } catch (_) {}
      }
    }
  }

  renderCommunityPagination(totalPages);
}

// 10개 단위 페이지네이션 컨트롤(< 1 2 3 >). totalPages<=1 이면 숨김.
function renderCommunityPagination(totalPages) {
  const box = byId("communityPagination");
  if (!box) return;
  if (!totalPages || totalPages <= 1) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  const page = communityBoardPage;
  const go = (p) => {
    communityBoardPage = Math.min(totalPages, Math.max(1, p));
    renderCommunityBoard();
    byId("communityFeed")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  // 현재 페이지 주변 최대 5개 번호만 노출
  const windowSize = 5;
  let from = Math.max(1, page - 2);
  let to = Math.min(totalPages, from + windowSize - 1);
  from = Math.max(1, to - windowSize + 1);
  const nums = [];
  for (let p = from; p <= to; p++) nums.push(p);
  box.hidden = false;
  box.innerHTML = `
    <button type="button" class="community-page-btn" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>‹</button>
    ${from > 1 ? `<button type="button" class="community-page-btn" data-page="1">1</button>${from > 2 ? `<span class="community-page-ellipsis">…</span>` : ""}` : ""}
    ${nums.map((p) => `<button type="button" class="community-page-btn${p === page ? " is-active" : ""}" data-page="${p}">${p}</button>`).join("")}
    ${to < totalPages ? `${to < totalPages - 1 ? `<span class="community-page-ellipsis">…</span>` : ""}<button type="button" class="community-page-btn" data-page="${totalPages}">${totalPages}</button>` : ""}
    <button type="button" class="community-page-btn" data-page="${page + 1}" ${page >= totalPages ? "disabled" : ""}>›</button>
  `;
  box.querySelectorAll(".community-page-btn").forEach((btn) => {
    if (btn.disabled) return;
    btn.addEventListener("click", () => go(Number(btn.dataset.page)));
  });
}

async function fetchCommunityPosts({ silent = false } = {}) {
  const url = communityApiUrl("/community");
  if (!url) {
    communityBoardError = "board_unavailable";
    communityPostsCache = [];
    renderCommunityBoard();
    return;
  }
  if (!silent) {
    const meta = byId("communityBoardMeta");
    if (meta) meta.textContent = "글을 불러오는 중…";
  }
  if (communityFetchPromise) return communityFetchPromise;

  communityFetchPromise = (async () => {
    try {
      // 서버가 "이 글이 요청자 것인가"를 판정할 수 있게 내 clientId 를 보낸다.
      // 응답에는 남의 clientId 가 실리지 않고 mine/liked 불리언만 온다.
      const listUrl = `${url}${url.includes("?") ? "&" : "?"}clientId=${encodeURIComponent(getCommunityClientId())}`;
      const res = await fetch(listUrl, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok && data.error !== "no_community_kv") {
        throw new Error(data.message || data.error || `HTTP ${res.status}`);
      }
      communityBoardError = data.error === "no_community_kv" ? "no_community_kv" : "";
      communityPostsCache = Array.isArray(data.posts) ? data.posts : [];
      communityUpdateNewBanner(communityPostsCache);
    } catch (err) {
      if (!silent) communityBoardError = (err && err.message) || "네트워크 오류";
      else if (!communityPostsCache.length) communityBoardError = (err && err.message) || "네트워크 오류";
    } finally {
      communityFetchPromise = null;
      if (currentTab === "community" && communitySubTab === "board") {
        // 자동(silent) 새로고침이 답글 작성 중인 입력칸을 건드리지 않도록,
        // 사용자가 답글 입력칸에 포커스를 둔 동안에는 재렌더를 건너뛴다.
        const active = document.activeElement;
        const typingReply = silent && active && active.classList
          && active.classList.contains("community-reply-input");
        if (!typingReply) renderCommunityBoard();
      }
      if (currentTab === "search" && searchSubTab === "analysis" && selectedTicker) {
        const base = stockByTicker(selectedTicker);
        if (base) renderStockEvents(applyLive(withDetail(base)));
      }
    }
  })();

  return communityFetchPromise;
}

async function postCommunityMessage() {
  const nickInput = byId("communityNickname");
  const contentInput = byId("communityContent");
  const postBtn = byId("communityPost");
  const author = (nickInput?.value || "").trim() || "익명";
  setCommunityNickname(author);
  const rawTicker = (byId("communityTicker")?.value || "").trim();
  const ticker = rawTicker ? resolveCommunityTickerInput(rawTicker) : "";
  const content = (contentInput?.value || "").trim();
  if (!content || content.length < 2) {
    showAppToast("의견을 2자 이상 입력해주세요.");
    return;
  }
  const url = communityApiUrl("/community");
  if (!url) {
    showAppToast("게시판을 일시적으로 사용할 수 없습니다.");
    return;
  }
  if (postBtn) postBtn.disabled = true;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        author,
        ticker: ticker || "",
        content,
        clientId: getCommunityClientId(),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data.error === "no_community_kv"
        ? "게시판을 일시적으로 사용할 수 없습니다."
        : (data.message || data.error || "등록 실패");
      showAppToast(msg, 3200);
      return;
    }
    if (contentInput) contentInput.value = "";
    communityBoardError = "";
    // 내 새 글이 필터/정렬에 가려지지 않도록 보기 상태를 초기화한 뒤 글로 스크롤·강조한다.
    const filterEl = byId("communityFilter");
    const tickerEl = byId("communityFilterTicker");
    const sortEl = byId("communitySort");
    if (filterEl) filterEl.value = "all";
    if (tickerEl) tickerEl.value = "";
    if (sortEl) sortEl.value = "latest";
    communityBoardTickerFilter = "";
    communitySortMode = "latest";
    communityBoardPage = 1;
    communityClearNewBanner();
    await fetchCommunityPosts();
    if (data.post && data.post.id) communityHighlightPost(data.post.id);
  } catch (err) {
    showAppToast((err && err.message) || "글 등록에 실패했습니다.", 3200);
  } finally {
    if (postBtn) postBtn.disabled = false;
  }
}

async function postCommunityComment(postId, rawContent) {
  const content = String(rawContent || "").trim();
  if (!postId || content.length < 2) {
    showAppToast("댓글을 2자 이상 입력해주세요.");
    return;
  }
  const nickInput = byId("communityNickname");
  const author = (nickInput?.value || "").trim() || getCommunityNickname() || "익명";
  setCommunityNickname(author);
  const url = communityApiUrl("/community/comment");
  if (!url) {
    showAppToast("게시판을 일시적으로 사용할 수 없습니다.");
    return;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postId,
        author,
        content,
        clientId: getCommunityClientId(),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showAppToast(data.error === "no_community_kv" ? "게시판을 일시적으로 사용할 수 없습니다." : (data.message || data.error || "댓글 등록 실패"), 3200);
      return;
    }
    communityReplyPostId = null;
    communityBoardError = "";
    await fetchCommunityPosts();
  } catch (err) {
    showAppToast((err && err.message) || "댓글 등록에 실패했습니다.", 3200);
  }
}

async function deleteCommunityComment(postId, commentId) {
  if (!postId || !commentId) return;
  if (!await showAppConfirm("이 댓글을 삭제할까요?", { title: "댓글 삭제", okLabel: "삭제", danger: true })) return;
  const url = communityApiUrl("/community/comment");
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postId,
        commentId,
        clientId: getCommunityClientId(),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showAppToast(data.error === "forbidden" ? "본인 댓글만 삭제할 수 있습니다." : (data.error || "삭제 실패"), 3200);
      return;
    }
    await fetchCommunityPosts();
  } catch (err) {
    showAppToast((err && err.message) || "댓글 삭제에 실패했습니다.", 3200);
  }
}

async function deleteCommunityPost(id) {
  if (!id) return;
  if (!await showAppConfirm("이 글을 삭제할까요?", { title: "글 삭제", okLabel: "삭제", danger: true })) return;
  const url = communityApiUrl("/community");
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, clientId: getCommunityClientId() }),
    });
    const data = await res.json();
    if (!res.ok) {
      showAppToast(data.error === "forbidden" ? "본인 글만 삭제할 수 있습니다." : (data.error || "삭제 실패"), 3200);
      return;
    }
    await fetchCommunityPosts();
  } catch (err) {
    showAppToast((err && err.message) || "삭제에 실패했습니다.", 3200);
  }
}

async function clearCommunityPostsMine() {
  if (!await showAppConfirm("이 브라우저에서 작성한 글을 모두 삭제할까요? 되돌릴 수 없습니다.", { title: "내 글 전체 삭제", okLabel: "모두 삭제", danger: true })) return;
  const url = communityApiUrl("/community/clear");
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: getCommunityClientId() }),
    });
    const data = await res.json();
    if (!res.ok) {
      showAppToast(data.message || data.error || "삭제 실패", 3200);
      return;
    }
    await fetchCommunityPosts();
  } catch (err) {
    showAppToast((err && err.message) || "삭제에 실패했습니다.", 3200);
  }
}

function setupCommunityBoard() {
  const nickInput = byId("communityNickname");
  const postBtn = byId("communityPost");
  if (!postBtn) return;

  if (nickInput) {
    nickInput.value = getCommunityNickname();
    nickInput.addEventListener("change", () => setCommunityNickname(nickInput.value));
    nickInput.addEventListener("blur", () => setCommunityNickname(nickInput.value));
  }

  postBtn.addEventListener("click", () => {
    postCommunityMessage().then(() => {
      if (currentTab !== "community" || communitySubTab !== "board") {
        activateTab("community", { push: true, sub: "board" });
      }
    });
  });

  // 본문 Ctrl/⌘+Enter 로 바로 등록
  byId("communityContent")?.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      postBtn.click();
    }
  });

  byId("communityRefresh")?.addEventListener("click", () => fetchCommunityPosts());
  byId("communityFilter")?.addEventListener("change", () => {
    communityBoardPage = 1;
    renderCommunityBoard();
  });
  byId("communitySort")?.addEventListener("change", (event) => {
    communitySortMode = event.target.value || "latest";
    communityBoardPage = 1;
    renderCommunityBoard();
  });
  byId("communityFilterTicker")?.addEventListener("input", () => {
    clearTimeout(setupCommunityBoard._filterTimer);
    setupCommunityBoard._filterTimer = setTimeout(() => {
      communityBoardPage = 1;
      renderCommunityBoard();
    }, 200);
  });
  byId("communityClearMine")?.addEventListener("click", clearCommunityPostsMine);

  const miniToggle = byId("communityMiniChartToggle");
  if (miniToggle) {
    miniToggle.checked = communityShowMiniChart;
    miniToggle.addEventListener("change", () => {
      communityShowMiniChart = miniToggle.checked;
      localStorage.setItem(COMMUNITY_MINICHART_KEY, communityShowMiniChart ? "1" : "0");
      renderCommunityBoard();
    });
  }

  byId("communityNewBanner")?.addEventListener("click", () => {
    communityClearNewBanner();
    byId("communityFeed")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // ----- 투표 페이지 -----
  const voteChoices = byId("communityVoteChoices");
  if (voteChoices) {
    voteChoices.querySelectorAll(".community-vote-choice").forEach((btn) => {
      btn.addEventListener("click", () => {
        communityVoteSelectedChoice = communityVoteSelectedChoice === btn.dataset.choice ? null : btn.dataset.choice;
        voteChoices.querySelectorAll(".community-vote-choice").forEach((b) =>
          b.classList.toggle("is-selected", b.dataset.choice === communityVoteSelectedChoice));
      });
    });
  }
  byId("communityVoteSubmit")?.addEventListener("click", submitCommunityVote);
  const rankTabs = byId("communityVoteRankTabs");
  if (rankTabs) {
    rankTabs.querySelectorAll(".community-rank-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        communityVotePeriod = btn.dataset.period || "day";
        rankTabs.querySelectorAll(".community-rank-tab").forEach((b) =>
          b.classList.toggle("is-active", b.dataset.period === communityVotePeriod));
        fetchCommunityVotes();
      });
    });
  }
  setupTickerAutocomplete("communityVoteTicker");
}

