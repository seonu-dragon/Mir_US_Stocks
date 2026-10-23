"""기술적 신호 파생값(scripts/tech_signals_core.py) 테스트 — 합성 일봉만 쓴다(네트워크·파일 없음).

실행: py -m pytest -q scripts/tests/test_tech_signals_core.py
"""
from __future__ import annotations

import tech_signals_core as ts


def _dates(n):
    """날짜 문자열 n개(오름차순). 실제 거래일 달력이 아니라 순서만 맞으면 된다."""
    return [f"2026-{1 + i // 28:02d}-{1 + i % 28:02d}" for i in range(n)]


def _series(vals):
    return list(zip(_dates(len(vals)), vals))


# ---------------------------------------------------------------- RS 가중 성과
def test_weighted_rs_score_needs_a_full_year():
    assert ts.weighted_rs_score([100.0] * ts.RS_BARS) is None
    assert ts.weighted_rs_score([100.0] * (ts.RS_BARS + 1)) == 0.0


def test_weighted_rs_score_weights_recent_quarter_at_40pct():
    # 분기마다 정확히 +10% 씩 오른 계단. 각 분기 수익률이 0.1 이므로 가중합도 0.1 이다.
    vals = []
    price = 100.0
    for q in range(4):
        vals.extend([price] * ts.QUARTER)
        price *= 1.1
    vals.append(price)
    # 길이 맞추기: 252 + 1
    vals = vals[-(ts.RS_BARS + 1):]
    score = ts.weighted_rs_score(vals)
    assert score is not None
    assert abs(score - 0.1) < 1e-9


def test_weighted_rs_score_recent_quarter_dominates():
    """최근 분기만 +20%, 나머지 평평 → 0.4 × 0.2 = 0.08. 반대 배치는 0.2 × 0.2 = 0.04."""
    flat = [100.0] * (ts.RS_BARS + 1)
    recent = list(flat)
    for i in range(ts.RS_BARS + 1 - ts.QUARTER, ts.RS_BARS + 1):
        recent[i] = 120.0
    assert abs(ts.weighted_rs_score(recent) - 0.4 * 0.2) < 1e-9

    old = list(flat)
    # 가장 오래된 분기만 +20% (그 뒤는 그 수준을 유지) → 그 분기 수익률 0.2, 나머지 0
    for i in range(ts.RS_BARS + 1 - 3 * ts.QUARTER, ts.RS_BARS + 1):
        old[i] = 120.0
    assert abs(ts.weighted_rs_score(old) - 0.2 * 0.2) < 1e-9


def test_weighted_rs_score_rejects_nonpositive_close():
    vals = [100.0] * (ts.RS_BARS + 1)
    vals[0] = 0.0
    assert ts.weighted_rs_score(vals) is None


# ---------------------------------------------------------------- 백분위 등급
def test_percentile_ratings_span_1_to_99():
    out = ts.percentile_ratings([1.0, 2.0, 3.0, 4.0, 5.0])
    assert out[0] == 1 and out[-1] == 99
    assert out == sorted(out)


def test_percentile_ratings_keeps_missing_and_ties():
    out = ts.percentile_ratings([5.0, None, 5.0, 1.0, 9.0])
    assert out[1] is None
    assert out[0] == out[2]          # 동점은 같은 등급
    assert out[3] == 1 and out[4] == 99


def test_percentile_ratings_need_two_known_values():
    assert ts.percentile_ratings([3.0, None]) == [None, None]
    assert ts.percentile_ratings([]) == []


def test_percentile_ratings_all_equal_is_middle():
    out = ts.percentile_ratings([7.0] * 4)
    assert set(out) == {50}


# ---------------------------------------------------------------- RS선 신고가
def test_rs_line_new_high_needs_enough_overlap():
    closes = _series([100.0] * 100)
    r = ts.rs_line_flags(closes, {d: 10.0 for d, _ in closes})
    assert r["newHigh"] is None and r["bars"] == 100


def test_rs_line_new_high_when_stock_beats_benchmark():
    n = ts.RS_WINDOW + 1
    # 주가는 평평, 벤치마크는 마지막 날만 떨어진다 → RS선만 신고가(가격은 신고가 아님).
    closes = _series([100.0] * n)
    bench = {d: 10.0 for d, _ in closes}
    bench[closes[-1][0]] = 9.0
    r = ts.rs_line_flags(closes, bench)
    assert r["newHigh"] is True
    assert r["beforePrice"] is True


def test_rs_line_new_high_with_price_high_is_not_before_price():
    n = ts.RS_WINDOW + 1
    vals = [100.0] * (n - 1) + [120.0]
    closes = _series(vals)
    r = ts.rs_line_flags(closes, {d: 10.0 for d, _ in closes})
    assert r["newHigh"] is True
    assert r["beforePrice"] is False


def test_rs_line_skips_dates_without_benchmark_bar():
    n = ts.RS_WINDOW + 1
    closes = _series([100.0] * n)
    bench = {d: 10.0 for d, _ in closes[:-1]}      # 마지막 날 벤치마크 봉 없음
    r = ts.rs_line_flags(closes, bench)
    assert r["bars"] == n - 1
    assert r["newHigh"] is None                     # 창(252)+1 에 한 봉 모자라 판정 안 함


