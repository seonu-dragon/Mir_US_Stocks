"""미국 액면분할 일정(build_us_splits.py) 테스트. 오프라인."""
from datetime import date

import build_us_splits as sp


def test_parse_ratio_forward_reverse_and_junk():
    assert sp.parse_ratio("3 : 1") == (3.0, 1.0, 3.0)
    assert sp.parse_ratio("1:10")[2] == 0.1
    assert sp.parse_ratio("5-for-4")[2] == 1.25
    assert sp.parse_ratio("3:2")[2] == 1.5
    for bad in ("", None, "abc", "0:1", "1:1", "3 : "):
        assert sp.parse_ratio(bad) is None


def test_parse_rows_keeps_only_readable_rows():
    payload = {"data": {"rows": [
        {"symbol": "soxx", "name": " iShares SOX ", "ratio": "3:1", "executionDate": "11/05/2026"},
        {"symbol": "LU", "name": "Lufax", "ratio": "1 : 10", "executionDate": "10/23/2026"},
        {"symbol": "", "name": "x", "ratio": "2:1", "executionDate": "10/23/2026"},
        {"symbol": "BAD", "name": "x", "ratio": "?", "executionDate": "10/23/2026"},
        {"symbol": "BAD2", "name": "x", "ratio": "2:1", "executionDate": "2026-10-23"},
        "junk",
    ]}}
    rows = sp.parse_rows(payload)
    assert rows == [
        {"ticker": "SOXX", "name": "iShares SOX", "ratio": "3:1", "factor": 3.0, "kind": "forward", "date": "2026-11-05"},
        {"ticker": "LU", "name": "Lufax", "ratio": "1:10", "factor": 0.1, "kind": "reverse", "date": "2026-10-23"},
    ]
    assert sp.parse_rows({}) == [] and sp.parse_rows(None) == []


def test_merge_keeps_recent_past_and_lets_new_win():
    today = date(2026, 10, 22)
    prev = [
        {"ticker": "OLD", "date": "2026-07-01", "ratio": "2:1"},      # 60일 넘음 → 버림
        {"ticker": "PAST", "date": "2026-10-01", "ratio": "2:1"},     # 지난 일정 → 유지
        {"ticker": "SOXX", "date": "2026-11-05", "ratio": "2:1"},     # 새 응답이 덮음
        {"ticker": "", "date": "2026-11-05"},
    ]
    new = [{"ticker": "SOXX", "date": "2026-11-05", "ratio": "3:1"}, {"ticker": "LU", "date": "2026-10-23", "ratio": "1:10"}]
    rows = sp.merge(prev, new, today)
    assert [(r["ticker"], r["date"]) for r in rows] == [("PAST", "2026-10-01"), ("LU", "2026-10-23"), ("SOXX", "2026-11-05")]
    assert rows[-1]["ratio"] == "3:1"
