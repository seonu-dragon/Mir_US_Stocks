"""build_us_analyst_revisions.py — 네트워크 없이 야후 quoteSummary 응답 파서만 본다(모양은 2026-10-21 AAPL 실제 응답)."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import build_us_analyst_revisions as A  # noqa: E402


def _num(v):
    return {"raw": v, "fmt": str(v)}


RESULT = {
    "earningsTrend": {"trend": [
        {"period": "+1y", "endDate": "2027-09-30",
         "earningsEstimate": {"numberOfAnalysts": _num(40)},
         "epsTrend": {"current": _num(9.56345), "7daysAgo": _num(9.5831), "30daysAgo": _num(9.58154),
                      "60daysAgo": _num(9.53127), "90daysAgo": _num(9.7111)},
         "epsRevisions": {"upLast7days": _num(1), "upLast30days": _num(5), "downLast30days": _num(3),
                          "downLast7Days": _num(0), "downLast90days": {}}},
        {"period": "0q", "endDate": "2026-09-30",
         "earningsEstimate": {"numberOfAnalysts": _num(27)},
         "epsTrend": {"current": _num(1.97817), "7daysAgo": _num(1.97842), "30daysAgo": _num(1.97754),
                      "60daysAgo": _num(1.97656), "90daysAgo": _num(2.0179)},
         "epsRevisions": {"upLast7days": {"raw": 0, "fmt": None}, "upLast30days": _num(1),
                          "downLast30days": _num(1), "downLast7Days": _num(1)}},
        {"period": "-5y", "endDate": None, "epsTrend": {"current": _num(1)}},
        {"period": "0y", "endDate": "2026-09-30", "epsTrend": {}},
    ]},
    "upgradeDowngradeHistory": {"history": [
        {"epochGradeDate": 1791830866, "firm": "JP Morgan", "toGrade": "Overweight", "fromGrade": "Overweight",
         "action": "main", "priceTargetAction": "Raises", "currentPriceTarget": 360.0, "priorPriceTarget": 340.0},
        {"epochGradeDate": 1792489617, "firm": "Loop Capital", "toGrade": "Hold", "fromGrade": "Buy",
         "action": "down", "priceTargetAction": "Lowers", "currentPriceTarget": 330.0, "priorPriceTarget": 370.0},
        {"epochGradeDate": 1789048960, "firm": "Piper Sandler", "toGrade": "Overweight", "fromGrade": "",
         "action": "init", "priceTargetAction": "Announces", "currentPriceTarget": 300.0, "priorPriceTarget": 0.0},
        {"epochGradeDate": 1789048960, "firm": "", "action": "up"},
    ]},
}


def test_parse_estimates_orders_periods_and_skips_unknown():
    rows = A.parse_estimates(RESULT)
    assert [r[0] for r in rows] == ["0q", "+1y"]       # 현재값 없는 0y·알 수 없는 -5y 는 뺀다
    q = rows[0]
    assert q == ["0q", "2026-09-30", 1.9782, 1.9784, 1.9775, 1.9766, 2.0179, 0, 1, 1, 1, 27]
    y = rows[1]
    assert y[2] == 9.5634 and y[7:] == [1, 5, 0, 3, 40]
    assert A.parse_estimates({}) == []


def test_parse_ratings_latest_first_and_cleans_targets():
    rows = A.parse_ratings(RESULT, "AAPL")
    assert [r[2] for r in rows] == ["Loop Capital", "JP Morgan", "Piper Sandler"]   # 증권사 없는 행은 뺀다
    down = rows[0]
    assert down == ["AAPL", "2026-10-20", "Loop Capital", "down", "Buy", "Hold", 330.0, 370.0, "Lowers"]
    init = rows[2]
    assert init[7] is None          # 이전 목표가 0 은 '없음'
    assert len(rows[0]) == len(A.RATING_COLS)


def test_et_date_dst_boundaries():
    # 2026-10-21 03:00 UTC = 10-20 23:00 EDT
    assert A.et_date(1792551600) == "2026-10-20"
    # 2026-01-15 04:30 UTC = 01-14 23:30 EST
    assert A.et_date(1768451400) == "2026-01-14"
