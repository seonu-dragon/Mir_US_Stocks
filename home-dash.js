// home-dash.js — 오늘 탭(요약)의 첫 화면: 지수 카드 캐러셀 → 선택 지수 큰 차트 + 시장 현황 → AI 브리핑 요약.
// ====================================================================================
// 클래식 스크립트(모듈 아님). 전역 이름은 hd 접두사.
// 새로 받는 것은 큰 지수 차트의 라이브 시리즈(워커 ?indices=1 한 번의 묶음 요청, 장중에만 1분 폴링)뿐이다.
// 나머지는 이미 있는 것을 다시 배치한다.
//   · 지수: marketHeader.indices(signals.js — 워커 당일 5분 시리즈 / KR 은 스냅샷 + 추종 ETF 종가 근사)
//     라이브 응답(hdLive)이 오면 카드의 가격·등락률·스파크라인도 그 값으로 덮는다(같은 응답이라 추가 요청 없음).
//   · 환율: marketHeader.fx(현재가·등락률만, 추이 없음)
//   · 시장 현황: data.stocks(ETF 제외 개별 종목) 상승·보합·하락 수, 52주 고점 근처 수, CNN 공포·탐욕
//   · 국내 수급: window.KR_MARKET_FUNDS(lazy, kr-flow-panels.js 와 같은 파일) 최근 거래일 투자자별 순매수
//   · AI 브리핑: data.ai_briefing / data/briefings/<key>.json(app.js renderBriefingSide 와 같은 원본)
// 렌더 진입점: renderIndexStrip(app.js) → renderHomeIndexCarousel, renderAll·refreshFeatureViews → renderHomeDash.

let hdSelected = null;      // 선택된 지수 심볼
let hdIndices = [];         // 마지막으로 받은 지수 목록(캐러셀 순서, 라이브 값 반영)
let hdIndicesRaw = [];      // renderIndexStrip 이 준 원본(라이브 응답이 오면 이걸로 다시 그린다)
const HD_BRIEF_CACHE = {};  // key → html(없으면 "")

function hdNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function hdFmtLevel(v) {
  const n = hdNum(v);
  return n == null ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: n < 100 ? 2 : 2 });
}

function hdSpark(series, up) {
  const vals = (series || []).map(Number).filter(Number.isFinite);
  if (vals.length < 2) return "";
  const w = 64, h = 28;
  const min = Math.min(...vals), max = Math.max(...vals), rng = max - min || 1;
  const pts = vals.map((v, i) => `${((i / (vals.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - min) / rng) * (h - 4)).toFixed(1)}`).join(" ");
  return `<svg class="home-idx-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${up ? "var(--pos)" : "var(--neg)"}" stroke-width="1.5" vector-effect="non-scaling-stroke"></polyline></svg>`;
}

function hdFxCards() {
  const fx = (typeof marketHeader !== "undefined" && Array.isArray(marketHeader.fx)) ? marketHeader.fx : [];
  const usd = fx.find((r) => r && r.symbol === "KRW=X");
  if (!usd || hdNum(usd.price) == null) return "";
  const chg = hdNum(usd.changePct);
  return `<div class="home-idx-card is-static" role="presentation" title="환율은 현재가와 등락률만 제공합니다">
      <span class="home-idx-name">USD/KRW</span>
      <span class="home-idx-price">${hdFmtLevel(usd.price)}</span>
      <span class="home-idx-chg ${chg == null ? "muted" : cls(chg)}">${chg == null ? "—" : fmtPct(chg)}</span>
    </div>`;
}

