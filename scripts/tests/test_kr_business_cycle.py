"""build_kr_ecos_macro 의 경기순환시계(businessCycle) 오프라인 테스트(네트워크 없음).

- 사분면 판정: 추세(100) 위·아래 × 전월 대비 오름·내림 → 상승·둔화·하강·회복.
- 변화 0 은 직전 방향을 잇고, 직전 방향이 없으면 판정하지 않는다.
- ECOS StatisticSearch 페이지 넘김(샘플 키 10행 제한)과 '데이터 없음' 응답.
- 동행 순환변동치가 없으면 블록을 만들지 않는다(지어내지 않음).
"""
from __future__ import annotations

import io
import json
import re

import build_kr_ecos_macro as ec


def test_classify_phase_quadrants():
    assert ec.classify_phase(101.2, 0.5) == ("상승", 1)
    assert ec.classify_phase(101.2, -0.1) == ("둔화", -1)
    assert ec.classify_phase(99.1, -0.3) == ("하강", -1)
    assert ec.classify_phase(99.1, 0.2) == ("회복", 1)
    # 수준 100 은 추세 위
    assert ec.classify_phase(100.0, 0.1) == ("상승", 1)
    assert ec.classify_phase(100.0, -0.1) == ("둔화", -1)


def test_classify_phase_flat_change_keeps_previous_direction():
    assert ec.classify_phase(99.5, 0.0, prev_dir=1) == ("회복", 1)
    assert ec.classify_phase(101.0, 0.0, prev_dir=-1) == ("둔화", -1)
    assert ec.classify_phase(101.0, 0.0) == (None, None)


def test_cycle_points_drops_first_month_and_trims():
    series = [("202601", 99.1), ("202602", 99.1), ("202603", 99.7), ("202604", 100.3), ("202605", 99.9)]
    pts = ec.cycle_points(series, months=24)
    assert [p["t"] for p in pts] == ["2026-02", "2026-03", "2026-04", "2026-05"]
    assert pts[0] == {"t": "2026-02", "v": 99.1, "chg": 0.0, "phase": None}   # 첫 변화 0 · 직전 방향 없음
    assert [p["phase"] for p in pts[1:]] == ["회복", "상승", "하강"]
    assert pts[1]["chg"] == 0.6
    assert len(ec.cycle_points(series, months=2)) == 2


def _fake_ecos(rows_by_item, cap=10):
    calls = []

    def urlopen(req, timeout=30):
        url = req.full_url
        calls.append(url)
        m = re.search(r"/kr/(\d+)/(\d+)/901Y067/M/\d+/\d+/(\w+)$", url)
        lo, hi, item = int(m.group(1)), int(m.group(2)), m.group(3)
        rows = rows_by_item.get(item, [])
        if not rows:
            body = {"RESULT": {"CODE": "INFO-200", "MESSAGE": "해당하는 데이터가 없습니다."}}
        else:
            hi = min(hi, lo + cap - 1)
            page = rows[lo - 1:hi]
            body = {"StatisticSearch": {"list_total_count": len(rows),
                                        "row": [{"TIME": t, "DATA_VALUE": str(v)} for t, v in page]}}
        return io.BytesIO(json.dumps(body, ensure_ascii=False).encode("utf-8"))

    return urlopen, calls


def test_fetch_rows_paged_walks_pages(monkeypatch):
    rows = [(f"2025{m:02d}", 99 + m / 10) for m in range(1, 13)] + [(f"2026{m:02d}", 100 + m / 10) for m in range(1, 9)]
    urlopen, calls = _fake_ecos({"I16D": rows})
    monkeypatch.setattr(ec.urllib.request, "urlopen", urlopen)
    out = ec.fetch_rows_paged("sample", "901Y067", "M", "202501", "202608", "I16D", page=10)
    assert out == sorted(rows)
    assert len(calls) == 2 and "/kr/1/10/" in calls[0] and "/kr/11/20/" in calls[1]


def test_fetch_rows_paged_no_data(monkeypatch):
    urlopen, _ = _fake_ecos({})
    monkeypatch.setattr(ec.urllib.request, "urlopen", urlopen)
    assert ec.fetch_rows_paged("k", "901Y067", "M", "202501", "202608", "I16D") == []


def test_build_business_cycle_block(monkeypatch):
    rows = [(f"{2023 + (i // 12)}{i % 12 + 1:02d}", 99 + (i % 7) / 10) for i in range(40)]
    urlopen, _ = _fake_ecos({"I16D": rows, "I16E": rows[:-1]}, cap=1000)
    monkeypatch.setattr(ec.urllib.request, "urlopen", urlopen)
    blk = ec.build_business_cycle("k")
    assert blk["stat"] == "901Y067"
    assert set(blk["series"]) == {"coincident", "leading"}
    assert len(blk["series"]["coincident"]["points"]) == ec.CYCLE_MONTHS
    assert blk["asOf"] == blk["series"]["coincident"]["points"][-1]["t"]
    assert blk["series"]["leading"]["points"][-1]["t"] < blk["asOf"]


def test_build_business_cycle_hidden_without_coincident(monkeypatch):
    rows = [(f"2025{m:02d}", 100.0 + m / 10) for m in range(1, 13)]
    urlopen, _ = _fake_ecos({"I16E": rows}, cap=1000)
    monkeypatch.setattr(ec.urllib.request, "urlopen", urlopen)
    assert ec.build_business_cycle("k") is None
