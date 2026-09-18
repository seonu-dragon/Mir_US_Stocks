#!/usr/bin/env python3
"""KR 지수 정합성 게이트 — 미국 모드(워커 ?indices=)와 국내 모드(스냅샷)가 같은 지수를 같게 보여주는가.

2026-09-16 재감사: 같은 KOSDAQ 812.41 을 미국 모드 지수 띠(워커)는 −1.00%, 국내 모드
지수 카드(data/korea/market_snapshot.json)는 +0.70% 로 보여줬다. 워커가 야후 ^KQ11 의
하루 밀린 chartPreviousClose 를 믿은 탓이다. 워커는 이제 네이버 m.stock 지수 API 를
기준으로 쓰고(스냅샷과 같은 소스), 이 스크립트는 두 경로가 다시 갈라지면 배포를 멈춘다.

비교 규칙:
  - **같은 거래일의 마감 세션일 때만** 등락률을 비교한다. 세션은 가격이 아니라 날짜로 가린다
    — 게이트가 네이버 지수 API 를 직접 불러 지금 세션(localTradedAt·marketStatus)을 확인하고,
    스냅샷 행의 tradedAt 과 날짜가 같고 장이 CLOSE 일 때만 '같은 세션'이다.
    2026-09-17 가격만 보던 시절의 오탐 두 건:
      · 18:40 KST — 스냅샷은 아직 09-16(6,717.97 +1.37%), 워커는 09-17 마감(−0.04%).
        하루 등락이 −0.04% 라 두 가격이 0.05% 안에 들어 '같은 세션'으로 오판 → 배포 중단.
      · 08:43 KST(장 시작 전) — 네이버가 새 거래일 기준으로 등락률을 0.00% 로 리셋.
        가격은 전일 종가 그대로라 스냅샷(+0.76%)과 '같은 세션'으로 오판 → 배포 중단.
  - 가격 차가 0.05% 를 넘으면(워커 캐시가 다른 시점) 역시 건너뜀.
  - 같은 세션이 확인됐는데 등락률 차가 0.2%p 이상이면 실패(exit 1).
  - 세션을 확인할 수 없으면(스냅샷에 tradedAt 이 없는 옛 스냅샷, 네이버 호출 실패) 어긋나도
    경고만 낸다 — 확인 못 한 것으로 배포를 막지 않는다.
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


def _session_date(value) -> str | None:
    text = str(value or "").strip()
    return text[:10] if len(text) >= 10 else None


def compare(worker_rows: list[dict], snapshot_rows: list[dict],
            live_sessions: dict[str, dict] | None = None) -> tuple[bool, list[str]]:
    """(통과 여부, 메시지 목록). 순수 함수 — 테스트 대상.

    live_sessions: {"^KS11": {"tradedAt": "2026-09-17T16:10:00+09:00", "marketStatus": "CLOSE"}, ...}
    — 네이버 지수 API 의 현재 세션. None 이거나 심볼이 빠지면 '세션 미확인'.
    """
    live_sessions = live_sessions or {}
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
        live = live_sessions.get(symbol) or {}
        live_date = _session_date(live.get("tradedAt"))
        live_status = str(live.get("marketStatus") or "").upper()
        snap_date = _session_date(s.get("tradedAt"))
        if live_status and live_status != "CLOSE":
            messages.append(f"[skip] {symbol}: 장 {live_status}({live_date}) — 마감 스냅샷과 다른 세션, 등락률 비교 안 함")
            continue
        if live_date and snap_date and live_date != snap_date:
            messages.append(f"[skip] {symbol}: 다른 거래일(현재 {live_date} vs snapshot {snap_date}) — 등락률 비교 안 함")
            continue
        if abs(wp - sp) / sp > SAME_PRICE_REL:
            messages.append(f"[skip] {symbol}: 다른 세션(worker {wp:,.2f} vs snapshot {sp:,.2f}) — 등락률 비교 안 함")
            continue
        session_confirmed = bool(live_date and snap_date and live_status == "CLOSE")
        gap = abs(wc - sc)
        line = (f"{symbol}: price {sp:,.2f} · worker {wc:+.2f}% ({w.get('changePctSource')}) "
                f"vs snapshot {sc:+.2f}% — 차 {gap:.2f}%p")
        if gap < MAX_CHANGE_GAP_PP:
            messages.append(f"[ok] {line}")
            continue
        if w.get("changePctPolicy") != NAVER_POLICY:
            messages.append(f"[warn] {line} — 워커가 아직 네이버 기준 버전이 아니다(대시보드 수동 배포 필요). 게이트 보류")
            continue
        if not session_confirmed:
            messages.append(f"[warn] {line} — 같은 세션인지 확인 못 함"
                            f"(현재 {live_date or '?'} {live_status or '?'} / snapshot {snap_date or 'tradedAt 없음'}). 게이트 보류")
            continue
        ok = False
        messages.append(f"[FAIL] {line} (한도 {MAX_CHANGE_GAP_PP}%p)")
    return ok, messages


def fetch_worker(url: str) -> dict:
    req = urllib.request.Request(f"{url.rstrip('/')}/?indices=1", headers={"User-Agent": "MirParityGate/1.0"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


NAVER_CODES = {"^KS11": "KOSPI", "^KQ11": "KOSDAQ"}


def fetch_live_sessions() -> dict[str, dict]:
    """네이버 지수 API 의 현재 세션(거래 시각·장 상태). 실패한 지수는 빠진다."""
    out: dict[str, dict] = {}
    for symbol, code in NAVER_CODES.items():
        try:
            req = urllib.request.Request(
                f"https://m.stock.naver.com/api/index/{code}/basic",
                headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json",
                         "Referer": "https://m.stock.naver.com/"},
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
        except Exception as exc:
            print(f"::warning::{symbol} 네이버 세션 확인 실패: {exc}")
            continue
        out[symbol] = {"tradedAt": payload.get("localTradedAt"), "marketStatus": payload.get("marketStatus")}
    return out


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
    live = fetch_live_sessions()
    ok, messages = compare(payload.get("indices") or [], snapshot.get("indices") or [], live)
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
