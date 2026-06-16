#!/usr/bin/env python3
"""Build data/today_content.json for the homepage "오늘의 콘텐츠" band.

It scans the day's produced content and writes a manifest the site reads via
``window.MARKET_SNAPSHOT.todayContent``:

  - card news : AI/카드뉴스/daily/<date>[-us]/out/01-cover.png  (+ cards.json)
  - SNS drafts: AI/SNS/Production/<date>/[daily_brief/]{naver_blog,x,threads,instagram,facebook}.txt

Link resolution per platform (first hit wins):
  1. AI/SNS/Production/<date>/links.json     {"naver": "...", "x": "...", "cardnews": "..."}
  2. Mir_US_Stocks/data/content_sources.json (account home pages — fill once)
  3. "#"

Usage:
  python scripts/build_today_content.py [--date YYYY-MM-DD] [--merge]

  --merge   also writes todayContent into data/market_snapshot.{json,js} immediately
            (no network), so the band goes live without a full market rebuild.
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
SOURCES_FILE = ROOT / "data" / "content_sources.json"
CONTENT_ASSETS = ROOT / "data" / "content"

# filename stem -> platform key used by the front-end badge styling
PLATFORM_FILES = [
    ("naver_blog", "naver"),
    ("x", "x"),
    ("threads", "threads"),
    ("instagram", "instagram"),
]


def kst_today():
    return datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y-%m-%d")


def load_json(path):
    try:
        with open(path, encoding="utf-8") as handle:
            return json.load(handle)
    except Exception:
        return {}


def find_card_dir(date):
    """Prefer the US variant (the site is US stocks), then the plain date folder."""
    for name in (f"{date}-us", date):
        candidate = CARD_DAILY / name
        if (candidate / "out" / "01-cover.png").exists():
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


def file_time(path):
    try:
        ts = path.stat().st_mtime
        return datetime.fromtimestamp(ts, ZoneInfo("Asia/Seoul")).strftime("%H:%M")
    except Exception:
        return None


def resolve_url(platform, links, sources):
    for table in (links, sources):
        url = (table or {}).get(platform)
        if isinstance(url, str) and url.strip() and url.strip() != "#":
            return url.strip()
    return "#"


def build_items(date):
    prod_dir = SNS_PROD / date
    links = load_json(prod_dir / "links.json")
    sources = load_json(SOURCES_FILE)

    # Day title: blog headline reads best; fall back to the card-news cover headline.
    day_title = None
    naver_path = find_draft(prod_dir, "naver_blog")
    if naver_path:
        day_title = first_heading(naver_path)

    card_dir = find_card_dir(date)
    cards_meta = load_json(card_dir / "cards.json") if card_dir else {}
    if not day_title:
        cover = next((c for c in cards_meta.get("cards", []) if c.get("type") == "cover"), {})
        parts = [cover.get("headlineLine1"), cover.get("accentText"), cover.get("headlineTail")]
        day_title = " ".join(p for p in parts if p) or "오늘 올린 글"
    day_title = day_title[:90].strip()

    items = []

    # 1) Card news (with deployable cover thumbnail)
    if card_dir:
        cover_src = card_dir / "out" / "01-cover.png"
        dest_dir = CONTENT_ASSETS / date
        dest_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(cover_src, dest_dir / "cover.png")
        items.append({
            "platform": "cardnews",
            "title": day_title,
            "url": resolve_url("cardnews", links, sources),
            "thumb": f"data/content/{date}/cover.png",
            "time": file_time(cover_src),
        })

    # 2) One entry per platform draft that exists for the day
    for stem, platform in PLATFORM_FILES:
        path = find_draft(prod_dir, stem)
        if not path:
            continue
        items.append({
            "platform": platform,
            "title": day_title,
            "url": resolve_url(platform, links, sources),
            "time": file_time(path),
        })

    return items


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


def merge_into_snapshot(items):
    """Inject todayContent into the existing snapshot files without a market rebuild."""
    snapshot = load_json(OUT_JSON)
    if not snapshot:
        print("[merge] market_snapshot.json not found; skipping live merge "
              "(it will be injected on the next update_data.py run).")
        return
    snapshot["todayContent"] = items
    body = json.dumps(snapshot, ensure_ascii=False, separators=(",", ":"))
    atomic_write(OUT_JSON, body)
    atomic_write(OUT_JS, f"window.MARKET_SNAPSHOT = {body};\n")
    print(f"[merge] Wrote todayContent into {OUT_JSON.name} and {OUT_JS.name}.")


def main():
    parser = argparse.ArgumentParser(description="Build today's homepage content band manifest.")
    parser.add_argument("--date", default=kst_today(), help="YYYY-MM-DD (default: today KST)")
    parser.add_argument("--merge", action="store_true",
                        help="Also inject into market_snapshot.{json,js} immediately.")
    args = parser.parse_args()

    items = build_items(args.date)
    manifest = {"date": args.date, "items": items}
    atomic_write(OUT_MANIFEST, json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")

    print(f"Wrote {OUT_MANIFEST.relative_to(ROOT)} with {len(items)} item(s) for {args.date}.")
    for it in items:
        print(f"  - [{it['platform']}] {it['title'][:48]}  ->  {it['url']}")
    if not items:
        print("  (no card news or SNS drafts found for this date)")

    if args.merge:
        merge_into_snapshot(items)


if __name__ == "__main__":
    main()
