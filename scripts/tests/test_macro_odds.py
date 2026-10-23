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


# ---------------------------------------------------------------------------
# 2026-10-23 — SEP 경로 · Big Four · 뉴욕연은 침체확률 · CMDI (네트워크 없음)
def test_parse_fred_csv_rejects_html_and_dots():
    assert mo.parse_fred_csv("<html>nope</html>") == []
    rows = mo.parse_fred_csv("observation_date,FEDTARMD\n2026-01-01,4.1\n2027-01-01,.\n2028-01-01,3.9\n")
    assert rows == [("2026-01-01", 4.1), ("2028-01-01", 3.9)]


def _sep_series(first_year="2026"):
    y = int(first_year)
    ann = lambda *v: [(f"{y + i}-01-01", x) for i, x in enumerate(v)]  # noqa: E731
    return {
        "FEDTARMD": ann(4.1, 4.1, 3.9), "FEDTARRL": ann(3.9, 3.1, 3.1), "FEDTARRH": ann(4.4, 4.4, 4.1),
        "FEDTARCTL": ann(4.1, 3.6, 3.1), "FEDTARCTH": ann(4.4, 4.4, 4.1),
        "FEDTARMDLR": [("2026-06-17", 3.1), ("2026-09-16", 3.2)],
        "FEDTARCTLLR": [("2026-09-16", 3.0)], "FEDTARCTHLR": [("2026-09-16", 3.6)],
        "FEDTARRLLR": [("2026-06-17", 2.9)],  # 이번 SEP 값이 아직 없다 → 장기 범위 하단은 비운다
        "DFEDTARU": [("2026-10-22", 4.0)], "DFEDTARL": [("2026-10-22", 3.75)],
    }


def test_fed_path_sep_vs_current_vs_market():
    fomc = [{"venue": "Kalshi", "eventDate": "2026-10-28", "outcomes": [
        {"code": "cut", "label": "0.25%p 인하", "prob": 0.2}, {"code": "hold", "label": "동결", "prob": 0.75},
        {"code": "hike", "label": "0.25%p 인상", "prob": 0.05}]},
        {"venue": "Polymarket", "outcomes": [{"code": "cut_big", "label": "0.5%p 이상 인하", "prob": 0.6},
                                             {"code": "hold", "label": "동결", "prob": 0.4}]}]
    fp = mo.fed_path_from_series(_sep_series(), 2026, fomc)
    assert fp["sepDate"] == "2026-09-16"
    assert [y["year"] for y in fp["years"]] == [2026, 2027, 2028]
    assert fp["years"][0] == {"year": 2026, "median": 4.1, "rangeLo": 3.9, "rangeHi": 4.4, "ctLo": 4.1, "ctHi": 4.4}
    assert fp["longerRun"] == {"median": 3.2, "ctLo": 3.0, "ctHi": 3.6}  # 날짜 안 맞는 RLLR 은 제외
    assert fp["current"] == {"lower": 3.75, "upper": 4.0, "date": "2026-10-22"}
    k, p = fp["market"]
    assert (k["code"], k["lower"], k["upper"]) == ("hold", 3.75, 4.0)
    assert p["code"] == "cut_big" and p["lower"] is None  # 폭이 열린 결과는 범위를 만들지 않는다


def test_fed_path_drops_stale_annual_vintage_and_past_years():
    s = _sep_series(first_year="2025")  # 연도별만 옛 빈티지(첫 해가 발표 연도와 다름)
    fp = mo.fed_path_from_series(s, 2026)
    assert fp["years"] == [] and fp["longerRun"]["median"] == 3.2
    fp2 = mo.fed_path_from_series(_sep_series(), 2027)  # 지난 해는 뺀다
    assert [y["year"] for y in fp2["years"]] == [2027, 2028]
    assert mo.fed_path_from_series({}, 2026) is None


def test_big_four_stats_rule():
    months = [f"2025-{m:02d}-01" for m in range(1, 13)] + [f"2026-{m:02d}-01" for m in range(1, 10)]
    vals = [100 + i for i in range(len(months))]
    vals[-4] = 130  # 2026-06 고점
    st = mo.big_four_stats(list(zip(months, vals)))
    # 최근 2026-09 = 120, 12개월 창 최고 130(2026-06), 6개월 전(2026-03) = 114
    assert st["date"] == "2026-09" and st["highDate"] == "2026-06"
    assert st["value"] == round((120 / 130 - 1) * 100, 2)
    assert st["change6"] == round((120 / 114 - 1) * 100, 2)
    # 6개월 전 값이 없으면 지어내지 않는다
    gap = [(d, v) for d, v in zip(months, vals) if not d.startswith("2026-03")]
    assert mo.big_four_stats(gap) is None
    assert mo.big_four_stats([]) is None


