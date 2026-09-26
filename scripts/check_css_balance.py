#!/usr/bin/env python3
"""styles.css 중괄호 균형 검사 (CI).

병렬 PR 을 병합하다 `@media { ... }` 닫는 괄호가 빠지면 그 뒤 규칙 전체가 조용히
모바일 전용이 된다(2026-09-25·26 두 번 — 특징주·재무 섹션). 브라우저는 에러를 내지
않으니 여기서 잡는다. 주석과 문자열 안의 괄호는 세지 않는다.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMMENT = re.compile(r"/\*.*?\*/", re.S)
STRING = re.compile(r'"(?:\\.|[^"\\])*"' + r"|'(?:\\.|[^'\\])*'")


def unclosed(text: str) -> list[int]:
    """닫히지 않은 '{' 의 줄 번호 목록. 짝 없는 '}' 는 음수 줄 번호로 반환."""
    blank = lambda m: " " * len(m.group())  # noqa: E731 — 위치(줄 번호) 보존
    s = STRING.sub(blank, COMMENT.sub(blank, text))
    stack: list[int] = []
    for i, ch in enumerate(s):
        if ch == "{":
            stack.append(i)
        elif ch == "}":
            if not stack:
                return [-(text.count("\n", 0, i) + 1)]
            stack.pop()
    return [text.count("\n", 0, i) + 1 for i in stack]


def unterminated_comment(text: str) -> int | None:
    """닫히지 않은 '/*' 의 줄 번호. 그 뒤 규칙이 전부 주석이 돼 조용히 무시된다
    (2026-09-26 병합 중 파일 끝에 '/* ====' 머리글만 남은 적 있음)."""
    pos = 0
    while True:
        a = text.find("/*", pos)
        if a < 0:
            return None
        b = text.find("*/", a + 2)
        if b < 0:
            return text.count("\n", 0, a) + 1
        pos = b + 2


def main() -> int:
    bad = 0
    for name in ("styles.css",):
        text = (ROOT / name).read_text(encoding="utf-8")
        cl = unterminated_comment(text)
        if cl is not None:
            bad += 1
            print(f"[css] {name}:{cl} 닫히지 않은 주석 '/*'")
        for ln in unclosed(text):
            bad += 1
            if ln < 0:
                print(f"[css] {name}:{-ln} 여는 괄호 없는 '}}'")
            else:
                print(f"[css] {name}:{ln} 닫히지 않은 '{{'")
    if not bad:
        print("[css] 중괄호 균형 OK")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
