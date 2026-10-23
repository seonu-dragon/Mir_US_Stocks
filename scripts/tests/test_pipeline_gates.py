"""2026-10-23 파이프라인 관문 보강 — 실패한 수집이 초록으로 지나가지 않게.

1. KR 일봉 야후 폴백 비율(check_kr_bars_source)
2. KR 가격 기준일 vs XKRX 마지막 완료 거래일(kr_price_session + update_korea_data 발행 전 관문)
3. DART 키 누락 → Actions 에선 exit 1 · 기존 파일 유지(dart_key_missing + 각 빌더)
4. 미국 실적 이력 실패 비율(check_earnings_history_failures) + 워크플로우 잡 실패 스텝
5. KR 22:00 백업의 데이터셋별 재실행 계획(kr_backup_plan)
6. 큰 등락일 뉴스 lastSearchAtKst(build_moment_news) + 신선도 관문이 그 키로 나이를 잰다
7. 나라장터·관세청 신선도 임계
"""
from __future__ import annotations

import json
import sys
from datetime import date, datetime, timedelta

import pytest
import yaml

import check_data_freshness as F
import kr_backup_plan as BP
import kr_price_session as KPS
from conftest import ROOT, SCRIPTS

KST = KPS.KST


def _cal(holidays=()):
    """주말 + 지정 휴장일만 쉬는 가짜 XKRX 달력."""
    hol = {date.fromisoformat(h) for h in holidays}

    def is_trading(day: date):
        return day.weekday() < 5 and day not in hol

    return is_trading


# ── 1. 일봉 원천 ─────────────────────────────────────────────────────────

def _snap_bars(naver, yahoo):
    return {"historyCoverage": {"barsSource": {"naver": naver, "yahoo": yahoo}}}


def test_bars_source_normal_share_passes():
    problems, oks = F.check_kr_bars_source(_snap_bars(3353, 444))   # 2026-10-22 실측 ≈ 11.7%
    assert problems == [] and "11.7%" in oks[0]


def test_bars_source_mass_yahoo_fallback_fails():
    problems, _ = F.check_kr_bars_source(_snap_bars(1000, 2797))
    assert problems and "야후 폴백" in problems[0] and "35%" in problems[0]


def test_bars_source_missing_or_empty_fails():
    assert F.check_kr_bars_source({})[0]
    assert F.check_kr_bars_source(_snap_bars(0, 0))[0]


# ── 2. KR 가격 기준일 ─────────────────────────────────────────────────────

def test_last_completed_kr_session_before_and_after_close():
    cal = _cal()
    fri = date(2026, 10, 23)
    assert KPS.last_completed_kr_session(datetime(2026, 10, 23, 15, 0, tzinfo=KST), cal) == date(2026, 10, 22)
    assert KPS.last_completed_kr_session(datetime(2026, 10, 23, 15, 45, tzinfo=KST), cal) == fri
    # 주말엔 금요일
    assert KPS.last_completed_kr_session(datetime(2026, 10, 25, 10, 0, tzinfo=KST), cal) == fri


