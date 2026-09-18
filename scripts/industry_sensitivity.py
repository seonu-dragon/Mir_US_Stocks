"""산업 선행지표 ↔ 종목 선행 상관 검증 하네스 — 기획서 8.1 (3차 재정의) 그대로.

"선행 N개월"을 화면에 올리려면 통과해야 하는 것:
  변환   지표는 겹치지 않는 변화율만(월간 MoM%·주간 WoW%, 레벨 지표는 차분). YoY 레벨은 쓰지 않는다.
         종목은 같은 주기의 수익률에서 섹터 ETF 수익률을 뺀 초과수익(시장 베타가 상관을 만들지 않게).
  표본   월간 n≥96, 주간 n≥260. 모자라면 '표본 부족'으로 숫자 없이 끝난다.
  탐색   지표가 앞서는 방향만 — lag 1~6개월(주간 1~8주). 동행·후행은 탐색하지 않는다.
  분할   시간순 전반 60% 에서 lag 를 고르고(한 번 고른 lag 는 파일에 고정), 후반 40% 를 한 번만 본다.
  통과   후반부에서 ① 전반부와 같은 부호 ② 유효표본 보정 t 검정 p < 0.05/후보 수
         (n_eff = n(1−r₁r₂)/(1+r₁r₂)) ③ 블록 부트스트랩(6개월/26주 블록, 2,000회) 95% 구간이 0 을 제외
  FDR    쌍 단위 통과 뒤 전체에 Benjamini-Hochberg 10%.
  기대   통과 쌍은 한 자릿수일 가능성이 높다 — 통과 0개가 기본 시나리오이고 제품은 거기 기대지 않는다.

외부 의존성 없음(순수 파이썬). 종목 일봉은 data/details/<T>.json · data/korea/details/<코드>.json 의
chartSeries([o,h,l,c,v,date], 약 5년)를 읽는다 — 5년이면 월간 n≥96 은 원천적으로 불가능하고 주간만
자격이 생긴다. 그게 맞다(적립형 소스가 몇 년 뒤에야 자격을 얻듯이).

산출: data/industry_sensitivity.json (+ .js window.INDUSTRY_SENSITIVITY) — 검사한 모든 쌍의 결과와
고정된 lag, 요약(검사·통과·표본 부족 수). 빌더가 통과 쌍만 related_tickers[].sensitivity 에 싣는다.
"""

from __future__ import annotations

import json
import math
import random
from datetime import date, datetime, timedelta
from pathlib import Path

MIN_N = {"M": 96, "W": 260}
LAGS = {"M": 6, "W": 8}
BLOCK = {"M": 6, "W": 26}
BOOT_DRAWS = 2000
TRAIN_FRAC = 0.6
MIN_OOS = {"M": 38, "W": 100}
FDR_Q = 0.10
ALPHA = 0.05


# ---------------------------------------------------------------------------
# 통계 기본기 (numpy·scipy 없이)
# ---------------------------------------------------------------------------
def pearson(x: list[float], y: list[float]) -> float | None:
    n = len(x)
    if n < 3 or n != len(y):
        return None
    mx, my = sum(x) / n, sum(y) / n
    sxx = sum((a - mx) ** 2 for a in x)
    syy = sum((b - my) ** 2 for b in y)
    if sxx <= 0 or syy <= 0:
        return None
    return sum((a - mx) * (b - my) for a, b in zip(x, y)) / math.sqrt(sxx * syy)


def autocorr1(x: list[float]) -> float:
    r = pearson(x[:-1], x[1:])
    return r if r is not None else 0.0


def effective_n(n: int, r1: float, r2: float) -> float:
    """Bartlett/Quenouille 보정 — 두 시계열의 1차 자기상관으로 독립 표본 수를 줄인다."""
    denom = 1 + r1 * r2
    if denom <= 0:
        return float(n)
    return max(3.0, n * (1 - r1 * r2) / denom)


