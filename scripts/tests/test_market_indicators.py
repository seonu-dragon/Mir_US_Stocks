"""시장지표 빌더(build_market_indicators.py)와 시장 히스토리 수정(build_market_history.py) 테스트.

오프라인·결정적 — 파서에는 실제 응답 모양을 줄인 문자열을 넣는다.
실행: py -m pytest -q scripts/tests/test_market_indicators.py
"""
from __future__ import annotations

from datetime import datetime, timezone

import build_market_history as mh
import build_market_indicators as mi


def _ts(day: str, hour: int = 20) -> int:
    return int(datetime.fromisoformat(f"{day}T{hour:02d}:00:00").replace(tzinfo=timezone.utc).timestamp())


def _chart(days_closes, price, rmt_day, gmtoffset=0, **meta):
    return {"chart": {"result": [{
        "meta": {"regularMarketPrice": price, "regularMarketTime": _ts(rmt_day), "gmtoffset": gmtoffset,
                 "shortName": meta.pop("shortName", "Gold Dec 26"), "currency": meta.pop("currency", "USD"), **meta},
        "timestamp": [_ts(d) for d, _ in days_closes],
        "indicators": {"quote": [{"close": [c for _, c in days_closes]}]},
    }]}}


# ---------------------------------------------------------------------------
# 만기월
# ---------------------------------------------------------------------------
def test_contract_month_formats():
    assert mi.contract_month("Crude Oil Nov 26") == "2026-11"
    assert mi.contract_month("Aluminum Futures,Dec-2026") == "2026-12"
    assert mi.contract_month("Soybean Futures,Jan-2027") == "2027-01"
    # shortName 이 32자에서 잘려 연도가 없으면 기준일 이후 가장 가까운 그 달
    assert mi.contract_month("Chicago SRW Wheat Futures,Dec-2", "2026-09-25") == "2026-12"
    assert mi.contract_month("Lean Hog Futures,Feb-20", "2026-09-25") == "2027-02"
    assert mi.contract_month("Brent Crude Oil Last Day Financ") is None
    assert mi.contract_month(None) is None


# ---------------------------------------------------------------------------
# 야후 chart
# ---------------------------------------------------------------------------
def test_yahoo_prev_close_comes_from_daily_bars_not_range_start():
    # chartPreviousClose(구간 시작 전 종가)는 쓰지 않는다 — 마지막 봉이 현재가 날짜면 그 앞 봉이 전일
    payload = _chart([("2026-09-23", 100.0), ("2026-09-24", 102.0), ("2026-09-25", 103.5)], 103.5, "2026-09-25",
                     chartPreviousClose=50.0)
    p = mi.parse_yahoo_chart(payload)
    assert p["value"] == 103.5 and p["prev"] == 102.0 and p["asOf"] == "2026-09-25"
    assert p["spark"][-1] == ["2026-09-25", 103.5]
    assert len(p["spark"]) == 3


def test_yahoo_uses_fullday_change_for_rolled_futures():
    # 연속 선물은 일봉이 다른 월물을 섞는다 — 거래소 당일 변동이 있으면 그걸로 전일을 되짚는다
    payload = _chart([("2026-09-24", 106.6), ("2026-09-25", 104.32)], 97.44, "2026-09-25", fulldayChange=-2.78)
    p = mi.parse_yahoo_chart(payload)
    assert p["prev"] == 100.22
    item = mi.with_change({"value": p["value"], "prev": p["prev"]})
    assert item["change"] == -2.78 and item["changePct"] == -2.77


def test_yahoo_scale_and_missing_history():
    payload = _chart([("2026-09-25", 8.597)], 8.597, "2026-09-25", fulldayChange=0.019, currency="KRW")
    p = mi.parse_yahoo_chart(payload, scale=100)
    assert p["value"] == 859.7 and p["prev"] == 857.8
    assert len(p["spark"]) == 1  # 과거 봉이 없는 심볼 — 누적은 merge 단계에서


