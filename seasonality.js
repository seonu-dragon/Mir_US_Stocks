// seasonality.js — 종목 상세 차트 탭 '월별 시즈널리티' 히트맵(#seasonalityCard).
// 데이터는 차트와 같은 일봉(getChartRows(item) = detail chartSeries, 약 5년). 지수는 대표 ETF
// (SPY·QQQ·KODEX 200 등) 상세에서 같은 표가 나온다. 계산은 seasonality-core.js(window.MirSeasonality),
// 여기는 표시만. drawChart 가 그릴 때마다 부르므로 같은 시계열이면 바로 돌아간다.
// 클래식 스크립트(전역 공유) — 이름은 seas 접두사로 충돌을 피한다.

let _seasKey = "";

function seasHide(host) { if (host) { host.hidden = true; host.innerHTML = ""; } }

function seasCell(m, cur) {
  const core = window.MirSeasonality;
  if (!m) return `<td class="num seas-empty${cur ? " seas-cur" : ""}">·</td>`;
  const a = Math.round(8 + 42 * core.heat(m.pct, 10));
  const tone = m.pct >= 0 ? "--pos" : "--neg";
  const style = `background:color-mix(in srgb, var(${tone}) ${a}%, transparent)`;
  const tip = m.partial ? ` title="진행 중인 달"` : "";
  return `<td class="num${m.partial ? " seas-partial" : ""}${cur ? " seas-cur" : ""}" style="${style}"${tip}>${escapeHtml(core.fmtPct(m.pct))}</td>`;
}

function renderSeasonality(item) {
  const host = byId("seasonalityCard");
  const core = window.MirSeasonality;
  if (!host || !core || !item) return;
  const series = item.chartSeries;
  if (!Array.isArray(series) || series.length < 60) { seasHide(host); _seasKey = ""; return; }
  const last = series[series.length - 1];
  const key = `${item.ticker}|${series.length}|${Array.isArray(last) ? last.join(",") : JSON.stringify(last)}|${item.liveBarsFrom || ""}`;
  if (key === _seasKey && !host.hidden) return;
  _seasKey = key;

  const rows = typeof getChartRows === "function" ? getChartRows(item) : [];
  if (!rows.length || rows.some((r) => r && r.synthetic)) { seasHide(host); return; }
  const r = core.compute(rows);
  // 2년 미만이면 달별 표본이 1개뿐이라 시즈널리티가 아니다.
  if (!r || r.yearsCount < 2) { seasHide(host); return; }

  const curMonth = Number(String(r.lastMonth).slice(5, 7));
  const head = Array.from({ length: 12 }, (_, i) => `<th scope="col" class="num${i + 1 === curMonth ? " seas-cur" : ""}">${i + 1}월</th>`).join("");
  const avgRow = r.summary.map((s) => seasCell(s.avg === null ? null : { pct: s.avg }, s.month === curMonth)).join("");
  const winRow = r.summary.map((s) => {
    const cur = s.month === curMonth ? " seas-cur" : "";
    if (s.winRate === null) return `<td class="num seas-empty${cur}">·</td>`;
    const cls = s.winRate >= 60 ? "pos" : s.winRate <= 40 ? "neg" : "";
    return `<td class="num seas-win ${cls}${cur}" title="${s.n}년 중 ${Math.round((s.winRate * s.n) / 100)}번 상승">${Math.round(s.winRate)}%</td>`;
  }).join("");
  const yearRows = r.years.map((y) => {
    const cells = y.months.map((m, i) => seasCell(m, i + 1 === curMonth)).join("");
    const tot = y.total === null ? "—" : core.fmtPct(y.total);
    const totCls = y.total === null ? "" : y.total >= 0 ? "pos" : "neg";
    return `<tr><th scope="row">${y.year}</th>${cells}<td class="num seas-total ${totCls}">${escapeHtml(tot)}</td></tr>`;
  }).join("");
  const range = `${String(r.firstMonth).replace("-", ".")}~${String(r.lastMonth).replace("-", ".")}`;
  host.innerHTML = `<div class="fundamental-head"><h3>월별 시즈널리티</h3><span>${escapeHtml(range)}</span></div>
    <div class="table-wrap"><table class="seas-table">
      <thead><tr><th scope="col">연도</th>${head}<th scope="col" class="num">연간</th></tr></thead>
      <tbody>
        <tr class="seas-sum"><th scope="row">평균</th>${avgRow}<td></td></tr>
        <tr class="seas-sum seas-sum-last"><th scope="row">상승 확률</th>${winRow}<td></td></tr>
        ${yearRows}
      </tbody>
    </table></div>`;
  host.hidden = false;
}
