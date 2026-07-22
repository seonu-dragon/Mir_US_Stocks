import re
import time

import requests

from config import TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID


def send_telegram_message(text):
    """텔레그램 메시지 전송 (HTML 파싱 오류 자동 우회 및 재시도 포함)"""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        print("  [경고] 텔레그램 설정이 없어 알림을 건너뜁니다.")
        return False

    safe_text = re.sub(r"&(?!amp;|lt;|gt;|quot;|apos;)", "&amp;", text)

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": safe_text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }

    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            response = requests.post(url, json=payload, timeout=15)
            if response.status_code == 200:
                print("  [성공] 텔레그램 메시지 발송 완료")
                return True
            if response.status_code == 400 and "can't parse entities" in response.text:
                print("  [경고] HTML 파싱 오류 감지. 태그 제거 후 일반 텍스트로 재전송 시도...")
                plain_text = (
                    text.replace("<b>", "")
                    .replace("</b>", "")
                    .replace("<i>", "")
                    .replace("</i>", "")
                    .replace("<code>", "")
                    .replace("</code>", "")
                    .replace("<pre>", "")
                    .replace("</pre>", "")
                )
                plain_text = re.sub(r"<a href='(.*?)'>(.*?)</a>", r"\2 (\1)", plain_text)
                plain_text = re.sub(r'<a href="(.*?)">(.*?)</a>', r"\2 (\1)", plain_text)
                plain_text = re.sub(r"<[^>]+>", "", plain_text)
                fallback_payload = {
                    "chat_id": TELEGRAM_CHAT_ID,
                    "text": "[파싱 오류 우회 평문 발송]\n" + plain_text,
                    "disable_web_page_preview": True,
                }
                fb_response = requests.post(url, json=fallback_payload, timeout=15)
                if fb_response.status_code == 200:
                    print("  [성공] 평문 변환 메시지 발송 완료")
                    return True
                print(f"  [오류] 평문 재전송 실패 ({fb_response.status_code}): {fb_response.text}")
                return False
            print(f"  [오류] 텔레그램 발송 실패 ({response.status_code}): {response.text}")
            return False
        except Exception as error:
            print(f"  [경고] 텔레그램 전송 시도 {attempt} 실패: {error}")
            if attempt < max_retries:
                time.sleep(3)
    print("  [오류] 최대 재시도 횟수 초과로 전송 실패")
    return False


def notify_briefing_status(label: str, phase: str):
    """브리핑 진행 상태를 텔레그램으로 알립니다. phase: start | complete | failed"""
    messages = {
        "start": f"{label} 작성중",
        "complete": f"{label} 작성완료",
        "failed": f"{label} 작성 실패",
    }
    message = messages.get(phase)
    if message:
        send_telegram_message(message)