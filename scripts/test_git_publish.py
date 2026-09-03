"""sec_client.git_publish — 모든 데이터 빌더가 공유하는 유일한 커밋·푸시 경로.

임시 bare 원격 + 클론 두 개로 실제 git 을 돌린다. 검증하는 것:
- 변경을 커밋해 원격에 밀어 넣는다.
- 다른 클론이 먼저 같은 파일을 밀어 넣었으면(경합) -X theirs 로 우리 버전이 이긴다.
- rebase 가 실패하면(-X theirs 로도 못 푸는 modify/delete 충돌) 중간 상태를 남기지
  않고 False 를 돌려준다 — 예전 복사본들은 여기서 "unmerged files" 로 다음 재시도까지
  전부 죽었다.

실행: py -m pytest -q scripts/test_git_publish.py
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).resolve().parent
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from sec_client import git_publish  # noqa: E402


def git(cwd, *args) -> str:
    return subprocess.run(
        ["git", *args], cwd=cwd, check=True, capture_output=True, text=True, encoding="utf-8",
    ).stdout


def _clone(remote: Path, dest: Path) -> Path:
    git(dest.parent, "clone", "-q", str(remote), str(dest))
    git(dest, "config", "user.email", "test@example.com")
    git(dest, "config", "user.name", "test")
    git(dest, "config", "commit.gpgsign", "false")
    return dest


@pytest.fixture
def repos(tmp_path):
    """(원격, 클론 a, 클론 b). main 에 data/x.json 커밋 하나가 들어 있다."""
    remote = tmp_path / "remote.git"
    git(tmp_path, "init", "-q", "--bare", str(remote))
    git(remote, "symbolic-ref", "HEAD", "refs/heads/main")
    a = _clone(remote, tmp_path / "a")
    git(a, "symbolic-ref", "HEAD", "refs/heads/main")
    (a / "data").mkdir()
    (a / "data" / "x.json").write_text('{"v": 0}\n', encoding="utf-8")
    git(a, "add", ".")
    git(a, "commit", "-qm", "init")
    git(a, "push", "-q", "origin", "main")
    b = _clone(remote, tmp_path / "b")
    return remote, a, b


def _remote_file(remote: Path, rel: str) -> str:
    return git(remote, "show", f"main:{rel}")


def _no_rebase_in_progress(repo: Path) -> bool:
    return not (repo / ".git" / "rebase-merge").exists() and not (repo / ".git" / "rebase-apply").exists()


def test_publish_commits_and_pushes(repos):
    remote, a, _ = repos
    (a / "data" / "x.json").write_text('{"v": 1}\n', encoding="utf-8")
    assert git_publish(["data/x.json"], "x", cwd=a, sleep_s=0) is True
    assert _remote_file(remote, "data/x.json") == '{"v": 1}\n'
    assert git(remote, "log", "-1", "--format=%s", "main").startswith("Auto-update x:")
    assert git(a, "status", "--porcelain") == ""


def test_nothing_to_commit_is_still_success(repos):
    remote, a, _ = repos
    before = git(remote, "rev-parse", "main")
    assert git_publish(["data/x.json"], "x", cwd=a, sleep_s=0) is True
    assert git(remote, "rev-parse", "main") == before


def test_concurrent_push_conflict_resolved_with_ours(repos):
    """다른 워크플로우가 먼저 밀어 넣은 같은 파일과 충돌 → 방금 만든 우리 버전 채택."""
    remote, a, b = repos
    (b / "data" / "x.json").write_text('{"v": "from-b"}\n', encoding="utf-8")
    git(b, "commit", "-qam", "b wins first")
    git(b, "push", "-q", "origin", "main")

    (a / "data" / "x.json").write_text('{"v": "from-a"}\n', encoding="utf-8")
    assert git_publish(["data/x.json"], "x", cwd=a, sleep_s=0) is True
    assert _remote_file(remote, "data/x.json") == '{"v": "from-a"}\n'
    # b 의 커밋도 이력에 남아 있어야 한다(덮어쓰기가 아니라 rebase).
    log = git(remote, "log", "--format=%s", "main")
    assert "b wins first" in log
    assert _no_rebase_in_progress(a)
    assert git(a, "status", "--porcelain") == ""


def test_unresolvable_conflict_aborts_cleanly(repos):
    """modify/delete 충돌은 -X theirs 로도 안 풀린다 → False, 그러나 rebase 잔여 상태 없음."""
    remote, a, b = repos
    git(b, "rm", "-q", "data/x.json")
    git(b, "commit", "-qm", "b deletes x")
    git(b, "push", "-q", "origin", "main")

    (a / "data" / "x.json").write_text('{"v": "a-edit"}\n', encoding="utf-8")
    assert git_publish(["data/x.json"], "x", cwd=a, attempts=2, sleep_s=0) is False
    assert _no_rebase_in_progress(a), "실패한 rebase 가 중간 상태로 남았다"
    assert git(a, "status", "--porcelain") == ""
    # 원격은 b 의 상태 그대로(우리 것이 억지로 들어가지 않았다).
    assert "b deletes x" in git(remote, "log", "-1", "--format=%s", "main")


def test_unreachable_remote_returns_false(repos):
    _, a, _ = repos
    git(a, "remote", "set-url", "origin", str(a.parent / "does-not-exist.git"))
    (a / "data" / "x.json").write_text('{"v": 2}\n', encoding="utf-8")
    assert git_publish(["data/x.json"], "x", cwd=a, attempts=2, sleep_s=0) is False
    assert _no_rebase_in_progress(a)
    # 로컬 커밋은 만들어졌고(다음 실행이 이어서 밀어 넣는다) 작업트리는 깨끗하다.
    assert git(a, "log", "-1", "--format=%s").startswith("Auto-update x:")
    assert git(a, "status", "--porcelain") == ""
