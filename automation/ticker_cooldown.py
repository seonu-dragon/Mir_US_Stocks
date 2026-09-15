"""Ticker repost cooldown — same symbol blocked for 3 days after last post.

예: 월요일에 다룬 종목은 화·수는 제외되고, 가장 빨라도 목요일에 다시 등장한다.

원장은 `data/kiwoom_cooldown.json`(추적되는 경로)이다. 예전에는
`outputs/posts/*.json` 만 읽었는데 `outputs/` 가 .gitignore 라 다른 머신·새 클론에서는
원장이 늘 비어 쿨다운이 무효였다(2026-09-15 감사). 기존 로컬 기록을 버리지 않으려고
outputs/posts 도 계속 **읽기만** 한다.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from utils import PROJECT_ROOT, now_kst, today_kst, paths

COOLDOWN_DAYS = 3
# 과거 배치별 파일(_domestic_morning/_overseas_afternoon)과 새 일일 파일(_daily)을 모두 읽는다.
_BATCH_GLOBS = ("*.json",)

_DEFAULT_LEDGER = PROJECT_ROOT / "data" / "kiwoom_cooldown.json"


def ledger_path() -> Path:
    """원장 경로. paths() 가 키를 안 주면(테스트 스텁 등) 기본 경로."""
    return Path(paths().get("cooldown_ledger") or _DEFAULT_LEDGER)


def _parse_date(value: str):
    try:
        return datetime.strptime(value[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def _read_ledger() -> dict[str, str]:
    path = ledger_path()
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    tickers = payload.get("tickers")
    return {str(k): str(v) for k, v in tickers.items()} if isinstance(tickers, dict) else {}


def _read_legacy_runs() -> dict[str, str]:
    """gitignore 된 outputs/posts 의 과거 실행 기록(읽기 전용 폴백)."""
    latest: dict[str, str] = {}
    posts_dir = paths().get("posts")
    if not posts_dir or not Path(posts_dir).exists():
        return latest
    for pattern in _BATCH_GLOBS:
        for path in Path(posts_dir).glob(pattern):
            try:
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


def load_ticker_last_posted() -> dict[str, str]:
    """Return {ticker: latest_post_date} — 추적 원장 + 로컬 과거 기록 합집합."""
    latest = _read_legacy_runs()
    for ticker, date_str in _read_ledger().items():
        prev = latest.get(ticker)
        if not prev or date_str > prev:
            latest[ticker] = date_str
    return latest


def record_posted(tickers, date_str: str | None = None) -> Path:
    """발행한 종목을 원장에 기록한다(같은 종목은 최신 날짜만 남는다)."""
    day = date_str or today_kst()
    book = _read_ledger()
    for ticker in tickers:
        key = str(ticker or "").strip()
        if not key:
            continue
        if book.get(key, "") < day:
            book[key] = day
    # 원장이 무한히 자라지 않게 1년 이전 기록은 버린다.
    cutoff = (_parse_date(day) or datetime.now().date())
    book = {
        k: v for k, v in book.items()
        if (_parse_date(v) is None) or ((cutoff - _parse_date(v)).days <= 365)
    }
    path = ledger_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            {"updatedAtKst": now_kst().strftime("%Y-%m-%d %H:%M KST"),
             "note": "키움 커뮤니티 글 발행 이력(종목 → 최근 발행일). 3일 재등장 금지용.",
             "count": len(book),
             "tickers": dict(sorted(book.items()))},
            ensure_ascii=False, indent=2,
        ) + "\n",
        encoding="utf-8",
    )
    return path


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
