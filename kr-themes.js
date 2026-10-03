// kr-themes.js — 테마 화면(국내·미국) · 테마 등락 · 종목의 테마 칩
// ====================================================================================
// 클래식 스크립트(모듈 아님). 계산은 kr-themes-core.js(window.MirKrThemesCore)에 있다.
// 화면: 시장 탭 › '테마' 잎(#tab-krtheme) — 요약 카드 · 테마 지도 · 로테이션 · 내 종목의 테마 · 전체 표,
//      테마를 고르면 같은 자리에 상세(테마 지수 차트 · 구성 종목 기여도 · 근거 · 연관 테마)로 바뀐다.
//      종목 분석 좌측 '이 종목의 테마' 칩(#stockThemes) — 칩을 누르면 근거가 펼쳐진다.
// 데이터(시장별 — ktSrc):
//   국내 window.KR_THEMES(scripts/build_kr_themes.py) — 편입 근거는 DART 사업보고서 'II. 사업의 내용' 원문 문장.
//        규칙(키워드+자기 지칭+활동어)이나 애매한 문장만 Gemini 판정('AI 판정'). 문장은 테마별
//        data/korea/themes/<id>.json 을 펼칠 때만 fetch 한다(전 종목이면 문장만 수 MB).
//   미국 window.US_THEMES(scripts/build_us_themes.py) — 편입 근거는 테마 ETF 의 SEC N-PORT 보유 내역(비중·기준일).
// 테마 등락은 스냅샷 종가 기준이고, 국내는 가격제한폭 밖 변동 종목을 집계에서 뺀다(core.suspect). 매매 추천이 아니다.
// 이름은 kt* 로 전역 충돌을 피한다(scripts/check_global_name_collisions.py).

const KT_VIEW = { period: "d", weight: "med", sel: null, group: "", q: "", all: false, sort: "cap", market: "" };
const KT_PERIODS = [["d", "오늘"], ["w", "1주"], ["m", "1개월"], ["q", "3개월"]];
// 기본은 중앙값 — 평균은 한 종목의 급등락(또는 미수정 가격)에 끌려간다.
const KT_WEIGHTS = [["med", "중앙값"], ["eq", "동일가중"], ["cap", "시총가중"]];
const KT_RANK_MIN = 2;     // 순위·지도·로테이션은 편입 2종목 이상 테마만(한 종목이면 개별 종목 등락이다)
const KT_TABLE_ROWS = 20;  // 전체 표는 상위 20개만 먼저 — 검색·분류를 고르면 전부
const KT_CHART_BARS = 40;  // 상세 차트: 스냅샷 closeSeries 전체(약 2개월)
// 지도 색이 꽉 차는 등락(기간별). 이보다 크면 같은 진한 색.
const KT_COLOR_SPAN = { d: 3, w: 8, m: 15, q: 25 };
const _ktEvCache = {};

function ktCore() { return window.MirKrThemesCore || null; }

// 시장별 차이를 한곳에. 등락 집계 옵션(limit)·벤치마크·근거 종류가 다르다.
function ktSrc() {
  const kr = typeof isKrMarket === "function" ? isKrMarket() : true;
  return kr
    ? { market: "kr", global: "KR_THEMES", feature: "krThemes", logo: "kr", opts: {}, bench: ["069500", "코스피 200"] }
    : { market: "us", global: "US_THEMES", feature: "usThemes", logo: "us", opts: { limit: null }, bench: ["SPY", "S&P 500"] };
}
function ktData() { return window[ktSrc().global] || null; }
function ktOff() { return typeof featureOff === "function" ? featureOff(ktSrc().feature) : false; }

function ktStockMap() {
  const map = {};
  const rows = (typeof data !== "undefined" && data && Array.isArray(data.stocks)) ? data.stocks : [];
  rows.forEach((s) => { if (s && s.ticker) map[String(s.ticker)] = s; });
  return map;
}

// 테마 근거 파일(<id>.json, 국내만) — 인덱스의 테마 v(내용 해시)를 ?v= 로 붙여 바뀐 파일만 새로 받는다.
function ktLoadEvidence(theme) {
  if (!theme || ktSrc().market !== "kr") return Promise.resolve({});
  const url = `data/korea/themes/${encodeURIComponent(theme.id)}.json${theme.v ? `?v=${encodeURIComponent(theme.v)}` : ""}`;
  if (!_ktEvCache[url]) {
    _ktEvCache[url] = fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => (body && body.ev) || {})
      .catch(() => { delete _ktEvCache[url]; return null; });
  }
  return _ktEvCache[url];
}

function ktTheme(id) {
  const P = ktData();
  if (!P || !Array.isArray(P.themes)) return null;
  // 2026-10-02 테마 세분화로 없어진 옛 id(예: battery_material)는 그걸 쪼갠 첫 테마로 연다(옛 링크 보존).
  return P.themes.find((t) => t.id === id) || P.themes.find((t) => t.replaces === id) || null;
}

// 시총 — 국내 스냅샷은 조 원(marketCapT = marketCapB), 미국은 십억 달러.
function ktCap(s) {
  const v = Number(s && (s.marketCapT ?? s.marketCapB));
  if (!Number.isFinite(v) || v <= 0) return "—";
  if (ktSrc().market === "us") return v >= 1000 ? `$${(v / 1000).toFixed(2)}T` : v >= 1 ? `$${v.toFixed(v >= 100 ? 0 : 1)}B` : `$${Math.round(v * 1000)}M`;
  return v >= 1 ? `${v >= 100 ? Math.round(v).toLocaleString("ko-KR") : v.toFixed(1)}조` : `${Math.round(v * 10000).toLocaleString("ko-KR")}억`;
}

function ktName(t, s) {
  const P = ktData() || {};
  const raw = (s && s.company) || ((P.reports || {})[t] || [])[3] || ((P.names || {})[t]) || t;
  return ktSrc().market === "us" ? ktShortUsName(raw) : raw;
}

// 미국 스냅샷 회사명은 법인 표기가 길다("Teck Resources Ltd Ordinary Shares") — 표·카드에선 핵심만.
function ktShortUsName(name) {
  let n = String(name || "").replace(/^The\s+/i, "");
  for (let i = 0; i < 3; i += 1) {
    n = n.replace(/\s*\((?:Holding Company|The|Canada|[^)]*Shares?[^)]*)\)\s*$/i, "")
      .replace(/[\s,]+(?:Class [A-Z]\b|Common Stock|Common Shares|Ordinary Shares|Subordinate Voting Shares|American Depositary Shares|Depositary Shares|Units?\b|New\b).*$/i, "")
      .replace(/[\s,]+(?:Inc\.?|Incorporated|Corporation|Corp\.?|Company|Co\.|Ltd\.?|Limited|plc|N\.V\.|S\.A\.|L\.P\.|LP|Holdings?|Group)$/i, "")
      .trim();
  }
  return n || String(name || "");
}

