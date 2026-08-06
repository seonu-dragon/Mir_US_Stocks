#!/usr/bin/env python3
"""CFTC COT(Traders Commitments) 투기 포지셔닝 — 공식 Socrata API, 키 불필요.

'스마트머니가 지금 어디에 베팅 중인가'를 주간 단위로 본다. 지수·금리·통화는
TFF(Traders in Financial Futures) 보고서의 Leveraged Funds(헤지펀드)·Asset
Manager(기관), 원자재는 Disaggregated 보고서의 Managed Money 를 투기 포지션
프록시로 쓴다. 예측이 아니라 포지션의 '현재 위치'(3년 백분위) 요약이다.

  https://publicreporting.cftc.gov/resource/gpe5-46if.json   (TFF, 주간·화요일 기준)
  https://publicreporting.cftc.gov/resource/72hh-3qpy.json   (Disaggregated)
  - 금요일 15:30 ET 발표라 최신 레코드는 최대 10일 늙을 수 있다(정상).
  - 계약 코드는 cftc_contract_market_code 로 고정 지목(이름은 바뀔 수 있음).

산출물: data/cot_positioning.json + .js(window.COT_POSITIONING). 값 없으면 기존
파일 유지(정직성: 지어내지 않는다).
"""

from __future__ import annotations

import json
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

from briefing_store import atomic_write_text  # 중단 시 잘린 JSON 방지

ROOT = Path(__file__).resolve().parents[1]
OUT_JSON = ROOT / "data" / "cot_positioning.json"
OUT_JS = ROOT / "data" / "cot_positioning.js"

TFF = "https://publicreporting.cftc.gov/resource/gpe5-46if.json"
DISAGG = "https://publicreporting.cftc.gov/resource/72hh-3qpy.json"
UA = {"User-Agent": "Mir US Stocks research (dydtjsdn@gmail.com)"}

# (dataset, 계약코드, key, 라벨, 그룹) — 코드는 2026-08-06 실쿼리로 확인
MARKETS = [
    (TFF, "13874A", "es", "S&P 500 E-mini", "지수"),
    (TFF, "209742", "nq", "나스닥100 미니", "지수"),
    (TFF, "1170E1", "vix", "VIX 선물", "지수"),
    (TFF, "043602", "ust10", "미 10년 국채", "금리"),
    (TFF, "098662", "dxy", "달러인덱스", "통화"),
    (TFF, "097741", "jpy", "일본 엔", "통화"),
    (DISAGG, "088691", "gold", "금 (COMEX)", "원자재"),
    (DISAGG, "084691", "silver", "은 (COMEX)", "원자재"),
    (DISAGG, "085692", "copper", "구리 (COMEX)", "원자재"),
    (DISAGG, "067411", "wti", "WTI 원유", "원자재"),
    (DISAGG, "023651", "natgas", "천연가스 (헨리허브)", "원자재"),
]

WEEKS = 156  # 3년 — 백분위 기준 구간


def kst_now_str() -> str:
    return datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M KST")


def fetch_rows(dataset: str, code: str) -> list[dict]:
    since = (datetime.now(timezone.utc) - timedelta(weeks=WEEKS + 4)).strftime("%Y-%m-%d")
    params = {
        "$where": f"cftc_contract_market_code='{code}' AND report_date_as_yyyy_mm_dd>'{since}'",
        "$order": "report_date_as_yyyy_mm_dd ASC",
        "$limit": str(WEEKS + 20),
    }
    url = dataset + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=45) as r:
        return json.loads(r.read().decode("utf-8"))


def num(row: dict, key: str) -> float | None:
    v = row.get(key)
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def spec_net(dataset: str, row: dict) -> float | None:
    """투기 포지션 순계약수. TFF=Leveraged Funds, Disaggregated=Managed Money."""
    if dataset is TFF or "gpe5" in dataset:
        lo, sh = num(row, "lev_money_positions_long"), num(row, "lev_money_positions_short")
    else:
        lo, sh = num(row, "m_money_positions_long_all"), num(row, "m_money_positions_short_all")
    if lo is None or sh is None:
        return None
    return lo - sh


def inst_net(dataset: str, row: dict) -> float | None:
    """기관(실수요·운용) 순계약수. TFF=Asset Manager, Disaggregated=Producer/Merchant."""
    if dataset is TFF or "gpe5" in dataset:
        lo, sh = num(row, "asset_mgr_positions_long"), num(row, "asset_mgr_positions_short")
    else:
        lo, sh = num(row, "prod_merc_positions_long"), num(row, "prod_merc_positions_short")
    if lo is None or sh is None:
        return None
    return lo - sh


def percentile(series: list[float], value: float) -> int:
    if not series:
        return 50
    below = sum(1 for v in series if v <= value)
    return round(below / len(series) * 100)


def build_market(dataset: str, code: str, key: str, label: str, group: str) -> dict | None:
    rows = fetch_rows(dataset, code)
    points = []
    for r in rows:
        net = spec_net(dataset, r)
        if net is None:
            continue
        d = (r.get("report_date_as_yyyy_mm_dd") or "")[:10]
        points.append({"d": d, "net": net, "row": r})
    if len(points) < 8:
        return None
    points = points[-WEEKS:]
    last = points[-1]
    prev = points[-2]
    nets = [p["net"] for p in points]
    oi = num(last["row"], "open_interest_all")
    inst = inst_net(dataset, last["row"])
    return {
        "key": key,
        "label": label,
        "group": group,
        "asOf": last["d"],
        "specNet": round(last["net"]),
        "specChg1w": round(last["net"] - prev["net"]),
        "specPctOi": round(last["net"] / oi * 100, 1) if oi else None,
        "pct3y": percentile(nets, last["net"]),
        "instNet": round(inst) if inst is not None else None,
        "openInterest": round(oi) if oi else None,
        # 최근 52주 스파크라인용(주간)
        "history": [{"d": p["d"], "v": round(p["net"])} for p in points[-52:]],
    }


def main() -> int:
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    print("=== CFTC COT 포지셔닝 수집 (Socrata) ===")
    markets = []
    as_of = ""
    for dataset, code, key, label, group in MARKETS:
        try:
            m = build_market(dataset, code, key, label, group)
        except Exception as e:  # noqa: BLE001
            print(f"[cot] {label} 실패({type(e).__name__}: {e}) — 건너뜀")
            continue
        if m:
            markets.append(m)
            as_of = max(as_of, m["asOf"])
            print(f"[cot] {label}: net={m['specNet']:+,} (1w {m['specChg1w']:+,}, 3y {m['pct3y']}%)")
    if len(markets) < 6:
        print(f"[cot] 유효 시장 {len(markets)}개(<6) — 기존 파일 유지")
        return 1
    payload = {
        "updatedAtKst": kst_now_str(),
        "asOf": as_of,
        "source": "CFTC Commitments of Traders (TFF Leveraged Funds · Disaggregated Managed Money)",
        "markets": markets,
    }
    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    atomic_write_text(OUT_JSON, compact)
    atomic_write_text(OUT_JS, f"window.COT_POSITIONING = {compact};\n")
    print(f"as_of={as_of} 시장 {len(markets)}개 → {OUT_JSON.name}, {OUT_JS.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
