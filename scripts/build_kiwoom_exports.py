#!/usr/bin/env python3
"""Generate Kiwoom automation export JSON files (scanner, community, analysis)."""

from __future__ import annotations

import json
import math
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(ROOT / "scripts"))

from pattern_lib import rows_from_chart_series  # noqa: E402

KST = ZoneInfo("Asia/Seoul")
DEFAULT_HORIZON = 20
PERIOD_BARS = {"1Y": 252, "6M": 126, "3M": 63, "1M": 21}


def scan_clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def scan_tanh(x: float) -> float:
    return math.tanh(x)


def scan_mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def scan_rsi_bias(rsi: float | None) -> float:
    if rsi is None or not math.isfinite(rsi):
        return 0.0
    if rsi >= 70:
        return 0.25
    if rsi >= 55:
        return 0.7
    if rsi >= 50:
        return 0.35
    if rsi >= 40:
        return -0.3
    if rsi >= 30:
        return -0.55
    return 0.15


def scan_series_bias(series: list[float] | None) -> float:
    values = [float(v) for v in (series or []) if isinstance(v, (int, float)) and math.isfinite(v)]
    if len(values) < 20:
        return 0.0
    last = values[-1]
    sma_short = scan_mean(values[-5:])
    sma_long = scan_mean(values[-20:])
    bias = 0.0
    bias += 0.5 if sma_short > sma_long else -0.5
    bias += 0.25 if last > sma_short else -0.25
    ref = values[-10] if len(values) >= 10 else last or 1.0
    slope = (last - ref) / abs(ref or 1.0)
    bias += scan_clamp(slope * 5, -0.5, 0.5)
    return scan_clamp(bias, -1, 1)


def scan_quick_prob(item: dict, horizon: int = DEFAULT_HORIZON) -> dict:
    """Port of app.js scanQuickProb (lines 5660-5689)."""
    short_w = 1.4 if horizon <= 5 else (0.5 if horizon >= 60 else 0.9)
    long_w = 1.5 if horizon >= 60 else (0.7 if horizon <= 5 else 1.1)
    signals: list[tuple[float, float]] = []

    def push(bias: float | None, weight: float) -> None:
        if bias is not None and math.isfinite(bias):
            signals.append((bias, weight))

    rs = item.get("rsScore")
    if isinstance(rs, (int, float)) and math.isfinite(rs):
        push(scan_clamp((rs - 50) / 45, -1, 1), 1.4)

    eps = item.get("epsRevScore")
    if isinstance(eps, (int, float)) and math.isfinite(eps):
        push(scan_clamp((eps - 50) / 45, -1, 1), 1.0)

    three_m = item.get("threeMonthChangePct")
    if isinstance(three_m, (int, float)) and math.isfinite(three_m):
        push(scan_tanh(three_m / 15), 1.2 * long_w)

    month = item.get("monthChangePct")
    if isinstance(month, (int, float)) and math.isfinite(month):
        push(scan_tanh(month / 8), 0.9)

    week = item.get("weekChangePct")
    if isinstance(week, (int, float)) and math.isfinite(week):
        push(scan_tanh(week / 4), 0.6 * short_w)

    push(scan_rsi_bias(item.get("rsi14")), 0.7 * short_w)

    stoch = item.get("stochK")
    if isinstance(stoch, (int, float)) and math.isfinite(stoch):
        push(scan_clamp((stoch - 50) / 45, -1, 1) * 0.8, 0.4 * short_w)

    trend_sign = math.copysign(
        1,
        (month if isinstance(month, (int, float)) and math.isfinite(month) else 0)
        or (week if isinstance(week, (int, float)) and math.isfinite(week) else 0)
        or 0,
    )
    volume_ratio = item.get("volumeRatio")
    if isinstance(volume_ratio, (int, float)) and math.isfinite(volume_ratio) and trend_sign != 0:
        push(trend_sign * scan_clamp((volume_ratio - 1) / 1.5, -0.5, 1), 0.5)

    dist = item.get("newHighDistancePct")
    if isinstance(dist, (int, float)) and math.isfinite(dist):
        push(scan_clamp((10 - dist) / 10, -0.3, 1), 0.5)

    push(scan_series_bias(item.get("closeSeries")), 0.8)

    total_w = sum(weight for _, weight in signals) or 1.0
    z = sum(bias * weight for bias, weight in signals) / total_w
    up = scan_clamp(50 + 38 * z, 12, 88)
    return {"up": up, "z": z}


