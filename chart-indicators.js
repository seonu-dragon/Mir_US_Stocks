// 이 파일은 app.js 에서 기계적으로 분리된 코드다 (refactor/appjs-split-stage1).
// 차트 지표 수학(resampling/SMA/EMA/RSI 등) + 지표 패널 렌더러 (원본 app.js 9428-9800, 10204-11656).
// index.html 에서 app.js 보다 먼저 로드되는 classic script. 최상위 function/let/const 는
// 전역 렉시컬 환경을 공유하므로 app.js 와 양방향 참조가 호출 시점에 해결된다.

// ----- Timeframe resampling (daily -> weekly / monthly) -----
function resampleBars(rows, tf) {
  if (tf !== "W" && tf !== "M") return rows;
  const keyFor = tf === "W" ? isoWeekKey : (d) => String(d).slice(0, 7);
  const groups = new Map();
  const order = [];
  for (const row of rows) {
    const key = keyFor(row.d || "");
    if (!groups.has(key)) {
      groups.set(key, { o: row.o, h: row.h, l: row.l, c: row.c, v: row.v || 0, d: row.d });
      order.push(key);
    } else {
      const g = groups.get(key);
      g.h = Math.max(g.h, row.h);
      g.l = Math.min(g.l, row.l);
      g.c = row.c;
      g.v += row.v || 0;
      g.d = row.d;
    }
  }
  return order.map((key) => groups.get(key));
}

function isoWeekKey(dateStr) {
  const parts = String(dateStr).split("-");
  if (parts.length < 3) return dateStr;
  const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const tmp = new Date(dt);
  tmp.setDate(tmp.getDate() + 4 - ((tmp.getDay() + 6) % 7)); // ISO: shift to Thursday
  const yearStart = new Date(tmp.getFullYear(), 0, 1);
  const week = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
  return `${tmp.getFullYear()}-W${week}`;
}

// ----- Indicator math -----
function pathFromSeries(values, xFor, yFor, color, strokeW, dash) {
  const pts = values.map((v, i) => (v == null || !Number.isFinite(v) ? null : [xFor(i), yFor(v)])).filter(Boolean);
  if (pts.length < 2) return "";
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${strokeW}"${dash ? ` stroke-dasharray="${dash}"` : ""} stroke-linecap="round"></path>`;
}

// 보이는 구간(rows)은 분석 컨텍스트(ctxRows)의 꼬리다. 컨텍스트에서 계산한 지표 배열을
// 보이는 길이(visN)만큼 잘라 xFor(0..visN-1)에 정렬한다 → 확대해도 이평/지표 좌측이 잘리지 않는다.
function lastN(arr, n) {
  return (n != null && Array.isArray(arr) && arr.length > n) ? arr.slice(arr.length - n) : arr;
}
function smaSeries(values, period) {
  const out = Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i += 1) {
    let s = 0;
    for (let j = i - period + 1; j <= i; j += 1) s += values[j];
    out[i] = s / period;
  }
  return out;
}

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

function emaArray(values, period) {
  const out = emaRaw(values, period);
  for (let i = 0; i < Math.min(period - 1, out.length); i += 1) out[i] = null;
  return out;
}

function bollinger(values, period, mult) {
  const mid = Array(values.length).fill(null);
  const upper = Array(values.length).fill(null);
  const lower = Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i += 1) {
    const chunk = values.slice(i - period + 1, i + 1);
    const m = chunk.reduce((a, b) => a + b, 0) / period;
    const variance = chunk.reduce((a, b) => a + (b - m) * (b - m), 0) / period;
    const sd = Math.sqrt(variance);
    mid[i] = m;
    upper[i] = m + mult * sd;
    lower[i] = m - mult * sd;
  }
  return { mid, upper, lower };
}

function macdSeries(values) {
  const fast = emaRaw(values, 12);
  const slow = emaRaw(values, 26);
  const macd = values.map((_, i) => fast[i] - slow[i]);
  const signal = emaRaw(macd, 9);
  const hist = macd.map((v, i) => v - signal[i]);
  const warm = Math.min(25, values.length);
  for (let i = 0; i < warm; i += 1) {
    macd[i] = null;
    signal[i] = null;
    hist[i] = null;
  }
  return { macd, signal, hist };
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

function vwapArray(rows) {
  const out = Array(rows.length).fill(null);
  let pv = 0;
  let volume = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const v = row.v || 0;
    const typical = (row.h + row.l + row.c) / 3;
    pv += typical * v;
    volume += v;
    out[i] = volume ? pv / volume : typical;
  }
  return out;
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

function keltnerChannels(rows, period = 20, mult = 2) {
  const closes = rows.map((row) => row.c);
  const mid = emaArray(closes, period);
  const atr = atrArray(rows, period);
  return {
    mid,
    upper: mid.map((v, i) => (v == null || atr[i] == null ? null : v + mult * atr[i])),
    lower: mid.map((v, i) => (v == null || atr[i] == null ? null : v - mult * atr[i]))
  };
}

function donchianChannels(rows, period = 20) {
  const upper = Array(rows.length).fill(null);
  const lower = Array(rows.length).fill(null);
  const mid = Array(rows.length).fill(null);
  for (let i = period - 1; i < rows.length; i += 1) {
    const slice = rows.slice(i - period + 1, i + 1);
    upper[i] = Math.max(...slice.map((row) => row.h));
    lower[i] = Math.min(...slice.map((row) => row.l));
    mid[i] = (upper[i] + lower[i]) / 2;
  }
  return { upper, lower, mid };
}

function ichimokuArrays(rows) {
  const midRange = (period) => {
    const out = Array(rows.length).fill(null);
    for (let i = period - 1; i < rows.length; i += 1) {
      const slice = rows.slice(i - period + 1, i + 1);
      out[i] = (Math.max(...slice.map((row) => row.h)) + Math.min(...slice.map((row) => row.l))) / 2;
    }
    return out;
  };
  const tenkan = midRange(9);
  const kijun = midRange(26);
  const spanB = midRange(52);
  const spanA = tenkan.map((v, i) => (v == null || kijun[i] == null ? null : (v + kijun[i]) / 2));
  return { tenkan, kijun, spanA, spanB };
}

function supertrendArray(rows, period = 10, mult = 3) {
  const atr = atrArray(rows, period);
  const out = Array(rows.length).fill(null);
  const upper = Array(rows.length).fill(null);
  const lower = Array(rows.length).fill(null);
  let trendUp = true;
  for (let i = 0; i < rows.length; i += 1) {
    if (atr[i] == null) continue;
    const hl2 = (rows[i].h + rows[i].l) / 2;
    const basicUpper = hl2 + mult * atr[i];
    const basicLower = hl2 - mult * atr[i];
    upper[i] = i && upper[i - 1] != null && rows[i - 1].c <= upper[i - 1]
      ? Math.min(basicUpper, upper[i - 1])
      : basicUpper;
    lower[i] = i && lower[i - 1] != null && rows[i - 1].c >= lower[i - 1]
      ? Math.max(basicLower, lower[i - 1])
      : basicLower;
    if (i && out[i - 1] != null) {
      if (trendUp && rows[i].c < lower[i]) trendUp = false;
      else if (!trendUp && rows[i].c > upper[i]) trendUp = true;
    } else {
      trendUp = rows[i].c >= hl2;
    }
    out[i] = trendUp ? lower[i] : upper[i];
  }
  return out;
}

function obvArray(rows) {
  const out = Array(rows.length).fill(null);
  let obv = 0;
  for (let i = 0; i < rows.length; i += 1) {
    if (!i) obv = rows[i].v || 0;
    else if (rows[i].c > rows[i - 1].c) obv += rows[i].v || 0;
    else if (rows[i].c < rows[i - 1].c) obv -= rows[i].v || 0;
    out[i] = obv;
  }
  return out;
}

function accumulationDistributionArray(rows) {
  const out = Array(rows.length).fill(null);
  let line = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const range = row.h - row.l;
    const multiplier = range ? (((row.c - row.l) - (row.h - row.c)) / range) : 0;
    line += multiplier * (row.v || 0);
    out[i] = line;
  }
  return out;
}

function rocArray(values, period = 12) {
  return values.map((value, i) => i < period || !values[i - period] ? null : ((value / values[i - period]) - 1) * 100);
}

function momentumArray(values, period = 10) {
  return values.map((value, i) => i < period ? null : value - values[i - period]);
}

function williamsArray(rows, period = 14) {
  const out = Array(rows.length).fill(null);
  for (let i = period - 1; i < rows.length; i += 1) {
    const slice = rows.slice(i - period + 1, i + 1);
    const hi = Math.max(...slice.map((row) => row.h));
    const lo = Math.min(...slice.map((row) => row.l));
    out[i] = hi === lo ? -50 : ((hi - rows[i].c) / (hi - lo)) * -100;
  }
  return out;
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
  const plusDi = rows.map((_, i) => atr[i] ? (100 * smoothPlus[i]) / atr[i] : null);
  const minusDi = rows.map((_, i) => atr[i] ? (100 * smoothMinus[i]) / atr[i] : null);
  const dx = rows.map((_, i) => {
    if (plusDi[i] == null || minusDi[i] == null || plusDi[i] + minusDi[i] === 0) return null;
    return 100 * Math.abs(plusDi[i] - minusDi[i]) / (plusDi[i] + minusDi[i]);
  });
  const adx = wilderArray(dx.map((v) => v ?? 0), period);
  for (let i = 0; i < period * 2 - 2 && i < adx.length; i += 1) adx[i] = null;
  return { adx, plusDi, minusDi };
}

function cciArray(rows, period = 20) {
  const typical = rows.map((row) => (row.h + row.l + row.c) / 3);
  const out = Array(rows.length).fill(null);
  for (let i = period - 1; i < rows.length; i += 1) {
    const chunk = typical.slice(i - period + 1, i + 1);
    const avg = chunk.reduce((sum, value) => sum + value, 0) / period;
    const meanDev = chunk.reduce((sum, value) => sum + Math.abs(value - avg), 0) / period;
    out[i] = meanDev ? (typical[i] - avg) / (0.015 * meanDev) : 0;
  }
  return out;
}

function renderChannelOverlay(upper, lower, mid, xFor, yFor, color) {
  return [
    pathFromSeries(upper, xFor, yFor, color, 1.1, "4 3"),
    pathFromSeries(lower, xFor, yFor, color, 1.1, "4 3"),
    pathFromSeries(mid, xFor, yFor, color, 1.0, "")
  ].join("");
}

function renderIchimokuOverlay(lines, xFor, yFor) {
  return [
    pathFromSeries(lines.spanA, xFor, yFor, "#22c55e", 1, "3 3"),
    pathFromSeries(lines.spanB, xFor, yFor, "#ef4444", 1, "3 3"),
    pathFromSeries(lines.tenkan, xFor, yFor, "#38bdf8", 1.2, ""),
    pathFromSeries(lines.kijun, xFor, yFor, "#f59e0b", 1.2, "")
  ].join("");
}

