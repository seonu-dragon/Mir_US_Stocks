"""build_dividend_growth.py — 네트워크 없이 배당 기록 → 연속 증가·지급·연평균 계산만 본다.

사례는 야후 실제 기록의 모양을 옮겼다(PG 2002 의 끼어든 기록, KO 2001 의 하루 차 이중 기록,
XOM 2001 의 $0.01, 삼성전자 2020 특별배당, MCD 의 연 1회 지급).
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import build_dividend_growth as G  # noqa: E402


def quarterly(start_year, end_year, base, step, months=("03-10", "06-10", "09-10", "12-01")):
    rows = []
    amt = base
    for y in range(start_year, end_year + 1):
        for m in months:
            rows.append((f"{y}-{m}", round(amt, 4)))
        amt += step
    return rows


def test_parse_chart_dividends_sorted_and_dedup():
    payload = {"chart": {"result": [{"events": {"dividends": {
        "b": {"date": 1700000000, "amount": 0.5}, "a": {"date": 1600000000, "amount": 0.4},
        "z": {"date": 1600000000, "amount": 0.4}, "neg": {"date": 1650000000, "amount": 0},
    }}}]}}
    rows = G.parse_chart_dividends(payload)
    assert [a for _, a in rows] == [0.4, 0.5]
    assert G.parse_chart_dividends({}) == []
    # 1970 이전(음수 초) 날짜도 처리한다 — 윈도 utcfromtimestamp 는 음수에서 죽는다.
    old = {"chart": {"result": [{"events": {"dividends": {"x": {"date": -238501800, "amount": 0.0016}}}}]}}
    assert G.parse_chart_dividends(old)[0][0] == "1962-06-11"


def test_steady_raiser_counts_every_year():
    rows = quarterly(2010, 2025, 0.10, 0.01)
    st = G.growth_stats(rows, 2025)
    assert st["up"] == 14            # 2010 은 기록 첫해 → 2011 대비 비교도 빼서 2012~2025
    assert st["paid"] == 16 and st["paidCapped"] is True
    assert st["capped"] is True and st["since"] == 2010
    assert st["lastCut"] is None
    assert st["last"] == round(4 * 0.25, 4)
    assert abs(st["cagr5"] - ((0.25 / 0.20) ** (1 / 5) - 1) * 100) < 0.01


def test_flat_year_breaks_increase_streak():
    rows = quarterly(2015, 2019, 0.5, 0.05) + quarterly(2020, 2020, 0.7, 0) + quarterly(2021, 2025, 0.7, 0.05)
    # 2020 은 2019 와 같은 0.70 → 2021 부터 다시 센다(2021 0.70 → 같음, 2022 0.75 부터 증가)
    st = G.growth_stats(rows, 2025)
    assert st["up"] == 4
    assert st["paid"] == 11


def test_extra_record_in_a_quarter_does_not_fake_cut():
    # PG 2002: 정기 4회 + 06-03 끼어든 0.345. 달력 합이면 2003 이 감소로 보인다.
    rows = quarterly(1998, 2004, 0.15, 0.015)
    rows.append(("2002-06-03", 0.345))
    rows.sort()
    st = G.growth_stats(rows, 2004)
    assert st["lastCut"] is None
    assert st["up"] == 5


def test_tiny_glitch_and_one_day_duplicate():
    rows = quarterly(1996, 2003, 0.2, 0.01)
    rows += [("2001-06-18", 0.01), ("2001-09-12", round(2 * 0.25, 4))]
    rows.sort()
    st = G.growth_stats(rows, 2003)
    assert st["lastCut"] is None and st["up"] == 6


def test_special_dividend_excluded_but_counted():
    rows = quarterly(2015, 2025, 354, 0, months=("03-29", "06-29", "09-27", "12-27"))
    rows = [(d, 1932.0) if d == "2020-12-27" else (d, a) for d, a in rows]
    vals, specials = G.annual_values(rows)
    assert specials == 1
    assert vals[2020] == vals[2019] == 4 * 354


def test_recurring_large_final_is_not_special():
    # 중간 소액 + 결산 고액이 해마다 반복되면(국내 금융지주형) 1년 전 같은 차례 지급과 비슷해 특별배당이 아니다.
    rows = []
    for y in range(2015, 2026):
        rows += [(f"{y}-06-29", 300.0), (f"{y}-12-28", 1500.0 + (y - 2015) * 10)]
    assert not any(G.special_flags(rows))
    st = G.growth_stats(rows, 2025)
    assert st["up"] == 9


def test_annual_payer_and_frequency_switch():
    rows = [(f"{y}-11-13", round(0.2 + 0.01 * (y - 2000), 3)) for y in range(2000, 2008)]
    rows = [("1999-03-11", 0.049), ("1999-05-27", 0.049), ("1999-08-30", 0.049), ("1999-11-29", 0.049)] + rows
    st = G.growth_stats(rows, 2007)
    assert st["up"] == 7     # 2000(연 1회 첫해 0.20) 이후 매년 증가 — 분기 간격이 섞여 4배로 부풀지 않는다
    assert G.expected_frequency(30) == 12 and G.expected_frequency(91) == 4
    assert G.expected_frequency(182) == 2 and G.expected_frequency(365) == 1


def test_suspended_dividend_has_no_paid_streak():
    rows = quarterly(2010, 2024, 0.3, 0.01)
    st = G.growth_stats(rows, 2025)
    assert st["paid"] == 0 and st["up"] == 0
    assert G.growth_stats([], 2025) is None