def test_last_completed_kr_session_skips_holidays():
    cal = _cal(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-09"])   # 추석·한글날
    now = datetime(2026, 10, 9, 18, 0, tzinfo=KST)
    assert KPS.last_completed_kr_session(now, cal) == date(2026, 10, 8)


def test_last_completed_kr_session_unknown_calendar():
    assert KPS.last_completed_kr_session(datetime(2026, 10, 23, 18, 0, tzinfo=KST), lambda d: None) is None


def _stocks(n_ok, n_stale, n_undated=0, ok="2026-10-23", stale="2026-10-22"):
    return ([{"priceDate": ok}] * n_ok + [{"priceDate": stale}] * n_stale + [{}] * n_undated)


def test_evaluate_session_all_on_reference_passes():
    problem, summary = KPS.evaluate_kr_price_session(_stocks(3819, 0), date(2026, 10, 23))
    assert problem is None and "0.0%" in summary


def test_evaluate_session_stale_list_fails():
    problem, _ = KPS.evaluate_kr_price_session(_stocks(0, 3819), date(2026, 10, 23))
    assert problem and "2026-10-22 3819" in problem


def test_evaluate_session_one_market_stale_fails_and_few_halts_pass():
    # 코스닥 목록만 멈춘 날(~46%) 은 잡고, 소수 이상(1%)은 통과
    assert KPS.evaluate_kr_price_session(_stocks(2059, 1760), date(2026, 10, 23))[0]
    assert KPS.evaluate_kr_price_session(_stocks(3780, 39), date(2026, 10, 23))[0] is None


def test_evaluate_session_undated_counts_and_empty_fails():
    assert KPS.evaluate_kr_price_session(_stocks(100, 0, 400), date(2026, 10, 23))[0]
    assert KPS.evaluate_kr_price_session([], date(2026, 10, 23))[0]


def test_evaluate_session_newer_dates_pass():
    # 장중 실행(기준일보다 새 날짜)은 밀림이 아니다
    assert KPS.evaluate_kr_price_session(_stocks(10, 0, ok="2026-10-24"), date(2026, 10, 23))[0] is None


def test_check_kr_price_session_wraps_problem_and_warns_without_calendar():
    payload = {"stocks": _stocks(0, 50)}
    after_close = datetime(2026, 10, 23, 16, 30, tzinfo=KST)
    problems, _ = F.check_kr_price_session(payload, after_close, _cal())
    assert problems and problems[0].startswith(F.KR_SNAPSHOT)
    problems, oks = F.check_kr_price_session(payload, after_close, lambda d: None)
    assert problems == [] and oks[0].startswith("WARN")


def test_update_korea_guard_blocks_stale_snapshot(monkeypatch):
    import update_korea_data as U

    monkeypatch.delenv("KR_ALLOW_STALE_SESSION", raising=False)
    after_close = datetime(2026, 10, 23, 16, 30, tzinfo=KST)
    with pytest.raises(SystemExit) as exc:
        U.guard_price_session({"stocks": _stocks(0, 100)}, after_close, _cal())
    assert "기존 스냅샷을 덮지 않는다" in str(exc.value)
    U.guard_price_session({"stocks": _stocks(100, 0)}, after_close, _cal())   # 정상 = 통과
    monkeypatch.setenv("KR_ALLOW_STALE_SESSION", "1")
    U.guard_price_session({"stocks": _stocks(0, 100)}, after_close, _cal())   # 수동 우회


def test_kr_group_runs_session_and_bars_checks(monkeypatch, tmp_path):
    """kr 그룹 main 이 스냅샷 원천·기준일 관문을 실제로 부른다(나머지 파일 검사는 비운다)."""
    monkeypatch.setattr(F, "CHECKS", {"kr": []})
    monkeypatch.setattr(F, "RATIO_CHECKS", {})
    monkeypatch.setattr(F, "MIN_CHECKS", {})
    monkeypatch.setattr(F, "ROOT", tmp_path)
    snap = tmp_path / F.KR_SNAPSHOT
    snap.parent.mkdir(parents=True)
    snap.write_text(json.dumps({**_snap_bars(100, 900), "stocks": []}), encoding="utf-8")
    monkeypatch.setattr(sys, "argv", ["x", "--group", "kr"])
    assert F.main() == 1
    snap.write_text(json.dumps({**_snap_bars(900, 100), "stocks": []}), encoding="utf-8")
    # 달력을 모르는 환경(=WARN)으로 고정해 원천 검사만 남긴다
    monkeypatch.setattr(KPS, "xkrx_is_trading", lambda: None)
    assert F.main() == 0


# ── 3. DART 키 누락 ───────────────────────────────────────────────────────

DART_KEY_BUILDERS = [
    "build_kr_audit_opinion",
    "build_kr_cb_overhang",
    "build_kr_disclosures",
    "build_kr_earnings",
    "build_kr_event_details",
    "build_kr_financials_history",
    "build_kr_indicators",
    "build_kr_ownership",
    "build_kr_ownership_profile",
    "build_kr_fin_safety",
    "build_kr_major_holders",
    "build_kr_stake_value",
]


def test_dart_key_missing_exit_code(monkeypatch):
    import build_kr_disclosures as D

    monkeypatch.setenv("GITHUB_ACTIONS", "true")
    assert D.dart_key_missing("t") == 1
    monkeypatch.delenv("GITHUB_ACTIONS")
    assert D.dart_key_missing("t") == 0


@pytest.mark.parametrize("name", DART_KEY_BUILDERS)
def test_dart_builders_do_not_overwrite_without_key(name, monkeypatch, tmp_path):
    """키가 없으면 어떤 파일도 쓰지 않고, Actions 에선 exit 1."""
    import importlib

    mod = importlib.import_module(name)
    writes = []
    import briefing_store
    import sec_client

    def _no_write(*a, **k):
        writes.append(a[0] if a else k)
        raise AssertionError(f"{name}: 키 없이 파일을 썼다 {a[:1]}")

    for target in (mod, briefing_store, sec_client):
        for attr in ("atomic_write_text", "write_data", "write_outputs"):
            if hasattr(target, attr):
                monkeypatch.setattr(target, attr, _no_write)
    monkeypatch.delenv("DART_API_KEY", raising=False)
    monkeypatch.setenv("GITHUB_ACTIONS", "true")
    monkeypatch.setattr(sys, "argv", [name])
    assert mod.main() == 1
    assert writes == []


def test_financials_kr_exits_nonzero_in_actions_without_key(monkeypatch):
    import build_financials_kr as FK

    monkeypatch.delenv("DART_API_KEY", raising=False)
    monkeypatch.setenv("GITHUB_ACTIONS", "true")
    monkeypatch.setattr(sys, "argv", ["build_financials_kr.py"])
    assert FK.main() == 1


# ── 4. 미국 실적 이력 실패 비율 ───────────────────────────────────────────

def test_earnings_history_ratio_matches_builder():
    import earnings_history_store as E

    assert F.EARNINGS_HISTORY_MAX_FAILED_RATIO == E.MAX_FAILED_RATIO


def test_earnings_history_failures():
    assert F.check_earnings_history_failures({"updated": 0, "failed": 0})[0] == []
    assert F.check_earnings_history_failures({"updated": 90, "failed": 10})[0] == []
    problems, _ = F.check_earnings_history_failures({"updated": 70, "failed": 30})
    assert problems and "30/100" in problems[0]


def test_weekly_gate_reads_earnings_failures(monkeypatch, tmp_path):
    fresh = datetime.now(F.KST).strftime("%Y-%m-%d %H:%M KST")
    for rel, _age, _rows in F.CHECKS["weekly"]:
        p = tmp_path / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps({"updatedAtKst": fresh, "count": 5}), encoding="utf-8")
    meta = tmp_path / F.EARNINGS_HISTORY_META
    meta.write_text(json.dumps({"updatedAtKst": fresh, "updated": 10, "failed": 90}), encoding="utf-8")
    monkeypatch.setattr(F, "ROOT", tmp_path)
    monkeypatch.setattr(sys, "argv", ["x", "--group", "weekly"])
    assert F.main() == 1
    # us-and-public 잡이 안 돈 run 이면 그 meta 는 보지 않는다
    monkeypatch.setattr(sys, "argv", ["x", "--group", "weekly", "--skip-jobs", "us-and-public"])
    assert F.main() == 0