// renderIndexStrip(app.js) 이 오늘 탭 스트립 대신 이걸 부른다. 시장 폭 탭(#indexStripFull)은 기존 카드 그대로.
function renderHomeIndexCarousel(el, indices) {
  if (!el) return;
  // 시장별 앞줄: 미국 S&P·나스닥·다우, 국내 코스피·코스닥. 나머지는 받은 순서.
  const lead = isKrMarket() ? ["^KS11", "^KQ11", "^GSPC", "^IXIC"] : ["^GSPC", "^IXIC", "^DJI", "^RUT"];
  const rank = (ix) => { const i = lead.indexOf(ix.symbol); return i < 0 ? 99 : i; };
  hdIndicesRaw = Array.isArray(indices) ? indices : [];
  // 미국 모드는 부팅 때 헤더가 워커 응답을 이미 받았다 — 그걸 첫 라이브 값으로 쓴다(추가 요청 없음).
  if (!hdLive.rows && typeof marketHeader !== "undefined" && marketHeader.indicesSource === "worker" && hdIndicesRaw.some((ix) => Array.isArray(ix.series) && ix.series.length >= 2 && !ix.seriesNote)) {
    hdLive.rows = hdIndicesRaw.filter((ix) => !ix.seriesNote);
    hdLive.at = Date.now();
  }
  const withLive = (ix) => {
    const live = hdLiveRow(ix.symbol);
    if (!live || live === ix) return ix;
    const price = hdNum(live.price), chg = hdNum(live.changePct);
    return { ...ix, price: price ?? ix.price, changePct: chg ?? ix.changePct, series: live.series.length >= 2 ? live.series : ix.series, seriesNote: live.series.length >= 2 ? "" : ix.seriesNote };
  };
  hdIndices = hdIndicesRaw.filter((ix) => ix && ix.name).map((ix, i) => ({ ix: withLive(ix), i }))
    .sort((a, b) => rank(a.ix) - rank(b.ix) || a.i - b.i).map((r) => r.ix);
  if (!hdIndices.length) {
    el.innerHTML = `<p class="home-idx-empty muted">지수 시세를 불러오는 중입니다.</p>`;
    renderHomeIndexChart();
    return;
  }
  if (!hdSelected || !hdIndices.some((ix) => ix.symbol === hdSelected)) hdSelected = hdIndices[0].symbol;
  el.innerHTML = hdIndices.map((ix) => {
    const chg = hdNum(ix.changePct);
    const on = ix.symbol === hdSelected;
    return `<button type="button" class="home-idx-card${on ? " is-active" : ""}" role="option" aria-selected="${on ? "true" : "false"}" tabindex="${on ? 0 : -1}" data-symbol="${escapeHtml(ix.symbol || "")}">
      <span class="home-idx-name">${escapeHtml(ix.name)}</span>
      <span class="home-idx-price">${ix.price == null ? "—" : hdFmtLevel(ix.price)}</span>
      <span class="home-idx-chg ${chg == null ? "muted" : cls(chg)}">${chg == null ? "—" : fmtPct(chg)}</span>
      ${hdSpark(ix.series, (chg ?? 0) >= 0)}
    </button>`;
  }).join("") + hdFxCards();
  if (!el.dataset.hdBound) {
    el.dataset.hdBound = "1";
    el.addEventListener("click", (e) => {
      const card = e.target.closest(".home-idx-card[data-symbol]");
      if (card) hdSelectIndex(card.dataset.symbol, { focus: false });
    });
    el.addEventListener("keydown", (e) => {
      if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
      const cards = [...el.querySelectorAll(".home-idx-card[data-symbol]")];
      const cur = cards.findIndex((c) => c.dataset.symbol === hdSelected);
      if (cur < 0) return;
      e.preventDefault();
      let next = cur;
      if (e.key === "Home") next = 0;
      else if (e.key === "End") next = cards.length - 1;
      else next = (cur + (e.key === "ArrowRight" ? 1 : -1) + cards.length) % cards.length;
      hdSelectIndex(cards[next].dataset.symbol, { focus: true });
    });
  }
  renderHomeIndexChart();
}

function hdSelectIndex(symbol, { focus = false } = {}) {
  if (!symbol) return;
  hdSelected = symbol;
  const el = byId("indexStrip");
  if (el) {
    el.querySelectorAll(".home-idx-card[data-symbol]").forEach((c) => {
      const on = c.dataset.symbol === symbol;
      c.classList.toggle("is-active", on);
      c.setAttribute("aria-selected", on ? "true" : "false");
      c.tabIndex = on ? 0 : -1;
      if (on && focus) c.focus();
      if (on) {
        // 가로 스크롤 안에서만 보이게(페이지 세로 스크롤은 건드리지 않는다).
        const box = el.getBoundingClientRect(), r = c.getBoundingClientRect();
        if (r.left < box.left || r.right > box.right) el.scrollLeft += (r.left - box.left) - 16;
      }
    });
  }
  renderHomeIndexChart();
  hdLiveSchedule();
}

// ----- 선택 지수 큰 차트: 오늘 하루(장중) + 이 차트만 라이브 -----
// 시리즈 원본은 워커 ?indices=1(야후 1d/5m 종가, 국내 지수 가격·등락률은 네이버). 한 번의 묶음
// 요청이 8개 지수를 다 주므로 선택을 바꿔도 새로 받지 않는다. 미국 모드는 부팅 때 헤더가 이미 같은
// 응답을 받아 두므로 첫 요청이 없다. 장중에만 HD_LIVE_POLL_MS 마다, 탭이 보일 때만 다시 받는다.
// 시간축 계산(시각 배정·장 상태·눈금)은 home-chart-core.js.
// SVG 는 preserveAspectRatio="none" 이라(숨은 상태에서 그려도 보이는 순간 제 폭으로 늘어난다)
// 글자·점은 SVG 밖 HTML 로 % 위치에 둔다.
const HD_LIVE_POLL_MS = 60000;
const hdLive = { rows: null, at: 0, stale: false, failed: false, loading: false, started: false, timer: 0, pending: false };

function hdCore() { return typeof window !== "undefined" ? window.MirHomeChartCore : null; }

function hdLiveRow(symbol) {
  return (hdLive.rows || []).find((r) => r && r.symbol === symbol && Array.isArray(r.series)) || null;
}

function hdCalendarEvents() {
  const c = window.MARKET_CALENDAR;
  return c && Array.isArray(c.events) ? c.events : [];
}

function hdKstClock(ms) {
  const core = hdCore();
  if (!core) return "";
  const z = core.zoneParts(ms, "Asia/Seoul");
  return core.fmtMin(z.min);
}

