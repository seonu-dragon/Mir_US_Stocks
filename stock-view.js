// stock-view.js — 종목 상세(종목 › 분석)의 좌측 요약 패널 + 본문 6탭 전환.
//
// 카드는 index.html 에서 탭별 컨테이너(#sdv-<view>)로 자리만 옮겼고, 각 카드를 그리는 함수
// (renderSearch → drawChart·renderFinancials·renderDcf …)는 그대로다. 여기서는
//   · 탭 전환과 &view= 딥링크(공유 링크의 &dcf= 는 밸류 탭으로)
//   · 탭에 보여 줄 카드가 하나도 없을 때 한 줄 안내
//   · AI 진단 첫 문장을 개요 탭에 한 줄로(리포트가 첫 화면을 차지하지 않게)
//   · 좌측 패널 sticky 기준 높이, 모바일 '투자정보 더보기'
// 만 맡는다. 숨은 탭은 display:none 이 아니라 화면 밖 배치(styles.css .sd-view)라서, 폭을
// 재서 그리는 SVG(재무·PER 밴드·DCF)를 숨은 탭에서 그려도 폭 0 으로 깨지지 않는다 —
// refreshFeatureViews 가 숨은 탭 카드를 다시 그려도 안전하다.
// 전역 이름은 sd 접두사(classic script 전역 공유).

const SD_VIEWS = ["overview", "fin", "val", "events", "flow", "ai"];
// 옛 이름·짧은 이름으로 온 링크도 받아 준다.
const SD_VIEW_ALIAS = {
  summary: "overview", chart: "overview", main: "overview",
  financials: "fin", financial: "fin", earnings: "fin",
  valuation: "val", dcf: "val", band: "val",
  event: "events", disclosure: "events", disclosures: "events",
  supply: "flow", holders: "flow", ownership: "flow", etf: "flow",
  report: "ai", diagnosis: "ai",
};

function sdNormalizeView(v) {
  const key = String(v || "").trim().toLowerCase();
  if (SD_VIEWS.includes(key)) return key;
  return SD_VIEW_ALIAS[key] || null;
}

// 첫 화면에서 열 탭: &view= > &dcf=(시나리오 공유 링크) > 개요.
function sdInitialView() {
  let p = null;
  try { p = new URLSearchParams(window.location.search); } catch (_) { return "overview"; }
  const v = sdNormalizeView(p.get("view"));
  if (v) return v;
  if (p.get("dcf")) return "val";
  return "overview";
}

let sdCurrentView = sdInitialView();

function sdActiveView() { return sdCurrentView; }

// URL 에 지금 종목·탭을 남긴다(공유·새로고침 시 같은 탭). 앱은 탭 전환마다 URL 을 바꾸지 않으므로
// 사용자가 종목 상세 탭을 직접 눌렀을 때만 쓴다. history.state 는 뒤로가기 가드가 쓰므로 그대로 둔다.
function sdWriteUrl(view) {
  try {
    const url = new URL(window.location.href);
    const p = url.searchParams;
    if (typeof marketCfg === "function") p.set("market", marketCfg().id);
    p.set("tab", "search");
    p.set("sub", "analysis");
    if (typeof selectedTicker === "string" && selectedTicker) {
      if (p.get("ticker") && p.get("ticker") !== selectedTicker) p.delete("dcf"); // 다른 종목의 시나리오는 버린다
      p.set("ticker", selectedTicker);
    }
    if (view && view !== "overview") p.set("view", view);
    else p.delete("view");
    history.replaceState(history.state, "", url.toString());
  } catch (_) { /* history 차단 환경 */ }
}

function sdApplyView(view) {
  const nav = byId("stockViewTabs");
  if (nav) {
    nav.querySelectorAll("[data-view]").forEach((btn) => {
      const on = btn.dataset.view === view;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
      btn.tabIndex = on ? 0 : -1;
    });
  }
  document.querySelectorAll("#stockMain .sd-view").forEach((panel) => {
    const on = panel.dataset.view === view;
    panel.classList.toggle("is-active", on);
    panel.setAttribute("aria-hidden", on ? "false" : "true");
    // 숨은 탭 안 버튼·입력칸이 키보드 순회에 걸리지 않게(visibility:hidden 이라 대부분 빠지지만 명시).
    if ("inert" in panel) panel.inert = !on;
  });
  sdUpdateEmpty();
}

