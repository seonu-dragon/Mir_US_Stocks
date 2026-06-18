#!/usr/bin/env python3
"""Publish auxiliary schedule snapshots (White House calendar) to the site repo."""

from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402
from fetch_white_house_schedule import build_white_house_payload  # noqa: E402

KST = ZoneInfo("Asia/Seoul")
OUT_JSON = ROOT / "data" / "white_house_schedule.json"
OUT_JS = ROOT / "data" / "white_house_schedule.js"


def _run_git(project_dir: Path, args, **kwargs):
    return subprocess.run(["git", *args], cwd=project_dir, **kwargs)


def _git_publish_data(project_dir: Path, commit_label: str, paths: list[str]) -> bool:
    remotes = _run_git(project_dir, ["remote"], capture_output=True, text=True, check=True)
    if not remotes.stdout.strip():
        print("  [Git] remote 미설정 — 로컬 저장만 완료")
        return True
    branch = _run_git(
        project_dir,
        ["branch", "--show-current"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()
    if not branch:
        raise RuntimeError("cannot publish from a detached HEAD")

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
        message = f"Auto-update schedule data ({commit_label}): {stamp} [skip ci]"
        _run_git(project_dir, ["commit", "-m", message, "--", *paths], check=True)

    last_error = None
    for attempt in range(1, 4):
        try:
            _run_git(project_dir, ["fetch", "origin", branch], check=True)
            _run_git(project_dir, ["pull", "--rebase", "origin", branch], check=True)
            _run_git(project_dir, ["push", "origin", branch], check=True)
            print(f"  [Git] origin/{branch} 일정 데이터 푸시 완료")
            return True
        except Exception as error:
            last_error = error
            if attempt < 3:
                print(f"  [Git] 푸시 시도 {attempt} 실패, 10초 후 재시도: {error}")
                import time
                time.sleep(10)
    raise RuntimeError(f"git publish failed after 3 attempts: {last_error}")


def write_white_house_files(payload: dict) -> None:
    body = json.dumps(payload, ensure_ascii=False, indent=2)
    atomic_write_text(OUT_JSON, body + "\n")
    atomic_write_text(
        OUT_JS,
        "window.WHITE_HOUSE_SCHEDULE = "
        + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
    )


def refresh_white_house_schedule(project_dir: Path | None = None, *, publish: bool = True) -> dict:
    """Fetch Factba.se calendar, write JSON/JS, optionally git-push."""
    project_dir = Path(project_dir or ROOT).resolve()
    payload = build_white_house_payload()
    paths = ["data/white_house_schedule.json", "data/white_house_schedule.js"]

    try:
        with repository_publish_lock(project_dir):
            write_white_house_files(payload)
            print(
                f"  [성공] 백악관 일정 {len(payload.get('events', []))}건 저장 "
                f"({payload.get('updatedAtKst', '-')})"
            )
            if publish:
                return payload if _git_publish_data(project_dir, "WH Schedule", paths) else payload
    except Exception as error:
        print(f"  [오류] 백악관 일정 갱신 실패: {error}")
        raise
    return payload


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Refresh White House schedule snapshot")
    parser.add_argument("--no-push", action="store_true")
    args = parser.parse_args()
    refresh_white_house_schedule(publish=not args.no_push)