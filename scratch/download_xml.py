import time
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent / "xml_cache"
OUT.mkdir(exist_ok=True)

SEC_HEADERS = {
    "User-Agent": "Mir US Stocks mir-us-stocks@users.noreply.github.com",
    "Accept": "text/xml,*/*",
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
    dest = OUT / name
    print(f"Downloading {name}...")
    try:
        req = urllib.request.Request(url, headers=SEC_HEADERS)
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = resp.read()
        dest.write_bytes(data)
        print(f"  ok {len(data)} bytes")
    except Exception as e:
        print(f"  err {e}")
    time.sleep(0.4)