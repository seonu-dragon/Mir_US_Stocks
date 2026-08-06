#!/usr/bin/env python3
"""SEC Fails-to-Deliver(결제 불이행) — 공식 반월(半月) 파일, 키 불필요.

공매도 압박의 세 번째 축. FINRA 일별 공매도 거래량(흐름)·격주 잔고(스톡)에 더해,
'결제가 실제로 밀리고 있는가'(FTD)를 본다. FTD 급증은 대차 물량 고갈 신호로
숏 스퀴즈 논의에 자주 등장한다 — 단, 파일 자체가 약 2주 지연 발행이라 신호가
아니라 사후 확인용 컨텍스트다.

  https://www.sec.gov/files/data/fails-deliver-data/cnsfails{YYYYMM}{a|b}.zip
  - a=전반월(1~15일), b=후반월. 최신 후보부터 역순으로 시도한다.
  - zip 안 파이프(|) 구분 텍스트: SETTLEMENT DATE|CUSIP|SYMBOL|QUANTITY|DESC|PRICE
  - 유니버스는 스냅샷(data/market_snapshot.json) 종목으로 한정 — OTC 노이즈 제거.
  - 발행주식수는 스냅샷의 시총/주가로 근사(정확한 float 아님 — UI 에 명시).

산출물: data/sec_ftd.json + .js(window.SEC_FTD). 값 없으면 기존 파일 유지.
"""

from __future__ import annotations

import io
import json
import sys
import urllib.request
import zipfile
from datetime import datetime, timezone, timedelta
from pathlib import Path

from briefing_store import atomic_write_text  # 중단 시 잘린 JSON 방지

ROOT = Path(__file__).resolve().parents[1]
OUT_JSON = ROOT / "data" / "sec_ftd.json"
OUT_JS = ROOT / "data" / "sec_ftd.js"
SNAPSHOT = ROOT / "data" / "market_snapshot.json"

BASE = "https://www.sec.gov/files/data/fails-deliver-data/cnsfails{tag}.zip"
UA = {"User-Agent": "Mir US Stocks research dydtjsdn@gmail.com"}  # SEC 는 UA 필수
TOP_N = 40
MIN_VALUE_M = 2.0  # 최대일 FTD 금액(백만$) 하한 — 소액 노이즈 제거


def kst_now_str() -> str:
    return datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M KST")


def candidate_tags() -> list[str]:
    """최신 가능 파일부터: 이번 달 b/a → 지난달 b/a → 지지난달 b/a."""
    now = datetime.now(timezone.utc)
    tags = []
    y, m = now.year, now.month
    for _ in range(3):
        tags += [f"{y}{m:02d}b", f"{y}{m:02d}a"]
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return tags


def fetch_latest() -> tuple[str, bytes] | None:
    for tag in candidate_tags():
        url = BASE.format(tag=tag)
        req = urllib.request.Request(url, headers=UA)
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return tag, r.read()
        except Exception:
            continue
    return None


def load_universe() -> dict[str, dict]:
    snap = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    uni = {}
    for s in snap.get("stocks", []):
        t = s.get("ticker")
        price = s.get("price")
        cap_b = s.get("marketCapB")
        if not t:
            continue
        shares = (cap_b * 1e9 / price) if (cap_b and price) else None
        uni[t] = {"company": s.get("company"), "shares": shares}
    return uni


def build() -> dict | None:
    got = fetch_latest()
    if not got:
        return None
    tag, blob = got
    uni = load_universe()
    if not uni:
        return None

    agg: dict[str, dict] = {}
    dates: set[str] = set()
    with zipfile.ZipFile(io.BytesIO(blob)) as zf:
        name = zf.namelist()[0]
        text = zf.read(name).decode("utf-8", "replace")
    for line in text.splitlines()[1:]:
        parts = line.split("|")
        if len(parts) < 6:
            continue
        date, _cusip, sym, qty, _desc, price = parts[0], parts[1], parts[2], parts[3], parts[4], parts[5]
        if sym not in uni:
            continue
        try:
            q = int(qty)
        except ValueError:
            continue
        try:
            p = float(price)
        except ValueError:
            p = 0.0
        dates.add(date)
        a = agg.setdefault(sym, {"max": 0, "maxDate": "", "last": 0, "lastDate": "", "price": 0.0, "days": 0})
        a["days"] += 1
        a["price"] = p or a["price"]
        if q > a["max"]:
            a["max"], a["maxDate"] = q, date
        if date >= a["lastDate"]:
            a["last"], a["lastDate"] = q, date
    if not agg or not dates:
        return None

    # 직전 파일과 비교(추세) — 기존 산출물의 max 를 prev 로 쓴다
    prev_map = {}
    if OUT_JSON.exists():
        try:
            old = json.loads(OUT_JSON.read_text(encoding="utf-8"))
            if old.get("fileTag") != tag:
                prev_map = {r["t"]: r["maxFails"] for r in old.get("top", [])}
            else:
                prev_map = old.get("_prevMap", {})
        except Exception:
            pass

    rows = []
    for sym, a in agg.items():
        info = uni[sym]
        value_m = a["max"] * a["price"] / 1e6
        if value_m < MIN_VALUE_M:
            continue
        pct = (a["max"] / info["shares"] * 100) if info.get("shares") else None
        rows.append({
            "t": sym,
            "company": info.get("company"),
            "maxFails": a["max"],
            "maxDate": a["maxDate"],
            "lastFails": a["last"],
            "valueM": round(value_m, 1),
            "pctShares": round(pct, 3) if pct is not None else None,
            "prevMaxFails": prev_map.get(sym),
        })
    if not rows:
        return None
    rows.sort(key=lambda r: (r["pctShares"] or 0), reverse=True)

    d_sorted = sorted(dates)
    fmt = lambda d: f"{d[:4]}-{d[4:6]}-{d[6:8]}" if len(d) == 8 else d
    return {
        "updatedAtKst": kst_now_str(),
        "asOf": fmt(d_sorted[-1]),
        "period": {"from": fmt(d_sorted[0]), "to": fmt(d_sorted[-1])},
        "fileTag": tag,
        "source": "SEC Fails-to-Deliver (CNS, 반월 파일 · 약 2주 지연)",
        "top": rows[:TOP_N],
        "_prevMap": {r["t"]: r["maxFails"] for r in rows[:TOP_N]},
    }


def main() -> int:
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    print("=== SEC Fails-to-Deliver 수집 ===")
    try:
        payload = build()
    except Exception as e:  # noqa: BLE001
        print(f"[ftd] 수집 실패({type(e).__name__}: {e}) — 기존 파일 유지")
        return 1
    if not payload:
        print("[ftd] 유효 데이터 없음 — 기존 파일 유지")
        return 1
    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    atomic_write_text(OUT_JSON, compact)
    atomic_write_text(OUT_JS, f"window.SEC_FTD = {compact};\n")
    print(f"file={payload['fileTag']} 기간 {payload['period']['from']}~{payload['period']['to']} 상위 {len(payload['top'])}종목 → {OUT_JSON.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
