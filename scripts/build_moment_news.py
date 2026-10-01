"""차트 '큰 등락일'(키 모먼트) 그날 뉴스 — 주요 종목만 미리 모아 둔다 (US·KR).

    py scripts/build_moment_news.py --market all --push          # moment-news.yml (매일)
    py scripts/build_moment_news.py --market us --max-queries 20 # 로컬 확인(파일은 쓴다, 푸시 안 함)
    py scripts/build_moment_news.py --market all --dry-run       # 검색 없이 대상·밀린 건수만

왜: 차트 ▲▼ 를 누르면 워커(?event_news)가 그날 기사를 찾는데, Cloudflare 에서는 구글 뉴스·GDELT 가
시간 초과로 막히고(2026-10-01 진단 diag) Finnhub 는 미국 최근 1년뿐이라 오래된 날짜·국내 종목은 0건이었다.
GitHub Actions 에서는 구글 뉴스 RSS 가 잘 되므로(특징주 빌더와 같은 경로) 여기서 미리 모아 커밋한다.

대상: 미국 시총 상위 US_TOP · 국내 상위 KR_TOP (ETF·스팩 제외). 큰 등락일은 화면(timeline-core.js
keyMoments)과 같은 규칙 — 그날 종가 등락률이 직전 60거래일 하루 등락률 표준편차의 2.5배 이상이고 3% 이상 —
으로 상세 일봉(data/details · data/korea/details)에서 최근 YEARS 년만 뽑는다.
기사: 구글 뉴스 RSS 날짜 검색(그날 ±2일), 제목에 회사명/티커가 있는 것만, 날짜당 최대 PER_MOMENT 건.
제목·출처·링크·날짜만 저장한다(요약·해석 없음). 구글 뉴스 링크는 길어서(약 260자) 고정 앞뒤를 빼고
"g:<기사ID>" 로 저장한다 — 화면(timeline.js)이 https://news.google.com/rss/articles/<ID>?oc=5 로 되돌린다. 찾지 못한 날짜도 [] 로 남겨 다시 묻지 않는다.

산출: data/moment_news/<us|kr>_<00..63>.json — {"t": {티커: {날짜: [[제목, 출처, 링크, 기사날짜], …]}}}
샤드는 zlib.crc32(티커) % SHARDS(이벤트 스터디 종목 샤드와 같은 해시 — timeline.js 가 같은 값을 계산한다).
처음엔 밀린 날짜가 수천 건이라 실행마다 --max-queries 만큼(최근 날짜부터) 채우고, 구글이 연속으로 거절하면
그 실행은 거기서 멈춘다(받은 것까지는 저장).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zlib
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import build_movers_reasons as mv  # noqa: E402  (구글 뉴스 RSS 파싱·제목 매칭·ETF 제외를 같이 쓴다)
import sec_client as sec  # noqa: E402
from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402

KST = ZoneInfo("Asia/Seoul")
OUT_DIR = ROOT / "data" / "moment_news"
# 진행 요약 인덱스(종목·큰 등락일·수집·남은 건수). 샤드는 이벤트 스터디처럼 직접 쓰고, 인덱스는 write_data
# (0건 방어)로 마지막에 쓴다. 화면은 샤드만 읽는다 — 인덱스는 진행 확인·신선도용.
OUT_JSON = OUT_DIR / "index.json"
OUT_JS = OUT_DIR / "index.js"
SHARDS = 64
US_TOP = 500
KR_TOP = 200
YEARS = 3
PER_MOMENT = 3
WINDOW_DAYS = 2
# 화면(timeline-core.js MOMENT_DEFAULTS)과 같은 값이어야 같은 날짜에 ▲▼ 가 뜬다.
LOOKBACK, MIN_HIST, K_SIGMA, MIN_ABS_PCT = 60, 20, 2.5, 3.0
SLEEP_S = 0.8
MAX_FAIL_STREAK = 5

MARKETS = {
    "us": {"cfg": mv.MARKETS["us"], "top": US_TOP, "tz": ZoneInfo("America/New_York")},
    "kr": {"cfg": mv.MARKETS["kr"], "top": KR_TOP, "tz": KST},
}


def shard_of(ticker: str) -> int:
    return zlib.crc32(str(ticker).encode("utf-8")) % SHARDS


def shard_path(market: str, i: int) -> Path:
    return OUT_DIR / f"{market}_{i:02d}.json"


# ---------------------------------------------------------------------------
# 대상 · 큰 등락일
# ---------------------------------------------------------------------------

def universe(market: str) -> list[dict]:
    m = MARKETS[market]
    snap = mv.load_json(m["cfg"]["snapshot"], {}) or {}
    stocks = [s for s in snap.get("stocks") or []
              if not mv.is_excluded(s, m["cfg"], market) and (mv.fnum(s.get("marketCapB")) or 0) > 0]
    stocks.sort(key=lambda s: -float(s["marketCapB"]))
    return stocks[: m["top"]]


def key_moments(series: list, since: str) -> list[dict]:
    """timeline-core.js keyMoments 와 같은 판정. series = 상세 chartSeries([o,h,l,c,v,date])."""
    rows = []
    for r in series or []:
        try:
            c, d = float(r[3]), str(r[5])[:10]
        except (TypeError, ValueError, IndexError):
            continue
        if c > 0 and re.fullmatch(r"\d{4}-\d{2}-\d{2}", d):
            rows.append((d, c))
    out = []
    n = len(rows)
    if n < MIN_HIST + 2:
        return out
    ret = [None] * n
    for i in range(1, n):
        ret[i] = (rows[i][1] / rows[i - 1][1] - 1) * 100
    for i in range(1, n):
        r = ret[i]
        if r is None or rows[i][0] < since:
            continue
        hist = [x for x in ret[max(1, i - LOOKBACK):i] if x is not None]
        if len(hist) < MIN_HIST:
            continue
        mean = sum(hist) / len(hist)
        sd = (sum((x - mean) ** 2 for x in hist) / (len(hist) - 1)) ** 0.5
        if sd > 0 and abs(r) / sd >= K_SIGMA and abs(r) >= MIN_ABS_PCT:
            out.append({"date": rows[i][0], "pct": round(r, 2)})
    return out


# ---------------------------------------------------------------------------
# 기사 검색
# ---------------------------------------------------------------------------

class Blocked(Exception):
    pass


def google_rss(query: str, market: str) -> list[dict]:
    loc = {"hl": "ko", "gl": "KR", "ceid": "KR:ko"} if market == "kr" else {"hl": "en-US", "gl": "US", "ceid": "US:en"}
    url = "https://news.google.com/rss/search?" + urllib.parse.urlencode({"q": query, **loc})
    req = urllib.request.Request(url, headers={**mv.UA, "Accept": "application/rss+xml, application/xml, text/xml"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return mv.parse_rss(resp.read().decode("utf-8", "replace"))
    except urllib.error.HTTPError as exc:
        raise Blocked(f"HTTP {exc.code}") from exc
    except Exception as exc:  # 네트워크 오류도 연속되면 멈춘다
        raise Blocked(type(exc).__name__) from exc


GOOGLE_ARTICLE = re.compile(r"^https://news\.google\.com/rss/articles/([A-Za-z0-9_\-]+)\?oc=5$")


def compact_link(link: str) -> str:
    m = GOOGLE_ARTICLE.match(link or "")
    return f"g:{m.group(1)}" if m else (link or "")


def search_moment(stock: dict, market: str, day: str) -> list[list[str]]:
    d = date.fromisoformat(day)
    after, before = (d - timedelta(days=WINDOW_DAYS + 1)).isoformat(), (d + timedelta(days=WINDOW_DAYS + 1)).isoformat()
    if market == "kr":
        query = f'"{stock["company"]}" after:{after} before:{before}'
    else:
        short = mv.short_company(stock["company"])
        ident = f'("{short}" OR "{stock["ticker"]}")' if short and short.upper() != stock["ticker"] else f'"{stock["ticker"]}"'
        query = f"{ident} stock after:{after} before:{before}"
    terms = mv.name_terms(stock, market)
    tz = MARKETS[market]["tz"]
    lo, hi = d - timedelta(days=WINDOW_DAYS), d + timedelta(days=WINDOW_DAYS)
    picked, seen = [], set()
    for n in google_rss(query, market):
        pub = n.get("pub")
        if pub is None:
            continue
        pd = pub.astimezone(tz).date()
        if not (lo <= pd <= hi) or not mv.title_mentions(n["title"], terms):
            continue
        key = re.sub(r"[^0-9a-z가-힣]", "", n["title"].lower())[:60]
        if key in seen:
            continue
        seen.add(key)
        picked.append((abs((pd - d).days), [n["title"][:200], str(n.get("source") or "")[:60], compact_link(n["link"]), pd.isoformat()]))
    picked.sort(key=lambda x: x[0])  # 그날에 가까운 기사부터(같은 거리면 검색 순서)
    return [row for _, row in picked[:PER_MOMENT]]


# ---------------------------------------------------------------------------

def load_shards(market: str) -> dict[int, dict]:
    out = {}
    for i in range(SHARDS):
        d = mv.load_json(shard_path(market, i), {}) or {}
        out[i] = d.get("t") or {}
    return out


def build_market(market: str, *, max_queries: int, dry_run: bool, since: str) -> tuple[list[Path], int, bool, dict]:
    """(바뀐 샤드 경로, 이번에 물은 횟수, 막혔는지, 진행 요약)."""
    cfg = MARKETS[market]["cfg"]
    stocks = universe(market)
    shards = load_shards(market)
    keep = {s["ticker"] for s in stocks}
    pending = []
    total_moments = 0
    for s in stocks:
        detail = mv.load_json(cfg["details"] / f"{s['ticker']}.json", {}) or {}
        moments = key_moments(detail.get("chartSeries") or [], since)
        total_moments += len(moments)
        have = shards[shard_of(s["ticker"])].get(s["ticker"]) or {}
        for m in moments:
            if m["date"] not in have:
                pending.append((m["date"], -float(s["marketCapB"]), s, m))
    pending.sort(key=lambda x: (x[0], -x[1]), reverse=True)  # 최근 날짜부터, 같은 날은 시총 큰 순
    print(f"[moment-news] {market}: 대상 {len(stocks)}종목 · 큰 등락일 {total_moments}건 · 밀린 {len(pending)}건")
    summary = {"tickers": len(stocks), "moments": total_moments, "pending": len(pending)}
    if dry_run:
        return [], 0, False, summary
    touched: set[int] = set()
    asked, found, fail_streak, blocked = 0, 0, 0, False
    for day, _, s, _m in pending:
        if asked >= max_queries:
            break
        try:
            rows = search_moment(s, market, day)
            fail_streak = 0
        except Blocked as exc:
            fail_streak += 1
            print(f"  [경고] 구글 뉴스 거절 {s['ticker']} {day}: {exc} (연속 {fail_streak})")
            if fail_streak >= MAX_FAIL_STREAK:
                print("  구글 뉴스가 연속으로 거절해 이번 실행은 여기서 멈춘다(받은 것까지 저장)")
                blocked = True
                break
            time.sleep(SLEEP_S * 4)
            continue
        asked += 1
        found += bool(rows)
        i = shard_of(s["ticker"])
        shards[i].setdefault(s["ticker"], {})[day] = rows
        touched.add(i)
        time.sleep(SLEEP_S)
    # 대상에서 빠진 종목·기간 밖 날짜는 정리한다(파일이 끝없이 커지지 않게).
    for i, t in shards.items():
        for tk in list(t):
            if tk not in keep:
                del t[tk]
                touched.add(i)
                continue
            old = [d for d in t[tk] if d < since]
            for d in old:
                del t[tk][d]
            if old:
                touched.add(i)
    paths = []
    now = datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")
    for i in sorted(touched):
        p = shard_path(market, i)
        payload = {"v": 1, "market": market, "shard": i, "shards": SHARDS, "updatedAtKst": now, "t": shards[i]}
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        atomic_write_text(p, json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")
        paths.append(p)
    summary.update({"pending": max(0, len(pending) - asked), "askedThisRun": asked, "foundThisRun": found, "blocked": blocked})
    print(f"[moment-news] {market}: 이번 검색 {asked}건(기사 찾음 {found}) · 남은 {summary['pending']}건 · 샤드 {len(paths)}개 저장")
    return paths, asked, blocked, summary


def main() -> int:
    ap = argparse.ArgumentParser(description="큰 등락일 그날 뉴스 미리 모으기")
    ap.add_argument("--market", choices=["us", "kr", "all"], default="all")
    ap.add_argument("--max-queries", type=int, default=1200, help="실행당 검색 상한(시장별)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()
    since = (datetime.now(KST).date() - timedelta(days=365 * YEARS)).isoformat()
    markets = ["us", "kr"] if args.market == "all" else [args.market]
    changed, any_blocked, asked_total = [], False, 0
    prev = (mv.load_json(OUT_JSON, {}) or {}).get("markets") or {}
    summaries = dict(prev)
    with repository_publish_lock(ROOT):
        for m in markets:
            paths, asked, blocked, summary = build_market(m, max_queries=args.max_queries, dry_run=args.dry_run, since=since)
            changed += paths
            asked_total += asked
            any_blocked |= blocked
            summaries[m] = summary
        if args.dry_run:
            return 0
        index = {
            "updatedAtKst": datetime.now(KST).strftime("%Y-%m-%d %H:%M KST"),
            "shards": SHARDS, "years": YEARS, "perMoment": PER_MOMENT, "windowDays": WINDOW_DAYS,
            "universe": {"us": US_TOP, "kr": KR_TOP}, "markets": summaries,
        }
        sec.write_data(OUT_JSON, OUT_JS, "MOMENT_NEWS_INDEX", index, indent=None)
        changed += [OUT_JSON, OUT_JS]
        if args.push and changed:
            rel = [p.relative_to(ROOT).as_posix() for p in changed]
            if not sec.git_publish(rel, "moment news"):
                return 1
    # 첫 검색부터 막혔으면(하나도 못 받음) 실패로 알린다. 일부라도 받았으면 다음 실행이 이어 받는다.
    if any_blocked and asked_total == 0 and not args.dry_run:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
