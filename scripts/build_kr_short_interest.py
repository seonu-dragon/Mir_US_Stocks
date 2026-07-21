#!/usr/bin/env python3
"""국내 공매도 잔고 — KRX 실데이터.

한국거래소(data.krx.co.kr) '공매도 종합포털'의 종목별 공매도 잔고를 수집한다.
KRX 는 2024년경부터 데이터를 회원 로그인 뒤로 가뒀고, 무료 KRX OpenAPI
(openapi.krx.co.kr)·공공데이터포털에는 공매도 서비스가 없다. 그래서 유일하게
동작하는 경로인 **KRX 회원 로그인**을 쓴다 — 설치된 pykrx 포크가 env
KRX_ID/KRX_PW 로 로그인해 세션으로 공매도 bld 를 받는다.

미국(build_short_interest.py)은 'Days to Cover'(잔고÷평균거래량)가 핵심이지만,
KRX 잔고 공시에는 그 값이 없다. 국내 표준 지표는 **공매도 잔고비중**
(= 공매도잔고 ÷ 상장주식수, %)이라 그걸 1차 지표로 싣는다. 화면(app.js)은
시장이 KR 이면 '잔고비중' 컬럼을 보여준다.

잔고는 T+2 공시라 최신 거래일 데이터는 이틀 뒤에 올라온다. 최신 가용일을
과거로 탐색해 잡고, 그 직전 가용일과 비교해 전기대비 변화를 계산한다.

산출물:
  - data/korea/short_interest.json  (증분 상태 없음, 매번 최신 스냅샷)
  - data/korea/short_interest.js     (window.SHORT_INTEREST — 브라우저가 읽는 쪽)

이전(2026-07-15 삭제)의 random.Random 으로 지어내던 빌더를 대체한다.
"""

from __future__ import annotations

import argparse
import datetime
import sys
import time
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

import sec_client as sec  # noqa: E402  (kst_now_str / write_data / git_publish 재사용)
from briefing_store import repository_publish_lock  # noqa: E402

OUT_JSON = ROOT / "data" / "korea" / "short_interest.json"
OUT_JS = ROOT / "data" / "korea" / "short_interest.js"
SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"

MARKETS = ("KOSPI", "KOSDAQ")


def _import_pykrx_stock(attempts: int = 4):
    """pykrx 는 import 시점에 KRX 로그인을 한다. 로그인 POST 가 간헐적으로
    read timeout(15s) 나며 그 예외가 import 를 통째로 깨뜨린다 — 부분 임포트된
    pykrx 모듈을 지우고 재시도한다."""
    last = None
    for i in range(attempts):
        try:
            from pykrx import stock
            return stock
        except Exception as exc:  # ReadTimeout 등
            last = exc
            for name in [m for m in sys.modules if m.startswith("pykrx")]:
                del sys.modules[name]
            print(f"  [pykrx] import/로그인 재시도 {i + 1}/{attempts}: {type(exc).__name__}")
            time.sleep(3 * (i + 1))
    raise RuntimeError(f"pykrx 로그인 실패(재시도 소진): {last}")


def load_universe() -> dict[str, dict]:
    """스냅샷에서 티커→{company, market} 를 만든다. KRX 잔고는 종목명을 주지
    않으므로 이름은 여기서 붙인다. 스냅샷에 없는 티커(우선주·상폐 등)는 제외."""
    import json
    if not SNAPSHOT.exists():
        print(f"  [경고] {SNAPSHOT} 없음 — 종목명 없이 티커만으로 진행")
        return {}
    data = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    out = {}
    for s in data.get("stocks", []):
        t = str(s.get("ticker") or "").zfill(6)
        if t and t != "000000":
            out[t] = {"company": s.get("company") or t, "market": s.get("market") or ""}
    return out


def balance_by_ticker(stock, date: str, market: str):
    """{티커: {잔고, 상장주식수, 금액, 비중}} — 실패/빈값이면 빈 dict."""
    try:
        df = stock.get_shorting_balance_by_ticker(date, market)
    except Exception as exc:
        print(f"    [{market} {date}] 예외: {type(exc).__name__}: {str(exc)[:80]}")
        return {}
    out = {}
    for ticker, row in df.iterrows():
        code = str(ticker).zfill(6)
        out[code] = {
            "shortShares": int(row["공매도잔고"]),
            "listedShares": int(row["상장주식수"]),
            "shortValue": int(row["공매도금액"]),
            "balanceRatio": round(float(row["비중"]), 4),
        }
    return out