function ktLogo(t, name, px) {
  return typeof window.companyLogoHtml === "function" ? window.companyLogoHtml(t, ktSrc().logo, name, px || 20) : "";
}

function ktPct(v, digits) {
  const C = ktCore();
  return `<span class="${C.tone(v)}">${C.fmtPct(v, digits)}</span>`;
}

function ktSeg(key, options, current) {
  return `<div class="segmented kt-seg" role="group">${options.map(([v, label]) => `
    <button type="button" data-kt="${key}:${v}" class="${v === current ? "is-active" : ""}" aria-pressed="${v === current}">${label}</button>`).join("")}</div>`;
}

// 기여(%p) — 반올림해 0 이면 부호 없이.
function ktPp(v) {
  const r = Math.round(Number(v) * 100) / 100;
  if (!Number.isFinite(r) || r === 0) return '<span class="muted">0.00%p</span>';
  return `<span class="${r > 0 ? "pos" : "neg"}">${r > 0 ? "+" : ""}${r.toFixed(2)}%p</span>`;
}

function ktPeriodLabel(p) { return (KT_PERIODS.find(([k]) => k === p) || [])[1] || ""; }

function ktEvidenceHtml(ev, kw, cut) {
  const [a, k, b] = ktCore().evidenceParts(ev, kw, cut);
  return `${escapeHtml(a)}${k ? `<mark>${escapeHtml(k)}</mark>` : ""}${escapeHtml(b)}`;
}

function ktSourceHtml(ticker) {
  const P = ktData() || {};
  const rep = (P.reports || {})[ticker];
  if (!rep) return "";
  const url = ktCore().dartUrl(rep[0]);
  const label = `${rep[1] || "사업보고서"}${rep[2] ? ` · ${rep[2]} 접수` : ""}`;
  return url
    ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" title="접수번호 ${escapeHtml(rep[0])} — DART 원문">${escapeHtml(label)}</a>`
    : escapeHtml(label);
}

// 미국 테마 근거 — 이 종목을 담은 테마 ETF 와 비중(N-PORT 기준일). m.e = [[ETF, 비중%], ...]
function ktEtfEvidenceHtml(m) {
  const P = ktData() || {};
  const etfs = P.etfs || {};
  const list = Array.isArray(m && m.e) ? m.e : [];
  if (!list.length) return "";
  return list.map(([e, w]) => {
    const meta = etfs[e] || {};
    const title = `${meta.name || e}${meta.asOf ? ` · N-PORT ${meta.asOf} 기준` : ""}`;
    return `<span class="kt-etf" title="${escapeHtml(title)}"><b>${escapeHtml(e)}</b> ${Number(w).toFixed(1)}%</span>`;
  }).join("");
}

// 근거 문장 줄. 대표 종목(by='core')은 원문 문장이 없을 수 있다 — 그때는 비워 두고 배지만 보인다.
function ktEvLine(pair, m) {
  if (pair && !pair[0]) return "";
  return pair
    ? `“${ktEvidenceHtml(pair[0], m && m.kw, pair[1])}”`
    : '<span class="muted">근거 문장을 불러오지 못했습니다.</span>';
}

const KT_SUSPECT_BADGE = '<span class="kt-by kt-by-suspect" title="이 기간에 하루 ±30%(가격제한폭)를 넘는 가격 변동이 있습니다. 액면병합·감자·거래재개 등 수정되지 않은 가격일 수 있어 테마 등락 계산에서 뺐습니다.">가격 이상</span>';

function ktByBadge(by) {
  if (by === "etf") return '<span class="kt-by" title="테마 ETF 가 이 종목을 보유하고 있습니다(SEC Form N-PORT 분기말 보유 내역).">ETF 보유</span>';
  if (by === "core") return '<span class="kt-by kt-by-core" title="이 테마를 대표하는 종목으로 직접 지정했습니다.">대표 종목</span>';
  if (by === "name") return '<span class="kt-by" title="상장 종목명이 법적 형태(스팩·리츠)를 말해 줍니다.">종목명</span>';
  return by === "llm"
    ? '<span class="kt-by kt-by-llm" title="규칙만으로는 확신하기 어려워 Gemini가 이 문장을 판정했습니다. 문장 자체는 원문 그대로입니다.">AI 판정</span>'
    : '<span class="kt-by" title="테마 키워드 + 자기 지칭(당사·회사 등) + 사업 활동어가 한 문장에 있어 규칙으로 편입했습니다.">규칙</span>';
}

// 사업보고서가 연결 자회사의 사업으로 적은 문장(지주회사·대기업)으로 편입된 경우.
function ktSubBadge(sub) {
  return sub
    ? '<span class="kt-by kt-by-sub" title="근거 문장이 모회사가 아니라 연결 자회사·계열회사의 사업을 설명합니다(사업보고서는 연결 기준으로 적습니다).">자회사 사업</span>'
    : "";
}

function ktWriteUrl(id) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "krtheme");
    if (id) url.searchParams.set("theme", id);
    else url.searchParams.delete("theme");
    history.replaceState(history.state, "", url.toString());
  } catch (_) { /* history 차단 환경 */ }
}

// 상승/보합/하락 비율 막대.
function ktBreadth(cell) {
  const up = Number(cell && cell.up) || 0;
  const down = Number(cell && cell.down) || 0;
  const n = Number(cell && cell.covered) || 0;
  if (!n) return '<span class="muted">—</span>';
  const flat = Math.max(0, n - up - down);
  const pct = (x) => `${((x / n) * 100).toFixed(1)}%`;
  return `<span class="kt-breadth" title="상승 ${up} · 보합 ${flat} · 하락 ${down}">
      <span class="kt-bar"><i class="up" style="width:${pct(up)}"></i><i class="flat" style="width:${pct(flat)}"></i><i class="down" style="width:${pct(down)}"></i></span>
      <small><span class="pos">${up}</span>/<span class="neg">${down}</span></small></span>`;
}

function ktRankDelta(id, ranks, prevRanks) {
  if (!prevRanks || KT_VIEW.period !== "d") return "";
  const now = ranks[id], prev = prevRanks[id];
  if (!now || !prev) return "";
  const d = prev - now;
  // 상위 20위 안에서, 10계단 넘게 움직인 것만 — 하루 순위는 원래 크게 흔들려 전부 달면 소음이다.
  if (now > 20 || Math.abs(d) < 10) return "";
  return d > 0
    ? `<span class="kt-delta up" title="어제 ${prev}위 → 오늘 ${now}위">▲${d}</span>`
    : `<span class="kt-delta down" title="어제 ${prev}위 → 오늘 ${now}위">▼${-d}</span>`;
}

