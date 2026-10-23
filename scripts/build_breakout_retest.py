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
       py scripts/build_breakout_retest.py --market kr
산출:  data/breakout_retest_stats.json (kr: data/korea/breakout_retest_stats.json) + 콘솔 비교표

KR(2026-10-23): 네이버 수정주가 일봉(barsSource=naver)만 쓴다. 국내 일봉에는 US 에 없는
함정이 있어 측정 전에 정리한다(kr_segments · limit_locked).
  - 거래정지·무거래일(거래량 0 봉, 대부분 OHLC 가 전일 종가로 평평)은 봉에서 뺀다. 5봉 이상
    이어진 정지는 그 자리에서 시계열을 끊는다(재개 뒤 갭을 '돌파'·'전방수익률'로 세지 않게).
  - 연속 두 봉 종가가 ±30.5% 넘게 다르면(가격제한폭 ±30% 밖 = 감자·병합 기준가 재설정 등
    수정주가가 소급하지 않는 불연속) 거기서도 끊는다.
  - 진입 봉 등락이 ±29.5% 이상(상·하한가 잠김)이면 그 종가로는 체결이 안 되므로 진입에서 뺀다.
  - ETF 는 네이버가 분배금을 이미 소급 반영한 가격이라 배당을 더하지 않는다(이중 계산 방지).
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

if sys.platform == "win32":
    # cp949 콘솔에서 한글·U+2014 출력이 UnicodeEncodeError 로 죽어 빌드 실패로 둔갑한다.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import pattern_lib as pl  # noqa: E402
from briefing_store import atomic_write_text  # 중단 시 잘린 JSON 방지

DETAILS_DIR = ROOT / "data" / "details"
OUT_JSON = ROOT / "data" / "breakout_retest_stats.json"
MARKET_PATHS = {
    "us": (DETAILS_DIR, OUT_JSON),
    "kr": (ROOT / "data" / "korea" / "details", ROOT / "data" / "korea" / "breakout_retest_stats.json"),
}
KR_SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"
KST = timezone(timedelta(hours=9))

HORIZONS = (1, 3, 5, 10, 20, 60)
RETEST_WIN = 15          # 돌파 후 되돌림(레벨 재접촉)을 기다리는 최대 봉
MIN_BARS = 300
BASE_STRIDE = 10
BREAKOUT_PATTERNS = {"resistance_breakout": +1, "support_breakdown": -1}

# KR 전용 정리 기준(위 docstring).
KR_HALT_BREAK = 5        # 거래량 0 봉이 이만큼 이어지면 시계열을 끊는다
KR_GAP_BREAK = 0.305     # 연속 종가 변화가 이보다 크면(가격제한폭 ±30% 밖) 끊는다
KR_LIMIT_LOCK = 0.295    # 진입 봉 등락이 이 이상이면 상·하한가 잠김 → 진입 제외


def fwd(closes, i, h, div_cum=None):
    """전방 수익률 — div_cum(누적 배당)이 있으면 배당 포함 총수익 기준.
    div_cum=None(배당 미수집 detail)이면 기존 가격 수익률과 동일하다."""
    j = i + h
    if j >= len(closes):
        return None
    c0 = closes[i]
    if not c0:
        return None
    cj = closes[j]
    if div_cum is not None:
        cj += div_cum[j] - div_cum[i]
    return (cj - c0) / c0


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


def detect_breakouts(rows):
    """pattern_lib.detect_confirmations 의 돌파 2종만 — 같은 감지기·같은 중복 제거.

    detect_confirmations 는 패턴 20여 종을 다 돌려 종목당 ~45ms 인데 여기서 쓰는 건
    _detect_sr_breakout 결과뿐이다(KR 3,800종목 기준 3분 → 30초)."""
    if len(rows) < pl.PIVOT_WIN * 2 + 5:
        return []
    seen = set()
    out = []
    for e in sorted(pl._detect_sr_breakout(rows, pl.find_pivots(rows)), key=lambda x: x["confirm_idx"]):
        key = (e["pattern"], e["confirm_idx"])
        if key in seen:
            continue
        seen.add(key)
        out.append(e)
    return out


