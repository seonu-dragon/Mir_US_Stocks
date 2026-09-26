"""오늘의 특징주 — 장 마감 기준 크게 움직인 종목과 한 줄 사유 (US·KR).

    py scripts/build_movers_reasons.py --market kr --push   # korea-close-briefing 말미
    py scripts/build_movers_reasons.py --market us --push   # daily-market-snapshot 말미
    py scripts/build_movers_reasons.py --market us --no-llm # 근거 수집만(요약 없이 확인용)

흐름
1. 대상: 커밋된 장마감 스냅샷에서 당일 등락률 상위/하위. ETF·잡주는 시총·거래대금
   하한으로 뺀다. 거래일은 KR 지수 tradedAt · US 스냅샷 priceDate. 등락률은 날짜가 확인되는
   값(KR 네이버 · US 야후 일봉, 봉이 빠졌으면 야후 meta 시세 → details 일봉 → 그 종목
   priceDate 가 거래일인 스냅샷 값)으로 다시 확인하고, 날짜를 확인 못 하거나 스냅샷과 1%p
   넘게 어긋나면 뺀다 — 지어낸 등락이 특징주로 올라가지 않게.
2. 근거: 같은 날(전 거래일 포함) 공시(KR DART list.json · 기존 kr_disclosures /
   US SEC 8-K 전문검색 · 기존 material_events), 뉴스 헤드라인(KR 네이버 검색 API →
   없으면 Google News RSS · 종목 상세의 네이버 뉴스 / US Google News RSS · 종목 상세의
   야후 뉴스), 같은 업종 평균 등락(섹터 동조), 지수 등락.
3. 요약: 뉴스·공시 근거가 있는 종목만 Gemini 로 한 줄(40자 내외) 요약을 만든다.
   근거가 전혀 없으면 LLM 을 부르지 않고 "뚜렷한 재료 확인 안 됨", 업종 동조만 있으면
   LLM 없이 그 사실을 적는다. LLM 출력은 (a) 인용한 근거 ID 가 입력 목록에 실제로
   있는지 (b) 문장 속 숫자가 인용 근거·등락률에 있는지 검사하고, 어기면 그 종목은
   "요약 실패"로 발행한다(사유 없이 목록만 나가지 않는다).

호출량: 시장당 하루 LLM 2~3회(10종목 묶음), 공개 레포에 매일 커밋되므로 이 이상 늘리지
말 것. 같은 거래일 보드가 이미 정상 발행돼 있으면 아무것도 호출하지 않고 끝낸다
(KR 브리핑 워크플로우는 주말·연휴에도 돈다).
"""
from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from zoneinfo import ZoneInfo

if sys.platform == "win32":
    # cp949 콘솔에서 한글 print 가 UnicodeEncodeError 로 죽어 빌드 실패로 둔갑한다.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import sec_client as sec  # noqa: E402
import us_market_calendar as usc  # noqa: E402
from briefing_store import repository_publish_lock  # noqa: E402

KST = ZoneInfo("Asia/Seoul")
UA = {"User-Agent": "Mozilla/5.0 (compatible; MirMoversBoard/1.0)"}

# 기본 산출물은 US. KR 은 MARKETS["kr"] 경로(data/korea/)로 쓴다 — 프론트는
# FEATURE_DATA marketSpecific 로 시장별 파일을 고른다.
OUT_JSON = ROOT / "data" / "movers_reasons.json"
OUT_JS = ROOT / "data" / "movers_reasons.js"
JS_GLOBAL = "MOVERS_REASONS"

NO_MATERIAL = "뚜렷한 재료 확인 안 됨"
TOP_N = 10               # 방향별 최대 종목 수
MIN_ABS_MOVE = 3.0       # 이보다 작게 움직인 종목은 '특징주'가 아니다
LLM_BATCH = 10           # 한 번의 Gemini 호출에 넣는 종목 수
MAX_LLM_CALLS = 4        # 시장당 하루 상한(보통 1~2회)
MAX_NEWS_PER_STOCK = 6
MAX_DISC_PER_STOCK = 4
GEMINI_MODELS = ("gemini-2.5-flash", "gemini-2.5-flash-lite")

MARKETS = {
    "us": {
        "label": "미국",
        "snapshot": ROOT / "data" / "market_snapshot.json",
        "details": ROOT / "data" / "details",
        "out_json": OUT_JSON,
        "out_js": OUT_JS,
        "exclude_sectors": {"EXCHANGE TRADED FUNDS", "MISC"},
        "min_cap": 2.0,            # marketCapB = 십억 달러 → 20억 달러
        "min_value": 25e6,         # 거래대금 2,500만 달러
        "criteria": "시총 20억 달러 이상 · 거래대금 2,500만 달러 이상 · ETF 제외",
        "currency": "USD",
    },
    "kr": {
        "label": "국내",
        "snapshot": ROOT / "data" / "korea" / "market_snapshot.json",
        "details": ROOT / "data" / "korea" / "details",
        "out_json": ROOT / "data" / "korea" / "movers_reasons.json",
        "out_js": ROOT / "data" / "korea" / "movers_reasons.js",
        "exclude_sectors": {"ETF"},
        "min_cap": 0.2,            # marketCapB = 조원 → 2,000억 원
        "min_value": 5e9,          # 거래대금 50억 원
        "criteria": "시총 2,000억 원 이상 · 거래대금 50억 원 이상 · ETF·스팩 제외",
        "currency": "KRW",
    },
}

TAG_OF = {"disclosure": "공시", "news": "뉴스", "sector": "섹터동조"}


def now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def load_env() -> None:
    """로컬 실행용 .env (Actions 는 secrets 환경변수). 기존 값은 덮지 않는다."""
    path = ROOT / ".env"
    if not path.exists():
        return
    try:
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    except Exception:
        pass


def http_get(url: str, headers: dict | None = None, timeout: int = 20) -> bytes | None:
    for attempt in range(2):
        try:
            req = urllib.request.Request(url, headers={**UA, **(headers or {})})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except urllib.error.HTTPError as exc:
            if exc.code in (401, 403, 404):
                return None
        except Exception:
            pass
        time.sleep(1.5 * (attempt + 1))
    return None


def load_json(path: Path, default=None):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception:
        return default


def iso_shift(iso: str, days: int) -> str:
    return (date.fromisoformat(iso) + timedelta(days=days)).isoformat()


def fnum(v):
    try:
        x = float(v)
        return x if x == x else None
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# 1. 대상 선정
# ---------------------------------------------------------------------------

def is_excluded(stock: dict, cfg: dict, market: str) -> bool:
    if stock.get("sector") in cfg["exclude_sectors"]:
        return True
    groups = stock.get("groups") or []
    if "lev_etf" in groups or "all_etf" in groups:
        return True
    name = str(stock.get("company") or "")
    if market == "kr" and ("스팩" in name or "ETN" in name):
        return True
    return False


