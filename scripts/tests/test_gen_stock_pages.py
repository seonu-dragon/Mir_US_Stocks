"""종목 정적 요약 페이지(gen_stock_pages.py) 테스트. 오프라인 — 레포 데이터 대신 가짜 행을 넣는다."""
import json
import re

import build_sitemap as bs
import gen_stock_pages as sp

BASE = bs.BASE
XML = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>{BASE}/</loc>
    <lastmod>2026-10-21</lastmod>
  </url>
  <url>
    <loc>{BASE}/{bs.HUB_REL['us']}</loc>
    <lastmod>2026-10-21</lastmod>
  </url>
  <url>
    <loc>{BASE}/stock/us/NVDA.html</loc>
    <lastmod>2026-10-21</lastmod>
  </url>
  <url>
    <loc>{BASE}/stock/kr/005930.html</loc>
    <lastmod>2026-10-21</lastmod>
  </url>
</urlset>
"""


def test_url_rules_are_shared():
    assert bs.stock_page_rel("us", "NVDA") == "stock/us/NVDA.html"
    assert bs.analysis_deeplink("kr", "005930") == "analysis.html?t=005930&market=kr"
    assert bs.analysis_deeplink("us", "NVDA") == "analysis.html?t=NVDA"


def test_rewrite_sitemap_falls_back_to_deeplinks_and_drops_missing_hubs():
    none = sp.rewrite_sitemap(XML, set(), set())
    assert "/stock/" not in none
    assert f"{BASE}/analysis.html?t=NVDA</loc>" in none
    assert f"{BASE}/analysis.html?t=005930&amp;market=kr</loc>" in none      # XML 이스케이프 한 번
    assert none.count("<url>") == 3                                          # 허브 블록 제거
    part = sp.rewrite_sitemap(XML, {("us", "NVDA")}, {"us"})
    assert f"{BASE}/stock/us/NVDA.html" in part and f"{BASE}/{bs.HUB_REL['us']}" in part
    assert "stock/kr/005930.html" not in part and "analysis.html?t=005930" in part
    assert sp.rewrite_sitemap(XML, {("us", "NVDA"), ("kr", "005930")}, {"us", "kr"}) == XML


def test_page_html_has_canonical_jsonld_and_escapes():
    row = {"ticker": "ABC", "company": 'A&B <Corp> "X"', "sector": "TECH", "industry": "Chips", "price": 12.5,
           "changePct": -1.234, "marketCapB": 1500, "monthChangePct": 3.2, "priceDate": "2026-10-20"}
    fund = {"pe": -5, "forwardPE": 20.04, "pb": 3.3, "divYield": 0, "roe": 12.0, "low52": 10, "high52": 20}
    prof = {"addr": "1 Main St", "web": "example.com"}
    peers = [{"ticker": "DEF", "company": "Def Inc"}]
    out = sp.page_html("us", row, fund, prof, peers, "2026-10-21")
    assert f'<link rel="canonical" href="{BASE}/stock/us/ABC.html">' in out
    assert "A&amp;B &lt;Corp&gt; &quot;X&quot;" in out and "<Corp>" not in out
    assert "2026-10-20 종가 기준" in out and "$12.50" in out and "-1.23%" in out and "$1.50T" in out
    assert "PER</dt><dd class=\"\">—" in out                                 # 적자 PER 은 내지 않는다
    assert "../../analysis.html?t=ABC" in out and 'href="DEF.html"' in out
    ld = json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', out, re.S).group(1))
    page = ld["@graph"][0]
    assert page["@type"] == "WebPage" and page["about"]["tickerSymbol"] == "ABC" and page["about"]["url"] == "https://example.com"
    assert [i["position"] for i in ld["@graph"][1]["itemListElement"]] == [1, 2, 3]


def test_main_writes_pages_and_keeps_sitemap_valid(tmp_path, monkeypatch):
    site = tmp_path / "_site"
    site.mkdir()
    (site / "sitemap.xml").write_text(XML, encoding="utf-8")
    data = tmp_path / "data"
    (data / "korea").mkdir(parents=True)
    (data / "market_snapshot.json").write_text(json.dumps({"updatedAtKst": "2026-10-21 07:00 KST", "stocks": [
        {"ticker": "NVDA", "company": "NVIDIA", "price": 1, "industry": "Semis"}]}), encoding="utf-8")
    (data / "korea" / "market_snapshot.json").write_text(json.dumps({"stocks": []}), encoding="utf-8")
    monkeypatch.setattr(sp, "ROOT", tmp_path)
    assert sp.main(["--root", str(site)]) == 0
    assert (site / "stock" / "us" / "NVDA.html").exists() and (site / bs.HUB_REL["us"]).exists()
    assert not (site / bs.HUB_REL["kr"]).exists()
    xml = (site / "sitemap.xml").read_text(encoding="utf-8")
    assert "stock/us/NVDA.html" in xml and "stock/kr/" not in xml and "analysis.html?t=005930&amp;market=kr" in xml
