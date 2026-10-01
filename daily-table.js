// daily-table.js — 종목 상세 '개요' 탭 차트 아래 '일별 시세' 표(#dailyPriceTable).
// 데이터는 차트와 같은 일봉(getChartRows(item) = detail chartSeries, 실시간 봉이 있으면 그것까지).
// 국내는 상세 파일(네이버 일봉)이 덮는 날짜는 그 값이고 실시간(야후) 봉은 그 뒤 날짜만 붙는다(app.js mergeKrLiveBars).
// 계산·표기는 daily-table-core.js(window.MirDailyTable), 여기는 표시만.
// drawChart 가 그릴 때마다 부르므로 같은 시계열이면 바로 돌아간다(팬·줌 프레임마다 다시 만들지 않게).
// 클래식 스크립트(전역 공유) — 이름은 dtbl 접두사로 충돌을 피한다.

// 폰(≤640px)은 첫 화면에 10행 — 20행이면 표 하나가 화면 두 장을 차지했다(2026-09-27 모바일 점검).
function dtblPage() {
  try { return window.matchMedia("(max-width: 640px)").matches ? 10 : 20; } catch (_) { return 20; }
}
const DTBL_PAGE = dtblPage();
const DTBL_MAX = 260; // 약 1년치 거래일
let _dtblState = { key: "", shown: DTBL_PAGE, ticker: "" };

function dtblIsKr() { return typeof isKrMarket === "function" && isKrMarket(); }

function dtblHide(host) { if (host) { host.hidden = true; host.innerHTML = ""; } }

// 일봉 원천. barsSource(빌더가 detail 에 기록: naver | yahoo)가 우선, 없으면 예전 historySource.
function dtblSourceLabel(item) {
  const s = String((item && (item.barsSource || item.historySource)) || "").toLowerCase();
  if (s.includes("naver")) return "네이버 금융";
  if (s.includes("yahoo")) return "Yahoo Finance";
  if (s.includes("krx")) return "KRX";
  return "";
}

// 각주: 출처 · 거래량 정의 · 수정주가 설명. 국내 일봉은 네이버 수정주가(분할·증자 권리락, ETF 는 분배금 반영)이고
// 거래량은 네이버 일별 시세와 같은 KRX+NXT 합산이다(2026-10-01). 네이버 일봉이 없는 종목은 야후라고 밝힌다.
function dtblFootParts(item, kr, src) {
  const naver = String((item && item.barsSource) || "").toLowerCase() === "naver";
  const parts = [];
  if (src) {
    const liveFrom = /^\d{4}-\d{2}-\d{2}$/.test(String(item.liveBarsFrom || "")) ? item.liveBarsFrom : "";
    let label = `출처 ${src}`;
    if (kr && naver) label = "출처 네이버 금융(수정주가)";
    else if (kr && src === "Yahoo Finance") label = "출처 Yahoo Finance(네이버 일봉 없음)";
    if (kr && naver && liveFrom) label += ` · ${window.MirDailyTable.fmtDate(liveFrom)}부터는 실시간(Yahoo) 봉`;
    parts.push(label);
  }
  if (kr) parts.push("거래량은 KRX·NXT 합산(네이버 일별 시세 기준)");
  return { parts, naver };
}

// 가격 기준일(스냅샷 priceDate) 행과 확정 전 행 표식. 기준일 행의 종가·거래량은 app.js 의
// alignKrSessionBar 가 시리즈 단계에서 스냅샷 값으로 맞춰 두고(차트·시세정보와 같은 값),
// 여기서는 전일대비를 머리글과 같은 기준으로 낸다.
function dtblRowOptions(item, rowsAll, kr) {
  const core = window.MirDailyTable;
  const priceDate = /^\d{4}-\d{2}-\d{2}$/.test(String(item.priceDate || "")) ? String(item.priceDate) : "";
  const opts = { priceDate, reconciled: false };
  if (!priceDate) return opts;
  opts.provisional = (d) => core.provisionalLabel(d, { market: kr ? "kr" : "us", priceDate });
  const idx = rowsAll.findIndex((r) => r && String(r.d || "").slice(0, 10) === priceDate);
  const price = Number(item.price);
  if (idx < 0 || !(price > 0) || Math.abs(Number(rowsAll[idx].c) - price) > 1e-6 * price) return opts;
  opts.reconciled = true;
  const prevBar = idx > 0 ? Number(rowsAll[idx - 1].c) : null;
  const prevClose = core.snapshotPrevClose(price, item.changePct, prevBar, { kr, etf: typeof isStockEtf === "function" && isStockEtf(item) });
  if (prevClose !== null) opts.prevClose = prevClose;
  return opts;
}

