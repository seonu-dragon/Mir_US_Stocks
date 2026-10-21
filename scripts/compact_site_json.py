# -*- coding: utf-8 -*-
"""배포 스테이징(_site/) 의 큰 JSON 을 공백 없는 형태로 다시 쓴다(2026-10-21 성능).

레포의 data/market_snapshot.json 은 빌더가 들여쓰기(pretty)로 써서 12.5MB 인데, 같은 값을 공백 없이
쓰면 6.7MB 다(gzip 전송량 1.65MB → 1.43MB). 브라우저는 부팅마다 이 파일 전체를 JSON.parse 하므로
폰(4x 느린 CPU)에서 파싱 시간도 절반이 된다. 값은 바꾸지 않는다 — 파싱한 객체를 그대로 다시 직렬화하고
(NaN 같은 비표준 토큰도 그대로 둔다), 다시 읽은 결과가 원본과 같은지 확인한 뒤에만 덮어쓴다.
레포 파일은 건드리지 않는다(빌더의 증분 상태·diff 형태 그대로).

사용: python3 scripts/compact_site_json.py --root _site data/market_snapshot.json data/korea/market_snapshot.json
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path


def _same(a, b) -> bool:
    if isinstance(a, float) and isinstance(b, float) and math.isnan(a) and math.isnan(b):
        return True
    if type(a) is not type(b):
        return False
    if isinstance(a, dict):
        return a.keys() == b.keys() and all(_same(a[k], b[k]) for k in a)
    if isinstance(a, list):
        return len(a) == len(b) and all(_same(x, y) for x, y in zip(a, b))
    return a == b


def compact_file(path: Path) -> tuple[int, int] | None:
    """압축했으면 (전, 후) 바이트, 이미 압축돼 있거나 읽지 못하면 None."""
    raw = path.read_bytes()
    try:
        obj = json.loads(raw.decode("utf-8"))
    except Exception as exc:  # 깨진 파일은 그대로 둔다(배포를 막지 않는다)
        print(f"[compact] {path}: 읽기 실패, 그대로 둔다 — {exc}")
        return None
    out = json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if len(out) >= len(raw):
        return None
    if not _same(json.loads(out.decode("utf-8")), obj):
        print(f"[compact] {path}: 다시 읽은 값이 달라 그대로 둔다")
        return None
    path.write_bytes(out)
    return len(raw), len(out)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=".")
    ap.add_argument("files", nargs="+")
    a = ap.parse_args(argv)
    root = Path(a.root)
    for rel in a.files:
        p = root / rel
        if not p.is_file():
            print(f"[compact] {rel}: 없음 — 건너뜀")
            continue
        r = compact_file(p)
        if r:
            print(f"[compact] {rel}: {r[0]:,} → {r[1]:,} bytes")
        else:
            print(f"[compact] {rel}: 변경 없음")
    return 0


if __name__ == "__main__":
    sys.exit(main())
