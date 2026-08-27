"""정직성 게이트: 이력 대상 축소 vs 실제 야후 스로틀."""

from __future__ import annotations

import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from update_data import (  # noqa: E402
    enforce_history_honesty_gate,
    history_honesty_counts,
)


def _yahoo(ticker: str) -> dict:
    return {"ticker": ticker, "historySource": "yahoo", "chartSeries": [[1]]}


def _snapshot(ticker: str) -> dict:
    return {"ticker": ticker, "historySource": "snapshot", "chartSeries": [[1]]}


def test_universe_shrink_does_not_abort():
    """2026-08-24~26 KR: preferHistory 3434→2226, 전체 실측 3047 vs 오늘 1842.

    빠진 1200종목은 오늘 대상이 아니므로 게이트가 막으면 안 된다.
    """
    prefer = [f"P{i:04d}" for i in range(2226)]
    fresh = [_yahoo(t) for t in prefer[:1842]] + [_snapshot(t) for t in prefer[1842:]]
    prev = [_yahoo(t) for t in prefer[:1842]] + [_yahoo(f"OLD{i}") for i in range(1205)]
    counts = history_honesty_counts(fresh, prefer, prev)
    assert counts["fresh_real"] == 1842
    assert counts["prev_in_scope"] == 1842
    assert counts["prev_real_all"] == 3047
    enforce_history_honesty_gate(fresh, prefer, prev)


def test_same_universe_throttle_aborts():
    prefer = [f"T{i:04d}" for i in range(200)]
    fresh = [_yahoo(t) for t in prefer[:100]] + [_snapshot(t) for t in prefer[100:]]
    prev = [_yahoo(t) for t in prefer]
    counts = history_honesty_counts(fresh, prefer, prev)
    assert counts["fresh_real"] == 100
    assert counts["prev_in_scope"] == 200
    try:
        enforce_history_honesty_gate(fresh, prefer, prev)
    except SystemExit as exc:
        assert "직전 동일대상 200" in str(exc)
    else:
        raise AssertionError("throttle should abort")


def test_new_tickers_without_yahoo_do_not_abort():
    prefer = [f"OLD{i:03d}" for i in range(150)] + [f"NEW{i:03d}" for i in range(50)]
    fresh = [_yahoo(t) for t in prefer[:150]] + [_snapshot(t) for t in prefer[150:]]
    prev = [_yahoo(t) for t in prefer[:150]]
    counts = history_honesty_counts(fresh, prefer, prev)
    assert counts["fresh_real"] == 150
    assert counts["prev_in_scope"] == 150
    enforce_history_honesty_gate(fresh, prefer, prev)


def test_empty_previous_does_not_abort():
    prefer = [f"T{i:03d}" for i in range(50)]
    fresh = [_yahoo(t) for t in prefer]
    enforce_history_honesty_gate(fresh, prefer, [])


if __name__ == "__main__":
    test_universe_shrink_does_not_abort()
    test_same_universe_throttle_aborts()
    test_new_tickers_without_yahoo_do_not_abort()
    test_empty_previous_does_not_abort()
    print("ok")
