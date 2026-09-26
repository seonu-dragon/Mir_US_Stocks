#!/usr/bin/env python3
"""휴장일·단축거래·파생 만기·FOMC 일정 — 오프라인 계산.

`exchange_calendars`(XKRX·XNYS) 의 거래일 달력으로 오늘(KST)부터 향후 90일의
- 휴장일(평일인데 거래일이 아닌 날)과 이름(한국어로 옮김, 대체휴일 표시)
- 단축 거래(미국 13:00 ET 조기 마감 등)
- 파생 만기: 미국 월간 옵션(셋째 금요일), 한국 코스피200 옵션 월물(둘째 목요일).
  만기일이 휴장이면 직전 거래일로 당긴다(두 거래소 공통 규칙). 3·6·9·12월은 선물·옵션 동시 만기.
- FOMC 금리 결정(연준 공개 일정표, gen_feeds.py 의 FOMC_MEETINGS 를 그대로 쓴다)
을 계산해 data/market_calendar.json + .js(window.MARKET_CALENDAR) 로 쓴다.

외부 호출이 없다. 달력 자체는 라이브러리가 들고 있는 거래소 휴장 규칙·음력 표이므로,
거래소가 임시 휴장(선거일 등)을 새로 정하면 라이브러리 갱신 전까지 반영되지 않는다 —
화면에 '거래소 공지가 우선' 을 적는다.

실행: py scripts/build_market_calendar.py [--days 90] [--today 2026-09-26] [--push]
"""
from __future__ import annotations

import argparse
import sys
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

if sys.platform == "win32":
    for _s in (sys.stdout, sys.stderr):
        try:
            _s.reconfigure(encoding="utf-8")
        except Exception:
            pass

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
OUT_JSON = ROOT / "data" / "market_calendar.json"
OUT_JS = ROOT / "data" / "market_calendar.js"
KST = timezone(timedelta(hours=9))

try:
    from zoneinfo import ZoneInfo
    ET = ZoneInfo("America/New_York")
except Exception:  # pragma: no cover
    ET = None

KR_NAMES = {
    "Buddha's Birthday": "부처님오신날",
    "Children's Day": "어린이날",
    "Christmas": "성탄절",
    "Chuseok": "추석",
    "End of Year Holiday": "연말 휴장",
    "Hangul Proclamation Day": "한글날",
    "Independence Movement Day": "삼일절",
    "Korean National Foundation Day": "개천절",
    "Labor Day": "근로자의 날",
    "Memorial Day": "현충일",
    "National Liberation Day": "광복절",
    "New Year's Day": "신정",
    "Seollal": "설날",
}
US_NAMES = {
    "Christmas": "성탄절",
    "Dr. Martin Luther King Jr. Day": "마틴 루서 킹 데이",
    "Good Friday": "성금요일",
    "July 4th": "독립기념일",
    "Juneteenth National Independence Day": "준틴스",
    "Labor Day": "노동절",
    "Memorial Day": "메모리얼 데이",
    "New Year's Day": "신정",
    "President's Day": "대통령의 날",
    "Thanksgiving": "추수감사절",
}
# 양력 고정 휴일의 원래 날짜. 휴장일이 이 날짜가 아니면 대체(관측) 휴일이다.
KR_FIXED = {"개천절": (10, 3), "한글날": (10, 9), "광복절": (8, 15), "삼일절": (3, 1), "어린이날": (5, 5),
            "성탄절": (12, 25), "신정": (1, 1), "현충일": (6, 6), "근로자의 날": (5, 1)}
US_FIXED = {"독립기념일": (7, 4), "준틴스": (6, 19), "성탄절": (12, 25), "신정": (1, 1)}

EXCHANGES = {"kr": ("XKRX", "한국"), "us": ("XNYS", "미국")}
QUARTER_MONTHS = (3, 6, 9, 12)


def ko_holiday_name(market: str, raw: str | None, d: date) -> str:
    """exchange_calendars 영문 이름 → 한국어. 대체휴일이면 '(대체휴일)' 을 붙인다."""
    if not raw:
        return "임시 휴장"
    table = KR_NAMES if market == "kr" else US_NAMES
    name = None
    for key, ko in table.items():
        if raw.startswith(key):
            name = ko
            break
    if name is None:
        return raw
    fixed = (KR_FIXED if market == "kr" else US_FIXED).get(name)
    if fixed and (d.month, d.day) != fixed:
        name += " 대체휴일" if market == "kr" else "(대체 휴장)"
    return name


