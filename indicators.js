/*
 * indicators.js — 기술적 지표 수학의 단일 구현
 * -------------------------------------------------
 * 예전엔 같은 수식이 analysis.js(IIFE 안), chart-indicators.js(전역), chart_capture.js
 * 세 곳에 복사돼 있었고 이미 서로 어긋나 있었다(RSI 시드 50 vs 100, OBV 시드 0 vs v[0],
 * Wilder vs Cutler RSI, MFI 비교 기준, 슈퍼트렌드 초기 추세 시드, 합성봉 가드 유무).
 * 이 파일이 유일한 정의이고 세 파일은 여기를 호출만 한다.
 *
 * 규약
 *  - 의존성 없음. 어떤 스크립트보다 먼저/나중에 로드돼도 안전한 classic script 이며,
 *    부작용은 `globalThis.MirIndicators` 하나를 세우는 것뿐이다(로드 순서 안전).
 *  - 노드에서도 그대로 쓴다(scripts/build_prob_calibration.py 가 이 파일을 require 한다).
 *  - 배열 반환 함수는 입력 rows/values 와 **같은 길이**의 배열을 돌려주고, 계산 불가
 *    구간(워밍업)은 null 로 채운다. 호출부의 lastN/tail 슬라이스와 인덱스가 맞아야 한다.
 *  - 합성봉(종가만으로 시고저를 만들어낸 행, row.synthetic === true)에서는 H/L 에
 *    의존하는 지표가 전부 null 이다. 지어낸 H/L 로 계산한 숫자를 보여주지 않는다
 *    (CLAUDE.md '데이터 정직성'). 판정은 isSyntheticRows() 하나로 통일.
 *
 * PR #143 에서 고친 정의는 그대로 유지한다(회귀 금지):
 *  - 일목 선행스팬 A/B 는 +26 봉 시프트
 *  - MFI 는 전형가격(typical price) 상승/하락 기준(자금흐름 크기 비교가 아님)
 *  - RSI 는 Wilder 평활, 완전 횡보(상승분·하락분 0)는 100 이 아니라 50
 */
