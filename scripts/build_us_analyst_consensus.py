#!/usr/bin/env python3
"""미국 애널리스트 컨센서스 — Finnhub 무료 티어(추천 분포 + 실적 서프라이즈).

US 분석 뷰엔 애널리스트 데이터가 전혀 없었다(KR 은 컨센서스가 있는데 비대칭). Finnhub
무료로 채울 수 있는 두 가지를 가져온다:
  - /stock/recommendation : 강력매수·매수·보유·매도·강력매도 애널리스트 수(월별 추세).
  - /stock/earnings       : 분기 EPS 추정치 vs 실제 + 서프라이즈%.

**목표주가(/stock/price-target)는 무료 티어에서 403 이라 넣지 않는다**(지어내지 않는다).
무료 티어는 미국만·분당 60회 → 호출당 ~1.1초로 페이싱. 종목당 2회.

산출물: data/analyst_consensus.json + .js(window.ANALYST_CONSENSUS). 값 없으면 기존 유지.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path
from briefing_store import atomic_write_text  # 중단 시 잘린 JSON 방지

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / "data" / "market_snapshot.json"
OUT_JSON = ROOT / "data" / "analyst_consensus.json"
OUT_JS = ROOT / "data" / "analyst_consensus.js"
BASE = "https://finnhub.io/api/v1"
UA = {"User-Agent": "Mir US Stocks research (dydtjsdn@gmail.com)"}


def kst_now_str() -> str:
    return datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M KST")


def load_key() -> str:
    key = os.environ.get("FINNHUB_API_KEY", "").strip()
    if key:
        return key
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            if line.startswith("FINNHUB_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


_last = [0.0]


def get(url: str, tries: int = 3):
    for attempt in range(tries):
        gap = 1.1 - (time.time() - _last[0])  # 분당 60회 준수
        if gap > 0:
            time.sleep(gap)
        _last[0] = time.time()
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20) as r:
                return json.loads(r.read())
        except Exception as e:  # noqa: BLE001
            code = getattr(e, "code", None)
            if code == 429:
                time.sleep(2 * (attempt + 1))
                continue
            if code == 403:
                return None  # 유료 전용 엔드포인트
            time.sleep(1)
    return None


def clean_rec(rows):
    if not isinstance(rows, list) or not rows:
        return None, None
    rows = sorted(rows, key=lambda r: str(r.get("period") or ""), reverse=True)

    def pack(r):
        keys = ("strongBuy", "buy", "hold", "sell", "strongSell")
        d = {k: int(r.get(k) or 0) for k in keys}
        d["period"] = r.get("period")
        d["total"] = sum(d[k] for k in keys)
        return d if d["total"] > 0 else None
    latest = pack(rows[0])
    prev = pack(rows[1]) if len(rows) > 1 else None
    return latest, prev


def clean_earnings(rows):
    if not isinstance(rows, list):
        return []
    out = []
    for r in rows[:6]:
        est, act = r.get("estimate"), r.get("actual")
        if est is None and act is None:
            continue
        out.append({
            "period": r.get("period"),
            "estimate": est,
            "actual": act,
            "surprisePercent": round(r["surprisePercent"], 1) if isinstance(r.get("surprisePercent"), (int, float)) else None,
        })
    return out


def build(top: int, key: str) -> dict | None:
    snap = json.loads(SNAPSHOT.read_text(encoding="utf-8")) if SNAPSHOT.exists() else {"stocks": []}
    stocks = [s for s in (snap.get("stocks") or []) if s.get("sector") != "EXCHANGE TRADED FUNDS" and s.get("ticker")]
    stocks.sort(key=lambda s: float(s.get("marketCapB") or 0), reverse=True)
    tickers = [str(s["ticker"]).upper() for s in stocks[:top]]

    out = {}
    done = 0
    for t in tickers:
        done += 1
        rec_rows = get(f"{BASE}/stock/recommendation?symbol={t}&token={key}")
        latest, prev = clean_rec(rec_rows)
        earn = clean_earnings(get(f"{BASE}/stock/earnings?symbol={t}&token={key}"))
        if not latest and not earn:
            continue
        entry = {}
        if latest:
            entry["rec"] = latest
            if prev:
                entry["recPrev"] = prev
        if earn:
            entry["earnings"] = earn
        out[t] = entry
        if done % 25 == 0:
            print(f"  진행 {done}/{len(tickers)} (수집 {len(out)})")
    if not out:
        return None
    return {"updatedAtKst": kst_now_str(),
            "source": "Finnhub · 애널리스트 추천 분포 + 분기 EPS 서프라이즈(목표주가 제외=무료 티어)",
            "stocks": out}


def main() -> int:
    ap = argparse.ArgumentParser(description="US 애널리스트 컨센서스(Finnhub)")
    ap.add_argument("--top", type=int, default=200)
    args = ap.parse_args()
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    key = load_key()
    if not key:
        print("[analyst] FINNHUB_API_KEY 없음 — 기존 파일 유지")
        return 1
    print(f"=== 애널리스트 컨센서스 수집 (Finnhub, 상위 {args.top}) ===")
    try:
        payload = build(args.top, key)
    except Exception as e:  # noqa: BLE001
        print(f"[analyst] 수집 실패({type(e).__name__}: {e}) — 기존 파일 유지")
        return 1
    if not payload:
        print("[analyst] 유효 데이터 없음 — 기존 파일 유지")
        return 1
    from sec_client import merge_previous_stocks
    payload = merge_previous_stocks(payload, OUT_JSON, "analyst")
    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    atomic_write_text(OUT_JSON, compact)
    atomic_write_text(OUT_JS, f"window.ANALYST_CONSENSUS = {compact};\n")
    print(f"수집 {len(payload['stocks'])}종목")
    print(f"Wrote {OUT_JSON.name}, {OUT_JS.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
