"""build_macro_odds 의 오프라인 규칙 테스트(네트워크 없음).

- 두 거래소의 결과 표기를 같은 코드로 묶는지(금리 결정 5단계, CPI 행사가).
- 확률 표시값 규칙(스프레드 5%p 이하면 중간값, 아니면 최근 체결가).
- 침체 신호가 합성 점수 없이 임계 비교만 하고, 공인 임계 없는 지표는 개수에서 빠지는지.
- 유동성 미달 이벤트는 표시 대신 excluded 로 가는지.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

import build_macro_odds as mo


def test_rate_outcome_codes_across_venues():
    cases = {
        "Fed maintains rate": "hold", "No change": "hold", "Maintain current rate": "hold",
        "Cut 25bps": "cut", "25 bps decrease": "cut", "Cut 1-25bps": "cut",
        "Cut >25bps": "cut_big", "50+ bps decrease": "cut_big", "Cut more than 25bps": "cut_big",
        "Hike 25bps": "hike", "25 bps increase": "hike", "Hike 1-25bps": "hike",
        "Hike >25bps": "hike_big", "50+ bps increase": "hike_big",
    }
    for label, code in cases.items():
        assert mo.rate_outcome_code(label) == code, label


def test_cpi_strike_kinds():
    assert mo.cpi_strike("Above 3.7%") == (3.7, "above")
    assert mo.cpi_strike("3.6%") == (3.6, "exact")
    assert mo.cpi_label(3.6, "exact") == "정확히 3.6%"
    assert mo.cpi_label(3.7, "above") == "3.7% 초과"


def test_pick_price_prefers_tight_mid():
    assert mo.pick_price(0.96, 0.97, 0.88) == 0.965   # 체결가가 낡았으면 호가 중간값
    assert mo.pick_price(0.10, 0.50, 0.30) == 0.30    # 스프레드가 넓으면 체결가
    assert mo.pick_price(None, None, 0.2) == 0.2


def _industry(tmp_path, **vals):
    inds = {}
    for iid, (latest, series) in vals.items():
        inds[iid] = {"id": iid, "unit": "%p", "latest_value": latest, "latest_date": series[-1]["date"],
                     "series": series, "source": "FRED", "source_url": "https://fred.stlouisfed.org"}
    p = tmp_path / "industry_indicators.json"
    p.write_text(json.dumps({"updatedAtKst": "2026-09-25 09:01 KST", "indicators": inds}), encoding="utf-8")
    return p


def test_recession_signals_no_composite(tmp_path, monkeypatch):
    s = lambda *v: [{"date": f"2026-0{i + 1}", "val": x} for i, x in enumerate(v)]  # noqa: E731
    path = _industry(
        tmp_path,
        sahm_rule=(0.6, s(0.4, 0.5, 0.6)),            # 0.50 이상 → 초과
        t10y3m=(-0.2, s(0.1, 0.0, -0.2)),             # 0 미만 → 초과
        t10y2y=(0.3, s(0.2, 0.25, 0.3)),              # 미만 아님
        cfnai=(-0.9, s(-0.5, -0.8, -0.9)),            # MA3 = −0.73 → 초과
        gz_recession_prob=(0.108, s(0.09, 0.1, 0.108)),  # 임계 없음 → 판정 제외
    )
    monkeypatch.setattr(mo, "INDUSTRY_JSON", path)
    rec = mo.build_recession_signals()
    by = {r["id"]: r for r in rec["indicators"]}
    assert by["sahm_rule"]["breached"] is True
    assert by["t10y3m"]["breached"] is True
    assert by["t10y2y"]["breached"] is False
    assert by["cfnai_ma3"]["value"] == -0.73 and by["cfnai_ma3"]["breached"] is True
    assert by["gz_recession_prob"]["breached"] is None and by["gz_recession_prob"]["value"] == 10.8
    assert rec["evaluated"] == 4 and rec["breached"] == 3
    assert "score" not in rec  # 합성 점수 금지


def test_kalshi_thin_event_goes_to_excluded(monkeypatch):
    now = datetime(2026, 9, 25, tzinfo=timezone.utc)
    markets = [{"event_ticker": "KXCBDECISIONKOREA-26OCT21", "ticker": "X-HOLD", "title": "BoK hold?",
                "yes_sub_title": "Maintain current rate", "close_time": "2026-10-22T00:59:00Z",
                "open_interest_fp": "985", "volume_fp": "1780", "last_price_dollars": "0.29"}]
    monkeypatch.setattr(mo, "kalshi_open_markets", lambda st: markets)
    series = [{"ticker": "KXCBDECISIONKOREA", "title": "Bank Of KOREA policy interest rate decision", "tags": []}]
    excluded = []
    assert mo.kalshi_topic("bok", series, now, excluded) is None
    assert excluded and "유동성 부족" in excluded[0]["reason"]
