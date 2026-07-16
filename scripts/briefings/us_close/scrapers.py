"""
US Market Close – Data Scrapers
================================
Collects data needed to compose the US market close briefing that runs at 06:00 KST
(right after the US session ends).

Data sources:
 1. yfinance  – US major indices, sector ETFs, VIX, 10Y yield, WTI oil
 2. RSS feeds – Yahoo Business, CNBC Finance, WSJ Business
 3. Social    – Reddit (ApeWisdom), Stocktwits, Yahoo Trending (reused from US_Market_Premarket)
"""

import requests
from bs4 import BeautifulSoup
import urllib3
import re
import sys
import yfinance as yf
import feedparser
from datetime import datetime, timedelta
from pathlib import Path

# main.py 가 common 을 sys.path 에 넣어주지만, 이 모듈을 단독으로 import 하는 경우
# (진단 스크립트 등)도 있어 스스로 붙여둔다.
_COMMON_DIR = Path(__file__).resolve().parent.parent / "common"
if str(_COMMON_DIR) not in sys.path:
    sys.path.insert(0, str(_COMMON_DIR))
from http_client import fetch_json_via_curl  # noqa: E402

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7"
}

# ── US Major Indices + Macro ──────────────────────────────────────────

def fetch_us_indices():
    """yfinance로 S&P500, Nasdaq, Dow, Russell 2000 종가 및 등락률 수집"""
    tickers = {
        "S&P 500":   "^GSPC",
        "Nasdaq":    "^IXIC",
        "Dow Jones": "^DJI",
        "Russell 2000": "^RUT",
    }
    return _fetch_yf_close(tickers)


def fetch_macro_indicators():
    """yfinance로 VIX, US 10Y 국채수익률, WTI 원유 종가 수집"""
    tickers = {
        "VIX (공포지수)":   "^VIX",
        "US 10Y 국채수익률": "^TNX",
        "WTI 원유":         "CL=F",
    }
    return _fetch_yf_close(tickers)


def fetch_sector_etf_performance():
    """yfinance로 11대 SPDR 섹터 ETF 등락률 수집"""
    tickers = {
        "XLK (정보기술)":      "XLK",
        "XLF (금융)":          "XLF",
        "XLE (에너지)":        "XLE",
        "XLV (헬스케어)":      "XLV",
        "XLI (산업재)":        "XLI",
        "XLY (경기소비재)":    "XLY",
        "XLP (필수소비재)":    "XLP",
        "XLC (통신서비스)":    "XLC",
        "XLRE (부동산)":       "XLRE",
        "XLU (유틸리티)":      "XLU",
        "XLB (소재)":          "XLB",
    }
    return _fetch_yf_close(tickers)


def _fetch_yf_close(ticker_map):
    """Helper: ticker_map {label: symbol} → {label: {close, change, change_pct}}"""
    today = datetime.now()
    start = (today - timedelta(days=7)).strftime("%Y-%m-%d")
    end   = (today + timedelta(days=2)).strftime("%Y-%m-%d")
    results = {}

    symbols = list(ticker_map.values())
    try:
        raw = yf.download(symbols, start=start, end=end, progress=False)
        close_df = raw["Close"] if "Close" in raw.columns else raw

        for label, symbol in ticker_map.items():
            try:
                if len(symbols) == 1:
                    series = close_df.dropna()
                else:
                    series = close_df[symbol].dropna()
                if series.empty:
                    results[label] = None
                    continue
                close_val = float(series.iloc[-1])
                prev_close = float(series.iloc[-2]) if len(series) > 1 else close_val
                change = close_val - prev_close
                change_pct = (change / prev_close) * 100 if prev_close else 0
                results[label] = {
                    "close": close_val,
                    "change": change,
                    "change_pct": change_pct,
                }
            except Exception:
                results[label] = None
    except Exception as e:
        print(f"  [경고] yfinance 데이터 수집 중 오류: {e}")
        for label in ticker_map:
            results[label] = None
    return results


# ── US News RSS ───────────────────────────────────────────────────────

