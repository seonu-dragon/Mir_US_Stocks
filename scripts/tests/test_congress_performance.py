"""의원 매매 성과(체결일·공시일 진입 SPY 대비 초과수익) 단위 테스트. 네트워크 없음."""
from __future__ import annotations

from datetime import date, timedelta

import congress_performance as CP


def _series(start: date, days: int, f):
    return [(start + timedelta(days=i), float(f(i))) for i in range(days)]


START = date(2025, 1, 1)
TODAY = date(2026, 6, 1)
FLAT = _series(START, 600, lambda i: 100)            # SPY 보합
UP = _series(START, 600, lambda i: 100 + i * 0.1)    # 365일에 +36.5%


def test_buy_excess_vs_flat_bench_one_year_horizon():
    ex = CP.trade_excess(UP, FLAT, date(2025, 1, 1), "buy", TODAY)
    assert abs(ex - 36.5) < 1e-9


def test_sell_excess_is_inverse():
    ex = CP.trade_excess(UP, FLAT, date(2025, 1, 1), "sell", TODAY)
    assert abs(ex + 36.5) < 1e-9


def test_short_hold_not_measured_and_future_skipped():
    last = UP[-1][0]
    assert CP.trade_excess(UP, FLAT, last - timedelta(days=10), "buy", TODAY) is None
    assert CP.trade_excess(UP, FLAT, TODAY + timedelta(days=1), "buy", TODAY) is None


def test_weekend_entry_uses_next_close_and_clip():
    s = [(date(2025, 1, 6), 10.0), (date(2025, 6, 6), 1000.0)]
    b = [(date(2025, 1, 6), 100.0), (date(2025, 6, 6), 100.0)]
    assert CP.trade_excess(s, b, date(2025, 1, 4), "buy", TODAY) == CP.CLIP_PCT


def test_members_need_min_trades_and_disclosure_entry():
    trades = []
    for i in range(CP.MIN_TRADES):
        d = START + timedelta(days=i)
        trades.append({"politician": "A", "ticker": "UP", "side": "buy",
                       "transactionDate": d.isoformat(),
                       "disclosureDate": (d + timedelta(days=30)).strftime("%m/%d/%Y")})
    trades.append({"politician": "B", "ticker": "UP", "side": "buy", "transactionDate": "2025-01-02"})
    perf = CP.compute_performance(trades, {"UP": UP, "SPY": FLAT}, today=TODAY)
    assert [m["name"] for m in perf["members"]] == ["A"]
    a = perf["members"][0]
    assert a["tx"]["n"] == CP.MIN_TRADES and a["tx"]["winRate"] == 100.0
    assert a["disc"]["n"] == CP.MIN_TRADES and a["lagDays"] == 30
    assert a["buyAvgExcess"] == a["tx"]["avgExcess"]
    assert perf["benchmark"] == "SPY" and perf["minTrades"] == CP.MIN_TRADES


def test_window_drops_old_future_and_exchange():
    rows = [
        {"transactionDate": "2020-01-01", "side": "buy"},
        {"transactionDate": "2026-12-26", "side": "buy"},   # 실데이터에 있는 미래 날짜(파싱 오류)
        {"transactionDate": "2026-01-01", "side": "exchange"},
        {"transactionDate": "2026-01-01", "side": "sell"},
    ]
    assert len(CP.trades_in_window(rows, today=TODAY)) == 1


def test_same_day_disclosure_treated_as_unknown():
    trades = [{"politician": "A", "ticker": "UP", "side": "buy",
               "transactionDate": (START + timedelta(days=i)).isoformat(),
               "disclosureDate": (START + timedelta(days=i)).isoformat()} for i in range(CP.MIN_TRADES)]
    a = CP.compute_performance(trades, {"UP": UP, "SPY": FLAT}, today=TODAY)["members"][0]
    assert "disc" not in a and "lagDays" not in a
