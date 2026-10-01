"""rebase -X theirs 뒤 오늘 카드뉴스 재적용(scripts/cardnews_reconcile.py).

2026-10-01 회귀: 10:21 KST 에 발행한 10-01 카드뉴스를, 그 전에 체크아웃한 US 스냅샷 잡이
10:30 push 하면서 -X theirs 로 09-29 덱으로 덮었다.
"""
from __future__ import annotations

import json
import subprocess
from datetime import datetime

import pytest

import cardnews_reconcile as cr
import sec_client as sec

TODAY = datetime.now(cr.KST).strftime("%Y-%m-%d")
OLD = {"title": "옛 덱", "images": ["data/content/2026-09-29/us/01-topic.png"]}
NEW_US = {"title": "오늘 US", "images": [f"data/content/{TODAY}/us/01-topic.png"],
          "thumbs": [f"data/content/{TODAY}/us/01-topic.thumb.webp"]}
NEW_KR = {"title": "오늘 KR", "images": [f"data/content/{TODAY}/kr/01-topic.png"]}


def _write(root, rel, obj):
    p = root / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(obj, ensure_ascii=False), encoding="utf-8")


def _read(root, rel):
    return json.loads((root / rel).read_text(encoding="utf-8"))


def _manifest(root, date=TODAY, us=NEW_US, kr=NEW_KR):
    _write(root, cr.MANIFEST, {"date": date, "us": us, "kr": kr})


def test_stale_snapshot_and_light_file_are_fixed_other_keys_kept(tmp_path):
    _manifest(tmp_path)
    _write(tmp_path, cr.SNAPSHOT, {"updatedAtKst": "x", "stocks": [1, 2], "cardNews": {"us": OLD, "kr": OLD}})
    _write(tmp_path, cr.CARDNEWS_JSON, {"updatedAtKst": "x", "us": OLD, "kr": OLD})
    changed = cr.reapply_today_card_news(tmp_path)
    assert changed == [cr.SNAPSHOT, cr.CARDNEWS_JSON, cr.CARDNEWS_JS]
    snap = _read(tmp_path, cr.SNAPSHOT)
    assert snap["stocks"] == [1, 2] and snap["updatedAtKst"] == "x"
    assert snap["cardNews"]["us"] == NEW_US and snap["cardNews"]["kr"] == NEW_KR
    light = _read(tmp_path, cr.CARDNEWS_JSON)
    assert light["us"] == {"title": "오늘 US", "images": NEW_US["images"]}
    assert (tmp_path / cr.CARDNEWS_JS).read_text(encoding="utf-8").startswith("window.MIR_CARDNEWS = {")


def test_already_current_is_noop(tmp_path):
    _manifest(tmp_path)
    _write(tmp_path, cr.SNAPSHOT, {"cardNews": {"us": NEW_US, "kr": NEW_KR}})
    _write(tmp_path, cr.CARDNEWS_JSON, {"us": NEW_US, "kr": NEW_KR})
    assert cr.reapply_today_card_news(tmp_path) == []


def test_yesterdays_manifest_never_touches_files(tmp_path):
    """발행 전(매니페스트가 어제 날짜)에는 아무것도 바꾸지 않는다 — 옛 덱으로 되돌리는 일이 없게."""
    _manifest(tmp_path, date="2000-01-01")
    _write(tmp_path, cr.SNAPSHOT, {"cardNews": {"us": OLD}})
    assert cr.reapply_today_card_news(tmp_path) == []
    assert _read(tmp_path, cr.SNAPSHOT)["cardNews"]["us"] == OLD


def test_only_published_variant_is_rewritten(tmp_path):
    _manifest(tmp_path, kr=None)
    _write(tmp_path, cr.CARDNEWS_JSON, {"us": OLD, "kr": OLD})
    cr.reapply_today_card_news(tmp_path)
    light = _read(tmp_path, cr.CARDNEWS_JSON)
    assert light["us"]["images"] == NEW_US["images"] and light["kr"] == OLD


@pytest.mark.parametrize("paths,expected", [
    (["data/"], True),
    (["data/market_snapshot.json"], True),
    (["data/korea/", "data/cardnews.json", "data/cardnews.js"], True),
    (["data/korea/"], False),
    (["data/insider_trades.json", "data/insider_trades.js"], False),
])
def test_touches_card_files(paths, expected):
    assert cr.touches_card_files(paths) is expected


def _git(cwd, *args):
    return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True,
                          text=True, encoding="utf-8").stdout


def _clone(tmp_path, remote, name):
    work = tmp_path / name
    _git(tmp_path, "clone", "-q", str(remote), str(work))
    _git(work, "config", "user.email", "t@example.com")
    _git(work, "config", "user.name", "t")
    _git(work, "config", "commit.gpgsign", "false")
    return work


def test_git_publish_keeps_card_news_published_after_checkout(tmp_path):
    """잡 체크아웃 → 사람이 오늘 카드뉴스 발행·push → 잡이 옛 cardNews 를 들고 push. 결과에 둘 다 살아야 한다."""
    remote = tmp_path / "remote.git"
    _git(tmp_path, "init", "-q", "--bare", str(remote))
    _git(remote, "symbolic-ref", "HEAD", "refs/heads/main")
    seed = tmp_path / "seed"
    _git(tmp_path, "init", "-q", "-b", "main", str(seed))
    for k, v in (("user.email", "t@example.com"), ("user.name", "t"), ("commit.gpgsign", "false")):
        _git(seed, "config", k, v)
    _manifest(seed, date="2000-01-01", us=OLD, kr=OLD)
    _write(seed, cr.SNAPSHOT, {"v": 0, "cardNews": {"us": OLD, "kr": OLD}})
    _write(seed, cr.CARDNEWS_JSON, {"us": OLD, "kr": OLD})
    (seed / cr.CARDNEWS_JS).write_text("x", encoding="utf-8")
    _git(seed, "add", ".")
    _git(seed, "commit", "-qm", "init")
    _git(seed, "remote", "add", "origin", str(remote))
    _git(seed, "push", "-q", "origin", "main")

    job = _clone(tmp_path, remote, "job")          # 06:05 잡이 늦게 체크아웃
    person = _clone(tmp_path, remote, "person")    # 10:21 아침 발행
    _manifest(person)
    _write(person, cr.SNAPSHOT, {"v": 0, "cardNews": {"us": NEW_US, "kr": NEW_KR}})
    _write(person, cr.CARDNEWS_JSON, {"us": NEW_US, "kr": NEW_KR})
    _git(person, "add", ".")
    _git(person, "commit", "-qm", "오늘의 콘텐츠")
    _git(person, "push", "-q", "origin", "main")

    _write(job, cr.SNAPSHOT, {"v": 1, "cardNews": {"us": OLD, "kr": OLD}})  # 새 시세 + 옛 덱
    _write(job, cr.CARDNEWS_JSON, {"us": OLD, "kr": OLD, "updatedAtKst": "job"})
    assert sec.git_publish([cr.SNAPSHOT, cr.CARDNEWS_JSON], "snap", cwd=job, attempts=1, sleep_s=0)

    check = _clone(tmp_path, remote, "check")
    snap = _read(check, cr.SNAPSHOT)
    assert snap["v"] == 1, "잡이 만든 새 데이터는 그대로"
    assert snap["cardNews"]["us"]["images"] == NEW_US["images"], "오늘 카드뉴스가 옛 덱으로 덮였다"
    assert _read(check, cr.CARDNEWS_JSON)["kr"]["images"] == NEW_KR["images"]
