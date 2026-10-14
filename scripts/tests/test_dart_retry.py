"""DART 공통 호출(build_kr_disclosures.dart_get · load_corp_map)의 일시 장애 재시도.

2026-10-10(토·일) DART 가 몇 시간 동안 타임아웃·빈 본문·ZIP 아닌 corpCode.xml 을 돌려줘
테마·IR·주간 kr-dart 빌더가 한 번의 실패로 통째로 멈췄다. 오프라인.
"""

import io
import json
import sys
import urllib.error
import zipfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import build_kr_disclosures as bkd  # noqa: E402


class _Resp:
    def __init__(self, body: bytes):
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def read(self):
        return self.body


@pytest.fixture(autouse=True)
def _no_pace(monkeypatch):
    monkeypatch.setattr(bkd, "dart_pace", lambda: None)


def test_dart_get_retries_timeout_and_non_json(monkeypatch):
    seq = [TimeoutError("timed out"), b"", json.dumps({"status": "000", "list": []}).encode()]

    def fake(req, timeout=None):
        x = seq.pop(0)
        if isinstance(x, Exception):
            raise x
        return _Resp(x)

    monkeypatch.setattr(bkd.urllib.request, "urlopen", fake)
    slept = []
    out = bkd.dart_get("list.json", {}, "k", waits=(1, 2, 3), sleep=slept.append)
    assert out["status"] == "000" and slept == [1, 2]


def test_dart_get_does_not_retry_4xx_and_gives_up(monkeypatch):
    n = []

    def forbidden(req, timeout=None):
        n.append(1)
        raise urllib.error.HTTPError("https://x", 403, "Forbidden", {}, None)

    monkeypatch.setattr(bkd.urllib.request, "urlopen", forbidden)
    with pytest.raises(urllib.error.HTTPError):
        bkd.dart_get("list.json", {}, "k", waits=(1, 1), sleep=lambda s: None)
    assert n == [1]

    monkeypatch.setattr(bkd.urllib.request, "urlopen", lambda req, timeout=None: (_ for _ in ()).throw(TimeoutError()))
    slept = []
    with pytest.raises(TimeoutError):
        bkd.dart_get("list.json", {}, "k", waits=(1, 1), sleep=slept.append)
    assert slept == [1, 1]


def _corp_zip() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("CORPCODE.xml", "<result><list><corp_code>00126380</corp_code>"
                                    "<stock_code>005930</stock_code></list></result>")
    return buf.getvalue()


def test_load_corp_map_retries_non_zip_body(monkeypatch, tmp_path):
    monkeypatch.setattr(bkd, "CORP_CODE_CACHE", tmp_path / "corp.json")
    monkeypatch.setattr(bkd.time, "sleep", lambda s: None)
    seq = [b'{"status":"800","message":"system check"}', _corp_zip()]
    monkeypatch.setattr(bkd.urllib.request, "urlopen", lambda req, timeout=None: _Resp(seq.pop(0)))
    assert bkd.load_corp_map("k", use_cache=False) == {"005930": "00126380"}


def test_load_corp_map_aborts_on_rate_limit(monkeypatch, tmp_path):
    monkeypatch.setattr(bkd, "CORP_CODE_CACHE", tmp_path / "corp.json")
    monkeypatch.setattr(bkd.time, "sleep", lambda s: pytest.fail("한도 초과는 재시도하지 않는다"))
    monkeypatch.setattr(bkd.urllib.request, "urlopen",
                        lambda req, timeout=None: _Resp(b'{"status":"020","message":"limit"}'))
    with pytest.raises(SystemExit):
        bkd.load_corp_map("k", use_cache=False)
