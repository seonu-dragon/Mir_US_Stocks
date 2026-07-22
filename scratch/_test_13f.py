import json
import re
import urllib.request

SEC_HEADERS = {"User-Agent": "Mir US Stocks mir-us-stocks@example.com", "Accept": "application/json"}

def fetch_text(url):
    req = urllib.request.Request(url, headers=SEC_HEADERS)
    return urllib.request.urlopen(req, timeout=30).read().decode("utf-8", errors="replace")

cik = "1067983"
sub = json.loads(fetch_text(f"https://data.sec.gov/submissions/CIK{cik.zfill(10)}.json"))
recent = sub["filings"]["recent"]
idx = recent["form"].index("13F-HR")
acc = recent["accessionNumber"][idx]
acc_nodash = acc.replace("-", "")
index_url = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc_nodash}/index.json"
print("index", index_url)
index = json.loads(fetch_text(index_url))
for item in index.get("directory", {}).get("item", []):
    name = item.get("name", "")
    if "infotable" in name.lower() or name.lower().endswith(".xml"):
        print("file", name, item.get("type"))

# try infotable xml
for item in index.get("directory", {}).get("item", []):
    name = item.get("name", "")
    if "infotable" in name.lower():
        url = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc_nodash}/{name}"
        text = fetch_text(url)
        issuers = re.findall(r"<nameOfIssuer>([^<]+)</nameOfIssuer>", text, re.I)
        values = re.findall(r"<value>([^<]+)</value>", text, re.I)
        print("issuers", issuers[:8], "count", len(issuers))
        print("values sample", values[:3])
        break