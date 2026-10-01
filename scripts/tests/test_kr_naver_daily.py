"""국내 일봉 원천 = 네이버 (2026-10-01) 회귀 테스트.

증상: 국내 일봉(chartSeries)이 야후 .KS/.KQ 라 과거 종가가 KRX/네이버와 달랐다
(005930 2026-09-29 야후 272,500 vs 네이버 275,000). #272 는 기준일 봉만 스냅샷으로 맞췄다.

수정: update_korea_data 가 네이버 차트 API(수정주가)로 일봉을 받고, 네이버가 실패한 종목만
야후로 받는다. 어느 쪽인지 detail 의 barsSource 에 남긴다. 픽스처는 실제 응답을 저장한 것이다
(scripts/tests/fixtures/naver_daily/005930_day_202609.json, 2026-09-01~09-30). 네트워크는 쓰지 않는다.
"""
from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import pytest

import update_data as UD
import update_korea_data as K

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "naver_daily" / "005930_day_202609.json"


def _fixture_rows():
    return K.parse_naver_daily(json.loads(FIXTURE.read_text(encoding="utf-8")))


def _bars(start_day: int, n: int, close: float = 1000.0, month: str = "2026-09"):
    return [
        {"date": f"{month}-{start_day + i:02d}", "open": close, "high": close, "low": close,
         "close": close + i, "volume": 100.0 + i}
        for i in range(n)
    ]


# --------------------------------------------------------------------------
# 파서
# --------------------------------------------------------------------------

def test_parser_reads_real_fixture_with_naver_close():
    rows = _fixture_rows()
    by_date = {r["date"]: r for r in rows}
    assert rows == sorted(rows, key=lambda r: r["date"])
    # 야후는 272,500(그 뒤 #272 이전엔 269,500 으로 덮임). 네이버/KRX 는 275,000.
    assert by_date["2026-09-29"]["close"] == 275000.0
    assert by_date["2026-09-23"]["close"] == 286500.0
    assert by_date["2026-09-30"]["volume"] == 16477580.0
    assert set(rows[0]) == {"date", "open", "high", "low", "close", "volume"}


def test_parser_accepts_price_infos_wrapper_and_cleans_rows():
    payload = {"priceInfos": [
        {"localDate": "20260902", "closePrice": 110.0, "openPrice": 0, "highPrice": None,
         "lowPrice": 105.0, "accumulatedTradingVolume": 0},
        {"localDate": "20260901", "closePrice": 100.0, "openPrice": 99.0, "highPrice": 98.0,
         "lowPrice": 101.0, "accumulatedTradingVolume": 5},
        {"localDate": "20260903", "closePrice": 0},           # 종가 없음 → 버림
        {"localDate": "bad", "closePrice": 1.0},              # 날짜 없음 → 버림
        {"localDate": "20260902", "closePrice": 111.0},       # 같은 날짜는 뒤 값
    ]}
    rows = K.parse_naver_daily(payload)
    assert [r["date"] for r in rows] == ["2026-09-01", "2026-09-02"]
    first, second = rows
    # 고가·저가는 종가를 포함하도록
    assert first["high"] == 100.0 and first["low"] == 100.0
    # 비어 있는 시가·고가·저가는 종가로(거래정지일)
    assert second == {"date": "2026-09-02", "open": 111.0, "high": 111.0, "low": 111.0,
                      "close": 111.0, "volume": 0.0}


# --------------------------------------------------------------------------
# 증분 / 전체
# --------------------------------------------------------------------------

class FakeFetch:
    def __init__(self, rows):
        self.rows = rows
        self.calls = []

    def __call__(self, code, start, end):
        self.calls.append((start, end))
        return [r for r in self.rows if start.isoformat() <= r["date"] <= end.isoformat()]


TODAY = date(2026, 9, 30)


@pytest.fixture(autouse=True)
def _no_rolling_full(monkeypatch):
    monkeypatch.setattr(UD, "should_force_full_refresh", lambda symbol, today: False)
    # 픽스처는 한 달(20봉)이라 최소 봉 수만 낮춘다. 최소 봉 수 규칙 자체는 아래 테스트가 본다.
    monkeypatch.setattr(K, "NAVER_MIN_ROWS", 10)


def test_no_cache_fetches_full_window():
    fetch = FakeFetch(_fixture_rows())
    rows, mode = K.fetch_naver_history_smart("005930", None, None, today=TODAY, fetch_fn=fetch)
    assert mode == "full"
    assert len(fetch.calls) == 1
    start, end = fetch.calls[0]
    assert (end - start).days == K.NAVER_FULL_LOOKBACK_DAYS
    assert rows[-1]["date"] == "2026-09-30"


