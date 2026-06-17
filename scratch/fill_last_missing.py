import json
import re
from pathlib import Path

from merge_ko_aliases import format_entry, js_ticker_key, parse_aliases_js, quality_ok

root = Path(__file__).resolve().parents[1]
snap = json.loads((root / "data/market_snapshot.json").read_text(encoding="utf-8"))
aliases_path = root / "data/ticker_aliases_ko.js"
text = aliases_path.read_text(encoding="utf-8")
existing = parse_aliases_js(text)
by_ticker = {str(s["ticker"]).upper(): s for s in snap["stocks"]}
missing = sorted(set(by_ticker) - set(existing.keys()))

block = ["", "  // ── 잔여 종목 (스냅샷 company fallback) ──"]
added = 0
for ticker in missing:
    company = str(by_ticker[ticker].get("company") or ticker).strip()
    aliases = []
    if company:
        aliases.append(company)
        short = re.sub(
            r"\s+(Inc\.?|Corp\.?|Corporation|Company|Co\.?|ETF|Fund|Trust|LLC|PLC|ADR|LP|L\.P\.|The).*$",
            "",
            company,
            flags=re.I,
        ).strip()
        if short and short != company:
            aliases.append(short)
    aliases = [a for a in aliases if quality_ok(a)]
    if not aliases:
        aliases = [ticker]
    block.append(format_entry(ticker, aliases))
    added += 1

insert_at = text.rfind("};")
text = text[:insert_at] + "\n".join(block) + "\n" + text[insert_at:]
aliases_path.write_text(text, encoding="utf-8")
print("added", added)