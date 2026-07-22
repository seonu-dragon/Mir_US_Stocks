import json
import urllib.request

SEC_HEADERS = {
    "User-Agent": "Mir US Stocks mir-us-stocks@users.noreply.github.com",
    "Accept": "application/json,text/xml,*/*",
}

def fetch(url):
    req = urllib.request.Request(url, headers=SEC_HEADERS)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.status, resp.read()[:200]

tests = [
    ("archives index", "https://www.sec.gov/Archives/edgar/data/1067983/000119312526054580/index.json"),
    ("data submissions", "https://data.sec.gov/submissions/CIK0001067983.json"),
    ("efts", "https://efts.sec.gov/LATEST/search-index?q=&forms=13F-HR&ciks=1350694&dateRange=custom&startdt=2025-01-01&enddt=2026-06-30"),
    ("browse atom", "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=1350694&type=13F-HR&dateb=&owner=include&count=5&output=atom"),
]

for name, url in tests:
    try:
        status, body = fetch(url)
        print(name, status, body.decode("utf-8", errors="replace")[:150])
    except Exception as e:
        print(name, "ERR", e)