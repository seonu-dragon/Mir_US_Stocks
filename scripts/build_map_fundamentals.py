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
import sys
from pathlib import Path

if sys.platform == "win32":
    # cp949 콘솔에서 한글·U+2014 출력이 UnicodeEncodeError 로 죽어 빌드 실패로 둔갑한다.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from briefing_store import atomic_write_text  # noqa: E402  중단 시 잘린 파일 방지
from fundamentals_sanity import sanitize_row  # noqa: E402  이상치 규칙(정의상 무의미 → 결측)

MARKET_PATHS = {
    "us": {
        "details": ROOT / "data" / "details",
        "out_js": ROOT / "data" / "map_fundamentals.js",
        "out_json": ROOT / "data" / "map_fundamentals.json",
        "global": "MAP_FUNDAMENTALS",
        "ticker_key": lambda t: str(t).upper(),
    },
    "kr": {
        "details": ROOT / "data" / "korea" / "details",
        "out_js": ROOT / "data" / "korea" / "map_fundamentals.js",
        "out_json": ROOT / "data" / "korea" / "map_fundamentals.json",
        "global": "KOREA_MAP_FUNDAMENTALS",
        "ticker_key": lambda t: str(t).zfill(6),
    },
}

# fundamentals 키 -> 지도 키 (직접 매핑)
DIRECT = {
    "pe": "pe",
    "forwardPE": "forwardPE",
    "peg": "peg",
    "ps": "ps",
    "pb": "pb",
    "pfcf": "pfcf",
    "evEbitda": "evEbitda",
    "evEbit": "evEbit",
    # DART 재무지표(build_kr_indicators.py). KR 전용 — 미국 상세엔 없어서 자동으로 빠진다.
    "revenueGrowth": "revenueGrowth",
    "operatingGrowth": "operatingGrowth",
    "netGrowth": "netGrowth",
    "debtRatio": "debtRatio",
    "currentRatio": "currentRatio",
    "payoutRatio": "payoutRatio",
    # 주당배당금 — 국내는 네이버·KRX 공식(attach_krx_metrics)이 details 에 dps 로 싣는다. 찾기 › 배당 랭킹이 읽는다.
    "dps": "dps",
    "divYield": "divYield",
    "epsTtm": "eps",
    "roe": "roe",
    "profitMargin": "netMargin",
    "week52Low": "low52",
    "week52High": "high52",
    # KRX 공식 외국인 지표(build_kr_krx_metrics.py → attach_krx_metrics). KR 전용이라
    # 미국 상세엔 이 키가 없어 커버리지 게이트가 알아서 숨긴다.
    "foreignPct": "foreignPct",
    "foreignExhaustion": "foreignExhaustion",
}


def num(v):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if f != f or f in (float("inf"), float("-inf")):  # NaN·무한대(야후 trailingPE "Infinity")
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


def _snapshot_prices(market: str) -> dict:
    """현재가(스냅샷 price). 배당수익률 분모 — 상세 파일의 차트 마지막 종가보다 이게 화면 현재가와 같다."""
    if market != "us":
        return {}
    try:
        snap = json.loads((ROOT / "data" / "market_snapshot.json").read_text(encoding="utf-8"))
    except Exception:
        return {}
    out = {}
    for s in snap.get("stocks") or []:
        p = num(s.get("price"))
        if s.get("ticker") and p and p > 0:
            out[str(s["ticker"]).upper()] = p
    return out


def _parse_dividends(dividends) -> list[tuple[str, float]]:
    out = []
    for e in dividends if isinstance(dividends, list) else []:
        try:
            d, amt = str(e[0])[:10], float(e[1])
        except (TypeError, ValueError, IndexError):
            continue
        if amt > 0 and len(d) == 10:
            out.append((d, amt))
    out.sort()
    return out


