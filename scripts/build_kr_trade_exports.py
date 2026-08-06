#!/usr/bin/env python3
"""한국 수출 모멘텀 — 관세청 품목별 수출입실적 API (data.go.kr, DATA_GO_KR_KEY).

반도체·자동차·배터리 같은 주력 품목의 월간 수출액과 전년동월비(YoY)를 본다.
삼성전자·현대차·LG에너지솔루션 등 수출주에게는 실적 발표보다 빠른 매크로
컨텍스트다. 매월 15일경 전월 확정치가 나온다.

  http://apis.data.go.kr/1220000/nitemtrade/getNitemtradeList
  - hsSgn: HS 코드(4~6자리), strtYymm/endYymm: YYYYMM
  - cntyCd 미지정 시 국가별 행이 나오므로 '총계' 행을 합산/선별한다.
  - 응답은 XML. 필드명은 2026-08 실응답 기준(expDlr 수출금액$ 등).

산출물: data/korea/trade_exports.json + .js(window.KR_TRADE_EXPORTS). 값 없으면
기존 파일 유지(정직성: 지어내지 않는다).
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from pathlib import Path

from briefing_store import atomic_write_text  # 중단 시 잘린 JSON 방지

ROOT = Path(__file__).resolve().parents[1]
OUT_JSON = ROOT / "data" / "korea" / "trade_exports.json"
OUT_JS = ROOT / "data" / "korea" / "trade_exports.js"

API = "http://apis.data.go.kr/1220000/nitemtrade/getNitemtradeList"
UA = {"User-Agent": "Mir US Stocks research (dydtjsdn@gmail.com)"}
KST = timezone(timedelta(hours=9))

# (HS 코드, 라벨) — 코스피 주도 수출 품목
ITEMS = [
    ("8542", "반도체 (HS 8542)"),
    ("8486", "반도체 장비 (HS 8486)"),
    ("8703", "자동차 (HS 8703)"),
    ("850760", "리튬이온 배터리 (HS 8507.60)"),
    ("8517", "무선통신기기 (HS 8517)"),
    ("2710", "석유제품 (HS 2710)"),
    ("8901", "선박 (HS 8901)"),
    ("3304", "화장품 (HS 3304)"),
]
MONTHS = 25  # 24개월 시계열 + YoY 비교용


def kst_now_str() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def ym_range() -> tuple[str, str]:
    now = datetime.now(KST)
    end = now.replace(day=1) - timedelta(days=1)  # 지난달까지
    y, m = end.year, end.month
    sm = m - (MONTHS - 1)
    sy = y
    while sm <= 0:
        sm += 12
        sy -= 1
    return f"{sy}{sm:02d}", f"{y}{m:02d}"


def fetch_item(key: str, hs: str) -> dict[str, float]:
    """월별 수출금액($) 합계. 국가별 행이 오면 월 단위로 합산한다."""
    start, end = ym_range()
    params = urllib.parse.urlencode({
        "serviceKey": key, "strtYymm": start, "endYymm": end, "hsSgn": hs,
    })
    req = urllib.request.Request(f"{API}?{params}", headers=UA)
    with urllib.request.urlopen(req, timeout=45) as r:
        text = r.read().decode("utf-8", "replace")
    root = ET.fromstring(text)
    err = root.findtext(".//returnReasonCode")
    if err and err != "00":
        raise RuntimeError(f"API 오류 {err}: {root.findtext('.//returnAuthMsg')}")
    monthly: dict[str, float] = {}
    for it in root.iter("item"):
        ym = (it.findtext("year") or "").replace(".", "").strip()
        if not ym or len(ym) != 6 or not ym.isdigit():
            continue  # '총계' 요약 행 등
        exp = it.findtext("expDlr")
        try:
            monthly[ym] = monthly.get(ym, 0.0) + float(exp)
        except (TypeError, ValueError):
            continue
    return monthly


def build(key: str) -> dict | None:
    out = []
    as_of = ""
    for hs, label in ITEMS:
        try:
            monthly = fetch_item(key, hs)
        except Exception as e:  # noqa: BLE001
            print(f"[trade] {label} 실패({type(e).__name__}: {e}) — 건너뜀")
            continue
        time.sleep(0.15)
        yms = sorted(monthly)
        if len(yms) < 14:
            print(f"[trade] {label}: 월 {len(yms)}개(<14) — 건너뜀")
            continue
        latest = yms[-1]
        prev_year = f"{int(latest[:4]) - 1}{latest[4:]}"
        cur = monthly[latest]
        yoy = (cur / monthly[prev_year] - 1) * 100 if monthly.get(prev_year) else None
        as_of = max(as_of, latest)
        out.append({
            "hs": hs,
            "label": label,
            "latestYm": latest,
            "latestB": round(cur / 1e8, 2),  # 억달러
            "yoyPct": round(yoy, 1) if yoy is not None else None,
            "series": [round(monthly[ym] / 1e8, 2) for ym in yms[-24:]],
        })
        print(f"[trade] {label}: {latest} ${out[-1]['latestB']}억 (YoY {out[-1]['yoyPct']}%)")
    if len(out) < 4:
        return None
    return {
        "updatedAtKst": kst_now_str(),
        "asOf": f"{as_of[:4]}-{as_of[4:]}",
        "source": "관세청 품목별 수출입실적 (data.go.kr)",
        "items": out,
    }


def main() -> int:
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    print("=== 수출 모멘텀 수집 (관세청) ===")
    key = os.environ.get("DATA_GO_KR_KEY", "").strip()
    if not key:
        print("[trade] DATA_GO_KR_KEY 없음 — 기존 파일 유지")
        return 1
    try:
        payload = build(key)
    except Exception as e:  # noqa: BLE001
        print(f"[trade] 수집 실패({type(e).__name__}: {e}) — 기존 파일 유지")
        return 1
    if not payload:
        print("[trade] 유효 품목 부족 — 기존 파일 유지")
        return 1
    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    atomic_write_text(OUT_JSON, compact)
    atomic_write_text(OUT_JS, f"window.KR_TRADE_EXPORTS = {compact};\n")
    print(f"{len(payload['items'])}개 품목, 기준월 {payload['asOf']} → {OUT_JSON.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
