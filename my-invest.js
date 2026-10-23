// my-invest.js — 내 투자 › 요약: 내 자산 추이(현재 보유 수량 기준) · 배분 한눈에
// ====================================================================================
// 클래식 스크립트(전역 공유). 계산은 my-invest-core.js(window.MirMyInvestCore).
// 자산 추이는 지금 보유 수량을 과거 종가에 곱한 값이다 — 미르는 매매 이력 없이 수량·평단만 저장하므로
// 실제 계좌 추이가 아니고, 카드에 '현재 보유 수량 기준'이라고 적는다. 가격 이력은 시뮬레이터와 같은
// loadStockDetail → getChartRows(실제 일봉, 합성 이력은 제외)를 쓴다.
// portfolio.js renderPortfolioRiskViews 가 보유가 바뀔 때마다 renderMyInvest 를 부른다.
// 이름은 myInv* 로 전역 충돌을 피한다.

const MY_INV_PERIODS = [[21, "1개월"], [63, "3개월"], [126, "6개월"], [252, "1년"]];
const MY_INV_PERIOD_KEY = "mir.myInvest.period";
const MY_INV_MAX_TICKERS = 40;
let myInvBars = 63;
let myInvSeq = 0;
const myInvMapCache = {};   // `${market}:${ticker}` → Map(date → close) | null(이력 없음)

try {
  const saved = Number(window.safeStorage && window.safeStorage.get(MY_INV_PERIOD_KEY));
  if (MY_INV_PERIODS.some(([b]) => b === saved)) myInvBars = saved;
} catch (_) { /* 저장소 없음 */ }

function myInvHoldings() {
  return (Array.isArray(portfolio) ? portfolio : [])
    .filter((p) => p && p.ticker && Number(p.qty) > 0 && typeof stockByTicker === "function" && stockByTicker(p.ticker))
    .map((p) => ({ t: p.ticker, qty: Number(p.qty) }));
}

function myInvBenchTicker() {
  const list = (marketCfg().etfBenchmarks || []).filter((t) => stockByTicker(t));
  return list[0] || "";
}

function myInvLoadMap(ticker) {
  const key = `${marketCfg().id}:${ticker}`;
  if (key in myInvMapCache) return Promise.resolve(myInvMapCache[key]);
  const stock = stockByTicker(ticker);
  return loadStockDetail(ticker).then((detail) => {
    const merged = detail ? { ...stock, ...detail } : stock;
    if (!merged || (typeof isSyntheticChart === "function" && isSyntheticChart(merged))) { myInvMapCache[key] = null; return null; }
    const map = closeSeriesToDateMap(getChartRows(merged));
    myInvMapCache[key] = map.size >= 2 ? map : null;
    return myInvMapCache[key];
  }).catch(() => null);
}

function myInvMoney(v) { return marketCfg().formatMoney(v); }
function myInvDelta(v) { return `${v >= 0 ? "+" : "-"}${myInvMoney(Math.abs(v))}`; }

function renderMyInvest() {
  pfHistRecord();
  renderMyInvTrend();
  renderMyInvAlloc();
  renderPfValueHist();
  renderMyInvLimits();
}

// ------------------------------------------------------------------ 내 자산 추이
function renderMyInvTrend() {
  const host = byId("myTrendCard");
  const core = window.MirMyInvestCore;
  if (!host || !core) return;
  const holdings = myInvHoldings().slice(0, MY_INV_MAX_TICKERS);
  if (!holdings.length) { host.hidden = true; host.innerHTML = ""; return; }
  host.hidden = false;
  if (!host.dataset.bound) {
    host.dataset.bound = "1";
    host.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-inv-bars]");
      if (!b) return;
      myInvBars = Number(b.dataset.invBars) || 63;
      try { window.safeStorage && window.safeStorage.set(MY_INV_PERIOD_KEY, String(myInvBars)); } catch (_) { /* 무시 */ }
      renderMyInvTrend();
    });
    host.addEventListener("pointermove", myInvHover);
    host.addEventListener("pointerleave", () => { const t = host.querySelector(".inv-tip"); if (t) t.hidden = true; const l = host.querySelector(".inv-cursor"); if (l) l.setAttribute("opacity", "0"); });
  }
  if (!host.innerHTML) host.innerHTML = `<div class="inv-head"><h3>내 자산 추이</h3></div><p class="muted">가격 이력을 불러오는 중…</p>`;
  const seq = ++myInvSeq;
  const bench = myInvBenchTicker();
  const tickers = [...new Set([...holdings.map((h) => h.t), bench].filter(Boolean))];
  Promise.all(tickers.map((t) => myInvLoadMap(t).then((m) => [t, m]))).then((pairs) => {
    if (seq !== myInvSeq) return;
    const maps = {};
    pairs.forEach(([t, m]) => { if (m) maps[t] = m; });
    const r = core.holdingsTrend(holdings, maps, bench ? maps[bench] : null, myInvBars);
    host.innerHTML = myInvTrendHtml(r, bench);
    host._invTrend = r;
  });
}

