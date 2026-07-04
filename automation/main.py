#!/usr/bin/env python3
"""Kiwoom content automation pipeline orchestrator.

하루 한 번(07:13 KST) 실행되며, 한국·미국 종목을 함께 처리해
하루치 결과를 Notion 한 페이지에 종목별 최종 게시글로 담는다.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUTOMATION_DIR = Path(__file__).resolve().parent
if str(AUTOMATION_DIR) not in sys.path:
    sys.path.insert(0, str(AUTOMATION_DIR))

from capture_chart import capture_chart  # noqa: E402
from compliance_check import check_compliance  # noqa: E402
from fetch_news import fetch_stock_news  # noqa: E402
from generate_post import generate_post  # noqa: E402
from notion_client import append_stock_section, create_daily_page  # noqa: E402
from select_targets import (  # noqa: E402
    resolve_targets_by_tickers,
    select_domestic_targets,
    select_overseas_targets,
)
from telegram_client import send_error_message, send_summary_message  # noqa: E402
from ticker_cooldown import get_cooldown_tickers  # noqa: E402
from utils import (  # noqa: E402
    analysis_path,
    load_env_file,
    load_json,
    now_kst,  # noqa: F401  (테스트/호환용 재노출)
    save_json,
    today_kst,
)

# 시장별 라벨/설정
MARKETS = ("KR", "US")
MARKET_LABEL = {"KR": "한국", "US": "미국"}


def run_exports() -> None:
    script = ROOT / "scripts" / "build_kiwoom_exports.py"
    print(f"[pipeline] running exports: {script.name}")
    subprocess.run([sys.executable, str(script)], check=True, cwd=str(ROOT))


def select_market_targets(market: str, today: str, tickers: list[str] | None) -> list[dict]:
    """시장별 종목 선정. tickers가 주어지면 쿨다운을 무시하고 그 목록을 재생성한다."""
    if market == "KR":
        scanner = load_json("data/export/domestic_scanner.json")
        items = scanner.get("items") or []
        if tickers:
            return resolve_targets_by_tickers(tickers, items)
        excluded = get_cooldown_tickers(today)
        if excluded:
            print(f"[pipeline] KR cooldown excluded ({len(excluded)}): {', '.join(sorted(excluded))}")
        return select_domestic_targets(items, limit=5, excluded_tickers=excluded)

    scanner = load_json("data/export/overseas_scanner.json")
    mentions = load_json("data/export/overseas_community_mentions.json")
    scanner_items = scanner.get("items") or []
    mention_items = mentions.get("items") or []
    if tickers:
        return resolve_targets_by_tickers(tickers, scanner_items, mention_items)
    excluded = get_cooldown_tickers(today)
    if excluded:
        print(f"[pipeline] US cooldown excluded ({len(excluded)}): {', '.join(sorted(excluded))}")
    return select_overseas_targets(scanner_items, mention_items, excluded_tickers=excluded)


def process_target(
    target: dict,
    market: str,
    today: str,
    daily_page_id: str,
    skip_gemini: bool,
    skip_notion: bool,
    skip_capture: bool,
) -> dict:
    ticker = target["ticker"]
    analysis_file = analysis_path(market, ticker)
    if not analysis_file.exists():
        raise FileNotFoundError(f"analysis JSON missing: {analysis_file}")
    analysis = load_json(analysis_file)

    # 최근(기본 2일 이내) 뉴스만. 게시글 작성과 Notion 브리핑에 함께 쓴다.
    recent_news = fetch_stock_news(ticker=ticker, market=market, limit=3)

    chart_path = None
    if not skip_capture:
        # 차트는 Gemini 분석 입력용으로만 사용하고 Notion에 이미지로 올리지 않는다.
        chart_path = capture_chart(ticker=ticker, market=market, period=analysis.get("period", "6M"))

    if skip_gemini:
        post = {
            "ticker": ticker,
            "name": target.get("name", ticker),
            "market": market,
            "selected_type": "뉴스/이슈형",
            "title": f"{target.get('name', ticker)} 요즘 어떤가요",
            "body": "드라이런 모드 — Gemini 호출을 건너뛰었습니다.",
            "quality_score": 0,
        }
        body = post["body"]
    else:
        post = generate_post(
            target=target,
            analysis=analysis,
            chart_path=chart_path,
            market=market,
            recent_news=recent_news,
        )
        compliance = check_compliance(post)
        # 준법 체크 결과는 페이지에 따로 노출하지 않고 본문에만 반영한다.
        body = compliance.get("safe_version") or post.get("body", "")
        post["body"] = body

    if not skip_notion:
        append_stock_section(page_id=daily_page_id, post=post, news=recent_news, market=market)

    return {
        "ticker": ticker,
        "name": target.get("name", ticker),
        "market": market,
        "source": target.get("source", "scanner"),
        "title": post.get("title"),
        "news_count": len(recent_news),
    }


def main() -> int:
    load_env_file()
    parser = argparse.ArgumentParser(description="Kiwoom content automation pipeline")
    parser.add_argument("--only", choices=MARKETS, help="특정 시장만 실행 (기본: 한국+미국 모두)")
    parser.add_argument("--tickers", help="쉼표로 구분한 종목코드 (--only와 함께, 쿨다운 무시 재생성)")
    parser.add_argument("--skip-exports", action="store_true")
    parser.add_argument("--skip-gemini", action="store_true", help="Dry-run without Gemini API")
    parser.add_argument("--skip-notion", action="store_true")
    parser.add_argument("--skip-capture", action="store_true")
    parser.add_argument("--skip-telegram", action="store_true")
    args = parser.parse_args()

    today = today_kst()
    markets = [args.only] if args.only else list(MARKETS)
    tickers = None
    if args.tickers:
        tickers = [t.strip() for t in args.tickers.split(",") if t.strip()]
        if not args.only:
            print("[pipeline] --tickers는 --only와 함께 사용하세요.")
            return 1

    try:
        if not args.skip_exports:
            run_exports()

        # 시장별 종목 선정
        targets_by_market: list[tuple[str, dict]] = []
        for market in markets:
            selected = select_market_targets(market, today, tickers)
            print(f"[pipeline] {MARKET_LABEL[market]} targets ({len(selected)}): "
                  f"{', '.join(t['ticker'] for t in selected)}")
            for target in selected:
                targets_by_market.append((market, target))

        if not targets_by_market:
            raise RuntimeError("선정 가능한 종목이 없습니다. (쿨다운 또는 스캐너 데이터 확인)")

        # 하루치 페이지 1개 생성 후 종목별 섹션을 이어 붙인다.
        daily_page_id = ""
        daily_page_url = ""
        if not args.skip_notion:
            daily = create_daily_page(today=today)
            daily_page_id = daily.get("id", "")
            daily_page_url = daily.get("url", "")

        results = []
        for market, target in targets_by_market:
            try:
                result = process_target(
                    target,
                    market=market,
                    today=today,
                    daily_page_id=daily_page_id,
                    skip_gemini=args.skip_gemini,
                    skip_notion=args.skip_notion,
                    skip_capture=args.skip_capture,
                )
                results.append(result)
                time.sleep(float(os.getenv("PIPELINE_TARGET_DELAY_SEC", "5")))
            except Exception as exc:
                print(f"[pipeline] target failed {target.get('ticker')}: {exc}")
                if not args.skip_telegram:
                    send_error_message("일일", f"{target.get('ticker')}: {exc}")

        payload = {"batch": "daily", "date": today, "results": results}
        save_json(f"outputs/posts/{today}_daily.json", payload)

        if not args.skip_telegram:
            send_summary_message(today=today, results=results, daily_page_url=daily_page_url)

        print(f"[pipeline] completed {len(results)} posts")
        return 0
    except Exception as exc:
        print(f"[pipeline] fatal error: {exc}")
        if not args.skip_telegram:
            send_error_message("일일", str(exc))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
