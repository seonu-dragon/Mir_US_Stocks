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
import importlib.util
import json
import os
import re
import tempfile
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
MAX_FUNDAMENTALS = 400
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
    "102110": ("TIGER 200", "ETF", "대형주 ETF", "all_etf", 45),
    "091160": ("KODEX 반도체", "ETF", "반도체 ETF", "all_etf", 8),
    "305720": ("KODEX 2차전지산업", "ETF", "2차전지 ETF", "all_etf", 5),
    "091170": ("KODEX 은행", "ETF", "은행 ETF", "all_etf", 3),
    "091180": ("KODEX 자동차", "ETF", "자동차 ETF", "all_etf", 2),
    "244580": ("KODEX 바이오", "ETF", "바이오 ETF", "all_etf", 2),
    "228800": ("TIGER 미국S&P500", "ETF", "해외 ETF", "all_etf", 12),
    "133690": ("TIGER 미국나스닥100", "ETF", "해외 ETF", "all_etf", 10),
    "122630": ("KODEX 레버리지", "ETF", "레버리지 ETF", "all_etf", 4),
    "252670": ("KODEX 200선물인버스2X", "ETF", "인버스 ETF", "all_etf", 3),
}

THEMATIC_CODES = {
    "005930", "000660", "373220", "006400", "051910", "035420", "035720",
    "000270", "005380", "207940", "068270", "105560", "055550", "003670",
}


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
        volume = parse_number(cells[5])
        amount = parse_number(cells[6]) if len(cells) > 6 else None
        cap_eok = parse_number(cells[7]) if len(cells) > 7 else None
        if price is None:
            continue
        cap_trillion = (cap_eok or 0) / 10000.0  # 억원 → 조원
        out.append({
            "symbol": code,
            "company": company,
            "market": market,
            "yahooSymbol": yahoo_ticker(code, market),
            "quotePrice": price,
            "quoteChangePct": change_pct if change_pct is not None else 0.0,
            "quoteVolume": volume,
            "quoteAmount": amount,
            "marketCapT": cap_trillion,
            "marketCapB": cap_trillion,  # 조원 단위 (한국 모드 전용)
            "sector": "MISC",
            "industry": "기타",
            "groups": {f"idx_{market}", "all_kr"},
        })
    return out


def fetch_all_listed(limit: int | None = None) -> list[dict]:
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
                universe[row["symbol"]] = row
            if limit and len(universe) >= limit:
                break
        if limit and len(universe) >= limit:
            break

    metas = sorted(universe.values(), key=lambda m: m.get("marketCapT") or 0, reverse=True)
    if limit:
        metas = metas[:limit]

    for rank, meta in enumerate(metas):
        if meta["market"] == "kospi" and rank < 200:
            meta["groups"].add("idx_kospi200")
        if meta["market"] == "kosdaq" and rank < 150 and meta["market"] == "kosdaq":
            pass
        if meta["symbol"] in THEMATIC_CODES:
            meta["groups"].add("thematic")

    kosdaq_sorted = [m for m in metas if m["market"] == "kosdaq"]
    for meta in kosdaq_sorted[:150]:
        meta["groups"].add("idx_kosdaq150")

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
        try:
            price_hint = meta.get("quotePrice") or (rows[-1]["close"] if rows else None)
            meta["fundamentals"] = UD.fetch_all_fundamentals(
                yahoo_quote_symbol(ysym), price_hint=price_hint, market_cap_b=meta.get("marketCapT")
            )
        except Exception as exc:
            meta["fundamentals"] = {}
            error = f"{error}; fundamentals {symbol}: {exc}" if error else f"fundamentals {symbol}: {exc}"

    if meta.get("preferHistory") or meta.get("preferFundamentals"):
        news = UD.fetch_news(yahoo_quote_symbol(ysym))
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
    return stock, error


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


def build_snapshot(limit: int | None = None) -> dict:
    metas = fetch_all_listed(limit=limit)
    metas.sort(key=history_priority, reverse=True)
    real_symbols = {m["symbol"] for m in metas[:MAX_REAL_HISTORY]}
    fund_symbols = {m["symbol"] for m in metas[:MAX_FUNDAMENTALS]}

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
    with ThreadPoolExecutor(max_workers=16) as pool:
        futures = [pool.submit(build_one, meta) for meta in metas]
        for fut in as_completed(futures):
            stock, err = fut.result()
            stocks.append(stock)
            if err:
                errors.append(err)

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

    return {
        "market": "kr",
        "updatedAtKst": datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y-%m-%d %H:%M KST"),
        "policy": "Daily snapshot. Korean equities from Naver Finance + Yahoo Finance.",
        "summary": build_summary(stocks),
        "stocks": stocks,
        "health": {
            "major": [
                UD.health("069500", "KODEX 200", chg("069500"), "코스피 대형주"),
                UD.health("102110", "TIGER 200", chg("102110"), "코스피 추종"),
                UD.health("091160", "KODEX 반도체", chg("091160"), "반도체 섹터"),
                UD.health("228800", "TIGER 미국S&P500", chg("228800"), "해외 분산"),
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
            "etfRelative": {"rows": [], "universeCount": len(stocks), "method": "korea"},
        },
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


def write_json(path: Path, payload: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp = tempfile.mkstemp(prefix="korea_snapshot_", suffix=".json", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)


def write_js(path: Path, payload: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp = tempfile.mkstemp(prefix="korea_snapshot_", suffix=".js", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write("window.KOREA_MARKET_SNAPSHOT = ")
            json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
            handle.write(";\n")
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)


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


if __name__ == "__main__":
    main()