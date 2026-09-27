#!/usr/bin/env python3
"""US Form 144(매도 예정 신고) 피드 + Form 4 실제 매도와의 짝짓기.

Form 144 는 계열인(임원·이사·대주주 등)이 제한증권·계열인 보유 주식을 팔기 전에 내는
'매도 예정' 신고다. 2023-04 부터 EDGAR 전자 제출(XML, primary_doc.xml)이라 예정 매도
주식수·시가·예정일·브로커를 그대로 읽을 수 있다.

수집: efts 전문검색으로 날짜별 Form 144 목록 → 추적 universe(시총 상위, 내부자 빌더와 같은
--top) issuer CIK 로 필터 → 매칭분 XML 을 받아 파싱. 증분은 lastFileDate(겹침 며칠) 기준.

짝짓기(match_form4): 같은 종목 · 같은 사람(이름 토큰 2개 이상 일치) · 예정일 3일 전 ~ 90일 뒤의
Form 4 매도(S) 가 data/insider_trades.json(build_insider_trades.py 산출물, 같은 워크플로우에서
먼저 갱신)에 있으면 '신고 후 실제 매도 확인됨', 없으면 '아직'. 이름 표기가 달라(신탁·법인 명의 등)
못 찾는 경우가 있어 '아직' 은 '매도 안 함' 이 아니다 — 화면도 그렇게 쓴다.

산출물: data/form144.json + .js(window.FORM144_FILINGS). 사실 표시이며 매매 추천이 아니다.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import sec_client as sec  # noqa: E402
from briefing_store import repository_publish_lock  # noqa: E402

OUT_JSON = ROOT / "data" / "form144.json"
OUT_JS = ROOT / "data" / "form144.js"
INSIDER_JSON = ROOT / "data" / "insider_trades.json"

RETENTION_DAYS = 45      # 내부자 거래(Form 4) 보관 기간과 같게 — 짝짓기 창이 맞아야 한다
MAX_ROWS = 6000
MATCH_BEFORE_DAYS = 3    # 예정일보다 며칠 앞선 Form 4 매도까지 인정(신고일·예정일 표기 차이)
MATCH_AFTER_DAYS = 90    # Form 144 는 신고 후 90일 안의 매도에 유효

# relationshipToIssuer 표기 → 한국어. 없는 표기는 원문 그대로 둔다.
RELATION_KO = {
    "officer": "임원",
    "director": "이사",
    "10% stockholder": "10%+주주",
    "10% owner": "10%+주주",
    "affiliate": "계열인",
    "member of immediate family of any of the foregoing": "위 관계인의 가족",
    "former officer": "전 임원",
    "former director": "전 이사",
    "chairman of the board": "이사회 의장",
    "see remarks": "비고 참조",
    "board member": "이사",
    "member of the board": "이사",
    "chairman emeritus": "명예 의장",
    "executive chairman": "이사회 의장",
    "chief executive officer": "CEO",
    "chief financial officer": "CFO",
    "general counsel": "법무총괄",
    "president": "사장",
    "ceo": "CEO",
    "cfo": "CFO",
}

_NAME_DROP = {"jr", "sr", "ii", "iii", "iv", "mr", "ms", "mrs", "dr", "md", "phd", "esq", "the"}


# ---------------------------------------------------------------------------
# 순수 함수(테스트 대상)
# ---------------------------------------------------------------------------

def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _find(node, *path):
    """네임스페이스를 무시하고 로컬 이름 경로로 첫 자식을 찾는다."""
    cur = node
    for name in path:
        if cur is None:
            return None
        cur = next((c for c in cur if _local(c.tag) == name), None)
    return cur


def _text(node, *path):
    el = _find(node, *path)
    return el.text.strip() if el is not None and el.text and el.text.strip() else None


def _num(v):
    try:
        return float(str(v).replace(",", ""))
    except (TypeError, ValueError):
        return None


def us_date(v):
    """'09/25/2026' → '2026-09-25'. 형식이 다르면 None."""
    m = re.match(r"^\s*(\d{1,2})/(\d{1,2})/(\d{4})\s*$", str(v or ""))
    if not m:
        return None
    try:
        return date(int(m.group(3)), int(m.group(1)), int(m.group(2))).isoformat()
    except ValueError:
        return None


# 화면이 쓰지 않는 파싱 필드 — 파일(브라우저가 받는 .js)을 줄이려고 행에서 뺀다.
SLIM_DROP = ("relationRaw", "securityClass", "exchange", "lines", "noticeDate")


def slim_row(row: dict) -> dict:
    out = {k: v for k, v in row.items() if k not in SLIM_DROP and v not in (None, "")}
    if row.get("relationRaw"):
        out["relation"] = relation_ko(str(row["relationRaw"]).split(", "))
    return out


def relation_ko(values) -> str:
    out = []
    for v in values or []:
        k = str(v or "").strip()
        if not k:
            continue
        ko = RELATION_KO.get(k.lower(), k)
        if ko not in out:
            out.append(ko)
    # 제출사마다 순서가 달라('Director, Officer' / 'Officer, Director') 같은 관계가 둘로 갈리지 않게 정렬.
    order = {v: i for i, v in enumerate(RELATION_KO.values())}
    return ", ".join(sorted(out, key=lambda x: order.get(x, len(order))))


def parse_form144(xml_bytes) -> dict | None:
    """Form 144 primary_doc.xml → 레코드(발행사·신고인·예정 매도). 매도 예정 행이 여럿이면 합산.

    반환 필드: issuerCik, issuer, person, relation, relationRaw, securityClass, shares, marketValue,
    sharesOutstanding, approxSaleDate, broker, exchange, acquired(취득 경위), noticeDate, lines(행 수).
    파싱 실패·매도 예정 행 없음이면 None.
    """
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError:
        return None
    form = _find(root, "formData")
    if form is None:
        return None
    issuer = _find(form, "issuerInfo")
    rels = []
    rel_parent = _find(issuer, "relationshipsToIssuer") if issuer is not None else None
    if rel_parent is not None:
        rels = [c.text.strip() for c in rel_parent if _local(c.tag) == "relationshipToIssuer" and c.text]
    infos = [c for c in form if _local(c.tag) == "securitiesInformation"]
    if not infos:
        return None
    shares = value = 0.0
    have_shares = have_value = False
    brokers, sale_dates, exchanges, classes = [], [], [], []
    outstanding = None
    for info in infos:
        n = _num(_text(info, "noOfUnitsSold"))
        v = _num(_text(info, "aggregateMarketValue"))
        if n is not None:
            shares += n
            have_shares = True
        if v is not None:
            value += v
            have_value = True
        o = _num(_text(info, "noOfUnitsOutstanding"))
        if o and outstanding is None:
            outstanding = o
        b = _text(info, "brokerOrMarketmakerDetails", "name")
        if b and b not in brokers:
            brokers.append(b)
        d = us_date(_text(info, "approxSaleDate"))
        if d:
            sale_dates.append(d)
        x = _text(info, "securitiesExchangeName")
        if x and x not in exchanges:
            exchanges.append(x)
        c = _text(info, "securitiesClassTitle")
        if c and c not in classes:
            classes.append(c)
    acquired = []
    for tb in (c for c in form if _local(c.tag) == "securitiesToBeSold"):
        a = _text(tb, "natureOfAcquisitionTransaction")
        if a and a not in acquired:
            acquired.append(a)
    return {
        "issuerCik": int(_text(issuer, "issuerCik") or 0) if issuer is not None else 0,
        "issuer": _text(issuer, "issuerName") if issuer is not None else None,
        "person": _text(issuer, "nameOfPersonForWhoseAccountTheSecuritiesAreToBeSold") if issuer is not None else None,
        "relation": relation_ko(rels),
        "relationRaw": ", ".join(rels),
        "securityClass": ", ".join(classes),
        "shares": shares if have_shares else None,
        "marketValue": round(value, 2) if have_value else None,
        "sharesOutstanding": outstanding,
        "approxSaleDate": min(sale_dates) if sale_dates else None,
        "broker": ", ".join(brokers[:2]),
        "exchange": ", ".join(exchanges),
        "acquired": ", ".join(acquired[:2]),
        "noticeDate": us_date(_text(form, "noticeSignature", "noticeDate")),
        "lines": len(infos),
    }


def name_tokens(name) -> set[str]:
    """'HUANG JEN HSUN' · 'Jen-Hsun Huang' · 'Marriott J W Jr' → 비교용 토큰(소문자). 이니셜(한 글자)도 남긴다."""
    toks = re.findall(r"[a-z]+", str(name or "").lower())
    return {t for t in toks if t not in _NAME_DROP}


def same_person(a, b) -> bool:
    """같은 사람인지: 두 글자 이상 토큰이 2개 이상 겹치거나(성+이름), 한쪽 토큰이 전부 다른 쪽에 있고
    그중 두 글자 이상 토큰이 하나 이상이면서 겹친 토큰이 2개 이상일 때(이니셜 표기 'Marriott J W').
    성만 같은 가족('Marriott David S' vs 'Marriott J W Jr')·이니셜만 같은 사람은 다르게 본다."""
    ta, tb = name_tokens(a), name_tokens(b)
    if not ta or not tb:
        return False
    common = ta & tb
    long_common = {t for t in common if len(t) >= 2}
    if len(long_common) >= 2:
        return True
    subset = common == ta or common == tb
    return subset and len(common) >= 2 and len(long_common) >= 1


def _day(s):
    try:
        return date.fromisoformat(str(s)[:10])
    except (TypeError, ValueError):
        return None


def match_form4(row: dict, trades_by_ticker: dict, coverage_from: str | None = None) -> dict:
    """Form 144 한 건과 Form 4 매도(S)를 짝짓는다.

    반환: {"status": "sold"|"pending"|"unknown", "soldShares", "firstSaleDate", "lastSaleDate", "form4Count"}.
    - sold: 같은 종목·같은 사람·예정일 -3일 ~ +90일의 Form 4 S 가 있다.
    - pending: 없다. Form 4 가 매도 후 2영업일 안에 나오므로 최근 신고는 아직 안 나왔을 수 있다.
    - unknown: 내부자 데이터가 없거나(파일 부재) 예정일이 내부자 데이터 수집 범위보다 앞이다.
    """
    anchor = _day(row.get("approxSaleDate")) or _day(row.get("fileDate"))
    if trades_by_ticker is None or anchor is None:
        return {"status": "unknown"}
    cov = _day(coverage_from) if coverage_from else None
    if cov and anchor < cov:
        return {"status": "unknown"}
    lo = anchor - timedelta(days=MATCH_BEFORE_DAYS)
    hi = anchor + timedelta(days=MATCH_AFTER_DAYS)
    hits = []
    for t in trades_by_ticker.get(str(row.get("ticker") or "").upper(), ()):
        if t.get("code") != "S":
            continue
        td = _day(t.get("txDate")) or _day(t.get("fileDate"))
        if td is None or not (lo <= td <= hi):
            continue
        if not same_person(row.get("person"), t.get("owner")):
            continue
        hits.append((td, t))
    if not hits:
        return {"status": "pending"}
    hits.sort(key=lambda x: x[0])
    sold = sum(float(t.get("shares") or 0) for _, t in hits)
    return {
        "status": "sold",
        "soldShares": sold,
        "firstSaleDate": hits[0][0].isoformat(),
        "lastSaleDate": hits[-1][0].isoformat(),
        "form4Count": len({t.get("accession") for _, t in hits}),
    }


def index_trades(trades) -> dict:
    by = {}
    for t in trades or []:
        if t.get("code") == "S" and t.get("ticker"):
            by.setdefault(str(t["ticker"]).upper(), []).append(t)
    return by


def load_insider():
    """(ticker→Form 4 매도 목록, 수집 시작일, updatedAtKst). 파일이 없으면 (None, None, None)."""
    if not INSIDER_JSON.exists():
        return None, None, None
    try:
        p = json.loads(INSIDER_JSON.read_text(encoding="utf-8"))
    except Exception:
        return None, None, None
    trades = p.get("trades") or []
    dates = [t.get("fileDate") for t in trades if t.get("fileDate")]
    return index_trades(trades), (min(dates) if dates else None), p.get("updatedAtKst")


def attach_matches(rows, by_ticker, coverage_from) -> dict:
    counts = {"sold": 0, "pending": 0, "unknown": 0}
    for i, r in enumerate(rows):
        r = rows[i] = slim_row(r)
        m = match_form4(r, by_ticker, coverage_from)
        r["match"] = m
        counts[m["status"]] = counts.get(m["status"], 0) + 1
    return counts


# ---------------------------------------------------------------------------
# 네트워크
# ---------------------------------------------------------------------------

def fetch_form144(hit, issuer_cik):
    """efts 히트 → (파싱 레코드, 원문 보기 URL). 폴더는 신고인·발행사 CIK 어느 쪽 아래에도 있다."""
    accession, doc = hit["_id"].split(":")
    acc_nodash = accession.replace("-", "")
    ciks = hit.get("_source", {}).get("ciks", [])
    for cik in dict.fromkeys([*ciks, str(issuer_cik)]):
        base = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc_nodash}"
        try:
            body = sec.sec_get(f"{base}/{doc}")
        except Exception:
            continue
        rec = parse_form144(body)
        if rec is None:
            return None, ""
        # 사람이 읽는 렌더(XSL) 주소 — 원문 링크로 쓴다.
        xsl = hit.get("_source", {}).get("xsl") or "xsl144X01"
        return rec, f"{base}/{xsl}/{doc}"
    return None, ""


def load_existing():
    if not OUT_JSON.exists():
        return [], None
    try:
        p = json.loads(OUT_JSON.read_text(encoding="utf-8"))
        return p.get("filings") or [], p.get("lastFileDate")
    except Exception:
        return [], None


def build(backfill_days, top, overlap_days=4):
    today = sec.et_today()
    existing, last = load_existing()
    start = (date.fromisoformat(last) - timedelta(days=overlap_days)) if (existing and last) \
        else today - timedelta(days=backfill_days)
    print(f"  수집 구간: {start} ~ {today} (기존 {len(existing)}건)")
    cik_set, cik_to_ticker = sec.universe_cik_map(top=top)
    print(f"  universe CIK: {len(cik_set)}")

    merged = {r["accession"]: r for r in existing if r.get("accession")}
    new = failed = 0
    partial = False
    day = start
    while day <= today:
        iso = day.isoformat()
        hits, day_partial = sec.efts_hits("144", iso, iso)
        partial = partial or day_partial
        kept = 0
        for hit in hits:
            src = hit.get("_source", {})
            if src.get("file_type") not in (None, "144"):
                continue  # 144/A 정정·첨부 파일은 뺀다(원 신고가 이미 행으로 있다)
            matched = {int(c) for c in src.get("ciks", []) if str(c).isdigit()} & cik_set
            if not matched:
                continue
            accession = src.get("adsh") or hit["_id"].split(":")[0]
            if accession in merged:
                continue
            issuer_cik = sorted(matched)[0]
            try:
                rec, link = fetch_form144(hit, issuer_cik)
            except Exception as exc:  # noqa: BLE001
                print(f"    [경고] {accession} 조회 실패: {exc}")
                failed += 1
                continue
            if rec is None:
                failed += 1
                continue
            merged[accession] = {
                "ticker": cik_to_ticker.get(issuer_cik),
                "issuer": rec["issuer"] or sec.clean_company_name((src.get("display_names") or [""])[0]),
                **{k: v for k, v in rec.items() if k not in ("issuer", "issuerCik")},
                "fileDate": src.get("file_date"),
                "accession": accession,
                "link": link,
            }
            new += 1
            kept += 1
        if hits:
            print(f"    {iso}: Form 144 전체 {len(hits)} / universe {kept}{' (일부 실패)' if day_partial else ''}")
        day += timedelta(days=1)

    cutoff = (today - timedelta(days=RETENTION_DAYS)).isoformat()
    rows = [r for r in merged.values() if (r.get("fileDate") or "") >= cutoff]
    rows.sort(key=lambda r: (r.get("fileDate") or "", r.get("accession") or ""), reverse=True)
    rows = rows[:MAX_ROWS]

    by_ticker, coverage_from, insider_at = load_insider()
    counts = attach_matches(rows, by_ticker, coverage_from)
    print(f"  Form 4 짝짓기: 매도 확인 {counts.get('sold', 0)} · 아직 {counts.get('pending', 0)}"
          f" · 판단 불가 {counts.get('unknown', 0)} (내부자 데이터 {insider_at or '없음'})")

    fresh_last = max((r.get("fileDate") or "" for r in rows), default=today.isoformat())
    if partial and last:
        print(f"  [경고] efts 일부 실패 — lastFileDate 를 {last} 로 고정(재수집 예약)")
        fresh_last = last
    payload = {
        "updatedAtKst": sec.kst_now_str(),
        "lastFileDate": fresh_last,
        "partialFetch": bool(partial),
        "count": len(rows),
        "newCount": new,
        "source": "SEC EDGAR Form 144",
        "insiderUpdatedAtKst": insider_at,
        "insiderCoverageFrom": coverage_from,
        "matchCounts": counts,
        "note": "매도 예정 신고(Form 144). 주식수·시가·예정일·브로커는 신고서 원문 값. "
                "match 는 같은 종목·같은 이름의 Form 4 매도(S)를 예정일 -3일~+90일에서 찾은 결과 — "
                "이름 표기가 달라 못 찾을 수 있어 '아직' 이 '매도 안 함' 을 뜻하지 않는다. 추천 아님.",
        "filings": rows,
    }
    print(f"  완료: 신규 {new}건 · 실패 {failed}건 → 총 {len(rows)}건")
    return payload


def main():
    ap = argparse.ArgumentParser(description="SEC Form 144 매도 예정 신고 수집 + Form 4 짝짓기")
    ap.add_argument("--backfill-days", type=int, default=30)
    ap.add_argument("--top", type=int, default=1000, help="시총 상위 N 종목(내부자 빌더와 같은 값을 쓸 것)")
    ap.add_argument("--rematch-only", action="store_true",
                    help="수집 없이 기존 행의 Form 4 짝짓기만 다시(내부자 데이터가 갱신됐을 때)")
    ap.add_argument("--push", action="store_true", default=False)
    args = ap.parse_args()
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    print("=== SEC Form 144 매도 예정 신고 수집 시작 ===")
    if args.rematch_only:
        rows, last = load_existing()
        by_ticker, coverage_from, insider_at = load_insider()
        counts = attach_matches(rows, by_ticker, coverage_from)
        payload = json.loads(OUT_JSON.read_text(encoding="utf-8")) if OUT_JSON.exists() else {}
        payload.update({"updatedAtKst": sec.kst_now_str(), "matchCounts": counts, "filings": rows,
                        "insiderUpdatedAtKst": insider_at, "insiderCoverageFrom": coverage_from,
                        "count": len(rows)})
    else:
        payload = build(args.backfill_days, args.top)
    with repository_publish_lock(ROOT):
        sec.write_data(OUT_JSON, OUT_JS, "FORM144_FILINGS", payload, indent=None)
        print(f"Wrote {OUT_JSON} — {payload.get('count', 0)} filings "
              f"({datetime.now().strftime('%H:%M')})")
        if args.push:
            if not sec.git_publish(["data/form144.json", "data/form144.js"], "form 144"):
                raise SystemExit("[중단] Form 144 push 실패 — 발행되지 않았다")


if __name__ == "__main__":
    main()
