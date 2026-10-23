"""국내 재무 안전 묶음(build_kr_fin_safety.py) + 기업개요 직원 급여·근속·보수(build_company_profile.py) 파서 테스트.

픽스처는 2026-10-23 실제 OpenDART DS002 응답(회사 식별 필드만 뺐다): fixtures/kr_fin_safety/<종목>_<API>_<연도>_<보고서>.json
네트워크 없음. 실행: py -m pytest -q scripts/tests/test_kr_fin_safety.py
"""
from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import build_company_profile as cp
import build_kr_fin_safety as fs

FIX = Path(__file__).parent / "fixtures" / "kr_fin_safety"


def fx(name: str) -> dict:
    return json.loads((FIX / f"{name}.json").read_text(encoding="utf-8"))


def rows(name: str) -> list[dict]:
    return fx(name)["list"]


# ───────────────────────── 미상환 잔액

def test_bond_ladder_sk_hynix_uses_total_row_and_groups_over_3y():
    got = fs.parse_debt(rows("000660_cprndNrdmpBlce_2026_11012"), fs.DEBT_KINDS["bond"][1])
    assert got["sm"] == 11_861_175_000_000
    # 3~4년 520,000 + 4~5년 2,826,400 + 5~10년 1,406,125 (억 단위 아님 — 원)
    assert got["l"] == [1_250_750_000_000, 2_841_500_000_000, 3_016_400_000_000, 4_752_525_000_000]
    assert sum(got["l"]) == got["sm"]


def test_cp_ladder_hyundai_tolerates_one_million_rounding():
    # 칸 합 4,514,410 백만 vs 합계 4,514,411 백만 — 원문 반올림. 허용 오차 안이라 싣는다.
    got = fs.parse_debt(rows("005380_entrprsBilScritsNrdmpBlce_2026_11012"), fs.DEBT_KINDS["cp"][1])
    assert got["sm"] == 4_514_411_000_000
    assert got["l"][0] == 4_474_410_000_000 and got["l"][1] == 40_000_000_000


def test_short_term_bond_keeps_issue_limit():
    got = fs.parse_debt(rows("005380_srtpdPsndbtNrdmpBlce_2026_11012"), fs.DEBT_KINDS["stb"][1])
    assert got["l"] == [1_295_000_000_000, 0, 0, 0]
    assert got["lim"] == [4_500_000_000_000, 3_205_000_000_000]


def test_zero_balance_is_data_not_missing():
    # 알테오젠 2026 반기 — 표는 있고 전부 '-'
    assert fs.parse_debt(rows("196170_cprndNrdmpBlce_2026_11012"), fs.DEBT_KINDS["bond"][1]) == {"sm": 0}


def test_debt_mismatch_is_dropped():
    bad = [{"remndr_exprtn2": "합계", "sm": "1,000,000,000", "yy1_below": "100,000,000"}]
    assert fs.parse_debt(bad, fs.DEBT_KINDS["bond"][1]) is None
    assert fs.parse_debt([], fs.DEBT_KINDS["bond"][1]) is None


# ───────────────────────── 자금 사용내역

def test_funds_group_by_issue_plan_vs_actual():
    out, more = fs.parse_funds({"pub": rows("096770_pssrpCptalUseDtls_2026_11012"),
                                "prv": rows("096770_prvsrpCptalUseDtls_2026_11012")}, date(2026, 10, 23))
    assert more == 0
    rights = [r for r in out if r[1] == "유상증자" and r[0] == "공모"]
    assert rights == [["공모", "유상증자", "", "2023-09-19", "시설자금", 418_522_000_000, 69_855_000_000, ""]]
    assert out[0][3] >= out[-1][3]                       # 최근 순
    assert any(r[0] == "사모" and r[1] == "신종자본증권" and r[5] == 700_000_000_000 for r in out)


