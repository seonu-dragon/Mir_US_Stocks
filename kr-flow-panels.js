// kr-flow-panels.js — 국내 투자자 동향 · 증시자금 · 순매수 상위 + 종목 수급 '일별 보기'
// ====================================================================================
// 클래식 스크립트(모듈 아님). 계산은 kr-flow-core.js(window.MirKrFlowCore)에 있다.
// 화면: 시장 탭 › '수급·자금' 잎(#tab-krflow, 국내 전용 — US 는 hiddenTabs·features.krFunds 로 숨김)
//      종목 분석 › 수급 카드 › '일별 보기'(kr-panels.js krFlowCard 가 krFlowDailyToggle 을 부른다)
// 데이터: window.KR_MARKET_FUNDS(lazy, build_kr_market_funds.py),
//        data/korea/investor_flow_daily/sNN.json(시총 상위 480종목 20거래일, build_kr_investor_flow.py)
// 사실 표시용이다 — 수급·신용잔고로 매매 판단을 만들지 않는다.

const KRFLOW_VIEW = { market: "KOSPI", period: 21, investor: "frn", topSide: "Buy", topWin: "d1" };
const KRFLOW_PERIODS = [[5, "1주"], [21, "1개월"], [63, "3개월"]];
const KRFLOW_INVESTORS = [["ind", "개인"], ["frn", "외국인"], ["org", "기관"]];
const KRFLOW_FUND_CARDS = [
  // [키, 라벨, 단위, 설명(툴팁)]
  ["dep", "투자자 예탁금", "억", "증권 계좌에 맡겨 둔 주식 매수 대기 자금(장내파생 예수금 제외)"],
  ["credit", "신용융자 잔고", "억", "증권사에서 빌려 산 주식 금액(코스피+코스닥)"],
  ["unpaid", "위탁매매 미수금", "억", "외상으로 산 뒤 결제일까지 갚지 않은 금액"],
  ["forced", "반대매매", "억", "미수금을 못 갚아 증권사가 강제로 판 금액"],
  ["forcedPct", "반대매매 비중", "%", "미수금 대비 반대매매 금액 비율"],
];
const _krFlowShardCache = {};

function krFlowOff() {
  return typeof featureOff === "function" ? featureOff("krFunds") : !isKrMarket();
}

function krFlowDateShort(d) {
  const s = String(d || "");
  return s.length >= 10 ? `${s.slice(5, 7)}.${s.slice(8, 10)}` : s;
}

// ------------------------------------------------------------------ 시장 탭 '수급·자금'
function renderKrFlowMarket() {
  const host = byId("krFlowMarket");
  if (!host) return;
  if (krFlowOff() || !isKrMarket()) {
    host.innerHTML = "";
    return;
  }
  const payload = window.KR_MARKET_FUNDS;
  if (!payload) {
    host.innerHTML = '<p class="muted">데이터를 불러오는 중…</p>';
    ensureFeatureData("krFunds").then((ok) => {
      if (ok) renderKrFlowMarket();
      else host.innerHTML = '<p class="muted">증시자금·투자자 동향 데이터를 불러오지 못했습니다.</p>';
    });
    return;
  }
  host.innerHTML = `
    ${krFlowInvestorCard(payload)}
    ${krFlowFundsCard(payload)}
    ${krFlowTopCard(payload)}
    <p class="ia-footnote kf-foot">수급·자금 흐름은 지난 거래를 보여 줄 뿐 이후 주가 방향을 알려 주지 않습니다. 투자 권유가 아닙니다.</p>`;
  if (!host.dataset.kfBound) {
    host.dataset.kfBound = "1";
    host.addEventListener("click", krFlowOnClick);
  }
}

function krFlowOnClick(ev) {
  const btn = ev.target.closest("[data-kf]");
  if (btn) {
    const [key, val] = btn.dataset.kf.split(":");
    if (key === "market") KRFLOW_VIEW.market = val;
    else if (key === "period") KRFLOW_VIEW.period = Number(val) || 21;
    else if (key === "investor") KRFLOW_VIEW.investor = val;
    else if (key === "side") KRFLOW_VIEW.topSide = val;
    else if (key === "win") KRFLOW_VIEW.topWin = val;
    renderKrFlowMarket();
    return;
  }
  const row = ev.target.closest("[data-kf-ticker]");
  if (row && typeof navigateToStockAnalysis === "function") navigateToStockAnalysis(row.dataset.kfTicker);
}

