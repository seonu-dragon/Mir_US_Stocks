"""US 스냅샷 가격 기준 거래일(priceDate) — 2026-09-25 '하루 밀린 시세' 재발 방지.

사고: 09-25 09:54 KST 스냅샷의 가격이 전부 09-23 종가(NVDA 225.51 −1.5%)였다. 실제
09-24 종가는 224.58(−0.41%). (1) 날짜 없는 Nasdaq 스크리너 값이 전 거래일 것이었고,
(2) 00:00 UTC 이후 받은 야후 일봉에 마지막 거래일 봉이 빠져 있었다. 아래 수치는 실측.
"""
from __future__ import annotations

from datetime import date, datetime, timezone

import pytest

import check_data_freshness as CDF
import update_data as UD
import us_market_calendar as CAL

# 2026-09-25 00:40 UTC = 09-24 20:40 ET (그날 본체가 야후를 받던 시각대)
RUN_NOW = datetime(2026, 9, 25, 0, 40, tzinfo=timezone.utc)
# 09-24 16:00:01 ET
QUOTE_0924 = int(datetime(2026, 9, 24, 20, 0, 1, tzinfo=timezone.utc).timestamp())


def _bars(pairs):
    return [
        {"date": d, "open": c, "high": c, "low": c, "close": c, "volume": 1_000.0 + i}
        for i, (d, c) in enumerate(pairs)
    ]


NVDA_THROUGH_0923 = _bars([
    ("2026-09-17", 219.34), ("2026-09-18", 222.27), ("2026-09-21", 227.38),
    ("2026-09-22", 228.87), ("2026-09-23", 225.51),
])


def test_bar_present_uses_last_completed_bar():
    rows = NVDA_THROUGH_0923 + _bars([("2026-09-24", 224.58)])
    session = UD.resolve_session_price(rows, None, now=RUN_NOW)
    assert session["priceDate"] == "2026-09-24"
    assert session["price"] == 224.58
    assert session["prevClose"] == 225.51
    assert session["barMissing"] is False


def test_missing_bar_uses_dated_quote_not_previous_bar():
    # 야후 일봉이 09-24 봉을 빠뜨렸지만 meta 시세는 09-24 16:00 ET 체결가.
    quote = {"time": QUOTE_0924, "price": 224.58, "volume": 5.0e7}
    session = UD.resolve_session_price(NVDA_THROUGH_0923, quote, now=RUN_NOW)
    assert session["priceDate"] == "2026-09-24"
    assert session["price"] == 224.58
    assert session["prevClose"] == 225.51
    assert session["barMissing"] is True
    assert session["rows"][-1]["date"] == "2026-09-23"  # 봉을 지어내지 않는다


def test_intraday_partial_bar_is_dropped():
    # 09-25 10:30 ET 수동 실행: 09-25 부분 봉은 기준일이 될 수 없다.
    rows = NVDA_THROUGH_0923 + _bars([("2026-09-24", 224.58), ("2026-09-25", 223.16)])
    now = datetime(2026, 9, 25, 14, 30, tzinfo=timezone.utc)
    session = UD.resolve_session_price(rows, None, now=now)
    assert session["priceDate"] == "2026-09-24"
    assert session["price"] == 224.58


def test_make_stock_with_missing_bar_does_not_relabel_previous_bar():
    rows = _bars([(f"2026-08-{d:02d}", 200.0 + d) for d in range(3, 29)]) + NVDA_THROUGH_0923
    meta = {
        "symbol": "NVDA", "company": "NVIDIA", "industry": "Semis", "sector": "TECHNOLOGY",
        "groups": set(), "marketCapB": 5000.0, "historySource": "yahoo",
        "quotePrice": 225.51, "quoteChangePct": -1.47,  # 스크리너(전 거래일) 값
    }
    quote = {"time": QUOTE_0924, "price": 224.58, "volume": 5.0e7}
    session = UD.resolve_session_price(rows, quote, now=RUN_NOW)
    rows = UD.apply_session_price(meta, session)
    stock = UD.make_stock(meta, rows)
    assert stock["price"] == 224.58
    assert stock["changePct"] == -0.4
    assert stock["priceDate"] == "2026-09-24"
    assert stock["sessionBarMissing"] is True
    assert stock["closeSeries"][-2:] == [225.51, 224.58]
    # 예전엔 마지막 봉(09-23)의 종가를 가격으로 덮어썼다 → 날짜와 종가가 어긋남
    assert stock["chartSeries"][-1][5] == "2026-09-23"
    assert stock["chartSeries"][-1][3] == 225.51
    assert meta["screenerPrice"] == 225.51


