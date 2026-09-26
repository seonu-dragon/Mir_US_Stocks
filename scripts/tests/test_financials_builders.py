"""재무 확장 빌더(build_financials_us / build_financials_kr / financials_common) 순수 로직 테스트.

네트워크 없음 — companyfacts·DART 응답 모양을 손으로 만든 최소 스텁으로 검증한다
(실제 응답 구조는 2026-09-26 AAPL·TSM·JPM·삼성전자·KB금융 실호출로 확인한 것과 같다).

실행: py -m pytest -q scripts/tests/test_financials_builders.py
"""
from __future__ import annotations

from datetime import date

import build_financials_kr as kr
import build_financials_us as us
import financials_common as fc


# ─────────────────────────── US ───────────────────────────
def _f(start, end, val, accn, fy, fp, form, filed):
    d = {"end": end, "val": val, "accn": accn, "fy": fy, "fp": fp, "form": form, "filed": filed}
    if start:
        d["start"] = start
    return d


def _us_facts():
    """FY2025(2024-10-01~2025-09-30) 10-K + FY2026 1·2분기 10-Q. 현금흐름은 누계로만 공시."""
    K25, Q1, Q2 = "k25", "q1", "q2"
    K = ("2025", "FY", "10-K", "2025-11-01")
    rev = [
        _f("2024-10-01", "2025-09-30", 400, K25, 2025, "FY", "10-K", "2025-11-01"),
        _f("2024-10-01", "2024-12-31", 90, "q1p", 2025, "Q1", "10-Q", "2025-02-01"),
        _f("2024-10-01", "2025-06-30", 290, "q3p", 2025, "Q3", "10-Q", "2025-08-01"),   # 9개월 누계
        _f("2025-10-01", "2025-12-31", 110, Q1, 2026, "Q1", "10-Q", "2026-02-01"),
        _f("2026-01-01", "2026-03-31", 105, Q2, 2026, "Q2", "10-Q", "2026-05-01"),
        _f("2025-10-01", "2026-03-31", 215, Q2, 2026, "Q2", "10-Q", "2026-05-01"),
    ]
    ocf = [
        _f("2024-10-01", "2025-09-30", 120, K25, 2025, "FY", "10-K", "2025-11-01"),
        _f("2024-10-01", "2025-06-30", 80, "q3p", 2025, "Q3", "10-Q", "2025-08-01"),
        _f("2025-10-01", "2025-12-31", 30, Q1, 2026, "Q1", "10-Q", "2026-02-01"),
        _f("2025-10-01", "2026-03-31", 70, Q2, 2026, "Q2", "10-Q", "2026-05-01"),     # 2분기 = 70 − 30
    ]
    capex = [
        _f("2024-10-01", "2025-09-30", 20, K25, 2025, "FY", "10-K", "2025-11-01"),
        _f("2025-10-01", "2025-12-31", 5, Q1, 2026, "Q1", "10-Q", "2026-02-01"),
        _f("2025-10-01", "2026-03-31", 12, Q2, 2026, "Q2", "10-Q", "2026-05-01"),
    ]
    shares = [
        _f("2024-10-01", "2025-09-30", 1000, K25, 2025, "FY", "10-K", "2025-11-01"),
        _f("2025-10-01", "2025-12-31", 990, Q1, 2026, "Q1", "10-Q", "2026-02-01"),
        _f("2026-01-01", "2026-03-31", 985, Q2, 2026, "Q2", "10-Q", "2026-05-01"),
        _f("2025-10-01", "2026-03-31", 987, Q2, 2026, "Q2", "10-Q", "2026-05-01"),
    ]
    inst = lambda vals: [_f(None, e, v, a, fy, fp, form, filed) for e, v, a, fy, fp, form, filed in vals]  # noqa: E731
    cash = inst([("2025-09-30", 50, K25, 2025, "FY", "10-K", "2025-11-01"),
                 ("2026-03-31", 60, Q2, 2026, "Q2", "10-Q", "2026-05-01")])
    ltd = inst([("2025-09-30", 200, K25, 2025, "FY", "10-K", "2025-11-01"),
                ("2026-03-31", 190, Q2, 2026, "Q2", "10-Q", "2026-05-01")])
    cp = inst([("2025-09-30", 10, K25, 2025, "FY", "10-K", "2025-11-01")])
    del K
    return {"cik": 1, "entityName": "Test Co", "facts": {"us-gaap": {
        "Revenues": {"units": {"USD": rev}},
        "NetCashProvidedByUsedInOperatingActivities": {"units": {"USD": ocf}},
        "PaymentsToAcquirePropertyPlantAndEquipment": {"units": {"USD": capex}},
        "WeightedAverageNumberOfDilutedSharesOutstanding": {"units": {"shares": shares}},
        "CashAndCashEquivalentsAtCarryingValue": {"units": {"USD": cash}},
        "LongTermDebt": {"units": {"USD": ltd}},
        "CommercialPaper": {"units": {"USD": cp}},
        "Assets": {"units": {"USD": inst([("2025-09-30", 900, K25, 2025, "FY", "10-K", "2025-11-01")])}},
    }}}