function renderDailyTable(item, options = {}) {
  const host = byId("dailyPriceTable");
  const core = window.MirDailyTable;
  if (!host || !core || !item) return;
  const series = item.chartSeries;
  // 종가만 있는 종목(closeSeries)은 시가·고가·저가가 합성값이라 표를 띄우지 않는다.
  if (!Array.isArray(series) || series.length < 2) { dtblHide(host); _dtblState.key = ""; return; }
  const last = series[series.length - 1];
  // 장중 → 잠정 표식은 시각에 따라 바뀌므로 분 단위 시각도 키에 넣는다(같은 분 안의 재호출만 건너뛴다).
  const key = `${item.ticker}|${series.length}|${Array.isArray(last) ? last.join(",") : JSON.stringify(last)}|${item.priceDate || ""}|${item.price || ""}|${item.barsSource || ""}|${item.liveBarsFrom || ""}|${Math.floor(Date.now() / 60000)}`;
  if (item.ticker !== _dtblState.ticker) _dtblState = { key: "", shown: DTBL_PAGE, ticker: item.ticker };
  if (!options.force && key === _dtblState.key && !host.hidden) return;
  _dtblState.key = key;

  const rowsAll = typeof getChartRows === "function" ? getChartRows(item) : [];
  if (rowsAll.some((r) => r && r.synthetic)) { dtblHide(host); return; }
  const kr = dtblIsKr();
  const shown = Math.min(DTBL_MAX, _dtblState.shown);
  const opts = dtblRowOptions(item, rowsAll, kr);
  const rows = core.buildDailyRows(rowsAll, shown, opts);
  if (!rows.length) { dtblHide(host); return; }
  const total = Math.min(DTBL_MAX, rowsAll.filter((r) => r && Number(r.c) > 0).length);

  const body = rows.map((r) => {
    const ch = core.fmtChange(r.change, r.pct, kr);
    const cls = ch.dir === "up" ? "pos" : ch.dir === "down" ? "neg" : "";
    const tag = r.provisional
      ? ` <span class="dtbl-tag" title="${r.provisional === "장중" ? "정규장 진행 중 — 종가가 아니라 현재까지의 값" : "확정 종가 반영 전 값"}">${escapeHtml(r.provisional)}</span>`
      : "";
    return `<tr${r.provisional ? ` class="dtbl-provisional"` : ""}>
      <td class="dtbl-date"><span class="dtbl-d-long">${escapeHtml(core.fmtDate(r.d))}</span><span class="dtbl-d-short">${escapeHtml(core.fmtDateShort(r.d))}</span>${tag}</td>
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
  // 머리 기준일 = 확정 종가가 있는 가장 최근 날짜. 그 위의 장중·잠정 봉은 따로 적는다.
  const firstFinal = rows.find((r) => !r.provisional);
  const live = rows.filter((r) => r.provisional);
  const asOf = [
    firstFinal ? `기준 ${core.fmtDate(firstFinal.d)} 종가` : "",
    live.length ? `${core.fmtDate(live[0].d)} ${live[0].provisional}` : "",
    `단위 ${unit}`,
  ].filter(Boolean).join(" · ");
  const official = rows.find((r) => r.official);
  const foot = dtblFootParts(item, kr, src);
  // 일봉이 네이버면 종가가 이미 KRX 와 같다. 야후 일봉일 때만 기준일 종가를 스냅샷으로 맞췄다고 적는다.
  const officialNote = kr && official && opts.reconciled && !foot.naver
    ? ` · ${core.fmtDate(official.d)} 종가는 네이버 금융(KRX) 기준`
    : "";
  const adjNote = kr && foot.naver
    ? "과거 가격은 분할·증자 권리락(ETF는 분배금)을 반영한 수정주가"
    : "과거 가격은 액면분할이 반영된 수정 가격일 수 있음";
  host.innerHTML = `<div class="fundamental-head"><h3>일별 시세</h3><span>${escapeHtml(asOf)}</span></div>
    <div class="table-wrap"><table class="dtbl-table">
      <thead><tr><th scope="col">날짜</th><th scope="col" class="num">종가</th><th scope="col" class="num">전일대비</th><th scope="col" class="num dtbl-ohl">시가</th><th scope="col" class="num dtbl-ohl">고가</th><th scope="col" class="num dtbl-ohl">저가</th><th scope="col" class="num">거래량</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>
    ${more}
    <p class="dtbl-foot">일봉 종가 기준${foot.parts.map((t) => ` · ${escapeHtml(t)}`).join("")}${escapeHtml(officialNote)}${live.length ? " · 장중·잠정 행은 확정 종가가 아님" : ""} · ${escapeHtml(adjNote)}</p>`;
  host.hidden = false;
}

document.addEventListener("click", (event) => {
  const btn = event.target && event.target.closest && event.target.closest("[data-dtbl-more]");
  if (!btn) return;
  _dtblState.shown = Math.min(DTBL_MAX, _dtblState.shown + DTBL_PAGE);
  const item = typeof currentChartItem === "function" ? currentChartItem() : null;
  if (item) renderDailyTable(item, { force: true });
});
