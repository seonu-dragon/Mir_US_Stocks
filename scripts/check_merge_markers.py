"""추적 파일에 병합 충돌 표시가 남았는지 검사한다(CI 용).

왜 필요한가:
  병렬 PR 을 연달아 머지하면서 충돌을 손으로 풀다 보면 `<<<<<<< ` 한 줄이 JS·CSS·
  JSON 에 남은 채 커밋될 수 있다. JS 는 node --check 가 잡지만 HTML·CSS·마크다운·
  워크플로우 YAML 일부는 문법 검사가 없어 그대로 배포된다.

규칙:
  - `<<<<<<< ` 와 `>>>>>>> ` 로 시작하는 줄은 어느 파일이든 실패.
  - `=======` 만 있는 줄은 마크다운·reST·텍스트에서는 제목 밑줄(setext)로 흔히 쓰이므로,
    그 파일에 위 두 표시가 함께 있을 때만 실패로 친다. 그 밖의 파일에서는 단독으로도 실패.
  - 바이너리는 건너뛴다(git grep -I).

사용법:
  py scripts/check_merge_markers.py     # 발견 시 exit 1
"""
from __future__ import annotations

import subprocess
import sys
from collections import defaultdict
from pathlib import Path

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
PROSE_SUFFIXES = {".md", ".markdown", ".rst", ".txt"}


def grep_markers() -> list[tuple[str, int, str]]:
    """git grep 으로 후보 줄을 찾는다(1만 개 넘는 데이터 파일을 파이썬으로 읽지 않으려고)."""
    proc = subprocess.run(
        ["git", "grep", "-I", "-n", "--no-color", "-E",
         r"^(<<<<<<< |>>>>>>> |=======.?$)"],
        cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    if proc.returncode not in (0, 1):  # 1 = 일치 없음
        print(proc.stderr, file=sys.stderr)
        raise SystemExit(2)
    hits = []
    for line in proc.stdout.splitlines():
        path, _, rest = line.partition(":")
        num, _, text = rest.partition(":")
        text = text.rstrip("\r")
        if text.startswith("=======") and text != "=======":
            continue  # '=======x' 같은 줄은 표시가 아니다
        hits.append((path, int(num), text))
    return hits


def classify(hits: list[tuple[str, int, str]]) -> list[tuple[str, int, str]]:
    by_file: dict[str, list[tuple[int, str]]] = defaultdict(list)
    for path, num, text in hits:
        by_file[path].append((num, text))
    bad = []
    for path, rows in by_file.items():
        has_angle = any(t != "=======" for _, t in rows)
        prose = Path(path).suffix.lower() in PROSE_SUFFIXES
        for num, text in rows:
            if text == "=======" and prose and not has_angle:
                continue  # 마크다운 제목 밑줄
            bad.append((path, num, text))
    return bad


def main() -> int:
    bad = classify(grep_markers())
    if bad:
        print(f"병합 충돌 표시 {len(bad)}줄이 남아 있다:", file=sys.stderr)
        for path, num, text in bad[:50]:
            print(f"  {path}:{num}: {text[:60]}", file=sys.stderr)
        return 1
    print("OK — 병합 충돌 표시 없음")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
