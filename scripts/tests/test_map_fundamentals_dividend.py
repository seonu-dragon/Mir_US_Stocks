"""미국 배당수익률 기준(build_map_fundamentals.trailing_dividend / merge_finnhub)."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import build_map_fundamentals as b  # noqa: E402

QUARTERLY = [["2024-10-10", 0.278], ["2025-01-10", 0.278], ["2025-04-10", 0.278], ["2025-07-10", 0.278],
             ["2025-10-10", 0.278], ["2026-01-12", 0.278], ["2026-04-10", 0.278], ["2026-07-10", 0.278]]


def test_trailing_dividend_sums_last_year():
    assert b.trailing_dividend(QUARTERLY, "2026-09-25") == round(0.278 * 4, 4)


def test_trailing_dividend_gap_is_unknown():
    # RY·ACN 처럼 분기 배당인데 1년 안 기록이 2건뿐이면 누락 — 반쪽 수익률을 만들지 않는다.
    gap = [e for e in QUARTERLY if e[0] not in ("2025-10-10", "2026-01-12")]
    assert b.trailing_dividend(gap, "2026-09-25") is None
    assert b.trailing_dividend([], "2026-09-25") is None
    assert b.trailing_dividend(QUARTERLY[:3], "2026-09-25") is None  # 1년 안 0건 → 모름


def test_special_dividend_counts_as_paid():
    special = QUARTERLY + [["2026-08-01", 1.0]]
    assert b.trailing_dividend(special, "2026-09-25") == round(0.278 * 4 + 1.0, 4)


def test_merge_finnhub_drops_legacy_indicated_yield(tmp_path, monkeypatch):
    data = tmp_path / "data"
    data.mkdir()
    (data / "us_finnhub_metrics.json").write_text(json.dumps({"metrics": {
        "T": {"divYield": 6.85, "peg": 0.77},             # 옛 연환산(오래된 가격) — 버림
        "TSLA": {"divYield": 0.0},                         # 무배당 0 은 믿는다
        "KO": {"divYield": 2.5, "divBasis": "ttm"},        # 새 TTM 기준은 채움
        "MO": {"divYield": 9.45, "divBasis": "ttm"},       # 이미 ttm 값이 있으면 건드리지 않음
    }}), encoding="utf-8")
    monkeypatch.setattr(b, "ROOT", tmp_path)
    table = {"T": {}, "TSLA": {}, "KO": {}, "MO": {"divYield": 6.23, "divSrc": "ttm"}}
    b.merge_finnhub("us", table)
    assert "divYield" not in table["T"] and table["T"]["peg"] == 0.77
    assert table["TSLA"] == {"divYield": 0.0, "divSrc": "finnhub"}
    assert table["KO"] == {"divYield": 2.5, "divSrc": "finnhub"}
    assert table["MO"] == {"divYield": 6.23, "divSrc": "ttm"}


def test_apply_trailing_uses_snapshot_price(tmp_path, monkeypatch):
    data = tmp_path / "data"
    data.mkdir()
    (data / "market_snapshot.json").write_text(json.dumps({"stocks": [{"ticker": "T", "price": 25.38}]}), encoding="utf-8")
    monkeypatch.setattr(b, "ROOT", tmp_path)
    table = {"T": {"divYield": 9.9}}
    details = {"T": {"chartSeries": [[1, 1, 1, 30.0, 1, "2026-09-25"]], "dividends": QUARTERLY}}
    b.apply_trailing_div_yield("us", table, details)
    assert table["T"] == {"divYield": 4.38, "dps": 1.112, "divSrc": "ttm"}
