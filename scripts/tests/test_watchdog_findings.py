"""데이터 건강 감시 첫 실행(2026-10-21)이 잡은 문제의 회귀 테스트. 네트워크는 쓰지 않는다.

1. US 상세 1,024개가 7일 넘게 멈춤 — preferHistory 밖 yahoo-cache 를 오래된 순으로 다시 받는다(실행당 상한).
   + US 오염 봉 1,131개 중 255개가 2% 여유 때문에 남던 것 — US 는 0.1% 기준으로 버린다.
2. KR 거래정지 + 감자·병합 종목에 야후 엉터리 종가가 덮여 −100% 등락률 — splice 가드 + 가격제한폭 플래그.
4. 연 1회 원천(국민연금·기업집단) 신선도 15일 · 국민연금 수집 재시도.
5. KSD 발행회사번호 조회 쿼터(하루 ~100회) 때문에 매일 같은 자리에서 전체 실패 — 받은 데까지 발행·이월.
"""
from __future__ import annotations

import json
import urllib.error
from datetime import date

import pytest

import build_kr_ksd_actions as KSD
import build_kr_nps_holdings as NPS
import check_data_freshness as CDF
import data_health_core as core
import update_data as UD
import update_korea_data as K


# ---- 1. US 묵은 캐시 재수집 ----

def _prev(ticker, source="yahoo-cache", cap=1.0):
    return {"ticker": ticker, "historySource": source, "marketCapB": cap}


def test_us_stale_refresh_picks_oldest_cache_first_within_quota():
    metas = [{"symbol": t, "preferHistory": False} for t in ("OLD", "MID", "NEW", "SNAP")] + [
        {"symbol": "BIG", "preferHistory": True}]
    prev = [_prev("OLD"), _prev("MID", cap=5.0), _prev("NEW"), _prev("SNAP", "snapshot"), _prev("BIG")]
    last = {"OLD": "2026-09-18", "MID": "2026-10-01", "NEW": "2026-10-20", "SNAP": "2026-09-01", "BIG": "2026-09-01"}
    got = UD.stale_cache_refresh_symbols(metas, prev, 1, today=date(2026, 10, 21), last_bar_fn=last.get)
    assert got == {"OLD"}
    got = UD.stale_cache_refresh_symbols(metas, prev, 10, today=date(2026, 10, 21), last_bar_fn=last.get)
    # 최근 봉(NEW)·합성(SNAP)·이미 preferHistory(BIG)는 대상이 아니다.
    assert got == {"OLD", "MID"}
    assert UD.stale_cache_refresh_symbols(metas, prev, 0, today=date(2026, 10, 21), last_bar_fn=last.get) == set()


def test_us_promote_stale_marks_prefer_history(monkeypatch):
    universe = [{"symbol": "AEIS", "preferHistory": False}, {"symbol": "AAPL", "preferHistory": True}]
    n = UD.promote_stale_cache_refresh(
        universe, [_prev("AEIS")], quota=5, today=date(2026, 10, 21), last_bar_fn=lambda t: "2026-09-18")
    assert n == 1 and universe[0]["preferHistory"] is True and universe[0]["staleCacheRefresh"] is True


def test_us_cached_last_bar_skips_corrupted_bar(tmp_path, monkeypatch):
    monkeypatch.setattr(UD, "DETAILS_DIR", tmp_path)
    series = [[250, 260, 249, 255, 1, "2026-09-17"], [258, 262.95, 256.76, 239.65, 1, "2026-09-18"]]
    (tmp_path / "AEIS.json").write_text(json.dumps({"historySource": "yahoo-cache", "chartSeries": series}), "utf-8")
    assert UD._cached_last_bar_date("AEIS") == "2026-09-17"   # 09-18 봉은 load 때 버려진다
    assert UD._cached_last_bar_date("NONE") is None


def test_us_drop_is_strict_but_kr_keeps_two_percent():
    # ABCB 실측: 고 83.50 · 저 82.03 · 종 80.68 (저가 아래 1.65%) — 반올림으로는 못 나오는 값.
    bar = {"date": "2026-09-18", "open": 83, "high": 83.5, "low": 82.03, "close": 80.68, "volume": 1}
    us = [{"date": "2026-09-17", "open": 1, "high": 1, "low": 1, "close": 1, "volume": 1}, dict(bar)]
    assert UD.drop_corrupted_last_bar(us, UD.US_CORRUPT_BAR_TOL) is True and len(us) == 1
    kr = [dict(bar)]
    assert UD.drop_corrupted_last_bar(kr) is False and len(kr) == 1
    clean = [{"date": "d", "open": 1, "high": 0.72, "low": 0.66, "close": 0.72, "volume": 1}]
    assert UD.drop_corrupted_last_bar(clean, UD.US_CORRUPT_BAR_TOL) is False


# ---- 2. KR 거래정지 감자·병합 ----

