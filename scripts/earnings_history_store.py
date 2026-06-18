#!/usr/bin/env python3
"""Incremental earnings history refresh for detail files."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402
from update_data import DETAILS_DIR, fetch_earnings_history  # noqa: E402

KST = ZoneInfo("Asia/Seoul")
SNAPSHOT = ROOT / "data" / "market_snapshot.json"
CHECKPOINT = ROOT / "scratch" / "earnings_refresh_checkpoint.json"
MAX_QUARTERS = 12


def safe_name(ticker: str) -> str:
    safe = re.sub(r"[^A-Z0-9._-]", "_", ticker.upper())
    root = safe.split(".")[0]
    reserved = {
        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5",
        "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4",
        "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    }
    return f"_{safe}" if root in reserved else safe


def merge_earnings_history(existing: list[dict], fresh: list[dict], *, limit: int = MAX_QUARTERS) -> list[dict]:
    by_date: dict[str, dict] = {}
    for row in existing or []:
        date = str(row.get("date") or "")[:10]
        if date:
            by_date[date] = row
    for row in fresh or []:
        date = str(row.get("date") or "")[:10]
        if date:
            by_date[date] = row
    merged = sorted(by_date.values(), key=lambda item: item.get("date") or "")
    if len(merged) > limit:
        merged = merged[-limit:]
    return merged


def load_snapshot_tickers() -> list[str]:
    data = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    tickers = []
    for stock in data.get("stocks") or []:
        if stock.get("sector") == "EXCHANGE TRADED FUNDS":
            continue
        ticker = str(stock.get("ticker") or "").upper().strip()
        if ticker:
            tickers.append(ticker)
    return tickers


def load_checkpoint() -> set[str]:
    if not CHECKPOINT.exists():
        return set()
    try:
        return set(json.loads(CHECKPOINT.read_text(encoding="utf-8")).get("done") or [])
    except Exception:
        return set()


def save_checkpoint(done: set[str]) -> None:
    CHECKPOINT.parent.mkdir(parents=True, exist_ok=True)
    CHECKPOINT.write_text(
        json.dumps({"done": sorted(done), "updatedAt": datetime.now(KST).isoformat()}, indent=2),
        encoding="utf-8",
    )


def refresh_ticker(ticker: str, *, fetch_limit: int = 4) -> bool:
    path = DETAILS_DIR / f"{safe_name(ticker)}.json"
    if not path.exists():
        return False
    detail = json.loads(path.read_text(encoding="utf-8"))
    existing = detail.get("earningsHistory") or []
    fresh = fetch_earnings_history(ticker, limit=fetch_limit)
    if not fresh and not existing:
        return False
    merged = merge_earnings_history(existing, fresh)
    if merged == existing:
        return False
    detail["earningsHistory"] = merged
    atomic_write_text(path, json.dumps(detail, ensure_ascii=False, separators=(",", ":")))
    return True


def refresh_all_incremental(
    *,
    tickers: list[str] | None = None,
    resume: bool = False,
    sleep_s: float = 0.08,
    fetch_limit: int = 4,
) -> dict[str, int]:
    targets = tickers or load_snapshot_tickers()
    done = load_checkpoint() if resume else set()
    updated = skipped = failed = 0

    for ticker in targets:
        if resume and ticker in done:
            skipped += 1
            continue
        path = DETAILS_DIR / f"{safe_name(ticker)}.json"
        if not path.exists():
            skipped += 1
            done.add(ticker)
            continue
        try:
            changed = refresh_ticker(ticker, fetch_limit=fetch_limit)
            if changed:
                updated += 1
                print(f"[ok] {ticker}")
            else:
                skipped += 1
            done.add(ticker)
        except Exception as exc:
            failed += 1
            print(f"[err] {ticker}: {exc}")
        if updated and updated % 50 == 0:
            save_checkpoint(done)
        time.sleep(sleep_s)

    save_checkpoint(done)
    return {"updated": updated, "skipped": skipped, "failed": failed, "total": len(targets)}


def _run_git(project_dir: Path, args, **kwargs):
    return subprocess.run(["git", *args], cwd=project_dir, **kwargs)


def publish_detail_changes(project_dir: Path, commit_label: str = "Earnings Refresh") -> bool:
    paths = ["data/details"]
    remotes = _run_git(project_dir, ["remote"], capture_output=True, text=True, check=True)
    if not remotes.stdout.strip():
        return True
    branch = _run_git(
        project_dir,
        ["branch", "--show-current"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()
    if not branch:
        raise RuntimeError("detached HEAD")

    _run_git(project_dir, ["add", "--", *paths], check=True)
    status = _run_git(
        project_dir,
        ["status", "--porcelain", "--", *paths],
        capture_output=True,
        text=True,
        check=True,
    )
    if status.stdout.strip():
        stamp = datetime.now(KST).strftime("%Y-%m-%d %H:%M")
        msg = f"Auto-update earnings history ({commit_label}): {stamp} [skip ci]"
        _run_git(project_dir, ["commit", "-m", msg, "--", *paths], check=True)

    for attempt in range(1, 4):
        try:
            _run_git(project_dir, ["fetch", "origin", branch], check=True)
            _run_git(project_dir, ["pull", "--rebase", "origin", branch], check=True)
            _run_git(project_dir, ["push", "origin", branch], check=True)
            print(f"  [Git] origin/{branch} earnings history 푸시 완료")
            return True
        except Exception as error:
            if attempt < 3:
                print(f"  [Git] 푸시 시도 {attempt} 실패: {error}")
                time.sleep(10)
    return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Incrementally refresh earningsHistory in detail files")
    parser.add_argument("--no-push", action="store_true")
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--sleep", type=float, default=0.08)
    parser.add_argument("--fetch-limit", type=int, default=4)
    args = parser.parse_args()

    with repository_publish_lock(ROOT):
        stats = refresh_all_incremental(
            resume=args.resume,
            sleep_s=args.sleep,
            fetch_limit=args.fetch_limit,
        )
        print(
            f"updated={stats['updated']} skipped={stats['skipped']} "
            f"failed={stats['failed']} total={stats['total']}"
        )
        if not args.no_push and stats["updated"] > 0:
            publish_detail_changes(ROOT)


if __name__ == "__main__":
    main()