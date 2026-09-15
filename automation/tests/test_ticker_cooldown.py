"""Tests for ticker repost cooldown."""

from __future__ import annotations

import json
import sys
from pathlib import Path

AUTOMATION_DIR = Path(__file__).resolve().parents[1]
ROOT = AUTOMATION_DIR.parent
if str(AUTOMATION_DIR) not in sys.path:
    sys.path.insert(0, str(AUTOMATION_DIR))

from ticker_cooldown import get_cooldown_tickers, record_posted  # noqa: E402


def _install_paths(monkeypatch, tmp_path):
    """posts 폴더(레거시 읽기 전용) + 추적 원장 경로를 테스트용으로 바꾼다."""
    import utils
    import ticker_cooldown

    posts_dir = tmp_path / "posts"
    posts_dir.mkdir(exist_ok=True)
    ledger = tmp_path / "data" / "kiwoom_cooldown.json"
    monkeypatch.setattr(utils, "PROJECT_ROOT", tmp_path)
    monkeypatch.setattr(
        ticker_cooldown,
        "paths",
        lambda: {"posts": posts_dir, "cooldown_ledger": ledger},
    )
    return posts_dir, ledger


def test_cooldown_blocks_within_seven_days(tmp_path, monkeypatch):
    posts_dir, _ = _install_paths(monkeypatch, tmp_path)
    payload = {
        "batch": "domestic_morning",
        "date": "2026-07-02",
        "results": [{"ticker": "NVDA"}, {"ticker": "041830"}],
    }
    (posts_dir / "2026-07-02_domestic_morning.json").write_text(
        json.dumps(payload, ensure_ascii=False),
        encoding="utf-8",
    )

    blocked = get_cooldown_tickers("2026-07-08", days=7)
    assert blocked == {"NVDA", "041830"}

    allowed = get_cooldown_tickers("2026-07-09", days=7)
    assert allowed == set()


def test_cooldown_reads_the_tracked_ledger(tmp_path, monkeypatch):
    """원장이 outputs/(gitignore) 밖 추적 경로에 있어야 다른 머신에서도 쿨다운이 산다."""
    _, ledger = _install_paths(monkeypatch, tmp_path)
    ledger.parent.mkdir(parents=True, exist_ok=True)
    ledger.write_text(
        json.dumps({"tickers": {"005930": "2026-07-02"}}, ensure_ascii=False), encoding="utf-8"
    )
    assert get_cooldown_tickers("2026-07-04", days=3) == {"005930"}
    assert get_cooldown_tickers("2026-07-05", days=3) == set()


def test_record_posted_writes_and_prunes(tmp_path, monkeypatch):
    _, ledger = _install_paths(monkeypatch, tmp_path)
    record_posted(["005930", "NVDA"], "2026-07-02")
    record_posted(["005930"], "2026-07-05")
    book = json.loads(ledger.read_text(encoding="utf-8"))["tickers"]
    assert book["005930"] == "2026-07-05"   # 최신 날짜만 남는다
    assert book["NVDA"] == "2026-07-02"
    # 1년 넘게 지난 기록은 버린다.
    record_posted(["AAPL"], "2027-08-01")
    book = json.loads(ledger.read_text(encoding="utf-8"))["tickers"]
    assert "NVDA" not in book
    assert book["AAPL"] == "2027-08-01"


def test_ledger_and_legacy_runs_merge(tmp_path, monkeypatch):
    posts_dir, ledger = _install_paths(monkeypatch, tmp_path)
    (posts_dir / "2026-07-02_daily.json").write_text(
        json.dumps({"date": "2026-07-02", "results": [{"ticker": "NVDA"}]}), encoding="utf-8"
    )
    ledger.parent.mkdir(parents=True, exist_ok=True)
    ledger.write_text(json.dumps({"tickers": {"005930": "2026-07-03"}}), encoding="utf-8")
    assert get_cooldown_tickers("2026-07-04", days=3) == {"NVDA", "005930"}