def _session(latest, prev, day="2026-09-24"):
    return {"priceDate": day, "price": latest, "prevClose": prev}


def test_classify_screener_stale_and_fresh():
    sessions = {
        "NVDA": _session(224.58, 225.51), "META": _session(777.59, 744.10),
        "GOOGL": _session(342.36, 337.83), "LLY": _session(1181.89, 1150.99),
        "JNJ": _session(270.68, 270.60),  # 움직임 0.03% — 판정 불가라 표본 제외
    }
    stale = {"NVDA": 225.51, "META": 744.1, "GOOGL": 337.83, "LLY": 1150.99, "JNJ": 270.6}
    fresh = {"NVDA": 224.58, "META": 777.59, "GOOGL": 342.36, "LLY": 1181.89, "JNJ": 270.68}
    s = UD.classify_screener_quotes(stale, sessions)
    assert (s["status"], s["stale"], s["fresh"]) == ("stale", 4, 0)
    f = UD.classify_screener_quotes(fresh, sessions)
    assert (f["status"], f["fresh"]) == ("fresh", 4)
    assert f["sessionDate"] == "2026-09-24"


def test_ensure_fresh_screener_retries_and_replaces_quotes(monkeypatch):
    monkeypatch.setattr(UD, "SCREENER_PROBE_SYMBOLS", ("NVDA", "META", "GOOGL", "LLY"))
    closes = {"NVDA": (225.51, 224.58), "META": (744.10, 777.59),
              "GOOGL": (337.83, 342.36), "LLY": (1150.99, 1181.89)}
    universe = [{"symbol": s, "quotePrice": c[0], "quoteChangePct": -1.0} for s, c in closes.items()]
    universe.append({"symbol": "TINY", "quotePrice": 1.0, "quoteChangePct": 0.0})

    def probe(symbol):
        prev, latest = closes[symbol]
        return _bars([("2026-09-22", prev * 1.01), ("2026-09-23", prev), ("2026-09-24", latest)]), None

    def screener():
        rows = [{"symbol": s, "quotePrice": c[1], "quoteChangePct": 0.5, "quoteVolume": 10} for s, c in closes.items()]
        return rows + [{"symbol": "TINY", "quotePrice": 1.2, "quoteChangePct": 20.0, "quoteVolume": 5}]

    sleeps = []
    result = UD.ensure_fresh_screener(
        universe, fetch_screener=screener, fetch_probe=probe,
        retries=2, wait_sec=7, sleep=sleeps.append, now=RUN_NOW,
    )
    assert result["status"] == "fresh" and result["retries"] == 1
    assert sleeps == [7]
    by = {m["symbol"]: m for m in universe}
    assert by["TINY"]["quotePrice"] == 1.2  # 이력 없는 소형주 가격이 새 값으로
    assert by["NVDA"]["quotePrice"] == 224.58


def test_ensure_fresh_screener_gives_up_as_stale(monkeypatch):
    monkeypatch.setattr(UD, "SCREENER_PROBE_SYMBOLS", ("NVDA", "META", "GOOGL"))
    closes = {"NVDA": (225.51, 224.58), "META": (744.10, 777.59), "GOOGL": (337.83, 342.36)}
    universe = [{"symbol": s, "quotePrice": c[0]} for s, c in closes.items()]

    def probe(symbol):
        prev, latest = closes[symbol]
        return _bars([("2026-09-22", prev), ("2026-09-23", prev), ("2026-09-24", latest)]), None

    def stale_screener():
        return [{"symbol": s, "quotePrice": c[0]} for s, c in closes.items()]

    result = UD.ensure_fresh_screener(
        universe, fetch_screener=stale_screener, fetch_probe=probe,
        retries=2, wait_sec=0, sleep=lambda _s: None, now=RUN_NOW,
    )
    assert result["status"] == "stale" and result["retries"] == 2


def test_summarize_price_dates_picks_mode():
    stocks = [{"priceDate": "2026-09-24"}] * 5 + [{"priceDate": "2026-09-23", "sessionBarMissing": True}] + [{}]
    price_date, check = UD.summarize_price_dates(stocks)
    assert price_date == "2026-09-24"
    assert check["yahooDated"] == 6 and check["sessionBarMissing"] == 1


# ── 달력 + 게이트 ─────────────────────────────────────────────────────────────

