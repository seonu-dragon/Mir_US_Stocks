#!/usr/bin/env python3
"""공시 유형별 주가 반응 통계 — 무작위 대조군과 함께 검증한다.

이 레포엔 이미 교훈이 있다. README 의 지지/저항 검증 결론:

    어떤 방식도 무작위(RANDOM 61.8%)를 못 이깁니다. 즉 수평 S/R선은 시각 보조일 뿐
    예측 지표가 아니며, 확률 엔진의 신호로는 쓰지 않습니다.

공시 반응도 같은 결말일 수 있다. "주주총회 공시 후 평균 +0.3%" 는 노이즈다. 그래서
유형별 반응과 함께 '같은 종목의 무작위 날짜' 대조군을 돌리고, 무작위를 못 이기는
유형은 통계에 남기되 edge=false 로 표시한다 — 화면이 그걸 신호처럼 팔지 않도록.

## 방법
- 초과수익(alpha) 로 잰다. 코스피가 3% 오른 날 종목이 2% 오른 걸 호재로 읽으면 안 된다.
  프록시: KODEX 200(069500) / KODEX 코스닥150(229200) — 둘 다 1,200봉으로 5년 창과 겹친다.
- 접수 시각을 알 수 없다(list.json 은 날짜만 준다). 장 마감 후 공시면 반응이 다음
  거래일에 나므로 D0 와 D+1 을 따로 잰다. 어느 쪽이 큰지가 곧 '언제 공시했나' 의 힌트다.
- 룩어헤드 없음: 각 이벤트에서 미래 데이터를 쓰지 않는다(D0 기준 ±N 만 참조).

Requires: backfill_kr_disclosures.py (공시), archive_kr_history.py / details (일봉).
"""

from __future__ import annotations

import argparse
import json
import random
import statistics
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402

KST = ZoneInfo("Asia/Seoul")
ARCHIVE = ROOT / "data" / "korea" / "_archive"
HIST_DIR = ARCHIVE / "history"
DETAILS = ROOT / "data" / "korea" / "details"
KR_SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"
OUT_JSON = ROOT / "data" / "korea" / "disclosure_stats.json"
OUT_JS = ROOT / "data" / "korea" / "disclosure_stats.js"

KOSPI_PROXY = "069500"      # KODEX 200
KOSDAQ_PROXY = "229200"     # KODEX 코스닥150
MIN_SAMPLE = 30             # 이보다 적은 유형은 통계로 내보내지 않는다
RANDOM_PER_EVENT = 3        # 이벤트당 무작위 대조 표본


def now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def load_series(ticker: str) -> list | None:
    """일봉. details 우선, 없으면 아카이브. [o,h,l,c,v,date] 형식."""
    f = DETAILS / f"{ticker}.json"
    if f.exists():
        try:
            cs = json.loads(f.read_text(encoding="utf-8")).get("chartSeries") or []
            if len(cs) >= 60:
                return cs
        except Exception:
            pass
    f = HIST_DIR / f"{ticker}.json"
    if f.exists():
        try:
            rows = json.loads(f.read_text(encoding="utf-8")).get("rows") or []
            if len(rows) >= 60:
                return rows
        except Exception:
            pass
    return None


def close_map(series: list) -> tuple[list[str], list[float]]:
    """(날짜들, 종가들). 날짜 오름차순 가정."""
    dates, closes = [], []
    for r in series:
        try:
            dates.append(str(r[5]))
            closes.append(float(r[3]))
        except Exception:
            continue
    return dates, closes


def pct(a: float, b: float):
    if not b:
        return None
    return (a - b) / b * 100


