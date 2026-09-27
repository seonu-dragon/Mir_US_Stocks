#!/usr/bin/env python3
"""국내 ETF 구성 종목 — KRX 공식 PDF(Portfolio Deposit File).

내 투자 › 보유의 'ETF 룩스루'(lookthrough.js)가 읽는다. 보유 ETF 를 구성 종목으로 펼쳐
실제 종목 노출·ETF 간 중복·섹터 노출을 계산한다(미국은 SEC N-PORT, build_us_etf_holdings.py).

소스: 한국거래소 정보데이터시스템(data.krx.co.kr) [13108] ETF PDF — 운용사가 매일 거래소에
내는 설정·환매 단위(CU) 구성 내역이다. pykrx 가 KRX 회원 로그인(KRX_ID/KRX_PW)으로 부른다
(공매도·PER 밴드 빌더와 같은 경로). 네이버는 쓰지 않는다.

  - 대상: 국내 스냅샷의 ETF 중 시가총액 상위 --top 개(기본 150).
  - 한 ETF 당 KRX 1콜, 콜 간격 THROTTLE_S. 간격 없이 몰아 보내면 KRX 가 IP 를 1일 차단한다
    (2026-09-26, build_kr_valuation_band.py 주석). 150콜 ≈ 3~4분.
  - pykrx 의 get_etf_portfolio_deposit_file 은 구성 코드를 [3:9] 로 잘라 해외 ISIN
    (US0378331005 → '037833')을 국내 코드처럼 바꿔 버린다. 그래서 PDF 클래스를 직접 부르고
    코드는 parse_pdf_rows 가 판별한다(KR7xxxxxx 는 국내 단축코드, 그 밖의 ISIN 은 이름만).
  - 비중: KRX 비중(COMPST_RTO) → 없으면 구성금액(COMPST_AMT) → 평가금액(VALU_AMT) 비율.
  - 해외 주식형(TIGER 미국S&P500 등)은 PDF 가 '설정현금액' 한 줄에 금액을 몰고 주식 행은 계약수만
    준다(2026-09-27 실측: 금액 기준이면 현금 99.95%). 이때는 **계약수 × 미국 스냅샷 종가**로 주식
    바스켓 안의 비중을 계산한다 — 미국 ISIN(US + CUSIP 9자리 + 검증 1자리)을 미국 ETF 빌더의
    CUSIP → 티커 캐시(data/etf_holdings/cusip_map.json)로 잇고, 가격은 data/market_snapshot.json.
    종목 행의 70% 이상에 가격이 붙을 때만 쓰고(weightBasis "shares_x_close"), 아니면 '비중 미공개'로
    남겨 화면은 '구성 데이터 없음' 으로 표시한다(추정하지 않음).
  - 섹터 분포는 전체 구성 종목 기준으로 스냅샷 섹터를 이어 계산한다(이어지지 않는 해외 주식·
    채권·파생은 미분류/비주식).

산출물:
  data/korea/etf_holdings.json  (빌더 상태 — 직전 개수로 급감 방어)
  data/korea/etf_holdings.js    (window.KR_ETF_HOLDINGS, FEATURE_DATA krEtfHoldings, lazy)

실행: py scripts/build_kr_etf_holdings.py [--top 150] [--date YYYYMMDD] [--push]
Actions: kr-valuation-band.yml 의 etf 잡(토요일, 밴드 잡 다음 — 같은 KRX 계정 중복 로그인 방지).
"""

from __future__ import annotations

import argparse
import datetime
import json
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=ROOT / ".env")
except Exception:
    pass

import sec_client as sec  # noqa: E402
from briefing_store import repository_publish_lock  # noqa: E402

SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"
US_SNAPSHOT = ROOT / "data" / "market_snapshot.json"
CUSIP_MAP = ROOT / "data" / "etf_holdings" / "cusip_map.json"
OUT_JSON = ROOT / "data" / "korea" / "etf_holdings.json"
OUT_JS = ROOT / "data" / "korea" / "etf_holdings.js"
JS_VAR = "KR_ETF_HOLDINGS"
TOP_KEEP = 25          # ETF 당 싣는 상위 구성 종목 수(미국 N-PORT 샤드와 같게)
THROTTLE_S = 1.2
MIN_OK = 20            # 성공 ETF 가 이보다 적으면 발행하지 않는다
SOURCE = "KRX 정보데이터시스템 ETF PDF(구성종목·설정단위 기준)"

