"""자회사 배당 공시를 모회사 배당으로 싣지 않는다 (2026-10-02 회귀 테스트, 네트워크 없음)."""
from __future__ import annotations

import json

import build_kr_corp_disclosures as K


def test_subsidiary_dividend_filing_skipped(tmp_path, monkeypatch):
    src = tmp_path / "kr_disclosures.json"
    src.write_text(json.dumps({"disclosures": [
        {"title": "현금ㆍ현물배당결정", "ticker": "005930", "company": "삼성전자",
         "fileDate": "2026-10-01", "link": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=1"},
        {"title": "[기재정정]현금ㆍ현물배당결정(자회사의 주요경영사항)", "ticker": "005440",
         "company": "현대지에프홀딩스", "fileDate": "2026-10-01",
         "link": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=2"},
    ]}, ensure_ascii=False), encoding="utf-8")
    monkeypatch.setattr(K, "DISCLOSURES", src)
    fetched = []
    monkeypatch.setattr(K, "fetch_doc", lambda rcept, key: fetched.append(rcept) or "doc")
    monkeypatch.setattr(K, "parse_dividend", lambda txt: {"dps": 100.0, "recordDate": "2026-10-16"})
    dividends, _, stats = K.build("key", None)
    assert fetched == ["1"]
    assert [d["company"] for d in dividends] == ["삼성전자"]
    assert stats["dividends"]["source"] == 1
