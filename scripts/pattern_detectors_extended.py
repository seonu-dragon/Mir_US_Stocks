"""Extended chart pattern detectors — must stay in sync with analysis.js."""
from __future__ import annotations

import pattern_lib as pl

BOX_LOOKBACK = 50
BOX_FLAT_SLOPE = 0.003
WEDGE_SLOPE_TOL = 0.001
FLAGPOLE_MIN = 0.10
PENNANT_POLE_MIN = 0.05
PENNANT_POLE_MAX = 0.15
GAP_MIN_PCT = 0.02
FAKE_BREAK_WIN = 10
CUP_WIN = 40
HANDLE_MAX_PULLBACK = 0.15


def _append(out, pattern, direction, confirm_idx, neckline):
    out.append({"pattern": pattern, "dir": direction, "confirm_idx": confirm_idx, "neckline": neckline})


def detect_wedge(rows, z):
    out = []
    for end in range(4, len(z)):
        window = [p for p in z[: end + 1] if z[end]["idx"] - p["idx"] <= pl.TRI_LOOKBACK]
        highs = [p for p in window if p["type"] == "H"][-3:]
        lows = [p for p in window if p["type"] == "L"][-3:]
        if len(highs) < 2 or len(lows) < 2:
            continue
        sh = pl._slope_pct([(p["idx"], p["price"]) for p in highs])
        sl = pl._slope_pct([(p["idx"], p["price"]) for p in lows])
        res = sum(p["price"] for p in highs) / len(highs)
        sup = sum(p["price"] for p in lows) / len(lows)
        if res <= sup:
            continue
        last_idx = max(highs[-1]["idx"], lows[-1]["idx"])
        pat = direction = neck = None
        if sh < -WEDGE_SLOPE_TOL and sl < -WEDGE_SLOPE_TOL and sh < sl:
            pat, direction, neck = "falling_wedge", +1, highs[-1]["price"]
        elif sh > WEDGE_SLOPE_TOL and sl > WEDGE_SLOPE_TOL and sh < sl:
            pat, direction, neck = "rising_wedge", -1, lows[-1]["price"]
        if pat:
            ci = pl._confirm_break(rows, last_idx, neck, direction, None)
            if ci is not None:
                _append(out, pat, direction, ci, neck)
    return out


def detect_box(rows, z):
    out = []
    for end in range(4, len(z)):
        window = [p for p in z[: end + 1] if z[end]["idx"] - p["idx"] <= BOX_LOOKBACK]
        highs = [p for p in window if p["type"] == "H"][-3:]
        lows = [p for p in window if p["type"] == "L"][-3:]
        if len(highs) < 2 or len(lows) < 2:
            continue
        avg_h = sum(p["price"] for p in highs) / len(highs)
        avg_l = sum(p["price"] for p in lows) / len(lows)
        if avg_h <= avg_l:
            continue
        sh = pl._slope_pct([(p["idx"], p["price"]) for p in highs])
        sl = pl._slope_pct([(p["idx"], p["price"]) for p in lows])
        if abs(sh) >= BOX_FLAT_SLOPE or abs(sl) >= BOX_FLAT_SLOPE:
            continue
        if not all(abs(p["price"] - avg_h) / avg_h < 0.02 for p in highs):
            continue
        if not all(abs(p["price"] - avg_l) / avg_l < 0.02 for p in lows):
            continue
        last_idx = max(highs[-1]["idx"], lows[-1]["idx"])
        ci_up = pl._confirm_break(rows, last_idx, avg_h, +1, None)
        ci_dn = pl._confirm_break(rows, last_idx, avg_l, -1, None)
        if ci_up is not None and (ci_dn is None or ci_up <= ci_dn):
            _append(out, "box_breakout", +1, ci_up, avg_h)
        elif ci_dn is not None:
            _append(out, "box_breakdown", -1, ci_dn, avg_l)
    return out


