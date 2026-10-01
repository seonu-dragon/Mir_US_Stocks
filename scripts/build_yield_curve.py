#!/usr/bin/env python3
"""미국 국채 수익률 곡선 — FRED(무료, 키 불필요) 일별 CMT 금리.

매크로 컨텍스트. 지수·종목만으로는 안 보이는 '돈의 값(금리)'과 경기 신호(장단기 역전)를
한 곳에서 본다. 예측이 아니라 현재 곡선과 스프레드의 상태 요약이다.

  FRED fredgraph CSV: https://fred.stlouisfed.org/graph/fredgraph.csv?id=<시리즈들>
  - CMT(constant maturity) 시리즈: DGS1MO … DGS30. 값은 연 %(예: 4.32).
  - 다중 시리즈를 한 번에 받고, 각 만기별 '마지막 실측치'를 곡선으로 쓴다.
  - 10Y-2Y, 10Y-3M 스프레드(음수면 역전 = 역사적 경기침체 선행 신호로 자주 인용)와
    10Y-2Y의 최근 1년 추이(sparkline)를 함께 낸다.

산출물: data/yield_curve.json + data/yield_curve.js(window.YIELD_CURVE). 브라우저는 .js
를 로드한다(FEATURE_DATA). 값 없으면 기존 파일 유지(정직성: 지어내지 않는다).
"""

from __future__ import annotations

import io
import json
import sys
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path
from briefing_store import atomic_write_text  # 중단 시 잘린 JSON 방지
import sec_client as sec  # noqa: E402  (http_get_with_backoff)

ROOT = Path(__file__).resolve().parents[1]
OUT_JSON = ROOT / "data" / "yield_curve.json"
OUT_JS = ROOT / "data" / "yield_curve.js"

# (FRED 시리즈, 라벨, 만기 개월수) — 곡선 x축 정렬용 months
SERIES = [
    ("DGS1MO", "1M", 1), ("DGS3MO", "3M", 3), ("DGS6MO", "6M", 6),
    ("DGS1", "1Y", 12), ("DGS2", "2Y", 24), ("DGS3", "3Y", 36),
    ("DGS5", "5Y", 60), ("DGS7", "7Y", 84), ("DGS10", "10Y", 120),
    ("DGS20", "20Y", 240), ("DGS30", "30Y", 360),
]
UA = {"User-Agent": "Mir US Stocks research (dydtjsdn@gmail.com)"}
FRED_CSV = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=" + ",".join(s[0] for s in SERIES)
# FRED 의 DGS 시리즈는 재무부 고시를 다음 영업일에야 싣는다 — 06:05 KST(미 동부 전날 저녁) 실행 시점엔
# 늘 하루 전(D-1)이 마지막이었다(2026-09-30 실행이 asOf 09-28). 같은 값(Daily Treasury Par Yield Curve
# = CMT)을 재무부가 당일 저녁에 직접 고시하므로, FRED 마지막 날짜 이후 행만 거기서 덧붙인다.
TREASURY_CSV = ("https://home.treasury.gov/resource-center/data-chart-center/interest-rates/"
                "daily-treasury-rates.csv/{year}/all?type=daily_treasury_yield_curve&field_tdr_date_value={year}&page&_format=csv")
TREASURY_COLS = {"DGS1MO": "1 Mo", "DGS3MO": "3 Mo", "DGS6MO": "6 Mo", "DGS1": "1 Yr", "DGS2": "2 Yr",
                 "DGS3": "3 Yr", "DGS5": "5 Yr", "DGS7": "7 Yr", "DGS10": "10 Yr", "DGS20": "20 Yr", "DGS30": "30 Yr"}


def kst_now_str() -> str:
    return datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M KST")


def fetch_csv(url: str) -> list[list[str]]:
    text = sec.http_get_with_backoff(url, headers=UA, timeout=30,
                                     label="yield curve").decode("utf-8", "replace")
    return [line.split(",") for line in text.splitlines() if line.strip()]


