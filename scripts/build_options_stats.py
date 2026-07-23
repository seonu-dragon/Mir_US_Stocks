#!/usr/bin/env python3
"""옵션 심리 — 풋/콜 비율 + 맥스페인 (Yahoo 옵션, 무료).

지수·주가만으로 안 보이는 옵션시장의 포지셔닝을 본다. 두 지표 모두 '신호'가 아니라
참고용 심리·수급 지표다:
  - 풋/콜 비율(미결제약정 기준): 풋 OI 합 / 콜 OI 합. 1보다 크면 방어적(헤지·약세 베팅)
    포지션이 상대적으로 많다는 뜻. 다만 헤지와 방향성 베팅이 섞여 있어 역발상 지표로도
    쓰이는 등 해석이 갈린다.
  - 맥스페인: 만기일에 옵션 매수자의 총 손실이 최대(=매도자 지급액 최소)가 되는 행사가.
    '주가가 만기에 이 근처로 끌린다'는 속설이 있으나 학술적으로 논쟁적 — 매매 신호 아님.

Yahoo 옵션 엔드포인트는 쿠키+크럼 세션을 요구한다(quoteSummary 와 동일). 크럼만으로도
동작하는 경우가 많아 크럼 우선, 실패 시 스킵하고 기존 파일을 유지한다(지어내지 않는다).

산출물: data/options_stats.json + data/options_stats.js(window.OPTIONS_STATS).
"""

from __future__ import annotations

import argparse
import http.cookiejar
import json
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path
from briefing_store import atomic_write_text  # 중단 시 잘린 JSON 방지

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / "data" / "market_snapshot.json"
OUT_JSON = ROOT / "data" / "options_stats.json"
OUT_JS = ROOT / "data" / "options_stats.js"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"}


def kst_now_str() -> str:
    return datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M KST")


class Yahoo:
    def __init__(self):
        self.cj = http.cookiejar.CookieJar()
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cj))
        self.crumb = ""

    def _get(self, url, timeout=20):
        req = urllib.request.Request(url, headers=UA)
        with self.op.open(req, timeout=timeout) as r:
            return r.read()

    def auth(self) -> bool:
        for host in ("https://fc.yahoo.com", "https://finance.yahoo.com"):
            try:
                self._get(host)
            except Exception:
                pass  # 쿠키만 얻으면 되므로 404 여도 무시
        for _ in range(3):
            try:
                crumb = self._get("https://query1.finance.yahoo.com/v1/test/getcrumb").decode("utf-8", "replace").strip()
                if crumb and "<" not in crumb:
                    self.crumb = crumb
                    return True
            except Exception:
                time.sleep(1)
        return False

    def options(self, ticker: str) -> dict | None:
        url = (f"https://query1.finance.yahoo.com/v7/finance/options/{urllib.parse.quote(ticker)}"
               f"?crumb={urllib.parse.quote(self.crumb)}")
        try:
            data = json.loads(self._get(url))
        except Exception:
            return None
        res = (data.get("optionChain") or {}).get("result") or []
        return res[0] if res else None


def max_pain(calls: list, puts: list) -> float | None:
    """만기 정산가 S 후보(모든 행사가)에 대해 옵션 매수자에게 지급되는 총액을 최소화하는 S.
    지급액(S) = Σ_call max(0, S-K)*OI + Σ_put max(0, K-S)*OI. 최소가 맥스페인."""
    strikes = sorted({c["strike"] for c in calls} | {p["strike"] for p in puts})
    if len(strikes) < 3:
        return None
    best_s, best_val = None, None
    for s in strikes:
        val = 0.0
        for c in calls:
            if s > c["strike"]:
                val += (s - c["strike"]) * c["oi"]
        for p in puts:
            if p["strike"] > s:
                val += (p["strike"] - s) * p["oi"]
        if best_val is None or val < best_val:
            best_val, best_s = val, s
    return best_s


def parse_leg(rows: list) -> list:
    out = []
    for r in rows or []:
        try:
            k = float(r.get("strike"))
        except (TypeError, ValueError):
            continue
        oi = r.get("openInterest") or 0
        vol = r.get("volume") or 0
        bid, ask = r.get("bid"), r.get("ask")
        if isinstance(bid, (int, float)) and isinstance(ask, (int, float)) and ask > 0:
            price = (bid + ask) / 2
        else:
            lp = r.get("lastPrice")
            price = float(lp) if isinstance(lp, (int, float)) else None
        out.append({"strike": k, "oi": float(oi or 0), "vol": float(vol or 0), "price": price})
    return out


