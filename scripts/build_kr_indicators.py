#!/usr/bin/env python3
"""한국 주요 재무지표 — DART fnlttCmpnyIndx(다중회사 주요 재무지표).

성장률·안정성 지표를 손으로 계산할 필요가 없다. DART 가 완제품으로 준다:
  매출액증가율(YoY) 10.88 · 영업이익증가율(YoY) 33.23 · 순이익증가율(YoY) 31.22
  부채비율 29.94 · 유동비율 232.76 · 자기자본비율 76.96   (삼성전자 2025)

효율: fnlttCmpnyIndx 는 corp_code 를 콤마로 여러 개 받는다(200개까지 확인).
2,600종목 × 4카테고리를 종목별로 돌면 10,400회지만, 200개씩 묶으면 13 × 4 = 52회다.

함정:
  - idx_val 이 '(없음)' 이 아니라 빈 문자열/없는 키로 오는 지표가 많다(회사·업종별).
  - '자본금회전율' 은 '#########' 로 오는 회사가 있다(엑셀식 오버플로). 숫자 파싱
    실패는 조용히 버린다.
  - 배당성향은 성장성이 아니라 '활동성(M240000)' 카테고리에 들어 있다.

Requires DART_API_KEY.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402
from build_kr_disclosures import dart_get, load_corp_map  # noqa: E402

KST = ZoneInfo("Asia/Seoul")
OUT_JSON = ROOT / "data" / "korea" / "indicators.json"
OUT_JS = ROOT / "data" / "korea" / "indicators.js"
KR_SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"

BATCH = 200          # 확인된 상한(200 에서 199/200 응답)

# DART 지표명 → 우리 키. 여기 없는 지표는 버린다(카테고리당 11~22개씩 오는데
# 대부분은 화면에서 쓸 데가 없다).
INDEX_MAP = {
    "M230000": {   # 성장성
        "매출액증가율(YoY)": "revenueGrowth",
        "영업이익증가율(YoY)": "operatingGrowth",
        "순이익증가율(YoY)": "netGrowth",
        "총자산증가율": "assetGrowth",
        "재고자산증가율": "inventoryGrowth",
    },
    "M220000": {   # 안정성
        "부채비율": "debtRatio",
        "유동비율": "currentRatio",
        "자기자본비율": "equityRatio",
    },
    "M240000": {   # 활동성
        "배당성향(%)": "payoutRatio",
        "총자산회전율": "assetTurnover",
    },
}


def now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def to_num(value):
    s = str(value or "").strip().replace(",", "")
    if not s or s in ("-", "#########"):
        return None
    try:
        v = float(s)
    except ValueError:
        return None
    if v != v:      # NaN
        return None
    return round(v, 3)


def load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def write_outputs(payload: dict) -> None:
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    atomic_write_text(OUT_JSON, text)
    atomic_write_text(OUT_JS, "window.KR_INDICATORS = " + text + ";")


def build(api_key: str, year: str, limit: int | None):
    snapshot = load_json(KR_SNAPSHOT, {"stocks": []})
    stocks = [
        s for s in snapshot.get("stocks") or []
        if s.get("sector") not in ("ETF", "etf", "EXCHANGE TRADED FUNDS")
    ]
    stocks.sort(key=lambda s: s.get("marketCapB") if isinstance(s.get("marketCapB"), (int, float)) else 0,
                reverse=True)

    corp_map = load_corp_map(api_key)
    if not corp_map:
        raise SystemExit("[지표] corpCode.xml 수집 실패 — 중단한다.")

    pairs = []
    for s in stocks:
        t = str(s.get("ticker") or "").replace(".KS", "").replace(".KQ", "").zfill(6)
        corp = corp_map.get(t)
        if corp:
            pairs.append((t, corp))
    if limit:
        pairs = pairs[:limit]

    calls = -(-len(pairs) // BATCH) * len(INDEX_MAP)
    print(f"[지표] 대상 {len(pairs)}종목 × {len(INDEX_MAP)}카테고리 = 약 {calls}회 호출")

    out: dict[str, dict] = {}
    errors: dict[str, int] = {}
    for idx_cl, name_map in INDEX_MAP.items():
        for i in range(0, len(pairs), BATCH):
            chunk = [c for _, c in pairs[i:i + BATCH]]
            try:
                data = dart_get(
                    "fnlttCmpnyIndx.json",
                    {"corp_code": ",".join(chunk), "bsns_year": year,
                     "reprt_code": "11011", "idx_cl_code": idx_cl},
                    api_key,
                )
            except Exception as exc:
                errors[f"{idx_cl}:request:{type(exc).__name__}"] = \
                    errors.get(f"{idx_cl}:request:{type(exc).__name__}", 0) + 1
                continue
            status = str(data.get("status") or "")
            if status == "013":
                continue
            if status != "000":
                key = f'{idx_cl}:{status}:{data.get("message") or ""}'.strip(":")
                errors[key] = errors.get(key, 0) + 1
                continue
            for row in data.get("list") or []:
                dst = name_map.get((row.get("idx_nm") or "").strip())
                if not dst:
                    continue
                v = to_num(row.get("idx_val"))
                if v is None:
                    continue
                ticker = str(row.get("stock_code") or "").strip().zfill(6)
                if not ticker or ticker == "000000":
                    continue
                out.setdefault(ticker, {})[dst] = v
    return out, errors


def main() -> int:
    parser = argparse.ArgumentParser(description="KR 주요 재무지표 수집 (DART 다중회사 재무지표)")
    parser.add_argument("--push", action="store_true")
    parser.add_argument("--year", default="", help="사업연도. 기본은 작년(최신 사업보고서).")
    parser.add_argument("--limit", type=int, default=None, help="시총 상위 N종목만(테스트용)")
    args = parser.parse_args()

    # 최신 '사업보고서' 가 있는 해 = 작년.
    year = args.year.strip() or str(datetime.now(KST).year - 1)

    api_key = os.environ.get("DART_API_KEY", "").strip()
    if not api_key:
        write_outputs({
            "updatedAtKst": now_kst(), "source": "DART Open API · 주요 재무지표",
            "note": "DART_API_KEY 미설정 — GitHub Secrets에 등록 후 workflow를 실행하세요.",
            "year": year, "indicators": {},
        })
        print("DART_API_KEY missing; wrote empty kr indicators payload.")
        return 0

    indicators, errors = build(api_key, year, args.limit)
    if errors:
        print(f"[지표] 오류 응답 {sum(errors.values())}건: {errors}")
    if not indicators and errors:
        print("[지표] 수집 0건 + 오류 발생 — 기존 파일을 덮어쓰지 않고 실패 처리한다.")
        return 1

    # 지표별 커버리지를 남긴다. 화면의 색상 기준은 커버리지가 낮으면 자동으로 숨겨지므로
    # 여기서 몇 종목이나 잡혔는지가 그대로 UI 노출 여부가 된다.
    counts: dict[str, int] = {}
    for row in indicators.values():
        for k in row:
            counts[k] = counts.get(k, 0) + 1

    payload = {
        "updatedAtKst": now_kst(),
        "source": "DART Open API · 주요 재무지표",
        "note": "최신 사업보고서 기준 성장성·안정성·활동성 지표.",
        "year": year,
        "companyCount": len(indicators),
        "coverage": counts,
        "indicators": indicators,
    }
    write_outputs(payload)
    print(f"[지표] {len(indicators)}종목 기록.")
    for k, v in sorted(counts.items(), key=lambda x: -x[1]):
        print(f"    {k:18s} {v}")

    if args.push:
        import sec_client as sec

        with repository_publish_lock(ROOT):
            if not sec.git_publish(
                ["data/korea/indicators.json", "data/korea/indicators.js"],
                "KR financial indicators",
            ):
                return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
