/**
 * AI mode — multi loss-landscape backdrop (3D terrains + physics ball)
 * morphs into a 2D stock chart when the user requests a ticker.
 */
(function () {
  const GRID = 44;
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
  const MORPH_DURATION = 1800;
  const MORPH_CRISP_START = 0.7;
  const RANGE_BARS = { "1M": 22, "3M": 66, "6M": 126, "1Y": 252, "2Y": 504 };
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
  let chartMeta = { ticker: "", name: "", range: "6M" };
  let chartPriceMin = 0;
  let chartPriceMax = 1;
  let morphCallback = null;
  let lastDrawTs = 0;
  let stars = [];
  let starsSizeKey = "";
  let lastLayoutBand = "";
  let pinchStartDist = 0;
  let pinchStartScale = BASE_SCALE;
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

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function sliceBarsByRange(bars, range) {
    const n = RANGE_BARS[range] || RANGE_BARS["6M"];
    return bars.length <= n ? bars.slice() : bars.slice(-n);
  }

  function computeSma(bars, period) {
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
    const volH = Math.max(48, h * 0.14);
    const gap = 8;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB - volH - gap;
    return { padL, padR, padT, padB, volH, gap, plotW, plotH, w, h };
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

  function drawCrispCandles(w, h, layout, alpha, includeVolume) {
    if (!chartBars.length || alpha <= 0) return;
    const { padL, padT, plotW, plotH, volH, gap } = layout;
    const { n, xAt, yAt, candleW } = layoutHelpers(layout);
    const maxVol = Math.max(...chartBars.map((b) => b.v || 0), 1);
    const sma5 = computeSma(chartBars, 5);
    const sma20 = computeSma(chartBars, 20);
    const sma60 = computeSma(chartBars, 60);

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

    function drawMaLine(values, color) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < values.length; i += 1) {
        if (values[i] == null) continue;
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

    for (let i = 0; i < n; i += 1) {
      const bar = chartBars[i];
      const x = xAt(i);
      const up = bar.c >= bar.o;
      const color = up ? "#22c55e" : "#ef4444";
      const bodyTop = yAt(Math.max(bar.o, bar.c));
      const bodyBot = yAt(Math.min(bar.o, bar.c));
      const wickTop = yAt(bar.h);
      const wickBot = yAt(bar.l);
      const bodyH = Math.max(1, bodyBot - bodyTop);

      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, wickTop);
      ctx.lineTo(x, wickBot);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.fillRect(x - candleW * 0.5, bodyTop, candleW, bodyH);
    }

    if (includeVolume) {
      const volTop = padT + plotH + gap;
      for (let i = 0; i < n; i += 1) {
        const bar = chartBars[i];
        const x = xAt(i);
        const up = bar.c >= bar.o;
        const vh = ((bar.v || 0) / maxVol) * (volH - 4);
        ctx.fillStyle = up ? "rgba(34, 197, 94, 0.45)" : "rgba(239, 68, 68, 0.45)";
        ctx.fillRect(x - candleW * 0.5, volTop + volH - vh, candleW, vh);
      }
    }

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

    ctx.fillStyle = "rgba(248, 250, 252, 0.95)";
    ctx.font = "600 15px Pretendard, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(chartMeta.ticker, Math.max(8, padL - 4), Math.max(18, padT - 14));
    ctx.fillStyle = "rgba(148, 163, 184, 0.7)";
    ctx.font = "11px Pretendard, system-ui, sans-serif";
    ctx.fillText(chartMeta.name || "", Math.max(8, padL + 52), Math.max(18, padT - 14));

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
    drawChartChrome(w, h, layout, a);
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

  function applyViewportLayout(w) {
    const band = layoutBand(w);
    if (band === lastLayoutBand) return;
    lastLayoutBand = band;
    if (renderMode !== "landscape" || isDragging || isZoomDrag || activePointers.size > 0) return;

    if (band === "xs") {
      viewScale = 0.32;
      viewPitch = 0.2;
    } else if (band === "sm") {
      viewScale = 0.35;
      viewPitch = 0.16;
    } else {
      viewScale = BASE_SCALE;
      viewPitch = DEFAULT_PITCH;
    }

    stars = [];
    starsSizeKey = "";
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
      h * 0.44,
      Math.min(w, h) * 0.04,
      w * 0.5,
      h * 0.5,
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
    const cy = h * CAM_CENTER_Y;
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
    applyViewportLayout(width);
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
    for (let i = 0; i < GRID - 1; i++) {
      for (let j = 0; j < GRID - 1; j++) {
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
    for (let i = 0; i < GRID; i++) {
      for (let j = 0; j < GRID; j++) {
        const p = points[i][j];
        const [px, py] = project(p.x, p.y, p.z, w, h);
        const tc = (p.z - zMin) / (zMax - zMin + 0.0001);
        const [r, g, b] = jetColor(tc);
        ctx.strokeStyle = `rgba(${Math.round(r * 0.35)},${Math.round(g * 0.35)},${Math.round(b * 0.45)},${0.2 + tc * 0.16})`;
        ctx.beginPath();
        if (i < GRID - 1) {
          const n = points[i + 1][j];
          const [nx, ny] = project(n.x, n.y, n.z, w, h);
          ctx.moveTo(px, py);
          ctx.lineTo(nx, ny);
        }
        if (j < GRID - 1) {
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
    const delta = reducedMotion ? dt * 0.22 : dt;
    if (!reducedMotion && !isDragging && !isZoomDrag) {
      viewYaw += AUTO_YAW_RATE * delta;
    }
    epoch += delta / EPOCH_CYCLE;
    if (epoch >= 1) epoch -= 1;
    stepRollingBall(epoch, delta);

    drawSpaceBackground(w, h, performance.now() * 0.001);

    const step = 2 / (GRID - 1);
    const points = [];
    let zMin = Infinity;
    let zMax = -Infinity;

    for (let i = 0; i < GRID; i++) {
      points[i] = [];
      for (let j = 0; j < GRID; j++) {
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

    for (let i = 0; i < GRID; i++) {
      for (let j = 0; j < GRID; j++) {
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
      const step = 2 / (GRID - 1);
      const points = [];
      let zMin = Infinity;
      let zMax = -Infinity;
      const landHeights = [];

      for (let i = 0; i < GRID; i++) {
        landHeights[i] = new Float32Array(GRID);
        points[i] = [];
        const x = -1 + i * step;
        for (let j = 0; j < GRID; j++) {
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
      for (let i = 0; i < GRID; i++) {
        for (let j = 0; j < GRID; j++) {
          landLo = Math.min(landLo, landHeights[i][j]);
          landHi = Math.max(landHi, landHeights[i][j]);
        }
      }
      const landSpan = landHi - landLo + 0.0001;

      for (let i = 0; i < GRID; i++) {
        const x = -1 + i * step;
        for (let j = 0; j < GRID; j++) {
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

      const meshFade = rawT >= MORPH_CRISP_START ? 1 - smoothstep((rawT - MORPH_CRISP_START) / (1 - MORPH_CRISP_START)) : 1;
      ctx.save();
      ctx.globalAlpha = meshFade;
      drawSurfaceMesh(w, h, points, zMin, zMax);
      ctx.restore();
    });

    if (rawT >= MORPH_CRISP_START) {
      const crispA = smoothstep((rawT - MORPH_CRISP_START) / (1 - MORPH_CRISP_START));
      if (crispA > 0.02) {
        drawCrispCandles(w, h, layout, crispA, true);
        drawChartChrome(w, h, layout, crispA);
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
      raf = requestAnimationFrame(draw);
      return;
    }

    if (renderMode === "morphing") {
      tickMorph();
      drawMorphFrame(w, h, morphT);
      raf = requestAnimationFrame(draw);
      return;
    }

    drawLandscape(w, h, frameDelta(now));
    raf = requestAnimationFrame(draw);
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

    if (isZoomModifier(e)) {
      isZoomDrag = true;
    } else {
      isDragging = true;
    }

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

  function bindPointer() {
    if (!canvas) return;
    const opts = { passive: false };
    canvas.addEventListener("pointerdown", onPointerDown, opts);
    canvas.addEventListener("pointermove", onPointerMove, opts);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
  }

  function onWheel(e) {
    if (!running || !isZoomModifier(e)) return;
    viewScale = clamp(viewScale - e.deltaY * 0.0008, 0.2, 0.62);
    e.preventDefault();
  }

  function unbindPointer() {
    if (!canvas) return;
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    canvas.removeEventListener("wheel", onWheel);
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
    viewYaw = DEFAULT_YAW;
    viewPitch = DEFAULT_PITCH;
    viewRoll = DEFAULT_ROLL;
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

    chartBars = sliceBarsByRange(bars, payload.range || "6M");
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

    if (!running) start();
    return true;
  }

  function resetToLandscape() {
    resetLandscapeState();
    if (running) {
      cancelAnimationFrame(raf);
      draw();
    }
  }

  function start() {
    if (!ensureCanvas()) return;
    reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (renderMode === "landscape") {
      epoch = 0;
      resetLandscapeState();
      lastLayoutBand = "";
      applyViewportLayout(root?.clientWidth || window.innerWidth);
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

  window.MirCosmos = {
    init,
    start,
    stop,
    morphToChart,
    resetToLandscape,
    getMode: () => renderMode,
    getChartMeta: () => ({ ...chartMeta }),
  };
})();