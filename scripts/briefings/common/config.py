import os
from pathlib import Path

from dotenv import load_dotenv

from repo import repo_root

env_path = repo_root() / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")


def validate_config(*, require_telegram: bool = False, require_gemini: bool = True):
    missing = []
    if require_gemini and not GEMINI_API_KEY:
        missing.append("GEMINI_API_KEY")
    if require_telegram:
        if not TELEGRAM_BOT_TOKEN:
            missing.append("TELEGRAM_BOT_TOKEN")
        if not TELEGRAM_CHAT_ID:
            missing.append("TELEGRAM_CHAT_ID")
    if missing:
        raise ValueError(f"Missing environment variables: {', '.join(missing)}")