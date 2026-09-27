"""사업부문 매출 빌더(build_segments_us.py) 순수 로직 테스트. 네트워크 없음.

instance·레이블은 실제 10-K XBRL 과 같은 구조(xbrli context/segment/explicitMember, link:labelLink)의 최소 스텁이다
(2026-09-27 AAPL·MSFT·NVDA·AMZN·INTC 실호출로 확인한 모양). 숫자는 규칙 검증용.

실행: py -m pytest -q scripts/tests/test_segments_builder.py
"""
from __future__ import annotations

import build_segments_us as sg

NS = ('xmlns="http://www.xbrl.org/2003/instance" xmlns:xbrldi="http://xbrl.org/2006/xbrldi" '
      'xmlns:us-gaap="http://fasb.org/us-gaap/2025" xmlns:srt="http://fasb.org/srt/2025" '
      'xmlns:dei="http://xbrl.sec.gov/dei/2025" xmlns:iso4217="http://www.xbrl.org/2003/iso4217" '
      'xmlns:tst="http://example.com/tst" xmlns:country="http://xbrl.sec.gov/country/2025"')
PERIODS = {"25": ("2024-09-29", "2025-09-27"), "24": ("2023-10-01", "2024-09-28"), "23": ("2022-09-25", "2023-09-30")}


def _ctx(cid, fy, dims=(), instant=False):
    start, end = PERIODS[fy]
    seg = ""
    if dims:
        seg = "<segment>" + "".join(
            f'<xbrldi:explicitMember dimension="{a}">{m}</xbrldi:explicitMember>' for a, m in dims) + "</segment>"
    period = f"<instant>{end}</instant>" if instant else f"<startDate>{start}</startDate><endDate>{end}</endDate>"
    return f'<context id="{cid}"><entity><identifier scheme="http://www.sec.gov/CIK">1</identifier>{seg}</entity><period>{period}</period></context>'


def _fact(concept, cid, val):
    return f'<us-gaap:{concept} contextRef="{cid}" unitRef="usd" decimals="-6">{val}</us-gaap:{concept}>'


def _instance():
    SEG = "us-gaap:StatementBusinessSegmentsAxis"
    PROD = "srt:ProductOrServiceAxis"
    GEO = "srt:StatementGeographicalAxis"
    CONS = "srt:ConsolidationItemsAxis"
    parts, facts = [], []
    rev = "RevenueFromContractWithCustomerExcludingAssessedTax"
    data = {
        "25": {"total": 400, "seg": {"tst:AlphaMember": 250, "tst:BetaMember": 150},
               "prod": {"us-gaap:ProductMember": 300, "tst:PhoneMember": 200, "tst:PadMember": 100, "us-gaap:ServiceMember": 100},
               "geo": {"country:US": 180, "tst:OtherCountriesMember": 220}},
        "24": {"total": 360, "seg": {"tst:AlphaMember": 220, "tst:BetaMember": 140},
               "prod": {"us-gaap:ProductMember": 270, "tst:PhoneMember": 190, "tst:PadMember": 80, "us-gaap:ServiceMember": 90},
               "geo": {"country:US": 160, "tst:OtherCountriesMember": 200}},
    }
    n = 0
    for fy, d in data.items():
        n += 1
        parts.append(_ctx(f"t{fy}", fy))
        facts.append(_fact(rev, f"t{fy}", d["total"]))
        for m, v in d["seg"].items():
            n += 1
            cid = f"s{n}"
            # 부문 표는 ConsolidationItemsAxis=OperatingSegmentsMember 와 함께 태그되는 경우가 많다
            parts.append(_ctx(cid, fy, [(SEG, m), (CONS, "us-gaap:OperatingSegmentsMember")]))
            facts.append(_fact(rev, cid, v))
        for m, v in d["prod"].items():
            n += 1
            cid = f"p{n}"
            parts.append(_ctx(cid, fy, [(PROD, m)]))
            facts.append(_fact(rev, cid, v))
        for m, v in d["geo"].items():
            n += 1
            cid = f"g{n}"
            parts.append(_ctx(cid, fy, [(GEO, m)]))
            facts.append(_fact(rev, cid, v))
    # 제거(조정) 멤버·교차표(부문×지역)·분기 값은 빠져야 한다
    parts.append(_ctx("elim", "25", [(SEG, "tst:AlphaMember"), (CONS, "us-gaap:IntersegmentEliminationMember")]))
    facts.append(_fact(rev, "elim", -30))
    parts.append(_ctx("cross", "25", [(SEG, "tst:AlphaMember"), (GEO, "country:US")]))
    facts.append(_fact(rev, "cross", 99))
    parts.append('<context id="q"><entity><identifier scheme="x">1</identifier><segment>'
                 f'<xbrldi:explicitMember dimension="{SEG}">tst:AlphaMember</xbrldi:explicitMember></segment></entity>'
                 '<period><startDate>2025-06-29</startDate><endDate>2025-09-27</endDate></period></context>')
    facts.append(_fact(rev, "q", 77))
    unit = '<unit id="usd"><measure>iso4217:USD</measure></unit>'
    dei = '<dei:DocumentFiscalYearFocus contextRef="t25">2025</dei:DocumentFiscalYearFocus>' \
          '<dei:DocumentPeriodEndDate contextRef="t25">2025-09-27</dei:DocumentPeriodEndDate>'
    return f'<?xml version="1.0"?><xbrl {NS}>{"".join(parts)}{unit}{dei}{"".join(facts)}</xbrl>'.encode()


