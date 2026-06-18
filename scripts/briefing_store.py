#!/usr/bin/env python3
"""Serialized, atomic publication of briefing data into the site snapshot."""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
import tempfile
import time
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

try:
    import msvcrt
except ImportError:  # pragma: no cover - Windows is the production host.
    msvcrt = None
    import fcntl


KST = ZoneInfo("Asia/Seoul")


def _run_git(project_dir: Path, args, **kwargs):
    return subprocess.run(["git", *args], cwd=project_dir, **kwargs)


@contextmanager
def repository_publish_lock(project_dir, timeout=1800):
    """Serialize every snapshot writer and its git commit/push on this machine."""
    project_dir = Path(project_dir).resolve()
    digest = hashlib.sha256(str(project_dir).lower().encode("utf-8")).hexdigest()[:16]
    lock_path = Path(tempfile.gettempdir()) / f"mir-us-stocks-publish-{digest}.lock"
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    handle = open(lock_path, "a+b")
    if lock_path.stat().st_size == 0:
        handle.write(b"0")
        handle.flush()
    deadline = time.monotonic() + timeout
    announced = False
    while True:
        try:
            handle.seek(0)
            if msvcrt:
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:  # pragma: no cover
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            break
        except (OSError, BlockingIOError):
            if time.monotonic() >= deadline:
                handle.close()
                raise TimeoutError(f"snapshot publish lock timed out: {lock_path}")
            if not announced:
                print("  [동기화] 다른 데이터 게시 작업이 끝나기를 기다립니다...")
                announced = True
            time.sleep(1)
    try:
        yield
    finally:
        handle.seek(0)
        if msvcrt:
            msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
        else:  # pragma: no cover
            fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
        handle.close()


def atomic_write_text(path, text):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=f"{path.stem}_", suffix=path.suffix, dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def _load_json(path):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def _verify_remote_briefing(project_dir, branch, key, expected_html):
    result = _run_git(
        project_dir,
        ["show", f"origin/{branch}:data/market_snapshot.json"],
        capture_output=True,
        check=True,
    )
    remote = json.loads(result.stdout.decode("utf-8"))
    actual = remote.get("ai_briefing", {}).get(key)
    if actual != expected_html:
        raise RuntimeError(f"origin/{branch} verification failed for ai_briefing.{key}")


def _parse_porcelain_paths(stdout):
    paths = []
    for line in stdout.splitlines():
        p = line[3:].strip().strip('"') if len(line) > 3 else ""
        if " -> " in p:  # rename
            p = p.split(" -> ", 1)[1]
        if p:
            paths.append(p)
    return paths


def _assert_safe_to_reset(project_dir, branch, allowed_paths):
    """reset --hard 로 사용자의 다른 작업이 사라지지 않도록 안전 점검.

    - 게시 대상 외에 커밋되지 않은 변경이 있으면 중단.
    - origin/branch 에 없는 로컬 커밋이 게시 대상 외 파일을 건드리면 중단.
    """
    allowed = set(allowed_paths)
    status = _run_git(project_dir, ["status", "--porcelain"], capture_output=True, text=True, check=True)
    unrelated = [p for p in _parse_porcelain_paths(status.stdout) if p not in allowed]
    if unrelated:
        raise RuntimeError(
            "작업 트리에 커밋되지 않은 다른 변경이 있어 안전을 위해 게시를 중단합니다: "
            + ", ".join(unrelated[:8])
        )
    ahead = _run_git(
        project_dir,
        ["diff", "--name-only", f"origin/{branch}..HEAD"],
        capture_output=True, text=True, check=True,
    )
    ahead_unrelated = [p.strip() for p in ahead.stdout.splitlines() if p.strip() and p.strip() not in allowed]
    if ahead_unrelated:
        raise RuntimeError(
            "푸시되지 않은 로컬 커밋이 게시 대상 외 파일을 포함해 안전을 위해 게시를 중단합니다: "
            + ", ".join(ahead_unrelated[:8])
        )


def _write_publish_files(json_path, js_path, fragment_path, key, formatted_html, generated_at, mutate):
    """최신 snapshot 위에 이번 브리핑을 병합해 세 파일을 원자적으로 기록한다."""
    data = _load_json(json_path)
    data.setdefault("ai_briefing", {})[key] = formatted_html
    if mutate:
        mutate(data)
    data.setdefault("briefing_meta", {})[key] = generated_at
    json_body = json.dumps(data, ensure_ascii=False, indent=2)
    fragment = {"key": key, "generatedAtKst": generated_at, "html": formatted_html}
    atomic_write_text(fragment_path, json.dumps(fragment, ensure_ascii=False, indent=2) + "\n")
    atomic_write_text(json_path, json_body + "\n")
    atomic_write_text(js_path, f"window.MARKET_SNAPSHOT = {json_body};\n")


