#!/usr/bin/env python3
"""펀더멘털 지표 이상치 규칙 — 한 곳에 모은다(2026-09-26).

map_fundamentals(US·KR) 를 만들 때 build_map_fundamentals.py 가 이 규칙을 적용하고,
브라우저는 같은 규칙을 fundamentals-sanity-core.js(window.MirFundSanity) 로 다시 적용한다
(이미 배포된 data/ 파일에도 즉시 효과가 나도록). 두 쪽의 경계 표(PLAUSIBLE)·규칙은
scripts/tests/test_fundamentals_sanity.py 가 같은지 검사한다.

원칙: 값을 지어내지 않는다. 세 부류로만 다룬다.

1) 정의상 의미 없는 값 → 결측(키 삭제)
   - 무한대·NaN: 야후 trailingPE 가 EPS 0 일 때 "Infinity" 를 준다(CAES). json.dumps 가
     Infinity 를 그대로 써서 map_fundamentals.json 이 JSON.parse 로 안 읽히는 파일이 된다.
   - 배수(PER·선행 PER·PEG·PSR·PBR·P/FCF·EV/EBITDA·EV/EBIT) ≤ 0: 분모(이익·자본·EBITDA·
     매출)가 0 이하라 배수가 정의되지 않는다. 음수 PER 을 남기면 히트맵 구간표에서 가장
     낮은 칸(= '싸다', 초록)으로 칠해진다(KR 네이버 PER 은 적자에 음수를 준다 — 331종목).
     0 은 반올림·0 나누기 흔적이다(US MAIR pe 0.0 = EPS 단위 오류).
   - 부채비율·배당성향·배당수익률·유동비율 < 0: 분모(자본·순이익)가 음수라는 뜻이다
     (자본잠식 부채비율 -4706%, 적자 기업 배당성향 -1612%). 의미 있는 비율이 아니다.
   - ROE: 자본 ≤ 0 이면 정의되지 않는다. 음(-)의 순이익 / 음(-)의 자본 = 양수 ROE 로
     '우수' 로 읽힌다(GIBO +160%). 자본을 아는 빌더에선 equityB ≤ 0(반올림으로 0 이 된
     극소 자본 포함 — SNDA 643,445%, QURE -99,985%)을, 모르는 곳(브라우저)에선 PBR < 0
     또는 부채비율 < 0 을 자본잠식 신호로 쓴다.
   - 순이익률: 매출 ≤ 0(반올림으로 0 = 미국 50만 달러·한국 5천만 원 미만)이면 분모가
     0 이다(LYEL -762,356%, VSA +165,080%). 빌더에서만 판정 가능.
   - 나스닥 eps 표의 결측 표식 -999.0 이 그대로 EPS 로 합산됐다(BEPC·SIFY). 표식은 결측.
   - ROA: |ROA| > 1000% = 순이익이 총자산의 10배 이상. 실제 기업에서 나오기 어렵고
     순이익·총자산이 서로 다른 소스·통화·단위에서 온 경우다(KR 950160 외국 상장사
     -64,200%, US GIBO -23,200%). 1000% 이하는 실제일 수 있어 남긴다.

2) 단위 오류 → 원인(update_data.py)을 고친다. 여기서 추측 변환하지 않는다.
   - 나스닥 eps 표를 1~3개 분기만 있어도 합쳐 TTM 이라 불렀다(MAIR 한 분기 83088). 4개 분기가
     다 있을 때만 합한다.
   - 야후 dividendYield 는 이미 % 인데 0~1 이면 ×100 했다(HIFS 0.85% → 85%, AAPL 0.32 → 32%).
   - 야후 returnOnEquity·마진은 항상 비율인데 |x| > 1.5 면 그대로 둬 150% 넘는 ROE 가
     1.5% 로 줄었다(AAPL 1.49 는 통과, 1.6 이면 1.6%).
   - 야후 currentRatio 는 배수(1.0)인데 나스닥·DART 는 %(100) 다 — 야후분을 %로 맞춘다.

3) 극단값이지만 실제일 수 있는 값 → 남긴다. 대신 '이상치 가능' 경계(PLAUSIBLE) 밖이면
   화면이 표시하고, 정렬은 경계 안 값 뒤로, 평균·백분위는 경계로 눌러(윈저라이즈) 쓴다.
   경계는 '이 밖이면 분모가 0 근처거나 단위 오류일 가능성이 크다' 는 실무 감각의 값이다
   (분포상 백분위가 아니라 고정값 — 시장·날짜마다 기준이 흔들리지 않게). 예: 콜게이트
   ROE 3,948% 는 자사주 매입으로 자본이 극히 작아서 실제로 계산되는 값이지만, 수익성
   비교에서 맨 위를 차지할 이유는 없다.
"""

