// mobile-clamp.js — 폰(≤640px)에서 긴 목록을 앞 몇 개만 보이고 '더 보기 (N개)'로 펼친다.
// =====================================================================================
// 2026-10-03 모바일 점검: 오늘 요약 5,800px · 시장 폭 5,800px 의 대부분이 끝까지 다 펼친 목록이었다
// (AI 브리핑 요약 줄, 국내·미국 연관주, 시장 폭 ETF 표 9개). 렌더러는 그대로 두고, 그려진 DOM 에
// 'mc-hidden' 클래스만 붙였다 뗀다 — 데스크톱·데이터·렌더 로직은 바뀌지 않는다.
// 호스트가 다시 그려지면(MutationObserver) 다시 적용한다. 사용자가 펼친 묶음은 같은 화면에서 유지한다.
// 클래식 스크립트. 최상위 이름은 mclamp* 로 충돌을 피한다.

const MCLAMP_SPECS = [
  // host: 감시할 요소 id · group: 따로 접을 묶음(없으면 host 하나) · items: 묶음 안 항목 · n: 보일 개수
  { host: "homeBriefing", items: ".home-brief-list > li", n: 3, label: "요약" },
  { host: "crossMarketHome", items: ".xm-board > li", n: 3, label: "종목" },
  { host: "marketsTables", group: ".market-section", items: "tbody > tr", n: 5, label: "종목" },
  { host: "dailyActionGrid", items: ":scope > .daily-action-card", n: 3, label: "항목" },
];
const mclampOpen = new Set();   // `${host}|${묶음 순번}` — 펼친 묶음
const mclampMq = typeof window.matchMedia === "function" ? window.matchMedia("(max-width: 640px)") : null;

function mclampIsPhone() { return Boolean(mclampMq && mclampMq.matches); }

function mclampApply(spec) {
  const host = document.getElementById(spec.host);
  if (!host) return;
  const groups = spec.group ? [...host.querySelectorAll(spec.group)] : [host];
  groups.forEach((g, gi) => {
    const key = `${spec.host}|${gi}`;
    const items = [...g.querySelectorAll(spec.items)];
    let btn = g.querySelector(":scope .mc-more");
    const clamp = mclampIsPhone() && !mclampOpen.has(key) && items.length > spec.n + 1;
    items.forEach((it, i) => it.classList.toggle("mc-hidden", clamp && i >= spec.n));
    if (!clamp) { if (btn) btn.remove(); return; }
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ghost mc-more";
      btn.dataset.mcKey = key;
      // 표는 table 밖(.table-wrap 뒤)에, 목록은 목록 바로 뒤에 둔다.
      const anchor = items[0].closest("table") ? (items[0].closest(".table-wrap") || items[0].closest("table")) : items[0].parentElement;
      anchor.insertAdjacentElement("afterend", btn);
    }
    // 같은 글자를 다시 쓰면 관찰자가 또 깨어나 무한히 돈다 — 바뀔 때만 쓴다.
    const text = `더 보기 (${items.length - spec.n}개 ${spec.label})`;
    if (btn.textContent !== text) btn.textContent = text;
  });
}

function mclampApplyAll() { MCLAMP_SPECS.forEach(mclampApply); }

function setupMobileClamp() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".mc-more");
    if (!btn) return;
    mclampOpen.add(btn.dataset.mcKey);
    const [hostId, gi] = btn.dataset.mcKey.split("|");
    const spec = MCLAMP_SPECS.find((s) => s.host === hostId);
    const host = document.getElementById(hostId);
    const g = spec && spec.group && host ? host.querySelectorAll(spec.group)[Number(gi)] : host;
    if (g && spec) g.querySelectorAll(spec.items).forEach((it) => it.classList.remove("mc-hidden"));
    btn.remove();
  });
  MCLAMP_SPECS.forEach((spec) => {
    const host = document.getElementById(spec.host);
    if (!host || typeof MutationObserver !== "function") return;
    let raf = 0;
    // 자기 변경(클래스·버튼)은 childList 로 다시 깨우지만 결과가 같아 한 번 더 돌고 멈춘다.
    new MutationObserver(() => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; mclampApply(spec); });
    }).observe(host, { childList: true, subtree: true });
  });
  if (mclampMq && typeof mclampMq.addEventListener === "function") mclampMq.addEventListener("change", mclampApplyAll);
  mclampApplyAll();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setupMobileClamp);
else setupMobileClamp();
