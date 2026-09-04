#!/usr/bin/env node
// build_factor_validation.mjs — 상승확률 스캐너 순위 기준의 과거 5년 워크포워드 검증
// ==========================================================================
// 입력: data/details/*.json (US), data/korea/details/*.json (KR) 의 chartSeries
//       [o, h, l, c, v, date] — 실측 이력(historySource yahoo/yahoo-cache)만, 400봉 미만 제외.
//       data/market_snapshot.json · data/korea/market_snapshot.json 은 ETF 제외 판정에만 쓴다.
// 출력: data/factor_validation.json + data/factor_validation.js (window.FACTOR_VALIDATION)
//
// 왜 있나: 2026-09-04 실측에서 스캐너의 "상승확률"(scanQuickProb) 순위 상위 24개의 실제
// 상승률이 전체 기저율보다 낮았다(US 20d 52.4% vs 53.1%). 순위 기준으로 쓰려는 팩터는
// 여기서 **미래 정보 없이** 5/20/60 거래일 뒤 실제 수익률로 검증하고, 통과한 것만
// 스캐너의 "순위 기준" 셀렉트에 올라간다(app.js renderScanner). 통과 기준:
//   1) 날짜별 상위 24개의 풀링 상승률 Wilson 95% 하한이 전체 기저율보다 높다
//      (겹치는 창 보정: n_eff = n / (horizon / stride)).
//   2) 연도별 (상위24 상승률 − 기저율)의 부호가 풀링 부호와 5년 중 4년 이상 같다.
// 외부 의존성 없음. 실행: node scripts/build_factor_validation.mjs [--sample 400] [--stride 5]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const argVal = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] != null ? args[i + 1] : dflt;
};
const SAMPLE = Number(argVal("--sample", 400));
const STRIDE = Number(argVal("--stride", 5));
const HORIZONS = [5, 20, 60];
const MIN_BARS = 400;
const WARMUP = 260;          // mom_12_1 이 252봉을 쓰므로 그 뒤부터 평가
const TOP_N = 24;            // 스캐너 기본 표시 개수
const MIN_TICKERS_PER_DATE = 48;
const SEED = 20260904;
const REAL_SOURCES = new Set(["yahoo", "yahoo-cache"]);

const MARKETS = [
  { id: "us", details: "data/details", snapshot: "data/market_snapshot.json" },
  { id: "kr", details: "data/korea/details", snapshot: "data/korea/market_snapshot.json" },
];

// 팩터 카탈로그. 값은 "클수록 순위 상위" 방향으로 부호를 맞춘다.
// runtime: app.js 가 스냅샷(라이트) 필드만으로 같은 값을 계산할 수 있는지.
const FACTORS = {
  quick_score: { label: "모멘텀 점수", short: "모멘텀", unit: "score", runtime: true,
    desc: "스캐너 기존 공식(scanQuickProb): 3개월·1개월·1주 수익률, RSI, 거래량, 신고가 근접, 이평 구조" },
  rev_1m:      { label: "1개월 반전", short: "1개월", unit: "pct", sign: -1, field: "monthChangePct", runtime: true,
    desc: "최근 21거래일 수익률이 낮을수록 상위(단기 반전)" },
  mom_3m:      { label: "3개월 모멘텀", short: "3개월", unit: "pct", sign: 1, field: "threeMonthChangePct", runtime: true,
    desc: "최근 63거래일 수익률이 높을수록 상위" },
  mom_12_1:    { label: "12-1개월 모멘텀", short: "12-1개월", unit: "pct", sign: 1, runtime: false,
    desc: "252거래일 수익률(최근 21거래일 제외)이 높을수록 상위 — 라이트 스냅샷엔 없는 값" },
  vol_shock:   { label: "거래량 급증", short: "거래량", unit: "x", sign: 1, field: "volumeRatio", runtime: true,
    desc: "당일 거래량 / 직전 20거래일 평균이 클수록 상위" },
  high52_prox: { label: "52주 신고가 근접", short: "신고가 거리", unit: "pct", sign: -1, field: "newHighDistancePct", runtime: true,
    desc: "252거래일 고점 대비 하락폭이 작을수록 상위" },
  low_vol:     { label: "저변동성", short: "20일 변동성", unit: "pct", sign: -1, runtime: true,
    desc: "최근 20거래일 일간수익률 표준편차가 낮을수록 상위(closeSeries 40봉으로 계산)" },
  rsi14_low:   { label: "RSI 과매도", short: "RSI", unit: "score", sign: -1, field: "rsi14", runtime: true,
    desc: "Wilder RSI(14) 가 낮을수록 상위" },
};

