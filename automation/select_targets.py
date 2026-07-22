"""Target selection logic for Kiwoom content batches."""

from __future__ import annotations

from copy import deepcopy
from typing import Callable

# keep(item) -> bool: 후보를 채택하기 전 통과 여부를 결정한다.
# 뉴스 있는 종목만 다루도록 main.py가 뉴스 유무 검사를 주입한다.
# (검사 통과 시 부작용으로 item에 recent_news를 붙여 재조회를 막는다.)
KeepPredicate = Callable[[dict], bool]


def _is_excluded(ticker: str, excluded_tickers: set[str] | None) -> bool:
    return bool(excluded_tickers and ticker in excluded_tickers)


def _keep(item: dict, keep: KeepPredicate | None) -> bool:
    return keep is None or keep(item)


def select_domestic_targets(
    scanner_items: list[dict],
    limit: int = 5,
    excluded_tickers: set[str] | None = None,
    keep: KeepPredicate | None = None,
) -> list[dict]:
    candidates = sorted(scanner_items, key=lambda x: x.get("probability_score", 0), reverse=True)
    selected: list[dict] = []
    for item in candidates:
        if _is_excluded(item.get("ticker", ""), excluded_tickers):
            continue
        if not _keep(item, keep):
            continue
        row = deepcopy(item)
        row["source"] = "scanner"
        selected.append(row)
        if len(selected) >= limit:
            break
    return selected


def select_overseas_targets(
    scanner_items: list[dict],
    mention_items: list[dict],
    total: int = 15,
    excluded_tickers: set[str] | None = None,
    keep: KeepPredicate | None = None,
) -> list[dict]:
    selected: list[dict] = []
    scanner_sorted = sorted(scanner_items, key=lambda x: x.get("probability_score", 0), reverse=True)
    mention_sorted = sorted(mention_items, key=lambda x: x.get("mention_count", 0), reverse=True)

    for item in scanner_sorted:
        if len([x for x in selected if x.get("source") == "scanner"]) >= 10:
            break
        if _is_excluded(item.get("ticker", ""), excluded_tickers):
            continue
        if not _keep(item, keep):
            continue
        row = deepcopy(item)
        row["source"] = "scanner"
        selected.append(row)

    existing_tickers = {x["ticker"] for x in selected}
    for item in mention_sorted:
        if len(selected) >= total:
            break
        ticker = item.get("ticker", "")
        if ticker in existing_tickers or _is_excluded(ticker, excluded_tickers):
            continue
        if not _keep(item, keep):
            continue
        row = deepcopy(item)
        row["source"] = "community_mentions"
        if "probability_score" not in row:
            row["probability_score"] = 0
        selected.append(row)
        existing_tickers.add(ticker)

    for item in scanner_sorted:
        if len(selected) >= total:
            break
        ticker = item.get("ticker", "")
        if ticker in existing_tickers or _is_excluded(ticker, excluded_tickers):
            continue
        if not _keep(item, keep):
            continue
        row = deepcopy(item)
        row["source"] = "scanner_fallback"
        selected.append(row)
        existing_tickers.add(ticker)

    return selected[:total]


def select_issue_targets(
    candidates: list[dict],
    target: int,
    excluded_tickers: set[str] | None = None,
    news_fetcher: Callable[[str], list[dict]] | None = None,
    scan_cap: int | None = None,
) -> list[dict]:
    """이슈 우선 선정 + 목표 개수 보장.

    - candidates: issue_score/hard_catalyst 가 부여된 후보(ETF 제외, 분석 존재 가정).
    - 정렬: issue_score(이슈 강도) → probability_score(상승확률) 순.
    - news_fetcher(ticker)->뉴스목록: 최근 뉴스가 있으면 이슈 가점 + tier1(이슈 있는 종목).
    - '이슈/뉴스 있는 종목'(tier1)을 우선 채우고, 부족하면 나머지로 target 를 채운다.
      → 이슈 종목을 앞세우되 개수(10/20)는 항상 맞춘다.
    """
    pool = [
        c for c in candidates if not _is_excluded(str(c.get("ticker", "")), excluded_tickers)
    ]
    pool.sort(
        key=lambda c: (c.get("issue_score", 0), c.get("probability_score", 0)),
        reverse=True,
    )
    if scan_cap is None:
        scan_cap = max(target * 3, target + 20)

    scored: list[dict] = []
    for i, item in enumerate(pool):
        row = deepcopy(item)
        news = news_fetcher(str(item.get("ticker", ""))) if (news_fetcher and i < scan_cap) else None
        has_news = bool(news)
        if has_news:
            row["recent_news"] = news
        # 뉴스가 있으면 이슈 강도에 큰 가점(뉴스=가장 강한 이슈 신호).
        row["_final"] = float(row.get("issue_score", 0) or 0) + (3.0 if has_news else 0.0)
        row["_tier1"] = has_news or bool(row.get("hard_catalyst"))
        row.setdefault("source", "scanner")
        scored.append(row)

    def rank_key(r: dict):
        return (r["_final"], r.get("probability_score", 0))

    tier1 = sorted([r for r in scored if r["_tier1"]], key=rank_key, reverse=True)
    rest = sorted([r for r in scored if not r["_tier1"]], key=rank_key, reverse=True)

    selected = tier1[:target]
    if len(selected) < target:
        selected += rest[: target - len(selected)]

    for r in selected:
        r.pop("_final", None)
        r.pop("_tier1", None)
    return selected[:target]


def resolve_targets_by_tickers(
    tickers: list[str],
    scanner_items: list[dict],
    mention_items: list[dict] | None = None,
) -> list[dict]:
    """Build target rows for explicit ticker list (used for regeneration runs)."""
    by_ticker: dict[str, dict] = {}
    for item in scanner_items:
        by_ticker[item["ticker"]] = deepcopy(item)
    if mention_items:
        for item in mention_items:
            if item["ticker"] not in by_ticker:
                by_ticker[item["ticker"]] = deepcopy(item)

    resolved: list[dict] = []
    for ticker in tickers:
        row = by_ticker.get(ticker)
        if not row:
            raise ValueError(f"scanner/mentions 데이터에 {ticker} 종목이 없습니다.")
        if "source" not in row:
            row["source"] = "scanner"
        resolved.append(row)
    return resolved