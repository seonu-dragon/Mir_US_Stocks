"""종목별 기관 보유 변화(build_13f_holders.py) 테스트. 오프라인.

TSV 행 모양은 실제 SEC Form 13F 데이터셋(01jun2026-31aug2026_form13f.zip)의 SUBMISSION·COVERPAGE·INFOTABLE
머리글과 행을 줄여 옮겼다. 13(f) 증권 목록 줄은 13flist2026q2 텍스트판 그대로다.
실행: py -m pytest -q scripts/tests/test_13f_holders.py
"""
from __future__ import annotations

import io
import zipfile

import build_13f_holders as b

# ---------------------------------------------------------------------------
# 목록 파싱
# ---------------------------------------------------------------------------

DATASETS_HTML = """
<a href="/files/datastandardsinnovation/data/form-13f-data-sets/01jun2026-31aug2026_form13f.zip">Jun</a>
<a href="/files/structureddata/data/form-13f-data-sets/01mar2026-31may2026_form13f.zip">Mar</a>
<a href="/files/structureddata/data/form-13f-data-sets/01dec2025-28feb2026_form13f.zip">Dec</a>
<a href="/files/structureddata/data/form-13f-data-sets/2023q4_form13f.zip">old</a>
"""


def test_dataset_links_map_window_to_report_quarter():
    ds = b.parse_dataset_links(DATASETS_HTML)
    assert [d["name"] for d in ds] == ["01dec2025-28feb2026", "01mar2026-31may2026", "01jun2026-31aug2026"]
    assert [d["period"] for d in ds] == ["2025-12-31", "2026-03-31", "2026-06-30"]
    assert ds[-1]["url"].startswith("https://www.sec.gov/files/datastandardsinnovation/")


def test_list_links_latest_first():
    html = ('<a href="/files/investment/13flist2026q1.txt">a</a>'
            '<a href="/files/investment/13flist2026q2-txt.txt">b</a>')
    assert b.parse_list_links(html)[0].endswith("13flist2026q2-txt.txt")


LIST_TXT = "\n".join([
    "037833100*APPLE INC                     COM                                    E",
    "037833900 APPLE INC                     CALL                                   E",
    "037833950 APPLE INC                     PUT                                    E",
    "02079K305*ALPHABET INC                  CAP STK CL A                           E",
    "G0R21F105 APEX TECH ACQUISITION INC     ORD SHS                    *A*         E",
])


def test_13f_list_fixed_width_and_skips_option_rows():
    rows = b.parse_13f_list(LIST_TXT)
    assert set(rows) == {"037833100", "02079K305", "G0R21F105"}
    assert rows["037833100"] == {"name": "APPLE INC", "cls": "COM", "opt": True, "status": ""}
    assert rows["02079K305"]["cls"] == "CAP STK CL A"
    assert rows["G0R21F105"]["status"] == "*A*"


def test_sec_date():
    assert b.parse_sec_date("31-JUL-2026") == "2026-07-31"
    assert b.parse_sec_date("") == ""
    assert b.parse_sec_date("2026-07-31") == ""


# ---------------------------------------------------------------------------
# 보고서 고르기 — 정정본 중복 제거
# ---------------------------------------------------------------------------

def sub(acc, cik, filed, stype="13F-HR", period="30-JUN-2026"):
    return {"ACCESSION_NUMBER": acc, "FILING_DATE": filed, "SUBMISSIONTYPE": stype,
            "CIK": cik, "PERIODOFREPORT": period}


def cov(acc, amend="N", atype="", rtype="13F HOLDINGS REPORT", name="Mgr"):
    return {"ACCESSION_NUMBER": acc, "ISAMENDMENT": amend, "AMENDMENTTYPE": atype,
            "FILINGMANAGER_NAME": name, "REPORTTYPE": rtype}


