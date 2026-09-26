"""주간 실적·재무 워크플로우 시간 초과 대책 + KR 가격 기준 + KR 상장주식수 테스트(네트워크 없음).

배경: 2026-08-22·09-05·09-19 세 번 `KR quarterly earnings (DART)` 스텝이 5시간 넘게 붙잡아 earnings
잡이 360분 한도로 취소됐고 뒤 7개 스텝이 못 돌아 8개 파일이 09-13 에 멈췄다.

실행: py -m pytest -q scripts/tests/test_weekly_budget.py
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest
import yaml

import build_kr_audit_opinion as audit
import build_kr_earnings as kre
import build_kr_ownership_profile as own
import earnings_history_store as ehs
import step_budget as sb
import update_korea_data as K

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / ".github" / "workflows" / "weekly-earnings-history.yml"


class FakeClock:
    def __init__(self):
        self.t = 0.0

    def __call__(self):
        return self.t


# ─────────────────────────── step_budget ───────────────────────────
def test_budget_time_and_consecutive_errors():
    c = FakeClock()
    b = sb.StepBudget(10, now=c, max_consecutive_errors=3)
    assert not b.over()
    c.t = 9 * 60
    assert not b.over()
    c.t = 10 * 60
    assert b.over() and "시간 예산" in b.reason

    b2 = sb.StepBudget(0, now=FakeClock(), max_consecutive_errors=3)   # 0 = 시간 무제한
    b2.record(False); b2.record(False); b2.record(True); b2.record(False); b2.record(False)
    assert not b2.over()                                                # 중간 성공으로 초기화
    b2.record(False)
    assert b2.over() and "연속 요청 실패 3회" in b2.reason


def test_missing_first_and_carry_over():
    pairs = [("A", "1"), ("B", "2"), ("C", "3"), ("D", "4")]
    assert sb.missing_first(pairs, {"A", "C"}) == [("B", "2"), ("D", "4"), ("A", "1"), ("C", "3")]
    fresh = {"B": {"v": 2}}
    prev = {"A": {"v": 1}, "C": {"v": 3}, "Z": {"v": 9}, "B": {"v": 0}}
    out, n = sb.carry_over(fresh, prev, attempted={"B", "C"}, universe={"A", "B", "C", "D"})
    # A: 시도 못 함 → 이월 / B: 새 값 / C: 시도했는데 값 없음 → 이월 안 함 / Z: 유니버스 밖 → 버림
    assert out == {"B": {"v": 2}, "A": {"v": 1}} and n == 1


def test_remaining_minutes():
    assert sb.remaining_minutes(300, 10, 90, start_epoch=1000, now=1000) == 90
    assert sb.remaining_minutes(300, 10, 90, start_epoch=1000, now=1000 + 250 * 60) == 40
    assert sb.remaining_minutes(300, 10, None, start_epoch=1000, now=1000 + 299 * 60) == 0
    assert sb.remaining_minutes(150, 10, 120, start_epoch=None) == 120


# ─────────────────────────── KR 분기 실적 · 현금흐름 ───────────────────────────
def test_kr_cashflow_stops_on_budget_and_marks_attempted(monkeypatch):
    c = FakeClock()
    calls = []

    def fake_get(path, params, key):
        calls.append(params["corp_code"])
        c.t += 60                                           # 호출마다 1분
        if params["corp_code"] == "c2":
            return {"status": "013"}
        return {"status": "000", "list": [
            {"sj_div": "CF", "account_id": kre.CF_OPERATING_ID, "thstrm_amount": "100"},
            {"sj_div": "CF", "account_id": kre.CF_CAPEX_ID, "thstrm_amount": "-30"},
        ]}

    monkeypatch.setattr(kre, "dart_get", fake_get)
    budget = sb.StepBudget(2.5, now=c)
    attempted: set[str] = set()
    out = kre.fetch_cash_flow_and_ev("k", [("A", "c1"), ("B", "c2"), ("C", "c3"), ("D", "c4")], "2025",
                                     budget, attempted)
    assert calls == ["c1", "c2", "c3"]                     # 3분째에 예산 초과 → D 는 안 부른다
    assert attempted == {"A", "B", "C"}
    assert out["A"]["freeCashFlow"] == 70 and "B" not in out


def test_kr_cashflow_request_errors_trip_breaker(monkeypatch):
    def boom(path, params, key):
        raise TimeoutError("read timed out")

    monkeypatch.setattr(kre, "dart_get", boom)
    budget = sb.StepBudget(0, max_consecutive_errors=5)
    attempted: set[str] = set()
    pairs = [(f"T{i}", f"c{i}") for i in range(50)]
    kre.fetch_cash_flow_and_ev("k", pairs, "2025", budget, attempted)
    assert budget.over() and "연속" in budget.reason and not attempted


def test_kr_quarterly_phase_stop_keeps_file(monkeypatch, tmp_path):
    out_json = tmp_path / "earnings.json"
    out_json.write_text('{"keep": true}', encoding="utf-8")
    monkeypatch.setattr(kre, "OUT_JSON", out_json)
    monkeypatch.setattr(kre, "load_json", lambda p, d: {"stocks": [{"ticker": "005930", "marketCapB": 1}]}
                        if p == kre.KR_SNAPSHOT else d)
    monkeypatch.setattr(kre, "load_corp_map", lambda key: {"005930": "c1"})
    b = sb.StepBudget(0.0001, now=FakeClock())
    b.reason = "시간 예산 0분 소진"
    with pytest.raises(kre.PhaseStopped):
        kre.build("k", ["2025"], None, b)
    assert json.loads(out_json.read_text(encoding="utf-8")) == {"keep": True}


# ─────────────────────────── 소유구조 · 감사의견 ───────────────────────────
def test_ownership_missing_first_and_budget(monkeypatch):
    monkeypatch.setattr(own, "load_json", lambda p, d: {"stocks": [
        {"ticker": "000001", "marketCapB": 3}, {"ticker": "000002", "marketCapB": 2}, {"ticker": "000003", "marketCapB": 1},
    ]})
    monkeypatch.setattr(own, "load_corp_map", lambda key: {"000001": "c1", "000002": "c2", "000003": "c3"})
    c = FakeClock()
    seen = []

    def fake_get(path, params, key):
        seen.append(params["corp_code"])
        c.t += 20
        return {"status": "000", "list": [{"hold_stock_rate": "50%", "shrholdr_co": "10"}]}

    monkeypatch.setattr(own, "dart_get", fake_get)
    prev = {"000001": {"freeFloatPct": 1.0}}
    fresh, errors, attempted, universe = own.build("k", "2025", None, sb.StepBudget(1.5, now=c), prev)
    assert seen[:3] == ["c2", "c2", "c2"]                   # 직전 값 없는 000002 부터
    assert attempted == {"000002", "000003"} and "000001" not in attempted
    merged, carried = sb.carry_over(fresh, prev, attempted, universe)
    assert carried == 1 and merged["000001"] == {"freeFloatPct": 1.0}


def test_audit_budget_and_attempted(monkeypatch):
    monkeypatch.setattr(audit, "load_json", lambda p, d: {"stocks": [
        {"ticker": "000001", "marketCapB": 2}, {"ticker": "000002", "marketCapB": 1},
    ]})
    monkeypatch.setattr(audit, "load_corp_map", lambda key: {"000001": "c1", "000002": "c2"})

    def fake_get(path, params, key):
        if params["corp_code"] == "c1":
            return {"status": "000", "list": [{"bsns_year": "제10기(당기)", "adt_opinion": "적정의견", "adtor": "X"}]}
        return {"status": "100", "message": "bad"}

    monkeypatch.setattr(audit, "dart_get", fake_get)
    fresh, errors, attempted, universe = audit.build("k", "2025", None, sb.StepBudget(0), {})
    assert attempted == {"000001"}                          # 오류 응답은 '확인함' 이 아니다 → 이월 대상
    assert fresh["000001"]["opinion"] == "적정의견" and errors == {"100": 1}


# ─────────────────────────── 야후 실적 이력 회전 ───────────────────────────
def test_earnings_history_rotation_and_next_offset(monkeypatch, tmp_path):
    for t in ("A", "B", "C", "D"):
        (tmp_path / f"{t}.json").write_text("{}", encoding="utf-8")
    monkeypatch.setattr(ehs, "DETAILS_DIR", tmp_path)
    monkeypatch.setattr(ehs, "CHECKPOINT", tmp_path / "ck.json")
    c = FakeClock()
    order = []

    def fake_refresh(ticker, fetch_limit=4):
        order.append(ticker)
        c.t += 60
        return False

    monkeypatch.setattr(ehs, "refresh_ticker", fake_refresh)
    stats = ehs.refresh_all_incremental(tickers=["A", "B", "C", "D"], sleep_s=0,
                                        budget=sb.StepBudget(2, now=c), start_offset=3)
    assert order == ["D", "A"]                              # 오프셋 3(D) 부터, 2분 뒤 멈춤
    assert stats["nextOffset"] == 1 and stats["stoppedReason"]
    full = ehs.refresh_all_incremental(tickers=["A", "B", "C", "D"], sleep_s=0, budget=sb.StepBudget(0))
    assert full["nextOffset"] == 0 and full["processed"] == 4


# ─────────────────────────── 워크플로우 구조 ───────────────────────────
def test_weekly_workflow_split_jobs_budgets_and_gate():
    wf = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
    jobs = wf["jobs"]
    assert {"us-and-public", "kr-dart", "weekly-gate", "financials"} <= set(jobs)
    for name, job in jobs.items():
        assert job.get("timeout-minutes", 999) <= 300, name
        for step in job["steps"]:
            run = step.get("run") or ""
            for line in run.splitlines():
                if "python " in line and "scripts/" in line and "step_budget.py" not in line:
                    assert "python -u" in line, f"{name}/{step.get('name')}: {line.strip()}"
            if step.get("continue-on-error") and step.get("if") != "failure()":
                assert step.get("timeout-minutes"), f"{name}/{step.get('name')} 스텝 한도 없음"
    gate = jobs["weekly-gate"]
    assert set(gate["needs"]) == {"us-and-public", "kr-dart"} and "always()" in gate["if"]
    assert any((s.get("with") or {}).get("ref") == "main" for s in gate["steps"])
    assert any("--group weekly" in (s.get("run") or "") for s in gate["steps"])
    for job in ("us-and-public", "kr-dart"):
        runs = " ".join(s.get("run") or "" for s in jobs[job]["steps"])
        assert "--group weekly" not in runs                 # 관문은 weekly-gate 한 곳
    # 느린 세 DART 스텝 + 실적 이력은 시간 예산을 받는다
    for job, script in (("kr-dart", "build_kr_earnings.py"), ("kr-dart", "build_kr_ownership_profile.py"),
                        ("kr-dart", "build_kr_audit_opinion.py"), ("us-and-public", "earnings_history_store.py")):
        step = next(s for s in jobs[job]["steps"] if script in (s.get("run") or ""))
        assert "--time-budget-min" in step["run"], script


# ─────────────────────────── KR 가격 기준(KRX 종가) ───────────────────────────
def test_align_last_bar_to_krx_close():
    rows = [{"date": "2026-09-22", "open": 1, "high": 283500, "low": 271500, "close": 276500},
            {"date": "2026-09-23", "open": 282500, "high": 285500, "low": 280750, "close": 285500}]
    assert K.align_last_bar_to_close(rows, "2026-09-23", 286500.0)
    assert rows[-1]["close"] == 286500 and rows[-1]["high"] == 286500 and rows[-1]["low"] == 280750
    assert rows[0]["close"] == 276500                       # 이전 봉은 그대로
    rows2 = [{"date": "2026-09-22", "high": 10, "low": 5, "close": 8}]
    assert not K.align_last_bar_to_close(rows2, "2026-09-23", 9.0)   # 날짜가 다르면 봉을 만들지 않는다
    assert rows2[0]["close"] == 8
    assert not K.align_last_bar_to_close(rows, "2026-09-23", 286500.0)  # 이미 같으면 변화 없음


def test_listed_shares_from_naver_row():
    assert K.listed_shares_from({"marketValueRaw": str(442999903 * 33800), "closePriceRaw": "33800"}) == 442999903
    assert K.listed_shares_from({"marketValueRaw": "1000001", "closePriceRaw": "1000"}) is None   # 안 나눠떨어짐
    assert K.listed_shares_from({"marketValueRaw": "N/A", "closePriceRaw": "1000"}) is None
    assert K.listed_shares_from({}) is None


def test_fetch_market_page_keeps_krx_close_not_nxt(monkeypatch):
    item = {
        "itemCode": "005930", "stockName": "삼성전자", "stockEndType": "stock",
        "closePriceRaw": "286500", "closePrice": "286,500", "fluctuationsRatio": "3.62",
        "marketValueRaw": str(5846278608 * 286500), "accumulatedTradingVolumeRaw": "19385053",
        "accumulatedTradingValue": "5,504,265", "localTradedAt": "2026-09-23T20:20:21+09:00",
        "overMarketPriceInfo": {"tradingSessionType": "AFTER_MARKET", "overPriceRaw": "287000"},
    }
    monkeypatch.setattr(K, "fetch_mstock_json", lambda path: {"stocks": [item]})
    rows = K.fetch_market_page(0, 1)
    assert rows[0]["quotePrice"] == 286500 and rows[0]["listedShares"] == 5846278608
    assert rows[0]["quoteDate"] == "2026-09-23"
