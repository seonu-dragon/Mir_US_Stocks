"""이벤트 스터디 빌더(build_event_study.py)의 순수 계산 검증 — 네트워크·파일 없음.

0일 결정(장 마감 후 접수 → 다음 거래일), 공시 제목 분류, 초과수익 경로(시장조정·시장모형),
가격 오류 제외, 대조 날짜 선택(결정적·이벤트와 떨어짐)을 확인한다.

실행: py -m pytest -q scripts/tests/test_build_event_study.py
"""
from __future__ import annotations

import build_event_study as es

CAL = [f"2024-01-{d:02d}" for d in range(2, 32)]  # 30개 '거래일'(주말 무시한 가짜 달력)


def test_us_timing_sessions():
    # 2026-07-30 20:30Z = 16:30 EDT → 장 마감 후
    assert es.us_timing("2026-07-30T20:30:28.000Z") == ("2026-07-30", "amc")
    # 12:00Z = 08:00 EDT → 장 전
    assert es.us_timing("2026-07-30T12:00:00.000Z") == ("2026-07-30", "bmo")
    # 15:00Z = 11:00 EDT → 장중
    assert es.us_timing("2026-07-30T15:00:00.000Z") == ("2026-07-30", "mkt")
    # 겨울(EST): 21:30Z = 16:30 EST → 장 마감 후, 00:30Z 는 전날 19:30 EST
    assert es.us_timing("2026-01-15T21:30:00.000Z") == ("2026-01-15", "amc")
    assert es.us_timing("2026-01-16T00:30:00.000Z") == ("2026-01-15", "amc")
    assert es.us_timing("bad")[1] == "unk"


def test_day0_index_amc_moves_to_next_trading_day():
    cal = ["2024-01-02", "2024-01-03", "2024-01-05"]
    assert es.day0_index(cal, "2024-01-03", "bmo") == 1
    assert es.day0_index(cal, "2024-01-03", "amc") == 2
    assert es.day0_index(cal, "2024-01-04", "unk") == 2      # 휴장일 공시 → 다음 거래일
    assert es.day0_index(cal, "2024-01-05", "amc") is None   # 달력 밖


def test_kr_classify_rules():
    assert es.kr_classify("연결재무제표기준영업(잠정)실적(공정공시)") == "kr_earn"
    assert es.kr_classify("결산실적공시예고") is None
    assert es.kr_classify("단일판매ㆍ공급계약체결              ") == "kr_contract"
    assert es.kr_classify("단일판매ㆍ공급계약해지") == "kr_contract_cancel"
    assert es.kr_classify("주요사항보고서(자기주식취득결정)") == "kr_buyback"
    assert es.kr_classify("자기주식취득신탁계약체결결정") == "kr_buyback_trust"
    assert es.kr_classify("자기주식취득신탁계약해지결정") is None
    assert es.kr_classify("주요사항보고서(유상증자결정)") == "kr_rights"
    assert es.kr_classify("주요사항보고서(무상증자결정)") == "kr_bonus"
    assert es.kr_classify("주요사항보고서(유무상증자결정)") == "kr_rights"
    assert es.kr_classify("주요사항보고서(전환사채권발행결정)") == "kr_cb"
    assert es.kr_classify("주요사항보고서(자기전환사채만기전취득결정)") is None
    assert es.kr_classify("최대주주변경") == "kr_major_change"
    assert es.kr_classify("최대주주변경을수반하는주식담보제공계약체결") is None
    assert es.kr_classify("[기재정정]주요사항보고서(유상증자결정)") is None   # 정정은 원 공시와 겹친다
    assert es.kr_classify("불성실공시법인지정예고") is None


def _series(stock_rets, bench_rets):
    """일간 수익률 목록 → 종가 시리즈(첫날 100)."""
    s, b = [100.0], [100.0]
    for r in stock_rets:
        s.append(s[-1] * (1 + r))
    for r in bench_rets:
        b.append(b[-1] * (1 + r))
    return s, b


def test_market_adjusted_car_points():
    n = 80
    bench = [0.001] * n
    stock = [0.001] * n
    stock[20] = 0.051        # 0일(인덱스 21 의 수익률 = stock[20])에 +5%p 초과
    s, b = _series(stock, bench)
    cal = [f"d{i:03d}" for i in range(n + 1)]
    rs, rb, _ = es.align_returns(cal, b, cal, s)
    ma, bad = es.car_points(rs, rb, 21, None)
    assert not bad
    i = {p: k for k, p in enumerate(es.POINTS)}
    assert ma[i[-1]] == 0
    assert ma[i[0]] == 50    # 0.1%p 단위 → 5.0%
    assert ma[i[40]] == 50
    assert ma[i[60]] is None  # 21+60 > 80 → 데이터 끝


def test_market_model_removes_beta():
    import math
    n = 400
    bench = [0.01 * math.sin(k / 3.0) for k in range(n)]
    stock = [0.0002 + 2.0 * x for x in bench]   # β=2, α=0.0002, 잡음 없음
    s, b = _series(stock, bench)
    cal = [f"d{i:03d}" for i in range(n + 1)]
    rs, rb, _ = es.align_returns(cal, b, cal, s)
    alpha, beta = es.market_model(rs, rb, 300)
    assert abs(beta - 2.0) < 1e-6 and abs(alpha - 0.0002) < 1e-6
    ma, mm, bad = es.event_paths(rs, rb, 300)
    assert mm is not None and all(v == 0 for v in mm if v is not None)   # 시장모형 초과수익 0
    assert any(v != 0 for v in ma if v is not None)                        # 시장조정은 β 차이를 남긴다