def early_close_label(d: date) -> str:
    if d.month == 11:
        return "추수감사절 다음 날"
    if d.month == 12 and d.day == 24:
        return "성탄절 전날"
    if d.month == 7 and d.day in (2, 3):
        return "독립기념일 전날"
    return "조기 마감"


class Cal:
    """exchange_calendars 한 거래소의 얇은 래퍼(테스트에서 가짜로 바꿔 끼울 수 있게)."""

    def __init__(self, code: str):
        import exchange_calendars as xc
        import pandas as pd
        self._pd = pd
        self.code = code
        self.cal = xc.get_calendar(code, start=(date.today() - timedelta(days=400)).isoformat())
        self.tz = self.cal.tz

    def sessions(self, start: date, end: date) -> set[date]:
        pd = self._pd
        return {ts.date() for ts in self.cal.sessions_in_range(pd.Timestamp(start), pd.Timestamp(end))}

    def holiday_names(self, start: date, end: date) -> dict[date, str]:
        pd = self._pd
        out: dict[date, str] = {}
        rh = self.cal.regular_holidays
        if rh is not None and len(rh.rules):
            for ts, name in rh.holidays(pd.Timestamp(start), pd.Timestamp(end), return_name=True).items():
                out[ts.date()] = str(name)
        return out

    def early_closes(self, start: date, end: date) -> dict[date, str]:
        pd = self._pd
        out = {}
        for ts in self.cal.early_closes:
            d = ts.date()
            if start <= d <= end:
                close = self.cal.session_close(pd.Timestamp(d)).tz_convert(self.tz)
                out[d] = close.strftime("%H:%M")
        return out

    def last_session(self) -> date:
        return self.cal.last_session.date()


def nth_weekday(year: int, month: int, weekday: int, n: int) -> date:
    first = date(year, month, 1)
    return first + timedelta(days=(weekday - first.weekday()) % 7 + 7 * (n - 1))


def roll_back(d: date, sessions: set[date], floor: date) -> date | None:
    """d 가 거래일이 아니면 직전 거래일로(최대 10일). 못 찾으면 None."""
    cur = d
    for _ in range(10):
        if cur in sessions:
            return cur
        cur -= timedelta(days=1)
        if cur < floor:
            break
    return None


def months_between(start: date, end: date):
    y, m = start.year, start.month
    while date(y, m, 1) <= end:
        yield y, m
        m += 1
        if m == 13:
            y, m = y + 1, 1


def expiry_events(market: str, sessions: set[date], start: date, end: date) -> list[dict]:
    """월물 만기. 미국 = 셋째 금요일, 한국 = 둘째 목요일, 휴장이면 직전 거래일."""
    out = []
    lookback = start - timedelta(days=15)
    for y, m in months_between(start, end):
        nominal = nth_weekday(y, m, 4, 3) if market == "us" else nth_weekday(y, m, 3, 2)
        d = roll_back(nominal, sessions, lookback)
        if d is None or not (start <= d <= end):
            continue
        quarterly = m in QUARTER_MONTHS
        if market == "us":
            title = "미국 분기 만기(주식·지수 옵션·선물 동시)" if quarterly else "미국 월간 옵션 만기"
            rule = "매월 셋째 금요일"
        else:
            title = "한국 선물·옵션 동시 만기" if quarterly else "코스피200 옵션 월물 만기"
            rule = "매월 둘째 목요일"
        detail = rule + (", 휴장이라 직전 거래일로 당김" if d != nominal else "")
        out.append({"date": d.isoformat(), "market": market, "kind": "expiry", "quarterly": quarterly,
                    "title": title, "detail": detail})
    return out


