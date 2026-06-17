import json
import urllib.request

HTTP_HEADERS = {"User-Agent": "Mozilla/5.0", "Accept": "application/json, text/plain, */*"}

def test(symbol):
    url = f"https://query1.finance.yahoo.com/v10/finance/quoteSummary/{symbol}?modules=financialData,defaultKeyStatistics,summaryDetail"
    try:
        req = urllib.request.Request(url, headers=HTTP_HEADERS)
        data = json.loads(urllib.request.urlopen(req, timeout=15).read())
        r = data["quoteSummary"]["result"][0]
        sd = r.get("summaryDetail", {})
        fd = r.get("financialData", {})
        print(symbol, "pe", sd.get("trailingPE", {}).get("raw"), "mcap", sd.get("marketCap", {}).get("raw"), "roe", fd.get("returnOnEquity", {}).get("raw"))
    except Exception as e:
        print(symbol, "ERR", e)

for s in ["JPM", "NVDA", "BRK-B"]:
    test(s)