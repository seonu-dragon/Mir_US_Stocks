"""통계 빌더 공용 불연속 분할(pattern_lib.split_at_discontinuities)과 그 적용.

PPCB 실례: 수정되지 않은 역분할·호가 오류로 종가가 0.01 → 625 로 한 봉 만에 뛰었고, 이 봉을
가로지르는 전방수익률 몇 개가 US 패턴 통계 평균(doji 60일 +168.5%)을 통째로 끌고 갔다.

실행: py -m pytest -q scripts/tests/test_stat_discontinuities.py
"""
from __future__ import annotations

import math

import build_breakout_retest as B
import build_pattern_stats as P
import pattern_lib as pl


def bar(c, v=1000, d=None):
    return {"o": c, "h": c * 1.01, "l": c * 0.99, "c": c, "v": v, "d": d}


def series(n, start=10.0, step=0.003):
    out = []
    for i in range(n):
        c = start * (1 + step * i / 10) * (1 + 0.08 * math.sin(i / 9.0))
        out.append(bar(round(c, 4), d=f"20{20 + i // 336:02d}-{1 + i // 28 % 12:02d}-{1 + i % 28:02d}"))
    return out


def _detail(rows, **kw):
    d = {"ticker": "TEST", "company": "Test", "historySource": "yahoo-cache",
         "chartSeries": [[r["o"], r["h"], r["l"], r["c"], r["v"], r["d"]] for r in rows]}
    d.update(kw)
    return d


def ppcb_like(n_before=400, n_after=400):
    """정상 구간 → 0.01 → 625 폭등(역분할 미수정) → 250 ↔ 69 오가는 잡음 → 다시 정상 구간."""
    before = series(n_before, start=0.02, step=0.0)
    glitch = [bar(0.01), bar(625.0), bar(225.0), bar(250.0), bar(60.0), bar(222.25)]
    after = series(n_after, start=200.0, step=0.0)
    return before, glitch, after


def test_ppcb_like_series_is_split_at_every_jump():
    before, glitch, after = ppcb_like()
    rows = before + glitch + after
    stats = {}
    segs = pl.split_at_discontinuities(rows, stats=stats)
    # 0.01→625(×62,500), 250→60(×0.24), 60→222.25(×3.7, 4배 안이라 유지)
    assert stats["breaks"] == 2
    assert sum(len(s) for s in segs) == len(rows)          # 봉은 버리지 않는다
    for s in segs:
        for a, b in zip(s, s[1:]):
            assert 0.25 <= b["c"] / a["c"] <= 4.0
    assert [len(s) for s in segs] == [len(before) + 1, 3, 2 + len(after)]


def test_normal_series_with_real_big_moves_is_unchanged():
    rows = series(300)
    # 실제 바이오 급등(+150%)·폭락(-70%)은 끊지 않는다.
    rows[150] = dict(rows[150], c=rows[149]["c"] * 2.5)
    rows[151] = dict(rows[151], c=rows[150]["c"] * 0.3)
    stats = {}
    segs = pl.split_at_discontinuities(rows, stats=stats)
    assert len(segs) == 1 and segs[0] is rows
    assert stats.get("breaks", 0) == 0
    assert pl.split_at_discontinuities([]) == []


def test_threshold_is_exclusive_and_symmetric():
    assert len(pl.split_at_discontinuities([bar(1.0), bar(4.0), bar(1.0)])) == 1
    assert len(pl.split_at_discontinuities([bar(1.0), bar(4.01)])) == 2
    assert len(pl.split_at_discontinuities([bar(4.01), bar(1.0)])) == 2


def test_pattern_stats_segments_drop_short_pieces():
    before, glitch, after = ppcb_like(n_before=P.MIN_BARS + 50, n_after=100)
    stats = {}
    segs = P.measurable_segments(before + glitch + after, stats)
    assert len(segs) == 1 and len(segs[0]) == P.MIN_BARS + 51
    assert stats["breaks"] == 2
    # 불연속 없는 시계열은 그대로
    rows = series(P.MIN_BARS + 10)
    assert P.measurable_segments(rows, {}) == [rows]


def test_breakout_us_baseline_ignores_windows_across_break():
    before, glitch, after = ppcb_like()
    acc = B.new_accumulator()
    assert B.scan_detail(_detail(before + glitch + after), "us", acc)
    assert acc["us"]["breaks"] == 2
    # 정상 구간 진폭이 ±8% 라 어떤 전방 창도 2배를 넘지 않는다 — 0.01→625 를 가로지르면 62,499.
    for h, rets in acc["base"].items():
        assert rets, h
        assert max(abs(r) for r in rets) < 1.0, h
    # 두 정상 구간을 따로 스캔한 결과와 같다(끊긴 자리를 가로지르는 창이 없다).
    acc_sep = B.new_accumulator()
    B.scan_detail(_detail(before + glitch[:1]), "us", acc_sep)
    B.scan_detail(_detail(glitch[-2:] + after), "us", acc_sep)
    assert acc["base"] == acc_sep["base"]
    assert acc["rets"] == acc_sep["rets"]
    out = B.build_output(acc, "us")
    assert out["discontinuity_cleaning"]["max_bar_ratio"] == pl.MAX_BAR_RATIO
    assert out["discontinuity_cleaning"]["breaks"] == 2