// 0% 기준 선 차트(SVG). lines: [{ series, cls, label }]
function ktLineChart(lines, opts) {
  const W = 640, H = (opts && opts.h) || 200, P = { l: 6, r: 44, t: 10, b: 18 };
  const all = lines.flatMap((l) => l.series || []).filter(Number.isFinite);
  if (!all.length) return "";
  let lo = Math.min(0, ...all), hi = Math.max(0, ...all);
  if (hi - lo < 1) { hi += 0.5; lo -= 0.5; }
  const pad = (hi - lo) * 0.08;
  lo -= pad; hi += pad;
  const n = Math.max(...lines.map((l) => (l.series || []).length));
  const x = (i) => P.l + (i / Math.max(1, n - 1)) * (W - P.l - P.r);
  const y = (v) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
  const paths = lines.filter((l) => (l.series || []).length > 1).map((l) => {
    const d = l.series.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
    const last = l.series[l.series.length - 1];
    return `<path class="kt-line ${l.cls}" d="${d}"/><text class="kt-line-end ${l.cls}" x="${(W - P.r + 4).toFixed(1)}" y="${(y(last) + 4).toFixed(1)}">${escapeHtml(ktCore().fmtPct(last))}</text>`;
  }).join("");
  return `<svg class="kt-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${escapeHtml((opts && opts.label) || "테마 지수")}">
      <line class="kt-zero" x1="${P.l}" x2="${W - P.r}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}"/>${paths}</svg>`;
}

function ktSpark(series) {
  if (!series || series.length < 2) return "";
  const W = 96, H = 28;
  const lo = Math.min(...series), hi = Math.max(...series);
  const span = hi - lo || 1;
  const d = series.map((v, i) => `${i ? "L" : "M"}${((i / (series.length - 1)) * W).toFixed(1)},${(H - 2 - ((v - lo) / span) * (H - 4)).toFixed(1)}`).join("");
  const cls = series[series.length - 1] >= series[0] ? "pos" : "neg";
  return `<svg class="kt-spark ${cls}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/></svg>`;
}

// 지도 타일 색 — 상승 빨강·하락 파랑(사이트 공통 --pos/--neg), 진하기는 KT_COLOR_SPAN 대비.
function ktTileStyle(v) {
  if (!Number.isFinite(v)) return "background:var(--surface-2)";
  const span = KT_COLOR_SPAN[KT_VIEW.period] || 3;
  const a = Math.min(1, Math.abs(v) / span);
  const pct = Math.round(12 + a * 70);
  const ink = pct >= 55 ? "#fff" : "var(--text)";
  return `background:color-mix(in srgb, var(${v >= 0 ? "--pos" : "--neg"}) ${pct}%, var(--panel));color:${ink}`;
}

// ------------------------------------------------------------------ 시장 탭 '테마'
function renderKrThemes() {
  const host = byId("krThemeMarket");
  if (!host) return;
  const src = ktSrc();
  if (ktOff() || !ktCore()) {
    host.innerHTML = "";
    return;
  }
  const P = ktData();
  if (!P) {
    host.innerHTML = '<p class="muted">데이터를 불러오는 중…</p>';
    ensureFeatureData(src.feature).then((ok) => {
      if (ok && ktData()) renderKrThemes();
      else host.innerHTML = '<p class="muted">테마 데이터를 불러오지 못했습니다.</p>';
    });
    return;
  }
  if (KT_VIEW.market !== src.market) {
    // 시장을 바꾸면 고른 테마·분류를 초기화(국내 id 로 미국 테마를 찾지 않게). 첫 진입은 ?theme= 딥링크.
    const first = !KT_VIEW.market;
    Object.assign(KT_VIEW, { market: src.market, sel: null, group: "", q: "", all: false });
    const q = first ? new URLSearchParams(window.location.search).get("theme") : null;
    if (q && ktTheme(q)) KT_VIEW.sel = ktTheme(q).id;
  }
  if (!host.dataset.ktBound) {
    host.dataset.ktBound = "1";
    host.addEventListener("click", ktOnClick);
    // 테마 이름 검색 — 다시 그리지 않고 행만 숨긴다(다시 그리면 입력칸 포커스가 날아간다).
    host.addEventListener("input", (ev) => {
      if (ev.target && ev.target.id === "ktSearch") { KT_VIEW.q = ev.target.value; ktApplySearch(host); }
    });
  }
  const cov = P.coverage || {};
  if (!Number(P.count)) {
    host.innerHTML = `<section class="kt-card"><p class="muted">아직 편입된 종목이 없습니다${cov.universe ? ` (원문 확인 ${Number(cov.processed || 0).toLocaleString("ko-KR")} / ${Number(cov.universe || 0).toLocaleString("ko-KR")}종목)` : ""}.</p></section>`;
    return;
  }
  const ctx = ktContext(P);
  host.innerHTML = KT_VIEW.sel && ktTheme(KT_VIEW.sel) ? ktDetailView(ctx) : ktOverview(ctx);
  if (!KT_VIEW.sel) { if (KT_VIEW.q) ktApplySearch(host); }
  else ktFillDetail(KT_VIEW.sel);
}

// 한 번 그릴 때 쓰는 공통 계산.
function ktContext(P) {
  const C = ktCore();
  const src = ktSrc();
  const map = ktStockMap();
  const stats = C.themeStats(P.themes, map, src.opts);
  const withMembers = stats.filter((s) => s.n > 0);
  const val = (s) => C.statValue(s, KT_VIEW.period, KT_VIEW.weight);
  const rankPool = C.rankThemes(withMembers, KT_VIEW.period, KT_VIEW.weight, KT_RANK_MIN).filter((s) => val(s) != null);
  const ranks = {};
  rankPool.forEach((s, i) => { ranks[s.id] = i + 1; });
  let prevRanks = null;
  if (KT_VIEW.period === "d") prevRanks = C.ranksOf(C.prevDayValues(P.themes, map, KT_VIEW.weight, src.opts), rankPool.map((s) => s.id));
  const themeById = {};
  P.themes.forEach((th) => { themeById[th.id] = th; });
  return { P, C, src, map, stats, withMembers, rankPool, ranks, prevRanks, val, themeById };
}

function ktOverview(ctx) {
  const { P, C, src, rankPool, withMembers } = ctx;
  const cov = P.coverage || {};
  const strong = rankPool.slice(0, 3);
  const weak = rankPool.length > 6 ? rankPool.slice(-3).reverse() : [];
  const periodLabel = ktPeriodLabel(KT_VIEW.period);
  const card = (s) => ktSummaryCard(ctx, s);
  const foot = src.market === "kr"
    ? `원문 확인 ${Number(cov.processed || 0).toLocaleString("ko-KR")} / ${Number(cov.universe || 0).toLocaleString("ko-KR")}종목 · 갱신 ${escapeHtml(P.updatedAtKst || "")}`
    : `테마 ETF ${Object.keys(P.etfs || {}).length}개 보유 내역 · 갱신 ${escapeHtml(P.updatedAtKst || "")}`;
  return `
    <section class="kt-card kt-hero" aria-label="테마 흐름">
      <header class="kt-head">
        <h3>테마 흐름</h3>
        ${ktSeg("period", KT_PERIODS, KT_VIEW.period)}
        ${ktSeg("weight", KT_WEIGHTS, KT_VIEW.weight)}
      </header>
      <p class="kt-sub">기준 ${escapeHtml(String((typeof data !== "undefined" && data && data.updatedAtKst) || "").slice(0, 16))}</p>
      <h4 class="kt-cards-title">${periodLabel} 강세 테마</h4>
      <div class="kt-cards">${strong.map(card).join("") || '<p class="muted">순위를 낼 테마가 아직 없습니다.</p>'}</div>
      ${weak.length ? `<h4 class="kt-cards-title">${periodLabel} 약세 테마</h4><div class="kt-cards">${weak.map(card).join("")}</div>` : ""}
    </section>
    ${ktMySection(ctx)}
    ${ktMapSection(ctx)}
    ${ktRotationSection(ctx)}
    ${ktTableSection(ctx)}
    <p class="ia-footnote kt-foot">${foot}</p>`;
}

