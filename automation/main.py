#!/usr/bin/env python3
"""Kiwoom content automation pipeline orchestrator."""

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
from generate_post import generate_post  # noqa: E402
from notion_client import create_daily_page, create_stock_page  # noqa: E402
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
    now_kst,
    save_json,
    today_kst,
)


def detect_batch() -> str:
    forced = os.getenv("KIWOOM_BATCH", "").strip()
    if forced in ("domestic_morning", "overseas_afternoon"):
        return forced
    hour = now_kst().hour
    return "domestic_morning" if hour < 10 else "overseas_afternoon"


def run_exports() -> None:
    script = ROOT / "scripts" / "build_kiwoom_exports.py"
    print(f"[pipeline] running exports: {script.name}")
    subprocess.run([sys.executable, str(script)], check=True, cwd=str(ROOT))


def merge_run_results(today: str, batch: str, new_results: list[dict]) -> dict:
    output_path = f"outputs/posts/{today}_{batch}.json"
    try:
        existing = load_json(output_path)
    except Exception:
        existing = {"batch": batch, "date": today, "results": []}

    by_ticker = {item["ticker"]: item for item in existing.get("results") or [] if item.get("ticker")}
    for item in new_results:
        if item.get("ticker"):
            by_ticker[item["ticker"]] = item

    merged = list(by_ticker.values())
    merged.sort(key=lambda x: x.get("ticker", ""))
    return {"batch": batch, "date": today, "results": merged}


def process_target(
    target: dict,
    market: str,
    batch_label: str,
    today: str,
    skip_gemini: bool,
    skip_notion: bool,
    skip_capture: bool,
) -> dict:
    ticker = target["ticker"]
    analysis_file = analysis_path(market, ticker)
    if not analysis_file.exists():
        raise FileNotFoundError(f"analysis JSON missing: {analysis_file}")
    analysis = load_json(analysis_file)

    chart_path = None
    if not skip_capture:
        chart_path = capture_chart(ticker=ticker, market=market, period=analysis.get("period", "1Y"))

    if skip_gemini:
        post = {
            "ticker": ticker,
            "name": target.get("name", ticker),
            "market": market,
            "selected_type": "분석/정보형",
            "selection_reason": "dry-run",
            "title": f"{target.get('name', ticker)} 차트 같이 봤어요",
            "body": "드라이런 모드 — Gemini 호출을 건너뛰었습니다.",
            "question_for_comments": "이 구간은 어떻게 보시나요?",
            "disclaimer": "",
            "hashtags": ["차트"],
            "quality_score": 0,
        }
        compliance = {"pass": True, "risk_level": "low", "issues": [], "fix_suggestions": [], "safe_version": post["body"]}
    else:
        post = generate_post(
            target=target,
            analysis=analysis,
            chart_path=chart_path,
            batch_label=batch_label,
            market=market,
        )
        compliance = check_compliance(post)

    notion_url = ""
    if not skip_notion:
        notion_url = create_stock_page(
            daily_page_url="",
            target=target,
            analysis=analysis,
            chart_path=chart_path,
            post=post,
            compliance=compliance,
            batch_label=batch_label,
            today=today,
            market=market,
        )

    return {
        "ticker": ticker,
        "name": target.get("name", ticker),
        "source": target.get("source", "scanner"),
        "selected_type": post.get("selected_type"),
        "title": post.get("title"),
        "notion_url": notion_url,
        "compliance_pass": compliance.get("pass", False),
        "risk_level": compliance.get("risk_level", "low"),
        "chart_path": str(chart_path) if chart_path else None,
    }


def main() -> int:
    load_env_file()
    parser = argparse.ArgumentParser(description="Kiwoom content automation pipeline")
    parser.add_argument("--batch", choices=("domestic_morning", "overseas_afternoon"))
    parser.add_argument("--tickers", help="쉼표로 구분한 종목코드 (재생성 시 쿨다운 무시)")
    parser.add_argument("--skip-exports", action="store_true")
    parser.add_argument("--skip-gemini", action="store_true", help="Dry-run without Gemini API")
    parser.add_argument("--skip-notion", action="store_true")
    parser.add_argument("--skip-capture", action="store_true")
    parser.add_argument("--skip-telegram", action="store_true")
    args = parser.parse_args()

    batch = args.batch or detect_batch()
    today = today_kst()
    batch_label = "국내 오전" if batch == "domestic_morning" else "해외 오후"

    try:
        if not args.skip_exports:
            run_exports()

        if batch == "domestic_morning":
            scanner = load_json("data/export/domestic_scanner.json")
            scanner_items = scanner.get("items") or []
            market = "KR"
            if args.tickers:
                tickers = [t.strip() for t in args.tickers.split(",") if t.strip()]
                targets = resolve_targets_by_tickers(tickers, scanner_items)
            else:
                excluded = get_cooldown_tickers(today)
                if excluded:
                    print(f"[pipeline] cooldown excluded ({len(excluded)}): {', '.join(sorted(excluded))}")
                targets = select_domestic_targets(scanner_items, limit=5, excluded_tickers=excluded)
        else:
            scanner = load_json("data/export/overseas_scanner.json")
            mentions = load_json("data/export/overseas_community_mentions.json")
            scanner_items = scanner.get("items") or []
            mention_items = mentions.get("items") or []
            market = "US"
            if args.tickers:
                tickers = [t.strip() for t in args.tickers.split(",") if t.strip()]
                targets = resolve_targets_by_tickers(tickers, scanner_items, mention_items)
            else:
                excluded = get_cooldown_tickers(today)
                if excluded:
                    print(f"[pipeline] cooldown excluded ({len(excluded)}): {', '.join(sorted(excluded))}")
                targets = select_overseas_targets(
                    scanner_items,
                    mention_items,
                    excluded_tickers=excluded,
                )

        if not targets:
            raise RuntimeError("선정 가능한 종목이 없습니다. (쿨다운 또는 스캐너 데이터 확인)")

        print(f"[pipeline] targets ({len(targets)}): {', '.join(t['ticker'] for t in targets)}")

        daily_page_url = ""
        if not args.skip_notion:
            daily_page_url = create_daily_page(today=today, batch=batch_label)

        results = []
        for target in targets:
            try:
                result = process_target(
                    target,
                    market=market,
                    batch_label=batch_label,
                    today=today,
                    skip_gemini=args.skip_gemini,
                    skip_notion=args.skip_notion,
                    skip_capture=args.skip_capture,
                )
                results.append(result)
                time.sleep(float(os.getenv("PIPELINE_TARGET_DELAY_SEC", "5")))
            except Exception as exc:
                print(f"[pipeline] target failed {target.get('ticker')}: {exc}")
                if not args.skip_telegram:
                    send_error_message(batch_label, f"{target.get('ticker')}: {exc}")

        payload = merge_run_results(today, batch, results)
        save_json(f"outputs/posts/{today}_{batch}.json", payload)

        if not args.skip_telegram:
            send_summary_message(batch=batch_label, today=today, results=results, daily_page_url=daily_page_url)

        print(f"[pipeline] completed {len(results)} posts for {batch_label}")
        return 0
    except Exception as exc:
        print(f"[pipeline] fatal error: {exc}")
        if not args.skip_telegram:
            send_error_message(batch_label, str(exc))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())