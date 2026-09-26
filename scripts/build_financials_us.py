#!/usr/bin/env python3
"""미국 재무 확장 — SEC EDGAR XBRL companyfacts → 종목별 연간 10년 · 분기 12개 · TTM.

스키마·필드 정의·로드 방법은 `scripts/financials_common.py` docstring 에 있다(역DCF · PER 밴드용).

수집
  1) ticker → CIK: sec.gov/files/company_tickers.json (BRK.B → BRK-B 로 맞춘다)
  2) 회사별 전체 팩트: data.sec.gov/api/xbrl/companyfacts/CIK##########.json (gzip ~0.3MB)
  3) 태그 대체 매핑(US_GAAP_TAGS / IFRS_TAGS)으로 계정마다 후보를 순서대로 훑는다. 회사·연도마다
     매출 태그가 다르다(Revenues / RevenueFromContractWithCustomerExcludingAssessedTax / SalesRevenueNet …).
     한 기간 안에서는 같은 태그끼리만 빼기(누계 차이)를 한다 — 태그를 섞어 빼지 않는다.
  4) 기간 달력: 10-K/10-Q/20-F/40-F 공시(accn)마다 가장 늦은 end = 그 공시의 기준 기간.
     분기 3개월 값 = (직접 공시된 ~90일 값) 또는 (YTD − 직전 YTD). 4분기 = 연간 − 9개월 누계.
     현금흐름표는 10-Q 에 누계로만 나오므로 대부분 빼기로 만들어지고, 그 필드는 행의 `d` 에 적힌다.
  5) 결측은 결측으로 둔다(0·추정 금지). 20-F/40-F(해외발행인)·금융업은 flags 로 표시.

증분 갱신(SEC 초당 10회 · User-Agent 필수 준수)
  - EDGAR 일별 색인(daily-index/master.YYYYMMDD.idx, 하루 1요청 ~300KB)을 마지막 스캔일 이후만 읽어
    10-K·10-Q·20-F·40-F(및 /A)를 낸 CIK 만 companyfacts 를 다시 받는다.
  - 처음 보는 종목, 120일 넘게 안 받은 종목(실행당 --stale-max 개)도 다시 받는다.
  - 상태: data/financials_state.json (빌더 전용). 45일 넘게 스캔이 끊겼으면 전체 재수집.
  - frames API 는 '기간 하나 × 태그 하나 × 전 종목' 이라 종목별 10년·분기 이력을 모으려면 오히려
    요청이 수천 배 많다. Financial Statement Data Sets(분기 zip, ~50MB)는 분기 지연이 있고 10-Q
    누계 처리가 같다. 그래서 companyfacts + 일별 색인 증분을 쓴다.

산출물
  data/financials/<TICKER>.json   종목별(지연 로드)
  data/financials_index.json/.js  window.FINANCIALS_INDEX (종목 목록·최근 결산기·플래그)
  data/financials_state.json      빌더 증분 상태(브라우저 안 읽음)

실행: python scripts/build_financials_us.py [--top 1100] [--only AAPL,MSFT] [--full] [--push]
"""

from __future__ import annotations

import argparse
import gzip
import json
import sys
import time
import urllib.request
from collections import Counter
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402
import sec_client as sec  # noqa: E402
from financials_common import (  # noqa: E402
    FLOW_FIELDS, INSTANT_FIELDS, MAX_ANNUAL, MAX_QUARTERS, SCHEMA_VERSION,
    add_derived, build_ttm, clean_row, dumps_compact, has_core, index_entry, load_json,
    safe_file_name,
)

SNAPSHOT = ROOT / "data" / "market_snapshot.json"
OUT_DIR = ROOT / "data" / "financials"
OUT_JSON = ROOT / "data" / "financials_index.json"
OUT_JS = ROOT / "data" / "financials_index.js"
STATE_JSON = ROOT / "data" / "financials_state.json"
UA = {"User-Agent": "Mir US Stocks research (dydtjsdn@gmail.com)", "Accept-Encoding": "gzip, deflate"}
TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json"
DAILY_INDEX_URL = "https://www.sec.gov/Archives/edgar/daily-index/{y}/QTR{q}/master.{ymd}.idx"
SOURCE = "SEC EDGAR XBRL companyfacts"

PERIODIC_FORMS = {"10-K", "10-Q", "20-F", "40-F", "10-KT", "10-QT"}
ANNUAL_FORMS = {"10-K", "20-F", "40-F", "10-KT"}
QUARTER_FORMS = {"10-Q", "10-QT"}
REQUEST_SLEEP = 0.12            # 초당 ~8회(SEC 한도 10회)
STALE_DAYS = 120
RESCAN_OVERLAP_DAYS = 3         # companyfacts 반영 지연 대비 겹쳐 읽는다
MAX_SCAN_GAP_DAYS = 45          # 이보다 오래 끊겼으면 색인 대신 전체 재수집