def detect_flag(rows, z, bull=True):
    out = []
    for end in range(3, len(z)):
        a, b, c, d = z[end - 3], z[end - 2], z[end - 1], z[end]
        if bull:
            rise = (b["price"] - a["price"]) / a["price"] if a["price"] else 0
            if a["type"] == "L" and b["type"] == "H" and rise >= FLAGPOLE_MIN:
                if c["type"] == "L" and d["type"] == "H" and d["price"] < b["price"] and c["price"] < b["price"]:
                    ci = pl._confirm_break(rows, d["idx"], b["price"], +1, None)
                    if ci is not None:
                        _append(out, "bull_flag", +1, ci, b["price"])
        else:
            drop = (a["price"] - b["price"]) / a["price"] if a["price"] else 0
            if a["type"] == "H" and b["type"] == "L" and drop >= FLAGPOLE_MIN:
                if c["type"] == "H" and d["type"] == "L" and d["price"] > b["price"] and c["price"] > b["price"]:
                    ci = pl._confirm_break(rows, d["idx"], b["price"], -1, None)
                    if ci is not None:
                        _append(out, "bear_flag", -1, ci, b["price"])
    return out


def detect_pennant(rows, z):
    out = []
    for end in range(3, len(z)):
        a, b, c, d = z[end - 3], z[end - 2], z[end - 1], z[end]
        rise = (b["price"] - a["price"]) / a["price"] if a["price"] else 0
        if a["type"] == "L" and b["type"] == "H" and PENNANT_POLE_MIN <= rise <= PENNANT_POLE_MAX:
            if c["type"] == "L" and d["type"] == "H":
                span = max(1, d["idx"] - a["idx"])
                if abs(c["price"] - d["price"]) / b["price"] < 0.04 and (d["idx"] - b["idx"]) <= span * 0.4:
                    ci = pl._confirm_break(rows, d["idx"], b["price"], +1, None)
                    if ci is not None:
                        _append(out, "bull_pennant", +1, ci, b["price"])
        drop = (a["price"] - b["price"]) / a["price"] if a["price"] else 0
        if a["type"] == "H" and b["type"] == "L" and PENNANT_POLE_MIN <= drop <= PENNANT_POLE_MAX:
            if c["type"] == "H" and d["type"] == "L":
                span = max(1, d["idx"] - a["idx"])
                if abs(c["price"] - d["price"]) / b["price"] < 0.04 and (d["idx"] - b["idx"]) <= span * 0.4:
                    ci = pl._confirm_break(rows, d["idx"], b["price"], -1, None)
                    if ci is not None:
                        _append(out, "bear_pennant", -1, ci, b["price"])
    return out


def detect_triple(rows, z):
    out = []
    for i in range(len(z) - 4):
        p = z[i : i + 5]
        types = "".join(x["type"] for x in p)
        if types == "HLHLH":
            t1, b1, t2, b2, t3 = p
            top = (t1["price"] + t2["price"] + t3["price"]) / 3
            if top <= 0:
                continue
            diffs = [abs(t1["price"] - t2["price"]) / top, abs(t2["price"] - t3["price"]) / top, abs(t1["price"] - t3["price"]) / top]
            troughs = [(top - b1["price"]) / top, (top - b2["price"]) / top]
            if all(d <= 0.02 for d in diffs) and all(t >= 0.03 for t in troughs):
                neck = min(b1["price"], b2["price"])
                ci = pl._confirm_break(rows, t3["idx"], neck, -1, max(t1["price"], t2["price"], t3["price"]))
                if ci is not None:
                    _append(out, "triple_top", -1, ci, neck)
        if types == "LHLHL":
            b1, t1, b2, t2, b3 = p
            bot = (b1["price"] + b2["price"] + b3["price"]) / 3
            if bot <= 0:
                continue
            diffs = [abs(b1["price"] - b2["price"]) / bot, abs(b2["price"] - b3["price"]) / bot, abs(b1["price"] - b3["price"]) / bot]
            peaks = [(t1["price"] - bot) / bot, (t2["price"] - bot) / bot]
            if all(d <= 0.02 for d in diffs) and all(t >= 0.03 for t in peaks):
                neck = max(t1["price"], t2["price"])
                ci = pl._confirm_break(rows, b3["idx"], neck, +1, min(b1["price"], b2["price"], b3["price"]))
                if ci is not None:
                    _append(out, "triple_bottom", +1, ci, neck)
    return out


