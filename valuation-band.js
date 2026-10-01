// valuation-band.js — 종목 분석 화면의 'PER·PBR 밴드' 카드
// =====================================================
// 주가 선 위에 과거 배수 분위(10/25/50/75/90%) × 그 달 주당 이익(EPS)·자산(BPS) 선을 겹치고,
// 현재 배수가 자기 과거 분포의 몇 % 위치인지 보여 준다. 계산은 valuation-band-core.js(순수).
//
// 데이터: KR 은 data/korea/valuation_band/meta.js(window.KR_VALUATION_BAND_META, lazy) +
// 종목을 열 때 샤드 JSON 하나(sNN.json)만 fetch. US 는 data/valuation_band/ 에 같은 모양으로
// (build_us_valuation_band.py, SEC 재무 + 야후 월말 종가 산출) PSR 배열("s")이 더 있다.
// 시장별 차이는 VALBAND_SOURCES 의 문구와 meta.excluded(계산하지 않은 종목의 사유)뿐이다.
//
// selectTicker(renderSearch) 가 부르고, 메타가 늦게 도착하면 refreshFeatureViews 가 다시 부른다.
// 정보 표시이지 매매 신호가 아니다 — 문구에 '평균 회귀를 보장하지 않음' 을 항상 적는다.

const VALBAND_SOURCES = {
  kr: {
    featureKey: "krValBand", global: "KR_VALUATION_BAND_META", dir: "data/korea/valuation_band",
    baseNote: { per: "KRX 공식 EPS 는 직전 사업연도 기준이라 계단식", pbr: "KRX 공식 BPS" },
    // KRX 공식 PER = 현재가 ÷ 직전 사업연도 EPS. 과거와 같은 잣대로 비교하려고 그대로 쓰되,
    // 투자정보의 대표 PER(최근 4분기)과 다른 이유를 화면에 적는다.
    statSuffix: { per: "사업연도 기준", pbr: "사업연도 기준" },
    statHint: { per: "밴드는 과거와 같은 잣대로 비교하려고 직전 사업연도 EPS 기준(KRX 공식)입니다. 투자정보의 PER 은 최근 4개 분기 기준이라 이익이 크게 바뀐 해에는 두 값이 많이 다릅니다." },
    priceNote: "주가는 KRX 월말 종가를 액면분할·병합만 수정했습니다(배당 미반영).",
  },
  us: {
    featureKey: "usValBand", global: "US_VALUATION_BAND_META", dir: "data/valuation_band",
    baseNote: {
      per: "EPS = 최근 4분기 지배주주 순이익 ÷ 희석 주식수, 각 월말에 이미 공시된 분기만",
      pbr: "BPS = 자본총계 ÷ 발행주식수, 분기 자료가 없는 구간은 연간 값",
      psr: "SPS = 최근 4분기 매출 ÷ 발행주식수, 금융업은 계산 안 함",
    },
    priceNote: "주가는 월말 종가(분할 조정, 배당 미반영)입니다. 분기 재무가 최근 12분기뿐이라 그 이전은 연간 실적 공시 직후 몇 달만 PER·PSR 이 있고, 나머지 달은 비워 둡니다(밴드가 끊겨 보이는 이유).",
    excludedText: {
      foreign: "해외발행인(20-F·40-F)이라 분기 실적이 없고 재무 통화·ADR 주식 기준이 달라 밴드를 계산하지 않습니다.",
      currency: "재무제표 통화가 달러가 아니라 밴드를 계산하지 않습니다.",
      shares: "현재 시가총액과 공시 주식수의 기준이 맞지 않아(복수 종류주·트래킹 주식 등) 밴드를 계산하지 않습니다.",
      nohist: "월말 종가 이력이 없어(신규 상장·스팩 등) 밴드를 계산하지 않습니다.",
      price: "주가 이력에 분할 미조정으로 의심되는 급변이 있어 밴드를 계산하지 않습니다.",
      few: "유효한 월말 배수가 24개월 미만이라 밴드를 그리지 않습니다.",
    },
  },
};
const VALBAND_METRICS = { per: { label: "PER", base: "이익(EPS)" }, pbr: { label: "PBR", base: "순자산(BPS)" }, psr: { label: "PSR", base: "매출(SPS)" } };
const _valBandShardCache = {};   // url → Promise<shard|null>

