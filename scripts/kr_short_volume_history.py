"""국내 일일 공매도 거래비중 — 최근 N 거래일 이력 병합(순수 함수, 네트워크 없음).

build_kr_short_volume.py 가 쓴다. 산출물(short_volume.json/.js)의 `history` 블록:

  {"dates": ["2026-09-24", ..., "2026-10-22"],      # 오래된 → 최신, 최대 HISTORY_DAYS
   "series": {"005930": [1.23, null, 2.5, ...]}}     # dates 와 같은 길이·순서, 거래비중(%)

원칙(데이터 정직성):
  - 실제로 받은 날만 dates 에 들어간다. 빠진 거래일(로그인 실패·휴장·수집 누락)은 **날짜째 없다** —
    앞뒤 값으로 메우거나 0 으로 채우지 않는다.
  - 그날 데이터는 있는데 그 종목 값이 없으면(그날 상위 목록 밖 등) null. 0 은 KRX 가 실제로 준 0%
    (공매도 0원)일 때만이다.
  - 같은 날짜를 다시 받으면 새로 받은 값이 이긴다(재집계 반영). 이전 파일의 값은 새 값이 없는
    종목에 한해 남긴다.
  - series 는 이번 화면 목록(keep)에 있는 종목만 싣는다 — 크기 상한: keep(≤500) × HISTORY_DAYS.
"""
from __future__ import annotations

import re
from typing import Iterable, Mapping

HISTORY_DAYS = 20
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _num(v):
    if v is None or isinstance(v, bool):
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if f != f or f in (float("inf"), float("-inf")) or f < 0:
        return None
    return round(f, 2)


def history_to_day_maps(history) -> dict[str, dict[str, float]]:
    """이전 파일의 history 블록 → {날짜: {티커: 비중}}. 모양이 깨졌으면 그 부분만 버린다."""
    out: dict[str, dict[str, float]] = {}
    if not isinstance(history, Mapping):
        return out
    dates = history.get("dates")
    series = history.get("series")
    if not isinstance(dates, list) or not isinstance(series, Mapping):
        return out
    for d in dates:
        if isinstance(d, str) and _DATE_RE.match(d):
            out.setdefault(d, {})
    for ticker, vals in series.items():
        if not isinstance(vals, list) or len(vals) != len(dates):
            continue  # 길이가 어긋난 시리즈는 어느 날짜 값인지 알 수 없다 — 버린다
        for d, v in zip(dates, vals):
            n = _num(v)
            if n is None or not (isinstance(d, str) and d in out):
                continue
            out[d][str(ticker)] = n
    return out


def merge_history(prev_history, new_days: Mapping[str, Mapping[str, float]],
                  keep_tickers: Iterable[str], max_days: int = HISTORY_DAYS) -> dict:
    """이전 history + 새로 받은 날짜별 비중을 합쳐 최근 max_days 거래일 블록을 만든다.

    new_days: {"YYYY-MM-DD": {티커: 비중(%)}} — 그날 KRX 가 준 값(0% 포함)만.
    keep_tickers: series 에 남길 종목(보통 이번 상위 목록).
    """
    days = history_to_day_maps(prev_history)
    for d, m in (new_days or {}).items():
        if not (isinstance(d, str) and _DATE_RE.match(d)) or not isinstance(m, Mapping):
            continue
        clean = {str(t): n for t, v in m.items() if (n := _num(v)) is not None}
        if not clean:
            continue  # 빈 날(휴장·실패)은 날짜를 만들지 않는다
        merged = dict(days.get(d) or {})
        merged.update(clean)
        days[d] = merged
    # 값이 하나도 없는 날짜(이전 파일에서 시리즈가 전부 깨진 경우)는 남기지 않는다.
    dates = sorted(d for d, m in days.items() if m)
    dates = dates[-int(max_days):] if max_days > 0 else []
    series: dict[str, list] = {}
    for t in dict.fromkeys(str(x) for x in keep_tickers):
        vals = [days[d].get(t) for d in dates]
        if any(v is not None for v in vals):
            series[t] = vals
    return {"dates": dates, "series": series}


def backfill_candidates(have_dates: Iterable[str], latest: str, is_trading=None,
                        max_days: int = HISTORY_DAYS, limit: int = 5) -> list[str]:
    """이력 창(latest 포함 최근 max_days 거래일) 안에서 아직 없는 거래일 — 최신부터 limit 개.

    is_trading(date) → True/False/None(모름). None 이거나 함수가 없으면 평일을 거래일로 본다
    (휴장일이면 KRX 가 빈 응답을 주고 merge_history 가 그 날짜를 만들지 않는다 — 메우지 않는다).
    """
    import datetime as _dt

    if not (isinstance(latest, str) and _DATE_RE.match(latest)) or max_days <= 0 or limit <= 0:
        return []
    have = {d for d in have_dates if isinstance(d, str)}
    day = _dt.date.fromisoformat(latest)
    sessions: list[str] = []
    for _ in range(max_days * 2 + 20):  # 연휴가 겹쳐도 넉넉한 탐색 상한
        if len(sessions) >= max_days:
            break
        t = is_trading(day) if is_trading else None
        if t is None:
            t = day.weekday() < 5
        if t:
            sessions.append(day.isoformat())
        day -= _dt.timedelta(days=1)
    return [d for d in sessions if d not in have][:limit]
