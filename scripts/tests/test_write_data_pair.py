"""`sec_client.write_data` — 모든 빌더가 공유하는 .json/.js 발행 경로.

검증:
- `.json` 과 `.js` 가 **같은 페이로드**를 담는다(한쪽만 바뀌면 브라우저와 증분빌드가 갈린다).
- `.js` 는 `window.<GLOBAL> = ...;` 접두를 갖는다(app.js FEATURE_DATA 계약).
- 0건 페이로드로 내용이 있던 파일을 덮지 않는다(exit 1) — `allow_empty=True` 로만 허용.
- 원래 비어 있던(또는 없던) 파일은 막지 않는다.
"""
from __future__ import annotations

import json
import re

import pytest

import sec_client as sec


def _read_js(path):
    text = path.read_text(encoding="utf-8")
    match = re.fullmatch(r"window\.([A-Z][A-Z0-9_]*) = (.*);\n", text, re.S)
    assert match, f"window.<GLOBAL> = ...; 형태가 아니다: {text[:80]!r}"
    return match.group(1), json.loads(match.group(2))


def test_writes_identical_payload_to_both_files(tmp_path):
    payload = {"count": 2, "rows": [{"t": "AAPL"}, {"t": "MSFT"}], "note": "한글 주석"}
    out_json = tmp_path / "thing.json"
    out_js = tmp_path / "thing.js"
    sec.write_data(out_json, out_js, "THING_DATA", payload)

    var, js_payload = _read_js(out_js)
    assert var == "THING_DATA"
    assert js_payload == payload
    assert json.loads(out_json.read_text(encoding="utf-8")) == payload


def test_json_indent_none_is_compact(tmp_path):
    payload = {"count": 1, "rows": [{"t": "AAPL"}]}
    out_json = tmp_path / "c.json"
    out_js = tmp_path / "c.js"
    sec.write_data(out_json, out_js, "C", payload, indent=None)
    text = out_json.read_text(encoding="utf-8")
    assert "\n" not in text.strip()
    assert json.loads(text) == payload


def test_unicode_is_not_escaped(tmp_path):
    """한글이 \\uXXXX 로 escape 되면 파일이 커지고 diff 를 읽을 수 없다."""
    out_json = tmp_path / "k.json"
    out_js = tmp_path / "k.js"
    sec.write_data(out_json, out_js, "K", {"count": 1, "rows": ["삼성전자"]})
    assert "삼성전자" in out_json.read_text(encoding="utf-8")
    assert "삼성전자" in out_js.read_text(encoding="utf-8")


# --------------------------------------------------------------------------
# 0건 방어
# --------------------------------------------------------------------------

def test_empty_payload_over_good_file_exits_nonzero(tmp_path):
    out_json = tmp_path / "g.json"
    out_js = tmp_path / "g.js"
    sec.write_data(out_json, out_js, "G", {"count": 3, "rows": [1, 2, 3]})
    before = out_json.read_text(encoding="utf-8")

    with pytest.raises(SystemExit) as excinfo:
        sec.write_data(out_json, out_js, "G", {"count": 0, "rows": []})
    assert "0건" in str(excinfo.value)
    # 좋은 파일이 그대로 살아 있어야 한다.
    assert out_json.read_text(encoding="utf-8") == before


def test_allow_empty_lets_a_deliberate_zero_through(tmp_path):
    out_json = tmp_path / "a.json"
    out_js = tmp_path / "a.js"
    sec.write_data(out_json, out_js, "A", {"count": 3, "rows": [1, 2, 3]})
    sec.write_data(out_json, out_js, "A", {"count": 0, "rows": []}, allow_empty=True)
    assert json.loads(out_json.read_text(encoding="utf-8"))["count"] == 0


def test_first_write_of_an_empty_dataset_is_allowed(tmp_path):
    """원래 없는 파일이면 0건도 정상(정상적으로 비는 데이터셋)."""
    out_json = tmp_path / "n.json"
    out_js = tmp_path / "n.js"
    sec.write_data(out_json, out_js, "N", {"count": 0, "rows": []})
    assert out_json.exists() and out_js.exists()


def test_empty_over_empty_is_allowed(tmp_path):
    out_json = tmp_path / "e.json"
    out_js = tmp_path / "e.js"
    sec.write_data(out_json, out_js, "E", {"count": 0, "rows": []})
    sec.write_data(out_json, out_js, "E", {"count": 0, "rows": []})
    assert json.loads(out_json.read_text(encoding="utf-8"))["count"] == 0


def test_corrupt_previous_file_does_not_block_publish(tmp_path):
    """직전 파일이 깨져 있으면 세지 못하니 막지 않는다(복구를 방해하면 안 된다)."""
    out_json = tmp_path / "b.json"
    out_js = tmp_path / "b.js"
    out_json.write_text("{ not json", encoding="utf-8")
    sec.write_data(out_json, out_js, "B", {"count": 0, "rows": []})
    assert json.loads(out_json.read_text(encoding="utf-8"))["count"] == 0


@pytest.mark.parametrize(
    "payload,expected",
    [
        ({"count": 7, "rows": []}, 7),                      # count 우선
        ({"rows": [1, 2, 3]}, 3),
        ({"stocks": {"A": 1, "B": 2}}, 2),
        ({"rows": [], "ipos": [1]}, 1),                     # 가장 큰 컬렉션
        ({"note": "설명만", "source": "x"}, None),           # 셀 수 없음
        ([], None),                                          # dict 가 아님
    ],
)
def test_payload_row_count(payload, expected):
    assert sec.payload_row_count(payload) == expected
