#!/usr/bin/env python3
"""시장 폭 추이 — 종목별 일봉(data/details·data/korea/details 의 chartSeries)만으로 매일의 시장 내부를 센다.

외부 원천 없이 이미 발행된 실측 일봉을 다시 읽는다(키·차단 위험 0). 시장 탭 '시장 폭' 카드는 그날 하루의
상승 비율만 보여 줬다 — 여기서 최근 1년 추이를 만든다.

  above50 / above200 : 그날 종가가 50일·200일 이동평균 위인 종목 비율(%) — 이평 계산에 봉이 모자란 종목은 분모에서 뺀다
  adv / dec          : 전일 종가 대비 오른·내린 종목 수
  adLine             : 누적 (adv − dec) — 창 첫날 0
  mcclellan          : 맥클렐런 오실레이터 = EMA19(RANA) − EMA39(RANA), RANA = (adv − dec) / (adv + dec) × 1000
  nh / nl            : 종가 기준 52주(252봉) 신고가·신저가 종목 수
  n                  : 그날 봉이 있는 종목 수

대상: 보통주만(미국 스냅샷 bucket 'all_misc'·국내 market 'etf' 제외), 실측 이력(historySource yahoo·yahoo-cache)만.
마지막 봉이 최신일보다 7일 넘게 묵은 종목은 뺀다. 그날 봉이 있는 종목이 최근 최대치의 60% 미만인 날(휴장·부분 발행)은 버린다.

산출물: data/market_breadth.json/.js (US), data/korea/market_breadth.json/.js (KR) — window.MARKET_BREADTH.
"""

from __future__ import annotations

import argparse
import json
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

import sec_client as sec  # noqa: E402

KST = timezone(timedelta(hours=9))
WINDOW = 252          # 내보내는 거래일 수(약 1년)
WARMUP = 252 + 40     # 52주 고저·200일선·EMA39 가 서려면 앞에 더 필요한 봉
MIN_COVERAGE = 0.6
STALE_DAYS = 7
REAL_SOURCES = {"yahoo", "yahoo-cache"}
MARKETS = {
    "us": {"snapshot": ROOT / "data" / "market_snapshot.json", "details": ROOT / "data" / "details",
           "out": (ROOT / "data" / "market_breadth.json", ROOT / "data" / "market_breadth.js")},
    "kr": {"snapshot": ROOT / "data" / "korea" / "market_snapshot.json", "details": ROOT / "data" / "korea" / "details",
           "out": (ROOT / "data" / "korea" / "market_breadth.json", ROOT / "data" / "korea" / "market_breadth.js")},
}


def is_common_stock(market: str, row: dict) -> bool:
    if market == "us":
        return row.get("bucket") != "all_misc"
    return row.get("market") != "etf"


def closes_of(detail: dict) -> list[tuple[str, float]]:
    """chartSeries [시, 고, 저, 종, 량, 날짜] → [(날짜, 종가)] 오름차순, 0·결측 제외."""
    out = []
    for e in detail.get("chartSeries") or []:
        if isinstance(e, list) and len(e) >= 6 and e[5] and isinstance(e[3], (int, float)) and e[3] > 0:
            out.append((str(e[5]), float(e[3])))
    out.sort()
    return out


def stock_flags(closes: list[tuple[str, float]]) -> dict[str, tuple]:
    """날짜 → (above50|None, above200|None, change_sign|None, new_high, new_low). 이평·고저는 그 종목 자신의 봉 기준."""
    flags: dict[str, tuple] = {}
    vals = [c for _, c in closes]
    s50 = s200 = 0.0
    for i, (d, c) in enumerate(closes):
        s50 += c
        s200 += c
        if i >= 50:
            s50 -= vals[i - 50]
        if i >= 200:
            s200 -= vals[i - 200]
        a50 = (c > s50 / 50) if i >= 49 else None
        a200 = (c > s200 / 200) if i >= 199 else None
        sign = None if i == 0 else (1 if c > vals[i - 1] else -1 if c < vals[i - 1] else 0)
        nh = nl = False
        if i >= WINDOW:
            prior = vals[i - WINDOW:i]
            nh, nl = c > max(prior), c < min(prior)
        flags[d] = (a50, a200, sign, nh, nl)
    return flags


def ema(values: list[float], span: int) -> list[float]:
    k = 2 / (span + 1)
    out, cur = [], None
    for v in values:
        cur = v if cur is None else cur + k * (v - cur)
        out.append(cur)
    return out


