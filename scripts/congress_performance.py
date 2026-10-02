"""의원 매매 성과 — 체결일·공시일 진입 각각의 SPY 대비 초과수익 (build_congress_trades 가 부른다).

거래마다 진입일 종가 → min(진입일+HORIZON_DAYS, 마지막 종가일) 종가 수익률을 SPY 같은 구간과 뺀다.
  - 매수: 초과수익 = 종목 수익률 − SPY 수익률
  - 매도: 초과수익 = SPY 수익률 − 종목 수익률 (판 뒤 덜 오르거나 떨어졌으면 +)
두 진입 기준을 따로 낸다.
  - 체결일(transactionDate): 의원 본인의 성과.
  - 공시일(disclosureDate): 공시를 보고 따라 산 사람이 실제로 탈 수 있는 성과(최대 45일 늦음).
가중치는 동일(금액 구간은 $1,001~$15,000 처럼 넓어 중앙값 가중이 큰 구간 한 건에 끌려간다).
거래 한 건의 초과수익은 ±CLIP_PCT 로 자른다 — 매도 뒤 5배 오른 종목 한 건이 평균을 −400%p 끌던 것
(2026-10-02 실측: 평균 −44% · 중앙값 +5% 의원). 중앙값도 같이 싣는다.
보유 기간이 MIN_HOLD_DAYS 미만인 최근 거래는 재지 않는다. 의원 순위는 잰 거래가 MIN_TRADES 이상일 때만.
액면분할·배당은 수정주가(auto_adjust)로 흡수한다. 상장폐지·티커 변경으로 가격이 없는 거래는 뺀다.
"""

from __future__ import annotations

import statistics
from datetime import date, datetime, timedelta

HORIZON_DAYS = 365
CLIP_PCT = 100.0
MIN_HOLD_DAYS = 30
MIN_TRADES = 10
WINDOW_YEARS = 3
BENCH = "SPY"


def _d(raw) -> date | None:
    if isinstance(raw, date):
        return raw
    raw = str(raw or "").strip()
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y"):
        try:
            return datetime.strptime(raw[:10] if fmt == "%Y-%m-%d" else raw, fmt).date()
        except ValueError:
            continue
    return None


def close_on_or_after(series: list[tuple[date, float]], day: date, max_gap: int = 7) -> tuple[date, float] | None:
    """day 당일 또는 그 뒤 첫 거래일 종가(휴장·주말 보정). max_gap 일 안에 없으면 None."""
    lo, hi = 0, len(series)
    while lo < hi:
        mid = (lo + hi) // 2
        if series[mid][0] < day:
            lo = mid + 1
        else:
            hi = mid
    if lo < len(series) and (series[lo][0] - day).days <= max_gap:
        return series[lo]
    return None


def close_on_or_before(series: list[tuple[date, float]], day: date) -> tuple[date, float] | None:
    lo, hi = 0, len(series)
    while lo < hi:
        mid = (lo + hi) // 2
        if series[mid][0] <= day:
            lo = mid + 1
        else:
            hi = mid
    return series[lo - 1] if lo else None


def trade_excess(series, bench, entry_day: date, side: str, today: date) -> float | None:
    """한 거래의 SPY 대비 초과수익(%). 잴 수 없으면 None."""
    if not series or not bench or entry_day is None or entry_day > today:
        return None
    entry = close_on_or_after(series, entry_day)
    b_entry = close_on_or_after(bench, entry_day)
    if not entry or not b_entry or entry[1] <= 0 or b_entry[1] <= 0:
        return None
    exit_day = min(entry[0] + timedelta(days=HORIZON_DAYS), series[-1][0], bench[-1][0])
    if (exit_day - entry[0]).days < MIN_HOLD_DAYS:
        return None
    exit_ = close_on_or_before(series, exit_day)
    b_exit = close_on_or_before(bench, exit_day)
    if not exit_ or not b_exit or exit_[0] <= entry[0]:
        return None
    r = exit_[1] / entry[1] - 1
    rb = b_exit[1] / b_entry[1] - 1
    ex = ((r - rb) if side == "buy" else (rb - r)) * 100
    return max(-CLIP_PCT, min(CLIP_PCT, ex))


