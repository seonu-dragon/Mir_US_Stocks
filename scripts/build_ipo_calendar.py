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
# 원칙 두 가지.
#   (1) 틀린 값을 싣지 않는다 — 한 증거 단계 안에서 서로 다른 값이 남으면 생략.
#   (2) "공모가가 없는 공시"와 "우리가 못 읽은 공시"를 구분한다 — 전자만
#       offerPriceNone/offerPriceNoneReason 으로 명시하고, 후자는 무표기로 둔다.
#
# 증거 단계(강→약). 매치가 하나라도 나온 단계에서 판정을 끝낸다 — 약한 단계로
# 흘러가 다른 값을 줍지 않기 위해서다.
#   Tier 1 표지 가격표("Per Share ... Public offering price $15.00") — 확정가의 정본
#   Tier 2 본문 문장("public offering price of $15.00 per share")
#   Tier 3 "public" 없는 "offering price of $0.40 per Unit"(소형 유닛 공모 전용)
# 본문에는 과거 IPO 가격·희석표 가격이 섞여 있다(팔로우온 424B4 가 자기 IPO
# 공모가를 언급, SPAC 희석표가 유닛가 $10 을 주당 $8 로 쪼개 표시). Tier 2 만
# 보면 값이 갈려 전부 생략됐다 — 표지 표를 먼저 보는 이유다.
OFFER_PRICE_PARSER_VERSION = 2  # 추출 로직 세대 — 행의 offerPriceChecked 에 기록

_TAG_RE = re.compile(r"<[^>]+>")
# EDGAR 표지 표는 셀 사이에 zero-width space 를 흩뿌린다. 남겨두면 정규식이
# "price: <ZWSP> $ 10.00" 을 못 읽는다(파이썬 \s 에 U+200B 는 포함되지 않는다).
_INVISIBLE_RE = re.compile("[\u200b\u200c\u200d\u2060\ufeff\u00ad]")
_NUM = r"([\d,]+(?:\.\d+)?)"
_MONEY = r"(?:U\.?S\.?)?\$\s*" + _NUM
_SEC = r"(?:shares?|ads|units?)"
# 표지 표의 열 머리 — "Per Share", "Per Class A Ordinary Share", "Per Unit",
# "Per Share and Accompanying Warrant"
_PER_COL = r"per\s+(?:[A-Za-z][\w.'\-]*\s+){0,6}?" + _SEC
_PRICE_LABEL = (r"(?:initial\s+)?(?:public\s+offering\s+price"
                r"|price\s+to\s+(?:the\s+)?public|offering\s+price\s+to\s+the\s+public)")
# 라벨과 금액 사이에 허용하는 것은 각주 "(1)" 와 콜론뿐 — 금액이 바로 붙어야 한다.
# 느슨하게 두면 "Public offering price 100.000 % $100,000,000"(채권 표지)에서
# 총액을 주당가로 오독한다.
_LABEL_TO_MONEY = r"\s*(?:\(\d+\))?\s*:?\s*" + _MONEY
# 표지 표 안에서 열 머리와 가격 라벨 사이를 잇는 부분. 두 가지를 요구한다.
#   - 마침표 금지: 표 머리에는 문장이 없다. 없으면 "…pay to us for the shares.
#     Paid by the Company No Exercise Full Exercise Per Share $1.82"(인수수수료
#     문단)가 주당 공모가로 둔갑한다.
#   - 형제 열 머리(Total/Proceeds/Discounts/Commissions/Exercise) 존재: 진짜
#     가격표에는 반드시 옆 칸이 있다. 없으면 "…per share to investors purchasing
#     shares … at the public offering price $14.08"(희석 문장)까지 걸린다.
_GAP = r"(?:(?!\.)[^$]){0,150}?"
_SIBLING = (r"(?=(?:(?!\.)[^$]){0,150}?"
            r"\b(?:total|proceeds|discounts?|commissions?|exercise|gross)\b)")