def _betacf(a: float, b: float, x: float) -> float:
    """정규화 불완전 베타의 연분수(Numerical Recipes)."""
    max_it, eps, fpmin = 300, 3e-12, 1e-300
    qab, qap, qam = a + b, a + 1, a - 1
    c, d = 1.0, 1 - qab * x / qap
    d = 1 / (d if abs(d) > fpmin else fpmin)
    h = d
    for m in range(1, max_it + 1):
        m2 = 2 * m
        aa = m * (b - m) * x / ((qam + m2) * (a + m2))
        d = 1 + aa * d
        d = 1 / (d if abs(d) > fpmin else fpmin)
        c = 1 + aa / (c if abs(c) > fpmin else fpmin)
        h *= d * c
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
        d = 1 + aa * d
        d = 1 / (d if abs(d) > fpmin else fpmin)
        c = 1 + aa / (c if abs(c) > fpmin else fpmin)
        delta = d * c
        h *= delta
        if abs(delta - 1) < eps:
            break
    return h


def betainc(a: float, b: float, x: float) -> float:
    if x <= 0:
        return 0.0
    if x >= 1:
        return 1.0
    lbeta = math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b)
    front = math.exp(lbeta + a * math.log(x) + b * math.log(1 - x))
    if x < (a + 1) / (a + b + 2):
        return front * _betacf(a, b, x) / a
    return 1 - front * _betacf(b, a, 1 - x) / b


def t_pvalue_two_sided(t: float, df: float) -> float:
    """스튜던트 t 양측 p."""
    if df <= 0 or not math.isfinite(t):
        return 1.0
    x = df / (df + t * t)
    return max(0.0, min(1.0, betainc(df / 2, 0.5, x)))


def corr_pvalue(rho: float, n_eff: float) -> float:
    if rho is None or abs(rho) >= 1 or n_eff <= 2:
        return 1.0
    t = rho * math.sqrt((n_eff - 2) / (1 - rho * rho))
    return t_pvalue_two_sided(t, n_eff - 2)


def block_bootstrap_ci(x: list[float], y: list[float], block: int, draws: int = BOOT_DRAWS, seed: int = 20260918) -> tuple[float, float] | None:
    """순환 블록 부트스트랩 — (x,y) 쌍을 블록째로 재추출해 상관의 2.5·97.5 백분위."""
    n = len(x)
    if n < block * 2:
        return None
    rng = random.Random(seed)
    rhos = []
    nblocks = math.ceil(n / block)
    for _ in range(draws):
        xs, ys = [], []
        for _b in range(nblocks):
            start = rng.randrange(n)
            for k in range(block):
                i = (start + k) % n
                xs.append(x[i]); ys.append(y[i])
        r = pearson(xs[:n], ys[:n])
        if r is not None:
            rhos.append(r)
    if len(rhos) < draws // 2:
        return None
    rhos.sort()
    lo = rhos[int(0.025 * (len(rhos) - 1))]
    hi = rhos[int(0.975 * (len(rhos) - 1))]
    return (lo, hi)


def benjamini_hochberg(pvalues: list[float], q: float = FDR_Q) -> list[bool]:
    """BH — 통과 여부 리스트(입력 순서)."""
    m = len(pvalues)
    if not m:
        return []
    order = sorted(range(m), key=lambda i: pvalues[i])
    passed = [False] * m
    threshold_rank = 0
    for rank, i in enumerate(order, 1):
        if pvalues[i] <= q * rank / m:
            threshold_rank = rank
    for rank, i in enumerate(order, 1):
        if rank <= threshold_rank:
            passed[i] = True
    return passed


# ---------------------------------------------------------------------------
# 시계열 정렬
# ---------------------------------------------------------------------------
def _key_date(k: str) -> date:
    if "-Q" in k:
        y, q = k.split("-Q")
        return date(int(y), (int(q) - 1) * 3 + 1, 1)
    if len(k) == 7:
        return date(int(k[:4]), int(k[5:]), 1)
    return date.fromisoformat(k[:10])