LABELS = b'''<?xml version="1.0"?>
<link:linkbase xmlns:link="http://www.xbrl.org/2003/linkbase" xmlns:xlink="http://www.w3.org/1999/xlink">
 <link:labelLink xlink:type="extended" xlink:role="http://www.xbrl.org/2003/role/link">
  <link:loc xlink:type="locator" xlink:href="tst-20250927.xsd#tst_PhoneMember" xlink:label="loc_phone"/>
  <link:label xlink:type="resource" xlink:label="lab_phone" xlink:role="http://www.xbrl.org/2003/role/label">Phone [Member]</link:label>
  <link:label xlink:type="resource" xlink:label="lab_phone" xlink:role="http://www.xbrl.org/2003/role/terseLabel">tPhone</link:label>
  <link:labelArc xlink:type="arc" xlink:from="loc_phone" xlink:to="lab_phone"/>
  <link:loc xlink:type="locator" xlink:href="tst-20250927.xsd#tst_AlphaMember" xlink:label="loc_a"/>
  <link:label xlink:type="resource" xlink:label="lab_a" xlink:role="http://www.xbrl.org/2003/role/label">ALPHA\xc2\xa0SEGMENT GROUP</link:label>
  <link:labelArc xlink:type="arc" xlink:from="loc_a" xlink:to="lab_a"/>
 </link:labelLink>
</link:linkbase>'''


def test_parse_and_extract_three_axes():
    parsed = sg.parse_instance(_instance())
    labels = sg.parse_labels(LABELS)
    assert labels["tst_PhoneMember"] == "tPhone"                      # terse > standard, [Member] 제거
    ex = sg.extract_filing(parsed, labels)
    assert set(ex) == {"segment", "product", "geo"}
    seg = ex["segment"]["years"]["2025-09-27"]
    assert seg["v"] == {"tst:AlphaMember": 250, "tst:BetaMember": 150}  # 제거·교차표·분기 값 제외
    assert seg["fy"] == 2025 and seg["total"] == 400
    assert ex["segment"]["years"]["2024-09-28"]["fy"] == 2024


def test_build_doc_drops_parent_and_checks_totals():
    parsed = sg.parse_instance(_instance())
    doc = sg.build_doc("TST", "Test", 1, [{"accn": "a"}], [sg.extract_filing(parsed, sg.parse_labels(LABELS))], "t")
    prod = doc["axes"]["product"]
    assert prod["dropped"] == ["us-gaap:ProductMember"]               # 제품 = 폰 + 패드(두 해 모두)
    assert prod["check"] == "ok"
    assert [m["label"] for m in prod["members"]] == ["tPhone", "Pad", "서비스"]
    last = prod["years"][-1]
    assert last["sum"] == 400 and last["total"] == 400 and "us-gaap:ProductMember" not in last["v"]
    geo = doc["axes"]["geo"]
    assert [m["label"] for m in geo["members"]] == ["기타 국가", "미국"]  # 표준 멤버·국가 코드 사전
    seg = doc["axes"]["segment"]
    assert seg["members"][0]["label"] == "Alpha Segment Group"         # 대문자 레이블·nbsp 정리
    assert sg.index_entry(doc) == [2025, "SGP", ""]


