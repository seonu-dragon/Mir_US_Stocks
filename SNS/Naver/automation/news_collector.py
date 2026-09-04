"""Collect domestic business news for the daily Naver content workflow.

The Naver Search API is used for discovery. Publisher pages are fetched only
to enrich the API title/description with article text when it is accessible.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from email.utils import parsedate_to_datetime
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo
import xml.etree.ElementTree as ET


KST = ZoneInfo("Asia/Seoul")
NAVER_NEWS_API = "https://openapi.naver.com/v1/search/news.json"
NAVER_ECONOMY_SECTION_URLS = (
    "https://news.naver.com/section/101",
    "https://news.naver.com/breakingnews/section/101/259",  # finance
    "https://news.naver.com/breakingnews/section/101/258",  # securities
    "https://news.naver.com/breakingnews/section/101/261",  # industry
    "https://news.naver.com/breakingnews/section/101/260",  # real estate
)
PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_QUERIES = (
    "한국 경제",
    "국내 증시 코스피 코스닥",
    "금리 환율 채권",
    "정부 경제 정책",
    "반도체 AI 배터리 자동차",
    "기업 실적 투자",
    "부동산 금융",
    "글로벌 경제 한국 영향",
)
USER_AGENT = "MirInvestmentNewsCollector/1.0"
VOID_HTML_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
TRACKING_PARAMS = {
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "fbclid",
    "gclid",
}


def load_env_file(path: Path) -> None:
    """Load a simple .env file without overwriting existing environment values."""
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("\"").strip("'")
        if key:
            os.environ.setdefault(key, value)


def clean_text(value: str) -> str:
    value = re.sub(r"<[^>]+>", " ", value or "")
    value = unescape(value)
    return re.sub(r"\s+", " ", value).strip()


def normalize_url(value: str) -> str:
    if not value:
        return ""
    parsed = urlparse(value)
    query = [
        (key, item)
        for key, item in parse_qsl(parsed.query, keep_blank_values=True)
        if key.lower() not in TRACKING_PARAMS and not key.lower().startswith("utm_")
    ]
    return urlunparse(
        (parsed.scheme.lower(), parsed.netloc.lower(), parsed.path, "", urlencode(query), "")
    )


def normalized_title(value: str) -> str:
    return re.sub(r"[^0-9a-zA-Z가-힣]", "", clean_text(value)).lower()


def parse_pub_date(value: str) -> datetime | None:
    try:
        parsed = parsedate_to_datetime(value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=KST)
        return parsed.astimezone(KST)
    except (TypeError, ValueError, OverflowError):
        return None


class _ArticleHTMLParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.meta_descriptions: list[str] = []
        self.paragraphs: list[str] = []
        self.json_ld_blocks: list[str] = []
        self.article_containers: list[str] = []
        self._capture_p = False
        self._capture_json_ld = False
        self._article_depth = 0
        self._article_buffer: list[str] = []
        self._buffer: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = {key.lower(): value or "" for key, value in attrs}
        classes = set(attributes.get("class", "").split())
        is_article_container = attributes.get("id") in {"dic_area", "newsct_article"} or bool(
            classes.intersection({"article_body", "news_end", "article-content"})
        )
        if self._article_depth and tag not in VOID_HTML_TAGS:
            self._article_depth += 1
        elif is_article_container:
            self._article_depth = 1
            self._article_buffer = []
        if tag == "meta":
            label = (attributes.get("property") or attributes.get("name", "")).lower()
            if label in {"og:description", "description", "twitter:description"}:
                content = clean_text(attributes.get("content", ""))
                if content:
                    self.meta_descriptions.append(content)
        elif tag == "p":
            self._capture_p = True
            self._buffer = []
        elif tag == "script" and "ld+json" in attributes.get("type", "").lower():
            self._capture_json_ld = True
            self._buffer = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "p" and self._capture_p:
            paragraph = clean_text(" ".join(self._buffer))
            if len(paragraph) >= 35:
                self.paragraphs.append(paragraph)
            self._capture_p = False
            self._buffer = []
        elif tag == "script" and self._capture_json_ld:
            block = "".join(self._buffer).strip()
            if block:
                self.json_ld_blocks.append(block)
            self._capture_json_ld = False
            self._buffer = []
        if self._article_depth:
            self._article_depth -= 1
            if self._article_depth == 0:
                article_text = clean_text(" ".join(self._article_buffer))
                if article_text:
                    self.article_containers.append(article_text)
                self._article_buffer = []

    def handle_data(self, data: str) -> None:
        if self._capture_p or self._capture_json_ld:
            self._buffer.append(data)
        if self._article_depth:
            self._article_buffer.append(data)


class _NaverSectionParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.items: list[dict[str, str]] = []
        self._current: dict[str, str] | None = None
        self._field = ""
        self._field_tag = ""
        self._buffer: list[str] = []

    def _finish_current(self) -> None:
        if self._current and self._current.get("url") and self._current.get("title"):
            self.items.append(self._current)
        self._current = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = {key.lower(): value or "" for key, value in attrs}
        classes = set(attributes.get("class", "").split())
        if tag == "a" and "sa_text_title" in classes:
            self._finish_current()
            self._current = {"url": attributes.get("href", "")}
        field = ""
        if "sa_text_strong" in classes:
            field = "title"
        elif "sa_text_lede" in classes:
            field = "description"
        elif "sa_text_press" in classes:
            field = "publisher"
        if field and self._current is not None:
            self._field = field
            self._field_tag = tag
            self._buffer = []

    def handle_endtag(self, tag: str) -> None:
        if self._field and tag == self._field_tag and self._current is not None:
            self._current[self._field] = clean_text(" ".join(self._buffer))
            self._field = ""
            self._field_tag = ""
            self._buffer = []

    def handle_data(self, data: str) -> None:
        if self._field:
            self._buffer.append(data)

    def close(self) -> None:
        super().close()
        self._finish_current()


def _find_article_bodies(value: object) -> Iterable[str]:
    if isinstance(value, dict):
        body = value.get("articleBody")
        if isinstance(body, str) and body.strip():
            yield clean_text(body)
        for child in value.values():
            yield from _find_article_bodies(child)
    elif isinstance(value, list):
        for child in value:
            yield from _find_article_bodies(child)


def extract_article_text(html: str, max_chars: int = 8_000) -> tuple[str, str]:
    parser = _ArticleHTMLParser()
    try:
        parser.feed(html)
    except Exception:
        pass

    if parser.article_containers:
        body = max(parser.article_containers, key=len)
        if len(body) >= 200:
            return body[:max_chars], "publisher_article_container"

    for block in parser.json_ld_blocks:
        try:
            bodies = list(_find_article_bodies(json.loads(block)))
        except (json.JSONDecodeError, TypeError):
            continue
        if bodies:
            body = max(bodies, key=len)
            if len(body) >= 200:
                return body[:max_chars], "publisher_json_ld"

    unique_paragraphs: list[str] = []
    seen: set[str] = set()
    for paragraph in parser.paragraphs:
        key = normalized_title(paragraph)
        if key and key not in seen:
            seen.add(key)
            unique_paragraphs.append(paragraph)
    paragraph_text = "\n\n".join(unique_paragraphs)
    if len(paragraph_text) >= 300:
        return paragraph_text[:max_chars], "publisher_paragraphs"

    if parser.meta_descriptions:
        description = max(parser.meta_descriptions, key=len)
        if len(description) >= 80:
            return description[:max_chars], "publisher_meta"
    return "", ""


@dataclass(frozen=True)
class CollectorConfig:
    hours: int = 24
    display_per_query: int = 50
    max_articles: int = 50
    fetch_bodies: bool = True
    request_delay: float = 0.15
    timeout: int = 12
    source: str = "auto"


class NewsCollector:
    def __init__(self, client_id: str, client_secret: str, config: CollectorConfig) -> None:
        self.client_id = client_id
        self.client_secret = client_secret
        self.config = config
        self._naver_disabled_reason = ""
        self._section_items_returned = False

    def _request_json(self, query: str) -> list[dict]:
        params = urlencode(
            {
                "query": query,
                "display": min(max(self.config.display_per_query, 1), 100),
                "start": 1,
                "sort": "date",
            }
        )
        request = Request(
            f"{NAVER_NEWS_API}?{params}",
            headers={
                "X-Naver-Client-Id": self.client_id,
                "X-Naver-Client-Secret": self.client_secret,
                "User-Agent": USER_AGENT,
                "Accept": "application/json",
            },
        )
        try:
            with urlopen(request, timeout=self.config.timeout) as response:
                payload = json.loads(response.read().decode("utf-8"))
            return payload.get("items", [])
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Naver News API HTTP {exc.code}: {detail[:300]}") from exc
        except (URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise RuntimeError(f"Naver News API request failed: {exc}") from exc

    def _request_google_rss(self, query: str) -> list[dict]:
        rss_query = f"{query} when:{max(self.config.hours, 1)}h"
        params = urlencode({"q": rss_query, "hl": "ko", "gl": "KR", "ceid": "KR:ko"})
        request = Request(
            f"https://news.google.com/rss/search?{params}",
            headers={"User-Agent": USER_AGENT, "Accept": "application/rss+xml,application/xml"},
        )
        try:
            with urlopen(request, timeout=self.config.timeout) as response:
                root = ET.fromstring(response.read())
        except (HTTPError, URLError, TimeoutError, ET.ParseError) as exc:
            raise RuntimeError(f"Google News RSS request failed: {exc}") from exc

        items: list[dict] = []
        for node in root.findall(".//item"):
            source_node = node.find("source")
            items.append(
                {
                    "title": node.findtext("title", default=""),
                    "originallink": node.findtext("link", default=""),
                    "link": node.findtext("link", default=""),
                    "description": node.findtext("description", default=""),
                    "pubDate": node.findtext("pubDate", default=""),
                    "_publisher": clean_text(source_node.text if source_node is not None else ""),
                    "_discovery_source": "google_news_rss",
                }
            )
        return items

    def _request_naver_section(self) -> list[dict]:
        section_items: list[dict[str, str]] = []
        errors = []
        for section_url in NAVER_ECONOMY_SECTION_URLS:
            request = Request(
                section_url,
                headers={"User-Agent": USER_AGENT, "Accept-Language": "ko-KR,ko;q=0.9"},
            )
            try:
                with urlopen(request, timeout=self.config.timeout) as response:
                    charset = response.headers.get_content_charset() or "utf-8"
                    html = response.read(2_000_000).decode(charset, errors="replace")
            except (HTTPError, URLError, TimeoutError) as exc:
                errors.append(f"{section_url}: {exc}")
                continue
            parser = _NaverSectionParser()
            parser.feed(html)
            parser.close()
            section_items.extend(parser.items)
            if self.config.request_delay:
                time.sleep(self.config.request_delay)
        if not section_items:
            raise RuntimeError("Naver economy sections failed: " + "; ".join(errors))

        return [
            {
                "title": item.get("title", ""),
                "originallink": item.get("url", ""),
                "link": item.get("url", ""),
                "description": item.get("description", ""),
                "pubDate": "",
                "_publisher": item.get("publisher", ""),
                "_discovery_source": "naver_economy_section",
            }
            for item in section_items
        ]

    def _search(self, query: str) -> list[dict]:
        source = self.config.source.lower()
        if source not in {"auto", "naver", "naver-section", "google"}:
            raise ValueError("source must be one of: auto, naver, naver-section, google")

        can_use_naver = bool(self.client_id and self.client_secret and not self._naver_disabled_reason)
        if source in {"auto", "naver"} and can_use_naver:
            try:
                items = self._request_json(query)
                for item in items:
                    item["_discovery_source"] = "naver_search_api"
                return items
            except RuntimeError as exc:
                if "HTTP 401" in str(exc) or "HTTP 403" in str(exc):
                    self._naver_disabled_reason = str(exc)
                if source == "naver":
                    raise
                print(f"  [경고] 네이버 API 사용 불가, 공개 경제 섹션으로 전환: {exc}")

        if source == "naver":
            reason = self._naver_disabled_reason or "NAVER_CLIENT_ID/SECRET이 없습니다."
            raise RuntimeError(reason)

        if source in {"auto", "naver-section"} and not self._section_items_returned:
            try:
                self._section_items_returned = True
                return self._request_naver_section()
            except RuntimeError as exc:
                if source == "naver-section":
                    raise
                print(f"  [경고] 네이버 경제 섹션 수집 실패, Google 뉴스 RSS로 전환: {exc}")
        elif source == "naver-section":
            return []

        if source == "auto" and self._section_items_returned:
            return []
        return self._request_google_rss(query)

    def _fetch_body(self, url: str) -> tuple[str, str]:
        if not url.startswith(("http://", "https://")):
            return "", ""
        request = Request(
            url,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.5",
            },
        )
        try:
            with urlopen(request, timeout=self.config.timeout) as response:
                content_type = response.headers.get("Content-Type", "")
                if "html" not in content_type.lower():
                    return "", ""
                raw = response.read(2_000_000)
                charset = response.headers.get_content_charset() or "utf-8"
            return extract_article_text(raw.decode(charset, errors="replace"))
        except (HTTPError, URLError, TimeoutError, ValueError):
            return "", ""

    def collect(self, queries: Iterable[str], as_of: datetime | None = None) -> dict:
        as_of = (as_of or datetime.now(KST)).astimezone(KST)
        window_start = as_of - timedelta(hours=self.config.hours)
        query_list = list(queries)
        articles: dict[str, dict] = {}
        title_keys: dict[str, str] = {}
        errors: list[dict[str, str]] = []

        for query in query_list:
            print(f"[수집] {query}")
            try:
                items = self._search(query)
            except RuntimeError as exc:
                print(f"  [경고] {exc}")
                errors.append({"query": query, "error": str(exc)})
                continue

            for item in items:
                published = parse_pub_date(item.get("pubDate", ""))
                if published and not (window_start <= published <= as_of + timedelta(minutes=10)):
                    continue
                title = clean_text(item.get("title", ""))
                original_url = normalize_url(item.get("originallink") or item.get("link", ""))
                naver_url = normalize_url(item.get("link", ""))
                url_key = original_url or naver_url
                title_key = normalized_title(title)
                existing_key = url_key if url_key in articles else title_keys.get(title_key, "")
                if existing_key:
                    matched = articles[existing_key]["matched_queries"]
                    if query not in matched:
                        matched.append(query)
                    continue
                if not title or not url_key:
                    continue

                parsed_url = urlparse(original_url or naver_url)
                publisher = clean_text(item.get("_publisher", ""))
                article = {
                    "title": title,
                    "publisher": publisher,
                    "publisher_domain": parsed_url.netloc.lower().removeprefix("www."),
                    "published_at": published.isoformat() if published else "",
                    "original_url": original_url,
                    "naver_url": naver_url,
                    "summary": clean_text(item.get("description", "")),
                    "body": "",
                    "body_source": "",
                    "discovery_source": item.get("_discovery_source", "naver_search_api"),
                    "matched_queries": [query],
                }
                articles[url_key] = article
                if title_key:
                    title_keys[title_key] = url_key

        ordered = sorted(
            articles.values(),
            key=lambda item: (len(item["matched_queries"]), item["published_at"]),
            reverse=True,
        )[: self.config.max_articles]

        if self.config.fetch_bodies:
            for index, article in enumerate(ordered, 1):
                source_url = article["original_url"] or article["naver_url"]
                print(f"[본문 {index:02d}/{len(ordered):02d}] {article['publisher_domain']}")
                body, source = self._fetch_body(source_url)
                article["body"] = body
                article["body_source"] = source or "naver_summary"
                if self.config.request_delay:
                    time.sleep(self.config.request_delay)
        else:
            for article in ordered:
                article["body_source"] = "naver_summary"

        for article in ordered:
            article["analysis_text"] = article["body"] or article["summary"]

        return {
            "schema_version": 1,
            "collected_at": datetime.now(KST).isoformat(),
            "as_of": as_of.isoformat(),
            "window_start": window_start.isoformat(),
            "queries": query_list,
            "article_count": len(ordered),
            "errors": errors,
            "articles": ordered,
        }


def render_markdown(collection: dict) -> str:
    lines = [
        f"# 국내 주요 뉴스 수집본 ({collection['as_of'][:10]})",
        "",
        f"- 수집 시각: {collection['collected_at']}",
        f"- 분석 기준 시각: {collection['as_of']}",
        f"- 수집 범위 시작: {collection['window_start']}",
        f"- 기사 수: {collection['article_count']}",
        "",
    ]
    for index, article in enumerate(collection["articles"], 1):
        lines.extend(
            [
                f"## {index}. {article['title']}",
                "",
                f"- 발행: {article['published_at'] or '미확인'}",
                f"- 매체 도메인: {article['publisher_domain'] or '미확인'}",
                f"- 매체: {article.get('publisher') or article['publisher_domain'] or '미확인'}",
                f"- 발견 경로: {article.get('discovery_source', '미확인')}",
                f"- 원문: {article['original_url'] or article['naver_url']}",
                f"- 관련 검색군: {', '.join(article['matched_queries'])}",
                f"- 본문 출처: {article['body_source']}",
                "",
                article["analysis_text"],
                "",
            ]
        )
    return "\n".join(lines).rstrip() + "\n"


def save_collection(collection: dict, output_dir: Path) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    json_path = output_dir / "news_collection.json"
    markdown_path = output_dir / "news_collection.md"
    json_path.write_text(
        json.dumps(collection, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    markdown_path.write_text(render_markdown(collection), encoding="utf-8")
    return json_path, markdown_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="국내 주요 뉴스를 수집해 일일 입력 파일로 저장합니다.")
    parser.add_argument("--date", help="출력 날짜(YYYY-MM-DD), 기본값은 한국 시간 오늘")
    parser.add_argument("--hours", type=int, default=24, help="수집 시간 범위")
    parser.add_argument("--max-articles", type=int, default=50, help="최종 저장 기사 수")
    parser.add_argument("--display-per-query", type=int, default=50, help="검색군별 요청 기사 수")
    parser.add_argument("--no-fetch-bodies", action="store_true", help="원문 본문 보강을 생략")
    parser.add_argument(
        "--source",
        choices=("auto", "naver", "naver-section", "google"),
        default="auto",
        help="수집원. auto는 검색 API, 공개 경제 섹션, Google RSS 순으로 시도",
    )
    parser.add_argument("--query", action="append", dest="queries", help="검색어(여러 번 지정 가능)")
    parser.add_argument("--output-dir", type=Path, help="기본 날짜별 01_input 대신 사용할 경로")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    load_env_file(PROJECT_ROOT / ".env")
    client_id = os.getenv("NAVER_CLIENT_ID", "")
    client_secret = os.getenv("NAVER_CLIENT_SECRET", "")

    date_str = args.date or datetime.now(KST).strftime("%Y-%m-%d")
    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise SystemExit("--date는 YYYY-MM-DD 형식이어야 합니다.")
    now = datetime.now(KST)
    as_of = now if target_date == now.date() else datetime.combine(
        target_date, datetime.max.time(), tzinfo=KST
    )
    output_dir = args.output_dir or (
        PROJECT_ROOT / "SNS" / "Naver" / "02_daily_work" / date_str / "01_input"
    )

    config = CollectorConfig(
        hours=max(args.hours, 1),
        display_per_query=args.display_per_query,
        max_articles=max(args.max_articles, 1),
        fetch_bodies=not args.no_fetch_bodies,
        source=args.source,
    )
    try:
        collection = NewsCollector(client_id, client_secret, config).collect(
            args.queries or DEFAULT_QUERIES, as_of=as_of
        )
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc

    json_path, markdown_path = save_collection(collection, output_dir)
    print(f"\n완료: {collection['article_count']}개 기사")
    print(f"JSON: {json_path}")
    print(f"Markdown: {markdown_path}")
    return 0 if collection["article_count"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