KR_ISIN_RE = re.compile(r"^KR7([0-9A-Z]{6})\d{3}$")
US_ISIN_RE = re.compile(r"^US([0-9A-Z]{9})\d$")
SHORT_CODE_RE = re.compile(r"^[0-9][0-9A-Z]{5}$")
CASH_RE = re.compile(r"현금|예금|원화|설정현금|CASH|DEPOSIT|콜론|RP매수|미수|미지급", re.I)


# ---------------------------------------------------------------- 순수 함수
def num(v) -> float:
    """'1,234' · '-' · '' · None → float(없으면 0)."""
    if v is None:
        return 0.0
    s = str(v).replace(",", "").strip()
    if s in ("", "-"):
        return 0.0
    try:
        f = float(s)
    except ValueError:
        return 0.0
    return f if f == f and abs(f) != float("inf") else 0.0


def normalize_code(raw: str) -> tuple[str | None, str]:
    """KRX PDF 구성 코드 → (국내 6자리 코드 | None, 원래 코드).

    KRX 는 COMPST_ISU_CD 에 국내 단축코드(005930)·국내 ISIN(KR7005930003)·해외 ISIN·
    파생 코드를 섞어 준다. 국내 주식만 6자리로 이어 붙이고, 나머지는 이름으로만 쓴다."""
    s = str(raw or "").strip().upper()
    m = KR_ISIN_RE.match(s)
    if m:
        return m.group(1), s
    if SHORT_CODE_RE.match(s):
        return s, s
    return None, s


def us_ticker_of(raw: str, cusip_map: dict | None) -> str | None:
    """미국 ISIN → 티커(CUSIP 캐시). 없으면 None."""
    m = US_ISIN_RE.match(str(raw or "").strip().upper())
    if not m or not cusip_map:
        return None
    rec = cusip_map.get(m.group(1))
    return (rec or {}).get("t") if isinstance(rec, dict) else (rec if isinstance(rec, str) else None)


def parse_pdf_rows(rows: list[dict], universe: dict[str, dict], top_keep: int = TOP_KEEP,
                   cusip_map: dict | None = None, us_universe: dict | None = None) -> dict | None:
    """KRX PDF 행 → {top, holdingsCount, sectors, sectorUnmapped, weightBasis}. 비중이 없으면 None.

    universe: {6자리 코드: {"company", "sector", "etf": bool}} (국내 스냅샷).
    cusip_map/us_universe: 해외 주식형의 계약수 × 미국 종가 계산용({CUSIP: {"t"}}, {티커: {"price", "sector", "company"}})."""
    items = []
    for r in rows or []:
        name = str(r.get("COMPST_ISU_NM") or "").strip()
        code, raw = normalize_code(r.get("COMPST_ISU_CD"))
        if not name and not code:
            continue
        items.append({
            "code": code, "raw": raw, "name": name,
            "rto": num(r.get("COMPST_RTO")), "amt": num(r.get("COMPST_AMT")), "valu": num(r.get("VALU_AMT")),
            "shares": num(r.get("COMPST_ISU_CU1_SHRS")), "us": us_ticker_of(raw, cusip_map),
        })
    if not items:
        return None
    for i in items:
        i["cash"] = bool(CASH_RE.search(i["name"])) and not universe.get(i["code"] or "")
    basis = None
    if sum(i["rto"] for i in items if i["rto"] > 0) > 1:
        basis = "rto"
        for i in items:
            i["w"] = max(0.0, i["rto"])
    else:
        for key in ("amt", "valu"):
            tot = sum(i[key] for i in items if i[key] > 0)
            if tot > 0:
                basis = key
                for i in items:
                    i["w"] = max(0.0, i[key]) / tot * 100
                break
    # 현금 한 줄에 금액이 몰리고 주식 행 비중이 0 → 계약수 × 미국 종가(주식 바스켓 안의 비중).
    if basis is not None:
        cash_w = sum(i["w"] for i in items if i["cash"])
        zero_stock = [i for i in items if not i["cash"] and i["w"] <= 0]
        if cash_w >= 50 and len(zero_stock) >= 3:
            basis = None
    if basis is None:
        stocks = [i for i in items if not i["cash"]]
        uu = us_universe or {}
        priced = [i for i in stocks if i["us"] and i["shares"] > 0 and num((uu.get(i["us"]) or {}).get("price")) > 0]
        if not stocks or len(priced) < 3 or len(priced) < len(stocks) * 0.7:
            return None
        vals = {id(i): i["shares"] * num(uu[i["us"]]["price"]) for i in priced}
        tot = sum(vals.values())
        for i in items:
            i["w"] = vals.get(id(i), 0.0) / tot * 100 if tot > 0 else 0.0
        basis = "shares_x_close"

    sectors: dict[str, float] = {}
    unmapped = 0.0
    out = []
    for i in items:
        w = i["w"]
        if w <= 0:
            continue
        u = universe.get(i["code"]) if i["code"] else None
        us = (us_universe or {}).get(i["us"]) if i["us"] else None
        cash = i["cash"]
        if u:
            kind = "equity" if not u.get("etf") else "fund"
        elif i["us"]:
            kind = "equity"
        else:
            kind = "cash" if cash else "other"
        sector = (u or {}).get("sector") if u and not u.get("etf") else (us or {}).get("sector")
        if sector and sector not in ("ETF", "EXCHANGE TRADED FUNDS"):
            sectors[sector] = sectors.get(sector, 0.0) + w
        elif not cash:
            unmapped += w
        rec = {"n": (u or {}).get("company") or i["name"], "w": round(w, 3), "k": kind}
        if u:
            rec["t"] = i["code"]
        elif i["us"]:
            rec["t"] = i["us"]
            rec["m"] = "us"
        out.append(rec)
    out.sort(key=lambda h: -h["w"])
    return {
        "top": out[:top_keep],
        "holdingsCount": len(out),
        "sectors": sorted(([s, round(w, 3)] for s, w in sectors.items()), key=lambda x: -x[1]),
        "sectorUnmapped": round(unmapped, 3),
        "weightBasis": basis,
    }