def test_last_completed_session():
    assert CAL.last_completed_session(RUN_NOW) == date(2026, 9, 24)
    # 금요일 장중 → 목요일
    assert CAL.last_completed_session(datetime(2026, 9, 25, 15, 0, tzinfo=timezone.utc)) == date(2026, 9, 24)
    # 월요일 새벽(ET) → 직전 금요일
    assert CAL.last_completed_session(datetime(2026, 9, 28, 9, 0, tzinfo=timezone.utc)) == date(2026, 9, 25)
    # 노동절(09-07 월) 다음 날 저녁 → 09-08, 노동절 당일 저녁 → 09-04(금)
    assert CAL.last_completed_session(datetime(2026, 9, 7, 23, 0, tzinfo=timezone.utc)) == date(2026, 9, 4)


def test_calendar_covers_next_year():
    # 해가 바뀌기 전에 다음 해 NYSE 휴장일을 넣어야 게이트가 계속 작동한다.
    # 11월부터는 다음 해 목록을 요구한다(그 전엔 올해만).
    today = datetime.now(timezone.utc).date()
    need = {today.year} | ({today.year + 1} if today.month >= 11 else set())
    assert need <= CAL.covered_years(), "us_market_calendar.NYSE_HOLIDAYS 에 다음 해 휴장일을 추가할 것"


def test_gate_fails_on_lagged_price_date():
    payload = {"priceDate": "2026-09-23", "priceCheck": {"screener": {"status": "stale", "stale": 18, "fresh": 0, "retries": 3}}}
    problems, _ = CDF.check_us_price_session(payload, now=datetime(2026, 9, 25, 1, 0, tzinfo=timezone.utc))
    assert len(problems) == 2
    assert "2026-09-23 < 마지막 완료 거래일 2026-09-24" in problems[0]


def test_gate_passes_on_current_price_date_and_weekend():
    payload = {"priceDate": "2026-09-25", "priceCheck": {"screener": {"status": "fresh"}}}
    # 토요일 아침 KST 실행 → 기대 거래일은 금요일
    problems, oks = CDF.check_us_price_session(payload, now=datetime(2026, 9, 26, 23, 0, tzinfo=timezone.utc))
    assert problems == [] and oks and oks[0].startswith("OK")


def test_gate_requires_price_date():
    problems, _ = CDF.check_us_price_session({}, now=RUN_NOW)
    assert problems and "priceDate 없음" in problems[0]


@pytest.mark.parametrize("day", sorted(d for ds in CAL.NYSE_HOLIDAYS.values() for d in ds))
def test_holidays_are_weekdays(day):
    assert date.fromisoformat(day).weekday() < 5


# ── 소형주 날짜 확인 시세(야후 spark) — 2026-09-26 재현 ─────────────────────────
# run 36202139416(09-26 01:00Z 무렵): 스크리너는 10분 간격 3회 재조회에도 09-24 값.
# 야후 spark 는 같은 시각 09-25 봉까지 있었다. 아래 timestamp·종가는 실측 응답.
RUN_0926 = datetime(2026, 9, 26, 1, 0, tzinfo=timezone.utc)  # 09-25 21:00 ET
SPARK_TS = [1789997400, 1790083800, 1790170200, 1790256600, 1790343000]  # 09-21..09-25 09:30 ET
SPARK_0926 = {
    "SOUN": {"symbol": "SOUN", "timestamp": SPARK_TS, "close": [6.17, 6.12, 6.01, 6.1, 6.05]},
    "ACHR": {"symbol": "ACHR", "timestamp": SPARK_TS, "close": [5.43, 5.69, 5.71, 5.71, 5.61]},
    "BRK-B": {"symbol": "BRK-B", "timestamp": SPARK_TS, "close": [480.0, 481.0, 482.0, 483.0, 486.0]},
    # 거래정지: 마지막 봉이 09-24 에서 멈춤
    "HALT": {"symbol": "HALT", "timestamp": SPARK_TS[:4], "close": [1.0, 1.1, 1.2, 1.3]},
}


def _spark_fetch(payload):
    def fetch(symbols):
        wanted = {UD.yahoo_symbol(s) for s in symbols}
        return UD.fetch_yahoo_spark(
            symbols, fetch_json=lambda _url: {k: v for k, v in payload.items() if k in wanted},
        )
    return fetch


