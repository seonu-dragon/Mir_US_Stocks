#!/usr/bin/env python3
"""옵션 포지션 — 행사가별 감마 노출(GEX, 추정)과 이상 옵션 거래(Unusual Options Activity).

build_options_stats.py(가장 가까운 만기 하나의 풋콜·맥스페인)와 같은 야후 옵션 체인을 쓰되, 45일 안의 만기를
최대 MAX_EXPIRIES 개까지 받아 두 가지를 계산한다. 미국 장 마감 뒤(daily-market-snapshot)에 돈다 — 장 전엔
야후가 미결제약정(OI)을 0, 내재변동성(IV)을 엉터리로 준다(2026-10-22 장 전 실측: NVDA OI 0·IV 6%) — 거래가 있는
계약의 절반 넘게 OI 가 비어 있는 만기는 쓰지 않는다(oi_published). 그래서 장 전에 돌리면 0종목으로 끝나고 기존 파일을 지킨다.

GEX(감마 노출, 추정): 계약마다 블랙-숄즈 감마 Γ(IV·잔존일·무위험 RISK_FREE) × OI × 100 × S² × 1% — '주가 1% 움직일 때
딜러가 사고팔아야 하는 금액(USD)'. 딜러가 콜은 사고(+) 풋은 판(−) 일반적 가정이라 실제 포지션과 다를 수 있다
(화면에 '추정' 표시). 행사가별 순GEX, 합계, 콜 월(콜 GEX 최대 행사가)·풋 월(풋 GEX 최대)·감마 전환점(누적 순GEX 부호가
바뀌는 행사가)을 낸다. IV 가 [IV_MIN, IV_MAX] 밖이면 그 만기 IV 중앙값으로 대체하고, 그 만기에 정상 IV 가 없으면 만기째 뺀다.

맥스페인(가장 가까운 쓸 수 있는 만기 하나): 만기 정산가 후보(그 만기 모든 행사가) 중 옵션 매수자에게 지급되는 총액
Σ_call max(0, S-K)·OI + Σ_put max(0, K-S)·OI 가 최소인 행사가(max_pain). 종목별 maxPain·maxPainExpiry.

이상 거래(UOA): 그날 거래량이 미결제약정의 UOA_RATIO 배 이상이고 거래량 ≥ UOA_MIN_VOL·추정 거래대금(거래량 × 중간가 × 100)
≥ UOA_MIN_PREMIUM 인 계약. 거래대금 순 상위.

산출물: data/options_flow.json + .js (window.OPTIONS_FLOW, 미국 전용·lazy).
실행: py scripts/build_options_flow.py [--top 80] [--push]
"""

from __future__ import annotations

import argparse
import json
import math
import statistics
import sys
import time
import urllib.parse
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
OUT_JSON = ROOT / "data" / "options_flow.json"
OUT_JS = ROOT / "data" / "options_flow.js"
SNAPSHOT = ROOT / "data" / "market_snapshot.json"
EXTRA = ["SPY", "QQQ", "IWM"]          # 지수 ETF — GEX 를 가장 많이 보는 대상
MAX_DAYS = 45
MAX_EXPIRIES = 8
STRIKE_BAND = 0.15                      # 화면·파일에 남기는 행사가 범위(현재가 ±15%)
RISK_FREE = 0.04
IV_MIN, IV_MAX = 0.05, 3.0
OI_MIN_SHARE = 0.5
UOA_RATIO = 2.0
UOA_MIN_VOL = 1000
UOA_MIN_PREMIUM = 250_000
UOA_PER_TICKER = 5
UOA_MARKET = 30


def kst_now_str() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def bs_gamma(spot: float, strike: float, iv: float, years: float) -> float:
    """블랙-숄즈 감마(콜·풋 같음). 입력이 비정상이면 0."""
    if spot <= 0 or strike <= 0 or iv <= 0 or years <= 0:
        return 0.0
    vs = iv * math.sqrt(years)
    d1 = (math.log(spot / strike) + (RISK_FREE + iv * iv / 2) * years) / vs
    return math.exp(-d1 * d1 / 2) / math.sqrt(2 * math.pi) / (spot * vs)


def _num(v):
    return float(v) if isinstance(v, (int, float)) and math.isfinite(v) else None


def clean_leg(rows: list, kind: str) -> list[dict]:
    """야후 calls/puts → [{k, oi, vol, iv, mid, kind}] — 행사가 없는 행은 뺀다."""
    out = []
    for r in rows or []:
        k = _num(r.get("strike"))
        if not k:
            continue
        bid, ask = _num(r.get("bid")), _num(r.get("ask"))
        mid = (bid + ask) / 2 if bid is not None and ask and ask > 0 else _num(r.get("lastPrice"))
        out.append({"k": k, "oi": _num(r.get("openInterest")) or 0.0, "vol": _num(r.get("volume")) or 0.0,
                    "iv": _num(r.get("impliedVolatility")), "mid": mid, "kind": kind})
    return out