// ---------------------------------------------------------------- 유틸
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededShuffle(arr, seed) {
  const rnd = mulberry32(seed);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const round = (v, d) => { const m = 10 ** d; return Math.round(v * m) / m; };
const mean = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Wilson 95% 구간. nEff 로 겹치는 창을 보정한다.
function wilson(k, n, nEff) {
  if (!n || !nEff) return { lo: null, hi: null };
  const p = k / n;
  const z = 1.959964;
  const z2 = z * z;
  const denom = 1 + z2 / nEff;
  const centre = p + z2 / (2 * nEff);
  const half = z * Math.sqrt((p * (1 - p)) / nEff + z2 / (4 * nEff * nEff));
  return { lo: (centre - half) / denom, hi: (centre + half) / denom };
}

function ranks(values) {
  const idx = values.map((v, i) => i).sort((a, b) => values[a] - values[b]);
  const r = new Array(values.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && values[idx[j + 1]] === values[idx[i]]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k]] = avg;
    i = j + 1;
  }
  return r;
}
function spearman(x, y) {
  const n = x.length;
  if (n < 3) return null;
  const rx = ranks(x), ry = ranks(y);
  const mx = mean(rx), my = mean(ry);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = rx[i] - mx, b = ry[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : null;
}

// ---------------------------------------------------------------- update_data.py 포팅
// pct / lookback / clamp / wilder_rsi 는 scripts/update_data.py 와 1:1.
function pyPct(now, then) { return then ? round((now / then - 1) * 100, 1) : 0; }
function pyLookback(values, periods) {
  if (!values.length) return 0;
  return values.length > periods ? values[values.length - periods] : values[0];
}
function wilderRsi(closes, period = 14) {
  if (closes.length <= period) return null;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gain += d; else loss -= d;
  }
  let avgGain = gain / period, avgLoss = loss / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
  }
  // update_data.py wilder_rsi: 상승·하락 모두 0 인 완전 횡보는 50, 하락만 0 이면 100
  if (!avgLoss) return avgGain ? 100 : 50;
  return round(100 - 100 / (1 + avgGain / avgLoss), 2);
}

// make_stock 이 시점 i 에서 만들었을 라이트 스냅샷 필드(미래 정보 없음).
// high/low 는 2026-09-04 수정 후 규약(최근 252봉 + 현재가)을 따른다.
function snapshotAt(c, v, i) {
  const start = Math.max(0, i - 1259);
  const w = c.slice(start, i + 1);
  const price = c[i];
  const w52 = w.slice(-252);
  const high52 = Math.max(Math.max(...w52), price);
  const volWin = v.slice(Math.max(0, i - 20), i);
  const volAvg = volWin.length ? mean(volWin) : 0;
  const volumeRatio = volAvg ? round(Math.max(0.1, v[i] / volAvg), 1) : 1.0;
  const rsiCloses = w.map((x) => round(x, 2));
  rsiCloses[rsiCloses.length - 1] = round(price, 2);
  const closeSeries = w.slice(-40, -1).map((x) => round(x, 2)).concat([round(price, 2)]);
  return {
    price,
    weekChangePct: pyPct(price, pyLookback(w, 6)),
    monthChangePct: pyPct(price, pyLookback(w, 22)),
    threeMonthChangePct: pyPct(price, pyLookback(w, 64)),
    rsi14: wilderRsi(rsiCloses, 14),
    volumeRatio,
    newHighDistancePct: round((1 - price / high52) * 100, 1),
    closeSeries,
  };
}