# 계정별 태그 후보 — 앞이 우선. 기간마다 첫 번째로 값이 있는 태그를 쓴다.
US_GAAP_TAGS = {
    "rev": ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues",
            "RevenueFromContractWithCustomerIncludingAssessedTax", "SalesRevenueNet",
            "SalesRevenueGoodsNet", "RevenuesNetOfInterestExpense", "RegulatedAndUnregulatedOperatingRevenue",
            "ElectricUtilityRevenue", "RevenueFromContractWithCustomerProductAndServiceExcludingAssessedTax"],
    "op": ["OperatingIncomeLoss"],
    "net": ["NetIncomeLoss", "NetIncomeLossAvailableToCommonStockholdersBasic", "ProfitLoss"],
    "pretax": ["IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
               "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments",
               "IncomeLossFromContinuingOperationsBeforeIncomeTaxesDomestic"],
    "tax": ["IncomeTaxExpenseBenefit"],
    "interest": ["InterestExpense", "InterestExpenseNonoperating", "InterestExpenseDebt",
                 "InterestAndDebtExpense"],
    "da": ["DepreciationDepletionAndAmortization", "DepreciationAmortizationAndAccretionNet",
           "DepreciationAndAmortization"],
    "sbc": ["ShareBasedCompensation", "AllocatedShareBasedCompensationExpense"],
    "ocf": ["NetCashProvidedByUsedInOperatingActivities",
            "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"],
    "capex": ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"],
    "epsDil": ["EarningsPerShareDiluted", "EarningsPerShareBasicAndDiluted"],
    "sharesDilAvg": ["WeightedAverageNumberOfDilutedSharesOutstanding"],
    "assets": ["Assets"],
    "liab": ["Liabilities"],
    "equity": ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
    "cash": ["CashAndCashEquivalentsAtCarryingValue", "CashAndDueFromBanks",
             "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"],
    "curAssets": ["AssetsCurrent"],
    "curLiab": ["LiabilitiesCurrent"],
    "receivables": ["AccountsReceivableNetCurrent", "ReceivablesNetCurrent"],
    "sharesOut": ["CommonStockSharesOutstanding"],
}
# 총차입금 구성 태그(instant). 조합 규칙은 debt_from_parts 참고.
US_GAAP_DEBT = {
    "total": ["DebtLongtermAndShorttermCombinedAmount"],
    "ltTotal": ["LongTermDebt"],
    "ltNoncurrent": ["LongTermDebtNoncurrent", "LongTermDebtAndCapitalLeaseObligations"],
    "ltCurrent": ["LongTermDebtCurrent", "LongTermDebtAndCapitalLeaseObligationsCurrent"],
    "curTotal": ["DebtCurrent"],
    "stb": ["ShortTermBorrowings", "CommercialPaper"],
}

IFRS_TAGS = {
    # RevenueFromSaleOfGoods(제품 매출)는 총매출 태그가 없을 때만(노바티스·사노피는 이것이 순매출 헤드라인).
    "rev": ["Revenue", "RevenueFromContractsWithCustomers", "RevenueFromSaleOfGoods"],
    "op": ["ProfitLossFromOperatingActivities"],
    "net": ["ProfitLossAttributableToOwnersOfParent", "ProfitLoss"],
    "pretax": ["ProfitLossBeforeTax"],
    "tax": ["IncomeTaxExpenseContinuingOperations"],
    "interest": ["InterestExpense", "InterestExpenseOnBorrowings"],
    "da": ["DepreciationAndAmortisationExpense", "AdjustmentsForDepreciationAndAmortisationExpense"],
    "sbc": ["AdjustmentsForSharebasedPayments", "ExpenseFromSharebasedPaymentTransactionsWithEmployees"],
    "ocf": ["CashFlowsFromUsedInOperatingActivities"],
    "capex": ["PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities",
              "PurchaseOfPropertyPlantAndEquipment"],
    "epsDil": ["DilutedEarningsLossPerShare", "BasicAndDilutedEarningsLossPerShare"],
    "sharesDilAvg": ["AdjustedWeightedAverageShares"],
    "assets": ["Assets"],
    "liab": ["Liabilities"],
    "equity": ["EquityAttributableToOwnersOfParent", "Equity"],
    "cash": ["CashAndCashEquivalents"],
    "curAssets": ["CurrentAssets"],
    "curLiab": ["CurrentLiabilities"],
    "receivables": ["TradeAndOtherCurrentReceivables", "CurrentTradeReceivables"],
    "sharesOut": [],
}
IFRS_DEBT = {
    "total": ["Borrowings"],
    "curTotal": ["CurrentBorrowingsAndCurrentPortionOfNoncurrentBorrowings"],
    "ltNoncurrent": ["NoncurrentPortionOfNoncurrentBorrowings", "LongtermBorrowings"],
    "ltCurrent": ["CurrentPortionOfLongtermBorrowings"],
    "stb": ["ShorttermBorrowings"],
    "ltTotal": [],
}