// 탭을 연다. push=true 면 사용자가 누른 것 — URL 을 갱신하고, 본문이 화면 위로 지나가 있으면 탭 줄로 올린다.
function activateStockView(view, { push = false, scroll = false } = {}) {
  const v = sdNormalizeView(view) || "overview";
  sdCurrentView = v;
  sdApplyView(v);
  if (v === "ai" && typeof flushPendingAiReport === "function") flushPendingAiReport();
  if (v === "flow") sdEnsureFlowData();
  if (push) sdWriteUrl(v);
  if (scroll) {
    const main = byId("stockMain");
    if (main) {
      const top = main.getBoundingClientRect().top;
      const stickyTop = parseFloat(getComputedStyle(byId("stockDetail") || main).getPropertyValue("--sd-sticky-top")) || 0;
      if (top < stickyTop) window.scrollTo({ top: window.pageYOffset + top - stickyTop - 4, behavior: "auto" });
    }
  }
}

// 수급·보유 탭의 US 카드(스마트머니 종합·정치인 매매)는 무거운 데이터셋(내부자·의회·13F, 합계 ~11MB)을
// 읽는다. 부팅 때 받지 않으므로 이 탭을 처음 열 때 받고, 도착하면 refreshFeatureViews 가 두 카드를 다시 그린다.
function sdEnsureFlowData() {
  if (typeof ensureFeatureData !== "function") return;
  if (typeof isKrMarket === "function" && isKrMarket()) return;
  const keys = ["insider", "congress", "inst13f", "activist"];
  if (keys.every((k) => window[(FEATURE_DATA[k] || {}).global])) return; // 이미 있음(ensureFeatureData 도 중복 요청은 안 한다)
  Promise.all(keys.map((k) => ensureFeatureData(k).catch(() => false)))
    .then(() => { if (typeof scheduleFeatureViewRefresh === "function") scheduleFeatureViewRefresh(); });
}

// 어떤 카드 노드를 보이게 해야 할 때(다른 곳에서 그 카드로 스크롤하는 경우) 그 카드가 든 탭을 연다.
function showStockViewFor(el) {
  const panel = el && el.closest ? el.closest("#stockMain .sd-view") : null;
  if (panel && panel.dataset.view !== sdCurrentView) activateStockView(panel.dataset.view);
}

// ── 빈 탭 안내 ────────────────────────────────────────────────────────────────
// 카드는 데이터가 없으면 hidden 이 되거나 비어 있다. 탭 안에 보이는 카드가 하나도 없으면 한 줄 안내를 띄우고
// 탭 버튼을 흐리게 한다(누를 수는 있다). 카드가 늦게 채워지는 경우가 많아 변화를 지켜본다.
function sdCardVisible(node) {
  if (!node || node.nodeType !== 1 || node.hidden) return false;
  if (node.classList.contains("sd-empty")) return false;
  if (node.tagName === "SCRIPT" || node.tagName === "TEMPLATE") return false;
  if (node.classList.contains("analysis-balanced-grid")) return [...node.children].some(sdCardVisible);
  return node.innerHTML.trim() !== "";
}

function sdViewHasContent(panel) {
  return [...panel.children].some(sdCardVisible);
}

let sdEmptyRaf = 0;
function sdUpdateEmpty() {
  if (sdEmptyRaf) return;
  sdEmptyRaf = requestAnimationFrame(() => {
    sdEmptyRaf = 0;
    const panels = document.querySelectorAll("#stockMain .sd-view");
    if (!panels.length) return;
    let activeEmpty = false;
    panels.forEach((panel) => {
      const has = sdViewHasContent(panel);
      const btn = byId("stockViewTabs")?.querySelector(`[data-view="${panel.dataset.view}"]`);
      if (btn) btn.classList.toggle("is-empty", !has);
      if (panel.dataset.view === sdCurrentView) activeEmpty = !has;
    });
    const empty = byId("stockViewEmpty");
    if (empty) empty.hidden = !activeEmpty;
  });
}

