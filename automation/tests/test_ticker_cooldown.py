"""Tests for ticker repost cooldown."""

from __future__ import annotations

import json
import sys
from pathlib import Path

AUTOMATION_DIR = Path(__file__).resolve().parents[1]
ROOT = AUTOMATION_DIR.parent
if str(AUTOMATION_DIR) not in sys.path:
    sys.path.insert(0, str(AUTOMATION_DIR))

from ticker_cooldown import get_cooldown_tickers  # noqa: E402


def test_cooldown_blocks_within_seven_days(tmp_path, monkeypatch):
    posts_dir = tmp_path / "posts"
    posts_dir.mkdir()
    payload = {
        "batch": "domestic_morning",
        "date": "2026-07-02",
        "results": [{"ticker": "NVDA"}, {"ticker": "041830"}],
    }
    (posts_dir / "2026-07-02_domestic_morning.json").write_text(
        json.dumps(payload, ensure_ascii=False),
        encoding="utf-8",
    )

    import utils
    import ticker_cooldown

    monkeypatch.setattr(utils, "PROJECT_ROOT", tmp_path)
    monkeypatch.setattr(
        ticker_cooldown,
        "paths",
        lambda: {
            "posts": posts_dir,
        },
    )

    blocked = get_cooldown_tickers("2026-07-08", days=7)
    assert blocked == {"NVDA", "041830"}

    allowed = get_cooldown_tickers("2026-07-09", days=7)
    assert allowed == set()