(function (root) {
  "use strict";

  // ===== 공통 =====

  // 종가만으로 시고저를 합성한 행인지. 행 객체의 표식을 보므로 slice/filter 를 거쳐도
  // 살아남는다(배열 프로퍼티는 slice 에서 사라져 표식으로 쓸 수 없다).
  function isSyntheticRows(rows) {
    return Array.isArray(rows) && rows.length > 0
      && rows[rows.length - 1] != null && rows[rows.length - 1].synthetic === true;
  }

  function nullsLike(rows) {
    return Array(rows.length).fill(null);
  }

  // ===== 이동평균 =====

  function smaArray(values, period) {
    const out = Array(values.length).fill(null);
    for (let i = period - 1; i < values.length; i += 1) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j += 1) sum += values[j];
      out[i] = sum / period;
    }
    return out;
  }

  // 첫 값을 시드로 쓰는 EMA(워밍업 포함 전 구간 값). 내부 계산용.
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

  // 표시용 EMA: emaRaw 결과에서 워밍업 구간(period-1)만 null.
  function emaArray(values, period) {
    const out = emaRaw(values, period);
    for (let i = 0; i < Math.min(period - 1, out.length); i += 1) out[i] = null;
    return out;
  }

  // ===== 모멘텀 / 오실레이터 =====

  // 평균 상승분/하락분 → RSI.
  // 완전 횡보(상승분·하락분 모두 0 — 거래정지·동전주 등)는 과매수(100)가 아니라 중립(50).
  function rsiFromAverages(avgGain, avgLoss) {
    if (!avgLoss) return avgGain ? 100 : 50;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  // Wilder RSI(지수 평활). 단순평균(Cutler) 변형을 쓰지 말 것 — 예전 chart_capture.js 가
  // Cutler 로 계산해 대시보드·분석 페이지와 값이 달랐다.
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
    out[period] = rsiFromAverages(gain, loss);
    for (let i = period + 1; i < values.length; i += 1) {
      const change = values[i] - values[i - 1];
      gain = (gain * (period - 1) + Math.max(0, change)) / period;
      loss = (loss * (period - 1) + Math.max(0, -change)) / period;
      out[i] = rsiFromAverages(gain, loss);
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

  function rocArray(values, period = 12) {
    return values.map((value, i) => (i < period || !values[i - period] ? null : ((value / values[i - period]) - 1) * 100));
  }

  function momentumArray(values, period = 10) {
    return values.map((value, i) => (i < period ? null : value - values[i - period]));
  }

  function stochArrays(rows, kPeriod, dPeriod) {
    const k = nullsLike(rows);
    if (isSyntheticRows(rows)) return { k, d: nullsLike(rows) };
    for (let i = kPeriod - 1; i < rows.length; i += 1) {
      let hi = -Infinity;
      let lo = Infinity;
      for (let j = i - kPeriod + 1; j <= i; j += 1) {
        hi = Math.max(hi, rows[j].h);
        lo = Math.min(lo, rows[j].l);
      }
      k[i] = hi === lo ? 50 : ((rows[i].c - lo) / (hi - lo)) * 100;
    }
    const d = nullsLike(rows);
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

  function williamsArray(rows, period = 14) {
    const out = nullsLike(rows);
    if (isSyntheticRows(rows)) return out;
    for (let i = period - 1; i < rows.length; i += 1) {
      const slice = rows.slice(i - period + 1, i + 1);
      const hi = Math.max(...slice.map((row) => row.h));
      const lo = Math.min(...slice.map((row) => row.l));
      out[i] = hi === lo ? -50 : ((hi - rows[i].c) / (hi - lo)) * -100;
    }
    return out;
  }

  function cciArray(rows, period = 20) {
    const out = nullsLike(rows);
    if (isSyntheticRows(rows)) return out;
    const typical = rows.map((row) => (row.h + row.l + row.c) / 3);
    for (let i = period - 1; i < rows.length; i += 1) {
      const chunk = typical.slice(i - period + 1, i + 1);
      const avg = chunk.reduce((sum, value) => sum + value, 0) / period;
      const meanDev = chunk.reduce((sum, value) => sum + Math.abs(value - avg), 0) / period;
      out[i] = meanDev ? (typical[i] - avg) / (0.015 * meanDev) : 0;
    }
    return out;
  }

  // ===== 변동성 =====

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

  // Wilder 평활(첫 값은 단순평균 시드).
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
    if (isSyntheticRows(rows)) return nullsLike(rows);
    return wilderArray(trueRangeArray(rows), period);
  }

  function adxArrays(rows, period = 14) {
    if (isSyntheticRows(rows)) {
      return { adx: nullsLike(rows), plusDi: nullsLike(rows), minusDi: nullsLike(rows) };
    }
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
    const adx = wilderArray(dx.map((v) => (v == null ? 0 : v)), period);
    for (let i = 0; i < period * 2 - 2 && i < adx.length; i += 1) adx[i] = null;
    return { adx, plusDi, minusDi };
  }

  function keltnerChannels(rows, period = 20, mult = 2) {
    if (isSyntheticRows(rows)) {
      return { mid: nullsLike(rows), upper: nullsLike(rows), lower: nullsLike(rows) };
    }
    const closes = rows.map((row) => row.c);
    const mid = emaArray(closes, period);
    const atr = atrArray(rows, period);
    return {
      mid,
      upper: mid.map((v, i) => (v == null || atr[i] == null ? null : v + mult * atr[i])),
      lower: mid.map((v, i) => (v == null || atr[i] == null ? null : v - mult * atr[i])),
    };
  }

  function donchianChannels(rows, period = 20) {
    const upper = nullsLike(rows);
    const lower = nullsLike(rows);
    const mid = nullsLike(rows);
    if (isSyntheticRows(rows)) return { upper, lower, mid };
    for (let i = period - 1; i < rows.length; i += 1) {
      const slice = rows.slice(i - period + 1, i + 1);
      upper[i] = Math.max(...slice.map((row) => row.h));
      lower[i] = Math.min(...slice.map((row) => row.l));
      mid[i] = (upper[i] + lower[i]) / 2;
    }
    return { upper, lower, mid };
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

  function ttmSqueezeState(rows) {
    const closes = rows.map((r) => r.c);
    const bb = bollinger(closes, 20, 2);
    const kc = keltnerChannels(rows, 20, 1.5);
    const i = rows.length - 1;
    if (i < 0 || bb.upper[i] == null || kc.upper[i] == null) return { squeezed: false, fired: false };
    const squeezed = bb.upper[i] < kc.upper[i] && bb.lower[i] > kc.lower[i];
    const prev = i > 0 && bb.upper[i - 1] != null && kc.upper[i - 1] != null
      ? bb.upper[i - 1] < kc.upper[i - 1] && bb.lower[i - 1] > kc.lower[i - 1] : false;
    return { squeezed, fired: prev && !squeezed };
  }

  // ===== 추세 =====

  // 선행스팬 A/B 는 정의상 26봉 앞으로 옮긴다(PR #143): 배열 인덱스 i 의 spanA/spanB 는
  // "i-26 시점에 계산돼 i 봉에 적용되는 구름" 이다(앞 26개는 null). 그래서 last(spanA/spanB)
  // 가 곧 현재가와 비교할 구름이다. 시프트를 되돌리지 말 것.
  // (미래 26봉 투영은 차트에 x축이 없어 생략 — 배열 길이는 rows 와 같게 유지.)
  const ICHIMOKU_SHIFT = 26;
  function ichimokuArrays(rows) {
    const n = rows.length;
    const nulls = () => Array(n).fill(null);
    if (isSyntheticRows(rows)) return { tenkan: nulls(), kijun: nulls(), spanA: nulls(), spanB: nulls() };
    const midRange = (period) => {
      const out = nulls();
      for (let i = period - 1; i < n; i += 1) {
        const slice = rows.slice(i - period + 1, i + 1);
        out[i] = (Math.max(...slice.map((r) => r.h)) + Math.min(...slice.map((r) => r.l))) / 2;
      }
      return out;
    };
    const tenkan = midRange(9);
    const kijun = midRange(26);
    const spanBRaw = midRange(52);
    const spanARaw = tenkan.map((v, i) => (v == null || kijun[i] == null ? null : (v + kijun[i]) / 2));
    const shift = (arr) => {
      const out = nulls();
      for (let i = ICHIMOKU_SHIFT; i < n; i += 1) out[i] = arr[i - ICHIMOKU_SHIFT];
      return out;
    };
    return { tenkan, kijun, spanA: shift(spanARaw), spanB: shift(spanBRaw) };
  }

  // 슈퍼트렌드 한 번 계산 → 라인 배열과 현재 추세를 함께 돌려준다.
  // 초기 추세는 **ATR 이 처음 나오는 봉**에서 hl2 기준으로 시드한다. analysis.js 쪽 사본은
  // trendUp=true 로 시작한 뒤 그 봉에서 곧바로 플립 판정을 해(이전 봉 라인이 없는데도)
  // 종목에 따라 라인이 달랐다. chart-indicators.js 쪽(올바른) 시드로 통일한다.
  function supertrendCore(rows, period = 10, mult = 3) {
    const out = nullsLike(rows);
    if (isSyntheticRows(rows)) return { values: out, bullish: false, line: null };
    const atr = atrArray(rows, period);
    const upper = nullsLike(rows);
    const lower = nullsLike(rows);
    let trendUp = true;
    for (let i = 0; i < rows.length; i += 1) {
      if (atr[i] == null) continue;
      const hl2 = (rows[i].h + rows[i].l) / 2;
      const basicUpper = hl2 + mult * atr[i];
      const basicLower = hl2 - mult * atr[i];
      upper[i] = i && upper[i - 1] != null && rows[i - 1].c <= upper[i - 1]
        ? Math.min(basicUpper, upper[i - 1]) : basicUpper;
      lower[i] = i && lower[i - 1] != null && rows[i - 1].c >= lower[i - 1]
        ? Math.max(basicLower, lower[i - 1]) : basicLower;
      if (i && out[i - 1] != null) {
        if (trendUp && rows[i].c < lower[i]) trendUp = false;
        else if (!trendUp && rows[i].c > upper[i]) trendUp = true;
      } else {
        trendUp = rows[i].c >= hl2;
      }
      out[i] = trendUp ? lower[i] : upper[i];
    }
    return { values: out, bullish: trendUp, line: out[rows.length - 1] };
  }

  function supertrendArray(rows, period = 10, mult = 3) {
    return supertrendCore(rows, period, mult).values;
  }

  function supertrendState(rows, period = 10, mult = 3) {
    const core = supertrendCore(rows, period, mult);
    return { bullish: core.bullish, line: core.line };
  }

  function chandelierExitArray(rows, period = 22, mult = 3) {
    const out = nullsLike(rows);
    if (isSyntheticRows(rows)) return out;
    const atr = atrArray(rows, period);
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

  function parabolicSarArray(rows, step = 0.02, maxStep = 0.2) {
    const out = nullsLike(rows);
    if (rows.length < 2 || isSyntheticRows(rows)) return { values: out, bullish: false };
    let bull = rows[1].c > rows[0].c;
    let af = step;
    let ep = bull ? rows[0].h : rows[0].l;
    let sar = bull ? rows[0].l : rows[0].h;
    out[0] = sar;
    for (let i = 1; i < rows.length; i += 1) {
      sar = sar + af * (ep - sar);
      if (bull) {
        if (rows[i].l < sar) { bull = false; sar = ep; ep = rows[i].l; af = step; }
        else if (rows[i].h > ep) { ep = rows[i].h; af = Math.min(maxStep, af + step); }
      } else if (rows[i].h > sar) { bull = true; sar = ep; ep = rows[i].h; af = step; }
      else if (rows[i].l < ep) { ep = rows[i].l; af = Math.min(maxStep, af + step); }
      out[i] = sar;
    }
    return { values: out, bullish: rows[rows.length - 1].c > out[rows.length - 1] };
  }

  function linearRegressionChannel(rows, period = 40) {
    const n = rows.length;
    if (n < period) return null;
    const closes = rows.slice(-period).map((r) => r.c);
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
    return { slope, upper: endY + std * 2, lower: endY - std * 2, mid: endY, start: intercept, std };
  }

  // ===== 거래량 / 자금흐름 =====

  // OBV. 시작값은 0(누적 부호부 거래량). 예전 chart-indicators.js 사본은 첫 봉의 거래량을
  // 시드로 써 analysis.js 와 전 구간이 v[0] 만큼 어긋나 있었다. OBV 는 절대 수준이 아니라
  // 기울기만 쓰므로 0 시드가 정의상 자연스럽고 두 화면의 값이 같아진다.
  function obvArray(rows) {
    const out = nullsLike(rows);
    let obv = 0;
    for (let i = 0; i < rows.length; i += 1) {
      if (!i) obv = 0;
      else if (rows[i].c > rows[i - 1].c) obv += rows[i].v || 0;
      else if (rows[i].c < rows[i - 1].c) obv -= rows[i].v || 0;
      out[i] = obv;
    }
    return out;
  }

  function accumulationDistributionArray(rows) {
    const out = nullsLike(rows);
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

  function cmfArray(rows, period = 20) {
    const out = nullsLike(rows);
    if (isSyntheticRows(rows)) return out;
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

  // MFI. 정의(PR #143): 전형가격(tp)이 전일보다 오르면 양의 자금흐름, 내리면 음, 같으면 제외.
  // 예전엔 자금흐름 크기(tp×거래량)끼리 비교해 거래량 급증일이 무조건 '유입' 으로 잡혔다.
  function mfiArray(rows, period = 14) {
    if (isSyntheticRows(rows)) return nullsLike(rows);
    const tp = rows.map((r) => (r.h + r.l + r.c) / 3);
    const rmf = rows.map((r, i) => {
      const raw = tp[i] * (r.v || 0);
      if (!i) return { pos: 0, neg: 0 };
      if (tp[i] > tp[i - 1]) return { pos: raw, neg: 0 };
      if (tp[i] < tp[i - 1]) return { pos: 0, neg: raw };
      return { pos: 0, neg: 0 };
    });
    const out = nullsLike(rows);
    for (let i = period; i < rows.length; i += 1) {
      let pos = 0;
      let neg = 0;
      for (let j = i - period + 1; j <= i; j += 1) { pos += rmf[j].pos; neg += rmf[j].neg; }
      const ratio = neg ? pos / neg : 100;
      out[i] = 100 - 100 / (1 + ratio);
    }
    return out;
  }

  // 앵커드/누적 VWAP — 전달된 첫 봉부터 누적한다(app.js 는 앵커 인덱스부터 slice 해서 부른다).
  function vwapArray(rows) {
    const out = nullsLike(rows);
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

  // 롤링 N일 VWAP. 전체 누적 VWAP 은 오래된 데이터에 지배돼 현재 신호로 의미가 약하므로,
  // 신호용은 최근 구간만 보는 이쪽을 쓴다.
  function rollingVwap(rows, period = 20) {
    const out = nullsLike(rows);
    let pv = 0;
    let vol = 0;
    for (let i = 0; i < rows.length; i += 1) {
      const tp = (rows[i].h + rows[i].l + rows[i].c) / 3;
      pv += tp * (rows[i].v || 0);
      vol += (rows[i].v || 0);
      if (i >= period) {
        const j = i - period;
        const tpj = (rows[j].h + rows[j].l + rows[j].c) / 3;
        pv -= tpj * (rows[j].v || 0);
        vol -= (rows[j].v || 0);
      }
      if (i >= period - 1) out[i] = vol ? pv / vol : tp;
    }
    return out;
  }

  // ===== 가격 레벨 =====

  function floorTraderPivots(rows) {
    if (rows.length < 2) return null;
    const prev = rows[rows.length - 2];
    const p = (prev.h + prev.l + prev.c) / 3;
    return {
      pivot: p,
      r1: 2 * p - prev.l,
      r2: p + (prev.h - prev.l),
      s1: 2 * p - prev.h,
      s2: p - (prev.h - prev.l),
    };
  }

  function fibonacciLevels(rows, lookback = 60) {
    const slice = rows.slice(-lookback);
    if (!slice.length) return null;
    const hi = Math.max(...slice.map((r) => r.h));
    const lo = Math.min(...slice.map((r) => r.l));
    const range = hi - lo;
    return {
      high: hi,
      low: lo,
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

  // ===== 통계 유틸 =====

  // 이항 비율의 윌슨 신뢰구간(정규 근사보다 작은 n·극단 비율에서 안정적).
  function wilsonInterval(successes, n, z = 1.96) {
    if (!n) return { low: 0, high: 1 };
    const p = successes / n;
    const z2 = z * z;
    const denom = 1 + z2 / n;
    const center = (p + z2 / (2 * n)) / denom;
    const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
    return { low: Math.max(0, center - half), high: Math.min(1, center + half) };
  }

  const API = {
    // 판정 / 상수
    isSyntheticRows,
    ICHIMOKU_SHIFT,
    // 이동평균
    smaArray,
    smaSeries: smaArray, // chart-indicators.js/app.js 가 쓰던 이름
    emaRaw,
    emaArray,
    // 모멘텀/오실레이터
    rsiFromAverages,
    rsiSeries,
    macdSeries,
    rocArray,
    momentumArray,
    stochArrays,
    williamsArray,
    cciArray,
    // 변동성
    bollinger,
    trueRangeArray,
    wilderArray,
    atrArray,
    adxArrays,
    keltnerChannels,
    donchianChannels,
    ttmSqueezeSeries,
    ttmSqueezeState,
    // 추세
    ichimokuArrays,
    supertrendCore,
    supertrendArray,
    supertrendState,
    chandelierExitArray,
    parabolicSarArray,
    linearRegressionChannel,
    // 거래량/자금흐름
    obvArray,
    accumulationDistributionArray,
    cmfArray,
    mfiArray,
    vwapArray,
    rollingVwap,
    // 레벨
    floorTraderPivots,
    fibonacciLevels,
    // 통계
    wilsonInterval,
  };

  root.MirIndicators = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
