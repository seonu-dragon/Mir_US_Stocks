"""build_industry_indicators — 분석 순수 함수·게이트·TWSE 적립 규약 (오프라인·결정적).

기획서 8장(정직성 규약)의 핵심을 고정한다:
- 기간 등락은 주기보다 짧은 칸을 비우고, 기준점이 성기면 가짜 숫자를 넣지 않는다.
- 신호등은 YoY 의 부호가 아니라 변화 방향 — +30% → +5% 피크아웃은 '악화'다.
- tone=-1 지표(실업수당·스프레드)는 오르면 '악화'.
- 티커 게이트: 레포에 없는 관련 종목은 빌드를 깨뜨린다.
"""
from __future__ import annotations

import json
from datetime import date

import pytest

import build_industry_indicators as B


# ---------------------------------------------------------------------------
# YoY · 기간 등락
# ---------------------------------------------------------------------------
def _monthly(vals, start=(2020, 1)):
    y, m = start
    out = []
    for v in vals:
        out.append((f"{y:04d}-{m:02d}", float(v)))
        m += 1
        if m > 12:
            m, y = 1, y + 1
    return out


def test_normalize_keys_turns_fred_month_and_quarter_dates_into_period_keys():
    assert B.normalize_keys([("2026-08-01", 1.0)], "M") == [("2026-08", 1.0)]
    assert B.normalize_keys([("2026-04-01", 1.0)], "Q") == [("2026-Q2", 1.0)]
    assert B.normalize_keys([("2026-09-15", 1.0)], "D") == [("2026-09-15", 1.0)]


def test_yoy_monthly_matches_same_month_last_year():
    s = _monthly([100] * 12 + [110])
    y = B.yoy_series(s, "M")
    assert y[-1] == pytest.approx(10.0)
    assert y[0] is None


def test_yoy_daily_uses_value_364_days_back():
    s = [("2025-09-15", 50.0), ("2026-09-14", 60.0), ("2026-09-15", 75.0)]
    y = B.yoy_series(s, "D")
    assert y[-1] == pytest.approx(50.0)


def test_yoy_is_none_when_sign_flips():
    assert B._pct(5.0, -5.0) is None


def test_performance_blanks_horizons_shorter_than_frequency():
    s = _monthly(range(100, 140))
    perf = B.performance(s, "M", "pct")
    assert perf["1D"] is None and perf["1W"] is None
    assert perf["1M"] == pytest.approx((139 / 138 - 1) * 100)
    assert perf["1Y"] == pytest.approx((139 / 127 - 1) * 100)


def test_performance_does_not_reuse_far_base_point_for_short_horizons():
    # TWSE 첫 적립: 작년 8월 · 올해 7월 · 올해 8월 세 점뿐 → 3M/6M 칸에 1년 전 값을 넣으면 안 된다.
    s = [("2025-08", 100.0), ("2026-07", 140.0), ("2026-08", 150.0)]
    perf = B.performance(s, "M", "pct")
    assert perf["1M"] == pytest.approx((150 / 140 - 1) * 100)
    assert perf["1Y"] == pytest.approx(50.0)
    assert perf["3M"] is None and perf["6M"] is None and perf["YTD"] is None


def test_performance_diff_mode_for_spreads():
    s = [("2026-08-01", 3.0), ("2026-09-01", 2.0), ("2026-09-02", 2.5)]
    perf = B.performance(s, "D", "diff")
    assert perf["1D"] == pytest.approx(0.5)
    assert perf["1M"] == pytest.approx(-0.5)


# ---------------------------------------------------------------------------
# 신호등 (8.3)
# ---------------------------------------------------------------------------
def _yoy_path(yoys, base=100.0):
    """원하는 YoY 경로를 만드는 월간 레벨 시계열(첫 12개월은 base 고정)."""
    vals = [base] * 12
    for y in yoys:
        vals.append(vals[-12] * (1 + y / 100))
    return _monthly(vals, start=(2018, 1))


def test_regime_peak_out_is_deteriorating_even_while_yoy_positive():
    # YoY 가 +30 → +5 로 꺾이는 구간: 부호 규칙이면 '개선', 방향 규칙이면 '악화'.
    path = [5] * 24 + [30, 30, 30, 25, 20, 15, 10, 5, 5]
    r = B.regime(_yoy_path(path), "M", "yoy", 1)
    assert r["direction"] == "deteriorating"
    assert r["level"] == "expanding"