# ---------------------------------------------------------------- 지표
def test_sma_series_front_is_missing():
    out = ts.sma_series([1.0, 2.0, 3.0, 4.0], 3)
    assert out[:2] == [None, None]
    assert out[2] == 2.0 and out[3] == 3.0


def test_rsi_series_matches_wilder_extremes():
    up = [100.0 + i for i in range(40)]
    assert ts.rsi_series(up)[-1] == 100.0
    down = [100.0 - i for i in range(40)]
    assert ts.rsi_series(down)[-1] == 0.0
    flat = [100.0] * 40
    assert ts.rsi_series(flat)[-1] == 50.0
    assert ts.rsi_series([1.0, 2.0]) == [None, None]


def test_macd_series_sign_follows_trend():
    macd, sig = ts.macd_series([100.0 + i for i in range(80)])
    assert macd[-1] is not None and sig[-1] is not None
    assert macd[-1] > 0                     # 꾸준한 상승 → MACD 양수
    assert macd[:ts.MACD_SLOW - 1] == [None] * (ts.MACD_SLOW - 1)
    short_macd, short_sig = ts.macd_series([100.0] * 10)
    assert short_macd[-1] is None and short_sig[-1] is None


# ---------------------------------------------------------------- 교차·신고가
def test_bars_since_cross_up_today_is_zero():
    a = [1.0, 1.0, 3.0]
    b = [2.0, 2.0, 2.0]
    assert ts.bars_since_cross(a, b, up=True) == 0
    assert ts.bars_since_cross(a, b, up=False) is None


def test_bars_since_cross_counts_back():
    a = [1.0, 3.0, 3.0, 3.0]
    b = [2.0, 2.0, 2.0, 2.0]
    assert ts.bars_since_cross(a, b, up=True) == 2


def test_bars_since_cross_down():
    a = [3.0, 3.0, 1.0]
    b = [2.0, 2.0, 2.0]
    assert ts.bars_since_cross(a, b, up=False) == 0
    assert ts.bars_since_cross(a, b, up=True) is None


def test_bars_since_cross_ignores_missing_values():
    a = [None, None, 1.0, 3.0]
    b = [2.0, 2.0, 2.0, 2.0]
    assert ts.bars_since_cross(a, b, up=True) == 0
    assert ts.bars_since_cross([None, None], [1.0, 1.0], up=True) is None


def test_bars_since_cross_respects_lookback():
    a = [1.0, 3.0] + [3.0] * 20
    b = [2.0] * 22
    assert ts.bars_since_cross(a, b, up=True) is None     # 20봉 전 교차 — LOOKBACK(10) 밖
    assert ts.bars_since_cross(a, b, up=True, lookback=25) == 20


def test_bars_since_cross_requires_strict_break():
    # 닿기만 하고(같은 값) 넘지 않으면 교차가 아니다.
    assert ts.bars_since_cross([1.0, 2.0], [2.0, 2.0], up=True) is None


def test_bars_since_new_high():
    vals = [float(i) for i in range(30)]
    assert ts.bars_since_new_high(vals, 20) == 0
    flat = [10.0] * 30
    assert ts.bars_since_new_high(flat, 20) is None
    spike = [10.0] * 25 + [20.0] + [15.0] * 3
    assert ts.bars_since_new_high(spike, 20) == 3


def test_bars_since_new_high_needs_window_bars():
    assert ts.bars_since_new_high([1.0] * 10, 20) is None


# ---------------------------------------------------------------- 묶기
def test_derived_row_and_pack_shape():
    n = ts.RS_BARS + 60
    a = _series([100.0 + i for i in range(n)])
    b = _series([200.0 - i * 0.1 for i in range(n)])
    bench = {d: 50.0 for d, _ in a}
    da, db = ts.derived_row(a, bench), ts.derived_row(b, bench)
    packed = ts.pack([da["row"], db["row"]], [da["score"], db["score"]])
    assert len(packed) == 2
    assert all(len(arr) == len(ts.COLS) for arr in packed)
    # 꾸준히 오른 종목이 더 높은 등급
    assert packed[0][0] == 99 and packed[1][0] == 1
    row = dict(zip(ts.COLS, packed[0]))
    assert row["c1"] == 100.0 + n - 2
    assert row["s20"] > row["s20p"]
    assert row["nh20"] == 0
    assert row["rsnh"] == 1 and row["rsnhb"] == 0   # 벤치마크가 평평해 가격과 함께 신고가


def test_pack_marks_short_history_without_rating():
    short = _series([100.0] * 30)
    d = ts.derived_row(short, {})
    packed = ts.pack([d["row"]], [d["score"]])
    row = dict(zip(ts.COLS, packed[0]))
    assert row["rs"] is None          # 1년치가 없으면 등급 없음
    assert row["rsnh"] is None        # 벤치마크 없음 → RS선 판정 없음
    assert row["s20"] is not None     # 짧은 창 지표는 그대로 나온다
