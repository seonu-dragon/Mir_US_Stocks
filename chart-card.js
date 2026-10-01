// chart-card.js — 차트 카드 공통 틀(종목 분석 › 재무·밸류 탭)
// =====================================================
// 카드마다 제목·축 단위·범례·출처/기준일·도움말 위치가 제각각이던 것을 한 모양으로 맞춘다.
// 차트 SVG 와 표 HTML 은 호출하는 쪽이 만들어 넘기고, 여기서는 틀만 씌운다(데이터·계산 무관).
//
//   mirChartCard({ id, title, sub, unitLeft, unitRight, chart, table, legend, source, help, wide })
//     → <figure class="cc-card"> 문자열. table 을 주면 오른쪽 위에 '차트/표' 전환이 붙고,
//       고른 쪽은 카드 id 별로 localStorage(mir.cc.view.<id>)에 남는다(차단 환경이면 기억만 못 함).
//     legend: [{ label, color, shape: "bar"|"line"|"dash"|"dot", value, opacity }]
//   mirChartGrid(cardsHtml[]) → 2열(넓은 칸)/1열(좁은 칸) 격자. 열 수는 CSS 컨테이너 쿼리가 정한다.
//   mirChartGridCols(host) → 그 host 폭에서 격자가 몇 열인지(차트 SVG 폭 계산용, CSS 와 같은 문턱).
//
// 클래식 스크립트(전역 공유) — 전역 이름은 mirChart*/MIR_CC_* 로 충돌을 피한다.

const MIR_CC_PREFIX = "mir.cc.view.";
const MIR_CC_GRID_MIN = 720;   // styles.css 의 @container mircc (min-width: 720px) 와 같은 값
const MIR_CC_GAP = 12;

function mirChartCardEsc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function mirChartCardPref(id) {
  if (!id) return "chart";
  try {
    const v = window.localStorage.getItem(MIR_CC_PREFIX + id);
    return v === "table" ? "table" : "chart";
  } catch (_) { return "chart"; }
}

function mirChartCardSetPref(id, view) {
  if (!id) return;
  try { window.localStorage.setItem(MIR_CC_PREFIX + id, view); } catch (_) { /* 저장 차단 — 이번 화면에서만 */ }
}

function mirChartCardLegend(items) {
  if (!items || !items.length) return "";
  return `<ul class="cc-legend">${items.map((it) => {
    const shape = it.shape || "bar";
    const val = it.value != null && it.value !== "" ? ` <b>${mirChartCardEsc(it.value)}</b>` : "";
    return `<li><i class="cc-sw cc-sw-${shape}" style="--cc-sw:${mirChartCardEsc(it.color || "var(--accent)")}${it.opacity != null ? `;opacity:${Number(it.opacity)}` : ""}"></i>${mirChartCardEsc(it.label)}${val}</li>`;
  }).join("")}</ul>`;
}

function mirChartCard(o) {
  const opt = o || {};
  const id = opt.id ? String(opt.id).replace(/[^\w.:-]/g, "_") : "";
  const hasTable = !!opt.table;
  const view = hasTable ? mirChartCardPref(id) : "chart";
  const toggle = hasTable ? `<div class="cc-toggle" role="group" aria-label="보기 방식">
      <button type="button" data-cc-view="chart" aria-pressed="${view === "chart"}" class="${view === "chart" ? "is-active" : ""}">차트</button>
      <button type="button" data-cc-view="table" aria-pressed="${view === "table"}" class="${view === "table" ? "is-active" : ""}">표</button>
    </div>` : "";
  const units = opt.unitLeft || opt.unitRight
    ? `<div class="cc-units" aria-hidden="true"><span>${mirChartCardEsc(opt.unitLeft || "")}</span><span>${mirChartCardEsc(opt.unitRight || "")}</span></div>` : "";
  const help = opt.help
    ? `<span class="cc-help" tabindex="0" role="note" aria-label="${mirChartCardEsc(opt.help)}" data-tip="${mirChartCardEsc(opt.help)}">?</span>` : "";
  const source = opt.source || help
    ? `<div class="cc-source"><span>${mirChartCardEsc(opt.source || "")}</span>${help}</div>` : "";
  return `<figure class="cc-card${opt.wide ? " cc-wide" : ""}" data-cc-id="${mirChartCardEsc(id)}" data-cc-active="${view}">
    <figcaption class="cc-head">
      <h4 class="cc-title">${mirChartCardEsc(opt.title || "")}${opt.sub ? ` <span class="cc-sub">${mirChartCardEsc(opt.sub)}</span>` : ""}</h4>
      ${toggle}
    </figcaption>
    ${opt.lead || ""}
    <div class="cc-pane cc-pane-chart"${view === "chart" ? "" : " hidden"}>${units}${opt.chart || ""}</div>
    ${hasTable ? `<div class="cc-pane cc-pane-table"${view === "table" ? "" : " hidden"}>${opt.table}</div>` : ""}
    <div class="cc-foot">${mirChartCardLegend(opt.legend)}${source}</div>
  </figure>`;
}

function mirChartGrid(cards) {
  return `<div class="cc-scope"><div class="cc-grid">${(cards || []).join("")}</div></div>`;
}

// host 안에 놓일 격자의 열 수와 카드 안쪽 폭(차트 SVG 폭). 카드 좌우 패딩 14px.
function mirChartGridCols(hostWidth) {
  return hostWidth >= MIR_CC_GRID_MIN ? 2 : 1;
}

function mirChartCardInnerWidth(hostWidth) {
  const w = Number(hostWidth) || 0;
  if (w <= 0) return 0;
  const cols = mirChartGridCols(w);
  const col = cols === 2 ? (w - MIR_CC_GAP) / 2 : w;
  return Math.floor(col - 28);
}

// 차트/표 전환 — 문서 한 곳에서 위임(카드는 다시 그려져도 리스너를 새로 달 필요가 없다).
document.addEventListener("click", (e) => {
  const btn = e.target && e.target.closest ? e.target.closest(".cc-card [data-cc-view]") : null;
  if (!btn) return;
  const card = btn.closest(".cc-card");
  const view = btn.dataset.ccView === "table" ? "table" : "chart";
  card.dataset.ccActive = view;
  card.querySelectorAll("[data-cc-view]").forEach((b) => {
    const on = b.dataset.ccView === view;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
  const chart = card.querySelector(".cc-pane-chart");
  const table = card.querySelector(".cc-pane-table");
  if (chart) chart.hidden = view !== "chart";
  if (table) table.hidden = view !== "table";
  mirChartCardSetPref(card.dataset.ccId, view);
});
