"""Telegram summary notifications for Kiwoom content pipeline."""

from __future__ import annotations

import json
import os
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def send_telegram_message(text: str, retries: int = 3) -> bool:
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    if not bot_token or not chat_id:
        print("[Telegram] 설정이 없어 알림을 건너뜁니다.")
        return False

    request = Request(
        f"https://api.telegram.org/bot{bot_token}/sendMessage",
        data=json.dumps(
            {
                "chat_id": chat_id,
                "text": text,
                "disable_web_page_preview": False,
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
                    print("[Telegram] 알림 발송 완료")
                    return True
                print(f"[Telegram] 발송 실패: HTTP {response.status}")
        except HTTPError as exc:
            print(f"[Telegram] 발송 실패: HTTP {exc.code}")
        except (URLError, TimeoutError, OSError) as exc:
            print(f"[Telegram] 전송 시도 {attempt}/{retries} 실패: {exc}")
        if attempt < retries:
            time.sleep(3)
    return False


def send_summary_message(batch: str, today: str, results: list[dict], daily_page_url: str) -> bool:
    is_domestic = "국내" in batch
    header = "[키움 국내 주식 초안 생성 완료]" if is_domestic else "[키움 해외 주식 초안 생성 완료]"
    lines = [
        header,
        "",
        f"시간: {today}",
        f"생성 종목 수: {len(results)}개",
    ]
    if is_domestic:
        lines.append("선정 기준: 상승 확률 스캐너 상위 5개")
    else:
        lines.append("구성: 상승 확률 스캐너 10개 + 커뮤니티 언급 순위 5개")

    lines.extend(["", "종목:"])
    for idx, item in enumerate(results[:15], 1):
        lines.append(f"{idx}. {item.get('name', item.get('ticker'))} - {item.get('selected_type', '—')}")
    if len(results) > 15:
        lines.append(f"... 외 {len(results) - 15}개")

    lines.extend(["", "검수 페이지:", daily_page_url or "(Notion URL 없음)"])
    return send_telegram_message("\n".join(lines))


def send_error_message(batch: str, error: str) -> bool:
    return send_telegram_message(f"[키움 파이프라인 오류]\n배치: {batch}\n오류: {error[:800]}")