#!/usr/bin/env python3
"""국내 KRX 공식 지표 — 외국인 지분율/한도소진율 + 공식 밸류에이션.

KRX 회원 로그인(pykrx, KRX_ID/KRX_PW)으로 종목별 공식값을 받는다:
  - 외국인: get_exhaustion_rates_of_foreign_investment → 지분율 · 한도소진률
  - 밸류에이션: get_market_fundamental_by_ticker → BPS/PER/PBR/EPS/DIV(배당수익률)/DPS

용도:
  1) 외국인 한도소진율 = 외국인 '매수 여력'. 네이버 보유율과 달리 한도 대비라 종목별
     외국인 관심의 여력을 본다. 밸류에이션 히트맵의 새 지표로 노출한다.
  2) 공식 밸류에이션(PER/PBR/배당수익률)은 네이버가 못 채운 종목의 fundamentals 를
     보강(교차검증)한다 — 히트맵 커버리지가 올라간다.

수급 순매수 자체는 다음날 수익률과 무관(외국인 t=+1.39)한 노이즈로 이미 판명됐다
([[mir-feature-data-late-race]] 아님 — investor_flow note). 그래서 이건 '알파'가 아니라
정확도·투명성(공식 지분/밸류) 차원의 데이터다.

산출물: data/korea/krx_metrics.{json,js}  (window.KR_KRX_METRICS)
자격증명은 .env 의 KRX_ID/KRX_PW (Actions 는 Secrets).
"""

from __future__ import annotations

import argparse
import datetime
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=ROOT / ".env")
except Exception:
    pass

import sec_client as sec  # noqa: E402
from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402
from build_kr_short_interest import _import_pykrx_stock  # noqa: E402  (pykrx 로그인 재시도 재사용)

# window 전역(.js)은 브라우저가 안 읽는다 — update_korea_data 의 attach_krx_metrics 가
# 이 .json 을 읽어 fundamentals 에 붙이고, 히트맵은 map_fundamentals 로만 그린다.
# 그래서 배포 용량을 아끼려 .json 만 쓴다.
OUT_JSON = ROOT / "data" / "korea" / "krx_metrics.json"
MARKETS = ("KOSPI", "KOSDAQ")


def _pos(v):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if f > 0 else None


def _nn(v):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f


def fundamentals(stock, date, market):
    try:
        df = stock.get_market_fundamental_by_ticker(date, market)
    except Exception:
        return {}
    out = {}
    for ticker, r in df.iterrows():
        code = str(ticker).zfill(6)
        out[code] = {
            "bps": _pos(r.get("BPS")),
            "per": _pos(r.get("PER")),
            "pbr": _pos(r.get("PBR")),
            "eps": _nn(r.get("EPS")),
            "div": _nn(r.get("DIV")),   # 배당수익률(%) — 0 도 유효(무배당)
            "dps": _nn(r.get("DPS")),
        }
    return out


def foreign(stock, date, market):
    try:
        df = stock.get_exhaustion_rates_of_foreign_investment(date, market)
    except Exception:
        return {}
    out = {}
    for ticker, r in df.iterrows():
        code = str(ticker).zfill(6)
        out[code] = {
            "fgnPct": _nn(r.get("지분율")),
            "fgnExh": _nn(r.get("한도소진률")),
        }
    return out


def find_available(stock, max_back=8):
    """밸류에이션(PER)이 실제로 집계된 최신 거래일. 당일(장중·미집계)엔 PER 이 전부 0 이라
    행은 오지만 값이 비어 있다 — PER 이 채워진 날을 골라야 한다."""
    today = datetime.date.today()
    for back in range(0, max_back + 1):
        d = (today - datetime.timedelta(days=back)).strftime("%Y%m%d")
        f = fundamentals(stock, d, "KOSPI")
        if f and sum(1 for v in f.values() if v.get("per")) > 50:
            return d
    return None


def build():
    stock = _import_pykrx_stock()
    date = find_available(stock)
    if not date:
        return None
    merged: dict[str, dict] = {}
    for market in MARKETS:
        for code, vals in fundamentals(stock, date, market).items():
            merged.setdefault(code, {}).update({k: v for k, v in vals.items() if v is not None})
        for code, vals in foreign(stock, date, market).items():
            merged.setdefault(code, {}).update({k: v for k, v in vals.items() if v is not None})
    # 라운딩
    for v in merged.values():
        for k in ("bps", "eps", "dps"):
            if k in v:
                v[k] = round(v[k], 1)
        for k in ("per", "pbr", "div", "fgnPct", "fgnExh"):
            if k in v:
                v[k] = round(v[k], 2)
    payload = {
        "updatedAtKst": sec.kst_now_str(),
        "date": f"{date[0:4]}-{date[4:6]}-{date[6:8]}",
        "count": len(merged),
        "source": "KRX 공식 (외국인 한도소진율 · 밸류에이션)",
        "metrics": merged,
    }
    fgn = sum(1 for v in merged.values() if "fgnExh" in v)
    val = sum(1 for v in merged.values() if "per" in v)
    print(f"  완료: {len(merged)}종목 (기준일 {payload['date']}) · 외국인 {fgn} · 밸류 {val}")
    return payload


def main():
    ap = argparse.ArgumentParser(description="KRX 공식 지표(외국인 한도소진율·밸류에이션)")
    ap.add_argument("--push", action="store_true", default=False)
    args = ap.parse_args()
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    print("=== KRX 공식 지표 수집 시작 ===")
    payload = build()
    if not payload or not payload["metrics"]:
        print("  [경고] 수집 0건 — 기존 파일 유지")
        return
    with repository_publish_lock(ROOT):
        OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
        atomic_write_text(OUT_JSON, json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
        print(f"Wrote {OUT_JSON} — {payload['count']} tickers")
        if args.push:
            sec.git_publish(["data/korea/krx_metrics.json"], "KR KRX metrics (foreign/valuation)")


if __name__ == "__main__":
    main()
