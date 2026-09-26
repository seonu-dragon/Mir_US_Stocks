// dcf.js — 종목 분석 › 역DCF · 시나리오 DCF 카드 + AI 모드 DCF 패널
// =====================================================
// 계산: dcf-core.js(window.MirDcfCore). 입력: financials.js 의 종목 재무 파일(loadFinancials/financialsCached),
// 기저율 분포 window.DCF_BASE_RATES(scripts/build_dcf_base_rates.py, FEATURE_DATA 키 dcfBaseRates),
// 무위험금리 = US FRED DGS10(window.YIELD_CURVE) · KR 국고채 10년(window.KR_ECOS_MACRO ktb10).
// 추정치이며 가정에 극도로 민감하다 — 예측·투자 권유가 아니다(화면 각주로 명시).
// 클래식 스크립트(전역 공유) — 최상위 이름은 dcf* / *Dcf* 로 둔다.

const DCF_STATE_KEY = "mir.dcf.v1";
const DCF_STATE_MAX = 60;
const DCF_SCEN_LABEL = { bear: "약세", base: "기본", bull: "강세" };
const DCF_FIELDS = [
  // [키, 라벨, 최소%, 최대%, 단계%, 설명]
  ["g1", "매출 성장률 1~5년", -20, 50, 0.5, "연평균 매출 성장률(1~5년차)"],
  ["g2", "매출 성장률 6~10년", -10, 30, 0.5, "연평균 매출 성장률(6~10년차)"],
  ["margin", "영업이익률 목표", -20, 70, 0.5, "현재 영업이익률에서 5년차까지 직선으로 옮겨 가 이후 유지"],
  ["tax", "세율", 0, 50, 0.5, "영업이익에 매기는 세율(기본값 = 최근 실효세율)"],
  ["reinvest", "재투자율", 0, 95, 1, "세후 영업이익 중 설비·운전자본 등에 다시 쓰는 비율. FCF = 세후 영업이익 × (1 − 재투자율)"],
];
let dcfCurrent = null;       // { key, ticker, file, item, market }
let dcfRouteApplied = false;

function dcfMarket() {
  return (typeof isKrMarket === "function" && isKrMarket()) ? "kr" : "us";
}
function dcfKey(ticker) {
  return `${dcfMarket()}:${typeof mfTickerKey === "function" ? mfTickerKey(ticker) : String(ticker || "").toUpperCase()}`;
}
function dcfPct(v, d = 1) {
  return Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : "—";
}
function dcfSignedPct(v, d = 0) {
  return Number.isFinite(v) ? `${v > 0 ? "+" : ""}${(v * 100).toFixed(d)}%` : "—";
}
function dcfPrice(v) {
  const cfg = typeof marketCfg === "function" ? marketCfg() : null;
  return cfg && Number.isFinite(v) ? cfg.formatPrice(v) : "—";
}

// ── 무위험금리 ──
function dcfRiskFree() {
  if (dcfMarket() === "kr") {
    const d = window.KR_ECOS_MACRO;
    const ind = d && (d.indicators || []).find((x) => x.key === "ktb10");
    if (ind && Number.isFinite(Number(ind.value))) {
      const a = String(ind.asOf || d.asOf || "");
      return { pct: Number(ind.value), label: "국고채 10년", source: "한국은행 ECOS", asOf: a.length === 8 ? `${a.slice(0, 4)}-${a.slice(4, 6)}-${a.slice(6)}` : a };
    }
    return null;
  }
  const y = window.YIELD_CURVE;
  const p = y && (y.curve || []).find((c) => c.m === "10Y");
  if (p && Number.isFinite(Number(p.y))) return { pct: Number(p.y), label: "미 국채 10년(DGS10)", source: "FRED", asOf: y.asOf || "" };
  return null;
}
function dcfEnsureInputs() {
  if (typeof ensureFeatureData !== "function") return Promise.resolve();
  const keys = ["dcfBaseRates", dcfMarket() === "kr" ? "ecosMacro" : "yieldCurve"];
  return Promise.all(keys.map((k) => ensureFeatureData(k)));
}

