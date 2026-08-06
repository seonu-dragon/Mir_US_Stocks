#!/usr/bin/env python3
"""WSB 감성 점수 — Tradestie 공개 API, 키 불필요.

기존 소셜 표(ApeWisdom 멘션 수)가 '얼마나 시끄러운가'라면, 이건 '어느 쪽으로
시끄러운가'다. r/wallstreetbets 댓글의 강세/약세 감성 점수를 종목별로 싣는다.
15분 갱신 소스지만 우리는 일 1회 배치 — 분위기 스냅샷 용도다.

  https://tradestie.com/api/v1/apps/reddit  (상위 50종목, IP 당 20req/min)

산출물: data/wsb_sentiment.json + .js(window.WSB_SENTIMENT). 값 없으면 기존
파일 유지.
"""

from __future__ import annotations

import json
import sys
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

from briefing_store import atomic_write_text  # 중단 시 잘린 JSON 방지

ROOT = Path(__file__).resolve().parents[1]
OUT_JSON = ROOT / "data" / "wsb_sentiment.json"
OUT_JS = ROOT / "data" / "wsb_sentiment.js"
SNAPSHOT = ROOT / "data" / "market_snapshot.json"

URL = "https://tradestie.com/api/v1/apps/reddit"
UA = {"User-Agent": "Mir US Stocks research (dydtjsdn@gmail.com)"}


def kst_now_str() -> str:
    return datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M KST")


def build() -> dict | None:
    req = urllib.request.Request(URL, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        rows = json.loads(r.read().decode("utf-8"))
    if not isinstance(rows, list) or len(rows) < 10:
        return None

    names = {}
    try:
        snap = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
        names = {s["ticker"]: s.get("company") for s in snap.get("stocks", []) if s.get("ticker")}
    except Exception:
        pass

    out = []
    for r0 in rows:
        t = r0.get("ticker")
        if not t:
            continue
        score = r0.get("sentiment_score")
        out.append({
            "t": t,
            "company": names.get(t),
            "comments": int(r0.get("no_of_comments") or 0),
            "sentiment": r0.get("sentiment"),  # "Bullish" | "Bearish"
            "score": round(float(score), 3) if score is not None else None,
        })
    out.sort(key=lambda x: x["comments"], reverse=True)
    if len(out) < 10:
        return None
    return {
        "updatedAtKst": kst_now_str(),
        "source": "Tradestie · r/wallstreetbets 댓글 감성 (수집 시점 스냅샷)",
        "rows": out[:30],
    }


def main() -> int:
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    print("=== WSB 감성 수집 (Tradestie) ===")
    try:
        payload = build()
    except Exception as e:  # noqa: BLE001
        print(f"[wsb] 수집 실패({type(e).__name__}: {e}) — 기존 파일 유지")
        return 1
    if not payload:
        print("[wsb] 유효 데이터 없음 — 기존 파일 유지")
        return 1
    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    atomic_write_text(OUT_JSON, compact)
    atomic_write_text(OUT_JS, f"window.WSB_SENTIMENT = {compact};\n")
    print(f"{len(payload['rows'])}종목 → {OUT_JSON.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