function krFlowSeg(key, options, current) {
  return `<div class="segmented kf-seg" role="group">${options.map(([v, label]) => `
    <button type="button" data-kf="${key}:${v}" class="${String(v) === String(current) ? "is-active" : ""}" aria-pressed="${String(v) === String(current)}">${label}</button>`).join("")}</div>`;
}

function krFlowInvestorCard(payload) {
  const C = window.MirKrFlowCore;
  const inv = payload.investors || {};
  const all = inv[KRFLOW_VIEW.market] || [];
  if (!all.length) return "";
  const rows = C.lastN(all, KRFLOW_VIEW.period);
  const key = KRFLOW_VIEW.investor;
  const label = (KRFLOW_INVESTORS.find(([k]) => k === key) || [])[1] || "";
  const tiles = KRFLOW_INVESTORS.map(([k, name]) => {
    const s = C.sumKey(rows, k);
    return `<button type="button" class="kf-tile ${k === key ? "is-active" : ""}" data-kf="investor:${k}" aria-pressed="${k === key}">
      <span class="kf-tile-label">${name}</span>
      <b class="${C.tone(s)}">${C.fmtSigned(s)}<small>억</small></b>
    </button>`;
  }).join("");
  const W = 600;
  const H = 150;
  const vals = rows.map((r) => r[key]);
  const g = C.barGeometry(vals, W, H, 4);
  const cum = C.cumulative(vals);
  const bars = g.bars.map((b, i) => `<rect x="${b.x.toFixed(1)}" y="${b.y.toFixed(1)}" width="${b.w.toFixed(1)}" height="${b.h.toFixed(1)}" class="${b.v > 0 ? "kf-bar-pos" : "kf-bar-neg"}"><title>${escapeHtml(rows[i].d)} ${label} ${C.fmtSigned(b.v)}억</title></rect>`).join("");
  const line = C.linePath(cum, W, H, 4);
  const last = rows[rows.length - 1] || {};
  const first = rows[0] || {};
  const lastDay = KRFLOW_INVESTORS.map(([k, name]) => `<span>${name} <b class="${C.tone(last[k])}">${C.fmtSigned(last[k])}</b></span>`).join("");
  return `
    <section class="kf-card" aria-label="투자자 동향">
      <header class="kf-head">
        <h3>투자자 동향</h3>
        ${krFlowSeg("market", [["KOSPI", "코스피"], ["KOSDAQ", "코스닥"]], KRFLOW_VIEW.market)}
        ${krFlowSeg("period", KRFLOW_PERIODS, KRFLOW_VIEW.period)}
      </header>
      <p class="kf-sub">${escapeHtml(krFlowDateShort(first.d))} ~ ${escapeHtml(krFlowDateShort(last.d))} 순매수 합계 · ${rows.length}거래일 · 억 원</p>
      <div class="kf-tiles">${tiles}</div>
      <figure class="kf-chart">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${label} 일별 순매수와 누적">
          <line x1="0" x2="${W}" y1="${g.zeroY.toFixed(1)}" y2="${g.zeroY.toFixed(1)}" class="kf-zero"/>
          ${bars}
          ${line ? `<path d="${line}" class="kf-cum" vector-effect="non-scaling-stroke"/>` : ""}
        </svg>
        <figcaption class="kf-legend">
          <span><i class="kf-key-bar"></i>${label} 일별 순매수</span>
          <span><i class="kf-key-line"></i>누적 ${C.fmtSigned(cum[cum.length - 1])}억</span>
          <span class="kf-axis">${escapeHtml(krFlowDateShort(first.d))} → ${escapeHtml(krFlowDateShort(last.d))}</span>
        </figcaption>
      </figure>
      <p class="kf-lastday">${escapeHtml(krFlowDateShort(last.d))} ${lastDay}</p>
      <p class="kf-source">출처: ${escapeHtml((payload.source || {}).investors || "네이버 금융")} · ${escapeHtml(inv.asOf || "")} 기준</p>
    </section>`;
}

