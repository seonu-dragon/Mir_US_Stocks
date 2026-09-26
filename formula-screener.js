// formula-screener.js — 사용자 정의 수식 스크리너(종목 탭 › 찾기 › 수식)
// =====================================================================
// 파서·평가기는 formula-core.js(window.MirFormulaCore, node 테스트 있음). eval / new Function 없음.
// 여기는 필드 목록(시장별로 실제 값이 있는 것만)·입력 UI(자동완성·조건 블록)·사용자 정의 열·
// 저장(기존 저장형 스크리너 목록·편입/이탈 델타와 공유)·공유 URL 을 맡는다.
//
// 데이터: 부팅 때 받은 시장 스냅샷(data.stocks) + map_fundamentals(MAP_FUNDAMENTALS). 새 데이터 파일 없음.
// 집계 함수(sectorMedian 등)의 모집단은 이 시장 전체(ETF 제외)이고, 유니버스 선택은 결과만 거른다.
//
// 딥링크: ?tab=search&sub=formula&fx=<encodeState 토큰>

// 필드 카탈로그. get(item, f) — item = 스냅샷 행, f = map_fundamentals 행({}).
// 목록에 실제로 보이는 건 이 시장에서 FX_MIN_COVERAGE 종목 이상 값이 있는 필드뿐이다.
const FX_MIN_COVERAGE = 30;
const fxNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const FX_FIELDS = [
  // 가격·수급(시장 스냅샷)
  { key: "price", label: "현재가", group: "가격", src: "스냅샷", get: (it) => fxNum(it.price) },
  { key: "changePct", label: "당일 등락률(%)", group: "가격", src: "스냅샷", get: (it) => fxNum(it.changePct) },
  { key: "weekChangePct", label: "1주 수익률(%)", group: "가격", src: "스냅샷", get: (it) => fxNum(it.weekChangePct) },
  { key: "monthChangePct", label: "1개월 수익률(%)", group: "가격", src: "스냅샷", get: (it) => fxNum(it.monthChangePct) },
  { key: "threeMonthChangePct", label: "3개월 수익률(%)", group: "가격", src: "스냅샷", get: (it) => fxNum(it.threeMonthChangePct) },
  { key: "ytdChangePct", label: "연초 대비 수익률(%)", group: "가격", src: "스냅샷", get: (it) => fxNum(it.ytdChangePct) },
  { key: "marketCap", label: "시가총액(US $B · KR 조원)", group: "가격", src: "스냅샷", get: (it) => { const v = itemCapForValuation(it); return v > 0 ? v : null; } },
  { key: "volumeRatio", label: "거래량 배율(20일 평균 대비)", group: "가격", src: "스냅샷", get: (it) => fxNum(it.volumeRatio) },
  { key: "rsi14", label: "RSI(14)", group: "기술", src: "스냅샷", get: (it) => rsiValue(it) },
  { key: "stochK", label: "스토캐스틱 %K", group: "기술", src: "스냅샷", get: (it) => fxNum(it.stochK) },
  { key: "newHighDistancePct", label: "52주 고점 대비 하락폭(%)", group: "기술", src: "스냅샷", get: (it) => fxNum(it.newHighDistancePct) },
  { key: "low52Dist", label: "52주 저가 대비 상승률(%)", group: "기술", src: "계산", get: (it) => { const v = low52DistPct(it); return Number.isFinite(v) ? v : null; } },
  { key: "rangePos5yPct", label: "5년 가격 범위 내 위치(%)", group: "기술", src: "스냅샷", get: (it) => fxNum(it.rangePos5yPct) },
  { key: "vol20", label: "20일 변동성(일간 %)", group: "기술", src: "계산", get: (it) => (typeof scanStdev20 === "function" ? scanStdev20(it.closeSeries) : null) },
  // 이익(스냅샷)
  // -999 는 나스닥 eps 표의 결측 표식이다(fundamentals_sanity.py SENTINELS). 다음 빌드부터 원천에서 빠진다.
  { key: "epsTtm", label: "EPS(TTM)", group: "이익", src: "스냅샷", get: (it) => { const v = epsTtmValue(it); return v === -999 ? null : v; } },
  { key: "epsNextY", label: "예상 EPS(다음 해, 추정치)", group: "이익", src: "스냅샷", get: (it) => fxNum(it.epsNextY) },
  { key: "epsGrowthEst", label: "예상 EPS 성장률(%, 추정치)", group: "이익", src: "계산", get: (it) => { const a = Number(it.epsTtm), b = Number(it.epsNextY); return a > 0 && Number.isFinite(b) ? (b / a - 1) * 100 : null; } },
  // 밸류·재무(map_fundamentals)
  { key: "pe", label: "PER", group: "밸류", src: "map_fundamentals", get: (it, f) => fxNum(f.pe) },
  { key: "forwardPE", label: "선행 PER", group: "밸류", src: "map_fundamentals", get: (it, f) => fxNum(f.forwardPE) },
  { key: "pb", label: "PBR", group: "밸류", src: "map_fundamentals", get: (it, f) => fxNum(f.pb) },
  { key: "ps", label: "PSR", group: "밸류", src: "map_fundamentals", get: (it, f) => fxNum(f.ps) },
  { key: "peg", label: "PEG", group: "밸류", src: "map_fundamentals", get: (it, f) => fxNum(f.peg) },
  { key: "evEbitda", label: "EV/EBITDA", group: "밸류", src: "map_fundamentals", get: (it, f) => fxNum(f.evEbitda) },
  { key: "evEbit", label: "EV/EBIT", group: "밸류", src: "map_fundamentals", get: (it, f) => fxNum(f.evEbit) },
  { key: "pfcf", label: "P/FCF", group: "밸류", src: "map_fundamentals", get: (it, f) => fxNum(f.pfcf) },
  { key: "valueScore", label: "저평가 종합 점수(멀티플 백분위)", group: "밸류", src: "map_fundamentals", get: (it, f) => fxNum(f.valueScore) },
  { key: "divYield", label: "배당수익률(%)", group: "배당", src: "map_fundamentals", get: (it, f) => fxNum(f.divYield) },
  { key: "payoutRatio", label: "배당성향(%)", group: "배당", src: "map_fundamentals", get: (it, f) => fxNum(f.payoutRatio) },
  { key: "roe", label: "ROE(%)", group: "수익성", src: "map_fundamentals", get: (it, f) => fxNum(f.roe) },
  { key: "roa", label: "ROA(%)", group: "수익성", src: "map_fundamentals", get: (it, f) => fxNum(f.roa) },
  { key: "netMargin", label: "순이익률(%)", group: "수익성", src: "map_fundamentals", get: (it, f) => fxNum(f.netMargin) },
  { key: "revenueGrowth", label: "매출 성장률(전년비 %)", group: "성장", src: "map_fundamentals", get: (it, f) => fxNum(f.revenueGrowth) },
  { key: "operatingGrowth", label: "영업이익 성장률(전년비 %)", group: "성장", src: "map_fundamentals", get: (it, f) => fxNum(f.operatingGrowth) },
  { key: "netGrowth", label: "순이익 성장률(전년비 %)", group: "성장", src: "map_fundamentals", get: (it, f) => fxNum(f.netGrowth) },
  { key: "debtRatio", label: "부채비율(%)", group: "건전성", src: "map_fundamentals", get: (it, f) => fxNum(f.debtRatio) },
  { key: "currentRatio", label: "유동비율(%)", group: "건전성", src: "map_fundamentals", get: (it, f) => fxNum(f.currentRatio) },
  { key: "foreignPct", label: "외국인 지분율(%)", group: "수급", src: "map_fundamentals", get: (it, f) => fxNum(f.foreignPct) },
  { key: "foreignExhaustion", label: "외국인 한도소진율(%)", group: "수급", src: "map_fundamentals", get: (it, f) => fxNum(f.foreignExhaustion) },
];
const FX_FIELD_BY_KEY = Object.fromEntries(FX_FIELDS.map((f) => [f.key, f]));
const FX_ALIASES = {
  per: "pe", pbr: "pb", psr: "ps", rsi: "rsi14", eps: "epsTtm", cap: "marketCap", mktcap: "marketCap",
  marketcapb: "marketCap", div: "divYield", dividend: "divYield", vol: "volumeRatio", fpe: "forwardPE",
};
const FX_MAX_COLUMNS = 4;
const FX_MAX_ROWS = 200;

