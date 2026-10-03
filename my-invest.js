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
  renderMyInvTrend();
  renderMyInvAlloc();
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
