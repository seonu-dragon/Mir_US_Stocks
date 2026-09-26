// 가격 차트 세로 축(가격 축) 스케일 — 순수 계산 모듈(DOM 없음).
// 브라우저에서는 window.MirYScale, node 테스트(scripts/tests/test_chart_yscale_core.mjs)에서는
// module.exports 로 같은 코드를 쓴다. IIFE 라 최상위 이름을 전역에 흘리지 않는다.
//
// 종목 분석 차트(chart.js, SVG)와 AI 모드 차트(ai-cosmos.js, 캔버스)가 같이 쓴다.
// TradingView 의 가격 축 조작을 참고했다:
//   - 가격 축을 위/아래로 드래그 → 세로 배율(드래그 아래 = 압축, 위 = 늘림)
//   - 세로 배율을 바꾸면 자동 맞춤(auto) 이 꺼지고, 더블클릭·A 토글로 다시 켠다
//   - 자동 맞춤이 꺼져 있으면 본문 드래그가 가로·세로 모두 이동
//   - 로그 스케일(L): 모든 변환을 log10 공간에서 한다(줌·팬·눈금·오버레이 좌표 동일 규칙)
//
// 용어
// - range = { min, max }: 화면 위(max)~아래(min) 에 대응하는 가격(실제 가격 단위).
// - T(v): 변환 공간 좌표. 선형이면 v, 로그면 log10(v). 줌·팬은 전부 T 공간에서 한다 —
//   그래야 로그에서 "같은 드래그 = 같은 비율 변화" 가 되고, 선형/로그가 한 코드로 된다.
// - state = { auto, log, min, max }: 어댑터가 들고 있는 축 상태. auto 면 min/max 는 무시.
(function (root) {
  "use strict";

  // 로그 스케일에서 쓸 수 있는 가장 작은 가격(0·음수 방지).
  const LOG_FLOOR = 1e-9;
  // 수동 범위가 자동 범위 대비 너무 좁거나 넓어지지 않게(무한 확대/축소 방지).
  const MIN_SPAN_RATIO = 1 / 400;
  const MAX_SPAN_RATIO = 60;

  function isNum(v) {
    return typeof v === "number" && Number.isFinite(v);
  }

  function toT(v, log) {
    if (!isNum(v)) return NaN;
    if (!log) return v;
    return v > 0 ? Math.log10(v) : NaN;
  }

  function fromT(t, log) {
    if (!isNum(t)) return NaN;
    return log ? Math.pow(10, t) : t;
  }

  function validRange(r, log) {
    if (!r || !isNum(r.min) || !isNum(r.max) || !(r.max > r.min)) return false;
    if (log && !(r.min > 0)) return false;
    return true;
  }

  // 보이는 봉 저가·고가(lo·hi) → 자동 맞춤 범위. padFrac 는 T 공간 여백 비율(위·아래 각각).
  // 로그에서 lo<=0 이면(가격이 0 이하인 이상 데이터) 양수 최소값으로 올린다.
  function autoRange(lo, hi, padFrac, log) {
    const pad = isNum(padFrac) && padFrac > 0 ? padFrac : 0;
    let a = Math.min(lo, hi);
    let b = Math.max(lo, hi);
    if (!isNum(a) || !isNum(b)) return { min: 0, max: 1 };
    if (log) {
      if (!(b > 0)) return { min: LOG_FLOOR, max: 1 };
      if (!(a > 0)) a = Math.max(LOG_FLOOR, b * 1e-6);
    }
    if (a === b) {
      // 한 값뿐이면 ±1%(0 이면 ±1) 로 벌린다.
      const d = a === 0 ? 1 : Math.abs(a) * 0.01;
      a -= d;
      b += d;
      if (log && !(a > 0)) a = b / 1.0202;
    }
    if (!pad) return { min: a, max: b };
    const ta = toT(a, log);
    const tb = toT(b, log);
    const p = (tb - ta) * pad;
    return { min: fromT(ta - p, log), max: fromT(tb + p, log) };
  }

  // T 공간에서 폭을 [ref폭 × MIN, ref폭 × MAX] 로 제한(가운데 유지). ref 가 없으면 폭만 양수로.
  function clampRange(range, log, ref) {
    let t0 = toT(range.min, log);
    let t1 = toT(range.max, log);
    if (!isNum(t0) || !isNum(t1)) return ref ? { min: ref.min, max: ref.max } : { min: range.min, max: range.max };
    if (t1 < t0) { const s = t0; t0 = t1; t1 = s; }
    let span = t1 - t0;
    const mid = (t0 + t1) / 2;
    let lo = 0;
    let hi = Infinity;
    if (ref && validRange(ref, log)) {
      const refSpan = toT(ref.max, log) - toT(ref.min, log);
      if (refSpan > 0) {
        lo = refSpan * MIN_SPAN_RATIO;
        hi = refSpan * MAX_SPAN_RATIO;
      }
    }
    // 부동소수 한계: 가운데 크기 대비 1e-9 보다 좁히지 않는다.
    lo = Math.max(lo, Math.abs(mid) * 1e-9, 1e-12);
    if (span < lo) span = lo;
    if (span > hi) span = hi;
    if (span === t1 - t0) return { min: fromT(t0, log), max: fromT(t1, log) };
    return { min: fromT(mid - span / 2, log), max: fromT(mid + span / 2, log) };
  }

  // factor>1 → 범위가 넓어짐(축소), <1 → 좁아짐(확대). anchor(가격) 위치가 화면에서 고정된다.
  // anchor 가 없거나 범위 밖이어도 공식은 성립한다(범위 밖 앵커는 그쪽으로 끌려가는 줌).
  function zoomRange(range, factor, anchor, log, ref) {
    if (!validRange(range, log) || !isNum(factor) || factor <= 0) return range;
    const t0 = toT(range.min, log);
    const t1 = toT(range.max, log);
    let ta = toT(anchor, log);
    if (!isNum(ta)) ta = (t0 + t1) / 2;
    const out = { min: fromT(ta - (ta - t0) * factor, log), max: fromT(ta + (t1 - ta) * factor, log) };
    return clampRange(out, log, ref);
  }

  // 세로 이동. dyPx>0(아래로 끎) → 내용이 아래로 내려가도록 범위를 위로 민다.
  function panRange(range, dyPx, heightPx, log) {
    if (!validRange(range, log) || !isNum(dyPx) || !(heightPx > 0)) return range;
    const t0 = toT(range.min, log);
    const t1 = toT(range.max, log);
    const dT = (dyPx / heightPx) * (t1 - t0);
    return { min: fromT(t0 + dT, log), max: fromT(t1 + dT, log) };
  }

  // 가격 축 드래그 거리 → 줌 배율. 아래로 끌면(dy>0) 압축(범위 넓힘), 위로 끌면 늘림.
  // 축 높이만큼 끌면 e^sensitivity 배(기본 약 7.4배).
  function dragZoomFactor(dyPx, heightPx, sensitivity) {
    const s = isNum(sensitivity) ? sensitivity : 2;
    if (!isNum(dyPx) || !(heightPx > 0)) return 1;
    return Math.exp((dyPx / heightPx) * s);
  }

  // 휠 한 칸 → 줌 배율. 아래로(deltaY>0) = 축소.
  function wheelZoomFactor(deltaY, step) {
    const k = isNum(step) && step > 1 ? step : 1.12;
    if (!isNum(deltaY) || deltaY === 0) return 1;
    return deltaY > 0 ? k : 1 / k;
  }

  // 두 손가락 세로 핀치: 시작 간격/현재 간격. 벌리면(<1) 확대.
  function pinchZoomFactor(startDist, dist) {
    if (!(startDist > 0) || !(dist > 0)) return 1;
    return startDist / dist;
  }

  // 픽셀 좌표 변환기. top=플롯 위 y, height=플롯 높이. 로그면 T 공간 선형.
  function createScale(opts) {
    const log = Boolean(opts && opts.log);
    const top = isNum(opts && opts.top) ? opts.top : 0;
    const height = isNum(opts && opts.height) && opts.height > 0 ? opts.height : 1;
    let min = opts && opts.min;
    let max = opts && opts.max;
    if (!validRange({ min, max }, log)) {
      const r = autoRange(min, max, 0, log);
      min = r.min;
      max = r.max;
    }
    const t0 = toT(min, log);
    const t1 = toT(max, log);
    const span = (t1 - t0) || 1;
    return {
      min, max, log, top, height,
      y(v) {
        const t = toT(v, log);
        if (!isNum(t)) return NaN;
        return top + ((t1 - t) / span) * height;
      },
      value(y) {
        return fromT(t1 - ((y - top) / height) * span, log);
      },
      // 값이 화면 범위(경계 포함) 안인가 — 선 끊기·라벨 생략 판정용.
      inRange(v) {
        return isNum(v) && v >= min && v <= max && (!log || v > 0);
      },
    };
  }

  // 1·2·2.5·5 × 10^k 중 raw 이상인 가장 작은 값.
  function niceStep(raw) {
    if (!isNum(raw) || raw <= 0) return 1;
    const exp = Math.floor(Math.log10(raw));
    const mag = Math.pow(10, exp);
    const f = raw / mag;
    let m;
    if (f <= 1 + 1e-9) m = 1;
    else if (f <= 2 + 1e-9) m = 2;
    else if (f <= 2.5 + 1e-9) m = 2.5;
    else if (f <= 5 + 1e-9) m = 5;
    else m = 10;
    return m * mag;
  }

  // 눈금 간격에 맞는 소수 자릿수(2.5 × 10^k 는 한 자리 더).
  function stepDecimals(step) {
    if (!isNum(step) || step <= 0) return 0;
    const exp = Math.floor(Math.log10(step) + 1e-9);
    const mant = step / Math.pow(10, exp);
    const extra = Math.abs(mant - 2.5) < 1e-6 ? 1 : 0; // 2.5·0.25 는 한 자리 더, 25·250 은 정수
    return Math.min(8, Math.max(0, -exp + extra));
  }

  function roundTo(v, dec) {
    const p = Math.pow(10, dec);
    return Math.round(v * p) / p;
  }

  // 선형 눈금: [min,max] 안의 step 배수. target 은 대략의 개수.
  function linearTicks(min, max, target) {
    const n = isNum(target) && target >= 2 ? target : 5;
    if (!isNum(min) || !isNum(max) || !(max > min)) return { step: 0, ticks: [] };
    // 1·2·2.5·5 × 10^k 후보 중 눈금 개수가 target 에 가장 가까운 간격(동점이면 넓은 쪽).
    const span = max - min;
    const baseExp = Math.floor(Math.log10(span / n));
    let step = niceStep(span / n);
    let bestScore = Infinity;
    for (let e = baseExp - 1; e <= baseExp + 1; e += 1) {
      for (const m of [1, 2, 2.5, 5]) {
        const s = m * Math.pow(10, e);
        const count = Math.floor(max / s + 1e-9) - Math.ceil(min / s - 1e-9) + 1;
        // 2.5 배수는 1·2·5 보다 덜 읽기 쉬워 같은 개수면 뒤로 민다.
        const score = Math.abs(count - n) + (m === 2.5 ? 0.25 : 0);
        if (count < 2) continue;
        if (score < bestScore - 1e-9 || (Math.abs(score - bestScore) <= 1e-9 && s > step)) { bestScore = score; step = s; }
      }
    }
    const dec = stepDecimals(step);
    const first = Math.ceil(min / step - 1e-9) * step;
    const out = [];
    for (let v = first, i = 0; v <= max + step * 1e-9 && i < 200; i += 1, v = first + i * step) {
      out.push(roundTo(v, dec + 2));
    }
    return { step, ticks: out };
  }

  // 로그 눈금: 범위가 3배 미만이면 선형 눈금(거의 선형이라 보기 좋은 값이 낫다).
  // 그보다 넓으면 10^k × 가수 집합 중 target 에 가장 가까운 개수의 집합을 고른다.
  const LOG_MANTISSA_SETS = [
    [1],
    [1, 3],
    [1, 2, 5],
    [1, 1.5, 2, 3, 5, 7],
    [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9],
  ];
  function logTicks(min, max, target) {
    const n = isNum(target) && target >= 2 ? target : 5;
    if (!isNum(min) || !isNum(max) || !(max > min) || !(min > 0)) return { step: 0, ticks: [] };
    if (max / min < 3) return linearTicks(min, max, n);
    const e0 = Math.floor(Math.log10(min));
    const e1 = Math.ceil(Math.log10(max));
    let best = null;
    for (const set of LOG_MANTISSA_SETS) {
      const ticks = [];
      for (let e = e0; e <= e1; e += 1) {
        const mag = Math.pow(10, e);
        for (const m of set) {
          const v = roundTo(m * mag, Math.max(0, -e + 2));
          if (v >= min * (1 - 1e-9) && v <= max * (1 + 1e-9)) ticks.push(v);
        }
      }
      const score = Math.abs(ticks.length - n) + (ticks.length < 2 ? 100 : 0);
      if (!best || score < best.score) best = { score, ticks };
    }
    // 가장 작은 인접 간격을 step 으로(라벨 소수 자릿수 결정용).
    let step = 0;
    for (let i = 1; i < best.ticks.length; i += 1) {
      const d = best.ticks[i] - best.ticks[i - 1];
      if (!step || d < step) step = d;
    }
    return { step: step ? niceStep(step) : 0, ticks: best.ticks };
  }

  function ticks(min, max, log, target) {
    return log ? logTicks(min, max, target) : linearTicks(min, max, target);
  }

  // ---- 상태 ----
  function createState(opts) {
    return { auto: true, log: Boolean(opts && opts.log), min: null, max: null };
  }

  // 현재 화면에 보일 범위. auto 거나 수동 범위가 이 스케일에서 못 쓰는 값이면 자동 범위.
  function resolveRange(state, autoLo, autoHi, padFrac) {
    const log = Boolean(state && state.log);
    const auto = autoRange(autoLo, autoHi, padFrac, log);
    if (!state || state.auto) return { min: auto.min, max: auto.max, auto: true, log };
    const manual = { min: state.min, max: state.max };
    if (!validRange(manual, log)) return { min: auto.min, max: auto.max, auto: true, log };
    return { min: manual.min, max: manual.max, auto: false, log };
  }

  function withManual(state, range) {
    return { ...state, auto: false, min: range.min, max: range.max };
  }

  function withAuto(state) {
    return { ...state, auto: true, min: null, max: null };
  }

  // 로그 전환. 수동 범위는 그대로 두되 로그에서 못 쓰면(min<=0) 자동으로 복귀.
  function withLog(state, log) {
    const next = { ...state, log: Boolean(log) };
    if (!next.auto && !validRange({ min: next.min, max: next.max }, next.log)) return withAuto(next);
    return next;
  }

  // 점(x,y) 이 가격 축 영역(플롯 오른쪽 ~ 끝, 플롯 위~아래)에 있는가.
  function hitPriceAxis(x, y, g) {
    if (!g) return false;
    const right = g.plotRight;
    const end = isNum(g.axisEnd) ? g.axisEnd : Infinity;
    return x >= right && x <= end && y >= g.top && y <= g.top + g.height;
  }

  const api = {
    LOG_FLOOR,
    MIN_SPAN_RATIO,
    MAX_SPAN_RATIO,
    toT,
    fromT,
    validRange,
    autoRange,
    clampRange,
    zoomRange,
    panRange,
    dragZoomFactor,
    wheelZoomFactor,
    pinchZoomFactor,
    createScale,
    niceStep,
    stepDecimals,
    linearTicks,
    logTicks,
    ticks,
    createState,
    resolveRange,
    withManual,
    withAuto,
    withLog,
    hitPriceAxis,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirYScale = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
