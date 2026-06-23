/*
 * 차트 확률 분석 엔진 (analysis.js)
 * ----------------------------------
 * 종목 하나의 5년치 일봉(OHLCV)을 받아 두 가지 방식으로 상승/하락 확률을 추정한다.
 *
 *  ① 신호 합의(Signal Consensus): 추세·모멘텀·거래량·변동성·캔들 지표가 각각
 *     강세(+) / 약세(-)에 투표하고, 가중 평균을 확률로 변환한다.
 *  ② 과거 유사 상황 실측(Backtest Base-Rate): 지금과 비슷한 기술적 상태였던
 *     과거 날들을 모두 찾아, 그날들 중 H일 뒤 실제로 오른 비율을 센다.
 *
 * 두 값은 모두 "기술적 추정치"이며 미래를 보장하지 않는다. UI에 면책 문구를 둔다.
 * 외부 서버 없이 브라우저에서 data/details/{TICKER}.json 한 파일만 읽어 계산한다.
 *
 * 이 파일은 standalone 페이지(analysis.html)와 대시보드 종목 분석 페이지(index.html)
 * 양쪽에서 로드된다. 전역 충돌을 피하려고 전체를 IIFE로 감싸고, 엔진은 window.MirProb
 * 로만 노출한다. (analysis.html 의 UI 바인딩은 해당 DOM이 있을 때만 동작.)
 */

(function () {
// ===== 지표 수학 (app.js와 동일한 정의를 self-contained로 복제) =====
function emaRaw(values, period) {
  const out = [];
  const k = 2 / (period + 1);
  let ema = values.length ? values[0] : 0;
  for (let i = 0; i < values.length; i += 1) {
    ema = i ? values[i] * k + ema * (1 - k) : values[i];
    out.push(ema);
  }
  return out;
}

function smaArray(values, period) {
  const out = Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i += 1) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j += 1) sum += values[j];
    out[i] = sum / period;
  }
  return out;
}

function rsiValue(avgGain, avgLoss) {
  if (!avgLoss) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function rsiSeries(values, period) {
  const out = Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i += 1) {
    const change = values[i] - values[i - 1];
    gain += Math.max(0, change);
    loss += Math.max(0, -change);
  }
  gain /= period;
  loss /= period;
  out[period] = rsiValue(gain, loss);
  for (let i = period + 1; i < values.length; i += 1) {
    const change = values[i] - values[i - 1];
    gain = (gain * (period - 1) + Math.max(0, change)) / period;
    loss = (loss * (period - 1) + Math.max(0, -change)) / period;
    out[i] = rsiValue(gain, loss);
  }
  return out;
}

function macdSeries(values) {
  const fast = emaRaw(values, 12);
  const slow = emaRaw(values, 26);
  const macd = values.map((_, i) => fast[i] - slow[i]);
  const signal = emaRaw(macd, 9);
  const hist = macd.map((v, i) => v - signal[i]);
  const warm = Math.min(25, values.length);
  for (let i = 0; i < warm; i += 1) { macd[i] = null; signal[i] = null; hist[i] = null; }
  return { macd, signal, hist };
}

function bollinger(values, period, mult) {
  const mid = Array(values.length).fill(null);
  const upper = Array(values.length).fill(null);
  const lower = Array(values.length).fill(null);
  const pctB = Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i += 1) {
    const chunk = values.slice(i - period + 1, i + 1);
    const m = chunk.reduce((a, b) => a + b, 0) / period;
    const variance = chunk.reduce((a, b) => a + (b - m) * (b - m), 0) / period;
    const sd = Math.sqrt(variance);
    mid[i] = m;
    upper[i] = m + mult * sd;
    lower[i] = m - mult * sd;
    const width = upper[i] - lower[i];
    pctB[i] = width ? (values[i] - lower[i]) / width : 0.5;
  }
  return { mid, upper, lower, pctB };
}

function trueRangeArray(rows) {
  return rows.map((row, i) => {
    if (!i) return row.h - row.l;
    const prevClose = rows[i - 1].c;
    return Math.max(row.h - row.l, Math.abs(row.h - prevClose), Math.abs(row.l - prevClose));
  });
}

function wilderArray(values, period) {
  const out = Array(values.length).fill(null);
  if (values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i += 1) sum += values[i] || 0;
  out[period - 1] = sum / period;
  for (let i = period; i < values.length; i += 1) {
    out[i] = ((out[i - 1] * (period - 1)) + (values[i] || 0)) / period;
  }
  return out;
}

function atrArray(rows, period = 14) {
  return wilderArray(trueRangeArray(rows), period);
}

function adxArrays(rows, period = 14) {
  const plusDm = Array(rows.length).fill(0);
  const minusDm = Array(rows.length).fill(0);
  for (let i = 1; i < rows.length; i += 1) {
    const upMove = rows[i].h - rows[i - 1].h;
    const downMove = rows[i - 1].l - rows[i].l;
    plusDm[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDm[i] = downMove > upMove && downMove > 0 ? downMove : 0;
  }
  const atr = atrArray(rows, period);
  const smoothPlus = wilderArray(plusDm, period);
  const smoothMinus = wilderArray(minusDm, period);
  const plusDi = rows.map((_, i) => (atr[i] ? (100 * smoothPlus[i]) / atr[i] : null));
  const minusDi = rows.map((_, i) => (atr[i] ? (100 * smoothMinus[i]) / atr[i] : null));
  const dx = rows.map((_, i) => {
    if (plusDi[i] == null || minusDi[i] == null || plusDi[i] + minusDi[i] === 0) return null;
    return 100 * Math.abs(plusDi[i] - minusDi[i]) / (plusDi[i] + minusDi[i]);
  });
  const adx = wilderArray(dx.map((v) => v ?? 0), period);
  for (let i = 0; i < period * 2 - 2 && i < adx.length; i += 1) adx[i] = null;
  return { adx, plusDi, minusDi };
}

function stochArrays(rows, kPeriod, dPeriod) {
  const k = Array(rows.length).fill(null);
  for (let i = kPeriod - 1; i < rows.length; i += 1) {
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j += 1) {
      hi = Math.max(hi, rows[j].h);
      lo = Math.min(lo, rows[j].l);
    }
    k[i] = hi === lo ? 50 : ((rows[i].c - lo) / (hi - lo)) * 100;
  }
  const d = Array(rows.length).fill(null);
  for (let i = kPeriod - 1 + dPeriod - 1; i < rows.length; i += 1) {
    let sum = 0;
    let count = 0;
    for (let j = i - dPeriod + 1; j <= i; j += 1) {
      if (k[j] != null) { sum += k[j]; count += 1; }
    }
    if (count) d[i] = sum / count;
  }
  return { k, d };
}

function obvArray(rows) {
  const out = Array(rows.length).fill(0);
  let obv = 0;
  for (let i = 0; i < rows.length; i += 1) {
    if (!i) obv = 0;
    else if (rows[i].c > rows[i - 1].c) obv += rows[i].v || 0;
    else if (rows[i].c < rows[i - 1].c) obv -= rows[i].v || 0;
    out[i] = obv;
  }
  return out;
}

function rocArray(values, period = 12) {
  return values.map((value, i) => (i < period || !values[i - period] ? null : ((value / values[i - period]) - 1) * 100));
}

function emaArray(values, period) {
  const out = Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let ema = null;
  for (let i = 0; i < values.length; i += 1) {
    if (i < period - 1) continue;
    if (ema == null) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j += 1) sum += values[j];
      ema = sum / period;
    } else ema = values[i] * k + ema * (1 - k);
    out[i] = ema;
  }
  return out;
}

function vwapArray(rows) {
  const out = Array(rows.length).fill(null);
  let pv = 0;
  let vol = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const typical = (rows[i].h + rows[i].l + rows[i].c) / 3;
    const v = rows[i].v || 0;
    pv += typical * v;
    vol += v;
    out[i] = vol ? pv / vol : typical;
  }
  return out;
}

function keltnerChannels(rows, period = 20, mult = 2) {
  const closes = rows.map((r) => r.c);
  const mid = emaArray(closes, period);
  const atr = atrArray(rows, period);
  return {
    mid,
    upper: mid.map((v, i) => (v == null || atr[i] == null ? null : v + mult * atr[i])),
    lower: mid.map((v, i) => (v == null || atr[i] == null ? null : v - mult * atr[i])),
  };
}

function ichimokuArrays(rows) {
  const midRange = (period) => {
    const out = Array(rows.length).fill(null);
    for (let i = period - 1; i < rows.length; i += 1) {
      const slice = rows.slice(i - period + 1, i + 1);
      out[i] = (Math.max(...slice.map((r) => r.h)) + Math.min(...slice.map((r) => r.l))) / 2;
    }
    return out;
  };
  const tenkan = midRange(9);
  const kijun = midRange(26);
  const spanB = midRange(52);
  const spanA = tenkan.map((v, i) => (v == null || kijun[i] == null ? null : (v + kijun[i]) / 2));
  return { tenkan, kijun, spanA, spanB };
}

function supertrendState(rows, period = 10, mult = 3) {
  const atr = atrArray(rows, period);
  const upper = Array(rows.length).fill(null);
  const lower = Array(rows.length).fill(null);
  let trendUp = true;
  for (let i = 0; i < rows.length; i += 1) {
    if (atr[i] == null) continue;
    const hl2 = (rows[i].h + rows[i].l) / 2;
    const bu = hl2 + mult * atr[i];
    const bl = hl2 - mult * atr[i];
    upper[i] = i && upper[i - 1] != null && rows[i - 1].c <= upper[i - 1] ? Math.min(bu, upper[i - 1]) : bu;
    lower[i] = i && lower[i - 1] != null && rows[i - 1].c >= lower[i - 1] ? Math.max(bl, lower[i - 1]) : bl;
    if (i) {
      if (trendUp && rows[i].c < lower[i]) trendUp = false;
      else if (!trendUp && rows[i].c > upper[i]) trendUp = true;
    } else trendUp = rows[i].c >= hl2;
  }
  return { bullish: trendUp, line: trendUp ? lower[rows.length - 1] : upper[rows.length - 1] };
}

function cmfArray(rows, period = 20) {
  const out = Array(rows.length).fill(null);
  const mfv = rows.map((r) => {
    const range = r.h - r.l;
    const m = range ? (((r.c - r.l) - (r.h - r.c)) / range) : 0;
    return m * (r.v || 0);
  });
  for (let i = period - 1; i < rows.length; i += 1) {
    const volSum = rows.slice(i - period + 1, i + 1).reduce((a, r) => a + (r.v || 0), 0);
    const mfvSum = mfv.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    out[i] = volSum ? mfvSum / volSum : 0;
  }
  return out;
}

function mfiArray(rows, period = 14) {
  const tp = rows.map((r) => (r.h + r.l + r.c) / 3);
  const rmf = rows.map((r, i) => {
    const raw = tp[i] * (r.v || 0);
    if (!i) return { pos: 0, neg: 0 };
    return raw > tp[i - 1] * (rows[i - 1].v || 0) ? { pos: raw, neg: 0 } : { pos: 0, neg: raw };
  });
  const out = Array(rows.length).fill(null);
  for (let i = period; i < rows.length; i += 1) {
    let pos = 0;
    let neg = 0;
    for (let j = i - period + 1; j <= i; j += 1) { pos += rmf[j].pos; neg += rmf[j].neg; }
    const ratio = neg ? pos / neg : 100;
    out[i] = 100 - 100 / (1 + ratio);
  }
  return out;
}

function parabolicSarArray(rows, step = 0.02, maxStep = 0.2) {
  const out = Array(rows.length).fill(null);
  if (rows.length < 2) return out;
  let bull = rows[1].c > rows[0].c;
  let af = step;
  let ep = bull ? rows[0].h : rows[0].l;
  let sar = bull ? rows[0].l : rows[0].h;
  out[0] = sar;
  for (let i = 1; i < rows.length; i += 1) {
    sar = sar + af * (ep - sar);
    if (bull) {
      if (rows[i].l < sar) { bull = false; sar = ep; ep = rows[i].l; af = step; }
      else { if (rows[i].h > ep) { ep = rows[i].h; af = Math.min(maxStep, af + step); } }
    } else {
      if (rows[i].h > sar) { bull = true; sar = ep; ep = rows[i].h; af = step; }
      else { if (rows[i].l < ep) { ep = rows[i].l; af = Math.min(maxStep, af + step); } }
    }
    out[i] = sar;
  }
  return { values: out, bullish: rows[rows.length - 1].c > out[rows.length - 1] };
}

function linearRegressionChannel(rows, period = 40) {
  const n = rows.length;
  if (n < period) return null;
  const closes = rows.slice(-period).map((r) => r.c);
  const xs = closes.map((_, i) => i);
  const mx = (period - 1) / 2;
  const my = closes.reduce((a, b) => a + b, 0) / period;
  let num = 0;
  let den = 0;
  for (let i = 0; i < period; i += 1) { num += (i - mx) * (closes[i] - my); den += (i - mx) ** 2; }
  const slope = den ? num / den : 0;
  const intercept = my - slope * mx;
  const residuals = closes.map((c, i) => c - (intercept + slope * i));
  const std = Math.sqrt(residuals.reduce((a, r) => a + r * r, 0) / period);
  const endY = intercept + slope * (period - 1);
  const startY = intercept;
  return { slope, upper: endY + std * 2, lower: endY - std * 2, mid: endY, start: startY, std };
}

function ttmSqueezeState(rows) {
  const closes = rows.map((r) => r.c);
  const bb = bollinger(closes, 20, 2);
  const kc = keltnerChannels(rows, 20, 1.5);
  const i = rows.length - 1;
  if (bb.upper[i] == null || kc.upper[i] == null) return { squeezed: false, fired: false };
  const squeezed = bb.upper[i] < kc.upper[i] && bb.lower[i] > kc.lower[i];
  const prev = i > 0 && bb.upper[i - 1] != null && kc.upper[i - 1] != null
    ? bb.upper[i - 1] < kc.upper[i - 1] && bb.lower[i - 1] > kc.lower[i - 1] : false;
  return { squeezed, fired: prev && !squeezed };
}

function ttmSqueezeSeries(rows) {
  const closes = rows.map((r) => r.c);
  const bb = bollinger(closes, 20, 2);
  const kc = keltnerChannels(rows, 20, 1.5);
  const squeezed = Array(rows.length).fill(false);
  for (let i = 0; i < rows.length; i += 1) {
    if (bb.upper[i] == null || kc.upper[i] == null) continue;
    squeezed[i] = bb.upper[i] < kc.upper[i] && bb.lower[i] > kc.lower[i];
  }
  return { squeezed, momentum: rocArray(closes, 12) };
}

function floorTraderPivots(rows) {
  if (rows.length < 2) return null;
  const prev = rows[rows.length - 2];
  const p = (prev.h + prev.l + prev.c) / 3;
  const r1 = 2 * p - prev.l;
  const s1 = 2 * p - prev.h;
  const r2 = p + (prev.h - prev.l);
  const s2 = p - (prev.h - prev.l);
  return { pivot: p, r1, r2, s1, s2 };
}

function fibonacciLevels(rows, lookback = 60) {
  const slice = rows.slice(-lookback);
  if (!slice.length) return null;
  const hi = Math.max(...slice.map((r) => r.h));
  const lo = Math.min(...slice.map((r) => r.l));
  const range = hi - lo;
  return {
    high: hi, low: lo,
    levels: {
      "0%": hi,
      "23.6%": hi - range * 0.236,
      "38.2%": hi - range * 0.382,
      "50%": hi - range * 0.5,
      "61.8%": hi - range * 0.618,
      "100%": lo,
    },
  };
}

function aggregateWeekly(rows) {
  const weeks = [];
  let cur = null;
  for (const r of rows) {
    const d = r.d ? new Date(r.d) : null;
    const key = d ? `${d.getUTCFullYear()}-W${Math.floor((d - new Date(Date.UTC(d.getUTCFullYear(), 0, 1))) / 604800000)}` : String(weeks.length);
    if (!cur || cur.key !== key) {
      cur = { key, o: r.o, h: r.h, l: r.l, c: r.c, v: r.v || 0, d: r.d };
      weeks.push(cur);
    } else {
      cur.h = Math.max(cur.h, r.h);
      cur.l = Math.min(cur.l, r.l);
      cur.c = r.c;
      cur.v += r.v || 0;
      cur.d = r.d;
    }
  }
  return weeks;
}