def detect_broadening(rows, z):
    out = []
    flat = 0.001
    for end in range(4, len(z)):
        window = [p for p in z[: end + 1] if z[end]["idx"] - p["idx"] <= pl.TRI_LOOKBACK]
        highs = [p for p in window if p["type"] == "H"][-3:]
        lows = [p for p in window if p["type"] == "L"][-3:]
        if len(highs) < 2 or len(lows) < 2:
            continue
        sh = pl._slope_pct([(p["idx"], p["price"]) for p in highs])
        sl = pl._slope_pct([(p["idx"], p["price"]) for p in lows])
        if sh <= flat or sl >= -flat:
            continue
        last_idx = max(highs[-1]["idx"], lows[-1]["idx"])
        ci_up = pl._confirm_break(rows, last_idx, highs[-1]["price"], +1, None)
        ci_dn = pl._confirm_break(rows, last_idx, lows[-1]["price"], -1, None)
        if ci_up is not None and (ci_dn is None or ci_up <= ci_dn):
            _append(out, "broadening_triangle", +1, ci_up, highs[-1]["price"])
        elif ci_dn is not None:
            _append(out, "broadening_triangle", -1, ci_dn, lows[-1]["price"])
    return out


def detect_diamond(rows, z):
    out = []
    for i in range(len(z) - 6):
        p = z[i : i + 7]
        r1 = abs(p[1]["price"] - p[0]["price"])
        r3 = abs(p[3]["price"] - p[2]["price"])
        r4 = abs(p[4]["price"] - p[3]["price"])
        r6 = abs(p[6]["price"] - p[5]["price"])
        if not (r3 > r1 and r6 < r4):
            continue
        highs = [x for x in p if x["type"] == "H"]
        lows = [x for x in p if x["type"] == "L"]
        if len(highs) < 3 or len(lows) < 3:
            continue
        last_idx = p[6]["idx"]
        res = highs[-1]["price"]
        sup = lows[-1]["price"]
        ci_up = pl._confirm_break(rows, last_idx, res, +1, None)
        ci_dn = pl._confirm_break(rows, last_idx, sup, -1, None)
        if ci_up is not None and (ci_dn is None or ci_up <= ci_dn):
            _append(out, "diamond_top", +1, ci_up, res)
        elif ci_dn is not None:
            _append(out, "diamond_bottom", -1, ci_dn, sup)
    return out


def detect_rounding_bottom(rows):
    out = []
    n = len(rows)
    win = CUP_WIN
    if n < win + 10:
        return out
    for k in range(win, n, 5):
        ys = [rows[i]["l"] for i in range(k - win, k)]
        xs = list(range(win))
        s = win
        sum_x = sum(xs)
        sum_x2 = sum(x * x for x in xs)
        sum_x3 = sum(x * x * x for x in xs)
        sum_x4 = sum(x * x * x * x for x in xs)
        sum_y = sum(ys)
        sum_xy = sum(x * y for x, y in zip(xs, ys))
        sum_x2y = sum(x * x * y for x, y in zip(xs, ys))
        det = s * (sum_x2 * sum_x4 - sum_x3 * sum_x3) - sum_x * (sum_x * sum_x4 - sum_x2 * sum_x3) + sum_x2 * (sum_x * sum_x3 - sum_x2 * sum_x2)
        if abs(det) < 1e-5:
            continue
        a = (sum_y * (sum_x2 * sum_x4 - sum_x3 * sum_x3) - sum_x * (sum_xy * sum_x4 - sum_x2y * sum_x3) + sum_x2 * (sum_xy * sum_x3 - sum_x2y * sum_x2)) / det
        b = (s * (sum_xy * sum_x4 - sum_x2y * sum_x3) - sum_y * (sum_x * sum_x4 - sum_x2 * sum_x3) + sum_x2 * (sum_x * sum_x2y - sum_xy * sum_x2)) / det
        axis = -b / (2 * a) if a else 0
        if a > 0.005 and win * 0.35 < axis < win * 0.65:
            cup_lip = max(ys[0], ys[-1])
            ci = pl._confirm_break(rows, k - 1, cup_lip, +1, None)
            if ci is not None and ci >= k:
                _append(out, "rounding_bottom", +1, ci, cup_lip)
    return out