def pick_universe(snapshot: dict, top: int) -> tuple[list[dict], dict[str, dict]]:
    """스냅샷 → (시총 상위 ETF 목록, 코드 → 종목 정보)."""
    stocks = snapshot.get("stocks") or []
    universe: dict[str, dict] = {}
    etfs = []
    for s in stocks:
        code = str(s.get("ticker") or "").strip()
        if not code:
            continue
        is_etf = s.get("market") == "etf" or s.get("sector") == "ETF"
        universe[code] = {"company": s.get("company") or "", "sector": s.get("sector") or "", "etf": is_etf}
        if is_etf:
            cap = num(s.get("marketCapT")) or num(s.get("amount")) / 1e12
            etfs.append({"ticker": code, "name": s.get("company") or "", "cap": cap, "priceDate": s.get("priceDate")})
    etfs.sort(key=lambda e: -e["cap"])
    return etfs[:top], universe


def load_us_refs() -> tuple[dict, dict]:
    """(CUSIP → 티커 캐시, 미국 티커 → {price, sector, company}). 없으면 빈 dict."""
    cmap, uu = {}, {}
    try:
        cmap = json.loads(CUSIP_MAP.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"  [경고] {CUSIP_MAP.name} 읽기 실패: {exc}")
    try:
        snap = json.loads(US_SNAPSHOT.read_text(encoding="utf-8"))
        for s in snap.get("stocks") or []:
            t = s.get("ticker")
            if t:
                uu[t] = {"price": s.get("price"), "sector": s.get("sector") or "", "company": s.get("company") or ""}
    except Exception as exc:
        print(f"  [경고] 미국 스냅샷 읽기 실패: {exc}")
    return cmap, uu


def candidate_dates(price_date: str | None, today: datetime.date, back: int = 6) -> list[str]:
    """조회 일자 후보(YYYYMMDD, 최신부터 평일). 스냅샷 기준일이 있으면 그날부터."""
    start = today
    if price_date and re.match(r"^\d{4}-\d{2}-\d{2}$", price_date):
        start = min(today, datetime.date.fromisoformat(price_date))
    out, d = [], start
    while len(out) < back:
        if d.weekday() < 5:
            out.append(d.strftime("%Y%m%d"))
        d -= datetime.timedelta(days=1)
    return out


# ---------------------------------------------------------------- KRX 수집
def _fetcher():
    """(isin 조회, PDF 조회) — pykrx 임포트 = KRX 로그인."""
    from build_kr_short_interest import _import_pykrx_stock
    _import_pykrx_stock()
    from pykrx.website.krx.etx.core import PDF
    from pykrx.website.krx.etx.ticker import get_etx_isin
    return get_etx_isin, PDF()


def _relogin():
    from build_kr_valuation_band import _relogin as relogin
    relogin()


def fetch_pdf(pdf, isin: str, date: str, attempts: int = 3) -> list[dict] | None:
    for i in range(attempts):
        try:
            res = pdf.read(trdDd=date, isuCd=isin)
            time.sleep(THROTTLE_S)
            rows = res.get("output") if isinstance(res, dict) else None
            if isinstance(rows, list):
                return rows
        except Exception as exc:
            print(f"    [{isin} {date}] 예외({i + 1}/{attempts}): {type(exc).__name__}: {str(exc)[:60]}")
        _relogin()
        time.sleep(3 * (i + 1))
    return None