// ---------------------------------------------------------------- app.js scanQuickProb 포팅
// (2026-09-04 이후 버전: stochK 항 제거 — 신고가 거리와 같은 고점에서 나온 값이라 중복)
const scanClamp = clamp;
function scanRsiBias(rsi) {
  if (!Number.isFinite(rsi)) return 0;
  if (rsi >= 70) return 0.25;
  if (rsi >= 55) return 0.7;
  if (rsi >= 50) return 0.35;
  if (rsi >= 40) return -0.3;
  if (rsi >= 30) return -0.55;
  return 0.15;
}
function scanSeriesBias(series) {
  const vals = (Array.isArray(series) ? series : []).map(Number).filter(Number.isFinite);
  if (vals.length < 20) return 0;
  const last = vals[vals.length - 1];
  const smaShort = mean(vals.slice(-5));
  const smaLong = mean(vals.slice(-20));
  let b = 0;
  b += smaShort > smaLong ? 0.5 : -0.5;
  b += last > smaShort ? 0.25 : -0.25;
  const ref = vals[vals.length - 10] || last || 1;
  const slope = (last - ref) / Math.abs(ref || 1);
  b += scanClamp(slope * 5, -0.5, 0.5);
  return scanClamp(b, -1, 1);
}
function scanQuickProb(item, horizon) {
  const shortW = horizon <= 5 ? 1.4 : horizon >= 60 ? 0.5 : 0.9;
  const longW = horizon >= 60 ? 1.5 : horizon <= 5 ? 0.7 : 1.1;
  const signals = [];
  const push = (bias, weight) => { if (Number.isFinite(bias)) signals.push([bias, weight]); };
  if (Number.isFinite(item.threeMonthChangePct)) push(Math.tanh(item.threeMonthChangePct / 15), 1.4 * longW);
  if (Number.isFinite(item.monthChangePct)) push(Math.tanh(item.monthChangePct / 8), 0.9);
  if (Number.isFinite(item.weekChangePct)) push(Math.tanh(item.weekChangePct / 4), 0.6 * shortW);
  push(scanRsiBias(Number.isFinite(item.rsi14) ? item.rsi14 : NaN), 1.0 * shortW);
  const trendSign = Math.sign(Number(item.monthChangePct) || Number(item.weekChangePct) || 0);
  if (Number.isFinite(item.volumeRatio) && trendSign !== 0) {
    push(trendSign * scanClamp((item.volumeRatio - 1) / 1.5, -0.5, 1), 0.5);
  }
  const dist = Number(item.newHighDistancePct);
  if (Number.isFinite(dist)) push(scanClamp((10 - dist) / 10, -0.3, 1), 0.5);
  push(scanSeriesBias(item.closeSeries), 0.8);
  const totW = signals.reduce((s, [, w]) => s + w, 0) || 1;
  const z = signals.reduce((s, [b, w]) => s + b * w, 0) / totW;
  return scanClamp(50 + 38 * z, 12, 88);
}

// 스냅샷 필드에서 팩터 값. app.js scanFactorValue 와 같은 정의를 유지할 것.
function stdevPct(series) {
  const s = series.slice(-21);
  if (s.length < 21) return null;
  const rets = [];
  for (let i = 1; i < s.length; i++) if (s[i - 1]) rets.push(s[i] / s[i - 1] - 1);
  const m = mean(rets);
  return Math.sqrt(mean(rets.map((r) => (r - m) ** 2))) * 100;
}
function factorValues(snap, c, i, horizon) {
  const out = {};
  out.quick_score = scanQuickProb(snap, horizon);
  out.rev_1m = -snap.monthChangePct;
  out.mom_3m = snap.threeMonthChangePct;
  out.mom_12_1 = i >= 252 && c[i - 252] ? (c[i - 21] / c[i - 252] - 1) * 100 : null;
  out.vol_shock = snap.volumeRatio;
  out.high52_prox = -snap.newHighDistancePct;
  const sd = stdevPct(snap.closeSeries);
  out.low_vol = sd == null ? null : -sd;
  out.rsi14_low = snap.rsi14 == null ? null : -snap.rsi14;
  return out;
}

