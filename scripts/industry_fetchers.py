"""산업 선행지표 P0-b 무키 소스 파서 — build_industry_indicators.py 가 쓴다.

전부 키 없는 공식 JSON/CSV(xlsx 하나). 파서는 순수 함수(문자열/바이트 → [(날짜, 값)])로 두고
네트워크는 fetch_* 만 탄다 — 테스트는 파서만 오프라인으로 돈다.

소스별 함정(2026-09-18 실측):
- FRB(federalreserve.gov)·OFR·NRC 는 식별 UA 만 통과, Cboe CDN 은 브라우저 UA 필요.
- BoJ 는 gzip 을 Content-Encoding 없이 줄 수 있어 매직바이트로 해제한다.
- Census privsatime.xlsx 는 openpyxl 없이 zip+XML 로 읽는다(레포에 openpyxl 없음). 행은 최신월부터,
  날짜 셀은 'Jul-26p'(p=잠정, r=수정) 문자열.
- FiscalData TGA 마감 잔고는 `open_today_bal` 필드에 들어 있다(close_today_bal 은 null).
- IMF PCPS TIME_PERIOD 는 '2026-M08', BIS 는 '2026-07' / '2026-Q1'.
"""

from __future__ import annotations

import csv
import gzip
import io
import json
import re
import urllib.parse
import urllib.request
import zipfile
from datetime import date, datetime, timedelta, timezone

import sec_client as sec

UA_IDENT = {"User-Agent": "Mir US Stocks research (dydtjsdn@gmail.com)"}
UA_BROWSER = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
              "Accept": "application/json,text/csv,*/*"}
SDMX_CSV = {"Accept": "application/vnd.sdmx.data+csv;version=1.0.0", **UA_IDENT}
MONTHS = {m: i for i, m in enumerate(("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"), 1)}


def _num(v):
    try:
        n = float(str(v).replace(",", "").strip())
    except (TypeError, ValueError):
        return None
    return n if n == n and n not in (float("inf"), float("-inf")) else None


def _get(url: str, headers: dict, timeout: int = 45, label: str = "") -> bytes:
    raw = sec.http_get_with_backoff(url, headers=headers, timeout=timeout, label=label)
    if raw[:2] == b"\x1f\x8b":  # Content-Encoding 없이 gzip 본문을 주는 서버(BoJ)
        raw = gzip.decompress(raw)
    return raw


def parse_date_any(text: str) -> str | None:
    """'2026-09-16' | '09/16/2026' | '9/1/2026' | '2026-M08' | '2026M08' | '2026-Q1' | 'Jul-26p' → 정규 키."""
    t = str(text or "").strip()
    if not t:
        return None
    m = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", t)
    if m:
        return t
    m = re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{4})", t)
    if m:
        return f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"
    m = re.fullmatch(r"(\d{4})-?M(\d{2})", t)
    if m:
        return f"{m.group(1)}-{m.group(2)}"
    m = re.fullmatch(r"(\d{4})-Q([1-4])", t)
    if m:
        return t
    m = re.fullmatch(r"(\d{4})-(\d{2})", t)
    if m:
        return t
    m = re.fullmatch(r"([A-Za-z]{3})-(\d{2})[pr]?", t)
    if m and m.group(1).lower() in MONTHS:
        return f"20{m.group(2)}-{MONTHS[m.group(1).lower()]:02d}"
    m = re.fullmatch(r"(\d{6})", t)
    if m:
        return f"{t[:4]}-{t[4:]}"
    return None


# ---------------------------------------------------------------------------
# CSV 계열 (OFR FSI · FRB EBP/FCI-G · Cboe 히스토리 · IMF/BIS SDMX)
# ---------------------------------------------------------------------------
def parse_csv_series(text: str, date_col: str, value_col: str | None, *, monthly: bool = False) -> list[tuple[str, float]]:
    """DictReader 로 읽어 (날짜, 값). value_col=None 이면 마지막 열(Cboe SKEW 처럼 열 이름이 심볼)."""
    out: dict[str, float] = {}
    rows = csv.DictReader(io.StringIO(text.lstrip("﻿")))
    for row in rows:
        d = parse_date_any(row.get(date_col))
        if not d:
            continue
        col = value_col if value_col is not None else list(row.keys())[-1]
        v = _num(row.get(col))
        if v is None:
            continue
        if monthly and len(d) == 10:
            d = d[:7]
        out[d] = v
    return sorted(out.items())


def fetch_csv(url: str, date_col: str, value_col: str | None, *, ua: str = "ident", monthly: bool = False, label: str = "") -> list[tuple[str, float]]:
    raw = _get(url, UA_BROWSER if ua == "browser" else UA_IDENT, label=label or url)
    return parse_csv_series(raw.decode("utf-8-sig", "replace"), date_col, value_col, monthly=monthly)