def expected_payments_per_year(events: list[tuple[str, float]]):
    """지급 간격 중앙값으로 본 연간 지급 횟수(월 12·분기 4·반기 2·연 1). 기록이 3건 미만이면 None."""
    from datetime import date
    if len(events) < 3:
        return None
    days = [(date.fromisoformat(b[0]) - date.fromisoformat(a[0])).days for a, b in zip(events, events[1:])]
    days = sorted(x for x in days if x > 0)
    if not days:
        return None
    med = days[len(days) // 2]
    if med < 20:
        return None
    return max(1, min(12, round(365 / med)))


def trailing_dividend(dividends, as_of: str):
    """최근 1년 실제 지급 배당 합. (as_of - 1년, as_of] 구간 — 브라우저 quote-info-core.trailingDividend 와
    같은 규칙이라 종목 화면 '최근 1년 배당 합' 과 지도·랭킹 값이 한 기준이 된다.

    상세 파일의 배당 기록에는 중간이 빠진 종목이 있다(RY·ACN: 2025-07 다음이 2026-04 — 분기 배당인데
    1년 안에 2건). 그대로 더하면 수익률이 절반으로 나온다. 그래서 과거 지급 간격으로 본 연간 횟수보다
    구간 안 건수가 적으면 '모름'(None)으로 두고 다른 소스로 넘긴다. 0건도 중단인지 누락인지 모르니 None.
    """
    events = _parse_dividends(dividends)
    if not events:
        return None
    end = str(as_of or "")[:10]
    if len(end) != 10 or end[4] != "-":
        return None
    start = f"{int(end[:4]) - 1}{end[4:]}"
    window = [a for d, a in events if start < d <= end]
    expected = expected_payments_per_year([e for e in events if e[0] <= end])
    if not window or expected is None or len(window) < expected:
        return None
    return round(sum(window), 4)


def apply_trailing_div_yield(market: str, table: dict, details_by_ticker: dict) -> dict:
    """미국 배당수익률을 '최근 12개월 실제 지급 배당 ÷ 현재가' 로 통일한다(divSrc="ttm").

    Finnhub dividendYieldIndicatedAnnual 은 연환산 배당(dividendIndicatedAnnual)을 오래된 가격으로
    나눈 값이라 부풀려져 있었다(2026-09-27 실측: T 1.11/6.85% → 분모 $16.2, 현재가 $25.38 이면 4.38%;
    CRH 1.56/6.99% → 분모 $22.3). 야후와 겹치는 168종목 중 54개가 1.3배 이상 높았다.
    상세 파일(야후)의 배당 이벤트가 있으면 그 합을 쓰고, 없으면 야후 값(divSrc="yahoo"),
    그다음 Finnhub TTM 값(merge_finnhub, divSrc="finnhub") 순으로 채운다.
    주당배당금(dps)도 같은 합으로 채워 배당 랭킹의 '주당배당금 ÷ 현재가' 가 같은 값이 되게 한다.
    """
    counts = {}
    if market != "us":
        return counts
    prices = _snapshot_prices(market)
    for ticker, detail in details_by_ticker.items():
        row = table.get(ticker)
        series = detail.get("chartSeries") or []
        price = prices.get(ticker)
        as_of = None
        if series and isinstance(series[-1], list) and len(series[-1]) >= 6:
            as_of = series[-1][5]
            if price is None:
                price = num(series[-1][3])
        amount = trailing_dividend(detail.get("dividends"), as_of) if as_of else None
        if row is None:
            continue
        if amount is not None and price and price > 0:
            row["divYield"] = round(amount / price * 100, 2)
            row["dps"] = amount
            row["divSrc"] = "ttm"
        elif row.get("divYield") is not None:
            row["divSrc"] = "yahoo"
        else:
            continue
        counts[row["divSrc"]] = counts.get(row["divSrc"], 0) + 1
    # 상세 파일에 없는 칸은 야후 캘린더(us_calendar.json, 시총 상위 ~200종목)로 메운다.
    try:
        cal = json.loads((ROOT / "data" / "us_calendar.json").read_text(encoding="utf-8")).get("stocks") or {}
    except Exception:
        cal = {}
    for ticker, c in cal.items():
        row = table.get(str(ticker).upper())
        y = num((c or {}).get("divYield"))
        if row is None or row.get("divYield") is not None or y is None:
            continue
        row["divYield"] = y
        row["divSrc"] = "yahoo"
        counts["yahoo"] = counts.get("yahoo", 0) + 1
    if counts:
        print(f"  배당수익률 기준: {counts}")
    return counts


def merge_finnhub(market: str, table: dict) -> None:
    """야후가 못 채우는 미국 지표를 Finnhub 값으로 보강한다(build_us_finnhub_metrics.py).

    야후 기준 커버리지가 peg 0.3% · pfcf 0.5% · evEbitda 0.8% · divYield 1.9% 라서
    히트맵에서 그 지표를 고르면 화면이 통째로 회색이었다(커버리지 게이트가 숨김).

    야후 값이 이미 있으면 건드리지 않는다 — 비어 있는 칸만 메운다. 소스가 섞이면
    같은 지표가 종목마다 다른 기준으로 계산돼 비교가 깨질 수 있어서, 보강은
    '없던 것을 채우는' 데까지만 한다.

    Finnhub 무료 티어는 미국 전용이다(한국은 403). KR 은 이 단계를 건너뛴다.
    """
    if market != "us":
        return
    path = ROOT / "data" / "us_finnhub_metrics.json"
    if not path.exists():
        return
    try:
        book = json.loads(path.read_text(encoding="utf-8")).get("metrics") or {}
    except Exception as exc:
        print(f"  [경고] us_finnhub_metrics.json 읽기 실패: {exc}")
        return
    filled = {}
    for ticker, rec in book.items():
        row = table.get(ticker)
        if row is None:
            continue                 # 스냅샷에 없는 종목은 지도에 넣지 않는다
        for k, v in rec.items():
            if k == "divYield" and v and rec.get("divBasis") != "ttm":
                # 예전 형식(dividendYieldIndicatedAnnual, 오래된 가격 기준으로 부풀려짐)은 버린다.
                # 0(무배당)만 믿는다. 다음 Finnhub 실행부터 TTM 기준(divBasis="ttm")으로 온다.
                continue
            if row.get(k) is None and isinstance(v, (int, float)):
                row[k] = v
                filled[k] = filled.get(k, 0) + 1
                if k == "divYield":
                    row["divSrc"] = "finnhub"
    if filled:
        print(f"  finnhub 보강: {filled}")


def add_value_score(table: dict) -> None:
    """저평가 종합 백분위. PER·PBR 는 낮을수록, 배당수익률은 높을수록 '싸다'고 보고 각
    지표의 시장 내 백분위를 매겨 평균한다(가진 지표만, 최소 2개). 0=고평가 ~ 100=저평가.
    예측 신호가 아니라 '여러 멀티플에서 상대적으로 싼가'의 투명한 요약이다(가중치 없음).
    """
    def pct_rank(key: str, low_is_cheap: bool) -> dict:
        pairs = [(t, m[key]) for t, m in table.items()
                 if isinstance(m.get(key), (int, float)) and m[key] > 0]
        if len(pairs) < 20:
            return {}
        pairs.sort(key=lambda x: x[1])  # 오름차순(낮은 값이 앞)
        n = len(pairs)
        out = {}
        for i, (t, _) in enumerate(pairs):
            low_pctile = i / (n - 1) * 100          # 0 = 가장 낮은 값
            out[t] = round(100 - low_pctile if low_is_cheap else low_pctile)
        return out

    pe = pct_rank("pe", True)
    pb = pct_rank("pb", True)
    dv = pct_rank("divYield", False)
    n = 0
    for t, m in table.items():
        comps = [d[t] for d in (pe, pb, dv) if t in d]
        if len(comps) >= 2:
            m["valueScore"] = round(sum(comps) / len(comps))
            n += 1
    print(f"  valueScore(저평가 종합): {n}")


def build_market(market: str) -> None:
    cfg = MARKET_PATHS[market]
    details_dir = cfg["details"]
    table = {}
    ctx_by_ticker = {}
    details_by_ticker = {}
    files = glob.glob(str(details_dir / "*.json"))
    for path in files:
        try:
            detail = json.loads(Path(path).read_text(encoding="utf-8"))
        except Exception:
            continue
        ticker = cfg["ticker_key"](detail.get("ticker") or Path(path).stem)
        fund = detail.get("fundamentals") or {}
        if not ticker or not fund:
            continue
        metrics = extract(fund)
        if metrics:
            table[ticker] = metrics
            ctx_by_ticker[ticker] = {"equityB": fund.get("equityB"), "salesB": fund.get("salesB")}
            if market == "us":
                details_by_ticker[ticker] = {"chartSeries": (detail.get("chartSeries") or [])[-1:],
                                             "dividends": detail.get("dividends")}

    apply_trailing_div_yield(market, table, details_by_ticker)
    merge_finnhub(market, table)
    # 이상치 규칙(scripts/fundamentals_sanity.py): 정의상 의미 없는 값(적자 PER·자본잠식
    # ROE·매출 0 순이익률 등)을 결측으로. finnhub 보강분까지 거치도록 병합 뒤에 한다.
    dropped = {}
    for ticker in list(table):
        for k in sanitize_row(table[ticker], ctx_by_ticker.get(ticker)):
            dropped[k] = dropped.get(k, 0) + 1
        if "divYield" not in table[ticker]:
            table[ticker].pop("divSrc", None)
        if not table[ticker]:
            del table[ticker]
    if dropped:
        print(f"  이상치 규칙으로 결측 처리: {dropped}")
    add_value_score(table)

    payload = json.dumps(table, ensure_ascii=False, separators=(",", ":"))
    atomic_write_text(cfg["out_json"], payload)
    atomic_write_text(cfg["out_js"], f"window.{cfg['global']} = {payload};\n")

    counts = {}
    for metrics in table.values():
        for key in metrics:
            counts[key] = counts.get(key, 0) + 1
    print(f"map_fundamentals[{market}]: {len(table)} tickers")
    for key in ("pe", "forwardPE", "peg", "ps", "pb", "pfcf",
                "evEbitda", "divYield", "eps", "roe", "roa", "netMargin"):
        print(f"  {key}: {counts.get(key, 0)}")


def main(markets=None) -> None:
    targets = markets or ["us", "kr"]
    for market in targets:
        if market not in MARKET_PATHS:
            raise SystemExit(f"unknown market: {market}")
        if not MARKET_PATHS[market]["details"].is_dir():
            print(f"map_fundamentals[{market}]: skipped (no details dir)")
            continue
        build_market(market)


if __name__ == "__main__":
    import sys
    main(sys.argv[1:] or None)
