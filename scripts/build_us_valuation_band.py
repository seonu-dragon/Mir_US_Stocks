#!/usr/bin/env python3
"""미국 PER·PBR·PSR 밴드 — 종목별 월말 배수 약 5년 (SEC 공시 재무 + 야후 일봉에서 산출).

종목 분석 화면의 'PER·PBR 밴드' 카드(valuation-band.js)가 국내와 같은 샤드 모양으로 읽는다.
밴드 = 과거 배수 분위(10/25/50/75/90%) × 그 달 주당 이익·순자산·매출이고, 현재 배수가 자기 과거
분포의 몇 % 위치인지 보여 준다. **과거 범위 안의 위치일 뿐 평균 회귀를 보장하지 않는다.**

새 외부 호출 없음 — 이미 레포에 있는 파일만 읽는다:
  재무  data/financials/<T>.json   (build_financials_us.py, SEC XBRL. 스키마는 financials_common.py)
  가격  data/details/<T>.json      chartSeries(야후 일봉 약 5년, 분할 조정 종가 · 배당 미반영)
  기준  data/details/SPY.json      검증의 벤치마크

배수 산출(각 월말 거래일 D, 그 달 마지막 종가 P):
  - **시점 기준(룩어헤드 방지)**: D 까지 제출된(filed ≤ D) 공시의 값만 쓴다. filed 는 스키마에
    있다(그 기간 값이 처음 실린 공시 제출일). 없으면 기말+45일(분기)·+75일(연간)로 근사하고
    meta.filedApproxRows 에 센다. 한계: 값 자체는 이후 공시에서 정정·재표시된 숫자일 수 있다.
  - 이익·매출(흐름): 연속 4분기 합(TTM)과 연간(FY) 중 D 까지 공시된 것 가운데 기말이 가장 최근인
    것. 분기가 최근 12개뿐이라 그 이전 구간은 연간 값이 계단식으로 쓰인다(국내 KRX 와 같은 모양).
    기말이 D 보다 400일 넘게 오래되면 결측.
  - PER = P ÷ (TTM 지배주주 순이익 ÷ 가중평균 희석 주식수) — 희석 EPS 를 공시 EPS 가 아니라 순이익과
    희석 주식수로 다시 만든다. 공시 EPS 는 분할 전후 기준이 행마다 섞여 있고 4분기 EPS 는 빼기로 만든
    근사(d)라서다. 순이익 ≤ 0 이면 -1(적자, 차트에서 끊김).
  - PBR = P × 기말 발행주식수 ÷ 자본총계(지배주주). 자본잠식(≤0)이면 결측.
  - PSR = P × 기말 발행주식수 ÷ TTM 매출. 금융업(industryType ≠ general)은 매출 정의가 달라 결측.

액면분할: 야후 종가는 분할 조정돼 있지만 SEC 주식수는 공시 당시 기준이고, 한 행 안에서도 필드마다
기준이 다를 수 있다(AAPL FY2018: 기말 주식수는 분할 전 4.75B, 희석 평균은 재표시된 20.0B).
주식수 관측치를 최근 → 과거로 이어 가며 직전(더 최근) 관측치 대비 비율이 표준 분할 비율(2·3·4·5·
10·20… 또는 역수)에 12% 안으로 맞고 **같은 구간 자본총계는 그만큼 변하지 않았을 때만** 분할로 보고
현재 기준으로 환산한다(대규모 유상증자·합병은 자본도 함께 늘어난다). 맨 앞 기준은 현재 시가총액 ÷
종가(details fundamentals, 나스닥)로, 마지막 공시 뒤 분할도 잡는다. 이 기준과 최근 공시 주식수가
분할 비율로도 맞지 않으면(복수 종류주·ADR 등) 그 종목은 계산하지 않는다.

계산하지 않는 종목(meta.excluded 에 사유 코드, 카드는 사유 한 줄):
  foreign   해외발행인(20-F/40-F) — 분기 없음·통화 불일치·ADR 주식 기준
  currency  재무 통화 ≠ USD
  shares    현재 시가총액과 공시 주식수 기준이 맞지 않음
  nohist    일봉 이력 없음(스팩·신규 상장 등)
  price     분할 미조정 의심(하루 새 2.5배 넘는 급변)
  few       유효 월 부족(PER·PBR·PSR 모두 24개월 미만)

검증(매 실행 재계산, 메타에 저장): 매월 '자기 과거 PBR 분포(최소 24개월) 하위 20%' 종목군의
이후 3·12개월 수익률 중앙값 − 같은 기간 SPY 수익률. 월 블록 부트스트랩 97.5% 구간(두 기간
본페로니). **대상이 지금 살아 있는 종목뿐이라 생존편향이 크고**, 약 5년 표본이라 12개월은 2년 남짓의
시작 월만 남는다 — 화면에 그대로 적는다.

산출물:
  data/valuation_band/meta.{json,js}   (window.US_VALUATION_BAND_META — 기간·검증·샤드 수·제외 사유)
  data/valuation_band/sNN.json         (샤드 32개, 국내와 같은 모양 + PSR 배열 "s")

실행: py scripts/build_us_valuation_band.py [--push] [--only AAPL,NVDA] [--dry-run]
"""

