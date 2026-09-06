# -*- coding: utf-8 -*-
"""카드뉴스 축소본(build_today_content.make_card_thumb) — 720px WebP 가 만들어지고,
Pillow 가 없거나 파일이 깨졌으면 None 으로 조용히 넘어간다."""
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

PIL = pytest.importorskip("PIL")
from PIL import Image  # noqa: E402

import build_today_content as btc  # noqa: E402


def test_thumb_is_webp_resized_to_720(tmp_path):
    src = tmp_path / "02-topic.png"
    Image.new("RGB", (1080, 1350), (30, 60, 120)).save(src, "PNG")
    dest = tmp_path / "out"
    dest.mkdir()
    out = btc.make_card_thumb(src, dest)
    assert out is not None and out.name == "02-topic.thumb.webp" and out.exists()
    with Image.open(out) as im:
        assert im.format == "WEBP"
        assert im.width == btc.THUMB_WIDTH
        assert im.height == 900  # 1350 * 720/1080
    assert out.stat().st_size < src.stat().st_size


def test_small_source_is_not_upscaled(tmp_path):
    src = tmp_path / "03-topic.png"
    Image.new("RGB", (400, 500), (200, 200, 200)).save(src, "PNG")
    out = btc.make_card_thumb(src, tmp_path)
    with Image.open(out) as im:
        assert im.size == (400, 500)


def test_broken_png_returns_none(tmp_path):
    src = tmp_path / "04-topic.png"
    src.write_bytes(b"not a png")
    assert btc.make_card_thumb(src, tmp_path) is None
