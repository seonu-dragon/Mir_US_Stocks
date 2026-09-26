"""KR PER·PBR 밴드 빌더(build_kr_valuation_band.py)의 순수 로직 — 네트워크 없음.

실행: py -m pytest -q scripts/tests/test_kr_valuation_band.py
"""
from __future__ import annotations

import datetime
import random

from conftest import import_builder

vb = import_builder("build_kr_valuation_band")


def test_shard_of_matches_js_vectors():
    # valuation-band-core.js 의 shardOf 와 같은 값(scripts/tests/test_valuation_band_core.mjs).
    assert vb.shard_of("005930") == 29
    assert vb.shard_of("000660") == 28
    assert all(0 <= vb.shard_of(c) < vb.SHARDS for c in ("0001A0", "373220", "900140"))


def test_month_helpers():
    assert vb.add_months("2025-12", 1) == "2026-01"
    assert vb.add_months("2026-01", -13) == "2024-12"
    assert vb.month_range("2025-11", "2026-02") == ["2025-11", "2025-12", "2026-01", "2026-02"]
    assert vb.last_completed_month(datetime.date(2026, 9, 26)) == "2026-08"
    assert vb.last_completed_month(datetime.date(2026, 1, 2)) == "2025-12"
    # 2026-05-31 은 일요일 → 첫 후보는 5/29(금)
    assert vb.month_end_candidates("2026-05")[0] == "20260529"
    assert all(datetime.datetime.strptime(d, "%Y%m%d").weekday() < 5 for d in vb.month_end_candidates("2026-05"))


def test_is_split_detects_split_not_rights_issue():
    # 삼성전자 2018-05 50:1 분할: 주식수 ×50, 주가 2,650,000 → 50,700
    assert vb.is_split(128386494, 6419324700, 2650000, 50700) == 6419324700 / 128386494
    # 유상증자: 주식수 ×1.6, 주가 그대로 → 분할 아님
    assert vb.is_split(1000, 1600, 10000, 9800) is None
    # 병합 10:1: 주식수 ÷10, 주가 ×10
    assert vb.is_split(1000, 100, 500, 5100) == 0.1
    # 작은 변화·결측
    assert vb.is_split(1000, 1100, 100, 90) is None
    assert vb.is_split(None, 1000, 100, 50) is None


def _got(rows):
    return {"date": "x", "rows": rows}


def test_append_month_adjusts_split_and_marks_loss():
    series, months = {}, []
    vb.append_month(series, months, "2018-04", _got({"005930": (2650000, 128386494, 16.8, 2.3, 157967)}))
    vb.append_month(series, months, "2018-05", _got({"005930": (50700, 6419324700, 8.45, 1.8, 5997)}))
    s = series["005930"]
    assert round(s["c"][0]) == 53000        # 2,650,000 / 50
    assert s["c"][1] == 50700
    # 적자(EPS<0) 는 -1, 자료 없음은 None
    vb.append_month(series, months, "2018-06", _got({"005930": (48000, 6419324700, None, 1.7, -10)}))
    assert s["p"][2] == -1
    vb.append_month(series, months, "2018-07", _got({"005930": (48000, 6419324700, None, None, 0)}))
    assert s["p"][3] is None and s["b"][3] is None


def test_append_month_drops_delisted_and_pads_new():
    series, months = {}, []
    vb.append_month(series, months, "2020-01", _got({"A": (100, 10, 5, 1, 20), "B": (100, 10, 5, 1, 20)}))
    vb.append_month(series, months, "2020-02", _got({"A": (110, 10, 5, 1, 22), "C": (50, 10, 5, 1, 10)}))
    assert set(series) == {"A", "C"}
    assert series["C"]["c"] == [None, 50]
    assert all(len(s["c"]) == len(months) for s in series.values())


def test_trim_keeps_last_months():
    series, months = {}, []
    for i, m in enumerate(vb.month_range("2020-01", "2020-06")):
        vb.append_month(series, months, m, _got({"A": (100 + i, 10, 5, 1, 20)}))
    vb.trim(series, months, max_months=4)
    assert months == ["2020-03", "2020-04", "2020-05", "2020-06"]
    assert series["A"]["c"] == [102, 103, 104, 105]


def test_shard_payloads_roundtrip_shape():
    series, months = {}, []
    vb.append_month(series, months, "2020-01", _got({"005930": (50700.4, 10, 8.456, 1.234, 5)}))
    shards = vb.shard_payloads(months, series)
    assert len(shards) == vb.SHARDS
    t = shards[vb.shard_of("005930")]["t"]["005930"]
    assert t == {"c": [50700], "p": [8.46], "b": [1.23], "sh": 10}
    assert shards[0]["m0"] == "2020-01" and shards[0]["n"] == 1


def test_own_percentile():
    assert vb.own_percentile([1, 2, 3, 4], 2.5) == 0.5
    assert vb.own_percentile([1, 2, 2, 3], 2) == 0.5


def _synthetic(edge: float, T=72, N=120, seed=1):
    """edge>0 이면 '자기 PBR 이 낮은 달' 다음 해 수익이 높게 만든 합성 패널."""
    rng = random.Random(seed)
    months = vb.month_range("2015-01", vb.add_months("2015-01", T - 1))
    series = {}
    for k in range(N):
        b = [max(0.2, 1 + 0.4 * rng.gauss(0, 1)) for _ in range(T)]
        c = [100.0]
        for t in range(1, T):
            # t-12 시점 PBR 이 자기 평균보다 낮으면 그 뒤 월수익률에 edge 가산
            boost = edge if t >= 12 and b[t - 12] < 0.7 else 0.0
            c.append(c[-1] * (1 + rng.gauss(0.005, 0.02) + boost))
        series[str(k)] = {"c": c, "b": b}
    return months, series


def test_validate_low_pbr_finds_planted_edge_and_no_edge():
    months, series = _synthetic(edge=0.08)
    out = vb.validate_low_pbr(months, series, horizons=(12,), n_boot=300)
    h = out["horizons"]["12m"]
    assert h["verdict"] == "우위" and h["meanExcessPct"] > 0 and h["signalObs"] > 0
    months, series = _synthetic(edge=0.0, seed=2)
    h0 = vb.validate_low_pbr(months, series, horizons=(12,), n_boot=300)["horizons"]["12m"]
    assert h0["ciLowPct"] <= 0 <= h0["ciHighPct"] or h0["verdict"] != "우위"


def test_validate_low_pbr_insufficient():
    months, series = _synthetic(edge=0.0, T=40, N=20)
    out = vb.validate_low_pbr(months, series, horizons=(12,), n_boot=50)
    assert out["horizons"]["12m"].get("insufficient") is True