SHARE_FIELDS = {"sharesDilAvg", "sharesOut"}
PER_SHARE_FIELDS = {"epsDil"}
# 빼기로 만들면 안 되는 값: 가중평균 주식수는 평균이라 차이가 의미 없다.
NO_SUBTRACT = {"sharesDilAvg"}


# ────────────────────────────── 날짜 도우미 ──────────────────────────────
def _d(s: str) -> date | None:
    try:
        return date.fromisoformat(str(s)[:10])
    except (TypeError, ValueError):
        return None


def _days(start: str, end: str) -> int | None:
    a, b = _d(start), _d(end)
    return (b - a).days if a and b else None


def _base_form(form: str) -> str:
    return str(form or "").upper().split("/")[0]


# ────────────────────────────── 팩트 수집 ──────────────────────────────
class TagFacts:
    """한 태그·한 단위의 팩트. 같은 기간이 여러 공시에 실리면 가장 늦게 제출된 값(정정 반영)."""

    __slots__ = ("dur", "inst")

    def __init__(self):
        self.dur: dict[tuple[str, str], tuple] = {}   # (start, end) -> (val, filed, accn)
        self.inst: dict[str, tuple] = {}              # end -> (val, filed, accn)

    def add(self, u: dict):
        val = u.get("val")
        if not isinstance(val, (int, float)) or isinstance(val, bool):
            return
        end = u.get("end")
        if not end:
            return
        filed = str(u.get("filed") or "")
        rec = (val, filed, u.get("accn"))
        start = u.get("start")
        if start:
            key = (start, end)
            old = self.dur.get(key)
            if old is None or filed > old[1]:
                self.dur[key] = rec
        else:
            old = self.inst.get(end)
            if old is None or filed > old[1]:
                self.inst[end] = rec


def collect(ns: dict, tag: str, unit: str) -> TagFacts | None:
    node = ns.get(tag)
    if not node:
        return None
    arr = (node.get("units") or {}).get(unit)
    if not arr:
        return None
    tf = TagFacts()
    for u in arr:
        if _base_form(u.get("form")) in PERIODIC_FORMS:
            tf.add(u)
    return tf if (tf.dur or tf.inst) else None


def pick_currency(ns: dict) -> str | None:
    """금액 단위(통화) — Assets·매출 등 핵심 팩트가 가장 많은 3글자 통화."""
    counts: Counter = Counter()
    for tag in ("Assets", "Revenues", "Revenue", "RevenueFromContractWithCustomerExcludingAssessedTax",
                "Equity", "StockholdersEquity", "ProfitLoss", "NetIncomeLoss"):
        node = ns.get(tag)
        for unit, arr in ((node or {}).get("units") or {}).items():
            if len(unit) == 3 and unit.isalpha() and unit.isupper():
                counts[unit] += len(arr)
    if not counts:
        return None
    # 20-F 는 최신 연도만 USD '편의 환산'을 싣는 회사가 있다(TSMC: 본 통화 TWD). 팩트가 가장 많은
    # 통화가 보고 통화다. USD 는 동률일 때만 우선.
    top = max(counts.values())
    if counts.get("USD") == top:
        return "USD"
    return counts.most_common(1)[0][0]


# ────────────────────────────── 기간 달력 ──────────────────────────────
def build_calendar(ns: dict, scan: list[tuple[str, str]]):
    """공시(accn) → (form, fy, fp, filed, 기준 end). 기준 end = 그 공시에 든 팩트의 가장 늦은 end."""
    accns: dict[str, dict] = {}
    for tag, unit in scan:
        node = ns.get(tag)
        arr = ((node or {}).get("units") or {}).get(unit) or []
        for u in arr:
            form = _base_form(u.get("form"))
            if form not in PERIODIC_FORMS or not u.get("accn") or not u.get("end"):
                continue
            info = accns.setdefault(u["accn"], {"form": form, "fy": u.get("fy"), "fp": u.get("fp"),
                                                "filed": str(u.get("filed") or ""), "end": ""})
            if u["end"] > info["end"]:
                info["end"] = u["end"]
    annual: dict[str, dict] = {}
    quarters: dict[str, dict] = {}
    for accn, info in accns.items():
        end = info["end"]
        if info["form"] in ANNUAL_FORMS:
            cur = annual.get(end)
            if cur is None or info["filed"] < cur["filed"]:     # 원본 공시(가장 이른 제출)의 라벨
                annual[end] = {"end": end, "fy": info["fy"], "filed": info["filed"], "form": info["form"],
                               "accn": accn}
        elif info["form"] in QUARTER_FORMS and str(info.get("fp") or "") in ("Q1", "Q2", "Q3"):
            cur = quarters.get(end)
            if cur is None or info["filed"] < cur["filed"]:
                quarters[end] = {"end": end, "fy": info["fy"], "fq": int(str(info["fp"])[1]),
                                 "filed": info["filed"], "form": info["form"], "accn": accn}
    return annual, quarters, accns