def fomc_events(start: date, end: date) -> list[dict]:
    from gen_feeds import FOMC_MEETINGS, FOMC_SOURCE
    out = []
    for d1, d2, sep in FOMC_MEETINGS:
        day2 = date.fromisoformat(d2)
        if ET is not None:
            et = datetime.combine(day2, time(14, 0), tzinfo=ET)
            kst = et.astimezone(KST)
        else:  # pragma: no cover
            kst = datetime.combine(day2 + timedelta(days=1), time(3, 0), tzinfo=KST)
        kd = kst.date()
        if not (start <= kd <= end):
            continue
        day1 = date.fromisoformat(d1)
        out.append({
            "date": kd.isoformat(), "time": kst.strftime("%H:%M"), "market": "us", "kind": "fomc",
            "title": "FOMC 기준금리 결정",
            "detail": (f"미 동부 {day2.month}/{day2.day} 14:00 발표(회의 {day1.month}/{day1.day}~{day2.month}/{day2.day})"
                       + (" · 경제전망(점도표) 포함" if sep else "")),
            "url": FOMC_SOURCE,
        })
    return out


def build(today: date, days: int, cals: dict | None = None) -> dict:
    end = today + timedelta(days=days)
    events: list[dict] = []
    coverage = {}
    for market, (code, label) in EXCHANGES.items():
        cal = (cals or {}).get(market) or Cal(code)
        sessions = cal.sessions(today - timedelta(days=20), end)
        names = cal.holiday_names(today, end)
        last = cal.last_session()
        coverage[market] = {"exchange": code, "lastSession": last.isoformat()}
        d = today
        while d <= end:
            if d.weekday() < 5 and d not in sessions and d <= last:
                name = ko_holiday_name(market, names.get(d), d)
                events.append({"date": d.isoformat(), "market": market, "kind": "holiday",
                               "title": f"{label} 휴장", "name": name})
            d += timedelta(days=1)
        for d, hhmm in sorted(cal.early_closes(today, end).items()):
            tzlabel = "ET" if market == "us" else "KST"
            events.append({"date": d.isoformat(), "market": market, "kind": "early_close",
                           "title": f"{label} 단축 거래", "name": early_close_label(d) if market == "us" else "단축 거래",
                           "detail": f"{hhmm} {tzlabel} 마감"})
        events.extend(expiry_events(market, sessions, today, min(end, last)))
    events.extend(fomc_events(today, end))
    order = {"holiday": 0, "early_close": 1, "expiry": 2, "fomc": 3}
    events.sort(key=lambda e: (e["date"], order.get(e["kind"], 9), e["market"]))
    try:
        import exchange_calendars as xc
        ver = getattr(xc, "__version__", "")
    except Exception:  # pragma: no cover
        ver = ""
    return {
        "updatedAtKst": datetime.now(KST).strftime("%Y-%m-%d %H:%M KST"),
        "from": today.isoformat(),
        "to": end.isoformat(),
        "horizonDays": days,
        "source": f"exchange_calendars {ver} (XKRX·XNYS) · 만기는 거래소 규칙으로 계산 · FOMC 는 연준 공개 일정표".strip(),
        "coverage": coverage,
        "count": len(events),
        "events": events,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=90)
    ap.add_argument("--today", help="YYYY-MM-DD(테스트용, 기본 KST 오늘)")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()
    today = date.fromisoformat(args.today) if args.today else datetime.now(KST).date()
    try:
        payload = build(today, args.days)
    except Exception as exc:
        print(f"[error] 달력 계산 실패 — 기존 파일 유지: {exc}", file=sys.stderr)
        return 1
    kinds = {}
    for e in payload["events"]:
        kinds[e["kind"]] = kinds.get(e["kind"], 0) + 1
    print(f"{payload['from']} ~ {payload['to']}: {payload['count']}건 {kinds}")
    if not any(e["kind"] == "expiry" for e in payload["events"]):
        print("[error] 만기가 0건 — 달력 범위가 이상하다. 기존 파일 유지", file=sys.stderr)
        return 1
    from sec_client import write_data
    write_data(OUT_JSON, OUT_JS, "MARKET_CALENDAR", payload, indent=1)
    print(f"→ {OUT_JSON.relative_to(ROOT)}, {OUT_JS.relative_to(ROOT)}")
    if args.push:
        from sec_client import git_publish
        rel = [str(p.relative_to(ROOT)).replace("\\", "/") for p in (OUT_JSON, OUT_JS)]
        if not git_publish(rel, "market calendar"):
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
