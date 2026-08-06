#!/usr/bin/env python3
"""미 국채 경매 수요 — Treasury FiscalData API(공식, 키·리밋 없음).

금리곡선이 '가격'이라면 경매는 '수요의 체력'이다. bid-to-cover(응찰배수)가 같은
만기의 직전 평균보다 얼마나 강/약한지로 국채 수요를 요약한다. 입찰 부진(테일)은
장기금리 급등의 단골 트리거라 수익률 곡선 패널과 짝으로 본다.

  https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/auctions_query
  - 결과가 아직 없는 발표-only 레코드는 bid_to_cover_ratio 가 "null"(문자열)이다.
  - Note/Bond(쿠폰물)만 싣는다 — Bill 은 매주 쏟아져 노이즈가 크다.

산출물: data/treasury_auctions.json + .js(window.TREASURY_AUCTIONS). 값 없으면
기존 파일 유지(정직성: 지어내지 않는다).
"""

from __future__ import annotations

import json
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

from briefing_store import atomic_write_text  # 중단 시 잘린 JSON 방지

ROOT = Path(__file__).resolve().parents[1]
OUT_JSON = ROOT / "data" / "treasury_auctions.json"
OUT_JS = ROOT / "data" / "treasury_auctions.js"

API = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/auctions_query"
UA = {"User-Agent": "Mir US Stocks research (dydtjsdn@gmail.com)"}
FIELDS = ",".join([
    "auction_date", "security_type", "security_term", "cusip",
    "bid_to_cover_ratio", "high_yield", "offering_amt",
    "primary_dealer_accepted", "indirect_bidder_accepted", "comp_accepted",
])


def kst_now_str() -> str:
    return datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M KST")


def fnum(v) -> float | None:
    if v in (None, "", "null"):
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def fetch(params: dict) -> list[dict]:
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=45) as r:
        return json.loads(r.read().decode("utf-8")).get("data", [])


def build() -> dict | None:
    rows = fetch({
        "fields": FIELDS,
        "filter": "security_type:in:(Note,Bond)",
        "sort": "-auction_date",
        "page[size]": "220",
    })
    if not rows:
        return None

    done, upcoming = [], []
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    for r in rows:
        btc = fnum(r.get("bid_to_cover_ratio"))
        if btc is None:
            if (r.get("auction_date") or "") >= today:
                upcoming.append(r)
            continue
        done.append((r, btc))
    if len(done) < 6:
        return None

    # 같은 만기(term)의 직전 6회 평균 대비 — '이번 경매가 평소보다 강했나'
    by_term: dict[str, list[float]] = {}
    for r, btc in reversed(done):  # 과거 → 최근 순으로 적립
        term = r.get("security_term") or "?"
        hist = by_term.setdefault(term, [])
        r["_avg_prev"] = round(sum(hist[-6:]) / len(hist[-6:]), 2) if hist else None
        hist.append(btc)

    recent = []
    for r, btc in done[:12]:
        indirect = fnum(r.get("indirect_bidder_accepted"))
        comp = fnum(r.get("comp_accepted"))
        recent.append({
            "date": r.get("auction_date"),
            "type": r.get("security_type"),
            "term": r.get("security_term"),
            "btc": round(btc, 2),
            "btcAvg6": r.get("_avg_prev"),
            "highYield": fnum(r.get("high_yield")),
            "offeringB": round(fnum(r.get("offering_amt")) / 1e9, 1) if fnum(r.get("offering_amt")) else None,
            # 해외·실수요 수요 프록시: 간접입찰 낙찰 비중
            "indirectPct": round(indirect / comp * 100, 1) if indirect and comp else None,
        })

    coming = [{
        "date": r.get("auction_date"),
        "type": r.get("security_type"),
        "term": r.get("security_term"),
        "offeringB": round(fnum(r.get("offering_amt")) / 1e9, 1) if fnum(r.get("offering_amt")) else None,
    } for r in sorted(upcoming, key=lambda x: x.get("auction_date") or "")[:6]]

    return {
        "updatedAtKst": kst_now_str(),
        "asOf": recent[0]["date"] if recent else None,
        "source": "US Treasury FiscalData · Treasury Securities Auctions Data",
        "recent": recent,
        "upcoming": coming,
    }


def main() -> int:
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    print("=== 미 국채 경매 수요 수집 (FiscalData) ===")
    try:
        payload = build()
    except Exception as e:  # noqa: BLE001
        print(f"[auction] 수집 실패({type(e).__name__}: {e}) — 기존 파일 유지")
        return 1
    if not payload:
        print("[auction] 유효 데이터 없음 — 기존 파일 유지")
        return 1
    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    atomic_write_text(OUT_JSON, compact)
    atomic_write_text(OUT_JS, f"window.TREASURY_AUCTIONS = {compact};\n")
    print(f"완료 경매 {len(payload['recent'])}건, 예정 {len(payload['upcoming'])}건 → {OUT_JSON.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