// ── 개요 탭의 AI 진단 한 줄 ───────────────────────────────────────────────────
function sdUpdateAiTeaser() {
  const btn = byId("stockAiTeaser");
  const text = byId("stockAiTeaserText");
  const body = byId("analysisAiReportBody");
  if (!btn || !text || !body) return;
  if (body.querySelector(".shimmer-loading")) {
    text.textContent = "리포트를 작성하고 있습니다";
    btn.hidden = false;
    return;
  }
  const first = body.firstElementChild;
  if (!first) { btn.hidden = true; return; }
  // 안내 문구(p.muted 한 줄)면 탭으로 가는 입구만, 로딩 실패는 개요에 올리지 않는다.
  if (body.children.length === 1 && first.classList.contains("muted")) {
    if (/실패/.test(first.textContent || "")) { btn.hidden = true; return; }
    text.textContent = "수집된 지표로 작성하는 AI 진단 리포트 보기";
    btn.hidden = false;
    return;
  }
  const raw = (body.textContent || "").replace(/\s+/g, " ").trim();
  if (!raw) { btn.hidden = true; return; }
  const sentence = (raw.match(/^.{12,}?[.!?。](?=\s|$)/) || [raw])[0];
  text.textContent = sentence.length > 110 ? `${sentence.slice(0, 108)}…` : sentence;
  btn.hidden = false;
}

// ── 좌측 패널: sticky 기준 · 모바일 더보기 ─────────────────────────────────────
function sdSyncStickyTop() {
  const host = byId("stockDetail");
  if (!host) return;
  const wrap = document.querySelector(".tabs-scroll-wrap");
  let top = 0;
  if (wrap && getComputedStyle(wrap).position === "sticky") top = wrap.offsetHeight;
  host.style.setProperty("--sd-sticky-top", `${Math.round(top)}px`);
}

function setupStockView() {
  const nav = byId("stockViewTabs");
  const main = byId("stockMain");
  if (!nav || !main) return;
  sdApplyView(sdCurrentView);
  if (sdCurrentView === "flow") setTimeout(sdEnsureFlowData, 0);

  nav.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-view]");
    if (!btn) return;
    activateStockView(btn.dataset.view, { push: true, scroll: true });
  });
  // 탭 목록 키보드(←/→/Home/End) — 다른 탭 묶음과 같은 규칙.
  nav.addEventListener("keydown", (e) => {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(e.key)) return;
    const btns = [...nav.querySelectorAll("[data-view]")];
    const cur = btns.indexOf(document.activeElement);
    if (cur < 0) return;
    e.preventDefault();
    let next = cur;
    if (e.key === "Home") next = 0;
    else if (e.key === "End") next = btns.length - 1;
    else next = (cur + (e.key === "ArrowRight" ? 1 : -1) + btns.length) % btns.length;
    btns[next].focus();
    activateStockView(btns[next].dataset.view, { push: true });
  });
  document.addEventListener("click", (e) => {
    const go = e.target.closest("[data-goto-view]");
    if (go && main.contains(go)) activateStockView(go.dataset.gotoView, { push: true, scroll: true });
  });

  if (typeof MutationObserver === "function") {
    new MutationObserver(sdUpdateEmpty).observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
    const body = byId("analysisAiReportBody");
    if (body) new MutationObserver(sdUpdateAiTeaser).observe(body, { childList: true, subtree: true, characterData: true });
  }
  sdUpdateAiTeaser();

  const side = byId("stockSide");
  const more = byId("stockSideMore");
  if (side && more) {
    more.addEventListener("click", () => {
      const open = side.classList.toggle("is-open");
      more.setAttribute("aria-expanded", open ? "true" : "false");
      more.textContent = open ? "투자정보 접기" : "투자정보 더보기";
    });
  }
  sdSyncStickyTop();
  const wrap = document.querySelector(".tabs-scroll-wrap");
  if (wrap && typeof ResizeObserver === "function") new ResizeObserver(sdSyncStickyTop).observe(wrap);
  window.addEventListener("resize", sdSyncStickyTop);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setupStockView);
else setupStockView();