function aggregateMonthly(rows) {
  const months = [];
  let cur = null;
  for (const r of rows) {
    const key = r.d ? String(r.d).slice(0, 7) : String(months.length);
    if (!cur || cur.key !== key) {
      cur = { key, o: r.o, h: r.h, l: r.l, c: r.c, v: r.v || 0, d: r.d };
      months.push(cur);
    } else {
      cur.h = Math.max(cur.h, r.h);
      cur.l = Math.min(cur.l, r.l);
      cur.c = r.c;
      cur.v += r.v || 0;
      cur.d = r.d;
    }
  }
  return months;
}

function tfTrendState(closes) {
  const sma20 = smaArray(closes, 20);
  const sma60 = smaArray(closes, 60);
  const n = closes.length - 1;
  const s20 = sma20[n];
  const s60 = sma60[n];
  const price = closes[n];
  if (s20 == null || s60 == null) return { bull: false, bear: false, label: "데이터 부족" };
  if (price > s20 && s20 > s60) return { bull: true, bear: false, label: "정배열" };
  if (price < s20 && s20 < s60) return { bull: false, bear: true, label: "역배열" };
  return { bull: false, bear: false, label: "혼조" };
}

function computeGapFillStats(rows, maxFillBars = 40, minPct = 0.003) {
  const samples = [];
  for (let i = 1; i < rows.length - 5; i += 1) {
    const prev = rows[i - 1];
    const cur = rows[i];
    let zone = null;
    if (cur.l > prev.h * (1 + minPct)) zone = { type: "up", lo: prev.h, hi: cur.l, idx: i };
    else if (cur.h < prev.l * (1 - minPct)) zone = { type: "down", lo: cur.h, hi: prev.l, idx: i };
    if (!zone) continue;
    let filled = false;
    let fillBars = null;
    for (let j = i; j < Math.min(rows.length, i + maxFillBars); j += 1) {
      if (rows[j].l <= zone.hi && rows[j].h >= zone.lo) { filled = true; fillBars = j - i; break; }
    }
    samples.push({ ...zone, filled, fillBars });
  }
  const n = samples.length;
  const filledN = samples.filter((s) => s.filled).length;
  const recent = samples.slice(-3).reverse();
  return {
    samples: n,
    fillRate: n ? (filledN / n) * 100 : null,
    avgFillBars: filledN ? samples.filter((s) => s.filled && s.fillBars != null).reduce((a, s) => a + s.fillBars, 0) / filledN : null,
    recent,
  };
}

function estimateOptionsContext(price, rows) {
  const step = price >= 200 ? 10 : price >= 50 ? 5 : price >= 10 ? 2.5 : 1;
  const strike = Math.round(price / step) * step;
  const nodes = volumeProfileNodes(rows || []);
  const sorted = nodes.slice().sort((a, b) => b.vol - a.vol);
  const magnet = sorted[0] ? sorted[0].price : strike;
  const maxPain = Math.abs(magnet - price) < step * 2 ? magnet : strike;
  return {
    maxPain,
    callWall: strike + step,
    putWall: Math.max(0.01, strike - step),
    gammaZone: [strike - step, strike + step],
    note: "옵션 OI 미연동 · VP·행사가 그리드 기반 추정",
  };
}

function institutionalFlowForTicker(ticker) {
  if (!ticker || typeof window === "undefined") return null;
  const key = String(ticker).toUpperCase();
  const insts = (window.INSTITUTIONAL_13F || {}).institutions || [];
  let instCount = 0;
  let totalValueM = 0;
  let topInst = "";
  for (const inst of insts) {
    const holdings = (inst.quarters && inst.quarters.length ? inst.quarters[inst.quarters.length - 1].holdings : inst.holdings) || [];
    const h = holdings.find((x) => String(x.ticker).toUpperCase() === key);
    if (h) {
      instCount += 1;
      totalValueM += Number(h.valueM) || (Number(h.valueK) || 0) / 1000;
      if (!topInst) topInst = inst.name || inst.manager || "";
    }
  }
  const trades = ((window.INSIDER_TRADES || {}).trades || []).filter((t) => String(t.ticker).toUpperCase() === key);
  const buys = trades.filter((t) => t.kind === "buy").length;
  const sells = trades.filter((t) => t.kind === "sell").length;
  const recent = trades.slice(0, 4).map((t) => `${t.owner || "임원"} ${t.codeLabel || t.kind} ${t.shares ? Math.round(t.shares).toLocaleString() + "주" : ""}`.trim());
  return { instCount, totalValueM, topInst, insiderCount: trades.length, netBuyBias: buys - sells, recent };
}

function chandelierExitArray(rows, period = 22, mult = 3) {
  const atr = atrArray(rows, period);
  const out = Array(rows.length).fill(null);
  for (let i = period - 1; i < rows.length; i += 1) {
    const slice = rows.slice(Math.max(0, i - period + 1), i + 1);
    const hi = Math.max(...slice.map((r) => r.h));
    const lo = Math.min(...slice.map((r) => r.l));
    const a = atr[i];
    if (a == null) continue;
    out[i] = { longStop: hi - mult * a, shortStop: lo + mult * a };
  }
  return out;
}

function getShortInterest(ticker) {
  const data = typeof window !== "undefined" && window.SHORT_INTEREST;
  if (!data || !ticker || !data.rows) return null;
  const row = data.rows.find((r) => String(r.ticker).toUpperCase() === String(ticker).toUpperCase());
  return row || null;
}

function computeAtrLevels(rows, price, mult = 2) {
  const atr = atrArray(rows, 14);
  const last = atr[atr.length - 1];
  if (last == null) return null;
  return {
    atr: last,
    stop: price - mult * last,
    target: price + mult * last,
    target2: price + mult * 2 * last,
    riskPct: (mult * last / price) * 100,
  };
}

function computeTechnicalLevels(rows, price) {
  return {
    fib: fibonacciLevels(rows),
    pivots: floorTraderPivots(rows),
    atr: computeAtrLevels(rows, price),
    linreg: linearRegressionChannel(rows),
    psar: parabolicSarArray(rows),
  };
}

function buildMultiTimeframeContext(rows) {
  const daily = tfTrendState(rows.map((r) => r.c));
  const weekly = aggregateWeekly(rows);
  const monthly = aggregateMonthly(rows);
  if (weekly.length < 20) return { alignment: 0, bias: 0, label: "주봉 데이터 부족", daily, weekly: null, monthly: null };
  const wTrend = tfTrendState(weekly.map((r) => r.c));
  const mTrend = monthly.length >= 12 ? tfTrendState(monthly.map((r) => r.c)) : { bull: false, bear: false, label: "월봉 부족" };
  let score = 0;
  if (daily.bull) score += 1; else if (daily.bear) score -= 1;
  if (wTrend.bull) score += 1.2; else if (wTrend.bear) score -= 1.2;
  if (mTrend.bull) score += 1.5; else if (mTrend.bear) score -= 1.5;
  const bias = Math.max(-1, Math.min(1, score / 3.7));
  let label = `일 ${daily.label} · 주 ${wTrend.label} · 월 ${mTrend.label}`;
  if (score >= 2.5) label = "일·주·월 상승 정렬";
  else if (score <= -2.5) label = "일·주·월 하락 정렬";
  const agree = [daily.bull === wTrend.bull && daily.bull, daily.bear === wTrend.bear && daily.bear,
    mTrend.bull && wTrend.bull, mTrend.bear && wTrend.bear].filter(Boolean).length;
  const alignment = agree >= 2 ? 0.9 : Math.abs(bias) > 0.45 ? 0.7 : Math.abs(bias) > 0.2 ? 0.5 : 0.25;
  return {
    alignment, bias, label, daily, weekly: wTrend, monthly: mTrend,
    weeklyBull: wTrend.bull, weeklyBear: wTrend.bear,
  };
}

// 선형회귀 기울기를 평균값 대비 % 로 환산 (추세 방향/강도 측정에 사용)
function slopePct(values, lookback) {
  const n = values.length;
  if (n < lookback) return 0;
  const seg = values.slice(n - lookback);
  const m = seg.reduce((a, b) => a + b, 0) / lookback;
  if (!m) return 0;
  let num = 0;
  let den = 0;
  const xm = (lookback - 1) / 2;
  for (let i = 0; i < lookback; i += 1) {
    num += (i - xm) * (seg[i] - m);
    den += (i - xm) * (i - xm);
  }
  const slope = den ? num / den : 0;
  return (slope / m) * 100; // 막대당 평균 대비 % 변화
}

// ===== 캔들 패턴 (최근 봉 기준) =====
function detectCandlePatterns(rows) {
  const n = rows.length;
  if (n < 3) return [];
  const a = rows[n - 3];
  const b = rows[n - 2];
  const c = rows[n - 1];
  const out = [];
  const body = (r) => Math.abs(r.c - r.o);
  const range = (r) => Math.max(1e-9, r.h - r.l);
  const upperWick = (r) => r.h - Math.max(r.c, r.o);
  const lowerWick = (r) => Math.min(r.c, r.o) - r.l;

  // 상승 장악형
  if (c.c > c.o && b.c < b.o && c.c >= b.o && c.o <= b.c && body(c) > body(b)) {
    out.push({ name: "상승 장악형", dir: 1, weight: 1.1 });
  }
  // 하락 장악형
  if (c.c < c.o && b.c > b.o && c.o >= b.c && c.c <= b.o && body(c) > body(b)) {
    out.push({ name: "하락 장악형", dir: -1, weight: 1.1 });
  }
  // 망치형 (하락 후 긴 아래꼬리)
  if (lowerWick(c) > body(c) * 2 && upperWick(c) < body(c) && c.c < a.c) {
    out.push({ name: "망치형(반등 신호)", dir: 1, weight: 0.8 });
  }
  // 유성형 (상승 후 긴 위꼬리)
  if (upperWick(c) > body(c) * 2 && lowerWick(c) < body(c) && c.c > a.c) {
    out.push({ name: "유성형(하락 신호)", dir: -1, weight: 0.8 });
  }
  // 도지 (방향성 약화)
  if (body(c) < range(c) * 0.1) {
    out.push({ name: "도지(관망)", dir: 0, weight: 0.4 });
  }
  return out;
}

// ===== 지지/저항 (스윙 고저점) =====
function findSupportResistance(rows, lookback = 120, win = 5) {
  const n = rows.length;
  const start = Math.max(win, n - lookback);
  const price = rows[n - 1].c;
  const sup = [];
  const res = [];
  for (let i = start; i < n - win; i += 1) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - win; j <= i + win; j += 1) {
      if (j === i) continue;
      if (rows[j].h >= rows[i].h) isHigh = false;
      if (rows[j].l <= rows[i].l) isLow = false;
    }
    if (isHigh) res.push(rows[i].h);
    if (isLow) sup.push(rows[i].l);
  }
  const nearestBelow = sup.concat(res).filter((v) => v < price).sort((x, y) => y - x)[0] || null;
  const nearestAbove = res.concat(sup).filter((v) => v > price).sort((x, y) => x - y)[0] || null;
  return { support: nearestBelow, resistance: nearestAbove, price };
}

// ===== 강도 점수 기반 지지/저항 (차트 오버레이 + 패널 공용 — 단일 소스) =====
// 근거: ① 스윙 고저점(터치) ② 닿은 뒤 반전 크기(ATR 대비) ③ 거래량 프로파일(매물대)
//       ④ 최신성 ⑤ 근접성. 클러스터 허용오차/존 두께는 ATR로 자동 조절.
function windowAtr(rows) {
  const n = rows.length;
  let sum = 0;
  let cnt = 0;
  for (let i = Math.max(1, n - 50); i < n; i += 1) {
    const tr = Math.max(
      rows[i].h - rows[i].l,
      Math.abs(rows[i].h - rows[i - 1].c),
      Math.abs(rows[i].l - rows[i - 1].c),
    );
    sum += tr; cnt += 1;
  }
  return cnt ? sum / cnt : (rows[n - 1].c * 0.02);
}

// 거래량 프로파일: 가격축 60구간에 봉별 거래량을 [저,고]로 분산 누적 →
// 국소 최대(고거래량 노드, HVN) = 실제 매물이 몰린 가격대.
function volumeProfileNodes(rows) {
  const n = rows.length;
  let lo = Infinity;
  let hi = -Infinity;
  for (const r of rows) { if (r.l < lo) lo = r.l; if (r.h > hi) hi = r.h; }
  if (!(hi > lo)) return [];
  const BINS = 60;
  const binW = (hi - lo) / BINS;
  const vol = new Array(BINS).fill(0);
  const lastIdx = new Array(BINS).fill(0);
  for (let i = 0; i < n; i += 1) {
    const r = rows[i];
    const a = Math.min(BINS - 1, Math.max(0, Math.floor((r.l - lo) / binW)));
    const b = Math.min(BINS - 1, Math.max(a, Math.floor((r.h - lo) / binW)));
    const share = (r.v || 0) / (b - a + 1);
    for (let k = a; k <= b; k += 1) { vol[k] += share; lastIdx[k] = i; }
  }
  const nodes = [];
  for (let k = 1; k < BINS - 1; k += 1) {
    if (vol[k] > 0 && vol[k] >= vol[k - 1] && vol[k] >= vol[k + 1]) {
      nodes.push({ price: lo + (k + 0.5) * binW, vol: vol[k], idx: lastIdx[k] });
    }
  }
  return nodes;
}

function supportResistanceLevels(rows, maxPerSide = 3) {
  const n = rows.length;
  if (n < 12) return [];
  const price = rows[n - 1].c;
  const atr = windowAtr(rows);
  const atrPct = price ? atr / price : 0.02;
  const win = Math.max(3, Math.min(8, Math.floor(n / 25)));
  const fwd = Math.min(20, Math.floor(n / 4));

  const cands = [];
  for (let i = win; i < n - win; i += 1) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - win; j <= i + win; j += 1) {
      if (j === i) continue;
      if (rows[j].h > rows[i].h) isHigh = false;
      if (rows[j].l < rows[i].l) isLow = false;
    }
    if (isHigh) {
      let drop = 0;
      for (let j = i + 1; j <= Math.min(n - 1, i + fwd); j += 1) drop = Math.max(drop, rows[i].h - rows[j].l);
      cands.push({ price: rows[i].h, touches: 1, reaction: atr ? drop / atr : 0, vol: 0, idx: i });
    }
    if (isLow) {
      let rise = 0;
      for (let j = i + 1; j <= Math.min(n - 1, i + fwd); j += 1) rise = Math.max(rise, rows[j].h - rows[i].l);
      cands.push({ price: rows[i].l, touches: 1, reaction: atr ? rise / atr : 0, vol: 0, idx: i });
    }
  }
  for (const node of volumeProfileNodes(rows)) {
    cands.push({ price: node.price, touches: 0, reaction: 0, vol: node.vol, idx: node.idx });
  }
  if (!cands.length) return [];

  cands.sort((a, b) => a.price - b.price);
  const tol = Math.max(0.6 * atrPct, 0.004);
  const clusters = [];
  for (const c of cands) {
    const last = clusters[clusters.length - 1];
    const mean = last ? last.sum / last.wsum : 0;
    if (last && mean && Math.abs(c.price - mean) / mean <= tol) {
      last.sum += c.price; last.wsum += 1;
      last.touches += c.touches; last.reaction += c.reaction; last.vol += c.vol;
      last.lo = Math.min(last.lo, c.price); last.hi = Math.max(last.hi, c.price);
      last.idx = Math.max(last.idx, c.idx);
    } else {
      clusters.push({ sum: c.price, wsum: 1, touches: c.touches, reaction: c.reaction, vol: c.vol, lo: c.price, hi: c.price, idx: c.idx });
    }
  }

  const maxT = Math.max(1, ...clusters.map((c) => c.touches));
  const maxR = Math.max(1e-9, ...clusters.map((c) => c.reaction));
  const maxV = Math.max(1e-9, ...clusters.map((c) => c.vol));
  const levels = clusters.map((c) => {
    const p = c.sum / c.wsum;
    const recency = n > 1 ? c.idx / (n - 1) : 0.5;
    const prox = 1 - Math.min(1, Math.abs(p - price) / (price * 0.25));
    const score = 0.30 * (c.vol / maxV) + 0.22 * (c.touches / maxT)
      + 0.18 * (c.reaction / maxR) + 0.12 * recency + 0.18 * prox;
    const half = Math.max(0.4 * atr, (c.hi - c.lo) / 2);
    return { price: p, lo: p - half, hi: p + half, touches: c.touches, vol: c.vol, score };
  });

  const sup = levels.filter((l) => l.price < price).sort((a, b) => b.score - a.score).slice(0, maxPerSide);
  const res = levels.filter((l) => l.price >= price).sort((a, b) => b.score - a.score).slice(0, maxPerSide);
  const maxScore = Math.max(1e-9, ...levels.map((l) => l.score));
  const out = [
    ...sup.map((l) => ({ ...l, type: "sup" })),
    ...res.map((l) => ({ ...l, type: "res" })),
  ];
  for (const l of out) l.tier = l.score >= 0.66 * maxScore ? 3 : (l.score >= 0.4 * maxScore ? 2 : 1);
  return out;
}

