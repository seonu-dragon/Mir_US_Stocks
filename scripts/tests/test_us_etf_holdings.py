"""미국 ETF 구성·역조회(build_us_etf_holdings.py) 테스트. 오프라인.

N-PORT XML 은 실제 QQQ 보고서(2026-06-30 기준, 0001067839-26-000030) 모양을 줄여 옮겼다.
실행: py -m pytest -q scripts/tests/test_us_etf_holdings.py
"""
from __future__ import annotations

import io
import json

import build_us_etf_holdings as b

NPORT = b"""<?xml version="1.0" encoding="UTF-8"?>
<edgarSubmission xmlns="http://www.sec.gov/edgar/nport" xmlns:com="http://www.sec.gov/edgar/common">
  <formData>
    <genInfo><seriesName>Invesco QQQ Trust, Series 1</seriesName><repPdEnd>2026-09-30</repPdEnd><repPdDate>2026-06-30</repPdDate></genInfo>
    <fundInfo><totAssets>492478331786.57</totAssets><netAssets>490103179941.66</netAssets></fundInfo>
    <invstOrSecs>
      <invstOrSec><name>NVIDIA Corp.</name><title>NVIDIA Corp.</title><cusip>67066G104</cusip>
        <identifiers><isin value="US67066G1040"/></identifiers><pctVal>7.597</pctVal><assetCat>EC</assetCat><invCountry>US</invCountry></invstOrSec>
      <invstOrSec><name>Alphabet Inc.</name><title>Alphabet Inc., Class C</title><cusip>02079K107</cusip>
        <identifiers><isin value="US02079K1079"/></identifiers><pctVal>3.024</pctVal><assetCat>EC</assetCat><invCountry>US</invCountry></invstOrSec>
      <invstOrSec><name>ASML Holding N.V.</name><title>ASML Holding N.V., New York Registry Shares</title><cusip>N07059210</cusip>
        <identifiers><isin value="USN070592100"/></identifiers><pctVal>1.5</pctVal><assetCat>EC</assetCat><invCountry>NL</invCountry></invstOrSec>
      <invstOrSec><name>Coca-Cola Europacific Partners PLC</name><title>Coca-Cola Europacific Partners PLC</title><cusip>G25839104</cusip>
        <identifiers><isin value="GB00BDCPN049"/></identifiers><pctVal>0.19</pctVal><assetCat>EC</assetCat><invCountry>GB</invCountry></invstOrSec>
      <invstOrSec><name>NVIDIA Corp.</name><title>NVIDIA Corp.</title><cusip>67066G104</cusip>
        <identifiers><isin value="US67066G1040"/></identifiers><pctVal>0.003</pctVal><assetCat>EC</assetCat><invCountry>US</invCountry></invstOrSec>
      <invstOrSec><name>U.S. Treasury Notes</name><title>U.S. Treasury Notes</title><cusip>91282CKZ3</cusip>
        <identifiers><isin value="US91282CKZ33"/></identifiers><pctVal>0.4</pctVal><assetCat>DBT</assetCat><invCountry>US</invCountry>
        <debtSec><maturityDt>2035-02-15</maturityDt><couponKind>Fixed</couponKind><annualizedRt>4.625</annualizedRt></debtSec></invstOrSec>
      <invstOrSec><name>Invesco Premier Portfolio</name><title>Institutional Class</title><cusip>000000000</cusip>
        <identifiers><other otherDesc="LEI" value="X"/></identifiers><pctVal>0.35</pctVal><assetCat>STIV</assetCat><invCountry>US</invCountry></invstOrSec>
    </invstOrSecs>
  </formData>
</edgarSubmission>"""

ATOM = """<feed><entry><content type="text/xml"><accession-number>0002071691-26-019760</accession-number>
<filing-date>2026-08-25</filing-date><filing-href>https://www.sec.gov/Archives/edgar/data/1100663/000207169126019760/0002071691-26-019760-index.htm</filing-href>
<filing-type>NPORT-P/A</filing-type></content></entry>
<entry><content type="text/xml"><accession-number>0002071691-26-012459</accession-number>
<filing-date>2026-05-28</filing-date><filing-href>https://www.sec.gov/Archives/edgar/data/1100663/000207169126012459/0002071691-26-012459-index.htm</filing-href>
<filing-type>NPORT-P</filing-type></content></entry></feed>"""

SNAP = {"stocks": [
    {"ticker": "NVDA", "company": "NVIDIA Corporation", "sector": "TECHNOLOGY"},
    {"ticker": "GOOGL", "company": "Alphabet Inc. Class A", "sector": "COMMUNICATION SERVICES"},
    {"ticker": "ASML", "company": "ASML Holding N.V.", "sector": "TECHNOLOGY"},
    {"ticker": "CCEP", "company": "Coca-Cola Europacific Partners PLC", "sector": "CONSUMER DEFENSIVE"},
    {"ticker": "QQQ", "company": "Invesco QQQ Trust", "sector": "EXCHANGE TRADED FUNDS"},
]}


def test_parse_atom_skips_amendment():
    f = b.parse_atom(ATOM)
    assert f["accession"] == "0002071691-26-012459"
    assert f["url"].endswith("/000207169126012459/primary_doc.xml")
    assert f["filed"] == "2026-05-28"


def test_peek_stops_before_holdings():
    head = b.peek_nport(io.BytesIO(NPORT))
    assert head == {"asOf": "2026-06-30", "seriesName": "Invesco QQQ Trust, Series 1", "netAssets": 490103179941.66}