// 선택 지수가 지금 폴링할 만한가(정규장 중이거나 24시간 시장).
function hdLiveWanted() {
  const core = hdCore();
  const mkt = core && core.symbolMarket(hdSelected);
  if (!mkt) return false;
  const s = core.sessionState(mkt, Date.now(), hdCalendarEvents());
  return Boolean(s && s.state === "open");
}

function hdChartVisible() {
  const host = byId("homeIndexChart");
  return Boolean(host && host.offsetParent !== null && !document.hidden);
}

function hdFetchLive() {
  if (hdLive.loading || typeof LIVE_DATA_PROXY === "undefined" || !LIVE_DATA_PROXY) return;
  hdLive.loading = true;
  hdLive.pending = false;
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const kill = ctl ? setTimeout(() => ctl.abort(), 10000) : 0;
  fetch(`${LIVE_DATA_PROXY.replace(/\/$/, "")}/?indices=1`, { cache: "no-store", signal: ctl ? ctl.signal : undefined })
    .then((r) => (r.ok ? r.json() : null))
    .then((p) => {
      if (p && Array.isArray(p.indices) && p.indices.length) {
        hdLive.rows = p.indices;
        hdLive.at = Date.now();
        hdLive.stale = Boolean(p.stale);
        hdLive.failed = false;
      } else {
        hdLive.failed = true;
      }
    })
    .catch(() => { hdLive.failed = true; })
    .finally(() => {
      clearTimeout(kill);
      hdLive.loading = false;
      hdRefreshFromLive();
      hdLiveSchedule();
    });
}

function hdLiveSchedule(delay) {
  clearTimeout(hdLive.timer);
  hdLive.timer = 0;
  if (!hdLiveWanted()) return;
  const wait = delay != null ? delay : Math.max(5000, HD_LIVE_POLL_MS - (Date.now() - hdLive.at));
  hdLive.timer = setTimeout(() => {
    hdLive.timer = 0;
    // 브라우저 탭이 숨었으면 받지 않는다(visibilitychange 가 이어 받는다). 다른 사이트 탭(시장·종목…)을
    // 보는 중이면 네트워크 없이 5초마다 확인만 하다가 요약이 다시 보이면 받는다.
    if (document.hidden) { hdLive.pending = true; return; }
    if (!hdChartVisible()) { hdLive.pending = true; hdLiveSchedule(5000); return; }
    hdFetchLive();
  }, wait);
}

// 첫 화면을 막지 않게 늦게 시작. 장외라도 한 번은 받는다(국내 모드는 스냅샷 ETF 근사만 있어서).
function hdLiveStart() {
  if (hdLive.started) return;
  hdLive.started = true;
  if (typeof ensureFeatureData === "function") {
    ensureFeatureData("marketCalendar").then((ok) => { if (ok) { renderHomeIndexChart(); hdLiveSchedule(); } });
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    if ((hdLive.pending || Date.now() - hdLive.at >= HD_LIVE_POLL_MS) && hdLiveWanted() && hdChartVisible()) hdFetchLive();
  });
  const go = () => {
    if (hdLive.rows && Date.now() - hdLive.at < HD_LIVE_POLL_MS) { hdLiveSchedule(); return; }
    hdFetchLive();
  };
  if (typeof requestIdleCallback === "function") requestIdleCallback(go, { timeout: 4000 });
  else setTimeout(go, 1500);
}

// 오늘 탭으로 돌아왔을 때 등 — 밀린 갱신이 있으면 받는다.
function hdLiveResume() {
  if (!hdLive.started) return;
  if ((hdLive.pending || (!hdLive.timer && Date.now() - hdLive.at >= HD_LIVE_POLL_MS)) && hdLiveWanted() && hdChartVisible()) hdFetchLive();
}

function hdRefreshFromLive() {
  const el = byId("indexStrip");
  if (el && hdIndicesRaw.length) renderHomeIndexCarousel(el, hdIndicesRaw);
  else renderHomeIndexChart();
}

function hdStatusBadge(kind, session) {
  if (hdLive.failed && hdLive.rows) return { cls: "is-delayed", text: `지연 · ${hdKstClock(hdLive.at)} 기준` };
  if (hdLive.stale) return { cls: "is-delayed", text: "지연" };
  if (kind === "live") return { cls: "is-live", text: session && session.market === "crypto" ? "24시간 · 실시간" : "장중 · 실시간" };
  if (kind === "post") return { cls: "", text: "장 마감" };
  if (kind === "pre") return { cls: "", text: "개장 전 · 직전 거래일" };
  if (kind === "holiday") return { cls: "", text: `휴장${session && session.holidayName ? `(${session.holidayName})` : ""} · 직전 거래일` };
  if (kind === "weekend") return { cls: "", text: "휴장 · 직전 거래일" };
  if (kind === "prev") return { cls: "", text: "직전 거래일" };
  return { cls: "", text: "" };
}