function krFlowSpark(rows, key, w = 120, h = 32) {
  const C = window.MirKrFlowCore;
  const vals = rows.map((r) => r[key]);
  const d = C.linePath(vals, w, h, 2);
  return d ? `<svg class="kf-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" vector-effect="non-scaling-stroke"/></svg>` : "";
}

function krFlowFundsCard(payload) {
  const C = window.MirKrFlowCore;
  const funds = payload.funds || {};
  const rows = funds.rows || [];
  if (!rows.length) return "";
  const recent = C.lastN(rows, 60);
  const cards = KRFLOW_FUND_CARDS.map(([key, name, unit, tip]) => {
    const dl = C.delta(rows, key);
    if (!dl) return "";
    const pct = unit === "%";
    const value = pct ? `${dl.last.toFixed(1)}<small>%</small>` : `${C.fmtPlain(dl.last)}<small>억</small>`;
    const diff = dl.diff == null ? "" : pct
      ? `${dl.diff > 0 ? "+" : dl.diff < 0 ? "-" : ""}${Math.abs(dl.diff).toFixed(1)}%p`
      : (Math.abs(dl.diff) < 100 && Math.round(dl.diff) !== dl.diff
        ? `${dl.diff > 0 ? "+" : dl.diff < 0 ? "-" : ""}${Math.abs(dl.diff).toFixed(1)}`
        : C.fmtSigned(dl.diff));
    return `
      <div class="kf-fund" title="${escapeHtml(tip)}">
        <span class="kf-fund-label">${name}</span>
        <b class="kf-fund-value">${value}</b>
        <span class="kf-fund-diff ${C.tone(dl.diff)}">${diff ? `전일대비 ${diff}` : ""}</span>
        ${krFlowSpark(recent, key)}
      </div>`;
  }).join("");
  const chk = payload.check;
  const chkLine = chk && chk.ok
    ? `<p class="kf-source">한국은행 ECOS 월말치와 대조: ${escapeHtml(chk.month)} 예탁금 ${chk.depFreesis}조${chk.creditFreesis != null ? ` · 신용융자 ${chk.creditFreesis}조` : ""} 일치</p>`
    : "";
  return `
    <section class="kf-card" aria-label="증시자금">
      <header class="kf-head"><h3>증시자금</h3><span class="kf-sub">최근 60거래일 추이 · ${escapeHtml(funds.asOf || "")} 기준</span></header>
      <div class="kf-funds">${cards}</div>
      <p class="kf-source">출처: ${escapeHtml((payload.source || {}).funds || "금융투자협회")} · 영업일 1~2일 뒤 공표</p>
      ${chkLine}
    </section>`;
}

