// event-study.js — 이벤트 스터디 워크벤치(종목 탭 › 공시 › 이벤트 스터디) + 종목 분석 카드 + 트래커 링크
// =====================================================
// 데이터: window.EVENT_STUDY_INDEX (scripts/build_event_study.py → data/event_study/index.js, lazy)
//   유형을 고르면 data/event_study/<유형>.json 하나만 fetch 한다. 종목 분석 카드는
//   data/event_study/tk/<시장>_NN.json(16 샤드) 하나만 받는다.
// 계산: event-study-core.js(순수). 신호 성적표(signal-scorecard.js)는 'Mir 가 띄운 신호의 발행 뒤 성적',
//   여기는 '과거 이벤트 전체'에 대한 연구 도구다 — 매매 신호가 아니라 정보로만 보여 준다.
// 클래식 스크립트(전역 공유). 선언만 있고 로드 시점 실행문이 없다. 최상위 이름은 es* 접두 +
// renderEventStudy / openEventStudy / eventStudyLink / renderStockEventStudy 만 밖에서 부른다.

const ES_HORIZONS = [1, 5, 20, 60];
const ES_MAX_COMPARE = 3;
const ES_SERIES_CLASS = ["es-s0", "es-s1", "es-s2", "es-s3"];
const ES_VERDICT = {
  hold: "판단 보류(표본 30 미만)",
  pos: "0보다 큼(95% 구간)",
  neg: "0보다 작음(95% 구간)",
  unclear: "0과 구분 안 됨",
};
// 대조군이 있으면 판정은 짝 차이(이벤트 − 같은 종목 무작위 날짜) 기준이다.
const ES_VERDICT_CTRL = {
  hold: "판단 보류(표본 30 미만)",
  pos: "대조군보다 높음(95% 구간)",
  neg: "대조군보다 낮음(95% 구간)",
  unclear: "대조군과 구분 안 됨",
};
const esState = {
  market: null, type: null, compare: [], period: "all", caps: [], sector: "", sizeB: [],
  method: "ma", anchor: "d0", weighting: "event", showControl: true, ticker: "",
};
const _esShardCache = {};   // url → Promise<payload|null>
const _esTkCache = {};      // url → Promise<payload|null>
let _esRenderSeq = 0;

function esIndex() {
  const p = window.EVENT_STUDY_INDEX;
  return p && Array.isArray(p.types) ? p : null;
}
function esMarket() { return typeof marketCfg === "function" ? marketCfg().id : "us"; }
function esTypes(market) {
  const ix = esIndex();
  return ix ? ix.types.filter((t) => t.m === (market || esMarket())) : [];
}
function esType(k) {
  const ix = esIndex();
  return ix ? ix.types.find((t) => t.k === k) || null : null;
}
function esPct(v, digits = 1) {
  if (v == null || !Number.isFinite(v)) return "—";
  const x = v * 100;
  return `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(digits)}%`;
}
function esRate(v) { return v == null || !Number.isFinite(v) ? "—" : `${Math.round(v * 100)}%`; }
function esVer() { const ix = esIndex(); return encodeURIComponent((ix && ix.updatedAtKst) || ""); }

function esFetchJson(cache, url) {
  if (!cache[url]) {
    cache[url] = fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((j) => { if (!j) delete cache[url]; return j; });
  }
  return cache[url];
}
function esFetchType(t) { return esFetchJson(_esShardCache, `${t.file}?v=${esVer()}`); }

// ---------------------------------------------------------------- 트래커 · 딥링크
// 공시 트래커 머리줄에 붙는 한 줄 링크. 데이터(인덱스)가 아직 없어도 링크는 보여 준다(누르면 받는다).
function eventStudyLink(keys, opts = {}) {
  const list = (Array.isArray(keys) ? keys : [keys]).filter(Boolean);
  if (!list.length) return "";
  const m = opts.market || esMarket();
  const k = list.find((x) => x.startsWith(`${m}_`));
  if (!k) return "";
  const t = esType(k);
  const label = opts.label || (t ? `${t.label}${t.n ? ` ${t.n.toLocaleString()}건` : ""}` : "");
  return `<button type="button" class="es-link${opts.inline ? " is-inline" : ""}" data-es-type="${escapeHtml(k)}" title="과거 이벤트 전체의 발표 뒤 초과수익(이벤트 스터디)">이 유형의 과거 반응 보기${label ? ` · ${escapeHtml(label)}` : ""} →</button>`;
}

// 트래커 머리줄(meta)용: 앞에 ' · ' 를 붙인 인라인 링크. 이 시장에 없는 유형이면 빈 문자열.
function esTrackerLink(keys) {
  esBindOnce();
  const html = eventStudyLink(keys, { inline: true });
  return html ? ` · ${html}` : "";
}

