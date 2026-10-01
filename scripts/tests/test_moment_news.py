"""큰 등락일 뉴스 미리 모으기(build_moment_news.py) — 오프라인."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import build_moment_news as b


def _series(n, jumps):
    out, p, d = [], 100.0, date(2026, 1, 5)
    for i in range(n):
        if i:
            p *= 1 + jumps.get(i, 0.005 if i % 2 else -0.004)
        while d.weekday() >= 5:
            d += timedelta(days=1)
        out.append([p, p, p, p, 1000, d.isoformat()])
        d += timedelta(days=1)
    return out


def test_key_moments_same_rule_as_screen():
    s = _series(80, {50: 0.12, 70: -0.02})
    ms = b.key_moments(s, "2000-01-01")
    assert [m["date"] for m in ms] == [s[50][5]]          # 2% 는 3% 미만이라 아님
    assert abs(ms[0]["pct"] - 12.0) < 0.01
    assert b.key_moments(s, s[60][5]) == []               # 기간(since) 밖


def test_compact_link_and_shard():
    assert b.compact_link("https://news.google.com/rss/articles/CBMi_a-1?oc=5") == "g:CBMi_a-1"
    assert b.compact_link("https://example.com/x") == "https://example.com/x"
    # timeline.js 는 MirEventStudyCore.shardOf(티커, 64) — 같은 zlib.crc32 값(node 로 대조: NVDA 23 · 005930 24).
    assert b.SHARDS == 64
    assert b.shard_of("NVDA") == 23 and b.shard_of("005930") == 24


def test_search_moment_filters_window_and_name(monkeypatch):
    def pub(d, h=15):
        return datetime(d.year, d.month, d.day, h, tzinfo=timezone.utc)
    day = date(2026, 9, 28)
    items = [
        {"title": "Why is Gold Fields stock plunging today?", "link": "https://news.google.com/rss/articles/AAA?oc=5", "source": "Investing.com", "pub": pub(day)},
        {"title": "Gold Fields bid rejected", "link": "https://r.example/b", "source": "Reuters", "pub": pub(day + timedelta(days=1))},
        {"title": "Gold Fields old story", "link": "https://r.example/c", "source": "X", "pub": pub(day - timedelta(days=6))},   # 창 밖
        {"title": "Mining sector wrap", "link": "https://r.example/d", "source": "Y", "pub": pub(day)},                        # 회사명 없음
        {"title": "Why is Gold Fields stock plunging today?", "link": "https://r.example/e", "source": "Dup", "pub": pub(day)},  # 같은 제목
    ]
    queries = []
    monkeypatch.setattr(b, "google_rss", lambda q, m: queries.append(q) or items)
    rows = b.search_moment({"ticker": "GFI", "company": "Gold Fields Ltd"}, "us", day.isoformat())
    assert [r[0] for r in rows] == ["Why is Gold Fields stock plunging today?", "Gold Fields bid rejected"]
    assert rows[0][2] == "g:AAA" and rows[0][3] == "2026-09-28"
    assert "after:2026-09-25" in queries[0] and "before:2026-10-01" in queries[0]


def test_blocked_streak_stops_run(monkeypatch, tmp_path):
    monkeypatch.setattr(b, "OUT_DIR", tmp_path)
    monkeypatch.setattr(b, "universe", lambda m: [{"ticker": f"T{i}", "company": f"Co{i}", "marketCapB": 100 - i} for i in range(3)])
    s = _series(80, {50: 0.12})
    monkeypatch.setattr(b.mv, "load_json", lambda p, d=None: {"chartSeries": s} if "details" in str(p) else d)
    calls = []

    def boom(stock, market, day):
        calls.append(stock["ticker"])
        raise b.Blocked("HTTP 503")

    monkeypatch.setattr(b, "search_moment", boom)
    monkeypatch.setattr(b.time, "sleep", lambda _s: None)
    monkeypatch.setattr(b, "MAX_FAIL_STREAK", 2)
    paths, asked, blocked, _summary = b.build_market("us", max_queries=10, dry_run=False, since="2000-01-01")
    assert blocked and asked == 0 and len(calls) == 2 and paths == []
