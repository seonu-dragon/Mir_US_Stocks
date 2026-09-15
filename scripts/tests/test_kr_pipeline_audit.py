"""2026-09-15 감사에서 잡힌 국내 파이프라인 회귀들을 고정한다.

1. 지수 카드가 **지수**여야 한다 — 시총 1위 개별 종목·대리 ETF 가격이 아니다.
2. 유니버스가 붕괴한 날은 발행하지 않는다(상장 3,000 하한).
3. DART 공시 원문 날짜 파싱은 라벨에 앵커링돼야 한다('-' 인 필드가 옆 값을 훔치지 않게).
"""
from __future__ import annotations

import json

import pytest

import build_kr_corp_disclosures as CD
import check_data_freshness as F
import sec_client as sec
import update_korea_data as K


# --------------------------------------------------------------------------
# 1. 지수 (m.stock index/basic)
# --------------------------------------------------------------------------

BASIC_KOSPI = {
    "itemCode": "KOSPI", "stockName": "코스피",
    "closePrice": "6,657.91", "compareToPreviousClosePrice": "-26.46",
    "fluctuationsRatio": "-0.40",
}
BASIC_KOSDAQ = {
    "itemCode": "KOSDAQ", "stockName": "코스닥",
    "closePrice": "1,024.55", "compareToPreviousClosePrice": "+3.10",
    "fluctuationsRatio": "0.30",
}


@pytest.fixture
def mstock(monkeypatch):
    """fetch_mstock_json 을 경로별 응답 dict 로 대체한다."""
    def _install(responses):
        def fake(path, retries=3):
            if path in responses:
                value = responses[path]
                if isinstance(value, Exception):
                    raise value
                return value
            raise RuntimeError(f"unexpected path {path}")
        monkeypatch.setattr(K, "fetch_mstock_json", fake)
    return _install


def test_indices_use_real_index_level_and_change(mstock):
    mstock({"index/KOSPI/basic": BASIC_KOSPI, "index/KOSDAQ/basic": BASIC_KOSDAQ})
    rows = K.build_kr_indices()
    by_name = {r["name"]: r for r in rows}
    assert by_name["코스피"]["price"] == 6657.91       # 069500 ETF 가격(105,410)이 아니다
    assert by_name["코스피"]["changePct"] == -0.40     # 삼성전자 등락률(-4.24)이 아니다
    assert by_name["코스닥"]["price"] == 1024.55
    assert by_name["코스닥"]["changePct"] == 0.30
    # ticker 는 클릭용 대리 ETF 로만 남는다.
    assert by_name["코스피"]["ticker"] == "069500"
    assert by_name["코스피"]["proxyTicker"] == "069500"


def test_index_failure_emits_null_not_a_stock_change(mstock):
    mstock({
        "index/KOSPI/basic": RuntimeError("m.stock down"),
        "index/KOSDAQ/basic": BASIC_KOSDAQ,
    })
    rows = K.build_kr_indices()
    kospi = next(r for r in rows if r["name"] == "코스피")
    assert kospi["price"] is None
    assert kospi["changePct"] is None          # 0 으로도, 종목 등락률로도 메우지 않는다
    assert kospi["source"] == "unavailable"
    kosdaq = next(r for r in rows if r["name"] == "코스닥")
    assert kosdaq["changePct"] == 0.30         # 한쪽 실패가 다른 쪽을 망치지 않는다


def test_index_payload_without_price_is_null(mstock):
    mstock({
        "index/KOSPI/basic": {"stockName": "코스피"},   # 응답은 왔는데 필드가 없다
        "index/KOSDAQ/basic": BASIC_KOSDAQ,
    })
    kospi = next(r for r in K.build_kr_indices() if r["name"] == "코스피")
    assert kospi["price"] is None and kospi["changePct"] is None


# --------------------------------------------------------------------------
# 2. 유니버스 하한
# --------------------------------------------------------------------------

def _meta(symbol, market="kospi"):
    return {"symbol": symbol, "company": symbol, "market": market,
            "marketCapT": 1.0, "groups": {"all_kr"}}


@pytest.fixture
def universe(monkeypatch):
    """fetch_all_listed 의 네트워크 의존부를 막고 지정한 종목 수만 만들어 준다."""
    def _install(count):
        monkeypatch.setattr(K, "fetch_naver_industry_map", lambda: {})
        pages = {}
        for sosok in (0, 1):
            pages[sosok] = []
        rows = [_meta(f"{i:06d}") for i in range(count)]
        state = {"served": False}

        def fake_page(sosok, page):
            if sosok != 0 or state["served"]:
                return []
            state["served"] = True
            return rows

        monkeypatch.setattr(K, "fetch_market_page", fake_page)
        monkeypatch.setattr(K, "is_korean_preferred_stock", lambda code, name: False)
    return _install


def test_universe_collapse_aborts(universe):
    """2026-09-10: 네이버 PC HTML 소멸로 50종목(ETF 뿐) 스냅샷이 이틀 배포됐다."""
    universe(50)
    with pytest.raises(SystemExit) as exc:
        K.fetch_all_listed()
    assert "하한" in str(exc.value)


