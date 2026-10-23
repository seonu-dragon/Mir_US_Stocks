#!/usr/bin/env python3
"""일일 공매도량 — FINRA 규정 SHO 일별 공매도 거래량(무료·키 불필요).

기존 공매도잔고(short_interest)는 격주 갱신이라 느리다. FINRA 는 **매일** 거래소 통합
공매도 거래량/총거래량을 공개한다. 공매도 거래량 비율(shortVolume/totalVolume)은
그날 매도 압력의 단기 지표다(공매도잔고와 달리 데이 트레이딩·헤지도 포함되니 참고용).

  https://cdn.finra.org/equity/regsho/daily/CNMSshvol<YYYYMMDD>.txt
  Date|Symbol|ShortVolume|ShortExemptVolume|TotalVolume|Market

최근 영업일들을 뒤에서부터 받아(발표 지연 1~2일) 종목별 최근 비율 + 추이(sparkline)를
만든다. 스냅샷의 미국 종목만 남긴다. 값 없으면 기존 파일 유지.

산출물: data/finra_short_volume.json + .js(window.FINRA_SHORT_VOLUME).

시장 단위 지수(2026-10-23): S&P 500 구성 종목의 공매도 거래량 비율을 거래대금(FINRA 보고 거래량 ×
스냅샷 종가)으로 가중 평균한 값 = Σ(공매도량·가격) / Σ(총거래량·가격). SqueezeMetrics DIX 와 같은
방식의 계산이지만 그 수치가 아니며, '다크풀 매수' 같은 해석은 붙이지 않는다. 공매도 **거래량**이지
잔고가 아니다(마켓메이커 헤지·당일 청산 포함). 가격은 실행 시점 스냅샷 종가라 과거 날짜를 처음
채울 때는 근사다 — 한 번 기록한 날짜 값은 다시 계산하지 않는다(누적 이력).
  data/short_volume_index.json + .js(window.SHORT_VOLUME_INDEX)
  --backfill N : 이력에 없는 최근 N 일(달력일)을 추가로 받아 채운다(기본 30, 최초 1회용).
"""

from __future__ import annotations

import json
import sys
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path
import sec_client as sec  # noqa: E402  (http_get_with_backoff)

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / "data" / "market_snapshot.json"
OUT_JSON = ROOT / "data" / "finra_short_volume.json"
OUT_JS = ROOT / "data" / "finra_short_volume.js"
IDX_JSON = ROOT / "data" / "short_volume_index.json"
IDX_JS = ROOT / "data" / "short_volume_index.js"
IDX_NAME = "공매도 거래량 비율 지수(S&P 500, 잔고 아님)"
IDX_KEEP = 520       # 이력 최대 길이(영업일 ≈ 2년)
IDX_MIN_COVER = 400  # 그날 S&P 500 중 이만큼 이상 잡혀야 값을 기록한다(반쪽 날 방지)
UA = {"User-Agent": "Mir US Stocks research (dydtjsdn@gmail.com)"}
DAYS = 12   # 최근 며칠을 뒤에서부터 시도
WANT = 10   # 실제로 받을 파일 수(영업일)


def kst_now_str() -> str:
    return datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M KST")


def fetch_day(d: datetime):
    url = f"https://cdn.finra.org/equity/regsho/daily/CNMSshvol{d.strftime('%Y%m%d')}.txt"
    try:
        return sec.http_get_with_backoff(
            url, headers=UA, timeout=30,
            label=f"finra {d:%Y-%m-%d}").decode("utf-8", "replace")
    except Exception:
        # 주말·휴일 파일은 404 라 정상이다(호출부가 다음 날짜로 넘어간다).
        return None


def norm_symbol(sym: str) -> str:
    """FINRA 'BF/B' → 스냅샷 'BF.B'."""
    return sym.strip().upper().replace("/", ".")


