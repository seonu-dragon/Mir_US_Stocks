"""국내 스냅샷 대표가 = KRX 공식 정규장 종가 (2026-10-02) 회귀 테스트.

증상: 네이버 m.stock 목록 closePrice 가 16:00 시간외 단일가부터 그 가격으로 바뀐다. 마감 브리핑 잡이
19:09 KST 에 돈 2026-10-01 스냅샷은 삼성전자 273,000(KRX 종가 276,000)처럼 대표가가 틀렸다.
수정: build_kr_krx_close.py(pykrx)로 받은 KRX 공식 일별 시세로 같은 기준일 행을 덮는다.
"""
from __future__ import annotations

import update_korea_data as K


def _row(symbol="005930", price=275000.0, pct=-0.36, prev=276000.0, date="2026-10-02", **kw):
    row = {"symbol": symbol, "quotePrice": price, "quoteChangePct": pct, "quotePrevClose": prev,
           "quoteVolume": 1.0, "quoteAmount": 1.0, "quoteDate": date, "marketCapT": 1.0, "marketCapB": 1.0}
    row.update(kw)
    return row


def test_stock_takes_krx_close_pct_volume_cap():
    rows = [_row()]
    krx = {"005930": {"close": 276000.0, "changePct": 0.0, "volume": 11236224.0,
                      "amount": 3094417584000.0, "cap": 1613572895808000.0}}
    assert K.override_with_krx_close(rows, krx, "2026-10-02") == 1
    r = rows[0]
    assert r["quotePrice"] == 276000.0
    assert r["quoteChangePct"] == 0.0
    assert r["quoteVolume"] == 11236224.0
    assert r["quoteAmount"] == 3094418  # 백만원
    assert abs(r["marketCapT"] - 1613.572895808) < 1e-9 and r["marketCapB"] == r["marketCapT"]


def test_etf_pct_from_naver_prev_close():
    rows = [_row("069500", price=111900.0, pct=-0.5, prev=112000.0)]
    krx = {"069500": {"close": 112060.0, "volume": 25086431.0, "amount": 2801310047025.0}}
    K.override_with_krx_close(rows, krx, "2026-10-02")
    assert rows[0]["quotePrice"] == 112060.0
    assert rows[0]["quoteChangePct"] == 0.05
    assert rows[0]["marketCapT"] == 1.0  # ETF 는 KRX 시총이 없어 그대로


def test_other_quote_date_untouched():
    """거래정지 종목처럼 기준일이 다른 행은 그날 KRX 값으로 덮지 않는다."""
    rows = [_row(date="2026-09-30", price=5000.0)]
    krx = {"005930": {"close": 276000.0, "changePct": 0.0}}
    assert K.override_with_krx_close(rows, krx, "2026-10-02") == 0
    assert rows[0]["quotePrice"] == 5000.0


def test_same_price_counts_zero_and_missing_symbol_kept():
    rows = [_row(price=276000.0), _row("999999", price=10.0)]
    krx = {"005930": {"close": 276000.0, "changePct": 0.0}}
    assert K.override_with_krx_close(rows, krx, "2026-10-02") == 0
    assert rows[1]["quotePrice"] == 10.0


def test_no_credentials_is_noop(monkeypatch):
    monkeypatch.delenv("KRX_ID", raising=False)
    monkeypatch.delenv("KRX_PW", raising=False)
    universe = {"005930": _row()}
    K.apply_krx_official_close(universe)
    assert universe["005930"]["quotePrice"] == 275000.0
