"""Notion integration for Kiwoom daily post review board."""

from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import Any

from utils import KST, notion_token

NOTION_VERSION = "2022-06-28"


def _get_notion_client():
    import importlib
    import sys

    sdk_name = "notion_client"
    automation_dir = str(Path(__file__).resolve().parent)
    saved_path = sys.path[:]
    cached_local = sys.modules.pop(sdk_name, None)
    sys.path = [entry for entry in sys.path if Path(entry).resolve() != Path(automation_dir).resolve()]
    try:
        sys.modules.pop(sdk_name, None)
        sdk = importlib.import_module(sdk_name)
        Client = sdk.Client
    except (ImportError, AttributeError) as exc:
        raise RuntimeError("notion-client 패키지가 필요합니다. pip install notion-client") from exc
    finally:
        sys.path = saved_path
        if cached_local is not None:
            sys.modules[sdk_name] = cached_local

    token = notion_token()
    if not token:
        raise ValueError("NOTION_TOKEN이 필요합니다. (.env에 NOTION_TOKEN 또는 NOTION_ACCESS_TOKEN)")
    return Client(auth=token)


def _database_id() -> str:
    db_id = os.getenv("NOTION_DATABASE_ID", "").strip()
    if not db_id:
        raise ValueError("NOTION_DATABASE_ID가 필요합니다.")
    return db_id


def _rich_text(content: str) -> list[dict]:
    chunks = [content[i : i + 1800] for i in range(0, len(content or ""), 1800)] or [""]
    return [{"type": "text", "text": {"content": chunk}} for chunk in chunks]


def _prop_map() -> dict[str, str]:
    return {
        "date": os.getenv("NOTION_PROP_DATE", "Date"),
        "batch": os.getenv("NOTION_PROP_BATCH", "Batch"),
        "market": os.getenv("NOTION_PROP_MARKET", "Market"),
        "source": os.getenv("NOTION_PROP_SOURCE", "Source"),
        "rank": os.getenv("NOTION_PROP_RANK", "Rank"),
        "ticker": os.getenv("NOTION_PROP_TICKER", "Ticker"),
        "name": os.getenv("NOTION_PROP_NAME", "Company"),
        "selected_type": os.getenv("NOTION_PROP_SELECTED_TYPE", "Selected Type"),
        "probability_score": os.getenv("NOTION_PROP_PROBABILITY", "Probability Score"),
        "mention_count": os.getenv("NOTION_PROP_MENTION", "Mention Count"),
        "title": os.getenv("NOTION_PROP_TITLE", "Name"),
        "body": os.getenv("NOTION_PROP_BODY", "Body"),
        "chart_image": os.getenv("NOTION_PROP_CHART", "Chart Image"),
        "status": os.getenv("NOTION_PROP_STATUS", "Notion Status"),
        "compliance_pass": os.getenv("NOTION_PROP_COMPLIANCE", "Compliance Pass"),
        "risk_level": os.getenv("NOTION_PROP_RISK", "Risk Level"),
        "quality_score": os.getenv("NOTION_PROP_QUALITY", "Quality Score"),
        "created_at": os.getenv("NOTION_PROP_CREATED", "Created At"),
        "posted_url": os.getenv("NOTION_PROP_POSTED_URL", "Posted URL"),
        "memo": os.getenv("NOTION_PROP_MEMO", "Memo"),
    }


def _set(props: dict[str, Any], key: str, value: Any, ptype: str) -> None:
    names = _prop_map()
    name = names[key]
    if ptype == "title":
        props[name] = {"title": _rich_text(str(value))}
    elif ptype == "rich_text":
        props[name] = {"rich_text": _rich_text(str(value))}
    elif ptype == "number":
        props[name] = {"number": float(value) if value is not None else None}
    elif ptype == "checkbox":
        props[name] = {"checkbox": bool(value)}
    elif ptype == "select":
        props[name] = {"select": {"name": str(value)}} if value else {"select": None}
    elif ptype == "date":
        props[name] = {"date": {"start": str(value)}} if value else {"date": None}
    elif ptype == "url":
        props[name] = {"url": str(value)} if value else {"url": None}
    elif ptype == "files":
        props[name] = {"files": value or []}


