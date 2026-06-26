import urllib.request
import re

url = "https://finance.naver.com/sise/sise_market_sum.naver?sosok=0&page=1&fieldIds=market_sum&fieldIds=amount&fieldIds=volume&fieldIds=upjong"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
html = urllib.request.urlopen(req, timeout=15).read().decode("euc-kr", "replace")
idx = html.find('<td class="no">')
row_end = html.find("</tr>", idx)
row = html[idx:row_end]
cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.DOTALL)
clean = [re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", c)).strip() for c in cells]
for i, c in enumerate(clean):
    print(i, c)