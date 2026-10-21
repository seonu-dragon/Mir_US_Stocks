#!/usr/bin/env python3
"""미국 액면분할·병합 일정 — Nasdaq 분할 캘린더 API(api/calendar/splits, 키 없음).

Nasdaq 은 오늘 기준 앞뒤 2~3주의 분할 일정(종목·회사명·비율·효력일)을 한 번에 준다. 응답 창이
짧아서 지난 일정은 다음 실행 때 빠지므로, 기존 산출물과 (티커, 효력일)로 합쳐 지난 60일까지
남긴다(통합 캘린더에서 지난주 분할도 보이게). 같은 키는 새 응답 값으로 덮는다(비율 정정).

비율 'A : B' 는 B주가 A주가 된다는 뜻이다 — '3 : 1' 은 1주가 3주(정분할), '1 : 10' 은 10주가
1주(병합·역분할). factor = A/B(1 보다 크면 정분할).

실행: py scripts/build_us_splits.py [--push]
출력: data/us_splits.json + .js (window.US_SPLITS)
"""
from __future__ import annotations

import argparse
import gzip
import json
import re
import sys
import time
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

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

KST = ZoneInfo("Asia/Seoul")
OUT_JSON = ROOT / "data" / "us_splits.json"
OUT_JS = ROOT / "data" / "us_splits.js"
API_URL = "https://api.nasdaq.com/api/calendar/splits"
KEEP_PAST_DAYS = 60
NASDAQ_HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
    "Origin": "https://www.nasdaq.com",
    "Referer": "https://www.nasdaq.com/",
}
RATIO_RE = re.compile(r"^\s*(\d+(?:\.\d+)?)\s*(?::|-for-|/)\s*(\d+(?:\.\d+)?)\s*$", re.I)


def now_kst() -> datetime:
    return datetime.now(KST)


def parse_ratio(text):
    """'3 : 1' → (3.0, 1.0, factor 3.0). 못 읽으면 None."""
    m = RATIO_RE.match(str(text or ""))
    if not m:
        return None
    a, b = float(m.group(1)), float(m.group(2))
    if a <= 0 or b <= 0 or a == b:
        return None
    return a, b, a / b


def parse_date(text):
    """'11/05/2026' → '2026-11-05'. 못 읽으면 None."""
    try:
        return datetime.strptime(str(text or "").strip(), "%m/%d/%Y").date().isoformat()
    except ValueError:
        return None


def _num_text(v: float) -> str:
    return str(int(v)) if float(v).is_integer() else f"{v:g}"


def parse_rows(payload) -> list[dict]:
    """Nasdaq 응답 → [{ticker, name, ratio, factor, kind, date}]. 읽을 수 없는 행은 버린다."""
    rows = ((payload or {}).get("data") or {}).get("rows") or []
    out = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        ticker = str(r.get("symbol") or "").strip().upper()
        iso = parse_date(r.get("executionDate"))
        ratio = parse_ratio(r.get("ratio"))
        if not ticker or not iso or not ratio:
            continue
        a, b, factor = ratio
        out.append({
            "ticker": ticker,
            "name": str(r.get("name") or "").strip(),
            "ratio": f"{_num_text(a)}:{_num_text(b)}",
            "factor": round(factor, 6),
            "kind": "forward" if factor > 1 else "reverse",
            "date": iso,
        })
    return out


def merge(prev_rows, new_rows, today: date) -> list[dict]:
    """(티커, 효력일)로 합친다 — 새 응답이 이기고, 효력일이 KEEP_PAST_DAYS 보다 오래된 것은 버린다."""
    cutoff = (today - timedelta(days=KEEP_PAST_DAYS)).isoformat()
    by_key = {}
    for r in list(prev_rows or []) + list(new_rows or []):
        if not isinstance(r, dict) or not r.get("ticker") or not r.get("date"):
            continue
        by_key[(r["ticker"], r["date"])] = r
    rows = [r for r in by_key.values() if r["date"] >= cutoff]
    rows.sort(key=lambda r: (r["date"], r["ticker"]))
    return rows


def fetch(attempts: int = 3):
    last = None
    for i in range(attempts):
        try:
            req = urllib.request.Request(API_URL, headers=NASDAQ_HEADERS)
            with urllib.request.urlopen(req, timeout=30) as r:
                raw = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    raw = gzip.decompress(raw)
            payload = json.loads(raw)
            if not isinstance((payload.get("data") or {}).get("rows"), list):
                raise ValueError(f"응답 형식이 다르다: {str(payload)[:200]}")
            return payload
        except Exception as exc:  # 일시 장애는 몇 번 다시
            last = exc
            time.sleep(5 * (i + 1))
    raise RuntimeError(last)


def load_prev() -> dict:
    try:
        return json.loads(OUT_JSON.read_text(encoding="utf-8"))
    except Exception:
        return {}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()
    today = now_kst().date()
    try:
        payload = fetch()
    except Exception as exc:
        print(f"[error] Nasdaq 분할 캘린더 조회 실패 — 기존 파일 유지: {exc}", file=sys.stderr)
        return 1
    fresh = parse_rows(payload)
    prev = load_prev()
    rows = merge(prev.get("rows"), fresh, today)
    upcoming = [r for r in rows if r["date"] >= today.isoformat()]
    out = {
        "updatedAtKst": now_kst().strftime("%Y-%m-%d %H:%M KST"),
        "source": "Nasdaq 분할 캘린더",
        "asOf": str(((payload.get("data") or {}).get("asOf")) or ""),
        "count": len(rows),
        "upcoming": len(upcoming),
        "rows": rows,
    }
    print(f"분할 일정: 응답 {len(fresh)}건 → 합친 {len(rows)}건(다가오는 {len(upcoming)}건, "
          f"정분할 {sum(1 for r in upcoming if r['kind'] == 'forward')} · 병합 {sum(1 for r in upcoming if r['kind'] == 'reverse')})")
    from sec_client import write_data
    # 조회는 성공했는데 일정이 0건인 주도 있을 수 있다 — 응답 형식이 맞았으면 쓴다.
    write_data(OUT_JSON, OUT_JS, "US_SPLITS", out, indent=None, allow_empty=True)
    if args.push:
        from sec_client import git_publish
        rel = [str(p.relative_to(ROOT)).replace("\\", "/") for p in (OUT_JSON, OUT_JS)]
        if not git_publish(rel, "US splits calendar"):
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
