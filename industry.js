// industry.js — 산업·매크로 선행지표 탭 (#tab-industry, 시장 탭의 잎)
// =====================================================================
// 데이터는 build_industry_indicators.py 가 빌드 시 전부 계산해 둔 것(YoY·기간 등락·5년 통계·
// 동월 비교·신호등·다음 발표일)이고, 여기서는 그리기만 한다. 변환(YoY·100기준·드로다운·z)은
// 보이는 구간에 대한 가벼운 계산이라 브라우저에서 한다.
//
// 진입: index.html?tab=industry&i=<지표ID>&t=<변환>. 관련 종목 칩 → navigateToStockAnalysis.
// 데이터셋 4종은 lazy(feature-data.js) — 탭을 처음 열 때 받고, 도착하면 다시 그린다.
// 사이트 규칙: 장식 이모지 없음(기능 심볼 ▲▼✓✕만), KR 종목은 stockLabel(회사명 주 표기).
// 정직성(기획서 8장): 신호등은 증가율의 방향이지 주가 방향이 아니다. 검증되지 않은 '선행 N개월'
// 은 어디에도 싣지 않는다(sensitivity_validated 가 true 인 칩만 꼬리표를 단다 — 지금은 0개).

const INDUSTRY_RANGES = [["1Y", 365], ["3Y", 1096], ["5Y", 1827], ["10Y", 3653], ["MAX", null]];
const INDUSTRY_TRANSFORM_LABELS = { level: "레벨", yoy: "YoY %", mom: "MoM", rebase100: "100 기준", drawdown: "드로다운 %", zscore: "z-score" };
const INDUSTRY_DIRECTION_LABEL = { improving: "개선", deteriorating: "악화", flat: "보합", unknown: "판정 불가" };
const INDUSTRY_LEVEL_LABEL = { expanding: "확장", contracting: "수축" };
const INDUSTRY_PERF_LABELS = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "3Y"];

const industryState = { cat: null, ind: null, range: "5Y", transform: "level", overlay: "", band: false, recession: true, filter: "" };
const industryOverlayCache = {};
let industryPendingLoad = null;

function industryData() { return window.INDUSTRY_INDICATORS; }
function industryIndicator(id) { const d = industryData(); return d && d.indicators ? d.indicators[id] || null : null; }
function industryCategory(id) { const d = industryData(); return d ? (d.categories || []).find((c) => c.id === id) || null : null; }

// 딥링크(?i=&t=) — app.js boot 이 activateTab 전에 부른다.
function industryPreselect(id, transform) {
  if (id) industryState.ind = String(id);
  if (transform && INDUSTRY_TRANSFORM_LABELS[transform]) industryState.transform = transform;
}

// ---------------------------------------------------------------------------
// 포맷
// ---------------------------------------------------------------------------
function indFmtNum(v, digits = 2) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const d = abs >= 1000 ? 0 : abs >= 100 ? 1 : digits;
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function indFmtSigned(v, suffix = "%", digits = 2) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${indFmtNum(Math.abs(n), digits)}${suffix}`;
}
function indCls(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return "";
  return n > 0 ? "pos" : "neg";
}
function indArrow(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return "";
  return n > 0 ? "▲" : "▼";
}
function indDateLabel(key) {
  if (!key) return "";
  if (key.length === 7 && key[4] === "-" && key[5] !== "Q") return `${key.slice(0, 4)}년 ${Number(key.slice(5))}월`;
  if (key.includes("-Q")) return `${key.slice(0, 4)}년 ${key.slice(6)}분기`;
  return key;
}
function indDate(key) {
  if (!key) return null;
  if (key.includes("-Q")) return new Date(Number(key.slice(0, 4)), (Number(key.slice(6)) - 1) * 3, 1);
  if (key.length === 7) return new Date(Number(key.slice(0, 4)), Number(key.slice(5)) - 1, 1);
  return new Date(key);
}
function indTickerLabel(r) {
  const key = r.ticker || r.code;
  const known = typeof stockByTicker === "function" ? stockByTicker(key) : null;
  if (known && typeof stockLabel === "function") return stockLabel(known);
  if (r.market === "kr") return r.name || key;  // 미국 모드에서 국내 종목: 코드가 아니라 회사명
  return r.name ? `${key} ${r.name}` : key;
}
function indPanel(title, sub, body, extra = "") {
  return `<section class="industry-panel ${extra}"><div class="industry-panel-head"><h3>${escapeHtml(title)}</h3>${sub ? `<span class="muted">${sub}</span>` : ""}</div>${body}</section>`;
}

// ---------------------------------------------------------------------------
// 시리즈 변환 (보이는 구간)
// ---------------------------------------------------------------------------
function industrySlice(ind, rangeKey) {
  const series = Array.isArray(ind.series) ? ind.series : [];
  const days = (INDUSTRY_RANGES.find((r) => r[0] === rangeKey) || [])[1];
  if (!days || !series.length) return series;
  const last = indDate(series[series.length - 1].date);
  const cutoff = new Date(last.getTime() - days * 86400000);
  return series.filter((p) => indDate(p.date) >= cutoff);
}

// 일간·주간 시리즈는 점별 yoy 를 파일에 싣지 않는다(용량) — 364일 전 이하 최신값 대비로 여기서 계산한다.
// 월간·분기는 빌더가 실은 p.yoy 를 쓴다(같은 달 매칭).
function industryYoyOf(ind, points) {
  if (!points.length) return [];
  if (points.some((p) => p.yoy != null) || ind.regime_basis !== "yoy") return points.map((p) => (Number.isFinite(Number(p.yoy)) ? Number(p.yoy) : null));
  const full = Array.isArray(ind.series) ? ind.series : points;
  const keys = full.map((p) => indDate(p.date).getTime());
  const vals = full.map((p) => Number(p.val));
  return points.map((p) => {
    const target = indDate(p.date).getTime() - 364 * 86400000;
    let lo = 0, hi = keys.length - 1, best = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (keys[mid] <= target) { best = mid; lo = mid + 1; } else hi = mid - 1; }
    if (best < 0) return null;
    // 기준점이 목표일보다 두 달 넘게 앞이면(시리즈 시작 직후) 없는 것으로 본다.
    if (target - keys[best] > 62 * 86400000) return null;
    const base = vals[best], v = Number(p.val);
    if (!Number.isFinite(base) || base === 0 || (v < 0) !== (base < 0)) return null;
    return (v / base - 1) * 100;
  });
}

function industryTransform(ind, points, transform) {
  const vals = points.map((p) => Number(p.val));
  const diff = ind.perf_mode === "diff";
  if (transform === "yoy") return industryYoyOf(ind, points);
  if (transform === "mom") return vals.map((v, i) => (i === 0 || !Number.isFinite(vals[i - 1]) ? null : diff ? v - vals[i - 1] : vals[i - 1] === 0 ? null : (v / vals[i - 1] - 1) * 100));
  if (transform === "rebase100") { const base = vals.find((v) => Number.isFinite(v) && v !== 0); return vals.map((v) => (base ? v / base * 100 : null)); }
  if (transform === "drawdown") { let peak = -Infinity; return vals.map((v) => { peak = Math.max(peak, v); return peak > 0 ? (v / peak - 1) * 100 : null; }); }
  if (transform === "zscore") {
    const ok = vals.filter(Number.isFinite);
    const mean = ok.reduce((a, b) => a + b, 0) / (ok.length || 1);
    const sd = Math.sqrt(ok.reduce((a, b) => a + (b - mean) ** 2, 0) / (ok.length || 1));
    return vals.map((v) => (sd > 0 ? (v - mean) / sd : null));
  }
  return vals;
}

function industryTransformUnit(ind, transform) {
  if (transform === "level") return ind.unit || "";
  if (transform === "mom") return ind.perf_mode === "diff" ? (ind.unit || "") : "%";
  if (transform === "zscore") return "σ";
  if (transform === "rebase100") return "";
  return "%";
}

// ---------------------------------------------------------------------------
// SVG 차트 (막대 = 레벨, 선 = YoY 우축, 띠 = 침체, 점선 = ±σ, 보라 = 종목 100기준)
// ---------------------------------------------------------------------------
function industrySpark(vals, w = 140, h = 34) {
  const nums = vals.map(Number).filter(Number.isFinite);
  if (nums.length < 2) return "";
  const mn = Math.min(...nums), mx = Math.max(...nums);
  const span = mx - mn || 1;
  const x = (i) => 2 + (w - 4) * i / (nums.length - 1);
  const y = (v) => 2 + (h - 4) * (1 - (v - mn) / span);
  const d = nums.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const col = nums[nums.length - 1] >= nums[0] ? "var(--pos)" : "var(--neg)";
  return `<svg class="industry-spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><path d="${d}" fill="none" stroke="${col}" stroke-width="1.5"/></svg>`;
}

