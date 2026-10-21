"""data_health_core 순수 함수 — 이상 유형을 픽스처로 하나씩 재현한다(네트워크 없음)."""
from __future__ import annotations

from datetime import date, datetime, timedelta

import pytest

import data_health_core as core

KST = core.KST
NOW = datetime(2026, 10, 21, 8, 30, tzinfo=KST)   # 수요일


def weekdays_only(market, day):
    return day.weekday() < 5


def ids(problems):
    return {p["id"] for p in problems}


def dataset(path="data/x.js", max_hours=48.0, market=None, allow_empty=False, kind="feature", keys=("rows",)):
    return {"path": path, "name": "테스트", "market": market, "maxHours": max_hours, "allowEmpty": allow_empty,
            "countKeys": list(keys), "kind": kind}


def live(payload, nan=0, status=200):
    return {"status": status, "payload": payload, "nan": nan}


# ── 대상 자동 수집 ──────────────────────────────────────────────────

FEATURE_JS = """
const FEATURE_DATA = {
  insider:    { global: "INSIDER_TRADES", path: "data/insider_trades.js", feature: "insider", heavy: true },
  // 주석 { 괄호 } 는 무시
  ipo:        { global: "IPO_CALENDAR",   path: "data/ipo_calendar.js",   feature: "ipo", marketSpecific: true },
  krDart:     { global: "KR_DISCLOSURES", path: "data/kr_disclosures.js", feature: "krDart", krOnly: true },
  macro:      { global: "MACRO_INDICATORS", path: "data/macro_indicators.js" },
};
function featureDataSrc() {}
"""

MARKET_JS = """
  const US = {
    id: "us",
    snapshotPath: "data/market_snapshot.json",
    features: { insider: true, ipo: true },
  };
  const KR = {
    id: "kr",
    snapshotPath: "data/korea/market_snapshot.json",
    features: {
      insider: false,
      // 주석
      ipo: true,
      krDart: true,
    },
  };
"""

APP_JS = """
function dataTrustSources() {
  const source = (name, provider, payload, keys, maxHours, cadence, featureKey = "", fallbackTime = "", allowEmpty = false) => ({});
  rows.push(source("내부자 거래", "SEC Form 4", window.INSIDER_TRADES, ["trades"], 72, "영업일", "insider"));
  rows.push(source("IPO", cfg.id === "kr" ? "KRX · 공시" : "SEC S-1", window.IPO_CALENDAR, ["ipos"], cfg.id === "kr" ? 120 : 168, "매주", "ipo"));
  rows.push(source("배당 결정", "DART 원문 파싱", window.KR_DIVIDENDS, ["rows"], 24 * 3, "매일", "krDividends", "", true));
}
function other() {}
"""


def test_parse_feature_data_and_market_config():
    fd = core.parse_feature_data(FEATURE_JS)
    assert set(fd) == {"insider", "ipo", "krDart", "macro"}
    assert fd["ipo"]["marketSpecific"] is True and fd["insider"]["heavy"] is True
    mc = core.parse_market_config(MARKET_JS)
    assert mc["us"]["snapshotPath"] == "data/market_snapshot.json"
    assert mc["kr"]["features"] == {"insider": False, "ipo": True, "krDart": True}


def test_parse_trust_profiles_handles_ternary_and_products():
    prof = {p["featureKey"]: p for p in core.parse_trust_profiles(APP_JS)}
    assert prof["insider"]["maxHours"] == {"*": 72.0}
    assert prof["ipo"]["maxHours"] == {"kr": 120.0, "us": 168.0}
    assert prof["krDividends"]["maxHours"] == {"*": 72.0} and prof["krDividends"]["allowEmpty"] is True


