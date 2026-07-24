#!/usr/bin/env python3
"""미국 기업 주요 공시(SEC 8-K) 피드.

efts 전문검색으로 날짜별 8-K 를 받아 추적 universe 로 필터한다. 8-K 의 item 코드는
efts 히트의 _source.items 에 들어 있어 문서를 받지 않고도 이벤트를 분류할 수 있다.
"""

from __future__ import annotations

import argparse
import html as html_mod
import re
import sys
import urllib.parse
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import sec_client as sec  # noqa: E402
from briefing_store import repository_publish_lock  # noqa: E402

OUT_JSON = ROOT / "data" / "material_events.json"
OUT_JS = ROOT / "data" / "material_events.js"

RETENTION_DAYS = 30
MAX_ROWS = 9000

# 8-K Item 코드 → (한글 라벨, 중요도 hot 여부)
ITEM_LABELS = {
    "1.01": ("중요계약 체결", True),
    "1.02": ("중요계약 종료", True),
    "1.03": ("파산/법정관리", True),
    "2.01": ("자산 인수·처분", True),
    "2.02": ("실적 발표", True),
    "2.03": ("채무·부외부채 발생", False),
    "2.04": ("채무 조기상환 사유", False),
    "2.05": ("구조조정 비용", False),
    "2.06": ("자산 손상차손", False),
    "3.01": ("상장폐지·규정 미준수", True),
    "3.02": ("주식 비등록 매각", False),
    "3.03": ("주주 권리 변경", False),
    "4.01": ("회계법인 변경", True),
    "4.02": ("과거 재무제표 신뢰불가", True),
    "5.01": ("지배권 변경", True),
    "5.02": ("임원·이사 변동", True),
    "5.03": ("정관 변경", False),
    "5.07": ("주총 투표결과", False),
    "7.01": ("Reg FD 공시", False),
    "8.01": ("기타 주요 이벤트", False),
    "9.01": ("재무제표·첨부", False),
}


# --- 자사주(buyback) 태깅 ---------------------------------------------------
# 8-K 행에는 제목/요약 텍스트가 없으므로(efts item 코드만 옴) efts 전문검색의
# 구문 질의로 repurchase|buyback 을 담은 8-K accession 집합을 만들어 행에
# 매칭한다. 금액은 매칭된 첨부문서(보도자료 등)에서 "$X billion/million" 이
# repurchase/buyback 키워드에 인접하고 단일 값으로 확정될 때만 채운다.
BUYBACK_QUERIES = ('"repurchase program"', '"share repurchase"', '"buyback"')
BUYBACK_WORD_RE = re.compile(r"repurchase|buyback", re.I)
BUYBACK_AMOUNT_RE = re.compile(r"\$\s*([\d,]+(?:\.\d+)?)\s*(billion|million)\b", re.I)
BUYBACK_WINDOW = 300           # 키워드 앞뒤 몇 글자에서 금액을 찾을지
MAX_BUYBACK_DOC_FETCHES = 80   # 한 실행의 금액추출용 원문 요청 상한
_TAG_RE = re.compile(r"<[^>]+>")


def efts_query_hits(query, form, startdt, enddt, cap=10000):
    """sec.efts_hits 와 동일하되 q(전문검색 구문)를 지정한다."""
    hits = []
    frm = 0
    while frm < cap:
        q = urllib.parse.urlencode({
            "q": query, "forms": form, "startdt": startdt, "enddt": enddt, "from": frm,
        })
        try:
            data = sec.sec_get_json(f"{sec.EFTS_URL}?{q}")
        except Exception as exc:
            print(f"    [경고] efts q={query} {startdt}~{enddt} from={frm} 실패: {exc}")
            break
        page = data.get("hits", {}).get("hits", [])
        if not page:
            break
        hits.extend(page)
        total = data.get("hits", {}).get("total", {}).get("value", 0)
        frm += len(page)
        if frm >= total:
            break
    return hits


def find_buyback_docs(start_iso, end_iso):
    """구간 내 repurchase/buyback 8-K → {accession: 매칭 문서 파일명}."""
    docs = {}
    for query in BUYBACK_QUERIES:
        for hit in efts_query_hits(query, "8-K", start_iso, end_iso):
            src = hit.get("_source", {})
            adsh = src.get("adsh") or hit["_id"].split(":")[0]
            docs.setdefault(adsh, hit["_id"].split(":")[1])
    return docs


def extract_buyback_amount(text):
    """repurchase/buyback 키워드 주변의 달러 금액. 단일 값일 때만 반환."""
    values = set()
    for m in BUYBACK_WORD_RE.finditer(text):
        window = text[max(0, m.start() - BUYBACK_WINDOW): m.start() + BUYBACK_WINDOW]
        for am in BUYBACK_AMOUNT_RE.finditer(window):
            try:
                v = float(am.group(1).replace(",", ""))
            except ValueError:
                continue
            v *= 1e9 if am.group(2).lower() == "billion" else 1e6
            values.add(round(v, 2))
    return values.pop() if len(values) == 1 else None


