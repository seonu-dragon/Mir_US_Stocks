#!/usr/bin/env python3
"""미국 애널리스트 의견 변경 · EPS 추정치 변화 (build_us_analyst_revisions.py)
=========================================================================

한 번의 야후 quoteSummary 호출(modules=upgradeDowngradeHistory,earningsTrend)로 두 파일을 만든다.

1) data/us_rating_changes.{json,js} — window.US_RATING_CHANGES
   최근 30일 증권사 의견 변경(상향·하향·신규·유지·재확인)과 목표가 조정. 시그널 탭 위젯이 읽는다.
   rows: [[티커, 날짜, 증권사, 행동, 이전 의견, 새 의견, 새 목표가, 이전 목표가, 목표가 행동]]
   (행동 up/down/init/main/reit 은 야후 원문 코드, 날짜는 미 동부 기준 YYYY-MM-DD)
2) data/us_estimate_revisions.{json,js} — window.US_ESTIMATE_REVISIONS
   기간별(이번 분기 0q · 다음 분기 +1q · 올해 회계연도 0y · 내년 +1y) 컨센서스 EPS 의 현재·7·30·60·90일 전 값,
   최근 7·30일 추정치를 올린/내린 애널리스트 수, 추정 애널리스트 수 + 종목별 최근 의견 변경 8건.
   종목 상세 '실적 추정치 변화' 카드와 시그널 탭 'EPS 추정치 변화' 위젯이 읽는다. 예전 카드는 브라우저가
   방문할 때마다 localStorage 에 쌓은 값이라 처음 보는 사람에겐 늘 '비교 기록 쌓는 중'이었다.

소스: Yahoo Finance quoteSummary(크럼 인증 — us_calendar·옵션 심리 빌더와 같은 방식, 키 없음).
대상: 미국 스냅샷 시가총액 상위 N(ETF 제외, 기본 800).
실패 처리: 크럼 인증 실패 또는 응답 70% 미만이면 파일을 건드리지 않고 exit 1.
실행:  py scripts/build_us_analyst_revisions.py [--top 800] [--push]
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.parse
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

SNAPSHOT = ROOT / "data" / "market_snapshot.json"
OUT_JSON = ROOT / "data" / "us_estimate_revisions.json"
OUT_JS = ROOT / "data" / "us_estimate_revisions.js"
OUT_RATINGS_JSON = ROOT / "data" / "us_rating_changes.json"
OUT_RATINGS_JS = ROOT / "data" / "us_rating_changes.js"
KST = timezone(timedelta(hours=9))
MODULES = "upgradeDowngradeHistory,earningsTrend"
PERIODS = ("0q", "+1q", "0y", "+1y")
FEED_DAYS = 30
TICKER_HISTORY = 8
EST_COLS = ["period", "end", "cur", "d7", "d30", "d60", "d90", "up7", "up30", "dn7", "dn30", "n"]
RATING_COLS = ["t", "d", "firm", "act", "from", "to", "pt", "ptPrev", "ptAct"]


def kst_now_str() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def et_date(epoch: int) -> str:
    """UTC 초 → 미 동부 날짜. zoneinfo 가 없으면(윈도 tzdata 미설치) 3월 둘째 일요일~11월 첫 일요일 규칙."""
    utc = datetime.fromtimestamp(int(epoch), tz=timezone.utc)
    try:
        from zoneinfo import ZoneInfo
        return utc.astimezone(ZoneInfo("America/New_York")).date().isoformat()
    except Exception:
        y = utc.year
        mar = datetime(y, 3, 8, 7, tzinfo=timezone.utc)
        dst_start = mar + timedelta(days=(6 - mar.weekday()) % 7)
        nov = datetime(y, 11, 1, 6, tzinfo=timezone.utc)
        dst_end = nov + timedelta(days=(6 - nov.weekday()) % 7)
        off = -4 if dst_start <= utc < dst_end else -5
        return (utc + timedelta(hours=off)).date().isoformat()


def _raw(node):
    if isinstance(node, dict):
        v = node.get("raw")
        return v if isinstance(v, (int, float)) else None
    return node if isinstance(node, (int, float)) else None


def _r(v, nd=4):
    return None if v is None else round(float(v), nd)


def parse_estimates(result: dict) -> list[list]:
    """quoteSummary result → 기간별 [period, end, cur, d7, d30, d60, d90, up7, up30, dn7, dn30, n]."""
    out = []
    for tr in ((result or {}).get("earningsTrend") or {}).get("trend") or []:
        period = tr.get("period")
        if period not in PERIODS:
            continue
        et = tr.get("epsTrend") or {}
        rv = tr.get("epsRevisions") or {}
        cur = _raw(et.get("current"))
        if cur is None:
            continue
        n = _raw((tr.get("earningsEstimate") or {}).get("numberOfAnalysts"))
        out.append([period, tr.get("endDate") or None, _r(cur), _r(_raw(et.get("7daysAgo"))),
                    _r(_raw(et.get("30daysAgo"))), _r(_raw(et.get("60daysAgo"))), _r(_raw(et.get("90daysAgo"))),
                    _raw(rv.get("upLast7days")), _raw(rv.get("upLast30days")),
                    _raw(rv.get("downLast7Days")) if rv.get("downLast7Days") is not None else _raw(rv.get("downLast7days")),
                    _raw(rv.get("downLast30days")), int(n) if isinstance(n, (int, float)) else None])
    out.sort(key=lambda r: PERIODS.index(r[0]))
    return out


def parse_ratings(result: dict, ticker: str) -> list[list]:
    """quoteSummary result → [[t, d, firm, act, from, to, pt, ptPrev, ptAct]] 최신순."""
    rows = []
    for h in ((result or {}).get("upgradeDowngradeHistory") or {}).get("history") or []:
        ts = h.get("epochGradeDate")
        firm = str(h.get("firm") or "").strip()
        if not isinstance(ts, (int, float)) or not firm:
            continue
        pt = h.get("currentPriceTarget")
        pp = h.get("priorPriceTarget")
        pt = round(float(pt), 2) if isinstance(pt, (int, float)) and pt > 0 else None
        pp = round(float(pp), 2) if isinstance(pp, (int, float)) and pp > 0 else None
        rows.append([ticker, et_date(ts), firm, str(h.get("action") or ""), str(h.get("fromGrade") or ""),
                     str(h.get("toGrade") or ""), pt, pp, str(h.get("priceTargetAction") or "")])
    rows.sort(key=lambda r: r[1], reverse=True)
    return rows


def universe(top: int) -> list[str]:
    snap = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    rows = [s for s in snap.get("stocks") or [] if s.get("ticker") and s.get("sector") not in ("EXCHANGE TRADED FUNDS", "ETF")]
    rows.sort(key=lambda s: float(s.get("marketCapB") or 0), reverse=True)
    return [str(s["ticker"]).upper() for s in rows[:top]]


def build(top: int, pause: float = 0.25):
    from build_us_dividends_calendar import Yahoo
    y = Yahoo()
    if not y.auth():
        print("[error] 야후 크럼 인증 실패 — 기존 파일 유지")
        return None
    tickers = universe(top)
    today_et = et_date(int(time.time()))
    cutoff = (datetime.strptime(today_et, "%Y-%m-%d") - timedelta(days=FEED_DAYS)).date().isoformat()
    est = {}
    feed = []
    ok = 0
    for i, t in enumerate(tickers, 1):
        sym = t.replace(".", "-")
        url = (f"https://query1.finance.yahoo.com/v10/finance/quoteSummary/{urllib.parse.quote(sym)}"
               f"?modules={MODULES}&crumb={urllib.parse.quote(y.crumb)}")
        result = None
        for attempt in range(2):
            try:
                d = json.loads(y._get(url, timeout=25))
                res = (d.get("quoteSummary") or {}).get("result") or []
                result = res[0] if res else {}
                break
            except Exception as exc:
                if getattr(exc, "code", None) == 404:
                    result = {}
                    break
                if attempt == 0 and getattr(exc, "code", None) == 401 and y.auth():
                    url = url.split("&crumb=")[0] + f"&crumb={urllib.parse.quote(y.crumb)}"
                    continue
                time.sleep(1.5)
        time.sleep(pause)
        if result is None:
            continue
        ok += 1
        periods = parse_estimates(result)
        ratings = parse_ratings(result, t)
        if periods or ratings:
            est[t] = {"p": periods, "r": [r[1:8] for r in ratings[:TICKER_HISTORY]]}
        feed.extend(r for r in ratings if r[1] >= cutoff)
        if i % 100 == 0:
            print(f"  {i}/{len(tickers)} · 응답 {ok} · 추정치 {sum(1 for v in est.values() if v['p'])}종목 · 30일 의견 {len(feed)}건")
    if not tickers or ok < len(tickers) * 0.7:
        print(f"[error] 응답 {ok}/{len(tickers)} — 70% 미만이라 기존 파일 유지")
        return None
    feed.sort(key=lambda r: r[0])                 # 같은 날 안에서는 티커순
    feed.sort(key=lambda r: r[1], reverse=True)   # 최신 날짜 먼저(안정 정렬)
    now = kst_now_str()
    est_payload = {"updatedAtKst": now, "source": "Yahoo Finance (earningsTrend · upgradeDowngradeHistory)",
                   "scanned": len(tickers), "count": sum(1 for v in est.values() if v["p"]),
                   "cols": EST_COLS, "ratingCols": RATING_COLS[1:8], "tickers": dict(sorted(est.items()))}
    rating_payload = {"updatedAtKst": now, "source": "Yahoo Finance (upgradeDowngradeHistory)", "asOf": today_et,
                      "windowDays": FEED_DAYS, "scanned": len(tickers), "count": len(feed), "cols": RATING_COLS, "rows": feed}
    return est_payload, rating_payload


def main() -> int:
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
            sys.stderr.reconfigure(encoding="utf-8")
        except Exception:
            pass
    ap = argparse.ArgumentParser(description="미국 애널리스트 의견 변경 · EPS 추정치 변화(Yahoo)")
    ap.add_argument("--top", type=int, default=800)
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()
    print(f"=== 애널리스트 의견·추정치 수집 (시총 상위 {args.top}) ===")
    built = build(args.top)
    if not built:
        return 1
    est_payload, rating_payload = built
    if est_payload["count"] < 50:
        print(f"[error] 추정치 종목 {est_payload['count']}개 — 소스 이상으로 보고 기존 파일 유지")
        return 1
    from sec_client import write_data, git_publish
    from briefing_store import repository_publish_lock
    with repository_publish_lock(ROOT):
        write_data(OUT_JSON, OUT_JS, "US_ESTIMATE_REVISIONS", est_payload, indent=None, min_ratio=0.7)
        write_data(OUT_RATINGS_JSON, OUT_RATINGS_JS, "US_RATING_CHANGES", rating_payload, indent=None)
        print(f"→ 추정치 {est_payload['count']}종목 · 30일 의견 변경 {rating_payload['count']}건")
        if args.push:
            rel = ["data/us_estimate_revisions.json", "data/us_estimate_revisions.js",
                   "data/us_rating_changes.json", "data/us_rating_changes.js"]
            if not git_publish(rel, "US analyst revisions (Yahoo)"):
                return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
