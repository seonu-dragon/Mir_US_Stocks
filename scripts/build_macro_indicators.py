#!/usr/bin/env python3
"""매크로 지표 — FRED(무료·키 불필요) 핵심 경제지표.

수익률 곡선(build_yield_curve)의 확장. 지수·종목만으로 안 보이는 거시 배경을 한 곳에서
본다: 인플레이션·고용·정책금리·신용스프레드·소비심리. 예측이 아니라 현재값·추세 요약.

각 시리즈를 개별 CSV 로 받되 `&cosd=`(관찰 시작일)로 최근 범위만 받아 응답을 가볍게 한다
(CPIAUCSL 은 1947년부터라 전체를 받으면 느리다). 값 없으면 기존 파일 유지.

산출물: data/macro_indicators.json + .js(window.MACRO_INDICATORS).
"""

from __future__ import annotations

import json
import sys
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_JSON = ROOT / "data" / "macro_indicators.json"
OUT_JS = ROOT / "data" / "macro_indicators.js"
UA = {"User-Agent": "Mir US Stocks research (dydtjsdn@gmail.com)"}

# (id, 라벨, 단위, 방향성 tone: "up"=높을수록 위험/부정 red, "down"=높을수록 긍정 green,
#  "neutral"=중립, yoy: 전년비%로 변환할지)
SERIES = [
    {"id": "CPIAUCSL", "label": "인플레이션 (CPI, 전년비)", "unit": "%", "tone": "up", "yoy": True},
    {"id": "UNRATE", "label": "실업률", "unit": "%", "tone": "up"},
    {"id": "FEDFUNDS", "label": "기준금리 (실효)", "unit": "%", "tone": "neutral"},
    {"id": "BAMLH0A0HYM2", "label": "하이일드 신용스프레드", "unit": "%p", "tone": "up"},
    {"id": "UMCSENT", "label": "소비자심리", "unit": "", "tone": "down"},
    {"id": "ICSA", "label": "신규 실업수당 청구", "unit": "천건", "tone": "up", "scale": 0.001},
    {"id": "VIXCLS", "label": "VIX 변동성", "unit": "", "tone": "up"},
    {"id": "DCOILWTICO", "label": "WTI 유가 ($/bbl)", "unit": "", "tone": "neutral"},
    {"id": "DTWEXBGS", "label": "달러지수 (브로드)", "unit": "", "tone": "neutral"},
]


def kst_now_str() -> str:
    return datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M KST")


def fetch_series(fid: str, start: str) -> list[tuple[str, float]]:
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={fid}&cosd={start}"
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        text = r.read().decode("utf-8", "replace")
    out = []
    for line in text.splitlines()[1:]:
        parts = line.split(",")
        if len(parts) < 2:
            continue
        v = parts[1].strip()
        if v in ("", "."):
            continue
        try:
            out.append((parts[0].strip(), float(v)))
        except ValueError:
            continue
    return out


def build() -> dict | None:
    start = (datetime.now(timezone.utc).date() - timedelta(days=760)).isoformat()  # ~2년(+YoY 여유)
    out = []
    for cfg in SERIES:
        try:
            rows = fetch_series(cfg["id"], start)
        except Exception:
            continue
        if len(rows) < 2:
            continue
        scale = cfg.get("scale", 1)
        if cfg.get("yoy"):
            # 전년비 %: 마지막 값 vs 약 12개월 전 값(월간 데이터 기준 index -12)
            if len(rows) < 13:
                continue
            cur_d, cur = rows[-1]
            _, yr = rows[-13]
            _, prev_cur = rows[-2]
            _, prev_yr = rows[-14] if len(rows) >= 14 else rows[-13]
            if yr == 0 or prev_yr == 0:
                continue
            value = (cur / yr - 1) * 100
            prev_value = (prev_cur / prev_yr - 1) * 100
            date = cur_d
        else:
            date, raw = rows[-1]
            value = raw * scale
            prev_value = rows[-2][1] * scale
        out.append({
            "id": cfg["id"], "label": cfg["label"], "unit": cfg["unit"], "tone": cfg["tone"],
            "value": round(value, 2), "prev": round(prev_value, 2),
            "change": round(value - prev_value, 2), "date": date,
        })
    if not out:
        return None
    return {"updatedAtKst": kst_now_str(), "source": "FRED · St. Louis Fed", "indicators": out}


def main() -> int:
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    print("=== 매크로 지표 수집 (FRED) ===")
    try:
        payload = build()
    except Exception as e:  # noqa: BLE001
        print(f"[macro] 수집 실패({type(e).__name__}: {e}) — 기존 파일 유지")
        return 0
    if not payload:
        print("[macro] 유효 데이터 없음 — 기존 파일 유지")
        return 0
    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    OUT_JSON.write_text(compact, encoding="utf-8")
    OUT_JS.write_text(f"window.MACRO_INDICATORS = {compact};\n", encoding="utf-8")
    for it in payload["indicators"]:
        print(f"  {it['label']}: {it['value']}{it['unit']} (Δ{it['change']}) {it['date']}")
    print(f"Wrote {OUT_JSON.name}, {OUT_JS.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
