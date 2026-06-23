#!/usr/bin/env python3
"""지지/저항 '존중률(respect rate)' 검증 (build_sr_stats.py)
============================================================

지지/저항선이 실제로 의미가 있는지 — 즉 그어 놓은 레벨에 가격이 다시 닿았을 때
정말로 '반등/반락(존중)'하는지 — 를 전 종목 과거 데이터로 측정한다. 룩어헤드 없이
각 시점 t 에서 **과거 데이터만으로** 레벨을 그린 뒤, 그 이후를 시뮬레이션한다.

비교 대상(같은 평가 함수로 사과 대 사과):
  - OLD     : 기존 방식(가장 가까운 스윙 피벗 1개씩, 거래량·강도 미반영)
  - NEW_top1: 신규 강도점수 방식에서 점수 1위 지지/저항 1개씩
  - NEW_all : 신규 방식이 실제로 차트에 그리는 상·하 최대 3개씩
  - RANDOM  : 현재가 ±무작위 거리의 가짜 레벨(우연 기준선)

'존중' 판정: 레벨 L 에 처음 닿은(테스트) 뒤 REACTW봉 안에서
  - 반응(레벨에서 REACT·ATR 만큼 되돌아감)이 돌파(종가가 BREAK·ATR 넘어섬)보다
    먼저 일어나면 → respected, 반대면 → broken. 둘 다 없으면 표본에서 제외.

respect_rate = respected / (respected + broken). RANDOM 대비 높을수록 '진짜' 레벨.

실행:  py scripts/build_sr_stats.py --limit 600       (표본)
       py scripts/build_sr_stats.py                    (전체)
산출:  data/sr_stats.json + 콘솔 비교표
"""

from __future__ import annotations

import argparse
import json
import random
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DETAILS_DIR = ROOT / "data" / "details"
OUT_JSON = ROOT / "data" / "sr_stats.json"
KST = timezone(timedelta(hours=9))

MIN_BARS = 300        # 평가 여유
START_T = 150         # 레벨 산출에 필요한 최소 과거
STEP = 20             # 평가 시점 간격(봉)
HOLD = 60             # 레벨이 테스트될 때까지 기다리는 최대 봉
REACTW = 20           # 테스트 후 반응/돌파를 보는 창
REACT = 1.0           # 반응 임계(ATR 배수) — CLI --react 로 덮어씀
BREAK = 0.5           # 돌파 임계(ATR 배수) — CLI --brk 로 덮어씀
MOM_LOOKBACK = 10     # 레벨로 접근하는 모멘텀을 보는 과거 봉 수
LOWMOM = 1.0          # 이 ATR배수 미만으로 접근하면 '저모멘텀' 테스트로 본다
RETEST_LOOKBACK = 15  # 돌파-되돌림: 최근 N봉 안에 레벨이 가로질러졌는지


# ----------------------------------------------------------------------------
# 지표/레벨 (analysis.js 포팅)
# ----------------------------------------------------------------------------
def atr_at(rows, t, period=14):
    s = 0.0
    cnt = 0
    for i in range(max(1, t - period + 1), t + 1):
        tr = max(rows[i]["h"] - rows[i]["l"],
                 abs(rows[i]["h"] - rows[i - 1]["c"]),
                 abs(rows[i]["l"] - rows[i - 1]["c"]))
        s += tr
        cnt += 1
    return (s / cnt) if cnt else rows[t]["c"] * 0.02


def window_atr(rows):
    n = len(rows)
    s = 0.0
    cnt = 0
    for i in range(max(1, n - 50), n):
        tr = max(rows[i]["h"] - rows[i]["l"],
                 abs(rows[i]["h"] - rows[i - 1]["c"]),
                 abs(rows[i]["l"] - rows[i - 1]["c"]))
        s += tr
        cnt += 1
    return (s / cnt) if cnt else rows[n - 1]["c"] * 0.02