from __future__ import annotations

import math

# 0 이하면 정의되지 않는 배수(→ 결측)
POSITIVE_ONLY = ("pe", "forwardPE", "peg", "ps", "pb", "pfcf", "evEbitda", "evEbit")
# 음수면 정의되지 않는 비율(→ 결측). 0 은 의미가 있다(무배당·무부채).
NON_NEGATIVE = ("debtRatio", "payoutRatio", "divYield", "currentRatio")
# 이 크기를 넘으면 단위·소스 불일치로만 설명된다(→ 결측)
HARD_ABS_LIMIT = {"roa": 1000}
# 소스가 '결측' 대신 넣는 표식 값(→ 결측). 나스닥 eps 표의 -999.0(BEPC·SIFY epsTtm -999).
SENTINELS = {"eps": [-999.0]}

# '이상치 가능' 경계 [하한, 상한] (None = 그쪽 경계 없음). 값은 남기고 표시·정렬·평균에서만 쓴다.
# fundamentals-sanity-core.js 의 PLAUSIBLE 과 같아야 한다(테스트가 검사).
PLAUSIBLE = {
    "pe": [None, 1000],
    "forwardPE": [None, 1000],
    "peg": [None, 50],
    "ps": [None, 200],
    "pb": [None, 100],
    "pfcf": [None, 1000],
    "evEbitda": [None, 1000],
    "evEbit": [None, 1000],
    "divYield": [None, 30],
    "payoutRatio": [None, 500],
    "roe": [-300, 300],
    "roa": [-100, 100],
    "netMargin": [-300, 300],
    "revenueGrowth": [-100, 1000],
    "operatingGrowth": [-1000, 1000],
    "netGrowth": [-1000, 1000],
    "debtRatio": [None, 2000],
    "currentRatio": [None, 5000],
    # 수식 스크리너 계산 필드(예상 EPS ÷ EPS(TTM) - 1). TTM 이 0 에 가까우면 폭발한다.
    "epsGrowthEst": [-200, 1000],
}


def _finite(v):
    if isinstance(v, bool) or v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if math.isfinite(f) else None


def sanitize_row(row: dict, ctx: dict | None = None) -> list[str]:
    """map_fundamentals 한 행을 제자리에서 정리하고 지운 키 목록을 돌려준다.

    ctx: 빌더만 아는 원천 값 {"equityB", "salesB"} (없으면 브라우저와 같은 판정만 한다).
    """
    ctx = ctx or {}
    dropped: list[str] = []

    def drop(k):
        if k in row:
            del row[k]
            dropped.append(k)

    # 비숫자·무한대·NaN 은 먼저 지운다(그래야 아래 비교가 안전하다).
    for k in list(row.keys()):
        if isinstance(row[k], (int, float)) and not isinstance(row[k], bool) and _finite(row[k]) is None:
            drop(k)

    # 자본잠식 신호는 PBR·부채비율을 지우기 전에 읽는다.
    pb = _finite(row.get("pb"))
    debt_ratio = _finite(row.get("debtRatio"))
    equity = _finite(ctx.get("equityB"))
    neg_equity = (equity is not None and equity <= 0) or (pb is not None and pb < 0) \
        or (debt_ratio is not None and debt_ratio < 0)
    sales = _finite(ctx.get("salesB"))

    for k in POSITIVE_ONLY:
        v = _finite(row.get(k))
        if v is not None and v <= 0:
            drop(k)
    for k in NON_NEGATIVE:
        v = _finite(row.get(k))
        if v is not None and v < 0:
            drop(k)
    for k, marks in SENTINELS.items():
        v = _finite(row.get(k))
        if v is not None and v in marks:
            drop(k)
    for k, lim in HARD_ABS_LIMIT.items():
        v = _finite(row.get(k))
        if v is not None and abs(v) > lim:
            drop(k)
    if neg_equity and "roe" in row:
        drop("roe")
    if sales is not None and sales <= 0 and "netMargin" in row:
        drop("netMargin")
    return dropped


def is_outlier(key: str, v) -> bool:
    b = PLAUSIBLE.get(key)
    x = _finite(v)
    if not b or x is None:
        return False
    lo, hi = b
    return (lo is not None and x < lo) or (hi is not None and x > hi)


def winsor(key: str, v):
    x = _finite(v)
    b = PLAUSIBLE.get(key)
    if x is None or not b:
        return x
    lo, hi = b
    if lo is not None and x < lo:
        return float(lo)
    if hi is not None and x > hi:
        return float(hi)
    return x
