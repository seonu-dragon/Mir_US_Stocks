"""build_yield_curve.py — FRED 하루 지연을 재무부 당일 고시로 메우는 변환(네트워크 없음).

실행: py -m pytest -q scripts/tests/test_yield_curve.py
"""
from __future__ import annotations

import build_yield_curve as y

HEADER = ["observation_date", "DGS3MO", "DGS2", "DGS10"]
TREASURY = [
    ["Date", '"1 Mo"', '"3 Mo"', '"2 Yr"', '"10 Yr"'],
    ["09/30/2026", "4.02", "4.20", "4.88", "5.29"],
    ["09/29/2026", "4.04", "4.25", "4.89", "5.26"],
    ["09/28/2026", "4.04", "4.28", "4.92", "5.24"],
]


def test_only_rows_after_fred_last_date_in_fred_order():
    rows = y.treasury_rows_as_fred(HEADER, TREASURY, "2026-09-29")
    assert rows == [["2026-09-30", "4.20", "4.88", "5.29"]]


def test_missing_column_becomes_fred_missing_marker():
    rows = y.treasury_rows_as_fred(["observation_date", "DGS20", "DGS10"], TREASURY, "2026-09-28")
    assert rows == [["2026-09-29", ".", "5.26"], ["2026-09-30", ".", "5.29"]]


def test_empty_or_header_only_is_noop():
    assert y.treasury_rows_as_fred(HEADER, [], "2026-09-29") == []
    assert y.treasury_rows_as_fred(HEADER, TREASURY[:1], "2026-09-29") == []