def test_restatement_replaces_original_and_new_holdings_add_on():
    subs = [
        sub("A1", "0000000001", "01-AUG-2026"),
        sub("A2", "0000000001", "20-AUG-2026", "13F-HR/A"),      # RESTATEMENT → 교체
        sub("A3", "0000000001", "25-AUG-2026", "13F-HR/A"),      # NEW HOLDINGS → 추가
        sub("A0", "0000000001", "10-JUL-2026", "13F-HR/A"),      # 교체본보다 먼저 낸 추가분 → 버림
        sub("B1", "0000000002", "01-AUG-2026"),
        sub("B2", "0000000002", "02-AUG-2026"),                  # 같은 분기 원본 두 번 → 늦은 것
        sub("C1", "0000000003", "01-AUG-2026", "13F-NT"),        # 보유 없음 통지
        sub("D1", "0000000004", "01-AUG-2026", period="31-MAR-2026"),  # 대상 밖 분기
        sub("E1", "0000000005", "01-AUG-2026"),
    ]
    covs = [cov("A1"), cov("A2", "Y", "RESTATEMENT"), cov("A3", "Y", "NEW HOLDINGS"), cov("A0", "Y", "NEW HOLDINGS"),
            cov("B1"), cov("B2"), cov("C1", rtype="13F NOTICE"), cov("D1"),
            cov("E1", rtype="13F NOTICE")]
    metas = b.filing_meta(subs, covs, {"2026-06-30"})
    chosen = b.choose_filings(metas)
    assert set(chosen) == {"A2", "A3", "B2"}
    assert chosen["A2"]["cik"] == 1 and chosen["A2"]["period"] == "2026-06-30"


def test_amendment_without_type_is_restatement():
    metas = b.filing_meta([sub("A1", "1", "01-AUG-2026"), sub("A2", "1", "05-AUG-2026", "13F-HR/A")],
                          [cov("A1"), cov("A2", "Y", "")], {"2026-06-30"})
    assert set(b.choose_filings(metas)) == {"A2"}


def test_new_holdings_without_base_is_dropped():
    metas = b.filing_meta([sub("A3", "1", "25-AUG-2026", "13F-HR/A")], [cov("A3", "Y", "NEW HOLDINGS")], {"2026-06-30"})
    assert b.choose_filings(metas) == {}


# ---------------------------------------------------------------------------
# INFOTABLE 집계 — 같은 기관 여러 줄 합산 · 풋콜 분리 · PRN 제외
# ---------------------------------------------------------------------------

def info(acc, cusip, shares, value, putcall="", kind="SH", name="APPLE INC", title="COM"):
    return {"ACCESSION_NUMBER": acc, "NAMEOFISSUER": name, "TITLEOFCLASS": title, "CUSIP": cusip,
            "VALUE": str(value), "SSHPRNAMT": str(shares), "SSHPRNAMTTYPE": kind, "PUTCALL": putcall}


def test_infotable_sums_rows_and_separates_options():
    chosen = {"A2": {"cik": 1, "period": "2026-06-30"}, "A3": {"cik": 1, "period": "2026-06-30"},
              "B2": {"cik": 2, "period": "2026-06-30"}}
    rows = [
        info("A2", "037833100", 100, 25000),
        info("A2", "037833100", 50, 12500),          # 같은 보고서 다른 투자재량 줄 → 합산
        info("A3", "037833100", 10, 2500),           # 추가분 정정본 → 합산
        info("A2", "037833100", 300, 900, "Call"),   # 콜 → 주식 보유와 분리
        info("B2", "037833100", 200, 700, "Put"),
        info("B2", "037833100", 7, 1000, kind="PRN"),  # 원금 → 제외
        info("A1", "037833100", 999, 999),           # 고르지 않은 원본 → 제외
        info("B2", "02079k305", 40, 8000),           # 소문자 CUSIP 정규화
    ]
    aggs = {"2026-06-30": b.PeriodAgg("2026-06-30")}
    n = b.aggregate_infotable(rows, chosen, aggs)
    assert n == 7
    agg = aggs["2026-06-30"]
    assert agg.pos["037833100"] == {1: [160, 40000]}
    assert agg.opt["037833100"] == {"call": {1: 300}, "put": {2: 200}}
    assert agg.pos["02079K305"] == {2: [40, 8000]}
    assert agg.totals()["037833100"] == [1, 160, 40000]


def test_tsv_rows_reads_only_needed_columns_from_zip():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("INFOTABLE.tsv", "ACCESSION_NUMBER\tINFOTABLE_SK\tCUSIP\tVALUE\n"
                                     "A1\t9\t037833100\t5\nA1\t10\t02079K305\t\n")
    with zipfile.ZipFile(buf) as zf:
        rows = list(b.tsv_rows(zf, "INFOTABLE.tsv", ("ACCESSION_NUMBER", "CUSIP", "VALUE", "PUTCALL")))
    assert rows == [{"ACCESSION_NUMBER": "A1", "CUSIP": "037833100", "VALUE": "5"},
                    {"ACCESSION_NUMBER": "A1", "CUSIP": "02079K305", "VALUE": ""}]


