#!/usr/bin/env python3
"""VIX 기간구조 (build_vix_term_structure.py)
==========================================

시장 › 시그널의 'VIX 기간구조' 위젯 데이터. 두 가지 곡선을 한 파일로 모은다.

* 현물 변동성 지수 곡선 — Cboe 공식 지수 일별 종가 CSV(무키):
  VIX1D(1일) · VIX9D(9일) · VIX(30일) · VIX3M(3개월) · VIX6M(6개월) · VIX1Y(1년).
  `cdn.cboe.com/api/global/us_indices/daily_prices/<지수>_History.csv` — 산업 지표 빌더가 VIX9D·VIX3M 을
  받는 것과 같은 경로·같은 헤더라 Actions 러너에서도 열린다.
* VX 선물 월물 곡선 — Cboe 선물 거래소 계약별 일별 정산가 CSV(무키):
  `cdn.cboe.com/data/us/futures/market_statistics/historical_data/VX/VX_<만기일>.csv`.
  만기일은 규칙으로 계산한다(다음 달 셋째 금요일의 30일 전 수요일, 휴장이면 그 전 영업일 —
  파일이 없으면 하루씩 당겨 최대 3일 시도). 지어낸 만기 파일은 404 라 저절로 걸러진다.

산출물: data/vix_term_structure.json + .js(window.VIX_TERM_STRUCTURE)
  spot    : [{id, days, v, prev, date}]             — 최신 거래일 값과 전일 값
  futures : [{exp, label, days, settle, prev, oi, vol}] — 최신 거래일에 정산가가 있는 월물(만기순)
  week / month : 5·21 거래일 전 같은 형태의 선물 곡선(겹쳐 그리기용)
  history : [[date, vix, vix3m, vx1, vx2]]           — 최근 약 1년(252거래일), 없는 값은 null
  count   : 곡선 점 수(현물 + 선물) — 0 이면 신선도 관문이 잡는다

실패 처리: VIX 현물이나 선물 곡선(월물 2개 미만) 중 하나라도 못 받으면 파일을 건드리지 않고 exit 1.
실행:  py scripts/build_vix_term_structure.py [--push]
"""

from __future__ import annotations

import argparse
import csv
import io
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

OUT_JSON = ROOT / "data" / "vix_term_structure.json"
OUT_JS = ROOT / "data" / "vix_term_structure.js"
KST = timezone(timedelta(hours=9))
UA_BROWSER = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
              "Accept": "application/json,text/csv,*/*"}

SPOT_URL = "https://cdn.cboe.com/api/global/us_indices/daily_prices/{sym}_History.csv"
VX_URL = "https://cdn.cboe.com/data/us/futures/market_statistics/historical_data/VX/VX_{exp}.csv"
# 계약별 CDN 파일은 하루 늦게 갱신되는 날이 있다 — 그 뒤 거래일은 거래소 일별 정산가 CSV 로 채운다
# (전 상품 한 파일, 미결제약정·거래량 없음). 열리지 않으면(차단) 계약별 파일까지만 쓴다.
SETTLE_URL = "https://www.cboe.com/us/futures/market_statistics/settlement/csv?dt={day}"

# (지수, 만기 일수) — Cboe 지수 정의의 목표 만기.
SPOT_TENORS = [("VIX1D", 1), ("VIX9D", 9), ("VIX", 30), ("VIX3M", 93), ("VIX6M", 183), ("VIX1Y", 365)]
HISTORY_DAYS = 252
FORWARD_MONTHS = 9      # 최신 곡선에 담을 앞으로의 월물 수(Cboe 가 상장한 만큼만 남는다)
BACK_MONTHS = 13        # 1년 이력용으로 이미 만기된 월물


def kst_now_str() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def third_friday(year: int, month: int) -> date:
    d = date(year, month, 1)
    first_fri = d + timedelta(days=(4 - d.weekday()) % 7)
    return first_fri + timedelta(days=14)


def vx_expiration(year: int, month: int) -> date:
    """`month` 월물 VX 의 규칙상 최종 정산일 = 다음 달 셋째 금요일의 30일 전(수요일)."""
    ny, nm = (year + 1, 1) if month == 12 else (year, month + 1)
    return third_friday(ny, nm) - timedelta(days=30)


def month_add(year: int, month: int, k: int) -> tuple[int, int]:
    idx = year * 12 + (month - 1) + k
    return idx // 12, idx % 12 + 1