function valBandSource() {
  const cfg = marketCfg();
  if (cfg.features && cfg.features.valuationBand === false) return null;
  return VALBAND_SOURCES[cfg.id] || null;
}

function valBandFetchShard(src, meta, code) {
  const idx = MirValBandCore.shardOf(code, meta.shards || 32);
  const ver = encodeURIComponent(`${(meta.months || []).slice(-1)[0] || ""}-${meta.count || 0}`);
  const url = `${src.dir}/s${String(idx).padStart(2, "0")}.json?v=${ver}`;
  if (!_valBandShardCache[url]) {
    _valBandShardCache[url] = fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((j) => { if (!j) delete _valBandShardCache[url]; return j; });
  }
  return _valBandShardCache[url];
}

function renderValuationBand(item) {
  const host = byId("valuationBand");
  if (!host) return;
  const hide = () => { host.hidden = true; host.innerHTML = ""; };
  const src = valBandSource();
  const ticker = item && item.ticker;
  if (!src || !ticker || (typeof isKrEtfLike === "function" && isKrMarket() && isKrEtfLike(item))) return hide();
  const meta = window[src.global];
  if (!meta) {
    ensureFeatureData(src.featureKey).then((ok) => {
      if (ok && selectedTicker === ticker) renderValuationBand(item);
    });
    return;
  }
  const code = String(ticker);
  // 계산하지 않은 종목(US: 해외발행인·복수 종류주 등)은 샤드를 받지 않고 사유만 한 줄로 적는다.
  const why = meta.excluded && meta.excluded[code];
  if (why) {
    const text = (src.excludedText && src.excludedText[why]) || "이 종목은 밴드를 계산하지 않습니다.";
    host.hidden = false;
    host.innerHTML = `<h3>PER·PBR 밴드</h3><p class="muted">${escapeHtml(text)}</p>`;
    return;
  }
  valBandFetchShard(src, meta, code).then((shard) => {
    if (selectedTicker !== ticker) return;
    const s = MirValBandCore.seriesFromShard(shard, code);
    if (!s) return hide();
    host.hidden = false;
    renderValBandCard(host, { series: s, meta, item, src });
  });
}

