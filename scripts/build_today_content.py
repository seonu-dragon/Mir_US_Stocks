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

Retention:
  Each run also prunes data/content/ down to the last KEEP_DAYS dates. The site
  only ever reads today's deck, but this directory used to grow ~13MB per
  publish and never shrink (222MB by 2026-07-18 — 40% of the deploy artifact).
  Pruned days stay recoverable from git history.

      python scripts/build_today_content.py --prune-only --dry-run
      python scripts/build_today_content.py --prune-only --keep-days 7
"""

import argparse
import json
import os
import re
import shutil
import stat
import tempfile
import time
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from briefing_store import apply_briefing_fragments, repository_publish_lock

ROOT = Path(__file__).resolve().parents[1]            # Mir_US_Stocks/
AI_ROOT = ROOT.parent                                  # AI/


def _resolve_card_daily():
    """카드뉴스 생성물이 실제로 있는 daily 폴더를 찾는다.

    정식 위치(AI/카드뉴스/daily)를 우선하되, 생성 도구가 스크래치 영역
    (AI/temp/카드뉴스/daily)에 출력하는 현재 구성도 폴백으로 지원한다.
    둘 다 없으면 정식 경로를 반환해 오류 메시지가 정식 위치를 가리키게 한다.
    """
    candidates = (
        AI_ROOT / "카드뉴스" / "daily",
        AI_ROOT / "temp" / "카드뉴스" / "daily",
    )
    for candidate in candidates:
        if candidate.is_dir():
            return candidate
    return candidates[0]


CARD_DAILY = _resolve_card_daily()
SNS_PROD = AI_ROOT / "SNS" / "Production"

OUT_MANIFEST = ROOT / "data" / "today_content.json"
OUT_JSON = ROOT / "data" / "market_snapshot.json"
OUT_JS = ROOT / "data" / "market_snapshot.js"
CONTENT_ASSETS = ROOT / "data" / "content"

# data/content/ 에 남겨둘 날짜 수. 사이트는 오늘 덱만 참조하므로 원래 1일이면
# 충분하지만, 빌드 실패 시 되돌릴 여지와 KST/UTC 시차 경계를 위해 여유를 둔다.
KEEP_DAYS = 3


def kst_today():
    return datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y-%m-%d")


def load_json(path):
    try:
        with open(path, encoding="utf-8") as handle:
            return json.load(handle)
    except Exception:
        return {}


# Two card-news versions per homepage build date D (KST):
#   us = 미국장 마감 시황 브리핑
#   kr = 국내 주요 뉴스
# 미국장은 한국과 시차가 있어 같은 시각에 만들어도 세션 날짜가 하루 빠르다.
# 그래서 KST 기준 오늘(D) 홈페이지에는 하루 전 세션의 미국 덱을 싣는다.
#   us -> 카드뉴스/daily/<D-1>-us
#   kr -> 카드뉴스/daily/<D>
VARIANTS = ("us", "kr")


def variant_card_date(date, variant):
    """홈페이지 빌드 날짜(date=D)에 대해 각 버전이 사용할 카드뉴스 폴더 날짜.

    us는 시차 때문에 D-1 세션을 싣는다. 잘못된 날짜 문자열이면 그대로 되돌려
    폴더를 못 찾고 조용히 건너뛰도록 한다(예외로 전체 빌드를 깨지 않음)."""
    if variant == "us":
        try:
            prev = datetime.strptime(date, "%Y-%m-%d") - timedelta(days=1)
            return prev.strftime("%Y-%m-%d")
        except ValueError:
            return date
    return date


def variant_folder_name(date, variant):
    card_date = variant_card_date(date, variant)
    return f"{card_date}-us" if variant == "us" else card_date


def variant_card_dir(date, variant):
    candidate = CARD_DAILY / variant_folder_name(date, variant)
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


def plain_text(value):
    """표지 헤드라인의 마크업을 걷어낸다.

    cards.json 의 headlineLine1 은 카드 *이미지* 레이아웃용이라 줄바꿈 지점에
    <br/> 이 박혀 있다. 띠 제목은 textContent 로 들어가 태그가 글자 그대로
    보이므로, 태그를 공백으로 풀고 연속 공백을 정리한다."""
    return " ".join(re.sub(r"<[^>]*>", " ", value or "").split())


def deck_title(date, card_dir, variant):
    # 국내 버전은 그날 네이버 블로그 헤드라인이 가장 자연스러움
    if variant == "kr":
        naver_path = find_draft(SNS_PROD / date, "naver_blog")
        if naver_path:
            heading = plain_text(first_heading(naver_path))
            if heading:
                return heading[:90].strip()
    cover = next((c for c in load_json(card_dir / "cards.json").get("cards", [])
                  if c.get("type") == "cover"), {})
    parts = [cover.get("headlineLine1"), cover.get("accentText"), cover.get("headlineTail")]
    fallback = "미국장 마감 카드뉴스" if variant == "us" else "국내 뉴스 카드뉴스"
    return (plain_text(" ".join(p for p in parts if p)) or fallback)[:90].strip()


def build_deck(date, variant):
    card_dir = variant_card_dir(date, variant)
    if not card_dir:
        return None

    pages = sorted((card_dir / "out").glob("*.png"))
    # Drop the cover (first page). Drop the last page only if it is a closing card
    # (legacy 7-card decks). 6-card decks (cover + 5 topics, no closing) keep all topics.
    cards = load_json(card_dir / "cards.json").get("cards", [])
    has_closing = bool(cards) and cards[-1].get("type") == "closing"
    if len(pages) > 2:
        body = pages[1:-1] if has_closing else pages[1:]
    else:
        body = pages

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


def _rmtree_resilient(path, attempts=5):
    """OneDrive 동기화 폴더에서도 지워지게 재시도한다.

    이 레포는 OneDrive 아래에 있어서, 파일을 지운 직후 동기화 클라이언트가
    디렉터리 핸들을 잠깐 붙들고 있으면 rmdir 이 WinError 5 로 실패한다
    (파일은 지워졌는데 빈 디렉터리만 남는 상태). 읽기전용 속성도 함께 푼다.
    """
    def on_error(func, target, _exc):
        os.chmod(target, stat.S_IWRITE)
        func(target)

    last = None
    for i in range(attempts):
        try:
            shutil.rmtree(path, onexc=on_error)
            return True
        except OSError as exc:
            last = exc
            time.sleep(0.3 * (i + 1))
    print(f"  ! {path.name} 삭제 실패: {last}")
    return False


def prune_old_content(keep_days, today, dry_run=False):
    """data/content/ 에서 보존 기간을 넘긴 날짜 디렉터리를 지운다.

    사이트는 '오늘' 덱만 참조한다(market_snapshot.cardNews / today_content.json).
    지난 카드뉴스를 보는 화면은 없다. 그런데 이 디렉터리는 발행일마다 ~13MB 씩
    쌓이기만 해서, 2026-07-18 기준 222MB / 배포 아티팩트의 40% 를 차지했다.
    GitHub Pages 발행 사이트 권장 한도가 1GB 라 방치하면 언젠가 배포가 막힌다.

    지운 파일은 git 이력에 남으므로 필요하면 되살릴 수 있다:
        git log --all -- data/content/<날짜>
        git checkout <commit> -- data/content/<날짜>
    """
    if not CONTENT_ASSETS.is_dir():
        return []
    cutoff = (datetime.strptime(today, "%Y-%m-%d") - timedelta(days=keep_days - 1)).date()
    removed = []
    for child in sorted(CONTENT_ASSETS.iterdir()):
        if not child.is_dir():
            continue
        try:
            stamp = datetime.strptime(child.name, "%Y-%m-%d").date()
        except ValueError:
            continue                      # 날짜 형식이 아닌 디렉터리는 건드리지 않는다
        if stamp >= cutoff:
            continue
        size = sum(f.stat().st_size for f in child.rglob("*") if f.is_file())
        if not dry_run and not _rmtree_resilient(child):
            continue                      # 못 지운 건 삭제했다고 보고하지 않는다
        removed.append((child.name, size))
    if removed:
        total = sum(s for _, s in removed) / 1024 / 1024
        verb = "지울 대상" if dry_run else "삭제"
        print(f"[prune] {verb} {len(removed)}개 디렉터리, {total:.1f}MB "
              f"(보존 {keep_days}일: {cutoff} 이후)")
        for name, size in removed:
            print(f"  - {name}  {size / 1024 / 1024:.1f}MB")
    return removed


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
    """Inject cardNews while preserving independently stored briefings."""
    with repository_publish_lock(ROOT):
        snapshot = load_json(OUT_JSON)
        if not snapshot:
            print("[merge] market_snapshot.json not found; skipping live merge "
                  "(it will be injected on the next update_data.py run).")
            return
        snapshot.pop("todayContent", None)
        card_news = {v: payload[v] for v in VARIANTS if payload.get(v)}
        snapshot["cardNews"] = card_news
        restored = apply_briefing_fragments(snapshot, ROOT)
        body = json.dumps(snapshot, ensure_ascii=False, separators=(",", ":"))
        atomic_write(OUT_JSON, body)
        atomic_write(OUT_JS, f"window.MARKET_SNAPSHOT = {body};\n")
        if restored:
            print(f"[merge] Preserved briefing fragments: {', '.join(restored)}")
        print(f"[merge] Wrote cardNews into {OUT_JSON.name} and {OUT_JS.name}.")


def main():
    parser = argparse.ArgumentParser(description="Build today's card-news gallery manifest.")
    parser.add_argument("--date", default=kst_today(), help="YYYY-MM-DD (default: today KST)")
    parser.add_argument("--merge", action="store_true",
                        help="Also inject into market_snapshot.{json,js} immediately.")
    parser.add_argument("--keep-days", type=int, default=KEEP_DAYS,
                        help=f"data/content/ 보존 일수 (기본 {KEEP_DAYS}, 0이면 정리 안 함)")
    parser.add_argument("--prune-only", action="store_true",
                        help="덱은 빌드하지 않고 오래된 content 디렉터리만 정리한다.")
    parser.add_argument("--dry-run", action="store_true",
                        help="--prune-only 와 함께: 지울 대상만 출력한다.")
    args = parser.parse_args()

    if args.prune_only:
        prune_old_content(args.keep_days, args.date, dry_run=args.dry_run)
        return

    payload = build_payload(args.date)

    atomic_write(OUT_MANIFEST, json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    print(f"Wrote {OUT_MANIFEST.relative_to(ROOT)} for {args.date}.")
    for variant in VARIANTS:
        deck = payload.get(variant)
        if deck:
            print(f"  [{variant}] {len(deck['images'])} page(s): {deck['title'][:48]}")
        else:
            print(f"  [{variant}] (없음)")

    # today_content.json 을 쓴 직후 경량 카드뉴스 파일(data/cardnews.*)도 함께
    # 갱신한다. 예전엔 이걸 다음 스냅샷 워크플로우가 갱신하도록 맡겼는데, KR
    # 스냅샷이 카드뉴스 발행보다 먼저 도는 날이면 국내 덱이 지난 날짜에
    # 고착됐다(2026-07-24 실측: US 스냅샷만 07-24 를 잡고 KR 은 07-22 고착).
    # 발행 시점에 us·kr 을 모두 써 두면 스냅샷 타이밍과 무관해진다.
    try:
        import update_data as _UD
        for variant in VARIANTS:
            _UD.write_cardnews_file(variant, payload.get(variant))
    except Exception as exc:
        print(f"[cardnews] 경량 파일 갱신 실패(매니페스트는 정상): {exc}")

    # 오늘 덱을 만든 뒤에 정리한다 — 순서가 반대면 보존 계산에 오늘 것이 안 잡힌다.
    if args.keep_days > 0:
        prune_old_content(args.keep_days, args.date)

    if args.merge:
        merge_into_snapshot(payload)


if __name__ == "__main__":
    main()
