"""국내 대량보유자 역검색 · 상장 지분 시가 · 컨센서스 변화 이력 — 오프라인 픽스처 테스트.

표본은 2026-10-23 실측 응답에서 줄였다(DART majorstock·otrCprInvstmntSttus, FnGuide cF1001).
"""
from __future__ import annotations

import json
from datetime import date

import build_kr_consensus as C
import build_kr_major_holders as M
import build_kr_stake_value as S
import kr_consensus_history as H
import kr_holder_names as N


# ---------------------------------------------------------------- 이름 정규화

def test_norm_strips_legal_forms_notes_and_suffixes():
    assert N.norm_name("SK이노베이션㈜ ") == N.norm_name("SK이노베이션")
    assert N.norm_name("(주)우리금융지주") == "우리금융지주"
    assert N.norm_name("코오롱인더스트리 보통주 (주1)") == "코오롱인더스트리"
    assert N.norm_name("LS일렉트릭(*1)") == "ls일렉트릭"
    assert N.norm_name("세아베스틸지주(상장)") == "세아베스틸지주"
    assert N.norm_name("TheCapitalGroupCompanies,Inc.") == "thecapitalgroupcompanies"
    assert N.norm_name("티로우프라이스어소시에이트,인크.") == "티로우프라이스어소시에이트"


def test_alias_map_joins_english_and_korean_spellings():
    assert N.canonical("T.RowePriceAssociates,Inc.")[1] == "T. Rowe Price Associates"
    assert N.canonical("티로우프라이스어소시에이트,인크.")[1] == "T. Rowe Price Associates"
    assert N.canonical("국민연금")[1] == N.canonical("국민연금공단")[1] == "국민연금공단"
    # 서로 다른 법인은 묶지 않는다
    assert N.canonical("BlackRockFundAdvisors")[0] != N.canonical("BlackRock,Inc.")[0]


def test_person_detection():
    assert N.is_person_like("이재용")
    assert N.is_person_like("최윤범 외 3인")
    assert not N.is_person_like("삼성물산")
    assert not N.is_person_like("국민연금공단")
    assert not N.is_person_like("SK")


def test_listed_matching_exact_only():
    idx = N.build_listed_index([("003550", "LG"), ("066570", "LG전자"), ("005380", "현대차"),
                                ("033780", "KT&G"), ("120110", "코오롱인더"), ("010120", "LS ELECTRIC")])
    assert N.match_listed("엘지전자(주)", idx) == "066570"
    assert N.match_listed("(주)엘지", idx) == "003550"
    assert N.match_listed("현대자동차", idx) == "005380"
    assert N.match_listed("케이티앤지", idx) == "033780"
    assert N.match_listed("코오롱인더스트리 보통주 (주1)", idx) == "120110"
    assert N.match_listed("LS일렉트릭(*1)", idx) == "010120"
    assert N.match_listed("엘지전자우", idx) is None          # 없는 이름
    assert N.match_listed("LG전자(우)", idx) is None          # 우선주는 매칭하지 않는다
    assert N.match_listed("엘지디스플레이", idx) is None       # 부분 일치 없음


def test_ambiguous_listed_key_is_dropped():
    idx = N.build_listed_index([("000001", "가나다"), ("000002", "가나다(주)")])
    assert N.match_listed("가나다", idx) is None


# ---------------------------------------------------------------- 대량보유자

MAJOR_ROWS = [
    {"rcept_no": "20241025000530", "rcept_dt": "2024-10-25", "repror": "삼성물산", "stkrt": "20.08", "stkrt_irds": "0.00",
     "stkqy": "1,198,889,258", "report_tp": "일반"},
    {"rcept_no": "20260102000001", "rcept_dt": "2026-01-02", "repror": "삼성물산", "stkrt": "19.69", "stkrt_irds": "-0.39",
     "stkqy": "1,000", "report_tp": "일반"},
    {"rcept_no": "20260901000002", "rcept_dt": "2026-09-01", "repror": "국민연금공단", "stkrt": "7.10", "stkrt_irds": "0.40",
     "stkqy": "1", "report_tp": "약식"},
    {"rcept_no": "20260901000001", "rcept_dt": "2026-09-01", "repror": "국민연금공단", "stkrt": "6.70", "stkrt_irds": "-0.1",
     "stkqy": "1", "report_tp": "약식"},
    {"rcept_no": "20260801000001", "rcept_dt": "2026-08-01", "repror": "이재용", "stkrt": "5.5", "stkrt_irds": "0",
     "stkqy": "1", "report_tp": "일반"},
]