let fxState = { formula: "", columns: [], sort: "", dir: -1, bucket: "all", selectedId: "", market: "" };
let fxBlocks = [];
let fxFieldsMemo = null;
let fxPendingUrlToken = null;
let fxBound = false;
let fxLastRun = null;

// 이 시장에서 값이 있는 필드 목록(+ 없는 필드의 이유). 스냅샷·MAP_FUNDAMENTALS 가 바뀌면 다시 센다.
function fxAvailableFields() {
  const stocks = (data && Array.isArray(data.stocks)) ? data.stocks : [];
  const mfCount = Object.keys(window.MAP_FUNDAMENTALS || {}).length;
  const key = `${marketCfg().id}|${data && (data.updatedAtKst || data.updated_at_kst)}|${stocks.length}|${mfCount}`;
  if (fxFieldsMemo && fxFieldsMemo.key === key) return fxFieldsMemo;
  const universe = stocks.filter((s) => s && !isStockEtf(s));
  const counts = {};
  FX_FIELDS.forEach((fd) => { counts[fd.key] = 0; });
  universe.forEach((it) => {
    const f = mapFundamentalsFor(it.ticker) || {};
    FX_FIELDS.forEach((fd) => { if (fd.get(it, f) != null) counts[fd.key]++; });
  });
  const list = FX_FIELDS.filter((fd) => counts[fd.key] >= FX_MIN_COVERAGE);
  const unavailable = {};
  FX_FIELDS.forEach((fd) => {
    if (counts[fd.key] < FX_MIN_COVERAGE) unavailable[fd.key.toLowerCase()] = `이 시장(${isKrMarket() ? "국내" : "미국"}) 데이터에 없는 필드입니다(${fd.label}).`;
  });
  fxFieldsMemo = { key, list, keys: list.map((f) => f.key), unavailable, counts, universeSize: universe.length };
  return fxFieldsMemo;
}

function fxCompileOptions(expect) {
  const av = fxAvailableFields();
  return { fields: av.keys, aliases: FX_ALIASES, unavailable: av.unavailable, expect };
}

function fxExamples() {
  const base = [
    "roe > 15 and pe < sectorMedian(pe) and rsi14 < 40",
    "sectorPct(roe) >= 80 and sectorPct(pb) <= 30",
    "threeMonthChangePct > 20 and newHighDistancePct < 5",
    "rank(marketCap) <= 50 and divYield > 2",
  ];
  if (isKrMarket()) base.push("debtRatio < 100 and revenueGrowth > 10 and pe > 0 and pe < 15");
  else base.push("epsGrowthEst > 20 and forwardPE < industryMedian(forwardPE)");
  const av = fxAvailableFields();
  const core = window.MirFormulaCore;
  return base.filter((src) => core && core.compile(src, fxCompileOptions("bool")).ok && av.keys.length);
}