// ---- 카드(시장 무관). opts: { series:{dates,close,per,pbr}, meta, item, src }
function renderValBandCard(host, opts) {
  const { series, meta, item, src } = opts;
  const core = MirValBandCore;
  const price = Number(item.price);
  const bandOpts = { currentPrice: price };
  const per = core.computeBands({ dates: series.dates, close: series.close, mult: series.per }, bandOpts);
  const pbr = core.computeBands({ dates: series.dates, close: series.close, mult: series.pbr }, bandOpts);
  // 금융업처럼 PSR 이 전부 비어 있으면 탭 자체를 만들지 않는다.
  const psr = series.psr && series.psr.some((v) => v > 0) ? core.computeBands({ dates: series.dates, close: series.close, mult: series.psr }, bandOpts) : null;
  const results = { per, pbr, psr };
  const title = psr ? "PER·PBR·PSR 밴드" : "PER·PBR 밴드";
  if (!per.ok && !pbr.ok && !(psr && psr.ok)) {
    host.innerHTML = `<h3>${title}</h3><p class="muted">월말 배수 자료가 24개월 미만이라 밴드를 그리지 않습니다(유효 PER ${per.validCount}개월 · PBR ${pbr.validCount}개월${psr ? ` · PSR ${psr.validCount}개월` : ""}).</p>`;
    return;
  }
  // PER·PBR·PSR 을 탭으로 하나씩 고르던 것을 카드로 나란히(넓은 칸 2열·폰 1열, chart-card.js).
  // 각 카드 SVG 폭은 그 카드 안쪽 폭 — 섹션 폭과 격자 열 수로 정한다.
  const hostW = valBandHostWidth(host);
  const geom = valBandGeomFor(typeof mirChartCardInnerWidth === "function" ? mirChartCardInnerWidth(hostW) : hostW);
  const metrics = ["per", "pbr", "psr"].filter((m) => results[m]);
  const cards = metrics.map((m) => {
    const res = results[m];
    const label = VALBAND_METRICS[m].label;
    const statSuffix = (src.statSuffix && src.statSuffix[m]) || "";
    const help = [(src.statHint && src.statHint[m]) || "", (src.baseNote && src.baseNote[m]) ? `기준: ${src.baseNote[m]}` : ""].filter(Boolean).join(" ");
    const notice = valBandNotice(m, per);
    const lead = `${notice ? `<p class="valband-notice">${notice}</p>` : ""}${res.ok ? valBandLead(res, statSuffix ? `${label}(${statSuffix})` : label) : ""}`;
    return mirChartCard({
      id: `vb.${m}`,
      title: `${label} 밴드`,
      sub: `${VALBAND_METRICS[m].base.replace(/\(.*\)/, "")} 대비 · 월말`,
      unitLeft: `(${marketCfg().id === "kr" ? "원" : "USD"})`,
      lead,
      chart: res.ok
        ? `<div data-vb-chart="${m}">${renderValBandChart(series, res, series[m], label, geom)}<p class="valband-readout muted" aria-live="polite"></p></div>`
        : `<p class="muted valband-empty">${label} 유효 자료가 ${res.validCount}개월뿐이라 밴드를 그리지 않습니다.</p>`,
      table: res.ok ? valBandTable(series, res, series[m], label) : "",
      legend: res.ok ? valBandLegendItems(res) : [],
      source: meta.lastDate ? `기준일 ${meta.lastDate}` : "",
      help,
    });
  });
  host.innerHTML = `
    <div class="valband-head">
      <h3>${title} <span class="muted valband-sub">과거 배수 분포 · 월말</span></h3>
    </div>
    ${mirChartGrid(cards)}
    ${valBandValidationLine(meta)}
    <p class="muted valband-foot">${escapeHtml(series.dates[0])}~${escapeHtml(series.dates[series.dates.length - 1])} · 기준일 ${escapeHtml(meta.lastDate || "")}</p>
    <details class="stock-method"><summary>계산 방법</summary>
      <p>밴드 = 그 달 주당 이익(EPS)·순자산(BPS)${psr ? "·매출(SPS)" : ""} × 과거 배수 분위(하위 10·25·50·75·90%). 현재 배수 = 현재가 ÷ 최근 월말 주당 값.</p>
      ${metrics.map((m) => (src.baseNote && src.baseNote[m]) ? `<p>${VALBAND_METRICS[m].label}: ${escapeHtml(src.baseNote[m])}</p>` : "").join("")}
      ${src.priceNote ? `<p>${escapeHtml(src.priceNote)}</p>` : ""}
    </details>`;
  metrics.forEach((m) => {
    const res = results[m];
    const box = host.querySelector(`[data-vb-chart="${m}"]`);
    if (res.ok && box) valBandBindHover(box, series, res, series[m], VALBAND_METRICS[m].label, geom);
  });
}

// 카드 머리 한 줄: 현재 배수 · 과거 분포 백분위(옛 6칸 통계의 '현재' 칸). 분위 배수는 범례로.
function valBandLead(res, label) {
  const cur = res.current;
  if (!cur) return `<p class="valband-lead"><span>현재 ${escapeHtml(label)}</span> <b>—</b> <em>최근 적자 · 계산 안 함</em></p>`;
  return `<p class="valband-lead"><span>현재 ${escapeHtml(label)}</span> <b>${valBandFmtMult(cur.mult)}배</b> <em>과거 분포 백분위 ${Math.round(cur.pct)}</em></p>`;
}

const VALBAND_LEVEL_NAMES = ["하위 10%", "하위 25%", "중앙값", "상위 25%", "상위 10%"];
const VALBAND_LEVEL_OPACITY = [0.45, 0.65, 0.9, 0.65, 0.45];
function valBandLegendItems(res) {
  const items = [{ label: "주가", color: "var(--text)", shape: "line" }];
  res.levels.forEach((lv, i) => items.push({ label: VALBAND_LEVEL_NAMES[i], value: `${valBandFmtMult(lv)}배`, color: "var(--accent)", shape: i === 0 || i === 4 ? "dash" : "line", opacity: VALBAND_LEVEL_OPACITY[i] }));
  return items;
}

