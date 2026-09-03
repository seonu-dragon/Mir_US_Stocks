"""국내 상세의 차트 결측 회귀 테스트 (2026-09-03).

증상: `data/korea/details/*.json` 3,774개 중 1,322개(35%)의 `chartSeries` 가 비어
분석 화면이 통째로 "데이터 부족" 으로 떨어졌다.

원인(git 이력으로 확인): `make_stock` 이 `chartSeries` 를 `preferHistory` 로 갈랐다.
  - 종목이 preferHistory 에서 하루라도 빠지면(공시 7일 창이 이동하면 매일 수백 개가
    빠진다) 캐시로 되살린 **실측 rows 가 있어도** chartSeries 를 쓰지 않았다.
    → 다음 실행의 `load_cached_history` 가 빈손 → historySource 가
      yahoo → yahoo-cache → snapshot 으로 2회 만에 영구 강등.
    실제 000020: 08-22 yahoo(1,226봉) → 08-27 yahoo-cache(0봉) → 08-27 snapshot(0봉).
  - 반대로 preferHistory 인데 fetch·캐시 모두 실패한 종목은 **합성 랜덤워크 OHLC** 를
    차트로 발행했다(KR 390 종목).

수정: 실측(yahoo/yahoo-cache)일 때만 chartSeries 를 쓰고, 아니면 빈 배열 +
`chartUnavailableReason` 으로 사유를 밝힌다. 아래 테스트가 두 방향을 모두 고정한다.
"""
from __future__ import annotations

import json

import pytest

import update_data as UD
import update_korea_data as K


def _rows(n=40, close=1000.0):
    return [
        {
            "date": f"2026-01-{(i % 28) + 1:02d}",
            "open": close, "high": close * 1.01, "low": close * 0.99,
            "close": close, "volume": 1000 + i,
        }
        for i in range(n)
    ]


def _meta(**over):
    meta = {
        "symbol": "000020",
        "company": "테스트전자",
        "industry": "반도체",
        "sector": "기술",
        "groups": set(),
        "quotePrice": 1000.0,
        "marketCapB": 1.0,
    }
    meta.update(over)
    return meta


# --------------------------------------------------------------------------
# make_stock 의 chartSeries 정책
# --------------------------------------------------------------------------

def test_real_history_publishes_chart_series():
    stock = UD.make_stock(_meta(historySource="yahoo", preferHistory=True), _rows())
    assert len(stock["chartSeries"]) == 40
    assert "chartUnavailableReason" not in stock


def test_cached_real_history_survives_leaving_prefer_history():
    """핵심 회귀: preferHistory 에서 빠져도 실측 캐시는 계속 발행된다.

    이 한 줄이 없어서 1,322 종목이 차트를 영구히 잃었다.
    """
    meta = _meta(historySource="yahoo-cache", preferHistory=False)
    stock = UD.make_stock(meta, _rows())
    assert len(stock["chartSeries"]) == 40, "실측 캐시를 버리면 다음 실행에 영구 강등된다"
    assert "chartUnavailableReason" not in stock


def test_synthetic_history_is_never_published_as_a_chart():
    """fetch 도 캐시도 실패한 preferHistory 종목: 가짜 캔들 대신 빈 배열 + 사유."""
    stock = UD.make_stock(_meta(historySource="snapshot", preferHistory=True), _rows())
    assert stock["chartSeries"] == []
    assert stock["chartUnavailableReason"] == UD.CHART_UNAVAILABLE_FETCH_FAILED


def test_untargeted_ticker_says_why_it_has_no_chart():
    stock = UD.make_stock(_meta(historySource="snapshot", preferHistory=False), _rows())
    assert stock["chartSeries"] == []
    assert stock["chartUnavailableReason"] == UD.CHART_UNAVAILABLE_NOT_TARGETED
    # UI 가 그대로 보여줄 수 있는 한국어 사유여야 한다.
    assert "야후" in stock["chartUnavailableReason"]


def test_light_snapshot_still_carries_close_series():
    """차트가 없어도 히트맵용 closeSeries 는 남는다(기능 전체가 꺼지지 않게)."""
    stock = UD.make_stock(_meta(historySource="snapshot", preferHistory=False), _rows())
    assert stock["closeSeries"]
    assert stock["rsi14"] is None       # 합성 이력에 RSI 를 붙이지 않는 기존 정책 유지


def test_dividends_ride_along_only_with_real_history():
    real = UD.make_stock(
        _meta(historySource="yahoo", preferHistory=True, dividends=[["2026-01-02", 0.5]]),
        _rows(),
    )
    assert real["dividends"] == [["2026-01-02", 0.5]]
    fake = UD.make_stock(
        _meta(historySource="snapshot", preferHistory=True, dividends=[["2026-01-02", 0.5]]),
        _rows(),
    )
    assert "dividends" not in fake


# --------------------------------------------------------------------------
# 캐시 왕복 — 발행한 detail 이 다음 실행에서 실제로 되살아나는가
# --------------------------------------------------------------------------

def test_published_detail_round_trips_through_load_cached_history(tmp_path, monkeypatch):
    stock = UD.make_stock(_meta(historySource="yahoo", preferHistory=True), _rows(60))
    payload = {"stocks": [dict(stock, ticker="000020", company="테스트전자",
                               historySource="yahoo", yahooSymbol="000020.KS")]}
    light, details = K.split_snapshot_details(payload)

    monkeypatch.setattr(K, "DETAILS_DIR", tmp_path)
    (tmp_path / "000020.json").write_text(
        json.dumps(details["000020"], ensure_ascii=False), encoding="utf-8"
    )
    restored = K.load_cached_history("000020")
    assert restored is not None, "직전 발행분에서 실측 이력을 되살리지 못했다"
    rows, _divs = restored
    assert len(rows) == 60