def test_us_extract_annual_quarter_and_derived_flags():
    doc = us.extract_company(_us_facts(), ticker="TST", cik=1, sector="TECHNOLOGY", updated="t")
    assert doc["currency"] == "USD" and doc["basis"] == "us-gaap" and doc["industryType"] == "general"
    a = doc["annual"][-1]
    assert a["fy"] == 2025 and a["rev"] == 400 and a["ocf"] == 120 and a["fcf"] == 100
    assert a["debt"] == 210            # LongTermDebt + CP
    assert a["netDebt"] == 160
    assert "liab" not in a             # 공시에 없으면 키 자체가 없다(결측)
    qs = {(r["fy"], r["fq"]): r for r in doc["quarterly"]}
    q4 = qs[(2025, 4)]
    assert q4["rev"] == 110 and "rev" in q4["d"]        # 400 − 290
    assert q4["ocf"] == 40 and "ocf" in q4["d"]         # 120 − 80
    assert "sharesDilAvg" not in q4                     # 평균은 빼기 불가 → 결측
    q2 = qs[(2026, 2)]
    assert q2["rev"] == 105 and "rev" not in q2.get("d", [])   # 직접 3개월 값
    assert q2["ocf"] == 40 and "ocf" in q2["d"]                 # 70 − 30
    assert q2["capex"] == 7 and q2["sharesDilAvg"] == 985
    assert doc["tags"]["rev"] == "Revenues"


def test_us_capex_sign_and_currency_choice():
    facts = _us_facts()
    for u in facts["facts"]["us-gaap"]["PaymentsToAcquirePropertyPlantAndEquipment"]["units"]["USD"]:
        u["val"] = -u["val"]
    doc = us.extract_company(facts, ticker="TST")
    assert doc["annual"][-1]["capex"] == 20
    # 20-F 편의 환산: USD 가 일부만 있으면 본 통화(팩트가 많은 쪽)를 쓴다
    ns = {"Revenue": {"units": {"TWD": [{}] * 5, "USD": [{}]}}}
    assert us.pick_currency(ns) == "TWD"
    assert us.pick_currency({"Assets": {"units": {"USD": [{}] * 3}}}) == "USD"


def test_us_debt_from_parts_rules():
    assert us.debt_from_parts({}) is None                                  # 구성 태그 없음 = 결측
    assert us.debt_from_parts({"total": 5, "ltTotal": 100}) == 5
    assert us.debt_from_parts({"ltTotal": 100, "stb": 7}) == 107
    assert us.debt_from_parts({"ltNoncurrent": 90, "curTotal": 15, "stb": 7}) == 105   # DebtCurrent 가 단기 포함
    assert us.debt_from_parts({"ltNoncurrent": 90, "ltCurrent": 10, "stb": 7}) == 107


def test_us_bank_flag_and_20f_flags():
    facts = _us_facts()
    facts["facts"]["us-gaap"]["Deposits"] = {"units": {"USD": []}}
    doc = us.extract_company(facts, ticker="BNK", sector="FINANCIAL")
    assert doc["industryType"] == "bank" and "financial" in doc["flags"]


def test_us_sec_symbol_and_safe_name():
    assert us.sec_symbol("BRK.B") == "BRK-B"
    assert fc.safe_file_name("CON") == "_CON"
    assert fc.safe_file_name("brk.b") == "BRK.B"


# ─────────────────────────── 공통 ───────────────────────────
def test_build_ttm_requires_four_consecutive_quarters():
    qs = [{"fy": 2025, "fq": i, "rev": 10, "epsDil": 0.5, "cash": i} for i in (1, 2, 3, 4)]
    ttm = fc.build_ttm(qs, [])
    assert ttm["basis"] == "4Q" and ttm["rev"] == 40 and ttm["epsDil"] == 2.0 and ttm["cash"] == 4
    qs[2].pop("rev")
    assert "rev" not in fc.build_ttm(qs, [])            # 하나라도 결측이면 합도 결측
    gap = [{"fy": 2025, "fq": 1, "rev": 1}, {"fy": 2025, "fq": 2, "rev": 1},
           {"fy": 2025, "fq": 4, "rev": 1}, {"fy": 2026, "fq": 1, "rev": 1}]
    fb = fc.build_ttm(gap, [{"fy": 2025, "rev": 99}])
    assert fb["basis"] == "FY" and fb["rev"] == 99
    assert fc.build_ttm([], []) is None