function krFlowTopTable(list, title) {
  const C = window.MirKrFlowCore;
  if (!Array.isArray(list) || !list.length) return `<div class="kf-top-col"><h4>${title}</h4><p class="muted">해당 종목 없음</p></div>`;
  const body = list.map((x, i) => `
    <tr data-kf-ticker="${escapeHtml(x.t)}" tabindex="0">
      <td class="kf-rank">${i + 1}</td>
      <th scope="row">${escapeHtml(x.n || x.t)}</th>
      <td class="${C.tone(x.a)}">${C.fmtSigned(x.a)}</td>
      <td class="${C.tone(x.c)}">${x.c == null ? "—" : fmtSignedPct(x.c)}</td>
    </tr>`).join("");
  return `
    <div class="kf-top-col">
      <h4>${title}</h4>
      <table class="kf-table">
        <thead><tr><th></th><th>종목</th><th>금액(억)</th><th>등락률</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

function krFlowTopCard(payload) {
  const top = payload.top;
  if (!top) return "";
  const sect = top[KRFLOW_VIEW.topWin] || {};
  const side = KRFLOW_VIEW.topSide;
  const word = side === "Buy" ? "순매수" : "순매도";
  const range = KRFLOW_VIEW.topWin === "d5" && top.from5 ? `${krFlowDateShort(top.from5)} ~ ${krFlowDateShort(top.asOf)}` : krFlowDateShort(top.asOf);
  return `
    <section class="kf-card" aria-label="외국인·기관 ${word} 상위">
      <header class="kf-head">
        <h3>외국인·기관 ${word} 상위</h3>
        ${krFlowSeg("side", [["Buy", "순매수"], ["Sell", "순매도"]], side)}
        ${krFlowSeg("win", [["d1", "1일"], ["d5", "5일"]], KRFLOW_VIEW.topWin)}
      </header>
      <p class="kf-sub">${escapeHtml(range)} · 금액은 종목별 순매수 수량 × 그날 종가로 계산한 추정치(억 원), 등락률은 마지막 날 기준 · ETF 제외</p>
      <div class="kf-top">
        ${krFlowTopTable(sect[`frn${side}`], `외국인 ${word}`)}
        ${krFlowTopTable(sect[`org${side}`], `기관 ${word}`)}
      </div>
    </section>`;
}

// ------------------------------------------------------------------ 종목 '일별 보기'
// kr-panels.js krFlowCard 가 부른다. 샤드가 아직 없으면(첫 수집 전) 아무것도 만들지 않는다.
function krFlowDailyToggle(item) {
  const flow = window.KR_INVESTOR_FLOW;
  if (!flow || !(flow.dailyShards > 0) || !item?.ticker || krFlowOff()) return "";
  if (!flow.stocks?.[item.ticker]?.dy) {
    return `<p class="krflow-note">일별 표는 시가총액 상위 ${Number(flow.dailyCount) || 480}종목만 제공합니다 — 위 5일·20일 누적을 참고하세요.</p>`;
  }
  return `
    <details class="krflow-daily" data-kf-daily="${escapeHtml(String(item.ticker))}">
      <summary>일별 보기</summary>
      <div class="krflow-daily-body"><p class="muted">불러오는 중…</p></div>
    </details>`;
}

function krFlowFetchShard(code) {
  const flow = window.KR_INVESTOR_FLOW || {};
  const n = flow.dailyShards || 16;
  const idx = window.MirKrFlowCore.shardOf(code, n);
  const url = `data/korea/investor_flow_daily/s${String(idx).padStart(2, "0")}.json?v=${encodeURIComponent(flow.dailyAsOf || flow.updatedAtKst || "")}`;
  if (!_krFlowShardCache[url]) {
    _krFlowShardCache[url] = fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((j) => { if (!j) delete _krFlowShardCache[url]; return j; });
  }
  return _krFlowShardCache[url];
}

function krFlowDailyTable(rows) {
  const C = window.MirKrFlowCore;
  const qty = (v) => C.fmtSigned(v);
  const body = rows.map((r) => `
    <tr>
      <th scope="row">${escapeHtml(krFlowDateShort(r.d))}</th>
      <td>${r.close == null ? "—" : r.close.toLocaleString()}</td>
      <td class="${C.tone(r.pct)}">${r.pct == null ? "—" : fmtSignedPct(r.pct, 2)}</td>
      <td class="${C.tone(r.ind)}">${qty(r.ind)}</td>
      <td class="${C.tone(r.frn)}">${qty(r.frn)}</td>
      <td class="${C.tone(r.org)}">${qty(r.org)}</td>
      <td>${r.hold == null ? "—" : `${r.hold.toFixed(2)}%`}</td>
    </tr>`).join("");
  return `
    <div class="krflow-daily-scroll">
      <table class="krflow-table krflow-daily-table">
        <thead><tr><th>날짜</th><th>종가</th><th>등락</th><th>개인</th><th>외국인</th><th>기관</th><th>외국인 보유율</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    <p class="krflow-note">순매수 수량(주) · 최근 ${rows.length}거래일 · 출처 네이버 금융</p>`;
}

function krFlowFillDaily(details) {
  const code = details.dataset.kfDaily;
  const body = details.querySelector(".krflow-daily-body");
  if (!code || !body || details.dataset.kfLoaded === code) return;
  krFlowFetchShard(code).then((shard) => {
    const rows = window.MirKrFlowCore.dailyRows(shard, code);
    if (!rows.length) {
      body.innerHTML = '<p class="muted">일별 수급 자료가 없습니다.</p>';
      return;
    }
    details.dataset.kfLoaded = code;
    body.innerHTML = krFlowDailyTable(rows);
  });
}

// <details> 의 toggle 은 버블링하지 않는다 — 캡처 단계에서 한 번만 받는다.
if (typeof document !== "undefined") {
  document.addEventListener("toggle", (ev) => {
    const el = ev.target;
    if (el && el.matches && el.matches("details.krflow-daily") && el.open) krFlowFillDaily(el);
  }, true);
}
