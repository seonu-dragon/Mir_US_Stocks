"""가격 데이터 품질 회귀 테스트(2026-10-21, PR #335 감사 후속).

1. 국내 details 의 오염된 마지막 봉(종가가 그 봉 고가·저가 밖) — 2026-10-21 실측 3,795개 중 369개, 전부
   yahoo-cache·barsSource=yahoo, 마지막 봉 09-11 이 227개. KR load_cached_history 도 US 와 같이 그 봉을 버리고,
   기준일(quoteDate)보다 앞선 묵은 봉의 종가는 make_stock 이 덮지 않으며, 묵은 캐시는 다시 수집 대상에 오른다.
2. 분할·병합 미반영 등락률 가드 — AMTD +4,875.9%(거래량비 0.1) 같은 값을 changePctSuspect 로 표시하고
   섹터 집계(build_summary)에서 뺀다. 값 자체는 바꾸지 않는다(지어내지 않음).
네트워크는 쓰지 않는다.
"""
from __future__ import annotations

import json
from datetime import date, timedelta

import pytest

import update_data as UD
import update_korea_data as K


@pytest.fixture
def kr_details(tmp_path, monkeypatch):
    monkeypatch.setattr(K, "DETAILS_DIR", tmp_path)
    monkeypatch.setattr(K, "fetch_naver_news", lambda code, limit=8: [])
    monkeypatch.setattr(UD, "fetch_news", lambda symbol: [])
    K._CACHED_BARS_SOURCE.clear()
    return tmp_path


def _series(n=40, last="2026-09-10"):
    end = date.fromisoformat(last)
    return [[12000.0, 12390.0, 11520.0, 11740.0, 594267, (end - timedelta(days=n - 1 - i)).isoformat()] for i in range(n)]


def _write(dirpath, code, detail):
    (dirpath / f"{code}.json").write_text(json.dumps(detail), encoding="utf-8")


# ---- 1. KR 오염 봉 ----

def test_kr_cached_history_drops_corrupted_last_bar(kr_details):
    # 002710 라이브 실측 형태: 09-11 봉 고 12,100 · 저 11,660 인데 종가 14,610.
    series = _series() + [[12000.0, 12100.0, 11660.0, 14610.0, 256995, "2026-09-11"]]
    _write(kr_details, "002710", {"historySource": "yahoo-cache", "barsSource": "yahoo", "chartSeries": series})
    rows, _divs = K.load_cached_history("002710")
    assert rows[-1]["date"] == "2026-09-10" and rows[-1]["close"] == 11740.0
    assert len(rows) == 40


def test_kr_cached_history_keeps_clean_last_bar(kr_details):
    series = _series() + [[12000.0, 12100.0, 11660.0, 11900.0, 256995, "2026-09-11"]]
    _write(kr_details, "005930", {"historySource": "yahoo", "barsSource": "naver", "chartSeries": series})
    rows, _divs = K.load_cached_history("005930")
    assert rows[-1]["date"] == "2026-09-11" and rows[-1]["close"] == 11900.0


def test_kr_drop_keeps_foreign_retention_aligned_to_chart_tail(kr_details):
    # foreignRetention = chartSeries 마지막 len 개 봉과 같은 순서. 마지막 봉을 버린 뒤에도 날짜로 다시 맞춰져야 한다.
    series = _series(n=40) + [[12000.0, 12100.0, 11660.0, 14610.0, 1000, "2026-09-11"]]
    foreign = [30.0, 30.5, 31.0, 31.5, 99.0]
    _write(kr_details, "000140", {"historySource": "yahoo-cache", "barsSource": "yahoo",
                                  "chartSeries": series, "foreignRetention": foreign})
    rows, _divs = K.load_cached_history("000140")
    assert rows[-1]["date"] == "2026-09-10"
    chart = [[r["open"], r["high"], r["low"], r["close"], r["volume"], r["date"]] for r in rows]
    aligned = K.foreign_retention_series(rows, chart)
    assert aligned == [30.0, 30.5, 31.0, 31.5]  # 버린 09-11 의 99.0 은 남지 않고, 나머지는 같은 날짜에 그대로
    assert len(aligned) <= len(chart)


def test_kr_build_one_does_not_overwrite_stale_cached_bar_when_volume_zero(kr_details):
    """개장 전(거래량 0) 실행: priceDate 가 안 넘어가도 기준일(quoteDate)보다 앞선 묵은 봉 종가는 덮지 않는다."""
    _write(kr_details, "002710", {"historySource": "yahoo-cache", "barsSource": "yahoo", "chartSeries": _series()})
    meta = {
        "symbol": "002710", "yahooSymbol": "002710.KS", "company": "테스트", "market": "kospi",
        "quotePrice": 9000.0, "quoteChangePct": -0.5, "quoteVolume": 0, "quoteDate": "2026-10-21",
        "marketCapT": 0.2, "groups": {"idx_kospi", "all_kr"}, "sector": "소재", "industry": "화학",
        "preferHistory": False, "preferFundamentals": False,
    }
    stock, _err = K.build_one(meta)
    last = stock["chartSeries"][-1]
    assert last[5] == "2026-09-10" and last[3] == 11740.0   # 묵은 봉 종가 그대로
    assert stock["price"] == 9000.0                          # 현재가는 그대로 발행


