"""Collect 50 domestic news articles and create a Gemini Top 5 brief."""

from __future__ import annotations

import argparse
import json
import os
import time
from datetime import datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from news_collector import (
    DEFAULT_QUERIES,
    KST,
    PROJECT_ROOT,
    CollectorConfig,
    NewsCollector,
    load_env_file,
    save_collection,
)
from telegram_notifier import notify_pipeline_status


GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
DEFAULT_GEMINI_MODEL = "gemini-2.0-flash"
GEMINI_MODEL_FALLBACKS = (
    "gemini-2.0-flash",
    "gemini-1.5-flash",
)
RETRYABLE_GEMINI_HTTP_CODES = frozenset({429, 500, 502, 503, 504})
SCORING_RUBRIC = {
    "market_impact": (30, "주식·채권·환율·원자재·산업에 미치는 시장 영향"),
    "timeliness": (20, "오늘 새롭게 발생했거나 중요하게 전개된 시의성"),
    "economic_reach": (15, "기업 하나를 넘어 산업·정책·거시경제로 확산되는 범위"),
    "investor_relevance": (15, "투자자가 확인하고 후속 판단할 실질적 필요성"),
    "evidence_strength": (10, "구체적 수치·공식 발표·복수 보도 등 근거의 강도"),
    "public_interest": (10, "독자 관심도와 검색 수요"),
}


def build_source_text(collection: dict, per_article_chars: int = 2_500) -> str:
    sections = []
    for index, article in enumerate(collection.get("articles", []), 1):
        text = article.get("analysis_text") or article.get("summary", "")
        sections.append(
            f"[기사 {index}]\n"
            f"제목: {article.get('title', '')}\n"
            f"매체: {article.get('publisher') or article.get('publisher_domain', '')}\n"
            f"발행: {article.get('published_at') or '미확인'}\n"
            f"URL: {article.get('original_url') or article.get('naver_url', '')}\n"
            f"본문: {text[:per_article_chars]}"
        )
    return "\n\n".join(sections)


def build_previous_section(previous: dict | None) -> tuple[str, str]:
    """Return (rule_line, context_block) injecting yesterday's published post."""
    if not previous:
        return "", ""
    prev_date = previous.get("date", "어제")
    prev_text = previous.get("text", "")
    rule_line = (
        f"7. 아래 [어제 발행한 경제 뉴스]와 사실상 같은 사건·주제는, 어제 발행분 이후 "
        f"'의미 있는 새로운 전개'(신규 수치·공식 발표·정책·이벤트·시장 반응 변화 등)가 있을 때만 선정한다. "
        f"어제와 같은 주제인데 새로 달라진 내용이 없으면 그 주제를 제외하고, 대신 어제 다루지 않은 다른 구별되는 주제를 선정한다. "
        f"어제와 주제가 겹치지만 내용이 실질적으로 달라졌다면 선정하되 무엇이 달라졌는지 continuity_from_yesterday에 적는다."
    )
    context_block = (
        f"\n[어제 발행한 경제 뉴스]\n"
        f"아래는 어제({prev_date}) 발행한 '오늘의 경제 뉴스' 글이다. "
        f"오늘 후보 주제가 이 내용과 겹치는지, 겹친다면 오늘 실질적으로 달라진 내용이 있는지 반드시 대조하라.\n"
        f"{prev_text}\n"
    )
    return rule_line, context_block


