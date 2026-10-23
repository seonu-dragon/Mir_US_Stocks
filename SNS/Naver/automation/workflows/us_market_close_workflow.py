"""
미국 증시 마감 정리 — 데이터 수집 스크립트
역할: yfinance + RSS 수집 → 00_data_brief.md 저장
스펙: SNS/us_market_close_blog_spec.md (Phase 0)
"""

from __future__ import annotations

from pathlib import Path
from datetime import date, datetime, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

load_dotenv()

# The run is "this KST morning": GitHub Actions runs in UTC, where 06:25 KST is still yesterday.
KST = ZoneInfo("Asia/Seoul")


def kst_today() -> date:
    return datetime.now(KST).date()


# ── 티커 정의 ──────────────────────────────────────────────────
TICKERS_INDICES = {
    "S&P500": "^GSPC",
    "나스닥": "^IXIC",
    "다우": "^DJI",
    "러셀2000": "^RUT",
}
TICKERS_VIX = {"VIX": "^VIX"}
TICKERS_SECTORS = {
    "기술(XLK)": "XLK",
    "금융(XLF)": "XLF",
    "헬스케어(XLV)": "XLV",
    "경기소비재(XLY)": "XLY",
    "필수소비재(XLP)": "XLP",
    "에너지(XLE)": "XLE",
    "산업재(XLI)": "XLI",
    "소재(XLB)": "XLB",
    "유틸리티(XLU)": "XLU",
    "리츠(XLRE)": "XLRE",
    "통신(XLC)": "XLC",
}
TICKERS_MACRO = {
    "미10년물금리": "^TNX",
    "달러인덱스": "DX-Y.NYB",
    "WTI유가": "CL=F",
    "금": "GC=F",
}

RSS_FEEDS = [
    ("Reuters Business", "https://feeds.reuters.com/reuters/businessNews"),
    ("MarketWatch Top", "https://feeds.marketwatch.com/marketwatch/topstories/"),
    ("CNBC Top News", "https://www.cnbc.com/id/100003114/device/rss/rss.html"),
]


# ── 1. 거래일 체크 ──────────────────────────────────────────────
def is_us_trading_day(check_date: date) -> bool:
    try:
        import pandas_market_calendars as mcal
        nyse = mcal.get_calendar("NYSE")
        sched = nyse.schedule(
            start_date=check_date.strftime("%Y-%m-%d"),
            end_date=check_date.strftime("%Y-%m-%d"),
        )
        return not sched.empty
    except Exception as e:
        print(f"  [경고] 거래일 확인 실패: {e}. 평일이면 거래일로 간주.")
        return check_date.weekday() < 5


def get_last_trading_date() -> date:
    """KST 오전 실행 기준 — 직전 미국 거래일 반환"""
    candidate = kst_today() - timedelta(days=1)
    for _ in range(7):
        if is_us_trading_day(candidate):
            return candidate
        candidate -= timedelta(days=1)
    return candidate


# ── 2. 시세 데이터 수집 ─────────────────────────────────────────
def _parse_ticker_row(series, check_date: date) -> Optional[dict]:
    try:
        s = series.dropna()
        if s.empty:
            return None
        idx_dates = [d.date() for d in s.index]
        day_mask = [d == check_date for d in idx_dates]
        prev_mask = [d < check_date for d in idx_dates]
        day_vals = s[day_mask]
        prev_vals = s[prev_mask]
        if day_vals.empty:
            return None
        close = float(day_vals.iloc[-1])
        prev_close = float(prev_vals.iloc[-1]) if not prev_vals.empty else close
        change_pct = (close - prev_close) / prev_close * 100 if prev_close != 0 else 0.0
        return {"close": close, "change_pct": change_pct, "prev_close": prev_close}
    except Exception:
        return None


def _fetch_from_chart_meta(ticker: str) -> Optional[dict]:
    import requests
    try:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=5d"
        headers = {"User-Agent": "Mozilla/5.0"}
        r = requests.get(url, headers=headers, timeout=5)
        if r.status_code == 200:
            meta = r.json().get("chart", {}).get("result", [{}])[0].get("meta", {})
            close = meta.get("regularMarketPrice")
            pct = meta.get("regularMarketChangePercent", 0.0)
            if close is not None:
                close = float(close)
                pct = float(pct) if pct is not None else 0.0
                prev_close = close / (1 + pct / 100) if (1 + pct / 100) != 0 else close
                return {"close": close, "change_pct": pct, "prev_close": prev_close}
    except Exception:
        pass
    return None


