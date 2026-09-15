#!/usr/bin/env python3
"""미국 다년 재무 히스토리 — SEC EDGAR XBRL companyfacts (무료, 10년+).

stockanalysis.com 벤치마크. 종목 상세에 매출·영업이익·순이익 + 자산·자본·부채 연간 추이.
US 스냅샷엔 다년 재무가 없어(0년) SEC 공식 XBRL 로 채운다.

  1) ticker → CIK: sec.gov/files/company_tickers.json
  2) 회사별 전체 팩트: data.sec.gov/api/xbrl/companyfacts/CIK##########.json
  3) us-gaap 개념에서 연간(fp=FY, form 10-K) 값만 회계연도별로 추린다.

SEC 는 연락처가 든 User-Agent 를 요구하고 초당 ~10회로 제한한다(sleep 로 준수).

산출물: data/us_financials_history.json (파이썬 상태 파일). update_data 의
attach_us_financials_history 가 각 종목 detail 에 financialsHistory 로 붙인다.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
except Exception:
    pass

from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402
import sec_client as sec  # noqa: E402  (kst_now_str)

SNAPSHOT = ROOT / "data" / "market_snapshot.json"
OUT_JSON = ROOT / "data" / "us_financials_history.json"
UA = {"User-Agent": "Mir US Stocks research (dydtjsdn@gmail.com)", "Accept-Encoding": "gzip, deflate"}
TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"

# us-gaap 개념 후보(앞에서부터 있는 걸 쓴다). 회사마다 매출 태그가 달라 여러 후보를 둔다.
CONCEPTS = {
    "rev": ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues",
            "RevenueFromContractWithCustomerIncludingAssessedTax", "SalesRevenueNet"],
    "op": ["OperatingIncomeLoss"],
    "net": ["NetIncomeLoss"],
    "assets": ["Assets"],
    "equity": ["StockholdersEquity",
               "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
    "debt": ["Liabilities"],
}


def get_json(url, timeout=25, retries=4):
    """429/5xx 는 지수 백오프로 재시도, 404 는 즉시 중단.

    예전엔 재시도가 0회라 SEC 가 429 를 한 번만 줘도 그 종목이 통째로 사라졌다
    (--top 500 인데 라이브 count 304, 2026-09-15 감사).
    """
    import gzip
    last = None
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                raw = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    raw = gzip.decompress(raw)
                return json.loads(raw.decode("utf-8", "replace"))
        except Exception as exc:
            last = exc
            if getattr(exc, "code", None) in (403, 404):
                raise
            if attempt < retries:
                sec.backoff_sleep(attempt, base=1.0, cap=30.0)
    raise last


def ticker_cik_map():
    data = get_json(TICKERS_URL)
    out = {}
    for v in (data.values() if isinstance(data, dict) else data):
        t = str(v.get("ticker") or "").upper()
        cik = v.get("cik_str")
        if t and cik is not None:
            out[t] = int(cik)
    return out


def annual_by_concept(gaap: dict, names: list[str]) -> dict:
    """{회계연도: 값} — 연간(fp=FY, 10-K)만. 회사·연도마다 매출 태그가 달라(예: 애플은
    2019+ 는 RevenueFromContract…, 그 이전은 SalesRevenueNet) **개념을 순서대로 훑어
    연도별 빈칸을 폴백 개념으로 채운다**(앞선=선호 개념이 우선). 같은 개념 안에선 end 늦은 값."""
    byfy: dict[int, float] = {}
    for name in names:
        node = gaap.get(name)
        units = (node.get("units") or {}).get("USD") if node else None
        if not units:
            continue
        this: dict[int, tuple] = {}
        for u in units:
            if u.get("fp") != "FY" or not str(u.get("form") or "").startswith("10-K") or not u.get("fy"):
                continue
            try:
                fy = int(u["fy"])
            except (TypeError, ValueError):
                continue
            end = str(u.get("end") or "")
            if fy not in this or end > this[fy][1]:
                this[fy] = (u.get("val"), end)
        for fy, (val, _end) in this.items():
            if fy not in byfy and val is not None:  # 선호 개념이 이미 채운 연도는 유지
                byfy[fy] = val
    return byfy


def company_history(cik: int, years: int):
    """연간 재무 행 목록. **요청 자체가 실패하면 None**(= 모름)을 돌려준다.

    빈 리스트(= 공시에 연간 재무가 없음)와 구분해야 prev-merge 가 '이번에 못
    받은 종목'만 정확히 살릴 수 있다.
    """
    url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json"
    try:
        facts = (get_json(url).get("facts") or {}).get("us-gaap") or {}
    except Exception as exc:
        print(f"    [경고] CIK {cik} companyfacts 실패: {exc}")
        return None
    if not facts:
        return []
    per = {k: annual_by_concept(facts, names) for k, names in CONCEPTS.items()}
    fys = sorted({fy for m in per.values() for fy in m})[-years:]
    rows = []
    for fy in fys:
        row = {"y": fy}
        for k in CONCEPTS:
            v = per[k].get(fy)
            if v is not None:
                row[k] = int(v)
        if any(k in row for k in ("rev", "op", "net")):
            rows.append(row)
    return rows


def build(top: int | None, years: int):
    snap = json.loads(SNAPSHOT.read_text(encoding="utf-8")) if SNAPSHOT.exists() else {"stocks": []}
    stocks = [s for s in (snap.get("stocks") or []) if s.get("sector") != "EXCHANGE TRADED FUNDS"]
    stocks.sort(key=lambda s: float(s.get("marketCapB") or 0), reverse=True)
    tickers = [str(s.get("ticker") or "").upper() for s in stocks if s.get("ticker")]
    if top:
        tickers = tickers[:top]
    print(f"[US재무] CIK 매핑 로드...")
    cmap = ticker_cik_map()
    time.sleep(0.2)
    hist = {}
    done = 0
    failed = 0
    for t in tickers:
        cik = cmap.get(t)
        done += 1
        if cik is None:
            continue
        rows = company_history(cik, years)
        time.sleep(0.12)  # SEC 초당 ~10회 준수
        if rows is None:
            failed += 1
        elif len(rows) >= 2:
            hist[t] = rows
        if done % 100 == 0:
            print(f"  진행 {done}/{len(tickers)} (수집 {len(hist)}, 실패 {failed})")
    print(f"[US재무] 시도 {done}종목 · 수집 {len(hist)} · 요청 실패 {failed}")
    return hist, failed


def merge_previous(hist: dict) -> tuple[dict, int]:
    """이번에 못 받은 종목은 직전 산출물 값을 유지한다(패널 깜빡임·커버리지 붕괴 방지)."""
    if not OUT_JSON.exists():
        return hist, 0
    try:
        prev = (json.loads(OUT_JSON.read_text(encoding="utf-8")).get("financials") or {})
    except Exception as exc:
        print(f"[US재무] 이전 파일 병합 실패(무시): {exc}")
        return hist, 0
    kept = 0
    for ticker, rows in prev.items():
        if ticker not in hist and rows:
            hist[ticker] = rows
            kept += 1
    if kept:
        print(f"[US재무] 이번에 못 받은 {kept}종목은 이전 값 유지")
    return hist, len(prev)


def main() -> int:
    ap = argparse.ArgumentParser(description="US 다년 재무 히스토리(SEC XBRL)")
    ap.add_argument("--push", action="store_true")
    ap.add_argument("--top", type=int, default=500)
    ap.add_argument("--years", type=int, default=10)
    args = ap.parse_args()
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    print(f"=== US 다년 재무 수집 (SEC, 상위 {args.top}) ===")
    hist, failed = build(args.top, args.years)
    if not hist:
        print("[US재무] 수집 0건 — 기존 파일 유지, 실패로 끝낸다")
        return 1
    fresh = len(hist)
    hist, prev_count = merge_previous(hist)
    # 커버리지가 직전 대비 20% 넘게 줄었으면 소스가 깨진 것이다. 승계까지 했는데도
    # 줄었다면 조용히 발행하지 않는다(2026-09-15 감사: 500 중 304만 발행 중이었다).
    if prev_count and len(hist) < prev_count * 0.80:
        print(f"[US재무] 커버리지 {prev_count} → {len(hist)}종목 ({len(hist) / prev_count:.0%}) — "
              f"20% 넘게 줄어 발행하지 않는다(요청 실패 {failed}건)")
        return 1
    payload = {"updatedAtKst": sec.kst_now_str(), "source": "SEC EDGAR XBRL companyfacts (10-K)",
               "count": len(hist), "freshCount": fresh, "failedCount": failed, "financials": hist}
    with repository_publish_lock(ROOT):
        atomic_write_text(OUT_JSON, json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
        print(f"Wrote {OUT_JSON} — {len(hist)}종목(신규 {fresh}, 실패 {failed})")
        if args.push:
            if not sec.git_publish(["data/us_financials_history.json"], "US financials history"):
                print("[중단] US 다년 재무 push 실패 — 발행되지 않았다")
                return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
