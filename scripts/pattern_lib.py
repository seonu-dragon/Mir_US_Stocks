#!/usr/bin/env python3
"""차트 패턴 감지 공용 라이브러리 (pattern_lib.py)
================================================

고전 차트 패턴(쌍천장/쌍바닥, 헤드앤숄더/역헤드앤숄더, 삼각수렴, 지지/저항
돌파)을 **룰 기반**으로 감지한다. 신경망 학습이 아니라, 스윙 고저점(피벗) 사이의
기하학적 관계로 패턴을 정의하고, "패턴이 완성/확정된 봉"을 찾아낸다.

설계 원칙
---------
* 모든 패턴의 공통 빌딩블록은 **스윙 피벗(지그재그)** 이다.
* 패턴은 "확정 봉(confirm bar)"에서만 인정한다. 확정 = 넥라인(목선) 돌파처럼
  패턴이 완성된 시점. 이렇게 해야 미래 정보를 미리 보는 룩어헤드 편향을 피하고,
  오프라인 통계(전방 수익률)를 정직하게 측정할 수 있다.
* **이 파일의 알고리즘/상수는 브라우저 analysis.js 의 포팅본과 1:1로 동일해야 한다.**
  (그래야 과거 통계 base-rate 조회가 의미를 가진다.)

반환물(detect_confirmations): 각 확정 이벤트
    {"pattern": str, "dir": +1/-1, "confirm_idx": int, "neckline": float}
"""

from __future__ import annotations

# ===== 공용 상수 (JS 포팅본과 반드시 동일하게 유지) =====
PIVOT_WIN = 5          # 프랙탈 피벗 좌우 비교 창
TOP_TOL = 0.04         # 쌍천장/쌍바닥: 두 꼭지/바닥 높이 유사 허용 오차
TROUGH_MIN = 0.03      # 쌍천장/쌍바닥: 중간 골/봉우리 최소 깊이
SHOULDER_TOL = 0.06    # H&S: 좌우 어깨 높이 유사 허용 오차
HEAD_MIN = 0.02        # H&S: 머리가 어깨보다 최소 이만큼 높아야
CONFIRM_MAX_BARS = 40  # 마지막 피벗 후 넥라인 돌파까지 허용하는 최대 봉 수
FLAT_SLOPE = 0.0006    # 삼각형: 봉당 평균 대비 기울기 |s| < 이 값이면 "수평"
TRI_LOOKBACK = 90      # 삼각형 판정에 쓰는 최근 피벗 시간 창(봉)
SR_LOOKBACK = 120      # 지지/저항 수평선 산출 창
SR_TOL = 0.02          # 지지/저항 수평선 군집 허용 오차

HORIZONS = (5, 20, 60)   # 전방 수익률 측정 기간(거래일)
RECENT_WINDOW = 10       # 브라우저: 최근 N봉 내 확정된 패턴을 "현재 패턴"으로 본다

PATTERN_LABELS = {
    "double_top": "쌍천장(이중 천장)",
    "double_bottom": "쌍바닥(이중 바닥)",
    "hns": "헤드앤숄더(천장)",
    "inv_hns": "역헤드앤숄더(바닥)",
    "ascending_triangle": "상승 삼각수렴",
    "descending_triangle": "하락 삼각수렴",
    "symmetrical_triangle": "대칭 삼각수렴",
    "resistance_breakout": "저항선 돌파",
    "support_breakdown": "지지선 이탈",
}


# ----------------------------------------------------------------------------
# 0. 입력 정규화
# ----------------------------------------------------------------------------
def rows_from_chart_series(chart_series):
    """details json 의 chartSeries([[o,h,l,c,v,date], ...])를 dict 행으로 변환."""
    rows = []
    for r in chart_series:
        if not r or len(r) < 4:
            continue
        o, h, l, c = r[0], r[1], r[2], r[3]
        if c is None or not (c > 0):
            continue
        rows.append({
            "o": o, "h": h, "l": l, "c": c,
            "v": (r[4] if len(r) > 4 and r[4] else 0),
            "d": (r[5] if len(r) > 5 else None),
        })
    return rows


