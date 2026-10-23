"""이월(yahoo-cache) 국내 종목 최근 봉 보충 회귀 테스트 (2026-10-23).

증상: preferHistory 밖 1,171종목이 직전 detail 일봉을 그대로 이월해 오늘 봉이 없었다 —
build_kr_market_alerts "2581종목 중 기준일(2026-10-23) 봉 1347종목". 신고가·신저가·거래대금 급증 보드가
유니버스 절반에서 하루 이상 늦었다.

수정: update_korea_data.topup_carried_history 가 네이버 일봉에서 빠진 날짜만 받아 꼬리에 붙인다(append-only).
겹침 종가가 다르면(수정주가 소급) 붙이지 않고 전체 재수집한다. 네트워크는 쓰지 않는다.
"""
from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

import update_data as UD
import update_korea_data as K

KST = ZoneInfo("Asia/Seoul")
AFTER_CLOSE = datetime(2026, 10, 23, 17, 10, tzinfo=KST)
INTRADAY = datetime(2026, 10, 23, 11, 0, tzinfo=KST)

# 2026-08-17 ~ 10-23 의 KRX 거래일(주말·광복절 대체 08-17 은 거래일로 둠, 추석 10-05~10-07·개천절 10-03·한글날 10-09 휴장).
_HOLIDAYS = {"2026-10-05", "2026-10-06", "2026-10-07", "2026-10-09"}


def _sessions(start="2026-08-17", end="2026-10-23"):
    from datetime import date, timedelta
    d = date.fromisoformat(start)
    out = []
    while d <= date.fromisoformat(end):
        iso = d.isoformat()
        if d.weekday() < 5 and iso not in _HOLIDAYS:
            out.append(iso)
        d += timedelta(days=1)
    return out


def _bar(day, close, volume=1000.0, frr=None):
    row = {"date": day, "open": close, "high": close * 1.01, "low": close * 0.99, "close": close, "volume": volume}
    if frr is not None:
        row["foreignRate"] = frr
    return row


def _series(through, factor=1.0):
    return [_bar(d, round((1000.0 + i) * factor, 4)) for i, d in enumerate(_sessions()) if d <= through]


def _meta(**over):
    meta = {"symbol": "123450", "yahooSymbol": "123450.KQ", "company": "테스트", "market": "kosdaq", "sector": "기술", "industry": "반도체",
            "quoteDate": "2026-10-23", "quotePrice": 1100.0, "quoteVolume": 5000, "historySource": "yahoo-cache",
            "dividends": [["2026-04-01", 10.0]], "topUpEligible": True, "marketCapT": 0.1, "groups": set()}
    meta.update(over)
    return meta


@pytest.fixture(autouse=True)
def fresh_state(monkeypatch):
    K._CACHED_BARS_SOURCE.clear()
    monkeypatch.setattr(K, "_topup_stats", {k: 0 for k in K._topup_stats})
    monkeypatch.setattr(K, "_topup_used", {"seconds": 0.0, "calls": 0})
    monkeypatch.setattr(K, "_topup_samples", [])
    K._CACHED_BARS_SOURCE["123450"] = K.BARS_SOURCE_NAVER
    yield
    K._CACHED_BARS_SOURCE.clear()


class Fetch:
    def __init__(self, rows):
        self.rows, self.calls = rows, []

    def __call__(self, code, start, end):
        self.calls.append((start, end))
        return [dict(r) for r in self.rows if start.isoformat() <= r["date"] <= end.isoformat()]


def _no_full(*a, **k):
    raise AssertionError("full refetch must not run")


# --------------------------------------------------------------------------
# topup_merge — 순수 병합 규칙
# --------------------------------------------------------------------------

def test_merge_appends_only_missing_dates_and_keeps_existing_bars():
    cached = _series("2026-10-20")
    cached[-1] = {**cached[-1], "close": 1.0, "high": 1.0, "low": 1.0}   # 이월된 마지막 봉(확정 전 값이었어도) 그대로
    fresh = _series("2026-10-23")
    merged, new = K.topup_merge(cached, fresh, "2026-10-23")
    assert [r["date"] for r in new] == ["2026-10-21", "2026-10-22", "2026-10-23"]
    assert merged[: len(cached)] == cached                              # 기존 봉은 한 개도 안 바뀐다
    assert merged[len(cached) - 1]["close"] == 1.0
    dates = [r["date"] for r in merged]
    assert dates == sorted(set(dates))                                   # 중복 날짜 없음·오름차순


