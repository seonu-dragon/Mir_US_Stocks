// stock-summary.js — 종목 상세의 '한눈 요약' 카드(개요 탭 맨 위 #stockSummaryCard)와
// 가격 바로 아래 '오늘·임박 이벤트' 줄(좌측 패널 #stockEventStrip — 폰에서는 맨 위 요약 아래).
//
// 계산·문장은 stock-summary-core.js(window.MirStockSummary). 여기는 이미 받은 데이터를 모으고 그리기만 한다.
// 자료: 스냅샷 행(시총·업종) · 재무 파일(financials.js loadFinancials) · US 사업부문(segments.js loadSegments) ·
//       목표주가(KR_CONSENSUS / US_PRICE_TARGETS 샤드) · 통합 타임라인 항목(timeline.js tlDataFor) ·
//       실적·배당·보호예수 일정(US_STOCK_CALENDAR · KR_IR_SCHEDULE · KR_DIVIDENDS · KR_LOCKUPS).
// 새 데이터 파이프라인·LLM 없음. 피처 데이터는 패널보다 늦게 올 수 있어 refreshFeatureViews 가 다시 부르고,
// 종목별 파일(재무·부문·목표가 샤드)은 도착하면 여기서 직접 다시 그린다.
// 전역 이름은 ss 접두사(classic script 전역 공유).

const _ssTargets = new Map();   // US 티커 → 목표주가 샤드 항목 | null(없음)
let _ssBound = false;

function ssCore() { return window.MirStockSummary || null; }
function ssIsKr() { return typeof isKrMarket === "function" && isKrMarket(); }
function ssFeatureOn(key) {
  const cfg = typeof marketCfg === "function" ? marketCfg() : null;
  return !(cfg && cfg.features && cfg.features[key] === false);
}
function ssToday() {
  if (typeof formatKstDateTime === "function") return formatKstDateTime().slice(0, 10);
  return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
}
function ssSameTicker(ticker) {
  return typeof selectedTicker !== "undefined" && String(selectedTicker || "").toUpperCase() === String(ticker || "").toUpperCase();
}
function ssRerender(ticker) {
  if (!ssSameTicker(ticker) || typeof selectedBaseRow !== "function") return;
  const base = selectedBaseRow();
  if (!base) return;
  const item = typeof applyLive === "function" && typeof withDetail === "function" ? applyLive(withDetail(base)) : base;
  renderStockSummary(item);
  renderStockEventStrip(item);
}

// 타임라인 항목(최신순). timeline.js 가 원자료 참조가 같으면 캐시를 돌려준다.
function ssTimelineItems(item) {
  if (typeof tlDataFor !== "function" || !item || item.__liveStub) return [];
  try { return tlDataFor(item).items || []; } catch (_) { return []; }
}

function ssMarketCap(item) {
  const n = (v) => (v === null || v === undefined || v === "" ? null : (Number.isFinite(Number(v)) ? Number(v) : null));
  if (ssIsKr()) {
    const t = n(item.marketCapT) ?? n(item.marketCapB);
    return t !== null && t > 0 ? t * 1e12 : null;
  }
  const b = n(item.marketCapB) ?? n(item.fundamentals && item.fundamentals.marketCapB);
  return b !== null && b > 0 ? b * 1e9 : null;
}

function ssSectorText(item) {
  if (ssIsKr()) return String(item.industry || item.sector || "").trim();
  const ko = typeof sectorLabelKo === "function" ? sectorLabelKo(item.sector) : "";
  // 번역이 없으면(영문 그대로) 문장에 넣지 않는다.
  return ko && /[가-힣]/.test(ko) ? `${ko} 섹터` : "";
}

// ── 종목별 파일: 있으면 동기 값, 없으면 받으러 가고 도착하면 다시 그린다 ─────────
function ssFinancials(item) {
  if (typeof financialsCached !== "function" || typeof loadFinancials !== "function") return null;
  const f = financialsCached(item.ticker);
  if (f === undefined) {
    const t = item.ticker;
    loadFinancials(t).then((doc) => { if (doc) ssRerender(t); });
    return null;
  }
  return f || null;
}

function ssSegments(item) {
  if (ssIsKr() || typeof segmentsCached !== "function" || !window.MirSegmentsCore) return null;
  const f = segmentsCached(item.ticker);
  if (f === undefined) {
    const t = item.ticker;
    if (typeof loadSegments === "function") loadSegments(t).then((doc) => { if (doc) ssRerender(t); });
    return null;
  }
  if (!f) return null;
  const core = window.MirSegmentsCore;
  if (!core.availableAxes(f).includes("segment")) return null;
  const view = core.axisView(f, "segment", { maxMembers: 5 });
  if (!view) return null;
  const filing = (f.filings || [])[0] || {};
  return { rows: view.rows, fy: view.latestFy, end: filing.end || null, form: filing.form || "10-K" };
}

