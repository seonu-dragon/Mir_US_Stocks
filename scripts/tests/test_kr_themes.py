"""국내 테마 분류(build_kr_themes.py) 테스트 — 네트워크 없음.

원문 조각은 2026-03 제출 사업보고서(삼성전기·SK하이닉스·두산에너빌리티·LG전자·기아 등)의 'II. 사업의 내용'
문장 모양을 그대로 옮겨 왔다(태그 구조는 DART dart4.xsd 원문과 같다).
실행: py -m pytest -q scripts/tests/test_kr_themes.py
"""
from __future__ import annotations

import json

import build_kr_themes as kt
import kr_theme_rules as rules


def theme(tid):
    return next(t for t in kt.THEMES_C if t["id"] == tid)


DOC = """<?xml version="1.0" encoding="utf-8"?>
<DOCUMENT><DOCUMENT-NAME ACODE="11011">사업보고서</DOCUMENT-NAME>
<SECTION-1><TITLE ATOC="Y" AASSOCNOTE="D-0-1-0-0">I. 회사의 개요</TITLE><P>당사는 HBM 을 언급만 한다.</P></SECTION-1>
<SECTION-1><TITLE ATOC="Y" AASSOCNOTE="D-0-2-0-0" ENG="II. Business Description">II. 사업의 내용</TITLE>
<SECTION-2><TITLE ATOC="Y">1. 사업의 개요</TITLE>
<P>당사는 수동소자(MLCC, Inductor 등)를 생산하는 컴포넌트 사업부문과 반도체패키지기판을 생산하는 패키지솔루션 사업부문으로 구성되어 있습니다. 당사와 거래하고 있는 PCB 공급사는 동산업 내 주요 공급업체입니다.</P>
<P><SPAN USERMARK="F-BT12 B">가. 산업의 특성</SPAN>HBM 수요가 늘어 반도체 시장이 커지고 있으며, 당사는 이에 대응해 제품을 공급하고 있습니다.</P>
<P><SPAN USERMARK="F-BT12 B">나. 회사의 현황</SPAN>당사는 서버용 HBM3E 를 양산하여 공급하고 있습니다 &amp; 확대 중입니다.</P>
<TABLE><TBODY><TR><TD>항공/방산 AM 제작공정 기술개발</TD><TD>제조혁신 제품 개발</TD></TR></TBODY></TABLE>
<P>또한, AI 가속기 등 신규 응용처 및 신규 고객 발굴 활동을 추진하여 기판 사업의 성장 기반을 강화하겠습니다.</P>
<P>'26년 산업수요는 소폭 감소 예상되나 당사는 전차종 판매를 통해 내수 역대 최다 판매를 달성하겠습니다.</P>
</SECTION-2></SECTION-1>
<SECTION-1><TITLE ATOC="Y" AASSOCNOTE="D-0-3-0-0">III. 재무에 관한 사항</TITLE><P>당사는 변압기를 생산합니다.</P></SECTION-1>
</DOCUMENT>"""


# ───────────────────────── 원문 구간·문장

def test_extract_business_section_bounds():
    sec = kt.extract_business_section(DOC)
    assert sec is not None
    assert "II. 사업의 내용" in sec
    assert "III. 재무에 관한 사항" not in sec          # 다음 장은 빠진다
    assert "변압기" not in sec
    assert "언급만 한다" not in sec                     # 앞 장도 빠진다


def test_extract_business_section_roman_numeral_and_missing():
    doc = '<TITLE ATOC="Y">Ⅱ. 사업의 내용</TITLE><P>당사는 조선소를 운영합니다.</P><TITLE>Ⅲ. 재무</TITLE>'
    assert "조선소" in kt.extract_business_section(doc)
    assert kt.extract_business_section("<P>사업보고서가 아니다</P>") is None


def test_chunks_mark_table_rows_and_unescape():
    chunks = kt.section_chunks(kt.extract_business_section(DOC))
    rows = [c for c, is_row in chunks if is_row]
    assert rows == ["항공/방산 AM 제작공정 기술개발 제조혁신 제품 개발"]
    assert any("양산하여 공급하고 있습니다 & 확대 중입니다." in c for c, _ in chunks)   # &amp; 해제