def parse_raw(text: str, universe: set[str]) -> dict[str, tuple[float, float]]:
    """{symbol: (shortVolume, totalVolume)} — universe 로 필터."""
    out = {}
    for line in text.splitlines()[1:]:
        parts = line.split("|")
        if len(parts) < 5:
            continue
        sym = norm_symbol(parts[1])
        if sym not in universe:
            continue
        try:
            sv = float(parts[2]); tv = float(parts[4])
        except ValueError:
            continue
        if tv > 0 and sv >= 0:
            out[sym] = (sv, tv)
    return out


def parse(text: str, universe: set[str]) -> dict[str, float]:
    """{symbol: shortRatio(%)}. universe 로 필터해 파일 대비 소량만 남긴다."""
    return {sym: round(sv / tv * 100, 1) for sym, (sv, tv) in parse_raw(text, universe).items()}


def index_point(raw: dict[str, tuple[float, float]], prices: dict[str, float]) -> dict | None:
    """S&P 500 거래대금 가중 공매도 거래량 비율(%) = Σ(sv·p)/Σ(tv·p).

    prices 의 키가 곧 구성 종목이다. 잡힌 종목이 IDX_MIN_COVER 미만이면 None(반쪽 날).
    """
    num = den = 0.0
    n = 0
    for sym, p in prices.items():
        if sym not in raw or not p or p <= 0:
            continue
        sv, tv = raw[sym]
        num += sv * p
        den += tv * p
        n += 1
    if n < IDX_MIN_COVER or den <= 0:
        return None
    return {"v": round(num / den * 100, 2), "n": n, "dvB": round(den / 1e9, 2)}


def merge_index_history(prev: list, fresh: dict, keep: int = IDX_KEEP) -> list:
    """이미 기록한 날짜는 그대로 두고 새 날짜만 더한다(오래된→최신, 최대 keep 개)."""
    by_d = {}
    for row in prev or []:
        if isinstance(row, dict) and isinstance(row.get("d"), str) and isinstance(row.get("v"), (int, float)):
            by_d[row["d"]] = row
    for d, pt in fresh.items():
        if d not in by_d and pt:
            by_d[d] = {"d": d, **pt}
    return [by_d[d] for d in sorted(by_d)][-keep:]


def sp500_prices(snap: dict) -> dict[str, float]:
    out = {}
    for s in snap.get("stocks") or []:
        if "idx_sp500" not in (s.get("groups") or []):
            continue
        t = str(s.get("ticker") or "").upper()
        try:
            p = float(s.get("price"))
        except (TypeError, ValueError):
            continue
        if t and p > 0:
            out[t] = p
    return out


def index_payload(history: list) -> dict:
    vals = [r["v"] for r in history]
    last = history[-1] if history else None
    tail = vals[-20:]
    return {"updatedAtKst": kst_now_str(), "asOf": last["d"] if last else None, "name": IDX_NAME,
            "source": "FINRA 규정 SHO 일별 공매도 거래량(CNMS·장외 보고분) · 가중치 = 거래량 × 스냅샷 종가",
            "latest": last, "avg20": round(sum(tail) / len(tail), 2) if tail else None,
            "count": len(history), "history": history}