# ─────────────────────────── KR ───────────────────────────
def _row(sj, aid, nm, **amounts):
    r = {"sj_div": sj, "account_id": aid, "account_nm": nm}
    r.update({k: str(v) for k, v in amounts.items()})
    return r


def test_kr_annual_report_three_years_and_missing_debt():
    rows = [
        _row("IS", "ifrs-full_Revenue", "매출액", thstrm_amount=300, frmtrm_amount=250, bfefrmtrm_amount=200),
        _row("IS", "ifrs-full_ProfitLossBeforeTax", "법인세비용차감전순이익", thstrm_amount=50, frmtrm_amount=40),
        _row("IS", "ifrs-full_IncomeTaxExpenseContinuingOperations", "법인세비용", thstrm_amount=10, frmtrm_amount=8),
        _row("IS", "ifrs-full_ProfitLossAttributableToOwnersOfParent", "지배기업 소유주지분", thstrm_amount=40, frmtrm_amount=32),
        _row("CF", "ifrs-full_CashFlowsFromUsedInOperatingActivities", "영업활동현금흐름", thstrm_amount=70, frmtrm_amount=60),
        _row("CF", "ifrs-full_PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities", "유형자산의 취득",
             thstrm_amount=-25, frmtrm_amount=20),
        _row("BS", "ifrs-full_Assets", "자산총계", thstrm_amount=1000, frmtrm_amount=900),
    ]
    parts = kr.parse_report(rows, 2025, "11011")
    raw = {}
    kr.merge_raw(raw, parts)
    annual, _q = kr.rows_from_raw(raw)
    by = {r["fy"]: r for r in annual}
    assert by[2025]["rev"] == 300 and by[2024]["rev"] == 250
    assert by[2025]["capex"] == 25 and by[2025]["fcf"] == 45       # 부호 섞여도 유출 크기
    assert "debt" not in by[2025] and "netDebt" not in by[2025]    # 차입금 계정 없음 = 결측
    assert 2023 not in by or "rev" in by[2023]


def test_kr_tax_sign_normalization():
    vals = {"pretax": 2306, "tax": -607, "net": 1697}
    kr._normalize_tax_sign(vals)
    assert vals["tax"] == 607
    benefit = {"pretax": 110, "tax": -45, "net": 145}              # 실제 법인세 수익은 그대로
    kr._normalize_tax_sign(benefit)
    assert benefit["tax"] == -45


def test_kr_quarterly_report_and_q4_derivation():
    raw = {}
    # 2025 사업보고서(연간) — 2025 매출 400, 영업CF 100
    kr.merge_raw(raw, kr.parse_report([
        _row("IS", "ifrs-full_Revenue", "매출액", thstrm_amount=400),
        _row("CF", "ifrs-full_CashFlowsFromUsedInOperatingActivities", "영업활동현금흐름", thstrm_amount=100),
        _row("BS", "ifrs-full_Assets", "자산총계", thstrm_amount=1000),
    ], 2025, "11011"))
    # 2025 3분기 보고서 — 3분기 3개월 100, 누계 290 / 영업CF 누계 70 / 전년 같은 분기 90
    kr.merge_raw(raw, kr.parse_report([
        _row("IS", "ifrs-full_Revenue", "매출액", thstrm_amount=100, thstrm_add_amount=290,
             frmtrm_q_amount=90, frmtrm_add_amount=260),
        _row("CF", "ifrs-full_CashFlowsFromUsedInOperatingActivities", "영업활동현금흐름",
             thstrm_amount=70, frmtrm_q_amount=66),
        _row("BS", "ifrs-full_Assets", "자산총계", thstrm_amount=980, frmtrm_amount=950),
    ], 2025, "11014"))
    # 2025 반기 — 영업CF 누계 45
    kr.merge_raw(raw, kr.parse_report([
        _row("IS", "ifrs-full_Revenue", "매출액", thstrm_amount=95, thstrm_add_amount=190),
        _row("CF", "ifrs-full_CashFlowsFromUsedInOperatingActivities", "영업활동현금흐름", thstrm_amount=45),
    ], 2025, "11012"))
    _a, quarterly = kr.rows_from_raw(raw)
    qs = {(r["fy"], r["fq"]): r for r in quarterly}
    assert qs[(2025, 3)]["rev"] == 100 and qs[(2025, 3)]["ocf"] == 25 and "ocf" in qs[(2025, 3)]["d"]
    assert qs[(2025, 4)]["rev"] == 110 and qs[(2025, 4)]["ocf"] == 30   # 400−290, 100−70
    assert qs[(2025, 4)]["assets"] == 1000                              # 4분기 잔액 = 연간 기말
    assert qs[(2024, 3)]["rev"] == 90                                   # 비교 컬럼(전년 같은 분기)