def test_resolve_datasets_follows_market_flags():
    checks = {"g": [("data/macro_indicators.json", 7, True), ("data/market_snapshot.json", 2, False)]}
    ds = {d["path"]: d for d in core.resolve_datasets(
        core.parse_feature_data(FEATURE_JS), core.parse_market_config(MARKET_JS),
        core.parse_trust_profiles(APP_JS), checks, ["data/ticker_aliases_ko.js"])}
    # marketSpecific → 시장별 경로 둘, 주기는 시장별 ternary
    assert ds["data/ipo_calendar.js"]["maxHours"] == 168.0 and ds["data/korea/ipo_calendar.js"]["maxHours"] == 120.0
    # KR features 에서 꺼진 insider 는 US 하나뿐 → US 달력
    assert ds["data/insider_trades.js"]["market"] == "us"
    # 프로필 없는 데이터셋 → 신선도 관문 주기(7일) + '0건이면 실패'
    assert ds["data/macro_indicators.js"]["maxHours"] == 168.0 and ds["data/macro_indicators.js"]["allowEmpty"] is False
    assert ds["data/market_snapshot.json"]["kind"] == "snapshot" and ds["data/market_snapshot.json"]["maxHours"] == 48.0
    assert ds["data/ticker_aliases_ko.js"]["maxHours"] is None


# ── 파싱 ────────────────────────────────────────────────────────────

def test_parse_payload_js_with_header_comment_and_nan():
    payload, nan = core.parse_payload('// 머리 주석\nwindow.X = {"a": NaN, "b": [1, Infinity]};\n', True)
    assert nan == 2 and payload["b"][0] == 1


def test_parse_payload_rejects_non_assignment():
    with pytest.raises(ValueError):
        core.parse_payload("console.log(1)", True)


@pytest.mark.parametrize("raw, expected", [
    ("2026-10-21 07:01 KST", datetime(2026, 10, 21, 7, 1, tzinfo=KST)),
    ("2026-10-20T22:01:00Z", datetime(2026, 10, 21, 7, 1, tzinfo=KST)),
    ("2026-10-21T07:01:00+09:00", datetime(2026, 10, 21, 7, 1, tzinfo=KST)),
    ("2026-10-21", datetime(2026, 10, 21, 0, 0, tzinfo=KST)),
])
def test_parse_stamp(raw, expected):
    assert core.parse_stamp(raw) == expected


# ── (1) 신선도 ──────────────────────────────────────────────────────

def test_stale_dataset_is_flagged():
    stamp = (NOW - timedelta(hours=60)).strftime("%Y-%m-%d %H:%M KST")
    _, found = core.check_dataset(dataset(max_hours=48), live({"updatedAtKst": stamp, "rows": [1]}), None, None, NOW, weekdays_only)
    assert "freshness:data/x.js" in ids(found)


def test_weekend_is_excused_for_market_data():
    # 금요일 18:00 KR 발행 → 월요일 10:00 확인: 벽시계 64h, 토·일 차감 16h → 36h 허용 안.
    monday = datetime(2026, 10, 19, 10, 0, tzinfo=KST)
    stamp = "2026-10-16 18:00 KST"
    row, found = core.check_dataset(dataset(max_hours=36, market="kr"), live({"updatedAtKst": stamp, "rows": [1]}),
                                    None, None, monday, weekdays_only)
    assert not found and row["excusedHours"] == 48.0
    # 같은 나이라도 시장 무관 데이터는 차감하지 않는다.
    _, found = core.check_dataset(dataset(max_hours=36), live({"updatedAtKst": stamp, "rows": [1]}), None, None, monday, weekdays_only)
    assert "freshness:data/x.js" in ids(found)


def test_us_publish_day_follows_previous_new_york_session():
    # 월요일 KST 아침 = 일요일(뉴욕) 세션 없음 → 발행일 아님. 화요일 KST = 월요일 세션.
    assert core.publish_day("us", date(2026, 10, 19), weekdays_only) is False
    assert core.publish_day("us", date(2026, 10, 20), weekdays_only) is True
    holiday = lambda m, d: d != date(2026, 11, 26) and d.weekday() < 5   # 추수감사절
    assert core.publish_day("us", date(2026, 11, 27), holiday) is False


# ── (2) 구조 ────────────────────────────────────────────────────────

def test_empty_and_row_drop_and_missing_stamp():
    _, found = core.check_dataset(dataset(), live({"updatedAtKst": "2026-10-21 08:00 KST", "rows": []}), None, None, NOW, weekdays_only)
    assert "structure:empty:data/x.js" in ids(found)
    # allowEmpty 여도 직전에 수백 행이던 게 0 이면 문제
    _, found = core.check_dataset(dataset(allow_empty=True), live({"updatedAtKst": "2026-10-21 08:00 KST", "rows": []}),
                                  None, {"rows": 300}, NOW, weekdays_only)
    assert "structure:empty:data/x.js" in ids(found)
    _, found = core.check_dataset(dataset(), live({"updatedAtKst": "2026-10-21 08:00 KST", "rows": [1] * 40}),
                                  None, {"rows": 100}, NOW, weekdays_only)
    assert "structure:drop:data/x.js" in ids(found)
    _, found = core.check_dataset(dataset(), live({"rows": [1]}), None, None, NOW, weekdays_only)
    assert "structure:nostamp:data/x.js" in ids(found)


