#!/usr/bin/env python3
"""공매도 잔고(Short Interest) — Nasdaq 공시 API.

FINRA 격주 공매도 잔고를 Nasdaq quote API(종목별)로 수집한다. 잔고일수
(Days to Cover)가 높을수록 숏 커버에 오래 걸려 숏스퀴즈 가능성이 크다.
데이터가 한 달에 두 번만 갱신되므로 워크플로우는 주간 실행으로 충분하다.
"""

from __future__ import annotations

import argparse
import gzip
import json
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import sec_client as sec  # noqa: E402  (kst_now_str / write_data / git_publish 재사용)
from briefing_store import repository_publish_lock  # noqa: E402

OUT_JSON = ROOT / "data" / "short_interest.json"
OUT_JS = ROOT / "data" / "short_interest.js"
SNAPSHOT = ROOT / "data" / "market_snapshot.json"

NASDAQ_HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
    "Origin": "https://www.nasdaq.com",
    "Referer": "https://www.nasdaq.com/",
}

MAX_ROWS = 1500
PAUSE = 0.12


def nasdaq_short(ticker):
    url = f"https://api.nasdaq.com/api/quote/{urllib.parse.quote(ticker)}/short-interest?assetClass=stocks"
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers=NASDAQ_HEADERS)
            with urllib.request.urlopen(req, timeout=20) as r:
                raw = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    raw = gzip.decompress(raw)
                time.sleep(PAUSE)
                return json.loads(raw)
        except Exception:
            time.sleep(0.8 * (attempt + 1))
    return None


def _num(s):
    try:
        return float(str(s).replace(",", "").strip())
    except (TypeError, ValueError):
        return None


def universe(top):
    snap = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    stocks = [s for s in (snap.get("stocks") or []) if s.get("sector") != "EXCHANGE TRADED FUNDS"]
    stocks.sort(key=lambda s: float(s.get("marketCapB") or 0), reverse=True)
    if top and top > 0:
        stocks = stocks[:top]
    return [(str(s["ticker"]).upper(), s.get("company") or "") for s in stocks if s.get("ticker")]


def build(top):
    rows = []
    latest_settle = ""
    tickers = universe(top)
    print(f"  대상 종목: {len(tickers)}")
    done = 0
    for ticker, company in tickers:
        data = nasdaq_short(ticker)
        done += 1
        if done % 100 == 0:
            print(f"    진행 {done}/{len(tickers)} (수집 {len(rows)})")
        table = (((data or {}).get("data") or {}).get("shortInterestTable") or {})
        recs = table.get("rows") or []
        if not recs:
            continue
        cur = recs[0]
        shares = _num(cur.get("interest"))
        dtc = _num(cur.get("daysToCover"))
        if shares is None and dtc is None:
            continue
        change = None
        if len(recs) > 1:
            prev = _num(recs[1].get("interest"))
            if prev and shares is not None:
                change = round((shares / prev - 1) * 100, 1)
        settle = cur.get("settlementDate") or ""
        if settle > latest_settle:
            latest_settle = settle
        rows.append({
            "ticker": ticker,
            "company": company,
            "shortShares": shares,
            "daysToCover": dtc,
            "avgVolume": _num(cur.get("avgDailyShareVolume")),
            "changePct": change,
            "settlementDate": settle,
        })

    rows.sort(key=lambda r: (r.get("daysToCover") or 0), reverse=True)
    rows = rows[:MAX_ROWS]
    payload = {
        "updatedAtKst": sec.kst_now_str(),
        "settlementDate": latest_settle,
        "count": len(rows),
        "source": "Nasdaq / FINRA Short Interest",
        "note": "격주 공시. 잔고일수(Days to Cover)=공매도주식수÷평균거래량. 높을수록 숏 커버 부담↑. (Nasdaq 상장 종목 한정)",
        "rows": rows,
    }
    print(f"  완료: {len(rows)}종목 (기준일 {latest_settle})")
    return payload


def main():
    ap = argparse.ArgumentParser(description="공매도 잔고 수집 (Nasdaq)")
    ap.add_argument("--top", type=int, default=700, help="시총 상위 N 종목")
    ap.add_argument("--push", action="store_true", default=False)
    ap.add_argument("--no-push", action="store_true")
    args = ap.parse_args()
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    print("=== 공매도 잔고 수집 시작 ===")
    payload = build(args.top)
    if not payload["rows"]:
        print("  [경고] 수집 0건 — 기존 파일 유지(덮어쓰지 않음)")
        return
    with repository_publish_lock(ROOT):
        sec.write_data(OUT_JSON, OUT_JS, "SHORT_INTEREST", payload)
        print(f"Wrote {OUT_JSON} — {payload['count']} rows")
        if args.push and not args.no_push:
            sec.git_publish(["data/short_interest.json", "data/short_interest.js"], "short interest")


if __name__ == "__main__":
    main()