def oi_published(contracts: list[dict]) -> bool:
    """이 만기의 미결제약정이 실제로 실렸는가. 장 전·장중엔 야후가 OI 를 0 으로 준다 — 거래가 있는 계약 중
    OI 가 있는 비율이 OI_MIN_SHARE 미만이면 그 만기는 쓰지 않는다(전부 '이상 거래'로 잡히고 GEX 가 0 이 된다)."""
    traded = [c for c in contracts if c["vol"] > 0]
    if not traded:
        return False
    return sum(1 for c in traded if c["oi"] > 0) / len(traded) >= OI_MIN_SHARE


def fix_iv(contracts: list[dict]) -> bool:
    """IV 가 범위 밖인 계약은 같은 만기 정상 IV 중앙값으로. 정상 IV 가 하나도 없으면 False(만기째 버림)."""
    ok = [c["iv"] for c in contracts if c["iv"] is not None and IV_MIN <= c["iv"] <= IV_MAX]
    if not ok:
        return False
    med = statistics.median(ok)
    for c in contracts:
        if c["iv"] is None or not (IV_MIN <= c["iv"] <= IV_MAX):
            c["iv"] = med
    return True


def gex_profile(spot: float, expiries: list[tuple[float, list[dict]]]) -> dict | None:
    """[(잔존 연수, 계약…)] → 행사가별 콜·풋 GEX(USD, 1% 기준)와 요약. OI 가 하나도 없으면 None."""
    by_k: dict[float, list[float]] = {}
    for years, contracts in expiries:
        for c in contracts:
            if c["oi"] <= 0:
                continue
            g = bs_gamma(spot, c["k"], c["iv"], years) * c["oi"] * 100 * spot * spot * 0.01
            slot = by_k.setdefault(c["k"], [0.0, 0.0])
            if c["kind"] == "C":
                slot[0] += g
            else:
                slot[1] -= g
    if not by_k:
        return None
    strikes = sorted(by_k)
    net_total = sum(c + p for c, p in by_k.values())
    call_wall = max(strikes, key=lambda k: by_k[k][0])
    put_wall = min(strikes, key=lambda k: by_k[k][1])
    # 감마 전환점: 낮은 행사가부터 누적 순GEX 의 부호가 바뀌는 첫 행사가(현재가에서 가장 가까운 것)
    flips, cum, prev = [], 0.0, None
    for k in strikes:
        cum += by_k[k][0] + by_k[k][1]
        if prev is not None and (prev < 0 <= cum or prev > 0 >= cum):
            flips.append(k)
        prev = cum
    flip = min(flips, key=lambda k: abs(k - spot)) if flips else None
    lo, hi = spot * (1 - STRIKE_BAND), spot * (1 + STRIKE_BAND)
    band = [[k, round(by_k[k][0]), round(by_k[k][1])] for k in strikes if lo <= k <= hi]
    return {"netGex": round(net_total), "callWall": call_wall, "putWall": put_wall, "flip": flip, "strikes": band}


def max_pain(contracts: list[dict]) -> float | None:
    """한 만기 계약들 → 매수자 총 지급액이 최소인 행사가. OI 있는 계약이 없거나 행사가가 3개 미만이면 None."""
    live = [c for c in contracts if c["oi"] > 0]
    strikes = sorted({c["k"] for c in contracts})
    if not live or len(strikes) < 3:
        return None
    best_s, best_val = None, None
    for s in strikes:
        val = 0.0
        for c in live:
            if c["kind"] == "C" and s > c["k"]:
                val += (s - c["k"]) * c["oi"]
            elif c["kind"] == "P" and c["k"] > s:
                val += (c["k"] - s) * c["oi"]
        if best_val is None or val < best_val:
            best_val, best_s = val, s
    return best_s


def unusual(ticker: str, expiry: str, contracts: list[dict]) -> list[list]:
    """이상 거래 계약 → [티커, 만기, C|P, 행사가, 거래량, OI, 거래량/OI, IV%, 추정 거래대금]."""
    out = []
    for c in contracts:
        vol, oi, mid = c["vol"], c["oi"], c["mid"]
        if vol < UOA_MIN_VOL or not mid or mid <= 0:
            continue
        if oi <= 0:                       # 새로 연 계약(OI 0)은 비율을 알 수 없다 — 이상 거래로 세지 않는다
            continue
        ratio = vol / oi
        if ratio < UOA_RATIO:
            continue
        prem = vol * mid * 100
        if prem < UOA_MIN_PREMIUM:
            continue
        out.append([ticker, expiry, c["kind"], c["k"], int(vol), int(oi), round(ratio, 1),
                    round((c["iv"] or 0) * 100, 1), round(prem)])
    return out