def test_fetch_yahoo_spark_maps_symbols_and_ny_dates():
    urls = []

    def fake(url):
        urls.append(url)
        return SPARK_0926

    out = UD.fetch_yahoo_spark(["SOUN", "BRK.B", "NOPE"], fetch_json=fake)
    assert "BRK-B" in urls[0] and "range=5d" in urls[0]
    assert set(out) == {"SOUN", "BRK.B"}  # 요청 안 한 심볼·없는 심볼은 버린다
    assert out["SOUN"][-1] == {"date": "2026-09-25", "close": 6.05}
    assert out["SOUN"][0]["date"] == "2026-09-21"


def test_fetch_yahoo_spark_retries_429_then_gives_up():
    import urllib.error
    calls = []

    def throttled(url):
        calls.append(url)
        raise urllib.error.HTTPError(url, 429, "Too Many Requests", None, None)

    assert UD.fetch_yahoo_spark(["SOUN"], fetch_json=throttled, sleep=lambda _s: None) == {}
    assert len(calls) == UD.SPARK_RETRIES


def test_small_caps_use_dated_spark_close_when_screener_stale():
    # 스크리너(09-24 값): SOUN 6.10, ACHR 5.71. 기대: 09-25 종가·09-24 대비 등락률.
    universe = [
        {"symbol": "NVDA", "preferHistory": True, "quotePrice": 225.51},
        {"symbol": "SOUN", "quotePrice": 6.10, "quoteChangePct": 1.5, "quoteVolume": 9.0},
        {"symbol": "ACHR", "quotePrice": 5.71, "quoteChangePct": 0.0},
        {"symbol": "BRK.B", "quotePrice": 483.0},
        {"symbol": "HALT", "quotePrice": 1.3},
        {"symbol": "GONE", "quotePrice": 2.0, "quoteChangePct": 3.0},  # spark 에 없음
    ]
    result = UD.apply_dated_small_cap_quotes(universe, fetch_batch=_spark_fetch(SPARK_0926), now=RUN_0926)
    by = {m["symbol"]: m for m in universe}
    assert by["SOUN"]["quotePrice"] == 6.05 and by["SOUN"]["priceDate"] == "2026-09-25"
    assert round(by["SOUN"]["quoteChangePct"], 2) == -0.82  # 6.05 / 6.10 - 1
    assert by["SOUN"]["screenerPrice"] == 6.10 and by["SOUN"]["priceSource"] == "yahoo-spark"
    assert by["ACHR"]["quotePrice"] == 5.61 and round(by["ACHR"]["quoteChangePct"], 2) == -1.75
    assert by["BRK.B"]["quotePrice"] == 486.0
    assert by["HALT"]["priceDate"] == "2026-09-24"  # 날짜는 사실대로(게이트가 불일치로 센다)
    assert "priceDate" not in by["GONE"] and by["GONE"]["quotePrice"] == 2.0  # 스크리너 폴백
    assert "priceDate" not in by["NVDA"] and by["NVDA"]["quotePrice"] == 225.51  # 대형주는 build_one 몫
    assert result["targets"] == 5 and result["dated"] == 4 and result["undated"] == 1
    assert result["priceDateCounts"] == {"2026-09-25": 3, "2026-09-24": 1}


def test_spark_drops_intraday_partial_bar():
    # 09-25 11:00 ET 수동 실행이면 09-25 봉은 부분 봉 → 기준일 09-24.
    universe = [{"symbol": "SOUN", "quotePrice": 6.0}]
    UD.apply_dated_small_cap_quotes(
        universe, fetch_batch=_spark_fetch(SPARK_0926),
        now=datetime(2026, 9, 25, 15, 0, tzinfo=timezone.utc),
    )
    assert universe[0]["priceDate"] == "2026-09-24" and universe[0]["quotePrice"] == 6.1


def test_screener_retry_does_not_overwrite_spark_dated_price(monkeypatch):
    monkeypatch.setattr(UD, "SCREENER_PROBE_SYMBOLS", ("NVDA", "META", "GOOGL"))
    closes = {"NVDA": (225.51, 224.58), "META": (744.10, 777.59), "GOOGL": (337.83, 342.36)}
    universe = [{"symbol": s, "quotePrice": c[0]} for s, c in closes.items()]
    universe.append({"symbol": "SOUN", "quotePrice": 6.05, "priceDate": "2026-09-25",
                     "priceSource": "yahoo-spark", "quoteVolume": 1.0})

    def probe(symbol):
        prev, latest = closes[symbol]
        return _bars([("2026-09-22", prev), ("2026-09-23", prev), ("2026-09-24", latest)]), None

    def screener():
        rows = [{"symbol": s, "quotePrice": c[1]} for s, c in closes.items()]
        return rows + [{"symbol": "SOUN", "quotePrice": 9.99, "quoteChangePct": 50.0, "quoteVolume": 7.0}]

    UD.ensure_fresh_screener(universe, fetch_screener=screener, fetch_probe=probe,
                             retries=1, wait_sec=0, sleep=lambda _s: None, now=RUN_NOW)
    soun = universe[-1]
    assert soun["quotePrice"] == 6.05 and soun["quoteVolume"] == 7.0


