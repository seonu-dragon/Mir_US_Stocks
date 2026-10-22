"""FDIC 은행 건전성(build_fdic_banks.py) 테스트 — 응답 파싱·분기 키·실패 집계(네트워크 없음)."""
import build_fdic_banks as F


def _item(repdte, **kw):
    return {"data": {"REPDTE": repdte, **kw}}


def test_quarter_key():
    assert F.quarter_key("20260630") == "2026-Q2"
    assert F.quarter_key("20251231") == "2025-Q4"
    assert F.quarter_key("2026") is None and F.quarter_key(None) is None


def test_parse_rows_sorts_and_rounds():
    payload = {"data": [_item("20260630", NIMY=2.881812, NCLNLSR=0.779, ASSET=4091315000.4, DEP=None),
                        _item("20260331", NIMY=2.9179, ROA=float("nan")), _item("bad")]}
    rows = F.parse_rows(payload)
    assert [r[0] for r in rows] == ["2026-Q1", "2026-Q2"]
    q2 = dict(zip(F.COLUMNS, rows[1]))
    assert q2["nim"] == 2.88 and q2["npl"] == 0.78 and q2["assets"] == 4091315000 and q2["deposits"] is None
    assert dict(zip(F.COLUMNS, rows[0]))["roa"] is None


def test_build_collects_failures(monkeypatch):
    monkeypatch.setattr(F, "BANKS", {"JPM": 628, "BAD": 1, "NONE": 2})

    def fetch(cert):
        if cert == 1:
            raise RuntimeError("boom")
        return [] if cert == 2 else [["2026-Q2", 2.9] + [None] * 8]

    p = F.build(fetch=fetch, sleep_s=0)
    assert p["count"] == 1 and p["latestQuarter"] == "2026-Q2" and set(p["banks"]) == {"JPM"}
    assert len(p["failed"]) == 2


def test_bank_list_matches_frontend():
    import re
    from pathlib import Path
    js = (Path(F.ROOT) / "fdic-banks-core.js").read_text(encoding="utf-8")
    listed = set(re.findall(r'"([A-Z]+)"', js.split("BANK_TICKERS = new Set([", 1)[1].split("])", 1)[0]))
    assert listed == set(F.BANKS)
