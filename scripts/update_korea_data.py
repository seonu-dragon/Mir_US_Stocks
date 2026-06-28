"""Build Korean market snapshot for Mir US Stocks (Korea mode).

Data sources:
  - Naver Finance: KOSPI/KOSDAQ stock list, price, change, market cap, volume
  - Yahoo Finance: 5Y daily OHLCV history, fundamentals, news (via .KS / .KQ suffix)

Output:
  - data/korea/market_snapshot.json
  - data/korea/market_snapshot.js
  - data/korea/details/{CODE}.json
"""

from __future__ import annotations

import argparse
import html
import importlib.util
import json
import os
import re
import tempfile
import threading
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "korea" / "market_snapshot.json"
OUT_JS = ROOT / "data" / "korea" / "market_snapshot.js"
DETAILS_DIR = ROOT / "data" / "korea" / "details"

MAX_REAL_HISTORY = 600
# Naver fundamentals are cheap (1 JSON call) and cover all listed stocks, so we
# fetch them far wider than Yahoo did — every mid/small cap gets financials too.
MAX_FUNDAMENTALS = 1600
HTTP_HEADERS = {"User-Agent": "Mozilla/5.0", "Accept": "text/html,application/json"}

SECTOR_MAP = {
    "Technology": "기술",
    "Financial Services": "금융",
    "Healthcare": "헬스케어",
    "Consumer Cyclical": "경기소비재",
    "Consumer Defensive": "필수소비재",
    "Industrials": "산업재",
    "Energy": "에너지",
    "Basic Materials": "소재",
    "Communication Services": "커뮤니케이션",
    "Real Estate": "부동산",
    "Utilities": "유틸리티",
}

KR_ETFS = {
    "069500": ("KODEX 200", "ETF", "대형주 ETF", "all_etf", 50),
    "229200": ("KODEX 코스닥150", "ETF", "코스닥 ETF", "all_etf", 8),
    "102110": ("TIGER 200", "ETF", "대형주 ETF", "all_etf", 45),
    "091160": ("KODEX 반도체", "ETF", "반도체 ETF", "all_etf", 8),
    "305720": ("KODEX 2차전지산업", "ETF", "2차전지 ETF", "all_etf", 5),
    "091170": ("KODEX 은행", "ETF", "은행 ETF", "all_etf", 3),
    "091180": ("KODEX 자동차", "ETF", "자동차 ETF", "all_etf", 2),
    "244580": ("KODEX 바이오", "ETF", "바이오 ETF", "all_etf", 2),
    "360750": ("TIGER 미국S&P500", "ETF", "해외 ETF", "all_etf", 195),
    "133690": ("TIGER 미국나스닥100", "ETF", "해외 ETF", "all_etf", 10),
    "122630": ("KODEX 레버리지", "ETF", "레버리지 ETF", "all_etf", 4),
    "252670": ("KODEX 200선물인버스2X", "ETF", "인버스 ETF", "all_etf", 3),
}

THEMATIC_CODES = {
    "005930", "000660", "373220", "006400", "051910", "035420", "035720",
    "000270", "005380", "207940", "068270", "105560", "055550", "003670",
}

ETF_NAME_PREFIXES = ("KODEX", "TIGER", "ACE", "RISE", "KBSTAR", "SOL", "ARIRANG", "HANARO", "TIME", "PLUS", "KOSEF", "WOORI", "KIWOOM", "UNIS", "HI", "FOCUS", "KINDEX")
ETF_KEYWORDS = ("ETF", "ETN")

KR_SECTOR_OVERRIDES = {
    "005930": ("기술", "반도체"),
    "000660": ("기술", "반도체"),
    "009150": ("기술", "전자부품"),
    "005380": ("경기소비재", "자동차"),
    "000270": ("경기소비재", "자동차"),
    "012330": ("경기소비재", "자동차부품"),
    "018880": ("경기소비재", "자동차부품"),
    "373220": ("기술", "2차전지"),
    "006400": ("기술", "2차전지"),
    "051910": ("소재", "2차전지 소재"),
    "003670": ("소재", "2차전지 소재"),
    "096770": ("소재", "2차전지 소재"),
    "207940": ("헬스케어", "바이오"),
    "068270": ("헬스케어", "바이오"),
    "128940": ("헬스케어", "바이오"),
    "035420": ("커뮤니케이션", "인터넷"),
    "035720": ("커뮤니케이션", "인터넷"),
    "105560": ("금융", "은행"),
    "055550": ("금융", "은행"),
    "086790": ("금융", "은행"),
    "316140": ("금융", "은행"),
    "024110": ("금융", "은행"),
    "032830": ("금융", "보험"),
    "000810": ("금융", "보험"),
    "005830": ("금융", "보험"),
    "006800": ("금융", "증권"),
    "028260": ("산업재", "지주회사"),
    "034730": ("산업재", "지주회사"),
    "402340": ("산업재", "지주회사"),
    "329180": ("산업재", "조선"),
    "010140": ("산업재", "조선"),
    "042660": ("산업재", "조선"),
    "009540": ("산업재", "조선"),
    "010620": ("산업재", "조선"),
    "034020": ("산업재", "전력기기"),
    "267260": ("산업재", "전력기기"),
    "010120": ("산업재", "전력기기"),
    "064350": ("산업재", "기계"),
    "047810": ("산업재", "방산"),
    "012450": ("산업재", "방산"),
    "005490": ("소재", "철강"),
    "010130": ("소재", "비철금속"),
    "004020": ("소재", "철강"),
    "011780": ("소재", "화학"),
    "047050": ("소재", "상사"),
    "015760": ("유틸리티", "전력"),
    "017670": ("커뮤니케이션", "통신"),
    "030200": ("커뮤니케이션", "통신"),
    "032640": ("커뮤니케이션", "통신"),
    "090430": ("필수소비재", "화장품"),
    "051900": ("필수소비재", "생활소비재"),
    "033780": ("필수소비재", "담배"),
    "097950": ("필수소비재", "식품"),
    # 세부 분류 추가 (Overrides)
    "000150": ("산업재", "지주회사"), # 두산
    "011070": ("기술", "전자부품"), # LG이노텍
    "196170": ("헬스케어", "바이오"), # 알테오젠
    "267250": ("산업재", "지주회사"), # HD현대
    "003550": ("산업재", "지주회사"), # LG
    "307950": ("기술", "IT 서비스"), # 현대오토에버
    "018260": ("기술", "IT 서비스"), # 삼성에스디에스
    "086280": ("산업재", "물류/운송"), # 현대글로비스
    "278470": ("필수소비재", "화장품"), # 에이피알
    "006260": ("산업재", "지주회사"), # LS
    "259960": ("커뮤니케이션", "게임"), # 크래프톤
    "277810": ("기술", "로보틱스"), # 레인보우로보틱스
    "443060": ("산업재", "해운/서비스"), # HD현대마린솔루션
    "028050": ("산업재", "건설"), # 삼성E&A
    "950160": ("헬스케어", "바이오"), # 코오롱티슈진
    "352820": ("커뮤니케이션", "엔터테인먼트"), # 하이브
    "007660": ("기술", "전자부품"), # 이수페타시스
    "064400": ("기술", "IT 서비스"), # LG씨엔에스
    "180640": ("산업재", "항공/운송"), # 한진칼
    "000880": ("산업재", "지주회사"), # 한화
    "028300": ("헬스케어", "바이오"), # HLB
    "000990": ("기술", "반도체"), # DB하이텍
    "004170": ("경기소비재", "유통/레저"), # 신세계
    "454910": ("기술", "로보틱스"), # 두산로보틱스
    "078930": ("산업재", "지주회사"), # GS
    "021240": ("필수소비재", "생활소비재"), # 코웨이
    "034220": ("기술", "디스플레이"), # LG디스플레이
    "039030": ("기술", "반도체 장비"), # 이오테크닉스
    "241560": ("산업재", "기계"), # 두산밥캣
    "009830": ("소재", "화학"), # 한화솔루션
    "000100": ("헬스케어", "제약"), # 유한양행
    "011790": ("소재", "화학"), # SKC
    "036570": ("커뮤니케이션", "게임"), # 엔씨소프트
    "088980": ("금융", "기타금융"), # 맥쿼리인프라
    "087010": ("헬스케어", "바이오"), # 펩트론
    "319660": ("기술", "반도체 장비"), # 피에스케이
    "001040": ("산업재", "지주회사"), # CJ
    "222800": ("기술", "전자부품"), # 심텍
    "440110": ("기술", "반도체"), # 파두
    "082740": ("산업재", "기계"), # 한화엔진
    "002380": ("소재", "화학/건자재"), # KCC
    "088350": ("금융", "금융"), # 한화생명
    "001450": ("금융", "금융"), # 현대해상
    "085620": ("금융", "금융"), # 미래에셋생명
    "279570": ("금융", "금융"), # 케이뱅크
    "005850": ("경기소비재", "자동차부품"), # 에스엘
    "007340": ("경기소비재", "자동차부품"), # DN오토모티브
    "035250": ("경기소비재", "유통/레저"), # 강원랜드 (카지노/레저)
    "026960": ("필수소비재", "식품"), # 동서
}