def test_big_four_rows_hidden_on_fetch_failure():
    def fetch(fid, start):
        if fid == "RRSFS":
            raise OSError("down")
        return [(f"2025-{m:02d}-01", 100.0) for m in range(1, 13)] + [("2026-01-01", 99.0)]
    rows = mo.big_four_rows(fetch=fetch, now=datetime(2026, 10, 23, tzinfo=timezone.utc))
    ids = [r["id"] for r in rows]
    assert "bf_rrsfs" not in ids and len(ids) == 3
    r = rows[0]
    assert r["breached"] is None and r["value"] == -1.0 and r["sub"] == "6개월 -1.0%"


def test_parse_nyfed_recprob():
    rows = [["Date", "10 Year Treasury Yield", "3 Month Treasury Yield", "3m BEY", "Spread", "Rec_prob", "NBER_Rec"],
            ["01-Aug-2026", 4.68, 3.72, 3.81, 0.8725, 0.2885, 0.0],
            ["01-Sep-2026", 4.99, 3.94, 4.03, 0.9551, 0.2742, 0.0],
            ["01-Aug-2027", "", "", "", "", 0.138825, ""],
            ["01-Sep-2027", "", "", "", "", 0.127587, ""]]
    st = mo.parse_nyfed_recprob(rows)
    assert st["value"] == 12.8 and st["date"] == "2026-09" and st["target"] == "2027-09" and st["spread"] == 0.96
    assert mo.parse_nyfed_recprob(rows[:-1]) is None  # 12개월 차이가 아니면 형식 변화로 본다
    assert mo.parse_nyfed_recprob([["x"]]) is None


def test_parse_cmdi_excel_serial_dates():
    rows = [["eow_friday", "Market CMDI", "IG CMDI", "HY CMDI"],
            ["46283", "0.17", "0.23", "0.1"], ["46290", "0.2", "0.25", "0.11"], ["46297", "", "", ""]]
    st = mo.parse_cmdi(rows)
    assert st == {"value": 0.2, "date": "2026-09-25", "history": [{"d": "2026-09-18", "v": 0.17}, {"d": "2026-09-25", "v": 0.2}]}
    assert mo.parse_cmdi([["a", "b"]]) is None


def test_recession_extra_rows_not_counted(tmp_path, monkeypatch):
    monkeypatch.setattr(mo, "INDUSTRY_JSON", tmp_path / "missing.json")
    extra = [{"id": "nyfed_cmdi", "name": "CMDI", "value": 0.2, "breached": None}]
    rec = mo.build_recession_signals(extra)
    assert rec["evaluated"] == 0 and rec["breached"] == 0 and rec["indicators"][0]["id"] == "nyfed_cmdi"
    assert mo.build_recession_signals([]) is None


# ---------------------------------------------------------------------------
# 클리블랜드 연은 인플레이션 나우캐스트(inflationNowcast) — FusionCharts JSON 파서.
def _nc_chart(sub, stamp, labels, series):
    """labels: 카테고리 라벨(vline 은 dict 로). series: {이름: [값|''] (vline 을 뺀 날짜 순)}."""
    cats = [x if isinstance(x, dict) else {"label": x} for x in labels]
    dates = [c["label"] for c in cats if c.get("vline") != "true"]
    ds = []
    for name, vals in series.items():
        ds.append({"seriesname": name, "data": [
            {"value": "" if v == "" else str(v), "tooltext": f"{name}{{br}}{dates[i]}{{br}}{v}{{br}}"}
            for i, v in enumerate(vals)]})
    return {"chart": {"_comment": f"{stamp} 00:00", "subcaption": sub},
            "categories": [{"category": cats}], "dataset": ds}


def test_nowcast_period_and_date_rules():
    assert mo._nowcast_period("2026-8") == "2026-08"
    assert mo._nowcast_period("2026:Q4") == "2026Q4"
    assert mo._nowcast_period("Inflation") is None
    stamp = datetime(2027, 1, 5)
    assert mo._nowcast_date("01/04", stamp) == "2027-01-04"
    assert mo._nowcast_date("12/30", stamp) == "2026-12-30"   # 12월 대상 → 1월 생성 경계
    assert mo._nowcast_date("PCE Jul", stamp) is None