# ----------------------------------------------------------------------------
# 1. 스윙 피벗 + 지그재그
# ----------------------------------------------------------------------------
def find_pivots(rows, win=PIVOT_WIN):
    """프랙탈 피벗: 좌우 win봉보다 높으면 피벗고점(H), 낮으면 피벗저점(L)."""
    n = len(rows)
    pivots = []
    for i in range(win, n - win):
        hi = rows[i]["h"]
        lo = rows[i]["l"]
        is_high = True
        is_low = True
        for j in range(i - win, i + win + 1):
            if j == i:
                continue
            if rows[j]["h"] > hi:
                is_high = False
            if rows[j]["l"] < lo:
                is_low = False
        if is_high:
            pivots.append({"idx": i, "price": hi, "type": "H"})
        if is_low:
            pivots.append({"idx": i, "price": lo, "type": "L"})
    pivots.sort(key=lambda p: (p["idx"], 0 if p["type"] == "H" else 1))
    return pivots


def zigzag(pivots):
    """피벗을 고-저-고-저 교대 시퀀스로 정리. 같은 종류가 연속되면 더 극단값만 남긴다."""
    seq = []
    for p in pivots:
        if not seq:
            seq.append(dict(p))
            continue
        last = seq[-1]
        if p["type"] == last["type"]:
            if p["type"] == "H" and p["price"] >= last["price"]:
                seq[-1] = dict(p)
            elif p["type"] == "L" and p["price"] <= last["price"]:
                seq[-1] = dict(p)
        else:
            seq.append(dict(p))
    return seq


# ----------------------------------------------------------------------------
# 2. 확정(넥라인 돌파) 탐색 헬퍼
# ----------------------------------------------------------------------------
def _confirm_break(rows, start_idx, level, direction, invalidate_level):
    """start_idx 다음 봉부터 종가가 level 을 direction 방향으로 돌파하는 첫 봉을 찾는다.
    direction=-1: 종가 < level (하향 돌파) / +1: 종가 > level.
    그 전에 invalidate_level 을 반대로 크게 벗어나면 무효(None).
    """
    n = len(rows)
    end = min(n, start_idx + 1 + CONFIRM_MAX_BARS)
    for k in range(start_idx + 1, end):
        c = rows[k]["c"]
        if direction < 0:
            if invalidate_level is not None and c > invalidate_level:
                return None
            if c < level:
                return k
        else:
            if invalidate_level is not None and c < invalidate_level:
                return None
            if c > level:
                return k
    return None


def _line_at(x0, y0, x1, y1, x):
    if x1 == x0:
        return y0
    return y0 + (y1 - y0) * (x - x0) / (x1 - x0)


def _slope_pct(points):
    """(idx, price) 점들의 선형회귀 기울기를 평균가 대비 봉당 % 로."""
    n = len(points)
    if n < 2:
        return 0.0
    mx = sum(p[0] for p in points) / n
    my = sum(p[1] for p in points) / n
    if my == 0:
        return 0.0
    num = sum((p[0] - mx) * (p[1] - my) for p in points)
    den = sum((p[0] - mx) ** 2 for p in points)
    slope = (num / den) if den else 0.0
    return slope / my


# ----------------------------------------------------------------------------
# 3. 개별 패턴 감지 — 지그재그 위에서 슬라이딩
# ----------------------------------------------------------------------------
def _detect_double(rows, z):
    """쌍천장(H,L,H) / 쌍바닥(L,H,L)."""
    out = []
    for i in range(len(z) - 2):
        a, b, c = z[i], z[i + 1], z[i + 2]
        # 쌍천장: 고-저-고
        if a["type"] == "H" and b["type"] == "L" and c["type"] == "H":
            top = (a["price"] + c["price"]) / 2
            if top <= 0:
                continue
            if abs(a["price"] - c["price"]) / top <= TOP_TOL and \
               (top - b["price"]) / top >= TROUGH_MIN:
                neck = b["price"]
                ci = _confirm_break(rows, c["idx"], neck, -1, max(a["price"], c["price"]))
                if ci is not None:
                    out.append({"pattern": "double_top", "dir": -1,
                                "confirm_idx": ci, "neckline": neck})
        # 쌍바닥: 저-고-저
        if a["type"] == "L" and b["type"] == "H" and c["type"] == "L":
            bot = (a["price"] + c["price"]) / 2
            if bot <= 0:
                continue
            if abs(a["price"] - c["price"]) / bot <= TOP_TOL and \
               (b["price"] - bot) / bot >= TROUGH_MIN:
                neck = b["price"]
                ci = _confirm_break(rows, c["idx"], neck, +1, min(a["price"], c["price"]))
                if ci is not None:
                    out.append({"pattern": "double_bottom", "dir": +1,
                                "confirm_idx": ci, "neckline": neck})
    return out