def _period_key(d: date, freq: str) -> str:
    if freq == "M":
        return f"{d.year:04d}-{d.month:02d}"
    iso = d.isocalendar()
    return f"{iso[0]:04d}-W{iso[1]:02d}"


def last_per_period(series: list[tuple[str, float]], freq: str) -> list[tuple[str, float]]:
    out: dict[str, float] = {}
    for k, v in series:
        out[_period_key(_key_date(k), freq)] = v
    return sorted(out.items())


def changes(series: list[tuple[str, float]], mode: str) -> list[tuple[str, float]]:
    """겹치지 않는 변화율: mode='pct' → %, 'diff' → 차분. 연속 기간이 아니면(결측 달) 그 점은 뺀다."""
    out = []
    for (k0, v0), (k1, v1) in zip(series, series[1:]):
        if not _consecutive(k0, k1):
            continue
        if mode == "pct":
            if v0 == 0 or (v0 < 0) != (v1 < 0):
                continue
            out.append((k1, (v1 / v0 - 1) * 100))
        else:
            out.append((k1, v1 - v0))
    return out


def _consecutive(k0: str, k1: str) -> bool:
    if "-W" in k0:
        y0, w0 = k0.split("-W"); y1, w1 = k1.split("-W")
        d0 = date.fromisocalendar(int(y0), int(w0), 5); d1 = date.fromisocalendar(int(y1), int(w1), 5)
        return 6 <= (d1 - d0).days <= 8
    y0, m0 = int(k0[:4]), int(k0[5:]); y1, m1 = int(k1[:4]), int(k1[5:])
    return (y1 * 12 + m1) - (y0 * 12 + m0) == 1


def closes_from_detail(detail: dict) -> list[tuple[str, float]]:
    rows = detail.get("chartSeries") if isinstance(detail, dict) else None
    out = []
    for r in rows or []:
        try:
            if isinstance(r, list) and len(r) >= 6:
                out.append((str(r[5])[:10], float(r[3])))
            elif isinstance(r, dict):
                out.append((str(r.get("date") or r.get("t"))[:10], float(r.get("c"))))
        except (TypeError, ValueError):
            continue
    return sorted(k for k in out if len(k[0]) == 10 and math.isfinite(k[1]))


def excess_returns(stock: list[tuple[str, float]], bench: list[tuple[str, float]], freq: str) -> list[tuple[str, float]]:
    rs = dict(changes(last_per_period(stock, freq), "pct"))
    rb = dict(changes(last_per_period(bench, freq), "pct"))
    return sorted((k, rs[k] - rb[k]) for k in rs if k in rb)


def _shift_period(k: str, lag: int) -> str:
    """k 에서 lag 기간 **앞**(과거) 키."""
    if "-W" in k:
        y, w = k.split("-W")
        d = date.fromisocalendar(int(y), int(w), 5) - timedelta(weeks=lag)
        return _period_key(d, "W")
    y, m = int(k[:4]), int(k[5:])
    t = y * 12 + (m - 1) - lag
    return f"{t // 12:04d}-{t % 12 + 1:02d}"


def lagged_pairs(x: dict[str, float], y: list[tuple[str, float]], lag: int) -> tuple[list[float], list[float]]:
    xs, ys = [], []
    for k, yv in y:
        xk = _shift_period(k, lag)
        if xk in x:
            xs.append(x[xk]); ys.append(yv)
    return xs, ys


