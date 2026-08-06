#!/usr/bin/env python3
"""외부 공포탐욕 게이지 — 자체 심리지수와 비교할 참고용 외부 값 2종.

  1) 크립토 공포탐욕: alternative.me /fng/ — 공식 무료·키 불필요. 위험자산
     선행 심리로 자주 인용된다.
  2) CNN Fear & Greed: 비공식 엔드포인트(브라우저 UA + Referer 필요). 언제든
     막힐 수 있어 실패해도 크립토만으로 발행한다(best-effort).

산출물: data/sentiment_gauges.json + .js(window.SENTIMENT_GAUGES). 크립토마저
없으면 기존 파일 유지.
"""

from __future__ import annotations

import json
import sys
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

from briefing_store import atomic_write_text  # 중단 시 잘린 JSON 방지

ROOT = Path(__file__).resolve().parents[1]
OUT_JSON = ROOT / "data" / "sentiment_gauges.json"
OUT_JS = ROOT / "data" / "sentiment_gauges.js"

CRYPTO_URL = "https://api.alternative.me/fng/?limit=30"
CNN_URL = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata/{date}"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"}


def kst_now_str() -> str:
    return datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M KST")


def get_json(url: str, headers: dict) -> dict | None:
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception:
        return None


def fetch_crypto() -> dict | None:
    d = get_json(CRYPTO_URL, {"User-Agent": "Mir US Stocks (dydtjsdn@gmail.com)"})
    rows = (d or {}).get("data") or []
    if not rows:
        return None
    try:
        series = [int(r["value"]) for r in reversed(rows)]
        return {
            "value": int(rows[0]["value"]),
            "label": rows[0].get("value_classification"),
            "series": series,
        }
    except (KeyError, ValueError, TypeError):
        return None


def fetch_cnn() -> dict | None:
    date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    headers = dict(UA)
    headers["Referer"] = "https://www.cnn.com/"
    headers["Origin"] = "https://www.cnn.com"
    d = get_json(CNN_URL.format(date=date), headers)
    fg = (d or {}).get("fear_and_greed") or {}
    score = fg.get("score")
    if score is None:
        return None
    return {
        "value": round(float(score)),
        "label": fg.get("rating"),
        "prevClose": round(float(fg["previous_close"])) if fg.get("previous_close") is not None else None,
        "week1": round(float(fg["previous_1_week"])) if fg.get("previous_1_week") is not None else None,
        "month1": round(float(fg["previous_1_month"])) if fg.get("previous_1_month") is not None else None,
    }


def main() -> int:
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    print("=== 외부 공포탐욕 게이지 수집 ===")
    crypto = fetch_crypto()
    cnn = fetch_cnn()  # 비공식 — 실패 허용
    if not crypto and not cnn:
        print("[gauge] 둘 다 실패 — 기존 파일 유지")
        return 1
    payload = {
        "updatedAtKst": kst_now_str(),
        "source": "alternative.me Crypto F&G" + (" · CNN Fear & Greed(비공식)" if cnn else ""),
        "crypto": crypto,
        "cnn": cnn,
    }
    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    atomic_write_text(OUT_JSON, compact)
    atomic_write_text(OUT_JS, f"window.SENTIMENT_GAUGES = {compact};\n")
    print(f"crypto={crypto and crypto['value']} cnn={cnn and cnn['value']} → {OUT_JSON.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
