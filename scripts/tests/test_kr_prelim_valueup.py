"""국내 잠정실적 숫자 파싱 · 밸류업 모아보기 · 실적 예정일 추정 (2026-10-02) 회귀 테스트.

픽스처는 DART document.xml 실제 원문이다(scripts/tests/fixtures/kr_prelim/). 네트워크는 쓰지 않는다.
  006800 미래에셋증권 2026 2분기 연결 잠정실적(단위 백만원)
  017860 DS단석 [기재정정] — 앞에 '정정사항' 표가 붙은 양식, 흑자전환 표기
  114090 GKL 2026년 9월 — 표준 표는 '-' 이고 자체 '카지노매출액' 표만 있는 월별 공시
  009970 영원무역홀딩스 주식소각결정 · 439090 마녀공장 자기주식취득 신탁계약(값이 TE 셀)
"""
from __future__ import annotations

from datetime import date
from pathlib import Path

import build_kr_earnings_calendar as C
import build_kr_valueup as V
import kr_prelim_parse as P

FIX = Path(__file__).resolve().parent / "fixtures" / "kr_prelim"


def _doc(name: str) -> str:
    return (FIX / name).read_text(encoding="utf-8")


# --------------------------------------------------------------------------
# 잠정실적 파서
# --------------------------------------------------------------------------

def test_quarterly_consolidated_units_are_eok():
    p = P.parse_prelim(_doc("006800_2026q2_consolidated.xml"))
    assert p["consolidated"] is True
    assert p["periodLabel"] == "2026년 2분기" and p["periodMonths"] == 3
    op = p["items"]["op"]
    assert op["cur"] == 24898.73          # 2,489,873 백만원 = 24,898.73 억원 (LLM 은 여기서 10배 틀렸다)
    assert op["yoy"] == 397.5 and op["cum"] == 38649.13
    assert P.summarize(p) == ("2026년 2분기 매출 21.63조원(전년 대비 +181.1%), "
                              "영업이익 2.49조원(전년 대비 +397.5%), 지배순이익 1.9조원(전년 대비 +370.1%)")


def test_correction_filing_reads_body_table_and_turnaround():
    p = P.parse_prelim(_doc("017860_2026q2_correction.xml"))
    assert p["items"]["op"]["yoyTurn"] == "흑자전환"
    assert "영업이익 62.9억원(흑자전환)" in P.summarize(p)


def test_monthly_custom_money_table():
    p = P.parse_prelim(_doc("114090_2026-09_casino_monthly.xml"))
    assert p["items"] == {} and p["periodLabel"] == "2026년 9월"
    assert p["custom"]["label"] == "카지노매출액" and p["custom"]["cur"] == 372.76
    assert P.summarize(p) == "2026년 9월 카지노매출액 373억원(전년 대비 +7.2%)"


def test_custom_table_without_money_unit_is_ignored():
    rows = [["구분(단위:대,%)", "당기실적", "전기실적"],
            ["판매대수(내수)", "49,000", "52,000", "-5.8", "-", "53,000", "-7.5", "-"]]
    assert P._custom_metric(rows) is None


def test_fmt_eok():
    assert P.fmt_eok(-439.39) == "-439억원"
    assert P.fmt_eok(23129.95) == "2.31조원"
    assert P.fmt_eok(3.46) == "3.5억원"


def test_consensus_progress_only_consolidated_same_fy():
    p = P.parse_prelim(_doc("006800_2026q2_consolidated.xml"))
    est = {"estimateFy": "2026.12", "revenueEstimate": 720000, "operatingEstimate": 77298}
    prog = P.consensus_progress(p, est)
    assert prog == {"estimateFy": "2026.12", "revenueProgressPct": 50.1, "opProgressPct": 50.0}
    assert P.consensus_progress(p, {**est, "estimateFy": "2025.12"}) is None
    assert P.consensus_progress({**p, "consolidated": False}, est) is None