def _wf(name):
    return yaml.safe_load((ROOT / ".github" / "workflows" / name).read_text(encoding="utf-8"))


def test_weekly_workflow_fails_job_when_earnings_step_fails():
    steps = _wf("weekly-earnings-history.yml")["jobs"]["us-and-public"]["steps"]
    names = [s.get("name") for s in steps]
    i = names.index("Incremental earnings history refresh")
    assert steps[i].get("id") == "earnings_history" and steps[i].get("continue-on-error") is True
    gate = next(s for s in steps[i + 1:] if "earnings_history.outcome" in str(s.get("if", "")))
    assert "exit 1" in gate["run"]
    # 텔레그램 통지(failure())보다 앞이어야 울린다
    assert names.index(gate["name"]) < names.index("Notify failure (Telegram)")


# ── 5. KR 22:00 백업 계획 ─────────────────────────────────────────────────

T = "2026-10-23"


def test_backup_plan_all_fresh_is_noop():
    run = BP.plan({k: T for k in BP.DATASETS}, T, guarded=True)
    assert not run["any"] and not any(run[k] for k in BP.DATASETS)


def test_backup_plan_reruns_only_failed_datasets():
    stamps = {"snapshot": T, "flow": "2026-10-22", "funds": T, "breadth": ""}
    run = BP.plan(stamps, T, guarded=True)
    assert run == {"snapshot": False, "flow": True, "funds": False, "breadth": True, "any": True}


def test_backup_plan_stale_snapshot_reruns_everything_and_manual_runs_all():
    run = BP.plan({"snapshot": "2026-10-22", "flow": T, "funds": T, "breadth": T}, T, guarded=True)
    assert all(run.values())
    assert all(BP.plan({k: T for k in BP.DATASETS}, T, guarded=False).values())


