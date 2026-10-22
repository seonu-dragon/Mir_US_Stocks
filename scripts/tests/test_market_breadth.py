"""시장 폭 추이(build_market_breadth.py) 테스트 — 합성 일봉으로 이평·52주·집계·맥클렐런을 확인한다(네트워크 없음)."""
from datetime import date, timedelta

import build_market_breadth as B


def _closes(values, start=date(2025, 1, 1)):
    return [((start + timedelta(days=i)).isoformat(), float(v)) for i, v in enumerate(values)]


def test_stock_flags_moving_averages_and_52w():
    rising = _closes(range(1, 301))            # 매일 오르는 종목
    f = B.stock_flags(rising)
    last = f[rising[-1][0]]
    assert last[0] is True and last[1] is True and last[2] == 1 and last[3] is True and last[4] is False
    assert f[rising[48][0]][0] is None          # 49봉째까지는 50일선 없음
    assert f[rising[198][0]][1] is None
    assert f[rising[0][0]][2] is None           # 첫 봉은 전일 대비 없음
    flat = B.stock_flags(_closes([10] * 300))
    assert flat[_closes([10] * 300)[-1][0]] == (False, False, 0, False, False)


def test_closes_of_skips_bad_bars_and_sorts():
    detail = {"chartSeries": [[1, 1, 1, 5, 0, "2026-10-02"], [1, 1, 1, 0, 0, "2026-10-03"], [1, 1, 1, 4, 0, "2026-10-01"], "x", [1, 2]]}
    assert B.closes_of(detail) == [("2026-10-01", 4.0), ("2026-10-02", 5.0)]


def test_aggregate_counts_coverage_and_adline():
    up = _closes(range(1, 101))
    down = _closes(range(200, 100, -1))
    partial = _closes(range(1, 101))[-5:]       # 마지막 5일만 있는 종목 — 분모·커버리지에만 영향
    rows = B.aggregate([B.stock_flags(up), B.stock_flags(down), B.stock_flags(partial)])
    last = rows[-1]
    assert last["n"] == 3 and last["adv"] == 2 and last["dec"] == 1
    assert last["above50"] == 50.0               # up 위, down 아래(partial 은 이평 없음)
    assert rows[1]["adLine"] - rows[0]["adLine"] == rows[1]["adv"] - rows[1]["dec"]
    assert rows[38]["mcclellan"] is None and rows[39]["mcclellan"] is not None


def test_aggregate_drops_low_coverage_days():
    a = _closes(range(1, 80))
    b = _closes(range(1, 80))
    c = _closes(range(1, 80))
    holiday_like = _closes(range(1, 81))[-1:]   # 79번째 날짜에 한 종목만 봉이 있다
    b = b[:-1]
    c = c[:-1]
    rows = B.aggregate([B.stock_flags(x) for x in (a, b, c)])
    assert rows[-1]["d"] == a[-2][0]             # 한 종목만 있는 마지막 날(33%)은 버린다
    assert holiday_like


def test_common_stock_filter():
    assert B.is_common_stock("us", {"bucket": "gte10b"}) and not B.is_common_stock("us", {"bucket": "all_misc"})
    assert B.is_common_stock("kr", {"market": "kospi"}) and not B.is_common_stock("kr", {"market": "etf"})