def test_split_sentences_keeps_substrings():
    text = "당사는 MLCC 를 생산합니다. 또한 기판을 판매합니다. 2) 기타"
    sents = kt.split_sentences(text)
    assert sents[0] == "당사는 MLCC 를 생산합니다."
    assert all(s in text for s in sents)


def test_trim_evidence_is_substring_and_flags_cut():
    sent = "가" * 150 + " 당사는 HBM 을 공급합니다 " + "나" * 150
    i = sent.index("HBM")
    ev, cut = kt.trim_evidence(sent, i, i + 3, limit=80)
    assert ev in sent and "HBM" in ev and len(ev) <= 80
    assert cut == 3
    short, c0 = kt.trim_evidence("당사는 HBM 을 공급합니다.", 4, 7)
    assert c0 == 0 and short == "당사는 HBM 을 공급합니다."


# ───────────────────────── 판정 규칙

def test_high_needs_self_reference_and_activity():
    hit = kt.classify_hit("당사는 서버용 HBM3E 를 양산하여 공급하고 있습니다.", False, theme("hbm_ai_semi"))
    assert hit["lvl"] == "high" and hit["kw"] == "HBM3E"
    # 자기 지칭 없는 시장 설명은 애매
    amb = kt.classify_hit("HBM 수요 증가로 반도체 시장이 성장하며 공급이 부족합니다.", False, theme("hbm_ai_semi"))
    assert amb["lvl"] == "amb"


def test_ascii_boundary_matches_before_hangul_particle():
    # 파이썬 \b 였다면 'NPU를' 의 NPU 를 못 찾는다.
    hit = kt.classify_hit("당사는 자체 NPU를 개발하여 판매하고 있습니다.", False, theme("hbm_ai_semi"))
    assert hit and hit["kw"] == "NPU"
    # '8.6G' 의 6G 는 통신 테마가 아니다
    assert kt.classify_hit("당사는 8.6G IT OLED 라인을 양산 준비 중입니다.", False, theme("telecom_equip")) is None


def test_supplier_sentence_is_dropped():
    # SK하이닉스 'PCB 공급사' 문장이 PCB 테마로 들어갔던 사례
    s = "당사와 거래하고 있는 PCB 공급사는 동산업 내 주요 공급업체이며, 품질을 만족하고 있습니다."
    assert kt.classify_hit(s, False, theme("substrate")) is None


def test_downstream_customer_is_not_a_candidate():
    # 키워드가 고객·응용처로 나열된 자리는 보류(LLM 판정)로도 보내지 않는다 — flash-lite 가 통과시켰었다.
    s = "또한, AI 가속기 등 신규 응용처 및 신규 고객 발굴 활동을 추진하여 기판 사업의 성장 기반을 강화하겠습니다."
    assert kt.classify_hit(s, False, theme("hbm_ai_semi")) is None
    s2 = "당사는 AI 데이터센터용 QLC 기반 고용량 SSD 제품을 개발하여 판매하고 있습니다."
    hit = kt.classify_hit(s2, False, theme("datacenter"))
    assert hit is None or hit["lvl"] == "amb"


def test_table_row_is_always_ambiguous():
    row = "항공/방산 AM 제작공정 기술개발 제조혁신 제품 개발 당사"
    assert kt.classify_hit(row, True, theme("defense"))["lvl"] == "amb"


def test_word_traps():
    # 기아 '전차종 판매'(모든 차종)는 방산의 '전차' 가 아니다
    assert kt.classify_hit("당사는 전차종 판매를 통해 역대 최다 판매를 달성하겠습니다.", False, theme("defense")) is None
    # '전방산업' 의 '방산', '카드론' 의 '드론', '측정유가증권' 의 '정유'
    assert kt.classify_hit("당사는 전방산업 수요 둔화로 판매가 줄었습니다.", False, theme("defense")) is None
    assert kt.classify_hit("당사는 현금서비스, 카드론 등 서비스를 제공합니다.", False, theme("aerospace")) is None
    assert kt.classify_hit("당사가 보유한 상각후원가측정유가증권 매출", False, theme("petrochem")) is None


