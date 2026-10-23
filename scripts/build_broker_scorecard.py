#!/usr/bin/env python3
"""증권사별 의견·목표가 변경 사후 성적표 — 사실 통계만(점수·순위 없음).

증권사(firm)마다 의견 상향·하향, 목표가 상향·하향 이벤트 뒤 20·60거래일 동안 그 종목 수익률에서 같은 기간 시장
벤치마크 수익률을 뺀 값(초과수익)을 모아 건수·평균·중앙값·플러스 비율을 낸다. '정확도 점수'나 순위는 만들지 않는다.

기준점: 발표일(그날이 휴장이면 다음 거래일) 종가 → h 거래일 뒤 종가. 발표 당일 반응은 들어가지 않는다.
표본: 기간이 다 지난(그 뒤로 h 거래일 봉이 있는) 이벤트만 센다. 그런 이벤트가 MIN_N 미만이면 통계를 내지 않고
      건수만 남긴다(화면은 '표본 부족 (n)'). 같은 종목·증권사·날짜·종류는 한 번만 센다.
가격: 종목 상세 chartSeries(US data/details, KR data/korea/details — 최근 약 5년 일봉).
벤치마크: US SPY · KR 코스피 종목은 KODEX 200(069500), 코스닥 종목은 KODEX 코스닥150(229200) — 모두 상세 일봉.

이벤트 원천
  US: 야후 upgradeDowngradeHistory(2012년~ 전체 이력). build_us_analyst_revisions.py 가 종목마다 받은 이력을
      그 실행 안에서 Accumulator 로 흘려 data/broker_scorecard.{json,js} 를 쓴다(원본 이력은 커밋하지 않는다).
      act up/down = 의견 상향·하향, priceTargetAction Raises/Lowers = 목표가 상향·하향.
  KR: data/korea/target_history 16 샤드(build_kr_target_changes.py, 같은 증권사 직전 리포트 대비, 최근 1년).
      목표가 상향·하향만(국내 리포트는 투자의견 변경이 드물고 샤드에 의견이 없다). 직전 대비 3배 넘는 변화는
      액면분할·병합으로 보고 뺀다(원 빌더와 같은 규칙).

산출물: window.BROKER_SCORECARD — US data/broker_scorecard.{json,js} · KR data/korea/broker_scorecard.{json,js}
  firms: [{"f": 증권사, "k": {종류: [전체 건수, h20, h60]}}] — hN 은 [표본 n, 평균%, 중앙값%, 플러스 비율%]
         (n < MIN_N 이면 [n]).
실행: py scripts/build_broker_scorecard.py --market kr [--push]
      (US 는 build_us_analyst_revisions.py 가 함께 쓴다 — 이 CLI 의 --market us 는 없다)
"""
from __future__ import annotations

import argparse
import json
import sys
from bisect import bisect_left
from datetime import date, timedelta
from pathlib import Path

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

HORIZONS = (20, 60)
MIN_N = 20
MAX_GAP_DAYS = 5          # 발표일과 기준 봉 사이가 이보다 멀면(상장 전·이력 공백) 이벤트를 뺀다
SPLIT_RATIO = 3.0
US_KINDS = ("up", "down", "ptUp", "ptDown")
KR_KINDS = ("ptUp", "ptDown")
US_EVENT_YEARS = 6        # 상세 일봉(약 5년)보다 조금 넓게 — 봉이 없는 이벤트는 어차피 빠진다

US_OUT = (ROOT / "data" / "broker_scorecard.json", ROOT / "data" / "broker_scorecard.js")
KR_OUT = (ROOT / "data" / "korea" / "broker_scorecard.json", ROOT / "data" / "korea" / "broker_scorecard.js")
JS_VAR = "BROKER_SCORECARD"
KR_SHARDS = ROOT / "data" / "korea" / "target_history"
KR_SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"
US_DETAILS = ROOT / "data" / "details"
KR_DETAILS = ROOT / "data" / "korea" / "details"
US_BENCH = "SPY"
KR_BENCH = {"kospi": "069500", "kosdaq": "229200"}


# ---------------------------------------------------------------------------
# 순수 함수(테스트 대상)
# ---------------------------------------------------------------------------

def series_from_bars(bars) -> tuple[list[str], list[float]]:
    """chartSeries [[o,h,l,c,v,date], …] → (날짜, 종가) — 날짜순, 종가가 양수인 봉만."""
    out: dict[str, float] = {}
    for b in bars or []:
        if not isinstance(b, (list, tuple)) or len(b) < 6:
            continue
        d, c = b[5], b[3]
        if isinstance(d, str) and isinstance(c, (int, float)) and c > 0:
            out[d[:10]] = float(c)
    dates = sorted(out)
    return dates, [out[d] for d in dates]