function hdChartHead(ix, price, chg, badge, analysis) {
  return `
    <div class="home-chart-head">
      <div class="home-chart-title">
        <strong>${escapeHtml(ix.name)}</strong>
        <span class="home-chart-price">${price == null ? "—" : hdFmtLevel(price)}</span>
        <span class="home-chart-chg ${chg == null ? "muted" : cls(chg)}">${chg == null ? "—" : fmtPct(chg)}</span>
        ${badge && badge.text ? `<span class="home-chart-badge ${badge.cls}">${escapeHtml(badge.text)}</span>` : ""}
      </div>
      ${analysis ? `<button type="button" class="ghost compact-btn home-chart-go" data-ticker="${escapeHtml(analysis)}" title="${escapeHtml(ix.name)}을(를) 추종하는 ${escapeHtml(analysis)} 종목 분석">${escapeHtml(stockLabel(analysis))} 분석 ›</button>` : ""}
    </div>`;
}

function hdAxisFmt(v, step) {
  const digits = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  return v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// 하루 차트 본체. 반환: { plot, caption } 또는 null(그릴 수 없음).
function hdIntradayPlot(ix, row, price, chg) {
  const core = hdCore();
  const mkt = core && core.symbolMarket(ix.symbol);
  if (!core || !mkt || !row) return null;
  const now = Date.now();
  const session = core.sessionState(mkt, now, hdCalendarEvents());
  const placed = core.placeSeries(row.series, session);
  const pts = placed.points;
  if (pts.length < 2) return null;
  const mk = core.MARKETS[mkt];
  const t0 = mk.open, t1 = mkt === "crypto" ? mk.open + 1440 : (placed.kind === "post" ? session.close : mk.close);
  const prevClose = price != null && chg != null ? price / (1 + chg / 100) : null;
  const vals = pts.map((p) => p.v);
  const all = prevClose != null ? vals.concat([prevClose]) : vals;
  let lo = Math.min(...all), hi = Math.max(...all);
  const pad = (hi - lo || Math.abs(hi) * 0.01 || 1) * 0.1;
  lo -= pad; hi += pad;
  const W = 1000, H = 240;
  const xp = (t) => ((Math.min(Math.max(t, t0), t1) - t0) / (t1 - t0)) * 100; // %
  const yp = (v) => ((hi - v) / (hi - lo)) * 100; // % (위가 0)
  const X = (t) => (xp(t) * W / 100).toFixed(1);
  const Y = (v) => (yp(v) * H / 100).toFixed(1);
  // 선: 비어 있는 구간(마지막 봉 → 종가)은 점선으로 따로.
  let solid = "", bridge = "";
  pts.forEach((p, i) => {
    if (i && p.bridged) bridge = `M${X(pts[i - 1].t)},${Y(pts[i - 1].v)}L${X(p.t)},${Y(p.v)}`;
    else solid += `${i ? "L" : "M"}${X(p.t)},${Y(p.v)}`;
  });
  const last = pts[pts.length - 1];
  // 전일 종가 위는 상승색, 아래는 하락색(기준선이 없으면 한 색). 면은 기준선까지만 채운다.
  const baseY = prevClose != null ? Number(Y(prevClose)) : null;
  const floor = baseY != null ? baseY.toFixed(1) : H;
  const area = `M${X(pts[0].t)},${floor}` + pts.map((p) => `L${X(p.t)},${Y(p.v)}`).join("") + `L${X(last.t)},${floor}Z`;
  const up = prevClose != null ? last.v >= prevClose : (chg ?? 0) >= 0;
  const uid = `hdc${Math.random().toString(36).slice(2, 8)}`;
  const layer = (color, clip) => `<g${clip ? ` clip-path="url(#${clip})"` : ""}>
      <path d="${area}" fill="${color}" fill-opacity="0.09" stroke="none"></path>
      <path d="${solid}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"></path>
      ${bridge ? `<path d="${bridge}" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"></path>` : ""}
    </g>`;
  const lines = baseY != null
    ? `<defs><clipPath id="${uid}u"><rect x="0" y="-10" width="${W}" height="${(baseY + 10).toFixed(1)}"></rect></clipPath>
        <clipPath id="${uid}d"><rect x="0" y="${baseY.toFixed(1)}" width="${W}" height="${(H - baseY + 10).toFixed(1)}"></rect></clipPath></defs>
        ${layer("var(--pos)", `${uid}u`)}${layer("var(--neg)", `${uid}d`)}`
    : layer(up ? "var(--pos)" : "var(--neg)", "");
  // 격자: 가로(가격 눈금) · 세로(시각 눈금).
  const { step, ticks: vTicks } = core.valueTicks(lo, hi, 6);
  const tStep = mkt === "crypto" ? 180 : 60;
  const tTicks = core.timeTicks(t0, t1, tStep);
  const gridH = vTicks.map((v) => `<line x1="0" x2="${W}" y1="${Y(v)}" y2="${Y(v)}" vector-effect="non-scaling-stroke"></line>`).join("");
  const gridV = tTicks.filter((t) => t > t0 && t < t1).map((t) => `<line x1="${X(t)}" x2="${X(t)}" y1="0" y2="${H}" vector-effect="non-scaling-stroke"></line>`).join("");
  const base = baseY != null ? `<line x1="0" x2="${W}" y1="${baseY.toFixed(1)}" y2="${baseY.toFixed(1)}" class="home-chart-base" vector-effect="non-scaling-stroke"></line>` : "";
  // 표시 시각: 국내 KST, 미국 ET(툴팁에 KST 병기), 코인은 KST.
  const kstShift = mkt === "crypto" ? 540 : 0;
  const tLabel = (t) => core.fmtMin(t + kstShift);
  const lastY = yp(last.v);
  const yLabels = vTicks.filter((v) => Math.abs(yp(v) - lastY) > 7)
    .map((v) => `<span style="top:${yp(v).toFixed(2)}%">${hdAxisFmt(v, step)}</span>`).join("");
  const xLabels = tTicks.map((t, i) => `<span class="${i % 2 ? "is-odd" : ""}${t === t0 ? " is-first" : ""}${t === t1 ? " is-last" : ""}" style="left:${xp(t).toFixed(2)}%">${tLabel(t)}</span>`).join("");
  const lastCls = prevClose == null ? "" : last.v > prevClose ? "pos" : last.v < prevClose ? "neg" : "";
  const zoneNote = mkt === "us"
    ? (() => {
      const diff = (core.zoneParts(now, "Asia/Seoul").offsetMin - core.zoneParts(now, "America/New_York").offsetMin) / 60;
      return `시각은 미 동부시간(ET) · 한국시간 = ET + ${diff}시간`;
    })()
    : mkt === "crypto" ? "시각은 한국시간 · 24시간 거래" : "시각은 한국시간";
  const plot = `<div class="home-chart-plot" data-hd-uid="${uid}">
      <div class="home-chart-area">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(ix.name)} 하루 추이, ${tLabel(pts[0].t)}부터 ${tLabel(last.t)}까지">
          <g class="home-chart-grid">${gridH}${gridV}</g>
          ${base}
          ${lines}
        </svg>
        <i class="home-chart-lastdot ${lastCls}" style="left:${xp(last.t).toFixed(2)}%;top:${lastY.toFixed(2)}%" aria-hidden="true"></i>
        <i class="home-chart-cross" hidden aria-hidden="true"></i>
        <i class="home-chart-dot" hidden aria-hidden="true"></i>
        <div class="home-chart-tip" hidden></div>
      </div>
      <div class="home-chart-yaxis" aria-hidden="true">${yLabels}<b class="home-chart-last ${lastCls}" style="top:${lastY.toFixed(2)}%">${hdFmtLevel(last.v)}</b></div>
      <div class="home-chart-xaxis" aria-hidden="true">${xLabels}</div>
    </div>`;
  const bits = placed.kind === "live" ? [`${tLabel(last.t)} 기준`, "5분 간격"] : ["5분 간격"];
  if (prevClose != null) bits.push("가로 점선은 전일 종가");
  bits.push(zoneNote);
  const src = mkt === "kr" ? "출처 Yahoo Finance · 가격·등락률은 네이버" : "출처 Yahoo Finance";
  const upd = hdLive.at ? ` · 갱신 ${hdKstClock(hdLive.at)} KST` : "";
  return {
    plot,
    caption: `${bits.join(" · ")} · ${src}${upd}`,
    badge: hdStatusBadge(placed.kind, session),
    interact: { pts, t0, t1, prevClose, tLabel, mkt, xp, yp, kind: placed.kind },
  };
}

// 크로스헤어·툴팁(시각·값·전일 대비).
function hdBindCrosshair(host, info) {
  const area = host.querySelector(".home-chart-area");
  if (!area || !info) return;
  const cross = area.querySelector(".home-chart-cross");
  const dot = area.querySelector(".home-chart-dot");
  const tip = area.querySelector(".home-chart-tip");
  const core = hdCore();
  const hide = () => { cross.hidden = true; dot.hidden = true; tip.hidden = true; };
  const show = (clientX) => {
    const r = area.getBoundingClientRect();
    if (!r.width) return;
    const frac = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const t = info.t0 + frac * (info.t1 - info.t0);
    let best = info.pts[0];
    info.pts.forEach((p) => { if (Math.abs(p.t - t) < Math.abs(best.t - t)) best = p; });
    const x = info.xp(best.t), y = info.yp(best.v);
    cross.hidden = false; dot.hidden = false; tip.hidden = false;
    cross.style.left = `${x}%`;
    dot.style.left = `${x}%`; dot.style.top = `${y}%`;
    const d = info.prevClose ? (best.v / info.prevClose - 1) * 100 : null;
    let when = info.tLabel(best.t);
    if (info.mkt === "us" && core) {
      const diff = core.zoneParts(Date.now(), "Asia/Seoul").offsetMin - core.zoneParts(Date.now(), "America/New_York").offsetMin;
      when = `${when} ET <small>(${core.fmtMin(best.t + diff)} KST)</small>`;
    }
    const isClose = best === info.pts[info.pts.length - 1] && info.kind !== "live";
    tip.innerHTML = `<span class="home-chart-tip-t">${when}${isClose ? " · 종가" : ""}</span>
      <b>${hdFmtLevel(best.v)}</b>${d == null ? "" : ` <span class="${cls(d)}">${fmtPct(d)}</span>`}`;
    tip.classList.toggle("is-left", x > 60);
    tip.style.left = `${x}%`;
  };
  area.addEventListener("pointermove", (e) => show(e.clientX));
  area.addEventListener("pointerdown", (e) => show(e.clientX));
  area.addEventListener("pointerleave", hide);
}

function renderHomeIndexChart() {
  const host = byId("homeIndexChart");
  if (!host) return;
  const ix = hdIndices.find((r) => r.symbol === hdSelected);
  if (!ix) { host.innerHTML = `<p class="home-chart-empty muted">지수를 불러오면 여기에 차트가 나옵니다.</p>`; return; }
  hdLiveStart();
  const chg = hdNum(ix.changePct);
  const price = hdNum(ix.price);
  const analysis = typeof indexAnalysisTicker === "function" ? indexAnalysisTicker(ix.symbol) : null;
  // 1) 워커 당일 5분 시리즈가 있으면 하루 차트.
  const row = hdLiveRow(ix.symbol) || (!ix.seriesNote && Array.isArray(ix.series) && ix.series.length >= 2 ? ix : null);
  const intraday = hdIntradayPlot(ix, row, price, chg);
  if (intraday) {
    host.innerHTML = `${hdChartHead(ix, price, chg, intraday.badge, analysis)}
      ${intraday.plot}
      <p class="home-chart-cap">${escapeHtml(intraday.caption)}</p>`;
    hdBindCrosshair(host, intraday.interact);
  } else {
    // 2) 라이브를 못 받은 국내 스냅샷: 추종 ETF 종가 근사(가격 눈금 없음).
    const vals = (ix.series || []).map(Number).filter(Number.isFinite);
    const approx = Boolean(ix.seriesNote);
    let plot = `<p class="home-chart-empty muted">${hdLive.loading || !hdLive.at && !hdLive.failed ? "하루 차트를 불러오는 중입니다." : "추이 데이터가 없습니다."}</p>`;
    if (approx && vals.length >= 2) {
      let lo = Math.min(...vals), hi = Math.max(...vals);
      const pad = (hi - lo || Math.abs(hi) * 0.01 || 1) * 0.08;
      lo -= pad; hi += pad;
      const W = 1000, H = 240;
      const line = vals.map((v, i) => `${i ? "L" : "M"}${((i / (vals.length - 1)) * W).toFixed(1)},${(H - ((v - lo) / (hi - lo)) * H).toFixed(1)}`).join("");
      const color = vals[vals.length - 1] >= vals[0] ? "var(--pos)" : "var(--neg)";
      plot = `<div class="home-chart-plot is-approx"><div class="home-chart-area">
          <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(ix.name)} 최근 추이(ETF 근사)">
            <path d="${line}L${W},${H}L0,${H}Z" fill="${color}" fill-opacity="0.08" stroke="none"></path>
            <path d="${line}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"></path>
          </svg></div></div>`;
    }
    const badge = hdLive.failed ? { cls: "is-delayed", text: "실시간 연결 실패" } : null;
    const caption = approx && vals.length >= 2
      ? `하루 차트를 받지 못해 지수를 추종하는 ETF 종가 ${vals.length}거래일로 그린 근사 추이를 보여 줍니다. 가격·등락률은 실제 지수 값입니다.`
      : "";
    host.innerHTML = `${hdChartHead(ix, price, chg, badge, analysis)}${plot}${caption ? `<p class="home-chart-cap">${escapeHtml(caption)}</p>` : ""}`;
  }
  host.querySelector(".home-chart-go")?.addEventListener("click", (e) => selectTicker(e.currentTarget.dataset.ticker, { openSearch: true }));
}
// ----- 시장 현황 소패널 -----
function hdBreadth() {
  const rows = (typeof data !== "undefined" && data && Array.isArray(data.stocks) ? data.stocks : [])
    .filter((s) => s && !isStockEtf(s) && Number.isFinite(Number(s.changePct)));
  if (rows.length < 20) return null;
  let up = 0, flat = 0, down = 0, nearHigh = 0;
  rows.forEach((s) => {
    const c = Number(s.changePct);
    if (c > 0) up += 1; else if (c < 0) down += 1; else flat += 1;
    const d = Number(s.newHighDistancePct);
    if (Number.isFinite(d) && d <= 0.5) nearHigh += 1;
  });
  return { total: rows.length, up, flat, down, nearHigh };
}

function hdEok(v) {
  const n = hdNum(v);
  if (n == null) return "—";
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(Math.round(n)).toLocaleString("ko-KR")}`;
}

