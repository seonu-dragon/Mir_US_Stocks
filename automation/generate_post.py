"""Generate Kiwoom community post drafts via Gemini."""

from __future__ import annotations

import json
from pathlib import Path

from enrich_context import build_stock_context
from fetch_news import fetch_stock_news
from gemini_client import GeminiClient
from utils import paths

# 30개 글이 '도배'처럼 똑같이 느껴지지 않도록 글마다 다른 앵글(유형)을 배정한다.
# 각 앵글은 시작 방식·구성·초점이 달라 결과 글의 형식이 갈린다.
ANGLES: list[dict] = [
    {
        "name": "뉴스 반응형",
        "guide": "최근 뉴스 헤드라인 하나에 개인적으로 반응하듯. '이거 보고 좀 놀랐는데' 식으로 시작해 그 소식이 왜 의미 있는지 풀어준다.",
        "length": "2문단, 짧게",
    },
    {
        "name": "관찰 일지형",
        "guide": "며칠 지켜본 사람의 담담한 일지 톤. 결론을 내지 말고 관찰한 것만 늘어놓는다.",
        "length": "2~3문단",
    },
    {
        "name": "질문/토론형",
        "guide": "커뮤니티에 의견을 묻는 톤. 본인 생각을 짧게 던지고 '다들 어떻게 보세요?'로 열어둔다. 아주 짧아도 된다.",
        "length": "1~2문단, 매우 짧게",
    },
    {
        "name": "펀더멘털 관심형",
        "guide": "밸류에이션·실적 지표(PER/PBR/ROE/마진 등) 한두 개를 골라 '싼가 비싼가' 관점으로 짚는다. 숫자를 나열하지 말고 한두 개만.",
        "length": "2~3문단",
    },
    {
        "name": "수급/거래량형",
        "guide": "거래량 변화나 상대강도(시장 대비 세기)를 중심으로. '요즘 거래가 붙네' 같은 관찰.",
        "length": "2문단",
    },
    {
        "name": "차트 지지/저항형",
        "guide": "지지선·저항선 한 구간만 가볍게 언급하며 눌림/돌파 관점. 수치를 길게 늘어놓지 않는다.",
        "length": "2문단",
    },
    {
        "name": "섹터/테마 연결형",
        "guide": "종목이 속한 업종·테마 흐름과 엮어서. '이 섹터가 요즘' 하는 식으로 큰 그림에서 좁혀온다.",
        "length": "2~3문단",
    },
    {
        "name": "실적 모멘텀형",
        "guide": "실적 추정 상향(epsRevision)이나 다가오는 이벤트 기대감을 중심으로. 기대 반, 조심 반의 균형.",
        "length": "2~3문단",
    },
]


def pick_angle(index: int) -> dict:
    return ANGLES[index % len(ANGLES)]


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