def _detect_hns(rows, z):
    """헤드앤숄더(H,L,H,L,H) / 역헤드앤숄더(L,H,L,H,L)."""
    out = []
    for i in range(len(z) - 4):
        p = z[i:i + 5]
        types = "".join(x["type"] for x in p)
        if types == "HLHLH":
            ls, t1, head, t2, rs = p
            if head["price"] > ls["price"] and head["price"] > rs["price"]:
                sh = (ls["price"] + rs["price"]) / 2
                if sh > 0 and abs(ls["price"] - rs["price"]) / sh <= SHOULDER_TOL \
                   and (head["price"] - sh) / sh >= HEAD_MIN:
                    neck = _line_at(t1["idx"], t1["price"], t2["idx"], t2["price"], rs["idx"])
                    ci = _confirm_break(rows, rs["idx"], neck, -1, head["price"])
                    if ci is not None:
                        out.append({"pattern": "hns", "dir": -1,
                                    "confirm_idx": ci, "neckline": neck})
        elif types == "LHLHL":
            ls, t1, head, t2, rs = p
            if head["price"] < ls["price"] and head["price"] < rs["price"]:
                sh = (ls["price"] + rs["price"]) / 2
                if sh > 0 and abs(ls["price"] - rs["price"]) / sh <= SHOULDER_TOL \
                   and (sh - head["price"]) / sh >= HEAD_MIN:
                    neck = _line_at(t1["idx"], t1["price"], t2["idx"], t2["price"], rs["idx"])
                    ci = _confirm_break(rows, rs["idx"], neck, +1, head["price"])
                    if ci is not None:
                        out.append({"pattern": "inv_hns", "dir": +1,
                                    "confirm_idx": ci, "neckline": neck})
    return out


def _detect_triangle(rows, z):
    """삼각수렴: 최근 고점 2개 이상 + 저점 2개 이상의 추세선 기울기로 판정 후 돌파 확정."""
    out = []
    for end in range(4, len(z)):
        window = [p for p in z[:end + 1] if z[end]["idx"] - p["idx"] <= TRI_LOOKBACK]
        highs = [p for p in window if p["type"] == "H"]
        lows = [p for p in window if p["type"] == "L"]
        if len(highs) < 2 or len(lows) < 2:
            continue
        highs = highs[-3:]
        lows = lows[-3:]
        sh = _slope_pct([(p["idx"], p["price"]) for p in highs])
        sl = _slope_pct([(p["idx"], p["price"]) for p in lows])
        res = sum(p["price"] for p in highs) / len(highs)
        sup = sum(p["price"] for p in lows) / len(lows)
        if res <= sup:
            continue
        last_idx = max(highs[-1]["idx"], lows[-1]["idx"])
        flat_h = abs(sh) < FLAT_SLOPE
        flat_l = abs(sl) < FLAT_SLOPE
        pat = direction = neck = None
        if flat_h and sl > FLAT_SLOPE:          # 상승 삼각: 수평 저항 + 상승 저점
            pat, direction, neck = "ascending_triangle", +1, highs[-1]["price"]
        elif flat_l and sh < -FLAT_SLOPE:        # 하락 삼각: 수평 지지 + 하락 고점
            pat, direction, neck = "descending_triangle", -1, lows[-1]["price"]
        elif sh < -FLAT_SLOPE and sl > FLAT_SLOPE:  # 대칭 삼각: 수렴
            ci_up = _confirm_break(rows, last_idx, highs[-1]["price"], +1, None)
            ci_dn = _confirm_break(rows, last_idx, lows[-1]["price"], -1, None)
            if ci_up is not None and (ci_dn is None or ci_up <= ci_dn):
                out.append({"pattern": "symmetrical_triangle", "dir": +1,
                            "confirm_idx": ci_up, "neckline": highs[-1]["price"]})
            elif ci_dn is not None:
                out.append({"pattern": "symmetrical_triangle", "dir": -1,
                            "confirm_idx": ci_dn, "neckline": lows[-1]["price"]})
            continue
        if pat is not None:
            ci = _confirm_break(rows, last_idx, neck, direction, None)
            if ci is not None:
                out.append({"pattern": pat, "dir": direction,
                            "confirm_idx": ci, "neckline": neck})
    return out