// ---------------------------------------------------------------- 로딩
function loadEtfSet(snapshotRel) {
  const p = path.join(ROOT, snapshotRel);
  const set = new Set();
  if (!fs.existsSync(p)) return set;
  try {
    const snap = JSON.parse(fs.readFileSync(p, "utf8"));
    for (const s of snap.stocks || []) {
      if (s.sector === "EXCHANGE TRADED FUNDS" || s.sector === "ETF" || s.market === "etf" || s.industry === "ETF") set.add(s.ticker);
    }
  } catch (e) {
    console.warn(`[warn] ${snapshotRel}: ${e.message}`);
  }
  return set;
}

function loadSample(market) {
  const dir = path.join(ROOT, market.details);
  const etf = loadEtfSet(market.snapshot);
  const files = seededShuffle(fs.readdirSync(dir).filter((f) => f.endsWith(".json")), SEED);
  const tickers = [];
  let scanned = 0, skippedBars = 0, skippedSource = 0, skippedEtf = 0;
  for (const f of files) {
    if (tickers.length >= SAMPLE) break;
    scanned++;
    const ticker = f.replace(/\.json$/, "");
    if (etf.has(ticker)) { skippedEtf++; continue; }
    let d;
    try { d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch (e) { continue; }
    if (!REAL_SOURCES.has(d.historySource)) { skippedSource++; continue; }
    const rows = Array.isArray(d.chartSeries) ? d.chartSeries : [];
    if (rows.length < MIN_BARS) { skippedBars++; continue; }
    const c = [], v = [], dates = [];
    let bad = false;
    for (const r of rows) {
      const close = Number(r[3]);
      if (!Number.isFinite(close) || close <= 0) { bad = true; break; }
      c.push(close); v.push(Number(r[4]) || 0); dates.push(String(r[5]));
    }
    if (bad) continue;
    tickers.push({ ticker, c, v, dates, idx: new Map(dates.map((dt, k) => [dt, k])) });
  }
  return { tickers, scanned, skippedBars, skippedSource, skippedEtf, filesTotal: files.length };
}

// ---------------------------------------------------------------- 평가
function evaluateMarket(market) {
  const t0 = Date.now();
  const sample = loadSample(market);
  const { tickers } = sample;
  const dateSet = new Set();
  for (const t of tickers) for (const d of t.dates) dateSet.add(d);
  const allDates = [...dateSet].sort();
  const evalDates = allDates.filter((_, k) => k % STRIDE === 0);

  // 날짜별 관측: { date, year, rows: [{ticker, factors:{h:{...}}, fwd:{h:ret}}] }
  const perDate = [];
  for (const date of evalDates) {
    const rows = [];
    for (const t of tickers) {
      const i = t.idx.get(date);
      if (i == null || i < WARMUP) continue;
      const fwd = {};
      let any = false;
      for (const h of HORIZONS) {
        if (i + h < t.c.length) { fwd[h] = t.c[i + h] / t.c[i] - 1; any = true; }
      }
      if (!any) continue;
      const snap = snapshotAt(t.c, t.v, i);
      const factors = {};
      for (const h of HORIZONS) if (fwd[h] != null) factors[h] = factorValues(snap, t.c, i, h);
      rows.push({ ticker: t.ticker, fwd, factors });
    }
    if (rows.length >= MIN_TICKERS_PER_DATE) perDate.push({ date, year: date.slice(0, 4), rows });
  }

  const horizons = {};
  for (const h of HORIZONS) {
    const dates = perDate.filter((d) => d.rows.some((r) => r.fwd[h] != null));
    // 기저율(전체)
    let baseN = 0, baseUp = 0, baseSum = 0;
    const baseYears = {};
    for (const d of dates) {
      for (const r of d.rows) {
        if (r.fwd[h] == null) continue;
        baseN++; baseSum += r.fwd[h]; if (r.fwd[h] > 0) baseUp++;
        const y = baseYears[d.year] || (baseYears[d.year] = { n: 0, up: 0, sum: 0 });
        y.n++; y.sum += r.fwd[h]; if (r.fwd[h] > 0) y.up++;
      }
    }
    const overlap = Math.max(1, h / STRIDE);
    const base = {
      n: baseN, nEff: Math.round(baseN / overlap), upRate: baseN ? baseUp / baseN : null,
      meanRetPct: baseN ? (baseSum / baseN) * 100 : null,
      years: Object.fromEntries(Object.entries(baseYears).map(([y, s]) => [y, { n: s.n, upRate: s.up / s.n, meanRetPct: (s.sum / s.n) * 100 }])),
    };
    const factors = {};
    for (const key of Object.keys(FACTORS)) {
      const pooledX = [], pooledY = [];
      const top = { n: 0, up: 0, sum: 0 };
      const dec = { n: 0, up: 0, sum: 0 };
      const years = {};
      let datesUsed = 0;
      for (const d of dates) {
        const rows = d.rows.filter((r) => r.fwd[h] != null && r.factors[h] && Number.isFinite(r.factors[h][key]));
        if (rows.length < MIN_TICKERS_PER_DATE) continue;
        datesUsed++;
        for (const r of rows) { pooledX.push(r.factors[h][key]); pooledY.push(r.fwd[h]); }
        rows.sort((a, b) => b.factors[h][key] - a.factors[h][key]);
        const yr = years[d.year] || (years[d.year] = { n: 0, up: 0, sum: 0, baseN: 0, baseUp: 0 });
        for (const r of rows) { yr.baseN++; if (r.fwd[h] > 0) yr.baseUp++; }
        const topRows = rows.slice(0, TOP_N);
        for (const r of topRows) {
          top.n++; top.sum += r.fwd[h]; if (r.fwd[h] > 0) top.up++;
          yr.n++; yr.sum += r.fwd[h]; if (r.fwd[h] > 0) yr.up++;
        }
        const decRows = rows.slice(0, Math.max(1, Math.ceil(rows.length / 10)));
        for (const r of decRows) { dec.n++; dec.sum += r.fwd[h]; if (r.fwd[h] > 0) dec.up++; }
      }
      const summarize = (s) => {
        const nEff = Math.round(s.n / overlap);
        const ci = wilson(s.up, s.n, nEff);
        return {
          n: s.n, nEff, upRate: s.n ? s.up / s.n : null, meanRetPct: s.n ? (s.sum / s.n) * 100 : null,
          ciLo: ci.lo, ciHi: ci.hi,
          upRateDiff: s.n && base.upRate != null ? s.up / s.n - base.upRate : null,
        };
      };
      const top24 = summarize(top);
      const topDecile = summarize(dec);
      const yearTable = {};
      let sameSign = 0, yearsCounted = 0;
      const pooledSign = Math.sign(top24.upRateDiff ?? 0);
      for (const [y, s] of Object.entries(years).sort()) {
        if (s.n < TOP_N * 4) continue;  // 평가일 4개 미만인 연도는 안정성 판정에서 제외
        const upRate = s.up / s.n;
        const baseRate = s.baseUp / s.baseN;
        const diff = upRate - baseRate;
        yearTable[y] = { n: s.n, upRate, baseRate, upRateDiff: diff, meanRetPct: (s.sum / s.n) * 100 };
        yearsCounted++;
        if (Math.sign(diff) === pooledSign && pooledSign !== 0) sameSign++;
      }
      const ciExcludesBase = top24.ciLo != null && base.upRate != null && (top24.ciLo > base.upRate || top24.ciHi < base.upRate);
      const positive = (top24.upRateDiff ?? 0) > 0;
      const stable = yearsCounted >= 4 && sameSign >= Math.min(4, yearsCounted);
      factors[key] = {
        spearman: spearman(pooledX, pooledY),
        pooledN: pooledX.length,
        datesUsed,
        top24, topDecile,
        years: yearTable,
        sameSignYears: sameSign,
        yearsCounted,
        ciExcludesBase,
        // validated = 순위 상위가 기저율보다 유의하게 '높고'(하한 > 기저율) 연도별로도 안정.
        validated: ciExcludesBase && positive && stable,
      };
    }
    const validated = Object.entries(factors).filter(([, f]) => f.validated);
    validated.sort((a, b) => (b[1].top24.upRateDiff ?? 0) - (a[1].top24.upRateDiff ?? 0));
    horizons[h] = { base, factors, recommended: validated.length ? validated[0][0] : null, dates: dates.length };
  }

  const bars = tickers.map((t) => t.c.length);
  return {
    sample: {
      tickers: tickers.length, filesTotal: sample.filesTotal, filesScanned: sample.scanned,
      skippedShortHistory: sample.skippedBars, skippedNoRealHistory: sample.skippedSource, skippedEtf: sample.skippedEtf,
      minBars: Math.min(...bars), maxBars: Math.max(...bars),
      firstDate: allDates[0], lastDate: allDates[allDates.length - 1],
      evalDates: perDate.length, firstEvalDate: perDate[0]?.date ?? null, lastEvalDate: perDate[perDate.length - 1]?.date ?? null,
    },
    horizons,
    elapsedMs: Date.now() - t0,
  };
}

// ---------------------------------------------------------------- 출력
function kstStamp(d = new Date()) {
  const k = new Date(d.getTime() + 9 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return `${k.getUTCFullYear()}-${p(k.getUTCMonth() + 1)}-${p(k.getUTCDate())} ${p(k.getUTCHours())}:${p(k.getUTCMinutes())} KST`;
}
function roundDeep(x) {
  if (typeof x === "number") return Number.isFinite(x) ? round(x, 4) : null;
  if (Array.isArray(x)) return x.map(roundDeep);
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, roundDeep(v)]));
  return x;
}
function writeAtomic(file, text) {
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, text, "utf8");
  fs.renameSync(tmp, file);
}
function printSummary(out) {
  for (const [m, res] of Object.entries(out.markets)) {
    console.log(`\n== ${m.toUpperCase()} · ${res.sample.tickers}종목 · ${res.sample.firstEvalDate}~${res.sample.lastEvalDate} · ${res.sample.evalDates}평가일 · ${(res.elapsedMs / 1000).toFixed(1)}s`);
    for (const h of HORIZONS) {
      const H = res.horizons[h];
      console.log(`-- ${h}d base up=${(H.base.upRate * 100).toFixed(1)}% mean=${H.base.meanRetPct.toFixed(2)}% (n=${H.base.n}) recommended=${H.recommended ?? "없음"}`);
      for (const [k, f] of Object.entries(H.factors)) {
        const t = f.top24;
        console.log(`   ${k.padEnd(12)} rho=${(f.spearman ?? 0).toFixed(3).padStart(6)} top24 up=${(t.upRate * 100).toFixed(1)}% [${(t.ciLo * 100).toFixed(1)},${(t.ciHi * 100).toFixed(1)}] mean=${t.meanRetPct.toFixed(2)}% years ${f.sameSignYears}/${f.yearsCounted} ${f.validated ? "VALIDATED" : ""}`);
      }
    }
  }
}

