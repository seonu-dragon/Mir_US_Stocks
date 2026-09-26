#!/usr/bin/env python3
"""공포탐욕·매크로 히스토리 (build_market_history.py)
====================================================

하루 1레코드씩 시장 상태 시계열을 쌓는다 — 스냅샷·매크로 파일들은 매일 덮어써져서
"어제는 어땠나" 를 사이트가 보여줄 수 없다. 이 빌더가 그 시계열을 만든다
(프런트 스파크라인 소비자는 후속 작업).

레코드 필드(없는 값은 null — 지어내지 않는다):
* fearGreed   : 자체 공포탐욕 종합(0~100). 스냅샷에 저장된 필드가 아니라
                app.js fearGreedComponents 와 동일 공식으로 커밋된 데이터에서 계산한다
                (시장 폭·모멘텀·주가 강도 + 옵션 풋콜 + HY 스프레드 + VIX 의 단순 평균).
                CNN 지수는 라이브 전용이라 빌드 시점 재현이 불가능해 쓰지 않는다.
* usdKrw / usdKrwDate / usdKrwSource : 원/달러 환율과 그 관측일. 한국은행 ECOS 731Y001
                (매매기준율, 일별)을 우선 쓰고, 키가 없거나 실패하면 data/korea/ecos_macro.json 의
                같은 값, 그다음 frankfurter(ECB 기준율)를 쓴다 — 셋 중 **관측일이 가장 최근인 것**.
                예전엔 FRED DEXKOUS 였는데 H.10 이 주 1회 갱신이라 일주일 묵은 값(1,387.97, 실제
                ~1,355)이 며칠씩 반복 적립됐다(2026-09-26 수정).
* spyClose    : data/details/SPY.json 최신 종가.
* kospiClose / kospiDate : 코스피 **지수** 종가와 관측일 — data/korea/market_snapshot.json 의
                indices(^KS11, m.stock 지수, tradedAt). 예전 kospiClose 는 KODEX 200 ETF(069500)
                종가(원, 113,145 등)였다. 그 값은 사실이므로 kodex200Close 로 이름을 바꿔 보존하고
                (기존 레코드도 읽을 때 이름을 바꾼다), 계속 적립한다.
* t10y2y      : data/yield_curve.json spreads.t10y2y.
* hySpread / cpiYoY / unemployment : data/macro_indicators.json (BAMLH0A0HYM2 /
                CPIAUCSL 전년비 / UNRATE).

같은 날짜(KST) 재실행은 그 날짜 레코드를 덮어쓴다. 최근 400개만 유지.
백필은 하지 않는다 — 현재 파일들이 주는 1레코드부터 정직하게 쌓는다.

산출물: data/history/market_history.json + .js(window.MARKET_HISTORY)
실행:  py scripts/build_market_history.py [--push]
"""

from __future__ import annotations

import argparse
import os
import re
import json
import statistics
import sys
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from briefing_store import atomic_write_text  # noqa: E402  # 중단 시 잘린 JSON 방지

OUT_JSON = ROOT / "data" / "history" / "market_history.json"
OUT_JS = ROOT / "data" / "history" / "market_history.js"
KST = timezone(timedelta(hours=9))
KEEP_RECORDS = 400
UA = {"User-Agent": "Mir US Stocks research (dydtjsdn@gmail.com)"}
ETF_SECTORS = {"EXCHANGE TRADED FUNDS", "ETF"}


