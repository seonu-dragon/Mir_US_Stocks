"""실적 인사이트 빌더 2종의 순수 함수 테스트(오프라인).

- build_earnings_move_compare: 발표 시각(장전/장후) → 반응일, 분기 묶기, 만기 선택.
- build_earnings_releases: EX-99.1 찾기, LLM 숫자 가드(원문에 없는 숫자 버리기).
"""
from __future__ import annotations

from datetime import date, datetime, timezone

import build_earnings_move_compare as emc
import build_earnings_releases as er
import sec_client as sec


def et(y, m, d, hh, mm):
    return datetime(y, m, d, hh, mm, tzinfo=sec.ET_TZ)


def test_acceptance_is_real_utc():
    # AAPL 2026-07-30 실적 8-K: acceptanceDateTime 20:30:28Z = 16:30 EDT(장후)
    acc = emc.parse_acceptance("2026-07-30T20:30:28.000Z")
    assert acc.hour == 16 and acc.minute == 30
    assert emc.session_of(acc) == "amc"
    # 1월(EST)은 21:30Z 가 16:30
    assert emc.parse_acceptance("2026-01-29T21:30:33.000Z").hour == 16


def test_reaction_day_by_session():
    dates = ["2026-07-29", "2026-07-30", "2026-07-31", "2026-08-03"]
    assert dates[emc.reaction_index(dates, et(2026, 7, 30, 16, 30))] == "2026-07-31"  # 장후 → 다음날
    assert dates[emc.reaction_index(dates, et(2026, 7, 30, 6, 45))] == "2026-07-30"   # 장전 → 당일
    assert dates[emc.reaction_index(dates, et(2026, 7, 30, 11, 0))] == "2026-07-30"   # 장중 → 당일
    assert dates[emc.reaction_index(dates, et(2026, 7, 31, 17, 0))] == "2026-08-03"   # 금 장후 → 월


def test_past_reactions_uses_close_to_close():
    series = [
        [0, 0, 0, 100.0, 0, "2026-07-29"],
        [0, 0, 0, 100.0, 0, "2026-07-30"],
        [0, 0, 0, 90.0, 0, "2026-07-31"],
    ]
    ev = emc.past_reactions([{"acceptedEt": et(2026, 7, 30, 16, 30), "accession": "x"}], series)
    assert ev[0]["reactionDate"] == "2026-07-31"
    assert ev[0]["movePct"] == -10.0
    s = emc.summarize(ev)
    assert s["n"] == 1 and s["avgAbsPct"] == 10.0


def test_cluster_keeps_last_filing_of_quarter_and_matches_history():
    f = [
        {"acceptedEt": et(2026, 1, 8, 7, 0), "accession": "pre"},   # 예비실적
        {"acceptedEt": et(2026, 1, 20, 16, 5), "accession": "q4"},
        {"acceptedEt": et(2026, 4, 21, 16, 5), "accession": "q1"},
    ]
    out = emc.cluster_filings(f, [])
    assert [x["accession"] for x in out] == ["q4", "q1"]
    # 이력 범위 안에서 이력 날짜와 안 맞는 제출은 버린다
    out2 = emc.cluster_filings(f, ["2026-01-20", "2026-04-21"])
    assert [x["accession"] for x in out2] == ["q4", "q1"]


def test_backfill_only_when_sessions_consistent():
    f = [{"acceptedEt": et(2026, 1, 13, 6, 40), "accession": "a"},
         {"acceptedEt": et(2026, 4, 14, 6, 30), "accession": "b"}]
    out = emc.backfill_from_history(f, ["2025-07-15", "2025-10-14", "2026-01-13"])
    assert [x.get("inferred", False) for x in out] == [True, True, False, False]
    assert out[0]["acceptedEt"].hour == 7
    mixed = [f[0], {"acceptedEt": et(2026, 4, 14, 16, 30), "accession": "c"}]
    assert emc.backfill_from_history(mixed, ["2025-07-15"]) == mixed


def test_pick_first_expiry_on_or_after_reaction_day():
    ts = lambda d: int(datetime(d.year, d.month, d.day, tzinfo=timezone.utc).timestamp())  # noqa: E731
    exps = [ts(date(2026, 9, 25)), ts(date(2026, 10, 2)), ts(date(2026, 10, 9))]
    assert emc.pick_expiry(exps, date(2026, 10, 1)) == exps[1]
    assert emc.pick_expiry(exps, date(2026, 10, 2)) == exps[1]
    assert emc.pick_expiry(exps, date(2026, 10, 10)) is None


