"""Shared utilities for Kiwoom content automation."""

from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

KST = ZoneInfo("Asia/Seoul")
PROJECT_ROOT = Path(__file__).resolve().parents[1]


def load_env_file(path: Path | None = None) -> None:
    env_path = path or (PROJECT_ROOT / ".env")
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)
    _normalize_notion_token()


def _read_notion_token_from_env() -> str:
    for key in ("NOTION_TOKEN", "NOTION_ACCESS_TOKEN", "NOTION_API_KEY"):
        value = os.getenv(key, "").strip()
        if value:
            return value
    return ""


def notion_token() -> str:
    """Return Notion integration token (supports secret_ and ntn_ prefixes)."""
    load_env_file()
    return _read_notion_token_from_env()


def _normalize_notion_token() -> None:
    token = _read_notion_token_from_env()
    if token and not os.getenv("NOTION_TOKEN", "").strip():
        os.environ["NOTION_TOKEN"] = token


def now_kst() -> datetime:
    return datetime.now(KST)


def today_kst() -> str:
    return now_kst().strftime("%Y-%m-%d")


def paths() -> dict[str, Path]:
    return {
        "root": PROJECT_ROOT,
        "export": PROJECT_ROOT / "data" / "export",
        "analysis": PROJECT_ROOT / "data" / "export" / "analysis",
        "charts": PROJECT_ROOT / "outputs" / "charts",
        "posts": PROJECT_ROOT / "outputs" / "posts",
        "logs": PROJECT_ROOT / "outputs" / "logs",
        "prompts": PROJECT_ROOT / "prompts",
        # 쿨다운 원장은 **추적되는** 경로에 둔다. 예전엔 outputs/posts/*.json 이었는데
        # outputs/ 가 .gitignore 라 다른 머신·새 클론에서는 원장이 늘 비어 있었고
        # "같은 종목 3일 재등장 금지" 가 사실상 동작하지 않았다(2026-09-15 감사).
        "cooldown_ledger": PROJECT_ROOT / "data" / "kiwoom_cooldown.json",
    }


def load_json(path: str | Path) -> dict:
    file_path = Path(path)
    if not file_path.is_absolute():
        file_path = PROJECT_ROOT / file_path
    with file_path.open(encoding="utf-8") as fh:
        return json.load(fh)


def save_json(path: str | Path, payload: dict) -> Path:
    file_path = Path(path)
    if not file_path.is_absolute():
        file_path = PROJECT_ROOT / file_path
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return file_path


def analysis_path(market: str, ticker: str) -> Path:
    return PROJECT_ROOT / "data" / "export" / "analysis" / market / f"{ticker}.json"


def detail_json_path(market: str, ticker: str) -> Path:
    if market.upper() == "KR":
        return PROJECT_ROOT / "data" / "korea" / "details" / f"{ticker}.json"
    return PROJECT_ROOT / "data" / "details" / f"{ticker}.json"


def chart_output_path(market: str, ticker: str, date_str: str | None = None) -> Path:
    day = date_str or today_kst().replace("-", "")
    filename = f"{market.upper()}_{ticker}_{day}.png"
    return PROJECT_ROOT / "outputs" / "charts" / filename