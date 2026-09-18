"""check_kr_index_parity.compare — 미국 모드(워커)와 국내 모드(스냅샷) KR 지수 정합성."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from check_kr_index_parity import compare  # noqa: E402

SNAP = [
    {"symbol": "^KS11", "price": 6627.26, "changePct": -0.85, "tradedAt": "2026-09-15T16:10:00+09:00"},
    {"symbol": "^KQ11", "price": 812.41, "changePct": 0.7, "tradedAt": "2026-09-15T16:10:00+09:00"},
]


def _live(date="2026-09-15", status="CLOSE"):
    session = {"tradedAt": f"{date}T16:10:00+09:00", "marketStatus": status}
    return {"^KS11": session, "^KQ11": session}


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
    ok, msgs = compare(_worker(0.7), SNAP, _live())
    assert ok
    assert sum(m.startswith("[ok]") for m in msgs) == 2


def test_2026_09_15_live_mismatch_fails_once_worker_is_naver_primary():
    # 재감사 실측: 같은 812.41 에 워커 −1.00% vs 스냅샷 +0.70%
    ok, msgs = compare(_worker(-1.0, source="meta"), SNAP, _live())
    assert not ok
    assert any(m.startswith("[FAIL]") and "^KQ11" in m for m in msgs)


def test_gap_just_under_limit_passes_and_at_limit_fails():
    assert compare(_worker(0.89), SNAP, _live())[0]
    assert not compare(_worker(0.9), SNAP, _live())[0]


def test_old_worker_without_policy_only_warns():
    ok, msgs = compare(_worker(-1.0, policy=None, source="meta"), SNAP, _live())
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


def test_2026_09_17_next_day_with_tiny_move_is_not_same_session():
    # 18:40 KST: 스냅샷은 아직 09-16(6,717.97 +1.37%), 워커는 09-17 마감(−0.04%).
    # 가격이 0.05% 안이라 예전엔 같은 세션으로 오판해 배포를 멈췄다.
    snap = [{"symbol": "^KS11", "price": 6717.97, "changePct": 1.37, "tradedAt": "2026-09-16T16:10:00+09:00"}]
    worker = [{"symbol": "^KS11", "price": 6715.41, "changePct": -0.04,
               "changePctSource": "naver", "changePctPolicy": "naver-primary"}]
    ok, msgs = compare(worker, snap, _live("2026-09-17"))
    assert ok
    assert any(m.startswith("[skip]") and "다른 거래일" in m for m in msgs)


def test_2026_09_17_preopen_reset_is_skipped():
    # 08:43 KST: 네이버가 새 거래일 기준 0.00% 로 리셋, 가격은 전일 종가 그대로.
    snap = [{"symbol": "^KQ11", "price": 822.18, "changePct": 0.76, "tradedAt": "2026-09-17T16:10:00+09:00"}]
    worker = [{"symbol": "^KQ11", "price": 822.18, "changePct": 0.0,
               "changePctSource": "naver", "changePctPolicy": "naver-primary"}]
    for live in (_live("2026-09-18", "PREOPEN"), _live("2026-09-18", "CLOSE"), _live("2026-09-18", "OPEN")):
        ok, msgs = compare(worker, snap, live)
        assert ok, msgs
        assert any(m.startswith("[skip]") for m in msgs)


def test_unconfirmed_session_only_warns():
    # 옛 스냅샷(tradedAt 없음)이나 네이버 호출 실패면 세션을 확인 못 한다 → 경고만.
    snap_old = [{k: v for k, v in r.items() if k != "tradedAt"} for r in SNAP]
    for snap, live in ((snap_old, _live()), (SNAP, None)):
        ok, msgs = compare(_worker(-1.0), snap, live)
        assert ok
        assert any(m.startswith("[warn]") and "확인 못 함" in m for m in msgs)
