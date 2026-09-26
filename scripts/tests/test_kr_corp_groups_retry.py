"""공정위 기업집단 수집의 재시도(2026-09-26 러너 TLS 핸드셰이크 타임아웃)."""

import ssl
import sys
import urllib.error
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import build_kr_corp_groups as cg  # noqa: E402


class _Resp:
    def __init__(self, body):
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def read(self):
        return self.body


def test_retries_handshake_timeout_then_succeeds(monkeypatch):
    calls = []

    def fake_urlopen(req, timeout=None, context=None):
        calls.append(timeout)
        if len(calls) < 3:
            raise urllib.error.URLError(ssl.SSLError("_ssl.c:993: The handshake operation timed out"))
        return _Resp(b"<ok/>")

    monkeypatch.setattr(cg.urllib.request, "urlopen", fake_urlopen)
    slept = []
    out = cg._fetch_with_retry(cg.urllib.request.Request("https://x"), waits=(1, 2, 3), sleep=slept.append)
    assert out == b"<ok/>" and len(calls) == 3 and slept == [1, 2]


def test_gives_up_after_waits_and_does_not_retry_4xx(monkeypatch):
    def always_timeout(req, timeout=None, context=None):
        raise TimeoutError("timed out")

    monkeypatch.setattr(cg.urllib.request, "urlopen", always_timeout)
    slept = []
    with pytest.raises(TimeoutError):
        cg._fetch_with_retry(cg.urllib.request.Request("https://x"), waits=(1, 1), sleep=slept.append)
    assert slept == [1, 1]

    n = []

    def forbidden(req, timeout=None, context=None):
        n.append(1)
        raise urllib.error.HTTPError("https://x", 403, "Forbidden", {}, None)

    monkeypatch.setattr(cg.urllib.request, "urlopen", forbidden)
    with pytest.raises(urllib.error.HTTPError):
        cg._fetch_with_retry(cg.urllib.request.Request("https://x"), waits=(1, 1), sleep=lambda s: None)
    assert n == [1]