from __future__ import annotations

import argparse
import datetime
import json
import math
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import sec_client as sec  # noqa: E402
from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402
from financials_common import quarters_consecutive, safe_file_name  # noqa: E402

FIN_DIR = ROOT / "data" / "financials"
DETAILS_DIR = ROOT / "data" / "details"
OUT_DIR = ROOT / "data" / "valuation_band"
OUT_JSON = OUT_DIR / "meta.json"
OUT_JS = OUT_DIR / "meta.js"
JS_VAR = "US_VALUATION_BAND_META"
REL_DIR = "data/valuation_band"
SHARDS = 32
BENCH = "SPY"
MIN_POINTS = 24           # 카드가 밴드를 그리는 최소 유효 월(valuation-band-core.js minPoints 와 같게)
STALE_DAYS = 400          # 자본총계·주식수의 기말이 이보다 오래되면 그 달은 결측
# 이익·매출은 '그 시점에 나와 있었을 가장 최근 기간' 이어야 한다. 기말 + 135일쯤이면 다음 분기 공시
# (10-Q 기한 40~45일)가 이미 나왔을 때라, 그보다 오래된 값은 우리가 그 분기를 못 가진 것이다
# (분기는 최근 12개뿐). 재무 파일이 주간 갱신이라 한 달 늦을 수 있어 165일까지 허용한다. 그 달은 결측으로 둔다 — 1년 넘게 늦은 연간 EPS 로 채우면 과거 PER 이
# 부풀어(AAPL 2021-09: 43배 vs 실제 TTM 28배) 현재 위치가 '싸 보이는' 쪽으로 기운다.
FLOW_FRESH_DAYS = 165
FILED_APPROX_Q = 45       # filed 가 없을 때 근사(10-Q 기한)
FILED_APPROX_A = 75       # filed 가 없을 때 근사(10-K 기한 60~90일)
SOURCE = "SEC EDGAR XBRL 재무(공시일 기준) + 야후 일봉 월말 종가 — 배수는 Mir 산출"

# 표준 분할 비율(정·역). 한 구간(관측치 사이)의 새 분할은 흔한 비율만 본다 — 촘촘하게 두면
# 희석 평균·기말 주식수의 몇 % 차이 때문에 10 대신 9·12 같은 헛값이 골라진다(SMCI 실측).
_SINGLE = (1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 10, 15, 20, 25, 30, 40, 50, 100)
SPLIT_RATIOS = tuple(sorted(set(_SINGLE) | {1 / k for k in _SINGLE}))
SPLIT_TOL = 0.12          # 비율이 표준값에서 이만큼 안이면 분할 후보
ANCHOR_TOL = 0.30         # 현재 시총 기준 ÷ 최근 공시 주식수가 1 에서 이만큼 안이면 같은 기준(분할은 1.5배부터)


# ---------------------------------------------------------------- 공통 순수 함수
def shard_of(code: str, n: int = SHARDS) -> int:
    """티커 → 샤드 번호. valuation-band-core.js 의 shardOf 와 1:1 같아야 한다."""
    h = 0
    for ch in str(code):
        h = (h * 31 + ord(ch)) % 1000003
    return h % n