def expected_move_pct(calls: list, puts: list, spot: float) -> float | None:
    """ATM 스트래들(= 등가격 콜+풋 프리미엄)로 만기까지 시장이 반영한 예상 변동폭%.
    옵션시장이 '이 만기까지 대략 ±이만큼 움직일 것'으로 값을 매긴 크기다."""
    if not (spot and spot > 0):
        return None

    def nearest(leg):
        cand = [o for o in leg if o.get("price") and o["price"] > 0]
        return min(cand, key=lambda o: abs(o["strike"] - spot)) if cand else None
    c = nearest(calls)
    p = nearest(puts)
    if not c or not p:
        return None
    straddle = c["price"] + p["price"]
    return round(straddle / spot * 100, 1)


def build(top: int) -> dict | None:
    snap = json.loads(SNAPSHOT.read_text(encoding="utf-8")) if SNAPSHOT.exists() else {"stocks": []}
    stocks = [s for s in (snap.get("stocks") or []) if s.get("sector") != "EXCHANGE TRADED FUNDS" and s.get("ticker")]
    stocks.sort(key=lambda s: float(s.get("marketCapB") or 0), reverse=True)
    tickers = [str(s["ticker"]).upper() for s in stocks[:top]]

    y = Yahoo()
    if not y.auth():
        print("[options] 크럼 인증 실패 — 기존 파일 유지")
        return None

    out = {}
    mkt_put_oi = mkt_call_oi = mkt_put_vol = mkt_call_vol = 0.0
    as_of = ""
    done = 0
    for t in tickers:
        done += 1
        res = y.options(t)
        time.sleep(0.25)
        if not res:
            continue
        opts = (res.get("options") or [])
        if not opts:
            continue
        exp = opts[0]
        calls = parse_leg(exp.get("calls"))
        puts = parse_leg(exp.get("puts"))
        call_oi = sum(c["oi"] for c in calls)
        put_oi = sum(p["oi"] for p in puts)
        call_vol = sum(c["vol"] for c in calls)
        put_vol = sum(p["vol"] for p in puts)
        if call_oi + put_oi < 200:  # 유동성 얕은 종목은 제외
            continue
        mp = max_pain(calls, puts)
        price = (res.get("quote") or {}).get("regularMarketPrice")
        em = expected_move_pct(calls, puts, float(price)) if price else None
        exp_ts = exp.get("expirationDate")
        exp_date = datetime.fromtimestamp(exp_ts, timezone.utc).strftime("%Y-%m-%d") if exp_ts else ""
        as_of = max(as_of, exp_date)
        out[t] = {
            "putCallOI": round(put_oi / call_oi, 2) if call_oi else None,
            "putCallVol": round(put_vol / call_vol, 2) if call_vol else None,
            "maxPain": mp,
            "expectedMovePct": em,
            "price": round(float(price), 2) if price else None,
            "expiry": exp_date,
            "callOI": int(call_oi),
            "putOI": int(put_oi),
        }
        mkt_put_oi += put_oi; mkt_call_oi += call_oi
        mkt_put_vol += put_vol; mkt_call_vol += call_vol
        if done % 20 == 0:
            print(f"  진행 {done}/{len(tickers)} (수집 {len(out)})")

    if not out:
        return None
    market = {
        "putCallOI": round(mkt_put_oi / mkt_call_oi, 2) if mkt_call_oi else None,
        "putCallVol": round(mkt_put_vol / mkt_call_vol, 2) if mkt_call_vol else None,
        "tickers": len(out),
    }
    return {"updatedAtKst": kst_now_str(), "source": "Yahoo Finance options (nearest expiry, OI 기준)",
            "market": market, "stocks": out}


def main() -> int:
    ap = argparse.ArgumentParser(description="옵션 심리(풋콜·맥스페인)")
    ap.add_argument("--top", type=int, default=60)
    args = ap.parse_args()
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    print(f"=== 옵션 심리 수집 (Yahoo, 상위 {args.top}) ===")
    try:
        payload = build(args.top)
    except Exception as e:  # noqa: BLE001
        print(f"[options] 수집 실패({type(e).__name__}: {e}) — 기존 파일 유지")
        return 1
    if not payload:
        print("[options] 유효 데이터 없음 — 기존 파일 유지")
        return 1
    from sec_client import merge_previous_stocks
    payload = merge_previous_stocks(payload, OUT_JSON, "options")
    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    atomic_write_text(OUT_JSON, compact)
    atomic_write_text(OUT_JS, f"window.OPTIONS_STATS = {compact};\n")
    print(f"수집 {payload['market']['tickers']}종목 · 시장 풋콜(OI) {payload['market']['putCallOI']}")
    print(f"Wrote {OUT_JSON.name}, {OUT_JS.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
