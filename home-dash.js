// home-dash.js — 오늘 탭(요약)의 첫 화면: 지수 카드 캐러셀 → 선택 지수 큰 차트 + 시장 현황 → AI 브리핑 요약.
// ====================================================================================
// 클래식 스크립트(모듈 아님). 전역 이름은 hd 접두사.
// 데이터는 새로 받지 않는다 — 이미 있는 것만 다시 배치한다.
//   · 지수: marketHeader.indices(signals.js — 워커 당일 5분 시리즈 / KR 은 스냅샷 + 추종 ETF 종가 근사)
//   · 환율: marketHeader.fx(현재가·등락률만, 추이 없음)
//   · 시장 현황: data.stocks(ETF 제외 개별 종목) 상승·보합·하락 수, 52주 고점 근처 수, CNN 공포·탐욕
//   · 국내 수급: window.KR_MARKET_FUNDS(lazy, kr-flow-panels.js 와 같은 파일) 최근 거래일 투자자별 순매수
//   · AI 브리핑: data.ai_briefing / data/briefings/<key>.json(app.js renderBriefingSide 와 같은 원본)
// 렌더 진입점: renderIndexStrip(app.js) → renderHomeIndexCarousel, renderAll·refreshFeatureViews → renderHomeDash.

let hdSelected = null;      // 선택된 지수 심볼
let hdIndices = [];         // 마지막으로 받은 지수 목록(캐러셀 순서)
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
  hdIndices = (indices || []).filter((ix) => ix && ix.name).map((ix, i) => ({ ix, i }))
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
}

// 선택 지수 큰 차트. 가로 눈금이 없는 시리즈(시각이 안 붙은 5분 봉·일봉 근사)라 선만 그리고,
// 세로 눈금은 HTML 로 옆에 둔다 — SVG 는 preserveAspectRatio="none" 이라 숨은 상태(폭 0)에서
// 그려도 보이는 순간 제 폭으로 늘어난다.
function renderHomeIndexChart() {
  const host = byId("homeIndexChart");
  if (!host) return;
  const ix = hdIndices.find((r) => r.symbol === hdSelected);
  if (!ix) { host.innerHTML = `<p class="home-chart-empty muted">지수를 불러오면 여기에 차트가 나옵니다.</p>`; return; }
  const chg = hdNum(ix.changePct);
  const price = hdNum(ix.price);
  const vals = (ix.series || []).map(Number).filter(Number.isFinite);
  const approx = Boolean(ix.seriesNote); // KR 스냅샷: 추종 ETF 종가 근사
  // 전일 종가는 등락률로 역산한 값이다(당일 시리즈일 때만 기준선으로 쓴다).
  const prevClose = !approx && price != null && chg != null ? price / (1 + chg / 100) : null;
  const analysis = typeof indexAnalysisTicker === "function" ? indexAnalysisTicker(ix.symbol) : null;
  let plot = `<p class="home-chart-empty muted">추이 데이터가 없습니다.</p>`;
  if (vals.length >= 2) {
    const all = prevClose != null ? vals.concat([prevClose]) : vals;
    let lo = Math.min(...all), hi = Math.max(...all);
    const pad = (hi - lo || Math.abs(hi) * 0.01 || 1) * 0.08;
    lo -= pad; hi += pad;
    const W = 1000, H = 240;
    const y = (v) => H - ((v - lo) / (hi - lo)) * H;
    const x = (i) => (i / (vals.length - 1)) * W;
    const line = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
    const up = approx ? vals[vals.length - 1] >= vals[0] : (chg ?? 0) >= 0;
    const color = up ? "var(--pos)" : "var(--neg)";
    const area = `${line}L${W},${H}L0,${H}Z`;
    const base = prevClose != null ? `<line x1="0" x2="${W}" y1="${y(prevClose).toFixed(1)}" y2="${y(prevClose).toFixed(1)}" class="home-chart-base" vector-effect="non-scaling-stroke"></line>` : "";
    // ETF 근사 추이의 세로 눈금은 ETF 가격이라 지수 수준으로 읽히면 안 된다 — 근사일 땐 눈금을 내지 않는다.
    const axisFmt = (v) => Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en-US") : v.toLocaleString("en-US", { maximumFractionDigits: 2 });
    const ticks = approx ? "" : [hi - pad, (hi + lo) / 2, lo + pad].map((v) => `<span style="top:${((y(v) / H) * 100).toFixed(2)}%">${axisFmt(v)}</span>`).join("");
    plot = `<div class="home-chart-plot${approx ? " is-approx" : ""}">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(ix.name)} ${approx ? "최근 추이" : "당일 추이"}">
          <path d="${area}" fill="${color}" fill-opacity="0.08" stroke="none"></path>
          ${base}
          <path d="${line}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"></path>
        </svg>
        <div class="home-chart-yaxis" aria-hidden="true">${ticks}</div>
      </div>`;
  }
  const caption = approx
    ? `추이선은 지수를 추종하는 ETF 종가 ${vals.length}거래일로 그린 근사치입니다. 가격·등락률은 실제 지수 값입니다.`
    : `당일 5분 간격 추이${prevClose != null ? " · 점선은 등락률로 역산한 전일 종가" : ""} · 출처 Yahoo Finance`;
  host.innerHTML = `
    <div class="home-chart-head">
      <div class="home-chart-title">
        <strong>${escapeHtml(ix.name)}</strong>
        <span class="home-chart-price">${price == null ? "—" : hdFmtLevel(price)}</span>
        <span class="home-chart-chg ${chg == null ? "muted" : cls(chg)}">${chg == null ? "—" : fmtPct(chg)}</span>
      </div>
      ${analysis ? `<button type="button" class="ghost compact-btn home-chart-go" data-ticker="${escapeHtml(analysis)}" title="${escapeHtml(ix.name)}을(를) 추종하는 ${escapeHtml(analysis)} 종목 분석">${escapeHtml(stockLabel(analysis))} 분석 ›</button>` : ""}
    </div>
    ${plot}
    <p class="home-chart-cap">${escapeHtml(caption)}</p>`;
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

function renderHomeMarketStatus() {
  const host = byId("homeMarketStatus");
  if (!host) return;
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
}
