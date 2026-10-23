"""build_earnings_scoreboard 순수 함수 테스트. 네트워크 없음."""
from __future__ import annotations

from datetime import date

import build_earnings_scoreboard as B


def test_season_window():
    assert B.season_window(date(2026, 10, 23)) == ("2026년 3분기", date(2026, 10, 1), date(2026, 10, 23))
    assert B.season_window(date(2027, 2, 5)) == ("2026년 4분기", date(2027, 1, 1), date(2027, 2, 5))
    assert B.season_window(date(2026, 4, 1))[0] == "2026년 1분기"


def test_classify_and_surprise():
    assert B.classify(1.234, 1.231) == "inline"     # 센트 반올림 비교
    assert B.classify(1.25, 1.20) == "beat"
    assert B.classify(-0.3, -0.2) == "miss"
    assert B.classify(None, 1.0) is None
    assert B.surprise_pct(1.1, 1.0) == 10.0
    assert B.surprise_pct(-0.28, -0.35) == 20.0
    assert B.surprise_pct(0.5, 0.004) is None        # 0 근처 분모는 계산하지 않는다


def test_build_rows_filters_members_window_and_dedupes():
    members = {"AAA": {"sector": "TECHNOLOGY"}, "BF.B": {"sector": "CONSUMER DEFENSIVE"}}
    cal = [
        {"symbol": "AAA", "date": "2026-10-05", "epsActual": 1.0, "epsEstimate": 0.9, "year": 2026, "quarter": 3},
        {"symbol": "AAA", "date": "2026-10-20", "epsActual": 1.1, "epsEstimate": 1.2, "year": 2026, "quarter": 3},
        {"symbol": "BF/B", "date": "2026-10-10", "epsActual": 0.5, "epsEstimate": 0.5},
        {"symbol": "ZZZ", "date": "2026-10-10", "epsActual": 1, "epsEstimate": 1},          # 구성 종목 아님
        {"symbol": "AAA", "date": "2026-09-30", "epsActual": 9, "epsEstimate": 1},          # 시즌 전
        {"symbol": "BF.B", "date": "2026-10-25", "epsActual": None, "epsEstimate": 1},      # 미발표
    ]
    rows = B.build_rows(cal, members, "2026-10-01", "2026-10-23")
    assert [(r["ticker"], r["date"], r["eps"]) for r in rows] == [("AAA", "2026-10-20", "miss"), ("BF.B", "2026-10-10", "inline")]
    assert rows[0]["fq"] == "2026Q3"


def test_scoreboard_summary_and_sectors():
    rows = [
        {"ticker": "A", "sector": "X", "eps": "beat", "surprisePct": 5.0, "rev": "beat"},
        {"ticker": "B", "sector": "X", "eps": "miss", "surprisePct": -1.0, "rev": None},
        {"ticker": "C", "sector": "Y", "eps": "beat", "surprisePct": 2.0, "rev": "miss"},
    ]
    p = B.scoreboard(rows, 503, "2026년 3분기", "2026-10-01", "2026-10-23")
    o = p["overall"]
    assert (o["n"], o["beat"], o["miss"], o["inline"]) == (3, 2, 1, 0)
    assert o["beatPct"] == 66.7 and o["medianSurprisePct"] == 2.0
    assert o["revN"] == 2 and o["revBeatPct"] == 50.0
    assert [s["sector"] for s in p["sectors"]] == ["X", "Y"]
    assert p["total"] == 503 and p["count"] == 3
    assert "블렌디드" in p["note"] and "blended" not in str(p).lower().replace("블렌디드", "")
    empty = B.scoreboard([], 503, "s", "a", "b")["overall"]
    assert empty["n"] == 0 and empty["beatPct"] is None and empty["medianSurprisePct"] is None
