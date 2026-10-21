"""미국 다크풀(ATS) 주간 비중(build_finra_ats.py) 테스트. 오프라인 — FINRA 응답은 가짜 post 로 흉내 낸다."""
from datetime import date

import build_finra_ats as fa


def _fake_post(pages):
    """pages: {(week, tier): [rows…]} → post(body) 가 offset·limit 로 잘라 준다."""
    calls = []

    def post(body):
        calls.append(body)
        f = {x["fieldName"]: x["fieldValue"] for x in body["compareFilters"]}
        rows = pages.get((f["weekStartDate"], f["tierIdentifier"]), [])
        off = body.get("offset", 0)
        lim = body["limit"]
        return rows[off:off + lim], len(rows)
    post.calls = calls
    return post


def _row(sym, q):
    return {"issueSymbolIdentifier": sym, "totalWeeklyShareQuantity": q}


def test_fetch_week_paginates_and_sums(monkeypatch):
    monkeypatch.setattr(fa, "PAGE", 2)
    post = _fake_post({("2026-09-28", "T1"): [_row("nvda", 10), _row("AAPL", 5), _row("NVDA", 1), _row("", 9), _row("X", None)]})
    assert fa.fetch_week("2026-09-28", "T1", post) == {"NVDA": 11, "AAPL": 5}
    assert len(post.calls) == 3
    assert fa.fetch_week("2026-10-05", "T1", post) == {}


def test_latest_published_walks_back_from_last_week():
    post = _fake_post({("2026-09-28", "T1"): [_row("A", 1)], ("2026-09-14", "T2"): [_row("B", 1)]})
    today = date(2026, 10, 22)   # 목요일 → 이번 주 월요일 10-19, 지난주부터 본다
    assert fa.latest_published("T1", today, post) == "2026-09-28"
    assert fa.latest_published("T2", today, post) == "2026-09-14"
    assert fa.latest_published("T1", date(2027, 6, 1), post) is None


def test_week_volume_sums_mon_to_fri_only():
    series = [[1, 1, 1, 1, 100, "2026-09-25"], [1, 1, 1, 1, 10, "2026-09-28"], [1, 1, 1, 1, 20, "2026-10-02"],
              [1, 1, 1, 1, 0, "2026-09-30"], [1, 1, 1, 1, 999, "2026-10-05"], "junk", [1, 2]]
    assert fa.week_volume(series, "2026-09-28") == 30
    assert fa.week_volume(series, "2026-08-03") is None


def test_build_tickers_pct_tier_and_guards():
    weeks = {"T1": ["2026-09-21", "2026-09-28"], "T2": ["2026-09-07", "2026-09-14"]}
    ats = {"T1": {"2026-09-21": {"NVDA": 30, "BAD": 500}, "2026-09-28": {"NVDA": 40, "MOVE": 5}},
           "T2": {"2026-09-07": {"SMALL": 2, "MOVE": 3}, "2026-09-14": {"SMALL": 3}}}
    vols = {
        "NVDA": [[0, 0, 0, 0, 100, "2026-09-22"], [0, 0, 0, 0, 100, "2026-09-29"]],
        "SMALL": [[0, 0, 0, 0, 20, "2026-09-08"], [0, 0, 0, 0, 30, "2026-09-15"]],
        "BAD": [[0, 0, 0, 0, 100, "2026-09-22"]],             # ATS 가 전체보다 많다 → 비중 없음 → 빠짐
        "MOVE": [[0, 0, 0, 0, 10, "2026-09-08"], [0, 0, 0, 0, 50, "2026-09-29"]],
    }
    out = fa.build_tickers(["NVDA", "SMALL", "BAD", "MOVE", "NONE"], weeks, ats, lambda t: vols.get(t, []))
    assert out["NVDA"] == ["T1", 40, [30.0, 40.0]]
    assert out["SMALL"] == ["T2", 3, [10.0, 10.0]]
    assert "BAD" not in out and "NONE" not in out
    assert out["MOVE"] == ["T1", 5, [None, 10.0]]          # 티어가 바뀌면 최근 주에 값이 있는 쪽