def _date(s):
    try:
        return datetime.date.fromisoformat(str(s)[:10])
    except (TypeError, ValueError):
        return None


def _num(v):
    if v is None or isinstance(v, bool):
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if math.isfinite(f) else None


def _median(xs):
    s = sorted(xs)
    n = len(s)
    if not n:
        return float("nan")
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2


def own_percentile(history: list[float], value: float) -> float:
    """value 가 history 안에서 몇 분위인지(0~1, 동점은 절반)."""
    if not history:
        return float("nan")
    below = sum(1 for v in history if v < value)
    equal = sum(1 for v in history if v == value)
    return (below + 0.5 * equal) / len(history)


def nearest_split_ratio(r: float) -> float | None:
    """r 이 표준 분할 비율 하나에 SPLIT_TOL 안으로 맞으면 그 비율, 아니면 None."""
    if not r or r <= 0:
        return None
    best, best_err = None, SPLIT_TOL
    for k in SPLIT_RATIOS:
        err = abs(r / k - 1)
        if err <= best_err:
            best, best_err = k, err
    return best


def filed_date(row: dict, *, quarterly: bool, counter: list | None = None):
    """행의 공시일. 없으면 기말+45/75일 근사(counter 에 1 을 더한다)."""
    d = _date(row.get("filed"))
    if d:
        return d
    end = _date(row.get("end"))
    if not end:
        return None
    if counter is not None:
        counter[0] += 1
    return end + datetime.timedelta(days=FILED_APPROX_Q if quarterly else FILED_APPROX_A)


# ---------------------------------------------------------------- 가격
def month_end_closes(chart_series) -> tuple[dict, str | None]:
    """chartSeries([o,h,l,c,v,date]) → ({"YYYY-MM": (date, close)}, 문제 사유|None).

    그 달 마지막 봉의 종가. 하루 새 2.5배 넘게 뛰거나 0.4배 밑으로 빠진 봉이 있으면 분할이
    소급 조정되지 않은 이력일 수 있어 사유 'price' 를 돌려준다(대형주에서 정상적으로는 드물다)."""
    out: dict = {}
    prev = None
    for bar in chart_series or []:
        if not bar or len(bar) < 6:
            continue
        c, d = _num(bar[3]), _date(bar[5])
        if not c or c <= 0 or not d:
            continue
        if prev and not (0.4 <= c / prev <= 2.5):
            return {}, "price"
        prev = c
        out[f"{d.year:04d}-{d.month:02d}"] = (d, c)
    return out, None


def load_detail(ticker: str) -> dict | None:
    p = DETAILS_DIR / f"{safe_file_name(ticker)}.json"
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None


# ---------------------------------------------------------------- 재무 → 시점별 값
def flow_points(fin: dict, counter: list | None = None) -> list[dict]:
    """TTM(연속 4분기 합)과 연간 행을 하나의 목록으로: {end, filed, net, rev, dil, basis}.

    TTM 의 filed 는 네 분기 중 가장 늦은 공시일(마지막 분기가 나온 날). dil 은 마지막 분기의
    가중평균 희석 주식수(4분기 행은 빼기 불가라 결측 → 앞 분기 값), 연간은 연간 희석 평균."""
    pts = []
    q = [r for r in (fin.get("quarterly") or []) if r.get("end")]
    for i in range(3, len(q)):
        win = q[i - 3: i + 1]
        if not all(quarters_consecutive(win[j], win[j + 1]) for j in range(3)):
            continue
        filed = [filed_date(r, quarterly=True, counter=counter) for r in win]
        if any(f is None for f in filed):
            continue
        net = [_num(r.get("net")) for r in win]
        rev = [_num(r.get("rev")) for r in win]
        pts.append({
            "end": _date(win[-1]["end"]), "filed": max(filed),
            "net": sum(net) if all(v is not None for v in net) else None,
            "rev": sum(rev) if all(v is not None for v in rev) else None,
            # 네 분기 각각의 가중평균 희석 주식수(원값). 환산 뒤 평균 → TTM 희석 주식수.
            "dilRaw": [(_date(r["end"]), _num(r.get("sharesDilAvg"))) for r in win if _num(r.get("sharesDilAvg"))],
            "basis": "4Q",
        })
    for r in fin.get("annual") or []:
        end = _date(r.get("end"))
        f = filed_date(r, quarterly=False, counter=counter)
        if not end or not f:
            continue
        pts.append({"end": end, "filed": f, "net": _num(r.get("net")), "rev": _num(r.get("rev")),
                    "dilRaw": [(end, _num(r.get("sharesDilAvg")))] if _num(r.get("sharesDilAvg")) else [],
                    "basis": "FY"})
    return pts