def test_parse_and_aggregate():
    p = b.parse_nport(io.BytesIO(NPORT))
    assert p["asOf"] == "2026-06-30" and len(p["holdings"]) == 7
    agg = b.aggregate(p["holdings"])
    nv = [h for h in agg if h["cusip"] == "67066G104"]
    assert len(nv) == 1 and abs(nv[0]["pct"] - 7.6) < 1e-9       # 두 줄이 합쳐진다
    tsy = [h for h in agg if h["cat"] == "DBT"][0]
    assert tsy["debt"] == "4.62% 2035-02" or tsy["debt"] == "4.63% 2035-02"
    assert agg[0]["cusip"] == "67066G104"                          # 비중 순


def test_figi_candidates_only_us_equity():
    assert b.figi_candidate({"cusip": "67066G104", "isin": "US67066G1040", "cat": "EC"}) == "67066G104"
    assert b.figi_candidate({"cusip": "G25839104", "isin": "GB00BDCPN049", "cat": "EC"}) is None
    assert b.figi_candidate({"cusip": "91282CKZ3", "isin": "US91282CKZ33", "cat": "DBT"}) is None
    assert b.figi_candidate({"cusip": "000000000", "isin": "", "cat": "EC"}) is None


def test_figi_lookup_batches_and_maps_slash():
    calls = []

    def post(body):
        calls.append(len(body))
        return [{"data": [{"ticker": "BRK/B", "marketSector": "Equity"}]} if j["idValue"] == "084670702"
                else {"warning": "No identifier found."} for j in body]

    out = b.figi_lookup(["084670702"] + [f"00000000{i}" for i in range(1, 10)] + ["123456789"], post=post, sleep=lambda s: None)
    assert calls == [10, 1]
    assert out["084670702"] == "BRK.B" and out["123456789"] == ""


def test_resolve_ticker_class_guard_and_name_match():
    by_ticker, by_name = b.stock_universe(SNAP)
    assert "QQQ" not in by_ticker
    cmap = {"67066G104": {"t": "NVDA", "d": "2026-09-26"}}
    nv = {"name": "NVIDIA Corp.", "cusip": "67066G104", "cat": "EC"}
    goog = {"name": "Alphabet Inc.", "title": "Alphabet Inc., Class C", "cusip": "02079K107", "cat": "EC"}
    asml = {"name": "ASML Holding N.V.", "title": "ASML Holding N.V., New York Registry Shares", "cusip": "N07059210", "cat": "EC"}
    ccep = {"name": "Coca-Cola Europacific Partners PLC", "cusip": "G25839104", "cat": "EC"}
    assert b.resolve_ticker(nv, cmap, by_ticker, by_name) == "NVDA"
    # 스냅샷에는 Class A 만 있다 — Class C 를 GOOGL 로 잇지 않는다.
    assert b.resolve_ticker(goog, cmap, by_ticker, by_name) is None
    # OpenFIGI 가 GOOG 를 찾았으면 스냅샷 밖이어도 표시용 티커로 쓴다.
    assert b.resolve_ticker(goog, {"02079K107": {"t": "GOOG"}}, by_ticker, by_name) == "GOOG"
    assert b.resolve_ticker(asml, cmap, by_ticker, by_name) == "ASML"
    assert b.resolve_ticker(ccep, cmap, by_ticker, by_name) == "CCEP"
    assert b.resolve_ticker({"name": "U.S. Treasury Notes", "cat": "DBT"}, cmap, by_ticker, by_name) is None


def test_shard_sectors_countries_and_reverse():
    by_ticker, by_name = b.stock_universe(SNAP)
    p = b.parse_nport(io.BytesIO(NPORT))
    holdings = b.aggregate(p.pop("holdings"))
    cmap = {"67066G104": {"t": "NVDA"}, "02079K107": {"t": "GOOG"}}
    tickers = [b.resolve_ticker(h, cmap, by_ticker, by_name) for h in holdings]
    sh = b.etf_shard({"ticker": "QQQ", "company": "Invesco QQQ Trust"}, {"filed": "2026-08-28", "accession": "a", "index": "u"},
                     p, holdings, tickers, by_ticker, by_name)
    assert sh["asOf"] == "2026-06-30" and sh["netAssetsB"] == 490.1 and sh["holdingsCount"] == 6
    sec = dict(sh["sectors"])
    assert abs(sec["TECHNOLOGY"] - 9.1) < 1e-6                         # NVDA 7.6 + ASML 1.5
    assert abs(sec["COMMUNICATION SERVICES"] - 3.024) < 1e-6          # GOOG → 같은 회사명 GOOGL 의 섹터
    assert sh["sectorUnmapped"] == 0.0
    assert sh["assetMix"]["debt"] == 0.4 and sh["assetMix"]["cash"] == 0.35
    assert sh["top"][0] == {"n": "NVIDIA Corp.", "t": "NVDA", "w": 7.6, "k": "equity", "c": "US"}
    assert dict(sh["countries"])["NL"] == 1.5
    rev = b.build_reverse({"NVDA": [("QQQ", 7.6), ("VOO", 7.5), ("XLK", 14.1)], "ASML": [("QQQ", 1.5)]})
    assert rev["N"]["NVDA"] == {"n": 3, "top": [["XLK", 14.1], ["QQQ", 7.6], ["VOO", 7.5]]}
    assert b.shard_key("BRK.B") == "B" and b.shard_key("1ABC") == "_"


def test_rank_and_write_if_changed(tmp_path):
    chosen, rest = b.rank_by_net_assets([("A", 5.0), ("B", None), ("C", 9.0)], 2)
    assert chosen == ["C", "A"] and rest == ["B"]
    path = tmp_path / "etf" / "X.json"
    assert b.write_if_changed(path, {"a": 1}) is True
    assert b.write_if_changed(path, {"a": 1}) is False
    assert json.loads(path.read_text(encoding="utf-8")) == {"a": 1}
