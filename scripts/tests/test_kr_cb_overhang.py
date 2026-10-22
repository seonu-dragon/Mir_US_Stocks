"""build_kr_cb_overhang 파서 테스트 — 네트워크 없음.

픽스처는 2026-10-23 에 받은 실제 반기보고서(2026.06) 원문의 표 구조를 줄여 옮긴 것이다
(휴맥스 115160: 금액 단위 원 / 디티앤씨알오 383930: 금액 단위 백만원, CB+BW).
"""
from __future__ import annotations

import build_kr_cb_overhang as b

HEAD = '<TU ALIGN="CENTER" AUNIT="BASE_DT" AUNITVALUE="20260630">2026년 06월 30일</TU>'


def _unit(ko: str, eng: str) -> str:
    return f'<TU ALIGN="RIGHT" AUNIT="WONSTOCK" AUNITVALUE="7" ENG="{eng}">{ko}</TU>'


CB_WON = f"""
<TABLE-GROUP ACLASS="CB" ADELETETABLE="N"><TITLE ATOC="N">미상환 전환사채 발행현황</TITLE>
<TABLE ACLASS="EXTRACTION"><TBODY><TR><TD>(기준일 : </TD>{HEAD}<TD>)</TD>
<TU ALIGN="RIGHT" AUNIT="WONSTOCK" AUNITVALUE="1" ENG="(Unit: KRW, shares)">(단위 : 원, 주)</TU></TR></TBODY></TABLE>
<TABLE ACLASS="EXTRACTION"><TBODY>
<TR ACOPY="Y"><TE ACODE="CB_KND">무기명식 이권부 무보증 사모 전환사채</TE><TE ACODE="CB_SEQ">24</TE>
<TU AUNIT="CB_DT" AUNITVALUE="20250311">2025년 03월 11일</TU><TU AUNIT="CB_FDT" AUNITVALUE="20300311">2030년 03월 11일</TU>
<TE ACODE="CB_EN">10,000,000,000</TE><TE ACODE="CB_KN">(주)휴맥스 보통주</TE><TE ACODE="CB_PE">2026년 3월 11일 ~2030년 2월 11일</TE>
<TE ACODE="CB_RAT">100</TE><TE ACODE="CB_PR">8,632</TE><TE ACODE="CB_AMN">10,000,000,000</TE><TE ACODE="CB_CN">1,158,480</TE><TE ACODE="NOTE">-</TE></TR>
<TR><TD>합 계</TD><TE ACODE="CB_ENT">-</TE><TE ACODE="CB_AMNT">-</TE><TE ACODE="CB_CNT">-</TE></TR>
</TBODY></TABLE></TABLE-GROUP>
"""

CB_MIL = f"""
<TABLE-GROUP ACLASS="CB"><TABLE><TBODY><TR>{HEAD}{_unit("(단위 : 백만원, 주)", "(Unit: KRW million, shares)")}</TR></TBODY></TABLE>
<TABLE><TBODY>
<TR><TE ACODE="CB_SEQ">2회차</TE><TU AUNIT="CB_DT" AUNITVALUE="20260220">2026.02.20</TU><TU AUNIT="CB_FDT" AUNITVALUE="20310220">2031.02.20</TU>
<TE ACODE="CB_PE">2027.02.21 ~ 2031.02.12</TE><TE ACODE="CB_PR">2,473</TE><TE ACODE="CB_AMN">14,000</TE><TE ACODE="CB_CN">5,661,140</TE></TR>
<TR><TD>합 계</TD><TE ACODE="CB_AMNT">14,000</TE><TE ACODE="CB_CNT">5,661,140</TE></TR>
</TBODY></TABLE></TABLE-GROUP>
<TABLE-GROUP ACLASS="BW"><TABLE><TBODY><TR>{HEAD}{_unit("(단위 : 백만원, 주)", "(Unit: KRW million, shares)")}</TR></TBODY></TABLE>
<TABLE><TBODY>
<TR><TE ACODE="BW_SEQ">3회차</TE><TU AUNIT="BW_DT" AUNITVALUE="20260220">2026.02.20</TU><TU AUNIT="BW_FDT" AUNITVALUE="20310220">2031.02.20</TU>
<TE ACODE="BW_PE">2027.02.21 ~ 2031.02.12</TE><TE ACODE="BW_PR">2,473</TE><TE ACODE="BW_AMN">6,000</TE><TE ACODE="BW_CN">2,426,202</TE></TR>
<TR><TD>합 계</TD><TE ACODE="BW_AMNT">6,000</TE><TE ACODE="BW_CNT">2,426,202</TE></TR>
</TBODY></TABLE></TABLE-GROUP>
"""

TOT_STK = f"""
<TABLE-GROUP ACLASS="TOT_STK"><TABLE><TBODY><TR>{HEAD}</TR></TBODY></TABLE><TABLE><TBODY>
<TR><TD>Ⅳ. 발행주식의 총수</TD><TE ACODE="ISU_STK3">12,000,000</TE><TE ACODE="ISU_STK3">784,128</TE><TE ACODE="SUM_ISU_STK3">12,784,128</TE></TR>
</TBODY></TABLE></TABLE-GROUP>
"""

EMPTY_CB = f"""
<TABLE-GROUP ACLASS="CB"><TABLE><TBODY><TR>{HEAD}{_unit("(단위 : 원, 주)", "(Unit: KRW, shares)")}</TR></TBODY></TABLE>
<TABLE><TBODY><TR><TE ACODE="CB_SEQ">-</TE><TE ACODE="CB_PR">-</TE><TE ACODE="CB_AMN">-</TE><TE ACODE="CB_CN">-</TE></TR>
<TR><TE ACODE="CB_CNT">-</TE></TR></TBODY></TABLE></TABLE-GROUP>
"""


