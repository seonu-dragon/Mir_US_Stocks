#!/usr/bin/env python3
"""KR 지수 정합성 게이트 — 미국 모드(워커 ?indices=)와 국내 모드(스냅샷)가 같은 지수를 같게 보여주는가.

2026-09-16 재감사: 같은 KOSDAQ 812.41 을 미국 모드 지수 띠(워커)는 −1.00%, 국내 모드
지수 카드(data/korea/market_snapshot.json)는 +0.70% 로 보여줬다. 워커가 야후 ^KQ11 의
하루 밀린 chartPreviousClose 를 믿은 탓이다. 워커는 이제 네이버 m.stock 지수 API 를
기준으로 쓰고(스냅샷과 같은 소스), 이 스크립트는 두 경로가 다시 갈라지면 배포를 멈춘다.

비교 규칙:
  - **가격이 같을 때만**(상대 차 0.05% 이내) 등락률을 비교한다. 가격이 다르면 서로 다른
    세션(장중 워커 vs 15:42 스냅샷)이라 등락률이 달라도 정상이다 → 건너뜀.
  - 같은 세션인데 등락률 차가 0.2%p 이상이면 실패(exit 1).
  - 워커가 아직 네이버 기준 버전이 아니면(changePctPolicy 표식 없음 — 워커는 대시보드
    수동 배포라 머지와 반영 사이에 틈이 있다) 경고만 내고 통과한다. 그 틈에 배포 전체를
    막으면 데이터가 사이트에 못 나간다.
  - 워커에 닿지 못하거나 stale 응답이면 경고 후 통과(네트워크 장애로 배포를 막지 않는다).

사용: py scripts/check_kr_index_parity.py [--worker URL] [--snapshot PATH]
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_WORKER = "https://mirusstocks.planbesides.workers.dev"
DEFAULT_SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"
KR_SYMBOLS = ("^KS11", "^KQ11")
MAX_CHANGE_GAP_PP = 0.2
SAME_PRICE_REL = 0.0005
NAVER_POLICY = "naver-primary"


def _num(value):
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    return n if n == n and n not in (float("inf"), float("-inf")) else None


def compare(worker_rows: list[dict], snapshot_rows: list[dict]) -> tuple[bool, list[str]]:
    """(통과 여부, 메시지 목록). 순수 함수 — 테스트 대상."""
    messages: list[str] = []
    ok = True
    worker = {str(r.get("symbol")): r for r in worker_rows or [] if isinstance(r, dict)}
    snap = {str(r.get("symbol")): r for r in snapshot_rows or [] if isinstance(r, dict)}
    for symbol in KR_SYMBOLS:
        w, s = worker.get(symbol), snap.get(symbol)
        if not w or not s:
            messages.append(f"[skip] {symbol}: 한쪽에 행이 없다(worker={bool(w)}, snapshot={bool(s)})")
            continue
        wp, sp = _num(w.get("price")), _num(s.get("price"))
        wc, sc = _num(w.get("changePct")), _num(s.get("changePct"))
        if None in (wp, sp, wc, sc) or sp <= 0:
            messages.append(f"[skip] {symbol}: 값 결측(worker {wp}/{wc}, snapshot {sp}/{sc})")
            continue
        if abs(wp - sp) / sp > SAME_PRICE_REL:
            messages.append(f"[skip] {symbol}: 다른 세션(worker {wp:,.2f} vs snapshot {sp:,.2f}) — 등락률 비교 안 함")
            continue
        gap = abs(wc - sc)
        line = (f"{symbol}: price {sp:,.2f} · worker {wc:+.2f}% ({w.get('changePctSource')}) "
                f"vs snapshot {sc:+.2f}% — 차 {gap:.2f}%p")
        if gap < MAX_CHANGE_GAP_PP:
            messages.append(f"[ok] {line}")
            continue
        if w.get("changePctPolicy") != NAVER_POLICY:
            messages.append(f"[warn] {line} — 워커가 아직 네이버 기준 버전이 아니다(대시보드 수동 배포 필요). 게이트 보류")
            continue
        ok = False
        messages.append(f"[FAIL] {line} (한도 {MAX_CHANGE_GAP_PP}%p)")
    return ok, messages


def fetch_worker(url: str) -> dict:
    req = urllib.request.Request(f"{url.rstrip('/')}/?indices=1", headers={"User-Agent": "MirParityGate/1.0"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> int:
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("--worker", default=DEFAULT_WORKER)
    parser.add_argument("--snapshot", default=str(DEFAULT_SNAPSHOT))
    args = parser.parse_args()

    snapshot = json.loads(Path(args.snapshot).read_text(encoding="utf-8"))
    try:
        payload = fetch_worker(args.worker)
    except Exception as exc:
        print(f"::warning::KR 지수 정합성 검사 건너뜀 — 워커 응답 실패: {exc}")
        return 0
    if payload.get("stale"):
        print(f"::warning::KR 지수 정합성 검사 건너뜀 — 워커가 stale 응답(storedAt {payload.get('storedAt')})")
        return 0
    ok, messages = compare(payload.get("indices") or [], snapshot.get("indices") or [])
    for m in messages:
        print(m)
        if m.startswith("[warn]"):
            print(f"::warning::{m}")
    if not ok:
        print("::error::미국 모드(워커)와 국내 모드(스냅샷)의 KR 지수 등락률이 0.2%p 이상 어긋난다 — 배포 중단")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