# --------------------------------------------------------------------------
# 밸류업
# --------------------------------------------------------------------------

def test_valueup_classify_keeps_attachment_marked_originals():
    assert V.classify("[첨부추가]기업가치제고계획(자율공시)") == ("plan", "밸류업 계획")
    assert V.classify("[기재정정]주식소각결정") is None
    assert V.classify("기업가치제고계획(자율공시) (2025년 이행현황)") == ("plan", "밸류업 이행현황")
    assert V.classify("주요사항보고서(자기주식취득신탁계약체결결정)") == ("buyback", "신탁 취득")
    assert V.classify("주요사항보고서(자기주식처분결정)") is None


def test_parse_cancel_and_trust_buyback_from_te_cells():
    c = V.parse_cancel(P.table_rows(_doc("009970_cancel.xml")))
    assert c["shares"] == 712460 and c["totalShares"] == 12953817 and c["sharesPct"] == 5.5
    b = V.parse_buyback(P.table_rows(_doc("439090_buyback_trust.xml")))
    assert b["amount"] == 5_000_000_000


def test_dividend_yoy_same_kind_about_a_year_ago():
    hist = [["2025-10-01", "분기배당", 800.0], ["2026-07-01", "분기배당", 900.0], ["2025-09-25", "결산배당", 2000.0]]
    assert V.dividend_yoy(hist, "2026-10-01", "분기배당", 960.0) == {
        "prevDps": 800.0, "prevDate": "2025-10-01", "dpsYoyPct": 20.0}
    assert V.dividend_yoy(hist, "2026-10-01", "중간배당", 960.0) is None  # 같은 종류가 없으면 판단 안 함


# --------------------------------------------------------------------------
# 실적 예정일 추정
# --------------------------------------------------------------------------

def _hist(rows):
    h: dict = {}
    C.ingest(h, rows)
    return h


def _r(ticker, title, d):
    return {"ticker": ticker, "title": title, "fileDate": d}


def test_estimate_uses_last_year_prelim_plus_364_days():
    h = _hist([_r("005930", "[첨부추가]연결재무제표기준영업(잠정)실적(공정공시)", "2025-10-14"),
               _r("005930", "분기보고서 (2025.09)", "2025-11-14")])
    rows = C.estimate(h, date(2026, 10, 2))
    assert rows[0]["nextDate"] == "2026-10-13" and rows[0]["basis"] == "prelim"


def test_monthly_separate_filings_do_not_mask_quarterly_consolidated():
    """현대차: 월별 판매(별도 '영업(잠정)실적')와 분기 실적('연결재무제표기준…')이 섞여 있다."""
    rows = [_r("005380", "영업(잠정)실적(공정공시)", d) for d in ("2025-10-01", "2025-11-03", "2025-12-01", "2026-10-01")]
    rows.append(_r("005380", "연결재무제표기준영업(잠정)실적(공정공시)", "2025-10-30"))
    out = C.estimate(_hist(rows), date(2026, 10, 2))
    assert out[0]["nextDate"] == "2026-10-29"  # 10-01 의 9월 판매 공시를 '이미 발표'로 보지 않는다


def test_already_reported_this_quarter_is_dropped_and_report_fallback():
    h = _hist([_r("000001", "연결재무제표기준영업(잠정)실적(공정공시)", "2025-10-20"),
               _r("000001", "연결재무제표기준영업(잠정)실적(공정공시)", "2026-10-02"),
               _r("000002", "분기보고서 (2025.09)", "2025-11-14")])
    out = {r["ticker"]: r for r in C.estimate(h, date(2026, 10, 3))}
    assert "000001" not in out
    assert out["000002"]["basis"] == "report" and out["000002"]["nextDate"] == "2026-11-13"


def test_quarter_of_prelim():
    assert C.quarter_of_prelim("2026-02-05") == "2025.12"
    assert C.quarter_of_prelim("2026-07-07") == "2026.06"
    assert C.quarter_of_prelim("2026-10-13") == "2026.09"
