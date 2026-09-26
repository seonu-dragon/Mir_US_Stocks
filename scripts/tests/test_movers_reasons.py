"""오늘의 특징주 빌더(build_movers_reasons.py)의 정직성 규칙 — 오프라인.

LLM 출력은 믿지 않는다: 입력 근거 목록에 없는 ID 를 인용하거나, 근거에 없는 숫자를
쓰거나, 스스로 '다른 회사 얘기'·'방향 설명 못 함' 이라고 답하면 사유로 쓰지 않는다.
"""
from __future__ import annotations

import build_movers_reasons as b


def _stock(change=12.5, evidence=None, sector=None, cluster=None):
    s = {
        "ticker": "044450", "company": "KSS해운", "industry": "해운", "sector": "산업재",
        "changePct": change, "close": 11730.0, "tradingValue": 1e10, "marketCapB": 0.3,
        "_evidence": evidence if evidence is not None else [
            {"id": "E1", "type": "disclosure", "title": "DART: 주요사항보고서(자기주식취득결정)",
             "link": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=1", "source": "DART", "date": "2026-09-23"},
            {"id": "E2", "type": "news", "title": "KSS해운, 198억원 자사주 매입 나선다",
             "link": "https://example.com/a", "source": "example.com", "date": "2026-09-23"},
        ],
        "_sector": sector,
    }
    if cluster:
        s["_cluster"] = cluster
    return s


def test_valid_row_is_ok_and_links_come_from_input():
    s = _stock()
    status, cited, reason = b.validate_llm_row(s, {"reason": "198억원 규모 자사주 매입 결정", "evidence": ["E1", "E2"],
                                                   "same_company": True, "explains_move": True})
    assert status == "ok"
    assert [e["id"] for e in cited] == ["E1", "E2"]
    assert reason == "198억원 규모 자사주 매입 결정"


def test_unknown_evidence_id_fails():
    s = _stock()
    status, cited, _ = b.validate_llm_row(s, {"reason": "자사주 매입", "evidence": ["E9"]})
    assert status == "failed" and cited == []


def test_invented_number_fails():
    s = _stock()
    status, _, _ = b.validate_llm_row(s, {"reason": "500억원 자사주 매입", "evidence": ["E2"]})
    assert status == "failed"


def test_self_reported_mismatch_becomes_no_material():
    s = _stock()
    for flags in ({"same_company": False}, {"explains_move": False}):
        status, cited, reason = b.validate_llm_row(s, {"reason": "게임 흥행", "evidence": ["E2"], **flags})
        assert status == "none" and cited == [] and reason == b.NO_MATERIAL


def test_no_citation_fails():
    s = _stock()
    status, _, _ = b.validate_llm_row(s, {"reason": "자사주 매입", "evidence": []})
    assert status == "failed"


def test_sector_evidence_cannot_be_cited_by_llm():
    ev = [{"id": "E1", "type": "sector", "title": "같은 업종(해운) 9종목 시총가중 평균 +5.0%", "link": "", "source": "스냅샷", "date": ""}]
    s = _stock(evidence=ev)
    status, _, _ = b.validate_llm_row(s, {"reason": "해운 업종 강세", "evidence": ["E1"]})
    assert status == "failed"


def test_finalize_prefers_sector_when_no_material():
    ctx = {"level": "업종", "name": "건설", "avgPct": -4.0, "n": 50}
    ev = [{"id": "E1", "type": "sector", "title": "x", "link": "", "source": "스냅샷", "date": ""}]
    s = _stock(change=-7.2, evidence=ev, sector=ctx)
    row = b.finalize(s, "none", b.NO_MATERIAL, [])
    assert row["reasonStatus"] == "sector"
    assert row["tags"] == ["섹터동조"]
    assert "건설 업종 동반 하락" in row["reason"]
    assert not any(k.startswith("_") for k in row)


def test_finalize_failed_keeps_label_not_reason():
    s = _stock()
    row = b.finalize(s, "failed", "", [])
    assert row["reasonStatus"] == "failed" and row["reason"] == ""


def test_sector_sync_threshold():
    s = {"changePct": 10.0}
    assert b.sector_is_sync(s, {"avgPct": 3.5})
    assert not b.sector_is_sync(s, {"avgPct": 2.5})      # 종목 등락의 30% 미만
    assert not b.sector_is_sync(s, {"avgPct": -4.0})     # 방향 반대
    assert not b.sector_is_sync({"changePct": 4.0}, {"avgPct": 1.5})  # 2% 미만


def test_board_clusters_need_three():
    movers = {"up": [{"ticker": t, "company": t, "industry": "반도체"} for t in ("A", "B", "C")]
              + [{"ticker": "D", "company": "D", "industry": "해운"}], "down": []}
    cl = b.board_clusters(movers)
    assert set(cl) == {"A", "B", "C"}
    assert [m["ticker"] for m in cl["A"]] == ["B", "C"]


def test_short_company_and_title_matching():
    assert b.short_company("Klaviyo Inc. Series A") == "Klaviyo"
    assert b.short_company("CrowdStrike Holdings Inc. Class A") == "CrowdStrike"
    terms = b.name_terms({"ticker": "PANW", "company": "Palo Alto Networks Inc."}, "us")
    assert b.title_mentions("PANW Stock Gains After Revenue Forecast Beat", terms)
    assert not b.title_mentions("Stock market today: Dow slips", terms)
    # 짧은 대문자 티커는 단어 경계로만(‘Z’ 가 아무 단어에나 걸리지 않게)
    assert not b.title_mentions("Zillow-free headline about zebras", ["Z"])


# --- 거래일 판정: 2026-09-26 run 36202139416 재현 ------------------------------------
# 스냅샷 priceDate 는 2026-09-25 인데, 00:00 UTC 뒤에 받은 야후·상세 일봉은 마지막 봉이
# 09-24 였다. 예전 판정(야후 일봉 다수결)은 {'2026-09-23': 1} 로 끝나 보드가 멈췄다.

import json
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")
NOW = datetime(2026, 9, 26, 0, 30, tzinfo=timezone.utc)   # 09-25 20:30 ET


def _ts(day: str, hh=9, mm=30) -> int:
    y, m, d = map(int, day.split("-"))
    return int(datetime(y, m, d, hh, mm, tzinfo=ET).timestamp())


def _chart(bars: list[tuple[str, float, float]], meta_day: str | None, meta_price=None, meta_vol=None) -> dict:
    meta = {"exchangeTimezoneName": "America/New_York"}
    if meta_day:
        meta.update({"regularMarketTime": _ts(meta_day, 16, 0), "regularMarketPrice": meta_price,
                     "regularMarketVolume": meta_vol})
    return {"meta": meta, "timestamp": [_ts(d) for d, _, _ in bars],
            "indicators": {"quote": [{"close": [c for _, c, _ in bars], "volume": [v for _, _, v in bars]}]}}


def test_snapshot_price_date_wins_without_network(monkeypatch):
    def boom(_t):
        raise AssertionError("priceDate 가 있으면 야후를 부르지 않는다")
    monkeypatch.setattr(b, "yahoo_bars", boom)
    snap = {"priceDate": "2026-09-25", "stocks": [{"ticker": "AAPL", "changePct": 1.5, "marketCapB": 3000}]}
    assert b.resolve_trade_date(snap, b.MARKETS["us"], "us", now=NOW) == "2026-09-25"


def test_snapshot_price_date_rejects_bad_values():
    assert b.snapshot_price_date({"priceDate": "2026-09-27"}, now=NOW) is None    # 일요일
    assert b.snapshot_price_date({"priceDate": "2026-09-26"}, now=NOW) is None    # 토요일
    # 장이 안 끝난 날
    assert b.snapshot_price_date({"priceDate": "2026-09-25"},
                                 now=datetime(2026, 9, 25, 15, 0, tzinfo=ET)) is None
    assert b.snapshot_price_date({"priceDate": "garbage"}, now=NOW) is None
    assert b.snapshot_price_date({}, now=NOW) is None


def test_old_snapshot_without_price_date_falls_back_to_vote(monkeypatch):
    calls = []
    monkeypatch.setattr(b, "yahoo_bars", lambda t: calls.append(t) or {})
    snap = {"stocks": [{"ticker": "AAPL", "changePct": 1.5, "marketCapB": 3000, "sector": "TECH"}]}
    assert b.resolve_trade_date(snap, b.MARKETS["us"], "us", now=NOW) is None
    assert calls == ["AAPL"]


def test_yahoo_meta_fills_missing_last_bar():
    res = _chart([("2026-09-23", 100.0, 1e6), ("2026-09-24", 110.0, 2e6)], "2026-09-25", 99.0, 3e6)
    bars = b.parse_yahoo_chart(res, now=NOW)
    assert bars["2026-09-25"]["fromMeta"] is True
    assert abs(bars["2026-09-25"]["changePct"] - (99.0 / 110.0 - 1) * 100) < 1e-9
    assert bars["2026-09-25"]["volume"] == 3e6


def test_yahoo_meta_not_used_when_two_bars_missing_or_session_open():
    # 09-23 다음 거래일은 09-24 — 09-25 시세의 전일 종가를 모른다.
    res = _chart([("2026-09-22", 100.0, 1e6), ("2026-09-23", 110.0, 2e6)], "2026-09-25", 99.0, 3e6)
    assert "2026-09-25" not in b.parse_yahoo_chart(res, now=NOW)
    res = _chart([("2026-09-23", 100.0, 1e6), ("2026-09-24", 110.0, 2e6)], "2026-09-25", 99.0, 3e6)
    assert "2026-09-25" not in b.parse_yahoo_chart(res, now=datetime(2026, 9, 25, 14, 0, tzinfo=ET))
    # 월요일 시세의 직전 거래일은 금요일(주말 건너뜀)
    res = _chart([("2026-09-24", 100.0, 1e6), ("2026-09-25", 110.0, 2e6)], "2026-09-28", 121.0, 3e6)
    bars = b.parse_yahoo_chart(res, now=datetime(2026, 9, 29, 1, 0, tzinfo=timezone.utc))
    assert abs(bars["2026-09-28"]["changePct"] - 10.0) < 1e-9


def _write_detail(path, ticker, last_day="2026-09-24"):
    days = [f"2026-09-{d:02d}" for d in (10, 11, 14, 15, 16, 17, 18, 21, 22, 23, 24) if f"2026-09-{d:02d}" <= last_day]
    series = [[10, 11, 9, 10.0, 5_000_000, d] for d in days]
    (path / f"{ticker}.json").write_text(json.dumps({"chartSeries": series}), encoding="utf-8")


def test_pick_movers_on_0926_like_day(monkeypatch, tmp_path):
    """상세 일봉 마지막 09-24 · 야후 일봉도 09-24 까지 · 기준일 09-25."""
    for t in ("MET", "SNAP", "OLD", "NOPE"):
        _write_detail(tmp_path, t)
    cfg = {**b.MARKETS["us"], "details": tmp_path}
    charts = {
        # 야후 meta 로 확인(10.0 → 10.8, +8%)
        "MET": _chart([("2026-09-23", 10.0, 5e6), ("2026-09-24", 10.0, 6e6)], "2026-09-25", 10.8, 7e6),
    }
    monkeypatch.setattr(b, "yahoo_bars", lambda t: b.parse_yahoo_chart(charts[t], now=NOW) if t in charts else {})
    snap = {"priceDate": "2026-09-25", "stocks": [
        {"ticker": "MET", "company": "Meta Filled", "changePct": 8.0, "marketCapB": 50, "price": 10.8,
         "priceDate": "2026-09-25", "volumeRatio": 1.2},
        # 야후 실패 → 그 종목 priceDate 가 기준일인 스냅샷 값으로
        {"ticker": "SNAP", "company": "Snap Fallback", "changePct": -6.0, "marketCapB": 20, "price": 9.4,
         "priceDate": "2026-09-25", "volumeRatio": 2.0},
        # 그 종목 priceDate 가 하루 늦음 → 날짜 확인 불가, 뺀다
        {"ticker": "OLD", "company": "Old Date", "changePct": 7.0, "marketCapB": 20, "price": 10.7,
         "priceDate": "2026-09-24", "volumeRatio": 2.0},
        # priceDate 없음(스크리너 값) → 뺀다
        {"ticker": "NOPE", "company": "No Date", "changePct": -9.0, "marketCapB": 20, "price": 9.1,
         "volumeRatio": 2.0},
    ]}
    monkeypatch.setattr(b.time, "sleep", lambda _s: None)
    out = b.pick_movers(snap, cfg, "us", "2026-09-25")
    assert [m["ticker"] for m in out["up"]] == ["MET"]
    assert out["up"][0]["priceSource"] == "yahoo-meta"
    assert abs(out["up"][0]["changePct"] - 8.0) < 0.01
    assert out["up"][0]["tradingValue"] == round(10.8 * 7e6)
    assert [m["ticker"] for m in out["down"]] == ["SNAP"]
    assert out["down"][0]["priceSource"] == "snapshot"
    assert out["down"][0]["tradingValue"] is None    # 추정 거래량 값은 싣지 않는다


def test_new_trade_date_ignores_previous_two_attempts(monkeypatch, tmp_path):
    """09-23 보드가 llm_failed 2회여도 09-25 는 새 거래일 — 첫 시도로 진행한다."""
    out_json = tmp_path / "movers_reasons.json"
    out_json.write_text(json.dumps({"tradeDate": "2026-09-23", "status": "llm_failed", "attempt": 2}), encoding="utf-8")
    snap_path = tmp_path / "snap.json"
    snap_path.write_text(json.dumps({"priceDate": "2026-09-25", "stocks": [{"ticker": "AAPL", "changePct": 0.1}]}),
                         encoding="utf-8")
    monkeypatch.setitem(b.MARKETS, "us", {**b.MARKETS["us"], "snapshot": snap_path, "out_json": out_json})
    monkeypatch.setattr(b, "snapshot_price_date", lambda snap, now=None: snap.get("priceDate"))
    monkeypatch.setattr(b, "pick_movers", lambda *a, **k: {"up": [], "down": []})
    payload, code = b.build("us", use_llm=False, force=False)
    assert code == 0 and payload["tradeDate"] == "2026-09-25" and payload["attempt"] == 1

    # 같은 거래일에 이미 2회 시도했으면 건너뛴다(기존 동작 유지)
    out_json.write_text(json.dumps({"tradeDate": "2026-09-25", "status": "llm_failed", "attempt": 2}), encoding="utf-8")
    payload, code = b.build("us", use_llm=False, force=False)
    assert payload is None and code == 0


# ─────────── Gemini 429 완화(2026-09-26): 한 번에 묻기 · 재시도는 실패 종목만 · 백오프·폴백 ───────────
def _mover(ticker, change=8.0):
    s = _stock(change=change)
    s["ticker"] = ticker
    return s


def _ok_row(ticker):
    return {"ticker": ticker, "same_company": True, "explains_move": True,
            "reason": "198억원 규모 자사주 매입 결정", "evidence": ["E2"]}


def test_summarize_asks_all_stocks_in_one_call():
    import json as _json
    movers = {"up": [_mover(f"U{i}") for i in range(10)], "down": [_mover(f"D{i}", -8) for i in range(10)]}
    prompts = []

    def llm(prompt):
        prompts.append(prompt)
        return _json.dumps([_ok_row(s["ticker"]) for s in movers["up"] + movers["down"]]), "m", ""

    boards, meta = b.summarize(movers, "kr", [], "2026-09-25", True, llm=llm)
    assert meta["llmCalls"] == 1 and len(prompts) == 1
    assert all(r["reasonStatus"] == "ok" for r in boards["up"] + boards["down"])


def test_summarize_reuses_prev_success_and_asks_only_failed():
    import json as _json
    movers = {"up": [_mover("A"), _mover("B")], "down": [_mover("C", -8)]}
    prev = {"A": {"ticker": "A", "reasonStatus": "ok", "reason": "이전 사유", "tags": ["뉴스"], "evidence": []},
            "B": {"ticker": "B", "reasonStatus": "failed", "reason": ""},
            "C": {"ticker": "C", "reasonStatus": "none", "reason": b.NO_MATERIAL, "tags": ["불명"], "evidence": []}}
    asked = []

    def llm(prompt):
        asked.append([t for t in ("[A]", "[B]", "[C]") if t in prompt])
        return _json.dumps([_ok_row("B")]), "m", ""

    boards, meta = b.summarize(movers, "kr", [], "2026-09-25", True, prev_rows=prev, llm=llm)
    assert asked == [["[B]"]]                              # 실패했던 종목만 다시 묻는다
    by = {r["ticker"]: r for r in boards["up"] + boards["down"]}
    assert by["A"]["reason"] == "이전 사유" and by["A"]["reasonStatus"] == "ok"
    assert by["B"]["reasonStatus"] == "ok"
    assert by["C"]["reasonStatus"] == "none"
    assert meta["reused"] == 2 and meta["asked"] == 1


def test_summarize_retries_only_missing_rows_once():
    import json as _json
    movers = {"up": [_mover("A"), _mover("B"), _mover("C")], "down": []}
    calls = []

    def llm(prompt):
        calls.append(prompt)
        if len(calls) == 1:
            return _json.dumps([_ok_row("A")]), "m", ""       # B·C 가 응답에서 빠짐
        assert "[A]" not in prompt and "[B]" in prompt and "[C]" in prompt
        return _json.dumps([_ok_row("B")]), "m", ""

    boards, meta = b.summarize(movers, "kr", [], "2026-09-25", True, llm=llm)
    assert meta["llmCalls"] == 2
    st = {r["ticker"]: r["reasonStatus"] for r in boards["up"]}
    assert st == {"A": "ok", "B": "ok", "C": "failed"}


def test_summarize_stops_when_all_models_quota():
    movers = {"up": [_mover("A")], "down": []}
    calls = []

    def llm(prompt):
        calls.append(1)
        return None, None, "QUOTA gemini-2.5-flash HTTP 429 (하루 한도)"

    boards, meta = b.summarize(movers, "kr", [], "2026-09-25", True, llm=llm)
    assert len(calls) == 1 and boards["up"][0]["reasonStatus"] == "failed"


class _Resp:
    def __init__(self, text):
        import json as _json
        self._b = _json.dumps({"candidates": [{"content": {"parts": [{"text": text}]}}]}).encode()

    def read(self):
        return self._b

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def _http429(body):
    import io
    import urllib.error
    return urllib.error.HTTPError("u", 429, "Too Many", {}, io.BytesIO(body.encode()))


def test_call_gemini_backoff_then_model_fallback(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "x")
    seen, slept = [], []

    def opener(req, timeout=0):
        model = req.full_url.split("/models/")[1].split(":")[0]
        seen.append(model)
        if model == "lite":
            raise _http429('{"error":{"details":[{"quotaId":"GenerateRequestsPerMinutePerProjectPerModel-FreeTier"}]}}')
        return _Resp("[]")

    text, model, err = b.call_gemini("p", models=("lite", "flash"), sleep=slept.append, opener=opener)
    assert (text, model, err) == ("[]", "flash", "")
    assert seen == ["lite", "lite", "lite", "flash"]        # 분당 한도: 백오프 두 번 뒤 폴백
    assert slept[:2] == list(b.BACKOFF_SECONDS)


def test_call_gemini_daily_quota_skips_wait_and_flags_quota(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "x")
    seen, slept = [], []

    def opener(req, timeout=0):
        seen.append(req.full_url)
        raise _http429('{"error":{"details":[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]}}')

    text, model, err = b.call_gemini("p", models=("lite", "flash"), sleep=slept.append, opener=opener)
    assert text is None and err.startswith("QUOTA")
    assert len(seen) == 2                                    # 하루 한도는 기다리지 않고 모델당 1회
    assert all(s == 2 for s in slept)                        # 모델 사이 짧은 간격만


def test_default_model_order_prefers_lite():
    assert b.GEMINI_MODELS[0] == "gemini-2.5-flash-lite"    # 브리핑이 먼저 쓰는 flash 를 아낀다