def test_multiple_matches_use_first_qualifying():
    s = "OLED TV는 최고의 시청 경험을 원하는 고객들의 선호가 지속되어 당사는 OLED TV 판매를 확대하고 있습니다."
    hit = kt.classify_hit(s, False, theme("display"))
    assert hit["lvl"] == "high" and hit["start"] > 10


def test_industry_heading_caps_to_ambiguous():
    sec = kt.extract_business_section(DOC)
    out = kt.scan_section(sec)
    hbm = out["hbm_ai_semi"]
    assert hbm["lvl"] == "high"
    # '산업의 특성' 아래 문장이 아니라 '회사의 현황' 아래 문장이 근거로 뽑힌다
    assert "양산하여 공급" in hbm["ev"]
    assert hbm["n"] >= 2


def test_company_name_counts_as_self_reference():
    sec = '<TITLE>II. 사업의 내용</TITLE><P>기자재 공급자인 두산에너빌리티는 원전 주기기를 제작하여 공급합니다.</P><TITLE>III. 재무</TITLE>'
    assert kt.scan_section(sec).get("nuclear", {}).get("lvl") == "amb"
    got = kt.scan_section(sec, names=["두산에너빌리티"])
    assert got["nuclear"]["lvl"] == "high"


def test_scan_section_evidence_is_verbatim():
    sec = kt.extract_business_section(DOC)
    full = kt.canon(sec)
    for tid, h in kt.scan_section(sec).items():
        assert h["ev"] in full, tid


# ───────────────────────── 계획·조립

def test_plan_tickers_only_changed_reports_or_rules():
    listing = {"A": {"rc": "2"}, "B": {"rc": "5"}, "C": {"rc": "7"}, "D": {}}
    tstate = {"A": {"rc": "2", "rv": rules.RULES_VERSION}, "B": {"rc": "4", "rv": rules.RULES_VERSION},
              "C": {"rc": "7", "rv": rules.RULES_VERSION - 1}}
    assert kt.plan_tickers(["A", "B", "C", "D", "E"], listing, tstate, rules.RULES_VERSION) == ["B", "C"]


def _prev():
    return {"themes": [
        {"id": "mlcc", "members": [{"t": "009150", "ev": "당사는 MLCC 를 생산합니다.", "kw": "MLCC", "n": 3, "by": "rule"},
                                    {"t": "999999", "ev": "상장폐지 종목", "kw": "MLCC", "n": 1, "by": "rule"}]},
        {"id": "hbm_ai_semi", "members": [{"t": "000660", "ev": "옛 규칙 근거", "kw": "HBM", "n": 1, "by": "rule"}]},
    ]}


def test_assemble_keeps_unprocessed_and_replaces_processed():
    results = {"000660": {"memory": {"lvl": "high", "ev": "당사는 DRAM 을 생산합니다.", "kw": "DRAM", "c": 0, "n": 9},
                          "hbm_ai_semi": {"lvl": "amb", "ev": "HBM 시장이 큽니다.", "kw": "HBM", "c": 0, "n": 1}}}
    tstate = {"000660": {"rc": "20260317000635", "amb": {"hbm_ai_semi": {"ev": "HBM 시장이 큽니다.", "kw": "HBM", "c": 0, "n": 1}}}}
    listing = {"000660": {"rc": "20260317000635", "nm": "사업보고서 (2025.12)", "dt": "2026-03-17"},
               "009150": {"rc": "20260310003071", "nm": "사업보고서 (2025.12)", "dt": "2026-03-10"}}
    body = kt.assemble(_prev(), results, tstate, {}, listing, {"000660": "SK하이닉스", "009150": "삼성전기"},
                       {}, {"000660", "009150"}, "2026-09-27")
    by = {t["id"]: t for t in body["themes"]}
    assert [m["t"] for m in by["mlcc"]["members"]] == ["009150"]            # 유지 + 상장폐지 제외
    assert by["hbm_ai_semi"]["members"] == []                               # 재처리 종목의 옛 편입은 사라지고 애매는 편입 안 함
    assert by["memory"]["members"][0]["by"] == "rule"
    assert body["reports"]["000660"] == ["20260317000635", "사업보고서 (2025.12)", "2026-03-17", "SK하이닉스"]
    assert body["count"] == 2


