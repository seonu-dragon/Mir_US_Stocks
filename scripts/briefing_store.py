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


def _git_publish(project_dir, key, expected_html, commit_label, paths):
    remotes = _run_git(project_dir, ["remote"], capture_output=True, text=True, check=True)
    if not remotes.stdout.strip():
        raise RuntimeError("git remote is not configured")
    branch = _run_git(
        project_dir,
        ["branch", "--show-current"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()
    if not branch:
        raise RuntimeError("cannot publish from a detached HEAD")

    _run_git(project_dir, ["add", "--", *paths], check=True)
    status = _run_git(
        project_dir,
        ["status", "--porcelain", "--", *paths],
        capture_output=True,
        text=True,
        check=True,
    )
    if status.stdout.strip():
        stamp = datetime.now(KST).strftime("%Y-%m-%d %H:%M")
        message = f"Auto-update market data ({commit_label}): {stamp} [skip ci]"
        _run_git(project_dir, ["commit", "-m", message, "--", *paths], check=True)

    last_error = None
    for attempt in range(1, 4):
        try:
            _run_git(project_dir, ["push", "origin", branch], check=True)
            _verify_remote_briefing(project_dir, branch, key, expected_html)
            print(f"  [Git] origin/{branch} 푸시 및 ai_briefing.{key} 검증 완료")
            return True
        except Exception as error:
            last_error = error
            if attempt < 3:
                print(f"  [Git] 푸시/검증 시도 {attempt} 실패, 10초 후 재시도합니다: {error}")
                time.sleep(10)
    raise RuntimeError(f"git publish failed after 3 attempts: {last_error}")


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

def publish_briefing(project_dir, key, html, commit_label, mutate=None):
    """Merge one briefing into the newest snapshot and publish it atomically."""
    project_dir = Path(project_dir).resolve()
    json_path = project_dir / "data" / "market_snapshot.json"
    js_path = project_dir / "data" / "market_snapshot.js"
    fragment_path = project_dir / "data" / "briefings" / f"{key}.json"
    formatted_html = str(html).replace("\n", "<br>")

    try:
        with repository_publish_lock(project_dir):
            if not json_path.exists():
                raise FileNotFoundError(json_path)
            data = _load_json(json_path)
            data.setdefault("ai_briefing", {})[key] = formatted_html
            if mutate:
                mutate(data)

            generated_at = datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S KST")
            data.setdefault("briefing_meta", {})[key] = generated_at
            fragment = {
                "key": key,
                "generatedAtKst": generated_at,
                "html": formatted_html,
            }
            json_body = json.dumps(data, ensure_ascii=False, indent=2)
            atomic_write_text(fragment_path, json.dumps(fragment, ensure_ascii=False, indent=2) + "\n")
            atomic_write_text(json_path, json_body + "\n")
            atomic_write_text(js_path, f"window.MARKET_SNAPSHOT = {json_body};\n")
            print(f"  [성공] 최신 스냅샷에 ai_briefing.{key} 병합 및 원자 저장 완료")

            paths = [
                "data/market_snapshot.json",
                "data/market_snapshot.js",
                f"data/briefings/{key}.json",
            ]
            return _git_publish(project_dir, key, formatted_html, commit_label, paths)
    except Exception as error:
        print(f"  [오류] ai_briefing.{key} 게시 실패: {error}")
        return False