// ---------- 평가 ----------
function fxRows() {
  const stocks = (data && Array.isArray(data.stocks)) ? data.stocks : [];
  return stocks.filter((s) => s && !isStockEtf(s)).map((item) => ({ item, f: mapFundamentalsFor(item.ticker) || {} }));
}
const fxCtx = {
  get: (row, name) => { const fd = FX_FIELD_BY_KEY[name]; return fd ? fd.get(row.item, row.f) : null; },
  group: (row, g) => row.item[g],
};

function fxRunNow({ trackSaved = false } = {}) {
  const core = window.MirFormulaCore;
  const errBox = byId("fxError");
  const meta = byId("fxMeta");
  if (!core || !data || !Array.isArray(data.stocks)) return;
  const input = byId("fxInput");
  fxState.formula = String(input?.value || "").trim();
  fxState.bucket = byId("fxBucket")?.value || "all";
  fxReadColumnInputs();
  const compiled = core.compile(fxState.formula, fxCompileOptions("bool"));
  if (errBox) {
    errBox.textContent = compiled.ok ? "" : compiled.error;
    errBox.hidden = compiled.ok;
  }
  const colCompiled = fxState.columns.map((c) => (c.e ? core.compile(c.e, fxCompileOptions("num")) : null));
  fxRenderColumnErrors(colCompiled);
  fxRenderBacktestSlot(compiled.ok ? compiled : null);
  if (!compiled.ok) {
    fxLastRun = null;
    if (meta) meta.textContent = "수식을 고치면 결과가 나옵니다.";
    fxRenderTable(null);
    return;
  }
  const rows = fxRows();
  const pass = core.filterIndices(compiled, rows, fxCtx);
  const cfg = marketCfg();
  const bucket = fxState.bucket;
  const inBucket = pass.filter((i) => bucket === "all" || bucketMatches(rows[i].item, rows[i].item.groups || [rows[i].item.bucket].filter(Boolean), bucket));
  const colVals = colCompiled.map((cc) => (cc && cc.ok ? core.evaluate(cc, rows, fxCtx) : null));
  const usedFields = compiled.fields.filter((k) => k !== "marketCap").slice(0, 4);
  fxLastRun = { compiled, rows, idx: inBucket, colVals, usedFields, total: pass.length };
  const tickers = inBucket.map((i) => rows[i].item.ticker);
  const record = fxSelectedRecord();
  if (trackSaved && record) compareSavedScreener(record, tickers.slice(0, 1000), fxRenderDelta);
  const bucketLabel = (cfg.buckets || []).find(([v]) => v === bucket)?.[1] || "전체";
  if (meta) {
    const when = data.updatedAtKst || data.updated_at_kst || "";
    meta.textContent = `${inBucket.length.toLocaleString()}개 종목 일치 · ${bucketLabel} · 모집단 ${rows.length.toLocaleString()}종목(ETF 제외)${when ? ` · 기준 ${when}` : ""}`;
  }
  fxRenderTable(fxLastRun);
}

function fxSortValue(run, i, key) {
  const row = run.rows[i];
  if (key && key.startsWith("c")) {
    const ci = Number(key.slice(1));
    const vals = run.colVals[ci];
    return vals ? vals[i] : null;
  }
  const fd = FX_FIELD_BY_KEY[key || "marketCap"] || FX_FIELD_BY_KEY.marketCap;
  return fd.get(row.item, row.f);
}

