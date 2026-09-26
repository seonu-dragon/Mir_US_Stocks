"""KR 증시자금·시장 수급(build_kr_market_funds.py) + 수급 일별 행(build_kr_investor_flow.py)의
순수 로직 — 네트워크 없음.

실행: py -m pytest -q scripts/tests/test_kr_market_funds.py
"""
from __future__ import annotations

import json
from datetime import datetime

from conftest import import_builder

mf = import_builder("build_kr_market_funds")
flow = import_builder("build_kr_investor_flow")

# freesis 실제 응답(2026-09-21·22) 일부 — 단위 백만 원.
DS060 = [
    {"TMPV1": "20260922", "TMPV2": 100982555, "TMPV3": 42217285, "TMPV4": 110640626, "TMPV5": 853709, "TMPV6": 3687, "TMPV7": 0.4},
    {"TMPV1": "20260921", "TMPV2": 98138613, "TMPV3": 41845328, "TMPV4": 110083325, "TMPV5": 872160, "TMPV6": 3635, "TMPV7": 0.4},
]
DS070 = [
    {"TMPV1": "20260922", "TMPV2": 32819168, "TMPV3": 25609148, "TMPV4": 7210020, "TMPV5": 34330},
    {"TMPV1": "20260921", "TMPV2": 33055486, "TMPV3": 25895759, "TMPV4": 7159727, "TMPV5": 33317},
]


def test_parse_funds_units_and_fields():
    rows = mf.parse_funds(DS060, DS070)
    r = rows["2026-09-21"]
    # 네이버 국내 홈 '고객예탁금 981,386억 (09.21)' 과 같은 값(원자료 금투협).
    assert round(r["dep"]) == 981386
    assert r["unpaid"] == 8721.6
    assert r["forced"] == 36.35
    assert r["forcedPct"] == 0.4
    assert r["credit"] == 330554.86
    assert r["creditKospi"] + r["creditKosdaq"] == r["credit"]
    assert set(rows) == {"2026-09-21", "2026-09-22"}


def test_merge_by_date_new_wins_and_sorted_capped():
    prev = [{"d": "2026-09-18", "dep": 1.0}, {"d": "2026-09-21", "dep": 2.0, "credit": 9.0}]
    fresh = {"2026-09-21": {"d": "2026-09-21", "dep": 3.0, "credit": None}, "2026-09-22": {"d": "2026-09-22", "dep": 4.0}}
    out = mf.merge_by_date(prev, fresh, keep=2)
    assert [r["d"] for r in out] == ["2026-09-21", "2026-09-22"]
    assert out[0] == {"d": "2026-09-21", "dep": 3.0, "credit": 9.0}   # None 은 기존 값을 지우지 않는다


def test_funds_window_backfill_then_overlap():
    today = datetime(2026, 9, 26).date()
    s, e = mf.funds_window([], today)
    assert (e - s).days == mf.FUNDS_BACKFILL_DAYS
    s, e = mf.funds_window([{"d": "2026-09-22"}], today)
    assert str(s) == "2026-09-12" and e == today


def test_parse_index_trend_skips_holiday_zeros():
    assert mf.parse_index_trend({"bizdate": "20260923", "personalValue": "-14,649",
                                 "foreignValue": "-4,942", "institutionalValue": "+3,189"}) == \
        {"d": "2026-09-23", "ind": -14649.0, "frn": -4942.0, "org": 3189.0}
    assert mf.parse_index_trend({"bizdate": "20260924", "personalValue": "0",
                                 "foreignValue": "0", "institutionalValue": "0"}) is None
    assert mf.parse_index_trend("<html>") is None


def test_investor_dates_incremental_and_close_cutoff():
    kst = mf.KST
    # 토요일: 마지막 저장일(수) 다시 + 목·금(추석이면 0 으로 와서 건너뜀)
    sat = datetime(2026, 9, 26, 16, 0, tzinfo=kst)
    ds = [str(d) for d in mf.investor_dates([{"d": "2026-09-23"}], sat)]
    assert ds == ["2026-09-23", "2026-09-24", "2026-09-25"]
    # 평일 장중엔 오늘을 빼고, 장 마감 뒤엔 넣는다.
    mon_am = datetime(2026, 9, 28, 10, 0, tzinfo=kst)
    mon_pm = datetime(2026, 9, 28, 15, 45, tzinfo=kst)
    assert "2026-09-28" not in [str(d) for d in mf.investor_dates([{"d": "2026-09-25"}], mon_am)]
    assert "2026-09-28" in [str(d) for d in mf.investor_dates([{"d": "2026-09-25"}], mon_pm)]
    # 첫 실행은 약 3개월 평일
    first = mf.investor_dates([], mon_pm)
    assert 60 <= len(first) <= 70 and all(d.weekday() < 5 for d in first)


