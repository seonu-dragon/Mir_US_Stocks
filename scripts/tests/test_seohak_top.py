"""서학개미 TOP(SEIBro 미국 주식 보관·결제 상위) 빌더 테스트 — 네트워크 없음.

응답 모양은 2026-10-02 실측 SEIBro websquare 응답을 줄인 것이다.
"""
from __future__ import annotations

from datetime import date

import build_seohak_top as S

CUSTODY_XML = """<?xml version="1.0" encoding="UTF-8" ?>
<vector result="2">
  <data vectorkey="0" type="Document">
    <result><RNUM value="1"/><NATION_NM value="미국"/><ISIN value="US88160R1014"/><KOR_SECN_NM value="TESLA INC"/><SUM_FRSEC_AMT value="20614299294"/></result>
  </data>
  <data vectorkey="1" type="Document">
    <result><RNUM value="2"/><NATION_NM value="미국"/><ISIN value="US9229083632"/><KOR_SECN_NM value="VANGUARD SP 500 ETF SPLR 39326002188 US9229084135"/><SUM_FRSEC_AMT value="5439096708"/></result>
  </data>
</vector>"""

SETTLE_XML = """<?xml version="1.0" encoding="UTF-8" ?>
<vector result="1">
  <data vectorkey="0" type="Document">
    <result><RNUM value="1"/><NATION_NM value="미국"/><ISIN value="US02079K3059"/><KOR_SECN_NM value="ALPHABET INC CL A"/><SUM_FRSEC_BUY_AMT value="132354834"/><SUM_FRSEC_SELL_AMT value="35572861"/><SUM_FRSEC_TOT_AMT value="167927695"/><SUM_FRSEC_NET_BUY_AMT value="96781973"/></result>
  </data>
</vector>"""


def test_parse_custody_and_settle():
    rows = S.parse_rows(CUSTODY_XML)
    assert [r["rank"] for r in rows] == [1, 2]
    assert rows[0]["isin"] == "US88160R1014" and rows[0]["amount"] == 20614299294.0
    s = S.parse_rows(SETTLE_XML)[0]
    assert (s["buy"], s["sell"], s["net"]) == (132354834.0, 35572861.0, 96781973.0)
    assert s["amount"] is None


def test_empty_vector():
    assert S.parse_rows('<?xml version="1.0"?><vector result="0"></vector>') == []


def test_clean_name_strips_corporate_action_tail():
    assert S.clean_name("VANGUARD SP 500 ETF SPLR 39326002188 US9229084135") == "VANGUARD SP 500 ETF"
    assert S.clean_name("ALPHABET INC CL C CHAN 39527405649 US38259P7069") == "ALPHABET INC CL C"
    assert S.clean_name("DIREXION DAILY SEMICONDUCTORS BULL 3X SH") == "DIREXION DAILY SEMICONDUCTORS BULL 3X SH"


def test_resolve_ticker_prefers_new_isin_then_cusip_cache():
    row = {"isin": "US9229083632", "rawName": "VANGUARD SP 500 ETF SPLR 39326002188 US9229084135"}
    assert S.isin_candidates(row) == ["US9229084135", "US9229083632"]
    assert S.resolve_ticker(row, {"922908363": "VOO"}, {}) == "VOO"           # 옛 ISIN 의 CUSIP 캐시
    assert S.resolve_ticker(row, {}, {"US9229084135": "VOO"}) == "VOO"         # 새 ISIN OpenFIGI 결과
    assert S.resolve_ticker(row, {}, {"US9229084135": ""}) is None              # 조회했지만 없음


def test_figi_isin_lookup_batches():
    calls = []

    def post(body):
        calls.append(body)
        return [{"data": [{"ticker": "BRK/B"}]} if b["idValue"] == "US0846707026" else {"warning": "No identifier"}
                for b in body]

    out = S.figi_isin_lookup(["US0846707026"] + [f"US00000000{i}0" for i in range(10)], post=post, sleep=lambda s: None)
    assert len(calls) == 2 and all(b["idType"] == "ID_ISIN" for b in calls[0])
    assert out["US0846707026"] == "BRK.B" and out["US0000000000"] == ""


def test_rank_change_against_week_old_list():
    hist = [{"date": "2026-09-20", "isins": ["A", "B"]}, {"date": "2026-09-23", "isins": ["B", "A"]},
            {"date": "2026-09-28", "isins": ["X"]}]
    base = S.baseline(hist, "2026-09-30")     # 09-23 이전 중 가장 최근 = 09-23
    assert base["date"] == "2026-09-23"
    rows = [{"isin": "A"}, {"isin": "C"}]
    S.attach_changes(rows, base)
    assert rows[0]["prevRank"] == 2 and rows[0]["isNew"] is False
    assert rows[1]["prevRank"] is None and rows[1]["isNew"] is True


def test_no_baseline_means_unknown_not_new():
    rows = [{"isin": "A"}]
    S.attach_changes(rows, S.baseline([{"date": "2026-09-28", "isins": ["A"]}], "2026-09-30"))
    assert rows[0]["prevRank"] is None and rows[0]["isNew"] is None


def test_remember_replaces_same_day_and_caps():
    hist = [{"date": f"2026-07-{d:02d}", "isins": []} for d in range(1, 31)] + \
           [{"date": f"2026-08-{d:02d}", "isins": []} for d in range(1, 31)]
    out = S.remember(hist, "2026-08-30", [{"isin": "Z"}])
    assert len(out) == S.HISTORY_KEEP and out[-1] == {"date": "2026-08-30", "isins": ["Z"]}


def test_build_end_to_end_offline(monkeypatch, tmp_path):
    monkeypatch.setattr(S, "STATE", tmp_path / "state.json")
    monkeypatch.setattr(S, "SNAPSHOT", tmp_path / "snap.json")
    monkeypatch.setattr(S, "CUSIP_CACHES", ())
    (tmp_path / "snap.json").write_bytes(b'{"stocks":[{"ticker":"TSLA"},{"ticker":"GOOGL"}]}')
    seen = []

    def fake_post(body):
        seen.append(body)
        if "CusRemaList" in body:
            return CUSTODY_XML if 'START_DT value="20260930"' in body else '<vector result="0"></vector>'
        return SETTLE_XML

    monkeypatch.setattr(S, "_post", fake_post)
    figi = lambda isins: {i: {"US88160R1014": "TSLA", "US9229084135": "VOO"}.get(i, "") for i in isins}
    payload, state = S.build(date(2026, 10, 2), figi=figi)
    lists = payload["lists"]
    assert lists["custody"]["date"] == "2026-09-30"       # 10-02 기준 2일 전부터 찾음
    assert lists["net_1w"]["date"] == "2026-10-01" and lists["net_1w"]["start"] == "2026-09-25"
    assert lists["net_1m"]["start"] == "2026-09-02"
    assert set(lists) == {"custody", "buy_1w", "sell_1w", "net_1w", "buy_1m", "sell_1m", "net_1m"}
    c = lists["custody"]["rows"]
    assert c[0]["t"] == "TSLA" and c[0]["inUniverse"] is True
    assert c[1]["t"] == "VOO" and c[1]["inUniverse"] is False and c[1]["name"] == "VANGUARD SP 500 ETF"
    assert payload["count"] == 2 + 6
    assert state["history"]["custody"][-1]["isins"] == ["US88160R1014", "US9229083632"]
    assert sum("NET" in b or 'D_TYPE value="4"' in b for b in seen) >= 1
