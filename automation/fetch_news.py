"""Fetch recent stock headlines for Kiwoom post generation.

브리핑에 쓰는 뉴스는 반드시 '최근' 것만 사용한다. 기본적으로 오늘/어제(2일 이내)
뉴스만 남기고, 3일 이상 지난 기사는 제외한다. (NEWS_MAX_AGE_DAYS로 조정 가능)
"""

from __future__ import annotations

import html
import json
import os
import time
import urllib.parse
import urllib.request
from datetime import date, datetime
from zoneinfo import ZoneInfo

KST = ZoneInfo("Asia/Seoul")
_HTTP_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; MirUSStocks/1.0)",
    "Accept": "application/json",
}
_last_naver_call = 0.0


def _max_age_days() -> int:
    try:
        return max(0, int(os.getenv("NEWS_MAX_AGE_DAYS", "2")))
    except ValueError:
        return 2


def _is_recent(published_at: str, max_age_days: int, today: date | None = None) -> bool:
    """publishedAt(YYYY-MM-DD)이 max_age_days 이내면 True. 날짜가 없으면 제외한다."""
    if not published_at:
        return False
    try:
        published = datetime.strptime(published_at[:10], "%Y-%m-%d").date()
    except ValueError:
        return False
    ref = today or datetime.now(KST).date()
    age = (ref - published).days
    return 0 <= age <= max_age_days


def _naver_throttle() -> None:
    global _last_naver_call
    elapsed = time.monotonic() - _last_naver_call
    if elapsed < 0.35:
        time.sleep(0.35 - elapsed)
    _last_naver_call = time.monotonic()


def fetch_naver_news(code: str, limit: int = 3) -> list[dict]:
    code = str(code or "").replace(".KS", "").replace(".KQ", "")
    url = f"https://m.stock.naver.com/api/news/stock/{code}?pageSize={max(limit * 4, 12)}&page=1"
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
            office_id = str(entry.get("officeId") or "")
            article_id = str(entry.get("articleId") or "")
            link = (
                f"https://n.news.naver.com/mnews/article/{office_id}/{article_id}"
                if office_id and article_id
                else ""
            )
            items.append(
                {
                    "title": title,
                    "publisher": html.unescape(str(entry.get("officeName") or "").strip()),
                    "publishedAt": published_at,
                    "link": link,
                }
            )
            break
    return items


def fetch_yahoo_news(symbol: str, limit: int = 3) -> list[dict]:
    url = (
        "https://query1.finance.yahoo.com/v1/finance/search?"
        f"q={urllib.parse.quote(symbol)}&newsCount={max(limit * 3, 10)}&quotesCount=0&enableFuzzyQuery=false"
    )
    req = urllib.request.Request(url, headers=_HTTP_HEADERS)
    try:
        payload = json.loads(urllib.request.urlopen(req, timeout=10).read().decode("utf-8", "replace"))
    except Exception:
        return []

    items: list[dict] = []
    for entry in payload.get("news") or []:
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
                "link": str(entry.get("link") or "").strip(),
            }
        )
    return items


def fetch_stock_news(ticker: str, market: str, limit: int = 3) -> list[dict]:
    """최근(기본 2일 이내) 뉴스만 최대 limit개 반환한다."""
    max_age = _max_age_days()
    # 최신성 필터로 상당수가 걸러지므로 넉넉히 받아서 자른다.
    raw_limit = max(limit * 3, 10)
    if market.upper() == "KR":
        raw = fetch_naver_news(ticker, limit=raw_limit)
    else:
        raw = fetch_yahoo_news(ticker, limit=raw_limit)

    recent = [item for item in raw if _is_recent(item.get("publishedAt", ""), max_age)]
    return recent[:limit]