def test_funds_merged_cell_row_inherits_previous_issue():
    # 에이치엘비: 2행이 '-' 납입일로 와서 바로 윗행(2020-06-05 유상증자)의 실제 사용(타법인증권 13,210백만)을 잇는다.
    # 5년(2021-10-23 이전) 밖이라 오늘 기준으로는 빠지고, 2025 기준으로는 한 건으로 합쳐진다.
    out, _ = fs.parse_funds({"pub": rows("028300_pssrpCptalUseDtls_2026_11012")}, date(2025, 1, 1))
    first = [r for r in out if r[3] == "2020-06-05"]
    assert len(first) == 1
    expect, cur = 0, None
    for r in rows("028300_pssrpCptalUseDtls_2026_11012"):
        if r["pay_de"] != "-":
            cur = r["pay_de"]
        if cur == "2020.06.05" and r["real_cptal_use_dtls_amount"] != "-":
            expect += int(r["real_cptal_use_dtls_amount"].replace(",", ""))
    assert first[0][6] == expect and expect > 48_185_000_000 + 13_210_000_000
    now, _ = fs.parse_funds({"pub": rows("028300_pssrpCptalUseDtls_2026_11012")}, date(2026, 10, 23))
    assert [r[3] for r in now] == ["2022-12-09"]      # 2020 납입분은 5년 밖


# ───────────────────────── 감사

def test_audit_samsung_unit_inferred_and_nonaudit_ratio():
    a = fs.parse_audit(rows("005930_adtServcCnclsSttus_2025_11011"), rows("005930_accnutAdtorNonAdtServcCnclsSttus_2025_11011"))
    y = a["years"]
    assert y[0] == {"by": "삼정회계법인", "t": 57, "fee": 8_100_000_000, "h": 80540, "na": 0, "nr": 0.0}
    # 제56기: 3건 중 1건 금액이 '-' — 비율을 내지 않는다
    assert y[1]["na"] == 3 and "nr" not in y[1]
    # 제55기: (202+27+79+25)/7,800
    assert y[2]["nr"] == round(333 / 7800, 4)


def test_audit_unit_mismatch_hides_ratio_kepco():
    a = fs.parse_audit(rows("015760_adtServcCnclsSttus_2025_11011"), rows("015760_accnutAdtorNonAdtServcCnclsSttus_2025_11011"))
    y0 = a["years"][0]
    assert y0["fee"] == 2_763_000_000 and y0["by"] == "삼정회계법인"
    assert y0["na"] > 0 and "nr" not in y0          # 비감사 표가 천원 단위 — 같은 단위로 보면 100% 초과


def test_audit_amount_cells_with_trailing_text_lg_chem():
    a = fs.parse_audit(rows("051910_adtServcCnclsSttus_2025_11011"), [])
    assert a["years"][0]["fee"] == 2_540_000_000 and a["years"][0]["h"] == 21009


def test_audit_empty_table_hyundai():
    assert fs.parse_audit(rows("005380_adtServcCnclsSttus_2025_11011"), []) is None


def test_audit_unit_rules():
    assert fs.audit_unit(165, 1650) == 1_000_000
    assert fs.audit_unit(165_000, 1650) == 1_000
    assert fs.audit_unit(None, 10) is None and fs.audit_unit(100, 0) is None


# ───────────────────────── 보고서 고르기 · 요약

def test_report_candidates():
    assert fs.report_candidates(date(2026, 10, 23)) == [(2026, "11012"), (2026, "11013"), (2025, "11011")]
    assert fs.report_candidates(date(2026, 11, 20))[0] == (2026, "11014")
    assert fs.report_candidates(date(2027, 2, 1)) == [(2026, "11014"), (2026, "11012"), (2026, "11013")]
    assert fs.report_candidates(date(2027, 4, 2))[0] == (2026, "11011")


def test_summarize_converts_to_million_and_marks_zero():
    raw = {"debt": {"asOf": "2026-06-30", "p": "2026 반기", "rc": "20260814003509",
                    "kinds": {"bond": {"l": [1_000_000, 0, 0, 2_000_000], "sm": 3_000_000}, "cp": {"sm": 0}, "stb": None}},
           "funds": {"rc": "20260814003509", "p": "2026 반기", "rows": [["공모", "회사채", "1", "2025-01-01", "운영", 5_000_000, None, ""]]},
           "audit": {"y": 2025, "rc": "x", "years": [{"by": "A", "fee": 81_000_000}]}}
    rec = fs.summarize_company(raw, date(2026, 10, 23))
    assert rec["debt"]["k"] == {"bond": {"l": [1, 0, 0, 2], "sm": 3}}       # 잔액 0 인 CP·없는 단기사채는 열에서 뺀다
    assert "rc" not in rec["funds"]                  # 미상환 표와 같은 접수번호는 한 번만
    assert rec["funds"]["rows"][0][5:] == [5, None]
    assert rec["audit"]["years"][0]["fee"] == 81
    zero = fs.summarize_company({"debt": {"asOf": "2026-06-30", "kinds": {"bond": {"sm": 0}}}}, date(2026, 10, 23))
    assert zero == {"debt": {"asOf": "2026-06-30", "zero": True}}
    assert fs.summarize_company({}, date(2026, 10, 23)) is None


