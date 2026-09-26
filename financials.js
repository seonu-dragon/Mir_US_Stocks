// financials.js — 종목 분석 › 재무 섹션 + AI 모드 재무 패널
// =====================================================
// 데이터: scripts/build_financials_us.py(SEC) · build_financials_kr.py(DART) 가 만드는 종목별 파일
//   US data/financials/<TICKER>.json · KR data/korea/financials/<코드>.json (스키마는 scripts/financials_common.py)
// 인덱스 window.FINANCIALS_INDEX(FEATURE_DATA 키 financialsIndex, 시장별 파일)에 있는 종목만 요청한다.
// 계산은 financials-core.js(window.MirFinCore). 과거 공시 수치를 옮긴 '정보' 이며 예측·매매 신호가 아니다.
// 클래식 스크립트(전역 공유) — 이름은 mf* / *Financials* 로 충돌을 피한다(ai-mode.js 의 finMoney 와 별개).

const MF_CACHE = new Map();      // `${market}:${ticker}` → 파일 | null(없음)
const MF_PROMISES = new Map();
const MF_STATE_KEY = "mir.financials.view";
const mfView = Object.assign({ kind: "annual", chart: "income" },
  (window.safeStorage && window.safeStorage.getJSON(MF_STATE_KEY, null)) || {});
let mfCurrent = null;            // { ticker, file } — 토글 재렌더용

const MF_CHARTS = {
  income: { label: "매출·영업이익", bars: [["rev", "매출"], ["op", "영업이익"]], line: ["opMargin", "영업이익률", "pct"] },
  profit: { label: "순이익·EPS", bars: [["net", "순이익"]], line: ["epsDil", "희석 EPS", "eps"] },
  cash: { label: "현금흐름", bars: [["ocf", "영업CF"], ["capex", "설비투자"], ["fcf", "FCF"]], line: ["fcfMargin", "FCF 마진", "pct"], general: true },
  balance: { label: "현금·차입금", bars: [["cash", "현금"], ["debt", "총차입금"]], line: null, general: true },
  shares: { label: "주식수", bars: [["sharesDilAvg", "희석 가중평균"], ["sharesOut", "기말 발행"]], line: null, unit: "shares" },
};

// 화면 각주의 정의 — financials-core.js 머리 주석과 같은 문장.
const MF_METRICS = [
  ["fcf", "FCF", "money", "영업활동현금흐름 − 설비투자(유형자산 취득)"],
  ["fcfMargin", "FCF 마진", "pct", "FCF ÷ 매출"],
  ["opMargin", "영업이익률", "pct", "영업이익 ÷ 매출"],
  ["roic", "ROIC", "pct", "영업이익×(1−실효세율) ÷ 투하자본(자본총계+총차입금−현금, 기초·기말 평균). 실효세율 = 법인세÷세전이익(0~50%일 때만)"],
  ["netDebtToEbitda", "순차입금/EBITDA", "x", "(총차입금−현금) ÷ (영업이익+감가상각비). EBITDA ≤ 0 이면 표시 안 함"],
  ["shareChange", "주식수 증감(전년비)", "spct", "가중평균 희석 주식수의 전년 대비 변화(없으면 기말 발행주식수, '기본' 표시). TTM 열은 최근 분기 vs 1년 전 같은 분기"],
  ["sbcToRevenue", "SBC/매출", "pct", "주식보상비용 ÷ 매출"],
  ["earningsQuality", "이익의 질", "x", "FCF ÷ 순이익(순이익이 양수일 때만)"],
  ["currentRatio", "유동비율", "x", "유동자산 ÷ 유동부채"],
];

