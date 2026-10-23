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
    py scripts/check_data_freshness.py --group 13f-holders     # 13f-quarterly-refresh.yml institutional-holders 잡
    py scripts/check_data_freshness.py --group white-house     # white-house-schedule.yml 말미
    py scripts/check_data_freshness.py --group macro-odds      # macro-odds.yml 말미
    py scripts/check_data_freshness.py --group earnings-move   # daily-earnings-calendar.yml 말미
    py scripts/check_data_freshness.py --group earnings-releases  # material-events.yml 말미
    py scripts/check_data_freshness.py --group kr-valuation-band  # kr-valuation-band.yml 말미
    py scripts/check_data_freshness.py --group event-study        # event-study.yml 말미
    py scripts/check_data_freshness.py --group moment-news        # moment-news.yml 말미
    py scripts/check_data_freshness.py --group financials         # weekly-earnings-history.yml financials 잡
    py scripts/check_data_freshness.py --group crisis-history  # crisis-history.yml 말미
    py scripts/check_data_freshness.py --group screener-backtest  # screener-backtest-panel.yml 말미
    py scripts/check_data_freshness.py --group market-indicators  # market-indicators.yml 말미
    py scripts/check_data_freshness.py --group vix-term           # market-indicators.yml VIX 기간구조 스텝
    py scripts/check_data_freshness.py --group analyst-revisions  # daily-earnings-calendar.yml 애널리스트 스텝
    py scripts/check_data_freshness.py --group dividend-growth    # company-info.yml dividends 잡
    py scripts/check_data_freshness.py --group market-calendar    # market-calendar.yml 말미
    py scripts/check_data_freshness.py --group etf-holdings       # market-calendar.yml etf 잡
    py scripts/check_data_freshness.py --group company-logos      # company-info.yml logos 잡
    py scripts/check_data_freshness.py --group kr-themes          # company-info.yml themes 잡
    py scripts/check_data_freshness.py --group kr-fin-safety      # company-info.yml safety 잡
    py scripts/check_data_freshness.py --group kr-etf-holdings    # kr-valuation-band.yml etf 잡

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
        # 시장 폭 추이(build_market_breadth.py, 스냅샷 직후 continue-on-error 스텝). 0일(count 0)도 잡는다.
        ("data/market_breadth.json", 4, True),
        # 종목별 기술적 신호(같은 빌더가 함께 쓴다 — RS 등급·RS선 신고가·교차). 0종목도 잡는다.
        ("data/tech_signals.json", 4, True),
        # 오늘의 이슈(build_market_issues.py) — 이슈 0개가 정상인 날이 있어 0건은 보지 않는다.
        ("data/market_issues.json", 4, False),
        ("data/earnings_calendar.json", 5, False),
        ("data/options_stats.json", 4, False),
        # 옵션 포지션(build_options_flow.py, 스냅샷 뒤 continue-on-error 스텝). 0종목(count)도 잡는다.
        ("data/options_flow.json", 4, True),
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
        # 서학개미 TOP(SEIBro) — US 스냅샷 잡이 매일 다시 쓴다. 연휴 감안 6일. 0건 = 소스 이상.
        ("data/seohak_top.json", 6, True),
        # 오늘의 특징주 — 거래일에만 새로 쓴다(같은 거래일 재실행은 건너뜀). 연휴 감안 6일.
        ("data/movers_reasons.json", 6, False),
        # 신호 성적표 — US·KR 워크플로우가 매일 다시 집계한다(기록할 신호가 없어도 갱신).
        ("data/signal_scorecard.json", 4, False),
        ("data/sentiment_gauges.json", 6, False),
        # 국내↔미국 연관 종목 — US·KR 워크플로우가 매일 다시 만든다(주말에도 KR 브리핑이 돈다). 0건 = 이상.
        ("data/cross_market_links.json", 4, True),
    ],
    "kr": [
        ("data/korea/market_snapshot.json", 2, False),
        ("data/korea/market_breadth.json", 4, True),
        ("data/korea/tech_signals.json", 4, True),
        ("data/korea/market_issues.json", 4, False),
        ("data/kr_disclosures.json", 4, False),
        ("data/korea/pattern_stats.json", 10, False),
        # 돌파 연속성/되돌림 통계(build_breakout_retest.py --market kr, korea-close-briefing 의 continue-on-error 스텝).
        # 커밋된 국내 일봉만 읽어 매 실행 다시 쓴다 — 매일 도는 잡이라 4일 = 연속 실패. 표본 수는 MIN_CHECKS 가 본다.
        ("data/korea/breakout_retest_stats.json", 4, False),
        ("data/korea/investor_flow.json", 5, False),
        # 증시자금·시장 투자자별(build_kr_market_funds.py). 실행마다 updatedAtKst 를 새로 쓴다
        # (소스가 둘 다 죽으면 안 씀). 연휴 감안 6일. 0건(count=증시자금 일수)도 잡는다.
        ("data/korea/market_funds.json", 6, True),
        # 오늘의 특징주 — 거래일에만 새로 쓴다. 추석·설 연휴(최장 5~6일 휴장) 감안 7일.
        ("data/korea/movers_reasons.json", 7, False),
        ("data/signal_scorecard.json", 4, False),
        # 배당·수주는 DART 키 누락 시 count=0 으로 신선하게 갱신되는 함정이
        # 있었다(2026-07-22) — 나이만이 아니라 0건도 잡는다.
        ("data/korea/dividends.json", 8, True),
        ("data/korea/contracts.json", 8, True),
        # 컨센서스는 FnGuide/네이버 스크랩이라 소스가 바뀌면 조용히 0건이 될 수 있다.
        # 다만 빌더가 0건이면 기존 파일을 덮지 않으므로 실제로는 나이 쪽이 먼저 운다.
        ("data/korea/consensus.json", 5, True),
        # 증권사 목표가 상향·하향(build_kr_target_changes.py) — 실행마다 updatedAtKst 를 새로 쓴다. 연휴 감안 7일.
        ("data/korea/target_changes.json", 7, False),
        ("data/korea/ecos_macro.json", 6, False),
        # 나라장터·관세청(data.go.kr) — 이 그룹(korea-close-briefing 15:42 매일 + 백업 22:00 평일)이 매 실행 다시
        # 쓰고, 실패하면 exit 1 + 기존 파일 유지라 나이로만 드러난다. 예전 8일은 해외 러너에서 공공데이터포털이
        # 막혀 매일 죽어도 일주일 넘게 조용했다(2026-10-23 외부 리뷰). 매일 도는 잡이라 3일 = 두 번 연속 실패 + 여유.
        ("data/korea/gov_contracts.json", 3, False),
        ("data/korea/trade_exports.json", 3, False),
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
        ("data/cross_market_links.json", 4, True),
    ],
    # kr-disclosures.yml(평일 15:30) — 세 빌더 모두 continue-on-error 라 DART 키가
    # 죽어도 초록이었다. 주말·연휴를 감안해 4~5일.
    "kr-dart": [
        ("data/kr_disclosures.json", 4, False),
        ("data/kr_ownership.json", 5, False),
        ("data/kr_event_details.json", 5, False),
        # 미상환 CB·BW(build_kr_cb_overhang.py) — 새 정기보고서가 없어도 실행마다 updatedAtKst 를 새로 쓴다.
        ("data/korea/cb_overhang.json", 5, True),
        # 대량보유자 역검색·상장 지분 시가 — 실행마다 updatedAtKst 를 새로 쓴다(새 공시·보고서가 없어도).
        ("data/korea/major_holders.json", 5, True),
        ("data/korea/stake_value.json", 5, True),
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
        # 국민연금 보유(연말 기준, 연 1회 공개)·공정위 기업집단(5/1 지정, 연 1회)은 원천이 1년에 한 번 바뀐다.
        # 6일이면 주간 실행이 공공데이터포털 간헐 타임아웃으로 한 번만 실패해도(2026-10-17 둘 다 timed out)
        # 바로 신선도 실패·감시 경보가 됐다 — 값은 그대로인데. 주간 2회 연속 실패(14일 + 여유 1일)부터 운다.
        # data_health_core.freshness_max_hours 가 이 값을 그대로 읽는다(신뢰도 센터엔 이 둘의 프로필이 없다).
        ("data/korea/nps_holdings.json", 15, True),
        ("data/korea/corp_groups.json", 15, False),
        ("data/us_financials_history.json", 6, True),
        # 은행 건전성(build_fdic_banks.py, us-and-public 잡). 실행마다 updatedAtKst 를 새로 쓴다. 0곳(count)도 잡는다.
        ("data/fdic_banks.json", 6, True),
        # 사업부문·지역·제품별 매출(build_segments_us.py, segments 잡). 새 공시가 없어도 실행마다 인덱스
        # updatedAtKst 를 새로 쓴다. 0종목(count)도 잡는다.
        ("data/segments_index.json", 6, True),
        # 10-K 위험요인 변화(build_risk_factor_changes.py, risk-factors 잡). 새 공시가 없어도 실행마다 인덱스
        # updatedAtKst 를 새로 쓴다. 0종목(count)도 잡는다.
        ("data/risk_factors/index.json", 6, True),
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
        # Form 144 매도 예정(build_form144.py, insider-trades.yml 의 다음 스텝). 추적 상위 1000종목이면
        # 하루 수십 건이 나와 45일 보관분이 0건일 수 없다 — 0건(count)도 잡는다.
        ("data/form144.json", 4, True),
        # 의회 공시는 제출이 몰려 빈 날이 있지만 tradeCount 는 5년 누적이라
        # 0 이면 소스가 깨진 것이다.
        ("data/congress_trades.json", 8, True),
        ("data/material_events.json", 4, False),
        ("data/activist_stakes.json", 10, False),  # 13D/G 는 원래 드물다
    ],
    # short-interest.yml(화·금). 격주 공시라 나이는 넉넉히, 대신 0건은 잡는다.
    "short-interest": [
        ("data/short_interest.json", 10, True),
        # 다크풀(ATS) 주간 비중(FINRA, 같은 워크플로우의 continue-on-error 스텝, 화·금). 주 1회 공개라 8일.
        ("data/finra_ats.json", 8, True),
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
    # 13f-quarterly-refresh.yml institutional-holders 잡 — 분기 데이터셋(3개월 창)이 나올 때만 새로 쓰고
    # 새 창이 없으면 파일을 건드리지 않는다. 창 간격 ~92일 + 공개 지연 ~2주 + 확인 크론 간격 → 130일.
    "13f-holders": [
        ("data/institutional_holders/index.json", 130, True),
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
    # daily-earnings-calendar.yml 의 애널리스트 스텝(build_us_analyst_revisions.py, 매일 06:30 KST). 실행마다
    # updatedAtKst 를 새로 쓴다. 추정치 0종목 = 소스 이상(빌더가 50 미만이면 쓰지 않지만 나이로도 잡는다).
    "analyst-revisions": [
        ("data/us_estimate_revisions.json", 4, True),
        ("data/us_rating_changes.json", 4, False),
    ],
    # material-events.yml(매일 13:23 KST) 의 보도자료 요약 스텝. 새 2.02 가 없어도 실행마다
    # 타임스탬프를 올리므로 나이가 늙으면 빌더(키·Gemini·SEC)가 죽은 것이다.
    # weekly-earnings-history.yml 의 financials 잡(일요일 03:02 KST). 재무 확장 인덱스는 실행마다
    # 타임스탬프를 새로 쓴다(새 공시가 없어도). 주 1회라 한 번 실패를 바로 잡도록 8일.
    "financials": [
        ("data/financials_index.json", 8, True),
        ("data/korea/financials_index.json", 8, True),
        # 역DCF 기저율 — 같은 잡 끝에서 실행마다 다시 쓴다.
        ("data/dcf_base_rates.json", 8, True),
        # US PER·PBR·PSR 밴드(build_us_valuation_band.py) — 같은 잡의 다음 스텝. 파일만 읽어 매번
        # 전체를 다시 쓰므로 실행마다 updatedAtKst 가 오른다. 0종목(count)도 잡는다.
        ("data/valuation_band/meta.json", 8, True),
        # 재무 위험 점검 집계(build_risk_check.mjs) — 같은 잡 끝에서 실행마다 전체를 다시 쓴다(count 로 0종목도 잡는다).
        ("data/risk_check.json", 8, True),
        ("data/korea/risk_check.json", 8, True),
    ],
    "earnings-releases": [
        ("data/earnings_releases.json", 4, False),
        # 회사 KPI 누적(같은 빌더, 2026-10-22). KPI 를 밝힌 보도자료가 없는 날도 파일 시각은 갱신된다.
        ("data/company_kpis.json", 4, False),
    ],
    # kr-valuation-band.yml(매주 토요일). 새 달이 없어도 실행마다 메타 updatedAtKst 를 올린다 —
    # 12일이면 두 번 연속 실패. 0건(count)도 잡는다(KRX 로그인 만료 시 전량 실패).
    "kr-valuation-band": [
        ("data/korea/valuation_band/meta.json", 12, True),
    ],
    # event-study.yml(매주 일요일). 실행마다 index updatedAtKst 를 새로 쓴다 — 10일이면 한 번 놓친 것.
    # 0건(count)도 잡는다(가격·아카이브를 못 읽으면 표본이 0).
    "event-study": [
        ("data/event_study/index.json", 10, True),
    ],
    # moment-news.yml(매일 12:40 KST) — 큰 등락일 그날 뉴스 미리 모으기. 3일이면 두 번 연속 실패. 건수는 보지 않는다
    # (새 큰 등락일이 없는 날은 검색 0건이 정상). 나이는 updatedAtKst 가 아니라 lastSearchAtKst 로 잰다(STAMP_KEY_OF).
    "moment-news": [
        ("data/moment_news/index.json", 3, False),
    ],
    # crisis-history.yml(매월 1일). 과거 구간이라 내용은 고정이지만 실행마다 updatedAtKst 와
    # 대리 지수 최근 3년(β 추정용)을 새로 쓴다 — 40일이면 한 번 실패, 0건(count)도 잡는다.
    "crisis-history": [
        ("data/crisis_history.json", 40, True),
    ],
    # screener-backtest-panel.yml(일요일 05:40 KST) — 수식 스크리너 과거 백테스트 패널. 주간이라 10일.
    # 빌더가 유니버스 200종목·월말 24개 미만이면 쓰지 않고 exit 1 이라 건수 대신 나이만 본다.
    # market-indicators.yml(평일 하루 2회). 금요일 오후 실행 뒤 월요일 아침까지 약 2.6일이 정상이라 4일.
    # 0건(count)도 잡는다 — 전부 실패하면 빌더가 파일을 안 쓰므로 나이로 드러난다.
    "market-indicators": [
        ("data/market_indicators.json", 4, True),
    ],
    # market-indicators.yml 의 VIX 기간구조 스텝(평일 하루 2회). 곡선 점 0개(count) = 소스 이상.
    "vix-term": [
        ("data/vix_term_structure.json", 4, True),
    ],
    # company-info.yml dividends 잡(수요일) — 배당 성장 이력. 주 1회라 9일.
    "dividend-growth": [
        ("data/dividend_growth.json", 9, True),
        # 국내(DART 사업보고서, 같은 잡의 continue-on-error 스텝). 호출 상한으로 며칠에 나눠 채워도 updatedAtKst 는 매번 새로 쓴다.
        ("data/korea/dividend_growth.json", 9, True),
    ],
    # company-info.yml — 기업개요(수요일)·US 목표주가 범위(수·토). 인덱스 updatedAtKst 는 실행마다 새로 쓴다.
    # 기업개요는 주 1회라 한 번 실패를 바로 잡도록 8일, 목표주가는 주 2회라 5일. 0건(count)도 잡는다.
    "company-profile": [
        ("data/company_profile/index.json", 8, True),
    ],
    # company-info.yml logos 잡(수요일) — 회사 로고. 인덱스 updatedAtKst 는 실행마다 새로 쓴다. 0개면 실패.
    "company-logos": [
        ("data/logos/index.json", 8, True),
    ],
    "price-targets": [
        ("data/us_price_targets/index.json", 5, True),
    ],
    # company-info.yml themes 잡(토요일) — 국내 테마 분류. 인덱스 updatedAtKst 는 실행마다 새로 쓴다(바뀐 원문이
    # 없어도). 주 1회라 한 번 실패를 바로 잡도록 8일. 편입 0건(count)이면 실패 — 규칙·파서가 통째로 깨진 날이다.
    "kr-themes": [
        ("data/korea/themes.json", 8, True),
    ],
    # company-info.yml safety 잡(토요일) — 국내 재무 안전 묶음(DART DS002). updatedAtKst 는 실행마다 새로 쓴다.
    # 주 1회라 8일. 0사(count)면 실패 — 키·파서가 통째로 깨진 날이다.
    "kr-fin-safety": [
        ("data/korea/fin_safety.json", 8, True),
    ],
    # market-calendar.yml(매일 06:40 KST) — 휴장·만기 달력(오프라인 계산)은 0건이면 실패, 국내 실적 IR 은 비수기
    # 0건이 정상이라 나이만. ETF 구성(월 1회, etf 잡)은 40일.
    "market-calendar": [
        ("data/market_calendar.json", 3, True),
        ("data/korea/ir_schedule.json", 3, False),
        # 보호예수 해제 일정(38.co.kr, continue-on-error 스텝). 해제 일정은 늘 수십 건이라 0건이면 실패.
        ("data/korea/lockups.json", 4, True),
        # 미국 액면분할(Nasdaq, continue-on-error 스텝). 2~3주 창이라 0건인 주도 있어 나이만.
        ("data/us_splits.json", 4, False),
    ],
    "etf-holdings": [
        ("data/etf_holdings/index.json", 40, True),
        # 미국 테마(build_us_themes.py) — 같은 잡에서 ETF 보유 직후 다시 쓴다(updatedAtKst 매번 갱신). 0건이면 실패.
        ("data/us_themes.json", 40, True),
    ],
    # kr-valuation-band.yml etf 잡(매주 토요일). 실행마다 updatedAtKst 를 새로 쓴다 — 12일이면
    # 두 번 연속 실패. 0건(count)도 잡는다(KRX 로그인 만료·차단 시 전량 실패).
    "kr-etf-holdings": [
        ("data/korea/etf_holdings.json", 12, True),
    ],
    "screener-backtest": [
        ("data/screener_backtest_meta.json", 10, False),
        ("data/korea/screener_backtest_meta.json", 10, False),
        # 찾기 › 필터 목록 과거 결과(build_named_filter_stats.mjs, 같은 워크플로우). 계산된 필터 0개면 실패.
        ("data/named_filter_stats.json", 10, True),
        ("data/korea/named_filter_stats.json", 10, True),
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
        # 돌파 통계에 쓰인 종목 수(2026-10-23 첫 산출 3,137). 네이버 봉이 대량으로 야후 폴백되거나
        # 일봉이 잘리면 표본이 조용히 줄어 화면의 '과거 N건'이 얇아진다.
        (
            "data/korea/breakout_retest_stats.json",
            ("tickers_scanned",),
            1500,
            "돌파 통계 표본 종목 수",
        ),
    ],
}


US_SNAPSHOT = "data/market_snapshot.json"
# 날짜 미확인·기준일 불일치 종목 비율 상한 — 근거는 check_us_price_session 주석.
US_PRICE_DATE_MISMATCH_MAX = 0.05


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
    price_check = payload.get("priceCheck") or {}
    screener = price_check.get("screener") or {}
    screener_stale = screener.get("status") == "stale"
    screener_msg = (
        f"Nasdaq 스크리너가 전 거래일 값(표본 stale {screener.get('stale')} · "
        f"fresh {screener.get('fresh')}, 재시도 {screener.get('retries')})"
    )
    if "total" not in price_check:
        # 2026-09-26 이전 스냅샷(종목별 날짜 집계 없음): 스크리너 stale 자체가 실패.
        if screener_stale:
            problems.append(f"{US_SNAPSHOT}: {screener_msg} — 실측 이력이 없는 종목 가격이 하루 밀렸다")
        return problems, oks

    # 종목 단위 판정(2026-09-26~). 소형주도 야후 spark 의 날짜 붙은 종가를 쓰므로 스크리너
    # stale 만으로는 실패시키지 않는다 — 09-26 처럼 스크리너가 늦어도 소형주 가격은 제때일
    # 수 있다. 대신 '기준일이 아닌 날짜' + '날짜 미확인'(스크리너 폴백) 종목 비율을 본다.
    # 가격이 비슷한지가 아니라 종목마다 붙은 날짜 필드로만 판정한다(KR 지수 게이트 오탐 교훈).
    # 날짜 미확인 종목은 스크리너가 표본 대조로 fresh 로 확인된 날엔 세지 않는다.
    # 기준 5%: 09-25 정상 스냅샷의 불일치는 ~1.2%(대형주 중 거래정지·상장폐지 62 + 소형주
    # 09-24 봉 11 + spark 누락 14 / 7,241). 진짜 하루 밀림은 소형주 전체(~54%)나 전 종목
    # 단위로 오고, spark 가 막혀 폴백이 되면 미확인이 ~54% 로 뛴다 — 5%(~360종목)면
    # 평시의 4배 여유를 두고 소형주 소스의 10% 손실부터 잡는다.
    reference = expected.isoformat() if expected is not None else price_date
    total = int(price_check.get("total") or 0)
    dated = int(price_check.get("yahooDated") or 0)
    undated = int(price_check.get("undated") or 0)
    on_reference = int((price_check.get("priceDateCounts") or {}).get(reference) or 0)
    off_date = max(0, dated - on_reference)
    undated_counted = 0 if screener.get("status") == "fresh" else undated
    bad = off_date + undated_counted
    ratio = bad / total if total else 1.0
    detail = (
        f"기준일 {reference} 불일치 {off_date} · 날짜 미확인 {undated}"
        f"{'(스크리너 fresh 라 제외)' if undated and not undated_counted else ''} / 전체 {total}"
    )
    if ratio > US_PRICE_DATE_MISMATCH_MAX:
        problems.append(
            f"{US_SNAPSHOT}: 가격 날짜 불일치·미확인 {ratio:.1%} > {US_PRICE_DATE_MISMATCH_MAX:.0%} "
            f"({detail}) — 일부 미국 종목 시세가 거래일 단위로 밀렸다"
            + (f"; {screener_msg}" if screener_stale else "")
        )
    else:
        oks.append(f"OK {US_SNAPSHOT}: 가격 날짜 불일치·미확인 {ratio:.1%} ({detail})")
        if screener_stale:
            oks.append(
                f"WARN {US_SNAPSHOT}: {screener_msg} — 소형주는 야후 spark 날짜 확인 종가를 써서 실패로 보지 않음"
            )
    return problems, oks


KR_SNAPSHOT = "data/korea/market_snapshot.json"
# 일봉 원천 중 야후 비율 상한. 2026-10-23 외부 리뷰: 네이버 차트 API 가 죽으면 이력 전체가 조용히 야후로
# 바뀌는데(detail barsSource=yahoo) 게이트는 커버리지 50%·종목 수 3,000 만 봐서 그대로 초록이었다.
# 10-22 정상 스냅샷은 444/3,797 ≈ 12%(네이버가 못 준 종목 + 전환 전 이월분). 35% 면 평시의 3배 여유를 두고
# 네이버 원천의 대규모 손실을 잡는다. 값은 historyCoverage.barsSource(차트 있는 종목만 원천별로 센 것).
# 스냅샷은 그대로 발행한다(야후 봉도 실측이다) — 관문만 빨갛게 해 텔레그램으로 알린다.
KR_YAHOO_BARS_MAX = 0.35


def check_kr_bars_source(payload: dict) -> tuple[list[str], list[str]]:
    """KR 스냅샷 일봉 원천 중 야후 비율이 상한을 넘으면 문제. 반환: (문제, OK 메시지)."""
    counts = (payload.get("historyCoverage") or {}).get("barsSource")
    if not isinstance(counts, dict):
        return [f"{KR_SNAPSHOT}: historyCoverage.barsSource 없음 — 일봉 원천(네이버/야후) 비율을 셀 수 없다"], []
    naver = int(counts.get("naver") or 0)
    yahoo = int(counts.get("yahoo") or 0)
    total = naver + yahoo
    if not total:
        return [f"{KR_SNAPSHOT}: 일봉 원천 집계 0종목 — 차트 있는 종목이 없다"], []
    share = yahoo / total
    detail = f"야후 {yahoo:,} / 네이버 {naver:,} (차트 {total:,}종목)"
    if share > KR_YAHOO_BARS_MAX:
        return [
            f"{KR_SNAPSHOT}: 일봉 야후 폴백 비율 {share:.1%} > 상한 {KR_YAHOO_BARS_MAX:.0%} ({detail}) "
            "— 네이버 일봉 API(api.stock.naver.com/chart/domestic)가 대거 실패했다. 수정주가·KRX+NXT 거래량 "
            "기준이 야후로 바뀐 종목이 많다"
        ], []
    return [], [f"OK {KR_SNAPSHOT}: 일봉 야후 폴백 비율 {share:.1%} ({detail}, 상한 {KR_YAHOO_BARS_MAX:.0%})"]


def check_kr_price_session(payload: dict, now: datetime | None = None,
                           is_trading=None) -> tuple[list[str], list[str]]:
    """KR 스냅샷 종목 priceDate 가 XKRX 마지막 완료 거래일인지 — 근거는 kr_price_session.py 머리말."""
    import kr_price_session as KPS

    expected = KPS.last_completed_kr_session(now, is_trading)
    if expected is None:
        return [], [f"WARN {KR_SNAPSHOT}: XKRX 달력을 쓸 수 없다(exchange_calendars) — 가격 기준일 대조 생략"]
    problem, summary = KPS.evaluate_kr_price_session(payload.get("stocks") or [], expected)
    if problem:
        return [f"{KR_SNAPSHOT}: {problem}"], []
    return [], [f"OK {KR_SNAPSHOT}: {summary} (마지막 완료 거래일 {expected.isoformat()})"]


EARNINGS_HISTORY_META = "data/earnings_history_meta.json"
# earnings_history_store.MAX_FAILED_RATIO 와 같은 값(그 모듈은 update_data·야후 클라이언트까지 끌어와 여기서
# import 하지 않는다 — test_freshness_gate 가 두 값이 같은지 본다).
EARNINGS_HISTORY_MAX_FAILED_RATIO = 0.20


def check_earnings_history_failures(payload: dict) -> tuple[list[str], list[str]]:
    """실적 이력 meta 의 이번 실행 실패 비율.

    2026-10-23: 빌더는 실패 20% 초과면 exit 1 이지만 그 전에 meta updatedAtKst 를 새로 쓰고, 스텝이
    continue-on-error 라 잡은 초록·나이 감시도 통과였다. meta 에 남은 failed 로 관문에서 다시 본다.
    """
    failed = int(payload.get("failed") or 0)
    attempted = int(payload.get("updated") or 0) + failed
    if attempted and failed > attempted * EARNINGS_HISTORY_MAX_FAILED_RATIO:
        return [
            f"{EARNINGS_HISTORY_META}: 실적 이력 수집 실패 {failed}/{attempted}건 "
            f"({failed / attempted:.0%} > {EARNINGS_HISTORY_MAX_FAILED_RATIO:.0%}) "
            "— 스탬프는 신선하지만 야후 earningsHistory 가 대거 실패했다"
        ], []
    return [], [f"OK {EARNINGS_HISTORY_META}: 이번 실행 실패 {failed}/{attempted}건"]


# 나이를 updatedAtKst 가 아닌 다른 키로 재야 하는 파일. 2026-10-23: 큰 등락일 뉴스는 구글이 막아 검색을 하나도
# 못 한 시장이 있어도 인덱스 updatedAtKst 가 매번 오늘로 올라가 3일 신선도 시계가 계속 0 으로 돌아갔다
# (10-22 13:06 실행은 us·kr 모두 askedThisRun 0 · blocked). build_moment_news.py 가 실제로 검색한(또는 밀린
# 게 없는) 시장에만 lastSearchAtKst 를 올리고, 인덱스 최상위 값은 가장 늙은 시장의 값이다.
STAMP_KEY_OF = {
    "data/moment_news/index.json": ("lastSearchAtKst",),
}


def file_date(payload: dict, keys: tuple[str, ...] = TIMESTAMP_KEYS) -> str | None:
    for key in keys:
        value = payload.get(key)
        if isinstance(value, str):
            m = re.search(r"\d{4}-\d{2}-\d{2}", value)
            if m:
                return m.group(0)
    return None


# weekly 그룹 파일 → 그 파일을 만드는 weekly-earnings-history.yml 잡. kr-dart 재시도 슬롯(일요일 12:02)이나
# 손 실행처럼 일부 잡만 돈 run 에서 weekly-gate 가 안 돈 잡의 파일까지 보고 빨갛게 되던 것(10-14~21 매번)을 막는다.
# weekly-gate 가 건너뛴 잡을 --skip-jobs 로 넘긴다. 여기 없는 파일은 늘 본다.
WEEKLY_JOB_OF = {
    "data/earnings_history_meta.json": "us-and-public",
    "data/korea/nps_holdings.json": "us-and-public",
    "data/korea/corp_groups.json": "us-and-public",
    "data/us_financials_history.json": "us-and-public",
    "data/fdic_banks.json": "us-and-public",
    "data/korea/earnings.json": "kr-dart",
    "data/korea/indicators.json": "kr-dart",
    "data/korea/ownership_profile.json": "kr-dart",
    "data/korea/audit_opinion.json": "kr-dart",
    "data/korea/financials_history.json": "kr-dart",
    "data/segments_index.json": "segments",
    "data/risk_factors/index.json": "risk-factors",
}


def main() -> int:
    ap = argparse.ArgumentParser(description="데이터 신선도 감시")
    ap.add_argument("--group", choices=sorted(CHECKS), required=True)
    ap.add_argument("--skip-jobs", default="", help="weekly 그룹에서 이번 run 에 안 돈 잡(쉼표 구분)")
    args = ap.parse_args()
    skip_jobs = {j.strip() for j in args.skip_jobs.split(",") if j.strip()}

    today = datetime.now(KST).date()
    problems = []
    for rel, max_age, require_rows in CHECKS[args.group]:
        if args.group == "weekly" and WEEKLY_JOB_OF.get(rel) in skip_jobs:
            print(f"SKIP {rel}: 이번 run 에서 {WEEKLY_JOB_OF[rel]} 잡이 안 돌았다")
            continue
        path = ROOT / rel
        if not path.exists():
            problems.append(f"{rel}: 파일 없음")
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:
            problems.append(f"{rel}: JSON 파싱 실패 ({exc})")
            continue
        stamp_keys = STAMP_KEY_OF.get(rel, TIMESTAMP_KEYS)
        stamp = file_date(payload, stamp_keys)
        if not stamp:
            problems.append(f"{rel}: 타임스탬프 키 없음 {stamp_keys}")
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

    if args.group == "kr":
        session_checks += 2
        try:
            payload = json.loads((ROOT / KR_SNAPSHOT).read_text(encoding="utf-8"))
        except Exception as exc:
            problems.append(f"{KR_SNAPSHOT}: 가격 기준일·일봉 원천 감시용 읽기 실패 ({exc})")
        else:
            for check in (check_kr_bars_source, check_kr_price_session):
                found, oks = check(payload)
                problems.extend(found)
                for line in oks:
                    print(line)

    if args.group == "weekly" and WEEKLY_JOB_OF.get(EARNINGS_HISTORY_META) not in skip_jobs:
        session_checks += 1
        try:
            payload = json.loads((ROOT / EARNINGS_HISTORY_META).read_text(encoding="utf-8"))
        except Exception as exc:
            problems.append(f"{EARNINGS_HISTORY_META}: 실패 비율 감시용 읽기 실패 ({exc})")
        else:
            found, oks = check_earnings_history_failures(payload)
            problems.extend(found)
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