function myInvTrendHtml(r, bench) {
  const seg = `<div class="segmented inv-seg" role="group" aria-label="기간">${MY_INV_PERIODS.map(([b, l]) =>
    `<button type="button" data-inv-bars="${b}" class="${b === myInvBars ? "is-active" : ""}" aria-pressed="${b === myInvBars}">${l}</button>`).join("")}</div>`;
  if (!r) return `<div class="inv-head"><h3>내 자산 추이</h3>${seg}</div><p class="muted">보유 종목의 실제 가격 이력이 없어 추이를 그릴 수 없습니다.</p>`;
  const label = (MY_INV_PERIODS.find(([b]) => b === myInvBars) || [])[1] || "";
  const short = r.dates.length < myInvBars * 0.9 ? ` · 이력이 ${r.dates.length}거래일뿐` : "";
  const benchName = bench ? (isKrMarket() ? stockLabel(bench) : `S&P 500(${bench})`) : "";
  const benchEnd = r.benchPct ? r.benchPct[r.benchPct.length - 1] : null;
  const vs = benchEnd != null ? `<span class="inv-vs">${escapeHtml(benchName)} <b class="${cls(benchEnd)}">${fmtPct(benchEnd)}</b></span>` : "";
  const excluded = r.excluded.length ? `<p class="inv-note">이력이 짧은 ${r.excluded.length}종목(${escapeHtml(r.excluded.map((t) => stockLabel(t)).join(", "))}) 제외</p>` : "";
  return `
    <div class="inv-head">
      <div><h3>내 자산 추이</h3><small class="inv-basis">현재 보유 수량 기준</small></div>
      ${seg}
    </div>
    <div class="inv-figure">
      <strong>${myInvMoney(r.end)}</strong>
      <span class="${cls(r.change)}">${label}${short} ${myInvDelta(r.change)} (${fmtPct(r.changePct)})</span>
      ${vs}
    </div>
    <div class="inv-chart-wrap">${myInvChartSvg(r)}<div class="inv-tip" hidden></div></div>
    ${excluded}`;
}

function myInvChartSvg(r) {
  const W = 720, H = 200, P = { l: 4, r: 4, t: 10, b: 10 };
  const all = [...r.pct, ...(r.benchPct || [])].filter(Number.isFinite);
  let lo = Math.min(0, ...all), hi = Math.max(0, ...all);
  if (hi - lo < 1) { hi += 0.5; lo -= 0.5; }
  const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
  const n = r.pct.length;
  const x = (i) => P.l + (i / Math.max(1, n - 1)) * (W - P.l - P.r);
  const y = (v) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
  const line = (arr) => arr.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const up = r.change >= 0;
  const area = `${line(r.pct)}L${x(n - 1).toFixed(1)},${y(lo).toFixed(1)}L${x(0).toFixed(1)},${y(lo).toFixed(1)}Z`;
  return `<svg class="inv-chart ${up ? "is-up" : "is-down"}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="내 자산 추이 차트">
      <line class="inv-zero" x1="${P.l}" x2="${W - P.r}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}"/>
      <path class="inv-area" d="${area}"/>
      ${r.benchPct ? `<path class="inv-bench" d="${line(r.benchPct)}"/>` : ""}
      <path class="inv-line" d="${line(r.pct)}"/>
      <line class="inv-cursor" x1="0" x2="0" y1="${P.t}" y2="${H - P.b}" opacity="0"/>
    </svg>`;
}

