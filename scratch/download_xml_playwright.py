#!/usr/bin/env python3
"""Download 13F infotable XML via Playwright (real browser)."""
from __future__ import annotations

import time
from pathlib import Path

from playwright.sync_api import sync_playwright

CACHE = Path(__file__).resolve().parent / "xml_cache"
CACHE.mkdir(exist_ok=True)

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


def main() -> None:
    ok = 0
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mir US Stocks mir-us-stocks@users.noreply.github.com"
        )
        page = context.new_page()
        for name, url in FILES.items():
            dest = CACHE / name
            print(f"Downloading {name}...")
            try:
                resp = page.goto(url, wait_until="networkidle", timeout=120000)
                if resp is None or resp.status != 200:
                    status = resp.status if resp else "no response"
                    print(f"  http {status}")
                    continue
                text = page.content()
                if text.startswith("<html"):
                    body = page.locator("body").inner_text()
                    if body.strip().startswith("<?xml") or body.strip().startswith("<"):
                        text = body
                    else:
                        pre = page.locator("pre").first
                        if pre.count():
                            text = pre.inner_text()
                if "Undeclared Automated Tool" in text or "<infoTable>" not in text.lower():
                    print(f"  blocked/invalid ({len(text)} bytes)")
                    continue
                dest.write_text(text, encoding="utf-8")
                ok += 1
                print(f"  ok {len(text)} bytes")
            except Exception as exc:
                print(f"  err {exc}")
            time.sleep(0.5)
        browser.close()
    print(f"Done: {ok}/{len(FILES)} saved to {CACHE}")


if __name__ == "__main__":
    main()