// ── 상태(localStorage + URL) ──
function dcfLoadAll() {
  const s = window.safeStorage ? window.safeStorage.getJSON(DCF_STATE_KEY, null) : null;
  return s && typeof s === "object" ? s : {};
}
function dcfSaveState(key, st) {
  if (!window.safeStorage) return;
  const all = dcfLoadAll();
  all[key] = { ...st, savedAt: Date.now() };
  const keys = Object.keys(all);
  if (keys.length > DCF_STATE_MAX) {
    keys.sort((a, b) => (all[a].savedAt || 0) - (all[b].savedAt || 0)).slice(0, keys.length - DCF_STATE_MAX).forEach((k) => delete all[k]);
  }
  window.safeStorage.setJSON(DCF_STATE_KEY, all);
}
function dcfApplyRoute(ticker) {
  if (dcfRouteApplied) return;
  dcfRouteApplied = true;
  let p = null;
  try { p = new URLSearchParams(window.location.search); } catch (_) { return; }
  const enc = p.get("dcf");
  const rt = p.get("ticker");
  if (!enc || !rt) return;
  const key = dcfKey(rt);
  if (key !== dcfKey(ticker)) return;
  const st = MirDcfCore.decodeState(enc);
  if (!st) return;
  dcfSaveState(key, { r: st.r, tg: st.tg, scenarios: st.scenarios, active: "base", basis: null, fromLink: true });
}

// ── 계산 묶음 ──
function dcfDefaultR() {
  const rf = dcfRiskFree();
  const d = MirDcfCore.defaultDiscount(dcfMarket(), rf ? rf.pct : null);
  return { ...d, rfInfo: rf };
}
function dcfState(ctx) {
  const saved = dcfLoadAll()[ctx.key] || null;
  const defs = MirDcfCore.defaultScenarios(ctx.file, ctx.market);
  const st = {
    basis: saved && saved.basis ? saved.basis : null,
    r: saved && Number.isFinite(saved.r) ? saved.r : null,
    tg: saved && Number.isFinite(saved.tg) ? saved.tg : MirDcfCore.DEFAULT_TERMINAL,
    scenarios: saved && saved.scenarios ? saved.scenarios : defs.scenarios,
    active: saved && saved.active ? saved.active : "base",
    fromLink: Boolean(saved && saved.fromLink),
    edited: Boolean(saved && saved.scenarios),
  };
  return { st, defs };
}
function dcfCompute(ctx) {
  const core = MirDcfCore;
  const { st, defs } = ctx.state;
  const dr = dcfDefaultR();
  const r = st.r !== null ? st.r : dr.r;
  const tg = st.tg;
  const price = Number(ctx.item.price);
  const rev = core.reverseDcf(ctx.file, { market: ctx.market, price, r, tg, basis: st.basis || undefined });
  const shares = core.dilutedShares(ctx.file);
  const nd = core.netDebtOf(ctx.file);
  const base = { rev0: defs.base.rev0, margin0: defs.base.margin0, netDebt: nd.value, shares: shares ? shares.value : null };
  const common = { r, tg };
  const scen = {};
  for (const k of ["bear", "base", "bull"]) scen[k] = core.scenarioValue(st.scenarios[k], common, base);
  const grid = core.sensitivityGrid(st.scenarios[st.active], common, base);
  let br = null;
  const dist = window.DCF_BASE_RATES;
  if (rev.ok && dist) {
    const revNow = defs.base.rev0;
    br = {
      fcf: core.baseRate(dist, ctx.market, revNow, rev.g, "fcf"),
      rev: core.baseRate(dist, ctx.market, revNow, rev.g, "rev"),
    };
  }
  return { r, tg, dr, price, rev, base, scen, grid, br, shares, nd };
}

