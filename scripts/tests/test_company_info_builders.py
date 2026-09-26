"""기업개요(build_company_profile.py) · US 목표주가 범위(build_us_price_targets.py) · shard_store 테스트.

응답 모양은 2026-09-26 실제 호출(DART company.json/empSttus 삼성전자, SEC submissions AAPL·TSM,
Nasdaq targetprice AAPL·BRK.B·ZZZQ)에서 떼어 왔다. 네트워크 없음.
실행: py -m pytest -q scripts/tests/test_company_info_builders.py
"""
from __future__ import annotations

import json
from datetime import date

import build_company_profile as cp
import build_us_price_targets as pt
import shard_store


# ───────────────────────── KR

def test_parse_kr_company_samsung():
    rec = cp.parse_kr_company({
        "status": "000", "corp_name": "삼성전자(주)", "corp_name_eng": "SAMSUNG ELECTRONICS CO,.LTD",
        "ceo_nm": "전영현, 노태문", "corp_cls": "Y", "adres": "경기도 수원시 영통구  삼성로 129 (매탄동)",
        "hm_url": "www.samsung.com/sec", "ir_url": "", "phn_no": "02-2255-0114", "induty_code": "264",
        "est_dt": "19690113", "acc_mt": "12",
    })
    assert rec["ceo"] == "전영현, 노태문"
    assert rec["addr"] == "경기도 수원시 영통구 삼성로 129 (매탄동)"   # 이중 공백 정리
    assert rec["est"] == "1969-01-13"
    assert rec["fye"] == "12"
    assert rec["web"] == "www.samsung.com/sec"
    assert rec["ksic"] == "264"
    assert cp.parse_kr_company({"status": "013"}) is None


def test_normalize_url_rejects_junk():
    assert cp.normalize_url("http://www.kakaocorp.com/") == "www.kakaocorp.com"
    assert cp.normalize_url("-") == ""
    assert cp.normalize_url("javascript:alert(1)") == ""
    assert cp.parse_est_date("19691399") == ""


def _row(dept, sex, sm, stl="2025-12-31"):
    return {"fo_bbm": dept, "sexdstn": sex, "sm": sm, "stlm_dt": stl}


def test_employees_dept_total_rows_by_sex():
    # 삼성전자 모양: 부문(DX·DS)×성별 + '성별합계' 부문 행 2개(남·여). 합계 행만 더한다.
    rows = [_row("DX", "남", "38,119"), _row("DX", "여", "12,698"), _row("DS", "남", "56,154"),
            _row("DS", "여", "21,910"), _row("성별합계", "남", "94,273"), _row("성별합계", "여", "34,608")]
    assert cp.parse_kr_employees(rows) == {"emp": 128881, "empAsOf": "2025-12-31"}


def test_employees_grand_total_row():
    rows = [_row("A", "남", "10"), _row("A", "여", "5"), _row("합계", "합계", "15")]
    assert cp.parse_kr_employees(rows)["emp"] == 15


def test_employees_sex_total_rows_by_dept():
    rows = [_row("A", "남", "10"), _row("A", "합계", "12"), _row("B", "합계", "8")]
    assert cp.parse_kr_employees(rows)["emp"] == 20


def test_employees_no_total_sums_all_and_falls_back_to_parts():
    rows = [_row("-", "남", "7"), {"fo_bbm": "-", "sexdstn": "여", "sm": "-", "rgllbr_co": "2", "cnttk_co": "1"}]
    assert cp.parse_kr_employees(rows)["emp"] == 10
    assert cp.parse_kr_employees([]) is None
    assert cp.parse_kr_employees([_row("-", "남", "-")]) is None


def test_preferred_base():
    assert cp.preferred_base("005935") == "005930"
    assert cp.preferred_base("005930") is None
    assert cp.preferred_base("12345") is None


def test_kr_priority_order():
    today = date(2026, 9, 26)
    records = {
        "A": {"name": "a", "empYear": 2025},                         # 최신 — 개황이 오래되면 stale
        "B": {"name": "b", "empYear": 2024},                         # 직원 수 갱신 필요
        "C": {"name": "c", "empYear": 2025},                         # 변경 공시
        "E": {"name": "e", "empYear": 2025},                         # 최근에 받음 — 할 일 없음
    }
    state = {"A": {"c": "2026-01-01", "e": 2025, "ev": 2}, "B": {"c": "2026-09-01", "e": 2024, "ev": 2},
             "C": {"c": "2026-09-01", "e": 2025, "ev": 2}, "E": {"c": "2026-09-20", "e": 2025, "ev": 2},
             "M": {"miss": "2026-09-26"}}
    plan = cp.kr_priority(["A", "B", "C", "D", "E", "M"], records, state, 2025, {"C"}, today)
    assert plan == [("D", "full"), ("C", "company"), ("B", "emp"), ("A", "company")]