function esBindOnce() {
  if (document.body.dataset.esBound) return;
  document.body.dataset.esBound = "1";
  document.addEventListener("click", (e) => {
    const link = e.target.closest("[data-es-type]");
    if (link && !link.closest("#eventStudyRoot")) {
      e.preventDefault();
      openEventStudy(link.dataset.esType, { ticker: link.dataset.esTicker || "" });
      return;
    }
    const root = e.target.closest("#eventStudyRoot");
    if (!root) return;
    const btn = e.target.closest("[data-es-act]");
    if (btn) { esHandleAct(btn); return; }
    const tk = e.target.closest(".es-recent [data-ticker]");
    if (tk && typeof selectTicker === "function") selectTicker(tk.dataset.ticker, { openSearch: true });
  });
  document.addEventListener("change", (e) => {
    const el = e.target.closest("#eventStudyRoot [data-es-field]");
    if (!el) return;
    const f = el.dataset.esField;
    if (f === "type") { esState.type = el.value; esState.sizeB = []; esState.compare = esState.compare.filter((k) => k !== el.value); }
    else if (f === "compareAdd") { if (el.value && el.value !== esState.type && !esState.compare.includes(el.value) && esState.compare.length < ES_MAX_COMPARE) esState.compare.push(el.value); }
    else if (f === "period") esState.period = el.value;
    else if (f === "sector") esState.sector = el.value;
    renderEventStudy();
  });
}

function esHandleAct(btn) {
  const act = btn.dataset.esAct;
  const v = btn.dataset.esVal;
  const toggle = (arr, x) => (arr.includes(x) ? arr.filter((y) => y !== x) : arr.concat([x]));
  if (act === "cap") esState.caps = v === "all" ? [] : toggle(esState.caps, Number(v));
  else if (act === "size") esState.sizeB = v === "all" ? [] : toggle(esState.sizeB, Number(v));
  else if (act === "method") esState.method = v;
  else if (act === "anchor") esState.anchor = v;
  else if (act === "weight") esState.weighting = v;
  else if (act === "control") esState.showControl = !esState.showControl;
  else if (act === "rmCompare") esState.compare = esState.compare.filter((k) => k !== v);
  else if (act === "rmTicker") esState.ticker = "";
  else return;
  renderEventStudy();
}

// 공시 › 이벤트 스터디로 가서 유형(과 종목)을 고른다.
function openEventStudy(typeKey, { ticker = "", push = true } = {}) {
  esBindOnce();
  if (typeKey) {
    esState.type = typeKey;
    esState.market = typeKey.split("_")[0];
    esState.compare = [];
    esState.sizeB = [];
  }
  esState.ticker = ticker || "";
  if (typeof activateTab === "function" && typeof currentTab !== "undefined" && currentTab !== "search") activateTab("search", { push: false, sub: "eventstudy" });
  if (typeof activateSearchSub === "function") activateSearchSub("eventstudy", { push });
  else renderEventStudy();
  const host = byId("sub-eventstudy");
  if (host) setTimeout(() => host.scrollIntoView({ behavior: "auto", block: "start" }), 60);
}