def test_small_feeds_do_not_trip_row_drop():
    _, found = core.check_dataset(dataset(), live({"updatedAtKst": "2026-10-21 08:00 KST", "rows": [1] * 3}),
                                  None, {"rows": 12}, NOW, weekdays_only)
    assert not found


def test_nan_tokens_and_parse_errors():
    _, found = core.check_dataset(dataset(path="data/s.json"), live({"updatedAtKst": "2026-10-21 08:00 KST", "rows": [1]}, nan=3),
                                  None, None, NOW, weekdays_only)
    nan = next(p for p in found if p["id"] == "structure:nan:data/s.json")
    assert nan["severity"] == "error"     # .json 은 브라우저 JSON.parse 가 통째로 실패
    _, found = core.check_dataset(dataset(), {"status": 200, "error": "JSON 파싱 실패"}, None, None, NOW, weekdays_only)
    assert "structure:parse:data/x.js" in ids(found)


def test_static_handwritten_js_is_not_a_problem():
    row, found = core.check_dataset(dataset(path="data/aliases.js", max_hours=None, kind="html"),
                                    {"status": 200, "error": "형태가 아님"}, None, None, NOW, weekdays_only)
    assert not found and row["status"] == "static"


# ── (5) 라이브 vs 레포 ──────────────────────────────────────────────

def test_live_older_than_repo_means_deploy_stalled():
    live_p = live({"updatedAtKst": "2026-10-20 07:00 KST", "rows": [1]})
    repo_p = live({"updatedAtKst": "2026-10-21 07:00 KST", "rows": [1]})
    _, found = core.check_dataset(dataset(max_hours=100), live_p, repo_p, None, NOW, weekdays_only)
    assert "deploy:lag:data/x.js" in ids(found)
    # 2시간 차이는 정상 배포 지연
    repo_p = live({"updatedAtKst": "2026-10-20 09:00 KST", "rows": [1]})
    _, found = core.check_dataset(dataset(max_hours=100), live_p, repo_p, None, NOW, weekdays_only)
    assert not found


def test_live_404():
    _, found = core.check_dataset(dataset(), {"status": 404}, live({"rows": [1]}), None, NOW, weekdays_only)
    p = next(p for p in found if p["id"] == "deploy:missing:data/x.js")
    assert "레포에는 있음" in p["value"]


# ── (3) 값 이상 ─────────────────────────────────────────────────────

def stock(ticker, chg, cap=10.0, groups=("idx_sp500",), **kw):
    return {"ticker": ticker, "price": 10.0, "changePct": chg, "marketCapB": cap, "volume": 1000, "rsi14": 50,
            "closeSeries": [1, 2], "groups": list(groups), **kw}


def us_snapshot(stocks):
    return {"updatedAtKst": "2026-10-21 07:00 KST", "priceDate": "2026-10-20", "stocks": stocks}


def test_split_unadjusted_change_is_flagged_unless_marked_suspect():
    base = [stock(f"S{i}", 0.5) for i in range(40)]
    _, found = core.check_snapshot_values("us", us_snapshot(base + [stock("AMTD", 4875.9)]), None)
    p = next(p for p in found if p["id"] == "values:change:us")
    assert "AMTD +4,876%" in p["value"]
    _, found = core.check_snapshot_values("us", us_snapshot(base + [stock("AMTD", 4875.9, changePctSuspect="split")]), None)
    assert "values:change:us" not in ids(found)


def test_kr_price_limit_breaches_need_several():
    base = [stock(f"{i:06d}", 0.1, groups=("idx_kospi",)) for i in range(40)]
    snap = {"updatedAtKst": "x", "stocks": base, "indices": []}
    _, found = core.check_snapshot_values("kr", dict(snap, stocks=base + [stock("000001", 31.0)]), None)
    assert "values:change:kr" not in ids(found)       # 신규 상장 첫날 1~3개는 정상일 수 있다
    bad = [stock(f"9{i:05d}", -99.0) for i in range(4)]
    _, found = core.check_snapshot_values("kr", dict(snap, stocks=base + bad), None)
    assert "values:change:kr" in ids(found)


