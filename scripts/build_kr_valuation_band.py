#!/usr/bin/env python3
"""국내 PER·PBR 밴드 — 종목별 월말 PER/PBR/수정종가 10년 (KRX 공식값).

종목 분석 화면의 'PER·PBR 밴드' 패널이 읽는다(valuation-band.js). 밴드 = 과거 배수
분위(10/25/50/75/90%) × 그 시점 주당 이익·자산이고, 현재 배수가 자기 과거 분포의 몇 %
위치인지를 보여 준다. **과거 범위 안의 위치일 뿐 평균 회귀를 보장하지 않는다.**

수집 방식 — 종목별이 아니라 날짜별로 받는다:
  KRX 의 get_market_fundamental_by_ticker(날짜, "ALL") 한 번이 그날 전 종목의
  BPS/PER/PBR/EPS 를, get_market_cap_by_ticker(날짜, "ALL") 한 번이 종가·상장주식수를
  준다(각 ~0.7초, 2026-09-26 실측). 월말 거래일 120개 × 2콜이면 전 종목 10년이
  끝난다 — 종목별 range 조회(삼성전자 1종목 29초)로 500종목을 받는 것보다 KRX 부하가
  수백 배 작다. 증분 실행은 새로 끝난 달만 받는다(보통 0~2콜).
  단, 간격 없이 몰아 보내면 KRX 가 IP 를 1일 차단한다(2026-09-26 실측) — THROTTLE_S 참고.
  전체 재수집은 Actions 수동 실행(full=true)으로만 하고, 로컬에서 반복하지 말 것.

수정주가: KRX 종가는 수정 전이다. 상장주식수가 1.5배 넘게 변하면서 주가가 그 역수만큼
움직인 달(곱이 0.7~1.43)만 액면분할·병합으로 보고 과거 종가를 나눠 맞춘다. 유상증자처럼
주식수만 늘고 주가가 그대로인 달은 조정하지 않는다. PER·PBR 은 비율이라 분할과 무관하므로
밴드(= 수정종가 × 분위배수 ÷ 그 달 배수)는 이 조정과 무관하게 일관된다.

PER 부호 규약(샤드의 "p" 배열): 양수 = PER, -1 = 적자(EPS<0, KRX 가 PER 을 비움),
null = 자료 없음. PBR("b")은 양수 또는 null.

검증(--full 에서만, 메타에 저장): 매월 '자기 과거 PBR 분포(36개월 이상)의 하위 20%'
종목군의 이후 3·12개월 수익률 중앙값 − 같은 달 전체 대상 중앙값. 월 블록 부트스트랩
97.5% 구간(두 기간 본페로니). 상장폐지 종목은 그 시점 목록에 들어가지만 폐지 후 수익률이
없어 빠진다(생존편향 잔존) — 화면에 그대로 적는다.

산출물:
  data/korea/valuation_band/meta.{json,js}   (window.KR_VALUATION_BAND_META — 기간·검증·샤드 수)
  data/korea/valuation_band/sNN.json         (샤드 32개, 브라우저가 종목을 열 때 한 개만 fetch)

자격증명은 .env 의 KRX_ID/KRX_PW (Actions 는 Secrets).
실행: py scripts/build_kr_valuation_band.py [--full] [--push]
"""

from __future__ import annotations

import argparse
import datetime
import json
import math
import random
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=ROOT / ".env")
except Exception:
    pass

import sec_client as sec  # noqa: E402
from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402

OUT_DIR = ROOT / "data" / "korea" / "valuation_band"
OUT_JSON = OUT_DIR / "meta.json"
OUT_JS = OUT_DIR / "meta.js"
JS_VAR = "KR_VALUATION_BAND_META"
SHARDS = 32
MAX_MONTHS = 120          # 10년
MIN_TRADING_ROWS = 500    # 그날 종가>0 종목이 이만큼은 있어야 거래일로 본다
MIN_FUND_ROWS = 300       # PER 또는 PBR 이 채워진 종목 수 하한(미집계일 판별)
# 콜 간 간격. 2026-09-26 로컬에서 간격 없이 ~200콜(2분)을 보낸 직후 KRX 가 "자동화 수단을
# 통한 비정상 대량 조회" 로 그 IP 를 1일 차단했다(로그인 POST 까지 에러 페이지). 증분(보통
# 0~2콜)은 1.2초, 10년 전체 재수집(~240콜)은 2.5초 간격으로 천천히 보낸다(약 10분).
THROTTLE_S = 1.2
FULL_THROTTLE_S = 2.5
SOURCE = "KRX 공식 (PER·PBR·EPS·BPS · 종가·상장주식수, 월말 거래일)"


