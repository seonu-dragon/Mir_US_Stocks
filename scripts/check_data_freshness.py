"""데이터 신선도 감시 (check_data_freshness.py)
=================================================

소스가 죽은 빌더는 "기존 파일 유지" 후 종료하고 스텝은 continue-on-error 라서,
소스가 영구히 깨져도 Actions 는 영원히 초록이다. 사이트에서는 updatedAtKst 만
조용히 늙어간다. 이 스크립트가 마지막 관문: 각 산출물의 타임스탬프가 허용
나이를 넘으면 exit 1 로 워크플로우를 빨갛게 만든다.

사용법:
    py scripts/check_data_freshness.py --group us       # daily-market-snapshot 말미
    py scripts/check_data_freshness.py --group kr       # korea-close-briefing 말미
    py scripts/check_data_freshness.py --group kr-dart  # kr-disclosures 말미
    py scripts/check_data_freshness.py --group weekly   # weekly-earnings-history 말미
    py scripts/check_data_freshness.py --group ipo      # ipo-calendar 말미
    py scripts/check_data_freshness.py --group sec-daily       # insider/congress/material/activist
    py scripts/check_data_freshness.py --group short-interest  # short-interest.yml 말미
    py scripts/check_data_freshness.py --group edge-stats      # weekly-edge-stats.yml 말미
    py scripts/check_data_freshness.py --group 13f             # 13f-quarterly-refresh.yml 말미
    py scripts/check_data_freshness.py --group white-house     # white-house-schedule.yml 말미
    py scripts/check_data_freshness.py --group macro-odds      # macro-odds.yml 말미
    py scripts/check_data_freshness.py --group earnings-move   # daily-earnings-calendar.yml 말미
    py scripts/check_data_freshness.py --group earnings-releases  # material-events.yml 말미

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
        # 오늘의 특징주 — 거래일에만 새로 쓴다(같은 거래일 재실행은 건너뜀). 연휴 감안 6일.
        ("data/movers_reasons.json", 6, False),
        ("data/sentiment_gauges.json", 6, False),
    ],
    "kr": [
        ("data/korea/market_snapshot.json", 2, False),
        ("data/kr_disclosures.json", 4, False),
        ("data/korea/pattern_stats.json", 10, False),
        ("data/korea/investor_flow.json", 5, False),
        # 오늘의 특징주 — 거래일에만 새로 쓴다. 추석·설 연휴(최장 5~6일 휴장) 감안 7일.
        ("data/korea/movers_reasons.json", 7, False),
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
        # 아래 5개는 update_korea_data.py 가 **서브프로세스로** 부르는 빌더의 산출물이라
        # 워크플로 YAML 에 이름이 없고, 2026-09-15 감사 전까지 어느 그룹에도 없었다.
        # KRX 로그인(KRX_ID/PW)이 만료되면 short_interest/short_volume/krx_metrics 가
        # 무기한 얼어붙는데 워크플로우는 초록이었다.
        ("data/korea/krx_metrics.json", 5, True),      # .js 짝 없음(빌드 전용 입력)
        ("data/korea/short_interest.json", 6, True),   # KRX 잔고는 T+2
        ("data/korea/short_volume.json", 6, True),     # KRX 거래비중은 T+1
        ("data/korea/ipo_calendar.json", 6, False),    # 공모 비수기엔 0건이 정상
        ("data/korea/earnings_reactions.json", 6, False),  # 실적 시즌 밖엔 0건이 정상
        # 시장경보·이상 종목(KIND + 스냅샷 일봉). 관리종목·거래정지만으로도 늘 수백 건이라 0건 = 이상.
        ("data/korea/market_alerts.json", 6, True),
    ],
    # kr-disclosures.yml(평일 15:30) — 세 빌더 모두 continue-on-error 라 DART 키가
    # 죽어도 초록이었다. 주말·연휴를 감안해 4~5일.
    "kr-dart": [
        ("data/kr_disclosures.json", 4, False),
        ("data/kr_ownership.json", 5, False),
        ("data/kr_event_details.json", 5, False),
    ],
    # weekly-earnings-history.yml(일요일 03:02 KST). 매주 같은 시각에 도니 정상이면
    # 나이 0일, 한 번 실패하면 7일 — 6일로 잡아야 실패 1회를 바로 잡는다.
    "weekly": [
        ("data/earnings_history_meta.json", 6, False),
        ("data/korea/earnings.json", 6, False),
        ("data/korea/indicators.json", 6, False),
        ("data/korea/ownership_profile.json", 6, False),
        ("data/korea/audit_opinion.json", 6, False),
        ("data/korea/financials_history.json", 6, True),
        ("data/korea/nps_holdings.json", 6, True),
        ("data/korea/corp_groups.json", 6, False),
        ("data/us_financials_history.json", 6, True),
    ],
    # ipo-calendar.yml(매일 13:33 KST) — 희석 트래커가 continue-on-error.
    "ipo": [
        ("data/ipo_calendar.json", 4, False),
        ("data/us_dilution.json", 5, False),
    ],
    # SEC 계열 일간 워크플로우 4개(04:17~04:38 UTC). 2026-09-03 감사에서 이 넷의
    # 산출물이 어느 그룹에도 없어, 소스가 죽어도 Actions 는 영원히 초록이었다.
    "sec-daily": [
        ("data/insider_trades.json", 4, False),
        # 의회 공시는 제출이 몰려 빈 날이 있지만 tradeCount 는 5년 누적이라
        # 0 이면 소스가 깨진 것이다.
        ("data/congress_trades.json", 8, True),
        ("data/material_events.json", 4, False),
        ("data/activist_stakes.json", 10, False),  # 13D/G 는 원래 드물다
    ],
    # short-interest.yml(화·금). 격주 공시라 나이는 넉넉히, 대신 0건은 잡는다.
    "short-interest": [
        ("data/short_interest.json", 10, True),
    ],
    # weekly-edge-stats.yml(일요일 04:20 KST).
    # weekly-edge-stats.yml 이 실제로 CI 에서 굽는 산출물은 breakout/retest 뿐이다.
    # sr_stats.json 은 2026-08-06 에 "엣지 없음"으로 주간 스케줄에서 뺐고(프론트 참조 0건),
    # korea/disclosure_stats.json 은 gitignore 된 로컬 아카이브를 입력으로 써 CI 에서
    # 만들 수 없다(분기 1회 수동). 둘 다 의도된 정지 상태라 감시 대상이 아니다 —
    # 넣어 두면 매주 워크플로우를 빨갛게 만들어 진짜 고장을 가린다.
    "edge-stats": [
        ("data/breakout_retest_stats.json", 10, False),
        # 스캐너 순위 기준 검증(build_factor_validation.mjs, Node). 주간 갱신.
        ("data/factor_validation.json", 10, False),
        # 확률 캘리브레이션(build_prob_calibration.py). 2026-09-03 이후 스케줄이
        # 없어 멈춰 있었고 analysis.js 가 그 파일을 계속 fetch 했다 — 주간 스텝을
        # weekly-edge-stats.yml 에 붙이면서 감시도 함께 건다.
        ("data/prob_calibration.json", 10, False),
    ],
    # 13f-quarterly-refresh.yml — 분기 공시(45일 시차)라 정상 상태도 오래 늙어 보인다.
    "13f": [
        ("data/institutional_13f.json", 120, True),
    ],
    # white-house-schedule.yml(하루 3회). 스키마가 바뀌면 0건 + 신선한 타임스탬프가
    # 푸시될 수 있어 나이만이 아니라 0건(eventCount)도 본다.
    # 산업 선행지표 — 매일 06:10 KST. 월간 시리즈가 많아 파일 갱신 시각만 본다.
    "industry": [
        ("data/industry_indicators.json", 3, False),
        ("data/industry_by_ticker.json", 3, False),
        ("data/industry_signal.json", 3, False),
    ],
    "white-house": [
        ("data/white_house_schedule.json", 3, True),
    ],
    # macro-odds.yml(하루 3회) — 예측시장 확률 + 침체 신호. Kalshi·Polymarket 이 둘 다 죽으면
    # 빌더가 기존 파일을 유지하고 exit 1 이지만, 한쪽만 죽는 날이 이어져도 나이로 잡는다.
    "macro-odds": [
        ("data/macro_odds.json", 2, True),
    ],
    # daily-earnings-calendar.yml(매일 06:30 KST) 의 실적 전 비교 스텝.
    # 다가오는 3주 안 발표가 0건인 시기는 사실상 없지만, 빌더가 0건이면 파일을 덮지 않으므로
    # 나이만 본다. 주말에도 도는 워크플로우라 4일이면 두 번 연속 실패를 뜻한다.
    "earnings-move": [
        ("data/earnings_move_compare.json", 4, False),
    ],
    # material-events.yml(매일 13:23 KST) 의 보도자료 요약 스텝. 새 2.02 가 없어도 실행마다
    # 타임스탬프를 올리므로 나이가 늙으면 빌더(키·Gemini·SEC)가 죽은 것이다.
    "earnings-releases": [
        ("data/earnings_releases.json", 4, False),
    ],
}

# require_rows 가 볼 '건수' 키. 최상위 count 만 보던 시절엔 13f(institutionCount)·
# congress(tradeCount)·whitehouse(eventCount) 가 0건이어도 통과했다(2026-09-15 감사).
COUNT_KEYS = ("count", "institutionCount", "tradeCount", "eventCount", "rowCount")

# 비율 감시: (파일, 페이로드 키 경로, 최소 비율, 설명)
# 나이만 보면 "매일 신선하게 갱신되는데 내용은 3분의 1이 비어 있는" 상태를 못 잡는다.
# 2026-09-03 실측: 국내 3,774 종목 중 1,322 개(35%)의 chartSeries 가 비어 분석 화면이
# '데이터 부족' 으로 떨어졌는데, 스냅샷 자체는 매일 갱신돼 아무 알림도 울리지 않았다.
RATIO_CHECKS = {
    "kr": [
        (
            "data/korea/market_snapshot.json",
            ("historyCoverage", "ratio"),
            0.50,
            "실측 일봉(chartSeries) 커버리지",
        ),
    ],
}

# 절대값 하한: (파일, 키 경로, 최소값, 설명)
# 비율 감시는 "전체가 같이 쪼그라든" 붕괴를 못 잡는다. 2026-09-10 에 네이버 PC HTML 이
# 사라져 국내 유니버스가 3,800 → 50(ETF 뿐)으로 무너졌을 때 ratio 는 오히려 1.0 이었고
# 나이도 신선했다. 개수 자체에 바닥을 둔다.
MIN_CHECKS = {
    "kr": [
        (
            "data/korea/market_snapshot.json",
            ("universeCount",),
            3000,
            "국내 상장 유니버스 종목 수",
        ),
    ],
}


US_SNAPSHOT = "data/market_snapshot.json"


def check_us_price_session(payload: dict, now: datetime | None = None) -> tuple[list[str], list[str]]:
    """US 스냅샷 가격이 '마지막으로 끝난 거래일' 종가인지 **날짜로** 판정한다.

    2026-09-25: updatedAtKst 는 당일(09:54 KST)로 신선했는데 가격은 전부 09-23 종가였다.
    나이 감시로는 못 잡는다 — 스냅샷의 priceDate(야후가 날짜를 붙여 준 기준일)를 NYSE
    달력의 마지막 완료 거래일과 비교한다. 가격이 비슷한지로 세션을 추정하지 않는다.
    반환: (문제 목록, OK 메시지 목록).
    """
    from us_market_calendar import last_completed_session

    problems: list[str] = []
    oks: list[str] = []
    price_date = payload.get("priceDate")
    expected = last_completed_session(now)
    if not price_date:
        problems.append(f"{US_SNAPSHOT}: priceDate 없음 — 가격 기준 거래일을 확인할 수 없다")
    elif expected is None:
        oks.append(
            f"WARN {US_SNAPSHOT}: NYSE 휴장 달력이 올해를 모른다(us_market_calendar.py) — "
            f"priceDate {price_date} 대조 생략"
        )
    elif price_date < expected.isoformat():
        problems.append(
            f"{US_SNAPSHOT}: 가격 기준일 {price_date} < 마지막 완료 거래일 {expected.isoformat()} "
            "— 미국 시세가 거래일 단위로 밀렸다"
        )
    else:
        oks.append(f"OK {US_SNAPSHOT}: 가격 기준일 {price_date} (마지막 완료 거래일 {expected.isoformat()})")
    screener = ((payload.get("priceCheck") or {}).get("screener") or {})
    if screener.get("status") == "stale":
        problems.append(
            f"{US_SNAPSHOT}: Nasdaq 스크리너가 전 거래일 값(표본 stale {screener.get('stale')} · "
            f"fresh {screener.get('fresh')}, 재시도 {screener.get('retries')}) — "
            "실측 이력이 없는 종목 가격이 하루 밀렸다"
        )
    return problems, oks


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
            counts = {
                key: payload[key] for key in COUNT_KEYS
                if isinstance(payload.get(key), int) and not isinstance(payload.get(key), bool)
            }
            if not counts:
                problems.append(f"{rel}: 건수 키 없음 {COUNT_KEYS} — 0건 감시를 할 수 없다")
                continue
            zero_keys = [key for key, value in counts.items() if value == 0]
            if zero_keys:
                note = payload.get("note") or ""
                problems.append(f"{rel}: {', '.join(zero_keys)} 0건 (note={note!r})")
                continue
        print(f"OK {rel}: {stamp} ({age}일)")

    for rel, keypath, floor, label in RATIO_CHECKS.get(args.group, []):
        path = ROOT / rel
        if not path.exists():
            problems.append(f"{rel}: 파일 없음(비율 감시 {label})")
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:
            problems.append(f"{rel}: JSON 파싱 실패 ({exc})")
            continue
        value = payload
        for key in keypath:
            value = value.get(key) if isinstance(value, dict) else None
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            problems.append(f"{rel}: {'.'.join(keypath)} 없음 — {label} 를 셀 수 없다")
            continue
        if value < floor:
            problems.append(f"{rel}: {label} {value:.1%} < 하한 {floor:.0%}")
            continue
        print(f"OK {rel}: {label} {value:.1%} (하한 {floor:.0%})")

    for rel, keypath, floor, label in MIN_CHECKS.get(args.group, []):
        path = ROOT / rel
        if not path.exists():
            problems.append(f"{rel}: 파일 없음(하한 감시 {label})")
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:
            problems.append(f"{rel}: JSON 파싱 실패 ({exc})")
            continue
        value = payload
        for key in keypath:
            value = value.get(key) if isinstance(value, dict) else None
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            problems.append(f"{rel}: {'.'.join(keypath)} 없음 — {label} 를 셀 수 없다")
            continue
        if value < floor:
            problems.append(f"{rel}: {label} {value:,} < 하한 {floor:,}")
            continue
        print(f"OK {rel}: {label} {value:,} (하한 {floor:,})")

    session_checks = 0
    if args.group == "us":
        session_checks = 1
        path = ROOT / US_SNAPSHOT
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:
            problems.append(f"{US_SNAPSHOT}: 가격 기준일 감시용 읽기 실패 ({exc})")
        else:
            session_problems, oks = check_us_price_session(payload)
            problems.extend(session_problems)
            for line in oks:
                print(line)

    if problems:
        print("\n[신선도 실패]")
        for p in problems:
            print(f"  - {p}")
        return 1
    total = (
        len(CHECKS[args.group])
        + len(RATIO_CHECKS.get(args.group, []))
        + len(MIN_CHECKS.get(args.group, []))
        + session_checks
    )
    print(f"\nOK — {args.group} 그룹 {total}개 검사 모두 통과.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