def run(top: int, date: str | None, push: bool) -> None:
    snap = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    etfs, universe = pick_universe(snap, top)
    if not etfs:
        print("  [실패] 스냅샷에 ETF 가 없다")
        raise SystemExit(1)
    cusip_map, us_universe = load_us_refs()
    get_isin, pdf = _fetcher()

    # 조회일: 가장 큰 ETF 의 PDF 가 나오는 가장 최근 평일.
    first_isin = get_isin(etfs[0]["ticker"])
    dates = [date] if date else candidate_dates(etfs[0].get("priceDate"), sec.kst_today())
    as_of = None
    for d in dates:
        rows = fetch_pdf(pdf, first_isin, d)
        if rows:
            as_of = d
            break
    if not as_of:
        print(f"  [실패] {etfs[0]['ticker']} PDF 가 {dates} 어느 날에도 비었다 — 로그인·차단 확인")
        raise SystemExit(1)
    as_of_iso = f"{as_of[:4]}-{as_of[4:6]}-{as_of[6:]}"
    print(f"  기준일 {as_of_iso} · 대상 {len(etfs)}개")

    out: dict[str, dict] = {}
    excluded: dict[str, str] = {}
    t0 = time.time()
    for idx, e in enumerate(etfs):
        t = e["ticker"]
        try:
            isin = get_isin(t)
        except Exception:
            excluded[t] = "isin"
            continue
        rows = fetch_pdf(pdf, isin, as_of)
        if rows is None:
            excluded[t] = "fetch"
            continue
        parsed = parse_pdf_rows(rows, universe, cusip_map=cusip_map, us_universe=us_universe)
        if not parsed:
            excluded[t] = "noweight" if rows else "empty"
            continue
        out[t] = {"name": e["name"], "asOf": as_of_iso, **parsed}
        if (idx + 1) % 25 == 0:
            print(f"    {idx + 1}/{len(etfs)} · 성공 {len(out)} · {time.time() - t0:.0f}s")

    count = len(out)
    print(f"  성공 {count} · 제외 {len(excluded)} ({', '.join(f'{k}={v}' for k, v in list(excluded.items())[:8])}…)")
    if count < MIN_OK or count < len(etfs) * 0.4:
        print(f"  [실패] 성공 {count}/{len(etfs)} — 너무 적다. 기존 파일 유지")
        raise SystemExit(1)
    payload = {
        "updatedAtKst": sec.kst_now_str(),
        "source": SOURCE,
        "asOf": as_of_iso,
        "count": count,
        "topKeep": TOP_KEEP,
        "basisText": {
            "rto": "KRX 비중",
            "amt": "구성금액 비율",
            "valu": "평가금액 비율",
            "shares_x_close": "계약수 × 미국 종가(주식 바스켓 안의 비중)",
        },
        "etfs": out,
        "excluded": excluded,
        "excludedText": {
            "noweight": "KRX PDF 에 비중·금액이 없고 계약수 × 종가로도 계산할 수 없음(해외 구성 등)",
            "empty": "KRX PDF 가 비어 있음",
            "fetch": "KRX 조회 실패",
            "isin": "ISIN 확인 실패",
        },
    }
    with repository_publish_lock(ROOT):
        # min_ratio: 직전 대비 60% 미만으로 줄면 덮지 않는다(로그인 만료로 절반만 받은 날 등).
        sec.write_data(OUT_JSON, OUT_JS, JS_VAR, payload, indent=None, min_ratio=0.6)
        print(f"Wrote {OUT_JS.relative_to(ROOT)} — {count}개 ETF · 기준일 {as_of_iso}")
        if push and not sec.git_publish(["data/korea/etf_holdings.json", "data/korea/etf_holdings.js"], "KR ETF holdings (KRX PDF)"):
            print("  [실패] git 게시 실패 — 발행되지 않았다")
            raise SystemExit(1)


def main():
    ap = argparse.ArgumentParser(description="국내 ETF 구성 종목(KRX PDF)")
    ap.add_argument("--top", type=int, default=150)
    ap.add_argument("--date", default=None, help="조회 일자 YYYYMMDD (기본: 스냅샷 기준일부터 최근 평일)")
    ap.add_argument("--push", action="store_true", default=False)
    args = ap.parse_args()
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    print("=== 국내 ETF 구성 종목 (KRX PDF) ===")
    run(args.top, args.date, args.push)


if __name__ == "__main__":
    main()
