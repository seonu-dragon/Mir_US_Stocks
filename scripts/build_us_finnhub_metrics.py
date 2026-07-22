#!/usr/bin/env python3
"""미국 밸류에이션 보강 — Finnhub /stock/metric.

야후 기반 map_fundamentals 에는 네 지표가 사실상 비어 있어서, 히트맵 색상 기준으로
고르면 화면이 통째로 회색이 됐다(그래서 커버리지 게이트가 숨기고 있다):

    peg 0.3% · pfcf 0.5% · evEbitda 0.8% · divYield 1.9%   (5,732종목 기준)

Finnhub 무료 티어가 이 넷을 다 준다(실측: 표본 5/5 성공, 133개 필드):
    pegTTM · evEbitdaTTM · currentEv/freeCashFlowTTM · dividendYieldIndicatedAnnual

주의:
  - 무료 티어는 '미국만' 이다. 한국(005930.KS)은 403 — KR PEG 문제는 이걸로 못 푼다.
  - 종목당 1회라 5,733종목 전부는 무리다. 시총 상위 N(기본 1,000)만 받는다.
    무료 티어는 분당 60회 → 초당 1회로 페이싱한다. 1,000종목 ≈ 18분.
  - evEbitdaTTM 이 맞는 필드다. enterpriseValueOverEBITDA 는 None 으로 온다.

산출물은 별도 파일이다. details/*.json 은 update_data.py 가 매일 새로 만들어서
거기 써넣으면 지워진다 — build_map_fundamentals 가 이 파일을 읽어 병합한다.

.js 짝은 만들지 않는다. 다른 빌더와 달리 이건 브라우저가 읽는 피처 데이터가 아니라
파이썬만 읽는 중간 산출물이다(브라우저엔 병합 결과인 map_fundamentals.js 로 간다).
짝을 만들면 아무도 로드하지 않는 48KB 를 Pages 로 실어보내게 된다.

Requires FINNHUB_API_KEY.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402

KST = ZoneInfo("Asia/Seoul")
OUT_JSON = ROOT / "data" / "us_finnhub_metrics.json"
SNAPSHOT = ROOT / "data" / "market_snapshot.json"
BASE = "https://finnhub.io/api/v1"

# Finnhub 필드 → 우리 지도 키. 야후가 못 채우던 넷만 가져온다.
FIELD_MAP = {
    "pegTTM": "peg",
    "evEbitdaTTM": "evEbitda",
    "currentEv/freeCashFlowTTM": "pfcf",
    "dividendYieldIndicatedAnnual": "divYield",
}


def now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def num(v):
    if not isinstance(v, (int, float)) or isinstance(v, bool):
        return None
    if v != v:
        return None
    return round(float(v), 4)


# 무료 티어는 분당 60회(초당 1회)다. 초당 1.5회로 쳤더니 1,000종목 중 85건이 429 로
# 유실됐고, 그 직후 누락분만 재시도하자 261건이 전부 429 로 튕겼다(리밋 소진).
# 데이터가 없어서가 아니라 못 받은 것이라, 그냥 넘기면 히트맵에서 영영 회색으로 남는다.
MIN_INTERVAL = 1.05
_last_call = [0.0]


def fetch_metric(symbol: str, key: str, errors: dict, tries: int = 3):
    url = f"{BASE}/stock/metric?symbol={urllib.parse.quote(symbol)}&metric=all&token={key}"
    for attempt in range(tries):
        gap = MIN_INTERVAL - (time.time() - _last_call[0])
        if gap > 0:
            time.sleep(gap)
        _last_call[0] = time.time()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mir-US-Stocks/1.0"})
            with urllib.request.urlopen(req, timeout=20) as r:
                return json.loads(r.read().decode("utf-8", "replace"))
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < tries - 1:
                time.sleep(2 * (attempt + 1))   # 백오프 후 같은 종목을 다시 친다
                continue
            errors[f"http:{e.code}"] = errors.get(f"http:{e.code}", 0) + 1
            return None
        except Exception as e:
            if attempt < tries - 1:
                time.sleep(1)
                continue
            errors[f"req:{type(e).__name__}"] = errors.get(f"req:{type(e).__name__}", 0) + 1
            return None
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description="US 밸류에이션 보강 (Finnhub)")
    ap.add_argument("--push", action="store_true")
    ap.add_argument("--limit", type=int, default=1000, help="시총 상위 N종목 (기본 1,000)")
    args = ap.parse_args()

    key = os.environ.get("FINNHUB_API_KEY", "").strip()
    if not key:
        # 키가 없다고 기존 파일을 빈 payload 로 덮으면 안 된다. 병합이 {} 가 되면서
        # 히트맵의 peg·pfcf·evEbitda·divYield 가 커버리지 게이트에 걸려 통째로
        # 사라진다 — 키를 깜빡한 실행 한 번이 멀쩡한 데이터를 날리는 셈이다.
        if OUT_JSON.exists():
            print("FINNHUB_API_KEY 미설정 — 기존 데이터를 유지하고 갱신만 건너뛴다.")
            return 0
        payload = {"updatedAtKst": now_kst(), "source": "Finnhub /stock/metric",
                   "note": "FINNHUB_API_KEY 미설정 — GitHub Secrets에 등록 후 workflow를 실행하세요.",
                   "count": 0, "metrics": {}}
        atomic_write_text(OUT_JSON, json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
        print("FINNHUB_API_KEY missing; wrote empty payload.")
        return 0

    try:
        snap = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    except Exception as exc:
        raise SystemExit(f"[finnhub] US 스냅샷을 못 읽었다: {exc}")

    stocks = [s for s in snap.get("stocks") or []
              if s.get("sector") != "EXCHANGE TRADED FUNDS"]
    stocks.sort(key=lambda s: s.get("marketCapB") if isinstance(s.get("marketCapB"), (int, float)) else 0,
                reverse=True)
    tickers = [s["ticker"] for s in stocks[:args.limit]]
    print(f"[finnhub] 시총 상위 {len(tickers)}종목 · 종목당 1회 (초당 1회 페이싱 → 약 {len(tickers)*MIN_INTERVAL/60:.0f}분)")

    out: dict[str, dict] = {}
    errors: dict[str, int] = {}
    t0 = time.time()
    for i, t in enumerate(tickers, 1):
        if i % 200 == 0:
            print(f"[finnhub] {i}/{len(tickers)} … ({(time.time()-t0)/60:.0f}분)")
        d = fetch_metric(t, key, errors)
        if not d:
            continue
        m = d.get("metric") or {}
        rec = {}
        for src, dst in FIELD_MAP.items():
            v = num(m.get(src))
            # PEG·P/FCF·EV/EBITDA 는 음수면 의미를 잃는다(적자·마이너스 성장).
            # 음수 배수를 '저평가 초록' 으로 칠하면 정반대로 읽힌다.
            if v is None:
                continue
            if dst in ("peg", "pfcf", "evEbitda") and v <= 0:
                continue
            if dst == "divYield" and v < 0:
                continue
            rec[dst] = v
        # 조회에 성공했는데 배당수익률이 없으면 '모름' 이 아니라 '무배당' 이다.
        # 확인: KO 2.57 · JNJ 2.17 · GOOGL 0.24 는 값이 오고, 무배당인 TSLA·BRK.B 는
        # None 이 온다. 회색(데이터 없음)으로 두면 배당 0% 라는 사실이 안 보이고,
        # 커버리지도 512/5,732(8.9%)에 그쳐 지표 자체가 화면에서 숨겨진다.
        # 조회에 실패한 종목은 여기 오지 않으므로 0 을 지어내지 않는다.
        if "divYield" not in rec:
            rec["divYield"] = 0.0
        if rec:
            out[t] = rec

    if errors:
        print(f"[finnhub] 오류 {sum(errors.values())}건: {errors}")
    if not out:
        print("[finnhub] 수집 0건 — 기존 파일을 덮어쓰지 않는다.")
        return 1

    # 이번에 못 받은 종목은 지난 값을 남긴다. 429 로 몇 개 놓친 실행이 기존 결과를
    # 통째로 날리면, 실행할 때마다 히트맵에서 종목이 나타났다 사라진다.
    fresh = len(out)
    if OUT_JSON.exists():
        try:
            prev = json.loads(OUT_JSON.read_text(encoding="utf-8")).get("metrics") or {}
            kept = 0
            for t, rec in prev.items():
                if t not in out:
                    out[t] = rec
                    kept += 1
            if kept:
                print(f"[finnhub] 이번에 못 받은 {kept}종목은 이전 값 유지")
        except Exception as exc:
            print(f"[finnhub] 이전 파일 병합 실패(무시): {exc}")

    counts = {}
    for rec in out.values():
        for k in rec:
            counts[k] = counts.get(k, 0) + 1

    payload = {
        "updatedAtKst": now_kst(),
        "source": "Finnhub /stock/metric (무료 티어, 미국 전용)",
        "note": "야후가 못 채우는 peg·evEbitda·pfcf·divYield 보강. 시총 상위 종목 한정.",
        "universe": len(tickers),
        "count": len(out),
        "coverage": counts,
        "metrics": out,
    }
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    atomic_write_text(OUT_JSON, text)
    print(f"[finnhub] {len(out)}종목 기록 (이번 실행 {fresh}종목, {(time.time()-t0)/60:.0f}분)")
    for k, v in sorted(counts.items(), key=lambda x: -x[1]):
        print(f"    {k:10s} {v}")

    if args.push:
        import sec_client as sec

        with repository_publish_lock(ROOT):
            if not sec.git_publish(
                ["data/us_finnhub_metrics.json"],
                "US Finnhub metrics",
            ):
                return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
