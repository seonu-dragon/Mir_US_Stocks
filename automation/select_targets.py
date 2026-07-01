"""Target selection logic for Kiwoom content batches."""

from __future__ import annotations

from copy import deepcopy


def _is_excluded(ticker: str, excluded_tickers: set[str] | None) -> bool:
    return bool(excluded_tickers and ticker in excluded_tickers)


def select_domestic_targets(
    scanner_items: list[dict],
    limit: int = 5,
    excluded_tickers: set[str] | None = None,
) -> list[dict]:
    candidates = sorted(scanner_items, key=lambda x: x.get("probability_score", 0), reverse=True)
    selected: list[dict] = []
    for item in candidates:
        if _is_excluded(item.get("ticker", ""), excluded_tickers):
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
) -> list[dict]:
    selected: list[dict] = []
    scanner_sorted = sorted(scanner_items, key=lambda x: x.get("probability_score", 0), reverse=True)
    mention_sorted = sorted(mention_items, key=lambda x: x.get("mention_count", 0), reverse=True)

    for item in scanner_sorted:
        if len([x for x in selected if x.get("source") == "scanner"]) >= 10:
            break
        if _is_excluded(item.get("ticker", ""), excluded_tickers):
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
        row = deepcopy(item)
        row["source"] = "scanner_fallback"
        selected.append(row)
        existing_tickers.add(ticker)

    return selected[:total]


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