def test_yahoo_empty_payload():
    assert mi.parse_yahoo_chart({"chart": {"result": []}}) is None
    assert mi.parse_yahoo_chart({}) is None


# ---------------------------------------------------------------------------
# 금리 소스 파서
# ---------------------------------------------------------------------------
MOF = """Interest Rate (September 2026),,,,,,,,,,,,,,,(Unit : %)
Date,1Y,2Y,3Y,4Y,5Y,6Y,7Y,8Y,9Y,10Y,15Y,20Y,25Y,30Y,40Y
2026/9/1,1.527,1.802,1.952,2.14,2.28,2.411,2.559,2.718,2.848,2.987,3.544,3.859,4.143,4.131,4.145
2026/9/24,1.627,1.912,2.065,2.259,2.4,2.523,2.641,2.8,2.936,3.073,3.598,3.887,4.141,4.115,4.103
,,,,,,,,,,,,,,,
"  If you cannot download the latest csv data, please clear the browser's cache.",,,,,,,,,,,,,,,
"""

BUBA = '''﻿"";BBSIS.D.I.ZAR.ZI.EUR.S1311.B.A604.R10XX.R.A.A._Z._Z.A;BBSIS..._FLAGS
Dezimalstellen;2;
Stand vom;25.09.2026 12:08:55 Uhr;
2026-09-24;3,60;
2026-09-25;3,61;
2026-09-26;.;Keine Werte vorhanden
'''

BOE = """DATE,IUDMNPY
22 Sep 2026,5.2113
23 Sep 2026,5.3055
"""

BIS = """FREQ,REF_AREA,TIME_PERIOD,OBS_VALUE
D,KR,2026-08-26,2.75
D,KR,2026-08-27,2.75
D,KR,2026-08-28,3
D,KR,2026-08-29,3
D,CN,2026-09-20,3
D,CN,2026-09-21,3
"""


def test_parse_mof_takes_10y_column():
    assert mi.parse_mof_csv(MOF) == [("2026-09-01", 2.987), ("2026-09-24", 3.073)]


def test_parse_bundesbank_decimal_comma_and_missing():
    assert mi.parse_bundesbank_csv(BUBA) == [("2026-09-24", 3.60), ("2026-09-25", 3.61)]


def test_parse_boe():
    assert mi.parse_boe_csv(BOE) == [("2026-09-22", 5.2113), ("2026-09-23", 5.3055)]


def test_parse_bis_policy_last_change():
    p = mi.parse_bis_policy(BIS)
    assert p["KR"] == {"value": 3.0, "prevValue": 2.75, "changedOn": "2026-08-28", "asOf": "2026-08-29"}
    # 구간 안에서 한 번도 안 바뀌면 전회값·변경일은 없음(지어내지 않는다)
    assert p["CN"]["prevValue"] is None and p["CN"]["changedOn"] is None


def test_series_item_spark_window():
    s = [("2026-05-01", 1.0), ("2026-09-20", 2.0), ("2026-09-24", 2.5)]
    it = mi.series_item(s)
    assert it["value"] == 2.5 and it["prev"] == 2.0 and it["asOf"] == "2026-09-24"
    assert [p[0] for p in it["spark"]] == ["2026-09-20", "2026-09-24"]  # 3개월 밖은 뺀다


# ---------------------------------------------------------------------------
# 직전값 유지·스파크 누적
# ---------------------------------------------------------------------------
def test_merge_keeps_previous_for_failed_items_marked_stale():
    prev = {"items": [{"id": "GC", "value": 4300, "asOf": "2026-09-24", "spark": [["2026-09-24", 4300]]},
                      {"id": "CL", "value": 90, "asOf": "2026-09-24"}]}
    new = {"CL": {"id": "CL", "value": 92.41, "asOf": "2026-09-25", "spark": [["2026-09-25", 92.41]] * 10}}
    merged, kept = mi.merge_with_previous(new, prev, ["CL", "GC", "SI"])
    assert kept == ["GC"]
    assert merged["GC"]["stale"] is True and merged["GC"]["asOf"] == "2026-09-24"  # 기준일은 원래 값 그대로
    assert "SI" not in merged  # 직전값도 없으면 빼 둔다
    assert "stale" not in merged["CL"]


