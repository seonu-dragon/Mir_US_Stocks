"""회사 로고 빌더(build_company_logos.py) 테스트 — 네트워크 없음(fetch_logo·Wikidata 는 가짜로 바꾼다).

실행: py -m pytest -q scripts/tests/test_company_logos_builder.py
"""
from __future__ import annotations

import io
import json
from datetime import date, timedelta

import pytest
from PIL import Image

import build_company_logos as bl


def _png(size=32, color=(200, 30, 30, 255), bg=(0, 0, 0, 0), glyph=True) -> bytes:
    im = Image.new("RGBA", (size, size), bg)
    if glyph:
        for x in range(size // 4, size * 3 // 4):
            for y in range(size // 4, size * 3 // 4):
                im.putpixel((x, y), color if (x + y) % 3 else (20, 20, 120, 255))
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return buf.getvalue()


# ───────────────────────────── 도메인

def test_host_of_and_pick_domain():
    assert bl.host_of("www.samsung.com/sec") == "www.samsung.com"
    assert bl.host_of("https://Investor.Apple.com/") == "investor.apple.com"
    assert bl.host_of("") is None
    assert bl.host_of("없음") is None
    # 가장 많이 나온 호스트, 같으면 짧은 것
    assert bl.pick_domain(["https://www.apple.com/", "https://www.apple.com/kr/", "https://apple.co"]) == "www.apple.com"
    assert bl.pick_domain(["https://b.example.com", "https://a.com"]) == "a.com"
    assert bl.pick_domain([]) is None


def test_us_domain_cik_first_then_ticker_excluding_other_cik():
    wd = {
        "cik": {320193: {"https://www.apple.com/"}},
        "ticker": {
            "AAPL": [({999}, {"https://wrong.example"})],
            "META": [({111}, {"https://old-meta.example"}), (set(), {"https://about.meta.com"})],
        },
    }
    assert bl.us_domain("AAPL", 320193, wd) == "www.apple.com"
    # CIK 가 다른 항목은 건너뛰고 CIK 없는 항목을 쓴다
    assert bl.us_domain("META", 1326801, wd) == "about.meta.com"
    assert bl.us_domain("ZZZ", None, wd) is None
    assert bl.us_domain("AAPL", 320193, None) is None


def test_universe_excludes_etf_and_sorts_by_cap(tmp_path):
    snap = tmp_path / "s.json"
    snap.write_text(json.dumps({"stocks": [
        {"ticker": "SPY", "sector": "ETF", "marketCapB": 999},
        {"ticker": "B", "sector": "Tech", "marketCapB": 5},
        {"ticker": "A", "sector": "Tech", "marketCapB": 10},
        {"ticker": "../x", "sector": "Tech", "marketCapB": 50},
    ]}), encoding="utf-8")
    assert bl.universe(snap, 10) == ["A", "B"]
    assert bl.universe(snap, 1) == []  # 상위 1개가 안전하지 않은 티커라 빠진다


# ───────────────────────────── 이미지 품질·변환

def test_quality_rejects_blank_white_and_solid():
    ok, _ = bl.decode(_png())
    assert bl.quality_ok(ok)
    blank, _ = bl.decode(_png(glyph=False))
    assert not bl.quality_ok(blank)
    im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    for x in range(8, 24):
        for y in range(8, 24):
            im.putpixel((x, y), (255, 255, 255, 255))
    assert not bl.quality_ok(im)  # 투명 배경 위 흰 글리프
    assert not bl.quality_ok(Image.new("RGBA", (32, 32), (40, 90, 200, 255)))  # 불투명 단색


def test_decode_rejects_html_and_tiny():
    assert bl.decode(b"<!doctype html><html>" + b" " * 200) is None
    assert bl.decode(b"x" * 10) is None
    got = bl.decode(_png(size=8))
    assert got is not None and got[1] == 8  # 크기 판정은 호출자(MIN_NATIVE)가 한다


def test_to_webp_is_64px_opaque_and_deterministic():
    im, _ = bl.decode(_png(size=48))
    a = bl.to_webp(im)
    b = bl.to_webp(im)
    assert a == b
    out = Image.open(io.BytesIO(a))
    assert out.format == "WEBP" and out.size == (bl.SIZE, bl.SIZE)
    assert out.convert("RGB").getpixel((0, 0)) == (255, 255, 255)  # 투명 아이콘은 흰 판 위
    assert len(a) < 4000


# ───────────────────────────── 증분 판정

def test_due():
    t0 = date(2026, 9, 27)
    assert bl.due(None, "a.com", t0)
    assert bl.due({"dom": "a.com", "ok": 1, "at": "2026-09-20"}, "b.com", t0)  # 도메인 변경
    assert not bl.due({"dom": "a.com", "ok": 1, "at": "2026-09-20"}, "a.com", t0)
    assert bl.due({"dom": "a.com", "ok": 1, "at": (t0 - timedelta(days=28)).isoformat()}, "a.com", t0)
    assert not bl.due({"dom": "a.com", "ok": 0, "at": (t0 - timedelta(days=13)).isoformat()}, "a.com", t0)
    assert bl.due({"dom": "a.com", "ok": 0, "at": (t0 - timedelta(days=14)).isoformat()}, "a.com", t0)
    assert bl.due({"dom": "a.com", "ok": 1, "at": "garbage"}, "a.com", t0)


# ───────────────────────────── run_market (네트워크 가짜)

@pytest.fixture
def fake_env(tmp_path, monkeypatch):
    snap = tmp_path / "kr_snap.json"
    stocks = [{"ticker": f"00{i:04d}", "sector": "제조", "marketCapB": 100 - i} for i in range(6)]
    snap.write_text(json.dumps({"stocks": stocks}), encoding="utf-8")
    monkeypatch.setattr(bl, "KR_SNAPSHOT", snap)
    profiles = {s["ticker"]: {"web": f"www.co{i}.co.kr"} for i, s in enumerate(stocks)}
    monkeypatch.setattr(bl, "load_profiles", lambda prefix: profiles)
    monkeypatch.setattr(bl, "learn_google_default", lambda: None)
    return tmp_path


def _result(seed: int):
    im, _ = bl.decode(_png(color=(seed * 40 % 255, 60, 90, 255)))
    data = bl.to_webp(im)
    import hashlib
    return data, "site", 32, hashlib.sha1(data).hexdigest()[:16]


def test_run_market_writes_changed_files_and_drops_generic(fake_env, monkeypatch):
    generic = _result(99)
    results = {
        "www.co0.co.kr": _result(1),
        "www.co1.co.kr": _result(2),
        "www.co2.co.kr": None,          # 파비콘 없음 → 모노그램
        # 같은 이미지가 도메인 4곳 → 호스팅 기본 아이콘으로 보고 버린다
        "www.co3.co.kr": generic, "www.co4.co.kr": generic, "www.co5.co.kr": generic,
    }
    monkeypatch.setattr(bl, "fetch_logo", lambda dom: results.get(dom))
    state: dict = {"kr": {"009999": {"dom": "www.other.co.kr", "ok": 1, "sha": generic[3], "at": "2026-09-01"}}}
    out = fake_env / "logos"
    r = bl.run_market("kr", 10, 100, set(), state, out)
    assert r["ok"] == 2 and r["fail"] == 4
    assert sorted(r["have"]) == ["000000", "000001"]
    assert (out / "kr" / "000000.webp").read_bytes() == results["www.co0.co.kr"][0]
    assert state["kr"]["000003"]["ok"] == 0
    assert state["kr"]["009999"]["ok"] == 0  # 예전 상태의 같은 해시도 기본 아이콘으로 정리

    # 두 번째 실행: 기한 전이라 다시 확인하지 않는다
    monkeypatch.setattr(bl, "fetch_logo", lambda dom: pytest.fail("기한 전에는 다시 받지 않는다"))
    r2 = bl.run_market("kr", 10, 100, set(), state, out)
    assert r2["tried"] == 0 and r2["inTop"] == 2


def test_run_market_keeps_old_file_on_transient_failure(fake_env, monkeypatch):
    out = fake_env / "logos"
    monkeypatch.setattr(bl, "fetch_logo", lambda dom: _result(1) if dom == "www.co0.co.kr" else None)
    state: dict = {}
    bl.run_market("kr", 1, 100, set(), state, out)
    path = out / "kr" / "000000.webp"
    assert path.exists()
    # 28일 뒤 재확인 때 소스가 일시적으로 실패해도 파일은 유지하고 곧 다시 본다
    state["kr"]["000000"]["at"] = (bl.today() - timedelta(days=30)).isoformat()
    monkeypatch.setattr(bl, "fetch_logo", lambda dom: None)
    r = bl.run_market("kr", 1, 100, set(), state, out)
    assert path.exists() and r["have"] == ["000000"]
    assert state["kr"]["000000"]["ok"] == 1


def test_main_refuses_to_shrink_index(fake_env, monkeypatch, capsys):
    out = fake_env / "logos"
    out.mkdir()
    (out / "index.json").write_text(json.dumps({"markets": {"kr": {"count": 100, "tickers": "x"}}}), encoding="utf-8")
    monkeypatch.setattr(bl, "fetch_logo", lambda dom: None)
    monkeypatch.setattr("sys.argv", ["x", "--market", "kr", "--out", str(out)])
    assert bl.main() == 1
    idx = json.loads((out / "index.json").read_text(encoding="utf-8"))
    assert idx["markets"]["kr"]["count"] == 100  # 급감하면 예전 목록 유지
    assert (out / "index.js").read_text(encoding="utf-8").startswith("window.COMPANY_LOGOS = ")