def reaction(closes: list[float], i: int, mkt: list[float], mi: int) -> dict | None:
    """i 일 기준 반응(초과수익). 앞뒤 여유가 없으면 None."""
    if i < 5 or i + 5 >= len(closes) or mi < 5 or mi + 5 >= len(mkt):
        return None
    out = {}
    # D0: 전일 종가 → 당일 종가
    d0 = pct(closes[i], closes[i - 1])
    m0 = pct(mkt[mi], mkt[mi - 1])
    # D+1: 당일 → 익일 (장 마감 후 공시면 여기서 반응이 난다)
    d1 = pct(closes[i + 1], closes[i])
    m1 = pct(mkt[mi + 1], mkt[mi])
    # D0 → +5D
    d5 = pct(closes[i + 5], closes[i])
    m5 = pct(mkt[mi + 5], mkt[mi])
    # -5D → D0 (선반영 여부)
    dp = pct(closes[i], closes[i - 5])
    mp = pct(mkt[mi], mkt[mi - 5])
    for k, (a, b) in (("d0", (d0, m0)), ("d1", (d1, m1)), ("d5", (d5, m5)), ("pre5", (dp, mp))):
        if a is None or b is None:
            return None
        out[k] = a - b          # 초과수익
    return out


def summarize(vals: list[float]) -> dict:
    vals = [v for v in vals if v is not None]
    if not vals:
        return {}
    vals_sorted = sorted(vals)
    return {
        "n": len(vals),
        "mean": round(statistics.fmean(vals), 3),
        "median": round(statistics.median(vals_sorted), 3),
        "negRate": round(sum(1 for v in vals if v < 0) / len(vals) * 100, 1),
    }


def welch_t(a: list[float], b: list[float]) -> float | None:
    """Welch t 통계량. 두 평균 차이가 분산 대비 얼마나 큰가.

    비율 휴리스틱('무작위보다 2배 크면 신호')로 재면 안 된다 — 변동성이 큰 소형주는
    무작위 표본도 평균이 쉽게 흔들려서, 그 기준으로는 유형 38개 중 22개가 통과했다.
    미분류 잡동사니('공시')까지 신호로 잡히면 그건 기준이 틀린 것이다.
    """
    if len(a) < 10 or len(b) < 10:
        return None
    va, vb = statistics.variance(a), statistics.variance(b)
    se = (va / len(a) + vb / len(b)) ** 0.5
    if se == 0:
        return None
    return (statistics.fmean(a) - statistics.fmean(b)) / se


def build(limit_types: int | None):
    snap = json.loads(KR_SNAPSHOT.read_text(encoding="utf-8"))
    market_of = {}
    for s in snap.get("stocks") or []:
        market_of[s["ticker"]] = s.get("market")

    proxies = {}
    for key, t in (("kospi", KOSPI_PROXY), ("kosdaq", KOSDAQ_PROXY)):
        ser = load_series(t)
        if not ser:
            raise SystemExit(f"[통계] 시장 프록시 {t} 일봉이 없다 — 초과수익을 계산할 수 없다.")
        d, c = close_map(ser)
        proxies[key] = (d, c, {dt: i for i, dt in enumerate(d)})

    files = sorted(ARCHIVE.glob("disclosures_*.json"))
    if not files:
        raise SystemExit("[통계] 백필 결과가 없다 — backfill_kr_disclosures.py 를 먼저 돌려야 한다.")
    events = []
    for f in files:
        for r in json.loads(f.read_text(encoding="utf-8")).get("rows") or []:
            events.append(r)
    print(f"[통계] 공시 {len(events):,}건 · 종목 {len({e['t'] for e in events})}")

    by_type: dict[str, list[dict]] = {}
    rnd_by_type: dict[str, list[dict]] = {}
    cache: dict[str, tuple] = {}
    rng = random.Random(20260717)
    skipped_no_price = 0

    for e in events:
        t = e["t"]
        if t not in cache:
            ser = load_series(t)
            if ser:
                d, c = close_map(ser)
                cache[t] = (d, c, {dt: i for i, dt in enumerate(d)})
            else:
                cache[t] = None
        entry = cache[t]
        if not entry:
            skipped_no_price += 1
            continue
        dates, closes, idx = entry
        i = idx.get(e["d"])
        if i is None:
            # 공시일이 휴장일이면 다음 거래일로. 5영업일 안에서만 찾는다.
            cand = [j for j, dt in enumerate(dates) if dt > e["d"]]
            if not cand:
                continue
            i = cand[0]
            if (datetime.fromisoformat(dates[i]) - datetime.fromisoformat(e["d"])).days > 5:
                continue
        mkey = "kosdaq" if market_of.get(t) == "kosdaq" else "kospi"
        mdates, mcloses, midx = proxies[mkey]
        mi = midx.get(dates[i])
        if mi is None:
            continue
        r = reaction(closes, i, mcloses, mi)
        if not r:
            continue
        by_type.setdefault(e["y"], []).append(r)

        # 무작위 대조군: 같은 종목, 다른 날. 공시 효과가 아니라 그 종목의 평소 변동성이
        # 만들어내는 값을 재기 위한 기준선이다.
        for _ in range(RANDOM_PER_EVENT):
            j = rng.randrange(5, len(closes) - 5)
            mj = midx.get(dates[j])
            if mj is None:
                continue
            rr = reaction(closes, j, mcloses, mj)
            if rr:
                rnd_by_type.setdefault(e["y"], []).append(rr)

    print(f"[통계] 반응 계산됨 {sum(len(v) for v in by_type.values()):,}건 · "
          f"일봉 없어 제외 {skipped_no_price:,}건")

    stats = {}
    for typ, rows in by_type.items():
        if len(rows) < MIN_SAMPLE:
            continue
        rnd = rnd_by_type.get(typ) or []
        rec = {"sample": len(rows)}
        for k in ("pre5", "d0", "d1", "d5"):
            rec[k] = summarize([r[k] for r in rows])
            if rnd:
                rec[k]["random"] = summarize([r[k] for r in rnd])
        # 무작위 대조군과 '통계적으로' 다른가. D0 와 D+1 중 하나라도 |t| >= 3 이고
        # 실제 크기가 0.5%p 이상이어야 신호로 본다. t 만 보면 표본이 큰 유형이 미세한
        # 차이로 통과하고, 크기만 보면 변동성 큰 소형주가 통과한다 — 둘 다 요구한다.
        rec["t"] = {}
        edge = False
        for k in ("d0", "d1"):
            t = welch_t([r[k] for r in rows], [r[k] for r in rnd]) if rnd else None
            if t is not None:
                rec["t"][k] = round(t, 2)
                if abs(t) >= 3 and abs(rec[k]["mean"] - (rec[k].get("random") or {}).get("mean", 0)) >= 0.5:
                    edge = True
        rec["edge"] = edge
        stats[typ] = rec
    if limit_types:
        stats = dict(sorted(stats.items(), key=lambda x: -x[1]["sample"])[:limit_types])
    return stats