def _latest(recs):
    """(val, filed, accn) 들 중 가장 늦게 제출된 것."""
    recs = [r for r in recs if r]
    return max(recs, key=lambda r: r[1]) if recs else None


def annual_start(tfs: list[TagFacts], end: str) -> str | None:
    """연간 기간(330~380일) 의 시작일 — 여러 태그에서 가장 흔한 값."""
    c: Counter = Counter()
    for tf in tfs:
        for (s, e) in tf.dur:
            if e == end:
                d = _days(s, e)
                if d is not None and 330 <= d <= 380:
                    c[s] += 1
    return c.most_common(1)[0][0] if c else None


def ytd_start(tfs: list[TagFacts], end: str) -> str | None:
    """분기말 end 로 끝나는 가장 긴(≤290일) 기간의 시작 = 회계연도 시작."""
    best = None
    for tf in tfs:
        for (s, e) in tf.dur:
            if e != end:
                continue
            d = _days(s, e)
            if d is None or d > 290 or d < 60:
                continue
            if best is None or s < best:
                best = s
    return best


# ────────────────────────────── 값 추출 ──────────────────────────────
def flow_annual(tf: TagFacts, end: str, start: str | None):
    if start and (start, end) in tf.dur:
        return tf.dur[(start, end)]
    cands = [rec for (s, e), rec in tf.dur.items() if e == end and 330 <= (_days(s, e) or 0) <= 380]
    return _latest(cands)


def flow_quarter(tf: TagFacts, end: str, fq: int, fy_start: str | None, allow_subtract: bool):
    """(값, 빼기로 만들었나). 직접 3개월 값이 있으면 그것, 없으면 누계 차이."""
    direct = _latest([rec for (s, e), rec in tf.dur.items() if e == end and 75 <= (_days(s, e) or 0) <= 105])
    if direct:
        return direct[0], False
    if not allow_subtract or not fy_start:
        return None, False
    ytd = tf.dur.get((fy_start, end))
    if ytd is None:
        return None, False
    ytd_days = _days(fy_start, end) or 0
    if fq == 1 or ytd_days <= 105:
        return ytd[0], False
    # 직전 누계: 같은 시작일로 끝나는 기간 중 end 직전 것(약 3개월 전)
    prev_ends = [e for (s, e) in tf.dur if s == fy_start and e < end]
    if not prev_ends:
        return None, False
    prev_end = max(prev_ends)
    gap = _days(prev_end, end) or 0
    if not 75 <= gap <= 105:
        return None, False
    return ytd[0] - tf.dur[(fy_start, prev_end)][0], True


def debt_from_parts(parts: dict) -> float | None:
    """총차입금. parts: 구성 이름 → 값(없으면 키 없음).

    total(단일 합계 태그)이 있으면 그것. 아니면 장기(유동 포함 합계 또는 비유동+유동) + 단기차입금/CP.
    구성 태그가 하나도 없으면 None(결측) — 무차입과 태그 누락을 구분할 수 없어 0 으로 두지 않는다.
    """
    if parts.get("total") is not None:
        return parts["total"]
    stb = parts.get("stb")
    if parts.get("ltTotal") is not None:
        return parts["ltTotal"] + (stb or 0)
    if parts.get("ltNoncurrent") is not None:
        if parts.get("curTotal") is not None:
            return parts["ltNoncurrent"] + parts["curTotal"]
        return parts["ltNoncurrent"] + (parts.get("ltCurrent") or 0) + (stb or 0)
    if parts.get("curTotal") is not None:
        return parts["curTotal"]
    if stb is not None or parts.get("ltCurrent") is not None:
        return (stb or 0) + (parts.get("ltCurrent") or 0)
    return None


def _industry(ns: dict, taxonomy: str, sector: str | None) -> str:
    if taxonomy == "us-gaap":
        if "Deposits" in ns or ("InterestAndDividendIncomeOperating" in ns and "OperatingIncomeLoss" not in ns):
            return "bank"
        if "PremiumsEarnedNet" in ns or "LiabilityForFuturePolicyBenefits" in ns:
            return "insurance"
    else:
        if "DepositsFromCustomers" in ns:
            return "bank"
        if "InsuranceContractsLiabilities" in ns or "RevenueFromInsuranceContractsIssued" in ns:
            return "insurance"
    if str(sector or "").upper() == "FINANCIAL" and "OperatingIncomeLoss" not in ns \
            and "ProfitLossFromOperatingActivities" not in ns:
        return "financial"
    return "general"


