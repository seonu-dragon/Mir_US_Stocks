"""Ticker repost cooldown — same symbol blocked for 7 days after last post."""

from __future__ import annotations

from datetime import datetime

from utils import paths, today_kst

COOLDOWN_DAYS = 7
_BATCH_GLOBS = ("*_domestic_morning.json", "*_overseas_afternoon.json")


def _parse_date(value: str):
    try:
        return datetime.strptime(value[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def load_ticker_last_posted() -> dict[str, str]:
    """Return {ticker: latest_post_date} from saved pipeline run files."""
    latest: dict[str, str] = {}
    posts_dir = paths()["posts"]
    for pattern in _BATCH_GLOBS:
        for path in posts_dir.glob(pattern):
            try:
                import json

                payload = json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                continue
            run_date = str(payload.get("date") or path.stem.split("_")[0])
            for item in payload.get("results") or []:
                ticker = str(item.get("ticker") or "").strip()
                if not ticker:
                    continue
                prev = latest.get(ticker)
                if not prev or run_date > prev:
                    latest[ticker] = run_date
    return latest


def get_cooldown_tickers(as_of: str | None = None, days: int = COOLDOWN_DAYS) -> set[str]:
    """Tickers posted within the last `days` days (exclusive of day `days`)."""
    as_of_date = _parse_date(as_of or today_kst())
    if not as_of_date:
        return set()

    blocked: set[str] = set()
    for ticker, posted_on in load_ticker_last_posted().items():
        posted_date = _parse_date(posted_on)
        if not posted_date:
            continue
        if (as_of_date - posted_date).days < days:
            blocked.add(ticker)
    return blocked