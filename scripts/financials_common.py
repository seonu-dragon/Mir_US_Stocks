"""재무 데이터 확장(US SEC · KR DART) 공통 스키마·계산·쓰기 도우미.

빌더: `build_financials_us.py`(SEC companyfacts) · `build_financials_kr.py`(DART 전체재무제표).
화면: `financials.js`(종목 분석 › 재무 섹션, AI 모드 재무 패널) · 계산: `financials-core.js`.

이 docstring 이 **스키마 문서**다. 역DCF · US PER 밴드 · 재무 위험 점수는 여기 적힌 필드만 읽는다.

────────────────────────────────────────────────────────────────────────
1) 파일 배치와 로드 방법
────────────────────────────────────────────────────────────────────────
- 종목별 파일(지연 로드, 브라우저가 fetch):
    US  data/financials/<TICKER>.json          (예: data/financials/AAPL.json, BRK.B.json,
                                                 예약어 CON·PRN 등은 '_CON.json' — details 와 같은 규칙)
    KR  data/korea/financials/<6자리코드>.json  (예: data/korea/financials/005930.json)
  details(수백 MB)에 붙이지 않고 따로 둔다. 종목 화면을 열 때 그 종목 파일 하나만 받는다.
- 인덱스(.json + .js 쌍, 전역 `window.FINANCIALS_INDEX`, FEATURE_DATA 키 `financialsIndex`):
    US  data/financials_index.json / .js
    KR  data/korea/financials_index.json / .js   (marketSpecific — 시장 전환 시 다시 받는다)
  { schema, market, updatedAtKst, source, count, tickers: { <ticker>: [lastAnnualFy, lastQuarterEnd|"YYYYQn"|null,
    flags문자열("" | "F"=해외발행인(20-F/40-F) | "B"=금융업 | "FB")] }, state: {...빌더 증분 상태...} }
  인덱스에 없는 종목은 파일도 없다 → 요청하지 않는다(404 방지).
- 브라우저: `financials.js` 의 `loadFinancials(ticker)` 가 Promise<파일|null> 을 돌려준다(캐시됨).
  계산은 `window.MirFinCore`(financials-core.js, node 에서는 require) 의 순수 함수로.

────────────────────────────────────────────────────────────────────────
2) 종목별 파일 스키마 (schema: 1)
────────────────────────────────────────────────────────────────────────
{
  "schema": 1,
  "market": "us" | "kr",
  "ticker": "AAPL" | "005930",
  "name": "Apple Inc.",
  "id": {"cik": 320193} | {"corpCode": "00126380"},
  "source": "SEC EDGAR XBRL companyfacts" | "DART 전체재무제표(fnlttSinglAcntAll)",
  "basis": "us-gaap" | "ifrs-full" | "CFS"(연결) | "OFS"(별도),
  "currency": "USD" | "KRW" | "EUR" | ...   — 금액 필드의 통화(주가 통화와 다를 수 있다: 20-F 발행인),
  "annualForm": "10-K" | "20-F" | "40-F" | "사업보고서",
  "industryType": "general" | "bank" | "insurance" | "financial",
  "flags": ["foreignFiler", "financial", "nonUsdReporting", "adrShareBasis", "noQuarterly"],
  "updatedAtKst": "YYYY-MM-DD HH:MM KST",   — 이 종목을 마지막으로 다시 계산한 시각
  "lastFiled": "YYYY-MM-DD",                — 반영된 가장 최근 공시 제출일(KR 은 접수번호 날짜)
  "tags": {"rev": "Revenues", ...},         — 최신 연간 값에 쓰인 원천 태그(US us-gaap/ifrs 태그, KR account_id/계정명)
  "annual":    [행, ...]   오름차순(오래된 → 최근), 최대 10개 회계연도
  "quarterly": [행, ...]   오름차순, 최대 12분기. 해외발행인(20-F/40-F)은 보통 비어 있다.
  "ttm": {행 + "basis": "4Q" | "FY", "quarters": [분기 라벨...]} | null
}

행 공통 키
  fy        회계연도 라벨(US: 공시의 fiscal year focus, KR: 사업연도 bsns_year)
  fq        분기 1~4 (quarterly 행만). 4분기는 연간 − 1~3분기 누계로 만든 값이다(아래 d 참고).
  end       기말일 "YYYY-MM-DD" (US 만. KR 은 DART 가 기말일을 주지 않아 없다 — 12월 결산 가정 금지)
  filed     그 기간 값이 처음 실린 공시 제출일(US)
  d         [필드...]  빼기로 만든 필드 목록(분기). 예: 현금흐름표는 누계로만 공시돼 2·3분기 = 누계 차이,
            4분기 = 연간 − 3분기 누계. 추정이 아니라 공시 숫자의 산술이지만, EPS 4분기는 주식수 변동 때문에
            근사다 — 화면은 d 에 든 값을 '산출' 로 표시한다.

금액·수량 필드 (없으면 키 자체가 없다 = 결측. 0 과 구분. 추정으로 채우지 않는다)
  기간(흐름) 값 — annual 은 연간, quarterly 는 해당 분기 3개월, ttm 은 최근 4분기 합
    rev           매출(영업수익)                               통화
    op            영업이익                                     통화
    net           지배주주 순이익(없으면 연결 순이익)          통화
    pretax        법인세차감전이익                             통화
    tax           법인세비용                                   통화
    interest      이자비용(손익계산서)                         통화   KR 은 대부분 결측(금융비용만 공시)
    da            감가상각비+무형자산상각비(현금흐름표)        통화   KR 은 대부분 결측(조정 한 줄로 뭉뚱그림)
    sbc           주식보상비용(현금흐름표 조정)                통화   KR 은 대부분 결측
    ocf           영업활동현금흐름                             통화
    capex         유형자산 취득(설비투자) — **양수 = 유출 크기**  통화
    fcf           ocf − capex (둘 다 있을 때만)                 통화
    epsDil        희석 주당순이익                              통화/주  ttm = 최근 4분기 합
    sharesDilAvg  가중평균 희석 주식수                         주      ttm = 최근 4분기 평균. 4분기(빼기 불가)는 결측
  기말(잔액) 값 — 해당 기말 시점. ttm 은 최근 분기말
    assets        자산총계                                     통화
    liab          부채총계   (주의: 옛 financialsHistory 의 'debt' 는 부채총계였다. 여기 debt 는 차입금이다)
    equity        자본총계(지배주주지분, 없으면 연결 자본총계)  통화
    cash          현금및현금성자산(단기금융상품·유가증권 제외)  통화
    debt          총차입금 = 단기차입금 + 유동성장기부채 + 장기차입금 + 사채(+CP). 리스부채 제외 통화
    netDebt       debt − cash (둘 다 있을 때만)                 통화
    curAssets     유동자산                                     통화
    curLiab       유동부채                                     통화
    receivables   매출채권                                     통화
    sharesOut     기말 발행주식수(보통주. KR 은 유통주식수 = 발행 − 자기주식, 연간만) 주
                  희석 '기말' 주식수는 공시되지 않는다 — 희석은 sharesDilAvg(가중평균)만 있다.

────────────────────────────────────────────────────────────────────────
3) 다음 기능이 읽을 곳
────────────────────────────────────────────────────────────────────────
- 역DCF: ttm.fcf(없으면 annual 마지막 행 fcf), ttm.sharesDilAvg 또는 sharesOut, ttm.netDebt(최근 분기말).
  currency ≠ 주가 통화(해외발행인)거나 industryType ≠ "general" 이면 건너뛸 것(flags 로 판정).
- US PER 밴드: quarterly[].epsDil(분기, d 에 epsDil 이 있으면 산출값) → MirFinCore.ttmSeries(q, "epsDil")
  로 분기별 TTM EPS 시계열(각 점 = 그 분기말 기준 최근 4분기 합, 연속 4분기일 때만). PBR 밴드는
  quarterly[].equity / sharesOut. flags 에 adrShareBasis 가 있으면 EPS 가 ADS 기준이 아닐 수 있다.
- 재무 위험 점수: MirFinCore.derivedMetrics(file) 가 FCF 마진·ROIC·순차입금/EBITDA·주식수 증감률·
  SBC/매출·이익의 질을 연간/TTM 으로 돌려준다(정의는 financials-core.js 주석).
"""