function industryChartSvg(ind, points, primary, { yoyLine = null, overlay = null, overlayLabel = "", band = false, recession = [], unit = "" } = {}) {
  const W = 880, H = 320, padL = 56, padR = 56, padT = 16, padB = 34;
  const n = points.length;
  if (n < 2) return '<p class="muted" style="padding:24px 0">그릴 점이 2개 미만입니다.</p>';
  const nums = primary.filter((v) => v != null && Number.isFinite(v));
  if (!nums.length) return '<p class="muted" style="padding:24px 0">이 변환은 이 구간에서 값이 없습니다.</p>';
  let mn = Math.min(...nums), mx = Math.max(...nums);
  let mean = null, sd = null;
  if (band) {
    mean = nums.reduce((a, b) => a + b, 0) / nums.length;
    sd = Math.sqrt(nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length);
    mn = Math.min(mn, mean - 2 * sd); mx = Math.max(mx, mean + 2 * sd);
  }
  const barMode = ind.frequency !== "D" && n <= 140;
  if (barMode && mn > 0 && industryState.transform === "level") mn = 0;
  if (mn === mx) { mn -= 1; mx += 1; }
  const pad = (mx - mn) * 0.06;
  mn -= pad; mx += pad;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const x = (i) => padL + innerW * (n === 1 ? 0.5 : i / (n - 1));
  const y = (v) => padT + innerH * (1 - (v - mn) / (mx - mn));
  const dates = points.map((p) => indDate(p.date));
  const parts = [];
  // 침체 음영
  if (recession && recession.length) {
    const t0 = dates[0].getTime(), t1 = dates[n - 1].getTime();
    recession.forEach((r) => {
      const s = indDate(r.start).getTime(), e = (r.end ? indDate(r.end) : dates[n - 1]).getTime();
      if (e < t0 || s > t1) return;
      const xs = padL + innerW * (Math.max(s, t0) - t0) / (t1 - t0 || 1);
      const xe = padL + innerW * (Math.min(e, t1) - t0) / (t1 - t0 || 1);
      parts.push(`<rect x="${xs.toFixed(1)}" y="${padT}" width="${Math.max(2, xe - xs).toFixed(1)}" height="${innerH}" fill="var(--muted)" opacity="0.14"/>`);
    });
  }
  // 격자 + 좌축
  for (let k = 0; k <= 4; k += 1) {
    const v = mn + (mx - mn) * k / 4;
    parts.push(`<line x1="${padL}" x2="${W - padR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="var(--line)" stroke-width="1"/>`);
    parts.push(`<text x="${padL - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" class="industry-axis">${indFmtNum(v, 2)}</text>`);
  }
  if (mn < 0 && mx > 0) parts.push(`<line x1="${padL}" x2="${W - padR}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 3"/>`);
  // σ 밴드
  if (band && sd > 0) {
    [[1, "0.45"], [2, "0.25"]].forEach(([k, op]) => {
      [mean + k * sd, mean - k * sd].forEach((v) => parts.push(`<line x1="${padL}" x2="${W - padR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="var(--accent)" stroke-opacity="${op}" stroke-dasharray="4 4"/>`));
    });
    parts.push(`<line x1="${padL}" x2="${W - padR}" y1="${y(mean).toFixed(1)}" y2="${y(mean).toFixed(1)}" stroke="var(--accent)" stroke-opacity="0.6"/>`);
  }
  // 본선
  if (barMode) {
    const bw = Math.max(2, innerW / n * 0.62);
    primary.forEach((v, i) => {
      if (v == null || !Number.isFinite(v)) return;
      const y0 = y(Math.max(mn, 0) > mn ? 0 : mn), y1 = y(v);
      const top = Math.min(y0, y1), hgt = Math.max(1, Math.abs(y0 - y1));
      const col = i === n - 1 ? "var(--primary)" : "color-mix(in srgb, var(--primary) 55%, transparent)";
      parts.push(`<rect x="${(x(i) - bw / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${hgt.toFixed(1)}" fill="${col}" rx="1"/>`);
    });
  } else {
    let d = "";
    primary.forEach((v, i) => { if (v == null || !Number.isFinite(v)) { d += " "; return; } d += `${d.endsWith(" ") || !d ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`; });
    parts.push(`<path d="${d.trim()}" fill="none" stroke="var(--primary)" stroke-width="1.8"/>`);
  }
  // 우축 선(YoY 또는 종목 100기준)
  const right = overlay ? overlay : yoyLine;
  const rightNums = right ? right.filter((v) => v != null && Number.isFinite(v)) : [];
  if (rightNums.length >= 2) {
    let rmn = Math.min(...rightNums), rmx = Math.max(...rightNums);
    if (!overlay) { rmn = Math.min(rmn, 0); rmx = Math.max(rmx, 0); }
    if (rmn === rmx) { rmn -= 1; rmx += 1; }
    const rp = (rmx - rmn) * 0.06; rmn -= rp; rmx += rp;
    const ry = (v) => padT + innerH * (1 - (v - rmn) / (rmx - rmn));
    let d = "";
    right.forEach((v, i) => { if (v == null || !Number.isFinite(v)) { d += " "; return; } d += `${d.endsWith(" ") || !d ? "M" : "L"}${x(i).toFixed(1)},${ry(v).toFixed(1)}`; });
    const col = overlay ? "var(--accent)" : "var(--red)";
    parts.push(`<path d="${d.trim()}" fill="none" stroke="${col}" stroke-width="1.6" ${overlay ? "" : 'stroke-dasharray="5 3"'}/>`);
    if (!overlay && rmn < 0 && rmx > 0) parts.push(`<line x1="${padL}" x2="${W - padR}" y1="${ry(0).toFixed(1)}" y2="${ry(0).toFixed(1)}" stroke="${col}" stroke-opacity="0.35" stroke-dasharray="2 4"/>`);
    for (let k = 0; k <= 4; k += 1) {
      const v = rmn + (rmx - rmn) * k / 4;
      parts.push(`<text x="${W - padR + 6}" y="${(ry(v) + 4).toFixed(1)}" text-anchor="start" class="industry-axis" fill="${col}">${indFmtNum(v, 1)}${overlay ? "" : "%"}</text>`);
    }
  }
  // x 축 날짜 5개
  const ticks = Math.min(6, n);
  for (let k = 0; k < ticks; k += 1) {
    const i = Math.round((n - 1) * k / (ticks - 1 || 1));
    const label = points[i].date.length >= 10 ? points[i].date.slice(0, 7) : points[i].date;
    parts.push(`<text x="${x(i).toFixed(1)}" y="${H - 10}" text-anchor="${k === 0 ? "start" : k === ticks - 1 ? "end" : "middle"}" class="industry-axis">${escapeHtml(label)}</text>`);
  }
  const legend = [
    `<span class="industry-legend-item"><i style="background:var(--primary)"></i>${escapeHtml(INDUSTRY_TRANSFORM_LABELS[industryState.transform] || "레벨")}${unit ? ` (${escapeHtml(unit)})` : ""}</span>`,
    rightNums.length >= 2 ? (overlay
      ? `<span class="industry-legend-item"><i style="background:var(--accent)"></i>${escapeHtml(overlayLabel)} 주가 100 기준 (우축)</span>`
      : `<span class="industry-legend-item"><i style="background:var(--red)"></i>YoY % (우축)</span>`) : "",
    band && sd > 0 ? `<span class="industry-legend-item"><i style="background:var(--accent);opacity:.6"></i>평균 ±1σ·±2σ</span>` : "",
    recession && recession.length ? `<span class="industry-legend-item"><i style="background:var(--muted);opacity:.35"></i>NBER 침체</span>` : "",
  ].filter(Boolean).join("");
  return `<svg class="industry-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(ind.name_kr)} 차트">${parts.join("")}</svg><div class="industry-legend">${legend}</div>`;
}

