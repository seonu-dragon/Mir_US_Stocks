"""10-K 위험요인 변화 빌더(build_risk_factor_changes.py) 순수 로직 테스트. 네트워크 없음.

문서는 실제 10-K·20-F 를 HTML → 줄로 푼 모양(목차 링크 · 본문 Item 1A · 쪽 머리말 · 통합 연차보고서의 상호참조표)을
손으로 줄인 스텁이다(2026-09-28 AAPL·JPM·TSM·ASML·INTC 실호출로 확인한 구조). 문장은 규칙 검증용.

실행: py -m pytest -q scripts/tests/test_risk_factor_changes.py
"""
from __future__ import annotations

import build_risk_factor_changes as rf

RISK = ("The Company could be materially adversely affected if demand for its products declines, and such risks "
        "may harm its business, reputation and results of operations in ways that are difficult to predict {n}.")
GOV = ("The Supervisory Board met eleven times during the year and discussed the composition of the board, the "
       "remuneration policy and the agenda for the general meeting of shareholders held in April {n}.")


def _risk_body(n: int, tag: str = "") -> list[str]:
    return [RISK.format(n=f"{tag}{i}") for i in range(n)]


# 실제 10-K 에서 위험요인은 문서의 5~20% 다. 스텁 문서도 뒤에 재무제표 몫의 긴 본문을 붙여 비율 검사를 현실에 맞춘다.
TAIL = ["Consolidated Statements of Operations for the fiscal years presented in millions of dollars "
        f"including net sales, cost of sales and operating expenses by segment line item {i}." for i in range(300)]


# ────────────────────────────── HTML → 줄 ──────────────────────────────
def test_html_to_lines_drops_hidden_xbrl_and_splits_blocks():
    html = ('<html><head><title>x</title></head><body><ix:header><ix:hidden>SECRET</ix:hidden></ix:header>'
            '<div style="display: none">HIDDEN</div><p>Item&#160;1A. Risk Factors</p>'
            '<p>We may fail — to compete’s</p><table><tr><td>a</td><td>b</td></tr></table></body></html>')
    lines = rf.html_to_lines(html)
    assert "SECRET" not in " ".join(lines) and "HIDDEN" not in " ".join(lines)
    assert "Item 1A. Risk Factors" in lines
    assert "We may fail - to compete's" in lines
    assert "a b" in lines


# ────────────────────────────── 구간 추출 ──────────────────────────────
def _tenk(body: list[str]) -> list[str]:
    toc = ["Table of Contents", "Item 1. Business", "Item 1A. Risk Factors", "Item 1B. Unresolved Staff Comments",
           "Item 2. Properties"]
    return toc + ["Item 1. Business", "We design products."] + ["Item 1A. Risk Factors"] + body + \
        ["Item 1B. Unresolved Staff Comments", "None.", "Item 2. Properties", "We own buildings."] + TAIL


def test_extract_picks_body_section_not_toc_entry():
    body = _risk_body(40)
    got, how = rf.extract_risk_section(_tenk(body), "10-K")
    assert how == "item"
    assert got == body


def test_extract_item_alone_then_heading_line():
    lines = ["Item 1A.", "Risk Factors"] + _risk_body(40) + ["Item 2. Properties", "x"] + TAIL
    got, how = rf.extract_risk_section(lines, "10-K")
    assert how == "item" and len(got) == 40


def test_extract_cybersecurity_item_1c_ends_section():
    lines = ["Item 1A. Risk Factors"] + _risk_body(30) + ["Item 1C. Cybersecurity"] + _risk_body(30, "c")
    got, _ = rf.extract_risk_section(lines, "10-K")
    assert len(got) == 30


def test_extract_too_short_when_only_cross_reference():
    lines = ["Item 1A. Risk Factors", "See pages 40-60 of the Annual Report, incorporated by reference.",
             "Item 1B. Unresolved Staff Comments"]
    assert rf.extract_risk_section(lines, "10-K") == (None, "too_short")


def test_extract_rejects_non_risk_text():
    lines = ["Item 1A. Risk Factors"] + [GOV.format(n=i) for i in range(40)] + ["Item 2. Properties"] + TAIL
    assert rf.extract_risk_section(lines, "10-K") == (None, "not_risk_text")


