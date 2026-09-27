"""국내 ETF 구성 빌더(build_kr_etf_holdings.py)의 순수 로직 — 네트워크 없음.

실행: py -m pytest -q scripts/tests/test_kr_etf_holdings.py
"""
from __future__ import annotations

import datetime

from conftest import import_builder

kb = import_builder("build_kr_etf_holdings")

UNIVERSE = {
    "005930": {"company": "삼성전자", "sector": "기술", "etf": False},
    "000660": {"company": "SK하이닉스", "sector": "기술", "etf": False},
    "005380": {"company": "현대차", "sector": "경기소비재", "etf": False},
    "069500": {"company": "KODEX 200", "sector": "ETF", "etf": True},
}


def test_normalize_code_kr_isin_short_and_foreign():
    assert kb.normalize_code("KR7005930003") == ("005930", "KR7005930003")
    assert kb.normalize_code("005930") == ("005930", "005930")
    assert kb.normalize_code("0126Z0") == ("0126Z0", "0126Z0")
    # 해외 ISIN 을 [3:9] 로 잘라 국내 코드처럼 만들지 않는다(pykrx 래퍼의 함정).
    assert kb.normalize_code("US0378331005") == (None, "US0378331005")
    assert kb.normalize_code("KRD010010001")[0] is None


def test_parse_uses_krx_ratio_and_maps_sectors():
    rows = [
        {"COMPST_ISU_CD": "005930", "COMPST_ISU_NM": "삼성전자", "COMPST_RTO": "30.5", "COMPST_AMT": "1,000", "VALU_AMT": "0"},
        {"COMPST_ISU_CD": "KR7000660001", "COMPST_ISU_NM": "SK하이닉스", "COMPST_RTO": "12.25", "COMPST_AMT": "400", "VALU_AMT": "0"},
        {"COMPST_ISU_CD": "KRD010010001", "COMPST_ISU_NM": "원화예금", "COMPST_RTO": "0.5", "COMPST_AMT": "10", "VALU_AMT": "0"},
        {"COMPST_ISU_CD": "KR4101V90009", "COMPST_ISU_NM": "코스피200 F 202612", "COMPST_RTO": "2", "COMPST_AMT": "5", "VALU_AMT": "0"},
        {"COMPST_ISU_CD": "005380", "COMPST_ISU_NM": "현대차", "COMPST_RTO": "-", "COMPST_AMT": "", "VALU_AMT": ""},
    ]
    p = kb.parse_pdf_rows(rows, UNIVERSE)
    assert p["weightBasis"] == "rto"
    assert p["top"][0] == {"n": "삼성전자", "w": 30.5, "k": "equity", "t": "005930"}
    assert p["top"][1]["t"] == "000660"
    cash = [h for h in p["top"] if h["k"] == "cash"]
    assert cash and cash[0]["n"] == "원화예금" and "t" not in cash[0]
    fut = [h for h in p["top"] if h["n"].startswith("코스피200 F")]
    assert fut and fut[0]["k"] == "other"
    # 비중 0 인 행(현대차)은 뺀다
    assert all(h["n"] != "현대차" for h in p["top"])
    assert p["holdingsCount"] == 4
    assert p["sectors"] == [["기술", 42.75]]
    assert p["sectorUnmapped"] == 2.0   # 선물만(현금은 미분류로 세지 않음)


def test_parse_falls_back_to_amount_ratio():
    rows = [
        {"COMPST_ISU_CD": "005930", "COMPST_ISU_NM": "삼성전자", "COMPST_RTO": "0", "COMPST_AMT": "300"},
        {"COMPST_ISU_CD": "005380", "COMPST_ISU_NM": "현대차", "COMPST_RTO": "0", "COMPST_AMT": "100"},
    ]
    p = kb.parse_pdf_rows(rows, UNIVERSE)
    assert p["weightBasis"] == "amt"
    assert [h["w"] for h in p["top"]] == [75.0, 25.0]


def test_parse_returns_none_when_no_weights():
    # 해외 주식형: 계약수만 있고 비중·금액이 0 → 추정하지 않고 None
    rows = [
        {"COMPST_ISU_CD": "US0378331005", "COMPST_ISU_NM": "APPLE INC", "COMPST_ISU_CU1_SHRS": "12.2", "COMPST_RTO": "0", "COMPST_AMT": "0", "VALU_AMT": "0"},
    ]
    assert kb.parse_pdf_rows(rows, UNIVERSE) is None
    assert kb.parse_pdf_rows([], UNIVERSE) is None


def test_parse_foreign_names_kept_without_ticker():
    rows = [
        {"COMPST_ISU_CD": "US0378331005", "COMPST_ISU_NM": "APPLE INC", "COMPST_RTO": "7"},
        {"COMPST_ISU_CD": "US5949181045", "COMPST_ISU_NM": "MICROSOFT CORP", "COMPST_RTO": "6"},
    ]
    p = kb.parse_pdf_rows(rows, UNIVERSE)
    assert p["top"][0] == {"n": "APPLE INC", "w": 7.0, "k": "other"}
    assert p["sectorUnmapped"] == 13.0


def test_pick_universe_orders_by_market_cap():
    snap = {"stocks": [
        {"ticker": "005930", "company": "삼성전자", "sector": "기술", "market": "kospi", "marketCapT": 500},
        {"ticker": "069500", "company": "KODEX 200", "sector": "ETF", "market": "etf", "marketCapT": 10, "priceDate": "2026-09-25"},
        {"ticker": "360750", "company": "TIGER 미국S&P500", "sector": "ETF", "market": "etf", "marketCapT": 12},
        {"ticker": "999990", "company": "작은 ETF", "sector": "ETF", "market": "etf"},
    ]}
    etfs, uni = kb.pick_universe(snap, 2)
    assert [e["ticker"] for e in etfs] == ["360750", "069500"]
    assert uni["069500"]["etf"] is True and uni["005930"]["etf"] is False


def test_candidate_dates_weekdays_from_price_date():
    ds = kb.candidate_dates("2026-09-27", datetime.date(2026, 9, 28), back=3)  # 일요일 기준일
    assert ds == ["20260925", "20260924", "20260923"]
    assert kb.candidate_dates(None, datetime.date(2026, 9, 28), back=1) == ["20260928"]