def test_merge_respects_through_date():
    merged, new = K.topup_merge(_series("2026-10-20"), _series("2026-10-23"), "2026-10-22")
    assert new[-1]["date"] == "2026-10-22" and merged[-1]["date"] == "2026-10-22"


def test_merge_bridges_kr_holidays_without_inventing_bars():
    """추석(10-05~07)·한글날(10-09)을 건너는 공백 — 네이버가 준 거래일만 붙고 휴장일 봉은 생기지 않는다."""
    cached = _series("2026-10-02")
    merged, new = K.topup_merge(cached, _series("2026-10-23"), "2026-10-23")
    got = [r["date"] for r in new]
    assert got[:3] == ["2026-10-08", "2026-10-12", "2026-10-13"]
    assert not set(got) & _HOLIDAYS and "2026-10-03" not in got
    assert len(merged) == len(cached) + len(new)


def test_merge_dedupes_duplicate_fresh_dates():
    fresh = _series("2026-10-23")
    fresh.append(dict(fresh[-1]))
    _merged, new = K.topup_merge(_series("2026-10-21"), fresh, "2026-10-23")
    assert [r["date"] for r in new] == ["2026-10-22", "2026-10-23"]


def test_merge_nothing_new_when_naver_has_no_later_bar():
    cached = _series("2026-10-21")
    merged, new = K.topup_merge(cached, _series("2026-10-21"), "2026-10-23")   # 거래정지 등
    assert new == [] and merged == cached


def test_merge_overlap_mismatch_returns_none():
    """권리락·분할로 네이버가 과거 봉을 소급 조정했다 — 기준이 다른 꼬리를 붙이면 안 된다."""
    assert K.topup_merge(_series("2026-10-20"), _series("2026-10-23", factor=0.5), "2026-10-23") is None


def test_merge_ignores_spliced_bars_after_integration_for_stocks():
    """통합 종가(09-14~) 이후 캐시 봉은 야후(KRX) 값이라 네이버와 다르다 — 그 앞 날짜로만 판단한다."""
    cached = [
        {**r, "close": r["close"] - 3} if r["date"] >= K.NAVER_INTEGRATED_SINCE else r
        for r in _series("2026-10-20")
    ]
    out = K.topup_merge(cached, _series("2026-10-23"), "2026-10-23", integrated_since=K.NAVER_INTEGRATED_SINCE)
    assert out is not None and len(out[1]) == 3
    # 같은 캐시를 통합 이전까지 비교하면(ETF 규칙) 다르다고 본다
    assert K.topup_merge(cached, _series("2026-10-23"), "2026-10-23") is None


def test_merge_last_cached_date_missing_from_naver_returns_none():
    cached = _series("2026-10-16") + [_bar("2026-10-18", 5.0)]          # 일요일 봉 — 네이버에 없는 날짜(어긋난 캐시)
    assert K.topup_merge(cached, _series("2026-10-23"), "2026-10-23") is None


# --------------------------------------------------------------------------
# topup_through_date — 장중 실행은 오늘 봉을 붙이지 않는다(append-only 라 고칠 수 없으므로)
# --------------------------------------------------------------------------

def test_through_date_excludes_today_during_session():
    assert K.topup_through_date("2026-10-23", INTRADAY) == "2026-10-22"
    assert K.topup_through_date("2026-10-23", AFTER_CLOSE) == "2026-10-23"
    assert K.topup_through_date("2026-10-22", INTRADAY) == "2026-10-22"   # 기준일이 지난 거래일이면 그대로
    assert K.topup_through_date(None, AFTER_CLOSE) is None


# --------------------------------------------------------------------------
# topup_carried_history — 흐름
# --------------------------------------------------------------------------