function myInvHover(ev) {
  const host = byId("myTrendCard");
  const r = host && host._invTrend;
  const svg = host && host.querySelector(".inv-chart");
  if (!r || !svg) return;
  const box = svg.getBoundingClientRect();
  if (ev.clientX < box.left || ev.clientX > box.right || ev.clientY < box.top || ev.clientY > box.bottom) return;
  const n = r.values.length;
  const i = Math.max(0, Math.min(n - 1, Math.round(((ev.clientX - box.left) / box.width) * (n - 1))));
  const cur = svg.querySelector(".inv-cursor");
  const xv = 4 + (i / Math.max(1, n - 1)) * (720 - 8);
  if (cur) { cur.setAttribute("x1", xv); cur.setAttribute("x2", xv); cur.setAttribute("opacity", "1"); }
  const tip = host.querySelector(".inv-tip");
  if (!tip) return;
  const b = r.benchPct ? r.benchPct[i] : null;
  tip.innerHTML = `<b>${escapeHtml(r.dates[i])}</b><span>${myInvMoney(r.values[i])} <em class="${cls(r.pct[i])}">${fmtPct(r.pct[i])}</em></span>${b != null ? `<span class="muted">지수 ${fmtPct(b)}</span>` : ""}`;
  tip.hidden = false;
  const left = Math.min(box.width - 150, Math.max(0, ev.clientX - box.left + 10));
  tip.style.left = `${left}px`;
}

// ------------------------------------------------------------------ 배분 한눈에
function renderMyInvAlloc() {
  const host = byId("myAllocCard");
  const core = window.MirMyInvestCore;
  if (!host || !core) return;
  const rows = (Array.isArray(portfolio) ? portfolio : []).map((p) => {
    const s = stockByTicker(p.ticker);
    if (!s) return null;
    const value = Number(p.qty) * (Number(s.price) || 0);
    const sector = typeof isStockEtf === "function" && isStockEtf(s) ? "ETF" : (typeof sectorLabelKo === "function" ? sectorLabelKo(s.sector) : s.sector) || "기타";
    return { ticker: p.ticker, key: sector, value };
  }).filter(Boolean);
  const a = core.allocation(rows);
  if (!a.total) { host.hidden = true; host.innerHTML = ""; return; }
  host.hidden = false;
  const topStock = rows.slice().sort((x, y) => y.value - x.value)[0];
  const topStockPct = topStock ? (topStock.value / a.total) * 100 : 0;
  const colors = typeof PIE_COLORS !== "undefined" ? PIE_COLORS : ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7"];
  const verdict = a.concentrated
    ? `${escapeHtml(a.top.key)} 비중이 ${a.top.pct.toFixed(0)}%로 한 섹터에 몰려 있습니다`
    : `가장 큰 섹터는 ${escapeHtml(a.top.key)} ${a.top.pct.toFixed(0)}%`;
  const stockLine = topStock && topStockPct >= 25
    ? ` · 최대 종목 ${escapeHtml(stockLabel(topStock.ticker))} ${topStockPct.toFixed(0)}%` : "";
  host.innerHTML = `
    <div class="inv-head"><h3>배분 한눈에</h3>
      <div class="inv-links"><button type="button" class="ghost compact-btn" data-inv-go="holdings">보유 종목 ›</button><button type="button" class="ghost compact-btn" data-inv-go="tools:xray">분산 점검 ›</button></div></div>
    <p class="inv-verdict${a.concentrated ? " is-warn" : ""}">${verdict}${stockLine}</p>
    <div class="inv-stack" role="img" aria-label="섹터 배분">${a.parts.map((p, i) =>
      `<i style="width:${p.pct.toFixed(2)}%;background:${colors[i % colors.length]}" title="${escapeHtml(`${p.key} ${p.pct.toFixed(1)}%`)}"></i>`).join("")}</div>
    <ul class="inv-legend">${a.parts.slice(0, 6).map((p, i) =>
      `<li><i style="background:${colors[i % colors.length]}"></i>${escapeHtml(p.key)} <b>${p.pct.toFixed(0)}%</b></li>`).join("")}${a.parts.length > 6 ? `<li class="muted">외 ${a.parts.length - 6}개</li>` : ""}</ul>`;
  if (!host.dataset.bound) {
    host.dataset.bound = "1";
    host.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-inv-go]");
      if (!b) return;
      const [sub, tool] = b.dataset.invGo.split(":");
      activateTab("bulk", { sub, push: true });
      if (tool) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.set("tool", tool);
          history.replaceState(history.state, "", url.toString());
        } catch (_) { /* 무시 */ }
        const fold = document.querySelector(`#sub-bulk-tools details[data-toc-key="${tool}"]`);
        if (fold) { fold.open = true; fold.scrollIntoView({ block: "start", behavior: "smooth" }); }
      }
    });
  }
}