// 패널 표시용 요약: 현재가에서 가장 가까운 지지/저항(차트에 그려지는 선과 동일 소스).
function srSummary(rows) {
  if (!rows.length) return { support: null, resistance: null, price: null, levels: [] };
  const price = rows[rows.length - 1].c;
  const levels = supportResistanceLevels(rows);
  const sup = levels.filter((l) => l.type === "sup").sort((a, b) => b.price - a.price);
  const res = levels.filter((l) => l.type === "res").sort((a, b) => a.price - b.price);
  return {
    support: sup.length ? sup[0].price : null,
    resistance: res.length ? res[0].price : null,
    price,
    levels,
  };
}

// ===== 차트 패턴 감지 (scripts/pattern_lib.py 의 브라우저 포팅본) =====
// ⚠️ 아래 상수/알고리즘은 pattern_lib.py 와 1:1로 동일해야 한다.
//    (그래야 오프라인으로 만든 data/pattern_stats.json 의 과거 성공률 조회가 유효하다.)
const PAT = {
  PIVOT_WIN: 5,
  TOP_TOL: 0.04,
  TROUGH_MIN: 0.03,
  SHOULDER_TOL: 0.06,
  HEAD_MIN: 0.02,
  CONFIRM_MAX_BARS: 40,
  FLAT_SLOPE: 0.0006,
  TRI_LOOKBACK: 90,
  SR_LOOKBACK: 120,
  RECENT_WINDOW: 10,
};
const PATTERN_LABELS = {
  double_top: "쌍천장(이중 천장)",
  double_bottom: "쌍바닥(이중 바닥)",
  hns: "헤드앤숄더(천장)",
  inv_hns: "역헤드앤숄더(바닥)",
  ascending_triangle: "상승 삼각수렴",
  descending_triangle: "하락 삼각수렴",
  symmetrical_triangle: "대칭 삼각수렴",
  falling_wedge: "하락 쐐기형",
  rising_wedge: "상승 쐐기형",
  box_breakout: "박스권 상향 돌파",
  box_breakdown: "박스권 하향 이탈",
  bull_flag: "상승 깃발형",
  bear_flag: "하락 깃발형",
  bull_pennant: "상승 페넌트",
  bear_pennant: "하락 페넌트",
  triple_top: "삼중 천장형",
  triple_bottom: "삼중 바닥형",
  broadening_triangle: "확산형 삼각수렴",
  diamond_top: "다이아몬드 천장형",
  diamond_bottom: "다이아몬드 바닥형",
  rounding_bottom: "라운딩 바닥형(U자형)",
  complex_hns: "복합 헤드앤숄더",
  cup_and_handle: "컵 앤 핸들",
  ascending_channel_breakout: "상승 채널 돌파",
  descending_channel_breakout: "하락 채널 이탈",
  reversal_123_up: "1-2-3 반전(상승)",
  reversal_123_down: "1-2-3 반전(하락)",
  two_b_bottom: "2B 바닥",
  two_b_top: "2B 천장",
  bull_trap: "불 트랩(가짜 돌파)",
  bear_trap: "베어 트랩(가짜 이탈)",
  breakaway_gap_up: "상승 갭(돌파형)",
  breakaway_gap_down: "하락 갭(돌파형)",
  exhaustion_gap_up: "상승 갭(소진형)",
  exhaustion_gap_down: "하락 갭(소진형)",
  island_reversal: "아일랜드 반전",
  gap_fill_setup: "갭 메우기 셋업",
  volume_climax_up: "거래량 클라이맥스(상승)",
  volume_climax_down: "거래량 클라이맥스(하락)",
  nr4_breakout_up: "NR4 상향 돌파",
  nr4_breakout_down: "NR4 하향 이탈",
  inside_bar_breakout_up: "인사이드바 상향 돌파",
  inside_bar_breakout_down: "인사이드바 하향 이탈",
  harmonic_abcd_bull: "하모닉 AB=CD(상승)",
  harmonic_abcd_bear: "하모닉 AB=CD(하락)",
  bullish_engulfing: "상승 장악형",
  bearish_engulfing: "하락 장악형",
  hammer: "망치형",
  shooting_star: "유성형",
  doji: "도지",
  morning_star: "샛별형(모닝스타)",
  evening_star: "석별형(이브닝스타)",
  three_white_soldiers: "적삼병",
  three_black_crows: "흑삼병",
  piercing_line: "관통형",
  dark_cloud_cover: "먹구름형",
  resistance_breakout: "저항선 돌파",
  support_breakdown: "지지선 이탈",
};

function findPivots(rows, win = PAT.PIVOT_WIN) {
  const n = rows.length;
  const pivots = [];
  for (let i = win; i < n - win; i += 1) {
    const hi = rows[i].h;
    const lo = rows[i].l;
    let isHigh = true;
    let isLow = true;
    for (let j = i - win; j <= i + win; j += 1) {
      if (j === i) continue;
      if (rows[j].h > hi) isHigh = false;
      if (rows[j].l < lo) isLow = false;
    }
    if (isHigh) pivots.push({ idx: i, price: hi, type: "H" });
    if (isLow) pivots.push({ idx: i, price: lo, type: "L" });
  }
  pivots.sort((a, b) => (a.idx - b.idx) || ((a.type === "H" ? 0 : 1) - (b.type === "H" ? 0 : 1)));
  return pivots;
}

function zigzagPivots(pivots) {
  const seq = [];
  for (const p of pivots) {
    if (!seq.length) { seq.push({ ...p }); continue; }
    const last = seq[seq.length - 1];
    if (p.type === last.type) {
      if (p.type === "H" && p.price >= last.price) seq[seq.length - 1] = { ...p };
      else if (p.type === "L" && p.price <= last.price) seq[seq.length - 1] = { ...p };
    } else {
      seq.push({ ...p });
    }
  }
  return seq;
}

function confirmBreak(rows, startIdx, level, direction, invalidateLevel) {
  const n = rows.length;
  const end = Math.min(n, startIdx + 1 + PAT.CONFIRM_MAX_BARS);
  for (let k = startIdx + 1; k < end; k += 1) {
    const c = rows[k].c;
    if (direction < 0) {
      if (invalidateLevel != null && c > invalidateLevel) return null;
      if (c < level) return k;
    } else {
      if (invalidateLevel != null && c < invalidateLevel) return null;
      if (c > level) return k;
    }
  }
  return null;
}

function lineAt(x0, y0, x1, y1, x) {
  if (x1 === x0) return y0;
  return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
}

function slopePctPts(points) {
  const n = points.length;
  if (n < 2) return 0;
  let mx = 0;
  let my = 0;
  for (const p of points) { mx += p[0]; my += p[1]; }
  mx /= n; my /= n;
  if (my === 0) return 0;
  let num = 0;
  let den = 0;
  for (const p of points) { num += (p[0] - mx) * (p[1] - my); den += (p[0] - mx) * (p[0] - mx); }
  const slope = den ? num / den : 0;
  return slope / my;
}

function detectDouble(rows, z) {
  const out = [];
  for (let i = 0; i < z.length - 2; i += 1) {
    const a = z[i];
    const b = z[i + 1];
    const c = z[i + 2];
    if (a.type === "H" && b.type === "L" && c.type === "H") {
      const top = (a.price + c.price) / 2;
      if (top > 0 && Math.abs(a.price - c.price) / top <= PAT.TOP_TOL
        && (top - b.price) / top >= PAT.TROUGH_MIN) {
        const neck = b.price;
        const ci = confirmBreak(rows, c.idx, neck, -1, Math.max(a.price, c.price));
        if (ci != null) out.push({ pattern: "double_top", dir: -1, confirm_idx: ci, neckline: neck,
          points: [{ idx: a.idx, price: a.price, label: "천장" }, { idx: b.idx, price: b.price, label: "" }, { idx: c.idx, price: c.price, label: "천장" }],
          necklinePts: [{ idx: a.idx, price: neck }, { idx: ci, price: neck }] });
      }
    }
    if (a.type === "L" && b.type === "H" && c.type === "L") {
      const bot = (a.price + c.price) / 2;
      if (bot > 0 && Math.abs(a.price - c.price) / bot <= PAT.TOP_TOL
        && (b.price - bot) / bot >= PAT.TROUGH_MIN) {
        const neck = b.price;
        const ci = confirmBreak(rows, c.idx, neck, +1, Math.min(a.price, c.price));
        if (ci != null) out.push({ pattern: "double_bottom", dir: +1, confirm_idx: ci, neckline: neck,
          points: [{ idx: a.idx, price: a.price, label: "바닥" }, { idx: b.idx, price: b.price, label: "" }, { idx: c.idx, price: c.price, label: "바닥" }],
          necklinePts: [{ idx: a.idx, price: neck }, { idx: ci, price: neck }] });
      }
    }
  }
  return out;
}

function detectHns(rows, z) {
  const out = [];
  for (let i = 0; i < z.length - 4; i += 1) {
    const p = z.slice(i, i + 5);
    const types = p.map((x) => x.type).join("");
    if (types === "HLHLH") {
      const [ls, t1, head, t2, rs] = p;
      if (head.price > ls.price && head.price > rs.price) {
        const sh = (ls.price + rs.price) / 2;
        if (sh > 0 && Math.abs(ls.price - rs.price) / sh <= PAT.SHOULDER_TOL
          && (head.price - sh) / sh >= PAT.HEAD_MIN) {
          const neck = lineAt(t1.idx, t1.price, t2.idx, t2.price, rs.idx);
          const ci = confirmBreak(rows, rs.idx, neck, -1, head.price);
          if (ci != null) out.push({ pattern: "hns", dir: -1, confirm_idx: ci, neckline: neck,
            points: [{ idx: ls.idx, price: ls.price, label: "좌어깨" }, { idx: t1.idx, price: t1.price, label: "" }, { idx: head.idx, price: head.price, label: "머리" }, { idx: t2.idx, price: t2.price, label: "" }, { idx: rs.idx, price: rs.price, label: "우어깨" }],
            necklinePts: [{ idx: t1.idx, price: t1.price }, { idx: ci, price: lineAt(t1.idx, t1.price, t2.idx, t2.price, ci) }] });
        }
      }
    } else if (types === "LHLHL") {
      const [ls, t1, head, t2, rs] = p;
      if (head.price < ls.price && head.price < rs.price) {
        const sh = (ls.price + rs.price) / 2;
        if (sh > 0 && Math.abs(ls.price - rs.price) / sh <= PAT.SHOULDER_TOL
          && (sh - head.price) / sh >= PAT.HEAD_MIN) {
          const neck = lineAt(t1.idx, t1.price, t2.idx, t2.price, rs.idx);
          const ci = confirmBreak(rows, rs.idx, neck, +1, head.price);
          if (ci != null) out.push({ pattern: "inv_hns", dir: +1, confirm_idx: ci, neckline: neck,
            points: [{ idx: ls.idx, price: ls.price, label: "좌어깨" }, { idx: t1.idx, price: t1.price, label: "" }, { idx: head.idx, price: head.price, label: "머리" }, { idx: t2.idx, price: t2.price, label: "" }, { idx: rs.idx, price: rs.price, label: "우어깨" }],
            necklinePts: [{ idx: t1.idx, price: t1.price }, { idx: ci, price: lineAt(t1.idx, t1.price, t2.idx, t2.price, ci) }] });
        }
      }
    }
  }
  return out;
}

function detectTriangle(rows, z) {
  const out = [];
  for (let end = 4; end < z.length; end += 1) {
    const window = z.slice(0, end + 1).filter((p) => z[end].idx - p.idx <= PAT.TRI_LOOKBACK);
    let highs = window.filter((p) => p.type === "H");
    let lows = window.filter((p) => p.type === "L");
    if (highs.length < 2 || lows.length < 2) continue;
    highs = highs.slice(-3);
    lows = lows.slice(-3);
    const sh = slopePctPts(highs.map((p) => [p.idx, p.price]));
    const sl = slopePctPts(lows.map((p) => [p.idx, p.price]));
    const res = highs.reduce((a, p) => a + p.price, 0) / highs.length;
    const sup = lows.reduce((a, p) => a + p.price, 0) / lows.length;
    if (res <= sup) continue;
    const lastIdx = Math.max(highs[highs.length - 1].idx, lows[lows.length - 1].idx);
    // 수렴 추세선(저항=고점선, 지지=저점선) 좌표 — 차트 도형용
    const triLines = [
      { pts: [{ idx: highs[0].idx, price: highs[0].price }, { idx: highs[highs.length - 1].idx, price: highs[highs.length - 1].price }] },
      { pts: [{ idx: lows[0].idx, price: lows[0].price }, { idx: lows[lows.length - 1].idx, price: lows[lows.length - 1].price }] },
    ];
    const flatH = Math.abs(sh) < PAT.FLAT_SLOPE;
    const flatL = Math.abs(sl) < PAT.FLAT_SLOPE;
    let pat = null;
    let direction = null;
    let neck = null;
    if (flatH && sl > PAT.FLAT_SLOPE) { pat = "ascending_triangle"; direction = +1; neck = highs[highs.length - 1].price; }
    else if (flatL && sh < -PAT.FLAT_SLOPE) { pat = "descending_triangle"; direction = -1; neck = lows[lows.length - 1].price; }
    else if (sh < -PAT.FLAT_SLOPE && sl > PAT.FLAT_SLOPE) {
      const ciUp = confirmBreak(rows, lastIdx, highs[highs.length - 1].price, +1, null);
      const ciDn = confirmBreak(rows, lastIdx, lows[lows.length - 1].price, -1, null);
      if (ciUp != null && (ciDn == null || ciUp <= ciDn)) {
        out.push({ pattern: "symmetrical_triangle", dir: +1, confirm_idx: ciUp, neckline: highs[highs.length - 1].price,
          lines: triLines, points: [{ idx: ciUp, price: highs[highs.length - 1].price, label: "돌파" }] });
      } else if (ciDn != null) {
        out.push({ pattern: "symmetrical_triangle", dir: -1, confirm_idx: ciDn, neckline: lows[lows.length - 1].price,
          lines: triLines, points: [{ idx: ciDn, price: lows[lows.length - 1].price, label: "이탈" }] });
      }
      continue;
    }
    if (pat != null) {
      const ci = confirmBreak(rows, lastIdx, neck, direction, null);
      if (ci != null) out.push({ pattern: pat, dir: direction, confirm_idx: ci, neckline: neck,
        lines: triLines, points: [{ idx: ci, price: neck, label: direction > 0 ? "돌파" : "이탈" }] });
    }
  }
  return out;
}

function detectSrBreakout(rows, pivots) {
  const out = [];
  const n = rows.length;
  const highs = pivots.filter((p) => p.type === "H");
  const lows = pivots.filter((p) => p.type === "L");
  let lastResBreak = -1;
  let lastSupBreak = -1;
  const hiDq = []; // 단조 감소(최댓값)
  const loDq = []; // 단조 증가(최솟값)
  let hp = 0;
  let lp = 0;
  for (let k = PAT.SR_LOOKBACK; k < n; k += 1) {
    while (hp < highs.length && highs[hp].idx < k - PAT.PIVOT_WIN) {
      const pr = highs[hp].price;
      while (hiDq.length && hiDq[hiDq.length - 1][1] <= pr) hiDq.pop();
      hiDq.push([highs[hp].idx, pr]);
      hp += 1;
    }
    while (lp < lows.length && lows[lp].idx < k - PAT.PIVOT_WIN) {
      const pr = lows[lp].price;
      while (loDq.length && loDq[loDq.length - 1][1] >= pr) loDq.pop();
      loDq.push([lows[lp].idx, pr]);
      lp += 1;
    }
    const loBound = k - PAT.SR_LOOKBACK;
    while (hiDq.length && hiDq[0][0] < loBound) hiDq.shift();
    while (loDq.length && loDq[0][0] < loBound) loDq.shift();

    const price = rows[k].c;
    const prev = rows[k - 1].c;
    if (hiDq.length) {
      const r = hiDq[0][1];
      if (prev <= r && r < price && k - lastResBreak > PAT.PIVOT_WIN) {
        out.push({ pattern: "resistance_breakout", dir: +1, confirm_idx: k, neckline: r,
          lines: [{ pts: [{ idx: Math.max(0, k - 30), price: r }, { idx: k, price: r }] }],
          points: [{ idx: k, price: r, label: "돌파" }] });
        lastResBreak = k;
      }
    }
    if (loDq.length) {
      const s = loDq[0][1];
      if (prev >= s && s > price && k - lastSupBreak > PAT.PIVOT_WIN) {
        out.push({ pattern: "support_breakdown", dir: -1, confirm_idx: k, neckline: s,
          lines: [{ pts: [{ idx: Math.max(0, k - 30), price: s }, { idx: k, price: s }] }],
          points: [{ idx: k, price: s, label: "이탈" }] });
        lastSupBreak = k;
      }
    }
  }
  return out;
}