def test_naver_cache_is_merged_incrementally():
    full = _fixture_rows()
    cached = full[:-2]                                      # 09-25 까지(가정: 어제 발행분)
    cached[-1] = {**cached[-1], "close": 1.0}               # 마지막 봉은 장중일 수 있어 비교에서 뺀다
    fetch = FakeFetch(full)
    rows, mode = K.fetch_naver_history_smart("005930", (cached, []), "naver", today=TODAY, fetch_fn=fetch)
    assert mode == "incremental"
    assert len(fetch.calls) == 1
    start, _ = fetch.calls[0]
    assert start == date.fromisoformat(cached[-1]["date"]) - __import__("datetime").timedelta(
        days=K.NAVER_INCREMENTAL_OVERLAP_DAYS)
    assert [r["date"] for r in rows] == [r["date"] for r in full]
    assert rows[-3]["close"] == full[-3]["close"]          # 장중 값은 새 값으로 바뀐다


def test_adjustment_in_overlap_triggers_full_refetch():
    full = _fixture_rows()
    cached = [{**r, "close": r["close"] * 2} for r in full[:-1]]   # 권리락 전 원가(가정)
    fetch = FakeFetch(full)
    rows, mode = K.fetch_naver_history_smart("005930", (cached, []), "naver", today=TODAY, fetch_fn=fetch)
    assert mode == "full-mismatch"
    assert len(fetch.calls) == 2
    assert rows == full


def test_yahoo_cache_is_never_extended_with_naver_bars():
    full = _fixture_rows()
    fetch = FakeFetch(full)
    _, mode = K.fetch_naver_history_smart("005930", (full[:-1], []), "yahoo", today=TODAY, fetch_fn=fetch)
    assert mode == "full"
    assert len(fetch.calls) == 1


def test_stale_naver_cache_is_refetched_in_full():
    full = _fixture_rows()
    fetch = FakeFetch(full)
    later = date(2026, 10, 30)
    _, mode = K.fetch_naver_history_smart("005930", (full, []), "naver", today=later, fetch_fn=fetch)
    assert mode == "full"


def test_too_few_rows_raises_so_caller_falls_back(monkeypatch):
    monkeypatch.setattr(K, "NAVER_MIN_ROWS", 30)
    fetch = FakeFetch(_fixture_rows())
    with pytest.raises(RuntimeError):
        K.fetch_naver_history_smart("005930", None, None, today=TODAY, fetch_fn=fetch)


def test_overlap_ignores_the_last_cached_bar_and_needs_one_compared_day():
    fresh = _bars(10, 5)
    cached = _bars(1, 10)                                   # 겹침은 09-10 하나 = 캐시 마지막 봉
    assert not K.naver_overlap_ok(cached, fresh)            # 비교할 날이 없다
    cached = _bars(1, 11)                                   # 09-10, 09-11 겹침 → 09-10 비교
    cached[-1]["close"] = 1.0
    assert not K.naver_overlap_ok(cached, fresh)            # 09-10: 1009 vs 1000 → 다름
    cached = [dict(r) for r in _bars(1, 11)]
    for r in cached:
        r["close"] = 1000.0 + (int(r["date"][-2:]) - 10)
    cached[-1]["close"] = 1.0
    assert K.naver_overlap_ok(cached, fresh)


# --------------------------------------------------------------------------
# build_one: 원천 기록과 폴백
# --------------------------------------------------------------------------

def _meta():
    return {
        "symbol": "005930", "yahooSymbol": "005930.KS", "company": "삼성전자",
        "industry": "반도체", "sector": "기술", "groups": set(), "market": "kospi",
        "preferHistory": True, "quotePrice": 269500.0, "quoteDate": "2026-09-30",
        "quoteVolume": 15700594, "marketCapT": 1.0,
    }


@pytest.fixture
def isolated_details(tmp_path, monkeypatch):
    monkeypatch.setattr(K, "DETAILS_DIR", tmp_path)
    monkeypatch.setattr(K, "fetch_naver_news", lambda code, limit=8: [])
    monkeypatch.setattr(UD, "fetch_news", lambda symbol: [])
    K._CACHED_BARS_SOURCE.clear()
    return tmp_path