function hdKrFlowHtml() {
  if (!isKrMarket() || (typeof featureOff === "function" && featureOff("krFunds"))) return "";
  const p = window.KR_MARKET_FUNDS;
  if (!p) {
    if (typeof ensureFeatureData === "function" && !hdKrFlowHtml.requested) {
      hdKrFlowHtml.requested = true;
      ensureFeatureData("krFunds").then((ok) => { if (ok) renderHomeMarketStatus(); });
    }
    return `<div class="home-status-sec"><h3>투자자별 순매수</h3><p class="muted home-status-note">불러오는 중…</p></div>`;
  }
  const inv = p.investors || {};
  const last = (k) => { const arr = Array.isArray(inv[k]) ? inv[k] : []; return arr[arr.length - 1] || null; };
  const rows = [["코스피", last("KOSPI")], ["코스닥", last("KOSDAQ")]].filter(([, r]) => r);
  if (!rows.length) return "";
  const date = rows[0][1].d || inv.asOf || "";
  const cell = (v) => `<td class="${cls(Number(v) || 0)}">${hdEok(v)}</td>`;
  return `<div class="home-status-sec">
      <h3>투자자별 순매수 <small>${escapeHtml(String(date).slice(5).replace("-", "."))} · 억원</small></h3>
      <table class="home-flow-table">
        <thead><tr><th></th><th>개인</th><th>외국인</th><th>기관</th></tr></thead>
        <tbody>${rows.map(([name, r]) => `<tr><th scope="row">${name}</th>${cell(r.ind)}${cell(r.frn)}${cell(r.org)}</tr>`).join("")}</tbody>
      </table>
      <button type="button" class="ia-link home-status-link" data-open="krflow">수급·자금 전체 보기</button>
    </div>`;
}

