#!/usr/bin/env python3
"""네이버 금융 API로 미국 종목 한국어 명칭 초안을 수집합니다.

사이트에 자동 반영하지 않습니다. scratch/ko_aliases_draft.js 를 검수한 뒤
data/ticker_aliases_ko.js 에 수동 병합하세요.

Usage:
  python scratch/fetch_ko_names_draft.py --top 200
  python scratch/fetch_ko_names_draft.py --tickers NVDA,TSLA,IONQ
  python scratch/fetch_ko_names_draft.py --top 50 --merge   # 기존 별칭과 diff 표시
  python scratch/fetch_ko_names_draft.py --missing --merge  # 별칭 없는 스냅샷 종목 전체
"""

from __future__ import annotations

import argparse
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT_PATH = ROOT / "data" / "market_snapshot.json"
ALIASES_PATH = ROOT / "data" / "ticker_aliases_ko.js"
OUT_PATH = ROOT / "scratch" / "ko_aliases_draft.js"
META_PATH = ROOT / "scratch" / "ko_aliases_draft_meta.json"

USER_AGENT = "Mir_US_Stocks/1.0 (ko-alias-draft; +local)"
REQUEST_GAP_SEC = 0.12


def load_snapshot_tickers(top_n: int | None = None, missing_only: set[str] | None = None) -> list[dict]:
    data = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
    stocks = sorted(
        data.get("stocks") or [],
        key=lambda s: float(s.get("marketCapB") or 0),
        reverse=True,
    )
    if missing_only is not None:
        stocks = [s for s in stocks if str(s.get("ticker") or "").upper() not in missing_only]
    if top_n:
        stocks = stocks[:top_n]
    return stocks


def parse_existing_aliases() -> dict[str, list[str]]:
    text = ALIASES_PATH.read_text(encoding="utf-8")
    out: dict[str, list[str]] = {}
    for m in re.finditer(r"^\s*([A-Z][A-Z0-9.]*)\s*:\s*\[(.*?)\]\s*,?\s*$", text, re.M):
        ticker = m.group(1)
        inner = m.group(2)
        aliases = [a.strip().strip('"').strip("'") for a in inner.split(",") if a.strip()]
        out[ticker] = aliases
    return out


def candidate_codes(ticker: str) -> list[str]:
    base = ticker.upper().strip()
    variants = [base]
    if "." in base:
        variants.append(base.replace(".", "-"))
        variants.append(base.replace(".", ""))
    codes: list[str] = []
    seen: set[str] = set()
    for v in variants:
        for suffix in ("", ".O", ".K", ".N"):
            code = f"{v}{suffix}"
            if code not in seen:
                seen.add(code)
                codes.append(code)
    return codes


def fetch_json(url: str) -> dict | None:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError:
        return None
    except urllib.error.URLError:
        return None


def autocomplete_code(ticker: str) -> str | None:
    q = urllib.parse.quote(ticker)
    url = f"https://m.stock.naver.com/front-api/search/autoComplete?query={q}&target=worldstock"
    data = fetch_json(url) or {}
    items = (data.get("result") or {}).get("items") or []
    target = ticker.upper()
    for item in items:
        code = str(item.get("code") or "").upper()
        if code == target:
            return str(item.get("code"))
    if items:
        return str(items[0].get("code") or "")
    return None


def fetch_ko_name(ticker: str) -> dict:
    if "." in ticker:
        ac_code = autocomplete_code(ticker)
        if ac_code:
            data = fetch_json(f"https://api.stock.naver.com/stock/{ac_code}/basic")
            if data and data.get("stockName"):
                return {
                    "ticker": ticker.upper(),
                    "naverCode": data.get("reutersCode") or ac_code,
                    "koName": (data.get("stockName") or "").strip(),
                    "enName": (data.get("stockNameEng") or "").strip(),
                    "source": "naver-autocomplete",
                }

    for code in candidate_codes(ticker):
        data = fetch_json(f"https://api.stock.naver.com/stock/{code}/basic")
        if data and data.get("symbolCode"):
            return {
                "ticker": ticker.upper(),
                "naverCode": data.get("reutersCode") or code,
                "koName": (data.get("stockName") or "").strip(),
                "enName": (data.get("stockNameEng") or "").strip(),
                "source": "naver-basic",
            }
        time.sleep(REQUEST_GAP_SEC)

    ac_code = autocomplete_code(ticker)
    if ac_code:
        data = fetch_json(f"https://api.stock.naver.com/stock/{ac_code}/basic")
        if data and data.get("stockName"):
            return {
                "ticker": ticker.upper(),
                "naverCode": data.get("reutersCode") or ac_code,
                "koName": (data.get("stockName") or "").strip(),
                "enName": (data.get("stockNameEng") or "").strip(),
                "source": "naver-autocomplete",
            }

    return {
        "ticker": ticker.upper(),
        "naverCode": None,
        "koName": "",
        "enName": "",
        "source": "not-found",
    }


