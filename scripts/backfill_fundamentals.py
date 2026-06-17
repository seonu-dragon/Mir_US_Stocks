#!/usr/bin/env python3
"""기존 data/details/*.json 펀더멘털 백필 — Nasdaq + SEC + Yahoo(yfinance)."""

from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path

from update_data import DETAILS_DIR, fetch_fundamentals_backfill

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / "data" / "market_snapshot.json"


def safe_name(ticker: str) -> str:
    safe = re.sub(r"[^A-Z0-9._-]", "_", ticker.upper())
    root = safe.split(".")[0]
    reserved = {
        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5",
        "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4",
        "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    }
    return f"_{safe}" if root in reserved else safe


def load_snapshot_index():
    data = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    return {str(s["ticker"]).upper(): s for s in data.get("stocks") or []}


def needs_backfill(detail: dict, min_fields: int) -> bool:
    fundamentals = detail.get("fundamentals") or {}
    return len(fundamentals) < min_fields


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--top", type=int, default=2000, help="시총 상위 N 중 백필 대상")
    parser.add_argument("--all-missing", action="store_true", help="모든 detail 파일 중 누락분")
    parser.add_argument("--min-fields", type=int, default=10, help="이 필드 수 미만이면 백필")
    parser.add_argument("--include-etf", action="store_true", help="ETF도 백필 시도")
    args = parser.parse_args()

    by_ticker = load_snapshot_index()
    tickers = sorted(
        by_ticker.values(),
        key=lambda s: float(s.get("marketCapB") or 0),
        reverse=True,
    )
    if not args.all_missing:
        tickers = tickers[: args.top]

    updated = skipped = failed = 0
    for stock in tickers:
        if not args.include_etf and stock.get("sector") == "EXCHANGE TRADED FUNDS":
            skipped += 1
            continue
        ticker = str(stock["ticker"]).upper()
        path = DETAILS_DIR / f"{safe_name(ticker)}.json"
        if not path.exists():
            continue
        detail = json.loads(path.read_text(encoding="utf-8"))
        if not needs_backfill(detail, args.min_fields):
            skipped += 1
            continue
        price = float(stock.get("price") or 0) or None
        cap = float(stock.get("marketCapB") or 0) or None
        try:
            merged = fetch_fundamentals_backfill(
                ticker, price_hint=price, market_cap_b=cap, min_fields=args.min_fields
            )
            if len(merged) < 3:
                failed += 1
                print(f"[skip] {ticker}: insufficient data")
                continue
            detail["fundamentals"] = merged
            path.write_text(json.dumps(detail, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
            js_path = DETAILS_DIR / f"{safe_name(ticker)}.js"
            js_path.write_text(
                "window.STOCK_DETAILS = window.STOCK_DETAILS || {};"
                f"window.STOCK_DETAILS[{json.dumps(ticker)}] = "
                f"{json.dumps(detail, ensure_ascii=False, separators=(',', ':'))};\n",
                encoding="utf-8",
            )
            updated += 1
            print(f"[ok] {ticker}: {len(merged)} fields ({merged.get('source', '?')})")
        except Exception as exc:
            failed += 1
            print(f"[err] {ticker}: {exc}")
        time.sleep(0.08)

    print(f"updated={updated} skipped={skipped} failed={failed}")


if __name__ == "__main__":
    main()