def test_latest_by_reporter_keeps_newest_report():
    rows = M.latest_by_reporter(MAJOR_ROWS)
    by = {r[2]: r for r in rows}
    assert by["삼성물산"][1] == "2026-01-02" and by["삼성물산"][3] == 19.69
    assert by["국민연금공단"][0] == "20260901000002"       # 같은 날이면 접수번호 큰 쪽
    assert by["국민연금공단"][4] == 0.4


def test_aggregate_holders_rules():
    today = date(2026, 10, 23)
    names = {"005930": "삼성전자", "000660": "SK하이닉스", "035420": "NAVER", "028260": "삼성물산", "999990": "옛회사"}
    comp = {
        "005930": {"r": M.latest_by_reporter(MAJOR_ROWS)},
        "000660": {"r": [["r1", "2026-05-01", "국민연금", 4.2, -0.9, 1, "약식"]]},           # 1년 안 5% 미만 보고
        "035420": {"r": [["r2", "2020-05-01", "국민연금공단", 4.0, -1.0, 1, "약식"],         # 오래된 5% 미만 → 뺌
                         ["r3", "2026-02-01", "삼성물산", 6.0, 6.0, 1, "일반"]]},
        "777770": {"r": [["r4", "2026-02-01", "국민연금공단", 9.0, 0, 1, "약식"]]},         # 상장 목록에 없음
    }
    idx = N.build_listed_index(names.items())
    hs = {h["name"]: h for h in M.aggregate_holders(comp, names, idx, today)}
    nps = hs["국민연금공단"]
    assert nps["n"] == 1                                     # 큐레이션 기관은 1사라도 싣는다
    assert [r[0] for r in nps["rows"]] == ["005930", "000660"]
    assert nps["rows"][1][-1] == 1 and len(nps["rows"][0]) == 7
    sam = hs["삼성물산"]
    assert sam["t"] == "028260" and sam["n"] == 2            # 상장사 보고자는 2사부터
    assert "이재용" not in hs                                 # 개인은 넣지 않는다


def test_plan_jobs_missing_first_then_recent_then_stale():
    today = date(2026, 10, 23)
    comp = {"B": {"f": "2026-10-20"}, "C": {"f": "2026-01-01"}, "D": {"f": "2026-10-22"}}
    recent = {"B": "2026-10-21", "D": "2026-10-01"}
    assert M.plan_jobs(["A", "B", "C", "D"], comp, recent, today) == ["A", "B", "C"]


def test_recent_filers():
    got = M.recent_filers({"majorHolders": [{"ticker": "5930", "fileDate": "2026-10-20"},
                                            {"ticker": "005930", "fileDate": "2026-10-22"}]})
    assert got == {"005930": "2026-10-22"}


# ---------------------------------------------------------------- 상장 지분 시가

OTR_ROWS = [
    {"rcept_no": "20260814002185", "inv_prm": "SK이노베이션㈜ ", "invstmnt_purps": "경영참가", "trmend_blce_qy": "88,052,777",
     "trmend_blce_qota_rt": "51.70", "trmend_blce_acntbk_amount": "6,711,550,000,000", "stlm_dt": "2026-06-30"},
    {"rcept_no": "20260814002185", "inv_prm": "SK실트론(주) ", "invstmnt_purps": "경영참가", "trmend_blce_qy": "34,181,910",
     "trmend_blce_qota_rt": "51.00", "trmend_blce_acntbk_amount": "622,606,000,000", "stlm_dt": "2026-06-30"},
    {"rcept_no": "20260814002185", "inv_prm": "VantAI Holdings, Inc", "invstmnt_purps": "경영참가", "trmend_blce_qy": "-",
     "trmend_blce_qota_rt": "0.00", "trmend_blce_acntbk_amount": "-", "stlm_dt": "2026-06-30"},
    {"rcept_no": "20260814002185", "inv_prm": "에스케이텔레콤", "invstmnt_purps": "경영참가", "trmend_blce_qy": "65,668,397",
     "trmend_blce_qota_rt": "30.57", "trmend_blce_acntbk_amount": "1", "stlm_dt": "2026-06-30"},
    {"rcept_no": "20260814002185", "inv_prm": "SKC", "invstmnt_purps": "경영참가", "trmend_blce_qy": "1,000",
     "trmend_blce_qota_rt": "42.0", "trmend_blce_acntbk_amount": "1", "stlm_dt": "2026-06-30"},
    {"rcept_no": "20260814002185", "inv_prm": "합계", "trmend_blce_qy": "1", "trmend_blce_qota_rt": "1",
     "trmend_blce_acntbk_amount": "1", "stlm_dt": "2026-06-30"},
]