function ktSummaryCard(ctx, s) {
  const { C, map, src, ranks, prevRanks, themeById } = ctx;
  const th = themeById[s.id];
  const members = C.activeMembers(th);
  const v = C.statValue(s, KT_VIEW.period, KT_VIEW.weight);
  const lead = C.leaders(members, map, KT_VIEW.period, 2, src.opts);
  const spark = C.themeIndex(members, map, 21, src.opts).series;
  return `<button type="button" class="kt-sum" data-kt-theme="${escapeHtml(s.id)}">
      <span class="kt-sum-top"><span class="kt-sum-rank">${ranks[s.id] || ""}</span><span class="kt-sum-name">${escapeHtml(s.name)}</span>${ktRankDelta(s.id, ranks, prevRanks)}</span>
      <span class="kt-sum-mid"><b class="kt-sum-val">${ktPct(v)}</b>${ktSpark(spark)}</span>
      ${ktBreadth(s[KT_VIEW.period])}
      <span class="kt-sum-lead">${lead.map((x) => `<span>${ktLogo(x.t, ktName(x.t, map[x.t]), 16)}${escapeHtml(ktName(x.t, map[x.t]))} ${ktPct(x.r)}</span>`).join("")}</span>
    </button>`;
}

// 관심·보유 종목이 든 테마 — 둘 다 비었으면 섹션을 숨긴다.
function ktMySection(ctx) {
  const { C, P, map, val } = ctx;
  const wl = window._mirWatchlistMatch, pf = window._mirPortfolioMatch;
  if (typeof wl !== "function" && typeof pf !== "function") return "";
  const mine = Object.values(map).filter((s) => (pf && pf(s)) || (wl && wl(s))).sort((a, b) => (Number(b.marketCapB) || 0) - (Number(a.marketCapB) || 0));
  const statById = {};
  ctx.stats.forEach((s) => { statById[s.id] = s; });
  const rows = [];
  for (const s of mine) {
    const list = C.themesForTicker(P.themes, s.ticker).filter((x) => !x.sub).slice(0, 4);
    if (!list.length) continue;
    rows.push(`<li><button type="button" class="kt-my-name" data-kt-ticker="${escapeHtml(s.ticker)}">${ktLogo(s.ticker, s.company, 18)}<span>${escapeHtml(ktName(s.ticker, s))}</span></button>
        <span class="kt-my-themes">${list.map((x) => `<button type="button" class="kt-chip" data-kt-theme="${escapeHtml(x.id)}">${escapeHtml(x.name)} ${ktPct(val(statById[x.id] || {}))}</button>`).join("")}</span></li>`);
    if (rows.length >= 8) break;
  }
  if (!rows.length) return "";
  return `<section class="kt-card" aria-label="내 종목의 테마">
      <header class="kt-head"><h3>내 종목의 테마</h3><span class="kt-count">관심·보유 종목 · ${ktPeriodLabel(KT_VIEW.period)}</span></header>
      <ul class="kt-my">${rows.join("")}</ul>
    </section>`;
}

// 테마 지도 — 분류(그룹) 상자 안에 테마 타일. 크기 = √(편입 종목 시총 합), 색 = 기간 등락.
function ktMapSection(ctx) {
  const { C, map, rankPool, themeById, val } = ctx;
  if (typeof squarify !== "function" || rankPool.length < 4) return "";
  const phone = typeof window.matchMedia === "function" && window.matchMedia("(max-width: 640px)").matches;
  const W = 1000, H = phone ? 1250 : 560;
  const groups = {};
  rankPool.forEach((s) => {
    const cap = C.activeMembers(themeById[s.id]).reduce((a, m) => a + (Number(map[m.t] && map[m.t].marketCapB) || 0), 0);
    const g = s.group || "기타";
    (groups[g] = groups[g] || { name: g, items: [], weight: 0 }).items.push({ s, weight: Math.sqrt(Math.max(cap, 0.0001)) });
  });
  const gl = Object.values(groups);
  gl.forEach((g) => { g.weight = g.items.reduce((a, x) => a + x.weight, 0); });
  const pct = (r) => `left:${(r.x / W) * 100}%;top:${(r.y / H) * 100}%;width:${(r.w / W) * 100}%;height:${(r.h / H) * 100}%`;
  const tiles = [];
  // treemap.js squarify → [{ item, rect:{x,y,w,h} }]
  squarify(gl, { x: 0, y: 0, w: W, h: H }, (g) => g.weight).forEach(({ item: g, rect: gr }) => {
    const head = 22;
    tiles.push(`<div class="kt-map-group" style="${pct(gr)}"><span>${escapeHtml(g.name)}</span></div>`);
    const inner = { x: gr.x + 2, y: gr.y + head, w: Math.max(0, gr.w - 4), h: Math.max(0, gr.h - head - 2) };
    squarify(g.items, inner, (x) => x.weight).forEach(({ item, rect: r }) => {
      const s = item.s;
      const v = val(s);
      const big = r.w > 90 && r.h > 44;
      const mid = r.w > 56 && r.h > 30;
      tiles.push(`<button type="button" class="kt-tile" data-kt-theme="${escapeHtml(s.id)}" style="${pct(r)};${ktTileStyle(v)}" title="${escapeHtml(`${s.name} ${C.fmtPct(v)} · ${s.n}종목`)}">
          ${mid ? `<span class="kt-tile-name">${escapeHtml(s.name)}</span>` : ""}${big || mid ? `<span class="kt-tile-val">${escapeHtml(C.fmtPct(v))}</span>` : ""}</button>`);
    });
  });
  return `<section class="kt-card" aria-label="테마 지도">
      <header class="kt-head"><h3>테마 지도</h3><span class="kt-count">${ktPeriodLabel(KT_VIEW.period)} · 크기는 편입 종목 시총</span></header>
      <div class="kt-map" style="aspect-ratio:${W}/${H}">${tiles.join("")}</div>
    </section>`;
}

