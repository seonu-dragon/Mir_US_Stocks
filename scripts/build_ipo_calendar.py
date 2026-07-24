#!/usr/bin/env python3
"""미국 IPO / 신규상장 캘린더 (SEC S-1 등록 + 424B4 상장 prospectus).

efts 전문검색으로 S-1(최초 등록)·S-1/A(정정)·424B4(가격확정 prospectus=상장)을 모은다.
신규 상장사라 추적 universe 와 무관하므로 시장 전체를 수집(건수가 적음).
"""

from __future__ import annotations

import argparse
import html as html_mod
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

# --- 424B4 공모가(offerPrice) 추출 ---------------------------------------
# 원문 prospectus 에서 "public offering price ... $X.XX per share" 류의 문장을
# 찾는다. 보수적으로 간다: 서로 다른 값이 여러 개 잡히면(모호) 필드를 생략한다.
# 리세일/ATM/직상장 prospectus 는 공모가 자체가 없어 None 이 정상이다.
_TAG_RE = re.compile(r"<[^>]+>")
_NUM = r"([\d,]+(?:\.\d+)?)"
OFFER_PRICE_PATTERNS = [
    # "public offering price of/is US$10.00 per (Class A Ordinary) share/ADS/unit"
    re.compile(
        r"(?:initial\s+)?public\s+offering\s+price\s+(?:of|is|will\s+be|at)\s+"
        r"(?:U\.?S\.?)?\$\s*" + _NUM + r"\s*per\s+(?:\w+\s+){0,4}?(?:share|ads|unit)",
        re.I),
    # "initial public offering price per share ... is $15.00"
    re.compile(
        r"(?:initial\s+)?public\s+offering\s+price\s+per\s+(?:\w+\s+){0,4}?"
        r"(?:share|ads|unit)[^.$]{0,120}?is\s+(?:U\.?S\.?)?\$\s*" + _NUM,
        re.I),
    # 표지 가격표: "Per Share Total Initial public offering price $ 15.00 $ ..."
    re.compile(
        r"\bper\s+(?:\w+\s+){0,4}?(?:share|ads|unit)\s+total\s+"
        r"(?:initial\s+)?public\s+offering\s+price\s*(?:\(\d+\))?\s*"
        r"(?:U\.?S\.?)?\$\s*" + _NUM,
        re.I),
]
PRICE_MIN, PRICE_MAX = 0.5, 5000.0  # 액면가($0.0001)·오독 방지 범위


def html_to_text(body_bytes):
    txt = _TAG_RE.sub(" ", body_bytes.decode("utf-8", "replace"))
    txt = html_mod.unescape(txt)
    return re.sub(r"\s+", " ", txt)


def extract_offer_price(text):
    """모든 패턴의 매치를 모아 서로 다른 값이 정확히 1개일 때만 반환."""
    values = set()
    for pat in OFFER_PRICE_PATTERNS:
        for m in pat.finditer(text):
            try:
                v = float(m.group(1).replace(",", ""))
            except ValueError:
                continue
            if PRICE_MIN <= v <= PRICE_MAX:
                values.add(round(v, 4))
    return values.pop() if len(values) == 1 else None


def enrich_offer_prices(ipos, max_fetches):
    """가격확정(424B4/424B1) 행의 원문을 받아 offerPrice 를 채운다.

    결과는 행 자체에 캐시된다 — offerPrice 가 있거나 offerPriceChecked 마커가
    있으면 다시 받지 않으므로 일일 실행이 옛 filing 을 재요청하지 않는다.
    """
    tried = found = 0
    for row in ipos:  # 최신순 정렬 상태 — 새 filing 부터 처리
        if tried >= max_fetches:
            print(f"    [offerPrice] 요청 상한 {max_fetches}건 도달 — 나머지는 다음 실행에서")
            break
        if row.get("stage") != "priced" or not row.get("link"):
            continue
        if row.get("offerPrice") is not None or row.get("offerPriceChecked"):
            continue
        tried += 1
        try:
            body = sec.sec_get(row["link"])
        except Exception as exc:
            if getattr(exc, "code", None) in (403, 404):
                row["offerPriceChecked"] = True  # 죽은 링크 — 재시도 무의미
            print(f"    [offerPrice] {row.get('ticker') or row.get('company')} 원문 실패: {exc}")
            continue
        price = extract_offer_price(html_to_text(body))
        if price is not None:
            row["offerPrice"] = price
            found += 1
        row["offerPriceChecked"] = True
    if tried:
        print(f"  offerPrice 추출: {tried}건 시도 → {found}건 확정")
    return found


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


def build(backfill_days, overlap_days=5, max_price_fetches=120):
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
    enrich_offer_prices(ipos, max_price_fetches)
    payload = {
        "updatedAtKst": sec.kst_now_str(),
        "lastFileDate": max((r.get("fileDate") or "" for r in ipos), default=today.isoformat()),
        "count": len(ipos),
        "source": "SEC EDGAR S-1 / 424B4",
        "note": "424B4=가격확정(상장 임박/직후), S-1=등록 신청. 티커는 prospectus에 표기된 경우만. "
                "offerPrice(주당 공모가 USD)는 424B4 원문에서 단일 값으로 확정된 경우만 채운다.",
        "ipos": ipos,
    }
    print(f"  완료: 신규 {new}건 → 총 {len(ipos)}건")
    return payload


def main():
    ap = argparse.ArgumentParser(description="SEC IPO 캘린더 수집")
    ap.add_argument("--backfill-days", type=int, default=30)
    ap.add_argument("--max-price-fetches", type=int, default=120,
                    help="한 실행에서 offerPrice 추출을 위해 받을 424B4 원문 수 상한")
    ap.add_argument("--push", action="store_true", default=False)
    ap.add_argument("--no-push", action="store_true")
    args = ap.parse_args()
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    print("=== SEC IPO 캘린더 수집 시작 ===")
    payload = build(args.backfill_days, max_price_fetches=args.max_price_fetches)
    with repository_publish_lock(ROOT):
        sec.write_data(OUT_JSON, OUT_JS, "IPO_CALENDAR", payload)
        print(f"Wrote {OUT_JSON} — {payload['count']} ipos")
        if args.push and not args.no_push:
            sec.git_publish(["data/ipo_calendar.json", "data/ipo_calendar.js"], "IPO calendar")


if __name__ == "__main__":
    main()
