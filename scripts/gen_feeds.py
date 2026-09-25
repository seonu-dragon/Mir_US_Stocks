#!/usr/bin/env python3
"""구독 피드 생성 — 캘린더(.ics, RFC 5545) + 공시 RSS 2.0.

백엔드 없이 '알림 비슷한 경험'을 주려고, 이미 발행된 data/*.json 을 읽어 정적 피드를 만든다.
사용자는 구글 캘린더·애플 캘린더(webcal://)·RSS 리더에 URL 을 한 번 등록하면 앱이 주기적으로
다시 받아 간다. 푸시·이메일·텔레그램 같은 외부 발신은 하지 않는다.

**어디서 도는가**: deploy-pages.yml 이 `_site/` 스테이징 사본을 만든 뒤
`python3 scripts/gen_feeds.py --root _site --out _site/data/feeds` 로 부른다.
데이터가 여러 워크플로우(US/KR 스냅샷·8-K·13D·DART·IPO…)에서 따로 커밋되므로, 그 전부가
합쳐지는 유일한 지점인 배포 단계에서 만든다. 레포에는 커밋하지 않는다(data/feeds/ 는
.gitignore) — 봇 커밋과 충돌할 일이 없고, 배포마다 최신 데이터로 다시 만들어진다.

산출물(<out>/):
  calendar-us.ics   미국 실적 예정일(시총 상위)·배당락일·IPO 가격확정·월간 옵션 만기
  calendar-kr.ics   국내 배당 기준일·지급일, 공모 청약·신규 상장
  econ.ics          FOMC 금리 결정(연준 공식 일정)·경제지표(investing.com, 워커 경유)·산업 지표 발표일
  disclosures-us.xml  SEC 8-K 중 중요 항목(빌더의 hot 분류 + 자사주)
  activist-us.xml     SEC 13D/13D-A(경영참여 목적 5%+)
  disclosures-kr.xml  DART 중요 유형(증자·CB/BW·최대주주 변동·자사주·소각·공급계약·주요사항…)
  ticker/us-<T>.xml, ticker/kr-<code>.xml  시총 상위 N 종목별 공시(ETF 제외)
  feeds.json        매니페스트(생성 시각·건수·경로) — 화면의 '구독' 다이얼로그가 읽는다.

정직성: 입력에 없는 일정은 만들지 않는다. 예외는 규칙으로 정해진 날짜 두 가지뿐이고 출처를
설명에 적는다 — FOMC(연준 공개 일정표를 옮겨 적음)와 미국 월간 옵션 만기(셋째 금요일,
그날이 휴장이면 전날). 실적일은 Yahoo 추정일일 수 있다는 점을 이벤트 설명에 남긴다.

입력이 하나 없거나 깨져도 그 부분만 빼고 계속한다(피드 하나 때문에 배포를 막지 않는다).
단 출력 전체가 0건이면 exit 1.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import urllib.request
from datetime import date, datetime, timedelta, timezone
from email.utils import format_datetime
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    ZoneInfo = None  # type: ignore

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT = Path(__file__).resolve().parents[1]
SITE_BASE = "https://seonu-dragon.github.io/Mir_US_Stocks"
WORKER_CALENDAR_URL = "https://mirusstocks.planbesides.workers.dev/?calendar=1"
KST = timezone(timedelta(hours=9))
ET = ZoneInfo("America/New_York") if ZoneInfo else None
UID_DOMAIN = "mir-us-stocks.seonu-dragon.github.io"

PAST_DAYS = 7          # 캘린더: 과거 7일
FUTURE_DAYS = 90       # 캘린더: 미래 90일
US_EARNINGS_TOP = 300  # 실적 예정일은 시총 상위 N(ETF 제외) 안의 종목만
TICKER_FEED_TOP = 50   # 종목별 공시 RSS: 시장별 시총 상위 N(ETF 제외)
RSS_MAX_ITEMS = 300

# 연준 공개 일정표(https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm, 2026-09-25 확인).
# (회의 1일차, 2일차=결정일, SEP 포함 여부). 결정문은 2일차 14:00 ET 에 나온다.
# 새 해 일정이 공개되면 여기에 옮겨 적는다(테스트가 결정일 오름차순·평일을 검사한다).
FOMC_MEETINGS = [
    ("2026-01-27", "2026-01-28", False),
    ("2026-03-17", "2026-03-18", True),
    ("2026-04-28", "2026-04-29", False),
    ("2026-06-16", "2026-06-17", True),
    ("2026-07-28", "2026-07-29", False),
    ("2026-09-15", "2026-09-16", True),
    ("2026-10-27", "2026-10-28", False),
    ("2026-12-08", "2026-12-09", True),
    ("2027-01-26", "2027-01-27", False),
    ("2027-03-16", "2027-03-17", True),
    ("2027-04-27", "2027-04-28", False),
    ("2027-06-08", "2027-06-09", True),
    ("2027-07-27", "2027-07-28", False),
    ("2027-09-14", "2027-09-15", True),
    ("2027-10-26", "2027-10-27", False),
    ("2027-12-07", "2027-12-08", True),
]
FOMC_SOURCE = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"

# DART 유형 라벨(kr_disclosures.json typeLabel) 중 '알림 가치가 있는' 것.
KR_IMPORTANT_TYPES = {
    "증자·사채", "최대주주 변동", "자기주식", "자기주식 신탁", "주식소각", "공급계약",
    "주요사항보고", "거래정지", "소송·판결", "타법인 지분취득", "조회공시 요구",
    "주요경영사항", "배당", "주식병합", "제재·벌금",
}
# 같은 유형 안에서도 알림 가치가 낮은 제목(유동성공급계약=LP 계약, 주식담보 변동 신고 등).
KR_TITLE_SKIP = ("유동성공급계약",)


# ---------------------------------------------------------------------------
# 공통 유틸
# ---------------------------------------------------------------------------

def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        print(f"[feeds] 입력 없음: {path}", file=sys.stderr)
    except Exception as exc:  # 깨진 파일은 그 부분만 뺀다
        print(f"[feeds] 입력 읽기 실패 {path}: {exc}", file=sys.stderr)
    return None


def parse_day(value) -> date | None:
    """'2026-09-24' / '2026.09.24' / '2026/09/24' → date."""
    if not value:
        return None
    s = str(value).strip()[:10].replace(".", "-").replace("/", "-")
    try:
        return date.fromisoformat(s)
    except ValueError:
        return None


def stable_uid(*parts) -> str:
    raw = "|".join(str(p) for p in parts)
    return f"{hashlib.sha1(raw.encode('utf-8')).hexdigest()[:24]}@{UID_DOMAIN}"


def top_tickers(snapshot, n: int, market: str) -> list[dict]:
    rows = (snapshot or {}).get("stocks") or []
    out = []
    for r in rows:
        if not isinstance(r, dict) or not r.get("ticker"):
            continue
        sector = str(r.get("sector") or "")
        if market == "us" and sector == "EXCHANGE TRADED FUNDS":
            continue
        if market == "kr" and (r.get("market") == "etf" or sector == "ETF"):
            continue
        try:
            cap = float(r.get("marketCapB") or 0)
        except (TypeError, ValueError):
            continue
        if cap > 0:
            out.append({"ticker": str(r["ticker"]), "company": str(r.get("company") or ""), "cap": cap})
    out.sort(key=lambda x: -x["cap"])
    return out[:n]


# ---------------------------------------------------------------------------
# iCalendar (RFC 5545)
# ---------------------------------------------------------------------------

def ics_escape(text) -> str:
    """TEXT 값 이스케이프(RFC 5545 3.3.11): 백슬래시·세미콜론·콤마·개행."""
    s = str(text if text is not None else "")
    s = s.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,")
    s = s.replace("\r\n", "\n").replace("\r", "\n").replace("\n", "\\n")
    return s


def fold_line(line: str) -> str:
    """75 옥텟 줄 접기(RFC 5545 3.1). UTF-8 다바이트 문자를 가르지 않는다.
    이어지는 줄은 공백 1개로 시작하고, 그 공백도 75 옥텟에 포함된다."""
    out = []
    cur = b""
    limit = 75
    for ch in line:
        b = ch.encode("utf-8")
        if len(cur) + len(b) > limit:
            out.append(cur.decode("utf-8"))
            cur = b" " + b
            limit = 75
        else:
            cur += b
    out.append(cur.decode("utf-8"))
    return "\r\n".join(out)


def fmt_utc(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


class Event:
    __slots__ = ("uid", "summary", "description", "url", "day", "start", "end", "categories")

    def __init__(self, uid, summary, *, day: date | None = None, start: datetime | None = None,
                 end: datetime | None = None, description="", url="", categories=()):
        self.uid = uid
        self.summary = summary
        self.description = description
        self.url = url
        self.day = day
        self.start = start
        self.end = end
        self.categories = tuple(categories)

    @property
    def sort_key(self):
        if self.start is not None:
            return self.start.astimezone(timezone.utc).replace(tzinfo=None)
        return datetime.combine(self.day, datetime.min.time())

    @property
    def local_day(self) -> date:
        if self.day is not None:
            return self.day
        return self.start.astimezone(KST).date()


def render_ics(name: str, desc: str, events: list[Event], now: datetime) -> str:
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Mir//Mir Subscribe Feeds//KO",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{ics_escape(name)}",
        f"X-WR-CALDESC:{ics_escape(desc)}",
        "X-WR-TIMEZONE:Asia/Seoul",
        # 구독 앱에 갱신 주기를 권한다(구글은 무시하고 자체 주기로 받는다).
        "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
        "X-PUBLISHED-TTL:PT6H",
    ]
    stamp = fmt_utc(now)
    seen = set()
    for ev in sorted(events, key=lambda e: (e.sort_key, e.summary)):
        if ev.uid in seen:
            continue
        seen.add(ev.uid)
        lines.append("BEGIN:VEVENT")
        lines.append(f"UID:{ev.uid}")
        lines.append(f"DTSTAMP:{stamp}")
        if ev.start is not None:
            end = ev.end or (ev.start + timedelta(minutes=30))
            lines.append(f"DTSTART:{fmt_utc(ev.start)}")
            lines.append(f"DTEND:{fmt_utc(end)}")
        else:
            lines.append(f"DTSTART;VALUE=DATE:{ev.day.strftime('%Y%m%d')}")
            lines.append(f"DTEND;VALUE=DATE:{(ev.day + timedelta(days=1)).strftime('%Y%m%d')}")
        lines.append(f"SUMMARY:{ics_escape(ev.summary)}")
        if ev.description:
            lines.append(f"DESCRIPTION:{ics_escape(ev.description)}")
        if ev.url:
            lines.append(f"URL:{ev.url}")
        if ev.categories:
            lines.append("CATEGORIES:" + ",".join(ics_escape(c) for c in ev.categories))
        lines.append("TRANSP:TRANSPARENT")  # 일정이 '바쁨'으로 잡히지 않게
        lines.append("END:VEVENT")
    lines.append("END:VCALENDAR")
    return "\r\n".join(fold_line(l) for l in lines) + "\r\n"


def in_window(d: date, today: date) -> bool:
    return today - timedelta(days=PAST_DAYS) <= d <= today + timedelta(days=FUTURE_DAYS)


# --- 미국 월간 옵션 만기: 셋째 금요일, 휴장(성금요일·준틴스)이면 전날 목요일 -----------

def easter(year: int) -> date:
    """그레고리력 부활절(Anonymous Gregorian algorithm)."""
    a = year % 19
    b, c = divmod(year, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return date(year, month, day)


def monthly_opex(year: int, month: int) -> date:
    first = date(year, month, 1)
    offset = (4 - first.weekday()) % 7  # 금요일=4
    third_fri = first + timedelta(days=offset + 14)
    # 셋째 금요일(15~21일)에 걸릴 수 있는 NYSE 휴장은 성금요일과 준틴스(6/19)뿐이다.
    if third_fri == easter(year) - timedelta(days=2) or (month == 6 and third_fri.day == 19):
        return third_fri - timedelta(days=1)
    return third_fri


def us_calendar_events(data: Path, today: date) -> list[Event]:
    events: list[Event] = []
    snap = load_json(data / "market_snapshot.json")
    names = {}
    for r in (snap or {}).get("stocks") or []:
        if isinstance(r, dict) and r.get("ticker"):
            names[str(r["ticker"])] = str(r.get("company") or "")
    top = {r["ticker"] for r in top_tickers(snap, US_EARNINGS_TOP, "us")}

    # 실적 예정일: earnings_calendar(yfinance) + us_calendar(quoteSummary) 합집합, 시총 상위만.
    # 두 소스가 다르면(한쪽이 지난 분기 날짜에 멈춰 있는 경우가 있다) 창 시작 이후의 가장 이른
    # 날짜를 쓴다.
    earn: dict[str, tuple[date, str]] = {}
    floor = today - timedelta(days=PAST_DAYS)

    def _offer(t, d, src):
        if not d or not t or d < floor:
            return
        if t not in earn or d < earn[t][0]:
            earn[t] = (d, src)

    ec = load_json(data / "earnings_calendar.json") or {}
    for r in ec.get("earnings") or []:
        _offer(str(r.get("ticker") or ""), parse_day(r.get("nextDate")), "Yahoo Finance(yfinance)")
    uc = load_json(data / "us_calendar.json") or {}
    stocks = uc.get("stocks") or {}
    for t, r in stocks.items():
        _offer(t, parse_day((r or {}).get("nextEarnings")), "Yahoo Finance quoteSummary")
    for t, (d, src) in earn.items():
        if top and t not in top:
            continue
        if not in_window(d, today):
            continue
        co = names.get(t, "")
        events.append(Event(
            stable_uid("us-earnings", t, d.isoformat()),
            f"[실적] {t} {co}".strip(),
            day=d,
            description=(f"{co} ({t}) 실적 발표 예정일. 출처: {src}. 회사가 확정하기 전에는 추정일일 수 "
                         "있고 발표 시각(장 전/장 후)은 포함하지 않습니다. 정보 제공용이며 투자 권유가 아닙니다."),
            url=f"{SITE_BASE}/analysis.html?t={t}",
            categories=("실적",),
        ))

    # 배당락일(ex-dividend).
    for t, r in stocks.items():
        d = parse_day((r or {}).get("exDate"))
        if not d or not in_window(d, today):
            continue
        co = names.get(t, "")
        rate = (r or {}).get("divRate")
        extra = f" 연간 주당배당 ${rate}." if isinstance(rate, (int, float)) else ""
        events.append(Event(
            stable_uid("us-exdiv", t, d.isoformat()),
            f"[배당락] {t} {co}".strip(),
            day=d,
            description=f"{co} ({t}) 배당락일.{extra} 출처: Yahoo Finance quoteSummary. 투자 권유가 아닙니다.",
            url=f"{SITE_BASE}/analysis.html?t={t}",
            categories=("배당",),
        ))

    # IPO 가격확정(424B4) — 이미 지난 사실만 있다(과거 7일 창에 걸리는 것).
    ipo = load_json(data / "ipo_calendar.json") or {}
    for r in ipo.get("ipos") or []:
        if r.get("stage") != "priced":
            continue
        d = parse_day(r.get("fileDate"))
        if not d or not in_window(d, today):
            continue
        t = r.get("ticker") or ""
        price = r.get("offerPrice")
        price_txt = f" 공모가 ${price}{'(유닛당)' if r.get('offerPriceKind') == 'unit' else ''}." if price else ""
        events.append(Event(
            stable_uid("us-ipo", r.get("accession") or r.get("company"), d.isoformat()),
            f"[IPO 가격확정] {r.get('company', '')}{f' ({t})' if t else ''}",
            day=d,
            description=f"SEC {r.get('form', '424B4')} 제출(가격 확정·상장 임박/직후).{price_txt} 출처: SEC EDGAR.",
            url=str(r.get("link") or ""),
            categories=("IPO",),
        ))

    # 월간 옵션 만기(규칙 기반).
    start = today - timedelta(days=PAST_DAYS)
    end = today + timedelta(days=FUTURE_DAYS)
    y, m = start.year, start.month
    while date(y, m, 1) <= end:
        d = monthly_opex(y, m)
        if in_window(d, today):
            events.append(Event(
                stable_uid("us-opex", d.isoformat()),
                "[옵션 만기] 미국 월간 옵션 만기일",
                day=d,
                description=("미국 주식·지수 월간 옵션 만기(매월 셋째 금요일, 그날 휴장이면 전 거래일). "
                             "규칙으로 계산한 날짜이며 거래소 공지가 우선합니다."),
                categories=("옵션",),
            ))
        m += 1
        if m == 13:
            y, m = y + 1, 1
    return events


def kr_calendar_events(data: Path, today: date) -> list[Event]:
    events: list[Event] = []
    div = load_json(data / "korea" / "dividends.json") or {}
    # 정정 공시가 원 공시와 함께 들어온다(예: 지급일 10-13 → 10-20). 같은 종목·배당종류·기준일은
    # 가장 늦은 공시 한 건만 쓴다. UID 도 링크가 아니라 (종목·기준일)로 잡아, 정정되면 캘린더
    # 앱에서 같은 일정이 옮겨지게 한다.
    latest: dict[tuple, dict] = {}
    for r in div.get("rows") or []:
        if not isinstance(r, dict):
            continue
        key = (r.get("ticker"), r.get("divKind"), r.get("recordDate"))
        prev = latest.get(key)
        if prev is None or (str(r.get("date") or ""), str(r.get("link") or "")) > (
                str(prev.get("date") or ""), str(prev.get("link") or "")):
            latest[key] = r
    for r in latest.values():
        co = r.get("company") or ""
        t = r.get("ticker") or ""
        dps = r.get("dps")
        kind = r.get("divKind") or "배당"
        dps_txt = f" 주당 {dps:,.0f}원" if isinstance(dps, (int, float)) else ""
        yld = r.get("yieldPct")
        yld_txt = f"(시가배당률 {yld}%)" if isinstance(yld, (int, float)) else ""
        base = f"{co}({t}) {kind}{dps_txt}{yld_txt}. 출처: DART 현금·현물배당결정 공시."
        for key, label, note in (
            ("recordDate", "배당기준일", " 이날 주주명부에 있어야 배당을 받습니다(배당락은 그 전 영업일)."),
            ("payDate", "배당지급", ""),
        ):
            d = parse_day(r.get(key))
            if not d or not in_window(d, today):
                continue
            events.append(Event(
                stable_uid("kr-div", key, t, r.get("divKind"), r.get("recordDate")),
                f"[{label}] {co}",
                day=d,
                description=base + note + " 투자 권유가 아닙니다.",
                url=str(r.get("link") or ""),
                categories=("배당",),
            ))

    ipo = load_json(data / "korea" / "ipo_calendar.json") or {}
    for r in ipo.get("ipos") or []:
        d = parse_day(r.get("fileDate"))
        if not d or not in_window(d, today):
            continue
        acc = str(r.get("accession") or "")
        co = r.get("company") or ""
        if acc.startswith("kr-ipo-bidding-"):
            label = "공모 청약 시작"
        else:
            label = "신규 상장" if r.get("stage") == "priced" else "신규 상장 예정"
        detail = []
        if r.get("form"):
            detail.append(f"주관사 {r['form']}")
        if r.get("offerPrice"):
            detail.append(f"확정공모가 {float(r['offerPrice']):,.0f}원")
        band = r.get("offerPriceBand")
        if isinstance(band, list) and len(band) == 2 and all(isinstance(x, (int, float)) for x in band):
            detail.append(f"희망공모가 {band[0]:,.0f}~{band[1]:,.0f}원")
        events.append(Event(
            stable_uid("kr-ipo", acc or co),
            f"[{label}] {co}",
            day=d,
            description=(", ".join(detail) + ". " if detail else "") + "출처: 38커뮤니케이션(38.co.kr). 투자 권유가 아닙니다.",
            url=str(r.get("link") or ""),
            categories=("IPO",),
        ))
    return events


def fetch_worker_calendar(url: str, timeout: int = 20) -> list[dict]:
    if not url:
        return []
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "mir-feeds/1.0", "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        rows = payload.get("calendar") if isinstance(payload, dict) else payload
        return rows if isinstance(rows, list) else []
    except Exception as exc:
        print(f"[feeds] 경제 캘린더(워커) 수집 실패 — FOMC·산업 지표만 싣는다: {exc}", file=sys.stderr)
        return []


def econ_events(data: Path, today: date, worker_rows: list[dict]) -> list[Event]:
    events: list[Event] = []
    fomc_days = set()
    for d1, d2, sep in FOMC_MEETINGS:
        day1, day2 = date.fromisoformat(d1), date.fromisoformat(d2)
        fomc_days.add(day2)
        if not in_window(day2, today):
            continue
        # 결정문 14:00 ET — 서머타임 여부는 zoneinfo 로 계산해 UTC 로 쓴다.
        start = datetime(day2.year, day2.month, day2.day, 14, 0, tzinfo=ET) if ET else None
        extra = " 경제전망(SEP·점도표) 함께 발표." if sep else ""
        kwargs = {"start": start, "end": start + timedelta(minutes=60)} if start else {"day": day2}
        events.append(Event(
            stable_uid("fomc", d2),
            "[FOMC] 미국 기준금리 결정 발표",
            description=(f"FOMC 정례회의 {day1.month}/{day1.day}~{day2.month}/{day2.day}(미 동부). 결정문 14:00 ET, "
                         f"기자회견 14:30 ET.{extra} 출처: 연준 공개 일정표 {FOMC_SOURCE}"),
            url=FOMC_SOURCE,
            categories=("FOMC", "미국"),
            **kwargs,
        ))

    # 경제지표(investing.com, 워커 ?calendar=1 — 이번 주·다음 주만 온다). 중요도 2 이상만.
    for r in worker_rows:
        try:
            imp = int(r.get("importance") or 0)
        except (TypeError, ValueError):
            imp = 0
        name = str(r.get("event") or "").strip()
        country = str(r.get("country") or "")
        if imp < 2 or not name or country not in ("한국", "미국"):
            continue
        dt_raw = str(r.get("datetime") or "")
        try:
            local = datetime.strptime(dt_raw, "%Y/%m/%d %H:%M:%S").replace(tzinfo=KST)
        except ValueError:
            continue
        timed = ":" in str(r.get("time") or "")
        d = local.date()
        if not in_window(d, today):
            continue
        # FOMC 결정일의 '연준 금리 결정'은 위의 공식 일정 이벤트와 겹친다.
        if country == "미국" and "금리" in name and "결정" in name and (d in fomc_days or d - timedelta(days=1) in fomc_days):
            continue
        level = "높음" if imp >= 3 else "보통"
        parts = []
        for key, lab in (("forecast", "예상"), ("previous", "이전"), ("actual", "실제")):
            v = str(r.get(key) or "").strip()
            if v:
                parts.append(f"{lab} {v}")
        desc = (" · ".join(parts) + ". " if parts else "") + (
            f"중요도 {level}. 한국 시간 기준. 출처: investing.com 경제 캘린더(수집 시점 값 — 예상·실제치는 "
            "캘린더 앱에서 자동 갱신되지 않을 수 있음)."
        )
        kwargs = {"start": local, "end": local + timedelta(minutes=30)} if timed else {"day": d}
        events.append(Event(
            stable_uid("econ", country, dt_raw[:10], name),
            f"[{country}·{level}] {name}",
            description=desc,
            url=f"{SITE_BASE}/index.html#calendar",
            categories=("경제지표", country),
            **kwargs,
        ))

    # 산업 선행지표 발표일(industry_calendar.json, KST 시각).
    ic = load_json(data / "industry_calendar.json") or {}
    for r in ic.get("events") or []:
        d = parse_day(r.get("date"))
        name = str(r.get("name_kr") or "").strip()
        if not d or not name or not in_window(d, today):
            continue
        tk = str(r.get("time_kst") or "")
        kwargs = {"day": d}
        try:
            hh, mm = (int(x) for x in tk.split(":")[:2])
            st = datetime(d.year, d.month, d.day, hh, mm, tzinfo=KST)
            kwargs = {"start": st, "end": st + timedelta(minutes=30)}
        except (ValueError, TypeError):
            pass
        note = str(r.get("note") or "").strip()
        events.append(Event(
            stable_uid("industry", r.get("id") or name, d.isoformat()),
            f"[지표] {name}",
            description=(note + ". " if note else "") + "산업 지표 발표 예정(한국 시간). 출처: Mir 산업 지표 캘린더.",
            url=f"{SITE_BASE}/index.html",
            categories=("산업지표",),
            **kwargs,
        ))
    return events


# ---------------------------------------------------------------------------
# RSS 2.0
# ---------------------------------------------------------------------------

class Item:
    __slots__ = ("title", "link", "guid", "day", "tz", "description", "category")

    def __init__(self, title, link, guid, day: date, tz, description="", category=""):
        self.title = title
        self.link = link
        self.guid = guid
        self.day = day
        self.tz = tz
        self.description = description
        self.category = category

    @property
    def pub(self) -> datetime:
        return datetime(self.day.year, self.day.month, self.day.day, tzinfo=self.tz)


def render_rss(title: str, desc: str, self_url: str, items: list[Item], now: datetime) -> str:
    items = sorted(items, key=lambda i: (i.pub.astimezone(timezone.utc), i.guid), reverse=True)[:RSS_MAX_ITEMS]
    out = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
        "<channel>",
        f"<title>{xml_escape(title)}</title>",
        f"<link>{xml_escape(SITE_BASE + '/')}</link>",
        f"<description>{xml_escape(desc)}</description>",
        "<language>ko</language>",
        f"<lastBuildDate>{format_datetime(now.astimezone(timezone.utc))}</lastBuildDate>",
        "<ttl>180</ttl>",
        f'<atom:link href="{xml_escape(self_url)}" rel="self" type="application/rss+xml"/>',
    ]
    seen = set()
    for it in items:
        if it.guid in seen:
            continue
        seen.add(it.guid)
        out.append("<item>")
        out.append(f"<title>{xml_escape(it.title)}</title>")
        if it.link:
            out.append(f"<link>{xml_escape(it.link)}</link>")
        out.append(f'<guid isPermaLink="false">{xml_escape(it.guid)}</guid>')
        out.append(f"<pubDate>{format_datetime(it.pub)}</pubDate>")
        if it.category:
            out.append(f"<category>{xml_escape(it.category)}</category>")
        if it.description:
            out.append(f"<description>{xml_escape(it.description)}</description>")
        out.append("</item>")
    out.append("</channel>")
    out.append("</rss>")
    return "\n".join(out) + "\n"


def us_8k_items(data: Path, names: dict) -> list[tuple[str, Item, bool]]:
    """(ticker, item, important) 목록. important = 빌더 hot 분류 또는 자사주 태그."""
    me = load_json(data / "material_events.json") or {}
    out = []
    for r in me.get("events") or []:
        d = parse_day(r.get("fileDate"))
        t = str(r.get("ticker") or "")
        if not d or not t:
            continue
        labels = [str(i.get("label") or i.get("code")) for i in (r.get("items") or [])
                  if isinstance(i, dict) and i.get("code") != "9.01"]
        important = bool(r.get("hot")) or r.get("kind") == "buyback"
        if r.get("kind") == "buyback":
            amt = r.get("amountUsd")
            labels.insert(0, f"자사주 매입 발표{f' ${amt / 1e9:.2f}B' if isinstance(amt, (int, float)) and amt >= 1e8 else ''}")
        co = names.get(t) or str(r.get("company") or "")
        label_txt = " · ".join(labels) or "8-K"
        out.append((t, Item(
            f"[8-K] {t} {label_txt}",
            str(r.get("link") or ""),
            f"sec-8k-{r.get('accession') or t + d.isoformat()}",
            d, ET or timezone.utc,
            f"{co} ({t}) 8-K 제출 {d.isoformat()}. 항목: {label_txt}. 공시 사실이며 투자 권유가 아닙니다. 출처: SEC EDGAR.",
            "8-K",
        ), important))
    return out


def us_13d_items(data: Path, names: dict, include_13g: bool = False) -> list[tuple[str, Item]]:
    ac = load_json(data / "activist_stakes.json") or {}
    out = []
    for r in ac.get("filings") or []:
        form = str(r.get("form") or "")
        if not include_13g and not form.startswith("13D"):
            continue
        d = parse_day(r.get("fileDate"))
        t = str(r.get("ticker") or "")
        if not d:
            continue
        co = names.get(t) or str(r.get("company") or "")
        filer = str(r.get("filer") or "")
        out.append((t, Item(
            f"[{form}] {t or co} — {filer}",
            str(r.get("link") or ""),
            f"sec-13dg-{r.get('accession') or (t + d.isoformat() + filer)}",
            d, ET or timezone.utc,
            f"{filer} 이(가) {co}{f' ({t})' if t else ''} 지분 5% 이상 보유 공시({form}, {r.get('kindLabel') or ''}). "
            "공시 사실이며 투자 권유가 아닙니다. 출처: SEC EDGAR.",
            form,
        )))
    return out


def kr_items(data: Path) -> list[tuple[str, Item, bool]]:
    kd = load_json(data / "kr_disclosures.json") or {}
    out = []
    for r in kd.get("disclosures") or []:
        d = parse_day(r.get("fileDate"))
        t = str(r.get("ticker") or "")
        title = " ".join(str(r.get("title") or "").split())
        if not d or not title:
            continue
        type_label = str(r.get("typeLabel") or "")
        important = type_label in KR_IMPORTANT_TYPES and not any(s in title for s in KR_TITLE_SKIP)
        co = str(r.get("company") or "")
        link = str(r.get("link") or "")
        rcp = link.rsplit("rcpNo=", 1)[-1] if "rcpNo=" in link else f"{t}-{d.isoformat()}-{title}"
        out.append((t, Item(
            f"[{type_label}] {co} — {title}",
            link,
            f"dart-{rcp}",
            d, KST,
            f"{co}({t}) {d.isoformat()} 공시: {title}. 공시 사실이며 투자 권유가 아닙니다. 출처: DART.",
            type_label,
        ), important))
    return out


# ---------------------------------------------------------------------------
# 조립
# ---------------------------------------------------------------------------

def build_all(root: Path, out: Path, *, now: datetime, worker_rows: list[dict], site_base: str = SITE_BASE,
              ticker_top: int = TICKER_FEED_TOP) -> dict:
    data = root / "data"
    today = now.astimezone(KST).date()
    feed_url = f"{site_base.rstrip('/')}/data/feeds"
    out.mkdir(parents=True, exist_ok=True)
    manifest = {
        "generatedAtKst": now.astimezone(KST).strftime("%Y-%m-%d %H:%M KST"),
        "windowDays": {"past": PAST_DAYS, "future": FUTURE_DAYS},
        "calendars": [],
        "rss": [],
        "tickers": {"us": [], "kr": []},
    }
    files: dict[str, str] = {}

    def add_cal(fid, market, title, desc, events):
        text = render_ics(f"Mir · {title}", desc, events, now)
        files[f"{fid}.ics"] = text
        manifest["calendars"].append({"id": fid, "market": market, "title": title, "desc": desc,
                                      "path": f"data/feeds/{fid}.ics", "count": text.count("BEGIN:VEVENT")})

    def add_rss(fid, market, title, desc, items, rel=None):
        rel = rel or f"{fid}.xml"
        text = render_rss(f"Mir · {title}", desc, f"{feed_url}/{rel}", items, now)
        files[rel] = text
        return {"id": fid, "market": market, "title": title, "desc": desc,
                "path": f"data/feeds/{rel}", "count": text.count("<item>")}

    add_cal("calendar-us", "us", "미국 일정",
            "시총 상위 실적 예정일·배당락일·IPO 가격확정·월간 옵션 만기", us_calendar_events(data, today))
    add_cal("calendar-kr", "kr", "국내 일정",
            "배당 기준일·지급일, 공모 청약·신규 상장", kr_calendar_events(data, today))
    add_cal("econ", "all", "경제 일정",
            "FOMC 금리 결정·한미 주요 경제지표·산업 지표 발표일(한국 시간)", econ_events(data, today, worker_rows))

    us_snap = load_json(data / "market_snapshot.json")
    kr_snap = load_json(data / "korea" / "market_snapshot.json")
    us_names = {str(r["ticker"]): str(r.get("company") or "") for r in (us_snap or {}).get("stocks") or []
                if isinstance(r, dict) and r.get("ticker")}

    k8 = us_8k_items(data, us_names)
    d13 = us_13d_items(data, us_names)
    krs = kr_items(data)
    manifest["rss"].append(add_rss("disclosures-us", "us", "미국 주요 공시(8-K)",
                                   "SEC 8-K 중 중요 항목(계약 체결·종료, 인수·처분, 실적, 상장폐지, 지배권·임원 변동, 자사주 등)",
                                   [it for _, it, imp in k8 if imp]))
    manifest["rss"].append(add_rss("activist-us", "us", "미국 액티비스트(13D)",
                                   "경영참여 목적 5% 이상 보유 공시(SCHEDULE 13D·13D/A)", [it for _, it in d13]))
    manifest["rss"].append(add_rss("disclosures-kr", "kr", "국내 주요 공시(DART)",
                                   "유상증자·CB/BW·최대주주 변동·자사주·소각·공급계약·주요사항보고 등",
                                   [it for _, it, imp in krs if imp]))

    # 종목별: 시총 상위 N 만(정적 호스팅이라 관심종목별 피드는 불가). 공시가 0건이어도 파일을
    # 만든다 — 구독한 URL 이 다음 배포에서 404 가 되지 않게.
    us_all13 = us_13d_items(data, us_names, include_13g=True)
    for row in top_tickers(us_snap, ticker_top, "us"):
        t = row["ticker"]
        items = [it for tk, it, _ in k8 if tk == t] + [it for tk, it in us_all13 if tk == t]
        safe = t.replace("/", "-")
        entry = add_rss(f"us-{safe}", "us", f"{t} 공시", f"{row['company']} ({t}) SEC 8-K·13D/13G",
                        items, rel=f"ticker/us-{safe}.xml")
        entry.update({"ticker": t, "company": row["company"]})
        manifest["tickers"]["us"].append(entry)
    for row in top_tickers(kr_snap, ticker_top, "kr"):
        t = row["ticker"]
        items = [it for tk, it, _ in krs if tk == t]
        entry = add_rss(f"kr-{t}", "kr", f"{row['company']} 공시", f"{row['company']}({t}) DART 공시 전체",
                        items, rel=f"ticker/kr-{t}.xml")
        entry.update({"ticker": t, "company": row["company"]})
        manifest["tickers"]["kr"].append(entry)

    total = sum(c["count"] for c in manifest["calendars"]) + sum(r["count"] for r in manifest["rss"])
    manifest["totalCount"] = total
    for rel, text in files.items():
        p = out / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        # .ics 는 CRLF 가 규격이다 — newline="" 로 그대로 쓴다.
        tmp = p.with_suffix(p.suffix + ".tmp")
        with open(tmp, "w", encoding="utf-8", newline="") as fh:
            fh.write(text)
        tmp.replace(p)
    (out / "feeds.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    manifest["bytes"] = sum(len(t.encode("utf-8")) for t in files.values())
    manifest["fileCount"] = len(files) + 1
    return manifest


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--root", type=Path, default=ROOT, help="data/ 를 담은 사이트 루트(배포에선 _site)")
    ap.add_argument("--out", type=Path, default=None, help="출력 폴더(기본 <root>/data/feeds)")
    ap.add_argument("--econ-url", default=WORKER_CALENDAR_URL, help="경제 캘린더 JSON URL(빈 값이면 건너뜀)")
    ap.add_argument("--site-base", default=SITE_BASE)
    ap.add_argument("--ticker-top", type=int, default=TICKER_FEED_TOP)
    args = ap.parse_args(argv)
    out = args.out or (args.root / "data" / "feeds")
    now = datetime.now(timezone.utc)
    worker_rows = fetch_worker_calendar(args.econ_url)
    m = build_all(args.root, out, now=now, worker_rows=worker_rows, site_base=args.site_base,
                  ticker_top=args.ticker_top)
    for c in m["calendars"] + m["rss"]:
        print(f"[feeds] {c['path']}: {c['count']}건")
    print(f"[feeds] 종목별 RSS US {len(m['tickers']['us'])}개 · KR {len(m['tickers']['kr'])}개, "
          f"파일 {m['fileCount']}개 {m['bytes'] / 1024:.0f}KB, 경제지표 원본 {len(worker_rows)}건")
    if m["totalCount"] == 0:
        print("[feeds] 전 피드 0건 — 입력 데이터가 모두 비었다", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