from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path

SCHEMA_VERSION = 1

FLOW_FIELDS = ("rev", "op", "net", "pretax", "tax", "interest", "da", "sbc", "ocf", "capex",
               "epsDil", "sharesDilAvg")
INSTANT_FIELDS = ("assets", "liab", "equity", "cash", "debt", "curAssets", "curLiab",
                  "receivables", "sharesOut")
DERIVED_FIELDS = ("fcf", "netDebt")
ALL_FIELDS = FLOW_FIELDS + INSTANT_FIELDS + DERIVED_FIELDS

MAX_ANNUAL = 10
MAX_QUARTERS = 12

_RESERVED = {"CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7",
             "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"}


def safe_file_name(ticker: str) -> str:
    """details 와 같은 파일명 규칙(update_data._detail_safe_name / app.js safeTicker)."""
    safe = re.sub(r"[^A-Z0-9._-]", "_", str(ticker).upper())
    if safe.split(".")[0] in _RESERVED:
        safe = f"_{safe}"
    return safe


def _num(v):
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return v
    return None


def add_derived(row: dict) -> dict:
    """fcf·netDebt — 두 원천이 모두 있을 때만(한쪽이 결측이면 결측)."""
    ocf, capex = _num(row.get("ocf")), _num(row.get("capex"))
    if ocf is not None and capex is not None:
        row["fcf"] = ocf - capex
    else:
        row.pop("fcf", None)
    debt, cash = _num(row.get("debt")), _num(row.get("cash"))
    if debt is not None and cash is not None:
        row["netDebt"] = debt - cash
    else:
        row.pop("netDebt", None)
    return row


