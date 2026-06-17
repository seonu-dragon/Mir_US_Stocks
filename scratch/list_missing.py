import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
snap = json.loads((root / "data/market_snapshot.json").read_text(encoding="utf-8"))
text = (root / "data/ticker_aliases_ko.js").read_text(encoding="utf-8")
have = set(re.findall(r'^\s*"?([A-Z][A-Z0-9.]*)?"?\s*:\s*\[', text, re.M))
all_t = {str(s["ticker"]).upper() for s in snap["stocks"]}
missing = sorted(all_t - have)
print("have", len(have), "snapshot", len(all_t), "missing", len(missing))
(root / "scratch/missing_tickers.txt").write_text("\n".join(missing), encoding="utf-8")
for t in missing[:15]:
    row = next(s for s in snap["stocks"] if s["ticker"].upper() == t)
    print(t, row.get("company", "")[:50])