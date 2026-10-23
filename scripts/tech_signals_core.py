#!/usr/bin/env python3
"""기술적 신호 per-티커 파생값 — 순수 계산 모듈(파일·네트워크 없음).

빌더 `build_market_breadth.py` 가 이미 시장별 상세(details)의 일봉을 한 번 흘려 읽으므로,
그 순회 안에서 종목마다 아래 값을 함께 낸다. 테스트는 scripts/tests/test_tech_signals_core.py.

1) RS 등급(1~99) — IBD 식 '상대강도'
   가중 12개월 가격 성과를 시장 유니버스 안에서 백분위로 환산한다. 분기(63거래일) 단위로
   최근 분기에 가중을 더 준다:

       score = 0.4 × (최근 1분기 수익률) + 0.2 × (그 전 분기) + 0.2 × (그 전 분기) + 0.2 × (그 전 분기)

   즉 최근 3개월 40% + 직전 세 분기 각 20%(합 100%)다. 252거래일(약 1년) + 1봉이 없는 종목은
   등급을 내지 않는다(None) — 짧은 이력을 0 으로 채워 순위에 끼우지 않는다.
   등급은 같은 시장 유니버스 안 백분위를 1~99 로 선형 변환한 값이고, 동점은 같은 등급이다
   (formula-core.js percentileOf 와 같은 중간순위 규칙). 유니버스가 2종목 미만이면 None.

2) RS선(Relative Strength line) 신고가
   RS선 = 종가 ÷ 벤치마크 종가(미국 SPY · 국내 KODEX 200). 두 쪽 모두 봉이 있는 날만 쓴다.
   마지막 값이 직전 252개(약 52주) RS선 값보다 크면 'RS선 신고가'다. 그 날 주가 자체는
   52주 신고가가 아니면(= 주가보다 RS선이 먼저 신고가) 따로 표시한다.

3) 전일값·교차 — 수식 스크리너가 '어제'·'N일 전'·교차 조건을 쓸 수 있게 미리 계산한 값.
   SMA20/50·Wilder RSI(14)·MACD(12,26,9) 를 같은 봉으로 계산하고, 교차·신고가는
   '며칠 전에 일어났나'(0 = 당일, LOOKBACK 봉 안에 없으면 None)로 낸다. 불리언을 바로 굽지
   않는 건 화면에서 `...Within5` / `...Within3` 를 자유롭게 만들 수 있게 하려는 것이다.

RSI 는 update_data.py 의 rsi14 와 같은 Wilder 정의(앞 14봉 단순평균 시드 + 재귀 평활)지만
여기서는 빌더가 들고 있는 봉(약 292개)만 쓰므로 시드 시점이 달라 스냅샷 rsi14 와 소수점에서
어긋날 수 있다. 그래서 '당일 - 전일' 변화량도 같은 계산에서 함께 내보내 섞어 쓰지 않게 한다.
"""

from __future__ import annotations

QUARTER = 63            # 분기 = 거래일 63봉
RS_BARS = QUARTER * 4   # 252 — 가중 성과에 필요한 봉(+1 = 기준봉)
RS_WEIGHTS = (0.4, 0.2, 0.2, 0.2)   # 최근 분기부터
RS_WINDOW = 252         # RS선 신고가를 보는 창(약 52주)
LOOKBACK = 10           # 교차·신고가를 '며칠 전'으로 되짚는 최대 봉
RSI_PERIOD = 14
MACD_FAST, MACD_SLOW, MACD_SIGNAL = 12, 26, 9

COLS = ("rs", "rsnh", "rsnhb", "c1", "s20", "s20p", "s50", "s50p",
        "r14", "r14p", "xu20", "xd20", "xu50", "xd50", "nh20", "mxu", "mxd")


def _round(v, nd):
    return None if v is None else round(v, nd)


# ---------------------------------------------------------------- 1) RS 등급
def weighted_rs_score(closes):
    """가중 12개월 성과. closes = 종가 오름차순. 252+1 봉 미만이면 None.

    분기 수익률은 단순 수익률(끝/시작 − 1)이고, 0·음수 종가 구간이 있으면 None.
    """
    vals = [float(c) for c in closes]
    if len(vals) < RS_BARS + 1:
        return None
    tail = vals[-(RS_BARS + 1):]
    score = 0.0
    for q, w in enumerate(RS_WEIGHTS):
        # q=0 이 가장 최근 분기: [-(q+1)*63-1] → [-q*63-1]
        start = tail[len(tail) - 1 - (q + 1) * QUARTER]
        end = tail[len(tail) - 1 - q * QUARTER]
        if start <= 0 or end <= 0:
            return None
        score += w * (end / start - 1.0)
    return score


