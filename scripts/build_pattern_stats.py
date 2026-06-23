#!/usr/bin/env python3
"""차트 패턴 과거 성공률 집계 (build_pattern_stats.py)
=====================================================

data/details/*.json 전 종목을 오프라인으로 스캔해, 각 패턴이 **확정된 시점**부터의
전방 수익률(5/20/60거래일)을 수천 건 풀링한다. 한 종목의 5년 이력만으로는 H&S 같은
패턴 표본이 너무 적어 종목별 확률이 무의미하므로, 전 종목을 묶어 통계적으로 쓸 만한
base-rate 를 만든다.

산출물 data/pattern_stats.json:
{
  "generated": "...", "tickers_scanned": N, "horizons": [5,20,60],
  "baseline": { "5": {"n":..,"up_rate":..,"avg_ret":..}, ... },   # 무조건부 기준선
  "patterns": {
     "double_top": {
        "label": "...", "dir": -1,
        "5":  {"n":.., "up_rate":.., "avg_ret":.., "median_ret":.., "edge":..},
        "20": {...}, "60": {...}
     }, ...
  }
}
* up_rate: 확정 후 H봉 뒤 종가가 오른 비율(%).
* edge: up_rate - baseline.up_rate (그 기간 시장 평균 대비 초과 상승확률, %p).

실행:  py scripts/build_pattern_stats.py            (전체)
       py scripts/build_pattern_stats.py --limit 300   (빠른 표본 테스트)
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
OUT_JSON = ROOT / "data" / "pattern_stats.json"
MIN_BARS = 250            # 전방 수익률 측정 여유를 위해 최소 봉 수
BASELINE_STRIDE = 10      # 기준선 표본 추출 간격(모든 봉을 쓰면 과다)
KST = timezone(timedelta(hours=9))


def fwd_return(rows, idx, h):
    j = idx + h
    if j >= len(rows):
        return None
    c0 = rows[idx]["c"]
    if not c0:
        return None
    return (rows[j]["c"] - c0) / c0


def summarize(returns):
    if not returns:
        return None
    ups = sum(1 for r in returns if r > 0)
    return {
        "n": len(returns),
        "up_rate": round(100 * ups / len(returns), 1),
        "avg_ret": round(100 * statistics.fmean(returns), 2),
        "median_ret": round(100 * statistics.median(returns), 2),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="처리할 종목 수 제한(테스트용)")
    args = ap.parse_args()

    files = sorted(DETAILS_DIR.glob("*.json"))
    if args.limit:
        files = files[:args.limit]

    # 패턴별·기간별 전방 수익률 누적
    pat_rets = {p: {h: [] for h in pl.HORIZONS} for p in pl.PATTERN_LABELS}
    pat_dir = {}
    base_rets = {h: [] for h in pl.HORIZONS}

    scanned = 0
    skipped = 0
    event_total = 0
    for i, fp in enumerate(files):
        try:
            d = json.loads(fp.read_text(encoding="utf-8"))
        except Exception:
            skipped += 1
            continue
        rows = pl.rows_from_chart_series(d.get("chartSeries") or [])
        if len(rows) < MIN_BARS:
            skipped += 1
            continue
        scanned += 1

        # 기준선: 일정 간격 봉의 전방 수익률
        for k in range(pl.PIVOT_WIN, len(rows), BASELINE_STRIDE):
            for h in pl.HORIZONS:
                r = fwd_return(rows, k, h)
                if r is not None:
                    base_rets[h].append(r)

        # 패턴 확정 이벤트의 전방 수익률
        for ev in pl.detect_confirmations(rows):
            event_total += 1
            pat_dir[ev["pattern"]] = ev["dir"]
            for h in pl.HORIZONS:
                r = fwd_return(rows, ev["confirm_idx"], h)
                if r is not None:
                    pat_rets[ev["pattern"]][h].append(r)

        if (i + 1) % 500 == 0:
            print(f"  …{i + 1}/{len(files)} 처리 (scanned={scanned}, events={event_total})",
                  file=sys.stderr)

    baseline = {}
    for h in pl.HORIZONS:
        s = summarize(base_rets[h])
        if s:
            baseline[str(h)] = s

    patterns = {}
    for p, label in pl.PATTERN_LABELS.items():
        entry = {"label": label, "dir": pat_dir.get(p, 0)}
        any_h = False
        for h in pl.HORIZONS:
            s = summarize(pat_rets[p][h])
            if s:
                base_up = baseline.get(str(h), {}).get("up_rate")
                if base_up is not None:
                    s["edge"] = round(s["up_rate"] - base_up, 1)
                entry[str(h)] = s
                any_h = True
        if any_h:
            patterns[p] = entry

    out = {
        "generated": datetime.now(KST).strftime("%Y-%m-%d %H:%M KST"),
        "tickers_scanned": scanned,
        "tickers_skipped": skipped,
        "events_total": event_total,
        "horizons": list(pl.HORIZONS),
        "min_bars": MIN_BARS,
        "baseline": baseline,
        "patterns": patterns,
    }
    OUT_JSON.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n완료: {scanned}종목 스캔, {event_total}개 패턴 이벤트 → {OUT_JSON}")
    print(f"기준선(20일) 상승률: {baseline.get('20', {}).get('up_rate')}%")
    print("패턴별 20일 up_rate / edge:")
    for p, e in sorted(patterns.items(), key=lambda kv: -(kv[1].get('20', {}).get('n', 0))):
        h20 = e.get("20")
        if h20:
            print(f"  {p:24s} n={h20['n']:5d}  up={h20['up_rate']:5.1f}%  "
                  f"edge={h20.get('edge', 0):+5.1f}%p  avg={h20['avg_ret']:+.2f}%")


if __name__ == "__main__":
    main()
