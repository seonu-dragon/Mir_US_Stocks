"""KR 22:00 백업(daily-korea-market-snapshot.yml)이 무엇을 다시 돌릴지 정한다.

    python3 scripts/kr_backup_plan.py --guarded   # 예약 슬롯(mir-cron) — 데이터셋별 신선도로 판정
    python3 scripts/kr_backup_plan.py             # 손 실행 — 가드 없이 전부 실행

2026-10-23: 예전 가드는 스냅샷 updatedAtKst 가 오늘이면 **모든** 스텝을 건너뛰었다. 15:42 본선
(korea-close-briefing)에서 스냅샷은 성공하고 종목 수급·증시자금·시장 폭(각자 continue-on-error)만 실패한 날에도
백업이 아무것도 안 해, 그 데이터셋들은 다음 날 본선까지 하루 넘게 비었다. 이제 데이터셋마다 자기 updatedAtKst 를
보고 오늘(KST) 것이 아닌 것만 다시 돈다. 스냅샷을 다시 받으면 그 뒤 빌더(종목 목록을 스냅샷에서 읽는다)도 함께 돈다.

GitHub Actions 출력(GITHUB_OUTPUT): snapshot·flow·funds·breadth·any = true|false (true = 실행).
러너 시스템 python3 로 setup-python 전에 돌므로 표준 라이브러리만 쓴다.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KST = timezone(timedelta(hours=9))

# 이름 → 파일. 빌더는 실패하면 기존 파일을 유지하므로(스탬프가 안 바뀜) 날짜만 보면 '오늘 성공했나'를 안다.
DATASETS = {
    "snapshot": "data/korea/market_snapshot.json",
    "flow": "data/korea/investor_flow.json",      # build_kr_investor_flow.py
    "funds": "data/korea/market_funds.json",      # build_kr_market_funds.py
    "breadth": "data/korea/market_breadth.json",  # build_market_breadth.py --market kr
}


def read_stamp(path: Path) -> str:
    try:
        return str(json.loads(path.read_text(encoding="utf-8")).get("updatedAtKst") or "")[:10]
    except Exception:
        return ""


def plan(stamps: dict[str, str], today: str, guarded: bool) -> dict[str, bool]:
    """데이터셋별 실행 여부. guarded=False(손 실행)면 전부 실행."""
    if not guarded:
        run = {name: True for name in DATASETS}
    else:
        snapshot = stamps.get("snapshot", "") != today
        run = {"snapshot": snapshot}
        for name in DATASETS:
            if name != "snapshot":
                run[name] = snapshot or stamps.get(name, "") != today
    run["any"] = any(run[name] for name in DATASETS)
    return run


def main() -> int:
    ap = argparse.ArgumentParser(description="KR 백업 실행 계획")
    ap.add_argument("--guarded", action="store_true", help="예약 슬롯 — 오늘 이미 갱신된 데이터셋은 건너뛴다")
    args = ap.parse_args()
    today = datetime.now(KST).strftime("%Y-%m-%d")
    stamps = {name: read_stamp(ROOT / rel) for name, rel in DATASETS.items()}
    run = plan(stamps, today, args.guarded)
    print(f"오늘(KST) {today} · {'가드 적용(예약 슬롯)' if args.guarded else '손 실행 — 가드 없음'}")
    for name, rel in DATASETS.items():
        print(f"  {name:8s} {rel}: {stamps[name] or '-'} → {'실행' if run[name] else '오늘 갱신됨 · 건너뜀'}")
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a", encoding="utf-8") as fh:
            for name, value in run.items():
                print(f"{name}={'true' if value else 'false'}", file=fh)
    return 0


if __name__ == "__main__":
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    raise SystemExit(main())