def equity_points(fin: dict, counter: list | None = None) -> list[tuple]:
    """[(end, filed, equity)] — 연간·분기 행 모두."""
    out = []
    for quarterly, rows in ((False, fin.get("annual") or []), (True, fin.get("quarterly") or [])):
        for r in rows:
            end, eq = _date(r.get("end")), _num(r.get("equity"))
            f = filed_date(r, quarterly=quarterly, counter=counter)
            if end and f and eq is not None:
                out.append((end, f, eq))
    return out


def share_observations(fin: dict, counter: list | None = None) -> list[dict]:
    """주식수 관측치 [{end, filed, v, kind: out|dil}] — 연간·분기의 기말 발행주식수와 희석 평균."""
    obs = []
    for quarterly, rows in ((False, fin.get("annual") or []), (True, fin.get("quarterly") or [])):
        for r in rows:
            end = _date(r.get("end"))
            f = filed_date(r, quarterly=quarterly, counter=None)
            if not end or not f:
                continue
            for kind, key in (("out", "sharesOut"), ("dil", "sharesDilAvg")):
                v = _num(r.get(key))
                if v and v > 0:
                    obs.append({"end": end, "filed": f, "v": v, "kind": kind})
    return obs


def _equity_near(eq_pts: list[tuple], end: datetime.date):
    """기말이 end 와 같은(없으면 가장 가까운 20일 안) 자본총계."""
    best, best_d = None, 21
    for e, _f, v in eq_pts:
        d = abs((e - end).days)
        if d < best_d:
            best, best_d = v, d
    return best


def normalize_shares(obs: list[dict], eq_pts: list[tuple], anchor: float | None):
    """주식수 관측치를 현재(야후 분할 조정 종가와 같은) 기준으로 환산.

    반환: (환산 관측치 목록, 감지한 분할 [(날짜, 비율)], 실패 사유|None).
    최근 → 과거로 가며 누적 배율 K 를 들고 간다. 관측치 × K 가 직전(더 최근) 환산값과 0.75~1.33배
    안이면 K 그대로, 아니면 그 비율이 표준 분할 비율에 맞고 같은 구간 자본총계 변화가 그 비율의
    절반(로그)보다 작을 때만 K 에 곱한다(대규모 발행·합병은 자본도 함께 움직인다). 한 기말 안에서
    필드마다 기준이 다른 경우(AAPL FY2018)도 같은 규칙으로 되돌아온다."""
    if not obs:
        return [], [], "shares"
    order = sorted(obs, key=lambda o: (o["end"], o["kind"] == "out"), reverse=True)
    latest = next((o for o in order if o["kind"] == "out"), order[0])
    K = 1.0
    if anchor and anchor > 0:
        r = anchor / latest["v"]
        if abs(r - 1) > ANCHOR_TOL:
            k = nearest_split_ratio(r)
            if not k or k == 1:
                return [], [], "shares"
            K = k  # 마지막 공시 뒤 분할
    splits = [(latest["end"], K)] if K != 1 else []
    ref_v, ref_end = latest["v"] * K, latest["end"]
    out = []
    for o in order:
        r = ref_v / (o["v"] * K)
        if not 0.75 <= r <= 1.33:
            j = nearest_split_ratio(r)
            if j is not None:
                eq_ref, eq_obs = _equity_near(eq_pts, ref_end), _equity_near(eq_pts, o["end"])
                if eq_ref and eq_obs and eq_ref > 0 and eq_obs > 0                         and abs(math.log(eq_ref / eq_obs)) > 0.5 * abs(math.log(j)):
                    j = None  # 자본도 같이 움직임 → 분할이 아니라 실제 발행·소각
            if j is None:
                if 0.5 <= r <= 2.0:
                    pass      # 큰 폭의 실제 주식수 변화 — 배율 유지
                else:
                    continue  # 분할로도 정상 변동으로도 설명 안 되는 관측치는 버린다
            else:
                K *= j
                if o["kind"] == "out":
                    splits.append((o["end"], round(K, 4)))
        nv = o["v"] * K
        out.append({**o, "n": nv})
        ref_v, ref_end = nv, o["end"]
    return out, splits, None