# ---------------------------------------------------------------------------
# 쌍 하나 평가
# ---------------------------------------------------------------------------
def evaluate_pair(ind_changes: list[tuple[str, float]], stock_excess: list[tuple[str, float]], freq: str,
                  fixed_lag: int | None = None, *, boot: bool = True) -> dict:
    """반환 dict 의 status: insufficient | rejected | validated. validated 만 화면에 숫자를 올린다."""
    x = dict(ind_changes)
    y = sorted(k for k in stock_excess if _shift_period(k[0], 1) in x or True)
    lags = list(range(1, LAGS[freq] + 1))
    # 정렬된 공통 표본(lag=1 기준으로 길이를 본다)
    xs1, ys1 = lagged_pairs(x, y, 1)
    n = len(xs1)
    if n < MIN_N[freq]:
        return {"status": "insufficient", "n": n, "need": MIN_N[freq], "freq": freq}
    split = int(n * TRAIN_FRAC)
    # 전반부에서 lag 선택(고정된 lag 가 있으면 재탐색하지 않는다)
    if fixed_lag is None:
        best, best_r = None, 0.0
        for lag in lags:
            xs, ys = lagged_pairs(x, y[:split], lag)
            r = pearson(xs, ys)
            if r is not None and abs(r) > abs(best_r):
                best, best_r = lag, r
        if best is None:
            return {"status": "rejected", "reason": "train_no_corr", "n": n, "freq": freq}
        lag, train_rho = best, best_r
    else:
        lag = fixed_lag
        xs, ys = lagged_pairs(x, y[:split], lag)
        train_rho = pearson(xs, ys) or 0.0
    xs, ys = lagged_pairs(x, y[split:], lag)
    n_oos = len(xs)
    if n_oos < MIN_OOS[freq]:
        return {"status": "insufficient", "n": n, "n_oos": n_oos, "need_oos": MIN_OOS[freq], "freq": freq, "lag": lag}
    rho = pearson(xs, ys)
    if rho is None:
        return {"status": "rejected", "reason": "oos_no_corr", "n": n, "freq": freq, "lag": lag}
    n_eff = effective_n(n_oos, autocorr1(xs), autocorr1(ys))
    p = corr_pvalue(rho, n_eff)
    out = {"status": "rejected", "freq": freq, "lag": lag, "train_rho": round(train_rho, 3), "oos_rho": round(rho, 3),
           "oos_n": n_oos, "n_eff": round(n_eff, 1), "p": p, "p_threshold": ALPHA / len(lags), "n": n, "ci95": None}
    if (rho > 0) != (train_rho > 0):
        out["reason"] = "sign_flip"
        return out
    if p >= ALPHA / len(lags):
        out["reason"] = "p"
        return out
    if boot:
        ci = block_bootstrap_ci(xs, ys, BLOCK[freq])
        out["ci95"] = [round(ci[0], 3), round(ci[1], 3)] if ci else None
        if not ci or (ci[0] <= 0 <= ci[1]):
            out["reason"] = "bootstrap_ci_includes_zero"
            return out
    out["status"] = "candidate"  # FDR 는 전체 쌍을 모아 한 번에
    return out


# ---------------------------------------------------------------------------
# 전체 실행
# ---------------------------------------------------------------------------
def indicator_changes(series: list[tuple[str, float]], ind_freq: str, basis: str) -> tuple[str, list[tuple[str, float]]]:
    """지표 → (평가 주기, 변화율). 월간·분기 지표는 월간(분기는 제외), 일·주간은 주간."""
    if ind_freq == "Q":
        return "M", []
    freq = "M" if ind_freq == "M" else "W"
    per = last_per_period(series, freq)
    return freq, changes(per, "pct" if basis == "yoy" else "diff")