def detect_complex_hns(rows, z):
    out = []
    for i in range(len(z) - 6):
        p = z[i : i + 7]
        types = "".join(x["type"] for x in p)
        if types == "HLHLHLH":
            ls1, b1, head, b2, rs1, b3, rs2 = p
            if head["price"] > ls1["price"] and head["price"] > rs1["price"] and head["price"] > rs2["price"]:
                neck = min(b1["price"], b2["price"], b3["price"])
                ci = pl._confirm_break(rows, rs2["idx"], neck, -1, head["price"])
                if ci is not None:
                    _append(out, "complex_hns", -1, ci, neck)
        if types == "LHLHLHL":
            ls1, t1, head, t2, rs1, t3, rs2 = p
            if head["price"] < ls1["price"] and head["price"] < rs1["price"] and head["price"] < rs2["price"]:
                neck = max(t1["price"], t2["price"], t3["price"])
                ci = pl._confirm_break(rows, rs2["idx"], neck, +1, head["price"])
                if ci is not None:
                    _append(out, "complex_hns", +1, ci, neck)
    return out


def detect_cup_and_handle(rows, z):
    out = []
    for i in range(len(z) - 4):
        a, b, c, d, e = z[i], z[i + 1], z[i + 2], z[i + 3], z[i + 4]
        if a["type"] != "L" or b["type"] != "H" or c["type"] != "L" or d["type"] != "H" or e["type"] != "L":
            continue
        cup_depth = (b["price"] - c["price"]) / b["price"] if b["price"] else 0
        handle_depth = (d["price"] - e["price"]) / d["price"] if d["price"] else 0
        if not (0.12 <= cup_depth <= 0.45):
            continue
        if not (0.03 <= handle_depth <= HANDLE_MAX_PULLBACK):
            continue
        if abs(a["price"] - e["price"]) / b["price"] > 0.08:
            continue
        ci = pl._confirm_break(rows, e["idx"], d["price"], +1, c["price"])
        if ci is not None:
            _append(out, "cup_and_handle", +1, ci, d["price"])
    return out


def detect_channel_breakout(rows, z):
    out = []
    for end in range(4, len(z)):
        window = [p for p in z[: end + 1] if z[end]["idx"] - p["idx"] <= pl.TRI_LOOKBACK]
        highs = [p for p in window if p["type"] == "H"][-3:]
        lows = [p for p in window if p["type"] == "L"][-3:]
        if len(highs) < 2 or len(lows) < 2:
            continue
        sh = pl._slope_pct([(p["idx"], p["price"]) for p in highs])
        sl = pl._slope_pct([(p["idx"], p["price"]) for p in lows])
        if sh <= 0.0008 or sl <= 0.0008 or abs(sh - sl) > 0.002:
            continue
        last_idx = max(highs[-1]["idx"], lows[-1]["idx"])
        ci = pl._confirm_break(rows, last_idx, highs[-1]["price"], +1, None)
        if ci is not None:
            _append(out, "ascending_channel_breakout", +1, ci, highs[-1]["price"])
        ci = pl._confirm_break(rows, last_idx, lows[-1]["price"], -1, None)
        if ci is not None:
            _append(out, "descending_channel_breakout", -1, ci, lows[-1]["price"])
    return out


