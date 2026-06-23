# 미르의 미국 주식

미국 주식 시장을 빠르게 훑어보는 정적 대시보드입니다. 웹사이트는 저장된 `data/market_snapshot.json`만 읽고, 데이터 갱신은 별도 스크립트가 하루 한 번만 수행합니다.

## 실행

```powershell
.\scripts\serve.ps1
```

브라우저에서 엽니다.

```text
http://localhost:8080
```

## 데이터 업데이트 정책

- 웹사이트는 실시간으로 외부 데이터를 가져오지 않습니다.
- `scripts/update_data.py`가 `data/market_snapshot.json`을 갱신합니다.
- 스냅샷에는 S&P 500, Nasdaq 100, Nasdaq/NYSE 상장 보통주, 주요 ETF가 포함됩니다.
- 핵심 대형주/지수 구성 종목은 Yahoo 1년 가격 이력을 사용하고, 그 외 종목은 Nasdaq 스냅샷 가격/등락률을 기준으로 가벼운 미니차트를 생성합니다.
- 권장 갱신 시각: 한국 시간 매일 오전 6시.
- 장중 자동 새로고침은 의도적으로 넣지 않았습니다. 속도를 위해 하루 스냅샷 방식으로 동작합니다.

## Windows 작업 스케줄러 등록

PowerShell에서 실행합니다.

```powershell
.\scripts\register_daily_update.ps1
```

등록 후 매일 오전 6시에 `scripts/update_data.py`가 실행됩니다. PC가 꺼져 있으면 해당 시각 작업은 실행되지 않을 수 있습니다.

스크립트는 `py`, `python`, Codex 번들 Python 순서로 실행 파일을 찾습니다. 모두 없으면 Python을 설치한 뒤 다시 실행하면 됩니다.

## 파일 구조

- `index.html`: 웹사이트 화면
- `styles.css`: UI 스타일
- `app.js`: 대시보드 상호작용
- `data/market_snapshot.json`: 사이트가 읽는 하루 스냅샷 데이터
- `scripts/update_data.py`: 하루 1회 데이터 수집/저장 스크립트
- `scripts/register_daily_update.ps1`: Windows 작업 스케줄러 등록 스크립트
- `analysis.html` / `analysis.js`: 차트 확률 분석 페이지(티커 → 상승/하락 확률 추정)
- `scripts/pattern_lib.py`: 차트 패턴 감지 공용 라이브러리(브라우저 analysis.js 와 동일 알고리즘)
- `scripts/build_pattern_stats.py`: 전 종목 패턴 과거 성공률 집계 → `data/pattern_stats.json`
- `data/pattern_stats.json`: 패턴별·기간별 과거 상승률(차트 확률 분석 ③ 패턴 섹션이 읽음)

## 차트 패턴 통계 갱신

```powershell
py scripts/build_pattern_stats.py
```

`data/details/*.json` 전체를 스캔해 패턴 성공률을 다시 계산합니다. 가격 이력이 누적될
때만 값이 변하므로 매일 돌릴 필요는 없고, 월 1회 정도면 충분합니다(전체 스캔 수십 초).

## 지지/저항 존중률 검증 (선택)

```powershell
py scripts/build_sr_stats.py --limit 1200
```

지지/저항선이 실제로 반응을 예측하는지 과거 데이터로 검증합니다(룩어헤드 없음).
신규 강도점수 방식(NEW) vs 기존 방식(OLD) vs 무작위(RANDOM)를 같은 '존중률' 지표로
비교해 `data/sr_stats.json`에 저장합니다. 엣지가 있을 법한 변형도 함께 검증합니다:
`NEW_lowmom`(저모멘텀으로 닿은 레벨만), `STRONG_lm`(점수 1위+저모멘텀),
`RETEST`(돌파 후 되돌림으로 역할 전환된 레벨). CLI: `--react/--brk/--lowmom/--limit`.

**측정 결과(473종목·6.2만 표본): NEW가 OLD보다 일관되게 낫지만(+3%p 안팎),
어떤 방식도 무작위(RANDOM 61.8%)를 못 이깁니다.** 변형들도 마찬가지 — 저모멘텀
필터가 격차를 좁히지만(-1.8→-0.7%p) 넘지 못하고, 되돌림(RETEST)은 오히려 더
나쁩니다(56%). 즉 수평 S/R선은 차트 해석을 돕는 **시각 보조일 뿐 예측 지표가
아니며**, 확률 엔진의 신호로는 쓰지 않습니다(통계 검증된 돌파 패턴만 사용).

## 돌파 연속성 / 되돌림 검증

```powershell
py scripts/build_breakout_retest.py --limit 1500
```

`pattern_lib`의 돌파 감지(저항 돌파/지지 이탈)를 재사용해, ①돌파 직후 진입과
②되돌림(돌파선 재접촉) 후 진입의 **추세 지속률**을 시장 평균과 비교합니다
(`data/breakout_retest_stats.json`). **검증 결과: 상승 돌파는 약한 지속 우위
(+1~2%p, 되돌림 단기 진입은 +2.8%p), 하락 돌파는 오히려 반등 경향(−2%p대).**
이 통계는 차트 확률 분석의 '④ 돌파 연속성' 카드에 표시됩니다(설명용, 단기 약한 엣지).
