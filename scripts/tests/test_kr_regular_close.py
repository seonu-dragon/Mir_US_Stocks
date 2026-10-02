"""국내 스냅샷 대표가 = 정규장 종가 (2026-10-02) 회귀 테스트.

증상: 네이버 m.stock 목록 closePrice 가 16:00 시간외 단일가부터 그 가격으로 바뀐다. 마감 브리핑 잡이
19:09 KST 에 돈 2026-10-01 스냅샷은 삼성전자 273,000(KRX 종가 276,000)처럼 대표가가 틀렸다.
KRX 일별 시세(pykrx)도 당일분은 18시 전까지 시간외 가격이라(17:32 실측 SK하이닉스 1,839,000) 못 쓴다.
수정: 다음 금융 regularTradePrice(정규장 종가)로 같은 기준일 행을 덮는다. 네트워크는 쓰지 않는다.
"""
from __future__ import annotations

import update_korea_data as K


def _row(symbol="000660", price=1843000.0, pct=0.55, prev=1833000.0, date="2026-10-02", **kw):
    row = {"symbol": symbol, "quotePrice": price, "quoteChangePct": pct, "quotePrevClose": prev,
           "quoteDate": date, "listedShares": 730492365, "marketCapT": 1346.3, "marketCapB": 1346.3}
    row.update(kw)
    return row


def test_regular_close_replaces_after_hours_price():
    rows = [_row()]
    regular = {"000660": {"date": "2026-10-02", "close": 1841000.0, "prevClose": 1833000.0}}
    assert K.override_with_regular_close(rows, regular) == 1
    r = rows[0]
    assert r["quotePrice"] == 1841000.0
    assert r["quoteChangePct"] == 0.44
    assert abs(r["marketCapT"] - 730492365 * 1841000 / 1e12) < 1e-9 and r["marketCapB"] == r["marketCapT"]


def test_prev_close_falls_back_to_naver_and_cap_scales_without_shares():
    rows = [_row("069500", price=112000.0, prev=111520.0, listedShares=None, marketCapT=25.0)]
    regular = {"069500": {"date": "2026-10-02", "close": 112060.0, "prevClose": None}}
    K.override_with_regular_close(rows, regular)
    assert rows[0]["quoteChangePct"] == 0.48
    assert abs(rows[0]["marketCapT"] - 25.0 * 112060 / 112000) < 1e-9


def test_other_quote_date_untouched():
    """거래정지 종목처럼 기준일이 다른 행은 덮지 않는다."""
    rows = [_row(date="2026-09-30", price=5000.0)]
    regular = {"000660": {"date": "2026-10-02", "close": 1841000.0, "prevClose": 1833000.0}}
    assert K.override_with_regular_close(rows, regular) == 0
    assert rows[0]["quotePrice"] == 5000.0


def test_same_price_and_missing_symbol_kept():
    rows = [_row(price=1841000.0), _row("999999", price=10.0, pct=1.0)]
    regular = {"000660": {"date": "2026-10-02", "close": 1841000.0, "prevClose": 1833000.0}}
    assert K.override_with_regular_close(rows, regular) == 0
    assert rows[0]["quoteChangePct"] == 0.55  # 같은 값이면 네이버 등락률 그대로
    assert rows[1]["quotePrice"] == 10.0


def test_daum_parser(monkeypatch):
    import io
    import json

    payload = {"tradePrice": 1843000.0, "regularTradePrice": 1841000.0, "prevClosingPrice": 1833000.0,
               "tradeDate": "20261002"}

    class _Resp(io.BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    monkeypatch.setattr(K.urllib.request, "urlopen",
                        lambda req, timeout=None: _Resp(json.dumps(payload).encode()))
    assert K.fetch_daum_regular_close("000660") == {
        "date": "2026-10-02", "close": 1841000.0, "prevClose": 1833000.0}
    payload["regularTradePrice"] = None
    assert K.fetch_daum_regular_close("000660") is None