// 1단 화면(1100px 이하)에서는 시장 현황을 차트 옆이 아니라 오늘의 뉴스 아래(#homeStatusSlot)에 둔다 —
// 폰 첫 화면이 지수 카드 → 하루 차트 → 카드뉴스로 이어지게. 넓은 화면에서는 차트 옆 원래 자리.
let hdStatusMq = null;
function hdPlaceStatus() {
  const card = byId("homeMarketStatus"), slot = byId("homeStatusSlot");
  const row = document.querySelector("#homeDash .home-dash-row");
  if (!card || !slot || !row || typeof matchMedia !== "function") return;
  if (!hdStatusMq) {
    hdStatusMq = matchMedia("(max-width: 1100px)");
    const onChange = () => hdPlaceStatus();
    if (hdStatusMq.addEventListener) hdStatusMq.addEventListener("change", onChange);
    else if (hdStatusMq.addListener) hdStatusMq.addListener(onChange);
  }
  const narrow = hdStatusMq.matches;
  if (narrow && card.parentNode !== slot) slot.appendChild(card);
  if (!narrow && card.parentNode !== row) row.appendChild(card);
  slot.hidden = !narrow;
}

function renderHomeMarketStatus() {
  const host = byId("homeMarketStatus");
  if (!host) return;
  hdPlaceStatus();
  const b = hdBreadth();
  const score = typeof fngScore === "function" ? fngScore() : null;
  const parts = [];
  if (b) {
    const pct = (n) => `${((n / b.total) * 100).toFixed(1)}%`;
    parts.push(`<div class="home-status-sec">
        <h3>상승 · 보합 · 하락 <small>개별 종목 ${b.total.toLocaleString("ko-KR")}개</small></h3>
        <div class="home-breadth-nums">
          <span class="pos"><b>${b.up.toLocaleString("ko-KR")}</b>상승</span>
          <span class="muted"><b>${b.flat.toLocaleString("ko-KR")}</b>보합</span>
          <span class="neg"><b>${b.down.toLocaleString("ko-KR")}</b>하락</span>
        </div>
        <div class="home-breadth-bar" role="img" aria-label="상승 ${b.up} 보합 ${b.flat} 하락 ${b.down}">
          <i class="up" style="width:${pct(b.up)}"></i><i class="flat" style="width:${pct(b.flat)}"></i><i class="down" style="width:${pct(b.down)}"></i>
        </div>
        <p class="home-status-note">52주 고점 0.5% 이내 <b>${b.nearHigh.toLocaleString("ko-KR")}</b>종목</p>
      </div>`);
  }
  if (Number.isFinite(score)) {
    parts.push(`<div class="home-status-sec home-status-inline">
        <h3>미국 공포·탐욕 <small>CNN</small></h3>
        <p><b>${Math.round(score)}</b> <span class="muted">${escapeHtml(fngLabel(score))}</span></p>
      </div>`);
  }
  const flow = hdKrFlowHtml();
  if (flow) parts.push(flow);
  const asOf = (typeof data !== "undefined" && data && data.updatedAtKst) || "";
  host.innerHTML = parts.length
    ? `<h2 class="home-status-title">시장 현황</h2>${parts.join("")}${asOf ? `<p class="home-status-foot">종목 수 기준 ${escapeHtml(asOf)}</p>` : ""}`
    : `<h2 class="home-status-title">시장 현황</h2><p class="muted home-status-note">종목 데이터를 불러오는 중입니다.</p>`;
}