// 같은 계열을 표로: 최근 12개월 + 현재(최근이 위).
function valBandTable(series, res, mult, label) {
  const cfg = marketCfg();
  const n = series.dates.length;
  const rows = [];
  if (res.current) rows.push(`<tr><th scope="row">현재</th><td class="ins-num">${escapeHtml(cfg.formatPrice(res.current.price))}</td><td class="ins-num">${valBandFmtMult(res.current.mult)}배</td><td class="ins-num">—</td></tr>`);
  for (let i = n - 1; i >= Math.max(0, n - 12); i--) {
    const m = mult[i];
    const c = series.close[i];
    const mid = res.bands[2][i];
    rows.push(`<tr><th scope="row">${escapeHtml(series.dates[i])}</th><td class="ins-num">${c ? escapeHtml(cfg.formatPrice(c)) : "—"}</td><td class="ins-num">${m === -1 ? "적자" : m > 0 ? `${valBandFmtMult(m)}배` : "—"}</td><td class="ins-num">${mid ? escapeHtml(cfg.formatPrice(mid)) : "—"}</td></tr>`);
  }
  return `<div class="table-wrap cc-table-wrap"><table class="insider-table cc-table">
    <thead><tr><th>월말</th><th class="ins-num">주가</th><th class="ins-num">${escapeHtml(label)}</th><th class="ins-num">중앙값 밴드</th></tr></thead>
    <tbody>${rows.join("")}</tbody></table></div><p class="muted cc-table-note">최근 12개월만 표시합니다.</p>`;
}

// 카드별 안내(카드가 나란히 있으므로 '기본으로 보여 줌' 이 아니라 '함께 보라' 로).
function valBandNotice(metric, per) {
  if (metric !== "per") return "";
  if (!per.ok) return `PER 유효 월이 ${per.validCount}개월뿐입니다(적자 ${per.lossMonths}개월). 순자산 기준인 PBR 밴드를 함께 보세요.`;
  if (per.lossMonths) return `적자였던 ${per.lossMonths}개월은 PER 이 없어 밴드를 끊어 표시했습니다(회색 음영).`;
  if (per.lastLoss) return "최근 결산이 적자라 현재 PER 위치를 계산하지 않습니다. PBR 밴드를 함께 보세요.";
  return "";
}

function valBandFmtMult(v) {
  if (!Number.isFinite(v)) return "—";
  return v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
}

