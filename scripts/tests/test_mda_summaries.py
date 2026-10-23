"""build_mda_summaries.py — 네트워크 없이 MD&A 구간 추출·숫자 가드·정기보고서 목록만 본다."""
from __future__ import annotations

import build_mda_summaries as M


def _body(n=60, word="Revenue increased due to higher demand in the Services segment and pricing. "):
    return [word * 3 for _ in range(n)]


def test_extract_10q_item2_skips_toc_and_stops_at_item3():
    lines = (["PART I", "Item 2. Management's Discussion and Analysis of Financial Condition", "Item 3. Quantitative and Qualitative Disclosures About Market Risk", "Item 4. Controls"]
             + ["Item 1. Financial Statements"] + _body(30, "Net sales table row. ")
             + ["Item 2. Management's Discussion and Analysis of Financial Condition and Results of Operations"] + _body()
             + ["Item 3. Quantitative and Qualitative Disclosures About Market Risk", "Interest rate risk text."] + _body(200, "Market risk. "))
    body, how = M.extract_mda(lines, "10-Q")
    assert how == "item"
    assert body[0].startswith("Revenue increased") and len(body) == 60


def test_extract_10k_item7_split_heading_and_7a_end():
    lines = (["Item 7.", "Management's Discussion and Analysis of Financial Condition and Results of Operations"] + _body()
             + ["Item 7A. Quantitative and Qualitative Disclosures About Market Risk"] + _body(400, "Other text. "))
    body, how = M.extract_mda(lines, "10-K")
    assert how == "item" and len(body) == 60


def test_extract_heading_fallback_and_failure():
    lines = ["Management's Discussion and Analysis"] + _body() + ["Controls and Procedures"] + _body(400, "Other text. ")
    body, how = M.extract_mda(lines, "10-Q")
    assert how == "heading" and len(body) == 60
    body, why = M.extract_mda(["Item 2. Management's Discussion and Analysis", "See page 40."], "10-Q")
    assert body is None and why == "too_short"
    body, why = M.extract_mda(_body(), "10-Q")
    assert body is None and why == "no_section"


def test_sanitize_drops_unverified_numbers_and_judgment():
    cur = "Net sales were $94.9 billion, up 6%. Services grew 12%."
    prev = "Net sales were $90.1 billion."
    clean, dropped = M.sanitize({
        "summary": ["매출은 $94.9 billion, 6% 증가", "서비스 매출 15% 증가", "호실적을 기록", "  ", "- Services 12% 성장"],
        "changes": ["직전 $90.1 billion 에서 늘었다", "직전 $80 billion"],
    }, cur, prev)
    assert clean["summary"] == ["매출은 $94.9 billion, 6% 증가", "Services 12% 성장"]
    assert clean["changes"] == ["직전 $90.1 billion 에서 늘었다"]
    assert dropped == 3


def test_periodic_filings_excludes_amendments_and_non_html():
    block = {"form": ["10-Q", "8-K", "10-Q/A", "10-K", "10-Q"],
             "filingDate": ["2026-07-31", "2026-07-30", "2026-06-01", "2025-10-31", "2026-05-01"],
             "accessionNumber": ["0000320193-26-000020", "x", "y", "0000320193-25-000079", "0000320193-26-000013"],
             "primaryDocument": ["aapl-20260627.htm", "a.htm", "b.htm", "aapl-20250927.htm", "aapl.txt"],
             "reportDate": ["2026-06-27", "", "", "2025-09-27", "2026-03-28"]}
    rows = M.periodic_filings(block, 320193)
    assert [r["acc"] for r in rows] == ["0000320193-26-000020", "0000320193-25-000079"]
    assert rows[0]["url"].endswith("/320193/000032019326000020/aapl-20260627.htm")
    assert rows[0]["indexUrl"].endswith("0000320193-26-000020-index.htm")
