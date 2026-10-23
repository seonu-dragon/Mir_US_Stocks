// mini-chart-gallery.js — 종목 › 찾기 › 상위 종목의 [차트] 보기: 결과 종목의 작은 차트 격자.
// ====================================================================================
// 계산·SVG 는 mini-chart-core.js(window.MirMiniChartCore). 일봉은 loadStockDetail(app.js → details-source.js)
// 로 받고, 화면에 들어온 카드만 IntersectionObserver 로 받는다(동시 6개). 기간 3M(캔들)·1Y(종가 선).
// 받은 상세는 app.js detailCache 에 남으므로 기간을 바꿔도 다시 받지 않는다. 색은 시장별 --pos/--neg.
// find-table.js 의 ftApplyView 가 보기='chart' 일 때 renderFindChartGallery(rows) 를 부른다.
(function () {
  "use strict";

  const PAGE = 48;
  const core = () => window.MirMiniChartCore;
  const state = { period: "3M", shown: PAGE, rows: [], sig: "" };
  const series = new Map(); // ticker → chartSeries | null(없음)
  let queue = null;
  let observer = null;

  const $ = (id) => document.getElementById(id);
  const esc = (s) => (typeof escapeHtml === "function" ? escapeHtml(s) : String(s == null ? "" : s));
  const label = (item) => (typeof stockLabel === "function" ? stockLabel(item) : item.ticker);

  function q() {
    if (!queue && core()) queue = core().createQueue(6);
    return queue;
  }

  function pctText(v) {
    if (v === null || !Number.isFinite(v)) return { text: "—", cls: "" };
    return { text: `${v > 0 ? "+" : ""}${v.toFixed(1)}%`, cls: v > 0 ? "pos" : v < 0 ? "neg" : "" };
  }

  function paint(card) {
    const t = card.dataset.ticker;
    if (!series.has(t)) return;
    const cs = series.get(t);
    const box = card.querySelector(".mc-svg");
    const chg = card.querySelector(".mc-chg");
    const bars = cs ? core().sliceBars(cs, state.period) : [];
    const body = core().svg(bars, { kind: state.period === "3M" ? "candle" : "line" });
    card.classList.remove("is-loading");
    if (!body) {
      box.innerHTML = `<span class="mc-empty muted">일봉 없음</span>`;
      chg.textContent = "—";
      chg.className = "mc-chg";
      return;
    }
    box.innerHTML = `<svg viewBox="0 0 160 56" preserveAspectRatio="none" aria-hidden="true">${body}</svg>`;
    const p = pctText(core().changePct(bars));
    chg.textContent = p.text;
    chg.className = `mc-chg ${p.cls}`;
  }

  function load(card) {
    const t = card.dataset.ticker;
    if (series.has(t)) { paint(card); return; }
    const queueRef = q();
    if (!queueRef || typeof loadStockDetail !== "function") return;
    queueRef.run(t, () => loadStockDetail(t).catch(() => null)).then((detail) => {
      series.set(t, detail && Array.isArray(detail.chartSeries) ? detail.chartSeries : null);
      document.querySelectorAll(`#topStocksChartWrap .mc-card[data-ticker="${CSS.escape(t)}"]`).forEach(paint);
    }).catch(() => { /* 큐 정리(cleared) */ });
  }

  function observe(host) {
    if (observer) observer.disconnect();
    const cards = host.querySelectorAll(".mc-card");
    if (typeof IntersectionObserver !== "function") { cards.forEach(load); return; }
    observer = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        observer.unobserve(e.target);
        load(e.target);
      });
    }, { rootMargin: "200px 0px" });
    cards.forEach((c) => observer.observe(c));
  }

  function render(rows) {
    const host = $("topStocksChartWrap");
    if (!host || !core()) return;
    state.rows = Array.isArray(rows) ? rows : [];
    const sig = state.rows.map((r) => r.item && r.item.ticker).join(",");
    if (sig !== state.sig) {
      state.sig = sig;
      state.shown = PAGE;
      // 이전 결과의 대기 요청은 버리고 새 큐로(진행 중인 것은 끝나면 그대로 칠해진다).
      if (queue) queue.clear();
      queue = null;
      series.clear(); // 상세 자체는 app.js detailCache 에 있어 다시 받지 않는다
    }
    if (!state.rows.length) {
      if (observer) observer.disconnect();
      host.innerHTML = `<p class="ft-empty muted">조건에 맞는 종목이 없습니다. 고급 필터를 완화해 보세요.</p>`;
      return;
    }
    const list = state.rows.slice(0, state.shown);
    const seg = ["3M", "1Y"].map((p) => `<button type="button" data-mc-period="${p}" class="${p === state.period ? "is-active" : ""}" aria-pressed="${p === state.period}">${p}</button>`).join("");
    const cards = list.map(({ item }, i) => `<button type="button" class="mc-card is-loading" data-ticker="${esc(item.ticker)}">
        <span class="mc-head"><span class="mc-rank">${i + 1}</span><strong class="mc-name">${esc(label(item))}</strong><span class="mc-chg">…</span></span>
        <span class="mc-svg"></span>
      </button>`).join("");
    const more = state.rows.length > state.shown
      ? `<button type="button" class="ghost compact-btn mc-more" data-mc-more>더 보기 (${state.shown}/${state.rows.length})</button>` : "";
    host.innerHTML = `<div class="mc-bar"><div class="segmented ia-seg ia-seg-sm" role="group" aria-label="차트 기간">${seg}</div></div>
      <div class="mc-grid">${cards}</div>${more}`;
    observe(host);
  }

  function setup() {
    const host = $("topStocksChartWrap");
    if (!host || host.dataset.mcBound) return;
    host.dataset.mcBound = "1";
    host.addEventListener("click", (e) => {
      const p = e.target.closest("[data-mc-period]");
      if (p) {
        if (p.dataset.mcPeriod === state.period) return;
        state.period = p.dataset.mcPeriod;
        host.querySelectorAll("[data-mc-period]").forEach((b) => {
          const on = b.dataset.mcPeriod === state.period;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-pressed", String(on));
        });
        host.querySelectorAll(".mc-card").forEach(paint); // 받은 것만 다시 그림(재요청 없음)
        return;
      }
      if (e.target.closest("[data-mc-more]")) {
        state.shown += PAGE;
        render(state.rows);
        return;
      }
      const card = e.target.closest(".mc-card[data-ticker]");
      if (card && typeof selectTicker === "function") selectTicker(card.dataset.ticker, { openSearch: true });
    });
  }

  window.renderFindChartGallery = (rows) => { setup(); render(rows); };
})();
