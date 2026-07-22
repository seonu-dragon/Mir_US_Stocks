import urllib.request
h = {"User-Agent": "Mir US Stocks mir-us-stocks@users.noreply.github.com"}
url = "https://www.sec.gov/Archives/edgar/data/1067983/000119312526226661/index.json"
req = urllib.request.Request(url, headers=h)
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        print("status", r.status)
        print(r.read()[:200])
except Exception as e:
    print("error", e)