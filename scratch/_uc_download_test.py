#!/usr/bin/env python3
import time
from pathlib import Path

import undetected_chromedriver as uc

CACHE = Path(__file__).resolve().parent / "xml_cache"
url = "https://www.sec.gov/Archives/edgar/data/1067983/000119312526226661/53405.xml"

options = uc.ChromeOptions()
options.add_argument("--headless=new")
driver = uc.Chrome(options=options)
try:
    driver.get(url)
    time.sleep(3)
    text = driver.page_source
    if text.startswith("<html"):
        text = driver.find_element("tag name", "body").text
    dest = CACHE / "berkshire_test.xml"
    dest.write_text(text, encoding="utf-8")
    print("status", "infoTable" in text, "len", len(text), "blocked", "Undeclared" in text)
finally:
    driver.quit()