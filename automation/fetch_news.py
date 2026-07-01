"""Fetch recent stock headlines for Kiwoom post generation."""

from __future__ import annotations

import html
import json
import time
import urllib.parse
import urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

KST = ZoneInfo("Asia/Seoul")
_HTTP_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; MirUSStocks/1.0)",
    "Accept": "application/json",
}
_last_naver_call = 0.0


def _naver_throttle() -> None:
    global _last_naver_call
    elapsed = time.monotonic() - _last_naver_call
    if elapsed < 0.35:
        time.sleep(0.35 - elapsed)
    _last_naver_call = time.monotonic()


def fetch_naver_news(code: str, limit: int = 3) -> list[dict]:
    code = str(code or "").replace(".KS", "").replace(".KQ", "")
    url = f"https://m.stock.naver.com/api/news/stock/{code}?pageSize={max(limit * 3, 8)}&page=1"
    req = urllib.request.Request(
        url,
        headers={**_HTTP_HEADERS, "Referer": "https://m.stock.naver.com/"},
    )
    try:
        _naver_throttle()
        clusters = json.loads(urllib.request.urlopen(req, timeout=12).read().decode("utf-8", "replace"))
    except Exception:
        return []

    items: list[dict] = []
    seen: set[str] = set()
    for cluster in clusters if isinstance(clusters, list) else []:
        for entry in cluster.get("items") or []:
            title = html.unescape(str(entry.get("titleFull") or entry.get("title") or "").strip())
            if not title or title in seen:
                continue
            seen.add(title)
            dt = str(entry.get("datetime") or "")
            published_at = f"{dt[0:4]}-{dt[4:6]}-{dt[6:8]}" if len(dt) >= 8 else ""
            items.append(
                {
                    "title": title,
                    "publisher": html.unescape(str(entry.get("officeName") or "").strip()),
                    "publishedAt": published_at,
                }
            )
            break
        if len(items) >= limit:
            break
    return items[:limit]


def fetch_yahoo_news(symbol: str, limit: int = 3) -> list[dict]:
    url = (
        "https://query1.finance.yahoo.com/v1/finance/search?"
        f"q={urllib.parse.quote(symbol)}&newsCount={max(limit, 5)}&quotesCount=0&enableFuzzyQuery=false"
    )
    req = urllib.request.Request(url, headers=_HTTP_HEADERS)
    try:
        payload = json.loads(urllib.request.urlopen(req, timeout=10).read().decode("utf-8", "replace"))
    except Exception:
        return []

    items: list[dict] = []
    for entry in (payload.get("news") or [])[:limit]:
        title = str(entry.get("title") or "").strip()
        if not title:
            continue
        published_at = ""
        published = entry.get("providerPublishTime")
        if published:
            try:
                published_at = datetime.fromtimestamp(int(published), tz=KST).strftime("%Y-%m-%d")
            except Exception:
                published_at = ""
        items.append(
            {
                "title": title,
                "publisher": str(entry.get("publisher") or "").strip(),
                "publishedAt": published_at,
            }
        )
    return items


def fetch_stock_news(ticker: str, market: str, limit: int = 3) -> list[dict]:
    if market.upper() == "KR":
        return fetch_naver_news(ticker, limit=limit)
    return fetch_yahoo_news(ticker, limit=limit)