"""소형주(yahoo-spark) 현재가가 묵은 캐시 마지막 봉의 종가를 덮지 않아야 한다(2026-10-21).

수정 전에는 make_stock 이 priceSource=yahoo-spark 일 때 bar_missing 을 끄는 바람에, 몇 주 묵은
캐시 마지막 봉(09-18)의 종가 칸에 오늘 가격이 실행마다 들어갔다 — US details 624개(8.6%)의
마지막 봉 종가가 그 봉의 고가·저가 밖이었다.
"""
from __future__ import annotations

import json

import update_data as UD


def _rows(n, last="2026-09-18"):
    from datetime import date, timedelta
    end = date.fromisoformat(last)
    out = []
    for i in range(n):
        d = end - timedelta(days=n - 1 - i)
        out.append({"date": d.isoformat(), "open": 100.0, "high": 101.0, "low": 99.0, "close": 100.0, "volume": 1000})
    return out


def _meta(**over):
    meta = {"symbol": "TEST", "company": "Test Co", "industry": "Software", "sector": "TECHNOLOGY",
            "groups": set(), "quotePrice": 80.0, "marketCapB": 1.0, "historySource": "yahoo-cache"}
    meta.update(over)
    return meta


def test_spark_price_does_not_overwrite_stale_cached_bar():
    stock = UD.make_stock(_meta(priceSource="yahoo-spark", priceDate="2026-10-20"), _rows(60))
    last = stock["chartSeries"][-1]
    assert last[5] == "2026-09-18" and last[3] == 100.0      # 묵은 봉 종가는 그대로
    assert stock["price"] == 80.0                             # 현재가 자체는 그대로 발행


def test_same_day_bar_still_takes_quote_price():
    stock = UD.make_stock(_meta(priceDate="2026-09-18", historySource="yahoo"), _rows(60))
    assert stock["chartSeries"][-1][3] == 80.0


def test_cached_history_drops_corrupted_last_bar(tmp_path, monkeypatch):
    monkeypatch.setattr(UD, "DETAILS_DIR", tmp_path)
    series = [[100, 101, 99, 100, 1000, f"2026-08-{i + 1:02d}"] for i in range(30)]
    series += [[256.76, 262.95, 256.76, 239.65, 1000, "2026-09-18"]]     # AEIS 실측 형태
    (tmp_path / "TEST.json").write_text(json.dumps({"historySource": "yahoo-cache", "chartSeries": series}), encoding="utf-8")
    rows, _div = UD.load_cached_history("TEST")
    assert len(rows) == 30 and rows[-1]["date"] == "2026-08-30"