def levels_new(rows, max_per_side=3):
    """신규 강도점수 방식(거래량 프로파일 + 반전 + ATR 존). analysis.js 와 동일 로직."""
    n = len(rows)
    if n < 12:
        return []
    price = rows[n - 1]["c"]
    atr = window_atr(rows)
    atr_pct = atr / price if price else 0.02
    win = max(3, min(8, n // 25))
    fwd = min(20, n // 4)
    cands = []
    for i in range(win, n - win):
        is_h = is_l = True
        for j in range(i - win, i + win + 1):
            if j == i:
                continue
            if rows[j]["h"] > rows[i]["h"]:
                is_h = False
            if rows[j]["l"] < rows[i]["l"]:
                is_l = False
        if is_h:
            drop = max([rows[i]["h"] - rows[j]["l"] for j in range(i + 1, min(n, i + fwd + 1))] or [0])
            cands.append({"price": rows[i]["h"], "t": 1, "r": drop / atr if atr else 0, "v": 0, "idx": i})
        if is_l:
            rise = max([rows[j]["h"] - rows[i]["l"] for j in range(i + 1, min(n, i + fwd + 1))] or [0])
            cands.append({"price": rows[i]["l"], "t": 1, "r": rise / atr if atr else 0, "v": 0, "idx": i})
    # volume profile nodes
    lo = min(r["l"] for r in rows)
    hi = max(r["h"] for r in rows)
    if hi > lo:
        bins = 60
        bw = (hi - lo) / bins
        vol = [0.0] * bins
        li = [0] * bins
        for i, r in enumerate(rows):
            a = min(bins - 1, max(0, int((r["l"] - lo) / bw)))
            b = min(bins - 1, max(a, int((r["h"] - lo) / bw)))
            share = (r["v"] or 0) / (b - a + 1)
            for k in range(a, b + 1):
                vol[k] += share
                li[k] = i
        for k in range(1, bins - 1):
            if vol[k] > 0 and vol[k] >= vol[k - 1] and vol[k] >= vol[k + 1]:
                cands.append({"price": lo + (k + 0.5) * bw, "t": 0, "r": 0, "v": vol[k], "idx": li[k]})
    if not cands:
        return []
    cands.sort(key=lambda c: c["price"])
    tol = max(0.6 * atr_pct, 0.004)
    cl = []
    for c in cands:
        last = cl[-1] if cl else None
        mean = last["sum"] / last["w"] if last else 0
        if last and mean and abs(c["price"] - mean) / mean <= tol:
            last["sum"] += c["price"]; last["w"] += 1
            last["t"] += c["t"]; last["r"] += c["r"]; last["v"] += c["v"]
            last["idx"] = max(last["idx"], c["idx"])
        else:
            cl.append({"sum": c["price"], "w": 1, "t": c["t"], "r": c["r"], "v": c["v"], "idx": c["idx"]})
    max_t = max([1] + [c["t"] for c in cl])
    max_r = max([1e-9] + [c["r"] for c in cl])
    max_v = max([1e-9] + [c["v"] for c in cl])
    levels = []
    for c in cl:
        p = c["sum"] / c["w"]
        rec = c["idx"] / (n - 1) if n > 1 else 0.5
        prox = 1 - min(1, abs(p - price) / (price * 0.25))
        score = 0.30 * c["v"] / max_v + 0.22 * c["t"] / max_t + 0.18 * c["r"] / max_r + 0.12 * rec + 0.18 * prox
        levels.append({"price": p, "score": score})
    sup = sorted([l for l in levels if l["price"] < price], key=lambda l: -l["score"])[:max_per_side]
    res = sorted([l for l in levels if l["price"] >= price], key=lambda l: -l["score"])[:max_per_side]
    return [{"price": l["price"], "type": "sup"} for l in sup] + [{"price": l["price"], "type": "res"} for l in res]


def levels_old(rows, lookback=120, win=5):
    """기존 방식: 가장 가까운 스윙 피벗 지지/저항 1개씩(findSupportResistance 포팅)."""
    n = len(rows)
    start = max(win, n - lookback)
    price = rows[n - 1]["c"]
    sup, res = [], []
    for i in range(start, n - win):
        is_h = is_l = True
        for j in range(i - win, i + win + 1):
            if j == i:
                continue
            if rows[j]["h"] >= rows[i]["h"]:
                is_h = False
            if rows[j]["l"] <= rows[i]["l"]:
                is_l = False
        if is_h:
            res.append(rows[i]["h"])
        if is_l:
            sup.append(rows[i]["l"])
    below = sorted([v for v in (sup + res) if v < price], reverse=True)
    above = sorted([v for v in (res + sup) if v > price])
    out = []
    if below:
        out.append({"price": below[0], "type": "sup"})
    if above:
        out.append({"price": above[0], "type": "res"})
    return out


def levels_random(price, rng):
    return [
        {"price": price * (1 - rng.uniform(0.02, 0.15)), "type": "sup"},
        {"price": price * (1 + rng.uniform(0.02, 0.15)), "type": "res"},
    ]


def retest_levels(rows, base_levels, atr):
    """돌파-되돌림: 최근 RETEST_LOOKBACK봉 안에서 종가가 레벨을 가로질러(돌파) 간
    레벨만 골라, 현재가 기준 역할이 뒤집힌 타입으로 돌려준다(지지↔저항 전환).
    """
    t = len(rows) - 1
    price = rows[t]["c"]
    buf = BREAK * atr
    seg = rows[max(0, t - RETEST_LOOKBACK):t + 1]
    hi = max(r["c"] for r in seg)
    lo = min(r["c"] for r in seg)
    out = []
    for lv in base_levels:
        L = lv["price"]
        if hi > L + buf and lo < L - buf:  # 최근 구간에서 양쪽 종가 → 가로질렀음
            out.append({"price": L, "type": "sup" if price > L else "res"})
    return out


# ----------------------------------------------------------------------------
# 존중/돌파 판정
# ----------------------------------------------------------------------------
def evaluate_level(rows, t, level, atr):
    """반환: (outcome, approach_mom). outcome=True(존중)/False(돌파)/None(표본 제외).
    approach_mom = 테스트 시점에 레벨로 다가온 모멘텀(ATR 배수, 양수=레벨 방향으로 강하게).
    """
    n = len(rows)
    L = level["price"]
    kind = level["type"]
    # 1) 미래에서 레벨에 처음 닿는 봉
    test = None
    for i in range(t + 1, min(n, t + 1 + HOLD)):
        if rows[i]["l"] <= L <= rows[i]["h"]:
            test = i
            break
    if test is None:
        return None, None  # 레벨에 닿지 않음 → 표본 제외
    # 접근 모멘텀(레벨 방향으로의 직전 MOM_LOOKBACK봉 이동)
    j = max(0, test - MOM_LOOKBACK)
    mom = ((rows[test]["c"] - rows[j]["c"]) if kind == "res" else (rows[j]["c"] - rows[test]["c"])) / atr
    # 2) 테스트 후 반응 vs 돌파 중 먼저 오는 것
    first_react = None
    first_break = None
    for i in range(test, min(n, test + REACTW + 1)):
        if kind == "res":
            if first_react is None and rows[i]["l"] <= L - REACT * atr:
                first_react = i
            if first_break is None and rows[i]["c"] >= L + BREAK * atr:
                first_break = i
        else:
            if first_react is None and rows[i]["h"] >= L + REACT * atr:
                first_react = i
            if first_break is None and rows[i]["c"] <= L - BREAK * atr:
                first_break = i
        if first_react is not None and first_break is not None:
            break
    if first_react is None and first_break is None:
        return None, mom
    if first_break is None:
        return True, mom
    if first_react is None:
        return False, mom
    return (first_react <= first_break), mom


# ----------------------------------------------------------------------------
def main():
    global REACT, BREAK, LOWMOM
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--react", type=float, default=REACT)
    ap.add_argument("--brk", type=float, default=BREAK)
    ap.add_argument("--lowmom", type=float, default=LOWMOM)
    args = ap.parse_args()
    rng = random.Random(args.seed)
    REACT, BREAK, LOWMOM = args.react, args.brk, args.lowmom

    files = sorted(DETAILS_DIR.glob("*.json"))
    if args.limit:
        files = files[:args.limit]

    methods = ["OLD", "NEW_top1", "NEW_all", "NEW_lowmom", "STRONG_lm", "RETEST", "RANDOM"]
    agg = {m: {"respected": 0, "broken": 0, "tested": 0, "drawn": 0} for m in methods}

    scanned = 0
    for fi, fp in enumerate(files):
        try:
            d = json.loads(fp.read_text(encoding="utf-8"))
        except Exception:
            continue
        cs = d.get("chartSeries") or []
        rows = [{"o": r[0], "h": r[1], "l": r[2], "c": r[3], "v": (r[4] or 0)} for r in cs
                if r and len(r) >= 4 and r[3] and r[3] > 0]
        n = len(rows)
        if n < MIN_BARS:
            continue
        scanned += 1
        for t in range(START_T, n - HOLD - REACTW, STEP):
            past = rows[:t + 1]
            atr = atr_at(rows, t)
            if atr <= 0:
                continue
            price = rows[t]["c"]
            new_all = levels_new(past, max_per_side=3)
            # NEW_top1 = 각 사이드 점수 1위(=new_all 정렬 첫 항목들)
            new_top1 = []
            sup = [l for l in new_all if l["type"] == "sup"]
            res = [l for l in new_all if l["type"] == "res"]
            if sup:
                new_top1.append(sup[0])
            if res:
                new_top1.append(res[0])
            sets = {
                "OLD": levels_old(past),
                "NEW_top1": new_top1,
                "NEW_all": new_all,
                "NEW_lowmom": new_all,                       # 동일 레벨, 저모멘텀 테스트만 카운트
                "STRONG_lm": new_top1,                        # 점수 1위 레벨 + 저모멘텀
                "RETEST": retest_levels(past, new_all, atr),  # 돌파 후 되돌림(역할 전환)
                "RANDOM": levels_random(price, rng),
            }
            for m, levels in sets.items():
                for lv in levels:
                    agg[m]["drawn"] += 1
                    outcome, mom = evaluate_level(rows, t, lv, atr)
                    if outcome is None:
                        continue
                    if m in ("NEW_lowmom", "STRONG_lm") and (mom is None or mom >= LOWMOM):
                        continue  # 강한 모멘텀으로 닿은 건 제외
                    agg[m]["tested"] += 1
                    if outcome:
                        agg[m]["respected"] += 1
                    else:
                        agg[m]["broken"] += 1
        if (fi + 1) % 200 == 0:
            print(f"  …{fi + 1}/{len(files)} (scanned={scanned})", file=sys.stderr)

    report = {}
    for m in methods:
        a = agg[m]
        dec = a["respected"] + a["broken"]
        report[m] = {
            "drawn": a["drawn"],
            "tested_decisive": dec,
            "reach_rate": round(100 * dec / a["drawn"], 1) if a["drawn"] else None,
            "respect_rate": round(100 * a["respected"] / dec, 1) if dec else None,
        }
    base = report["RANDOM"]["respect_rate"]
    for m in methods:
        rr = report[m]["respect_rate"]
        report[m]["edge_vs_random"] = round(rr - base, 1) if (rr is not None and base is not None) else None

    out = {
        "generated": datetime.now(KST).strftime("%Y-%m-%d %H:%M KST"),
        "tickers_scanned": scanned,
        "params": {"STEP": STEP, "HOLD": HOLD, "REACTW": REACTW, "REACT": REACT, "BREAK": BREAK},
        "methods": report,
    }
    OUT_JSON.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n완료: {scanned}종목 → {OUT_JSON}\n")
    print(f"{'method':10s} {'drawn':>8s} {'tested':>8s} {'reach%':>7s} {'respect%':>9s} {'vs랜덤':>7s}")
    for m in methods:
        r = report[m]
        print(f"{m:10s} {r['drawn']:>8d} {r['tested_decisive']:>8d} "
              f"{(r['reach_rate'] or 0):>7.1f} {(r['respect_rate'] or 0):>9.1f} "
              f"{(r['edge_vs_random'] if r['edge_vs_random'] is not None else 0):>+7.1f}")
    print("\n해석: respect%가 RANDOM보다 높을수록 '진짜' 지지/저항. "
          "NEW_top1 ≥ OLD 이면 강도점수 선택이 더 나은 레벨을 고른다는 뜻.")


if __name__ == "__main__":
    main()
