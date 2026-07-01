"""Generate Kiwoom community post drafts via Gemini."""

from __future__ import annotations

import json
from pathlib import Path

from gemini_client import GeminiClient
from utils import PROJECT_ROOT, paths


def load_prompt_template(name: str) -> str:
    prompt_path = paths()["prompts"] / name
    return prompt_path.read_text(encoding="utf-8")


def build_input_payload(target: dict, analysis: dict, batch_label: str) -> dict:
    return {
        "batch": batch_label,
        "target": target,
        "analysis": analysis,
    }


def generate_post(
    target: dict,
    analysis: dict,
    chart_path: Path | None,
    batch_label: str = "",
    client: GeminiClient | None = None,
) -> dict:
    template = load_prompt_template("kiwoom_post_generation_prompt.md")
    payload = build_input_payload(target, analysis, batch_label)
    prompt = template.replace("{INPUT_JSON}", json.dumps(payload, ensure_ascii=False, indent=2))
    gemini = client or GeminiClient()
    result = gemini.generate_json(prompt, image_path=chart_path)

    required = ("ticker", "title", "body", "selected_type")
    for key in required:
        if not str(result.get(key, "")).strip():
            raise ValueError(f"Gemini 게시글 결과에 {key}가 필요합니다.")

    result.setdefault("name", target.get("name") or target.get("ticker"))
    result.setdefault("market", analysis.get("market") or "US")
    result.setdefault("disclaimer", "매수·매도 추천이 아닌 차트 기준 체크포인트입니다.")
    result.setdefault("question_for_comments", "이 구간은 어떻게 보시나요?")
    result.setdefault("hashtags", ["차트분석"])
    result.setdefault("quality_score", 70)
    return result