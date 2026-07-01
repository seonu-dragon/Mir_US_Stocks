#!/usr/bin/env python3
"""Kiwoom pipeline 연결 상태 점검 (Notion / Telegram / Gemini)."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

AUTOMATION_DIR = Path(__file__).resolve().parent
if str(AUTOMATION_DIR) not in sys.path:
    sys.path.insert(0, str(AUTOMATION_DIR))

from utils import load_env_file, notion_token  # noqa: E402


def check_env() -> list[str]:
    load_env_file()
    required = [
        "GEMINI_API_KEY",
        "NOTION_DATABASE_ID",
        "TELEGRAM_BOT_TOKEN",
        "TELEGRAM_CHAT_ID",
    ]
    missing = [key for key in required if not os.getenv(key, "").strip()]
    if not notion_token():
        missing.append("NOTION_TOKEN")
    optional = os.getenv("SITE_BASE_URL", "").strip()
    print("[env] SITE_BASE_URL:", optional or "(미설정 — 로컬 HTTP 서버 사용)")
    if missing:
        print("[env] missing:", ", ".join(missing))
    else:
        print("[env] all required keys present")
    return missing


def check_notion() -> bool:
    try:
        from notion_client import _database_id, _get_notion_client

        client = _get_notion_client()
        db = client.databases.retrieve(database_id=_database_id())
        title = ""
        for part in db.get("title", []):
            title += part.get("plain_text", "")
        print(f"[notion] OK — {title or db.get('id')}")
        return True
    except Exception as exc:
        print(f"[notion] FAIL — {exc}")
        return False


def check_telegram() -> bool:
    try:
        from telegram_client import send_telegram_message

        ok = send_telegram_message("[키움 파이프라인] 연결 테스트 — verify_setup.py")
        print("[telegram]", "OK" if ok else "FAIL")
        return ok
    except Exception as exc:
        print(f"[telegram] FAIL — {exc}")
        return False


def check_gemini() -> bool:
    try:
        from gemini_client import GeminiClient

        client = GeminiClient()
        result = client.generate_json('{"ping": true}라고만 담긴 JSON 객체를 반환하세요.')
        print("[gemini] OK —", json.dumps(result, ensure_ascii=False)[:120])
        return True
    except Exception as exc:
        print(f"[gemini] FAIL — {exc}")
        return False


def main() -> int:
    missing = check_env()
    if missing:
        return 1

    results = [
        check_notion(),
        check_telegram(),
        check_gemini(),
    ]
    if all(results):
        print("\n모든 연결 테스트 통과")
        return 0
    print("\n일부 연결 실패 — 위 로그를 확인하세요")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())