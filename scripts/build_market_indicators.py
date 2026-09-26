#!/usr/bin/env python3
"""시장지표 (build_market_indicators.py)
======================================

시장 탭 '시장지표' 서브탭의 데이터. 원자재 선물·해외 지수·지수 선물·코스피200·환율 크로스·
주요국 국채 10년·기준금리를 한 파일로 모은다. 브라우저는 이 파일만 읽는다(실시간 조회 없음).

소스(전부 무료·무키, 한국 국고채만 ECOS 키가 있으면 직접 조회):
* 야후 v8 chart(3개월 일봉) — 원자재 선물 20종(만기월은 meta.shortName), 해외 지수 7개,
  지수 선물 4개, 코스피200(^KS200), 환율 크로스(KRW=X·EURKRW·JPYKRW·CNYKRW).
  환율이 야후에서 실패하면 frankfurter(ECB 기준율, 하루 1회)로 대신한다.
* 국채 10년: 미국 FRED DGS10 · 한국 ECOS 817Y002(키 없으면 data/korea/ecos_macro.json 의 값 재사용)
  · 일본 재무성 jgbcme.csv(+jgbcme_all.csv) · 독일 Bundesbank BBSIS · 영국 BoE IADB IUDMNPY.
  독일·영국·일본 일간 소스가 실패하면 FRED OECD 월간(IRLTLT01*M156N)으로 대신하고 freq="월간"으로 표시한다.
* 기준금리: BIS WS_CBPOL(SDMX CSV, 일간) — 미국·한국·일본·유로·영국·중국.

실패 처리: 이번에 못 받은 항목은 직전 파일의 값을 그대로 두고 stale=true(기준일은 원래 값의
기준일 그대로)로 표시한다. 전부 실패하면 파일을 건드리지 않고 exit 1.

산출물: data/market_indicators.json + .js(window.MARKET_INDICATORS)
실행:  py scripts/build_market_indicators.py [--push]
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

OUT_JSON = ROOT / "data" / "market_indicators.json"
OUT_JS = ROOT / "data" / "market_indicators.js"
ECOS_MACRO = ROOT / "data" / "korea" / "ecos_macro.json"
KST = timezone(timedelta(hours=9))
UA_BROWSER = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"}
UA_IDENT = {"User-Agent": "Mir US Stocks research (dydtjsdn@gmail.com)"}
SPARK_DAYS = 92  # 스파크라인: 최근 약 3개월 일별

# (id, 야후 심볼, 한국어 이름, 단위[센트 호가면 USX 확인], 그룹)
FUTURES = [
    ("CL", "CL=F", "WTI 원유", "달러/배럴", "energy"),
    ("BZ", "BZ=F", "브렌트유", "달러/배럴", "energy"),
    ("NG", "NG=F", "천연가스", "달러/MMBtu", "energy"),
    ("RB", "RB=F", "휘발유(RBOB)", "달러/갤런", "energy"),
    ("HO", "HO=F", "난방유", "달러/갤런", "energy"),
    ("GC", "GC=F", "금", "달러/트로이온스", "metals"),
    ("SI", "SI=F", "은", "달러/트로이온스", "metals"),
    ("HG", "HG=F", "구리", "달러/파운드", "metals"),
    ("PL", "PL=F", "백금", "달러/트로이온스", "metals"),
    ("PA", "PA=F", "팔라듐", "달러/트로이온스", "metals"),
    ("ALI", "ALI=F", "알루미늄", "달러/톤", "metals"),
    ("ZC", "ZC=F", "옥수수", "센트/부셸", "agri"),
    ("ZW", "ZW=F", "소맥", "센트/부셸", "agri"),
    ("ZS", "ZS=F", "대두", "센트/부셸", "agri"),
    ("KC", "KC=F", "커피", "센트/파운드", "agri"),
    ("SB", "SB=F", "설탕", "센트/파운드", "agri"),
    ("CC", "CC=F", "코코아", "달러/톤", "agri"),
    ("CT", "CT=F", "면화", "센트/파운드", "agri"),
    ("LE", "LE=F", "생우", "센트/파운드", "agri"),
    ("HE", "HE=F", "돈육", "센트/파운드", "agri"),
]
INDICES = [
    ("KS200", "^KS200", "코스피200", "pt", "korea"),
    ("N225", "^N225", "니케이225", "pt", "global"),
    ("HSI", "^HSI", "항셍", "pt", "global"),
    ("GDAXI", "^GDAXI", "독일 DAX", "pt", "global"),
    ("FTSE", "^FTSE", "영국 FTSE100", "pt", "global"),
    ("SOX", "^SOX", "필라델피아 반도체", "pt", "global"),
    ("DJT", "^DJT", "다우 운송", "pt", "global"),
    ("NDX", "^NDX", "나스닥100", "pt", "global"),
    ("ES", "ES=F", "S&P500 선물", "pt", "futures"),
    ("NQ", "NQ=F", "나스닥100 선물", "pt", "futures"),
    ("YM", "YM=F", "다우 선물", "pt", "futures"),
    ("RTY", "RTY=F", "러셀2000 선물", "pt", "futures"),
]
# (id, 야후 심볼, 이름, 단위, 배수, frankfurter 기준 통화)
FX = [
    ("USDKRW", "KRW=X", "달러/원", "원", 1, "USD"),
    ("EURKRW", "EURKRW=X", "유로/원", "원", 1, "EUR"),
    ("JPYKRW", "JPYKRW=X", "엔/원(100엔)", "원", 100, "JPY"),
    ("CNYKRW", "CNYKRW=X", "위안/원", "원", 1, "CNY"),
]
BONDS = [
    ("US10Y", "미국", "FRED DGS10"),
    ("KR10Y", "한국", "한국은행 ECOS"),
    ("JP10Y", "일본", "일본 재무성"),
    ("DE10Y", "독일", "독일연방은행"),
    ("GB10Y", "영국", "영란은행"),
]
BOND_FRED_MONTHLY = {"JP10Y": "IRLTLT01JPM156N", "DE10Y": "IRLTLT01DEM156N", "GB10Y": "IRLTLT01GBM156N"}
POLICY = [
    ("US", "미국", "연준"),
    ("KR", "한국", "한국은행"),
    ("JP", "일본", "일본은행"),
    ("XM", "유로존", "ECB"),
    ("GB", "영국", "영란은행"),
    ("CN", "중국", "인민은행(LPR 1년)"),
]
# 요약 카드(4열×3행)
CARDS = ["KS200", "ES", "NQ", "N225", "USDKRW", "EURKRW", "JPYKRW", "CL", "GC", "HG", "US10Y", "KR10Y"]

MONTHS = {m: i + 1 for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}


# ---------------------------------------------------------------------------
# 순수 함수(테스트 대상)
# ---------------------------------------------------------------------------
def _num(v):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if f == f and f not in (float("inf"), float("-inf")) else None


def contract_month(short_name: str | None, as_of: str | None = None) -> str | None:
    """야후 shortName 의 만기월 → 'YYYY-MM'. 'Crude Oil Nov 26' · 'Aluminum Futures,Dec-2026'.

    shortName 은 32자에서 잘린다('Wheat Futures,Dec-2'). 연도가 잘렸으면 기준일(as_of) 이후
    가장 가까운 그 달로 본다(선물 근월물은 항상 앞으로 1년 안에 만기).
    """
    if not short_name:
        return None
    m = re.search(r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*([\s,]+|-)'?(\d{1,4})?", short_name, re.I)
    if not m:
        return None
    mon = MONTHS[m.group(1).lower()]
    ys = m.group(3) or ""
    hyphen = m.group(2) == "-"  # 'Dec-2026' 형식은 4자리 연도 — 그보다 짧으면 잘린 것
    if len(ys) == 4:
        yr = int(ys)
    elif len(ys) == 2 and not hyphen:
        yr = 2000 + int(ys)
    else:
        if not as_of:
            return None
        ref = date.fromisoformat(as_of)
        yr = ref.year if mon >= ref.month else ref.year + 1
    return f"{yr:04d}-{mon:02d}"


def round_sig(v: float | None, digits: int = 4) -> float | None:
    if v is None:
        return None
    a = abs(v)
    d = 2 if a >= 100 else 3 if a >= 10 else digits
    return round(v, d)


def parse_yahoo_chart(payload: dict, scale: float = 1.0) -> dict | None:
    """v8 chart(1d 일봉) → {value, prev, asOf, spark, shortName, currency}. 현재가는 regularMarketPrice.

    전일 종가는 range 앞의 종가(chartPreviousClose)가 아니라 **일봉에서** 고른다:
    마지막 봉의 날짜가 현재가 날짜와 같으면 그 앞 봉, 아니면 마지막 봉.
    """
    res = ((payload or {}).get("chart") or {}).get("result") or []
    if not res:
        return None
    res = res[0]
    meta = res.get("meta") or {}
    gmt = int(meta.get("gmtoffset") or 0)
    ts = res.get("timestamp") or []
    closes = (((res.get("indicators") or {}).get("quote") or [{}])[0] or {}).get("close") or []
    bars: dict[str, float] = {}
    for t, c in zip(ts, closes):
        c = _num(c)
        if c is None or c <= 0:
            continue
        day = datetime.fromtimestamp(int(t) + gmt, tz=timezone.utc).date().isoformat()
        bars[day] = c  # 같은 날짜가 두 번 오면(실시간 봉) 뒤의 것
    days = sorted(bars)
    cur = _num(meta.get("regularMarketPrice"))
    rmt = meta.get("regularMarketTime")
    cur_day = datetime.fromtimestamp(int(rmt) + gmt, tz=timezone.utc).date().isoformat() if rmt else (days[-1] if days else None)
    if cur is None or cur <= 0:
        if not days:
            return None
        cur, cur_day = bars[days[-1]], days[-1]
    if not cur_day:
        return None
    prev_days = [d for d in days if d < cur_day]
    prev = bars[prev_days[-1]] if prev_days else None
    # 연속 선물(=F)은 일봉이 만기 교체 전후 다른 월물을 섞는다(브렌트 104 → 97). 거래소가 주는
    # 당일 변동(fulldayChange, 현재 월물 기준)이 있으면 그것으로 전일 종가를 되짚는다.
    fdc = _num(meta.get("fulldayChange"))
    if fdc is not None:
        prev = cur - fdc
    spark_days = [d for d in days if d < cur_day][-(SPARK_DAYS - 1):]
    spark = [[d, round_sig(bars[d] * scale)] for d in spark_days] + [[cur_day, round_sig(cur * scale)]]
    return {
        "value": round_sig(cur * scale),
        "prev": round_sig(prev * scale) if prev is not None else None,
        "asOf": cur_day,
        "spark": spark,
        "shortName": meta.get("shortName") or "",
        "currency": meta.get("currency") or "",
    }


def with_change(item: dict, *, pct: bool = True) -> dict:
    v, p = item.get("value"), item.get("prev")
    if v is not None and p not in (None, 0):
        item["change"] = round_sig(v - p)
        if pct:
            item["changePct"] = round((v / p - 1) * 100, 2)
    else:
        item["change"] = None
        if pct:
            item["changePct"] = None
    return item


def series_item(series: list[tuple[str, float]], digits: int = 3) -> dict | None:
    """[(YYYY-MM-DD, v)] 정렬된 시계열 → 현재·직전·스파크라인(최근 3개월)."""
    series = sorted({d: v for d, v in series if v is not None}.items())
    if not series:
        return None
    last_d, last_v = series[-1]
    cutoff = (date.fromisoformat(last_d) - timedelta(days=SPARK_DAYS)).isoformat()
    spark = [[d, round(v, digits)] for d, v in series if d >= cutoff]
    prev = series[-2][1] if len(series) >= 2 else None
    return {
        "value": round(last_v, digits),
        "prev": round(prev, digits) if prev is not None else None,
        "asOf": last_d,
        "spark": spark,
    }


def parse_fred_csv(text: str) -> list[tuple[str, float]]:
    out = []
    for line in text.splitlines()[1:]:
        parts = line.split(",")
        if len(parts) < 2:
            continue
        v = _num(parts[1].strip())
        if v is not None and re.match(r"^\d{4}-\d{2}-\d{2}$", parts[0].strip()):
            out.append((parts[0].strip(), v))
    return out


def parse_mof_csv(text: str) -> list[tuple[str, float]]:
    """재무성 jgbcme.csv — 'Date,1Y,...,10Y,...' 헤더 아래 '2026/9/24,...'. 10Y 열."""
    out = []
    col = None
    for row in csv.reader(io.StringIO(text)):
        if not row:
            continue
        if row[0].strip() == "Date":
            col = row.index("10Y") if "10Y" in row else None
            continue
        if col is None:
            continue
        m = re.match(r"^(\d{4})/(\d{1,2})/(\d{1,2})$", row[0].strip())
        if not m or len(row) <= col:
            continue
        v = _num(row[col])
        if v is not None:
            out.append((f"{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}", v))
    return out


def parse_bundesbank_csv(text: str) -> list[tuple[str, float]]:
    """Bundesbank BBSIS CSV — 세미콜론, 소수점 쉼표, 'YYYY-MM-DD;3,49;' 행."""
    out = []
    for line in text.splitlines():
        parts = line.split(";")
        if len(parts) < 2 or not re.match(r"^\d{4}-\d{2}-\d{2}$", parts[0].strip()):
            continue
        v = _num(parts[1].strip().replace(",", "."))
        if v is not None:
            out.append((parts[0].strip(), v))
    return out


def parse_boe_csv(text: str) -> list[tuple[str, float]]:
    """BoE IADB CSV — 'DATE,IUDMNPY' 아래 '23 Sep 2026,5.3055'."""
    out = []
    for line in text.splitlines()[1:]:
        parts = line.split(",")
        if len(parts) < 2:
            continue
        try:
            d = datetime.strptime(parts[0].strip(), "%d %b %Y").date().isoformat()
        except ValueError:
            continue
        v = _num(parts[1])
        if v is not None:
            out.append((d, v))
    return out


def parse_bis_policy(text: str) -> dict[str, dict]:
    """BIS WS_CBPOL CSV(detail=dataonly) → 국가별 {value, prevValue, changedOn, asOf}.

    prevValue/changedOn 은 '직전에 금리가 바뀐 시점' — 받은 구간 안에서 값이 한 번도 안 바뀌었으면 None.
    """
    by_area: dict[str, list[tuple[str, float]]] = {}
    for row in csv.DictReader(io.StringIO(text)):
        v = _num(row.get("OBS_VALUE"))
        d = (row.get("TIME_PERIOD") or "").strip()
        a = (row.get("REF_AREA") or "").strip()
        if v is None or not a or not re.match(r"^\d{4}-\d{2}-\d{2}$", d):
            continue
        by_area.setdefault(a, []).append((d, v))
    out = {}
    for a, rows in by_area.items():
        rows.sort()
        cur_d, cur_v = rows[-1]
        prev_v = changed = None
        for i in range(len(rows) - 1, 0, -1):
            if rows[i - 1][1] != cur_v:
                prev_v, changed = rows[i - 1][1], rows[i][0]
                break
        out[a] = {"value": cur_v, "prevValue": prev_v, "changedOn": changed, "asOf": cur_d}
    return out


def extend_spark(old: list, new: list, keep_days: int = SPARK_DAYS) -> list:
    """[[date, v]] 두 목록을 날짜로 합친다(새 값 우선). 날짜 없는 점은 버린다. 최근 keep_days 만."""
    byd = {p[0]: p[1] for p in (old or []) if isinstance(p, (list, tuple)) and len(p) == 2 and p[0]}
    for p in new or []:
        if isinstance(p, (list, tuple)) and len(p) == 2 and p[0]:
            byd[p[0]] = p[1]
    days = sorted(byd)
    if not days:
        return []
    cutoff = (date.fromisoformat(days[-1]) - timedelta(days=keep_days)).isoformat()
    return [[d, byd[d]] for d in days if d >= cutoff]


def merge_with_previous(new_items: dict[str, dict], prev_payload: dict | None, expected_ids: list[str]) -> tuple[dict[str, dict], list[str]]:
    """이번에 못 받은 항목은 직전 값을 stale=true 로 유지. (합친 항목, 직전값 유지한 id 목록)."""
    prev_items = {}
    for it in ((prev_payload or {}).get("items") or []):
        if isinstance(it, dict) and it.get("id"):
            prev_items[it["id"]] = it
    merged = dict(new_items)
    for iid, it in merged.items():
        old = prev_items.get(iid)
        if old and old.get("spark") and it.get("spark") is not None and len(it["spark"]) < 5:
            # 야후가 과거 일봉을 주지 않는 심볼(^KS200·CNYKRW=X)은 실행마다 한 점씩 쌓는다.
            it["spark"] = extend_spark(old["spark"], it["spark"])
    kept = []
    for iid in expected_ids:
        if iid in merged:
            continue
        old = prev_items.get(iid)
        if old:
            merged[iid] = {**old, "stale": True}
            kept.append(iid)
    return merged, kept


# ---------------------------------------------------------------------------
# 네트워크
# ---------------------------------------------------------------------------
def _ssl_context():
    # 로컬 Windows 파이썬이 Bundesbank 중간 인증서를 못 찾는 일이 있어 certifi 가 있으면 그 번들을 쓴다.
    try:
        import certifi  # type: ignore
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()


_CTX = None


def http_get(url: str, headers: dict | None = None, timeout: int = 25, retries: int = 2) -> bytes:
    global _CTX
    if _CTX is None:
        _CTX = _ssl_context()
    last = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers=headers or UA_BROWSER)
            with urllib.request.urlopen(req, timeout=timeout, context=_CTX) as r:
                return r.read()
        except urllib.error.HTTPError as exc:
            last = exc
            if exc.code in (400, 401, 403, 404):
                break
        except Exception as exc:  # noqa: BLE001 — 네트워크 오류는 재시도 후 호출자에게
            last = exc
        time.sleep(1.5 + attempt * 2)
    raise RuntimeError(f"{url[:90]} → {last!r}"[:240])


def yahoo_chart(symbol: str) -> dict:
    q = urllib.parse.quote(symbol)
    last = None
    for host in ("query1", "query2"):
        try:
            raw = http_get(f"https://{host}.finance.yahoo.com/v8/finance/chart/{q}?range=6mo&interval=1d", UA_BROWSER)
            return json.loads(raw.decode("utf-8", "replace"))
        except Exception as exc:  # noqa: BLE001
            last = exc
    raise RuntimeError(str(last))


def fetch_yahoo_item(iid, symbol, name, unit, group, *, scale=1.0, kind="index", errors=None):
    try:
        parsed = parse_yahoo_chart(yahoo_chart(symbol), scale)
    except Exception as exc:  # noqa: BLE001
        (errors if errors is not None else []).append(f"{iid}: {exc}"[:200])
        return None
    if not parsed:
        (errors if errors is not None else []).append(f"{iid}: 빈 응답")
        return None
    item = {"id": iid, "name": name, "symbol": symbol, "group": group, "kind": kind, "unit": unit,
            "source": "Yahoo Finance", "freq": "일간", **{k: parsed[k] for k in ("value", "prev", "asOf", "spark")}}
    if kind == "future":
        item["contract"] = contract_month(parsed.get("shortName"), parsed.get("asOf"))
        # 곡물·육류·연성 원자재는 센트(USX)로 호가된다 — 단위 표기가 실제 호가 통화와 어긋나면 고친다.
        cur = parsed.get("currency")
        if cur == "USX" and unit.startswith("달러"):
            item["unit"] = "센트" + unit[2:]
        elif cur == "USD" and unit.startswith("센트"):
            item["unit"] = "달러" + unit[2:]
    return with_change(item)


def fetch_frankfurter_fx(base: str, scale: float) -> dict | None:
    start = (datetime.now(timezone.utc).date() - timedelta(days=SPARK_DAYS + 5)).isoformat()
    raw = http_get(f"https://api.frankfurter.dev/v1/{start}..?base={base}&symbols=KRW", UA_IDENT)
    rates = (json.loads(raw.decode("utf-8")) or {}).get("rates") or {}
    series = [(d, _num((r or {}).get("KRW"))) for d, r in rates.items()]
    series = [(d, v * scale) for d, v in series if v]
    return series_item(series, digits=2)


def fetch_bond(iid: str, errors: list) -> dict | None:
    today = datetime.now(KST).date()
    start = (today - timedelta(days=SPARK_DAYS + 10)).isoformat()
    series: list[tuple[str, float]] = []
    freq = "일간"
    source = dict((b[0], b[2]) for b in BONDS)[iid]
    try:
        if iid == "US10Y":
            series = parse_fred_csv(http_get(f"https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10&cosd={start}", UA_IDENT).decode("utf-8", "replace"))
        elif iid == "KR10Y":
            series = fetch_kr10y(errors)
        elif iid == "JP10Y":
            base = "https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/"
            series = parse_mof_csv(http_get(base + "jgbcme.csv").decode("utf-8", "replace"))
            try:
                hist = parse_mof_csv(http_get(base + "historical/jgbcme_all.csv", timeout=60).decode("utf-8", "replace"))
                series = [x for x in hist if x[0] >= start] + series
            except Exception as exc:  # noqa: BLE001 — 과거분이 없으면 이번 달만으로 그린다
                errors.append(f"JP10Y 과거분: {exc}"[:200])
        elif iid == "DE10Y":
            url = ("https://api.statistiken.bundesbank.de/rest/data/BBSIS/"
                   "D.I.ZAR.ZI.EUR.S1311.B.A604.R10XX.R.A.A._Z._Z.A?format=csv&lastNObservations=75")
            series = parse_bundesbank_csv(http_get(url).decode("utf-8-sig", "replace"))
        elif iid == "GB10Y":
            d0 = (today - timedelta(days=SPARK_DAYS + 10)).strftime("%d/%b/%Y")
            url = ("https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp?csv.x=yes"
                   f"&Datefrom={d0}&Dateto=now&SeriesCodes=IUDMNPY&CSVF=TN&UsingCodes=Y&VPD=Y&VFD=N")
            series = parse_boe_csv(http_get(url).decode("utf-8", "replace"))
    except Exception as exc:  # noqa: BLE001
        errors.append(f"{iid}: {exc}"[:200])
        series = []
    if not series and iid in BOND_FRED_MONTHLY:
        # 일간 소스가 죽으면 OECD 월평균(FRED)으로 — 주기가 달라지므로 freq 로 표시한다.
        try:
            s0 = (today - timedelta(days=400)).isoformat()
            series = parse_fred_csv(http_get(f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={BOND_FRED_MONTHLY[iid]}&cosd={s0}", UA_IDENT).decode("utf-8", "replace"))
            freq, source = "월간", "OECD(FRED) 월평균"
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{iid} 월간 대체: {exc}"[:200])
    if series and any(d is None for d, _ in series):
        # 날짜 없는 재사용 시리즈(ECOS 타일) — 순서 그대로, 마지막 값만 기준일이 있다.
        vals = [v for _, v in series]
        base = {"value": round(vals[-1], 3), "prev": round(vals[-2], 3) if len(vals) > 1 else None,
                "asOf": series[-1][0], "spark": [[d, round(v, 3)] for d, v in series]}
        source = "한국은행 ECOS"
    elif freq == "월간":
        base = series_item(series, digits=3)
        if base:
            base["spark"] = [[d, v] for d, v in sorted(series)[-13:]]
    else:
        base = series_item(series, digits=3)
    if not base:
        return None
    country = dict((b[0], b[1]) for b in BONDS)[iid]
    item = {"id": iid, "name": f"{country} 10년", "country": country, "group": "bonds", "kind": "bond",
            "unit": "%", "source": source, "freq": freq, **base}
    return with_change(item, pct=False)


def fetch_kr10y(errors: list) -> list[tuple[str, float]]:
    key = os.environ.get("ECOS_API_KEY", "").strip()
    if key:
        now = datetime.now(KST)
        s = (now - timedelta(days=SPARK_DAYS + 10)).strftime("%Y%m%d")
        e = now.strftime("%Y%m%d")
        url = f"https://ecos.bok.or.kr/api/StatisticSearch/{key}/json/kr/1/200/817Y002/D/{s}/{e}/010210000"
        try:
            d = json.loads(http_get(url, UA_IDENT).decode("utf-8"))
            rows = (d.get("StatisticSearch") or {}).get("row") or []
            out = []
            for r in rows:
                t, v = str(r.get("TIME") or ""), _num(r.get("DATA_VALUE"))
                if v is not None and re.match(r"^\d{8}$", t):
                    out.append((f"{t[:4]}-{t[4:6]}-{t[6:]}", v))
            if out:
                return out
        except Exception as exc:  # noqa: BLE001
            errors.append(f"KR10Y ECOS: {exc}"[:200])
    # 키가 없거나 실패하면 한국 매크로 빌더가 이미 받아 둔 국고채 10년(최근 30영업일)을 재사용.
    try:
        eco = json.loads(ECOS_MACRO.read_text(encoding="utf-8"))
    except Exception:
        return []
    tile = next((t for t in eco.get("indicators") or [] if t.get("key") == "ktb10"), None)
    if not tile or not tile.get("series"):
        return []
    as_of = str(tile.get("asOf") or "")
    if not re.match(r"^\d{8}$", as_of):
        return []
    # 타일 시리즈는 날짜 없이 값만 30개(영업일 순서)다 — 날짜를 지어내지 않도록 마지막 값에만
    # 기준일을 붙이고, 앞 값들은 날짜 없이(None) 스파크라인 순서로만 쓴다.
    vals = [v for v in (_num(x) for x in tile["series"]) if v is not None]
    last_d = f"{as_of[:4]}-{as_of[4:6]}-{as_of[6:]}"
    return [(None, v) for v in vals[:-1]] + [(last_d, vals[-1])] if vals else []


def fetch_policy(errors: list) -> list[dict]:
    start = (datetime.now(timezone.utc).date() - timedelta(days=365 * 3)).isoformat()
    keys = "+".join(p[0] for p in POLICY)
    url = f"https://stats.bis.org/api/v2/data/dataflow/BIS/WS_CBPOL/1.0/D.{keys}?startPeriod={start}&format=csv&detail=dataonly"
    try:
        parsed = parse_bis_policy(http_get(url, UA_IDENT, timeout=60).decode("utf-8-sig", "replace"))
    except Exception as exc:  # noqa: BLE001
        errors.append(f"기준금리: {exc}"[:200])
        return []
    out = []
    for area, country, bank in POLICY:
        p = parsed.get(area)
        if not p:
            errors.append(f"기준금리 {area}: 없음")
            continue
        chg = round(p["value"] - p["prevValue"], 3) if p.get("prevValue") is not None else None
        out.append({"id": f"RATE_{area}", "name": country, "country": country, "bank": bank, "group": "policy",
                    "kind": "rate", "unit": "%", "source": "BIS", "freq": "일간",
                    "value": p["value"], "prevValue": p["prevValue"], "change": chg,
                    "changedOn": p["changedOn"], "asOf": p["asOf"]})
    return out


# ---------------------------------------------------------------------------
def expected_ids() -> list[str]:
    return ([f[0] for f in FUTURES] + [i[0] for i in INDICES] + [x[0] for x in FX]
            + [b[0] for b in BONDS] + [f"RATE_{p[0]}" for p in POLICY])


def collect() -> tuple[dict[str, dict], list[str]]:
    errors: list[str] = []
    items: dict[str, dict] = {}
    for iid, sym, name, unit, group in FUTURES:
        it = fetch_yahoo_item(iid, sym, name, unit, group, kind="future", errors=errors)
        if it:
            items[iid] = it
        time.sleep(0.25)
    for iid, sym, name, unit, group in INDICES:
        it = fetch_yahoo_item(iid, sym, name, unit, group, kind="index", errors=errors)
        if it:
            items[iid] = it
        time.sleep(0.25)
    for iid, sym, name, unit, scale, base in FX:
        it = fetch_yahoo_item(iid, sym, name, unit, "fx", scale=scale, kind="fx", errors=errors)
        if not it:
            try:
                s = fetch_frankfurter_fx(base, scale)
                if s:
                    it = with_change({"id": iid, "name": name, "symbol": sym, "group": "fx", "kind": "fx", "unit": unit,
                                      "source": "ECB 기준율(frankfurter)", "freq": "일간", **s})
            except Exception as exc:  # noqa: BLE001
                errors.append(f"{iid} 대체: {exc}"[:200])
        if it:
            if scale != 1:
                it["per"] = scale
            items[iid] = it
        time.sleep(0.25)
    for iid, _c, _s in BONDS:
        it = fetch_bond(iid, errors)
        if it:
            items[iid] = it
    for it in fetch_policy(errors):
        items[it["id"]] = it
    return items, errors


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def build_payload(items: dict[str, dict], errors: list[str], prev_payload: dict | None) -> dict:
    ids = expected_ids()
    merged, kept = merge_with_previous(items, prev_payload, ids)
    ordered = [merged[i] for i in ids if i in merged]
    return {
        "updatedAtKst": datetime.now(KST).strftime("%Y-%m-%d %H:%M KST"),
        "count": len(ordered),
        "fresh": len(items),
        "staleIds": kept,
        "cards": [c for c in CARDS if c in merged],
        "items": ordered,
        "errors": errors[:40],
    }


def main() -> int:
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
            sys.stderr.reconfigure(encoding="utf-8")
        except Exception:
            pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--push", action="store_true", help="git 커밋·푸시까지 수행")
    args = ap.parse_args()

    print("=== 시장지표 수집 (원자재·해외지수·환율·국채·기준금리) ===")
    items, errors = collect()
    for e in errors:
        print(f"[warn] {e}")
    if not items:
        print("[error] 모든 소스 실패 — 기존 파일 유지")
        return 1
    payload = build_payload(items, errors, load_json(OUT_JSON))
    print(f"받음 {payload['fresh']}개 · 직전값 유지 {len(payload['staleIds'])}개 {payload['staleIds']} · 총 {payload['count']}개")

    from sec_client import write_data
    write_data(OUT_JSON, OUT_JS, "MARKET_INDICATORS", payload, indent=None)
    print(f"→ {OUT_JSON.relative_to(ROOT)}, {OUT_JS.relative_to(ROOT)}")

    if args.push:
        from sec_client import git_publish
        rel = [str(p.relative_to(ROOT)).replace("\\", "/") for p in (OUT_JSON, OUT_JS)]
        if not git_publish(rel, "market indicators"):
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