def test_kr_priority_does_not_retry_emp_same_year():
    today = date(2026, 9, 26)
    plan = cp.kr_priority(["B"], {"B": {"name": "b"}}, {"B": {"c": "2026-09-01", "e": 2025, "ev": 2}}, 2025, set(), today)
    assert plan == []


def test_kr_priority_reparses_old_parser_version():
    today = date(2026, 9, 26)
    plan = cp.kr_priority(["B"], {"B": {"name": "b", "empYear": 2025, "emp": 10}},
                          {"B": {"c": "2026-09-20", "e": 2025}}, 2025, set(), today)
    assert plan == [("B", "emp")]


def test_employees_sex_total_spelled_chonggye():
    # 삼성전기 모양: 부문×성별 + '성별 총계' 행(남·여). 이중 계산하면 24,346.
    rows = [_row("컴포넌트", "남", "3,013"), _row("성별 총계", "여", "2,895"), _row("컴포넌트", "여", "977"),
            _row("패키지솔루션", "남", "2,589"), _row("패키지솔루션", "여", "603"), _row("광학솔루션", "남", "764"),
            _row("광학솔루션", "여", "151"), _row("기타", "남", "2,912"), _row("기타", "여", "1,164"),
            _row("성별 총계", "남", "9,278")]
    assert cp.parse_kr_employees(rows)["emp"] == 12173


# ───────────────────────── US

AAPL_SUB = {
    "cik": "0000320193", "entityType": "operating", "sic": "3571", "sicDescription": "Electronic Computers",
    "name": "Apple Inc.", "tickers": ["AAPL"], "exchanges": ["Nasdaq"], "website": "", "category": "Large accelerated filer",
    "fiscalYearEnd": "0926", "stateOfIncorporation": "CA", "stateOfIncorporationDescription": "CA",
    "addresses": {"business": {"street1": "ONE APPLE PARK WAY", "street2": None, "city": "CUPERTINO",
                               "stateOrCountry": "CA", "zipCode": "95014", "isForeignLocation": 0}},
    "phone": "(408) 996-1010",
    "formerNames": [{"name": "APPLE INC", "from": "2007-01-10T05:00:00.000Z", "to": "2019-08-05T04:00:00.000Z"},
                    {"name": "APPLE COMPUTER INC", "from": "1994-01-26T05:00:00.000Z", "to": "2007-01-04T05:00:00.000Z"}],
}


def test_parse_us_submission_apple():
    rec = cp.parse_us_submission(AAPL_SUB)
    assert rec["cik"] == 320193
    assert rec["addr"] == "ONE APPLE PARK WAY, CUPERTINO, CA 95014"
    assert rec["fye"] == "0926"
    assert rec["exch"] == ["Nasdaq"]
    assert "web" not in rec                      # 빈 website 는 싣지 않는다
    assert rec["former"][0] == ["APPLE INC", "2007", "2019"]


def test_parse_us_submission_foreign_and_dedupe():
    d = dict(AAPL_SUB, name="TAIWAN SEMICONDUCTOR MANUFACTURING CO LTD", exchanges=["NYSE", "NYSE", "OTC"],
             addresses={"business": {"street1": "NO. 8, LI-HSIN ROAD 6", "street2": "HSINCHU SCIENCE PARK",
                                     "city": "HSINCHU", "stateOrCountry": None, "zipCode": None,
                                     "isForeignLocation": 1, "country": "Taiwan"}}, formerNames=[])
    rec = cp.parse_us_submission(d)
    assert rec["exch"] == ["NYSE", "OTC"]
    assert rec["addr"].endswith("HSINCHU, Taiwan")
    assert rec["country"] == "Taiwan"
    assert "former" not in rec
    assert cp.parse_us_submission({}) is None


# ───────────────────────── 목표주가

AAPL_PT = {"data": {"symbol": "aapl", "consensusOverview": {"lowPriceTarget": 245.0, "highPriceTarget": 400.0,
                                                            "priceTarget": 334.9, "buy": 15, "sell": 4, "hold": 9},
                    "historicalConsensus": [
                        {"z": {"buy": 14, "hold": 13, "sell": 2, "date": "09/01/2025", "consensus": "Buy", "latest": None}, "x": 1, "y": 232.14},
                        {"z": {"buy": 15, "hold": 9, "sell": 4, "date": "09/01/2026", "consensus": "Buy",
                               "latest": {"high": 327.3, "avg": 321.02, "low": 314.73}}, "x": 2, "y": 334.9}]},
           "message": None, "status": {"rCode": 200, "bCodeMessage": None}}


def test_parse_targetprice_ok_and_history_has_no_price():
    kind, rec = pt.parse_targetprice(AAPL_PT)
    assert kind == "ok"
    assert (rec["lo"], rec["avg"], rec["hi"]) == (245.0, 334.9, 400.0)
    assert (rec["buy"], rec["hold"], rec["sell"], rec["n"]) == (15, 9, 4, 28)
    # y 는 그달 주가라 싣지 않는다 — 의견 분포만.
    assert rec["hist"] == [["2025-09", 14, 13, 2], ["2026-09", 15, 9, 4]]


