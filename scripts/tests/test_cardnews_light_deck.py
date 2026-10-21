# -*- coding: utf-8 -*-
"""카드뉴스 덱 경량화(update_data.light_card_deck) — 축소본(thumbs)을 버리지 않는다.

2026-10-21: 경량 파일(data/cardnews.json)이 thumbs 를 버려 KR 홈이 원본 PNG 5장(~7MB)을 받았다.
"""
import update_data as ud

IMGS = ["data/content/2026-10-08/kr/01-topic.png", "data/content/2026-10-08/kr/02-topic.png"]
THUMBS = ["data/content/2026-10-08/kr/01-topic.thumb.webp", "data/content/2026-10-08/kr/02-topic.thumb.webp"]


def test_not_a_deck_is_none():
    assert ud.light_card_deck(None) is None
    assert ud.light_card_deck({"title": "x", "images": []}) is None


def test_existing_thumbs_are_kept_only_when_counts_match():
    assert ud.light_card_deck({"title": "t", "images": IMGS, "thumbs": THUMBS, "extra": 1}) == {
        "title": "t", "images": IMGS, "thumbs": THUMBS}
    assert ud.light_card_deck({"title": "t", "images": IMGS, "thumbs": THUMBS[:1]}) == {"title": "t", "images": IMGS}


def test_derived_thumbs_only_when_every_file_exists(tmp_path):
    deck = {"title": "t", "images": IMGS}
    assert ud.light_card_deck(deck, tmp_path) == {"title": "t", "images": IMGS}  # 파일 없음 → 안 붙인다
    (tmp_path / THUMBS[0]).parent.mkdir(parents=True)
    (tmp_path / THUMBS[0]).write_bytes(b"x")
    assert "thumbs" not in ud.light_card_deck(deck, tmp_path)  # 일부만 있으면 안 붙인다
    (tmp_path / THUMBS[1]).write_bytes(b"x")
    assert ud.light_card_deck(deck, tmp_path)["thumbs"] == THUMBS


def test_write_cardnews_file_keeps_and_heals_thumbs(tmp_path, monkeypatch):
    import json
    light = tmp_path / "data" / "cardnews.json"
    light.parent.mkdir(parents=True)
    light.write_text(json.dumps({"us": {"title": "u", "images": ["a.png"]}, "kr": {"title": "k", "images": IMGS}}), encoding="utf-8")
    for t in THUMBS:
        (tmp_path / t).parent.mkdir(parents=True, exist_ok=True)
        (tmp_path / t).write_bytes(b"x")
    monkeypatch.setattr(ud, "ROOT", tmp_path)
    monkeypatch.setattr(ud, "CARDNEWS_JSON", light)
    monkeypatch.setattr(ud, "CARDNEWS_JS", tmp_path / "data" / "cardnews.js")
    ud.write_cardnews_file("kr", None)  # 오늘 덱 없음 → 기존 KR 덱 유지 + 실제 있는 축소본만 채움
    out = json.loads(light.read_text(encoding="utf-8"))
    assert out["kr"] == {"title": "k", "images": IMGS, "thumbs": THUMBS}
    assert out["us"] == {"title": "u", "images": ["a.png"]}  # 상대 시장 키는 그대로