def build_prompt(collection: dict, previous: dict | None = None) -> str:
    rubric_lines = "\n".join(
        f"- {key}: {maximum}점 - {description}"
        for key, (maximum, description) in SCORING_RUBRIC.items()
    )
    dedup_rule, previous_block = build_previous_section(previous)
    dedup_rule_line = f"\n{dedup_rule}" if dedup_rule else ""
    return f"""당신은 한국 경제·금융 뉴스 편집장이다.

아래 수집 기사 {collection.get('article_count', 0)}건을 먼저 동일 사건·주제별로 묶어라. 여러 기사가 같은 사건을 다루면 하나의 후보 주제로 통합하고, 단순히 기사 한 건을 고르는 방식으로 처리하지 마라.

[Top 5 평가 기준: 총 100점]
{rubric_lines}

[선정 규칙]
1. 각 후보 주제를 위 기준으로 채점한 뒤 총점이 높은 주제 5개를 고른다.
2. 사실상 같은 이슈를 중복 선정하지 않는다.
3. 특정 기업·산업 한 분야는 최대 2개까지만 허용해 오늘 시장 전체를 균형 있게 보여준다.
4. 광고성·단순 홍보성·의견만 있고 새로운 사실이 없는 기사는 제외한다.
5. 제공된 기사에 없는 사실을 만들지 않는다. 불확실한 내용은 risks_or_uncertainties에 명시한다.
6. source_article_ids에는 아래 [기사 N] 번호만 정수로 넣고, 각 주제마다 근거 기사 1개 이상을 연결한다.{dedup_rule_line}

[출력]
마크다운 없이 다음 구조의 JSON 객체만 출력한다.
{{
  "topics": [
    {{
      "title": "주제를 대표하는 명확한 제목",
      "scores": {{
        "market_impact": 0,
        "timeliness": 0,
        "economic_reach": 0,
        "investor_relevance": 0,
        "evidence_strength": 0,
        "public_interest": 0
      }},
      "summary": "핵심 사실과 맥락을 담은 3~5문장",
      "why_important": "오늘 이 주제가 중요한 이유",
      "market_impact": "관련 시장·산업·기업에 예상되는 영향",
      "key_facts": ["검증 가능한 핵심 사실"],
      "source_article_ids": [1],
      "grok_research_requests": ["Grok이 추가 조사할 구체적 질문"],
      "risks_or_uncertainties": ["추가 확인이 필요한 내용"],
      "continuity_from_yesterday": "어제 발행분과의 관계. 어제와 무관한 새 주제면 null, 어제와 겹치는 주제면 오늘 새로 달라진 내용을 1~2문장으로 설명."
    }}
  ]
}}
{previous_block}
[수집 기사]
{build_source_text(collection)}
"""


def _clean_json_response(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1]
        cleaned = cleaned.rsplit("```", 1)[0]
    return json.loads(cleaned.strip())


def validate_analysis(payload: dict, article_count: int) -> dict:
    topics = payload.get("topics")
    if not isinstance(topics, list) or len(topics) != 5:
        raise ValueError("Gemini 결과에는 정확히 5개의 topics가 있어야 합니다.")

    validated = []
    for topic in topics:
        if not isinstance(topic, dict) or not str(topic.get("title", "")).strip():
            raise ValueError("모든 Top 5 항목에는 title이 필요합니다.")
        raw_scores = topic.get("scores")
        if not isinstance(raw_scores, dict):
            raise ValueError("모든 Top 5 항목에는 scores가 필요합니다.")
        scores = {}
        for key, (maximum, _) in SCORING_RUBRIC.items():
            value = raw_scores.get(key)
            if not isinstance(value, (int, float)) or not 0 <= value <= maximum:
                raise ValueError(f"{key} 점수는 0~{maximum} 범위여야 합니다.")
            scores[key] = int(round(value))

        source_ids = []
        for value in topic.get("source_article_ids", []):
            try:
                article_id = int(value)
            except (TypeError, ValueError):
                continue
            if 1 <= article_id <= article_count and article_id not in source_ids:
                source_ids.append(article_id)
        if not source_ids:
            raise ValueError("각 Top 5 항목에는 유효한 source_article_ids가 필요합니다.")

        normalized = dict(topic)
        normalized["scores"] = scores
        normalized["total_score"] = sum(scores.values())
        normalized["source_article_ids"] = source_ids
        for field in ("key_facts", "grok_research_requests", "risks_or_uncertainties"):
            value = normalized.get(field, [])
            normalized[field] = value if isinstance(value, list) else [str(value)]
        continuity = normalized.get("continuity_from_yesterday")
        if continuity is None or not str(continuity).strip() or str(continuity).strip().lower() == "null":
            normalized["continuity_from_yesterday"] = None
        else:
            normalized["continuity_from_yesterday"] = str(continuity).strip()
        validated.append(normalized)

    validated.sort(key=lambda item: item["total_score"], reverse=True)
    for rank, topic in enumerate(validated, 1):
        topic["rank"] = rank
    return {"topics": validated}


