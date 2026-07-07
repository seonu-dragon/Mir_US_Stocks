#!/usr/bin/env python3
"""로컬 CLI용 종목 선정 + 자료 준비 (Gemini API 미사용).

키움 커뮤니티 글을 로컬에서 유료 AI(Claude Code 등)로 직접 쓰기 위한 준비 단계.
한국 10개 · 미국 20개를 이슈 우선으로 선정하고, 종목별 브리핑(분석·펀더멘털·
다양한 매체 뉴스·배정 앵글)을 outputs/briefs/ 에 저장한다. 글은 사람/AI가 쓴다.

실행:
    python automation/prepare_targets.py            # 한국+미국
    python automation/prepare_targets.py --only KR  # 한국만
    python automation/prepare_targets.py --skip-exports  # 스캐너/분석 재생성 생략
"""

from __future__ import annotations

import argparse
import random
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUTOMATION_DIR = Path(__file__).resolve().parent
if str(AUTOMATION_DIR) not in sys.path:
    sys.path.insert(0, str(AUTOMATION_DIR))

from angles import ANGLES  # noqa: E402
from enrich_context import build_stock_context  # noqa: E402
from fetch_news import fetch_stock_news  # noqa: E402
from select_targets import select_issue_targets  # noqa: E402
from ticker_cooldown import get_cooldown_tickers  # noqa: E402
from utils import (  # noqa: E402
    analysis_path,
    load_env_file,
    load_json,
    save_json,
    today_kst,
)

MARKETS = ("KR", "US")
MARKET_LABEL = {"KR": "한국", "US": "미국"}
TARGET_COUNT = {"KR": 10, "US": 20}


def run_exports() -> None:
    script = ROOT / "scripts" / "build_kiwoom_exports.py"
    print(f"[prepare] running exports: {script.name}")
    subprocess.run([sys.executable, str(script)], check=True, cwd=str(ROOT))


def _make_news_fetcher(market: str, name_by_ticker: dict[str, str]):
    cache: dict[str, list[dict]] = {}

    def fetch(ticker: str) -> list[dict]:
        key = str(ticker or "").strip()
        if not key:
            return []
        if key not in cache:
            cache[key] = fetch_stock_news(
                ticker=key, market=market, limit=3, name=name_by_ticker.get(key)
            )
        return cache[key]

    return fetch


def select_market(market: str, today: str) -> list[dict]:
    scanner = load_json(
        "data/export/domestic_scanner.json"
        if market == "KR"
        else "data/export/overseas_scanner.json"
    )
    candidates = list(scanner.get("items") or [])
    if market == "US":
        mentions = load_json("data/export/overseas_community_mentions.json")
        seen = {c["ticker"] for c in candidates}
        candidates += [m for m in (mentions.get("items") or []) if m["ticker"] not in seen]

    # 분석 JSON이 있는 후보만(글에 필요한 지지/저항·지표가 준비된 종목).
    candidates = [c for c in candidates if analysis_path(market, c.get("ticker", "")).exists()]

    excluded = get_cooldown_tickers(today)
    if excluded:
        print(f"[prepare] {market} 3일 쿨다운 제외 {len(excluded)}종: {', '.join(sorted(excluded))}")
    name_by_ticker = {c.get("ticker", ""): c.get("name", "") for c in candidates}
    return select_issue_targets(
        candidates,
        target=TARGET_COUNT[market],
        excluded_tickers=excluded,
        news_fetcher=_make_news_fetcher(market, name_by_ticker),
    )


def build_brief(target: dict, market: str, angle: dict) -> dict:
    ticker = target["ticker"]
    analysis = load_json(analysis_path(market, ticker))
    context = build_stock_context(ticker, market, issue_tags=target.get("issue_tags"))
    return {
        "market": market,
        "ticker": ticker,
        "name": target.get("name") or ticker,
        "angle": angle,
        "issue_tags": target.get("issue_tags", []),
        "source": target.get("source", "scanner"),
        "recent_news": target.get("recent_news") or [],
        "context": context,
        "analysis": analysis,
    }


def _fmt_news(news: list[dict]) -> str:
    if not news:
        return "  - (최근 2일 이내 뉴스 없음)\n"
    lines = []
    for n in news:
        meta = " · ".join(x for x in (n.get("publisher", ""), n.get("publishedAt", "")) if x)
        link = n.get("link", "")
        lines.append(f"  - {n.get('title','').strip()} ({meta}) {link}".rstrip())
    return "\n".join(lines) + "\n"