def test_regime_flat_when_delta_inside_quarter_sigma():
    path = [5] * 40
    r = B.regime(_yoy_path(path), "M", "yoy", 1)
    assert r["direction"] in ("flat", "unknown")


def test_regime_tone_minus_one_flips_direction_but_keeps_raw():
    path = [0] * 24 + [1, 2, 4, 7, 11, 16, 22, 29, 37]
    r = B.regime(_yoy_path(path), "M", "yoy", -1)
    assert r["direction_raw"] == "improving"
    assert r["direction"] == "deteriorating"


def test_regime_unknown_with_short_history():
    r = B.regime(_monthly([1, 2, 3]), "M", "yoy", 1)
    assert r["direction"] == "unknown"


def test_regime_level_basis_uses_level_change_and_no_expanding_label():
    vals = [0.0] * 30 + [0.1 * i for i in range(1, 15)]
    r = B.regime(_monthly(vals), "M", "level", 1)
    assert r["direction"] == "improving"
    assert r["level"] is None


# ---------------------------------------------------------------------------
# 통계 · 계절성 · 발표일 · stale
# ---------------------------------------------------------------------------
def test_window_stats_percentile_and_extremes():
    s = _monthly(range(1, 61))
    st = B.window_stats(s, years=5)
    assert st["max"]["val"] == 60 and st["min"]["val"] >= 1
    assert st["percentile"] == pytest.approx(1.0)


def test_seasonal_compares_same_month_yoy_average():
    s = _yoy_path([10] * 48 + [20])  # 마지막 달 YoY 20, 같은 달 과거 평균 10
    yoy = B.yoy_series(s, "M")
    sea = B.seasonal(s, yoy)
    assert sea["verdict"] == "above" and sea["same_month_yoy_avg"] == pytest.approx(10.0)


def test_next_release_monthly_and_weekly():
    m = B.next_release({"kind": "monthly", "day": 10}, date(2026, 9, 18))
    assert m["date"] == "2026-10-10" and m["days_ahead"] == 22
    w = B.next_release({"kind": "weekly", "weekday": 3}, date(2026, 9, 18))  # 금요일 → 다음 목요일
    assert w["date"] == "2026-09-24"
    assert B.next_release({"kind": "none"}, date(2026, 9, 18)) is None


def test_stale_gate_uses_frequency_default_and_override():
    today = date(2026, 9, 18)
    assert B.stale([("2026-05-01", 1.0)], "M", today)
    assert not B.stale([("2026-07-01", 1.0)], "M", today)
    assert not B.stale([("2026-05-01", 1.0)], "M", today, override=200)


def test_net_liquidity_units_and_alignment():
    walcl = [("2026-09-09", 6_760_000.0), ("2026-09-16", 6_750_000.0)]  # 백만$
    tga = [("2026-09-09", 883_335.0), ("2026-09-16", 877_028.0)]         # 백만$
    rrp = [("2026-09-08", 4.0), ("2026-09-15", 5.0), ("2026-09-16", 5.375), ("2026-09-17", 0.276)]  # 십억$
    out = B.net_liquidity(walcl, tga, rrp)
    assert [d for d, _ in out] == ["2026-09-09", "2026-09-16"]
    assert out[1][1] == pytest.approx(6.75 - 0.877028 - 0.005375)
    assert out[0][1] == pytest.approx(6.76 - 0.883335 - 0.004)  # 09-09 는 09-08 RRP 를 쓴다
    assert B.net_liquidity(walcl, tga, rrp[1:]) [0][0] == "2026-09-16"  # RRP 가 없는 주는 뺀다


# ---------------------------------------------------------------------------
# TWSE/TPEx 파싱·적립
# ---------------------------------------------------------------------------
TW_ROW = {"出表日期": "1150914", "資料年月": "11508", "公司代號": "2330", "公司名稱": "台積電", "產業別": "24",
          "營業收入-當月營收": "514805337", "營業收入-上月營收": "467580548", "營業收入-去年當月營收": "335771691",
          "營業收入-上月比較增減(%)": "10.10", "營業收入-去年同月增減(%)": "53.32"}


def test_parse_tw_rows_converts_roc_year():
    rows = B.parse_tw_rows([TW_ROW, {"公司代號": "", "資料年月": "11508"}])
    assert rows["2330"]["date"] == "2026-08"
    assert rows["2330"]["val"] == 514805337.0 and rows["2330"]["yago"] == 335771691.0
    assert len(rows) == 1


