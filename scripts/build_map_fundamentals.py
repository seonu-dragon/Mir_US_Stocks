#!/usr/bin/env python3
"""시장지도 색상 기준용 펀더멘털 요약 빌드.

data/details/*.json 의 fundamentals 를 읽어 시장지도가 동기적으로 색칠할 수 있는
compact lookup(data/map_fundamentals.js / .json)을 만든다.

지도에서 쓰는 12개 지표 키:
  pe, forwardPE, peg, ps, pb, pfcf, evEbitda, divYield, eps, roe, roa, netMargin

- pe/forwardPE/ps/pb/roe 는 fundamentals 동일 키.
- netMargin = profitMargin, eps = epsTtm.
- roa = incomeB / assetsB * 100 (둘 다 있을 때 산출).
- peg/pfcf/evEbitda/divYield 는 update_data.py 가 수집하면 fundamentals 에 채워지며,
  아직 없으면 생략(지도에서 '데이터 없음' 처리).
"""

from __future__ import annotations

import glob
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DETAILS_DIR = ROOT / "data" / "details"
OUT_JS = ROOT / "data" / "map_fundamentals.js"
OUT_JSON = ROOT / "data" / "map_fundamentals.json"

# fundamentals 키 -> 지도 키 (직접 매핑)
DIRECT = {
    "pe": "pe",
    "forwardPE": "forwardPE",
    "peg": "peg",
    "ps": "ps",
    "pb": "pb",
    "pfcf": "pfcf",
    "evEbitda": "evEbitda",
    "divYield": "divYield",
    "epsTtm": "eps",
    "roe": "roe",
    "profitMargin": "netMargin",
}


def num(v):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if f != f:  # NaN
        return None
    return round(f, 4)


def extract(fund: dict) -> dict:
    out = {}
    for src, dst in DIRECT.items():
        val = num(fund.get(src))
        if val is not None:
            out[dst] = val
    # ROA = 순이익 / 총자산
    income = num(fund.get("incomeB"))
    assets = num(fund.get("assetsB"))
    if income is not None and assets and assets > 0:
        out["roa"] = round(income / assets * 100, 2)
    return out


def main() -> None:
    table = {}
    files = glob.glob(str(DETAILS_DIR / "*.json"))
    for path in files:
        try:
            detail = json.loads(Path(path).read_text(encoding="utf-8"))
        except Exception:
            continue
        ticker = str(detail.get("ticker") or "").upper()
        fund = detail.get("fundamentals") or {}
        if not ticker or not fund:
            continue
        metrics = extract(fund)
        if metrics:
            table[ticker] = metrics

    payload = json.dumps(table, ensure_ascii=False, separators=(",", ":"))
    OUT_JSON.write_text(payload, encoding="utf-8")
    OUT_JS.write_text(f"window.MAP_FUNDAMENTALS = {payload};\n", encoding="utf-8")

    # 커버리지 요약
    counts = {}
    for metrics in table.values():
        for key in metrics:
            counts[key] = counts.get(key, 0) + 1
    print(f"map_fundamentals: {len(table)} tickers")
    for key in ("pe", "forwardPE", "peg", "ps", "pb", "pfcf",
                "evEbitda", "divYield", "eps", "roe", "roa", "netMargin"):
        print(f"  {key}: {counts.get(key, 0)}")


if __name__ == "__main__":
    main()