def test_assemble_adds_llm_accepted_ambiguous_only():
    ev = "당사는 다수 고객사와 협력하여 HBM 을 공동 개발합니다."
    tstate = {"000660": {"rc": "1", "amb": {"hbm_ai_semi": {"ev": ev, "kw": "HBM", "c": 0, "n": 2},
                                            "robot": {"ev": "로봇 시장 전망", "kw": "로봇", "c": 0, "n": 1}}}}
    cache = {kt.evidence_key("000660", "hbm_ai_semi", ev): True,
             kt.evidence_key("000660", "robot", "로봇 시장 전망"): False}
    body = kt.assemble({}, {}, tstate, cache, {"000660": {"rc": "1"}}, {}, {}, None, "2026-09-27")
    by = {t["id"]: t for t in body["themes"]}
    assert by["hbm_ai_semi"]["members"] == [{"t": "000660", "ev": ev, "kw": "HBM", "n": 2, "by": "llm"}]
    assert by["robot"]["members"] == []


def test_low_pbr_theme_carries_pb_and_filter():
    results = {"086790": {"low_pbr_fin": {"lvl": "high", "ev": "당사는 금융지주회사입니다.", "kw": "금융지주", "c": 0, "n": 5}}}
    body = kt.assemble({}, results, {}, {}, {"086790": {"rc": "1"}}, {}, {"086790": {"pb": 0.512}}, None, "x")
    th = next(t for t in body["themes"] if t["id"] == "low_pbr_fin")
    assert th["filter"] == {"pbMax": 1.0}
    assert th["members"][0]["pb"] == 0.51


def test_split_and_merge_evidence_roundtrip(tmp_path):
    payload = {"schema": 1, "count": 1, "themes": [
        {"id": "mlcc", "name": "MLCC", "group": "반도체", "desc": "d",
         "members": [{"t": "009150", "ev": "당사는 MLCC 를 생산합니다.", "kw": "MLCC", "c": 2, "n": 3, "by": "rule"}]}]}
    index, files = kt.split_evidence(payload)
    assert "ev" not in json.dumps(index["themes"][0]["members"], ensure_ascii=False)
    assert index["themes"][0]["v"] and files["mlcc"]["ev"]["009150"] == ["당사는 MLCC 를 생산합니다.", 2]
    written = kt.write_evidence_files(files, tmp_path)
    assert [p.name for p in written] == ["mlcc.json"]
    assert kt.write_evidence_files(files, tmp_path) == []                    # 그대로면 다시 안 쓴다
    (tmp_path / "old_theme.json").write_text("{}", encoding="utf-8")
    kt.write_evidence_files(files, tmp_path)
    assert not (tmp_path / "old_theme.json").exists()                       # 사전에서 빠진 테마 정리
    back = kt.merge_evidence(index, tmp_path)
    assert back["themes"][0]["members"][0]["ev"] == "당사는 MLCC 를 생산합니다."
    assert back["themes"][0]["members"][0]["c"] == 2


def test_merge_evidence_drops_members_without_sentence(tmp_path):
    index = {"themes": [{"id": "mlcc", "members": [{"t": "009150", "kw": "MLCC", "by": "rule"}]}]}
    assert kt.merge_evidence(index, tmp_path)["themes"][0]["members"] == []


# ───────────────────────── 목록·LLM 응답