def test_archive_seeds_prev_and_yago_and_skips_duplicates():
    latest = B.parse_tw_rows([TW_ROW])["2330"]
    arch, changed = B.update_tw_archive({"keep": 240, "records": []}, latest)
    assert changed
    dates = [r["date"] for r in arch["records"]]
    assert dates == ["2025-08", "2026-07", "2026-08"]
    assert arch["records"][0]["seeded"] and "seeded" not in arch["records"][2]
    arch2, changed2 = B.update_tw_archive(arch, latest)
    assert not changed2 and arch2["records"] == arch["records"]
    # 다음 달 실제 값이 오면 seeded 행을 실값으로 교체한다.
    nxt = dict(latest, date="2026-09", val=600.0, prev=470.0, yago=340.0)
    arch3, _ = B.update_tw_archive(arch2, nxt)
    by = {r["date"]: r for r in arch3["records"]}
    assert by["2026-09"]["val"] == 600.0 and by["2025-09"]["seeded"] and by["2026-08"]["val"] == 514805337.0


def test_oecd_csv_parser_filters_area():
    text = ("REF_AREA,TIME_PERIOD,OBS_VALUE\n"
            "USA,2026-08,100.96\nKOR,2026-08,102.87\nUSA,2026-07,100.8\n")
    assert B.parse_oecd_csv(text, "USA") == [("2026-07", 100.8), ("2026-08", 100.96)]


# ---------------------------------------------------------------------------
# 게이트
# ---------------------------------------------------------------------------
def test_definitions_have_unique_ids_and_resolvable_references(tmp_path):
    ids = [i["id"] for i in B.INDICATORS]
    assert len(ids) == len(set(ids))
    cats = {c["id"] for c in B.CATEGORIES}
    for ind in B.INDICATORS:
        assert set(ind["categories"]) <= cats
        assert set(ind["related_indicators"]) <= set(ids)


def test_ticker_gate_fails_on_missing_detail_file(tmp_path):
    us = tmp_path / "us"; kr = tmp_path / "kr"
    us.mkdir(); kr.mkdir()
    (us / "F.json").write_text("{}", encoding="utf-8")
    inds = [{"id": "a", "categories": ["c"], "related_indicators": [], "related_tickers": B._rel("F GOLD 005930")}]
    cats = [{"id": "c", "sector_etfs": [], "chain": []}]
    problems = B.validate_definitions(inds, cats, us, kr)
    assert any("us:GOLD" in p for p in problems) and any("kr:005930" in p for p in problems)
    assert not any("us:F " in p for p in problems)


def test_ticker_gate_checks_sector_etfs_and_chain():
    us = B.DETAILS_US
    cats = [{"id": "c", "sector_etfs": ["ZZZZNOPE"], "chain": [("x", ["ALSONOPE"])]}]
    problems = B.validate_definitions([], cats, us, B.DETAILS_KR)
    assert len(problems) == 2


def test_real_definitions_pass_ticker_gate_against_repo_details():
    """실제 정의의 관련 종목이 레포 details 에 있다(상폐·티커 변경이 생기면 여기서 먼저 깨진다)."""
    if not B.DETAILS_US.exists() or not B.DETAILS_KR.exists():
        pytest.skip("details 디렉터리 없음")
    assert B.validate_definitions(B.INDICATORS, B.CATEGORIES, B.DETAILS_US, B.DETAILS_KR) == []


def test_analyze_flow20_sums_20_days():
    ind = {"id": "x", "name_kr": "x", "name_en": "x", "categories": ["kr_industry"], "unit": "조원", "frequency": "D",
           "source": "s", "source_url": "u", "source_series_id": "i", "license": B.ECOS_ATTR, "related_tickers": [],
           "related_indicators": [], "tone": 1, "regime_basis": "level", "scale": 1e-4, "digits": 2, "kind": "flow20",
           "release": {"kind": "none"}}
    raw = [(f"2026-08-{d:02d}", 10000.0) for d in range(1, 26)]
    out = B.analyze(ind, raw, date(2026, 9, 18))
    assert out["latest_value"] == pytest.approx(20.0)
    assert out["series"][0]["date"] == "2026-08-20"
    json.dumps(out)  # 직렬화 가능


def test_by_ticker_index_reverses_related_tickers():
    payload = {"updatedAtKst": "x", "indicators": {
        B.INDICATORS[0]["id"]: {"related_tickers": [{"ticker": "NVDA", "market": "us"}, {"code": "000660", "market": "kr"}]}}}
    idx = B.build_by_ticker(payload)["byTicker"]
    assert idx["NVDA"] == [B.INDICATORS[0]["id"]] and idx["000660"] == [B.INDICATORS[0]["id"]]