def fetch_sdmx_csv(url: str, *, label: str = "") -> list[tuple[str, float]]:
    raw = _get(url, SDMX_CSV, label=label or url)
    return parse_csv_series(raw.decode("utf-8-sig", "replace"), "TIME_PERIOD", "OBS_VALUE")


def imf_pcps_url(code: str, start: str = "2005-01") -> str:
    return f"https://api.imf.org/external/sdmx/2.1/data/IMF.RES,PCPS/G001.{code}.USD.M?startPeriod={start}"


def bis_url(flow: str, key: str, n: int = 200) -> str:
    return f"https://stats.bis.org/api/v2/data/dataflow/BIS/{flow}/1.0/{key}?lastNObservations={n}"


# ---------------------------------------------------------------------------
# JSON 계열
# ---------------------------------------------------------------------------
def parse_boj(payload: dict, code: str) -> list[tuple[str, float]]:
    for s in payload.get("RESULTSET") or []:
        if s.get("SERIES_CODE") != code:
            continue
        dates = (s.get("VALUES") or {}).get("SURVEY_DATES") or []
        vals = (s.get("VALUES") or {}).get("VALUES") or []
        out = []
        for d, v in zip(dates, vals):
            n = _num(v)
            k = parse_date_any(str(d))
            if n is not None and k:
                out.append((k, n))
        return sorted(out)
    return []


def fetch_boj(code: str, start: str = "201001") -> list[tuple[str, float]]:
    end = datetime.now(timezone.utc).strftime("%Y12")
    url = ("https://www.stat-search.boj.or.jp/api/v1/getDataCode?format=json&lang=en&db=PR01"
           f"&startDate={start}&endDate={end}&code={code}")
    raw = _get(url, {**UA_IDENT, "Accept-Encoding": "gzip"}, label=f"BoJ {code}")
    return parse_boj(json.loads(raw.decode("utf-8")), code)


def parse_tga(payload: dict) -> list[tuple[str, float]]:
    """FiscalData TGA — 백만$ → 조$."""
    out = []
    for r in payload.get("data") or []:
        v = _num(r.get("open_today_bal"))
        d = parse_date_any(r.get("record_date"))
        if v is not None and d:
            out.append((d, v / 1e6))
    return sorted(out)


def fetch_tga(days: int = 3660) -> list[tuple[str, float]]:
    since = (datetime.now(timezone.utc).date() - timedelta(days=days)).isoformat()
    q = urllib.parse.urlencode({
        "sort": "-record_date", "page[size]": "10000",
        "filter": f"account_type:eq:Treasury General Account (TGA) Closing Balance,record_date:gte:{since}",
        "fields": "record_date,open_today_bal",
    })
    url = f"https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/operating_cash_balance?{q}"
    return parse_tga(json.loads(_get(url, UA_IDENT, label="FiscalData TGA").decode("utf-8")))


def parse_defillama_stablecoins(rows: list) -> list[tuple[str, float]]:
    """일별 총 유통량(peggedUSD) → 십억$."""
    out = []
    for r in rows or []:
        ts = _num(r.get("date"))
        v = _num(((r.get("totalCirculatingUSD") or {}).get("peggedUSD")))
        if ts is None or v is None:
            continue
        out.append((datetime.fromtimestamp(ts, tz=timezone.utc).date().isoformat(), v / 1e9))
    return sorted(out)


def fetch_defillama_stablecoins() -> list[tuple[str, float]]:
    raw = _get("https://stablecoins.llama.fi/stablecoincharts/all", UA_IDENT, label="DefiLlama stablecoins")
    return parse_defillama_stablecoins(json.loads(raw.decode("utf-8")))


def parse_deribit_dvol(payload: dict) -> list[tuple[str, float]]:
    out = []
    for row in ((payload.get("result") or {}).get("data") or []):
        if len(row) < 5:
            continue
        ts, close = _num(row[0]), _num(row[4])
        if ts is None or close is None:
            continue
        out.append((datetime.fromtimestamp(ts / 1000, tz=timezone.utc).date().isoformat(), close))
    return sorted(dict(out).items())


def fetch_deribit_dvol(currency: str = "BTC") -> list[tuple[str, float]]:
    end = int(datetime.now(timezone.utc).timestamp() * 1000)
    start = int(datetime(2021, 3, 24, tzinfo=timezone.utc).timestamp() * 1000)
    url = ("https://www.deribit.com/api/v2/public/get_volatility_index_data"
           f"?currency={currency}&start_timestamp={start}&end_timestamp={end}&resolution=1D")
    payload = json.loads(_get(url, UA_IDENT, label=f"Deribit DVOL {currency}").decode("utf-8"))
    rows = parse_deribit_dvol(payload)
    # API 가 최근 1,000봉 안팎으로 자르면 그대로 쓴다(일간 750점 상한이 있어 충분하다).
    return rows


def parse_altme_fng(payload: dict) -> list[tuple[str, float]]:
    out = []
    for r in payload.get("data") or []:
        ts, v = _num(r.get("timestamp")), _num(r.get("value"))
        if ts is None or v is None:
            continue
        out.append((datetime.fromtimestamp(ts, tz=timezone.utc).date().isoformat(), v))
    return sorted(dict(out).items())


