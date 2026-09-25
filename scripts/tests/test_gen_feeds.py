"""구독 피드(gen_feeds.py) 형식 검증 — RFC 5545 iCalendar + RSS 2.0.

네트워크 없이 작은 가짜 data/ 를 만들어 전체 생성 경로를 돌리고, 출력 파일을 규격 관점에서
검사한다(줄 접기 75 옥텟·CRLF·이스케이프·UID 유일성·종일/시각 이벤트 형식·RSS 필수 요소).

실행: py -m pytest -q scripts/tests/test_gen_feeds.py
"""
from __future__ import annotations

import json
import xml.etree.ElementTree as ET
from datetime import date, datetime, timezone
from email.utils import parsedate_to_datetime

import pytest

import gen_feeds as gf

NOW = datetime(2026, 9, 25, 3, 0, tzinfo=timezone.utc)  # KST 2026-09-25 12:00


def _write(root, rel, payload):
    p = root / "data" / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


@pytest.fixture
def site(tmp_path):
    root = tmp_path / "site"
    _write(root, "market_snapshot.json", {"stocks": [
        {"ticker": "NVDA", "company": "NVIDIA Corporation", "sector": "TECHNOLOGY", "marketCapB": 5000},
        {"ticker": "AAPL", "company": "Apple Inc.", "sector": "TECHNOLOGY", "marketCapB": 4000},
        {"ticker": "SPY", "company": "SPDR S&P 500", "sector": "EXCHANGE TRADED FUNDS", "marketCapB": 9000},
    ]})
    _write(root, "korea/market_snapshot.json", {"stocks": [
        {"ticker": "005930", "company": "삼성전자", "sector": "기술", "market": "kospi", "marketCapB": 1600},
        {"ticker": "069500", "company": "KODEX 200", "sector": "ETF", "market": "etf", "marketCapB": 90},
    ]})
    _write(root, "earnings_calendar.json", {"earnings": [
        {"ticker": "NVDA", "nextDate": "2026-11-17"},
        {"ticker": "ZZZZ", "nextDate": "2026-10-01"},          # 시총 상위 밖 → 제외
        {"ticker": "AAPL", "nextDate": "2027-06-01"},          # 90일 창 밖 → 제외
    ]})
    _write(root, "us_calendar.json", {"stocks": {
        "AAPL": {"exDate": "2026-10-05", "divRate": 1.08, "nextEarnings": "2026-10-29"},
    }})
    _write(root, "ipo_calendar.json", {"ipos": [
        {"company": "Foo, Inc.; Bar", "ticker": "FOO", "stage": "priced", "form": "424B4",
         "fileDate": "2026-09-22", "accession": "0001:424B4", "link": "https://www.sec.gov/x", "offerPrice": 15.0},
        {"company": "Old Co", "stage": "priced", "fileDate": "2026-08-01", "accession": "0002"},  # 과거 7일 밖
    ]})
    _write(root, "korea/dividends.json", {"rows": [
        # 정정 공시: 같은 기준일의 늦은 공시(지급일 10-20)만 남아야 한다.
        {"divKind": "분기배당", "dps": 300.0, "yieldPct": 6.0, "recordDate": "2026-09-30", "payDate": "2026-10-13",
         "ticker": "008370", "company": "원풍", "date": "2026-09-14", "link": "https://dart/1"},
        {"divKind": "분기배당", "dps": 300.0, "yieldPct": 6.0, "recordDate": "2026-09-30", "payDate": "2026-10-20",
         "ticker": "008370", "company": "원풍", "date": "2026-09-15", "link": "https://dart/2"},
    ]})
    _write(root, "korea/ipo_calendar.json", {"ipos": [
        {"company": "바로팜", "stage": "filed", "form": "미래에셋증권", "fileDate": "2026.11.02",
         "accession": "kr-ipo-bidding-바로팜", "link": "http://www.38.co.kr/", "offerPriceBand": [16400, 20200]},
    ]})
    _write(root, "industry_calendar.json", {"events": [
        {"id": "h8", "name_kr": "은행 대출 (H.8)", "date": "2026-09-30", "time_kst": "05:30", "note": "매주"},
    ]})
    _write(root, "material_events.json", {"events": [
        {"ticker": "NVDA", "company": "NVIDIA", "items": [{"code": "1.01", "label": "중요계약 체결"},
                                                         {"code": "9.01", "label": "재무제표·첨부"}],
         "hot": True, "fileDate": "2026-09-24", "accession": "A1", "link": "https://sec/a1"},
        {"ticker": "AAPL", "company": "Apple", "items": [{"code": "8.01", "label": "기타 주요 이벤트"}],
         "hot": False, "fileDate": "2026-09-23", "accession": "A2", "link": "https://sec/a2"},
    ]})
    _write(root, "activist_stakes.json", {"filings": [
        {"ticker": "AAPL", "company": "Apple", "filer": "Icahn <Carl> & Co", "form": "13D", "kindLabel": "경영참여",
         "fileDate": "2026-09-20", "accession": "D1", "link": "https://sec/d1"},
        {"ticker": "NVDA", "company": "NVIDIA", "filer": "Vanguard", "form": "13G/A", "kindLabel": "단순투자",
         "fileDate": "2026-09-21", "accession": "G1", "link": "https://sec/g1"},
    ]})
    _write(root, "kr_disclosures.json", {"disclosures": [
        {"ticker": "005930", "company": "삼성전자", "title": "주요사항보고서(자기주식취득결정)", "typeLabel": "주요사항보고",
         "fileDate": "2026-09-23", "link": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=1"},
        {"ticker": "005930", "company": "삼성전자", "title": "임원ㆍ주요주주특정증권등소유상황보고서",
         "typeLabel": "임원·주요주주 소유보고", "fileDate": "2026-09-22",
         "link": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=2"},
        {"ticker": "000001", "company": "가나", "title": "유동성공급계약의체결", "typeLabel": "공급계약",
         "fileDate": "2026-09-22", "link": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=3"},
    ]})
    return root


WORKER_ROWS = [
    {"datetime": "2026/09/29 23:00:00", "time": "23:00", "country": "미국", "importance": 3,
     "event": "CB 소비자신뢰지수 (9월)", "forecast": "95.0", "previous": "97.4", "actual": ""},
    {"datetime": "2026/09/30 00:00:00", "time": "종일", "country": "한국", "importance": 2,
     "event": "한국 - 추석", "forecast": "", "previous": "", "actual": ""},
    {"datetime": "2026/09/29 10:00:00", "time": "10:00", "country": "미국", "importance": 1,
     "event": "중요도 낮음", "forecast": "", "previous": "", "actual": ""},
    {"datetime": "2026/10/29 03:00:00", "time": "03:00", "country": "미국", "importance": 3,
     "event": "연준 금리 결정", "forecast": "", "previous": "", "actual": ""},  # FOMC 공식 이벤트와 중복
]


@pytest.fixture
def built(site, tmp_path, no_network):
    out = tmp_path / "feeds"
    manifest = gf.build_all(site, out, now=NOW, worker_rows=WORKER_ROWS, ticker_top=5)
    return out, manifest


# --- iCalendar 규격 ----------------------------------------------------------

def _unfold(raw: str) -> list[str]:
    assert raw.endswith("\r\n")
    physical = raw.split("\r\n")[:-1]
    logical: list[str] = []
    for line in physical:
        if line.startswith(" "):
            logical[-1] += line[1:]
        else:
            logical.append(line)
    return logical


def _events(raw: str) -> list[dict]:
    evs, cur = [], None
    for line in _unfold(raw):
        if line == "BEGIN:VEVENT":
            cur = {}
        elif line == "END:VEVENT":
            evs.append(cur)
            cur = None
        elif cur is not None:
            name, _, value = line.partition(":")
            cur[name] = value
    return evs


@pytest.mark.parametrize("name", ["calendar-us.ics", "calendar-kr.ics", "econ.ics"])
def test_ics_structure(built, name):
    out, _ = built
    raw = (out / name).read_bytes().decode("utf-8")
    # CRLF 만 쓰고, 물리적 줄은 모두 75 옥텟 이하.
    assert "\n" not in raw.replace("\r\n", "")
    for line in raw.split("\r\n"):
        assert len(line.encode("utf-8")) <= 75, line
    lines = _unfold(raw)
    assert lines[0] == "BEGIN:VCALENDAR" and lines[-1] == "END:VCALENDAR"
    assert "VERSION:2.0" in lines and any(l.startswith("PRODID:") for l in lines)
    assert lines.count("BEGIN:VEVENT") == lines.count("END:VEVENT")
    evs = _events(raw)
    assert evs, name
    uids = [e["UID"] for e in evs]
    assert len(uids) == len(set(uids))
    for e in evs:
        assert e["DTSTAMP"].endswith("Z") and len(e["DTSTAMP"]) == 16
        assert "SUMMARY" in e
        if "DTSTART;VALUE=DATE" in e:
            s = date(int(e["DTSTART;VALUE=DATE"][:4]), int(e["DTSTART;VALUE=DATE"][4:6]), int(e["DTSTART;VALUE=DATE"][6:]))
            en = e["DTEND;VALUE=DATE"]
            assert (date(int(en[:4]), int(en[4:6]), int(en[6:])) - s).days == 1
        else:
            assert e["DTSTART"].endswith("Z") and e["DTEND"].endswith("Z")
            assert e["DTEND"] > e["DTSTART"]


def test_fold_line_keeps_multibyte_and_roundtrips():
    line = "SUMMARY:" + "가나다라마바사아자차카타파하" * 8
    folded = gf.fold_line(line)
    parts = folded.split("\r\n")
    assert len(parts) > 1
    assert all(len(p.encode("utf-8")) <= 75 for p in parts)
    assert all(p.startswith(" ") for p in parts[1:])
    assert parts[0] + "".join(p[1:] for p in parts[1:]) == line
    assert gf.fold_line("SHORT:x") == "SHORT:x"


def test_ics_escape():
    assert gf.ics_escape("a,b;c\\d\ne") == "a\\,b\\;c\\\\d\\ne"


def test_us_calendar_content(built):
    out, _ = built
    evs = _events((out / "calendar-us.ics").read_bytes().decode("utf-8"))
    summaries = [e["SUMMARY"] for e in evs]
    assert any(s.startswith("[실적] NVDA") for s in summaries)
    assert not any("ZZZZ" in s for s in summaries)             # 시총 상위 밖
    assert any(s.startswith("[실적] AAPL") for s in summaries)  # us_calendar 폴백(2026-10-29)
    assert any(s.startswith("[배당락] AAPL") for s in summaries)
    ipo = [s for s in summaries if s.startswith("[IPO")]
    assert ipo == ["[IPO 가격확정] Foo\\, Inc.\\; Bar (FOO)"]    # 이스케이프 + 과거 7일 창
    opex = sorted(e["DTSTART;VALUE=DATE"] for e in evs if e["SUMMARY"].startswith("[옵션"))
    assert opex == ["20260918", "20261016", "20261120", "20261218"]


def test_kr_calendar_dedups_corrected_dividend(built):
    out, _ = built
    evs = _events((out / "calendar-kr.ics").read_bytes().decode("utf-8"))
    pay = [e for e in evs if e["SUMMARY"] == "[배당지급] 원풍"]
    assert len(pay) == 1 and pay[0]["DTSTART;VALUE=DATE"] == "20261020"
    assert len([e for e in evs if e["SUMMARY"] == "[배당기준일] 원풍"]) == 1
    assert any(e["SUMMARY"] == "[공모 청약 시작] 바로팜" for e in evs)


def test_econ_calendar(built):
    out, _ = built
    evs = _events((out / "econ.ics").read_bytes().decode("utf-8"))
    fomc = sorted(e["DTSTART"] for e in evs if e["SUMMARY"] == "[FOMC] 미국 기준금리 결정 발표")
    assert fomc == ["20261028T180000Z", "20261209T190000Z"]    # 14:00 EDT / 14:00 EST
    by = {e["SUMMARY"]: e for e in evs}
    assert by["[미국·높음] CB 소비자신뢰지수 (9월)"]["DTSTART"] == "20260929T140000Z"  # 23:00 KST
    assert by["[한국·보통] 한국 - 추석"]["DTSTART;VALUE=DATE"] == "20260930"      # 시각 없는 행 = 종일
    assert "[미국·보통] 중요도 낮음" not in by and not any("중요도 낮음" in s for s in by)
    assert not any("연준 금리 결정" in s for s in by)            # FOMC 중복 제거
    assert by["[지표] 은행 대출 (H.8)"]["DTSTART"] == "20260929T203000Z"


def test_opex_holiday_rules():
    assert gf.monthly_opex(2026, 6) == date(2026, 6, 18)   # 준틴스(금) → 목
    assert gf.monthly_opex(2025, 4) == date(2025, 4, 17)   # 성금요일 → 목
    assert gf.monthly_opex(2026, 10) == date(2026, 10, 16)
    assert gf.easter(2026) == date(2026, 4, 5)


def test_fomc_table_sane():
    days = [date.fromisoformat(d2) for _, d2, _ in gf.FOMC_MEETINGS]
    assert days == sorted(days)
    for d1, d2, _ in gf.FOMC_MEETINGS:
        a, b = date.fromisoformat(d1), date.fromisoformat(d2)
        assert (b - a).days == 1 and b.weekday() == 2  # 화~수 회의, 수요일 결정


# --- RSS 2.0 ---------------------------------------------------------------

def _rss(path):
    root = ET.parse(path).getroot()
    assert root.tag == "rss" and root.get("version") == "2.0"
    ch = root.find("channel")
    for tag in ("title", "link", "description"):
        assert (ch.findtext(tag) or "").strip(), tag
    self_link = ch.find("{http://www.w3.org/2005/Atom}link")
    assert self_link is not None and self_link.get("rel") == "self"
    items = ch.findall("item")
    guids = [i.findtext("guid") for i in items]
    assert len(guids) == len(set(guids))
    for i in items:
        assert i.findtext("title")
        parsedate_to_datetime(i.findtext("pubDate"))  # RFC 822 형식
    return ch, items


def test_rss_market_feeds(built):
    out, _ = built
    _, us = _rss(out / "disclosures-us.xml")
    assert [i.findtext("guid") for i in us] == ["sec-8k-A1"]   # hot 만, 9.01 라벨 제외
    assert "재무제표" not in us[0].findtext("title")
    _, act = _rss(out / "activist-us.xml")
    assert [i.findtext("guid") for i in act] == ["sec-13dg-D1"]  # 13G 제외
    assert "Icahn <Carl> & Co" in act[0].findtext("title")       # XML 이스케이프 왕복
    _, kr = _rss(out / "disclosures-kr.xml")
    assert [i.findtext("guid") for i in kr] == ["dart-1"]         # 중요 유형만, 유동성공급계약 제외


def test_ticker_feeds_and_manifest(built):
    out, manifest = built
    assert [t["ticker"] for t in manifest["tickers"]["us"]] == ["NVDA", "AAPL"]   # ETF 제외
    assert [t["ticker"] for t in manifest["tickers"]["kr"]] == ["005930"]
    _, nv = _rss(out / "ticker" / "us-NVDA.xml")
    assert {i.findtext("guid") for i in nv} == {"sec-8k-A1", "sec-13dg-G1"}      # 종목별은 13G 포함
    _, ss = _rss(out / "ticker" / "kr-005930.xml")
    assert len(ss) == 2                                                          # 종목별은 전 유형
    m = json.loads((out / "feeds.json").read_text(encoding="utf-8"))
    for entry in m["calendars"] + m["rss"] + m["tickers"]["us"] + m["tickers"]["kr"]:
        assert entry["path"].startswith("data/feeds/")
        assert (out / entry["path"][len("data/feeds/"):]).exists()
    assert m["generatedAtKst"].endswith("KST")


def test_missing_inputs_do_not_crash(tmp_path, no_network):
    root = tmp_path / "empty"
    (root / "data").mkdir(parents=True)
    m = gf.build_all(root, tmp_path / "out", now=NOW, worker_rows=[])
    # 규칙 기반(FOMC·옵션 만기)만 남는다.
    assert m["totalCount"] > 0
    assert (tmp_path / "out" / "econ.ics").exists()
