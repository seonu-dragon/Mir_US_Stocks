"""industry_sensitivity — 8.1 하네스 (오프라인·결정적). 합성 데이터로 규칙이 문서대로 작동하는지 고정한다."""
from __future__ import annotations

import random
from datetime import date, timedelta

import industry_sensitivity as IS


def test_pearson_and_pvalue_sanity():
    assert IS.pearson([1, 2, 3, 4], [2, 4, 6, 8]) == 1.0
    assert IS.pearson([1, 1, 1], [1, 2, 3]) is None
    # n_eff=38 에서 p<0.05/6 을 넘으려면 |ρ|≳0.42 (기획서 수치) — 0.3 은 통과 못 하고 0.45 는 통과
    assert IS.corr_pvalue(0.3, 38) > 0.05 / 6
    assert IS.corr_pvalue(0.45, 38) < 0.05 / 6
    assert abs(IS.t_pvalue_two_sided(1.96, 1e6) - 0.05) < 0.002


def test_effective_n_shrinks_with_autocorrelation():
    assert IS.effective_n(100, 0.0, 0.0) == 100
    assert IS.effective_n(100, 0.9, 0.9) < 15


def test_benjamini_hochberg():
    assert IS.benjamini_hochberg([0.001, 0.02, 0.5, 0.9], 0.10) == [True, True, False, False]
    assert IS.benjamini_hochberg([]) == []


def _weekly_keys(n, start=date(2019, 1, 4)):
    return [IS._period_key(start + timedelta(weeks=i), "W") for i in range(n)]


def test_changes_require_consecutive_periods():
    s = [("2026-01", 100.0), ("2026-02", 110.0), ("2026-04", 121.0)]
    out = IS.changes(s, "pct")
    assert len(out) == 1 and out[0][0] == "2026-02" and abs(out[0][1] - 10.0) < 1e-9
    assert IS.changes([("2026-01", 1.0), ("2026-02", 3.0)], "diff") == [("2026-02", 2.0)]


def test_insufficient_sample_returns_no_numbers():
    keys = _weekly_keys(100)
    x = [(k, float(i % 3)) for i, k in enumerate(keys)]
    y = [(k, float(i % 5)) for i, k in enumerate(keys)]
    res = IS.evaluate_pair(x, y, "W")
    assert res["status"] == "insufficient" and "oos_rho" not in res


def test_synthetic_lead_of_two_weeks_is_found_and_validated():
    rng = random.Random(7)
    keys = _weekly_keys(420)
    xs = [rng.gauss(0, 1) for _ in keys]
    # y_t = 0.8·x_{t-2} + 잡음 → lag 2 에서 강한 상관
    ys = [0.8 * xs[i - 2] + rng.gauss(0, 0.6) if i >= 2 else rng.gauss(0, 1) for i in range(len(keys))]
    res = IS.evaluate_pair(list(zip(keys, xs)), list(zip(keys, ys)), "W", boot=True)
    assert res["lag"] == 2 and res["status"] == "candidate", res
    assert res["oos_rho"] > 0.5 and res["ci95"][0] > 0


def test_fixed_lag_is_not_re_searched():
    rng = random.Random(3)
    keys = _weekly_keys(420)
    xs = [rng.gauss(0, 1) for _ in keys]
    ys = [0.8 * xs[i - 2] + rng.gauss(0, 0.6) if i >= 2 else 0.0 for i in range(len(keys))]
    res = IS.evaluate_pair(list(zip(keys, xs)), list(zip(keys, ys)), "W", fixed_lag=5, boot=False)
    assert res["lag"] == 5 and res["status"] == "rejected"


def test_noise_pair_is_rejected():
    rng = random.Random(11)
    keys = _weekly_keys(420)
    x = [(k, rng.gauss(0, 1)) for k in keys]
    y = [(k, rng.gauss(0, 1)) for k in keys]
    res = IS.evaluate_pair(x, y, "W", boot=False)
    assert res["status"] in ("rejected", "insufficient")


def test_attach_only_validated_pairs():
    inds = {"a": {"related_tickers": [{"ticker": "X", "market": "us"}, {"ticker": "Y", "market": "us"}]}}
    sens = {"pairs": {"a|X": {"status": "validated", "freq": "W", "lag": 2, "oos_rho": 0.5, "oos_n": 150, "n_eff": 120.0, "ci95": [0.2, 0.7],
                              "transform": "wow_pct", "excess_vs": "XLK"},
                      "a|Y": {"status": "rejected"}}}
    assert IS.attach_to_indicators(inds, sens) == 1
    assert inds["a"]["related_tickers"][0]["sensitivity"]["lag_weeks"] == 2
    assert "sensitivity" not in inds["a"]["related_tickers"][1]
    assert inds["a"]["sensitivity_validated"] == 1