def parse_spot_csv(text: str) -> list[tuple[str, float]]:
    """Cboe 지수 CSV(DATE,OPEN,HIGH,LOW,CLOSE — VIX1D 처럼 열 이름이 다를 수 있음) → [(YYYY-MM-DD, 종가)]."""
    rows = list(csv.reader(io.StringIO(text)))
    if not rows:
        return []
    head = [h.strip().upper() for h in rows[0]]
    if "DATE" not in head:
        return []
    di = head.index("DATE")
    ci = head.index("CLOSE") if "CLOSE" in head else len(head) - 1
    out = []
    for r in rows[1:]:
        if len(r) <= max(di, ci):
            continue
        ds = r[di].strip()
        try:
            if "/" in ds:
                m, d, y = ds.split("/")
                ds = f"{int(y):04d}-{int(m):02d}-{int(d):02d}"
            datetime.strptime(ds, "%Y-%m-%d")
            v = float(r[ci])
        except (ValueError, TypeError):
            continue
        if v > 0:
            out.append((ds, v))
    out.sort()
    dedup = {}
    for ds, v in out:
        dedup[ds] = v
    return sorted(dedup.items())


def parse_vx_csv(text: str) -> list[dict]:
    """계약별 CSV(Trade Date,Futures,Open,High,Low,Close,Settle,Change,Total Volume,EFP,Open Interest)
    → [{date, settle, vol, oi}] (정산가 0 이하·형식 오류 행은 버린다)."""
    reader = csv.DictReader(io.StringIO(text))
    out = []
    for r in reader:
        row = {(k or "").strip().lower(): (v or "").strip() for k, v in r.items()}
        ds = row.get("trade date", "")
        try:
            datetime.strptime(ds, "%Y-%m-%d")
            settle = float(row.get("settle", ""))
        except ValueError:
            continue
        if settle <= 0:
            continue

        def _int(key):
            try:
                return int(float(row.get(key, "") or 0))
            except ValueError:
                return None

        out.append({"date": ds, "settle": round(settle, 4), "vol": _int("total volume"), "oi": _int("open interest")})
    out.sort(key=lambda x: x["date"])
    return out


def parse_settlement_csv(text: str) -> dict[str, float]:
    """거래소 일별 정산가 CSV(Product,Symbol,Expiration Date,Price) → {만기일: 정산가} — VX 월물(VX/X6)만."""
    import re
    out = {}
    for r in csv.DictReader(io.StringIO(text)):
        row = {(k or "").strip().lower(): (v or "").strip() for k, v in r.items()}
        if row.get("product") != "VX" or not re.fullmatch(r"VX/[A-Z]\d", row.get("symbol", "")):
            continue
        try:
            datetime.strptime(row.get("expiration date", ""), "%Y-%m-%d")
            price = float(row.get("price", ""))
        except ValueError:
            continue
        if price > 0:
            out[row["expiration date"]] = round(price, 4)
    return out


def fetch_text(url: str, label: str) -> str:
    from sec_client import http_get_with_backoff
    return http_get_with_backoff(url, headers=UA_BROWSER, timeout=30, label=label).decode("utf-8-sig", "replace")


def fetch_contract(year: int, month: int) -> tuple[str, list[dict]] | None:
    """규칙 만기일부터 하루씩 당겨(휴장 조정) 파일을 찾는다. 없으면 None."""
    exp = vx_expiration(year, month)
    for back in range(0, 3):
        d = exp - timedelta(days=back)
        if d.weekday() >= 5:
            continue
        try:
            rows = parse_vx_csv(fetch_text(VX_URL.format(exp=d.isoformat()), f"VX {d}"))
        except Exception as exc:  # 없는 파일은 CDN 이 403/404 로 답한다 = 그 날짜엔 만기가 없다
            if getattr(exc, "code", None) in (403, 404):
                continue
            raise
        if rows:
            return d.isoformat(), rows
    return None


def curve_on(contracts: dict[str, list[dict]], day: str, limit: int = FORWARD_MONTHS) -> list[dict]:
    """`day` 에 정산가가 있는, 만기가 그날보다 뒤인 월물 곡선(만기순)."""
    d0 = datetime.strptime(day, "%Y-%m-%d").date()
    out = []
    for exp in sorted(contracts):
        if exp <= day:
            continue
        rows = contracts[exp]
        idx = {r["date"]: i for i, r in enumerate(rows)}
        if day not in idx:
            continue
        i = idx[day]
        r = rows[i]
        prev = rows[i - 1]["settle"] if i > 0 else None
        days = (datetime.strptime(exp, "%Y-%m-%d").date() - d0).days
        out.append({"exp": exp, "label": exp[:7], "days": days, "settle": r["settle"], "prev": prev,
                    "oi": r.get("oi"), "vol": r.get("vol")})
        if len(out) >= limit:
            break
    return out


