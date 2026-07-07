"""종목별 '투자에 도움이 되는' 부가 정보를 웹사이트 데이터에서 모은다.

market_snapshot(등락률·상대강도·거래량 등) + map_fundamentals(PER·PBR·ROE·마진 등)
+ 카탈리스트(실적/공시/내부자/공매도 등)를 종목 코드로 join 한다.
글 생성 프롬프트가 이 중 '몇 가지만 골라' 자연스럽게 녹이도록 재료를 제공한다.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _load(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {}


@lru_cache(maxsize=4)
def _snapshot_map(market: str) -> dict[str, dict]:
    rel = "data/korea/market_snapshot.json" if market == "KR" else "data/market_snapshot.json"
    data = _load(ROOT / rel)
    return {str(s.get("ticker", "")): s for s in (data.get("stocks") or [])}


@lru_cache(maxsize=4)
def _fundamentals_map(market: str) -> dict[str, dict]:
    rel = "data/korea/map_fundamentals.json" if market == "KR" else "data/map_fundamentals.json"
    return _load(ROOT / rel)


def _round(value: object, digits: int = 1) -> float | None:
    if isinstance(value, (int, float)):
        return round(float(value), digits)
    return None


def _compact(d: dict) -> dict:
    """None/빈 값 제거로 토큰을 아낀다."""
    out = {}
    for k, v in d.items():
        if v in (None, "", [], {}):
            continue
        if isinstance(v, dict):
            v = _compact(v)
            if not v:
                continue
        out[k] = v
    return out


def build_stock_context(
    ticker: str,
    market: str,
    issue_tags: list[str] | None = None,
) -> dict:
    """종목별 부가 컨텍스트(펀더멘털·수급·상대강도·카탈리스트)를 compact dict 로 반환."""
    stock = _snapshot_map(market).get(str(ticker), {})
    fund = _fundamentals_map(market).get(str(ticker), {})

    cap = stock.get("marketCapT") if market == "KR" else stock.get("marketCapB")
    cap_label = None
    if isinstance(cap, (int, float)):
        cap_label = f"{cap:.1f}조원" if market == "KR" else f"${cap:.1f}B"

    ctx = {
        "sector": stock.get("sector"),
        "industry": stock.get("industry"),
        "market_cap": cap_label,
        "returns_pct": _compact(
            {
                "day": _round(stock.get("changePct")),
                "week": _round(stock.get("weekChangePct")),
                "month": _round(stock.get("monthChangePct")),
                "ytd": _round(stock.get("ytdChangePct")),
            }
        ),
        # rsScore: 시장 대비 상대강도(0~100), epsRevScore: 실적 추정치 상향 강도(0~100)
        "relative_strength": _round(stock.get("rsScore"), 0),
        "eps_revision_score": _round(stock.get("epsRevScore"), 0),
        "rsi14": _round(stock.get("rsi14"), 0),
        "volume_ratio": _round(stock.get("volumeRatio"), 2),
        "near_52w_high_pct": _round(stock.get("newHighDistancePct")),
        "valuation": _compact(
            {
                "per": _round(fund.get("pe")),
                "forward_per": _round(fund.get("forwardPE")),
                "pbr": _round(fund.get("pb")),
                "psr": _round(fund.get("ps")),
                "roe_pct": _round(fund.get("roe")),
                "net_margin_pct": _round(fund.get("netMargin")),
                "div_yield_pct": _round(fund.get("divYield")),
                "ev_ebitda": _round(fund.get("evEbitda")),
            }
        ),
        "range_52w": _compact({"low": _round(fund.get("low52"), 2), "high": _round(fund.get("high52"), 2)}),
        "catalysts": list(issue_tags or []),
    }
    return _compact(ctx)