def test_parse_rows_drops_totals_and_disposed():
    p = S.parse_rows(OTR_ROWS)
    assert p["asOf"] == "2026-06-30" and p["rc"] == "20260814002185"
    names = [r[0] for r in p["rows"]]
    assert "합계" not in names and "VantAI Holdings, Inc" not in names
    assert names[0] == "SK이노베이션"


def test_summarize_value_and_self_check():
    names = [("034730", "SK"), ("096770", "SK이노베이션"), ("017670", "SK텔레콤"), ("011790", "SKC")]
    idx = N.build_listed_index(names)
    prices = {"096770": {"price": 141700, "listedShares": 170_300_000},
              "017670": {"price": 76200, "listedShares": 214_790_000},
              "011790": {"price": 85700, "listedShares": 37_860_000}}
    rec = S.summarize("034730", S.parse_rows(OTR_ROWS), prices, idx, 334600.0, False)
    tickers = [x["t"] for x in rec["listed"]]
    assert tickers == ["096770", "017670"]                   # SKC 는 주식 수가 지분율과 안 맞아 뺐다
    assert rec["unverified"] == 1
    assert rec["listed"][0]["val"] == round(88_052_777 * 141700 / 1e8)
    assert rec["sum"] == sum(x["val"] for x in rec["listed"])
    assert rec["ratio"] == round(rec["sum"] / 334600 * 100, 1)
    assert rec["unlistedN"] == 1 and rec["unlistedBook"] == round(622_606_000_000 / 1e8)
    assert "할인" not in json.dumps(rec, ensure_ascii=False)


def test_parent_caps_include_preferred():
    caps = S.parent_caps([{"ticker": "003550", "marketCapB": 15.0}, {"ticker": "003555", "marketCapB": 0.5},
                          {"ticker": "034730", "marketCapB": 33.46}])
    assert caps["003550"] == (155000.0, True)
    assert caps["034730"][1] is False


# ---------------------------------------------------------------- FnGuide 연간 표 · FY2

ANNUAL_HTML = """
<table><thead><tr><th>5860</th></tr></thead></table>
<table><thead><tr><th class="r02c01"> 2024/12 <br/></th><th> 2025/12 </th><th> 2026/12(E) </th><th> 2027/12(E) </th></tr></thead>
<tbody>
<tr> <th class="bg txt title ">매출액</th> <td class="num" title="900.0"></td><td class="num" title="1,000.0"></td>
 <td class="num bgE" title="1,200.4"></td><td class="num bgE" title="1,500.0"></td> </tr>
<tr> <th class="bg txt title ">영업이익</th> <td title="90"></td><td title="100"></td><td title=""></td><td title=""></td> </tr>
<tr> <th class="bg txt title ">영업이익(발표기준)</th> <td title="90"></td><td title="100"></td><td title="150"></td>
 <td title="200"></td> </tr>
</tbody></table>
"""


def test_parse_fnguide_annual_falls_back_to_reported_op():
    a = C.parse_fnguide_annual(ANNUAL_HTML)
    assert a["cols"] == [("2024.12", False), ("2025.12", False), ("2026.12", True), ("2027.12", True)]
    assert a["rev"][2] == 1200.4
    assert a["op"] == [90, 100, 150, 200]


