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

레짐 조건부 통계(2026-07-23 추가): 각 이벤트 날짜를 벤치마크(us=SPY, kr=KODEX 200
069500) 종가 vs 200일 SMA 로 above200/below200 으로 분류해, 기존 키는 그대로 두고
다음을 추가한다(벤치마크 detail 이 없으면 조용히 생략):
  "regimes": {"above200": {"baseline": {...}, "patterns": {...동일 스키마...}},
              "below200": {...}},
  "currentRegime": "above200"|"below200"   # 빌드 시점 벤치마크 최신 종가 기준

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
from briefing_store import atomic_write_text  # 중단 시 잘린 JSON 방지

MARKET_PATHS = {
    "us": (ROOT / "data" / "details", ROOT / "data" / "pattern_stats.json"),
    "kr": (ROOT / "data" / "korea" / "details", ROOT / "data" / "korea" / "pattern_stats.json"),
}
# 레짐 분류 벤치마크: 그 날짜의 벤치마크 종가가 자기 200일 SMA 위인가 아래인가.
BENCHMARK_PATHS = {
    "us": ROOT / "data" / "details" / "SPY.json",
    "kr": ROOT / "data" / "korea" / "details" / "069500.json",  # KODEX 200
}
SMA_WIN = 200
REGIME_KEYS = ("above200", "below200")
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