def forward_return(dates: list[str], closes: list[float], d: str, h: int):
    """발표일 d 기준 h 거래일 수익률과 (시작일, 끝일). 기간이 덜 지났거나 기준 봉이 멀면 None."""
    i = bisect_left(dates, d)
    if i >= len(dates) or i + h >= len(dates):
        return None
    try:
        gap = (date.fromisoformat(dates[i]) - date.fromisoformat(d[:10])).days
    except ValueError:
        return None
    if gap > MAX_GAP_DAYS:
        return None
    return closes[i + h] / closes[i] - 1.0, dates[i], dates[i + h]


def close_on_or_before(dates: list[str], closes: list[float], d: str):
    i = bisect_left(dates, d)
    if i < len(dates) and dates[i] == d:
        return closes[i]
    if i == 0:
        return None
    try:
        if (date.fromisoformat(d) - date.fromisoformat(dates[i - 1])).days > MAX_GAP_DAYS:
            return None
    except ValueError:
        return None
    return closes[i - 1]


def excess_return(stock: tuple, bench: tuple, d: str, h: int):
    """종목 h 거래일 수익률 − 같은 날짜 구간 벤치마크 수익률(%p). 계산할 수 없으면 None."""
    fr = forward_return(stock[0], stock[1], d, h)
    if fr is None:
        return None
    r, d0, d1 = fr
    b0 = close_on_or_before(bench[0], bench[1], d0)
    b1 = close_on_or_before(bench[0], bench[1], d1)
    if not b0 or not b1:
        return None
    return (r - (b1 / b0 - 1.0)) * 100.0


def summarize(values: list[float], min_n: int = MIN_N) -> list:
    """[n] 또는 [n, 평균, 중앙값, 플러스 비율] (모두 % 단위, 소수 둘째 자리)."""
    n = len(values)
    if n < min_n:
        return [n]
    s = sorted(values)
    med = s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2
    pos = sum(1 for v in values if v > 0) / n * 100.0
    return [n, round(sum(values) / n, 2), round(med, 2), round(pos, 1)]


def us_event_kinds(act: str, pt_act: str) -> list[str]:
    kinds = []
    if act == "up":
        kinds.append("up")
    elif act == "down":
        kinds.append("down")
    if pt_act == "Raises":
        kinds.append("ptUp")
    elif pt_act == "Lowers":
        kinds.append("ptDown")
    return kinds


def kr_event_kind(target, prev) -> str | None:
    if not isinstance(target, (int, float)) or not isinstance(prev, (int, float)) or target <= 0 or prev <= 0:
        return None
    ratio = target / prev
    if ratio > SPLIT_RATIO or ratio < 1 / SPLIT_RATIO:
        return None
    if ratio > 1.0001:
        return "ptUp"
    if ratio < 0.9999:
        return "ptDown"
    return None


class Accumulator:
    """종목 하나씩 흘려 넣는다 — 일봉은 그 종목 이벤트를 셀 때만 들고 있다(메모리 절약)."""

    def __init__(self, kinds, horizons=HORIZONS, min_n=MIN_N):
        self.kinds = tuple(kinds)
        self.horizons = tuple(horizons)
        self.min_n = min_n
        self.total: dict[str, dict[str, int]] = {}
        self.vals: dict[tuple[str, str, int], list[float]] = {}
        self.first = ""
        self.last = ""
        self.events = 0

    def add(self, stock: tuple, bench: tuple, events) -> None:
        """events: (날짜, 증권사, 종류) 반복. 같은 (날짜·증권사·종류)는 한 번만."""
        seen = set()
        for d, firm, kind in events:
            firm = str(firm or "").strip()
            if not firm or kind not in self.kinds or not isinstance(d, str):
                continue
            key = (d[:10], firm, kind)
            if key in seen:
                continue
            seen.add(key)
            if stock is None or not stock[0] or forward_return(stock[0], stock[1], d, 0) is None:
                continue     # 그 날짜 일봉이 없다(상장 전·이력 밖) — 전체 건수에도 넣지 않는다
            self.events += 1
            self.first = min(self.first or d[:10], d[:10])
            self.last = max(self.last, d[:10])
            t = self.total.setdefault(firm, {})
            t[kind] = t.get(kind, 0) + 1
            for h in self.horizons:
                x = excess_return(stock, bench, d, h)
                if x is not None:
                    self.vals.setdefault((firm, kind, h), []).append(round(x, 3))

    def firms(self) -> list[dict]:
        out = []
        for firm in sorted(self.total, key=lambda f: (-sum(self.total[f].values()), f)):
            k = {}
            for kind, n in self.total[firm].items():
                k[kind] = [n] + [summarize(self.vals.get((firm, kind, h), []), self.min_n) for h in self.horizons]
            out.append({"f": firm, "k": k})
        return out

    def payload(self, market: str, source: str, bench: str, stamp: str) -> dict:
        firms = self.firms()
        return {
            "updatedAtKst": stamp,
            "market": market,
            "source": source,
            "bench": bench,
            "method": "발표일 종가 → N거래일 뒤 종가 수익률 − 같은 구간 벤치마크 수익률(%p). 기간이 다 지난 이벤트만.",
            "horizons": list(self.horizons),
            "minN": self.min_n,
            "kinds": list(self.kinds),
            "eventsFrom": self.first,
            "eventsTo": self.last,
            "events": self.events,
            "count": len(firms),
            "firms": firms,
        }