def treasury_rows_as_fred(header: list[str], treasury: list[list[str]], after: str) -> list[list[str]]:
    """재무부 CSV 행(MM/DD/YYYY, "10 Yr" 열)을 FRED 헤더 순서의 행(YYYY-MM-DD)으로 — after 보다 새 날짜만, 날짜 오름차순."""
    if len(treasury) < 2:
        return []
    th = [h.strip().strip('"') for h in treasury[0]]
    out = []
    for r in treasury[1:]:
        m = str(r[0]).strip().strip('"').split("/") if r else []
        if len(m) != 3:
            continue
        iso = f"{m[2]}-{m[0].zfill(2)}-{m[1].zfill(2)}"
        if iso <= after:
            continue
        row = [iso]
        for name in header[1:]:
            col = TREASURY_COLS.get(name)
            j = th.index(col) if col in th else -1
            row.append(r[j].strip() if 0 <= j < len(r) and r[j].strip() else ".")
        if any(v != "." for v in row[1:]):
            out.append(row)
    return sorted(out, key=lambda x: x[0])


def fetch_treasury(year: int) -> list[list[str]]:
    text = sec.http_get_with_backoff(TREASURY_CSV.format(year=year), headers=UA, timeout=30,
                                     label="treasury yield curve").decode("utf-8", "replace")
    return [line.split(",") for line in text.splitlines() if line.strip()]


def build() -> dict | None:
    rows = fetch_csv(FRED_CSV)
    if len(rows) < 2:
        return None
    header = rows[0]
    idx = {name: header.index(name) for name in (s[0] for s in SERIES) if name in header}
    if not idx:
        return None
    data_rows = rows[1:]
    fred_last = max((r[0] for r in data_rows if r), default="")
    extra = []
    try:
        year = datetime.now(timezone(timedelta(hours=-5))).year
        extra = treasury_rows_as_fred(header, fetch_treasury(year), fred_last)
    except Exception as e:  # noqa: BLE001 — 재무부 실패는 FRED 만으로 계속(하루 늦을 뿐)
        print(f"[yield] 재무부 당일 고시 실패({type(e).__name__}: {e}) — FRED 만 사용")
    if extra:
        print(f"[yield] FRED 마지막 {fred_last} 이후 재무부 고시 {len(extra)}일 덧붙임: {extra[-1][0]}")
        data_rows = data_rows + extra

    def last_value(col: int):
        for r in reversed(data_rows):
            if col < len(r):
                v = r[col].strip()
                if v not in ("", "."):
                    try:
                        return float(v), r[0]
                    except ValueError:
                        continue
        return None, None

    curve = []
    as_of = ""
    for name, label, months in SERIES:
        col = idx.get(name)
        if col is None:
            continue
        val, date = last_value(col)
        if val is None:
            continue
        as_of = max(as_of, date or "")
        curve.append({"m": label, "y": round(val, 2), "months": months})
    if len(curve) < 4:
        return None

    by_label = {c["m"]: c["y"] for c in curve}
    spreads = {}
    if "10Y" in by_label and "2Y" in by_label:
        spreads["t10y2y"] = round(by_label["10Y"] - by_label["2Y"], 2)
    if "10Y" in by_label and "3M" in by_label:
        spreads["t10y3m"] = round(by_label["10Y"] - by_label["3M"], 2)

    # 10Y-2Y 최근 1년 추이(둘 다 실측인 날만)
    c10 = idx.get("DGS10")
    c2 = idx.get("DGS2")
    hist = []
    if c10 is not None and c2 is not None:
        for r in data_rows:
            if c10 < len(r) and c2 < len(r):
                a, bb = r[c10].strip(), r[c2].strip()
                if a not in ("", ".") and bb not in ("", "."):
                    try:
                        hist.append({"d": r[0], "v": round(float(a) - float(bb), 2)})
                    except ValueError:
                        pass
        hist = hist[-252:]

    return {
        "updatedAtKst": kst_now_str(),
        "asOf": as_of,
        "source": "FRED · US Treasury constant maturity (DGS)" + (" + Treasury.gov 당일 고시" if extra else ""),
        "curve": curve,
        "spreads": spreads,
        "spreadHistory": hist,
    }


def main() -> int:
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    print("=== 국채 수익률 곡선 수집 (FRED) ===")
    try:
        payload = build()
    except Exception as e:  # noqa: BLE001
        print(f"[yield] 수집 실패({type(e).__name__}: {e}) — 기존 파일 유지")
        return 1
    if not payload:
        print("[yield] 유효 데이터 없음 — 기존 파일 유지")
        return 1
    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    atomic_write_text(OUT_JSON, compact)
    atomic_write_text(OUT_JS, f"window.YIELD_CURVE = {compact};\n")
    print(f"as_of={payload['asOf']} 만기 {len(payload['curve'])}개 스프레드 {payload['spreads']}")
    print(f"Wrote {OUT_JSON.name}, {OUT_JS.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
