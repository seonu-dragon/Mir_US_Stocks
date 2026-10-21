#!/usr/bin/env python3
"""미국 다크풀(ATS) 주간 거래 비중 — FINRA OTC Transparency 'weeklySummary'(키 없음).

FINRA 는 대체거래시스템(ATS, 흔히 '다크풀')의 종목별 주간 체결 주식 수를 공개한다(ATS_W_SMBL = 모든 ATS 합계).
공개는 늦다 — NMS Tier 1(대형주)은 약 3주, Tier 2 는 약 5주 뒤에 나온다. 이 빌더는 티어별로 공개된 가장 최근
주부터 KEEP_WEEKS 주를 받아, 그 주 전체 거래량(상세 파일 data/details/<T>.json 일봉 거래량의 월~금 합 = 통합
체결량)으로 나눠 'ATS 비중(%)'을 만든다. 한 주가 1~2페이지라 매 실행 전부 다시 받는다(상태 파일 없음).

비중은 통합 거래량 대비 ATS 체결 비율일 뿐 매수·매도 방향은 없다(FINRA 가 주지 않는다).

실행: py scripts/build_finra_ats.py [--push]
출력: data/finra_ats.json + .js(window.FINRA_ATS)
  { updatedAtKst, source, latest: {T1, T2}, weeks: {T1: [주 시작일 × KEEP_WEEKS, 오래된 → 최근], T2: [...]},
    cols: ["tier", "ats", "pct"],
    tickers: { T: [티어("T1"|"T2"), 최근 주 ATS 주식수, [주별 비중% | null …(weeks[티어] 와 같은 순서)]] } }
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

if sys.platform == "win32":
    for _s in (sys.stdout, sys.stderr):
        try:
            _s.reconfigure(encoding="utf-8")
        except Exception:
            pass

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

KST = timezone(timedelta(hours=9))
API = "https://api.finra.org/data/group/otcMarket/name/weeklySummary"
OUT_JSON = ROOT / "data" / "finra_ats.json"
OUT_JS = ROOT / "data" / "finra_ats.js"
DETAILS = ROOT / "data" / "details"
SNAPSHOT = ROOT / "data" / "market_snapshot.json"
TIERS = ("T1", "T2")
KEEP_WEEKS = 8
PROBE_WEEKS = 8          # 공개된 최근 주를 찾을 때 이번 주부터 거슬러 볼 주 수
PAGE = 5000              # record-max-limit
HEADERS = {"Content-Type": "application/json", "Accept": "application/json",
           "User-Agent": "Mozilla/5.0 (Mir-US-Stocks data builder)"}


def monday(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _post(body: dict, attempts: int = 3):
    """(rows, total). 공개 전·결과 없음이면 ([], 0)(HTTP 204)."""
    data = json.dumps(body).encode("utf-8")
    last = None
    for i in range(attempts):
        try:
            req = urllib.request.Request(API, data=data, headers=HEADERS, method="POST")
            with urllib.request.urlopen(req, timeout=60) as r:
                if r.status == 204:
                    return [], 0
                raw = r.read()
                total = int(r.headers.get("record-total") or 0)
            rows = json.loads(raw) if raw else []
            if not isinstance(rows, list):
                raise ValueError(f"응답 형식: {str(rows)[:200]}")
            return rows, total
        except (urllib.error.URLError, TimeoutError, ConnectionError, ValueError) as exc:
            last = exc
            time.sleep(5 * (i + 1))
    raise RuntimeError(last)


def _filters(week: str, tier: str) -> list:
    return [{"fieldName": "weekStartDate", "fieldValue": week, "compareType": "EQUAL"},
            {"fieldName": "tierIdentifier", "fieldValue": tier, "compareType": "EQUAL"},
            {"fieldName": "summaryTypeCode", "fieldValue": "ATS_W_SMBL", "compareType": "EQUAL"}]


def fetch_week(week: str, tier: str, post=_post) -> dict[str, int]:
    """{티커: ATS 주식수}. 공개 전이면 빈 dict."""
    out: dict[str, int] = {}
    offset = 0
    while True:
        rows, total = post({"limit": PAGE, "offset": offset, "compareFilters": _filters(week, tier)})
        if not rows:
            return out
        for r in rows:
            sym = str(r.get("issueSymbolIdentifier") or "").strip().upper()
            q = r.get("totalWeeklyShareQuantity")
            if sym and isinstance(q, (int, float)) and q >= 0:
                out[sym] = out.get(sym, 0) + int(q)
        offset += len(rows)
        if offset >= total or len(rows) < PAGE:
            return out


def latest_published(tier: str, today: date, post=_post) -> str | None:
    """이 티어에 공개된 가장 최근 주(월요일 ISO)."""
    start = monday(today)
    for k in range(1, PROBE_WEEKS + 1):
        wk = (start - timedelta(weeks=k)).isoformat()
        rows, _ = post({"limit": 1, "compareFilters": _filters(wk, tier)})
        if rows:
            return wk
    return None


def week_list(latest: str) -> list[str]:
    d = date.fromisoformat(latest)
    return [(d - timedelta(weeks=k)).isoformat() for k in range(KEEP_WEEKS - 1, -1, -1)]


def week_volume(series, week: str) -> int | None:
    """일봉 [o, h, l, c, v, 'YYYY-MM-DD'] 에서 그 주(월~금) 거래량 합. 그 주 봉이 없으면 None."""
    start = date.fromisoformat(week)
    end = start + timedelta(days=4)
    tot = 0
    n = 0
    for bar in series or []:
        if not isinstance(bar, list) or len(bar) < 6:
            continue
        try:
            d = date.fromisoformat(str(bar[5])[:10])
        except ValueError:
            continue
        if start <= d <= end and isinstance(bar[4], (int, float)) and bar[4] > 0:
            tot += int(bar[4])
            n += 1
    return tot if n else None


def build_tickers(universe, weeks_by_tier: dict, ats_by_tier: dict, load_series) -> dict:
    """티커 → [티어, 최근 주 ATS, [주별 비중%|null]]. 두 티어에 다 있으면(티어 변경) 최근 주에 값이 있는 쪽."""
    out = {}
    for t in universe:
        best = None
        for tier in TIERS:
            weeks = weeks_by_tier.get(tier) or []
            per = ats_by_tier.get(tier) or {}
            vals = [(per.get(w) or {}).get(t) for w in weeks]
            if not any(v is not None for v in vals):
                continue
            if best is None or vals[-1] is not None:
                best = (tier, weeks, vals)
        if not best:
            continue
        tier, weeks, vals = best
        series = load_series(t)
        pcts = []
        for w, ats in zip(weeks, vals):
            vol = week_volume(series, w) if ats is not None else None
            # 거래량 결측·오염(ATS 가 전체보다 많음)이면 비중을 내지 않는다.
            pcts.append(round(ats / vol * 100, 1) if (ats is not None and vol and ats <= vol) else None)
        if not any(p is not None for p in pcts):
            continue
        last_ats = next((v for v in reversed(vals) if v is not None), None)
        out[t] = [tier, last_ats, pcts]
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="FINRA ATS(다크풀) 주간 거래 비중")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()
    today = datetime.now(KST).date()
    latest, weeks_by_tier, ats_by_tier = {}, {}, {}
    try:
        for tier in TIERS:
            wk = latest_published(tier, today)
            if not wk:
                print(f"  [{tier}] 최근 {PROBE_WEEKS}주 안에 공개된 주가 없다")
                continue
            latest[tier] = wk
            weeks_by_tier[tier] = week_list(wk)
            ats_by_tier[tier] = {}
            for w in weeks_by_tier[tier]:
                ats_by_tier[tier][w] = fetch_week(w, tier)
                print(f"  [{tier}] {w}: {len(ats_by_tier[tier][w])}종목")
    except Exception as exc:
        print(f"[error] FINRA 조회 실패 — 기존 파일 유지: {exc}", file=sys.stderr)
        return 1
    if not latest:
        print("[error] 어느 티어도 공개 주를 찾지 못함 — 기존 파일 유지", file=sys.stderr)
        return 1

    snap = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    universe = sorted({str(s.get("ticker") or "").upper() for s in snap.get("stocks") or [] if s.get("ticker")})

    def load_series(t):
        try:
            return json.loads((DETAILS / f"{t}.json").read_text(encoding="utf-8")).get("chartSeries") or []
        except Exception:
            return []

    tickers = build_tickers(universe, weeks_by_tier, ats_by_tier, load_series)
    payload = {
        "updatedAtKst": datetime.now(KST).strftime("%Y-%m-%d %H:%M KST"),
        "source": "FINRA OTC Transparency(ATS 주간 체결 합계)",
        "latest": latest,
        "weeks": weeks_by_tier,
        "count": len(tickers),
        "cols": ["tier", "ats", "pct"],
        "tickers": tickers,
    }
    print(f"ATS: 최신 {latest} · 종목 {len(tickers)}")
    from briefing_store import repository_publish_lock
    from sec_client import git_publish, write_data
    with repository_publish_lock(ROOT):
        write_data(OUT_JSON, OUT_JS, "FINRA_ATS", payload, indent=None, min_ratio=0.7)
        if args.push:
            rel = [p.relative_to(ROOT).as_posix() for p in (OUT_JSON, OUT_JS)]
            if not git_publish(rel, "FINRA ATS weekly"):
                return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
