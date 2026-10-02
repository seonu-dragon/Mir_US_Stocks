#!/usr/bin/env python3
"""국내 KRX 공식 일별 시세(정규장 종가) — 스냅샷 대표가 보정용.

네이버 m.stock 목록의 closePrice 는 정규장 종가가 아니다. 16:00 시간외 단일가가 시작되면 그 가격으로
바뀐다(2026-10-02 실측: 16:13 에 상위 200종목 중 157종목이 15:55 값과 달랐고, 우선주처럼 NXT 가 없는
종목도 바뀌었다). 마감 브리핑 잡이 늦게 돌면(2026-10-01 19:09 KST) 스냅샷 종가가 통째로 틀린다.

KRX 회원 로그인(pykrx, KRX_ID/KRX_PW)으로 그날 전 종목(주식+ETF)의 공식 종가·등락률·거래량·
거래대금·시가총액을 받아 --out 에 쓴다. update_korea_data.apply_krx_official_close 가 읽는다.
산출물은 커밋하지 않는 임시 파일이다.
"""

from __future__ import annotations

import argparse
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

from build_kr_short_interest import _import_pykrx_stock  # noqa: E402  (pykrx 로그인 재시도 재사용)


def _num(v):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if f == f else None  # NaN 제외


def collect(stock, date: str) -> dict[str, dict]:
    rows: dict[str, dict] = {}
    df = stock.get_market_ohlcv_by_ticker(date, market="ALL")
    for code, r in df.iterrows():
        close = _num(r.get("종가"))
        if not close or close <= 0:
            continue
        rows[str(code)] = {
            "close": close,
            "changePct": _num(r.get("등락률")),
            "volume": _num(r.get("거래량")),
            "amount": _num(r.get("거래대금")),
            "cap": _num(r.get("시가총액")),
        }
    # ETF 는 등락률·시가총액을 주지 않는다 — 등락률은 update_korea_data 가 네이버 전일가로 계산한다.
    df = stock.get_etf_ohlcv_by_ticker(date)
    for code, r in df.iterrows():
        close = _num(r.get("종가"))
        if not close or close <= 0 or str(code) in rows:
            continue
        rows[str(code)] = {
            "close": close,
            "volume": _num(r.get("거래량")),
            "amount": _num(r.get("거래대금")),
        }
    return rows


def main():
    ap = argparse.ArgumentParser(description="KRX 공식 일별 시세(정규장 종가)")
    ap.add_argument("--date", required=True, help="YYYYMMDD")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    rows = collect(_import_pykrx_stock(), args.date)
    if not rows:
        print(f"  [krx-close] {args.date} 시세 0건 — 휴장일이거나 로그인 실패")
        raise SystemExit(1)
    date = f"{args.date[0:4]}-{args.date[4:6]}-{args.date[6:8]}"
    Path(args.out).write_text(json.dumps({"date": date, "rows": rows}, ensure_ascii=False), encoding="utf-8")
    print(f"  [krx-close] {date} {len(rows)}종목")


if __name__ == "__main__":
    main()
