"""국내 공매도 거래비중 이력 병합(kr_short_volume_history) + 빌더 연결 테스트. 네트워크 없음."""
from __future__ import annotations

import datetime as dt
import json

import pandas as pd
import pytest

import kr_short_volume_history as KH


def hist(dates, series):
    return {"dates": dates, "series": series}


def test_merge_appends_new_day_and_keeps_old():
    prev = hist(["2026-10-15", "2026-10-16"], {"A": [1.0, 2.0], "B": [None, 3.0]})
    out = KH.merge_history(prev, {"2026-10-19": {"A": 4.0, "B": 0.0}}, ["A", "B"])
    assert out["dates"] == ["2026-10-15", "2026-10-16", "2026-10-19"]
    assert out["series"]["A"] == [1.0, 2.0, 4.0]
    assert out["series"]["B"] == [None, 3.0, 0.0]   # 0% 는 실제 값, 모르는 날은 null 그대로


def test_merge_dedupes_same_date_new_value_wins():
    prev = hist(["2026-10-16"], {"A": [2.0], "B": [5.0]})
    out = KH.merge_history(prev, {"2026-10-16": {"A": 2.5}}, ["A", "B"])
    assert out["dates"] == ["2026-10-16"]
    assert out["series"]["A"] == [2.5]
    assert out["series"]["B"] == [5.0]   # 새 값이 없는 종목은 이전 값 유지


def test_merge_caps_length_oldest_dropped():
    dates = [f"2026-09-{d:02d}" for d in range(1, 26)]
    prev = hist(dates, {"A": [float(i) for i in range(25)]})
    out = KH.merge_history(prev, {"2026-10-01": {"A": 99.0}}, ["A"], max_days=20)
    assert len(out["dates"]) == 20
    assert out["dates"][-1] == "2026-10-01"
    assert out["dates"][0] == "2026-09-07"
    assert out["series"]["A"][-1] == 99.0 and len(out["series"]["A"]) == 20


def test_missing_days_are_not_filled():
    # 10-20·10-21 은 수집 실패 — 날짜 자체가 없어야 하고 값이 보간되지 않는다.
    prev = hist(["2026-10-16", "2026-10-19"], {"A": [1.0, 2.0]})
    out = KH.merge_history(prev, {"2026-10-22": {"A": 6.0}, "2026-10-21": {}}, ["A"])
    assert out["dates"] == ["2026-10-16", "2026-10-19", "2026-10-22"]
    assert out["series"]["A"] == [1.0, 2.0, 6.0]


def test_ticker_not_known_on_old_days_is_null_not_estimated():
    prev = hist(["2026-10-16", "2026-10-19"], {"A": [1.0, 2.0]})
    out = KH.merge_history(prev, {"2026-10-22": {"A": 3.0, "NEW": 9.0}}, ["A", "NEW"])
    assert out["series"]["NEW"] == [None, None, 9.0]


def test_keep_limits_series_and_drops_all_null():
    prev = hist(["2026-10-16"], {"A": [1.0], "GONE": [7.0]})
    out = KH.merge_history(prev, {"2026-10-19": {"A": 2.0}}, ["A", "NOPE"])
    assert set(out["series"]) == {"A"}


def test_malformed_previous_is_ignored_safely():
    bad = hist(["2026-10-16", "bad-date"], {"A": [1.0], "B": [1.0, "x"], "C": "nope"})
    out = KH.merge_history(bad, {"2026-10-19": {"A": 2.0, "B": 3.0}}, ["A", "B"])
    # A 는 길이가 어긋나 이전 값을 버린다, B 는 유효한 첫 값만 산다
    assert out["dates"] == ["2026-10-16", "2026-10-19"]
    assert out["series"]["A"] == [None, 2.0]
    assert out["series"]["B"] == [1.0, 3.0]
    assert KH.merge_history(None, {}, ["A"]) == {"dates": [], "series": {}}
    assert KH.merge_history("junk", {"2026-10-19": {"A": float("nan")}}, ["A"]) == {"dates": [], "series": {}}