def fetch_us_news():
    """Yahoo Business, CNBC Finance, WSJ Business RSS에서 최신 뉴스 수집"""
    rss_feeds = [
        ("Yahoo Business", "https://finance.yahoo.com/news/rssindex"),
        ("CNBC Finance",   "https://www.cnbc.com/id/10000664/device/rss/rss.html"),
        ("WSJ Business",   "https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml"),
    ]
    news_items = []
    for name, url in rss_feeds:
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            if resp.status_code == 200:
                feed = feedparser.parse(resp.content)
                count = 0
                for entry in feed.entries:
                    if count >= 5:
                        break
                    title = entry.get("title", "").strip()
                    link  = entry.get("link", "").strip()
                    if title and link:
                        news_items.append({"source": name, "title": title, "link": link})
                        count += 1
        except Exception as e:
            print(f"  [경고] {name} RSS 뉴스 수집 중 오류: {e}")
    return news_items


# ── Social Trending (Reddit / Stocktwits / Yahoo) ─────────────────────

def fetch_reddit_trending():
    """ApeWisdom API로 Reddit 인기 종목 수집"""
    url = "https://apewisdom.io/api/v1.0/filter/all-stocks/page/1"
    results = []
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            for idx, item in enumerate(data.get("results", [])[:15], 1):
                mentions = item.get("mentions", 0)
                mentions_prev = item.get("mentions_24h_ago", 0)
                change_val = mentions - mentions_prev
                results.append({
                    "rank": idx,
                    "ticker": item.get("ticker", ""),
                    "name": item.get("name", ""),
                    "mentions": mentions,
                    "mentions_prev": mentions_prev,
                    "change_str": f"{'+' if change_val >= 0 else ''}{change_val}",
                })
    except Exception as e:
        print(f"  [경고] Reddit 트렌드 수집 중 오류: {e}")
    return results


def fetch_stocktwits_trending():
    """Stocktwits 인기 급상승 심볼 수집.

    requests 가 아니라 curl 로 때린다. Stocktwits 는 Cloudflare 뒤에 있고, Cloudflare 는
    python-requests 의 TLS 지문을 봇으로 보고 403("Just a moment...")을 준다. 같은
    Actions 러너에서 curl 은 200 이 온다 — 실측으로 확인했다(자세한 배경은
    common/http_client.py 참고).

    이 함수는 2026-06 말부터 Actions 에서 계속 0건이었는데, 200 이 아니면 아무것도
    찍지 않고 빈 리스트를 돌려줘서 로그에조차 안 남았다. 이제 상태코드를 남긴다.
    """
    url = "https://api.stocktwits.com/api/2/trending/symbols.json"
    results = []
    status, data, raw = fetch_json_via_curl(url, HEADERS, timeout=15)
    if status != 200 or data is None:
        print(f"  [경고] Stocktwits 트렌드 HTTP {status} → 0건. 본문: {raw[:160]!r}")
        return results
    for idx, sym in enumerate(data.get("symbols", [])[:15], 1):
        results.append({
            "rank": idx,
            "symbol": sym.get("symbol", ""),
            "name":   sym.get("title", ""),
            "watchlist_count": sym.get("watchlist_count", 0),
        })
    if not results:
        print("  [경고] Stocktwits 트렌드 200 이지만 symbols 가 비어 있다 → 응답 형식 변경 의심.")
    return results


def fetch_yahoo_trending():
    """Yahoo Finance Trending Tickers 수집"""
    url = "https://finance.yahoo.com/trending-tickers"
    results = []
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.text, "html.parser")
            table = soup.find("table")
            if table:
                rows = table.find_all("tr")
                for idx, row in enumerate(rows[1:16], 1):
                    cols = row.find_all("td")
                    if len(cols) >= 3:
                        results.append({
                            "rank": idx,
                            "symbol": cols[0].text.strip(),
                            "name":   cols[1].text.strip(),
                            "price":  cols[2].text.strip(),
                        })
            else:
                links = soup.find_all("a", href=True)
                tickers = []
                for link in links:
                    href = link["href"]
                    if "/quote/" in href:
                        symbol = href.split("/quote/")[1].split("?")[0].split("/")[0].strip()
                        if symbol.isalpha() and len(symbol) <= 5 and symbol not in tickers:
                            tickers.append(symbol)
                for idx, ticker in enumerate(tickers[:15], 1):
                    results.append({"rank": idx, "symbol": ticker, "name": "", "price": ""})
    except Exception as e:
        print(f"  [경고] Yahoo Trending 수집 중 오류: {e}")
    return results