def test_empty_chart_detail_does_not_round_trip(tmp_path, monkeypatch):
    """빈 차트는 캐시로 재사용되지 않는다(합성이 캐시를 타고 영속하면 안 된다)."""
    monkeypatch.setattr(K, "DETAILS_DIR", tmp_path)
    (tmp_path / "000020.json").write_text(
        json.dumps({"historySource": "snapshot", "chartSeries": []}), encoding="utf-8"
    )
    assert K.load_cached_history("000020") is None


# --------------------------------------------------------------------------
# split_snapshot_details
# --------------------------------------------------------------------------

def _payload(stock):
    return {"stocks": [dict(stock, ticker="000020", company="테스트전자")]}


def test_reason_is_carried_into_the_detail_file():
    stock = UD.make_stock(_meta(historySource="snapshot", preferHistory=False), _rows())
    stock["fundamentals"] = {"pe": 10}
    light, details = K.split_snapshot_details(_payload(stock))
    detail = details["000020"]
    assert detail["chartSeries"] == []
    assert detail["chartUnavailableReason"] == UD.CHART_UNAVAILABLE_NOT_TARGETED
    assert detail["historySource"] == "snapshot"


def test_light_snapshot_drops_both_heavy_and_reason_keys():
    stock = UD.make_stock(_meta(historySource="snapshot", preferHistory=False), _rows())
    stock["fundamentals"] = {"pe": 10}
    light, _details = K.split_snapshot_details(_payload(stock))
    keys = light["stocks"][0].keys()
    assert "chartSeries" not in keys
    assert "chartUnavailableReason" not in keys
    assert "fundamentals" not in keys
    assert "closeSeries" in keys


def test_a_stock_with_only_an_empty_chart_gets_no_detail_file():
    """빈 배열 하나 때문에 3,774개 detail 파일을 새로 만들지 않는다(배포 용량)."""
    stock = UD.make_stock(_meta(historySource="snapshot", preferHistory=False), _rows())
    _light, details = K.split_snapshot_details(_payload(stock))
    assert details == {}


def test_us_split_behaves_the_same():
    stock = UD.make_stock(_meta(symbol="AAPL", historySource="snapshot"), _rows())
    stock["fundamentals"] = {"pe": 30}
    _light, details = UD.split_snapshot_details(
        {"stocks": [dict(stock, ticker="AAPL", company="Apple")]}
    )
    assert details["AAPL"]["chartSeries"] == []
    assert details["AAPL"]["chartUnavailableReason"]


# --------------------------------------------------------------------------
# 정직성 집계
# --------------------------------------------------------------------------

def test_empty_chart_is_not_counted_as_fabricated():
    """'없다고 밝힌 것' 은 지어낸 수치가 아니다."""
    stocks = [
        {"ticker": "A", "historySource": "yahoo", "chartSeries": [[1]]},
        {"ticker": "B", "historySource": "snapshot", "chartSeries": []},
        {"ticker": "C", "historySource": "snapshot", "chartSeries": [[1]]},  # 진짜 합성 발행
    ]
    counts = UD.history_honesty_counts(stocks, ["A", "B", "C"], [])
    assert counts["fabricated"] == 1
    assert counts["no_chart"] == 1
    assert counts["total"] == 3


def test_no_chart_ratio_is_countable_for_the_freshness_gate():
    stocks = [{"ticker": str(i), "historySource": "snapshot", "chartSeries": []} for i in range(7)]
    stocks += [{"ticker": f"y{i}", "historySource": "yahoo", "chartSeries": [[1]]} for i in range(3)]
    counts = UD.history_honesty_counts(stocks, [], [])
    assert counts["no_chart"] / counts["total"] == pytest.approx(0.7)


# --------------------------------------------------------------------------
# 백필 쿼터 — 남은 결측을 매 실행 조금씩 메운다
# --------------------------------------------------------------------------

def _metas(n):
    return [{"symbol": f"{i:06d}", "marketCapT": float(n - i)} for i in range(n)]


def test_backfill_picks_missing_tickers_by_market_cap():
    metas = _metas(10)
    prev = [{"ticker": "000000", "historySource": "yahoo"}]
    picked = K.history_backfill_symbols(metas, prev, quota=3)
    assert picked == {"000001", "000002", "000003"}   # 시총 큰 순, 실측 보유분 제외


def test_backfill_respects_the_quota():
    picked = K.history_backfill_symbols(_metas(100), [], quota=25)
    assert len(picked) == 25


def test_backfill_can_be_switched_off():
    assert K.history_backfill_symbols(_metas(10), [], quota=0) == set()


def test_backfill_skips_tickers_that_already_have_real_history():
    metas = _metas(5)
    prev = [
        {"ticker": "000000", "historySource": "yahoo"},
        {"ticker": "000001", "historySource": "yahoo-cache"},
        {"ticker": "000002", "historySource": "snapshot"},   # 실측 아님 → 대상
    ]
    picked = K.history_backfill_symbols(metas, prev, quota=10)
    assert "000000" not in picked and "000001" not in picked
    assert "000002" in picked
