"""8-K 규칙 요약(eightk_summary) · 빌더 연결(build_material_events) · Form 144(build_form144) 테스트.

픽스처는 실제 EDGAR 제출물이다(네트워크 없음):
- fixtures/sec_8k/*.json : 2026-09 8-K 주 문서를 html_to_text 한 뒤 첫 Item 머리~SIGNATURE 만 잘라 둔 것
- fixtures/form144/*.xml : Form 144 primary_doc.xml 원본(MAR 2026-09-25)

실행: py -m pytest -q scripts/tests/test_sec_8k_form144.py
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

import build_form144 as f144
import build_material_events as bme
import eightk_summary as ek

FIX = Path(__file__).resolve().parent / "fixtures"


def load8k(name):
    return json.loads((FIX / "sec_8k" / f"{name}.json").read_text(encoding="utf-8"))


def summ(name):
    d = load8k(name)
    return ek.summarize_8k(d["codes"], d["text"], d["company"])


# ---------------------------------------------------------------------------
# 8-K 규칙 요약 — Item 별 실제 제출물
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("name, expected", [
    ("101_DT", {"item": "1.01", "what": "중요 계약 체결 — Credit Agreement", "who": "상대방 Bank of America, N.A.",
                "amount": "$500,000,000", "date": "2026-09-24"}),
    # 'Item' 과 번호 사이 얇은 공백(U+2009) · 법인 접미어 없는 사람 상대방
    ("101_WMG", {"item": "1.01", "what": "중요 계약 체결 — Employment Agreement", "who": "상대방 Valentin Blavatnik",
                 "amount": "$600,000", "date": "2026-09-24"}),
    # '(the “Company”) and Anthropic, PBC (“Anthropic”)' 상대방 · 'up to 387,051 shares … $2,226.60' 행사가를 안 잡는다
    ("302_AKAM", {"item": "1.01", "what": "중요 계약 체결 — Project Plan", "who": "상대방 Anthropic, PBC",
                  "amount": "$11.6 billion", "date": "2026-09-18"}),
    ("102_RIOT", {"item": "1.02", "what": "중요 계약 종료 — Credit Agreement", "who": "상대방 Coinbase Credit, Inc.",
                  "amount": "$200 million", "date": "2026-09-21"}),
    ("201_REXR", {"item": "2.01", "what": "매각 완료", "who": "상대방(매수자) EQT Real Estate",
                  "amount": "$1.2 billion", "date": "2026-09-16"}),
    ("203_SBAC", {"item": "2.03", "what": "채무 발생 — 기업어음(CP) 프로그램", "amount": "$2.5 billion"}),
    ("205_WWD", {"item": "2.05", "what": "구조조정(사업 철수·정리) 비용", "amount": "$34 million ~ $47.5 million"}),
    ("301_SBXD", {"item": "3.01", "what": "상장 관련 — 시가총액 요건 미달 통지", "who": "거래소 NYSE"}),
    ("401_DKNG", {"item": "4.01", "what": "감사인(회계법인) 교체 — 회사·감사인 간 이견 없음 명시",
                  "who": "BDO USA, P.C. → 후임 미정·미기재"}),
    ("402_BREZ", {"item": "4.02", "what": "과거 재무제표 신뢰 불가(재작성 예정)", "amount": "대상 기간 2026-06-30"}),
    ("502_CRCL", {"item": "5.02", "what": "임원·이사 변동 — 사임 2명",
                  "who": "P. Sean Neville(이사) 사임, Jeremy Fox-Geen(CFO) 사임"}),
    # 5.02 가 5.07 보다 우선순위가 높다
    ("507_EQH", {"item": "5.02", "who": "Seth Bernstein(CEO) 퇴임, Onur Erzan(사장·CEO) 선임"}),
    ("507_DRI", {"item": "5.07", "what": "연례 주주총회 투표 결과",
                 "amount": "안건 4건 · 이사 9명 선임 · 부결 1건 (안건별 표 수는 원문)", "date": "2026-09-24"}),
    ("701_KEY", {"item": "7.01", "what": "투자자 프레젠테이션 자료 공개(Reg FD)"}),
    ("801_MRVL", {"item": "8.01", "what": "배당 결의 — 주당 $0.06", "amount": "기준일 2026-10-09 · 지급일 2026-10-29"}),
])
def test_rule_summary_real_filings(name, expected):
    got = summ(name)
    assert got is not None
    for k, v in expected.items():
        assert got[k] == v, (k, got)


def test_numbers_are_copied_verbatim_from_source():
    """요약의 금액은 원문에 적힌 그대로다(환산·반올림 없음)."""
    for name in ("101_DT", "302_AKAM", "102_RIOT", "201_REXR", "203_SBAC", "801_MRVL"):
        d = load8k(name)
        got = summ(name)
        for token in got["amount"].replace(" ~ ", " · ").split(" · "):
            token = token.replace("주당 ", "")
            if token.startswith(("$", "C$", "£")):
                assert token in ek.normalize(d["text"]), (name, token)


def test_unsummarizable_returns_none():
    """8.01 이 배당·자사주·공모·소송 문형이 아니면 요약하지 않는다 → 화면은 Item 제목 + 원문 링크."""
    assert summ("801_XOM") is None


def test_split_items_strips_title_and_unicode_space():
    text = "Item 1.01. Entry into a Material Definitive Agreement.\nOn May 1, 2026, the Company entered into a Credit Agreement.\nSIGNATURES\n"
    items = ek.split_items(text)
    assert list(items) == ["1.01"]
    assert items["1.01"].startswith("On May 1, 2026")


def test_bankruptcy_item():
    t = ("Item 1.03 Bankruptcy or Receivership.\nOn March 3, 2026, Foo Corp. filed voluntary petitions under Chapter 11 "
         "in the United States Bankruptcy Court for the Southern District of Texas.\nSIGNATURES")
    got = ek.summarize_8k(["1.03"], t, "Foo Corp")
    assert got["what"] == "파산·회생 절차 신청 — Chapter 11"
    assert got["who"] == "법원 Southern District of Texas"
    assert got["date"] == "2026-03-03"


def test_par_value_is_not_an_amount():
    sec = "The Company issued warrants to purchase shares of common stock, par value $0.01 per share, for a purchase price of $5 million."
    assert ek.money_near(sec, ("purchase price",)) == "$5 million"
    assert ek.money_near("up to 1,000 shares of stock at an exercise price of $12.00", ("up to",)) == ""


# ---------------------------------------------------------------------------
# build_material_events: 규칙 요약 붙이기 · AI 요약(스텁)
# ---------------------------------------------------------------------------

class _HTTPError(Exception):
    def __init__(self, code):
        super().__init__(f"HTTP {code}")
        self.code = code


def _event(name, **kw):
    d = load8k(name)
    return {"ticker": d["ticker"], "company": d["company"], "accession": d["accession"], "link": d["link"],
            "fileDate": "2026-09-25", "items": [{"code": c, "label": c} for c in d["codes"]], **kw}


def test_summarize_events_attaches_rule_summary(no_network):
    ev = [_event("101_DT"), _event("801_XOM"), {"accession": "x", "link": "https://x", "fileDate": "2026-09-25",
                                                   "items": [{"code": "2.02"}, {"code": "9.01"}]}]
    texts_by_acc = {e["accession"]: load8k(n)["text"] for e, n in zip(ev[:2], ("101_DT", "801_XOM"))}
    texts = bme.summarize_events(ev, fetch=lambda e: texts_by_acc[e["accession"]])
    assert ev[0]["summary"]["src"] == "rule"
    assert ev[0]["summary"]["who"] == "상대방 Bank of America, N.A."
    assert ev[0]["summaryChecked"] is True
    assert "summary" not in ev[1] and ev[1]["summaryChecked"] is True   # 봤지만 요약 불가
    assert "summaryChecked" not in ev[2]                                 # 2.02·9.01 만이면 받지도 않는다
    assert set(texts) == {ev[0]["accession"], ev[1]["accession"]}


def test_summarize_events_retries_transient_but_not_404(no_network):
    a, b = _event("101_DT"), _event("102_RIOT")

    def fetch(e):
        raise _HTTPError(404 if e is a else 503)
    bme.summarize_events([a, b], fetch=fetch)
    assert a.get("summaryChecked") is True        # 없는 문서 — 다시 받지 않는다
    assert "summaryChecked" not in b              # 일시 오류 — 다음 실행이 다시 시도
    # 이미 본 행은 다시 받지 않는다
    calls = []
    bme.summarize_events([a], fetch=lambda e: calls.append(e) or "")
    assert calls == []


def test_ai_candidates_top_recent_important_only():
    caps = {"BIG": 900.0, "MID": 50.0, "TINY": 0.1}
    ev = [
        {"ticker": "BIG", "fileDate": "2026-09-25", "items": [{"code": "5.02"}], "accession": "1"},
        {"ticker": "BIG", "fileDate": "2026-09-25", "items": [{"code": "7.01"}], "accession": "2"},   # 중요 Item 아님
        {"ticker": "BIG", "fileDate": "2026-09-01", "items": [{"code": "1.01"}], "accession": "3"},   # 오래됨
        {"ticker": "TINY", "fileDate": "2026-09-25", "items": [{"code": "1.01"}], "accession": "4"},  # 시총 밖
        {"ticker": "MID", "fileDate": "2026-09-25", "items": [{"code": "1.01"}], "accession": "5"},
        {"ticker": "BIG", "fileDate": "2026-09-25", "items": [{"code": "1.01"}], "accession": "6", "aiChecked": True},
    ]
    got = bme.ai_candidates(ev, caps, "2026-09-26", top=2)
    assert [e["accession"] for e in got] == ["1", "5"]


def test_sanitize_ai_lines_drops_unverified_numbers():
    src = "On September 24, 2026, the Company entered into a Credit Agreement with Bank of America, N.A. providing up to $500,000,000."
    lines, dropped = bme.sanitize_ai_lines(
        {"lines": ["신용계약 체결", "상대방 Bank of America, N.A.", "한도 $600,000,000 (2026-09-24)"]}, src)
    assert lines == ["신용계약 체결", "상대방 Bank of America, N.A.", ""]
    assert dropped == 1
    lines, dropped = bme.sanitize_ai_lines({"lines": ["호재성 계약 체결", "", "한도 $500,000,000"]}, src)
    assert lines == ["", "", "한도 $500,000,000"] and dropped == 1   # 판단어 줄은 버린다
    assert bme.sanitize_ai_lines({"oops": 1}, src) == ([], 0)


def test_ai_summarize_events_caches_and_marks(no_network):
    e = _event("101_DT", ticker="DT")
    text = load8k("101_DT")["text"]
    prompts = []

    def call(prompt, key):
        prompts.append(prompt)
        return {"lines": ["신용계약 체결", "상대방 Bank of America, N.A.", "한도 $500,000,000"]}, "gemini-2.5-flash-lite"
    made = bme.ai_summarize_events([e], {e["accession"]: text}, "k", 2, {"DT": 100.0}, "2026-09-26",
                                   fetch=lambda _e: pytest.fail("본문을 다시 받으면 안 된다"), call=call,
                                   sleep=lambda _s: None)
    assert made == 1
    assert e["aiSummary"]["lines"][2] == "한도 $500,000,000"
    assert e["aiSummary"]["src"] == "ai" and e["aiChecked"] is True
    assert "Item 1.01." in prompts[0] and "SIGNATURE" not in prompts[0]
    # 캐시: 두 번째 실행은 부르지 않는다
    assert bme.ai_summarize_events([e], {}, "k", 2, {"DT": 100.0}, "2026-09-26", call=call) == 0
    assert len(prompts) == 1


def test_ai_summarize_disabled_without_key():
    assert bme.ai_summarize_events([_event("101_DT")], {}, "", 5, {"DT": 1.0}, "2026-09-26") == 0


# ---------------------------------------------------------------------------
# Form 144
# ---------------------------------------------------------------------------

def test_parse_real_form144():
    rec = f144.parse_form144((FIX / "form144" / "mar_0001974078-26-000367.xml").read_bytes())
    assert rec["issuer"] == "MARRIOTT INTERNATIONAL INC /MD/"
    assert rec["issuerCik"] == 1048286
    assert rec["person"] == "Marriott David S"
    assert rec["relation"] == "이사회 의장"
    assert rec["shares"] == 3500
    assert rec["marketValue"] == 1236900.0
    assert rec["sharesOutstanding"] == 282383000
    assert rec["approxSaleDate"] == "2026-09-25"
    assert rec["noticeDate"] == "2026-09-24"
    assert rec["broker"] == "Raymond James & Associates, Inc."
    assert rec["exchange"] == "NASDAQ"
    assert rec["acquired"] == "Inheritance"
    assert rec["lines"] == 1


def test_parse_form144_rejects_garbage():
    assert f144.parse_form144(b"<html>not xml") is None
    assert f144.parse_form144(b"<edgarSubmission><headerData/></edgarSubmission>") is None


def test_us_date():
    assert f144.us_date("09/25/2026") == "2026-09-25"
    assert f144.us_date("2/3/2026") == "2026-02-03"
    assert f144.us_date("13/40/2026") is None
    assert f144.us_date("") is None


@pytest.mark.parametrize("a, b, same", [
    ("Marriott David S", "MARRIOTT DAVID S", True),
    ("Jen-Hsun Huang", "HUANG JEN HSUN", True),
    ("Marriott David S", "Marriott J W Jr", False),        # 성만 같은 가족
    ("Harrison Deborah Marriott", "HARRISON DEBORAH M", True),
    ("Donna G. Marriott Lifetime Trust", "MARRIOTT DAVID S", False),
    ("", "X Y", False),
])
def test_same_person(a, b, same):
    assert f144.same_person(a, b) is same


def _trade(**kw):
    base = {"ticker": "MAR", "owner": "MARRIOTT DAVID S", "code": "S", "shares": 3500.0, "txDate": "2026-09-25",
            "fileDate": "2026-09-26", "accession": "0001-26-1", "link": "https://sec/f4.xml"}
    base.update(kw)
    return base


ROW = {"ticker": "MAR", "person": "Marriott David S", "shares": 3500, "approxSaleDate": "2026-09-25",
       "fileDate": "2026-09-25"}


def test_match_form4_sold():
    by = f144.index_trades([_trade(), _trade(shares=500.0, txDate="2026-09-29", accession="0001-26-2"),
                            _trade(code="P"), _trade(owner="MARRIOTT J W JR")])
    m = f144.match_form4(ROW, by, "2026-08-10")
    assert m["status"] == "sold"
    assert m["soldShares"] == 4000.0
    assert m["firstSaleDate"] == "2026-09-25" and m["lastSaleDate"] == "2026-09-29"
    assert m["form4Count"] == 2


def test_match_form4_window_and_status():
    by = f144.index_trades([_trade(txDate="2026-09-10"), _trade(txDate="2027-01-30")])   # 창 밖(-15일, +127일)
    assert f144.match_form4(ROW, by, "2026-08-10")["status"] == "pending"
    assert f144.match_form4(ROW, None, None)["status"] == "unknown"                        # 내부자 데이터 없음
    assert f144.match_form4(ROW, by, "2026-09-26")["status"] == "unknown"                  # 수집 범위 밖
    by2 = f144.index_trades([_trade(txDate="2026-09-23")])                                 # 3일 앞은 인정
    assert f144.match_form4(ROW, by2, None)["status"] == "sold"


def test_attach_matches_counts():
    rows = [dict(ROW), dict(ROW, ticker="ZZZ")]
    counts = f144.attach_matches(rows, f144.index_trades([_trade()]), "2026-08-01")
    assert counts == {"sold": 1, "pending": 1, "unknown": 0}
    assert rows[0]["match"]["status"] == "sold"