def detail_bar(cfg: dict, ticker: str):
    """details 일봉에서 (마지막 날짜, 종가, 전일 종가, 거래량)."""
    d = load_json(cfg["details"] / f"{ticker}.json")
    series = (d or {}).get("chartSeries") or []
    if len(series) < 2:
        return None
    last, prev = series[-1], series[-2]
    try:
        close, prev_close = float(last[3]), float(prev[3])
        volume = float(last[4] or 0)
        day = str(last[5])[:10]
    except (TypeError, ValueError, IndexError):
        return None
    if not prev_close:
        return None
    return {"date": day, "close": close, "prevClose": prev_close, "volume": volume, "detail": d}


def snapshot_price_date(snap: dict, now: datetime | None = None) -> str | None:
    """US 스냅샷의 priceDate — 형식이 맞고, 거래일이며, 이미 장이 끝난 날일 때만."""
    pd = str(snap.get("priceDate") or "")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", pd):
        return None
    day = date.fromisoformat(pd)
    if usc.is_trading_day(day) is False:
        return None
    now_et = (now or datetime.now(usc.ET)).astimezone(usc.ET)
    if now_et < usc.session_close(day):
        return None
    return pd


def resolve_trade_date(snap: dict, cfg: dict, market: str, now: datetime | None = None) -> str | None:
    """스냅샷 등락률이 가리키는 거래일.

    KR: 지수 tradedAt(네이버, 스냅샷과 같은 소스).
    US: 스냅샷 priceDate(PR #209, 야후의 날짜 붙은 값으로 정한 가격 기준일)가 1순위.
    없으면(옛 스냅샷) 다수결 — 종목 상세의 일봉은 날짜가 빠지거나 밀린다(2026-09-25 실측:
    ABNB 상세 일봉이 09-22 봉 없이 09-21 → 09-23 으로 이어져 등락률이 -10.4% 로 계산됨,
    실제 09-23 은 -7.6%). 그래서 시총 상위 종목들의 야후 일봉 중 스냅샷 등락률과 맞는
    날짜를 다수결로 고른다.
    """
    if market == "kr":
        for idx in snap.get("indices") or []:
            t = str(idx.get("tradedAt") or "")[:10]
            if re.fullmatch(r"\d{4}-\d{2}-\d{2}", t):
                return t
        return None
    # 2026-09-26 run 36202139416: 크론이 00:00 UTC 뒤에 돌아 야후·상세 일봉 마지막이 09-24
    # 라 다수결이 {'2026-09-23': 1} 로 끝나 보드가 멈췄다. 스냅샷 priceDate 는 09-25 였다.
    pd = snapshot_price_date(snap, now)
    if pd:
        print(f"  거래일: 스냅샷 priceDate {pd}")
        return pd
    stocks =[s for s in snap.get("stocks") or [] if not is_excluded(s, cfg, market)
              and fnum(s.get("changePct")) is not None and abs(float(s["changePct"])) >= 0.3]
    stocks.sort(key=lambda s: fnum(s.get("marketCapB")) or 0, reverse=True)
    votes = Counter()
    for s in stocks[:15]:
        bars = yahoo_bars(s["ticker"])
        if not bars:
            continue
        # 최근 날짜부터 스냅샷 등락률(소수 1자리 반올림)과 맞는 봉을 찾는다.
        for day in sorted(bars, reverse=True):
            b = bars[day]
            if b.get("changePct") is not None and abs(b["changePct"] - float(s["changePct"])) <= 0.06:
                votes[day] += 1
                break
    if not votes:
        return None
    day, n = votes.most_common(1)[0]
    print(f"  거래일 판정(야후 대조): {dict(votes)}")
    return day if n >= 5 else None


_yahoo_cache: dict[str, dict] = {}


def yahoo_bars(ticker: str) -> dict[str, dict]:
    """야후 일봉 1개월 → {날짜: {close, changePct, volume}}. 실패하면 {}."""
    if ticker in _yahoo_cache:
        return _yahoo_cache[ticker]
    sym = ticker.replace(".", "-")
    raw = http_get(f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(sym)}?range=1mo&interval=1d",
                   timeout=15)
    try:
        res = json.loads(raw.decode("utf-8"))["chart"]["result"][0] if raw else None
    except Exception:
        res = None
    out = parse_yahoo_chart(res) if res else {}
    time.sleep(0.15)
    _yahoo_cache[ticker] = out
    return out


def previous_trading_day(day: date) -> date | None:
    """NYSE 달력으로 직전 거래일. 달력이 모르는 해면 None(추정하지 않는다)."""
    d = day
    for _ in range(10):
        d -= timedelta(days=1)
        trading = usc.is_trading_day(d)
        if trading is None:
            return None
        if trading:
            return d
    return None


def parse_yahoo_chart(res: dict, now: datetime | None = None) -> dict[str, dict]:
    """야후 chart result → {날짜: {close, changePct, volume}}.

    00:00 UTC 이후 받은 일봉은 마지막 거래일 봉이 빠진 채 오는 일이 잦다(2026-09-26 run
    에서 3,168종목). 그때도 meta.regularMarketTime/Price 는 그 날 값이다 — 시세 날짜가
    마지막 봉의 **바로 다음 거래일**이고 그 날 장이 끝났으면, 그 날을 시세 가격 · 마지막 봉
    종가(= 전 거래일 종가) · regularMarketVolume 으로 채운다(fromMeta). 봉이 이틀 이상
    빠졌으면 전일 종가를 모르므로 채우지 않는다(지어내지 않는다).
    """
    out: dict[str, dict] = {}
    try:
        meta = res.get("meta") or {}
        tz = ZoneInfo(meta.get("exchangeTimezoneName") or "America/New_York")
        quote = res["indicators"]["quote"][0]
        prev = None
        for i, t in enumerate(res.get("timestamp") or []):
            close, volume = quote["close"][i], quote["volume"][i]
            if close is None:
                continue
            day = datetime.fromtimestamp(t, tz).date().isoformat()
            out[day] = {"close": float(close), "volume": float(volume or 0),
                        "changePct": (float(close) / prev - 1) * 100 if prev else None}
            prev = float(close)
        price, stamp = fnum(meta.get("regularMarketPrice")), fnum(meta.get("regularMarketTime"))
        if out and price and price > 0 and stamp:
            qday = datetime.fromtimestamp(stamp, usc.ET).date()
            last_day = date.fromisoformat(max(out))
            now_et = (now or datetime.now(usc.ET)).astimezone(usc.ET)
            if (qday > last_day and now_et >= usc.session_close(qday)
                    and previous_trading_day(qday) == last_day):
                prev_close = out[last_day.isoformat()]["close"]
                out[qday.isoformat()] = {
                    "close": price, "volume": fnum(meta.get("regularMarketVolume")),
                    "changePct": (price / prev_close - 1) * 100 if prev_close else None,
                    "fromMeta": True,
                }
    except Exception:
        return {}
    return out