function detectWedge(rows, z) {
  const out = [];
  for (let end = 4; end < z.length; end += 1) {
    const window = z.slice(0, end + 1).filter((p) => z[end].idx - p.idx <= PAT.TRI_LOOKBACK);
    let highs = window.filter((p) => p.type === "H");
    let lows = window.filter((p) => p.type === "L");
    if (highs.length < 2 || lows.length < 2) continue;
    highs = highs.slice(-3);
    lows = lows.slice(-3);
    const sh = slopePctPts(highs.map((p) => [p.idx, p.price]));
    const sl = slopePctPts(lows.map((p) => [p.idx, p.price]));
    const res = highs.reduce((a, p) => a + p.price, 0) / highs.length;
    const sup = lows.reduce((a, p) => a + p.price, 0) / lows.length;
    if (res <= sup) continue;

    const lastIdx = Math.max(highs[highs.length - 1].idx, lows[lows.length - 1].idx);
    
    let pat = null;
    let direction = null;
    let neck = null;
    
    const TOL = 0.001; // 0.1% 기울기
    if (sh < -TOL && sl < -TOL && sh < sl) {
      pat = "falling_wedge";
      direction = +1;
      neck = highs[highs.length - 1].price;
    } else if (sh > TOL && sl > TOL && sh < sl) {
      pat = "rising_wedge";
      direction = -1;
      neck = lows[lows.length - 1].price;
    }

    if (pat != null) {
      const ci = confirmBreak(rows, lastIdx, neck, direction, null);
      if (ci != null) {
        const wedgeLines = [
          { pts: [{ idx: highs[0].idx, price: highs[0].price }, { idx: highs[highs.length - 1].idx, price: highs[highs.length - 1].price }] },
          { pts: [{ idx: lows[0].idx, price: lows[0].price }, { idx: lows[lows.length - 1].idx, price: lows[lows.length - 1].price }] },
        ];
        out.push({
          pattern: pat,
          dir: direction,
          confirm_idx: ci,
          neckline: neck,
          lines: wedgeLines,
          points: [{ idx: ci, price: neck, label: direction > 0 ? "돌파" : "이탈" }]
        });
      }
    }
  }
  return out;
}

function detectBox(rows, z) {
  const out = [];
  for (let end = 4; end < z.length; end += 1) {
    const window = z.slice(0, end + 1).filter((p) => z[end].idx - p.idx <= 50);
    let highs = window.filter((p) => p.type === "H");
    let lows = window.filter((p) => p.type === "L");
    if (highs.length < 2 || lows.length < 2) continue;
    highs = highs.slice(-3);
    lows = lows.slice(-3);

    const avgH = highs.reduce((a, p) => a + p.price, 0) / highs.length;
    const avgL = lows.reduce((a, p) => a + p.price, 0) / lows.length;
    if (avgH <= avgL) continue;

    const sh = slopePctPts(highs.map((p) => [p.idx, p.price]));
    const sl = slopePctPts(lows.map((p) => [p.idx, p.price]));

    const FLAT_SLOPE = 0.003;
    if (Math.abs(sh) < FLAT_SLOPE && Math.abs(sl) < FLAT_SLOPE) {
      const hTol = highs.every((p) => Math.abs(p.price - avgH) / avgH < 0.02);
      const lTol = lows.every((p) => Math.abs(p.price - avgL) / avgL < 0.02);

      if (hTol && lTol) {
        const lastIdx = Math.max(highs[highs.length - 1].idx, lows[lows.length - 1].idx);
        const ciUp = confirmBreak(rows, lastIdx, avgH, +1, null);
        const ciDn = confirmBreak(rows, lastIdx, avgL, -1, null);

        const boxLines = [
          { pts: [{ idx: highs[0].idx, price: avgH }, { idx: Math.max(ciUp || 0, ciDn || 0, lastIdx), price: avgH }] },
          { pts: [{ idx: lows[0].idx, price: avgL }, { idx: Math.max(ciUp || 0, ciDn || 0, lastIdx), price: avgL }] }
        ];

        if (ciUp != null && (ciDn == null || ciUp <= ciDn)) {
          out.push({
            pattern: "box_breakout",
            dir: +1,
            confirm_idx: ciUp,
            neckline: avgH,
            lines: boxLines,
            points: [{ idx: ciUp, price: avgH, label: "상향돌파" }]
          });
        } else if (ciDn != null) {
          out.push({
            pattern: "box_breakdown",
            dir: -1,
            confirm_idx: ciDn,
            neckline: avgL,
            lines: boxLines,
            points: [{ idx: ciDn, price: avgL, label: "하향이탈" }]
          });
        }
      }
    }
  }
  return out;
}

function detectFlag(rows, z) {
  const out = [];
  for (let end = 3; end < z.length; end += 1) {
    const a = z[end - 3];
    const b = z[end - 2];
    const c = z[end - 1];
    const d = z[end];
    if (!a || !b || !c || !d) continue;

    const flagpoleRise = (b.price - a.price) / a.price;
    if (a.type === "L" && b.type === "H" && flagpoleRise >= 0.10) {
      if (c.type === "L" && d.type === "H") {
        if (d.price < b.price && c.price < b.price) {
          const channelTop = b.price;
          const ci = confirmBreak(rows, d.idx, channelTop, +1, null);
          if (ci != null) {
            const flagLines = [
              { pts: [{ idx: a.idx, price: a.price }, { idx: b.idx, price: b.price }] },
              { pts: [{ idx: b.idx, price: b.price }, { idx: d.idx, price: d.price }] }
            ];
            out.push({
              pattern: "bull_flag",
              dir: +1,
              confirm_idx: ci,
              neckline: channelTop,
              lines: flagLines,
              points: [{ idx: ci, price: channelTop, label: "깃발돌파" }]
            });
          }
        }
      }
    }

    const flagpoleDrop = (a.price - b.price) / a.price;
    if (a.type === "H" && b.type === "L" && flagpoleDrop >= 0.10) {
      if (c.type === "H" && d.type === "L") {
        if (d.price > b.price && c.price > b.price) {
          const channelBottom = b.price;
          const ci = confirmBreak(rows, d.idx, channelBottom, -1, null);
          if (ci != null) {
            const flagLines = [
              { pts: [{ idx: a.idx, price: a.price }, { idx: b.idx, price: b.price }] },
              { pts: [{ idx: b.idx, price: b.price }, { idx: d.idx, price: d.price }] }
            ];
            out.push({
              pattern: "bear_flag",
              dir: -1,
              confirm_idx: ci,
              neckline: channelBottom,
              lines: flagLines,
              points: [{ idx: ci, price: channelBottom, label: "깃발이탈" }]
            });
          }
        }
      }
    }
  }
  return out;
}

function detectTriple(rows, z) {
  const out = [];
  for (let i = 0; i < z.length - 4; i += 1) {
    const p = z.slice(i, i + 5);
    const types = p.map((x) => x.type).join("");
    
    if (types === "HLHLH") {
      const [t1, b1, t2, b2, t3] = p;
      const top = (t1.price + t2.price + t3.price) / 3;
      const diff1 = Math.abs(t1.price - t2.price) / top;
      const diff2 = Math.abs(t2.price - t3.price) / top;
      const diff3 = Math.abs(t1.price - t3.price) / top;
      const trough1 = (top - b1.price) / top;
      const trough2 = (top - b2.price) / top;

      if (diff1 <= 0.02 && diff2 <= 0.02 && diff3 <= 0.02 && trough1 >= 0.03 && trough2 >= 0.03) {
        const neck = Math.min(b1.price, b2.price);
        const ci = confirmBreak(rows, t3.idx, neck, -1, Math.max(t1.price, t2.price, t3.price));
        if (ci != null) {
          out.push({
            pattern: "triple_top",
            dir: -1,
            confirm_idx: ci,
            neckline: neck,
            points: [
              { idx: t1.idx, price: t1.price, label: "천장1" },
              { idx: t2.idx, price: t2.price, label: "천장2" },
              { idx: t3.idx, price: t3.price, label: "천장3" },
              { idx: b1.idx, price: b1.price, label: "" },
              { idx: b2.idx, price: b2.price, label: "" }
            ],
            necklinePts: [{ idx: t1.idx, price: neck }, { idx: ci, price: neck }]
          });
        }
      }
    }
    
    if (types === "LHLHL") {
      const [b1, t1, b2, t2, b3] = p;
      const bot = (b1.price + b2.price + b3.price) / 3;
      const diff1 = Math.abs(b1.price - b2.price) / bot;
      const diff2 = Math.abs(b2.price - b3.price) / bot;
      const diff3 = Math.abs(b1.price - b3.price) / bot;
      const peak1 = (t1.price - bot) / bot;
      const peak2 = (t2.price - bot) / bot;

      if (diff1 <= 0.02 && diff2 <= 0.02 && diff3 <= 0.02 && peak1 >= 0.03 && peak2 >= 0.03) {
        const neck = Math.max(t1.price, t2.price);
        const ci = confirmBreak(rows, b3.idx, neck, +1, Math.min(b1.price, b2.price, b3.price));
        if (ci != null) {
          out.push({
            pattern: "triple_bottom",
            dir: +1,
            confirm_idx: ci,
            neckline: neck,
            points: [
              { idx: b1.idx, price: b1.price, label: "바닥1" },
              { idx: b2.idx, price: b2.price, label: "바닥2" },
              { idx: b3.idx, price: b3.price, label: "바닥3" },
              { idx: t1.idx, price: t1.price, label: "" },
              { idx: t2.idx, price: t2.price, label: "" }
            ],
            necklinePts: [{ idx: b1.idx, price: neck }, { idx: ci, price: neck }]
          });
        }
      }
    }
  }
  return out;
}

function detectBroadening(rows, z) {
  const out = [];
  for (let end = 4; end < z.length; end += 1) {
    const window = z.slice(0, end + 1).filter((p) => z[end].idx - p.idx <= PAT.TRI_LOOKBACK);
    let highs = window.filter((p) => p.type === "H");
    let lows = window.filter((p) => p.type === "L");
    if (highs.length < 2 || lows.length < 2) continue;
    highs = highs.slice(-3);
    lows = lows.slice(-3);

    const sh = slopePctPts(highs.map((p) => [p.idx, p.price]));
    const sl = slopePctPts(lows.map((p) => [p.idx, p.price]));
    const res = highs.reduce((a, p) => a + p.price, 0) / highs.length;
    const sup = lows.reduce((a, p) => a + p.price, 0) / lows.length;
    if (res <= sup) continue;

    const lastIdx = Math.max(highs[highs.length - 1].idx, lows[lows.length - 1].idx);

    const FLAT_SLOPE = 0.001;
    if (sh > FLAT_SLOPE && sl < -FLAT_SLOPE) {
      const ciUp = confirmBreak(rows, lastIdx, highs[highs.length - 1].price, +1, null);
      const ciDn = confirmBreak(rows, lastIdx, lows[lows.length - 1].price, -1, null);

      const broadeningLines = [
        { pts: [{ idx: highs[0].idx, price: highs[0].price }, { idx: highs[highs.length - 1].idx, price: highs[highs.length - 1].price }] },
        { pts: [{ idx: lows[0].idx, price: lows[0].price }, { idx: lows[lows.length - 1].idx, price: lows[lows.length - 1].price }] }
      ];

      if (ciUp != null && (ciDn == null || ciUp <= ciDn)) {
        out.push({
          pattern: "broadening_triangle",
          dir: +1,
          confirm_idx: ciUp,
          neckline: highs[highs.length - 1].price,
          lines: broadeningLines,
          points: [{ idx: ciUp, price: highs[highs.length - 1].price, label: "돌파" }]
        });
      } else if (ciDn != null) {
        out.push({
          pattern: "broadening_triangle",
          dir: -1,
          confirm_idx: ciDn,
          neckline: lows[lows.length - 1].price,
          lines: broadeningLines,
          points: [{ idx: ciDn, price: lows[lows.length - 1].price, label: "이탈" }]
        });
      }
    }
  }
  return out;
}

function detectDiamond(rows, z) {
  const out = [];
  for (let i = 0; i < z.length - 6; i += 1) {
    const p = z.slice(i, i + 7);
    const range1 = Math.abs(p[1].price - p[0].price);
    const range3 = Math.abs(p[3].price - p[2].price);
    const range4 = Math.abs(p[4].price - p[3].price);
    const range6 = Math.abs(p[6].price - p[5].price);

    if (range3 > range1 && range6 < range4) {
      const lastIdx = p[6].idx;
      const highs = p.filter((x) => x.type === "H");
      const lows = p.filter((x) => x.type === "L");
      if (highs.length < 3 || lows.length < 3) continue;

      const resPrice = highs[highs.length - 1].price;
      const supPrice = lows[lows.length - 1].price;

      const ciUp = confirmBreak(rows, lastIdx, resPrice, +1, null);
      const ciDn = confirmBreak(rows, lastIdx, supPrice, -1, null);

      const diamondLines = [
        { pts: [{ idx: highs[0].idx, price: highs[0].price }, { idx: highs[1].idx, price: highs[1].price }] },
        { pts: [{ idx: highs[1].idx, price: highs[1].price }, { idx: highs[highs.length-1].idx, price: highs[highs.length-1].price }] },
        { pts: [{ idx: lows[0].idx, price: lows[0].price }, { idx: lows[1].idx, price: lows[1].price }] },
        { pts: [{ idx: lows[1].idx, price: lows[1].price }, { idx: lows[lows.length-1].idx, price: lows[lows.length-1].price }] }
      ];

      if (ciUp != null && (ciDn == null || ciUp <= ciDn)) {
        out.push({
          pattern: "diamond_top",
          dir: +1,
          confirm_idx: ciUp,
          neckline: resPrice,
          lines: diamondLines,
          points: [{ idx: ciUp, price: resPrice, label: "다이아돌파" }]
        });
      } else if (ciDn != null) {
        out.push({
          pattern: "diamond_bottom",
          dir: -1,
          confirm_idx: ciDn,
          neckline: supPrice,
          lines: diamondLines,
          points: [{ idx: ciDn, price: supPrice, label: "다이아이탈" }]
        });
      }
    }
  }
  return out;
}

function detectRoundingBottom(rows) {
  const out = [];
  const n = rows.length;
  const WIN = 40;
  if (n < WIN + 10) return out;

  for (let k = WIN; k < n; k += 5) {
    const slice = rows.slice(k - WIN, k);
    const xs = Array.from({ length: WIN }, (_, i) => i);
    const ys = slice.map((r) => r.l);

    let sumX = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0;
    let sumY = 0, sumXY = 0, sumX2Y = 0;
    for (let i = 0; i < WIN; i += 1) {
      const x = xs[i];
      const y = ys[i];
      const x2 = x * x;
      sumX += x;
      sumX2 += x2;
      sumX3 += x2 * x;
      sumX4 += x2 * x2;
      sumY += y;
      sumXY += x * y;
      sumX2Y += x2 * y;
    }
    
    const S = WIN;
    const det = S*(sumX2*sumX4 - sumX3*sumX3) - sumX*(sumX*sumX4 - sumX2*sumX3) + sumX2*(sumX*sumX3 - sumX2*sumX2);
    if (Math.abs(det) < 1e-5) continue;

    const detA = sumY*(sumX2*sumX4 - sumX3*sumX3) - sumX*(sumXY*sumX4 - sumX2Y*sumX3) + sumX2*(sumXY*sumX3 - sumX2Y*sumX2);
    const a = detA / det;

    const detB = S*(sumXY*sumX4 - sumX2Y*sumX3) - sumY*(sumX*sumX4 - sumX2*sumX3) + sumX2*(sumX*sumX2Y - sumXY*sumX2);
    const b = detB / det;
    const axis = -b / (2 * a);

    if (a > 0.005 && axis > WIN * 0.35 && axis < WIN * 0.65) {
      const startPrice = ys[0];
      const endPrice = ys[WIN - 1];
      const cupLip = Math.max(startPrice, endPrice);

      const ci = confirmBreak(rows, k - 1, cupLip, +1, null);
      if (ci != null && ci >= k) {
        const pts = [];
        for (let i = 0; i < WIN; i += 10) {
          const originalIdx = k - WIN + i;
          pts.push({ idx: originalIdx, price: ys[i] });
        }
        pts.push({ idx: k, price: ys[WIN - 1] });

        out.push({
          pattern: "rounding_bottom",
          dir: +1,
          confirm_idx: ci,
          neckline: cupLip,
          lines: [{ pts }],
          points: [{ idx: ci, price: cupLip, label: "라운딩돌파" }]
        });
      }
    }
  }
  return out;
}