def test_null_ratio_jump_against_previous_run():
    stocks = [stock(f"S{i}", 0.1) for i in range(80)] + [stock(f"N{i}", 0.1, rsi14=None) for i in range(20)]
    metrics, found = core.check_snapshot_values("us", us_snapshot(stocks), {"nullRatios": {"rsi14": 0.02}})
    assert metrics["nullRatios"]["rsi14"] == 0.2 and "values:null:us:rsi14" in ids(found)
    _, found = core.check_snapshot_values("us", us_snapshot(stocks), {"nullRatios": {"rsi14": 0.18}})
    assert "values:null:us:rsi14" not in ids(found)


def test_nan_values_count_as_null():
    assert core.null_ratios([stock("A", float("nan")), stock("B", 1.0)])["changePct"] == 0.5


def test_index_vs_constituents_uses_cap_weighted_mean():
    members = [stock(f"M{i}", -0.2, cap=1.0, groups=("idx_kospi",)) for i in range(40)]
    members += [stock("005930", 6.0, cap=100.0, groups=("idx_kospi",))]
    snap = {"updatedAtKst": "x", "stocks": members,
            "indices": [{"symbol": "^KS11", "changePct": 3.3}]}
    metrics, found = core.check_snapshot_values("kr", snap, None)
    row = metrics["indexCheck"][0]
    # 중앙값(−0.2)은 크게 벌어지지만 시총가중(+4.2)과는 1.5%p 이내라 정상(2026-10-21 KOSPI 형태)
    assert row["median"] == -0.2 and "values:index:kr:^KS11" not in ids(found)
    snap["indices"][0]["changePct"] = -3.0       # 부호가 뒤집힌 지수
    _, found = core.check_snapshot_values("kr", snap, None)
    assert "values:index:kr:^KS11" in ids(found)


def test_us_index_proxy_from_etf_row():
    members = [stock(f"M{i}", 1.0) for i in range(40)]
    snap = us_snapshot(members + [stock("SPY", -2.0, groups=())])
    _, found = core.check_snapshot_values("us", snap, None)
    assert "values:index:us:SPY" in ids(found)


def test_snapshot_missing_required_keys():
    _, found = core.check_snapshot_values("us", {"stocks": []}, None)
    assert "structure:keys:snapshot_us" in ids(found)


def test_detail_bars_close_outside_high_low():
    sweep = core.DetailSweep("us", "2026-10-20")
    good = [[10, 11, 9, 10.5, 100, "2026-10-20"]]
    for i in range(100):
        sweep.add(f"G{i}", {"chartSeries": good})
    for i in range(12):
        sweep.add(f"B{i}", {"chartSeries": [[10, 11, 9, 14.0, 100, "2026-10-20"]]})   # 종가 > 고가
    sweep.add("NOBARS", {"chartSeries": []})
    metrics, found = sweep.result()
    assert metrics["lastBarOutsideRange"] == 12 and metrics["noBars"] == 1
    assert "values:bars:us" in ids(found)


def test_detail_bars_rounding_and_stale_charts():
    sweep = core.DetailSweep("kr", "2026-10-21")
    for i in range(20):
        sweep.add(f"R{i}", {"chartSeries": [[100, 110, 90, 110.05, 1, "2026-10-21"]]})   # 반올림 여유 안
    for i in range(5):
        sweep.add(f"S{i}", {"chartSeries": [[100, 110, 90, 100, 1, "2026-09-18"]]})       # 한 달 전에 멈춤
    metrics, found = sweep.result()
    assert metrics["lastBarOutsideRange"] == 0 and metrics["staleBars"] == 5
    assert "values:stalebars:kr" in ids(found)


# ── (4) 워크플로우 ──────────────────────────────────────────────────

def run(rid, name, conclusion, created="2026-10-21T03:00:00Z"):
    return {"id": rid, "name": name, "status": "completed", "conclusion": conclusion, "created_at": created}


