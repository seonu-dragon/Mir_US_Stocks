#!/usr/bin/env python3
"""공시 반응 분석용 일봉 아카이브 — 사이트 빌드와 분리된 일회성 수집.

왜 별도인가:
  Phase 1(update_korea_data.recent_disclosure_symbols)은 '최근 7일 공시를 낸 916종목'
  에만 일봉을 받는다. 사이트가 매일 필요로 하는 범위다(차트에 공시 마커 등).
  그런데 5년 백필에는 2,585종목이 등장한다. 그 차이(≈1,000종목)를 매일 받으면 일일
  빌드가 +19분이 되는데, 통계는 분기에 한 번 갱신해도 충분하다. 매일 내는 비용으로
  가끔 쓰는 값을 사는 셈이라 맞지 않는다.

  그래서 통계 계산용 일봉은 여기서 '일회성' 으로 모아 아카이브에 둔다. 사이트는 이
  파일을 읽지 않는다(.gitignore: data/korea/_archive/).

details/*.json 에 이미 chartSeries 가 있으면 그걸 쓰고, 없는 종목만 야후에서 받는다.

Requires: 백필(backfill_kr_disclosures.py)이 먼저 돌아 있어야 대상 종목을 안다.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from update_korea_data import fetch_yahoo_history_kr, yahoo_ticker  # noqa: E402

ARCHIVE = ROOT / "data" / "korea" / "_archive"
HIST_DIR = ARCHIVE / "history"
DETAILS = ROOT / "data" / "korea" / "details"
KR_SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"

MIN_BARS = 60          # 이보다 짧으면 반응 계산에 못 쓴다


def backfill_tickers() -> set[str]:
    """백필 아카이브에 등장하는 모든 종목."""
    out: set[str] = set()
    files = sorted(ARCHIVE.glob("disclosures_*.json"))
    if not files:
        raise SystemExit("[아카이브] 백필 결과가 없다 — backfill_kr_disclosures.py 를 먼저 돌려야 한다.")
    for f in files:
        try:
            for r in json.loads(f.read_text(encoding="utf-8")).get("rows") or []:
                out.add(r["t"])
        except Exception as exc:
            print(f"  [경고] {f.name} 읽기 실패: {exc}")
    return out


def existing_bars(ticker: str) -> int:
    """details 에 이미 있는 일봉 수. 있으면 다시 받지 않는다."""
    f = DETAILS / f"{ticker}.json"
    if not f.exists():
        return 0
    try:
        return len(json.loads(f.read_text(encoding="utf-8")).get("chartSeries") or [])
    except Exception:
        return 0


def archived_bars(ticker: str) -> int:
    f = HIST_DIR / f"{ticker}.json"
    if not f.exists():
        return 0
    try:
        return len(json.loads(f.read_text(encoding="utf-8")).get("rows") or [])
    except Exception:
        return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="공시 반응 분석용 일봉 아카이브(일회성)")
    ap.add_argument("--limit", type=int, default=None, help="N종목만(테스트용)")
    ap.add_argument("--refetch", action="store_true", help="이미 받은 것도 다시")
    args = ap.parse_args()

    HIST_DIR.mkdir(parents=True, exist_ok=True)
    try:
        snap = json.loads(KR_SNAPSHOT.read_text(encoding="utf-8"))
    except Exception as exc:
        raise SystemExit(f"[아카이브] KR 스냅샷을 못 읽었다: {exc}")
    info = {s["ticker"]: s for s in snap.get("stocks") or []}

    tickers = sorted(backfill_tickers())
    need, reuse = [], 0
    for t in tickers:
        if t not in info:
            continue                     # 유니버스 밖(상폐 등) — 야후 심볼을 모른다
        if existing_bars(t) >= MIN_BARS:
            reuse += 1
            continue
        if not args.refetch and archived_bars(t) >= MIN_BARS:
            reuse += 1
            continue
        need.append(t)
    if args.limit:
        need = need[: args.limit]

    print(f"[아카이브] 백필 등장 {len(tickers)}종목")
    print(f"  details 나 아카이브에 이미 있음: {reuse}")
    print(f"  새로 받을 종목: {len(need)}  (약 {len(need) * 0.7 / 60:.0f}분)")

    ok = fail = 0
    t0 = time.time()
    for i, t in enumerate(need, 1):
        if i % 200 == 0:
            print(f"  {i}/{len(need)} … ({(time.time()-t0)/60:.0f}분)")
        s = info[t]
        ysym = s.get("yahooSymbol") or yahoo_ticker(t, s.get("market"))
        try:
            # fetch_yahoo_history_kr 는 (rows, dividends) 를 돌려준다 — 여기선 봉만 쓴다.
            rows, _divs = fetch_yahoo_history_kr(ysym)
            rows = rows or []
        except Exception:
            rows = []
        if len(rows) < MIN_BARS:
            fail += 1
            continue
        (HIST_DIR / f"{t}.json").write_text(
            json.dumps({"ticker": t, "yahooSymbol": ysym, "count": len(rows), "rows": rows},
                       ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        ok += 1

    print(f"[아카이브] 성공 {ok} · 실패 {fail} · {(time.time()-t0)/60:.0f}분")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
