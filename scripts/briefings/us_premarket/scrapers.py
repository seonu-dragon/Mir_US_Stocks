import requests
from bs4 import BeautifulSoup
import urllib3
import re
import sys
import feedparser
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

def fetch_reddit_trending():
    """ApeWisdom API를 통해 Reddit(r/wallstreetbets 등)에서 실시간으로 언급이 활발한 미국 주식 트렌드 수집"""
    url = "https://apewisdom.io/api/v1.0/filter/all-stocks/page/1"
    results = []
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            for idx, item in enumerate(data.get("results", [])[:15], 1):
                ticker = item.get("ticker", "")
                name = item.get("name", "")
                mentions = item.get("mentions", 0)
                mentions_prev = item.get("mentions_24h_ago", 0)
                
                # 계산: 언급 횟수 변동량
                change_val = mentions - mentions_prev
                change_sign = "+" if change_val >= 0 else ""
                
                results.append({
                    "rank": idx,
                    "ticker": ticker,
                    "name": name,
                    "mentions": mentions,
                    "mentions_prev": mentions_prev,
                    "change_str": f"{change_sign}{change_val}"
                })
    except Exception as e:
        print(f"  [경고] Reddit 실시간 트렌드 수집 중 오류: {e}")
    return results

def fetch_stocktwits_trending():
    """Stocktwits 실시간 인기 급상승 심볼 수집.

    us_close/scrapers.py 에 같은 함수가 하나 더 있다(동작 동일). Cloudflare 가
    python-requests 를 TLS 지문으로 걸러내는 문제도 같아서 여기도 curl 로 때린다 —
    자세한 배경은 common/http_client.py 참고.
    """
    url = "https://api.stocktwits.com/api/2/trending/symbols.json"
    results = []
    status, data, raw = fetch_json_via_curl(url, HEADERS, timeout=15)
    if status != 200 or data is None:
        print(f"  [경고] Stocktwits 실시간 트렌드 HTTP {status} → 0건. 본문: {raw[:160]!r}")
        return results
    for idx, sym in enumerate(data.get("symbols", [])[:15], 1):
        results.append({
            "rank": idx,
            "symbol": sym.get("symbol", ""),
            "name": sym.get("title", ""),
            "watchlist_count": sym.get("watchlist_count", 0),
        })
    if not results:
        print("  [경고] Stocktwits 실시간 트렌드 200 이지만 symbols 가 비어 있다 → 응답 형식 변경 의심.")
    return results

def premarket_change_pct(symbol):
    """Yahoo v8 chart로 해당 종목의 '프리마켓 변동률(%)'을 직접 계산한다.

    트렌딩/스크리너 페이지의 'Change %'는 프리마켓 시간대엔 어제 정규장 마감 변동률이라
    오해를 부른다(부호가 반대인 경우도 있음). 프리마켓 마지막 체결가를 직전 정규장
    종가와 비교해 실제 프리마켓 변동률을 구한다. 데이터 없으면 None."""
    try:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?includePrePost=true&interval=2m&range=1d"
        resp = requests.get(url, headers={**HEADERS, "Accept": "application/json"}, timeout=10)
        if resp.status_code != 200:
            return None
        res = resp.json()["chart"]["result"][0]
        meta = res["meta"]
        base = meta.get("regularMarketPrice")
        ctp = meta.get("currentTradingPeriod", {})
        pre_start = ctp.get("pre", {}).get("start")
        reg_start = ctp.get("regular", {}).get("start")
        ts = res.get("timestamp", []) or []
        closes = (res.get("indicators", {}).get("quote", [{}])[0].get("close", []) or [])
        last_pre = None
        for t, c in zip(ts, closes):
            if c is not None and pre_start and reg_start and pre_start <= t < reg_start:
                last_pre = c
        if last_pre is None or not base:
            return None
        return round((last_pre - base) / base * 100, 2)
    except Exception:
        return None