def detect_reversal_123(rows, z):
    out = []
    for i in range(len(z) - 2):
        a, b, c = z[i], z[i + 1], z[i + 2]
        if a["type"] == "L" and b["type"] == "H" and c["type"] == "L":
            if c["price"] > a["price"]:
                ci = pl._confirm_break(rows, c["idx"], b["price"], +1, a["price"])
                if ci is not None:
                    _append(out, "reversal_123_up", +1, ci, b["price"])
        if a["type"] == "H" and b["type"] == "L" and c["type"] == "H":
            if c["price"] < a["price"]:
                ci = pl._confirm_break(rows, c["idx"], b["price"], -1, a["price"])
                if ci is not None:
                    _append(out, "reversal_123_down", -1, ci, b["price"])
    return out


def detect_two_b(rows, z):
    out = []
    for i in range(len(z) - 2):
        a, b, c = z[i], z[i + 1], z[i + 2]
        if a["type"] == "L" and b["type"] == "H" and c["type"] == "L":
            bot = (a["price"] + c["price"]) / 2
            if bot > 0 and c["price"] < a["price"] * 0.995 and abs(a["price"] - c["price"]) / bot <= pl.TOP_TOL:
                ci = pl._confirm_break(rows, c["idx"], b["price"], +1, min(a["price"], c["price"]))
                if ci is not None:
                    _append(out, "two_b_bottom", +1, ci, b["price"])
        if a["type"] == "H" and b["type"] == "L" and c["type"] == "H":
            top = (a["price"] + c["price"]) / 2
            if top > 0 and c["price"] > a["price"] * 1.005 and abs(a["price"] - c["price"]) / top <= pl.TOP_TOL:
                ci = pl._confirm_break(rows, c["idx"], b["price"], -1, max(a["price"], c["price"]))
                if ci is not None:
                    _append(out, "two_b_top", -1, ci, b["price"])
    return out


def detect_fake_breakout(rows):
    out = []
    n = len(rows)
    for k in range(pl.SR_LOOKBACK, n - FAKE_BREAK_WIN):
        prev = rows[k - 1]["c"]
        price = rows[k]["c"]
        lo = max(0, k - pl.SR_LOOKBACK)
        res = max(rows[i]["h"] for i in range(lo, k))
        sup = min(rows[i]["l"] for i in range(lo, k))
        if prev <= res < price:
            failed = any(rows[j]["c"] < res for j in range(k + 1, min(n, k + 1 + FAKE_BREAK_WIN)))
            if failed:
                _append(out, "bull_trap", -1, k, res)
        if prev >= sup > price:
            failed = any(rows[j]["c"] > sup for j in range(k + 1, min(n, k + 1 + FAKE_BREAK_WIN)))
            if failed:
                _append(out, "bear_trap", +1, k, sup)
    return out


def detect_gaps(rows):
    out = []
    n = len(rows)
    for k in range(1, n):
        prev = rows[k - 1]
        cur = rows[k]
        gap_up = cur["l"] > prev["h"] * (1 + GAP_MIN_PCT)
        gap_dn = cur["h"] < prev["l"] * (1 - GAP_MIN_PCT)
        if gap_up:
            pat = "breakaway_gap_up" if k < 30 or cur["c"] > prev["c"] * 1.05 else "exhaustion_gap_up"
            _append(out, pat, +1, k, prev["h"])
        if gap_dn:
            pat = "breakaway_gap_down" if k < 30 or cur["c"] < prev["c"] * 0.95 else "exhaustion_gap_down"
            _append(out, pat, -1, k, prev["l"])
        if gap_up and k >= 2:
            p2 = rows[k - 2]
            if p2["h"] < cur["l"] and rows[k - 1]["l"] > p2["h"]:
                _append(out, "island_reversal", -1, k, cur["l"])
        if gap_dn and k >= 2:
            p2 = rows[k - 2]
            if p2["l"] > cur["h"] and rows[k - 1]["h"] < p2["l"]:
                _append(out, "island_reversal", +1, k, cur["h"])
    return out


