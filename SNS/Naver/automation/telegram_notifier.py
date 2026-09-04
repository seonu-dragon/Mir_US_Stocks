"""Telegram status notifications for automated news pipelines."""

from __future__ import annotations

import json
import os
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def send_telegram_message(text: str, retries: int = 3) -> bool:
    """Send a plain-text Telegram message without interrupting the pipeline."""
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    if not bot_token or not chat_id:
        print("[Telegram] 설정이 없어 상태 알림을 건너뜁니다.")
        return False

    request = Request(
        f"https://api.telegram.org/bot{bot_token}/sendMessage",
        data=json.dumps(
            {
                "chat_id": chat_id,
                "text": text,
                "disable_web_page_preview": True,
            },
            ensure_ascii=False,
        ).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    for attempt in range(1, retries + 1):
        try:
            with urlopen(request, timeout=15) as response:
                if 200 <= response.status < 300:
                    print("[Telegram] 상태 알림 발송 완료")
                    return True
                print(f"[Telegram] 발송 실패: HTTP {response.status}")
        except HTTPError as exc:
            print(f"[Telegram] 발송 실패: HTTP {exc.code}")
        except (URLError, TimeoutError, OSError) as exc:
            print(f"[Telegram] 전송 시도 {attempt}/{retries} 실패: {exc}")
        if attempt < retries:
            time.sleep(3)

    print("[Telegram] 상태 알림 발송을 포기하고 파이프라인을 계속합니다.")
    return False


def notify_pipeline_status(phase: str) -> bool:
    messages = {
        "start": "국내 뉴스 데이터 수집 시작",
        "complete": "국내 뉴스 데이터 수집 완료",
        "failed": "국내 뉴스 데이터 수집 실패",
    }
    message = messages.get(phase)
    return send_telegram_message(message) if message else False