// 테마 로테이션 — x: 1개월, y: 1주(둘 다 시장 지수 ETF 대비 %p). 우상 주도 · 좌상 개선 · 좌하 소외 · 우하 약화.
function ktRotationSection(ctx) {
  const { C, map, src, rankPool } = ctx;
  const bench = map[src.bench[0]];
  const bw = bench ? Number(bench.weekChangePct) : NaN, bm = bench ? Number(bench.monthChangePct) : NaN;
  if (!Number.isFinite(bw) || !Number.isFinite(bm) || rankPool.length < 6) return "";
  const pts = rankPool.map((s) => {
    const x = C.statValue(s, "m", KT_VIEW.weight), y = C.statValue(s, "w", KT_VIEW.weight);
    return x == null || y == null ? null : { s, x: x - bm, y: y - bw };
  }).filter(Boolean);
  if (pts.length < 6) return "";
  const q95 = (arr) => { const v = arr.map(Math.abs).sort((a, b) => a - b); return Math.max(1, v[Math.floor(v.length * 0.95)] || 1); };
  const sx = q95(pts.map((p) => p.x)), sy = q95(pts.map((p) => p.y));
  const W = 1000, H = 440, M = 22;
  const clip = (v, s) => Math.max(-s, Math.min(s, v));
  const X = (v) => W / 2 + (clip(v, sx) / sx) * (W / 2 - M);
  const Y = (v) => H / 2 - (clip(v, sy) / sy) * (H / 2 - M);
  // 가장자리(강한 신호) 테마부터 라벨 — 이미 놓인 라벨과 겹치면 건너뛴다(최대 10개).
  const placed = [];
  const label = [];
  pts.slice().sort((a, b) => (Math.abs(b.x) / sx + Math.abs(b.y) / sy) - (Math.abs(a.x) / sx + Math.abs(a.y) / sy)).forEach((p) => {
    if (label.length >= 10) return;
    const lx = X(p.x), ly = Y(p.y) - 9;
    if (placed.some(([x, y]) => Math.abs(x - lx) < 120 && Math.abs(y - ly) < 18)) return;
    placed.push([lx, ly]);
    label.push(p.s.id);
  });
  const dots = pts.map((p) => {
    const q = C.quadrant(p.x, p.y);
    const cx = X(p.x).toFixed(1), cy = Y(p.y).toFixed(1);
    return `<g class="kt-rot-pt ${q}" data-kt-theme="${escapeHtml(p.s.id)}" tabindex="0" role="button" aria-label="${escapeHtml(`${p.s.name}: 1개월 ${C.fmtPct(p.x)}p, 1주 ${C.fmtPct(p.y)}p`)}">
        <title>${escapeHtml(`${p.s.name} — 1개월 ${C.fmtPct(p.x)}p · 1주 ${C.fmtPct(p.y)}p (${src.bench[1]} 대비)`)}</title>
        <circle cx="${cx}" cy="${cy}" r="${label.includes(p.s.id) ? 5 : 3.5}"/>
        ${label.includes(p.s.id) ? `<text x="${Math.max(50, Math.min(W - 50, Number(cx))).toFixed(1)}" y="${Math.max(14, Number(cy) - 9).toFixed(1)}">${escapeHtml(p.s.name.length > 12 ? `${p.s.name.slice(0, 11)}…` : p.s.name)}</text>` : ""}</g>`;
  }).join("");
  return `<section class="kt-card" aria-label="테마 로테이션">
      <header class="kt-head"><h3>테마 로테이션</h3><span class="kt-count">${escapeHtml(src.bench[1])} 대비 · 가로 1개월 · 세로 1주</span></header>
      <div class="kt-rot-wrap">
        <svg class="kt-rot" viewBox="0 0 ${W} ${H}" role="img" aria-label="테마 로테이션 사분면">
          <rect class="kt-rot-q lead" x="${W / 2}" y="0" width="${W / 2}" height="${H / 2}"/>
          <rect class="kt-rot-q lag" x="0" y="${H / 2}" width="${W / 2}" height="${H / 2}"/>
          <line class="kt-zero" x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}"/><line class="kt-zero" y1="0" y2="${H}" x1="${W / 2}" x2="${W / 2}"/>
          <text class="kt-rot-ql" x="${W - 8}" y="16" text-anchor="end">주도</text>
          <text class="kt-rot-ql" x="8" y="16">개선</text>
          <text class="kt-rot-ql" x="8" y="${H - 8}">소외</text>
          <text class="kt-rot-ql" x="${W - 8}" y="${H - 8}" text-anchor="end">약화</text>
          ${dots}
        </svg>
      </div>
    </section>`;
}

function ktTableSection(ctx) {
  const { C, P, map, src, withMembers, ranks, prevRanks, themeById } = ctx;
  const groups = C.groups(P.themes);
  const inGroup = (s) => !KT_VIEW.group || s.group === KT_VIEW.group;
  const ranked = C.rankThemes(withMembers.filter(inGroup), KT_VIEW.period, KT_VIEW.weight, 0);
  const limited = !KT_VIEW.all && !KT_VIEW.group && !KT_VIEW.q && ranked.length > KT_TABLE_ROWS;
  const shown = limited ? ranked.slice(0, KT_TABLE_ROWS) : ranked;
  const wk = C.weightKey(KT_VIEW.weight);
  const cellPct = (s, p) => `<td class="kt-p-${p}${KT_VIEW.period === p ? " is-key" : ""}">${ktPct(s[p][wk])}</td>`;
  const rows = shown.map((s) => {
    const lead = C.leaders(C.activeMembers(themeById[s.id]), map, KT_VIEW.period, 2, src.opts);
    return `<tr class="kt-row" data-kt-theme="${escapeHtml(s.id)}" data-kt-name="${escapeHtml(`${s.name} ${s.group || ""}`)}">
        <th scope="row"><span class="kt-name">${escapeHtml(s.name)}${ktRankDelta(s.id, ranks, prevRanks)}</span><small class="kt-group">${escapeHtml(s.group || "")} · ${s.n}종목${s.llm ? ` · AI ${s.llm}` : ""}</small></th>
        ${cellPct(s, KT_VIEW.period)}
        <td class="kt-col-breadth">${ktBreadth(s[KT_VIEW.period])}</td>
        <td class="kt-col-lead">${lead.map((x) => `<span>${escapeHtml(ktName(x.t, map[x.t]))} ${ktPct(x.r)}</span>`).join("") || '<span class="muted">—</span>'}</td>
        ${KT_PERIODS.filter(([p]) => p !== KT_VIEW.period).map(([p]) => cellPct(s, p)).join("")}
      </tr>`;
  }).join("");
  const others = KT_PERIODS.filter(([p]) => p !== KT_VIEW.period);
  return `<section class="kt-card" aria-label="전체 테마">
      <header class="kt-head"><h3>전체 테마</h3><span class="kt-count">${withMembers.length}개 테마 · 편입 ${Number(P.count).toLocaleString("ko-KR")}건</span>
        <input type="search" id="ktSearch" class="kt-search" placeholder="${src.market === "kr" ? "테마 검색 (예: 양극재, HBM)" : "테마 검색 (예: AI, 원전)"}" aria-label="테마 검색" value="${escapeHtml(KT_VIEW.q)}"></header>
      <div class="kt-groups" role="group" aria-label="테마 분류">
        <button type="button" data-kt="group:" class="kt-chip-f ${!KT_VIEW.group ? "is-active" : ""}">전체</button>
        ${groups.map((g) => `<button type="button" data-kt="group:${escapeHtml(g)}" class="kt-chip-f ${KT_VIEW.group === g ? "is-active" : ""}">${escapeHtml(g)}</button>`).join("")}
      </div>
      <div class="kt-table-wrap">
        <table class="kt-table">
          <thead><tr><th scope="col">테마</th><th scope="col" class="is-key">${ktPeriodLabel(KT_VIEW.period)}</th><th scope="col" class="kt-col-breadth">상승/하락</th><th scope="col" class="kt-col-lead">주도주</th>${others.map(([p, l]) => `<th scope="col" class="kt-p-${p}">${l}</th>`).join("")}</tr></thead>
          <tbody>${rows || '<tr><td colspan="7" class="muted">이 분류에 편입 종목이 있는 테마가 없습니다.</td></tr>'}</tbody>
        </table>
      </div>
      ${limited ? `<button type="button" class="ghost kt-more" data-kt="all:1">전체 ${ranked.length}개 테마 보기</button>` : ""}
    </section>`;
}