// ── 렌더 조각 ──
function dcfReverseHtml(ctx, c) {
  const cur = ctx.file.currency;
  const rev = c.rev;
  const opts = MirDcfCore.baseFcfOptions(ctx.file);
  const basis = rev.basis || opts.conservative;
  const btn = (k, text) => {
    const o = opts[k];
    const dis = !o;
    const tag = k === opts.conservative ? " · 보수적" : "";
    return `<button type="button" data-dcf-basis="${k}" class="${basis === k ? "is-active" : ""}" aria-pressed="${basis === k}"${dis ? " disabled" : ""} title="${o ? escapeHtml(`${o.label} FCF ${mfMoney(o.value, cur)}`) : "자료 없음"}">${text}${tag}</button>`;
  };
  let headline;
  if (!rev.ok) {
    headline = `<p class="dcf-headline dcf-muted">${escapeHtml(rev.reason || "계산할 수 없습니다")}</p>`;
  } else if (rev.bound === "above") {
    headline = `<p class="dcf-headline">현재가 ${escapeHtml(dcfPrice(c.price))}를 정당화하려면 향후 10년 FCF 가 <b>연 100% 넘게</b> 자라야 합니다(계산 범위 밖).</p>`;
  } else if (rev.bound === "below") {
    headline = `<p class="dcf-headline">현재가 ${escapeHtml(dcfPrice(c.price))}는 향후 10년 FCF 가 <b>연 −50% 이하로 줄어도</b> 설명되는 수준입니다(계산 범위 밖).</p>`;
  } else {
    headline = `<p class="dcf-headline">현재가 ${escapeHtml(dcfPrice(c.price))}를 정당화하려면 향후 10년 FCF 가 <b class="dcf-g">연 ${dcfPct(rev.g)}</b> 성장해야 합니다.</p>`;
  }
  const facts = rev.ok ? `<dl class="dcf-facts">
      <div><dt>기준 FCF</dt><dd>${escapeHtml(mfMoney(rev.fcf0, cur))}<small>${escapeHtml(rev.basisLabel)}</small></dd></div>
      <div><dt>시가총액</dt><dd>${escapeHtml(mfMoney(rev.marketCap, cur))}<small>현재가 × ${escapeHtml(rev.shares.label)}</small></dd></div>
      <div><dt>순차입금</dt><dd>${escapeHtml(mfMoney(rev.netDebt.value, cur))}${rev.netDebt.note ? `<small>${escapeHtml(rev.netDebt.note)}</small>` : ""}</dd></div>
      <div><dt>기업가치(EV)</dt><dd>${escapeHtml(mfMoney(rev.ev, cur))}</dd></div>
      ${rev.pv ? `<div><dt>영구가치 비중</dt><dd>${dcfPct(rev.pv.terminalShare, 0)}<small>10년 뒤 가치가 차지하는 몫</small></dd></div>` : ""}
    </dl>` : "";
  return `<div class="dcf-block">
      <div class="dcf-block-head"><h4>역DCF <span class="muted">시장 가격에 들어 있는 성장률</span></h4>
        <div class="segmented dcf-basis" role="group" aria-label="기준 FCF">${btn("ttm", "TTM")}${btn("avg3", "3년 평균")}</div></div>
      ${headline}
      ${facts}
      <div class="dcf-baserate">${dcfBaseRateHtml(ctx, c)}</div>
    </div>`;
}

function dcfBaseRateHtml(ctx, c) {
  if (!c.rev.ok) return "";
  if (!window.DCF_BASE_RATES) return `<p class="dcf-muted">기저율 분포를 불러오는 중입니다.</p>`;
  const b = c.br && c.br.fcf;
  const rv = c.br && c.br.rev;
  if (!b || !b.ok) return `<p class="dcf-muted">기저율: ${escapeHtml((b && b.reason) || "분포 없음")}.</p>`;
  const g = dcfPct(c.rev.g);
  const frac = Number.isFinite(b.fraction) ? `${Math.round(b.fraction * 100)}%` : "—";
  const revLine = rv && rv.ok ? ` 같은 기준으로 <b>매출</b>이 연 ${g} 이상 자란 비율은 ${Math.round(rv.fraction * 100)}%(표본 ${rv.n}개, 중앙값 ${rv.median}%)입니다.` : "";
  return `<p class="dcf-br"><b>과거 기저율</b> — ${escapeHtml(b.bucket)} 기업 ${b.n}개 중 <b>${frac}</b>가 ${b.horizon}년 동안 FCF 를 연 ${g} 이상 늘렸습니다(중앙값 ${b.median}%).${revLine}</p>
    <p class="dcf-muted">기간 ${escapeHtml(b.period || `${b.horizon}년`)}. 처음·끝 FCF 가 모두 양수인 현재 상장 대형주만 셌으므로(제외 ${b.excluded}개, 생존편향) 실제보다 높게 나옵니다. 과거 분포이지 확률 예측이 아닙니다.</p>`;
}

