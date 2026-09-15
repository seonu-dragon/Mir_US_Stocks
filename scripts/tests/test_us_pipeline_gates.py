"""미국 파이프라인 안전장치(2026-09-15 감사 반영분).

여기서 검증하는 네 가지는 모두 "초록으로 끝났지만 실제로는 틀렸던" 경로다.

1. efts 페이지네이션 **partial 플래그** — 창을 다 못 받았는데 커서를 전진시키면
   빠진 공시를 영영 다시 보지 않는다.
2. 13F **ok 비율 하한** — 기관 절반이 error 여도 발행되던 것.
3. 신선도 감시의 **대체 건수 키** — 최상위 count 만 봐서 institutionCount /
   tradeCount / eventCount 가 0이어도 통과하던 것.
4. **ET 장마감 가드** — UTC 고정 크론이 서머타임과 어긋나 장중에 '마감' 산출물을
   만들던 것.
"""
from __future__ import annotations

import json
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

import sec_client as sec

ET = ZoneInfo("America/New_York")


# --------------------------------------------------------------------------
# 1. efts partial 플래그
# --------------------------------------------------------------------------

def _page(hits, total):
    return {"hits": {"hits": hits, "total": {"value": total}}}


def test_efts_hits_reports_complete_window(monkeypatch):
    calls = []

    def fake(url):
        calls.append(url)
        return _page([{"_id": "a:1"}, {"_id": "b:1"}], 2)

    monkeypatch.setattr(sec, "sec_get_json", fake)
    hits, partial = sec.efts_hits("8-K", "2026-09-01", "2026-09-01")
    assert len(hits) == 2
    assert partial is False
    assert len(calls) == 1


def test_efts_hits_flags_partial_on_mid_pagination_failure(monkeypatch):
    state = {"n": 0}

    def fake(url):
        state["n"] += 1
        if state["n"] == 1:
            return _page([{"_id": f"a{i}:1"} for i in range(10)], 40)
        raise RuntimeError("502 from efts")

    monkeypatch.setattr(sec, "sec_get_json", fake)
    monkeypatch.setattr(sec, "backoff_sleep", lambda *a, **k: 0)
    hits, partial = sec.efts_hits("8-K", "2026-09-01", "2026-09-01")
    assert len(hits) == 10          # 받은 만큼은 돌려준다
    assert partial is True          # 하지만 '완결'이라고 하지 않는다


def test_efts_hits_flags_partial_when_cap_reached(monkeypatch):
    def fake(url):
        return _page([{"_id": "x:1"}], 9999)

    monkeypatch.setattr(sec, "sec_get_json", fake)
    hits, partial = sec.efts_hits("8-K", "2026-09-01", "2026-09-01", cap=3)
    assert partial is True
    assert len(hits) == 3


def test_partial_window_must_not_advance_cursor():
    """호출부 규약: partial 이면 lastFileDate 를 전진시키지 않는다.

    build_ipo_calendar / build_us_dilution / build_material_events /
    build_insider_trades 가 같은 모양의 코드를 갖는다.
    """
    import re
    from conftest import SCRIPTS

    for name in ("build_ipo_calendar", "build_us_dilution",
                 "build_material_events", "build_insider_trades"):
        src = (SCRIPTS / f"{name}.py").read_text(encoding="utf-8")
        assert "partial" in src, f"{name}: partial 플래그를 받지 않는다"
        assert re.search(r"if partial and last", src), (
            f"{name}: partial 일 때 커서 고정 분기가 없다"
        )


# --------------------------------------------------------------------------
# 2. 13F ok 비율 하한
# --------------------------------------------------------------------------

def test_13f_threshold_is_declared():
    import build_13f_snapshot as b13f
    assert 0.5 <= b13f.MIN_OK_RATIO <= 0.95


def test_13f_registry_has_no_duplicate_ciks():
    from institutions_13f_registry import UNIQUE_INSTITUTIONS
    ciks = [row["cik"] for row in UNIQUE_INSTITUTIONS]
    assert len(ciks) == len(set(ciks)), "레지스트리에 중복 CIK 이 있다"
    ids = [row["id"] for row in UNIQUE_INSTITUTIONS]
    assert len(ids) == len(set(ids)), "레지스트리에 중복 id 가 있다"
    assert len(ciks) >= 100


def test_13f_registry_rejects_duplicate_cik():
    import institutions_13f_registry as reg
    rows = [
        {"id": "a", "name": "A", "manager": "", "cik": "1067983"},
        {"id": "b", "name": "B", "manager": "", "cik": "0001067983"},
    ]
    with pytest.raises(ValueError):
        reg._assert_unique(rows)