def tag_buybacks(events):
    """보관 중인 모든 행을 대상으로 매 실행 태깅(순수 추가 — 기존 필드 불변).

    - kind="buyback" 은 efts 구문검색 매칭으로 세운다(해제하지 않음 — 일시적
      검색 실패로 태그가 사라지지 않게).
    - 금액 추출용 원문 요청은 행별 1회: buybackChecked 마커로 캐시.
    """
    if not events:
        return
    dates = [e.get("fileDate") for e in events if e.get("fileDate")]
    if not dates:
        return
    try:
        docs = find_buyback_docs(min(dates), max(dates))
    except Exception as exc:
        print(f"  [경고] buyback 태깅 질의 실패 — 이번 실행은 건너뜀: {exc}")
        return
    tagged = fetched = amounts = 0
    for e in events:
        doc = docs.get(e.get("accession"))
        if not doc:
            continue
        if e.get("kind") != "buyback":
            e["kind"] = "buyback"
        tagged += 1
        if e.get("amountUsd") is not None or e.get("buybackChecked"):
            continue
        if fetched >= MAX_BUYBACK_DOC_FETCHES:
            continue
        url = e.get("link") or ""
        if not url:
            e["buybackChecked"] = True
            continue
        fetched += 1
        try:
            body = sec.sec_get(url.rsplit("/", 1)[0] + "/" + doc)
        except Exception as exc:
            if getattr(exc, "code", None) in (403, 404):
                e["buybackChecked"] = True
            continue
        text = re.sub(r"\s+", " ", html_mod.unescape(_TAG_RE.sub(" ", body.decode("utf-8", "replace"))))
        amount = extract_buyback_amount(text)
        if amount is not None:
            e["amountUsd"] = amount
            amounts += 1
        e["buybackChecked"] = True
    print(f"  buyback 태깅: {tagged}건 태그, 원문 {fetched}건 조회, 금액 확정 {amounts}건")


def label_items(items):
    out = []
    hot = False
    for code in items or []:
        lbl, is_hot = ITEM_LABELS.get(code, (f"Item {code}", False))
        out.append({"code": code, "label": lbl})
        hot = hot or is_hot
    return out, hot


def load_existing():
    if not OUT_JSON.exists():
        return [], None
    try:
        import json
        p = json.loads(OUT_JSON.read_text(encoding="utf-8"))
        return p.get("events") or [], p.get("lastFileDate")
    except Exception:
        return [], None


def build(backfill_days, top, overlap_days=3):
    today = sec.et_today()
    existing, last = load_existing()
    start = (date.fromisoformat(last) - timedelta(days=overlap_days)) if (existing and last) \
        else today - timedelta(days=backfill_days)
    print(f"  수집 구간: {start} ~ {today} (기존 {len(existing)}건)")

    cik_set, cik_to_ticker = sec.universe_cik_map(top=top)
    print(f"  universe CIK: {len(cik_set)}")

    merged = {e["accession"]: e for e in existing}
    new = 0
    day = start
    while day <= today:
        iso = day.isoformat()
        hits = sec.efts_hits("8-K", iso, iso)
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
            items, hot = label_items(src.get("items"))
            if not items:
                continue
            acc_nodash = accession.replace("-", "")
            doc = hit["_id"].split(":")[1]
            merged[accession] = {
                "ticker": cik_to_ticker.get(cik),
                "company": sec.clean_company_name((src.get("display_names") or [""])[0]),
                "items": items,
                "hot": hot,
                "fileDate": src.get("file_date"),
                "accession": accession,
                "link": f"https://www.sec.gov/Archives/edgar/data/{cik}/{acc_nodash}/{doc}",
            }
            new += 1
            kept += 1
        if hits:
            print(f"    {iso}: 8-K 전체 {len(hits)} / universe {kept}")
        day += timedelta(days=1)

    cutoff = (today - timedelta(days=RETENTION_DAYS)).isoformat()
    events = [e for e in merged.values() if (e.get("fileDate") or "") >= cutoff]
    events.sort(key=lambda e: (e.get("fileDate") or "", e.get("accession") or ""), reverse=True)
    events = events[:MAX_ROWS]
    tag_buybacks(events)
    payload = {
        "updatedAtKst": sec.kst_now_str(),
        "lastFileDate": max((e.get("fileDate") or "" for e in events), default=today.isoformat()),
        "count": len(events),
        "source": "SEC EDGAR 8-K",
        "note": "추적 종목 한정. item 코드 기반 이벤트 분류이며 상세는 원문 링크 참조. "
                "kind=buyback 은 전문검색 매칭 자사주 발표, amountUsd 는 원문에서 단일 값으로 확정된 경우만.",
        "events": events,
    }
    print(f"  완료: 신규 {new}건 → 총 {len(events)}건")
    return payload


def main():
    ap = argparse.ArgumentParser(description="SEC 8-K 주요 공시 수집")
    ap.add_argument("--backfill-days", type=int, default=14)
    ap.add_argument("--top", type=int, default=1500)
    ap.add_argument("--push", action="store_true", default=False)
    ap.add_argument("--no-push", action="store_true")
    args = ap.parse_args()
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    print("=== SEC 8-K 주요 공시 수집 시작 ===")
    payload = build(args.backfill_days, args.top)
    with repository_publish_lock(ROOT):
        sec.write_data(OUT_JSON, OUT_JS, "MATERIAL_EVENTS", payload)
        print(f"Wrote {OUT_JSON} — {payload['count']} events")
        if args.push and not args.no_push:
            sec.git_publish(["data/material_events.json", "data/material_events.js"], "material events")


if __name__ == "__main__":
    main()