function detectComplexHns(rows, z) {
  const out = [];
  for (let i = 0; i < z.length - 6; i += 1) {
    const p = z.slice(i, i + 7);
    const types = p.map((x) => x.type).join("");
    
    if (types === "HLHLHLH") {
      const [ls1, b1, head, b2, rs1, b3, rs2] = p;
      if (head.price > ls1.price && head.price > rs1.price && head.price > rs2.price) {
        const neck = Math.min(b1.price, b2.price, b3.price);
        const ci = confirmBreak(rows, rs2.idx, neck, -1, head.price);
        if (ci != null) {
          out.push({
            pattern: "complex_hns",
            dir: -1,
            confirm_idx: ci,
            neckline: neck,
            points: [
              { idx: ls1.idx, price: ls1.price, label: "좌어깨" },
              { idx: head.idx, price: head.price, label: "머리" },
              { idx: rs1.idx, price: rs1.price, label: "우어깨1" },
              { idx: rs2.idx, price: rs2.price, label: "우어깨2" }
            ],
            necklinePts: [{ idx: b1.idx, price: neck }, { idx: ci, price: neck }]
          });
        }
      }
    }

    if (types === "LHLHLHL") {
      const [ls1, t1, head, t2, rs1, t3, rs2] = p;
      if (head.price < ls1.price && head.price < rs1.price && head.price < rs2.price) {
        const neck = Math.max(t1.price, t2.price, t3.price);
        const ci = confirmBreak(rows, rs2.idx, neck, +1, head.price);
        if (ci != null) {
          out.push({
            pattern: "complex_hns",
            dir: +1,
            confirm_idx: ci,
            neckline: neck,
            points: [
              { idx: ls1.idx, price: ls1.price, label: "역좌어깨" },
              { idx: head.idx, price: head.price, label: "역머리" },
              { idx: rs1.idx, price: rs1.price, label: "역우어깨1" },
              { idx: rs2.idx, price: rs2.price, label: "역우어깨2" }
            ],
            necklinePts: [{ idx: t1.idx, price: neck }, { idx: ci, price: neck }]
          });
        }
      }
    }
  }
  return out;
}

