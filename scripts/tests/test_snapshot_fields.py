"""스냅샷 행 파생 필드(거래량·거래대금·KR 가격 기준일·ETF NAV·액면분할) 계약.

새 외부 호출 없이 이미 받는 응답에서 채운다는 게 원칙이라, 없는 값은 지어내지 않고 키를 뺀다:
KR 거래대금은 네이버 값만(가격×거래량 근사 금지), US 는 소스에 대금이 없어 가격×거래량 근사.
"""
from __future__ import annotations

from datetime import date

import update_data as UD
import update_korea_data as K


def _rows(n=40, last_date="2026-09-25", volume=5000):
    rows = []
    for i in range(n):
        rows.append({
            "date": f"2026-08-{(i % 28) + 1:02d}" if i < n - 1 else last_date,
            "open": 100.0, "high": 101.0, "low": 99.0, "close": 100.0, "volume": float(volume + i),
        })
    return rows


def _meta(**over):
    meta = {
        "symbol": "TEST", "company": "Test Co", "industry": "Software", "sector": "TECHNOLOGY",
        "groups": set(), "quotePrice": 50.0, "marketCapB": 1.0, "historySource": "yahoo",
    }
    meta.update(over)
    return meta


# ── 거래량·거래대금 ─────────────────────────────────────────────────────────────

def test_us_amount_is_price_times_quote_volume():
    stock = UD.make_stock(_meta(quoteVolume=1_000_000), _rows())
    assert stock["volume"] == 1_000_000
    assert stock["amount"] == 50_000_000


def test_us_volume_falls_back_to_last_real_bar_on_price_date():
    stock = UD.make_stock(_meta(quoteVolume=0, priceDate="2026-09-25"), _rows(last_date="2026-09-25"))
    assert stock["volume"] == 5039
    assert stock["amount"] == 50 * 5039


def test_us_volume_not_taken_from_a_bar_of_another_day():
    # 기준일 봉이 빠졌으면(마지막 봉이 전날) 그 봉의 거래량을 오늘 값으로 쓰지 않는다.
    stock = UD.make_stock(_meta(quoteVolume=None, priceDate="2026-09-26"), _rows(last_date="2026-09-25"))
    assert "volume" not in stock and "amount" not in stock


def test_synthetic_history_volume_is_never_published():
    stock = UD.make_stock(_meta(quoteVolume=None, historySource="snapshot"), _rows())
    assert "volume" not in stock and "amount" not in stock


def test_kr_amount_uses_naver_millions_as_won():
    stock = UD.make_stock(_meta(quoteVolume=19_385_053, quoteAmount=5_504_265), _rows())
    assert stock["volume"] == 19_385_053
    assert stock["amount"] == 5_504_265_000_000


def test_kr_missing_amount_is_not_estimated():
    stock = UD.make_stock(_meta(quoteVolume=1000, quoteAmount=None), _rows())
    assert stock["volume"] == 1000
    assert "amount" not in stock


# ── 액면분할 ───────────────────────────────────────────────────────────────────

def _chart_result(splits):
    return {"events": {"splits": splits}}


def test_parse_yahoo_splits_normalizes_and_filters():
    result = _chart_result({
        "1626787800": {"date": 1626787800, "numerator": 4.0, "denominator": 1.0, "splitRatio": "4:1"},
        "1718026200": {"date": 1718026200, "numerator": 10.0, "denominator": 1.0, "splitRatio": "10:1"},
        "1000000000": {"date": 1000000000, "numerator": 2.0, "denominator": 1.0},   # 2001 → 10년 밖
        "1600000000": {"date": 1600000000, "numerator": 1.0, "denominator": 1.0},   # 1:1 은 분할 아님
    })
    out = UD.parse_yahoo_splits(result, since="2016-09-26")
    assert out == [["2021-07-20", 4.0, 1.0], ["2024-06-10", 10.0, 1.0]]


def test_full_fetch_asks_yahoo_for_ten_years():
    assert UD.yahoo_history_range_param("5y") == "10y"
    assert UD.yahoo_history_range_param("1y") == "1y"


def test_take_splits_full_fetch_is_complete():
    UD._FRESH_SPLITS["NVDA"] = [["2024-06-10", 10.0, 1.0]]
    UD._CACHED_SPLITS["NVDA"] = [["2021-07-20", 4.0, 1.0]]
    got = UD.take_splits("NVDA", "NVDA", True, today=date(2026, 9, 26))
    assert got == [["2024-06-10", 10.0, 1.0]]
    assert "NVDA" not in UD._FRESH_SPLITS and "NVDA" not in UD._CACHED_SPLITS


