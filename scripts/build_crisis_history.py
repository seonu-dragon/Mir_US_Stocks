"""과거 위기 구간 가격 경로 — 내 투자 › 도구 › 스트레스 테스트의 '과거 위기 재생' 데이터.

종목 상세 JSON(data/details/<T>.json)의 chartSeries 는 스냅샷 기준 약 5년(2021-09~)이라
2022 금리 급등·2024-08 급락은 덮지만 2008·2018 Q4·2020 코로나는 덮지 못한다. 워커 차트
프록시(worker/yahoo-proxy.js fetchChart)도 range=5y 고정이다. 그래서 오래된 구간만 여기서
받아 둔다.

  - 대리 지수(proxies): US 는 SPY + 섹터 SPDR 11개, KR 은 코스피(^KS11)·코스닥(^KQ11).
    다섯 구간 전부 + 최근 3년 일별 종가(recent — 브라우저가 종목 β 를 추정할 때 쓴다).
  - 종목(series): 시가총액 상위 US 250 · KR 150 종목의 오래된 세 구간(gfc·q4_2018·covid).
    나머지 종목·상장 전 종목은 브라우저가 '대리 지수 × β' 로 계산하고 화면에 대리라고 표시한다.

값: 구간 첫 거래일 종가 = 1000 으로 정규화한 정수(분할 조정 종가, 배당 미포함 가격수익률).
정규화라 이후 액면분할이 있어도 값이 바뀌지 않는다 — 이미 받은 종목은 다시 받지 않는다.
구간 달력은 시장 기준 지수(SPY / ^KS11)의 거래일이고, 종목 결측일은 직전 종가로 채운다.

출처: Yahoo Finance v8 chart(period1/period2, interval=1d). 실패 시 기존 파일 유지 + exit 1.

실행: py scripts/build_crisis_history.py [--push] [--limit-us 250] [--limit-kr 150] [--refetch]
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import sec_client as sec  # noqa: E402
from briefing_store import repository_publish_lock  # noqa: E402

OUT_JSON = ROOT / "data" / "crisis_history.json"
OUT_JS = ROOT / "data" / "crisis_history.js"
SOURCE = "Yahoo Finance 일봉 종가(분할 조정 · 배당 미포함)"
UA = {"User-Agent": "Mozilla/5.0"}
SCALE = 1000

# 구간 정의 — 화면 라벨·설명도 여기서 나간다(한 곳에서만 고친다).
WINDOWS = [
    {"id": "gfc", "label": "2008 금융위기", "start": "2008-09-01", "end": "2009-03-09",
     "desc": "리먼 파산(9/15) 직전부터 미국 증시 저점(2009-03-09)까지"},
    {"id": "q4_2018", "label": "2018년 4분기 급락", "start": "2018-10-01", "end": "2018-12-24",
     "desc": "금리 인상·무역분쟁 우려로 S&P500 이 약 20% 빠진 구간(저점 12/24)"},
    {"id": "covid", "label": "2020 코로나 폭락", "start": "2020-02-19", "end": "2020-03-23",
     "desc": "S&P500 고점(2/19)부터 저점(3/23)까지"},
    {"id": "rates2022", "label": "2022 금리 급등", "start": "2022-01-03", "end": "2022-10-12",
     "desc": "연준 급격한 인상기 — 연초부터 S&P500 저점(10/12)까지"},
    {"id": "aug2024", "label": "2024-08-05 급락 전후", "start": "2024-07-31", "end": "2024-08-09",
     "desc": "엔 캐리 청산·미국 경기 우려로 코스피 -8.8%(8/5)·닛케이 -12% 폭락 전후"},
]
OLD_WINDOWS = ["gfc", "q4_2018", "covid"]  # 상세 JSON(약 5년)이 덮지 못하는 구간

US_PROXIES = {
    "technology": "XLK", "communication": "XLC", "financial": "XLF", "consumer_cyclical": "XLY",
    "consumer_defensive": "XLP", "healthcare": "XLV", "utilities": "XLU", "industrials": "XLI",
    "energy": "XLE", "real_estate": "XLRE", "materials": "XLB", "default": "SPY",
}
KR_PROXIES = {"kospi": "^KS11", "kosdaq": "^KQ11", "default": "^KS11"}
MARKETS = {
    "us": {"benchmark": "SPY", "proxies": US_PROXIES, "snapshot": ROOT / "data" / "market_snapshot.json"},
    "kr": {"benchmark": "^KS11", "proxies": KR_PROXIES, "snapshot": ROOT / "data" / "korea" / "market_snapshot.json"},
}
RECENT_YEARS = 3


def utc_ts(iso: str) -> int:
    return int(dt.datetime.fromisoformat(iso).replace(tzinfo=dt.timezone.utc).timestamp())


def yahoo_daily(symbol: str, start: str, end: str, retries: int = 3) -> list[tuple[str, float]]:
    """[(YYYY-MM-DD, close)] — 거래소 현지 날짜. 실패 시 [] (없는 심볼 400 포함)."""
    url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(symbol)}"
           f"?period1={utc_ts(start)}&period2={utc_ts(end)}&interval=1d")
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=UA)
            payload = json.loads(urllib.request.urlopen(req, timeout=20).read().decode("utf-8", "replace"))
            res = (payload.get("chart") or {}).get("result") or []
            if not res:
                return []
            res = res[0]
            ts = res.get("timestamp") or []
            quote = ((res.get("indicators") or {}).get("quote") or [{}])[0]
            closes = quote.get("close") or []
            gmt = int((res.get("meta") or {}).get("gmtoffset") or 0)
            out = []
            for t, c in zip(ts, closes):
                if c is None or not (c > 0):
                    continue
                day = dt.datetime.fromtimestamp(t + gmt, tz=dt.timezone.utc).date().isoformat()
                out.append((day, float(c)))
            return out
        except urllib.error.HTTPError as exc:
            if exc.code in (400, 404):
                return []
            time.sleep(2 + attempt * 3)
        except Exception:
            time.sleep(2 + attempt * 3)
    return []


def window_calendar(bench_rows, w):
    return [d for d, _ in bench_rows if w["start"] <= d <= w["end"]]


def normalize_on(rows, calendar):
    """calendar 날짜에 맞춘 정규화 경로(첫날=SCALE). 첫날 이전(7일 이내) 가격이 없으면 None."""
    if not calendar or not rows:
        return None
    first = calendar[0]
    lead = (dt.date.fromisoformat(first) - dt.timedelta(days=7)).isoformat()
    by_day = dict(rows)
    base = None
    for d, c in rows:  # 첫 달력일 또는 그 직전 7일 안의 마지막 종가
        if lead <= d <= first:
            base = c
    if base is None:
        return None
    out, last = [], base
    days = [d for d, _ in rows]
    for d in calendar:
        if d in by_day:
            last = by_day[d]
        out.append(round(last / base * SCALE))
    # 구간 안에 실제 거래가 거의 없으면(거래정지 등) 버린다.
    inside = sum(1 for d in days if calendar[0] <= d <= calendar[-1])
    if inside < max(3, len(calendar) * 0.5):
        return None
    return out


def sig4(x: float) -> float:
    if x == 0:
        return 0.0
    from math import floor, log10
    return round(x, max(0, 3 - int(floor(log10(abs(x))))))


def us_yahoo(t: str) -> str:
    return t.upper().replace(".", "-")


def load_universe(market: str, limit: int):
    snap_path = MARKETS[market]["snapshot"]
    try:
        stocks = json.loads(snap_path.read_text(encoding="utf-8")).get("stocks") or []
    except Exception as exc:
        print(f"  [{market}] 스냅샷 읽기 실패: {exc}")
        return []
    rows = [s for s in stocks if s.get("ticker") and (s.get("marketCapB") or 0) > 0]
    rows.sort(key=lambda s: -(s.get("marketCapB") or 0))
    out = []
    for s in rows[:limit]:
        if market == "us":
            out.append((s["ticker"], us_yahoo(s["ticker"])))
        else:
            ysym = s.get("yahooSymbol") or (f"{s['ticker']}.KQ" if s.get("market") == "kosdaq" else f"{s['ticker']}.KS")
            out.append((s["ticker"], ysym))
    return out


def build(args) -> dict:
    prev = {}
    if OUT_JSON.exists():
        try:
            prev = json.loads(OUT_JSON.read_text(encoding="utf-8"))
        except Exception:
            prev = {}
    today = dt.date.today().isoformat()
    tomorrow = (dt.date.today() + dt.timedelta(days=1)).isoformat()
    recent_start = (dt.date.today() - dt.timedelta(days=int(365.25 * RECENT_YEARS))).isoformat()
    out = {
        "updatedAtKst": sec.kst_now_str(),
        "source": SOURCE,
        "priceBasis": "구간 첫 거래일 종가 = 1000 정규화 · 분할 조정 · 배당 미포함",
        "scale": SCALE,
        "windows": WINDOWS,
        "oldWindows": OLD_WINDOWS,
        "markets": {},
    }
    for market, meta in MARKETS.items():
        limit = args.limit_us if market == "us" else args.limit_kr
        prev_m = ((prev.get("markets") or {}).get(market)) or {}
        proxy_syms = sorted(set(meta["proxies"].values()))
        # 1) 대리 지수: 2008-08 부터 오늘까지 한 번에 받아 다섯 구간 + 최근 3년을 자른다.
        proxy_rows = {}
        for sym in proxy_syms:
            rows = yahoo_daily(sym, "2008-08-01", tomorrow)
            time.sleep(args.sleep)
            if rows:
                proxy_rows[sym] = rows
            else:
                print(f"  [{market}] 대리 지수 {sym} 수집 실패")
        bench = meta["benchmark"]
        if bench not in proxy_rows:
            raise RuntimeError(f"{market} 기준 지수 {bench} 수집 실패 — 구간 달력을 만들 수 없다")
        calendars = {w["id"]: window_calendar(proxy_rows[bench], w) for w in WINDOWS}
        series = {}
        for sym, rows in proxy_rows.items():
            entry = {}
            for w in WINDOWS:
                path = normalize_on(rows, calendars[w["id"]])
                if path:
                    entry[w["id"]] = path
            series[sym] = entry
        recent_dates = [d for d, _ in proxy_rows[bench] if recent_start <= d <= today]
        recent = {"dates": recent_dates, "closes": {}}
        for sym, rows in proxy_rows.items():
            by_day = dict(rows)
            last, vals = None, []
            for d in recent_dates:
                if d in by_day:
                    last = by_day[d]
                vals.append(sig4(last) if last else None)
            recent["closes"][sym] = vals
        # 2) 종목: 오래된 세 구간만. 이미 받은 종목(또는 상장 전으로 확인된 종목)은 건너뛴다.
        prev_series = prev_m.get("series") or {}
        prev_missing = prev_m.get("missing") or {}
        universe = load_universe(market, limit)
        fetched = kept = failed = 0
        missing = {}
        for ticker, ysym in universe:
            if ticker in proxy_rows:
                continue
            if not args.refetch and ticker in prev_series and prev_series[ticker]:
                series[ticker] = prev_series[ticker]
                kept += 1
                continue
            # 'no-data'(심볼 없음 = 상장 전 또는 네트워크 실패)는 매번 다시 확인한다 — 한 번의 일시 실패가
            # 영구 '대리' 로 굳지 않게. 구간 안 거래가 없다고 확인된 'not-listed' 만 건너뛴다.
            if not args.refetch and prev_missing.get(ticker) == "not-listed":
                missing[ticker] = prev_missing[ticker]
                kept += 1
                continue
            rows = yahoo_daily(ysym, "2008-08-01", "2020-04-15")
            time.sleep(args.sleep)
            fetched += 1
            if not rows:
                # 400(상장 전 심볼 없음)과 네트워크 실패를 구분할 수 없어 '없음' 으로만 적는다.
                missing[ticker] = "no-data"
                failed += 1
                continue
            entry = {}
            for wid in OLD_WINDOWS:
                path = normalize_on(rows, calendars[wid])
                if path:
                    entry[wid] = path
            if entry:
                series[ticker] = entry
            else:
                missing[ticker] = "not-listed"
        prev_count = len(prev_series)
        if prev_count and len(series) < prev_count * 0.7:
            raise RuntimeError(f"{market} 종목 수 {prev_count} → {len(series)} 로 30% 넘게 줄었다 — 기존 파일 유지")
        out["markets"][market] = {
            "benchmark": bench,
            "proxies": meta["proxies"],
            "calendars": calendars,
            "series": series,
            "recent": recent,
            "missing": missing,
            "universe": len(universe),
        }
        print(f"  [{market}] 대리 {len(proxy_rows)}/{len(proxy_syms)} · 종목 시계열 {len(series) - len(proxy_rows)}"
              f" (새로 받음 {fetched} · 유지 {kept} · 없음 {failed}) · 상장 전/없음 {len(missing)}")
    # 신뢰도 센터 건수 = 두 시장의 종목·대리 시계열 수.
    out["count"] = sum(len(m["series"]) for m in out["markets"].values())
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--push", action="store_true")
    ap.add_argument("--refetch", action="store_true", help="이미 받은 종목도 다시 받는다")
    ap.add_argument("--limit-us", type=int, default=250)
    ap.add_argument("--limit-kr", type=int, default=150)
    ap.add_argument("--sleep", type=float, default=0.35)
    args = ap.parse_args()
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    try:
        payload = build(args)
    except Exception as exc:
        print(f"  [실패] {exc} — 기존 파일 유지")
        raise SystemExit(1)
    with repository_publish_lock(ROOT):
        sec.write_data(OUT_JSON, OUT_JS, "CRISIS_HISTORY", payload, indent=None)
        print(f"Wrote {OUT_JSON.relative_to(ROOT)} ({OUT_JSON.stat().st_size / 1024:.0f} KB)")
        if args.push and not sec.git_publish(
            ["data/crisis_history.json", "data/crisis_history.js"], "crisis history"
        ):
            print("  [실패] git 게시 실패 — 발행되지 않았다")
            raise SystemExit(1)


if __name__ == "__main__":
    main()
