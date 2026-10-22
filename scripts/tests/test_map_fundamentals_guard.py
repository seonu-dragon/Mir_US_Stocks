"""build_map_fundamentals 0건·반토막 방어(2026-09-15 감사 P1) — 원천이 죽은 날 직전 파일을 덮지 않는다."""
import json

import pytest

import build_map_fundamentals as M


def _cfg(tmp_path, prev_rows):
    out_json = tmp_path / "map_fundamentals.json"
    out_js = tmp_path / "map_fundamentals.js"
    details = tmp_path / "details"
    details.mkdir()
    if prev_rows is not None:
        out_json.write_text(json.dumps({f"T{i}": {"pe": 10} for i in range(prev_rows)}), encoding="utf-8")
    return {"details": details, "out_js": out_js, "out_json": out_json, "global": "MAP_FUNDAMENTALS",
            "ticker_key": lambda t: str(t).upper()}


def test_empty_details_keep_previous_file(tmp_path, monkeypatch):
    cfg = _cfg(tmp_path, 100)
    monkeypatch.setitem(M.MARKET_PATHS, "us", cfg)
    monkeypatch.setattr(M, "merge_finnhub", lambda market, table: None)
    before = cfg["out_json"].read_text(encoding="utf-8")
    with pytest.raises(RuntimeError, match="절반 미만"):
        M.build_market("us")
    assert cfg["out_json"].read_text(encoding="utf-8") == before
    assert not cfg["out_js"].exists()