def test_topup_appends_and_splices_krx_for_new_bars_only():
    cached = _series("2026-10-21")
    fetch = Fetch(_series("2026-10-23"))
    krx = [_bar(d, 2000.0 + i) for i, d in enumerate(_sessions())]
    meta = _meta()
    rows, status = K.topup_carried_history(meta, "123450", "123450.KQ", cached, now=AFTER_CLOSE, fetch_fn=fetch,
                                           yahoo_fn=lambda ys: ([r for r in krx if abs(r["close"] / 1050 - 1) < 1],
                                                                [["2026-10-22", 5.0]]),
                                           full_fn=_no_full)
    assert status == "appended"
    assert rows[: len(cached)] == cached
    assert [r["date"] for r in rows[len(cached):]] == ["2026-10-22", "2026-10-23"]
    assert meta["historySource"] == "yahoo-cache"            # 본문은 이월 — 의미 불변
    start, _end = fetch.calls[0]
    assert start.isoformat() < K.NAVER_INTEGRATED_SINCE       # 통합 이전 겹침으로 수정주가 변경을 본다
    assert ["2026-10-22", 5.0] in meta["dividends"] and ["2026-04-01", 10.0] in meta["dividends"]
    assert K._topup_stats["appended"] == 1 and K._topup_stats["bars"] == 2


def test_topup_keeps_naver_bar_when_yahoo_lacks_or_fails():
    cached = _series("2026-10-22")

    def boom(ys):
        raise RuntimeError("yahoo 429")
    rows, status = K.topup_carried_history(_meta(), "123450", "123450.KQ", cached, now=AFTER_CLOSE,
                                           fetch_fn=Fetch(_series("2026-10-23")), yahoo_fn=boom, full_fn=_no_full)
    assert status == "appended" and rows[-1] == _series("2026-10-23")[-1]


def test_topup_mismatch_triggers_full_refetch_flag():
    calls = []
    full_rows = _series("2026-10-23", factor=0.5)

    def full(meta, symbol, ysym, cached, cached_source, force_full=False):
        calls.append((cached_source, force_full))
        meta["barsSource"] = K.BARS_SOURCE_NAVER
        return full_rows, [["2026-09-01", 3.0]], "full"
    meta = _meta()
    rows, status = K.topup_carried_history(meta, "123450", "123450.KQ", _series("2026-10-20"), now=AFTER_CLOSE,
                                           fetch_fn=Fetch(_series("2026-10-23", factor=0.5)),
                                           yahoo_fn=lambda ys: ([], None), full_fn=full)
    assert status == "full-mismatch" and rows is full_rows
    assert calls == [(None, True)]
    assert meta["historySource"] == "yahoo"                   # 전체를 오늘 받았다
    assert meta["dividends"] == [["2026-09-01", 3.0]]
    assert K._topup_stats["full"] == 1


def test_topup_yahoo_cached_bars_go_full_without_mixing_sources():
    K._CACHED_BARS_SOURCE["123450"] = K.BARS_SOURCE_YAHOO
    fetch = Fetch(_series("2026-10-23"))
    rows, status = K.topup_carried_history(
        _meta(), "123450", "123450.KQ", _series("2026-09-11"), now=AFTER_CLOSE, fetch_fn=fetch,
        full_fn=lambda meta, *a, **k: (_series("2026-10-23"), None, "full"))
    assert status == "full" and fetch.calls == [] and rows[-1]["date"] == "2026-10-23"


def test_topup_full_failure_keeps_carried_rows():
    K._CACHED_BARS_SOURCE["123450"] = K.BARS_SOURCE_YAHOO
    cached = _series("2026-09-11")

    def full(*a, **k):
        raise RuntimeError("naver 503")
    meta = _meta()
    rows, status = K.topup_carried_history(meta, "123450", "123450.KQ", cached, now=AFTER_CLOSE, full_fn=full)
    assert status == "full-failed" and rows is cached and meta["historySource"] == "yahoo-cache"


def test_topup_naver_failure_keeps_carried_rows():
    def boom(code, start, end):
        raise RuntimeError("naver 503")
    cached = _series("2026-10-20")
    rows, status = K.topup_carried_history(_meta(), "123450", "123450.KQ", cached, now=AFTER_CLOSE,
                                           fetch_fn=boom, full_fn=_no_full)
    assert status == "failed" and rows is cached
    assert "실패 1" in K.topup_summary()


