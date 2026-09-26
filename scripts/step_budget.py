#!/usr/bin/env python3
"""주간 빌더 공용 — 시간 예산 · 연속 실패 차단 · 이전 결과 이월.

배경(2026-09-26 측정): 주간 실적·재무 워크플로우의 earnings 잡이 한 달에 세 번(08-22·09-05·09-19)
6시간 한도로 취소됐다. 매번 `KR quarterly earnings (DART)` 스텝이 평소 1시간 걸리던 것을 5시간
넘게 붙잡았고(로그 0줄 — 파이프 stdout 버퍼링), 뒤에 줄 선 KR 지표·소유구조·감사의견·다년 재무·
국민연금·기업집단·US 다년 재무 7개 스텝이 전부 건너뛰어져 8개 파일이 09-13 에 멈췄다.
DART 가 느려지면 호출 하나가 30초 타임아웃까지 걸려 2,600회 × 30초 = 20시간이 된다.

원칙
  - 스텝마다 시간 예산(--time-budget-min). 넘으면 호출을 멈추고 받은 데까지 저장(정상 종료).
  - 연속 실패 N회면 소스가 죽은 것으로 보고 멈춘다(같은 30초를 수천 번 기다리지 않는다).
  - 이번에 못 받은 종목은 직전 파일 값을 그대로 이월한다(같은 사업연도일 때만). 빈 값으로 덮지 않는다.
  - 못 받은 종목부터 받는다(missing-first) — 잘려도 빈칸이 먼저 채워진다.

CLI: 워크플로우가 잡 시작 시각(JOB_START_EPOCH) 기준으로 남은 분을 계산할 때 쓴다.
  python scripts/step_budget.py --job-limit 300 --reserve 15 --cap 90   → 정수 분 출력
"""

from __future__ import annotations

import argparse
import os
import sys
import time


class StepBudget:
    """경과 시간 + 연속 실패 판정. now 는 테스트 주입용."""

    def __init__(self, minutes: float | None, *, max_consecutive_errors: int = 25, now=None):
        self._now = now or time.monotonic
        self.start = self._now()
        self.deadline = self.start + minutes * 60 if minutes and minutes > 0 else None
        self.minutes = minutes
        self.max_consecutive_errors = max_consecutive_errors
        self.consecutive_errors = 0
        self.reason = ""

    def elapsed_min(self) -> float:
        return (self._now() - self.start) / 60

    def record(self, ok: bool) -> None:
        """요청 하나의 성패. 응답을 받았으면(status 013 포함) ok=True."""
        self.consecutive_errors = 0 if ok else self.consecutive_errors + 1

    def over(self) -> bool:
        if self.reason:
            return True
        if self.deadline is not None and self._now() >= self.deadline:
            self.reason = f"시간 예산 {self.minutes:g}분 소진"
        elif self.max_consecutive_errors and self.consecutive_errors >= self.max_consecutive_errors:
            self.reason = f"연속 요청 실패 {self.consecutive_errors}회 — 소스 장애로 보고 중단"
        return bool(self.reason)


def missing_first(pairs: list[tuple[str, str]], have: set[str]) -> list[tuple[str, str]]:
    """(ticker, corp) 목록을 '직전 결과에 없는 종목' 먼저, 나머지는 원래 순서(시총순)로."""
    return [p for p in pairs if p[0] not in have] + [p for p in pairs if p[0] in have]


def carry_over(fresh: dict, prev: dict, attempted: set[str], universe: set[str]) -> tuple[dict, int]:
    """이번에 시도하지 못한 종목(universe − attempted)의 직전 값을 fresh 에 이월. (결과, 이월 수).

    시도했는데 값이 없었던 종목(013 등)은 이월하지 않는다 — 그건 '새로 확인한 결측'이다.
    유니버스에서 빠진 종목(상장폐지 등)도 이월하지 않는다.
    """
    out = dict(fresh)
    carried = 0
    for ticker, row in (prev or {}).items():
        if ticker in out or ticker in attempted or ticker not in universe:
            continue
        out[ticker] = row
        carried += 1
    return out, carried


def remaining_minutes(job_limit: int, reserve: int, cap: int | None, *, start_epoch: float | None,
                      now: float | None = None) -> int:
    """잡 시작 기준 남은 분 − 여유. cap 이 있으면 그 이하로. 시작 시각이 없으면 cap(없으면 job_limit − reserve)."""
    if start_epoch:
        now = time.time() if now is None else now
        left = int((start_epoch + (job_limit - reserve) * 60 - now) // 60)
    else:
        left = job_limit - reserve
    if cap:
        left = min(left, cap)
    return max(left, 0)


def main() -> int:
    ap = argparse.ArgumentParser(description="잡 남은 시간(분) 계산")
    ap.add_argument("--job-limit", type=int, required=True, help="잡 timeout-minutes")
    ap.add_argument("--reserve", type=int, default=15, help="뒤 스텝·push 여유(분)")
    ap.add_argument("--cap", type=int, default=0, help="이 스텝 최대 분(0=제한 없음)")
    args = ap.parse_args()
    start = os.environ.get("JOB_START_EPOCH", "").strip()
    print(remaining_minutes(args.job_limit, args.reserve, args.cap or None,
                            start_epoch=float(start) if start else None))
    return 0


if __name__ == "__main__":
    sys.exit(main())
