"""국내(KRX) 거래일 달력 + 'KR 스냅샷 가격이 마지막 완료 거래일 것인가' 판정.

2026-10-23: US 는 check_us_price_session 이 종목별 가격 날짜를 NYSE 마지막 완료 거래일과 대조하는데,
KR 은 그런 검사가 없었다. 네이버 목록이 전 거래일 값으로 멈춘 채 오늘 updatedAtKst 로 발행되면
나이 감시·커버리지·종목 수 하한이 전부 통과한다. 그래서 종목마다 붙은 priceDate(네이버 localTradedAt,
update_korea_data.py 의 quoteDate)를 XKRX 달력의 마지막 완료 거래일과 **날짜로만** 비교한다(가격이
비슷한지로 세션을 추정하지 않는다 — KR 지수 게이트 오탐, PR #192 의 교훈).

두 곳이 같이 쓴다:
  - update_korea_data.py main — 발행 전 관문(밀린 스냅샷으로 기존 파일을 덮지 않는다)
  - check_data_freshness.py --group kr — 마지막 관문(백업 22:00 이 다시 돌 근거가 된다)
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Callable, Iterable
from zoneinfo import ZoneInfo

KST = ZoneInfo("Asia/Seoul")

# 정규장 마감 15:30 + 종가 단일가·네이버 반영 여유 10분. 수능일(개장·마감 1시간 늦춤)은 이 시각에 아직
# 장중이지만 장중 priceDate 도 그날 날짜라 '밀림'으로 오판하지 않는다(기준일 이상이면 통과).
SESSION_DONE = time(15, 40)

# 기준일보다 이른 날짜 + 날짜 미확인 종목 비율 상한. 2026-10-22 정상 스냅샷은 3,819종목 전부 기준일
# (거래정지 종목도 네이버가 그날 날짜를 준다). 진짜 밀림은 목록 전체(또는 시장 하나 ~46%)로 오므로
# 20% 면 평시 0% 에 충분한 여유를 두고 시장 한쪽만 멈춘 날도 잡는다.
KR_PRICE_STALE_MAX = 0.20

IsTrading = Callable[[date], "bool | None"]


def xkrx_is_trading() -> IsTrading | None:
    """exchange_calendars XKRX 로 거래일 판정 함수를 만든다. 패키지가 없으면 None(로컬 등)."""
    try:
        import exchange_calendars as xc

        cal = xc.get_calendar("XKRX")
    except Exception:
        return None
    first, last = cal.first_session.date(), cal.last_session.date()

    def is_trading(day: date) -> bool | None:
        if day < first or day > last:
            return None
        return bool(cal.is_session(day.isoformat()))

    return is_trading


def last_completed_kr_session(now: datetime | None = None, is_trading: IsTrading | None = None) -> date | None:
    """now(기본 현재) 기준으로 정규장이 끝난 가장 최근 KRX 거래일. 달력을 모르면 None."""
    if is_trading is None:
        is_trading = xkrx_is_trading()
        if is_trading is None:
            return None
    now = now or datetime.now(KST)
    if now.tzinfo is None:
        now = now.replace(tzinfo=KST)
    now = now.astimezone(KST)
    day = now.date()
    for _ in range(20):   # 설·추석 연휴 + 주말이 붙어도 20일이면 넉넉하다
        trading = is_trading(day)
        if trading is None:
            return None
        if trading and (day < now.date() or now.time() >= SESSION_DONE):
            return day
        day -= timedelta(days=1)
    return None


def evaluate_kr_price_session(stocks: Iterable[dict], expected: date,
                              max_ratio: float = KR_PRICE_STALE_MAX) -> tuple[str | None, str]:
    """(문제 메시지 또는 None, 요약). 종목 priceDate 가 expected 보다 이르거나 없는 비율을 본다."""
    ref = expected.isoformat()
    total = stale = undated = 0
    stale_dates: dict[str, int] = {}
    for s in stocks:
        total += 1
        pd = str(s.get("priceDate") or "")[:10]
        if not pd:
            undated += 1
        elif pd < ref:
            stale += 1
            stale_dates[pd] = stale_dates.get(pd, 0) + 1
    if not total:
        return f"종목 0개 — 가격 기준일({ref})을 대조할 수 없다", ""
    ratio = (stale + undated) / total
    top = ", ".join(f"{d} {n}" for d, n in sorted(stale_dates.items(), reverse=True)[:3])
    detail = f"기준일 {ref} 이전 {stale}{f'({top})' if top else ''} · 날짜 없음 {undated} / 전체 {total}"
    if ratio > max_ratio:
        return (f"가격 기준일 밀림·미확인 {ratio:.1%} > {max_ratio:.0%} ({detail}) "
                "— 네이버 목록이 전 거래일 값으로 멈췄을 가능성이 높다"), detail
    return None, f"가격 기준일 밀림·미확인 {ratio:.1%} ({detail})"