def _latest_end(ns: dict) -> str:
    best = ""
    for tag in ("Assets", "Liabilities", "StockholdersEquity", "Equity", "NetIncomeLoss", "ProfitLoss"):
        for arr in (((ns.get(tag) or {}).get("units")) or {}).values():
            for u in arr:
                e = str(u.get("end") or "")
                if e > best and _base_form(u.get("form")) in PERIODIC_FORMS:
                    best = e
    return best


def extract_company(facts: dict, *, ticker: str, cik: int | None = None, sector: str | None = None,
                    name: str | None = None, updated: str | None = None) -> dict | None:
    """companyfacts JSON → 종목 파일(스키마 1). 연간·분기 행이 하나도 없으면 None. 네트워크 없음(순수)."""
    all_ns = facts.get("facts") or {}
    gaap = all_ns.get("us-gaap") or {}
    ifrs = all_ns.get("ifrs-full") or {}
    dei = all_ns.get("dei") or {}
    # 회계 체계는 '최근에 쓰는 쪽' 으로 고른다. 태그 수로 고르면 US GAAP → IFRS 로 바꾼 회사(AEM·FMS 등)가
    # 옛 us-gaap 팩트가 더 많아 2013년 값에 멈춘다(2026-09-26 첫 전수 실행에서 확인).
    if not gaap and not ifrs:
        return None
    if _latest_end(gaap) >= _latest_end(ifrs) and gaap:
        ns, taxonomy, tag_map, debt_map = gaap, "us-gaap", US_GAAP_TAGS, US_GAAP_DEBT
    else:
        ns, taxonomy, tag_map, debt_map = ifrs, "ifrs-full", IFRS_TAGS, IFRS_DEBT
    currency = pick_currency(ns)
    if not currency:
        return None

    def unit_for(field: str) -> str:
        if field in SHARE_FIELDS:
            return "shares"
        if field in PER_SHARE_FIELDS:
            return f"{currency}/shares"
        return currency

    tag_facts: dict[str, list[tuple[str, TagFacts]]] = {}
    scan: list[tuple[str, str]] = []
    for field, tags in tag_map.items():
        lst = []
        for tag in tags:
            tf = collect(ns, tag, unit_for(field))
            if tf:
                lst.append((tag, tf))
                scan.append((tag, unit_for(field)))
        tag_facts[field] = lst
    debt_facts: dict[str, list[TagFacts]] = {}
    for part, tags in debt_map.items():
        debt_facts[part] = [tf for tf in (collect(ns, t, currency) for t in tags) if tf]

    annual_cal, quarter_cal, accns = build_calendar(ns, scan)
    if not annual_cal and not quarter_cal:
        return None
    all_tfs = [tf for lst in tag_facts.values() for _, tf in lst]

    # dei 표지 주식수(해당 공시의 기준 기간에 대응) — us-gaap 기말 주식수가 없을 때만 쓴다.
    dei_shares: dict[str, float] = {}
    for u in (((dei.get("EntityCommonStockSharesOutstanding") or {}).get("units") or {}).get("shares") or []):
        info = accns.get(u.get("accn"))
        if info and isinstance(u.get("val"), (int, float)):
            dei_shares.setdefault(info["end"], 0)
            dei_shares[info["end"]] = max(dei_shares[info["end"]], u["val"])

    used_tags: dict[str, str] = {}

    def instant(field: str, end: str):
        for tag, tf in tag_facts.get(field, []):
            rec = tf.inst.get(end)
            if rec:
                return rec[0], tag
        if field == "sharesOut" and end in dei_shares:
            return dei_shares[end], "dei:EntityCommonStockSharesOutstanding"
        return None, None

    def debt_at(end: str):
        parts = {}
        for part, tfs in debt_facts.items():
            for tf in tfs:
                rec = tf.inst.get(end)
                if rec:
                    parts[part] = rec[0]
                    break
        return debt_from_parts(parts)

    # ── 연간 ──
    annual_rows = []
    for end in sorted(annual_cal):
        info = annual_cal[end]
        start = annual_start(all_tfs, end)
        row = {"fy": info["fy"], "end": end, "filed": info["filed"], "form": info["form"], "_start": start}
        tags_here = {}
        for field in FLOW_FIELDS:
            for tag, tf in tag_facts.get(field, []):
                rec = flow_annual(tf, end, start)
                if rec:
                    row[field] = rec[0]
                    tags_here[field] = tag
                    break
        for field in INSTANT_FIELDS:
            v, tag = instant(field, end)
            if v is not None:
                row[field] = v
                tags_here[field] = tag
        dv = debt_at(end)
        if dv is not None:
            row["debt"] = dv
        if field_capex_negative(row):
            row["capex"] = abs(row["capex"])
        if has_core(row):
            row["_tags"] = tags_here
            annual_rows.append(row)
    # 같은 fy 라벨이 둘이면(정정·결산월 변경) 늦은 end 만
    by_fy: dict = {}
    for r in annual_rows:
        by_fy[r["fy"]] = r
    annual_rows = sorted(by_fy.values(), key=lambda r: r["end"])[-MAX_ANNUAL:]
    if annual_rows:
        used_tags = annual_rows[-1].pop("_tags", {})
    for r in annual_rows:
        r.pop("_tags", None)

    # ── 분기(1~3분기 + 연간에서 만든 4분기) ──
    q_periods: dict[str, dict] = {}
    for end, info in quarter_cal.items():
        q_periods[end] = dict(info)
    for r in annual_rows:
        # 그 회계연도의 3분기가 달력에 있을 때만 4분기를 만든다(분기 공시가 없는 20-F 는 제외)
        has_q3 = any(q["fq"] == 3 and 60 <= (_days(q["end"], r["end"]) or 0) <= 120 for q in quarter_cal.values())
        if has_q3 and r["end"] not in q_periods:
            q_periods[r["end"]] = {"end": r["end"], "fy": r["fy"], "fq": 4, "filed": r["filed"],
                                   "form": r["form"], "_start": r.get("_start")}
    q_rows = []
    for end in sorted(q_periods)[-(MAX_QUARTERS + 4):]:
        info = q_periods[end]
        fq = info["fq"]
        fy_start = info.get("_start") if fq == 4 else ytd_start(all_tfs, end)
        row = {"fy": info["fy"], "fq": fq, "end": end, "filed": info["filed"], "form": info["form"]}
        derived = []
        for field in FLOW_FIELDS:
            for tag, tf in tag_facts.get(field, []):
                if fq == 4:
                    ann = flow_annual(tf, end, fy_start)
                    direct = _latest([rec for (s, e), rec in tf.dur.items()
                                      if e == end and 75 <= (_days(s, e) or 0) <= 105])
                    if direct:
                        row[field] = direct[0]
                        break
                    if ann is None or field in NO_SUBTRACT or not fy_start:
                        continue
                    nine = [(s, e) for (s, e) in tf.dur if s == fy_start and 250 <= (_days(s, e) or 0) <= 290]
                    if not nine:
                        continue
                    row[field] = ann[0] - tf.dur[max(nine, key=lambda k: k[1])][0]
                    derived.append(field)
                    break
                v, was_sub = flow_quarter(tf, end, fq, fy_start, field not in NO_SUBTRACT)
                if v is not None:
                    row[field] = v
                    if was_sub:
                        derived.append(field)
                    break
        for field in INSTANT_FIELDS:
            v, _tag = instant(field, end)
            if v is not None:
                row[field] = v
        dv = debt_at(end)
        if dv is not None:
            row["debt"] = dv
        if field_capex_negative(row):
            row["capex"] = abs(row["capex"])
        if derived:
            row["d"] = sorted(set(derived))
        if has_core(row):
            q_rows.append(row)
    q_rows = q_rows[-MAX_QUARTERS:]

    for r in annual_rows:
        r.pop("_start", None)
        add_derived(r)
    for r in q_rows:
        add_derived(r)
    annual_out = [clean_row(r) for r in annual_rows]
    quarter_out = [clean_row(r) for r in q_rows]
    if not annual_out and not quarter_out:
        return None

    annual_form = annual_out[-1].get("form") if annual_out else None
    flags = []
    if annual_form in ("20-F", "40-F"):
        flags += ["foreignFiler", "adrShareBasis"]
    if currency != "USD":
        flags.append("nonUsdReporting")
    industry = _industry(ns, taxonomy, sector)
    if industry != "general":
        flags.append("financial")
    if not quarter_out:
        flags.append("noQuarterly")
    last_filed = max([r.get("filed") or "" for r in annual_out + quarter_out] or [""])
    doc = {
        "schema": SCHEMA_VERSION,
        "market": "us",
        "ticker": ticker,
        "name": name or facts.get("entityName") or ticker,
        "id": {"cik": int(cik if cik is not None else facts.get("cik") or 0)},
        "source": SOURCE,
        "basis": taxonomy,
        "currency": currency,
        "annualForm": annual_form,
        "industryType": industry,
        "flags": flags,
        "updatedAtKst": updated or sec.kst_now_str(),
        "lastFiled": last_filed or None,
        "tags": used_tags,
        "annual": annual_out,
        "quarterly": quarter_out,
        "ttm": build_ttm(quarter_out, annual_out),
    }
    return doc