def _latest_as_of(items, d, key_end="end", key_filed="filed"):
    best = None
    for it in items:
        if it[key_filed] <= d and (best is None or it[key_end] > best[key_end]):
            best = it
    return best


def monthly_multiples(fin: dict, closes: dict, months: list[str], anchor: float | None,
                      counter: list | None = None):
    """월별 (c, p, b, s) 배열과 진단 정보. 실패면 (None, 사유)."""
    general = (fin.get("industryType") or "general") == "general"
    eq_pts = equity_points(fin, counter)
    # 표시 기간보다 한참 전(첫 달 − 450일) 관측치는 쓰이지 않는다 — 사슬에서 빼 오판 기회를 줄인다.
    first = closes[min(closes)][0] if closes else None
    obs = [o for o in share_observations(fin)
           if first is None or o["end"] >= first - datetime.timedelta(days=450)]
    norm, splits, why = normalize_shares(obs, eq_pts, anchor)
    if why:
        return None, why
    # 흐름 포인트의 희석 주식수도 같은 환산을 받는다(같은 기말·같은 원값의 dil 관측치 배율).
    # 흐름 포인트의 희석 주식수도 같은 환산을 받는다(같은 기말·같은 원값의 환산 관측치). 버려진
    # 관측치(단위 오류 등, 예: WAT 2026 분기 82B)는 빠지고 남은 분기만 평균한다.
    dil_n = {(o["end"], o["v"]): o["n"] for o in norm if o["kind"] == "dil"}
    pts = []
    for p in flow_points(fin, counter):
        vals = [dil_n[key] for key in p["dilRaw"] if key in dil_n]
        pts.append({**p, "dil": sum(vals) / len(vals) if vals else None})
    outs = [o for o in norm if o["kind"] == "out"]
    dils = [o for o in norm if o["kind"] == "dil"]
    eqs = [{"end": e, "filed": f, "v": v} for e, f, v in eq_pts]
    C, P, B, S = [], [], [], []
    for m in months:
        cd = closes.get(m)
        if not cd:
            C.append(None); P.append(None); B.append(None); S.append(None)
            continue
        d, c = cd
        fresh = lambda it: it is not None and (d - it["end"]).days <= STALE_DAYS  # noqa: E731
        fp = _latest_as_of(pts, d)
        so = _latest_as_of(outs, d)
        sd = _latest_as_of(dils, d)
        eq = _latest_as_of(eqs, d)
        so = so if fresh(so) else None
        sd = sd if fresh(sd) else None
        # 기말 발행주식수를 태그로 안 내는 회사(META 등 복수 종류주)는 희석 평균으로 대신한다.
        so = so or sd
        per = pbr = psr = None
        fp = fp if fp is not None and (d - fp["end"]).days <= FLOW_FRESH_DAYS else None
        if fp and fp["net"] is not None:
            dil = fp["dil"] or (sd["n"] if sd else None) or (so["n"] if so else None)
            if fp["net"] <= 0:
                per = -1
            elif dil:
                per = c * dil / fp["net"]
        if so and fresh(eq) and eq["v"] > 0:
            pbr = c * so["n"] / eq["v"]
        if general and so and fp and fp["rev"] and fp["rev"] > 0:
            psr = c * so["n"] / fp["rev"]
        C.append(round(c, 2))
        P.append(-1 if per == -1 else (None if per is None else round(per, 2)))
        B.append(None if pbr is None else round(pbr, 3 if pbr < 1 else 2))
        S.append(None if psr is None else round(psr, 3 if psr < 1 else 2))
    info = {"splits": [(d.isoformat(), k) for d, k in splits]}
    return {"c": C, "p": P, "b": B, "s": S}, info