// ------------------------------------------------------------------ 평가액·원금 기록(2026-10-23, 레퍼런스 #11)
// 위 '내 자산 추이'는 지금 수량을 과거 종가에 곱한 가정이고, 이쪽은 **방문한 날 실제로 본 평가액·원금**을 하루 한 점씩
// 이 브라우저에 쌓는다(mir_pf_value_hist_v1:<시장>). 같은 날 다시 오면 그 점을 새 값으로 바꾼다. 방문하지 않은 날은
// 비워 둔다 — 선을 끊고 툴팁에 '기록 없음'(보간 안 함). 클라우드 동기화에는 싣지 않는다(워커가 정해진 필드만 저장).
const PF_HIST_KEY = (m) => `mir_pf_value_hist_v1:${m}`;
const PF_HIST_PERIOD_KEY = "mir.pfHist.period";
const PF_HIST_PERIODS = [["1M", "1개월"], ["3M", "3개월"], ["1Y", "1년"], ["ALL", "전체"]];
let pfHistPeriod = (() => {
  try { const v = window.safeStorage && window.safeStorage.get(PF_HIST_PERIOD_KEY); return PF_HIST_PERIODS.some(([k]) => k === v) ? v : "3M"; } catch (_) { return "3M"; }
})();

function pfHistMarket() { return isKrMarket() ? "kr" : "us"; }
function pfHistToday() { return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }); }
function pfHistLoad(m) {
  try { const v = window.safeStorage.getJSON(PF_HIST_KEY(m || pfHistMarket()), []); return Array.isArray(v) ? v : []; } catch (_) { return []; }
}

// 지금 시장 보유 중 스냅샷에 시세가 있는 종목만으로 평가액·원금(평단 × 수량)을 낸다.
function pfHistCurrent() {
  const rows = (Array.isArray(portfolio) ? portfolio : []).map((p) => {
    const s = p && p.ticker ? stockByTicker(p.ticker) : null;
    const price = s ? Number(s.price) : 0;
    const qty = Number(p && p.qty);
    if (!(price > 0) || !(qty > 0)) return null;
    return { value: qty * price, principal: qty * (Number(p.avgCost) || 0) };
  }).filter(Boolean);
  if (!rows.length) return null;
  return {
    date: pfHistToday(),
    value: rows.reduce((a, r) => a + r.value, 0),
    principal: rows.reduce((a, r) => a + r.principal, 0),
    currency: isKrMarket() ? "KRW" : "USD",
  };
}

function pfHistRecord() {
  const core = window.MirMyInvestCore;
  const snap = core && pfHistCurrent();
  if (!snap) return;
  const list = pfHistLoad();
  const prev = list.find((x) => x && x.date === snap.date);
  if (prev && Math.abs(prev.value - snap.value) < 0.005 && Math.abs(prev.principal - snap.principal) < 0.005) return;
  try { window.safeStorage.setJSON(PF_HIST_KEY(pfHistMarket()), core.upsertSnapshot(list, snap)); } catch (_) { /* 저장소 없음 */ }
}

// 차트 SVG — x 는 날짜(하루 단위), 연속된 날만 선으로 잇는다. 혼자 떨어진 날은 점.
function pfHistSvg(series, opts = {}) {
  const W = 720, H = opts.height || 180, P = { l: 4, r: 4, t: 10, b: 10 };
  const vals = series.points.flatMap((p) => [p.value, p.principal]).filter((v) => Number.isFinite(v) && v > 0);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (!(hi > lo)) { hi = hi * 1.01 + 1; lo = lo * 0.99; }
  const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
  const x = (i) => P.l + (i / series.span) * (W - P.l - P.r);
  const y = (v) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
  const path = (seg, k) => seg.map((p, j) => `${j ? "L" : "M"}${x(p.i).toFixed(1)},${y(p[k]).toFixed(1)}`).join("");
  const parts = series.segments.map((seg) => {
    if (seg.length === 1) {
      const p = seg[0];
      // 가로세로 비율이 늘어나는 viewBox 라 circle 은 타원이 된다 — 길이 0 선 + 둥근 끝(non-scaling)으로 점을 찍는다.
      const dot = (k, c) => `<path class="${c}" d="M${x(p.i).toFixed(1)},${y(p[k]).toFixed(1)}h0.01"/>`;
      return dot("principal", "ph-dot-p") + dot("value", "ph-dot");
    }
    return `<path class="ph-principal" d="${path(seg, "principal")}"/><path class="ph-value" d="${path(seg, "value")}"/>`;
  }).join("");
  return `<svg class="ph-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="평가액·원금 추이" style="height:${H}px">
      ${parts}
      ${opts.cursor === false ? "" : `<line class="inv-cursor" x1="0" x2="0" y1="${P.t}" y2="${H - P.b}" opacity="0"/>`}
    </svg>`;
}

