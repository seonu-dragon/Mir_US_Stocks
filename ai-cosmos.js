  // storage.js(첫 스크립트) 가 window.safeStorage 를 보장한다.
  const storage = window.safeStorage;/**
 * AI mode — multi loss-landscape backdrop (3D terrains + physics ball)
 * morphs into a 2D stock chart when the user requests a ticker.
 */
(function () {
  const GRID_MAX = 44;
  const GRID_MIN = 20;
  const GRID_FPS_TARGET = 30;
  const GRID_FPS_RECOVER = 52;
  let gridRes = GRID_MAX;
  let fpsSamples = [];
  let fpsCheckTs = 0;
  const BG = "#080b12";
  const STAR_COUNT = 92;
  const EPOCH_CYCLE = 108;
  const WAVE_WIDTH = 0.38;
  const TRAIN_PHASE = 0.88;
  const AUTO_YAW_RATE = 0.032;
  const BALL_GRAVITY = 0.0032;
  const BALL_MAX_SPEED = 0.0045;
  const BALL_MIN_SPEED = 0.0016;
  const BALL_DAMPING = 0.9975;
  const BALL_FLAT_GRAD = 0.018;
  const BALL_ESCAPE_PUSH = 0.0024;
  const BALL_ORBIT_PUSH = 0.0011;
  const BALL_ESCAPE_PROBE = 0.07;
  const BALL_STUCK_MOVE_EPS = 0.00006;
  const BALL_HIT_RADIUS = 16;
  const BASE_SCALE = 0.39;
  const CAM_CENTER_X = 0.5;
  const CAM_CENTER_Y = 0.46;
  const PROJ_X = 0.9;
  const PROJ_Y = 0.36;
  const PROJ_Z = 0.5;
  const DEFAULT_YAW = 0;
  const DEFAULT_PITCH = 0.12;
  const DEFAULT_ROLL = 0;
  let camCenterY = CAM_CENTER_Y;
  let targetCamCenterY = CAM_CENTER_Y;
  let targetViewScale = BASE_SCALE;
  let targetViewPitch = DEFAULT_PITCH;
  const MORPH_DURATION = 2200;
  const MORPH_CRISP_START = 0.52;
  const MORPH_MESH_FADE_START = 0.6;
  const REVEAL_EDGE = 0.34;
  // 고정 봉수 기간. "1W"=최근 5거래일(일봉만 있어 진짜 인트라데이는 없음, 정직하게 5거래일).
  // "YTD"(연초이후)는 봉수가 아니라 날짜로 잘라야 해서 여기엔 없고 sliceBarsByRange 에서 특수 처리한다.
  const RANGE_BARS = { "1W": 5, "1M": 22, "3M": 66, "6M": 126, "1Y": 252, "2Y": 504, "5Y": 1260 };
  // 차트 캔들 유형 — candle(캔들)·line(종가선)·heikin(헤이킨아시). localStorage 에 유지.
  const CHART_STYLE_LS_KEY = "mir_ai_chart_style";
  const CHART_STYLES = new Set(["candle", "line", "heikin"]);
  // storage.js(첫 스크립트) 가 window.safeStorage 를 보장한다.
  const storage = window.safeStorage;
  let chartStyle = (() => {
    const s = storage.get(CHART_STYLE_LS_KEY);
    return CHART_STYLES.has(s) ? s : "candle";
  })();
  // 차트 모드는 정적이라 60fps 루프를 돌리지 않는다. 별 반짝임만 ≤10fps 타이머로 살린다.
  const CHART_TWINKLE_MS = 120;
  let chartTwinkleTimer = 0;
  const PATTERN_MAX_FULL = 60; // 캐시에 유지할 최대 패턴 수(초과 시 시간축 고르게 샘플)
  const PATTERN_MAX_RENDER = 6; // 한 화면(가시 구간)에 그릴 최대 패턴 수(가독성)
  const CHART_TARGET_YAW = 0;
  const CHART_TARGET_PITCH = 1.12;
  const CHART_TARGET_ROLL = 0;
  const CHART_TARGET_SCALE = 0.52;

  const LANDSCAPES = [
    { id: "multiModal", height: heightMultiModal },
    { id: "saddle", height: heightSaddle },
    { id: "convergence", height: heightConvergence },
    { id: "plateau", height: heightPlateau },
    { id: "ripple", height: heightRipple },
    { id: "doubleWell", height: heightDoubleWell },
    { id: "rosenbrock", height: heightRosenbrock },
    { id: "noisyBowl", height: heightNoisyBowl },
    { id: "canyon", height: heightCanyon },
    { id: "spurious", height: heightSpuriousMinima },
    { id: "oscillation", height: heightOscillation },
    { id: "vanishing", height: heightVanishing },
  ];

  let root = null;
  let canvas = null;
  let ctx = null;
  let raf = 0;
  let running = false;
  let epoch = 0;
  let resizeObs = null;
  let reducedMotion = false;

  let viewYaw = DEFAULT_YAW;
  let viewPitch = DEFAULT_PITCH;
  let viewRoll = DEFAULT_ROLL;
  let viewScale = BASE_SCALE;
  let isDragging = false;
  let isZoomDrag = false;
  let lastPointerX = 0;
  let lastPointerY = 0;

  let optX = -0.3;
  let optY = -0.15;
  let velX = 0.001;
  let velY = 0.0008;
  let wanderPhase = 0;
  let stuckFrames = 0;
  const optTrail = [];
  const TRAIL_LEN = 32;

  let renderMode = "landscape";
  let morphT = 0;
  let morphStart = 0;
  let morphFromYaw = DEFAULT_YAW;
  let morphFromPitch = DEFAULT_PITCH;
  let morphFromRoll = DEFAULT_ROLL;
  let morphFromScale = BASE_SCALE;
  let morphEpoch = 0;
  let chartBars = [];
  let chartFullBars = []; // 원본 전체 bars(기간 탭 전환 시 재슬라이스용)
  let chartViewStart = 0; // 가시 윈도우 시작 인덱스(확대/이동용, float)
  let chartViewCount = 0; // 가시 윈도우 바 개수
  let chartOverlays = null; // {sr:[price], trendlines:[{kind,x1,y1,x2,y2}], patterns:[{confirm_idx,...}]}
  const MIN_CHART_BARS = 12;
  let chartMeta = { ticker: "", name: "", range: "6M" };
  let chartPriceMin = 0;
  let chartPriceMax = 1;
  let morphCallback = null;
  let lastDrawTs = 0;
  let stars = [];
  let starsSizeKey = "";
  let lastLayoutKey = "";
  let pinchStartDist = 0;
  let pinchStartScale = BASE_SCALE;
  let chartPinchStartCount = 0; // 차트 모드 핀치 시작 시 가시 봉 수
  const activePointers = new Map();

  /* ── Landscape primitives (3D z = f(x,y,t)) ── */

  function heightMultiModal(x, y, t) {
    const deepen = 0.55 + t * 0.45;
    const peak =
      1.35 *
      Math.exp(-((x + 0.34) ** 2 + (y - 0.05) ** 2) / (0.07 - t * 0.012));
    const peakR = 0.5 * Math.exp(-((x - 0.42) ** 2 + (y + 0.14) ** 2) / 0.12);
    const gMin =
      -1.05 * deepen *
      Math.exp(-((x - 0.22) ** 2 + (y + 0.52) ** 2) / (0.055 - t * 0.008));
    const lMin =
      -0.38 * (1 - t * 0.5) *
      Math.exp(-((x + 0.55) ** 2 + (y + 0.3) ** 2) / 0.09);
    return peak + peakR + gMin + lMin;
  }

  function heightSaddle(x, y, t) {
    const sx = x * 0.85;
    const sy = y * 0.85;
    const saddle = 0.55 * (sx * sx - sy * sy * (0.9 + t * 0.2));
    const twist = 0.12 * Math.sin(sx * 2.4 + t * 1.2) * Math.cos(sy * 2.1);
    const drain =
      -0.65 * t *
      Math.exp(-((x - 0.15) ** 2 + (y + 0.45) ** 2) / 0.14);
    return saddle + twist + drain;
  }

  function heightConvergence(x, y, t) {
    const r2 = x * x + y * y;
    const bowl = -1.15 * (1 + t * 0.35) * (1 - Math.exp(-r2 / (0.55 - t * 0.1)));
    const ring = 0.22 * (1 - t) * Math.exp(-((Math.sqrt(r2) - 0.55) ** 2) / 0.04);
    return bowl + ring;
  }

  function heightPlateau(x, y, t) {
    const flat = 0.35 * (1 - t * 0.6);
    const core = flat * Math.exp(-(x * x + y * y) / (0.35 + t * 0.08));
    const walls =
      0.75 *
      (Math.exp(-((x - 0.55) ** 2 + y * y) / 0.06) +
        Math.exp(-((x + 0.55) ** 2 + y * y) / 0.06));
    const edgeDrop = -0.9 * t * Math.exp(-(x * x + y * y) / 0.8);
    return core + walls + edgeDrop;
  }

  function heightRipple(x, y, t) {
    const amp = 0.38 * (1 - t * 0.82);
    const freq = 3.5 + t * 2;
    const rip =
      amp *
      (Math.sin(freq * x + t * 2) * Math.cos(freq * y * 0.9 - t * 1.5) +
        0.5 * Math.sin(freq * 1.3 * (x + y)));
    const settle =
      -0.85 * t * Math.exp(-((x - 0.1) ** 2 + (y + 0.2) ** 2) / (0.2 + t * 0.15));
    return rip + settle + 0.08;
  }

  function heightDoubleWell(x, y, t) {
    const barrier = 0.45 * (1 - t * 0.7);
    const wellL =
      -0.95 * Math.exp(-((x + 0.42) ** 2 + (y - 0.08) ** 2) / (0.07 - t * 0.015));
    const wellR =
      -1.05 * t *
      Math.exp(-((x - 0.38) ** 2 + (y + 0.12) ** 2) / (0.06 - t * 0.01));
    const barrierBump =
      barrier * Math.exp(-((x + 0.02) ** 2 + (y + 0.02) ** 2) / 0.05);
    return wellL + wellR + barrierBump;
  }

  /** Rosenbrock valley — classic optimizer benchmark */
  function heightRosenbrock(x, y, t) {
    const xx = x * 1.05;
    const yy = y * 1.05 + 0.1;
    const banana =
      -0.62 * (1 - t * 0.4) *
      Math.exp(-((xx - yy * yy) ** 2 + (1 - xx) ** 2) / (0.38 + t * 0.06));
    const ridge = 0.14 * Math.sin(xx * 2.8 + t * 1.4) * Math.exp(-yy * yy * 0.8);
    return banana + ridge - 0.08;
  }

  /** SGD noise — stochastic gradient descent on a noisy bowl */
  function heightNoisyBowl(x, y, t) {
    const r2 = x * x + y * y;
    const bowl = -0.88 * (1 + t * 0.25) * (1 - Math.exp(-r2 / (0.48 - t * 0.08)));
    const noise =
      0.14 * (1 - t * 0.55) *
      (Math.sin(x * 10.5 + t * 5.2) * Math.cos(y * 8.8 - t * 3.6) +
        0.4 * Math.sin((x + y) * 7.2));
    return bowl + noise;
  }

  /** Ill-conditioned canyon — narrow curvature valley */
  function heightCanyon(x, y, t) {
    const along = x * 0.72 + y * 0.28;
    const across = -x * 0.32 + y * 0.74;
    const canyon =
      -0.78 * Math.exp(-(across * across) / (0.022 + t * 0.012)) * (1 - t * 0.45);
    const floor = -0.32 * along * along * (0.28 + t * 0.42);
    return canyon + floor;
  }

  /** Spurious local minima — overfitting traps */
  function heightSpuriousMinima(x, y, t) {
    const global =
      -0.92 * t * Math.exp(-((x - 0.12) ** 2 + (y + 0.18) ** 2) / (0.11 + t * 0.02));
    const traps = [
      [-0.48, 0.38],
      [0.44, -0.32],
      [-0.18, -0.52],
      [0.58, 0.46],
      [-0.62, -0.12],
    ];
    let spikes = 0;
    for (const [sx, sy] of traps) {
      spikes +=
        0.32 * (1 - t * 0.72) *
        Math.exp(-((x - sx) ** 2 + (y - sy) ** 2) / 0.016);
    }
    return global + spikes - 0.18;
  }

  /** Learning rate too high — oscillating loss */
  function heightOscillation(x, y, t) {
    const r = Math.sqrt(x * x + y * y);
    const amp = 0.38 * (1 - t * 0.48);
    const rip =
      amp * Math.sin(r * (7.5 + t * 2.8) - t * 4.2) * Math.exp(-r * 0.55);
    const drift = -0.48 * t * Math.exp(-r * r / (0.52 - t * 0.1));
    return rip + drift;
  }

  /** Vanishing gradient — flat plateau near minimum */
  function heightVanishing(x, y, t) {
    const flat = 0.14 * (1 - t * 0.82);
    const edge = -0.68 * Math.exp(-(x * x + y * y) / (1.15 - t * 0.28));
    const crease = 0.22 * (1 - t) * Math.exp(-(x * x) / 0.07) * Math.cos(y * 2.1);
    return flat + edge + crease;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(t) {
    const x = Math.max(0, Math.min(1, t));
    return x * x * (3 - 2 * x);
  }

  function easeInOutQuart(t) {
    const x = Math.max(0, Math.min(1, t));
    return x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2;
  }

  function morphEase(t) {
    return easeInOutQuart(t);
  }

  /**
   * Left→right reveal front used to "draw in" the crisp chart during the
   * morph. `crispPhase` 0→1 sweeps the front across the plot; each column
   * (normalized x in [0,1]) ramps in as the soft-edged front passes it.
   */
  function columnReveal(iNorm, crispPhase) {
    const front = crispPhase * (1 + REVEAL_EDGE);
    return smoothstep((front - iNorm) / REVEAL_EDGE);
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function sliceBarsByRange(bars, range) {
    // YTD = 올해 1월 1일 이후. 봉수 고정이 아니라 날짜(bar.d="YYYY-MM-DD")로 잘라
    // "연초부터 지금까지"의 실제 거래일 수를 그때그때 구한다.
    if (range === "YTD") {
      const yr = new Date().getFullYear();
      let idx = -1;
      for (let i = 0; i < bars.length; i += 1) {
        const y = parseInt(String((bars[i] && bars[i].d) || "").slice(0, 4), 10);
        if (Number.isFinite(y) && y >= yr) { idx = i; break; }
      }
      if (idx >= 0) {
        const sliced = bars.slice(idx);
        if (sliced.length) return sliced;
      }
      // 올해 봉이 없으면(휴장 직후 등) 6M 로 폴백.
      const n6 = RANGE_BARS["6M"];
      return bars.length <= n6 ? bars.slice() : bars.slice(-n6);
    }
    const n = RANGE_BARS[range] || RANGE_BARS["6M"];
    return bars.length <= n ? bars.slice() : bars.slice(-n);
  }

  // 지표 메모이제이션 — bars 배열 정체성(WeakMap) + 파라미터 키. chartBars 는 윈도우·기간이
  // 바뀔 때마다 새 slice 가 되므로 정체성이 곧 (구간, 기간) 키다. 예전엔 차트 모드가 매
  // 프레임 SMA×3·RSI·MACD·헤이킨아시를 전부 다시 계산했다(60fps × 최대 1,260봉).
  const indicatorMemo = new WeakMap();
  function memoIndicator(bars, key, compute) {
    if (!bars || typeof bars !== "object") return compute();
    let bucket = indicatorMemo.get(bars);
    if (!bucket) { bucket = new Map(); indicatorMemo.set(bars, bucket); }
    if (bucket.has(key)) return bucket.get(key);
    const value = compute();
    bucket.set(key, value);
    return value;
  }
  function computeHeikinAshi(bars) {
    return memoIndicator(bars, "heikin", () => computeHeikinAshiRaw(bars));
  }
  function computeSma(bars, period) {
    return memoIndicator(bars, `sma:${period}`, () => computeSmaRaw(bars, period));
  }
  function computeRsi(bars, period = 14) {
    return memoIndicator(bars, `rsi:${period}`, () => computeRsiRaw(bars, period));
  }
  function computeMacd(bars, fast = 12, slow = 26, sig = 9) {
    return memoIndicator(bars, `macd:${fast}:${slow}:${sig}`, () => computeMacdRaw(bars, fast, slow, sig));
  }

  // 헤이킨아시 봉 시퀀스 계산: HA종가=(O+H+L+C)/4, HA시가=(직전HA시가+직전HA종가)/2,
  // HA고가=max(고가,HA시가,HA종가), HA저가=min(저가,HA시가,HA종가). 첫 봉은 시가=(O+C)/2 로 시드.
  function computeHeikinAshiRaw(bars) {
    const out = new Array(bars.length);
    let prevO = null;
    let prevC = null;
    for (let i = 0; i < bars.length; i += 1) {
      const b = bars[i];
      const o = +b.o;
      const h = +b.h;
      const l = +b.l;
      const c = +b.c;
      const haC = (o + h + l + c) / 4;
      const haO = prevO == null ? (o + c) / 2 : (prevO + prevC) / 2;
      const haH = Math.max(h, haO, haC);
      const haL = Math.min(l, haO, haC);
      out[i] = { o: haO, h: haH, l: haL, c: haC, v: b.v, d: b.d };
      prevO = haO;
      prevC = haC;
    }
    return out;
  }

  // 전체 히스토리 차트 패턴 검출.
  // app.js의 MirChartOverlays는 최근 3개 패턴만 남기고(.slice(0,3)) 잘라서 넘겨주므로
  // AI 모드 차트에는 "6개월 안쪽 패턴"만 보인다. 여기서는 전체 bars(chartFullBars, 최대 5Y)로
  // 직접 재검출해 오래된 패턴까지 포함시키고, 실제 그리기는 drawChartOverlays가 가시 구간만 클립한다.
  // (검출은 종목 로드 시 1회만 — morphToChart에서 호출하고 결과를 chartOverlays.patterns에 캐시.
  //  기간 탭 전환은 재검출 없이 chartViewStart 기준 재클립만 한다.)
  function computeFullHistoryPatterns(bars) {
    try {
      const P = window.MirProb;
      if (!P || typeof P.detectConfirmations !== "function") return null;
      if (!Array.isArray(bars) || bars.length < 12) return null;
      const labels = P.patternLabels || {};
      const catFn = typeof window.patternCategory === "function" ? window.patternCategory : null;
      const enabled = (window.chartState && window.chartState.patternTypes) || {};
      const all = (P.detectConfirmations(bars) || [])
        .filter((p) => p && (p.points || p.lines)) // 기하학적 도형이 있는 것만(캔들패턴 제외)
        .filter((p) => { if (!catFn) return true; const c = catFn(p.pattern); return c && enabled[c] !== false; })
        .sort((a, b) => (a.confirm_idx || 0) - (b.confirm_idx || 0)); // 시간순
      // 초과분은 최근 것만 남기지 않고 시간축으로 고르게 샘플 → 6개월 이전 패턴도 캐시에 보존.
      let sel = all;
      if (all.length > PATTERN_MAX_FULL) {
        sel = [];
        const step = all.length / PATTERN_MAX_FULL;
        for (let i = 0; i < PATTERN_MAX_FULL; i += 1) sel.push(all[Math.min(all.length - 1, Math.floor(i * step))]);
      }
      return sel.map((p) => ({
        dir: p.dir,
        pattern: p.pattern,
        name: labels[p.pattern] || p.pattern,
        points: p.points || [],
        lines: p.lines || [],
        necklinePts: p.necklinePts || null,
        confirm_idx: p.confirm_idx,
      }));
    } catch (_) { return null; }
  }

  function computeSmaRaw(bars, period) {
    const out = [];
    for (let i = 0; i < bars.length; i += 1) {
      if (i < period - 1) {
        out.push(null);
        continue;
      }
      let sum = 0;
      for (let k = i - period + 1; k <= i; k += 1) sum += bars[k].c;
      out.push(sum / period);
    }
    return out;
  }

  function computeRsiRaw(bars, period = 14) {
    const out = new Array(bars.length).fill(null);
    if (bars.length <= period) return out;
    let gain = 0;
    let loss = 0;
    for (let i = 1; i <= period; i += 1) {
      const d = bars[i].c - bars[i - 1].c;
      if (d >= 0) gain += d; else loss -= d;
    }
    let avgG = gain / period;
    let avgL = loss / period;
    out[period] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
    for (let i = period + 1; i < bars.length; i += 1) {
      const d = bars[i].c - bars[i - 1].c;
      avgG = (avgG * (period - 1) + Math.max(0, d)) / period;
      avgL = (avgL * (period - 1) + Math.max(0, -d)) / period;
      out[i] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
    }
    return out;
  }

  function computeMacdRaw(bars, fast = 12, slow = 26, sig = 9) {
    const n = bars.length;
    const macd = new Array(n).fill(null);
    const signal = new Array(n).fill(null);
    if (n < slow + sig) return { macd, signal };
    const ema = (period) => {
      const k = 2 / (period + 1);
      const out = new Array(n).fill(null);
      let prev = bars[0].c;
      for (let i = 0; i < n; i += 1) {
        prev = i === 0 ? bars[0].c : bars[i].c * k + prev * (1 - k);
        if (i >= period - 1) out[i] = prev;
      }
      return out;
    };
    const eFast = ema(fast);
    const eSlow = ema(slow);
    for (let i = 0; i < n; i += 1) {
      if (eFast[i] != null && eSlow[i] != null) macd[i] = eFast[i] - eSlow[i];
    }
    const k = 2 / (sig + 1);
    let prev = null;
    for (let i = 0; i < n; i += 1) {
      if (macd[i] == null) continue;
      prev = prev == null ? macd[i] : macd[i] * k + prev * (1 - k);
      signal[i] = prev;
    }
    return { macd, signal };
  }

  // RSI(14)·MACD 서브차트 — 참고 레이아웃의 보조지표 카드 2개를 캔버스 하단에 그린다.
  function drawIndicatorPanels(w, h, layout, alpha) {
    if (!layout.indH || !chartBars.length || alpha <= 0) return;
    const { padL, padT, plotH, volH, indH, gap, plotW } = layout;
    const n = chartBars.length;
    const top = padT + plotH + gap + volH + gap;
    const boxGap = 10;
    const boxW = (plotW - boxGap) / 2;
    const xAt = (i, x0, wBox) => x0 + (i / Math.max(1, n - 1)) * wBox;

    ctx.save();
    ctx.globalAlpha = alpha;

    const panelBox = (x0) => {
      ctx.fillStyle = "rgba(11, 17, 32, 0.55)";
      ctx.strokeStyle = "rgba(148, 163, 184, 0.14)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x0, top, boxW, indH, 8);
      else ctx.rect(x0, top, boxW, indH);
      ctx.fill();
      ctx.stroke();
    };

    // ── RSI (좌) ──
    const rsi = computeRsi(chartBars, 14);
    const rsiX0 = padL;
    panelBox(rsiX0);
    const innerT = top + 20;
    const innerH = indH - 28;
    const rsiY = (v) => innerT + (1 - clamp(v, 0, 100) / 100) * innerH;
    for (const lvl of [70, 30]) {
      ctx.strokeStyle = "rgba(148, 163, 184, 0.18)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(rsiX0 + 6, rsiY(lvl));
      ctx.lineTo(rsiX0 + boxW - 6, rsiY(lvl));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = "rgba(167, 139, 250, 0.9)";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    let started = false;
    let lastRsi = null;
    for (let i = 0; i < n; i += 1) {
      if (rsi[i] == null) continue;
      lastRsi = rsi[i];
      const x = xAt(i, rsiX0 + 6, boxW - 12);
      const y = rsiY(rsi[i]);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.font = "700 10.5px Pretendard, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(203, 213, 225, 0.85)";
    ctx.fillText("RSI (14)", rsiX0 + 8, top + 13);
    if (lastRsi != null) {
      ctx.fillStyle = lastRsi >= 70 ? "#f87171" : lastRsi <= 30 ? "#4ade80" : "rgba(196, 181, 253, 0.95)";
      ctx.fillText(lastRsi.toFixed(1), rsiX0 + 58, top + 13);
    }

    // ── MACD (우) ──
    const { macd, signal } = computeMacd(chartBars);
    const mX0 = padL + boxW + boxGap;
    panelBox(mX0);
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < n; i += 1) {
      if (macd[i] != null) { lo = Math.min(lo, macd[i]); hi = Math.max(hi, macd[i]); }
      if (signal[i] != null) { lo = Math.min(lo, signal[i]); hi = Math.max(hi, signal[i]); }
    }
    let lastMacd = null;
    if (Number.isFinite(lo) && Number.isFinite(hi) && hi > lo) {
      const span = hi - lo;
      const mY = (v) => innerT + (1 - (v - lo) / span) * innerH;
      if (lo < 0 && hi > 0) {
        ctx.strokeStyle = "rgba(148, 163, 184, 0.18)";
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(mX0 + 6, mY(0));
        ctx.lineTo(mX0 + boxW - 6, mY(0));
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // 히스토그램(MACD-Signal)
      const barW = Math.max(1, (boxW - 12) / Math.max(1, n) * 0.6);
      for (let i = 0; i < n; i += 1) {
        if (macd[i] == null || signal[i] == null) continue;
        const hVal = macd[i] - signal[i];
        const x = xAt(i, mX0 + 6, boxW - 12);
        const base0 = clamp(0, lo, hi);
        const y0 = mY(base0);
        const y1 = mY(clamp(base0 + hVal, lo, hi));
        ctx.fillStyle = hVal >= 0 ? "rgba(34, 197, 94, 0.35)" : "rgba(239, 68, 68, 0.35)";
        ctx.fillRect(x - barW / 2, Math.min(y0, y1), barW, Math.max(1, Math.abs(y1 - y0)));
      }
      const line = (series, color) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        let on = false;
        for (let i = 0; i < n; i += 1) {
          if (series[i] == null) continue;
          const x = xAt(i, mX0 + 6, boxW - 12);
          const y = mY(series[i]);
          if (!on) { ctx.moveTo(x, y); on = true; } else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };
      line(macd, "rgba(56, 189, 248, 0.95)");
      line(signal, "rgba(251, 146, 60, 0.9)");
      for (let i = n - 1; i >= 0; i -= 1) {
        if (macd[i] != null) { lastMacd = macd[i]; break; }
      }
    }
    ctx.fillStyle = "rgba(203, 213, 225, 0.85)";
    ctx.fillText("MACD (12·26·9)", mX0 + 8, top + 13);
    if (lastMacd != null) {
      ctx.fillStyle = lastMacd >= 0 ? "#4ade80" : "#f87171";
      ctx.fillText(lastMacd >= 100 ? lastMacd.toFixed(0) : lastMacd.toFixed(2), mX0 + 92, top + 13);
    }

    ctx.restore();
  }

  function updateChartBounds() {
    if (!chartBars.length) return;
    let lo = Infinity;
    let hi = -Infinity;
    for (const b of chartBars) {
      lo = Math.min(lo, b.l);
      hi = Math.max(hi, b.h);
    }
    const pad = (hi - lo) * 0.06 || 1;
    chartPriceMin = lo - pad;
    chartPriceMax = hi + pad;
  }

  // 확대/이동: chartFullBars 위의 가시 윈도우를 초기화·적용한다.
  function resetChartWindow() {
    chartViewCount = chartBars.length || chartFullBars.length;
    chartViewStart = Math.max(0, chartFullBars.length - chartViewCount);
  }
  function applyChartWindow() {
    if (!chartFullBars.length) return;
    chartViewCount = clamp(chartViewCount, Math.min(MIN_CHART_BARS, chartFullBars.length), chartFullBars.length);
    chartViewStart = clamp(chartViewStart, 0, chartFullBars.length - chartViewCount);
    const s = Math.round(chartViewStart);
    chartBars = chartFullBars.slice(s, s + chartViewCount);
    updateChartBounds();
  }
  function redrawChartNow() {
    if (running && renderMode === "chart") { cancelAnimationFrame(raf); draw(); }
  }
  // 휠 줌: anchorFrac(0~1) 위치의 바가 고정되도록 윈도우 크기를 조절.
  function chartZoom(factor, anchorFrac) {
    if (renderMode !== "chart" || chartFullBars.length < MIN_CHART_BARS) return;
    const oldCount = chartViewCount || chartBars.length;
    let newCount = Math.round(oldCount * factor);
    newCount = clamp(newCount, MIN_CHART_BARS, chartFullBars.length);
    if (newCount === oldCount) return;
    const anchorIdx = chartViewStart + anchorFrac * oldCount;
    chartViewStart = anchorIdx - anchorFrac * newCount;
    chartViewCount = newCount;
    applyChartWindow();
    redrawChartNow();
  }
  // 드래그 팬: 픽셀 이동량(dx)만큼 윈도우를 시간축으로 민다.
  function chartPan(dxPx, widthPx) {
    if (renderMode !== "chart" || !chartFullBars.length) return;
    const barsPerPx = chartViewCount / Math.max(1, widthPx);
    chartViewStart -= dxPx * barsPerPx; // 오른쪽 드래그 → 과거 데이터
    applyChartWindow();
    redrawChartNow();
  }

  function barIndexFromX(x) {
    if (!chartBars.length) return 0;
    return clamp(Math.round(((x + 1) * 0.5) * (chartBars.length - 1)), 0, chartBars.length - 1);
  }

  function priceToZ(price) {
    const span = chartPriceMax - chartPriceMin || 1;
    return ((price - chartPriceMin) / span) * 1.6 - 0.8;
  }

  function chartSurfaceZ(x, y, ease) {
    if (!chartBars.length) return 0;
    const barIdx = barIndexFromX(x);
    const bar = chartBars[barIdx];
    const n = chartBars.length;
    const barSpacing = 2 / Math.max(1, n);
    const xInBar = ((x + 1) / 2) * n - barIdx - 0.5;
    const sharp = smoothstep(ease);
    const halfW = barSpacing * lerp(0.48, 0.31, sharp);
    const floor = priceToZ(bar.c) * lerp(0.35, 0.1, sharp) - lerp(0.55, 0.95, sharp);

    if (Math.abs(xInBar) > halfW) return floor;

    const wickHalf = barSpacing * lerp(0.18, 0.055, sharp);
    const bodyLo = priceToZ(Math.min(bar.o, bar.c));
    const bodyHi = priceToZ(Math.max(bar.o, bar.c));
    const wickLo = priceToZ(bar.l);
    const wickHi = priceToZ(bar.h);
    const yScaled = y * lerp(1, 0.06, sharp);

    if (Math.abs(yScaled) < wickHalf) {
      return lerp(wickLo, wickHi, (yScaled + wickHalf) / (2 * wickHalf));
    }
    const bodyT = clamp((Math.abs(yScaled) - wickHalf) / Math.max(0.001, halfW - wickHalf), 0, 1);
    return lerp(bodyLo, bodyHi, bodyT);
  }

  function candleRgb(x) {
    const bar = chartBars[barIndexFromX(x)];
    if (!bar) return [56, 189, 248];
    return bar.c >= bar.o ? [34, 197, 94] : [239, 68, 68];
  }

  function getChartLayout(w, h) {
    const padL = Math.max(48, w * 0.06);
    const padR = Math.max(56, w * 0.07);
    const padT = Math.max(44, h * 0.07);
    const padB = Math.max(36, h * 0.06);
    const volH = Math.max(44, h * 0.11);
    // RSI·MACD 보조지표 스트립 — 참고 레이아웃(1.png)의 서브차트. 높이가 낮으면 생략.
    const indH = h >= 430 && w >= 520 ? Math.min(120, Math.max(72, h * 0.15)) : 0;
    const gap = 8;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB - volH - gap - (indH ? indH + gap : 0);
    return { padL, padR, padT, padB, volH, indH, gap, plotW, plotH, w, h };
  }

  function layoutHelpers(layout) {
    const n = chartBars.length;
    const span = chartPriceMax - chartPriceMin || 1;
    const xAt = (i) => layout.padL + (i / Math.max(1, n - 1)) * layout.plotW;
    const yAt = (price) => layout.padT + layout.plotH - ((price - chartPriceMin) / span) * layout.plotH;
    const candleW = Math.max(2, Math.min(12, (layout.plotW / Math.max(1, n)) * 0.62));
    return { n, span, xAt, yAt, candleW };
  }

  function fmtPrice(v) {
    if (v >= 1000) return v.toFixed(0);
    if (v >= 100) return v.toFixed(1);
    return v.toFixed(2);
  }

  function fmtDate(d) {
    const parts = String(d || "").split("-");
    if (parts.length < 3) return d || "";
    return `${parts[1]}/${parts[2]}`;
  }

  function drawCrispCandles(w, h, layout, alpha, includeVolume, reveal) {
    if (!chartBars.length || alpha <= 0) return;
    const { padL, padT, plotW, plotH, volH, gap } = layout;
    const { n, xAt, yAt, candleW } = layoutHelpers(layout);
    const maxVol = Math.max(...chartBars.map((b) => b.v || 0), 1);
    const sma5 = computeSma(chartBars, 5);
    const sma20 = computeSma(chartBars, 20);
    const sma60 = computeSma(chartBars, 60);
    const rev = typeof reveal === "function" ? reveal : null;
    // per-column reveal in [0,1]; 1 (fully drawn) when no reveal fn supplied
    const revAt = (i) => (rev ? clamp(rev(i, n), 0, 1) : 1);

    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.strokeStyle = "rgba(148, 163, 184, 0.08)";
    ctx.lineWidth = 1;
    for (let g = 0; g <= 5; g += 1) {
      const y = padT + (g / 5) * plotH;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + plotW, y);
      ctx.stroke();
    }

    // MA lines "draw in" left→right: extend only as far as the reveal front.
    function drawMaLine(values, color) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < values.length; i += 1) {
        if (values[i] == null) continue;
        if (rev && revAt(i) <= 0.5) break;
        const x = xAt(i);
        const y = yAt(values[i]);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    drawMaLine(sma60, "rgba(167, 139, 250, 0.85)");
    drawMaLine(sma20, "rgba(56, 189, 248, 0.9)");
    drawMaLine(sma5, "rgba(251, 146, 60, 0.9)");

    if (chartStyle === "line") {
      // 종가선(+영역): 실제 종가를 잇는 라인. reveal 전선까지만 그린다.
      let frontIdx = -1;
      for (let i = 0; i < n; i += 1) {
        if (revAt(i) > 0.5) frontIdx = i; else break;
      }
      if (frontIdx >= 0) {
        const up = chartBars[frontIdx].c >= chartBars[0].c;
        const lineColor = up ? "#22c55e" : "#ef4444";
        const areaGrad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
        areaGrad.addColorStop(0, up ? "rgba(34, 197, 94, 0.20)" : "rgba(239, 68, 68, 0.20)");
        areaGrad.addColorStop(1, up ? "rgba(34, 197, 94, 0)" : "rgba(239, 68, 68, 0)");
        // 영역 채우기
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(xAt(0), padT + plotH);
        for (let i = 0; i <= frontIdx; i += 1) ctx.lineTo(xAt(i), yAt(chartBars[i].c));
        ctx.lineTo(xAt(frontIdx), padT + plotH);
        ctx.closePath();
        ctx.fillStyle = areaGrad;
        ctx.fill();
        // 라인
        ctx.beginPath();
        ctx.moveTo(xAt(0), yAt(chartBars[0].c));
        for (let i = 1; i <= frontIdx; i += 1) ctx.lineTo(xAt(i), yAt(chartBars[i].c));
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1.8;
        ctx.lineJoin = "round";
        ctx.stroke();
      }
    } else {
      // 캔들 / 헤이킨아시 — 봉 소스만 다르고 그리는 방식은 같다.
      const styleBars = chartStyle === "heikin" ? computeHeikinAshi(chartBars) : chartBars;
      for (let i = 0; i < n; i += 1) {
        const r = revAt(i);
        if (r <= 0.01) continue;
        const bar = styleBars[i];
        const x = xAt(i);
        const up = bar.c >= bar.o;
        const color = up ? "#22c55e" : "#ef4444";
        // candles sprout from the close-price line outward as they reveal
        const grow = rev ? smoothstep(r) : 1;
        const baseY = yAt(bar.c);
        const bodyTop = lerp(baseY, yAt(Math.max(bar.o, bar.c)), grow);
        const bodyBot = lerp(baseY, yAt(Math.min(bar.o, bar.c)), grow);
        const wickTop = lerp(baseY, yAt(bar.h), grow);
        const wickBot = lerp(baseY, yAt(bar.l), grow);
        const bodyH = Math.max(1, bodyBot - bodyTop);

        ctx.globalAlpha = alpha * r;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, wickTop);
        ctx.lineTo(x, wickBot);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.fillRect(x - candleW * 0.5, bodyTop, candleW, bodyH);
      }
    }
    ctx.globalAlpha = alpha;

    if (includeVolume) {
      const volTop = padT + plotH + gap;
      for (let i = 0; i < n; i += 1) {
        const r = revAt(i);
        if (r <= 0.01) continue;
        const bar = chartBars[i];
        const x = xAt(i);
        const up = bar.c >= bar.o;
        const grow = rev ? smoothstep(r) : 1;
        const vh = ((bar.v || 0) / maxVol) * (volH - 4) * grow;
        ctx.globalAlpha = alpha * r;
        ctx.fillStyle = up ? "rgba(34, 197, 94, 0.45)" : "rgba(239, 68, 68, 0.45)";
        ctx.fillRect(x - candleW * 0.5, volTop + volH - vh, candleW, vh);
      }
    }

    ctx.restore();
  }

  /** Soft glowing scan line that rides the reveal front while the chart draws in. */
  function drawRevealScanline(w, h, layout, crispPhase) {
    if (crispPhase <= 0 || crispPhase >= 1) return;
    const { padL, padT, plotW, plotH } = layout;
    const front = clamp(crispPhase * (1 + REVEAL_EDGE), 0, 1);
    const x = padL + front * plotW;
    const glowW = Math.max(18, plotW * 0.045);
    const a = 0.55 * Math.sin(Math.PI * clamp(crispPhase, 0, 1));
    const grad = ctx.createLinearGradient(x - glowW, 0, x + glowW, 0);
    grad.addColorStop(0, "rgba(56, 189, 248, 0)");
    grad.addColorStop(0.5, `rgba(125, 211, 252, ${a})`);
    grad.addColorStop(1, "rgba(56, 189, 248, 0)");
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = grad;
    ctx.fillRect(x - glowW, padT - 6, glowW * 2, plotH + 12);
    ctx.restore();
  }

  function drawChartChrome(w, h, layout, alpha) {
    if (!chartBars.length || alpha <= 0) return;
    const { padL, padT, plotW, plotH } = layout;
    const { n, span, xAt } = layoutHelpers(layout);
    const last = chartBars[n - 1];
    const first = chartBars[0];
    const chg = first.c ? ((last.c - first.c) / first.c) * 100 : 0;

    ctx.save();
    ctx.globalAlpha = alpha;

    for (let g = 0; g <= 5; g += 1) {
      const y = padT + (g / 5) * plotH;
      const price = chartPriceMax - (g / 5) * span;
      ctx.fillStyle = "rgba(148, 163, 184, 0.55)";
      ctx.font = "10px Pretendard, system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(fmtPrice(price), w - 8, y + 3);
    }

    const tickCount = Math.min(6, n);
    for (let t = 0; t < tickCount; t += 1) {
      const idx = Math.round((t / Math.max(1, tickCount - 1)) * (n - 1));
      ctx.fillStyle = "rgba(148, 163, 184, 0.5)";
      ctx.textAlign = "center";
      ctx.fillText(fmtDate(chartBars[idx].d), xAt(idx), h - 10);
    }

    // 국내는 회사명이 주 표기, 코드는 보조(사이트 표기 규칙과 동일). 보조 라벨 위치는
    // 주 라벨 폭을 재서 정한다 — 예전엔 +52px 고정이라 긴 이름과 겹쳤다.
    const krLabel = typeof isKrMarket === "function" && isKrMarket() && /^\d{6}/.test(String(chartMeta.ticker || ""));
    const primaryLabel = krLabel ? (chartMeta.name || chartMeta.ticker) : chartMeta.ticker;
    const secondaryLabel = krLabel ? chartMeta.ticker : (chartMeta.name || "");
    ctx.fillStyle = "rgba(248, 250, 252, 0.95)";
    ctx.font = "600 15px Pretendard, system-ui, sans-serif";
    ctx.textAlign = "left";
    const labelX = Math.max(8, padL - 4);
    const labelY = Math.max(18, padT - 14);
    ctx.fillText(primaryLabel, labelX, labelY);
    const primaryW = ctx.measureText(primaryLabel).width;
    ctx.fillStyle = "rgba(148, 163, 184, 0.7)";
    ctx.font = "11px Pretendard, system-ui, sans-serif";
    ctx.fillText(secondaryLabel, labelX + primaryW + 8, labelY);

    ctx.fillStyle = chg >= 0 ? "#4ade80" : "#f87171";
    ctx.font = "11px Pretendard, system-ui, sans-serif";
    ctx.fillText(`${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%`, Math.max(8, padL + 4), Math.max(32, padT));

    ctx.restore();
  }

  function drawChart2D(w, h, alpha) {
    if (!chartBars.length) return;
    const layout = getChartLayout(w, h);
    const a = alpha == null ? 1 : alpha;
    drawSpaceBackground(w, h, performance.now() * 0.001);
    drawCrispCandles(w, h, layout, a, true);
    drawChartOverlays(w, h, layout, a);
    drawChartChrome(w, h, layout, a);
    drawIndicatorPanels(w, h, layout, a);
  }

  // 패턴의 대표 인덱스(라벨/정렬 기준) — confirm_idx 우선, 없으면 도형 인덱스 범위의 우측.
  function patternIdxRange(pat) {
    let lo = Infinity, hi = -Infinity;
    (pat.points || []).forEach((q) => { if (q && Number.isFinite(q.idx)) { lo = Math.min(lo, q.idx); hi = Math.max(hi, q.idx); } });
    (pat.lines || []).forEach((l) => (l.pts || []).forEach((q) => { if (q && Number.isFinite(q.idx)) { lo = Math.min(lo, q.idx); hi = Math.max(hi, q.idx); } }));
    if (hi < lo) return null;
    return { lo, hi, anchor: Number.isFinite(pat.confirm_idx) ? pat.confirm_idx : hi };
  }

  // 가시 구간과 겹치는 패턴을 가독성 있게 추린다:
  // 최근 것부터 훑되 최소 간격(가시 봉수/PATTERN_MAX_RENDER)을 두고 골라 라벨이 겹치지 않게,
  // 그리고 시간축으로 퍼지도록 한다. → 6M은 최근 몇 개, 5Y는 과거까지 고르게 노출.
  function selectVisiblePatterns(start, n) {
    const end = start + n - 1;
    const cand = [];
    (chartOverlays.patterns || []).forEach((pat) => {
      const r = patternIdxRange(pat);
      if (!r) return;
      if (r.hi < start || r.lo > end) return; // 윈도우 밖
      cand.push({ pat, anchor: r.anchor });
    });
    cand.sort((a, b) => b.anchor - a.anchor); // 최근 우선
    const minGap = Math.max(6, Math.round(n / PATTERN_MAX_RENDER));
    const picked = [];
    for (const c of cand) {
      if (picked.length >= PATTERN_MAX_RENDER) break;
      if (picked.every((p) => Math.abs(p.anchor - c.anchor) >= minGap)) picked.push(c);
    }
    return picked.map((p) => p.pat);
  }

  // 지지/저항·추세선·기하학적 차트 패턴을 2D 차트 위에 그린다(종목 분석 탭과 동일 로직).
  function drawChartOverlays(w, h, layout, alpha) {
    if (!chartOverlays || alpha <= 0 || !chartBars.length) return;
    const { n, xAt, yAt } = layoutHelpers(layout);
    const start = Math.round(chartViewStart);
    const total = chartOverlays.totalBars || chartFullBars.length;
    // 전체바 인덱스 → 가시 좌표(윈도우 밖이면 null)
    const mapPt = (idx, price) => {
      const vi = idx - start;
      if (vi < 0 || vi >= n) return null;
      return { x: xAt(vi), y: yAt(price) };
    };
    const clampY = (price) => yAt(Math.max(chartPriceMin, Math.min(chartPriceMax, price)));
    ctx.save();
    ctx.globalAlpha = alpha;

    // 지지/저항: 밴드(hi~lo) + 가격선, 지지=초록·저항=빨강 (분석 탭과 동일)
    (chartOverlays.sr || []).forEach((lvl) => {
      if (!lvl || !Number.isFinite(lvl.price) || lvl.price < chartPriceMin || lvl.price > chartPriceMax) return;
      const rgb = lvl.type === "sup" ? "22,163,74" : "220,38,38";
      const yHi = clampY(lvl.hi != null ? lvl.hi : lvl.price);
      const yLo = clampY(lvl.lo != null ? lvl.lo : lvl.price);
      ctx.fillStyle = `rgba(${rgb},0.08)`;
      ctx.fillRect(layout.padL, yHi, layout.plotW, Math.max(1.5, yLo - yHi));
      const y = yAt(lvl.price);
      ctx.strokeStyle = `rgba(${rgb},0.7)`;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(layout.padL, y); ctx.lineTo(layout.padL + layout.plotW, y); ctx.stroke();
    });
    ctx.setLineDash([]);

    // 추세선: 피벗(x1) → 마지막 봉까지 외삽, 가시 구간만 그림 (분석 탭과 동일)
    (chartOverlays.trendlines || []).forEach((ln) => {
      const slope = (ln.y2 - ln.y1) / ((ln.x2 - ln.x1) || 1);
      const priceAt = (i) => ln.y1 + slope * (i - ln.x1);
      const segS = Math.max(ln.x1, start);
      const segE = Math.min(total - 1, start + n - 1);
      if (segE <= segS) return;
      const p1 = mapPt(segS, priceAt(segS));
      const p2 = mapPt(segE, priceAt(segE));
      if (!p1 || !p2) return;
      const col = ln.color || (ln.kind === "sup" ? "#4ade80" : "#f87171");
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([7, 4]);
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = "700 10px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = col;
      ctx.textAlign = "left";
      ctx.fillText(ln.kind === "sup" ? "지지 추세선" : "저항 추세선", p1.x + 3, p1.y - 4);
    });

    // 차트 패턴: 기하학적 도형(추세선/윤곽선/목선/피벗+라벨) (분석 탭과 동일)
    // 가시 구간에서 가독성 있게 추린 부분집합만 그린다(전체 검출은 유지, 화면만 정리).
    selectVisiblePatterns(start, n).forEach((pat) => {
      const color = pat.dir > 0 ? "#0ea5e9" : "#a855f7";
      let anchor = null;
      (pat.lines || []).forEach((lnp) => {
        const pp = (lnp.pts || []).map((q) => mapPt(q.idx, q.price)).filter(Boolean);
        if (pp.length === 2) {
          ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([]);
          ctx.beginPath(); ctx.moveTo(pp[0].x, pp[0].y); ctx.lineTo(pp[1].x, pp[1].y); ctx.stroke();
          anchor = anchor || pp[0];
        }
      });
      const pvs = (pat.points || []).map((q) => { const m = mapPt(q.idx, q.price); return m ? { ...m, label: q.label } : null; }).filter(Boolean);
      if (pvs.length >= 3) {
        ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.lineJoin = "round"; ctx.setLineDash([]);
        ctx.beginPath(); pvs.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
      }
      if (pat.necklinePts) {
        const nl = pat.necklinePts.map((q) => mapPt(q.idx, q.price)).filter(Boolean);
        if (nl.length === 2) {
          ctx.strokeStyle = color; ctx.lineWidth = 1.1; ctx.setLineDash([5, 4]);
          ctx.beginPath(); ctx.moveTo(nl[0].x, nl[0].y); ctx.lineTo(nl[1].x, nl[1].y); ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      ctx.fillStyle = color;
      pvs.forEach((p) => {
        ctx.beginPath(); ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2); ctx.fill();
        if (p.label) { ctx.font = "700 10px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillText(p.label, p.x, p.y - 7); }
      });
      if (pvs.length) anchor = anchor || pvs[0];
      if (anchor) {
        ctx.font = "800 10.5px system-ui, sans-serif"; ctx.textAlign = "left"; ctx.fillStyle = color;
        ctx.fillText(pat.name || pat.pattern || "패턴", anchor.x, anchor.y + 14);
      }
    });

    ctx.restore();
  }

  function waveFrontBlend(x, segT) {
    const xNorm = (x + 1) * 0.5;
    const travel = 1.15 + WAVE_WIDTH * 2.2;
    const front = segT * travel - WAVE_WIDTH * 0.5;
    return smoothstep((front - xNorm + WAVE_WIDTH) / WAVE_WIDTH);
  }

  function blendLandscapes(x, y, idxA, idxB, segT) {
    const w = waveFrontBlend(x, segT);
    const hA = LANDSCAPES[idxA].height(x, y, 0);
    const hB = LANDSCAPES[idxB].height(x, y, 0);
    return lerp(hA, hB, w);
  }

  function heightAt(x, y, progress) {
    const n = LANDSCAPES.length;

    if (progress >= TRAIN_PHASE) {
      const rewindT = (progress - TRAIN_PHASE) / (1 - TRAIN_PHASE);
      return blendLandscapes(x, y, n - 1, 0, rewindT);
    }

    const phase = (progress / TRAIN_PHASE) * n;
    const idx = Math.min(n - 1, Math.floor(phase));
    const segT = phase - idx;
    return blendLandscapes(x, y, idx, (idx + 1) % n, segT);
  }

  function layoutBand(w) {
    if (w <= 390) return "xs";
    if (w <= 768) return "sm";
    return "lg";
  }

  function isKeyboardCompact() {
    return document.body.classList.contains("ai-keyboard-open");
  }

  function isInputFocused() {
    return document.body.classList.contains("ai-input-focused");
  }

  function isShortViewport(h) {
    if (isKeyboardCompact()) return true;
    if (isInputFocused()) return true;
    const height = h || root?.clientHeight || window.innerHeight;
    if (height <= 0) return false;
    const vv = window.visualViewport;
    if (vv && vv.height < window.innerHeight * 0.72) return true;
    return height < 400;
  }

  function applyViewportLayout(w, h) {
    const band = layoutBand(w);
    const shortH = isShortViewport(h);
    const focusKey = isKeyboardCompact() ? "k" : isInputFocused() ? "f" : "n";
    const key = `${band}-${focusKey}`;
    const keyChanged = key !== lastLayoutKey;
    if (!keyChanged) return;
    lastLayoutKey = key;
    if (renderMode !== "landscape" || isDragging || isZoomDrag || activePointers.size > 0) return;

    const keyboard = isKeyboardCompact();
    const focused = isInputFocused() && !keyboard;

    if (band === "xs") {
      // 세로로 긴 모바일에서 서피스가 상단에 몰리고 아래가 비지 않도록
      // 화면 중앙(0.5 부근)에 놓고, 스케일·틸트를 키워 존재감을 확보한다.
      targetViewScale = keyboard ? 0.24 : focused ? 0.32 : 0.38;
      targetViewPitch = keyboard ? 0.1 : focused ? 0.2 : 0.28;
      targetCamCenterY = keyboard ? 0.3 : focused ? 0.44 : 0.5;
    } else if (band === "sm") {
      targetViewScale = keyboard ? 0.26 : focused ? 0.34 : 0.4;
      targetViewPitch = keyboard ? 0.08 : focused ? 0.18 : 0.24;
      targetCamCenterY = keyboard ? 0.32 : focused ? 0.44 : 0.5;
    } else {
      targetViewScale = BASE_SCALE;
      targetViewPitch = DEFAULT_PITCH;
      targetCamCenterY = CAM_CENTER_Y;
    }

    stars = [];
    starsSizeKey = "";
  }

  function stepCameraLayout(dt) {
    if (renderMode !== "landscape") return;
    const t = 1 - Math.exp(-7 * dt);
    camCenterY += (targetCamCenterY - camCenterY) * t;
    viewPitch += (targetViewPitch - viewPitch) * t;
    if (!isDragging && !isZoomDrag && activePointers.size === 0) {
      viewScale += (targetViewScale - viewScale) * t;
    }
  }

  function starCountForWidth(w) {
    return w <= 768 ? Math.round(STAR_COUNT * 0.68) : STAR_COUNT;
  }

  function seedStars(w, h) {
    const key = `${w}x${h}`;
    if (starsSizeKey === key && stars.length) return;
    starsSizeKey = key;
    stars = [];
    const count = starCountForWidth(w);
    for (let i = 0; i < count; i += 1) {
      const roll = Math.random();
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: roll < 0.1 ? 1.15 : roll < 0.38 ? 0.75 : 0.45,
        base: 0.1 + Math.random() * 0.34,
        twinkle: Math.random() * Math.PI * 2,
        speed: 0.25 + Math.random() * 0.75,
        cool: Math.random() > 0.42,
      });
    }
  }

  function drawSpaceBackground(w, h, timeSec) {
    seedStars(w, h);

    const grad = ctx.createRadialGradient(
      w * 0.5,
      h * camCenterY,
      Math.min(w, h) * 0.04,
      w * 0.5,
      h * (camCenterY + 0.04),
      Math.max(w, h) * 0.82,
    );
    grad.addColorStop(0, "#0d1220");
    grad.addColorStop(0.42, "#080b12");
    grad.addColorStop(1, "#03050a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const nebA = ctx.createRadialGradient(w * 0.24, h * 0.18, 0, w * 0.24, h * 0.18, w * 0.34);
    nebA.addColorStop(0, "rgba(52, 82, 132, 0.055)");
    nebA.addColorStop(1, "transparent");
    ctx.fillStyle = nebA;
    ctx.fillRect(0, 0, w, h);

    const nebB = ctx.createRadialGradient(w * 0.82, h * 0.72, 0, w * 0.82, h * 0.72, w * 0.3);
    nebB.addColorStop(0, "rgba(82, 58, 118, 0.045)");
    nebB.addColorStop(1, "transparent");
    ctx.fillStyle = nebB;
    ctx.fillRect(0, 0, w, h);

    for (const star of stars) {
      let alpha = star.base;
      if (!reducedMotion) {
        alpha *= 0.74 + 0.26 * Math.sin(timeSec * star.speed + star.twinkle);
      }
      ctx.fillStyle = star.cool
        ? `rgba(214, 224, 255, ${alpha})`
        : `rgba(255, 242, 228, ${alpha * 0.9})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();

      if (star.r > 0.95 && alpha > 0.28) {
        ctx.fillStyle = `rgba(186, 204, 255, ${alpha * 0.07})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r * 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function jetColor(t) {
    const c = Math.max(0, Math.min(1, t));
    const r = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * c - 3)));
    const g = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * c - 2)));
    const b = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * c - 1)));
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  function surfaceGradient(x, y, progress) {
    const eps = 0.006;
    const gx = (heightAt(x + eps, y, progress) - heightAt(x - eps, y, progress)) / (2 * eps);
    const gy = (heightAt(x, y + eps, progress) - heightAt(x, y - eps, progress)) / (2 * eps);
    return { gx, gy };
  }

  function rotateView3(x, y, z) {
    const cosY = Math.cos(viewYaw);
    const sinY = Math.sin(viewYaw);
    let rx = x * cosY - y * sinY;
    let ry = x * sinY + y * cosY;
    let rz = z;

    const cosP = Math.cos(viewPitch);
    const sinP = Math.sin(viewPitch);
    const ry2 = ry * cosP - rz * sinP;
    rz = ry * sinP + rz * cosP;
    ry = ry2;

    const cosR = Math.cos(viewRoll);
    const sinR = Math.sin(viewRoll);
    const rx2 = rx * cosR - ry * sinR;
    ry = rx * sinR + ry * cosR;
    rx = rx2;

    return { rx, ry, rz };
  }

  function apparentDownhill(gx, gy) {
    const downX = -gx;
    const downY = -gy;
    const downZ = -0.12;

    const cosY = Math.cos(viewYaw);
    const sinY = Math.sin(viewYaw);
    let dx = downX * cosY - downY * sinY;
    let dy = downX * sinY + downY * cosY;
    let dz = downZ;

    const cosP = Math.cos(viewPitch);
    const sinP = Math.sin(viewPitch);
    const dy2 = dy * cosP - dz * sinP;
    dz = dy * sinP + dz * cosP;
    dy = dy2;

    const cosR = Math.cos(viewRoll);
    const sinR = Math.sin(viewRoll);
    const dx2 = dx * cosR - dy * sinR;
    dy = dx * sinR + dy * cosR;
    dx = dx2;

    const mag = Math.hypot(dx, dy) + 1e-6;
    return { x: dx / mag, y: dy / mag };
  }

  function project(x, y, z, w, h) {
    const { rx, ry, rz } = rotateView3(x, y, z);
    const scale = Math.min(w, h) * viewScale;
    const cx = w * CAM_CENTER_X;
    const cy = h * camCenterY;
    const px = cx + (rx - ry) * scale * PROJ_X;
    const py = cy + (rx + ry) * scale * PROJ_Y - rz * scale * PROJ_Z;
    return [px, py];
  }

  function findHighestStart(progress) {
    let bestX = optX;
    let bestY = optY;
    let bestZ = -Infinity;
    for (let x = -0.7; x <= 0.7; x += 0.05) {
      for (let y = -0.7; y <= 0.7; y += 0.05) {
        const z = heightAt(x, y, progress);
        if (z > bestZ) {
          bestZ = z;
          bestX = x;
          bestY = y;
        }
      }
    }
    return { x: bestX, y: bestY };
  }

  function resetBallToPeak() {
    const start = findHighestStart(epoch);
    optX = start.x;
    optY = start.y;
    wanderPhase = Math.random() * Math.PI * 2;
    velX = Math.cos(wanderPhase) * BALL_MIN_SPEED;
    velY = Math.sin(wanderPhase) * BALL_MIN_SPEED;
    stuckFrames = 0;
    optTrail.length = 0;
  }

  function analyzeLocalTerrain(x, y, progress) {
    const z0 = heightAt(x, y, progress);
    let bestRise = -Infinity;
    let bestUx = Math.cos(wanderPhase);
    let bestUy = Math.sin(wanderPhase);
    let avgRise = 0;
    const samples = 16;

    for (let k = 0; k < samples; k += 1) {
      const angle = (k / samples) * Math.PI * 2;
      const nx = clamp(x + Math.cos(angle) * BALL_ESCAPE_PROBE, -0.9, 0.9);
      const ny = clamp(y + Math.sin(angle) * BALL_ESCAPE_PROBE, -0.9, 0.9);
      const rise = heightAt(nx, ny, progress) - z0;
      avgRise += rise;
      if (rise > bestRise) {
        bestRise = rise;
        bestUx = Math.cos(angle);
        bestUy = Math.sin(angle);
      }
    }

    avgRise /= samples;
    return {
      ux: bestUx,
      uy: bestUy,
      rise: bestRise,
      depressed: avgRise > 0.0012,
      tangentX: -bestUy,
      tangentY: bestUx,
    };
  }

  function stepRollingBall(progress, dt) {
    const tick = dt * 60;
    const { gx, gy } = surfaceGradient(optX, optY, progress);
    const gradMag = Math.hypot(gx, gy);
    const gravity = reducedMotion ? BALL_GRAVITY * 0.55 : BALL_GRAVITY;

    if (gradMag > 1e-5) {
      const slope = Math.min(gradMag, 1.2);
      velX += (-gx / gradMag) * gravity * slope * tick;
      velY += (-gy / gradMag) * gravity * slope * tick;
    }

    const terrain = analyzeLocalTerrain(optX, optY, progress);
    const inFlat = gradMag < BALL_FLAT_GRAD;

    if (inFlat || terrain.depressed) {
      const flatBlend = inFlat ? 1 - gradMag / BALL_FLAT_GRAD : 0.55;
      wanderPhase += dt * (0.65 + flatBlend * 0.35);

      if (terrain.rise > 0.0002) {
        velX += terrain.ux * BALL_ESCAPE_PUSH * flatBlend * tick;
        velY += terrain.uy * BALL_ESCAPE_PUSH * flatBlend * tick;
      }

      velX += terrain.tangentX * BALL_ORBIT_PUSH * tick;
      velY += terrain.tangentY * BALL_ORBIT_PUSH * tick;
      velX += Math.cos(wanderPhase) * BALL_ORBIT_PUSH * 0.55 * tick;
      velY += Math.sin(wanderPhase) * BALL_ORBIT_PUSH * 0.55 * tick;
    }

    velX *= BALL_DAMPING;
    velY *= BALL_DAMPING;

    let speed = Math.hypot(velX, velY);
    const maxSpeed = reducedMotion ? BALL_MAX_SPEED * 0.65 : BALL_MAX_SPEED;
    const minSpeed = reducedMotion ? BALL_MIN_SPEED * 0.65 : BALL_MIN_SPEED;

    if (speed > maxSpeed) {
      velX = (velX / speed) * maxSpeed;
      velY = (velY / speed) * maxSpeed;
      speed = maxSpeed;
    }

    if (speed < minSpeed) {
      let dirX;
      let dirY;
      if (gradMag > 1e-4) {
        dirX = -gx / gradMag;
        dirY = -gy / gradMag;
      } else if (terrain.rise > 0.0002) {
        dirX = terrain.ux;
        dirY = terrain.uy;
      } else if (speed > 1e-7) {
        dirX = velX / speed;
        dirY = velY / speed;
      } else {
        dirX = Math.cos(wanderPhase);
        dirY = Math.sin(wanderPhase);
      }
      velX = dirX * minSpeed;
      velY = dirY * minSpeed;
    }

    const prevX = optX;
    const prevY = optY;
    optX = clamp(optX + velX * tick, -0.9, 0.9);
    optY = clamp(optY + velY * tick, -0.9, 0.9);

    if (Math.abs(optX) >= 0.89) velX *= -0.55;
    if (Math.abs(optY) >= 0.89) velY *= -0.55;

    const moved = Math.hypot(optX - prevX, optY - prevY);
    if (moved < BALL_STUCK_MOVE_EPS) {
      stuckFrames += 1;
      if (stuckFrames > 5) {
        wanderPhase += 1.1;
        const kick = minSpeed * 1.35;
        velX = Math.cos(wanderPhase) * kick;
        velY = Math.sin(wanderPhase) * kick;
        optX = clamp(optX + velX * tick * 2, -0.9, 0.9);
        optY = clamp(optY + velY * tick * 2, -0.9, 0.9);
        stuckFrames = 0;
      }
    } else {
      stuckFrames = 0;
    }

    const z = heightAt(optX, optY, progress);
    optTrail.push({ x: optX, y: optY, z });
    if (optTrail.length > TRAIL_LEN) optTrail.shift();
  }

  function getBallScreenPos(w, h) {
    const z = heightAt(optX, optY, epoch);
    return project(optX, optY, z, w, h);
  }

  function ballHitRadius() {
    const w = canvas?.clientWidth || window.innerWidth;
    return w <= 768 ? 26 : BALL_HIT_RADIUS;
  }

  function hitTestBall(clientX, clientY) {
    if (!canvas) return false;
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const [px, py] = getBallScreenPos(canvas.clientWidth, canvas.clientHeight);
    return Math.hypot(mx - px, my - py) <= ballHitRadius();
  }

  function resize() {
    if (!canvas || !root) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = root.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    applyViewportLayout(width, height);
    // 차트 모드는 rAF 루프가 없어 canvas 크기 변경으로 지워진 화면을 직접 다시 그린다.
    if (running && renderMode === "chart") {
      cancelAnimationFrame(raf);
      draw();
    }
  }

  function drawOptimizer(zMin, zMax, w, h) {
    if (!optTrail.length) return;

    for (let i = 1; i < optTrail.length; i++) {
      const prev = optTrail[i - 1];
      const curr = optTrail[i];
      const a = project(prev.x, prev.y, prev.z, w, h);
      const b = project(curr.x, curr.y, curr.z, w, h);
      const alpha = (i / optTrail.length) * 0.32;
      ctx.strokeStyle = `rgba(147, 197, 253, ${alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }

    const z = heightAt(optX, optY, epoch);
    const [px, py] = project(optX, optY, z, w, h);
    const t = (z - zMin) / (zMax - zMin + 0.0001);
    const [r, g, b] = jetColor(t);
    const rollAngle = Math.hypot(velX, velY) > 1e-5 ? Math.atan2(velY, velX) : wanderPhase;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rollAngle);
    ctx.fillStyle = "rgba(239, 246, 255, 0.96)";
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(${r},${g},${b},0.7)`;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0.15, Math.PI * 1.3);
    ctx.stroke();
    ctx.restore();
  }

  function drawSurfaceMesh(w, h, points, zMin, zMax) {
    const cells = [];
    for (let i = 0; i < gridRes - 1; i++) {
      for (let j = 0; j < gridRes - 1; j++) {
        const p00 = points[i][j];
        const p11 = points[i + 1][j + 1];
        cells.push({ i, j, depth: p00.x + p00.y + p00.z + p11.x + p11.y + p11.z });
      }
    }
    cells.sort((a, b) => a.depth - b.depth);

    for (const { i, j } of cells) {
      const p00 = points[i][j];
      const p10 = points[i + 1][j];
      const p01 = points[i][j + 1];
      const p11 = points[i + 1][j + 1];

      ctx.fillStyle = `rgb(${p00.r},${p00.g},${p00.b})`;
      ctx.beginPath();
      const a = project(p00.x, p00.y, p00.z, w, h);
      const bPt = project(p10.x, p10.y, p10.z, w, h);
      const c = project(p11.x, p11.y, p11.z, w, h);
      const d = project(p01.x, p01.y, p01.z, w, h);
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(bPt[0], bPt[1]);
      ctx.lineTo(c[0], c[1]);
      ctx.lineTo(d[0], d[1]);
      ctx.closePath();
      ctx.fill();
    }

    ctx.lineWidth = 0.5;
    for (let i = 0; i < gridRes; i++) {
      for (let j = 0; j < gridRes; j++) {
        const p = points[i][j];
        const [px, py] = project(p.x, p.y, p.z, w, h);
        const tc = (p.z - zMin) / (zMax - zMin + 0.0001);
        const [r, g, b] = jetColor(tc);
        ctx.strokeStyle = `rgba(${Math.round(r * 0.35)},${Math.round(g * 0.35)},${Math.round(b * 0.45)},${0.2 + tc * 0.16})`;
        ctx.beginPath();
        if (i < gridRes - 1) {
          const n = points[i + 1][j];
          const [nx, ny] = project(n.x, n.y, n.z, w, h);
          ctx.moveTo(px, py);
          ctx.lineTo(nx, ny);
        }
        if (j < gridRes - 1) {
          const n = points[i][j + 1];
          const [nx, ny] = project(n.x, n.y, n.z, w, h);
          ctx.moveTo(px, py);
          ctx.lineTo(nx, ny);
        }
        ctx.stroke();
      }
    }
  }

  function drawLandscape(w, h, dt) {
    applyViewportLayout(w, h);
    stepCameraLayout(dt);

    const delta = reducedMotion ? dt * 0.22 : dt;
    if (!reducedMotion && !isDragging && !isZoomDrag) {
      viewYaw += AUTO_YAW_RATE * delta;
    }
    epoch += delta / EPOCH_CYCLE;
    if (epoch >= 1) epoch -= 1;
    stepRollingBall(epoch, delta);

    drawSpaceBackground(w, h, performance.now() * 0.001);

    const step = 2 / (gridRes - 1);
    const points = [];
    let zMin = Infinity;
    let zMax = -Infinity;

    for (let i = 0; i < gridRes; i++) {
      points[i] = [];
      for (let j = 0; j < gridRes; j++) {
        const x = -1 + i * step;
        const y = -1 + j * step;
        const z = heightAt(x, y, epoch);
        zMin = Math.min(zMin, z);
        zMax = Math.max(zMax, z);
        const tc = (z - zMin) / (zMax - zMin + 0.0001);
        const [r, g, b] = jetColor(tc);
        points[i][j] = { x, y, z, r, g, b };
      }
    }

    for (let i = 0; i < gridRes; i++) {
      for (let j = 0; j < gridRes; j++) {
        const tc = (points[i][j].z - zMin) / (zMax - zMin + 0.0001);
        const [r, g, b] = jetColor(tc);
        points[i][j].r = r;
        points[i][j].g = g;
        points[i][j].b = b;
      }
    }

    drawSurfaceMesh(w, h, points, zMin, zMax);
    drawOptimizer(zMin, zMax, w, h);
  }

  function withCamera(yaw, pitch, roll, scale, fn) {
    const saved = {
      yaw: viewYaw,
      pitch: viewPitch,
      roll: viewRoll,
      scale: viewScale,
    };
    viewYaw = yaw;
    viewPitch = pitch;
    viewRoll = roll;
    viewScale = scale;
    try {
      return fn();
    } finally {
      viewYaw = saved.yaw;
      viewPitch = saved.pitch;
      viewRoll = saved.roll;
      viewScale = saved.scale;
    }
  }

  function drawMorphFrame(w, h, rawT) {
    if (!chartBars.length) return;

    const ease = morphEase(rawT);
    const camYaw = lerp(morphFromYaw, CHART_TARGET_YAW, ease);
    const camPitch = lerp(morphFromPitch, CHART_TARGET_PITCH, ease);
    const camRoll = lerp(morphFromRoll, CHART_TARGET_ROLL, ease);
    const camScale = lerp(morphFromScale, CHART_TARGET_SCALE, ease);
    const layout = getChartLayout(w, h);

    drawSpaceBackground(w, h, performance.now() * 0.001);

    withCamera(camYaw, camPitch, camRoll, camScale, () => {
      const step = 2 / (gridRes - 1);
      const points = [];
      let zMin = Infinity;
      let zMax = -Infinity;
      const landHeights = [];

      for (let i = 0; i < gridRes; i++) {
        landHeights[i] = new Float32Array(gridRes);
        points[i] = [];
        const x = -1 + i * step;
        for (let j = 0; j < gridRes; j++) {
          const y = -1 + j * step;
          const zLand = heightAt(x, y, morphEpoch);
          const zChart = chartSurfaceZ(x, y, ease);
          const z = lerp(zLand, zChart, ease);
          landHeights[i][j] = zLand;
          zMin = Math.min(zMin, z);
          zMax = Math.max(zMax, z);
          points[i][j] = { x, y, z, r: 0, g: 0, b: 0 };
        }
      }

      let landLo = Infinity;
      let landHi = -Infinity;
      for (let i = 0; i < gridRes; i++) {
        for (let j = 0; j < gridRes; j++) {
          landLo = Math.min(landLo, landHeights[i][j]);
          landHi = Math.max(landHi, landHeights[i][j]);
        }
      }
      const landSpan = landHi - landLo + 0.0001;

      for (let i = 0; i < gridRes; i++) {
        const x = -1 + i * step;
        for (let j = 0; j < gridRes; j++) {
          const zLand = landHeights[i][j];
          const [lr, lg, lb] = jetColor((zLand - landLo) / landSpan);
          const colorT = waveFrontBlend(x, ease);
          const [cr, cg, cb] = candleRgb(x);
          const p = points[i][j];
          p.r = Math.round(lerp(lr, cr, colorT));
          p.g = Math.round(lerp(lg, cg, colorT));
          p.b = Math.round(lerp(lb, cb, colorT));
        }
      }

      const meshFade =
        rawT >= MORPH_MESH_FADE_START
          ? 1 - smoothstep((rawT - MORPH_MESH_FADE_START) / (1 - MORPH_MESH_FADE_START))
          : 1;
      ctx.save();
      ctx.globalAlpha = meshFade;
      drawSurfaceMesh(w, h, points, zMin, zMax);
      ctx.restore();
    });

    if (rawT >= MORPH_CRISP_START) {
      // crisp chart materializes left→right as a soft wave sweeps the plot,
      // overlapping the dissolving 3D mesh for a seamless hand-off.
      const crispPhase = (rawT - MORPH_CRISP_START) / (1 - MORPH_CRISP_START);
      const reveal = (i, n) => columnReveal(n > 1 ? i / (n - 1) : 1, crispPhase);
      drawCrispCandles(w, h, layout, 1, true, reveal);
      drawRevealScanline(w, h, layout, crispPhase);
      // labels/axes settle in once the sweep is mostly done
      const chromeA = smoothstep(clamp((crispPhase - 0.4) / 0.6, 0, 1));
      if (chromeA > 0.02) {
        drawChartChrome(w, h, layout, chromeA);
        drawIndicatorPanels(w, h, layout, chromeA);
      }
    }
  }

  function tickMorph() {
    if (renderMode !== "morphing") return;
    const elapsed = performance.now() - morphStart;
    morphT = Math.min(1, elapsed / MORPH_DURATION);
    if (morphT >= 1) {
      renderMode = "chart";
      viewYaw = CHART_TARGET_YAW;
      viewPitch = CHART_TARGET_PITCH;
      viewRoll = CHART_TARGET_ROLL;
      viewScale = CHART_TARGET_SCALE;
      root?.classList.add("is-stock-mode");
      if (typeof morphCallback === "function") {
        const cb = morphCallback;
        morphCallback = null;
        cb(chartMeta);
      }
    }
  }

  function frameDelta(now) {
    const ts = typeof now === "number" ? now : performance.now();
    if (!lastDrawTs) {
      lastDrawTs = ts;
      return 1 / 60;
    }
    const raw = (ts - lastDrawTs) / 1000;
    lastDrawTs = ts;
    return Math.min(0.05, Math.max(0.001, raw));
  }

  function trackAdaptiveGrid(now, dt) {
    if (reducedMotion || renderMode !== "landscape") return;
    if (dt > 0) fpsSamples.push(1 / dt);
    if (fpsSamples.length > 36) fpsSamples.shift();
    if (now - fpsCheckTs < 1200 || fpsSamples.length < 12) return;
    fpsCheckTs = now;
    const avgFps = fpsSamples.reduce((sum, fps) => sum + fps, 0) / fpsSamples.length;
    if (avgFps < GRID_FPS_TARGET && gridRes > GRID_MIN) {
      gridRes = Math.max(GRID_MIN, gridRes - 4);
      fpsSamples.length = 0;
    } else if (avgFps > GRID_FPS_RECOVER && gridRes < GRID_MAX) {
      gridRes = Math.min(GRID_MAX, gridRes + 2);
    }
  }

  function draw(now) {
    if (!running || !ctx || !canvas) return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) {
      raf = requestAnimationFrame(draw);
      return;
    }

    if (renderMode === "chart") {
      drawChart2D(w, h, 1);
      raf = 0;
      scheduleChartTwinkle();
      return;
    }

    if (renderMode === "morphing") {
      tickMorph();
      drawMorphFrame(w, h, morphT);
      raf = requestAnimationFrame(draw);
      return;
    }

    const dt = frameDelta(now);
    trackAdaptiveGrid(typeof now === "number" ? now : performance.now(), dt);
    drawLandscape(w, h, dt);
    raf = requestAnimationFrame(draw);
  }

  function clearChartTwinkle() {
    if (chartTwinkleTimer) {
      clearTimeout(chartTwinkleTimer);
      chartTwinkleTimer = 0;
    }
  }

  // 차트 모드 프레임 예약: 60fps 대신 ≈8fps(별 반짝임용). reduced-motion 이면 정적.
  function scheduleChartTwinkle() {
    clearChartTwinkle();
    if (reducedMotion) return;
    chartTwinkleTimer = setTimeout(() => {
      chartTwinkleTimer = 0;
      if (!running || renderMode !== "chart" || document.hidden || raf) return;
      raf = requestAnimationFrame(draw);
    }, CHART_TWINKLE_MS);
  }

  function isZoomModifier(e) {
    return e.ctrlKey || e.metaKey;
  }

  function updateCursor(e) {
    if (!canvas || !running) return;
    if (isZoomDrag) {
      canvas.style.cursor = "ns-resize";
    } else if (hitTestBall(e.clientX, e.clientY)) {
      canvas.style.cursor = "pointer";
    } else {
      canvas.style.cursor = isDragging ? "grabbing" : "grab";
    }
  }

  function pointerDistance() {
    const pts = [...activePointers.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  function onPointerDown(e) {
    if (!running || e.button !== 0) return;
    // 차트 모드: 한 손가락 드래그 = 시간축 이동(팬), 두 손가락 = 핀치 줌(09-05 모바일).
    if (renderMode === "chart") {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.setPointerCapture?.(e.pointerId);
      if (activePointers.size >= 2) {
        isDragging = false;
        pinchStartDist = pointerDistance();
        chartPinchStartCount = chartViewCount || chartBars.length;
        canvas.classList.add("is-dragging");
        e.preventDefault();
        return;
      }
      isDragging = true;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      canvas.classList.add("is-dragging");
      e.preventDefault();
      return;
    }
    if (renderMode !== "landscape") return;

    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 2) {
      isDragging = false;
      isZoomDrag = false;
      pinchStartDist = pointerDistance();
      pinchStartScale = viewScale;
      canvas.classList.add("is-dragging");
      canvas.setPointerCapture?.(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (hitTestBall(e.clientX, e.clientY) && !isZoomModifier(e)) {
      resetBallToPeak();
      activePointers.delete(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    isDragging = true;

    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    canvas.classList.add("is-dragging");
    canvas.setPointerCapture?.(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  }

  function onPointerMove(e) {
    if (activePointers.has(e.pointerId)) {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (activePointers.size >= 2 && pinchStartDist > 0) {
      const dist = pointerDistance();
      if (renderMode === "chart") {
        // 손가락을 벌리면 확대(가시 봉 수 감소), 오므리면 축소. 두 손가락 중점을 고정점으로.
        if (dist > 0 && chartPinchStartCount > 0) {
          const pts = [...activePointers.values()];
          const rect = canvas.getBoundingClientRect();
          const midX = (pts[0].x + pts[1].x) / 2;
          const anchorFrac = clamp((midX - rect.left) / (rect.width || 1), 0, 1);
          const targetCount = chartPinchStartCount * (pinchStartDist / dist);
          const factor = targetCount / Math.max(1, chartViewCount || chartBars.length);
          if (Math.abs(factor - 1) > 0.01) chartZoom(factor, anchorFrac);
        }
        e.preventDefault();
        return;
      }
      if (dist > 0) {
        viewScale = clamp(pinchStartScale * (dist / pinchStartDist), 0.2, 0.62);
      }
      e.preventDefault();
      return;
    }

    const dx = e.clientX - lastPointerX;
    const dy = e.clientY - lastPointerY;
    const dragGain = (canvas?.clientWidth || window.innerWidth) <= 768 ? 0.005 : 0.004;
    const pitchGain = (canvas?.clientWidth || window.innerWidth) <= 768 ? 0.0038 : 0.003;

    if (isZoomDrag) {
      viewScale = clamp(viewScale - dy * 0.0014, 0.2, 0.62);
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      e.preventDefault();
      return;
    }

    if (isDragging && renderMode === "chart") {
      chartPan(dx, canvas?.clientWidth || window.innerWidth);
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      e.preventDefault();
      return;
    }

    if (isDragging && renderMode === "landscape") {
      viewYaw += dx * dragGain;
      viewPitch = clamp(viewPitch + dy * pitchGain, -0.5, 1.3);
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      e.preventDefault();
    }

    updateCursor(e);
  }

  function onPointerUp(e) {
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) {
      pinchStartDist = 0;
      chartPinchStartCount = 0;
    }
    // 차트 모드에서 핀치 중 한 손가락만 떼면 남은 손가락으로 바로 팬을 잇는다.
    if (renderMode === "chart" && activePointers.size === 1) {
      const rest = [...activePointers.values()][0];
      lastPointerX = rest.x;
      lastPointerY = rest.y;
      isDragging = true;
      return;
    }
    isDragging = false;
    isZoomDrag = false;
    canvas.classList.remove("is-dragging");
    updateCursor(e);
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (_) {
      /* ignore */
    }
  }

  function onWheel(e) {
    if (renderMode !== "chart" || chartFullBars.length < MIN_CHART_BARS) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const anchorFrac = clamp((e.clientX - rect.left) / (rect.width || 1), 0, 1);
    // 아래로 스크롤 → 축소(더 넓게), 위로 → 확대(더 좁게)
    chartZoom(e.deltaY > 0 ? 1.18 : 0.85, anchorFrac);
  }

  function bindPointer() {
    if (!canvas) return;
    const opts = { passive: false };
    canvas.addEventListener("pointerdown", onPointerDown, opts);
    canvas.addEventListener("pointermove", onPointerMove, opts);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, opts);
  }

  function unbindPointer() {
    if (!canvas) return;
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    canvas.classList.remove("is-dragging");
    isDragging = false;
    isZoomDrag = false;
    activePointers.clear();
    pinchStartDist = 0;
  }

  function ensureCanvas() {
    root = document.getElementById("aiCosmos");
    if (!root) return false;

    canvas = root.querySelector(".ai-cosmos-canvas");
    if (!canvas) {
      root.innerHTML = "";
      canvas = document.createElement("canvas");
      canvas.className = "ai-cosmos-canvas";
      canvas.setAttribute("aria-hidden", "true");
      root.appendChild(canvas);
    }

    ctx = canvas.getContext("2d", { alpha: false });
    return !!ctx;
  }

  function onVisibility() {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
      clearChartTwinkle();
    } else if (running) {
      cancelAnimationFrame(raf);
      draw();
    }
  }

  function resetLandscapeState() {
    renderMode = "landscape";
    morphT = 0;
    morphStart = 0;
    morphCallback = null;
    chartBars = [];
    chartMeta = { ticker: "", name: "", range: "6M" };
    viewScale = BASE_SCALE;
    targetViewScale = BASE_SCALE;
    viewYaw = DEFAULT_YAW;
    viewPitch = DEFAULT_PITCH;
    targetViewPitch = DEFAULT_PITCH;
    viewRoll = DEFAULT_ROLL;
    camCenterY = CAM_CENTER_Y;
    targetCamCenterY = CAM_CENTER_Y;
    const peak = findHighestStart(0);
    optX = peak.x;
    optY = peak.y;
    wanderPhase = Math.random() * Math.PI * 2;
    velX = Math.cos(wanderPhase) * BALL_MIN_SPEED;
    velY = Math.sin(wanderPhase) * BALL_MIN_SPEED;
    stuckFrames = 0;
    optTrail.length = 0;
    root?.classList.remove("is-stock-mode");
  }

  function morphToChart(payload) {
    if (!ensureCanvas()) return false;
    const bars = Array.isArray(payload?.bars) ? payload.bars : [];
    if (!bars.length) return false;

    chartFullBars = bars;
    chartOverlays = payload.overlays || null;
    // 전체 히스토리 패턴으로 교체(가능하면). 검출 입력=전체 bars, 렌더=가시 구간만 클립.
    const fullPats = computeFullHistoryPatterns(bars);
    if (fullPats && fullPats.length) {
      chartOverlays = chartOverlays
        ? { ...chartOverlays, patterns: fullPats, totalBars: bars.length }
        : { sr: [], trendlines: [], patterns: fullPats, totalBars: bars.length };
    }
    chartBars = sliceBarsByRange(bars, payload.range || "6M");
    resetChartWindow();
    chartMeta = {
      ticker: String(payload.ticker || "").toUpperCase(),
      name: String(payload.name || payload.ticker || ""),
      range: payload.range || "6M",
    };
    updateChartBounds();

    morphFromYaw = viewYaw;
    morphFromPitch = viewPitch;
    morphFromRoll = viewRoll;
    morphFromScale = viewScale;
    morphEpoch = epoch;
    morphT = 0;
    morphCallback = typeof payload.onComplete === "function" ? payload.onComplete : null;
    renderMode = reducedMotion ? "chart" : "morphing";
    morphStart = performance.now();

    if (reducedMotion) {
      viewYaw = CHART_TARGET_YAW;
      viewPitch = CHART_TARGET_PITCH;
      viewRoll = CHART_TARGET_ROLL;
      viewScale = CHART_TARGET_SCALE;
      root?.classList.add("is-stock-mode");
      if (morphCallback) {
        const cb = morphCallback;
        morphCallback = null;
        cb(chartMeta);
      }
    }

    if (!running) {
      start();
    } else {
      // 차트 모드에는 rAF 루프가 없으므로 모핑 루프를 여기서 다시 시동한다.
      clearChartTwinkle();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    }
    return true;
  }

  function resetToLandscape() {
    resetLandscapeState();
    clearChartTwinkle();
    if (running) {
      cancelAnimationFrame(raf);
      draw();
    }
  }

  // 기간 탭 전환: 재-morph 없이 전체 bars를 새 기간으로 재슬라이스해 즉시 다시 그린다.
  function setChartRange(range) {
    if (!chartFullBars.length || renderMode === "landscape") return false;
    chartBars = sliceBarsByRange(chartFullBars, range || "6M");
    if (!chartBars.length) return false;
    resetChartWindow();
    chartMeta.range = range || "6M";
    updateChartBounds();
    if (running && renderMode === "chart") {
      cancelAnimationFrame(raf);
      draw();
    }
    return true;
  }

  function start() {
    if (!ensureCanvas()) return;
    gridRes = GRID_MAX;
    fpsSamples.length = 0;
    fpsCheckTs = 0;
    reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (renderMode === "landscape") {
      epoch = 0;
      resetLandscapeState();
      lastLayoutKey = "";
      applyViewportLayout(
        root?.clientWidth || window.innerWidth,
        root?.clientHeight || window.innerHeight,
      );
    }
    root.classList.add("is-live");
    running = true;
    resize();
    bindPointer();
    if (!resizeObs) {
      resizeObs = new ResizeObserver(resize);
      resizeObs.observe(root);
    }
    document.addEventListener("visibilitychange", onVisibility);
    cancelAnimationFrame(raf);
    draw();
  }

  function stop() {
    running = false;
    lastDrawTs = 0;
    stars = [];
    starsSizeKey = "";
    cancelAnimationFrame(raf);
    raf = 0;
    clearChartTwinkle();
    unbindPointer();
    document.removeEventListener("visibilitychange", onVisibility);
    resizeObs?.disconnect();
    resizeObs = null;
    root?.classList.remove("is-live", "is-stock-mode");
    resetLandscapeState();
  }

  function init() {
    return ensureCanvas();
  }

  // 현재 가시 구간과 겹치는(=검출된) 패턴 수. 렌더 시 추려도 이 값은 전체 검출 기준(검증·디버그용).
  function countVisiblePatterns() {
    if (!chartOverlays || !chartOverlays.patterns || !chartBars.length) return 0;
    const start = Math.round(chartViewStart);
    const end = start + chartBars.length - 1;
    let c = 0;
    for (const pat of chartOverlays.patterns) {
      const r = patternIdxRange(pat);
      if (r && r.hi >= start && r.lo <= end) c += 1;
    }
    return c;
  }
  // 실제로 화면에 그려지는(추려진) 패턴 수.
  function countRenderedPatterns() {
    if (!chartOverlays || !chartOverlays.patterns || !chartBars.length) return 0;
    return selectVisiblePatterns(Math.round(chartViewStart), chartBars.length).length;
  }

  function relayout() {
    if (!root) return;
    lastLayoutKey = "";
    applyViewportLayout(root.clientWidth, root.clientHeight);
    resize();
  }

  // 캔들 유형 전환: 재-morph 없이 현재 차트를 새 유형으로 즉시 다시 그린다. localStorage 유지.
  function setChartStyle(style) {
    if (!CHART_STYLES.has(style)) return false;
    chartStyle = style;
    storage.set(CHART_STYLE_LS_KEY, style);
    if (running && renderMode === "chart") {
      cancelAnimationFrame(raf);
      draw();
    }
    return true;
  }

  window.MirCosmos = {
    init,
    start,
    stop,
    // 테스트·디버그용: 현재 가시 윈도우(팬·핀치 검증)
    getChartView: () => ({ start: chartViewStart, count: chartViewCount, total: chartFullBars.length }),
    morphToChart,
    setChartRange,
    setChartStyle,
    getChartStyle: () => chartStyle,
    resetToLandscape,
    relayout,
    getMode: () => renderMode,
    getChartMeta: () => ({ ...chartMeta, style: chartStyle, visibleBars: chartBars.length, viewStart: Math.round(chartViewStart), totalBars: chartFullBars.length, visiblePatterns: countVisiblePatterns(), renderedPatterns: countRenderedPatterns(), overlays: chartOverlays ? { sr: (chartOverlays.sr || []).length, trendlines: (chartOverlays.trendlines || []).length, patterns: (chartOverlays.patterns || []).length } : null }),
  };
})();