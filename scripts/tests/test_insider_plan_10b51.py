"""내부자 거래(build_insider_trades.py) Rule 10b5-1 계획 매매 표시 테스트. 오프라인.

픽스처(fixtures/form4/*.xml)는 2026-10 실제 EDGAR Form 4 원본이다(schemaVersion X0609).
- vz  0001760581-26-000071 : <aff10b5One>1, S 1건, 각주 F1 "…adopted by the reporting person on May 18, 2026."
- net 0001473289-26-000031 : <aff10b5One>1, F·M·S 혼합 — 계획 각주(F2)는 S 행에만 달림
- vg  0001448765-26-000017 : <aff10b5One>1, M·S 혼합, 10b5-1 각주 없음
- ntrs 0001519341-26-000004 : <aff10b5One>0, A(부여) 1건
실행: py -m pytest -q scripts/tests/test_insider_plan_10b51.py
"""
from __future__ import annotations

import xml.etree.ElementTree as ET
from pathlib import Path

import build_insider_trades as b

FIX = Path(__file__).resolve().parent / "fixtures" / "form4"


def load(prefix):
    path = next(FIX.glob(f"{prefix}_*.xml"))
    return ET.fromstring(path.read_bytes())


def codes(root):
    return [b._txt(t, "transactionCoding/transactionCode")
            for t in root.find("nonDerivativeTable").findall("nonDerivativeTransaction")]


def test_checked_with_explicit_adoption_date():
    root = load("vz")
    assert b.plan_checkbox(root) is True
    assert b.plan_flags(root, "2026-10-21") == {0: {"plan10b51": True, "planAdoptedDate": "2026-05-18"}}


def test_mixed_filing_flags_only_rows_citing_plan_footnote():
    root = load("net")
    flags = b.plan_flags(root, "2026-10-21")
    for i, code in enumerate(codes(root)):
        if code == "S":
            assert flags[i] == {"plan10b51": True, "planAdoptedDate": "2025-11-20"}
        else:  # F(세금정산)·M(옵션행사) — 각주가 S 에만 달려 있다
            assert flags[i] == {"plan10b51": False}


def test_checked_without_footnote_marks_open_market_only_and_no_date():
    root = load("vg")
    flags = b.plan_flags(root, "2026-10-21")
    for i, code in enumerate(codes(root)):
        assert "planAdoptedDate" not in flags[i]
        assert flags[i]["plan10b51"] is (True if code == "S" else None)


def test_unchecked_box_is_false():
    root = load("ntrs")
    assert b.plan_checkbox(root) is False
    assert b.plan_flags(root) == {0: {"plan10b51": False}}


def test_missing_checkbox_element_is_null():
    root = load("vz")
    root.remove(root.find("aff10b5One"))
    assert b.plan_checkbox(root) is None
    assert b.plan_flags(root) == {0: {"plan10b51": None}}


def test_checkbox_true_literal():
    root = ET.fromstring("<ownershipDocument><aff10b5One>true</aff10b5One></ownershipDocument>")
    assert b.plan_checkbox(root) is True


def test_footnote_parsing_only_takes_explicit_adoption_dates():
    f = b.plan_footnote_info
    assert f("Sold pursuant to a Rule 10b5-1 trading plan adopted on January 16, 2026.") == (True, "2026-01-16")
    assert f("purchases made pursuant to a Rule 10b5-1 trading plan adopted by the Reporting Person on 15 June 2026.") == (True, "2026-06-15")
    assert f("pursuant to a 10b5-1 plan adopted 5/18/2026") == (True, "2026-05-18")
    assert f("plan adopted on Sept. 3, 2025 and modified on May 1, 2026, under Rule 10b5-1") == (True, "2025-09-03")
    # 계획은 말하지만 채택일이 없다 → 날짜 없음
    assert f("Includes shares sold pursuant to a 10b5-1 plan.") == (True, None)
    # 'entered into' 는 채택일로 읽지 않는다
    assert f("pursuant to a Rule 10b5-1 plan entered into on March 1, 2026") == (True, None)
    # 부정문 · 무관 각주
    assert f("These shares were not sold pursuant to a Rule 10b5-1 plan.") == (False, None)
    assert f("The price reported is a weighted average price.") == (False, None)


def test_future_adoption_date_is_dropped():
    xml = """<ownershipDocument><aff10b5One>1</aff10b5One>
      <nonDerivativeTable><nonDerivativeTransaction>
        <transactionCoding><transactionCode>S</transactionCode></transactionCoding>
        <transactionAmounts><transactionShares><value>1</value><footnoteId id="F1"/></transactionShares></transactionAmounts>
      </nonDerivativeTransaction></nonDerivativeTable>
      <footnotes><footnote id="F1">Rule 10b5-1 plan adopted on May 18, 2027.</footnote></footnotes>
    </ownershipDocument>"""
    assert b.plan_flags(ET.fromstring(xml), "2026-10-21") == {0: {"plan10b51": True}}


def test_refresh_fills_only_rows_without_flag_newest_first():
    body = (FIX / next(p.name for p in FIX.glob("vz_*.xml"))).read_bytes()
    calls = []

    def fetch(url):
        calls.append(url)
        return body

    merged = {
        "A#0": {"accession": "A", "txIndex": 0, "fileDate": "2026-10-01", "link": "u-old"},
        "B#0": {"accession": "B", "txIndex": 0, "fileDate": "2026-10-20", "link": "u-new"},
        "C#0": {"accession": "C", "txIndex": 0, "fileDate": "2026-10-21", "link": "u-done", "plan10b51": None},
    }
    assert b.refresh_plan_flags(merged, 1, fetch=fetch) == 1
    assert calls == ["u-new"]
    assert merged["B#0"]["plan10b51"] is True and merged["B#0"]["planAdoptedDate"] == "2026-05-18"
    assert "plan10b51" not in merged["A#0"]
    assert merged["C#0"]["plan10b51"] is None
    assert b.refresh_plan_flags(merged, 0, fetch=fetch) == 0


def test_refresh_keeps_rows_untouched_when_fetch_fails():
    def fetch(url):
        raise OSError("boom")

    merged = {"A#0": {"accession": "A", "txIndex": 0, "fileDate": "2026-10-01", "link": "u"}}
    assert b.refresh_plan_flags(merged, 5, fetch=fetch) == 0
    assert "plan10b51" not in merged["A#0"]


def test_parsed_records_carry_plan_fields(monkeypatch):
    body = next(FIX.glob("net_*.xml")).read_bytes()
    monkeypatch.setattr(b, "sec_get", lambda url, retries=4: body)
    hit = {"_id": "0001473289-26-000031:wk-form4_1792451081.xml",
           "_source": {"ciks": ["0001473289"], "file_date": "2026-10-16"}}
    recs = b.fetch_and_parse_form4(hit, 1477333, "NET")
    assert recs and all("plan10b51" in r for r in recs)
    assert {r["code"] for r in recs if r["plan10b51"]} == {"S"}
    assert all(r.get("planAdoptedDate") == "2025-11-20" for r in recs if r["plan10b51"])
