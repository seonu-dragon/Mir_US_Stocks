#!/usr/bin/env python3
"""종목별 수급·컨센서스 수집 — 검증용 아카이브.

엔드포인트가 둘 필요하다:
  /trend?pageSize=60   수급 60거래일. 이쪽이 이력을 준다.
  /integration         컨센서스 목표주가(priceTargetMean) + 투자의견(recommMean).
                       수급(dealTrendInfos)도 들어 있지만 5일치뿐이라 검정엔 못 쓴다.

한계(실측):
  - 수급은 최대 60거래일(약 3개월)이다. pageSize 70+ 는 400, page 파라미터는 무시된다
    (page=1 이든 40 이든 같은 응답). 그래서 과거로 더 파고들 방법이 없다.
  - 그 60일이 곧 '서로 다른 날짜 60개' 라, 공시 통계에서 쓴 무작위-날짜 대조군
    방식은 통계력이 안 나온다. 검정은 횡단면(같은 날 종목 간 비교)으로 해야 한다.
  - 순매수는 '수량' 이지 금액이 아니다. 종목 간 비교하려면 거래량으로 정규화해야 한다.

산출물은 아카이브(gitignored)다. 사이트가 읽는 파일은 검증을 통과한 뒤에 만든다.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

KR_SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"
OUT_DIR = ROOT / "data" / "korea" / "_archive" / "flow"
HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json",
    "Referer": "https://m.stock.naver.com/",
}
MIN_INTERVAL = 0.12          # 실측 20/초도 통과했지만 남의 서버다 — 8/초로 낮춘다
_last = [0.0]


def throttle():
    gap = MIN_INTERVAL - (time.monotonic() - _last[0])
    if gap > 0:
        time.sleep(gap)
    _last[0] = time.monotonic()


FLOW_DAYS = 60          # 실측 상한. 70 이상은 400.


def fetch(url: str, tries: int = 3):
    for attempt in range(tries):
        throttle()
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=15) as r:
                return json.loads(r.read().decode("utf-8", "replace"))
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None                  # 상장폐지·펀드 등 — 재시도 의미 없다
            if attempt == tries - 1:
                return None
            time.sleep(0.5 * (attempt + 1))
        except Exception:
            if attempt == tries - 1:
                return None
            time.sleep(0.5 * (attempt + 1))
    return None


def qnum(v):
    """'-826,076' / '+5,211,886' / '46.59%' → float."""
    if v is None:
        return None
    s = str(v).replace(",", "").replace("%", "").replace("+", "").strip()
    if not s or s == "-":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def main() -> int:
    ap = argparse.ArgumentParser(description="KR 수급·컨센서스 수집(검증용)")
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()

    snap = json.loads(KR_SNAPSHOT.read_text(encoding="utf-8"))
    stocks = [s for s in snap.get("stocks") or [] if s.get("sector") != "ETF"]
    stocks.sort(key=lambda s: s.get("marketCapB") or 0, reverse=True)
    if args.limit:
        stocks = stocks[: args.limit]
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"[수급] {len(stocks)}종목 (ETF 제외) · 초당 {1/MIN_INTERVAL:.0f}회 → 약 "
          f"{len(stocks)*MIN_INTERVAL/60:.0f}분")
    ok = 0
    no_flow = 0
    no_cons = 0
    t0 = time.time()
    for i, s in enumerate(stocks, 1):
        t = str(s["ticker"]).zfill(6)
        if i % 400 == 0:
            print(f"  {i}/{len(stocks)} … ({(time.time()-t0)/60:.0f}분)")
        base = f"https://m.stock.naver.com/api/stock/{t}"
        # 수급 이력은 /trend 에서만 온다. /integration 의 dealTrendInfos 는 5일치뿐이다.
        trend = fetch(f"{base}/trend?pageSize={FLOW_DAYS}&page=1")
        d = fetch(f"{base}/integration")
        if not trend and not d:
            continue
        d = d or {}
        rows = []
        for r in trend or []:
            rows.append({
                "d": r.get("bizdate"),
                "frn": qnum(r.get("foreignerPureBuyQuant")),
                "org": qnum(r.get("organPureBuyQuant")),
                "ind": qnum(r.get("individualPureBuyQuant")),
                "frnHold": qnum(r.get("foreignerHoldRatio")),
                "vol": qnum(r.get("accumulatedTradingVolume")),
                "close": qnum(r.get("closePrice")),
            })
        c = d.get("consensusInfo") or {}
        rec = {
            "ticker": t,
            "name": d.get("stockName"),
            "flow": rows,
            "targetPrice": qnum(c.get("priceTargetMean")),
            "recommMean": qnum(c.get("recommMean")),
            "consensusDate": c.get("createDate"),
        }
        if not rows:
            no_flow += 1
        if rec["targetPrice"] is None:
            no_cons += 1
        (OUT_DIR / f"{t}.json").write_text(
            json.dumps(rec, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        ok += 1

    print(f"[수급] 저장 {ok}/{len(stocks)} · 수급없음 {no_flow} · 컨센서스없음 {no_cons} "
          f"· {(time.time()-t0)/60:.1f}분")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