def load_json(path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception:
        return None


def clamp01_100(v):
    return max(0.0, min(100.0, v))


def compute_fear_greed(snapshot, fundamentals, options_stats, macro):
    """app.js fearGreedComponents 와 동일 공식 — 구성요소 0~100 정규화 후 단순 평균.

    구성요소가 하나도 없으면 None(지어내지 않는다).
    """
    comps = []
    stocks = [s for s in ((snapshot or {}).get("stocks") or [])
              if (s.get("sector") or "").upper() not in ETF_SECTORS]
    if len(stocks) >= 20:
        # 시장 폭: 상승/하락 종목 비율
        up = sum(1 for s in stocks if _num(s.get("changePct")) is not None and _num(s.get("changePct")) > 0)
        down = sum(1 for s in stocks if _num(s.get("changePct")) is not None and _num(s.get("changePct")) < 0)
        if up + down > 0:
            comps.append(clamp01_100(up / (up + down) * 100))
        # 모멘텀: 1개월 상승 비율
        pos_m = tot_m = 0
        for s in stocks:
            v = _num(s.get("monthChangePct"))
            if v is not None:
                tot_m += 1
                if v > 0:
                    pos_m += 1
        if tot_m > 0:
            comps.append(clamp01_100(pos_m / tot_m * 100))
        # 주가 강도: 52주 신고가 근접 vs 신저가 근접 (low52 는 MAP_FUNDAMENTALS)
        highs = sum(1 for s in stocks
                    if _num(s.get("newHighDistancePct")) is not None
                    and _num(s.get("newHighDistancePct")) <= 2)
        lows = 0
        fund = fundamentals or {}
        for s in stocks:
            f = fund.get(s.get("ticker")) or {}
            low = _num(f.get("low52"))
            price = _num(s.get("price"))
            if low and low > 0 and price is not None and (price / low - 1) * 100 <= 5:
                lows += 1
        if highs + lows > 0:
            comps.append(clamp01_100(highs / (highs + lows) * 100))
    # 옵션 풋콜(OI)
    pc = _num(((options_stats or {}).get("market") or {}).get("putCallOI"))
    if pc is not None:
        comps.append(clamp01_100((1.25 - pc) / (1.25 - 0.65) * 100))
    # HY 신용스프레드 · VIX
    indicators = (macro or {}).get("indicators") or []
    by_id = {i.get("id"): _num(i.get("value")) for i in indicators}
    hy = by_id.get("BAMLH0A0HYM2")
    if hy is not None:
        comps.append(clamp01_100((6 - hy) / (6 - 2.5) * 100))
    vix = by_id.get("VIXCLS")
    if vix is not None:
        comps.append(clamp01_100((30 - vix) / (30 - 12) * 100))
    if not comps:
        return None
    return round(statistics.fmean(comps))


def _num(v):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if f == f else None  # NaN 차단


def _http_json(url, timeout=30):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


def _ymd(s):
    """'20260923' · '2026-09-23' → '2026-09-23'. 아니면 None."""
    s = str(s or "").strip()
    if re.match(r"^\d{8}$", s):
        return f"{s[:4]}-{s[4:6]}-{s[6:]}"
    if _DATE_RE.match(s[:10]):
        return s[:10]
    return None


def usd_krw_from_ecos(key):
    """ECOS 731Y001/0000001(원/달러 매매기준율, 일별) 최신 (값, 관측일)."""
    now = datetime.now(KST)
    start = (now - timedelta(days=20)).strftime("%Y%m%d")
    url = (f"https://ecos.bok.or.kr/api/StatisticSearch/{key}/json/kr/1/100/731Y001/D/"
           f"{start}/{now.strftime('%Y%m%d')}/0000001")
    rows = (_http_json(url).get("StatisticSearch") or {}).get("row") or []
    best = None
    for r in rows:
        v, d = _num(r.get("DATA_VALUE")), _ymd(r.get("TIME"))
        if v and d and (best is None or d > best[1]):
            best = (round(v, 2), d)
    return best


def usd_krw_from_ecos_file():
    """한국 매크로 빌더가 받아 둔 ECOS 원/달러 타일(data/korea/ecos_macro.json)."""
    eco = load_json(ROOT / "data" / "korea" / "ecos_macro.json") or {}
    for t in eco.get("indicators") or []:
        if t.get("key") == "usdKrw":
            v, d = _num(t.get("value")), _ymd(t.get("asOf"))
            if v and d:
                return (round(v, 2), d)
    return None


def usd_krw_from_frankfurter():
    d = _http_json("https://api.frankfurter.dev/v1/latest?base=USD&symbols=KRW")
    v, day = _num((d.get("rates") or {}).get("KRW")), _ymd(d.get("date"))
    return (round(v, 2), day) if v and day else None


def pick_latest_fx(candidates):
    """[(source, (value, date)|None)] → (value, date, source) 관측일이 가장 최근인 것. 앞 순서가 동률 우선."""
    best = None
    for src, got in candidates:
        if not got:
            continue
        if best is None or got[1] > best[1]:
            best = (got[0], got[1], src)
    return best


def fetch_usd_krw():
    """(값, 관측일, 출처) 또는 (None, None, None). 스냅샷엔 환율이 커밋되지 않는다."""
    cands = []
    key = os.environ.get("ECOS_API_KEY", "").strip()
    if key:
        try:
            cands.append(("ECOS 731Y001", usd_krw_from_ecos(key)))
        except Exception as exc:  # noqa: BLE001
            print(f"[warn] ECOS 환율 실패: {exc}")
    cands.append(("ECOS 731Y001", usd_krw_from_ecos_file()))
    try:
        cands.append(("ECB(frankfurter)", usd_krw_from_frankfurter()))
    except Exception as exc:  # noqa: BLE001
        print(f"[warn] frankfurter 환율 실패: {exc}")
    best = pick_latest_fx(cands)
    return best if best else (None, None, None)


def kospi_index(snapshot):
    """KR 스냅샷 indices 의 코스피 지수 (종가, 관측일). tradedAt 이 없으면 스냅샷 시각 날짜."""
    for idx in (snapshot or {}).get("indices") or []:
        if idx.get("symbol") == "^KS11":
            v = _num(idx.get("price"))
            d = _ymd(idx.get("tradedAt")) or _ymd((snapshot or {}).get("updatedAtKst"))
            if v and v > 0:
                return round(v, 2), d
    return None, None


def migrate_record(rec):
    """옛 레코드의 kospiClose(=KODEX 200 ETF 종가)를 kodex200Close 로 옮긴다. kospiDate 가 있으면 새 형식."""
    if not isinstance(rec, dict) or "kospiDate" in rec or "kospiClose" not in rec:
        return rec
    rec = dict(rec)
    rec["kodex200Close"] = rec.pop("kospiClose")
    return rec


def latest_close(detail_path):
    d = load_json(detail_path)
    if not d:
        return None
    series = d.get("chartSeries") or []
    for row in reversed(series):
        if row and len(row) >= 4:
            c = _num(row[3])
            if c and c > 0:
                return round(c, 2)
    return None


_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def latest_trading_date(detail_path):
    """detail 의 chartSeries 마지막 **거래일**(YYYY-MM-DD). 없으면 None.

    행 형식은 [open, high, low, close, volume, "YYYY-MM-DD"] 다 — 날짜 칸
    위치에 의존하지 않도록 행 안의 날짜 문자열을 찾는다.
    """
    d = load_json(detail_path)
    series = (d or {}).get("chartSeries") or []
    for row in reversed(series):
        if not row:
            continue
        for cell in reversed(row):
            if isinstance(cell, str) and _DATE_RE.match(cell):
                return cell
    return None


def macro_value(macro, fid):
    for it in (macro or {}).get("indicators") or []:
        if it.get("id") == fid:
            return _num(it.get("value"))
    return None


def build_record():
    snapshot = load_json(ROOT / "data" / "market_snapshot.json")
    fundamentals = load_json(ROOT / "data" / "map_fundamentals.json")
    options_stats = load_json(ROOT / "data" / "options_stats.json")
    macro = load_json(ROOT / "data" / "macro_indicators.json")
    yield_curve = load_json(ROOT / "data" / "yield_curve.json")

    kr_snapshot = load_json(ROOT / "data" / "korea" / "market_snapshot.json")
    t10y2y = _num(((yield_curve or {}).get("spreads") or {}).get("t10y2y"))
    usd_krw, usd_krw_date, usd_krw_src = fetch_usd_krw()
    kospi, kospi_date = kospi_index(kr_snapshot)
    # 레코드 날짜는 **마지막 거래일**이다. KST 오늘로 찍으면 토·일에도 레코드가
    # 생겨 금요일 값이 3번 반복되고, 스파크라인이 주말마다 평탄해졌다
    # (2026-09-15 감사). 거래일을 못 읽으면 KST 오늘로 폴백한다.
    stamp = (latest_trading_date(ROOT / "data" / "details" / "SPY.json")
             or datetime.now(KST).strftime("%Y-%m-%d"))
    record = {
        "date": stamp,
        "fearGreed": compute_fear_greed(snapshot, fundamentals, options_stats, macro),
        "usdKrw": usd_krw,
        "usdKrwDate": usd_krw_date,
        "usdKrwSource": usd_krw_src,
        "spyClose": latest_close(ROOT / "data" / "details" / "SPY.json"),
        # 코스피 지수 — 레코드 날짜(SPY 거래일)와 다를 수 있어 관측일을 따로 둔다(국내 휴장 등).
        "kospiClose": kospi,
        "kospiDate": kospi_date,
        # KODEX 200 ETF(069500) 원화 종가 — 예전에 kospiClose 라는 이름으로 적립되던 값.
        "kodex200Close": latest_close(ROOT / "data" / "korea" / "details" / "069500.json"),
        "t10y2y": round(t10y2y, 2) if t10y2y is not None else None,
        "hySpread": macro_value(macro, "BAMLH0A0HYM2"),
        "cpiYoY": macro_value(macro, "CPIAUCSL"),
        "unemployment": macro_value(macro, "UNRATE"),
    }
    return record


def main():
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--push", action="store_true", help="git 커밋·푸시까지 수행")
    args = ap.parse_args()

    print("=== 시장 히스토리 적립 (fear/greed · macro) ===")
    record = build_record()

    existing = load_json(OUT_JSON) or {}
    records = [migrate_record(r) for r in (existing.get("records") or [])
               if isinstance(r, dict) and r.get("date") and r["date"] != record["date"]]
    records.append(record)
    records.sort(key=lambda r: r["date"])
    records = records[-KEEP_RECORDS:]

    payload = {
        "updatedAtKst": datetime.now(KST).strftime("%Y-%m-%d %H:%M KST"),
        "keep": KEEP_RECORDS,
        "records": records,
    }
    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    atomic_write_text(OUT_JSON, compact)
    atomic_write_text(
        OUT_JS,
        "// 공포탐욕·환율·매크로 일일 히스토리 — 스파크라인용 시계열.\n"
        "// 프런트 소비자(홈/매크로 패널의 스파크라인 렌더)는 후속 작업으로 붙는다.\n"
        f"window.MARKET_HISTORY = {compact};\n",
    )
    print(f"오늘 레코드: {json.dumps(record, ensure_ascii=False)}")
    print(f"총 {len(records)}개 레코드 → {OUT_JSON.name}, {OUT_JS.name}")

    if args.push:
        from sec_client import git_publish
        rel = [str(OUT_JSON.relative_to(ROOT)).replace("\\", "/"),
               str(OUT_JS.relative_to(ROOT)).replace("\\", "/")]
        if not git_publish(rel, "market history"):
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