def test_ensure_fresh_screener_retries_zero_skips_wait(monkeypatch):
    monkeypatch.setattr(UD, "SCREENER_PROBE_SYMBOLS", ("NVDA", "META", "GOOGL"))
    closes = {"NVDA": (225.51, 224.58), "META": (744.10, 777.59), "GOOGL": (337.83, 342.36)}
    universe = [{"symbol": s, "quotePrice": c[0]} for s, c in closes.items()]

    def probe(symbol):
        prev, latest = closes[symbol]
        return _bars([("2026-09-22", prev), ("2026-09-23", prev), ("2026-09-24", latest)]), None

    sleeps = []
    result = UD.ensure_fresh_screener(universe, fetch_screener=lambda: [], fetch_probe=probe,
                                      retries=0, wait_sec=600, sleep=sleeps.append, now=RUN_NOW)
    assert result["status"] == "stale" and result["retries"] == 0 and sleeps == []


def test_make_stock_spark_price_on_synthetic_rows_has_no_bar_missing():
    meta = {"symbol": "SOUN", "company": "SoundHound", "industry": "Software", "sector": "TECHNOLOGY",
            "groups": set(), "marketCapB": 2.5, "quotePrice": 6.05, "quoteChangePct": -0.82,
            "priceDate": "2026-09-25", "priceSource": "yahoo-spark"}
    rows = UD.synthetic_history("SOUN", 6.05, -0.82, 1e6)
    stock = UD.make_stock(meta, rows)
    assert stock["price"] == 6.05 and stock["changePct"] == -0.8
    assert stock["priceDate"] == "2026-09-25" and "sessionBarMissing" not in stock


def test_summarize_price_dates_counts_undated():
    stocks = [{"priceDate": "2026-09-25"}] * 3 + [{}] * 2
    _, check = UD.summarize_price_dates(stocks)
    assert check["total"] == 5 and check["undated"] == 2 and check["yahooDated"] == 3


def _payload_0926(*, on=7150, off=73, undated=18, screener="stale"):
    return {
        "priceDate": "2026-09-25",
        "priceCheck": {
            "yahooDated": on + off, "total": on + off + undated, "undated": undated,
            "priceDateCounts": {"2026-09-25": on, "2026-09-24": off},
            "screener": {"status": screener, "stale": 17, "fresh": 0, "retries": 0},
        },
    }


def test_gate_0926_screener_stale_but_small_caps_dated_passes_with_warning():
    problems, oks = CDF.check_us_price_session(_payload_0926(), now=RUN_0926)
    assert problems == []
    assert any(o.startswith("WARN") and "스크리너" in o for o in oks)


def test_gate_0926_spark_blocked_and_screener_stale_fails():
    # spark 가 막혀 소형주 3,938개가 스크리너(09-24) 폴백 → 날짜 미확인 54%
    payload = _payload_0926(on=3241, off=62, undated=3938)
    problems, _ = CDF.check_us_price_session(payload, now=RUN_0926)
    assert len(problems) == 1 and "55." in problems[0] and "스크리너" in problems[0]


def test_gate_undated_not_counted_when_screener_fresh():
    payload = _payload_0926(on=3241, off=62, undated=3938, screener="fresh")
    problems, oks = CDF.check_us_price_session(payload, now=RUN_0926)
    assert problems == [] and "스크리너 fresh 라 제외" in oks[-1]


def test_gate_fails_when_small_caps_dated_a_day_behind():
    # 소형주 spark 봉이 전부 09-24 에서 멈춘 경우: 스냅샷 priceDate 는 대형주 최빈값이라
    # 통과하지만 종목 단위 불일치가 잡는다.
    payload = _payload_0926(on=3241, off=3924, undated=14, screener="fresh")
    problems, _ = CDF.check_us_price_session(payload, now=RUN_0926)
    assert len(problems) == 1 and "불일치 3924" in problems[0]
