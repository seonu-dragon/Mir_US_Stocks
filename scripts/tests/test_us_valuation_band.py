"""US PER·PBR·PSR 밴드 빌더(build_us_valuation_band.py)의 순수 로직 — 네트워크·파일 없음.

실행: py -m pytest -q scripts/tests/test_us_valuation_band.py
"""
from __future__ import annotations

import datetime

from conftest import import_builder

vb = import_builder("build_us_valuation_band")
D = datetime.date


def test_shard_of_matches_js_vectors():
    # valuation-band-core.js 의 shardOf 와 같은 값(scripts/tests/test_valuation_band_core.mjs).
    assert vb.shard_of("AAPL") == 22
    assert vb.shard_of("BRK.B") == 18
    assert vb.shard_of("005930") == 29  # 국내 빌더와 같은 해시


def test_nearest_split_ratio():
    assert vb.nearest_split_ratio(9.97) == 10
    assert vb.nearest_split_ratio(3.74) == 4
    assert vb.nearest_split_ratio(0.1) == 0.1        # 10:1 병합
    assert vb.nearest_split_ratio(1.7) is None        # 1.5·2 어느 쪽에도 12% 안이 아님
    assert vb.nearest_split_ratio(0) is None


def test_month_end_closes_and_gap_guard():
    bars = [[0, 0, 0, 10.0, 0, "2024-01-30"], [0, 0, 0, 11.0, 0, "2024-01-31"], [0, 0, 0, 12.0, 0, "2024-02-29"]]
    closes, why = vb.month_end_closes(bars)
    assert why is None and closes["2024-01"] == (D(2024, 1, 31), 11.0) and closes["2024-02"][1] == 12.0
    # 하루 새 10배 → 분할 미조정 의심
    bars.append([0, 0, 0, 120.0, 0, "2024-03-01"])
    assert vb.month_end_closes(bars) == ({}, "price")


def _obs(end, v, kind="out"):
    return {"end": D.fromisoformat(end), "filed": D.fromisoformat(end) + datetime.timedelta(days=30), "v": v, "kind": kind}


def test_normalize_detects_split_with_flat_equity():
    # NVDA 2024 10:1: 분할 전 분기 2.46B, 분할 뒤 24.5B. 자본은 49B → 58B(+18%) — 분할로 본다.
    obs = [_obs("2024-07-28", 24.53e9), _obs("2024-04-28", 2.46e9)]
    eq = [(D(2024, 7, 28), D(2024, 8, 28), 58e9), (D(2024, 4, 28), D(2024, 5, 29), 49e9)]
    norm, splits, why = vb.normalize_shares(obs, eq, anchor=24.3e9)
    assert why is None
    by_end = {o["end"]: o["n"] for o in norm}
    assert abs(by_end[D(2024, 4, 28)] - 24.6e9) < 1e6
    assert splits and splits[0][1] == 10


def test_normalize_rejects_merger_as_split():
    # 합병으로 주식수 ×1.65, 자본 ×6 → 분할 아님(원값 유지)
    obs = [_obs("2026-04-04", 98.2e6), _obs("2025-12-31", 59.5e6)]
    eq = [(D(2026, 4, 4), D(2026, 5, 1), 15.3e9), (D(2025, 12, 31), D(2026, 2, 1), 2.56e9)]
    norm, splits, why = vb.normalize_shares(obs, eq, anchor=98e6)
    assert why is None and not splits
    assert {o["end"]: o["n"] for o in norm}[D(2025, 12, 31)] == 59.5e6


def test_normalize_mixed_basis_same_date_and_bad_units():
    # AAPL FY2018: 기말 주식수는 분할 전(4.75B), 희석 평균은 재표시(20.0B). 둘 다 현재 기준으로.
    obs = [_obs("2019-09-28", 17.77e9), _obs("2018-09-29", 4.75e9, "out"), _obs("2018-09-29", 20.0e9, "dil"),
           _obs("2017-09-30", 5.13e9), _obs("2017-06-30", 5.2e12, "dil")]  # 마지막은 단위 오류 → 버림
    eq = [(D(2019, 9, 28), D(2019, 10, 31), 90e9), (D(2018, 9, 29), D(2018, 11, 5), 107e9), (D(2017, 9, 30), D(2017, 11, 3), 134e9)]
    norm, _splits, why = vb.normalize_shares(obs, eq, anchor=17.5e9)
    assert why is None
    got = {(o["end"], o["kind"]): o["n"] for o in norm}
    assert abs(got[(D(2018, 9, 29), "out")] - 19.0e9) < 1e6
    assert got[(D(2018, 9, 29), "dil")] == 20.0e9
    assert abs(got[(D(2017, 9, 30), "out")] - 20.52e9) < 1e6
    assert (D(2017, 6, 30), "dil") not in got


