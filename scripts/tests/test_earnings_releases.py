

# ---- 회사 KPI(2026-10-22) ----
def test_sanitize_keeps_operating_kpis_only_with_source_numbers():
    import build_earnings_releases as B
    src = "Total deliveries of 486,532 vehicles, down 2% year over year. Supercharger connectors reached 84,465. Revenue was $28.1 billion."
    clean, dropped = B.sanitize({"metrics": [], "kpis": [
        {"label": "차량 인도량", "value": "486,532 vehicles", "change": "-2%"},
        {"label": "슈퍼차저 커넥터", "value": "84,465", "change": ""},
        {"label": "매출", "value": "$28.1 billion", "change": ""},          # 재무 → KPI 아님
        {"label": "로보택시 마일", "value": "5,000,000", "change": ""},     # 원문에 없는 숫자 → 버림
        "junk",
    ]}, src)
    assert [k["label"] for k in clean["kpis"]] == ["차량 인도량", "슈퍼차저 커넥터"]
    assert dropped >= 1


def test_merge_kpis_accumulates_by_accession_and_keeps_old_quarters():
    import build_earnings_releases as B
    old = {"tickers": {"TSLA": [{"accession": "a1", "fileDate": "2026-07-22", "period": "Q2", "kpis": [{"label": "인도량", "value": "1", "change": ""}]}]}}
    rel = [{"ticker": "TSLA", "accession": "a2", "fileDate": "2026-10-21", "period": "Q3", "exhibitUrl": "u", "kpis": [{"label": "인도량", "value": "2", "change": ""}]},
           {"ticker": "TXN", "accession": "b1", "fileDate": "2026-10-21", "kpis": []}]
    out = B.merge_kpis(rel, old)
    assert out["count"] == 1 and [r["accession"] for r in out["tickers"]["TSLA"]] == ["a2", "a1"]
