"""국내 의무보유(보호예수) 해제 일정(build_kr_lockups.py) 테스트. 오프라인.

fixtures/kr_lockups/table_<no>.html 은 38.co.kr 공모주 상세의 보호예수 표를 태그·rowspan/colspan 만
남기고 줄인 실제 표다(2026-09-27 수집). 주관사마다 양식이 달라 대표 양식 다섯 가지를 둔다:
  2294 기본(공모 전·후·매각제한·유통가능 8칸) · 2298 구분 열 없음 + 기간 칸 rowspan
  2252 유통가능 열이 매각제한보다 앞 · 2258 소계 행에 기간이 적힌 양식 · 2307 빈 라벨 칸·'공모 후 합계'
각 표의 '합계 매각제한물량' 과 블록 합이 같아야 한다(sumMatches) — 빌더가 해제 일정에 싣는 조건.

실행: py -m pytest -q scripts/tests/test_kr_lockups.py
"""
from __future__ import annotations

from datetime import date
from pathlib import Path

import pytest
from bs4 import BeautifulSoup

import build_kr_lockups as lk

FIX = Path(__file__).parent / "fixtures" / "kr_lockups"


def _table(no: str):
    html = (FIX / f"table_{no}.html").read_text(encoding="utf-8")
    return BeautifulSoup(html, "html.parser").find("table")


@pytest.mark.parametrize("no,lock_total,post_total", [
    ("2294", 7_445_880, 10_647_865),
    ("2298", 36_786_172, 49_439_111),
    ("2252", 6_192_276, 9_918_656),
    ("2258", 8_919_276, 13_770_379),
    ("2307", 8_361_586, 11_363_649),
])
def test_real_tables_sum_to_table_total(no, lock_total, post_total):
    r = lk.parse_lockup_table(_table(no))
    assert r["tableLockTotal"] == lock_total
    assert r["lockSum"] == lock_total
    assert r["sumMatches"] is True
    assert r["totalShares"] == post_total
    assert r["skipped"] == 0


def test_types_and_periods_2294():
    r = lk.parse_lockup_table(_table("2294"))
    by_type: dict[str, int] = {}
    for typ, shares, months, days, basis in r["blocks"]:
        by_type[typ] = by_type.get(typ, 0) + shares
    assert by_type["최대주주 등"] == 5_810_377
    assert by_type["우리사주"] == 104_124
    assert by_type["상장주선인"] == 45_454
    # 우리사주는 예탁일 기준(1년)
    assert any(b[0] == "우리사주" and b[2] == 12 and b[4] == "D" for b in r["blocks"])
    # 최대주주 3년
    assert any(b[0] == "최대주주 등" and b[1] == 4_772_405 and b[2] == 36 for b in r["blocks"])


def test_period_rowspan_is_inherited_2298():
    """기간 칸이 rowspan=2 면 아래 행(기간 칸 없음)도 같은 기간이다."""
    r = lk.parse_lockup_table(_table("2298"))
    one_month = [b[1] for b in r["blocks"] if b[2] == 1]
    assert 2_380_592 in one_month          # 인터베스트 두 번째 줄(~1개월 rowspan)
    thirty = [b[1] for b in r["blocks"] if b[2] == 30]
    assert 65_574 in thirty                # 심재우 세 번째 줄(~30개월 rowspan)


def test_swapped_columns_2252():
    r = lk.parse_lockup_table(_table("2252"))
    major = sum(b[1] for b in r["blocks"] if b[0] == "최대주주 등")
    assert major == 5_200_000              # 유통가능이 앞 열인 양식 — 매각제한은 뒤 열
    assert all(b[2] in (1, 3, 12) for b in r["blocks"])


@pytest.mark.parametrize("text,expected", [
    ("~3년", (36, 0, "listing")),
    ("상장  후 6개월", (6, 0, "listing")),
    ("예탁일로부터   1년", (12, 0, "deposit")),
    ("1년 6개월", (18, 0, "listing")),
    ("상장일로부터 1.5년", (18, 0, "listing")),
    ("~30개월", (30, 0, "listing")),
    ("~15일", (0, 15, "listing")),
    ("-", None),
    ("합병 후 6개월", None),
])
def test_parse_period(text, expected):
    p = lk.parse_period(text)
    if expected is None:
        assert p is None
    else:
        assert (p["months"], p["days"], p["basis"]) == expected


def test_add_period_month_end():
    assert lk.add_period("2026-09-29", 1, 0) == "2026-10-29"
    assert lk.add_period("2026-01-31", 1, 0) == "2026-02-28"
    assert lk.add_period("2026-08-24", 0, 15) == "2026-09-08"
    assert lk.add_period("2026-09-29", 36, 0) == "2029-09-29"


def test_parse_numbers():
    assert lk.parse_int("1,533,250") == 1_533_250
    assert lk.parse_int("1.533.250") == 1_533_250   # 원문 오타(마침표 천 단위)
    assert lk.parse_int("-") is None
    assert lk.parse_ratio("1,375.34 :1 (비례 2751:1)") == 1375.34
    assert lk.parse_ratio("-") is None
    assert lk.parse_pct("18.14%") == 18.14
    assert lk.is_value_cell("0.00_")               # % 자리 오타


LIST_HTML = """<table><tr><td>기업명</td><td>예측일</td><td>공모희망가(원)</td><td>공모가(원)</td>
<td>공모금액 (백만원)</td><td>기관 경쟁률</td><td>의무보유 확약</td><td>주간사</td></tr>
<tr><td><a href="./?o=v&no=2294&l=&page=1">빅웨이브로보틱스</a></td><td>2026.09.07</td><td>15,000~18,000</td>
<td>18,000</td><td>28,800</td><td>1109.37:1</td><td>18.14%</td><td>유진투자증권,미래에셋증권</td></tr>
<tr><td><a href="./?o=v&no=2300&l=&page=1">한국스팩17호</a></td><td>2026.09.07</td><td>2,000~2,000</td>
<td>2,000</td><td>14,000</td><td>1270.51:1</td><td>-</td><td>한국투자증권</td></tr></table>"""

