#!/usr/bin/env python3
"""연방 계약 — USASpending.gov (무료·공식) 최근 12개월 미국 연방정부 계약.

대체 데이터(alt-data). 방산·IT서비스·헬스 등 정부 매출 비중이 큰 기업은 연방 계약이
실적의 큰 축이다. 지수·주가엔 안 드러나는 '정부라는 고객'의 규모를 본다. 참고용 —
계약 사실이지 예측·매매 신호가 아니다.

  POST api.usaspending.gov/api/v2/search/spending_by_transaction/
  - **트랜잭션(집행) 금액을 합산**한다. award 의 "Award Amount" 는 다년 계약의 전체
    상한(ceiling)이라 활성 계약들을 더하면 수 배로 부풀려진다(록히드 12개월이 $566B 로
    나옴 — 실제 연 집행은 ~$70B). 트랜잭션의 federal_action_obligation 은 그 기간에
    실제로 집행된 돈이라 합이 현실적이다(록히드 ~$71B).
  - 금액 큰 순으로 상위 N페이지만 합산 → 달러 대부분을 포착하되 꼬리(소액)는 생략하므로
    총액은 **근사치("약")** 로 표기한다.
  - 티커→법인명 매핑은 오탐을 막으려 **큐레이션 화이트리스트**만 쓴다(임의 회사명 검색은
    동명이인·자회사로 부정확). 정부 매출이 실제로 큰 종목만 포함.

산출물: data/federal_contracts.json + .js(window.FEDERAL_CONTRACTS). 값 없으면 기존 유지.
"""

from __future__ import annotations

import json
import sys
import time
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path
from briefing_store import atomic_write_text  # 중단 시 잘린 JSON 방지
import sec_client as sec  # noqa: E402  (http_get_with_backoff)

ROOT = Path(__file__).resolve().parents[1]
OUT_JSON = ROOT / "data" / "federal_contracts.json"
OUT_JS = ROOT / "data" / "federal_contracts.js"
API = "https://api.usaspending.gov/api/v2/search/spending_by_transaction/"
UA = {"User-Agent": "Mir US Stocks research (dydtjsdn@gmail.com)", "Content-Type": "application/json"}

# 티커 → USASpending recipient 검색 키워드. 정부 계약이 실적에 유의미한 기업만 큐레이션.
CONTRACTORS = {
    "LMT": "Lockheed Martin", "RTX": "Raytheon", "NOC": "Northrop Grumman",
    "GD": "General Dynamics", "BA": "Boeing", "HII": "Huntington Ingalls",
    "LHX": "L3Harris", "LDOS": "Leidos", "BAH": "Booz Allen Hamilton",
    "SAIC": "Science Applications International", "CACI": "CACI",
    "PLTR": "Palantir", "GDIT": "General Dynamics Information Technology",
    "KBR": "KBR", "JCI": "Johnson Controls", "TXT": "Textron",
    "HON": "Honeywell", "GE": "GE Aerospace", "CW": "Curtiss-Wright",
    "AXON": "Axon Enterprise", "PSN": "Parsons", "VSAT": "Viasat",
    "OSK": "Oshkosh", "AVAV": "AeroVironment", "KTOS": "Kratos Defense",
    "MRCY": "Mercury Systems", "TDG": "TransDigm", "HEI": "HEICO",
    "UNH": "UnitedHealth", "HUM": "Humana", "CVS": "CVS Health",
    "MCK": "McKesson", "CAH": "Cardinal Health", "COR": "Cencora",
    "ACN": "Accenture Federal", "IBM": "International Business Machines",
    "ORCL": "Oracle", "MSFT": "Microsoft", "AMZN": "Amazon Web Services",
}


def kst_now_str() -> str:
    return datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M KST")


