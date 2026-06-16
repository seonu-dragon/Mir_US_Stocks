#!/usr/bin/env python3
"""Build data/today_content.json — the homepage "오늘의 카드뉴스" gallery.

It takes the day's card-news deck and exposes only the *body* pages (the cover
and the closing page are dropped) as a horizontal gallery the site reads via
``window.MARKET_SNAPSHOT.cardNews``.

Source:
  AI/카드뉴스/daily/<date>[-us]/out/*.png   (sorted; first = cover, last = closing)

Output:
  Mir_US_Stocks/data/content/<date>/*.png   (copied body pages, deployable)
  Mir_US_Stocks/data/today_content.json      {"date","title","images":[...]}

Usage:
  python scripts/build_today_content.py [--date YYYY-MM-DD] [--merge]

  --merge   also writes cardNews into data/market_snapshot.{json,js} immediately
            (no network), so the gallery goes live without a full market rebuild.
            update_data.py also injects/preserves this manifest on its daily run.
"""

import argparse
import json
import os
import shutil
import tempfile
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]            # Mir_US_Stocks/
AI_ROOT = ROOT.parent                                  # AI/
CARD_DAILY = AI_ROOT / "카드뉴스" / "daily"
SNS_PROD = AI_ROOT / "SNS" / "Production"

OUT_MANIFEST = ROOT / "data" / "today_content.json"
OUT_JSON = ROOT / "data" / "market_snapshot.json"
OUT_JS = ROOT / "data" / "market_snapshot.js"
CONTENT_ASSETS = ROOT / "data" / "content"


def kst_today():
    return datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y-%m-%d")


def load_json(path):
    try:
        with open(path, encoding="utf-8") as handle:
            return json.load(handle)
    except Exception:
        return {}


# Two card-news versions per day:
#   us = 미국장 마감 시황 브리핑  -> 카드뉴스/daily/<date>-us
#   kr = 국내 주요 뉴스           -> 카드뉴스/daily/<date>
VARIANTS = {"us": "{date}-us", "kr": "{date}"}


def variant_card_dir(date, variant):
    candidate = CARD_DAILY / VARIANTS[variant].format(date=date)
    out = candidate / "out"
    if out.is_dir() and any(out.glob("*.png")):
        return candidate
    return None


def find_draft(prod_dir, stem):
    for base in (prod_dir, prod_dir / "daily_brief"):
        path = base / f"{stem}.txt"
        if path.exists():
            return path
    return None


def first_heading(path):
    try:
        for line in path.read_text(encoding="utf-8").splitlines():
            s = line.strip()
            if not s:
                continue
            return s.lstrip("#").strip().strip("*").strip()
    except Exception:
        return None
    return None


def deck_title(date, card_dir, variant):
    # 국내 버전은 그날 네이버 블로그 헤드라인이 가장 자연스러움
    if variant == "kr":
        naver_path = find_draft(SNS_PROD / date, "naver_blog")
        if naver_path:
            heading = first_heading(naver_path)
            if heading:
                return heading[:90].strip()
    cover = next((c for c in load_json(card_dir / "cards.json").get("cards", [])
                  if c.get("type") == "cover"), {})
    parts = [cover.get("headlineLine1"), cover.get("accentText"), cover.get("headlineTail")]
    fallback = "미국장 마감 카드뉴스" if variant == "us" else "국내 뉴스 카드뉴스"
    return (" ".join(p for p in parts if p) or fallback)[:90].strip()


def build_deck(date, variant):
    card_dir = variant_card_dir(date, variant)
    if not card_dir:
        return None

    pages = sorted((card_dir / "out").glob("*.png"))
    # Drop the cover (first) and the closing page (last); keep only the body pages.
    body = pages[1:-1] if len(pages) > 2 else pages

    dest_dir = CONTENT_ASSETS / date / variant
    dest_dir.mkdir(parents=True, exist_ok=True)
    for old in dest_dir.glob("*.png"):      # avoid stale leftovers from previous runs
        old.unlink()

    images = []
    for src in body:
        shutil.copy2(src, dest_dir / src.name)
        images.append(f"data/content/{date}/{variant}/{src.name}")

    return {"title": deck_title(date, card_dir, variant), "images": images}


def build_payload(date):
    # Remove flat leftovers from the old single-version layout.
    flat = CONTENT_ASSETS / date
    if flat.is_dir():
        for old in flat.glob("*.png"):
            old.unlink()
    payload = {"date": date}
    for variant in VARIANTS:
        deck = build_deck(date, variant)
        if deck:
            payload[variant] = deck
    return payload


def atomic_write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=path.stem + "_", suffix=path.suffix, dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(text)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def merge_into_snapshot(payload):
    """Inject cardNews into the existing snapshot files without a market rebuild."""
    snapshot = load_json(OUT_JSON)
    if not snapshot:
        print("[merge] market_snapshot.json not found; skipping live merge "
              "(it will be injected on the next update_data.py run).")
        return
    snapshot.pop("todayContent", None)   # drop the legacy platform-link key
    card_news = {v: payload[v] for v in VARIANTS if payload.get(v)}
    snapshot["cardNews"] = card_news
    body = json.dumps(snapshot, ensure_ascii=False, separators=(",", ":"))
    atomic_write(OUT_JSON, body)
    atomic_write(OUT_JS, f"window.MARKET_SNAPSHOT = {body};\n")
    print(f"[merge] Wrote cardNews into {OUT_JSON.name} and {OUT_JS.name}.")


def main():
    parser = argparse.ArgumentParser(description="Build today's card-news gallery manifest.")
    parser.add_argument("--date", default=kst_today(), help="YYYY-MM-DD (default: today KST)")
    parser.add_argument("--merge", action="store_true",
                        help="Also inject into market_snapshot.{json,js} immediately.")
    args = parser.parse_args()

    payload = build_payload(args.date)

    atomic_write(OUT_MANIFEST, json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    print(f"Wrote {OUT_MANIFEST.relative_to(ROOT)} for {args.date}.")
    for variant in VARIANTS:
        deck = payload.get(variant)
        if deck:
            print(f"  [{variant}] {len(deck['images'])} page(s): {deck['title'][:48]}")
        else:
            print(f"  [{variant}] (없음)")

    if args.merge:
        merge_into_snapshot(payload)


if __name__ == "__main__":
    main()