NAVER_HEADERS = {"Accept": "application/json", "Referer": "https://m.stock.naver.com/"}


def _num(text) -> float | None:
    try:
        return float(str(text).replace(",", "").strip())
    except (TypeError, ValueError):
        return None


def live_bar_kr(ticker: str, trade_date: str) -> dict | None:
    """네이버 m.stock: 종가·등락률·거래시각(basic) + 거래량(integration).

    KR 종목 상세(details)의 일봉은 야후 캐시라 중소형주는 며칠씩 늦는다(2026-09-25 실측:
    등락률 상위 45개 중 21개가 1~2주 전 봉). 그대로 쓰면 오늘 가장 크게 움직인 종목이
    '거래일 불일치'로 빠지므로, 후보만 네이버에서 거래일 값을 다시 확인한다.
    """
    raw = http_get(f"https://m.stock.naver.com/api/stock/{ticker}/basic", NAVER_HEADERS, timeout=10)
    if not raw:
        return None
    try:
        basic = json.loads(raw.decode("utf-8"))
    except Exception:
        return None
    if str(basic.get("localTradedAt") or "")[:10] != trade_date:
        return None
    close, chg = _num(basic.get("closePrice")), _num(basic.get("fluctuationsRatio"))
    if close is None or chg is None:
        return None
    volume = None
    raw = http_get(f"https://m.stock.naver.com/api/stock/{ticker}/integration", NAVER_HEADERS, timeout=10)
    try:
        for row in (json.loads(raw.decode("utf-8")).get("totalInfos") or []) if raw else []:
            if row.get("code") == "accumulatedTradingVolume":
                volume = _num(row.get("value"))
    except Exception:
        volume = None
    if volume is None:
        return None
    return {"date": trade_date, "close": close, "changePct": chg, "volume": volume, "source": "naver"}


def live_bar_us(ticker: str, trade_date: str) -> dict | None:
    """야후 일봉에서 거래일 봉(전 거래일 종가 대비 등락률·거래량)."""
    bar = yahoo_bars(ticker).get(trade_date)
    if not bar or bar.get("changePct") is None or bar.get("volume") is None:
        return None
    return {"date": trade_date, "close": bar["close"], "changePct": bar["changePct"],
            "volume": bar["volume"], "source": "yahoo-meta" if bar.get("fromMeta") else "yahoo"}


def snapshot_bar_us(stock: dict, detail: dict, trade_date: str) -> dict | None:
    """마지막 수단: 스냅샷 값 — 그 종목 priceDate 가 거래일일 때만(야후 날짜로 확인된 값).

    스냅샷엔 거래량이 없어 상세 일봉 최근 20봉 평균 거래량 × volumeRatio 로 거래대금
    하한만 가늠한다(보드에 거래대금 값은 싣지 않는다). 재료가 모자라면 쓰지 않는다.
    """
    if not stock or stock.get("priceDate") != trade_date:
        return None
    price, chg, ratio = fnum(stock.get("price")), fnum(stock.get("changePct")), fnum(stock.get("volumeRatio"))
    vols = []
    for row in ((detail or {}).get("chartSeries") or [])[-20:]:
        try:
            if str(row[5])[:10] < trade_date and float(row[4] or 0) > 0:
                vols.append(float(row[4]))
        except (TypeError, ValueError, IndexError):
            continue
    if not price or chg is None or not ratio or len(vols) < 5:
        return None
    return {"date": trade_date, "close": price, "changePct": chg,
            "volume": sum(vols) / len(vols) * ratio, "source": "snapshot"}


def verified_bar(cfg: dict, market: str, ticker: str, trade_date: str,
                 stock: dict | None = None) -> tuple[dict | None, dict | None]:
    """(거래일 봉, details). 등락률·거래대금은 라이브 소스(KR 네이버 · US 야후 일봉/시세)의
    거래일 봉으로 확인한다 — details 일봉은 날짜가 빠지거나(US) 며칠 늦다(KR 중소형주).
    라이브가 실패하면 details 의 마지막 봉이 거래일일 때, US 는 그다음 스냅샷 값의 priceDate
    가 거래일일 때만 쓴다(스냅샷 대조는 호출부). 날짜를 확인 못 하면 (None, details)."""
    detail = load_json(cfg["details"] / f"{ticker}.json") or {}
    live = (live_bar_kr if market == "kr" else live_bar_us)(ticker, trade_date)
    if market == "kr":
        time.sleep(0.12)
    if live:
        return live, detail
    bar = detail_bar(cfg, ticker)
    if bar and bar["date"] == trade_date:
        return ({"date": trade_date, "close": bar["close"],
                 "changePct": (bar["close"] / bar["prevClose"] - 1) * 100,
                 "volume": bar["volume"], "source": "details"}, detail)
    if market == "us":
        snap_bar = snapshot_bar_us(stock, detail, trade_date)
        if snap_bar:
            return snap_bar, detail
    return None, detail


MAX_VERIFY_PER_SIDE = 45


def pick_movers(snap: dict, cfg: dict, market: str, trade_date: str):
    pool = []
    for s in snap.get("stocks") or []:
        if is_excluded(s, cfg, market):
            continue
        chg = fnum(s.get("changePct"))
        cap = fnum(s.get("marketCapB"))
        if chg is None or cap is None or cap < cfg["min_cap"] or abs(chg) < MIN_ABS_MOVE:
            continue
        pool.append(s)
    out = {"up": [], "down": []}
    dropped = Counter()
    for side, sign in (("up", 1), ("down", -1)):
        ranked = sorted((s for s in pool if s["changePct"] * sign > 0), key=lambda s: -abs(s["changePct"]))
        for s in ranked[:MAX_VERIFY_PER_SIDE]:
            if len(out[side]) >= TOP_N:
                break
            bar, detail = verified_bar(cfg, market, s["ticker"], trade_date, s)
            if not bar:
                dropped["거래일 봉 확인 불가"] += 1
                continue
            chg = bar["changePct"]
            # 스냅샷 등락률과 거래일 봉이 1%p 넘게 다르면 어느 쪽이 맞는지 모른다 — 뺀다.
            if abs(chg - float(s["changePct"])) > 1.0 or chg * sign <= 0:
                dropped["등락률 불일치"] += 1
                continue
            value = bar["close"] * bar["volume"]
            if value < cfg["min_value"]:
                dropped["거래대금 미달"] += 1
                continue
            out[side].append({
                "ticker": s["ticker"],
                "company": s.get("company") or s["ticker"],
                "sector": s.get("sector") or "",
                "industry": s.get("industry") or "",
                "changePct": round(chg, 2),
                "close": bar["close"],
                # 스냅샷 폴백은 거래량이 추정이라 값은 싣지 않는다(하한 판정에만 썼다).
                "tradingValue": round(value) if bar["source"] != "snapshot" else None,
                "priceSource": bar["source"],
                "marketCapB": fnum(s.get("marketCapB")),
                "_detail": detail or {},
            })
    if dropped:
        print(f"  제외: {dict(dropped)}")
    sources = Counter(m["priceSource"] for side in out.values() for m in side)
    if sources:
        print(f"  등락률 확인 소스: {dict(sources)}")
    return out


