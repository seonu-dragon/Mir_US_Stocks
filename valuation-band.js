// valuation-band.js — 종목 분석 화면의 'PER·PBR 밴드' 카드
// =====================================================
// 주가 선 위에 과거 배수 분위(10/25/50/75/90%) × 그 달 주당 이익(EPS)·자산(BPS) 선을 겹치고,
// 현재 배수가 자기 과거 분포의 몇 % 위치인지 보여 준다. 계산은 valuation-band-core.js(순수).
//
// 데이터: KR 은 data/korea/valuation_band/meta.js(window.KR_VALUATION_BAND_META, lazy) +
// 종목을 열 때 샤드 JSON 하나(sNN.json)만 fetch. US 는 아직 없다 — 재무 확장 후 VALBAND_SOURCES
// 에 us 항목(같은 샤드 모양)을 넣으면 renderValBandChart 이하가 그대로 쓰인다.
//
// selectTicker(renderSearch) 가 부르고, 메타가 늦게 도착하면 refreshFeatureViews 가 다시 부른다.
// 정보 표시이지 매매 신호가 아니다 — 문구에 '평균 회귀를 보장하지 않음' 을 항상 적는다.

const VALBAND_SOURCES = {
  kr: { featureKey: "krValBand", global: "KR_VALUATION_BAND_META", dir: "data/korea/valuation_band", sourceLabel: "KRX 공식 PER·PBR" },
};
const _valBandShardCache = {};   // url → Promise<shard|null>
const _valBandMetricPref = {};   // ticker → "per" | "pbr" (사용자가 고른 탭)

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
  const per = core.computeBands({ dates: series.dates, close: series.close, mult: series.per }, { currentPrice: price });
  const pbr = core.computeBands({ dates: series.dates, close: series.close, mult: series.pbr }, { currentPrice: price });
  if (!per.ok && !pbr.ok) {
    host.innerHTML = `<h3>PER·PBR 밴드</h3><p class="muted">월말 배수 자료가 24개월 미만이라 밴드를 그리지 않습니다(유효 PER ${per.validCount}개월 · PBR ${pbr.validCount}개월).</p>`;
    return;
  }
  const ticker = item.ticker;
  let metric = _valBandMetricPref[ticker] || core.defaultMetric(per, pbr);
  if (metric === "per" && !per.ok) metric = "pbr";
  if (metric === "pbr" && !pbr.ok) metric = "per";

  const draw = () => {
    valBandSetGeom(host);
    const res = metric === "per" ? per : pbr;
    const label = metric === "per" ? "PER" : "PBR";
    const mult = metric === "per" ? series.per : series.pbr;
    const btn = (m, text, ok) => `<button type="button" data-vb-metric="${m}" class="${metric === m ? "is-active" : ""}" aria-pressed="${metric === m}"${ok ? "" : " disabled"}>${text}</button>`;
    const notice = valBandNotice(metric, per, pbr);
    host.innerHTML = `
      <div class="valband-head">
        <h3>PER·PBR 밴드 <span class="muted valband-sub">과거 ${res.ok ? res.validCount : 0}개월 배수 분포 · 월말</span></h3>
        <div class="segmented valband-seg" role="group" aria-label="밴드 기준">${btn("per", "PER 밴드", per.ok)}${btn("pbr", "PBR 밴드", pbr.ok)}</div>
      </div>
      ${notice ? `<p class="valband-notice">${notice}</p>` : ""}
      ${res.ok ? valBandStats(res, label) : ""}
      ${res.ok ? renderValBandChart(series, res, mult, label) : `<p class="muted">${label} 유효 자료가 부족합니다.</p>`}
      <p class="valband-readout muted" aria-live="polite"></p>
      ${valBandValidationLine(meta)}
      <p class="muted valband-foot">밴드 = 그 달 주당 ${metric === "per" ? "이익(EPS)" : "순자산(BPS)"} × 과거 ${label} 분위(하위 10·25·50·75·90%). 현재 배수 = 현재가 ÷ 최근 월말 주당 값(KRX 공식 ${metric === "per" ? "EPS 는 직전 사업연도 기준이라 계단식" : "BPS"}). <b>과거 범위 안의 위치일 뿐이며 평균 회귀를 보장하지 않습니다.</b> 이익이 구조적으로 바뀐 회사는 과거 배수가 기준이 되지 못합니다. 매매 신호가 아닌 정보입니다. 주가는 KRX 월말 종가를 액면분할·병합만 수정했습니다(배당 미반영). 출처 ${escapeHtml(src.sourceLabel)} · ${escapeHtml(series.dates[0])}~${escapeHtml(series.dates[series.dates.length - 1])} · 기준일 ${escapeHtml(meta.lastDate || "")} · 갱신 ${escapeHtml(meta.updatedAtKst || "")}.</p>`;
    host.querySelectorAll("[data-vb-metric]").forEach((b) => b.addEventListener("click", () => {
      if (b.disabled) return;
      metric = b.dataset.vbMetric;
      _valBandMetricPref[ticker] = metric;
      draw();
    }));
    valBandBindHover(host, series, res, mult, label);
  };
  draw();
}

