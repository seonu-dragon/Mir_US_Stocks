#!/usr/bin/env python3
"""액티비스트/대량보유 지분 공시 (SEC SCHEDULE 13D / 13G).

efts 가 13D/G 를 안정적으로 인덱싱하지 않아, 일별 form.idx 에서 'SCHEDULE 13D/G'
행을 모은 뒤 각 제출의 SGML 헤더에서 SUBJECT(대상기업)·FILED BY(신고자)를 파싱한다.
대상기업 CIK 가 추적 universe 에 있는 건만 보관.

  13D = 경영참여(액티비스트) 목적, 13G = 단순투자(수동) · /A = 정정
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

OUT_JSON = ROOT / "data" / "activist_stakes.json"
OUT_JS = ROOT / "data" / "activist_stakes.js"

RETENTION_DAYS = 60
MAX_ROWS = 1500
FORM_PREFIXES = ["SCHEDULE 13D", "SCHEDULE 13G"]


def _field(block, name):
    m = re.search(name + r":\s*(.+)", block)
    return m.group(1).strip() if m else None


def parse_header(text):
    """SGML 헤더에서 (subject_cik, subject_name, filer_name, form) 추출."""
    hdr = text[:4000]
    form = _field(hdr, "CONFORMED SUBMISSION TYPE")
    subj_m = re.search(r"SUBJECT COMPANY:(.*?)(FILED BY:|$)", hdr, re.DOTALL)
    filer_m = re.search(r"FILED BY:(.*?)$", hdr, re.DOTALL)
    subject_cik = subject_name = filer_name = None
    if subj_m:
        b = subj_m.group(1)
        subject_name = _field(b, "COMPANY CONFORMED NAME")
        cik = _field(b, "CENTRAL INDEX KEY")
        subject_cik = int(cik) if cik and cik.isdigit() else None
    if filer_m:
        b = filer_m.group(1)
        filer_name = _field(b, "COMPANY CONFORMED NAME") or _field(b, "OWNER NAME")
    return subject_cik, subject_name, filer_name, form


def classify(form):
    f = (form or "").upper()
    amended = "/A" in f
    if "13D" in f:
        return ("13D" + ("/A" if amended else ""), "경영참여(액티비스트)", "activist")
    return ("13G" + ("/A" if amended else ""), "단순투자(수동)", "passive")


def load_existing():
    if not OUT_JSON.exists():
        return [], None
    try:
        p = json.loads(OUT_JSON.read_text(encoding="utf-8"))
        return p.get("filings") or [], p.get("lastDate")
    except Exception:
        return [], None


def build(backfill_days, top, overlap_days=5):
    today = sec.et_today()
    existing, last = load_existing()
    start = (date.fromisoformat(last) - timedelta(days=overlap_days)) if (existing and last) \
        else today - timedelta(days=backfill_days)
    print(f"  수집 구간: {start} ~ {today} (기존 {len(existing)}건)")

    cik_set, cik_to_ticker = sec.universe_cik_map(top=top)
    print(f"  universe CIK: {len(cik_set)}")

    merged = {r["accession"]: r for r in existing}
    new = 0
    day = start
    while day <= today:
        iso = day.isoformat()
        rows = sec.daily_index_rows(iso, FORM_PREFIXES)
        kept = 0
        for row in rows:
            accession = row["path"].split("/")[-1].replace(".txt", "")
            if accession in merged:
                continue
            try:
                text = sec.sec_get("https://www.sec.gov/Archives/" + row["path"]).decode("latin-1", "replace")
            except Exception:
                continue
            subject_cik, subject_name, filer_name, form = parse_header(text)
            if not subject_cik or subject_cik not in cik_set:
                continue
            form_label, kind_label, kind = classify(form or row["form"])
            merged[accession] = {
                "ticker": cik_to_ticker.get(subject_cik),
                "company": sec.clean_company_name(subject_name) or "",
                "filer": (filer_name or "").title() if filer_name and filer_name.isupper() else (filer_name or ""),
                "form": form_label,
                "kind": kind,
                "kindLabel": kind_label,
                "fileDate": row["date"],
                "accession": accession,
                "link": "https://www.sec.gov/Archives/" + row["path"],
            }
            new += 1
            kept += 1
        if rows:
            print(f"    {iso}: 13D/G 전체 {len(rows)} / universe {kept}")
        day += timedelta(days=1)

    cutoff = (today - timedelta(days=RETENTION_DAYS)).isoformat()
    filings = [r for r in merged.values() if (r.get("fileDate") or "") >= cutoff]
    filings.sort(key=lambda r: (r.get("fileDate") or "", r.get("accession") or ""), reverse=True)
    filings = filings[:MAX_ROWS]
    payload = {
        "updatedAtKst": sec.kst_now_str(),
        "lastDate": max((r.get("fileDate") or "" for r in filings), default=today.isoformat()),
        "count": len(filings),
        "source": "SEC EDGAR SCHEDULE 13D/13G",
        "note": "추적 종목 한정. 13D=경영참여(액티비스트), 13G=단순투자(5%+ 대량보유).",
        "filings": filings,
    }
    print(f"  완료: 신규 {new}건 → 총 {len(filings)}건")
    return payload


def main():
    ap = argparse.ArgumentParser(description="SEC 13D/G 대량보유 공시 수집")
    ap.add_argument("--backfill-days", type=int, default=21)
    ap.add_argument("--top", type=int, default=0, help="0=전체 universe")
    ap.add_argument("--push", action="store_true", default=False)
    ap.add_argument("--no-push", action="store_true")
    args = ap.parse_args()
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    print("=== SEC 13D/G 대량보유 공시 수집 시작 ===")
    payload = build(args.backfill_days, args.top)
    with repository_publish_lock(ROOT):
        sec.write_data(OUT_JSON, OUT_JS, "ACTIVIST_STAKES", payload)
        print(f"Wrote {OUT_JSON} — {payload['count']} filings")
        if args.push and not args.no_push:
            sec.git_publish(["data/activist_stakes.json", "data/activist_stakes.js"], "activist stakes")


if __name__ == "__main__":
    main()