# ---------------------------------------------------------------------------
# 2. 근거 수집
# ---------------------------------------------------------------------------

def sector_context(snap: dict, cfg: dict, market: str, stock: dict) -> dict | None:
    """같은 업종(없으면 섹터)의 시총가중 평균 등락. 대상 종목은 빼고 계산.

    단순 평균은 소형주 수십 개에 희석된다(2026-09-23 KR 건설: 대형 3사 -6~-7% 인데 50종목
    단순 평균 -0.8%). '업종이 같이 움직였나'는 시총 가중이 실제에 가깝다.
    """
    peers_all = [s for s in snap.get("stocks") or []
                 if not is_excluded(s, cfg, market) and s["ticker"] != stock["ticker"]
                 and fnum(s.get("changePct")) is not None
                 and (fnum(s.get("marketCapB")) or 0) >= cfg["min_cap"] * 0.25]
    for key in ("industry", "sector"):
        name = stock.get(key)
        if not name:
            continue
        peers = [s for s in peers_all if s.get(key) == name]
        if len(peers) >= 5:
            w = sum(float(s["marketCapB"]) for s in peers)
            avg = sum(float(s["changePct"]) * float(s["marketCapB"]) for s in peers) / w if w else 0.0
            return {"level": "업종" if key == "industry" else "섹터", "name": name,
                    "avgPct": round(avg, 2), "n": len(peers), "weighting": "시총가중"}
    return None


def sector_is_sync(stock: dict, ctx: dict | None) -> bool:
    """업종이 같은 방향으로 뚜렷하게 움직였나 — 시총가중 평균 2% 이상이고 종목 등락의 30% 이상."""
    if not ctx:
        return False
    chg, avg = stock["changePct"], ctx["avgPct"]
    return chg * avg > 0 and abs(avg) >= 2.0 and abs(avg) >= 0.3 * abs(chg)


def board_clusters(movers: dict) -> dict[str, list[dict]]:
    """같은 방향 보드에 같은 업종이 3종목 이상이면 그 묶음(티커 → 동료 목록)."""
    out: dict[str, list[dict]] = {}
    for side in ("up", "down"):
        by_ind: dict[str, list[dict]] = {}
        for s in movers[side]:
            if s.get("industry"):
                by_ind.setdefault(s["industry"], []).append(s)
        for group in by_ind.values():
            if len(group) >= 3:
                for s in group:
                    out[s["ticker"]] = [g for g in group if g is not s]
    return out


def index_moves(snap: dict, market: str) -> list[dict]:
    out = []
    if market == "kr":
        for idx in snap.get("indices") or []:
            if fnum(idx.get("changePct")) is not None:
                out.append({"name": idx.get("name") or idx.get("symbol"), "changePct": fnum(idx["changePct"])})
        return out
    names = {"SPY": "S&P 500(SPY)", "QQQ": "나스닥100(QQQ)"}
    by = {s["ticker"]: s for s in snap.get("stocks") or [] if s.get("ticker") in names}
    for t, label in names.items():
        if t in by and fnum(by[t].get("changePct")) is not None:
            out.append({"name": label, "changePct": fnum(by[t]["changePct"])})
    return out


COMPANY_SUFFIX = re.compile(
    r"[,.]?\s+(Inc|Incorporated|Corp|Corporation|Co|Company|Ltd|Limited|plc|PLC|Holdings?|Group|"
    r"N\.?V|S\.?A|AG|SE|L\.?P|LLC|Class [A-Z]|Series [A-Z]|Common Stock|Ordinary Shares|ADR|American Depositary Shares)\b\.?",
    re.I,
)


def short_company(name: str) -> str:
    s = str(name or "")
    for _ in range(3):
        s = COMPANY_SUFFIX.sub("", s).strip(" ,.-")
    return s


def name_terms(stock: dict, market: str) -> list[str]:
    """뉴스 제목이 이 종목 얘기인지 가르는 단어들."""
    if market == "kr":
        name = str(stock["company"]).strip()
        terms = [name]
        if name.endswith("우") or name.endswith("우B"):
            terms.append(re.sub(r"우B?$", "", name))
        return [t for t in terms if len(t) >= 2]
    terms = [stock["ticker"]]
    short = short_company(stock["company"])
    if short:
        terms.append(short)
        first = short.split()[0]
        if len(first) >= 4 and first.lower() not in {"first", "united", "american", "global", "general", "the"}:
            terms.append(first)
    return terms


def title_mentions(title: str, terms: list[str]) -> bool:
    t = title.lower()
    for term in terms:
        if not term:
            continue
        if re.fullmatch(r"[A-Z.\-]{1,6}", term):
            if re.search(rf"(?<![A-Za-z]){re.escape(term)}(?![A-Za-z])", title):
                return True
        elif term.lower() in t:
            return True
    return False


def clean_text(s: str) -> str:
    s = re.sub(r"<[^>]+>", " ", html.unescape(str(s or "")))
    return re.sub(r"\s+", " ", s).strip()


def parse_rss(xml: str) -> list[dict]:
    out = []
    for block in re.findall(r"<item>(.*?)</item>", xml or "", re.S)[:60]:
        def tag(name):
            m = re.search(rf"<{name}(?:\s[^>]*)?>(.*?)</{name}>", block, re.S)
            return clean_text(re.sub(r"^<!\[CDATA\[|\]\]>$", "", m.group(1).strip())) if m else ""
        title, link = tag("title"), tag("link")
        source = tag("source")
        if source and title.endswith(f" - {source}"):
            title = title[: -len(source) - 3].strip()
        try:
            pub = parsedate_to_datetime(tag("pubDate")).astimezone(timezone.utc)
        except Exception:
            pub = None
        if title and link.startswith("http"):
            out.append({"title": title, "link": link, "source": source or "Google News", "pub": pub})
    return out