# ---------------------------------------------------------------------------
# CUSIP → 티커
# ---------------------------------------------------------------------------

SNAP = {"stocks": [
    {"ticker": "AAPL", "company": "Apple Inc."},
    {"ticker": "GOOGL", "company": "Alphabet Inc. Class A"},
    {"ticker": "GOOG", "company": "Alphabet Inc. Class C"},
    {"ticker": "JPM", "company": "JPMorgan Chase & Co."},
    {"ticker": "BRK.B", "company": "Berkshire Hathaway Inc."},
    {"ticker": "BRK.A", "company": "Berkshire Hathaway Inc."},
    {"ticker": "SPY", "company": "SPDR S&P 500 ETF Trust", "sector": "EXCHANGE TRADED FUNDS"},
]}


def test_resolve_cusips_priority_and_name_rules():
    by_ticker, by_name = b.stock_universe_all(SNAP)
    assert "SPY" in by_ticker  # 13F 는 ETF 보유도 보고한다
    figi = {"78462F103": {"t": "SPY"}, "46625H365": {"t": "JPM.PRC"}}
    info_pairs = b.pairs_from_13finfo({"institutions": [{"quarters": [{"holdings": [
        {"cusip": "084670702", "ticker": "BRK.B"},
        {"cusip": "037833100", "ticker": "AAPL", "putCall": "call"},  # 옵션 줄은 쓰지 않는다
    ]}]}]}, set(by_ticker))
    list_rows = b.parse_13f_list(LIST_TXT)
    list_rows["46625H100"] = {"name": "JPMORGAN CHASE & CO", "cls": "COM", "opt": True, "status": ""}
    list_rows["46625H365"] = {"name": "JPMORGAN CHASE & CO", "cls": "COM", "opt": False, "status": ""}
    list_rows["46625H555"] = {"name": "JPMORGAN CHASE & CO", "cls": "DEP SHS PFD", "opt": False, "status": ""}
    list_rows["037833114"] = {"name": "APPLE INC", "cls": "*W EXP 04/04/202", "opt": False, "status": ""}
    list_rows["037833AB1"] = {"name": "APPLE INC", "cls": "DEBT        10/1", "opt": False, "status": ""}
    infonames = {"084670108": ("BERKSHIRE HATHAWAY INC DEL", "CL A")}
    cusips = ["78462F103", "084670702", "037833100", "02079K305", "46625H100", "46625H365", "46625H555", "084670108",
              "037833114", "037833AB1"]
    cmap, src = b.resolve_cusips(cusips, figi=figi, info_pairs=info_pairs, list_rows=list_rows,
                                 infotable_names=infonames, by_ticker=by_ticker, by_name=by_name)
    assert cmap["78462F103"] == "SPY" and src["78462F103"] == "figi"
    assert cmap["084670702"] == "BRK.B" and src["084670702"] == "13finfo"
    assert cmap["037833100"] == "AAPL" and src["037833100"] == "name"
    assert cmap["02079K305"] == "GOOGL"          # CL A → Class A 만
    assert cmap["46625H100"] == "JPM"
    assert "46625H365" not in cmap                # FIGI 가 스냅샷 밖 우선주라고 확인 → 이름으로도 잇지 않음
    assert "46625H555" not in cmap                # 우선주 종류는 이름 일치 거부
    assert "037833114" not in cmap and "037833AB1" not in cmap  # 워런트·채권은 같은 회사명이어도 거부
    assert "084670108" not in cmap                # 'DEL' 붙은 이름 + 두 종류 모두 클래스 표기 없음 → 유일하지 않음


def test_merge_two_cusips_same_ticker_sums_per_institution():
    pos = {"OLDCUSIP1": {1: [10, 100], 2: [5, 50]}, "NEWCUSIP1": {1: [3, 30]}, "UNMAPPED1": {9: [1, 1]}}
    out = b.merge_by_ticker(pos, {"OLDCUSIP1": "XYZ", "NEWCUSIP1": "XYZ"})
    assert out == {"XYZ": {1: [13, 130], 2: [5, 50]}}


# ---------------------------------------------------------------------------
# 종목 레코드 — 분기 비교
# ---------------------------------------------------------------------------

