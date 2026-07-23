#!/usr/bin/env python3
"""미국 배당 + 실적 예정일 — Yahoo quoteSummary(쿠키+크럼).

US 분석 뷰엔 배당 정보와 다음 실적일이 없었다(KR 은 배당 트래커가 있는데 비대칭). 한 번의
quoteSummary 호출로 둘 다 온다:
  - summaryDetail: 배당수익률·주당배당·배당성향·배당락일·5년평균수익률.
  - calendarEvents: 다음 실적 발표일.

Yahoo 는 크럼 세션을 요구한다(옵션 빌더와 동일 방식). 종목당 1회. 값 없으면 기존 유지.

산출물: data/us_calendar.json + .js(window.US_STOCK_CALENDAR).
"""

from __future__ import annotations

import argparse
import http.cookiejar
import json
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path
from briefing_store import atomic_write_text  # 중단 시 잘린 JSON 방지

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / "data" / "market_snapshot.json"
OUT_JSON = ROOT / "data" / "us_calendar.json"
OUT_JS = ROOT / "data" / "us_calendar.js"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"}
MODULES = "summaryDetail,calendarEvents,defaultKeyStatistics"


def kst_now_str() -> str:
    return datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M KST")


class Yahoo:
    def __init__(self):
        self.cj = http.cookiejar.CookieJar()
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cj))
        self.crumb = ""

    def _get(self, url, timeout=20):
        with self.op.open(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
            return r.read()

    def auth(self) -> bool:
        for host in ("https://fc.yahoo.com", "https://finance.yahoo.com"):
            try:
                self._get(host)
            except Exception:
                pass
        for _ in range(3):
            try:
                c = self._get("https://query1.finance.yahoo.com/v1/test/getcrumb").decode("utf-8", "replace").strip()
                if c and "<" not in c:
                    self.crumb = c
                    return True
            except Exception:
                time.sleep(1)
        return False

    def summary(self, t: str) -> dict | None:
        url = (f"https://query1.finance.yahoo.com/v10/finance/quoteSummary/{urllib.parse.quote(t)}"
               f"?modules={MODULES}&crumb={urllib.parse.quote(self.crumb)}")
        try:
            d = json.loads(self._get(url))
        except Exception:
            return None
        res = (d.get("quoteSummary") or {}).get("result") or []
        return res[0] if res else None


def raw(node, *keys):
    for k in keys:
        node = (node or {}).get(k) if isinstance(node, dict) else None
    if isinstance(node, dict):
        return node.get("raw")
    return node


def build(top: int) -> dict | None:
    snap = json.loads(SNAPSHOT.read_text(encoding="utf-8")) if SNAPSHOT.exists() else {"stocks": []}
    stocks = [s for s in (snap.get("stocks") or []) if s.get("sector") != "EXCHANGE TRADED FUNDS" and s.get("ticker")]
    stocks.sort(key=lambda s: float(s.get("marketCapB") or 0), reverse=True)
    tickers = [str(s["ticker"]).upper() for s in stocks[:top]]

    y = Yahoo()
    if not y.auth():
        print("[calendar] 크럼 인증 실패 — 기존 파일 유지")
        return None

    out = {}
    done = 0
    for t in tickers:
        done += 1
        r = y.summary(t)
        time.sleep(0.25)
        if not r:
            continue
        sd = r.get("summaryDetail") or {}
        ce = r.get("calendarEvents") or {}
        ks = r.get("defaultKeyStatistics") or {}
        dy = raw(sd, "dividendYield")
        entry = {}
        if isinstance(dy, (int, float)) and dy > 0:
            entry["divYield"] = round(dy * 100, 2)
            entry["divRate"] = raw(sd, "dividendRate")
            payout = raw(sd, "payoutRatio")
            if isinstance(payout, (int, float)):
                entry["payout"] = round(payout * 100, 1)
            avg5 = raw(sd, "fiveYearAvgDividendYield")
            if isinstance(avg5, (int, float)):
                entry["avg5yYield"] = round(avg5, 2)
            ex = ce.get("exDividendDate")
            if isinstance(ex, dict) and ex.get("fmt"):
                entry["exDate"] = ex["fmt"]
        # 다음 실적 발표일(미래 날짜만)
        ed = ((ce.get("earnings") or {}).get("earningsDate") or [])
        for d in ed:
            fmt = d.get("fmt") if isinstance(d, dict) else None
            if fmt and fmt >= datetime.now(timezone.utc).strftime("%Y-%m-%d"):
                entry["nextEarnings"] = fmt
                break
        if entry:
            out[t] = entry
        if done % 25 == 0:
            print(f"  진행 {done}/{len(tickers)} (수집 {len(out)})")
    if not out:
        return None
    return {"updatedAtKst": kst_now_str(), "source": "Yahoo Finance quoteSummary", "stocks": out}


def main() -> int:
    ap = argparse.ArgumentParser(description="US 배당 + 실적 예정일(Yahoo)")
    ap.add_argument("--top", type=int, default=200)
    args = ap.parse_args()
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    print(f"=== 배당·실적 예정일 수집 (Yahoo, 상위 {args.top}) ===")
    try:
        payload = build(args.top)
    except Exception as e:  # noqa: BLE001
        print(f"[calendar] 수집 실패({type(e).__name__}: {e}) — 기존 파일 유지")
        return 1
    if not payload:
        print("[calendar] 유효 데이터 없음 — 기존 파일 유지")
        return 1
    from sec_client import merge_previous_stocks
    payload = merge_previous_stocks(payload, OUT_JSON, "calendar")
    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    atomic_write_text(OUT_JSON, compact)
    atomic_write_text(OUT_JS, f"window.US_STOCK_CALENDAR = {compact};\n")
    div = sum(1 for v in payload["stocks"].values() if "divYield" in v)
    ern = sum(1 for v in payload["stocks"].values() if "nextEarnings" in v)
    print(f"수집 {len(payload['stocks'])}종목 (배당 {div} · 실적일 {ern})")
    print(f"Wrote {OUT_JSON.name}, {OUT_JS.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