def google_news(query: str, market: str) -> list[dict]:
    loc = {"hl": "ko", "gl": "KR", "ceid": "KR:ko"} if market == "kr" else {"hl": "en-US", "gl": "US", "ceid": "US:en"}
    raw = http_get("https://news.google.com/rss/search?" + urllib.parse.urlencode({"q": query, **loc}),
                   {"Accept": "application/rss+xml, application/xml, text/xml"})
    return parse_rss(raw.decode("utf-8", "replace")) if raw else []


_naver_state = {"disabled": False}


def naver_news(query: str) -> list[dict] | None:
    """네이버 뉴스 검색 API. 키가 없거나 거부되면 None(= 폴백 사용)."""
    cid, secret = os.getenv("NAVER_CLIENT_ID", ""), os.getenv("NAVER_CLIENT_SECRET", "")
    if not cid or not secret or _naver_state["disabled"]:
        return None
    url = "https://openapi.naver.com/v1/search/news.json?" + urllib.parse.urlencode(
        {"query": query, "display": 30, "sort": "date"})
    try:
        req = urllib.request.Request(url, headers={
            "X-Naver-Client-Id": cid, "X-Naver-Client-Secret": secret, "Accept": "application/json", **UA})
        with urllib.request.urlopen(req, timeout=15) as resp:
            items = json.loads(resp.read().decode("utf-8")).get("items") or []
    except urllib.error.HTTPError as exc:
        if exc.code in (401, 403):
            print(f"  [경고] 네이버 뉴스 API {exc.code} — 이번 실행은 Google News 로 대체")
            _naver_state["disabled"] = True
        return None
    except Exception:
        return None
    out = []
    for it in items:
        try:
            pub = parsedate_to_datetime(it.get("pubDate")).astimezone(timezone.utc)
        except Exception:
            pub = None
        link = it.get("originallink") or it.get("link") or ""
        host = urllib.parse.urlparse(link).netloc.replace("www.", "")
        out.append({"title": clean_text(it.get("title")), "link": link, "source": host or "네이버 뉴스", "pub": pub})
    return out


def news_window(trade_date: str, market: str):
    """뉴스 인정 구간(UTC). 전 거래일 장 마감 무렵부터 거래일 다음 날 오전까지."""
    d = date.fromisoformat(trade_date)
    if market == "kr":
        start = datetime(d.year, d.month, d.day, 15, 30, tzinfo=KST) - timedelta(days=1)
        # 월요일이면 금요일 오후부터(주말 뉴스 포함)
        if d.weekday() == 0:
            start -= timedelta(days=2)
        end = datetime(d.year, d.month, d.day, 23, 59, tzinfo=KST)
    else:
        et = ZoneInfo("America/New_York")
        start = datetime(d.year, d.month, d.day, 16, 0, tzinfo=et) - timedelta(days=1)
        if d.weekday() == 0:
            start -= timedelta(days=2)
        end = datetime(d.year, d.month, d.day, 23, 59, tzinfo=et)
    return start.astimezone(timezone.utc), end.astimezone(timezone.utc)


def collect_news(stock: dict, market: str, trade_date: str) -> list[dict]:
    terms = name_terms(stock, market)
    start, end = news_window(trade_date, market)
    candidates: list[dict] = []
    if market == "kr":
        naver = naver_news(f'"{stock["company"]}"')
        if naver is None:
            q = f'"{stock["company"]}" after:{iso_shift(trade_date, -3)} before:{iso_shift(trade_date, 2)}'
            candidates += google_news(q, market)
        else:
            candidates += naver
    else:
        short = short_company(stock["company"])
        ident = f'("{short}" OR "{stock["ticker"]}")' if short and short.upper() != stock["ticker"] else f'"{stock["ticker"]}"'
        q = f"{ident} stock after:{iso_shift(trade_date, -3)} before:{iso_shift(trade_date, 2)}"
        candidates += google_news(q, market)
    # 종목 상세에 이미 들어 있는 뉴스(KR 네이버 종목 뉴스 · US 야후) — 날짜만 있다.
    for n in (stock.get("_detail") or {}).get("news") or []:
        pd = str(n.get("publishedAt") or "")[:10]
        if pd and iso_shift(trade_date, -1) <= pd <= iso_shift(trade_date, 1):
            candidates.append({"title": clean_text(n.get("title")), "link": n.get("link") or "",
                               "source": n.get("publisher") or "", "pub": None, "day": pd})
    seen, out = set(), []
    for n in candidates:
        title, link = n.get("title") or "", n.get("link") or ""
        if not title or not link.startswith("http"):
            continue
        pub = n.get("pub")
        if pub is not None and not (start <= pub <= end):
            continue
        if not title_mentions(title, terms):
            continue
        key = re.sub(r"[^0-9a-z가-힣]", "", title.lower())[:60]
        if key in seen:
            continue
        seen.add(key)
        day = n.get("day") or (pub.astimezone(KST if market == "kr" else ZoneInfo("America/New_York")).date().isoformat() if pub else "")
        out.append({"type": "news", "title": title[:160], "link": link, "source": str(n.get("source") or "")[:40], "date": day})
        if len(out) >= MAX_NEWS_PER_STOCK:
            break
    return out


# --- 공시 ---

def us_disclosures(tickers: set[str], trade_date: str) -> dict[str, list[dict]]:
    """SEC 8-K: 기존 material_events + 당일 전문검색(기존 파일은 전날 새벽까지만 있다)."""
    from build_material_events import label_items  # 같은 item 라벨을 쓴다
    lo, hi = iso_shift(trade_date, -1), trade_date
    by: dict[str, list[dict]] = {t: [] for t in tickers}
    seen = set()

    def add(t, items, day, link, acc):
        if t not in by or acc in seen or not (lo <= day <= hi):
            return
        seen.add(acc)
        labels = " · ".join(i.get("label") for i in items if i.get("label"))[:120] or "주요 이벤트"
        by[t].append({"type": "disclosure", "title": f"SEC 8-K: {labels}", "link": link, "source": "SEC EDGAR", "date": day})

    for e in (load_json(ROOT / "data" / "material_events.json", {}) or {}).get("events") or []:
        add(str(e.get("ticker") or "").upper(), e.get("items") or [], str(e.get("fileDate") or ""), e.get("link") or "", e.get("accession"))
    try:
        _, ticker_to_cik = sec.company_ticker_maps()
        cik_to_t = {ticker_to_cik[t]: t for t in tickers if t in ticker_to_cik}
        hits, _partial = sec.efts_hits("8-K", lo, hi)
        for hit in hits:
            src = hit.get("_source", {})
            ciks = {int(c) for c in src.get("ciks", []) if str(c).isdigit()} & set(cik_to_t)
            if not ciks:
                continue
            cik = sorted(ciks)[0]
            acc = src.get("adsh") or hit["_id"].split(":")[0]
            doc = hit["_id"].split(":")[1] if ":" in hit.get("_id", "") else ""
            items, _hot = label_items(src.get("items"))
            link = f"https://www.sec.gov/Archives/edgar/data/{cik}/{acc.replace('-', '')}/{doc}"
            add(cik_to_t[cik], items, str(src.get("file_date") or ""), link, acc)
    except Exception as exc:
        print(f"  [경고] SEC 8-K 당일 조회 실패(기존 파일만 사용): {exc}")
    return by


