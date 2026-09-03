#!/usr/bin/env python3
"""전역 이름 충돌 검사 (check_global_name_collisions.py)
=====================================================

index.html 이 <script src> 로 싣는 클래식 스크립트(모듈·IIFE 아님)들은 모두 같은 전역
스코프를 공유한다. 두 파일이 같은 이름의 최상위 `function`/`const`/`let`/`var`/`class`
를 선언하면 — `function` 끼리는 뒤에 로드된 쪽이 조용히 덮어쓰고, `const/let` 끼리는
SyntaxError 로 페이지가 죽는다. 2026-09 에 chart-indicators.js 의 `rsiValue(gain, loss)`
를 app.js 의 `rsiValue(item)` 이 덮어써 RSI(14) 패널이 비어 있던 것이 계기다.

방식: 각 파일을 문자열·주석·정규식·템플릿 리터럴을 건너뛰는 간단한 스캐너로 훑어
중괄호 깊이 0 에서의 선언만 모은다. IIFE 로 감싼 파일(analysis.js 등)은 깊이가 0 이
아니라 자연히 제외된다. 같은 이름이 둘 이상의 파일에 있으면 종료코드 1.

실행:  py scripts/check_global_name_collisions.py            (index.html 기준)
       py scripts/check_global_name_collisions.py --html analysis.html --html chart_capture.html
       py scripts/check_global_name_collisions.py --list      (파일별 전역 선언 목록 출력)
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

SCRIPT_TAG_RE = re.compile(r"<script\b([^>]*)\bsrc=[\"']([^\"'?]+)(?:\?[^\"']*)?[\"'][^>]*>", re.I)
DECL_RE = re.compile(r"\b(function|const|let|var|class)\b")
IDENT_RE = re.compile(r"[A-Za-z_$][\w$]*")
# 정규식 리터럴이 올 수 있는 직전 토큰(연산자/여는 괄호/키워드). 그 외(식별자·숫자·닫는
# 괄호 뒤)의 `/` 는 나눗셈으로 본다.
REGEX_PREV_KEYWORDS = {"return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else"}


def classic_scripts(html_path: Path) -> list[Path]:
    text = html_path.read_text(encoding="utf-8")
    out = []
    for m in SCRIPT_TAG_RE.finditer(text):
        attrs, src = m.group(1), m.group(2)
        if re.search(r"\btype\s*=\s*[\"']module[\"']", attrs, re.I):
            continue
        if src.startswith(("http:", "https:", "//")):
            continue
        p = (html_path.parent / src).resolve()
        if p.exists():
            out.append(p)
    return out


def top_level_declarations(src: str) -> list[tuple[str, str, int]]:
    """(kind, name, line) — 중괄호/괄호 깊이 0 에서의 선언만."""
    decls = []
    i, n = 0, len(src)
    depth = 0          # {} 깊이
    paren = 0          # () 깊이 — `for (let i...)` 같은 건 깊이 0 이라도 제외
    line = 1
    last_sig = ""      # 정규식/나눗셈 판별용 직전 의미 토큰
    tmpl_stack = []    # 템플릿 리터럴 ${} 중첩 추적: 각 항목은 진입 시점의 depth

    def skip_string(j: int, quote: str) -> int:
        j += 1
        while j < n and src[j] != quote:
            if src[j] == "\\":
                j += 1
            elif src[j] == "\n":
                break
            j += 1
        return j + 1

    while i < n:
        ch = src[i]
        if ch == "\n":
            line += 1
            i += 1
            continue
        if ch in " \t\r":
            i += 1
            continue
        if src.startswith("//", i):
            j = src.find("\n", i)
            i = n if j < 0 else j
            continue
        if src.startswith("/*", i):
            j = src.find("*/", i + 2)
            j = n if j < 0 else j + 2
            line += src.count("\n", i, j)
            i = j
            continue
        if ch in "'\"":
            j = skip_string(i, ch)
            line += src.count("\n", i, j)
            i = j
            last_sig = "str"
            continue
        if ch == "`":
            # 템플릿 리터럴: ${ 를 만나면 표현식으로 들어가고, 짝이 맞는 } 에서 돌아온다.
            j = i + 1
            while j < n:
                c = src[j]
                if c == "\\":
                    j += 2
                    continue
                if c == "`":
                    j += 1
                    break
                if src.startswith("${", j):
                    tmpl_stack.append(depth)
                    depth += 1
                    j += 2
                    break  # 표현식 스캔은 메인 루프가 이어받는다
                if c == "\n":
                    line += 1
                j += 1
            i = j
            last_sig = "str"
            continue
        if ch == "{":
            depth += 1
            i += 1
            last_sig = "{"
            continue
        if ch == "}":
            depth -= 1
            i += 1
            if tmpl_stack and depth == tmpl_stack[-1]:
                # 템플릿 표현식 종료 → 문자열 나머지를 계속 건너뛴다
                tmpl_stack.pop()
                j = i
                while j < n:
                    c = src[j]
                    if c == "\\":
                        j += 2
                        continue
                    if c == "`":
                        j += 1
                        break
                    if src.startswith("${", j):
                        tmpl_stack.append(depth)
                        depth += 1
                        j += 2
                        break
                    if c == "\n":
                        line += 1
                    j += 1
                i = j
                last_sig = "str"
                continue
            last_sig = "}"
            continue
        if ch == "(":
            paren += 1
            i += 1
            last_sig = "("
            continue
        if ch == ")":
            paren -= 1
            i += 1
            last_sig = ")"
            continue
        if ch == "/":
            # 정규식 리터럴인지 나눗셈인지
            is_regex = last_sig in ("", "(", "{", "}", ",", ";", "=", ":", "[", "!", "&", "|", "?", "+", "-", "*", "%", "<", ">", "~", "^") or last_sig in REGEX_PREV_KEYWORDS
            if is_regex:
                j = i + 1
                in_class = False
                while j < n:
                    c = src[j]
                    if c == "\\":
                        j += 2
                        continue
                    if c == "[":
                        in_class = True
                    elif c == "]":
                        in_class = False
                    elif c == "/" and not in_class:
                        j += 1
                        break
                    elif c == "\n":
                        break
                    j += 1
                while j < n and src[j].isalpha():
                    j += 1
                i = j
                last_sig = "regex"
                continue
            i += 1
            last_sig = "/"
            continue
        m = IDENT_RE.match(src, i)
        if m:
            word = m.group(0)
            if depth == 0 and paren == 0 and word in ("function", "const", "let", "var", "class"):
                # 앞 토큰이 `.`(메서드 접근) 이거나 `export` 등이면 무시 — 클래식 스크립트엔 없음
                j = m.end()
                # function* 및 공백
                while j < n and src[j] in " \t*":
                    j += 1
                if word == "function" and src.startswith("(", j):
                    pass  # 익명 함수 표현식 — 선언 아님
                else:
                    if word in ("const", "let", "var"):
                        # const a = 1, b = 2;  /  const { x, y } = obj; / const [a, b] = arr;
                        names = _binding_names(src, j)
                        for name in names:
                            decls.append((word, name, line))
                    else:
                        nm = IDENT_RE.match(src, j)
                        if nm:
                            decls.append((word, nm.group(0), line))
            i = m.end()
            last_sig = word
            continue
        # 숫자 등 그 밖의 문자
        if ch.isdigit():
            j = i
            while j < n and (src[j].isalnum() or src[j] in "._"):
                j += 1
            i = j
            last_sig = "num"
            continue
        last_sig = ch
        i += 1
    return decls


def _binding_names(src: str, j: int) -> list[str]:
    """const/let/var 뒤의 바인딩 이름들(구조분해 포함, 최상위만 대충)."""
    names = []
    n = len(src)
    # 문장 끝(; 또는 줄바꿈 뒤 새 문장)까지의 텍스트를 대략 자른다: 깊이 0 의 `;` 까지
    depth = 0
    k = j
    while k < n:
        c = src[k]
        if c in "([{":
            depth += 1
        elif c in ")]}":
            depth -= 1
        elif c == ";" and depth == 0:
            break
        elif c == "\n" and depth == 0:
            # 다음 줄이 `.`/연산자로 이어지지 않으면 문장 끝으로 본다
            rest = src[k + 1:k + 40].lstrip()
            if not rest or not rest[0] in ".,?:+-*/&|=":
                if "=" not in src[j:k]:
                    break
        k += 1
    stmt = src[j:k]
    # 초기화식은 버린다: 최상위 `=` 왼쪽만
    lhs = _lhs_before_equals(stmt)
    if lhs.lstrip().startswith(("{", "[")):
        inner = lhs.strip()[1:-1] if lhs.strip()[-1:] in "}]" else lhs.strip()[1:]
        for part in inner.split(","):
            part = part.strip()
            if not part or part.startswith("..."):
                part = part[3:].strip()
            if ":" in part:
                part = part.split(":", 1)[1].strip()
            if "=" in part:
                part = part.split("=", 1)[0].strip()
            m = IDENT_RE.match(part)
            if m:
                names.append(m.group(0))
        return names
    for part in _split_top_commas(stmt):
        m = IDENT_RE.match(part.strip())
        if m:
            names.append(m.group(0))
    return names


def _lhs_before_equals(stmt: str) -> str:
    depth = 0
    for idx, c in enumerate(stmt):
        if c in "([{":
            depth += 1
        elif c in ")]}":
            depth -= 1
        elif c == "=" and depth == 0 and stmt[idx + 1:idx + 2] != "=" and stmt[idx + 1:idx + 2] != ">":
            return stmt[:idx]
    return stmt


def _split_top_commas(stmt: str) -> list[str]:
    parts, depth, cur = [], 0, []
    in_str = None
    for c in stmt:
        if in_str:
            cur.append(c)
            if c == in_str:
                in_str = None
            continue
        if c in "'\"`":
            in_str = c
        elif c in "([{":
            depth += 1
        elif c in ")]}":
            depth -= 1
        elif c == "," and depth == 0:
            parts.append("".join(cur))
            cur = []
            continue
        cur.append(c)
    parts.append("".join(cur))
    return parts


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--html", action="append", default=None, help="검사할 HTML(기본 index.html). 반복 가능")
    ap.add_argument("--list", action="store_true", help="파일별 전역 선언 목록 출력")
    args = ap.parse_args()
    htmls = [ROOT / h for h in (args.html or ["index.html"])]

    exit_code = 0
    for html in htmls:
        files = classic_scripts(html)
        by_name: dict[str, list[tuple[str, str, int]]] = defaultdict(list)
        for f in files:
            src = f.read_text(encoding="utf-8")
            decls = top_level_declarations(src)
            rel = f.relative_to(ROOT).as_posix()
            if args.list:
                print(f"[{rel}] {len(decls)} globals")
                for kind, name, line in decls:
                    print(f"    {kind:8s} {name}  (L{line})")
            for kind, name, line in decls:
                by_name[name].append((rel, kind, line))
        dups = {k: v for k, v in by_name.items() if len({r for r, _, _ in v}) > 1}
        print(f"[{html.name}] classic scripts: {len(files)} · globals: {sum(len(v) for v in by_name.values())} · duplicates across files: {len(dups)}")
        if dups:
            exit_code = 1
            for name in sorted(dups):
                where = ", ".join(f"{rel}:{line} ({kind})" for rel, kind, line in dups[name])
                print(f"  DUP {name}: {where}")
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