function valBandAxisLabel(v) {
  const cfg = marketCfg();
  if (cfg.id === "kr") {
    if (v >= 1e8) return `${(v / 1e8).toFixed(1)}억`;
    if (v >= 1e4) return `${(v / 1e4).toFixed(v >= 1e5 ? 0 : 1)}만`;
    return Math.round(v).toLocaleString("ko-KR");
  }
  return v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(v >= 100 ? 0 : 1)}`;
}

// 폭은 카드 실제 폭(px)에 맞춰 그 자리에서 정한다 — viewBox 를 고정하면 넓은 화면에서 글자·선까지
// 두세 배로 커진다. 높이는 좁은 카드 220 / 그 외 260. 카드가 여러 장이라 기하는 카드마다 넘긴다.
let VALBAND_GEOM = { W: 640, H: 250, L: 46, R: 12, T: 10, B: 24 };
function valBandHostWidth(host) {
  if (!host || !host.clientWidth) return 640;
  const cs = getComputedStyle(host);
  return Math.round(host.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0));
}
function valBandGeomFor(w) {
  const W = Math.max(300, Math.min(Math.round(w) || 640, 1200));
  return { W, H: W < 480 ? 220 : 260, L: 46, R: 12, T: 10, B: 24 };
}

function valBandScales(series, res, g = VALBAND_GEOM) {
  const n = series.dates.length;
  const hasNow = !!res.current;
  const slots = n + (hasNow ? 1 : 0);
  let lo = Infinity;
  let hi = -Infinity;
  const take = (v) => { if (v != null && Number.isFinite(v) && v > 0) { lo = Math.min(lo, v); hi = Math.max(hi, v); } };
  series.close.forEach(take);
  res.bands.forEach((b) => b.forEach(take));
  if (hasNow) take(res.current.price);
  const pad = (hi - lo) * 0.06 || hi * 0.1;
  lo = Math.max(0, lo - pad);
  hi += pad;
  const xOf = (i) => g.L + (slots <= 1 ? 0 : (i / (slots - 1)) * (g.W - g.L - g.R));
  const yOf = (v) => g.T + (1 - (v - lo) / (hi - lo)) * (g.H - g.T - g.B);
  return { xOf, yOf, lo, hi, slots, hasNow };
}

// 시장 무관 SVG. series.close 는 수정종가, res 는 computeBands 결과, mult 는 적자(-1) 표시용.
function renderValBandChart(series, res, mult, label, g = VALBAND_GEOM) {
  const core = MirValBandCore;
  const { xOf, yOf, lo, hi, hasNow } = valBandScales(series, res, g);
  const n = series.dates.length;
  // 적자 구간 음영
  const loss = core.lossRanges(mult).map(([a, b]) => {
    const x0 = xOf(Math.max(0, a - 0.5));
    const x1 = xOf(Math.min(n - 1, b + 0.5));
    return `<rect class="valband-loss" x="${x0.toFixed(1)}" y="${g.T}" width="${Math.max(1, x1 - x0).toFixed(1)}" height="${g.H - g.T - g.B}"/>`;
  }).join("");
  // 밴드 사이 채움(바깥 → 안쪽 순으로 옅게 → 짙게) + 경계선
  const b = res.bands;
  const fills = [[0, 1], [1, 2], [2, 3], [3, 4]].map(([a, c], k) =>
    `<path class="valband-fill valband-fill-${k}" d="${core.areaPath(b[a], b[c], xOf, yOf)}"/>`).join("");
  const lines = b.map((arr, i) => `<path class="valband-line valband-line-${i}" d="${core.linePath(arr, xOf, yOf)}"/>`).join("");
  const price = `<path class="valband-price" d="${core.linePath(series.close, xOf, yOf)}"/>`;
  let now = "";
  if (hasNow) {
    const lastIdx = series.close.map((v, i) => (v ? i : -1)).filter((i) => i >= 0).pop();
    const x0 = xOf(lastIdx);
    const x1 = xOf(n);
    const y0 = yOf(series.close[lastIdx]);
    const y1 = yOf(res.current.price);
    now = `<path class="valband-price valband-price-now" d="M${x0.toFixed(1)},${y0.toFixed(1)}L${x1.toFixed(1)},${y1.toFixed(1)}"/><circle class="valband-dot" cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="3.5"/>`;
  }
  // 축: y 4칸, x 는 1월마다(간격이 좁으면 격년)
  // 눈금은 1·2·2.5·5 × 10^k 배수(가격 차트와 같은 MirYScale.linearTicks). 없으면 예전 4칸 등분.
  const ys = window.MirYScale;
  const tk = ys && typeof ys.linearTicks === "function" ? ys.linearTicks(lo, hi, g.H < 240 ? 4 : 5) : null;
  const ticks = tk && tk.ticks.length >= 2 ? tk.ticks : [0, 1, 2, 3, 4].map((k) => lo + ((hi - lo) * k) / 4);
  const tickLabel = tk && tk.ticks.length >= 2 ? (v) => core.axisTickLabel(v, tk.step, marketCfg().id) : valBandAxisLabel;
  const yAxis = ticks.map((v) => `<line class="valband-grid" x1="${g.L}" x2="${g.W - g.R}" y1="${yOf(v).toFixed(1)}" y2="${yOf(v).toFixed(1)}"/><text class="valband-tick" x="${g.L - 6}" y="${(yOf(v) + 3.5).toFixed(1)}" text-anchor="end">${escapeHtml(tickLabel(v))}</text>`).join("");
  const years = series.dates.map((d, i) => [d, i]).filter(([d]) => d.endsWith("-01"));
  const step = years.length > 7 ? 2 : 1;
  const xAxis = years.filter((_, k) => k % step === 0).map(([d, i]) => `<text class="valband-tick" x="${xOf(i).toFixed(1)}" y="${g.H - 6}" text-anchor="middle">${d.slice(0, 4)}</text>`).join("")
    + (hasNow ? `<text class="valband-tick" x="${xOf(n).toFixed(1)}" y="${g.H - 6}" text-anchor="end">현재</text>` : "");
  return `<div class="valband-chart"><svg viewBox="0 0 ${g.W} ${g.H}" role="img" aria-label="${escapeHtml(label)} 밴드 차트: 주가와 과거 ${escapeHtml(label)} 분위 선">
    ${yAxis}${loss}${fills}${lines}${price}${now}${xAxis}
    <line class="valband-guide" x1="0" x2="0" y1="${g.T}" y2="${g.H - g.B}" visibility="hidden"/>
    <rect class="valband-hit" x="${g.L}" y="${g.T}" width="${g.W - g.L - g.R}" height="${g.H - g.T - g.B}"/>
  </svg></div>`;
}

function valBandBindHover(host, series, res, mult, label, g = VALBAND_GEOM) {
  const svg = host.querySelector(".valband-chart svg");
  const hit = host.querySelector(".valband-hit");
  const guide = host.querySelector(".valband-guide");
  const out = host.querySelector(".valband-readout");
  if (!svg || !hit || !out || !res.ok) return;
  const { xOf, slots } = valBandScales(series, res, g);
  const cfg = marketCfg();
  const n = series.dates.length;
  const show = (ev) => {
    const r = svg.getBoundingClientRect();
    if (!r.width) return;
    const x = ((ev.clientX - r.left) / r.width) * g.W;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < slots; i++) { const d = Math.abs(xOf(i) - x); if (d < bestD) { bestD = d; best = i; } }
    guide.setAttribute("x1", xOf(best).toFixed(1));
    guide.setAttribute("x2", xOf(best).toFixed(1));
    guide.setAttribute("visibility", "visible");
    if (best >= n && res.current) {
      out.textContent = `현재 · 주가 ${cfg.formatPrice(res.current.price)} · ${label} ${valBandFmtMult(res.current.mult)}배 (과거 분포 백분위 ${Math.round(res.current.pct)})`;
      return;
    }
    const m = mult[best];
    const c = series.close[best];
    const multTxt = m === -1 ? "적자" : m > 0 ? `${valBandFmtMult(m)}배` : "자료 없음";
    const mid = res.bands[2][best];
    out.textContent = `${series.dates[best]} · 주가 ${c ? cfg.formatPrice(c) : "—"} · ${label} ${multTxt}${mid ? ` · 중앙값 밴드 ${cfg.formatPrice(mid)}` : ""}`;
  };
  hit.addEventListener("pointermove", show);
  hit.addEventListener("pointerdown", show);
  hit.addEventListener("pointerleave", () => { guide.setAttribute("visibility", "hidden"); });
}

// 검증 결과 한 줄(메타의 validation). 없으면 '검증 안 함' 을 그대로 적는다.
function valBandValidationLine(meta) {
  const v = meta && meta.validation;
  const h = v && v.horizons && v.horizons["12m"];
  if (!h || h.insufficient) return `<p class="valband-verdict muted">과거 검증: 표본이 모자라 수행하지 않았습니다.</p>`;
  const h3 = v.horizons["3m"];
  const sign = (x) => `${x > 0 ? "+" : ""}${x.toFixed(1)}`;
  const tone = h.verdict === "우위" ? "pos" : h.verdict === "열위" ? "neg" : "";
  const three = h3 && !h3.insufficient ? ` · 3개월 ${sign(h3.meanExcessPct)}%p(${escapeHtml(h3.verdict)})` : "";
  // US 는 벤치마크(SPY) 대비 + 같은 달 전체 종목 중앙값 대비(국내와 같은 정의)를 함께 적는다.
  const vsWhat = v.benchLabel ? `${escapeHtml(v.benchLabel)} 수익률` : "같은 달 전체";
  const beatWhat = v.benchLabel ? escapeHtml(v.bench || "벤치마크") : "전체";
  const u = h.vsUniverse;
  const uni = u ? ` <span class="muted">같은 달 전체 종목 중앙값 대비로는 ${sign(u.meanExcessPct)}%p(${sign(u.ciLowPct)}~${sign(u.ciHighPct)}, ${escapeHtml(u.verdict)}).</span>` : "";
  const caveat = v.caveat || "상장폐지 후 수익률이 빠져 생존편향이 남아 있고, 예측이 아닙니다.";
  return `<p class="valband-verdict">과거 검증 <span class="muted">(${escapeHtml(v.rule)}, ${escapeHtml(h.from)}~${escapeHtml(h.to)} · ${h.months}개월 · 표본 ${Number(h.signalObs).toLocaleString("ko-KR")}건)</span>: 이후 12개월 수익률 중앙값이 ${vsWhat}보다 평균 <b class="${tone}">${sign(h.meanExcessPct)}%p</b> <span class="muted">(97.5% 구간 ${sign(h.ciLowPct)}~${sign(h.ciHighPct)}, ${beatWhat}를 이긴 달 ${h.hitRatePct}%)</span> — <b>${escapeHtml(h.verdict)}</b>${three}.${uni} <span class="muted">${escapeHtml(caveat)}</span></p>`;
}
