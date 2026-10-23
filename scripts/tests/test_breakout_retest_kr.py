"""build_breakout_retest.py 의 KR 전용 정리(거래정지 봉·가격제한폭 밖 불연속·상하한가 잠김·ETF 배당).

실행: py -m pytest -q scripts/tests/test_breakout_retest_kr.py
"""
from __future__ import annotations

import math

import build_breakout_retest as B


def bar(c, v=1000, d=None, h=None, l=None):
    return {"o": c, "h": h if h is not None else c * 1.01, "l": l if l is not None else c * 0.99,
            "c": c, "v": v, "d": d}


def series(n, start=1000.0, step=0.003, v=1000):
    """완만한 사인파 + 추세 — 돌파가 생기는 결정적 시계열."""
    out = []
    for i in range(n):
        c = start * (1 + step * i / 10) * (1 + 0.08 * math.sin(i / 9.0))
        out.append(bar(round(c, 2), v=v, d=f"2022-{1 + i // 28 % 12:02d}-{1 + i % 28:02d}"))
    return out


def test_zero_volume_bars_are_dropped_without_split_when_short():
    rows = [bar(100), bar(101), bar(101, v=0), bar(101, v=0), bar(102), bar(103)]
    stats = {}
    segs = B.kr_segments(rows, stats)
    assert len(segs) == 1
    assert [r["c"] for r in segs[0]] == [100, 101, 102, 103]
    assert all(r["v"] for r in segs[0])
    assert stats["halt_bars"] == 2
    assert stats.get("halt_breaks", 0) == 0


def test_long_halt_splits_series():
    rows = [bar(100), bar(101)] + [bar(101, v=0)] * B.KR_HALT_BREAK + [bar(90), bar(91)]
    stats = {}
    segs = B.kr_segments(rows, stats)
    assert [[r["c"] for r in s] for s in segs] == [[100, 101], [90, 91]]
    assert stats["halt_breaks"] == 1


def test_gap_beyond_price_limit_splits_series():
    # 251 → 3480: 감자·병합 기준가 재설정(가격제한폭 ±30% 밖) — 수정주가가 소급하지 않은 불연속.
    rows = [bar(250), bar(251), bar(3480), bar(3500)]
    stats = {}
    segs = B.kr_segments(rows, stats)
    assert [[r["c"] for r in s] for s in segs] == [[250, 251], [3480, 3500]]
    assert stats["gap_breaks"] == 1
    # 가격제한폭 안(+29.9%)은 끊지 않는다.
    assert len(B.kr_segments([bar(100), bar(129.9)])) == 1


def test_halt_bar_with_bogus_price_does_not_create_gap():
    # 017040 실례: 거래량 0 봉에 엉뚱한 가격(932 → 4660)이 찍혔다가 돌아옴 — 빼면 연속이다.
    rows = [bar(932), bar(4660, v=0), bar(935)]
    segs = B.kr_segments(rows)
    assert [[r["c"] for r in s] for s in segs] == [[932, 935]]


def test_limit_locked_entry():
    rows = [bar(100), bar(130), bar(131), bar(92)]
    assert B.limit_locked(rows, 1)          # +30% 상한가
    assert not B.limit_locked(rows, 2)      # +0.8%
    assert B.limit_locked(rows, 3)          # -29.8% 하한가
    assert not B.limit_locked(rows, 0)


def _detail(rows, **kw):
    d = {
        "ticker": "000001", "company": "테스트", "historySource": "yahoo", "barsSource": "naver",
        "chartSeries": [[r["o"], r["h"], r["l"], r["c"], r["v"], r["d"]] for r in rows],
    }
    d.update(kw)
    return d


def test_non_naver_bars_skipped_for_kr_only():
    rows = series(400)
    acc = B.new_accumulator()
    assert not B.scan_detail(_detail(rows, barsSource="yahoo"), "kr", acc)
    assert acc["kr"]["non_naver_skipped"] == 1
    acc_us = B.new_accumulator()
    assert B.scan_detail(_detail(rows, barsSource="yahoo"), "us", acc_us)