def fetch_all_markets(stock, date: str) -> dict[str, dict]:
    merged = {}
    for market in MARKETS:
        merged.update(balance_by_ticker(stock, date, market))
    return merged


def find_available(stock, start_back: int = 2, max_back: int = 14):
    """오늘로부터 start_back 일 전부터 과거로 훑어 잔고가 실제로 있는 최신
    거래일을 찾는다. (date_str, {티커:...}) 반환. 못 찾으면 (None, {})."""
    today = datetime.date.today()
    for back in range(start_back, max_back + 1):
        d = (today - datetime.timedelta(days=back)).strftime("%Y%m%d")
        data = fetch_all_markets(stock, d)
        if data:
            print(f"  최신 가용 잔고일: {d} ({len(data)}종목)")
            return d, data
    return None, {}


def find_previous(stock, settle_date: str, max_back: int = 10):
    """settle_date 직전의 가용 잔고일(전기대비 계산용)."""
    base = datetime.datetime.strptime(settle_date, "%Y%m%d").date()
    for back in range(1, max_back + 1):
        d = (base - datetime.timedelta(days=back)).strftime("%Y%m%d")
        data = fetch_all_markets(stock, d)
        if data:
            print(f"  직전 가용 잔고일: {d} ({len(data)}종목)")
            return d, data
    return None, {}


def build():
    stock = _import_pykrx_stock()
    universe = load_universe()
    settle, cur = find_available(stock)
    if not cur:
        return None
    _, prev = find_previous(stock, settle)

    rows = []
    for code, info in cur.items():
        if universe and code not in universe:
            continue  # 스냅샷 유니버스(우리 화면에 있는 종목)만
        shares = info["shortShares"]
        change = None
        pinfo = prev.get(code)
        if pinfo and pinfo["shortShares"] > 0:
            change = round((shares / pinfo["shortShares"] - 1) * 100, 1)
        meta = universe.get(code, {})
        rows.append({
            "ticker": code,
            "company": meta.get("company") or code,
            "market": meta.get("market") or "",
            "shortShares": shares,
            "listedShares": info["listedShares"],
            "shortValue": info["shortValue"],
            "balanceRatio": info["balanceRatio"],   # 잔고비중(%) — KR 1차 지표
            "changePct": change,                    # 전기대비 잔고수량 변화(%)
            "settlementDate": _fmt_date(settle),
        })

    # 잔고비중 높은 순(공매도 압력이 큰 종목이 위로).
    rows.sort(key=lambda r: (r.get("balanceRatio") or 0), reverse=True)
    payload = {
        "updatedAtKst": sec.kst_now_str(),
        "settlementDate": _fmt_date(settle),
        "count": len(rows),
        "metric": "balance",  # US=days-to-cover, KR=balance-ratio 구분용
        "source": "KRX 공매도 종합포털 (data.krx.co.kr)",
        "note": "공매도 잔고비중 = 미상환 공매도 잔고수량 ÷ 상장주식수. T+2 공시라 "
                "이틀 전 기준일이 최신이다. 전기대비는 직전 공시일 잔고수량 변화율.",
        "rows": rows,
    }
    print(f"  완료: {len(rows)}종목 (기준일 {_fmt_date(settle)})")
    return payload


def _fmt_date(yyyymmdd: str) -> str:
    return f"{yyyymmdd[0:4]}-{yyyymmdd[4:6]}-{yyyymmdd[6:8]}" if yyyymmdd else ""


def main():
    ap = argparse.ArgumentParser(description="국내 공매도 잔고 수집 (KRX)")
    ap.add_argument("--push", action="store_true", default=False)
    args = ap.parse_args()
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    print("=== 국내 공매도 잔고 수집 시작 (KRX) ===")
    payload = build()
    if not payload or not payload["rows"]:
        print("  [경고] 수집 0건 — 기존 파일 유지(덮어쓰지 않음)")
        return
    with repository_publish_lock(ROOT):
        sec.write_data(OUT_JSON, OUT_JS, "SHORT_INTEREST", payload)
        print(f"Wrote {OUT_JSON} — {payload['count']} rows")
        if args.push:
            sec.git_publish(
                ["data/korea/short_interest.json", "data/korea/short_interest.js"],
                "KR short interest (KRX)",
            )


if __name__ == "__main__":
    main()
