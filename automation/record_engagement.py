#!/usr/bin/env python3
"""CLI to record post-upload engagement metrics in Notion."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

AUTOMATION_DIR = Path(__file__).resolve().parent
if str(AUTOMATION_DIR) not in sys.path:
    sys.path.insert(0, str(AUTOMATION_DIR))

from notion_client import find_page_by_ticker_and_date, update_page_properties  # noqa: E402
from utils import load_env_file, now_kst  # noqa: E402


def build_memo(likes: int | None, comments: int | None, views: int | None, memo: str | None) -> str:
    parts = []
    if likes is not None:
        parts.append(f"좋아요 {likes}")
    if comments is not None:
        parts.append(f"댓글 {comments}")
    if views is not None:
        parts.append(f"조회 {views}")
    if memo:
        parts.append(memo.strip())
    return " · ".join(parts)


def main() -> int:
    load_env_file()
    parser = argparse.ArgumentParser(description="Notion 게시글 반응 기록")
    parser.add_argument("--page-id", help="Notion page ID (ticker/date 대신 직접 지정)")
    parser.add_argument("--ticker", help="종목 티커")
    parser.add_argument("--date", help="게시일 YYYY-MM-DD (기본: 오늘 KST)")
    parser.add_argument("--posted-url", help="키움 커뮤니티 게시 URL")
    parser.add_argument("--likes", type=int)
    parser.add_argument("--comments", type=int)
    parser.add_argument("--views", type=int)
    parser.add_argument("--memo", help="추가 메모")
    parser.add_argument(
        "--status",
        choices=("초안", "검수 완료", "업로드 완료", "보류", "수정 필요"),
        help="Notion Status 필드 업데이트",
    )
    args = parser.parse_args()

    page_id = args.page_id
    if not page_id:
        if not args.ticker:
            parser.error("--page-id 또는 --ticker 가 필요합니다.")
        date_str = args.date or now_kst().strftime("%Y-%m-%d")
        page_id = find_page_by_ticker_and_date(args.ticker.upper(), date_str)
        if not page_id:
            print(f"[engagement] Notion 페이지를 찾지 못했습니다: {args.ticker} / {date_str}")
            return 1

    fields: dict = {}
    if args.posted_url:
        fields["posted_url"] = args.posted_url
    if args.status:
        fields["status"] = args.status
    memo = build_memo(args.likes, args.comments, args.views, args.memo)
    if memo:
        fields["memo"] = memo
    if not fields:
        print("[engagement] 업데이트할 필드가 없습니다.")
        return 1

    result = update_page_properties(page_id, fields)
    print(json.dumps({"page_id": page_id, "updated": True, "url": result.get("url")}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())