def test_extract_20f_item_3d_until_item_4():
    lines = ["Item 3. Key Information", "D. Risk Factors"] + _risk_body(40) + \
        ["Item 4. Information on the Company", "We make chips."] + TAIL
    got, how = rf.extract_risk_section(lines, "20-F")
    assert how == "item" and len(got) == 40


def test_heading_fallback_trims_governance_tail_and_prefers_dense_candidate():
    # 통합 연차보고서: 목차의 'Risk factors'(CEO 서한·전략 장까지 삼키는 긴 구간) + 진짜 위험요인 장 +
    # 지배구조 장, 끝 표지(Item 4)는 한참 뒤. 빈도가 묽은 목차 후보는 버리고, 지배구조 꼬리는 잘라 낸다.
    letter = [GOV.format(n=f"l{i}") for i in range(60)]
    lines = (["Risk factors"] + letter + ["Risk factors"] + _risk_body(60) +
             [GOV.format(n=f"g{i}") for i in range(80)] + ["Item 4", "Cross reference"])
    got, how = rf.extract_risk_section(lines, "20-F")
    assert how == "heading"
    assert got[0] == RISK.format(n="0")
    assert all("Supervisory" not in x for x in got[:60])
    assert len(got) < 60 + 10, "지배구조 꼬리가 거의 다 잘려야 한다"


def test_heading_fallback_stops_at_information_security_heading():
    lines = ["Risk factors"] + _risk_body(40) + ["Information security"] + _risk_body(40, "s") + ["Item 4"]
    got, how = rf.extract_risk_section(lines, "20-F")
    assert how == "heading" and len(got) == 40


# ────────────────────────────── 문단 ──────────────────────────────
def test_paragraphs_drop_page_numbers_and_repeated_headers_and_join_breaks():
    body = ["Apple Inc. | 2025 Form 10-K | 12", "The Company's business could be harmed by many", "factors.",
            "12", "Apple Inc. | 2025 Form 10-K | 12", "Risks Related to Our Business",
            "Apple Inc. | 2025 Form 10-K | 12", "Short heading line"]
    ps = rf.paragraphs(body)
    assert ps[0] == "The Company's business could be harmed by many factors."
    assert "12" not in ps and not any("Form 10-K" in p for p in ps)
    assert "Risks Related to Our Business" in ps


def test_first_sentence_skips_abbreviations_and_caps_length():
    t = "The U.S. government may impose tariffs on Inc. partners. Second sentence here."
    assert rf.first_sentence(t) == "The U.S. government may impose tariffs on Inc. partners."
    long = "word " * 200
    out = rf.first_sentence(long, cap=50)
    assert len(out) <= 52 and out.endswith("…")


def test_words_ignore_numbers_so_year_updates_are_not_changes():
    assert rf.words_of("In 2024 we had 3 plants") == rf.words_of("In 2025 we had 4 plants")


# ────────────────────────────── 비교 ──────────────────────────────
def test_compare_sections_counts_and_similarity():
    base = [
        "Our suppliers could fail to deliver components on time, which may harm our production schedule.",
        "Competition in our markets is intense and could reduce our margins and our market share over time.",
        "We depend on key personnel and the loss of their services could adversely affect our operations.",
        "Our retail stores are subject to numerous risks and uncertainties including leases and staffing.",
    ]
    cur = [
        base[0],                                   # 그대로
        base[1].replace("intense and", "intense, rapidly changing and increasingly global and"),  # 수정(0.75~0.9)
        "We depend on key personnel, and new tariffs imposed under Section 232 on imported goods could adversely affect our operations and costs.",  # 크게 바뀜
        "Artificial intelligence regulation in several jurisdictions may require us to change how our products work.",  # 새 문단
    ]
    out = rf.compare_sections(base, cur)
    c = out["counts"]
    assert c["same"] == 1
    assert c["added"] == 1 and out["added"][0]["t"].startswith("Artificial intelligence")
    assert c["removed"] == 1 and out["removed"][0]["t"].startswith("Our retail stores")
    assert c["changed"] == 2 and c["big"] == 1
    ch = out["changed"][0]
    assert ch["t"].startswith("We depend on key personnel")
    assert any("Section 232" in s for s in ch["ins"]), "새 구절은 대소문자·숫자까지 원문대로"
    assert 0 < out["cos"] < 1 and 0 < out["jac"] < 1
    assert out["paras"] == 4 and out["parasPrev"] == 4


