#!/usr/bin/env python3
"""ko_aliases_draft.js 의 신규 별칭을 ticker_aliases_ko.js 에 병합합니다."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ALIASES_PATH = ROOT / "data" / "ticker_aliases_ko.js"
META_PATH = ROOT / "scratch" / "ko_aliases_draft_meta.json"


def has_hangul(s: str) -> bool:
    return bool(re.search(r"[가-힣]", s))


def quality_ok(alias: str) -> bool:
    alias = alias.strip()
    if not alias or len(alias) > 72:
        return False
    if any(bad in alias for bad in ("채권", "만기", "후순위", "우선주채")):
        return False
    if has_hangul(alias):
        return True
    if re.fullmatch(r"[A-Za-z0-9&.\- '/]{1,72}", alias):
        return True
    return False


def parse_aliases_js(text: str) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for m in re.finditer(r"^\s*([A-Z][A-Z0-9.]*)\s*:\s*\[(.*?)\]\s*,?\s*$", text, re.M):
        ticker = m.group(1)
        inner = m.group(2)
        aliases = [a.strip().strip('"').strip("'") for a in inner.split(",") if a.strip()]
        out[ticker] = aliases
    return out


def js_ticker_key(ticker: str) -> str:
    return f'"{ticker}"' if "." in ticker else ticker


def format_entry(ticker: str, aliases: list[str]) -> str:
    parts = ", ".join(f'"{a.replace(chr(92), chr(92)+chr(92)).replace(chr(34), chr(92)+chr(34))}"' for a in aliases)
    return f"  {js_ticker_key(ticker)}: [{parts}],"


def main() -> None:
    meta = json.loads(META_PATH.read_text(encoding="utf-8"))
    text = ALIASES_PATH.read_text(encoding="utf-8")
    existing = parse_aliases_js(text)

    added_total = 0
    new_tickers: dict[str, list[str]] = {}
    updated: list[str] = []

    for row in meta:
        ticker = row["ticker"]
        new_only = [a for a in row.get("newOnly") or [] if quality_ok(a)]
        if not new_only:
            continue
        have = {a.casefold() for a in existing.get(ticker, [])}
        to_add = [a for a in new_only if a.casefold() not in have]
        if not to_add:
            continue
        if ticker in existing:
            existing[ticker].extend(to_add)
            updated.append(ticker)
        else:
            new_tickers[ticker] = to_add
        added_total += len(to_add)

    # 기존 항목 인라인 갱신
    for ticker in updated:
        key = js_ticker_key(ticker)
        pattern = rf"(^\s*{re.escape(key)}\s*:\s*)\[.*?\](\s*,?\s*$)"
        replacement = rf"\1[{', '.join(chr(34)+a+chr(34) for a in existing[ticker])}]\2"
        text, n = re.subn(pattern, replacement, text, count=1, flags=re.M)
        if n != 1:
            raise SystemExit(f"Failed to update inline entry: {ticker}")

    # 신규 티커 블록 추가
    if new_tickers:
        block = ["", "  // ── 스냅샷 보강 (네이버 참고, bulk) ──"]
        for ticker in sorted(new_tickers):
            block.append(format_entry(ticker, new_tickers[ticker]))
        insert_at = text.rfind("};")
        if insert_at < 0:
            raise SystemExit("Could not find closing };")
        text = text[:insert_at] + "\n".join(block) + "\n" + text[insert_at:]

    ALIASES_PATH.write_text(text, encoding="utf-8")
    print(f"Updated tickers: {len(updated)}")
    print(f"New tickers: {len(new_tickers)}")
    print(f"Aliases added: {added_total}")


if __name__ == "__main__":
    main()