#!/usr/bin/env python3
"""SEC 13F-HR 기관 보유 스냅샷 (최대 150개 기관 × 10분기).

데이터 소스: 13f.info (SEC 13F 공시 미러). 갱신 주기: 분기별.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import sec_client as sec  # noqa: E402
from briefing_store import repository_publish_lock  # noqa: E402
from institutions_13f_registry import UNIQUE_INSTITUTIONS  # noqa: E402

OUT_JSON = ROOT / "data" / "institutional_13f.json"
OUT_JS = ROOT / "data" / "institutional_13f.js"
KST = ZoneInfo("Asia/Seoul")

CURL = shutil.which("curl") or shutil.which("curl.exe")
QUARTER_ENDS = {1: "03-31", 2: "06-30", 3: "09-30", 4: "12-31"}
MAX_QUARTERS = 10
TOP_HOLDINGS = 25
# 이번 실행에서 최소 이만큼은 실제로 받아와야 발행한다. 2026-09-15 감사 실측:
# 131개 중 62개(47%)가 error 인데도 초록으로 발행되고 있었다.
MIN_OK_RATIO = 0.70


def curl_fetch(url: str) -> str:
    if not CURL:
        raise RuntimeError("curl not available")
    cmd = [
        CURL, "-sS", "-L", "--max-time", "120",
        "-H", "User-Agent: Mozilla/5.0 (compatible; MirUSStocks/1.0)",
        "-H", "Accept: text/html,application/json,*/*",
        url,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if proc.returncode != 0:
        raise RuntimeError(f"curl failed ({proc.returncode}): {proc.stderr.strip()}")
    return proc.stdout


def quarter_to_report_date(label: str) -> str:
    m = re.match(r"Q(\d)\s+(20\d{2})", label.strip(), re.I)
    if not m:
        return ""
    q, year = int(m.group(1)), int(m.group(2))
    return f"{year}-{QUARTER_ENDS[q]}"


def parse_manager_filings(html: str, limit: int = MAX_QUARTERS) -> list[dict]:
    """13f.info manager 페이지에서 13F-HR 분기 공시 목록 추출 (테이블 행 단위)."""
    filings: list[dict] = []
    seen: set[str] = set()
    for row in re.finditer(r"<tr[^>]*>(.*?)</tr>", html, re.S | re.I):
        row_html = row.group(0)
        text = re.sub(r"<[^>]+>", " ", row_html)
        text = " ".join(text.split())
        upper = text.upper()
        if "13F-HR" not in upper:
            continue
        if "NEW HOLDINGS" in upper or "RESTATEMENT" in upper:
            continue
        acc = re.search(r"/13f/(\d{18})", row_html)
        if not acc:
            acc = re.search(r"(\d{18})", row_html)
        quarter = re.search(r"Q[1-4]\s+20\d{2}", text)
        filed = re.search(r"(\d{1,2}/\d{1,2}/20\d{2})", text)
        if not acc or not quarter:
            continue
        acc_raw = acc.group(1)
        if acc_raw in seen:
            continue
        seen.add(acc_raw)
        q_label = quarter.group(0)
        report = quarter_to_report_date(q_label)
        filed_iso = ""
        if filed:
            try:
                filed_iso = datetime.strptime(filed.group(1), "%m/%d/%Y").strftime("%Y-%m-%d")
            except ValueError:
                filed_iso = filed.group(1)
        filings.append({
            "reportLabel": q_label,
            "reportDate": report,
            "filedDate": filed_iso,
            "accession": f"{acc_raw[:10]}-{acc_raw[10:12]}-{acc_raw[12:]}",
            "accessionRaw": acc_raw,
        })
    filings.sort(key=lambda row: row.get("reportDate") or "", reverse=True)
    deduped: list[dict] = []
    seen_reports: set[str] = set()
    for row in filings:
        key = row.get("reportDate") or row["accession"]
        if key in seen_reports:
            continue
        seen_reports.add(key)
        deduped.append(row)
        if len(deduped) >= limit:
            break
    return deduped


def aggregate_holdings(rows: list[dict], top_n: int = TOP_HOLDINGS) -> list[dict]:
    by_key: dict[str, dict] = {}
    for row in rows:
        key = f"{row['issuer']}|{row.get('titleOfClass', '')}|{row.get('putCall', '')}"
        if key not in by_key:
            by_key[key] = {**row}
        else:
            by_key[key]["valueK"] += row["valueK"]
            by_key[key]["shares"] += row["shares"]
    holdings = sorted(by_key.values(), key=lambda r: r["valueK"], reverse=True)
    total = sum(h["valueK"] for h in holdings) or 1
    for h in holdings:
        h["weightPct"] = round((h["valueK"] / total) * 100, 2)
        h["valueM"] = round(h["valueK"] / 1000, 1)
    return holdings[:top_n]


def holdings_from_13finfo(accession_raw: str) -> list[dict]:
    url = f"https://13f.info/data/13f/{accession_raw}"
    payload = json.loads(curl_fetch(url))
    rows = []
    for item in payload.get("data", []):
        if not item or len(item) < 7:
            continue
        put_call = ""
        if len(item) > 8 and item[8]:
            raw_pc = str(item[8]).strip().lower()
            if raw_pc in {"put", "call"}:
                put_call = raw_pc
        rows.append({
            "ticker": str(item[0] or "").strip().upper(),
            "issuer": str(item[1]).strip(),
            "titleOfClass": str(item[2]).strip(),
            "cusip": str(item[3]).strip(),
            "valueK": int(item[4]),
            "shares": int(item[6] or 0),
            "putCall": put_call,
        })
    if not rows:
        raise RuntimeError("13f.info returned no holdings")
    return aggregate_holdings(rows)


def institution_quarters(cik: str, quarters: int = MAX_QUARTERS) -> list[dict]:
    padded = str(int(cik)).zfill(10)
    html = curl_fetch(f"https://13f.info/manager/{padded}")
    filings = parse_manager_filings(html, limit=quarters)
    if not filings:
        raise RuntimeError("No 13F-HR filings found on 13f.info")
    out = []
    for filing in filings:
        holdings = holdings_from_13finfo(filing["accessionRaw"])
        out.append({**filing, "holdings": holdings, "status": "ok"})
        time.sleep(0.12)
    return out


def load_previous() -> dict[str, dict]:
    """직전 산출물의 기관별 레코드(cik → 레코드). 없으면 빈 dict."""
    if not OUT_JSON.exists():
        return {}
    try:
        prev = json.loads(OUT_JSON.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"[warn] 이전 13F 파일을 읽지 못함(무시): {exc}")
        return {}
    out = {}
    for rec in prev.get("institutions") or []:
        cik = str(rec.get("cik") or "").strip()
        if cik:
            out[cik] = rec
    return out


def build_payload(limit: int, quarters: int) -> tuple[dict, int, int]:
    institutions = UNIQUE_INSTITUTIONS[:limit]
    previous = load_previous()
    payload = {
        "updatedAtKst": datetime.now(KST).strftime("%Y-%m-%d %H:%M KST"),
        "updateSchedule": "quarterly",
        "source": "SEC EDGAR 13F-HR via 13f.info",
        "note": "분기마다 제출되는 공시 기준 보유 내역입니다. 실시간 매매가 아닙니다.",
        "quartersPerInstitution": quarters,
        "institutionCount": len(institutions),
        "institutions": [],
    }
    ok = 0
    carried = 0
    for inst in institutions:
        try:
            inst_quarters = institution_quarters(inst["cik"], quarters=quarters)
            latest = inst_quarters[0] if inst_quarters else {}
            payload["institutions"].append({
                **inst,
                "status": "ok",
                "reportDate": latest.get("reportDate", ""),
                "filedDate": latest.get("filedDate", ""),
                "accession": latest.get("accession", ""),
                "holdings": latest.get("holdings", []),
                "quarters": inst_quarters,
            })
            ok += 1
            top = latest.get("holdings", [{}])[0].get("issuer", "-")
            print(f"[ok] {inst['name']} quarters={len(inst_quarters)} top={top}")
        except Exception as exc:
            # 기관 단위 prev-merge: 이번에 못 받은 기관은 직전 분기 데이터를
            # 그대로 유지한다. 예전엔 holdings=[] 로 덮어써서 소스가 흔들린
            # 날 화면에서 그 기관이 통째로 사라졌다(2026-09-15 감사).
            prev = previous.get(str(inst.get("cik") or "").strip())
            if prev and prev.get("quarters"):
                payload["institutions"].append({
                    **inst,
                    "status": "carried",
                    "error": str(exc),
                    "carriedFrom": prev.get("carriedFrom") or prev.get("reportDate") or "",
                    "reportDate": prev.get("reportDate", ""),
                    "filedDate": prev.get("filedDate", ""),
                    "accession": prev.get("accession", ""),
                    "holdings": prev.get("holdings") or [],
                    "quarters": prev.get("quarters") or [],
                })
                carried += 1
                print(f"[carry] {inst['name']}: {exc} — 직전 값 유지")
            else:
                payload["institutions"].append({
                    **inst,
                    "status": "error",
                    "error": str(exc),
                    "holdings": [],
                    "quarters": [],
                })
                print(f"[err] {inst['name']}: {exc}")
        time.sleep(0.25)
    payload["okCount"] = ok
    payload["carriedCount"] = carried
    payload["errorCount"] = len(institutions) - ok - carried
    return payload, ok, len(institutions)


def write_files(payload: dict) -> None:
    # 공용 write_data 경유 — 0건으로 기존 파일을 덮는 회귀를 assert_not_emptying 이 막는다.
    # (예전엔 atomic_write_text 로 직행해 이 게이트를 통째로 우회했다)
    sec.write_data(OUT_JSON, OUT_JS, "INSTITUTIONAL_13F", payload)


def publish() -> bool:
    return sec.git_publish(["data/institutional_13f.json", "data/institutional_13f.js"],
                           "institutional 13F")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=len(UNIQUE_INSTITUTIONS), help="기관 수 제한")
    parser.add_argument("--quarters", type=int, default=MAX_QUARTERS, help="기관당 분기 수")
    parser.add_argument("--push", action="store_true", default=False)
    parser.add_argument("--no-push", action="store_true")
    args = parser.parse_args()

    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")

    print("=== SEC 13F-HR 기관 보유 스냅샷 빌드 시작 ===")
    payload, ok, total = build_payload(args.limit, args.quarters)
    carried = payload.get("carriedCount", 0)
    if total and ok < total * MIN_OK_RATIO:
        raise SystemExit(
            f"[중단] 13F 신규 수집 {ok}/{total}건 ({ok / total:.0%}) — "
            f"하한 {MIN_OK_RATIO:.0%} 미달. 기존 파일을 유지하고 실패로 끝낸다"
            f"(승계 {carried}건). 13f.info 소스를 확인할 것."
        )
    with repository_publish_lock(ROOT):
        write_files(payload)
        print(f"Wrote {OUT_JSON} ({ok}/{total} ok, 승계 {carried}건)")
        if args.push and not args.no_push:
            if not publish():
                raise SystemExit("[중단] 13F 스냅샷 push 실패 — 발행되지 않았다")


if __name__ == "__main__":
    main()