def test_listing_keeps_latest_business_report_only():
    out = {}
    kt._take_listing_row(out, {"stock_code": "005930", "rcept_no": "20250311001085", "report_nm": "사업보고서 (2024.12)",
                               "rcept_dt": "20250311", "corp_name": "삼성전자"})
    kt._take_listing_row(out, {"stock_code": "005930", "rcept_no": "20260310002820", "report_nm": "사업보고서 (2025.12)",
                               "rcept_dt": "20260310", "corp_name": "삼성전자"})
    kt._take_listing_row(out, {"stock_code": "005930", "rcept_no": "20260515000001", "report_nm": "분기보고서 (2026.03)",
                               "rcept_dt": "20260515", "corp_name": "삼성전자"})
    kt._take_listing_row(out, {"stock_code": "", "rcept_no": "20260310000001", "report_nm": "사업보고서 (2025.12)"})
    assert out == {"005930": {"rc": "20260310002820", "nm": "사업보고서 (2025.12)", "dt": "2026-03-10", "corp": "삼성전자"}}


def test_parse_llm_verdicts_filters_bad_rows():
    cands = [{"key": "k0"}, {"key": "k1"}]
    text = 'json\n[{"id": 0, "ok": true}, {"id": 1, "ok": "yes"}, {"id": 7, "ok": false}, "x"]'
    assert kt.parse_llm_verdicts(text, cands) == {"k0": True}
    assert kt.parse_llm_verdicts("not json", cands) == {}


def test_rules_are_well_formed():
    ids = [t["id"] for t in rules.THEMES]
    assert len(ids) == len(set(ids)) and 30 <= len(ids) <= 50
    for t in rules.THEMES:
        assert t["name"] and t["group"] and t["desc"] and t["strong"], t["id"]
        if t.get("weak"):
            assert t.get("ctx"), f"{t['id']}: weak 는 ctx 가 있어야 한다"


# ───────────────────────── 2026-09-27 보강: 판정 캐시 버전 · 자회사 문장 · 제외 목록

def test_evidence_key_changes_with_prompt_and_rules_version():
    base = kt.evidence_key("000660", "auto", "문장")
    assert base == kt.evidence_key("000660", "auto", "문장")
    assert base != kt.evidence_key("000660", "auto", "문장", prompt_version=kt.LLM_PROMPT_VERSION + 1)
    assert base != kt.evidence_key("000660", "auto", "문장", rules_version=rules.RULES_VERSION + 1)


def test_old_version_verdict_is_not_used_and_pruned():
    ev = "당사는 다수 고객사와 협력하여 HBM 을 공동 개발합니다."
    tstate = {"000660": {"rc": "1", "amb": {"hbm_ai_semi": {"ev": ev, "kw": "HBM", "c": 0, "n": 2}}}}
    old = kt.evidence_key("000660", "hbm_ai_semi", ev, prompt_version=kt.LLM_PROMPT_VERSION - 1)
    cache = {old: True}
    body = kt.assemble({}, {}, tstate, cache, {"000660": {"rc": "1"}}, {}, {}, None, "x")
    assert next(t for t in body["themes"] if t["id"] == "hbm_ai_semi")["members"] == []
    assert kt.prune_llm_cache(cache, tstate) == {}                       # 옛 버전 키는 버린다
    cur = kt.evidence_key("000660", "hbm_ai_semi", ev)
    assert kt.prune_llm_cache({cur: False, "zz": True}, tstate) == {cur: False}


def test_subsidiary_sentences_are_labelled():
    assert kt.is_subsidiary_sentence("당사의 종속회사들은 웹툰, 웹소설 등의 서비스를 운영하고 있습니다.")
    assert kt.is_subsidiary_sentence("하나손해보험은 손해보험업을 영위하는 종합 손해보험사로 하나금융지주의 자회사로 편입하였습니다.")
    assert not kt.is_subsidiary_sentence("당사 및 종속회사는 항공, 방산, 조선 사업 포트폴리오를 구성하고 있습니다.")
    assert not kt.is_subsidiary_sentence("당사는 DRAM 을 생산합니다.")
    # 다른 회사 이름(㈜)으로 시작하는 표 행 — 자기 이름이면 자회사가 아니다
    own = kt.self_patterns(["한화에어로스페이스"])
    assert kt.is_subsidiary_sentence("한화시스템㈜ 방산부문 구미사업장 전술통신장비 생산능력", own)
    assert not kt.is_subsidiary_sentence("한화에어로스페이스㈜ 창원사업장 엔진 생산능력", own)


