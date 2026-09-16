"""build_federal_contracts 마감시간 — 느린 USASpending 이 잡 전체를 잡아먹지 않게(2026-09-16)."""
from __future__ import annotations

import build_federal_contracts as fc


def test_deadline_stops_and_keeps_existing_file_when_coverage_low(monkeypatch):
    calls = []
    monkeypatch.setattr(fc.time, "sleep", lambda s: None)

    def slow_fetch(name, start, end):
        calls.append(name)
        return {"count": 1, "total": 100, "top": 100, "approx": False}

    ticks = iter(range(0, 10_000, 400))  # 호출마다 400초 경과
    monkeypatch.setattr(fc.time, "monotonic", lambda: next(ticks))
    monkeypatch.setattr(fc, "fetch", slow_fetch)
    assert fc.build(deadline_s=900) is None, "80% 미만 부분 수집으로 덮으면 안 된다"
    assert len(calls) < len(fc.CONTRACTORS)


def test_full_collection_within_deadline_writes(monkeypatch):
    monkeypatch.setattr(fc.time, "sleep", lambda s: None)
    monkeypatch.setattr(fc, "fetch", lambda *a: {"count": 1, "total": 100, "top": 100, "approx": False})
    payload = fc.build(deadline_s=900)
    assert payload and len(payload["stocks"]) == len(fc.CONTRACTORS)
