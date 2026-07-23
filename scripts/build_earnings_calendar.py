#!/usr/bin/env python3
"""Build static earnings calendar snapshot for the market tab fallback."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

OUT_JSON = ROOT / "data" / "earnings_calendar.json"
OUT_JS = ROOT / "data" / "earnings_calendar.js"
KR_OUT_JSON = ROOT / "data" / "korea" / "earnings_calendar.json"
KR_OUT_JS = ROOT / "data" / "korea" / "earnings_calendar.js"

DEFAULT_US = [
    "NVDA", "MSFT", "AAPL", "AMZN", "META", "GOOGL", "AVGO", "TSLA", "BRK-B", "JPM",
    "LLY", "V", "UNH", "XOM", "MA", "COST", "HD", "PG", "JNJ", "ABBV",
    "NFLX", "CRM", "AMD", "ORCL", "BAC", "KO", "PEP", "MRK", "CVX", "WMT",
    "CSCO", "ACN", "LIN", "MCD", "TMO", "ABT", "ADBE", "WFC", "DIS", "INTC",
]


def kst_now_str() -> str:
    from zoneinfo import ZoneInfo
    return datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y-%m-%d %H:%M KST")


def load_tickers(market: str, limit: int) -> list[str]:
    if market == "kr":
        snap = ROOT / "data" / "korea" / "market_snapshot.json"
        if not snap.exists():
            return []
        payload = json.loads(snap.read_text(encoding="utf-8"))
        rows = sorted(
            (s for s in payload.get("stocks", []) if s.get("market") != "etf"),
            key=lambda s: float(s.get("marketCapB") or 0),
            reverse=True,
        )
        return [str(s["ticker"]).zfill(6) for s in rows[:limit]]
    snap = ROOT / "data" / "market_snapshot.json"
    if not snap.exists():
        return DEFAULT_US[:limit]
    payload = json.loads(snap.read_text(encoding="utf-8"))
    rows = sorted(
        (s for s in payload.get("stocks", []) if s.get("sector") not in {"ETF", "EXCHANGE TRADED FUNDS"}),
        key=lambda s: float(s.get("marketCapB") or 0),
        reverse=True,
    )
    tickers = [str(s["ticker"]).upper() for s in rows[:limit]]
    return tickers or DEFAULT_US[:limit]


_KR_YAHOO_MAP: dict | None = None


def _kr_yahoo_map() -> dict:
    """KR 스냅샷의 yahooSymbol 맵(코스닥 .KQ 포함). 무조건 .KS 를 붙이면
    코스닥 종목이 전부 조회 실패한다."""
    global _KR_YAHOO_MAP
    if _KR_YAHOO_MAP is None:
        _KR_YAHOO_MAP = {}
        try:
            snap = json.loads((ROOT / "data" / "korea" / "market_snapshot.json").read_text(encoding="utf-8"))
            for s in snap.get("stocks", []):
                if s.get("ticker") and s.get("yahooSymbol"):
                    _KR_YAHOO_MAP[str(s["ticker"]).zfill(6)] = s["yahooSymbol"]
        except Exception:
            pass
    return _KR_YAHOO_MAP


def yahoo_symbol(ticker: str, market: str) -> str:
    if market == "kr":
        code = str(ticker).zfill(6)
        return _kr_yahoo_map().get(code) or f"{code}.KS"
    return str(ticker).upper().replace(".", "-")


def fetch_next_earnings(ticker: str, market: str) -> dict | None:
    try:
        import yfinance as yf
    except ImportError:
        return None
    symbol = yahoo_symbol(ticker, market)
    try:
        cal = yf.Ticker(symbol).calendar
    except Exception:
        cal = None
    next_date = None
    eps_estimate = None
    if isinstance(cal, dict):
        dates = cal.get("Earnings Date") or cal.get("Earnings Date".lower())
        if dates is None and hasattr(cal, "get"):
            dates = cal.get("Earnings Date")
        if isinstance(dates, list) and dates:
            next_date = dates[0]
        elif dates:
            next_date = dates
        avg = cal.get("Earnings Average")
        if avg is not None:
            try:
                eps_estimate = round(float(avg), 4)
            except (TypeError, ValueError):
                eps_estimate = None
    if not next_date:
        try:
            frame = yf.Ticker(symbol).earnings_dates
        except Exception:
            frame = None
        if frame is not None and not getattr(frame, "empty", True):
            today = date.today()
            # earnings_dates 는 날짜 내림차순이라 앞에서 break 하면 "가장 먼"
            # 미래 분기를 잡는다. 미래 후보를 모아 가장 가까운 날을 쓴다.
            future = []
            for idx, row in frame.iterrows():
                reported = row.get("Reported EPS")
                if reported is None or (hasattr(reported, "__float__") and str(reported) == "nan"):
                    try:
                        d = idx.date() if hasattr(idx, "date") else date.fromisoformat(str(idx)[:10])
                    except Exception:
                        continue
                    if d >= today:
                        future.append((d, row))
            if future:
                next_date, row = min(future, key=lambda pair: pair[0])
                est = row.get("EPS Estimate")
                if est is not None and str(est) != "nan":
                    try:
                        eps_estimate = round(float(est), 4)
                    except (TypeError, ValueError):
                        pass
    if not next_date:
        return None
    if hasattr(next_date, "isoformat"):
        next_iso = next_date.isoformat()
    else:
        next_iso = str(next_date)[:10]
    return {
        "ticker": str(ticker).upper() if market != "kr" else str(ticker).zfill(6),
        "nextDate": next_iso,
        "epsEstimate": eps_estimate,
    }


def build(market: str, limit: int) -> dict:
    tickers = load_tickers(market, limit)
    earnings = []
    for ticker in tickers:
        row = fetch_next_earnings(ticker, market)
        if row:
            earnings.append(row)
    earnings.sort(key=lambda r: r.get("nextDate") or "")
    return {
        "market": market,
        "updatedAtKst": kst_now_str(),
        "count": len(earnings),
        "source": "Yahoo Finance via yfinance (build snapshot)",
        "earnings": earnings,
    }


def write_outputs(payload: dict, market: str) -> None:
    from sec_client import write_data
    if market == "kr":
        write_data(KR_OUT_JSON, KR_OUT_JS, "KOREA_EARNINGS_CALENDAR", payload)
        print(f"Wrote {KR_OUT_JSON} ({payload['count']} rows)")
    else:
        write_data(OUT_JSON, OUT_JS, "EARNINGS_CALENDAR_SNAPSHOT", payload)
        print(f"Wrote {OUT_JSON} ({payload['count']} rows)")


def main() -> None:
    ap = argparse.ArgumentParser(description="Build static earnings calendar snapshot")
    ap.add_argument("--market", choices=["us", "kr"], default="us")
    ap.add_argument("--limit", type=int, default=80)
    ap.add_argument("--push", action="store_true", default=False, help="빌드 후 data 파일을 커밋·푸시")
    args = ap.parse_args()
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    payload = build(args.market, args.limit)
    if not payload["earnings"]:
        # Yahoo가 0건을 주면(일시적 오류·레이트리밋) 기존 스냅샷을 덮어쓰지 않는다.
        print("  [경고] 실적 일정 0건 — 기존 파일 유지(덮어쓰지 않음)")
        return
    write_outputs(payload, args.market)
    if args.push:
        import sec_client as sec
        if args.market == "kr":
            sec.git_publish(["data/korea/earnings_calendar.json", "data/korea/earnings_calendar.js"], "KR earnings calendar")
        else:
            sec.git_publish(["data/earnings_calendar.json", "data/earnings_calendar.js"], "earnings calendar")


if __name__ == "__main__":
    main()