// toc-layout.js — 접이식 위젯 묶음(<details class="ia-fold">)을 "왼쪽 목차 + 본문 하나"로 바꾼다.
// ====================================================================================
// 클래식 스크립트(모듈 아님). 전역 이름은 toc 접두사.
// 대상: 시장 › 시그널(#tab-signals, 위젯 11개) · 내 투자 › 도구(#sub-bulk-tools, 도구 14개).
// PC 는 왼쪽 목차(sticky) + 본문, 폰(≤900px)은 목차가 가로 스크롤 칩 줄이 된다.
//
// 기존 코드와의 약속(지우지 않고 옮긴다):
//   · <details> 노드는 그대로 두고 부모만 옮긴다 — id·전역 함수·렌더러는 그대로다.
//   · 선택 안 된 도구는 예전처럼 닫힌 <details> 다. 지연 초기화(pfRiskFold 의 toggle → runAlloc 등)가
//     그대로 '선택할 때' 돈다.
//   · 다른 코드가 fold.open = true 로 펼치면(딥링크 ?tab=tools&dca=·&pfrisk=·&thesis=, 신호 성적표로 가기)
//     그 항목을 선택한 것으로 본다. fold.hidden(데이터 없는 위젯 숨김)은 목차 버튼에도 반영한다.
//   · 목차 선택은 URL(&tool= / &sig=)과 브라우저(localStorage)에 남는다.

const TOC_SPECS = [
  { root: "tab-signals", fold: ":scope > details.ia-fold", param: "sig", tab: "signals", store: "mir.toc.signals", label: "시그널 목차" },
  { root: "sub-bulk-tools", fold: ":scope > details.ia-fold", param: "tool", tab: "tools", store: "mir.toc.tools", label: "도구 목록" },
];

function tocFoldKey(fold, i) {
  if (fold.dataset.tocKey) return fold.dataset.tocKey;
  const id = fold.id ? fold.id.replace(/^fold-/, "") : "";
  const key = (id || `item${i + 1}`).toLowerCase();
  fold.dataset.tocKey = key;
  return key;
}

function tocStoreGet(k) { try { return window.localStorage.getItem(k); } catch (_) { return null; } }
function tocStoreSet(k, v) { try { window.localStorage.setItem(k, v); } catch (_) { /* 차단 환경 */ } }

function tocWriteUrl(spec, key) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", spec.tab);
    url.searchParams.set(spec.param, key);
    history.replaceState(history.state, "", url.toString());
  } catch (_) { /* history 차단 환경 */ }
}