def kr_segments(rows, stats=None):
    """국내 일봉 → 측정 가능한 연속 구간 리스트.

    거래량 0 봉(거래정지·무거래)은 빼고, KR_HALT_BREAK 봉 이상 이어진 정지 또는 가격제한폭 밖의
    종가 불연속(KR_GAP_BREAK)에서 끊는다. stats(dict)가 오면 halt_bars/halt_breaks/gap_breaks 를 센다."""
    segs = []
    cur = []
    zero_run = 0
    for r in rows:
        if not r.get("v"):
            zero_run += 1
            if stats is not None:
                stats["halt_bars"] = stats.get("halt_bars", 0) + 1
            continue
        if cur:
            if zero_run >= KR_HALT_BREAK:
                segs.append(cur)
                cur = []
                if stats is not None:
                    stats["halt_breaks"] = stats.get("halt_breaks", 0) + 1
            elif abs(r["c"] / cur[-1]["c"] - 1) > KR_GAP_BREAK:
                segs.append(cur)
                cur = []
                if stats is not None:
                    stats["gap_breaks"] = stats.get("gap_breaks", 0) + 1
        zero_run = 0
        cur.append(r)
    if cur:
        segs.append(cur)
    return segs


def limit_locked(rows, i):
    """i 봉 종가가 전봉 대비 ±KR_LIMIT_LOCK 이상 — 상·하한가에 잠겨 그 종가로 체결이 안 된다."""
    if i <= 0:
        return False
    p = rows[i - 1]["c"]
    return bool(p) and abs(rows[i]["c"] / p - 1) >= KR_LIMIT_LOCK


def load_kr_etf_codes():
    """국내 스냅샷에서 ETF(market == 'etf') 코드 집합. 스냅샷이 없으면 빈 집합(이름으로 폴백)."""
    try:
        snap = json.loads(KR_SNAPSHOT.read_text(encoding="utf-8"))
    except Exception:
        return set()
    return {str(s.get("ticker")) for s in (snap.get("stocks") or []) if s.get("market") == "etf"}


def is_kr_etf(detail, etf_codes):
    code = str(detail.get("ticker") or "")
    if code in etf_codes:
        return True
    try:
        from update_korea_data import is_etf_like_name
    except Exception:
        return False
    return is_etf_like_name(detail.get("company") or "")


def scan_segment(rows, div_cum, market, acc):
    """한 연속 구간에서 기준선·돌파·되돌림 전방수익률을 acc 에 누적한다."""
    n = len(rows)
    closes = [r["c"] for r in rows]
    base, rets, kr_stats = acc["base"], acc["rets"], acc["kr"]
    for k in range(pl.PIVOT_WIN, n, BASE_STRIDE):
        for h in HORIZONS:
            r = fwd(closes, k, h, div_cum)
            if r is not None:
                base[h].append(r)

    for ev in detect_breakouts(rows):
        direction = BREAKOUT_PATTERNS.get(ev["pattern"])
        if direction is None:
            continue
        b = ev["confirm_idx"]
        L = ev["neckline"]
        acc["breakout_total"][direction] += 1
        if market == "kr" and limit_locked(rows, b):
            kr_stats["limit_locked_skipped"] += 1
        else:
            for h in HORIZONS:
                r = fwd(closes, b, h, div_cum)
                if r is not None:
                    rets[direction]["breakout"][h].append(r)
        # 되돌림: b 이후 RETEST_WIN봉 안에서 L 재접촉
        r_idx = None
        for i in range(b + 1, min(n, b + 1 + RETEST_WIN)):
            if rows[i]["l"] <= L <= rows[i]["h"]:
                r_idx = i
                break
        if r_idx is not None:
            acc["retest_occurred"][direction] += 1
            if market == "kr" and limit_locked(rows, r_idx):
                kr_stats["limit_locked_skipped"] += 1
                continue
            for h in HORIZONS:
                r = fwd(closes, r_idx, h, div_cum)
                if r is not None:
                    rets[direction]["retest"][h].append(r)


def new_accumulator():
    return {
        # rets[direction][entry][H] = list of forward returns
        "rets": {d: {"breakout": {h: [] for h in HORIZONS}, "retest": {h: [] for h in HORIZONS}}
                 for d in (+1, -1)},
        "base": {h: [] for h in HORIZONS},     # 무조건부 전방수익률(시장 기준선)
        "retest_occurred": {+1: 0, -1: 0},
        "breakout_total": {+1: 0, -1: 0},
        "kr": {"halt_bars": 0, "halt_breaks": 0, "gap_breaks": 0, "limit_locked_skipped": 0,
               "etf_no_dividend": 0, "non_naver_skipped": 0},
        "us": {"breaks": 0},   # US: pattern_lib.split_at_discontinuities 로 끊은 횟수
        "scanned": 0,
    }


