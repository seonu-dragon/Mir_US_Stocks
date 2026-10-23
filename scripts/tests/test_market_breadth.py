"""시장 폭 추이(build_market_breadth.py) 테스트 — 합성 일봉으로 이평·52주·집계·맥클렐런을 확인한다(네트워크 없음)."""
from datetime import date, timedelta

import build_market_breadth as B


def _closes(values, start=date(2025, 1, 1)):
    return [((start + timedelta(days=i)).isoformat(), float(v)) for i, v in enumerate(values)]


def test_stock_flags_moving_averages_and_52w():
    rising = _closes(range(1, 301))            # 매일 오르는 종목
    f = B.stock_flags(rising)
    last = f[rising[-1][0]]
    assert last[0] is True and last[1] is True and last[2] == 1 and last[3] is True and last[4] is False
    assert f[rising[48][0]][0] is None          # 49봉째까지는 50일선 없음
    assert f[rising[198][0]][1] is None
    assert f[rising[0][0]][2] is None           # 첫 봉은 전일 대비 없음
    flat = B.stock_flags(_closes([10] * 300))
    assert flat[_closes([10] * 300)[-1][0]] == (False, False, 0, False, False)


def test_closes_of_skips_bad_bars_and_sorts():
    detail = {"chartSeries": [[1, 1, 1, 5, 0, "2026-10-02"], [1, 1, 1, 0, 0, "2026-10-03"], [1, 1, 1, 4, 0, "2026-10-01"], "x", [1, 2]]}
    assert B.closes_of(detail) == [("2026-10-01", 4.0), ("2026-10-02", 5.0)]


def test_aggregate_counts_coverage_and_adline():
    up = _closes(range(1, 101))
    down = _closes(range(200, 100, -1))
    partial = _closes(range(1, 101))[-5:]       # 마지막 5일만 있는 종목 — 분모·커버리지에만 영향
    rows = B.aggregate([B.stock_flags(up), B.stock_flags(down), B.stock_flags(partial)])
    last = rows[-1]
    assert last["n"] == 3 and last["adv"] == 2 and last["dec"] == 1
    assert last["above50"] == 50.0               # up 위, down 아래(partial 은 이평 없음)
    assert rows[1]["adLine"] - rows[0]["adLine"] == rows[1]["adv"] - rows[1]["dec"]
    assert rows[38]["mcclellan"] is None and rows[39]["mcclellan"] is not None


def test_aggregate_drops_low_coverage_days():
    a = _closes(range(1, 80))
    b = _closes(range(1, 80))
    c = _closes(range(1, 80))
    holiday_like = _closes(range(1, 81))[-1:]   # 79번째 날짜에 한 종목만 봉이 있다
    b = b[:-1]
    c = c[:-1]
    rows = B.aggregate([B.stock_flags(x) for x in (a, b, c)])
    assert rows[-1]["d"] == a[-2][0]             # 한 종목만 있는 마지막 날(33%)은 버린다
    assert holiday_like


def test_common_stock_filter():
    assert B.is_common_stock("us", {"bucket": "gte10b"}) and not B.is_common_stock("us", {"bucket": "all_misc"})
    assert B.is_common_stock("kr", {"market": "kospi"}) and not B.is_common_stock("kr", {"market": "etf"})


# ── 포인트앤피겨 · BPI ────────────────────────────────────────────────────────────


def test_pnf_position_us_traditional_scale_and_kr_percent():
    assert B.pnf_position(20.0, "us") == 4 + 6 + 16 + 30          # 0.25·1·5·20 구간을 다 채운 박스 수
    assert B.pnf_position(21.0, "us") == 57                        # 20~100$ 구간은 1$ 박스
    assert B.pnf_position(102.0, "us") == 4 + 6 + 16 + 30 + 80 + 1  # 100~200$ 는 2$ 박스
    assert abs(B.pnf_position(102.0, "kr") - B.pnf_position(100.0, "kr") - 1) < 1e-9  # 2% 박스