function pfHistFigure(last) {
  const pl = last.value - last.principal;
  const plPct = last.principal > 0 ? (pl / last.principal) * 100 : null;
  return `<div class="inv-figure ph-figure"><strong>${myInvMoney(last.value)}</strong>
      <span class="muted">원금 ${myInvMoney(last.principal)}</span>
      <span class="${cls(pl)}">${myInvDelta(pl)}${plPct != null ? ` (${fmtPct(plPct)})` : ""}</span></div>`;
}

function renderPfValueHist() {
  const host = byId("pfValueHistCard");
  const core = window.MirMyInvestCore;
  if (!host || !core) return;
  const list = pfHistLoad();
  if (!list.length) { host.hidden = true; host.innerHTML = ""; return; }
  host.hidden = false;
  if (!host.dataset.bound) {
    host.dataset.bound = "1";
    host.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-ph-period]");
      if (!b) return;
      pfHistPeriod = b.dataset.phPeriod;
      try { window.safeStorage.set(PF_HIST_PERIOD_KEY, pfHistPeriod); } catch (_) { /* 무시 */ }
      renderPfValueHist();
    });
    host.addEventListener("pointermove", pfHistHover);
    host.addEventListener("pointerleave", () => { const t = host.querySelector(".inv-tip"); if (t) t.hidden = true; const l = host.querySelector(".inv-cursor"); if (l) l.setAttribute("opacity", "0"); });
  }
  const seg = `<div class="segmented inv-seg" role="group" aria-label="기간">${PF_HIST_PERIODS.map(([k, l]) =>
    `<button type="button" data-ph-period="${k}" class="${k === pfHistPeriod ? "is-active" : ""}" aria-pressed="${k === pfHistPeriod}">${l}</button>`).join("")}</div>`;
  const series = core.snapshotSeries(list, pfHistPeriod, pfHistToday());
  const head = `<div class="inv-head"><div><h3>평가액 추이</h3><small class="inv-basis">방문한 날 기록 · 이 브라우저에만 저장</small></div>${seg}</div>`;
  host._phSeries = series;
  if (!series) { host.innerHTML = `${head}<p class="muted">이 기간에는 기록이 없습니다.</p>`; return; }
  const last = series.points[series.points.length - 1];
  host.innerHTML = `${head}${pfHistFigure(last)}
    <div class="inv-chart-wrap">${pfHistSvg(series)}<div class="inv-tip" hidden></div></div>
    <p class="inv-note ph-legend"><span class="ph-k-value"></span>평가액 <span class="ph-k-principal"></span>원금 · 기록 ${series.points.length}일${series.points.length < 2 ? " · 다음 방문부터 선으로 이어집니다" : ""}</p>`;
}

function pfHistHover(ev) {
  const host = byId("pfValueHistCard");
  const s = host && host._phSeries;
  const svg = host && host.querySelector(".ph-chart");
  const core = window.MirMyInvestCore;
  if (!s || !svg || !core) return;
  const box = svg.getBoundingClientRect();
  if (ev.clientX < box.left || ev.clientX > box.right || ev.clientY < box.top || ev.clientY > box.bottom) return;
  const i = Math.max(0, Math.min(s.span, Math.round(((ev.clientX - box.left) / box.width) * s.span)));
  const cur = svg.querySelector(".inv-cursor");
  const xv = 4 + (i / s.span) * (720 - 8);
  if (cur) { cur.setAttribute("x1", xv); cur.setAttribute("x2", xv); cur.setAttribute("opacity", "1"); }
  const tip = host.querySelector(".inv-tip");
  if (!tip) return;
  const date = core.seriesDate(s, i);
  const p = s.byDate.get(date);
  if (p) {
    const pl = p.value - p.principal;
    tip.innerHTML = `<b>${escapeHtml(date)}</b><span>평가액 ${myInvMoney(p.value)}</span><span class="muted">원금 ${myInvMoney(p.principal)}</span><span class="${cls(pl)}">${myInvDelta(pl)}</span>`;
  } else {
    tip.innerHTML = `<b>${escapeHtml(date)}</b><span class="muted">기록 없음</span>`;
  }
  tip.hidden = false;
  tip.style.left = `${Math.min(box.width - 150, Math.max(0, ev.clientX - box.left + 10))}px`;
}

