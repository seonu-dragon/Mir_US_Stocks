"""Auxiliary schedule refresh hooks for briefing pipelines."""

from __future__ import annotations

import sys
from pathlib import Path

if sys.platform == "win32":
    # cp949 콘솔에서 한글 출력이 UnicodeEncodeError 로 죽어 실행 실패로 둔갑한다.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def _scripts_dir() -> Path:
    return Path(__file__).resolve().parents[2]


def refresh_white_house_schedule_safe() -> bool:
    scripts = _scripts_dir()
    if str(scripts) not in sys.path:
        sys.path.insert(0, str(scripts))
    from schedule_store import refresh_white_house_schedule

    try:
        refresh_white_house_schedule(publish=True)
        return True
    except Exception as error:
        print(f"  [경고] 백악관 일정 갱신 실패 (브리핑은 계속): {error}")
        return False


def build_congress_trades_safe() -> bool:
    scripts = _scripts_dir()
    if str(scripts) not in sys.path:
        sys.path.insert(0, str(scripts))
    from build_congress_trades import build_payload, publish_payload, write_files
    from briefing_store import repository_publish_lock

    project_dir = scripts.parent
    try:
        with repository_publish_lock(project_dir):
            payload = build_payload()
            if not payload.get("tradeCount"):
                raise RuntimeError("의회 매매 0건 — 기존 파일을 덮지 않는다")
            write_files(payload)
            print(
                f"  [성공] 의회 매매 {payload['tradeCount']}건, "
                f"랭킹 {len(payload['rankings'])}명"
            )
            if not publish_payload(project_dir):
                raise RuntimeError("의회 매매 push 실패 — 발행되지 않았다")
        return True
    except Exception as error:
        print(f"  [경고] 의회 매매 스냅샷 실패: {error}")
        return False