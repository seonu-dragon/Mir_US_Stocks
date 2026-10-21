"""build_vix_term_structure.py — 네트워크 없이 파서·만기 규칙·곡선 조립만 본다."""
from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import build_vix_term_structure as V  # noqa: E402


def test_vx_expiration_rule():
    # 2026-11 월물: 12월 셋째 금요일(12-18) − 30일 = 11-18(수) — Cboe 정산가 파일의 실제 만기와 같다.
    assert V.vx_expiration(2026, 11) == date(2026, 11, 18)
    assert V.vx_expiration(2026, 12) == date(2026, 12, 16)
    assert V.vx_expiration(2027, 1) == date(2027, 1, 20)
    # 2026-05 월물: 6월 셋째 금요일이 준틴스(6-19)라 실제 만기는 하루 당긴 5-19 — 규칙값 5-20 에서 하루씩 당겨 찾는다.
    assert V.vx_expiration(2026, 5) == date(2026, 5, 20)
    assert V.month_add(2026, 11, 3) == (2027, 2)
    assert V.month_add(2026, 1, -13) == (2024, 12)


def test_parse_spot_csv_handles_us_dates_and_bad_rows():
    text = "DATE,OPEN,HIGH,LOW,CLOSE\n10/16/2026,19,21,18,19.99\n10/19/2026,19,19,18,18.44\nbad,1,1,1,x\n10/19/2026,1,1,1,18.44\n"
    assert V.parse_spot_csv(text) == [("2026-10-16", 19.99), ("2026-10-19", 18.44)]
    assert V.parse_spot_csv("") == []
    assert V.parse_spot_csv("A,B\n1,2\n") == []


def test_parse_vx_csv_and_settlement():
    text = ("Trade Date,Futures,Open,High,Low,Close,Settle,Change,Total Volume,EFP,Open Interest\n"
            "2026-10-16,X (Nov 2026),17.97,19.95,17.5,19.1,19.2382,1.3151,255025,0,218988\n"
            "2026-10-19,X (Nov 2026),19.25,19.35,18.25,18.63,18.5996,-0.6386,176341,0,213886\n"
            "2026-10-20,X (Nov 2026),0,0,0,0,0,0,0,0,0\n")
    rows = V.parse_vx_csv(text)
    assert [r["date"] for r in rows] == ["2026-10-16", "2026-10-19"]
    assert rows[-1] == {"date": "2026-10-19", "settle": 18.5996, "vol": 176341, "oi": 213886}
    settle = V.parse_settlement_csv("Product,Symbol,Expiration Date,Price\nVX,VX/X6,2026-11-18,18.4881\n"
                                    "VX,VX47/X6,2026-11-24,18.4881\nVXM,VXM/X6,2026-11-18,18.4881\n")
    assert settle == {"2026-11-18": 18.4881}   # 주간물·미니는 뺀다


def _contracts():
    return {
        "2026-10-21": [{"date": "2026-10-16", "settle": 19.9, "vol": 1, "oi": 1}, {"date": "2026-10-19", "settle": 18.2, "vol": 1, "oi": 1}],
        "2026-11-18": [{"date": "2026-10-16", "settle": 19.2, "vol": 1, "oi": 1}, {"date": "2026-10-19", "settle": 18.6, "vol": 1, "oi": 1}],
        "2026-12-16": [{"date": "2026-10-16", "settle": 18.9, "vol": 1, "oi": 1}, {"date": "2026-10-19", "settle": 18.7, "vol": 1, "oi": 1}],
    }


def test_curve_on_orders_by_expiry_and_skips_expired():
    c = V.curve_on(_contracts(), "2026-10-19")
    assert [x["exp"] for x in c] == ["2026-10-21", "2026-11-18", "2026-12-16"]
    assert c[0]["days"] == 2 and c[0]["prev"] == 19.9
    expired = dict(_contracts(), **{"2026-09-16": [{"date": "2026-09-16", "settle": 20.0, "vol": 1, "oi": 1}]})
    assert [x["exp"] for x in V.curve_on(expired, "2026-10-19")][0] == "2026-10-21"   # 만기 지난 월물은 곡선 밖
    assert V.curve_on(_contracts(), "2026-10-21") == []                                # 그날 정산가가 없으면 비운다


def test_merge_settlement_appends_only_newer_day():
    c = _contracts()
    added = V.merge_settlement(c, "2026-10-20", {"2026-11-18": 18.49, "2026-10-21": 17.2, "2027-01-20": 19.6})
    assert added == 2   # 계약별 이력이 없는 월물(2027-01)은 붙이지 않는다
    assert c["2026-11-18"][-1] == {"date": "2026-10-20", "settle": 18.49, "vol": None, "oi": None}
    assert V.merge_settlement(c, "2026-10-20", {"2026-11-18": 18.49}) == 0


def test_build_payload_requires_vix_and_two_futures():
    vix = [(f"2026-09-{d:02d}", 20.0) for d in range(1, 30)] + [("2026-10-16", 19.99), ("2026-10-19", 18.44)]
    spot = {"VIX": vix, "VIX3M": [("2026-10-19", 19.6)], "VIX1Y": [("2026-01-02", 22.0)]}
    p = V.build_payload(spot, _contracts())
    assert p["asOf"] == "2026-10-19"
    assert [s["id"] for s in p["spot"]] == ["VIX", "VIX3M"]   # 멈춘 지수(VIX1Y 1월 값)는 곡선에서 뺀다
    assert p["count"] == 2 + 3
    assert p["history"][-1] == ["2026-10-19", 18.44, 19.6, 18.2, 18.6]
    assert V.build_payload({"VIX": vix[:5]}, _contracts()) is None
    assert V.build_payload(spot, {"2026-11-18": _contracts()["2026-11-18"]}) is None
