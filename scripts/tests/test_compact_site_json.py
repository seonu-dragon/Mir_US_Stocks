# -*- coding: utf-8 -*-
"""배포 스테이징 JSON 압축(scripts/compact_site_json.py) — 값은 그대로, 공백만 뺀다."""
import json

import compact_site_json as c


def test_pretty_file_is_compacted_with_identical_values(tmp_path):
    obj = {"stocks": [{"ticker": "AAPL", "price": 1.50, "name": "애플", "x": None, "nan": float("nan")}], "n": 3}
    p = tmp_path / "data" / "s.json"
    p.parent.mkdir()
    p.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")
    before = p.stat().st_size
    assert c.main(["--root", str(tmp_path), "data/s.json", "data/missing.json"]) == 0
    text = p.read_text(encoding="utf-8")
    assert "\n" not in text and p.stat().st_size < before
    back = json.loads(text)
    assert back["stocks"][0]["name"] == "애플" and back["stocks"][0]["price"] == 1.5 and back["n"] == 3
    assert back["stocks"][0]["nan"] != back["stocks"][0]["nan"]  # NaN 은 NaN 으로 남는다


def test_already_compact_or_broken_is_left_alone(tmp_path):
    p = tmp_path / "a.json"
    p.write_text('{"a":1}', encoding="utf-8")
    assert c.compact_file(p) is None and p.read_text(encoding="utf-8") == '{"a":1}'
    q = tmp_path / "b.json"
    q.write_text("{broken", encoding="utf-8")
    assert c.compact_file(q) is None and q.read_text(encoding="utf-8") == "{broken"
