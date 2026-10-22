"""오늘의 이슈(build_market_issues.py) 테스트 — 입력 종목 고르기·LLM 출력 검증(네트워크·LLM 없음)."""
import build_market_issues as M


def _s(t, company, chg, reason, status="ok", ev=None, sector_note=None):
    return {"ticker": t, "company": company, "changePct": chg, "reason": reason, "reasonStatus": status,
            "sectorNote": sector_note, "evidence": ev or [{"title": f"{company} news", "link": f"https://x/{t}", "source": "x"}]}


BOARD = {"tradeDate": "2026-10-21", "boards": {
    "large": {"up": [_s("A1", "알파", 12.3, "AI 데이터센터 수주"), _s("B1", "베타", 9.8, "AI 데이터센터 전력 공사 수주")],
              "down": [_s("C1", "감마", -5.0, "", status="none")]},
    "all": {"up": [_s("A1", "알파", 12.3, "AI 데이터센터 수주"),
                   _s("D1", "델타", 7.0, None, status="sector", sector_note="반도체 업종 동반 상승")], "down": []},
}}


def test_stocks_of_merges_boards_dedups_and_uses_sector_note():
    st = M.stocks_of(BOARD)
    assert [s["ticker"] for s in st] == ["A1", "B1", "D1"]
    assert st[2]["reason"] == "반도체 업종 동반 상승"


def test_validate_rules():
    st = M.stocks_of(BOARD)
    raw = [
        {"title": "지어낸 숫자", "summary": "수주 규모 5,000억 원", "tickers": ["A1", "B1"]},           # 입력에 없는 숫자
        {"title": "AI 데이터센터 수주", "summary": "데이터센터 전력 공사 수주가 이어졌다.", "tickers": ["A1", "B1", "ZZ"]},
        {"title": "혼자", "summary": "한 종목", "tickers": ["D1"]},                                   # 종목 부족
        {"title": "겹침", "summary": "업종 흐름", "tickers": ["A1", "D1"]},                            # 이미 쓴 A1 → 종목 부족
        "junk",
    ]
    rej = {}
    out = M.validate(raw, st, rej)
    assert len(out) == 1
    assert [t["t"] for t in out[0]["tickers"]] == ["A1", "B1"]          # 입력에 없는 ZZ 는 뺀다
    assert out[0]["evidence"][0]["link"] == "https://x/A1"               # 근거는 입력 보드에서
    assert rej == {"종목 부족": 2, "입력에 없는 숫자": 1}


def test_validate_drops_company_enumeration():
    st = M.stocks_of(BOARD)
    raw = [{"title": "따로 오름", "summary": "알파는 수주, 베타는 공사로 올랐다.", "tickers": ["A1", "B1"]}]
    rej = {}
    assert M.validate(raw, st, rej) == [] and rej == {"회사별 나열": 1}


def test_numbers_from_input_are_allowed_and_json_parsing():
    st = M.stocks_of(BOARD)
    raw = [{"title": "AI 수주", "summary": "12.3% 오른 종목 등 데이터센터 수주가 몰렸다.", "tickers": ["A1", "B1"]}]
    assert len(M.validate(raw, st)) == 1
    assert M.parse_json_array('```json\n[{"title":"x"}]\n```') == [{"title": "x"}]
    assert M.parse_json_array('{"issues": []}') == []
    assert M.parse_json_array("nope") is None