def _detect_sr_breakout(rows, pivots):
    """지지/저항 수평선 돌파: 최근 창에서 군집된 피벗 고점(저항)/저점(지지)을
    종가가 돌파하는 첫 봉. 패턴 구조가 아니라 '레벨 돌파' 이벤트.

    슬라이딩 윈도 최대/최소(단조 덱)로 O(n)에 가깝게 계산한다. 각 봉 k 에서는
    idx 가 [k-SR_LOOKBACK, k-PIVOT_WIN) 인 과거 피벗만 사용해 룩어헤드를 막는다.
    """
    out = []
    n = len(rows)
    highs = [p for p in pivots if p["type"] == "H"]
    lows = [p for p in pivots if p["type"] == "L"]
    last_res_break = -1
    last_sup_break = -1
    hi_dq = []   # (idx, price) 단조 감소 — 최댓값
    lo_dq = []   # (idx, price) 단조 증가 — 최솟값
    hp = 0
    lp = 0
    for k in range(SR_LOOKBACK, n):
        # k-PIVOT_WIN 직전까지 형성된 피벗을 윈도에 편입
        while hp < len(highs) and highs[hp]["idx"] < k - PIVOT_WIN:
            pr = highs[hp]["price"]
            while hi_dq and hi_dq[-1][1] <= pr:
                hi_dq.pop()
            hi_dq.append((highs[hp]["idx"], pr))
            hp += 1
        while lp < len(lows) and lows[lp]["idx"] < k - PIVOT_WIN:
            pr = lows[lp]["price"]
            while lo_dq and lo_dq[-1][1] >= pr:
                lo_dq.pop()
            lo_dq.append((lows[lp]["idx"], pr))
            lp += 1
        # 윈도 좌측(오래된 피벗) 제거
        lo_bound = k - SR_LOOKBACK
        while hi_dq and hi_dq[0][0] < lo_bound:
            hi_dq.pop(0)
        while lo_dq and lo_dq[0][0] < lo_bound:
            lo_dq.pop(0)

        price = rows[k]["c"]
        prev = rows[k - 1]["c"]
        if hi_dq:
            res = hi_dq[0][1]
            if prev <= res < price and k - last_res_break > PIVOT_WIN:
                out.append({"pattern": "resistance_breakout", "dir": +1,
                            "confirm_idx": k, "neckline": res})
                last_res_break = k
        if lo_dq:
            sup = lo_dq[0][1]
            if prev >= sup > price and k - last_sup_break > PIVOT_WIN:
                out.append({"pattern": "support_breakdown", "dir": -1,
                            "confirm_idx": k, "neckline": sup})
                last_sup_break = k
    return out


# ----------------------------------------------------------------------------
# 4. 통합 진입점
# ----------------------------------------------------------------------------
def detect_confirmations(rows):
    """모든 패턴의 확정 이벤트를 confirm_idx 순으로 반환."""
    if len(rows) < PIVOT_WIN * 2 + 5:
        return []
    pivots = find_pivots(rows)
    z = zigzag(pivots)
    events = []
    events += _detect_double(rows, z)
    events += _detect_hns(rows, z)
    events += _detect_triangle(rows, z)
    events += _detect_sr_breakout(rows, pivots)

    # 같은 (pattern, confirm_idx) 중복 제거
    seen = set()
    uniq = []
    for e in sorted(events, key=lambda x: x["confirm_idx"]):
        key = (e["pattern"], e["confirm_idx"])
        if key in seen:
            continue
        seen.add(key)
        uniq.append(e)
    return uniq


def detect_current(rows):
    """브라우저용: 최근 RECENT_WINDOW봉 안에서 확정된 패턴들만 반환(최신 우선)."""
    n = len(rows)
    evs = [e for e in detect_confirmations(rows) if n - 1 - e["confirm_idx"] < RECENT_WINDOW]
    evs.sort(key=lambda e: e["confirm_idx"], reverse=True)
    return evs
