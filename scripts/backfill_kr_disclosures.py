#!/usr/bin/env python3
"""DART 공시 5년 백필 — 공시 반응 분석의 표본을 만든다.

일상 빌더(build_kr_disclosures.py)는 최근 7일만 본다. 공시가 주가에 어떤 영향을
줬는지 통계를 내려면 과거 표본이 필요한데, list.json 은 corp_code 없이 조회할 때
검색기간이 3개월로 제한된다(초과하면 status 100). 그래서 분기 창으로 쪼개 받는다.

실측(2026-07):
    분기 평균 38,210건 / 384페이지  (유가 Y + 코스닥 K 합산)
    5년(20분기) = 76만건 / 7,670회 호출 / 약 64분
    일일 한도 2만 회의 38% — 하루에 다 돌릴 수 있다.

산출물은 커밋하지 않는다(.gitignore: data/korea/_archive/). 76만건 원본을 저장소에
넣을 이유가 없다 — 브라우저가 읽는 건 최종 집계 파일이고, 원본이 필요하면 이
스크립트가 다시 만든다(DART 가 과거 데이터를 계속 준다).

분기별로 파일을 나눠 저장해 중단·재개가 된다(--resume 이 기본).

Requires DART_API_KEY.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from build_kr_disclosures import dart_get, type_label  # noqa: E402

KST = ZoneInfo("Asia/Seoul")
ARCHIVE = ROOT / "data" / "korea" / "_archive"
KR_SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"

MAX_PAGES = 600          # 안전장치. 분기당 최대 페이지(실측 최대 501)


def quarters(years: int, today: date | None = None):
    """(bgn, end, label) 을 최근 분기부터 과거로. 3개월 창 제한에 맞춘다."""
    today = today or datetime.now(KST).date()
    y, q = today.year, (today.month - 1) // 3 + 1
    for _ in range(years * 4):
        m0 = (q - 1) * 3 + 1
        bgn = date(y, m0, 1)
        end = date(y + (1 if q == 4 else 0), 1 if q == 4 else m0 + 3, 1)
        end = date.fromordinal(end.toordinal() - 1)      # 분기 마지막 날
        if end > today:
            end = today
        yield bgn.strftime("%Y%m%d"), end.strftime("%Y%m%d"), f"{y}Q{q}"
        q -= 1
        if q == 0:
            y, q = y - 1, 4


def tracked_universe() -> set[str]:
    try:
        snap = json.loads(KR_SNAPSHOT.read_text(encoding="utf-8"))
    except Exception as exc:
        raise SystemExit(f"[백필] KR 스냅샷을 못 읽었다: {exc}")
    out = {
        str(s.get("ticker") or "").replace(".KS", "").replace(".KQ", "").zfill(6)
        for s in snap.get("stocks") or []
        if s.get("sector") not in ("ETF", "etf", "EXCHANGE TRADED FUNDS")
    }
    out.discard("000000")
    return out


def fetch_quarter(bgn: str, end: str, tracked: set[str], api_key: str, errors: dict):
    """한 분기치. 유가·코스닥을 각각 페이징한다."""
    rows = []
    seen: set[str] = set()
    for cls in ("Y", "K"):
        page = 1
        while page <= MAX_PAGES:
            try:
                data = dart_get(
                    "list.json",
                    {"bgn_de": bgn, "end_de": end, "corp_cls": cls,
                     "page_no": str(page), "page_count": "100"},
                    api_key,
                )
            except Exception as exc:
                k = f"request:{type(exc).__name__}"
                errors[k] = errors.get(k, 0) + 1
                break
            status = str(data.get("status") or "")
            if status == "013":
                break
            if status != "000":
                errors[f"{cls}:{status}"] = errors.get(f"{cls}:{status}", 0) + 1
                break
            for r in data.get("list") or []:
                stock = str(r.get("stock_code") or "").strip().zfill(6)
                if stock not in tracked:
                    continue
                rcept = str(r.get("rcept_no") or "").strip()
                if not rcept or rcept in seen:
                    continue
                seen.add(rcept)
                d = str(r.get("rcept_dt") or "").strip()
                if len(d) == 8:
                    d = f"{d[:4]}-{d[4:6]}-{d[6:8]}"
                # 분석에 쓰는 최소 필드만. 제목 원문은 안 담는다(76만건 × 제목 = 낭비).
                rows.append({
                    "t": stock,
                    "d": d,
                    "y": type_label(str(r.get("report_nm") or "")),
                    "r": rcept,
                })
            total_page = int(data.get("total_page") or 1)
            if page >= total_page:
                break
            page += 1
    return rows


def main() -> int:
    ap = argparse.ArgumentParser(description="DART 공시 5년 백필 (반응 분석 표본)")
    ap.add_argument("--years", type=int, default=5,
                    help="몇 년치. 기본 5 — chartSeries 가 1,220봉(≈5년)이라 그 이상은 반응을 계산할 주가가 없다.")
    ap.add_argument("--refetch", action="store_true", help="이미 받은 분기도 다시 받는다")
    args = ap.parse_args()

    api_key = os.environ.get("DART_API_KEY", "").strip()
    if not api_key:
        raise SystemExit("[백필] DART_API_KEY 가 없다.")

    tracked = tracked_universe()
    ARCHIVE.mkdir(parents=True, exist_ok=True)
    print(f"[백필] 추적 {len(tracked)}종목 · {args.years}년치 · 저장 {ARCHIVE}")

    errors: dict[str, int] = {}
    total = 0
    t0 = time.time()
    for bgn, end, label in quarters(args.years):
        out = ARCHIVE / f"disclosures_{label}.json"
        if out.exists() and not args.refetch:
            try:
                n = len(json.loads(out.read_text(encoding="utf-8")).get("rows") or [])
                total += n
                print(f"  {label}: 건너뜀 (이미 {n:,}건)")
                continue
            except Exception:
                pass                      # 깨졌으면 다시 받는다
        t1 = time.time()
        rows = fetch_quarter(bgn, end, tracked, api_key, errors)
        out.write_text(json.dumps({"quarter": label, "bgn": bgn, "end": end,
                                   "count": len(rows), "rows": rows},
                                  ensure_ascii=False, separators=(",", ":")),
                       encoding="utf-8")
        total += len(rows)
        print(f"  {label}: {len(rows):6,}건 ({time.time()-t1:.0f}초)")

    if errors:
        print(f"[백필] 오류 {sum(errors.values())}건: {dict(list(errors.items())[:5])}")
    print(f"[백필] 완료 — 추적 종목 공시 {total:,}건 / {(time.time()-t0)/60:.0f}분")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