def rsi_state(value: float | None) -> str:
    if value is None or not math.isfinite(value):
        return "unknown"
    if value >= 70:
        return "overbought"
    if value <= 30:
        return "oversold"
    if value >= 55:
        return "bullish"
    if value <= 45:
        return "bearish"
    return "neutral"


def trend_score(item: dict) -> float:
    prob = scan_quick_prob(item)
    month = item.get("monthChangePct") or 0
    rs = item.get("rsScore") or 50
    return round(scan_clamp(prob["up"] * 0.6 + rs * 0.25 + (50 + month) * 0.15, 0, 100), 1)


def volume_score(item: dict) -> float:
    ratio = item.get("volumeRatio") or 1.0
    return round(scan_clamp(50 + (ratio - 1) * 35, 20, 90), 1)


def scanner_reason(item: dict) -> str:
    parts: list[str] = []
    month = item.get("monthChangePct")
    if isinstance(month, (int, float)) and month > 3:
        parts.append("단기 추세 강세")
    elif isinstance(month, (int, float)) and month < -3:
        parts.append("단기 조정 구간")

    dist = item.get("newHighDistancePct")
    if isinstance(dist, (int, float)) and dist <= 5:
        parts.append("신고가 근접")
    elif isinstance(dist, (int, float)) and dist <= 12:
        parts.append("저항선 재돌파 시도")

    rsi = item.get("rsi14")
    if isinstance(rsi, (int, float)):
        if 45 <= rsi <= 60:
            parts.append("RSI 중립권")
        elif rsi >= 70:
            parts.append("RSI 과열 주의")

    vol = item.get("volumeRatio")
    if isinstance(vol, (int, float)) and vol >= 1.2:
        parts.append("거래량 동반")
    elif isinstance(vol, (int, float)) and vol < 0.7:
        parts.append("거래량 둔화")

    if not parts:
        parts.append("스냅샷 지표 종합 상위")
    return " · ".join(parts[:3])


def build_scanner_items(stocks: list[dict], market: str, limit: int = 50) -> list[dict]:
    candidates = [
        stock
        for stock in stocks
        if isinstance(stock.get("closeSeries"), list) and len(stock["closeSeries"]) >= 20
    ]
    scored = []
    for stock in candidates:
        prob = scan_quick_prob(stock)
        scored.append(
            {
                "ticker": stock.get("ticker", ""),
                "name": stock.get("company") or stock.get("name") or stock.get("ticker", ""),
                "probability_score": round(prob["up"], 1),
                "trend_score": trend_score(stock),
                "volume_score": volume_score(stock),
                "rsi_state": rsi_state(stock.get("rsi14")),
                "reason": scanner_reason(stock),
                "_stock": stock,
            }
        )
    scored.sort(key=lambda x: x["probability_score"], reverse=True)
    items = []
    for rank, entry in enumerate(scored[:limit], 1):
        row = {k: v for k, v in entry.items() if k != "_stock"}
        row["rank"] = rank
        items.append(row)
    return items


def compute_community_hot_topics(social: dict, limit: int = 20) -> list[dict]:
    """Port of app.js computeCommunityHotTopics."""
    scores: dict[str, dict] = {}

    def add(ticker: str | None, weight: float, source: str) -> None:
        key = str(ticker or "").upper().strip()
        if not key:
            return
        prev = scores.get(key) or {"ticker": key, "score": 0.0, "sources": set()}
        prev["score"] += weight
        prev["sources"].add(source)
        scores[key] = prev

    for idx, item in enumerate(social.get("reddit") or []):
        mentions = item.get("mentions") or 0
        add(item.get("ticker"), max(1, 12 - idx) + min(6, mentions / 200), "reddit")

    for idx, item in enumerate(social.get("stocktwits") or []):
        add(item.get("ticker"), max(1, 10 - idx), "stocktwits")

    for idx, item in enumerate(social.get("yahoo") or []):
        add(item.get("ticker"), max(1, 8 - idx), "yahoo")

    ranked = sorted(scores.values(), key=lambda x: x["score"], reverse=True)[:limit]
    stock_lookup = {}

    items = []
    for rank, topic in enumerate(ranked, 1):
        ticker = topic["ticker"]
        stock = stock_lookup.get(ticker, {})
        sources = sorted(topic["sources"])
        sentiment = "mixed"
        change = item_change(topic, social)
        if change is not None:
            if change >= 5:
                sentiment = "bullish"
            elif change <= -5:
                sentiment = "bearish"
        items.append(
            {
                "rank": rank,
                "ticker": ticker,
                "name": stock.get("name") or ticker,
                "mention_count": int(round(topic["score"] * 100)),
                "mention_change_rate": round(change or 0.0, 1),
                "sentiment_hint": sentiment,
                "reason": community_reason(sources, change),
                "sources": sources,
            }
        )
    return items