def briefs_to_markdown(today: str, briefs: list[dict]) -> str:
    out = [f"# {today} 키움 커뮤니티 종목 브리핑 (글 작성용 자료)\n"]
    out.append(
        "> 이 파일은 **자료**다. 각 종목마다 배정된 앵글과 데이터를 보고, "
        "`prompts/kiwoom_post_generation_prompt.md`의 톤·규칙을 지켜 사람이 쓴 듯한 글을 쓴다. "
        "30개 글이 같은 틀로 보이면 안 된다.\n"
    )
    by_market = {"KR": [], "US": []}
    for b in briefs:
        by_market[b["market"]].append(b)
    for market in ("KR", "US"):
        rows = by_market[market]
        out.append(f"\n## {MARKET_LABEL[market]} {len(rows)}종\n")
        for i, b in enumerate(rows, 1):
            ctx = b["context"]
            an = b["analysis"]
            ang = b["angle"]
            out.append(f"\n### {i}. {b['name']} ({b['ticker']}) — 앵글: {ang.get('name','')}")
            out.append(f"- 앵글 지침: {ang.get('guide','')} (분량: {ang.get('length','')})")
            if b["issue_tags"]:
                out.append(f"- 이슈 태그: {', '.join(b['issue_tags'])}")
            bits = []
            if ctx.get("sector"):
                bits.append(f"업종 {ctx['sector']}/{ctx.get('industry','')}")
            if ctx.get("market_cap"):
                bits.append(f"시총 {ctx['market_cap']}")
            r = ctx.get("returns_pct", {})
            if r:
                bits.append(
                    "등락 "
                    + ", ".join(f"{k} {v}%" for k, v in r.items())
                )
            if ctx.get("relative_strength") is not None:
                bits.append(f"상대강도 {ctx['relative_strength']}")
            if ctx.get("eps_revision_score") is not None:
                bits.append(f"실적추정 {ctx['eps_revision_score']}")
            if ctx.get("rsi14") is not None:
                bits.append(f"RSI {ctx['rsi14']}")
            if ctx.get("volume_ratio") is not None:
                bits.append(f"거래량비 {ctx['volume_ratio']}")
            if bits:
                out.append("- 스냅샷: " + " · ".join(bits))
            val = ctx.get("valuation", {})
            if val:
                out.append("- 밸류에이션: " + " · ".join(f"{k} {v}" for k, v in val.items()))
            sup = an.get("support_levels") or []
            res = an.get("resistance_levels") or []
            if sup or res:
                out.append(f"- 지지 {sup} / 저항 {res} (현재가 {an.get('price')})")
            if an.get("scenario"):
                sc = an["scenario"]
                out.append(f"- 시나리오: 상방 {sc.get('up','')} / 하방 {sc.get('down','')}")
            if an.get("risk_points"):
                out.append(f"- 리스크: {'; '.join(an['risk_points'])}")
            out.append("- 최근 뉴스:")
            out.append(_fmt_news(b["recent_news"]).rstrip())
    out.append("\n---\n")
    out.append(
        "작성 후: `outputs/posts/" + today + "_written.json` 에 "
        '{"date","posts":[{market,ticker,name,title,body}]} 형식으로 저장한 뒤 '
        "`python automation/publish_to_notion.py` 로 노션에 올린다.\n"
    )
    return "\n".join(out)


def main() -> int:
    load_env_file()
    parser = argparse.ArgumentParser(description="키움 종목 선정+자료 준비 (Gemini 미사용)")
    parser.add_argument("--only", choices=MARKETS, help="특정 시장만")
    parser.add_argument("--skip-exports", action="store_true", help="스캐너/분석 재생성 생략")
    args = parser.parse_args()

    today = today_kst()
    markets = [args.only] if args.only else list(MARKETS)

    if not args.skip_exports:
        run_exports()

    selected: list[tuple[str, dict]] = []
    for market in markets:
        rows = select_market(market, today)
        print(f"[prepare] {MARKET_LABEL[market]} {len(rows)}종: {', '.join(r['ticker'] for r in rows)}")
        for r in rows:
            selected.append((market, r))

    if not selected:
        print("[prepare] 선정 종목이 없습니다. (쿨다운/스캐너 데이터 확인)")
        return 1

    # 30개 글의 앵글을 날짜 시드로 셔플해 골고루 분산.
    reps = len(selected) // len(ANGLES) + 1
    angle_order = ANGLES * reps
    random.Random(today).shuffle(angle_order)

    briefs = [build_brief(t, m, angle_order[i]) for i, (m, t) in enumerate(selected)]

    json_path = save_json(f"outputs/briefs/{today}_briefs.json", {"date": today, "briefs": briefs})
    md_path = ROOT / "outputs" / "briefs" / f"{today}_briefs.md"
    md_path.write_text(briefs_to_markdown(today, briefs), encoding="utf-8")

    print(f"\n[prepare] 브리핑 저장:\n  - {json_path}\n  - {md_path}")
    print(f"[prepare] 총 {len(briefs)}종 (한국 {sum(1 for b in briefs if b['market']=='KR')} / "
          f"미국 {sum(1 for b in briefs if b['market']=='US')})")
    print("[prepare] 다음: 브리핑을 보고 글 작성 → outputs/posts/{date}_written.json 저장 → "
          "python automation/publish_to_notion.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
