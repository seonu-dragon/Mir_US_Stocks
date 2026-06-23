/* Extended chart pattern detectors — keep in sync with scripts/pattern_detectors_extended.py */
(function (global) {
  const BOX_LOOKBACK = 50;
  const BOX_FLAT_SLOPE = 0.003;
  const WEDGE_SLOPE_TOL = 0.001;
  const FLAGPOLE_MIN = 0.10;
  const PENNANT_POLE_MIN = 0.05;
  const PENNANT_POLE_MAX = 0.15;
  const GAP_MIN_PCT = 0.02;
  const FAKE_BREAK_WIN = 10;
  const CUP_WIN = 40;
  const HANDLE_MAX_PULLBACK = 0.15;

  function push(out, pattern, dir, confirm_idx, neckline, extra) {
    out.push(Object.assign({ pattern, dir, confirm_idx, neckline }, extra || {}));
  }

  function detectPennant(rows, z, H) {
    const out = [];
    for (let end = 3; end < z.length; end += 1) {
      const a = z[end - 3], b = z[end - 2], c = z[end - 1], d = z[end];
      const rise = (b.price - a.price) / a.price;
      if (a.type === "L" && b.type === "H" && rise >= PENNANT_POLE_MIN && rise <= PENNANT_POLE_MAX && c.type === "L" && d.type === "H") {
        const span = Math.max(1, d.idx - a.idx);
        if (Math.abs(c.price - d.price) / b.price < 0.04 && (d.idx - b.idx) <= span * 0.4) {
          const ci = H.confirmBreak(rows, d.idx, b.price, +1, null);
          if (ci != null) push(out, "bull_pennant", +1, ci, b.price);
        }
      }
      const drop = (a.price - b.price) / a.price;
      if (a.type === "H" && b.type === "L" && drop >= PENNANT_POLE_MIN && drop <= PENNANT_POLE_MAX && c.type === "H" && d.type === "L") {
        const span = Math.max(1, d.idx - a.idx);
        if (Math.abs(c.price - d.price) / b.price < 0.04 && (d.idx - b.idx) <= span * 0.4) {
          const ci = H.confirmBreak(rows, d.idx, b.price, -1, null);
          if (ci != null) push(out, "bear_pennant", -1, ci, b.price);
        }
      }
    }
    return out;
  }

  function detectCupAndHandle(rows, z, H) {
    const out = [];
    for (let i = 0; i < z.length - 4; i += 1) {
      const [a, b, c, d, e] = z.slice(i, i + 5);
      if (a.type !== "L" || b.type !== "H" || c.type !== "L" || d.type !== "H" || e.type !== "L") continue;
      const cupDepth = (b.price - c.price) / b.price;
      const handleDepth = (d.price - e.price) / d.price;
      if (cupDepth < 0.12 || cupDepth > 0.45 || handleDepth < 0.03 || handleDepth > HANDLE_MAX_PULLBACK) continue;
      if (Math.abs(a.price - e.price) / b.price > 0.08) continue;
      const ci = H.confirmBreak(rows, e.idx, d.price, +1, c.price);
      if (ci != null) {
        push(out, "cup_and_handle", +1, ci, d.price, {
          points: [{ idx: a.idx, price: a.price, label: "컵시작" }, { idx: c.idx, price: c.price, label: "컵바닥" }, { idx: e.idx, price: e.price, label: "핸들" }],
          necklinePts: [{ idx: d.idx, price: d.price }, { idx: ci, price: d.price }],
        });
      }
    }
    return out;
  }

  function detectChannelBreakout(rows, z, H) {
    const out = [];
    for (let end = 4; end < z.length; end += 1) {
      const window = z.slice(0, end + 1).filter((p) => z[end].idx - p.idx <= H.PAT.TRI_LOOKBACK);
      const highs = window.filter((p) => p.type === "H").slice(-3);
      const lows = window.filter((p) => p.type === "L").slice(-3);
      if (highs.length < 2 || lows.length < 2) continue;
      const sh = H.slopePctPts(highs.map((p) => [p.idx, p.price]));
      const sl = H.slopePctPts(lows.map((p) => [p.idx, p.price]));
      if (sh <= 0.0008 || sl <= 0.0008 || Math.abs(sh - sl) > 0.002) continue;
      const lastIdx = Math.max(highs[highs.length - 1].idx, lows[lows.length - 1].idx);
      const ciUp = H.confirmBreak(rows, lastIdx, highs[highs.length - 1].price, +1, null);
      if (ciUp != null) {
        push(out, "ascending_channel_breakout", +1, ciUp, highs[highs.length - 1].price, {
          lines: [{ pts: [{ idx: highs[0].idx, price: highs[0].price }, { idx: highs[highs.length - 1].idx, price: highs[highs.length - 1].price }] },
            { pts: [{ idx: lows[0].idx, price: lows[0].price }, { idx: lows[lows.length - 1].idx, price: lows[lows.length - 1].price }] }],
        });
      }
      const ciDn = H.confirmBreak(rows, lastIdx, lows[lows.length - 1].price, -1, null);
      if (ciDn != null) {
        push(out, "descending_channel_breakout", -1, ciDn, lows[lows.length - 1].price, {
          lines: [{ pts: [{ idx: highs[0].idx, price: highs[0].price }, { idx: highs[highs.length - 1].idx, price: highs[highs.length - 1].price }] },
            { pts: [{ idx: lows[0].idx, price: lows[0].price }, { idx: lows[lows.length - 1].idx, price: lows[lows.length - 1].price }] }],
        });
      }
    }
    return out;
  }

  function detectReversal123(rows, z, H) {
    const out = [];
    for (let i = 0; i < z.length - 2; i += 1) {
      const [a, b, c] = z.slice(i, i + 3);
      if (a.type === "L" && b.type === "H" && c.type === "L" && c.price > a.price) {
        const ci = H.confirmBreak(rows, c.idx, b.price, +1, a.price);
        if (ci != null) push(out, "reversal_123_up", +1, ci, b.price, { points: [a, b, c].map((p, j) => ({ idx: p.idx, price: p.price, label: String(j + 1) })) });
      }
      if (a.type === "H" && b.type === "L" && c.type === "H" && c.price < a.price) {
        const ci = H.confirmBreak(rows, c.idx, b.price, -1, a.price);
        if (ci != null) push(out, "reversal_123_down", -1, ci, b.price, { points: [a, b, c].map((p, j) => ({ idx: p.idx, price: p.price, label: String(j + 1) })) });
      }
    }
    return out;
  }

  function detectTwoB(rows, z, H) {
    const out = [];
    for (let i = 0; i < z.length - 2; i += 1) {
      const [a, b, c] = z.slice(i, i + 3);
      if (a.type === "L" && b.type === "H" && c.type === "L") {
        const bot = (a.price + c.price) / 2;
        if (c.price < a.price * 0.995 && Math.abs(a.price - c.price) / bot <= H.PAT.TOP_TOL) {
          const ci = H.confirmBreak(rows, c.idx, b.price, +1, Math.min(a.price, c.price));
          if (ci != null) push(out, "two_b_bottom", +1, ci, b.price, { points: [{ idx: a.idx, price: a.price, label: "1차" }, { idx: c.idx, price: c.price, label: "2B" }] });
        }
      }
      if (a.type === "H" && b.type === "L" && c.type === "H") {
        const top = (a.price + c.price) / 2;
        if (c.price > a.price * 1.005 && Math.abs(a.price - c.price) / top <= H.PAT.TOP_TOL) {
          const ci = H.confirmBreak(rows, c.idx, b.price, -1, Math.max(a.price, c.price));
          if (ci != null) push(out, "two_b_top", -1, ci, b.price, { points: [{ idx: a.idx, price: a.price, label: "1차" }, { idx: c.idx, price: c.price, label: "2B" }] });
        }
      }
    }
    return out;
  }

  function detectFakeBreakout(rows, H) {
    const out = [];
    const n = rows.length;
    for (let k = H.PAT.SR_LOOKBACK; k < n - FAKE_BREAK_WIN; k += 1) {
      const prev = rows[k - 1].c;
      const price = rows[k].c;
      const lo = Math.max(0, k - H.PAT.SR_LOOKBACK);
      let res = -Infinity, sup = Infinity;
      for (let i = lo; i < k; i += 1) { res = Math.max(res, rows[i].h); sup = Math.min(sup, rows[i].l); }
      if (prev <= res && res < price) {
        let failed = false;
        for (let j = k + 1; j < Math.min(n, k + 1 + FAKE_BREAK_WIN); j += 1) if (rows[j].c < res) { failed = true; break; }
        if (failed) push(out, "bull_trap", -1, k, res);
      }
      if (prev >= sup && sup > price) {
        let failed = false;
        for (let j = k + 1; j < Math.min(n, k + 1 + FAKE_BREAK_WIN); j += 1) if (rows[j].c > sup) { failed = true; break; }
        if (failed) push(out, "bear_trap", +1, k, sup);
      }
    }
    return out;
  }

  function detectGaps(rows) {
    const out = [];
    for (let k = 1; k < rows.length; k += 1) {
      const prev = rows[k - 1], cur = rows[k];
      const gapUp = cur.l > prev.h * (1 + GAP_MIN_PCT);
      const gapDn = cur.h < prev.l * (1 - GAP_MIN_PCT);
      if (gapUp) push(out, k < 30 || cur.c > prev.c * 1.05 ? "breakaway_gap_up" : "exhaustion_gap_up", +1, k, prev.h);
      if (gapDn) push(out, k < 30 || cur.c < prev.c * 0.95 ? "breakaway_gap_down" : "exhaustion_gap_down", -1, k, prev.l);
      if (gapUp && k >= 2) {
        const p2 = rows[k - 2];
        if (p2.h < cur.l && rows[k - 1].l > p2.h) push(out, "island_reversal", -1, k, cur.l);
      }
      if (gapDn && k >= 2) {
        const p2 = rows[k - 2];
        if (p2.l > cur.h && rows[k - 1].h < p2.l) push(out, "island_reversal", +1, k, cur.h);
      }
    }
    return out;
  }

  function detectGapFill(rows) {
    const out = [];
    const n = rows.length;
    for (let k = 1; k < n - 15; k += 1) {
      const prev = rows[k - 1], cur = rows[k];
      if (cur.l > prev.h) {
        const gapLo = prev.h, gapHi = cur.l;
        for (let j = k + 1; j < Math.min(n, k + 16); j += 1) {
          if (rows[j].l <= gapHi && rows[j].h >= gapLo) { push(out, "gap_fill_setup", +1, j, gapLo); break; }
        }
      }
      if (cur.h < prev.l) {
        const gapLo = cur.h, gapHi = prev.l;
        for (let j = k + 1; j < Math.min(n, k + 16); j += 1) {
          if (rows[j].l <= gapHi && rows[j].h >= gapLo) { push(out, "gap_fill_setup", -1, j, gapHi); break; }
        }
      }
    }
    return out;
  }

  function detectVolumeClimax(rows) {
    const out = [];
    for (let k = 20; k < rows.length; k += 1) {
      let avg = 0;
      for (let i = k - 20; i < k; i += 1) avg += rows[i].v || 0;
      avg /= 20;
      if ((rows[k].v || 0) < avg * 2.5) continue;
      const ret = (rows[k].c - rows[k - 1].c) / rows[k - 1].c;
      if (ret > 0.02) push(out, "volume_climax_up", +1, k, rows[k].c);
      else if (ret < -0.02) push(out, "volume_climax_down", -1, k, rows[k].c);
    }
    return out;
  }

  function detectNrInside(rows, H) {
    const out = [];
    const n = rows.length;
    for (let k = 5; k < n; k += 1) {
      const rng = rows[k].h - rows[k].l;
      let isNr4 = rng > 0;
      for (let i = k - 4; i < k; i += 1) if (rng >= rows[i].h - rows[i].l) isNr4 = false;
      if (isNr4) {
        const ciUp = H.confirmBreak(rows, k, rows[k].h, +1, rows[k].l);
        if (ciUp != null) push(out, "nr4_breakout_up", +1, ciUp, rows[k].h);
        const ciDn = H.confirmBreak(rows, k, rows[k].l, -1, rows[k].h);
        if (ciDn != null) push(out, "nr4_breakout_down", -1, ciDn, rows[k].l);
      }
      if (k >= 2) {
        const prev = rows[k - 1], cur = rows[k];
        if (cur.h <= prev.h && cur.l >= prev.l) {
          const ciUp = H.confirmBreak(rows, k, prev.h, +1, cur.l);
          if (ciUp != null) push(out, "inside_bar_breakout_up", +1, ciUp, prev.h);
          const ciDn = H.confirmBreak(rows, k, prev.l, -1, cur.h);
          if (ciDn != null) push(out, "inside_bar_breakout_down", -1, ciDn, prev.l);
        }
      }
    }
    return out;
  }

  function detectHarmonicAbcd(rows, z, H) {
    const out = [];
    for (let i = 0; i < z.length - 3; i += 1) {
      const [a, b, c, d] = z.slice(i, i + 4);
      const ab = Math.abs(b.price - a.price);
      if (ab <= 0) continue;
      const bc = Math.abs(c.price - b.price) / ab;
      const cd = Math.abs(d.price - c.price) / ab;
      if (bc < 0.55 || bc > 0.72 || cd < 1.1 || cd > 1.8) continue;
      if (a.type === "L" && b.type === "H" && c.type === "L" && d.type === "H") {
        const ci = H.confirmBreak(rows, d.idx, b.price, +1, c.price);
        if (ci != null) push(out, "harmonic_abcd_bull", +1, ci, b.price, { points: [a, b, c, d].map((p) => ({ idx: p.idx, price: p.price })) });
      }
      if (a.type === "H" && b.type === "L" && c.type === "H" && d.type === "L") {
        const ci = H.confirmBreak(rows, d.idx, b.price, -1, c.price);
        if (ci != null) push(out, "harmonic_abcd_bear", -1, ci, b.price, { points: [a, b, c, d].map((p) => ({ idx: p.idx, price: p.price })) });
      }
    }
    return out;
  }

  function body(r) { return Math.abs(r.c - r.o); }
  function range(r) { return Math.max(1e-9, r.h - r.l); }

  function detectCandleConfirmations(rows) {
    const out = [];
    for (let k = 2; k < rows.length; k += 1) {
      const a = rows[k - 2], b = rows[k - 1], c = rows[k];
      const bodyC = body(c), bodyB = body(b), rngC = range(c);
      if (c.c > c.o && b.c < b.o && c.c >= b.o && c.o <= b.c && bodyC > bodyB) push(out, "bullish_engulfing", +1, k, c.c);
      if (c.c < c.o && b.c > b.o && c.o >= b.c && c.c <= b.o && bodyC > bodyB) push(out, "bearish_engulfing", -1, k, c.c);
      const lower = Math.min(c.c, c.o) - c.l, upper = c.h - Math.max(c.c, c.o);
      if (lower > bodyC * 2 && upper < bodyC && c.c < a.c) push(out, "hammer", +1, k, c.c);
      if (upper > bodyC * 2 && lower < bodyC && c.c > a.c) push(out, "shooting_star", -1, k, c.c);
      if (bodyC < rngC * 0.1) push(out, "doji", 0, k, c.c);
      const m1 = rows[k - 2], m2 = rows[k - 1], m3 = rows[k];
      if (body(m2) < range(m2) * 0.25 && m1.c < m1.o && m3.c > m3.o && m3.c > (m1.o + m1.c) / 2) push(out, "morning_star", +1, k, m3.c);
      if (body(m2) < range(m2) * 0.25 && m1.c > m1.o && m3.c < m3.o && m3.c < (m1.o + m1.c) / 2) push(out, "evening_star", -1, k, m3.c);
      if (k >= 2) {
        const r1 = rows[k - 2], r2 = rows[k - 1], r3 = rows[k];
        if (r1.c > r1.o && r2.c > r2.o && r3.c > r3.o && r2.c > r1.c && r3.c > r2.c) push(out, "three_white_soldiers", +1, k, r3.c);
        if (r1.c < r1.o && r2.c < r2.o && r3.c < r3.o && r2.c < r1.c && r3.c < r2.c) push(out, "three_black_crows", -1, k, r3.c);
      }
      if (c.c > c.o && b.c < b.o && c.c > (b.o + b.c) / 2 && c.o < b.c) push(out, "piercing_line", +1, k, c.c);
      if (c.c < c.o && b.c > b.o && c.c < (b.o + b.c) / 2 && c.o > b.c) push(out, "dark_cloud_cover", -1, k, c.c);
    }
    return out;
  }

  function detectAll(rows, z, pivots, H) {
    return [].concat(
      detectPennant(rows, z, H),
      detectCupAndHandle(rows, z, H),
      detectChannelBreakout(rows, z, H),
      detectReversal123(rows, z, H),
      detectTwoB(rows, z, H),
      detectFakeBreakout(rows, H),
      detectGaps(rows),
      detectGapFill(rows),
      detectVolumeClimax(rows),
      detectNrInside(rows, H),
      detectHarmonicAbcd(rows, z, H),
      detectCandleConfirmations(rows)
    );
  }

  global.MirPatternExt = { detectAll };
})(typeof window !== "undefined" ? window : globalThis);