def build(index_out: dict | None = None, backfill: int = 0) -> dict | None:
    snap = json.loads(SNAPSHOT.read_text(encoding="utf-8")) if SNAPSHOT.exists() else {"stocks": []}
    prices = sp500_prices(snap)
    fresh_idx: dict = {}
    universe = {str(s.get("ticker") or "").upper() for s in (snap.get("stocks") or [])
               if s.get("sector") != "EXCHANGE TRADED FUNDS" and s.get("ticker")}
    if not universe:
        return None

    days = []  # [(date_str, {sym: ratio}), ...] 오래된→최신
    d = datetime.now(timezone.utc)
    tried = 0
    got = 0
    while got < WANT and tried < DAYS + 8:
        text = fetch_day(d)
        tried += 1
        if text and text.startswith("Date|"):
            raw = parse_raw(text, universe)
            ratios = {sym: round(sv / tv * 100, 1) for sym, (sv, tv) in raw.items()}
            if ratios:
                days.append((d.strftime("%Y-%m-%d"), ratios))
                got += 1
                fresh_idx[d.strftime("%Y-%m-%d")] = index_point(raw, prices)
        d -= timedelta(days=1)
    if index_out is not None and prices:
        prev = []
        if IDX_JSON.exists():
            try:
                prev = json.loads(IDX_JSON.read_text(encoding="utf-8")).get("history") or []
            except Exception:  # noqa: BLE001
                prev = []
        have = {r.get("d") for r in prev if isinstance(r, dict)} | set(fresh_idx)
        # 이력의 빈 날짜(최초 실행·러너가 며칠 못 돈 날)를 메운다. 기본 30일, --backfill 로 늘린다.
        bd = d
        limit = datetime.now(timezone.utc) - timedelta(days=max(30, backfill))
        while bd > limit:
            ds = bd.strftime("%Y-%m-%d")
            if bd.weekday() < 5 and ds not in have:
                text = fetch_day(bd)
                if text and text.startswith("Date|"):
                    fresh_idx[ds] = index_point(parse_raw(text, set(prices)), prices)
            bd -= timedelta(days=1)
        index_out["history"] = merge_index_history(prev, {k: v for k, v in fresh_idx.items() if v})
    if not days:
        return None
    days.reverse()  # 오래된→최신
    as_of = days[-1][0]

    stocks = {}
    mkt_short = mkt_total = 0.0
    latest_ratios = days[-1][1]
    for sym, ratio in latest_ratios.items():
        hist = [dm[sym] for _, dm in days if sym in dm]
        stocks[sym] = {"ratio": ratio, "hist": hist}
    # 시장 평균 공매도 비율(최신일, 종목 단순 평균)
    if latest_ratios:
        mkt = round(sum(latest_ratios.values()) / len(latest_ratios), 1)
    else:
        mkt = None
    return {"updatedAtKst": kst_now_str(), "asOf": as_of, "days": len(days),
            "source": "FINRA 규정 SHO 일별 공매도 거래량(통합)",
            "market": {"avgShortRatio": mkt, "tickers": len(stocks)},
            "stocks": stocks}


def main() -> int:
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    print("=== 일일 공매도량 수집 (FINRA) ===")
    backfill = 0
    if "--backfill" in sys.argv:
        backfill = int(sys.argv[sys.argv.index("--backfill") + 1])
    index_out: dict = {}
    try:
        payload = build(index_out, backfill)
    except Exception as e:  # noqa: BLE001
        print(f"[finra] 수집 실패({type(e).__name__}: {e}) — 기존 파일 유지")
        return 1
    if not payload:
        print("[finra] 유효 데이터 없음 — 기존 파일 유지")
        return 1
    sec.write_data(OUT_JSON, OUT_JS, "FINRA_SHORT_VOLUME", payload, indent=None)
    print(f"as_of={payload['asOf']} · {payload['days']}일 · {payload['market']['tickers']}종목 "
          f"· 시장평균 공매도비율 {payload['market']['avgShortRatio']}%")
    print(f"Wrote {OUT_JSON.name}, {OUT_JS.name}")
    hist = index_out.get("history") or []
    if hist:
        try:
            sec.write_data(IDX_JSON, IDX_JS, "SHORT_VOLUME_INDEX", index_payload(hist), indent=None)
            last = hist[-1]
            print(f"[지수] {last['d']} {last['v']}% (S&P 500 {last['n']}종목) · 이력 {len(hist)}일 → {IDX_JSON.name}")
        except Exception as e:  # noqa: BLE001
            print(f"[지수] 기록 실패({type(e).__name__}: {e}) — 기존 파일 유지")
    else:
        print("[지수] 새로 계산된 날 없음 — 기존 파일 유지")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