def test_parse_won_unit_row():
    p = b.parse_document(CB_WON)
    assert p["hasTables"] and p["verified"]
    assert p["baseDate"] == "2026-06-30"
    (r,) = p["rows"]
    assert r == {"kind": "CB", "seq": "24", "issueDate": "2025-03-11", "maturity": "2030-03-11",
                 "periodEnd": "2030-02-11", "price": 8632, "remaining": 10_000_000_000, "shares": 1_158_480}


def test_parse_million_unit_cb_bw_and_total_shares():
    p = b.parse_document(CB_MIL + TOT_STK)
    assert p["totalShares"] == 12_784_128
    assert [r["kind"] for r in p["rows"]] == ["CB", "BW"]
    assert p["rows"][0]["remaining"] == 14_000_000_000
    assert p["rows"][1]["shares"] == 2_426_202
    rec = b.summarize(p, "2026-10-23")
    assert rec["convShares"] == 8_087_342
    assert rec["pct"] == 63.26
    assert "verified" not in rec
    assert all("periodEnd" not in r for r in rec["rows"])


def test_total_mismatch_marks_unverified():
    bad = CB_MIL.replace('<TE ACODE="CB_CNT">5,661,140</TE>', '<TE ACODE="CB_CNT">9,999,999</TE>')
    p = b.parse_document(bad)
    assert p["verified"] is False
    assert b.summarize(p, "2026-10-23")["verified"] is False


def test_empty_form_has_no_rows():
    p = b.parse_document(EMPTY_CB + TOT_STK)
    assert p["hasTables"] and p["rows"] == []
    assert b.summarize(p, "2026-10-23") is None


def test_no_total_shares_means_no_pct():
    rec = b.summarize(b.parse_document(CB_WON), "2026-10-23")
    assert rec["pct"] is None and rec["convShares"] == 1_158_480


def test_expired_rows_dropped():
    p = b.parse_document(CB_WON)
    assert b.summarize(p, "2030-02-12") is None        # 전환청구기간 끝(2030-02-11) 지남
    assert b.summarize(p, "2030-02-11") is not None


def test_unknown_unit_keeps_shares_drops_amount():
    odd = CB_WON.replace("(단위 : 원, 주)", "(단위 : 달러, 주)").replace("(Unit: KRW, shares)", "(Unit: USD, shares)")
    (r,) = b.parse_document(odd)["rows"]
    assert r["remaining"] is None and r["shares"] == 1_158_480


def test_to_int_refuses_free_text():
    assert b.to_int("1,158,480") == 1158480
    assert b.to_int("8,632원") == 8632
    assert b.to_int("-") is None
    assert b.to_int("조정 후 8,632") is None


def test_pick_latest_reports_prefers_period_over_late_correction():
    rows = [
        {"ticker": "115160", "company": "휴맥스", "title": "반기보고서 (2026.06)", "rceptNo": "20260814001937"},
        {"ticker": "115160", "company": "휴맥스", "title": "[기재정정]사업보고서 (2025.12)", "rceptNo": "20260901000001"},
        {"ticker": "115160", "company": "휴맥스", "title": "분기보고서 (2026.03)", "rceptNo": "20260514000422"},
        {"ticker": "383930", "company": "디티앤씨알오", "title": "반기보고서 (2026.06)", "rceptNo": "20260814003017"},
        {"ticker": "383930", "company": "디티앤씨알오", "title": "[기재정정]반기보고서 (2026.06)", "rceptNo": "20260902000002"},
    ]
    best = b.pick_latest_reports(rows)
    assert best["115160"]["rceptNo"] == "20260814001937"
    assert best["383930"]["rceptNo"] == "20260902000002"
    # 직전 상태보다 오래된 보고서가 다시 스캔돼도 밀리지 않는다
    again = b.pick_latest_reports([rows[2]], best)
    assert again["115160"]["rceptNo"] == "20260814001937"


def test_is_decision():
    assert b.is_decision("[기재정정]주요사항보고서(전환사채권발행결정)")
    assert b.is_decision("주요사항보고서(신주인수권부사채권발행결정)")
    assert not b.is_decision("주요사항보고서(자기전환사채만기전취득결정)")
    assert not b.is_decision("주요사항보고서(교환사채권발행결정)")


def test_cb_row_self_check_rejects_unit_typos():
    # 실측 오기재 유형: 잔액이 단위 표기와 1,000배 어긋남 / 주식수×전환가 ≠ 잔액(판타지오 3.9배)
    base = b.parse_document(CB_WON + TOT_STK)
    assert "verified" not in b.summarize(base, "2026-10-23")
    typo = CB_WON.replace('<TE ACODE="CB_AMN">10,000,000,000</TE>', '<TE ACODE="CB_AMN">10,000,000</TE>')
    rec = b.summarize(b.parse_document(typo + TOT_STK), "2026-10-23")
    assert rec["verified"] is False


def test_cb_row_self_check_respects_conversion_ratio():
    assert b.row_consistent(1000, 1_000_000_000, 1_000_000)
    assert not b.row_consistent(1000, 1_000_000_000, 500_000)
    assert b.row_consistent(1000, 1_000_000_000, 500_000, 50.0)
    assert b.row_consistent(None, 1_000_000_000, 500_000)   # 판단 불가면 막지 않는다
