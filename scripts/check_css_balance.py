#!/usr/bin/env python3
"""styles.css 중괄호 균형 검사 (CI).

병렬 PR 을 병합하다 `@media { ... }` 닫는 괄호가 빠지면 그 뒤 규칙 전체가 조용히
모바일 전용이 된다(2026-09-25·26 두 번 — 특징주·재무 섹션). 브라우저는 에러를 내지
않으니 여기서 잡는다. 주석과 문자열 안의 괄호는 센다에서 뺀다.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def unclosed(text: str) -> list[int]:
    s = re.sub(r"/\*.*?\*/", lambda m: " " * len(m.group()), text, flags=re.S)
    s = re.sub(r"\"(?:\.|[^\"\])*\"|'(?:\.|[^'\])*'", lambda m: " " * len(m.group()), s)
    stack: list[int] = []
    for i, ch in enumerate(s):
        if ch == "{":
            stack.append(i)
        elif ch == "}":
            if not stack:
                return [-(text.count("\n", 0, i) + 1)]
            stack.pop()
    return [text.count("\n", 0, i) + 1 for i in stack]


def main() -> int:
    bad = 0
    for name in ("styles.css",):
        lines = unclosed((ROOT / name).read_text(encoding="utf-8"))
        for ln in lines:
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
