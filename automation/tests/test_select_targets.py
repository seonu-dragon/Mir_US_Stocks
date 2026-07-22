"""Tests for Kiwoom target selection logic."""

from __future__ import annotations

import sys
from pathlib import Path

AUTOMATION_DIR = Path(__file__).resolve().parents[1]
if str(AUTOMATION_DIR) not in sys.path:
    sys.path.insert(0, str(AUTOMATION_DIR))

from select_targets import (  # noqa: E402
    resolve_targets_by_tickers,
    select_domestic_targets,
    select_issue_targets,
    select_overseas_targets,
)


def test_select_domestic_targets_top5():
    items = [
        {"ticker": "A", "probability_score": 70},
        {"ticker": "B", "probability_score": 80},
        {"ticker": "C", "probability_score": 60},
        {"ticker": "D", "probability_score": 90},
        {"ticker": "E", "probability_score": 50},
        {"ticker": "F", "probability_score": 40},
    ]
    selected = select_domestic_targets(items, limit=5)
    assert len(selected) == 5
    assert selected[0]["ticker"] == "D"
    assert all(item["source"] == "scanner" for item in selected)


def test_select_domestic_targets_skips_cooldown():
    items = [{"ticker": f"T{i}", "probability_score": 100 - i} for i in range(8)]
    selected = select_domestic_targets(items, limit=5, excluded_tickers={"T0", "T1", "T2"})
    tickers = [item["ticker"] for item in selected]
    assert tickers == ["T3", "T4", "T5", "T6", "T7"]


def test_select_overseas_targets_dedup_and_fill():
    scanner = [{"ticker": f"S{i}", "probability_score": 90 - i, "name": f"S{i}"} for i in range(12)]
    mentions = [{"ticker": "S0", "mention_count": 500, "name": "S0"}]
    mentions += [{"ticker": f"M{i}", "mention_count": 300 - i, "name": f"M{i}"} for i in range(6)]

    selected = select_overseas_targets(scanner, mentions, total=15)
    assert len(selected) == 15
    tickers = [item["ticker"] for item in selected]
    assert tickers.count("S0") == 1
    assert len([x for x in selected if x["source"] == "scanner"]) == 10
    assert len([x for x in selected if x["source"] == "community_mentions"]) >= 1


def test_select_overseas_skips_cooldown():
    scanner = [{"ticker": f"S{i}", "probability_score": 90 - i} for i in range(20)]
    mentions = [{"ticker": f"M{i}", "mention_count": 100 - i} for i in range(10)]
    selected = select_overseas_targets(scanner, mentions, total=5, excluded_tickers={"S0", "M0"})
    tickers = {item["ticker"] for item in selected}
    assert "S0" not in tickers
    assert "M0" not in tickers


def _issue_pool(n: int) -> list[dict]:
    # issue_score 낮은 순으로 T0..T{n-1} (T0가 가장 이슈 강함)
    return [
        {"ticker": f"T{i}", "probability_score": 50, "issue_score": n - i, "hard_catalyst": False}
        for i in range(n)
    ]


def test_select_issue_targets_fills_exact_count_even_without_issues():
    # 뉴스도 하드 카탈리스트도 없어도 목표 개수를 반드시 채운다.
    pool = _issue_pool(30)
    selected = select_issue_targets(pool, target=20, news_fetcher=lambda t: [])
    assert len(selected) == 20
    # 이슈 스코어 높은 순으로 채워짐
    assert selected[0]["ticker"] == "T0"


def test_select_issue_targets_prioritizes_news_and_catalyst():
    pool = _issue_pool(10)
    pool[9]["hard_catalyst"] = True  # 이슈 스코어는 최하지만 하드 카탈리스트
    news = {"T7": [{"title": "x"}]}  # T7만 뉴스 보유
    selected = select_issue_targets(
        pool, target=3, news_fetcher=lambda t: news.get(t, [])
    )
    tickers = [s["ticker"] for s in selected]
    # tier1(뉴스 T7 / 카탈리스트 T9)이 먼저, 그다음 이슈 스코어 상위로 채움
    assert "T7" in tickers and "T9" in tickers
    assert len(selected) == 3
    assert selected[0]["ticker"] == "T7"  # 뉴스 가점이 최우선
    assert next(s for s in selected if s["ticker"] == "T7").get("recent_news")


def test_select_issue_targets_respects_cooldown():
    pool = _issue_pool(25)
    selected = select_issue_targets(
        pool, target=20, excluded_tickers={"T0", "T1"}, news_fetcher=lambda t: []
    )
    tickers = {s["ticker"] for s in selected}
    assert "T0" not in tickers and "T1" not in tickers
    assert len(selected) == 20


def test_resolve_targets_by_tickers():
    scanner = [
        {"ticker": "281820", "name": "케이씨텍", "probability_score": 90},
        {"ticker": "041830", "name": "인바디", "probability_score": 80},
    ]
    resolved = resolve_targets_by_tickers(["041830", "281820"], scanner)
    assert [item["ticker"] for item in resolved] == ["041830", "281820"]