function ktApplySearch(host) {
  const q = String(KT_VIEW.q || "").trim().toLowerCase().replace(/\s+/g, "");
  host.querySelectorAll(".kt-row").forEach((row) => {
    const hit = !q || String(row.dataset.ktName || "").toLowerCase().replace(/\s+/g, "").includes(q);
    row.hidden = !hit;
  });
  // 상위 20개만 그린 상태에서 검색하면 나머지를 그려야 한다.
  if (q && !KT_VIEW.all && host.querySelector(".kt-more")) {
    KT_VIEW.all = true;
    const pos = host.querySelector("#ktSearch")?.selectionStart;
    renderKrThemes();
    const input = host.querySelector("#ktSearch");
    if (input) { input.focus(); if (pos != null) input.setSelectionRange(pos, pos); }
  }
}

// ------------------------------------------------------------------ 테마 상세
function ktDetailView(ctx) {
  const { P, C, src, map, stats } = ctx;
  const th = ktTheme(KT_VIEW.sel);
  const stat = stats.find((s) => s.id === th.id);
  const members = C.activeMembers(th);
  const hidden = (th.members || []).length - members.length;
  const key = C.PERIOD_KEYS[KT_VIEW.period];
  const periodLabel = ktPeriodLabel(KT_VIEW.period);
  const cell = stat[KT_VIEW.period];
  const susp = new Set(cell.excluded || []);
  const contrib = C.contributions(members, map, KT_VIEW.period, src.opts);
  const reasons = ktMoverReasons();
  const sorters = {
    cap: (a, b) => (Number(map[b.t]?.marketCapB) || 0) - (Number(map[a.t]?.marketCapB) || 0),
    ret: (a, b) => (Number(map[b.t]?.[key]) || -1e9) - (Number(map[a.t]?.[key]) || -1e9),
    contrib: (a, b) => Math.abs(contrib[b.t]?.c || 0) - Math.abs(contrib[a.t]?.c || 0),
  };
  const sorted = members.slice().sort(sorters[KT_VIEW.sort] || sorters.cap);
  const ix = C.themeIndex(members, map, KT_CHART_BARS, src.opts);
  const bench = C.normSeries(map[src.bench[0]], KT_CHART_BARS);
  const chart = ix.series.length ? ktLineChart([
    { series: bench, cls: "bench", label: src.bench[1] },
    { series: ix.series, cls: "theme", label: th.name },
  ], { label: `${th.name} 테마 지수와 ${src.bench[1]}` }) : "";
  const posC = Object.entries(contrib).filter(([, v]) => v.c > 0).sort((a, b) => b[1].c - a[1].c).slice(0, 3);
  const negC = Object.entries(contrib).filter(([, v]) => v.c < 0).sort((a, b) => a[1].c - b[1].c).slice(0, 2);
  const contribChip = ([t, v]) => `<button type="button" class="kt-contrib" data-kt-ticker="${escapeHtml(t)}">${escapeHtml(ktName(t, map[t]))} ${ktPp(v.c)}</button>`;
  const rel = C.related(P.themes, th.id, 6);
  const wk = C.weightKey(KT_VIEW.weight);
  const kr = src.market === "kr";
  const items = sorted.map((m) => {
    const s = map[m.t];
    const name = ktName(m.t, s);
    const c = contrib[m.t];
    const why = reasons[m.t];
    const evBtn = kr ? `<button type="button" class="ghost compact-btn kt-ev-btn" data-kt-ev-toggle="${escapeHtml(m.t)}" aria-expanded="false">근거</button>` : "";
    return `<tr class="kt-mrow" data-kt-member="${escapeHtml(m.t)}">
        <th scope="row"><button type="button" class="kt-member-name" data-kt-ticker="${escapeHtml(m.t)}">${ktLogo(m.t, name, 20)}<span>${escapeHtml(name)}</span></button>
          ${why ? `<small class="kt-why" title="${escapeHtml(`오늘 등락 이유(자동 요약, ${reasons.__date || ""})`)}">${escapeHtml(why)}</small>` : ""}</th>
        <td class="is-key">${s ? ktPct(s[key]) : '<span class="muted">—</span>'}${susp.has(m.t) ? KT_SUSPECT_BADGE : ""}</td>
        <td class="kt-col-cap">${escapeHtml(ktCap(s))}</td>
        <td class="kt-col-contrib">${c ? ktPp(c.c) : '<span class="muted">—</span>'}</td>
        <td class="kt-col-ev${kr ? "" : " is-etf"}"><div class="kt-ev-cell">${kr ? `<span class="kt-kw">${escapeHtml(m.kw || "")}</span>${ktByBadge(m.by)}${ktSubBadge(m.sub)}` : ktEtfEvidenceHtml(m)}${evBtn}</div></td>
      </tr>${kr ? `<tr class="kt-ev-row" data-kt-ev-row="${escapeHtml(m.t)}" hidden><td colspan="5">
          <p class="kt-ev" data-kt-ev="${escapeHtml(m.t)}"><span class="muted">근거 문장 불러오는 중…</span></p>
          <p class="kt-meta"><span>${ktSourceHtml(m.t)}</span>${Number(m.n) > 1 ? `<span title="같은 테마로 걸린 원문 문장 수 — 대표 문장 하나만 보여 줍니다">관련 문장 ${Number(m.n)}개</span>` : ""}${m.pb != null ? `<span>PBR ${Number(m.pb).toFixed(2)}배</span>` : ""}</p>
        </td></tr>` : ""}`;
  }).join("");
  const sortBtn = (k, label) => `<button type="button" data-kt="sort:${k}" class="${KT_VIEW.sort === k ? "is-active" : ""}" aria-pressed="${KT_VIEW.sort === k}">${label}</button>`;
  const etfLine = !kr && Array.isArray(th.etfs) && th.etfs.length
    ? `<p class="kt-desc">기준 ETF ${th.etfs.map((e) => `<b title="${escapeHtml((P.etfs || {})[e]?.name || e)}">${escapeHtml(e)}</b>`).join(" · ")}</p>` : "";
  return `
    <button type="button" class="ghost kt-back" data-kt="back:1">← 전체 테마</button>
    <section class="kt-card kt-dv" aria-label="${escapeHtml(th.name)} 테마">
      <header class="kt-dv-head">
        <div class="kt-dv-title"><small class="kt-group">${escapeHtml(th.group || "")}</small><h3>${escapeHtml(th.name)}</h3>
          <p class="kt-desc">${escapeHtml(th.about || th.desc || "")}</p>${etfLine}</div>
        <div class="kt-dv-ctl">${ktSeg("period", KT_PERIODS, KT_VIEW.period)}${ktSeg("weight", KT_WEIGHTS, KT_VIEW.weight)}</div>
      </header>
      <div class="kt-dv-stats">
        ${KT_PERIODS.map(([p, l]) => `<div class="kt-stat${p === KT_VIEW.period ? " is-key" : ""}"><small>${l}</small><b>${ktPct(stat[p][wk])}</b></div>`).join("")}
        <div class="kt-stat kt-stat-breadth"><small>${periodLabel} 상승/하락</small>${ktBreadth(cell)}</div>
      </div>
      ${chart ? `<div class="kt-chart-box"><div class="kt-legend"><span class="theme">테마 지수(동일가중 ${ix.n}종목)</span><span class="bench">${escapeHtml(src.bench[1])}</span><small>최근 ${KT_CHART_BARS}거래일</small></div>${chart}</div>` : ""}
      ${posC.length || negC.length ? `<div class="kt-contribs"><small>${periodLabel} 시총가중 기여</small>${posC.map(contribChip).join("")}${negC.map(contribChip).join("")}</div>` : ""}
      ${susp.size ? `<p class="kt-note kt-warn">가격 이상 ${susp.size}종목 집계 제외</p>` : ""}
      ${th.filter && th.filter.pbMax != null ? `<p class="kt-note">KRX 공식 PBR ${th.filter.pbMax}배 미만만${hidden > 0 ? ` — ${hidden}종목 제외` : ""}</p>` : ""}
    </section>
    <section class="kt-card" aria-label="구성 종목">
      <header class="kt-head"><h3>구성 종목</h3><span class="kt-count">${members.length}종목</span>
        <div class="segmented kt-seg" role="group" aria-label="정렬">${sortBtn("cap", "시총순")}${sortBtn("ret", "등락순")}${sortBtn("contrib", "기여순")}</div></header>
      <div class="kt-table-wrap">
        <table class="kt-table kt-mtable">
          <thead><tr><th scope="col">종목</th><th scope="col" class="is-key">${periodLabel}</th><th scope="col" class="kt-col-cap">시총</th><th scope="col" class="kt-col-contrib">기여</th><th scope="col" class="kt-col-ev">${kr ? "편입 근거" : "담은 테마 ETF(비중)"}</th></tr></thead>
          <tbody>${items || '<tr><td colspan="5" class="muted">조건을 만족하는 종목이 없습니다.</td></tr>'}</tbody>
        </table>
      </div>
    </section>
    ${rel.length ? `<section class="kt-card" aria-label="연관 테마"><header class="kt-head"><h3>연관 테마</h3><span class="kt-count">구성 종목이 겹치는 테마</span></header>
      <div class="kt-chips">${rel.map((r) => `<button type="button" class="kt-chip" data-kt-theme="${escapeHtml(r.id)}">${escapeHtml(r.name)} <small>공통 ${r.common}</small></button>`).join("")}</div></section>` : ""}`;
}