function dcfInputsHtml(ctx, c) {
  const st = ctx.state.st;
  const s = st.scenarios[st.active];
  const tabs = ["bear", "base", "bull"].map((k) => `<button type="button" data-dcf-scen="${k}" class="${st.active === k ? "is-active" : ""}" aria-pressed="${st.active === k}">${DCF_SCEN_LABEL[k]}</button>`).join("");
  const rows = DCF_FIELDS.map(([k, label, lo, hi, step, def]) => {
    const v = +(s[k] * 100).toFixed(2);
    return `<label class="dcf-field" title="${escapeHtml(def)}"><span>${escapeHtml(label)}</span>
      <input type="range" min="${lo}" max="${hi}" step="${step}" value="${v}" data-dcf-field="${k}" aria-label="${escapeHtml(label)}">
      <input type="number" min="${lo}" max="${hi}" step="${step}" value="${v}" data-dcf-field="${k}" class="dcf-num" aria-label="${escapeHtml(label)} %"><em>%</em></label>`;
  }).join("");
  return `<div class="dcf-scen-tabs"><div class="segmented" role="group" aria-label="시나리오">${tabs}</div>
      </div>
    <div class="dcf-fields">${rows}</div>`;
}

function dcfCommonHtml(ctx, c) {
  const dr = c.dr;
  const erp = MirDcfCore.ERP[ctx.market] || MirDcfCore.ERP.us;
  const rf = dr.rfInfo;
  const note = dr.fallback
    ? `기본값 ${dcfPct(dr.r)}(금리 자료가 없어 고정값)`
    : `기본값 ${dcfPct(dr.r, 2)} = ${escapeHtml(rf.label)} ${rf.pct.toFixed(2)}%(${escapeHtml(rf.source)}, ${escapeHtml(rf.asOf)}) + 주식위험프리미엄 ${dcfPct(erp.value, 2)}(${escapeHtml(erp.source)}, ${escapeHtml(erp.asOf)}) · 베타 1 가정`;
  const rv = +(c.r * 100).toFixed(2), tv = +(c.tg * 100).toFixed(2);
  return `<div class="dcf-common">
      <label class="dcf-field"><span>할인율</span><input type="number" min="3" max="25" step="0.1" value="${rv}" data-dcf-common="r" class="dcf-num" aria-label="할인율 %"><em>%</em></label>
      <label class="dcf-field"><span>영구성장률</span><input type="number" min="-2" max="5" step="0.1" value="${tv}" data-dcf-common="tg" class="dcf-num" aria-label="영구성장률 %"><em>%</em></label>
      <p class="dcf-muted dcf-common-note">${note}.</p>
    </div>`;
}

function dcfRangeSvg(vals, price) {
  const pts = vals.filter(Number.isFinite).concat(Number.isFinite(price) ? [price] : []);
  if (pts.length < 2) return "";
  let lo = Math.min(...pts), hi = Math.max(...pts);
  const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.1 || 1;
  lo -= pad; hi += pad;
  // viewBox 를 그릴 자리의 실제 폭에 맞춘다(고정 600 이면 넓은 화면에선 가운데만, 폰에선 글자가 깨알처럼 작아진다).
  const hostW = (typeof byId === "function" && byId("dcfSection") && byId("dcfSection").clientWidth) || 632;
  const W = Math.max(280, Math.min(1400, Math.round(hostW - 34))), H = 54;
  const x = (v) => 10 + (v - lo) / (hi - lo) * (W - 20);
  const [bear, base, bull] = vals;
  let out = "";
  if (Number.isFinite(bear) && Number.isFinite(bull)) out += `<rect x="${x(Math.min(bear, bull)).toFixed(1)}" y="18" width="${Math.max(2, Math.abs(x(bull) - x(bear))).toFixed(1)}" height="12" rx="6" class="dcf-range-bar"/>`;
  if (Number.isFinite(base)) out += `<circle cx="${x(base).toFixed(1)}" cy="24" r="6" class="dcf-range-base"/>`;
  if (Number.isFinite(price)) out += `<line x1="${x(price).toFixed(1)}" x2="${x(price).toFixed(1)}" y1="8" y2="40" class="dcf-range-price"/><text x="${x(price).toFixed(1)}" y="52" text-anchor="middle" class="dcf-range-lbl">현재가</text>`;
  return `<svg class="dcf-range" viewBox="0 0 ${W} ${H}" role="img" aria-label="시나리오별 주당 가치 범위와 현재가">${out}</svg>`;
}

