#!/usr/bin/env python3
"""국내 다년 재무 히스토리 — DART 연간 주요계정(fnlttMultiAcnt) 최대 10년치.

stockanalysis.com 벤치마크. 종목 상세에 매출·영업이익·순이익 + 자산·자본·부채 연간 추이를
보여주기 위한 데이터. Mir 스냅샷엔 다년 재무가 없어(US 0년·KR 1년) 이걸로 채운다.

reprt_code 11011(사업보고서=연간), fs_div CFS(연결) 우선. fnlttMultiAcnt 는 100개 corp_code
배치 조회라, 시총 상위 N 종목 × 10개년 = 몇십 회 호출이면 끝난다. build_kr_earnings 의
DART 인프라(fetch_batch/pick/계정명)를 재사용한다.

산출물: data/korea/financials_history.json (파이썬 상태 파일 — 브라우저는 안 읽음).
update_korea_data 의 attach_kr_financials_history 가 각 종목 detail 에 financialsHistory 로
붙인다(earningsHistory 와 동일 패턴). 그래서 .js/전역은 만들지 않는다.

Requires DART_API_KEY.
"""

from __future__ import annotations

import argparse
import datetime
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
except Exception:
    pass

from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402
from build_kr_disclosures import load_corp_map  # noqa: E402
from build_kr_earnings import (  # noqa: E402
    BATCH, REVENUE_NAMES, OPERATING_NAMES, NET_NAMES, ASSET_NAMES,
    fetch_batch, pick, now_kst,
)

EQUITY_NAMES = ("자본총계",)
DEBT_NAMES = ("부채총계",)
KR_SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"
OUT_JSON = ROOT / "data" / "korea" / "financials_history.json"


def year_range(n: int = 10) -> list[str]:
    # 올해 사업보고서는 아직 미제출(3월경)이라 전년도까지가 최신 연간이다.
    end = datetime.date.today().year - 1
    return [str(y) for y in range(end - n + 1, end + 1)]


def build(api_key: str, top: int | None, years: list[str]):
    snap = json.loads(KR_SNAPSHOT.read_text(encoding="utf-8")) if KR_SNAPSHOT.exists() else {"stocks": []}
    stocks = [s for s in (snap.get("stocks") or [])
              if s.get("sector") not in ("ETF", "etf", "EXCHANGE TRADED FUNDS")]
    stocks.sort(key=lambda s: s.get("marketCapB") if isinstance(s.get("marketCapB"), (int, float)) else 0, reverse=True)
    corp_map = load_corp_map(api_key)
    if not corp_map:
        raise SystemExit("[재무이력] corpCode.xml 수집 실패 — 중단한다.")
    pairs = []
    for s in stocks:
        t = str(s.get("ticker") or "").replace(".KS", "").replace(".KQ", "").zfill(6)
        corp = corp_map.get(t)
        if corp:
            pairs.append((t, corp))
    if top:
        pairs = pairs[:top]
    by_corp = {c: t for t, c in pairs}
    n_calls = -(-len(pairs) // BATCH) * len(years)
    print(f"[재무이력] {len(pairs)}종목 × {len(years)}개년 = 약 {n_calls}회 호출 (배치 {BATCH})")

    errors: dict[str, int] = {}
    hist: dict[str, dict] = {}  # ticker -> {year: {rev, op, net, assets, equity, debt}}
    for year in years:
        for i in range(0, len(pairs), BATCH):
            batch = [c for _, c in pairs[i:i + BATCH]]
            rows = fetch_batch(batch, year, "11011", api_key, errors)
            grouped: dict[tuple, list] = {}
            for r in rows:
                grouped.setdefault((r.get("corp_code"), r.get("fs_div") or ""), []).append(r)
            done = set()
            # CFS(연결) 를 먼저 — 없으면 OFS(별도).
            for (corp, fs), items in sorted(grouped.items(), key=lambda kv: kv[0][1] != "CFS"):
                if corp in done:
                    continue
                t = by_corp.get(corp)
                if not t:
                    continue
                rev = pick(items, REVENUE_NAMES)
                op = pick(items, OPERATING_NAMES)
                net = pick(items, NET_NAMES)
                assets = pick(items, ASSET_NAMES)
                eq = pick(items, EQUITY_NAMES)
                debt = pick(items, DEBT_NAMES)
                if rev is None and op is None and net is None:
                    continue
                hist.setdefault(t, {})[year] = {
                    k: int(v) for k, v in
                    [("rev", rev), ("op", op), ("net", net), ("assets", assets), ("equity", eq), ("debt", debt)]
                    if v is not None
                }
                done.add(corp)
        print(f"  {year}: 누적 {len(hist)}종목")

    out = {}
    for t, ys in hist.items():
        rows = [dict(y=int(y), **v) for y, v in sorted(ys.items())]
        if len(rows) >= 2:  # 1년짜리는 '추이'가 아니라 버린다
            out[t] = rows
    if errors:
        print(f"[재무이력] 오류 {sum(errors.values())}건: {dict(list(errors.items())[:4])}")
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="KR 다년 재무 히스토리(DART 연간)")
    ap.add_argument("--push", action="store_true")
    ap.add_argument("--top", type=int, default=1000, help="시총 상위 N 종목")
    ap.add_argument("--years", type=int, default=10)
    args = ap.parse_args()
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")

    api_key = os.environ.get("DART_API_KEY", "").strip()
    if not api_key:
        atomic_write_text(OUT_JSON, json.dumps({"updatedAtKst": now_kst(), "note": "DART_API_KEY 미설정", "financials": {}}, ensure_ascii=False))
        print("DART_API_KEY missing; wrote empty financials history.")
        return 0

    years = year_range(args.years)
    print(f"=== KR 다년 재무 수집: {years[0]}~{years[-1]} ===")
    fin = build(api_key, args.top, years)
    payload = {"updatedAtKst": now_kst(), "source": "DART 연간 주요계정(fnlttMultiAcnt)",
               "count": len(fin), "years": years, "financials": fin}
    if not fin:
        print("[재무이력] 수집 0건 — 기존 파일 유지")
        return 0
    with repository_publish_lock(ROOT):
        OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
        atomic_write_text(OUT_JSON, json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
        print(f"Wrote {OUT_JSON} — {len(fin)}종목")
        if args.push:
            import sec_client as sec
            sec.git_publish(["data/korea/financials_history.json"], "KR financials history")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