def test_topup_current_makes_no_request():
    fetch = Fetch(_series("2026-10-23"))
    rows, status = K.topup_carried_history(_meta(), "123450", "123450.KQ", _series("2026-10-23"),
                                           now=AFTER_CLOSE, fetch_fn=fetch, full_fn=_no_full)
    assert status == "current" and fetch.calls == []


def test_topup_intraday_does_not_append_today():
    rows, status = K.topup_carried_history(_meta(), "123450", "123450.KQ", _series("2026-10-21"), now=INTRADAY,
                                           fetch_fn=Fetch(_series("2026-10-23")), yahoo_fn=lambda ys: ([], None),
                                           full_fn=_no_full)
    assert status == "appended" and rows[-1]["date"] == "2026-10-22"


def test_topup_budget_exhausted_skips(monkeypatch):
    monkeypatch.setattr(K, "_topup_used", {"seconds": K.TOPUP_TIME_BUDGET_S + 1, "calls": 0})
    fetch = Fetch(_series("2026-10-23"))
    cached = _series("2026-10-20")
    rows, status = K.topup_carried_history(_meta(), "123450", "123450.KQ", cached, now=AFTER_CLOSE,
                                           fetch_fn=fetch, full_fn=_no_full)
    assert status == "budget" and rows is cached and fetch.calls == []
    assert "예산 밖 1" in K.topup_summary()


# --------------------------------------------------------------------------
# build_one 연결 — 이월 detail 에서 시작해 detail 계약(barsSource·historySource)을 지킨다
# --------------------------------------------------------------------------

def test_build_one_tops_up_carried_detail(tmp_path, monkeypatch):
    import json
    monkeypatch.setattr(K, "DETAILS_DIR", tmp_path)
    monkeypatch.setattr(K, "topup_through_date", lambda q, now=None: q)
    cached = _series("2026-10-21")
    detail = {"ticker": "123450", "historySource": "yahoo-cache", "barsSource": "naver",
              "chartSeries": [[r["open"], r["high"], r["low"], r["close"], r["volume"], r["date"]] for r in cached]}
    (tmp_path / "123450.json").write_text(json.dumps(detail), encoding="utf-8")
    fresh = [_bar(r["date"], r["close"], frr=12.5) for r in _series("2026-10-23")]
    monkeypatch.setattr(K, "fetch_naver_daily", lambda code, start, end, retries=3: [dict(r) for r in fresh])
    monkeypatch.setattr(K, "fetch_yahoo_history_kr", lambda ys, range_="5y": (_ for _ in ()).throw(RuntimeError("x")))
    meta = _meta(preferHistory=False, quotePrice=fresh[-1]["close"])
    meta.pop("historySource")
    meta.pop("dividends")
    stock, err = K.build_one(meta)
    assert err is None
    assert stock["historySource"] == "yahoo-cache" and stock["barsSource"] == "naver"
    assert stock["chartSeries"][-1][5] == "2026-10-23"
    assert [b[5] for b in stock["chartSeries"]][-3:] == ["2026-10-21", "2026-10-22", "2026-10-23"]


def test_build_one_without_eligibility_still_just_carries(tmp_path, monkeypatch):
    import json
    monkeypatch.setattr(K, "DETAILS_DIR", tmp_path)
    cached = _series("2026-10-21")
    detail = {"ticker": "123450", "historySource": "yahoo-cache", "barsSource": "naver",
              "chartSeries": [[r["open"], r["high"], r["low"], r["close"], r["volume"], r["date"]] for r in cached]}
    (tmp_path / "123450.json").write_text(json.dumps(detail), encoding="utf-8")
    monkeypatch.setattr(K, "fetch_naver_daily", lambda *a, **k: (_ for _ in ()).throw(AssertionError("no fetch")))
    meta = _meta(preferHistory=False, topUpEligible=False)
    meta.pop("historySource")
    stock, err = K.build_one(meta)
    assert err is None and stock["chartSeries"][-1][5] == "2026-10-21"