def exclusion_reason(fin: dict) -> str | None:
    flags = set(fin.get("flags") or [])
    if flags & {"foreignFiler", "adrShareBasis"}:
        return "foreign"
    if (fin.get("currency") or "USD") != "USD" or "nonUsdReporting" in flags:
        return "currency"
    return None


def valid_count(arr) -> int:
    return sum(1 for v in arr if isinstance(v, (int, float)) and v > 0)


# ---------------------------------------------------------------- 검증
def block_bootstrap_ci(diffs: list[float], blk: int, rng: random.Random, alpha_tail: float, n_boot=2000):
    """길이 blk 의 원형 블록 부트스트랩 평균 분포에서 (하한, 상한). 겹치는 창의 자기상관을 보존한다."""
    n = len(diffs)
    boots = []
    for _ in range(n_boot):
        acc, k = 0.0, 0
        while k < n:
            start = rng.randrange(n)
            for j in range(blk):
                if k >= n:
                    break
                acc += diffs[(start + j) % n]
                k += 1
        boots.append(acc / n)
    boots.sort()
    return boots[int(math.floor(alpha_tail * n_boot))], boots[int(math.ceil((1 - alpha_tail) * n_boot)) - 1]


def _verdict(lo, hi):
    return "우위" if lo > 0 else ("열위" if hi < 0 else "엣지 없음")


def validate_low_pbr(months: list[str], series: dict, bench: list, *, horizons=(3, 12), min_hist=24,
                     q=0.20, min_group=10, n_boot=2000, seed=20260926) -> dict:
    """'자기 과거 PBR 하위 q' 종목군의 이후 수익률 중앙값 − 같은 기간 SPY 수익률.

    series: {code: {"c": [...], "b": [...]}}, bench: SPY 월말 종가(months 와 같은 길이).
    미래 정보 없음 — t 시점 분위는 0..t 의 PBR 만으로 계산한다. SPY(시총 가중) 대비는 '중앙값 종목
    vs 대형주' 차이까지 섞이므로, 같은 달 전체 대상 중앙값 대비(국내 검증과 같은 정의)도 함께 낸다."""
    T = len(months)
    out = {"rule": f"자기 과거 PBR 분포(최소 {min_hist}개월) 하위 {int(q * 100)}%",
           "metric": f"이후 수익률 중앙값 − 같은 기간 {BENCH} 수익률", "bench": BENCH,
           "benchLabel": f"같은 기간 {BENCH}", "horizons": {}}
    rng = random.Random(seed)
    alpha_tail = 0.05 / 2 / len(horizons)
    for h in horizons:
        diffs, udiffs, dates, n_sig, n_all = [], [], [], 0, 0
        for t in range(min_hist - 1, T - h):
            b0, b1 = bench[t], bench[t + h]
            if not b0 or not b1:
                continue
            bret = b1 / b0 - 1
            sig, allr = [], []
            for s in series.values():
                c, b = s["c"], s["b"]
                bt, c0, c1 = b[t], c[t], c[t + h]
                if not bt or not c0 or not c1 or bt <= 0 or c0 <= 0 or c1 <= 0:
                    continue
                hist = [v for v in b[: t + 1] if v and v > 0]
                if len(hist) < min_hist:
                    continue
                ret = c1 / c0 - 1
                allr.append(ret)
                if own_percentile(hist, bt) <= q:
                    sig.append(ret)
            if len(sig) >= min_group and len(allr) >= min_group * 3:
                diffs.append(_median(sig) - bret)
                udiffs.append(_median(sig) - _median(allr))
                dates.append(months[t])
                n_sig += len(sig)
                n_all += len(allr)
        if len(diffs) < 12:
            out["horizons"][f"{h}m"] = {"months": len(diffs), "insufficient": True}
            continue
        blk = max(1, h)
        lo, hi = block_bootstrap_ci(diffs, blk, rng, alpha_tail, n_boot)
        ulo, uhi = block_bootstrap_ci(udiffs, blk, rng, alpha_tail, n_boot)
        mean, umean = sum(diffs) / len(diffs), sum(udiffs) / len(udiffs)
        out["horizons"][f"{h}m"] = {
            "months": len(diffs), "from": dates[0], "to": dates[-1],
            "signalObs": n_sig, "universeObs": n_all,
            "meanExcessPct": round(mean * 100, 2),
            "ciLowPct": round(lo * 100, 2), "ciHighPct": round(hi * 100, 2),
            "hitRatePct": round(sum(1 for d in diffs if d > 0) / len(diffs) * 100, 1),
            "verdict": _verdict(lo, hi),
            "vsUniverse": {"meanExcessPct": round(umean * 100, 2), "ciLowPct": round(ulo * 100, 2),
                           "ciHighPct": round(uhi * 100, 2), "verdict": _verdict(ulo, uhi)},
        }
    return out


