#!/usr/bin/env python3
"""국내 일일 공매도 거래대금·거래비중 — KRX 실데이터.

공매도 '잔고'(build_kr_short_interest.py, T+2)와 별개인 **당일 거래** 지표(T+1).
pykrx 포크의 get_shorting_value_by_ticker 로 종목별 공매도 거래대금·전체
거래대금·거래비중(= 공매도 거래대금 ÷ 전체 거래대금, %)을 받는다.

이 API 도 KRX 회원 로그인(env KRX_ID/KRX_PW)이 필요하다 — 로그인 없이 호출하면
빈 응답으로 실패하는 것을 실측 확인(2026-07-24). build_kr_short_interest 와 같은
자격증명 패턴(.env / Actions Secrets)을 그대로 쓴다.

공매도 과열종목 지정은 pykrx 가 노출하지 않아 싣지 않는다(지어내지 않는다).

산출물:
  - data/korea/short_volume.json
  - data/korea/short_volume.js   (window.KR_SHORT_VOLUME — 브라우저가 읽는 쪽)

스키마(프론트 계약):
  {updatedAtKst, date, count, rows: [{ticker, company, market,
   shortValue, totalValue, ratioPct}]}
  rows 는 최신 거래일 기준 거래비중 상위 500 (스냅샷 유니버스 내 종목만).
"""

from __future__ import annotations

import argparse
import datetime
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

# .env 의 KRX_ID/KRX_PW 를 pykrx import(=로그인) 전에 환경으로 올린다. Actions 는
# Secrets 를 env 로 직접 주입하므로 .env 가 없어도 동작한다.
try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=ROOT / ".env")
except Exception:
    pass

import sec_client as sec  # noqa: E402
from briefing_store import repository_publish_lock  # noqa: E402
from build_kr_short_interest import _import_pykrx_stock, load_universe  # noqa: E402

OUT_JSON = ROOT / "data" / "korea" / "short_volume.json"
OUT_JS = ROOT / "data" / "korea" / "short_volume.js"

MARKETS = ("KOSPI", "KOSDAQ")
TOP_N = 500


def value_by_ticker(stock, date: str, market: str) -> dict[str, dict]:
    """{티커: {shortValue, totalValue, ratioPct}} — 실패/빈값이면 빈 dict.

    pykrx 컬럼: 공매도(공매도 거래대금, 원) · 매수(전체 거래대금, 원) · 비중(%).
    """
    try:
        df = stock.get_shorting_value_by_ticker(date, market)
    except Exception as exc:
        print(f"    [{market} {date}] 예외: {type(exc).__name__}: {str(exc)[:80]}")
        return {}
    out = {}
    for ticker, row in df.iterrows():
        try:
            short_value = int(row["공매도"])
            total_value = int(row["매수"])
            ratio = round(float(row["비중"]), 3)
        except (KeyError, ValueError, TypeError):
            continue
        if short_value <= 0:
            continue  # 공매도 0원은 리스트 의미가 없다
        out[str(ticker).zfill(6)] = {
            "shortValue": short_value,
            "totalValue": total_value,
            "ratioPct": ratio,
        }
    return out


def find_latest(stock, start_back: int = 1, max_back: int = 10):
    """최신 가용 공매도 거래일을 과거로 탐색. (date_str, {티커:...}) — 없으면 (None, {})."""
    today = datetime.date.today()
    for back in range(start_back, max_back + 1):
        d = (today - datetime.timedelta(days=back)).strftime("%Y%m%d")
        merged = {}
        for market in MARKETS:
            merged.update(value_by_ticker(stock, d, market))
        if merged:
            print(f"  최신 가용 거래일: {d} ({len(merged)}종목)")
            return d, merged
    return None, {}


def _fmt_date(yyyymmdd: str) -> str:
    return f"{yyyymmdd[0:4]}-{yyyymmdd[4:6]}-{yyyymmdd[6:8]}" if yyyymmdd else ""


def build():
    stock = _import_pykrx_stock()
    universe = load_universe()
    date, cur = find_latest(stock)
    if not cur:
        return None

    rows = []
    for code, info in cur.items():
        if universe and code not in universe:
            continue  # 스냅샷 유니버스(우리 화면에 있는 종목)만
        meta = universe.get(code, {})
        rows.append({
            "ticker": code,
            "company": meta.get("company") or code,
            "market": meta.get("market") or "",
            "shortValue": info["shortValue"],
            "totalValue": info["totalValue"],
            "ratioPct": info["ratioPct"],
        })

    # 거래비중 높은 순 상위 TOP_N (당일 공매도 압력이 큰 종목이 위로).
    rows.sort(key=lambda r: (r.get("ratioPct") or 0, r.get("shortValue") or 0), reverse=True)
    rows = rows[:TOP_N]

    payload = {
        "updatedAtKst": sec.kst_now_str(),
        "date": _fmt_date(date),
        "count": len(rows),
        "source": "KRX 공매도 종합포털 (data.krx.co.kr)",
        "note": "당일 공매도 거래비중 = 공매도 거래대금 ÷ 전체 거래대금(T+1 공시). "
                "잔고비중(short_interest)과 별개인 '거래' 지표. 거래비중 상위 500. "
                "과열종목 지정은 KRX 데이터 API 미노출로 싣지 않는다.",
        "rows": rows,
    }
    print(f"  완료: {len(rows)}종목 (거래일 {_fmt_date(date)})")
    return payload


def main():
    ap = argparse.ArgumentParser(description="국내 일일 공매도 거래비중 수집 (KRX)")
    ap.add_argument("--push", action="store_true", default=False)
    args = ap.parse_args()
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    print("=== 국내 일일 공매도 거래비중 수집 시작 (KRX) ===")
    payload = build()
    if not payload or not payload["rows"]:
        print("  [경고] 수집 0건 — 기존 파일 유지(덮어쓰지 않음)")
        raise SystemExit(1)
    with repository_publish_lock(ROOT):
        sec.write_data(OUT_JSON, OUT_JS, "KR_SHORT_VOLUME", payload)
        print(f"Wrote {OUT_JSON} — {payload['count']} rows")
        if args.push:
            sec.git_publish(
                ["data/korea/short_volume.json", "data/korea/short_volume.js"],
                "KR daily short volume (KRX)",
            )


if __name__ == "__main__":
    main()