def kr_disclosures(tickers: set[str], trade_date: str) -> dict[str, list[dict]]:
    """DART: 기존 kr_disclosures(하루 1회 15:30 갱신이라 당일분이 빠질 수 있다) + 종목별 list.json."""
    lo, hi = iso_shift(trade_date, -1), trade_date
    if date.fromisoformat(trade_date).weekday() == 0:
        lo = iso_shift(trade_date, -3)
    by: dict[str, list[dict]] = {t: [] for t in tickers}
    seen = set()

    def add(t, title, day, link):
        if t not in by or link in seen or not (lo <= day <= hi):
            return
        seen.add(link)
        by[t].append({"type": "disclosure", "title": f"DART: {title}"[:160], "link": link, "source": "DART", "date": day})

    for d in (load_json(ROOT / "data" / "kr_disclosures.json", {}) or {}).get("disclosures") or []:
        add(str(d.get("ticker") or "").zfill(6), d.get("title") or "", str(d.get("fileDate") or ""), d.get("link") or "")
    key = os.getenv("DART_API_KEY", "")
    if key:
        try:
            import build_kr_disclosures as dart
            corp = dart.load_corp_map(key)
            for t in sorted(tickers):
                cc = corp.get(t)
                if not cc:
                    continue
                data = dart.dart_get("list.json", {"corp_code": cc, "bgn_de": lo.replace("-", ""),
                                                   "end_de": hi.replace("-", ""), "page_count": "30"}, key)
                if str(data.get("status")) not in ("000", "013"):
                    print(f"  [경고] DART {t}: {data.get('status')} {data.get('message')}")
                    continue
                for row in data.get("list") or []:
                    rc = str(row.get("rcept_no") or "")
                    dt = str(row.get("rcept_dt") or "")
                    day = f"{dt[:4]}-{dt[4:6]}-{dt[6:8]}" if len(dt) == 8 else ""
                    add(t, str(row.get("report_nm") or "").strip(), day,
                        f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={rc}")
        except SystemExit as exc:  # status 020(한도) — 기존 파일분으로 계속
            print(f"  [경고] {exc}")
        except Exception as exc:
            print(f"  [경고] DART 당일 조회 실패(기존 파일만 사용): {exc}")
    else:
        print("  [안내] DART_API_KEY 없음 — 기존 kr_disclosures.json 만 사용")
    return by


# ---------------------------------------------------------------------------
# 3. 요약(Gemini) + 검증
# ---------------------------------------------------------------------------

def build_prompt(batch: list[dict], market: str, indices: list[dict], trade_date: str) -> str:
    idx = ", ".join(f"{i['name']} {i['changePct']:+.2f}%" for i in indices) or "정보 없음"
    lines = []
    for s in batch:
        word = "상승" if s["changePct"] > 0 else "하락"
        lines.append(f"\n[{s['ticker']}] {s['company']} · {word} {s['changePct']:+.2f}% · 업종 {s.get('industry') or s.get('sector')}")
        for e in s["_evidence"]:
            if e["type"] == "sector":
                continue  # 업종 동조는 코드가 따로 적는다 — LLM 에 맡기지 않는다
            lines.append(f"  {e['id']} ({TAG_OF[e['type']]}, {e.get('date') or '날짜 미상'}) {e['title']}")
    return f"""너는 증권 데이터 편집자다. 아래는 {trade_date} {MARKETS[market]['label']} 장에서 크게 움직인 종목과, 종목마다 수집된 뉴스 헤드라인·공시 제목이다.
지수: {idx}
{chr(10).join(lines)}

종목마다 아래 JSON 객체를 만든다. 규칙(절대 엄수):
- same_company: 인용하려는 근거가 정말 이 회사 얘기인지. 이름이 같은 다른 회사·게임·제품·인물이면 false.
- explains_move: 인용하려는 근거가 그날의 등락 **방향**을 설명하는지. 하락했는데 호재성 기사뿐이거나, 일반 시황·오래된 소식·단순 행사/IR 안내·정정 공시라는 사실뿐이면 false.
- 적정가치·저평가 분석, 주가 전망, "주목할 종목" 류의 의견 기사는 사유가 아니다(explains_move=false). 실적·가이던스·계약·제휴·규제·소송·등급/목표가 변경·지분 매매 같은 사건만 사유가 된다.
- 둘 중 하나라도 false 이거나 설명하는 근거가 없으면 reason 을 정확히 "{NO_MATERIAL}" 로, evidence 는 [] 로 둔다.
- reason: 근거 제목에 적힌 사실만으로 쓴 한국어 한 줄(40자 안팎, 최대 50자). 목록 밖의 사실·수치·전망·해석을 만들지 않는다. 종목명·등락률·"상승/하락" 은 쓰지 않는다. 명사형으로 끝내고 매수·매도 권유 금지.
- evidence: reason 을 뒷받침하는 근거 ID 1~3개(그 종목 목록에 있는 ID 만).
- 숫자는 근거 제목에 그대로 있는 것만 쓴다.

출력은 JSON 배열만: [{{"ticker": "...", "same_company": true, "explains_move": true, "reason": "...", "evidence": ["E1"]}}]"""


def call_gemini(prompt: str) -> tuple[str | None, str | None, str]:
    key = os.getenv("GEMINI_API_KEY", "")
    if not key:
        return None, None, "GEMINI_API_KEY 없음"
    body = {"contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2, "maxOutputTokens": 8192,
                                 # 2.5 계열은 사고 토큰이 출력 한도를 먹어 JSON 이 잘린다 — 한 줄 요약엔 필요 없다.
                                 "thinkingConfig": {"thinkingBudget": 0}}}
    last_err = ""
    # 분당 한도(429)는 같은 시각에 도는 브리핑과 겹칠 때 난다 — 모델마다 한 번 40초 쉬고 다시.
    for model in GEMINI_MODELS:
        for attempt in range(2):
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            # 키는 쿼리스트링이 아니라 헤더로(URL 은 예외 메시지·로그에 찍힌다).
            req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"),
                                         headers={"Content-Type": "application/json", "x-goog-api-key": key})
            code = None
            try:
                with urllib.request.urlopen(req, timeout=90) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                return text, model, ""
            except urllib.error.HTTPError as exc:
                code = exc.code
                last_err = f"{model} HTTP {exc.code}"
            except Exception as exc:
                last_err = f"{model} {type(exc).__name__}"
            print(f"  [경고] Gemini 실패: {last_err}")
            if code == 429 and attempt == 0:
                time.sleep(40)
                continue
            break
        time.sleep(2)
    return None, None, last_err


