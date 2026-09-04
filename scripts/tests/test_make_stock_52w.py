"""make_stock 의 52주 필드는 정말 52주(252 거래일)여야 한다.

2026-09-04 실측: `stochK`·`newHighDistancePct`·`newHighRecency4w` 가 rows 전체(최대
1,260봉 ≈ 5년)의 고저로 계산되고 있었다 — 표본 132 종목 중 131 개가 5년 고점과 일치,
252봉 고점과 일치한 건 63 개뿐. 프론트는 이 값을 "52주 레인지"·"신고가 거리" 라고
불렀다. 아래 테스트는 252봉 밖의 고점이 52주 필드에 새지 않는 것을 고정한다.
"""
from __future__ import annotations

import update_data as UD


def _rows(closes):
    return [
        {
            "date": f"2020-01-{(i % 28) + 1:02d}",
            "open": c, "high": c * 1.01, "low": c * 0.99, "close": c, "volume": 1000 + i,
        }
        for i, c in enumerate(closes)
    ]


def _meta(**over):
    meta = {
        "symbol": "TEST", "company": "Test Co", "industry": "Software", "sector": "TECHNOLOGY",
        "groups": set(), "quotePrice": 100.0, "marketCapB": 1.0, "historySource": "yahoo",
    }
    meta.update(over)
    return meta


def test_52w_high_ignores_bars_older_than_252():
    # 400봉: 앞쪽 148봉은 고점 400(5년 전 거품), 뒤 252봉은 90~110 박스.
    closes = [400.0] * 148 + [90.0 + (i % 21) for i in range(252)]
    stock = UD.make_stock(_meta(quotePrice=100.0), _rows(closes))
    # 52주 고점 = max(최근 252봉 110, 현재가 100) = 110 → 거리 9.1%
    assert stock["newHighDistancePct"] == 9.1
    assert stock["newHighRecency4w"] == "None"
    # 52주 레인지 위치 = (100-90)/(110-90) = 50
    assert stock["stochK"] == 50
    # 5년 기준 값은 별도 필드로 남아 예전 의미를 잃지 않는다.
    assert stock["newHighDistance5yPct"] == 75.0
    assert stock["rangePos5yPct"] == 3


def test_52w_recency_uses_52w_high_not_5y_high():
    closes = [400.0] * 148 + [100.0] * 252
    stock = UD.make_stock(_meta(quotePrice=100.0), _rows(closes))
    assert stock["newHighDistancePct"] == 0.0
    assert stock["newHighRecency4w"] == 1


def test_short_history_uses_all_bars():
    closes = [50.0] * 10 + [100.0] * 30
    stock = UD.make_stock(_meta(quotePrice=100.0), _rows(closes))
    assert stock["newHighDistancePct"] == 0.0
    assert stock["stochK"] == 100
    assert stock["newHighDistance5yPct"] == 0.0