def test_make_stock_same_day_bar_still_takes_quote_price_with_quote_date():
    rows = [{"date": (date(2026, 10, 21) - timedelta(days=39 - i)).isoformat(), "open": 100.0, "high": 101.0,
             "low": 99.0, "close": 100.0, "volume": 1000} for i in range(40)]
    meta = {"symbol": "T", "company": "T", "industry": "x", "sector": "x", "groups": set(), "quotePrice": 100.5,
            "marketCapB": 1.0, "historySource": "yahoo", "quoteDate": "2026-10-21"}
    assert UD.make_stock(meta, rows)["chartSeries"][-1][3] == 100.5


def test_stale_cache_refresh_picks_oldest_yahoo_cache_first():
    today = date(2026, 10, 21)
    last = {"A": "2026-09-11", "B": "2026-09-23", "C": "2026-10-20", "D": "2026-09-11", "E": None}
    prev = [{"ticker": t, "historySource": "yahoo-cache", "marketCapT": cap}
            for t, cap in (("A", 0.1), ("B", 0.5), ("C", 1.0), ("D", 0.3), ("E", 0.2))]
    prev.append({"ticker": "F", "historySource": "yahoo", "marketCapT": 9.0})
    metas = [{"symbol": t} for t in "ABCDEF"]
    got = K.stale_cache_refresh_symbols(metas, prev, 2, today=today, last_bar_fn=last.get)
    assert got == {"A", "D"}                         # 가장 오래된 09-11 둘(같은 날이면 시총 큰 순)
    got = K.stale_cache_refresh_symbols(metas, prev, 10, today=today, last_bar_fn=last.get)
    assert got == {"A", "B", "D"}                    # 최근 봉(C)·날짜 모름(E)·실측 수집(F)은 제외
    assert K.stale_cache_refresh_symbols(metas, prev, 0, today=today, last_bar_fn=last.get) == set()


def test_stale_cache_refresh_reads_last_bar_from_detail(kr_details):
    _write(kr_details, "000140", {"historySource": "yahoo-cache", "chartSeries": _series(last="2026-09-11")})
    assert K._cached_last_bar_date("000140") == "2026-09-11"
    assert K._cached_last_bar_date("999999") is None


# ---- 2. 비정상 등락률 가드 ----

def _stock(**over):
    s = {"ticker": "AMTD", "sector": "FINANCIAL", "changePct": 4875.9, "volumeRatio": 0.1,
         "priceDate": "2026-10-20", "splits": [["2022-11-22", 1.0, 2.0], ["2023-11-17", 1.0, 3.0]]}
    s.update(over)
    return s


def test_flag_implausible_change_without_volume_evidence():
    s = _stock()
    assert UD.flag_implausible_change(s) == "noVolume"
    assert s["changePctSuspect"] == "noVolume" and s["changePct"] == 4875.9  # 값은 그대로(지어내지 않음)


def test_flag_implausible_change_recent_split_is_suspect_even_with_volume():
    s = _stock(volumeRatio=12.0, splits=[["2026-10-16", 1.0, 25.0]])
    assert UD.flag_implausible_change(s) == "split"


def test_volume_backed_big_move_is_trusted():
    s = _stock(changePct=420.0, volumeRatio=35.0)
    assert UD.flag_implausible_change(s) is None and "changePctSuspect" not in s


@pytest.mark.parametrize("chg", [300.0, -95.0, 12.3, None])
def test_normal_moves_are_not_flagged(chg):
    s = _stock(changePct=chg)
    assert UD.flag_implausible_change(s) is None and "changePctSuspect" not in s


def test_build_summary_excludes_suspect_from_sector_ranking():
    stocks = [
        {"ticker": "A", "sector": "FINANCIAL", "changePct": -1.0, "monthChangePct": 0},
        {"ticker": "AMTD", "sector": "FINANCIAL", "changePct": 4875.9, "monthChangePct": 0, "changePctSuspect": "noVolume"},
        {"ticker": "B", "sector": "TECHNOLOGY", "changePct": 1.0, "monthChangePct": 0},
    ]
    summary = UD.build_summary(stocks)
    assert summary["strongSector"] == "TECHNOLOGY" and summary["weakSector"] == "FINANCIAL"
