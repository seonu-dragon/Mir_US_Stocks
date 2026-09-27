#!/usr/bin/env python3
"""미국 사업부문(세그먼트)·지역·제품별 매출 이력 — SEC 10-K/20-F XBRL instance(차원 포함) → 종목별 파일.

왜 이 경로인가(2026-09-27 조사)
  - companyfacts·frames API 에는 차원(axis/member)이 없다 — 부문 매출은 전부 빠진다.
  - Financial Statement and Notes 데이터셋(월간 zip)은 차원이 있지만 한 달치가 100~330MB 라
    10-K 한 바퀴(12개월)를 덮으려면 3GB 를 받아 풀어야 한다.
  - 공시별 XBRL instance(`<문서>_htm.xml`)는 gzip 전송으로 회사당 수십~수백 KB 이고, 10-K 하나에
    부문 표 3개 회계연도가 들어 있다. 최신 10-K + 3년 전 10-K 두 건이면 6개 회계연도.
  → 종목별 instance + 레이블 링크베이스(`_lab.xml`, 회사 고유 멤버의 사람이 읽는 이름).

추출 규칙(추정 없음 — 공시 숫자를 옮기고 대조만 한다)
  축: us-gaap:StatementBusinessSegmentsAxis(ifrs-full:SegmentsAxis) = 사업부문,
      srt:StatementGeographicalAxis(ifrs-full:GeographicalAreasAxis) = 지역,
      srt:ProductOrServiceAxis(ifrs-full:ProductsAndServicesAxis) = 제품·서비스.
  값: 매출 계정(REVENUE_CONCEPTS 순서) 중 그 축에 멤버가 2개 이상 있는 첫 계정. 연간(330~380일) 기간만.
  컨텍스트: 그 축 하나만 있거나, 부문 축 + ConsolidationItemsAxis=OperatingSegmentsMember 인 것만.
      제거·조정(IntersegmentElimination 등)·다른 축이 섞인 교차표는 뺀다.
  상위 멤버 제거: 같은 축에 부모(예: AAPL Products)와 자식(iPhone·Mac…)이 함께 태그되면 합이 총매출을
      넘는다. 최신 연도에서 (멤버 합 − 총매출)과 같은 값(±0.5%)의 멤버를 부모로 보고 빼며, 전 연도에 적용.
  합계 대조: 멤버 합 ÷ 총매출(같은 계정의 차원 없는 값)이 98~102% 면 ok, 아니면 mismatch
      (부문 간 거래 포함·일부 지역만 공시 등 — 화면이 '부문 합 ≠ 총매출' 로 표시). 총매출이 없으면 noTotal.
  이름: 회사 레이블 링크베이스의 terse/standard 레이블(" [Member]" 제거). 없으면 표준 멤버 사전·국가 코드
      사전, 그래도 없으면 멤버 이름 CamelCase 를 띄어 쓴다.

증분(SEC 초당 10회 · User-Agent 필수 — build_financials_us.py 와 같은 UA·간격)
  - 상태 data/segments_state.json: 종목별 최신 연간 공시 accn·확인일. 매 실행 EDGAR 일별 색인
    (build_financials_us.filers_since)으로 정기보고서를 낸 CIK 만 submissions 를 다시 본다.
  - 처음 보는 종목·120일 넘은 종목·실패했던 종목은 시총순으로, --time-budget-min 안에서.
    잘리면 받은 데까지 저장(정상 종료) — 다음 주에 이어서 채운다.
  - 최신 연간 공시 accn 이 상태와 같으면 instance 를 다시 받지 않는다.

산출물
  data/segments/<TICKER>.json      종목별(지연 로드, 파일명 규칙은 details·financials 와 같다)
  data/segments_index.json/.js     window.SEGMENTS_INDEX (FEATURE_DATA 키 segmentsIndex)
  data/segments_state.json         빌더 증분 상태(브라우저 안 읽음)

종목 파일 스키마(schema 1)
  { schema, ticker, name, cik, currency, source, updatedAtKst,
    filings: [{accn, form, filed, end}],              — 값을 가져온 공시(최신 순)
    axes: { segment|geo|product: {
        concept: "RevenueFromContractWithCustomerExcludingAssessedTax",
        members: [{id: "aapl:IPhoneMember", label: "iPhone"}],   — 최신 연도 값 큰 순
        years: [{fy: 2025, end: "2025-09-27", total: 4.16e11, sum: 4.16e11, v: {id: 값}}],  — 오름차순
        check: "ok" | "mismatch" | "noTotal", dropped: [부모로 빼낸 멤버 id] } } }
  값이 없는 멤버·연도는 키가 없다(0 과 구분).

실행: python -u scripts/build_segments_us.py [--top 1100] [--only AAPL,MSFT] [--time-budget-min 40] [--push]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402
import sec_client as sec  # noqa: E402
from financials_common import dumps_compact, load_json, safe_file_name  # noqa: E402

SNAPSHOT = ROOT / "data" / "market_snapshot.json"
OUT_DIR = ROOT / "data" / "segments"
OUT_JSON = ROOT / "data" / "segments_index.json"
OUT_JS = ROOT / "data" / "segments_index.js"
STATE_JSON = ROOT / "data" / "segments_state.json"
SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik:010d}.json"
ARCHIVE_URL = "https://www.sec.gov/Archives/edgar/data/{cik}/{acc}/{name}"
SOURCE = "SEC EDGAR 10-K·20-F XBRL(부문·지역·제품 차원)"
SCHEMA = 1

ANNUAL_FORMS = ("10-K", "20-F", "40-F", "10-KT")
STALE_DAYS = 120
RESCAN_OVERLAP_DAYS = 3
MAX_SCAN_GAP_DAYS = 45
HISTORY_FILINGS = (0, 3)       # 최신 연간 공시 + 3년 전 공시 → 최대 6개 회계연도
SUM_TOL = 0.02                 # 합계 대조 허용(±2%)
PARENT_TOL = 0.005             # 부모 멤버 판정(총매출 대비 ±0.5%)

# 매출 계정(앞이 우선). us-gaap 과 ifrs-full 의 로컬 이름.
REVENUE_CONCEPTS = (
    "RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues",
    "RevenueFromContractWithCustomerIncludingAssessedTax", "SalesRevenueNet", "SalesRevenueGoodsNet",
    "RevenuesNetOfInterestExpense", "RegulatedAndUnregulatedOperatingRevenue",
    "Revenue", "RevenueFromContractsWithCustomers", "RevenueFromSaleOfGoods",
)
TAXONOMY_HINTS = ("fasb.org/us-gaap", "xbrl.ifrs.org")
AXES = {
    "segment": ("StatementBusinessSegmentsAxis", "SegmentsAxis"),
    "geo": ("StatementGeographicalAxis", "GeographicalAreasAxis"),
    "product": ("ProductOrServiceAxis", "ProductsAndServicesAxis"),
}
CONSOLIDATION_AXES = ("ConsolidationItemsAxis", "SegmentConsolidationItemsAxis")
# 표준 '합계·조정' 멤버 — 부문이 아니라 부문들의 합이나 조정이라 멤버로 쓰지 않는다.
AGGREGATE_MEMBERS = ("ReportableSegmentAggregationBeforeOtherOperatingSegmentMember", "SegmentReconcilingItemsMember",
                     "IntersegmentEliminationMember", "ConsolidationEliminationsMember", "OperatingSegmentsMember",
                     "ReportableSegmentsMember", "MaterialReconcilingItemsMember")
SUBSET_MAX = 18                # 부모·자식 분해를 완전 탐색할 최대 멤버 수(2^18 조합)
OPERATING_MEMBERS = ("OperatingSegmentsMember", "ReportableSegmentsMember")

# 표준(비회사) 멤버의 한국어 이름. 회사 레이블이 있으면 그쪽이 우선이다.
STD_MEMBER_KO = {
    "ProductMember": "제품", "ServiceMember": "서비스", "ProductAndServiceOtherMember": "기타",
    "AmericasMember": "미주", "NorthAmericaMember": "북미", "SouthAmericaMember": "남미",
    "LatinAmericaMember": "중남미", "EuropeMember": "유럽", "AsiaMember": "아시아",
    "AsiaPacificMember": "아시아·태평양", "EMEAMember": "EMEA(유럽·중동·아프리카)",
    "MiddleEastMember": "중동", "AfricaMember": "아프리카", "NonUsMember": "미국 외",
    "OtherCountriesMember": "기타 국가", "OtherGeographicalAreasMember": "기타 지역",
    "CorporateNonSegmentMember": "본사·기타", "AllOtherSegmentsMember": "기타 부문",
    "SegmentGeographicalGroupsOfCountriesGroupOneMember": "지역 1",
}
COUNTRY_KO = {
    "US": "미국", "CN": "중국", "JP": "일본", "KR": "한국", "TW": "대만", "DE": "독일", "GB": "영국",
    "FR": "프랑스", "CA": "캐나다", "MX": "멕시코", "BR": "브라질", "IN": "인도", "IE": "아일랜드",
    "NL": "네덜란드", "CH": "스위스", "SG": "싱가포르", "HK": "홍콩", "AU": "호주", "IT": "이탈리아",
    "ES": "스페인", "IL": "이스라엘", "SE": "스웨덴", "BE": "벨기에", "DK": "덴마크", "MY": "말레이시아",
    "VN": "베트남", "TH": "태국", "PH": "필리핀", "ID": "인도네시아", "RU": "러시아", "ZA": "남아프리카공화국",
    "AR": "아르헨티나", "CL": "칠레", "PR": "푸에르토리코", "LU": "룩셈부르크", "NO": "노르웨이", "FI": "핀란드",
    "AT": "오스트리아", "PL": "폴란드", "TR": "튀르키예", "SA": "사우디아라비아", "AE": "아랍에미리트",
}

XBRLI = "{http://www.xbrl.org/2003/instance}"
XBRLDI = "{http://xbrl.org/2006/xbrldi}"
LINK = "{http://www.xbrl.org/2003/linkbase}"
XLINK = "{http://www.w3.org/1999/xlink}"


# ────────────────────────────── 파싱(순수) ──────────────────────────────
def _local(qname: str) -> str:
    return str(qname or "").split(":")[-1].strip()


def _days(a: str, b: str) -> int | None:
    try:
        return (date.fromisoformat(b[:10]) - date.fromisoformat(a[:10])).days
    except (TypeError, ValueError):
        return None


def parse_instance(xml_bytes: bytes) -> dict:
    """XBRL instance → {contexts, units, revenue facts, fiscal-year focus}. 네트워크 없음.

    contexts: id → {start, end, dims: {축 로컬이름: 멤버 QName}, typed: bool}
    facts:    [(계정 로컬이름, contextRef, 값, unitRef)] — 매출 계정만
    """
    root = ET.fromstring(xml_bytes)
    contexts: dict[str, dict] = {}
    units: dict[str, str] = {}
    facts: list[tuple] = []
    fy_focus = None
    period_end = None
    for el in root:
        tag = el.tag
        if tag == XBRLI + "context":
            cid = el.get("id")
            start = el.findtext(f"{XBRLI}period/{XBRLI}startDate")
            end = el.findtext(f"{XBRLI}period/{XBRLI}endDate") or el.findtext(f"{XBRLI}period/{XBRLI}instant")
            dims, typed = {}, False
            for seg in el.iter():
                if seg.tag == XBRLDI + "explicitMember":
                    dims[_local(seg.get("dimension"))] = (seg.text or "").strip()
                elif seg.tag == XBRLDI + "typedMember":
                    typed = True
            contexts[cid] = {"start": (start or "").strip() or None, "end": (end or "").strip(), "dims": dims,
                             "typed": typed}
        elif tag == XBRLI + "unit":
            measure = el.findtext(f"{XBRLI}measure") or ""
            units[el.get("id")] = _local(measure)
        elif tag.startswith("{"):
            ns, local = tag[1:].split("}", 1)
            if local == "DocumentFiscalYearFocus" and (el.text or "").strip():
                fy_focus = (el.text or "").strip()
            elif local == "DocumentPeriodEndDate" and (el.text or "").strip():
                period_end = (el.text or "").strip()
            if local in REVENUE_CONCEPTS and any(h in ns for h in TAXONOMY_HINTS) and el.get("contextRef"):
                txt = (el.text or "").strip()
                if not txt or el.get("{http://www.w3.org/2001/XMLSchema-instance}nil") == "true":
                    continue
                try:
                    val = float(txt)
                except ValueError:
                    continue
                facts.append((local, el.get("contextRef"), val, el.get("unitRef")))
    return {"contexts": contexts, "units": units, "facts": facts, "fyFocus": fy_focus, "periodEnd": period_end}


def parse_labels(xml_bytes: bytes) -> dict[str, str]:
    """레이블 링크베이스 → {개념 id(prefix_Local): 레이블}. terseLabel > label(standard). " [Member]" 제거."""
    root = ET.fromstring(xml_bytes)
    out: dict[str, str] = {}
    for lk in root.iter(LINK + "labelLink"):
        locs: dict[str, str] = {}
        labels: dict[str, list[tuple[str, str]]] = {}
        arcs: list[tuple[str, str]] = []
        for el in lk:
            if el.tag == LINK + "loc":
                href = el.get(XLINK + "href") or ""
                locs[el.get(XLINK + "label")] = href.split("#")[-1]
            elif el.tag == LINK + "label":
                labels.setdefault(el.get(XLINK + "label"), []).append((el.get(XLINK + "role") or "", (el.text or "").strip()))
            elif el.tag == LINK + "labelArc":
                arcs.append((el.get(XLINK + "from"), el.get(XLINK + "to")))
        rank = {"http://www.xbrl.org/2003/role/terseLabel": 0, "http://www.xbrl.org/2003/role/label": 1}
        best: dict[str, tuple[int, str]] = {}
        for frm, to in arcs:
            cid = locs.get(frm)
            if not cid:
                continue
            for role, text in labels.get(to, []):
                r = rank.get(role)
                if r is None or not text:
                    continue
                if cid not in best or r < best[cid][0]:
                    best[cid] = (r, text)
        for cid, (_r, text) in best.items():
            out[cid] = re.sub(r"\s*\[(Member|Domain)\]\s*$", "", text).strip()
    return out


def humanize_member(member: str, labels: dict[str, str] | None = None) -> str:
    """멤버 QName("aapl:IPhoneMember") → 읽기 좋은 이름."""
    prefix, _, local = str(member).partition(":")
    if not local:
        prefix, local = "", prefix
    labels = labels or {}
    # 국가 코드는 회사 레이블("UNITED STATES" 처럼 표준 레이블 대문자)보다 한국어 사전이 낫다.
    if prefix == "country" and local.upper() in COUNTRY_KO:
        return COUNTRY_KO[local.upper()]
    lab = labels.get(f"{prefix}_{local}")
    if lab:
        lab = re.sub(r"\s+", " ", lab.replace("\xa0", " ")).strip()
        if len(lab) > 6 and lab.isupper():     # "UNITED STATES" → "United States" (EMEA·APJC 같은 약어는 그대로)
            lab = lab.title()
        return lab
    if local in STD_MEMBER_KO:
        return STD_MEMBER_KO[local]
    base = re.sub(r"(Segment)?Member$", "", local) or local
    base = re.sub(r"(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])", " ", base)
    return base.strip() or local


def _allowed_dims(dims: dict, axis_names: tuple) -> str | None:
    """이 컨텍스트가 '한 축 × 멤버' 값이면 그 멤버, 아니면 None."""
    axis_hit = [a for a in dims if a in axis_names]
    if len(axis_hit) != 1:
        return None
    for a, m in dims.items():
        if a == axis_hit[0]:
            continue
        if a in CONSOLIDATION_AXES and _local(m) in OPERATING_MEMBERS:
            continue
        return None
    return dims[axis_hit[0]]


def annual_values(parsed: dict) -> dict:
    """{계정: {'total': {end: (start,값)}, 축키: {end: {멤버: 값}}}} — 연간 기간·통화 단위만."""
    ctxs, units = parsed["contexts"], parsed["units"]
    out: dict[str, dict] = {}
    for concept, cref, val, uref in parsed["facts"]:
        c = ctxs.get(cref)
        if not c or c["typed"] or not c["start"]:
            continue
        d = _days(c["start"], c["end"])
        if d is None or not 330 <= d <= 380:
            continue
        unit = units.get(uref, "")
        if not (len(unit) == 3 and unit.isalpha() and unit.isupper()):
            continue
        node = out.setdefault(concept, {"total": {}, "unit": {}})
        node["unit"][c["end"]] = unit
        if not c["dims"]:
            node["total"][c["end"]] = val
            continue
        for key, names in AXES.items():
            m = _allowed_dims(c["dims"], names)
            if m and _local(m) not in AGGREGATE_MEMBERS:
                node.setdefault(key, {}).setdefault(c["end"], {})[m] = val
    return out


def _pick_total(vals: dict, concept: str, end: str):
    t = vals.get(concept, {}).get("total", {}).get(end)
    if t is not None:
        return t
    for c in REVENUE_CONCEPTS:
        t = vals.get(c, {}).get("total", {}).get(end)
        if t is not None:
            return t
    return None


def _subsets(items: list[tuple[str, float]], target: float, tol: float, min_size: int = 2):
    """합이 target(±tol)인 부분집합(멤버 id 튜플)을 모두 낸다. items 는 SUBSET_MAX 개 이하."""
    n = len(items)
    vals = [v for _m, v in items]
    for mask in range(1, 1 << n):
        if bin(mask).count("1") < min_size:
            continue
        s = 0.0
        for i in range(n):
            if mask >> i & 1:
                s += vals[i]
        if abs(s - target) <= tol:
            yield tuple(items[i][0] for i in range(n) if mask >> i & 1)


def _holds(years: list[tuple[dict, float | None]], parts: tuple, target_of) -> bool:
    """다른 연도에서도 같은 관계(parts 합 ≈ target)가 성립하나. 비교할 수 있는 연도가 없으면 True."""
    for v, total in years[1:]:
        if not all(m in v for m in parts):
            continue
        tgt = target_of(v, total)
        if tgt is None:
            continue
        if abs(sum(v[m] for m in parts) - tgt) > abs(tgt) * PARENT_TOL:
            return False
    return True


def find_parents(years: list[tuple[dict, float | None]]) -> list[str]:
    """같은 축에 부모(소계)와 자식이 함께 태그된 경우 뺄 멤버 목록. years = [(멤버 값, 총매출)], 최신 연도가 앞.

    1) 자식 합 규칙: 어떤 멤버 P 가 더 작은 다른 멤버 2개 이상의 합(±0.5%)과 같고, 비교 가능한 다른 연도에서도
       그 관계가 유지되면 P 는 소계다(AAPL Products = iPhone+Mac+iPad+Wearables, INTC Intel Products = CCG+DCAI).
    2) 총매출 규칙: 그래도 합이 총매출을 넘으면(±2% 밖) 총매출과 맞는 부분집합 중 멤버가 가장 많은 것
       (= 가장 잘게 나눈 분해, 모든 연도에서 성립)을 남기고 나머지를 뺀다(AMZN 상품/서비스 2줄 대신 7줄,
       TSLA '총매출' 멤버). 맞는 분해가 없으면 그대로 두고 합계 대조가 mismatch 로 알린다.
    멤버가 SUBSET_MAX 개를 넘으면 완전 탐색을 하지 않는다.
    """
    if not years:
        return []
    latest, total = years[0]
    items = sorted(((m, v) for m, v in latest.items() if v > 0), key=lambda kv: -kv[1])
    dropped: list[str] = []
    if 3 <= len(items) <= SUBSET_MAX:
        for p, pv in items:
            others = [(m, v) for m, v in items if m != p and m not in dropped and v < pv]
            if len(others) < 2:
                continue
            for parts in _subsets(others, pv, pv * PARENT_TOL):
                if _holds(years, parts, lambda v, _t, p=p: v.get(p)):
                    dropped.append(p)
                    break
    rest = [(m, v) for m, v in items if m not in dropped]
    if total and total > 0 and sum(v for _m, v in rest) > total * (1 + SUM_TOL) and 2 < len(rest) <= SUBSET_MAX:
        best = None
        for parts in _subsets(rest, total, total * PARENT_TOL):
            if best is not None and len(parts) < len(best[0]):
                continue
            if not _holds(years, parts, lambda _v, t: t):
                continue
            err = abs(sum(latest[m] for m in parts) - total)
            if best is None or len(parts) > len(best[0]) or err < best[1]:
                best = (parts, err)
        if best:
            keep = set(best[0])
            dropped += [m for m, _v in rest if m not in keep]
    return dropped


def fiscal_year_labels(ends: list[str], fy_focus, period_end) -> dict[str, int]:
    """기말일 → 회계연도 라벨. 공시의 DocumentFiscalYearFocus 를 최신 기말에 붙이고 1년씩 뺀다."""
    out = {}
    try:
        base_fy = int(str(fy_focus)[:4])
    except (TypeError, ValueError):
        base_fy = None
    ref_end = max(ends) if ends else None
    if period_end and ends:
        near = [e for e in ends if abs(_days(e, period_end) or 999) <= 20]
        if near:
            ref_end = max(near)
    for e in ends:
        if base_fy is not None and ref_end:
            gap = _days(e, ref_end) or 0
            out[e] = base_fy - round(gap / 365.25)
        else:
            out[e] = int(e[:4])
    return out


def extract_filing(parsed: dict, labels: dict[str, str] | None = None) -> dict:
    """공시 하나 → {축키: {concept, years: {end: {fy, total, v}}, labels}} (정리 전 원자료)."""
    vals = annual_values(parsed)
    out = {}
    all_ends = sorted({e for c in vals.values() for e in c.get("total", {})}
                      | {e for c in vals.values() for k in AXES for e in c.get(k, {})})
    fy_map = fiscal_year_labels(all_ends, parsed.get("fyFocus"), parsed.get("periodEnd"))
    for key in AXES:
        chosen = None
        for concept in REVENUE_CONCEPTS:
            by_end = vals.get(concept, {}).get(key) or {}
            if by_end and max(len(v) for v in by_end.values()) >= 2:
                chosen = concept
                break
        if not chosen:
            continue
        by_end = vals[chosen][key]
        years = {}
        for end, mem in by_end.items():
            if len(mem) < 2:
                continue
            years[end] = {"fy": fy_map.get(end, int(end[:4])), "total": _pick_total(vals, chosen, end), "v": dict(mem),
                          "unit": vals[chosen]["unit"].get(end)}
        if years:
            names = {m: humanize_member(m, labels) for y in years.values() for m in y["v"]}
            out[key] = {"concept": chosen, "years": years, "labels": names}
    return out


def merge_filings(extracted: list[dict]) -> dict:
    """최신 공시가 앞. 같은 기말은 최신 공시 값(재작성 반영), 옛 공시는 빈 연도만 채운다."""
    axes: dict[str, dict] = {}
    for ex in extracted:
        for key, node in ex.items():
            dst = axes.setdefault(key, {"concept": node["concept"], "years": {}, "labels": {}})
            for end, y in node["years"].items():
                # 같은 회계연도 라벨이 이미 있으면(기말일 표기가 하루 다른 경우 등) 건너뛴다
                if end in dst["years"] or any(v["fy"] == y["fy"] for v in dst["years"].values()):
                    continue
                dst["years"][end] = y
            for m, lab in node["labels"].items():
                dst["labels"].setdefault(m, lab)
    for dst in axes.values():
        unify_members(dst)
    return axes


def unify_members(node: dict) -> None:
    """공시마다 멤버 이름(QName)이 바뀐 같은 부문(NVDA 'Compute & Networking' 등)을 레이블로 합친다.

    같은 레이블이라도 한 연도 안에 둘 다 값이 있으면 서로 다른 멤버라 합치지 않는다. 최신 연도에 나오는 id 를 남긴다.
    """
    years = sorted(node["years"].items(), key=lambda kv: kv[0], reverse=True)
    by_label: dict[str, list[str]] = {}
    for _end, y in years:
        for m in y["v"]:
            key = re.sub(r"[^a-z0-9가-힣]", "", (node["labels"].get(m) or m).lower())
            lst = by_label.setdefault(key, [])
            if m not in lst:
                lst.append(m)
    for ids in by_label.values():
        if len(ids) < 2:
            continue
        keep = ids[0]
        for other in ids[1:]:
            if any(keep in y["v"] and other in y["v"] for _e, y in years):
                continue
            for _e, y in years:
                if other in y["v"]:
                    y["v"][keep] = y["v"].pop(other)


def finalize_axis(node: dict) -> dict | None:
    """부모 멤버 제거 · 합계 대조 · 멤버 순서(최신 연도 값 큰 순)."""
    years = sorted(node["years"].items(), key=lambda kv: kv[0])
    if not years:
        return None
    dropped = find_parents([(y["v"], y.get("total")) for _e, y in reversed(years)])
    rows = []
    checks = []
    latest_ids = {m for m in years[-1][1]["v"] if m not in dropped}
    for end, y in years:
        v = {m: val for m, val in y["v"].items() if m not in dropped}
        tot = y.get("total")
        if tot and abs(sum(v.values()) / tot - 1) > SUM_TOL:
            # 옛 공시가 같은 축에 소계와 일부 품목을 섞어 태그한 해(LLY 2020~22: 제품매출 합계 + 일부 제품).
            # 최신 연도 멤버만 남겨 총매출과 맞으면 그 분해를 쓴다(맞지 않으면 그대로 두고 대조가 알린다).
            same = {m: x for m, x in v.items() if m in latest_ids}
            if len(same) >= 2 and abs(sum(same.values()) / tot - 1) <= SUM_TOL:
                v = same
        if len(v) < 2:
            continue
        s = sum(v.values())
        row = {"fy": y["fy"], "end": end, "sum": _num(s), "v": {m: _num(x) for m, x in v.items()}}
        if y.get("total"):
            row["total"] = _num(y["total"])
            checks.append(abs(s / y["total"] - 1) <= SUM_TOL)
        rows.append(row)
    if not rows:
        return None
    last_v = rows[-1]["v"]
    order = sorted(last_v, key=lambda m: -last_v[m])
    seen = set(order)
    for r in reversed(rows):
        for m in sorted(r["v"], key=lambda k: -r["v"][k]):
            if m not in seen:
                order.append(m)
                seen.add(m)
    if not checks:
        check = "noTotal"
    elif "total" in rows[-1] and abs(rows[-1]["sum"] / rows[-1]["total"] - 1) <= SUM_TOL:
        check = "ok"
    else:
        check = "mismatch"
    return {
        "concept": node["concept"],
        "members": [{"id": m, "label": node["labels"].get(m) or humanize_member(m)} for m in order],
        "years": rows[-6:],
        "check": check,
        "dropped": dropped,
    }


def _num(v):
    return int(v) if isinstance(v, float) and v.is_integer() else v


def build_doc(ticker: str, name: str, cik: int, filings: list[dict], extracted: list[dict], stamp: str) -> dict | None:
    merged = merge_filings(extracted)
    axes = {}
    for key in AXES:
        if key in merged:
            fin = finalize_axis(merged[key])
            if fin:
                axes[key] = fin
    if not axes:
        return None
    currency = None
    for ex in extracted:
        for node in ex.values():
            for y in node["years"].values():
                currency = currency or y.get("unit")
    return {"schema": SCHEMA, "ticker": ticker, "name": name, "cik": cik, "currency": currency or "USD",
            "source": SOURCE, "updatedAtKst": stamp, "filings": filings, "axes": axes}


def index_entry(doc: dict) -> list:
    fys = [y["fy"] for a in doc["axes"].values() for y in a["years"]]
    flags = "".join(k[0].upper() for k in ("segment", "geo", "product") if k in doc["axes"])
    mism = "".join(k[0].upper() for k in ("segment", "geo", "product")
                   if k in doc["axes"] and doc["axes"][k]["check"] != "ok")
    return [max(fys) if fys else None, flags, mism]


# ────────────────────────────── 공시 목록 ──────────────────────────────
def annual_filings(sub: dict) -> list[dict]:
    """submissions JSON(recent) → 원본 연간 공시 목록(최신 순). /A(정정)는 뺀다."""
    r = (sub.get("filings") or {}).get("recent") or {}
    out = []
    for i, form in enumerate(r.get("form") or []):
        if form not in ANNUAL_FORMS:
            continue
        if not (r.get("isXBRL") or [1] * (i + 1))[i]:
            continue
        out.append({"accn": r["accessionNumber"][i], "form": form, "filed": r["filingDate"][i],
                    "end": r["reportDate"][i], "doc": r["primaryDocument"][i]})
    out.sort(key=lambda f: f["filed"], reverse=True)
    return out


def instance_names(doc: str) -> tuple[str, str, str]:
    """iXBRL 주 문서 이름 → (instance, 레이블, 스키마) 파일 이름 추정. 예: aapl-20250927.htm → aapl-20250927_htm.xml.

    2025년 이후 일부 공시(MSFT 등)는 레이블 링크베이스를 따로 두지 않고 스키마(.xsd) 안에 넣는다 → .xsd 폴백.
    """
    stem = re.sub(r"\.html?$", "", doc or "")
    return f"{stem}_htm.xml", f"{stem}_lab.xml", f"{stem}.xsd"


def pick_from_index(items: list[str]) -> tuple[str | None, str | None]:
    """공시 폴더 파일 목록에서 instance·레이블 파일(추정 실패 시 폴백)."""
    inst = next((n for n in items if n.endswith("_htm.xml")), None)
    if not inst:
        cands = [n for n in items if n.endswith(".xml") and not re.search(r"_(cal|def|lab|pre)\.xml$", n)
                 and n not in ("FilingSummary.xml",) and not n.startswith("R")]
        inst = cands[0] if cands else None
    lab = next((n for n in items if n.endswith("_lab.xml")), None) or next((n for n in items if n.endswith(".xsd")), None)
    return inst, lab


# ────────────────────────────── 네트워크 ──────────────────────────────
def get_bytes(url: str) -> bytes:
    """SEC GET(UA·gzip·백오프는 build_financials_us 와 같다). MIR_SEGMENTS_CACHE 가 있으면 공시 파일을
    그 폴더에 캐시한다(로컬 반복 확인용 — 공시 원본은 불변이라 안전하다. submissions 는 캐시하지 않는다)."""
    import hashlib
    import os
    from build_financials_us import get_bytes as _gb
    cache_dir = os.environ.get("MIR_SEGMENTS_CACHE", "").strip()
    cpath = None
    if cache_dir and "/Archives/" in url:
        cpath = Path(cache_dir) / hashlib.md5(url.encode()).hexdigest()
        if cpath.exists():
            return cpath.read_bytes()
    data = _gb(url)
    time.sleep(REQUEST_SLEEP)
    if cpath:
        cpath.parent.mkdir(parents=True, exist_ok=True)
        cpath.write_bytes(data)
    return data


REQUEST_SLEEP = 0.12


def fetch_filing(cik: int, f: dict) -> tuple[bytes | None, bytes | None]:
    acc = f["accn"].replace("-", "")
    inst_name, lab_name, xsd_name = instance_names(f["doc"])
    inst = lab = None
    try:
        inst = get_bytes(ARCHIVE_URL.format(cik=cik, acc=acc, name=inst_name))
    except Exception as exc:
        if getattr(exc, "code", None) != 404:
            raise
    if inst is None:
        idx = json.loads(get_bytes(ARCHIVE_URL.format(cik=cik, acc=acc, name="index.json")))
        names = [i.get("name", "") for i in (idx.get("directory") or {}).get("item") or []]
        inst_name, lab_name = pick_from_index(names)
        if not inst_name:
            return None, None
        inst = get_bytes(ARCHIVE_URL.format(cik=cik, acc=acc, name=inst_name))
    for name in dict.fromkeys(n for n in (lab_name, xsd_name) if n):
        try:
            lab = get_bytes(ARCHIVE_URL.format(cik=cik, acc=acc, name=name))
            break
        except Exception as exc:
            if getattr(exc, "code", None) != 404:
                raise
    return inst, lab


# ────────────────────────────── 빌드 ──────────────────────────────
def universe(top: int) -> list[dict]:
    snap = load_json(SNAPSHOT, {"stocks": []}) or {"stocks": []}
    stocks = [s for s in (snap.get("stocks") or []) if s.get("ticker") and s.get("sector") != "EXCHANGE TRADED FUNDS"]
    stocks.sort(key=lambda s: float(s.get("marketCapB") or 0), reverse=True)
    return stocks[:top] if top else stocks


def _d(s) -> date | None:
    try:
        return date.fromisoformat(str(s)[:10])
    except (TypeError, ValueError):
        return None


def run(args) -> int:
    from build_financials_us import filers_since, sec_symbol, ticker_cik_map
    from step_budget import StepBudget

    today = date.today()
    budget = StepBudget(args.time_budget_min, max_consecutive_errors=25)
    state = load_json(STATE_JSON, {}) or {}
    tstate: dict = state.get("tickers") or {}
    prev_index = load_json(OUT_JSON, {}) or {}
    index_tickers: dict = dict(prev_index.get("tickers") or {})

    stocks = universe(args.top)
    if args.only:
        wanted = {t.strip().upper() for t in args.only.split(",") if t.strip()}
        stocks = [s for s in stocks if str(s["ticker"]).upper() in wanted] or [{"ticker": t} for t in sorted(wanted)]
    print(f"[US부문] 대상 {len(stocks)}종목 · 시간 예산 {args.time_budget_min:g}분", flush=True)
    cmap = ticker_cik_map()
    time.sleep(REQUEST_SLEEP)

    scanned = _d(state.get("indexScannedThrough"))
    changed: set[int] = set()
    scanned_through = scanned
    if scanned and not args.only and (today - scanned).days <= MAX_SCAN_GAP_DAYS:
        start = scanned - timedelta(days=RESCAN_OVERLAP_DAYS)
        changed, last_ok = filers_since(start, today - timedelta(days=1))
        scanned_through = last_ok or scanned
        print(f"[US부문] 일별 색인 {start}~{last_ok}: 정기보고서 제출 CIK {len(changed)}곳", flush=True)
    else:
        scanned_through = today - timedelta(days=1)

    todo_new, todo_changed, todo_stale = [], [], []
    for s in stocks:
        t = str(s["ticker"]).upper()
        cik = cmap.get(sec_symbol(t))
        if cik is None:
            continue
        st = tstate.get(t) or {}
        checked = _d(st.get("checked"))
        if args.only or not checked or st.get("cik") != cik or st.get("error"):
            todo_new.append((s, t, cik))
        elif cik in changed:
            todo_changed.append((s, t, cik))
        elif (today - checked).days > STALE_DAYS:
            todo_stale.append((checked, s, t, cik))
    todo_stale.sort(key=lambda x: x[0])
    # 새 공시를 낸 종목 → 처음 보는 종목(시총순) → 오래된 재확인
    todo = todo_changed + todo_new + [(s, t, c) for _, s, t, c in todo_stale]
    print(f"[US부문] 확인할 종목 {len(todo)} (새 공시 {len(todo_changed)} · 미수집 {len(todo_new)} · "
          f"오래됨 {len(todo_stale)})", flush=True)

    stamp = sec.kst_now_str()
    ok = empty = failed = skipped = 0
    attempted = 0
    for i, (s, t, cik) in enumerate(todo, 1):
        if budget.over():
            print(f"[US부문] {budget.reason} — 받은 데까지 저장, 나머지 {len(todo) - i + 1}종목은 다음 실행에", flush=True)
            break
        attempted += 1
        st = dict(tstate.get(t) or {})
        try:
            sub = json.loads(get_bytes(SUBMISSIONS_URL.format(cik=cik)))
            filings = annual_filings(sub)
            if not filings:
                tstate[t] = {"cik": cik, "checked": today.isoformat(), "noAnnual": True}
                empty += 1
                budget.record(True)
                continue
            latest = filings[0]["accn"]
            path = OUT_DIR / f"{safe_file_name(t)}.json"
            if not args.only and st.get("accn") == latest and (path.exists() or st.get("noSegments")):
                st.update({"cik": cik, "checked": today.isoformat()})
                tstate[t] = st
                skipped += 1
                budget.record(True)
                continue
            picked = [filings[k] for k in HISTORY_FILINGS if k < len(filings)]
            extracted, used = [], []
            for f in picked:
                inst, lab = fetch_filing(cik, f)
                if not inst:
                    continue
                parsed = parse_instance(inst)
                labels = parse_labels(lab) if lab else {}
                ex = extract_filing(parsed, labels)
                if ex:
                    extracted.append(ex)
                    used.append({k: f[k] for k in ("accn", "form", "filed", "end")})
            budget.record(True)
        except Exception as exc:
            failed += 1
            budget.record(False)
            tstate[t] = {**st, "cik": cik, "checked": today.isoformat(), "error": f"{type(exc).__name__}: {exc}"[:160]}
            print(f"  [경고] {t} 실패: {type(exc).__name__}: {exc}", flush=True)
            continue
        doc = build_doc(t, s.get("company") or s.get("name") or t, cik, used, extracted, stamp) if extracted else None
        tstate[t] = {"cik": cik, "checked": today.isoformat(), "accn": latest}
        if not doc:
            tstate[t]["noSegments"] = True
            empty += 1
            # 전에 있던 파일이 이제 부문 공시가 없으면(단일 부문 전환 등) 옛 파일은 그대로 두지 않는다
            index_tickers.pop(t, None)
            (OUT_DIR / f"{safe_file_name(t)}.json").unlink(missing_ok=True)
            continue
        atomic_write_text(OUT_DIR / f"{safe_file_name(t)}.json", dumps_compact(doc) + "\n")
        index_tickers[t] = index_entry(doc)
        ok += 1
        if attempted % 50 == 0:
            print(f"  진행 {attempted}/{len(todo)} · 저장 {ok} · 부문 없음 {empty} · 같은 공시 {skipped} · 실패 {failed}"
                  f" · 경과 {budget.elapsed_min():.1f}분", flush=True)
    print(f"[US부문] 확인 {attempted} · 저장 {ok} · 부문 공시 없음 {empty} · 같은 공시(건너뜀) {skipped} · 실패 {failed}",
          flush=True)

    index_tickers = {t: v for t, v in index_tickers.items() if (OUT_DIR / f"{safe_file_name(t)}.json").exists()}
    if not index_tickers:
        print("[US부문] 인덱스 0종목 — 기존 파일 유지, 실패로 끝낸다")
        return 1
    n = len(index_tickers)
    cov = {k: sum(1 for v in index_tickers.values() if k[0].upper() in v[1]) for k in ("segment", "geo", "product")}
    mism = sum(1 for v in index_tickers.values() if v[2])
    payload = {
        "schema": SCHEMA, "market": "us", "updatedAtKst": stamp, "source": SOURCE, "count": n,
        "freshCount": ok, "failedCount": failed, "coverage": cov, "mismatchCount": mism,
        # 종목 → [최근 회계연도, 있는 축(S=사업부문 G=지역 P=제품), 합계 불일치 축]
        "tickers": dict(sorted(index_tickers.items())),
    }
    new_state = {"indexScannedThrough": (scanned_through or today).isoformat() if not args.only
                 else state.get("indexScannedThrough"),
                 "updatedAtKst": stamp, "tickers": dict(sorted(tstate.items()))}
    with repository_publish_lock(ROOT):
        sec.write_data(OUT_JSON, OUT_JS, "SEGMENTS_INDEX", payload, indent=None, min_ratio=0.8)
        atomic_write_text(STATE_JSON, dumps_compact(new_state) + "\n")
        print(f"Wrote {OUT_JSON.name} — {n}종목(이번 저장 {ok}) · 축별 {cov} · 합계 불일치 {mism}", flush=True)
        if args.push:
            paths = ["data/segments", "data/segments_index.json", "data/segments_index.js", "data/segments_state.json"]
            if not sec.git_publish(paths, "US revenue segments (SEC XBRL)"):
                print("[중단] US 부문 매출 push 실패 — 발행되지 않았다")
                return 1
    if attempted and failed > max(5, attempted * 0.3):
        print(f"[US부문] 요청 실패 {failed}/{attempted} — 실패로 끝낸다(저장분은 발행됨)")
        return 1
    if budget.reason.startswith("연속 요청 실패"):
        return 1
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="US 사업부문·지역·제품별 매출(SEC XBRL instance)")
    ap.add_argument("--push", action="store_true")
    ap.add_argument("--top", type=int, default=1100, help="시총 상위 N 종목(ETF 제외)")
    ap.add_argument("--only", default="", help="쉼표로 구분한 티커만(로컬 확인용, 색인 날짜는 안 바꾼다)")
    ap.add_argument("--time-budget-min", type=float, default=40, help="이 시간(분)이 지나면 멈추고 저장(0=무제한)")
    args = ap.parse_args()
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    print(f"=== US 사업부문 매출 (SEC XBRL, 상위 {args.top}) — {datetime.now():%Y-%m-%d %H:%M} ===", flush=True)
    return run(args)


if __name__ == "__main__":
    raise SystemExit(main())