KR_NAME_RULES = [
    (("배터리", "2차전지", "에너지솔루션", "SDI", "에코프로", "엘앤에프", "포스코퓨처엠", "코스모신소재", "대주전자재료", "천보"), ("기술", "2차전지")),
    (("로봇", "로보틱스", "로보"), ("기술", "로보틱스")),
    (("지주", "홀딩스"), ("산업재", "지주회사")),
]


def load_update_data():
    path = ROOT / "scripts" / "update_data.py"
    spec = importlib.util.spec_from_file_location("update_data", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


UD = load_update_data()


def request_html(url: str, encoding: str = "euc-kr") -> str:
    req = urllib.request.Request(url, headers=HTTP_HEADERS)
    raw = urllib.request.urlopen(req, timeout=20).read()
    for enc in (encoding, "utf-8", "cp949"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def strip_cell(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text or "")
    return re.sub(r"\s+", " ", text).strip()


def parse_change_pct(cell: str) -> float | None:
    m = re.search(r"([+-]?\d+(?:\.\d+)?)\s*%", cell)
    return float(m.group(1)) if m else None


def parse_number(cell: str) -> float | None:
    text = strip_cell(cell).replace(",", "").replace("%", "").strip()
    if not text or text in {"N/A", "-"}:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def yahoo_ticker(code: str, market: str) -> str:
    suffix = "KS" if market == "kospi" else "KQ"
    return f"{code}.{suffix}"


def is_etf_like_name(company: str, industry: str = "", sector: str = "") -> bool:
    text = f"{company or ''} {industry or ''} {sector or ''}".upper()
    return (
        text.startswith(ETF_NAME_PREFIXES)
        or any(f" {kw}" in f" {text}" for kw in ETF_KEYWORDS)
    )


def is_korean_preferred_stock(ticker: str, name: str) -> bool:
    if not ticker or len(ticker) != 6:
        return False
    if ticker.endswith("0"):
        return False
    n = name.strip()
    if n.endswith("우") or n.endswith("우선주"):
        return True
    if re.search(r"우[0-9A-Za-z가-힣]*$", n):
        return True
    return False


GLOBAL_NAVER_MAP = {}

NAVER_INDUSTRY_MAPPING = {
    "생물공학": ("헬스케어", "바이오"),
    "생명과학도구및서비스": ("헬스케어", "바이오/제약"),
    "제약": ("헬스케어", "제약"),
    "건강관리장비와용품": ("헬스케어", "의료기기"),
    "건강관리기술": ("헬스케어", "의료 IT"),
    "건강관리업체및서비스": ("헬스케어", "의료서비스"),
    
    "반도체와반도체장비": ("기술", "반도체"),
    "디스플레이장비및부품": ("기술", "디스플레이장비"),
    "디스플레이패널": ("기술", "디스플레이패널"),
    "소프트웨어": ("기술", "소프트웨어"),
    "IT서비스": ("기술", "IT 서비스"),
    "컴퓨터와주변기기": ("기술", "IT 장비"),
    "핸드셋": ("기술", "모바일 부품"),
    "통신장비": ("기술", "통신장비"),
    "전자제품": ("기술", "전자제품"),
    "전자장비와기기": ("기술", "전자장비"),
    "사무용전자제품": ("기술", "사무용기기"),
    
    "복합기업": ("산업재", "지주회사"),
    "기계": ("산업재", "기계"),
    "우주항공과국방": ("산업재", "방산/우주항공"),
    "조선": ("산업재", "조선"),
    "건설": ("산업재", "건설"),
    "전기제품": ("산업재", "전기제품"),
    "전기장비": ("산업재", "전기장비"),
    "상업서비스와공급품": ("산업재", "상업서비스"),
    "항공화물운송과물류": ("산업재", "물류"),
    "해운사": ("산업재", "해운"),
    "항공사": ("산업재", "항공"),
    "도로와철도운송": ("산업재", "육상운송"),
    "운송인프라": ("산업재", "운송인프라"),
    "무역회사와판매업체": ("산업재", "상사"),
    
    "생명보험": ("금융", "보험"),
    "손해보험": ("금융", "보험"),
    "은행": ("금융", "은행"),
    "증권": ("금융", "증권"),
    "카드": ("금융", "카드"),
    "기타금융": ("금융", "기타금융"),
    "창업투자": ("금융", "벤처캐피탈"),
    
    "자동차": ("경기소비재", "자동차"),
    "자동차부품": ("경기소비재", "자동차부품"),
    "가구": ("경기소비재", "가구"),
    "레저용장비와제품": ("경기소비재", "레저용품"),
    "백화점과일반상점": ("경기소비재", "유통"),
    "전문소매": ("경기소비재", "소매"),
    "판매업체": ("경기소비재", "유통"),
    "호텔,레스토랑,레저": ("경기소비재", "레저/관광"),
    "섬유,의류,신발,호화품": ("경기소비재", "의류/패션"),
    "다각화된소비자서비스": ("경기소비재", "소비자서비스"),
    
    "식품": ("필수소비재", "식품"),
    "음료": ("필수소비재", "음료"),
    "식품과기본식료품소매": ("필수소비재", "유통"),
    "가정용기기와용품": ("필수소비재", "가정용품"),
    "가정용품": ("필수소비재", "가정용품"),
    "화장품": ("필수소비재", "화장품"),
    "담배": ("필수소비재", "담배"),
    
    "화학": ("소재", "화학"),
    "철강": ("소재", "철강"),
    "비철금속": ("소재", "비철금속"),
    "에너지장비및서비스": ("소재", "에너지소재"),
    "건축제품": ("소재", "건축자재"),
    "건축자재": ("소재", "건축자재"),
    "종이와목재": ("소재", "제지/목재"),
    "포장재": ("소재", "포장재"),
    
    "게임엔터테인먼트": ("커뮤니케이션", "게임"),
    "방송과엔터테인먼트": ("커뮤니케이션", "엔터테인먼트"),
    "양방향미디어와서비스": ("커뮤니케이션", "인터넷서비스"),
    "인터넷과카탈로그소매": ("커뮤니케이션", "전자상거래"),
    "무선통신서비스": ("커뮤니케이션", "통신"),
    "다각화된통신서비스": ("커뮤니케이션", "통신"),
    "광고": ("커뮤니케이션", "광고"),
    "출판": ("커뮤니케이션", "미디어/출판"),
    
    "전기유틸리티": ("유틸리티", "전력"),
    "가스유틸리티": ("유틸리티", "가스"),
    "복합유틸리티": ("유틸리티", "유틸리티"),
    
    "부동산": ("부동산", "부동산"),
    "교육서비스": ("기타", "교육서비스"),
    "문구류": ("기타", "문구류"),
}


def fetch_naver_industry_map() -> dict[str, tuple[str, str]]:
    print("Fetching Naver Finance industry classifications...")
    url = "https://finance.naver.com/sise/sise_group.naver?type=upjong"
    try:
        html = request_html(url)
        links = re.findall(r'href="/sise/sise_group_detail\.naver\?[^"]*no=(\d+)"[^>]*>([^<]+)</a>', html)
        if not links:
            print("[warn] No Naver industries matched in list HTML.")
            return {}
        
        ticker_map = {}
        
        def fetch_one_detail(no, raw_name):
            name = raw_name.strip()
            detail_url = f"https://finance.naver.com/sise/sise_group_detail.naver?no={no}"
            try:
                html_d = request_html(detail_url)
                codes = re.findall(r'/item/main\.naver\?code=(\d+)"', html_d)
                ret = {}
                if name in NAVER_INDUSTRY_MAPPING:
                    sector, ind = NAVER_INDUSTRY_MAPPING[name]
                    for code in codes:
                        ret[code] = (sector, ind)
                return ret
            except Exception as e:
                print(f"[warn] Fetch detail failed for {name} (no={no}): {e}")
                return {}

        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = {pool.submit(fetch_one_detail, no, name): name for no, name in links}
            for fut in as_completed(futures):
                res = fut.result()
                ticker_map.update(res)
        print(f"Successfully mapped {len(ticker_map)} stocks from Naver Finance.")
        return ticker_map
    except Exception as e:
        print(f"[warn] Failed to fetch Naver industry list: {e}")
        return {}


def classify_kr_stock(code: str, company: str, sector: str = "", industry: str = "") -> tuple[str, str]:
    if code in KR_SECTOR_OVERRIDES:
        return KR_SECTOR_OVERRIDES[code]
    
    comp_upper = (company or "").upper()
    for needles, result in KR_NAME_RULES:
        if any(str(needle).upper() in comp_upper for needle in needles):
            return result
            
    if code in GLOBAL_NAVER_MAP:
        return GLOBAL_NAVER_MAP[code]
        
    current_sector = sector if sector and sector != "MISC" else ""
    current_industry = industry if industry and industry != "기타" else ""
    return current_sector or "기타", current_industry or "기타"


def cap_bucket_kr(cap_trillion: float, groups: set[str]) -> str:
    if "all_etf" in groups or "all_misc" in groups:
        return "all_misc"
    if cap_trillion >= 10:
        return "gte10t"
    if cap_trillion >= 1:
        return "gte1t"
    if cap_trillion >= 0.1:
        return "gte100b"
    return "lt100b"


def fetch_market_page(sosok: int, page: int) -> list[dict]:
    """sosok: 0=KOSPI, 1=KOSDAQ"""
    market = "kospi" if sosok == 0 else "kosdaq"
    url = (
        "https://finance.naver.com/sise/sise_market_sum.naver?"
        f"sosok={sosok}&page={page}"
        "&fieldIds=market_sum&fieldIds=amount&fieldIds=volume"
    )
    html = request_html(url)
    rows = re.findall(
        r'<td class="no">\d+</td>.*?/item/board\.naver\?code=\d+.*?</tr>',
        html,
        re.DOTALL,
    )
    out = []
    for row in rows:
        code_m = re.search(r'/item/main\.naver\?code=(\d+)"[^>]*>([^<]+)</a>', row)
        if not code_m:
            continue
        code, company = code_m.group(1), strip_cell(code_m.group(2))
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.DOTALL)
        if len(cells) < 7:
            continue
        price = parse_number(cells[2])
        change_pct = parse_change_pct(cells[4])
        # Naver market-sum table order is:
        # 현재가, 전일비, 등락률, 액면가, 시가총액, 상장주식수, ...
        # Keep 시가총액 at cells[6]; cells[7] is listed shares and must not drive heatmap area.
        cap_eok = parse_number(cells[6]) if len(cells) > 6 else None
        volume = parse_number(cells[9]) if len(cells) > 9 else None
        amount = parse_number(cells[10]) if len(cells) > 10 else None
        if price is None:
            continue
        cap_trillion = (cap_eok or 0) / 10000.0  # 억원 → 조원
        is_etf_like = is_etf_like_name(company)
        groups = {"all_etf", "all_misc"} if is_etf_like else {f"idx_{market}", "all_kr"}
        sector, industry = ("ETF", "ETF/ETN") if is_etf_like else classify_kr_stock(code, company)
        out.append({
            "symbol": code,
            "company": company,
            "market": "etf" if is_etf_like else market,
            "yahooSymbol": yahoo_ticker(code, market),
            "quotePrice": price,
            "quoteChangePct": change_pct if change_pct is not None else 0.0,
            "quoteVolume": volume,
            "quoteAmount": amount,
            "marketCapT": cap_trillion,
            "marketCapB": cap_trillion,  # 조원 단위 (한국 모드 전용)
            "sector": sector,
            "industry": industry,
            "groups": groups,
        })
    return out


def fetch_all_listed(limit: int | None = None) -> list[dict]:
    global GLOBAL_NAVER_MAP
    GLOBAL_NAVER_MAP = fetch_naver_industry_map()
    universe: dict[str, dict] = {}
    for sosok in (0, 1):
        for page in range(1, 60):
            try:
                rows = fetch_market_page(sosok, page)
            except Exception as exc:
                print(f"[warn] Naver page sosok={sosok} page={page}: {exc}")
                break
            if not rows:
                break
            for row in rows:
                if is_korean_preferred_stock(row["symbol"], row["company"]):
                    continue
                universe[row["symbol"]] = row
            if limit and len(universe) >= limit:
                break
        if limit and len(universe) >= limit:
            break

    metas = sorted(universe.values(), key=lambda m: m.get("marketCapT") or 0, reverse=True)
    if limit:
        metas = metas[:limit]

    # Index membership = top-N by market cap WITHIN each market, not across the
    # combined list. metas is already sorted by marketCapT desc, so filtering by
    # market preserves the per-market rank order.
    kospi_sorted = [m for m in metas if m["market"] == "kospi"]
    for meta in kospi_sorted[:200]:
        meta["groups"].add("idx_kospi200")

    kosdaq_sorted = [m for m in metas if m["market"] == "kosdaq"]
    for meta in kosdaq_sorted[:150]:
        meta["groups"].add("idx_kosdaq150")

    for meta in metas:
        if meta["symbol"] in THEMATIC_CODES:
            meta["groups"].add("thematic")

    for code, (company, sector, industry, bucket, cap) in KR_ETFS.items():
        universe[code] = {
            "symbol": code,
            "company": company,
            "market": "etf",
            "yahooSymbol": yahoo_ticker(code, "kospi"),
            "quotePrice": None,
            "quoteChangePct": 0.0,
            "quoteVolume": 0,
            "marketCapT": cap / 10.0,
            "marketCapB": cap / 10.0,
            "sector": sector,
            "industry": industry,
            "groups": {"all_etf", "all_misc", bucket},
        }

    return list(universe.values())


def enrich_sector(meta: dict) -> None:
    if meta.get("sector") not in {None, "", "MISC"}:
        return
    try:
        info = __import__("yfinance").Ticker(meta["yahooSymbol"]).info or {}
        sector = SECTOR_MAP.get(info.get("sector") or "", info.get("sector") or "기타")
        industry = info.get("industry") or info.get("longName") or meta["company"]
        meta["sector"] = sector or "기타"
        meta["industry"] = industry
    except Exception:
        meta["sector"] = meta.get("sector") or "기타"
    if meta.get("market") != "etf":
        meta["sector"], meta["industry"] = classify_kr_stock(
            meta.get("symbol") or "",
            meta.get("company") or "",
            meta.get("sector") or "",
            meta.get("industry") or "",
        )


def yahoo_quote_symbol(yahoo_symbol: str) -> str:
    # Korean tickers must keep the dot (005930.KS). US tickers use BRK.B → BRK-B.
    if ".KS" in yahoo_symbol.upper() or ".KQ" in yahoo_symbol.upper():
        return yahoo_symbol
    return UD.yahoo_symbol(yahoo_symbol)


def fetch_yahoo_history_kr(yahoo_symbol: str):
    url = (
        "https://query1.finance.yahoo.com/v8/finance/chart/"
        f"{urllib.parse.quote(yahoo_quote_symbol(yahoo_symbol))}?range=5y&interval=1d"
    )
    payload = UD.request_json(url, timeout=12)
    result = payload["chart"]["result"][0]
    quote = result["indicators"]["quote"][0]
    opens = quote.get("open", [])
    highs = quote.get("high", [])
    lows = quote.get("low", [])
    closes = quote["close"]
    volumes = quote["volume"]
    timestamps = result.get("timestamp", [])
    rows = []
    for timestamp, open_value, high, low, close, volume in zip(
        timestamps, opens, highs, lows, closes, volumes
    ):
        if close is not None:
            close = float(close)
            rows.append({
                "date": datetime.fromtimestamp(timestamp, tz=ZoneInfo("UTC")).date().isoformat(),
                "open": float(open_value if open_value is not None else close),
                "high": float(high if high is not None else close),
                "low": float(low if low is not None else close),
                "close": close,
                "volume": float(volume or 0),
            })
    if len(rows) < 30:
        raise RuntimeError(f"Not enough rows for {yahoo_symbol}")
    return rows[-1260:]


def history_priority(meta):
    score = (meta.get("marketCapT") or 0) * 1000
    if "idx_kospi200" in meta.get("groups", set()):
        score += 5000
    if "idx_kosdaq150" in meta.get("groups", set()):
        score += 3000
    if "all_etf" in meta.get("groups", set()):
        score += 2000
    if meta.get("symbol") in THEMATIC_CODES:
        score += 1500
    return score


# Global throttle for Naver API calls. Sustained high concurrency makes Naver
# block the IP for a while (most financials then come back empty), so cap the
# aggregate request rate regardless of worker count.
_naver_lock = threading.Lock()
_naver_next = [0.0]
_NAVER_MIN_INTERVAL = 0.10  # ~10 requests/sec across all threads


def _naver_throttle():
    with _naver_lock:
        now = time.monotonic()
        wait = _naver_next[0] - now
        if wait > 0:
            time.sleep(wait)
            now = time.monotonic()
        _naver_next[0] = now + _NAVER_MIN_INTERVAL


def _fnum(v):
    if v is None or v in ("-", ""):
        return None
    try:
        return float(str(v).replace(",", "").replace("%", ""))
    except (TypeError, ValueError):
        return None


def fetch_naver_fundamentals(code: str, price=None) -> dict:
    """Financial statements + ratios from Naver's mobile finance API.

    Naver covers every listed Korean stock (Yahoo's .KS fundamentals are sparse for
    mid/small caps like 무학). Mapped to the same schema the US pipeline produces so
    the fundamentals panel renders identically. Monetary fields use the billions-of-
    KRW convention (억 ÷ 10) to match Yahoo's salesB/incomeB scale.
    """
    url = f"https://m.stock.naver.com/api/stock/{code}/finance/annual"
    req = urllib.request.Request(url, headers={**HTTP_HEADERS, "Referer": "https://m.stock.naver.com/"})
    info = None
    for attempt in range(5):  # Naver rate-limits bursts; throttle + retry with backoff.
        try:
            _naver_throttle()
            payload = json.loads(urllib.request.urlopen(req, timeout=12).read().decode("utf-8", "replace"))
            info = payload["financeInfo"]
            break
        except Exception:
            if attempt == 4:
                return {}
            time.sleep(0.6 * (attempt + 1))
    if not info:
        return {}
    titles = info["trTitleList"]
    rows = info["rowList"]
    actual = [t["key"] for t in titles if t.get("isConsensus") == "N"]
    forward = [t["key"] for t in titles if t.get("isConsensus") == "Y"]
    if not actual:
        return {}
    cur = actual[-1]
    fwd = forward[-1] if forward else None

    def val(title, key):
        for r in rows:
            if r.get("title") == title:
                col = (r.get("columns") or {}).get(key) or {}
                return _fnum(col.get("value"))
        return None

    sales = val("매출액", cur)
    income = val("당기순이익", cur)
    if income is None:
        income = val("지배주주순이익", cur)
    f = {"source": "naver"}
    if sales is not None:
        f["salesB"] = round(sales / 10, 3)        # 억 → billions KRW
    if income is not None:
        f["incomeB"] = round(income / 10, 3)
    if val("영업이익률", cur) is not None:
        f["operMargin"] = val("영업이익률", cur)
    if val("순이익률", cur) is not None:
        f["profitMargin"] = val("순이익률", cur)
    if val("ROE", cur) is not None:
        f["roe"] = val("ROE", cur)
    if val("부채비율", cur) is not None:
        f["debtEq"] = round(val("부채비율", cur) / 100, 2)
    if val("당좌비율", cur) is not None:
        f["quickRatio"] = round(val("당좌비율", cur) / 100, 2)
    if val("PER", cur) is not None:
        f["pe"] = val("PER", cur)
    if val("PBR", cur) is not None:
        f["pb"] = f["pbr"] = val("PBR", cur)
    if val("EPS", cur) is not None:
        f["eps"] = f["epsTtm"] = val("EPS", cur)
    if val("BPS", cur) is not None:
        f["bps"] = val("BPS", cur)
    if fwd:
        if val("PER", fwd) is not None:
            f["forwardPE"] = val("PER", fwd)
        if val("EPS", fwd) is not None:
            f["epsNextY"] = val("EPS", fwd)
    div = val("주당배당금", cur)
    if div is not None and price:
        f["divYield"] = round(div / float(price) * 100, 2)
    return f


def fetch_naver_news(code: str, limit: int = 8) -> list[dict]:
    """Korean-language headlines for a stock from Naver's mobile stock API.

    Returns {title, publisher, link, publishedAt}. Far richer and in Korean
    compared to Yahoo's search API for .KS/.KQ tickers. One representative
    article per news cluster keeps the headlines diverse. Failures → [].
    """
    code = str(code or "").replace(".KS", "").replace(".KQ", "")
    url = f"https://m.stock.naver.com/api/news/stock/{code}?pageSize={limit}&page=1"
    req = urllib.request.Request(url, headers={**HTTP_HEADERS, "Referer": "https://m.stock.naver.com/"})
    try:
        _naver_throttle()
        raw = urllib.request.urlopen(req, timeout=12).read()
        clusters = json.loads(raw.decode("utf-8", "replace"))
    except Exception:
        return []
    items: list[dict] = []
    seen: set[str] = set()
    for cluster in clusters if isinstance(clusters, list) else []:
        for entry in (cluster.get("items") or []):
            title = html.unescape(strip_cell(entry.get("titleFull") or entry.get("title") or ""))
            link = str(entry.get("mobileNewsUrl") or "").strip()
            if not title or not link or title in seen:
                continue
            seen.add(title)
            dt = str(entry.get("datetime") or "")
            published_at = f"{dt[0:4]}-{dt[4:6]}-{dt[6:8]}" if len(dt) >= 8 else ""
            items.append({
                "title": title,
                "publisher": html.unescape(str(entry.get("officeName") or "").strip()),
                "link": link,
                "publishedAt": published_at,
            })
            break  # one representative article per cluster
        if len(items) >= limit:
            break
    return items


def build_one(meta: dict):
    symbol = meta["symbol"]
    ysym = meta["yahooSymbol"]
    error = None
    try:
        if meta.get("preferHistory"):
            rows = fetch_yahoo_history_kr(ysym)
            meta["historySource"] = "yahoo"
        else:
            rows = UD.synthetic_history(
                symbol,
                meta.get("quotePrice"),
                meta.get("quoteChangePct"),
                meta.get("quoteVolume"),
            )
            meta["historySource"] = "snapshot"
    except Exception as exc:
        rows = UD.synthetic_history(
            symbol,
            meta.get("quotePrice"),
            meta.get("quoteChangePct"),
            meta.get("quoteVolume"),
        )
        meta["historySource"] = "snapshot"
        error = f"{symbol}: {exc}"

    if meta.get("preferFundamentals"):
        # Naver covers every listed Korean stock; Yahoo's .KS fundamentals are sparse
        # for mid/small caps (e.g. 무학). Use Naver as the primary source.
        price_hint = meta.get("quotePrice") or (rows[-1]["close"] if rows else None)
        try:
            meta["fundamentals"] = fetch_naver_fundamentals(symbol, price_hint)
        except Exception as exc:
            meta["fundamentals"] = {}
            error = f"{error}; fundamentals {symbol}: {exc}" if error else f"fundamentals {symbol}: {exc}"

    if meta.get("preferHistory"):
        # Korean stocks: prefer Naver (Korean) headlines, fall back to Yahoo.
        # Limited to top names (preferHistory) to keep total Naver request rate sane.
        news = fetch_naver_news(symbol) or UD.fetch_news(yahoo_quote_symbol(ysym))
        if news:
            meta["news"] = news

    stock = UD.make_stock(meta, rows)
    stock["ticker"] = symbol
    stock["market"] = meta.get("market")
    stock["yahooSymbol"] = ysym
    stock["bucket"] = cap_bucket_kr(meta.get("marketCapT") or 0, set(meta.get("groups") or []))
    stock["marketCapT"] = round(meta.get("marketCapT") or 0, 3)
    stock["marketCapB"] = stock["marketCapT"]
    stock["currency"] = "KRW"
    if stock.get("market") != "etf":
        stock["sector"], stock["industry"] = classify_kr_stock(
            stock.get("ticker") or "",
            stock.get("company") or "",
            stock.get("sector") or "",
            stock.get("industry") or "",
        )
    return stock, error


# ===================== Korean ETF analytics (상대강도 / 레버리지) =====================
# Benchmarks for ETF relative-strength (KODEX 200 / KODEX 코스닥150 / TIGER 200).
KR_ETF_RS_BENCHMARKS = ["069500", "229200", "102110"]
# Names we never want inside an equity-sector representative group.
KR_ETF_THEME_EXCLUDE = [
    "인버스", "레버리지", "2X", "선물", "채권", "채액티브", "은행채", "국고", "단기", "금리",
    "TR", "달러", "미국", "나스닥", "S&P", "차이나", "중국", "일본", "인도", "베트남",
    "유럽", "글로벌", "선진", "신흥", "리츠", "금현물", "골드", "커버드콜",
]
# Each theme: (group, category, [name keywords], pinned_representative_or_None).
# A pinned code forces the "정통" product as representative instead of the
# largest-cap keyword match (which can be a covered-call / dividend hybrid).
KR_ETF_THEME_DEFS = [
    ("대표지수", "코스피200", ["코스피200", "KODEX 200", "TIGER 200", " 200"], "069500"),
    ("대표지수", "코스닥150", ["코스닥150"], None),
    ("기술", "반도체", ["반도체"], None),
    ("기술", "2차전지", ["2차전지", "배터리"], None),
    ("기술", "인터넷/SW", ["인터넷", "소프트웨어"], None),
    ("커뮤니케이션", "게임", ["게임"], None),
    ("커뮤니케이션", "미디어/엔터", ["미디어", "엔터", "콘텐츠", "K-팝", "케이팝"], None),
    ("경기소비재", "자동차", ["자동차"], None),
    ("금융", "은행", ["은행"], "091170"),          # KODEX 은행 (정통 은행 섹터)
    ("금융", "증권", ["증권"], None),
    ("헬스케어", "바이오/헬스케어", ["바이오", "헬스케어", "제약"], "244580"),  # KODEX 바이오 (정통 인덱스)
    ("산업재", "조선/중공업", ["조선", "중공업"], None),
    ("산업재", "방산/우주", ["방산", "우주"], None),
    ("산업재", "건설", ["건설"], "117700"),         # KODEX 건설 ('인프라'는 통신/전력 인프라라 제외)
    ("산업재", "전력/AI인프라", ["전력", "AI인프라"], None),
    ("산업재", "로봇", ["로봇", "로보틱스"], None),
    ("산업재", "운송/물류", ["운송", "물류"], None),
    ("산업재", "기계", ["기계장비", "기계"], None),
    ("소재", "철강/화학", ["철강", "화학"], "117680"),  # KODEX 철강 ('소재'는 2차전지소재와 중복돼 제외)
    ("에너지", "원자력", ["원자력", "원전"], None),
    ("에너지", "신재생에너지", ["태양광", "풍력", "신재생"], None),
    ("부동산", "리츠", ["리츠"], None),
    ("필수소비재", "화장품/뷰티", ["화장품", "뷰티", "미용"], None),
    ("경기소비재", "소비재", ["경기소비재", "필수소비재"], None),
    ("경기소비재", "여행/레저", ["여행", "레저"], None),
    ("전략", "고배당", ["고배당"], "161510"),        # PLUS 고배당주 (정통 고배당)
    ("전략", "배당성장", ["배당성장", "배당다우"], None),
]


def fetch_kr_etf_universe() -> list[dict]:
    """All listed Korean ETFs from Naver (code, name, price, daily change, cap)."""
    url = "https://finance.naver.com/api/sise/etfItemList.nhn"
    try:
        req = urllib.request.Request(url, headers={**HTTP_HEADERS, "Referer": "https://finance.naver.com/sise/etf.naver"})
        raw = urllib.request.urlopen(req, timeout=15).read()
        payload = json.loads(raw.decode("cp949", "replace"))
        items = payload.get("result", {}).get("etfItemList", [])
    except Exception as exc:
        print(f"[warn] Naver ETF list: {exc}")
        return []
    out = []
    for e in items:
        code = str(e.get("itemcode") or "").strip()
        name = str(e.get("itemname") or "").strip()
        if not code or not name:
            continue
        out.append({
            "code": code,
            "name": name,
            "price": _num(e.get("nowVal")),
            "changePct": _num(e.get("changeRate")),
            "volume": _num(e.get("quant")),
            "capEok": _num(e.get("marketSum")) or 0,  # 억원
        })
    return out


def _num(v):
    try:
        return float(str(v).replace(",", ""))
    except (TypeError, ValueError):
        return None


def _etf_theme_match(name: str, includes: list[str]) -> bool:
    # A keyword in this theme's own includes is never treated as an exclude (so the
    # 리츠 theme can match 리츠 ETFs even though 리츠 is globally excluded elsewhere).
    excludes = [x for x in KR_ETF_THEME_EXCLUDE if x not in includes]
    return any(k in name for k in includes) and not any(x in name for x in excludes)


def is_kr_leveraged_name(name: str) -> bool:
    return ("레버리지" in name) or ("인버스" in name) or bool(re.search(r"[23]X", name))


def classify_kr_leveraged(name: str) -> dict:
    is_inverse = "인버스" in name
    kind = "inverse" if is_inverse else "leveraged"
    if re.search(r"2X|2배", name):
        leverage = "2x"
    elif re.search(r"3X|3배", name):
        leverage = "3x"
    elif is_inverse:
        leverage = "1x"  # plain 인버스 tracks -1x
    else:
        leverage = "2x"  # Korean 레버리지 products are 2x by default
    if "단일종목" in name or "단일" in name:
        scope = "single-stock"
    elif any(k in name for k in ["반도체", "2차전지", "바이오", "은행", "자동차", "헬스", "게임", "방산", "조선"]):
        scope = "sector"
    elif any(k in name for k in ["미국", "나스닥", "S&P", "차이나", "중국", "일본", "인도", "유럽", "글로벌", "베트남", "달러"]):
        scope = "international"
    elif any(k in name for k in ["원유", "금", "은", "구리", "천연가스", "농산물", "원자재"]):
        scope = "commodity"
    else:
        scope = "index"
    issuer = name.split(" ")[0] if " " in name else "—"
    return {
        "type": kind,
        "leverage": leverage,
        "direction": "short" if is_inverse else "long",
        "scope": scope,
        "issuer": issuer,
    }


def fetch_one_etf_stock(info: dict) -> dict | None:
    code = info["code"]
    ysym = f"{code}.KS"
    meta = {
        "symbol": code,
        "company": info["name"],
        "industry": "ETF",
        "sector": "EXCHANGE TRADED FUNDS",
        "groups": {"all_etf", "all_misc"},
        "quotePrice": info.get("price"),
        "quoteChangePct": info.get("changePct"),
        "quoteVolume": info.get("volume"),
        "marketCapB": (info.get("capEok") or 0) / 10000.0,  # 억원 → 조원
        "preferHistory": True,
    }
    try:
        rows = fetch_yahoo_history_kr(ysym)
    except Exception:
        return None
    stock = UD.make_stock(meta, rows)
    stock["ticker"] = code
    stock["market"] = "etf"
    stock["yahooSymbol"] = ysym
    stock["currency"] = "KRW"
    stock["marketCapT"] = round((info.get("capEok") or 0) / 10000.0, 3)
    stock["marketCapB"] = stock["marketCapT"]
    return stock


def minimal_naver_etf_row(info: dict) -> dict | None:
    """Lightweight ETF row from Naver quote only (no Yahoo history). Used for newer
    leveraged products Yahoo has no .KS series for, so the card still shows a price
    and today's change instead of all dashes. monthChangePct is intentionally absent."""
    if info.get("price") is None:
        return None
    cap_t = round((info.get("capEok") or 0) / 10000.0, 3)
    return {
        "ticker": info["code"], "company": info["name"], "industry": "ETF",
        "sector": "EXCHANGE TRADED FUNDS", "market": "etf", "currency": "KRW",
        "yahooSymbol": f"{info['code']}.KS",
        "price": round(info["price"], 2),
        "changePct": round(info.get("changePct") or 0, 1),
        "marketCapT": cap_t, "marketCapB": cap_t,
        "groups": ["all_etf", "all_misc"], "bucket": "all_misc",
        "rsScore": 50, "historySource": "naver",
    }


def build_kr_etf_section() -> tuple[dict, list[dict], dict]:
    """Returns (etfRelative payload, leveraged ETF stock rows, leveraged catalog)."""
    universe = fetch_kr_etf_universe()
    if not universe:
        return {"rows": [], "universeCount": 0, "benchmarks": [], "method": "no_etf_universe"}, [], {"items": [], "updated": ""}
    print(f"Fetching Korean ETF universe... {len(universe)} ETFs")
    by_code = {e["code"]: e for e in universe}

    # Build representative + peer groups per theme (largest cap first).
    category_map = []
    needed: set[str] = set(KR_ETF_RS_BENCHMARKS)
    for group, category, includes, pinned in KR_ETF_THEME_DEFS:
        matches = sorted(
            (e for e in universe if _etf_theme_match(e["name"], includes)),
            key=lambda e: e.get("capEok") or 0, reverse=True,
        )
        peers = [e["code"] for e in matches[:8]]
        # Pin the "정통" representative when specified; keep it first in the peer list.
        if pinned and pinned in by_code:
            peers = [pinned] + [c for c in peers if c != pinned]
            peers = peers[:8]
        representative = pinned if (pinned and pinned in by_code) else (peers[0] if peers else None)
        if not representative:
            continue
        category_map.append({"group": group, "category": category, "representative": representative, "peers": peers})
        needed.update(peers)
        needed.add(representative)

    leveraged = sorted(
        (e for e in universe if is_kr_leveraged_name(e["name"])),
        key=lambda e: e.get("capEok") or 0, reverse=True,
    )[:40]
    needed.update(e["code"] for e in leveraged)

    # Fetch history + returns for every ETF we will display.
    lookup: dict[str, dict] = {}
    with ThreadPoolExecutor(max_workers=16) as pool:
        futures = {pool.submit(fetch_one_etf_stock, by_code[c]): c for c in needed if c in by_code}
        for fut in as_completed(futures):
            stock = fut.result()
            if stock:
                lookup[stock["ticker"]] = stock
    print(f"  ETF returns computed for {len(lookup)}/{len(needed)} ETFs")

    period_keys = ["monthChangePct", "threeMonthChangePct", "ytdChangePct", "changePct"]
    benchmarks = {t: lookup[t] for t in KR_ETF_RS_BENCHMARKS if t in lookup}
    rows = []
    for cat in category_map:
        rep = lookup.get(cat["representative"])
        if not rep:
            # fall back to the largest peer that did resolve
            rep = next((lookup[p] for p in cat["peers"] if p in lookup), None)
            if not rep:
                continue
        peers = [{
            "ticker": p, "name": lookup[p]["company"],
            "monthChangePct": lookup[p].get("monthChangePct", 0),
            "threeMonthChangePct": lookup[p].get("threeMonthChangePct", 0),
            "ytdChangePct": lookup[p].get("ytdChangePct", 0),
            "changePct": lookup[p].get("changePct", 0),
        } for p in cat["peers"] if p in lookup]
        relative = {
            b: {k: round(rep.get(k, 0) - bi.get(k, 0), 1) for k in period_keys}
            for b, bi in benchmarks.items()
        }
        primary = KR_ETF_RS_BENCHMARKS[0]
        secondary = KR_ETF_RS_BENCHMARKS[1]
        # Weighted relative-strength vs the benchmarks. Kept unclamped here and
        # percentile-ranked across themes below.
        raw_strength = (
            relative.get(primary, {}).get("monthChangePct", 0) * 2.2
            + relative.get(primary, {}).get("threeMonthChangePct", 0) * 1.1
            + relative.get(secondary, {}).get("monthChangePct", 0) * 1.4
        )
        rows.append({
            "group": cat["group"], "category": cat["category"],
            "representative": rep["ticker"], "name": rep["company"],
            "price": rep.get("price", 0), "changePct": rep.get("changePct", 0),
            "monthChangePct": rep.get("monthChangePct", 0),
            "threeMonthChangePct": rep.get("threeMonthChangePct", 0),
            "ytdChangePct": rep.get("ytdChangePct", 0),
            "rsScore": 50, "rawStrength": round(raw_strength, 2), "relative": relative,
            "peers": sorted(peers, key=lambda x: x.get("monthChangePct", 0), reverse=True)[:10],
        })

    # Cross-sectional percentile RS (강한 섹터 ~99, 약한 섹터 ~1). When the broad
    # market trails a mega-cap-driven benchmark, an absolute RS would clamp every
    # sector to 0; a rank keeps sectors distinguishable. Ties share the average rank.
    n = len(rows)
    if n > 1:
        order = sorted(range(n), key=lambda i: rows[i]["rawStrength"])
        i = 0
        while i < n:
            j = i
            while j + 1 < n and rows[order[j + 1]]["rawStrength"] == rows[order[i]]["rawStrength"]:
                j += 1
            avg_rank = (i + j) / 2
            score = round(1 + 98 * avg_rank / (n - 1))
            for k in range(i, j + 1):
                rows[order[k]]["rsScore"] = score
            i = j + 1
    for r in rows:
        r.pop("rawStrength", None)

    rows.sort(key=lambda r: r["relative"].get(KR_ETF_RS_BENCHMARKS[0], {}).get("monthChangePct", 0), reverse=True)

    etf_relative = {
        "rows": rows,
        "universeCount": len(universe),
        "benchmarks": list(benchmarks.keys()),
        "method": "네이버 ETF 목록을 이름 기준으로 테마/섹터 그룹화하고, 각 그룹 대표 ETF의 수익률에서 벤치마크(코스피200·코스닥150) 수익률을 뺀 값이 상대강도입니다. 레버리지·인버스·채권·해외 ETF는 대표 그룹에서 제외됩니다.",
    }

    # Leveraged / inverse catalog + their live stock rows.
    lev_stocks = []
    lev_items = []
    for e in leveraged:
        meta = classify_kr_leveraged(e["name"])
        lev_items.append({
            "ticker": e["code"], "name": e["name"],
            "underlying": "—", "underlyingLabel": meta["scope"],
            "group": "한국 레버리지·인버스", **meta,
        })
        st = lookup.get(e["code"]) or minimal_naver_etf_row(e)
        if st:
            lev_stocks.append(st)
    lev_catalog = {
        "items": lev_items,
        "updated": datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y-%m-%d"),
    }
    return etf_relative, lev_stocks, lev_catalog


def build_summary(stocks: list[dict]) -> dict:
    stock_rows = [s for s in stocks if s.get("sector") != "ETF"]
    sector_scores: dict[str, list[float]] = {}
    for item in stock_rows:
        sector_scores.setdefault(item["sector"], []).append(item["changePct"])
    ranked = sorted(
        ((sector, sum(vals) / len(vals)) for sector, vals in sector_scores.items()),
        key=lambda x: x[1],
        reverse=True,
    )
    growth = {"005930", "000660", "373220", "035420", "035720", "068270"}
    growth_up = sum(1 for s in stocks if s["ticker"] in growth and s["monthChangePct"] > 0)
    return {
        "marketTone": "성장주 우세" if ranked and ranked[0][0] in {"기술", "헬스케어"} else "혼조",
        "strongSector": ranked[0][0] if ranked else "N/A",
        "weakSector": ranked[-1][0] if ranked else "N/A",
        "aiBreadth": f"핵심 성장주 {len(growth)}개 중 {growth_up}개 단기 상승",
    }


# ETFs needed by the 섹터 차트 비교 page (KR sector ETFs + benchmark). Keyed in the
# snapshot by their plain code (069500), fetched from Yahoo with the .KS suffix.
SECTOR_CHART_ETFS = ["069500", "102110", "091160", "091170", "091180", "305720", "244580"]
SECTOR_CHART_TIMEFRAMES = [
    {"name": "1D", "range": "1d", "interval": "5m"},
    {"name": "1W", "range": "5d", "interval": "30m"},
    {"name": "1M", "range": "1mo", "interval": "1h"},
    {"name": "3M", "range": "3mo", "interval": "1d"},
]


def fetch_one_sector_chart(code: str) -> dict:
    out: dict[str, list] = {}
    ysym = f"{code}.KS"
    for tf in SECTOR_CHART_TIMEFRAMES:
        url = (
            "https://query1.finance.yahoo.com/v8/finance/chart/"
            f"{ysym}?range={tf['range']}&interval={tf['interval']}"
        )
        try:
            payload = UD.request_json(url, timeout=12)
            res = payload["chart"]["result"][0]
            timestamps = res.get("timestamp", [])
            closes = res["indicators"]["quote"][0].get("close", [])
            points = [
                {"t": t, "c": round(float(c), 2)}
                for t, c in zip(timestamps, closes)
                if c is not None
            ]
            if points:
                out[tf["name"]] = points
        except Exception as exc:
            print(f"[warn] sector chart {code} {tf['name']}: {exc}")
    return out


def fetch_sector_charts() -> dict:
    """Intraday/period close series for the KR sector ETFs, matching the US
    snapshot's `sector_charts` shape so the 섹터 차트 비교 page renders."""
    print("Fetching Korean sector ETF charts...")
    charts: dict[str, dict] = {}
    with ThreadPoolExecutor(max_workers=7) as pool:
        futures = {pool.submit(fetch_one_sector_chart, code): code for code in SECTOR_CHART_ETFS}
        for fut in as_completed(futures):
            code = futures[fut]
            data = fut.result()
            if data:
                charts[code] = data
    print(f"  sector charts collected for {len(charts)}/{len(SECTOR_CHART_ETFS)} ETFs")
    return charts


def build_snapshot(limit: int | None = None) -> dict:
    metas = fetch_all_listed(limit=limit)
    metas.sort(key=history_priority, reverse=True)
    real_symbols = {m["symbol"] for m in metas[:MAX_REAL_HISTORY]}
    # Fundamentals are selected by market cap (not history_priority): index-membership
    # bonuses would otherwise push mid-caps like 무학(시총 ~805위) far down the ranking
    # and out of coverage. Naver covers every stock, so go purely by size.
    cap_ranked = sorted(metas, key=lambda m: m.get("marketCapT") or 0, reverse=True)
    fund_symbols = {m["symbol"] for m in cap_ranked[:MAX_FUNDAMENTALS]}

    for meta in metas:
        groups = set(meta.get("groups") or [])
        meta["preferHistory"] = (
            meta["symbol"] in real_symbols
            or "all_etf" in groups
            or meta["symbol"] in THEMATIC_CODES
        )
        meta["preferFundamentals"] = (
            meta["symbol"] in fund_symbols
            and "all_etf" not in groups
            and meta.get("sector") != "ETF"
        )
        if meta.get("sector") == "MISC" and meta["symbol"] in fund_symbols:
            enrich_sector(meta)

    stocks = []
    errors = []
    # 10 workers (not 16): wide Naver fundamentals coverage triggers rate limits at
    # higher concurrency, dropping most financials. 10 keeps coverage high.
    with ThreadPoolExecutor(max_workers=10) as pool:
        futures = [pool.submit(build_one, meta) for meta in metas]
        for fut in as_completed(futures):
            stock, err = fut.result()
            stocks.append(stock)
            if err:
                errors.append(err)

    # Korean ETF relative-strength + leveraged catalog (ETF RS / RRG / 레버리지 pages).
    etf_relative, lev_stocks, lev_catalog = build_kr_etf_section()
    existing_tickers = {s["ticker"] for s in stocks}
    for st in lev_stocks:
        if st["ticker"] not in existing_tickers:
            stocks.append(st)
            existing_tickers.add(st["ticker"])

    stocks.sort(key=lambda s: s.get("marketCapT") or 0, reverse=True)
    lookup = {s["ticker"]: s for s in stocks}

    def chg(ticker: str, key: str = "monthChangePct"):
        return lookup.get(ticker, {}).get(key, 0)

    group_counts: dict[str, int] = {}
    for item in stocks:
        for g in item.get("groups", []):
            group_counts[g] = group_counts.get(g, 0) + 1

    kospi = [s for s in stocks if s.get("market") == "kospi"]
    kosdaq = [s for s in stocks if s.get("market") == "kosdaq"]
    sector_charts = fetch_sector_charts()

    return {
        "market": "kr",
        "sector_charts": sector_charts,
        "updatedAtKst": datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y-%m-%d %H:%M KST"),
        "policy": "Daily snapshot. Korean equities from Naver Finance + Yahoo Finance.",
        "summary": build_summary(stocks),
        "stocks": stocks,
        "health": {
            "major": [
                UD.health("069500", "KODEX 200", chg("069500"), "코스피 대형주"),
                UD.health("102110", "TIGER 200", chg("102110"), "코스피 추종"),
                UD.health("091160", "KODEX 반도체", chg("091160"), "반도체 섹터"),
                UD.health("360750", "TIGER 미국S&P500", chg("360750"), "해외 분산"),
                UD.health("122630", "KODEX 레버리지", chg("122630"), "레버리지"),
                UD.health("252670", "KODEX 인버스2X", chg("252670"), "하락 베팅"),
            ],
            "etf": [
                UD.health("091160", "반도체", chg("091160"), "삼성전자 / SK하이닉스"),
                UD.health("091170", "은행", chg("091170"), "KB / 신한"),
                UD.health("091180", "자동차", chg("091180"), "현대차 / 기아"),
                UD.health("305720", "2차전지", chg("305720"), "LG에너지 / 삼성SDI"),
                UD.health("244580", "바이오", chg("244580"), "삼바 / 셀트리온"),
                UD.health("133690", "미국나스닥", chg("133690"), "글로벌 기술주"),
            ],
            "ai": [
                UD.health(t, lookup[t]["company"], lookup[t]["monthChangePct"], "성장 / 테마")
                for t in ["005930", "000660", "373220", "035420", "035720", "068270"]
                if t in lookup
            ],
            "etfRelative": etf_relative,
        },
        "leveragedEtfCatalog": lev_catalog,
        "indices": [
            {"symbol": "^KS11", "name": "코스피", "ticker": "069500", "changePct": kospi[0]["changePct"] if kospi else 0},
            {"symbol": "^KQ11", "name": "코스닥", "ticker": "229200", "changePct": kosdaq[0]["changePct"] if kosdaq else 0},
        ],
        "errors": errors[:80],
        "universeCount": len(metas),
        "groupCounts": group_counts,
        "historyPolicy": {
            "realHistoryMax": MAX_REAL_HISTORY,
            "note": "Top symbols use Yahoo 5Y daily OHLCV; others use Naver snapshot mini-chart.",
        },
        "scorePolicy": {
            "rsScore": "Weighted price momentum (3M/6M/1Y) — same engine as US mode.",
            "epsRevScore": "EPS growth proxy from Yahoo fundamentals when available.",
        },
    }


def split_snapshot_details(payload: dict):
    details = {}
    light_stocks = []
    for stock in payload.get("stocks", []):
        detail = {}
        for key in ["chartSeries", "fundamentals", "news", "earningsHistory"]:
            if key in stock:
                detail[key] = stock[key]
        if detail:
            detail.update({
                "ticker": stock["ticker"],
                "company": stock["company"],
                "historySource": stock.get("historySource"),
                "yahooSymbol": stock.get("yahooSymbol"),
                "market": "kr",
            })
            details[stock["ticker"]] = detail
        light_stocks.append({
            k: v for k, v in stock.items()
            if k not in {"chartSeries", "fundamentals", "news", "earningsHistory"}
        })
    light = dict(payload)
    light["stocks"] = light_stocks
    light["detailPolicy"] = {
        "mode": "split",
        "directory": "data/korea/details",
        "count": len(details),
        "format": "json",
    }
    return light, details


def _atomic_replace(temp: str, path: Path, attempts: int = 10):
    # OneDrive sync / open editors briefly lock the target on Windows (WinError 32).
    # Retry the rename with backoff instead of losing the whole build's output.
    for i in range(attempts):
        try:
            os.replace(temp, path)
            return
        except PermissionError:
            if i == attempts - 1:
                raise
            time.sleep(0.8 * (i + 1))


def write_json(path: Path, payload: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp = tempfile.mkstemp(prefix="korea_snapshot_", suffix=".json", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
        _atomic_replace(temp, path)
    finally:
        try:
            if os.path.exists(temp):
                os.unlink(temp)
        except OSError:
            pass


def write_js(path: Path, payload: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp = tempfile.mkstemp(prefix="korea_snapshot_", suffix=".js", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write("window.KOREA_MARKET_SNAPSHOT = ")
            json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
            handle.write(";\n")
        _atomic_replace(temp, path)
    finally:
        try:
            if os.path.exists(temp):
                os.unlink(temp)
        except OSError:
            pass


def write_details(details: dict):
    DETAILS_DIR.mkdir(parents=True, exist_ok=True)
    for old in DETAILS_DIR.glob("*.json"):
        old.unlink()
    for ticker, detail in details.items():
        safe = re.sub(r"[^0-9A-Z._-]", "_", ticker.upper())
        write_json(DETAILS_DIR / f"{safe}.json", detail)


def main():
    parser = argparse.ArgumentParser(description="Build Korean market snapshot.")
    parser.add_argument("--limit", type=int, default=None, help="Limit universe size (testing).")
    args = parser.parse_args()

    print("Building Korean market snapshot...")
    snapshot = build_snapshot(limit=args.limit)
    light, details = split_snapshot_details(snapshot)
    write_details(details)
    write_json(OUT, light)
    write_js(OUT_JS, light)
    print(f"Updated {OUT} with {len(snapshot['stocks'])} symbols, {len(details)} detail files")
    try:
        import build_map_fundamentals
        build_map_fundamentals.build_market("kr")
    except Exception as exc:
        print(f"[map_fundamentals/kr] rebuild skipped: {exc}")


if __name__ == "__main__":
    main()
