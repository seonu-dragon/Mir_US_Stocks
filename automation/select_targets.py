"""Target selection logic for Kiwoom content batches."""

from __future__ import annotations

from copy import deepcopy


def select_domestic_targets(scanner_items: list[dict], limit: int = 5) -> list[dict]:
    candidates = sorted(scanner_items, key=lambda x: x.get("probability_score", 0), reverse=True)
    selected = []
    for item in candidates[:limit]:
        row = deepcopy(item)
        row["source"] = "scanner"
        selected.append(row)
    return selected


def select_overseas_targets(scanner_items: list[dict], mention_items: list[dict], total: int = 15) -> list[dict]:
    selected: list[dict] = []
    scanner_sorted = sorted(scanner_items, key=lambda x: x.get("probability_score", 0), reverse=True)
    mention_sorted = sorted(mention_items, key=lambda x: x.get("mention_count", 0), reverse=True)

    for item in scanner_sorted:
        if len([x for x in selected if x.get("source") == "scanner"]) >= 10:
            break
        row = deepcopy(item)
        row["source"] = "scanner"
        selected.append(row)

    existing_tickers = {x["ticker"] for x in selected}
    for item in mention_sorted:
        if len(selected) >= total:
            break
        if item["ticker"] not in existing_tickers:
            row = deepcopy(item)
            row["source"] = "community_mentions"
            if "probability_score" not in row:
                row["probability_score"] = 0
            selected.append(row)
            existing_tickers.add(item["ticker"])

    for item in scanner_sorted:
        if len(selected) >= total:
            break
        if item["ticker"] not in existing_tickers:
            row = deepcopy(item)
            row["source"] = "scanner_fallback"
            selected.append(row)
            existing_tickers.add(item["ticker"])

    return selected[:total]