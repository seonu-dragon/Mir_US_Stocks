"""종목별 작은 레코드를 crc32 해시 샤드 몇 개로 나눠 쓰는 도우미.

쓰는 곳: build_company_profile.py(기업개요) · build_us_price_targets.py(US 목표주가 범위).
화면(company-info.js)은 `company-info-core.js` 의 `shardOf` 로 같은 샤드 번호를 계산해 그 파일 하나만 받는다.

- 샤드 번호 = zlib.crc32(ticker UTF-8) % n   (event_study 의 tk 샤드와 같은 규칙)
- 파일: <dir>/<prefix>NN.json = {"v": 1, "t": {ticker: 레코드, ...}}  (compact, 키 정렬)
- 내용이 그대로면 파일을 다시 쓰지 않는다 — 봇 커밋 diff·레포 증가를 줄인다.
- 인덱스에 넣을 샤드 버전(`ver`)은 내용 crc32 16진수 — 브라우저가 ?v= 로 붙여 바뀐 샤드만 새로 받는다.
"""

from __future__ import annotations

import json
import zlib
from pathlib import Path

from briefing_store import atomic_write_text


def shard_of(ticker: str, n: int) -> int:
    return zlib.crc32(str(ticker).encode("utf-8")) % n


def shard_name(prefix: str, i: int) -> str:
    return f"{prefix}{i:02d}.json"


def load_shards(directory: Path, prefix: str, n: int) -> dict:
    """기존 샤드를 모두 읽어 {ticker: 레코드} 로 합친다. 없거나 깨진 샤드는 건너뛴다."""
    out: dict = {}
    for i in range(n):
        p = Path(directory) / shard_name(prefix, i)
        try:
            payload = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        for k, v in (payload.get("t") or {}).items():
            out[k] = v
    return out


def shard_text(records: dict) -> str:
    return json.dumps({"v": 1, "t": {k: records[k] for k in sorted(records)}},
                      ensure_ascii=False, separators=(",", ":"), sort_keys=False) + "\n"


def write_shards(directory: Path, prefix: str, n: int, records: dict) -> tuple[list[Path], dict]:
    """records 전체를 n 개 샤드로 나눠 바뀐 파일만 쓴다. (쓴 경로 목록, {"NN": 버전}) 반환."""
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    buckets: list[dict] = [{} for _ in range(n)]
    for k, v in records.items():
        buckets[shard_of(k, n)][k] = v
    written: list[Path] = []
    ver: dict = {}
    for i, bucket in enumerate(buckets):
        text = shard_text(bucket)
        ver[f"{i:02d}"] = format(zlib.crc32(text.encode("utf-8")), "08x")
        p = directory / shard_name(prefix, i)
        try:
            old = p.read_text(encoding="utf-8")
        except Exception:
            old = None
        if old != text:
            atomic_write_text(p, text)
            written.append(p)
    return written, ver