def test_kr_merge_priority_own_report_wins():
    raw = {}
    kr.merge_raw(raw, [("A", "2024", 1, {"rev": 999})])      # 2025 보고서의 전기(비교) 값
    kr.merge_raw(raw, [("A", "2024", 2, {"rev": 250, "op": 20})])  # 2024 자기 보고서
    kr.merge_raw(raw, [("A", "2024", 0, {"rev": 1, "net": 5})])    # 전전기 — 빈칸만 채움
    assert raw["A"]["2024"]["rev"] == 250 and raw["A"]["2024"]["op"] == 20 and raw["A"]["2024"]["net"] == 5


def test_kr_report_schedule_and_tiers():
    reps = kr.available_reports(date(2026, 9, 26))
    assert reps[0] == (2026, "11012") and reps[1] == (2026, "11013") and reps[2] == (2025, "11011")
    assert (2026, "11014") not in reps                         # 11/17 전
    t = kr.tiers(date(2026, 9, 26))
    assert t[0] == [("F", 2025, "11011"), ("F", 2026, "11012"), ("S", 2025, "11011")]
    assert ("S", 2025, "11011") not in t[3] and ("S", 2021, "11011") in t[3]   # 최신 주식수는 1계층에만
    assert len(t[1]) == 6 and ("F", 2022, "11011") in t[2]
    assert kr.available_reports(date(2026, 3, 1))[0] == (2025, "11014")   # 사업보고서 기한 전


def test_kr_needs_recheck_rules():
    today = date(2026, 9, 26)
    raw = {"reports": {"2026_11012": {"none": "2026-09-20"}, "2024_11013": {"none": "2025-01-01"},
                       "2025_11011": {"rcept": "20260310000001"}}}
    recent = {"2026_11012", "2026_11013"}
    assert kr.needs(raw, "F", 2026, "11012", today, recent) is False    # 21일 안 됨
    assert kr.needs(raw, "F", 2026, "11012", date(2026, 10, 20), recent) is True
    assert kr.needs(raw, "F", 2024, "11013", today, recent) is False    # 오래된 결측은 다시 안 봄
    assert kr.needs(raw, "F", 2025, "11011", today, recent) is False
    assert kr.needs(raw, "F", 2023, "11011", today, recent) is True


def test_kr_build_doc_financial_flag_and_strips_nothing_required():
    raw = {"A": {"2025": {"p": 2, "op": 5, "net": 4, "assets": 100}}, "fs": "CFS", "reports": {}}
    doc = kr.build_doc("105560", "00688996", "KB금융", raw, sector="금융", industry="은행", updated="t")
    assert doc["industryType"] == "bank" and "financial" in doc["flags"]
    assert doc["currency"] == "KRW" and doc["annual"][0]["fy"] == 2025 and "_raw" in doc


# ─────────────────── KR 시간 예산 · 중간 저장 · 재개(2026-09-26) ───────────────────
def test_kr_should_checkpoint_rules():
    assert not kr.should_checkpoint(0, 999, every=150, every_min=20)       # 새 종목 없으면 저장 안 함
    assert kr.should_checkpoint(150, 0, every=150, every_min=20)
    assert not kr.should_checkpoint(149, 19.9, every=150, every_min=20)
    assert kr.should_checkpoint(1, 20, every=150, every_min=20)           # 시간 기준
    assert not kr.should_checkpoint(5, 999, every=0, every_min=0)         # 둘 다 끄면 마지막에만


def test_kr_clock_budget():
    t = {"now": 1000.0}
    c = kr.Clock(10, now=lambda: t["now"])
    assert not c.over() and c.elapsed_min() == 0
    t["now"] += 599
    assert not c.over()
    t["now"] += 1
    assert c.over() and abs(c.elapsed_min() - 10) < 1e-9
    assert not kr.Clock(0, now=lambda: 1e12).over()                        # 0 = 무제한


