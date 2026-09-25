"""미국 정규장(NYSE/Nasdaq) 거래일 달력 — '지금 기준 마지막으로 끝난 거래일' 계산용.

US 스냅샷의 가격 기준일(priceDate)이 하루 밀렸는지 판정할 때 쓴다. 판정은 **날짜로만**
한다(가격이 비슷한지로 세션을 추정하지 않는다 — KR 지수 게이트 오탐, PR #192 의 교훈).

휴장일은 NYSE 공식 휴장 목록을 하드코딩한다. 목록이 덮지 않는 해에는 판정을 하지 않고
None 을 돌려준다(주말만 빼는 추정으로 휴장일에 오탐하느니 경고만 내는 쪽이 낫다).
해가 바뀌기 전에 다음 해 목록을 추가할 것 — tests/test_us_price_session.py 가 알려 준다.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")

# 정규장 마감(16:00 ET). 조기 폐장일(13:00)도 16:00 이후면 끝난 것이므로 하나로 충분하다.
SESSION_CLOSE_HOUR = 16

# NYSE 휴장일 (https://www.nyse.com/markets/hours-calendars)
NYSE_HOLIDAYS = {
    2026: {
        "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25",
        "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
    },
    2027: {
        "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31",
        "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
    },
}


def covered_years() -> set[int]:
    return set(NYSE_HOLIDAYS)


def is_trading_day(day: date) -> bool | None:
    """거래일이면 True, 주말·휴장일이면 False, 달력이 그 해를 모르면 None."""
    if day.weekday() >= 5:
        return False
    holidays = NYSE_HOLIDAYS.get(day.year)
    if holidays is None:
        return None
    return day.isoformat() not in holidays


def session_close(day: date) -> datetime:
    return datetime(day.year, day.month, day.day, SESSION_CLOSE_HOUR, tzinfo=ET)


def last_completed_session(now: datetime | None = None) -> date | None:
    """now(기본 현재) 기준으로 정규장이 끝난 가장 최근 거래일. 달력 밖이면 None."""
    now = (now or datetime.now(ET))
    if now.tzinfo is None:
        now = now.replace(tzinfo=ET)
    now = now.astimezone(ET)
    day = now.date()
    for _ in range(15):
        trading = is_trading_day(day)
        if trading is None:
            return None
        if trading and now >= session_close(day):
            return day
        day -= timedelta(days=1)
    return None