def test_find_parents_rules():
    # 합이 총매출과 맞으면 아무것도 빼지 않는다
    assert sg.find_parents([({"a": 60, "b": 40}, 100)]) == []
    # 총매출 분해: 2줄(상품/서비스) 대신 가장 잘게 나눈 4줄 — 두 해 모두 성립
    y = [({"prod": 61, "svc": 39, "o1": 33, "o2": 28, "o3": 24, "o4": 15}, 100),
         ({"prod": 57, "svc": 33, "o1": 31, "o2": 26, "o3": 19, "o4": 14}, 90)]
    assert sorted(sg.find_parents(y)) == ["prod", "svc"]
    # 한 해만 우연히 맞는 관계는 소계로 보지 않는다
    y = [({"p": 50, "x": 30, "z": 20, "w": 7}, None), ({"p": 55, "x": 30, "z": 20, "w": 9}, None)]
    assert sg.find_parents(y) == []


def test_unify_renamed_member_by_label_but_not_when_both_present():
    node = {"years": {"2025-01-01": {"fy": 2025, "v": {"n:NewMember": 10, "n:B": 5}},
                      "2022-01-01": {"fy": 2022, "v": {"n:OldMember": 8, "n:B": 4}}},
            "labels": {"n:NewMember": "Compute & Networking", "n:OldMember": "Compute & Networking", "n:B": "B"}}
    sg.unify_members(node)
    assert node["years"]["2022-01-01"]["v"] == {"n:NewMember": 8, "n:B": 4}
    node = {"years": {"2025-01-01": {"fy": 2025, "v": {"x:A": 1, "y:A": 2}}}, "labels": {"x:A": "Consumer", "y:A": "Consumer"}}
    sg.unify_members(node)
    assert node["years"]["2025-01-01"]["v"] == {"x:A": 1, "y:A": 2}


def test_merge_filings_latest_wins_and_older_fills():
    new = {"segment": {"concept": "R", "labels": {}, "years": {
        "2025-12-31": {"fy": 2025, "total": 10, "v": {"a": 6, "b": 4}},
        "2024-12-31": {"fy": 2024, "total": 9, "v": {"a": 5, "b": 4}}}}}
    old = {"segment": {"concept": "R", "labels": {}, "years": {
        "2024-12-31": {"fy": 2024, "total": 99, "v": {"a": 50, "b": 49}},       # 재작성 전 값 — 무시
        "2021-12-31": {"fy": 2021, "total": 7, "v": {"a": 4, "b": 3}}}}}
    m = sg.merge_filings([new, old])["segment"]["years"]
    assert m["2024-12-31"]["total"] == 9 and m["2021-12-31"]["total"] == 7


def test_filing_list_and_names():
    sub = {"filings": {"recent": {
        "form": ["10-Q", "10-K", "10-K/A", "10-K", "8-K"],
        "accessionNumber": ["q", "k2", "ka", "k1", "e"],
        "filingDate": ["2026-02-01", "2025-11-01", "2025-12-01", "2024-11-01", "2025-01-01"],
        "reportDate": ["2025-12-27", "2025-09-27", "2025-09-27", "2024-09-28", ""],
        "primaryDocument": ["q.htm", "tst-20250927.htm", "a.htm", "tst-20240928.htm", "e.htm"],
        "isXBRL": [1, 1, 1, 1, 0]}}}
    fl = sg.annual_filings(sub)
    assert [f["accn"] for f in fl] == ["k2", "k1"]                     # 정정(/A)·분기·8-K 제외, 최신 순
    assert sg.instance_names("tst-20250927.htm") == ("tst-20250927_htm.xml", "tst-20250927_lab.xml", "tst-20250927.xsd")
    assert sg.pick_from_index(["FilingSummary.xml", "tst-20250927_htm.xml", "tst-20250927.xsd"]) == \
        ("tst-20250927_htm.xml", "tst-20250927.xsd")
    assert sg.pick_from_index(["tst-20180929.xml", "tst-20180929_lab.xml", "tst-20180929_pre.xml"]) == \
        ("tst-20180929.xml", "tst-20180929_lab.xml")


def test_humanize_member_fallbacks():
    assert sg.humanize_member("country:JP") == "일본"
    assert sg.humanize_member("srt:AmericasMember") == "미주"
    assert sg.humanize_member("msft:LinkedInCorporationMember") == "Linked In Corporation"
    assert sg.humanize_member("tst:CloudSegmentMember") == "Cloud"