def test_record_changes_only_among_institutions_filing_both_quarters():
    cur = {1: [100, 1000], 2: [50, 500], 3: [70, 700], 5: [10, 100], 7: [40, 400]}
    prev = {1: [100, 900], 2: [80, 700], 3: [60, 500], 4: [30, 300], 6: [20, 200], 8: [5, 50]}
    cur_filers = {1, 2, 3, 4, 5, 7}       # 6·8 은 아직 이번 분기 13F 를 안 냈다 → 청산으로 세지 않는다
    prev_filers = {1, 2, 3, 4, 5, 6, 8}   # 7 은 직전 분기 13F 가 없다(신규 제출 기관) → 비교 밖
    rec = b.ticker_record(cur, prev, cur_filers, prev_filers, opts={"call": {1: 5}, "put": {2: 7, 3: 0}},
                          shares_out=1000.0, trend=[None, [3, 200, 2000]])
    new, closed, inc, dec, same, comparable = rec["c"]
    assert (new, closed, inc, dec, same) == (1, 1, 1, 1, 1)  # 5 신규 · 4 청산 · 3 증가 · 2 감소 · 1 유지
    assert comparable == 5
    assert rec["h"] == 5 and rec["s"] == 270 and rec["ph"] == 6 and rec["ps"] == 295
    assert rec["p"] == 27.0 and rec["so"] == 1000.0
    assert rec["o"] == [1, 5, 1, 7]
    assert rec["top"][0] == [1, 100, 100, 1000]
    assert [r[0] for r in rec["top"]] == [1, 3, 2, 7, 5]
    assert rec["top"][3] == [7, 40, None, 400]   # 직전 13F 없는 기관은 비교 불가(None)
    assert rec["top"][4] == [5, 10, 0, 100]      # 직전 분기에 13F 를 냈는데 없던 종목 → 0(신규)
    assert rec["tr"] == [None, [3, 200, 2000]]
    assert "split" not in rec


def test_record_adjusts_for_split():
    prev = {c: [100, 1000] for c in range(1, 21)}
    cur = {c: [200, 1100] for c in range(1, 20)}   # 2:1 분할, 20번은 청산
    cur[1] = [260, 1400]                            # 분할 조정 후 +30% 증가
    cur[2] = [150, 800]                             # 분할 조정 후 감소
    filers = set(range(1, 21))
    rec = b.ticker_record(cur, prev, filers, filers)
    assert rec["split"] == 2
    new, closed, inc, dec, same, _ = rec["c"]
    assert (new, closed, inc, dec, same) == (0, 1, 1, 1, 17)
    assert rec["top"][0] == [1, 260, 200, 1400]     # 직전 수량도 분할 조정


def test_ticker_totals_from_state():
    state = {"2026-03-31": {"totals": {"C1": [3, 30, 300], "C2": [1, 5, 50], "C3": [9, 9, 9]}}}
    assert b.ticker_totals(state, "2026-03-31", {"C1": "XYZ", "C2": "XYZ"}) == {"XYZ": [4, 35, 350]}


# ---------------------------------------------------------------------------
# 증분 계획
# ---------------------------------------------------------------------------

def test_plan_no_new_dataset_is_noop_and_bootstrap_takes_all():
    ds = b.parse_dataset_links(DATASETS_HTML)
    todo, need = b.plan_datasets(ds, {"latestDataset": ds[-1]["name"], "periods": {
        "2025-12-31": {"final": True}, "2026-03-31": {"final": True}, "2026-06-30": {"final": False}}}, 2, False)
    assert todo == [] and need == []
    todo, need = b.plan_datasets(ds, {}, 2, False)
    assert need == ["2026-03-31", "2026-06-30"]
    assert [d["name"] for d in todo] == ["01mar2026-31may2026", "01jun2026-31aug2026"]


def test_plan_incremental_new_window_takes_two():
    ds = b.parse_dataset_links(DATASETS_HTML)
    state = {"latestDataset": ds[-2]["name"], "periods": {
        "2025-12-31": {"final": True}, "2026-03-31": {"final": False}}}
    todo, need = b.plan_datasets(ds, state, 2, False)
    assert need == ["2026-03-31", "2026-06-30"]
    assert [d["name"] for d in todo] == ["01mar2026-31may2026", "01jun2026-31aug2026"]