def field_capex_negative(row: dict) -> bool:
    v = row.get("capex")
    return isinstance(v, (int, float)) and v < 0


# ────────────────────────────── 네트워크 ──────────────────────────────
def get_bytes(url: str, timeout=30, retries=4) -> bytes:
    """429/5xx 는 지수 백오프로 재시도, 403/404 는 즉시 중단."""
    last = None
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                raw = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    raw = gzip.decompress(raw)
                return raw
        except Exception as exc:
            last = exc
            if getattr(exc, "code", None) in (403, 404):
                raise
            if attempt < retries:
                sec.backoff_sleep(attempt, base=1.0, cap=30.0)
    raise last


def get_json(url: str):
    return json.loads(get_bytes(url).decode("utf-8", "replace"))


def ticker_cik_map() -> dict[str, int]:
    data = get_json(TICKERS_URL)
    out = {}
    for v in (data.values() if isinstance(data, dict) else data):
        t = str(v.get("ticker") or "").upper()
        if t and v.get("cik_str") is not None:
            out[t] = int(v["cik_str"])
    return out


def sec_symbol(ticker: str) -> str:
    """스냅샷 BRK.B → SEC BRK-B."""
    return str(ticker).upper().replace(".", "-")


def filers_since(start: date, end: date) -> tuple[set[int], date | None]:
    """[start, end] 일별 색인에서 정기보고서를 낸 CIK. (CIK 집합, 마지막으로 읽은 날짜)."""
    ciks: set[int] = set()
    last_ok = None
    d = start
    while d <= end:
        if d.weekday() < 5:
            url = DAILY_INDEX_URL.format(y=d.year, q=(d.month - 1) // 3 + 1, ymd=d.strftime("%Y%m%d"))
            try:
                text = get_bytes(url, retries=3).decode("latin-1", "replace")
                for line in text.splitlines():
                    parts = line.split("|")
                    if len(parts) >= 3 and parts[0].isdigit() and _base_form(parts[2]) in PERIODIC_FORMS:
                        ciks.add(int(parts[0]))
                last_ok = d
            except Exception as exc:
                if getattr(exc, "code", None) in (403, 404):
                    last_ok = d          # 휴일은 색인 파일이 없다
                else:
                    print(f"  [경고] 일별 색인 {d} 실패: {exc} — 여기서 멈추고 다음 실행에 이어 읽는다")
                    break
            time.sleep(REQUEST_SLEEP)
        else:
            last_ok = d
        d += timedelta(days=1)
    return ciks, last_ok


# ────────────────────────────── 빌드 ──────────────────────────────
def universe(top: int) -> list[dict]:
    snap = load_json(SNAPSHOT, {"stocks": []}) or {"stocks": []}
    stocks = [s for s in (snap.get("stocks") or []) if s.get("ticker") and s.get("sector") != "EXCHANGE TRADED FUNDS"]
    stocks.sort(key=lambda s: float(s.get("marketCapB") or 0), reverse=True)
    return stocks[:top] if top else stocks


def run(args) -> int:
    today = date.today()
    state = load_json(STATE_JSON, {}) or {}
    tstate: dict = state.get("tickers") or {}
    prev_index = load_json(OUT_JSON, {}) or {}
    index_tickers: dict = dict(prev_index.get("tickers") or {})

    stocks = universe(args.top)
    if args.only:
        wanted = {t.strip().upper() for t in args.only.split(",") if t.strip()}
        stocks = [s for s in stocks if str(s["ticker"]).upper() in wanted] or \
                 [{"ticker": t} for t in sorted(wanted)]
    print(f"[US재무] 대상 {len(stocks)}종목 · CIK 매핑 로드")
    cmap = ticker_cik_map()
    time.sleep(REQUEST_SLEEP)

    # 증분: 일별 색인으로 새 정기보고서를 낸 CIK
    scanned = _d(state.get("indexScannedThrough") or "")
    full = args.full or scanned is None or (today - scanned).days > MAX_SCAN_GAP_DAYS
    changed: set[int] = set()
    scanned_through = scanned
    if not full and not args.only:
        start = scanned - timedelta(days=RESCAN_OVERLAP_DAYS)
        changed, last_ok = filers_since(start, today - timedelta(days=1))
        if last_ok:
            scanned_through = last_ok
        print(f"[US재무] 일별 색인 {start}~{last_ok}: 정기보고서 제출 CIK {len(changed)}곳")
    elif full:
        scanned_through = today - timedelta(days=1)
        print("[US재무] 전체 재수집(첫 실행·--full·색인 공백)")

    todo = []
    stale = []
    for s in stocks:
        t = str(s["ticker"]).upper()
        cik = cmap.get(sec_symbol(t))
        if cik is None:
            continue
        st = tstate.get(t) or {}
        fetched = _d(st.get("fetched") or "")
        if full or args.only or not fetched or cik in changed or st.get("cik") != cik:
            todo.append((s, t, cik))
        elif (today - fetched).days > STALE_DAYS:
            stale.append((fetched, s, t, cik))
    stale.sort(key=lambda x: x[0])
    todo += [(s, t, cik) for _, s, t, cik in stale[:args.stale_max]]
    print(f"[US재무] 이번에 받을 종목 {len(todo)} (오래된 재확인 {min(len(stale), args.stale_max)})")

    ok = failed = empty = 0
    stamp = sec.kst_now_str()
    written: list[str] = []
    for i, (s, t, cik) in enumerate(todo, 1):
        try:
            facts = get_json(FACTS_URL.format(cik=cik))
        except Exception as exc:
            if getattr(exc, "code", None) == 404:
                # XBRL 재무를 안 내는 등록자(폐쇄형 펀드 등) — 실패가 아니라 '재무 없음'. 상태에 적어
                # 매주 다시 요청해 실패로 세지 않게 한다(120일 뒤 재확인).
                empty += 1
                tstate[t] = {"cik": cik, "fetched": today.isoformat(), "noFacts": True}
                time.sleep(REQUEST_SLEEP)
                continue
            failed += 1
            print(f"  [경고] {t} CIK {cik} companyfacts 실패: {exc}")
            time.sleep(REQUEST_SLEEP)
            continue
        time.sleep(REQUEST_SLEEP)
        try:
            doc = extract_company(facts, ticker=t, cik=cik, sector=s.get("sector"),
                                  name=s.get("company"), updated=stamp)
        except Exception as exc:  # 한 회사의 이상한 팩트가 전체를 멈추지 않게
            failed += 1
            print(f"  [경고] {t} 파싱 실패: {type(exc).__name__}: {exc}")
            continue
        tstate[t] = {"cik": cik, "fetched": today.isoformat()}
        if not doc:
            empty += 1
            continue
        tstate[t]["lastFiled"] = doc.get("lastFiled")
        path = OUT_DIR / f"{safe_file_name(t)}.json"
        atomic_write_text(path, dumps_compact(doc) + "\n")
        written.append(t)
        index_tickers[t] = index_entry(doc)
        ok += 1
        if i % 100 == 0:
            print(f"  진행 {i}/{len(todo)} (저장 {ok}, 비어 있음 {empty}, 실패 {failed})")
    print(f"[US재무] 시도 {len(todo)} · 저장 {ok} · 재무 없음 {empty} · 실패 {failed}")

    # 인덱스는 디스크에 실제로 있는 파일만(404 방지)
    index_tickers = {t: v for t, v in index_tickers.items() if (OUT_DIR / f"{safe_file_name(t)}.json").exists()}
    if not index_tickers:
        print("[US재무] 인덱스 0종목 — 기존 파일 유지, 실패로 끝낸다")
        return 1
    payload = {
        "schema": SCHEMA_VERSION, "market": "us", "updatedAtKst": stamp, "source": SOURCE,
        "count": len(index_tickers), "freshCount": ok, "failedCount": failed,
        "fields": "rev,op,net,pretax,tax,interest,da,sbc,ocf,capex,fcf,epsDil,sharesDilAvg,"
                  "assets,liab,equity,cash,debt,netDebt,curAssets,curLiab,receivables,sharesOut",
        "tickers": dict(sorted(index_tickers.items())),
    }
    new_state = {"indexScannedThrough": (scanned_through or today).isoformat()
                 if not args.only else state.get("indexScannedThrough"),
                 "updatedAtKst": stamp, "tickers": dict(sorted(tstate.items()))}
    with repository_publish_lock(ROOT):
        sec.write_data(OUT_JSON, OUT_JS, "FINANCIALS_INDEX", payload, indent=None, min_ratio=0.8)
        atomic_write_text(STATE_JSON, dumps_compact(new_state) + "\n")
        print(f"Wrote {OUT_JSON.name} — {len(index_tickers)}종목(이번 저장 {ok})")
        if args.push:
            paths = ["data/financials", "data/financials_index.json", "data/financials_index.js",
                     "data/financials_state.json"]
            if not sec.git_publish(paths, "US financials (SEC)"):
                print("[중단] US 재무 push 실패 — 발행되지 않았다")
                return 1
    # 받으려던 것의 30% 넘게 실패했으면 저장분은 발행하되 실패로 알린다(신선도 게이트·텔레그램).
    if todo and failed > max(5, len(todo) * 0.3):
        print(f"[US재무] 요청 실패 {failed}/{len(todo)} — 실패로 끝낸다(저장분은 발행됨)")
        return 1
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="US 재무 확장(SEC companyfacts, 연간·분기·TTM)")
    ap.add_argument("--push", action="store_true")
    ap.add_argument("--top", type=int, default=1100, help="시총 상위 N 종목(ETF 제외)")
    ap.add_argument("--only", default="", help="쉼표로 구분한 티커만(로컬 확인용, 상태의 색인 날짜는 안 바꾼다)")
    ap.add_argument("--full", action="store_true", help="색인 무시하고 전부 다시 받기")
    ap.add_argument("--stale-max", type=int, default=200, help="120일 넘은 종목 재확인 상한(실행당)")
    args = ap.parse_args()
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    print(f"=== US 재무 확장 (SEC companyfacts, 상위 {args.top}) — {datetime.now():%Y-%m-%d %H:%M} ===")
    return run(args)


if __name__ == "__main__":
    raise SystemExit(main())
