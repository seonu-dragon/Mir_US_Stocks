// 투자 가설 추적 — 화면(내 투자 › 도구 · 종목 분석 '가설 추가' · 오늘 탭 액션 보드 · 관심종목 알림).
// 조건 평가·성과·병합 계산은 thesis-core.js(window.MirThesisCore, node 테스트 대상)가 하고,
// 이 파일은 지표 수집(스냅샷·map_fundamentals·상세 JSON·피처 데이터) · 저장 · 렌더만 맡는다.
// IIFE — 최상위 이름을 흘리지 않는다. 밖에서 쓰는 건 window.MirThesis 뿐.
//
// 정직성 규칙
// - 조건 필드는 그 시장 데이터에 실제로 있는 값만 고를 수 있다(thesis-core METRICS.markets).
// - 값이 없으면 '확인 불가'로 둔다. 추정·보간하지 않는다.
// - 성적은 벤치마크(같은 시장 지수 ETF) 대비 초과수익으로만 매긴다. 매매 추천 문구를 쓰지 않는다.
(function () {
  "use strict";

  const STORE_KEY = "mir_thesis_tracker_v1";
  const MAX_ITEMS = 200;
  const WARM_MAX_DETAILS = 20;
  const BENCH = { us: "SPY", kr: "069500" };

  let store = { items: [], deleted: [] };
  let evals = new Map(); // id → { state, results, counts, recheck, earningsDate }
  let bound = false;
  let routeApplied = false;
  let filter = "open";
  let draft = null; // 편집 중인 폼 상태
  let closingId = null;
  let warmToken = 0;
  let recheckToastShown = false;

  const core = () => window.MirThesisCore;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => (typeof escapeHtml === "function" ? escapeHtml(String(s ?? "")) : String(s ?? ""));
  const mkt = () => (typeof isKrMarket === "function" && isKrMarket() ? "kr" : "us");
  const label = (t) => { try { return stockLabel(t); } catch (_) { return t; } };
  const toast = (m) => { if (typeof showAppToast === "function") showAppToast(m, 2600); };
  const fmtPrice = (v) => (Number.isFinite(v) && v > 0 ? marketCfg().formatPrice(v) : "—");
  const signed = (v, unit = "%") => (Number.isFinite(v) ? `${v > 0 ? "+" : ""}${v.toFixed(1)}${unit}` : "—");
  const tone = (v) => (Number.isFinite(v) ? (v > 0 ? "pos" : v < 0 ? "neg" : "muted") : "muted");

  function nowIso() {
    const k = typeof formatKstDateTime === "function" ? formatKstDateTime() : new Date().toISOString();
    return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(k) ? `${k.slice(0, 10)}T${k.slice(11, 16)}:00+09:00` : new Date().toISOString();
  }
  const today = () => nowIso().slice(0, 10);
  const whenText = (iso) => String(iso || "").replace("T", " ").slice(0, 16);

  // ----- 저장 -----
  function load() {
    const raw = window.safeStorage ? window.safeStorage.getJSON(STORE_KEY, null) : null;
    store = core() ? core().normalizeStore(raw || {}) : { items: [], deleted: [] };
  }

  function save({ push = true } = {}) {
    store.items = store.items.slice(0, MAX_ITEMS);
    if (window.safeStorage) window.safeStorage.setJSON(STORE_KEY, store);
    if (push && typeof scheduleCloudSyncPush === "function") scheduleCloudSyncPush();
  }

  function mine() {
    const m = mkt();
    return store.items.filter((t) => t.market === m);
  }

  function upsert(t) {
    const i = store.items.findIndex((x) => x.id === t.id);
    if (i >= 0) store.items[i] = t; else store.items.unshift(t);
  }

  // ----- 지표 수집 -----
  function detailOf(ticker) {
    const base = stockByTicker(ticker);
    if (!base) return null;
    const merged = typeof withDetail === "function" ? withDetail(base) : base;
    return merged && merged !== base && Array.isArray(merged.chartSeries) ? merged : null;
  }

  function benchNow() {
    const m = mkt();
    let t = BENCH[m];
    if (!stockByTicker(t) && typeof backtestDefaultBenchmark === "function") t = backtestDefaultBenchmark();
    const row = stockByTicker(t);
    return { benchTicker: row ? t : null, benchPrice: row ? Number(row.price) || null : null };
  }

  function snapshotAsOf() {
    const d = (typeof data !== "undefined" && data) || {};
    return core().isoDate(d.priceDate) || core().isoDate(d.updatedAtKst) || today();
  }

  function collectValues(ticker) {
    const C = core();
    const base = stockByTicker(ticker) || {};
    const mf = (window.MAP_FUNDAMENTALS || {})[ticker] || {};
    const det = detailOf(ticker);
    const df = (det && det.fundamentals) || {};
    const pick = (...xs) => { for (const x of xs) { const n = C.num(x); if (n !== null) return n; } return null; };
    const kr = mkt() === "kr";
    let sma200 = null;
    if (det && typeof getChartRows === "function") {
      const rows = getChartRows(det);
      if (rows.length && !rows[0].synthetic) sma200 = C.sma200Gap(rows.map((r) => r.c));
    }
    const fh = (det && det.financialsHistory) || [];
    return {
      price: pick(base.price),
      pe: pick(mf.pe, df.pe),
      forwardPE: pick(mf.forwardPE, df.forwardPE),
      pb: pick(mf.pb, df.pb),
      ps: pick(mf.ps, df.ps),
      operMargin: pick(df.operMargin),
      netMargin: pick(mf.netMargin, df.profitMargin),
      roe: pick(mf.roe, df.roe),
      revenueGrowth: kr ? pick(mf.revenueGrowth, df.revenueGrowth) : C.yoyFromHistory(fh, "rev"),
      operatingGrowth: kr ? pick(mf.operatingGrowth, df.operatingGrowth) : C.yoyFromHistory(fh, "op"),
      debtRatio: kr ? pick(mf.debtRatio, df.debtRatio) : null,
      divYield: pick(mf.divYield, df.divYield),
      rsi14: pick(base.rsi14),
      high52Gap: pick(base.newHighDistancePct),
      sma200Gap: sma200,
    };
  }

  const GUIDANCE_KO = { raised: "상향", lowered: "하향", maintained: "유지", issued: "신규 제시", none: "언급 없음" };
  const ALERT_SECTIONS = { caution: "투자주의", warning: "투자경고", risk: "투자위험", halt: "거래정지", admin: "관리종목" };

  function collectEvents(thesis) {
    const t = thesis.ticker;
    const since = core().isoDate(thesis.createdAt);
    const ev = {};
    const er = window.EARNINGS_RELEASES;
    if (er && Array.isArray(er.releases)) {
      const rel = er.releases.filter((r) => String(r.ticker || "").toUpperCase() === t && (r.fileDate || "") >= since);
      const low = rel.find((r) => r.guidance === "lowered");
      if (low) ev.guidanceLowered = { value: true, text: `가이던스 하향 (${low.fileDate} 보도자료)`, date: low.fileDate };
      else if (rel.length) ev.guidanceLowered = { value: false, text: `등록 이후 보도자료 가이던스: ${rel.map((r) => GUIDANCE_KO[r.guidance] || r.guidance).join(", ")}` };
      else ev.guidanceLowered = { value: false, text: "등록 이후 확인된 하향 없음(보도자료 요약은 최근분만 보관)" };
    }
    const ka = window.KR_MARKET_ALERTS;
    if (ka && ka.sections) {
      const hits = [];
      Object.entries(ALERT_SECTIONS).forEach(([key, name]) => {
        const sec = ka.sections[key];
        if (!sec || !Array.isArray(sec.rows)) return;
        const row = sec.rows.find((r) => String(r.ticker) === t);
        if (row) hits.push(row.type || name);
      });
      ev.krMarketAlert = hits.length
        ? { value: true, text: `${hits.join(" · ")} (기준 ${ka.baseDate || ""})`, date: ka.baseDate || null }
        : { value: false, text: `지정 없음 (기준 ${ka.baseDate || ""})` };
    }
    const it = window.INSIDER_TRADES;
    const cond = (thesis.conditions || []).find((c) => c.metric === "insiderSellCluster");
    if (cond && it && Array.isArray(it.trades)) {
      const r = core().insiderSellCluster(it.trades, t, today(), 30, cond.value || 3);
      ev.insiderSellCluster = r.hit
        ? { value: true, text: `최근 30일 내부자 ${r.owners}명 매도 ${r.count}건`, date: today() }
        : { value: false, text: r.count ? `최근 30일 ${r.owners}명 매도 ${r.count}건(기준 미만)` : "최근 30일 매도 신고 없음" };
    }
    const cal = ((window.US_STOCK_CALENDAR || {}).stocks || {})[t];
    const ew = (thesis.conditions || []).find((c) => c.metric === "earningsWithin");
    if (ew && window.US_STOCK_CALENDAR) {
      const next = cal && cal.nextEarnings;
      const dd = next ? core().daysBetween(today(), next) : null;
      if (dd === null) ev.earningsWithin = { value: null, text: "다음 실적 예정일 없음" };
      else if (dd >= 0 && dd <= (ew.value ?? 7)) ev.earningsWithin = { value: true, text: `실적 발표 ${dd === 0 ? "D-DAY" : `D-${dd}`} (${next})`, date: next };
      else ev.earningsWithin = { value: false, text: dd < 0 ? `예정일 ${next} 지남` : `다음 실적 ${next} (D-${dd})` };
    }
    return ev;
  }

  // 실적 발표 날짜(가장 최근, 오늘 이전). US: 보도자료 요약 + 상세의 EPS 이력. KR: 잠정실적 반응 + 상세.
  function latestEarnings(ticker) {
    const dates = [];
    ((window.EARNINGS_RELEASES || {}).releases || []).forEach((r) => { if (String(r.ticker || "").toUpperCase() === ticker) dates.push(r.fileDate); });
    ((window.KR_EARNINGS_REACTIONS || {}).rows || []).forEach((r) => { if (String(r.ticker) === ticker) dates.push(r.date); });
    const det = detailOf(ticker);
    ((det && det.earningsHistory) || []).forEach((r) => dates.push(r && r.date));
    const t = today();
    return core().latestIso(dates.filter((d) => d && String(d).slice(0, 10) <= t));
  }

  // ----- 평가 -----
  function evaluateAll() {
    if (!core()) return evals;
    const next = new Map();
    let dirty = false;
    const now = nowIso();
    mine().forEach((t) => {
      if (!stockByTicker(t.ticker)) {
        next.set(t.id, { state: "unknown", results: [], counts: {}, missing: true });
        return;
      }
      const metrics = { values: collectValues(t.ticker), events: collectEvents(t) };
      const r = core().evaluateThesis(t, metrics);
      if (t.status === "open" && r.newlyTriggered.length) {
        upsert(core().recordTriggered(t, r.newlyTriggered, now));
        dirty = true;
      }
      const earningsDate = latestEarnings(t.ticker);
      next.set(t.id, { ...r, values: metrics.values, earningsDate, recheck: core().needsEarningsRecheck(t, earningsDate) });
    });
    evals = next;
    if (dirty) save();
    return evals;
  }

  function evalOf(t) {
    return evals.get(t.id) || { state: "unknown", results: [], counts: {} };
  }

  // 데이터가 필요한 것들을 불러온 뒤 다시 평가한다(상세 JSON·피처 데이터). 방문 시 1회 + 시장 전환 시.
  function warm() {
    if (!core() || typeof stockByTicker !== "function") return;
    const token = ++warmToken;
    const open = mine().filter((t) => t.status === "open" && stockByTicker(t.ticker));
    if (!open.length) { evaluateAll(); refreshSurfaces(); return; }
    const jobs = [];
    const need = new Set(open.flatMap((t) => (t.conditions || []).map((c) => c.metric)));
    if (typeof ensureFeatureData === "function") {
      if (mkt() === "us") {
        jobs.push(ensureFeatureData("earningsReleases"), ensureFeatureData("usCalendar"));
        if (need.has("insiderSellCluster")) jobs.push(ensureFeatureData("insider"));
      } else {
        jobs.push(ensureFeatureData("krMarketAlerts"), ensureFeatureData("krEarningsReact"));
      }
    }
    if (typeof loadStockDetail === "function") {
      [...new Set(open.map((t) => t.ticker))].slice(0, WARM_MAX_DETAILS).forEach((t) => jobs.push(loadStockDetail(t)));
    }
    evaluateAll();
    refreshSurfaces();
    Promise.allSettled(jobs).then(() => {
      if (token !== warmToken) return;
      evaluateAll();
      refreshSurfaces();
      const n = mine().filter((t) => evalOf(t).recheck).length;
      if (n && !recheckToastShown) {
        recheckToastShown = true;
        toast(`실적 발표 뒤 다시 볼 가설이 ${n}건 있습니다 — 내 투자 › 도구`);
      }
    });
  }

  function refreshSurfaces() {
    render();
    renderStrip();
    if (typeof renderActionBoard === "function") { try { renderActionBoard(); } catch (_) { /* 부팅 전 */ } }
    if (typeof renderWatchAlerts === "function") { try { renderWatchAlerts(); } catch (_) { /* 부팅 전 */ } }
    if (typeof renderMyInvestSummary === "function") { try { renderMyInvestSummary(); } catch (_) { /* 부팅 전 */ } }
  }

  // 오늘 탭 액션 보드·관심종목 알림에 넣을 항목: 위반·근접·실적 후 재점검.
  function alertItems() {
    const out = [];
    mine().filter((t) => t.status === "open").forEach((t) => {
      const e = evalOf(t);
      const bad = (e.results || []).filter((r) => r.state === "breach");
      const nearR = (e.results || []).filter((r) => r.state === "near");
      let note = "";
      let rank = 0;
      if (bad.length) { note = `가설 위반: ${bad.map((r) => r.label).join(", ")}`; rank = 3; }
      else if (e.recheck) { note = `실적 발표(${e.earningsDate}) 후 가설 재점검`; rank = 2; }
      else if (nearR.length) { note = `가설 근접: ${nearR.map((r) => r.label).join(", ")}`; rank = 1; }
      if (rank) out.push({ ticker: t.ticker, note, rank, id: t.id });
    });
    return out.sort((a, b) => b.rank - a.rank);
  }

  // ----- 렌더: 내 투자 › 보유·관심 요약 줄 -----
  function renderStrip() {
    const el = $("thesisStrip");
    if (!el) return;
    const list = mine().filter((t) => t.status === "open");
    if (!list.length) { el.hidden = true; el.innerHTML = ""; return; }
    const c = { breach: 0, near: 0, ok: 0, unknown: 0 };
    list.forEach((t) => { c[evalOf(t).state] += 1; });
    const re = list.filter((t) => evalOf(t).recheck).length;
    el.hidden = false;
    el.innerHTML = `<span class="thesis-strip-title">투자 가설 ${list.length}건</span>
      ${c.breach ? `<span class="thesis-badge is-breach">위반 ${c.breach}</span>` : ""}
      ${c.near ? `<span class="thesis-badge is-near">근접 ${c.near}</span>` : ""}
      ${re ? `<span class="thesis-badge is-near">실적 후 재점검 ${re}</span>` : ""}
      <span class="thesis-badge is-ok">정상 ${c.ok}</span>
      <button type="button" class="ghost compact-btn" data-thesis-goto>가설 보기</button>`;
  }

  // ----- 렌더: 폼 -----
  const PRESETS = [
    { label: "영업이익률 < 15%", cond: { metric: "operMargin", op: "lt", value: 15 } },
    { label: "매출 성장률 < 10%", cond: { metric: "revenueGrowth", op: "lt", value: 10 } },
    { label: "PER > 30", cond: { metric: "pe", op: "gt", value: 30 } },
    { label: "종가 < 200일선", cond: { metric: "sma200Gap", op: "lt", value: 0 } },
    { label: "부채비율 > 200%", cond: { metric: "debtRatio", op: "gt", value: 200 } },
    { label: "가이던스 하향", cond: { metric: "guidanceLowered" } },
    { label: "시장경보 지정", cond: { metric: "krMarketAlert" } },
    { label: "내부자 매도 클러스터", cond: { metric: "insiderSellCluster", value: 3 } },
    { label: "실적 발표 D-7", cond: { metric: "earningsWithin", value: 7 } },
  ];

  function newDraft(ticker = "", extra = {}) {
    return { editingId: null, ticker, text: "", target: "", stop: "", entryPrice: "", conditions: [], note: "", ...extra };
  }

  function condId() {
    const used = new Set((draft.conditions || []).map((c) => c.id));
    let i = 1;
    while (used.has(`c${i}`)) i += 1;
    return `c${i}`;
  }

  function resolveTicker(raw) {
    const s = String(raw || "").trim();
    if (!s) return "";
    const r = typeof resolveCommunityTickerInput === "function" ? resolveCommunityTickerInput(s) : null;
    const t = r || normalizeTickerKey(s);
    return stockByTicker(t) ? t : "";
  }

  function readDraftFromForm() {
    const box = $("thesisForm");
    if (!box || !draft) return;
    const v = (id) => ($(id) ? $(id).value : "");
    draft.tickerInput = v("thesisTicker");
    draft.text = v("thesisText");
    draft.target = v("thesisTarget");
    draft.stop = v("thesisStop");
    draft.entryPrice = v("thesisEntry");
    draft.note = v("thesisNote");
    box.querySelectorAll("[data-cond-row]").forEach((row) => {
      const c = draft.conditions.find((x) => x.id === row.dataset.condRow);
      if (!c) return;
      c.metric = row.querySelector("[data-cond-metric]").value;
      const op = row.querySelector("[data-cond-op]");
      if (op) c.op = op.value;
      const val = row.querySelector("[data-cond-value]");
      if (val) c.value = val.value;
    });
  }

  function metricOptions(selected) {
    const list = core().metricsForMarket(mkt());
    const group = (kind, title) => `<optgroup label="${title}">${list.filter((m) => m.kind === kind).map((m) => `<option value="${m.key}"${m.key === selected ? " selected" : ""}>${esc(m.label)}</option>`).join("")}</optgroup>`;
    return group("number", "지표") + group("event", "이벤트");
  }

  function condRowHtml(c, values) {
    const meta = core().METRICS[c.metric] || core().METRICS.pe;
    const cur = meta.kind === "number" ? core().fmtValue(meta, values ? core().num(values[c.metric]) : null) : "";
    let mid = "";
    if (meta.kind === "number") {
      mid = `<select data-cond-op aria-label="비교"><option value="lt"${c.op === "lt" ? " selected" : ""}>&lt; 미만</option><option value="gt"${c.op === "gt" ? " selected" : ""}>&gt; 초과</option></select>
        <input data-cond-value type="number" step="any" value="${esc(c.value ?? "")}" aria-label="기준값" placeholder="기준값">`;
    } else if (meta.param) {
      mid = `<span class="thesis-cond-param">${esc(meta.param.label)}</span><input data-cond-value type="number" min="${meta.param.min}" max="${meta.param.max}" step="1" value="${esc(c.value ?? meta.param.def)}" aria-label="${esc(meta.param.label)}">`;
    } else {
      mid = `<span class="thesis-cond-param">발생 시 위반</span>`;
    }
    const hint = meta.kind === "number" ? `현재 ${cur}` : (meta.near ? "도달 시 근접(점검)" : "관측 시 위반");
    return `<div class="thesis-cond-row" data-cond-row="${esc(c.id)}">
      <select data-cond-metric aria-label="필드">${metricOptions(c.metric)}</select>
      ${mid}
      <small class="muted" title="${esc(meta.source)}">${esc(hint)}</small>
      <button type="button" class="ghost compact-btn" data-cond-del="${esc(c.id)}" aria-label="조건 삭제">✕</button>
    </div>`;
  }

  function renderForm() {
    const box = $("thesisForm");
    if (!box) return;
    if (!draft) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    const t = resolveTicker(draft.tickerInput ?? draft.ticker) || draft.ticker;
    const values = t && stockByTicker(t) ? collectValues(t) : null;
    const m = mkt();
    const avail = new Set(core().metricsForMarket(m).map((x) => x.key));
    const editing = draft.editingId ? store.items.find((x) => x.id === draft.editingId) : null;
    const tickerValue = draft.tickerInput ?? (t && typeof stockInputValue === "function" ? stockInputValue(t) : t);
    box.innerHTML = `
      <div class="thesis-form-head"><strong>${editing ? `${esc(label(editing.ticker))} 가설 수정` : "새 가설 등록"}</strong>
        ${editing ? `<small class="muted">수정하면 이전 버전이 이력에 남고, 등록 시점 스냅샷·등록 시각은 바뀌지 않습니다.</small>` : `<small class="muted">등록하는 순간의 지표(가격·PER·마진·성장률 등)가 동결 저장됩니다.</small>`}</div>
      <div class="thesis-form-grid">
        <label>종목<input id="thesisTicker" autocomplete="off" value="${esc(tickerValue || "")}" placeholder="${m === "kr" ? "종목명 또는 코드" : "티커 (예: NVDA)"}"${editing ? " disabled" : ""}></label>
        <label>목표가<input id="thesisTarget" type="number" min="0" step="any" value="${esc(draft.target ?? "")}" placeholder="선택"></label>
        <label>손절가<input id="thesisStop" type="number" min="0" step="any" value="${esc(draft.stop ?? "")}" placeholder="선택"></label>
        <label>내 진입가<input id="thesisEntry" type="number" min="0" step="any" value="${esc(draft.entryPrice ?? "")}" placeholder="${values && values.price ? `현재 ${fmtPrice(values.price)}` : "선택"}"></label>
      </div>
      <label class="thesis-form-text">매수 근거<textarea id="thesisText" rows="3" maxlength="2000" placeholder="무엇을 믿고 사는지, 어떤 일이 일어나면 틀린 것인지 적어 두세요.">${esc(draft.text || "")}</textarea></label>
      <div class="thesis-cond-head"><strong>체크포인트 · 폐기 조건</strong><small class="muted">조건이 성립하면 '위반', 가까워지면 '근접'으로 표시합니다. 값이 없는 종목은 '확인 불가'.</small></div>
      <div class="thesis-presets">${PRESETS.map((p, i) => (avail.has(p.cond.metric) ? `<button type="button" data-cond-preset="${i}">${esc(p.label)}</button>` : "")).join("")}</div>
      <div class="thesis-cond-list">${draft.conditions.map((c) => condRowHtml(c, values)).join("") || `<p class="muted">프리셋을 누르거나 '조건 추가'로 넣으세요.</p>`}</div>
      <div class="thesis-form-actions">
        <button type="button" class="ghost compact-btn" data-cond-add${draft.conditions.length >= core().MAX_CONDITIONS ? " disabled" : ""}>조건 추가</button>
        ${editing ? `<input id="thesisNote" maxlength="300" placeholder="수정 사유(선택)" value="${esc(draft.note || "")}">` : ""}
        <span class="thesis-spacer"></span>
        <button type="button" class="ghost" data-thesis-cancel>취소</button>
        <button type="button" class="primary" data-thesis-save>${editing ? "수정 저장" : "가설 저장"}</button>
      </div>`;
    if (!editing && typeof setupTickerAutocomplete === "function") {
      setupTickerAutocomplete("thesisTicker", { onCommit: () => onTickerChange() });
    }
    $("thesisTicker")?.addEventListener("change", onTickerChange);
  }

  function onTickerChange() {
    readDraftFromForm();
    const t = resolveTicker(draft.tickerInput);
    if (!t) return;
    draft.ticker = t;
    draft.tickerInput = typeof stockInputValue === "function" ? stockInputValue(t) : t;
    renderForm();
    if (typeof loadStockDetail === "function") loadStockDetail(t).then(() => { if (draft && draft.ticker === t) { readDraftFromForm(); renderForm(); } });
  }

  async function saveDraft() {
    readDraftFromForm();
    const C = core();
    const editing = draft.editingId ? store.items.find((x) => x.id === draft.editingId) : null;
    const ticker = editing ? editing.ticker : resolveTicker(draft.tickerInput);
    if (!ticker) { toast("현재 시장 스냅샷에 있는 종목을 입력하세요."); return; }
    if (!String(draft.text || "").trim()) { toast("매수 근거를 적어 주세요."); return; }
    const conditions = C.normalizeConditions(draft.conditions, mkt());
    if (draft.conditions.length !== conditions.length) { toast("기준값이 빈 조건이 있습니다. 채우거나 지워 주세요."); return; }
    if (!conditions.length && !(Number(draft.stop) > 0)) { toast("측정 가능한 조건을 하나 이상(또는 손절가를) 넣어 주세요."); return; }
    const now = nowIso();
    if (editing) {
      const next = C.reviseThesis(editing, { text: draft.text, conditions, target: draft.target, stop: draft.stop, entryPrice: draft.entryPrice, note: draft.note }, now);
      if (next === editing) { toast("바뀐 내용이 없습니다."); return; }
      upsert(next);
      toast("수정했습니다. 이전 버전은 이력에 남았습니다.");
    } else {
      if (typeof loadStockDetail === "function") { try { await loadStockDetail(ticker); } catch (_) { /* 상세 없이도 저장 */ } }
      const snap = { asOf: snapshotAsOf(), values: collectValues(ticker), ...benchNow() };
      const id = `th-${Date.now().toString(36)}-${ticker}`;
      upsert(C.createThesis({ ticker, market: mkt(), text: draft.text, conditions, target: draft.target, stop: draft.stop, entryPrice: draft.entryPrice }, snap, now, id));
      toast("가설을 저장했습니다. 방문할 때마다 조건을 점검합니다.");
    }
    draft = null;
    filter = "open";
    save();
    warm();
  }

  // ----- 렌더: 목록 -----
  function condListHtml(e) {
    if (!(e.results || []).length) return "";
    return `<ul class="thesis-conds">${e.results.map((r) => `<li class="is-${r.state}"><span class="thesis-dot" aria-hidden="true"></span><b>${esc(r.label)}</b><em>${esc(core().STATE_LABEL[r.state])} · ${esc(r.text || "")}</em></li>`).join("")}</ul>`;
  }

  function changeTableHtml(t, values) {
    const C = core();
    const rows = C.SNAPSHOT_KEYS.map((k) => {
      const meta = C.METRICS[k];
      const a = C.num(t.entry.values[k]);
      const b = C.num(values && values[k]);
      if (a === null && b === null) return "";
      let diff = "—";
      if (a !== null && b !== null) {
        if (meta.unit === "price") diff = signed(C.pctReturn(a, b));
        else if (meta.unit === "pct") diff = signed(b - a, "%p");
        else diff = signed(b - a, "");
      }
      const f = (v) => (meta.unit === "price" ? fmtPrice(v) : C.fmtValue(meta, v));
      return `<tr><td>${esc(meta.label)}</td><td>${a === null ? "—" : esc(f(a))}</td><td>${b === null ? "—" : esc(f(b))}</td><td>${esc(diff)}</td></tr>`;
    }).join("");
    return `<div class="portfolio-tool-table"><table class="thesis-change-table"><thead><tr><th>지표</th><th>등록 시점 (${esc(t.entry.asOf || "")})</th><th>현재 (${esc(snapshotAsOf())})</th><th>변화</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function historyHtml(t) {
    const h = t.history || [];
    if (!h.length) return `<p class="muted">수정 이력 없음 — 등록 당시 그대로입니다.</p>`;
    const ver = (v, title) => `<div class="thesis-ver"><strong>${esc(title)}</strong> <small class="muted">${esc(whenText(v.at))}</small>
      <p>${esc(v.text)}</p><small class="muted">${esc((v.conditions || []).map(core().describeCondition).join(" · ") || "조건 없음")} · 목표 ${esc(fmtPrice(v.target))} · 손절 ${esc(fmtPrice(v.stop))}</small>${v.note ? `<small class="muted"> · 사유: ${esc(v.note)}</small>` : ""}</div>`;
    return h.map((v, i) => ver(v, i === 0 ? "원래 가설" : `수정본 ${i}`)).join("")
      + `<div class="thesis-ver is-current"><strong>현재 버전</strong> <small class="muted">${esc(whenText(t.updatedAt))}${t.revisionNote ? ` · 사유: ${esc(t.revisionNote)}` : ""}</small></div>`;
  }

  function perfHtml(t, e) {
    const C = core();
    const bn = benchNow();
    const cur = { asOf: snapshotAsOf(), price: e.values ? e.values.price : null, ...bn };
    const p = C.relativePerformance(t, cur);
    const bl = p.benchTicker ? label(p.benchTicker) : "벤치마크";
    if (p.stockRet === null) return `<p class="thesis-perf muted">등록 시점 가격이 없어 성과를 계산할 수 없습니다.</p>`;
    const closed = t.status === "closed";
    return `<p class="thesis-perf">${closed ? "보유 기간" : "등록 이후"} ${p.days ?? "—"}일 · 종목 <b class="${tone(p.stockRet)}">${signed(p.stockRet)}</b> · ${esc(bl)} <b class="${tone(p.benchRet)}">${signed(p.benchRet)}</b> · 차이 <b class="${tone(p.excess)}">${signed(p.excess, "%p")}</b>
      <small class="muted">등록${closed ? "·종료" : ""} 시점 스냅샷 종가 기준${t.entryPrice ? ` (내 진입가 ${esc(fmtPrice(t.entryPrice))}는 참고용)` : ""}</small></p>`;
  }

  // 종료 사유 기본값: 목표가 도달이면 '목표 도달', 위반이 있으면 '가설 훼손', 아니면 '기타'.
  function defaultReason(t, e) {
    const rs = e.results || [];
    if (rs.some((r) => r.id === "__target" && r.state === "near")) return "target";
    if (rs.some((r) => r.state === "breach")) return "broken";
    return "other";
  }

  function itemHtml(t) {
    const e = evalOf(t);
    const closed = t.status === "closed";
    const state = closed ? "closed" : e.state;
    const badge = closed ? `종료 · ${esc(core().CLOSE_REASONS[t.closeReason] || "기타")}` : esc(core().STATE_LABEL[e.state]);
    const revs = (t.history || []).length;
    const closing = closingId === t.id;
    return `<article class="thesis-item is-${state}" data-thesis-id="${esc(t.id)}">
      <header class="thesis-item-head">
        <button type="button" class="thesis-ticker" data-thesis-open="${esc(t.ticker)}">${esc(label(t.ticker))}</button>
        <span class="thesis-badge is-${state}">${badge}</span>
        <small class="muted">등록 ${esc(whenText(t.createdAt))}${revs ? ` · 수정 ${revs}회(마지막 ${esc(whenText(t.updatedAt))})` : ""}${closed ? ` · 종료 ${esc(whenText(t.closedAt))}` : ""}</small>
      </header>
      ${e.missing ? `<p class="muted">현재 시장 스냅샷에 없는 종목이라 점검할 수 없습니다.</p>` : ""}
      <p class="thesis-text">${esc(t.text)}</p>
      ${!closed && e.recheck ? `<div class="thesis-recheck"><span>실적 발표(${esc(e.earningsDate)}) 뒤 처음 확인하는 가설입니다. 근거가 여전히 유효한지 다시 읽어 보세요.</span><button type="button" class="ghost compact-btn" data-thesis-reviewed="${esc(t.id)}">재점검 완료</button></div>` : ""}
      ${closed ? "" : condListHtml(e)}
      ${perfHtml(t, e)}
      <details class="thesis-fold"><summary>등록 이후 무엇이 변했나</summary>${changeTableHtml(t, closed ? null : e.values)}</details>
      <details class="thesis-fold"><summary>원래 가설 · 수정 이력 (${revs})</summary>${historyHtml(t)}</details>
      <div class="thesis-actions">
        ${closed ? "" : `<button type="button" class="ghost compact-btn" data-thesis-edit="${esc(t.id)}">수정</button>`}
        ${closed || closing ? "" : `<button type="button" class="ghost compact-btn" data-thesis-close="${esc(t.id)}">종료</button>`}
        ${closing ? `<span class="thesis-close-row"><select id="thesisCloseReason" aria-label="종료 사유">${Object.entries(core().CLOSE_REASONS).map(([k, v]) => `<option value="${k}"${k === defaultReason(t, e) ? " selected" : ""}>${esc(v)}</option>`).join("")}</select>
          <button type="button" class="primary compact-btn" data-thesis-close-ok="${esc(t.id)}">현재가로 종료</button><button type="button" class="ghost compact-btn" data-thesis-close-cancel>취소</button></span>` : ""}
        <button type="button" class="ghost compact-btn thesis-del" data-thesis-del="${esc(t.id)}">삭제</button>
      </div>
    </article>`;
  }

  function scoreHtml(list) {
    const s = core().scoreboard(list);
    if (!s.closed) return `<p class="muted">종료한 가설이 생기면 같은 기간 ${esc(label(BENCH[mkt()]))} 대비 성적이 여기에 쌓입니다.</p>`;
    const cell = (k, v, c = "") => `<div><span>${k}</span><strong class="${c}">${v}</strong></div>`;
    const rows = s.rows.map(({ t, perf }) => `<tr><td>${esc(label(t.ticker))}<small>${esc(core().CLOSE_REASONS[t.closeReason] || "")}</small></td><td>${esc(t.entry.asOf || "")} → ${esc(t.exit?.asOf || "")}</td><td class="${tone(perf.stockRet)}">${signed(perf.stockRet)}</td><td class="${tone(perf.benchRet)}">${signed(perf.benchRet)}</td><td class="${tone(perf.excess)}">${signed(perf.excess, "%p")}</td></tr>`).join("");
    return `<div class="portfolio-tool-summary thesis-score">
        ${cell("종료한 가설", `${s.closed}건`)}
        ${cell("벤치마크 대비 적중", s.hitRate === null ? "—" : `${s.hits}/${s.scored} (${s.hitRate.toFixed(0)}%)`)}
        ${cell("초과수익 평균 · 중앙", `${signed(s.avgExcess, "%p")} · ${signed(s.medianExcess, "%p")}`, tone(s.medianExcess))}
      </div>
      <p class="muted thesis-note">적중 = 같은 기간 ${esc(label(BENCH[mkt()]))}보다 수익률이 높았던 경우(절대 수익률로는 매기지 않습니다 — 시장 전체가 오른 덕을 실력으로 착각하기 쉬워서). 표본 ${s.scored}건${s.scored < 10 ? " — 10건 미만이면 우연과 구별하기 어렵습니다" : ""}. 등록·종료 시점 스냅샷 종가 기준의 가격 수익률이며 배당·세금·수수료·환율은 반영하지 않았습니다.${s.unscored ? ` 벤치마크 가격이 없어 제외 ${s.unscored}건.` : ""}</p>
      <div class="portfolio-tool-table"><table><thead><tr><th>종목</th><th>기간</th><th>종목</th><th>${esc(label(BENCH[mkt()]))}</th><th>차이</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function render() {
    const listEl = $("thesisList");
    if (!listEl || !core()) return;
    renderForm();
    const all = mine();
    const counts = { open: all.filter((t) => t.status === "open").length, closed: all.filter((t) => t.status === "closed").length };
    const cnt = $("thesisCount");
    if (cnt) {
      const c = { breach: 0, near: 0 };
      all.filter((t) => t.status === "open").forEach((t) => { const s = evalOf(t).state; if (c[s] !== undefined) c[s] += 1; });
      cnt.textContent = counts.open ? `진행 ${counts.open}건${c.breach ? ` · 위반 ${c.breach}` : ""}${c.near ? ` · 근접 ${c.near}` : ""}` : `${all.length}건`;
    }
    document.querySelectorAll("[data-thesis-filter]").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.thesisFilter === filter);
      const k = b.dataset.thesisFilter;
      b.textContent = `${k === "open" ? "진행 중" : k === "closed" ? "종료" : "전체"} ${k === "all" ? all.length : counts[k]}`;
    });
    const rank = (t) => (t.status === "closed" ? -1 : core().STATE_RANK[evalOf(t).state] + (evalOf(t).recheck ? 0.5 : 0));
    const shown = all.filter((t) => filter === "all" || t.status === filter).sort((a, b) => rank(b) - rank(a) || String(b.createdAt).localeCompare(String(a.createdAt)));
    listEl.innerHTML = shown.length ? shown.map(itemHtml).join("")
      : `<p class="muted">${filter === "closed" ? "종료한 가설이 없습니다." : "아직 등록한 가설이 없습니다. '새 가설'로 매수 근거와 틀렸다고 볼 조건을 적어 두면, 방문할 때마다 현재 데이터로 점검합니다."}</p>`;
    const other = store.items.length - all.length;
    const note = $("thesisOtherNote");
    if (note) note.textContent = other ? `${mkt() === "kr" ? "미국" : "국내"} 시장 가설 ${other}건은 그 시장 모드에서 점검됩니다.` : "";
    const sc = $("thesisScore");
    if (sc) sc.innerHTML = scoreHtml(all);
    const asof = $("thesisAsOf");
    if (asof) asof.textContent = `점검 기준: 스냅샷 ${snapshotAsOf()} · 재무 지표는 map_fundamentals·종목 상세 JSON · 이벤트는 ${mkt() === "kr" ? "KRX 시장경보·DART 잠정실적" : "실적 보도자료 요약·SEC Form 4·실적 예정일"}`;
  }

  // ----- 동작 -----
  function openFold() {
    const fold = $("thesisFold");
    if (fold) fold.open = true;
    const panel = $("thesisPanel");
    if (panel) setTimeout(() => panel.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }

  function openForTicker(ticker, extra = {}) {
    const t = ticker ? normalizeTickerKey(ticker) : "";
    if (t && !stockByTicker(t)) { toast("현재 시장 스냅샷에 없는 종목입니다."); return; }
    draft = newDraft(t, extra);
    if (t) draft.tickerInput = typeof stockInputValue === "function" ? stockInputValue(t) : t;
    if (typeof activateTab === "function") activateTab("bulk", { sub: "tools", push: true });
    render();
    openFold();
    if (t && typeof loadStockDetail === "function") loadStockDetail(t).then(() => { if (draft && draft.ticker === t) { readDraftFromForm(); renderForm(); } });
    setTimeout(() => $(t ? "thesisText" : "thesisTicker")?.focus({ preventScroll: true }), 120);
  }

  function download(name, text, type) {
    const blob = new Blob([text], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  function importFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ""));
        const incoming = core().normalizeStore(parsed && parsed.thesisTracker ? parsed.thesisTracker : parsed);
        if (!incoming.items.length) { toast("가져올 가설이 없습니다(형식 확인)."); return; }
        const before = store.items.length;
        store = core().mergeStores(store, incoming);
        save();
        toast(`가설 ${incoming.items.length}건을 읽었습니다(새로 추가 ${Math.max(0, store.items.length - before)}건, 같은 가설은 더 최근 수정본 유지).`);
        warm();
      } catch (_) {
        toast("JSON 파일을 읽지 못했습니다.");
      }
    };
    reader.readAsText(file);
  }

  function onClick(ev) {
    const el = ev.target.closest("button, [data-thesis-goto]");
    if (!el) return;
    const d = el.dataset;
    if (d.thesisGoto !== undefined) { if (typeof activateTab === "function") activateTab("bulk", { sub: "tools", push: true }); render(); openFold(); return; }
    if (!$("thesisPanel")?.contains(el)) return;
    if (d.thesisNew !== undefined) { draft = newDraft(); render(); setTimeout(() => $("thesisTicker")?.focus(), 30); return; }
    if (d.thesisFilter) { filter = d.thesisFilter; render(); return; }
    if (d.condPreset !== undefined) {
      readDraftFromForm();
      if (draft.conditions.length >= core().MAX_CONDITIONS) return;
      const p = PRESETS[Number(d.condPreset)];
      draft.conditions.push({ id: condId(), ...p.cond });
      renderForm();
      return;
    }
    if (d.condAdd !== undefined) {
      readDraftFromForm();
      draft.conditions.push({ id: condId(), metric: "pe", op: "gt", value: "" });
      renderForm();
      return;
    }
    if (d.condDel) { readDraftFromForm(); draft.conditions = draft.conditions.filter((c) => c.id !== d.condDel); renderForm(); return; }
    if (d.thesisCancel !== undefined) { draft = null; renderForm(); return; }
    if (d.thesisSave !== undefined) { saveDraft(); return; }
    if (d.thesisOpen) { if (typeof selectTicker === "function") selectTicker(d.thesisOpen, { openSearch: true }); return; }
    if (d.thesisEdit) {
      const t = store.items.find((x) => x.id === d.thesisEdit);
      if (!t) return;
      draft = newDraft(t.ticker, { editingId: t.id, text: t.text, target: t.target ?? "", stop: t.stop ?? "", entryPrice: t.entryPrice ?? "", conditions: t.conditions.map((c) => ({ ...c })) });
      render();
      $("thesisForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (d.thesisClose) { closingId = d.thesisClose; render(); return; }
    if (d.thesisCloseCancel !== undefined) { closingId = null; render(); return; }
    if (d.thesisCloseOk) {
      const t = store.items.find((x) => x.id === d.thesisCloseOk);
      if (!t) return;
      const row = stockByTicker(t.ticker);
      const exit = { asOf: snapshotAsOf(), price: row ? Number(row.price) || null : null, ...benchNow() };
      upsert(core().closeThesis(t, exit, $("thesisCloseReason")?.value || "other", nowIso()));
      closingId = null;
      save();
      evaluateAll();
      refreshSurfaces();
      toast("가설을 종료했습니다. 성적은 벤치마크 대비로 집계됩니다.");
      return;
    }
    if (d.thesisDel) {
      const t = store.items.find((x) => x.id === d.thesisDel);
      if (!t) return;
      if (!window.confirm(`${label(t.ticker)} 가설을 삭제할까요? 이력·성적에서도 사라집니다.`)) return;
      store.items = store.items.filter((x) => x.id !== t.id);
      store.deleted = [...store.deleted, t.id].slice(-300);
      save();
      evaluateAll();
      refreshSurfaces();
      return;
    }
    if (d.thesisReviewed) {
      const t = store.items.find((x) => x.id === d.thesisReviewed);
      if (!t) return;
      upsert({ ...t, reviewedAt: nowIso(), updatedAt: nowIso() });
      save();
      evaluateAll();
      refreshSurfaces();
      return;
    }
    if (d.thesisExport === "json") {
      download(`mir-theses-${today()}.json`, JSON.stringify({ app: "Mir", kind: "thesis-tracker", version: 1, exportedAt: nowIso(), thesisTracker: store }, null, 2), "application/json");
      return;
    }
    if (d.thesisExport === "csv") {
      download(`mir-theses-${today()}.csv`, `﻿${core().toCsv(store.items)}`, "text/csv;charset=utf-8");
      return;
    }
    if (d.thesisImport !== undefined) { $("thesisImportFile")?.click(); }
  }

  function applyRoute() {
    if (routeApplied) return;
    routeApplied = true;
    let params = null;
    try { params = new URLSearchParams(window.location.search); } catch (_) { params = null; }
    const t = params && params.get("thesis");
    if (t != null) setTimeout(() => openForTicker(t === "1" || t === "" ? "" : t), 0);
  }

  function setup() {
    if (!core()) return;
    load();
    if (!bound) {
      bound = true;
      document.addEventListener("click", onClick);
      $("thesisImportFile")?.addEventListener("change", (e) => {
        const f = e.target.files && e.target.files[0];
        if (f) importFile(f);
        e.target.value = "";
      });
      $("thesisFromTicker")?.addEventListener("click", () => openForTicker(typeof selectedTicker !== "undefined" ? selectedTicker : ""));
    }
    render();
    renderStrip();
    applyRoute();
    warm();
  }

  function onMarketChange() {
    draft = null;
    closingId = null;
    evals = new Map();
    if (!bound) { setup(); return; }
    render();
    renderStrip();
    warm();
  }

  // 클라우드 동기화(watchlist.js cloudSyncPayload/pullCloudSync 가 부른다).
  function cloudPayload() {
    if (!core()) return undefined;
    const c = core().compactForCloud(store, 16000);
    return { items: c.items, deleted: c.deleted };
  }

  function applyCloud(remote) {
    if (!core() || !remote || typeof remote !== "object") return;
    store = core().mergeStores(store, remote);
    save({ push: false });
    evaluateAll();
    refreshSurfaces();
  }

  // 피처 데이터·MAP_FUNDAMENTALS 가 늦게 도착하면 다시 평가(refreshFeatureViews 가 부른다).
  function onDataRefresh() {
    if (!store.items.length) return;
    evaluateAll();
    render();
    renderStrip();
  }

  window.MirThesis = {
    setup,
    onMarketChange,
    openForTicker,
    alertItems,
    cloudPayload,
    applyCloud,
    onDataRefresh,
    get items() { return store.items.slice(); },
  };
})();