# ---------------------------------------------------------------- 순수 함수
def shard_of(code: str, n: int = SHARDS) -> int:
    """티커 → 샤드 번호. valuation-band-core.js 의 vbShardOf 와 1:1 같아야 한다."""
    h = 0
    for ch in str(code):
        h = (h * 31 + ord(ch)) % 1000003
    return h % n


def month_key(d: datetime.date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def add_months(key: str, k: int) -> str:
    y, m = int(key[:4]), int(key[5:7])
    idx = y * 12 + (m - 1) + k
    return f"{idx // 12:04d}-{idx % 12 + 1:02d}"


def month_range(start: str, end: str) -> list[str]:
    out, cur = [], start
    while cur <= end:
        out.append(cur)
        cur = add_months(cur, 1)
    return out


def last_completed_month(today: datetime.date) -> str:
    """오늘(KST)이 속한 달의 직전 달. 이번 달은 아직 월말이 오지 않았다."""
    return add_months(month_key(today), -1)


def month_end_candidates(key: str, back: int = 10) -> list[str]:
    """그 달 말일부터 거꾸로 평일 후보(YYYYMMDD). 공휴일은 KRX 응답으로 걸러낸다."""
    y, m = int(key[:4]), int(key[5:7])
    nxt = datetime.date(y + (m == 12), m % 12 + 1, 1)
    d = nxt - datetime.timedelta(days=1)
    out = []
    while len(out) < back and d.month == m:
        if d.weekday() < 5:
            out.append(d.strftime("%Y%m%d"))
        d -= datetime.timedelta(days=1)
    return out


def is_split(prev_shares, new_shares, prev_close, new_close) -> float | None:
    """액면분할·병합이면 주식수 비율(new/prev)을, 아니면 None.

    주식수가 1.5배 넘게(또는 1/1.5 미만으로) 변하고, 주가가 그 역수만큼 움직여
    '주가 비율 × 주식수 비율' 이 0.7~1.43 안일 때만 분할로 본다. 유상증자·무상감자처럼
    주가가 같이 움직이지 않은 변화는 제외한다."""
    try:
        ps, ns, pc, nc = float(prev_shares), float(new_shares), float(prev_close), float(new_close)
    except (TypeError, ValueError):
        return None
    if min(ps, ns, pc, nc) <= 0:
        return None
    r = ns / ps
    if 1 / 1.5 <= r <= 1.5:
        return None
    prod = (nc / pc) * r
    return r if 0.7 <= prod <= 1.43 else None


def round_price(x):
    if x is None:
        return None
    return round(x) if x >= 100 else round(x, 2)


def own_percentile(history: list[float], value: float) -> float:
    """value 가 history 안에서 몇 분위인지(0~1, 동점은 절반). history 는 value 를 포함해도 된다."""
    if not history:
        return float("nan")
    below = sum(1 for v in history if v < value)
    equal = sum(1 for v in history if v == value)
    return (below + 0.5 * equal) / len(history)


def _median(xs):
    s = sorted(xs)
    n = len(s)
    if not n:
        return float("nan")
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2


def validate_low_pbr(months: list[str], series: dict, *, horizons=(3, 12), min_hist=36,
                     q=0.20, min_group=10, n_boot=2000, seed=20260926) -> dict:
    """'자기 과거 PBR 하위 q' 종목군의 이후 수익률 초과분(중앙값 차) 검증.

    series: {code: {"c": [수정종가|None]*T, "b": [PBR|None]*T}}
    미래 정보 없음 — t 시점 분위는 0..t 의 PBR 만으로 계산한다."""
    T = len(months)
    out = {"rule": f"자기 과거 PBR 분포(최소 {min_hist}개월) 하위 {int(q * 100)}%",
           "metric": "이후 수익률 중앙값 − 같은 달 전체 대상 중앙값", "horizons": {}}
    rng = random.Random(seed)
    alpha_tail = 0.05 / 2 / len(horizons)  # 양측 95% 를 기간 수로 본페로니한 한쪽 꼬리
    for h in horizons:
        diffs, dates, n_sig, n_all = [], [], 0, 0
        for t in range(min_hist - 1, T - h):
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
                diffs.append(_median(sig) - _median(allr))
                dates.append(months[t])
                n_sig += len(sig)
                n_all += len(allr)
        if len(diffs) < 12:
            out["horizons"][f"{h}m"] = {"months": len(diffs), "insufficient": True}
            continue
        mean = sum(diffs) / len(diffs)
        # 겹치는 창(h개월)의 자기상관을 보존하려고 길이 h 의 원형 블록으로 재표본.
        n, blk = len(diffs), max(1, h)
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
        lo = boots[int(math.floor(alpha_tail * n_boot))]
        hi = boots[int(math.ceil((1 - alpha_tail) * n_boot)) - 1]
        hit = sum(1 for d in diffs if d > 0) / len(diffs)
        verdict = "우위" if lo > 0 else ("열위" if hi < 0 else "엣지 없음")
        out["horizons"][f"{h}m"] = {
            "months": len(diffs), "from": dates[0], "to": dates[-1],
            "signalObs": n_sig, "universeObs": n_all,
            "meanExcessPct": round(mean * 100, 2),
            "ciLowPct": round(lo * 100, 2), "ciHighPct": round(hi * 100, 2),
            "hitRatePct": round(hit * 100, 1), "verdict": verdict,
        }
    return out


# ---------------------------------------------------------------- KRX 수집
def _stock():
    from build_kr_short_interest import _import_pykrx_stock
    return _import_pykrx_stock()


def _num(v):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if math.isfinite(f) else None


def _relogin():
    """KRX 세션 재로그인. 같은 계정으로 다른 곳(다른 워크플로우·로컬)이 로그인하면
    중복 로그인 처리(skipDup)로 이쪽 세션이 끊겨 응답이 JSON 이 아니게 된다
    (2026-09-26 로컬 실측: 102번째 달부터 전부 KeyError)."""
    import os
    try:
        from pykrx.website.comm import auth
        sess = auth.get_auth_session()
        if sess is not None:
            sess.refresh(os.getenv("KRX_ID", ""), os.getenv("KRX_PW", ""))
    except Exception as exc:
        print(f"    [재로그인 실패] {type(exc).__name__}: {str(exc)[:80]}")


def _krx_call(fn, date, what, attempts=4):
    """KRX 조회 1회 + 세션 끊김 재시도. 끝내 실패하면 None."""
    for i in range(attempts):
        try:
            df = fn(date, "ALL")
            time.sleep(THROTTLE_S)
            if df is not None and not df.empty and len(df.columns):
                return df
            if df is not None and df.empty:
                return df  # 휴장일 등 정상적인 빈 응답
        except Exception as exc:
            print(f"    [{date}] {what} 예외({i + 1}/{attempts}): {type(exc).__name__}: {str(exc)[:60]}")
        _relogin()
        time.sleep(3 * (i + 1))
    return None


def fetch_month(stock, key: str) -> dict | None:
    """그 달 마지막 거래일의 {code: (close, shares, per, pbr, eps)} 와 날짜. 못 찾으면 None."""
    for d in month_end_candidates(key):
        cap = _krx_call(stock.get_market_cap_by_ticker, d, "시총")
        if cap is None:
            return None
        if cap.empty or "종가" not in cap.columns or int((cap["종가"] > 0).sum()) < MIN_TRADING_ROWS:
            continue  # 휴장일
        fund = _krx_call(stock.get_market_fundamental_by_ticker, d, "밸류")
        if fund is None or fund.empty or "PER" not in fund.columns:
            return None
        if int(((fund["PER"] > 0) | (fund["PBR"] > 0)).sum()) < MIN_FUND_ROWS:
            print(f"    [{d}] 밸류 미집계 — 이 달은 다음 실행에서 다시")
            return None
        rows = {}
        for ticker, r in fund.iterrows():
            code = str(ticker).zfill(6)
            if ticker not in cap.index:
                continue
            cr = cap.loc[ticker]
            close, shares = _num(cr.get("종가")), _num(cr.get("상장주식수"))
            per, pbr, eps = _num(r.get("PER")), _num(r.get("PBR")), _num(r.get("EPS"))
            rows[code] = (close if close and close > 0 else None, shares,
                          per if per and per > 0 else None, pbr if pbr and pbr > 0 else None, eps)
        return {"date": f"{d[:4]}-{d[4:6]}-{d[6:]}", "rows": rows}
    return None


# ---------------------------------------------------------------- 상태
def empty_series(n: int) -> dict:
    return {"c": [None] * n, "p": [None] * n, "b": [None] * n, "sh": None}


def append_month(series: dict, months: list[str], month: str, got: dict, *, keep_absent=False) -> int:
    """한 달 치를 시리즈 끝에 붙인다. 반환: 분할 조정한 종목 수."""
    T = len(months)
    months.append(month)
    splits = 0
    for code, s in series.items():
        for k in ("c", "p", "b"):
            s[k].append(None)
    for code, (close, shares, per, pbr, eps) in got["rows"].items():
        s = series.get(code)
        if s is None:
            s = series[code] = empty_series(T + 1)
        prev_close = next((v for v in reversed(s["c"][:T]) if v), None)
        r = is_split(s.get("sh"), shares, prev_close, close)
        if r:
            s["c"][:T] = [v / r if v else v for v in s["c"][:T]]
            splits += 1
        s["c"][T] = close
        s["b"][T] = pbr
        s["p"][T] = per if per else (-1 if eps is not None and eps < 0 else None)
        if shares:
            s["sh"] = shares
    if not keep_absent:
        for code in [c for c in series if c not in got["rows"]]:
            del series[code]  # 상장폐지·이전 — 화면에서 열 일이 없다
    return splits


def trim(series: dict, months: list[str], max_months: int = MAX_MONTHS):
    extra = len(months) - max_months
    if extra <= 0:
        return
    del months[:extra]
    for code in list(series):
        s = series[code]
        for k in ("c", "p", "b"):
            del s[k][:extra]
        if not any(s["c"]):
            del series[code]


def load_state() -> tuple[list[str], dict, dict]:
    meta = {}
    if OUT_JSON.exists():
        try:
            meta = json.loads(OUT_JSON.read_text(encoding="utf-8"))
        except Exception:
            meta = {}
    months = list(meta.get("months") or [])
    series: dict = {}
    if not months:
        return [], {}, meta
    for i in range(SHARDS):
        f = OUT_DIR / f"s{i:02d}.json"
        if not f.exists():
            print(f"  [상태] {f.name} 없음 — 전체 재수집 필요")
            return [], {}, meta
        shard = json.loads(f.read_text(encoding="utf-8"))
        if shard.get("m0") != months[0] or shard.get("n") != len(months):
            print(f"  [상태] {f.name} 기간이 메타와 다르다 — 전체 재수집 필요")
            return [], {}, meta
        for code, s in (shard.get("t") or {}).items():
            series[code] = {"c": s["c"], "p": s["p"], "b": s["b"], "sh": s.get("sh")}
    return months, series, meta


def shard_payloads(months: list[str], series: dict) -> list[dict]:
    shards = [{"m0": months[0], "n": len(months), "t": {}} for _ in range(SHARDS)]
    for code in sorted(series):
        s = series[code]
        shards[shard_of(code)]["t"][code] = {
            "c": [round_price(v) for v in s["c"]],
            "p": [None if v is None else (-1 if v < 0 else round(v, 2)) for v in s["p"]],
            "b": [None if v is None else round(v, 2) for v in s["b"]],
            "sh": int(s["sh"]) if s.get("sh") else None,
        }
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
    if prev_count and count < prev_count * 0.7:
        print(f"  [실패] 종목 수 {prev_count} → {count} 로 30% 넘게 줄었다 — 기존 파일 유지")
        raise SystemExit(1)
    meta = {
        "updatedAtKst": sec.kst_now_str(),
        "source": SOURCE,
        "months": months,
        "count": count,
        "shards": SHARDS,
        **meta_extra,
    }
    rel = []
    with repository_publish_lock(ROOT):
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        for i, sh in enumerate(shards):
            f = OUT_DIR / f"s{i:02d}.json"
            atomic_write_text(f, json.dumps(sh, ensure_ascii=False, separators=(",", ":")) + "\n")
            rel.append(f"data/korea/valuation_band/{f.name}")
        # 메타는 마지막 — 샤드가 다 써진 뒤에만 새 기간을 가리킨다.
        sec.write_data(OUT_JSON, OUT_JS, "KR_VALUATION_BAND_META", meta, indent=None)
        rel += ["data/korea/valuation_band/meta.json", "data/korea/valuation_band/meta.js"]
        print(f"Wrote {OUT_DIR} — {count}종목 · {months[0]}~{months[-1]} ({len(months)}개월)")
        if push and not sec.git_publish(rel, "KR valuation band (PER/PBR)"):
            print("  [실패] git 게시 실패 — 발행되지 않았다")
            raise SystemExit(1)


def touch_meta(meta: dict, *, push):
    """새 달이 없을 때: 샤드는 그대로 두고 점검 시각만 올린다(신선도 감시용)."""
    meta = dict(meta)
    meta["updatedAtKst"] = sec.kst_now_str()
    with repository_publish_lock(ROOT):
        sec.write_data(OUT_JSON, OUT_JS, "KR_VALUATION_BAND_META", meta, indent=None)
        if push and not sec.git_publish(
            ["data/korea/valuation_band/meta.json", "data/korea/valuation_band/meta.js"],
            "KR valuation band check",
        ):
            raise SystemExit(1)


# ---------------------------------------------------------------- 실행
def run_full(push: bool):
    global THROTTLE_S
    THROTTLE_S = FULL_THROTTLE_S
    stock = _stock()
    end = last_completed_month(sec.kst_today())
    start = add_months(end, -(MAX_MONTHS - 1))
    months: list[str] = []
    series: dict = {}
    dates: dict[str, str] = {}
    t0 = time.time()
    for key in month_range(start, end):
        got = fetch_month(stock, key)
        if not got:
            if key == end:
                print(f"  {key}: 아직 집계 전 — 직전 달까지만")
                break
            print(f"  [실패] {key} 수집 실패 — 중간 달이 비면 밴드가 끊긴다. 중단")
            raise SystemExit(1)
        append_month(series, months, key, got, keep_absent=True)
        dates[key] = got["date"]
        print(f"  {key} ({got['date']}) {len(got['rows'])}종목 · 누적 {time.time() - t0:.0f}s")
    if len(months) < 24:
        print("  [실패] 수집 달 수가 너무 적다 — 기존 파일 유지")
        raise SystemExit(1)
    print("  검증: 자기 과거 PBR 하위 20% → 이후 3·12개월 (상장폐지 포함 전체)")
    validation = validate_low_pbr(months, series)
    validation["tickers"] = len(series)
    validation["computedAtKst"] = sec.kst_now_str()
    print("   ", json.dumps(validation["horizons"], ensure_ascii=False))
    last = months[-1]
    current = {code for code, s in series.items() if s["c"][-1] or s["b"][-1] or s["p"][-1]}
    for code in [c for c in series if c not in current]:
        del series[code]
    write_all(months, series, {"lastDate": dates.get(last), "validation": validation,
                               "fetchSeconds": round(time.time() - t0)}, push=push)


def run_incremental(push: bool):
    months, series, meta = load_state()
    if not months:
        print("  상태 없음 → --full 로 전체 수집")
        return run_full(push)
    end = last_completed_month(sec.kst_today())
    todo = month_range(add_months(months[-1], 1), end)
    if not todo:
        print(f"  새로 끝난 달 없음(마지막 {months[-1]}) — 점검 시각만 갱신")
        return touch_meta(meta, push=push)
    stock = _stock()
    last_date = meta.get("lastDate")
    added = 0
    for key in todo:
        got = fetch_month(stock, key)
        if not got:
            print(f"  {key}: 아직 집계 전 — 다음 실행에서 다시")
            break
        splits = append_month(series, months, key, got)
        last_date = got["date"]
        added += 1
        print(f"  {key} ({got['date']}) {len(got['rows'])}종목 · 분할 조정 {splits}")
    if not added:
        return touch_meta(meta, push=push)
    trim(series, months)
    extra = {k: meta[k] for k in ("validation",) if k in meta}
    extra["lastDate"] = last_date
    write_all(months, series, extra, push=push)


def main():
    ap = argparse.ArgumentParser(description="KR PER·PBR 밴드(월말 KRX 공식값)")
    ap.add_argument("--full", action="store_true", help="10년 전체 재수집 + 검증 재계산")
    ap.add_argument("--push", action="store_true", default=False)
    args = ap.parse_args()
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    print("=== KR PER·PBR 밴드 ===")
    if args.full:
        run_full(args.push)
    else:
        run_incremental(args.push)


if __name__ == "__main__":
    main()