// 대시보드 위젯(my-dash.js DASH_RENDER.valueTrend) — 같은 기록으로 작은 차트.
function pfHistWidgetHtml() {
  const core = window.MirMyInvestCore;
  if (!core) return "";
  const series = core.snapshotSeries(pfHistLoad(), pfHistPeriod, pfHistToday());
  if (!series) return '<p class="muted">아직 기록이 없습니다. 보유 종목이 있으면 방문한 날마다 하루 한 점씩 쌓입니다.</p>';
  const last = series.points[series.points.length - 1];
  const label = (PF_HIST_PERIODS.find(([k]) => k === pfHistPeriod) || [])[1] || "";
  return `${pfHistFigure(last)}${pfHistSvg(series, { height: 110, cursor: false })}
    <p class="muted dash-asof">${escapeHtml(label)} · 기록 ${series.points.length}일 · 빈 날은 기록 없음</p>`;
}

// ------------------------------------------------------------------ 집중 한도 점검(2026-10-23, 레퍼런스 #12)
// 단일 종목·섹터·통화 비중을 사용자가 정한 한도와 비교한 사실만 보여 준다(평가어 없음).
// 종목·섹터는 보유 ETF 가 있으면 ETF 룩스루(lookthrough.js, 공개 상위 구성으로 펼친 비중)를, 없으면 직접 보유 비중을 쓴다.
// 통화는 지금 시장 평가액 + 다른 시장의 마지막 평가액 기록(위 기록)을 현재 USD/KRW 로 원화 환산해 나눈다.
const PF_LIMIT_KEY = "mir_concentration_limits_v1";
function pfLimitSettings() {
  const core = window.MirMyInvestCore;
  let raw = null;
  try { raw = window.safeStorage.getJSON(PF_LIMIT_KEY, null); } catch (_) { raw = null; }
  return core ? core.limitSettings(raw) : { stock: 10, sector: 30, currency: null };
}

function pfLimitGroups() {
  const lt = window.MirLookthrough;
  const positions = lt && lt.heldPositions ? lt.heldPositions() : [];
  const total = positions.reduce((s, p) => s + p.value, 0);
  if (!(total > 0)) return null;
  const label = (t, n) => { const s = t ? stockByTicker(t) : null; return s ? stockLabel(s.ticker, s) : (t || n || "—"); };
  const secLabel = (s) => (lt && lt.sectorLabel ? lt.sectorLabel(s) : (typeof sectorLabelKo === "function" ? sectorLabelKo(s) : s));
  const hasEtf = positions.some((p) => p.isEtf);
  const r = hasEtf && lt.lastFor ? lt.lastFor(positions) : null;
  let stock, sector, basis;
  if (r) {
    stock = r.exposures.map((e) => ({ label: label(e.ticker, e.name), pct: e.totalPct }));
    sector = (lt.mergedSectors ? lt.mergedSectors(r.sectors) : []).filter((x) => !x.special).map((x) => ({ label: x.label, pct: x.pct }));
    basis = "ETF는 공개 구성으로 펼친 비중";
  } else {
    stock = positions.filter((p) => !p.isEtf).map((p) => ({ label: label(p.ticker), pct: (p.value / total) * 100 }));
    const acc = {};
    positions.filter((p) => !p.isEtf).forEach((p) => { const k = secLabel(p.sector || "MISC"); acc[k] = (acc[k] || 0) + (p.value / total) * 100; });
    sector = Object.entries(acc).map(([k, pct]) => ({ label: k, pct }));
    basis = hasEtf ? "ETF 구성 불러오는 중 — 직접 보유분만" : "";
  }
  // 통화: 지금 시장 + 다른 시장 마지막 기록.
  const cur = isKrMarket() ? "KRW" : "USD";
  const otherM = isKrMarket() ? "us" : "kr";
  const otherList = pfHistLoad(otherM);
  const otherLast = otherList[otherList.length - 1];
  const fx = typeof currentUsdKrw === "function" ? currentUsdKrw() : null;
  let currency = [{ label: cur, pct: 100 }];
  let currencyNote = "";
  if (otherLast && otherLast.value > 0) {
    const oc = otherLast.currency === "USD" ? "USD" : "KRW";
    if (fx) {
      const toKrw = (v, c) => (c === "USD" ? v * fx : v);
      const a = toKrw(total, cur), b = toKrw(otherLast.value, oc);
      currency = [{ label: cur, pct: (a / (a + b)) * 100 }, { label: oc, pct: (b / (a + b)) * 100 }];
      currencyNote = `${otherM === "kr" ? "국내" : "미국"} 보유는 ${String(otherLast.date).slice(5)} 기록 기준`;
    } else currencyNote = "환율이 없어 지금 시장만";
  } else currencyNote = "다른 시장 보유 기록 없음";
  return { stock, sector, currency, basis, currencyNote };
}