// ---------------------------------------------------------------------------
// 렌더 — 진입점
// ---------------------------------------------------------------------------
function renderIndustry() {
  const host = byId("tab-industry");
  if (!host) return;
  if (!industryData()) {
    if (!host.querySelector(".industry-loading")) host.innerHTML = '<div class="industry-loading"><p class="muted">산업 지표 데이터를 불러오는 중…</p></div>';
    if (!industryPendingLoad) {
      industryPendingLoad = ensureFeatureData("industry").then((ok) => {
        industryPendingLoad = null;
        if (ok) {
          ensureFeatureData("industrySignal").then(() => renderIndustry());
          ensureFeatureData("industryCalendar").then(() => renderIndustry());
          renderIndustry();
        } else {
          host.innerHTML = '<div class="industry-loading"><p class="muted">산업 지표 데이터를 불러오지 못했습니다. 잠시 뒤 다시 확인해 주세요.</p></div>';
        }
      });
    }
    return;
  }
  const d = industryData();
  if (industryState.ind && !industryIndicator(industryState.ind)) industryState.ind = null;
  if (industryState.ind && !industryState.cat) {
    const ind = industryIndicator(industryState.ind);
    industryState.cat = (ind.categories || [])[0] || null;
  }
  if (!industryState.cat) industryState.cat = (d.categories[0] || {}).id || null;
  let shell = host.querySelector(".industry-shell");
  if (!shell) {
    host.innerHTML = `
      <div class="industry-shell">
        <div class="industry-strip" id="industryCalendarStrip"></div>
        <div class="industry-body">
          <details class="industry-nav" id="industryNav" open>
            <summary class="industry-nav-summary"></summary>
            <div class="industry-nav-inner">
              <input type="search" class="industry-search" id="industrySearch" placeholder="지표명 · 티커 · 회사명" aria-label="지표 검색" autocomplete="off">
              <div class="industry-nav-list" id="industryNavList" role="tree"></div>
            </div>
          </details>
          <div class="industry-main" id="industryMain"></div>
        </div>
      </div>`;
    shell = host.querySelector(".industry-shell");
    const search = byId("industrySearch");
    search.addEventListener("input", () => { industryState.filter = search.value.trim().toLowerCase(); renderIndustryNav(); });
    const nav = byId("industryNav");
    if (window.matchMedia && window.matchMedia("(max-width: 720px)").matches) nav.removeAttribute("open");
  }
  renderIndustryStrip();
  renderIndustryNav();
  renderIndustryMain();
  industrySyncUrl();
}

function industrySyncUrl() {
  if (typeof currentTab === "undefined" || currentTab !== "industry") return;
  try {
    const url = new URL(location.href);
    url.searchParams.set("tab", "industry");
    if (industryState.ind) { url.searchParams.set("i", industryState.ind); url.searchParams.set("t", industryState.transform); }
    else { url.searchParams.delete("i"); url.searchParams.delete("t"); }
    history.replaceState(history.state, "", url.toString());
  } catch (_) { /* history 차단 환경 */ }
}

