#!/usr/bin/env python3
"""국내 배당 성장 이력 — DART 사업보고서 '배당에 관한 사항'(alotMatter, 사업연도 귀속 주당배당금).

미국판(build_dividend_growth.py)은 야후 배당락일 기록으로 연간 합을 내는데, 국내는 2023~24 배당절차
개선으로 결산배당 배당락일이 12월 말 → 이듬해 2~4월로 옮겨 가 그 방식이 깨진다(그 파일 MARKETS 주석).
여기서는 회사가 사업보고서에 적은 '그 사업연도에 귀속되는 보통주 주당 현금배당금(원)'을 쓴다 —
중간·분기 배당을 포함한 연간 합계이고 배당락일 이동과 무관하다.

조회: alotMatter.json(reprt_code=11011 사업보고서) 한 번에 당기·전기·전전기 3개년이 온다. 그래서
[L, L−3, L−6, L−9] 사업연도 보고서만 부른다(L = 마지막 완결 사업연도 — 4월 이후면 작년, 아니면 재작년;
사업보고서는 3월 말까지 낸다). DART 의 이 API 는 2015 사업연도부터라 가장 이른 기록은 2013 년이다.
무배당이거나 연속 지급이 끊긴 회사는 더 거슬러 가지 않는다(호출 절약). 받은 연도는
data/korea/dividend_growth_state.json 에 남겨 다음 실행에서 다시 받지 않는다 — 지난 사업연도 값은 바뀌지 않는다.

보정: 액면분할·병합은 같은 응답의 '주당액면가액(원)'으로 환산한다(삼성전자 2018 액면 5,000 → 100:
2017 42,500원 → 850원). 무상증자·주식배당은 액면이 그대로라 환산하지 못해 감액처럼 보일 수 있다 —
연속 연수를 실제보다 짧게 셀 수는 있어도 길게 세지 않는다(미국판과 같은 원칙). 특별배당은 구분하지
않는다(사업보고서는 정기·특별을 나누지 않는다).

산출물: data/korea/dividend_growth.json + .js(전역 DIVIDEND_GROWTH — 미국판과 같은 열 형식,
feature-data 'dividendGrowth' marketSpecific). 계산 규칙(연속 증가·지급·5/10년 연평균·최근 감액)도 같다.
실행: py scripts/build_kr_dividend_growth.py [--max-calls 4000] [--minutes 25] [--push]   (DART_API_KEY 필요)
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

if sys.platform == "win32":
    for _s in (sys.stdout, sys.stderr):
        try:
            _s.reconfigure(encoding="utf-8")
        except Exception:
            pass

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from build_dividend_growth import COLS, CUT_EPS, INCREASE_EPS  # noqa: E402  같은 판정 기준

KST = timezone(timedelta(hours=9))
OUT_JSON = ROOT / "data" / "korea" / "dividend_growth.json"
OUT_JS = ROOT / "data" / "korea" / "dividend_growth.js"
STATE_JSON = ROOT / "data" / "korea" / "dividend_growth_state.json"   # DART 응답 캐시(회사별 받은 보고서·연도 값)
KR_SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"
MIN_REPORT_YEAR = 2015          # alotMatter 가 주는 가장 이른 사업연도
STEP = 3                        # 한 보고서 = 3개년
DEPTH = 4                       # L, L-3, L-6, L-9 → 최대 12개년


def kst_now() -> datetime:
    return datetime.now(KST)


def last_fiscal_year(now: datetime) -> int:
    """사업보고서가 다 나온 마지막 사업연도 — 4월부터 작년, 1~3월은 재작년."""
    return now.year - 1 if now.month >= 4 else now.year - 2


def _num(text):
    s = re.sub(r"[,\s]", "", str(text or ""))
    if s in ("", "-"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def parse_alot(rows: list[dict], report_year: int) -> dict[int, list]:
    """alotMatter 응답 행 → {사업연도: [보통주 주당 현금배당금(원), 주당액면가액(원)]}.

    배당금 칸이 '-' 면 그해 무배당(0)으로 본다 — 보고서가 그 연도를 다룬 이상 '모름'이 아니다.
    """
    dps = {}
    par = {}
    for r in rows or []:
        se = re.sub(r"\s+", "", str(r.get("se") or ""))
        knd = str(r.get("stock_knd") or "").strip()
        cols = (r.get("thstrm"), r.get("frmtrm"), r.get("lwfr"))
        if se.startswith("주당현금배당금") and knd == "보통주":
            for i, v in enumerate(cols):
                dps[report_year - i] = _num(v) or 0.0
        elif se.startswith("주당액면가액"):
            for i, v in enumerate(cols):
                n = _num(v)
                if n and n > 0:
                    par[report_year - i] = n
    if not dps:
        return {}
    return {y: [dps[y], par.get(y)] for y in dps}


def adjusted_values(years: dict, last_year: int) -> dict[int, float]:
    """{연도: [배당, 액면]} → 마지막 연도 액면 기준으로 환산한 주당배당금."""
    vals = {int(y): v for y, v in years.items()}
    ref = None
    for y in sorted(vals, reverse=True):
        if y <= last_year and vals[y][1]:
            ref = vals[y][1]
            break
    out = {}
    for y, (d, p) in vals.items():
        if y > last_year or d is None:
            continue
        out[y] = d * (ref / p) if (ref and p and p != ref) else d
    return out


def growth_stats(vals: dict[int, float], last_year: int) -> dict | None:
    """미국판 growth_stats 와 같은 규칙. 단 DART 첫 연도는 온전한 사업연도라 비교 기준으로 쓴다."""
    vals = {y: v for y, v in vals.items() if y <= last_year}
    if not vals:
        return None
    since = min(vals)
    paid = 0
    y = last_year
    while y in vals and vals[y] > 0:
        paid += 1
        y -= 1
    up = 0
    y = last_year
    while y in vals and (y - 1) in vals and vals[y - 1] > 0 and vals[y] > vals[y - 1] * (1 + INCREASE_EPS):
        up += 1
        y -= 1
    capped = bool(up and (last_year - up) == since)
    paid_capped = bool(paid and (last_year - paid + 1) == since)

    def cagr(n):
        a, b = vals.get(last_year), vals.get(last_year - n)
        if not a or not b or a <= 0 or b <= 0:
            return None
        return round(((a / b) ** (1 / n) - 1) * 100, 2)

    last_cut = None
    for yy in range(last_year, since, -1):
        if yy in vals and (yy - 1) in vals and vals[yy] < vals[yy - 1] * (1 - CUT_EPS):
            last_cut = yy
            break
    last = vals.get(last_year)
    return {"up": up, "paid": paid, "cagr5": cagr(5), "cagr10": cagr(10),
            "last": float(f"{last:.4g}") if last else None, "since": since, "capped": capped, "paidCapped": paid_capped,
            "lastCut": last_cut, "specials": 0}


def next_report(entry: dict, last_year: int) -> int | None:
    """이 회사에 더 불러야 할 사업보고서 연도(없으면 None = 계획 완료)."""
    fetched = set(int(y) for y in entry.get("fetched") or [])
    if last_year not in fetched:
        return last_year
    years = {int(y): v for y, v in (entry.get("years") or {}).items()}
    deepest = min(fetched)
    nxt = deepest - STEP
    if nxt < MIN_REPORT_YEAR or nxt < last_year - STEP * (DEPTH - 1):
        return None
    covered = [y for y in years if y <= last_year]
    if not covered:
        return None            # 마지막 보고서에 배당 행이 없다(013·미제출) — 더 볼 것 없다
    lo = min(covered)
    # 연속 지급이 기록 첫머리까지 이어질 때만 더 거슬러 간다.
    if all((years.get(y) or [0])[0] > 0 for y in range(lo, last_year + 1)):
        return nxt
    return None


def universe(snapshot: dict, corp_map: dict) -> list[tuple[str, str]]:
    stocks = [s for s in (snapshot.get("stocks") or [])
              if str(s.get("sector") or "").upper() not in ("ETF", "EXCHANGE TRADED FUNDS")]
    stocks.sort(key=lambda s: s.get("marketCapB") if isinstance(s.get("marketCapB"), (int, float)) else 0, reverse=True)
    out = []
    for s in stocks:
        t = str(s.get("ticker") or "").replace(".KS", "").replace(".KQ", "").zfill(6)
        c = corp_map.get(t)
        if c:
            out.append((t, c))
    return out


def run(pairs, cache: dict, last_year: int, fetch, max_calls: int, budget=None) -> tuple[int, str]:
    """계획이 남은 회사를 시총순으로 돌며 보고서를 받아 cache 에 쌓는다. (호출 수, 멈춘 이유)."""
    calls = 0
    for _, corp in pairs:
        entry = cache.setdefault(corp, {"years": {}, "fetched": []})
        while True:
            r = next_report(entry, last_year)
            if r is None:
                break
            if calls >= max_calls:
                return calls, f"호출 상한 {max_calls}회"
            if budget and budget.over():
                return calls, budget.reason
            calls += 1
            rows = fetch(corp, r)          # None = 일시 오류(다음 실행에서 다시), [] = 자료 없음
            if rows is None:
                break
            for y, v in parse_alot(rows, r).items():
                entry["years"].setdefault(str(y), v)   # 겹치는 연도는 먼저 받은 값을 둔다(보고서 간격 3년이라 보통 안 겹침)
            entry["fetched"] = sorted(set(entry["fetched"]) | {r})
    return calls, ""


def build_payload(pairs, cache: dict, last_year: int, prev_tickers: dict) -> tuple[dict, int, int]:
    tickers = {}
    carried = pending = 0
    for t, corp in pairs:
        entry = cache.get(corp)
        if not entry or next_report(entry, last_year) is not None:
            pending += 1
            if t in prev_tickers:            # 계획이 덜 끝난 회사는 직전 값을 쓴다(반쪽 이력으로 덮지 않게)
                tickers[t] = prev_tickers[t]
                carried += 1
            continue
        st = growth_stats(adjusted_values(entry.get("years") or {}, last_year), last_year)
        if st and st["paid"]:
            tickers[t] = [st[c] for c in COLS]
    return tickers, carried, pending


def main() -> int:
    ap = argparse.ArgumentParser(description="국내 배당 성장 이력(DART 사업보고서 배당에 관한 사항)")
    ap.add_argument("--max-calls", type=int, default=4000, help="이번 실행 DART 호출 상한(일일 한도 보호)")
    ap.add_argument("--minutes", type=float, default=25)
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()
    api_key = os.environ.get("DART_API_KEY", "").strip()
    if not api_key:
        print("[error] DART_API_KEY 미설정 — 기존 파일 유지", file=sys.stderr)
        return 1

    from build_kr_disclosures import dart_get, load_corp_map
    from step_budget import StepBudget
    from briefing_store import atomic_write_text, repository_publish_lock
    from sec_client import git_publish, write_data

    now = kst_now()
    last_year = last_fiscal_year(now)
    try:
        prev = json.loads(OUT_JSON.read_text(encoding="utf-8"))
    except Exception:
        prev = {}
    try:
        cache = json.loads(STATE_JSON.read_text(encoding="utf-8")).get("cache") or {}
    except Exception:
        # 첫 버전은 캐시를 결과 JSON 안에 두었다 — 있으면 이어받는다.
        cache = prev.get("cache") if isinstance(prev.get("cache"), dict) else {}
    snapshot = json.loads(KR_SNAPSHOT.read_text(encoding="utf-8"))
    corp_map = load_corp_map(api_key)
    if not corp_map:
        print("[error] corpCode.xml 수집 실패 — 기존 파일 유지", file=sys.stderr)
        return 1
    pairs = universe(snapshot, corp_map)
    errors = {"n": 0}

    def fetch(corp, year):
        try:
            d = dart_get("alotMatter.json", {"corp_code": corp, "bsns_year": str(year), "reprt_code": "11011"}, api_key)
        except Exception as exc:
            errors["n"] += 1
            if errors["n"] <= 10:
                print(f"  [warn] {corp} {year}: {exc}")
            return None
        st = str(d.get("status"))
        if st == "000":
            return d.get("list") or []
        if st == "013":
            return []
        errors["n"] += 1
        return None

    budget = StepBudget(args.minutes)
    stopped = ""
    try:
        calls, stopped = run(pairs, cache, last_year, fetch, args.max_calls, budget)
    except SystemExit as exc:          # DART 020(한도 초과) — 여기까지 받은 캐시는 유효하니 저장한다
        calls, stopped = -1, str(exc)
    tickers, carried, pending = build_payload(pairs, cache, last_year, prev.get("tickers") or {})
    print(f"배당 성장(국내): 대상 {len(pairs)}종목 · 호출 {calls if calls >= 0 else '?'}회 · 오류 {errors['n']} · "
          f"계획 남음 {pending}(직전 값 이월 {carried}) · 배당 이력 {len(tickers)}종목"
          + (f" · 중단: {stopped}" if stopped else ""))
    payload = {
        "updatedAtKst": now.strftime("%Y-%m-%d %H:%M KST"),
        "lastYear": last_year,
        "source": "DART 사업보고서 배당에 관한 사항(사업연도 귀속 주당배당금, 액면 환산)",
        "count": len(tickers),
        "scanned": len(pairs),
        "pending": pending,
        "cols": COLS,
        "tickers": dict(sorted(tickers.items())),
    }
    with repository_publish_lock(ROOT):
        # 캐시는 결과와 따로 먼저 쓴다 — 결과가 회귀 가드에 막혀도 받은 DART 값은 다음 실행이 쓴다.
        OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
        atomic_write_text(STATE_JSON, json.dumps({"lastYear": last_year, "cache": cache}, ensure_ascii=False, separators=(",", ":")) + "\n")
        write_data(OUT_JSON, OUT_JS, "DIVIDEND_GROWTH", payload, indent=None, min_ratio=0.7)
        print(f"  → {OUT_JSON.relative_to(ROOT)} · {OUT_JS.relative_to(ROOT)} · {STATE_JSON.relative_to(ROOT)}")
        if args.push:
            rel = [p.relative_to(ROOT).as_posix() for p in (OUT_JSON, OUT_JS, STATE_JSON)]
            if not git_publish(rel, "KR dividend growth history"):
                return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
