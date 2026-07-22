"""Generate Kiwoom community post drafts via Gemini."""

from __future__ import annotations

import json
from pathlib import Path

from angles import ANGLES, pick_angle  # noqa: F401  (재노출: 기존 import 호환)
from enrich_context import build_stock_context
from fetch_news import fetch_stock_news
from gemini_client import GeminiClient
from utils import paths


def load_prompt_template(name: str) -> str:
    prompt_path = paths()["prompts"] / name
    return prompt_path.read_text(encoding="utf-8")


def build_input_payload(
    target: dict,
    analysis: dict,
    batch_label: str,
    market: str,
    recent_news: list[dict] | None = None,
    angle: dict | None = None,
) -> dict:
    ticker = target.get("ticker", "")
    if recent_news is None:
        recent_news = fetch_stock_news(
            ticker=ticker, market=market, limit=3, name=target.get("name")
        )
    extra_context = build_stock_context(
        ticker, market, issue_tags=target.get("issue_tags")
    )
    return {
        "batch": batch_label,
        "angle": angle or {},
        "target": target,
        "analysis": analysis,
        "recent_news": recent_news,
        "extra_context": extra_context,
    }


def generate_post(
    target: dict,
    analysis: dict,
    chart_path: Path | None,
    batch_label: str = "",
    market: str = "KR",
    recent_news: list[dict] | None = None,
    client: GeminiClient | None = None,
    angle: dict | None = None,
    temperature: float = 0.95,
) -> dict:
    template = load_prompt_template("kiwoom_post_generation_prompt.md")
    payload = build_input_payload(target, analysis, batch_label, market, recent_news, angle)
    prompt = template.replace("{INPUT_JSON}", json.dumps(payload, ensure_ascii=False, indent=2))
    gemini = client or GeminiClient()
    result = gemini.generate_json(prompt, image_path=chart_path, temperature=temperature)

    required = ("ticker", "title", "body")
    for key in required:
        if not str(result.get(key, "")).strip():
            raise ValueError(f"Gemini 게시글 결과에 {key}가 필요합니다.")

    result.setdefault("name", target.get("name") or target.get("ticker"))
    result.setdefault("market", analysis.get("market") or market)
    result.setdefault("selected_type", (angle or {}).get("name", "뉴스/이슈형"))
    result.setdefault("quality_score", 70)
    return result