const MF_ACCOUNTS = [
  ["rev", "매출"], ["op", "영업이익"], ["net", "순이익(지배)"], ["epsDil", "희석 EPS", "eps"],
  ["ocf", "영업활동현금흐름"], ["capex", "설비투자"], ["fcf", "FCF"], ["sbc", "주식보상비용"],
  ["da", "감가상각비"], ["interest", "이자비용"], ["tax", "법인세비용"], ["pretax", "세전이익"],
  ["cash", "현금및현금성자산"], ["debt", "총차입금"], ["netDebt", "순차입금"], ["equity", "자본총계"],
  ["liab", "부채총계"], ["assets", "자산총계"], ["curAssets", "유동자산"], ["curLiab", "유동부채"],
  ["receivables", "매출채권"], ["sharesDilAvg", "희석 가중평균 주식수", "shares"], ["sharesOut", "기말 발행주식수", "shares"],
];

function mfMarket() {
  return (typeof isKrMarket === "function" && isKrMarket()) ? "kr" : "us";
}

function mfTickerKey(ticker) {
  if (mfMarket() === "kr") return (typeof normalizeTickerKey === "function") ? normalizeTickerKey(ticker) : String(ticker || "");
  return String(ticker || "").toUpperCase();
}

function mfFilePath(key) {
  if (mfMarket() === "kr") return `data/korea/financials/${encodeURIComponent(key)}.json`;
  const safe = (typeof safeTicker === "function") ? safeTicker(key) : key;
  return `data/financials/${encodeURIComponent(safe)}.json`;
}

function mfIndexEntry(key) {
  const idx = window.FINANCIALS_INDEX;
  if (!idx || idx.market !== mfMarket()) return null;
  return (idx.tickers || {})[key] || null;
}

// 동기 조회: 파일(로드됨) · null(없음 확정) · undefined(아직 모름).
function financialsCached(ticker) {
  return MF_CACHE.get(`${mfMarket()}:${mfTickerKey(ticker)}`);
}

