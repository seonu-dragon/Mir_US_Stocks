#!/usr/bin/env python3
"""US Congress stock trade disclosures (Senate PTR + House Financial Disclosure)."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
import urllib.request
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from congress_committees_registry import (  # noqa: E402
    COMMITTEE_SECTOR_MAP,
    lookup_politician,
)
from congress_party_lookup import (  # noqa: E402
    CongressPartyLookup,
    normalize_party_code,
)
from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402

KST = ZoneInfo("Asia/Seoul")
SENATE_URL = (
    "https://raw.githubusercontent.com/timothycarambat/"
    "senate-stock-watcher-data/master/aggregate/all_transactions.json"
)
HOUSE_URL = (
    "https://raw.githubusercontent.com/TattooedHead/"
    "house-stock-watcher-data/main/data/all_transactions.json"
)
QUIVER_URL = "https://api.quiverquant.com/beta/live/congresstrading"
OUT_JSON = ROOT / "data" / "congress_trades.json"
OUT_JS = ROOT / "data" / "congress_trades.js"

AMOUNT_RE = re.compile(r"\$?([\d,]+)\s*-\s*\$?([\d,]+)")
TICKER_BAD = {"--", "N/A", "NA", "NONE", "UNKNOWN"}


def _fetch_quiver() -> list:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
        "Referer": "https://www.quiverquant.com/congresstrading/",
    }
    try:
        import requests

        for attempt in range(1, 4):
            resp = requests.get(QUIVER_URL, headers=headers, timeout=60)
            if resp.status_code == 200:
                data = resp.json()
                return data if isinstance(data, list) else []
            if attempt < 3:
                time.sleep(2 * attempt)
        resp.raise_for_status()
    except Exception:
        return _fetch_json(QUIVER_URL)
    return []


def _fetch_json(url: str, *, retries: int = 3) -> list:
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; MirUSStocks/1.0)",
        "Accept": "application/json,text/plain,*/*",
    }
    last_error = None
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            if isinstance(data, list):
                return data
            if isinstance(data, dict):
                return data.get("data") or data.get("results") or []
            return []
        except Exception as error:
            last_error = error
            if attempt < retries:
                time.sleep(2 * attempt)
    raise RuntimeError(f"fetch failed for {url}: {last_error}")


def _parse_amount_mid(amount: str | None, fallback: int | float | None = None) -> int:
    if fallback is not None:
        try:
            return int(fallback)
        except (TypeError, ValueError):
            pass
    text = (amount or "").replace(",", "")
    m = AMOUNT_RE.search(text)
    if not m:
        return 0
    lo = int(m.group(1).replace(",", ""))
    hi = int(m.group(2).replace(",", ""))
    return (lo + hi) // 2


def _parse_date(raw: str) -> datetime | None:
    raw = (raw or "").strip()
    for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%m/%d/%y"):
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    return None


def _normalize_ticker(raw: str | None) -> str | None:
    t = (raw or "").strip().upper()
    if not t or t in TICKER_BAD:
        return None
    if len(t) > 6 or " " in t or "/" in t:
        return None
    return t


def _trade_side(type_str: str) -> str:
    t = (type_str or "").lower()
    if "purchase" in t or "buy" in t:
        return "buy"
    if "sale" in t or "sell" in t or "sold" in t:
        return "sell"
    if "exchange" in t:
        return "exchange"
    return "other"


def _slug_id(name: str, chamber: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return f"{chamber.lower()}-{base or 'unknown'}"


def _normalize_senate(row: dict) -> dict | None:
    ticker = _normalize_ticker(row.get("ticker"))
    if not ticker:
        return None
    tx_date = _parse_date(row.get("transaction_date", ""))
    if not tx_date:
        return None
    name = str(row.get("senator") or "").strip()
    if not name:
        return None
    side = _trade_side(row.get("type", ""))
    return {
        "politician": name,
        "chamber": "Senate",
        "ticker": ticker,
        "asset": str(row.get("asset_description") or "").strip(),
        "side": side,
        "type": str(row.get("type") or "").strip(),
        "amount": str(row.get("amount") or "").strip(),
        "amountMid": _parse_amount_mid(row.get("amount")),
        "transactionDate": tx_date.strftime("%Y-%m-%d"),
        "disclosureDate": "",
        "owner": str(row.get("owner") or "").strip(),
        "sourceUrl": str(row.get("ptr_link") or "").strip(),
        "district": "",
        "source": "senate_ptr_legacy",
    }


def _normalize_quiver(row: dict) -> dict | None:
    ticker = _normalize_ticker(row.get("Ticker"))
    if not ticker:
        return None
    tx_date = _parse_date(row.get("TransactionDate", ""))
    if not tx_date:
        return None
    name = str(row.get("Representative") or "").strip()
    if not name:
        return None
    house = str(row.get("House") or "").strip()
    chamber = "Senate" if house.lower() == "senate" else "House"
    side = _trade_side(str(row.get("Transaction") or ""))
    amount = str(row.get("Range") or "").strip()
    amount_mid = _parse_amount_mid(amount)
    if not amount_mid:
        try:
            amount_mid = int(float(row.get("Amount") or 0))
        except (TypeError, ValueError):
            amount_mid = 0
    excess = row.get("ExcessReturn")
    try:
        excess_return = round(float(excess), 2) if excess is not None else None
    except (TypeError, ValueError):
        excess_return = None
    return {
        "politician": name,
        "chamber": chamber,
        "party": str(row.get("Party") or "").strip(),
        "ticker": ticker,
        "asset": str(row.get("Description") or "").strip(),
        "side": side,
        "type": str(row.get("Transaction") or "").strip(),
        "amount": amount,
        "amountMid": amount_mid,
        "transactionDate": tx_date.strftime("%Y-%m-%d"),
        "disclosureDate": str(row.get("ReportDate") or "").strip(),
        "owner": "",
        "sourceUrl": "",
        "district": "",
        "excessReturnPct": excess_return,
        "source": "quiver",
    }


def _normalize_house(row: dict) -> dict | None:
    ticker = _normalize_ticker(row.get("ticker"))
    if not ticker:
        return None
    tx_date = _parse_date(row.get("transaction_date", ""))
    if not tx_date:
        return None
    name = str(row.get("representative") or "").strip()
    if not name:
        return None
    side = _trade_side(row.get("type", ""))
    return {
        "politician": name,
        "chamber": "House",
        "ticker": ticker,
        "asset": str(row.get("asset_description") or "").strip(),
        "side": side,
        "type": str(row.get("type") or "").strip(),
        "amount": str(row.get("amount") or "").strip(),
        "amountMid": _parse_amount_mid(row.get("amount"), row.get("amount_mid")),
        "transactionDate": tx_date.strftime("%Y-%m-%d"),
        "disclosureDate": str(row.get("disclosure_date") or "").strip(),
        "owner": str(row.get("owner") or "").strip(),
        "sourceUrl": str(row.get("source_url") or "").strip(),
        "district": str(row.get("district") or "").strip(),
        "source": "house_ptr",
    }


def _trade_key(trade: dict) -> str:
    return "|".join([
        trade.get("politician", ""),
        trade.get("transactionDate", ""),
        trade.get("ticker", ""),
        trade.get("side", ""),
        trade.get("amount", ""),
        trade.get("chamber", ""),
    ]).lower()


def _build_quiver_party_map(rows: list[dict]) -> dict[str, str]:
    party_map: dict[str, str] = {}
    for row in rows:
        name = str(row.get("Representative") or "").strip()
        party = normalize_party_code(str(row.get("Party") or "").strip())
        if name and party:
            party_map[name] = party
    return party_map


def _resolve_party(
    name: str,
    chamber: str,
    trade_party: str | None,
    *,
    registry_meta: dict | None,
    quiver_party_map: dict[str, str],
    party_lookup: CongressPartyLookup | None,
) -> str:
    for raw in (trade_party, (registry_meta or {}).get("party"), quiver_party_map.get(name)):
        party = normalize_party_code(raw)
        if party:
            return party
    if party_lookup:
        return party_lookup.lookup(name, chamber)
    return ""


def _load_trades(cutoff: datetime) -> tuple[list[dict], dict[str, str]]:
    merged: dict[str, dict] = {}
    quiver_party_map: dict[str, str] = {}

    # Recent cross-chamber feed (Senate + House, ~1000 rows)
    try:
        quiver_rows = _fetch_quiver()
        quiver_party_map = _build_quiver_party_map(quiver_rows)
        kept = 0
        for row in quiver_rows:
            t = _normalize_quiver(row)
            if not t:
                continue
            tx = _parse_date(t["transactionDate"])
            if not tx or tx < cutoff:
                continue
            merged[_trade_key(t)] = t
            kept += 1
        print(f"[fetch] quiver: {kept}/{len(quiver_rows)} trades since {cutoff.date()}")
    except Exception as exc:
        print(f"[warn] quiver fetch failed: {exc}")

    # House PTR historical depth
    try:
        house_rows = _fetch_json(HOUSE_URL)
        kept = 0
        for row in house_rows:
            t = _normalize_house(row)
            if not t:
                continue
            tx = _parse_date(t["transactionDate"])
            if not tx or tx < cutoff:
                continue
            key = _trade_key(t)
            if key not in merged:
                merged[key] = t
                kept += 1
        print(f"[fetch] house: {kept}/{len(house_rows)} added since {cutoff.date()}")
    except Exception as exc:
        print(f"[warn] house fetch failed: {exc}")

    # Legacy Senate mirror (stale but useful pre-2021)
    try:
        senate_rows = _fetch_json(SENATE_URL)
        kept = 0
        for row in senate_rows:
            t = _normalize_senate(row)
            if not t:
                continue
            t["source"] = "senate_ptr_legacy"
            tx = _parse_date(t["transactionDate"])
            if not tx or tx < cutoff:
                continue
            key = _trade_key(t)
            if key not in merged:
                merged[key] = t
                kept += 1
        print(f"[fetch] senate legacy: {kept}/{len(senate_rows)} added since {cutoff.date()}")
    except Exception as exc:
        print(f"[warn] senate legacy fetch failed: {exc}")

    trades = list(merged.values())
    trades.sort(key=lambda t: t["transactionDate"], reverse=True)
    return trades, quiver_party_map


def _price_on_date(ticker: str, date: datetime, cache: dict) -> float | None:
    key = (ticker, date.strftime("%Y-%m-%d"))
    if key in cache:
        return cache[key]
    try:
        import yfinance as yf
    except ImportError:
        return None
    start = (date - timedelta(days=7)).strftime("%Y-%m-%d")
    end = (date + timedelta(days=7)).strftime("%Y-%m-%d")
    try:
        hist = yf.Ticker(ticker).history(start=start, end=end, auto_adjust=True)
        if hist is None or hist.empty:
            cache[key] = None
            return None
        target = date.date()
        best = None
        best_delta = 9999
        for idx, row in hist.iterrows():
            delta = abs((idx.date() - target).days)
            if delta < best_delta:
                best_delta = delta
                best = float(row["Close"])
        cache[key] = best
        return best
    except Exception:
        cache[key] = None
        return None


def _current_price(ticker: str, cache: dict) -> float | None:
    if ticker in cache:
        return cache[ticker]
    try:
        import yfinance as yf
        info = yf.Ticker(ticker).fast_info
        price = getattr(info, "last_price", None) or getattr(info, "previous_close", None)
        if price:
            cache[ticker] = float(price)
            return cache[ticker]
    except Exception:
        pass
    cache[ticker] = None
    return None


def _estimate_returns(trades: list[dict], months: int = 18, max_tickers: int = 120) -> dict[str, float]:
    cutoff = datetime.now() - timedelta(days=months * 30)
    buy_by_pol: dict[str, list[dict]] = defaultdict(list)
    ticker_freq: dict[str, int] = defaultdict(int)
    returns: dict[str, float] = {}

    for t in trades:
        if t["side"] != "buy":
            continue
        tx = _parse_date(t["transactionDate"])
        if not tx or tx < cutoff:
            continue
        buy_by_pol[t["politician"]].append(t)
        ticker_freq[t["ticker"]] += 1

    # Quiver excess-return field (already SPY-relative)
    for pol, buys in buy_by_pol.items():
        weighted = 0.0
        weight_sum = 0.0
        for b in buys:
            if b.get("excessReturnPct") is None:
                continue
            w = max(b.get("amountMid") or 1, 1)
            weighted += b["excessReturnPct"] * w
            weight_sum += w
        if weight_sum > 0:
            returns[pol] = round(weighted / weight_sum, 2)

    top_tickers = [tk for tk, _ in sorted(ticker_freq.items(), key=lambda x: -x[1])[:max_tickers]]
    price_cache: dict = {}
    current_cache: dict = {}
    for tk in top_tickers:
        _current_price(tk, current_cache)

    for pol, buys in buy_by_pol.items():
        if pol in returns:
            continue
        weighted = 0.0
        weight_sum = 0.0
        for b in buys[:40]:
            if b["ticker"] not in top_tickers:
                continue
            tx = _parse_date(b["transactionDate"])
            if not tx:
                continue
            entry = _price_on_date(b["ticker"], tx, price_cache)
            curr = current_cache.get(b["ticker"])
            if not entry or not curr or entry <= 0:
                continue
            ret = (curr - entry) / entry * 100.0
            w = max(b.get("amountMid") or 1, 1)
            weighted += ret * w
            weight_sum += w
        if weight_sum > 0:
            returns[pol] = round(weighted / weight_sum, 2)
    return returns


def _build_committee_matrix(trades: list[dict]) -> list[dict]:
    matrix: dict[str, dict] = {}
    for trade in trades:
        if trade["side"] != "buy":
            continue
        meta = lookup_politician(trade["politician"])
        if not meta:
            continue
        for committee in meta.get("committees") or []:
            sectors = COMMITTEE_SECTOR_MAP.get(committee, [])
            if committee not in matrix:
                matrix[committee] = {
                    "committee": committee,
                    "sectors": sectors,
                    "buyCount": 0,
                    "sellCount": 0,
                    "tickers": defaultdict(int),
                    "politicians": defaultdict(int),
                }
            cell = matrix[committee]
            cell["buyCount"] += 1
            cell["tickers"][trade["ticker"]] += 1
            cell["politicians"][trade["politician"]] += 1

    for trade in trades:
        if trade["side"] != "sell":
            continue
        meta = lookup_politician(trade["politician"])
        if not meta:
            continue
        for committee in meta.get("committees") or []:
            if committee in matrix:
                matrix[committee]["sellCount"] += 1

    rows = []
    for committee, cell in matrix.items():
        top_tickers = sorted(cell["tickers"].items(), key=lambda x: -x[1])[:8]
        top_pols = sorted(cell["politicians"].items(), key=lambda x: -x[1])[:5]
        rows.append({
            "committee": committee,
            "sectors": cell["sectors"],
            "buyCount": cell["buyCount"],
            "sellCount": cell["sellCount"],
            "topTickers": [{"ticker": t, "count": c} for t, c in top_tickers],
            "topPoliticians": [{"name": n, "count": c} for n, c in top_pols],
        })
    rows.sort(key=lambda r: -(r["buyCount"] + r["sellCount"]))
    return rows


def build_payload(*, lookback_years: int = 5, return_months: int = 18, skip_returns: bool = False) -> dict:
    cutoff = datetime.now() - timedelta(days=lookback_years * 365)
    trades, quiver_party_map = _load_trades(cutoff)
    party_lookup = None
    try:
        party_lookup = CongressPartyLookup.from_remote()
        print("[fetch] congress legislators party index loaded")
    except Exception as exc:
        print(f"[warn] congress party lookup unavailable: {exc}")

    for t in trades:
        meta = lookup_politician(t["politician"]) or {}
        party = _resolve_party(
            t["politician"],
            t["chamber"],
            t.get("party"),
            registry_meta=meta,
            quiver_party_map=quiver_party_map,
            party_lookup=party_lookup,
        )
        if party:
            t["party"] = party

    returns = {} if skip_returns else _estimate_returns(trades, months=return_months)

    by_pol: dict[str, dict] = {}
    by_ticker: dict[str, dict] = {}

    for t in trades:
        pol = t["politician"]
        if pol not in by_pol:
            meta = lookup_politician(pol) or {}
            party = _resolve_party(
                pol,
                t["chamber"],
                t.get("party"),
                registry_meta=meta,
                quiver_party_map=quiver_party_map,
                party_lookup=party_lookup,
            )
            by_pol[pol] = {
                "id": _slug_id(pol, t["chamber"]),
                "name": pol,
                "chamber": t["chamber"],
                "party": party,
                "committees": meta.get("committees", []),
                "district": t.get("district", ""),
                "tradeCount": 0,
                "buyCount": 0,
                "sellCount": 0,
                "recentTrades": [],
                "estReturnPct": None,
            }
        elif not by_pol[pol]["party"]:
            meta = lookup_politician(pol) or {}
            party = _resolve_party(
                pol,
                t["chamber"],
                t.get("party"),
                registry_meta=meta,
                quiver_party_map=quiver_party_map,
                party_lookup=party_lookup,
            )
            if party:
                by_pol[pol]["party"] = party
        rec = by_pol[pol]
        rec["tradeCount"] += 1
        if t["side"] == "buy":
            rec["buyCount"] += 1
        elif t["side"] == "sell":
            rec["sellCount"] += 1
        if len(rec["recentTrades"]) < 30:
            rec["recentTrades"].append(t)

        tk = t["ticker"]
        if tk not in by_ticker:
            by_ticker[tk] = {"ticker": tk, "trades": [], "netBuys": 0, "netSells": 0, "politicians": set()}
        cell = by_ticker[tk]
        if len(cell["trades"]) < 50:
            cell["trades"].append(t)
        if t["side"] == "buy":
            cell["netBuys"] += 1
        elif t["side"] == "sell":
            cell["netSells"] += 1
        cell["politicians"].add(pol)

    politicians = list(by_pol.values())
    for p in politicians:
        if not p.get("party"):
            meta = lookup_politician(p["name"]) or {}
            party = _resolve_party(
                p["name"],
                p["chamber"],
                None,
                registry_meta=meta,
                quiver_party_map=quiver_party_map,
                party_lookup=party_lookup,
            )
            if party:
                p["party"] = party
        p["estReturnPct"] = returns.get(p["name"])
        p["recentTrades"] = p["recentTrades"][:20]

    rankings = sorted(
        [p for p in politicians if p.get("estReturnPct") is not None],
        key=lambda p: p["estReturnPct"],
        reverse=True,
    )

    ticker_index = {}
    for tk, cell in by_ticker.items():
        ticker_index[tk] = {
            "ticker": tk,
            "netBuys": cell["netBuys"],
            "netSells": cell["netSells"],
            "politicianCount": len(cell["politicians"]),
            "trades": cell["trades"][:25],
        }

    return {
        "source": "Quiver Quant (최신) + House/Senate PTR 공시 미러",
        "updatedAtKst": datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S KST"),
        "lookbackYears": lookback_years,
        "note": (
            "의회 PTR(Periodic Transaction Report) 공시 기반입니다. "
            "실제 체결 후 최대 45일 지연될 수 있으며, 수익률은 최근 매수 거래의 추정값입니다."
        ),
        "tradeCount": len(trades),
        "politicianCount": len(politicians),
        "rankings": [
            {
                "rank": idx + 1,
                "id": p["id"],
                "name": p["name"],
                "chamber": p["chamber"],
                "party": p["party"],
                "estReturnPct": p["estReturnPct"],
                "buyCount": p["buyCount"],
                "sellCount": p["sellCount"],
                "tradeCount": p["tradeCount"],
                "committees": p["committees"],
            }
            for idx, p in enumerate(rankings[:100])
        ],
        "politicians": sorted(politicians, key=lambda p: -p["tradeCount"])[:300],
        "byTicker": ticker_index,
        "committeeSectorMatrix": _build_committee_matrix(trades),
        "recentTrades": trades[:200],
    }


def write_files(payload: dict) -> None:
    body = json.dumps(payload, ensure_ascii=False, indent=2)
    atomic_write_text(OUT_JSON, body + "\n")
    atomic_write_text(
        OUT_JS,
        "window.CONGRESS_TRADES = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n",
    )


def _run_git(project_dir: Path, args, **kwargs):
    return subprocess.run(["git", *args], cwd=project_dir, **kwargs)


def publish_payload(project_dir: Path, commit_label: str = "Congress Trades") -> bool:
    paths = ["data/congress_trades.json", "data/congress_trades.js"]
    remotes = _run_git(project_dir, ["remote"], capture_output=True, text=True, check=True)
    if not remotes.stdout.strip():
        return True
    branch = _run_git(
        project_dir,
        ["branch", "--show-current"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()
    if not branch:
        raise RuntimeError("detached HEAD")

    _run_git(project_dir, ["add", "--", *paths], check=True)
    status = _run_git(
        project_dir,
        ["status", "--porcelain", "--", *paths],
        capture_output=True,
        text=True,
        check=True,
    )
    if status.stdout.strip():
        stamp = datetime.now(KST).strftime("%Y-%m-%d %H:%M")
        msg = f"Auto-update congress trades ({commit_label}): {stamp} [skip ci]"
        _run_git(project_dir, ["commit", "-m", msg, "--", *paths], check=True)

    for attempt in range(1, 4):
        try:
            _run_git(project_dir, ["fetch", "origin", branch], check=True)
            _run_git(project_dir, ["pull", "--rebase", "origin", branch], check=True)
            _run_git(project_dir, ["push", "origin", branch], check=True)
            print(f"  [Git] origin/{branch} congress trades 푸시 완료")
            return True
        except Exception as error:
            if attempt < 3:
                print(f"  [Git] 푸시 시도 {attempt} 실패: {error}")
                time.sleep(10)
    return False


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-push", action="store_true")
    parser.add_argument("--skip-returns", action="store_true", help="Skip yfinance return estimates")
    parser.add_argument("--lookback-years", type=int, default=5)
    args = parser.parse_args()

    payload = build_payload(lookback_years=args.lookback_years, skip_returns=args.skip_returns)
    project_dir = ROOT

    with repository_publish_lock(project_dir):
        write_files(payload)
        print(
            f"Wrote {OUT_JSON} — {payload['tradeCount']} trades, "
            f"{payload['politicianCount']} politicians, "
            f"{len(payload['rankings'])} ranked"
        )
        if not args.no_push:
            publish_payload(project_dir)


if __name__ == "__main__":
    main()