NUM_RE = re.compile(r"\d[\d,]*(?:\.\d+)?")


def _norm_num(s: str) -> str:
    return s.replace(",", "").rstrip("0").rstrip(".") if "." in s else s.replace(",", "")


def validate_llm_row(stock: dict, row: dict) -> tuple[str, list[dict], str]:
    """(status, 인용 근거, reason). status: ok | none | failed.

    - LLM 스스로 다른 회사 얘기거나(same_company) 방향을 설명 못 한다고(explains_move) 하면 none.
    - 인용 ID 가 그 종목 근거 목록에 없으면 실패(지어낸 출처).
    - 사유 문장의 숫자가 인용 근거 제목·등락률에 없으면 실패(지어낸 수치).
    """
    row = row or {}
    reason = clean_text(row.get("reason") or "").strip(" .\"'")
    ids = row.get("evidence") or []
    if not isinstance(ids, list) or not reason:
        return "failed", [], ""
    if NO_MATERIAL.replace(" ", "") in reason.replace(" ", ""):
        return "none", [], NO_MATERIAL
    if row.get("same_company") is False or row.get("explains_move") is False:
        return "none", [], NO_MATERIAL
    if len(reason) > 70:
        return "failed", [], ""
    by_id = {e["id"]: e for e in stock["_evidence"] if e["type"] != "sector"}
    cited = []
    for i in ids:
        e = by_id.get(str(i).strip())
        if e is None:
            return "failed", [], ""
        if e not in cited:
            cited.append(e)
    if not cited:
        return "failed", [], ""
    # 숫자는 그 종목 근거 목록 어디엔가 있으면 된다(198억·약 200억처럼 기사마다 표기가 다르다).
    pool = " ".join(e["title"] for e in stock["_evidence"] if e["type"] != "sector")
    pool_nums = {_norm_num(n) for n in NUM_RE.findall(pool)}
    pool_nums |= {_norm_num(f"{abs(stock['changePct']):.1f}"), _norm_num(f"{abs(stock['changePct']):.2f}")}
    for n in NUM_RE.findall(reason):
        if _norm_num(n) not in pool_nums:
            return "failed", [], ""
    return "ok", cited[:3], reason


def sector_reason(stock: dict, ctx: dict | None) -> str:
    word = "상승" if stock["changePct"] > 0 else "하락"
    if stock.get("_cluster"):
        return f"{stock['industry']} 업종 동반 {word}({'·'.join(stock['_cluster'][:2])} 등)"
    return f"{ctx['name']} {ctx['level']} 동반 {word}(시총가중 평균 {ctx['avgPct']:+.1f}%)"


def finalize(stock: dict, status: str, reason: str, cited: list[dict]) -> dict:
    """reasonStatus: ok(재료 요약) · sector(업종 동조만) · none(재료 없음) · failed(요약 실패).

    업종 동조 문구는 LLM 이 아니라 스냅샷 수치로 코드가 쓴다(sectorNote) — 화면은 이것을
    사유보다 먼저 보여 준다.
    """
    has_sync = any(e["type"] == "sector" for e in stock["_evidence"])
    sector_note = sector_reason(stock, stock.get("_sector")) if has_sync else ""
    if status == "none" and sector_note:
        status, reason = "sector", sector_note
    tags = ["섹터동조"] if sector_note else []
    for e in cited:
        tag = TAG_OF[e["type"]]
        if tag not in tags:
            tags.append(tag)
    if status == "none":
        tags = ["불명"]
    out = {k: v for k, v in stock.items() if not k.startswith("_")}
    out.update({
        "reason": reason if status != "failed" else "",
        "reasonStatus": status,
        "sectorNote": sector_note,
        "tags": tags if status != "failed" else (["섹터동조"] if sector_note else []),
        "evidence": [{k: e[k] for k in ("type", "title", "link", "source", "date") if k in e}
                     for e in cited if e["type"] != "sector" and e.get("link")][:3],
    })
    if stock.get("_sector"):
        out["sectorMove"] = stock["_sector"]
    return out


def summarize(movers: dict, market: str, indices: list[dict], trade_date: str, use_llm: bool):
    """종목별 사유 확정. LLM 은 뉴스·공시 근거가 있는 종목에만."""
    all_stocks = movers["up"] + movers["down"]
    need_llm = []
    results: dict[str, dict] = {}
    for s in all_stocks:
        ev = s["_evidence"]
        material = [e for e in ev if e["type"] in ("news", "disclosure")]
        if not material:
            results[s["ticker"]] = finalize(s, "none", NO_MATERIAL, [])
            continue
        need_llm.append(s)

    calls, models, errors = 0, set(), []
    for i in range(0, len(need_llm), LLM_BATCH):
        batch = need_llm[i:i + LLM_BATCH]
        rows = {}
        if use_llm and calls < MAX_LLM_CALLS:
            calls += 1
            text, model, err = call_gemini(build_prompt(batch, market, indices, trade_date))
            if model:
                models.add(model)
            if err:
                errors.append(err)
            try:
                parsed = json.loads(text) if text else []
                if isinstance(parsed, dict):
                    parsed = parsed.get("items") or parsed.get("results") or []
                rows = {str(r.get("ticker")).strip(): r for r in parsed if isinstance(r, dict)}
            except Exception:
                errors.append("JSON 파싱 실패")
                print(f"  [경고] Gemini 응답 JSON 파싱 실패: {(text or '')[:200]!r}")
                rows = {}
        for s in batch:
            row = rows.get(s["ticker"]) or rows.get(s["ticker"].upper())
            status, cited, reason = validate_llm_row(s, row) if row else ("failed", [], "")
            if status == "failed" and use_llm:
                print(f"  [검증 실패] {s['ticker']}: {json.dumps(row, ensure_ascii=False)[:240] if row else '응답 없음'}")
            results[s["ticker"]] = finalize(s, status, reason, cited)
    meta = {"llmCalls": calls, "llmStocks": len(need_llm), "models": sorted(models), "errors": errors[:5]}
    return {side: [results[s["ticker"]] for s in movers[side]] for side in ("up", "down")}, meta


# ---------------------------------------------------------------------------