def test_parse_targetprice_no_coverage_and_bad():
    none1 = {"data": None, "status": {"rCode": 400, "bCodeMessage": [{"code": 1001, "errorMessage": "Symbol not exists."}]}}
    none2 = {"data": None, "status": {"rCode": 200, "bCodeMessage": [{"code": 1002, "errorMessage": "No record found."}]}}
    assert pt.parse_targetprice(none1) == ("none", None)
    assert pt.parse_targetprice(none2) == ("none", None)
    assert pt.parse_targetprice({"data": None, "status": {"rCode": 500}})[0] == "bad"
    assert pt.parse_targetprice("x")[0] == "bad"


def test_parse_targetprice_drops_inconsistent_range():
    bad = json.loads(json.dumps(AAPL_PT))
    bad["data"]["consensusOverview"]["lowPriceTarget"] = 500.0
    kind, rec = pt.parse_targetprice(bad)
    assert kind == "ok" and "lo" not in rec and rec["n"] == 28


# ───────────────────────── 샤드

def test_write_shards_only_rewrites_changed(tmp_path):
    recs = {"AAPL": {"a": 1}, "NVDA": {"a": 2}, "MSFT": {"a": 3}}
    written, ver = shard_store.write_shards(tmp_path, "us_", 4, recs)
    assert len(ver) == 4 and len(written) == 4
    assert shard_store.load_shards(tmp_path, "us_", 4) == recs
    written2, ver2 = shard_store.write_shards(tmp_path, "us_", 4, recs)
    assert written2 == [] and ver2 == ver
    recs["NVDA"] = {"a": 9}
    written3, ver3 = shard_store.write_shards(tmp_path, "us_", 4, recs)
    assert [p.name for p in written3] == [shard_store.shard_name("us_", shard_store.shard_of("NVDA", 4))]
    assert ver3 != ver


def test_shard_of_matches_js_known_values():
    # company-info-core.js 테스트와 같은 값(test_company_info_core.mjs).
    assert shard_store.shard_of("AAPL", 16) == 12
    assert shard_store.shard_of("005930", 32) == 24


# 점 티커(주식 클래스) — Nasdaq 은 BRK.B 를 알아보지만 targetprice 가 비어 있어(2026-09-26 실측) Yahoo 로 보충.
def _yahoo_result(lo=510.0, avg=547.6667, hi=604.0, cur="USD", trend=None):
    return {
        "financialData": {"targetLowPrice": {"raw": lo}, "targetMeanPrice": {"raw": avg},
                          "targetHighPrice": {"raw": hi}, "financialCurrency": cur},
        "recommendationTrend": {"trend": trend if trend is not None else [
            {"period": "0m", "strongBuy": 1, "buy": 1, "hold": 2, "sell": 0, "strongSell": 1},
            {"period": "-1m", "strongBuy": 9, "buy": 9, "hold": 9, "sell": 9, "strongSell": 9}]},
    }


def test_yahoo_symbol_and_share_class():
    assert pt.yahoo_symbol("BRK.B") == "BRK-B" and pt.yahoo_symbol("hei.a") == "HEI-A"
    assert pt.is_share_class("BF.B") and not pt.is_share_class("AAPL")


def test_parse_yahoo_summary_maps_to_nasdaq_schema():
    kind, rec = pt.parse_yahoo_summary(_yahoo_result())
    assert kind == "ok"
    assert rec == {"lo": 510.0, "avg": 547.67, "hi": 604.0, "buy": 2, "hold": 2, "sell": 1, "n": 5, "src": "yahoo"}


def test_parse_yahoo_summary_rejects_bad_range_currency_and_empty():
    kind, rec = pt.parse_yahoo_summary(_yahoo_result(lo=700, avg=547, hi=604))
    assert kind == "ok" and "avg" not in rec and rec["n"] == 5          # 범위만 빼고 의견은 남김
    kind, rec = pt.parse_yahoo_summary(_yahoo_result(cur="CAD", trend=[]))
    assert kind == "none" and rec is None                               # 달러가 아닌 목표가는 싣지 않는다
    assert pt.parse_yahoo_summary({"financialData": {}, "recommendationTrend": {}}) == ("none", None)
    assert pt.parse_yahoo_summary(None) == ("none", None)


def test_universe_adds_share_classes_beyond_top(tmp_path, monkeypatch):
    snap = tmp_path / "snap.json"
    snap.write_text(json.dumps({"stocks": [
        {"ticker": "AAPL", "marketCapB": 3000}, {"ticker": "BRK.B", "marketCapB": 1000},
        {"ticker": "XYZ", "marketCapB": 5}, {"ticker": "HEI.A", "marketCapB": 4},
        {"ticker": "SPY", "marketCapB": 9999, "sector": "EXCHANGE TRADED FUNDS"},
    ]}), encoding="utf-8")
    monkeypatch.setattr(pt, "SNAPSHOT", snap)
    assert pt.universe(2) == ["AAPL", "BRK.B", "HEI.A"]