function finiteValues(values) {
  return values.filter((v) => v != null && Number.isFinite(v));
}

function panelDomain(series, fallback = [-1, 1]) {
  const vals = finiteValues(series.flatMap((s) => s.values || []));
  if (!vals.length) return fallback;
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (min === max) {
    min -= Math.abs(min || 1) * 0.05;
    max += Math.abs(max || 1) * 0.05;
  }
  return [min, max];
}

function renderLinePanel(series, xFor, x1, x2, top, height, title, options = {}) {
  const guideValues = options.guides || [];
  const domainSource = options.domain ? null : series.concat([{ values: guideValues }]);
  const [min, max] = options.domain || panelDomain(domainSource);
  const span = max - min || 1;
  const yFor = (value) => top + ((max - value) / span) * height;
  const guides = guideValues.map((value) => `
    <line x1="${x1}" y1="${yFor(value).toFixed(1)}" x2="${x2}" y2="${yFor(value).toFixed(1)}" class="rsi-guide"></line>
    <text x="${x2 + 44}" y="${(yFor(value) + 4).toFixed(1)}" text-anchor="end" class="chart-axis">${options.formatGuide ? options.formatGuide(value) : value}</text>
  `).join("");
  const paths = series.map((s) => pathFromSeries(s.values, xFor, yFor, s.color, s.width || 1.4, s.dash || "")).join("");
  const legend = series.map((s) => `<tspan fill="${s.color}">${escapeHtml(s.name)}</tspan>`).join("  ");
  return `
    <rect x="${x1}" y="${top}" width="${x2 - x1}" height="${height}" class="rsi-bg"></rect>
    ${guides}
    ${options.zeroLine && min < 0 && max > 0 ? `<line x1="${x1}" y1="${yFor(0).toFixed(1)}" x2="${x2}" y2="${yFor(0).toFixed(1)}" class="rsi-guide"></line>` : ""}
    ${paths}
    <text x="${x1 + 4}" y="${top + 12}" class="chart-axis">${escapeHtml(title)} ${legend}</text>
  `;
}

function stockByTicker(ticker) {
  const key = normalizeTickerKey(ticker);
  return (data.stocks || []).find((row) => normalizeTickerKey(row.ticker) === key) || null;
}


// ----- Indicator panels -----
function renderVolumePanel(rows, xFor, x1, x2, top, height, candleW) {
  const volumes = rows.map((row) => row.v || 0);
  const ma20 = smaSeries(volumes, 20);
  const maxSource = chartState.showVolMa20 ? volumes.concat(ma20.filter((v) => v != null)) : volumes;
  const volMax = Math.max(...maxSource, 1);
  const yFor = (value) => top + height - (value / volMax) * height;
  const bars = chartState.showVolume ? rows.map((row, index) => {
    const x = xFor(index) - candleW / 2;
    const h = Math.max(1, (row.v / volMax) * height);
    const up = row.c >= row.o;
    return `<rect x="${x.toFixed(1)}" y="${(top + height - h).toFixed(1)}" width="${candleW.toFixed(1)}" height="${h.toFixed(1)}" class="${up ? "vol-up" : "vol-down"}"></rect>`;
  }).join("") : "";
  const lastVol = volumes[volumes.length - 1] || 0;
  const recentAvg = finiteValues(ma20).slice(-1)[0] || (volumes.reduce((sum, value) => sum + value, 0) / Math.max(1, volumes.length));
  const ratioLabel = chartState.showVolumeRatio && recentAvg ? ` · Vol ${Number(lastVol / recentAvg).toFixed(2)}x` : "";
  return `
    <rect x="${x1}" y="${top}" width="${x2 - x1}" height="${height}" class="rsi-bg"></rect>
    ${bars}
    ${chartState.showVolMa20 ? pathFromSeries(ma20, xFor, yFor, "#facc15", 1.3, "") : ""}
    <text x="${x1 + 4}" y="${top + 12}" class="chart-axis">Volume${chartState.showVolMa20 ? " · MA20" : ""}${ratioLabel}</text>
  `;
}

function renderObvPanel(rows, xFor, x1, x2, top, height) {
  return renderLinePanel([{ name: "OBV", values: obvArray(rows), color: "#60a5fa" }], xFor, x1, x2, top, height, "OBV");
}

function renderAdPanel(rows, xFor, x1, x2, top, height) {
  return renderLinePanel([{ name: "A/D", values: accumulationDistributionArray(rows), color: "#34d399" }], xFor, x1, x2, top, height, "Accum/Dist");
}

function renderRocPanel(closes, xFor, x1, x2, top, height, visN) {
  return renderLinePanel([{ name: "ROC", values: lastN(rocArray(closes, 12), visN), color: "#38bdf8" }], xFor, x1, x2, top, height, "ROC(12)", { zeroLine: true, guides: [0] });
}

function renderMomentumPanel(closes, xFor, x1, x2, top, height, visN) {
  return renderLinePanel([{ name: "MOM", values: lastN(momentumArray(closes, 10), visN), color: "#f59e0b" }], xFor, x1, x2, top, height, "Momentum(10)", { zeroLine: true, guides: [0] });
}

function renderWilliamsPanel(rows, xFor, x1, x2, top, height, visN) {
  return renderLinePanel([{ name: "%R", values: lastN(williamsArray(rows, 14), visN), color: "#c084fc" }], xFor, x1, x2, top, height, "Williams %R(14)", { domain: [-100, 0], guides: [-20, -80] });
}

function renderAtrPanel(rows, xFor, x1, x2, top, height, visN) {
  return renderLinePanel([{ name: "ATR", values: lastN(atrArray(rows, 14), visN), color: "#fb7185" }], xFor, x1, x2, top, height, "ATR(14)");
}

function renderAdxPanel(rows, xFor, x1, x2, top, height, visN) {
  const adx = adxArrays(rows, 14);
  return renderLinePanel([
    { name: "ADX", values: lastN(adx.adx, visN), color: "#facc15", width: 1.5 },
    { name: "+DI", values: lastN(adx.plusDi, visN), color: "#22c55e", width: 1.2 },
    { name: "-DI", values: lastN(adx.minusDi, visN), color: "#ef4444", width: 1.2 }
  ], xFor, x1, x2, top, height, "ADX(14)", { domain: [0, 60], guides: [20, 40] });
}

function renderCciPanel(rows, xFor, x1, x2, top, height, visN) {
  return renderLinePanel([{ name: "CCI", values: lastN(cciArray(rows, 20), visN), color: "#818cf8" }], xFor, x1, x2, top, height, "CCI(20)", { zeroLine: true, guides: [-100, 0, 100] });
}

