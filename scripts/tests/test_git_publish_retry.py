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
    sec.git_publish(["data/x.json"], "x", cwd=repo, attempts=3, sleep_s=7, backoff=1)
    # 마지막 시도 뒤에는 자지 않는다.
    assert slept == [7, 7]


def test_sleep_backs_off_exponentially_by_default(repo, monkeypatch):
    """GitHub push 500 같은 서버 쪽 일시 장애를 넘기도록 간격이 늘어난다."""
    slept = []
    real_run = subprocess.run

    def fake_run(args, **kwargs):
        if args[:2] == ["git", "push"]:
            raise subprocess.CalledProcessError(1, args)
        return real_run(args, **kwargs)

    monkeypatch.setattr(subprocess, "run", fake_run)
    monkeypatch.setattr(sec.time, "sleep", lambda s: slept.append(s))
    (repo / "data" / "x.json").write_text('{"v": 10}\n', encoding="utf-8")
    assert sec.git_publish(["data/x.json"], "x", cwd=repo) is False
    assert slept == [10.0, 20.0, 40.0, 80.0]


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


def _other_clone_pushes(repo, tmp_path, rel, text):
    """다른 워크플로우가 먼저 push 한 상황."""
    remote = _git(repo, "remote", "get-url", "origin").strip()
    other = tmp_path / "other"
    _git(tmp_path, "clone", "-q", remote, str(other))
    _git(other, "config", "user.email", "o@example.com")
    _git(other, "config", "user.name", "o")
    _git(other, "config", "commit.gpgsign", "false")
    (other / rel).parent.mkdir(parents=True, exist_ok=True)
    (other / rel).write_text(text, encoding="utf-8")
    _git(other, "add", ".")
    _git(other, "commit", "-qm", "other")
    _git(other, "push", "-q", "origin", "main")


def test_unstaged_unrelated_tracked_change_does_not_block_rebase(repo, tmp_path, monkeypatch):
    """같은 잡의 --push 없는 빌더가 쓴 추적 파일(커밋 안 됨)이 pull --rebase 를 막던 문제(2026-09-29)."""
    monkeypatch.setenv("GITHUB_ACTIONS", "true")
    (repo / "data" / "y.json").write_text('{"y": 0}\n', encoding="utf-8")
    _git(repo, "add", ".")
    _git(repo, "commit", "-qm", "y")
    _git(repo, "push", "-q", "origin", "main")
    _other_clone_pushes(repo, tmp_path, "data/z.json", '{"z": 1}\n')
    (repo / "data" / "y.json").write_text('{"y": 7}\n', encoding="utf-8")   # 발행 대상 밖, 커밋 안 됨
    (repo / "data" / "x.json").write_text('{"v": 3}\n', encoding="utf-8")
    assert sec.git_publish(["data/x.json"], "x", cwd=repo, attempts=1, sleep_s=0) is True
    # 커밋에는 x.json 만, y.json 변경은 커밋 안 된 채 그대로.
    assert _git(repo, "show", "--name-only", "--format=", "HEAD").split() == ["data/x.json"]
    assert (repo / "data" / "y.json").read_text(encoding="utf-8") == '{"y": 7}\n'
    assert " M data/y.json" in _git(repo, "status", "--porcelain")
    assert _git(repo, "stash", "list").strip() == ""
    assert (repo / "data" / "z.json").exists()                               # 원격 변경도 받았다


def test_unrelated_change_conflicting_with_remote_keeps_local_without_markers(repo, tmp_path, monkeypatch):
    """원격도 같은 파일을 바꿨으면 이 잡이 만든 쪽을 남기고, 충돌 표식·스테이징·스태시를 남기지 않는다."""
    monkeypatch.setenv("GITHUB_ACTIONS", "true")
    (repo / "data" / "y.json").write_text('{"y": 0}\n', encoding="utf-8")
    _git(repo, "add", ".")
    _git(repo, "commit", "-qm", "y")
    _git(repo, "push", "-q", "origin", "main")
    _other_clone_pushes(repo, tmp_path, "data/y.json", '{"y": "remote"}\n')
    (repo / "data" / "y.json").write_text('{"y": "local"}\n', encoding="utf-8")
    (repo / "data" / "x.json").write_text('{"v": 4}\n', encoding="utf-8")
    assert sec.git_publish(["data/x.json"], "x", cwd=repo, attempts=1, sleep_s=0) is True
    text = (repo / "data" / "y.json").read_text(encoding="utf-8")
    assert text == '{"y": "local"}\n' and "<<<<<<<" not in text
    assert _git(repo, "diff", "--cached", "--name-only").strip() == ""
    assert _git(repo, "stash", "list").strip() == ""
    assert _git(repo, "show", "--name-only", "--format=", "HEAD").split() == ["data/x.json"]


def test_local_run_never_stashes_user_changes(repo, tmp_path, monkeypatch):
    """Actions 밖(로컬)에서는 스태시하지 않는다 — 사용자 미커밋 변경·공유 스태시 스택을 건드리지 않는다(기존 동작)."""
    monkeypatch.delenv("GITHUB_ACTIONS", raising=False)
    (repo / "data" / "y.json").write_text('{"y": 0}
', encoding="utf-8")
    _git(repo, "add", ".")
    _git(repo, "commit", "-qm", "y")
    _git(repo, "push", "-q", "origin", "main")
    _other_clone_pushes(repo, tmp_path, "data/z.json", '{"z": 1}
')
    (repo / "data" / "y.json").write_text('{"y": "user"}
', encoding="utf-8")
    (repo / "data" / "x.json").write_text('{"v": 6}
', encoding="utf-8")
    assert sec.git_publish(["data/x.json"], "x", cwd=repo, attempts=1, sleep_s=0) is False
    assert (repo / "data" / "y.json").read_text(encoding="utf-8") == '{"y": "user"}
'
    assert _git(repo, "stash", "list").strip() == ""


def test_stash_helper_is_noop_outside_actions(monkeypatch):
    monkeypatch.delenv("GITHUB_ACTIONS", raising=False)
    calls = []
    restore = sec.stash_unrelated_changes(lambda args, **kw: calls.append(args))
    restore()
    assert calls == []
