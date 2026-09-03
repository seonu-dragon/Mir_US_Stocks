"""증분 병합 규약: 이번 실행이 적게 받아도 **발행된 파일이 줄어들지 않는다**.

429·타임아웃으로 몇 종목을 놓친 실행이 기존 결과를 통째로 날리면, 사이트에서
종목이 실행마다 나타났다 사라진다. 공유 헬퍼 두 개가 이 규약을 담당한다:

- `sec_client.merge_previous_stocks` — 티커→레코드 dict 의 prev-merge.
- `update_data.merge_history_rows` / `history_overlap_ok` / `fetch_history_smart`
  — 일봉 증분 수집(캐시 + 최근 1y)과 분할 가드.
"""
from __future__ import annotations

import json

import pytest

import sec_client as sec
import update_data as UD


# --------------------------------------------------------------------------
# merge_previous_stocks
# --------------------------------------------------------------------------

def _write_prev(tmp_path, stocks, key="stocks"):
    path = tmp_path / "metrics.json"
    path.write_text(json.dumps({key: stocks}, ensure_ascii=False), encoding="utf-8")
    return path


def test_missing_tickers_keep_previous_values(tmp_path):
    prev = _write_prev(tmp_path, {"AAPL": {"pe": 30}, "MSFT": {"pe": 35}, "NVDA": {"pe": 60}})
    payload = {"stocks": {"AAPL": {"pe": 31}}}
    merged = sec.merge_previous_stocks(payload, prev, "test")
    assert merged["stocks"]["AAPL"] == {"pe": 31}      # 오늘 받은 건 갱신
    assert merged["stocks"]["MSFT"] == {"pe": 35}      # 못 받은 건 유지
    assert len(merged["stocks"]) == 3                  # 줄어들지 않는다


def test_result_never_shrinks_below_previous(tmp_path):
    prev = _write_prev(tmp_path, {f"T{i}": {"v": i} for i in range(50)})
    merged = sec.merge_previous_stocks({"stocks": {}}, prev, "test")
    assert len(merged["stocks"]) == 50


def test_no_previous_file_is_a_noop(tmp_path):
    payload = {"stocks": {"AAPL": {"pe": 30}}}
    merged = sec.merge_previous_stocks(payload, tmp_path / "nope.json", "test")
    assert merged == payload


def test_corrupt_previous_file_does_not_lose_todays_rows(tmp_path):
    path = tmp_path / "metrics.json"
    path.write_text("{ 깨진 json", encoding="utf-8")
    payload = {"stocks": {"AAPL": {"pe": 30}}}
    merged = sec.merge_previous_stocks(payload, path, "test")
    assert merged["stocks"]["AAPL"] == {"pe": 30}


def test_custom_key_is_respected(tmp_path):
    prev = _write_prev(tmp_path, {"AAPL": {"x": 1}}, key="rows")
    merged = sec.merge_previous_stocks({"rows": {}}, prev, "test", key="rows")
    assert merged["rows"] == {"AAPL": {"x": 1}}


# --------------------------------------------------------------------------
# 일봉 증분 병합
# --------------------------------------------------------------------------

def _rows(start_day: int, count: int, close: float = 100.0):
    return [
        {
            "date": f"2026-01-{start_day + i:02d}",
            "open": close, "high": close, "low": close, "close": close, "volume": 1000,
        }
        for i in range(count)
    ]


def test_merge_history_rows_has_no_duplicate_dates():
    cached = _rows(1, 10, close=100.0)
    fresh = _rows(8, 5, close=200.0)
    merged = UD.merge_history_rows(cached, fresh)
    dates = [row["date"] for row in merged]
    assert dates == sorted(dates)
    assert len(dates) == len(set(dates))
    # 겹치는 구간은 fresh 가 이긴다(오늘 실측이 정답).
    assert merged[-1]["close"] == 200.0


def test_merge_history_rows_does_not_shrink_the_series():
    cached = _rows(1, 20)
    fresh = _rows(18, 3)
    merged = UD.merge_history_rows(cached, fresh)
    assert len(merged) >= len(cached)


def test_overlap_mismatch_is_detected_as_split():
    cached = _rows(1, 10, close=100.0)
    fresh = [dict(row, close=50.0) for row in _rows(6, 5)]   # 2:1 분할 소급조정
    assert UD.history_overlap_ok(cached, fresh) is False


def test_overlap_within_tolerance_is_accepted():
    cached = _rows(1, 10, close=100.0)
    fresh = [dict(row, close=100.2) for row in _rows(6, 5)]  # 0.2% < 0.5% 허용치
    assert UD.history_overlap_ok(cached, fresh) is True


def test_fetch_history_smart_merges_instead_of_refetching_everything():
    """캐시가 신선하면 1y 만 받아 병합한다(전체 재수집 아님)."""
    # 캐시는 750봉 이상·마지막 봉이 7일 이내여야 증분 경로를 탄다.
    from datetime import date, timedelta

    today = date(2026, 1, 30)
    long_cache = [
        {
            "date": (today - timedelta(days=800 - i)).isoformat(),
            "open": 100, "high": 100, "low": 100, "close": 100, "volume": 10,
        }
        for i in range(800)
    ]
    fresh = [
        dict(row) for row in long_cache[-30:]
    ] + [{
        "date": (today + timedelta(days=1)).isoformat(),
        "open": 100, "high": 100, "low": 100, "close": 100, "volume": 10,
    }]

    calls = []

    def fetch_fn(range_):
        calls.append(range_)
        return fresh, []

    rows, divs, mode = UD.fetch_history_smart(
        "TESTSYM", fetch_fn, lambda: (long_cache, []), today=today,
    )
    if mode == "full":            # 결정론적 1/30 롤링 전체갱신에 걸린 날
        assert calls == ["5y"]
        return
    assert mode == "incremental"
    assert calls == [UD.INCREMENTAL_RANGE]
    assert len(rows) >= len(long_cache)


def test_fetch_history_smart_falls_back_to_full_when_cache_is_short():
    calls = []

    def fetch_fn(range_):
        calls.append(range_)
        return _rows(1, 5), []

    rows, divs, mode = UD.fetch_history_smart(
        "SHORTCACHE", fetch_fn, lambda: (_rows(1, 10), []),
    )
    assert mode in {"full", "full-mismatch"}
    assert calls[-1] == "5y"


def test_merge_dividend_events_keeps_the_five_year_union():
    cached = [["2022-05-01", 0.2], ["2023-05-01", 0.3]]
    fresh = [["2023-05-01", 0.31], ["2026-05-01", 0.4]]
    merged = UD.merge_dividend_events(cached, fresh)
    assert merged == [["2022-05-01", 0.2], ["2023-05-01", 0.31], ["2026-05-01", 0.4]]