DETAIL_HTML = """<html><body><table>
<tr><td>종목명</td><td>빅웨이브로보틱스</td><td>진행상황</td><td>공모주</td></tr>
<tr><td>시장구분</td><td>코스닥</td><td>종목코드</td><td>&nbsp; 0035S0</td></tr>
<tr><td>청약경쟁률</td><td>&nbsp; 1375.34:1 (비례 2751:1)</td></tr>
<tr><td>확정공모가</td><td><b>18,000</b> 원</td></tr>
<tr><td>기관경쟁률</td><td>1109.37:1</td><td>의무보유확약</td><td>18.14%</td></tr>
<tr><td>신규상장일</td><td> 2026.09.29 </td></tr>
<tr><td>15일 확약</td><td>134,410,000</td></tr><tr><td>1개월 확약</td><td>30,686,000</td></tr>
<tr><td>3개월 확약</td><td>29,859,000</td></tr><tr><td>6개월 확약</td><td>14,817,000</td></tr>
</table>""" + (FIX / "table_2294.html").read_text(encoding="utf-8") + "</body></html>"


def test_parse_list_page():
    rows = lk.parse_list_page(LIST_HTML)
    assert [r["no"] for r in rows] == ["2294", "2300"]
    assert rows[0]["instCompetition"] == 1109.37 and rows[0]["commitPct"] == 18.14
    assert rows[0]["demandDate"] == "2026-09-07" and rows[0]["offerPrice"] == 18000
    assert rows[1]["commitPct"] is None


def test_parse_detail_fields():
    d = lk.parse_detail(DETAIL_HTML)
    assert d["code"] == "0035S0" and d["market"] == "코스닥"
    assert d["listingDate"] == "2026-09-29"
    assert d["subscriptionCompetition"] == 1375.34
    assert d["instCompetition"] == 1109.37 and d["commitPct"] == 18.14
    assert d["offerPrice"] == 18000
    assert d["commitBreakdown"] == {"15d": 134_410_000, "1m": 30_686_000, "3m": 29_859_000, "6m": 14_817_000}
    assert d["hasTable"] and d["sumMatches"]


def test_collect_and_releases_offline():
    today = date(2026, 9, 27)
    fetched = []

    def get_detail(no):
        fetched.append(no)
        return DETAIL_HTML

    ipos, stats = lk.collect(lk.parse_list_page(LIST_HTML), {}, get_detail, today, max_fetch=10)
    assert fetched == ["2294"]                     # 스팩은 상세를 받지 않는다
    assert stats["spac"] == 1 and stats["fetched"] == 1
    spac = next(r for r in ipos if r.get("spac"))
    assert spac["instCompetition"] == 1270.51 and "blocks" not in spac
    rel = lk.build_releases(ipos, today)
    first = rel[0]
    assert first["code"] == "0035S0" and first["date"] == "2026-10-29"   # 상장 + 1개월
    assert first["shares"] == sum(first["types"].values())
    assert first["pct"] == round(first["shares"] / 10_647_865 * 100, 2)
    dates = [r["date"] for r in rel]
    assert "2029-09-29" in dates                                          # 최대주주 3년
    assert dates == sorted(dates)
    # 브라우저용 요약은 블록을 싣지 않는다
    slim = lk.browser_payload({"ipos": ipos, "releases": rel})
    assert all("blocks" not in r for r in slim["ipos"])
    assert next(r for r in slim["ipos"] if r.get("code") == "0035S0")["lockedPct"] == round(7_445_880 / 10_647_865 * 100, 2)


def test_unverified_table_is_not_published():
    today = date(2026, 9, 27)
    ipo = {"no": "1", "company": "가", "code": "000001", "listingDate": "2026-09-01", "totalShares": 100,
           "blocks": [["최대주주 등", 50, 12, 0, "L"]], "sumMatches": False}
    assert lk.build_releases([ipo], today) == []
    ipo["sumMatches"] = True
    assert lk.build_releases([ipo], today)[0]["pct"] == 50.0


def test_needs_refresh():
    today = date(2026, 9, 27)
    assert lk.needs_refresh(None, today)
    assert lk.needs_refresh({"listingDate": None}, today)
    assert lk.needs_refresh({"listingDate": "2026-09-26"}, today)       # 상장 직후 3일까지는 다시
    assert not lk.needs_refresh({"listingDate": "2026-08-01"}, today)


def test_ipo_calendar_attaches_demand_stats(tmp_path):
    import json
    import build_kr_ipo_calendar as ipo
    p = tmp_path / "lockups.json"
    p.write_text(json.dumps({"ipos": [
        {"company": "영광", "instCompetition": 900.5, "commitPct": 12.3, "subscriptionCompetition": 1500.1},
        {"company": "빈값", "instCompetition": None},
    ]}, ensure_ascii=False), encoding="utf-8")
    rows = [{"company": "영광(구.영광공작소)"}, {"company": "빈값"}, {"company": "없는회사"}]
    assert ipo.attach_demand_stats(rows, p) == 1
    assert rows[0]["instCompetition"] == 900.5 and rows[0]["commitPct"] == 12.3
    assert "instCompetition" not in rows[1] and "commitPct" not in rows[2]
    assert ipo.attach_demand_stats(rows, tmp_path / "missing.json") == 0