// 오늘 급등락 이유(movers_reasons — 자동 요약). 아직 안 받았으면 받고 다시 그린다. { 티커: 이유, __date }
function ktMoverReasons() {
  const M = window.MOVERS_REASONS;
  if (!M) {
    if (!ktMoverReasons._asked && typeof ensureFeatureData === "function") {
      ktMoverReasons._asked = true;
      ensureFeatureData("movers").then((ok) => { if (ok && window.MOVERS_REASONS && KT_VIEW.sel) renderKrThemes(); });
    }
    return {};
  }
  const out = { __date: M.tradeDate || "" };
  [...(M.up || []), ...(M.down || [])].forEach((r) => {
    if (r && r.ticker && r.reason && r.reasonStatus === "ok") out[String(r.ticker)] = r.reason;
  });
  return out;
}

// 펼친 테마의 근거 문장을 채운다(테마 파일 하나 fetch, 국내만).
function ktFillDetail(id) {
  const th = ktTheme(id);
  if (!th || ktSrc().market !== "kr") return;
  ktLoadEvidence(th).then((ev) => {
    const host = byId("krThemeMarket");
    if (!host || KT_VIEW.sel !== th.id) return;
    host.querySelectorAll("[data-kt-ev]").forEach((p) => {
      const t = p.dataset.ktEv;
      const m = (th.members || []).find((x) => x.t === t);
      const pair = ev && ev[t];
      const html = ktEvLine(pair, m);
      p.innerHTML = html;
      p.hidden = !html;
    });
  });
}

function ktOnClick(ev) {
  const host = byId("krThemeMarket");
  const btn = ev.target.closest("[data-kt]");
  if (btn) {
    const i = btn.dataset.kt.indexOf(":");
    const key = btn.dataset.kt.slice(0, i);
    const val = btn.dataset.kt.slice(i + 1);
    if (key === "period") KT_VIEW.period = val;
    else if (key === "weight") KT_VIEW.weight = val;
    else if (key === "group") { KT_VIEW.group = val; }
    else if (key === "all") KT_VIEW.all = true;
    else if (key === "sort") KT_VIEW.sort = val;
    else if (key === "back") { KT_VIEW.sel = null; ktWriteUrl(null); }
    renderKrThemes();
    if (key === "back" && host) host.scrollIntoView({ block: "start" });
    return;
  }
  const toggle = ev.target.closest("[data-kt-ev-toggle]");
  if (toggle && host) {
    const row = host.querySelector(`[data-kt-ev-row="${CSS.escape(toggle.dataset.ktEvToggle)}"]`);
    if (row) {
      row.hidden = !row.hidden;
      toggle.setAttribute("aria-expanded", String(!row.hidden));
      toggle.classList.toggle("is-active", !row.hidden);
    }
    return;
  }
  const tk = ev.target.closest("[data-kt-ticker]");
  if (tk) {
    if (typeof navigateToStockAnalysis === "function") navigateToStockAnalysis(tk.dataset.ktTicker);
    return;
  }
  if (ev.target.closest("a")) return;
  const row = ev.target.closest("[data-kt-theme]");
  if (row) openKrTheme(row.dataset.ktTheme, { fromTab: true });
}