def test_backfill_candidates_skips_known_and_holidays():
    holidays = {dt.date(2026, 10, 9)}   # 한글날
    is_trading = lambda d: d.weekday() < 5 and d not in holidays  # noqa: E731
    have = ["2026-10-22", "2026-10-21"]
    got = KH.backfill_candidates(have, "2026-10-22", is_trading, max_days=10, limit=10)
    assert got[:3] == ["2026-10-20", "2026-10-19", "2026-10-16"]
    assert "2026-10-09" not in got and "2026-10-18" not in got
    assert len(got) == 8   # 창 10거래일 - 이미 있는 2일
    assert KH.backfill_candidates(have, "2026-10-22", is_trading, max_days=10, limit=3) == got[:3]
    assert KH.backfill_candidates(have, "bad", is_trading) == []
    # 달력을 모르면 평일만
    got2 = KH.backfill_candidates([], "2026-10-12", lambda d: None, max_days=3, limit=5)
    assert got2 == ["2026-10-12", "2026-10-09", "2026-10-08"]


# ---- 빌더 연결: 가짜 pykrx 로 build() 가 이력을 병합하는지 -------------------------------------

class FakeStock:
    def __init__(self, by_date):
        self.by_date = by_date
        self.calls = []

    def get_shorting_value_by_ticker(self, date, market):
        self.calls.append((date, market))
        rows = self.by_date.get(date, {}).get(market, {})
        df = pd.DataFrame.from_dict(
            {t: {"공매도": s, "매수": tot, "비중": r} for t, (s, tot, r) in rows.items()}, orient="index")
        return df


@pytest.fixture
def builder(monkeypatch, tmp_path, no_network):
    import build_kr_short_volume as B
    monkeypatch.setattr(B, "OUT_JSON", tmp_path / "short_volume.json")
    monkeypatch.setattr(B, "load_universe", lambda: {
        "000001": {"company": "가", "market": "kospi"},
        "000002": {"company": "나", "market": "kosdaq"},
    })
    monkeypatch.setattr(B.sec, "kst_today", lambda: dt.date(2026, 10, 23))
    monkeypatch.setattr(B, "krx_login_state", lambda: True)
    import kr_price_session
    monkeypatch.setattr(kr_price_session, "xkrx_is_trading", lambda: (lambda d: d.weekday() < 5))
    return B


def test_build_merges_previous_and_backfills(builder, monkeypatch):
    B = builder
    B.OUT_JSON.write_text(json.dumps({"history": hist(["2026-10-16"], {"000001": [4.0]})}), encoding="utf-8")
    data = {
        "20261022": {"KOSPI": {"000001": (10, 100, 10.0)}, "KOSDAQ": {"000002": (0, 50, 0.0)}},
        "20261021": {"KOSPI": {"000001": (5, 100, 5.0)}},
        # 10-20·10-19 는 KRX 가 빈 응답(로그인 장애 등) — 날짜가 생기면 안 된다
    }
    fake = FakeStock(data)
    monkeypatch.setattr(B, "_import_pykrx_stock", lambda: fake)
    payload = B.build()
    assert payload["date"] == "2026-10-22"
    assert [r["ticker"] for r in payload["rows"]] == ["000001"]   # 공매도 0원은 목록 밖
    h = payload["history"]
    assert h["dates"] == ["2026-10-16", "2026-10-21", "2026-10-22"]
    assert h["series"] == {"000001": [4.0, 5.0, 10.0]}
    assert len({d for d, _ in fake.calls}) <= 1 + 1 + B.MAX_BACKFILL + 1


def test_build_stops_when_krx_login_failed(builder, monkeypatch):
    B = builder
    monkeypatch.setattr(B, "krx_login_state", lambda: False)
    fake = FakeStock({})
    monkeypatch.setattr(B, "_import_pykrx_stock", lambda: fake)
    assert B.build() is None
    assert fake.calls == []   # 빈 응답 조회를 수십 번 돌지 않는다