function loadFinancials(ticker) {
  const key = mfTickerKey(ticker);
  const cacheKey = `${mfMarket()}:${key}`;
  if (!key) return Promise.resolve(null);
  if (MF_CACHE.has(cacheKey)) return Promise.resolve(MF_CACHE.get(cacheKey));
  if (MF_PROMISES.has(cacheKey)) return MF_PROMISES.get(cacheKey);
  const market = mfMarket();
  const p = ensureFeatureData("financialsIndex").then((ok) => {
    if (!ok || !mfIndexEntry(key) || mfMarket() !== market) return null;
    return fetch(mfFilePath(key), { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((doc) => (doc && doc.schema === 1 && (doc.annual || []).length + (doc.quarterly || []).length ? doc : null))
      .catch(() => null);
  }).then((doc) => {
    if (doc) delete doc._raw;   // 빌더 증분 상태 — 화면은 안 쓴다
    MF_CACHE.set(cacheKey, doc || null);
    MF_PROMISES.delete(cacheKey);
    return doc || null;
  });
  MF_PROMISES.set(cacheKey, p);
  return p;
}

// ── 포맷 ──
function mfMoney(v, currency) {
  const n = Number(v);
  if (v === null || v === undefined || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (currency === "KRW") {
    if (a >= 1e12) return `${sign}${(a / 1e12).toFixed(a >= 1e14 ? 0 : 1)}조`;
    if (a >= 1e8) return `${sign}${Math.round(a / 1e8).toLocaleString()}억`;
    return `${sign}${Math.round(a / 1e4).toLocaleString()}만`;
  }
  const pre = currency === "USD" ? "$" : "";
  const post = currency && currency !== "USD" ? ` ${currency}` : "";
  if (a >= 1e12) return `${sign}${pre}${(a / 1e12).toFixed(2)}T${post}`;
  if (a >= 1e9) return `${sign}${pre}${(a / 1e9).toFixed(a >= 1e11 ? 0 : 1)}B${post}`;
  if (a >= 1e6) return `${sign}${pre}${(a / 1e6).toFixed(0)}M${post}`;
  return `${sign}${pre}${Math.round(a).toLocaleString()}${post}`;
}

function mfShares(v) {
  const n = Number(v);
  if (v === null || v === undefined || !Number.isFinite(n)) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B주`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M주`;
  return `${Math.round(n).toLocaleString()}주`;
}

function mfEps(v, currency) {
  const n = Number(v);
  if (v === null || v === undefined || !Number.isFinite(n)) return "—";
  if (currency === "KRW") return `${Math.round(n).toLocaleString()}원`;
  return `${currency === "USD" ? "$" : ""}${n.toFixed(2)}${currency && currency !== "USD" ? ` ${currency}` : ""}`;
}

function mfFormat(v, type, currency) {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return "—";
  const n = Number(v);
  if (type === "pct") return `${(n * 100).toFixed(1)}%`;
  if (type === "spct") return `${n > 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;
  if (type === "x") return `${n.toFixed(2)}배`;
  if (type === "eps") return mfEps(n, currency);
  if (type === "shares") return mfShares(n);
  return mfMoney(n, currency);
}

// ── 차트: 막대(최대 3계열) + 선(보조축) ──
function mfChartSvg(points, preset, currency, width) {
  // viewBox 를 실제 폭에 맞춰 글자가 찌그러지지 않게 한다(preserveAspectRatio="none" 금지).
  const W = Math.max(280, Math.round(width || 720)), H = W < 520 ? 180 : 220, padL = 8, padR = 8, top = 14, bottom = 26;
  const n = points.length;
  if (!n) return "";
  const barKeys = preset.bars.map((b) => b[0]);
  const vals = [];
  points.forEach((p) => barKeys.forEach((k) => { if (Number.isFinite(p[k])) vals.push(p[k]); }));
  if (!vals.length) return `<p class="muted mf-empty">이 구간에 표시할 값이 없습니다(결측).</p>`;
  const max = Math.max(0, ...vals), min = Math.min(0, ...vals);
  const span = (max - min) || 1;
  const plotH = H - top - bottom;
  const y = (v) => top + (max - v) / span * plotH;
  const slot = (W - padL - padR) / n;
  const groupW = Math.min(slot * 0.78, 64);
  const bw = groupW / barKeys.length;
  const colors = ["var(--mf-c1)", "var(--mf-c2)", "var(--mf-c3)"];
  let bars = "", labels = "";
  points.forEach((p, i) => {
    const x0 = padL + slot * i + (slot - groupW) / 2;
    barKeys.forEach((k, j) => {
      const v = p[k];
      if (!Number.isFinite(v)) return;
      const y1 = y(Math.max(0, v)), y2 = y(Math.min(0, v));
      const derived = (p.derived || []).includes(k);
      bars += `<rect x="${(x0 + j * bw).toFixed(1)}" y="${y1.toFixed(1)}" width="${Math.max(1, bw - 2).toFixed(1)}" height="${Math.max(1, y2 - y1).toFixed(1)}" rx="2" fill="${colors[j]}"${derived ? ' fill-opacity="0.62"' : ""}><title>${escapeHtml(p.label)} ${escapeHtml(preset.bars[j][1])} ${escapeHtml(preset.unit === "shares" ? mfShares(v) : mfMoney(v, currency))}${derived ? " (누계 차이로 산출)" : ""}</title></rect>`;
    });
    const every = Math.max(1, Math.ceil(n * 46 / (W - padL - padR)));
    if ((n - 1 - i) % every === 0) {   // 최근 기간을 기준으로 건너뛴다(끝 라벨 겹침 방지)
      labels += `<text x="${(padL + slot * i + slot / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" class="mf-axis">${escapeHtml(p.label)}</text>`;
    }
  });
  const zero = `<line x1="${padL}" x2="${W - padR}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" class="mf-zero"/>`;
  let line = "";
  if (preset.line) {
    const [lk, , ltype] = preset.line;
    const lv = points.map((p) => p[lk]).filter(Number.isFinite);
    if (lv.length >= 2) {
      const lmax = Math.max(...lv), lmin = Math.min(...lv);
      const lspan = (lmax - lmin) || Math.abs(lmax) || 1;
      const ly = (v) => top + 6 + (lmax - v) / lspan * (plotH - 12);
      let d = "", dots = "";
      points.forEach((p, i) => {
        const v = p[lk];
        if (!Number.isFinite(v)) return;
        const cx = padL + slot * i + slot / 2;
        d += `${d ? "L" : "M"}${cx.toFixed(1)},${ly(v).toFixed(1)}`;
        dots += `<circle cx="${cx.toFixed(1)}" cy="${ly(v).toFixed(1)}" r="3" class="mf-dot"><title>${escapeHtml(p.label)} ${escapeHtml(preset.line[1])} ${escapeHtml(mfFormat(v, ltype, currency))}</title></circle>`;
      });
      line = `<path d="${d}" class="mf-line"/>${dots}`;
    }
  }
  return `<svg class="mf-chart" viewBox="0 0 ${W} ${H}" style="height:${H}px" role="img" aria-label="${escapeHtml(preset.label)} 차트">${zero}${bars}${line}${labels}</svg>`;
}

function mfLegend(preset) {
  const cls = ["mf-c1", "mf-c2", "mf-c3"];
  const items = preset.bars.map((b, i) => `<span><i class="mf-sw ${cls[i]}"></i>${escapeHtml(b[1])}</span>`);
  if (preset.line) items.push(`<span><i class="mf-sw mf-sw-line"></i>${escapeHtml(preset.line[1])}(선)</span>`);
  return `<div class="mf-legend">${items.join("")}</div>`;
}

function mfMetaLine(file) {
  const src = file.market === "kr"
    ? `DART 전체재무제표 · ${file.basis === "OFS" ? "별도" : "연결"}(${escapeHtml(file.basis || "")})`
    : `SEC EDGAR XBRL · ${escapeHtml(file.annualForm || "10-K")}${(file.quarterly || []).length ? "·10-Q" : ""} · ${escapeHtml(file.basis || "")}`;
  const a = (file.annual || [])[file.annual.length - 1];
  const q = (file.quarterly || [])[file.quarterly.length - 1];
  const bits = [`출처 ${src}`];
  if (a) bits.push(`최근 결산 FY${a.fy}${a.end ? `(${a.end})` : ""}`);
  if (q) bits.push(`최근 분기 ${q.fy} ${q.fq}Q${q.end ? `(${q.end})` : ""}`);
  if (file.lastFiled) bits.push(`반영 공시 ${escapeHtml(file.lastFiled)}`);
  if (file.updatedAtKst) bits.push(`갱신 ${escapeHtml(String(file.updatedAtKst).slice(0, 10))}`);
  return bits.join(" · ");
}

function mfFlagBadges(file) {
  const f = file.flags || [];
  const out = [];
  const kindKo = { bank: "은행", insurance: "보험" }[file.industryType];
  if (f.includes("financial")) out.push(kindKo ? `금융업(${kindKo})` : "금융업");
  if (f.includes("foreignFiler")) out.push(`해외발행인(${escapeHtml(file.annualForm || "20-F")})`);
  if (f.includes("nonUsdReporting")) out.push(`보고통화 ${escapeHtml(file.currency)}`);
  if (f.includes("noQuarterly")) out.push("분기 공시 없음");
  return out.map((t) => `<span class="mf-badge">${t}</span>`).join("");
}

function mfNotes(file, suppressed) {
  const f = file.flags || [];
  const notes = [];
  if (f.includes("financial")) notes.push("금융업은 예금·보험부채가 영업 자금이라 FCF·순차입금·ROIC·유동비율이 제조업과 뜻이 달라 표에서 뺐습니다(계정 원값은 아래 표에 있습니다).");
  if (f.includes("foreignFiler")) notes.push(`20-F/40-F 발행인은 연간만 공시하고, 금액이 ${escapeHtml(file.currency)} 기준입니다. EPS·주식수는 원주 기준이라 ADR(예탁증서) 1주와 다를 수 있습니다.`);
  if (file.market === "kr") notes.push("DART 는 감가상각비·주식보상비용·이자비용을 본문에 따로 싣지 않는 회사가 많아 해당 칸과 순차입금/EBITDA 가 비는 경우가 많습니다. 기말일은 DART 가 주지 않아 사업연도·분기로만 표시합니다.");
  if (!suppressed.size && !notes.length) return "";
  return notes.map((t) => `<p class="mf-note">${t}</p>`).join("");
}

function mfDerivedTable(file) {
  const core = window.MirFinCore;
  const { cols, suppressed } = core.derivedMetrics(file, 5);
  if (!cols.length) return "";
  const cur = file.currency;
  const head = cols.map((c) => `<th class="ins-num">${escapeHtml(c.label)}${c.kind === "ttm" && (c.row.d || []).length ? '<sup title="누계 차이로 만든 분기 값이 포함됨">†</sup>' : ""}</th>`).join("");
  // 모든 열이 결측인 지표 줄은 뺀다(KR 의 감가상각·SBC 처럼 원천이 없는 경우 — 각주로 설명).
  const body = MF_METRICS.filter(([k]) => !suppressed.has(k) && cols.some((c) => c.metrics[k] !== null && c.metrics[k] !== undefined)).map(([k, label, type, def]) => {
    const cells = cols.map((c) => {
      const v = c.metrics[k];
      const basic = k === "shareChange" && c.metrics.shareChangeBasis === "basic" && v !== null;
      const tone = (type === "pct" || type === "spct") && Number.isFinite(v) && v < 0 ? " ins-sell" : "";
      return `<td class="ins-num${tone}"${v === null ? ' title="결측 — 원천 계정이 없거나 계산 조건 밖"' : ""}>${escapeHtml(mfFormat(v, type, cur))}${basic ? '<small class="muted"> 기본</small>' : ""}</td>`;
    }).join("");
    return `<tr><th scope="row" title="${escapeHtml(def)}">${escapeHtml(label)}</th>${cells}</tr>`;
  }).join("");
  return `<div class="table-wrap mf-table-wrap"><table class="insider-table mf-table">
    <thead><tr><th>파생 지표</th>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function mfAccountsTable(file, kind) {
  const rows = kind === "quarterly" ? (file.quarterly || []).slice(-8) : (file.annual || []).slice(-6);
  const core = window.MirFinCore;
  const cols = rows.map((r) => ({ row: r, label: core.periodLabel(r, kind) }));
  if (file.ttm && file.ttm.basis === "4Q") cols.push({ row: file.ttm, label: "TTM" });
  if (!cols.length) return "";
  const cur = file.currency;
  const present = MF_ACCOUNTS.filter(([k]) => cols.some((c) => Number.isFinite(c.row[k])));
  const head = cols.map((c) => `<th class="ins-num">${escapeHtml(c.label)}</th>`).join("");
  const body = present.map(([k, label, type]) => `<tr><th scope="row">${escapeHtml(label)}</th>${cols.map((c) => {
    const v = c.row[k];
    const derived = core.isDerived(c.row, k) || (k === "fcf" && (core.isDerived(c.row, "ocf") || core.isDerived(c.row, "capex")));
    return `<td class="ins-num${Number(v) < 0 ? " ins-sell" : ""}">${escapeHtml(mfFormat(v, type || "money", cur))}${derived && Number.isFinite(v) ? '<sup class="mf-derived" title="누계 차이로 산출">†</sup>' : ""}</td>`;
  }).join("")}</tr>`).join("");
  return `<details class="mf-accounts"><summary>계정 원값 (${kind === "quarterly" ? "최근 8분기" : "최근 6년"} + TTM)</summary>
    <div class="table-wrap mf-table-wrap"><table class="insider-table mf-table">
    <thead><tr><th>계정</th>${head}</tr></thead><tbody>${body}</tbody></table></div></details>`;
}

function mfSectionHtml(file, width) {
  const core = window.MirFinCore;
  const kind = mfView.kind === "quarterly" && (file.quarterly || []).length ? "quarterly" : "annual";
  const general = !(file.flags || []).includes("financial");
  const presets = Object.entries(MF_CHARTS).filter(([, p]) => general || !p.general);
  const chartKey = presets.some(([k]) => k === mfView.chart) ? mfView.chart : "income";
  const preset = MF_CHARTS[chartKey];
  const keys = preset.bars.map((b) => b[0]).concat(preset.line ? [preset.line[0]] : []);
  const pts = core.series(file, kind, keys).slice(kind === "quarterly" ? -12 : -10);
  const { suppressed } = core.derivedMetrics(file, 5);
  const hasQ = (file.quarterly || []).length > 0;
  return `
    <div class="mf-head">
      <div>
        <h3>재무</h3>
        <p class="mf-meta">${mfMetaLine(file)}</p>
      </div>
      <div class="mf-badges">${mfFlagBadges(file)}</div>
    </div>
    <div class="mf-controls">
      <div class="segmented mf-kind" role="group" aria-label="연간·분기">
        <button type="button" data-mf-kind="annual" class="${kind === "annual" ? "is-active" : ""}">연간</button>
        <button type="button" data-mf-kind="quarterly" class="${kind === "quarterly" ? "is-active" : ""}"${hasQ ? "" : ' disabled title="분기 공시 없음"'}>분기</button>
      </div>
      <div class="mf-chips" role="group" aria-label="차트 항목">
        ${presets.map(([k, p]) => `<button type="button" class="mf-chip${k === chartKey ? " is-active" : ""}" data-mf-chart="${k}">${escapeHtml(p.label)}</button>`).join("")}
      </div>
    </div>
    ${mfLegend(preset)}
    <div class="mf-chart-wrap">${mfChartSvg(pts, preset, file.currency, width)}</div>
    ${mfDerivedTable(file)}
    ${mfAccountsTable(file, kind)}
    ${mfNotes(file, suppressed)}
    <p class="mf-foot">공시 원문 수치를 옮긴 과거 정보이며 예측이나 매매 신호가 아닙니다. —(결측)은 공시에 해당 계정이 없거나 표준 태그로 확인되지 않은 것이고, 추정으로 채우지 않았습니다.
      †·옅은 막대는 누계에서 빼서 만든 분기 값입니다(현금흐름표는 누계로만 공시, 4분기 = 연간 − 3분기 누계). 지표 이름에 마우스를 올리면 정의가 보입니다.</p>`;
}

function mfBind(host) {
  if (host.dataset.mfBound) return;
  host.dataset.mfBound = "1";
  host.addEventListener("click", (e) => {
    const k = e.target.closest("[data-mf-kind]");
    const c = e.target.closest("[data-mf-chart]");
    if (!k && !c) return;
    if (k && !k.disabled) mfView.kind = k.dataset.mfKind;
    if (c) mfView.chart = c.dataset.mfChart;
    if (window.safeStorage) window.safeStorage.setJSON(MF_STATE_KEY, { kind: mfView.kind, chart: mfView.chart });
    if (mfCurrent && mfCurrent.file) host.innerHTML = mfSectionHtml(mfCurrent.file, mfChartWidth(host));
  });
}

function mfChartWidth(host) {
  const w = host && host.clientWidth ? host.clientWidth - 32 : 0;
  return w > 0 ? w : 720;
}

function mfHide(host) {
  host.hidden = true;
  host.innerHTML = "";
  mfCurrent = null;
}

// 종목 분석 뷰(#financialsSection). 인덱스에 없는 종목·ETF 는 섹션을 숨긴다.
function renderFinancials(item) {
  const host = byId("financialsSection");
  if (!host) return;
  if (!item || !item.ticker || (typeof isStockEtf === "function" && isStockEtf(item)) || !window.MirFinCore) {
    mfHide(host);
    return;
  }
  const ticker = item.ticker;
  const cached = financialsCached(ticker);
  if (cached) {
    mfBind(host);
    // 같은 종목이 이미 그려져 있으면 다시 그리지 않는다(refreshFeatureViews 가 부팅 중 여러 번 부른다 —
    // 펼쳐 둔 계정 표가 접히지 않게).
    if (mfCurrent && mfCurrent.file === cached && !host.hidden && host.firstElementChild) return;
    mfCurrent = { ticker, file: cached };
    host.hidden = false;
    host.innerHTML = mfSectionHtml(cached, mfChartWidth(host));
    return;
  }
  if (cached === null) { mfHide(host); return; }
  loadFinancials(ticker).then((file) => {
    if (typeof selectedTicker !== "undefined" && mfTickerKey(selectedTicker) !== mfTickerKey(ticker)) return;
    if (!file) { mfHide(host); return; }
    renderFinancials(item);
  });
}

// ── AI 모드 재무 패널 ──
function financialsAiPanelHtml(file) {
  const core = window.MirFinCore;
  if (!file || !core) return "";
  const cur = file.currency;
  const ttm = file.ttm || {};
  const { cols, suppressed } = core.derivedMetrics(file, 5);
  const last = cols[cols.length - 1] || { metrics: {} };
  const m = last.metrics;
  const grid = aiMetricGrid([
    { label: ttm.basis === "4Q" ? "매출(TTM)" : `매출(FY${ttm.fy || ""})`, value: mfMoney(ttm.rev, cur) },
    { label: "영업이익률", value: mfFormat(m.opMargin, "pct", cur) },
    suppressed.has("fcf") ? { label: "순이익", value: mfMoney(ttm.net, cur) } : { label: "FCF", value: mfMoney(m.fcf, cur), tone: Number(m.fcf) < 0 ? "warn" : "" },
    suppressed.has("roic") ? { label: "희석 EPS", value: mfFormat(ttm.epsDil, "eps", cur) } : { label: "ROIC", value: mfFormat(m.roic, "pct", cur) },
  ]);
  const rows = (file.annual || []).slice(-6).reverse().map((r) => {
    const mm = core.metricsFor(r, null);
    return `<tr><td class="ins-date">${r.fy}</td><td class="ins-num">${escapeHtml(mfMoney(r.rev, cur))}</td>
      <td class="ins-num ${Number(r.op) < 0 ? "ins-sell" : ""}">${escapeHtml(mfMoney(r.op, cur))}</td>
      <td class="ins-num ${Number(r.net) < 0 ? "ins-sell" : ""}">${escapeHtml(mfMoney(r.net, cur))}</td>
      <td class="ins-num">${escapeHtml(suppressed.has("fcf") ? mfFormat(mm.opMargin, "pct", cur) : mfMoney(mm.fcf, cur))}</td></tr>`;
  }).join("");
  const table = `<div class="insider-table-wrap"><table class="insider-table" style="table-layout:fixed;width:100%;min-width:0">
    <colgroup><col style="width:14%"><col style="width:23%"><col style="width:21%"><col style="width:21%"><col style="width:21%"></colgroup>
    <thead><tr><th>연도</th><th class="ins-num">매출</th><th class="ins-num">영업이익</th><th class="ins-num">순이익</th><th class="ins-num">${suppressed.has("fcf") ? "이익률" : "FCF"}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  const foot = `<div style="font-size:var(--fs-cap);color:var(--muted);margin-top:8px;line-height:1.65">${mfMetaLine(file)}. 과거 공시 수치이며 예측이 아닙니다. 종목 분석 화면의 재무 섹션에 분기·파생 지표가 있습니다.</div>`;
  return aiModePanel("재무", `${ttm.basis === "4Q" ? "TTM · " : ""}연간 추이 (${file.market === "kr" ? "DART" : "SEC"})`, grid + table + foot, "ai-fin-panel");
}

// 떠 있는 AI 패널 자리(data-fin-ai)를 새 데이터로 바꾼다. 데이터가 없으면 자리는 그대로(옛 패널 또는 빈 칸).
function hydrateFinancialsAiPanels(ticker) {
  loadFinancials(ticker).then((file) => {
    if (!file) return;
    const key = mfTickerKey(ticker);
    document.querySelectorAll("[data-fin-ai]").forEach((el) => {
      if (el.dataset.finAi !== key) return;
      const html = financialsAiPanelHtml(file);
      if (html) el.outerHTML = html;
    });
  });
}