def test_compute_top_amount_is_qty_times_close():
    daily = {
        # [d, 종가, 전일대비, 개인, 외국인, 기관, 보유율] — 최신순
        "005930": [["20260923", 286500, 10000, -7630126, 4513767, 1346883, 46.63],
                   ["20260922", 277500, 3500, -2707452, 659851, 259459, 46.55]],
        "000660": [["20260923", 1863000, 23000, 0, -100000, 50000, 55.0],
                   ["20260922", 1841000, -27000, 0, -10000, 0, 55.1]],
        "111111": [["20260923", 1000, 0, 0, 0, 0, 1.0]],
    }
    top = mf.compute_top(daily, {"005930": "삼성전자", "000660": "SK하이닉스"})
    assert top["asOf"] == "2026-09-23" and top["from5"] == "2026-09-22"
    buy = top["d1"]["frnBuy"]
    assert buy[0]["t"] == "005930" and buy[0]["n"] == "삼성전자"
    assert buy[0]["a"] == round(4513767 * 286500 / 1e8, 1)
    assert buy[0]["c"] == round(10000 / 276500 * 100, 2)
    assert top["d1"]["frnSell"][0]["t"] == "000660"
    # 5일: 두 날 합(각 날 종가로 환산)
    five = top["d5"]["frnBuy"][0]["a"]
    assert five == round((4513767 * 286500 + 659851 * 277500) / 1e8, 1)
    # 0원(순매수 없음)은 어느 쪽 표에도 없다
    assert all(x["t"] != "111111" for sect in top["d1"].values() for x in sect)
    assert mf.compute_top({}, {}) is None


def test_ecos_check_month_end_match(monkeypatch):
    monkeypatch.setattr(mf, "now_kst", lambda: datetime(2026, 9, 26, tzinfo=mf.KST))
    rows = [{"d": "2026-08-28", "dep": 996000.0, "credit": 332000.0},
            {"d": "2026-08-31", "dep": 997000.0, "credit": 332500.0},
            {"d": "2026-09-22", "dep": 1009825.55, "credit": 328191.68}]
    industry = {"indicators": {
        "kr_investor_deposits": {"series": [{"date": "2026-08", "val": 99.7}, {"date": "2026-09", "val": 100.0}]},
        "kr_margin_loans": {"series": [{"date": "2026-08", "val": 33.25}]},
    }}
    chk = mf.ecos_check(rows, industry)
    assert chk["month"] == "2026-08" and chk["freesisDate"] == "2026-08-31"   # 진행 중인 9월은 제외
    assert chk["depFreesis"] == 99.7 and chk["depDiffPct"] == 0.0
    assert chk["ok"] is True
    assert mf.ecos_check(rows, None) is None


def test_flow_daily_row_sign_and_shape():
    r = {"bizdate": "20260922", "closePrice": "1,841,000", "compareToPreviousClosePrice": "-27,000",
         "compareToPreviousPrice": {"code": "5"}, "individualPureBuyQuant": "+1,000",
         "foreignerPureBuyQuant": "-826,076", "organPureBuyQuant": "+5,211", "foreignerHoldRatio": "46.59%"}
    assert flow.daily_row(r) == ["20260922", 1841000, -27000, 1000, -826076, 5211, 46.59]
    # 부호 없는 문자열은 등락 코드로
    r2 = dict(r, compareToPreviousClosePrice="3,500", compareToPreviousPrice={"code": "5"})
    assert flow.daily_row(r2)[2] == -3500
    r3 = dict(r, compareToPreviousClosePrice="3,500", compareToPreviousPrice={"code": "2"})
    assert flow.daily_row(r3)[2] == 3500
    assert flow.daily_row({"closePrice": "1"}) is None


def test_flow_shard_of_matches_js_vectors():
    # kr-flow-core.js / valuation-band-core.js 와 같은 해시(test_kr_flow_core.mjs 와 같은 벡터).
    assert flow.shard_of("005930") == 29
    assert flow.shard_of("000660") == 28


def test_flow_daily_shards_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setattr(flow, "DAILY_DIR", tmp_path / "investor_flow_daily")
    monkeypatch.setattr(flow, "ROOT", tmp_path)
    daily = {"005930": [["20260923", 286500, 10000, -1, 2, 3, 46.6]], "000660": [["20260923", 1, 0, 0, 0, 0, 1.0]]}
    paths = flow.write_daily_shards(daily, "2026-09-26 16:00 KST")
    assert len(paths) == flow.DAILY_SHARDS
    s29 = json.loads((tmp_path / "investor_flow_daily" / "s29.json").read_text(encoding="utf-8"))
    assert s29["daily"]["005930"][0][4] == 2 and s29["asOf"] == "20260923"
    # market_funds 가 같은 샤드를 읽는다
    book = mf.load_flow_daily(tmp_path / "investor_flow_daily")
    assert set(book) == {"005930", "000660"}