def test_timeout_cancel_vs_queue_replacement():
    runs = [run(1, "Moment news (daily)", "cancelled"), run(2, "Daily US market snapshot", "cancelled")]
    jobs = {
        1: [{"name": "build", "conclusion": "cancelled",
             "steps": [{"name": "Build moment news", "conclusion": "cancelled", "started_at": "2026-10-21T03:41:00Z"}]}],
        2: [],   # 시작 전 대기 교체
    }
    _, found = core.classify_workflows(runs, jobs, {})
    assert ids(found) == {"workflow:cancelled:Moment news (daily)"}


def test_hidden_continue_on_error_failure_and_recovery():
    runs = [run(1, "KR DART disclosures + ownership", "success", "2026-10-20T06:30:00Z"),
            run(2, "KR DART disclosures + ownership", "success", "2026-10-21T06:30:00Z")]
    hidden = {2: [{"job": "update", "step": "python -u scripts/build_kr_ksd_actions.py --push"}]}
    _, found = core.classify_workflows(runs, {}, hidden)
    p = next(p for p in found if p["id"] == "workflow:hidden:KR DART disclosures + ownership")
    assert "build_kr_ksd_actions" in p["value"]
    # 최신 run 이 깨끗하면 이전 run 의 실패는 회복된 것
    _, found = core.classify_workflows(runs, {}, {1: hidden[2]})
    assert not found


def test_failed_run_and_ignored_workflows():
    runs = [run(1, "Weekly earnings history refresh", "failure"), run(2, "CI", "failure"),
            run(3, "Deploy Pages", "cancelled")]
    jobs = {1: [{"name": "weekly-gate", "conclusion": "failure",
                 "steps": [{"name": "Data freshness gate", "conclusion": "failure"}]}],
            3: [{"name": "deploy", "conclusion": "cancelled", "steps": [{"name": "x", "conclusion": "cancelled", "started_at": "t"}]}]}
    _, found = core.classify_workflows(runs, jobs, {})
    assert ids(found) == {"workflow:failed:Weekly earnings history refresh"}
    assert "Data freshness gate" in found[0]["value"]


def test_failed_step_from_log():
    log = "\n".join([
        "2026-10-21T06:44:22.6Z ##[group]Run actions/checkout@v4",
        "2026-10-21T06:44:22.6Z ##[group]Run python -u scripts/build_kr_event_details.py --push",
        "2026-10-21T06:45:20.7Z ##[group]Run python -u scripts/build_kr_ksd_actions.py --push",
        "2026-10-21T06:59:15.3Z ##[error]Process completed with exit code 1.",
    ])
    assert core.failed_step_from_log(log) == ["python -u scripts/build_kr_ksd_actions.py --push"]


# ── 알림 중복 억제 · 메시지 · 보고서 ────────────────────────────────

def test_alert_once_per_day_and_resolution_clears_state():
    a = core.problem("freshness", "data/a.js", "A", "60h")
    b = core.problem("values", "change:us", "B", "1개")
    fresh, state = core.select_alerts([a, b], {}, "2026-10-21")
    assert len(fresh) == 2
    fresh, state = core.select_alerts([a, b], state, "2026-10-21")
    assert fresh == []
    fresh, state = core.select_alerts([a], state, "2026-10-22")       # 다음 날 다시, b 는 해소
    assert [p["id"] for p in fresh] == [a["id"]] and b["id"] not in state["sent"]
    fresh, _ = core.select_alerts([a, b], state, "2026-10-22")        # 다시 생긴 b 는 바로
    assert [p["id"] for p in fresh] == [b["id"]]


def test_message_escapes_html_and_counts_ongoing():
    a = core.problem("values", "x", "|등락률|>300%", "<3개>")
    b = core.problem("deploy", "y", "B", "1")
    msg = core.format_message([a], [a, b], "https://example/run")
    assert "&gt;300%" in msg and "&lt;3개&gt;" in msg and "이미 알린 문제 1건" in msg
    assert msg.splitlines()[0].startswith("<b>[Mir 데이터 건강]</b> 문제 2건")


def test_build_report_counts():
    probs = [core.problem("deploy", "y", "B", "1"), core.problem("freshness", "x", "A", "1")]
    rep = core.build_report(NOW, probs, [], {}, {}, {}, 10)
    assert rep["status"] == "problem" and rep["count"] == 2 and rep["counts"]["deploy"] == 1
    assert rep["problems"][0]["category"] == "freshness"
    assert core.build_report(NOW, [], [], {}, {}, {}, 10)["status"] == "ok"