// ----- AI 브리핑 요약(3~4줄 + 펼치기) -----
function hdBriefKeys() {
  return isKrMarket() ? ["korea_close", "korea_premarket"] : ["us_close", "us_premarket"];
}

function hdBriefHtml(key) {
  const inline = (typeof data !== "undefined" && data && data.ai_briefing && data.ai_briefing[key]) || (typeof briefingFileCache !== "undefined" && briefingFileCache[key]);
  if (inline) return inline;
  return HD_BRIEF_CACHE[key];
}

function hdBriefLines(html) {
  return String(html || "").split(/<br\s*\/?>/i)
    .map((l) => l.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim())
    .filter(Boolean);
}

// 제목 줄의 "YYYY년 MM월 DD일 HH시 MM분" → 비교용 키와 표시값.
function hdBriefStamp(lines) {
  const m = (lines[0] || "").match(/(\d{4})년\s*(\d{2})월\s*(\d{2})일\s*(\d{2})시\s*(\d{2})분/);
  if (!m) return { key: "", label: "" };
  return { key: `${m[1]}${m[2]}${m[3]}${m[4]}${m[5]}`, label: `${m[2]}.${m[3]} ${m[4]}:${m[5]}` };
}

// 심층 브리핑 본문의 "├─ 라벨: 문장…" 줄에서 앞 3~4개를 한 문장씩.
function hdBriefSummary(lines) {
  const start = lines.findIndex((l) => /심층 브리핑|\[.*브리핑\]/.test(l) && !/데이터 리포트/.test(l));
  const body = start >= 0 ? lines.slice(start + 1) : lines;
  const seen = new Set();
  const out = [];
  body.forEach((l) => {
    if (out.length >= 4) return;
    if (!/^[├└]/.test(l)) return;
    const t = l.replace(/^[├└][─\s-]*/, "").trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    const m = t.match(/^([^:：]{1,24})[:：]\s*(.+)$/);
    let label = m ? m[1].trim() : "";
    const text = (m ? m[2] : t);
    const first = (text.match(/^.+?(?:다|요)\.(?=\s|$)/) || [text])[0];
    // "코스피: 코스피는 …" 처럼 문장이 라벨로 시작하면 라벨을 따로 붙이지 않는다.
    if (label && first.slice(0, label.length + 2).includes(label.split(/[\s/]/)[0])) label = "";
    out.push({ label, text: first.length > 140 ? `${first.slice(0, 138)}…` : first });
  });
  return out;
}