// 테마 상세 열기 — 같은 탭 안(표·카드·지도·연관 테마) 또는 다른 화면(종목 칩)에서.
function openKrTheme(id, opts) {
  if (!ktTheme(id)) return;
  KT_VIEW.sel = ktTheme(id).id;
  KT_VIEW.sort = "cap";
  if (!(opts && opts.fromTab) && typeof activateTab === "function") activateTab("krtheme");
  ktWriteUrl(KT_VIEW.sel);
  renderKrThemes();
  const host = byId("krThemeMarket");
  if (host) host.scrollIntoView({ block: "start" });
}

// 로테이션 점 키보드 열기.
document.addEventListener("keydown", (ev) => {
  if ((ev.key === "Enter" || ev.key === " ") && ev.target && ev.target.classList && ev.target.classList.contains("kt-rot-pt")) {
    ev.preventDefault();
    openKrTheme(ev.target.dataset.ktTheme, { fromTab: true });
  }
});

// ------------------------------------------------------------------ 종목 분석 '이 종목의 테마' 칩
function renderStockThemes(item) {
  const host = byId("stockThemes");
  if (!host) return;
  const ticker = item && item.ticker ? String(item.ticker) : "";
  const src = ktSrc();
  if (!ticker || ktOff() || !ktCore()) {
    host.hidden = true;
    host.innerHTML = "";
    return;
  }
  const P = ktData();
  if (!P) {
    ensureFeatureData(src.feature).then((ok) => {
      if (ok && typeof selectedTicker !== "undefined" && String(selectedTicker) === ticker) renderStockThemes(item);
    });
    host.hidden = true;
    return;
  }
  // refreshFeatureViews 가 다른 데이터가 도착할 때마다 다시 부른다 — 같은 종목·같은 데이터면 그대로 둬서
  // 펼쳐 둔 근거 문장이 닫히지 않게 한다.
  const renderKey = `${src.market}|${ticker}|${P.updatedAtKst || ""}`;
  if (host.dataset.ktKey === renderKey && host.innerHTML) return;
  host.dataset.ktKey = renderKey;
  // 자기 사업 테마를 먼저, 자회사 사업은 뒤로. 지주사는 30개 넘게 붙어 8개까지만 펼쳐 두고 나머지는 접는다.
  const list = ktCore().themesForTicker(P.themes, ticker).slice().sort((a, b) => (a.sub ? 1 : 0) - (b.sub ? 1 : 0));
  const KT_CHIP_SHOW = 8;
  const done = src.market === "us" || (Array.isArray(P.done) && P.done.includes(ticker));
  if (!list.length && (!done || src.market === "us")) {
    host.hidden = true;
    host.innerHTML = "";
    return;
  }
  const rep = (P.reports || {})[ticker];
  const repName = src.market === "us" ? "테마 ETF 보유" : rep ? rep[1] : "사업보고서";
  host.hidden = false;
  host.dataset.ktTicker = ticker;
  host.innerHTML = `
    <h3 class="kt-chips-title">이 종목의 테마</h3>
    ${list.length ? `<div class="kt-chips">${list.map((x, i) => `<button type="button" class="kt-chip" data-kt-chip="${escapeHtml(x.id)}" aria-expanded="false"${i >= KT_CHIP_SHOW ? " hidden" : ""}
        title="${escapeHtml(`${x.by === "core" ? "대표 종목" : x.by === "etf" ? "테마 ETF 보유" : `근거 키워드 '${x.kw}'`} · ${repName}${x.by === "llm" ? " · AI 판정" : ""}${x.sub ? " · 자회사 사업" : ""} — 눌러서 근거 보기`)}">${escapeHtml(x.name)}${x.by === "llm" ? '<span class="kt-chip-ai" aria-label="AI 판정">AI</span>' : ""}${x.sub ? '<span class="kt-chip-ai" aria-label="자회사 사업">자회사</span>' : ""}</button>`).join("")}${list.length > KT_CHIP_SHOW ? `<button type="button" class="kt-chip kt-chip-more" data-kt-more>+${list.length - KT_CHIP_SHOW}개 더</button>` : ""}</div>
      <div class="kt-chip-ev" hidden></div>`
    : '<p class="kt-note">사업보고서 \'사업의 내용\'에서 사전의 테마를 가리키는 근거 문장을 찾지 못했습니다.</p>'}`;
  if (!host.dataset.ktBound) {
    host.dataset.ktBound = "1";
    host.addEventListener("click", ktChipClick);
  }
}

function ktChipClick(ev) {
  const host = byId("stockThemes");
  if (!host) return;
  const more = ev.target.closest("[data-kt-more]");
  if (more) {
    host.querySelectorAll(".kt-chip[hidden]").forEach((b) => { b.hidden = false; });
    more.remove();
    return;
  }
  const open = ev.target.closest("[data-kt-open]");
  if (open) {
    openKrTheme(open.dataset.ktOpen);
    return;
  }
  const chip = ev.target.closest("[data-kt-chip]");
  if (!chip) return;
  const box = host.querySelector(".kt-chip-ev");
  if (!box) return;
  const id = chip.dataset.ktChip;
  const wasOpen = chip.getAttribute("aria-expanded") === "true";
  host.querySelectorAll("[data-kt-chip]").forEach((c) => { c.setAttribute("aria-expanded", "false"); c.classList.remove("is-active"); });
  if (wasOpen) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  chip.setAttribute("aria-expanded", "true");
  chip.classList.add("is-active");
  const ticker = host.dataset.ktTicker;
  const th = ktTheme(id);
  const m = th && (th.members || []).find((x) => x.t === ticker);
  const openBtn = `<button type="button" class="ghost compact-btn kt-open" data-kt-open="${escapeHtml(id)}">${escapeHtml(th ? th.name : "")} 테마 전체 보기 ›</button>`;
  box.hidden = false;
  if (ktSrc().market === "us") {
    box.innerHTML = `<p class="kt-meta">${ktByBadge("etf")}${ktEtfEvidenceHtml(m)}</p>${openBtn}`;
    return;
  }
  box.innerHTML = '<p class="muted">근거 문장 불러오는 중…</p>';
  ktLoadEvidence(th).then((evMap) => {
    if (host.dataset.ktTicker !== ticker || chip.getAttribute("aria-expanded") !== "true") return;
    const pair = evMap && evMap[ticker];
    box.innerHTML = `
      ${ktEvLine(pair, m) ? `<p class="kt-ev">${ktEvLine(pair, m)}</p>` : ""}
      <p class="kt-meta">${ktByBadge(m && m.by)}${ktSubBadge(m && m.sub)}<span>${ktSourceHtml(ticker)}</span></p>
      ${openBtn}`;
  });
}
