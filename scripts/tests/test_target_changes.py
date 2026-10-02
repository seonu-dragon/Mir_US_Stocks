"""목표주가 상향·하향(KR 증권사 직전 대비) + US 컨센서스 목표가 이력 단위 테스트. 네트워크 없음."""
from __future__ import annotations

from datetime import date

import build_kr_target_changes as K
import build_us_price_targets as U

TODAY = date(2026, 10, 2)


def _r(code, broker, d, target, name="삼성전자", op="매수"):
    return [code, name, broker, d, target, op]


def test_kr_change_vs_same_broker_previous_report():
    reports = {
        "1": _r("005930", "하나증권", "2026-07-01", 400000),
        "2": _r("005930", "대신증권", "2026-08-01", 300000),   # 다른 증권사는 비교 대상 아님
        "3": _r("005930", "하나증권", "2026-09-20", 480000),
        "4": _r("005930", "하나증권", "2026-09-25", 480000),   # 유지는 변경 아님
    }
    changes, history = K.derive(reports, TODAY)
    assert len(changes) == 1
    c = changes[0]
    assert (c["broker"], c["prev"], c["target"], c["pct"], c["prevDate"]) == ("하나증권", 400000, 480000, 20.0, "2026-07-01")
    assert history["005930"][0] == ["2026-09-25", "하나증권", 480000, 480000]
    assert history["005930"][-1] == ["2026-07-01", "하나증권", 400000, None]


def test_kr_old_changes_split_like_jumps_and_no_target_excluded():
    reports = {
        "1": _r("000001", "A증권", "2026-05-01", 10000),
        "2": _r("000001", "A증권", "2026-06-01", 12000),     # 30일 밖 변경 — 목록엔 없음, 이력엔 있음
        "3": _r("000002", "B증권", "2026-09-01", 10000),
        "4": _r("000002", "B증권", "2026-09-30", 50000),     # 5배 — 액면 변경 가능성, 변경으로 안 셈
        "5": _r("000003", "C증권", "2026-09-30", None),      # 목표가 없는 리포트
        "6": _r("000004", "D증권", "2024-01-01", 10000),     # 1년 창 밖
    }
    changes, history = K.derive(reports, TODAY)
    assert changes == []
    assert len(history["000001"]) == 2 and "000003" not in history and "000004" not in history
    assert history["000002"][0][3] == 10000


def test_us_history_appends_only_on_change_and_reports_big_moves():
    old = {"lo": 100.0, "avg": 150.0, "hi": 200.0, "n": 10, "asOf": "2026-09-20"}
    rec = {"lo": 100.0, "avg": 160.0, "hi": 210.0, "n": 11}
    th, chg = U.carry_target_history(old, rec, "2026-10-02")
    assert th == [["2026-09-20", 100.0, 150.0, 200.0, 10], ["2026-10-02", 100.0, 160.0, 210.0, 11]]
    assert chg == {"d": "2026-10-02", "prev": 150.0, "avg": 160.0, "pct": 6.7, "n": 11}
    th2, chg2 = U.carry_target_history({**rec, "th": th}, dict(rec), "2026-10-05")
    assert th2 == th and chg2 is None
    th3, chg3 = U.carry_target_history({**rec, "th": th}, {**rec, "avg": 161.0}, "2026-10-05")
    assert len(th3) == 3 and chg3 is None   # 0.6% — 목록 기준(3%) 미만


def test_us_merge_changes_window_and_coverage():
    prev = [{"t": "AAPL", "d": "2026-08-01", "pct": 5}, {"t": "GONE", "d": "2026-09-30", "pct": 5},
            {"t": "MSFT", "d": "2026-09-30", "pct": 4}]
    fresh = [{"t": "MSFT", "d": "2026-09-30", "pct": -4}, {"t": "NVDA", "d": "2026-10-02", "pct": 9}]
    out = U.merge_changes(prev, fresh, "2026-10-02", {"AAPL", "MSFT", "NVDA"})
    assert [(r["t"], r["pct"]) for r in out] == [("NVDA", 9), ("MSFT", -4)]