def fetch_altme_fng() -> list[tuple[str, float]]:
    raw = _get("https://api.alternative.me/fng/?limit=0&format=json", UA_IDENT, label="alternative.me F&G")
    return parse_altme_fng(json.loads(raw.decode("utf-8")))


def parse_cboe_putcall(payload: dict, name: str = "EQUITY PUT/CALL RATIO") -> float | None:
    for r in payload.get("ratios") or []:
        if str(r.get("name", "")).strip().upper() == name:
            return _num(r.get("value"))
    return None


def fetch_cboe_putcall_recent(days: int = 7) -> list[tuple[str, float]]:
    """최근 N일의 일별 파일을 하나씩 받는다(없는 날=휴장 404 는 건너뜀). 적립은 호출부."""
    out = []
    today = datetime.now(timezone.utc).date()
    for i in range(days):
        d = today - timedelta(days=i)
        if d.weekday() >= 5:
            continue
        url = f"https://cdn.cboe.com/data/us/options/market_statistics/daily/{d.isoformat()}_daily_options"
        try:
            payload = json.loads(_get(url, UA_BROWSER, timeout=30, label=f"Cboe P/C {d}").decode("utf-8"))
        except Exception:
            continue
        v = parse_cboe_putcall(payload)
        if v is not None:
            out.append((d.isoformat(), v))
    return sorted(out)


# ---------------------------------------------------------------------------
# NRC 원자로 출력 (텍스트) · Census 건설지출 (xlsx)
# ---------------------------------------------------------------------------
def parse_nrc_power(text: str) -> list[tuple[str, float]]:
    """ReportDt|Unit|Power → 날짜별 전 호기 평균 출력(%)."""
    by_day: dict[str, list[float]] = {}
    for line in text.splitlines()[1:]:
        parts = line.split("|")
        if len(parts) < 3:
            continue
        m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", parts[0].strip())
        v = _num(parts[2])
        if not m or v is None:
            continue
        d = f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"
        by_day.setdefault(d, []).append(v)
    return sorted((d, sum(v) / len(v)) for d, v in by_day.items() if v)


def fetch_nrc_power() -> list[tuple[str, float]]:
    url = "https://www.nrc.gov/reading-rm/doc-collections/event-status/reactor-status/powerreactorstatusforlast365days.txt"
    return parse_nrc_power(_get(url, UA_IDENT, label="NRC reactor status").decode("utf-8", "replace"))


def xlsx_first_sheet_rows(data: bytes) -> list[list[str]]:
    """openpyxl 없이 첫 시트를 문자열 행렬로. 공유문자열·inline·숫자 셀만(수식 결과는 <v>)."""
    z = zipfile.ZipFile(io.BytesIO(data))
    shared: list[str] = []
    if "xl/sharedStrings.xml" in z.namelist():
        ss = z.read("xl/sharedStrings.xml").decode("utf-8")
        shared = [re.sub(r"<[^>]+>", "", s) for s in re.findall(r"<si>(.*?)</si>", ss, re.S)]
    sheet = z.read("xl/worksheets/sheet1.xml").decode("utf-8")
    rows: list[list[str]] = []
    for row_xml in re.findall(r"<row [^>]*>(.*?)</row>", sheet, re.S):
        cells: dict[int, str] = {}
        for ref, typ, val in re.findall(r'<c r="([A-Z]+)\d+"(?:[^>]*?t="(\w+)")?[^>]*>(?:<v>([^<]*)</v>)?', row_xml):
            col = 0
            for ch in ref:
                col = col * 26 + (ord(ch) - 64)
            text = shared[int(val)] if typ == "s" and val.isdigit() and int(val) < len(shared) else val
            cells[col - 1] = text
        width = max(cells) + 1 if cells else 0
        rows.append([cells.get(i, "") for i in range(width)])
    return rows


def parse_census_c30(rows: list[list[str]], column: str = "Data center") -> list[tuple[str, float]]:
    """privsatime.xlsx 'Private SA' — 백만$ 연율 → 십억$."""
    header_i = next((i for i, r in enumerate(rows) if "Date" in r and column in r), None)
    if header_i is None:
        return []
    ci = rows[header_i].index(column)
    out = []
    for r in rows[header_i + 1:]:
        if len(r) <= ci:
            continue
        d = parse_date_any(r[0])
        v = _num(r[ci])
        if d and len(d) == 7 and v is not None:
            out.append((d, v / 1e3))
    return sorted(dict(out).items())


def fetch_census_c30(column: str = "Data center") -> list[tuple[str, float]]:
    raw = _get("https://www.census.gov/construction/c30/xlsx/privsatime.xlsx", UA_IDENT, timeout=60, label="Census C30")
    return parse_census_c30(xlsx_first_sheet_rows(raw), column)