def build(market: str, *, use_llm: bool, force: bool) -> tuple[dict | None, int]:
    cfg = MARKETS[market]
    snap = load_json(cfg["snapshot"])
    if not snap or not snap.get("stocks"):
        print("[특징주] 스냅샷을 읽지 못했다 — 기존 파일 유지")
        return None, 1
    trade_date = resolve_trade_date(snap, cfg, market)
    if not trade_date:
        print("[특징주] 거래일을 정하지 못했다(일봉 없음) — 기존 파일 유지")
        return None, 1
    prev = load_json(cfg["out_json"], {}) or {}
    if not force and prev.get("tradeDate"):
        if prev["tradeDate"] > trade_date:
            print(f"[특징주] 스냅샷 거래일 {trade_date} 이 기존 보드({prev['tradeDate']})보다 오래됐다 — 건너뜀")
            return None, 0
        if prev["tradeDate"] == trade_date and prev.get("status") == "ok":
            print(f"[특징주] {trade_date} 보드가 이미 정상 발행돼 있다 — LLM 호출 없이 종료")
            return None, 0
        # 요약이 일부 실패한 보드는 다음 실행에서 한 번 더 시도한다(주말·연휴에도 도는
        # 워크플로우라 무한 재시도가 되지 않게 거래일당 최대 2회).
        if prev["tradeDate"] == trade_date and int(prev.get("attempt") or 1) >= 2:
            print(f"[특징주] {trade_date} 보드는 이미 2회 시도했다({prev.get('status')}) — 건너뜀")
            return None, 0
    attempt = int(prev.get("attempt") or 1) + 1 if prev.get("tradeDate") == trade_date else 1
    print(f"[특징주] {cfg['label']} 거래일 {trade_date}")

    movers = pick_movers(snap, cfg, market, trade_date)
    print(f"  상승 {len(movers['up'])} · 하락 {len(movers['down'])}")
    all_stocks = movers["up"] + movers["down"]
    if not all_stocks:
        # 조용한 날일 수 있다 — 빈 보드를 '정상'으로 발행한다(0건 방어는 allow_empty).
        print("  기준을 넘는 종목이 없다")
    tickers = {s["ticker"] for s in all_stocks}
    disc = (kr_disclosures if market == "kr" else us_disclosures)(tickers, trade_date) if tickers else {}
    indices = index_moves(snap, market)

    clusters = board_clusters(movers)
    for s in all_stocks:
        ctx = sector_context(snap, cfg, market, s)
        s["_sector"] = ctx
        ev = []
        if sector_is_sync(s, ctx):
            ev.append({"type": "sector", "title": f"같은 {ctx['level']}({ctx['name']}) {ctx['n']}종목 시총가중 평균 {ctx['avgPct']:+.1f}%",
                       "link": "", "source": "스냅샷", "date": trade_date})
        elif s["ticker"] in clusters:
            mates = clusters[s["ticker"]]
            word = "상승" if s["changePct"] > 0 else "하락"
            ev.append({"type": "sector", "title": f"같은 업종({s['industry']}) 특징주 {len(mates) + 1}종목 동반 {word}: "
                       + "·".join(short_company(m["company"]) for m in mates[:4]),
                       "link": "", "source": "스냅샷", "date": trade_date})
            s["_cluster"] = [short_company(m["company"]) if market == "us" else m["company"] for m in mates]
        ev += (disc.get(s["ticker"]) or [])[:MAX_DISC_PER_STOCK]
        ev += collect_news(s, market, trade_date)
        time.sleep(0.4)
        for i, e in enumerate(ev, 1):
            e["id"] = f"E{i}"
        s["_evidence"] = ev
        print(f"  {s['ticker']:>8} {s['changePct']:+6.2f}%  근거 {len(ev)}"
              f" (공시 {sum(e['type'] == 'disclosure' for e in ev)} · 뉴스 {sum(e['type'] == 'news' for e in ev)}"
              f"{' · 업종동조' if ev and ev[0]['type'] == 'sector' else ''})")

    boards, meta = summarize(movers, market, indices, trade_date, use_llm)
    rows = boards["up"] + boards["down"]
    failed = sum(r["reasonStatus"] == "failed" for r in rows)
    status = "ok" if not failed else ("llm_failed" if failed == meta["llmStocks"] and failed else "partial")
    if not use_llm and meta["llmStocks"]:
        status = "no_llm"
    payload = {
        "market": market,
        "tradeDate": trade_date,
        "updatedAtKst": now_kst(),
        "status": status,
        "attempt": attempt,
        "count": len(rows),
        "criteria": f"{cfg['criteria']} · 등락률 ±{MIN_ABS_MOVE:g}% 이상 · 방향별 최대 {TOP_N}종목",
        "source": ("DART · 네이버 뉴스/Google News · 시장 스냅샷" if market == "kr"
                   else "SEC 8-K · Google News · Yahoo · 시장 스냅샷"),
        "note": "공시·뉴스 헤드라인·업종 평균만을 근거로 한 자동 요약이라 틀릴 수 있다. "
                "근거가 없으면 '뚜렷한 재료 확인 안 됨', 요약이 검증을 통과하지 못하면 '요약 실패'. 매매 신호가 아니다.",
        "llm": meta,
        "indexMoves": indices,
        "up": boards["up"],
        "down": boards["down"],
    }
    print(f"  요약: LLM {meta['llmCalls']}회({meta['llmStocks']}종목) · 실패 {failed} · 상태 {status}")
    return payload, (1 if status == "llm_failed" else 0)


def main() -> int:
    ap = argparse.ArgumentParser(description="오늘의 특징주(사유 한 줄)")
    ap.add_argument("--market", choices=sorted(MARKETS), required=True)
    ap.add_argument("--push", action="store_true")
    ap.add_argument("--force", action="store_true", help="같은 거래일 보드가 있어도 다시 만든다")
    ap.add_argument("--no-llm", action="store_true", help="요약 없이 근거만(파일은 쓰지 않는다)")
    args = ap.parse_args()
    load_env()
    cfg = MARKETS[args.market]
    payload, code = build(args.market, use_llm=not args.no_llm, force=args.force)
    if payload is None:
        return code
    if args.no_llm:
        print(json.dumps(payload, ensure_ascii=False, indent=1)[:4000])
        print("[특징주] --no-llm: 파일을 쓰지 않는다")
        return 0
    with repository_publish_lock(ROOT):
        sec.write_data(cfg["out_json"], cfg["out_js"], "MOVERS_REASONS", payload, allow_empty=True)
        print(f"[특징주] 저장: {cfg['out_json'].relative_to(ROOT).as_posix()}")
        if args.push:
            rel = [p.relative_to(ROOT).as_posix() for p in (cfg["out_json"], cfg["out_js"])]
            if not sec.git_publish(rel, f"movers reasons ({args.market})"):
                return 1
    return code


if __name__ == "__main__":
    raise SystemExit(main())
