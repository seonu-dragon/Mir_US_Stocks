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
* usdKrw      : FRED DEXKOUS 최신값(원/달러). 스냅샷에는 환율이 커밋되지 않는다
                (프런트는 워커 프록시 라이브) — 수집 실패 시 null.
* spyClose / kospiClose : data/details/SPY.json · data/korea/details/069500.json 최신 종가.
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


def fetch_usd_krw():
    """FRED DEXKOUS(원/달러, 일간) 최신값. 실패하면 None — 스냅샷엔 환율이 없다."""
    start = (datetime.now(timezone.utc).date() - timedelta(days=30)).isoformat()
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id=DEXKOUS&cosd={start}"
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=30) as r:
            text = r.read().decode("utf-8", "replace")
        last = None
        for line in text.splitlines()[1:]:
            parts = line.split(",")
            if len(parts) < 2:
                continue
            v = parts[1].strip()
            if v in ("", "."):
                continue
            try:
                last = float(v)
            except ValueError:
                continue
        return round(last, 2) if last else None
    except Exception:
        return None


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

    t10y2y = _num(((yield_curve or {}).get("spreads") or {}).get("t10y2y"))
    record = {
        "date": datetime.now(KST).strftime("%Y-%m-%d"),
        "fearGreed": compute_fear_greed(snapshot, fundamentals, options_stats, macro),
        "usdKrw": fetch_usd_krw(),
        "spyClose": latest_close(ROOT / "data" / "details" / "SPY.json"),
        "kospiClose": latest_close(ROOT / "data" / "korea" / "details" / "069500.json"),
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
    records = [r for r in (existing.get("records") or [])
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
