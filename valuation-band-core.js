// PER·PBR 밴드 — 순수 계산 모듈(DOM 없음, 시장 무관).
// 브라우저에서는 window.MirValBandCore, node 테스트(scripts/tests/test_valuation_band_core.mjs)에서는
// module.exports 로 같은 코드를 쓴다. IIFE 라 최상위 이름을 전역에 흘리지 않는다.
//
// 입력 시리즈(시장 무관): { dates: ["YYYY-MM", ...], close: [수정종가|null], mult: [배수|-1|null] }
//   mult 가 양수면 그 달 배수(PER 또는 PBR), -1 이면 적자(PER 만 해당), null 이면 자료 없음.
// 밴드 k = 그 달 주당 값(= 수정종가 ÷ 배수) × 과거 배수 분위 k. 분할과 무관하다(비율끼리 나눔).
// US 도 같은 모양으로 넘기면 같은 컴포넌트를 쓴다(valuation-band.js 의 renderValBandChart).
(function (root) {
  "use strict";

  const DEFAULT_QUANTILES = [0.1, 0.25, 0.5, 0.75, 0.9];

  // 티커 → 샤드 번호. scripts/build_kr_valuation_band.py 의 shard_of 와 1:1 같아야 한다.
  function shardOf(code, n) {
    let h = 0;
    const s = String(code);
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000003;
    return h % n;
  }

  function monthSeq(m0, n) {
    const y = Number(m0.slice(0, 4));
    const m = Number(m0.slice(5, 7)) - 1;
    const out = [];
    for (let i = 0; i < n; i++) {
      const idx = y * 12 + m + i;
      out.push(`${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`);
    }
    return out;
  }

  // 샤드 JSON 에서 한 종목을 꺼내 { dates, close, per, pbr, psr } 로. 없으면 null.
  // psr("s")은 US 샤드에만 있다 — 없으면 null(카드가 PSR 탭을 만들지 않는다).
  function seriesFromShard(shard, code) {
    if (!shard || !shard.t || !shard.m0 || !Number.isFinite(shard.n)) return null;
    const s = shard.t[code];
    if (!s) return null;
    return { dates: monthSeq(shard.m0, shard.n), close: s.c || [], per: s.p || [], pbr: s.b || [], psr: Array.isArray(s.s) ? s.s : null };
  }

  // 정렬된 배열의 선형 보간 분위(numpy 기본과 같음).
  function quantileSorted(sorted, q) {
    const n = sorted.length;
    if (!n) return NaN;
    if (n === 1) return sorted[0];
    const pos = (n - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }

  // value 가 values 안에서 몇 분위인지(0~100, 동점 절반).
  function percentileOf(values, value) {
    if (!values.length || !Number.isFinite(value)) return NaN;
    let below = 0;
    let equal = 0;
    for (const v of values) {
      if (v < value) below++;
      else if (v === value) equal++;
    }
    return ((below + 0.5 * equal) / values.length) * 100;
  }

  const isPos = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;

  // 밴드 계산. opts.currentPrice 가 있으면 '현재 배수' = 현재가 ÷ 최근 유효 주당 값.
  function computeBands(series, opts = {}) {
    const quantiles = opts.quantiles || DEFAULT_QUANTILES;
    const minPoints = opts.minPoints || 24;
    const { dates, close, mult } = series;
    const n = dates.length;
    const base = new Array(n).fill(null);       // 주당 이익/자산(수정종가 단위)
    const valid = [];
    let lossMonths = 0;
    for (let i = 0; i < n; i++) {
      if (mult[i] === -1) lossMonths++;
      if (isPos(mult[i]) && isPos(close[i])) {
        base[i] = close[i] / mult[i];
        valid.push(mult[i]);
      }
    }
    if (valid.length < minPoints) {
      return { ok: false, reason: "few", validCount: valid.length, lossMonths, n };
    }
    const sorted = valid.slice().sort((a, b) => a - b);
    const levels = quantiles.map((q) => quantileSorted(sorted, q));
    const bands = levels.map((lv) => base.map((b) => (b == null ? null : b * lv)));
    let lastBaseIdx = -1;
    for (let i = n - 1; i >= 0; i--) if (base[i] != null) { lastBaseIdx = i; break; }
    let lastCloseIdx = -1;
    for (let i = n - 1; i >= 0; i--) if (isPos(close[i])) { lastCloseIdx = i; break; }
    const lastLoss = lastCloseIdx >= 0 && mult[lastCloseIdx] === -1;
    // 최근 달이 적자면 '현재 배수' 가 정의되지 않는다(과거 EPS 로 나누면 오해를 부른다).
    const baseIsCurrent = lastBaseIdx >= 0 && lastBaseIdx === lastCloseIdx;
    let current = null;
    if (baseIsCurrent) {
      const price = isPos(opts.currentPrice) ? opts.currentPrice : close[lastBaseIdx];
      const m = price / base[lastBaseIdx];
      current = { mult: m, pct: percentileOf(valid, m), price, fromMonth: dates[lastBaseIdx] };
    }
    return {
      ok: true, n, quantiles, levels, bands, base, validCount: valid.length, lossMonths,
      min: sorted[0], max: sorted[sorted.length - 1], lastLoss, current,
      firstValid: dates[base.findIndex((b) => b != null)], lastValid: lastBaseIdx >= 0 ? dates[lastBaseIdx] : null,
    };
  }

  // 기본 탭: 최근 달 적자이거나 PER 유효 표본이 모자라면 PBR, 아니면 PER.
  function defaultMetric(perResult, pbrResult) {
    if (!perResult || !perResult.ok || perResult.lastLoss || !perResult.current) {
      return pbrResult && pbrResult.ok ? "pbr" : "per";
    }
    return "per";
  }

  // 값 배열 → SVG path. null 은 선을 끊는다(적자·자료 없음 구간).
  function linePath(values, xOf, yOf) {
    let d = "";
    let pen = false;
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (v == null || !Number.isFinite(v)) { pen = false; continue; }
      d += `${pen ? "L" : "M"}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`;
      pen = true;
    }
    return d;
  }

  // 두 밴드 사이 영역(연속 구간마다 닫힌 다각형). 둘 중 하나라도 null 이면 끊는다.
  function areaPath(lower, upper, xOf, yOf) {
    let d = "";
    let seg = [];
    const flush = () => {
      if (seg.length >= 2) {
        d += "M" + seg.map((i) => `${xOf(i).toFixed(1)},${yOf(upper[i]).toFixed(1)}`).join("L");
        d += "L" + seg.slice().reverse().map((i) => `${xOf(i).toFixed(1)},${yOf(lower[i]).toFixed(1)}`).join("L") + "Z";
      }
      seg = [];
    };
    for (let i = 0; i < lower.length; i++) {
      if (lower[i] == null || upper[i] == null) { flush(); continue; }
      seg.push(i);
    }
    flush();
    return d;
  }

  // 적자 달의 연속 구간 [시작, 끝] 인덱스 목록(차트 음영용).
  function lossRanges(mult) {
    const out = [];
    let s = -1;
    for (let i = 0; i <= mult.length; i++) {
      const loss = i < mult.length && mult[i] === -1;
      if (loss && s < 0) s = i;
      if (!loss && s >= 0) { out.push([s, i - 1]); s = -1; }
    }
    return out;
  }

  // 세로축 눈금 글자. step 은 눈금 간격(1·2·2.5·5 × 10^k, chart-yscale-core 의 linearTicks 가 고름).
  // 소수 자릿수는 간격에서 정한다 — 같은 축의 글자는 자릿수가 같다.
  // 원화: 1억 이상은 '억', 간격이 1만 이상이면 '만'(보통 정수), 그 아래는 원 단위 정수(천 단위 쉼표).
  // 달러: 간격이 100 이상이고 값이 1000 이상이면 'k', 아니면 간격에 맞는 소수.
  function stepDec(step) {
    if (!(step > 0)) return 0;
    const exp = Math.floor(Math.log10(step) + 1e-9);
    const mant = step / Math.pow(10, exp);
    return Math.min(4, Math.max(0, -exp + (Math.abs(mant - 2.5) < 1e-6 ? 1 : 0)));
  }
  function axisTickLabel(v, step, market) {
    if (!Number.isFinite(v)) return "";
    if (market === "kr") {
      if (Math.abs(v) >= 1e8 && step >= 1e6) return `${(v / 1e8).toFixed(stepDec(step / 1e8))}억`;
      if (step >= 1e4 || (Math.abs(v) >= 1e4 && step >= 1e3)) {
        if (v === 0) return "0";
        return `${(v / 1e4).toLocaleString("ko-KR", { minimumFractionDigits: stepDec(step / 1e4), maximumFractionDigits: stepDec(step / 1e4) })}만`;
      }
      return Math.round(v).toLocaleString("ko-KR");
    }
    if (Math.abs(v) >= 1000 && step >= 100) return `$${(v / 1000).toFixed(stepDec(step / 1000))}k`;
    return `$${v.toFixed(stepDec(step))}`;
  }

  const api = { axisTickLabel, DEFAULT_QUANTILES, shardOf, monthSeq, seriesFromShard, quantileSorted, percentileOf, computeBands, defaultMetric, linePath, areaPath, lossRanges };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirValBandCore = api;
})(typeof window !== "undefined" ? window : null);