def _stats(values: list[float]) -> dict:
    return {
        "n": len(values),
        "avgExcess": round(statistics.fmean(values), 2),
        "medianExcess": round(statistics.median(values), 2),
        "winRate": round(100 * sum(1 for v in values if v > 0) / len(values), 1),
    }


def compute_performance(trades: list[dict], prices: dict[str, list[tuple[date, float]]],
                        today: date | None = None) -> dict:
    """trades: build_congress_trades 정규화 행. prices: 티커 → [(날짜, 수정종가)] 오름차순(BENCH 포함)."""
    today = today or date.today()
    bench = prices.get(BENCH) or []
    per: dict[str, dict] = {}
    for t in trades:
        side = t.get("side")
        if side not in ("buy", "sell"):
            continue
        series = prices.get(t.get("ticker"))
        if not series:
            continue
        rec = per.setdefault(t["politician"], {"tx": [], "disc": [], "txBuy": [], "lag": []})
        tx_day = _d(t.get("transactionDate"))
        disc_day = _d(t.get("disclosureDate"))
        ex = trade_excess(series, bench, tx_day, side, today)
        if ex is not None:
            rec["tx"].append(ex)
            if side == "buy":
                rec["txBuy"].append(ex)
        # 공시일 = 체결일인 행(하원 미러 2026-10-02 실측 14%)은 공시일이 비어 체결일로 채워진 것으로 보고
        # 공시일 기준·지연 계산에서 뺀다 — 넣으면 '따라 사기' 성과가 체결일 성과로 부풀려진다.
        if disc_day and tx_day and disc_day > tx_day:
            ex2 = trade_excess(series, bench, disc_day, side, today)
            if ex2 is not None:
                rec["disc"].append(ex2)
            rec["lag"].append((disc_day - tx_day).days)
    members = []
    for name, rec in per.items():
        if len(rec["tx"]) < MIN_TRADES:
            continue
        row = {"name": name, "tx": _stats(rec["tx"])}
        if len(rec["disc"]) >= MIN_TRADES:
            row["disc"] = _stats(rec["disc"])
        if rec["txBuy"]:
            row["buyAvgExcess"] = round(statistics.fmean(rec["txBuy"]), 2)
        if rec["lag"]:
            row["lagDays"] = int(statistics.median(rec["lag"]))
        members.append(row)
    members.sort(key=lambda r: r["tx"]["avgExcess"], reverse=True)
    measured = sum(len(r["tx"]) for r in per.values())
    return {
        "benchmark": BENCH,
        "horizonDays": HORIZON_DAYS,
        "minTrades": MIN_TRADES,
        "asOf": bench[-1][0].isoformat() if bench else None,
        "measuredTrades": measured,
        "members": members,
    }


def trades_in_window(trades: list[dict], today: date | None = None) -> list[dict]:
    today = today or date.today()
    start = today - timedelta(days=WINDOW_YEARS * 365)
    out = []
    for t in trades:
        d = _d(t.get("transactionDate"))
        if d and start <= d <= today and t.get("side") in ("buy", "sell"):
            out.append(t)
    return out


def load_prices(tickers: list[str], start: date, chunk: int = 150) -> dict[str, list[tuple[date, float]]]:
    """yfinance 일괄 다운로드(수정종가). 실패한 묶음·티커는 조용히 빠진다."""
    import yfinance as yf

    out: dict[str, list[tuple[date, float]]] = {}
    names = sorted(set(tickers) | {BENCH})
    for i in range(0, len(names), chunk):
        part = names[i:i + chunk]
        try:
            df = yf.download(part, start=start.isoformat(), auto_adjust=True, progress=False,
                             group_by="ticker", threads=True)
        except Exception as exc:  # 네트워크 — 이 묶음만 빠진다
            print(f"[perf] 가격 묶음 실패 {part[0]}…: {exc}")
            continue
        for tk in part:
            try:
                col = df[tk]["Close"] if len(part) > 1 else df["Close"]
                if hasattr(col, "columns"):  # 단일 티커에서 MultiIndex 로 오는 버전
                    col = col.iloc[:, 0]
                col = col.dropna()
            except Exception:
                continue
            series = [(idx.date(), float(v)) for idx, v in col.items() if float(v) > 0]
            if len(series) >= 2:
                out[tk] = series
    return out