def _days(a: str, b: str) -> int | None:
    try:
        return (date.fromisoformat(b) - date.fromisoformat(a)).days
    except (TypeError, ValueError):
        return None


def quarters_consecutive(prev: dict, nxt: dict) -> bool:
    """두 분기 행이 연속인가. end 가 있으면 날짜 간격(75~105일), 없으면 fy·fq 순번."""
    if prev.get("end") and nxt.get("end"):
        d = _days(prev["end"], nxt["end"])
        return d is not None and 75 <= d <= 105
    try:
        a = int(prev["fy"]) * 4 + int(prev["fq"])
        b = int(nxt["fy"]) * 4 + int(nxt["fq"])
    except (KeyError, TypeError, ValueError):
        return False
    return b - a == 1


def quarter_label(row: dict) -> str:
    return f"{row.get('fy')}Q{row.get('fq')}"


def _round_shares(v):
    return int(round(v)) if isinstance(v, float) else v


def build_ttm(quarterly: list[dict], annual: list[dict]) -> dict | None:
    """최근 4개 연속 분기로 TTM. 없으면 최신 연간(basis FY). 둘 다 없으면 None.

    흐름 값은 네 분기 모두 있을 때만 합(하나라도 결측이면 결측), sharesDilAvg 는 네 분기 평균,
    기말 값은 최근 분기말. 연간이 최근 분기보다 새로우면(예: 20-F 만 내는 회사) 연간을 쓴다.
    """
    last4 = quarterly[-4:] if len(quarterly) >= 4 else []
    ok = len(last4) == 4 and all(quarters_consecutive(last4[i], last4[i + 1]) for i in range(3))
    latest_annual = annual[-1] if annual else None
    if ok and latest_annual and latest_annual.get("end") and last4[-1].get("end"):
        if latest_annual["end"] > last4[-1]["end"]:
            ok = False
    if ok:
        ttm: dict = {"basis": "4Q", "fy": last4[-1].get("fy"), "fq": last4[-1].get("fq"),
                     "quarters": [quarter_label(q) for q in last4]}
        if last4[-1].get("end"):
            ttm["end"] = last4[-1]["end"]
        for f in FLOW_FIELDS:
            vals = [q.get(f) for q in last4]
            if any(_num(v) is None for v in vals):
                continue
            if f == "sharesDilAvg":
                ttm[f] = _round_shares(sum(vals) / 4)
            elif f == "epsDil":
                ttm[f] = round(sum(vals), 4)
            else:
                ttm[f] = sum(vals)
        derived_from = sorted({f for q in last4 for f in (q.get("d") or [])})
        if derived_from:
            ttm["d"] = derived_from
        for f in INSTANT_FIELDS:
            v = last4[-1].get(f)
            if _num(v) is not None:
                ttm[f] = v
        return add_derived(ttm)
    if latest_annual:
        ttm = {"basis": "FY", "fy": latest_annual.get("fy")}
        if latest_annual.get("end"):
            ttm["end"] = latest_annual["end"]
        for f in FLOW_FIELDS + INSTANT_FIELDS:
            v = latest_annual.get(f)
            if _num(v) is not None:
                ttm[f] = v
        return add_derived(ttm)
    return None


def clean_row(row: dict, keep=("fy", "fq", "end", "filed", "form", "d")) -> dict:
    """정수로 떨어지는 금액은 int 로, 결측(None)은 키째 뺀다."""
    out = {}
    for k in keep:
        if row.get(k) not in (None, "", []):
            out[k] = row[k]
    for f in ALL_FIELDS:
        v = _num(row.get(f))
        if v is None:
            continue
        if f == "epsDil":
            out[f] = round(float(v), 4)
        elif isinstance(v, float) and v.is_integer():
            out[f] = int(v)
        elif isinstance(v, float):
            out[f] = round(v, 2)
        else:
            out[f] = v
    return out


def has_core(row: dict) -> bool:
    """행으로 남길 가치가 있나 — 핵심 계정 하나라도."""
    return any(_num(row.get(k)) is not None for k in ("rev", "op", "net", "ocf", "assets", "equity"))


def index_entry(doc: dict) -> list:
    annual = doc.get("annual") or []
    quarterly = doc.get("quarterly") or []
    last_fy = annual[-1].get("fy") if annual else None
    last_q = None
    if quarterly:
        q = quarterly[-1]
        last_q = q.get("end") or quarter_label(q)
    flags = ""
    fl = set(doc.get("flags") or [])
    if "foreignFiler" in fl:
        flags += "F"
    if "financial" in fl:
        flags += "B"
    return [last_fy, last_q, flags]


def dumps_compact(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def load_json(path: Path, default=None):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception:
        return default
