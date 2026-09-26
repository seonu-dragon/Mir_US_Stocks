// 폰(640px 이하) 전용 '처음 N개 + 더 보기' — 오늘·시장 탭의 긴 목록.
//
// app.js 의 LIST_LIMITS 는 호스트 하나에 목록 하나만 다룬다. 여기서는 한 호스트 안에 목록이
// 여러 개인 경우(레버리지 ETF 는 122개 묶음 중 두 묶음이 425·242장, 특징주는 상승·하락 탭)도
// 묶음마다 따로 자른다. 렌더러는 건드리지 않고 호스트의 childList 변화를 관찰해 다시 적용한다.
// 데스크톱 폭에서는 아무것도 숨기지 않는다.
(function () {
  const PHONE_MQ = "(max-width: 640px)";
  const isPhone = () => typeof window.matchMedia === "function" && window.matchMedia(PHONE_MQ).matches;

  // group 이 없으면 호스트 자체가 목록이다. 버튼은 목록 요소 바로 뒤(표 본문이면 표 뒤)에 붙는다.
  const SPECS = [
    { host: "moversBoard", group: ".movers-list", item: ":scope > li", limit: 5, step: 5 },
    { host: "levEtfGroups", item: ":scope > .lev-etf-section", limit: 6, step: 10, unit: "묶음" },
    { host: "levEtfGroups", group: ".lev-etf-grid", item: ":scope > .lev-etf-card", limit: 4, step: 12 },
    { host: "sectorEtfGrid", item: ":scope > .etf-rs-card", limit: 8, step: 10 },
    { host: "sectorConstituentsBody", item: ":scope > tr", limit: 10, step: 20 },
    { host: "calendarPanelHost", group: ".calp-list", item: ":scope > .calp-daygroup", limit: 3, step: 3, unit: "일" },
  ];

  const shownBy = new WeakMap(); // 목록 요소 → { key: 보이는 개수 }
  const btnBy = new WeakMap(); // 목록 요소 → { key: 버튼 }
  let applying = false;

  function anchorOf(list) {
    return list.tagName === "TBODY" ? (list.closest("table")?.parentElement?.classList.contains("table-wrap") ? list.closest("table").parentElement : list.closest("table")) : list;
  }

  function applyOne(list, spec, key) {
    const items = [...list.querySelectorAll(spec.item)];
    const state = shownBy.get(list) || {};
    shownBy.set(list, state);
    const shown = isPhone() ? (state[key] ?? spec.limit) : Infinity;
    let hidden = 0;
    items.forEach((el, i) => {
      if (i >= shown) { el.dataset.mlHidden = key; hidden += 1; }
      else if (el.dataset.mlHidden === key) delete el.dataset.mlHidden;
    });
    const btns = btnBy.get(list) || {};
    btnBy.set(list, btns);
    btns[key]?.remove();
    delete btns[key];
    if (!hidden) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "list-more-btn ml-more-btn";
    btn.textContent = `더 보기 (${Math.min(spec.step, hidden)}${spec.unit || "개"} · 남은 ${hidden}${spec.unit || "개"})`;
    btn.addEventListener("click", () => {
      state[key] = (state[key] ?? spec.limit) + spec.step;
      run(spec, key);
    });
    anchorOf(list).after(btn);
    btns[key] = btn;
  }

  function run(spec, key) {
    const host = document.getElementById(spec.host);
    if (!host) return;
    applying = true;
    try {
      const lists = spec.group ? [...host.querySelectorAll(spec.group)] : [host];
      lists.forEach((list) => applyOne(list, spec, key));
    } finally {
      applying = false;
    }
  }

  function setup() {
    if (typeof MutationObserver !== "function") return;
    SPECS.forEach((spec, idx) => {
      const key = `m${idx}`;
      const host = document.getElementById(spec.host);
      if (!host) return;
      const obs = new MutationObserver((records) => {
        if (applying) return;
        const external = records.some((r) => [...r.addedNodes, ...r.removedNodes]
          .some((n) => !(n.classList && n.classList.contains("ml-more-btn"))));
        if (!external) return;
        // 렌더러가 목록을 다시 그렸으면 처음 개수로 되돌린다(새 목록 요소는 상태가 없다).
        if (!spec.group) shownBy.delete(host);
        run(spec, key);
      });
      obs.observe(host, { childList: true, subtree: true });
      run(spec, key);
    });
    // 폰 ↔ 데스크톱 폭을 오가면 다시 적용(데스크톱은 전부 보인다).
    if (typeof window.matchMedia === "function") {
      const mq = window.matchMedia(PHONE_MQ);
      const rerun = () => SPECS.forEach((spec, idx) => run(spec, `m${idx}`));
      if (mq.addEventListener) mq.addEventListener("change", rerun);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup);
  else setup();
})();
