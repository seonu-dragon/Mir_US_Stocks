"""국내↔미국 연관 종목 빌더(build_cross_market_links.py) — 시차 정렬·편상관·강도 판정·발행 방어. 오프라인.

실행: py -m pytest -q scripts/tests/test_cross_market_links.py
"""
from __future__ import annotations

import json
import math
import random
from datetime import date, timedelta

import pytest

import build_cross_market_links as b


def test_closes_from_chart_drops_bad_rows_and_sorts():
    chart = [
        [1, 1, 1, 10.0, 100, "2026-01-03"],
        [1, 1, 1, 9.0, 100, "2026-01-02"],
        [1, 1, 1, None, 100, "2026-01-04"],
        [1, 1, 1, -5, 100, "2026-01-05"],
        [1, 1, 1, 11.0, 100, None],
        "junk",
        [1, 1, 1, 12.0, 100, "2026-01-06T00:00:00"],
    ]
    assert b.closes_from_chart(chart) == [("2026-01-02", 9.0), ("2026-01-03", 10.0), ("2026-01-06", 12.0)]
    assert b.closes_from_chart(None) == []


def test_log_returns():
    r = b.log_returns([("d1", 100.0), ("d2", 110.0), ("d3", 99.0)])
    assert set(r) == {"d2", "d3"}
    assert r["d2"] == pytest.approx(math.log(1.1))


def test_lag_spans_pairs_us_day_with_next_kr_day_and_merges_kr_holidays():
    kr = ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-29"]  # 24~28 국내 연휴
    us = ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-28"]
    spans = b.lag_spans(kr, us)
    # 국내 22일 ← 미국 21일(국내 21일 종가 뒤 열린 세션), 23일 ← 22일
    assert spans[0] == ("2026-09-22", ("2026-09-21",))
    assert spans[1] == ("2026-09-23", ("2026-09-22",))
    # 국내 29일 ← 미국 23·24·25·28일(연휴 동안의 미국 세션 전부)
    assert spans[2] == ("2026-09-29", ("2026-09-23", "2026-09-24", "2026-09-25", "2026-09-28"))


def test_lag_spans_skips_when_us_closed():
    kr = ["2026-11-26", "2026-11-27"]
    us = ["2026-11-25", "2026-11-27"]  # 26일 추수감사절 휴장 → 27일 국내에 짝이 없다
    assert b.lag_spans(kr, us) == []


def test_same_spans_and_span_sum():
    assert b.same_spans(["a", "b", "c"], ["b", "c", "d"]) == [("b", ("b",)), ("c", ("c",))]
    assert b.span_sum({"x": 0.1, "y": 0.2}, ("x", "y")) == pytest.approx(0.3)
    assert b.span_sum({"x": 0.1}, ("x", "y")) is None


def test_partial_corr_removes_common_market_factor():
    rng = random.Random(7)
    z = [rng.gauss(0, 1) for _ in range(400)]
    # x·y 는 공통 시장(z)만 공유하고 고유 연결은 없다 → 원 상관은 높고 편상관은 0 근처
    x = [zi + rng.gauss(0, 0.5) for zi in z]
    y = [zi + rng.gauss(0, 0.5) for zi in z]
    assert b.pearson(x, y) > 0.6
    assert abs(b.partial_corr(x, y, z)) < 0.12
    # 고유 연결이 있으면 편상관이 남는다
    link = [rng.gauss(0, 1) for _ in range(400)]
    x2 = [zi + li for zi, li in zip(z, link)]
    y2 = [zi + li + rng.gauss(0, 0.5) for zi, li in zip(z, link)]
    assert b.partial_corr(x2, y2, z) > 0.6


def test_pearson_degenerate():
    assert b.pearson([1, 1, 1], [1, 2, 3]) is None
    assert b.pearson([1, 2], [1, 2]) is None


def test_classify_thresholds():
    assert b.classify(None, 238) == "insufficient"
    assert b.classify(0.5, 50) == "insufficient"
    assert b.classify(0.25, 238) == "strong"
    assert b.classify(0.14, 238) == "moderate"      # 2/√238 ≈ 0.13
    assert b.classify(0.12, 238) == "weak"
    assert b.classify(0.12, 1000) == "moderate"     # 표본이 크면 문턱이 0.10 까지 내려간다
    assert b.classify(-0.3, 238) == "weak"


def _calendar(n, start="2025-01-01"):
    d = date.fromisoformat(start)
    out = []
    while len(out) < n:
        if d.weekday() < 5:
            out.append(d.isoformat())
        d += timedelta(days=1)
    return out


def _closes(days, rets, base=100.0):
    out = [(days[0], base)]
    c = base
    for d, r in zip(days[1:], rets):
        c *= math.exp(r)
        out.append((d, c))
    return out


def test_pair_stats_detects_lagged_link_beyond_market():
    rng = random.Random(3)
    days = _calendar(300)
    spy = [rng.gauss(0, 0.01) for _ in days[1:]]
    nvda = [s + rng.gauss(0, 0.02) for s in spy]
    # 국내 k 일 = 미국 k-1 일 NVDA 고유 움직임 × 0.8 + 잡음 (미국 → 국내 다음날)
    us_idio = [n - s for n, s in zip(nvda, spy)]
    kr = [0.0] + [0.8 * us_idio[i - 1] + rng.gauss(0, 0.01) for i in range(1, len(days) - 1)]
    kr_closes = _closes(days, kr)
    us_closes = _closes(days, nvda)
    spy_closes = _closes(days, spy)
    cal = b.window_days_for(kr_closes, days[-1])
    st = b.pair_stats(kr_closes, us_closes, spy_closes, kr_cal=cal)
    assert st["n"] >= 200
    assert st["lagCorrEx"] > 0.6
    assert st["strength"] == "strong"
    # 같은 날 방향엔 연결을 넣지 않았다
    assert abs(st["sameCorrEx"]) < 0.2
    assert set(st) >= {"lagCorr", "sameCorr", "sameStrength"}