def test_kr_splice_rejects_yahoo_bar_far_from_naver():
    # 000300 DH오토넥스: 거래정지(거래량 0) 중 네이버 4,200 / 야후 21,086,206.
    rows = [{"date": "2026-09-30", "open": 4200, "high": 4200, "low": 4200, "close": 4200.0, "volume": 0},
            {"date": "2026-10-01", "open": 100, "high": 103, "low": 99, "close": 102.0, "volume": 5}]
    yahoo = [{"date": "2026-09-30", "open": 21086206, "high": 21086206, "low": 21086206, "close": 21086206.0, "volume": 0},
             {"date": "2026-10-01", "open": 100, "high": 101, "low": 99, "close": 100.0, "volume": 4}]
    n = K.splice_krx_bars(rows, yahoo, since="2026-09-14")
    assert n == 1
    assert rows[0]["close"] == 4200.0          # 엉터리 야후 봉은 버리고 네이버 그대로
    assert rows[1]["close"] == 100.0           # 통합 종가 2% 차이는 정상 — KRX 종가로 덮는다


def _kr_stock(chg, *, dates=("2026-10-20", "2026-10-21"), splits=None):
    return {"ticker": "000300", "changePct": chg, "priceDate": "2026-10-21", "splits": splits,
            "chartSeries": [[1, 1, 1, 1, 0, d] for d in dates]}


def test_kr_flag_out_of_price_limit():
    s = _kr_stock(-100.0, splits=[["2026-10-02", 0.0086, 1.0]])
    assert K.flag_kr_implausible_change(s) == "split" and s["changePctSuspect"] == "split"
    s = _kr_stock(-38.3)
    assert K.flag_kr_implausible_change(s) == "limit"


@pytest.mark.parametrize("chg", [29.9, -30.0, 30.5, 0.0, None])
def test_kr_flag_within_limit(chg):
    s = _kr_stock(chg)
    assert K.flag_kr_implausible_change(s) is None and "changePctSuspect" not in s


def test_kr_flag_exempts_listing_day():
    # 신규상장일: 공모가 대비 +300% 도 정상 — 기준일 전 봉이 없으면 표시하지 않는다.
    s = _kr_stock(300.0, dates=("2026-10-21",))
    assert K.flag_kr_implausible_change(s) is None
    assert K.flag_kr_implausible_change({"changePct": 250.0, "priceDate": "2026-10-21", "chartSeries": []}) is None


def test_kr_summary_excludes_suspect():
    stocks = [
        {"ticker": "A", "sector": "기술", "changePct": 1.0, "monthChangePct": 0},
        {"ticker": "B", "sector": "소재", "changePct": -100.0, "monthChangePct": 0, "changePctSuspect": "split"},
        {"ticker": "C", "sector": "소재", "changePct": 0.5, "monthChangePct": 0},
    ]
    out = K.build_summary(stocks)
    assert out["weakSector"] == "소재" and out["strongSector"] == "기술"
    stocks[2]["changePct"] = 2.0
    assert K.build_summary(stocks)["strongSector"] == "소재"   # B(−100%)가 빠져 소재 평균 = 2.0


def test_kr_limit_matches_health_watch():
    assert K.KR_PRICE_LIMIT_PCT == core.CHANGE_MAX["kr"]


# ---- 4. 연 1회 원천 신선도 · 국민연금 재시도 ----

def test_yearly_sources_freshness_is_two_weekly_runs():
    for path in ("data/korea/nps_holdings.json", "data/korea/corp_groups.json"):
        assert core.freshness_max_hours(CDF.CHECKS, path) == 15 * 24


class _Resp:
    def __init__(self, body):
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def read(self):
        return self.body


def test_nps_http_get_retries_timeout(monkeypatch):
    calls = []

    def fake(req, timeout=None):
        calls.append(1)
        if len(calls) < 3:
            raise urllib.error.URLError("timed out")
        return _Resp(b"ok")

    monkeypatch.setattr(NPS.urllib.request, "urlopen", fake)
    slept = []
    assert NPS.http_get("https://x", waits=(1, 2, 3), sleep=slept.append) == b"ok"
    assert slept == [1, 2]


def test_nps_http_get_does_not_retry_4xx(monkeypatch):
    def fake(req, timeout=None):
        raise urllib.error.HTTPError("https://x", 404, "nf", {}, None)

    monkeypatch.setattr(NPS.urllib.request, "urlopen", fake)
    with pytest.raises(urllib.error.HTTPError):
        NPS.http_get("https://x", waits=(1,), sleep=lambda s: None)


# ---- 5. KSD 쿼터 ----

@pytest.fixture
def ksd_universe(monkeypatch):
    stocks = [{"ticker": f"{i:06d}", "company": f"회사{i}", "marketCapT": 100 - i} for i in range(1, 11)]
    monkeypatch.setattr(KSD, "load_universe", lambda limit: (stocks[:limit], {}))
    return stocks


