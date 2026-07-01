"""Notion integration for Kiwoom daily post review board."""

from __future__ import annotations

import json
import mimetypes
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from utils import KST, PROJECT_ROOT, notion_token

NOTION_API = "https://api.notion.com/v1"
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


def _notion_request(method: str, path: str, token: str, body: bytes | None = None, content_type: str = "application/json") -> dict:
    headers = {
        "Authorization": f"Bearer {token}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": content_type,
    }
    req = Request(f"{NOTION_API}{path}", data=body, headers=headers, method=method)
    try:
        with urlopen(req, timeout=120) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Notion HTTP {exc.code}: {detail[:400]}") from exc


def _upload_chart_image(client, chart_path: Path | None) -> list[dict] | None:
    if not chart_path or not chart_path.exists():
        return None
    token = notion_token()
    if not token:
        return None
    mime, _ = mimetypes.guess_type(str(chart_path))
    mime = mime or "image/png"
    filename = chart_path.name[:200]
    try:
        create_body = json.dumps({
            "filename": filename,
            "content_type": mime,
        }).encode("utf-8")
        created = _notion_request("POST", "/file_uploads", token, create_body)
        upload_id = created.get("id")
        if not upload_id:
            raise RuntimeError(f"file_upload id missing: {created}")

        boundary = f"----MirBoundary{uuid.uuid4().hex}"
        file_bytes = chart_path.read_bytes()
        multipart = (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
            f"Content-Type: {mime}\r\n\r\n"
        ).encode("utf-8") + file_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")

        sent = _notion_request(
            "POST",
            f"/file_uploads/{upload_id}/send",
            token,
            multipart,
            content_type=f"multipart/form-data; boundary={boundary}",
        )
        if sent.get("status") not in ("uploaded", "pending"):
            print(f"[Notion] chart upload status: {sent.get('status')}")

        return [{
            "type": "file_upload",
            "file_upload": {"id": upload_id},
            "name": filename,
        }]
    except Exception as exc:
        print(f"[Notion] chart upload skipped: {exc}")
    return None


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


def create_daily_page(today: str, batch: str, parent_page_id: str | None = None) -> str:
    client = _get_notion_client()
    title = f"{today} · {batch}"
    parent = (
        {"page_id": parent_page_id}
        if parent_page_id
        else {"database_id": _database_id()}
    )
    properties: dict[str, Any] = {}
    if "database_id" in parent:
        _set(properties, "title", title, "title")
        _set(properties, "date", today, "date")
        _set(properties, "batch", batch, "select")
        _set(properties, "status", "초안", "select")
        _set(properties, "created_at", datetime.now(KST).isoformat(timespec="seconds"), "date")
    else:
        properties = {"title": {"title": _rich_text(title)}}

    page = client.pages.create(parent=parent, properties=properties)
    url = page.get("url", "")
    print(f"[Notion] daily page: {url}")
    return url


