"""check_kr_index_parity.compare — 미국 모드(워커)와 국내 모드(스냅샷) KR 지수 정합성."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from check_kr_index_parity import compare  # noqa: E402

SNAP = [
    {"symbol": "^KS11", "price": 6627.26, "changePct": -0.85},
    {"symbol": "^KQ11", "price": 812.41, "changePct": 0.7},
]


def _worker(kq_change, policy="naver-primary", kq_price=812.41, source="naver"):
    rows = [
        {"symbol": "^KS11", "price": 6627.26, "changePct": -0.85, "changePctSource": source},
        {"symbol": "^KQ11", "price": kq_price, "changePct": kq_change, "changePctSource": source},
    ]
    if policy:
        for r in rows:
            r["changePctPolicy"] = policy
    return rows


def test_same_session_same_change_passes():
    ok, msgs = compare(_worker(0.7), SNAP)
    assert ok
    assert sum(m.startswith("[ok]") for m in msgs) == 2


def test_2026_09_15_live_mismatch_fails_once_worker_is_naver_primary():
    # 재감사 실측: 같은 812.41 에 워커 −1.00% vs 스냅샷 +0.70%
    ok, msgs = compare(_worker(-1.0, source="meta"), SNAP)
    assert not ok
    assert any(m.startswith("[FAIL]") and "^KQ11" in m for m in msgs)


def test_gap_just_under_limit_passes_and_at_limit_fails():
    assert compare(_worker(0.89), SNAP)[0]
    assert not compare(_worker(0.9), SNAP)[0]


def test_old_worker_without_policy_only_warns():
    ok, msgs = compare(_worker(-1.0, policy=None, source="meta"), SNAP)
    assert ok
    assert any(m.startswith("[warn]") for m in msgs)


def test_different_session_is_skipped():
    # 장중 워커(815.98, +0.44%) vs 전일 15:42 스냅샷(812.41, +0.70%) — 비교 대상 아님
    ok, msgs = compare(_worker(0.44, kq_price=815.98), SNAP)
    assert ok
    assert any(m.startswith("[skip]") and "다른 세션" in m for m in msgs)


def test_null_snapshot_values_are_skipped_not_zeroed():
    snap = [{"symbol": "^KS11", "price": None, "changePct": None}, SNAP[1]]
    ok, msgs = compare(_worker(0.7), snap)
    assert ok
    assert any("값 결측" in m for m in msgs)