class GeminiTop5Analyzer:
    def __init__(
        self,
        api_key: str,
        model: str = DEFAULT_GEMINI_MODEL,
        timeout: int = 120,
        models: tuple[str, ...] | None = None,
    ) -> None:
        if not api_key:
            raise ValueError("GEMINI_API_KEY가 필요합니다.")
        self.api_key = api_key
        self.timeout = timeout
        ordered_models = []
        for candidate in (model, *GEMINI_MODEL_FALLBACKS):
            if candidate and candidate not in ordered_models:
                ordered_models.append(candidate)
        self.models = tuple(models or ordered_models)

    def _call(self, prompt: str, model: str) -> dict:
        url = f"{GEMINI_API_BASE}/{model}:generateContent"
        payload = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
            },
        }
        request = Request(
            url,
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": self.api_key,
                "User-Agent": "MirInvestmentDailyNews/1.0",
            },
            method="POST",
        )
        try:
            with urlopen(request, timeout=self.timeout) as response:
                result = json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            error = RuntimeError(f"Gemini HTTP {exc.code}: {detail[:500]}")
            error.http_code = exc.code  # type: ignore[attr-defined]
            raise error from exc
        except (URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise RuntimeError(f"Gemini 요청 실패: {exc}") from exc

        try:
            text = result["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError, TypeError) as exc:
            raise RuntimeError(f"Gemini 응답 형식을 읽을 수 없습니다: {result}") from exc
        return _clean_json_response(text)

    @staticmethod
    def _retry_delay(attempt: int, http_code: int | None) -> float:
        if http_code in RETRYABLE_GEMINI_HTTP_CODES:
            return min(15 * (2 ** (attempt - 1)), 120)
        return min(10 * attempt, 60)

    @staticmethod
    def _is_retryable(exc: Exception) -> bool:
        if isinstance(exc, (ValueError, json.JSONDecodeError)):
            return True
        http_code = getattr(exc, "http_code", None)
        if isinstance(http_code, int):
            if http_code in RETRYABLE_GEMINI_HTTP_CODES:
                return True
            if 400 <= http_code < 500:
                return False
        message = str(exc).lower()
        return any(token in message for token in ("timeout", "temporarily", "high demand", "unavailable"))

    def analyze(self, collection: dict, retries: int = 5, previous: dict | None = None) -> dict:
        prompt = build_prompt(collection, previous)
        last_error: Exception | None = None
        total_attempts = retries * len(self.models)
        attempt = 0
        for model in self.models:
            for model_attempt in range(1, retries + 1):
                attempt += 1
                try:
                    print(f"[Gemini] {model} 시도 {model_attempt}/{retries} (전체 {attempt}/{total_attempts})")
                    return validate_analysis(
                        self._call(prompt, model),
                        collection["article_count"],
                    )
                except (RuntimeError, ValueError, json.JSONDecodeError) as exc:
                    last_error = exc
                    print(f"[Gemini] {model} 시도 {model_attempt}/{retries} 실패: {exc}")
                    if attempt >= total_attempts:
                        break
                    if not self._is_retryable(exc):
                        break
                    time.sleep(self._retry_delay(model_attempt, getattr(exc, "http_code", None)))
            if attempt >= total_attempts:
                break
        raise RuntimeError("Gemini Top 5 생성이 모든 재시도에서 실패했습니다.") from last_error


def render_markdown(analysis: dict, collection: dict) -> str:
    article_lookup = {
        index: article for index, article in enumerate(collection.get("articles", []), 1)
    }
    labels = {
        "market_impact": "시장 영향력",
        "timeliness": "시의성",
        "economic_reach": "경제 파급 범위",
        "investor_relevance": "투자자 관련성",
        "evidence_strength": "근거 강도",
        "public_interest": "대중 관심도",
    }
    lines = [
        f"# {collection['as_of'][:10]} 국내 주요 뉴스 Top 5",
        "",
        f"> 수집 기사 {collection['article_count']}건을 사건별로 묶은 뒤 100점 기준으로 평가했습니다.",
        "",
        "## 선정 기준",
        "",
    ]
    for key, (maximum, description) in SCORING_RUBRIC.items():
        lines.append(f"- **{labels[key]} {maximum}점**: {description}")
    lines.extend(
        [
            "- 유사 사건은 하나로 통합하고, 특정 기업·산업은 최대 2개로 제한했습니다.",
            "- 광고성·단순 홍보성·새로운 사실이 없는 내용은 제외했습니다.",
            "",
        ]
    )

    for topic in analysis["topics"]:
        lines.extend(
            [
                f"## {topic['rank']}. {topic['title']} ({topic['total_score']}점)",
                "",
                "### 평가 점수",
                "",
            ]
        )
        for key, (maximum, _) in SCORING_RUBRIC.items():
            lines.append(f"- {labels[key]}: {topic['scores'][key]}/{maximum}")
        lines.extend(
            [
                "",
                f"**핵심 요약**: {topic.get('summary', '')}",
                "",
                f"**왜 중요한가**: {topic.get('why_important', '')}",
                "",
                f"**시장 영향**: {topic.get('market_impact', '')}",
                "",
            ]
        )
        continuity = topic.get("continuity_from_yesterday")
        if continuity:
            lines.extend([f"**어제와 달라진 점**: {continuity}", ""])
        lines.extend(["### 핵심 사실", ""])
        lines.extend(f"- {fact}" for fact in topic.get("key_facts", []))
        lines.extend(["", "### 근거 기사", ""])
        for article_id in topic["source_article_ids"]:
            article = article_lookup[article_id]
            url = article.get("original_url") or article.get("naver_url", "")
            publisher = article.get("publisher") or article.get("publisher_domain", "")
            lines.append(f"- [기사 {article_id}] [{article['title']}]({url}) - {publisher}")
        lines.extend(["", "### Grok 추가 조사 요청", ""])
        lines.extend(f"- {request}" for request in topic.get("grok_research_requests", []))
        uncertainties = [item for item in topic.get("risks_or_uncertainties", []) if item]
        if uncertainties:
            lines.extend(["", "### 확인 필요", ""])
            lines.extend(f"- {item}" for item in uncertainties)
        lines.append("")

    lines.extend(
        [
            "---",
            "",
            "## Grok 전달용 요청",
            "",
            "위 Top 5를 바탕으로 각 주제의 최신 추가 자료를 조사해 주세요.",
            "국내외 주요 언론, 정부·기업 공식 발표, 시장 데이터로 사실을 교차 검증하고",
            "새로 확인된 수치·반론·시장 영향·추가 확인 사항을 주제별로 정리해 주세요.",
            "결과는 `02_analysis/02_grok_phase2.md` 형식으로 작성해 주세요.",
            "",
        ]
    )
    return "\n".join(lines)


PREVIOUS_TEXT_BUDGET = 8_000


def _extract_topic_section(markdown: str) -> str:
    """Keep only the Top 5 topic blocks, dropping 선정 기준·Grok 전달용 요청 boilerplate."""
    lines = markdown.splitlines()
    kept: list[str] = []
    capturing = False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("## "):
            heading = stripped[3:]
            # 주제 블록은 "## 1. ..." 처럼 숫자로 시작한다.
            capturing = heading[:1].isdigit()
        if stripped == "---":
            capturing = False
        if capturing:
            kept.append(line)
    return "\n".join(kept).strip() or markdown.strip()


def load_previous_publication(daily_root: Path, date_str: str) -> dict | None:
    """Load the most recent prior day's published '오늘의 경제 뉴스' for dedup comparison.

    Returns {"date", "text"} where text combines yesterday's Gemini Top5(phase1)와
    있으면 Grok 심층분석(phase2) 주제 본문. 어제가 없으면 None.
    """
    if not daily_root.exists():
        return None
    prior_dates = sorted(
        entry.name
        for entry in daily_root.iterdir()
        if entry.is_dir() and entry.name < date_str
    )
    for prev_date in reversed(prior_dates):
        phase1 = daily_root / prev_date / "02_analysis" / "01_gemini_phase1.md"
        if not phase1.exists():
            continue
        sections = [f"# 어제({prev_date}) Top 5 주제", _extract_topic_section(phase1.read_text(encoding="utf-8"))]
        phase2 = daily_root / prev_date / "02_analysis" / "02_grok_phase2.md"
        if phase2.exists():
            sections.append(f"# 어제({prev_date}) 심층 분석")
            sections.append(_extract_topic_section(phase2.read_text(encoding="utf-8")))
        text = "\n\n".join(sections).strip()
        if len(text) > PREVIOUS_TEXT_BUDGET:
            text = text[:PREVIOUS_TEXT_BUDGET] + "\n…(이하 생략)"
        return {"date": prev_date, "text": text}
    return None


def write_status(path: Path, stage: str, details: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"stage": stage, "completed_at": datetime.now(KST).isoformat(), **details}
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="뉴스 50건 수집 후 Gemini Top 5를 생성합니다.")
    parser.add_argument("--date", help="작업 날짜(YYYY-MM-DD), 기본값은 한국 시간 오늘")
    parser.add_argument("--max-articles", type=int, default=50)
    parser.add_argument("--hours", type=int, default=24)
    parser.add_argument(
        "--source", choices=("auto", "naver", "naver-section", "google"), default="auto"
    )
    parser.add_argument("--model", default=os.getenv("GEMINI_MODEL", DEFAULT_GEMINI_MODEL))
    parser.add_argument("--work-dir", type=Path, help="테스트용 일일 작업 폴더 경로")
    parser.add_argument("--reuse-input", action="store_true", help="기존 news_collection.json 재사용")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    load_env_file(PROJECT_ROOT / ".env")
    date_str = args.date or datetime.now(KST).strftime("%Y-%m-%d")
    daily_dir = args.work_dir.resolve() if args.work_dir else (
        PROJECT_ROOT / "SNS" / "Naver" / "02_daily_work" / date_str
    )
    input_dir = daily_dir / "01_input"
    analysis_dir = daily_dir / "02_analysis"
    status_dir = daily_dir / "status"

    news_json = input_dir / "news_collection.json"
    news_markdown = input_dir / "news_collection.md"
    if args.reuse_input and news_json.exists():
        print(f"[수집] 기존 입력 재사용: {news_json}")
        collection = json.loads(news_json.read_text(encoding="utf-8"))
    else:
        collector = NewsCollector(
            os.getenv("NAVER_CLIENT_ID", ""),
            os.getenv("NAVER_CLIENT_SECRET", ""),
            CollectorConfig(
                hours=max(args.hours, 1),
                max_articles=max(args.max_articles, 5),
                fetch_bodies=True,
                source=args.source,
            ),
        )
        collection = collector.collect(DEFAULT_QUERIES)
        news_json, news_markdown = save_collection(collection, input_dir)
    if collection["article_count"] < 5:
        raise RuntimeError(f"Top 5 선정에 필요한 기사가 부족합니다: {collection['article_count']}건")
    write_status(
        status_dir / "01_collection.done",
        "collection",
        {"article_count": collection["article_count"], "input": str(news_json.relative_to(PROJECT_ROOT))},
    )

    previous = load_previous_publication(daily_dir.parent, date_str)
    if previous:
        print(f"[중복 확인] 어제 발행분({previous['date']})과 대조하여 주제를 선정합니다.")
    else:
        print("[중복 확인] 비교할 이전 발행분이 없어 중복 확인을 건너뜁니다.")

    print(f"[Gemini] {args.model}로 Top 5 선정 중...")
    analyzer = GeminiTop5Analyzer(os.getenv("GEMINI_API_KEY", ""), model=args.model)
    analysis = analyzer.analyze(collection, previous=previous)
    analysis_dir.mkdir(parents=True, exist_ok=True)
    output_path = analysis_dir / "01_gemini_phase1.md"
    output_path.write_text(render_markdown(analysis, collection), encoding="utf-8")
    write_status(
        status_dir / "02_gemini.done",
        "gemini_top5",
        {
            "model": args.model,
            "output": str(output_path.relative_to(PROJECT_ROOT)),
            "top5_scores": [topic["total_score"] for topic in analysis["topics"]],
            "compared_with": previous["date"] if previous else None,
            "carried_over_topics": [
                {"title": topic["title"], "continuity_from_yesterday": topic["continuity_from_yesterday"]}
                for topic in analysis["topics"]
                if topic.get("continuity_from_yesterday")
            ],
        },
    )

    print(f"수집 JSON: {news_json}")
    print(f"수집 Markdown: {news_markdown}")
    print(f"Gemini Top 5: {output_path}")
    return 0


def _run_with_telegram_status() -> int:
    notify_pipeline_status("start")
    try:
        exit_code = main()
    except BaseException:
        notify_pipeline_status("failed")
        raise

    if exit_code == 0:
        notify_pipeline_status("complete")
    else:
        notify_pipeline_status("failed")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(_run_with_telegram_status())
