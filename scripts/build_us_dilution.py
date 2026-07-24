#!/usr/bin/env python3
"""미국 증자·희석 트래커 (SEC S-3 / S-3ASR / 424B5).

efts 전문검색으로 shelf 등록(S-3, S-3ASR·자동일괄신고)과 추가발행 보충서(424B5)를
모아 추적 universe(시총 스냅샷 종목)로 필터한다. shelf/유상증자는 기존 주주 지분
희석의 선행 신호라 별도 피드로 노출한다.

증분: 기존 data/us_dilution.json 의 lastFileDate 이후(겹침 며칠 포함)만 수집
(build_insider_trades 와 같은 패턴). 최초 실행은 --backfill-days 만큼 소급.
"""

from __future__ import annotations

import argparse
import re
import sys
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import sec_client as sec  # noqa: E402
from briefing_store import repository_publish_lock  # noqa: E402

OUT_JSON = ROOT / "data" / "us_dilution.json"
OUT_JS = ROOT / "data" / "us_dilution.js"

RETENTION_DAYS = 60
MAX_ROWS = 4000

FORMS = ("S-3", "S-3ASR", "424B5")
FORM_LABELS = {
    "S-3": "일괄신고 등록(Shelf)",
    "S-3/A": "일괄신고 정정",
    "S-3ASR": "자동 일괄신고(WKSI)",
    "424B5": "발행 보충서(추가발행)",
}

# 제목/파일설명에 금액이 명시된 경우만 amountUsd 를 채운다(모호하면 생략).
AMOUNT_RE = re.compile(r"\$\s*([\d,]+(?:\.\d+)?)\s*(billion|million)?", re.I)


def parse_amount_usd(*texts):
    """title/file_description 문자열에서 달러 금액을 찾는다.

    서로 다른 금액이 여러 개면 모호한 것으로 보고 None. 단위 없는 맨숫자는
    (액면가 등 오독 위험이 커서) 100만 달러 이상일 때만 인정한다.
    """
    values = set()
    for text in texts:
        if not text:
            continue
        for m in AMOUNT_RE.finditer(str(text)):
            try:
                v = float(m.group(1).replace(",", ""))
            except ValueError:
                continue
            unit = (m.group(2) or "").lower()
            if unit == "billion":
                v *= 1e9
            elif unit == "million":
                v *= 1e6
            elif v < 1e6:
                continue
            values.add(round(v, 2))
    return values.pop() if len(values) == 1 else None


def load_existing():
    if not OUT_JSON.exists():
        return [], None
    try:
        import json
        p = json.loads(OUT_JSON.read_text(encoding="utf-8"))
        return p.get("rows") or [], p.get("lastFileDate")
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

    merged = {r["accession"]: r for r in existing if r.get("accession")}
    new = 0
    total_hits = 0
    for form in FORMS:
        hits = sec.efts_hits(form, start.isoformat(), today.isoformat())
        total_hits += len(hits)
        kept = 0
        for hit in hits:
            src = hit.get("_source", {})
            hit_ciks = {int(c) for c in src.get("ciks", []) if str(c).isdigit()}
            matched = hit_ciks & cik_set
            if not matched:
                continue
            accession = src.get("adsh") or hit["_id"].split(":")[0]
            if accession in merged:
                continue
            cik = sorted(matched)[0]
            form_type = src.get("form") or form
            company = sec.clean_company_name((src.get("display_names") or [""])[0])
            acc_nodash = accession.replace("-", "")
            doc = hit["_id"].split(":")[1]
            row = {
                "ticker": cik_to_ticker.get(cik),
                "formType": form_type,
                "formLabel": FORM_LABELS.get(form_type, form_type),
                "fileDate": src.get("file_date"),
                "title": company,
                "url": f"https://www.sec.gov/Archives/edgar/data/{cik}/{acc_nodash}/{doc}",
                "accession": accession,
            }
            amount = parse_amount_usd(src.get("file_description"), company)
            if amount is not None:
                row["amountUsd"] = amount
            merged[accession] = row
            new += 1
            kept += 1
        print(f"    {form}: 전체 {len(hits)}건 / universe {kept}건")

    # 소스 전면 실패 방어: efts 가 한 건도 안 준 상태에서 덮어쓰지 않는다.
    if total_hits == 0:
        print("  [오류] efts 가 결과를 전혀 주지 않음 — 기존 파일 유지, exit 1", file=sys.stderr)
        raise SystemExit(1)

    cutoff = (today - timedelta(days=RETENTION_DAYS)).isoformat()
    rows = [r for r in merged.values() if (r.get("fileDate") or "") >= cutoff]
    rows.sort(key=lambda r: (r.get("fileDate") or "", r.get("accession") or ""), reverse=True)
    rows = rows[:MAX_ROWS]
    payload = {
        "updatedAtKst": sec.kst_now_str(),
        "lastFileDate": max((r.get("fileDate") or "" for r in rows), default=today.isoformat()),
        "count": len(rows),
        "source": "SEC EDGAR S-3 / S-3ASR / 424B5",
        "note": "추적 universe 한정. S-3=shelf 등록(발행 여력 확보), 424B5=실제 발행 보충서. "
                "amountUsd 는 제목/설명에 금액이 명시돼 단일 값으로 확정된 경우만.",
        "rows": rows,
    }
    print(f"  완료: 신규 {new}건 → 총 {len(rows)}건")
    return payload


def main():
    ap = argparse.ArgumentParser(description="SEC S-3/424B5 증자·희석 트래커")
    ap.add_argument("--backfill-days", type=int, default=45)
    ap.add_argument("--top", type=int, default=0, help="시총 상위 N 종목으로 universe 제한(0=전체)")
    ap.add_argument("--push", action="store_true", default=False)
    ap.add_argument("--no-push", action="store_true")
    args = ap.parse_args()
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    print("=== SEC 증자·희석 트래커 수집 시작 ===")
    payload = build(args.backfill_days, args.top)
    with repository_publish_lock(ROOT):
        sec.write_data(OUT_JSON, OUT_JS, "US_DILUTION", payload)
        print(f"Wrote {OUT_JSON} — {payload['count']} rows")
        if args.push and not args.no_push:
            sec.git_publish(["data/us_dilution.json", "data/us_dilution.js"], "US dilution")


if __name__ == "__main__":
    main()