def test_parse_nowcast_skips_vlines_and_reads_actuals():
    ch = _nc_chart("2026-9", "2026-10-22",
                   ["10/08", {"label": "CPI Sep", "vline": "true"}, "10/09", "10/22"],
                   {"CPI Inflation": [0.53, 0.53, ""], "Actual CPI Inflation": ["", 0.65, ""],
                    "PCE Inflation": [0.46, 0.47, 0.47], "Core PCE Inflation": ["", "", ""]})
    out = mo.parse_nowcast_charts([ch, {"chart": {"subcaption": "bad"}}])
    row = out["2026-09"]
    assert row["cpi"]["nowcast"] == 0.53 and row["cpi"]["date"] == "2026-10-09"
    assert row["cpi"]["actual"] == 0.65
    assert row["pce"] == {"nowcast": 0.47, "date": "2026-10-22", "actual": None,
                          "history": [{"d": "2026-10-08", "v": 0.46}, {"d": "2026-10-09", "v": 0.47},
                                      {"d": "2026-10-22", "v": 0.47}]}
    assert "corePce" not in row   # 값이 하나도 없으면 칸이 없다


def test_nowcast_block_blanks_released_cells():
    parsed = {
        "month": {"2026-10": {"cpi": {"nowcast": 0.25, "date": "2026-10-22", "actual": None, "history": []}},
                  "2026-09": {"cpi": {"nowcast": 0.53, "date": "2026-10-09", "actual": 0.65, "history": []},
                              "pce": {"nowcast": 0.47, "date": "2026-10-22", "actual": None, "history": []}},
                  "2026-08": {"pce": {"nowcast": 0.34, "date": "2026-09-24", "actual": None, "history": []}}},
        "year": {"2026-10": {"cpi": {"nowcast": 3.75, "date": "2026-10-22", "actual": None, "history": [{"d": "x", "v": 1}]}},
                 "2026-09": {"pce": {"nowcast": 3.6, "date": "2026-10-21", "actual": None, "history": []}}},
        "quarter": {"2026Q3": {"pce": {"nowcast": 1.97, "date": "2026-10-22", "actual": None, "history": []}},
                    "2026Q4": {"cpi": {"nowcast": 4.84, "date": "2026-10-22", "actual": None, "history": []},
                               "pce": {"nowcast": 4.16, "date": "2026-10-22", "actual": 4.0, "history": []}}},
    }
    blk = mo.nowcast_block(parsed)
    assert [p["period"] for p in blk["periods"]] == ["2026-10", "2026-09", "2026Q4"]   # 최근 2개 월 + 최근 분기
    oct_, sep, q4 = blk["periods"]
    assert oct_["cells"]["cpi"]["mom"] == 0.25 and oct_["cells"]["cpi"]["yoy"] == 3.75
    assert oct_["cells"]["cpi"]["history"] == [{"d": "x", "v": 1}]
    assert set(sep["cells"]) == {"pce"}          # 9월 CPI 는 이미 발표 → 칸 비움
    assert sep["cells"]["pce"]["date"] == "2026-10-22"
    assert set(q4["cells"]) == {"cpi"} and q4["kind"] == "quarter"
    assert blk["asOf"] == "2026-10-22" and blk["source"] == "클리블랜드 연은"
    assert mo.nowcast_block({"month": {}, "year": {}, "quarter": {}}) is None


def test_build_inflation_nowcast_hidden_on_fetch_failure():
    def boom(url):
        raise OSError("blocked")
    assert mo.build_inflation_nowcast(fetch=boom) is None


def test_build_inflation_nowcast_from_payloads():
    m = _nc_chart("2026-10", "2026-10-22", ["10/21", "10/22"], {"CPI Inflation": [0.25, 0.25]})
    y = _nc_chart("2026-10", "2026-10-22", ["10/21", "10/22"], {"CPI Inflation": [3.7, 3.75]})

    def fetch(url):
        if "nowcast_month" in url:
            return json.dumps([m]).encode("utf-8-sig")
        if "nowcast_year" in url:
            return json.dumps([y])
        raise OSError("quarter down")   # 분기만 빠져도 월 값으로 낸다
    blk = mo.build_inflation_nowcast(fetch=fetch)
    assert blk["periods"][0]["cells"]["cpi"]["mom"] == 0.25
    assert blk["periods"][0]["cells"]["cpi"]["yoy"] == 3.75
    assert len(blk["periods"]) == 1
