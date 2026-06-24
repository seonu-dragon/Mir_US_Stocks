#!/usr/bin/env python3
"""돌파 연속성 / 되돌림 진입 엣지 검증 (build_breakout_retest.py)
================================================================

지지/저항 '반등'은 엣지가 없었다(build_sr_stats.py). 여기서는 방향을 바꿔
**돌파(breakout)의 연속성**을 본다. 가설: 레벨을 돌파한 뒤 추세가 이어진다면,
①돌파 직후 진입과 ②되돌림(레벨 재접촉) 후 진입 중 어느 쪽이 더 나은가?

pattern_lib 의 검증된 돌파 감지(resistance_breakout=+1, support_breakdown=-1)를
재사용한다. 각 돌파 확정봉 b, 넥라인 L, 방향 d 에 대해:
  - 돌파 진입: b 에서 H봉 뒤 전방수익률(방향 d 기준).
  - 되돌림 진입: b 이후 RW봉 안에서 가격이 L 을 재접촉한 첫 봉 r 에서 H봉 뒤 수익률.
연속률 = (방향 d 로 움직인 비율). 시장 평균(무조건부)과 비교해 엣지를 잰다.

상승 돌파는 '상승 지속률', 하락 돌파는 '하락 지속률'로 나눠 보고한다(시장 드리프트가
방향마다 다르게 작용하므로 정직하게 분리).

실행:  py scripts/build_breakout_retest.py --limit 1500
산출:  data/breakout_retest_stats.json + 콘솔 비교표
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import pattern_lib as pl  # noqa: E402

DETAILS_DIR = ROOT / "data" / "details"
OUT_JSON = ROOT / "data" / "breakout_retest_stats.json"
KST = timezone(timedelta(hours=9))

HORIZONS = (1, 3, 5, 10, 20, 60)
RETEST_WIN = 15          # 돌파 후 되돌림(레벨 재접촉)을 기다리는 최대 봉
MIN_BARS = 300
BASE_STRIDE = 10
BREAKOUT_PATTERNS = {"resistance_breakout": +1, "support_breakdown": -1}


def fwd(closes, i, h):
    j = i + h
    if j >= len(closes):
        return None
    c0 = closes[i]
    return (closes[j] - c0) / c0 if c0 else None


def summarize_dir(rets, direction):
    """방향 d 기준 연속률(%)·평균 방향수익률(%)."""
    if not rets:
        return None
    cont = sum(1 for r in rets if (r > 0) == (direction > 0))
    dir_rets = [r * direction for r in rets]
    return {
        "n": len(rets),
        "cont_rate": round(100 * cont / len(rets), 1),
        "avg_dir_ret": round(100 * statistics.fmean(dir_rets), 2),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()
    files = sorted(DETAILS_DIR.glob("*.json"))
    if args.limit:
        files = files[:args.limit]

    # rets[direction][entry][H] = list of forward returns
    rets = {d: {"breakout": {h: [] for h in HORIZONS}, "retest": {h: [] for h in HORIZONS}}
            for d in (+1, -1)}
    base = {h: [] for h in HORIZONS}     # 무조건부 전방수익률(시장 기준선)
    retest_occurred = {+1: 0, -1: 0}
    breakout_total = {+1: 0, -1: 0}

    scanned = 0
    for fi, fp in enumerate(files):
        try:
            d = json.loads(fp.read_text(encoding="utf-8"))
        except Exception:
            continue
        rows = pl.rows_from_chart_series(d.get("chartSeries") or [])
        n = len(rows)
        if n < MIN_BARS:
            continue
        scanned += 1
        closes = [r["c"] for r in rows]

        for k in range(pl.PIVOT_WIN, n, BASE_STRIDE):
            for h in HORIZONS:
                r = fwd(closes, k, h)
                if r is not None:
                    base[h].append(r)

        for ev in pl.detect_confirmations(rows):
            direction = BREAKOUT_PATTERNS.get(ev["pattern"])
            if direction is None:
                continue
            b = ev["confirm_idx"]
            L = ev["neckline"]
            breakout_total[direction] += 1
            for h in HORIZONS:
                r = fwd(closes, b, h)
                if r is not None:
                    rets[direction]["breakout"][h].append(r)
            # 되돌림: b 이후 RETEST_WIN봉 안에서 L 재접촉
            r_idx = None
            for i in range(b + 1, min(n, b + 1 + RETEST_WIN)):
                if rows[i]["l"] <= L <= rows[i]["h"]:
                    r_idx = i
                    break
            if r_idx is not None:
                retest_occurred[direction] += 1
                for h in HORIZONS:
                    r = fwd(closes, r_idx, h)
                    if r is not None:
                        rets[direction]["retest"][h].append(r)

        if (fi + 1) % 300 == 0:
            print(f"  …{fi + 1}/{len(files)} (scanned={scanned})", file=sys.stderr)

    baseline = {}
    for h in HORIZONS:
        b = base[h]
        if b:
            up = sum(1 for r in b if r > 0)
            baseline[str(h)] = {
                "n": len(b),
                "up_rate": round(100 * up / len(b), 1),
                "down_rate": round(100 * (len(b) - up) / len(b), 1),
                "avg_ret": round(100 * statistics.fmean(b), 2),
            }

    out_dir = {}
    for direction, dname in ((+1, "up_break"), (-1, "down_break")):
        entry_out = {}
        for entry in ("breakout", "retest"):
            per_h = {}
            for h in HORIZONS:
                s = summarize_dir(rets[direction][entry][h], direction)
                if s:
                    # 시장 기준선(방향 일치) 대비 엣지
                    bh = baseline.get(str(h))
                    if bh:
                        base_cont = bh["up_rate"] if direction > 0 else bh["down_rate"]
                        s["edge_vs_market"] = round(s["cont_rate"] - base_cont, 1)
                    per_h[str(h)] = s
            entry_out[entry] = per_h
        occ = (100 * retest_occurred[direction] / breakout_total[direction]) if breakout_total[direction] else 0
        out_dir[dname] = {
            "breakouts": breakout_total[direction],
            "retest_rate": round(occ, 1),
            "entries": entry_out,
        }

    out = {
        "generated": datetime.now(KST).strftime("%Y-%m-%d %H:%M KST"),
        "tickers_scanned": scanned,
        "horizons": list(HORIZONS),
        "retest_win": RETEST_WIN,
        "baseline": baseline,
        "directions": out_dir,
    }
    OUT_JSON.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n완료: {scanned}종목 → {OUT_JSON}\n")
    for dname, dd in out_dir.items():
        print(f"[{dname}] 돌파 {dd['breakouts']}건 · 되돌림 발생 {dd['retest_rate']}%")
        print(f"   {'진입':10s}{'H':>4s}{'n':>8s}{'연속률%':>9s}{'평균방향%':>10s}{'시장대비':>9s}")
        for entry in ("breakout", "retest"):
            for h in HORIZONS:
                s = dd["entries"][entry].get(str(h))
                if s:
                    print(f"   {entry:10s}{h:>4d}{s['n']:>8d}{s['cont_rate']:>9.1f}"
                          f"{s['avg_dir_ret']:>10.2f}{s.get('edge_vs_market', 0):>+9.1f}")
        print()
    print("해석: 연속률이 시장 기준선보다 높을수록(+) 엣지. retest > breakout 이면 "
          "되돌림 기다린 진입이 더 낫다는 뜻.")


if __name__ == "__main__":
    main()
