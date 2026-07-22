#!/usr/bin/env python3
"""Create Kiwoom Supporters Notion database in the user's workspace."""

from __future__ import annotations

import importlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUTOMATION = ROOT / "automation"
sys.path.insert(0, str(AUTOMATION))

from utils import load_env_file, notion_token  # noqa: E402


def _sdk_client():
    saved = sys.modules.pop("notion_client", None)
    automation_dir = str(AUTOMATION.resolve())
    sys.path[:] = [p for p in sys.path if Path(p).resolve() != Path(automation_dir).resolve()]
    try:
        sys.modules.pop("notion_client", None)
        sdk = importlib.import_module("notion_client")
        return sdk.Client(auth=notion_token())
    finally:
        if saved is not None:
            sys.modules["notion_client"] = saved


def _schema() -> dict:
    return {
        "Title": {"title": {}},
        "Date": {"date": {}},
        "Batch": {
            "select": {
                "options": [
                    {"name": "국내 오전", "color": "blue"},
                    {"name": "해외 오후", "color": "orange"},
                ]
            }
        },
        "Market": {
            "select": {
                "options": [
                    {"name": "KR", "color": "green"},
                    {"name": "US", "color": "purple"},
                ]
            }
        },
        "Source": {
            "select": {
                "options": [
                    {"name": "scanner", "color": "gray"},
                    {"name": "community_mentions", "color": "yellow"},
                    {"name": "scanner_fallback", "color": "brown"},
                ]
            }
        },
        "Rank": {"number": {"format": "number"}},
        "Ticker": {"rich_text": {}},
        "Name": {"rich_text": {}},
        "Selected Type": {
            "select": {
                "options": [
                    {"name": "분석/정보형", "color": "blue"},
                    {"name": "관심 유도형", "color": "pink"},
                    {"name": "꿀팁 공유형", "color": "green"},
                ]
            }
        },
        "Probability Score": {"number": {"format": "number"}},
        "Mention Count": {"number": {"format": "number"}},
        "Body": {"rich_text": {}},
        "Chart Image": {"files": {}},
        "Notion Status": {
            "select": {
                "options": [
                    {"name": "초안", "color": "gray"},
                    {"name": "검수 완료", "color": "blue"},
                    {"name": "업로드 완료", "color": "green"},
                    {"name": "보류", "color": "yellow"},
                    {"name": "수정 필요", "color": "red"},
                ]
            }
        },
        "Compliance Pass": {"checkbox": {}},
        "Risk Level": {
            "select": {
                "options": [
                    {"name": "low", "color": "green"},
                    {"name": "medium", "color": "yellow"},
                    {"name": "high", "color": "red"},
                ]
            }
        },
        "Quality Score": {"number": {"format": "number"}},
        "Created At": {"date": {}},
        "Posted URL": {"url": {}},
        "Memo": {"rich_text": {}},
    }


def find_existing(client) -> dict | None:
    cursor = None
    while True:
        resp = client.search(
            query="Kiwoom Supporters Daily Posts",
            start_cursor=cursor,
        )
        for item in resp.get("results", []):
            if item.get("object") != "database":
                continue
            title = "".join(t.get("plain_text", "") for t in item.get("title", []))
            if title == "Kiwoom Supporters Daily Posts":
                return item
        if not resp.get("has_more"):
            break
        cursor = resp.get("next_cursor")
    return None


def list_accessible_pages(client, limit: int = 10) -> list[dict]:
    resp = client.search(query="", page_size=min(limit, 25))
    pages = []
    for item in resp.get("results", []):
        if item.get("object") != "page":
            continue
        title = ""
        for prop in (item.get("properties") or {}).values():
            if prop.get("type") == "title":
                title = "".join(t.get("plain_text", "") for t in prop.get("title", []))
                break
        pages.append({"id": item["id"], "title": title or "(제목 없음)", "url": item.get("url", "")})
    return pages


def create_database(client, parent_page_id: str | None = None) -> dict:
    if parent_page_id:
        parent = {"type": "page_id", "page_id": parent_page_id.replace("-", "")}
    else:
        parent = {"type": "workspace", "workspace": True}
    return client.databases.create(
        parent=parent,
        title=[{"type": "text", "text": {"content": "Kiwoom Supporters Daily Posts"}}],
        description=[
            {
                "type": "text",
                "text": {"content": "키움 커뮤니티 서포터즈 일일 게시글 초안 검수 보드"},
            }
        ],
        properties=_schema(),
    )


def update_env_database_id(db_id: str) -> None:
    env_path = ROOT / ".env"
    lines = env_path.read_text(encoding="utf-8-sig").splitlines() if env_path.exists() else []
    out = []
    found = False
    for line in lines:
        if line.strip().startswith("NOTION_DATABASE_ID="):
            out.append(f'NOTION_DATABASE_ID="{db_id.replace("-", "")}"')
            found = True
        else:
            out.append(line)
    if not found:
        out.append(f'NOTION_DATABASE_ID="{db_id.replace("-", "")}"')
    env_path.write_text("\n".join(out) + "\n", encoding="utf-8")


def _parse_page_id(value: str) -> str:
    raw = value.strip()
    if "notion.so/" in raw:
        slug = raw.rstrip("/").split("/")[-1]
        page_id = slug.split("-")[-1]
        if len(page_id) == 32:
            return page_id
    return raw.replace("-", "")


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Kiwoom Notion DB 생성/조회")
    parser.add_argument(
        "--parent-page-id",
        help="DB를 만들 부모 Notion 페이지 ID 또는 URL (Integration에 연결된 페이지)",
    )
    args = parser.parse_args()

    load_env_file()
    if not notion_token():
        print("NOTION_TOKEN이 .env에 없습니다.")
        return 1

    client = _sdk_client()
    existing = find_existing(client)
    if existing:
        db = existing
        print("[notion] 기존 DB 발견")
    else:
        parent_id = _parse_page_id(args.parent_page_id) if args.parent_page_id else None
        try:
            db = create_database(client, parent_page_id=parent_id)
            print("[notion] 새 DB 생성 완료")
        except Exception as exc:
            print(f"[notion] DB 생성 실패: {exc}")
            print()
            print("Internal Integration은 워크스페이스 루트에 DB를 못 만듭니다.")
            print("아래 순서로 진행해 주세요:")
            print("  1. Notion에서 빈 페이지 생성 (예: '키움 서포터즈')")
            print("  2. 그 페이지 ... → 연결 → Kiwoom Pipeline 추가")
            print("  3. 아래 명령 실행:")
            print('     python scripts/create_kiwoom_notion_db.py --parent-page-id "페이지URL"')
            print()
            pages = list_accessible_pages(client)
            if pages:
                print("Integration이 접근 가능한 페이지:")
                for p in pages:
                    print(f"  - {p['title']}: {p['url']}")
            else:
                print("Integration에 연결된 페이지가 아직 없습니다.")
            return 2

    db_id = db["id"]
    url = db.get("url", "")
    update_env_database_id(db_id)
    print(json.dumps({"database_id": db_id.replace("-", ""), "url": url}, ensure_ascii=False, indent=2))
    print("\n위 URL로 Notion에서 DB를 열 수 있습니다.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())