# ---------------------------------------------------------------------------
# 파일
# ---------------------------------------------------------------------------

def load_series(details_dir: Path, ticker: str):
    from financials_common import safe_file_name
    path = details_dir / f"{safe_file_name(ticker)}.json"
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    s = series_from_bars(doc.get("chartSeries"))
    del doc
    return s if s[0] else None


class UsScorecard:
    """build_us_analyst_revisions.py 가 종목마다 add(ticker, ratings) 를 부른다(ratings = parse_ratings 행)."""

    def __init__(self, details_dir: Path = US_DETAILS, today: date | None = None):
        self.details_dir = details_dir
        self.bench = load_series(details_dir, US_BENCH)
        self.acc = Accumulator(US_KINDS)
        self.cutoff = ((today or date.today()) - timedelta(days=365 * US_EVENT_YEARS)).isoformat()

    def ok(self) -> bool:
        return bool(self.bench)

    def add(self, ticker: str, ratings) -> None:
        if not self.bench:
            return
        events = [(r[1], r[2], k) for r in ratings or [] if len(r) >= 9 and r[1] >= self.cutoff
                  for k in us_event_kinds(r[3], r[8])]
        if not events:
            return
        stock = load_series(self.details_dir, ticker)
        if stock:
            self.acc.add(stock, self.bench, events)

    def write(self, stamp: str) -> dict | None:
        if not self.bench or not self.acc.total:
            print("[경고] 증권사 성적표(US): 벤치마크 일봉 또는 이벤트 없음 — 기존 파일 유지")
            return None
        from sec_client import write_data
        payload = self.acc.payload("us", "Yahoo Finance upgradeDowngradeHistory · 종목 상세 일봉", US_BENCH, stamp)
        write_data(US_OUT[0], US_OUT[1], "BROKER_SCORECARD", payload, indent=None, min_ratio=0.5)
        print(f"→ 증권사 성적표(US) {payload['count']}곳 · 이벤트 {payload['events']}건 ({payload['eventsFrom']}~{payload['eventsTo']})")
        return payload


def kr_market_map() -> dict[str, str]:
    try:
        snap = json.loads(KR_SNAPSHOT.read_text(encoding="utf-8"))
    except Exception:
        return {}
    out = {str(s.get("ticker")): str(s.get("market") or "").lower() for s in snap.get("stocks") or [] if s.get("ticker")}
    del snap
    return out


def build_kr(stamp: str) -> dict | None:
    markets = kr_market_map()
    benches = {m: load_series(KR_DETAILS, code) for m, code in KR_BENCH.items()}
    if not benches.get("kospi"):
        print("[중단] KODEX 200 일봉 없음")
        return None
    acc = Accumulator(KR_KINDS)
    shards = sorted(KR_SHARDS.glob("*.json"))
    if not shards:
        print("[중단] 목표가 이력 샤드 없음")
        return None
    for shard in shards:
        try:
            tmap = json.loads(shard.read_text(encoding="utf-8")).get("t") or {}
        except Exception as exc:
            print(f"  [경고] {shard.name}: {exc}")
            continue
        for code, rows in tmap.items():
            events = []
            for r in rows or []:
                if isinstance(r, list) and len(r) >= 4:
                    k = kr_event_kind(r[2], r[3])
                    if k:
                        events.append((r[0], r[1], k))
            if not events:
                continue
            bench = benches.get(markets.get(code, "kospi")) or benches["kospi"]
            stock = load_series(KR_DETAILS, code)
            if stock:
                acc.add(stock, bench, events)
        del tmap
    return acc.payload("kr", "네이버 증권 리포트(같은 증권사 직전 리포트 대비) · 종목 상세 일봉",
                       "KODEX 200 · KODEX 코스닥150", stamp)


def main() -> int:
    ap = argparse.ArgumentParser(description="증권사별 의견·목표가 변경 사후 성적표")
    ap.add_argument("--market", choices=["kr"], default="kr")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()
    import sec_client as sec
    print("=== 증권사 사후 성적표 (KR) ===")
    payload = build_kr(sec.kst_now_str())
    if not payload or not payload["count"]:
        print("[중단] 결과 없음 — 기존 파일 유지")
        return 1
    print(f"  증권사 {payload['count']}곳 · 이벤트 {payload['events']}건 ({payload['eventsFrom']}~{payload['eventsTo']})")
    if args.dry_run:
        for f in payload["firms"][:8]:
            print("   ", f["f"], f["k"])
        return 0
    from briefing_store import repository_publish_lock
    with repository_publish_lock(ROOT):
        sec.write_data(KR_OUT[0], KR_OUT[1], "BROKER_SCORECARD", payload, indent=None, min_ratio=0.5)
        if args.push and not sec.git_publish(["data/korea/broker_scorecard.json", "data/korea/broker_scorecard.js"],
                                             "KR broker scorecard"):
            print("[중단] push 실패")
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
