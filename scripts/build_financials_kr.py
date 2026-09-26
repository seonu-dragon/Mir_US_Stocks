#!/usr/bin/env python3
"""국내 재무 확장 — DART 전체재무제표(fnlttSinglAcntAll) → 종목별 연간 · 분기 12개 · TTM.

스키마·필드 정의·로드 방법은 `scripts/financials_common.py` docstring 에 있다(US 와 같은 스키마).

DART 응답 구조(2026-09-26 실제 호출로 확인, 삼성전자 00126380)
  - 사업보고서(11011): thstrm_amount(당기) · frmtrm_amount(전기) · bfefrmtrm_amount(전전기) — IS/CF/BS 모두.
  - 분기·반기(11013/11012/11014):
      손익(IS/CIS): thstrm_amount = 해당 분기 3개월, thstrm_add_amount = 누계,
                    frmtrm_q_amount = 전년 같은 분기 3개월, frmtrm_add_amount = 전년 누계
      현금흐름(CF): thstrm_amount = 누계, frmtrm_q_amount = 전년 같은 기간 누계
      재무상태(BS): thstrm_amount = 분기말, frmtrm_amount = 전기말
  - 설비투자(유형자산의 취득)는 양수로 온다 — 회사마다 부호가 섞여 절댓값으로 통일(build_kr_earnings 와 같다).
  - 감가상각비·주식보상비용·이자비용은 대부분 본문에 없다(조정 한 줄 / 금융비용만) → 결측으로 둔다.
  - 기말일(end)은 주지 않는다. 행은 fy(사업연도)·fq 로만 라벨한다.
  - 연결(CFS) 우선, 없으면(status 013) 별도(OFS). 회사별로 한 번 정하면 그 기준을 계속 쓴다(행이 섞이지 않게).
  - 주식수: stockTotqySttus(주식의 총수 현황) 사업보고서 보통주 유통주식수(발행 − 자기주식). 연간만.

호출 예산(DART 개인 키 하루 한도 — 같은 주간 워크플로우의 소유구조·감사의견 빌더와 나눠 쓴다)
  종목당 보고서 1개 = 1회. 처음 채울 때는 종목당 ~15회라 한 번에 다 못 받는다. --max-calls(기본 4,000)
  안에서 **우선순위 계층**으로 받는다: ① 최신 사업보고서·최신 분기 → ② 나머지 최근 8개 보고서 →
  ③ 3년 전 사업보고서 → ④ 주식수 → ⑤ 6년 전 사업보고서. 받은 보고서는 종목 파일의 `_raw.reports` 에
  적어 두고 다음 실행은 빠진 것만 받는다(몇 주에 걸쳐 채워진다). 평시에는 새 보고서 제출 기한이
  지난 주에만 종목당 1회씩 든다. status 020(한도 초과)이면 거기서 멈추고 받은 데까지 저장 + exit 1.

산출물
  data/korea/financials/<코드>.json          종목별(지연 로드, `_raw` = 증분 재계산용 원천값 — 화면은 안 쓴다)
  data/korea/financials_index.json/.js        window.FINANCIALS_INDEX (KR 모드에서 같은 전역)

Requires DART_API_KEY.
실행: python scripts/build_financials_kr.py [--top 1000] [--max-calls 4000] [--only 005930,000660] [--push]
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
except Exception:
    pass

from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402
import sec_client as sec  # noqa: E402
from financials_common import (  # noqa: E402
    FLOW_FIELDS, INSTANT_FIELDS, MAX_ANNUAL, MAX_QUARTERS, SCHEMA_VERSION,
    add_derived, build_ttm, clean_row, dumps_compact, has_core, index_entry, load_json,
)

KR_SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"
OUT_DIR = ROOT / "data" / "korea" / "financials"
OUT_JSON = ROOT / "data" / "korea" / "financials_index.json"
OUT_JS = ROOT / "data" / "korea" / "financials_index.js"
SOURCE = "DART 전체재무제표(fnlttSinglAcntAll)"

REPORT_Q = {"11013": 1, "11012": 2, "11014": 3}
# 제출 기한(월, 일) + 여유 3일. 12월 결산 기준(비 12월 결산은 013 으로 돌아와 나중에 다시 확인).
DEADLINES = {"11013": (5, 18), "11012": (8, 17), "11014": (11, 17), "11011": (4, 3)}
RECHECK_DAYS = 21               # 기한 지났는데 013 이던 보고서를 다시 볼 간격(최신 2개만)

IS_SJ = ("IS", "CIS")
# 계정 매핑: account_id 우선, 없으면 계정명. (id 목록, 이름 목록, 재무제표 구분)
ACCOUNTS = {
    "rev": (["ifrs-full_Revenue"], ["매출액", "수익(매출액)", "영업수익", "매출"], IS_SJ),
    "op": (["dart_OperatingIncomeLoss"], ["영업이익", "영업이익(손실)"], IS_SJ),
    "net": (["ifrs-full_ProfitLossAttributableToOwnersOfParent", "ifrs-full_ProfitLoss"],
            ["지배기업 소유주지분", "지배기업의 소유주에게 귀속되는 당기순이익", "당기순이익", "당기순이익(손실)"], IS_SJ),
    "pretax": (["ifrs-full_ProfitLossBeforeTax"], ["법인세비용차감전순이익", "법인세비용차감전순이익(손실)"], IS_SJ),
    "tax": (["ifrs-full_IncomeTaxExpenseContinuingOperations"], ["법인세비용", "법인세비용(수익)"], IS_SJ),
    "interest": (["ifrs-full_InterestExpense"], ["이자비용"], IS_SJ),
    "epsDil": (["ifrs-full_DilutedEarningsLossPerShare"], [], IS_SJ),
    "ocf": (["ifrs-full_CashFlowsFromUsedInOperatingActivities"], ["영업활동현금흐름", "영업활동으로 인한 현금흐름"], ("CF",)),
    "capex": (["ifrs-full_PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities",
               "ifrs-full_PurchaseOfPropertyPlantAndEquipment"], ["유형자산의 취득", "유형자산의취득", "유형자산 취득"], ("CF",)),
    "sbc": (["ifrs-full_AdjustmentsForSharebasedPayments"], ["주식보상비용"], ("CF",)),
    "assets": (["ifrs-full_Assets"], ["자산총계"], ("BS",)),
    "liab": (["ifrs-full_Liabilities"], ["부채총계"], ("BS",)),
    "equity": (["ifrs-full_EquityAttributableToOwnersOfParent", "ifrs-full_Equity"],
               ["지배기업 소유주지분", "자본총계"], ("BS",)),
    "cash": (["ifrs-full_CashAndCashEquivalents"], ["현금및현금성자산"], ("BS",)),
    "curAssets": (["ifrs-full_CurrentAssets"], ["유동자산"], ("BS",)),
    "curLiab": (["ifrs-full_CurrentLiabilities"], ["유동부채"], ("BS",)),
    "receivables": (["ifrs-full_CurrentTradeReceivables", "ifrs-full_TradeAndOtherCurrentReceivables"],
                    ["매출채권", "매출채권및기타채권", "매출채권 및 기타채권", "매출채권 및 기타유동채권"], ("BS",)),
}
DA_DEP = (["ifrs-full_AdjustmentsForDepreciationExpense"], ["감가상각비"])
DA_AMORT = (["ifrs-full_AdjustmentsForAmortisationExpense"], ["무형자산상각비"])
DA_BOTH = (["ifrs-full_AdjustmentsForDepreciationAndAmortisationExpense"], ["감가상각비와 무형자산상각비", "감가상각비 및 무형자산상각비"])
# 이자부 차입금(리스부채 제외). '못 찾음' 은 0 이 아니라 결측.
DEBT_IDS = {
    "ifrs-full_ShorttermBorrowings", "ifrs-full_CurrentPortionOfLongtermBorrowings", "ifrs-full_LongtermBorrowings",
    "ifrs-full_NoncurrentPortionOfNoncurrentBondsIssued", "ifrs-full_NoncurrentPortionOfNoncurrentLoansReceived",
    "ifrs-full_CurrentPortionOfNoncurrentBondsIssued", "ifrs-full_BondsIssued",
}
DEBT_NAMES = {
    "단기차입금", "장기차입금", "사채", "유동성장기부채", "유동성사채", "유동성장기차입금", "단기사채",
    "전환사채", "교환사채", "신주인수권부사채", "유동성전환사채",
}
BS_FIELDS = ("assets", "liab", "equity", "cash", "curAssets", "curLiab", "receivables", "debt")
IS_FIELDS = ("rev", "op", "net", "pretax", "tax", "interest", "epsDil")
CF_FIELDS = ("ocf", "capex", "sbc", "da")


def to_num(value):
    s = str(value if value is not None else "").strip().replace(",", "")
    if not s or s == "-":
        return None
    try:
        return int(s)
    except ValueError:
        try:
            return float(s)
        except ValueError:
            return None


# ────────────────────────────── 응답 파싱(순수) ──────────────────────────────
def _find(rows, ids, names, sjs, col):
    for aid in ids:
        for r in rows:
            if r.get("sj_div") in sjs and r.get("account_id") == aid:
                v = to_num(r.get(col))
                if v is not None:
                    return v
    for nm in names:
        for r in rows:
            if r.get("sj_div") in sjs and (r.get("account_nm") or "").strip() == nm:
                v = to_num(r.get(col))
                if v is not None:
                    return v
    return None


def _eps_diluted(rows, col):
    v = _find(rows, ACCOUNTS["epsDil"][0], [], IS_SJ, col)
    if v is not None:
        return v
    for r in rows:   # '기본및희석주당이익' 처럼 희석이 명시된 줄만(기본 EPS 를 희석으로 쓰지 않는다)
        nm = (r.get("account_nm") or "").replace(" ", "")
        if r.get("sj_div") in IS_SJ and "희석" in nm and "주당" in nm:
            v = to_num(r.get(col))
            if v is not None:
                return v
    return None


def _debt(rows, col):
    total, found, seen = 0, False, set()
    for r in rows:
        if r.get("sj_div") != "BS":
            continue
        aid, nm = r.get("account_id") or "", (r.get("account_nm") or "").strip()
        if aid in DEBT_IDS or nm in DEBT_NAMES:
            key = (aid if aid in DEBT_IDS else "", nm)
            if key in seen:
                continue
            seen.add(key)
            v = to_num(r.get(col))
            if v is not None:
                total += abs(v)
                found = True
    return total if found else None


def _da(rows, col):
    both = _find(rows, DA_BOTH[0], DA_BOTH[1], ("CF",), col)
    if both is not None:
        return both
    dep = _find(rows, DA_DEP[0], DA_DEP[1], ("CF",), col)
    if dep is None:
        return None
    amort = _find(rows, DA_AMORT[0], DA_AMORT[1], ("CF",), col)
    return dep + (amort or 0)


def extract_columns(rows: list[dict], fields, col: str) -> dict:
    out = {}
    for f in fields:
        if f == "debt":
            v = _debt(rows, col)
        elif f == "da":
            v = _da(rows, col)
        elif f == "epsDil":
            v = _eps_diluted(rows, col)
        else:
            ids, names, sjs = ACCOUNTS[f]
            v = _find(rows, ids, names, sjs, col)
        if v is not None:
            if f == "capex":
                v = abs(v)
            out[f] = v
    _normalize_tax_sign(out)
    return out


def _normalize_tax_sign(vals: dict) -> None:
    """법인세비용 부호: 비용을 음수로 적는 회사가 있다(KB금융 2025 1분기 −6,075억 등, 세전 − 순이익 ≈ +6,090억).

    같은 보고서의 세전이익·순이익으로 '세전 − 법인세 ≈ 순이익' 이 되는 부호를 고른다. 공시 숫자의 표기
    관례만 맞추는 것이고 크기는 그대로다(설비투자 절댓값 통일과 같은 종류). 세전·순이익이 없으면 손대지 않는다.
    """
    tax, pre, net = vals.get("tax"), vals.get("pretax"), vals.get("net")
    if tax is None or pre is None or net is None or tax == 0:
        return
    keep = abs((pre - tax) - net)
    flip = abs((pre + tax) - net)
    if flip < keep:
        vals["tax"] = -tax


def parse_report(rows: list[dict], year: int, code: str) -> list[tuple]:
    """보고서 하나 → [(구역, 키, 우선순위, 값 dict)]. 구역: A(연간 fy) / Q3m / Qytd / Qbs.

    우선순위: 그 보고서의 당기 값 = 2, 비교(전기) = 1, 전전기 = 0. 높은 쪽이 덮고 낮은 쪽은 빈칸만 채운다
    (나중 보고서가 과거 값을 재작성한 경우에도 그 기간 '자기' 보고서 값을 기준으로 둔다).
    """
    out = []
    if code == "11011":
        for col, fy, pr in (("thstrm_amount", year, 2), ("frmtrm_amount", year - 1, 1),
                            ("bfefrmtrm_amount", year - 2, 0)):
            vals = extract_columns(rows, IS_FIELDS + CF_FIELDS + BS_FIELDS, col)
            if vals:
                out.append(("A", str(fy), pr, vals))
        return out
    q = REPORT_Q[code]
    cur, prev = f"{year}Q{q}", f"{year - 1}Q{q}"
    is3 = extract_columns(rows, IS_FIELDS, "thstrm_amount")
    if is3:
        out.append(("Q3m", cur, 2, is3))
    ytd_col = "thstrm_add_amount" if q > 1 else "thstrm_amount"
    ytd = extract_columns(rows, IS_FIELDS, ytd_col)
    if q == 1 and not ytd:
        ytd = dict(is3)
    ytd.update(extract_columns(rows, CF_FIELDS, "thstrm_amount"))
    if ytd:
        out.append(("Qytd", cur, 2, ytd))
    bs = extract_columns(rows, BS_FIELDS, "thstrm_amount")
    if bs:
        out.append(("Qbs", cur, 2, bs))
    p3 = extract_columns(rows, IS_FIELDS, "frmtrm_q_amount")
    if p3:
        out.append(("Q3m", prev, 1, p3))
    pytd = extract_columns(rows, IS_FIELDS, "frmtrm_add_amount" if q > 1 else "frmtrm_q_amount")
    pytd.update(extract_columns(rows, CF_FIELDS, "frmtrm_q_amount"))
    if pytd:
        out.append(("Qytd", prev, 1, pytd))
    return out


def merge_raw(raw: dict, parts: list[tuple]) -> None:
    """parse_report 결과를 `_raw` 에 합친다(구역별 우선순위 규칙)."""
    for zone, key, pr, vals in parts:
        bucket = raw.setdefault(zone, {})
        cur = bucket.get(key)
        if cur is None or pr > cur.get("p", -1):
            new = {"p": pr, **vals}
            if cur:   # 높은 우선순위가 덮되, 그쪽에 없는 필드는 기존 값 유지
                for k, v in cur.items():
                    if k not in new:
                        new[k] = v
            bucket[key] = new
        else:
            for k, v in vals.items():
                if pr == cur.get("p") or k not in cur:
                    cur[k] = v


def rows_from_raw(raw: dict) -> tuple[list[dict], list[dict]]:
    """`_raw` → (annual 행, quarterly 행). 분기 흐름 값은 3개월 직접값 우선, 없으면 누계 차이, 4분기는 연간 − 3분기 누계."""
    A = raw.get("A") or {}
    Q3 = raw.get("Q3m") or {}
    QY = raw.get("Qytd") or {}
    QB = raw.get("Qbs") or {}
    shares = raw.get("shares") or {}

    annual = []
    for fy in sorted(A, key=int):
        row = {"fy": int(fy)}
        for f in IS_FIELDS + CF_FIELDS + BS_FIELDS:
            if f in A[fy]:
                row[f] = A[fy][f]
        if fy in shares:
            row["sharesOut"] = shares[fy]
        if has_core(row):
            annual.append(add_derived(row))
    annual = annual[-MAX_ANNUAL:]

    years = sorted({int(k[:4]) for k in list(Q3) + list(QY) + list(QB)} | {int(y) for y in A})
    quarterly = []
    for y in years:
        for q in (1, 2, 3, 4):
            key = f"{y}Q{q}"
            row = {"fy": y, "fq": q}
            derived = []
            ytd = QY.get(key) or {}
            ytd_prev = (QY.get(f"{y}Q{q - 1}") or {}) if q > 1 else {}
            ann = A.get(str(y)) or {}
            ytd3 = QY.get(f"{y}Q3") or {}
            for f in IS_FIELDS + CF_FIELDS:
                if q <= 3:
                    direct = (Q3.get(key) or {}).get(f) if f in IS_FIELDS else None
                    if direct is not None:
                        row[f] = direct
                    elif q == 1 and f in ytd:
                        row[f] = ytd[f]
                    elif f in ytd and f in ytd_prev:
                        row[f] = ytd[f] - ytd_prev[f]
                        derived.append(f)
                else:
                    if f in ann and f in ytd3:
                        row[f] = ann[f] - ytd3[f]
                        derived.append(f)
            bs = (QB.get(key) or {}) if q <= 3 else {f: ann[f] for f in BS_FIELDS if f in ann}
            for f in BS_FIELDS:
                if f in bs:
                    row[f] = bs[f]
            if q == 4 and str(y) in shares:
                row["sharesOut"] = shares[str(y)]
            if isinstance(row.get("epsDil"), float):
                row["epsDil"] = round(row["epsDil"], 4)
            if derived:
                row["d"] = sorted(derived)
            if has_core(row) and any(f in row for f in IS_FIELDS + CF_FIELDS):
                quarterly.append(add_derived(row))
    return annual, quarterly[-MAX_QUARTERS:]


def build_doc(ticker: str, corp: str, name: str, raw: dict, *, sector: str | None, industry: str | None,
              updated: str) -> dict | None:
    annual, quarterly = rows_from_raw(raw)
    annual_out = [clean_row(r) for r in annual]
    quarter_out = [clean_row(r) for r in quarterly]
    if not annual_out and not quarter_out:
        return None
    industry_type = "general"
    if sector == "금융":
        industry_type = {"은행": "bank", "보험": "insurance"}.get(str(industry or ""), "financial")
    elif annual_out and "rev" not in annual_out[-1] and "op" not in annual_out[-1]:
        industry_type = "financial"      # 매출·영업이익 계정이 없는 이자·보험 구조
    flags = ["financial"] if industry_type != "general" else []
    if not quarter_out:
        flags.append("noQuarterly")
    tags = {}
    for f in FLOW_FIELDS + INSTANT_FIELDS:
        if f in ACCOUNTS:
            tags[f] = ACCOUNTS[f][0][0] if ACCOUNTS[f][0] else ACCOUNTS[f][1][0]
    tags["debt"] = "차입금·사채 계정 합(리스부채 제외)"
    tags["sharesOut"] = "stockTotqySttus 보통주 유통주식수"
    rcepts = [v.get("rcept") for v in (raw.get("reports") or {}).values() if v.get("rcept")]
    last = max(rcepts) if rcepts else ""
    return {
        "schema": SCHEMA_VERSION,
        "market": "kr",
        "ticker": ticker,
        "name": name or ticker,
        "id": {"corpCode": corp},
        "source": SOURCE,
        "basis": raw.get("fs") or "CFS",
        "currency": "KRW",
        "annualForm": "사업보고서",
        "industryType": industry_type,
        "flags": flags,
        "updatedAtKst": updated,
        "lastFiled": f"{last[:4]}-{last[4:6]}-{last[6:8]}" if len(last) >= 8 else None,
        "tags": tags,
        "annual": annual_out,
        "quarterly": quarter_out,
        "ttm": build_ttm(quarter_out, annual_out),
        "_raw": raw,
    }


# ────────────────────────────── 보고서 일정 ──────────────────────────────
def available_reports(today: date) -> list[tuple[int, str]]:
    """제출 기한이 지난 정기보고서(최신 순)."""
    out = []
    for y in range(today.year, today.year - 12, -1):
        for code in ("11014", "11012", "11013"):
            m, d = DEADLINES[code]
            if today >= date(y, m, d):
                out.append((y, code))
        m, d = DEADLINES["11011"]
        if today >= date(y + 1, m, d):
            out.append((y, "11011"))
    order = {"11011": 4, "11014": 3, "11012": 2, "11013": 1}
    out.sort(key=lambda x: (x[0], order[x[1]]), reverse=True)
    return out


def tiers(today: date) -> list[list[tuple[str, int, str]]]:
    """우선순위 계층별 할 일 [(종류, 연도, 보고서코드)]. 종류: F(재무제표) / S(주식수)."""
    reps = available_reports(today)
    recent8 = reps[:8]
    latest_a = next(y for y, c in reps if c == "11011")
    t1 = [("F", latest_a, "11011")]
    if recent8 and recent8[0] != (latest_a, "11011"):
        t1.append(("F",) + recent8[0])
    t2 = [("F",) + r for r in recent8 if ("F",) + r not in t1]
    t3 = [("F", latest_a - 3, "11011")]
    t4 = [("S", latest_a - i, "11011") for i in range(5)]
    t5 = [("F", latest_a - 6, "11011")]
    return [t1, t2, t3, t4, t5]


def report_key(kind: str, year: int, code: str) -> str:
    return f"{'S' if kind == 'S' else ''}{year}_{code}"


def needs(raw: dict, kind: str, year: int, code: str, today: date, recent_keys: set[str]) -> bool:
    rec = (raw.get("reports") or {}).get(report_key(kind, year, code))
    if not rec:
        return True
    if rec.get("none"):
        # 기한 지났는데 없던 보고서: 최신 두 개만 RECHECK_DAYS 마다 다시 본다
        if report_key(kind, year, code) not in recent_keys:
            return False
        try:
            return (today - date.fromisoformat(rec["none"])).days >= RECHECK_DAYS
        except (TypeError, ValueError):
            return True
    return False


# ────────────────────────────── 네트워크 ──────────────────────────────
class Budget(Exception):
    pass


def main_run(args, api_key: str) -> int:
    from build_kr_disclosures import dart_get, load_corp_map

    today = date.today()
    stamp = sec.kst_now_str()
    snap = load_json(KR_SNAPSHOT, {"stocks": []}) or {"stocks": []}
    stocks = [s for s in (snap.get("stocks") or [])
              if s.get("ticker") and s.get("sector") not in ("ETF", "etf", "EXCHANGE TRADED FUNDS")]
    stocks.sort(key=lambda s: s.get("marketCapB") if isinstance(s.get("marketCapB"), (int, float)) else 0, reverse=True)
    corp_map = load_corp_map(api_key)
    if not corp_map:
        print("[KR재무] corpCode.xml 수집 실패 — 중단")
        return 1
    targets = []
    for s in stocks:
        t = str(s["ticker"]).replace(".KS", "").replace(".KQ", "").zfill(6)
        corp = corp_map.get(t)
        if corp:
            targets.append((t, corp, s))
    if args.only:
        wanted = {x.strip().zfill(6) for x in args.only.split(",") if x.strip()}
        targets = [x for x in targets if x[0] in wanted]
    elif args.top:
        targets = targets[:args.top]
    print(f"[KR재무] 대상 {len(targets)}종목 · 호출 예산 {args.max_calls}")

    docs_raw: dict[str, dict] = {}
    for t, corp, s in targets:
        prev = load_json(OUT_DIR / f"{t}.json", None) or {}
        docs_raw[t] = prev.get("_raw") or {}

    calls = {"n": 0}
    errors: dict[str, int] = {}
    stopped = None
    touched: set[str] = set()
    recent_keys = {report_key("F", y, c) for y, c in available_reports(today)[:2]}

    def call(path, params):
        if calls["n"] >= args.max_calls:
            raise Budget("예산 소진")
        calls["n"] += 1
        return dart_get(path, params, api_key)

    def fetch_fs(raw, corp, year, code):
        order = [raw["fs"]] if raw.get("fs") else ["CFS", "OFS"]
        for fs in order:
            data = call("fnlttSinglAcntAll.json", {"corp_code": corp, "bsns_year": str(year),
                                                   "reprt_code": code, "fs_div": fs})
            st = str(data.get("status") or "")
            if st == "000" and data.get("list"):
                return fs, data["list"]
            if st not in ("013",):
                errors[f"{st}:{data.get('message') or ''}"] = errors.get(f"{st}:{data.get('message') or ''}", 0) + 1
                return None, None
        return "", []

    try:
        for tier in tiers(today):
            for t, corp, s in targets:
                raw = docs_raw[t]
                for kind, year, code in tier:
                    if not needs(raw, kind, year, code, today, recent_keys):
                        continue
                    key = report_key(kind, year, code)
                    reports = raw.setdefault("reports", {})
                    if kind == "S":
                        data = call("stockTotqySttus.json", {"corp_code": corp, "bsns_year": str(year),
                                                             "reprt_code": code})
                        st = str(data.get("status") or "")
                        if st == "000":
                            common = [r for r in data.get("list") or [] if (r.get("se") or "").strip() == "보통주"]
                            row = common[0] if common else None
                            v = to_num(row.get("distb_stock_co")) if row else None
                            if v:
                                raw.setdefault("shares", {})[str(year)] = int(v)
                            reports[key] = {"at": today.isoformat()}
                        elif st == "013":
                            reports[key] = {"none": today.isoformat()}
                        else:
                            errors[f"{st}:{data.get('message') or ''}"] = errors.get(f"{st}:{data.get('message') or ''}", 0) + 1
                            continue
                        touched.add(t)
                        continue
                    fs, rows = fetch_fs(raw, corp, year, code)
                    if fs is None:
                        continue
                    if not rows:
                        reports[key] = {"none": today.isoformat()}
                        touched.add(t)
                        continue
                    raw["fs"] = raw.get("fs") or fs
                    merge_raw(raw, parse_report(rows, year, code))
                    reports[key] = {"rcept": str(rows[0].get("rcept_no") or ""), "at": today.isoformat()}
                    touched.add(t)
            print(f"  계층 완료 · 누적 호출 {calls['n']}")
    except Budget:
        stopped = f"호출 예산 {args.max_calls}회 소진 — 나머지는 다음 실행에 이어 받는다"
    except SystemExit as exc:          # dart_get: status 020(한도 초과)
        stopped = str(exc)
    except Exception as exc:           # 네트워크 장애 — 받은 데까지는 저장한다
        stopped = f"요청 중단: {type(exc).__name__}: {exc}"
    if stopped:
        print(f"[KR재무] {stopped}")
    if errors:
        print(f"[KR재무] 오류 {sum(errors.values())}건: {dict(list(errors.items())[:5])}")

    prev_index = load_json(OUT_JSON, {}) or {}
    index_tickers: dict = dict(prev_index.get("tickers") or {})
    written = 0
    for t, corp, s in targets:
        if t not in touched:
            continue
        doc = build_doc(t, corp, s.get("company") or s.get("name") or t, docs_raw[t],
                        sector=s.get("sector"), industry=s.get("industry"), updated=stamp)
        path = OUT_DIR / f"{t}.json"
        if not doc:
            # 원천 상태만 남겨 다음 실행이 같은 보고서를 다시 받지 않게 한다(화면용 인덱스에는 안 올린다)
            atomic_write_text(path, dumps_compact({"schema": SCHEMA_VERSION, "market": "kr", "ticker": t,
                                                   "annual": [], "quarterly": [], "_raw": docs_raw[t]}) + "\n")
            index_tickers.pop(t, None)
            continue
        atomic_write_text(path, dumps_compact(doc) + "\n")
        index_tickers[t] = index_entry(doc)
        written += 1
    index_tickers = {t: v for t, v in index_tickers.items() if (OUT_DIR / f"{t}.json").exists()}
    print(f"[KR재무] 호출 {calls['n']}회 · 종목 파일 갱신 {written} · 인덱스 {len(index_tickers)}종목")
    if not index_tickers:
        print("[KR재무] 인덱스 0종목 — 기존 파일 유지, 실패로 끝낸다")
        return 1
    payload = {
        "schema": SCHEMA_VERSION, "market": "kr", "updatedAtKst": stamp, "source": SOURCE,
        "count": len(index_tickers), "freshCount": written, "calls": calls["n"],
        "fields": "rev,op,net,pretax,tax,interest,da,sbc,ocf,capex,fcf,epsDil,"
                  "assets,liab,equity,cash,debt,netDebt,curAssets,curLiab,receivables,sharesOut",
        "tickers": dict(sorted(index_tickers.items())),
    }
    with repository_publish_lock(ROOT):
        sec.write_data(OUT_JSON, OUT_JS, "FINANCIALS_INDEX", payload, indent=None, min_ratio=0.8)
        print(f"Wrote {OUT_JSON.name} — {len(index_tickers)}종목")
        if args.push:
            paths = ["data/korea/financials", "data/korea/financials_index.json", "data/korea/financials_index.js"]
            if not sec.git_publish(paths, "KR financials (DART)"):
                print("[중단] KR 재무 push 실패 — 발행되지 않았다")
                return 1
    # 예산 소진은 정상(계획된 분할 수집). 한도 초과·네트워크 장애는 실패로 알린다.
    if stopped and not stopped.startswith("호출 예산"):
        return 1
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="KR 재무 확장(DART 전체재무제표, 연간·분기·TTM)")
    ap.add_argument("--push", action="store_true")
    ap.add_argument("--top", type=int, default=1000, help="시총 상위 N 종목(ETF 제외)")
    ap.add_argument("--max-calls", type=int, default=4000, help="이번 실행의 DART 호출 상한")
    ap.add_argument("--only", default="", help="쉼표로 구분한 종목코드만(로컬 확인용)")
    args = ap.parse_args()
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    api_key = os.environ.get("DART_API_KEY", "").strip()
    if not api_key:
        print("[KR재무] DART_API_KEY 미설정 — 기존 파일 유지, 아무것도 쓰지 않는다")
        return 0
    print(f"=== KR 재무 확장 (DART, 상위 {args.top}) — {datetime.now():%Y-%m-%d %H:%M} ===")
    return main_run(args, api_key)


if __name__ == "__main__":
    raise SystemExit(main())