def test_bad_price_is_dropped_and_missing_pre_window():
    n = 80
    stock = [0.0] * n
    stock[25] = 1.5          # +150% 하루 — 가격 오류로 본다
    s, b = _series(stock, [0.0] * n)
    cal = [f"d{i:03d}" for i in range(n + 1)]
    rs, rb, _ = es.align_returns(cal, b, cal, s)
    assert es.car_points(rs, rb, 21, None) == (None, True)
    assert es.car_points(rs, rb, 3, None) == (None, False)   # −5일 이전 데이터 없음


def test_align_returns_forward_fills_halt_and_bounds():
    cal = ["a", "b", "c", "d", "e"]
    bench = [100, 101, 102, 103, 104]
    rs, rb, sc = es.align_returns(cal, bench, ["b", "d", "e"], [10.0, 11.0, 12.1])
    assert rs[0] is None and rs[1] is None      # 상장 전 · 첫날(직전 종가 없음)
    assert rs[2] == 0                            # 거래 없는 날은 직전 종가를 잇는다
    assert abs(rs[3] - 0.1) < 1e-12


def test_pick_control_deterministic_and_far_from_events():
    rs = [None] + [0.0] * 300
    rb = [None] + [0.0] * 300
    j1 = es.pick_control(rs, rb, [150], "us_earn|AAPL|2024-01-02")
    j2 = es.pick_control(rs, rb, [150], "us_earn|AAPL|2024-01-02")
    assert j1 == j2 and j1 is not None
    assert abs(j1 - 150) > es.CONTROL_GAP


def test_cap_bucket_matches_core_bounds():
    # event-study-core.js CAP_BOUNDS 와 같은 경계여야 화면 필터가 맞는다.
    assert [es.cap_bucket("us", v) for v in (1, 2, 50, 300)] == [0, 1, 2, 3]
    assert [es.cap_bucket("kr", v) for v in (0.1, 0.5, 5, 20)] == [0, 1, 2, 3]


# ── DART 증분·한도 초과(020) 처리 ────────────────────────────────────────────
from datetime import date  # noqa: E402
from types import SimpleNamespace  # noqa: E402


def test_quarter_end():
    assert es.quarter_end("2026Q1") == date(2026, 3, 31)
    assert es.quarter_end("2026Q3") == date(2026, 9, 30)
    assert es.quarter_end("2025Q4") == date(2025, 12, 31)


def test_kr_fetch_plan_skips_completed_and_resumes_in_progress():
    qs = es.kr_quarters(date(2026, 10, 4))
    done = {q[2]: "2026-09-26 12:03 KST" for q in qs if q[2] != "2026Q4"}
    plan = es.kr_fetch_plan(qs, done, 6)
    labels = [p[2] for p in plan]
    # 2026Q4 는 안 받음 → 전체, 2026Q3 는 분기 말(09-30) 전에 받음 → 09-19 부터, 2026Q2 이전은 완료.
    assert labels == ["2026Q4", "2026Q3"]
    assert plan[0] == ("20261001", "20261004", "2026Q4")
    assert plan[1] == ("20260919", "20260930", "2026Q3")


def test_kr_fetch_plan_first_run_takes_recent_quarters_up_to_limit():
    qs = es.kr_quarters(date(2026, 10, 4))
    plan = es.kr_fetch_plan(qs, {}, 3)
    assert [p[2] for p in plan] == ["2026Q4", "2026Q3", "2026Q2"]
    assert plan[1][0] == "20260701"


def test_kr_dart_age_days():
    assert es.kr_dart_age_days({"dartFetchedAtKst": "2026-09-26 12:32 KST"}, date(2026, 10, 3)) == 7
    assert es.kr_dart_age_days({}, date(2026, 10, 3)) is None


def test_collect_kr_rate_limit_keeps_events_and_flags(monkeypatch):
    import build_kr_disclosures as bkd

    calls = []

    def fake_dart_get(path, params, key):
        calls.append(params)
        if len(calls) == 1:
            return {"status": "000", "total_page": 1, "list": [
                {"stock_code": "005930", "report_nm": "자기주식취득결정", "rcept_no": "20261002000001", "rcept_dt": "20261002"}]}
        bkd.dart_abort_if_rate_limited("020", "list.json")

    monkeypatch.setenv("DART_API_KEY", "x")
    monkeypatch.setattr(bkd, "dart_get", fake_dart_get)
    monkeypatch.setattr(es, "kr_tracked", lambda: {"005930": {}})
    monkeypatch.setattr(es, "accrue_kr", lambda events: None)
    prev_done = {"2026Q3": "2026-09-26 12:03 KST"}
    archive = {"events": [], "dartQuarters": dict(prev_done), "dartFetchedAtKst": "2026-09-26 12:32 KST"}
    out, healthy = es.collect_kr(archive, SimpleNamespace(kr_quarters=6))
    assert healthy is False
    assert out.get("dartRateLimitedAtKst")
    assert out["dartFetchedAtKst"] == "2026-09-26 12:32 KST"     # 정상 수집 시각은 그대로
    assert len(calls) == 2                                          # 020 뒤로는 더 부르지 않는다
    if es.kr_classify("자기주식취득결정"):
        assert len(out["events"]) == 1                              # 받은 건 버리지 않는다
    # 끊긴 분기는 완료로 찍지 않는다(다음 실행이 다시 받는다).
    assert out["dartQuarters"].get("2026Q3") == prev_done["2026Q3"]
