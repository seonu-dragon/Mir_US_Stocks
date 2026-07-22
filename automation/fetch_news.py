"""Fetch recent stock headlines for Kiwoom post generation.

브리핑에 쓰는 뉴스는 반드시 '최근' 것만 사용한다. 기본적으로 오늘/어제(2일 이내)
뉴스만 남기고, 3일 이상 지난 기사는 제외한다. (NEWS_MAX_AGE_DAYS로 조정 가능)

뉴스 출처는 특정 매체(야후 등)에 쏠리지 않게 여러 소스를 섞는다.
- 국내: 네이버 증권(여러 언론사) + 구글뉴스(한국)
- 해외: 구글뉴스(여러 언론사) + 야후파이낸스
동일 종목이라도 매체가 다양하게 노출되도록 publisher 기준으로 분산한다.
"""

from __future__ import annotations

import html
import json
import os
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, datetime
from email.utils import parsedate_to_datetime
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


def fetch_google_news(query: str, limit: int = 6, region: str = "US") -> list[dict]:
    """구글뉴스 RSS 검색 — 여러 언론사 기사를 모은다. 링크는 원 매체로 연결된다."""
    if not query:
        return []
    if region == "KR":
        params = "hl=ko&gl=KR&ceid=KR:ko"
    else:
        params = "hl=en-US&gl=US&ceid=US:en"
    url = f"https://news.google.com/rss/search?q={urllib.parse.quote(query)}&{params}"
    req = urllib.request.Request(url, headers={**_HTTP_HEADERS, "Accept": "application/rss+xml"})
    try:
        raw = urllib.request.urlopen(req, timeout=10).read()
        root = ET.fromstring(raw)
    except Exception:
        return []

    items: list[dict] = []
    for item in root.iter("item"):
        title = html.unescape((item.findtext("title") or "").strip())
        if not title:
            continue
        # 구글뉴스 제목은 "헤드라인 - 매체" 형태 → 매체명을 분리.
        source_el = item.find("source")
        publisher = (source_el.text or "").strip() if source_el is not None else ""
        if not publisher and " - " in title:
            title, publisher = title.rsplit(" - ", 1)
            title = title.strip()
            publisher = publisher.strip()
        published_at = ""
        pub = item.findtext("pubDate")
        if pub:
            try:
                published_at = parsedate_to_datetime(pub).astimezone(KST).strftime("%Y-%m-%d")
            except (TypeError, ValueError):
                published_at = ""
        items.append(
            {
                "title": title,
                "publisher": publisher,
                "publishedAt": published_at,
                "link": (item.findtext("link") or "").strip(),
            }
        )
        if len(items) >= limit:
            break
    return items


def _dedupe_diversify(items: list[dict], limit: int) -> list[dict]:
    """제목 중복 제거 + 같은 매체 쏠림 방지(매체별 우선 1건씩 라운드로빈)."""
    seen_titles: set[str] = set()
    by_publisher: dict[str, list[dict]] = {}
    order: list[str] = []
    for it in items:
        title = str(it.get("title") or "").strip()
        key = title.lower()[:60]
        if not title or key in seen_titles:
            continue
        seen_titles.add(key)
        pub = str(it.get("publisher") or "").strip() or "기타"
        if pub not in by_publisher:
            by_publisher[pub] = []
            order.append(pub)
        by_publisher[pub].append(it)

    result: list[dict] = []
    round_idx = 0
    while len(result) < limit:
        added = False
        for pub in order:
            bucket = by_publisher[pub]
            if round_idx < len(bucket):
                result.append(bucket[round_idx])
                added = True
                if len(result) >= limit:
                    break
        if not added:
            break
        round_idx += 1
    return result


def fetch_stock_news(
    ticker: str, market: str, limit: int = 3, name: str | None = None
) -> list[dict]:
    """최근(기본 2일 이내) 뉴스만 최대 limit개 반환. 여러 매체를 섞어 야후 등 한쪽 쏠림을 막는다."""
    max_age = _max_age_days()
    raw_limit = max(limit * 3, 10)
    combined: list[dict] = []
    if market.upper() == "KR":
        combined += fetch_naver_news(ticker, limit=raw_limit)
        query = (name or "").strip() or str(ticker)
        combined += fetch_google_news(f"{query} 주가", limit=raw_limit, region="KR")
    else:
        query = (name or "").strip()
        # 회사명이 있으면 관련도가 높고 매체가 다양한 구글뉴스를 우선.
        combined += fetch_google_news(f"{query or ticker} stock", limit=raw_limit, region="US")
        combined += fetch_yahoo_news(ticker, limit=raw_limit)

    recent = [item for item in combined if _is_recent(item.get("publishedAt", ""), max_age)]
    return _dedupe_diversify(recent, limit)
