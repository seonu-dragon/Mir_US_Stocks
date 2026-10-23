"""build_push_smart_money 순수 함수 테스트. 네트워크 없음."""
from __future__ import annotations

import build_push_smart_money as B


def test_insider_rows_keeps_open_market_and_groups():
    trades = [
        {"ticker": "nvda", "fileDate": "2026-10-22", "txDate": "2026-10-20", "owner": "A", "relation": "CEO", "code": "S", "shares": 10, "value": 1000, "plan10b51": True},
        {"ticker": "NVDA", "fileDate": "2026-10-22", "txDate": "2026-10-21", "owner": "A", "relation": "CEO", "code": "S", "shares": 5, "value": 600, "plan10b51": False},
        {"ticker": "NVDA", "fileDate": "2026-10-22", "txDate": "2026-10-21", "owner": "A", "relation": "CEO", "code": "M", "shares": 5, "value": 0},
        {"ticker": "AAPL", "fileDate": "2026-10-10", "txDate": "2026-10-09", "owner": "B", "relation": "Dir", "code": "P", "shares": 1, "value": 1},
    ]
    rows = B.insider_rows(trades, "2026-10-15")
    assert rows == [["NVDA", "2026-10-22", "2026-10-21", "A", "CEO", "S", 15, 1600, 1]]


def _inst(cur, prev, status="ok"):
    q = lambda d, acc, hs: {"reportDate": d, "reportLabel": d, "filedDate": "2026-08-14", "accession": acc,  # noqa: E731
                             "holdings": [{"ticker": t, "valueM": 1.0, "putCall": ""} for t in hs]}
    return {"id": "x", "name": "X", "status": status, "quarters": [q("2026-06-30", "acc2", cur), q("2026-03-31", "acc1", prev)]}


def test_inst_changes_respects_top25_truncation():
    small = B.inst_changes(_inst(["A", "B"], ["B", "C"]))
    assert small == [("A", "new", 1.0), ("C", "exit", 1.0)]
    full = [f"T{i}" for i in range(B.TOP_HOLDINGS)]
    trunc = B.inst_changes(_inst(full[1:] + ["NEW"], full))
    assert ("NEW", "in25", 1.0) in trunc and ("T0", "out25", 1.0) in trunc
    assert B.inst_changes(_inst([], ["A"])) == []                     # 한쪽이 비면 판단하지 않는다
    # 옵션 포지션은 보유 종목 변화로 보지 않는다
    inst = _inst(["A"], ["A"])
    inst["quarters"][0]["holdings"].append({"ticker": "Z", "valueM": 1, "putCall": "Put"})
    assert B.inst_changes(inst) == []


def test_inst_rows_seen_baseline_and_new_filing():
    inst = _inst(["A", "B"], ["B"])
    rows, seen = B.inst_rows([inst], {}, "2026-10-23")                # 첫 실행: 제출일로 기준선
    assert seen == {"acc2": "2026-08-14"} and rows == []               # 30일 밖이라 행 없음
    rows, seen = B.inst_rows([inst], {"acc0": "2026-08-01"}, "2026-10-23")  # 이후 실행에서 새 제출
    assert seen == {"acc2": "2026-10-23"}
    assert rows == [["A", "x", "X", "new", "2026-06-30", "2026-08-14", 1.0, "2026-10-23"]]