def load_benchmark_regimes(market):
    """벤치마크 종가 vs 200일 SMA 로 날짜별 레짐 맵을 만든다.

    반환: (regime_by_date, current_regime). 벤치마크 detail 이 없거나 봉이 모자라면
    (None, None) — 호출부는 레짐 분리를 조용히 생략한다(기존 집계는 그대로).
    """
    fp = BENCHMARK_PATHS.get(market)
    if not fp or not fp.exists():
        return None, None
    try:
        d = json.loads(fp.read_text(encoding="utf-8"))
    except Exception:
        return None, None
    rows = pl.rows_from_chart_series(d.get("chartSeries") or [])
    if len(rows) < SMA_WIN + 5:
        return None, None
    regime_by_date = {}
    current = None
    running = 0.0
    for i, r in enumerate(rows):
        running += r["c"]
        if i >= SMA_WIN:
            running -= rows[i - SMA_WIN]["c"]
        if i >= SMA_WIN - 1 and r.get("d"):
            sma = running / SMA_WIN
            current = "above200" if r["c"] >= sma else "below200"
            regime_by_date[r["d"]] = current
    return regime_by_date, current


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
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--market", choices=("us", "kr"), default="us", help="대상 시장 (us|kr)")
    ap.add_argument("--limit", type=int, default=0, help="처리할 종목 수 제한(테스트용)")
    args = ap.parse_args()

    details_dir, out_json = MARKET_PATHS[args.market]
    files = sorted(details_dir.glob("*.json"))
    if args.limit:
        files = files[:args.limit]

    # 패턴별·기간별 전방 수익률 누적
    pat_rets = {p: {h: [] for h in pl.HORIZONS} for p in pl.PATTERN_LABELS}
    pat_dir = {}
    base_rets = {h: [] for h in pl.HORIZONS}

    # 레짐(벤치마크 200일선 상회/하회) 조건부 누적 — 벤치마크 detail 없으면 생략
    regime_by_date, current_regime = load_benchmark_regimes(args.market)
    reg_pat_rets = {reg: {p: {h: [] for h in pl.HORIZONS} for p in pl.PATTERN_LABELS}
                    for reg in REGIME_KEYS}
    reg_base_rets = {reg: {h: [] for h in pl.HORIZONS} for reg in REGIME_KEYS}

    scanned = 0
    skipped = 0
    event_total = 0
    for i, fp in enumerate(files):
        try:
            d = json.loads(fp.read_text(encoding="utf-8"))
        except Exception:
            skipped += 1
            continue
        # 합성 랜덤워크(historySource != yahoo)는 통계를 오염시킨다 —
        # build_sr_stats·build_breakout_retest 와 같은 필터.
        if d.get("historySource") not in ("yahoo", "yahoo-cache"):
            skipped += 1
            continue
        rows = pl.rows_from_chart_series(d.get("chartSeries") or [])
        if len(rows) < MIN_BARS:
            skipped += 1
            continue
        scanned += 1

        # 기준선: 일정 간격 봉의 전방 수익률
        for k in range(pl.PIVOT_WIN, len(rows), BASELINE_STRIDE):
            # 레짐: 그 봉 날짜의 벤치마크 상태(벤치마크에 없는 날짜면 분리 생략)
            reg = regime_by_date.get(rows[k].get("d")) if regime_by_date else None
            for h in pl.HORIZONS:
                r = fwd_return(rows, k, h)
                if r is not None:
                    base_rets[h].append(r)
                    if reg:
                        reg_base_rets[reg][h].append(r)

        # 패턴 확정 이벤트의 전방 수익률
        for ev in pl.detect_confirmations(rows):
            event_total += 1
            pat_dir[ev["pattern"]] = ev["dir"]
            reg = regime_by_date.get(rows[ev["confirm_idx"]].get("d")) if regime_by_date else None
            for h in pl.HORIZONS:
                r = fwd_return(rows, ev["confirm_idx"], h)
                if r is not None:
                    pat_rets[ev["pattern"]][h].append(r)
                    if reg:
                        reg_pat_rets[reg][ev["pattern"]][h].append(r)

        if (i + 1) % 500 == 0:
            print(f"  …{i + 1}/{len(files)} 처리 (scanned={scanned}, events={event_total})",
                  file=sys.stderr)

    def build_stats_block(base_dict, pat_dict):
        """(기준선, 패턴별) 수익률 풀 → 출력 스키마 블록. 전체/레짐별에 공용."""
        baseline = {}
        for h in pl.HORIZONS:
            s = summarize(base_dict[h])
            if s:
                baseline[str(h)] = s
        patterns = {}
        for p, label in pl.PATTERN_LABELS.items():
            entry = {"label": label, "dir": pat_dir.get(p, 0)}
            any_h = False
            for h in pl.HORIZONS:
                s = summarize(pat_dict[p][h])
                if s:
                    base_up = baseline.get(str(h), {}).get("up_rate")
                    if base_up is not None:
                        s["edge"] = round(s["up_rate"] - base_up, 1)
                    entry[str(h)] = s
                    any_h = True
            if any_h:
                patterns[p] = entry
        return baseline, patterns

    baseline, patterns = build_stats_block(base_rets, pat_rets)

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

    # 레짐 조건부 통계 — 기존 키는 그대로 두고(분석 페이지·카드가 소비) 추가만 한다.
    # 벤치마크 detail 이 없으면 레짐 키 자체를 넣지 않는다(소비자는 없으면 생략).
    if regime_by_date and current_regime:
        regimes = {}
        for reg in REGIME_KEYS:
            r_base, r_pats = build_stats_block(reg_base_rets[reg], reg_pat_rets[reg])
            regimes[reg] = {"baseline": r_base, "patterns": r_pats}
        out["regimes"] = regimes
        out["currentRegime"] = current_regime
        out["regimeBenchmark"] = BENCHMARK_PATHS[args.market].stem
    out_json.parent.mkdir(parents=True, exist_ok=True)
    atomic_write_text(out_json, json.dumps(out, ensure_ascii=False, indent=2))

    print(f"\n완료: {scanned}종목 스캔, {event_total}개 패턴 이벤트 → {out_json}")
    print(f"기준선(20일) 상승률: {baseline.get('20', {}).get('up_rate')}%")
    if out.get("currentRegime"):
        reg_base = out["regimes"][out["currentRegime"]]["baseline"].get("20", {})
        print(f"현재 레짐: {out['currentRegime']} (벤치마크 {out['regimeBenchmark']}) — "
              f"레짐 기준선(20일) 상승률: {reg_base.get('up_rate')}% (n={reg_base.get('n')})")
    else:
        print("레짐 분리 생략: 벤치마크 detail 없음/봉 부족")
    print("패턴별 20일 up_rate / edge:")
    for p, e in sorted(patterns.items(), key=lambda kv: -(kv[1].get('20', {}).get('n', 0))):
        h20 = e.get("20")
        if h20:
            print(f"  {p:24s} n={h20['n']:5d}  up={h20['up_rate']:5.1f}%  "
                  f"edge={h20.get('edge', 0):+5.1f}%p  avg={h20['avg_ret']:+.2f}%")


if __name__ == "__main__":
    main()
