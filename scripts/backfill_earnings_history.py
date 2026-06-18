#!/usr/bin/env python3
"""Backfill earnings announcement history into data/details/*.json for earnings-reaction UI."""

from __future__ import annotations

import argparse
import json
import re
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
import sys

if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from earnings_history_store import merge_earnings_history, refresh_ticker  # noqa: E402
from update_data import DETAILS_DIR, fetch_earnings_history  # noqa: E402

SNAPSHOT = ROOT / "data" / "market_snapshot.json"
CHECKPOINT = ROOT / "scratch" / "earnings_history_checkpoint.json"


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


def load_checkpoint() -> set[str]:
    if not CHECKPOINT.exists():
        return set()
    try:
        payload = json.loads(CHECKPOINT.read_text(encoding="utf-8"))
        return set(payload.get("done") or [])
    except Exception:
        return set()


def save_checkpoint(done: set[str]) -> None:
    CHECKPOINT.parent.mkdir(parents=True, exist_ok=True)
    CHECKPOINT.write_text(
        json.dumps({"done": sorted(done), "updatedAt": datetime.now().isoformat()}, indent=2),
        encoding="utf-8",
    )


def needs_backfill(detail: dict, min_rows: int) -> bool:
    rows = detail.get("earningsHistory") or []
    return len(rows) < min_rows


def write_detail(ticker: str, detail: dict) -> None:
    path = DETAILS_DIR / f"{safe_name(ticker)}.json"
    path.write_text(json.dumps(detail, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill earningsHistory into detail files")
    parser.add_argument("--top", type=int, default=1500, help="시총 상위 N 종목")
    parser.add_argument("--all-missing", action="store_true", help="스냅샷 전체 종목 중 누락분")
    parser.add_argument("--ticker", action="append", default=[], help="특정 티커만 (복수 가능)")
    parser.add_argument("--min-rows", type=int, default=4, help="이 개수 미만이면 백필")
    parser.add_argument("--limit", type=int, default=12, help="티커당 최대 분기 수")
    parser.add_argument("--include-etf", action="store_true")
    parser.add_argument("--resume", action="store_true", help="체크포인트에 있는 티커 건너뛰기")
    parser.add_argument("--sleep", type=float, default=0.12, help="Yahoo 요청 간격(초)")
    args = parser.parse_args()

    by_ticker = load_snapshot_index()
    done = load_checkpoint() if args.resume else set()

    if args.ticker:
        targets = [by_ticker[t.upper()] for t in args.ticker if t.upper() in by_ticker]
    else:
        targets = sorted(
            by_ticker.values(),
            key=lambda s: float(s.get("marketCapB") or 0),
            reverse=True,
        )
        if not args.all_missing:
            targets = targets[: args.top]

    updated = skipped = failed = 0
    for stock in targets:
        if not args.include_etf and stock.get("sector") == "EXCHANGE TRADED FUNDS":
            skipped += 1
            continue
        ticker = str(stock["ticker"]).upper()
        if args.resume and ticker in done:
            skipped += 1
            continue
        path = DETAILS_DIR / f"{safe_name(ticker)}.json"
        if not path.exists():
            skipped += 1
            continue
        detail = json.loads(path.read_text(encoding="utf-8"))
        if not needs_backfill(detail, args.min_rows):
            skipped += 1
            done.add(ticker)
            continue
        try:
            history = fetch_earnings_history(ticker, limit=args.limit)
            if not history:
                failed += 1
                print(f"[skip] {ticker}: no earnings history")
                done.add(ticker)
                continue
            detail["earningsHistory"] = merge_earnings_history(
                detail.get("earningsHistory") or [],
                history,
                limit=args.limit,
            )
            write_detail(ticker, detail)
            updated += 1
            done.add(ticker)
            print(f"[ok] {ticker}: {len(history)} quarters")
        except Exception as exc:
            failed += 1
            print(f"[err] {ticker}: {exc}")
        if updated and updated % 25 == 0:
            save_checkpoint(done)
        time.sleep(args.sleep)

    save_checkpoint(done)
    print(f"updated={updated} skipped={skipped} failed={failed}")


if __name__ == "__main__":
    main()