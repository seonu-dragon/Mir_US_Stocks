// daily-table.js — 종목 상세 '개요' 탭 차트 아래 '일별 시세' 표(#dailyPriceTable).
// 데이터는 차트와 같은 일봉(getChartRows(item) = detail chartSeries, 실시간 봉이 있으면 그것까지).
// 계산·표기는 daily-table-core.js(window.MirDailyTable), 여기는 표시만.
// drawChart 가 그릴 때마다 부르므로 같은 시계열이면 바로 돌아간다(팬·줌 프레임마다 다시 만들지 않게).
// 클래식 스크립트(전역 공유) — 이름은 dtbl 접두사로 충돌을 피한다.

const DTBL_PAGE = 20;
const DTBL_MAX = 260; // 약 1년치 거래일
let _dtblState = { key: "", shown: DTBL_PAGE, ticker: "" };

function dtblIsKr() { return typeof isKrMarket === "function" && isKrMarket(); }

function dtblHide(host) { if (host) { host.hidden = true; host.innerHTML = ""; } }

function dtblSourceLabel(item) {
  const s = String((item && item.historySource) || "").toLowerCase();
  if (s.includes("naver")) return "네이버 금융";
  if (s.includes("yahoo")) return "Yahoo Finance";
  if (s.includes("krx")) return "KRX";
  return "";
}

function renderDailyTable(item, options = {}) {
  const host = byId("dailyPriceTable");
  const core = window.MirDailyTable;
  if (!host || !core || !item) return;
  const series = item.chartSeries;
  // 종가만 있는 종목(closeSeries)은 시가·고가·저가가 합성값이라 표를 띄우지 않는다.
  if (!Array.isArray(series) || series.length < 2) { dtblHide(host); _dtblState.key = ""; return; }
  const last = series[series.length - 1];
  const key = `${item.ticker}|${series.length}|${Array.isArray(last) ? last.join(",") : JSON.stringify(last)}`;
  if (item.ticker !== _dtblState.ticker) _dtblState = { key: "", shown: DTBL_PAGE, ticker: item.ticker };
  if (!options.force && key === _dtblState.key && !host.hidden) return;
  _dtblState.key = key;

  const rowsAll = typeof getChartRows === "function" ? getChartRows(item) : [];
  if (rowsAll.some((r) => r && r.synthetic)) { dtblHide(host); return; }
  const kr = dtblIsKr();
  const shown = Math.min(DTBL_MAX, _dtblState.shown);
  const rows = core.buildDailyRows(rowsAll, shown);
  if (!rows.length) { dtblHide(host); return; }
  const total = Math.min(DTBL_MAX, rowsAll.filter((r) => r && Number(r.c) > 0).length);

  const body = rows.map((r) => {
    const ch = core.fmtChange(r.change, r.pct, kr);
    const cls = ch.dir === "up" ? "pos" : ch.dir === "down" ? "neg" : "";
    return `<tr>
      <td class="dtbl-date"><span class="dtbl-d-long">${escapeHtml(core.fmtDate(r.d))}</span><span class="dtbl-d-short">${escapeHtml(core.fmtDateShort(r.d))}</span></td>
      <td class="num dtbl-close">${escapeHtml(core.fmtPrice(r.c, kr))}</td>
      <td class="num dtbl-chg ${cls}">${escapeHtml(ch.text)}</td>
      <td class="num dtbl-ohl">${escapeHtml(core.fmtPrice(r.o, kr))}</td>
      <td class="num dtbl-ohl">${escapeHtml(core.fmtPrice(r.h, kr))}</td>
      <td class="num dtbl-ohl">${escapeHtml(core.fmtPrice(r.l, kr))}</td>
      <td class="num dtbl-vol">${escapeHtml(core.fmtVolume(r.v))}</td>
    </tr>`;
  }).join("");
  const remain = total - rows.length;
  const more = remain > 0
    ? `<button type="button" class="ghost compact-btn list-more-btn dtbl-more" data-dtbl-more="1">더 보기 (${Math.min(DTBL_PAGE, remain)}개 · 남은 ${remain}개)</button>`
    : "";
  const src = dtblSourceLabel(item);
  const unit = kr ? "원 · 주" : "USD · 주";
  host.innerHTML = `<div class="fundamental-head"><h3>일별 시세</h3><span>기준 ${escapeHtml(core.fmtDate(rows[0].d))} · 단위 ${unit}</span></div>
    <div class="table-wrap"><table class="dtbl-table">
      <thead><tr><th scope="col">날짜</th><th scope="col" class="num">종가</th><th scope="col" class="num">전일대비</th><th scope="col" class="num dtbl-ohl">시가</th><th scope="col" class="num dtbl-ohl">고가</th><th scope="col" class="num dtbl-ohl">저가</th><th scope="col" class="num">거래량</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>
    ${more}
    <p class="dtbl-foot">일봉 종가 기준${src ? ` · 출처 ${escapeHtml(src)}` : ""} · 과거 가격은 액면분할이 반영된 수정 가격일 수 있음</p>`;
  host.hidden = false;
}

document.addEventListener("click", (event) => {
  const btn = event.target && event.target.closest && event.target.closest("[data-dtbl-more]");
  if (!btn) return;
  _dtblState.shown = Math.min(DTBL_MAX, _dtblState.shown + DTBL_PAGE);
  const item = typeof currentChartItem === "function" ? currentChartItem() : null;
  if (item) renderDailyTable(item, { force: true });
});