def test_fy2_estimates_requires_matching_fy1():
    a = C.parse_fnguide_annual(ANNUAL_HTML)
    rec = {"estimateFy": "2026.12", "revenueEstimate": 1200, "operatingEstimate": 150}
    assert C.fy2_estimates(rec, a) == {"revenueEstimate2": 1500, "operatingEstimate2": 200, "estimateFy2": "2027.12"}
    assert C.fy2_estimates({**rec, "revenueEstimate": 1300}, a) == {}        # FY1 이 1% 넘게 다르면 버린다
    assert C.fy2_estimates({"estimateFy": "2026.12"}, a) == {}               # FY1 이 없으면(오염 제외) FY2 도 없다


# ---------------------------------------------------------------- 컨센서스 이력

def _rec(tp, op=4.0, fy="2026.12", rev=100, opi=10, **kw):
    return {"targetPrice": tp, "opinionScore": op, "estimateFy": fy, "revenueEstimate": rev, "operatingEstimate": opi, **kw}


def test_merge_run_length_and_gaps():
    rows = []
    v = H.observe(_rec(100))
    rows = H.merge_observation(rows, "2026-09-01", v)
    rows = H.merge_observation(rows, "2026-09-02", v)
    assert len(rows) == 1 and rows[0][:2] == ["2026-09-01", "2026-09-02"]
    rows = H.merge_observation(rows, "2026-09-20", v)                     # 관측 공백이 길면 이어 붙이지 않는다
    assert len(rows) == 2
    rows = H.merge_observation(rows, "2026-09-21", H.observe(_rec(110)))
    assert len(rows) == 3
    rows = H.merge_observation(rows, "2026-09-21", H.observe(_rec(120)))  # 같은 날 재관측은 덮는다
    assert len(rows) == 3 and rows[-1][2] == 120


def test_observe_skips_carried():
    assert H.observe(_rec(100, carriedSince="2026-10-01")) is None


def test_changes_periods_and_fiscal_year_matching():
    rows = []
    rows = H.merge_observation(rows, "2026-07-20", H.observe(_rec(90, fy="2026.12", rev=80, estimateFy2="2027.12",
                                                                   revenueEstimate2=95, operatingEstimate2=12)))
    rows = H.merge_observation(rows, "2026-09-20", H.observe(_rec(100, op=3.8, rev=100, opi=10)))
    rows = H.merge_observation(rows, "2026-10-15", H.observe(_rec(100, op=3.8, rev=100, opi=10)))
    # 회계연도가 넘어갔다: 지금 FY1 = 2027.12
    rows = H.merge_observation(rows, "2026-10-23", H.observe(_rec(110, op=4.0, fy="2027.12", rev=99, opi=13)))
    ch = H.changes(rows, "2026-10-23")
    assert ch["tp1w"] == 10.0                     # 10-16 = 10-15 관측(1일 공백 허용)
    assert ch["tp1m"] == 10.0 and ch["op1m"] == 0.2
    assert "r1m" not in ch                        # 한 달 전엔 2027 추정 관측이 없다
    assert ch["r3m"] == round((99 / 95 - 1) * 100, 1)   # 석 달 전 FY2(2027) 와 비교
    assert ch["fy"] == "2027.12"
    assert ch["base"]["1m"] == "2026-09-20"


def test_changes_none_without_today_or_old_gap():
    rows = H.merge_observation([], "2026-09-01", H.observe(_rec(100)))
    assert H.changes(rows, "2026-10-23") is None
    rows = H.merge_observation(rows, "2026-10-23", H.observe(_rec(120)))
    ch = H.changes(rows, "2026-10-23")
    assert ch is None or ("tp1m" not in ch and "tp1w" not in ch)    # 비교할 관측이 7일 넘게 비어 있다


def test_attach_changes_skips_carried(tmp_path):
    path = tmp_path / "hist.json"
    p1 = {"stocks": {"A": _rec(100), "B": _rec(50)}}
    C.attach_changes(p1, today="2026-10-01", history_path=path)
    p2 = {"stocks": {"A": _rec(110), "B": {**_rec(50), "carriedSince": "2026-10-08"}}}
    C.attach_changes(p2, today="2026-10-08", history_path=path)
    assert p2["stocks"]["A"]["chg"]["tp1w"] == 10.0
    assert "chg" not in p2["stocks"]["B"]
    hist = json.loads(path.read_text(encoding="utf-8"))
    assert hist["s"]["B"][-1][1] == "2026-10-01"    # 승계분은 관측으로 쌓지 않는다