def _download_group(ticker_dict: dict, trade_date: date) -> dict:
    import yfinance as yf
    tickers = list(ticker_dict.values())
    start = (trade_date - timedelta(days=5)).strftime("%Y-%m-%d")
    end = (trade_date + timedelta(days=2)).strftime("%Y-%m-%d")

    data = yf.download(tickers, start=start, end=end, progress=False, auto_adjust=True)
    close_df = data["Close"] if "Close" in data.columns else data

    result = {}
    for label, ticker in ticker_dict.items():
        try:
            series = close_df[ticker] if ticker in close_df.columns else close_df
            result[label] = _parse_ticker_row(series, trade_date)
            if result[label] is None:
                result[label] = _fetch_from_chart_meta(ticker)
        except Exception:
            result[label] = _fetch_from_chart_meta(ticker)
    return result


def fetch_market_data_yfinance(trade_date: date) -> dict:
    result = {}
    for group_name, ticker_dict in [
        ("indices", TICKERS_INDICES),
        ("volatility", TICKERS_VIX),
        ("sectors", TICKERS_SECTORS),
        ("macro", TICKERS_MACRO),
    ]:
        result[group_name] = _download_group(ticker_dict, trade_date)
    return result


def fetch_market_data_stooq(trade_date: date) -> dict:
    from pandas_datareader import data as pdr

    stooq_map = {"S&P500": "^spx", "나스닥": "^ndq", "다우": "^dji"}
    start = trade_date - timedelta(days=5)
    result = {"indices": {}, "volatility": {}, "sectors": {}, "macro": {}}

    for label, ticker in stooq_map.items():
        try:
            df = pdr.DataReader(ticker, "stooq", start, trade_date + timedelta(days=1))
            df = df.sort_index()
            result["indices"][label] = _parse_ticker_row(df["Close"], trade_date)
        except Exception:
            result["indices"][label] = None
    return result


def fetch_market_data(trade_date: date) -> dict:
    print("  [시세] yfinance 수집 시도...")
    try:
        data = fetch_market_data_yfinance(trade_date)
        valid = [v for v in data.get("indices", {}).values() if v is not None]
        if valid:
            print(f"  [시세] yfinance 완료 (지수 {len(valid)}개 유효)")
            return data
        raise ValueError("유효 데이터 없음")
    except Exception as e:
        print(f"  [시세] yfinance 실패: {e}  →  Stooq 폴백...")
        data = fetch_market_data_stooq(trade_date)
        print("  [시세] Stooq 완료")
        return data


# ── 3. 뉴스 수집 ────────────────────────────────────────────────
def fetch_news_rss(max_per_feed: int = 6) -> list[dict]:
    import feedparser
    import requests

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    headlines: list[dict] = []
    for source, url in RSS_FEEDS:
        try:
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code != 200:
                print(f"  [뉴스] {source} 상태 코드 에러: {response.status_code}")
                continue
            feed = feedparser.parse(response.content)
            for entry in feed.entries[:max_per_feed]:
                title = entry.get("title", "").strip()
                if not title:
                    continue
                headlines.append({
                    "source": source,
                    "title": title,
                    "summary": entry.get("summary", "")[:200].strip(),
                    "link": entry.get("link", ""),
                })
        except Exception as e:
            print(f"  [뉴스] {source} 실패: {e}")

    print(f"  [뉴스] RSS 헤드라인 {len(headlines)}개 수집")
    return headlines


# ── 4. 00_data_brief.md 생성 ────────────────────────────────────
def _arrow(val: Optional[dict]) -> str:
    if not val:
        return "N/A"
    sign = "▲" if val["change_pct"] >= 0 else "▼"
    return f"{sign}{abs(val['change_pct']):.2f}%"


def _close(val: Optional[dict], dec: int = 2) -> str:
    if not val:
        return "N/A"
    return f"{val['close']:,.{dec}f}"


