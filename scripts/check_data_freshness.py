"""데이터 신선도 감시 (check_data_freshness.py)
=================================================

소스가 죽은 빌더는 "기존 파일 유지" 후 종료하고 스텝은 continue-on-error 라서,
소스가 영구히 깨져도 Actions 는 영원히 초록이다. 사이트에서는 updatedAtKst 만
조용히 늙어간다. 이 스크립트가 마지막 관문: 각 산출물의 타임스탬프가 허용
나이를 넘으면 exit 1 로 워크플로우를 빨갛게 만든다.

사용법:
    py scripts/check_data_freshness.py --group us   # daily-market-snapshot 말미
    py scripts/check_data_freshness.py --group kr   # korea-close-briefing 말미

임계는 주말·연휴를 감안해 여유 있게 잡았다 — 여기서 울리면 진짜 문제다.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
KST = timezone(timedelta(hours=9))

TIMESTAMP_KEYS = ("updatedAtKst", "generatedAtKst", "generated", "updatedAt", "asOf")

# (상대경로, 허용 나이[일], 0건이면 실패로 볼지)
CHECKS = {
    "us": [
        ("data/market_snapshot.json", 2, False),
        ("data/earnings_calendar.json", 5, False),
        ("data/options_stats.json", 4, False),
        ("data/us_calendar.json", 4, False),
        ("data/us_finnhub_metrics.json", 4, False),
        ("data/macro_indicators.json", 7, False),
        ("data/yield_curve.json", 7, False),
        ("data/finra_short_volume.json", 7, False),
        ("data/analyst_consensus.json", 10, False),
        ("data/federal_contracts.json", 10, False),
        ("data/pattern_stats.json", 10, False),
        ("data/breakout_retest_stats.json", 12, False),
        # COT 는 주간(금요일 발표·최대 10일 시차), 경매는 주 단위 불규칙 — 여유 있게.
        ("data/cot_positioning.json", 14, False),
        ("data/treasury_auctions.json", 14, False),
        # FTD 는 반월 파일이 약 2주 지연 발행이라 정상 상태도 한 달쯤 늙어 보인다.
        ("data/sec_ftd.json", 45, False),
        ("data/wiki_attention.json", 6, False),
        ("data/wsb_sentiment.json", 6, False),
        ("data/sentiment_gauges.json", 6, False),
    ],
    "kr": [
        ("data/korea/market_snapshot.json", 2, False),
        ("data/kr_disclosures.json", 4, False),
        ("data/korea/pattern_stats.json", 10, False),
        ("data/korea/investor_flow.json", 5, False),
        # 배당·수주는 DART 키 누락 시 count=0 으로 신선하게 갱신되는 함정이
        # 있었다(2026-07-22) — 나이만이 아니라 0건도 잡는다.
        ("data/korea/dividends.json", 8, True),
        ("data/korea/contracts.json", 8, True),
        # 컨센서스는 FnGuide/네이버 스크랩이라 소스가 바뀌면 조용히 0건이 될 수 있다.
        # 다만 빌더가 0건이면 기존 파일을 덮지 않으므로 실제로는 나이 쪽이 먼저 운다.
        ("data/korea/consensus.json", 5, True),
        ("data/korea/ecos_macro.json", 6, False),
        ("data/korea/gov_contracts.json", 8, False),
        ("data/korea/trade_exports.json", 8, False),
    ],
}


def file_date(payload: dict) -> str | None:
    for key in TIMESTAMP_KEYS:
        value = payload.get(key)
        if isinstance(value, str):
            m = re.search(r"\d{4}-\d{2}-\d{2}", value)
            if m:
                return m.group(0)
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description="데이터 신선도 감시")
    ap.add_argument("--group", choices=sorted(CHECKS), required=True)
    args = ap.parse_args()

    today = datetime.now(KST).date()
    problems = []
    for rel, max_age, require_rows in CHECKS[args.group]:
        path = ROOT / rel
        if not path.exists():
            problems.append(f"{rel}: 파일 없음")
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:
            problems.append(f"{rel}: JSON 파싱 실패 ({exc})")
            continue
        stamp = file_date(payload)
        if not stamp:
            problems.append(f"{rel}: 타임스탬프 키 없음 {TIMESTAMP_KEYS}")
            continue
        age = (today - datetime.strptime(stamp, "%Y-%m-%d").date()).days
        if age > max_age:
            problems.append(f"{rel}: {stamp} ({age}일 경과 > 허용 {max_age}일)")
            continue
        if require_rows:
            count = payload.get("count")
            if count == 0:
                note = payload.get("note") or ""
                problems.append(f"{rel}: 0건 (note={note!r})")
                continue
        print(f"OK {rel}: {stamp} ({age}일)")

    if problems:
        print("\n[신선도 실패]")
        for p in problems:
            print(f"  - {p}")
        return 1
    print(f"\nOK — {args.group} 그룹 {len(CHECKS[args.group])}개 파일 모두 신선.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