function dcfResultHtml(ctx, c) {
  const vals = ["bear", "base", "bull"].map((k) => (c.scen[k].ok ? c.scen[k].perShare : NaN));
  const ok = vals.some(Number.isFinite);
  if (!ok) return `<p class="dcf-muted">${escapeHtml(c.scen.base.reason || "계산할 수 없습니다")}</p>`;
  const finite = vals.filter(Number.isFinite);
  const lo = Math.min(...finite), hi = Math.max(...finite);
  const neg = finite.some((v) => v <= 0);
  const cells = ["bear", "base", "bull"].map((k, i) => {
    const v = vals[i];
    const up = Number.isFinite(v) && c.price > 0 ? v / c.price - 1 : NaN;
    const sc = c.scen[k];
    return `<div class="dcf-scen-cell${ctx.state.st.active === k ? " is-active" : ""}"><span>${DCF_SCEN_LABEL[k]}</span><b>${escapeHtml(dcfPrice(v))}</b>
      <small>현재가 대비 ${dcfSignedPct(up)}${sc.ok ? ` · 영구가치 ${dcfPct(sc.terminalShare, 0)}` : ""}</small></div>`;
  }).join("");
  return `<p class="dcf-range-line">주당 가치 범위 <b>${escapeHtml(dcfPrice(lo))} ~ ${escapeHtml(dcfPrice(hi))}</b> <span class="dcf-muted">(약세~강세, 점은 기본)</span></p>
    ${dcfRangeSvg(vals, c.price)}
    <div class="dcf-scen-grid">${cells}</div>
    ${neg ? `<p class="dcf-muted">주당 가치가 0 이하인 시나리오는 순차입금이 영업가치보다 크다는 뜻입니다.</p>` : ""}`;
}

