"""국내 지수·수급·뉴스 수집.

2026-09-15 이전에는 finance.naver.com PC 페이지를 긁었는데 두 스크레이퍼 모두
실측 0건이었다(#now_value / kospi_area 마크업 소멸). 그 결과 브리핑에는
"데이터 수집 실패" 만 실리고 AI 가 헤드라인만 보고 수급을 창작했다
("외국인 3.2조 순매도"). 지금은 m.stock JSON API 를 쓴다 —
  지수: /api/index/{KOSPI|KOSDAQ}/basic  (closePrice, fluctuationsRatio,
        compareToPreviousClosePrice)
  수급: /api/index/{KOSPI|KOSDAQ}/trend  (personalValue, foreignValue,
        institutionalValue — 억원)
둘 다 실패하면 값을 지어내지 않고 None 을 돌려준다(호출부가 발행을 막는다).
"""

import time

import feedparser
import requests
import yfinance as yf

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7"
}

MSTOCK_API = "https://m.stock.naver.com/api"
MSTOCK_HEADERS = {**HEADERS, "Accept": "application/json", "Referer": "https://m.stock.naver.com/"}
INDEX_CODES = (("KOSPI", "KOSPI"), ("KOSDAQ", "KOSDAQ"))


def _mstock_json(path, retries=3):
    """m.stock JSON 엔드포인트. 실패하면 None(예외를 밖으로 던지지 않는다)."""
    url = f"{MSTOCK_API}/{path.lstrip('/')}"
    for attempt in range(retries):
        try:
            resp = requests.get(url, headers=MSTOCK_HEADERS, timeout=15)
            if resp.status_code == 200:
                return resp.json()
            print(f"  [경고] m.stock {path} HTTP {resp.status_code}")
        except Exception as e:
            print(f"  [경고] m.stock {path} 호출 오류: {e}")
        if attempt < retries - 1:
            time.sleep(1.0 * (attempt + 1))
    return None


def _num(value):
    """'6,657.91' · '-26.46' · '+4,942' → float. 값이 없으면 None(0 으로 채우지 않는다)."""
    if value is None:
        return None
    text = str(value).replace(",", "").replace("%", "").strip()
    if not text or text in {"-", "N/A"}:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _fetch_indices_from_mstock():
    """m.stock 지수 API 에서 당일 종가·전일대비를 수집합니다."""
    results = {}
    for code, label in INDEX_CODES:
        payload = _mstock_json(f"index/{code}/basic")
        if not payload:
            results[label] = None
            continue
        close_val = _num(payload.get("closePrice"))
        change = _num(payload.get("compareToPreviousClosePrice"))
        change_pct = _num(payload.get("fluctuationsRatio"))
        if close_val is None or change_pct is None:
            print(f"  [경고] m.stock {label} 응답에 종가/등락률 없음")
            results[label] = None
            continue
        if change is None:
            # 등락률만 있으면 변동폭을 역산한다(창작이 아니라 같은 응답의 파생값).
            change = round(close_val - close_val / (1 + change_pct / 100), 2)
        results[label] = {
            "close": close_val,
            "change": change,
            "change_pct": change_pct,
        }
    return results


def _fetch_indices_from_yfinance():
    """yfinance 시세 메타데이터로 당일 종가·전일대비를 수집합니다."""
    tickers = {
        "KOSPI": "^KS11",
        "KOSDAQ": "^KQ11",
    }
    results = {}
    for label, ticker in tickers.items():
        try:
            info = yf.Ticker(ticker).info
            close_val = info.get("regularMarketPrice")
            change = info.get("regularMarketChange")
            change_pct = info.get("regularMarketChangePercent")
            if close_val is None or change is None or change_pct is None:
                results[label] = None
                continue
            results[label] = {
                "close": float(close_val),
                "change": float(change),
                "change_pct": float(change_pct),
            }
        except Exception as e:
            print(f"  [경고] yfinance {label} 지수 수집 중 오류: {e}")
            results[label] = None
    return results


def fetch_indices():
    """코스피/코스닥 당일 종가 및 전일대비 등락을 수집합니다."""
    results = _fetch_indices_from_mstock()
    if not all(results.get(label) for label in ("KOSPI", "KOSDAQ")):
        print("  [경고] m.stock 지수 수집이 불완전하여 yfinance 메타데이터로 보완합니다.")
        fallback = _fetch_indices_from_yfinance()
        for label in ("KOSPI", "KOSDAQ"):
            if not results.get(label) and fallback.get(label):
                results[label] = fallback[label]

    if not results:
        return {"KOSPI": None, "KOSDAQ": None}
    return results


def fetch_investor_trends():
    """코스피/코스닥 개인·외국인·기관 순매수(억원). m.stock index/{code}/trend."""
    results = {"KOSPI": {}, "KOSDAQ": {}}
    fields = (("개인", "personalValue"), ("외국인", "foreignValue"), ("기관", "institutionalValue"))
    for code, label in INDEX_CODES:
        payload = _mstock_json(f"index/{code}/trend")
        if not payload:
            continue
        parsed = {}
        for name, key in fields:
            value = _num(payload.get(key))
            if value is None:
                continue
            parsed[name] = f"{value:+,.0f}"
        if parsed:
            if payload.get("bizdate"):
                parsed["기준일"] = str(payload["bizdate"])
            results[label] = parsed
    return results


def fetch_market_news():
    """한경 금융 및 매경 증권 RSS에서 최신 뉴스 각각 5개씩 수집"""
    rss_feeds = [
        ("Hankyung", "https://www.hankyung.com/feed/finance"),
        ("Maekyung", "https://www.mk.co.kr/rss/50200011/")
    ]
    news_items = []

    for name, url in rss_feeds:
        try:
            resp = requests.get(url, headers=HEADERS, timeout=10)
            if resp.status_code == 200:
                feed = feedparser.parse(resp.content)
                count = 0
                for entry in feed.entries:
                    if count >= 5:
                        break
                    title = entry.get("title", "").strip()
                    link = entry.get("link", "").strip()
                    if title and link:
                        news_items.append({
                            "source": name,
                            "title": title,
                            "link": link
                        })
                        count += 1
        except Exception as e:
            print(f"  [경고] {name} RSS 수집 중 오류: {e}")

    return news_items


def has_market_data(indices, trends):
    """지수·수급 중 **하나라도** 실측이 있는지. 둘 다 비면 브리핑을 발행하지 않는다."""
    has_index = any((indices or {}).get(label) for label in ("KOSPI", "KOSDAQ"))
    has_flow = any((trends or {}).get(label) for label in ("KOSPI", "KOSDAQ"))
    return bool(has_index or has_flow)


__all__ = [
    "fetch_indices",
    "fetch_investor_trends",
    "fetch_market_news",
    "has_market_data",
]
