#!/usr/bin/env python3
"""Fetch White House public schedule from Factba.se and normalize for the economic calendar."""

from __future__ import annotations

import json
import re
import sys
import urllib.request
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

if sys.platform == "win32":
    # cp949 콘솔에서 한글 출력이 UnicodeEncodeError 로 죽어 빌드 실패로 둔갑한다.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

KST = ZoneInfo("Asia/Seoul")
ET = ZoneInfo("America/New_York")
FACTBA_URL = "https://media-cdn.factba.se/rss/json/trump/calendar-full.json"

HIGH_KEYWORDS = re.compile(
    r"\b(cabinet|bilateral|summit|signs|executive order|press conference|"
    r"meeting with.*ceo|economic|trade|tariff|fed|treasury|commerce|"
    r"jobs report|inflation|gdp|interest rate|market|stock)\b",
    re.I,
)
MED_KEYWORDS = re.compile(
    r"\b(meeting|remarks|announce|policy|legislat|congress|senate|house|"
    r"minister|ambassador|ceo|business|industry|energy|defense)\b",
    re.I,
)


def _fetch_json(url: str) -> list:
    req = urllib.request.Request(url, headers={"User-Agent": "MirUSStocks/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _parse_time_hms(raw: str) -> tuple[int, int, int]:
    parts = (raw or "00:00:00").split(":")
    h = int(parts[0]) if len(parts) > 0 else 0
    m = int(parts[1]) if len(parts) > 1 else 0
    s = int(parts[2]) if len(parts) > 2 else 0
    return h, m, s


def _classify_importance(details: str, coverage: str) -> int:
    text = f"{details} {coverage}"
    if HIGH_KEYWORDS.search(text):
        return 3
    if MED_KEYWORDS.search(text):
        return 2
    if re.search(r"executive time|no public|in-town|out-of-town travel", text, re.I):
        return 1
    return 2


def _to_kst_event(row: dict) -> dict | None:
    date_str = str(row.get("date") or "").strip()
    if not date_str:
        return None
    try:
        y, mo, d = [int(x) for x in date_str.split("-")]
    except ValueError:
        return None
    h, mi, s = _parse_time_hms(str(row.get("time") or "00:00:00"))
    try:
        et_dt = datetime(y, mo, d, h, mi, s, tzinfo=ET)
        kst_dt = et_dt.astimezone(KST)
    except ValueError:
        return None

    details = str(row.get("details") or "").strip()
    location = str(row.get("location") or "").strip()
    coverage = str(row.get("coverage") or "").strip()
    importance = _classify_importance(details, coverage)

    day_label = kst_dt.strftime("%Y-%m-%d (%a)")
    time_label = kst_dt.strftime("%H:%M")
    event_text = details
    if location and location.lower() not in details.lower():
        event_text = f"{details} — {location}"

    return {
        "day": day_label,
        "time": time_label,
        "datetime": kst_dt.isoformat(),
        "country": "백악관",
        "importance": importance,
        "event": event_text,
        "actual": "",
        "forecast": "",
        "previous": "",
        "location": location,
        "coverage": coverage,
        "source": "factba",
        "sortKey": kst_dt.timestamp(),
    }


def build_white_house_payload(*, horizon_days: int = 21, lookback_days: int = 1) -> dict:
    rows = _fetch_json(FACTBA_URL)
    now_kst = datetime.now(KST)
    start = now_kst - timedelta(days=lookback_days)
    end = now_kst + timedelta(days=horizon_days)

    events: list[dict] = []
    for row in rows:
        ev = _to_kst_event(row)
        if not ev:
            continue
        kst_dt = datetime.fromisoformat(ev["datetime"])
        if start <= kst_dt <= end:
            events.append(ev)

    events.sort(key=lambda e: e.get("sortKey", 0))
    for e in events:
        e.pop("sortKey", None)

    # 원본은 왔는데 정규화 결과가 0건이면 스키마가 바뀐 것이다. 예전에는 그
    # 상태로 '0건 + 방금 찍은 타임스탬프'를 푸시해 감시 장치가 영영 못 봤다
    # (2026-09-15 감사). 소스가 비어 있는 것과 우리가 못 읽은 것을 구분한다.
    if rows and not events:
        raise RuntimeError(
            f"백악관 일정: 원본 {len(rows)}행을 받았으나 정규화 결과 0건 — "
            "Factba.se 스키마 변경 가능성. 기존 파일을 덮지 않는다."
        )

    return {
        "source": "Factba.se (White House public schedule)",
        "updatedAtKst": now_kst.strftime("%Y-%m-%d %H:%M:%S KST"),
        "timezoneNote": "미국 동부(ET) 일정을 한국 시간(KST)으로 변환했습니다.",
        "horizonDays": horizon_days,
        "eventCount": len(events),
        "events": events,
    }


if __name__ == "__main__":
    payload = build_white_house_payload()
    print(json.dumps({"eventCount": payload["eventCount"], "sample": payload["events"][:3]}, ensure_ascii=False, indent=2))