def apply_briefing_fragments(data, project_dir):
    """Reapply the newest per-briefing backups to an in-memory snapshot."""
    project_dir = Path(project_dir).resolve()
    fragment_dir = project_dir / "data" / "briefings"
    applied = []
    if not fragment_dir.exists():
        return applied
    briefing = data.setdefault("ai_briefing", {})
    metadata = data.setdefault("briefing_meta", {})
    for path in sorted(fragment_dir.glob("*.json")):
        try:
            fragment = _load_json(path)
            key = str(fragment.get("key") or path.stem)
            html = fragment.get("html")
            generated_at = str(fragment.get("generatedAtKst") or "")
            current_at = str(metadata.get(key) or "")
            if isinstance(html, str) and (not current_at or generated_at >= current_at):
                briefing[key] = html
                metadata[key] = generated_at
                applied.append(key)
        except Exception as error:
            print(f"  [경고] 브리핑 백업을 읽지 못했습니다: {path.name}: {error}")
    return applied

def publish_briefing(project_dir, key, html, commit_label, mutate=None, attempts=6):
    """Merge one briefing into the newest snapshot and publish it robustly.

    매 시도마다 origin 의 최신 상태로 리셋한 뒤 그 위에 브리핑을 다시 병합·커밋·푸시한다.
    이렇게 하면 거대한 market_snapshot.json 에서 rebase 충돌이 날 일이 없고,
    그 사이 다른 작업이 푸시했더라도 다음 시도에서 최신을 다시 받아 재병합한다.
    """
    project_dir = Path(project_dir).resolve()
    json_path = project_dir / "data" / "market_snapshot.json"
    js_path = project_dir / "data" / "market_snapshot.js"
    fragment_path = project_dir / "data" / "briefings" / f"{key}.json"
    formatted_html = str(html).replace("\n", "<br>")
    paths = [
        "data/market_snapshot.json",
        "data/market_snapshot.js",
        f"data/briefings/{key}.json",
    ]

    try:
        with repository_publish_lock(project_dir):
            if not json_path.exists():
                raise FileNotFoundError(json_path)
            remotes = _run_git(project_dir, ["remote"], capture_output=True, text=True, check=True)
            if not remotes.stdout.strip():
                raise RuntimeError("git remote is not configured")
            branch = _run_git(
                project_dir, ["branch", "--show-current"],
                capture_output=True, text=True, check=True,
            ).stdout.strip()
            if not branch:
                raise RuntimeError("cannot publish from a detached HEAD")

            generated_at = datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S KST")
            last_error = None
            for attempt in range(1, attempts + 1):
                try:
                    # 진행 중이던 rebase/merge 잔여 상태 정리(있다면)
                    _run_git(project_dir, ["rebase", "--abort"], capture_output=True)
                    _run_git(project_dir, ["merge", "--abort"], capture_output=True)
                    _run_git(project_dir, ["fetch", "origin", branch], check=True)
                    # 안전장치: 게시 대상 외 변경/커밋이 있으면 reset 으로 날리지 않고 중단
                    _assert_safe_to_reset(project_dir, branch, paths)
                    # 최신 원격을 기준선으로 삼아 충돌 가능성을 제거
                    _run_git(project_dir, ["reset", "--hard", f"origin/{branch}"], check=True)
                    # 최신 snapshot 위에 이번 브리핑 재병합 후 기록
                    _write_publish_files(json_path, js_path, fragment_path, key, formatted_html, generated_at, mutate)
                    _run_git(project_dir, ["add", "--", *paths], check=True)
                    status = _run_git(
                        project_dir, ["status", "--porcelain", "--", *paths],
                        capture_output=True, text=True, check=True,
                    )
                    if status.stdout.strip():
                        stamp = datetime.now(KST).strftime("%Y-%m-%d %H:%M")
                        message = f"Auto-update market data ({commit_label}): {stamp} [skip ci]"
                        _run_git(project_dir, ["commit", "-m", message, "--", *paths], check=True)
                    push = _run_git(project_dir, ["push", "origin", branch], capture_output=True, text=True)
                    if push.returncode != 0:
                        raise RuntimeError(f"push 거부(원격이 갱신됨): {push.stderr.strip()[:200]}")
                    _run_git(project_dir, ["fetch", "origin", branch], check=True)
                    _verify_remote_briefing(project_dir, branch, key, formatted_html)
                    print(f"  [성공] origin/{branch} 게시 및 ai_briefing.{key} 검증 완료 (시도 {attempt})")
                    return True
                except Exception as error:
                    last_error = error
                    print(f"  [재시도] 게시 시도 {attempt}/{attempts} 실패: {error}")
                    if attempt < attempts:
                        time.sleep(5)
            raise RuntimeError(f"게시 {attempts}회 시도 후 실패: {last_error}")
    except Exception as error:
        print(f"  [오류] ai_briefing.{key} 게시 실패: {error}")
        return False