def item_change(topic: dict, social: dict) -> float | None:
    for source in ("reddit", "stocktwits", "yahoo"):
        for item in social.get(source) or []:
            if str(item.get("ticker", "")).upper() == topic["ticker"]:
                change = item.get("change24h")
                if isinstance(change, (int, float)):
                    return float(change)
    return None


def community_reason(sources: list[str], change: float | None) -> str:
    labels = {"reddit": "Reddit", "stocktwits": "Stocktwits", "yahoo": "Yahoo"}
    src = " · ".join(labels.get(s, s) for s in sources) or "소셜"
    if change is not None and change >= 10:
        return f"{src} 언급 급증"
    if change is not None and change <= -10:
        return f"{src} 언급 감소"
    return f"{src} 종합 언급 상위"


def sma(values: list[float], period: int) -> float | None:
    if len(values) < period:
        return None
    return sum(values[-period:]) / period


def compute_rsi(closes: list[float], period: int = 14) -> float | None:
    if len(closes) < period + 1:
        return None
    gains = []
    losses = []
    for i in range(-period, 0):
        diff = closes[i] - closes[i - 1]
        gains.append(max(diff, 0))
        losses.append(max(-diff, 0))
    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def window_atr(rows: list[dict]) -> float:
    if not rows:
        return 1.0
    start = max(1, len(rows) - 50)
    total = 0.0
    count = 0
    for i in range(start, len(rows)):
        prev_c = rows[i - 1]["c"]
        tr = max(rows[i]["h"] - rows[i]["l"], abs(rows[i]["h"] - prev_c), abs(rows[i]["l"] - prev_c))
        total += tr
        count += 1
    if count:
        return total / count
    return rows[-1]["c"] * 0.02


