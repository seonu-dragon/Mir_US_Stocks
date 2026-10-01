"""rebase 직후 오늘 카드뉴스를 다시 맞춘다 — `pull --rebase -X theirs` 가 덮어쓴 것을 되돌린다.

데이터 워크플로우는 push 충돌 시 "방금 만든 우리 버전"을 채택한다(-X theirs). 그런데 잡이
체크아웃한 뒤에 아침 카드뉴스 발행(scripts/publish_today.ps1)이 끼어들면, 잡이 들고 있던
옛 cardNews 가 방금 발행된 오늘 덱을 덮는다. 2026-10-01: 10:21 KST 에 10-01 덱을 발행했는데
06:05 예약이 늦게 출발한 US 스냅샷이 10:30 에 push 하며 market_snapshot.json·cardnews.json 을
09-29 덱으로 되돌렸다(사이트 카드뉴스가 이틀 전 것).

data/today_content.json 은 발행 스크립트만 쓰고 데이터 잡은 건드리지 않아 rebase 뒤에도
항상 최신이다. 그래서 rebase 가 끝난 작업 트리에서 그 매니페스트(오늘 KST 날짜일 때만)를
기준으로 market_snapshot.json 의 cardNews 와 cardnews.json/.js 의 덱을 비교해, 다르면
그 덱만 고쳐 쓴다. 다른 키는 건드리지 않는다. 오늘 매니페스트가 없으면(발행 전) 아무것도 안 한다.

호출: sec_client.git_publish · update_data._push_snapshot_with_retries 가 rebase 직후,
이번 push 가 카드뉴스 파일을 포함할 때만.
"""
from __future__ import annotations

import json
import os
import tempfile
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

KST = ZoneInfo("Asia/Seoul")
VARIANTS = ("us", "kr")
MANIFEST = "data/today_content.json"
SNAPSHOT = "data/market_snapshot.json"
CARDNEWS_JSON = "data/cardnews.json"
CARDNEWS_JS = "data/cardnews.js"
CARD_FILES = (SNAPSHOT, CARDNEWS_JSON, CARDNEWS_JS)


def touches_card_files(paths) -> bool:
    """push 대상 경로(파일 또는 디렉터리 접두)가 카드뉴스 파일을 포함하는가."""
    for raw in paths or ():
        p = str(raw).replace("\\", "/").rstrip("/")
        if p in ("", ".", "data"):
            return True
        for f in CARD_FILES:
            if f == p or f.startswith(p + "/"):
                return True
    return False


def _load(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _atomic_write(path: Path, text: str) -> None:
    fd, tmp = tempfile.mkstemp(prefix=path.stem + "_", suffix=path.suffix, dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(text)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def today_decks(repo: Path, now: datetime | None = None) -> dict:
    """오늘(KST) 날짜 매니페스트의 덱 {variant: deck}. 없거나 날짜가 다르면 {}."""
    raw = _load(repo / MANIFEST)
    if not isinstance(raw, dict):
        return {}
    today = (now or datetime.now(KST)).astimezone(KST).strftime("%Y-%m-%d")
    if str(raw.get("date") or "").strip() != today:
        return {}
    decks = {}
    for v in VARIANTS:
        deck = raw.get(v)
        if isinstance(deck, dict) and isinstance(deck.get("images"), list) and deck["images"]:
            decks[v] = deck
    return decks


def _same(current, deck) -> bool:
    return isinstance(current, dict) and current.get("images") == deck.get("images")


def reapply_today_card_news(repo, now: datetime | None = None) -> list[str]:
    """어긋난 카드뉴스 파일을 고쳐 쓰고, 고친 파일의 레포 상대경로 목록을 돌려준다."""
    repo = Path(repo)
    decks = today_decks(repo, now)
    if not decks:
        return []
    changed: list[str] = []

    # 1) US 스냅샷의 cardNews — 프론트가 가장 먼저 읽는다(app.js 카드뉴스 폴백 체인 ①).
    snap_path = repo / SNAPSHOT
    snap = _load(snap_path) if snap_path.exists() else None
    if isinstance(snap, dict):
        card_news = snap.get("cardNews") if isinstance(snap.get("cardNews"), dict) else {}
        stale = [v for v, deck in decks.items() if not _same(card_news.get(v), deck)]
        if stale:
            card_news = dict(card_news)
            for v in stale:
                card_news[v] = decks[v]
            snap["cardNews"] = card_news
            _atomic_write(snap_path, json.dumps(snap, ensure_ascii=False, separators=(",", ":")))
            changed.append(SNAPSHOT)

    # 2) 경량 파일 cardnews.json/.js — KR 모드와 스냅샷에 cardNews 가 없을 때의 폴백.
    #    스키마는 update_data.write_cardnews_file 과 같다({updatedAtKst, us, kr}, 덱은 title·images).
    light_path = repo / CARDNEWS_JSON
    light = _load(light_path) if light_path.exists() else None
    light = light if isinstance(light, dict) else {}
    stale = [v for v, deck in decks.items() if not _same(light.get(v), deck)]
    if stale:
        payload = {
            "updatedAtKst": (now or datetime.now(KST)).astimezone(KST).strftime("%Y-%m-%d %H:%M KST"),
            "us": light.get("us"),
            "kr": light.get("kr"),
        }
        for v in stale:
            payload[v] = {"title": decks[v].get("title") or "", "images": decks[v]["images"]}
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        light_path.parent.mkdir(parents=True, exist_ok=True)
        _atomic_write(light_path, body + "\n")
        _atomic_write(repo / CARDNEWS_JS, f"window.MIR_CARDNEWS = {body};\n")
        changed += [CARDNEWS_JSON, CARDNEWS_JS]
    return changed


def reapply_and_commit(run, repo) -> bool:
    """git_publish 류의 rebase 직후 호출. 고친 게 있으면 커밋까지 하고 True."""
    try:
        changed = reapply_today_card_news(repo)
    except Exception as exc:  # 보정 실패가 데이터 발행 자체를 막지 않게.
        print(f"  [cardnews] rebase 후 카드뉴스 재적용 실패(발행은 계속): {exc}")
        return False
    if not changed:
        return False
    run(["add", "--", *changed], check=True)
    run(["commit", "-m", "Re-apply today's card news after rebase", "--", *changed], check=True)
    print(f"  [cardnews] rebase 가 덮은 오늘 카드뉴스를 되돌림: {', '.join(changed)}")
    return True


if __name__ == "__main__":
    import sys
    root = Path(__file__).resolve().parent.parent
    fixed = reapply_today_card_news(root)
    print("고친 파일:", ", ".join(fixed) if fixed else "없음(이미 오늘 덱)")
    sys.exit(0)