function hdBriefTitle(lines) {
  const t = lines.find((l) => /심층 브리핑/.test(l)) || lines[0] || "";
  return t.replace(/^[^\[가-힣A-Za-z]+/, "").replace(/[\[\]]/g, "").trim();
}

function renderHomeBriefing() {
  const host = byId("homeBriefing");
  if (!host) return;
  const keys = hdBriefKeys();
  keys.forEach((k) => {
    if (hdBriefHtml(k) !== undefined) return; // 이미 있음(문자열) 또는 요청 중(null)
    HD_BRIEF_CACHE[k] = null;
    fetch(`data/briefings/${k}.json`, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => { HD_BRIEF_CACHE[k] = (b && b.html) || ""; })
      .catch(() => { HD_BRIEF_CACHE[k] = ""; })
      .finally(() => renderHomeBriefing());
  });
  // 둘 중 더 최근에 작성된 브리핑.
  let best = null;
  keys.forEach((k) => {
    const html = hdBriefHtml(k);
    if (!html) return;
    const lines = hdBriefLines(html);
    const stamp = hdBriefStamp(lines);
    const summary = hdBriefSummary(lines);
    if (!summary.length) return;
    if (!best || stamp.key > best.stamp.key) best = { key: k, html, lines, stamp, summary };
  });
  if (!best) { host.hidden = true; host.innerHTML = ""; return; }
  host.hidden = false;
  const kind = /premarket/.test(best.key) ? "개장 전" : "장마감";
  const mkt = /korea/.test(best.key) ? "국내" : "미국";
  host.innerHTML = `
    <div class="home-brief-head">
      <h2>AI 브리핑 <small>${mkt} ${kind}${best.stamp.label ? ` · ${escapeHtml(best.stamp.label)} 작성` : ""}</small></h2>
      <button type="button" class="ia-link" data-open="ai-briefing">브리핑 탭 ›</button>
    </div>
    <ul class="home-brief-list">
      ${best.summary.map((s) => `<li>${s.label ? `<b>${escapeHtml(s.label)}</b> ` : ""}${escapeHtml(s.text)}</li>`).join("")}
    </ul>
    <details class="home-brief-more">
      <summary>전체 펼치기</summary>
      <div class="briefing-content home-brief-full" data-key="${escapeHtml(best.key)}"></div>
    </details>
    <p class="home-brief-note">AI 가 수집 데이터로 쓴 요약이라 틀릴 수 있습니다. 투자 권유가 아닙니다.</p>`;
  const more = host.querySelector(".home-brief-more");
  more?.addEventListener("toggle", () => {
    const full = more.querySelector(".home-brief-full");
    if (more.open && full && !full.innerHTML) full.innerHTML = sanitizeRichHtml(decorateBriefingHtml(best.html));
  });
}

function renderHomeDash() {
  renderHomeMarketStatus();
  renderHomeBriefing();
  if (!byId("homeIndexChart")?.innerHTML) renderHomeIndexChart();
  hdLiveResume();
}