def support_resistance_levels(rows: list[dict], max_per_side: int = 3) -> list[dict]:
    """Simplified port of analysis.js supportResistanceLevels."""
    n = len(rows)
    if n < 12:
        return []
    price = rows[-1]["c"]
    atr = window_atr(rows)
    atr_pct = atr / price if price else 0.02
    win = max(3, min(8, n // 25))
    fwd = min(20, n // 4)
    candidates: list[dict] = []

    for i in range(win, n - win):
        is_high = all(rows[j]["h"] <= rows[i]["h"] for j in range(i - win, i + win + 1) if j != i)
        is_low = all(rows[j]["l"] >= rows[i]["l"] for j in range(i - win, i + win + 1) if j != i)
        if is_high:
            drop = max((rows[i]["h"] - rows[j]["l"]) for j in range(i + 1, min(n, i + fwd + 1)))
            candidates.append({"price": rows[i]["h"], "touches": 1, "reaction": drop / atr if atr else 0, "idx": i})
        if is_low:
            rise = max((rows[j]["h"] - rows[i]["l"]) for j in range(i + 1, min(n, i + fwd + 1)))
            candidates.append({"price": rows[i]["l"], "touches": 1, "reaction": rise / atr if atr else 0, "idx": i})

    if not candidates:
        return []

    candidates.sort(key=lambda c: c["price"])
    tol = max(0.6 * atr_pct, 0.004)
    clusters: list[dict] = []
    for cand in candidates:
        last = clusters[-1] if clusters else None
        mean = last["sum"] / last["wsum"] if last else 0
        if last and mean and abs(cand["price"] - mean) / mean <= tol:
            last["sum"] += cand["price"]
            last["wsum"] += 1
            last["touches"] += cand["touches"]
            last["reaction"] += cand["reaction"]
            last["idx"] = max(last["idx"], cand["idx"])
        else:
            clusters.append({"sum": cand["price"], "wsum": 1, "touches": cand["touches"], "reaction": cand["reaction"], "idx": cand["idx"]})

    max_t = max(1, max(c["touches"] for c in clusters))
    max_r = max(1e-9, max(c["reaction"] for c in clusters))
    levels = []
    for cluster in clusters:
        p = cluster["sum"] / cluster["wsum"]
        recency = cluster["idx"] / (n - 1) if n > 1 else 0.5
        prox = 1 - min(1, abs(p - price) / (price * 0.25))
        score = 0.22 * (cluster["touches"] / max_t) + 0.18 * (cluster["reaction"] / max_r) + 0.12 * recency + 0.18 * prox
        levels.append({"price": p, "score": score, "type": "sup" if p < price else "res"})

    sup = sorted([l for l in levels if l["type"] == "sup"], key=lambda l: l["score"], reverse=True)[:max_per_side]
    res = sorted([l for l in levels if l["type"] == "res"], key=lambda l: l["score"], reverse=True)[:max_per_side]
    return sup + res


def ma_state(price: float, ma: float | None, label: str) -> str:
    if ma is None:
        return "unknown"
    diff_pct = abs(price - ma) / price * 100 if price else 0
    if diff_pct <= 1.5:
        return f"price_near_{label}"
    return "uptrend" if price > ma else "downtrend"


def volume_comment(rows: list[dict]) -> tuple[str, str]:
    if len(rows) < 21:
        return "unknown", "거래량 데이터 부족"
    recent = sum(r.get("v", 0) or 0 for r in rows[-5:]) / 5
    prior = sum(r.get("v", 0) or 0 for r in rows[-20:-5]) / 15
    if prior <= 0:
        return "normal", "거래량 비교 데이터 부족"
    ratio = recent / prior
    if ratio >= 1.3:
        return "high", "최근 구간 거래량이 평균 대비 증가"
    if ratio <= 0.7:
        return "low", "최근 고점 구간 대비 거래량은 둔화"
    return "normal", "거래량은 평균 수준"


def build_analysis_export(
    ticker: str,
    name: str,
    market: str,
    detail: dict,
    stock: dict | None = None,
    period: str = "6M",
) -> dict | None:
    series = detail.get("chartSeries") or []
    rows = rows_from_chart_series(series)
    bars = PERIOD_BARS.get(period, 252)
    if len(rows) < 60:
        return None
    rows = rows[-bars:]
    closes = [r["c"] for r in rows]
    price = closes[-1]
    start_price = closes[0]
    return_period = ((price / start_price) - 1) * 100 if start_price else 0.0

    levels = support_resistance_levels(rows)
    supports = sorted([round(l["price"], 2) for l in levels if l["type"] == "sup"], reverse=True)[:2]
    resistances = sorted([round(l["price"], 2) for l in levels if l["type"] == "res"])[:2]

    sma20 = sma(closes, 20)
    sma60 = sma(closes, 60)
    sma200 = sma(closes, 200)
    rsi_val = compute_rsi(closes) or (stock or {}).get("rsi14")
    vol_state, vol_comment = volume_comment(rows)

    up_scenario = "저항선 재돌파와 거래량 동반 시 상승 시나리오 유지"
    down_scenario = "단기 이평선 및 지지선 이탈 시 관망 필요"
    if resistances:
        up_scenario = f"저항 {resistances[0]:,.0f} 돌파와 거래량 동반 시 상승 시나리오 유지"
    if supports:
        down_scenario = f"지지 {supports[0]:,.0f} 및 단기 추세선 이탈 시 관망 필요"

    risk_points = []
    if resistances:
        risk_points.append("저항선 돌파 실패 시 단기 조정 가능성")
    if vol_state == "low":
        risk_points.append("거래량 없는 반등은 신뢰도 낮음")
    if isinstance(rsi_val, (int, float)) and rsi_val >= 70:
        risk_points.append("RSI 과열 구간 — 눌림 확인 필요")
    if not risk_points:
        risk_points.append("변동성 확대 시 방향성 재확인 필요")

    return {
        "ticker": ticker,
        "name": name,
        "market": market,
        "period": period,
        "timeframe": "일봉",
        "price": round(price, 2),
        "return_period": round(return_period, 1),
        "support_levels": supports,
        "resistance_levels": resistances,
        "moving_average": {
            "sma20": ma_state(price, sma20, "sma20"),
            "sma60": ma_state(price, sma60, "sma60"),
            "sma200": ma_state(price, sma200, "sma200"),
        },
        "rsi": {
            "period": 14,
            "value": round(float(rsi_val), 1) if isinstance(rsi_val, (int, float)) else None,
            "state": rsi_state(rsi_val if isinstance(rsi_val, (int, float)) else None),
        },
        "volume": {"state": vol_state, "comment": vol_comment},
        "scenario": {"up": up_scenario, "down": down_scenario},
        "risk_points": risk_points,
        "chartSeries": series[-bars:],
    }


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def save_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def detail_path(market: str, ticker: str) -> Path:
    if market == "KR":
        return ROOT / "data" / "korea" / "details" / f"{ticker}.json"
    return ROOT / "data" / "details" / f"{ticker}.json"


def enrich_community_names(items: list[dict], stocks: list[dict]) -> None:
    lookup = {str(s.get("ticker", "")).upper(): s.get("company") or s.get("name") for s in stocks}
    for item in items:
        item["name"] = lookup.get(item["ticker"], item.get("name") or item["ticker"])


def export_analysis_for_targets(targets: list[dict], market: str, stock_lookup: dict) -> list[str]:
    exported = []
    out_dir = ROOT / "data" / "export" / "analysis" / market
    for target in targets:
        ticker = target["ticker"]
        name = target.get("name") or stock_lookup.get(ticker, ticker)
        detail_file = detail_path(market, ticker)
        if not detail_file.exists():
            print(f"[skip] detail missing: {detail_file}")
            continue
        detail = load_json(detail_file)
        stock = stock_lookup.get(ticker)
        analysis = build_analysis_export(ticker, name, market, detail, stock)
        if not analysis:
            print(f"[skip] insufficient chart data: {ticker}")
            continue
        chart_series = analysis.pop("chartSeries", None)
        save_json(out_dir / f"{ticker}.json", analysis)
        if chart_series and detail_file.exists():
            detail_out = detail_path(market, ticker)
            # Keep chart in detail; analysis JSON stays lean per design doc
        exported.append(ticker)
        print(f"[analysis] {market}/{ticker}")
    return exported


def main() -> int:
    now = datetime.now(KST)
    generated_at = now.isoformat(timespec="seconds")

    kr_snapshot = load_json(ROOT / "data" / "korea" / "market_snapshot.json")
    us_snapshot = load_json(ROOT / "data" / "market_snapshot.json")

    kr_items = build_scanner_items(kr_snapshot.get("stocks") or [], "KR", limit=30)
    us_items = build_scanner_items(us_snapshot.get("stocks") or [], "US", limit=30)

    save_json(
        ROOT / "data" / "export" / "domestic_scanner.json",
        {"generated_at": generated_at, "market": "KR", "items": kr_items},
    )
    save_json(
        ROOT / "data" / "export" / "overseas_scanner.json",
        {"generated_at": generated_at, "market": "US", "items": us_items},
    )

    social = us_snapshot.get("social_sentiment") or {}
    mention_items = compute_community_hot_topics(social, limit=15)
    enrich_community_names(mention_items, us_snapshot.get("stocks") or [])
    save_json(
        ROOT / "data" / "export" / "overseas_community_mentions.json",
        {"generated_at": generated_at, "market": "US", "items": mention_items},
    )

    kr_lookup = {s["ticker"]: s for s in kr_snapshot.get("stocks") or []}
    us_lookup = {s["ticker"]: s for s in us_snapshot.get("stocks") or []}

    export_analysis_for_targets(kr_items[:10], "KR", kr_lookup)
    us_targets = us_items[:15] + [m for m in mention_items[:10] if m["ticker"] not in {u["ticker"] for u in us_items[:15]}]
    export_analysis_for_targets(us_targets[:20], "US", us_lookup)

    print(f"Kiwoom exports written at {generated_at}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())