def main() -> int:
    ap = argparse.ArgumentParser(description="공시 유형별 주가 반응 통계 (무작위 대조군 포함)")
    ap.add_argument("--push", action="store_true")
    ap.add_argument("--limit-types", type=int, default=None)
    args = ap.parse_args()

    stats = build(args.limit_types)
    edges = sum(1 for v in stats.values() if v["edge"])
    payload = {
        "updatedAtKst": now_kst(),
        "source": "DART 공시 5년 + 일봉(초과수익)",
        "note": "시장 프록시(KODEX 200 / 코스닥150) 대비 초과수익. 접수 시각을 알 수 없어 "
                "D0 와 D+1 을 따로 잰다. edge=false 는 무작위 대조군을 못 이긴 유형이다 — "
                "신호로 쓰지 말 것.",
        "minSample": MIN_SAMPLE,
        "typeCount": len(stats),
        "edgeCount": edges,
        "stats": stats,
    }
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    atomic_write_text(OUT_JSON, text)
    atomic_write_text(OUT_JS, "window.KR_DISCLOSURE_STATS = " + text + ";")

    print(f"[통계] 유형 {len(stats)}개 기록 · 무작위를 이긴 유형 {edges}개")
    for typ, v in sorted(stats.items(), key=lambda x: x[1]["d0"]["mean"])[:12]:
        mark = "★" if v["edge"] else " "
        print(f"  {mark} {typ:18s} N={v[chr(39)+chr(39)] if False else v['sample']:5d}  D0={v['d0']['mean']:+6.2f}%  "
              f"D+1={v['d1']['mean']:+6.2f}%  (무작위 D0={v['d0'].get('random',{}).get('mean',0):+.2f}%)")

    if args.push:
        import sec_client as sec

        with repository_publish_lock(ROOT):
            if not sec.git_publish(
                ["data/korea/disclosure_stats.json", "data/korea/disclosure_stats.js"],
                "KR disclosure reaction stats",
            ):
                return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