def test_scan_marks_subsidiary_hit_and_prefers_parent_sentence():
    sec = ('<TITLE>II. 사업의 내용</TITLE><P>당사의 종속회사들은 웹툰 서비스를 운영하고 있습니다.</P>'
           '<TITLE>III. 재무</TITLE>')
    hit = kt.scan_section(sec)["content"]
    assert hit["lvl"] == "high" and hit["sub"] == 1
    sec2 = ('<TITLE>II. 사업의 내용</TITLE><P>당사의 종속회사들은 웹툰 서비스를 운영하고 있습니다.</P>'
            '<P>당사는 웹툰 플랫폼을 직접 운영하고 있습니다.</P><TITLE>III. 재무</TITLE>')
    hit2 = kt.scan_section(sec2)["content"]
    assert "sub" not in hit2 and hit2["ev"].startswith("당사는 웹툰")


def test_assemble_carries_sub_label():
    results = {"035420": {"content": {"lvl": "high", "ev": "당사의 종속회사들은 웹툰을 운영합니다.", "kw": "웹툰",
                                      "c": 0, "n": 3, "sub": 1}}}
    body = kt.assemble({}, results, {}, {}, {"035420": {"rc": "1"}}, {}, {}, None, "x")
    m = next(t for t in body["themes"] if t["id"] == "content")["members"][0]
    assert m["sub"] == 1 and m["by"] == "rule"


def test_downstream_keyword_is_not_even_a_candidate():
    s = "금속사업은 건설산업, 석유화학 플랜트 등의 중화학공업, 조선업 등 기초산업의 소재로 널리 사용되는 동관의 제조 및 판매를 영위하고 있습니다."
    assert kt.classify_hit(s, False, theme("shipbuilding")) is None


def test_exclusion_list_blocks_rule_llm_and_previous(monkeypatch):
    monkeypatch.setattr(rules, "EXCLUDE", {("000660", "auto"): "테스트", ("028260", "biosimilar_cdmo"): "테스트"})
    prev = {"themes": [{"id": "biosimilar_cdmo", "members": [{"t": "028260", "ev": "바이오사업은 …", "kw": "CMO", "by": "rule"}]}]}
    results = {"028260": {}}
    ev = "SSD 등 당사 낸드 솔루션 제품 공급을 늘리며 완성차 …"
    tstate = {"000660": {"rc": "1", "amb": {"auto": {"ev": ev, "kw": "완성차", "c": 0, "n": 1}}}}
    cache = {kt.evidence_key("000660", "auto", ev): True}
    body = kt.assemble(prev, {}, tstate, cache, {}, {}, {}, None, "x")
    by = {t["id"]: t for t in body["themes"]}
    assert by["auto"]["members"] == [] and by["biosimilar_cdmo"]["members"] == []
    body2 = kt.assemble({}, {"028260": {"biosimilar_cdmo": {"lvl": "high", "ev": "e", "kw": "CMO", "c": 0, "n": 1}}},
                        {}, {}, {}, {}, {}, None, "x")
    assert next(t for t in body2["themes"] if t["id"] == "biosimilar_cdmo")["members"] == []
    assert kt.prune_llm_cache(cache, tstate) == {}
    assert results  # (미사용 변수 방지)


def test_exclusion_list_entries_are_valid():
    ids = {t["id"] for t in rules.THEMES}
    for (t, tid), why in rules.EXCLUDE.items():
        assert len(t) == 6 and tid in ids and why, (t, tid)
    # 2026-09-27 샘플 검토에서 잘못으로 확인된 편입
    for pair in [("000660", "auto"), ("032830", "travel"), ("028260", "biosimilar_cdmo")]:
        assert pair in rules.EXCLUDE
