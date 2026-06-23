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