def test_halt_bars_never_reach_measurement():
    rows = series(400)
    halted = rows[:200] + [dict(rows[199], v=0) for _ in range(3)] + rows[200:]
    acc_clean = B.new_accumulator()
    B.scan_detail(_detail(rows), "kr", acc_clean)
    acc_halt = B.new_accumulator()
    B.scan_detail(_detail(halted), "kr", acc_halt)
    assert acc_halt["kr"]["halt_bars"] == 3
    # 짧은 정지 봉은 빠지므로 측정 결과가 정지 없는 시계열과 같다.
    assert acc_halt["base"] == acc_clean["base"]
    assert acc_halt["rets"] == acc_clean["rets"]


def test_segment_shorter_than_min_bars_is_ignored():
    rows = series(B.MIN_BARS + 150)
    # 앞쪽 100봉 뒤 장기 정지 → 앞 구간(100봉)은 MIN_BARS 미달이라 버리고 뒤 구간만 쓴다.
    halted = rows[:100] + [dict(rows[99], v=0) for _ in range(30)] + rows[100:]
    acc = B.new_accumulator()
    assert B.scan_detail(_detail(halted), "kr", acc)
    assert acc["scanned"] == 1
    acc2 = B.new_accumulator()
    assert not B.scan_detail(_detail(rows[:100] + [dict(rows[99], v=0) for _ in range(30)] + rows[100:300]),
                             "kr", acc2)


def test_etf_dividends_not_added():
    rows = series(400)
    divs = [[rows[150]["d"], 50.0], [rows[250]["d"], 50.0]]
    acc_stock = B.new_accumulator()
    B.scan_detail(_detail(rows, dividends=divs), "kr", acc_stock)
    acc_etf = B.new_accumulator()
    B.scan_detail(_detail(rows, dividends=divs, ticker="069500"), "kr", acc_etf, {"069500"})
    acc_plain = B.new_accumulator()
    B.scan_detail(_detail(rows), "kr", acc_plain)
    assert acc_etf["kr"]["etf_no_dividend"] == 1
    assert acc_etf["base"] == acc_plain["base"]          # ETF: 분배금은 이미 가격에 반영
    assert acc_stock["base"] != acc_plain["base"]        # 주식: 배당 포함 총수익


def test_output_has_sample_counts_and_no_nan():
    acc = B.new_accumulator()
    for k in range(5):
        B.scan_detail(_detail(series(600, start=1000 + 37 * k, step=0.002 * (k - 2))), "kr", acc)
    out = B.build_output(acc, "kr")
    assert out["market"] == "kr" and out["tickers_scanned"] == 5
    assert "kr_cleaning" in out
    for dd in out["directions"].values():
        for per_h in dd["entries"].values():
            for s in per_h.values():
                assert s["n"] > 0
                assert 0 <= s["cont_rate"] <= 100
                assert not math.isnan(s["avg_dir_ret"])


def test_empty_accumulator_output_has_no_division_error():
    out = B.build_output(B.new_accumulator(), "kr")
    assert out["tickers_scanned"] == 0
    assert out["directions"]["up_break"]["retest_rate"] == 0
    assert out["baseline"] == {}


def test_detect_breakouts_matches_detect_confirmations():
    import pattern_lib as pl
    rows = series(700)
    full = [e for e in pl.detect_confirmations(rows) if e["pattern"] in B.BREAKOUT_PATTERNS]
    fast = B.detect_breakouts(rows)
    assert [(e["pattern"], e["confirm_idx"], e["neckline"]) for e in full] == \
        [(e["pattern"], e["confirm_idx"], e["neckline"]) for e in fast]
    assert fast  # 시계열이 실제로 돌파를 만든다(빈 비교 방지)