def build_payload(spot_series: dict[str, list[tuple[str, float]]], contracts: dict[str, list[dict]]) -> dict | None:
    vix = spot_series.get("VIX") or []
    if len(vix) < 30:
        return None
    # 기준 거래일 = 선물 정산가가 있는 가장 최근 날 중 VIX 종가도 있는 날.
    vix_dates = {d for d, _ in vix}
    fut_dates = sorted({r["date"] for rows in contracts.values() for r in rows} & vix_dates)
    if not fut_dates:
        return None
    as_of = fut_dates[-1]
    futures = curve_on(contracts, as_of)
    if len(futures) < 2:
        return None

    spot = []
    for sym, days in SPOT_TENORS:
        ser = [(d, v) for d, v in (spot_series.get(sym) or []) if d <= as_of]
        if not ser:
            continue
        d, v = ser[-1]
        if (datetime.strptime(as_of, "%Y-%m-%d") - datetime.strptime(d, "%Y-%m-%d")).days > 7:
            continue  # 멈춘 지수(오래된 값)는 곡선에 섞지 않는다
        prev = ser[-2][1] if len(ser) > 1 else None
        spot.append({"id": sym, "days": days, "v": round(v, 2), "prev": round(prev, 2) if prev else None, "date": d})

    hist_dates = fut_dates[-HISTORY_DAYS:]
    v3 = dict(spot_series.get("VIX3M") or [])
    vmap = dict(vix)
    history = []
    for d in hist_dates:
        c = curve_on(contracts, d, limit=2)
        history.append([d, vmap.get(d), v3.get(d),
                        c[0]["settle"] if len(c) > 0 else None,
                        c[1]["settle"] if len(c) > 1 else None])

    def back_curve(n):
        if len(fut_dates) <= n:
            return None
        d = fut_dates[-1 - n]
        return {"date": d, "futures": curve_on(contracts, d)}

    return {
        "updatedAtKst": kst_now_str(),
        "asOf": as_of,
        "source": "Cboe Global Indices (지수 일별 종가) · Cboe Futures Exchange (VX 정산가)",
        "count": len(spot) + len(futures),
        "spot": spot,
        "futures": futures,
        "week": back_curve(5),
        "month": back_curve(21),
        "history": history,
    }


def collect() -> tuple[dict, dict, list[str]]:
    errors = []
    spot_series = {}
    for sym, _ in SPOT_TENORS:
        try:
            spot_series[sym] = parse_spot_csv(fetch_text(SPOT_URL.format(sym=sym), sym))
            print(f"  {sym}: {len(spot_series[sym])}일 (마지막 {spot_series[sym][-1][0] if spot_series[sym] else '—'})")
        except Exception as exc:
            errors.append(f"{sym}: {exc}")
    today = datetime.now(KST).date()
    contracts = {}
    for k in range(-BACK_MONTHS, FORWARD_MONTHS + 1):
        y, m = month_add(today.year, today.month, k)
        try:
            got = fetch_contract(y, m)
        except Exception as exc:
            errors.append(f"VX {y}-{m:02d}: {exc}")
            continue
        if got:
            exp, rows = got
            contracts[exp] = rows
    print(f"  VX 월물 {len(contracts)}개: {', '.join(sorted(contracts))}")
    vix_last = (spot_series.get("VIX") or [("", 0)])[-1][0]
    fut_last = max((r["date"] for rows in contracts.values() for r in rows), default="")
    if vix_last and fut_last and vix_last > fut_last:
        try:
            settle = parse_settlement_csv(fetch_text(SETTLE_URL.format(day=vix_last), f"VX settlement {vix_last}"))
        except Exception as exc:
            settle = {}
            errors.append(f"VX 정산가 {vix_last}: {exc}")
        added = merge_settlement(contracts, vix_last, settle)
        print(f"  거래소 정산가 {vix_last}: 월물 {added}개 보충")
    return spot_series, contracts, errors


def merge_settlement(contracts: dict[str, list[dict]], day: str, settle: dict[str, float]) -> int:
    """계약별 이력 끝에 `day` 정산가를 붙인다(이미 있으면 그대로). 붙인 월물 수."""
    added = 0
    for exp, price in settle.items():
        rows = contracts.get(exp)
        if rows is None or exp <= day or any(r["date"] == day for r in rows):
            continue
        if rows and rows[-1]["date"] > day:
            continue
        rows.append({"date": day, "settle": price, "vol": None, "oi": None})
        added += 1
    return added


def main() -> int:
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
            sys.stderr.reconfigure(encoding="utf-8")
        except Exception:
            pass
    ap = argparse.ArgumentParser(description="VIX 기간구조(Cboe 현물 지수 + VX 선물)")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()

    print("=== VIX 기간구조 수집 ===")
    spot_series, contracts, errors = collect()
    for e in errors:
        print(f"[warn] {e}")
    payload = build_payload(spot_series, contracts)
    if not payload:
        print("[error] VIX 현물 또는 선물 곡선(월물 2개 이상)을 못 받았다 — 기존 파일 유지")
        return 1
    print(f"기준일 {payload['asOf']} · 현물 {len(payload['spot'])}개 · 선물 {len(payload['futures'])}개 · 이력 {len(payload['history'])}일")

    from sec_client import write_data
    from briefing_store import repository_publish_lock
    with repository_publish_lock(ROOT):
        write_data(OUT_JSON, OUT_JS, "VIX_TERM_STRUCTURE", payload, indent=None)
        if args.push:
            from sec_client import git_publish
            if not git_publish(["data/vix_term_structure.json", "data/vix_term_structure.js"], "VIX term structure (Cboe)"):
                return 1
    print(f"→ {OUT_JSON.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