def build_data_brief(market_data: dict, headlines: list[dict], trade_date: date) -> str:
    weekday = ["월", "화", "수", "목", "금", "토", "일"][trade_date.weekday()]
    lines = [
        f"# 미국 증시 마감 데이터 브리프 — {trade_date.strftime('%Y년 %m월 %d일')} ({weekday}요일)",
        "",
        "> 이 파일은 스크립트가 자동 생성한 원본 데이터입니다.",
        "> **수치를 직접 수정하지 마세요.** AI 해석 작업은 이 파일을 읽어서 별도 파일에 작성하세요.",
        "",
        "---",
        "",
        "## 주요 지수",
        "",
        "| 지수 | 종가 | 전일 대비 | 전일 종가 |",
        "|------|-----:|----------:|----------:|",
    ]

    for name, val in market_data.get("indices", {}).items():
        lines.append(f"| {name} | {_close(val)} | {_arrow(val)} | {_close(val and {'close': val['prev_close'], 'change_pct': 0})} |")

    vix = market_data.get("volatility", {}).get("VIX")
    lines.append(f"| VIX (공포지수) | {_close(vix)} | {_arrow(vix)} | — |")

    lines += [
        "",
        "---",
        "",
        "## 섹터별 등락 (등락률 순)",
        "",
        "| 섹터 ETF | 종가 | 전일 대비 |",
        "|---------|-----:|----------:|",
    ]

    sectors = market_data.get("sectors", {})
    sectors_sorted = sorted(
        [(k, v) for k, v in sectors.items() if v is not None],
        key=lambda x: x[1]["change_pct"],
        reverse=True,
    )
    for name, val in sectors_sorted:
        lines.append(f"| {name} | {_close(val)} | {_arrow(val)} |")

    lines += [
        "",
        "---",
        "",
        "## 매크로 환경",
        "",
        "| 항목 | 수치 | 전일 대비 |",
        "|------|-----:|----------:|",
    ]

    for name, val in market_data.get("macro", {}).items():
        lines.append(f"| {name} | {_close(val)} | {_arrow(val)} |")

    lines += [
        "",
        "---",
        "",
        "## 주요 뉴스 헤드라인 (RSS 수집)",
        "",
    ]

    current_source = None
    for h in headlines:
        if h["source"] != current_source:
            current_source = h["source"]
            lines.append(f"### {current_source}")
            lines.append("")
        lines.append(f"- {h['title']}")
        if h.get("link"):
            lines.append(f"  {h['link']}")
        lines.append("")

    lines += [
        "---",
        "",
        f"*생성 시각: {datetime.now(KST).strftime('%Y-%m-%d %H:%M KST')}*",
    ]

    return "\n".join(lines)


# ── 5. 저장 및 실행 ─────────────────────────────────────────────
def save_brief(content: str, folder_date: date) -> Path:
    """Saved under the KST work day's folder (the morning it is written for), not the US trade date."""
    base = Path(__file__).parent.parent.parent  # → SNS/Naver/
    out_dir = base / "02_daily_work" / folder_date.strftime("%Y-%m-%d") / "us_market_close"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "00_data_brief.md"
    out_path.write_text(content, encoding="utf-8")
    return out_path


def run(trade_date: Optional[date] = None, force: bool = False, folder_date: Optional[date] = None) -> Optional[Path]:
    print("=== 미국 증시 마감 데이터 수집 시작 ===\n")

    if trade_date is None:
        trade_date = get_last_trading_date()

    print(f"[거래일] {trade_date}")

    if not force and not is_us_trading_day(trade_date):
        print(f"  → {trade_date}은 NYSE 휴장일. 종료.")
        return None

    print("\n[1/2] 시세 수집...")
    market_data = fetch_market_data(trade_date)

    print("\n[2/2] 뉴스 헤드라인 수집...")
    headlines = fetch_news_rss()

    print("\n[저장] 00_data_brief.md 생성...")
    content = build_data_brief(market_data, headlines, trade_date)
    out_path = save_brief(content, folder_date or kst_today())

    print(f"\n=== 완료 ===")
    print(f"저장 위치: {out_path}")
    print(f"\n다음 단계: Claude 예약 작업이 00_data_brief.md로 5대 시그널 선정·검증")

    # 주간 로컬 미디어 정리 (카드뉴스·이미지 날짜 폴더)
    try:
        import sys

        hook_dir = Path(__file__).resolve().parents[3] / "Common" / "automation"
        # parents: workflows→automation→Naver→SNS
        sys.path.insert(0, str(hook_dir))
        from media_cleanup_hook import run_weekly_media_cleanup

        run_weekly_media_cleanup(reason="us_market_close_collector")
    except Exception as exc:
        print(f"[cleanup] hook skipped: {exc}")

    return out_path


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="미국 증시 마감 데이터 수집 (Phase 0)")
    parser.add_argument("--date", help="거래일 지정 (YYYY-MM-DD). 미입력 시 자동 탐색.")
    parser.add_argument("--force", action="store_true", help="휴장일 체크 건너뜀")
    parser.add_argument("--folder-date", help="저장할 작업일 폴더 (YYYY-MM-DD, 기본 KST 오늘)")
    args = parser.parse_args()

    td = datetime.strptime(args.date, "%Y-%m-%d").date() if args.date else None
    fd = datetime.strptime(args.folder_date, "%Y-%m-%d").date() if args.folder_date else None
    run(trade_date=td, force=args.force, folder_date=fd)
