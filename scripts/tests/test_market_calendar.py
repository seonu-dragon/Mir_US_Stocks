"""휴장·만기 달력 빌더(build_market_calendar.py) 테스트.

오프라인·결정적. 규칙 계산은 가짜 달력으로, 실제 휴장일 대조는 exchange_calendars 가
설치돼 있을 때만(2026-10-05 개천절 대체휴일·10-09 한글날, 11-26 미국 추수감사절).
실행: py -m pytest -q scripts/tests/test_market_calendar.py
"""
from __future__ import annotations

from datetime import date, timedelta

import pytest

import build_market_calendar as mc


class FakeCal:
    def __init__(self, holidays: dict[date, str], early: dict[date, str] | None = None, last=date(2027, 9, 1)):
        self.hol = holidays
        self.early = early or {}
        self.last = last

    def sessions(self, start, end):
        out, d = set(), start
        while d <= end:
            if d.weekday() < 5 and d not in self.hol:
                out.add(d)
            d += timedelta(days=1)
        return out

    def holiday_names(self, start, end):
        return {d: n for d, n in self.hol.items() if start <= d <= end and n}

    def early_closes(self, start, end):
        return {d: t for d, t in self.early.items() if start <= d <= end}

    def last_session(self):
        return self.last


def test_nth_weekday():
    assert mc.nth_weekday(2026, 10, 4, 3) == date(2026, 10, 16)   # 셋째 금요일
    assert mc.nth_weekday(2026, 10, 3, 2) == date(2026, 10, 8)    # 둘째 목요일
    assert mc.nth_weekday(2026, 12, 3, 2) == date(2026, 12, 10)


def test_expiry_rolls_back_over_holiday():
    # 2026-04-03(금)은 성금요일 — 셋째 금요일이 아니지만 규칙 검증용으로 셋째 금요일을 휴장으로 만든다.
    hol = {date(2026, 10, 16): "Test"}
    ev = mc.expiry_events("us", FakeCal(hol).sessions(date(2026, 9, 1), date(2026, 12, 31)),
                          date(2026, 10, 1), date(2026, 10, 31))
    assert [e["date"] for e in ev] == ["2026-10-15"]
    assert "직전 거래일" in ev[0]["detail"]


def test_quarterly_labels():
    sess = FakeCal({}).sessions(date(2026, 11, 1), date(2027, 1, 31))
    us = mc.expiry_events("us", sess, date(2026, 12, 1), date(2026, 12, 31))
    kr = mc.expiry_events("kr", sess, date(2026, 12, 1), date(2026, 12, 31))
    assert us[0]["date"] == "2026-12-18" and us[0]["quarterly"] is True
    assert kr[0]["date"] == "2026-12-10" and "동시 만기" in kr[0]["title"]


def test_holiday_names_substitute():
    assert mc.ko_holiday_name("kr", "Korean National Foundation Day", date(2026, 10, 5)) == "개천절 대체휴일"
    assert mc.ko_holiday_name("kr", "Hangul Proclamation Day", date(2026, 10, 9)) == "한글날"
    assert mc.ko_holiday_name("kr", "Chuseok (Korean Thanksgiving Day) (+1 day)", date(2027, 9, 16)) == "추석"
    assert mc.ko_holiday_name("us", "July 4th", date(2026, 7, 3)) == "독립기념일(대체 휴장)"
    assert mc.ko_holiday_name("kr", None, date(2026, 6, 3)) == "임시 휴장"


def test_build_with_fake_calendars():
    kr = FakeCal({date(2026, 10, 5): "Korean National Foundation Day", date(2026, 10, 9): "Hangul Proclamation Day"})
    us = FakeCal({date(2026, 11, 26): "Thanksgiving"}, early={date(2026, 11, 27): "13:00"})
    p = mc.build(date(2026, 9, 26), 90, cals={"kr": kr, "us": us})
    by = {(e["date"], e["market"], e["kind"]) for e in p["events"]}
    assert ("2026-10-05", "kr", "holiday") in by
    assert ("2026-10-09", "kr", "holiday") in by
    assert ("2026-11-26", "us", "holiday") in by
    assert ("2026-11-27", "us", "early_close") in by
    assert ("2026-10-08", "kr", "expiry") in by
    assert ("2026-10-16", "us", "expiry") in by
    # FOMC 10-28 14:00 ET = KST 10-29 03:00
    fomc = [e for e in p["events"] if e["kind"] == "fomc"]
    assert fomc[0]["date"] == "2026-10-29" and fomc[0]["time"] == "03:00"
    dates = [e["date"] for e in p["events"]]
    assert dates == sorted(dates)
    assert p["from"] == "2026-09-26" and p["to"] == "2026-12-25"


def test_real_exchange_calendars():
    pytest.importorskip("exchange_calendars")
    p = mc.build(date(2026, 9, 26), 90)
    hol = {(e["date"], e["market"]): e["name"] for e in p["events"] if e["kind"] == "holiday"}
    assert hol[("2026-10-05", "kr")] == "개천절 대체휴일"   # 10-03 이 토요일
    assert hol[("2026-10-09", "kr")] == "한글날"
    assert hol[("2026-11-26", "us")] == "추수감사절"
    assert ("2026-10-03", "kr") not in hol                  # 주말은 휴장일로 세지 않는다
    early = {(e["date"], e["market"]) for e in p["events"] if e["kind"] == "early_close"}
    assert ("2026-11-27", "us") in early and ("2026-12-24", "us") in early