def test_pnf_double_top_buy_and_double_bottom_sell():
    # 20~100$ 구간(1$ 박스). 30 → 35(X) → 31(3박스 반전 O) → 36(직전 X 꼭대기 35 돌파 = 매수)
    path = [30, 33, 35, 32, 31, 34, 35, 36]
    sig = B.pnf_signals(_closes(path), "us")
    vals = list(sig.values())
    assert vals[:7] == [None] * 7 and vals[7] == 1
    # 이어서 36 → 30(반전, 직전 O 바닥 31 붕괴 = 매도)
    sig2 = list(B.pnf_signals(_closes(path + [33, 30]), "us").values())
    assert sig2[-2] == 1 and sig2[-1] == -1


def test_pnf_reversal_needs_three_boxes():
    # 35 꼭대기에서 33(2박스)만 내려가면 반전이 아니라 아직 X 열 — 다시 36 이 와도 직전 X 열이 없어 신호 없음
    vals = list(B.pnf_signals(_closes([30, 35, 33, 36]), "us").values())
    assert vals == [None, None, None, None]


def test_add_bpi_counts_only_stocks_with_a_signal():
    rows = [{"d": "2026-10-01"}, {"d": "2026-10-02"}]
    sigs = [{"2026-10-01": 1, "2026-10-02": 1}, {"2026-10-01": -1, "2026-10-02": 1}, {"2026-10-01": None}]
    B.add_bpi(rows, sigs, [True, False, True])
    assert rows[0]["bpi"] == 50.0 and rows[0]["bpiIdx"] == 100.0
    assert rows[1]["bpi"] == 100.0


# ── 섹터 시장 폭 · 업종 순위 ──────────────────────────────────────────────────────


def test_sector_breadth_min_size_and_history_length():
    up = B.stock_flags(_closes(range(1, 260)))
    down = B.stock_flags(_closes(range(400, 141, -1)))
    dates = [d for d, _ in _closes(range(1, 260))][-10:]
    members = [("TECH", up, {dates[-1]: 1})] * 3 + [("TECH", down, {dates[-1]: -1})] + [("SMALL", up, {})]
    out = B.sector_breadth(dates, members, min_n=2)
    assert [s["name"] for s in out] == ["TECH"]
    t = out[0]
    assert t["n"] == 4 and len(t["above50"]) == 10 and t["above50"][-1] == 75.0 and t["bpi"] == 75.0


def _member(ticker, industry, cap, closes):
    c = _closes(closes)
    return {"ticker": ticker, "name": ticker, "sector": "S", "industry": industry, "cap": cap,
            "px": dict(c), "flags": B.stock_flags(c)}


def test_industry_groups_weighting_prev_and_min_size():
    n = 80
    flat = [100.0] * n
    up = [100.0] * (n - 1) + [110.0]            # 마지막 날 +10%
    members = [_member("BIG", "Chips", 900, up)] + [_member(f"S{i}", "Chips", 25, flat) for i in range(4)]
    members += [_member(f"T{i}", "Tiny", 10, up) for i in range(4)]   # 4종목 — GROUP_MIN 미만
    dates = [d for d, _ in _closes(flat)]
    out = B.industry_groups(dates, members)
    assert [g["name"] for g in out] == ["Chips"]
    g = out[0]
    assert g["n"] == 5
    cw, ew = g["r"]["1d"]
    assert ew == 2.0                             # (10 + 0×4) / 5
    assert abs(cw - 10 * 900 / 1000) < 0.01      # 시총 가중: 그날 시총 900 vs 100
    assert g["p"]["1d"] == [0.0, 0.0]            # 5거래일 전에는 다 보합
    assert g["top"]["1d"][0][0] == "BIG"
    assert "3m" in g["r"]


def test_industry_groups_skip_other_bucket():
    flat = [100.0] * 80
    members = [_member(f"O{i}", "Other", 1, flat) for i in range(6)]
    assert B.industry_groups([d for d, _ in _closes(flat)], members) == []
