"""오늘의 특징주 빌더(build_movers_reasons.py)의 정직성 규칙 — 오프라인.

LLM 출력은 믿지 않는다: 입력 근거 목록에 없는 ID 를 인용하거나, 근거에 없는 숫자를
쓰거나, 스스로 '다른 회사 얘기'·'방향 설명 못 함' 이라고 답하면 사유로 쓰지 않는다.
"""
from __future__ import annotations

import build_movers_reasons as b


def _stock(change=12.5, evidence=None, sector=None, cluster=None):
    s = {
        "ticker": "044450", "company": "KSS해운", "industry": "해운", "sector": "산업재",
        "changePct": change, "close": 11730.0, "tradingValue": 1e10, "marketCapB": 0.3,
        "_evidence": evidence if evidence is not None else [
            {"id": "E1", "type": "disclosure", "title": "DART: 주요사항보고서(자기주식취득결정)",
             "link": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=1", "source": "DART", "date": "2026-09-23"},
            {"id": "E2", "type": "news", "title": "KSS해운, 198억원 자사주 매입 나선다",
             "link": "https://example.com/a", "source": "example.com", "date": "2026-09-23"},
        ],
        "_sector": sector,
    }
    if cluster:
        s["_cluster"] = cluster
    return s


def test_valid_row_is_ok_and_links_come_from_input():
    s = _stock()
    status, cited, reason = b.validate_llm_row(s, {"reason": "198억원 규모 자사주 매입 결정", "evidence": ["E1", "E2"],
                                                   "same_company": True, "explains_move": True})
    assert status == "ok"
    assert [e["id"] for e in cited] == ["E1", "E2"]
    assert reason == "198억원 규모 자사주 매입 결정"


def test_unknown_evidence_id_fails():
    s = _stock()
    status, cited, _ = b.validate_llm_row(s, {"reason": "자사주 매입", "evidence": ["E9"]})
    assert status == "failed" and cited == []


def test_invented_number_fails():
    s = _stock()
    status, _, _ = b.validate_llm_row(s, {"reason": "500억원 자사주 매입", "evidence": ["E2"]})
    assert status == "failed"


def test_self_reported_mismatch_becomes_no_material():
    s = _stock()
    for flags in ({"same_company": False}, {"explains_move": False}):
        status, cited, reason = b.validate_llm_row(s, {"reason": "게임 흥행", "evidence": ["E2"], **flags})
        assert status == "none" and cited == [] and reason == b.NO_MATERIAL


def test_no_citation_fails():
    s = _stock()
    status, _, _ = b.validate_llm_row(s, {"reason": "자사주 매입", "evidence": []})
    assert status == "failed"


def test_sector_evidence_cannot_be_cited_by_llm():
    ev = [{"id": "E1", "type": "sector", "title": "같은 업종(해운) 9종목 시총가중 평균 +5.0%", "link": "", "source": "스냅샷", "date": ""}]
    s = _stock(evidence=ev)
    status, _, _ = b.validate_llm_row(s, {"reason": "해운 업종 강세", "evidence": ["E1"]})
    assert status == "failed"


def test_finalize_prefers_sector_when_no_material():
    ctx = {"level": "업종", "name": "건설", "avgPct": -4.0, "n": 50}
    ev = [{"id": "E1", "type": "sector", "title": "x", "link": "", "source": "스냅샷", "date": ""}]
    s = _stock(change=-7.2, evidence=ev, sector=ctx)
    row = b.finalize(s, "none", b.NO_MATERIAL, [])
    assert row["reasonStatus"] == "sector"
    assert row["tags"] == ["섹터동조"]
    assert "건설 업종 동반 하락" in row["reason"]
    assert not any(k.startswith("_") for k in row)


def test_finalize_failed_keeps_label_not_reason():
    s = _stock()
    row = b.finalize(s, "failed", "", [])
    assert row["reasonStatus"] == "failed" and row["reason"] == ""


def test_sector_sync_threshold():
    s = {"changePct": 10.0}
    assert b.sector_is_sync(s, {"avgPct": 3.5})
    assert not b.sector_is_sync(s, {"avgPct": 2.5})      # 종목 등락의 30% 미만
    assert not b.sector_is_sync(s, {"avgPct": -4.0})     # 방향 반대
    assert not b.sector_is_sync({"changePct": 4.0}, {"avgPct": 1.5})  # 2% 미만


def test_board_clusters_need_three():
    movers = {"up": [{"ticker": t, "company": t, "industry": "반도체"} for t in ("A", "B", "C")]
              + [{"ticker": "D", "company": "D", "industry": "해운"}], "down": []}
    cl = b.board_clusters(movers)
    assert set(cl) == {"A", "B", "C"}
    assert [m["ticker"] for m in cl["A"]] == ["B", "C"]


def test_short_company_and_title_matching():
    assert b.short_company("Klaviyo Inc. Series A") == "Klaviyo"
    assert b.short_company("CrowdStrike Holdings Inc. Class A") == "CrowdStrike"
    terms = b.name_terms({"ticker": "PANW", "company": "Palo Alto Networks Inc."}, "us")
    assert b.title_mentions("PANW Stock Gains After Revenue Forecast Beat", terms)
    assert not b.title_mentions("Stock market today: Dow slips", terms)
    # 짧은 대문자 티커는 단어 경계로만(‘Z’ 가 아무 단어에나 걸리지 않게)
    assert not b.title_mentions("Zillow-free headline about zebras", ["Z"])
