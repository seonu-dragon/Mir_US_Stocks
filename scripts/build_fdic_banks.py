#!/usr/bin/env python3
"""미국 은행주 건전성 — FDIC BankFind 분기 재무(콜 리포트, 키 없음).

은행 지주사 티커 → 핵심 은행 자회사의 FDIC 인증번호(CERT) 대응표(BANKS)로 최근 12분기를 받는다.
10-Q 보다 표준화된 은행 비교표 — 순이자마진·부실채권비율·순상각률·ROA·ROE·보통주자본비율·예금·대출.
지주사 연결이 아니라 은행 자회사 단위다(지주사 비은행 사업은 빠진다).

  https://api.fdic.gov/banks/financials?filters=CERT:<n>&fields=...&sort_by=REPDTE&sort_order=DESC&limit=12
  (옛 banks.data.fdic.gov 는 301 → api.fdic.gov)

산출물: data/fdic_banks.json + .js (window.FDIC_BANKS, 미국 전용·lazy). 분기말 + 약 50일에 새 분기.
실행: py scripts/build_fdic_banks.py [--push]
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.parse
from datetime import datetime, timedelta, timezone
from pathlib import Path

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

import sec_client as sec  # noqa: E402

KST = timezone(timedelta(hours=9))
OUT_JSON = ROOT / "data" / "fdic_banks.json"
OUT_JS = ROOT / "data" / "fdic_banks.js"
UA = {"User-Agent": "Mir US Stocks research (dydtjsdn@gmail.com)"}
API = "https://api.fdic.gov/banks/financials"
QUARTERS = 12
# 티커 → 핵심 은행 자회사 CERT (FDIC institutions 검색으로 확인, 2026-10-22. Comerica·Webster 는 비활성이라 제외)
BANKS = {
    "JPM": 628, "BAC": 3510, "WFC": 3511, "C": 7213, "USB": 6548, "PNC": 6384, "TFC": 9846, "COF": 4297,
    "GS": 33124, "MS": 32992, "SCHW": 57450, "BK": 639, "STT": 14, "NTRS": 913, "AXP": 27471,
    "FITB": 6672, "HBAN": 6560, "KEY": 17534, "RF": 12368, "CFG": 57957, "MTB": 588, "FCNCA": 11063,
    "ZION": 2270, "WAL": 57512, "FLG": 32541, "EWBC": 31628, "ALLY": 57803, "SYF": 27314,
}
# 출력 열 순서(행 = 분기). 금액은 천 USD(FDIC 원단위).
FIELDS = ["REPDTE", "NIMY", "NCLNLSR", "NTLNLSR", "ROA", "ROE", "RBCT1CER", "ASSET", "DEP", "LNLSNET"]
COLUMNS = ["quarter", "nim", "npl", "nco", "roa", "roe", "cet1", "assets", "deposits", "loans"]


def _num(v):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if f == f else None


def quarter_key(repdte: str) -> str | None:
    """'20260630' → '2026-Q2'."""
    s = str(repdte or "")
    if len(s) != 8 or not s.isdigit():
        return None
    return f"{s[:4]}-Q{(int(s[4:6]) - 1) // 3 + 1}"


def parse_rows(payload: dict) -> list[list]:
    """FDIC financials 응답 → 오름차순 [[분기, nim, npl, nco, roa, roe, cet1, 자산, 예금, 대출], …] (값은 소수 2·정수)."""
    out = {}
    for item in payload.get("data") or []:
        d = item.get("data") or {}
        q = quarter_key(d.get("REPDTE"))
        if not q:
            continue
        row = [q]
        for f in FIELDS[1:]:
            v = _num(d.get(f))
            row.append(None if v is None else (round(v) if f in ("ASSET", "DEP", "LNLSNET") else round(v, 2)))
        out[q] = row
    return [out[k] for k in sorted(out)]


def fetch_bank(cert: int) -> list[list]:
    q = urllib.parse.urlencode({"filters": f"CERT:{cert}", "fields": ",".join(FIELDS), "sort_by": "REPDTE",
                                "sort_order": "DESC", "limit": str(QUARTERS)})
    raw = sec.http_get_with_backoff(f"{API}?{q}", headers=UA, timeout=40, label=f"FDIC {cert}")
    return parse_rows(json.loads(raw.decode("utf-8")))


def build(fetch=fetch_bank, sleep_s: float = 0.3) -> dict:
    banks, failed = {}, []
    for ticker, cert in BANKS.items():
        try:
            rows = fetch(cert)
        except Exception as exc:  # noqa: BLE001
            failed.append(f"{ticker}: {type(exc).__name__}: {exc}")
            continue
        if rows:
            banks[ticker] = {"cert": cert, "q": rows}
        else:
            failed.append(f"{ticker}: 0분기")
        time.sleep(sleep_s)
    latest = max((b["q"][-1][0] for b in banks.values()), default=None)
    return {
        "updatedAtKst": datetime.now(KST).strftime("%Y-%m-%d %H:%M KST"),
        "latestQuarter": latest, "count": len(banks), "columns": COLUMNS, "banks": banks, "failed": failed,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="FDIC 은행 분기 건전성")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()
    payload = build()
    print(f"[fdic] 은행 {payload['count']}/{len(BANKS)} · 최신 분기 {payload['latestQuarter']}"
          + (f" · 실패 {len(payload['failed'])}: {payload['failed'][:3]}" if payload["failed"] else ""))
    if payload["count"] < len(BANKS) // 2:
        print("[fdic] 받은 은행이 절반 미만 — 기존 파일 유지")
        return 1
    sec.write_data(OUT_JSON, OUT_JS, "FDIC_BANKS", payload, indent=None, min_ratio=0.5)
    if args.push and not sec.git_publish([str(OUT_JSON.relative_to(ROOT)), str(OUT_JS.relative_to(ROOT))], "FDIC bank financials"):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
