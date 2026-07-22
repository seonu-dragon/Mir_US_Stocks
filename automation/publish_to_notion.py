#!/usr/bin/env python3
"""로컬에서 작성한 키움 종목 글을 노션에 정리한다 (Gemini API 미사용).

prepare_targets.py 로 만든 브리핑을 보고 사람/AI가 쓴 글을
outputs/posts/{today}_written.json 에 저장한 뒤 이 스크립트로 노션에 올린다.

written.json 형식:
    {
      "date": "YYYY-MM-DD",
      "posts": [
        {"market": "KR", "ticker": "161890", "name": "한국콜마",
         "title": "...", "body": "...(빈 줄로 문단 구분)..."},
        ...
      ]
    }

뉴스는 같은 날짜 브리핑(outputs/briefs/{date}_briefs.json)에서 종목별로 자동 매칭한다.
발행 후 3일 쿨다운 기록(outputs/posts/{date}_daily.json)도 남긴다.

실행:
    python automation/publish_to_notion.py                 # 오늘 날짜
    python automation/publish_to_notion.py --date 2026-07-07
    python automation/publish_to_notion.py --file path/to/written.json
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

AUTOMATION_DIR = Path(__file__).resolve().parent
if str(AUTOMATION_DIR) not in sys.path:
    sys.path.insert(0, str(AUTOMATION_DIR))

from notion_client import append_stock_section, create_daily_page  # noqa: E402
from utils import PROJECT_ROOT, load_env_file, load_json, save_json, today_kst  # noqa: E402


def _news_index(date_str: str) -> dict[tuple[str, str], list[dict]]:
    """브리핑에서 (market, ticker) → 최근 뉴스 매핑을 만든다."""
    path = PROJECT_ROOT / "outputs" / "briefs" / f"{date_str}_briefs.json"
    if not path.exists():
        print(f"[publish] 브리핑 없음(뉴스 매칭 생략): {path}")
        return {}
    data = load_json(path)
    idx: dict[tuple[str, str], list[dict]] = {}
    for b in data.get("briefs") or []:
        idx[(b.get("market", ""), b.get("ticker", ""))] = b.get("recent_news") or []
    return idx


def main() -> int:
    load_env_file()
    parser = argparse.ArgumentParser(description="작성한 키움 글을 노션에 발행")
    parser.add_argument("--date", help="대상 날짜 YYYY-MM-DD (기본: 오늘 KST)")
    parser.add_argument("--file", help="written.json 경로 (기본: outputs/posts/{date}_written.json)")
    parser.add_argument("--skip-cooldown-record", action="store_true", help="쿨다운 기록 생략")
    args = parser.parse_args()

    today = args.date or today_kst()
    written_path = Path(args.file) if args.file else PROJECT_ROOT / "outputs" / "posts" / f"{today}_written.json"
    if not written_path.exists():
        print(f"[publish] 작성 글 파일이 없습니다: {written_path}")
        print("[publish] prepare_targets.py 로 브리핑을 만든 뒤, 글을 위 경로에 저장하세요.")
        return 1

    payload = load_json(written_path)
    posts = payload.get("posts") or []
    if not posts:
        print("[publish] posts 가 비어 있습니다.")
        return 1

    news_idx = _news_index(today)

    daily = create_daily_page(today=today)
    page_id = daily.get("id", "")
    page_url = daily.get("url", "")

    results = []
    for post in posts:
        market = str(post.get("market", "")).upper()
        ticker = str(post.get("ticker", ""))
        if not post.get("title") or not post.get("body"):
            print(f"[publish] 건너뜀(제목/본문 없음): {market}/{ticker}")
            continue
        news = news_idx.get((market, ticker), [])
        append_stock_section(page_id=page_id, post=post, news=news, market=market)
        results.append({"ticker": ticker, "name": post.get("name", ticker), "market": market})

    if not args.skip_cooldown_record and results:
        # 같은 종목 3일 재등장 금지를 위한 기록.
        save_json(f"outputs/posts/{today}_daily.json", {"batch": "daily", "date": today, "results": results})

    print(f"\n[publish] 노션 발행 완료: {len(results)}종")
    print(f"[publish] 페이지: {page_url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