function dcfGridHtml(ctx, c) {
  const g = c.grid;
  const head = g.tgs.map((t) => `<th class="ins-num">${(t * 100).toFixed(1)}%</th>`).join("");
  const body = g.rs.map((r, i) => `<tr><th scope="row">${(r * 100).toFixed(1)}%</th>${g.cells[i].map((v, j) => {
    const center = i === Math.floor(g.rs.length / 2) && j === Math.floor(g.tgs.length / 2);
    const tone = Number.isFinite(v) && c.price > 0 ? (v >= c.price ? " dcf-above" : " dcf-below") : "";
    return `<td class="ins-num${tone}${center ? " dcf-center" : ""}">${v === null ? "—" : escapeHtml(dcfPrice(v))}</td>`;
  }).join("")}</tr>`).join("");
  return `<div class="dcf-grid-head"><h4>민감도 격자 <span class="muted">${DCF_SCEN_LABEL[ctx.state.st.active]} 시나리오 · 주당 가치</span></h4>
      <span class="dcf-muted">행 = 할인율, 열 = 영구성장률 · 진한 칸 = 현재가 이상</span></div>
    <div class="table-wrap mf-table-wrap"><table class="insider-table mf-table dcf-grid"><thead><tr><th>할인율 \\ 영구성장</th>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function dcfSectionHtml(ctx) {
  const c = dcfCompute(ctx);
  ctx.last = c;
  const el = MirDcfCore.eligibility(ctx.file, ctx.market);
  const st = ctx.state.st;
  const assumed = ctx.state.defs.assumed;
  const meta = `재무 ${typeof mfMetaLine === "function" ? mfMetaLine(ctx.file) : ""}`;
  if (!el.ok) {
    return `<div class="dcf-head"><h3>역DCF · 시나리오 DCF</h3></div>
      <p class="dcf-headline dcf-muted">${escapeHtml(el.reason)}</p>
      <p class="mf-foot">${meta}</p>`;
  }
  return `
    <div class="dcf-head">
      <div><h3>역DCF · 시나리오 DCF</h3><p class="mf-meta">${meta}</p></div>
      <div class="dcf-actions">
        <button type="button" class="ghost compact-btn" data-dcf-act="reset">기본값으로</button>
        <button type="button" class="ghost compact-btn" data-dcf-act="share">시나리오 링크 복사</button>
        <button type="button" class="ghost compact-btn" data-dcf-act="thesis">이 시나리오로 가설 만들기</button>
      </div>
    </div>
    ${st.fromLink ? `<p class="dcf-note">공유 링크의 가정을 불러왔습니다.</p>` : ""}
    <div class="dcf-common-slot">${dcfCommonHtml(ctx, c)}</div>
    <div class="dcf-reverse-slot">${dcfReverseHtml(ctx, c)}</div>
    <div class="dcf-block">
      <div class="dcf-block-head"><h4>시나리오 DCF <span class="muted">내 가정으로 계산한 주당 가치</span></h4></div>
      <div class="dcf-inputs-slot">${dcfInputsHtml(ctx, c)}</div>
      <div class="dcf-result-slot">${dcfResultHtml(ctx, c)}</div>
      <div class="dcf-grid-slot">${dcfGridHtml(ctx, c)}</div>
      ${assumed.length ? `<p class="dcf-muted">자료가 없어 가정값으로 시작한 항목: ${escapeHtml(assumed.join(", "))}.</p>` : ""}
    </div>
    <p class="mf-foot">추정치이며 가정에 극도로 민감합니다(할인율 1%p 차이로 주당 가치가 수십 % 달라질 수 있습니다). 투자 권유나 목표주가가 아닙니다.</p>
    <details class="stock-method"><summary>계산 방법</summary>
      <p>FCF = 영업활동현금흐름 − 설비투자. 주당 가치 = (기업가치 − 순차입금) ÷ ${escapeHtml(c.shares ? c.shares.label : "희석 주식수")}.</p>
      <p>시나리오 DCF 는 최근 4분기(TTM) 매출에서 시작하고, 영업이익률은 현재 값에서 5년차 목표로 직선 이동합니다.</p>
    </details>`;
}

// 부분 갱신 — 슬라이더를 끄는 동안 입력 포커스가 날아가지 않게 결과 칸만 다시 그린다.
function dcfRefresh(host, ctx, { inputs = false, common = false } = {}) {
  const c = dcfCompute(ctx);
  ctx.last = c;
  const put = (sel, html) => { const el = host.querySelector(sel); if (el) el.innerHTML = html; };
  put(".dcf-reverse-slot", dcfReverseHtml(ctx, c));
  put(".dcf-result-slot", dcfResultHtml(ctx, c));
  put(".dcf-grid-slot", dcfGridHtml(ctx, c));
  if (inputs) put(".dcf-inputs-slot", dcfInputsHtml(ctx, c));
  if (common) put(".dcf-common-slot", dcfCommonHtml(ctx, c));
}

function dcfPersist(ctx) {
  const st = ctx.state.st;
  dcfSaveState(ctx.key, { basis: st.basis, r: st.r, tg: st.tg, scenarios: st.scenarios, active: st.active, fromLink: st.fromLink });
}

function dcfBind(host) {
  if (host.dataset.dcfBound) return;
  host.dataset.dcfBound = "1";
  const onInput = (e) => {
    const ctx = dcfCurrent;
    if (!ctx) return;
    const t = e.target;
    const v = Number(t.value);
    if (t.dataset.dcfField && Number.isFinite(v)) {
      const st = ctx.state.st;
      st.scenarios = { ...st.scenarios, [st.active]: { ...st.scenarios[st.active], [t.dataset.dcfField]: v / 100 } };
      host.querySelectorAll(`[data-dcf-field="${t.dataset.dcfField}"]`).forEach((el) => { if (el !== t) el.value = t.value; });
      dcfPersist(ctx);
      dcfRefresh(host, ctx);
    } else if (t.dataset.dcfCommon && Number.isFinite(v)) {
      const st = ctx.state.st;
      const val = v / 100;
      if (t.dataset.dcfCommon === "r") st.r = val; else st.tg = val;
      dcfPersist(ctx);
      dcfRefresh(host, ctx);
    }
  };
  host.addEventListener("input", onInput);
  host.addEventListener("click", (e) => {
    const ctx = dcfCurrent;
    if (!ctx) return;
    const b = e.target.closest("[data-dcf-basis]");
    const s = e.target.closest("[data-dcf-scen]");
    const a = e.target.closest("[data-dcf-act]");
    if (b && !b.disabled) {
      ctx.state.st.basis = b.dataset.dcfBasis;
      dcfPersist(ctx);
      dcfRefresh(host, ctx);
    } else if (s) {
      ctx.state.st.active = s.dataset.dcfScen;
      dcfPersist(ctx);
      dcfRefresh(host, ctx, { inputs: true });
    } else if (a) {
      dcfAction(host, ctx, a.dataset.dcfAct);
    }
  });
}

function dcfAction(host, ctx, act) {
  const st = ctx.state.st;
  if (act === "reset") {
    ctx.state.st = { basis: null, r: null, tg: MirDcfCore.DEFAULT_TERMINAL, scenarios: ctx.state.defs.scenarios, active: "base", fromLink: false, edited: false };
    const all = dcfLoadAll();
    delete all[ctx.key];
    if (window.safeStorage) window.safeStorage.setJSON(DCF_STATE_KEY, all);
    host.innerHTML = dcfSectionHtml(ctx);
    return;
  }
  if (act === "share") {
    const c = ctx.last || dcfCompute(ctx);
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("market", ctx.market);
    url.searchParams.set("ticker", ctx.ticker);
    url.searchParams.set("dcf", MirDcfCore.encodeState({ r: c.r, tg: c.tg, scenarios: st.scenarios }));
    const done = (ok) => (typeof showAppToast === "function" ? showAppToast(ok ? "시나리오 링크를 복사했습니다." : "복사에 실패했습니다.") : null);
    if (navigator.clipboard) navigator.clipboard.writeText(url.toString()).then(() => done(true), () => done(false));
    else done(false);
    return;
  }
  if (act === "thesis") {
    const c = ctx.last || dcfCompute(ctx);
    const s = st.scenarios[st.active];
    const v = c.scen[st.active];
    if (!window.MirThesis || !v || !v.ok) { if (typeof showAppToast === "function") showAppToast("가설 추적을 열 수 없습니다."); return; }
    const text = `${DCF_SCEN_LABEL[st.active]} 시나리오 DCF: 매출 1~5년 연 ${dcfPct(s.g1)}·6~10년 ${dcfPct(s.g2)}, 영업이익률 ${dcfPct(s.margin)}, 재투자율 ${dcfPct(s.reinvest, 0)}, 할인율 ${dcfPct(c.r)}·영구성장 ${dcfPct(c.tg)} → 주당 ${dcfPrice(v.perShare)}(현재가 ${dcfPrice(c.price)}). 추정치.`;
    const target = v.perShare > 0 ? String(ctx.market === "kr" ? Math.round(v.perShare) : +v.perShare.toFixed(2)) : "";
    window.MirThesis.openForTicker(ctx.ticker, { text: text.slice(0, 300), target });
  }
}

// KR 재무 파일에 DART 주식수가 아직 없으면 스냅샷 상장주식수로 보완한 사본(dcf-core withListedShares).
// 같은 원본·같은 주식수면 같은 사본을 돌려준다 — renderDcf 의 '같은 파일이면 다시 안 그림' 비교가 깨지지 않게.
const dcfSharesCache = new WeakMap();
function dcfFileWithShares(file, item) {
  if (!file || typeof file !== "object" || !window.MirDcfCore || !MirDcfCore.withListedShares) return file;
  const sk = `${item && item.listedShares}|${item && item.marketCapB}|${item && item.price}`;
  const hit = dcfSharesCache.get(file);
  if (hit && hit.sk === sk) return hit.out;
  const out = MirDcfCore.withListedShares(file, item);
  dcfSharesCache.set(file, { sk, out });
  return out;
}

// 종목 분석 뷰(#dcfSection). 재무 파일이 없는 종목·ETF 는 숨긴다.
function renderDcf(item) {
  const host = byId("dcfSection");
  if (!host) return;
  const hide = () => { host.hidden = true; host.innerHTML = ""; dcfCurrent = null; };
  if (!item || !item.ticker || !window.MirDcfCore || typeof loadFinancials !== "function"
      || (typeof isStockEtf === "function" && isStockEtf(item))) return hide();
  const ticker = item.ticker;
  const rawFile = financialsCached(ticker);
  if (rawFile === null) return hide();
  const file = rawFile === undefined ? undefined : dcfFileWithShares(rawFile, item);
  if (file === undefined) {
    loadFinancials(ticker).then((f) => {
      if (typeof selectedTicker !== "undefined" && dcfKey(selectedTicker) !== dcfKey(ticker)) return;
      if (!f) { hide(); return; }
      renderDcf(item);
    });
    return;
  }
  const key = dcfKey(ticker);
  const rf = dcfRiskFree();
  // 같은 종목·같은 입력이면 다시 그리지 않는다(refreshFeatureViews 가 부팅 중 여러 번 부른다 — 입력 포커스 보존).
  const sig = `${key}|${Number(item.price)}|${rf ? rf.pct : ""}|${window.DCF_BASE_RATES ? 1 : 0}`;
  if (dcfCurrent && dcfCurrent.sig === sig && dcfCurrent.file === file && !host.hidden && host.firstElementChild) return;
  dcfApplyRoute(ticker);
  const ctx = { key, ticker: typeof mfTickerKey === "function" ? mfTickerKey(ticker) : ticker, file, item, market: dcfMarket(), sig };
  ctx.state = dcfState(ctx);
  dcfCurrent = ctx;
  dcfBind(host);
  host.hidden = false;
  host.innerHTML = dcfSectionHtml(ctx);
  // 금리·기저율이 늦게 오면 받은 뒤 한 번 더(피처 데이터 경합).
  if (!rf || !window.DCF_BASE_RATES) {
    dcfEnsureInputs().then(() => {
      if (dcfCurrent === ctx && (dcfRiskFree() || window.DCF_BASE_RATES)) renderDcf(item);
    });
  }
}

// ── AI 모드 DCF 패널(요약) ──
function dcfAiPanelHtml(item, rawFile) {
  const core = window.MirDcfCore;
  if (!core || !rawFile) return "";
  const file = dcfFileWithShares(rawFile, item);
  const market = dcfMarket();
  const price = Number(item.price);
  const el = core.eligibility(file, market);
  if (!el.ok) {
    return aiModePanel("역DCF", "시장 가격에 들어 있는 성장률", `<div style="font-size:var(--fs-sub);color:var(--muted);line-height:1.65">${escapeHtml(el.reason)}</div>`);
  }
  const key = dcfKey(item.ticker);
  const saved = dcfLoadAll()[key] || {};
  const dr = dcfDefaultR();
  const r = Number.isFinite(saved.r) ? saved.r : dr.r;
  const tg = Number.isFinite(saved.tg) ? saved.tg : core.DEFAULT_TERMINAL;
  const rev = core.reverseDcf(file, { market, price, r, tg, basis: saved.basis || undefined });
  if (!rev.ok) {
    return aiModePanel("역DCF", "시장 가격에 들어 있는 성장률", `<div style="font-size:var(--fs-sub);color:var(--muted);line-height:1.65">${escapeHtml(rev.reason || "계산할 수 없습니다")}</div>`);
  }
  const gText = rev.bound === "above" ? "> 100%" : rev.bound === "below" ? "< −50%" : dcfPct(rev.g);
  let brText = "—";
  const dist = window.DCF_BASE_RATES;
  if (dist && !rev.bound) {
    const defs = core.defaultScenarios(file, market);
    const b = core.baseRate(dist, market, defs.base.rev0, rev.g, "fcf");
    if (b.ok) brText = `${Math.round(b.fraction * 100)}% (n=${b.n}, ${b.horizon}년)`;
  }
  const body = aiMetricGrid([
    { label: "필요 FCF 성장률", value: `연 ${gText}` },
    { label: "기준 FCF", value: `${mfMoney(rev.fcf0, file.currency)} · ${rev.basis === "avg3" ? "3년 평균" : "TTM"}` },
    { label: "할인율 · 영구성장", value: `${dcfPct(r)} · ${dcfPct(tg)}` },
    { label: "과거 달성 비율", value: brText },
  ]) + `<div style="font-size:var(--fs-cap);color:var(--muted);margin-top:10px;line-height:1.65">현재가 ${escapeHtml(dcfPrice(price))}를 정당화하려면 향후 10년 FCF 가 매년 이만큼 자라야 한다는 역산입니다. 할인율 = ${dr.fallback ? "고정 기본값" : `${escapeHtml(dr.rfInfo.label)} + 주식위험프리미엄(Damodaran)`}. 과거 달성 비율은 비슷한 매출 규모 기업의 과거 분포(생존편향 있음)입니다. <b>추정치이며 가정에 극도로 민감</b>하고 투자 권유가 아닙니다. 가정을 바꾸는 시나리오 DCF 는 종목 분석 화면에 있습니다.${rev.shares && rev.shares.fallback ? ` 주식수: ${escapeHtml(rev.shares.label)}.` : ""}</div>`;
  return aiModePanel("역DCF", "시장 가격에 들어 있는 성장률 · 추정", body);
}

function hydrateDcfAiPanels(item) {
  if (typeof loadFinancials !== "function") return;
  Promise.all([loadFinancials(item.ticker), dcfEnsureInputs()]).then(([file]) => {
    const key = dcfKey(item.ticker);
    document.querySelectorAll("[data-dcf-ai]").forEach((el) => {
      if (el.dataset.dcfAi !== key) return;
      const html = file ? dcfAiPanelHtml(item, file) : "";
      if (html) el.outerHTML = html; else el.remove();
    });
  });
}
