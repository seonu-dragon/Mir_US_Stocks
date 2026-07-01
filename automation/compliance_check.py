"""Compliance check for generated Kiwoom posts."""

from __future__ import annotations

import json

from gemini_client import GeminiClient
from utils import paths


def check_compliance(post: dict, client: GeminiClient | None = None) -> dict:
    template = (paths()["prompts"] / "compliance_check_prompt.md").read_text(encoding="utf-8")
    prompt = template.replace("{POST_JSON}", json.dumps(post, ensure_ascii=False, indent=2))
    gemini = client or GeminiClient()
    result = gemini.generate_json(prompt)

    result.setdefault("pass", True)
    result.setdefault("risk_level", "low")
    result.setdefault("issues", [])
    result.setdefault("fix_suggestions", [])
    result.setdefault("safe_version", post.get("body", ""))
    return result