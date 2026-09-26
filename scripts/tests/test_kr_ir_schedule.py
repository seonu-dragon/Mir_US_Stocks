"""국내 IR 개최 공시 → 실적 발표 예정일(build_kr_ir_schedule.py) 테스트. 오프라인.

원문 텍스트는 실제 공시(2026-07·09 접수) 두 양식을 줄여 옮겼다.
실행: py -m pytest -q scripts/tests/test_kr_ir_schedule.py
"""
from __future__ import annotations

from datetime import date

import build_kr_ir_schedule as ir

KOSPI_DOC = ("현대글로비스/기업설명회(IR) 개최(안내공시)/(2026.07.20) 기업설명회(IR) 개최(안내공시) "
             "1. 일시 및 장소 일시 2026-07-23 15:10 장소 컨퍼런스콜 2. 참가 대상자 국내외 기관투자자 "
             "3. 개최목적 2026년 2분기 경영실적 발표 4. 개최방법 컨퍼런스콜 5. 후원기관 - "
             "6. 주요 설명회내용(요약) 2026년 2분기 경영실적 및 주요 관심사항 7. 결정일자 2026-07-20")
KOSDAQ_DOC = ("LS티라유텍/기업설명회(IR) 개최/(2026.09.23)기업설명회(IR) 개최 기업설명회(IR) 개최 "
              "1. 일시 행사일 시간(현지시간) 시작일 종료일 시작시간 종료시간 2026-09-30 2026-10-01 15:00 18:00 "
              "2. 장소 서울 3. 대상자 국내 기관투자자 등 4. 실시목적 회사소개 및 경영현황에 대한 투자자 이해도 증진 "
              "5. 실시방법 대면미팅(NDR) 6. 주요내용 회사소개, 주요 사업현황 설명 및 질의응답 7. 후원기관 -")
NDR_DOC = ("1. 일시 및 장소 일시 2026-07-28 --:-- 장소 서울 2. 참가 대상자 기관 "
           "3. 개최목적 국내 기관 IR (Non-Deal Roadshow) 실시 4. 개최방법 1:1 미팅 "
           "6. 주요 설명회내용(요약) 2026년 2분기 (주)두산 경영실적 설명 및 Q&A 7. 결정일자 2026-07-24")


def test_notice_filter():
    assert ir.is_ir_notice("기업설명회(IR)개최(안내공시)              ")
    assert ir.is_ir_notice("[기재정정]기업설명회(IR)개최")
    assert not ir.is_ir_notice("기업설명회(IR)개최결과")
    assert not ir.is_ir_notice("영업(잠정)실적(공정공시)")


def test_parse_kospi_form():
    p = ir.parse_ir(KOSPI_DOC)
    assert p["date"] == "2026-07-23" and p["time"] == "15:10" and p["endDate"] is None
    assert p["purpose"] == "2026년 2분기 경영실적 발표"
    assert ir.is_earnings_ir(p)


def test_parse_kosdaq_form_range():
    p = ir.parse_ir(KOSDAQ_DOC)
    assert p["date"] == "2026-09-30" and p["endDate"] == "2026-10-01" and p["time"] == "15:00"
    assert not ir.is_earnings_ir(p)


def test_ndr_after_release_is_not_earnings():
    p = ir.parse_ir(NDR_DOC)
    assert p["date"] == "2026-07-28" and p["time"] is None
    assert not ir.is_earnings_ir(p)


def test_build_uses_cache_and_correction():
    listing = [
        {"rcept_no": "20260720800001", "report_nm": "기업설명회(IR)개최(안내공시)", "stock_code": "086280",
         "corp_name": "현대글로비스", "corp_cls": "Y"},
        {"rcept_no": "20260721800002", "report_nm": "[기재정정]기업설명회(IR)개최(안내공시)", "stock_code": "086280",
         "corp_name": "현대글로비스", "corp_cls": "Y"},
        {"rcept_no": "20260721800003", "report_nm": "기업설명회(IR)개최결과", "stock_code": "000001",
         "corp_name": "X", "corp_cls": "Y"},
        {"rcept_no": "20260721800004", "report_nm": "기업설명회(IR)개최", "stock_code": "",
         "corp_name": "비상장", "corp_cls": "E"},
    ]
    corrected = KOSPI_DOC.replace("2026-07-23 15:10", "2026-07-24 16:00")
    docs = {"20260720800001": KOSPI_DOC, "20260721800002": corrected}
    calls = []

    def get_doc(rc):
        calls.append(rc)
        return docs.get(rc)

    rows, stats, skip = ir.build(listing, {}, get_doc, date(2026, 7, 20))
    assert [r["rcept"] for r in rows] == ["20260721800002"]      # 정정이 원 공시를 대체(목적이 같음)
    assert rows[0]["date"] == "2026-07-24" and rows[0]["earnings"] is True
    assert rows[0]["link"].endswith("20260721800002")
    assert "20260720800001" in skip
    assert stats["notices"] == 2 and calls == ["20260720800001", "20260721800002"]
    # 두 번째 실행: 캐시·skip 으로 원문을 다시 받지 않는다.
    calls.clear()
    rows2, stats2, _ = ir.build(listing, {r["rcept"]: r for r in rows}, get_doc, date(2026, 7, 20), set(skip))
    assert calls == [] and stats2["cached"] == 2 and len(rows2) == 1


def test_past_rows_pruned():
    listing = [{"rcept_no": "20260701800001", "report_nm": "기업설명회(IR)개최", "stock_code": "086280",
                "corp_name": "A", "corp_cls": "Y"}]
    rows, _, skip = ir.build(listing, {}, lambda rc: KOSPI_DOC, date(2026, 8, 30))
    assert rows == [] and skip == ["20260701800001"]