# ---------------------------------------------------------------- 실행
def month_list(first: str, last: str) -> list[str]:
    y, m = int(first[:4]), int(first[5:7])
    out = []
    while True:
        key = f"{y:04d}-{m:02d}"
        if key > last:
            return out
        out.append(key)
        m += 1
        if m > 12:
            y, m = y + 1, 1


def anchor_shares(detail: dict, last_close: float | None) -> float | None:
    """현재 기준 주식수 = 시가총액 ÷ 종가(나스닥 fundamentals). 없으면 sharesB."""
    f = (detail or {}).get("fundamentals") or {}
    mc = _num(f.get("marketCapB"))
    if mc and last_close:
        return mc * 1e9 / last_close
    sb = _num(f.get("sharesB"))
    return sb * 1e9 if sb else None


def load_index_tickers() -> list[str]:
    idx = ROOT / "data" / "financials_index.json"
    try:
        tickers = list((json.loads(idx.read_text(encoding="utf-8")).get("tickers") or {}).keys())
    except Exception:
        tickers = []
    if not tickers:
        tickers = sorted(p.stem.lstrip("_") for p in FIN_DIR.glob("*.json"))
    return sorted(tickers)


def build(only: list[str] | None = None, verbose=False):
    tickers = only or load_index_tickers()
    spy = load_detail(BENCH)
    spy_closes, _ = month_end_closes((spy or {}).get("chartSeries"))
    if len(spy_closes) < 36:
        raise SystemExit(f"  [실패] {BENCH} 일봉이 없다 — 기간 기준을 못 정한다")
    # 기간: SPY 일봉의 첫 달 ~ 마지막 '끝난' 달(마지막 봉이 든 달은 아직 월말이 아니다).
    keys = sorted(spy_closes)
    last_bar_month = keys[-1]
    months = [k for k in month_list(keys[0], last_bar_month) if k < last_bar_month]
    counter = [0]
    series, excluded, splits_seen = {}, {}, {}
    for t in tickers:
        p = FIN_DIR / f"{safe_file_name(t)}.json"
        try:
            fin = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        why = exclusion_reason(fin)
        if why:
            excluded[t] = why
            continue
        detail = load_detail(t)
        closes, why = month_end_closes((detail or {}).get("chartSeries"))
        if why or not closes:
            excluded[t] = why or "nohist"
            continue
        last_close = closes[max(closes)][1]
        res, info = monthly_multiples(fin, closes, months, anchor_shares(detail, last_close), counter)
        if res is None:
            excluded[t] = info
            continue
        if max(valid_count(res["p"]), valid_count(res["b"]), valid_count(res["s"])) < MIN_POINTS:
            excluded[t] = "few"
            continue
        series[t] = res
        if info["splits"]:
            splits_seen[t] = info["splits"]
        if verbose:
            print(f"  {t}: 분할 {info['splits']} · PER {res['p'][-3:]} · PBR {res['b'][-3:]} · PSR {res['s'][-3:]}")
    bench = [spy_closes.get(m, (None, None))[1] for m in months]
    last_date = spy_closes[months[-1]][0].isoformat() if months and months[-1] in spy_closes else None
    return months, series, excluded, splits_seen, bench, counter[0], last_date


