#!/usr/bin/env python3
"""일일 공매도량 — FINRA 규정 SHO 일별 공매도 거래량(무료·키 불필요).

기존 공매도잔고(short_interest)는 격주 갱신이라 느리다. FINRA 는 **매일** 거래소 통합
공매도 거래량/총거래량을 공개한다. 공매도 거래량 비율(shortVolume/totalVolume)은
그날 매도 압력의 단기 지표다(공매도잔고와 달리 데이 트레이딩·헤지도 포함되니 참고용).

  https://cdn.finra.org/equity/regsho/daily/CNMSshvol<YYYYMMDD>.txt
  Date|Symbol|ShortVolume|ShortExemptVolume|TotalVolume|Market

최근 영업일들을 뒤에서부터 받아(발표 지연 1~2일) 종목별 최근 비율 + 추이(sparkline)를
만든다. 스냅샷의 미국 종목만 남긴다. 값 없으면 기존 파일 유지.

산출물: data/finra_short_volume.json + .js(window.FINRA_SHORT_VOLUME).
"""

from __future__ import annotations

import json
import sys
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / "data" / "market_snapshot.json"
OUT_JSON = ROOT / "data" / "finra_short_volume.json"
OUT_JS = ROOT / "data" / "finra_short_volume.js"
UA = {"User-Agent": "Mir US Stocks research (dydtjsdn@gmail.com)"}
DAYS = 12   # 최근 며칠을 뒤에서부터 시도
WANT = 10   # 실제로 받을 파일 수(영업일)


def kst_now_str() -> str:
    return datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M KST")


def fetch_day(d: datetime):
    url = f"https://cdn.finra.org/equity/regsho/daily/CNMSshvol{d.strftime('%Y%m%d')}.txt"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
            return r.read().decode("utf-8", "replace")
    except Exception:
        return None


def parse(text: str, universe: set[str]) -> dict[str, float]:
    """{symbol: shortRatio(%)}. universe 로 필터해 파일 대비 소량만 남긴다."""
    out = {}
    for line in text.splitlines()[1:]:
        parts = line.split("|")
        if len(parts) < 5:
            continue
        sym = parts[1].strip().upper()
        if sym not in universe:
            continue
        try:
            sv = float(parts[2]); tv = float(parts[4])
        except ValueError:
            continue
        if tv > 0:
            out[sym] = round(sv / tv * 100, 1)
    return out


def build() -> dict | None:
    snap = json.loads(SNAPSHOT.read_text(encoding="utf-8")) if SNAPSHOT.exists() else {"stocks": []}
    universe = {str(s.get("ticker") or "").upper() for s in (snap.get("stocks") or [])
               if s.get("sector") != "EXCHANGE TRADED FUNDS" and s.get("ticker")}
    if not universe:
        return None

    days = []  # [(date_str, {sym: ratio}), ...] 오래된→최신
    d = datetime.now(timezone.utc)
    tried = 0
    got = 0
    while got < WANT and tried < DAYS + 8:
        text = fetch_day(d)
        tried += 1
        if text and text.startswith("Date|"):
            ratios = parse(text, universe)
            if ratios:
                days.append((d.strftime("%Y-%m-%d"), ratios))
                got += 1
        d -= timedelta(days=1)
    if not days:
        return None
    days.reverse()  # 오래된→최신
    as_of = days[-1][0]

    stocks = {}
    mkt_short = mkt_total = 0.0
    latest_ratios = days[-1][1]
    for sym, ratio in latest_ratios.items():
        hist = [dm[sym] for _, dm in days if sym in dm]
        stocks[sym] = {"ratio": ratio, "hist": hist}
    # 시장 평균 공매도 비율(최신일, 종목 단순 평균)
    if latest_ratios:
        mkt = round(sum(latest_ratios.values()) / len(latest_ratios), 1)
    else:
        mkt = None
    return {"updatedAtKst": kst_now_str(), "asOf": as_of, "days": len(days),
            "source": "FINRA 규정 SHO 일별 공매도 거래량(통합)",
            "market": {"avgShortRatio": mkt, "tickers": len(stocks)},
            "stocks": stocks}


def main() -> int:
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    print("=== 일일 공매도량 수집 (FINRA) ===")
    try:
        payload = build()
    except Exception as e:  # noqa: BLE001
        print(f"[finra] 수집 실패({type(e).__name__}: {e}) — 기존 파일 유지")
        return 0
    if not payload:
        print("[finra] 유효 데이터 없음 — 기존 파일 유지")
        return 0
    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    OUT_JSON.write_text(compact, encoding="utf-8")
    OUT_JS.write_text(f"window.FINRA_SHORT_VOLUME = {compact};\n", encoding="utf-8")
    print(f"as_of={payload['asOf']} · {payload['days']}일 · {payload['market']['tickers']}종목 "
          f"· 시장평균 공매도비율 {payload['market']['avgShortRatio']}%")
    print(f"Wrote {OUT_JSON.name}, {OUT_JS.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
