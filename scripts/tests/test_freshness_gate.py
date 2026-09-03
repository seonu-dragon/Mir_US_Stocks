"""`check_data_freshness.py` — 마지막 관문의 관문.

빌더는 소스가 죽으면 "기존 파일 유지" 후 정상 종료하고, 워크플로우 스텝은
continue-on-error 다. 그래서 소스가 영구히 깨져도 Actions 는 영원히 초록이고
사이트의 updatedAtKst 만 조용히 늙는다. 이 게이트가 유일한 감시자이므로:

1. 늙은 파일에서 exit 1, 신선하면 exit 0.
2. 0건(`require_rows`)·비율 하한(`RATIO_CHECKS`)도 잡는다.
3. **워크플로우가 발행하는 모든 데이터 파일이 어느 그룹엔가 들어 있다.**
   3번이 없어서 2026-09-03 감사 때 9개 산출물이 아무 감시 없이 돌고 있었다.
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timedelta

import pytest
import yaml

import check_data_freshness as F
from conftest import ROOT, SCRIPTS


def _run(monkeypatch, tmp_path, group):
    monkeypatch.setattr(F, "ROOT", tmp_path)
    monkeypatch.setattr(sys, "argv", ["check_data_freshness.py", "--group", group])
    return F.main()


def _stamp(days_ago: int) -> str:
    return (datetime.now(F.KST).date() - timedelta(days=days_ago)).isoformat()


@pytest.fixture
def fake_group(monkeypatch):
    """CHECKS/RATIO_CHECKS 를 테스트용 그룹 하나로 바꾼다."""
    def _install(checks, ratios=None):
        monkeypatch.setattr(F, "CHECKS", {"t": checks})
        monkeypatch.setattr(F, "RATIO_CHECKS", {"t": ratios or []})
    return _install


def _write(tmp_path, rel, payload):
    path = tmp_path / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return path


def test_fresh_file_passes(monkeypatch, tmp_path, fake_group):
    fake_group([("data/a.json", 2, False)])
    _write(tmp_path, "data/a.json", {"updatedAtKst": f"{_stamp(0)} 09:00 KST", "count": 3})
    assert _run(monkeypatch, tmp_path, "t") == 0


def test_stale_file_fails(monkeypatch, tmp_path, fake_group):
    fake_group([("data/a.json", 2, False)])
    _write(tmp_path, "data/a.json", {"updatedAtKst": f"{_stamp(9)} 09:00 KST", "count": 3})
    assert _run(monkeypatch, tmp_path, "t") == 1


def test_missing_file_fails(monkeypatch, tmp_path, fake_group):
    fake_group([("data/a.json", 2, False)])
    assert _run(monkeypatch, tmp_path, "t") == 1


def test_missing_timestamp_fails(monkeypatch, tmp_path, fake_group):
    fake_group([("data/a.json", 2, False)])
    _write(tmp_path, "data/a.json", {"count": 3})
    assert _run(monkeypatch, tmp_path, "t") == 1


def test_corrupt_json_fails(monkeypatch, tmp_path, fake_group):
    fake_group([("data/a.json", 2, False)])
    path = tmp_path / "data" / "a.json"
    path.parent.mkdir(parents=True)
    path.write_text("{ 깨짐", encoding="utf-8")
    assert _run(monkeypatch, tmp_path, "t") == 1


def test_zero_rows_fails_when_require_rows(monkeypatch, tmp_path, fake_group):
    """DART 키가 없어 count=0 인데 신선하게 갱신되던 2026-07-22 함정."""
    fake_group([("data/a.json", 8, True)])
    _write(tmp_path, "data/a.json", {"updatedAtKst": f"{_stamp(0)} 09:00 KST", "count": 0})
    assert _run(monkeypatch, tmp_path, "t") == 1


def test_zero_rows_passes_when_not_required(monkeypatch, tmp_path, fake_group):
    fake_group([("data/a.json", 8, False)])
    _write(tmp_path, "data/a.json", {"updatedAtKst": f"{_stamp(0)} 09:00 KST", "count": 0})
    assert _run(monkeypatch, tmp_path, "t") == 0


def test_alternate_timestamp_keys_are_accepted(monkeypatch, tmp_path, fake_group):
    for key in F.TIMESTAMP_KEYS:
        fake_group([("data/a.json", 2, False)])
        _write(tmp_path, "data/a.json", {key: _stamp(0), "count": 1})
        assert _run(monkeypatch, tmp_path, "t") == 0, key


# --------------------------------------------------------------------------
# 비율 감시
# --------------------------------------------------------------------------

RATIO = ("data/a.json", ("historyCoverage", "ratio"), 0.5, "차트 커버리지")


def test_ratio_above_floor_passes(monkeypatch, tmp_path, fake_group):
    fake_group([], [RATIO])
    _write(tmp_path, "data/a.json", {"historyCoverage": {"ratio": 0.83}})
    assert _run(monkeypatch, tmp_path, "t") == 0


def test_ratio_below_floor_fails(monkeypatch, tmp_path, fake_group):
    """국내 상세 3,774 중 1,322 가 빈 차트였던 상태(=0.65 → 개편 후 0.35)를 잡는다."""
    fake_group([], [RATIO])
    _write(tmp_path, "data/a.json", {"historyCoverage": {"ratio": 0.35}})
    assert _run(monkeypatch, tmp_path, "t") == 1


def test_missing_ratio_key_fails(monkeypatch, tmp_path, fake_group):
    """지표가 사라지면(빌더 회귀) 조용히 통과하면 안 된다."""
    fake_group([], [RATIO])
    _write(tmp_path, "data/a.json", {"updatedAtKst": _stamp(0)})
    assert _run(monkeypatch, tmp_path, "t") == 1


def test_kr_group_watches_chart_coverage():
    """실제 설정: KR 그룹이 chartSeries 커버리지를 감시한다."""
    ratios = F.RATIO_CHECKS.get("kr") or []
    paths = {rel for rel, _, _, _ in ratios}
    assert "data/korea/market_snapshot.json" in paths
    keypaths = {keypath for _, keypath, _, _ in ratios}
    assert ("historyCoverage", "ratio") in keypaths


# --------------------------------------------------------------------------
# 워크플로우 산출물 커버리지 — 감시 밖 파일이 생기지 않게
# --------------------------------------------------------------------------

WORKFLOWS = sorted((ROOT / ".github" / "workflows").glob("*.yml"))

# 데이터를 커밋하지 않는 워크플로우(검사·배포·감시).
NOT_DATA_WORKFLOWS = {"ci.yml", "deploy-pages.yml", "pages-queue-watchdog.yml"}

# 감시 대상이 아닌 산출물과 그 이유. 늘리려면 이유를 함께 적을 것.
UNMONITORED_BY_DESIGN = {
    # 브리핑 텍스트는 market_snapshot 안에 들어가고, 그 스냅샷을 이미 감시한다.
    "data/market_snapshot.json": "us 그룹이 감시",
    # 5년 일봉 아카이브(주간). 스냅샷이 신선하면 이 파일도 같이 갱신된다.
    "data/history/market_history.json": "market_snapshot 과 같은 실행에서 갱신",
}


def _builder_modules_in(workflow_path):
    text = workflow_path.read_text(encoding="utf-8")
    names = set(re.findall(r"scripts/(\w+)\.py", text))
    return sorted(
        n for n in names
        if n.startswith(("build_", "update_", "collect_", "fetch_", "archive_"))
    )


def _declared_outputs(module_name):
    import importlib
    module = importlib.import_module(module_name)
    outs = []
    for attr in dir(module):
        if not attr.startswith("OUT") or attr.endswith("JS"):
            continue
        value = getattr(module, attr)
        if hasattr(value, "suffix") and value.suffix == ".json":
            try:
                outs.append(value.resolve().relative_to(ROOT).as_posix())
            except ValueError:
                continue
    return sorted(set(outs))


def test_workflow_yaml_all_parses():
    assert WORKFLOWS
    for path in WORKFLOWS:
        assert yaml.safe_load(path.read_text(encoding="utf-8")) is not None, path.name


def test_every_workflow_published_file_is_monitored():
    """워크플로우가 돌리는 빌더의 산출물이 전부 어느 CHECKS 그룹엔가 있어야 한다.

    2026-09-03 감사에서 이 검사가 없어 9개(insider/congress/material/activist/
    short_interest/sr_stats/kr disclosure_stats/13F 등)가 감시 밖이었다.
    """
    monitored = {rel for group in F.CHECKS.values() for rel, _, _ in group}
    gaps = []
    for workflow in WORKFLOWS:
        if workflow.name in NOT_DATA_WORKFLOWS:
            continue
        for module_name in _builder_modules_in(workflow):
            for rel in _declared_outputs(module_name):
                if rel in monitored or rel in UNMONITORED_BY_DESIGN:
                    continue
                gaps.append(f"{workflow.name} → {module_name} → {rel}")
    assert not gaps, (
        "감시 그룹에 없는 산출물:\n  " + "\n  ".join(sorted(set(gaps)))
        + "\n(check_data_freshness.py 의 CHECKS 에 넣거나, 이유와 함께 "
        "UNMONITORED_BY_DESIGN 에 등록할 것)"
    )


def test_every_monitored_path_is_under_data():
    for group, entries in F.CHECKS.items():
        for rel, max_age, require_rows in entries:
            assert rel.startswith("data/"), (group, rel)
            assert isinstance(max_age, int) and max_age > 0, (group, rel)
            assert isinstance(require_rows, bool), (group, rel)


def test_groups_have_no_duplicate_entries():
    for group, entries in F.CHECKS.items():
        paths = [rel for rel, _, _ in entries]
        assert len(paths) == len(set(paths)), f"{group} 그룹에 중복 항목"