COVER_TABLE_PATTERNS = [
    # "Per Share  Total  Public offering price $ 25.00 $ 173,913,050"
    re.compile(_PER_COL + _SIBLING + _GAP + _PRICE_LABEL + _LABEL_TO_MONEY, re.I),
    # 열/행이 뒤집힌 표: "Price to Public  Underwriting ...  Per Unit $ 10.00 $ 0.12"
    re.compile(_PRICE_LABEL + _SIBLING + _GAP + _PER_COL + _LABEL_TO_MONEY, re.I),
]
PROSE_PATTERNS = [
    # "(combined) public offering price of/is US$10.00 per (Class A Ordinary) share/ADS/unit"
    re.compile(
        r"(?:initial\s+)?public\s+offering\s+price\s+(?:of|is|will\s+be|at)\s+"
        + _MONEY + r"\s*per\s+(?:\w+\s+){0,4}?" + _SEC,
        re.I),
    # "initial public offering price per share ... is $15.00"
    re.compile(
        r"(?:initial\s+)?public\s+offering\s+price\s+per\s+(?:\w+\s+){0,4}?"
        + _SEC + r"[^.$]{0,120}?is\s+" + _MONEY,
        re.I),
]
BARE_PRICE_PATTERNS = [
    # "at an offering price of US$0.40 per Unit" — 소형 유닛/베스트에포트 공모는
    # 표지 표 없이 이 표현만 쓰기도 한다.
    re.compile(r"\boffering\s+price\s+(?:of|is|at|will\s+be)\s+" + _MONEY
               + r"\s*per\s+(?:\w+\s+){0,4}?" + _SEC, re.I),
    # "The offering price for the Units in this offering is US$0.40."
    re.compile(r"\boffering\s+price\s+(?:for|of)\s+the\s+" + _SEC
               + r"[^.$]{0,80}?is\s+" + _MONEY, re.I),
]
# 액면가($0.0001)·워런트 행사가 오독을 막는 범위. 하한이 0.5 이던 시절엔 주당
# $0.15~$0.40 로 확정된 소형 공모를 전부 놓쳤다 — 패턴이 "(public) offering
# price" 문구를 요구하므로 하한을 낮춰도 액면가를 줍지 않는다.
PRICE_MIN, PRICE_MAX = 0.01, 5000.0

# 공모가가 "없는 게 정상"인 prospectus 유형. 후보값이 0건일 때만 적용한다 —
# 값이 갈려서 생략한 경우(모호)는 '없음'이 아니라 '모름'이다.
NO_OFFER_PRICE_RULES = [
    # 10-Q/8-K 를 붙이는 보충서 — 발행 조건 자체가 실리지 않는다.
    ("supplement", re.compile(
        r"prospectus\s+supplement[^.]{0,300}?supplements?\s+"
        r"(?:and\s+supplements\s+)?the\s+(?:information\s+in\s+the\s+)?prospectus", re.I)),
    # 채권/노트 — 가격이 액면 대비 %라 주당 공모가 개념이 없다.
    ("debt", re.compile(
        r"\bper\s+note\b|aggregate\s+principal\s+amount\s+of\s+(?:the\s+)?notes"
        r"|price\s+to\s+public\s+100(?:\.0+)?\s*%", re.I)),
    ("direct-listing", re.compile(r"\bdirect\s+listing\b", re.I)),
    # 리세일(셀링 스톡홀더) — 시장가로 파는 것이라 공모가가 없다.
    ("resale", re.compile(
        r"relates\s+to\s+(?:the\s+)?(?:registration\s+of\s+the\s+|potential\s+)?"
        r"(?:offer\s+and\s+)?resale", re.I)),
    ("atm", re.compile(r"at[-\s]the[-\s]market\s+offering", re.I)),
]
NO_PRICE_SCAN_CHARS = 30000  # 표지·요약 구간만 본다(본문 각주 단어에 걸리지 않게)


def html_to_text(body_bytes):
    txt = _TAG_RE.sub(" ", body_bytes.decode("utf-8", "replace"))
    txt = html_mod.unescape(txt)
    txt = _INVISIBLE_RE.sub("", txt)
    return re.sub(r"\s+", " ", txt)


def _parse_money(raw):
    """'25.00' / '1,250.50' → float. 자릿점이 어긋나면 버린다.

    실제 filing 에 '$10,00'(오타) 이 있었고, 콤마를 그냥 지우면 1000.0 이 된다.
    """
    if not re.fullmatch(r"\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?", raw):
        return None
    try:
        return float(raw.replace(",", ""))
    except ValueError:
        return None


def _security_kind(span):
    """매치 문구가 가리키는 증권 단위 — 'unit' / 'share' / None(혼재)."""
    has_unit = re.search(r"\bunits?\b", span, re.I) is not None
    has_share = re.search(r"\bshares?\b|\bads\b", span, re.I) is not None
    if has_unit and not has_share:
        return "unit"
    if has_share and not has_unit:
        return "share"
    return None