function valBandNotice(metric, per, pbr) {
  if (metric === "pbr" && per.ok && per.lastLoss) return "최근 결산이 적자라 PER 이 정의되지 않습니다 — 순자산 기준인 PBR 밴드를 기본으로 보여 줍니다.";
  if (metric === "pbr" && !per.ok) return `PER 유효 월이 ${per.validCount}개월뿐이라(적자 ${per.lossMonths}개월) PBR 밴드를 기본으로 보여 줍니다.`;
  if (metric === "per" && per.lossMonths) return `적자였던 ${per.lossMonths}개월은 PER 이 없어 밴드를 끊어 표시했습니다(붉은 음영).`;
  if (metric === "per" && per.lastLoss) return "최근 결산이 적자라 현재 PER 위치를 계산하지 않습니다. PBR 밴드를 함께 보세요.";
  return "";
}

function valBandFmtMult(v) {
  if (!Number.isFinite(v)) return "—";
  return v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
}

function valBandStats(res, label) {
  const cur = res.current;
  const cells = [];
  if (cur) {
    const pct = Math.round(cur.pct);
    cells.push(`<div class="valband-stat valband-stat-main"><span>현재 ${label}</span><b>${valBandFmtMult(cur.mult)}배</b><em>과거 분포 백분위 ${pct}</em></div>`);
  } else {
    cells.push(`<div class="valband-stat valband-stat-main"><span>현재 ${label}</span><b>—</b><em>최근 적자 · 계산 안 함</em></div>`);
  }
  const names = ["하위 10%", "하위 25%", "중앙값", "상위 25%", "상위 10%"];
  res.levels.forEach((lv, i) => cells.push(`<div class="valband-stat"><span><i class="valband-sw valband-sw-${i}"></i>${names[i]}</span><b>${valBandFmtMult(lv)}배</b></div>`));
  return `<div class="valband-stats">${cells.join("")}</div>`;
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
// 두세 배로 커진다. 높이는 폰 220 / 그 외 260.
let VALBAND_GEOM = { W: 640, H: 250, L: 46, R: 12, T: 10, B: 24 };
function valBandSetGeom(host) {
  let w = 640;
  if (host && host.clientWidth) {
    const cs = getComputedStyle(host);
    w = host.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  }
  w = Math.round(w);
  const W = Math.max(300, Math.min(w, 1200));
  VALBAND_GEOM = { W, H: W < 480 ? 220 : 260, L: 46, R: 12, T: 10, B: 24 };
}

function valBandScales(series, res) {
  const g = VALBAND_GEOM;
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
function renderValBandChart(series, res, mult, label) {
  const core = MirValBandCore;
  const g = VALBAND_GEOM;
  const { xOf, yOf, lo, hi, hasNow } = valBandScales(series, res);
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
  const ticks = [0, 1, 2, 3, 4].map((k) => lo + ((hi - lo) * k) / 4);
  const yAxis = ticks.map((v) => `<line class="valband-grid" x1="${g.L}" x2="${g.W - g.R}" y1="${yOf(v).toFixed(1)}" y2="${yOf(v).toFixed(1)}"/><text class="valband-tick" x="${g.L - 6}" y="${(yOf(v) + 3.5).toFixed(1)}" text-anchor="end">${escapeHtml(valBandAxisLabel(v))}</text>`).join("");
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

function valBandBindHover(host, series, res, mult, label) {
  const svg = host.querySelector(".valband-chart svg");
  const hit = host.querySelector(".valband-hit");
  const guide = host.querySelector(".valband-guide");
  const out = host.querySelector(".valband-readout");
  if (!svg || !hit || !out || !res.ok) return;
  const { xOf, slots } = valBandScales(series, res);
  const cfg = marketCfg();
  const n = series.dates.length;
  const show = (ev) => {
    const r = svg.getBoundingClientRect();
    if (!r.width) return;
    const x = ((ev.clientX - r.left) / r.width) * VALBAND_GEOM.W;
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
  return `<p class="valband-verdict">과거 검증 <span class="muted">(${escapeHtml(v.rule)}, ${escapeHtml(h.from)}~${escapeHtml(h.to)} · ${h.months}개월 · 표본 ${Number(h.signalObs).toLocaleString("ko-KR")}건)</span>: 이후 12개월 수익률 중앙값이 같은 달 전체보다 평균 <b class="${tone}">${sign(h.meanExcessPct)}%p</b> <span class="muted">(97.5% 구간 ${sign(h.ciLowPct)}~${sign(h.ciHighPct)}, 전체를 이긴 달 ${h.hitRatePct}%)</span> — <b>${escapeHtml(h.verdict)}</b>${three}. <span class="muted">상장폐지 후 수익률이 빠져 생존편향이 남아 있고, 예측이 아닙니다.</span></p>`;
}