function main() {
  const out = {
    updatedAtKst: kstStamp(),
    generatedAt: new Date().toISOString(),
    method: {
      horizons: HORIZONS, stride: STRIDE, sample: SAMPLE, minBars: MIN_BARS, warmupBars: WARMUP, topN: TOP_N, seed: SEED,
      ci: "Wilson 95%, n_eff = n / (horizon / stride)",
      validated: "상위24 상승률 Wilson 하한 > 기저율 AND 연도별 부호 일치 ≥ 4/5(평가일 4개 미만 연도 제외)",
      quickScore: "app.js scanQuickProb (2026-09-04, stochK 항 제거본) 를 그대로 포팅. 신고가 거리는 252봉 고점 기준",
      note: "미래 정보 없음: 각 평가일의 팩터는 그날까지의 봉만으로 계산하고 결과는 그 뒤 h거래일 종가 수익률",
    },
    factors: Object.fromEntries(Object.entries(FACTORS).map(([k, f]) => [k, { label: f.label, short: f.short, unit: f.unit, sign: f.sign ?? null, field: f.field ?? null, runtime: f.runtime, desc: f.desc }])),
    markets: {},
  };
  for (const m of MARKETS) {
    console.log(`[${m.id}] evaluating…`);
    out.markets[m.id] = evaluateMarket(m);
  }
  const payload = roundDeep(out);
  const json = JSON.stringify(payload);
  writeAtomic(path.join(ROOT, "data/factor_validation.json"), json + "\n");
  writeAtomic(path.join(ROOT, "data/factor_validation.js"), `window.FACTOR_VALIDATION = ${json};\n`);
  printSummary(payload);
  console.log(`\nwrote data/factor_validation.json (+.js) ${(json.length / 1024).toFixed(0)}KB`);
}

main();