function industrySelect(id, { cat = null } = {}) {
  const ind = industryIndicator(id);
  if (!ind) return;
  industryState.ind = id;
  industryState.cat = cat && (ind.categories || []).includes(cat) ? cat : (ind.categories || [])[0];
  industryState.overlay = "";
  renderIndustryNav();
  renderIndustryMain();
  industrySyncUrl();
  const main = byId("industryMain");
  if (main && window.matchMedia && window.matchMedia("(max-width: 720px)").matches) {
    byId("industryNav")?.removeAttribute("open");
    main.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function industrySelectCategory(catId) {
  industryState.cat = catId;
  industryState.ind = null;
  renderIndustryNav();
  renderIndustryMain();
  industrySyncUrl();
}

// 외부(종목 상세 역방향 위젯·홈 카드)에서 지표로 바로 들어올 때.
function openIndustryIndicator(id) {
  industryPreselect(id);
  industryState.cat = null;
  activateTab("industry");
  renderIndustry();
}

// ---------------------------------------------------------------------------
// 상단 스트립 — 향후 7일 발표
// ---------------------------------------------------------------------------
function renderIndustryStrip() {
  const host = byId("industryCalendarStrip");
  if (!host) return;
  const cal = window.INDUSTRY_CALENDAR;
  const events = cal && Array.isArray(cal.events) ? cal.events.filter((e) => e.days_ahead <= 7) : [];
  if (!events.length) { host.innerHTML = ""; host.hidden = true; return; }
  host.hidden = false;
  host.innerHTML = `<span class="industry-strip-label">이번 주 발표</span>${events.slice(0, 10).map((e) => {
    const dday = e.days_ahead === 0 ? "D-0" : `D-${e.days_ahead}`;
    return `<button type="button" class="industry-strip-chip" data-ind="${escapeHtml(e.id)}" title="${escapeHtml(e.note || "")}"><b>${dday}</b> ${escapeHtml(e.name_kr)} <span class="muted">${escapeHtml(e.date.slice(5))}${e.time_kst ? ` ${escapeHtml(e.time_kst)}` : ""}</span></button>`;
  }).join("")}`;
  host.querySelectorAll("[data-ind]").forEach((b) => b.addEventListener("click", () => industrySelect(b.dataset.ind)));
}

// ---------------------------------------------------------------------------
// 좌측 내비
// ---------------------------------------------------------------------------
function industrySignalFor(catId) {
  const sig = window.INDUSTRY_SIGNAL;
  const row = sig && Array.isArray(sig.categories) ? sig.categories.find((c) => c.id === catId) : null;
  if (row) return row;
  const cat = industryCategory(catId);
  const counts = { improving: 0, deteriorating: 0, flat: 0, unknown: 0 };
  (cat ? cat.indicators : []).forEach((id) => { const r = (industryIndicator(id) || {}).regime || {}; counts[r.direction in counts ? r.direction : "unknown"] += 1; });
  return counts;
}

function industryMatchesFilter(ind, q) {
  if (!q) return true;
  const hay = [ind.id, ind.name_kr, ind.name_en, ind.source_series_id,
    ...(ind.related_tickers || []).flatMap((r) => [r.ticker || r.code, r.name || "", (typeof stockByTicker === "function" && stockByTicker(r.ticker || r.code) || {}).company || ""])]
    .join(" ").toLowerCase();
  return q.split(/\s+/).every((w) => hay.includes(w));
}

function renderIndustryNav() {
  const list = byId("industryNavList");
  const summary = document.querySelector("#industryNav .industry-nav-summary");
  if (!list) return;
  const d = industryData();
  const q = industryState.filter;
  const cur = industryState.ind ? industryIndicator(industryState.ind) : null;
  const curCat = industryCategory(industryState.cat);
  if (summary) summary.innerHTML = `<span>지표 목록</span><span class="muted">${escapeHtml(cur ? cur.name_kr : curCat ? curCat.name : "")}</span>`;
  list.innerHTML = d.categories.map((cat) => {
    const inds = cat.indicators.map(industryIndicator).filter(Boolean).filter((i) => industryMatchesFilter(i, q));
    if (q && !inds.length) return "";
    const sig = industrySignalFor(cat.id);
    const open = q ? true : cat.id === industryState.cat;
    const items = inds.map((ind) => {
      const active = ind.id === industryState.ind;
      const yoy = ind.regime_basis === "yoy" ? ind.latest_yoy : null;
      const dir = (ind.regime || {}).direction;
      return `<button type="button" role="treeitem" class="industry-nav-item${active ? " is-active" : ""}" data-ind="${escapeHtml(ind.id)}" data-cat="${escapeHtml(cat.id)}" aria-selected="${active}">
        <span class="industry-nav-dot industry-dir-${escapeHtml(dir || "unknown")}" title="${escapeHtml(INDUSTRY_DIRECTION_LABEL[dir] || "")}"></span>
        <span class="industry-nav-name">${escapeHtml(ind.name_kr)}</span>
        <span class="industry-nav-val ${indCls(yoy)}">${yoy != null ? indFmtSigned(yoy, "%", 1) : indFmtNum(ind.latest_value)}</span>
      </button>`;
    }).join("");
    return `<div class="industry-nav-cat${open ? " is-open" : ""}${cat.id === industryState.cat ? " is-current" : ""}" data-cat="${escapeHtml(cat.id)}">
      <button type="button" class="industry-nav-cat-head" data-cat="${escapeHtml(cat.id)}" aria-expanded="${open}">
        <span class="industry-nav-cat-name">${escapeHtml(cat.name)}</span>
        <span class="industry-nav-counts" title="개선 / 악화 / 보합 (증가율의 방향)"><b class="pos">${sig.improving}</b><span>/</span><b class="neg">${sig.deteriorating}</b><span>/</span><b>${sig.flat}</b></span>
      </button>
      <div class="industry-nav-items" role="group"${open ? "" : " hidden"}>${items}</div>
    </div>`;
  }).join("") || '<p class="muted" style="padding:8px 4px">일치하는 지표가 없습니다.</p>';
  list.querySelectorAll(".industry-nav-cat-head").forEach((b) => b.addEventListener("click", () => industrySelectCategory(b.dataset.cat)));
  list.querySelectorAll(".industry-nav-item").forEach((b) => b.addEventListener("click", () => industrySelect(b.dataset.ind, { cat: b.dataset.cat })));
  const activeItem = list.querySelector(".industry-nav-item.is-active");
  if (activeItem && typeof activeItem.scrollIntoView === "function") activeItem.scrollIntoView({ block: "nearest" });
}

// ---------------------------------------------------------------------------
// 본문 — 카테고리 홈 / 지표 상세
// ---------------------------------------------------------------------------
function renderIndustryMain() {
  const main = byId("industryMain");
  if (!main) return;
  if (industryState.ind) renderIndustryDetail(main, industryIndicator(industryState.ind));
  else renderIndustryCategoryHome(main, industryCategory(industryState.cat));
}

// 8.1 통과 쌍의 꼬리표: "2주 선행 · ρ 0.46 (표본외 n=150 · 95% 구간 0.18~0.67)". 점추정만 쓰지 않는다.
function industrySensTail(s) {
  const lag = s.lag_months != null ? `${s.lag_months}개월` : `${s.lag_weeks}주`;
  const ci = Array.isArray(s.ci95) && s.ci95.length === 2 ? ` · 95% 구간 ${Number(s.ci95[0]).toFixed(2)}~${Number(s.ci95[1]).toFixed(2)}` : "";
  return `${lag} 선행 · ρ ${Number(s.oos_rho).toFixed(2)} (표본외 n=${s.oos_n}${ci})`;
}

function industryTickerChip(r, extraCls = "") {
  const key = r.ticker || r.code;
  return `<button type="button" class="industry-chip ${extraCls}" data-ticker="${escapeHtml(key)}" data-market="${escapeHtml(r.market || "us")}" title="${escapeHtml(r.role || "")}">${escapeHtml(indTickerLabel(r))}${r.sensitivity && r.sensitivity.validated ? `<span class="industry-chip-tail">${escapeHtml(industrySensTail(r.sensitivity))}</span>` : ""}</button>`;
}

function industryBindTickerChips(root) {
  root.querySelectorAll(".industry-chip[data-ticker]").forEach((b) => {
    b.addEventListener("click", () => industryGoToStock(b.dataset.ticker, b.dataset.market));
  });
}

async function industryGoToStock(ticker, market) {
  const ind = industryState.ind ? industryIndicator(industryState.ind) : null;
  const query = ind
    ? `${ind.name_kr} 최신값 ${indFmtNum(ind.latest_value)} ${ind.unit || ""}(${indDateLabel(ind.latest_date)}${ind.latest_yoy != null ? `, 전년비 ${indFmtSigned(ind.latest_yoy, "%", 1)}` : ""})이 이 종목에 갖는 의미`
    : null;
  const cur = typeof marketCfg === "function" ? marketCfg().id : "us";
  if (market && market !== cur && typeof switchMarketMode === "function") {
    await switchMarketMode(market);
  }
  if (typeof navigateToStockAnalysis === "function") navigateToStockAnalysis(ticker, query, { animate: false });
}

function renderIndustryCategoryHome(main, cat) {
  if (!cat) { main.innerHTML = '<p class="muted">카테고리를 고르세요.</p>'; return; }
  const inds = cat.indicators.map(industryIndicator).filter(Boolean);
  const sig = industrySignalFor(cat.id);
  const byRecent = inds.slice().sort((a, b) => String(b.latest_date).localeCompare(String(a.latest_date)));
  const top = byRecent.slice(0, 3);
  const cards = top.map((ind) => `
    <button type="button" class="industry-card" data-ind="${escapeHtml(ind.id)}">
      <div class="industry-card-name">${escapeHtml(ind.name_kr)}</div>
      <div class="industry-card-val"><b>${indFmtNum(ind.latest_value)}</b><span class="muted">${escapeHtml(ind.unit || "")}</span></div>
      <div class="industry-card-sub">${escapeHtml(indDateLabel(ind.latest_date))}${ind.latest_yoy != null ? ` · 전년비 <span class="${indCls(ind.latest_yoy)}">${indFmtSigned(ind.latest_yoy, "%", 1)}</span>` : ind.latest_mom != null ? ` · 직전 대비 <span class="${indCls(ind.latest_mom)}">${indFmtSigned(ind.latest_mom, industryTransformUnit(ind, "mom"), 2)}</span>` : ""}</div>
      ${industrySpark((ind.series || []).slice(-24).map((p) => p.val), 220, 36)}
      <div class="industry-card-regime industry-dir-${escapeHtml((ind.regime || {}).direction || "unknown")}">${escapeHtml(INDUSTRY_DIRECTION_LABEL[(ind.regime || {}).direction] || "")}${(ind.regime || {}).level ? ` · ${escapeHtml(INDUSTRY_LEVEL_LABEL[ind.regime.level])}` : ""}</div>
    </button>`).join("");
  const chain = (cat.chain || []).map((s) => `<div class="industry-chain-stage"><span class="industry-chain-label">${escapeHtml(s.stage)}</span>${s.members.map((t) => industryTickerChip({ ticker: /^\d{6}$/.test(t) ? undefined : t, code: /^\d{6}$/.test(t) ? t : undefined, market: /^\d{6}$/.test(t) ? "kr" : "us", name: industryNameOf(t) }, "industry-chip-sm")).join("")}</div>`).join('<span class="industry-chain-arrow">→</span>');
  const etfs = (cat.sector_etfs || []).map((e) => `<button type="button" class="industry-chip industry-chip-etf" data-etf="${escapeHtml(e)}">${escapeHtml(e)}</button>`).join("");
  const rows = inds.map((ind) => `<tr data-ind="${escapeHtml(ind.id)}" tabindex="0" role="button">
      <td><span class="industry-nav-dot industry-dir-${escapeHtml((ind.regime || {}).direction || "unknown")}"></span>${escapeHtml(ind.name_kr)}</td>
      <td class="num">${indFmtNum(ind.latest_value)} <span class="muted">${escapeHtml(ind.unit || "")}</span></td>
      <td class="num ${indCls(ind.latest_yoy)}">${ind.latest_yoy != null ? indFmtSigned(ind.latest_yoy, "%", 1) : "—"}</td>
      <td class="num muted">${escapeHtml(ind.latest_date)}</td>
      <td class="num">${ind.next_release ? `D-${ind.next_release.days_ahead}` : "—"}</td>
    </tr>`).join("");
  main.innerHTML = `
    <div class="industry-home-head">
      <h2>${escapeHtml(cat.name)}</h2>
      <div class="industry-signal-line">신호등 <b class="pos">개선 ${sig.improving}</b> · <b class="neg">악화 ${sig.deteriorating}</b> · <b>보합 ${sig.flat}</b>${sig.unknown ? ` · <span class="muted">판정 불가 ${sig.unknown}</span>` : ""}<span class="muted industry-signal-note">증가율의 방향(YoY 3개월 평균의 3개월 변화)이며 주가 방향이 아닙니다.</span></div>
    </div>
    ${indPanel("최근 발표 지표 3", "", `<div class="industry-cards">${cards}</div>`)}
    ${chain ? indPanel("밸류체인", "종목을 누르면 분석으로 이동", `<div class="industry-chain">${chain}</div>`) : ""}
    ${etfs ? indPanel("관련 섹터 ETF", "섹터 탭으로", `<div class="industry-chips">${etfs}</div>`) : ""}
    ${indPanel("이 카테고리의 지표", `${inds.length}개`, `<div class="industry-table-wrap"><table class="industry-table" style="min-width:0"><thead><tr><th>지표</th><th class="num">최신</th><th class="num">전년비</th><th class="num">기준</th><th class="num">다음 발표</th></tr></thead><tbody>${rows}</tbody></table></div>`)}`;
  main.querySelectorAll("[data-ind]").forEach((el) => {
    const go = () => industrySelect(el.dataset.ind, { cat: cat.id });
    el.addEventListener("click", go);
    if (el.tagName === "TR") el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
  });
  main.querySelectorAll("[data-etf]").forEach((b) => b.addEventListener("click", () => {
    if (typeof selectedSectorEtf !== "undefined") { try { selectedSectorEtf = b.dataset.etf; } catch (_) { /* const */ } }
    activateTab("sector");
  }));
  industryBindTickerChips(main);
}

function industryNameOf(key) {
  const d = industryData();
  if (!d) return "";
  for (const ind of Object.values(d.indicators || {})) {
    const r = (ind.related_tickers || []).find((x) => (x.ticker || x.code) === key);
    if (r && r.name) return r.name;
  }
  return "";
}

function industryInterpretation(ind) {
  const parts = [`${indDateLabel(ind.latest_date)} 값은 ${indFmtNum(ind.latest_value)}${ind.unit ? ` ${ind.unit}` : ""}`];
  if (ind.latest_yoy != null) parts.push(`전년 같은 달 대비 ${indFmtSigned(ind.latest_yoy, "%", 1)}`);
  else if (ind.latest_mom != null) parts.push(`직전 대비 ${indFmtSigned(ind.latest_mom, industryTransformUnit(ind, "mom"), 2)}`);
  if (ind.seasonal) parts.push(`같은 달 5년 평균 전년비(${indFmtSigned(ind.seasonal.same_month_yoy_avg, "%", 1)})를 ${ind.seasonal.verdict === "above" ? "웃돈다" : "밑돈다"}`);
  if (ind.stats && ind.stats.percentile != null) parts.push(`최근 ${ind.stats.window_years}년 분포의 ${Math.round(ind.stats.percentile * 100)}번째 백분위`);
  if (ind.next_release) parts.push(`다음 발표는 ${ind.next_release.date.slice(5).replace("-", "/")}(D-${ind.next_release.days_ahead})`);
  return parts.join(", ") + ".";
}

function renderIndustryDetail(main, ind) {
  if (!ind) { renderIndustryCategoryHome(main, industryCategory(industryState.cat)); return; }
  const d = industryData();
  const reg = ind.regime || {};
  const canCsv = ind.license && ["attribution", "public"].includes(ind.license.redistribution);
  const curMarket = typeof marketCfg === "function" ? marketCfg().id : "us";
  const overlayChoices = (ind.related_tickers || []).filter((r) => (r.market || "us") === curMarket);
  const rangeBtns = INDUSTRY_RANGES.map(([k]) => `<button type="button" class="industry-seg-btn${industryState.range === k ? " is-active" : ""}" data-range="${k}">${k === "MAX" ? "전체" : k}</button>`).join("");
  const transformOpts = (ind.transforms_available || ["level"]).map((t) => `<option value="${t}"${industryState.transform === t ? " selected" : ""}>${escapeHtml(INDUSTRY_TRANSFORM_LABELS[t] || t)}</option>`).join("");
  const perf = ind.performance || {};
  const perfCells = INDUSTRY_PERF_LABELS.map((k) => {
    const v = perf[k];
    const txt = v == null ? "—" : ind.perf_mode === "diff" ? indFmtSigned(v, "", 2) : indFmtSigned(v, "%", 1);
    return `<div class="industry-perf-cell"><span class="muted">${k}</span><b class="${v == null ? "muted" : indCls(v)}">${txt}</b></div>`;
  }).join("");
  const related = (ind.related_tickers || []).map((r) => industryTickerChip(r)).join("");
  const relatedInd = (ind.related_indicators || []).map(industryIndicator).filter(Boolean).map((r) => `<button type="button" class="industry-chip industry-chip-ind" data-ind="${escapeHtml(r.id)}">${escapeHtml(r.name_kr)}</button>`).join("");
  const stats = ind.stats;
  const sea = ind.seasonal;
  const badge = (txt, cls = "") => `<span class="industry-badge ${cls}">${escapeHtml(txt)}</span>`;
  main.innerHTML = `
    <div class="industry-detail-head">
      <div class="industry-detail-crumb"><button type="button" class="industry-crumb" data-cat="${escapeHtml(industryState.cat)}">${escapeHtml((industryCategory(industryState.cat) || {}).name || "")}</button><span class="muted">›</span><span>${escapeHtml(ind.name_kr)}</span></div>
      <h2>${escapeHtml(ind.name_kr)}${ind.proxy ? badge("프록시", "industry-badge-proxy") : ""}</h2>
      <div class="industry-detail-en muted">${escapeHtml(ind.name_en || "")}</div>
      <div class="industry-detail-meta">
        ${badge(`등급 ${ind.grade || "A"}`)} ${badge(`${ind.frequency === "D" ? "일간" : ind.frequency === "W" ? "주간" : ind.frequency === "Q" ? "분기" : "월간"}`)}
        <a href="${escapeHtml(ind.source_url || "#")}" target="_blank" rel="noopener" class="industry-source-link">출처 ${escapeHtml(ind.source || "")}</a>
        ${ind.source_series_id ? `<span class="muted">· ${escapeHtml(ind.source_series_id)}</span>` : ""}
      </div>
    </div>
    <div class="industry-headline">
      <div class="industry-headline-main"><b>${indFmtNum(ind.latest_value)}</b><span class="industry-headline-unit">${escapeHtml(ind.unit || "")}</span><span class="muted">${escapeHtml(indDateLabel(ind.latest_date))}</span></div>
      <div class="industry-headline-stats">
        ${ind.latest_mom != null ? `<span>${ind.frequency === "D" ? "전일" : ind.frequency === "W" ? "전주" : ind.frequency === "Q" ? "전분기" : "전월"}비 <b class="${indCls(ind.latest_mom)}">${indArrow(ind.latest_mom)} ${indFmtSigned(ind.latest_mom, industryTransformUnit(ind, "mom"), 2)}</b></span>` : ""}
        ${ind.latest_yoy != null ? `<span>전년비 <b class="${indCls(ind.latest_yoy)}">${indArrow(ind.latest_yoy)} ${indFmtSigned(ind.latest_yoy, "%", 1)}</b></span>` : ""}
        ${stats && stats.percentile != null ? `<span>${stats.window_years}년 백분위 <b>${Math.round(stats.percentile * 100)}%</b></span>` : ""}
        ${stats && stats.zscore != null ? `<span>z <b>${indFmtSigned(stats.zscore, "", 2)}</b></span>` : ""}
        <span>신호등 <b class="industry-dir-text industry-dir-${escapeHtml(reg.direction || "unknown")}">${escapeHtml(INDUSTRY_DIRECTION_LABEL[reg.direction] || "")}</b>${reg.level ? ` <span class="muted">(${escapeHtml(INDUSTRY_LEVEL_LABEL[reg.level])}${reg.streak_months ? ` · ${reg.streak_months}개월째` : ""})</span>` : ""}</span>
        ${ind.next_release ? `<span>다음 발표 <b>${escapeHtml(ind.next_release.date.slice(5).replace("-", "/"))}${ind.next_release.time_kst ? ` ${escapeHtml(ind.next_release.time_kst)}` : ""}</b> <span class="muted">(D-${ind.next_release.days_ahead})</span></span>` : ""}
        ${ind.carriedSince ? `<span class="industry-badge industry-badge-warn">직전 값 유지 중 (${escapeHtml(ind.carriedSince)}~)</span>` : ""}
      </div>
    </div>
    <div class="industry-controls">
      <div class="industry-seg" role="group" aria-label="기간">${rangeBtns}</div>
      <label class="industry-ctl">변환 <select id="industryTransform">${transformOpts}</select></label>
      ${overlayChoices.length ? `<label class="industry-ctl">겹치기 <select id="industryOverlay"><option value="">없음</option>${overlayChoices.map((r) => `<option value="${escapeHtml(r.ticker || r.code)}"${industryState.overlay === (r.ticker || r.code) ? " selected" : ""}>${escapeHtml(indTickerLabel(r))}</option>`).join("")}</select></label>` : ""}
      <label class="industry-ctl industry-check"><input type="checkbox" id="industryBand"${industryState.band ? " checked" : ""}> ±σ 밴드</label>
      ${d.recession && d.recession.length ? `<label class="industry-ctl industry-check"><input type="checkbox" id="industryRecession"${industryState.recession ? " checked" : ""}> 침체 음영</label>` : ""}
      <span class="industry-ctl-spacer"></span>
      ${canCsv ? `<button type="button" class="ghost compact-btn" id="industryCsv">CSV</button>` : `<span class="muted industry-nocsv" title="${escapeHtml((ind.license || {}).note || "")}">CSV 없음(라이선스)</span>`}
      <button type="button" class="ghost compact-btn" id="industryLink">링크 복사</button>
    </div>
    <div class="industry-chart" id="industryChart"></div>
    ${indPanel("기간별 등락", ind.perf_mode === "diff" ? "단위 차이(레벨 지표)" : "변화율", `<div class="industry-perf">${perfCells}</div><p class="muted industry-foot">주기보다 짧은 칸(월간 지표의 1D·1W 등)과 기준점이 성긴 칸은 비워 둡니다.</p>`)}
    ${sea ? indPanel("동월 비교", `${sea.month}월 전년비`, `<div class="industry-seasonal"><div><span class="muted">${sea.years}년 평균</span><b>${indFmtSigned(sea.same_month_yoy_avg, "%", 1)}</b></div><div><span class="muted">올해</span><b class="${indCls(sea.this_year_yoy)}">${indFmtSigned(sea.this_year_yoy, "%", 1)}</b></div><div><span class="muted">판정</span><b>${sea.verdict === "above" ? "평년보다 강함" : "평년보다 약함"}</b></div></div>`) : ""}
    ${stats ? indPanel(`${stats.window_years}년 통계`, `${stats.n}개 관측`, `<div class="industry-seasonal"><div><span class="muted">평균</span><b>${indFmtNum(stats.mean)}</b></div><div><span class="muted">표준편차</span><b>${indFmtNum(stats.sd)}</b></div><div><span class="muted">최소</span><b>${indFmtNum(stats.min.val)}</b><span class="muted">${escapeHtml(stats.min.date)}</span></div><div><span class="muted">최대</span><b>${indFmtNum(stats.max.val)}</b><span class="muted">${escapeHtml(stats.max.date)}</span></div></div>`) : ""}
    ${related ? indPanel("관련 상장사", "누르면 종목 분석으로", `<div class="industry-chips">${related}</div><p class="muted industry-foot">검증된 선행 상관이 있는 종목만 꼬리표가 붙습니다. 꼬리표가 없다고 상관이 없다는 뜻은 아닙니다(검증 미통과 또는 표본 부족).${d.sensitivity_summary ? ` 전체 ${d.sensitivity_summary.tested}쌍 검사 · ${d.sensitivity_summary.validated}쌍 통과 · 표본 부족 ${d.sensitivity_summary.insufficient}.` : ""}</p><details class="industry-method"><summary>검증 방법</summary><p class="muted industry-foot">겹치지 않는 구간의 변화율로 섹터 대비 초과수익과의 상관을 보고, 표본 밖 기간에서 한 번만 검정합니다. 블록 부트스트랩으로 신뢰구간을 구하고, 여러 쌍을 동시에 본 데 따른 우연은 FDR 10%로 걸러 냅니다.</p></details>`) : ""}
    ${relatedInd ? indPanel("같이 보는 지표", "", `<div class="industry-chips">${relatedInd}</div>`) : ""}
    ${indPanel("해석", "사실 요소만", `<p class="industry-interp">${escapeHtml(industryInterpretation(ind))}</p>${ind.note ? `<p class="muted industry-foot">${escapeHtml(ind.note)}</p>` : ""}`)}
    <p class="muted industry-foot">출처 ${escapeHtml(ind.source || "")}${ind.license && ind.license.note ? ` · ${escapeHtml(ind.license.note)}` : ""} · 갱신 ${escapeHtml(d.updatedAtKst || "")}</p>`;
  main.querySelector(".industry-crumb")?.addEventListener("click", (e) => industrySelectCategory(e.currentTarget.dataset.cat));
  main.querySelectorAll("[data-range]").forEach((b) => b.addEventListener("click", () => { industryState.range = b.dataset.range; main.querySelectorAll("[data-range]").forEach((x) => x.classList.toggle("is-active", x === b)); renderIndustryChart(ind); }));
  byId("industryTransform")?.addEventListener("change", (e) => { industryState.transform = e.target.value; renderIndustryChart(ind); industrySyncUrl(); });
  byId("industryOverlay")?.addEventListener("change", (e) => { industryState.overlay = e.target.value; renderIndustryChart(ind); });
  byId("industryBand")?.addEventListener("change", (e) => { industryState.band = e.target.checked; renderIndustryChart(ind); });
  byId("industryRecession")?.addEventListener("change", (e) => { industryState.recession = e.target.checked; renderIndustryChart(ind); });
  byId("industryCsv")?.addEventListener("click", () => industryDownloadCsv(ind));
  byId("industryLink")?.addEventListener("click", () => {
    const url = `${location.origin}${location.pathname}?tab=industry&i=${encodeURIComponent(ind.id)}&t=${industryState.transform}`;
    const done = () => { if (typeof showAppToast === "function") showAppToast("지표 링크를 복사했습니다"); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => window.prompt("링크", url));
    else window.prompt("링크", url);
  });
  main.querySelectorAll(".industry-chip-ind").forEach((b) => b.addEventListener("click", () => industrySelect(b.dataset.ind)));
  industryBindTickerChips(main);
  // 첫 진입은 헤더·등락표를 먼저 그리고 차트는 유휴 시간에.
  const draw = () => renderIndustryChart(ind);
  if (typeof requestIdleCallback === "function") requestIdleCallback(draw, { timeout: 400 }); else setTimeout(draw, 0);
}

function renderIndustryChart(ind) {
  const host = byId("industryChart");
  if (!host || !ind) return;
  const d = industryData();
  const points = industrySlice(ind, industryState.range);
  const transform = (ind.transforms_available || ["level"]).includes(industryState.transform) ? industryState.transform : "level";
  const primary = industryTransform(ind, points, transform);
  const yoyLine = transform === "level" && ind.regime_basis === "yoy" ? industryYoyOf(ind, points) : null;
  const recession = industryState.recession && d.recession ? d.recession : [];
  const unit = industryTransformUnit(ind, transform);
  const draw = (overlay, overlayLabel) => {
    host.innerHTML = industryChartSvg(ind, points, primary, { yoyLine, overlay, overlayLabel, band: industryState.band, recession, unit });
  };
  if (!industryState.overlay) { draw(null, ""); return; }
  const ticker = industryState.overlay;
  const label = indTickerLabel((ind.related_tickers || []).find((r) => (r.ticker || r.code) === ticker) || { ticker });
  draw(null, "");
  industryOverlayCloses(ticker).then((closes) => {
    if (industryState.overlay !== ticker || industryState.ind !== ind.id) return;
    if (!closes || !closes.length) { if (typeof showAppToast === "function") showAppToast("이 종목의 일봉을 아직 받지 못했습니다"); return; }
    const keys = closes.map((c) => c[0]);
    const at = (dt) => { let lo = 0, hi = keys.length - 1, best = -1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (keys[mid] <= dt) { best = mid; lo = mid + 1; } else hi = mid - 1; } return best >= 0 ? closes[best][1] : null; };
    const raw = points.map((p) => at(p.date.length === 7 ? `${p.date}-31` : p.date.includes("-Q") ? `${p.date.slice(0, 4)}-${String(Number(p.date.slice(6)) * 3).padStart(2, "0")}-31` : p.date));
    const base = raw.find((v) => v != null && v > 0);
    const overlay = raw.map((v) => (v != null && base ? v / base * 100 : null));
    draw(overlay, label);
  });
}

function industryOverlayCloses(ticker) {
  if (industryOverlayCache[ticker]) return Promise.resolve(industryOverlayCache[ticker]);
  if (typeof loadStockDetail !== "function") return Promise.resolve(null);
  return loadStockDetail(ticker).then((detail) => {
    const rows = detail && Array.isArray(detail.chartSeries) ? detail.chartSeries : [];
    const closes = rows.map((r) => (Array.isArray(r) ? [String(r[5] || r[0]), Number(r[3])] : [String(r.date || r.t || ""), Number(r.c)]))
      .filter((c) => c[0].length >= 10 && Number.isFinite(c[1])).sort((a, b) => a[0].localeCompare(b[0]));
    industryOverlayCache[ticker] = closes;
    return closes;
  }).catch(() => null);
}

function industryDownloadCsv(ind) {
  const lines = [`# ${ind.name_kr} (${ind.name_en || ""}) · 출처: ${ind.source || ""} · ${(ind.license || {}).note || ""} · 단위: ${ind.unit || ""}`, "date,value,yoy_pct"];
  (ind.series || []).forEach((p) => lines.push(`${p.date},${p.val ?? ""},${p.yoy ?? ""}`));
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${ind.id}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
}

// ---------------------------------------------------------------------------
// 종목 상세 역방향 위젯 — "이 종목이 따라가는 산업 지표" (INDUSTRY_BY_TICKER 역인덱스)
// ---------------------------------------------------------------------------
// selectTicker 가 부르고, 데이터가 늦게 도착하면 refreshFeatureViews 가 다시 부른다(라이브에서
// 피처 전역이 패널 렌더보다 늦는 경합 — 등록하지 않으면 카드가 영영 안 뜬다).
function industryReverseIds(ticker) {
  const idx = window.INDUSTRY_BY_TICKER;
  return idx && idx.byTicker ? (idx.byTicker[ticker] || []) : [];
}

function industryReverseRow(id) {
  const ind = industryIndicator(id);
  if (!ind) return "";
  const tail = (ind.related_tickers || []).find((r) => r.sensitivity && r.sensitivity.validated);
  return `<button type="button" class="industry-rev-row" data-ind="${escapeHtml(id)}">
    <span class="industry-rev-name">${escapeHtml(ind.name_kr)}${tail ? `<span class="industry-chip-tail">${escapeHtml(industrySensTail(tail.sensitivity))}</span>` : ""}</span>
    <span class="industry-rev-val"><b>${indFmtNum(ind.latest_value)}</b><span class="muted">${escapeHtml(ind.unit || "")}</span></span>
    <span class="industry-rev-yoy ${indCls(ind.latest_yoy)}">${ind.latest_yoy != null ? indFmtSigned(ind.latest_yoy, "%", 1) : (ind.latest_mom != null ? indFmtSigned(ind.latest_mom, industryTransformUnit(ind, "mom"), 2) : "—")}</span>
    ${industrySpark((ind.series || []).slice(-12).map((p) => p.val), 96, 26)}
    <span class="industry-rev-next muted">${ind.next_release ? `D-${ind.next_release.days_ahead}` : escapeHtml(ind.latest_date)}</span>
  </button>`;
}

function renderIndustryReverse(item) {
  const host = byId("industryReverse");
  if (!host) return;
  const ticker = item && item.ticker;
  if (!ticker) { host.hidden = true; host.innerHTML = ""; return; }
  const ready = !!(window.INDUSTRY_BY_TICKER && industryData());
  if (!ready) {
    // 역인덱스(작음)를 먼저 받아 이 종목에 지표가 있는지 보고, 있을 때만 본체(750KB)를 받는다.
    ensureFeatureData("industryByTicker").then((ok) => {
      if (!ok || (typeof selectedTicker !== "undefined" && selectedTicker !== ticker)) return;
      if (!industryReverseIds(ticker).length) { host.hidden = true; host.innerHTML = ""; return; }
      host.hidden = false;
      host.innerHTML = '<h3>이 종목이 따라가는 산업 지표</h3><p class="muted">불러오는 중…</p>';
      ensureFeatureData("industry").then((ok2) => { if (ok2 && selectedTicker === ticker) renderIndustryReverse(item); });
    });
    return;
  }
  const ids = industryReverseIds(ticker);
  if (!ids.length) { host.hidden = true; host.innerHTML = ""; return; }
  host.hidden = false;
  host.innerHTML = `<h3>이 종목이 따라가는 산업 지표</h3>
    <div class="industry-rev-list">${ids.slice(0, 3).map(industryReverseRow).join("")}</div>
    <p class="muted industry-foot">관련 지표 ${ids.length}개 중 최근 발표 순 3개 · 누르면 산업 지표 탭으로 갑니다. 주가 방향을 뜻하지 않습니다.</p>`;
  host.querySelectorAll("[data-ind]").forEach((b) => b.addEventListener("click", () => openIndustryIndicator(b.dataset.ind)));
}

// AI 리포트 컨텍스트용 한 줄(chart-indicators.js buildStockChatContext 가 부른다).
function industryContextLine(ticker) {
  const ids = industryReverseIds(ticker).slice(0, 3);
  const parts = ids.map((id) => {
    const ind = industryIndicator(id);
    if (!ind) return null;
    const yoy = ind.latest_yoy != null ? `, 전년비 ${indFmtSigned(ind.latest_yoy, "%", 1)}` : "";
    const dir = INDUSTRY_DIRECTION_LABEL[(ind.regime || {}).direction] || "";
    return `${ind.name_kr} ${indFmtNum(ind.latest_value)}${ind.unit ? ind.unit : ""}(${ind.latest_date}${yoy}${dir ? `, 신호등 ${dir}` : ""})`;
  }).filter(Boolean);
  return parts.length ? `산업 선행지표(빌드 시 계산한 서술 통계, 주가 예측 아님): ${parts.join(" · ")}` : "";
}

// ---------------------------------------------------------------------------
// 홈(오늘 탭) 산업 신호등 카드 — INDUSTRY_SIGNAL · INDUSTRY_CALENDAR(둘 다 작다)
// ---------------------------------------------------------------------------
function renderIndustryHomeCard() {
  const host = byId("industryHomeCard");
  if (!host) return;
  const sig = window.INDUSTRY_SIGNAL;
  if (!sig || !Array.isArray(sig.categories)) {
    ensureFeatureData("industrySignal").then((ok) => { if (ok) renderIndustryHomeCard(); });
    ensureFeatureData("industryCalendar");
    return;
  }
  const cats = sig.categories;
  const up = cats.filter((c) => c.improving > c.deteriorating).length;
  const down = cats.filter((c) => c.deteriorating > c.improving).length;
  const cal = window.INDUSTRY_CALENDAR;
  const soon = cal && Array.isArray(cal.events) ? cal.events.filter((e) => e.days_ahead <= 7) : [];
  const tops = cats.flatMap((c) => (c.top || []).filter((t) => typeof t === "object")).sort((a, b) => String(b.latest_date).localeCompare(String(a.latest_date))).slice(0, 2);
  host.hidden = false;
  host.innerHTML = `
    <button type="button" class="industry-home-btn">
      <span class="industry-home-title">산업 신호등</span>
      <span class="industry-home-body"><b class="pos">개선 우세 ${up}</b> · <b class="neg">악화 우세 ${down}</b> <span class="muted">/ ${cats.length}개 카테고리</span>${soon.length ? ` · 이번 주 발표 ${soon.length}건` : ""}</span>
      ${tops.length ? `<span class="industry-home-tops">${tops.map((t) => `<span>${escapeHtml(t.name_kr)} <b class="${indCls(t.latest_yoy)}">${t.latest_yoy != null ? indFmtSigned(t.latest_yoy, "%", 1) : indFmtNum(t.latest_value)}</b></span>`).join("")}</span>` : ""}
      <span class="industry-home-go muted">산업 지표 탭 ›</span>
    </button>`;
  host.querySelector(".industry-home-btn").addEventListener("click", () => activateTab("industry"));
}

// ---------------------------------------------------------------------------
// 섹터 탭 — 섹터 ETF 카드 끝에 "선행지표 3개" 스트립 (renderSectors 끝에서 부른다)
// ---------------------------------------------------------------------------
function industryDecorateSectorCards() {
  const cards = document.querySelectorAll("#sectorList .sector-card[data-ticker]");
  if (!cards.length) return;
  const sig = window.INDUSTRY_SIGNAL;
  if (!sig || !Array.isArray(sig.categories)) {
    ensureFeatureData("industrySignal").then((ok) => { if (ok) industryDecorateSectorCards(); });
    return;
  }
  cards.forEach((card) => {
    if (card.querySelector(".industry-sector-strip")) return;
    const etf = card.dataset.ticker;
    const cats = sig.categories.filter((c) => (c.sector_etfs || []).includes(etf));
    const tops = cats.flatMap((c) => (c.top || []).filter((t) => typeof t === "object"));
    const seen = new Set();
    const picks = tops.filter((t) => !seen.has(t.id) && seen.add(t.id)).slice(0, 3);
    if (!picks.length) return;
    const strip = document.createElement("div");
    strip.className = "industry-sector-strip";
    strip.innerHTML = `<span class="industry-sector-label">선행지표</span>${picks.map((t) => `<button type="button" class="industry-sector-chip" data-ind="${escapeHtml(t.id)}"><span>${escapeHtml(t.name_kr)}</span><b class="${indCls(t.latest_yoy)}">${t.latest_yoy != null ? indFmtSigned(t.latest_yoy, "%", 1) : indFmtNum(t.latest_value)}</b></button>`).join("")}`;
    strip.querySelectorAll("[data-ind]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); openIndustryIndicator(b.dataset.ind); }));
    card.appendChild(strip);
  });
}