function setupTocLayout(spec) {
  const root = byId(spec.root);
  if (!root || root.dataset.tocReady) return null;
  const folds = [...root.querySelectorAll(spec.fold)];
  if (folds.length < 2) return null;
  root.dataset.tocReady = "1";

  const layout = document.createElement("div");
  layout.className = "toc-layout";
  const nav = document.createElement("nav");
  nav.className = "toc-nav";
  nav.setAttribute("aria-label", spec.label);
  const body = document.createElement("div");
  body.className = "toc-body";
  layout.append(nav, body);
  folds[0].before(layout);

  const items = folds.map((fold, i) => {
    const key = tocFoldKey(fold, i);
    const title = (fold.querySelector(":scope > summary")?.textContent || key).replace(/\s+/g, " ").trim();
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "toc-item";
    btn.dataset.tocKey = key;
    btn.textContent = title;
    btn.setAttribute("aria-controls", fold.id || "");
    nav.appendChild(btn);
    body.appendChild(fold);
    fold.classList.add("toc-fold");
    return { key, fold, btn };
  });

  // 고른 항목의 본문이 데이터가 없어 통째로 비면(카드가 스스로 숨는 경우) 한 줄 안내.
  const empty = document.createElement("p");
  empty.className = "toc-empty muted";
  empty.hidden = true;
  empty.textContent = "이 항목에 표시할 데이터가 아직 없습니다.";
  body.appendChild(empty);
  let emptyRaf = 0;
  function checkEmpty() {
    if (emptyRaf) return;
    emptyRaf = requestAnimationFrame(() => {
      emptyRaf = 0;
      const f = active && active.fold;
      // 목차 자체가 안 보이는 동안(다른 탭)은 판단하지 않는다.
      if (!f || !layout.offsetParent) return;
      const hide = f.offsetHeight > 24;
      if (empty.hidden !== hide) empty.hidden = hide; // 같은 값을 다시 쓰면 관찰자가 또 깨어난다
    });
  }

  let active = null;
  // 원하는 항목(URL·사용자 선택·코드가 펼친 것). 데이터가 늦게 와서 잠깐 숨어 있어도, 다시 보이면 돌아간다.
  let wanted = null;
  const visible = (it) => !it.fold.hidden;
  const byKey = (k) => items.find((it) => it.key === k);

  function apply() {
    items.forEach((it) => {
      const on = it === active;
      it.fold.classList.toggle("toc-active", on);
      it.btn.classList.toggle("is-active", on);
      it.btn.setAttribute("aria-current", on ? "true" : "false");
      it.btn.hidden = it.fold.hidden;
      if (on && !it.fold.open) it.fold.open = true;
      if (!on && it.fold.open) it.fold.open = false;
    });
    checkEmpty();
    revealActive();
  }

  // 폰의 칩 줄: 고른 칩이 줄 밖에 있으면(딥링크로 뒤쪽 항목을 연 경우) 줄만 가로로 옮긴다. 페이지는 안 움직인다.
  function revealActive() {
    if (!active || !nav.offsetParent || nav.scrollWidth <= nav.clientWidth + 1) return;
    const nb = nav.getBoundingClientRect(), br = active.btn.getBoundingClientRect();
    if (br.left < nb.left || br.right > nb.right) nav.scrollLeft += (br.left - nb.left) - 16;
  }

  function select(it, { user = false } = {}) {
    if (!it) return;
    active = it;
    wanted = it.key;
    apply();
    if (user) {
      tocStoreSet(spec.store, it.key);
      tocWriteUrl(spec, it.key);
      // 칩 줄 위치는 apply → revealActive 가 맞춘다. 본문 머리가 화면 위로 지나가 있으면 목차 바로 아래로.
      const top = layout.getBoundingClientRect().top;
      if (top < 0) window.scrollTo({ top: window.pageYOffset + top - 72, behavior: "auto" });
    }
  }

  function firstVisible() { return items.find(visible) || items[0]; }

  function sync() {
    // 다른 코드가 펼친 항목 → 선택. 선택 항목이 숨겨지면 다음 보이는 항목으로.
    const opened = items.find((it) => it !== active && it.fold.open && visible(it));
    if (opened) { select(opened); return; }
    const pref = wanted && byKey(wanted);
    if (pref && pref !== active && visible(pref)) { active = pref; apply(); return; }
    if (!active || !visible(active)) { active = firstVisible(); }
    apply();
  }

  // 첫 선택: URL > 브라우저 기억 > 처음부터 펼쳐져 있던 항목 > 첫 항목.
  let want = null;
  try { want = byKey(new URLSearchParams(window.location.search).get(spec.param) || ""); } catch (_) { want = null; }
  if (!want) want = byKey(tocStoreGet(spec.store) || "");
  if (!want || !visible(want)) want = items.find((it) => it.fold.open && visible(it)) || firstVisible();
  active = want;
  wanted = want.key;
  apply();

  nav.addEventListener("click", (e) => {
    const btn = e.target.closest(".toc-item");
    if (btn) select(byKey(btn.dataset.tocKey), { user: true });
  });
  nav.addEventListener("keydown", (e) => {
    if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const btns = items.filter(visible).map((it) => it.btn);
    const cur = btns.indexOf(document.activeElement);
    if (cur < 0) return;
    e.preventDefault();
    let next = cur;
    if (e.key === "Home") next = 0;
    else if (e.key === "End") next = btns.length - 1;
    else next = (cur + (e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1) + btns.length) % btns.length;
    btns[next].focus();
    select(byKey(btns[next].dataset.tocKey), { user: true });
  });
  // summary 를 숨겼으므로 사용자가 본문을 닫을 길은 없지만, 코드가 닫으면 다시 편다.
  if (typeof MutationObserver === "function") {
    items.forEach((it) => new MutationObserver(sync).observe(it.fold, { attributes: true, attributeFilter: ["open", "hidden"] }));
    new MutationObserver(checkEmpty).observe(body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "style"] });
  }
  // 탭을 처음 열 때(숨어 있던 동안엔 판단을 미뤘다) 다시 본다.
  if (typeof ResizeObserver === "function") new ResizeObserver(() => { checkEmpty(); revealActive(); }).observe(layout);
  return { select: (k) => select(byKey(k), { user: false }), items };
}

const MirToc = {};
function setupTocLayouts() {
  TOC_SPECS.forEach((spec) => {
    const api = setupTocLayout(spec);
    if (api) MirToc[spec.param] = api;
  });
}
window.MirToc = MirToc;

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setupTocLayouts);
else setupTocLayouts();
