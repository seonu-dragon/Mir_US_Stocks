#!/usr/bin/env python3
"""역DCF 기저율 분포 — 재무 확장 종목 파일(data/financials, data/korea/financials)에서 계산.

질문: "과거 이 규모(매출) 기업 중 N년 동안 FCF(또는 매출)가 연 g% 이상 자란 비율은?"
역DCF 가 역산한 '시장이 가격에 넣은 성장률' 을 과거 실제 분포와 나란히 보여 주기 위한 참고 통계다.

방법
- 종목마다 **가장 최근 창 하나만** 쓴다(겹치는 창을 여러 개 세면 표본이 부풀려진다).
  창 = 최근 회계연도 행과 그 H년 전 행(US 는 기말일 간격 H년±45일, KR 은 사업연도 차이). H = 9(연간 10개가 최대라 최장), 5.
- CAGR = (끝 / 시작)^(1/H) − 1. 두 끝이 모두 양수일 때만(음수·0 에서 출발한 성장률은 정의되지 않는다).
  FCF 가 양수가 아니어서 빠진 수는 fcfExcluded 로 함께 적는다(이 조건 자체가 편향이다).
- 규모 구간 = 창 시작 연도의 매출(시장 통화). US(USD): <10억, 10~50억, 50~250억, ≥250억 달러.
  KR(KRW): <1조, 1~10조, ≥10조 원.
- 제외: 금융업(industryType ≠ general), 재무 통화 ≠ 시장 통화(US 의 20-F/40-F 비달러 보고 등).

한계(화면에도 표시)
- 생존편향: 지금 상장돼 있고 시총 상위(US 약 1,000종목)에 든 회사만 들어 있다. 망하거나 작아진 회사는
  빠져 있어 성장률 분포가 실제보다 높게 나온다.
- 표본 기간: 최근 약 10년(한 번의 경기 국면). 다른 금리·경기 환경에서는 분포가 다를 수 있다.
- 과거 분포이며 예측이 아니다.

산출물: data/dcf_base_rates.json + data/dcf_base_rates.js(window.DCF_BASE_RATES). 두 시장이 한 파일.
  CAGR 은 % 단위 소수 1자리로 오름차순 정렬해 저장(브라우저가 이진 탐색으로 비율 계산 — dcf-core.js baseRate).
실행: python scripts/build_dcf_base_rates.py [--push]
  표본이 하나도 없으면 기존 파일을 유지하고 exit 1.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sec_client as sec  # noqa: E402  (write_data · git_publish)

ROOT = Path(__file__).resolve().parents[1]
OUT_JSON = ROOT / "data" / "dcf_base_rates.json"
OUT_JS = ROOT / "data" / "dcf_base_rates.js"

HORIZONS = (9, 5)
MARKETS = {
    "us": {
        "dir": ROOT / "data" / "financials",
        "currency": "USD",
        "buckets": [
            {"label": "매출 10억 달러 미만", "min": None, "max": 1e9},
            {"label": "매출 10억~50억 달러", "min": 1e9, "max": 5e9},
            {"label": "매출 50억~250억 달러", "min": 5e9, "max": 25e9},
            {"label": "매출 250억 달러 이상", "min": 25e9, "max": None},
        ],
        "universe": "SEC 재무 확장 대상(시총 상위 약 1,000종목, ETF 제외) 중 금융업·비달러 보고 제외",
    },
    "kr": {
        "dir": ROOT / "data" / "korea" / "financials",
        "currency": "KRW",
        "buckets": [
            {"label": "매출 1조 원 미만", "min": None, "max": 1e12},
            {"label": "매출 1조~10조 원", "min": 1e12, "max": 1e13},
            {"label": "매출 10조 원 이상", "min": 1e13, "max": None},
        ],
        "universe": "DART 재무 확장 대상(수집 진행 중) 중 금융업 제외",
    },
}


def kst_now_str() -> str:
    return datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M KST")


def _num(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def _fy(row: dict):
    try:
        return int(row.get("fy"))
    except (TypeError, ValueError):
        return None


def _days(a: str, b: str):
    try:
        return (date.fromisoformat(b) - date.fromisoformat(a)).days
    except (TypeError, ValueError):
        return None


def cagr(a, b, years: int):
    a, b = _num(a), _num(b)
    if a is None or b is None or a <= 0 or b <= 0 or years <= 0:
        return None
    return (b / a) ** (1.0 / years) - 1.0


def bucket_index(buckets: list[dict], rev: float) -> int:
    for i, b in enumerate(buckets):
        if (b["min"] is None or rev >= b["min"]) and (b["max"] is None or rev < b["max"]):
            return i
    return -1


def observations(doc: dict, currency: str) -> dict[int, dict]:
    """종목 하나 → {H: {"startRev", "rev": cagr|None, "fcf": cagr|None, "fcfExcluded": bool, "startFy", "endFy"}}"""
    if doc.get("industryType", "general") != "general" or "financial" in (doc.get("flags") or []):
        return {}
    if doc.get("currency") != currency:
        return {}
    rows = [r for r in (doc.get("annual") or []) if isinstance(r, dict)]
    if not rows:
        return {}
    # 기간은 기말일(end)로 잰다 — SEC fy 라벨이 어긋난 행이 있다(예: STX 2025-06 결산이 fy 2027).
    # end 가 없는 KR 은 사업연도(fy) 차이로.
    dated = all(r.get("end") for r in rows)
    if dated:
        rows = sorted(rows, key=lambda r: r["end"])
    else:
        try:
            rows = sorted(rows, key=lambda r: int(r.get("fy")))
        except (TypeError, ValueError):
            return {}
    end = rows[-1]
    end_fy = _fy(end)

    def start_row(h: int):
        if dated:
            for r in rows:
                d = _days(r["end"], end["end"])
                if d is not None and abs(d - h * 365.25) <= 45:
                    return r
            return None
        for r in rows:
            if _fy(r) == end_fy - h:
                return r
        return None

    out = {}
    for h in HORIZONS:
        start = start_row(h)
        if not start:
            continue
        srev = _num(start.get("rev"))
        if srev is None or srev <= 0:
            continue
        fcf_g = cagr(start.get("fcf"), end.get("fcf"), h)
        has_fcf = _num(start.get("fcf")) is not None and _num(end.get("fcf")) is not None
        out[h] = {
            "startRev": srev,
            "rev": cagr(srev, end.get("rev"), h),
            "fcf": fcf_g,
            "fcfExcluded": has_fcf and fcf_g is None,
            "startFy": int(start["end"][:4]) if dated else _fy(start),
            "endFy": int(end["end"][:4]) if dated else end_fy,
        }
    return out


def _pack(values: list[float]) -> list[float]:
    return sorted(round(v * 100, 1) for v in values)


def _summary(obs: list[dict]) -> dict:
    rev = [o["rev"] for o in obs if o["rev"] is not None]
    fcf = [o["fcf"] for o in obs if o["fcf"] is not None]
    return {"n": len(obs), "rev": _pack(rev), "fcf": _pack(fcf),
            "fcfExcluded": sum(1 for o in obs if o["fcfExcluded"])}


def build_market(key: str, cfg: dict) -> dict | None:
    files = sorted(cfg["dir"].glob("*.json")) if cfg["dir"].exists() else []
    per_h: dict[int, list[dict]] = {h: [] for h in HORIZONS}
    companies = 0
    for p in files:
        try:
            doc = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if doc.get("schema") != 1:
            continue
        obs = observations(doc, cfg["currency"])
        if obs:
            companies += 1
        for h, o in obs.items():
            per_h[h].append(o)
    horizons = {}
    for h, obs in per_h.items():
        if not obs:
            continue
        buckets = [[] for _ in cfg["buckets"]]
        for o in obs:
            i = bucket_index(cfg["buckets"], o["startRev"])
            if i >= 0:
                buckets[i].append(o)
        start_fys = sorted(o["startFy"] for o in obs)
        end_fys = sorted(o["endFy"] for o in obs)
        horizons[str(h)] = {
            "period": f"{start_fys[0]}~{start_fys[-1]}년 결산 → {end_fys[0]}~{end_fys[-1]}년 결산",
            "all": _summary(obs),
            "buckets": [_summary(b) for b in buckets],
        }
    if not horizons:
        return None
    return {
        "currency": cfg["currency"],
        "universe": cfg["universe"],
        "companies": companies,
        "files": len(files),
        "buckets": cfg["buckets"],
        "horizons": horizons,
    }


def build() -> dict | None:
    markets = {}
    for key, cfg in MARKETS.items():
        m = build_market(key, cfg)
        if m:
            markets[key] = m
    if not markets:
        return None
    count = sum(m["companies"] for m in markets.values())
    return {
        "schema": 1,
        "updatedAtKst": kst_now_str(),
        "source": "SEC EDGAR XBRL · DART 전체재무제표 (Mir 재무 확장 종목 파일)",
        "count": count,
        "method": "종목당 최근 창 1개. CAGR = (끝/시작)^(1/H) − 1, 두 끝이 양수일 때만. 규모 = 창 시작 연도 매출.",
        "limits": "생존편향(현재 상장·시총 상위 기업만) · 최근 약 10년 한 국면 · 과거 분포이며 예측 아님",
        "markets": markets,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="역DCF 기저율 분포(재무 확장 파일 기반)")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    print("=== 역DCF 기저율 분포 ===")
    payload = build()
    if not payload:
        print("[기저율] 표본 없음 — 기존 파일 유지")
        return 1
    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    # 0건·직전 대비 절반 미만으로 줄어든 결과는 덮어쓰지 않는다(SystemExit) — 재무 파일이 반쯤 빠진 체크아웃 대비.
    sec.write_data(OUT_JSON, OUT_JS, "DCF_BASE_RATES", payload, indent=None, min_ratio=0.5)
    for key, m in payload["markets"].items():
        hs = ", ".join(f"{h}년 n={v['all']['n']}(FCF {len(v['all']['fcf'])})" for h, v in m["horizons"].items())
        print(f"[{key}] 종목 {m['companies']}/{m['files']} · {hs}")
    print(f"Wrote {OUT_JSON.name} ({len(compact) // 1024}KB), {OUT_JS.name}")
    if args.push:
        if not sec.git_publish(["data/dcf_base_rates.json", "data/dcf_base_rates.js"], "DCF base rates"):
            print("[중단] 기저율 push 실패 — 발행되지 않았다")
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
