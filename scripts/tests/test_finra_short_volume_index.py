"""build_finra_short_volume 의 S&P 500 공매도 거래량 비율 지수(순수 함수) 테스트. 네트워크 없음."""
from __future__ import annotations

import build_finra_short_volume as B


def test_parse_raw_normalizes_class_shares():
    text = "Date|Symbol|ShortVolume|ShortExemptVolume|TotalVolume|Market\n" \
           "20261022|BF/B|50|0|100|B,Q,N\n20261022|AAPL|30|0|120|Q\n20261022|ZZZ|1|0|0|Q\n"
    raw = B.parse_raw(text, {"BF.B", "AAPL", "ZZZ"})
    assert raw == {"BF.B": (50.0, 100.0), "AAPL": (30.0, 120.0)}   # 총거래량 0 은 뺀다
    assert B.parse(text, {"AAPL"}) == {"AAPL": 25.0}


def test_index_point_is_dollar_weighted(monkeypatch):
    monkeypatch.setattr(B, "IDX_MIN_COVER", 2)
    raw = {"A": (50.0, 100.0), "B": (10.0, 100.0), "C": (5.0, 10.0)}
    prices = {"A": 10.0, "B": 30.0, "D": 5.0}   # C 는 구성 종목 아님, D 는 거래 없음
    pt = B.index_point(raw, prices)
    # (50·10 + 10·30) / (100·10 + 100·30) = 800 / 4000 = 20%
    assert pt == {"v": 20.0, "n": 2, "dvB": 0.0}


def test_index_point_rejects_thin_days(monkeypatch):
    monkeypatch.setattr(B, "IDX_MIN_COVER", 3)
    assert B.index_point({"A": (1.0, 2.0)}, {"A": 1.0, "B": 1.0, "C": 1.0}) is None


def test_merge_keeps_recorded_days_and_caps():
    prev = [{"d": "2026-10-20", "v": 40.0, "n": 500}, {"d": "bad"}]
    fresh = {"2026-10-20": {"v": 99.0, "n": 1}, "2026-10-21": {"v": 41.0, "n": 501}, "2026-10-19": None}
    out = B.merge_index_history(prev, fresh)
    assert [r["d"] for r in out] == ["2026-10-20", "2026-10-21"]
    assert out[0]["v"] == 40.0          # 이미 기록한 날은 다시 계산하지 않는다
    assert len(B.merge_index_history([], {f"2026-01-{i:02d}": {"v": 1.0} for i in range(1, 11)}, keep=3)) == 3


def test_sp500_prices_and_payload():
    snap = {"stocks": [{"ticker": "aapl", "price": 200, "groups": ["idx_sp500"]},
                       {"ticker": "X", "price": 5, "groups": ["all_us"]},
                       {"ticker": "Y", "price": None, "groups": ["idx_sp500"]}]}
    assert B.sp500_prices(snap) == {"AAPL": 200.0}
    p = B.index_payload([{"d": "2026-10-21", "v": 40.0}, {"d": "2026-10-22", "v": 42.0}])
    assert p["asOf"] == "2026-10-22" and p["avg20"] == 41.0 and p["count"] == 2
    assert "잔고 아님" in p["name"]