def test_pair_stats_without_data_is_insufficient():
    days = _calendar(10)
    st = b.pair_stats([], [], _closes(days, [0.0] * 9), kr_cal=days)
    assert st["strength"] == "insufficient" and st["n"] == 0


def test_curated_types_and_rows_are_valid():
    seen = set()
    for kr, us, typ, why in b.CURATED:
        assert len(kr) == 6 and kr.isdigit(), kr
        assert us and us == us.upper(), us
        assert typ in b.TYPE_LABELS, typ
        assert why.strip()
        assert (kr, us) not in seen, f"중복 {kr}-{us}"
        seen.add((kr, us))
        # 근거에 예측·매매 문구가 끼지 않게
        for bad in ("매수", "매도", "상승 예상", "하락 예상", "오를", "내릴"):
            assert bad not in why


def _write(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False), encoding="utf-8")


@pytest.fixture
def tiny_repo(tmp_path, monkeypatch):
    """두 시장 스냅샷 + 종목 일봉을 임시 폴더에 만들고 빌더 경로를 거기로 돌린다."""
    rng = random.Random(11)
    days = _calendar(300, "2025-06-02")
    spy = [rng.gauss(0, 0.01) for _ in days[1:]]
    k200 = [rng.gauss(0, 0.01) for _ in days[1:]]

    def chart(rets):
        return [[0, 0, 0, c, 0, d] for d, c in _closes(days, rets)]

    us_det = tmp_path / "data" / "details"
    kr_det = tmp_path / "data" / "korea" / "details"
    _write(us_det / "SPY.json", {"chartSeries": chart(spy)})
    _write(kr_det / "069500.json", {"chartSeries": chart(k200)})
    us_rows = [{"ticker": f"U{i}", "company": f"US {i}", "sector": "TECHNOLOGY", "marketCapB": 100 - i, "changePct": 0.1 * i, "priceDate": days[-1]} for i in range(5)]
    kr_rows = [{"ticker": f"{i:06d}", "company": f"국내 {i}", "sector": "기술", "marketCapT": 50 - i, "changePct": -0.1 * i, "priceDate": days[-1]} for i in range(1, 6)]
    for r in us_rows:
        _write(us_det / f"{r['ticker']}.json", {"chartSeries": chart([s + rng.gauss(0, 0.02) for s in spy])})
    for r in kr_rows:
        _write(kr_det / f"{r['ticker']}.json", {"chartSeries": chart([rng.gauss(0, 0.02) for _ in days[1:]])})
    us_rows.append({"ticker": "SPY", "company": "SPDR", "sector": "EXCHANGE TRADED FUNDS", "changePct": 0.3, "priceDate": days[-1]})
    kr_rows.append({"ticker": "069500", "company": "KODEX 200", "sector": "ETF", "changePct": 0.2, "priceDate": days[-1]})
    _write(tmp_path / "data" / "market_snapshot.json", {"priceDate": days[-1], "stocks": us_rows})
    _write(tmp_path / "data" / "korea" / "market_snapshot.json", {"stocks": kr_rows})
    monkeypatch.setattr(b, "US_SNAPSHOT", tmp_path / "data" / "market_snapshot.json")
    monkeypatch.setattr(b, "KR_SNAPSHOT", tmp_path / "data" / "korea" / "market_snapshot.json")
    monkeypatch.setattr(b, "US_DETAILS", us_det)
    monkeypatch.setattr(b, "KR_DETAILS", kr_det)
    monkeypatch.setattr(b, "MIN_UNIVERSE", 3)
    monkeypatch.setattr(b, "CURATED", (
        ("000001", "U0", "customer", "테스트 고객사"),
        ("000002", "U1", "peer", "테스트 업종"),
        ("000003", "NOPE", "peer", "스냅샷에 없는 티커"),
    ))
    return tmp_path


def test_build_payload_shape(tiny_repo):
    payload, code = b.build()
    assert code == 0 and payload is not None
    cur = [l for l in payload["links"] if l["source"] == "curated"]
    assert [(l["kr"], l["us"]) for l in cur] == [("000001", "U0"), ("000002", "U1")]
    assert payload["curatedCount"] == 2
    assert payload["count"] == len(payload["links"])
    # 무작위 잡음끼리라 자동 후보는 문턱(0.30)을 못 넘는다
    assert payload["autoCount"] == 0
    assert payload["tickers"]["us"]["U0"]["name"] == "US 0"
    assert payload["tickers"]["kr"]["000001"]["chg"] == -0.1
    for l in cur:
        assert l["strength"] in {"weak", "moderate", "strong"}
        assert l["n"] >= b.MIN_N
    assert payload["usAsOf"] and payload["window"]["to"]
    assert "예측" in payload["note"]


def test_build_refuses_collapsed_snapshot(tiny_repo, monkeypatch):
    monkeypatch.setattr(b, "MIN_UNIVERSE", 1000)
    payload, code = b.build()
    assert payload is None and code == 1


def test_build_refuses_when_details_missing(tiny_repo):
    for p in (tiny_repo / "data" / "details").glob("U*.json"):
        p.unlink()
    payload, code = b.build()
    assert payload is None and code == 1