def percentile_ratings(scores):
    """점수 리스트 → 1~99 등급 리스트(None 은 그대로 None).

    백분위는 동점을 중간순위로 보는 formula-core.js percentileOf 와 같은 규칙이고,
    0~100 백분위를 1~99 로 선형 변환한다. 값이 있는 종목이 2개 미만이면 전부 None.
    """
    known = sorted(v for v in scores if v is not None)
    n = len(known)
    if n < 2:
        return [None] * len(scores)
    out = []
    for v in scores:
        if v is None:
            out.append(None)
            continue
        less = _lower_bound(known, v)
        equal = _upper_bound(known, v) - less
        frac = (less + (equal - 1) / 2) / (n - 1)
        out.append(max(1, min(99, round(1 + 98 * frac))))
    return out


def _lower_bound(sorted_vals, v):
    lo, hi = 0, len(sorted_vals)
    while lo < hi:
        mid = (lo + hi) // 2
        if sorted_vals[mid] < v:
            lo = mid + 1
        else:
            hi = mid
    return lo


def _upper_bound(sorted_vals, v):
    lo, hi = 0, len(sorted_vals)
    while lo < hi:
        mid = (lo + hi) // 2
        if sorted_vals[mid] <= v:
            lo = mid + 1
        else:
            hi = mid
    return lo


# ---------------------------------------------------------------- 2) RS선 신고가
def rs_line_flags(closes, bench_by_date):
    """RS선 신고가 판정. closes = [(날짜, 종가)] 오름차순, bench_by_date = {날짜: 벤치마크 종가}.

    반환 {"newHigh": bool|None, "beforePrice": bool|None, "bars": 쓴 RS선 봉 수}.
    두 쪽 모두 봉이 있는 날이 창(252)+1 미만이면 판정하지 않는다(None).
    """
    line, px = [], []
    for d, c in closes:
        b = bench_by_date.get(d)
        if b and b > 0 and c > 0:
            line.append(c / b)
            px.append(c)
    if len(line) < RS_WINDOW + 1:
        return {"newHigh": None, "beforePrice": None, "bars": len(line)}
    prior = line[-(RS_WINDOW + 1):-1]
    new_high = line[-1] > max(prior)
    price_prior = px[-(RS_WINDOW + 1):-1]
    price_high = px[-1] > max(price_prior)
    return {"newHigh": new_high, "beforePrice": bool(new_high and not price_high), "bars": len(line)}


# ---------------------------------------------------------------- 3) 지표 시리즈
def sma_series(values, n):
    """단순이동평균. 봉이 모자란 앞쪽은 None."""
    out, run = [], 0.0
    for i, v in enumerate(values):
        run += v
        if i >= n:
            run -= values[i - n]
        out.append(run / n if i >= n - 1 else None)
    return out


def rsi_series(values, period=RSI_PERIOD):
    """Wilder RSI — 앞 period 봉 변화의 단순평균으로 시드하고 재귀 평활(update_data.real_rsi14 과 같은 정의)."""
    out = [None] * len(values)
    if len(values) < period + 1:
        return out
    gain = loss = 0.0
    for i in range(1, period + 1):
        ch = values[i] - values[i - 1]
        gain += max(0.0, ch)
        loss += max(0.0, -ch)
    gain /= period
    loss /= period
    out[period] = _rsi_value(gain, loss)
    for i in range(period + 1, len(values)):
        ch = values[i] - values[i - 1]
        gain = (gain * (period - 1) + max(0.0, ch)) / period
        loss = (loss * (period - 1) + max(0.0, -ch)) / period
        out[i] = _rsi_value(gain, loss)
    return out


def _rsi_value(avg_gain, avg_loss):
    if not avg_loss:
        return 100.0 if avg_gain else 50.0
    return 100.0 - (100.0 / (1.0 + avg_gain / avg_loss))


def ema_series(values, span):
    k = 2 / (span + 1)
    out, cur = [], None
    for v in values:
        cur = v if cur is None else cur + k * (v - cur)
        out.append(cur)
    return out


