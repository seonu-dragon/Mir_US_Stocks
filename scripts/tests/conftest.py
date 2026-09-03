"""빌더 테스트 공통 설정.

- `scripts/` 를 import 경로에 넣는다(빌더들은 서로를 평면 모듈로 import 한다).
- 55개 `build_*.py` 모듈 목록을 한 번만 만들어 계약 테스트가 공유한다.
- 네트워크 금지: 모든 테스트는 오프라인·결정적이어야 한다. 실수로 소켓을 열면
  바로 실패하도록 `no_network` 자동 픽스처가 socket 을 막는다.

실행: py -m pytest -q scripts
"""
from __future__ import annotations

import importlib
import json
import socket
import sys
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).resolve().parents[1]
ROOT = SCRIPTS.parent
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

# 브라우저용 .js 전역을 쓰지 않는 빌더(순수 상태 파일·이미지·사이트맵 등)는
# window.<GLOBAL> 계약에서 제외한다.
BUILDER_PATHS = sorted(SCRIPTS.glob("build_*.py"))
BUILDER_NAMES = [p.stem for p in BUILDER_PATHS]


@pytest.fixture(scope="session")
def scripts_dir() -> Path:
    return SCRIPTS


@pytest.fixture(scope="session")
def repo_root() -> Path:
    return ROOT


def builder_source(name: str) -> str:
    return (SCRIPTS / f"{name}.py").read_text(encoding="utf-8")


def import_builder(name: str):
    return importlib.import_module(name)


@pytest.fixture
def no_network(monkeypatch):
    """소켓을 막는다. 네트워크를 타는 코드 경로가 테스트에 새어 들어오면 즉시 실패."""
    def _blocked(*args, **kwargs):  # pragma: no cover - 실패 경로
        raise AssertionError("테스트에서 네트워크를 열려고 했다 — 스텁이 빠졌다")

    monkeypatch.setattr(socket.socket, "connect", _blocked)
    monkeypatch.setattr(socket, "create_connection", _blocked)
    return True


@pytest.fixture
def payload_file(tmp_path):
    """(json_path, js_path) 쌍과 초기 내용을 심는 헬퍼."""
    def _make(name: str, payload=None):
        js_path = tmp_path / f"{name}.js"
        json_path = tmp_path / f"{name}.json"
        if payload is not None:
            json_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        return json_path, js_path

    return _make
