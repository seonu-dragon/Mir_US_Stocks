#!/usr/bin/env python3
"""한국 감사의견 — 상장폐지 위험 신호.

한국 시장에서 '의견거절'·'한정의견'은 상장폐지 사유다. 미국 쪽에는 대칭이 없는
한국 고유의 리스크 신호이고, DART 가 사실 그대로 준다 — 해석도 통계도 필요 없다.

실측(소형주 69종목 표본):
    적정의견 80% · 의견거절 14% · 한정의견 3% · 강조사항 13%
17% 가 걸린다. 노이즈가 아니다.

응답 구조 함정:
  - 기수마다 같은 행이 두 번씩 온다(당기/전기/전전기 × 2). 구분 필드가 없어
    bsns_year 로 중복을 없앤다.
  - bsns_year 가 '제57기 \\n(당기)' 처럼 줄바꿈을 달고 온다.
  - 감사의견이 빈 문자열인 회사가 있다(표본 69곳 중 2곳).

값이 연 1회(사업보고서)만 바뀌므로 주간 워크플로우로 충분하다.

Requires DART_API_KEY.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

if sys.platform == "win32":
    # cp949 콘솔에서 한글·U+2014 출력이 UnicodeEncodeError 로 죽어 빌드 실패로 둔갑한다.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402
from sec_client import DART_REGRESSION_FLOOR, latest_fiscal_year, write_data  # noqa: E402
from build_kr_disclosures import dart_get, load_corp_map  # noqa: E402
from step_budget import StepBudget, carry_over, missing_first  # noqa: E402

KST = ZoneInfo("Asia/Seoul")
OUT_JSON = ROOT / "data" / "korea" / "audit_opinion.json"
OUT_JS = ROOT / "data" / "korea" / "audit_opinion.js"
KR_SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"

# 상장폐지 사유가 되는 의견. '적정' 이 아닌 것을 위험으로 본다.
ADVERSE = ("의견거절", "부적정", "한정")
NO_EMPHASIS = ("-", "", "해당사항 없음", "해당사항없음", "없음")


def now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def clean(v) -> str:
    return " ".join(str(v or "").split())


def load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def write_outputs(payload: dict) -> None:
    # .json 은 빌더 상태(compact 유지), .js 는 브라우저 전역 — sec_client.write_data 로 통일.
    # DART 한도 초과(020)·로그인 만료로 직전 대비 30% 넘게 줄어든 결과는 덮지 않는다
    # (2026-09-15 감사: 2,600행 -> 400행이 '정상' 발행된 적이 있다).
    write_data(OUT_JSON, OUT_JS, "KR_AUDIT_OPINION", payload, indent=None,
               min_ratio=DART_REGRESSION_FLOOR)


def pick_current(rows: list[dict]) -> dict | None:
    """당기 행 하나. 같은 기수가 두 번씩 오므로 중복을 없앤다."""
    seen: set[str] = set()
    uniq = []
    for r in rows:
        key = clean(r.get("bsns_year"))
        if key in seen:
            continue
        seen.add(key)
        uniq.append(r)
    for r in uniq:
        if "당기" in clean(r.get("bsns_year")) and "전기" not in clean(r.get("bsns_year")):
            return r
    return uniq[0] if uniq else None


def build(api_key: str, year: str, limit: int | None, budget: StepBudget | None = None,
          prev: dict | None = None):
    """(opinions, errors, attempted, universe). prev 에 있는 종목은 뒤로 — 못 받은 종목부터 채운다."""
    snapshot = load_json(KR_SNAPSHOT, {"stocks": []})
    stocks = [s for s in snapshot.get("stocks") or []
              if s.get("sector") not in ("ETF", "etf", "EXCHANGE TRADED FUNDS")]
    stocks.sort(key=lambda s: s.get("marketCapB") if isinstance(s.get("marketCapB"), (int, float)) else 0,
                reverse=True)

    corp_map = load_corp_map(api_key)
    if not corp_map:
        raise SystemExit("[감사의견] corpCode.xml 수집 실패 — 중단한다.")

    pairs = []
    for s in stocks:
        t = str(s.get("ticker") or "").replace(".KS", "").replace(".KQ", "").zfill(6)
        corp = corp_map.get(t)
        if corp:
            pairs.append((t, corp))
    if limit:
        pairs = pairs[:limit]
    universe = {t for t, _ in pairs}
    pairs = missing_first(pairs, set(prev or {}))
    print(f"[감사의견] 대상 {len(pairs)}종목 × 1회 = 약 {len(pairs)}회 호출 "
          f"(직전 값 {len(prev or {})}종목 — 없는 종목부터)", flush=True)

    out: dict[str, dict] = {}
    errors: dict[str, int] = {}
    attempted: set[str] = set()
    t0 = time.time()
    for i, (ticker, corp) in enumerate(pairs, 1):
        if budget and budget.over():
            print(f"[감사의견] {budget.reason} — {i - 1}/{len(pairs)}종목에서 멈춘다(나머지는 직전 값 이월)",
                  flush=True)
            break
        if i % 400 == 0:
            print(f"[감사의견] {i}/{len(pairs)} … ({(time.time()-t0)/60:.0f}분)", flush=True)
        try:
            data = dart_get("accnutAdtorNmNdAdtOpinion.json",
                            {"corp_code": corp, "bsns_year": year, "reprt_code": "11011"},
                            api_key)
        except Exception as exc:
            k = f"request:{type(exc).__name__}"
            errors[k] = errors.get(k, 0) + 1
            if budget:
                budget.record(False)
            continue
        if budget:
            budget.record(True)
        if str(data.get("status") or "") in ("000", "013"):
            attempted.add(ticker)
        status = str(data.get("status") or "")
        if status == "013":
            continue
        if status != "000":
            errors[status] = errors.get(status, 0) + 1
            continue
        row = pick_current(data.get("list") or [])
        if not row:
            continue
        opinion = clean(row.get("adt_opinion"))
        if not opinion:
            continue                       # 의견이 비어 있으면 신호로 쓸 수 없다
        rec = {
            "opinion": opinion,
            "auditor": clean(row.get("adtor")),
            "year": clean(row.get("bsns_year")),
            # 적정이 아니면 상장폐지 사유다. 화면이 판단하지 않게 여기서 플래그를 준다.
            "adverse": any(k in opinion for k in ADVERSE),
        }
        emph = clean(row.get("emphs_matter"))
        if emph and emph not in NO_EMPHASIS:
            rec["emphasis"] = emph[:300]
        out[ticker] = rec
    return out, errors, attempted, universe


def main() -> int:
    ap = argparse.ArgumentParser(description="KR 감사의견 수집 (상폐 위험 신호)")
    ap.add_argument("--push", action="store_true")
    ap.add_argument("--year", default="", help="사업연도. 기본은 작년(최신 사업보고서).")
    ap.add_argument("--limit", type=int, default=None, help="시총 상위 N종목만(테스트용)")
    ap.add_argument("--time-budget-min", type=float, default=0,
                    help="이 분이 지나면 멈추고 저장(0=무제한). 못 받은 종목은 직전 값(같은 사업연도) 이월.")
    args = ap.parse_args()

    # 최신 조회 가능 사업연도. 사업보고서는 3월 말까지 제출되므로 1~3월에는
    # year-1 이 아직 없어 전 종목 status 013 이 된다(sec_client.latest_fiscal_year).
    year = args.year.strip() or str(latest_fiscal_year())
    api_key = os.environ.get("DART_API_KEY", "").strip()
    if not api_key:
        write_outputs({"updatedAtKst": now_kst(), "source": "DART Open API · 감사의견",
                       "note": "DART_API_KEY 미설정 — GitHub Secrets에 등록 후 workflow를 실행하세요.",
                       "year": year, "opinions": {}})
        print("DART_API_KEY missing; wrote empty kr audit opinion payload.")
        return 0

    prev_payload = load_json(OUT_JSON, {}) or {}
    prev = (prev_payload.get("opinions") or {}) if str(prev_payload.get("year") or "") == year else {}
    budget = StepBudget(args.time_budget_min)
    fresh, errors, attempted, universe = build(api_key, year, args.limit, budget, prev)
    opinions, carried = carry_over(fresh, prev, attempted, universe)
    print(f"[감사의견] 이번 수집 {len(fresh)}종목 · 직전 값 이월 {carried}종목", flush=True)
    if errors:
        print(f"[감사의견] 오류 {sum(errors.values())}건: {dict(list(errors.items())[:5])}")
    if not fresh and errors:
        print("[감사의견] 수집 0건 + 오류 발생 — 기존 파일을 덮어쓰지 않고 실패 처리한다.")
        return 1

    from collections import Counter
    dist = Counter(v["opinion"] for v in opinions.values())
    adverse = sum(1 for v in opinions.values() if v["adverse"])

    payload = {
        "updatedAtKst": now_kst(),
        "source": "DART Open API · 회계감사인의 명칭 및 감사의견",
        "note": "최신 사업보고서 기준. '적정' 이 아닌 의견(의견거절·한정·부적정)은 상장폐지 사유다.",
        "year": year,
        "companyCount": len(opinions),
        # 시간 예산에 걸린 주에는 일부 종목이 직전 실행 값(같은 사업연도)이다.
        "refreshedCount": len(fresh),
        "carriedCount": carried,
        "stoppedReason": budget.reason or None,
        "adverseCount": adverse,
        "distribution": dict(dist),
        "opinions": opinions,
    }
    write_outputs(payload)
    print(f"[감사의견] {len(opinions)}종목 기록 · 비적정 {adverse}종목")
    for k, v in dist.most_common(6):
        print(f"    {v:5d}  {k}")

    if args.push:
        import sec_client as sec

        with repository_publish_lock(ROOT):
            if not sec.git_publish(
                ["data/korea/audit_opinion.json", "data/korea/audit_opinion.js"],
                "KR audit opinions",
            ):
                return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