def fetch_yahoo_trending():
    """Yahoo Finance Trending Tickers 파싱 수집"""
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
                        symbol = cols[0].text.strip()
                        name = cols[1].text.strip()
                        price = cols[2].text.strip()

                        # 페이지의 Change %는 프리마켓 시간대엔 어제 마감 변동률이므로
                        # 실제 프리마켓 변동률을 v8로 직접 계산한다(없으면 0.0).
                        pre_pct = premarket_change_pct(symbol)
                        change_pct = pre_pct if pre_pct is not None else 0.0

                        results.append({
                            "rank": idx,
                            "symbol": symbol,
                            "name": name,
                            "price": price,
                            "change_pct": change_pct
                        })
            else:
                # Fallback: parse symbols from quote links
                tickers = []
                links = soup.find_all("a", href=True)
                for link in links:
                    href = link["href"]
                    if "/quote/" in href and not any(x in href for x in ["/quote/spy", "/quote/index", "/quote/^"]):
                        symbol = href.split("/quote/")[1].split("?")[0].split("/")[0].strip()
                        if symbol.isalpha() and len(symbol) <= 5 and symbol not in tickers:
                            tickers.append(symbol)
                for idx, ticker in enumerate(tickers[:15], 1):
                    results.append({
                        "rank": idx,
                        "symbol": ticker,
                        "name": "",
                        "price": ""
                    })
    except Exception as e:
        print(f"  [경고] Yahoo Trending Tickers 수집 중 오류: {e}")
    return results

def _format_pct(raw):
    """'+504.3333%' → '+504.33%' 형태로 정리."""
    m = re.search(r'([-+]?[\d.]+)', raw or "")
    if not m:
        return raw or ""
    try:
        return f"{float(m.group(1)):+.2f}%"
    except ValueError:
        return raw

def _price_to_float(raw):
    m = re.search(r'([\d.]+)', (raw or "").replace(",", ""))
    return float(m.group(1)) if m else 0.0

def fetch_premarket_gainers():
    """stockanalysis.com에서 '실제 프리마켓' 상승 종목을 수집한다.

    Yahoo·NASDAQ의 mover 목록은 (목록·변동률 모두) 어제 정규장 마감 상승률 기준이라
    프리마켓 움직임을 반영하지 못했다(예: 어제 +500% → 프리마켓 -16%). stockanalysis.com
    프리마켓 gainers는 '프리마켓 변동률(premarketChangePercent)' 기준으로 정렬·표기하므로
    이를 사용하고, $1 미만 페니주는 제외해 의미 있는 종목만 남긴다."""
    url = "https://stockanalysis.com/markets/premarket/gainers/"
    results = []
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        if resp.status_code != 200:
            print(f"  [경고] 프리마켓 상승 종목 수집 실패 (HTTP {resp.status_code})")
            return results
        soup = BeautifulSoup(resp.text, "html.parser")
        table = soup.find("table")
        if not table:
            return results
        # 컬럼: [No, Symbol, Company Name, % Change, Premkt Price, Pre Volume, Market Cap]
        for row in table.select("tbody tr"):
            cols = [c.get_text(strip=True) for c in row.find_all("td")]
            if len(cols) < 5:
                continue
            symbol = cols[1]
            price_val = _price_to_float(cols[4])
            if not symbol or price_val < 1.0:  # 페니주 제외
                continue
            results.append({
                "symbol": symbol,
                "name": cols[2],
                "price": f"{price_val:g}",
                "change_pct": _format_pct(cols[3]),
                "link": f"https://stockanalysis.com/stocks/{symbol.lower()}/",
            })
            if len(results) >= 10:
                break
    except Exception as e:
        print(f"  [경고] 프리마켓 상승 종목 수집 중 오류: {e}")
    return results

def fetch_us_news():
    """Yahoo Business, CNBC Finance, WSJ Business RSS 피드에서 최신 미 현지 뉴스 수집"""
    rss_feeds = [
        ("Yahoo Business", "https://finance.yahoo.com/news/rssindex"),
        ("CNBC Finance", "https://www.cnbc.com/id/10000664/device/rss/rss.html"),
        ("WSJ Business", "https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml")
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
                    link = entry.get("link", "").strip()
                    if title and link:
                        news_items.append({
                            "source": name,
                            "title": title,
                            "link": link
                        })
                        count += 1
        except Exception as e:
            print(f"  [경고] {name} RSS 뉴스 수집 중 오류: {e}")
    return news_items