def test_universe_above_floor_passes(universe):
    universe(K.MIN_LISTED_UNIVERSE + 5)
    rows = K.fetch_all_listed()
    listed = [r for r in rows if r.get("market") in {"kospi", "kosdaq"}]
    assert len(listed) >= K.MIN_LISTED_UNIVERSE


def test_limit_skips_the_floor(universe):
    """--limit 는 테스트용이라 하한을 적용하지 않는다."""
    universe(80)
    rows = K.fetch_all_listed(limit=20)
    assert rows


def test_kr_freshness_group_has_universe_floor():
    mins = F.MIN_CHECKS.get("kr") or []
    entry = next(m for m in mins if m[0] == "data/korea/market_snapshot.json")
    assert entry[1] == ("universeCount",)
    assert entry[2] >= 3000


def test_universe_floor_fails_the_gate(monkeypatch, tmp_path):
    monkeypatch.setattr(F, "ROOT", tmp_path)
    monkeypatch.setattr(F, "CHECKS", {"t": []})
    monkeypatch.setattr(F, "RATIO_CHECKS", {"t": []})
    monkeypatch.setattr(F, "MIN_CHECKS", {"t": [("data/a.json", ("universeCount",), 3000, "유니버스")]})
    path = tmp_path / "data" / "a.json"
    path.parent.mkdir(parents=True)
    path.write_text(json.dumps({"universeCount": 50}), encoding="utf-8")
    monkeypatch.setattr("sys.argv", ["check_data_freshness.py", "--group", "t"])
    assert F.main() == 1
    path.write_text(json.dumps({"universeCount": 3821}), encoding="utf-8")
    assert F.main() == 0


# --------------------------------------------------------------------------
# 3. DART 공시 원문 날짜 앵커링
# --------------------------------------------------------------------------

def test_after_does_not_steal_the_next_field():
    """배당기준일이 '-' 면 지급예정일 값을 집어오던 버그."""
    txt = "배당기준일 - 배당금지급 예정일자 2027-04-15 이사회결의일 2026-09-10"
    assert CD.after(txt, "배당기준일", CD.DATE) is None
    assert CD.after(txt, "배당금지급 예정일자", CD.DATE) == "2027-04-15"
    assert CD.after(txt, "이사회결의일", CD.DATE) == "2026-09-10"


def test_after_reads_the_anchored_value():
    txt = "배당기준일 2026-12-31 배당금지급 예정일자 2027-04-15"
    assert CD.after(txt, "배당기준일", CD.DATE) == "2026-12-31"


def test_after_skips_a_header_occurrence():
    """표 머리글에 같은 라벨이 먼저 나와도 값이 붙은 쪽을 쓴다."""
    txt = "계약기간 시작일 종료일 구분 계약기간 시작일 2026-01-02 종료일 2026-12-31"
    assert CD.after(txt, "종료일", CD.DATE) == "2026-12-31"
    assert CD.after(txt, "계약기간 시작일", CD.DATE) == "2026-01-02"


def test_dividend_parse_leaves_missing_fields_none():
    txt = ("1. 배당구분 결산배당 2. 배당종류 현금배당 1주당 배당금(원) 보통주식 1,500 "
           "시가배당률(%) 보통주식 - 배당금총액(원) 9,000,000,000 배당기준일 - "
           "배당금지급 예정일자 2027-04-15 이사회결의일 2026-09-10")
    row = CD.parse_dividend(txt)
    assert row["dps"] == 1500.0
    assert row["yieldPct"] is None      # '-' 는 값이 없다는 뜻이다
    assert row["total"] == 9000000000.0
    assert row["recordDate"] is None
    assert row["payDate"] == "2027-04-15"


# --------------------------------------------------------------------------
# 4. 회귀 게이트
# --------------------------------------------------------------------------

def test_assert_not_regressing_blocks_half_sized_payload(tmp_path):
    path = tmp_path / "contracts.json"
    path.write_text(json.dumps({"count": 108, "rows": [{}] * 108}), encoding="utf-8")
    with pytest.raises(SystemExit):
        sec.assert_not_regressing(path, {"count": 50, "rows": [{}] * 50})


def test_assert_not_regressing_allows_small_dip(tmp_path):
    path = tmp_path / "contracts.json"
    path.write_text(json.dumps({"count": 100, "rows": [{}] * 100}), encoding="utf-8")
    sec.assert_not_regressing(path, {"count": 80, "rows": [{}] * 80})


def test_assert_not_regressing_is_noop_without_previous(tmp_path):
    sec.assert_not_regressing(tmp_path / "nope.json", {"count": 1, "rows": [{}]})


def test_latest_fiscal_year_waits_for_march_filings():
    from datetime import datetime
    from zoneinfo import ZoneInfo
    kst = ZoneInfo("Asia/Seoul")
    assert sec.latest_fiscal_year(datetime(2026, 2, 10, tzinfo=kst)) == 2024
    assert sec.latest_fiscal_year(datetime(2026, 4, 1, tzinfo=kst)) == 2025
    assert sec.latest_fiscal_year(datetime(2026, 12, 31, tzinfo=kst)) == 2025
