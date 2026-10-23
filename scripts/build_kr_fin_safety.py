#!/usr/bin/env python3
"""국내 재무 안전 묶음 — DART 정기보고서 주요정보(DS002) 정형 API 7종.

화면: 종목 분석 › 재무 탭 '재무 위험 점검' 카드 아래 줄(risk-check.js → fin-safety-core.js).

  ① 미상환 잔액(최신 정기보고서 — 분기·반기·사업)
     cprndNrdmpBlce.json            회사채       yy1_below · yy1_excess_yy2_below · yy2_excess_yy3_below ·
                                                 yy3_excess_yy4_below · yy4_excess_yy5_below · yy5_excess_yy10_below · yy10_excess
     entrprsBilScritsNrdmpBlce.json 기업어음(CP) de10_below · de10_excess_de30_below · de30_excess_de90_below ·
                                                 de90_excess_de180_below · de180_excess_yy1_below · yy1_excess_yy2_below ·
                                                 yy2_excess_yy3_below · yy3_excess
     srtpdPsndbtNrdmpBlce.json      단기사채     de10_below … de180_excess_yy1_below · isu_lmt(발행 한도) · remndr_lmt(잔여 한도)
     행은 remndr_exprtn2 = 공모·사모·합계. '합계' 행을 쓰고(없으면 공모+사모), 칸 합이 sm 과 맞지 않으면
     그 증권은 싣지 않는다(자기검증). 금액은 원 단위로 온다(SK하이닉스·현대차·한전 2026 반기 실측 — 원문 표의
     '백만원' 을 DART 가 원으로 바꿔 준다). 만기 사다리는 1년 이하 · 1~2년 · 2~3년 · 3년 초과 4칸으로 묶는다.
  ② 자금 사용내역(같은 보고서)
     pssrpCptalUseDtls.json  공모 — rs_cptal_use_plan_useprps/_prcure_amount(계획) · real_cptal_use_dtls_cn/_amount(실제)
     prvsrpCptalUseDtls.json 사모 — mtrpt_cptal_use_plan_useprps/_prcure_amount(계획) · real_cptal_use_dtls_*(실제)
     병합 셀은 '-' 로 풀려 오므로 납입일·종류가 '-' 인 행은 바로 윗행 것을 잇는다. 같은 (구분, 종류, 회차, 납입일)을
     한 건으로 묶어 계획 합계 vs 실제 합계. 최근 5년 납입분만, 최근 순 최대 6건.
  ③ 감사(최신 사업보고서)
     adtServcCnclsSttus.json                 감사인 adtor · 보수 adt_cntrct_dtls_mendng/real_exc_dtls_mendng · 시간 *_time
     accnutAdtorNonAdtServcCnclsSttus.json   비감사용역 servc_cn · servc_mendng
     두 표 모두 **금액 단위가 응답에 없다**(원문 표머리 '백만원'·'천원'이 회사마다 다르다). 감사보수는 시간당 보수가
     3만~100만 원 안에 드는 단위가 하나뿐일 때만 원으로 바꾸고, 아니면 금액을 싣지 않는다(감사인·시간만).
     비감사/감사 비율은 같은 단위라는 가정으로 계산하되 100% 를 넘으면 단위가 다른 것으로 보고 싣지 않는다
     (한국전력 2025: 감사 2,763(백만원) · 비감사 261,852(천원) — 같은 단위로 보면 147배).

대상·호출 예산(DART 하루 2만 회를 다른 빌더와 나눠 쓴다)
  시총 상위 --top(기본 600) 보통주. 우선주는 보통주 레코드를 가리킨다({"alias": 보통주}).
  회사마다 최신 정기보고서(접수 기한이 지난 가장 최근 분기)를 한 번만 받는다 — state 의 rp 가 같으면 건너뛴다.
  회사채 표로 먼저 보고서 유무를 보고(013 이면 1회로 끝), 있으면 나머지 4종. 감사는 사업연도가 바뀔 때만 2회.
  첫 채움 ≈ 600 × 7 = 4,200회, 이후 분기마다 ≈ 3,000회. 실행당 --max-calls(기본 3,000).

산출물: data/korea/fin_safety.json/.js (window.KR_FIN_SAFETY, 금액은 백만원) · data/korea/fin_safety_state.json(빌더 전용)
실행: python scripts/build_kr_fin_safety.py [--top 600] [--max-calls 3000] [--tickers 005930,000660] [--push]
      --tickers 는 검증용 — 파일을 쓰지 않고 결과만 출력한다. Requires DART_API_KEY.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402
from sec_client import DART_REGRESSION_FLOOR, latest_fiscal_year, write_data  # noqa: E402
from step_budget import StepBudget  # noqa: E402

KST = ZoneInfo("Asia/Seoul")
OUT_JSON = ROOT / "data" / "korea" / "fin_safety.json"
OUT_JS = ROOT / "data" / "korea" / "fin_safety.js"
STATE_JSON = ROOT / "data" / "korea" / "fin_safety_state.json"
KR_SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"
ETF_SECTORS = {"EXCHANGE TRADED FUNDS", "ETF", "etf"}

PARSER_VERSION = 1
FUND_YEARS = 5
FUND_MAX = 6
TEXT_MAX = 40
# 감사 시간당 보수(원) 허용 범위 — 단위 추정용. 실측 2025: 7.8만(한전)~12만(알테오젠) 원/시간.
AUDIT_RATE_RANGE = (30_000, 1_000_000)
AUDIT_UNITS = (1, 1_000, 1_000_000)
LADDER_LABELS = ("1년 이하", "1~2년", "2~3년", "3년 초과")
REPORT_NAMES = {"11013": "1분기", "11012": "반기", "11014": "3분기", "11011": "사업"}

# 증권별 칸 → 사다리 4칸(0: ≤1y, 1: 1~2y, 2: 2~3y, 3: >3y)
DEBT_KINDS = {
    "bond": ("cprndNrdmpBlce.json", {
        "yy1_below": 0, "yy1_excess_yy2_below": 1, "yy2_excess_yy3_below": 2, "yy3_excess_yy4_below": 3,
        "yy4_excess_yy5_below": 3, "yy5_excess_yy10_below": 3, "yy10_excess": 3}),
    "cp": ("entrprsBilScritsNrdmpBlce.json", {
        "de10_below": 0, "de10_excess_de30_below": 0, "de30_excess_de90_below": 0, "de90_excess_de180_below": 0,
        "de180_excess_yy1_below": 0, "yy1_excess_yy2_below": 1, "yy2_excess_yy3_below": 2, "yy3_excess": 3}),
    "stb": ("srtpdPsndbtNrdmpBlce.json", {
        "de10_below": 0, "de10_excess_de30_below": 0, "de30_excess_de90_below": 0, "de90_excess_de180_below": 0,
        "de180_excess_yy1_below": 0}),
}
FUND_KINDS = {
    "pub": ("pssrpCptalUseDtls.json", "rs_cptal_use_plan_useprps", "rs_cptal_use_plan_prcure_amount"),
    "prv": ("prvsrpCptalUseDtls.json", "mtrpt_cptal_use_plan_useprps", "mtrpt_cptal_use_plan_prcure_amount"),
}
AUDIT_PATH = "adtServcCnclsSttus.json"
NONAUDIT_PATH = "accnutAdtorNonAdtServcCnclsSttus.json"


def now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def load_json(path: Path, default):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception:
        return default


def clean(v) -> str:
    return " ".join(str(v or "").split())


def is_blank(v) -> bool:
    return clean(v) in ("", "-", "－")


def amount(v) -> int | None:
    """'1,300,000,000,000' → 정수. '-'·빈칸 None. '2,540 (연간 총 보수)'·'165/년' 처럼 뒤에 글이 붙으면 앞 숫자."""
    s = clean(v)
    if is_blank(s):
        return None
    m = re.match(r"^(-?[\d,]+(?:\.\d+)?)", s)
    if not m:
        return None
    try:
        return int(round(float(m.group(1).replace(",", ""))))
    except ValueError:
        return None


def short(v, n: int = TEXT_MAX) -> str:
    s = clean(v)
    if is_blank(s):
        return ""
    return s if len(s) <= n else s[: n - 1] + "…"


# ---------------------------------------------------------------------------- 보고서 고르기

def report_candidates(today: date) -> list[tuple[int, str]]:
    """제출 기한이 지난 정기보고서 (사업연도, 보고서 코드) — 최신 순 3개.

    12월 결산 기준 기한: 1분기 5/15 · 반기 8/14 · 3분기 11/14 · 사업 3/31(+1년). 기한 다음 날부터 본다.
    결산월이 다른 회사는 최신 후보가 013 이면 다음 후보로 내려간다.
    """
    y = today.year
    seq = [
        (date(y, 3, 31), (y - 1, "11011")),
        (date(y, 5, 15), (y, "11013")),
        (date(y, 8, 14), (y, "11012")),
        (date(y, 11, 14), (y, "11014")),
    ]
    out = [rp for due, rp in seq if today > due]
    prev = [(y - 1, "11011"), (y - 1, "11014"), (y - 1, "11012"), (y - 1, "11013")]
    if today <= date(y, 3, 31):
        prev = [(y - 1, "11014"), (y - 1, "11012"), (y - 1, "11013"), (y - 2, "11011")]
    out = list(reversed(out)) + [p for p in prev if p not in out]
    return out[:3]


def rp_key(rp: tuple[int, str]) -> str:
    return f"{rp[0]}-{rp[1]}"


def rp_label(rp: tuple[int, str]) -> str:
    return f"{rp[0]} {REPORT_NAMES.get(rp[1], rp[1])}"


# ---------------------------------------------------------------------------- 파싱(순수 함수)

def parse_debt(rows: list[dict], buckets: dict[str, int]) -> dict | None:
    """미상환 잔액 표 → {"l": [≤1y, 1~2y, 2~3y, >3y], "sm": 합계} | {"sm": 0} | None(검증 실패·행 없음).

    합계 행이 없으면 공모+사모. 칸 합과 sm 이 max(100만 원, 0.5%) 넘게 어긋나면 None(오기재 의심 — 싣지 않음).
    """
    rows = [r for r in rows or [] if isinstance(r, dict)]
    if not rows:
        return None
    total = [r for r in rows if clean(r.get("remndr_exprtn2")).replace(" ", "") == "합계"]
    use = total[:1] or [r for r in rows if clean(r.get("remndr_exprtn2")).replace(" ", "") in ("공모", "사모")]
    if not use:
        return None
    ladder = [0, 0, 0, 0]
    sm = 0
    sm_given = False
    for r in use:
        for k, i in buckets.items():
            ladder[i] += amount(r.get(k)) or 0
        v = amount(r.get("sm"))
        if v is not None:
            sm += v
            sm_given = True
    parts = sum(ladder)
    if not sm_given:
        sm = parts
    if abs(parts - sm) > max(1_000_000, 0.005 * max(sm, parts)):
        return None
    if sm <= 0:
        return {"sm": 0}
    out = {"l": ladder, "sm": sm}
    lim = amount(use[0].get("isu_lmt"))
    rem = amount(use[0].get("remndr_lmt"))
    if lim:
        out["lim"] = [lim, rem]
    return out


def parse_funds(rows_by_kind: dict[str, list[dict]], today: date) -> tuple[list[list], int]:
    """공모·사모 자금 사용내역 → 건별 [구분, 종류, 회차, 납입일, 계획 용도, 계획액, 실제액, 차이 사유] (최근 순).

    돌려주는 두 번째 값은 잘린 건수(최근 5년 밖 제외는 세지 않는다).
    """
    issues: dict[tuple, dict] = {}
    floor = date(today.year - FUND_YEARS, today.month, min(today.day, 28)).isoformat()
    for kind, rows in rows_by_kind.items():
        plan_use_key, plan_amt_key = FUND_KINDS[kind][1], FUND_KINDS[kind][2]
        prev = None
        for r in rows or []:
            if not isinstance(r, dict):
                continue
            se, tm, pay = clean(r.get("se_nm")), clean(r.get("tm")), clean(r.get("pay_de"))
            if is_blank(pay) and is_blank(se) and prev:
                se, tm, pay = prev
            m = re.match(r"(\d{4})[.\-/]?\s*(\d{1,2})[.\-/]?\s*(\d{1,2})", pay)
            if not m:
                continue
            iso = f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
            prev = (se, tm, pay)
            key = (kind, se, "" if is_blank(tm) else tm, iso)
            it = issues.setdefault(key, {"plan": 0, "real": 0, "hasPlan": False, "hasReal": False,
                                          "uses": [], "why": ""})
            pa, ra = amount(r.get(plan_amt_key)), amount(r.get("real_cptal_use_dtls_amount"))
            if pa is not None:
                it["plan"] += pa
                it["hasPlan"] = True
            if ra is not None:
                it["real"] += ra
                it["hasReal"] = True
            use = short(r.get(plan_use_key), 20) or short(r.get("real_cptal_use_dtls_cn"), 20)
            if use and use not in it["uses"]:
                it["uses"].append(use)
            why = short(r.get("dffrnc_occrrnc_resn"), 60)
            if why and not it["why"]:
                it["why"] = why
    out = []
    for (kind, se, tm, iso), it in issues.items():
        if iso < floor or not (it["hasPlan"] or it["hasReal"]):
            continue
        out.append([
            "공모" if kind == "pub" else "사모", short(se, 24), short(tm, 16), iso, "·".join(it["uses"][:3]),
            it["plan"] if it["hasPlan"] else None, it["real"] if it["hasReal"] else None, it["why"],
        ])
    out.sort(key=lambda x: (x[3], x[0]), reverse=True)
    return out[:FUND_MAX], max(0, len(out) - FUND_MAX)


def _term_no(label) -> int | None:
    m = re.search(r"제\s*(\d+)\s*기", clean(label))
    return int(m.group(1)) if m else None


def audit_unit(fee: int | None, hours: int | None) -> int | None:
    """감사보수 표의 금액 단위(1·1,000·1,000,000) — 시간당 보수가 허용 범위에 드는 단위가 하나뿐일 때만."""
    if not fee or not hours or hours <= 0:
        return None
    lo, hi = AUDIT_RATE_RANGE
    ok = [u for u in AUDIT_UNITS if lo <= fee * u / hours <= hi]
    return ok[0] if len(ok) == 1 else None


def parse_audit(adt_rows: list[dict], non_rows: list[dict]) -> dict | None:
    """감사용역 + 비감사용역 → 최근 사업연도부터 [{"t": 기, "by": 감사인, "fee": 원|None, "h": 시간, "na": 건수,
    "nr": 비감사/감사 비율(0~1)|None}] (최대 3년). 감사인이 비어 있으면 None."""
    years = []
    for r in adt_rows or []:
        if not isinstance(r, dict):
            continue
        by = clean(r.get("adtor"))
        if is_blank(by):
            continue
        fee = amount(r.get("real_exc_dtls_mendng"))
        hours = amount(r.get("real_exc_dtls_time"))
        if fee is None or hours is None:
            fee = amount(r.get("adt_cntrct_dtls_mendng")) if fee is None else fee
            hours = amount(r.get("adt_cntrct_dtls_time")) if hours is None else hours
        years.append({"term": _term_no(r.get("bsns_year")), "label": clean(r.get("bsns_year")), "by": by,
                      "raw": fee, "h": hours})
    if not years:
        return None
    # 비감사용역: 같은 기(期) 번호끼리. 기 번호가 없으면 등장 순서(당기·전기·전전기)로 맞춘다.
    non_by_term: dict = {}
    order: list = []
    for r in non_rows or []:
        if not isinstance(r, dict):
            continue
        lab = clean(r.get("bsns_year"))
        key = _term_no(lab)
        key = key if key is not None else lab
        if key not in order:
            order.append(key)
        g = non_by_term.setdefault(key, {"n": 0, "sum": 0, "amtRows": 0})
        if is_blank(r.get("servc_cn")):
            continue
        g["n"] += 1
        a = amount(r.get("servc_mendng"))
        if a is not None:
            g["sum"] += a
            g["amtRows"] += 1
    out = []
    for i, y in enumerate(years[:3]):
        rec = {"by": short(y["by"], 20)}
        if y["term"] is not None:
            rec["t"] = y["term"]
        unit = audit_unit(y["raw"], y["h"])
        if unit is not None:
            rec["fee"] = y["raw"] * unit
        if y["h"]:
            rec["h"] = y["h"]
        key = y["term"] if y["term"] is not None and y["term"] in non_by_term else (order[i] if i < len(order) else None)
        g = non_by_term.get(key) if key is not None else None
        if g is not None:
            rec["na"] = g["n"]
            if g["n"] == 0:
                rec["nr"] = 0.0
            elif y["raw"] and g["amtRows"] == g["n"]:
                ratio = g["sum"] / y["raw"]
                if ratio <= 1.0:          # 100% 초과 = 단위가 다른 표로 본다(싣지 않음)
                    rec["nr"] = round(ratio, 4)
        out.append(rec)
    return {"years": out}


def to_m(v):
    """원 → 백만원(정수). 발행 파일 크기를 줄인다(화면은 억·조로 보여 준다)."""
    return None if v is None else int(round(v / 1_000_000))


def summarize_company(raw: dict, today: date) -> dict | None:
    """state 에 캐시한 요약(원 단위) → 발행 레코드(백만원 단위). 보여 줄 것이 없으면 None."""
    rec: dict = {}
    d = raw.get("debt")
    if d:
        kinds = {k: v for k, v in (d.get("kinds") or {}).items() if v is not None}
        if kinds:
            debt = {"asOf": d.get("asOf"), "p": d.get("p"), "rc": d.get("rc")}
            live = {}
            for k, v in kinds.items():
                if not v.get("sm"):
                    continue
                item = {"l": [to_m(x) for x in v["l"]], "sm": to_m(v["sm"])}
                if v.get("lim"):
                    item["lim"] = [to_m(x) for x in v["lim"]]
                live[k] = item
            if live:
                debt["k"] = live
            else:
                debt["zero"] = True
            rec["debt"] = {k: v for k, v in debt.items() if v not in (None, "")}
    f = raw.get("funds")
    if f and f.get("rows"):
        rows = [r[:5] + [to_m(r[5]), to_m(r[6])] + ([r[7]] if r[7] else []) for r in f["rows"]]
        funds = {"p": f.get("p"), "rows": rows}
        if f.get("rc") and f.get("rc") != (d or {}).get("rc"):
            funds["rc"] = f["rc"]
        if f.get("more"):
            funds["more"] = f["more"]
        rec["funds"] = funds
    a = raw.get("audit")
    if a and a.get("years"):
        years = []
        for y in a["years"]:
            y = dict(y)
            if y.get("fee") is not None:
                y["fee"] = to_m(y["fee"])
            years.append(y)
        rec["audit"] = {k: v for k, v in {"y": a.get("y"), "rc": a.get("rc"), "years": years}.items() if v not in (None, "")}
    return rec or None


# ---------------------------------------------------------------------------- DART 호출

def _list(data: dict) -> list[dict] | None:
    """status 000 → list, 013(데이터 없음) → [], 그 밖 → None."""
    st = str((data or {}).get("status"))
    if st == "000":
        return data.get("list") or []
    if st == "013":
        return []
    return None


def fetch_periodic(corp: str, rp: tuple[int, str], api_key: str, dart_get, calls: list) -> dict | None:
    """최신 정기보고서의 미상환 3종 + 자금 2종. 회사채 표가 013 이면 보고서가 없는 것으로 보고 None."""
    params = {"corp_code": corp, "bsns_year": str(rp[0]), "reprt_code": rp[1]}
    first = dart_get(DEBT_KINDS["bond"][0], params, api_key)
    calls[0] += 1
    st = str(first.get("status"))
    if st == "013":
        return None
    if st != "000":
        raise RuntimeError(f"{DEBT_KINDS['bond'][0]} status={st}")
    rows = {"bond": first.get("list") or []}
    for k in ("cp", "stb"):
        calls[0] += 1
        got = _list(dart_get(DEBT_KINDS[k][0], params, api_key))
        if got is None:
            raise RuntimeError(f"{DEBT_KINDS[k][0]} 실패")
        rows[k] = got
    fund_rows = {}
    for k, (path, _, _) in FUND_KINDS.items():
        calls[0] += 1
        got = _list(dart_get(path, params, api_key))
        if got is None:
            raise RuntimeError(f"{path} 실패")
        fund_rows[k] = got
    any_row = next((r for r in rows["bond"] if isinstance(r, dict)), {})
    kinds = {k: (parse_debt(v, DEBT_KINDS[k][1]) if v else None) for k, v in rows.items()}
    return {"rp": rp_key(rp), "rc": clean(any_row.get("rcept_no")), "asOf": clean(any_row.get("stlm_dt")),
            "kinds": kinds, "fundRows": fund_rows}


def fetch_audit(corp: str, year: int, api_key: str, dart_get, calls: list) -> dict | None:
    params = {"corp_code": corp, "bsns_year": str(year), "reprt_code": "11011"}
    calls[0] += 1
    adt = _list(dart_get(AUDIT_PATH, params, api_key))
    if adt is None:
        raise RuntimeError(f"{AUDIT_PATH} 실패")
    if not adt:
        return {"y": year, "years": []}
    calls[0] += 1
    non = _list(dart_get(NONAUDIT_PATH, params, api_key)) or []
    parsed = parse_audit(adt, non) or {"years": []}
    rc = next((clean(r.get("rcept_no")) for r in adt if isinstance(r, dict) and r.get("rcept_no")), "")
    return {"y": year, "rc": rc, **parsed}


# ---------------------------------------------------------------------------- 실행

def preferred_base(code: str) -> str | None:
    code = str(code)
    if len(code) != 6 or code.endswith("0"):
        return None
    return code[:5] + "0"


def universe(top: int) -> list[str]:
    snap = load_json(KR_SNAPSHOT, {"stocks": []}) or {"stocks": []}
    stocks = [s for s in snap.get("stocks") or [] if s.get("ticker") and s.get("sector") not in ETF_SECTORS]
    stocks.sort(key=lambda s: float(s.get("marketCapT") or s.get("marketCapB") or 0), reverse=True)
    return [str(s["ticker"]) for s in stocks[:top]]


def plan_jobs(tickers: list[str], state: dict, cands: list[tuple[int, str]], audit_year: int, today: date):
    """[(ticker, need_periodic, need_audit)] — 한 번도 안 받은 회사 먼저, 그다음 시총 순."""
    latest = rp_key(cands[0])
    jobs = []
    for t in tickers:
        st = state.get(t) or {}
        stale_parser = st.get("pv") != PARSER_VERSION
        tried_today = st.get("tried") == today.isoformat()
        need_p = (st.get("rp") != latest or stale_parser) and not tried_today
        need_a = (st.get("ay") or 0) < audit_year or stale_parser
        if need_p or need_a:
            jobs.append((t, need_p, need_a, "rp" not in st))
    jobs.sort(key=lambda j: (not j[3],))
    return [(t, p, a) for t, p, a, _ in jobs]


def build(api_key: str, state: dict, top: int, max_calls: int, budget: StepBudget,
          only: set[str] | None = None) -> tuple[dict, dict]:
    from build_kr_disclosures import dart_get, load_corp_map

    today = datetime.now(KST).date()
    cands = report_candidates(today)
    audit_year = latest_fiscal_year()
    corp_map = load_corp_map(api_key)
    if not corp_map:
        raise RuntimeError("corpCode.xml 실패")
    tickers = sorted(only) if only else universe(top)
    commons, aliases = [], {}
    for t in tickers:
        if t in corp_map:
            commons.append(t)
        else:
            base = preferred_base(t)
            if base and base in corp_map:
                aliases[t] = base
    comp = state.setdefault("companies", {})
    jobs = plan_jobs(commons, comp, cands, audit_year, today)
    print(f"[재무안전] 대상 {len(commons)}사(+우선주 {len(aliases)}) · 작업 {len(jobs)} · 최신 보고서 "
          f"{rp_label(cands[0])} · 감사 {audit_year} · 호출 상한 {max_calls}", flush=True)
    calls = [0]
    done = fail = 0
    stopped = ""
    try:
        for t, need_p, need_a in jobs:
            need = (5 if need_p else 0) + (2 if need_a else 0)
            if calls[0] + need > max_calls:
                stopped = f"호출 상한 {max_calls}"
                break
            if budget.over():
                stopped = budget.reason
                break
            corp = corp_map[t]
            st = dict(comp.get(t) or {})
            raw = st.setdefault("raw", {})
            ok = True
            try:
                if need_p:
                    got = None
                    for rp in cands:
                        if st.get("rp") == rp_key(rp) and st.get("pv") == PARSER_VERSION:
                            got = "same"
                            break
                        got = fetch_periodic(corp, rp, api_key, dart_get, calls)
                        if got:
                            break
                        if calls[0] + 5 > max_calls:
                            break
                    if got and got != "same":
                        rows, more = parse_funds(got.pop("fundRows"), today)
                        raw["debt"] = {"asOf": got["asOf"], "p": rp_label(tuple_rp(got["rp"])), "rc": got["rc"],
                                       "kinds": got["kinds"]}
                        raw["funds"] = {"rc": got["rc"], "p": rp_label(tuple_rp(got["rp"])), "rows": rows,
                                        "more": more}
                        st["rp"] = got["rp"]
                    st["tried"] = today.isoformat()
                if need_a:
                    a = fetch_audit(corp, audit_year, api_key, dart_get, calls)
                    if a is not None:
                        raw["audit"] = {"y": a["y"], "rc": a.get("rc"), "years": a.get("years") or []}
                        st["ay"] = audit_year
                st["pv"] = PARSER_VERSION
            except SystemExit:
                raise
            except Exception as exc:  # noqa: BLE001
                ok = False
                fail += 1
                if fail <= 5:
                    print(f"  [재무안전] {t} 실패: {type(exc).__name__}: {exc}", flush=True)
            budget.record(ok)
            comp[t] = st
            if ok:
                done += 1
            if done and done % 100 == 0:
                print(f"  {done}사 · 호출 {calls[0]}", flush=True)
    except SystemExit as exc:          # DART 020(한도 초과) — 받은 만큼만 저장
        stopped = str(exc)
    if stopped:
        print(f"[재무안전] 멈춤: {stopped}", flush=True)

    companies: dict[str, dict] = {}
    for t in commons:
        st = comp.get(t) or {}
        rec = summarize_company(st.get("raw") or {}, today)
        if rec:
            companies[t] = rec
    for t, base in aliases.items():
        if base in companies:
            companies[t] = {"alias": base}
    if not only:
        live = set(commons)
        for t in [k for k in comp if k not in live]:
            comp.pop(t, None)
    stats = {"jobs": len(jobs), "done": done, "failed": fail, "calls": calls[0], "stopped": stopped}
    return companies, stats


def tuple_rp(key: str) -> tuple[int, str]:
    y, c = key.split("-")
    return int(y), c


def main() -> int:
    ap = argparse.ArgumentParser(description="KR 재무 안전 묶음(DART DS002) 수집")
    ap.add_argument("--top", type=int, default=600)
    ap.add_argument("--max-calls", type=int, default=int(os.environ.get("KR_SAFETY_MAX_CALLS") or 3000))
    ap.add_argument("--time-budget-min", type=float, default=0)
    ap.add_argument("--tickers", default="", help="쉼표 구분 종목만(검증용 — 파일을 쓰지 않는다)")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()

    api_key = os.environ.get("DART_API_KEY", "").strip()
    if not api_key:
        from build_kr_disclosures import dart_key_missing

        return dart_key_missing("재무안전")

    only = {t.strip().zfill(6) for t in args.tickers.split(",") if t.strip()} or None
    state = {} if only else (load_json(STATE_JSON, {}) or {})
    budget = StepBudget(args.time_budget_min)
    companies, stats = build(api_key, state, args.top, args.max_calls, budget, only)

    if only:
        for t in sorted(only):
            print(t, json.dumps(companies.get(t), ensure_ascii=False))
        print(f"[재무안전] 검증 모드 — 파일을 쓰지 않는다 {stats}")
        return 0

    atomic_write_text(STATE_JSON, json.dumps(state, ensure_ascii=False, separators=(",", ":")) + "\n")
    if not companies and stats["failed"]:
        print("[재무안전] 0건 + 오류 — 기존 파일을 덮지 않는다.")
        return 1
    payload = {
        "updatedAtKst": now_kst(),
        "source": "DART 정기보고서 주요정보(미상환 잔액·자금 사용내역·감사용역)",
        "unit": "백만원",
        "count": sum(1 for v in companies.values() if "alias" not in v),
        "withDebt": sum(1 for v in companies.values() if (v.get("debt") or {}).get("k")),
        "withFunds": sum(1 for v in companies.values() if v.get("funds")),
        "withAudit": sum(1 for v in companies.values() if v.get("audit")),
        "companies": companies,
    }
    write_data(OUT_JSON, OUT_JS, "KR_FIN_SAFETY", payload, indent=None, min_ratio=DART_REGRESSION_FLOOR)
    print(f"[재무안전] {payload['count']}사 기록 · {stats}")

    if args.push:
        import sec_client as sec

        with repository_publish_lock(ROOT):
            if not sec.git_publish(
                ["data/korea/fin_safety.json", "data/korea/fin_safety.js", "data/korea/fin_safety_state.json"],
                "KR financial safety (DART DS002)",
            ):
                return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