function ssConsensus(item) {
  if (ssIsKr()) {
    const c = window.KR_CONSENSUS && window.KR_CONSENSUS.stocks ? window.KR_CONSENSUS.stocks[item.ticker] : null;
    if (!c) return null;
    return {
      kind: "kr", target: c.targetPrice, count: c.estimateCount,
      asOf: window.KR_CONSENSUS.asOf || c.lastReportDate || "", source: "FnGuide 컨센서스(네이버 금융)",
    };
  }
  if (item.__liveStub || typeof ciLoadTargets !== "function") return null;
  const key = String(item.ticker || "").toUpperCase();
  if (_ssTargets.has(key)) {
    const t = _ssTargets.get(key);
    return t ? { kind: "us", avg: t.avg, lo: t.lo, hi: t.hi, n: t.n, asOf: t.asOf, source: t.src === "yahoo" ? "Yahoo Finance" : "Nasdaq" } : null;
  }
  const ready = window.US_PRICE_TARGETS_INDEX
    ? Promise.resolve(true)
    : (typeof ensureFeatureData === "function" ? ensureFeatureData("usPriceTargets") : Promise.resolve(false));
  _ssTargets.set(key, null); // 받는 동안 다시 요청하지 않게(도착하면 덮어쓴다)
  ready.then((ok) => (ok ? ciLoadTargets(key) : null)).then((t) => {
    if (!t) return;
    _ssTargets.set(key, t);
    ssRerender(key);
  }).catch(() => {});
  return null;
}

// ── 한눈 요약 카드 ────────────────────────────────────────────────────────
function ssSummaryHtml(sum) {
  const esc = escapeHtml;
  const lead = sum.sentences.length ? `<p class="ss-lead">${sum.sentences.map(esc).join(" ")}</p>` : "";
  const seg = sum.segment
    ? `<p class="ss-seg">${esc(sum.segment.text)} <span class="ss-cap">(${esc(sum.segment.note)})</span></p>`
    : "";
  let table = "";
  if (sum.table) {
    const head = sum.table.cols.map((c) => `<th scope="col">${esc(c)}</th>`).join("");
    const body = sum.table.rows.map((r) => `<tr><th scope="row">${esc(r.label)}</th>${r.cells.map((c) => `<td${c.neg ? ' class="ss-neg"' : ""}>${esc(c.text)}</td>`).join("")}</tr>`).join("");
    table = `<div class="ss-table-wrap"><table class="ss-table${sum.table.wide ? " ss-wide" : ""}"><thead><tr><th scope="col">연간 실적</th>${head}</tr></thead><tbody>${body}</tbody></table></div>
      <p class="ss-cap">${esc(sum.table.note)}</p>`;
  }
  const events = sum.events.length
    ? `<div class="ss-events"><h4>최근 공시·이벤트</h4><ul>${sum.events.map((e) => `<li><time datetime="${esc(e.date)}">${esc(e.dateText)}</time>${e.badge ? `<span class="ss-badge">${esc(e.badge)}</span>` : ""}<span class="ss-ev-text"><b>${esc(e.title)}</b>${e.detail ? ` · ${esc(e.detail)}` : ""}</span></li>`).join("")}</ul></div>`
    : "";
  const notes = sum.notes.length ? `<p class="ss-cap ss-notes">기준 · ${sum.notes.map(esc).join(" · ")}</p>` : "";
  return `<div class="ss-head"><h3>한눈 요약</h3><span class="ss-cap">공시·시세 데이터로 만든 사실 요약 · 매매 추천이 아닙니다</span></div>
    ${lead}${notes}${seg}${table}${events}
    <div class="ss-actions">
      <button type="button" class="ghost compact-btn" data-goto-view="events">이벤트·공시 전체 보기</button>
      <button type="button" class="ghost compact-btn" data-goto-view="fin">재무 탭</button>
    </div>`;
}

function ssHide(host) {
  if (!host) return;
  host.hidden = true;
  if (host.innerHTML) host.innerHTML = "";
}

function renderStockSummary(item) {
  const host = byId("stockSummaryCard");
  const core = ssCore();
  if (!host) return;
  if (!core || !item || !item.ticker || item.__liveStub) return ssHide(host);
  const etf = typeof isStockEtf === "function" && isStockEtf(item);
  if (etf) return ssHide(host);
  const kr = ssIsKr();
  const sub = typeof stockSubLabel === "function" ? stockSubLabel(item) : "";
  const name = sub || (typeof stockLabel === "function" ? stockLabel(item) : item.ticker);
  const sum = core.buildSummary({
    kr,
    name,
    code: kr ? String(item.ticker) : String(item.ticker).toUpperCase(),
    marketLabel: typeof stockMarketLabel === "function" ? stockMarketLabel(item) : "",
    sectorText: ssSectorText(item),
    isEtf: etf,
    marketCap: ssMarketCap(item),
    capAsOf: item.priceDate || (typeof data !== "undefined" && data ? data.priceDate : ""),
    fin: ssFinancials(item),
    segments: ssSegments(item),
    consensus: ssConsensus(item),
    events: ssTimelineItems(item),
    catLabel: window.MirTimeline ? window.MirTimeline.CAT_LABEL : {},
    today: ssToday(),
  });
  if (!sum.show) return ssHide(host);
  const html = ssSummaryHtml(sum);
  if (host.dataset.ssKey === item.ticker && host.innerHTML && host._ssHtml === html && !host.hidden) return;
  host._ssHtml = html;
  host.dataset.ssKey = item.ticker;
  host.innerHTML = html;
  host.hidden = false;
}