def classify_no_offer_price(text):
    """공모가가 존재하지 않는 유형이면 사유 문자열, 아니면 None."""
    head = text[:NO_PRICE_SCAN_CHARS]
    for reason, pat in NO_OFFER_PRICE_RULES:
        if pat.search(head):
            return reason
    return None


def extract_offer_price(text):
    """(가격, 증권단위, 후보존재여부).

    증거 단계를 강→약으로 훑되 매치가 나온 첫 단계에서 판정을 끝낸다. 그 단계
    안에서 서로 다른 값이 남으면 (None, None, True) — 모호하므로 생략한다.
    """
    for tier in (COVER_TABLE_PATTERNS, PROSE_PATTERNS, BARE_PRICE_PATTERNS):
        hits = []
        for pat in tier:
            for m in pat.finditer(text):
                value = _parse_money(m.group(1))
                if value is not None and PRICE_MIN <= value <= PRICE_MAX:
                    hits.append((round(value, 4), _security_kind(m.group(0))))
        if not hits:
            continue
        values = {v for v, _ in hits}
        if len(values) != 1:
            return None, None, True
        kinds = {k for _, k in hits}
        return values.pop(), (kinds.pop() if len(kinds) == 1 else None), True
    return None, None, False


def _checked_version(row):
    """행에 기록된 파서 세대. True(옛 마커)는 1세대로 본다."""
    v = row.get("offerPriceChecked")
    if v is True:
        return 1
    return v if isinstance(v, int) else 0


def enrich_offer_prices(ipos, max_fetches):
    """가격확정(424B4/424B1) 행의 원문을 받아 offerPrice 를 채운다.

    결과는 행 자체에 캐시된다 — offerPriceChecked 가 현재 파서 세대와 같으면
    다시 받지 않으므로 일일 실행이 옛 filing 을 재요청하지 않는다. 추출 로직을
    고쳤을 때만 OFFER_PRICE_PARSER_VERSION 을 올려 한 번 더 훑게 한다.
    """
    tried = found = marked_none = 0
    for row in ipos:  # 최신순 정렬 상태 — 새 filing 부터 처리
        if tried >= max_fetches:
            print(f"    [offerPrice] 요청 상한 {max_fetches}건 도달 — 나머지는 다음 실행에서")
            break
        if row.get("stage") != "priced" or not row.get("link"):
            continue
        if _checked_version(row) >= OFFER_PRICE_PARSER_VERSION:
            continue
        tried += 1
        try:
            body = sec.sec_get(row["link"])
        except Exception as exc:
            if getattr(exc, "code", None) in (403, 404):
                # 죽은 링크 — 재시도해도 같다. 단 '공모가 없음'은 아니다.
                row["offerPriceChecked"] = OFFER_PRICE_PARSER_VERSION
            print(f"    [offerPrice] {row.get('ticker') or row.get('company')} 원문 실패: {exc}")
            continue
        text = html_to_text(body)
        price, kind, had_candidates = extract_offer_price(text)
        for stale in ("offerPriceKind", "offerPriceNone", "offerPriceNoneReason"):
            row.pop(stale, None)  # 재판정이므로 옛 세대 표기는 지우고 다시 붙인다
        if price is not None:
            row["offerPrice"] = price
            if kind == "unit":  # SPAC 유닛 등 — 주당가가 아니라는 표시
                row["offerPriceKind"] = "unit"
            found += 1
        elif not had_candidates:
            reason = classify_no_offer_price(text)
            if reason:  # 근거를 댈 수 있을 때만 '없음'이라고 단언한다
                row["offerPriceNone"] = True
                row["offerPriceNoneReason"] = reason
                marked_none += 1
        row["offerPriceChecked"] = OFFER_PRICE_PARSER_VERSION
    if tried:
        print(f"  offerPrice 추출: {tried}건 시도 → {found}건 확정 / "
              f"{marked_none}건 공모가 없음(표기)")
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
                "offerPrice(공모가 USD)는 424B4 원문에서 단일 값으로 확정된 경우만 채운다. "
                "offerPriceKind='unit'이면 주당이 아니라 유닛당 가격(SPAC 등). "
                "offerPriceNone=true는 공모가가 존재하지 않는 공시(리세일/직상장/ATM/채권/보충서, "
                "사유는 offerPriceNoneReason). 둘 다 없으면 '아직 모름'이다.",
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
