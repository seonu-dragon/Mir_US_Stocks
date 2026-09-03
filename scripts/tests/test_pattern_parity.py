"""JS↔PY 패턴 감지 패리티를 pytest 안에서도 돌린다.

`check_pattern_parity.py` 는 시드 고정 합성 픽스처만 쓰므로 완전히 오프라인이다.
node 를 못 찾는 환경(도구 없는 러너)에서는 skip 하고, 있으면 실제로 비교한다.
CI(ubuntu)에는 setup-node 로 node 가 항상 있으므로 거기서는 반드시 돈다.
"""
from __future__ import annotations

import sys

import pytest

import check_pattern_parity as P
import pattern_lib as pl


def _node():
    try:
        return P.find_node(None)
    except SystemExit:
        return None
    except Exception:
        return None


def test_fixtures_are_deterministic():
    """시드 고정 픽스처가 실행마다 같아야 비교가 의미를 갖는다(Math.random 금지)."""
    first = P.make_fixtures()
    second = P.make_fixtures()
    assert first == second


def test_python_detector_runs_on_the_fixtures():
    """node 가 없어도 파이썬 쪽 감지기는 항상 검사한다."""
    for name, series in P.make_fixtures().items():
        rows = pl.rows_from_chart_series(series)
        assert rows, name
        events = pl.detect_confirmations(rows)
        assert isinstance(events, list), name


def test_js_python_parity(monkeypatch):
    node = _node()
    if not node:
        pytest.skip("node 없음 — 패리티 비교 생략(CI 에서는 setup-node 로 항상 존재)")
    monkeypatch.setattr(sys, "argv", ["check_pattern_parity.py", "--node", str(node)])
    assert P.main() == 0, "JS 와 PY 패턴 감지 결과가 갈렸다"