function detectConfirmations(rows) {
  if (rows.length < PAT.PIVOT_WIN * 2 + 5) return [];
  const pivots = findPivots(rows);
  const z = zigzagPivots(pivots);
  let events = [];
  events = events.concat(
    detectDouble(rows, z),
    detectHns(rows, z),
    detectTriangle(rows, z),
    detectSrBreakout(rows, pivots),
    detectWedge(rows, z),
    detectBox(rows, z),
    detectFlag(rows, z),
    detectTriple(rows, z),
    detectBroadening(rows, z),
    detectDiamond(rows, z),
    detectRoundingBottom(rows),
    detectComplexHns(rows, z),
    ...(window.MirPatternExt ? window.MirPatternExt.detectAll(rows, z, pivots, { confirmBreak, slopePctPts, PAT }) : [])
  );
  const seen = new Set();
  const uniq = [];
  events.sort((a, b) => a.confirm_idx - b.confirm_idx);
  for (const e of events) {
    const key = `${e.pattern}@${e.confirm_idx}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(e);
  }
  return uniq;
}

function detectCurrentPatterns(rows) {
  const n = rows.length;
  const evs = detectConfirmations(rows).filter((e) => n - 1 - e.confirm_idx < PAT.RECENT_WINDOW);
  evs.sort((a, b) => b.confirm_idx - a.confirm_idx);
  return evs;
}

function analyzeIndividualPatternPerformance(cleanRows, patternName, horizon) {
  const n = cleanRows.length;
  const allEvents = detectConfirmations(cleanRows);
  const matchedEvents = allEvents.filter((e) => e.pattern === patternName);
  
  let totalCount = 0;
  let upCount = 0;
  let returnsSum = 0;

  for (const ev of matchedEvents) {
    const idx = ev.confirm_idx;
    if (idx + horizon < n) {
      const priceNow = cleanRows[idx].c;
      const priceFuture = cleanRows[idx + horizon].c;
      const ret = (priceFuture - priceNow) / priceNow;
      totalCount += 1;
      if (ret > 0) upCount += 1;
      returnsSum += ret;
    }
  }

  if (totalCount === 0) return null;
  return {
    n: totalCount,
    up_rate: (upCount / totalCount) * 100,
    avg_ret: (returnsSum / totalCount) * 100
  };
}

// 패턴 목표가(Measured Move) — 넥라인 ± 패턴 높이
function computeMeasuredMove(rows, ev) {
  if (!ev || ev.neckline == null) return null;
  const pts = ev.points || [];
  if (!pts.length) return { target: ev.neckline, note: "넥라인 기준" };
  const prices = pts.map((p) => p.price).filter((x) => Number.isFinite(x));
  if (!prices.length) return null;
  const extreme = ev.dir > 0 ? Math.min(...prices) : Math.max(...prices);
  const height = Math.abs(ev.neckline - extreme);
  const target = ev.dir > 0 ? ev.neckline + height : ev.neckline - height;
  return { target, height, extreme, note: "넥라인 ± 패턴 높이" };
}

// 확정 후 넥라인 재이탈 = 패턴 실패
function checkPatternFailure(rows, ev, win = 15) {
  if (!ev || ev.neckline == null) return false;
  const n = rows.length;
  const start = ev.confirm_idx + 1;
  const end = Math.min(n, start + win);
  for (let k = start; k < end; k += 1) {
    const c = rows[k].c;
    if (ev.dir > 0 && c < ev.neckline) return true;
    if (ev.dir < 0 && c > ev.neckline) return true;
  }
  return false;
}

// 동시에 감지된 패턴 방향 일치도
function computeConfluence(cards) {
  if (!cards || !cards.length) return { score: 0, bull: 0, bear: 0, label: "패턴 없음" };
  let bull = 0, bear = 0;
  for (const c of cards) {
    const w = c.stat && c.stat.n >= 100 ? 1.2 : 1;
    if (c.nominalDir > 0) bull += w;
    else if (c.nominalDir < 0) bear += w;
  }
  const total = bull + bear;
  const score = total ? Math.round((Math.max(bull, bear) / total) * 100) : 0;
  let label = "혼조";
  if (score >= 75 && bull > bear) label = "강한 상승 중첩";
  else if (score >= 75 && bear > bull) label = "강한 하락 중첩";
  else if (score >= 55) label = bull >= bear ? "약한 상승 중첩" : "약한 하락 중첩";
  return { score, bull, bear, label };
}

// 감지된 현재 패턴 + 과거 통계 → 신호 + 카드 정보
function patternSignals(rows, horizon, stats, opts) {
  opts = opts || {};
  const result = { signals: [], cards: [] };
  if (!stats || !stats.patterns) return result;
  const cur = detectCurrentPatterns(rows);
  const hKey = String(horizon);
  for (const ev of cur) {
    const pstat = stats.patterns[ev.pattern];
    if (!pstat || !pstat[hKey]) continue;
    const s = pstat[hKey];
    const barsAgo = rows.length - 1 - ev.confirm_idx;
    const dir = Math.max(-1, Math.min(1, (s.up_rate - 50) / 8));
    result.signals.push({
      label: `패턴: ${PATTERN_LABELS[ev.pattern] || ev.pattern}`,
      dir,
      weight: 1.0,
      detail: `과거 ${s.n.toLocaleString()}건 중 ${s.up_rate.toFixed(0)}% 상승 (${barsAgo === 0 ? "오늘" : barsAgo + "봉 전"} 확정)`,
    });
    const indyStat = analyzeIndividualPatternPerformance(rows, ev.pattern, horizon);
    const useIndy = opts.statsMode === "individual" && indyStat;
    const displayStat = useIndy ? { ...indyStat, edge: s.edge, n: indyStat.n, _source: "individual" } : { ...s, _source: "population" };
    result.cards.push({
      pattern: ev.pattern,
      label: PATTERN_LABELS[ev.pattern] || ev.pattern,
      nominalDir: ev.dir,
      barsAgo,
      stat: displayStat,
      popStat: s,
      indyStat,
      baseline: stats.baseline ? stats.baseline[hKey] : null,
      measuredMove: computeMeasuredMove(rows, ev),
      failed: checkPatternFailure(rows, ev),
      event: ev,
    });
  }
  result.confluence = computeConfluence(result.cards);
  return result;
}

// ===== 돌파 연속성 / 되돌림 셋업 (build_breakout_retest.py 로 검증한 엣지) =====
// 검증 결과: 상승 돌파는 약한 추세 지속 우위(+1~2%p), 하락 돌파는 오히려 반등 경향.
// 되돌림(retest)은 상승 돌파의 단기 진입 타이밍에 도움. → 표시용 카드(중복 신호 방지).
function detectBreakoutRetest(rows, horizon, stats) {
  if (!stats || !stats.directions) return null;
  const n = rows.length;
  const WIN = 20; // 최근 N봉 내 돌파만 '현재 셋업'으로 본다
  const evs = detectConfirmations(rows)
    .filter((e) => e.pattern === "resistance_breakout" || e.pattern === "support_breakdown")
    .filter((e) => n - 1 - e.confirm_idx <= WIN)
    .sort((a, b) => b.confirm_idx - a.confirm_idx);
  if (!evs.length) return null;
  const recent = evs[0];
  const price = rows[n - 1].c;
  const atr = windowAtr(rows);
  const barsSince = n - 1 - recent.confirm_idx;
  const isRetest = barsSince >= 1 && Math.abs(price - recent.neckline) <= atr; // 돌파선 재접촉
  const dirKey = recent.dir > 0 ? "up_break" : "down_break";
  const entry = isRetest ? "retest" : "breakout";
  const dd = stats.directions[dirKey];
  const s = dd && dd.entries && dd.entries[entry] && dd.entries[entry][String(horizon)];
  if (!s) return null;
  return { dir: recent.dir, isRetest, barsSince, neckline: recent.neckline, stat: s };
}

// ===== 신호 합의 (Signal Consensus) =====
// 각 신호: { label, dir(-1..+1), weight, detail }
function buildSignals(rows) {
  const n = rows.length;
  const closes = rows.map((r) => r.c);
  const price = closes[n - 1];
  const signals = [];

  const sma20 = smaArray(closes, 20);
  const sma60 = smaArray(closes, 60);
  const sma120 = smaArray(closes, 120);
  const last = (arr) => arr[arr.length - 1];

  // 1. 이평선 배열 (정배열/역배열)
  {
    let score = 0;
    let parts = 0;
    if (last(sma20) != null) { score += price > last(sma20) ? 1 : -1; parts += 1; }
    if (last(sma20) != null && last(sma60) != null) { score += last(sma20) > last(sma60) ? 1 : -1; parts += 1; }
    if (last(sma60) != null && last(sma120) != null) { score += last(sma60) > last(sma120) ? 1 : -1; parts += 1; }
    const dir = parts ? score / parts : 0;
    signals.push({
      label: "이동평균선 배열",
      dir,
      weight: 1.4,
      detail: dir > 0.5 ? "정배열(상승 추세)" : dir < -0.5 ? "역배열(하락 추세)" : "혼조",
    });
  }

  // 2. 20일선 기울기 (추세 방향)
  {
    const sp = slopePct(closes, 20);
    const dir = Math.max(-1, Math.min(1, sp / 0.5)); // 일 0.5%면 강한 추세로 본다
    signals.push({
      label: "단기 추세 기울기",
      dir,
      weight: 1.0,
      detail: `20일 기준 일평균 ${sp >= 0 ? "+" : ""}${sp.toFixed(2)}%`,
    });
  }

  // 3. MACD 히스토그램
  {
    const { hist } = macdSeries(closes);
    const h = last(hist);
    const hPrev = hist[hist.length - 2];
    let dir = 0;
    let detail = "중립";
    if (h != null) {
      dir = Math.max(-1, Math.min(1, h / (price * 0.01))); // 가격 1% 규모로 정규화
      if (h > 0 && hPrev != null && hPrev <= 0) detail = "골든크로스 직후(강세 전환)";
      else if (h < 0 && hPrev != null && hPrev >= 0) detail = "데드크로스 직후(약세 전환)";
      else detail = h > 0 ? "0선 위(강세)" : "0선 아래(약세)";
    }
    signals.push({ label: "MACD", dir, weight: 1.1, detail });
  }

  // 4. RSI(14)
  {
    const rsi = last(rsiSeries(closes, 14));
    let dir = 0;
    let detail = "중립";
    if (rsi != null) {
      if (rsi >= 70) { dir = -0.5; detail = `과매수 ${rsi.toFixed(0)} (단기 부담)`; }
      else if (rsi <= 30) { dir = 0.6; detail = `과매도 ${rsi.toFixed(0)} (반등 기대)`; }
      else if (rsi >= 55) { dir = 0.5; detail = `${rsi.toFixed(0)} (상승 우위)`; }
      else if (rsi <= 45) { dir = -0.5; detail = `${rsi.toFixed(0)} (하락 우위)`; }
      else { dir = (rsi - 50) / 10; detail = `${rsi.toFixed(0)} (중립권)`; }
    }
    signals.push({ label: "RSI(14)", dir, weight: 1.0, detail });
  }

  // 5. 스토캐스틱
  {
    const { k, d } = stochArrays(rows, 14, 3);
    const kv = last(k);
    const dv = last(d);
    let dir = 0;
    let detail = "중립";
    if (kv != null && dv != null) {
      if (kv < 20) { dir = 0.4; detail = `과매도권 (K ${kv.toFixed(0)})`; }
      else if (kv > 80) { dir = -0.4; detail = `과매수권 (K ${kv.toFixed(0)})`; }
      else { dir = kv > dv ? 0.3 : -0.3; detail = `K ${kv.toFixed(0)} ${kv > dv ? ">" : "<"} D ${dv.toFixed(0)}`; }
    }
    signals.push({ label: "스토캐스틱", dir, weight: 0.7, detail });
  }

  // 6. 거래량 (OBV 20일 변화를 평균 거래량으로 정규화)
  {
    const obv = obvArray(rows);
    const win = 20;
    const recentVol = rows.slice(-win).reduce((a, r) => a + (r.v || 0), 0) / win || 1;
    const change = obv[n - 1] - (obv[n - 1 - win] ?? obv[0]);
    // 20일간 순매집 거래량이 평균 일거래량의 몇 배인지 → 방향/강도
    const ratio = change / (recentVol * win);
    const dir = Math.max(-1, Math.min(1, ratio * 2));
    signals.push({
      label: "거래량 흐름(OBV)",
      dir,
      weight: 0.8,
      detail: ratio > 0.05 ? "매집 우위(자금 유입)" : ratio < -0.05 ? "분산 우위(자금 유출)" : "중립",
    });
  }

  // 7. 볼린저 %B (밴드 내 위치)
  {
    const bb = bollinger(closes, 20, 2);
    const pb = last(bb.pctB);
    let dir = 0;
    let detail = "중립";
    if (pb != null) {
      if (pb > 1) { dir = -0.3; detail = "상단 돌파(과열 가능)"; }
      else if (pb < 0) { dir = 0.4; detail = "하단 이탈(반등 가능)"; }
      else { dir = (pb - 0.5) * 1.0; detail = `밴드 내 ${(pb * 100).toFixed(0)}% 위치`; }
    }
    signals.push({ label: "볼린저 밴드", dir, weight: 0.6, detail });
  }

  // 8. 모멘텀 (20일 ROC)
  {
    const roc = last(rocArray(closes, 20));
    let dir = 0;
    if (roc != null) dir = Math.max(-1, Math.min(1, roc / 10));
    signals.push({
      label: "모멘텀(20일)",
      dir,
      weight: 0.9,
      detail: roc != null ? `20일 수익률 ${roc >= 0 ? "+" : ""}${roc.toFixed(1)}%` : "데이터 부족",
    });
  }

  // 9. 52주 고저 위치
  {
    const win = closes.slice(-252);
    const hi = Math.max(...win);
    const lo = Math.min(...win);
    const pos = hi === lo ? 0.5 : (price - lo) / (hi - lo);
    const distHigh = ((hi - price) / price) * 100;
    let dir;
    if (pos > 0.9) dir = 0.5; // 신고가 근처 = 강한 종목
    else if (pos < 0.1) dir = -0.3;
    else dir = (pos - 0.5) * 0.8;
    signals.push({
      label: "52주 위치",
      dir,
      weight: 0.7,
      detail: `고점 대비 -${distHigh.toFixed(1)}% · 1년 범위 ${(pos * 100).toFixed(0)}%`,
    });
  }

  // 10. 캔들 패턴
  {
    const pats = detectCandlePatterns(rows);
    if (pats.length) {
      for (const p of pats) {
        signals.push({ label: `캔들: ${p.name}`, dir: p.dir, weight: p.weight, detail: "최근 봉 패턴" });
      }
    }
  }

  // 11. VWAP
  {
    const vwap = last(vwapArray(rows));
    if (vwap != null) {
      const dir = price > vwap ? 0.45 : price < vwap ? -0.45 : 0;
      signals.push({
        label: "VWAP",
        dir,
        weight: 0.85,
        detail: price > vwap ? `VWAP($${vwap.toFixed(2)}) 위` : price < vwap ? `VWAP($${vwap.toFixed(2)}) 아래` : "VWAP 부근",
      });
    }
  }

  // 12. Supertrend
  {
    const st = supertrendState(rows);
    if (st.line != null) {
      signals.push({
        label: "Supertrend",
        dir: st.bullish ? 0.7 : -0.7,
        weight: 1.0,
        detail: st.bullish ? `강세 추세 ($${st.line.toFixed(2)})` : `약세 추세 ($${st.line.toFixed(2)})`,
      });
    }
  }

  // 13. Ichimoku
  {
    const ichi = ichimokuArrays(rows);
    const t = last(ichi.tenkan);
    const k = last(ichi.kijun);
    const sa = last(ichi.spanA);
    const sb = last(ichi.spanB);
    let dir = 0;
    let detail = "중립";
    if (t != null && k != null) {
      if (t > k && price > Math.max(sa || 0, sb || 0)) { dir = 0.65; detail = "전환>기준선 + 구름 위"; }
      else if (t < k && price < Math.min(sa || Infinity, sb || Infinity)) { dir = -0.65; detail = "전환<기준선 + 구름 아래"; }
      else if (t > k) { dir = 0.35; detail = "전환선 > 기준선"; }
      else if (t < k) { dir = -0.35; detail = "전환선 < 기준선"; }
    }
    signals.push({ label: "Ichimoku", dir, weight: 0.95, detail });
  }

  // 14. 골든/데드크로스 (SMA20 × SMA60)
  {
    const s20 = sma20[n - 1];
    const s60 = sma60[n - 1];
    const s20p = sma20[n - 2];
    const s60p = sma60[n - 2];
    if (s20 != null && s60 != null) {
      let dir = s20 > s60 ? 0.5 : -0.5;
      let detail = s20 > s60 ? "SMA20 > SMA60" : "SMA20 < SMA60";
      if (s20p != null && s60p != null) {
        if (s20p <= s60p && s20 > s60) { dir = 0.75; detail = "골든크로스 직후"; }
        if (s20p >= s60p && s20 < s60) { dir = -0.75; detail = "데드크로스 직후"; }
      }
      signals.push({ label: "골든/데드크로스", dir, weight: 1.15, detail });
    }
  }

  // 15. +DI / -DI
  {
    const { plusDi, minusDi } = adxArrays(rows, 14);
    const pdi = last(plusDi);
    const mdi = last(minusDi);
    if (pdi != null && mdi != null) {
      const dir = Math.max(-1, Math.min(1, (pdi - mdi) / 25));
      signals.push({
        label: "+DI/-DI",
        dir,
        weight: 0.75,
        detail: `+DI ${pdi.toFixed(0)} / -DI ${mdi.toFixed(0)}`,
      });
    }
  }

  // 16. Williams %R
  {
    const w = last(williamsArray(rows, 14));
    if (w != null) {
      let dir = 0;
      let detail = `${w.toFixed(0)}`;
      if (w > -20) { dir = -0.4; detail += " (과매수)"; }
      else if (w < -80) { dir = 0.45; detail += " (과매도)"; }
      else dir = (w + 50) / 50;
      signals.push({ label: "Williams %R", dir, weight: 0.55, detail });
    }
  }

  // 17. CCI
  {
    const cci = last(cciArray(rows, 20));
    if (cci != null) {
      let dir = Math.max(-1, Math.min(1, cci / 150));
      let detail = cci.toFixed(0);
      if (cci > 100) detail += " (강세)";
      else if (cci < -100) detail += " (약세)";
      signals.push({ label: "CCI", dir, weight: 0.55, detail });
    }
  }

  // 18. TTM Squeeze
  {
    const sq = ttmSqueezeState(rows);
    let dir = 0;
    let detail = sq.squeezed ? "수축 중 (변동성 폭발 대기)" : "수축 해제";
    if (sq.fired) {
      const mom = last(rocArray(closes, 12));
      dir = mom != null && mom > 0 ? 0.55 : mom != null && mom < 0 ? -0.55 : 0;
      detail = "스퀴즈 해제 + 모멘텀 " + (mom >= 0 ? "상승" : "하락");
    } else if (sq.squeezed) dir = 0.1;
    signals.push({ label: "TTM Squeeze", dir, weight: sq.fired ? 1.0 : 0.5, detail });
  }

  // 19. CMF / MFI
  {
    const cmf = last(cmfArray(rows, 20));
    if (cmf != null) {
      const dir = Math.max(-1, Math.min(1, cmf * 5));
      signals.push({
        label: "CMF(수급)",
        dir,
        weight: 0.8,
        detail: cmf > 0.05 ? "자금 유입" : cmf < -0.05 ? "자금 유출" : `중립 (${cmf.toFixed(2)})`,
      });
    }
    const mfi = last(mfiArray(rows, 14));
    if (mfi != null) {
      let dir = 0;
      let detail = mfi.toFixed(0);
      if (mfi < 20) { dir = 0.4; detail += " (과매도)"; }
      else if (mfi > 80) { dir = -0.4; detail += " (과매수)"; }
      else dir = (mfi - 50) / 50;
      signals.push({ label: "MFI", dir, weight: 0.7, detail });
    }
  }

  // 20. Parabolic SAR
  {
    const ps = parabolicSarArray(rows);
    if (ps.values[n - 1] != null) {
      signals.push({
        label: "Parabolic SAR",
        dir: ps.bullish ? 0.5 : -0.5,
        weight: 0.65,
        detail: ps.bullish ? "SAR 아래 (상승 추세)" : "SAR 위 (하락 추세)",
      });
    }
  }

  // 21. 선형회귀 채널
  {
    const lr = linearRegressionChannel(rows);
    if (lr) {
      let dir = 0;
      let detail = "채널 중간";
      if (price > lr.upper) { dir = -0.35; detail = "상단 밴드 돌파(과열)"; }
      else if (price < lr.lower) { dir = 0.4; detail = "하단 밴드 이탈(반등 가능)"; }
      else dir = (price - lr.mid) / (lr.std || 1) * 0.3;
      signals.push({ label: "선형회귀 채널", dir, weight: 0.6, detail });
    }
  }

  // 22. 피벗 포인트
  {
    const pv = floorTraderPivots(rows);
    if (pv) {
      let dir = 0;
      let detail = `피벗 $${pv.pivot.toFixed(2)}`;
      if (price > pv.r1) { dir = 0.45; detail = `R1($${pv.r1.toFixed(2)}) 돌파`; }
      else if (price < pv.s1) { dir = -0.45; detail = `S1($${pv.s1.toFixed(2)}) 이탈`; }
      else if (price > pv.pivot) { dir = 0.2; detail += " 위"; }
      else { dir = -0.2; detail += " 아래"; }
      signals.push({ label: "피벗 포인트", dir, weight: 0.55, detail });
    }
  }

  // ADX는 방향이 아니라 "추세 강도" → 신뢰도 가중치로 별도 반환
  const { adx } = adxArrays(rows, 14);
  const adxVal = last(adx);

  return { signals, adxVal };
}

function williamsArray(rows, period = 14) {
  const out = Array(rows.length).fill(null);
  for (let i = period - 1; i < rows.length; i += 1) {
    const slice = rows.slice(i - period + 1, i + 1);
    const hi = Math.max(...slice.map((r) => r.h));
    const lo = Math.min(...slice.map((r) => r.l));
    out[i] = hi === lo ? -50 : ((hi - rows[i].c) / (hi - lo)) * -100;
  }
  return out;
}

function cciArray(rows, period = 20) {
  const typical = rows.map((r) => (r.h + r.l + r.c) / 3);
  const out = Array(rows.length).fill(null);
  for (let i = period - 1; i < rows.length; i += 1) {
    const chunk = typical.slice(i - period + 1, i + 1);
    const avg = chunk.reduce((a, b) => a + b, 0) / period;
    const meanDev = chunk.reduce((a, b) => a + Math.abs(b - avg), 0) / period;
    out[i] = meanDev ? (typical[i] - avg) / (0.015 * meanDev) : 0;
  }
  return out;
}

// dir 가중 평균 → 상승 확률(%). ADX(추세 강도)로 신호의 진폭을 조절.
function consensusProbability(signals, adxVal) {
  let wsum = 0;
  let wtot = 0;
  for (const s of signals) {
    wsum += s.dir * s.weight;
    wtot += s.weight;
  }
  const net = wtot ? wsum / wtot : 0; // -1..+1
  // 추세가 강할수록(ADX 높음) 신호를 더 신뢰 → 진폭 확대 (0.6~1.0배)
  const conf = adxVal == null ? 0.75 : Math.max(0.6, Math.min(1.0, 0.6 + (adxVal - 15) / 100));
  const scaled = net * conf;
  // 로지스틱풍 변환, 15~85%로 클램프(과신 방지)
  let prob = 50 + scaled * 38;
  prob = Math.max(15, Math.min(85, prob));
  return { up: prob, net, conf };
}

// ===== 과거 유사 상황 실측 (Backtest Base-Rate) =====
// 각 과거 시점의 상태 벡터를 만들고, 현재와 가까운 날들의 H일 뒤 결과를 집계.
function backtestBaseRate(rows, horizon) {
  const n = rows.length;
  const closes = rows.map((r) => r.c);
  const rsi = rsiSeries(closes, 14);
  const sma20 = smaArray(closes, 20);
  const sma60 = smaArray(closes, 60);
  const bb = bollinger(closes, 20, 2);
  const roc = rocArray(closes, 20);

  // 정규화된 상태 벡터: [RSI/100, 가격-SMA20 괴리, SMA20-SMA60 괴리, %B, ROC]
  function stateAt(i) {
    if (rsi[i] == null || sma20[i] == null || sma60[i] == null || bb.pctB[i] == null || roc[i] == null) return null;
    return [
      rsi[i] / 100,
      Math.max(-0.3, Math.min(0.3, (closes[i] - sma20[i]) / sma20[i])) / 0.3,
      Math.max(-0.3, Math.min(0.3, (sma20[i] - sma60[i]) / sma60[i])) / 0.3,
      Math.max(0, Math.min(1, bb.pctB[i])),
      Math.max(-1, Math.min(1, roc[i] / 20)),
    ];
  }

  const cur = stateAt(n - 1);
  if (!cur) return null;

  // 과거 후보: forward 결과를 알 수 있는 i (i + horizon < n), 그리고 최근 5거래일은 제외(중복 회피)
  const cand = [];
  for (let i = 120; i < n - horizon - 1; i += 1) {
    const st = stateAt(i);
    if (!st) continue;
    let dist = 0;
    for (let k = 0; k < cur.length; k += 1) dist += (st[k] - cur[k]) * (st[k] - cur[k]);
    dist = Math.sqrt(dist);
    const fwd = (closes[i + horizon] - closes[i]) / closes[i];
    cand.push({ dist, fwd });
  }
  if (cand.length < 30) return null;

  cand.sort((a, b) => a.dist - b.dist);
  // 가장 유사한 상위 K개(최소 30, 전체의 12% 중 큰 값)
  const K = Math.max(30, Math.round(cand.length * 0.12));
  const top = cand.slice(0, K);
  let upCount = 0;
  let sumFwd = 0;
  let best = -Infinity;
  let worst = Infinity;
  for (const m of top) {
    if (m.fwd > 0) upCount += 1;
    sumFwd += m.fwd;
    best = Math.max(best, m.fwd);
    worst = Math.min(worst, m.fwd);
  }
  return {
    samples: top.length,
    upProb: (upCount / top.length) * 100,
    avgReturn: (sumFwd / top.length) * 100,
    best: best * 100,
    worst: worst * 100,
  };
}

// ===== 종합 =====
// 코어: OHLCV 행 배열({o,h,l,c,v,d})을 받아 분석 결과를 만든다.
// app.js(대시보드 차트)는 이미 같은 형식의 행을 갖고 있으므로 이 함수를 직접 부른다.
function analyzeRows(rows, horizon, meta) {
  meta = meta || {};
  const clean = (rows || []).filter((r) => r && Number.isFinite(r.c) && r.c > 0);
  if (clean.length < 60) {
    return { error: "insufficient", bars: clean.length };
  }

  const price = clean[clean.length - 1].c;
  const { signals, adxVal } = buildSignals(clean);
  const pat = patternSignals(clean, horizon, patternStats, meta);
  for (const s of pat.signals) signals.push(s);

  const mtf = buildMultiTimeframeContext(clean);
  if (mtf.bias !== 0) {
    signals.push({
      label: "다중 타임프레임",
      dir: mtf.bias,
      weight: 1.2 * mtf.alignment,
      detail: mtf.label,
    });
  }

  const shortData = meta.ticker ? getShortInterest(meta.ticker) : null;
  let shortSqueeze = null;
  if (shortData && shortData.daysToCover != null) {
    const dtc = shortData.daysToCover;
    const bullPat = (pat.confluence && pat.confluence.bull > pat.confluence.bear) || false;
    if (dtc >= 5) {
      const dir = bullPat ? 0.55 : 0.15;
      signals.push({
        label: "공매도(숏)",
        dir,
        weight: Math.min(1.3, 0.5 + dtc / 10),
        detail: `커버 ${dtc.toFixed(1)}일${bullPat ? " + 강세 패턴 (스퀴즈 셋업)" : ""}`,
      });
      if (dtc >= 5 && bullPat) {
        shortSqueeze = { daysToCover: dtc, setup: true, changePct: shortData.changePct };
      }
    } else if (dtc <= 2) {
      signals.push({ label: "공매도(숏)", dir: -0.1, weight: 0.3, detail: `커버 ${dtc.toFixed(1)}일 (낮음)` });
    }
  }

  let consensus = consensusProbability(signals, adxVal);
  if (mtf.alignment >= 0.55 && mtf.bias !== 0) {
    const boost = mtf.bias * mtf.alignment * 2.5;
    consensus = { ...consensus, up: Math.max(12, Math.min(88, consensus.up + boost)) };
  }

  const base = clean.length >= 250 ? backtestBaseRate(clean, horizon) : null;
  const sr = srSummary(clean);
  const breakout = detectBreakoutRetest(clean, horizon, breakoutStats);
  const techLevels = computeTechnicalLevels(clean, price);
  const gapFill = computeGapFillStats(clean);
  const optionsContext = estimateOptionsContext(price, clean);
  const institutionalFlow = meta.ticker ? institutionalFlowForTicker(meta.ticker) : null;

  let headlineUp;
  if (base && base.samples >= 40) {
    headlineUp = consensus.up * 0.5 + base.upProb * 0.5;
  } else {
    headlineUp = consensus.up;
  }
  headlineUp = Math.max(12, Math.min(88, headlineUp));

  return {
    ticker: meta.ticker,
    company: meta.company,
    bars: clean.length,
    lastDate: clean[clean.length - 1].d,
    price,
    horizon,
    consensus,
    signals,
    adxVal,
    base,
    sr,
    patterns: pat.cards,
    patternConfluence: pat.confluence,
    breakout,
    mtf,
    techLevels,
    shortSqueeze,
    shortData,
    gapFill,
    optionsContext,
    institutionalFlow,
    headlineUp,
    headlineDown: 100 - headlineUp,
  };
}

// detail json(chartSeries 배열) 진입점 — standalone 페이지용.
function analyzeTicker(detail, horizon) {
  const rows = (detail.chartSeries || [])
    .map((r) => ({ o: r[0], h: r[1], l: r[2], c: r[3], v: r[4] || 0, d: r[5] }));
  return analyzeRows(rows, horizon, { ticker: detail.ticker, company: detail.company });
}

// ===== UI =====
const HORIZONS = [
  { key: 5, label: "1주 (5거래일)" },
  { key: 20, label: "1개월 (20거래일)" },
  { key: 60, label: "3개월 (60거래일)" },
];
let currentHorizon = 20;
let currentDetail = null;
let patternStats = null; // data/pattern_stats.json (오프라인 집계 결과)
let breakoutStats = null; // data/breakout_retest_stats.json (돌파 연속성/되돌림 통계)

function $(id) { return document.getElementById(id); }

let statsPromise = null;
async function loadPatternStats() {
  try {
    const res = await fetch("data/pattern_stats.json", { cache: "no-store" });
    if (res.ok) patternStats = await res.json();
  } catch (e) {
    patternStats = null; // 없으면 패턴 섹션만 생략, 나머지 분석은 정상 동작
  }
  return patternStats;
}

async function loadBreakoutStats() {
  try {
    const res = await fetch("data/breakout_retest_stats.json", { cache: "no-store" });
    if (res.ok) breakoutStats = await res.json();
  } catch (e) {
    breakoutStats = null;
  }
  return breakoutStats;
}

// 통계는 한 번만 받아 캐시한다(대시보드/standalone 공용).
function ensureStats() {
  if (!statsPromise) statsPromise = Promise.all([loadPatternStats(), loadBreakoutStats()]);
  return statsPromise;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function loadDetail(ticker) {
  const key = String(ticker).trim().toUpperCase();
  if (!key) return null;
  const res = await fetch(`data/details/${encodeURIComponent(key)}.json`, { cache: "no-store" });
  if (!res.ok) throw new Error("not_found");
  return res.json();
}

function gaugeColor(up) {
  if (up >= 60) return "var(--pos, #138a4d)";
  if (up <= 40) return "var(--neg, #c03535)";
  return "var(--amber, #b7791f)";
}

function verdictText(up) {
  if (up >= 65) return "상승 우위";
  if (up >= 55) return "약한 상승 우위";
  if (up > 45) return "중립 (방향성 불분명)";
  if (up > 35) return "약한 하락 우위";
  return "하락 우위";
}

function renderPatternCard(result) {
  const cards = result.patterns || [];
  if (!patternStats) return ""; // 통계 파일이 없으면 섹션 생략
  if (!cards.length) {
    return `<div class="card">
      <h3>③ 차트 패턴 <span class="muted">(최근 ${PAT.RECENT_WINDOW}봉)</span></h3>
      <p class="muted">최근 확정된 고전 차트 패턴(쌍바닥·헤드앤숄더·삼각수렴·돌파 등)이 없습니다.</p>
    </div>`;
  }
  const rows = cards.map((c) => {
    const up = c.stat.up_rate;
    const edge = c.stat.edge;
    const dirWord = c.nominalDir > 0 ? "상승형" : c.nominalDir < 0 ? "하락형" : "중립형";
    const edgeStr = edge == null ? "" :
      `<span class="pat-edge ${edge >= 0 ? "pos" : "neg"}">시장 대비 ${edge >= 0 ? "+" : ""}${edge.toFixed(1)}%p</span>`;
    const srcLabel = c.stat && c.stat._source === "individual" ? "종목 실측" : "전체 통계";
    const indyStr = c.indyStat && c.stat && c.stat._source === "population" ?
      `<span style="display:block; margin-top:4px; color:var(--muted); font-size:12px;">이 종목 과거 실측: <b>${c.indyStat.n}회</b> 발생 중 <b>${c.indyStat.up_rate.toFixed(0)}%</b> 상승 (평균 <b>${c.indyStat.avg_ret >= 0 ? "+" : ""}${c.indyStat.avg_ret.toFixed(1)}%</b>)</span>` : "";
    const failStr = c.failed ? `<span class="pat-tag" style="background:var(--tint-neg);color:var(--tint-neg-fg);border-color:var(--neg)">패턴 실패</span>` : "";
    const targetStr = c.measuredMove && Number.isFinite(c.measuredMove.target) ?
      `<span style="display:block; margin-top:4px; color:var(--muted); font-size:12px;">🎯 목표가 추정: <b>$${c.measuredMove.target.toFixed(2)}</b> <span class="muted">(${c.measuredMove.note})</span></span>` : "";
    return `<div class="pat-item">
      <div class="pat-head">
        <span class="pat-name">${escapeHtml(c.label)}</span>
        <span class="pat-tag">${dirWord}</span>
        <span class="pat-tag muted">${srcLabel}</span>
        ${failStr}
        <span class="pat-when muted">${c.barsAgo === 0 ? "오늘 확정" : c.barsAgo + "봉 전 확정"}</span>
      </div>
      <p class="pat-stat">과거 같은 패턴 <b>${c.stat.n.toLocaleString()}건</b> 중
        <b style="color:${gaugeColor(up)}">${up.toFixed(0)}%</b>가 ${result.horizon}거래일 뒤 상승
        · 평균 <b style="color:${c.stat.avg_ret >= 0 ? "var(--pos)" : "var(--neg)"}">${c.stat.avg_ret >= 0 ? "+" : ""}${c.stat.avg_ret.toFixed(1)}%</b>
        ${edgeStr}
        ${indyStr}
        ${targetStr}
      </p>
    </div>`;
  }).join("");
  return `<div class="card">
    <h3>③ 차트 패턴 <span class="muted">(최근 ${PAT.RECENT_WINDOW}봉 내 확정 · 전 종목 ${(patternStats.events_total || 0).toLocaleString()}건 풀링)</span></h3>
    ${rows}
    <p class="pat-note muted">※ 고전 패턴은 통계적으로 '약한 우위'에 그칩니다. 방향은 교과서 정의가 아니라 <b>과거 실측 상승률</b>로 표시했습니다.</p>
  </div>`;
}

function generateBriefing(result) {
  const up = result.headlineUp;
  const price = result.price;
  const signals = result.signals || [];
  
  let opinion = "";
  if (up >= 65) opinion = `종합 분석 결과 <strong>상승 우위 국면</strong>입니다. 기술적 지표와 과거 통계가 일관되게 긍정적인 방향을 가리키고 있습니다.`;
  else if (up >= 55) opinion = `종합 분석 결과 <strong>약한 상승 우위</strong> 상태입니다. 전반적인 추세는 우상향이나 단기 매물 소화 과정이 관찰됩니다.`;
  else if (up > 45) opinion = `종합 분석 결과 <strong>방향성이 불분명한 혼조 국면</strong>입니다. 주요 신호들이 서로 엇갈리고 있어 무리한 추격 매수보다는 관망이 유리할 수 있습니다.`;
  else if (up > 35) opinion = `종합 분석 결과 <strong>약한 하락 우위</strong> 상태입니다. 매수세가 점차 약해지고 있어 보수적인 리스크 관리가 필요합니다.`;
  else opinion = `종합 분석 결과 <strong>하락 우위 국면</strong>입니다. 추세 이탈 신호가 다수 감지되어 기술적 반등 시 비중을 조절하는 전략을 권장합니다.`;

  let supportReasons = [];
  let riskReasons = [];
  
  const maSig = signals.find(s => s.label === "이동평균선 배열");
  const rsiSig = signals.find(s => s.label.includes("RSI"));
  const macdSig = signals.find(s => s.label === "MACD");
  const volSig = signals.find(s => s.label.includes("OBV"));

  if (maSig) {
    if (maSig.dir > 0.5) supportReasons.push("이동평균선이 정배열되어 탄탄한 상승 추세를 지지하고 있습니다.");
    else if (maSig.dir < -0.5) riskReasons.push("이평선이 역배열 상태로 상단에 강한 저항 매물이 쌓여 있습니다.");
  }
  
  if (rsiSig) {
    if (rsiSig.dir < -0.4) riskReasons.push("RSI 지표가 과매수 구간에 진입하여 단기 조정 리스크가 존재합니다.");
    else if (rsiSig.dir > 0.5) supportReasons.push("RSI 지표가 과매도(침체)권에 있어 기술적 반등 가능성이 높습니다.");
  }

  if (macdSig) {
    if (macdSig.detail.includes("골든크로스")) supportReasons.push("MACD가 골든크로스를 기록하며 강세 전환 모멘텀이 포착되었습니다.");
    else if (macdSig.detail.includes("데드크로스")) riskReasons.push("MACD 데드크로스가 발생해 단기 하락 압력이 증가하고 있습니다.");
  }

  if (volSig) {
    if (volSig.dir > 0.1) supportReasons.push("OBV상 자금 유입(매집 우위) 흐름이 관찰되어 수급이 양호합니다.");
    else if (volSig.dir < -0.1) riskReasons.push("OBV상 매도 분산 흐름이 이어져 수급이 약화되고 있습니다.");
  }

  const pats = result.patterns || [];
  if (pats.length > 0) {
    const topPat = pats[0];
    const isBull = topPat.nominalDir > 0;
    if (isBull) {
      supportReasons.push(`최근 차트에서 <strong>${topPat.label}</strong> 패턴이 확정되어 추가 상승 에너지를 모으고 있습니다.`);
    } else {
      riskReasons.push(`최근 차트에서 <strong>${topPat.label}</strong> 패턴이 확정되어 기술적 하락 위험이 감지되었습니다.`);
    }
  }

  const vwapSig = signals.find((s) => s.label === "VWAP");
  if (vwapSig && vwapSig.dir > 0.3) supportReasons.push("VWAP 위에서 거래되어 기관·단기 매수세가 우위입니다.");
  const ichiSig = signals.find((s) => s.label === "Ichimoku");
  if (ichiSig && ichiSig.dir > 0.5) supportReasons.push("일목균형표상 구름 위 강세 구간입니다.");
  else if (ichiSig && ichiSig.dir < -0.5) riskReasons.push("일목균형표상 구름 아래 약세 구간입니다.");
  const sqSig = signals.find((s) => s.label === "TTM Squeeze");
  if (sqSig && sqSig.detail.includes("해제")) supportReasons.push("볼린저·켈트너 수축 해제로 변동성 확대 국면에 진입했습니다.");
  if (result.mtf && result.mtf.bias > 0.5) supportReasons.push(`주봉 추세와 일봉이 일치합니다 (${result.mtf.label}).`);
  else if (result.mtf && result.mtf.bias < -0.5) riskReasons.push(`주봉·일봉 추세가 하락 방향으로 일치합니다.`);
  if (result.shortSqueeze) supportReasons.push(`공매도 커버 ${result.shortSqueeze.daysToCover.toFixed(1)}일 + 강세 패턴으로 숏 스퀴즈 셋업이 관찰됩니다.`);

  let coreBrief = "";
  if (supportReasons.length > 0) {
    coreBrief += `<li>🟢 <strong>호재 요인:</strong> ${supportReasons.slice(0, 3).join(" ")}</li>`;
  }
  if (riskReasons.length > 0) {
    coreBrief += `<li>🔴 <strong>리스크 요인:</strong> ${riskReasons.slice(0, 3).join(" ")}</li>`;
  }

  const sr = result.sr || {};
  let strategy = "";
  if (sr.support && sr.resistance) {
    const distSup = ((price - sr.support) / price) * 100;
    const distRes = ((sr.resistance - price) / price) * 100;
    if (distSup < 3) {
      strategy = `현재 주가가 지지선($${sr.support.toFixed(2)}) 부근에 밀착해 있어 반등 타점이나 지지선 이탈 시 손절 기준으로 활용하기 적합한 구간입니다.`;
    } else if (distRes < 3) {
      strategy = `저항선($${sr.resistance.toFixed(2)})에 도달하여 돌파 여부 확인이 중요합니다. 돌파 시 추가 급등, 저항 시 비중 축소 타이밍입니다.`;
    } else {
      strategy = `주가가 지지선($${sr.support.toFixed(2)})과 저항선($${sr.resistance.toFixed(2)})의 박스권 중간에 위치해 있어 돌파 또는 지지 확인 후 진입하는 것이 안전합니다.`;
    }
  } else {
    strategy = "지지선과 저항선 데이터가 부족해 돌파 여부 위주의 실시간 차트 확인이 필요합니다.";
  }
  if (result.techLevels && result.techLevels.atr) {
    const a = result.techLevels.atr;
    strategy += ` ATR 기준 손절 $${a.stop.toFixed(2)}, 1차 목표 $${a.target.toFixed(2)} (리스크 약 ${a.riskPct.toFixed(1)}%).`;
  }

  return `
    <div class="cprob-briefing">
      <p class="cprob-briefing-opinion">💡 ${opinion}</p>
      <ul class="cprob-briefing-reasons" style="margin: 8px 0 12px; padding-left: 20px; list-style-type: none;">
        ${coreBrief}
      </ul>
      <p class="cprob-briefing-strategy" style="margin: 10px 0 0; border-top: 1px dashed var(--line); padding-top: 10px; font-size: 13px;">🎯 <strong>대응 전략:</strong> ${strategy}</p>
    </div>
  `;
}

// 결과 → HTML 문자열(순수 함수). analysis.html 과 대시보드 패널이 동일 마크업을 공유한다.
function buildResultHTML(result) {
  if (result.error === "insufficient") {
    return `<div class="notice">이 종목은 차트 데이터가 부족합니다(${result.bars}봉). 대형주·주요 종목을 입력해 주세요.</div>`;
  }
  const up = result.headlineUp;
  const down = result.headlineDown;
  const color = gaugeColor(up);

  const bullSignals = result.signals.filter((s) => s.dir > 0.15).sort((a, b) => b.dir * b.weight - a.dir * a.weight);
  const bearSignals = result.signals.filter((s) => s.dir < -0.15).sort((a, b) => a.dir * a.weight - b.dir * b.weight);
  const neutralSignals = result.signals.filter((s) => Math.abs(s.dir) <= 0.15);

  const signalRow = (s) => {
    const pct = Math.round(Math.abs(s.dir) * 100);
    const cls = s.dir > 0.15 ? "is-bull" : s.dir < -0.15 ? "is-bear" : "is-neutral";
    const arrow = s.dir > 0.15 ? "▲" : s.dir < -0.15 ? "▼" : "■";
    return `<div class="sig-row ${cls}">
      <span class="sig-arrow">${arrow}</span>
      <span class="sig-label">${escapeHtml(s.label)}</span>
      <span class="sig-detail">${escapeHtml(s.detail)}</span>
      <span class="sig-strength">${pct}%</span>
    </div>`;
  };

  const baseHtml = result.base ? `
    <div class="card">
      <h3>② 과거 유사 상황 실측 <span class="muted">(${result.horizon}거래일 뒤)</span></h3>
      <p class="base-line">지난 5년 중 <b>지금과 비슷한 기술적 상태</b>였던 <b>${result.base.samples}회</b> 가운데
        <b style="color:${gaugeColor(result.base.upProb)}">${result.base.upProb.toFixed(0)}%</b>가 ${result.horizon}거래일 뒤 상승했습니다.</p>
      <div class="base-stats">
        <div><span class="muted">평균 수익률</span><b style="color:${result.base.avgReturn >= 0 ? "var(--pos)" : "var(--neg)"}">${result.base.avgReturn >= 0 ? "+" : ""}${result.base.avgReturn.toFixed(1)}%</b></div>
        <div><span class="muted">최고</span><b style="color:var(--pos)">+${result.base.best.toFixed(0)}%</b></div>
        <div><span class="muted">최저</span><b style="color:var(--neg)">${result.base.worst.toFixed(0)}%</b></div>
      </div>
    </div>` : `
    <div class="card">
      <h3>② 과거 유사 상황 실측</h3>
      <p class="muted">유사 표본이 부족해 실측 확률을 계산하지 못했습니다(데이터 길이 부족).</p>
    </div>`;

  const patternHtml = renderPatternCard(result);
  const breakoutHtml = renderBreakoutCard(result);
  const briefingHtml = generateBriefing(result);
  const confluence = result.patternConfluence;
  const confluenceHtml = confluence && confluence.score > 0 ? `
    <div class="card cprob-confluence-card">
      <h3>패턴 중첩 점수</h3>
      <p class="base-line"><b style="color:${gaugeColor(confluence.bull >= confluence.bear ? 55 + confluence.score * 0.1 : 45 - confluence.score * 0.1)}">${confluence.score}%</b> 일치 · <b>${escapeHtml(confluence.label)}</b></p>
      <p class="muted" style="margin:0;font-size:12px;">강세 패턴 ${confluence.bull.toFixed(1)} / 약세 패턴 ${confluence.bear.toFixed(1)} (표본 가중)</p>
    </div>` : "";

  const sr = result.sr;
  const srHtml = `<div class="sr-line">
      <span>지지선 <b>${sr.support ? "$" + sr.support.toFixed(2) : "—"}</b></span>
      <span class="sr-cur">현재가 <b>$${result.price.toFixed(2)}</b></span>
      <span>저항선 <b>${sr.resistance ? "$" + sr.resistance.toFixed(2) : "—"}</b></span>
    </div>`;

  return `
    <div class="head-card">
      <div class="head-meta">
        <h2>${escapeHtml(result.ticker)} <span class="muted">${escapeHtml(result.company || "")}</span></h2>
        <p class="muted">기준일 ${escapeHtml(result.lastDate)} · 종가 $${result.price.toFixed(2)} · 분석 봉 ${result.bars}개</p>
      </div>
      <div class="verdict" style="color:${color}">${verdictText(up)}</div>
    </div>

    <div class="prob-wrap">
      <div class="prob-bar">
        <div class="prob-up" style="width:${up.toFixed(1)}%">상승 ${up.toFixed(0)}%</div>
        <div class="prob-down" style="width:${down.toFixed(1)}%">하락 ${down.toFixed(0)}%</div>
      </div>
      <p class="prob-caption">${result.horizon}거래일 기준 종합 추정 · 신호 합의 ${result.consensus.up.toFixed(0)}%${result.base ? ` / 과거 실측 ${result.base.upProb.toFixed(0)}%` : ""}</p>
    </div>

    <div class="cprob-tabs" role="tablist">
      <button type="button" class="cprob-tab-btn is-active" data-cptab="summary">📊 종합</button>
      <button type="button" class="cprob-tab-btn" data-cptab="pattern">🔍 패턴</button>
      <button type="button" class="cprob-tab-btn" data-cptab="flow">💧 수급·옵션</button>
      <button type="button" class="cprob-tab-btn" data-cptab="tech">📐 기술 심화</button>
    </div>

    <div class="cprob-tab-panel is-active" data-cptab="summary">
      <div class="card briefing-card" style="margin-bottom:14px; padding: 14px 16px;">
        <h3 style="margin: 0 0 10px; font-size: var(--fs-h3);">💡 AI 기술적 요약 브리핑</h3>
        ${briefingHtml}
      </div>
      <div class="grid2 cprob-top-grid">
        <div class="card">
          <h3>① 신호 합의 <span class="muted">(추세 강도 ADX ${result.adxVal != null ? result.adxVal.toFixed(0) : "—"})</span></h3>
          ${bullSignals.length ? `<div class="sig-group"><h4 class="bull">강세 신호</h4>${bullSignals.map(signalRow).join("")}</div>` : ""}
          ${bearSignals.length ? `<div class="sig-group"><h4 class="bear">약세 신호</h4>${bearSignals.map(signalRow).join("")}</div>` : ""}
          ${neutralSignals.length ? `<div class="sig-group"><h4 class="neu">중립</h4>${neutralSignals.map(signalRow).join("")}</div>` : ""}
        </div>
        ${baseHtml}
      </div>
    </div>

    <div class="cprob-tab-panel" data-cptab="pattern">
      ${patternHtml}
      ${breakoutHtml}
      ${confluenceHtml}
    </div>

    <div class="cprob-tab-panel" data-cptab="flow">
      ${renderInstitutionalFlowCard(result)}
      ${renderOptionsContextCard(result)}
      ${renderShortSqueezeCard(result)}
    </div>

    <div class="cprob-tab-panel" data-cptab="tech">
      ${renderMtfCard(result)}
      ${renderGapFillCard(result)}
      ${renderTechnicalLevelsCard(result)}
      <div class="card">
        <h3>지지 / 저항</h3>
        ${srHtml}
      </div>
    </div>

    <div class="disclaimer">
      ⚠️ 이 수치는 <b>과거 가격 패턴에 기반한 기술적 추정</b>일 뿐이며 미래 수익을 보장하지 않습니다.
      실적·금리·뉴스 등 펀더멘털 변수는 반영되지 않습니다. 투자 판단과 책임은 본인에게 있습니다.
    </div>
  `;
}

function renderTechnicalLevelsCard(result) {
  const tl = result.techLevels;
  if (!tl) return "";
  const parts = [];
  if (tl.atr) {
    parts.push(`<p class="pat-stat">🛡 <b>ATR 손절</b> (2ATR): <b style="color:var(--neg)">$${tl.atr.stop.toFixed(2)}</b> · 
      <b>목표</b> (1R): <b style="color:var(--pos)">$${tl.atr.target.toFixed(2)}</b> · 
      <b>목표</b> (2R): <b style="color:var(--pos)">$${tl.atr.target2.toFixed(2)}</b>
      <span class="muted"> (리스크 ${tl.atr.riskPct.toFixed(1)}%)</span></p>`);
  }
  if (tl.pivots) {
    const p = tl.pivots;
    parts.push(`<p class="pat-stat">📍 <b>피벗</b> P $${p.pivot.toFixed(2)} · R1 $${p.r1.toFixed(2)} · R2 $${p.r2.toFixed(2)} · S1 $${p.s1.toFixed(2)} · S2 $${p.s2.toFixed(2)}</p>`);
  }
  if (tl.fib && tl.fib.levels) {
    const f = Object.entries(tl.fib.levels).map(([k, v]) => `${k} $${v.toFixed(2)}`).join(" · ");
    parts.push(`<p class="pat-stat">📐 <b>피보나치</b> (60봉) ${f}</p>`);
  }
  if (tl.linreg) {
    parts.push(`<p class="pat-stat">📈 <b>선형회귀</b> 상단 $${tl.linreg.upper.toFixed(2)} · 중심 $${tl.linreg.mid.toFixed(2)} · 하단 $${tl.linreg.lower.toFixed(2)}</p>`);
  }
  if (tl.psar && tl.psar.values) {
    const ps = tl.psar.values[tl.psar.values.length - 1];
    if (ps != null) {
      parts.push(`<p class="pat-stat">🔶 <b>Parabolic SAR</b> $${ps.toFixed(2)} · ${tl.psar.bullish ? "상승 추세" : "하락 추세"}</p>`);
    }
  }
  if (!parts.length) return "";
  return `<div class="card tech-levels-card">
    <h3>기술적 레벨 · 리스크 프레임</h3>
    ${parts.join("")}
    <p class="pat-note muted">※ 피보나치·피벗·ATR 목표가는 참고용이며 투자 권유가 아닙니다.</p>
  </div>`;
}

function renderMtfCard(result) {
  const mtf = result.mtf;
  if (!mtf || mtf.alignment <= 0) return "";
  const color = mtf.bias > 0 ? "var(--pos)" : mtf.bias < 0 ? "var(--neg)" : "var(--muted)";
  const tfLine = (t, name) => t ? `<span>${name} <b>${escapeHtml(t.label)}</b></span>` : "";
  return `<div class="card mtf-card">
    <h3>다중 타임프레임 (일·주·월)</h3>
    <p class="base-line"><b style="color:${color}">${escapeHtml(mtf.label)}</b> · 일치도 <b>${(mtf.alignment * 100).toFixed(0)}%</b></p>
    <p class="muted mtf-tf-row" style="margin:6px 0 0;font-size:12px;display:flex;gap:12px;flex-wrap:wrap;">
      ${tfLine(mtf.daily, "일")}${tfLine(mtf.weekly, "주")}${tfLine(mtf.monthly, "월")}
    </p>
  </div>`;
}

function renderGapFillCard(result) {
  const g = result.gapFill;
  if (!g || !g.samples) return "";
  const rate = g.fillRate != null ? `${g.fillRate.toFixed(0)}%` : "—";
  const avg = g.avgFillBars != null ? `${g.avgFillBars.toFixed(0)}봉` : "—";
  const recent = (g.recent || []).map((z) => {
    const word = z.type === "up" ? "상승갭" : "하락갭";
    const st = z.filled ? `메움(${z.fillBars}봉)` : "미체결";
    return `<li>${word} $${z.lo.toFixed(2)}~$${z.hi.toFixed(2)} · ${st}</li>`;
  }).join("");
  return `<div class="card gap-fill-card">
    <h3>갭 메우기 통계</h3>
    <p class="base-line">과거 <b>${g.samples}</b>건 중 <b style="color:var(--primary)">${rate}</b>가 40봉 내 메워짐 · 평균 <b>${avg}</b></p>
    ${recent ? `<ul class="muted" style="margin:8px 0 0;padding-left:18px;font-size:12px;">${recent}</ul>` : ""}
  </div>`;
}

function renderOptionsContextCard(result) {
  const o = result.optionsContext;
  if (!o) return "";
  return `<div class="card options-card">
    <h3>옵션 맥스페인 · 감마 (추정)</h3>
    <p class="base-line">맥스페인 <b>$${o.maxPain.toFixed(2)}</b> · 콜월 <b>$${o.callWall.toFixed(2)}</b> · 풋월 <b>$${o.putWall.toFixed(2)}</b></p>
    <p class="muted" style="margin:0;font-size:12px;">${escapeHtml(o.note)}</p>
  </div>`;
}

function renderInstitutionalFlowCard(result) {
  const f = result.institutionalFlow;
  if (!f) return "";
  const inst = f.instCount ? `13F 보유 기관 <b>${f.instCount}</b>곳 · 합계 <b>$${f.totalValueM.toFixed(0)}M</b>${f.topInst ? ` (${escapeHtml(f.topInst)})` : ""}` : "13F 보유 기관 데이터 없음";
  const ins = f.insiderCount ? `내부자 거래 <b>${f.insiderCount}</b>건 · 순매수 편향 <b>${f.netBuyBias >= 0 ? "+" : ""}${f.netBuyBias}</b>` : "최근 내부자 거래 없음";
  const recent = (f.recent || []).map((r) => `<li>${escapeHtml(r)}</li>`).join("");
  return `<div class="card inst-flow-card">
    <h3>기관 · 내부자 수급</h3>
    <p class="pat-stat">${inst}</p>
    <p class="pat-stat">${ins}</p>
    ${recent ? `<ul class="muted" style="margin:6px 0 0;padding-left:18px;font-size:12px;">${recent}</ul>` : ""}
  </div>`;
}

function renderShortSqueezeCard(result) {
  if (!result.shortSqueeze) return "";
  const s = result.shortSqueeze;
  return `<div class="card squeeze-card">
    <h3>숏 스퀴즈 셋업</h3>
    <p class="base-line">공매도 커버 <b>${s.daysToCover.toFixed(1)}일</b> + <b>강세 패턴 중첩</b> → 기술적 스퀴즈 가능성</p>
    <p class="muted" style="margin:0;font-size:12px;">공매도 변화 ${s.changePct >= 0 ? "+" : ""}${(s.changePct || 0).toFixed(1)}% (최근 결산 기준)</p>
  </div>`;
}

function renderBreakoutCard(result) {
  if (!breakoutStats) return "";
  const b = result.breakout;
  if (!b) return "";
  const dirWord = b.dir > 0 ? "상승 돌파" : "하락 돌파";
  const phase = b.isRetest ? "되돌림(retest) 구간" : "돌파 직후";
  const cont = b.stat.cont_rate;
  const edge = b.stat.edge_vs_market;
  const contColor = edge != null && edge >= 0 ? "var(--pos)" : "var(--neg)";
  const edgeStr = edge == null ? "" :
    `<span class="pat-edge ${edge >= 0 ? "pos" : "neg"}">시장 대비 ${edge >= 0 ? "+" : ""}${edge.toFixed(1)}%p</span>`;
  return `<div class="card">
    <h3>④ 돌파 연속성 <span class="muted">(${b.barsSince}봉 전 ${dirWord} · ${phase})</span></h3>
    <p class="pat-stat">과거 같은 셋업 <b>${b.stat.n.toLocaleString()}건</b> 중
      <b style="color:${contColor}">${cont.toFixed(0)}%</b>가 ${result.horizon}거래일 뒤 ${b.dir > 0 ? "상승" : "하락"} 지속 ${edgeStr}</p>
    <p class="pat-note muted">※ 검증 결과: 상승 돌파는 약한 지속 우위, 하락 돌파는 오히려 반등 경향이 강합니다. 되돌림은 주로 단기 진입 타이밍에 도움.</p>
  </div>`;
}

function renderResult(result) {
  const el = $("result");
  if (!el) return;
  el.innerHTML = buildResultHTML(result);
}

async function runAnalysis(ticker) {
  const el = $("result");
  el.innerHTML = `<div class="notice">분석 중…</div>`;
  try {
    const detail = await loadDetail(ticker);
    currentDetail = detail;
    const result = analyzeTicker(detail, currentHorizon);
    renderResult(result);
    const url = new URL(window.location);
    url.searchParams.set("t", String(ticker).trim().toUpperCase());
    window.history.replaceState({}, "", url);
  } catch (e) {
    el.innerHTML = `<div class="notice err">"${escapeHtml(ticker)}" 종목 데이터를 찾을 수 없습니다. 티커를 정확히 입력했는지 확인해 주세요. (예: NVDA, AAPL, TSLA)</div>`;
  }
}

function rerenderHorizon() {
  if (!currentDetail) return;
  const result = analyzeTicker(currentDetail, currentHorizon);
  renderResult(result);
}

async function init() {
  const form = $("searchForm");
  if (!form) return; // standalone 분석 페이지가 아니면(예: 대시보드) UI 바인딩 생략
  await ensureStats();
  const input = $("tickerInput");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (input.value.trim()) runAnalysis(input.value);
  });

  document.querySelectorAll(".hz-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentHorizon = Number(btn.dataset.hz);
      document.querySelectorAll(".hz-btn").forEach((b) => b.classList.toggle("is-active", b === btn));
      rerenderHorizon();
    });
  });

  // URL ?t= 로 진입 시 자동 분석
  const params = new URLSearchParams(window.location.search);
  const t = params.get("t");
  if (t) { input.value = t.toUpperCase(); runAnalysis(t); }
}

document.addEventListener("DOMContentLoaded", init);

// 결과 패널 탭 전환 — 위임 방식이라 재렌더/양쪽 페이지(#result·#chartProbPanel)에서 모두 동작.
document.addEventListener("click", (e) => {
  const btn = e.target.closest && e.target.closest(".cprob-tab-btn");
  if (!btn) return;
  const scope = btn.closest("#result, #chartProbPanel") || document;
  const key = btn.dataset.cptab;
  scope.querySelectorAll(".cprob-tab-btn").forEach((b) => b.classList.toggle("is-active", b === btn));
  scope.querySelectorAll(".cprob-tab-panel").forEach((p) => p.classList.toggle("is-active", p.dataset.cptab === key));
});

// ===== 외부 노출 (대시보드 app.js 등에서 재사용) =====
window.MirProb = {
  analyzeRows,
  analyzeTicker,
  buildResultHTML,
  findSupportResistance,
  supportResistanceLevels,
  srSummary,
  detectCurrentPatterns,
  detectConfirmations,
  patternLabels: PATTERN_LABELS,
  computeMeasuredMove,
  checkPatternFailure,
  computeConfluence,
  computeTechnicalLevels,
  volumeProfileNodes,
  ttmSqueezeSeries,
  cmfArray,
  mfiArray,
  computeGapFillStats,
  estimateOptionsContext,
  institutionalFlowForTicker,
  chandelierExitArray,
  buildMultiTimeframeContext,
  ensureStats,
  gaugeColor,
  verdictText,
};
})();