// ---------------------------------------------------------------- 필터 → 기간
function esPeriodRange(period, lastDate) {
  if (!period || period === "all") return { from: null, to: null };
  if (/^\d{4}$/.test(period)) return { from: `${period}-01-01`, to: `${period}-12-31` };
  const yrs = period === "1y" ? 1 : period === "3y" ? 3 : null;
  if (!yrs || !lastDate) return { from: null, to: null };
  const d = new Date(`${lastDate}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - yrs);
  return { from: d.toISOString().slice(0, 10), to: null };
}

function esFilters(t, market) {
  const ix = esIndex();
  const mk = (ix.markets || {})[market] || {};
  const range = esPeriodRange(esState.period, t.last);
  const sectorIdx = esState.sector === "" ? null : (mk.sectors || []).indexOf(esState.sector);
  return {
    market, from: range.from, to: range.to,
    caps: esState.caps.length ? esState.caps : null,
    sectors: sectorIdx != null && sectorIdx >= 0 ? [sectorIdx] : null,
    sizeBuckets: t.size && esState.sizeB.length ? esState.sizeB : null,
    sizeBins: t.size ? t.size.bins : null,
    ticker: esState.ticker || null,
    requireMM: esState.method === "mm",
  };
}

// ---------------------------------------------------------------- 렌더(워크벤치)
function renderEventStudy() {
  const host = byId("eventStudyRoot");
  if (!host) return;
  esBindOnce();
  const ix = esIndex();
  if (!ix) {
    host.innerHTML = '<p class="muted">이벤트 스터디 데이터를 불러오는 중…</p>';
    if (typeof ensureFeatureData === "function") {
      ensureFeatureData("eventStudy").then((ok) => {
        if (ok) renderEventStudy();
        else host.innerHTML = '<p class="muted">이벤트 스터디 데이터를 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요.</p>';
      });
    }
    return;
  }
  const market = esMarket();
  const types = esTypes(market).filter((t) => t.n > 0);
  if (!types.length) {
    host.innerHTML = `<p class="muted">이 시장의 이벤트 스터디 표본이 아직 없습니다(기준 ${escapeHtml(ix.updatedAtKst || "")}).</p>`;
    return;
  }
  if (esState.market !== market || !types.some((t) => t.k === esState.type)) {
    if (esState.market !== market) esState.ticker = "";
    esState.market = market;
    esState.type = (types.find((t) => t.k === `${market}_earn`) || types[0]).k;
    esState.compare = [];
    esState.sizeB = [];
    esState.sector = "";
  }
  esState.compare = esState.compare.filter((k) => types.some((t) => t.k === k));
  const t = types.find((x) => x.k === esState.type);
  host.innerHTML = `${esControlsHtml(ix, market, types, t)}<div class="es-result" id="esResult"><p class="muted">표본을 불러오는 중…</p></div>`;
  const seq = ++_esRenderSeq;
  const sel = [t].concat(esState.compare.map((k) => types.find((x) => x.k === k)).filter(Boolean));
  Promise.all(sel.map((x) => esFetchType(x))).then((payloads) => {
    if (seq !== _esRenderSeq) return;
    const out = byId("esResult");
    if (!out) return;
    if (!payloads[0]) { out.innerHTML = '<p class="muted">표본 파일을 받지 못했습니다. 잠시 뒤 다시 시도해 주세요.</p>'; return; }
    out.innerHTML = esResultHtml(ix, market, sel, payloads);
  });
}

function esSeg(act, options, isActive) {
  return `<div class="insider-filter es-seg" role="group">${options.map(([v, label, title]) => `<button type="button" data-es-act="${act}" data-es-val="${escapeHtml(String(v))}" class="${isActive(v) ? "is-active" : ""}"${title ? ` title="${escapeHtml(title)}"` : ""}>${escapeHtml(label)}</button>`).join("")}</div>`;
}

function esControlsHtml(ix, market, types, t) {
  const mk = (ix.markets || {})[market] || {};
  const groups = [];
  types.forEach((x) => { if (!groups.includes(x.group)) groups.push(x.group); });
  const typeOpts = (exclude) => groups.map((g) => `<optgroup label="${escapeHtml(g)}">${types.filter((x) => x.group === g && !exclude.includes(x.k)).map((x) => `<option value="${escapeHtml(x.k)}"${x.k === esState.type && !exclude.length ? " selected" : ""}>${escapeHtml(x.label)} (${x.n.toLocaleString()})</option>`).join("")}</optgroup>`).join("");
  const years = [];
  const y0 = Number(String(ix.types.reduce((a, x) => (x.first && (!a || x.first < a) ? x.first : a), "") || "2021").slice(0, 4));
  const y1 = Number(String(t.last || "").slice(0, 4)) || new Date().getFullYear();
  for (let y = y1; y >= y0; y--) years.push(y);
  const periodOpts = [["all", "전체 기간"], ["3y", "최근 3년"], ["1y", "최근 1년"]].concat(years.map((y) => [String(y), `${y}년`]))
    .map(([v, l]) => `<option value="${v}"${esState.period === v ? " selected" : ""}>${l}</option>`).join("");
  const sectorOpts = [`<option value="">전체 섹터</option>`].concat((mk.sectors || []).map((s) => `<option value="${escapeHtml(s)}"${esState.sector === s ? " selected" : ""}>${escapeHtml(s)}</option>`)).join("");
  const capOpts = [["all", "전체"]].concat((mk.capBuckets || []).map((lab, i) => [i, lab]));
  const sizeLabels = t.size ? MirEventStudyCore.sizeBucketLabels(t.size.bins, t.size.unit) : [];
  const compareChips = esState.compare.map((k, i) => {
    const x = types.find((y) => y.k === k);
    return x ? `<span class="es-chip ${ES_SERIES_CLASS[i + 1]}"><i class="es-sw"></i>${escapeHtml(x.label)}<button type="button" data-es-act="rmCompare" data-es-val="${escapeHtml(k)}" aria-label="비교에서 빼기">✕</button></span>` : "";
  }).join("");
  const tickerChip = esState.ticker
    ? `<span class="es-chip"><b>종목</b> ${escapeHtml(typeof stockLabel === "function" ? stockLabel(esState.ticker) : esState.ticker)}<button type="button" data-es-act="rmTicker" aria-label="종목 조건 빼기">✕</button></span>`
    : "";
  return `<div class="es-controls">
    <div class="es-row">
      <label class="es-field grow">이벤트 유형<select data-es-field="type">${typeOpts([])}</select></label>
      <label class="es-field">기간(0일 기준)<select data-es-field="period">${periodOpts}</select></label>
      <label class="es-field">섹터<select data-es-field="sector">${sectorOpts}</select></label>
    </div>
    <p class="es-desc muted">${escapeHtml(t.desc || "")}</p>
    <div class="es-row es-row-wrap">
      <div class="es-group"><span class="es-glabel">시총 구간 <small class="muted">(이벤트 시점 근사)</small></span>${esSeg("cap", capOpts, (v) => (v === "all" ? !esState.caps.length : esState.caps.includes(v)))}</div>
      ${t.size ? `<div class="es-group"><span class="es-glabel">${escapeHtml(t.size.label)} <small class="muted">(크기 있는 표본 ${t.nSize.toLocaleString()}/${t.n.toLocaleString()})</small></span>${esSeg("size", [["all", "전체"]].concat(sizeLabels.map((l, i) => [i, l])), (v) => (v === "all" ? !esState.sizeB.length : esState.sizeB.includes(v)))}</div>` : ""}
    </div>
    <div class="es-row es-row-wrap">
      <div class="es-group"><span class="es-glabel">초과수익 방법</span>${esSeg("method", [["ma", "시장조정", "종목 − 벤치마크"], ["mm", "시장모형", "추정창 −250~−30일 α·β"]], (v) => v === esState.method)}</div>
      <div class="es-group"><span class="es-glabel">누적 시작</span>${esSeg("anchor", [["pre", "−5일부터"], ["d0", "0일부터"], ["d1", "+1일부터", "공시 시각을 모르는 유형은 0일에 공시 전 움직임이 섞일 수 있습니다"]], (v) => v === esState.anchor)}</div>
      <div class="es-group"><span class="es-glabel">가중</span>${esSeg("weight", [["event", "이벤트 동일"], ["day", "날짜 동일", "같은 날 몰린 이벤트를 하루 한 표로"]], (v) => v === esState.weighting)}</div>
      <div class="es-group"><span class="es-glabel">대조군</span>${esSeg("control", [["on", esState.showControl ? "표시 중" : "숨김"]], () => esState.showControl)}</div>
    </div>
    <div class="es-row es-row-wrap">
      <label class="es-field">다른 유형과 비교 <small class="muted">(최대 ${ES_MAX_COMPARE}개)</small><select data-es-field="compareAdd"${esState.compare.length >= ES_MAX_COMPARE ? " disabled" : ""}><option value="">+ 비교 유형 추가</option>${typeOpts([esState.type].concat(esState.compare))}</select></label>
      <div class="es-chips">${`<span class="es-chip ${ES_SERIES_CLASS[0]}"><i class="es-sw"></i>${escapeHtml(t.label)}</span>`}${compareChips}${tickerChip}</div>
    </div>
  </div>`;
}

function esResultHtml(ix, market, sel, payloads) {
  const core = MirEventStudyCore;
  const points = ix.points;
  const series = sel.map((t, i) => {
    const pl = payloads[i];
    if (!pl) return { t, rows: [], agg: null };
    const rows = core.filterRows(pl.rows, esFilters(t, market));
    // 부트스트랩 2,000회(신호 성적표와 같음). 표본이 5,000건을 넘으면 화면이 멈추지 않게 1,000회.
    const agg = rows.length ? core.aggregate(rows, { points, scale: ix.scale, method: esState.method, anchor: esState.anchor, weighting: esState.weighting, B: rows.length > 5000 ? 1000 : 2000 }) : null;
    return { t, rows, agg };
  });
  const main = series[0];
  const warn = [];
  if (!main.agg || !main.agg.n) {
    return `<p class="muted">조건에 맞는 표본이 없습니다. 기간·시총·섹터·크기 조건을 넓혀 보세요.</p>${esLimitsHtml(ix, market)}`;
  }
  // 다중비교: 비교 모드면 표에 나온 모든 (유형 × 기간) 검정에 BH-FDR 을 건다.
  const hIdx = ES_HORIZONS.map((h) => points.indexOf(h));
  let qMap = null;
  if (series.length > 1) {
    const keys = [], ps = [];
    series.forEach((s, si) => { if (s.agg) hIdx.forEach((pi, hi) => { keys.push(`${si}:${hi}`); ps.push(s.agg.event[pi].p); }); });
    const qs = core.bhAdjust(ps);
    qMap = new Map(keys.map((k, i) => [k, qs[i]]));
    warn.push(`여러 유형을 한꺼번에 비교하면 우연히 '구간이 0을 벗어난' 결과가 늘어납니다. 표의 q 값은 ${ps.length}개 검정 전체를 FDR 보정한 값으로, 0.1 을 넘으면 우연과 구분하기 어렵습니다.`);
  }
  const cl = main.agg.clustering;
  if (cl.warn) warn.push(`같은 날 군집: 0일이 ${escapeHtml(MirEventStudyCore.dayIso(cl.topDay))} 하루에 ${cl.top.toLocaleString()}건(${Math.round(cl.topShare * 100)}%) 몰렸습니다(날짜당 평균 ${cl.perDay.toFixed(1)}건). 평균이 그날 하루 시장 움직임에 끌릴 수 있으니 '날짜 동일' 가중으로도 확인해 보세요.`);
  if (main.t.timing === "date" && esState.anchor !== "d1") warn.push("이 유형은 공시 시각이 없어 공시일을 0일로 뒀습니다. 장 마감 뒤 공시는 반응이 +1일에 나타나므로 '+1일부터'로도 확인해 보세요.");
  if (main.t.accrual) warn.push("최근부터 모으기 시작한 유형이라 표본 기간이 짧습니다.");
  if (esState.sizeB.length && main.t.size) warn.push(`크기 조건을 걸면 ${escapeHtml(main.t.size.label)} 값이 있는 표본(${main.t.nSize.toLocaleString()}건)만 남습니다.`);
  if (esState.method === "mm") warn.push(`시장모형은 이벤트 전 가격 이력이 충분한 표본만 씁니다(이 유형 ${main.t.nMM.toLocaleString()}/${main.t.n.toLocaleString()}건). 대조군은 시장조정 기준입니다.`);
  if (esState.ticker) warn.push("종목 한 곳의 표본은 적어 한두 번의 반응이 평균을 좌우합니다.");

  const D0 = MirEventStudyCore.FIELD.d0;
  const firstD = MirEventStudyCore.dayIso(main.rows.reduce((a, r) => Math.min(a, r[D0]), main.rows[0][D0]));
  const lastD = MirEventStudyCore.dayIso(main.rows.reduce((a, r) => Math.max(a, r[D0]), main.rows[0][D0]));
  const methodLabel = esState.method === "mm" ? "시장모형" : "시장조정";
  const anchorLabel = { pre: "−5일부터 누적", d0: "0일부터 누적(−1일 = 0)", d1: "+1일부터 누적(0일 = 0)" }[esState.anchor];
  const mk = (ix.markets || {})[market] || {};
  const benchText = Object.values(mk.benchmarks || {}).map((b) => b.label).join(" · ");
  const head = `<div class="es-head">
      <div><b>${escapeHtml(main.t.label)}</b> <span class="muted">표본 ${main.agg.n.toLocaleString()}건 · 0일 ${escapeHtml(firstD)} ~ ${escapeHtml(lastD)} · ${cl.days.toLocaleString()}개 날짜</span></div>
      <div class="muted es-sub">${methodLabel} 초과수익 · ${anchorLabel} · 벤치마크 ${escapeHtml(benchText)} · ${esState.weighting === "day" ? "날짜 동일 가중" : "이벤트 동일 가중"}</div>
    </div>`;
  return `${head}
    ${esChartHtml(ix, series)}
    ${esTableHtml(ix, series, qMap)}
    ${warn.length ? `<ul class="es-warn">${warn.map((w) => `<li>${w}</li>`).join("")}</ul>` : ""}
    ${esRecentHtml(ix, main)}
    ${esLimitsHtml(ix, market)}`;
}

function esChartHtml(ix, series) {
  const points = ix.points;
  // viewBox 를 실제 폭에 맞춘다 — 고정 640 이면 폰에서 눈금 글자가 5px 로 줄고 넓은 화면에선 부풀었다.
  const hostW = (typeof byId === "function" && byId("eventStudyRoot") && byId("eventStudyRoot").clientWidth) || 640;
  const W = Math.max(300, Math.min(1100, Math.round(hostW))), H = W < 480 ? 220 : 260, L = 44, R = 12, T = 12, B = 28;
  const xMin = points[0], xMax = points[points.length - 1];
  const X = (p) => L + ((p - xMin) / (xMax - xMin)) * (W - L - R);
  const vals = [0];
  const main = series[0];
  series.forEach((s, si) => {
    if (!s.agg) return;
    s.agg.event.forEach((e) => { if (e.mean != null) vals.push(e.mean); if (si === 0 && e.lo != null) vals.push(e.lo, e.hi); });
    if (si === 0 && esState.showControl && s.agg.control) s.agg.control.forEach((e) => { if (e.mean != null) vals.push(e.mean); });
  });
  let yMin = Math.min(...vals), yMax = Math.max(...vals);
  const pad = Math.max((yMax - yMin) * 0.08, 0.002);
  yMin -= pad; yMax += pad;
  const Y = (v) => T + (1 - (v - yMin) / (yMax - yMin)) * (H - T - B);
  const line = (arr, key) => {
    let d = "";
    arr.forEach((e, i) => { const v = e[key]; if (v == null) return; d += `${d ? "L" : "M"}${X(points[i]).toFixed(1)},${Y(v).toFixed(1)}`; });
    return d;
  };
  // y 눈금 4~5개
  const step = esNiceStep((yMax - yMin) / 4);
  const ticks = [];
  for (let v = Math.ceil(yMin / step) * step; v <= yMax + 1e-12; v += step) ticks.push(v);
  const xt = [-5, 0, 5, 10, 20, 30, 40, 60].filter((p) => p >= xMin && p <= xMax);
  let band = "";
  if (main.agg) {
    const ev = main.agg.event;
    const up = [], dn = [];
    ev.forEach((e, i) => { if (e.lo != null && e.hi != null) { up.push(`${X(points[i]).toFixed(1)},${Y(e.hi).toFixed(1)}`); dn.unshift(`${X(points[i]).toFixed(1)},${Y(e.lo).toFixed(1)}`); } });
    if (up.length > 1) band = `<polygon class="es-band" points="${up.concat(dn).join(" ")}"/>`;
  }
  const paths = series.map((s, si) => (s.agg ? `<path class="es-line ${ES_SERIES_CLASS[si]}" d="${line(s.agg.event, "mean")}"/>` : "")).join("");
  const med = main.agg ? `<path class="es-line es-median ${ES_SERIES_CLASS[0]}" d="${line(main.agg.event, "median")}"/>` : "";
  const ctrl = esState.showControl && main.agg && main.agg.control ? `<path class="es-line es-control" d="${line(main.agg.control, "mean")}"/>` : "";
  const label = `${main.t.label} 평균 누적 초과수익 곡선`;
  return `<div class="es-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(label)}">
      ${ticks.map((v) => `<line class="es-grid" x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="es-tick" x="${L - 6}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end">${(v * 100).toFixed(Math.abs(step * 100) < 1 ? 1 : 0)}%</text>`).join("")}
      <line class="es-zero" x1="${L}" x2="${W - R}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}"/>
      <line class="es-day0" x1="${X(0).toFixed(1)}" x2="${X(0).toFixed(1)}" y1="${T}" y2="${H - B}"/>
      ${xt.map((p) => `<text class="es-tick" x="${X(p).toFixed(1)}" y="${H - 10}" text-anchor="middle">${p > 0 ? "+" : ""}${p}${p === 0 ? "일" : ""}</text>`).join("")}
      ${band}${ctrl}${med}${paths}
    </svg>
    <div class="es-legend">
      <span><i class="es-sw ${ES_SERIES_CLASS[0]}"></i>평균</span>
      <span><i class="es-sw es-sw-band"></i>95% 구간(날짜 묶음 부트스트랩)</span>
      <span><i class="es-sw es-sw-dash ${ES_SERIES_CLASS[0]}"></i>중앙값</span>
      ${esState.showControl && main.agg && main.agg.control ? '<span><i class="es-sw es-sw-control"></i>대조군(같은 종목 무작위 날짜)</span>' : ""}
      ${series.slice(1).map((s, i) => `<span><i class="es-sw ${ES_SERIES_CLASS[i + 1]}"></i>${escapeHtml(s.t.label)}</span>`).join("")}
    </div></div>`;
}
function esNiceStep(raw) {
  if (!(raw > 0)) return 0.01;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
}

function esTableHtml(ix, series, qMap) {
  const core = MirEventStudyCore;
  const points = ix.points;
  const head = `<tr><th>유형</th><th class="num">기간</th><th class="num">평균</th><th class="num">95% 구간</th><th class="num">중앙값</th><th class="num">양(+) 비율</th><th class="num">표본</th>${qMap ? '<th class="num">q (FDR)</th>' : ""}<th class="num">대조군 평균</th><th class="num">대조 대비 차이</th><th>판정</th></tr>`;
  const body = series.map((s, si) => {
    if (!s.agg) return "";
    return ES_HORIZONS.map((h, hi) => {
      const pi = points.indexOf(h);
      const e = s.agg.event[pi];
      const c = s.agg.control ? s.agg.control[pi] : null;
      const d = s.agg.diff ? s.agg.diff[pi] : null;
      const q = qMap ? qMap.get(`${si}:${hi}`) : null;
      const useCtrl = d && d.n >= core.MIN_SAMPLE;
      const v = useCtrl ? core.verdict(d) : core.verdict(e);
      const hLabel = esState.anchor === "pre" ? `−5~+${h}일` : esState.anchor === "d1" ? `+1~+${h}일` : `0~+${h}일`;
      return `<tr class="${hi === 0 ? "es-first" : ""}">
        ${hi === 0 ? `<td rowspan="${ES_HORIZONS.length}"><i class="es-sw ${ES_SERIES_CLASS[si]}"></i> ${escapeHtml(s.t.label)}</td>` : ""}
        <td class="num">${hLabel}</td>
        <td class="num"><b class="${cls(e.mean)}">${esPct(e.mean, 2)}</b></td>
        <td class="num muted">${e.lo == null ? "—" : `${esPct(e.lo, 2)} ~ ${esPct(e.hi, 2)}`}</td>
        <td class="num">${esPct(e.median, 2)}</td>
        <td class="num">${esRate(e.posRate)}</td>
        <td class="num">${e.n.toLocaleString()}</td>
        ${qMap ? `<td class="num">${q == null ? "—" : q < 0.001 ? "<0.001" : q.toFixed(3)}</td>` : ""}
        <td class="num muted">${c && c.n ? esPct(c.mean, 2) : "—"}</td>
        <td class="num">${d && d.n ? `${esPct(d.mean, 2)}<small class="muted"> (${esPct(d.lo, 1)}~${esPct(d.hi, 1)})</small>` : "—"}</td>
        <td class="es-verdict es-v-${v}">${(useCtrl ? ES_VERDICT_CTRL : ES_VERDICT)[v]}</td>
      </tr>`;
    }).join("");
  }).join("");
  return `<div class="es-table-wrap"><table class="es-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>
    <p class="muted es-note">판정은 대조군(같은 종목의 무작위 날짜)과의 차이 95% 구간이 0을 벗어났는지로 봅니다. 대조군 평균이 0에서 벗어난 만큼은 이벤트와 무관한 종목군 자체의 흐름(생존편향 포함)입니다. 비용은 반영하지 않았고, 과거 평균은 앞으로의 반응을 보장하지 않습니다.</p>`;
}

function esRecentHtml(ix, main) {
  const points = ix.points;
  const i1 = points.indexOf(1), i5 = points.indexOf(5), i20 = points.indexOf(20), im1 = points.indexOf(-1);
  const F = MirEventStudyCore.FIELD;
  const rows = main.rows.slice().sort((a, b) => b[F.d0] - a[F.d0]).slice(0, 15);
  const post = (r, i) => { const p = r[F.ma]; return p[i] == null || p[im1] == null ? null : (p[i] - p[im1]) / ix.scale; };
  const sizeCell = (r) => {
    const v = r[F.size];
    if (!main.t.size || v == null) return "—";
    return main.t.size.unit === "$" ? `$${Number(v).toLocaleString()}` : `${Number(v).toFixed(1)}${main.t.size.unit}`;
  };
  const body = rows.map((r) => `<tr>
      <td>${escapeHtml(MirEventStudyCore.dayIso(r[F.d0]))}${r[F.tm] === "a" ? ' <small class="muted" title="장 마감 뒤 접수 — 다음 거래일이 0일">장후</small>' : r[F.tm] === "b" ? ' <small class="muted">장전</small>' : ""}</td>
      <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r[0])}">${escapeHtml(typeof stockLabel === "function" ? stockLabel(r[0]) : r[0])}</button></td>
      ${main.t.size ? `<td class="num">${sizeCell(r)}</td>` : ""}
      <td class="num ${cls(post(r, i1))}">${esPct(post(r, i1))}</td>
      <td class="num ${cls(post(r, i5))}">${esPct(post(r, i5))}</td>
      <td class="num ${cls(post(r, i20))}">${esPct(post(r, i20))}</td>
    </tr>`).join("");
  return `<details class="es-recent"><summary>최근 표본 ${rows.length}건 (시장조정, 0일부터)</summary>
    <div class="es-table-wrap"><table class="es-table"><thead><tr><th>0일</th><th>종목</th>${main.t.size ? `<th class="num">${escapeHtml(main.t.size.label)}</th>` : ""}<th class="num">0~+1일</th><th class="num">0~+5일</th><th class="num">0~+20일</th></tr></thead><tbody>${body}</tbody></table></div></details>`;
}

function esLimitsHtml(ix, market) {
  const m = ix.method || {};
  const mk = (ix.markets || {})[market] || {};
  const st = mk.stats || {};
  return `<details class="about-data es-about"><summary>방법 · 한계 (생존편향 포함)</summary>
    <ul>
      ${["ma", "mm", "day0", "car", "control", "ci", "guard"].filter((k) => m[k]).map((k) => `<li>${escapeHtml(m[k])}</li>`).join("")}
      ${(ix.limits || []).map((x) => `<li><b>한계</b> ${escapeHtml(x)}</li>`).join("")}
      ${st.events ? `<li>이 시장 수집 이벤트 ${Number(st.events).toLocaleString()}건 중 경로 계산 ${Number(st.kept || 0).toLocaleString()}건 — 가격 이력 없음 ${Number(st.noPrice || 0).toLocaleString()} · 창 부족 ${Number(st.noWindow || 0).toLocaleString()} · 가격 오류 ${Number(st.badPrice || 0).toLocaleString()} · 중복 ${Number(st.deduped || 0).toLocaleString()}.</li>` : ""}
      ${mk.dartMissing && mk.dartMissing.length ? `<li>아직 반영되지 않은 DART 분기 ${mk.dartMissing.length}개(${escapeHtml(mk.dartMissing.slice(0, 4).join(", "))}…).</li>` : ""}
    </ul>
  </details>
  <p class="muted es-source">출처: ${escapeHtml(ix.source || "")} · 기준 ${escapeHtml(ix.updatedAtKst || "")}</p>`;
}

// ---------------------------------------------------------------- 종목 분석 카드
function renderStockEventStudy(item) {
  const host = byId("stockEventStudy");
  if (!host) return;
  const hide = () => { host.hidden = true; host.innerHTML = ""; };
  const ticker = item && item.ticker;
  const cfg = typeof marketCfg === "function" ? marketCfg() : { id: "us" };
  if (!ticker || (cfg.features && cfg.features.eventStudy === false)) return hide();
  const ix = esIndex();
  if (!ix) {
    if (typeof ensureFeatureData === "function") ensureFeatureData("eventStudy").then((ok) => { if (ok && selectedTicker === ticker) renderStockEventStudy(item); });
    return;
  }
  const m = cfg.id;
  const code = m === "us" ? String(ticker).toUpperCase() : String(ticker);
  const shard = MirEventStudyCore.shardOf(code, ix.tkShards || 16);
  const url = `data/event_study/tk/${m}_${String(shard).padStart(2, "0")}.json?v=${esVer()}`;
  esFetchJson(_esTkCache, url).then((pl) => {
    if (selectedTicker !== ticker) return;
    const rows = pl && pl.t ? pl.t[code] : null;
    if (!rows || !rows.length) return hide();
    esBindOnce();
    const sum = MirEventStudyCore.tickerSummary(rows, ix.scale);
    const body = sum.slice(0, 8).map((s) => {
      const t = esType(s.k);
      return `<tr>
        <td>${escapeHtml(t ? t.label : s.k)}</td>
        <td class="num">${s.n}</td>
        <td class="num ${cls(s.mean1)}">${esPct(s.mean1)}</td>
        <td class="num ${cls(s.mean5)}">${esPct(s.mean5)}</td>
        <td class="num ${cls(s.mean20)}">${esPct(s.mean20)}${s.n20 < s.n ? `<small class="muted"> (${s.n20})</small>` : ""}</td>
        <td class="num muted">${escapeHtml(s.last)}</td>
        <td><button type="button" class="es-link is-inline" data-es-type="${escapeHtml(s.k)}" data-es-ticker="${escapeHtml(code)}">이 종목만</button> · <button type="button" class="es-link is-inline" data-es-type="${escapeHtml(s.k)}">전체와 비교</button></td>
      </tr>`;
    }).join("");
    host.hidden = false;
    host.innerHTML = `<div class="es-card-head"><h3>과거 이벤트 반응</h3><span class="muted">시장조정 초과수익 평균 · 0일부터 · 기준 ${escapeHtml(ix.updatedAtKst || "")}</span></div>
      <div class="es-table-wrap"><table class="es-table es-card-table"><thead><tr><th>이벤트</th><th class="num">건수</th><th class="num">0~+1일</th><th class="num">0~+5일</th><th class="num">0~+20일</th><th class="num">최근</th><th></th></tr></thead><tbody>${body}</tbody></table></div>
      <p class="muted es-note">한 종목의 표본은 몇 건뿐이라 우연이 크게 작용합니다. 전체 표본과 비교해 보세요. 최근 약 5년 이벤트만 셌고, 매매 신호가 아닙니다.</p>`;
  });
}