# 전체 수집 마감시간. 2026-09-16 Actions 에서 USASpending 이 느려 39종목에 1시간 30분이
# 걸렸고, 같은 잡의 본체 스냅샷이 타임아웃으로 취소됐다. 마감을 넘기면 남은 종목은
# 건너뛰고, 목표의 80% 미만이면 기존 파일을 유지한다(부분 데이터로 덮지 않는다).
DEADLINE_S = 15 * 60
MIN_COVERAGE = 0.8


def post(body: dict, timeout=20, retries=3) -> dict:
    last = None
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(API, data=json.dumps(body).encode(), headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read())
        except Exception as exc:
            last = exc
            if getattr(exc, "code", None) in (403, 404):
                raise
            if attempt < retries:
                sec.backoff_sleep(attempt, base=1.0, cap=30.0)
    raise last


def fetch(recipient: str, start: str, end: str, max_pages: int = 6) -> dict | None:
    """기간 내 트랜잭션 집행액 합(금액 큰 순 상위 max_pages*100건). 다년 상한이 아니라
    실제 집행액이라 현실적이다. 꼬리(소액)는 생략되므로 총액은 근사치."""
    total = 0.0
    top = 0.0
    count = 0
    capped = False
    for page in range(1, max_pages + 1):
        body = {
            "filters": {
                "keywords": [recipient],
                "time_period": [{"start_date": start, "end_date": end}],
                "award_type_codes": ["A", "B", "C", "D"],
            },
            "fields": ["Transaction Amount", "Recipient Name"],
            "page": page, "limit": 100, "sort": "Transaction Amount", "order": "desc",
        }
        try:
            d = post(body)
        except Exception:
            break
        rows = d.get("results") or []
        for r in rows:
            amt = r.get("Transaction Amount")
            if isinstance(amt, (int, float)):
                total += amt
                top = max(top, amt)
                count += 1
        if not (d.get("page_metadata") or {}).get("hasNext"):
            break
        if page == max_pages:
            capped = True
        time.sleep(0.15)
    if total <= 0:
        return None
    return {"count": count, "total": round(total), "top": round(top), "approx": capped}


def build(deadline_s: float = DEADLINE_S) -> dict | None:
    end = datetime.now(timezone.utc).date()
    start = end - timedelta(days=365)
    out = {}
    done = 0
    started = time.monotonic()
    for ticker, name in CONTRACTORS.items():
        if time.monotonic() - started > deadline_s:
            print(f"  [federal] 마감 {deadline_s / 60:.0f}분 초과 — {done}/{len(CONTRACTORS)}에서 중단")
            break
        done += 1
        rec = fetch(name, start.isoformat(), end.isoformat())
        time.sleep(0.2)
        if rec and rec["total"] > 0:
            out[ticker] = rec
        if done % 10 == 0:
            print(f"  진행 {done}/{len(CONTRACTORS)} (수집 {len(out)})")
    if not out:
        return None
    if done < len(CONTRACTORS) and len(out) < len(CONTRACTORS) * MIN_COVERAGE:
        print(f"  [federal] 마감 중단으로 {len(out)}/{len(CONTRACTORS)}종목뿐 — 기존 파일 유지")
        return None
    return {"updatedAtKst": kst_now_str(),
            "source": "USASpending.gov · 최근 12개월 prime award (계약 A/B/C/D)",
            "windowStart": start.isoformat(), "windowEnd": end.isoformat(),
            "stocks": out}


def main() -> int:
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    print("=== 연방 계약 수집 (USASpending) ===")
    try:
        payload = build()
    except Exception as e:  # noqa: BLE001
        print(f"[federal] 수집 실패({type(e).__name__}: {e}) — 기존 파일 유지")
        return 1
    if not payload:
        print("[federal] 유효 데이터 없음 — 기존 파일 유지")
        return 1
    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    atomic_write_text(OUT_JSON, compact)
    atomic_write_text(OUT_JS, f"window.FEDERAL_CONTRACTS = {compact};\n")
    print(f"수집 {len(payload['stocks'])}종목")
    print(f"Wrote {OUT_JSON.name}, {OUT_JS.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