def test_backup_workflow_uses_per_dataset_outputs():
    steps = _wf("daily-korea-market-snapshot.yml")["jobs"]["update"]["steps"]
    by_name = {s.get("name"): s for s in steps}
    assert "kr_backup_plan.py" in by_name["Freshness guard (per-dataset)"]["run"]
    assert by_name["Update Korea market snapshot"]["if"] == "steps.guard.outputs.snapshot == 'true'"
    assert by_name["Build KR investor flow + consensus"]["if"] == "steps.guard.outputs.flow == 'true'"
    assert by_name["Build KR market funds"]["if"] == "steps.guard.outputs.funds == 'true'"
    assert by_name["Build market breadth (KR)"]["if"] == "steps.guard.outputs.breadth == 'true'"
    assert by_name["Check data freshness (KR)"]["if"] == "steps.guard.outputs.any == 'true'"
    assert not any("outputs.fresh" in str(s.get("if", "")) for s in steps)


def test_backup_plan_files_exist_in_repo():
    for rel in BP.DATASETS.values():
        assert (ROOT / rel).exists(), rel


# ── 6. 큰 등락일 뉴스 lastSearchAtKst ─────────────────────────────────────

def test_moment_search_stamp():
    import build_moment_news as b

    now = "2026-10-23 12:40 KST"
    prev = {"lastSearchAtKst": "2026-10-20 12:40 KST"}
    assert b.search_stamp({"askedThisRun": 5, "pending": 10, "blocked": True}, prev, now) == now
    assert b.search_stamp({"askedThisRun": 0, "pending": 10, "blocked": True}, prev, now) == prev["lastSearchAtKst"]
    assert b.search_stamp({"askedThisRun": 0, "pending": 0, "blocked": False}, prev, now) == now   # 밀린 게 없음
    assert b.search_stamp({"askedThisRun": 0, "pending": 3, "blocked": False, "timedOut": True}, {}, now) is None


def test_moment_index_last_search_is_oldest_market():
    import build_moment_news as b

    assert b.index_last_search({"us": {"lastSearchAtKst": "2026-10-23 12:40 KST"},
                                "kr": {"lastSearchAtKst": "2026-10-19 12:40 KST"}}) == "2026-10-19 12:40 KST"
    assert b.index_last_search({"us": {"lastSearchAtKst": "2026-10-23 12:40 KST"}, "kr": {}}) is None


def test_freshness_measures_moment_news_by_last_search(monkeypatch, tmp_path):
    rel = "data/moment_news/index.json"
    assert F.STAMP_KEY_OF[rel] == ("lastSearchAtKst",)
    monkeypatch.setattr(F, "CHECKS", {"t": [(rel, 3, False)]})
    monkeypatch.setattr(F, "RATIO_CHECKS", {})
    monkeypatch.setattr(F, "MIN_CHECKS", {})
    monkeypatch.setattr(F, "ROOT", tmp_path)
    monkeypatch.setattr(sys, "argv", ["x", "--group", "t"])
    p = tmp_path / rel
    p.parent.mkdir(parents=True)
    today = datetime.now(F.KST)
    old = (today - timedelta(days=5)).strftime("%Y-%m-%d %H:%M KST")
    now = today.strftime("%Y-%m-%d %H:%M KST")
    # 막힌 실행이 updatedAtKst 를 오늘로 올려도 마지막 검색이 5일 전이면 실패
    p.write_text(json.dumps({"updatedAtKst": now, "lastSearchAtKst": old}), encoding="utf-8")
    assert F.main() == 1
    p.write_text(json.dumps({"updatedAtKst": now}), encoding="utf-8")       # 키 없음 = 실패
    assert F.main() == 1
    p.write_text(json.dumps({"updatedAtKst": old, "lastSearchAtKst": now}), encoding="utf-8")
    assert F.main() == 0


# ── 7. 나라장터·관세청 ───────────────────────────────────────────────────

def test_gov_and_trade_thresholds_tight():
    ages = {rel: age for rel, age, _r in F.CHECKS["kr"]}
    assert ages["data/korea/gov_contracts.json"] <= 3
    assert ages["data/korea/trade_exports.json"] <= 3


@pytest.mark.parametrize("name", ["build_kr_gov_contracts", "build_kr_trade_exports"])
def test_gov_trade_builders_exit_nonzero_without_key(name, monkeypatch):
    import importlib

    mod = importlib.import_module(name)
    monkeypatch.delenv("DATA_GO_KR_KEY", raising=False)
    monkeypatch.setattr(sys, "argv", [name])
    assert mod.main() == 1