function fxFmt(v) {
  if (v == null || !Number.isFinite(Number(v))) return "—";
  const n = Number(v);
  const a = Math.abs(n);
  if (a >= 1e6) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (a >= 100) return n.toFixed(0);
  if (a >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

function fxRenderTable(run) {
  const head = byId("fxHead");
  const body = byId("fxBody");
  if (!head || !body) return;
  if (!run) { head.innerHTML = ""; body.innerHTML = ""; return; }
  const cols = [];
  run.usedFields.forEach((k) => cols.push({ key: k, label: k, title: FX_FIELD_BY_KEY[k]?.label || k }));
  fxState.columns.forEach((c, ci) => { if (run.colVals[ci]) cols.push({ key: `c${ci}`, label: c.n || `열 ${ci + 1}`, title: c.e, custom: true }); });
  cols.push({ key: "marketCap", label: "시총", title: FX_FIELD_BY_KEY.marketCap.label });
  let sortKey = fxState.sort;
  if (!sortKey || !cols.some((c) => c.key === sortKey)) sortKey = fxState.columns.findIndex((c, ci) => run.colVals[ci]) >= 0 ? `c${fxState.columns.findIndex((c, ci) => run.colVals[ci])}` : "marketCap";
  const dir = fxState.dir === 1 ? 1 : -1;
  const sanity = window.MirFundSanity;
  const fieldHasBounds = (k) => Boolean(sanity && FX_FIELD_BY_KEY[k] && sanity.bounds(k));
  const idx = run.idx.slice().sort((a, b) => {
    const av = fxSortValue(run, a, sortKey);
    const bv = fxSortValue(run, b, sortKey);
    // '이상치 가능' 값(ROE 3,948% 등)은 경계 안 값 뒤, 결측 앞으로(fundamentals-sanity-core.js).
    if (fieldHasBounds(sortKey)) return sanity.sortCompare(sortKey, av, bv, dir);
    if (av == null && bv == null) return 0;
    if (av == null) return 1; // 결측은 항상 맨 뒤
    if (bv == null) return -1;
    return dir * (av - bv);
  });
  const arrow = (k) => (k === sortKey ? (dir === 1 ? " ▲" : " ▼") : "");
  head.innerHTML = `<tr><th></th><th data-kr-label="종목">${isKrMarket() ? "종목" : "티커"}</th><th class="col-sub">회사</th><th>섹터</th><th>당일</th>${cols.map((c) => `<th class="num"><button type="button" class="fx-sort${c.custom ? " is-custom" : ""}" data-fx-sort="${escapeHtml(c.key)}" title="${escapeHtml(c.title)}">${escapeHtml(c.label)}${arrow(c.key)}</button></th>`).join("")}</tr>`;
  if (!idx.length) {
    body.innerHTML = `<tr><td colspan="${5 + cols.length}" class="muted">조건에 맞는 종목이 없습니다. 결측값이 있는 종목은 조건을 충족하지 않은 것으로 봅니다.</td></tr>`;
    return;
  }
  const outlierCount = sanity ? idx.filter((i) => cols.some((c) => fieldHasBounds(c.key) && sanity.isOutlier(c.key, fxSortValue(run, i, c.key)))).length : 0;
  body.innerHTML = idx.slice(0, FX_MAX_ROWS).map((i) => {
    const { item } = run.rows[i];
    return `<tr>
      <td>${watchStarButton(item.ticker)}</td>
      <td><button type="button" class="ticker-link" data-ticker="${escapeHtml(item.ticker)}">${escapeHtml(stockLabel(item))}</button></td>
      <td class="col-sub">${escapeHtml(stockSubLabel(item))}</td>
      <td>${escapeHtml(item.sector || "")}</td>
      <td class="${cls(item.changePct)}">${fmtDailyPct(item.changePct)}</td>
      ${cols.map((c) => fxCellHtml(run, i, c)).join("")}
    </tr>`;
  }).join("") + (outlierCount ? `<tr><td colspan="${5 + cols.length}" class="muted">'이상치 가능' ${outlierCount.toLocaleString()}종목 — 값은 원자료 그대로지만 분모(자본·매출·이익)가 0 에 가깝거나 단위가 섞였을 가능성이 커 정렬에서 뒤로 보냈습니다. 조건 판정에는 그대로 씁니다.</td></tr>` : "") + (idx.length > FX_MAX_ROWS ? `<tr><td colspan="${5 + cols.length}" class="muted">상위 ${FX_MAX_ROWS}개만 표시(전체 ${idx.length.toLocaleString()}개) — 조건을 좁히거나 정렬을 바꾸세요.</td></tr>` : "");
  delegateTickerClicks(body, ".ticker-link");
}

// 결과 표 한 칸. 필드 열 값이 '이상치 가능' 경계 밖이면 표시를 붙인다(값은 그대로).
function fxCellHtml(run, i, c) {
  const item = run.rows[i].item;
  if (c.key === "marketCap") return `<td class="num">${fmtBillions(item.marketCapB)}</td>`;
  const v = fxSortValue(run, i, c.key);
  const sanity = window.MirFundSanity;
  const flag = !c.custom && sanity && sanity.isOutlier(c.key, v);
  if (!flag) return `<td class="num">${escapeHtml(fxFmt(v))}</td>`;
  return `<td class="num is-outlier" title="${escapeHtml(sanity.describe(c.key))}">${escapeHtml(fxFmt(v))}<span class="fx-outlier">이상치 가능</span></td>`;
}

// ---------- 3차 스크리너 백테스트 연결 지점 ----------
// window.MirFormulaBacktest = { render(slotEl, { compiled, source, market, columns }) } (screener-backtest.js)가
// 결과 옆 자리(#fxBacktestSlot)에 버튼·결과를 그린다. 백테스트는 사용자가 버튼을 눌러야 돈다 — 그 전까지
// 화면의 "과거 검증되지 않음" 문구가 사실 그대로다. 정의가 없거나 렌더가 실패하면 자리를 숨긴다.
function fxRenderBacktestSlot(compiled) {
  const slot = byId("fxBacktestSlot");
  if (!slot) return;
  const bt = window.MirFormulaBacktest;
  if (!compiled || !bt || typeof bt.render !== "function") { slot.hidden = true; slot.innerHTML = ""; return; }
  slot.hidden = false;
  try {
    bt.render(slot, { compiled, source: compiled.source, market: marketCfg().id, columns: fxState.columns.slice() });
  } catch (_) {
    slot.hidden = true;
    slot.innerHTML = "";
  }
}

// ---------- 사용자 정의 열 ----------
function fxReadColumnInputs() {
  const box = byId("fxColumns");
  if (!box) return;
  fxState.columns = [...box.querySelectorAll(".fx-col-row")].map((row) => ({
    n: String(row.querySelector(".fx-col-name")?.value || "").trim().slice(0, 20),
    e: String(row.querySelector(".fx-col-expr")?.value || "").trim(),
  })).filter((c) => c.e || c.n).slice(0, FX_MAX_COLUMNS);
}

function fxRenderColumns() {
  const box = byId("fxColumns");
  if (!box) return;
  const cols = fxState.columns.length ? fxState.columns : [];
  box.innerHTML = cols.map((c, i) => `<div class="fx-col-row" data-i="${i}">
      <input class="fx-col-name" type="text" maxlength="20" placeholder="열 이름" value="${escapeHtml(c.n || "")}" aria-label="열 이름">
      <div class="fx-input-wrap"><input class="fx-col-expr" type="text" spellcheck="false" autocomplete="off" placeholder="예: 100 / pe  또는  sectorPct(roe)" value="${escapeHtml(c.e || "")}" aria-label="열 수식"></div>
      <button type="button" class="ghost fx-col-del" aria-label="열 삭제">✕</button>
      <p class="fx-col-err" hidden></p>
    </div>`).join("");
  box.querySelectorAll(".fx-col-expr").forEach((el) => fxAttachAutocomplete(el));
  // 공유 링크·저장 수식으로 열이 들어오면 접힌 '사용자 정의 열' 을 펼쳐 보여 준다.
  if (cols.length) { const fold = box.closest("details"); if (fold) fold.open = true; }
  const add = byId("fxAddColumn");
  if (add) add.disabled = fxState.columns.length >= FX_MAX_COLUMNS;
}

function fxRenderColumnErrors(colCompiled) {
  const box = byId("fxColumns");
  if (!box) return;
  box.querySelectorAll(".fx-col-row").forEach((row, i) => {
    const err = row.querySelector(".fx-col-err");
    const cc = colCompiled[i];
    if (!err) return;
    err.textContent = cc && !cc.ok ? cc.error : "";
    err.hidden = !(cc && !cc.ok);
  });
}

// ---------- 조건 블록 ----------
const FX_BLOCK_OPS = [">", ">=", "<", "<="];
const FX_BLOCK_MODES = [
  { v: "num", label: "숫자" },
  { v: "sectorMedian", label: "섹터 중앙값" },
  { v: "industryMedian", label: "업종 중앙값" },
  { v: "sectorPct", label: "섹터 내 백분위(값)" },
];

function fxBlockText(b) {
  if (!b.field) return "";
  const val = String(b.value ?? "").trim();
  if (b.mode === "sectorMedian" || b.mode === "industryMedian") return `${b.field} ${b.op} ${b.mode}(${b.field})`;
  if (!val || !Number.isFinite(Number(val))) return "";
  if (b.mode === "sectorPct") return `sectorPct(${b.field}) ${b.op} ${Number(val)}`;
  return `${b.field} ${b.op} ${Number(val)}`;
}

function fxRenderBlocks() {
  const box = byId("fxBlocks");
  if (!box) return;
  const av = fxAvailableFields();
  if (!fxBlocks.length) fxBlocks.push({ field: av.keys.includes("roe") ? "roe" : av.keys[0], op: ">", mode: "num", value: "" });
  const fieldOpts = (sel) => av.list.map((fd) => `<option value="${escapeHtml(fd.key)}"${fd.key === sel ? " selected" : ""}>${escapeHtml(fd.label)} · ${escapeHtml(fd.key)}</option>`).join("");
  box.innerHTML = fxBlocks.map((b, i) => `<div class="fx-block" data-i="${i}">
      <select class="fx-b-field" aria-label="필드">${fieldOpts(b.field)}</select>
      <select class="fx-b-op" aria-label="비교">${FX_BLOCK_OPS.map((o) => `<option${o === b.op ? " selected" : ""}>${o}</option>`).join("")}</select>
      <select class="fx-b-mode" aria-label="비교 대상">${FX_BLOCK_MODES.map((m) => `<option value="${m.v}"${m.v === b.mode ? " selected" : ""}>${m.label}</option>`).join("")}</select>
      <input class="fx-b-value" type="number" step="any" placeholder="값" value="${escapeHtml(b.value ?? "")}" aria-label="값"${b.mode === "sectorMedian" || b.mode === "industryMedian" ? " hidden" : ""}>
      <button type="button" class="ghost fx-b-del" aria-label="조건 삭제">✕</button>
    </div>`).join("");
  const preview = byId("fxBlocksPreview");
  if (preview) {
    const join = byId("fxBlocksJoin")?.value === "or" ? " or " : " and ";
    const txt = fxBlocks.map(fxBlockText).filter(Boolean).join(join);
    preview.textContent = txt || "조건을 채우면 여기에 수식이 만들어집니다.";
  }
}

function fxReadBlocks() {
  const box = byId("fxBlocks");
  if (!box) return;
  fxBlocks = [...box.querySelectorAll(".fx-block")].map((row) => ({
    field: row.querySelector(".fx-b-field")?.value || "",
    op: row.querySelector(".fx-b-op")?.value || ">",
    mode: row.querySelector(".fx-b-mode")?.value || "num",
    value: row.querySelector(".fx-b-value")?.value || "",
  }));
}

// ---------- 자동완성 ----------
function fxSuggestions(prefix) {
  const p = String(prefix || "").toLowerCase();
  if (!p) return [];
  const av = fxAvailableFields();
  const out = [];
  av.list.forEach((fd) => { if (fd.key.toLowerCase().startsWith(p)) out.push({ name: fd.key, label: fd.label, fn: false }); });
  Object.entries(window.MirFormulaCore.FUNCTIONS).forEach(([name, spec]) => { if (name.toLowerCase().startsWith(p)) out.push({ name, label: spec.label, fn: true }); });
  if (out.length < 8) {
    av.list.forEach((fd) => {
      if (!fd.key.toLowerCase().startsWith(p) && fd.label.toLowerCase().includes(p) && !out.some((o) => o.name === fd.key)) out.push({ name: fd.key, label: fd.label, fn: false });
    });
  }
  return out.slice(0, 8);
}

function fxAttachAutocomplete(input) {
  if (!input || input.dataset.fxAc) return;
  input.dataset.fxAc = "1";
  const wrap = input.closest(".fx-input-wrap") || input.parentElement;
  let list = wrap.querySelector(".fx-suggest");
  if (!list) {
    list = document.createElement("ul");
    list.className = "fx-suggest";
    list.setAttribute("role", "listbox");
    list.hidden = true;
    wrap.appendChild(list);
  }
  let items = [];
  let active = 0;
  const close = () => { list.hidden = true; items = []; };
  const apply = (sug) => {
    const core = window.MirFormulaCore;
    const pos = input.selectionStart ?? input.value.length;
    const { start } = core.completionPrefix(input.value, pos);
    const insert = sug.fn ? `${sug.name}(` : sug.name;
    input.value = input.value.slice(0, start) + insert + input.value.slice(pos);
    const caret = start + insert.length;
    input.setSelectionRange(caret, caret);
    input.focus();
    close();
  };
  const paint = () => {
    list.innerHTML = items.map((s, i) => `<li role="option" data-i="${i}" class="${i === active ? "is-active" : ""}" aria-selected="${i === active}"><b>${escapeHtml(s.name)}${s.fn ? "()" : ""}</b><span>${escapeHtml(s.label)}</span></li>`).join("");
    list.hidden = !items.length;
  };
  input.addEventListener("input", () => {
    const pos = input.selectionStart ?? input.value.length;
    const { prefix } = window.MirFormulaCore.completionPrefix(input.value, pos);
    items = fxSuggestions(prefix);
    active = 0;
    paint();
  });
  input.addEventListener("keydown", (e) => {
    if (list.hidden || !items.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); active = (active + 1) % items.length; paint(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); active = (active - 1 + items.length) % items.length; paint(); }
    else if (e.key === "Tab" || (e.key === "Enter" && !e.ctrlKey && !e.metaKey)) { e.preventDefault(); e.stopPropagation(); apply(items[active]); }
    else if (e.key === "Escape") { close(); }
  });
  input.addEventListener("blur", () => setTimeout(close, 150));
  list.addEventListener("mousedown", (e) => {
    const li = e.target.closest("li[data-i]");
    if (!li) return;
    e.preventDefault();
    apply(items[Number(li.dataset.i)]);
  });
}

function fxInsertAtCursor(text) {
  const input = byId("fxInput");
  if (!input) return;
  const s = input.selectionStart ?? input.value.length;
  const e = input.selectionEnd ?? s;
  const before = input.value.slice(0, s);
  const pad = before && !/\s$/.test(before) && !/[(]$/.test(before) ? " " : "";
  input.value = before + pad + text + input.value.slice(e);
  const caret = (before + pad + text).length;
  input.focus();
  input.setSelectionRange(caret, caret);
}

function fxRenderFieldHelp() {
  const box = byId("fxFieldList");
  if (!box) return;
  const av = fxAvailableFields();
  const groups = {};
  av.list.forEach((fd) => { (groups[fd.group] = groups[fd.group] || []).push(fd); });
  const missing = FX_FIELDS.filter((fd) => !av.keys.includes(fd.key)).map((fd) => fd.key);
  box.innerHTML = Object.entries(groups).map(([g, list]) => `<div class="fx-field-group"><b>${escapeHtml(g)}</b>${list.map((fd) => `<button type="button" class="fx-field-chip" data-fx-insert="${escapeHtml(fd.key)}" title="${escapeHtml(`${fd.label} · 값 있는 종목 ${av.counts[fd.key].toLocaleString()}/${av.universeSize.toLocaleString()}`)}">${escapeHtml(fd.key)}<span>${escapeHtml(fd.label)}</span></button>`).join("")}</div>`).join("")
    + (missing.length ? `<p class="muted fx-missing">이 시장에 값이 없어 뺀 필드: ${escapeHtml(missing.join(", "))}</p>` : "");
}

// ---------- 저장·델타(기존 저장형 스크리너 목록 공유) ----------
function fxFormulaRecords() {
  return (Array.isArray(savedScreeners) ? savedScreeners : []).filter((r) => r && r.kind === "formula");
}
function fxSelectedRecord() {
  return fxFormulaRecords().find((r) => r.id === fxState.selectedId) || null;
}

function fxRenderSavedPicker() {
  const sel = byId("fxSavedSelect");
  const del = byId("fxSavedDelete");
  if (!sel) return;
  const rows = fxFormulaRecords();
  sel.innerHTML = `<option value="">저장된 수식 선택</option>` + rows.map((r) => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}</option>`).join("");
  sel.value = rows.some((r) => r.id === fxState.selectedId) ? fxState.selectedId : "";
  if (del) del.disabled = !sel.value;
}

function fxRenderDelta(record) {
  const box = byId("fxDelta");
  if (!box) return;
  if (!record) {
    box.innerHTML = `<p class="muted">수식을 저장하면 다음 갱신부터 새로 들어오고 빠진 종목을 비교합니다(저장형 스크리너와 같은 목록).</p>`;
    return;
  }
  box.innerHTML = savedScreenerDeltaHtml(record);
  delegateTickerClicks(box, "[data-ticker]");
}

function fxSave() {
  const input = byId("fxSavedName");
  const name = String(input?.value || "").trim();
  if (!name) { showAppToast("저장할 이름을 입력하세요"); input?.focus(); return; }
  fxRunNow();
  if (!fxLastRun) { showAppToast("수식 오류를 먼저 고치세요"); return; }
  let record = fxSelectedRecord();
  if (!record) {
    record = { id: `scr_${Date.now().toString(36)}`, kind: "formula", name, config: {}, createdAt: formatKstDateTime() };
    savedScreeners.push(record);
  }
  record.name = name;
  record.config = { formula: fxState.formula, columns: fxState.columns.slice(), sort: fxState.sort, dir: fxState.dir, bucket: fxState.bucket };
  record.lastSnapshotKey = screenerSnapshotKey();
  record.lastTickers = fxLastRun.idx.map((i) => fxLastRun.rows[i].item.ticker).slice(0, 1000);
  record.lastDelta = { added: [], removed: [] };
  record.lastCheckedAt = formatKstDateTime();
  fxState.selectedId = record.id;
  persistSavedScreeners();
  fxRenderSavedPicker();
  fxRenderDelta(record);
  if (typeof renderSavedScreenerPicker === "function") renderSavedScreenerPicker();
  showAppToast(`'${name}' 수식을 저장했습니다`);
}

function fxDelete() {
  const record = fxSelectedRecord();
  if (!record) return;
  savedScreeners = savedScreeners.filter((r) => r.id !== record.id);
  fxState.selectedId = "";
  persistSavedScreeners();
  fxRenderSavedPicker();
  fxRenderDelta(null);
  if (typeof renderSavedScreenerPicker === "function") renderSavedScreenerPicker();
  const input = byId("fxSavedName");
  if (input) input.value = "";
  showAppToast("저장한 수식을 삭제했습니다");
}

function fxApplyConfig(cfgObj) {
  const c = cfgObj || {};
  fxState.formula = String(c.formula || c.f || "");
  fxState.columns = Array.isArray(c.columns) ? c.columns.slice(0, FX_MAX_COLUMNS) : (Array.isArray(c.c) ? c.c.slice(0, FX_MAX_COLUMNS) : []);
  fxState.sort = String(c.sort || c.s || "");
  fxState.dir = (c.dir ?? c.d) === 1 ? 1 : -1;
  if (c.bucket) fxState.bucket = c.bucket;
  const input = byId("fxInput");
  if (input) input.value = fxState.formula;
  const b = byId("fxBucket");
  if (b && c.bucket && [...b.options].some((o) => o.value === c.bucket)) b.value = c.bucket;
  fxRenderColumns();
}

// 저장형 스크리너 셀렉트(screener.js)에서 수식 항목을 고르면 여기로 넘어온다.
function openFormulaScreenerRecord(id) {
  fxState.selectedId = id;
  if (typeof activateSearchSub === "function") activateSearchSub("formula", { push: true });
  const record = fxSelectedRecord();
  if (record) {
    fxApplyConfig(record.config);
    const nameInput = byId("fxSavedName");
    if (nameInput) nameInput.value = record.name;
    fxRenderSavedPicker();
    fxRunNow({ trackSaved: true });
  }
}

// ---------- 공유 URL ----------
function fxShareUrl() {
  fxReadColumnInputs();
  fxState.formula = String(byId("fxInput")?.value || "").trim();
  const token = window.MirFormulaCore.encodeState({ f: fxState.formula, c: fxState.columns, s: fxState.sort, d: fxState.dir });
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("market", marketCfg().id);
  url.searchParams.set("tab", "search");
  url.searchParams.set("sub", "formula");
  url.searchParams.set("fx", token);
  return url.toString();
}

// boot 에서 ?fx= 를 받으면 첫 렌더 때 적용한다.
function formulaScreenerPreload(token) {
  fxPendingUrlToken = token || null;
}

// ---------- 렌더 진입점 ----------
function renderFormulaScreener() {
  const panel = byId("sub-formula");
  if (!panel || !window.MirFormulaCore || !data || !Array.isArray(data.stocks)) return;
  const marketId = marketCfg().id;
  if (fxState.market !== marketId) {
    // 시장이 바뀌면 저장 선택·블록을 비운다(저장 목록은 시장별로 따로다).
    fxState.market = marketId;
    fxState.selectedId = "";
    fxBlocks = [];
    const b = byId("fxBucket");
    if (b) {
      b.innerHTML = `<option value="all">전체(ETF 제외)</option>` + (marketCfg().buckets || [])
        .filter(([v]) => !["all", "all_with_etf", "all_misc"].includes(v))
        .map(([v, label]) => `<option value="${escapeHtml(v)}">${escapeHtml(label)}</option>`).join("");
      b.value = "all";
    }
  }
  fxBind();
  fxRenderFieldHelp();
  const ex = byId("fxExamples");
  if (ex) ex.innerHTML = fxExamples().map((q) => `<button type="button" class="nl-example fx-example" data-fx-example="${escapeHtml(q)}">${escapeHtml(q)}</button>`).join("");
  fxRenderSavedPicker();
  fxRenderDelta(fxSelectedRecord());
  fxRenderBlocks();
  if (fxPendingUrlToken) {
    const st = window.MirFormulaCore.decodeState(fxPendingUrlToken);
    fxPendingUrlToken = null;
    if (st) fxApplyConfig({ formula: st.f, columns: st.c, sort: st.s, dir: st.d });
    else showAppToast("공유 링크의 수식을 읽지 못했습니다");
  }
  const input = byId("fxInput");
  if (input && input.value.trim()) fxRunNow();
  else {
    const meta = byId("fxMeta");
    if (meta) meta.textContent = "수식을 입력하고 검색을 누르세요. 필드 이름을 치면 자동완성이 뜹니다.";
    fxRenderTable(null);
  }
}

function fxBind() {
  if (fxBound) return;
  fxBound = true;
  const input = byId("fxInput");
  fxAttachAutocomplete(input);
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.defaultPrevented) { e.preventDefault(); fxRunNow({ trackSaved: true }); }
  });
  byId("fxRun")?.addEventListener("click", () => fxRunNow({ trackSaved: true }));
  byId("fxClear")?.addEventListener("click", () => {
    if (input) input.value = "";
    fxState.formula = "";
    const err = byId("fxError"); if (err) { err.textContent = ""; err.hidden = true; }
    fxRenderTable(null);
    fxRenderBacktestSlot(null);
    const meta = byId("fxMeta"); if (meta) meta.textContent = "수식을 입력하고 검색을 누르세요.";
  });
  byId("fxShare")?.addEventListener("click", () => {
    const url = fxShareUrl();
    navigator.clipboard?.writeText(url)
      .then(() => showAppToast("수식 링크를 복사했습니다."))
      .catch(() => showAppToast("복사에 실패했습니다."));
  });
  byId("fxBucket")?.addEventListener("change", () => fxRunNow());
  byId("fxExamples")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fx-example]");
    if (!b || !input) return;
    input.value = b.dataset.fxExample;
    fxRunNow();
  });
  byId("fxFieldList")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fx-insert]");
    if (b) fxInsertAtCursor(b.dataset.fxInsert);
  });
  // 결과 표 정렬
  byId("fxHead")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fx-sort]");
    if (!b || !fxLastRun) return;
    const key = b.dataset.fxSort;
    if (fxState.sort === key) fxState.dir = fxState.dir === 1 ? -1 : 1;
    else { fxState.sort = key; fxState.dir = -1; }
    fxRenderTable(fxLastRun);
  });
  // 사용자 정의 열
  byId("fxAddColumn")?.addEventListener("click", () => {
    fxReadColumnInputs();
    if (fxState.columns.length >= FX_MAX_COLUMNS) return;
    fxState.columns.push({ n: "", e: "" });
    fxRenderColumns();
    byId("fxColumns")?.querySelector(".fx-col-row:last-child .fx-col-expr")?.focus();
  });
  byId("fxColumns")?.addEventListener("click", (e) => {
    const del = e.target.closest(".fx-col-del");
    if (!del) return;
    const i = Number(del.closest(".fx-col-row")?.dataset.i);
    fxReadColumnInputs();
    // fxReadColumnInputs 는 빈 행을 빼므로 화면 행 번호 대신 다시 읽은 목록에서 지운다.
    const rows = [...byId("fxColumns").querySelectorAll(".fx-col-row")];
    const target = rows[i];
    fxState.columns = rows.filter((r) => r !== target).map((r) => ({
      n: String(r.querySelector(".fx-col-name")?.value || "").trim().slice(0, 20),
      e: String(r.querySelector(".fx-col-expr")?.value || "").trim(),
    }));
    if (fxState.sort && fxState.sort.startsWith("c")) fxState.sort = "";
    fxRenderColumns();
    fxRunNow();
  });
  byId("fxColumns")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.closest(".fx-col-expr") && !e.defaultPrevented) { e.preventDefault(); fxRunNow(); }
  });
  byId("fxColumnsApply")?.addEventListener("click", () => fxRunNow());
  // 조건 블록
  const blocks = byId("fxBlocks");
  blocks?.addEventListener("change", () => { fxReadBlocks(); fxRenderBlocks(); });
  blocks?.addEventListener("input", (e) => {
    if (!e.target.closest(".fx-b-value")) return;
    fxReadBlocks();
    const preview = byId("fxBlocksPreview");
    const join = byId("fxBlocksJoin")?.value === "or" ? " or " : " and ";
    if (preview) preview.textContent = fxBlocks.map(fxBlockText).filter(Boolean).join(join) || "조건을 채우면 여기에 수식이 만들어집니다.";
  });
  blocks?.addEventListener("click", (e) => {
    const del = e.target.closest(".fx-b-del");
    if (!del) return;
    fxReadBlocks();
    fxBlocks.splice(Number(del.closest(".fx-block")?.dataset.i), 1);
    fxRenderBlocks();
  });
  byId("fxBlocksJoin")?.addEventListener("change", () => { fxReadBlocks(); fxRenderBlocks(); });
  byId("fxAddBlock")?.addEventListener("click", () => {
    fxReadBlocks();
    const av = fxAvailableFields();
    fxBlocks.push({ field: av.keys.includes("pe") ? "pe" : av.keys[0], op: "<", mode: "sectorMedian", value: "" });
    fxRenderBlocks();
  });
  byId("fxBlocksApply")?.addEventListener("click", () => {
    fxReadBlocks();
    const join = byId("fxBlocksJoin")?.value === "or" ? " or " : " and ";
    const txt = fxBlocks.map(fxBlockText).filter(Boolean).join(join);
    if (!txt) { showAppToast("값을 채운 조건이 없습니다"); return; }
    if (input) input.value = txt;
    fxRunNow();
  });
  // 저장
  byId("fxSavedSelect")?.addEventListener("change", (e) => {
    fxState.selectedId = e.target.value;
    const record = fxSelectedRecord();
    const nameInput = byId("fxSavedName");
    if (nameInput) nameInput.value = record?.name || "";
    fxRenderSavedPicker();
    if (record) { fxApplyConfig(record.config); fxRunNow({ trackSaved: true }); }
    else fxRenderDelta(null);
  });
  byId("fxSavedSave")?.addEventListener("click", fxSave);
  byId("fxSavedDelete")?.addEventListener("click", fxDelete);
}
