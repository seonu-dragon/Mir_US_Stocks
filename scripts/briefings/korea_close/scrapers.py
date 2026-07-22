import requests
from bs4 import BeautifulSoup
import urllib3
import re
import yfinance as yf
import feedparser

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7"
}

def _parse_naver_index_change(text):
    """네이버 금융 지수 페이지의 전일대비 문자열을 파싱합니다. 예: '180.62 +2.11% 상승'"""
    cleaned = text.replace(",", "").strip()
    match = re.search(r"([\d.]+)\s*([+-][\d.]+)%", cleaned)
    if not match:
        return None, None

    change = float(match.group(1))
    change_pct = float(match.group(2))
    if change_pct < 0 or "하락" in cleaned:
        change = -abs(change)
    return change, change_pct


def _fetch_indices_from_naver():
    """네이버 금융 공식 지수 페이지에서 당일 종가·전일대비를 수집합니다."""
    results = {}
    for code, label in (("KOSPI", "KOSPI"), ("KOSDAQ", "KOSDAQ")):
        try:
            url = f"https://finance.naver.com/sise/sise_index.naver?code={code}"
            resp = requests.get(url, headers=HEADERS, timeout=10)
            if resp.status_code != 200:
                results[label] = None
                continue

            soup = BeautifulSoup(resp.text, "html.parser")
            now_el = soup.select_one("#now_value")
            change_el = soup.select_one("#change_value_and_rate")
            if not now_el or not change_el:
                results[label] = None
                continue

            close_val = float(now_el.get_text(strip=True).replace(",", ""))
            change, change_pct = _parse_naver_index_change(change_el.get_text(" ", strip=True))
            if change is None:
                results[label] = None
                continue

            results[label] = {
                "close": close_val,
                "change": change,
                "change_pct": change_pct,
            }
        except Exception as e:
            print(f"  [경고] 네이버 {label} 지수 파싱 중 오류: {e}")
            results[label] = None
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
    results = _fetch_indices_from_naver()
    if not all(results.get(label) for label in ("KOSPI", "KOSDAQ")):
        print("  [경고] 네이버 지수 수집이 불완전하여 yfinance 메타데이터로 보완합니다.")
        fallback = _fetch_indices_from_yfinance()
        for label in ("KOSPI", "KOSDAQ"):
            if not results.get(label) and fallback.get(label):
                results[label] = fallback[label]

    if not results:
        return {"KOSPI": None, "KOSDAQ": None}
    return results

def fetch_investor_trends():
    """네이버 금융 홈에서 코스피/코스닥 개인, 외국인, 기관 순매수액 파싱"""
    url = "https://finance.naver.com/"
    results = {"KOSPI": {}, "KOSDAQ": {}}
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        if resp.status_code == 200:
            html = resp.text
            
            kospi_block = re.search(r'class="kospi_area.*?group_quot.*?".*?<div class="dsc_area">.*?</div>', html, re.DOTALL)
            kosdaq_block = re.search(r'class="kosdaq_area.*?group_quot.*?".*?<div class="dsc_area">.*?</div>', html, re.DOTALL)
            
            def parse_block(block_text):
                items = re.findall(r'<dt>(.*?)</dt>\s*<dd[^>]*>(.*?)</dd>', block_text, re.DOTALL)
                res = {}
                for dt, dd in items:
                    name = re.sub(r'<[^>]*>', '', dt).strip()
                    val = re.sub(r'<[^>]*>', '', dd).strip()
                    val = val.replace("억원", "").strip()
                    res[name] = val
                return res

            if kospi_block:
                results["KOSPI"] = parse_block(kospi_block.group(0))
            if kosdaq_block:
                results["KOSDAQ"] = parse_block(kosdaq_block.group(0))
    except Exception as e:
        print(f"  [경고] 매매 동향 데이터 수집 중 오류: {e}")
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