def _page_blocks(
    target: dict,
    analysis: dict,
    post: dict,
    compliance: dict,
    batch_label: str,
    chart_path: Path | None,
) -> list[dict]:
    blocks: list[dict] = [
        {"object": "block", "type": "heading_1", "heading_1": {"rich_text": _rich_text(f"{post.get('name', '')} / {post.get('ticker', '')}")}},
        {"object": "block", "type": "heading_2", "heading_2": {"rich_text": _rich_text("1. 생성 정보")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": _rich_text(f"배치: {batch_label}")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": _rich_text(f"선정 출처: {target.get('source', 'scanner')}")}} ,
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": _rich_text(f"선택된 글 유형: {post.get('selected_type', '')}")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": _rich_text(f"유형 선택 이유: {post.get('selection_reason', '')}")}},
        {"object": "block", "type": "heading_2", "heading_2": {"rich_text": _rich_text("2. 차트 이미지")}},
    ]
    if chart_path and chart_path.exists():
        blocks.append(
            {
                "object": "block",
                "type": "paragraph",
                "paragraph": {"rich_text": _rich_text(str(chart_path.relative_to(PROJECT_ROOT)))},
            }
        )
    blocks.extend(
        [
            {"object": "block", "type": "heading_2", "heading_2": {"rich_text": _rich_text("3. 분석 데이터 요약")}},
            {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": _rich_text(f"지지선: {analysis.get('support_levels', [])}")}},
            {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": _rich_text(f"저항선: {analysis.get('resistance_levels', [])}")}},
            {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": _rich_text(f"이동평균선: {analysis.get('moving_average', {})}")}},
            {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": _rich_text(f"RSI: {analysis.get('rsi', {})}")}},
            {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": _rich_text(f"거래량: {analysis.get('volume', {})}")}},
            {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": _rich_text(f"상승 시나리오: {analysis.get('scenario', {}).get('up', '')}")}},
            {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": _rich_text(f"하락 시나리오: {analysis.get('scenario', {}).get('down', '')}")}},
            {"object": "block", "type": "heading_2", "heading_2": {"rich_text": _rich_text("4. 게시글 초안")}},
            {"object": "block", "type": "paragraph", "paragraph": {"rich_text": _rich_text(f"제목: {post.get('title', '')}")}},
            {"object": "block", "type": "paragraph", "paragraph": {"rich_text": _rich_text(post.get("body", ""))}},
            {"object": "block", "type": "heading_2", "heading_2": {"rich_text": _rich_text("5. 댓글 유도 질문")}},
            {"object": "block", "type": "paragraph", "paragraph": {"rich_text": _rich_text(post.get("question_for_comments", ""))}},
            {"object": "block", "type": "heading_2", "heading_2": {"rich_text": _rich_text("6. 준법 체크 결과")}},
            {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": _rich_text(f"통과 여부: {compliance.get('pass', False)}")}},
            {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": _rich_text(f"위험도: {compliance.get('risk_level', '')}")}},
            {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": _rich_text(f"수정 필요 사항: {compliance.get('issues', [])}")}},
        ]
    )
    return blocks


def create_stock_page(
    daily_page_url: str,
    target: dict,
    analysis: dict,
    chart_path: Path | None,
    post: dict,
    compliance: dict,
    batch_label: str,
    today: str,
    market: str,
) -> str:
    client = _get_notion_client()
    properties: dict[str, Any] = {}
    page_title = f"{target.get('name', post.get('name', ''))} ({target.get('ticker', post.get('ticker', ''))})"
    _set(properties, "title", page_title, "title")
    _set(properties, "date", today, "date")
    _set(properties, "batch", batch_label, "select")
    _set(properties, "market", market, "select")
    _set(properties, "source", target.get("source", "scanner"), "select")
    _set(properties, "rank", target.get("rank"), "number")
    _set(properties, "ticker", target.get("ticker", ""), "rich_text")
    _set(properties, "name", target.get("name", ""), "rich_text")
    _set(properties, "selected_type", post.get("selected_type", ""), "select")
    _set(properties, "probability_score", target.get("probability_score"), "number")
    _set(properties, "mention_count", target.get("mention_count"), "number")
    _set(properties, "body", compliance.get("safe_version") or post.get("body", ""), "rich_text")
    files = _upload_chart_image(client, chart_path)
    if files:
        _set(properties, "chart_image", files, "files")
    _set(properties, "status", "초안", "select")
    _set(properties, "compliance_pass", compliance.get("pass", False), "checkbox")
    _set(properties, "risk_level", compliance.get("risk_level", "low"), "select")
    _set(properties, "quality_score", post.get("quality_score"), "number")
    _set(properties, "created_at", datetime.now(KST).isoformat(timespec="seconds"), "date")

    page = client.pages.create(
        parent={"database_id": _database_id()},
        properties=properties,
        children=_page_blocks(target, analysis, post, compliance, batch_label, chart_path),
    )
    url = page.get("url", "")
    print(f"[Notion] stock page {target.get('ticker')}: {url}")
    return url


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