function renderMyInvLimits() {
  const host = byId("pfLimitCard");
  const core = window.MirMyInvestCore;
  if (!host || !core) return;
  const g = pfLimitGroups();
  if (!g) { host.hidden = true; host.innerHTML = ""; return; }
  host.hidden = false;
  const lim = pfLimitSettings();
  const checks = core.concentrationChecks(g, lim);
  const names = { stock: "단일 종목", sector: "단일 섹터", currency: "단일 통화" };
  const pct = (v) => `${v.toFixed(v < 10 ? 1 : 0)}%`;
  const items = checks.map((c) => {
    const detail = c.ok
      ? (c.max ? `최대 ${escapeHtml(c.max.label)} ${pct(c.max.pct)}` : "해당 없음")
      : `설정 한도 초과: ${c.over.slice(0, 5).map((o) => `${escapeHtml(o.label)} ${pct(o.pct)}`).join(", ")}${c.over.length > 5 ? ` 외 ${c.over.length - 5}` : ""} &gt; ${c.limit}%`;
    const note = c.kind === "currency" && g.currencyNote ? ` <small class="muted">${escapeHtml(g.currencyNote)}</small>` : "";
    return `<li class="${c.ok ? "is-pass" : "is-warn"}"><span class="pl-mark" aria-hidden="true">${c.ok ? "✓" : "!"}</span>
      <span><b>${names[c.kind]} ≤ ${c.limit}%</b> <span class="pl-state">${c.ok ? "통과" : "주의"}</span><br><span class="pl-detail">${detail}</span>${note}</span></li>`;
  }).join("");
  const open = !!host.querySelector("details[open]");
  const input = (k, v) => `<label>${names[k]} <input type="number" min="0" max="100" step="1" value="${v == null ? "" : v}" placeholder="없음" data-pl-limit="${k}" aria-label="${names[k]} 한도(%)"> %</label>`;
  host.innerHTML = `<div class="inv-head"><div><h3>집중 한도 점검</h3>${g.basis ? `<small class="inv-basis">${escapeHtml(g.basis)}</small>` : ""}</div>
      <details class="div-tax-set pl-set"${open ? " open" : ""}><summary class="ghost compact-btn">한도 설정</summary>
        <div class="div-tax-pop">${input("stock", lim.stock)}${input("sector", lim.sector)}${input("currency", lim.currency)}<small class="muted">비우면 점검하지 않음</small></div></details></div>
    ${checks.length ? `<ul class="pl-list">${items}</ul>` : '<p class="muted">설정한 한도가 없습니다.</p>'}`;
  if (!host.dataset.bound) {
    host.dataset.bound = "1";
    host.addEventListener("change", (ev) => {
      const el = ev.target.closest("[data-pl-limit]");
      if (!el) return;
      const cur = pfLimitSettings();
      const n = Number(el.value);
      cur[el.dataset.plLimit] = el.value === "" ? null : (Number.isFinite(n) && n > 0 && n <= 100 ? n : null);
      try { window.safeStorage.setJSON(PF_LIMIT_KEY, cur); } catch (_) { /* 저장소 없음 */ }
      renderMyInvLimits();
    });
  }
}