def scan_detail(d, market, acc, etf_codes=frozenset()):
    """detail 하나를 acc 에 반영. 측정에 쓰였으면 True."""
    # 합성 이력(update_data.py 의 synthetic_history)은 랜덤워크라 돌파 연속성
    # 측정을 희석시킨다. 지금은 260봉이라 MIN_BARS(300) 에 우연히 걸러지지만
    # 봉수가 바뀌면 조용히 섞이므로 출처로 명시해 막는다.
    if d.get("historySource") not in ("yahoo", "yahoo-cache"):
        return False
    # KR 은 네이버 수정주가 봉만 — 야후 폴백 봉은 권리락·분배금 소급이 달라 섞지 않는다.
    if market == "kr" and d.get("barsSource") != "naver":
        acc["kr"]["non_naver_skipped"] += 1
        return False
    rows_all = pl.rows_from_chart_series(d.get("chartSeries") or [])
    etf = False
    if market == "kr":
        segments = kr_segments(rows_all, acc["kr"])
        etf = is_kr_etf(d, etf_codes)
    else:
        # 한 봉 4배 밖 종가 불연속(수정 안 된 역분할·호가 오류, 예 PPCB 0.01 → 625)에서 끊는다 —
        # 그 봉을 가로지르는 전방 창이 기준선·돌파 평균을 통째로 끌고 간다(pattern_lib 주석).
        # KR 은 위 kr_segments 의 ±30.5% 끊기가 이미 이 규칙을 포함한다.
        segments = pl.split_at_discontinuities(rows_all, stats=acc["us"])
    used = False
    for rows in segments:
        if len(rows) < MIN_BARS:
            continue
        used = True
        # 배당 포함 총수익용 누적 배당(없으면 None → 기존 가격 수익률 그대로).
        # KR ETF 는 네이버 봉이 분배금을 이미 소급했으므로 더하지 않는다.
        div_cum = None if etf else pl.dividend_cum_from_detail(rows, d.get("dividends"))
        scan_segment(rows, div_cum, market, acc)
    if used:
        acc["scanned"] += 1
        if etf:
            acc["kr"]["etf_no_dividend"] += 1
    return used


def build_output(acc, market):
    base, rets = acc["base"], acc["rets"]
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
        total = acc["breakout_total"][direction]
        occ = (100 * acc["retest_occurred"][direction] / total) if total else 0
        out_dir[dname] = {
            "breakouts": total,
            "retest_rate": round(occ, 1),
            "entries": entry_out,
        }

    out = {
        "generated": datetime.now(KST).strftime("%Y-%m-%d %H:%M KST"),
        "market": market,
        "tickers_scanned": acc["scanned"],
        "horizons": list(HORIZONS),
        "retest_win": RETEST_WIN,
        "baseline": baseline,
        "directions": out_dir,
    }
    if market == "kr":
        out["bars_source"] = "naver"
        out["kr_cleaning"] = dict(acc["kr"], halt_break_bars=KR_HALT_BREAK,
                                  gap_break_pct=round(KR_GAP_BREAK * 100, 1),
                                  limit_lock_pct=round(KR_LIMIT_LOCK * 100, 1))
    else:
        out["discontinuity_cleaning"] = {"max_bar_ratio": pl.MAX_BAR_RATIO, "breaks": acc["us"]["breaks"]}
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--market", choices=("us", "kr"), default="us", help="대상 시장 (us|kr)")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--push", action="store_true", default=False)
    args = ap.parse_args()
    market = args.market
    details_dir, out_json = MARKET_PATHS[market]
    files = sorted(details_dir.glob("*.json"))
    if args.limit:
        files = files[:args.limit]
    etf_codes = load_kr_etf_codes() if market == "kr" else frozenset()

    acc = new_accumulator()
    for fi, fp in enumerate(files):
        try:
            d = json.loads(fp.read_text(encoding="utf-8"))
        except Exception:
            continue
        scan_detail(d, market, acc, etf_codes)
        if (fi + 1) % 300 == 0:
            print(f"  …{fi + 1}/{len(files)} (scanned={acc['scanned']})", file=sys.stderr)

    if not acc["scanned"]:
        # 일봉이 통째로 비었을 때 빈 통계로 기존 파일을 덮지 않는다(신선도 게이트가 나이로 잡는다).
        print(f"[{market}] 측정 가능한 종목 0 — {out_json.name} 을 덮지 않는다", file=sys.stderr)
        return 1
    out = build_output(acc, market)
    atomic_write_text(out_json, json.dumps(out, ensure_ascii=False, indent=2))

    print(f"\n완료: [{market}] {acc['scanned']}종목 → {out_json}\n")
    if market == "kr":
        print(f"  KR 정리: {out['kr_cleaning']}\n")
    for dname, dd in out["directions"].items():
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

    if args.push:
        import sec_client as sec
        from briefing_store import repository_publish_lock

        rel = out_json.relative_to(ROOT).as_posix()
        with repository_publish_lock(ROOT):
            if not sec.git_publish([rel], f"breakout/retest stats ({market})"):
                return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main() or 0)
