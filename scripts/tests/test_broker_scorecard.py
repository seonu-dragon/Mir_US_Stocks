"""build_broker_scorecard.py — 네트워크·파일 없이 초과수익·표본 규칙만 본다."""
from __future__ import annotations

from datetime import date, timedelta

import build_broker_scorecard as B


def _series(start: str, closes):
    d0 = date.fromisoformat(start)
    dates, out = [], []
    d = d0
    for c in closes:
        while d.weekday() >= 5:
            d += timedelta(days=1)
        dates.append(d.isoformat())
        out.append(float(c))
        d += timedelta(days=1)
    return dates, out


def test_series_from_bars_sorts_and_skips_bad():
    dates, closes = B.series_from_bars([[1, 1, 1, 10, 0, "2026-01-05"], [1, 1, 1, 9, 0, "2026-01-02"], [1, 1, 1, 0, 0, "2026-01-06"], "x"])
    assert dates == ["2026-01-02", "2026-01-05"] and closes == [9.0, 10.0]


def test_forward_return_uses_next_trading_day_and_requires_elapsed_horizon():
    s = _series("2026-01-05", range(100, 130))       # 30 거래일
    r, d0, d1 = B.forward_return(s[0], s[1], "2026-01-04", 20)   # 일요일 → 월요일 봉부터
    assert d0 == "2026-01-05" and abs(r - (120 / 100 - 1)) < 1e-9
    assert B.forward_return(s[0], s[1], s[0][15], 20) is None    # 기간 미경과
    assert B.forward_return(s[0], s[1], "2025-12-01", 5) is None  # 기준 봉이 너무 멀다(상장 전)


def test_excess_return_subtracts_bench_over_same_dates():
    stock = _series("2026-01-05", [100] + [110] * 25)
    bench = _series("2026-01-05", [200] + [210] * 25)
    x = B.excess_return(stock, bench, "2026-01-05", 20)
    assert abs(x - (10.0 - 5.0)) < 1e-9


def test_summarize_min_n():
    assert B.summarize([1.0] * 5, min_n=20) == [5]
    out = B.summarize([1.0, -1.0, 3.0, 5.0], min_n=4)
    assert out == [4, 2.0, 2.0, 75.0]


def test_kinds():
    assert B.us_event_kinds("up", "Raises") == ["up", "ptUp"]
    assert B.us_event_kinds("main", "Lowers") == ["ptDown"]
    assert B.us_event_kinds("reit", "Maintains") == []
    assert B.kr_event_kind(120, 100) == "ptUp"
    assert B.kr_event_kind(80, 100) == "ptDown"
    assert B.kr_event_kind(100, 100) is None
    assert B.kr_event_kind(400, 100) is None   # 분할·병합 의심
    assert B.kr_event_kind(100, None) is None


def test_accumulator_dedupes_and_marks_short_samples():
    stock = _series("2026-01-05", range(100, 200))
    bench = _series("2026-01-05", [100] * 100)
    acc = B.Accumulator(("ptUp",), horizons=(5, 99), min_n=2)
    ev = [(stock[0][0], "A", "ptUp"), (stock[0][0], "A", "ptUp"), (stock[0][1], "A", "ptUp"), (stock[0][2], "B", "up")]
    acc.add(stock, bench, ev)
    firms = acc.firms()
    assert [f["f"] for f in firms] == ["A"]
    total, h5, hLong = firms[0]["k"]["ptUp"]
    assert total == 2 and h5[0] == 2 and len(h5) == 4 and h5[3] == 100.0
    assert hLong == [1], '99일 뒤 봉이 있는 건 첫 이벤트 하나 — 표본 부족'
    p = acc.payload("us", "src", "SPY", "2026-10-23 06:30 KST")
    assert p["count"] == 1 and p["events"] == 2 and p["minN"] == 2