def aggregate(all_flags: list[dict[str, tuple]]) -> list[dict]:
    """종목별 플래그 → 날짜별 집계. 커버리지가 낮은 날은 버리고, 최근 WINDOW 일만."""
    days: dict[str, list] = {}
    for flags in all_flags:
        for d, (a50, a200, sign, nh, nl) in flags.items():
            r = days.setdefault(d, [0, 0, 0, 0, 0, 0, 0, 0, 0])  # n, a50n, a50y, a200n, a200y, adv, dec, nh, nl
            r[0] += 1
            if a50 is not None:
                r[1] += 1
                r[2] += a50
            if a200 is not None:
                r[3] += 1
                r[4] += a200
            r[5] += sign == 1
            r[6] += sign == -1
            r[7] += nh
            r[8] += nl
    dates = sorted(days)
    if not dates:
        return []
    peak = max(days[d][0] for d in dates[-WINDOW:])
    dates = [d for d in dates if days[d][0] >= peak * MIN_COVERAGE]
    rana = []
    for d in dates:
        n, _, _, _, _, adv, dec, _, _ = days[d]
        rana.append((adv - dec) / (adv + dec) * 1000 if adv + dec else 0.0)
    osc = [a - b for a, b in zip(ema(rana, 19), ema(rana, 39))]
    rows, ad = [], 0
    start = max(0, len(dates) - WINDOW)
    for i, d in enumerate(dates):
        if i < start:
            continue
        n, a50n, a50y, a200n, a200y, adv, dec, nh, nl = days[d]
        ad += adv - dec
        rows.append({
            "d": d, "n": n,
            "above50": round(a50y / a50n * 100, 1) if a50n else None,
            "above200": round(a200y / a200n * 100, 1) if a200n else None,
            "adv": adv, "dec": dec, "adLine": ad,
            "mcclellan": round(osc[i], 1) if i >= 39 else None,
            "nh": nh, "nl": nl,
        })
    return rows


def build_market(market: str) -> dict:
    cfg = MARKETS[market]
    snap = json.loads(cfg["snapshot"].read_text(encoding="utf-8"))
    tickers = [r["ticker"] for r in snap.get("stocks") or [] if r.get("ticker") and is_common_stock(market, r)]
    series = []
    for t in tickers:
        path = cfg["details"] / f"{t}.json"
        if not path.exists():
            continue
        try:
            detail = json.loads(path.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            continue
        if detail.get("historySource") not in REAL_SOURCES:
            continue
        closes = closes_of(detail)[-(WINDOW + WARMUP):]
        if len(closes) >= 60:
            series.append(closes)
    # 마지막 봉이 최신일에서 STALE_DAYS 넘게 묵은 종목(갱신이 멈춘 캐시)은 통째로 뺀다 — 넣으면 최근 날짜만
    # 분모가 줄어 비율이 튀고(국내 2026-10: 3,800개 중 약 1,400개가 묵은 캐시), 커버리지 기준에 최근 날이 잘린다.
    newest = max((c[-1][0] for c in series), default="")
    cutoff = (datetime.fromisoformat(newest) - timedelta(days=STALE_DAYS)).date().isoformat() if newest else ""
    fresh = [c for c in series if c[-1][0] >= cutoff]
    rows = aggregate([stock_flags(c) for c in fresh])
    used = len(fresh)
    return {
        "updatedAtKst": datetime.now(KST).strftime("%Y-%m-%d %H:%M KST"),
        "market": market, "universe": used, "count": len(rows), "rows": rows,
        "method": "종목별 실측 일봉 종가 기준 · 보통주만 · 이평·52주는 각 종목 자신의 봉",
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="시장 폭 추이(종목 일봉 집계)")
    ap.add_argument("--market", choices=["us", "kr", "all"], default="all")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()
    markets = ["us", "kr"] if args.market == "all" else [args.market]
    written = []
    for m in markets:
        payload = build_market(m)
        if payload["count"] < 60:
            print(f"[breadth] {m}: 날짜 {payload['count']}개 — 너무 적어 기존 파일 유지")
            return 1
        last = payload["rows"][-1]
        print(f"[breadth] {m}: 종목 {payload['universe']} · {payload['count']}일 · {last['d']} "
              f"50일선 위 {last['above50']}% · 200일선 위 {last['above200']}% · 맥클렐런 {last['mcclellan']} · 신고 {last['nh']}/신저 {last['nl']}")
        out_json, out_js = MARKETS[m]["out"]
        sec.write_data(out_json, out_js, "MARKET_BREADTH", payload, indent=None, min_ratio=0.5)
        written += [str(out_json.relative_to(ROOT)), str(out_js.relative_to(ROOT))]
    if args.push and not sec.git_publish(written, f"Auto-update market breadth ({args.market})"):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