def test_compare_identical_is_one():
    ps = ["Our suppliers could fail to deliver components on time, which may harm our production."]
    out = rf.compare_sections(ps, list(ps))
    assert out["cos"] == 1.0 and out["jac"] == 1.0
    assert out["counts"] == {"added": 0, "removed": 0, "changed": 0, "big": 0, "same": 1}


def test_inserted_phrases_keep_original_case_and_numbers():
    old = "The Company faces competition from other firms in all of its markets worldwide."
    new = ("The Company faces competition from other firms. On August 5, 2024, Google was found to have violated "
           "U.S. antitrust laws in all of its markets worldwide.")
    ins = rf._inserted_phrases(old, new)
    assert ins and "August 5, 2024, Google" in ins[0] and "U.S." in ins[0]


def test_cosine_and_jaccard_edge_cases():
    assert rf.cosine_sim([], ["a"]) is None
    assert rf.jaccard_sim(["a", "b"], ["b", "c"]) == 1 / 3
    assert abs(rf.cosine_sim(["a", "a", "b"], ["a", "b", "b"]) - 0.8) < 1e-9


# ────────────────────────────── 인덱스·증분 ──────────────────────────────
def _row(cos):
    return [cos, 0.9, 1, 1, 1, 0, 1, 100, 100, "2026-02-01", "2025-02-01", "10-K"]


def test_with_percentiles_changed_more_is_higher_and_ties_half():
    rows = rf.with_percentiles({"A": _row(0.999), "B": _row(0.99), "C": _row(0.99), "D": _row(0.95), "E": _row(None)})
    assert rows["D"][-1] == 100          # 가장 많이 바뀜
    assert rows["A"][-1] == 0            # 가장 덜 바뀜
    assert rows["B"][-1] == rows["C"][-1] == round(100 * (1 + 0.5) / 3)
    assert rows["E"][-1] is None
    assert all(len(v) == len(rf.INDEX_COLS) for v in rows.values())


def test_with_percentiles_replaces_stale_pct_column():
    rows = rf.with_percentiles({"A": _row(0.99) + [77], "B": _row(0.98) + [3]})
    assert rows["A"][-1] == 0 and rows["B"][-1] == 100
    assert len(rows["A"]) == len(rf.INDEX_COLS)


def test_with_percentiles_single_ticker_is_none():
    assert rf.with_percentiles({"A": _row(0.99)})["A"][-1] is None


def test_older_files_window_around_prior_year_for_heavy_filers():
    files = [{"name": f"f{i}.json", "filingFrom": f, "filingTo": t} for i, (f, t) in enumerate([
        ("2025-08-22", "2025-09-24"), ("2025-03-31", "2025-04-30"), ("2025-02-27", "2025-03-29"),
        ("2025-01-22", "2025-02-25"), ("2024-12-10", "2025-01-20"), ("2023-01-01", "2023-06-01")])]
    names = rf._older_files(files, [{"filed": "2026-02-13"}])
    assert "f3.json" in names                # 2025-02-14 10-K 가 든 파일
    assert "f0.json" not in names and "f5.json" not in names
    assert rf._older_files(files, [])[:2] == ["f0.json", "f1.json"]   # 연차보고서가 없으면 앞에서부터


def test_annual_rows_filter_forms_and_documents():
    block = {"form": ["10-K", "10-K/A", "8-K", "20-F", "10-K"],
             "filingDate": ["2026-02-01", "2026-03-01", "2026-01-01", "2025-04-01", "2025-02-01"],
             "accessionNumber": ["0001-26-1", "0001-26-2", "0001-26-3", "0001-25-4", "0001-25-5"],
             "primaryDocument": ["a.htm", "b.htm", "c.htm", "d.htm", "e.pdf"],
             "reportDate": ["2025-12-31", "", "", "2024-12-31", "2024-12-31"]}
    rows = rf._annual_rows(block, 123)
    assert [r["acc"] for r in rows] == ["0001-26-1", "0001-25-4"]
    assert rows[0]["url"] == "https://www.sec.gov/Archives/edgar/data/123/0001261/a.htm"


def test_sec_symbol_maps_class_shares():
    assert rf.sec_symbol("brk.b") == "BRK-B"
