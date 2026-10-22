"""build_earnings_calendar.py — 지난 '다음 실적' 날짜 제거(네트워크 없음)."""
from datetime import date

import build_earnings_calendar as E


def test_drop_past_removes_past_and_malformed_dates():
    rows = [{"ticker": "UL", "nextDate": "2026-07-28"}, {"ticker": "JNJ", "nextDate": "2026-10-13"},
            {"ticker": "AAPL", "nextDate": "2026-10-23"}, {"ticker": "NVDA", "nextDate": "2026-11-19"},
            {"ticker": "BAD", "nextDate": "soon"}, {"ticker": "NONE", "nextDate": None}]
    out = E.drop_past(rows, date(2026, 10, 23))
    assert [r["ticker"] for r in out] == ["AAPL", "NVDA"]       # 오늘은 남긴다


def test_build_drops_past_rows(monkeypatch):
    monkeypatch.setattr(E, "load_tickers", lambda market, limit: ["UL", "MSFT"])
    fake = {"UL": {"ticker": "UL", "nextDate": "2026-07-28", "epsEstimate": None},
            "MSFT": {"ticker": "MSFT", "nextDate": "2026-10-28", "epsEstimate": 3.1}}
    monkeypatch.setattr(E, "fetch_next_earnings", lambda t, m: fake[t])
    p = E.build("us", 2, today=date(2026, 10, 23))
    assert p["count"] == 1 and p["earnings"][0]["ticker"] == "MSFT"
