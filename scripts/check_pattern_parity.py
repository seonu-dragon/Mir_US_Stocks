#!/usr/bin/env python3
"""JS↔PY 패턴 감지 패리티 하네스 (check_pattern_parity.py)
=========================================================

analysis.js(+pattern_detectors_extended.js)와 scripts/pattern_lib.py
(+pattern_detectors_extended.py)는 "1:1 동일" 이 계약이다 — 오프라인 통계
(pattern_stats.json)와 브라우저 감지 결과가 같은 알고리즘이어야 base-rate 조회가
의미를 가진다. 그런데 2026-07-23 감사에서 emaArray 시드·volume-climax 0 처리 같은
조용한 드리프트가 실제로 발견됐다. 이 하네스는 재발을 막는다.

방식
----
1. 시드 고정 PRNG(random.Random)로 합성 OHLCV 픽스처 3개를 생성해 임시 JSON 에 쓴다
   (Math.random 금지 — node 쪽은 픽스처를 읽기만 한다).
2. 파이썬 pattern_lib.detect_confirmations 로 이벤트 목록을 만든다.
3. node 로 scripts/parity_driver.mjs 를 실행해 analysis.js 의 detectConfirmations
   이벤트 목록을 만든다.
4. (pattern, dir, confirm_idx) 집합을 픽스처별로 비교 — 불일치가 하나라도 있으면
   종료코드 1 (CI 에서 빨갛게).

실행:  py scripts/check_pattern_parity.py            (node 는 PATH 에서 탐색)
       py scripts/check_pattern_parity.py --node "C:/path/to/node.exe"
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import pattern_lib as pl  # noqa: E402

# 로컬(win32) 폴백: playwright 동봉 node — CI(ubuntu)에는 PATH 의 node 가 있다.
WIN_NODE_FALLBACK = "C:/Users/user/AppData/Local/ms-playwright-go/1.57.0/node.exe"


# ----------------------------------------------------------------------------
# 1. 합성 OHLCV 픽스처 — 시드 고정이라 매 실행 동일(비결정성 0)
# ----------------------------------------------------------------------------
def _bars_from_closes(rng, closes, base_volume=1_000_000, zero_volume_every=0):
    """종가 시퀀스 → [o,h,l,c,v,date] 봉. 고저는 시가/종가 주변 소폭 랜덤."""
    series = []
    prev = closes[0]
    for i, c in enumerate(closes):
        o = prev * (1 + rng.uniform(-0.004, 0.004))
        hi = max(o, c) * (1 + rng.uniform(0.0, 0.008))
        lo = min(o, c) * (1 - rng.uniform(0.0, 0.008))
        v = int(base_volume * rng.uniform(0.5, 1.8))
        # 거래량 0 봉을 일부러 심는다 — volume-climax 의 0 처리 드리프트가
        # 실제로 있었던 지점(파이썬/JS 가 0 을 다르게 취급하면 여기서 갈라진다).
        if zero_volume_every and i % zero_volume_every == 7:
            v = 0
        # 가끔 거래량 폭발(클라이맥스 후보)
        if rng.random() < 0.03:
            v = int(v * rng.uniform(4.0, 7.0))
        d = f"F{i:04d}"  # 달력 의미 없는 결정적 라벨(패리티 비교엔 인덱스만 쓴다)
        series.append([round(o, 4), round(hi, 4), round(lo, 4), round(c, 4), v, d])
        prev = c
    return series


def make_fixtures():
    """성격이 다른 3개 픽스처: 추세+눌림, 박스권 왕복, 갭·급변동."""
    fixtures = {}

    # (1) 완만한 상승 추세 + 주기적 눌림 — 돌파·깃발·삼각 계열을 자극
    rng = random.Random(20260723)
    closes = []
    price = 100.0
    for i in range(420):
        drift = 0.0006
        wave = 0.02 * math.sin(i / 17.0)
        shock = rng.gauss(0, 0.012)
        price = max(1.0, price * (1 + drift + wave * 0.01 + shock))
        closes.append(price)
    fixtures["trend_pullback"] = _bars_from_closes(rng, closes)

    # (2) 박스권 왕복(평균회귀) — 쌍천장/쌍바닥·박스·S/R 계열을 자극
    rng = random.Random(19700101)
    closes = []
    price = 50.0
    for i in range(420):
        mean_rev = (50.0 - price) * 0.03
        wave = 1.4 * math.sin(i / 11.0)
        price = max(1.0, price + mean_rev + wave * 0.15 + rng.gauss(0, 0.55))
        closes.append(price)
    fixtures["range_bound"] = _bars_from_closes(rng, closes)

    # (3) 급변동 + 갭 + 거래량 0 봉 — 갭 계열·클라이맥스·캔들 계열을 자극
    rng = random.Random(31337)
    closes = []
    price = 200.0
    for i in range(420):
        shock = rng.gauss(0, 0.02)
        if rng.random() < 0.04:  # 갭성 점프
            shock += rng.choice([-1, 1]) * rng.uniform(0.03, 0.07)
        price = max(1.0, price * (1 + shock - 0.0003))
        closes.append(price)
    fixtures["gappy_volatile"] = _bars_from_closes(rng, closes, zero_volume_every=23)

    return fixtures


# ----------------------------------------------------------------------------
# 2. 실행 헬퍼
# ----------------------------------------------------------------------------
def find_node(cli_arg):
    for cand in (cli_arg, os.environ.get("MIR_NODE_BIN"), shutil.which("node")):
        if cand and Path(cand).exists():
            return cand
    if sys.platform == "win32" and Path(WIN_NODE_FALLBACK).exists():
        return WIN_NODE_FALLBACK
    return None


def event_set(events):
    return {(e["pattern"], int(e["dir"]), int(e["confirm_idx"])) for e in events}


def main():
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
            sys.stderr.reconfigure(encoding="utf-8")
        except Exception:
            pass

    ap = argparse.ArgumentParser()
    ap.add_argument("--node", default=None, help="node 실행 파일 경로(기본: PATH 탐색)")
    ap.add_argument("--keep", action="store_true", help="임시 픽스처/결과 JSON 을 남긴다(디버그)")
    args = ap.parse_args()

    node = find_node(args.node)
    if not node:
        print("[parity] node 실행 파일을 찾지 못했습니다 (--node 또는 MIR_NODE_BIN)")
        return 2

    fixtures = make_fixtures()

    # 파이썬 쪽 이벤트
    py_events = {}
    for name, series in fixtures.items():
        rows = pl.rows_from_chart_series(series)
        py_events[name] = [
            {"pattern": e["pattern"], "dir": e["dir"], "confirm_idx": e["confirm_idx"]}
            for e in pl.detect_confirmations(rows)
        ]

    # node(analysis.js) 쪽 이벤트
    tmpdir = Path(tempfile.mkdtemp(prefix="mir_parity_"))
    fixtures_path = tmpdir / "fixtures.json"
    out_path = tmpdir / "js_events.json"
    fixtures_path.write_text(json.dumps(fixtures), encoding="utf-8")
    try:
        proc = subprocess.run(
            [node, str(ROOT / "scripts" / "parity_driver.mjs"), str(fixtures_path), str(out_path)],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=120,
        )
        if proc.returncode != 0:
            print("[parity] node 드라이버 실패:")
            print(proc.stdout or "")
            print(proc.stderr or "")
            return 2
        js_events = json.loads(out_path.read_text(encoding="utf-8"))
    finally:
        if args.keep:
            print(f"[parity] 임시 파일 유지: {tmpdir}")
        else:
            shutil.rmtree(tmpdir, ignore_errors=True)

    # 비교
    mismatch = 0
    for name in fixtures:
        pset = event_set(py_events[name])
        jset = event_set(js_events.get(name, []))
        only_py = sorted(pset - jset, key=lambda t: (t[2], t[0]))
        only_js = sorted(jset - pset, key=lambda t: (t[2], t[0]))
        status = "OK" if not only_py and not only_js else "MISMATCH"
        print(f"[parity] {name}: py={len(pset)} js={len(jset)} -> {status}")
        if only_py:
            mismatch += len(only_py)
            for p, d, ci in only_py[:20]:
                print(f"    PY only : {p} dir={d:+d} @ {ci}")
            if len(only_py) > 20:
                print(f"    ... 외 {len(only_py) - 20}건")
        if only_js:
            mismatch += len(only_js)
            for p, d, ci in only_js[:20]:
                print(f"    JS only : {p} dir={d:+d} @ {ci}")
            if len(only_js) > 20:
                print(f"    ... 외 {len(only_js) - 20}건")

    total_py = sum(len(v) for v in py_events.values())
    if mismatch:
        print(f"[parity] 실패: 불일치 {mismatch}건 — analysis.js 와 pattern_lib.py 가 드리프트했습니다.")
        print("[parity] 상수/알고리즘을 어느 쪽이 바꿨는지 확인해 양쪽을 동일하게 맞추세요.")
        return 1
    if total_py == 0:
        # 이벤트가 0 이면 '둘 다 조용히 깨진' 경우를 못 잡는다 — 하네스 자체 결함으로 취급.
        print("[parity] 실패: 파이썬 이벤트가 0건 — 픽스처가 패턴을 전혀 못 만들었습니다.")
        return 1
    print(f"[parity] 통과: 픽스처 {len(fixtures)}개, 이벤트 {total_py}건 완전 일치")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
