#!/usr/bin/env python3
"""미국 IPO / 신규상장 캘린더 (SEC S-1 등록 + 424B4 상장 prospectus).

efts 전문검색으로 S-1(최초 등록)·S-1/A(정정)·424B4(가격확정 prospectus=상장)을 모은다.
신규 상장사라 추적 universe 와 무관하므로 시장 전체를 수집(건수가 적음).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import sec_client as sec  # noqa: E402
from briefing_store import repository_publish_lock  # noqa: E402

OUT_JSON = ROOT / "data" / "ipo_calendar.json"
OUT_JS = ROOT / "data" / "ipo_calendar.js"

RETENTION_DAYS = 60
MAX_ROWS = 1200

# efts form → (한글 단계 라벨, 단계 코드)
FORM_STAGE = {
    "424B4": ("상장(가격확정)", "priced"),
    "424B1": ("상장(가격확정)", "priced"),
    "S-1": ("등록 신청", "filed"),
    "S-1/A": ("등록 정정", "amended"),
}

TICKER_RE = re.compile(r"\(([A-Z][A-Z0-9.\-]{0,6})\)\s*$")


def parse_name_ticker(display_names):
    name = sec.clean_company_name((display_names or [""])[0])
    m = TICKER_RE.search(name)
    ticker = m.group(1) if m else None
    clean = TICKER_RE.sub("", name).strip() if ticker else name
    return clean, ticker


def load_existing():
    if not OUT_JSON.exists():
        return [], None
    try:
        p = json.loads(OUT_JSON.read_text(encoding="utf-8"))
        return p.get("ipos") or [], p.get("lastFileDate")
    except Exception:
        return [], None


def build(backfill_days, overlap_days=5):
    today = sec.et_today()
    existing, last = load_existing()
    start = (date.fromisoformat(last) - timedelta(days=overlap_days)) if (existing and last) \
        else today - timedelta(days=backfill_days)
    print(f"  수집 구간: {start} ~ {today} (기존 {len(existing)}건)")

    merged = {r["accession"]: r for r in existing}
    new = 0
    # 며칠씩 끊어 efts 조회(폼별)
    for form in ("424B4", "S-1", "S-1/A"):
        hits = sec.efts_hits(form, start.isoformat(), today.isoformat())
        stage_label, stage = FORM_STAGE.get(form, (form, "filed"))
        for hit in hits:
            src = hit.get("_source", {})
            accession = src.get("adsh") or hit["_id"].split(":")[0]
            key = f"{accession}:{form}"
            if key in merged:
                continue
            company, ticker = parse_name_ticker(src.get("display_names"))
            ciks = src.get("ciks", [])
            cik = int(ciks[0]) if ciks and str(ciks[0]).isdigit() else 0
            acc_nodash = accession.replace("-", "")
            doc = hit["_id"].split(":")[1]
            merged[key] = {
                "company": company,
                "ticker": ticker,
                "stage": stage,
                "stageLabel": stage_label,
                "form": src.get("form") or form,
                "fileDate": src.get("file_date"),
                "accession": key,
                "link": f"https://www.sec.gov/Archives/edgar/data/{cik}/{acc_nodash}/{doc}" if cik else "",
            }
            new += 1
        print(f"    {form}: {len(hits)}건")

    cutoff = (today - timedelta(days=RETENTION_DAYS)).isoformat()
    ipos = [r for r in merged.values() if (r.get("fileDate") or "") >= cutoff]
    ipos.sort(key=lambda r: (r.get("fileDate") or "", r.get("accession") or ""), reverse=True)
    ipos = ipos[:MAX_ROWS]
    payload = {
        "updatedAtKst": sec.kst_now_str(),
        "lastFileDate": max((r.get("fileDate") or "" for r in ipos), default=today.isoformat()),
        "count": len(ipos),
        "source": "SEC EDGAR S-1 / 424B4",
        "note": "424B4=가격확정(상장 임박/직후), S-1=등록 신청. 티커는 prospectus에 표기된 경우만.",
        "ipos": ipos,
    }
    print(f"  완료: 신규 {new}건 → 총 {len(ipos)}건")
    return payload


def main():
    ap = argparse.ArgumentParser(description="SEC IPO 캘린더 수집")
    ap.add_argument("--backfill-days", type=int, default=30)
    ap.add_argument("--push", action="store_true", default=False)
    ap.add_argument("--no-push", action="store_true")
    args = ap.parse_args()
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    print("=== SEC IPO 캘린더 수집 시작 ===")
    payload = build(args.backfill_days)
    with repository_publish_lock(ROOT):
        sec.write_data(OUT_JSON, OUT_JS, "IPO_CALENDAR", payload)
        print(f"Wrote {OUT_JSON} — {payload['count']} ipos")
        if args.push and not args.no_push:
            sec.git_publish(["data/ipo_calendar.json", "data/ipo_calendar.js"], "IPO calendar")


if __name__ == "__main__":
    main()
