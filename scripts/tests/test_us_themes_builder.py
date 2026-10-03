"""build_us_themes.py — 레포 안 ETF 보유 데이터만으로 테마를 만들고, 화면이 기대하는 모양인지 본다."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import build_us_themes as B  # noqa: E402


def test_build_shape_and_evidence():
    p = B.build()
    assert p["market"] == "us" and p["themeCount"] >= 20
    ids = [t["id"] for t in p["themes"]]
    assert len(ids) == len(set(ids))
    for th in p["themes"]:
        assert th["name"] and th["group"] and th["about"]
        assert th["etfs"] and all(e in p["etfs"] for e in th["etfs"])
        assert 0 < len(th["members"]) <= B.MAX_MEMBERS
        for m in th["members"]:
            assert m["by"] == "etf" and m["e"]
            assert all(e in th["etfs"] and w > 0 for e, w in m["e"])
            assert [w for _, w in m["e"]] == sorted((w for _, w in m["e"]), reverse=True)
    assert p["count"] == sum(len(t["members"]) for t in p["themes"])


def test_theme_ids_unique_in_dictionary():
    ids = [t[0] for t in B.THEMES]
    assert len(ids) == len(set(ids))