def test_13f_carries_previous_quarters_for_failed_institution(tmp_path, monkeypatch):
    import build_13f_snapshot as b13f

    prev = {
        "institutions": [
            {"id": "x", "name": "X", "cik": "0000000001",
             "status": "ok", "reportDate": "2026-06-30",
             "holdings": [{"issuer": "AAA"}], "quarters": [{"reportDate": "2026-06-30"}]},
        ]
    }
    out = tmp_path / "institutional_13f.json"
    out.write_text(json.dumps(prev), encoding="utf-8")
    monkeypatch.setattr(b13f, "OUT_JSON", out)
    monkeypatch.setattr(b13f, "UNIQUE_INSTITUTIONS",
                        [{"id": "x", "name": "X", "manager": "", "cik": "0000000001"}])
    monkeypatch.setattr(b13f, "institution_quarters",
                        lambda cik, quarters=10: (_ for _ in ()).throw(RuntimeError("down")))
    monkeypatch.setattr(b13f.time, "sleep", lambda *_a, **_k: None)

    payload, ok, total = b13f.build_payload(1, 4)
    assert ok == 0 and total == 1
    row = payload["institutions"][0]
    assert row["status"] == "carried"
    assert row["holdings"] == [{"issuer": "AAA"}]   # 직전 분기를 유지한다
    assert payload["carriedCount"] == 1


# --------------------------------------------------------------------------
# 3. 신선도 감시 require_rows 대체 키
# --------------------------------------------------------------------------

@pytest.mark.parametrize("key", ["count", "institutionCount", "tradeCount", "eventCount"])
def test_require_rows_catches_zero_on_alternate_count_keys(tmp_path, monkeypatch, capsys, key):
    import check_data_freshness as gate

    today = datetime.now(gate.KST).strftime("%Y-%m-%d")
    rel = "data/probe.json"
    path = tmp_path / "data" / "probe.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"updatedAtKst": today, key: 0}), encoding="utf-8")

    monkeypatch.setattr(gate, "ROOT", tmp_path)
    monkeypatch.setattr(gate, "CHECKS", {"probe": [(rel, 5, True)]})
    monkeypatch.setattr(gate, "RATIO_CHECKS", {})
    monkeypatch.setattr("sys.argv", ["check_data_freshness.py", "--group", "probe"])
    assert gate.main() == 1
    assert "0건" in capsys.readouterr().out


def test_require_rows_passes_with_nonzero_alternate_key(tmp_path, monkeypatch):
    import check_data_freshness as gate

    today = datetime.now(gate.KST).strftime("%Y-%m-%d")
    path = tmp_path / "data" / "probe.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"updatedAtKst": today, "eventCount": 12}), encoding="utf-8")

    monkeypatch.setattr(gate, "ROOT", tmp_path)
    monkeypatch.setattr(gate, "CHECKS", {"probe": [("data/probe.json", 5, True)]})
    monkeypatch.setattr(gate, "RATIO_CHECKS", {})
    monkeypatch.setattr("sys.argv", ["check_data_freshness.py", "--group", "probe"])
    assert gate.main() == 0


def test_require_rows_flags_missing_count_key(tmp_path, monkeypatch, capsys):
    import check_data_freshness as gate

    today = datetime.now(gate.KST).strftime("%Y-%m-%d")
    path = tmp_path / "data" / "probe.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"updatedAtKst": today, "rows": []}), encoding="utf-8")

    monkeypatch.setattr(gate, "ROOT", tmp_path)
    monkeypatch.setattr(gate, "CHECKS", {"probe": [("data/probe.json", 5, True)]})
    monkeypatch.setattr(gate, "RATIO_CHECKS", {})
    monkeypatch.setattr("sys.argv", ["check_data_freshness.py", "--group", "probe"])
    assert gate.main() == 1
    assert "건수 키 없음" in capsys.readouterr().out


def test_white_house_group_watches_event_count():
    import check_data_freshness as gate
    entries = dict((rel, (age, rows)) for rel, age, rows in gate.CHECKS["white-house"])
    assert entries["data/white_house_schedule.json"][1] is True


# --------------------------------------------------------------------------
# 4. ET 장마감 가드
# --------------------------------------------------------------------------

def test_market_close_guard_blocks_intraday_weekday():
    # 2026-01-14(수) 15:05 ET = EST 겨울, 마감 55분 전 — 예전 크론이 여기 있었다.
    now = datetime(2026, 1, 14, 15, 5, tzinfo=ET)
    with pytest.raises(SystemExit) as exc:
        sec.require_us_market_closed("테스트", now=now)
    assert "마감" in str(exc.value)


def test_market_close_guard_allows_after_close():
    now = datetime(2026, 1, 14, 16, 34, tzinfo=ET)
    assert sec.require_us_market_closed("테스트", now=now) is not None


def test_market_close_guard_allows_weekend_morning():
    now = datetime(2026, 1, 17, 9, 0, tzinfo=ET)  # 토요일
    assert sec.require_us_market_closed("테스트", now=now) is not None


def test_market_close_guard_summer_and_winter_cron_slots():
    """21:05 / 21:30 / 21:34 UTC 가 EDT·EST 양쪽에서 마감 뒤인지."""
    from datetime import timezone
    for month, day in ((7, 15), (1, 14)):     # EDT 여름 / EST 겨울
        for hh, mm in ((21, 5), (21, 30), (21, 34)):
            utc = datetime(2026, month, day, hh, mm, tzinfo=timezone.utc)
            assert sec.require_us_market_closed("cron", now=utc) is not None


def test_us_close_pipelines_call_the_guard():
    from conftest import SCRIPTS
    for rel in ("update_data.py", "briefings/us_close/main.py"):
        src = (SCRIPTS / rel).read_text(encoding="utf-8")
        assert "require_us_market_closed" in src, f"{rel}: ET 가드 호출이 없다"