def create_daily_page(today: str) -> dict:
    """하루치 종목 브리핑을 담을 페이지 1개를 만든다. {"id", "url"} 반환."""
    client = _get_notion_client()
    title = f"{today} 종목 브리핑"
    properties: dict[str, Any] = {}
    _set(properties, "title", title, "title")
    _set(properties, "date", today, "date")
    _set(properties, "batch", "일일", "select")
    _set(properties, "status", "초안", "select")
    _set(properties, "created_at", datetime.now(KST).isoformat(timespec="seconds"), "date")

    page = client.pages.create(parent={"database_id": _database_id()}, properties=properties)
    result = {"id": page.get("id", ""), "url": page.get("url", "")}
    print(f"[Notion] daily page: {result['url']}")
    return result


def _paragraph_blocks(text: str) -> list[dict]:
    """본문을 문단(빈 줄 기준)으로 나눠 문단 블록 리스트로 만든다."""
    text = (text or "").strip()
    if not text:
        return []
    parts = [p.strip() for p in text.replace("\r\n", "\n").split("\n\n") if p.strip()]
    return [
        {"object": "block", "type": "paragraph", "paragraph": {"rich_text": _rich_text(part)}}
        for part in parts
    ]


def _news_bullet(item: dict) -> dict:
    title = str(item.get("title") or "").strip()
    publisher = str(item.get("publisher") or "").strip()
    published_at = str(item.get("publishedAt") or "").strip()
    link = str(item.get("link") or "").strip()
    meta = " · ".join([x for x in (publisher, published_at) if x])
    label = f"{title} ({meta})" if meta else title
    text_obj: dict[str, Any] = {"content": label}
    if link:
        text_obj["link"] = {"url": link}
    return {
        "object": "block",
        "type": "bulleted_list_item",
        "bulleted_list_item": {"rich_text": [{"type": "text", "text": text_obj}]},
    }


def _stock_section_blocks(post: dict, news: list[dict], market: str) -> list[dict]:
    """종목 1개의 섹션: 최종 게시글(제목+본문) + 최근 뉴스만."""
    name = post.get("name", "")
    ticker = post.get("ticker", "")
    market_tag = "한국" if str(market).upper() == "KR" else "미국"
    blocks: list[dict] = [
        {"object": "block", "type": "divider", "divider": {}},
        {
            "object": "block",
            "type": "heading_2",
            "heading_2": {"rich_text": _rich_text(f"{name} ({ticker}) · {market_tag}")},
        },
        {
            "object": "block",
            "type": "paragraph",
            "paragraph": {
                "rich_text": [
                    {"type": "text", "text": {"content": post.get("title", "")}, "annotations": {"bold": True}}
                ]
            },
        },
    ]
    blocks.extend(_paragraph_blocks(post.get("body", "")))
    if news:
        blocks.append(
            {
                "object": "block",
                "type": "heading_3",
                "heading_3": {"rich_text": _rich_text("최근 뉴스")},
            }
        )
        blocks.extend(_news_bullet(item) for item in news)
    return blocks


def append_stock_section(page_id: str, post: dict, news: list[dict], market: str) -> None:
    """하루치 페이지에 종목 섹션을 이어 붙인다."""
    client = _get_notion_client()
    blocks = _stock_section_blocks(post, news, market)
    client.blocks.children.append(block_id=page_id, children=blocks)
    print(f"[Notion] section appended: {post.get('ticker')}")


def update_page_properties(page_id: str, fields: dict[str, Any]) -> dict:
    client = _get_notion_client()
    properties: dict[str, Any] = {}
    mapping = {
        "posted_url": ("posted_url", "url"),
        "memo": ("memo", "rich_text"),
        "status": ("status", "select"),
    }
    for key, value in fields.items():
        if key not in mapping:
            continue
        prop_key, ptype = mapping[key]
        _set(properties, prop_key, value, ptype)
    return client.pages.update(page_id=page_id, properties=properties)


def find_page_by_ticker_and_date(ticker: str, date_str: str) -> str | None:
    client = _get_notion_client()
    names = _prop_map()
    try:
        response = client.databases.query(
            database_id=_database_id(),
            filter={
                "and": [
                    {"property": names["ticker"], "rich_text": {"equals": ticker}},
                    {"property": names["date"], "date": {"equals": date_str}},
                ]
            },
        )
    except Exception as exc:
        print(f"[Notion] query failed: {exc}")
        return None
    results = response.get("results") or []
    return results[0]["id"] if results else None