class FakeKsd:
    """발행회사번호 조회는 lookup_quota 회까지만 되고 그 뒤는 429. 나머지 조회는 늘 된다."""

    def __init__(self, lookup_quota):
        self.lookup_quota = lookup_quota
        self.calls = []

    def __call__(self, op, key, **params):
        self.calls.append(op)
        if op == "getIssucoCustnoByShortIsin":
            if self.calls.count(op) > self.lookup_quota:
                raise KSD.ApiError(f"{op} 3회 실패: HTTP Error 429: Too Many Requests")
            return [{"issucoCustno": "C" + params["shortIsin"]}]
        if op == "getIssucoRgtSchedule":
            return [{"rgtStdDt": KSD.kst_now().strftime("%Y%m%d"), "rgtRacdNm": "유상증자"}]
        return []


def test_ksd_lookup_quota_publishes_what_it_got_and_resumes(ksd_universe):
    fake = FakeKsd(lookup_quota=4)
    day1 = KSD.build("k", 10, call_fn=fake, prev={}, sleep=lambda s: None)
    cov = day1["coverage"]
    assert cov["refreshedThisRun"] == 4 and cov["lookupBlocked"] is True and cov["covered"] == 4
    assert len(day1["custnoMap"]) == 4 and len(day1["issues"]) == 4
    # 쿼터에 막힌 뒤로는 발행회사번호 조회를 더 부르지 않는다(429 백오프를 종목마다 반복하지 않음).
    assert fake.calls.count("getIssucoCustnoByShortIsin") == 5

    # 다음 날: 받은 적 없는 종목부터 새로 4개(발행회사번호 조회 쿼터만큼), 이미 아는 4종목은 조회 없이 다시 받는다.
    fake2 = FakeKsd(lookup_quota=4)
    day2 = KSD.build("k", 10, call_fn=fake2, prev=json.loads(json.dumps(day1)), sleep=lambda s: None)
    assert day2["coverage"]["covered"] == 8 and len(day2["custnoMap"]) == 8
    assert {r["src"] for r in day2["issues"]} == set(day2["custnoMap"])
    assert fake2.calls[:1] == ["getIssucoCustnoByShortIsin"]          # 안 받은 종목(000005~)부터


def test_ksd_quota_on_all_ops_carries_previous_rows(ksd_universe):
    day1 = KSD.build("k", 10, call_fn=FakeKsd(lookup_quota=10), prev={}, sleep=lambda s: None)
    assert day1["coverage"]["refreshedThisRun"] == 10

    class AllBlocked(FakeKsd):
        def __call__(self, op, key, **params):
            self.calls.append(op)
            if len(self.calls) > 3:   # 첫 종목(조회 2번)만 되고 그 뒤 전부 429
                raise KSD.ApiError(f"{op} 3회 실패: HTTP Error 429")
            return super().__call__(op, key, **params)

    day2 = KSD.build("k", 10, call_fn=AllBlocked(10), prev=json.loads(json.dumps(day1)), sleep=lambda s: None)
    assert day2["coverage"]["refreshedThisRun"] == 1 and "429" in day2["coverage"]["stopped"]
    assert len(day2["issues"]) == 10            # 못 받은 9종목은 어제 행 그대로(지어내지 않고 이월)
    assert len(day2["custnoMap"]) == 10


def test_ksd_carry_drops_rows_outside_window_and_universe():
    rows = [{"src": "A", "ticker": "A", "date": "2026-10-01"}, {"src": "B", "ticker": "B", "date": "2026-10-01"},
            {"src": "C", "ticker": "C", "date": "2025-01-01"}, {"ticker": "D", "date": "2026-10-01"}]
    out = KSD.carry_rows(rows, refreshed={"A"}, keep={"A", "B", "C", "D"}, cutoff_iso="2026-04-21", date_key="date")
    assert [r["ticker"] for r in out] == ["B", "D"]


def test_ksd_refresh_order_never_fetched_first():
    uni = [{"ticker": "A"}, {"ticker": "B"}, {"ticker": "C"}]
    order = KSD.refresh_order(uni, {"A": "2026-10-20", "C": "2026-10-19"})
    assert [s["ticker"] for s in order] == ["B", "C", "A"]


def test_ksd_main_fails_when_nothing_refreshed(ksd_universe, monkeypatch, tmp_path):
    monkeypatch.setattr(KSD, "OUT_JSON", tmp_path / "ksd.json")
    monkeypatch.setattr(KSD, "OUT_JS", tmp_path / "ksd.js")
    monkeypatch.setenv("DATA_GO_KR_KEY", "k")
    monkeypatch.setattr(KSD, "call", FakeKsd(lookup_quota=0))
    monkeypatch.setattr(KSD.time, "sleep", lambda s: None)
    monkeypatch.setattr("sys.argv", ["build_kr_ksd_actions.py"])
    assert KSD.main() == 1 and not (tmp_path / "ksd.json").exists()
