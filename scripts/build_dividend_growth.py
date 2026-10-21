#!/usr/bin/env python3
"""배당 성장 이력 (build_dividend_growth.py)
========================================

연속 배당 증가 연수 · 연속 지급 연수 · 5/10년 연평균 증가율. 종목 상세 '주주환원' 카드와
찾기 › 배당 랭킹의 '연속 증가' 열이 읽는다. 예전엔 "연속 배당 연수는 두 시장 모두 소스가 없어"
뺐던 값이다 — 상세 파일의 배당 기록은 약 5년뿐이라 연속 연수를 셀 수 없었다.

소스: 야후 v8 chart `events=div`(무키·크럼 불필요, 분할 조정된 배당락일·주당 금액).
  `range=max` 는 오래된 배당을 표본만 돌려준다(KO 1962~ 인데 169건) — `period1`(1985-01-01)부터
  `interval=1mo` 로 받으면 전부 온다(KO 1985~ 168건 = 41년 × 4).

계산(전부 이 파일의 순수 함수, 테스트 scripts/tests/test_dividend_growth.py):
  1. 특별배당 제외: 앞뒤 4회 지급의 중앙값의 2배를 넘고, 약 1년 전·1년 뒤 같은 차례 지급의 2배도
     넘는 지급(삼성전자 2020년 4분기 1,932원). 해마다 반복되는 큰 결산배당(중간 소액 + 결산 고액)은
     1년 전 지급과 비슷해 남는다.
  2. 연간 배당 = 그해 마지막 정기 지급일에서 거슬러 (365 − 지급 간격/2)일 안의 정기 지급 합. 창 안
     횟수가 간격으로 본 연간 횟수(12·4·2·1)와 다르면 '연간 횟수 × 창 안 지급 중앙값'(annual_values).
     달력 연도 합계는 지급일이 해를 넘나들면(분기 배당이 한 해 5번·3번 잡힘) 가짜 증감이 생긴다
     — PG 2002 년 5회 지급 뒤 2003 년이 감소로 보여 69년 연속이 22년으로 끊겼다.
  3. 연속 증가 = 마지막 완결 연도(올해 − 1)부터 거슬러 연간 배당이 전년보다 0.1% 넘게 큰 해의 수.
     연속 지급 = 정기 지급이 있었던 해가 끊기지 않은 수. 기록 첫해에 닿으면 capped(그 이상일 수 있음).
  4. 5·10년 연평균 = (마지막 완결 연도 ÷ N년 전)^(1/N) − 1 (두 값이 양수일 때만).
  지급 기록이 빈 해(야후 누락 포함)는 연속을 끊는다 — 실제보다 짧게 셀 수는 있어도 길게 세지 않는다.

산출물: data/dividend_growth.{json,js}(US 전용 — 국내를 뺀 이유는 MARKETS 아래 주석), 전역 DIVIDEND_GROWTH
  { updatedAtKst, lastYear, count, cols, tickers: {T: [up, paid, cagr5, cagr10, last, since, capped, paidCapped, lastCut, specials]} }
실행:  py scripts/build_dividend_growth.py [--top 1000] [--push]
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
import urllib.parse
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

KST = timezone(timedelta(hours=9))
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"}
PERIOD1 = 473385600  # 1985-01-01 UTC
EPOCH = datetime(1970, 1, 1)
MARKETS = {
    "us": {"snapshot": ROOT / "data" / "market_snapshot.json",
           "out_json": ROOT / "data" / "dividend_growth.json", "out_js": ROOT / "data" / "dividend_growth.js",
           "etf": ("EXCHANGE TRADED FUNDS", "ETF")},
}
# 국내는 싣지 않는다(2026-10-21 실측): 2023~24 배당절차 개선으로 결산배당 배당락일이 12월 말 → 이듬해
# 2~4월로 옮겨 가면서 배당락일 기준 연간 합이 그해에 비거나 두 번 잡힌다(신한지주 2023 2,440 → 2024 2,145
# '감소', 실제 사업연도 배당은 2,065 → 2,100 → 2,160 증가). 야후 국내 배당 기록은 빈 해도 있다(기아 2023).
# 국내판은 DART 사업보고서 '배당에 관한 사항'(사업연도 귀속 주당배당금)으로 따로 만들어야 한다.
# 모듈 수준 OUT* 경로 — 신선도 감시 테스트(test_freshness_gate)가 산출물을 찾는 데 쓴다.
OUT_JSON = MARKETS["us"]["out_json"]
OUT_JS = MARKETS["us"]["out_js"]
COLS = ["up", "paid", "cagr5", "cagr10", "last", "since", "capped", "paidCapped", "lastCut", "specials"]
INCREASE_EPS = 0.001
CUT_EPS = 0.01


def kst_now_str() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def _d(s: str) -> date:
    return datetime.strptime(s, "%Y-%m-%d").date()


def parse_chart_dividends(payload: dict) -> list[tuple[str, float]]:
    """야후 chart 응답 → [(배당락일 YYYY-MM-DD, 주당 금액)] 날짜순(같은 날 중복은 하나)."""
    res = ((payload or {}).get("chart") or {}).get("result") or []
    if not res:
        return []
    ev = ((res[0] or {}).get("events") or {}).get("dividends") or {}
    out = {}
    for v in ev.values():
        try:
            ts = int(v["date"])
            amt = float(v["amount"])
        except (KeyError, TypeError, ValueError):
            continue
        if amt <= 0:
            continue
        out[(EPOCH + timedelta(seconds=ts)).date().isoformat()] = amt
    return sorted(out.items())


def special_flags(rows: list[tuple[str, float]]) -> list[bool]:
    """특별배당 표시. 앞뒤 4회 중앙값의 2배 초과 + 약 1년 전·후(330~400일) 지급의 2배 초과."""
    flags = []
    amts = [a for _, a in rows]
    dates = [_d(d) for d, _ in rows]
    for i, (_, a) in enumerate(rows):
        neigh = amts[max(0, i - 4):i] + amts[i + 1:i + 5]
        if len(neigh) < 2 or a <= 2 * statistics.median(neigh):
            flags.append(False)
            continue
        same_season = [amts[j] for j in range(len(rows)) if j != i and 330 <= abs((dates[j] - dates[i]).days) <= 400]
        flags.append(all(a > 2 * x for x in same_season))
    return flags


def tiny_flags(rows: list[tuple[str, float]]) -> list[bool]:
    """앞뒤 4회 중앙값의 1/4 미만이고 약 1년 전·후 같은 차례 지급의 1/4 도 안 되는 지급 — 야후의 끼어든
    소액 기록(XOM 2001-06-18 $0.01)이라 정기 지급에서 뺀다. 해마다 같은 때 나오는 작은 중간배당은 남는다."""
    amts = [a for _, a in rows]
    dates = [_d(d) for d, _ in rows]
    out = []
    for i, a in enumerate(amts):
        neigh = amts[max(0, i - 4):i] + amts[i + 1:i + 5]
        if len(neigh) < 2 or a >= 0.25 * statistics.median(neigh):
            out.append(False)
            continue
        same_season = [amts[j] for j in range(len(rows)) if j != i and 330 <= abs((dates[j] - dates[i]).days) <= 400]
        out.append(all(a < 0.25 * x for x in same_season))
    return out


def annual_values(rows: list[tuple[str, float]]) -> tuple[dict[int, float], int]:
    """연도 → 연간 정기 배당. 두 번째 값 = 제외한 특별배당 수.

    '그해 지급한 배당 합계' 정의(XOM 2020 처럼 분기 배당을 동결해도 연간 합이 늘면 증가)를 따르되,
    달력 연도 대신 그해 마지막 정기 지급일에서 거슬러 (365 − g/2)일 창을 쓴다. g = 마지막 지급까지의
    최근 간격 2개 중 긴 쪽(하루 차 이중 기록·연 1회 → 분기 전환에 덜 흔들린다), 연간 횟수 f(12·4·2·1).
    """
    flags = special_flags(rows)
    tiny = tiny_flags(rows)
    regular = [(_d(d), a) for (d, a), sp, tn in zip(rows, flags, tiny) if not sp and not tn]
    by_year: dict[int, list[tuple[date, float]]] = {}
    for d, a in regular:
        by_year.setdefault(d.year, []).append((d, a))
    out = {}
    for y, pts in by_year.items():
        last, last_amt = max(pts)
        upto = [d for d, _ in regular if d <= last]
        gaps = [(b - a).days for a, b in zip(upto[-3:], upto[-3:][1:]) if (b - a).days > 0]
        g = min(max(gaps), 365) if gaps else 365
        freq = expected_frequency(g)
        window = 365 - g / 2
        win = [a for d, a in regular if last - timedelta(days=window) < d <= last]
        # 창 안 횟수가 연간 횟수와 다르면(같은 분기 이중 기록·하루 차 중복·지급 누락) 합 대신
        # '연간 횟수 × 창 안 지급 중앙값'으로 센다.
        out[y] = sum(win) if len(win) == freq else freq * statistics.median(win)
    return out, sum(flags)


def expected_frequency(gap_days: float) -> int:
    """지급 간격 중앙값 → 연간 횟수(12·4·2·1 중 가장 가까운 것)."""
    per_year = 365 / max(gap_days, 1)
    return min((12, 4, 2, 1), key=lambda f: abs(f - per_year))


def growth_stats(rows: list[tuple[str, float]], last_year: int) -> dict | None:
    """마지막 완결 연도(last_year)까지의 연속 증가·연속 지급·연평균 증가율. 배당이 없으면 None."""
    rows = [(d, a) for d, a in rows if int(d[:4]) <= last_year]
    if not rows:
        return None
    vals, specials = annual_values(rows)
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
    while y in vals and (y - 1) in vals and (y - 1) != since and vals[y] > vals[y - 1] * (1 + INCREASE_EPS):
        up += 1
        y -= 1
    # 기록 첫해(부분 연도일 수 있음)는 비교 기준으로 쓰지 않는다. 연속이 기록 첫머리에 닿으면
    # 그 앞은 모른다(capped = 연속 증가, paidCapped = 연속 지급) — 화면은 '기록 시작 연도'를 함께 적는다.
    capped = bool(up and (last_year - up) == since + 1)
    paid_capped = bool(paid and (last_year - paid + 1) == since)

    def cagr(n):
        a, b = vals.get(last_year), vals.get(last_year - n)
        if not a or not b or a <= 0 or b <= 0 or (last_year - n) <= since:
            return None
        return round(((a / b) ** (1 / n) - 1) * 100, 2)

    last_cut = None
    for yy in range(last_year, since + 1, -1):
        if yy in vals and (yy - 1) in vals and vals[yy] < vals[yy - 1] * (1 - CUT_EPS):
            last_cut = yy
            break
    last = vals.get(last_year)
    return {"up": up, "paid": paid, "cagr5": cagr(5), "cagr10": cagr(10),
            "last": float(f"{last:.4g}") if last else None, "since": since, "capped": capped, "paidCapped": paid_capped,
            "lastCut": last_cut, "specials": specials}


def yahoo_symbol(row: dict, market: str) -> str:
    if market == "kr":
        return str(row.get("yahooSymbol") or "")
    return str(row.get("ticker") or "").replace(".", "-").replace("/", "-")


def fetch_dividends(symbol: str, period2: int) -> list[tuple[str, float]]:
    from sec_client import http_get_with_backoff
    url = (f"https://query2.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(symbol)}"
           f"?period1={PERIOD1}&period2={period2}&interval=1mo&events=div")
    raw = http_get_with_backoff(url, headers=UA, timeout=25, retries=2)
    return parse_chart_dividends(json.loads(raw))


def universe(market: str, top: int) -> list[tuple[str, str]]:
    cfg = MARKETS[market]
    snap = json.loads(cfg["snapshot"].read_text(encoding="utf-8"))
    rows = [s for s in snap.get("stocks") or [] if s.get("ticker") and s.get("sector") not in cfg["etf"]]
    rows.sort(key=lambda s: float(s.get("marketCapB") or 0), reverse=True)
    out = []
    for s in rows[:top]:
        sym = yahoo_symbol(s, market)
        if sym:
            out.append((str(s["ticker"]), sym))
    return out


def build_market(market: str, top: int, pause: float = 0.12) -> tuple[dict | None, int, int]:
    last_year = datetime.now(KST).year - 1
    period2 = int(time.time())
    tickers = {}
    ok = fail = 0
    names = universe(market, top)
    for i, (t, sym) in enumerate(names, 1):
        try:
            rows = fetch_dividends(sym, period2)
            ok += 1
        except Exception as exc:
            fail += 1
            if fail <= 10:
                print(f"    [warn] {sym}: {exc}")
            continue
        finally:
            time.sleep(pause)
        st = growth_stats(rows, last_year)
        if st and st["paid"]:
            tickers[t] = [st[c] for c in COLS]
        if i % 200 == 0:
            print(f"  [{market}] {i}/{len(names)} · 배당 이력 {len(tickers)}종목 · 실패 {fail}")
    if not names or ok < len(names) * 0.7:
        return None, ok, fail
    payload = {"updatedAtKst": kst_now_str(), "lastYear": last_year, "source": "Yahoo Finance (배당락일·분할 조정)",
               "count": len(tickers), "scanned": len(names), "cols": COLS, "tickers": dict(sorted(tickers.items()))}
    return payload, ok, fail


def main() -> int:
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
            sys.stderr.reconfigure(encoding="utf-8")
        except Exception:
            pass
    ap = argparse.ArgumentParser(description="배당 성장 이력(연속 증가·연속 지급·연평균 증가율, 미국)")
    ap.add_argument("--top", type=int, default=1000)
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()

    from sec_client import write_data, git_publish
    from briefing_store import repository_publish_lock
    cfg = MARKETS["us"]
    print(f"=== 배당 성장 이력 [us] 시총 상위 {args.top} ===")
    payload, ok, fail = build_market("us", args.top)
    if not payload:
        print(f"[error] 응답 {ok}건 · 실패 {fail}건 — 70% 미만이라 기존 파일 유지")
        return 1
    with repository_publish_lock(ROOT):
        write_data(cfg["out_json"], cfg["out_js"], "DIVIDEND_GROWTH", payload, indent=None, min_ratio=0.7)
        print(f"  → {cfg['out_json'].relative_to(ROOT)} · {payload['count']}종목(조회 {ok} · 실패 {fail})")
        if args.push:
            rel = [p.relative_to(ROOT).as_posix() for p in (cfg["out_json"], cfg["out_js"])]
            if not git_publish(rel, "dividend growth history"):
                return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
