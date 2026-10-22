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
# parse_alot 규칙이 바뀌면 올린다. 캐시의 버전이 낮으면 '받았는데 값이 없던' 보고서만 다시 받는다
# (2: 옛 보고서의 이름 없는 보통주 행을 읽게 됨 — 1 은 그런 보고서를 빈 결과로 캐시했다).
PARSER_VERSION = 2


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
    주식 종류: 2020 사업연도쯤부터는 stock_knd 가 '보통주'·'우선주'로 오지만, 그 전 보고서는 '-' 로 오고
    보통주 행이 먼저, 우선주 행이 뒤에 이름 없이 온다(SK텔레콤 2019·SK하이닉스 2016 확인). 그래서 '보통주'
    표시가 있으면 그 행, 없으면 '우선주'가 아닌 첫 행을 쓴다.
    """
    dps = {}
    par = {}
    dps_rows = []
    for r in rows or []:
        se = re.sub(r"\s+", "", str(r.get("se") or ""))
        knd = str(r.get("stock_knd") or "").strip()
        cols = (r.get("thstrm"), r.get("frmtrm"), r.get("lwfr"))
        if se.startswith("주당현금배당금"):
            dps_rows.append((knd, cols))
        elif se.startswith("주당액면가액"):
            for i, v in enumerate(cols):
                n = _num(v)
                if n and n > 0:
                    par[report_year - i] = n
    common = next((c for k, c in dps_rows if k == "보통주"), None)
    if common is None:
        common = next((c for k, c in dps_rows if "우선" not in k), None)
    if common is not None:
        for i, v in enumerate(common):
            dps[report_year - i] = _num(v) or 0.0
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


def parse_alot_pref(rows: list[dict], report_year: int) -> dict[int, float | None]:
    """alotMatter 응답 행 → {사업연도: 우선주 주당 현금배당금(원) | None(모름)}.

    '우선주' 행이 하나일 때만 쓴다(둘 이상이면 어느 종류인지 몰라 빈 결과). 옛 보고서(stock_knd '-')는 이름 없는
    둘째 행이 우선주다. 배당금 칸이 '-' 인데 같은 해 보통주는 배당했다면 0 이 아니라 모름(None) — LG화학처럼
    우선주 칸을 비워 두는 회사가 있다(2026-10-22 확인). 보통주도 무배당인 해의 '-' 는 0.
    """
    common_rows, pref_rows = [], []
    for r in rows or []:
        se = re.sub(r"\s+", "", str(r.get("se") or ""))
        if not se.startswith("주당현금배당금"):
            continue
        knd = str(r.get("stock_knd") or "").strip()
        cols = (r.get("thstrm"), r.get("frmtrm"), r.get("lwfr"))
        (pref_rows if "우선" in knd else common_rows).append((knd, cols))
    if not pref_rows and len(common_rows) == 2 and all(k in ("", "-") for k, _ in common_rows):
        pref_rows = [common_rows.pop()]
    if len(pref_rows) != 1 or not common_rows:
        return {}
    common = next((c for k, c in common_rows if k == "보통주"), common_rows[0][1])
    out = {}
    for i, v in enumerate(pref_rows[0][1]):
        n = _num(v)
        if n is None:
            n = 0.0 if not (_num(common[i]) or 0) > 0 else None
        out[report_year - i] = n
    return out


def pref_tickers(snapshot: dict, corp_map: dict, pref_rows: list[tuple[str, str]]) -> dict[str, tuple[str, str]]:
    """보통주 티커 → (우선주 티커, 우선주 이름). 사이트 국내 유니버스는 우선주를 빼므로(update_korea_data
    is_korean_preferred_stock) 우선주 목록은 네이버 상장 목록(pref_rows)에서 받는다. 보통주 = 앞 다섯 자리 + '0'.
    DART 우선주 행이 하나라 회사마다 하나만 고른다: '…5'(이름 = 보통주 이름 + '우')가 있으면 그것, 없으면 그 회사
    우선주가 하나뿐일 때 그것(현대차는 우·2우B 둘이라 '현대차우'만)."""
    names = {str(s.get("ticker") or "").zfill(6): str(s.get("company") or "") for s in snapshot.get("stocks") or []}
    by_common: dict[str, list[tuple[str, str]]] = {}
    for pt, pname in pref_rows or []:
        pt = str(pt or "").zfill(6)
        c = pt[:5] + "0"
        cname = names.get(c)
        if c in corp_map and cname and str(pname).startswith(cname) and "우" in str(pname)[len(cname):]:
            by_common.setdefault(c, []).append((pt, str(pname)))
    out = {}
    for c, prefs in by_common.items():
        first = [x for x in prefs if x[0].endswith("5") and x[1] == names[c] + "우"]
        pick = first[0] if first else (prefs[0] if len(prefs) == 1 else None)
        if pick:
            out[c] = pick
    return out


def fetch_pref_rows() -> list[tuple[str, str]]:
    """네이버 시가총액 목록(코스피·코스닥)에서 우선주 (티커, 이름). 약 10초. 실패하면 빈 목록."""
    from update_korea_data import fetch_market_page, is_korean_preferred_stock
    out = []
    for sosok in (0, 1):
        for page in range(1, 60):
            try:
                rows = fetch_market_page(sosok, page)
            except Exception as exc:  # noqa: BLE001
                print(f"  [warn] 우선주 목록 sosok={sosok} page={page}: {exc}")
                return out
            if not rows:
                break
            out += [(r["symbol"], r["company"]) for r in rows if is_korean_preferred_stock(r["symbol"], r["company"])]
    return out


def next_report(entry: dict, last_year: int) -> int | None:
    """이 회사에 더 불러야 할 사업보고서 연도(없으면 None = 계획 완료)."""
    fetched = set(int(y) for y in entry.get("fetched") or [])
    years = {int(y): v for y, v in (entry.get("years") or {}).items()}
    # 계획한 보고서 [L, L-3, L-6, L-9] 를 최근부터 보며 아직 안 받은 첫 보고서를 고른다(중간이 빠졌으면 그걸 채운다).
    for k in range(DEPTH):
        r = last_year - STEP * k
        if r < MIN_REPORT_YEAR:
            return None
        if r in fetched:
            continue
        if k == 0:
            return r
        # 더 거슬러 가는 건 그 뒤 연도(r+1 ~ L)가 빠짐없이 배당을 지급했을 때만 — 끊겼으면 연속 기록에 쓸모없다.
        if all((years.get(y) or [0])[0] > 0 for y in range(r + 1, last_year + 1)):
            return r
        return None
    return None


def forget_empty_reports(cache: dict) -> int:
    """받은 보고서 중 그 3개년 값이 하나도 없는 것을 '안 받음'으로 되돌린다(파서가 바뀐 뒤 다시 받게). 되돌린 수."""
    n = 0
    for entry in cache.values():
        years = entry.get("years") or {}
        keep = [r for r in entry.get("fetched") or [] if any(str(r - i) in years for i in range(STEP))]
        n += len(entry.get("fetched") or []) - len(keep)
        entry["fetched"] = keep
    return n


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


def run(pairs, cache: dict, last_year: int, fetch, max_calls: int, budget=None, pref_corps=frozenset()) -> tuple[int, str]:
    """계획이 남은 회사를 시총순으로 돌며 보고서를 받아 cache 에 쌓는다. (호출 수, 멈춘 이유).
    pref_corps(우선주가 상장된 회사)는 받은 보고서의 우선주 값도 entry['pref'] 에 둔다 — 우선주를 읽기 전(2026-10-22 이전)에
    받은 보고서는 prefFetched 에 없어 한 번 더 받는다."""
    calls = 0
    for _, corp in pairs:
        entry = cache.setdefault(corp, {"years": {}, "fetched": []})
        if corp in pref_corps:
            for r in sorted(set(entry.get("fetched") or []) - set(entry.get("prefFetched") or []), reverse=True):
                if calls >= max_calls:
                    return calls, f"호출 상한 {max_calls}회"
                if budget and budget.over():
                    return calls, budget.reason
                calls += 1
                rows = fetch(corp, r)
                if rows is None:
                    break
                for y, v in parse_alot_pref(rows, r).items():
                    entry.setdefault("pref", {}).setdefault(str(y), v)
                entry["prefFetched"] = sorted(set(entry.get("prefFetched") or []) | {r})
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
            if corp in pref_corps:
                for y, v in parse_alot_pref(rows, r).items():
                    entry.setdefault("pref", {}).setdefault(str(y), v)
                entry["prefFetched"] = sorted(set(entry.get("prefFetched") or []) | {r})
    return calls, ""


def pref_years(entry: dict) -> dict:
    """우선주 {연도: [배당, 액면(보통주와 같음)]} — 모르는 해(None)는 뺀다(연속 기록이 거기서 끊긴다)."""
    years = entry.get("years") or {}
    return {y: [v, (years.get(y) or [None, None])[1]] for y, v in (entry.get("pref") or {}).items() if v is not None}


def build_pref(pairs, cache: dict, last_year: int, prefs: dict, prev_pref: dict) -> dict:
    """보통주 티커 → {t: 우선주 티커, name, v: [COLS…]}. 우선주 값을 다 못 받은 회사는 직전 값을 쓴다."""
    out = {}
    corp_of = dict(pairs)
    for ct, (pt, pname) in prefs.items():
        entry = cache.get(corp_of.get(ct) or "")
        if not entry or next_report(entry, last_year) is not None or set(entry.get("fetched") or []) - set(entry.get("prefFetched") or []):
            if ct in prev_pref:
                out[ct] = prev_pref[ct]
            continue
        py = pref_years(entry)
        if str(last_year) not in py:      # 마지막 해 우선주 배당을 모르면 내지 않는다
            continue
        st = growth_stats(adjusted_values(py, last_year), last_year)
        if st and st["paid"]:
            out[ct] = {"t": pt, "name": pname, "v": [st[c] for c in COLS]}
    return out


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
        state = json.loads(STATE_JSON.read_text(encoding="utf-8"))
    except Exception:
        # 첫 버전은 캐시를 결과 JSON 안에 두었다 — 있으면 이어받는다.
        state = {"cache": prev.get("cache") if isinstance(prev.get("cache"), dict) else {}}
    cache = state.get("cache") or {}
    if int(state.get("parser") or 1) < PARSER_VERSION:
        print(f"  파서 버전 {state.get('parser') or 1} → {PARSER_VERSION}: 빈 결과로 캐시된 보고서 {forget_empty_reports(cache)}건을 다시 받는다")
    snapshot = json.loads(KR_SNAPSHOT.read_text(encoding="utf-8"))
    corp_map = load_corp_map(api_key)
    if not corp_map:
        print("[error] corpCode.xml 수집 실패 — 기존 파일 유지", file=sys.stderr)
        return 1
    pairs = universe(snapshot, corp_map)
    prefs = pref_tickers(snapshot, corp_map, fetch_pref_rows())
    pref_corps = frozenset(corp_map[c] for c in prefs)
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
        calls, stopped = run(pairs, cache, last_year, fetch, args.max_calls, budget, pref_corps)
    except SystemExit as exc:          # DART 020(한도 초과) — 여기까지 받은 캐시는 유효하니 저장한다
        calls, stopped = -1, str(exc)
    tickers, carried, pending = build_payload(pairs, cache, last_year, prev.get("tickers") or {})
    pref_out = build_pref(pairs, cache, last_year, prefs, prev.get("pref") or {}) if prefs else (prev.get("pref") or {})
    print(f"배당 성장(국내): 대상 {len(pairs)}종목 + 우선주 {len(prefs)}(이력 {len(pref_out)}) · 호출 {calls if calls >= 0 else '?'}회 · 오류 {errors['n']} · "
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
        # 보통주 티커 → 우선주 배당 성장(사이트 유니버스엔 우선주가 없어 보통주 화면에 함께 보인다)
        "pref": dict(sorted(pref_out.items())),
    }
    with repository_publish_lock(ROOT):
        # 캐시는 결과와 따로 먼저 쓴다 — 결과가 회귀 가드에 막혀도 받은 DART 값은 다음 실행이 쓴다.
        OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
        atomic_write_text(STATE_JSON, json.dumps({"lastYear": last_year, "parser": PARSER_VERSION, "cache": cache}, ensure_ascii=False, separators=(",", ":")) + "\n")
        write_data(OUT_JSON, OUT_JS, "DIVIDEND_GROWTH", payload, indent=None, min_ratio=0.7)
        print(f"  → {OUT_JSON.relative_to(ROOT)} · {OUT_JS.relative_to(ROOT)} · {STATE_JSON.relative_to(ROOT)}")
        if args.push:
            rel = [p.relative_to(ROOT).as_posix() for p in (OUT_JSON, OUT_JS, STATE_JSON)]
            if not git_publish(rel, "KR dividend growth history"):
                return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
