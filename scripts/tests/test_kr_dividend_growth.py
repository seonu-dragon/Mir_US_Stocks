"""국내 배당 성장 이력(build_kr_dividend_growth.py) 테스트. 오프라인."""
from datetime import datetime

import build_kr_dividend_growth as kd


def _rows(dps, par, pref=None):
    """alotMatter 응답 모양(당기·전기·전전기)."""
    out = [{"se": "주당액면가액(원)", "stock_knd": "-", "thstrm": par[0], "frmtrm": par[1], "lwfr": par[2]},
           {"se": "(연결)주당순이익(원)", "stock_knd": "-", "thstrm": "6,461", "frmtrm": "299,868", "lwfr": "157,967"},
           {"se": "주당 현금배당금(원)", "stock_knd": "보통주", "thstrm": dps[0], "frmtrm": dps[1], "lwfr": dps[2]}]
    if pref:
        out.append({"se": "주당 현금배당금(원)", "stock_knd": "우선주", "thstrm": pref[0], "frmtrm": pref[1], "lwfr": pref[2]})
    return out


def test_last_fiscal_year_switches_in_april():
    assert kd.last_fiscal_year(datetime(2026, 3, 31)) == 2024
    assert kd.last_fiscal_year(datetime(2026, 4, 1)) == 2025


def test_parse_alot_common_stock_only_and_dash_is_zero():
    y = kd.parse_alot(_rows(["1,416", "42,500", "-"], ["100", "5,000", "5,000"], pref=["9", "9", "9"]), 2018)
    assert y == {2018: [1416.0, 100.0], 2017: [42500.0, 5000.0], 2016: [0.0, 5000.0]}
    assert kd.parse_alot([], 2018) == {}
    assert kd.parse_alot([{"se": "주당액면가액(원)", "thstrm": "100"}], 2018) == {}   # 배당 행이 없으면 빈 결과


def test_parse_alot_old_reports_without_stock_kind_use_first_row():
    # 2019 이전 보고서: stock_knd 가 '-' 이고 보통주 행 다음에 우선주 행(SK텔레콤 2019 실제 응답 모양).
    rows = [{"se": "주당액면가액(원)", "stock_knd": "-", "thstrm": "500", "frmtrm": "500", "lwfr": "500"},
            {"se": "주당 현금배당금(원)", "stock_knd": "-", "thstrm": "10,000", "frmtrm": "10,000", "lwfr": "10,000"},
            {"se": "주당 현금배당금(원)", "stock_knd": "-", "thstrm": "-", "frmtrm": "-", "lwfr": "-"}]
    assert kd.parse_alot(rows, 2019) == {2019: [10000.0, 500.0], 2018: [10000.0, 500.0], 2017: [10000.0, 500.0]}
    # 우선주 표시만 있고 보통주 표시가 없으면 우선주는 쓰지 않는다
    assert kd.parse_alot([{"se": "주당 현금배당금(원)", "stock_knd": "우선주", "thstrm": "9", "frmtrm": "9", "lwfr": "9"}], 2019) == {}


def test_forget_empty_reports_only_drops_reports_without_values():
    cache = {"C": {"fetched": [2016, 2019, 2022], "years": {"2022": [1, 1], "2021": [1, 1], "2016": [1, 1]}}}
    assert kd.forget_empty_reports(cache) == 1
    assert cache["C"]["fetched"] == [2016, 2022]


def test_par_split_is_converted_to_latest_par():
    # 삼성전자 2018 액면분할(5,000 → 100): 2017 42,500원 = 지금 기준 850원.
    years = {"2018": [1416.0, 100.0], "2017": [42500.0, 5000.0], "2016": [28500.0, 5000.0]}
    v = kd.adjusted_values(years, 2018)
    assert v == {2018: 1416.0, 2017: 850.0, 2016: 570.0}
    assert kd.adjusted_values({"2020": [10.0, None]}, 2020) == {2020: 10.0}   # 액면을 모르면 그대로