def macd_series(values, fast=MACD_FAST, slow=MACD_SLOW, signal=MACD_SIGNAL):
    """MACD(12,26,9). slow 봉이 서기 전은 None, 시그널은 MACD 가 선 뒤부터 EMA."""
    if len(values) < slow + signal:
        return [None] * len(values), [None] * len(values)
    ef, es = ema_series(values, fast), ema_series(values, slow)
    macd = [None] * len(values)
    for i in range(slow - 1, len(values)):
        macd[i] = ef[i] - es[i]
    live = [m for m in macd if m is not None]
    sig_vals = ema_series(live, signal)
    sig = [None] * len(values)
    start = slow - 1
    for j, v in enumerate(sig_vals):
        if j >= signal - 1:
            sig[start + j] = v
    return macd, sig


# ---------------------------------------------------------------- 3b) 교차·신고가 되짚기
def bars_since_cross(a, b, up=True, lookback=LOOKBACK):
    """a 가 b 를 상향(up=True)/하향 교차한 지 몇 봉 전인가. 0 = 당일, lookback 안에 없으면 None.

    교차 = 직전 봉에서는 (a <= b) 이고 이 봉에서 (a > b) — 상향. 두 시리즈 모두 값이 있어야 한다.
    """
    n = min(len(a), len(b))
    for back in range(0, lookback + 1):
        i = n - 1 - back
        if i <= 0:
            break
        a0, b0, a1, b1 = a[i - 1], b[i - 1], a[i], b[i]
        if a0 is None or b0 is None or a1 is None or b1 is None:
            continue
        if up and a0 <= b0 and a1 > b1:
            return back
        if not up and a0 >= b0 and a1 < b1:
            return back
    return None


def bars_since_new_high(values, window=20, lookback=LOOKBACK):
    """직전 window 봉을 넘긴(신고가) 지 몇 봉 전인가. 0 = 당일, lookback 안에 없으면 None."""
    n = len(values)
    for back in range(0, lookback + 1):
        i = n - 1 - back
        if i < window:
            break
        if values[i] > max(values[i - window:i]):
            return back
    return None


# ---------------------------------------------------------------- 묶기
def derived_row(closes, bench_by_date=None):
    """한 종목의 파생값(COLS 중 rs 를 뺀 전부) + RS 점수. closes = [(날짜, 종가)] 오름차순.

    반환 {"score": 가중 성과|None, "row": {col: 값}} — row 는 COLS 순서로 꺼내 쓴다.
    """
    vals = [float(c) for _, c in closes]
    rs = rs_line_flags(closes, bench_by_date or {})
    s20, s50 = sma_series(vals, 20), sma_series(vals, 50)
    r14 = rsi_series(vals)
    macd, sig = macd_series(vals)
    row = {
        "rsnh": None if rs["newHigh"] is None else int(rs["newHigh"]),
        "rsnhb": None if rs["beforePrice"] is None else int(rs["beforePrice"]),
        "c1": _round(vals[-2], 4) if len(vals) >= 2 else None,
        "s20": _round(s20[-1], 4), "s20p": _round(s20[-2], 4) if len(s20) >= 2 else None,
        "s50": _round(s50[-1], 4), "s50p": _round(s50[-2], 4) if len(s50) >= 2 else None,
        "r14": _round(r14[-1], 2), "r14p": _round(r14[-2], 2) if len(r14) >= 2 else None,
        "xu20": bars_since_cross(vals, s20, True), "xd20": bars_since_cross(vals, s20, False),
        "xu50": bars_since_cross(vals, s50, True), "xd50": bars_since_cross(vals, s50, False),
        "nh20": bars_since_new_high(vals, 20),
        "mxu": bars_since_cross(macd, sig, True), "mxd": bars_since_cross(macd, sig, False),
    }
    return {"score": weighted_rs_score(vals), "row": row}


def pack(rows, scores):
    """rows = [derived_row()['row']], scores = 같은 순서의 RS 점수 → COLS 순 배열 리스트.

    값이 전부 None 인 종목은 뺄 수 있게 (배열, 값 있음 여부) 를 함께 돌려준다.
    """
    ratings = percentile_ratings(scores)
    out = []
    for rating, row in zip(ratings, rows):
        arr = [rating] + [row.get(c) for c in COLS[1:]]
        out.append(arr)
    return out
