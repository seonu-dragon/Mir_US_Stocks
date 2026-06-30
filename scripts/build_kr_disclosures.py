#!/usr/bin/env python3
"""Korea DART disclosures for tracked KR universe tickers.

Requires DART_API_KEY (https://opendart.fss.or.kr/). Without a key, writes an empty
payload so the site can still load the feature shell.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402

KST = ZoneInfo("Asia/Seoul")
OUT_JSON = ROOT / "data" / "kr_disclosures.json"
OUT_JS = ROOT / "data" / "kr_disclosures.js"
KR_SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"

DART_BASE = "https://opendart.fss.or.kr/api"
# Major report types: A=정기공시, B=주요사항, C=발행공시, D=지분공시, E=기타공시, F=외부감사, G=펀드, H=자산유동화, I=거래소, J=공정위
REPORT_PBLNTF_CODES = "A,B,C,D,E,I"

DISCLOSURE_LABELS = {
    "A001": "사업보고서",
    "A002": "반기보고서",
    "A003": "분기보고서",
    "B001": "주요사항보고",
    "C001": "증권신고(지분)",
    "D001": "주식등의대량보유상황보고",
    "D002": "임원·주요주주 소유보고",
    "E001": "기타공시",
    "I001": "거래소 공시",
}


def now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def write_outputs(payload: dict) -> None:
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    atomic_write_text(OUT_JSON, json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    js = "window.KR_DISCLOSURES = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";"
    atomic_write_text(OUT_JS, js)


def dart_get(path: str, params: dict, api_key: str) -> dict:
    q = {**params, "crtfc_key": api_key}
    url = f"{DART_BASE}/{path}?{urllib.parse.urlencode(q)}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mir-US-Stocks/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def load_corp_map(api_key: str) -> dict[str, str]:
    data = dart_get("corpCode.xml", {}, api_key)
    if data.get("status") != "000":
        return {}
    # corpCode.xml returns zip — DART also offers JSON list via corpCode but XML zip is standard.
    # Use list.json alternative endpoint when available.
    listed = dart_get("company.json", {"corp_cls": "Y"}, api_key)
    rows = listed.get("list") or []
    out = {}
    for row in rows:
        stock = str(row.get("stock_code") or "").strip()
        corp = str(row.get("corp_code") or "").strip()
        if stock and corp:
            out[stock.zfill(6)] = corp
    return out


def fetch_disclosures(api_key: str, corp_codes: list[str], days: int = 14) -> list[dict]:
    end = datetime.now(KST).date()
    begin = end - timedelta(days=days)
    bgn = begin.strftime("%Y%m%d")
    end_s = end.strftime("%Y%m%d")
    out = []
    for corp_code in corp_codes[:120]:
        try:
            data = dart_get(
                "list.json",
                {
                    "corp_code": corp_code,
                    "bgn_de": bgn,
                    "end_de": end_s,
                    "pblntf_ty": REPORT_PBLNTF_CODES,
                    "page_count": "20",
                },
                api_key,
            )
        except Exception:
            continue
        if data.get("status") != "000":
            continue
        for row in data.get("list") or []:
            stock = str(row.get("stock_code") or "").strip().zfill(6)
            report = str(row.get("report_nm") or "").strip()
            rcept = str(row.get("rcept_no") or "").strip()
            rcept_dt = str(row.get("rcept_dt") or "").strip()
            if len(rcept_dt) == 8:
                rcept_dt = f"{rcept_dt[:4]}-{rcept_dt[4:6]}-{rcept_dt[6:8]}"
            out.append({
                "ticker": stock,
                "company": str(row.get("corp_name") or "").strip(),
                "title": report,
                "typeLabel": DISCLOSURE_LABELS.get(str(row.get("pblntf_detail_ty") or ""), str(row.get("pblntf_ty_nm") or "공시")),
                "fileDate": rcept_dt,
                "link": f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={rcept}" if rcept else "https://dart.fss.or.kr/",
            })
    out.sort(key=lambda x: (x.get("fileDate") or "", x.get("ticker") or ""), reverse=True)
    return out[:500]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--push", action="store_true")
    parser.add_argument("--days", type=int, default=14)
    args = parser.parse_args()

    api_key = os.environ.get("DART_API_KEY", "").strip()
    snapshot = load_json(KR_SNAPSHOT, {"stocks": []})
    tickers = sorted({
        str(s.get("ticker") or "").replace(".KS", "").replace(".KQ", "").zfill(6)
        for s in snapshot.get("stocks") or []
        if s.get("sector") not in ("ETF", "etf", "EXCHANGE TRADED FUNDS")
    })

    if not api_key:
        payload = {
            "updatedAtKst": now_kst(),
            "lastFileDate": datetime.now(KST).strftime("%Y-%m-%d"),
            "count": 0,
            "source": "DART Open API",
            "note": "DART_API_KEY 미설정 — GitHub Secrets에 등록 후 workflow를 실행하세요.",
            "disclosures": [],
        }
        write_outputs(payload)
        print("DART_API_KEY missing; wrote empty kr_disclosures payload.")
        return 0

    corp_map = load_corp_map(api_key)
    corp_codes = [corp_map[t] for t in tickers if t in corp_map]
    disclosures = fetch_disclosures(api_key, corp_codes, days=args.days)
    last_date = disclosures[0]["fileDate"] if disclosures else datetime.now(KST).strftime("%Y-%m-%d")
    payload = {
        "updatedAtKst": now_kst(),
        "lastFileDate": last_date,
        "count": len(disclosures),
        "source": "DART Open API",
        "note": "추적 KR 종목 한정. 실적·지분·주요사항 공시.",
        "disclosures": disclosures,
    }
    write_outputs(payload)
    print(f"Wrote {len(disclosures)} KR disclosures.")

    if args.push:
        with repository_publish_lock(ROOT):
            subprocess.run(["git", "add", str(OUT_JSON), str(OUT_JS)], cwd=ROOT, check=True)
            subprocess.run(
                ["git", "commit", "-m", f"data: KR DART disclosures ({len(disclosures)} rows)"],
                cwd=ROOT,
                check=False,
            )
            subprocess.run(["git", "push"], cwd=ROOT, check=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())