def test_growth_stats_streak_paid_cagr_cut():
    vals = {2016: 100.0, 2017: 110.0, 2018: 105.0, 2019: 120.0, 2020: 130.0, 2021: 140.0}
    st = kd.growth_stats(vals, 2021)
    assert st["up"] == 3 and st["paid"] == 6 and not st["capped"] and st["paidCapped"]
    assert st["lastCut"] == 2018 and st["since"] == 2016 and st["last"] == 140.0
    assert st["cagr5"] == round(((140 / 100) ** (1 / 5) - 1) * 100, 2) and st["cagr10"] is None
    # 첫 연도부터 내내 증가 → 그 앞은 모름(capped)
    st2 = kd.growth_stats({2019: 1.0, 2020: 2.0, 2021: 3.0}, 2021)
    assert st2["up"] == 2 and st2["capped"]
    # 무배당 해가 끼면 연속 지급이 끊긴다
    assert kd.growth_stats({2020: 0.0, 2021: 5.0}, 2021)["paid"] == 1
    assert kd.growth_stats({}, 2021) is None


def test_next_report_plan_goes_deeper_only_while_paying():
    L = 2025
    assert kd.next_report({"years": {}, "fetched": []}, L) == 2025
    paying = {"fetched": [2025], "years": {"2025": [3, 1], "2024": [2, 1], "2023": [1, 1]}}
    assert kd.next_report(paying, L) == 2022
    stopped = {"fetched": [2025], "years": {"2025": [3, 1], "2024": [0, 1], "2023": [1, 1]}}
    assert kd.next_report(stopped, L) is None                    # 연속 지급이 끊겼다
    assert kd.next_report({"fetched": [2025], "years": {}}, L) is None   # 자료 없음
    deep = {"fetched": [2025, 2022, 2019, 2016], "years": {str(y): [1, 1] for y in range(2014, 2026)}}
    assert kd.next_report(deep, L) is None                       # 4개 보고서(12년)까지
    # 중간 보고서가 빠졌으면(받았는데 비어 다시 받기로 한 것 등) 그걸 먼저 채운다 — SK텔레콤 2019 보고서 사례.
    gap = {"fetched": [2016, 2025], "years": {str(y): [1, 1] for y in (2014, 2015, 2016, 2023, 2024, 2025)}}
    assert kd.next_report(gap, L) == 2022
    gap["fetched"].append(2022)
    gap["years"].update({str(y): [1, 1] for y in (2020, 2021, 2022)})
    assert kd.next_report(gap, L) == 2019
    early = {"fetched": [2017], "years": {str(y): [1, 1] for y in range(2015, 2018)}}
    assert kd.next_report(early, 2017) is None                   # 2015 이전 보고서는 없다(2014 < 2015)


def test_run_caches_respects_call_cap_and_payload_carries_pending():
    calls = []

    def fetch(corp, year):
        calls.append((corp, year))
        if corp == "C2":
            return []                      # 자료 없음(013)
        return _rows(["3", "2", "1"], ["500", "500", "500"])

    pairs = [("000001", "C1"), ("000002", "C2"), ("000003", "C3")]
    cache = {}
    n, why = kd.run(pairs, cache, 2025, fetch, max_calls=3)
    assert n == 3 and why.startswith("호출 상한")
    assert calls == [("C1", 2025), ("C1", 2022), ("C1", 2019)]
    prev = {"000001": ["old"], "000003": ["prev3"]}
    tickers, carried, pending = kd.build_payload(pairs, cache, 2025, prev)
    assert tickers == {"000001": ["old"], "000003": ["prev3"]} and carried == 2 and pending == 3
    n2, why2 = kd.run(pairs, cache, 2025, fetch, max_calls=100)
    assert why2 == ""
    tickers, carried, pending = kd.build_payload(pairs, cache, 2025, prev)
    assert pending == 0 and carried == 0
    rec = dict(zip(kd.COLS, tickers["000001"]))
    assert (rec["up"], rec["paid"], rec["paidCapped"], rec["since"]) == (2, 12, True, 2014)   # 보고서 4개 = 2014~2025
    assert "000002" not in tickers                                # 배당 자료가 없는 회사는 빠진다
    # 다시 돌려도 이미 받은 보고서는 부르지 않는다
    before = len(calls)
    kd.run(pairs, cache, 2025, fetch, max_calls=100)
    assert len(calls) == before