function cmfArray(rows, period = 20) {
  const fn = window.MirProb && window.MirProb.cmfArray;
  if (fn) return fn(rows, period);
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
  const fn = window.MirProb && window.MirProb.mfiArray;
  if (fn) return fn(rows, period);
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

function renderCmfPanel(rows, xFor, x1, x2, top, height, visN) {
  return renderLinePanel([{ name: "CMF", values: lastN(cmfArray(rows, 20), visN), color: "#2dd4bf" }], xFor, x1, x2, top, height, "CMF(20)", { domain: [-0.35, 0.35], zeroLine: true, guides: [-0.1, 0, 0.1] });
}

function renderMfiPanel(rows, xFor, x1, x2, top, height, visN) {
  return renderLinePanel([{ name: "MFI", values: lastN(mfiArray(rows, 14), visN), color: "#a78bfa" }], xFor, x1, x2, top, height, "MFI(14)", { domain: [0, 100], guides: [20, 50, 80] });
}

function ttmSqueezeSeries(rows) {
  const fn = window.MirProb && window.MirProb.ttmSqueezeSeries;
  if (fn) return fn(rows);
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

function renderTtmSqueezePanel(rows, xFor, x1, x2, top, height, candleW, visN) {
  const ttm = ttmSqueezeSeries(rows);
  const squeezed = lastN(ttm.squeezed, visN);
  const momentum = lastN(ttm.momentum, visN);
  const moms = momentum.filter((v) => v != null && Number.isFinite(v));
  const mMax = Math.max(...moms.map((v) => Math.abs(v)), 1);
  const bandH = height * 0.28;
  const momTop = top + bandH + 6;
  const momH = height - bandH - 8;
  const yForMom = (v) => momTop + momH * 0.5 - (v / mMax) * momH * 0.45;
  const zeroY = yForMom(0);
  const sqRects = squeezed.map((sq, i) => {
    if (!sq) return "";
    const x = xFor(i) - candleW / 2;
    return `<rect x="${x.toFixed(1)}" y="${(top + 2).toFixed(1)}" width="${candleW.toFixed(1)}" height="${bandH.toFixed(1)}" fill="rgba(250,204,21,0.32)" rx="1"></rect>`;
  }).join("");
  const momBars = momentum.map((v, i) => {
    if (v == null || !Number.isFinite(v)) return "";
    const y = Math.min(zeroY, yForMom(v));
    const h = Math.max(0.5, Math.abs(yForMom(v) - zeroY));
    return `<rect x="${(xFor(i) - candleW / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${candleW.toFixed(1)}" height="${h.toFixed(1)}" class="${v >= 0 ? "macd-hist-up" : "macd-hist-down"}"></rect>`;
  }).join("");
  const sqNow = squeezed[squeezed.length - 1];
  return `
    <rect x="${x1}" y="${top}" width="${x2 - x1}" height="${height}" class="rsi-bg"></rect>
    ${sqRects}
    <line x1="${x1}" y1="${zeroY.toFixed(1)}" x2="${x2}" y2="${zeroY.toFixed(1)}" class="rsi-guide"></line>
    ${momBars}
    <text x="${x1 + 4}" y="${top + 12}" class="chart-axis">TTM Squeeze · ${sqNow ? "수축 중" : "해제"} · Mom(12)</text>
  `;
}

function renderRelativePanel(item, rows, xFor, x1, x2, top, height) {
  const series = [];
  const [[b1, b1Label], [b2, b2Label]] = etfRsSecondaryBenchmarks();
  if (chartState.showRsSpy) {
    const bench = benchmarkRowsForTicker(b1);
    if (bench.length) series.push({ name: `RS/${b1Label}`, values: relativePerformanceSeries(rows, visibleRowsForBenchmark(bench, rows.length)), color: "#60a5fa" });
  }
  if (chartState.showRsQqq) {
    const bench = benchmarkRowsForTicker(b2);
    if (bench.length) series.push({ name: `RS/${b2Label}`, values: relativePerformanceSeries(rows, visibleRowsForBenchmark(bench, rows.length)), color: "#a78bfa" });
  }
  if (chartState.showRsSector) {
    const sectorTicker = sectorBenchmarkTickerForItem(item);
    const bench = sectorTicker ? benchmarkRowsForTicker(sectorTicker) : [];
    if (bench.length) series.push({ name: `RS/${sectorTicker}`, values: relativePerformanceSeries(rows, visibleRowsForBenchmark(bench, rows.length)), color: "#34d399" });
  }
  if (chartState.showMansfield) {
    const bench = benchmarkRowsForTicker(b1);
    if (bench.length) series.push({ name: "Mansfield", values: mansfieldSeries(rows, visibleRowsForBenchmark(bench, rows.length)), color: "#f59e0b", dash: "4 3" });
  }
  if (!series.length) {
    return `
      <rect x="${x1}" y="${top}" width="${x2 - x1}" height="${height}" class="rsi-bg"></rect>
      <text x="${x1 + 4}" y="${top + 14}" class="chart-axis">Relative Strength · benchmark data loading</text>
    `;
  }
  return renderLinePanel(series, xFor, x1, x2, top, height, "Relative Strength", { zeroLine: true, guides: [0], formatGuide: (v) => `${v}%` });
}

function renderComparePanel(item, rows, xFor, x1, x2, top, height) {
  requestCompareDetails(item);
  const series = [{
    name: item.ticker,
    values: indexedReturnSeries(rows),
    color: "#f8fafc",
    width: 1.5
  }];
  const colors = ["#60a5fa", "#34d399", "#f59e0b", "#f472b6", "#818cf8"];
  compareTickers.forEach((ticker, index) => {
    const bench = benchmarkRowsForTicker(ticker);
    if (!bench.length) return;
    series.push({
      name: ticker,
      values: indexedReturnSeries(alignBenchmarkRows(rows, visibleRowsForBenchmark(bench, rows.length))),
      color: colors[index % colors.length],
      width: 1.4
    });
  });
  return renderLinePanel(series, xFor, x1, x2, top, height, "Indexed Compare", { zeroLine: true, guides: [0], formatGuide: (v) => `${v}%` });
}

function indexedReturnSeries(rows) {
  const first = rows.find((row) => row && row.c);
  if (!first) return Array(rows.length).fill(null);
  return rows.map((row) => (row && row.c ? ((row.c / first.c) - 1) * 100 : null));
}

function requestCompareDetails(item) {
  compareTickers.forEach((ticker) => {
    const key = safeTicker(ticker);
    if (!key || key === item.ticker || detailCache[key] || detailPromises[key]) return;
    loadStockDetail(key).then((detail) => {
      if (detail && selectedTicker === item.ticker) redrawChart();
    });
  });
}
function renderMacdPanel(closes, xFor, x1, x2, top, height, candleW, visN) {
  const full = macdSeries(closes);
  const macd = lastN(full.macd, visN);
  const signal = lastN(full.signal, visN);
  const hist = lastN(full.hist, visN);
  const all = [...macd, ...signal, ...hist].filter((v) => v != null && Number.isFinite(v));
  const m = Math.max(0.001, ...all.map((v) => Math.abs(v)));
  const yFor = (v) => top + (1 - (v / m + 1) / 2) * height;
  const zeroY = yFor(0);
  const bars = hist.map((v, i) => {
    if (v == null) return "";
    const y = Math.min(zeroY, yFor(v));
    const h = Math.max(0.5, Math.abs(yFor(v) - zeroY));
    return `<rect x="${(xFor(i) - candleW / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${candleW.toFixed(1)}" height="${h.toFixed(1)}" class="${v >= 0 ? "macd-hist-up" : "macd-hist-down"}"></rect>`;
  }).join("");
  return `
    <rect x="${x1}" y="${top}" width="${x2 - x1}" height="${height}" class="rsi-bg"></rect>
    <line x1="${x1}" y1="${zeroY}" x2="${x2}" y2="${zeroY}" class="rsi-guide"></line>
    ${bars}
    ${pathFromSeries(macd, xFor, yFor, "#60a5fa", 1.4, "")}
    ${pathFromSeries(signal, xFor, yFor, "#f59e0b", 1.4, "")}
    <text x="${x1 + 4}" y="${top + 12}" class="chart-axis">MACD(12,26,9)</text>
  `;
}

function renderStochPanel(rows, xFor, x1, x2, top, height, visN) {
  const st = stochArrays(rows, 14, 3);
  const k = lastN(st.k, visN);
  const d = lastN(st.d, visN);
  const yFor = (v) => top + ((100 - v) / 100) * height;
  return `
    <rect x="${x1}" y="${top}" width="${x2 - x1}" height="${height}" class="rsi-bg"></rect>
    <line x1="${x1}" y1="${yFor(80)}" x2="${x2}" y2="${yFor(80)}" class="rsi-guide"></line>
    <line x1="${x1}" y1="${yFor(20)}" x2="${x2}" y2="${yFor(20)}" class="rsi-guide"></line>
    ${pathFromSeries(k, xFor, yFor, "#22d3ee", 1.4, "")}
    ${pathFromSeries(d, xFor, yFor, "#f472b6", 1.4, "")}
    <text x="${x1 + 4}" y="${top + 12}" class="chart-axis">Stoch(14,3)</text>
    <text x="${x2 + 44}" y="${yFor(80) + 4}" text-anchor="end" class="chart-axis">80</text>
    <text x="${x2 + 44}" y="${yFor(20) + 4}" text-anchor="end" class="chart-axis">20</text>
  `;
}

function formatChartDate(d) {
  const parts = String(d).split("-");
  if (parts.length < 3) return String(d);
  const [y, m, day] = parts;
  if (chartState.range === "5Y" || chartState.range === "1Y") return `${y.slice(2)}.${m}`;
  return `${Number(m)}/${Number(day)}`;
}

function getChartRows(item) {
  let rows;
  if (Array.isArray(item.chartSeries) && item.chartSeries.length) {
    rows = item.chartSeries.map((row) => {
      if (Array.isArray(row)) {
        return { o: Number(row[0]), h: Number(row[1]), l: Number(row[2]), c: Number(row[3]), v: Number(row[4] || 0), d: row[5] || null };
      }
      return {
        o: Number(row.o ?? row.c),
        h: Number(row.h ?? row.c),
        l: Number(row.l ?? row.c),
        c: Number(row.c),
        v: Number(row.v || 0),
        d: row.d ?? row.date ?? null
      };
    }).filter((row) => Number.isFinite(row.c));
  } else {
    const closes = item.closeSeries || [];
    rows = closes.map((close, index) => {
      const previous = Number(closes[Math.max(0, index - 1)] || close);
      const c = Number(close);
      const high = Math.max(previous, c) * 1.004;
      const low = Math.min(previous, c) * 0.996;
      return { o: previous, h: high, l: low, c, v: 1, d: null };
    });
  }
  // When the data carries no dates (older detail files / synthetic series), infer
  // approximate daily dates client-side so the x-axis works without the proxy.
  if (rows.length && !rows[rows.length - 1].d) fillInferredDates(rows);
  return rows;
}

function snapshotBaseDate() {
  const raw = (data && (data.updatedAtKst || data.updated_at_kst)) || "";
  const match = String(raw).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Date();
}

function fillInferredDates(rows) {
  const d = snapshotBaseDate();
  const iso = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    rows[i].d = iso(d);
    do {
      d.setDate(d.getDate() - 1);
    } while (d.getDay() === 0 || d.getDay() === 6); // skip weekends
  }
}

// How many bars the active range maps to, expressed in the active timeframe's units.
function rangeBarCount(total) {
  const dailyMap = { "1M": 22, "3M": 66, "6M": 132, "1Y": 252, "5Y": 1260 };
  const div = chartState.barTf === "W" ? 5 : (chartState.barTf === "M" ? 21 : 1);
  const want = Math.round((dailyMap[chartState.range] || total) / div);
  return Math.min(total, Math.max(10, want));
}

function visibleChartRows(rows) {
  const rangeSize = rangeBarCount(rows.length);
  const base = rows.slice(-rangeSize);
  const windowSize = Math.max(12, Math.floor(base.length / chartState.zoom));
  const maxOffset = Math.max(0, base.length - windowSize);
  chartState.offset = Math.min(chartState.offset, maxOffset);
  const end = base.length - chartState.offset;
  return base.slice(Math.max(0, end - windowSize), end);
}

// 상승확률 분석 차트 오버레이: 보이는 구간 + 앞쪽 이력(피보·회귀 등)을 함께 쓴다.
function chartAnalysisContextRows(allRows) {
  const rangeSize = rangeBarCount(allRows.length);
  const base = allRows.slice(-rangeSize);
  const windowSize = Math.max(12, Math.floor(base.length / chartState.zoom));
  const maxOffset = Math.max(0, base.length - windowSize);
  const offset = Math.min(chartState.offset, maxOffset);
  const end = base.length - offset;
  const ctxStart = Math.max(0, end - Math.max(252, windowSize + 80));
  return base.slice(ctxStart, end);
}

// 지지/저항 레벨 계산은 analysis.js(window.MirProb.supportResistanceLevels)로 일원화했다.
// 차트 오버레이는 보이는 봉(rows) 기준 — 이동·확대 시 선이 따라 갱신된다.
// 확률 패널 숫자는 분석 시점 전체 일봉 기준(srSummary)을 유지한다.

function renderRsiPanel(closes, xFor, x1, x2, top, height, visN) {
  const values = lastN(rsiSeries(closes, 14), visN);
  const yFor = (value) => top + ((100 - value) / 100) * height;
  const points = values.map((value, index) => Number.isFinite(value) ? [xFor(index), yFor(value)] : null).filter(Boolean);
  const path = points.map(([x, y], index) => `${index ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return `
    <rect x="${x1}" y="${top}" width="${x2 - x1}" height="${height}" class="rsi-bg"></rect>
    <line x1="${x1}" y1="${yFor(70)}" x2="${x2}" y2="${yFor(70)}" class="rsi-guide"></line>
    <line x1="${x1}" y1="${yFor(30)}" x2="${x2}" y2="${yFor(30)}" class="rsi-guide"></line>
    ${path ? `<path d="${path}" class="rsi-line"></path>` : ""}
    <text x="${x1 + 4}" y="${top + 14}" class="chart-axis">RSI(14)</text>
    <text x="${x2 + 44}" y="${yFor(70) + 4}" text-anchor="end" class="chart-axis">70</text>
    <text x="${x2 + 44}" y="${yFor(30) + 4}" text-anchor="end" class="chart-axis">30</text>
  `;
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

function rsiValue(avgGain, avgLoss) {
  if (!avgLoss) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function activeIndicatorLabels(item) {
  const labels = [
    chartState.showSma5 ? "SMA5" : "",
    chartState.showSma10 ? "SMA10" : "",
    chartState.showSma20 ? "SMA20" : "",
    chartState.showSma60 ? "SMA60" : "",
    chartState.showSma120 ? "SMA120" : "",
    chartState.showEma20 ? "EMA20" : "",
    chartState.showEma60 ? "EMA60" : "",
    chartState.showBoll ? "BOLL" : "",
    chartState.showVwap ? "VWAP" : "",
    chartState.showSupertrend ? "Supertrend" : "",
    chartState.showIchimoku ? "Ichimoku" : "",
    chartState.showKeltner ? "Keltner" : "",
    chartState.showDonchian ? "Donchian" : "",
    chartState.showVolumeProfile ? "VP" : "",
    chartState.showTrendlines ? "Trend" : "",
    chartState.showGapZones ? "Gap" : "",
    chartState.showMarketStructure ? "MS" : "",
    chartState.showChandelier ? "Chand" : "",
    chartState.showAnchoredVwap ? "AVWAP" : "",
    chartState.showRsSector ? `RS/${sectorBenchmarkTickerForItem(item) || "Sector"}` : ""
  ].filter(Boolean);
  const visible = labels.slice(0, 9);
  if (labels.length > visible.length) visible.push(`+${labels.length - visible.length}`);
  return visible.join(" ");
}

function pctFrom(now, then) {
  if (!then) return 0;
  return ((now / then) - 1) * 100;
}

function extractTickerCandidates(text) {
  const raw = String(text || "");
  const us = raw.toUpperCase().match(/\b[A-Z][A-Z0-9.\-]{0,5}\b/g) || [];
  const kr = raw.match(/\b\d{6}\b/g) || [];
  return [...new Set([...us, ...kr].filter((w) => stockByTicker(w)))];
}

function buildChatSearchHints(userText) {
  const tickers = new Set();
  if (chatFocusTicker) tickers.add(chatFocusTicker);
  if (selectedTicker) tickers.add(selectedTicker);
  extractTickerCandidates(userText).forEach((t) => tickers.add(t));
  const companies = [];
  tickers.forEach((ticker) => {
    const base = stockByTicker(ticker);
    if (base && base.company) companies.push(base.company);
  });
  return { tickers: [...tickers], companies };
}

function chatLikelyNeedsNews(text) {
  return /뉴스|왜\s*(올|하|떨|급|상|폭|조|강|쳤)|이슈|이유|배경|실적|어닝|공시|리포트|전망|하락|상승|급등|급락|수주|계약|인수|합병|소식|최근|무슨\s*일|요약해|분석해/i.test(String(text || ""));
}

async function buildStockChatContext(userText) {
  const tickers = new Set();
  if (chatFocusTicker) tickers.add(chatFocusTicker);
  if (selectedTicker) tickers.add(selectedTicker);
  extractTickerCandidates(userText).forEach((t) => tickers.add(t));
  if (!tickers.size) return "";

  // Wait for all tickers' details + 스마트머니/촉매 데이터셋이 로드되도록 보장한다.
  // (내부자·의회·13F·대량보유·공매도·주요공시 — AI가 함께 참고하려면 먼저 받아와야 함)
  await Promise.all([
    ...[...tickers].map((ticker) => loadStockDetail(ticker)),
    ...["inst13f", "insider", "short", "congress", "activist", "events"].map((k) =>
      (typeof ensureFeatureData === "function" ? ensureFeatureData(k) : Promise.resolve()).catch(() => {})),
  ]);

  const lines = [];
  tickers.forEach((ticker) => {
    const base = stockByTicker(ticker);
    if (!base) return;
    const item = applyLive(withDetail(base));
    const f = item.fundamentals || {};
    const earnings = item.liveEarnings || {};
    
    let techStr = "";
    const closes = (item.chartSeries || []).map((r) => (Array.isArray(r) ? Number(r[3]) : Number(r.c)));
    const volumes = (item.chartSeries || []).map((r) => (Array.isArray(r) ? Number(r[4]) : Number(r.v)));
    
    if (closes.length > 14) {
      const rsis = rsiSeries(closes, 14);
      const latestRsi = rsis[rsis.length - 1];
      const { macd, signal, hist } = macdSeries(closes);
      const latestMacd = macd[macd.length - 1];
      const latestMacdSignal = signal[signal.length - 1];
      const latestMacdHist = hist[hist.length - 1];
      
      let rsiState = "보통";
      if (latestRsi >= 70) rsiState = "과매수(Overbought)";
      else if (latestRsi <= 30) rsiState = "과매도(Oversold)";

      let macdState = "중립";
      if (latestMacd != null && latestMacdSignal != null) {
        if (latestMacd > latestMacdSignal) macdState = "강세(골든크로스 상태)";
        else if (latestMacd < latestMacdSignal) macdState = "약세(데드크로스 상태)";
      }

      techStr = ` · RSI(14):${latestRsi != null ? latestRsi.toFixed(1) : "—"} (${rsiState}) · MACD:${latestMacd != null ? latestMacd.toFixed(2) : "—"} (시그널:${latestMacdSignal != null ? latestMacdSignal.toFixed(2) : "—"}, 히스토그램:${latestMacdHist != null ? latestMacdHist.toFixed(2) : "—"}, 상태:${macdState})`;
    }
    
    if (volumes.length >= 20) {
      const latestVol = volumes[volumes.length - 1];
      const avgVol20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
      if (avgVol20 > 0) {
        const ratio = latestVol / avgVol20;
        techStr += ` · 거래량비율(최근20일평균대비):${ratio.toFixed(2)}x`;
      }
    }
    
    if (closes.length >= 60) {
      const price = Number(item.price || closes[closes.length - 1]);
      const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
      const sma60 = closes.slice(-60).reduce((a, b) => a + b, 0) / 60;
      techStr += ` · 이평선상태: 가격이 SMA20(${sma20.toFixed(0)}) 대비 ${price >= sma20 ? '상회' : '하회'}, SMA60(${sma60.toFixed(0)}) 대비 ${price >= sma60 ? '상회' : '하회'}`;
    }

    lines.push(
      `[${item.ticker} ${item.company}] 섹터:${item.sector} · 가격:${priceOrDash(item.price)} · 당일:${fmtDailyPct(item.changePct)} · 1주:${fmtPct(item.weekChangePct)} · 1M:${fmtPct(item.monthChangePct)} · RS:${item.rsScore} · EPS점수:${item.epsRevScore} · 거래량비율:${Number(item.volumeRatio || 0).toFixed(1)}x · 신고가거리:${fmtPct(-item.newHighDistancePct)} · 신호:${signalFor(item)}` +
      (f.pe ? ` · PER:${fmtMultiple(f.pe)}` : "") +
      (f.forwardPE ? ` · FwdPER:${fmtMultiple(f.forwardPE)}` : "") +
      (f.ps ? ` · P/S:${fmtMultiple(f.ps)}` : "") +
      (f.pb ? ` · P/B:${fmtMultiple(f.pb)}` : "") +
      (earnings.nextDate ? ` · 다음실적:${earnings.nextDate}` : "") +
      (earnings.epsEstimate != null ? ` · EPS예상:${earnings.epsEstimate}` : "") +
      techStr
    );

    // 스마트머니·촉매·상승확률 — 사이트의 차별화 데이터(내부자/의회/13F/대량보유/공매도/공시/MirProb)도
    // AI가 함께 보고 판단하도록 컨텍스트에 추가한다. 데이터가 없는 항목은 생략(주로 KR 종목).
    const smLines = [];
    const ins = ((window.INSIDER_TRADES || {}).trades || []).filter((r) => r.ticker === item.ticker);
    if (ins.length) {
      const insBuy = ins.filter((r) => r.kind === "buy").length;
      const insSell = ins.filter((r) => r.kind === "sell").length;
      smLines.push(`내부자(Form4) 매수 ${insBuy}·매도 ${insSell}`);
    }
    const cg = ((window.CONGRESS_TRADES || {}).byTicker || {})[item.ticker];
    if (cg) smLines.push(`의회매매 매수 ${cg.netBuys}·매도 ${cg.netSells}·${cg.politicianCount}명`);
    const f13 = (typeof inst13fIndex === "function" ? inst13fIndex() : {})[item.ticker];
    if (f13) smLines.push(`기관13F ${f13.holders}곳·$${(f13.valueM / 1000).toFixed(1)}B`);
    const act = ((window.ACTIVIST_STAKES || {}).filings || []).filter((r) => r.ticker === item.ticker);
    if (act.length) smLines.push(`대량보유13D/G ${act.length}건(액티비스트 ${act.filter((a) => a.kind === "activist").length})`);
    const si = ((window.SHORT_INTEREST || {}).rows || []).find((r) => r.ticker === item.ticker);
    if (si) smLines.push(`${shortIsBalance() ? `공매도 잔고비중 ${Number(si.balanceRatio || 0).toFixed(2)}%` : `공매도 잔고일수 ${Number(si.daysToCover || 0).toFixed(1)}일`}${Number.isFinite(si.changePct) ? `(전기대비 ${si.changePct > 0 ? "+" : ""}${si.changePct.toFixed(1)}%)` : ""}`);
    const evs = ((window.MATERIAL_EVENTS || {}).events || []).filter((e) => String(e.ticker || "").toUpperCase() === item.ticker);
    if (evs.length) {
      const labels = (evs[0].items || []).map((x) => x.label).filter(Boolean).slice(0, 3).join(", ") || "8-K";
      smLines.push(`주요공시(8-K) ${evs.length}건·최근 ${evs[0].fileDate || "—"}(${labels})`);
    }
    try {
      if (typeof scanQuickProb === "function") {
        const { up } = scanQuickProb(item, 20);
        if (Number.isFinite(up)) {
          const upR = Math.round(up);
          smLines.push(`MirProb 상승확률(약 1개월, 스냅샷 추정) ${upR}%(${typeof scanVerdict === "function" ? scanVerdict(upR) : ""})`);
        }
      }
    } catch (e) { /* 확률 계산 실패 시 생략 */ }
    if (smLines.length) lines.push(`  └ 스마트머니·촉매·확률: ${smLines.join(" · ")}`);
  });
  return lines.length
    ? `다음은 사이트 스냅샷/프록시 기준 종목 데이터입니다(실시간 투자 조언 아님, 참고용):\n${lines.join("\n")}`
    : "";
}

function renderEarningsCalendar(item) {
  const box = byId("stockEarnings");
  if (!box) return;
  if (isStockEtf(item)) {
    box.innerHTML = "";
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const f = normalizedFundamentalsForItem(item);
  const live = item.liveEarnings || staticEarningsForTicker(item.ticker) || {};
  const nextDate = live.nextDate || f.earningsDate || f.nextEarningsDate || item.earningsDate || null;
  const epsEstimate = live.epsEstimate ?? f.epsNextQ ?? null;
  const history = normalizeEarningsHistory(item).slice(-4).reverse();
  // new Date("YYYY-MM-DD") 는 UTC 자정으로 파싱돼 로컬 자정 기준인 snapshotBaseDate 와
  // 섞이면 KST 에서 하루가 어긋난다 — 로컬 자정으로 통일(localDateFromIso).
  const nextDateLocal = nextDate ? (localDateFromIso(nextDate) || new Date(nextDate)) : null;
  const daysUntil = nextDateLocal ? Math.ceil((nextDateLocal - snapshotBaseDate()) / 86400000) : null;

  box.innerHTML = `
    <div class="earnings-inline-head">
      <strong>일정 · 컨센서스</strong>
      <span>${escapeHtml(item.ticker)}</span>
    </div>
    <div class="earnings-summary">
      <article class="earnings-upcoming">
        <span>다음 실적 발표</span>
        <strong>${nextDate ? escapeHtml(String(nextDate)) : "데이터 없음"}</strong>
        <p>${nextDate && Number.isFinite(daysUntil) ? (daysUntil >= 0 ? `약 ${daysUntil}일 후` : `${Math.abs(daysUntil)}일 지남`) : "Yahoo Finance에서 일정을 가져오면 자동 표시됩니다."}</p>
      </article>
      <article class="earnings-upcoming">
        <span>EPS 컨센서스</span>
        <strong>${epsEstimate != null ? moneyOrDash(epsEstimate) : "—"}</strong>
        <p>${f.epsNextY != null ? `연간 EPS 예상 ${moneyOrDash(f.epsNextY)}` : "Nasdaq/야후 데이터가 있으면 함께 표시됩니다."}</p>
      </article>
    </div>
    ${history.length ? renderEarningsHistoryTable(history) : `<p class="muted earnings-empty">최근 분기 실적 히스토리는 프록시 연결 후 자동으로 채워집니다.</p>`}
  `;
}

// 미국(야후)은 EPS 실제/예상/서프라이즈를, 한국(DART)은 실제 손익을 준다. DART 에는
// 애널리스트 추정치가 없어서, KR 에 EPS 표를 그대로 쓰면 세 칸이 전부 "—" 인 빈 표가
// 나온다. 그래서 시장에 따라 컬럼을 바꾼다.
function renderEarningsHistoryTable(history) {
  const top = isKrMarket() ? krTopLineField(history) : null;
  const krMode = Boolean(top);

  const head = krMode
    ? `<tr><th>분기</th><th>${escapeHtml(top.label)}</th><th>영업이익</th><th>순이익</th></tr>`
    : `<tr><th>분기</th><th>실제 EPS</th><th>예상 EPS</th><th>서프라이즈</th></tr>`;

  const body = history.map((row) => {
    if (krMode) {
      return `
              <tr>
                <td title="${escapeHtml(row.period || "")}">${escapeHtml(row.label || row.date || "—")}</td>
                <td>${fmtKrwCompact(row[top.key])}</td>
                <td class="${cls(Number(row.operatingProfit) || 0)}">${fmtKrwCompact(row.operatingProfit)}</td>
                <td class="${cls(Number(row.netIncome) || 0)}">${fmtKrwCompact(row.netIncome)}</td>
              </tr>`;
    }
    return `
              <tr>
                <td>${escapeHtml(row.date || "—")}</td>
                <td>${row.epsActual != null ? moneyOrDash(row.epsActual) : "—"}</td>
                <td>${row.epsEstimate != null ? moneyOrDash(row.epsEstimate) : "—"}</td>
                <td class="${cls(earningsSurprisePct(row) || 0)}">${earningsSurprisePct(row) == null ? "—" : fmtPct(earningsSurprisePct(row))}</td>
              </tr>`;
  }).join("");

  return `
      <details class="earnings-inline-history">
        <summary>최근 분기 ${krMode ? "실적" : "EPS"} 기록 <span>${history.length}개 분기</span></summary>
        <div class="table-wrap compact-table-wrap">
        <table class="compact-table earnings-table">
          <thead>${head}</thead>
          <tbody>${body}</tbody>
        </table>
        </div>
      </details>`;
}

function earningsSurprisePct(row) {
  const actual = Number(row?.epsActual);
  const estimate = Number(row?.epsEstimate);
  if (!Number.isFinite(actual) || !Number.isFinite(estimate) || estimate === 0) return null;
  return ((actual - estimate) / Math.abs(estimate)) * 100;
}

function communityPostsForTicker(ticker) {
  const t = String(ticker || "").toUpperCase();
  return communityPostsCache
    .filter((post) => post.ticker === t)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function stockEventCommunityCardHtml(item) {
  const loading = Boolean(communityFetchPromise) && !communityPostsCache.length;
  const posts = communityPostsForTicker(item.ticker);
  const count = posts.length;
  const previews = posts.slice(0, 2);
  const previewHtml = loading
    ? `<p class="event-community-empty">커뮤니티 글을 불러오는 중…</p>`
    : previews.length
      ? `<div class="event-community-previews">${previews.map((post) => `
          <div class="event-community-preview">
            <div class="event-community-preview-meta">
              <span>${escapeHtml(post.author || "익명")}</span>
              <time>${escapeHtml(formatCommunityTime(post.createdAt))}</time>
            </div>
            <p class="event-community-preview-body">${escapeHtml(post.content)}</p>
          </div>
        `).join("")}</div>`
      : `<p class="event-community-empty">${escapeHtml(item.ticker)} 관련 의견이 아직 없습니다. 첫 의견을 남겨보세요.</p>`;
  const ctaLabel = `${count}개의 의견 보기`;
  return `
    <article class="event-card event-card-community event-info">
      <span class="event-type"><i aria-hidden="true"></i>커뮤니티</span>
      <strong>커뮤니티</strong>
      <b>${loading ? "불러오는 중…" : (count ? `${count}개 의견` : "의견 없음")}</b>
      ${previewHtml}
      <div class="event-community-actions">
        <button type="button" class="event-action event-community-cta" data-community-board="${escapeHtml(item.ticker)}">${escapeHtml(ctaLabel)}</button>
        <button type="button" class="event-action event-community-write" data-community-write="${escapeHtml(item.ticker)}">글쓰기</button>
      </div>
    </article>
  `;
}

function openCommunityBoardForTicker(ticker) {
  if (!ticker) return;
  applyCommunityBoardTickerFilter(ticker);
  activateTab("community", { push: true, sub: "board", communityTicker: ticker });
}

// 분석 페이지 → 해당 종목으로 바로 글쓰기(작성칸에 티커 채우고 포커스).
function openCommunityComposeForTicker(ticker) {
  activateTab("community", { push: true, sub: "board" });
  const tickerInput = byId("communityTicker");
  if (tickerInput) tickerInput.value = ticker || "";
  setTimeout(() => {
    byId("communityCompose")?.scrollIntoView({ behavior: "smooth", block: "center" });
    byId("communityContent")?.focus();
  }, 140);
}

function renderStockEvents(item) {
  const box = byId("stockEvents");
  if (!box) return;
  const events = stockEventRows(item);
  const earningsEvent = events.find((event) => event.type === "Earnings");
  const restEvents = events.filter((event) => event.type !== "Earnings");
  box.innerHTML = `
    <div class="event-head">
      <div>
        <h3>종목 이벤트</h3>
        <p class="muted">실적, 옵션 만기, 컨센서스 목표가, 뉴스, 가격 변동, 커뮤니티 의견을 한곳에 모았습니다.</p>
      </div>
      <span class="event-badge">${escapeHtml(item.ticker)}</span>
    </div>
    <div class="event-grid">
      ${earningsEvent ? eventCardHtml(earningsEvent) : ""}
      <section class="smart-money-card event-card-smart" id="stockSmartMoney"></section>
      <section class="smart-money-card event-card-smart" id="stockInst13f"></section>
      ${restEvents.map(eventCardHtml).join("")}
      ${stockEventCommunityCardHtml(item)}
    </div>
    ${moveAnalysisHtml(item, events.find((event) => event.type === "Move")?.move || null)}
  `;
  renderEarningsCalendar(item);
  renderEarningsReaction(item);
  renderSmartMoney(item);
  renderInst13fChange(item);
}

function stockEventRows(item) {
  const f = normalizedFundamentalsForItem(item);
  const displayPrice = latestPriceForFundamentals(item, f);
  const rows = getChartRows(item);
  const latestNews = Array.isArray(item.news) ? item.news[0] : null;
  const target = Number(f.targetPrice);
  const price = Number(displayPrice || item.price || f.prevClose);
  const targetUpside = Number.isFinite(target) && Number.isFinite(price) && price ? pctFrom(target, price) : null;
  const bigMove = recentBigMove(rows);
  const earningsDate = item.liveEarnings?.nextDate || f.earningsDate || f.nextEarningsDate || item.earningsDate || null;
  const dividend = f.dividendRate || f.dividendYield || item.dividendYield || null;
  return [
    {
      type: "Earnings",
      title: earningsDate ? "다음 실적 발표" : "실적 일정",
      value: earningsDate ? String(earningsDate) : "데이터 없음",
      note: f.epsNextQ != null ? `EPS next Q ${moneyOrDash(f.epsNextQ)} · EPS next Y ${moneyOrDash(f.epsNextY)}` : "상세 데이터에 실적 날짜가 없으면 표시하지 않습니다.",
      tone: earningsDate ? "info" : "muted"
    },
    {
      type: "Options",
      title: "월간 옵션 만기",
      value: nextMonthlyOptionsExpiration(),
      note: "미국 주식 옵션의 일반적인 월간 만기 기준입니다. 개별 옵션 체인은 별도 데이터가 필요합니다.",
      tone: "info"
    },
    {
      type: "Target",
      title: "Nasdaq 1Y 컨센서스 목표가",
      value: Number.isFinite(target) ? priceOrDash(target) : "데이터 없음",
      note: targetUpside == null ? "Nasdaq 제공 목표가 데이터 없음" : `현재가 대비 ${fmtPct(targetUpside)} · Nasdaq 제공 집계값`,
      tone: targetUpside == null ? "muted" : cls(targetUpside)
    },
    {
      type: "Dividend",
      title: "배당 정보",
      value: dividend ? String(dividend) : "해당 없음/데이터 없음",
      note: f.dividendExDate ? `배당락 ${f.dividendExDate}` : "배당락일 데이터가 있으면 여기에 표시됩니다.",
      tone: dividend ? "info" : "muted"
    },
    {
      type: "News",
      title: "최근 뉴스",
      value: latestNews?.publishedAt || "데이터 없음",
      note: latestNews?.title || "뉴스 데이터가 있으면 최신 제목을 표시합니다.",
      tone: latestNews ? "info" : "muted"
    },
    {
      type: "Move",
      title: "최근 가격 이벤트",
      value: bigMove ? `${bigMove.date} · ${fmtPct(bigMove.change)}` : "데이터 없음",
      note: bigMove ? "최근 45거래일 중 절대 변동폭이 가장 컸던 날입니다." : "차트 데이터가 부족합니다.",
      tone: bigMove ? cls(bigMove.change) : "muted",
      move: bigMove,
      action: bigMove ? `<button type="button" class="event-action" data-move-analysis="${escapeHtml(bigMove.date)}">원인 분석</button>` : ""
    }
  ];
}

const EVENT_META = {
  Earnings: { icon: "", ko: "실적" },
  Options:  { icon: "", ko: "옵션 만기" },
  Target:   { icon: "", ko: "목표가" },
  Dividend: { icon: "", ko: "배당" },
  News:     { icon: "", ko: "뉴스" },
  Move:     { icon: "", ko: "가격 이벤트" },
};

function eventTypeLabel(type) {
  const meta = EVENT_META[type] || { icon: "•", ko: type };
  return `<span class="event-type"><i aria-hidden="true">${meta.icon}</i>${escapeHtml(meta.ko)}</span>`;
}

function eventCardHtml(event) {
  if (event.type === "Earnings") {
    return `
      <article class="event-card event-${escapeHtml(event.tone)} event-card-earnings">
        <div class="earnings-card-title">
          ${eventTypeLabel("Earnings")}
          <strong>실적 일정과 발표 반응</strong>
        </div>
        <div id="stockEarnings" class="earnings-inline-calendar"></div>
        <div id="earningsReaction" class="earnings-inline-reaction-host"></div>
      </article>`;
  }
  return `
    <article class="event-card event-${escapeHtml(event.tone)}">
      ${eventTypeLabel(event.type)}
      <strong>${escapeHtml(event.title)}</strong>
      <b>${escapeHtml(event.value)}</b>
      <p>${escapeHtml(event.note)}</p>
      ${event.action || ""}
    </article>
  `;
}

function recentBigMove(rows) {
  if (!rows || rows.length < 3) return null;
  return rows.slice(-45).map((row, index, arr) => {
    const prev = index ? arr[index - 1] : rows[Math.max(0, rows.length - arr.length - 1)];
    return { date: row.d || "-", change: pctFrom(row.c, prev?.c || row.o) };
  }).filter((row) => Number.isFinite(row.change))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))[0] || null;
}

function dateDistanceDays(a, b) {
  const da = new Date(`${a}T00:00:00`);
  const db = new Date(`${b}T00:00:00`);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return Infinity;
  return Math.abs((da - db) / 86400000);
}

function volumeContext(rows, date) {
  const idx = rows.findIndex((row) => row.d === date);
  if (idx < 0) return null;
  const start = Math.max(0, idx - 20);
  const sample = rows.slice(start, idx).map((row) => Number(row.v || 0)).filter(Boolean);
  if (!sample.length || !rows[idx].v) return null;
  const avg = sample.reduce((sum, value) => sum + value, 0) / sample.length;
  return avg ? rows[idx].v / avg : null;
}

function localMoveAnalysis(item, move) {
  if (!move) return "";
  const rows = getChartRows(item);
  const relatedNews = (item.news || [])
    .filter((news) => news.publishedAt && dateDistanceDays(news.publishedAt, move.date) <= 2)
    .slice(0, 3);
  const volumeRatio = volumeContext(rows, move.date);
  const direction = move.change > 0 ? "상승" : "하락";
  const newsText = relatedNews.length
    ? `해당 날짜 전후 저장 뉴스 ${relatedNews.length}건이 있습니다: ${relatedNews.map((news) => news.title).join(" / ")}`
    : "저장된 뉴스 중 해당 날짜 전후 2일 안에 직접 연결되는 제목은 없습니다.";
  const volText = volumeRatio == null
    ? "거래량 비교 데이터는 부족합니다."
    : `거래량은 직전 20거래일 평균의 약 ${volumeRatio.toFixed(1)}배였습니다.`;
  return `${move.date}에는 종가 기준 ${fmtPct(move.change)} ${direction}했습니다. ${volText} ${newsText} 저장된 뉴스와 가격 데이터 기준의 보조 분석입니다.`;
}

function moveAnalysisHtml(item, move) {
  if (!move || !moveAnalysisState || moveAnalysisState.ticker !== item.ticker || moveAnalysisState.date !== move.date) return "";
  const isLoading = moveAnalysisState.status === "loading";
  const isError = moveAnalysisState.status === "error";
  const benchLabel = isKrMarket() ? "코스피·코스닥" : "SPY·QQQ";
  const text = isLoading ? `해당 날짜 전후의 과거 뉴스와 ${benchLabel} 시장 흐름을 검색하고 있습니다.` : (moveAnalysisState.text || localMoveAnalysis(item, move));
  const sources = Array.isArray(moveAnalysisState.sources) ? moveAnalysisState.sources : [];
  const sourceHtml = !isLoading && sources.length ? `
    <div class="move-analysis-sources">
      <b>분석 근거</b>
      ${sources.slice(0, 5).map((source) => {
        const href = /^https?:\/\//i.test(source.link || "") ? source.link : "#";
        return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"><span>${escapeHtml(source.publisher || source.provider || "뉴스")}</span>${escapeHtml(source.publishedAt || "")} · ${escapeHtml(source.title || "원문 보기")}</a>`;
      }).join("")}
    </div>` : "";
  const confidenceHtml = !isLoading && moveAnalysisState.confidence
    ? `<span class="move-confidence confidence-${moveAnalysisState.confidence === "높음" ? "high" : moveAnalysisState.confidence === "보통" ? "medium" : "low"}">근거 신뢰도 ${escapeHtml(moveAnalysisState.confidence)}</span>`
    : "";
  const note = isLoading
    ? "분석 중입니다. 잠시만 기다려주세요."
    : isError
      ? "날짜 기준 뉴스를 충분히 찾지 못했거나 AI 분석을 불러오지 못해 저장 데이터 기준으로 표시했습니다."
      : `이벤트 날짜 전후 ${moveAnalysisState.searchWindowDays || 2}일 뉴스와 시장 흐름을 함께 비교했습니다.`;
  return `
    <div class="move-analysis-box ${isLoading ? "is-loading" : ""}">
      <div class="move-analysis-title">
        <strong>${escapeHtml(item.ticker)} ${escapeHtml(move.date)} 원인 분석</strong>
        ${confidenceHtml}
      </div>
      <p>${escapeHtml(text)}</p>
      ${sourceHtml}
      <span class="muted">${escapeHtml(note)}</span>
    </div>
  `;
}

async function runMoveAnalysis(date) {
  const base = data.stocks.find((row) => row.ticker === selectedTicker);
  if (!base) return;
  const item = applyLive(withDetail(base));
  const move = recentBigMove(getChartRows(item));
  if (!move || move.date !== date) return;
  moveAnalysisState = {
    ticker: item.ticker,
    date,
    status: "loading",
    text: ""
  };
  renderStockEvents(item);
  if (!LIVE_DATA_PROXY) {
    moveAnalysisState = { ticker: item.ticker, date, status: "error", text: localMoveAnalysis(item, move) };
    renderStockEvents(item);
    return;
  }
  try {
    const baseUrl = LIVE_DATA_PROXY.replace(/\/$/, "");
    // Send the Yahoo-suffixed symbol (005930.KS) so the proxy detects Korean
    // stocks and uses Naver/Korean news + KOSPI·KOSDAQ benchmarks.
    const endpoint = `${baseUrl}/?ticker=${encodeURIComponent(liveProxyTicker(item))}&company=${encodeURIComponent(item.company || item.ticker)}&move_analysis=1&date=${encodeURIComponent(date)}&change=${encodeURIComponent(move.change)}`;
    const response = await fetch(endpoint, { cache: "no-store" });
    const payload = response.ok ? await response.json() : null;
    const hasAnalysis = typeof payload?.analysis === "string" && Boolean(payload.analysis.trim());
    const text = hasAnalysis ? payload.analysis.trim() : localMoveAnalysis(item, move);
    moveAnalysisState = {
      ticker: item.ticker,
      date,
      status: hasAnalysis ? "done" : "error",
      text,
      confidence: payload?.confidence || "",
      sources: Array.isArray(payload?.sources) ? payload.sources : [],
      newsProviders: Array.isArray(payload?.newsProviders) ? payload.newsProviders : [],
      searchWindowDays: Number(payload?.searchWindowDays || 0),
      marketContext: payload?.marketContext || null
    };
  } catch (error) {
    console.warn("move analysis failed", error);
    moveAnalysisState = { ticker: item.ticker, date, status: "error", text: localMoveAnalysis(item, move) };
  }
  if (selectedTicker !== item.ticker) return;
  const refreshedBase = data.stocks.find((row) => row.ticker === item.ticker) || base;
  renderStockEvents(applyLive(withDetail(refreshedBase)));
}

function normalizeEarningsHistory(item) {
  const f = item.fundamentals || {};
  const live = item.liveEarnings || {};
  const raw = live.history || live.quarters || item.earningsHistory || f.earningsHistory || f.quarterlyEarnings || [];
  return (Array.isArray(raw) ? raw : []).map((row) => {
    let date = row.date || row.reportDate || row.earningsDate || row.period || row.fiscalDateEnding;
    if (!date && row.quarter) {
      const q = String(row.quarter);
      if (/^\d{4}-\d{2}-\d{2}/.test(q)) date = q.slice(0, 10);
    }
    return {
      date: date ? String(date).slice(0, 10) : "",
      epsActual: row.epsActual ?? row.actual ?? row.reportedEPS ?? row.eps,
      epsEstimate: row.epsEstimate ?? row.estimate ?? row.estimatedEPS,
      revenue: row.revenue ?? row.sales,
      // KR(DART) 전용. 미국은 야후에서 EPS·서프라이즈가 오지만 DART 는 추정치를 주지
      // 않는 대신 실제 손익을 준다. 은행·보험·증권은 '매출액' 계정 자체가 없어서
      // revenue 가 없고 순이자손익/이자수익이 톱라인이다.
      label: row.label,
      period: row.period,
      operatingProfit: row.operatingProfit,
      netIncome: row.netIncome,
      netInterestIncome: row.netInterestIncome,
      interestIncome: row.interestIncome,
      netFeeIncome: row.netFeeIncome,
    };
  }).filter((row) => row.date);
}

// 업종마다 톱라인이 다르다. 제조·서비스업은 매출액이지만 금융업은 그 계정이 없다.
// 한 종목의 표 전체에 쓸 라벨이라 행이 아니라 히스토리 단위로 고른다.
function krTopLineField(history) {
  const has = (k) => history.some((r) => Number.isFinite(Number(r[k])));
  if (has("revenue")) return { key: "revenue", label: "매출" };
  if (has("netInterestIncome")) return { key: "netInterestIncome", label: "순이자손익" };
  if (has("interestIncome")) return { key: "interestIncome", label: "이자수익" };
  return null;
}

// DART 금액은 원 단위 정수로 온다(삼성전자 연매출 333,605,900,000,000).
function fmtKrwCompact(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const jo = n / 1e12;
  if (Math.abs(jo) >= 1) return `${jo.toFixed(2)}조`;
  return `${(jo * 10000).toFixed(0)}억`;
}

function nearestTradingIndex(rows, date) {
  const target = new Date(`${date}T00:00:00`).getTime();
  if (!Number.isFinite(target)) return -1;
  let best = -1;
  let bestDist = Infinity;
  rows.forEach((row, index) => {
    const t = new Date(`${row.d}T00:00:00`).getTime();
    const dist = Math.abs(t - target);
    if (dist < bestDist) {
      best = index;
      bestDist = dist;
    }
  });
  return best;
}

function earningsReactionRows(item) {
  const rows = getChartRows(item);
  const history = normalizeEarningsHistory(item);
  if (rows.length < 30 || !history.length) return [];
  return history.slice(-8).reverse().map((event) => {
    const idx = nearestTradingIndex(rows, event.date);
    if (idx < 0) return null;
    const before = rows[Math.max(0, idx - 5)];
    const eventRow = rows[idx];
    const after = rows[Math.min(rows.length - 1, idx + 5)];
    const oneDay = idx > 0 ? pctFrom(eventRow.c, rows[idx - 1].c) : null;
    const pre5 = before ? pctFrom(eventRow.c, before.c) : null;
    const post5 = after ? pctFrom(after.c, eventRow.c) : null;
    const surprise = event.epsActual != null && event.epsEstimate != null && Number(event.epsEstimate)
      ? ((Number(event.epsActual) - Number(event.epsEstimate)) / Math.abs(Number(event.epsEstimate))) * 100
      : null;
    return { ...event, tradingDate: eventRow.d, oneDay, pre5, post5, surprise };
  }).filter(Boolean);
}

function renderEarningsReaction(item) {
  const box = byId("earningsReaction");
  if (!box || !item) return;
  const rows = earningsReactionRows(item);
  // DART 에는 애널리스트 추정치가 없어 KR 은 서프라이즈가 항상 null 이다. 컬럼을 두면
  // 세로로 "-" 만 늘어서므로 계산 가능한 행이 하나라도 있을 때만 보여준다.
  const showSurprise = rows.some((row) => row.surprise != null);
  box.innerHTML = `
    ${rows.length ? `
      <details class="earnings-inline-reaction">
        <summary>실적 발표 전후 주가 반응 <span>최근 ${Math.min(rows.length, 4)}회</span></summary>
        <div class="table-wrap">
        <table class="compact-table earnings-reaction-table">
          <thead><tr><th>발표일</th><th>거래일</th>${showSurprise ? "<th>EPS 서프라이즈</th>" : ""}<th>-5D→발표</th><th>발표일</th><th>발표→+5D</th></tr></thead>
          <tbody>
            ${rows.slice(0, 4).map((row) => `
              <tr>
                <td>${escapeHtml(row.date)}</td>
                <td>${escapeHtml(row.tradingDate)}</td>
                ${showSurprise ? `<td class="${cls(row.surprise || 0)}">${row.surprise == null ? "-" : fmtPct(row.surprise)}</td>` : ""}
                <td class="${cls(row.pre5 || 0)}">${row.pre5 == null ? "-" : fmtPct(row.pre5)}</td>
                <td class="${cls(row.oneDay || 0)}">${row.oneDay == null ? "-" : fmtPct(row.oneDay)}</td>
                <td class="${cls(row.post5 || 0)}">${row.post5 == null ? "-" : fmtPct(row.post5)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        </div>
      </details>
    ` : `<p class="muted earnings-reaction-empty">실적 발표 반응을 계산할 가격·실적 히스토리가 부족합니다.</p>`}
  `;
}

function nextMonthlyOptionsExpiration(base = snapshotBaseDate()) {
  const thirdFriday = (year, month) => {
    const d = new Date(year, month, 1);
    const firstFriday = 1 + ((5 - d.getDay() + 7) % 7);
    return new Date(year, month, firstFriday + 14);
  };
  let exp = thirdFriday(base.getFullYear(), base.getMonth());
  if (exp < base) exp = thirdFriday(base.getFullYear(), base.getMonth() + 1);
  return `${exp.getFullYear()}-${String(exp.getMonth() + 1).padStart(2, "0")}-${String(exp.getDate()).padStart(2, "0")}`;
}

function sourceLabel(source) {
  const src = String(source || "").toLowerCase();
  if (!src) return "데이터 없음";
  if (src.includes("nasdaq") && src.includes("sec") && src.includes("yahoo")) return "Nasdaq + SEC + Yahoo";
  if (src.includes("nasdaq") && src.includes("sec")) return "Nasdaq + SEC";
  if (src.includes("nasdaq")) return "Nasdaq";
  if (src.includes("yahoo")) return "Yahoo Finance";
  if (src.includes("sec")) return "SEC EDGAR";
  if (src.includes("naver")) return "네이버 금융";
  if (src.includes("snapshot")) return "스냅샷 생성값";
  return source;
}

function missingFundamentalFields(f) {
  const fields = [
    ["pe", "PER"],
    ["forwardPE", "Forward PER"],
    ["epsTtm", "EPS TTM"],
    ["epsNextY", "EPS Next Y"],
    ["salesB", "Sales"],
    ["incomeB", "Income"],
    ["roe", "ROE"],
    ["targetPrice", "1Y Target"]
  ];
  return fields.filter(([key]) => f[key] == null || f[key] === "").map(([, label]) => label);
}

function firstFiniteNumber(...values) {
  for (const value of values) {
    if (value === null || value === "") continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function latestPriceForFundamentals(item, f = item?.fundamentals || {}) {
  const rows = getChartRows(item || {});
  const lastClose = rows.length ? Number(rows[rows.length - 1].c) : null;
  return firstFiniteNumber(lastClose, item?.price, f.prevClose, f.price);
}

function marketCapBillionForFundamentals(item, f = item?.fundamentals || {}) {
  const detailCap = firstFiniteNumber(f.marketCapB);
  if (isKrMarket()) {
    if (detailCap != null && detailCap > 1000) return detailCap;
    const snapshotCap = firstFiniteNumber(item?.marketCapT, item?.marketCapB);
    if (snapshotCap != null) return snapshotCap * 1000;
    return detailCap;
  }
  return firstFiniteNumber(detailCap, item?.marketCapB);
}

function normalizedFundamentalsForItem(item) {
  const raw = item?.fundamentals || {};
  const f = { ...raw };
  const price = latestPriceForFundamentals(item, f);
  const marketCapB = marketCapBillionForFundamentals(item, f);
  if (isKrMarket() && marketCapB != null) f.marketCapDisplay = marketCapB / 1000;

  let epsTtm = firstFiniteNumber(f.epsTtm, f.trailingEps, f.trailingEPS, f.eps);
  let sharesB = firstFiniteNumber(f.sharesB, f.sharesOutstandingB);
  if (isKrMarket() && marketCapB != null && price && price > 0) {
    const derivedSharesB = marketCapB / price;
    if (derivedSharesB > 0) sharesB = derivedSharesB;
  }
  if (!(epsTtm > 0) && sharesB > 0 && Number(f.incomeB) > 0) {
    epsTtm = Number(f.incomeB) / sharesB;
  }
  if (epsTtm > 0) f.epsTtm = epsTtm;
  if (sharesB > 0) f.sharesBDisplay = sharesB;
  if (price > 0 && epsTtm > 0) f.pe = price / epsTtm;

  const epsNextY = firstFiniteNumber(f.epsNextY, f.forwardEps, f.forwardEPS, f.epsForward);
  if (price > 0 && epsNextY > 0) {
    f.epsNextY = epsNextY;
    f.forwardPE = price / epsNextY;
  } else if (isKrMarket()) {
    f.forwardPE = null;
  } else if (Number.isFinite(Number(raw.forwardPE))) {
    const basePrice = firstFiniteNumber(f.prevClose, item?.price);
    f.forwardPE = basePrice > 0 && price > 0 ? Number(raw.forwardPE) * price / basePrice : Number(raw.forwardPE);
  }
  return f;
}

function renderDataQualityPanel(item) {
  const box = byId("dataQualityPanel");
  if (!box || !item) return;
  const f = normalizedFundamentalsForItem(item);
  const hasDetail = Boolean(detailCache[safeTicker(item.ticker)] || item.chartSeries || Object.keys(f).length);
  const missing = missingFundamentalFields(f);
  const chartRows = getChartRows(item);
  const source = sourceLabel(f.source);
  const history = sourceLabel(item.historySource);
  const detailStatus = hasDetail ? "상세 데이터 로드됨" : "상세 데이터 로딩 전/없음";
  const quality = missing.length <= 2 && chartRows.length > 240 ? "good" : missing.length <= 5 ? "warn" : "muted";
  const toneText = quality === "good" ? "양호" : quality === "warn" ? "일부 누락" : "제한적";
  box.innerHTML = `
    <div class="quality-head">
      <div>
        <h3>데이터 품질 / 출처</h3>
        <p class="muted">가격·재무·뉴스가 어디서 왔고 무엇이 비어 있는지 먼저 확인합니다.</p>
      </div>
      <span class="quality-badge quality-${quality}">${toneText}</span>
    </div>
    <div class="quality-grid">
      <article><span>스냅샷 기준</span><strong>${escapeHtml(data.updatedAtKst || data.updated_at_kst || "-")}</strong></article>
      <article><span>가격 이력</span><strong>${escapeHtml(history)}</strong><em>${chartRows.length ? `${chartRows.length} bars` : "차트 없음"}</em></article>
      <article><span>재무 데이터</span><strong>${escapeHtml(source)}</strong><em>${Object.keys(f).length ? `${Object.keys(f).length} fields` : "없음"}</em></article>
      <article><span>뉴스</span><strong>${Array.isArray(item.news) && item.news.length ? `${item.news.length}건` : "없음"}</strong><em>${detailStatus}</em></article>
    </div>
    <p class="quality-note">
      ${missing.length ? `누락 지표: ${escapeHtml(missing.slice(0, 6).join(", "))}${missing.length > 6 ? " 외" : ""}` : "핵심 재무 지표가 대부분 채워져 있습니다."}
    </p>
  `;
}

function parseSnapshotDate(raw) {
  const text = String(raw || "").replace(" KST", "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}))?/);
  if (!match) return null;
  const [, y, m, d, hh = "0", mm = "0"] = match;
  return new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm));
}

function renderDataFreshnessStatus() {
  const box = byId("aiDataStatus");
  if (!box) return;
  const raw = data.updatedAtKst || data.updated_at_kst || "";
  const snap = parseSnapshotDate(raw);
  const ageHours = snap ? Math.max(0, (Date.now() - snap.getTime()) / 36e5) : null;
  const stale = ageHours != null && ageHours > 30;
  const aiKeys = Object.keys(data.ai_briefing || {});
  const social = data.social_sentiment || {};
  const socialCount = Object.values(social).reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0);
  box.classList.toggle("is-stale", stale);
  box.innerHTML = `
    <strong>데이터 상태</strong>
    <span>스냅샷 ${escapeHtml(raw || "-")} · AI 브리핑 ${aiKeys.length}종 · 소셜 트렌딩 ${socialCount}개</span>
    <span>${stale ? "스냅샷이 30시간 이상 지나 오래된 데이터일 수 있습니다." : "주식 데이터는 하루 1회 스냅샷이며, AI/소셜 블록은 별도 생성기가 채운 값을 표시합니다."}</span>
  `;
}

function renderFundamentals(item) {
  // ETFs don't need fundamentals — show their constituent stocks (by RS) instead.
  if (isStockEtf(item)) {
    renderEtfConstituents(item);
    return;
  }
  const f = normalizedFundamentalsForItem(item);
  const displayPrice = latestPriceForFundamentals(item, f);
  const detailMode = data.detailPolicy?.mode === "split";
  const hasFundamentals = Object.keys(f).length > 0;
  const krT = isKrMarket();

  // Group the metrics by what they tell you, so the eye can jump to a theme (밸류에이션,
  // 수익성 …) instead of scanning a flat 30-cell grid.
  const groups = [
    { title: "밸류에이션", metrics: [
      ["P/E", fmtMultiple(f.pe)], ["Forward P/E", fmtMultiple(f.forwardPE)],
      ["P/S", fmtMultiple(f.ps)], ["P/B", fmtMultiple(f.pb)],
    ] },
    { title: "수익성", metrics: [
      ["Gross Margin", fmtPercent(f.grossMargin)], ["Oper Margin", fmtPercent(f.operMargin)],
      ["Profit Margin", fmtPercent(f.profitMargin)], ["ROE", fmtPercent(f.roe)],
    ] },
    { title: "실적 (EPS)", metrics: [
      ["EPS TTM", moneyOrDash(f.epsTtm)], ["EPS Next Y", moneyOrDash(f.epsNextY)],
      ["EPS Next Q", moneyOrDash(f.epsNextQ)], [krT ? "1Y 목표가" : "1Y Target", priceOrDash(f.targetPrice)],
    ] },
    { title: "기간 성과", metrics: [
      ["Perf Week", fmtPct(item.weekChangePct)], ["Perf Month", fmtPct(item.monthChangePct)],
      ["Perf Quarter", fmtPct(item.threeMonthChangePct)], ["Perf YTD", fmtPct(item.ytdChangePct)],
    ] },
    { title: "규모 · 유동성", wide: true, metrics: [
      ["Market Cap", krT ? fmtBillions(item.marketCapB) : fmtBillions(f.marketCapDisplay ?? f.marketCapB ?? item.marketCapB)],
      ["Sales", fmtFinancialB(f.salesB)], ["Income", fmtFinancialB(f.incomeB)], ["Cash", fmtFinancialB(f.cashB)],
      ["Shares Out", fmtShares(f.sharesBDisplay ?? f.sharesB)], ["Avg Volume", fmtCompact(f.avgVolume)],
      ["Volume", fmtCompact(f.volume)], ["Debt/Eq", fmtNum(f.debtEq)],
      ["Current Ratio", fmtRatio(f.currentRatio)], ["Quick Ratio", fmtRatio(f.quickRatio)],
    ] },
    { title: "가격", wide: true, metrics: [
      ["Price", priceOrDash(displayPrice)], ["Prev Close", priceOrDash(f.prevClose)],
      ["52W High", priceOrDash(f.week52High)], ["52W Low", priceOrDash(f.week52Low)],
      ["RS Score", item.rsScore ?? "-"], ["Index", indexLabel(item)],
    ] },
  ];

  const sourceText = hasFundamentals
    ? (krT ? "Yahoo Finance · 네이버 금융 보완 (KRX)" : f.source === "yahoo" ? "Yahoo Finance · Nasdaq/SEC 보완" : f.source === "sec" ? "SEC EDGAR · 분기 재무 공시" : f.source === "nasdaq+sec" || f.source === "nasdaq+sec+yahoo" ? "Nasdaq + SEC + Yahoo · NYSE 등 전 거래소" : "Nasdaq + SEC/Yahoo 스냅샷")
    : (detailMode ? "상세 데이터를 불러오는 중이거나 해당 종목 상세값이 없습니다." : "일부 지표는 다음 스냅샷 갱신 후 표시됩니다.");

  const groupHtml = (g) => `
    <div class="fund-group${g.wide ? " fund-group-wide" : ""}">
      <div class="fund-group-title">${escapeHtml(g.title)}</div>
      <div class="fund-metrics">
        ${g.metrics.map(([label, value]) => `
          <div class="fund-metric">
            <span class="fund-metric-label">${escapeHtml(label)}</span>
            ${valueWithClass(value)}
          </div>`).join("")}
      </div>
    </div>`;

  byId("fundamentalTable").innerHTML = `
    <div class="fundamental-head">
      <h3>Fundamentals</h3>
      <span>${sourceText}</span>
    </div>
    <div class="fund-groups">
      ${groups.map(groupHtml).join("")}
    </div>
  `;
}

// Resolve an ETF's constituent stocks (best available), as {name, list}.
function etfConstituentStocks(ticker) {
  const rows = data.health?.etfRelative?.rows || [];
  const row = rows.find((r) => r.representative === ticker
    || (r.peers || []).some((p) => (p.ticker || p) === ticker));
  if (row && Array.isArray(row.stockLeaders) && row.stockLeaders.length) {
    return { name: row.category, list: row.stockLeaders.slice() };
  }
  const meta = getSectorEtfs().find((m) => m.ticker === ticker);
  if (meta) {
    return {
      name: meta.name,
      list: getSectorStocks(meta).map((s) => ({
        ticker: s.ticker, name: s.company, rsScore: s.rsScore,
        changePct: s.changePct, monthChangePct: s.monthChangePct
      }))
    };
  }
  return null;
}

function renderEtfConstituents(item) {
  const result = etfConstituentStocks(item.ticker);
  const head = `<div class="fundamental-head"><h3>구성 종목 (상대강도순)</h3><span>${result ? escapeHtml(result.name) : "ETF"}</span></div>`;
  const box = byId("fundamentalTable");
  if (!result || !result.list.length) {
    box.innerHTML = head + `<p class="muted" style="padding:12px;">이 ETF의 구성 종목 데이터가 없습니다.</p>`;
    return;
  }
  const list = result.list.slice().sort((a, b) => (b.rsScore || 0) - (a.rsScore || 0));
  box.innerHTML = head + `
    <div class="table-wrap">
      <table class="etf-constituents-table">
        <thead><tr><th>#</th><th>티커</th><th>회사명</th><th>RS</th><th>당일</th><th>1개월</th></tr></thead>
        <tbody>
          ${list.map((s, i) => `
            <tr class="etf-con-row" data-ticker="${escapeHtml(s.ticker)}" style="cursor:pointer;">
              <td class="rank-cell">${i + 1}</td>
              <td><strong>${escapeHtml(s.ticker)}</strong></td>
              <td>${escapeHtml(s.name || "")}</td>
              <td><span class="rs-badge">${Math.round(s.rsScore || 0)}</span></td>
              <td class="${cls(s.changePct)}">${s.changePct != null ? fmtDailyPct(s.changePct) : "-"}</td>
              <td class="${cls(s.monthChangePct)}">${s.monthChangePct != null ? fmtPct(s.monthChangePct) : "-"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
  box.querySelectorAll(".etf-con-row").forEach((tr) => {
    tr.addEventListener("click", () => selectTicker(tr.dataset.ticker, { openSearch: true }));
  });
}

function valueWithClass(value) {
  const text = String(value ?? "-");
  const numeric = Number(text.replace(/[$,%MBK]/g, ""));
  const className = text.startsWith("+") ? "pos" : text.startsWith("-") ? "neg" : "";
  return `<strong class="${className}">${escapeHtml(text)}</strong>`;
}

function indexLabel(item) {
  const groups = item.groups || [];
  const labels = [];
  const cfgLabels = marketCfg().groupLabels || {};
  groups.forEach((g) => {
    if (cfgLabels[g]) labels.push(cfgLabels[g]);
  });
  if (!labels.length) {
    if (groups.includes("idx_ndx100")) labels.push("Nasdaq 100");
    if (groups.includes("idx_sp500")) labels.push("S&P 500");
    if (groups.includes("idx_nasdaq")) labels.push("Nasdaq");
    if (groups.includes("idx_nyse")) labels.push("NYSE");
    if (groups.includes("idx_kospi200")) labels.push("코스피200");
    if (groups.includes("idx_kospi")) labels.push("코스피");
    if (groups.includes("idx_kosdaq150")) labels.push("코스닥150");
    if (groups.includes("idx_kosdaq")) labels.push("코스닥");
  }
  return labels.slice(0, 2).join(", ") || "-";
}

function hasFiniteNumber(value) {
  return value !== null && value !== "" && Number.isFinite(Number(value));
}

function fmtNum(value) {
  return hasFiniteNumber(value) ? Number(value).toFixed(2) : "-";
}

function fmtMultiple(value, digits = 2) {
  return hasFiniteNumber(value) ? `${Number(value).toFixed(digits)}배` : "-";
}

function moneyOrDash(value) {
  if (!hasFiniteNumber(value)) return "-";
  return marketCfg().formatMoney(value);
}

function priceOrDash(value) {
  if (!hasFiniteNumber(value)) return "-";
  return marketCfg().formatPrice(value);
}

function fmtRatio(value) {
  return hasFiniteNumber(value) ? (Number(value) / 100).toFixed(2) : "-";
}

function fmtPercent(value) {
  return hasFiniteNumber(value) ? `${Number(value).toFixed(2)}%` : "-";
}

function fmtBillions(value) {
  if (!hasFiniteNumber(value)) return "-";
  return marketCfg().formatMarketCap(value);
}

function fmtFinancialB(value) {
  if (!hasFiniteNumber(value)) return "-";
  const n = Number(value);
  return marketCfg().formatMarketCap(isKrMarket() ? n / 1000 : n);
}

function fmtShares(value) {
  if (!hasFiniteNumber(value)) return "-";
  const n = Number(value);
  if (isKrMarket()) {
    const valInEok = n * 10;
    if (Math.abs(valInEok) >= 10000) {
      const valInJo = valInEok / 10000;
      return `${parseFloat(valInJo.toFixed(2)).toLocaleString("ko-KR")}조`;
    }
    return `${parseFloat(valInEok.toFixed(2)).toLocaleString("ko-KR")}억`;
  }
  if (Math.abs(n) >= 1) return `${parseFloat(n.toFixed(2)).toLocaleString("en-US")}B`;
  return `${parseFloat((n * 1000).toFixed(0)).toLocaleString("en-US")}M`;
}

function fmtCompact(value) {
  if (!hasFiniteNumber(value)) return "-";
  const num = Number(value);
  if (Math.abs(num) >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return `${num.toFixed(0)}`;
}