def test_upcoming_session_prefers_yahoo_then_history():
    ts = int(datetime(2026, 9, 30, 20, 0, tzinfo=timezone.utc).timestamp())  # 16:00 EDT
    assert emc.upcoming_session("2026-09-30", {"earningsTimestamp": ts}, []) == ("amc", "yahoo")
    past = [{"session": "bmo"}] * 4
    assert emc.upcoming_session("2026-09-30", {"earningsTimestamp": ts, "isEarningsDateEstimate": True}, past) == ("bmo", "history")
    assert emc.upcoming_session("2026-09-30", None, [{"session": "bmo"}, {"session": "amc"}]) == ("unknown", "")
    # 미상이면 다음 평일을 반응일로(장후 가정) — 장전이어도 그 만기에 포함된다
    assert emc.expected_reaction_day("2026-10-02", "unknown") == date(2026, 10, 5)
    assert emc.expected_reaction_day("2026-10-02", "bmo") == date(2026, 10, 2)


def test_find_exhibit_prefers_ex991():
    html = """<table>
    <tr><td>1</td><td>8-K</td><td><a href="/Archives/x/a.htm">a.htm</a></td><td>8-K</td></tr>
    <tr><td>2</td><td>EX-99.2</td><td><a href="/Archives/x/c.htm">c.htm</a></td><td>EX-99.2</td></tr>
    <tr><td>3</td><td>EX-99.1</td><td><a href="/Archives/x/b.htm">b.htm</a></td><td>EX-99.1</td></tr>
    </table>"""
    assert er.find_exhibit(html) == "/Archives/x/b.htm"
    assert er.find_exhibit("<table></table>") is None


def test_number_guard_drops_invented_numbers():
    source = "Fiscal 2026 results. Net sales were $93.9 billion, increased 11.2 percent. Diluted EPS $6.75. Revenue 1,234 million."
    summary = {
        "period": "fiscal 2026 fourth quarter",
        "oneLine": "매출 $93.9 billion, EPS $6.75.",
        "metrics": [
            {"label": "매출", "value": "$93.9 billion", "change": "increased 11.2 percent"},
            {"label": "순이익", "value": "$3.1 billion", "change": ""},        # 원문에 없음 → 버림
            {"label": "희석 EPS", "value": "$6.75", "change": "up 9%"},          # 변화율만 버림
            {"label": "매출(백만)", "value": "1234 million", "change": ""},      # 콤마 차이는 같은 수
        ],
        "guidance": "RAISED",
        "guidanceNote": "연간 매출 $400 billion 전망",                            # 원문에 없음 → 버림
    }
    clean, dropped = er.sanitize(summary, source)
    labels = [m["label"] for m in clean["metrics"]]
    assert labels == ["매출", "희석 EPS", "매출(백만)"]
    assert clean["metrics"][1]["change"] == ""
    assert clean["guidance"] == "raised"
    assert clean["guidanceNote"] == ""
    assert clean["oneLine"].startswith("매출")
    assert dropped == 3


def test_judgment_words_are_removed():
    clean, dropped = er.sanitize({"oneLine": "호실적을 기록했다", "guidance": "bogus"}, "text")
    assert clean["oneLine"] == "" and clean["guidance"] == "none" and dropped == 1


def test_parse_llm_json_tolerates_fences():
    assert er.parse_llm_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert er.parse_llm_json("nope") is None


def test_unit_guard_catches_scale_and_krw_conversion():
    src = "Revenue was $1.49 billion. Net loss (191,720) in thousands. Revenue $3,013,981. EPS $1.36."
    assert er.unit_problems("$1.49 billion", src) == []
    assert er.unit_problems("$1.36", src) == []
    assert er.unit_problems("(191,720) million", src)      # 표의 천 달러를 million 으로
    assert er.unit_problems("$3,013,981", src)              # 단위 모를 큰 금액
    assert er.unit_problems("99억 4천만 달러", src)          # 한글 단위 환산
    clean, dropped = er.sanitize({"metrics": [{"label": "순손실", "value": "$ (191,720) million"}]}, src)
    assert clean["metrics"] == [] and dropped == 1
