#!/usr/bin/env python3
"""Incremental earnings history refresh for detail files."""

from __future__ import annotations

import argparse
import json
import re
import sys
import time

if sys.platform == "win32":
    # cp949 콘솔에서 한글 출력이 UnicodeEncodeError 로 죽어 빌드 실패로 둔갑한다.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402
from sec_client import git_publish  # noqa: E402
from update_data import DETAILS_DIR, fetch_earnings_history  # noqa: E402
from step_budget import StepBudget  # noqa: E402

KST = ZoneInfo("Asia/Seoul")
SNAPSHOT = ROOT / "data" / "market_snapshot.json"
CHECKPOINT = ROOT / "scratch" / "earnings_refresh_checkpoint.json"
# 신선도 감시용 스탬프. data/details/*.json 에는 실행 시각이 없어 이 빌더가 죽어도
# 알 길이 없었다 — 매 실행 결과를 여기 남기고 details 와 함께 커밋한다.
META = ROOT / "data" / "earnings_history_meta.json"
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
    atomic_write_text(
        CHECKPOINT,
        json.dumps({"done": sorted(done), "updatedAt": datetime.now(KST).isoformat()}, indent=2),
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


def load_next_offset() -> int:
    """직전 실행이 시간 예산에 걸려 멈춘 위치. 러너는 매번 새로라 scratch 체크포인트가 남지 않는다 —
    커밋되는 meta 에 적어 두고 다음 주는 거기서부터 돈다(뒤쪽 종목이 영영 안 도는 일을 막는다)."""
    try:
        return max(int(json.loads(META.read_text(encoding="utf-8")).get("nextOffset") or 0), 0)
    except Exception:
        return 0


def rotate(targets: list[str], offset: int) -> list[str]:
    if not targets:
        return targets
    k = offset % len(targets)
    return targets[k:] + targets[:k]


def refresh_all_incremental(
    *,
    tickers: list[str] | None = None,
    resume: bool = False,
    sleep_s: float = 0.08,
    fetch_limit: int = 4,
    budget: StepBudget | None = None,
    start_offset: int = 0,
) -> dict[str, int]:
    base = tickers or load_snapshot_tickers()
    targets = rotate(base, start_offset)
    done = load_checkpoint() if resume else set()
    updated = skipped = failed = 0
    processed = 0
    stopped = ""

    for ticker in targets:
        if budget and budget.over():
            stopped = budget.reason
            print(f"[중단] {stopped} — {processed}/{len(targets)}종목 처리, 다음 실행은 이어서 시작", flush=True)
            break
        processed += 1
        if processed % 500 == 0:
            el = f" · {budget.elapsed_min():.0f}분" if budget else ""
            print(f"[진행] {processed}/{len(targets)}{el}", flush=True)
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
            if budget:
                budget.record(False)
        else:
            if budget:
                budget.record(True)
        if updated and updated % 50 == 0:
            save_checkpoint(done)
        time.sleep(sleep_s)

    save_checkpoint(done)
    n = len(base)
    next_offset = ((start_offset + processed) % n) if (stopped and n) else 0
    return {"updated": updated, "skipped": skipped, "failed": failed, "total": len(targets),
            "processed": processed, "nextOffset": next_offset, "stoppedReason": stopped}


def write_meta(stats: dict) -> None:
    atomic_write_text(META, json.dumps({
        "updatedAtKst": datetime.now(KST).strftime("%Y-%m-%d %H:%M KST"),
        "source": "yahoo earningsHistory (incremental)",
        **{k: (int(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else v)
           for k, v in stats.items() if v not in (None, "")},
    }, ensure_ascii=False, indent=2) + "\n")


def publish_detail_changes(project_dir: Path, commit_label: str = "Earnings Refresh") -> bool:
    return git_publish(
        ["data/details", "data/earnings_history_meta.json"],
        f"earnings history ({commit_label})",
        cwd=project_dir,
    )


# 야후가 죽은 날 전량 실패해도 신선한 스탬프가 찍혀 감시가 무력화됐다
# (2026-09-15 감사). 실패 비율이 이 값을 넘으면 실패로 끝낸다.
MAX_FAILED_RATIO = 0.20


def main() -> int:
    parser = argparse.ArgumentParser(description="Incrementally refresh earningsHistory in detail files")
    parser.add_argument("--no-push", action="store_true")
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--sleep", type=float, default=0.08)
    parser.add_argument("--fetch-limit", type=int, default=4)
    parser.add_argument("--time-budget-min", type=float, default=0,
                        help="이 분이 지나면 멈추고 받은 데까지 발행(0=무제한). 멈춘 위치는 meta.nextOffset")
    args = parser.parse_args()

    with repository_publish_lock(ROOT):
        stats = refresh_all_incremental(
            resume=args.resume,
            sleep_s=args.sleep,
            fetch_limit=args.fetch_limit,
            budget=StepBudget(args.time_budget_min),
            start_offset=load_next_offset(),
        )
        print(
            f"updated={stats['updated']} skipped={stats['skipped']} "
            f"failed={stats['failed']} total={stats['total']}"
        )
        write_meta(stats)
        # 갱신 0건이어도 스탬프는 올린다 — 그래야 신선도 감시가 "돌긴 돌았다" 를 안다.
        # 다만 meta 에 failed 를 남기고, 실패 비율이 높으면 아래에서 exit 1 한다.
        if not args.no_push:
            if not publish_detail_changes(ROOT):
                print("[중단] 실적 이력 push 실패 — 발행되지 않았다")
                return 1

    attempted = int(stats.get("updated", 0)) + int(stats.get("failed", 0))
    if attempted and int(stats.get("failed", 0)) > attempted * MAX_FAILED_RATIO:
        print(
            f"[중단] 실적 이력 수집 실패 {stats['failed']}/{attempted}건 "
            f"({stats['failed'] / attempted:.0%} > {MAX_FAILED_RATIO:.0%}) — 소스를 확인할 것"
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())