def test_normalize_anchor_mismatch_excludes():
    # 복수 종류주: 현재 시총 기준 1.8B vs 공시 1.5M → 분할 비율로도 설명 안 됨
    norm, splits, why = vb.normalize_shares([_obs("2026-06-30", 1.5e6)], [], anchor=1.8e9)
    assert why == "shares" and norm == []


def _q(end, filed, net, rev, eq, so, dil):
    return {"end": end, "filed": filed, "net": net, "rev": rev, "equity": eq, "sharesOut": so, "sharesDilAvg": dil}


def _fin(quarters, annual=(), industry="general"):
    return {"industryType": industry, "quarterly": list(quarters), "annual": list(annual), "flags": [], "currency": "USD"}


def test_monthly_multiples_point_in_time_and_loss():
    q = [
        _q("2025-03-31", "2025-05-01", 10, 100, 500, 100, 100),
        _q("2025-06-30", "2025-08-01", 10, 100, 500, 100, 100),
        _q("2025-09-30", "2025-11-01", 10, 100, 500, 100, 100),
        _q("2025-12-31", "2026-02-10", 10, 100, 500, 100, None),
        _q("2026-03-31", "2026-05-01", -60, 100, 400, 100, 100),
    ]
    closes = {"2026-01": (D(2026, 1, 30), 4.0), "2026-02": (D(2026, 2, 27), 4.0), "2026-05": (D(2026, 5, 29), 5.0)}
    res, info = vb.monthly_multiples(_fin(q), closes, ["2026-01", "2026-02", "2026-05"], anchor=100)
    # 2026-01: 4분기 창(2025Q1~Q4)의 마지막 분기가 아직 공시 전(2/10) → TTM 없음 → PER 결측
    assert res["p"][0] is None
    # 2026-02: TTM 순이익 40, 희석 100 → EPS 0.4 → PER 10
    assert res["p"][1] == 10.0
    # PBR = 4 × 100 / 500 = 0.8, PSR = 4 × 100 / 400 = 1.0
    assert res["b"][1] == 0.8 and res["s"][1] == 1.0
    # 2026-05: 최근 4분기 합 10+10+10−60 < 0 → 적자 -1
    assert res["p"][2] == -1


def test_monthly_multiples_stale_annual_not_used_and_financial_no_psr():
    annual = [{"end": "2024-12-31", "filed": "2025-02-15", "net": 50, "rev": 300, "equity": 600,
               "sharesOut": 100, "sharesDilAvg": 100}]
    closes = {"2025-03": (D(2025, 3, 31), 6.0), "2025-09": (D(2025, 9, 30), 6.0)}
    res, _ = vb.monthly_multiples(_fin([], annual, industry="bank"), closes, ["2025-03", "2025-09"], anchor=100)
    # 3월: 연간이 가장 최근 기간 → PER 12
    assert res["p"][0] == 12.0
    # 9월: 기말 + 273일 — 그 사이 분기를 우리가 못 가졌으니 PER 은 비운다(부풀린 과거 PER 방지)
    assert res["p"][1] is None
    # PBR 은 자본총계 400일까지 허용, PSR 은 금융업이라 없음
    assert res["b"][1] == 1.0 and res["s"] == [None, None]


def test_exclusion_reason():
    assert vb.exclusion_reason({"flags": ["foreignFiler", "adrShareBasis"], "currency": "EUR"}) == "foreign"
    assert vb.exclusion_reason({"flags": [], "currency": "CAD"}) == "currency"
    assert vb.exclusion_reason({"flags": ["financial"], "currency": "USD"}) is None


def test_validation_marks_insufficient_on_short_sample():
    months = [f"2024-{m:02d}" for m in range(1, 13)]
    series = {"A": {"c": [10.0] * 12, "b": [1.0] * 12}}
    out = vb.validate_low_pbr(months, series, [100.0] * 12)
    assert out["horizons"]["12m"]["insufficient"] and out["bench"] == "SPY"
