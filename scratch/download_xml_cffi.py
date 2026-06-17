#!/usr/bin/env python3
"""Download 13F infotable XML via curl_cffi (browser impersonation)."""
from __future__ import annotations

import time
from pathlib import Path

from curl_cffi import requests

CACHE = Path(__file__).resolve().parent / "xml_cache"
CACHE.mkdir(exist_ok=True)

HEADERS = {
    "User-Agent": "Mir US Stocks mir-us-stocks@users.noreply.github.com",
    "Accept": "text/xml,application/xml,*/*",
}

FILES = {
    "berkshire.xml": "https://www.sec.gov/Archives/edgar/data/1067983/000119312526226661/53405.xml",
    "bridgewater.xml": "https://www.sec.gov/Archives/edgar/data/1350694/000135069426000002/infotable.xml",
    "citadel.xml": "https://www.sec.gov/Archives/edgar/data/1423053/000110465926062477/infotable.xml",
    "renaissance.xml": "https://www.sec.gov/Archives/edgar/data/1037389/000103738926000033/renaissance13Fq12026_holding.xml",
    "pershing.xml": "https://www.sec.gov/Archives/edgar/data/1336528/000117266126002336/infotable.xml",
    "tiger.xml": "https://www.sec.gov/Archives/edgar/data/1167483/000091957426003362/infotable.xml",
    "baupost.xml": "https://www.sec.gov/Archives/edgar/data/1061768/000106176826000007/BGLLCQ12026.xml",
    "appaloosa.xml": "https://www.sec.gov/Archives/edgar/data/1656456/000165645626000002/Form13FInfoTable.xml",
    "duquesne.xml": "https://www.sec.gov/Archives/edgar/data/1536411/000153641126000004/form13f_20260331.xml",
    "scion.xml": "https://www.sec.gov/Archives/edgar/data/1649339/000164933925000007/infotable.xml",
}

for name, url in FILES.items():
    dest = CACHE / name
    print(f"Downloading {name}...")
    try:
        resp = requests.get(url, headers=HEADERS, impersonate="chrome", timeout=120)
        resp.raise_for_status()
        text = resp.text
        if "Undeclared Automated Tool" in text or "<infoTable>" not in text.lower():
            print(f"  blocked/invalid ({len(text)} bytes)")
            continue
        dest.write_text(text, encoding="utf-8")
        print(f"  ok {len(text)} bytes")
    except Exception as e:
        print(f"  err {e}")
    time.sleep(0.35)