def shard_payloads(months, series):
    shards = [{"m0": months[0], "n": len(months), "t": {}} for _ in range(SHARDS)]
    for code in sorted(series):
        shards[shard_of(code)]["t"][code] = series[code]
    return shards


def write_all(months, series, meta_extra, *, push):
    shards = shard_payloads(months, series)
    count = sum(len(s["t"]) for s in shards)
    prev_count = 0
    if OUT_JSON.exists():
        try:
            prev_count = int(json.loads(OUT_JSON.read_text(encoding="utf-8")).get("count") or 0)
        except Exception:
            prev_count = 0
    if count == 0 or (prev_count and count < prev_count * 0.7):
        print(f"  [실패] 종목 수 {prev_count} → {count} — 기존 파일 유지")
        raise SystemExit(1)
    meta = {"updatedAtKst": sec.kst_now_str(), "source": SOURCE, "months": months,
            "count": count, "shards": SHARDS, **meta_extra}
    rel = []
    with repository_publish_lock(ROOT):
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        for i, sh in enumerate(shards):
            f = OUT_DIR / f"s{i:02d}.json"
            atomic_write_text(f, json.dumps(sh, ensure_ascii=False, separators=(",", ":")) + "\n")
            rel.append(f"{REL_DIR}/{f.name}")
        # 메타는 마지막 — 샤드가 다 써진 뒤에만 새 기간을 가리킨다.
        sec.write_data(OUT_JSON, OUT_JS, "US_VALUATION_BAND_META", meta, indent=None)
        rel += [f"{REL_DIR}/meta.json", f"{REL_DIR}/meta.js"]
        print(f"Wrote {OUT_DIR} — {count}종목 · {months[0]}~{months[-1]} ({len(months)}개월)")
        if push and not sec.git_publish(rel, "US valuation band (PER/PBR/PSR)"):
            print("  [실패] git 게시 실패 — 발행되지 않았다")
            raise SystemExit(1)


def main():
    ap = argparse.ArgumentParser(description="US PER·PBR·PSR 밴드(SEC 재무 + 야후 일봉 산출)")
    ap.add_argument("--push", action="store_true", default=False)
    ap.add_argument("--only", default="", help="쉼표로 구분한 티커만(확인용, 쓰지 않음)")
    ap.add_argument("--dry-run", action="store_true", help="계산만 하고 쓰지 않는다")
    args = ap.parse_args()
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    print("=== US PER·PBR·PSR 밴드 ===")
    only = [t.strip().upper() for t in args.only.split(",") if t.strip()] or None
    months, series, excluded, splits_seen, bench, approx, last_date = build(only, verbose=bool(only))
    reasons: dict = {}
    for why in excluded.values():
        reasons[why] = reasons.get(why, 0) + 1
    print(f"  대상 {len(series)} · 제외 {len(excluded)} {reasons} · 분할 감지 {len(splits_seen)}종목 · filed 근사 {approx}행")
    if only or args.dry_run:
        return
    print("  검증: 자기 과거 PBR 하위 20% → 이후 3·12개월, SPY 대비")
    validation = validate_low_pbr(months, series, bench)
    validation["tickers"] = len(series)
    validation["computedAtKst"] = sec.kst_now_str()
    validation["caveat"] = ("지금 상장된 종목만 대상이라 생존편향이 큽니다. 약 5년 일봉이라 표본이 짧고, "
                            "재무 값은 이후 정정된 숫자일 수 있습니다. 예측이 아닙니다.")
    print("   ", json.dumps(validation["horizons"], ensure_ascii=False))
    write_all(months, series, {
        "lastDate": last_date,
        "lastMonth": months[-1],
        "validation": validation,
        "excluded": dict(sorted(excluded.items())),
        "excludedCounts": reasons,
        "splitAdjusted": len(splits_seen),
        "filedApproxRows": approx,
        "multiples": ["per", "pbr", "psr"],
    }, push=args.push)


if __name__ == "__main__":
    main()