def universe(top: int) -> list[str]:
    snap = json.loads(SNAPSHOT.read_text(encoding="utf-8")) if SNAPSHOT.exists() else {"stocks": []}
    stocks = [s for s in snap.get("stocks") or [] if s.get("sector") != "EXCHANGE TRADED FUNDS" and s.get("ticker")]
    stocks.sort(key=lambda s: float(s.get("marketCapB") or 0), reverse=True)
    return EXTRA + [str(s["ticker"]).upper() for s in stocks[:top] if str(s["ticker"]).upper() not in EXTRA]


def build(top: int, client=None, sleep_s: float = 0.25, now: datetime | None = None) -> dict | None:
    from build_options_stats import Yahoo
    y = client or Yahoo()
    if client is None and not y.auth():
        print("[options-flow] 크럼 인증 실패 — 기존 파일 유지")
        return None
    now = now or datetime.now(timezone.utc)
    tickers, uoa_all = {}, []
    for t in universe(top):
        first = y.options(t)
        time.sleep(sleep_s)
        if not first:
            continue
        spot = _num((first.get("quote") or {}).get("regularMarketPrice"))
        if not spot:
            continue
        exps = sorted(e for e in first.get("expirationDates") or [] if 0 < (e - now.timestamp()) / 86400 <= MAX_DAYS)[:MAX_EXPIRIES]
        chains, uoa = [], []
        mp, mp_exp = None, None
        for e in exps:
            if (first.get("options") or [{}])[0].get("expirationDate") == e:
                opt = first["options"][0]
            else:
                url = (f"https://query1.finance.yahoo.com/v7/finance/options/{urllib.parse.quote(t)}"
                       f"?date={e}&crumb={urllib.parse.quote(y.crumb)}")
                try:
                    res = (json.loads(y._get(url)).get("optionChain") or {}).get("result") or []
                    opt = (res[0].get("options") or [None])[0] if res else None
                except Exception:  # noqa: BLE001
                    opt = None
                time.sleep(sleep_s)
            if not opt:
                continue
            contracts = clean_leg(opt.get("calls"), "C") + clean_leg(opt.get("puts"), "P")
            if not oi_published(contracts) or not fix_iv(contracts):
                continue
            years = max((e - now.timestamp()) / 86400, 0.5) / 365
            chains.append((years, contracts))
            exp_iso = datetime.fromtimestamp(e, timezone.utc).strftime("%Y-%m-%d")
            if mp_exp is None:                  # 만기는 가까운 순 — 처음 쓸 수 있는 만기만
                mp = max_pain(contracts)
                if mp is not None:
                    mp_exp = exp_iso
            uoa += unusual(t, exp_iso, contracts)
        prof = gex_profile(spot, chains)
        if not prof:
            continue
        uoa.sort(key=lambda r: -r[8])
        tickers[t] = {"spot": round(spot, 2), "expiries": len(chains), **prof,
                      "maxPain": mp, "maxPainExpiry": mp_exp, "uoa": uoa[:UOA_PER_TICKER]}
        uoa_all += uoa
    if not tickers:
        return None
    uoa_all.sort(key=lambda r: -r[8])
    return {
        "updatedAtKst": kst_now_str(), "source": "Yahoo Finance options (45일 안 만기, 장 마감 뒤)",
        "count": len(tickers), "riskFree": RISK_FREE, "maxDays": MAX_DAYS,
        "uoaCols": ["ticker", "expiry", "type", "strike", "volume", "oi", "volOi", "ivPct", "premium"],
        "uoa": uoa_all[:UOA_MARKET], "tickers": tickers,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="옵션 포지션(GEX·이상 거래)")
    ap.add_argument("--top", type=int, default=80)
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()
    print(f"=== 옵션 포지션 수집 (Yahoo, 지수 ETF 3 + 시총 상위 {args.top}) ===")
    try:
        payload = build(args.top)
    except Exception as exc:  # noqa: BLE001
        print(f"[options-flow] 수집 실패({type(exc).__name__}: {exc}) — 기존 파일 유지")
        return 1
    if not payload:
        print("[options-flow] 유효 데이터 없음 — 기존 파일 유지")
        return 1
    spy = payload["tickers"].get("SPY") or {}
    print(f"[options-flow] {payload['count']}종목 · 이상 거래 {len(payload['uoa'])}건 · SPY 순GEX {spy.get('netGex')} "
          f"콜 월 {spy.get('callWall')} 풋 월 {spy.get('putWall')} 전환 {spy.get('flip')}")
    sec.write_data(OUT_JSON, OUT_JS, "OPTIONS_FLOW", payload, indent=None, min_ratio=0.5)
    if args.push and not sec.git_publish([str(OUT_JSON.relative_to(ROOT)), str(OUT_JS.relative_to(ROOT))], "options flow (GEX/UOA)"):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