// ── 오늘·임박 이벤트 줄 ───────────────────────────────────────────────────
const SS_ICON = {
  // 달력(실적·배당·보호예수) / 문서(공시). 얇은 선, currentColor.
  cal: '<svg class="ss-ico" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3"/></svg>',
  doc: '<svg class="ss-ico" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 1.8h5.2L12.5 5v9.2H4z"/><path d="M9 2v3.2h3.3M6 8h4.5M6 10.5h4.5"/></svg>',
};

function ssStripSources(item) {
  const kr = ssIsKr();
  const code = kr ? String(item.ticker) : String(item.ticker).toUpperCase();
  const w = window;
  const src = { today: ssToday(), kr, recent: ssTimelineItems(item) };
  if (kr) {
    if (ssFeatureOn("krIrSchedule")) {
      if (w.KR_IR_SCHEDULE) src.krIr = (w.KR_IR_SCHEDULE.rows || []).filter((r) => r && String(r.code || "") === code);
      else if (typeof ensureFeatureData === "function") ensureFeatureData("krIrSchedule").then((ok) => { if (ok && typeof scheduleFeatureViewRefresh === "function") scheduleFeatureViewRefresh(); });
    }
    if (w.KR_DIVIDENDS) src.krDividends = (w.KR_DIVIDENDS.rows || []).filter((r) => r && String(r.ticker || "") === code);
    if (ssFeatureOn("krLockups") && w.MirLockupCore) {
      if (w.KR_LOCKUPS) {
        const info = w.MirLockupCore.forTicker(w.KR_LOCKUPS, code, src.today);
        src.lockups = info ? info.upcoming : [];
      } else if (typeof ensureFeatureData === "function") {
        ensureFeatureData("krLockups").then((ok) => { if (ok && typeof scheduleFeatureViewRefresh === "function") scheduleFeatureViewRefresh(); });
      }
    }
  } else {
    const cal = w.US_STOCK_CALENDAR;
    if (cal && cal.stocks) src.usCalendar = cal.stocks[code] || null;
    else if (typeof ensureFeatureData === "function") ensureFeatureData("usCalendar").then((ok) => { if (ok && typeof scheduleFeatureViewRefresh === "function") scheduleFeatureViewRefresh(); });
  }
  return src;
}

function renderStockEventStrip(item) {
  const host = byId("stockEventStrip");
  const core = ssCore();
  if (!host) return;
  if (!core || !item || !item.ticker || item.__liveStub) return ssHide(host);
  ssBindOnce();
  const list = core.buildEventStrip(ssStripSources(item));
  if (!list.length) return ssHide(host);
  const html = list.map((e) => {
    const date = core.mdDate(e.date);
    const aria = `${e.label} ${e.when} ${date}${e.detail ? ` ${e.detail}` : ""} — 이벤트·공시 탭으로 이동`;
    return `<button type="button" class="ss-strip-item ss-k-${escapeHtml(e.kind)}" data-ss-goto="events" aria-label="${escapeHtml(aria)}" title="${escapeHtml(`${e.label} ${date}${e.detail ? ` · ${e.detail}` : ""}`)}">
      ${e.kind === "filing" ? SS_ICON.doc : SS_ICON.cal}
      <span class="ss-strip-when">${escapeHtml(e.when)}</span>
      <span class="ss-strip-text"><b>${escapeHtml(e.label)}</b> <span class="ss-strip-date">${escapeHtml(date)}</span>${e.detail ? `<span class="ss-strip-detail"> · ${escapeHtml(e.detail)}</span>` : ""}</span>
    </button>`;
  }).join("");
  if (host._ssHtml === html && !host.hidden) return;
  host._ssHtml = html;
  host.innerHTML = html;
  host.hidden = false;
}

// 좌측 패널(#stockMain 밖)이라 stock-view.js 의 data-goto-view 위임이 닿지 않는다 — 여기서 탭을 열고 본문으로 내린다.
function ssBindOnce() {
  if (_ssBound) return;
  _ssBound = true;
  document.addEventListener("click", (e) => {
    const btn = e.target.closest && e.target.closest("[data-ss-goto]");
    if (!btn) return;
    const view = btn.dataset.ssGoto;
    if (typeof activateStockView === "function") activateStockView(view, { push: true });
    const main = byId("stockMain");
    if (!main) return;
    const host = byId("stockDetail") || main;
    const stickyTop = parseFloat(getComputedStyle(host).getPropertyValue("--sd-sticky-top")) || 0;
    const top = main.getBoundingClientRect().top;
    // 탭 줄이 화면 밖(위·아래)이면 탭 줄이 보이게 옮긴다.
    if (top < stickyTop || top > window.innerHeight * 0.6) {
      window.scrollTo({ top: Math.max(0, window.pageYOffset + top - stickyTop - 4), behavior: "auto" });
    }
  });
}
