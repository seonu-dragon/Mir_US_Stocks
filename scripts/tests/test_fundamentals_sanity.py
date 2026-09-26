"""펀더멘털 이상치 규칙(scripts/fundamentals_sanity.py) + 빌더 적용 + 야후 단위 수정 테스트.

사례 파일(fixtures/fundamentals_sanity_cases.json)은 JS 쪽(test_fundamentals_sanity_core.mjs)과 공유하고,
경계 표·규칙 목록이 fundamentals-sanity-core.js 와 같은지도 여기서 검사한다.
"""
from __future__ import annotations

import json
import re
import sys
import types
from pathlib import Path

import pytest

import fundamentals_sanity as S

ROOT = Path(__file__).resolve().parents[2]
CASES = json.loads((Path(__file__).parent / "fixtures" / "fundamentals_sanity_cases.json").read_text(encoding="utf-8"))
JS = (ROOT / "fundamentals-sanity-core.js").read_text(encoding="utf-8")


@pytest.mark.parametrize("case", CASES["sanitize"], ids=lambda c: c["name"])
def test_sanitize_cases(case):
    row = dict(case["row"])
    dropped = S.sanitize_row(row, case.get("ctx"))
    assert row == case["want"]
    assert sorted(dropped) == sorted(case["dropped"])


@pytest.mark.parametrize("case", CASES["outlier"], ids=lambda c: f"{c['key']}={c['v']}")
def test_outlier_cases(case):
    assert S.is_outlier(case["key"], case["v"]) is case["want"]
    assert S.winsor(case["key"], case["v"]) == pytest.approx(case["winsor"])


def test_infinite_and_nan_dropped():
    row = {"pe": float("inf"), "eps": float("nan"), "roe": 5}
    assert sorted(S.sanitize_row(row)) == ["eps", "pe"]
    assert row == {"roe": 5}


def _js_const(name):
    m = re.search(rf"const {name} = (\[[^\]]*\]|\{{[^}}]*\}});", JS)
    assert m, name
    return json.loads(m.group(1).replace("'", '"').replace("roa:", '"roa":').replace("eps:", '"eps":'))


def test_js_rules_match_python():
    block = JS.split("// PLAUSIBLE-BEGIN")[1].split("// PLAUSIBLE-END")[0]
    js_plausible = json.loads(block.split("=", 1)[1].strip().rstrip(";"))
    assert js_plausible == S.PLAUSIBLE
    assert _js_const("POSITIVE_ONLY") == list(S.POSITIVE_ONLY)
    assert _js_const("NON_NEGATIVE") == list(S.NON_NEGATIVE)
    assert _js_const("HARD_ABS_LIMIT") == S.HARD_ABS_LIMIT
    assert _js_const("SENTINELS") == S.SENTINELS


def test_build_map_fundamentals_applies_rules(tmp_path, monkeypatch):
    import build_map_fundamentals as B

    details = tmp_path / "details"
    details.mkdir()
    rows = {
        "SNDA": {"roe": 643445.45, "equityB": -0.0, "salesB": 0.381, "incomeB": -0.071, "assetsB": 0.845},
        "CAES": {"pe": float("inf"), "epsTtm": 0.0},
        "LYEL": {"profitMargin": -762355.56, "salesB": 0.0, "roe": -110.57, "equityB": 0.248},
        "CL": {"roe": 3948.15, "equityB": 0.054, "pb": 1270.46, "pe": 22.53},
    }
    for t, f in rows.items():
        (details / f"{t}.json").write_text(json.dumps({"ticker": t, "fundamentals": f}), encoding="utf-8")
    out_json = tmp_path / "mf.json"
    monkeypatch.setitem(B.MARKET_PATHS, "us", {**B.MARKET_PATHS["us"], "details": details,
                                               "out_json": out_json, "out_js": tmp_path / "mf.js"})
    monkeypatch.setattr(B, "ROOT", tmp_path)  # finnhub 보강 파일 없음
    B.build_market("us")
    text = out_json.read_text(encoding="utf-8")
    assert "Infinity" not in text and "NaN" not in text
    table = json.loads(text)
    assert "roe" not in table["SNDA"]          # 자본 ≤ 0
    assert "CAES" not in table or "pe" not in table["CAES"]
    assert "netMargin" not in table["LYEL"] and table["LYEL"]["roe"] == -110.57
    assert table["CL"]["roe"] == 3948.15       # 실제일 수 있는 극단값은 남긴다


class _FakeTicker:
    def __init__(self, info):
        self.info = info


def _yahoo(monkeypatch, info):
    import update_data as U
    monkeypatch.setitem(sys.modules, "yfinance", types.SimpleNamespace(Ticker=lambda s: _FakeTicker(info)))
    return U.fetch_yahoo_fundamentals("TEST", price_hint=info.get("regularMarketPrice"))


def test_yahoo_dividend_yield_not_multiplied(monkeypatch):
    # 2026-09-26 실측 HIFS: dividendYield 0.85 는 이미 %. 예전 코드는 85% 로 만들었다.
    out = _yahoo(monkeypatch, {"dividendYield": 0.85, "dividendRate": 2.52, "regularMarketPrice": 299.18})
    assert out["divYield"] == pytest.approx(0.84, abs=0.01)
    out = _yahoo(monkeypatch, {"dividendYield": 0.32, "regularMarketPrice": 341.07})
    assert out["divYield"] == 0.32


def test_yahoo_roe_always_fraction_and_current_ratio_percent(monkeypatch):
    out = _yahoo(monkeypatch, {"returnOnEquity": 1.6, "profitMargins": -5.0, "currentRatio": 1.003,
                               "trailingPE": "Infinity", "regularMarketPrice": 10})
    assert out["roe"] == 160.0
    assert out["profitMargin"] == -500.0
    assert out["currentRatio"] == pytest.approx(100.3)
    assert "pe" not in out or out["pe"] != float("inf")