def test_merge_accumulates_short_spark():
    prev = {"items": [{"id": "KS200", "spark": [["2026-09-22", 1110.0], ["2026-09-23", 1126.12]]}]}
    new = {"KS200": {"id": "KS200", "spark": [["2026-09-25", 1130.0]]}}
    merged, _ = mi.merge_with_previous(new, prev, ["KS200"])
    assert merged["KS200"]["spark"] == [["2026-09-22", 1110.0], ["2026-09-23", 1126.12], ["2026-09-25", 1130.0]]


def test_build_payload_counts_and_cards():
    items = {"CL": {"id": "CL", "value": 1}, "US10Y": {"id": "US10Y", "value": 5}}
    p = mi.build_payload(items, ["x"], None)
    assert p["count"] == 2 and p["fresh"] == 2 and p["staleIds"] == []
    assert p["cards"] == ["CL", "US10Y"]
    assert [i["id"] for i in p["items"]] == ["CL", "US10Y"]


def test_expected_ids_cover_scope():
    ids = mi.expected_ids()
    assert len([f for f in mi.FUTURES]) == 20
    for must in ("KS200", "N225", "ES", "RTY", "EURKRW", "JPYKRW", "CNYKRW", "US10Y", "KR10Y", "JP10Y", "DE10Y", "GB10Y",
                 "RATE_US", "RATE_CN"):
        assert must in ids
    assert len(ids) == len(set(ids))


# ---------------------------------------------------------------------------
# build_market_history 버그 수정
# ---------------------------------------------------------------------------
def test_history_migrates_old_kospi_close_to_kodex200():
    old = {"date": "2026-09-23", "kospiClose": 113145.0, "usdKrw": 1387.97}
    assert mh.migrate_record(old) == {"date": "2026-09-23", "kodex200Close": 113145.0, "usdKrw": 1387.97}
    new = {"date": "2026-09-25", "kospiClose": 7080.92, "kospiDate": "2026-09-23", "kodex200Close": 113145.0}
    assert mh.migrate_record(new) == new


def test_history_kospi_from_snapshot_index():
    snap = {"updatedAtKst": "2026-09-23 20:20 KST", "indices": [
        {"symbol": "^KQ11", "price": 844.48, "tradedAt": "2026-09-23T20:15:00+09:00"},
        {"symbol": "^KS11", "price": 7080.92, "tradedAt": "2026-09-23T20:15:00+09:00"},
    ]}
    assert mh.kospi_index(snap) == (7080.92, "2026-09-23")
    assert mh.kospi_index({"indices": []}) == (None, None)


def test_history_fx_picks_most_recent_observation():
    got = mh.pick_latest_fx([
        ("ECOS 731Y001", (1360.0, "2026-09-23")),
        ("ECB(frankfurter)", (1355.05, "2026-09-25")),
        ("none", None),
    ])
    assert got == (1355.05, "2026-09-25", "ECB(frankfurter)")
    # 같은 날이면 앞(ECOS)이 이긴다
    assert mh.pick_latest_fx([("ECOS 731Y001", (1356.0, "2026-09-25")), ("ECB(frankfurter)", (1355.05, "2026-09-25"))])[2] == "ECOS 731Y001"
    assert mh.pick_latest_fx([]) is None


def test_history_ymd():
    assert mh._ymd("20260923") == "2026-09-23"
    assert mh._ymd("2026-09-23T20:15:00+09:00") == "2026-09-23"
    assert mh._ymd("") is None