def test_plan_jobs_skips_done_and_puts_new_first():
    cands = [(2026, "11012"), (2026, "11013"), (2025, "11011")]
    state = {"A": {"rp": "2026-11012", "ay": 2025, "pv": fs.PARSER_VERSION},
             "B": {"rp": "2026-11013", "ay": 2025, "pv": fs.PARSER_VERSION},
             "C": {"rp": "2026-11013", "ay": 2025, "pv": fs.PARSER_VERSION, "tried": "2026-10-23"}}
    jobs = fs.plan_jobs(["A", "B", "C", "D"], state, cands, 2025, date(2026, 10, 23))
    assert jobs == [("D", True, True), ("B", True, False)]


# ───────────────────────── 기업개요: 급여·근속·보수

def test_employees_salary_tenure_samsung():
    got = cp.parse_kr_employees(rows("005930_empSttus_2025_11011"))
    assert got["emp"] == 128881
    # 성별합계 행 둘: 남 94,273명 1.67억 · 여 34,608명 1.30억 → 인원 가중
    assert got["empSal"] == round((167e6 * 94273 + 130e6 * 34608) / 128881 / 1e6) * 1_000_000
    assert got["empTen"] == round((14.0 * 94273 + 13.0 * 34608) / 128881, 1)


def test_employees_tenure_years_months_lg_chem():
    got = cp.parse_kr_employees(rows("051910_empSttus_2025_11011"))
    assert got["emp"] == 12869
    assert 12.0 < got["empTen"] < 15.0
    assert cp.parse_tenure("14년 11개월") == 14 + 11 / 12
    assert cp.parse_tenure("8개월") == 8 / 12
    assert cp.parse_tenure("      17.4") == 17.4
    assert cp.parse_tenure("-") is None


def test_top_pay_v1_and_v2():
    v1 = cp.parse_kr_top_pay(fx("005930_indvdlByPay_2025_11011"), False)
    assert len(v1) == 5 and v1[0][2] == 13_407_000_000 and v1 == sorted(v1, key=lambda r: -r[2])
    assert "\n" not in v1[0][1]
    v2 = cp.parse_kr_top_pay(fx("000660_indvdlByPayV2_2026_11012"), True)
    assert v2 and all(r[0] for r in v2)
    assert v2[0] == ["곽노정", "사장", 26_095_000_000]          # 당기만(전기 4,239백만 행은 버린다)
    assert cp.parse_kr_top_pay(fx("028300_indvdlByPay_2025_11011"), False) == []   # '-' 한 줄 = 5억 이상 없음
    assert cp.parse_kr_top_pay({"status": "013"}, False) is None


def test_merge_emp_hist_keeps_last_three_sorted():
    h = cp.merge_emp_hist([[2022, 10, None], [2024, 12, 5]], 2023, 11, 4)
    h = cp.merge_emp_hist(h, 2025, 13, 6)
    assert h == [[2023, 11, 4], [2024, 12, 5], [2025, 13, 6]]


def test_kr_priority_pay_then_hist_for_top_only():
    today = date(2026, 9, 26)
    records = {t: {"name": t, "empYear": 2025, "emp": 1} for t in ("A", "B", "C")}
    base = {"c": "2026-09-20", "e": 2025, "ev": cp.EMP_PARSER}
    state = {"A": dict(base), "B": {**base, "p": 2025}, "C": {**base, "p": 2025}}
    plan = cp.kr_priority(["A", "B", "C"], records, state, 2025, set(), today, hist_top=2)
    assert plan == [("A", "pay"), ("B", "hist")]
