"""`briefing_store` — 원자적 쓰기 · 발행 락 · reset 안전 점검.

CLAUDE.md '데이터 파이프라인' 의 세 가지 약속을 고정한다:
- `atomic_write_text` 는 예외가 나도 부분 파일을 남기지 않는다.
- `repository_publish_lock` 은 환경변수 소유권으로 **자식 프로세스에서 재진입**된다
  (예전엔 락 안에서 띄운 subprocess 빌더가 자기 부모를 기다리다 30분 타임아웃으로 죽었다).
- `_assert_safe_to_reset` 은 게시 대상 밖 변경(특히 삭제)이 있으면 reset --hard 를 거부한다.
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

import briefing_store as bs


# --------------------------------------------------------------------------
# atomic_write_text
# --------------------------------------------------------------------------

def test_atomic_write_creates_parent_and_uses_lf(tmp_path):
    target = tmp_path / "deep" / "nested" / "out.json"
    bs.atomic_write_text(target, "a\nb\n")
    assert target.read_bytes() == b"a\nb\n"   # CRLF 로 부풀지 않는다


def test_atomic_write_leaves_no_partial_file_on_exception(tmp_path, monkeypatch):
    target = tmp_path / "out.json"
    bs.atomic_write_text(target, '{"v": "good"}')

    real_replace = os.replace

    def boom(src, dst):
        raise OSError("디스크 가득 참(모의)")

    monkeypatch.setattr(bs.os, "replace", boom)
    with pytest.raises(OSError):
        bs.atomic_write_text(target, '{"v": "half-written"}')
    monkeypatch.setattr(bs.os, "replace", real_replace)

    # 원본이 그대로 살아 있고, 임시 파일이 남지 않았다.
    assert target.read_text(encoding="utf-8") == '{"v": "good"}'
    leftovers = [p.name for p in tmp_path.iterdir() if p.name != "out.json"]
    assert leftovers == [], f"임시 파일이 남았다: {leftovers}"


def test_atomic_write_overwrites_in_place(tmp_path):
    target = tmp_path / "out.json"
    bs.atomic_write_text(target, "1")
    bs.atomic_write_text(target, "22")
    assert target.read_text(encoding="utf-8") == "22"
    assert [p.name for p in tmp_path.iterdir()] == ["out.json"]


# --------------------------------------------------------------------------
# repository_publish_lock — 자식 프로세스 재진입
# --------------------------------------------------------------------------

def test_lock_publishes_ownership_through_env(tmp_path):
    assert bs._LOCK_OWNER_ENV not in os.environ
    with bs.repository_publish_lock(tmp_path, timeout=5):
        assert os.environ.get(bs._LOCK_OWNER_ENV)
    assert bs._LOCK_OWNER_ENV not in os.environ


def test_lock_is_reentrant_for_the_same_owner(tmp_path):
    """중첩 진입이 자기 자신을 기다리다 죽지 않는다."""
    with bs.repository_publish_lock(tmp_path, timeout=5):
        owner = os.environ[bs._LOCK_OWNER_ENV]
        with bs.repository_publish_lock(tmp_path, timeout=5):
            assert os.environ[bs._LOCK_OWNER_ENV] == owner
        # 안쪽 블록이 빠져나가도 바깥 소유권을 지우면 안 된다.
        assert os.environ.get(bs._LOCK_OWNER_ENV) == owner


def test_child_process_reenters_the_lock(tmp_path):
    """락 안에서 띄운 subprocess 빌더가 부모를 기다리지 않고 즉시 진입한다."""
    scripts = str(Path(bs.__file__).resolve().parent)
    child = (
        "import sys, time; sys.path.insert(0, %r);"
        "import briefing_store as bs;"
        "t=time.monotonic();"
        "ctx=bs.repository_publish_lock(%r, timeout=3);"
        "ctx.__enter__(); ctx.__exit__(None, None, None);"
        "print('ELAPSED', round(time.monotonic()-t, 2))" % (scripts, str(tmp_path))
    )
    with bs.repository_publish_lock(tmp_path, timeout=5):
        result = subprocess.run(
            [sys.executable, "-c", child],
            capture_output=True, text=True, timeout=60, env=dict(os.environ),
        )
    assert result.returncode == 0, result.stderr
    elapsed = float(result.stdout.strip().split()[-1])
    assert elapsed < 2.0, f"자식이 부모 락을 기다렸다({elapsed}s) — 환경변수 상속이 깨졌다"


def test_a_foreign_owner_value_does_not_reenter(tmp_path, monkeypatch):
    """다른 레포의 소유권 값으로는 재진입하면 안 된다(경로별 digest)."""
    monkeypatch.setenv(bs._LOCK_OWNER_ENV, "다른레포의값")
    with bs.repository_publish_lock(tmp_path, timeout=5):
        assert os.environ[bs._LOCK_OWNER_ENV] != "다른레포의값"


# --------------------------------------------------------------------------
# _assert_safe_to_reset
# --------------------------------------------------------------------------

def _git(cwd, *args):
    return subprocess.run(
        ["git", *args], cwd=cwd, check=True, capture_output=True, text=True, encoding="utf-8",
    ).stdout


@pytest.fixture
def repo(tmp_path):
    remote = tmp_path / "remote.git"
    work = tmp_path / "work"
    work.mkdir()
    _git(tmp_path, "init", "-q", "--bare", str(remote))
    _git(remote, "symbolic-ref", "HEAD", "refs/heads/main")
    _git(tmp_path, "init", "-q", "-b", "main", str(work))
    _git(work, "config", "user.email", "t@example.com")
    _git(work, "config", "user.name", "t")
    _git(work, "config", "commit.gpgsign", "false")
    _git(work, "remote", "add", "origin", str(remote))
    (work / "data").mkdir()
    (work / "data" / "market_snapshot.json").write_text("{}\n", encoding="utf-8")
    (work / "notes.md").write_text("사용자 작업물\n", encoding="utf-8")
    _git(work, "add", ".")
    _git(work, "commit", "-qm", "init")
    _git(work, "push", "-q", "origin", "main")
    return work


ALLOWED = ["data/market_snapshot.json"]


def test_reset_allowed_when_only_publish_targets_changed(repo):
    (repo / "data" / "market_snapshot.json").write_text('{"v":1}\n', encoding="utf-8")
    bs._assert_safe_to_reset(repo, "main", ALLOWED)   # 예외 없음


def test_reset_refused_on_unrelated_deletion(repo):
    """사용자가 지운 다른 파일이 reset --hard 로 조용히 되살아나면 안 된다."""
    (repo / "notes.md").unlink()
    with pytest.raises(RuntimeError) as excinfo:
        bs._assert_safe_to_reset(repo, "main", ALLOWED)
    assert "notes.md" in str(excinfo.value)


def test_reset_refused_on_unrelated_modification(repo):
    (repo / "notes.md").write_text("수정됨\n", encoding="utf-8")
    with pytest.raises(RuntimeError):
        bs._assert_safe_to_reset(repo, "main", ALLOWED)


def test_untracked_files_do_not_block_reset(repo):
    """추적되지 않는 파일은 reset --hard 의 영향을 받지 않으므로 막을 이유가 없다."""
    (repo / "scratch.txt").write_text("임시\n", encoding="utf-8")
    bs._assert_safe_to_reset(repo, "main", ALLOWED)


def test_parse_porcelain_handles_renames_and_untracked():
    out = " M data/a.json\n?? scratch.txt\nR  old.txt -> new.txt\n D notes.md\n"
    tracked = bs._parse_porcelain_paths(out)
    assert tracked == ["data/a.json", "new.txt", "notes.md"]
    assert "scratch.txt" in bs._parse_porcelain_paths(out, include_untracked=True)