def test_build_one_uses_naver_bars_and_yahoo_events(isolated_details, monkeypatch):
    full = _fixture_rows()
    monkeypatch.setattr(K, "fetch_naver_daily", lambda code, start, end, retries=3: list(full))
    monkeypatch.setattr(K, "fetch_yahoo_history_kr",
                        lambda ysym, range_="5y": (_bars(1, 40, 9.0), [["2026-09-05", 361.0]]))
    stock, err = K.build_one(_meta())
    assert err is None
    assert stock["barsSource"] == "naver"
    assert stock["historySource"] == "yahoo"                # '오늘 받은 실측' 의미는 그대로
    closes = {row[5]: row[3] for row in stock["chartSeries"]}
    assert closes["2026-09-29"] == 275000.0
    assert stock["dividends"] == [["2026-09-05", 361.0]]   # 이벤트만 야후, 봉은 버린다


def test_build_one_falls_back_to_yahoo_and_says_so(isolated_details, monkeypatch):
    def boom(code, start, end, retries=3):
        raise RuntimeError("naver 503")
    yahoo_rows = _bars(1, 12, 250000.0, "2026-08") + [
        {**r, "close": r["close"] - 2500} for r in _fixture_rows()
    ]
    monkeypatch.setattr(K, "fetch_naver_daily", boom)
    monkeypatch.setattr(K, "fetch_yahoo_history_kr", lambda ysym, range_="5y": (list(yahoo_rows), []))
    stock, err = K.build_one(_meta())
    assert err is None
    assert stock["barsSource"] == "yahoo"
    assert len(stock["chartSeries"]) == len(yahoo_rows)


def test_yahoo_fallback_does_not_extend_a_naver_cache(isolated_details, monkeypatch):
    # 직전 detail 이 네이버 봉이면, 야후 폴백은 그 꼬리에 1년치를 잇지 않고 전체를 받는다.
    full = _fixture_rows()
    long_cache = _bars(1, 28, 250000.0, "2026-07") + _bars(1, 28, 250000.0, "2026-08") + full
    detail = {"barsSource": "naver", "historySource": "yahoo",
              "chartSeries": [[r["open"], r["high"], r["low"], r["close"], r["volume"], r["date"]]
                              for r in long_cache]}
    (isolated_details / "005930.json").write_text(json.dumps(detail), encoding="utf-8")
    ranges = []

    def yahoo(ysym, range_="5y"):
        ranges.append(range_)
        return _bars(1, 20, 2.0, "2026-08") + list(full), []

    def boom(code, start, end, retries=3):
        raise RuntimeError("naver down")
    monkeypatch.setattr(K, "fetch_naver_daily", boom)
    monkeypatch.setattr(K, "fetch_yahoo_history_kr", yahoo)
    stock, _ = K.build_one(_meta())
    assert ranges == ["5y"]
    assert stock["barsSource"] == "yahoo"


def test_cache_carry_keeps_the_cached_source(isolated_details, monkeypatch):
    full = _bars(1, 25, 250000.0, "2026-08") + _fixture_rows()
    detail = {"barsSource": "naver", "historySource": "yahoo",
              "chartSeries": [[r["open"], r["high"], r["low"], r["close"], r["volume"], r["date"]] for r in full]}
    (isolated_details / "005930.json").write_text(json.dumps(detail), encoding="utf-8")
    meta = {**_meta(), "preferHistory": False}
    stock, _ = K.build_one(meta)
    assert stock["historySource"] == "yahoo-cache"
    assert stock["barsSource"] == "naver"


def test_old_detail_without_bars_source_counts_as_yahoo(isolated_details):
    rows = _bars(1, 25, 250000.0, "2026-08") + _fixture_rows()
    detail = {"historySource": "yahoo",
              "chartSeries": [[r["open"], r["high"], r["low"], r["close"], r["volume"], r["date"]] for r in rows]}
    (isolated_details / "000660.json").write_text(json.dumps(detail), encoding="utf-8")
    assert K.load_cached_history("000660") is not None
    assert K._CACHED_BARS_SOURCE["000660"] == "yahoo"


def test_bars_source_goes_to_detail_not_light_snapshot():
    stock = {"ticker": "005930", "company": "삼성전자", "historySource": "yahoo", "barsSource": "naver",
             "chartSeries": [[1, 1, 1, 1, 1, "2026-09-30"]], "closeSeries": [1, 1]}
    light, details = K.split_snapshot_details({"stocks": [stock]})
    assert details["005930"]["barsSource"] == "naver"
    assert "barsSource" not in light["stocks"][0]
