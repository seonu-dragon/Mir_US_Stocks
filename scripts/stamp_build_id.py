#!/usr/bin/env python3
"""정적 자산의 ?v= 캐시버스터를 파일 내용 해시로 스탬프한다.

수동으로 ?v= 를 올리던 방식은 값이 5가지로 갈라진 채 몇 주간 방치됐다(app.js 는
7/15 에 바뀌었는데 URL 은 여전히 ?v=20260702ai19). 여기서는 각 자산의 ?v= 를
그 파일 내용의 해시로 박아서, 바뀐 파일만 캐시가 깨지고 안 바뀐 파일은 그대로
재사용되게 한다. 사람이 기억할 값이 없으므로 어긋날 수도 없다.

- index.html / analysis.html 의 로컬 .js/.css 참조 → ?v=<해당 파일 md5[:10]>
- build_id.js 의 MIR_BUILD_ID → 전체 자산 결합 해시(= SW 캐시 세대)
- sw.js 의 BUILD_ID_FALLBACK → 동일 값

배포 전 실행:  py scripts/stamp_build_id.py
확인만:        py scripts/stamp_build_id.py --check   (어긋나 있으면 exit 1)
"""

from __future__ import annotations

import argparse
import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# ?v= 를 스탬프할 HTML. 로컬 .js/.css 참조만 대상이고 이미지(favicon 등)는 건드리지 않는다.
HTML_FILES = ["index.html", "analysis.html", "chart_capture.html"]
STAMPABLE_SUFFIXES = {".js", ".css"}

# (src|href)="<path>?v=<something>" 에서 path 와 기존 버전을 분리한다.
ASSET_RE = re.compile(r'(?P<attr>\b(?:src|href)=")(?P<path>[^"?#]+)\?v=(?P<ver>[^"#]*)(?P<tail>")')


def normalized_bytes(path: Path) -> bytes:
    """줄바꿈을 LF 로 정규화한 바이트.

    git 은 LF 로 저장하고(core.autocrlf=true) Windows 작업트리는 CRLF 로 체크아웃되므로,
    날바이트를 해시하면 같은 커밋인데도 Windows 와 CI(LF)의 ?v= 가 서로 어긋난다 —
    한쪽에서 스탬프하면 다른 쪽 --check 가 항상 실패했다. 해시는 CRLF→LF 정규화본으로.
    """
    return path.read_bytes().replace(b"\r\n", b"\n")


def file_hash(path: Path) -> str:
    return hashlib.md5(normalized_bytes(path)).hexdigest()[:10]


def stampable(path_str: str) -> bool:
    """로컬 상대경로의 .js/.css 만. 절대 URL(CDN)과 이미지는 제외."""
    if path_str.startswith(("http://", "https://", "//")):
        return False
    return Path(path_str).suffix in STAMPABLE_SUFFIXES


def resolve(path_str: str) -> Path:
    return (ROOT / path_str.lstrip("./")).resolve()


def collect_assets() -> list[Path]:
    """HTML 이 참조하는, 디스크에 실재하는 스탬프 대상 자산 목록."""
    found: dict[str, Path] = {}
    for html_name in HTML_FILES:
        html = ROOT / html_name
        if not html.exists():
            continue
        for m in ASSET_RE.finditer(html.read_text(encoding="utf-8")):
            p = m.group("path")
            if not stampable(p):
                continue
            target = resolve(p)
            if target.exists():
                found[p] = target
    return [found[k] for k in sorted(found)]


def combined_id(assets: list[Path]) -> str:
    """전체 자산의 결합 해시. build_id.js 자신은 제외(자기참조 방지)."""
    h = hashlib.md5()
    for path in assets:
        if path.name == "build_id.js":
            continue
        h.update(path.name.encode())
        h.update(hashlib.md5(normalized_bytes(path)).digest())
    return h.hexdigest()[:10]


def sub_once(path: Path, pattern: str, replacement: str, label: str, changes: list[str]) -> None:
    text = path.read_text(encoding="utf-8")
    new_text, n = re.subn(pattern, replacement, text, count=1)
    if n != 1:
        raise SystemExit(f"[stamp] {path.name}: {label} 패턴을 찾지 못했다. 스크립트를 고쳐야 한다.")
    if new_text != text:
        path.write_text(new_text, encoding="utf-8")
        changes.append(f"{path.name}: {label}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="쓰지 않고 어긋난 곳만 보고(있으면 exit 1)")
    args = ap.parse_args()

    assets = collect_assets()
    if not assets:
        raise SystemExit("[stamp] 스탬프할 자산을 찾지 못했다.")

    build_id = combined_id(assets)
    changes: list[str] = []

    # 1) build_id.js 를 먼저 확정한다. 그래야 그 파일 해시로 자신의 ?v= 도 스탬프할 수 있다.
    build_id_js = ROOT / "build_id.js"
    if args.check:
        current = re.search(r'MIR_BUILD_ID = "([^"]+)"', build_id_js.read_text(encoding="utf-8"))
        if not current or current.group(1) != build_id:
            changes.append(f"build_id.js: MIR_BUILD_ID ({current.group(1) if current else '?'} → {build_id})")
    else:
        sub_once(build_id_js, r'MIR_BUILD_ID = "[^"]+"', f'MIR_BUILD_ID = "{build_id}"', "MIR_BUILD_ID", changes)
        sub_once(ROOT / "sw.js", r'BUILD_ID_FALLBACK = "[^"]+"', f'BUILD_ID_FALLBACK = "{build_id}"',
                 "BUILD_ID_FALLBACK", changes)

    # 2) HTML 의 각 ?v= 를 그 파일 내용 해시로 교체.
    hashes = {p: file_hash(p) for p in collect_assets()}

    for html_name in HTML_FILES:
        html = ROOT / html_name
        if not html.exists():
            continue
        text = html.read_text(encoding="utf-8")
        stale: list[str] = []

        def repl(m: re.Match) -> str:
            p = m.group("path")
            if not stampable(p):
                return m.group(0)
            target = resolve(p)
            if not target.exists():
                return m.group(0)
            want = hashes.get(target) or file_hash(target)
            if m.group("ver") != want:
                stale.append(f"{p} ({m.group('ver')} → {want})")
            return f'{m.group("attr")}{p}?v={want}{m.group("tail")}'

        new_text = ASSET_RE.sub(repl, text)
        if stale:
            changes.extend(f"{html_name}: {s}" for s in stale)
        if new_text != text and not args.check:
            html.write_text(new_text, encoding="utf-8")

    if args.check:
        if changes:
            print("[stamp] 캐시버스터가 어긋나 있다:")
            for c in changes:
                print(f"  - {c}")
            print("\n  py scripts/stamp_build_id.py  로 갱신할 것.")
            return 1
        print("[stamp] 모든 ?v= 가 파일 내용과 일치한다.")
        return 0

    if changes:
        print(f"[stamp] build id = {build_id}")
        for c in changes:
            print(f"  - {c}")
    else:
        print("[stamp] 변경 없음(이미 최신).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
