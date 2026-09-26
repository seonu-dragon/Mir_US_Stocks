#!/usr/bin/env python3
"""이벤트 스터디 워크벤치 — 과거 공시·이벤트 전체의 사전 계산(이벤트 목록 + 일별 초과수익 경로).

신호 성적표(build_signal_ledger.mjs)는 'Mir 가 띄운 신호의 발행 뒤 성적'이고, 이 빌더는
'과거 이벤트 전체'를 연구용으로 모은다. 브라우저(event-study.js + event-study-core.js)가
사용자가 고른 조건(유형·시장·기간·시총 구간·섹터·크기)으로 평균/중앙값 CAR 곡선과
날짜 묶음 부트스트랩 95% 구간을 계산한다 — 여기서는 조건별 집계를 하지 않는다.

## 이벤트 소스
US (추적 종목 중 가격 이력이 실측(yahoo)인 비ETF, 시총 상위 --us-top)
  - SEC submissions API(data.sec.gov/submissions/CIK*.json): 8-K 항목(2.02 실적·1.01·2.01·5.02·
    4.01·4.02·3.01·1.05·2.05·2.06), 13D 최초 제출(SC 13D / SCHEDULE 13D), 424B5(추가발행 보충서).
    접수 시각(acceptanceDateTime, UTC)이 있어 미 동부 16:00 이후 접수는 다음 거래일을 0일로 둔다.
  - 크기: 실적 = EPS 서프라이즈(종목 상세 earningsHistory, 접수일 ±3일 매칭),
    13D = 지분율(2024-12 이후 XML 양식 primary_doc.xml 의 percentOfClass — 옛 양식은 없음),
    자사주 = 발표 금액 ÷ 시가총액(material_events 의 kind=buyback, 최근분 적립),
    내부자 클러스터 = 매수 합계 금액(insider_trades 최근분 적립).
KR (추적 종목 비ETF)
  - DART list.json(주요사항보고 B · 거래소공시 I) 분기 창 백필: 잠정실적·공급계약(해지)·자사주 취득/
    신탁/처분·소각·유상/무상증자·CB/BW/EB·최대주주변경·현금배당·조회공시요구·불성실공시·소송·타법인 지분취득.
    정정 공시([기재정정] 등)는 원 공시와 겹치므로 뺀다. 접수 '시각'이 없어 공시일을 0일로 둔다
    (장 마감 뒤 공시는 반응이 +1일에 나므로 화면은 CAR 시작을 0일/+1일로 고를 수 있다).
  - 크기: 공급계약 = 매출액 대비(%) (data/korea/contracts.json), 증자·CB = 희석률(%)·자사주 = 취득 금액 ÷
    시가총액(data/kr_event_details.json) — 최근분만 있고 매 실행 적립한다.

## 초과수익
  - 시장조정: 종목 일간 수익률 − 벤치마크(US SPY · KR 코스피 종목 KODEX 200 / 코스닥 종목 KODEX 코스닥150).
  - 시장모형: 추정창 −250~−30 거래일의 OLS α·β 로 기대수익을 빼 준다(관측 120일 미만이면 없음).
  - 경로: −5 ~ +60 거래일, −5일부터 누적(CAR). 저장은 POINTS 지점만(0.1%p 정수).
  - 대조군: 같은 종목의 무작위 날짜(같은 유형 이벤트 ±60거래일 밖, 결정적 시드) 1개를 같은 방식으로.

## 한계(화면에 그대로 적는다)
  - 가격 이력은 현재 추적 종목의 약 5년 일봉뿐 — 상장폐지 종목은 빠진다(생존편향).
  - 시총 구간은 '현재 시총 × 이벤트 전일 종가 ÷ 현재 종가' 근사(주식 수 변화 무시).
  - 적립형 소스(내부자 클러스터·US 자사주·KR 크기 속성)는 수집을 시작한 뒤의 표본만 있다.

## 산출물
  data/event_study/index.{json,js}      window.EVENT_STUDY_INDEX (유형 카탈로그·방법·한계·파일 목록)
  data/event_study/<m>_<type>.json      유형별 이벤트 행(브라우저가 유형을 고를 때 fetch)
  data/event_study/tk/<m>_NN.json       종목별 이벤트 반응 요약(종목 분석 카드용, 16 샤드)
  data/event_study_archive/<m>.json     이벤트 목록 상태(증분·적립용, 배포 제외)

실행:
  py scripts/build_event_study.py                      # 두 시장 수집 + 경로 재계산
  py scripts/build_event_study.py --market us --push
  py scripts/build_event_study.py --no-fetch           # 아카이브로 경로만 재계산
  py scripts/build_event_study.py --kr-quarters 21     # DART 5년치 한 번에(약 2,800회 호출)
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import re
import sys
import time
import zlib
from datetime import date, datetime, timedelta, timezone
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
import sec_client as sec  # noqa: E402

KST = ZoneInfo("Asia/Seoul")
ET = ZoneInfo("America/New_York")

OUT_DIR = ROOT / "data" / "event_study"
ARCHIVE_DIR = ROOT / "data" / "event_study_archive"
OUT_JSON = OUT_DIR / "index.json"   # EVENT_STUDY_INDEX
OUT_JS = OUT_DIR / "index.js"
TK_SHARDS = 16

POINTS = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 5, 10, 20, 30, 40, 60]
PRE, POST = 5, 60
EST_FROM, EST_TO, EST_MIN = -250, -30, 120
CONTROL_GAP = 20          # 대조 날짜는 같은 종목·같은 유형 이벤트에서 이 거래일 수보다 멀리(분기 실적처럼 잦은 유형도 뽑히게)
MAX_ABS_DAILY_AR = 1.0    # 일간 초과수익 절댓값이 이보다 크면 가격 오류로 보고 뺀다
SCALE = 1000              # CAR 저장 단위: 0.1%p 정수
START_DATE = "2021-09-01"  # 가격 이력(약 5년) 시작 근처 — 그 이전 이벤트는 경로를 못 만든다

BENCH = {
    "us": {"default": ("SPY", "S&P 500 ETF (SPY)")},
    "kr": {"kospi": ("069500", "KODEX 200"), "kosdaq": ("229200", "KODEX 코스닥150")},
}
REAL_SOURCES = {"yahoo", "yahoo-cache"}

# 유형 카탈로그. link = 기존 공시 트래커 서브탭(data-disc) — 트래커에서 '과거 반응 보기' 링크가 된다.
# timing: exact(접수 시각 있음) | date(날짜만). size: 크기 속성(없으면 None).
TYPES = [
    # ---- US
    {"m": "us", "k": "us_earn", "label": "실적 발표 (8-K 2.02)", "group": "실적", "timing": "exact", "link": "earnreact",
     "size": {"label": "EPS 서프라이즈", "unit": "%", "bins": [-10, 0, 5, 15]},
     "desc": "8-K Item 2.02(실적 보도자료) 접수. 크기는 야후 EPS 추정 대비 서프라이즈(접수일 ±3일 매칭)."},
    {"m": "us", "k": "us_8k_101", "label": "주요 계약 체결 (8-K 1.01)", "group": "8-K", "timing": "exact", "link": "events",
     "desc": "Item 1.01 Entry into a Material Definitive Agreement."},
    {"m": "us", "k": "us_8k_201", "label": "인수·처분 완료 (8-K 2.01)", "group": "8-K", "timing": "exact", "link": "events",
     "desc": "Item 2.01 Completion of Acquisition or Disposition of Assets."},
    {"m": "us", "k": "us_8k_502", "label": "임원·이사 변동 (8-K 5.02)", "group": "8-K", "timing": "exact", "link": "events",
     "desc": "Item 5.02 임원·이사 선임/사임·보수 계약."},
    {"m": "us", "k": "us_8k_401", "label": "감사인 변경 (8-K 4.01)", "group": "8-K", "timing": "exact", "link": "events",
     "desc": "Item 4.01 Changes in Registrant's Certifying Accountant."},
    {"m": "us", "k": "us_8k_402", "label": "재무제표 신뢰 불가 (8-K 4.02)", "group": "8-K", "timing": "exact", "link": "events",
     "desc": "Item 4.02 Non-Reliance on Previously Issued Financial Statements(재작성)."},
    {"m": "us", "k": "us_8k_301", "label": "상장 기준 미달·상장폐지 통지 (8-K 3.01)", "group": "8-K", "timing": "exact", "link": "events",
     "desc": "Item 3.01 Notice of Delisting or Failure to Satisfy a Continued Listing Rule."},
    {"m": "us", "k": "us_8k_105", "label": "사이버보안 사고 (8-K 1.05)", "group": "8-K", "timing": "exact", "link": "events",
     "desc": "Item 1.05 Material Cybersecurity Incidents(2023-12 신설)."},
    {"m": "us", "k": "us_8k_205", "label": "구조조정 비용 (8-K 2.05)", "group": "8-K", "timing": "exact", "link": "events",
     "desc": "Item 2.05 Costs Associated with Exit or Disposal Activities."},
    {"m": "us", "k": "us_8k_206", "label": "자산 손상 (8-K 2.06)", "group": "8-K", "timing": "exact", "link": "events",
     "desc": "Item 2.06 Material Impairments."},
    {"m": "us", "k": "us_13d", "label": "액티비스트 13D (최초)", "group": "지분", "timing": "exact", "link": "activist",
     "size": {"label": "지분율", "unit": "%", "bins": [7, 10, 20]},
     "desc": "5% 이상 경영참여 목적 보유 최초 신고(SC 13D / SCHEDULE 13D, 정정 /A 제외). 지분율은 2024-12 이후 XML 양식만."},
    {"m": "us", "k": "us_424b5", "label": "추가발행 보충서 (424B5)", "group": "증자", "timing": "exact", "link": "dilution",
     "desc": "선반등록 뒤 실제 발행 보충서. 같은 종목의 20거래일 안 연속 제출은 첫 건만."},
    {"m": "us", "k": "us_insider_cluster", "label": "내부자 클러스터 매수", "group": "지분", "timing": "date", "link": "insider",
     "size": {"label": "매수 합계", "unit": "$", "bins": [100000, 1000000, 10000000]}, "accrual": True,
     "desc": "14일 안에 2명 이상 임원이 공개시장 매수(Form 4 코드 P). 두 번째 매수자의 제출일이 이벤트일. 수집 시작(2026-09) 이후만."},
    {"m": "us", "k": "us_buyback", "label": "자사주 매입 발표", "group": "주주환원", "timing": "exact", "link": "buyback",
     "size": {"label": "시총 대비", "unit": "%", "bins": [1, 3, 10]}, "accrual": True,
     "desc": "8-K 본문에서 금액이 확정된 자사주 매입 발표(material_events kind=buyback). 수집 시작 이후만."},
    # ---- KR
    {"m": "kr", "k": "kr_earn", "label": "잠정실적 공시", "group": "실적", "timing": "date", "link": "earnreact",
     "desc": "영업(잠정)실적(공정공시) · 연결재무제표기준영업(잠정)실적."},
    {"m": "kr", "k": "kr_contract", "label": "단일판매·공급계약 체결", "group": "수주", "timing": "date", "link": "contract",
     "size": {"label": "매출액 대비", "unit": "%", "bins": [10, 30, 100]},
     "desc": "단일판매ㆍ공급계약체결(자율공시 포함). 크기(최근 매출액 대비)는 공시 원문 파싱분(최근)만."},
    {"m": "kr", "k": "kr_contract_cancel", "label": "공급계약 해지", "group": "수주", "timing": "date", "link": "contract",
     "desc": "단일판매ㆍ공급계약해지."},
    {"m": "kr", "k": "kr_buyback", "label": "자기주식 취득 결정", "group": "주주환원", "timing": "date", "link": "buyback",
     "size": {"label": "시총 대비", "unit": "%", "bins": [0.5, 1, 3]},
     "desc": "주요사항보고서(자기주식취득결정) — 직접 취득. 크기(취득 예정 금액 ÷ 시총)는 최근분만."},
    {"m": "kr", "k": "kr_buyback_trust", "label": "자기주식 취득 신탁계약", "group": "주주환원", "timing": "date", "link": "buyback",
     "desc": "자기주식취득신탁계약체결결정(해지 제외)."},
    {"m": "kr", "k": "kr_treasury_sale", "label": "자기주식 처분 결정", "group": "주주환원", "timing": "date", "link": "buyback",
     "desc": "주요사항보고서(자기주식처분결정)."},
    {"m": "kr", "k": "kr_cancel", "label": "주식 소각 결정", "group": "주주환원", "timing": "date", "link": "buyback",
     "desc": "주식소각결정."},
    {"m": "kr", "k": "kr_rights", "label": "유상증자 결정", "group": "증자", "timing": "date", "link": "dilution",
     "size": {"label": "희석률", "unit": "%", "bins": [5, 15, 30]},
     "desc": "주요사항보고서(유상증자결정 · 유무상증자결정). 희석률은 최근분만."},
    {"m": "kr", "k": "kr_bonus", "label": "무상증자 결정", "group": "증자", "timing": "date", "link": "dilution",
     "desc": "주요사항보고서(무상증자결정)."},
    {"m": "kr", "k": "kr_cb", "label": "CB·BW·EB 발행 결정", "group": "증자", "timing": "date", "link": "dilution",
     "size": {"label": "희석률", "unit": "%", "bins": [5, 15, 30]},
     "desc": "전환사채권·신주인수권부사채권·교환사채권 발행결정. 희석률은 최근분만."},
    {"m": "kr", "k": "kr_major_change", "label": "최대주주 변경", "group": "지분", "timing": "date", "link": "dart",
     "desc": "최대주주변경(담보제공 계약 등 '수반하는' 공시 제외)."},
    {"m": "kr", "k": "kr_dividend", "label": "현금·현물배당 결정", "group": "주주환원", "timing": "date", "link": "dividend",
     "desc": "현금ㆍ현물배당결정."},
    {"m": "kr", "k": "kr_inquiry", "label": "조회공시 요구(시황 변동)", "group": "시장", "timing": "date", "link": "dart",
     "desc": "거래소의 조회공시요구 — 이미 주가가 크게 움직인 뒤에 나오므로 이벤트 전 구간을 함께 볼 것."},
    {"m": "kr", "k": "kr_unfaithful", "label": "불성실공시법인 지정", "group": "시장", "timing": "date", "link": "dart",
     "desc": "불성실공시법인지정(예고 제외)."},
    {"m": "kr", "k": "kr_lawsuit", "label": "소송 등의 제기", "group": "기타", "timing": "date", "link": "dart",
     "desc": "소송등의제기·신청."},
    {"m": "kr", "k": "kr_equity_acq", "label": "타법인 주식 취득 결정", "group": "기타", "timing": "date", "link": "dart",
     "desc": "타법인주식및출자증권취득결정."},
]
TYPE_INDEX = {t["k"]: t for t in TYPES}

US_8K_ITEMS = {"2.02": "us_earn", "1.01": "us_8k_101", "2.01": "us_8k_201", "5.02": "us_8k_502",
               "4.01": "us_8k_401", "4.02": "us_8k_402", "3.01": "us_8k_301", "1.05": "us_8k_105",
               "2.05": "us_8k_205", "2.06": "us_8k_206"}

US_CAP_BUCKETS = [(2, "소형 (<$2B)"), (10, "중형 ($2~10B)"), (200, "대형 ($10~200B)"), (None, "초대형 (≥$200B)")]
KR_CAP_BUCKETS = [(0.3, "소형 (<3천억)"), (1, "중형 (3천억~1조)"), (10, "대형 (1~10조)"), (None, "초대형 (≥10조)")]


# ================================================================== 공통 유틸
def now_kst_str() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def read_json(path: Path, default=None):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception:
        return default


def write_json(path: Path, obj) -> None:
    atomic_write_text(path, json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n")


def detail_safe_name(ticker: str) -> str:
    safe = re.sub(r"[^A-Z0-9._-]", "_", str(ticker).upper())
    reserved = {"CON", "PRN", "AUX", "NUL", *(f"COM{i}" for i in range(1, 10)), *(f"LPT{i}" for i in range(1, 10))}
    if safe.split(".")[0] in reserved:
        safe = f"_{safe}"
    return safe


def load_series(market: str, ticker: str):
    """종목 상세 일봉 → (dates, closes). 실측 이력(yahoo)이 아니면 None — 합성 이력으로 반응을 재지 않는다."""
    if market == "us":
        names = [detail_safe_name(ticker), detail_safe_name(ticker.replace("-", "."))]
        base = ROOT / "data" / "details"
    else:
        names = [str(ticker)]
        base = ROOT / "data" / "korea" / "details"
    for n in dict.fromkeys(names):
        d = read_json(base / f"{n}.json")
        if not d:
            continue
        if d.get("historySource") not in REAL_SOURCES:
            return None
        return series_from_chart(d.get("chartSeries")), d
    return None


def series_from_chart(rows):
    dates, closes = [], []
    for r in rows or []:
        if not isinstance(r, list) or len(r) < 6:
            continue
        try:
            c = float(r[3])
        except (TypeError, ValueError):
            continue
        d = str(r[5])[:10]
        if not c or c <= 0 or len(d) != 10:
            continue
        if dates and d <= dates[-1]:
            continue
        dates.append(d)
        closes.append(c)
    return (dates, closes) if dates else None


DAY_BASE = date(2000, 1, 1)
TM_CODE = {"amc": "a", "bmo": "b", "mkt": "m", "unk": "u"}


def day_num(iso: str) -> int:
    """ISO 날짜 → 2000-01-01 부터의 일수(event-study-core.js dayIso 가 되돌린다)."""
    return (date.fromisoformat(iso[:10]) - DAY_BASE).days


def round_cap(market: str, cap: float | None):
    if cap is None:
        return None
    return round(cap, 2 if market == "us" else 3)


def cap_bucket(market: str, cap: float | None) -> int:
    if cap is None or not math.isfinite(cap):
        return -1
    buckets = US_CAP_BUCKETS if market == "us" else KR_CAP_BUCKETS
    for i, (hi, _) in enumerate(buckets):
        if hi is None or cap < hi:
            return i
    return len(buckets) - 1


# ================================================================== 타이밍 · 0일
def us_timing(accept_utc: str) -> tuple[str, str]:
    """acceptanceDateTime(UTC ISO) → (미 동부 날짜, 세션 bmo|mkt|amc)."""
    try:
        dt = datetime.fromisoformat(accept_utc.replace("Z", "+00:00"))
    except ValueError:
        return "", "unk"
    et = dt.astimezone(ET)
    hm = et.hour * 60 + et.minute
    sess = "bmo" if hm < 9 * 60 + 30 else ("amc" if hm >= 16 * 60 else "mkt")
    return et.strftime("%Y-%m-%d"), sess


def day0_index(cal: list[str], event_date: str, session: str) -> int | None:
    """거래일 달력에서 0일 위치. 장 마감 후(amc)면 이벤트 날짜 '다음' 거래일, 아니면 그날 이후 첫 거래일."""
    import bisect
    if session == "amc":
        i = bisect.bisect_right(cal, event_date)
    else:
        i = bisect.bisect_left(cal, event_date)
    return i if i < len(cal) else None


# ================================================================== 초과수익 경로(순수 계산)
def align_returns(cal: list[str], bench_closes: list[float], s_dates: list[str], s_closes: list[float]):
    """벤치마크 거래일 달력 위의 종목·벤치마크 일간 수익률. 종목 이력 밖은 None.
    종목에 없는 거래일(거래정지 등)은 직전 종가를 이어 붙인다(그날 수익률 0, 재개일에 몰림)."""
    pos = {d: i for i, d in enumerate(s_dates)}
    first, last = s_dates[0], s_dates[-1]
    sc: list[float | None] = []
    j = None
    for d in cal:
        if d < first or d > last:
            sc.append(None)
            continue
        if d in pos:
            j = pos[d]
        sc.append(s_closes[j] if j is not None else None)
    rs: list[float | None] = [None] * len(cal)
    rb: list[float | None] = [None] * len(cal)
    for i in range(1, len(cal)):
        if bench_closes[i - 1] and bench_closes[i]:
            rb[i] = bench_closes[i] / bench_closes[i - 1] - 1
        if sc[i] is not None and sc[i - 1] is not None and sc[i - 1] > 0:
            rs[i] = sc[i] / sc[i - 1] - 1
    return rs, rb, sc


def market_model(rs, rb, i0: int):
    """추정창 [i0-250, i0-30] OLS. (alpha, beta) 또는 None."""
    xs, ys = [], []
    for i in range(max(1, i0 + EST_FROM), i0 + EST_TO + 1):
        if 0 <= i < len(rs) and rs[i] is not None and rb[i] is not None:
            xs.append(rb[i])
            ys.append(rs[i])
    n = len(xs)
    if n < EST_MIN:
        return None
    mx, my = sum(xs) / n, sum(ys) / n
    vx = sum((x - mx) ** 2 for x in xs)
    if vx <= 0:
        return None
    beta = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / vx
    return my - beta * mx, beta


def car_points(rs, rb, i0: int, model=None):
    """−5일부터 누적한 CAR 을 POINTS 지점에서. 데이터가 끝난 뒤 지점은 None.
    반환: (points[list[int|None]] | None, 오류 여부). 시작 구간(−5~0)이 비면 None."""
    out: list[int | None] = []
    cum = 0.0
    by_offset = {}
    for off in range(-PRE, POST + 1):
        i = i0 + off
        if i < 1 or i >= len(rs) or rs[i] is None or rb[i] is None:
            if off <= 0:
                return None, False     # 이벤트 전·당일이 비면 경로 없음
            break
        exp = rb[i] if model is None else model[0] + model[1] * rb[i]
        ar = rs[i] - exp
        if abs(ar) > MAX_ABS_DAILY_AR:
            return None, True
        cum += ar
        by_offset[off] = cum
    for p in POINTS:
        v = by_offset.get(p)
        out.append(None if v is None else int(round(v * SCALE)))
    return out, False


def event_paths(rs, rb, i0: int):
    """(시장조정 경로, 시장모형 경로|None, 오류 여부)."""
    ma, bad = car_points(rs, rb, i0, None)
    if ma is None:
        return None, None, bad
    model = market_model(rs, rb, i0)
    mm = None
    if model is not None:
        mm, _ = car_points(rs, rb, i0, model)
    return ma, mm, False


def pick_control(rs, rb, event_idx: list[int], seed_text: str, i_min: int = PRE + 1):
    """같은 종목의 무작위 날짜(같은 유형 이벤트에서 CONTROL_GAP 거래일 밖). 결정적 시드. 인덱스 또는 None."""
    valid = [i for i in range(max(i_min, 1), len(rs) - 1) if rs[i] is not None]
    if not valid:
        return None
    rnd = random.Random(zlib.crc32(seed_text.encode("utf-8")))
    for _ in range(40):
        j = valid[rnd.randrange(len(valid))]
        if all(abs(j - e) > CONTROL_GAP for e in event_idx):
            return j
    return None


# ================================================================== US 수집
def us_universe(top: int):
    snap = read_json(ROOT / "data" / "market_snapshot.json", {}) or {}
    rows = []
    for s in snap.get("stocks") or []:
        if s.get("sector") in ("EXCHANGE TRADED FUNDS", "ETF"):
            continue
        if s.get("historySource") not in REAL_SOURCES:
            continue
        cap = float(s.get("marketCapB") or 0)
        if cap <= 0:
            continue
        rows.append((cap, str(s["ticker"]).upper()))
    rows.sort(reverse=True)
    return [t for _, t in rows[:top]]


def sec_filings(sec, cik: int, cutoff: str, max_extra: int = 4):
    """submissions JSON(recent + 필요한 과거 파일)의 행 목록."""
    base = sec.sec_get_json(f"https://data.sec.gov/submissions/CIK{cik:010d}.json")
    blocks = [base.get("filings", {}).get("recent", {})]
    for f in (base.get("filings", {}).get("files") or [])[:max_extra]:
        if str(f.get("filingTo") or "") < cutoff:
            break
        try:
            blocks.append(sec.sec_get_json(f"https://data.sec.gov/submissions/{f['name']}"))
        except Exception:
            break
    rows = []
    for b in blocks:
        forms = b.get("form") or []
        for i, form in enumerate(forms):
            fd = (b.get("filingDate") or [""] * len(forms))[i]
            if fd < cutoff:
                continue
            rows.append({
                "form": form, "fd": fd,
                "acc": (b.get("accessionNumber") or [""] * len(forms))[i],
                "at": (b.get("acceptanceDateTime") or [""] * len(forms))[i],
                "items": (b.get("items") or [""] * len(forms))[i] or "",
                "doc": (b.get("primaryDocument") or [""] * len(forms))[i] or "",
            })
    return rows


PCT_RE = re.compile(r"<percentOfClass>\s*([0-9.]+)\s*</percentOfClass>")


def thirteen_d_percent(sec, cik: int, acc: str, doc: str):
    if not doc.endswith("primary_doc.xml"):
        return None
    url = f"https://www.sec.gov/Archives/edgar/data/{cik}/{acc.replace('-', '')}/primary_doc.xml"
    try:
        text = sec.sec_get(url).decode("utf-8", "replace")
    except Exception:
        return None
    vals = [float(x) for x in PCT_RE.findall(text) if x]
    vals = [v for v in vals if 0 < v <= 100]
    return max(vals) if vals else None


def collect_us(archive: dict, args) -> tuple[dict, bool]:
    events = {e["key"]: e for e in archive.get("events", [])}
    tickers = us_universe(args.us_top)
    try:
        _, t2c = sec.company_ticker_maps()
    except Exception as exc:
        print(f"[us] company_tickers 실패: {exc}")
        return archive, False
    ok = fail = 0
    pct_budget = args.pct_budget
    t0 = time.time()
    for n, t in enumerate(tickers):
        cik = t2c.get(t) or t2c.get(t.replace(".", "-")) or t2c.get(t.replace("-", "."))
        if not cik:
            continue
        try:
            rows = sec_filings(sec, cik, START_DATE)
            ok += 1
        except Exception as exc:
            fail += 1
            if fail <= 5:
                print(f"  [us] {t} submissions 실패: {exc}")
            continue
        for r in rows:
            form = r["form"]
            if form == "8-K":
                ed, sess = us_timing(r["at"])
                for item in [x.strip() for x in r["items"].split(",") if x.strip()]:
                    k = US_8K_ITEMS.get(item)
                    if not k:
                        continue
                    key = f"{k}|{r['acc']}"
                    if key not in events:
                        events[key] = {"key": key, "k": k, "t": t, "d": ed or r["fd"], "tm": sess, "src": "sec"}
            elif form in ("SC 13D", "SCHEDULE 13D"):
                ed, sess = us_timing(r["at"])
                key = f"us_13d|{r['acc']}"
                ev = events.get(key)
                if ev is None:
                    ev = events[key] = {"key": key, "k": "us_13d", "t": t, "d": ed or r["fd"], "tm": sess, "src": "sec"}
                if ev.get("sz") is None and not ev.get("szTried") and pct_budget > 0 and r["doc"].endswith("primary_doc.xml"):
                    pct_budget -= 1
                    ev["szTried"] = True
                    ev["sz"] = thirteen_d_percent(sec, cik, r["acc"], r["doc"])
            elif form == "424B5":
                ed, sess = us_timing(r["at"])
                key = f"us_424b5|{r['acc']}"
                if key not in events:
                    events[key] = {"key": key, "k": "us_424b5", "t": t, "d": ed or r["fd"], "tm": sess, "src": "sec"}
        if (n + 1) % 200 == 0:
            print(f"  [us] {n + 1}/{len(tickers)} 종목 · 이벤트 {len(events):,} · {time.time() - t0:.0f}초")
    print(f"[us] SEC submissions 성공 {ok} · 실패 {fail} · 13D 지분율 조회 {args.pct_budget - pct_budget}건")
    healthy = ok > 0 and fail <= max(20, ok * 0.2)
    accrue_us(events)
    archive = {**archive, "events": sorted(events.values(), key=lambda e: (e["d"], e["key"])),
               "secFetchedAtKst": now_kst_str() if healthy else archive.get("secFetchedAtKst"),
               "universe": len(tickers)}
    return archive, healthy


def accrue_us(events: dict) -> None:
    """적립형: 최근 파일(insider_trades·material_events)에서 내부자 클러스터·자사주 발표를 더한다."""
    # 내부자 클러스터: 14일 안에 서로 다른 2명 이상이 P(공개시장 매수).
    ins = read_json(ROOT / "data" / "insider_trades.json", {}) or {}
    by_t: dict[str, list] = {}
    for tr in ins.get("trades") or []:
        if tr.get("code") != "P" or not tr.get("ticker") or not tr.get("fileDate"):
            continue
        by_t.setdefault(str(tr["ticker"]).upper(), []).append(tr)
    existing = {}
    for e in events.values():
        if e["k"] == "us_insider_cluster":
            existing.setdefault(e["t"], []).append(e["d"])
    for t, trs in by_t.items():
        trs.sort(key=lambda x: (x["fileDate"], x.get("owner") or ""))
        for i, tr in enumerate(trs):
            d = tr["fileDate"]
            lo = (date.fromisoformat(d) - timedelta(days=14)).isoformat()
            window = [x for x in trs[: i + 1] if x["fileDate"] >= lo]
            owners = {x.get("owner") for x in window}
            if len(owners) < 2:
                continue
            if any(abs((date.fromisoformat(d) - date.fromisoformat(p)).days) <= 30 for p in existing.get(t, [])):
                break
            total = sum(float(x.get("value") or 0) for x in window)
            key = f"us_insider_cluster|{t}|{d}"
            events[key] = {"key": key, "k": "us_insider_cluster", "t": t, "d": d, "tm": "unk", "src": "insider_trades",
                           "sz": round(total) if total > 0 else None}
            existing.setdefault(t, []).append(d)
            break
    # 자사주 발표: 금액 확정분(kind=buyback). 시각은 같은 접수번호의 8-K 이벤트가 있으면 그 세션을 쓴다.
    me = read_json(ROOT / "data" / "material_events.json", {}) or {}
    sess_by_acc = {e["key"].split("|", 1)[1]: (e["d"], e.get("tm", "unk")) for e in events.values() if e["k"].startswith("us_8k") or e["k"] == "us_earn"}
    for ev in me.get("events") or []:
        if ev.get("kind") != "buyback" or not ev.get("ticker") or not ev.get("accession"):
            continue
        key = f"us_buyback|{ev['accession']}"
        if key in events:
            continue
        d, tm = sess_by_acc.get(ev["accession"], (ev.get("fileDate"), "unk"))
        events[key] = {"key": key, "k": "us_buyback", "t": str(ev["ticker"]).upper(), "d": d, "tm": tm,
                       "src": "material_events", "amt": ev.get("amountUsd")}


# ================================================================== KR 수집
KR_RULES = [
    # (포함 조건, 제외 조건, 유형) — 위에서부터 먼저 맞는 것.
    (("(잠정)실적",), ("예고",), "kr_earn"),
    (("공급계약해지",), (), "kr_contract_cancel"),
    (("단일판매", "공급계약"), ("해지",), "kr_contract"),
    (("자기주식취득신탁계약체결",), (), "kr_buyback_trust"),
    (("자기주식취득결정",), ("신탁",), "kr_buyback"),
    (("자기주식처분결정",), ("신탁",), "kr_treasury_sale"),
    (("주식소각결정",), (), "kr_cancel"),
    (("유상증자결정", "유무상증자결정"), (), "kr_rights"),
    (("무상증자결정",), ("유무상",), "kr_bonus"),
    (("전환사채권발행결정", "신주인수권부사채권발행결정", "교환사채권발행결정"), ("자기",), "kr_cb"),
    (("최대주주변경",), ("수반",), "kr_major_change"),
    (("현금ㆍ현물배당결정", "현금·현물배당결정", "현금배당결정"), (), "kr_dividend"),
    (("조회공시요구",), (), "kr_inquiry"),
    (("불성실공시법인지정",), ("예고",), "kr_unfaithful"),
    (("소송등의제기", "소송등의신청"), (), "kr_lawsuit"),
    (("타법인주식및출자증권취득결정",), (), "kr_equity_acq"),
]


def kr_classify(report_nm: str) -> str | None:
    nm = re.sub(r"\s+", "", str(report_nm or ""))
    if not nm or nm.startswith("["):   # [기재정정]·[첨부정정]·[발행조건확정] 등은 원 공시와 겹친다
        return None
    for incl, excl, k in KR_RULES:
        if any(x in nm for x in incl) and not any(x in nm for x in excl):
            return k
    return None


def kr_quarters(today: date, n_years: int = 5):
    y, q = today.year, (today.month - 1) // 3 + 1
    out = []
    for _ in range(n_years * 4 + 1):
        m0 = (q - 1) * 3 + 1
        bgn = date(y, m0, 1)
        end = date(y + (1 if q == 4 else 0), 1 if q == 4 else m0 + 3, 1) - timedelta(days=1)
        if end > today:
            end = today
        if end.isoformat() >= START_DATE:
            out.append((bgn.strftime("%Y%m%d"), end.strftime("%Y%m%d"), f"{y}Q{q}"))
        q -= 1
        if q == 0:
            y, q = y - 1, 4
    return out


def kr_tracked():
    snap = read_json(ROOT / "data" / "korea" / "market_snapshot.json", {}) or {}
    out = {}
    for s in snap.get("stocks") or []:
        if s.get("sector") in ("ETF", "etf") or s.get("market") == "etf":
            continue
        code = str(s.get("ticker") or "").replace(".KS", "").replace(".KQ", "").zfill(6)
        if code != "000000":
            out[code] = s
    return out


def collect_kr(archive: dict, args) -> tuple[dict, bool]:
    from build_kr_disclosures import dart_get
    key = os.environ.get("DART_API_KEY", "").strip()
    events = {e["key"]: e for e in archive.get("events", [])}
    done = dict(archive.get("dartQuarters") or {})
    if not key:
        print("[kr] DART_API_KEY 없음 — DART 수집 생략")
        accrue_kr(events)
        return {**archive, "events": sorted(events.values(), key=lambda e: (e["d"], e["key"]))}, False
    tracked = kr_tracked()
    qs = kr_quarters(datetime.now(KST).date())
    # 최근 2분기는 늘 다시 받는다(분기 중간에 받은 건 미완). 나머지는 안 받은 분기만, 최근부터.
    todo = [q for i, q in enumerate(qs) if i < 2 or q[2] not in done][: max(2, args.kr_quarters)]
    healthy = True
    for bgn, end, label in todo:
        n_before = len(events)
        errors = 0
        for cls in ("Y", "K"):
            for ty in ("B", "I"):
                page = 1
                while page <= 400:
                    try:
                        data = dart_get("list.json", {"bgn_de": bgn, "end_de": end, "corp_cls": cls, "pblntf_ty": ty,
                                                      "page_no": str(page), "page_count": "100"}, key)
                    except Exception as exc:
                        print(f"  [kr] {label} {cls}/{ty} p{page} 실패: {exc}")
                        errors += 1
                        break
                    st = str(data.get("status") or "")
                    if st == "013":
                        break
                    if st != "000":
                        print(f"  [kr] {label} {cls}/{ty} status {st}")
                        errors += 1
                        break
                    for r in data.get("list") or []:
                        code = str(r.get("stock_code") or "").strip().zfill(6)
                        if code not in tracked:
                            continue
                        k = kr_classify(r.get("report_nm"))
                        if not k:
                            continue
                        rc = str(r.get("rcept_no") or "").strip()
                        d = str(r.get("rcept_dt") or "")
                        if not rc or len(d) != 8:
                            continue
                        ek = f"{k}|{rc}"
                        if ek not in events:
                            events[ek] = {"key": ek, "k": k, "t": code, "d": f"{d[:4]}-{d[4:6]}-{d[6:]}", "tm": "unk",
                                          "src": "dart", "rc": rc}
                    if page >= int(data.get("total_page") or 1):
                        break
                    page += 1
        if errors:
            healthy = False
        else:
            done[label] = now_kst_str()
        print(f"  [kr] {label}: +{len(events) - n_before:,} (누적 {len(events):,}){' · 오류 ' + str(errors) if errors else ''}")
    accrue_kr(events)
    missing = [q[2] for q in qs if q[2] not in done]
    if missing:
        print(f"[kr] 아직 안 받은 분기 {len(missing)}개: {', '.join(missing[:6])}{'…' if len(missing) > 6 else ''}")
    return {**archive, "events": sorted(events.values(), key=lambda e: (e["d"], e["key"])), "dartQuarters": done,
            "dartMissing": missing, "dartFetchedAtKst": now_kst_str() if healthy else archive.get("dartFetchedAtKst")}, healthy


def accrue_kr(events: dict) -> None:
    """적립형 크기 속성: 접수번호가 같은 이벤트에 붙인다(최근 파일에만 있어 매 실행 쌓는다)."""
    by_rc = {}
    for e in events.values():
        if e.get("rc"):
            by_rc.setdefault(e["rc"], []).append(e)
    contracts = read_json(ROOT / "data" / "korea" / "contracts.json", {}) or {}
    for r in contracts.get("rows") or []:
        m = re.search(r"rcpNo=(\d+)", str(r.get("link") or ""))
        if not m or r.get("salesRatio") is None:
            continue
        for e in by_rc.get(m.group(1), []):
            if e["k"] == "kr_contract":
                e["sz"] = round(float(r["salesRatio"]), 2)
    details = (read_json(ROOT / "data" / "kr_event_details.json", {}) or {}).get("details") or {}
    for rc, det in details.items():
        for e in by_rc.get(rc, []):
            if e["k"] in ("kr_rights", "kr_cb") and det.get("dilutionPct") is not None:
                e["sz"] = round(float(det["dilutionPct"]), 2)
            elif e["k"] == "kr_buyback" and det.get("amount"):
                e["amt"] = float(det["amount"])


# ================================================================== 경로 계산 · 산출물
def bench_series(market: str, name: str):
    tk, _ = BENCH[market][name]
    got = load_series(market, tk)
    if not got or not got[0]:
        raise SystemExit(f"[{market}] 벤치마크 {tk} 일봉을 읽지 못함 — 중단")
    return got[0]


def compute_market(market: str, archive: dict):
    snap_path = ROOT / "data" / ("market_snapshot.json" if market == "us" else "korea/market_snapshot.json")
    snap = read_json(snap_path, {}) or {}
    stock_meta = {}
    for s in snap.get("stocks") or []:
        t = str(s.get("ticker") or "").upper() if market == "us" else str(s.get("ticker") or "").zfill(6)
        stock_meta[t] = s
    benches = {name: bench_series(market, name) for name in BENCH[market]}
    sectors: list[str] = []
    sector_idx: dict[str, int] = {}

    evs = [e for e in archive.get("events", []) if e.get("k") in TYPE_INDEX and e.get("d", "") >= START_DATE]
    by_ticker: dict[str, list] = {}
    for e in evs:
        by_ticker.setdefault(e["t"], []).append(e)

    rows_by_type: dict[str, list] = {}
    tk_rows: dict[str, list] = {}
    stats = {"events": len(evs), "noPrice": 0, "noWindow": 0, "badPrice": 0, "deduped": 0, "kept": 0}
    for t, tevs in sorted(by_ticker.items()):
        meta = stock_meta.get(t)
        got = load_series(market, t)
        if not got or not got[0] or not meta:
            stats["noPrice"] += len(tevs)
            continue
        (s_dates, s_closes), _detail = got
        bname = "default" if market == "us" else ("kosdaq" if meta.get("market") == "kosdaq" else "kospi")
        cal, bcl = benches[bname]
        rs, rb, sc = align_returns(cal, bcl, s_dates, s_closes)
        last_close = s_closes[-1]
        cur_cap = float(meta.get("marketCapB") or 0) or None
        sec_name = str(meta.get("sector") or "기타")
        if sec_name not in sector_idx:
            sector_idx[sec_name] = len(sectors)
            sectors.append(sec_name)
        sidx = sector_idx[sec_name]
        # 유형별 0일 인덱스(대조 날짜 배제용 · 424B5 연속 제출 정리)
        placed = []
        for e in sorted(tevs, key=lambda x: x["d"]):
            i0 = day0_index(cal, e["d"], e.get("tm") or "unk")
            if i0 is None:
                stats["noWindow"] += 1
                continue
            placed.append((e, i0))
        idx_by_type: dict[str, list] = {}
        for e, i0 in placed:
            idx_by_type.setdefault(e["k"], []).append(i0)
        surprises = []
        if market == "us":
            for h in (_detail or {}).get("earningsHistory") or []:
                if h.get("date") and h.get("surprisePct") is not None:
                    surprises.append((str(h["date"])[:10], float(h["surprisePct"])))
        last_424 = -10**9
        seen_day0 = set()
        for e, i0 in placed:
            # 같은 유형·같은 0일은 한 번만(13D 공동 신고인 각각의 제출, 같은 날 8-K 여러 건 등)
            if (e["k"], i0) in seen_day0:
                stats["deduped"] += 1
                continue
            seen_day0.add((e["k"], i0))
            if e["k"] == "us_424b5":
                if i0 - last_424 < 20:
                    stats["deduped"] += 1
                    continue
                last_424 = i0
            ma, mm, bad = event_paths(rs, rb, i0)
            if ma is None:
                stats["badPrice" if bad else "noWindow"] += 1
                continue
            j = pick_control(rs, rb, idx_by_type.get(e["k"], [i0]), f"{e['k']}|{t}|{e['d']}")
            cma = None
            cd0 = None
            if j is not None:
                cma, _ = car_points(rs, rb, j, None)
                if cma is not None:
                    cd0 = cal[j]
            prev = sc[i0 - 1] if i0 >= 1 else None
            cap_at = round(cur_cap * prev / last_close, 3) if (cur_cap and prev and last_close) else None
            sz = e.get("sz")
            if e["k"] == "us_earn" and sz is None and surprises:
                ed = date.fromisoformat(e["d"])
                near = [(abs((date.fromisoformat(d) - ed).days), v) for d, v in surprises]
                near = [x for x in near if x[0] <= 3]
                if near:
                    sz = round(min(near)[1], 2)
            if sz is None and e.get("amt") and cap_at:
                # 금액 ÷ 이벤트 시점 시총(US: 달러 ÷ $B, KR: 원 ÷ 조원)
                denom = cap_at * (1e9 if market == "us" else 1e12)
                sz = round(float(e["amt"]) / denom * 100, 3) if denom else None
            # 저장 크기를 줄이려고: 날짜는 DAY_BASE 부터의 일수, 시장모형 경로는 시장조정과의 차이(mmd),
            # 이벤트일은 0일과의 일수 차(dd, 보통 0 또는 −1). 브라우저 core 가 되돌린다.
            d0n = day_num(cal[i0])
            mmd = None if mm is None else [None if (a is None or b is None) else b - a for a, b in zip(ma, mm)]
            row = [t, d0n, TM_CODE.get(e.get("tm") or "unk", "u"), round_cap(market, cap_at), sidx, sz, ma, mmd,
                   day_num(cd0) if cd0 else None, cma, day_num(e["d"]) - d0n]
            rows_by_type.setdefault(e["k"], []).append(row)
            post = lambda p: (None if ma[POINTS.index(p)] is None else ma[POINTS.index(p)] - ma[POINTS.index(-1)])
            tk_rows.setdefault(t, []).append([e["k"], d0n, post(1), post(5), post(20), post(60)])
            stats["kept"] += 1
    bench_info = {name: {"ticker": BENCH[market][name][0], "label": BENCH[market][name][1],
                         "first": benches[name][0][0], "last": benches[name][0][-1]} for name in BENCH[market]}
    return rows_by_type, tk_rows, sectors, stats, bench_info


def tk_shard(ticker: str) -> int:
    return zlib.crc32(str(ticker).encode("utf-8")) % TK_SHARDS


def build_outputs(results: dict, archives: dict) -> tuple[dict, list[str]]:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    written = []
    types_out = []
    files = {}
    markets = {}
    for m, (rows_by_type, tk_rows, sectors, stats, bench_info) in results.items():
        for t in [x for x in TYPES if x["m"] == m]:
            rows = sorted(rows_by_type.get(t["k"], []), key=lambda r: (r[1], r[0]))
            fname = f"{t['k']}.json"
            payload = {"v": 1, "m": m, "k": t["k"], "points": POINTS, "scale": SCALE,
                       "dayBase": DAY_BASE.isoformat(),
                       "fields": ["t", "d0", "tm", "capAt", "sector", "size", "ma", "mmd", "cd0", "cma", "dd"], "rows": rows}
            text = json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"
            atomic_write_text(OUT_DIR / fname, text)
            written.append(f"data/event_study/{fname}")
            files[t["k"]] = {"file": f"data/event_study/{fname}", "bytes": len(text.encode("utf-8"))}
            dates = [(DAY_BASE + timedelta(days=r[1])).isoformat() for r in rows]
            srcs = [e for e in archives[m].get("events", []) if e.get("k") == t["k"]]
            types_out.append({
                "m": m, "k": t["k"], "label": t["label"], "group": t["group"], "desc": t["desc"], "timing": t["timing"],
                "link": t.get("link"), "size": t.get("size"), "accrual": bool(t.get("accrual")),
                "n": len(rows), "nMM": sum(1 for r in rows if r[7] is not None),
                "nSize": sum(1 for r in rows if r[5] is not None), "nControl": sum(1 for r in rows if r[9] is not None),
                "collected": len(srcs), "first": dates[0] if dates else None, "last": dates[-1] if dates else None,
                "file": files[t["k"]]["file"], "bytes": files[t["k"]]["bytes"],
            })
        # 종목별 요약 샤드
        shards: list[dict] = [{} for _ in range(TK_SHARDS)]
        for t, rows in tk_rows.items():
            shards[tk_shard(t)][t] = sorted(rows, key=lambda r: r[1], reverse=True)
        (OUT_DIR / "tk").mkdir(parents=True, exist_ok=True)
        for i, sh in enumerate(shards):
            fname = f"tk/{m}_{i:02d}.json"
            atomic_write_text(OUT_DIR / fname, json.dumps({"v": 1, "m": m, "dayBase": DAY_BASE.isoformat(), "fields": ["k", "d0", "car1", "car5", "car20", "car60"], "t": sh},
                                                          ensure_ascii=False, separators=(",", ":")) + "\n")
            written.append(f"data/event_study/{fname}")
        caps = US_CAP_BUCKETS if m == "us" else KR_CAP_BUCKETS
        a = archives[m]
        markets[m] = {
            "sectors": sectors, "capBuckets": [lab for _, lab in caps],
            "capUnit": "$B" if m == "us" else "조원", "benchmarks": bench_info, "stats": stats,
            "universe": a.get("universe"), "collectedAtKst": a.get("secFetchedAtKst") if m == "us" else a.get("dartFetchedAtKst"),
            "dartMissing": a.get("dartMissing") if m == "kr" else None,
        }
    index = {
        "updatedAtKst": now_kst_str(),
        "source": "SEC EDGAR submissions · DART 공시 목록 · Mir 공시 데이터(적립) · 가격: 종목 상세 일봉(Yahoo)",
        "points": POINTS, "scale": SCALE, "pre": PRE, "post": POST, "tkShards": TK_SHARDS, "dayBase": DAY_BASE.isoformat(),
        "count": sum(t["n"] for t in types_out),
        "method": {
            "ma": "시장조정: 종목 일간 수익률 − 벤치마크 일간 수익률(US SPY · KR 코스피 종목 KODEX 200, 코스닥 종목 KODEX 코스닥150).",
            "mm": f"시장모형: 추정창 {EST_FROM}~{EST_TO} 거래일 OLS α·β 로 기대수익을 뺌(관측 {EST_MIN}일 미만이면 제외).",
            "day0": "US 는 SEC 접수 시각이 미 동부 16:00 이후면 다음 거래일을 0일로, 그 전이면 당일(장 전 접수 포함). KR·날짜만 있는 이벤트는 공시일(휴장일이면 다음 거래일)이 0일 — 장 마감 뒤 공시면 반응이 +1일에 난다.",
            "car": f"CAR = −{PRE}일부터 누적한 일간 초과수익의 합. 화면의 '0일부터'·'+1일부터'는 그 전날까지의 누적을 빼 다시 맞춘 값.",
            "control": f"대조군: 같은 종목의 무작위 날짜 1개(같은 유형 이벤트에서 ±{CONTROL_GAP}거래일 밖, 결정적 시드)를 같은 방식으로 계산.",
            "ci": "95% 구간: 0일 날짜 단위 묶음 부트스트랩 2,000회(표본 5,000건 초과는 1,000회) — 같은 날 몰린 이벤트는 시장 움직임을 공유하므로 날짜째로 뽑는다.",
            "guard": f"일간 초과수익 절댓값이 {int(MAX_ABS_DAILY_AR * 100)}%를 넘는 경로는 가격 오류로 보고 제외. 같은 종목·같은 유형·같은 0일은 1건만(13D 공동 신고 등), 424B5 는 20거래일 안 연속 제출 중 첫 건만.",
        },
        "limits": [
            "가격 이력은 현재 추적 중인 종목의 약 5년 일봉뿐이다 — 상장폐지·합병으로 사라진 종목의 이벤트는 빠져 결과가 좋게 치우칠 수 있다(생존편향).",
            "시총 구간은 현재 시총 × (이벤트 전날 종가 ÷ 현재 종가)로 근사했다(주식 수 변화 무시).",
            "적립형 유형(내부자 클러스터·US 자사주)과 KR 크기 속성은 수집을 시작한 2026-09 이후 표본만 있다.",
            "수수료·세금·슬리피지 미반영. 과거 평균 반응은 미래를 보장하지 않으며 매매 신호가 아니다.",
        ],
        "markets": markets,
        "types": types_out,
    }
    return index, written


# ================================================================== main
def main() -> int:
    ap = argparse.ArgumentParser(description="이벤트 스터디 사전 계산")
    ap.add_argument("--market", choices=["us", "kr", "all"], default="all")
    ap.add_argument("--no-fetch", action="store_true", help="수집 없이 아카이브로 경로만 재계산")
    ap.add_argument("--us-top", type=int, default=1200, help="US 시총 상위 N 종목(실측 이력·비ETF)")
    ap.add_argument("--kr-quarters", type=int, default=6, help="이번 실행에서 받을 DART 분기 수(최근 2분기 포함)")
    ap.add_argument("--pct-budget", type=int, default=300, help="13D 지분율 XML 조회 상한")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()

    markets = ["us", "kr"] if args.market == "all" else [args.market]
    archives, healthy = {}, True
    for m in ("us", "kr"):
        archives[m] = read_json(ARCHIVE_DIR / f"{m}.json", {"market": m, "events": []}) or {"market": m, "events": []}
    for m in markets:
        if args.no_fetch:
            continue
        before = len(archives[m].get("events", []))
        try:
            new, ok = (collect_us if m == "us" else collect_kr)(archives[m], args)
        except SystemExit:
            raise
        except Exception as exc:
            print(f"[{m}] 수집 실패: {exc} — 기존 아카이브 유지")
            new, ok = archives[m], False
        if len(new.get("events", [])) < before:
            print(f"[{m}] 이벤트가 {before} → {len(new.get('events', []))} 로 줄었다 — 아카이브를 덮지 않는다")
            ok = False
        else:
            archives[m] = {**new, "market": m, "updatedAtKst": now_kst_str()}
        healthy = healthy and ok

    results = {}
    for m in ("us", "kr"):
        if not archives[m].get("events"):
            print(f"[{m}] 아카이브가 비어 경로를 만들 수 없다")
            continue
        results[m] = compute_market(m, archives[m])
        st = results[m][3]
        print(f"[{m}] 경로 {st['kept']:,} / 이벤트 {st['events']:,} (가격 없음 {st['noPrice']:,} · 창 부족 {st['noWindow']:,} · 가격 오류 {st['badPrice']:,} · 중복·424B5 연속 {st['deduped']:,})")
    if not results:
        return 1

    prev = read_json(OUT_JSON, {}) or {}
    with repository_publish_lock(ROOT):
        # 빈 시장은 직전 인덱스의 그 시장 유형을 잃지 않도록 결과가 있는 시장만 새로 쓴다.
        index, written = build_outputs(results, archives)
        if len(results) < 2 and prev.get("types"):
            keep = [t for t in prev["types"] if t["m"] not in results]
            index["types"] = keep + index["types"]
            for m, info in (prev.get("markets") or {}).items():
                index["markets"].setdefault(m, info)
            index["count"] = sum(t["n"] for t in index["types"])
        if prev.get("count") and index["count"] < prev["count"] * 0.7:
            print(f"[실패] 표본 {prev['count']:,} → {index['count']:,} 로 30% 넘게 줄었다 — 인덱스를 덮지 않는다")
            return 1
        for m in markets:
            write_json(ARCHIVE_DIR / f"{m}.json", archives[m])
            written.append(f"data/event_study_archive/{m}.json")
        # 인덱스는 마지막 — 유형 파일이 다 써진 뒤에만 새 기준 시각을 가리킨다. 0건·30% 넘는 감소는 write_data 도 막는다.
        sec.write_data(OUT_JSON, OUT_JS, "EVENT_STUDY_INDEX", index, indent=None, min_ratio=0.7)
        written +=["data/event_study/index.json", "data/event_study/index.js"]
        total_mb = sum((ROOT / p).stat().st_size for p in written if (ROOT / p).exists()) / 1e6
        print(f"[event-study] 유형 {len(index['types'])} · 표본 {index['count']:,} · 파일 {len(written)}개 {total_mb:.1f}MB")
        if args.push:
            if not sec.git_publish(["data/event_study", "data/event_study_archive"], "event study"):
                print("[실패] git 게시 실패")
                return 1
    return 0 if healthy else 1


if __name__ == "__main__":
    raise SystemExit(main())