def test_take_splits_incremental_merges_with_cache():
    UD._FRESH_SPLITS["X"] = [["2026-03-02", 2.0, 1.0]]
    UD._CACHED_SPLITS["X"] = [["2021-07-20", 4.0, 1.0], ["2015-01-02", 3.0, 1.0]]
    got = UD.take_splits("X", "X", False, today=date(2026, 9, 26))
    assert got == [["2021-07-20", 4.0, 1.0], ["2026-03-02", 2.0, 1.0]]   # 10년 밖은 잘림


def test_take_splits_unknown_stays_unknown():
    # 증분인데 직전 detail 에 splits 키가 없고 1년 안에도 분할이 없으면 '없음'이라고 단정하지 않는다.
    UD._FRESH_SPLITS["Y"] = []
    assert UD.take_splits("Y", "Y", False) is None


def test_cached_splits_distinguishes_missing_key_from_empty():
    assert UD._cached_splits({}) is None
    assert UD._cached_splits({"splits": []}) == []


def test_splits_ride_in_the_detail_file_not_the_light_snapshot():
    stock = UD.make_stock(_meta(quoteVolume=10, splits=[["2024-06-10", 10.0, 1.0]]), _rows())
    stock["ticker"] = "NVDA"
    light, details = UD.split_snapshot_details({"stocks": [stock]})
    assert details["NVDA"]["splits"] == [["2024-06-10", 10.0, 1.0]]
    assert "splits" not in light["stocks"][0]
    assert light["stocks"][0]["volume"] == 10


# ── KR ETF NAV·괴리율 · 가격 기준일 ────────────────────────────────────────────

def test_etf_nav_premium_uses_same_response_price():
    fields = K.etf_nav_fields({"price": 113145.0, "nav": 113214.0})
    assert fields == {"nav": 113214.0, "navPremiumPct": -0.06}
    assert K.etf_nav_fields({"price": 100.0, "nav": None}) == {}


def test_attach_kr_etf_nav_fills_amount_and_date(monkeypatch):
    monkeypatch.setattr(K, "_ETF_UNIVERSE_CACHE", [
        {"code": "069500", "price": 113145.0, "nav": 113214.0, "volume": 20168647.0, "amountMil": 2275377.0},
    ])
    rows = [{"ticker": "069500", "price": 113145.0}, {"ticker": "005930", "price": 286500.0, "priceDate": "2026-09-23"}]
    assert K.attach_kr_etf_nav(rows, "2026-09-23") == 1
    etf = rows[0]
    assert etf["nav"] == 113214.0 and etf["navPremiumPct"] == -0.06
    assert etf["amount"] == 2_275_377_000_000 and etf["volume"] == 20168647
    assert etf["priceDate"] == "2026-09-23"
    assert "nav" not in rows[1]


def test_attach_kr_etf_nav_keeps_existing_quote_values(monkeypatch):
    monkeypatch.setattr(K, "_ETF_UNIVERSE_CACHE", [
        {"code": "069500", "price": 113145.0, "nav": 113214.0, "volume": 1.0, "amountMil": 1.0},
    ])
    rows = [{"ticker": "069500", "volume": 5, "amount": 7, "priceDate": "2026-09-22"}]
    K.attach_kr_etf_nav(rows, "2026-09-23")
    assert rows[0]["volume"] == 5 and rows[0]["amount"] == 7 and rows[0]["priceDate"] == "2026-09-22"


def test_kr_market_page_carries_trade_date_and_amount(monkeypatch):
    payload = {"stocks": [{
        "itemCode": "005930", "stockName": "삼성전자", "stockEndType": "stock",
        "closePrice": "286,500", "closePriceRaw": "286500", "fluctuationsRatio": "3.62",
        "accumulatedTradingVolume": "19,385,053", "accumulatedTradingValue": "5,504,265",
        "marketValue": "16,749,588", "localTradedAt": "2026-09-23T20:20:21+09:00",
    }]}
    monkeypatch.setattr(K, "fetch_mstock_json", lambda path, retries=3: payload)
    monkeypatch.setattr(K, "classify_kr_stock", lambda *a, **k: ("기술", "반도체"))
    row = K.fetch_market_page(0, 1)[0]
    assert row["quoteDate"] == "2026-09-23"
    assert row["quoteVolume"] == 19385053
    assert row["quoteAmount"] == 5504265