def run(indicators: dict[str, dict], raw_series: dict[str, list[tuple[str, float]]], categories: list[dict],
        load_detail, previous: dict | None, *, today: date | None = None, boot: bool = True) -> dict:
    """indicators: 빌드된 지표 dict(related_tickers·frequency·regime_basis·categories 포함)
    raw_series: 지표 ID → 전체(상한 없는) 시계열. load_detail(market, key) → detail dict|None."""
    today = today or datetime.now().date()
    prev_pairs = (previous or {}).get("pairs") or {}
    cat_etf = {c["id"]: (c.get("sector_etfs") or [None])[0] for c in categories}
    bench_cache: dict[str, list[tuple[str, float]]] = {}
    stock_cache: dict[str, list[tuple[str, float]]] = {}

    def closes(market: str, key: str):
        ck = f"{market}:{key}"
        if ck not in stock_cache:
            stock_cache[ck] = closes_from_detail(load_detail(market, key) or {})
        return stock_cache[ck]

    pairs: dict[str, dict] = {}
    counts = {"tested": 0, "insufficient": 0, "rejected": 0, "candidate": 0, "validated": 0}
    for iid, ind in indicators.items():
        series = raw_series.get(iid)
        if not series:
            continue
        freq, x = indicator_changes(series, ind["frequency"], ind.get("regime_basis", "yoy"))
        if not x:
            continue
        cat = (ind.get("categories") or [None])[0]
        for r in ind.get("related_tickers") or []:
            market = r.get("market", "us")
            key = r.get("ticker") or r.get("code")
            bench_key = "069500" if market == "kr" else (cat_etf.get(cat) or "SPY")
            bench_market = "kr" if market == "kr" else "us"
            if key == bench_key:
                continue
            stock = closes(market, key)
            bench = closes(bench_market, bench_key)
            if len(stock) < 200 or len(bench) < 200:
                continue
            y = excess_returns(stock, bench, freq)
            pk = f"{iid}|{key}"
            fixed = (prev_pairs.get(pk) or {}).get("lag")
            res = evaluate_pair(x, y, freq, fixed_lag=fixed, boot=boot)
            res.update({"indicator": iid, "ticker": key, "market": market, "excess_vs": bench_key,
                        "transform": "mom_pct" if (freq == "M" and ind.get("regime_basis", "yoy") == "yoy") else
                                     "mom_diff" if freq == "M" else "wow_pct" if ind.get("regime_basis", "yoy") == "yoy" else "wow_diff",
                        "lag_fixed_at": (prev_pairs.get(pk) or {}).get("lag_fixed_at") or (today.isoformat() if res.get("lag") else None)})
            pairs[pk] = res
            counts["tested"] += 1
            counts[res["status"] if res["status"] in counts else "rejected"] += 1
    # FDR — 후보 쌍의 p 를 전체 검사 쌍(p 가 있는 것) 위에서 BH
    keys_with_p = [k for k, v in pairs.items() if v.get("p") is not None]
    passed = benjamini_hochberg([pairs[k]["p"] for k in keys_with_p]) if keys_with_p else []
    for k, ok in zip(keys_with_p, passed):
        v = pairs[k]
        if v["status"] == "candidate":
            if ok:
                v["status"] = "validated"
                counts["validated"] += 1
            else:
                v["status"] = "rejected"
                v["reason"] = "fdr"
            counts["candidate"] -= 1
            if not ok:
                counts["rejected"] += 1
    return {"asOf": today.isoformat(), "rule": "8.1 (2026-09-17 3차): 겹치지 않는 변화율 · 섹터 초과수익 · lag 전반 60% 고정 · 후반 40% 단회 · n_eff t 검정 · 블록 부트스트랩 · BH FDR 10%",
            "summary": counts, "pairs": pairs}


def attach_to_indicators(indicators: dict[str, dict], sens: dict) -> int:
    """통과 쌍만 related_tickers[].sensitivity 로. 미통과는 키 자체를 두지 않는다(숫자 없이 '관련 종목')."""
    n = 0
    pairs = (sens or {}).get("pairs") or {}
    for iid, ind in indicators.items():
        for r in ind.get("related_tickers") or []:
            r.pop("sensitivity", None)
            key = r.get("ticker") or r.get("code")
            v = pairs.get(f"{iid}|{key}")
            if v and v.get("status") == "validated":
                r["sensitivity"] = {"lag_months" if v["freq"] == "M" else "lag_weeks": v["lag"], "oos_rho": v["oos_rho"], "oos_n": v["oos_n"],
                                    "n_eff": v["n_eff"], "ci95": v["ci95"], "transform": v["transform"], "excess_vs": v["excess_vs"], "validated": True}
                n += 1
        ind["sensitivity_validated"] = sum(1 for r in ind.get("related_tickers") or [] if r.get("sensitivity"))
    return n