def detect_gap_fill(rows):
    out = []
    n = len(rows)
    for k in range(1, n - 15):
        prev, cur = rows[k - 1], rows[k]
        if cur["l"] > prev["h"]:
            gap_lo, gap_hi = prev["h"], cur["l"]
            for j in range(k + 1, min(n, k + 16)):
                if rows[j]["l"] <= gap_hi and rows[j]["h"] >= gap_lo:
                    _append(out, "gap_fill_setup", +1, j, gap_lo)
                    break
        if cur["h"] < prev["l"]:
            gap_lo, gap_hi = cur["h"], prev["l"]
            for j in range(k + 1, min(n, k + 16)):
                if rows[j]["l"] <= gap_hi and rows[j]["h"] >= gap_lo:
                    _append(out, "gap_fill_setup", -1, j, gap_hi)
                    break
    return out


def detect_volume_climax(rows):
    out = []
    n = len(rows)
    for k in range(20, n):
        vols = [rows[i]["v"] or 0 for i in range(k - 20, k)]
        avg = sum(vols) / 20 or 1
        if (rows[k]["v"] or 0) < avg * 2.5:
            continue
        ret = (rows[k]["c"] - rows[k - 1]["c"]) / rows[k - 1]["c"] if rows[k - 1]["c"] else 0
        if ret > 0.02:
            _append(out, "volume_climax_up", +1, k, rows[k]["c"])
        elif ret < -0.02:
            _append(out, "volume_climax_down", -1, k, rows[k]["c"])
    return out


def detect_nr_inside(rows):
    out = []
    n = len(rows)
    for k in range(5, n):
        rng = rows[k]["h"] - rows[k]["l"]
        prior = [rows[i]["h"] - rows[i]["l"] for i in range(k - 4, k)]
        if rng > 0 and all(rng < r for r in prior):
            ci_up = pl._confirm_break(rows, k, rows[k]["h"], +1, rows[k]["l"])
            if ci_up is not None:
                _append(out, "nr4_breakout_up", +1, ci_up, rows[k]["h"])
            ci_dn = pl._confirm_break(rows, k, rows[k]["l"], -1, rows[k]["h"])
            if ci_dn is not None:
                _append(out, "nr4_breakout_down", -1, ci_dn, rows[k]["l"])
        if k >= 2:
            prev, cur = rows[k - 1], rows[k]
            if cur["h"] <= prev["h"] and cur["l"] >= prev["l"]:
                ci_up = pl._confirm_break(rows, k, prev["h"], +1, cur["l"])
                if ci_up is not None:
                    _append(out, "inside_bar_breakout_up", +1, ci_up, prev["h"])
                ci_dn = pl._confirm_break(rows, k, prev["l"], -1, cur["h"])
                if ci_dn is not None:
                    _append(out, "inside_bar_breakout_down", -1, ci_dn, prev["l"])
    return out


def detect_harmonic_abcd(rows, z):
    out = []
    for i in range(len(z) - 3):
        a, b, c, d = z[i], z[i + 1], z[i + 2], z[i + 3]
        ab = abs(b["price"] - a["price"])
        bc = abs(c["price"] - b["price"])
        cd = abs(d["price"] - c["price"])
        if ab <= 0:
            continue
        bc_ratio = bc / ab
        cd_ratio = cd / ab
        if not (0.55 <= bc_ratio <= 0.72):
            continue
        if not (1.1 <= cd_ratio <= 1.8):
            continue
        if a["type"] == "L" and b["type"] == "H" and c["type"] == "L" and d["type"] == "H":
            ci = pl._confirm_break(rows, d["idx"], b["price"], +1, c["price"])
            if ci is not None:
                _append(out, "harmonic_abcd_bull", +1, ci, b["price"])
        if a["type"] == "H" and b["type"] == "L" and c["type"] == "H" and d["type"] == "L":
            ci = pl._confirm_break(rows, d["idx"], b["price"], -1, c["price"])
            if ci is not None:
                _append(out, "harmonic_abcd_bear", -1, ci, b["price"])
    return out