def normalize_ko_alias(name: str) -> str:
    name = re.sub(r"\s+", "", name)
    name = re.sub(r"\(.*?\)", "", name)
    name = re.sub(r"ADR$", "", name, flags=re.I)
    return name.strip()


def derive_aliases(ko_name: str, en_name: str, company: str = "", ticker: str = "") -> list[str]:
    aliases: list[str] = []
    if ko_name:
        aliases.append(ko_name)
        short = normalize_ko_alias(ko_name)
        if short and short != ko_name and len(short) >= 2:
            aliases.append(short)
    if not aliases:
        aliases.extend(fallback_aliases(company, ticker))
    dedup: list[str] = []
    seen: set[str] = set()
    for a in aliases:
        key = a.casefold()
        if key not in seen:
            seen.add(key)
            dedup.append(a)
    return dedup


def fallback_aliases(company: str, ticker: str) -> list[str]:
    aliases: list[str] = []
    company = (company or "").strip()
    if company and company.upper() != (ticker or "").upper():
        aliases.append(company)
        short = re.sub(
            r"\s+(Inc\.?|Corp\.?|Corporation|Company|Co\.?|ETF|Fund|Trust|LLC|PLC|ADR|LP|L\.P\.).*$",
            "",
            company,
            flags=re.I,
        ).strip()
        if short and short != company and 2 <= len(short) <= 36:
            aliases.append(short)
    return aliases


def js_escape(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


def write_draft(rows: list[dict], existing: dict[str, list[str]]) -> None:
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "// AUTO-GENERATED DRAFT — 검수 후 data/ticker_aliases_ko.js 에 수동 반영",
        f"// generated: {time.strftime('%Y-%m-%d %H:%M:%S')}",
        "// source: Naver Finance world-stock API (reference only)",
        "window.KO_ALIASES_DRAFT = {",
    ]
    meta = []
    for row in rows:
        ticker = row["ticker"]
        proposed = derive_aliases(
            row.get("koName", ""),
            row.get("enName", ""),
            row.get("company", ""),
            ticker,
        )
        have = {a.casefold() for a in existing.get(ticker, [])}
        new_only = [a for a in proposed if a.casefold() not in have]
        if not new_only and row.get("source") == "not-found":
            meta.append({**row, "proposed": proposed, "newOnly": []})
            continue
        if not new_only and proposed:
            meta.append({**row, "proposed": proposed, "newOnly": [], "skipped": "already-covered"})
            continue
        if not new_only:
            meta.append({**row, "proposed": proposed, "newOnly": []})
            continue
        alias_js = ", ".join(f'"{js_escape(a)}"' for a in new_only)
        comment = row.get("enName") or row.get("source")
        lines.append(f"  // {comment}")
        lines.append(f"  {ticker}: [{alias_js}],")
        meta.append({**row, "proposed": proposed, "newOnly": new_only})

    lines.append("};")
    lines.append("")
    OUT_PATH.write_text("\n".join(lines), encoding="utf-8")
    META_PATH.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch Korean stock name draft from Naver")
    parser.add_argument("--top", type=int, default=None, help="Top N by market cap from snapshot")
    parser.add_argument("--tickers", type=str, default=None, help="Comma-separated tickers")
    parser.add_argument("--missing", action="store_true", help="Only snapshot tickers without ko aliases")
    parser.add_argument("--merge", action="store_true", help="Print diff against existing aliases")
    args = parser.parse_args()

    existing = parse_existing_aliases()

    if args.tickers:
        tickers = [t.strip().upper() for t in args.tickers.split(",") if t.strip()]
        stocks = [{"ticker": t, "company": ""} for t in tickers]
    elif args.missing:
        have = set(existing.keys())
        stocks = load_snapshot_tickers(missing_only=have)
        print(f"Missing tickers to fetch: {len(stocks)}")
    else:
        top_n = args.top or 200
        stocks = load_snapshot_tickers(top_n)

    rows = []
    ok = fail = 0
    for i, stock in enumerate(stocks, 1):
        ticker = str(stock.get("ticker") or "").upper()
        if not ticker:
            continue
        row = fetch_ko_name(ticker)
        row["company"] = stock.get("company") or ""
        rows.append(row)
        if row.get("koName"):
            ok += 1
            print(f"[{i}/{len(stocks)}] {ticker}: {row['koName']} ({row['naverCode']})")
        else:
            fail += 1
            print(f"[{i}/{len(stocks)}] {ticker}: NOT FOUND")
        time.sleep(REQUEST_GAP_SEC)

    write_draft(rows, existing)
    print(f"\nWrote {OUT_PATH}")
    print(f"Meta: {META_PATH}")
    print(f"Fetched: {ok} ok, {fail} missing")

    if args.merge:
        new_count = sum(1 for r in json.loads(META_PATH.read_text(encoding="utf-8")) if r.get("newOnly"))
        print(f"New alias entries to review: {new_count}")


if __name__ == "__main__":
    main()