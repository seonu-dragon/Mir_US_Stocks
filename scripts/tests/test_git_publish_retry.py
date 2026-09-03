"""`sec_client.git_publish` 재시도 계약 — `scripts/test_git_publish.py` 의 빈틈 보강.

기존 테스트는 커밋·경합·충돌 정리·원격 부재를 다룬다. 여기서 채우는 것:
- `attempts` 만큼만 시도하고 더 하지 않는다(무한 재시도로 러너를 태우지 않는다).
- 매 실패마다 `rebase --abort` 로 중간 상태를 정리한다.
- 재시도 사이에 `sleep_s` 만큼만 기다린다(테스트는 0).
- 원격이 없으면 아무것도 하지 않고 성공으로 본다(로컬 개발 환경).
"""
from __future__ import annotations

import subprocess

import pytest

import sec_client as sec


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
    (work / "data" / "x.json").write_text('{"v": 0}\n', encoding="utf-8")
    _git(work, "add", ".")
    _git(work, "commit", "-qm", "init")
    _git(work, "push", "-q", "origin", "main")
    return work


def test_attempts_are_bounded(repo, monkeypatch):
    """push 가 계속 실패해도 attempts 횟수만큼만 시도한다."""
    pushes = []
    real_run = subprocess.run

    def fake_run(args, **kwargs):
        if args[:2] == ["git", "push"]:
            pushes.append(tuple(args))
            raise subprocess.CalledProcessError(1, args)
        return real_run(args, **kwargs)

    monkeypatch.setattr(subprocess, "run", fake_run)
    (repo / "data" / "x.json").write_text('{"v": 9}\n', encoding="utf-8")
    assert sec.git_publish(["data/x.json"], "x", cwd=repo, attempts=3, sleep_s=0) is False
    assert len(pushes) == 3, f"push 시도 {len(pushes)}회 — attempts 와 다르다"


def test_every_failed_attempt_aborts_the_rebase(repo, monkeypatch):
    aborts = []
    real_run = subprocess.run

    def fake_run(args, **kwargs):
        if args[:2] == ["git", "push"]:
            raise subprocess.CalledProcessError(1, args)
        if args[:3] == ["git", "rebase", "--abort"]:
            aborts.append(1)
        return real_run(args, **kwargs)

    monkeypatch.setattr(subprocess, "run", fake_run)
    (repo / "data" / "x.json").write_text('{"v": 9}\n', encoding="utf-8")
    sec.git_publish(["data/x.json"], "x", cwd=repo, attempts=2, sleep_s=0)
    assert len(aborts) == 2, "실패한 시도마다 rebase --abort 로 정리해야 한다"


def test_sleep_is_only_between_attempts(repo, monkeypatch):
    slept = []
    real_run = subprocess.run

    def fake_run(args, **kwargs):
        if args[:2] == ["git", "push"]:
            raise subprocess.CalledProcessError(1, args)
        return real_run(args, **kwargs)

    monkeypatch.setattr(subprocess, "run", fake_run)
    monkeypatch.setattr(sec.time, "sleep", lambda s: slept.append(s))
    (repo / "data" / "x.json").write_text('{"v": 9}\n', encoding="utf-8")
    sec.git_publish(["data/x.json"], "x", cwd=repo, attempts=3, sleep_s=7)
    # 마지막 시도 뒤에는 자지 않는다.
    assert slept == [7, 7]


def test_no_remote_is_a_success_without_touching_git(tmp_path):
    work = tmp_path / "solo"
    work.mkdir()
    _git(tmp_path, "init", "-q", "-b", "main", str(work))
    _git(work, "config", "user.email", "t@example.com")
    _git(work, "config", "user.name", "t")
    _git(work, "config", "commit.gpgsign", "false")
    (work / "data").mkdir()
    (work / "data" / "x.json").write_text("{}\n", encoding="utf-8")
    _git(work, "add", ".")
    _git(work, "commit", "-qm", "init")
    (work / "data" / "x.json").write_text('{"v":1}\n', encoding="utf-8")
    assert sec.git_publish(["data/x.json"], "x", cwd=work, sleep_s=0) is True
    # 커밋되지 않고 그대로 남아 있어야 한다(원격이 없으면 아무 일도 안 한다).
    assert "data/x.json" in _git(work, "status", "--porcelain")


def test_detached_head_is_refused(repo):
    head = _git(repo, "rev-parse", "HEAD").strip()
    _git(repo, "checkout", "-q", "--detach", head)
    with pytest.raises(RuntimeError, match="detached HEAD"):
        sec.git_publish(["data/x.json"], "x", cwd=repo, sleep_s=0)


def test_only_listed_paths_are_committed(repo):
    """게시 대상 밖의 변경을 같이 커밋하면 안 된다."""
    (repo / "data" / "x.json").write_text('{"v": 5}\n', encoding="utf-8")
    (repo / "unrelated.txt").write_text("사용자 작업물\n", encoding="utf-8")
    assert sec.git_publish(["data/x.json"], "x", cwd=repo, sleep_s=0) is True
    assert "unrelated.txt" in _git(repo, "status", "--porcelain")
    files = _git(repo, "show", "--name-only", "--format=", "HEAD").split()
    assert files == ["data/x.json"]