def _body(r):
    return abs(r["c"] - r["o"])


def _range(r):
    return max(1e-9, r["h"] - r["l"])


def detect_candle_patterns(rows):
    out = []
    n = len(rows)
    for k in range(2, n):
        a, b, c = rows[k - 2], rows[k - 1], rows[k]
        body_c = _body(c)
        body_b = _body(b)
        rng_c = _range(c)
        if c["c"] > c["o"] and b["c"] < b["o"] and c["c"] >= b["o"] and c["o"] <= b["c"] and body_c > body_b:
            _append(out, "bullish_engulfing", +1, k, c["c"])
        if c["c"] < c["o"] and b["c"] > b["o"] and c["o"] >= b["c"] and c["c"] <= b["o"] and body_c > body_b:
            _append(out, "bearish_engulfing", -1, k, c["c"])
        lower = min(c["c"], c["o"]) - c["l"]
        upper = c["h"] - max(c["c"], c["o"])
        if lower > body_c * 2 and upper < body_c and c["c"] < a["c"]:
            _append(out, "hammer", +1, k, c["c"])
        if upper > body_c * 2 and lower < body_c and c["c"] > a["c"]:
            _append(out, "shooting_star", -1, k, c["c"])
        if body_c < rng_c * 0.1:
            _append(out, "doji", 0, k, c["c"])
        if k >= 2:
            m1, m2, m3 = rows[k - 2], rows[k - 1], rows[k]
            if _body(m2) < _range(m2) * 0.25 and m1["c"] < m1["o"] and m3["c"] > m3["o"] and m3["c"] > (m1["o"] + m1["c"]) / 2:
                _append(out, "morning_star", +1, k, m3["c"])
            if _body(m2) < _range(m2) * 0.25 and m1["c"] > m1["o"] and m3["c"] < m3["o"] and m3["c"] < (m1["o"] + m1["c"]) / 2:
                _append(out, "evening_star", -1, k, m3["c"])
        if k >= 2:
            r1, r2, r3 = rows[k - 2], rows[k - 1], rows[k]
            if all(r["c"] > r["o"] for r in (r1, r2, r3)) and r2["c"] > r1["c"] and r3["c"] > r2["c"]:
                _append(out, "three_white_soldiers", +1, k, r3["c"])
            if all(r["c"] < r["o"] for r in (r1, r2, r3)) and r2["c"] < r1["c"] and r3["c"] < r2["c"]:
                _append(out, "three_black_crows", -1, k, r3["c"])
        if c["c"] > c["o"] and b["c"] < b["o"] and c["c"] > (b["o"] + b["c"]) / 2 and c["o"] < b["c"]:
            _append(out, "piercing_line", +1, k, c["c"])
        if c["c"] < c["o"] and b["c"] > b["o"] and c["c"] < (b["o"] + b["c"]) / 2 and c["o"] > b["c"]:
            _append(out, "dark_cloud_cover", -1, k, c["c"])
    return out


def detect_all_extended(rows, z, pivots):
    events = []
    events += detect_wedge(rows, z)
    events += detect_box(rows, z)
    events += detect_flag(rows, z, True)
    events += detect_flag(rows, z, False)
    events += detect_pennant(rows, z)
    events += detect_triple(rows, z)
    events += detect_broadening(rows, z)
    events += detect_diamond(rows, z)
    events += detect_complex_hns(rows, z)
    events += detect_rounding_bottom(rows)
    events += detect_cup_and_handle(rows, z)
    events += detect_channel_breakout(rows, z)
    events += detect_reversal_123(rows, z)
    events += detect_two_b(rows, z)
    events += detect_fake_breakout(rows)
    events += detect_gaps(rows)
    events += detect_gap_fill(rows)
    events += detect_volume_climax(rows)
    events += detect_nr_inside(rows)
    events += detect_harmonic_abcd(rows, z)
    events += detect_candle_patterns(rows)
    return events