def _kr_env(tmp_path, monkeypatch, n=5):
    import json as _json
    snap = tmp_path / "snap.json"
    stocks = [{"ticker": f"{i:06d}", "company": f"회사{i}", "marketCapB": 100 - i, "sector": "제조"} for i in range(1, n + 1)]
    snap.write_text(_json.dumps({"stocks": stocks}), encoding="utf-8")
    out = tmp_path / "fin"
    out.mkdir()
    monkeypatch.setattr(kr, "KR_SNAPSHOT", snap)
    monkeypatch.setattr(kr, "OUT_DIR", out)
    monkeypatch.setattr(kr, "OUT_JSON", tmp_path / "idx.json")
    monkeypatch.setattr(kr, "OUT_JS", tmp_path / "idx.js")
    corp_map = {s["ticker"]: f"C{s['ticker']}" for s in stocks}
    return corp_map, out


def _fake_dart(log):
    def dart_get(path, params, key):
        log.append((path, params.get("corp_code"), params.get("bsns_year"), params.get("reprt_code")))
        if path.startswith("stockTotqy"):
            return {"status": "013"}
        return {"status": "000", "list": [
            {**_row("IS", "ifrs-full_Revenue", "매출액", thstrm_amount=300, frmtrm_amount=250), "rcept_no": "20260315000001"},
            _row("BS", "ifrs-full_Assets", "자산총계", thstrm_amount=1000, frmtrm_amount=900),
        ]}
    return dart_get


def _args(**kw):
    import argparse
    base = dict(push=False, top=1000, max_calls=3000, only="", time_budget_min=0, save_every=150,
                save_minutes=20, progress_every=0)
    base.update(kw)
    return argparse.Namespace(**base)


def test_kr_checkpoints_every_n_and_resumes_without_refetch(tmp_path, monkeypatch):
    import json as _json
    corp_map, out = _kr_env(tmp_path, monkeypatch, n=5)
    saves = []
    real = kr.save_checkpoint

    def spy(*a, **k):
        saves.append((len(a[2]), k["final"]))
        return real(*a, **k)

    monkeypatch.setattr(kr, "save_checkpoint", spy)
    log = []
    # 호출 7회: 1계층(최신 사업보고서 + 최신 분기 + 최신 주식수) 종목당 3회 → 3종목째 도중 예산 소진
    rc = kr.main_run(_args(max_calls=7, save_every=2), "k", dart_get=_fake_dart(log), corp_map=corp_map)
    assert rc == 0                                         # 예산 소진은 정상 종료
    assert len(log) == 7
    assert saves[0] == (2, False)                          # 2종목마다 중간 저장
    assert saves[-1][1] is True                            # 남은 종목은 최종 저장
    idx = _json.loads((tmp_path / "idx.json").read_text(encoding="utf-8"))
    assert idx["count"] == 3 and idx["calls"] == 7
    # 재개: 받은 보고서(_raw.reports)는 다시 받지 않는다
    log2 = []
    kr.main_run(_args(max_calls=2), "k", dart_get=_fake_dart(log2), corp_map=corp_map)
    first = set(log)                                       # (API, corp, 연도, 보고서) — 주식수와 재무제표는 API 가 다르다
    assert log2 and not (set(log2) & first)


def test_kr_time_budget_stops_and_saves(tmp_path, monkeypatch):
    corp_map, out = _kr_env(tmp_path, monkeypatch, n=5)
    t = {"now": 0.0}
    log = []
    inner = _fake_dart(log)

    def slow(path, params, key):
        t["now"] += 60.0                                   # 호출 1회 = 1분
        return inner(path, params, key)

    clock = kr.Clock(3, now=lambda: t["now"])
    rc = kr.main_run(_args(time_budget_min=3), "k", dart_get=slow, corp_map=corp_map, clock=clock)
    assert rc == 0 and len(log) == 3                       # 3분 뒤 호출 중단, 정상 종료
    assert sorted(p.name for p in out.iterdir()) == ["000001.json"]   # 받은 데까지 저장(1종목 = 1계층 3회)


def test_kr_rate_limit_still_saves_and_fails(tmp_path, monkeypatch):
    corp_map, out = _kr_env(tmp_path, monkeypatch, n=3)
    log = []
    inner = _fake_dart(log)

    def limited(path, params, key):
        if len(log) >= 2:
            raise SystemExit("[중단] DART status 020 (사용 한도 초과)")
        return inner(path, params, key)

    rc = kr.main_run(_args(), "k", dart_get=limited, corp_map=corp_map)
    assert rc == 1                                         # 한도 초과는 실패로 알린다
    assert (out / "000001.json").exists()                  # 그래도 받은 데까지는 저장
