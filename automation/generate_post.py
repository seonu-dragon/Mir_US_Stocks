"""Generate Kiwoom community post drafts via Gemini."""

from __future__ import annotations

import json
from pathlib import Path

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
) -> dict:
    ticker = target.get("ticker", "")
    recent_news = fetch_stock_news(ticker=ticker, market=market, limit=3)
    return {
        "batch": batch_label,
        "target": target,
        "analysis": analysis,
        "recent_news": recent_news,
    }


def generate_post(
    target: dict,
    analysis: dict,
    chart_path: Path | None,
    batch_label: str = "",
    market: str = "KR",
    client: GeminiClient | None = None,
) -> dict:
    template = load_prompt_template("kiwoom_post_generation_prompt.md")
    payload = build_input_payload(target, analysis, batch_label, market)
    prompt = template.replace("{INPUT_JSON}", json.dumps(payload, ensure_ascii=False, indent=2))
    gemini = client or GeminiClient()
    result = gemini.generate_json(prompt, image_path=chart_path)

    required = ("ticker", "title", "body", "selected_type")
    for key in required:
        if not str(result.get(key, "")).strip():
            raise ValueError(f"Gemini 게시글 결과에 {key}가 필요합니다.")

    result.setdefault("name", target.get("name") or target.get("ticker"))
    result.setdefault("market", analysis.get("market") or market)
    result.setdefault("disclaimer", "")
    result.setdefault("question_for_comments", "이 구간은 어떻게 보시나요?")
    result.setdefault("hashtags", ["차트", "관심종목"])
    result.setdefault("quality_score", 70)
    return result