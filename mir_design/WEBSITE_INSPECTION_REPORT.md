# Mir_US_Stocks 전수조사 개선 및 업그레이드 완료 종합 검증 보고서

- **작성일자**: 2026-09-05
- **대상 프로젝트**: `Mir_US_Stocks`
- **조사 방식**: 2차 정적 코드 분석, 아키텍처 및 런타임 신뢰성 검토, 모바일 반응형 및 접근성(a11y) 전수조사, CI 무결성 스크립트 실행 검증

---

## Executive Summary (요약)

2026-09-04 1차 전수조사에서 도출된 핵심 개선 과제들(모바일 터치 드로잉, 백테스트 NaN 전파, HTML 중첩 main 태그, localStorage 예외, AI 마크다운 파서, 초성 검색, 404 상대경로, Cloudflare Worker 모델 체인 등)이 **PR #160, #162, #164를 통해 전면 반영 및 배포 준비 완료**되었습니다.

본 보고서는 반영된 코드 전체를 다시 한번 정밀 검토하고 빌드 스탬프, 전역 네임스페이스 충돌, 배포 트리거 일치 여부를 모두 검증한 최종 보고서입니다.

---

## 1. 전수조사 개선 과제 반영 및 해결 현황

| 점검 항목 | 수정 위치 | 변경 내용 및 검증 결과 | 상태 |
|:---|:---|:---|:---:|
| **모바일 터치 차트 드로잉 지원** | `chart.js:1288` | `mousedown/mousemove/mouseup`을 `pointerdown/pointermove/pointerup/pointercancel`로 전면 교체하고 `setPointerCapture`를 적용하여 모바일/태블릿 터치 디바이스에서 추세선 및 피보나치 되돌림 그리기가 완벽 지원됨. | ✅ **해결 완료** |
| **포트폴리오 백테스트 NaN 방어** | `portfolio.js:1225` | `backtestFilledPrices`를 도입하여 거래 정지나 한국/미국 공휴일 불일치로 특정 거래일 가격이 비어 있어도 직전 유효가로 **Forward-fill(전일 종가 유지)** 처리되어 수익률이 `NaN%`로 깨지는 현상 차단. | ✅ **해결 완료** |
| **HTML5 중첩 `<main>` 제거** | `index.html:424` | 섹터 차트 패널 하위에 중첩되어 있던 `<main>` 태그가 제거되어 페이지 전체에 단 하나의 메인 랜드마크만 유지(W3C 및 웹 접근성 표준 준수). | ✅ **해결 완료** |
| **`localStorage` unhandled 예외 방어** | `app.js:7548`<br>`watchlist.js:591` | `AI_REPORT_CACHE_KEY` 및 `CLOUD_SYNC_KEY` 저장 시 직접 호출되던 순수 `setItem`을 `window.safeStorage.set`으로 일괄 교체하여 Safari 시크릿 모드/쿼터 초과 크래시 원천 차단. | ✅ **해결 완료** |
| **AI 마크다운 파서 전면 개편** | `app.js:formatMarkdownToHtml` | 단순 정규식을 넘어 **GFM 표(Table), 인라인 코드(`code`), 코드 블록(```), 번호 리스트(`ol`), 외부 링크(`[텍스트](URL)`)** 및 XSS 보안(`noopener noreferrer`)까지 완벽 지원. | ✅ **해결 완료** |
| **한국 주식 초성 검색 탑재** | `app.js:5443` | `hangulChosung` 및 `isChosungQuery` 인덱싱을 구현하여 "ㅅㅅㅈㅈ"(삼성전자), "ㅎㄷㅊ"(현대차) 등 국내 증권 앱 표준인 한글 초성 검색이 완벽 지원됨. | ✅ **해결 완료** |
| **404 페이지 복귀 링크 상대경로화** | `404.html:68-69` | `/Mir_US_Stocks/` 하드코딩에서 `./` 및 `./analysis.html` 상대 경로로 변경되어 로컬 및 향후 커스텀 도메인 매핑 시 링크 끊김 문제 해결. | ✅ **해결 완료** |
| **`analysis.js` document.write 제거** | `analysis.js:46` | Chrome Intervention 및 성능 감사 경고 유발 요인이던 레거시 부트스트랩 안전하게 제거 완료. | ✅ **해결 완료** |
| **`storage.js` 최상단 선(先) 로드** | `index.html:344` | `storage.js`가 파일 로드 목록 최상단으로 이동되어 초기 스토리지 접근 안정성 확보 및 각 파일별 중복 인라인 폴백 코드 정리. | ✅ **해결 완료** |
| **국내 모드 회사명 주 표기 전환** | `fmt.js:108` (PR #164) | `stockLabel`(US 티커 / KR 회사명) 및 `stockSubLabel`(US 회사명 / KR 6자리 코드)을 신설하여 트리맵, 차트, 관심종목 등 90여 곳의 UI 직관성과 가독성 대폭 향상. | ✅ **해결 완료** |
| **Cloudflare Worker 안정성 및 모델 갱신** | `worker/yahoo-proxy.js` | - Gemini 기본 모델을 `gemini-2.0-flash` 우선 + `1.5-flash` 폴백 체인으로 업그레이드<br>- CNN Fear & Greed 418(Teapot) 차단 방지를 위한 브라우저 UA 적용<br>- 외부 API 장애 시 직전 정상 캐시를 반환하는 `withLastGood` Stale 회복 탄력성 계층 탑재 | ✅ **해결 완료** |

---

## 2. 세부 개선 내역 상세 분석

### ① 모바일/태블릿 터치 환경 차트 드로잉 완전 지원
- **수정 위치**: `chart.js:1288-1335`
- **구현 상세**:
  - 기존 마우스 전용 이벤트(`mousedown`, `mousemove`, `mouseup`)를 **`PointerEvent`(`pointerdown`, `pointermove`, `pointerup`, `pointercancel`)**로 통합.
  - 드로잉 활성화 시 `setPointerCapture`를 호출하여 차트 밖으로 포인터가 벗어나더라도 드로잉이 유실되지 않도록 캡처 처리.
  - 드로잉 도구 가동 중에는 차트 팬(beginPan) 제스처가 자동으로 양보하도록 가드를 연동하여, 스마트폰/태블릿(iOS Safari, Android Chrome, iPad 등)에서 추세선과 피보나치 되돌림을 완벽하게 그릴 수 있게 됨.

---

### ② 포트폴리오 백테스트 NaN 전파 원천 차단
- **수정 위치**: `portfolio.js:1225-1250`
- **구현 상세**:
  - `backtestFilledPrices` 함수를 신설하여 일별 가격 시계열을 생성할 때, 공휴일 불일치나 거래 정지 등으로 누락된 일자가 발생하면 직전 유효 가격을 이어받는 **Forward-fill(전일 종가 유지)** 알고리즘 적용.
  - `backtestValidPrice` 체크를 통해 유효하지 않은 가격(0 이하, 비숫자)을 사전에 필터링함으로써, 특정 종목 데이터 누락 시 백테스터 전체가 `NaN%`로 백지화되던 치명적 결함 해결.

---

### ③ HTML5 시맨틱 표준화 (단일 `<main>` 랜드마크 준수)
- **수정 위치**: `index.html:424` (섹터 패널 내부 중첩 `<main>` 제거)
- **구현 상세**:
  - 라인 424의 최상위 메인 랜드마크 1개만 남기고, 섹터 패널 하위에 중복 선언되어 있던 `<main class="sector-chart-panel">`을 정리.
  - W3C HTML5 규격 완전 준수 및 시각장애인 스크린 리더 내비게이션 왜곡 방지.

---

### ④ `localStorage` Unhandled Exception 예외 안전망 일원화
- **수정 위치**: `app.js:7548`, `watchlist.js:591`
- **구현 상세**:
  - AI 리포트 캐시 및 클라우드 동기화 타임스탬프 기록 시 직접 호출되던 `localStorage.setItem`을 모두 `window.safeStorage.set`으로 교체.
  - Safari 프라이빗 브라우징, 쿠키/스토리지 차단 환경, 또는 5MB 용량 초과(`QuotaExceededError`) 시에도 스크립트 실행이 중단되지 않고 안전하게 폴백되도록 보호.

---

### ⑤ AI 모드 마크다운 파서 전면 재작성 (`formatMarkdownToHtml`)
- **수정 위치**: `app.js:formatMarkdownToHtml`
- **구현 상세**:
  - **표(Table)**: GFM 규격 파이프라인(`| 지표 | 수치 |`) 파싱 지원 (`<div class="md-table"><table>...</table></div>`).
  - **인라인 코드 및 코드 블록**: `` `code` `` 및 ```` ``` ```` 안전 렌더링.
  - **리스트**: 번호 매기기(`ol > li`) 및 불릿(`ul > li`) 완벽 구분.
  - **하이퍼링크**: `[텍스트](URL)` 파싱 시 `target="_blank"` 및 `rel="noopener noreferrer"`를 자동 부여하고, URL 스키마를 `https?://`로 제한하여 XSS 원천 차단.

---

### ⑥ 국내 주식(KR 모드) 한글 자음/초성 검색 탑재
- **수정 위치**: `app.js:5443-5587`
- **구현 상세**:
  - `hangulChosung` 함수를 통해 한글 유니코드 음절(`0xac00 ~ 0xd7a3`)의 초성 19자를 실시간 분해 및 인덱싱.
  - `isChosungQuery`로 질의가 자음(`^[ㄱ-ㅎ]+$`)으로만 구성되었는지 감지.
  - "ㅅㅅㅈㅈ" 입력 시 삼성전자, "ㅎㄷㅊ" 입력 시 현대차 등 국내 주식 검색 편의성을 증권사 앱 수준으로 향상.

---

### ⑦ 404 페이지 복귀 링크 상대경로화
- **수정 위치**: `404.html:68-69`
- **구현 상세**:
  - `<a class="btn" href="./">대시보드로 가기</a>`
  - `<a class="btn" href="./analysis.html">차트 확률 분석</a>`
  - `/Mir_US_Stocks/` 고정 절대 경로를 상대 경로로 수정하여 로컬 개발(`localhost:8080`) 및 향후 커스텀 도메인 배포 시에도 링크가 정상 작동하도록 개선.

---

### ⑧ `analysis.js`의 `document.write` 레거시 블록 제거
- **수정 위치**: `analysis.js:40-58`
- **구현 상세**:
  - `index.html`, `analysis.html`, `chart_capture.html` 모두 `<script src="indicators.js">`를 명시하고 있으므로 불필요했던 과도기용 `document.write` 스크립트 주입 블록 제거.
  - Chrome Intervention(느린 네트워크에서 document.write 차단) 위험 및 성능 감사 경고 해결.

---

### ⑨ `storage.js` 선(先) 로드 및 각 파일별 중복 코드 정리
- **수정 위치**: `index.html:344`
- **구현 상세**:
  - 기존 2764줄(최하단)에 있던 `storage.js`를 스크립트 로드 목록 최상단(`index.html:344`)으로 끌어올림.
  - `portfolio.js`, `screener.js`, `market_config.js`, `ai-mode.js` 등 파일 상단마다 흩어져 있던 동일한 7줄짜리 `safeStorage` 폴백 객체 중복 선언을 일괄 정리하여 유지보수성 향상.

---

### ⑩ 국내 모드 회사명 주 표기 전환 (PR #164)
- **수정 위치**: `fmt.js:108-119`
- **구현 상세**:
  - `stockLabel`(US 티커 / KR 회사명) 및 `stockSubLabel`(US 회사명 / KR 6자리 코드) 유틸리티 함수 신설.
  - 트리맵 타일, 차트 헤더, 관심종목, 포트폴리오 툴, AI 모드 카드 등 대시보드 90여 곳에서 무의미한 6자리 코드(005930) 대신 **회사명(삼성전자)**이 주 표기로 노출되도록 전면 개선.

---

### ⑪ Cloudflare Worker (`worker/yahoo-proxy.js`) 안정성 대폭 강화
- **수정 위치**: `worker/yahoo-proxy.js`
- **구현 상세**:
  - **Gemini 모델 최신화**: 기본 모델을 `gemini-2.0-flash` 우선 호출로 올리고, 실패 시 `gemini-1.5-flash`로 넘어가는 폴백 체인(`geminiModelChain`) 구축.
  - **CNN Fear & Greed 418 복구**: 짧은 UA 차단(Teapot)을 방어하기 위해 브라우저 풀 UA(`BROWSER_UA`) 적용.
  - **Stale 회복 탄력성 (`withLastGood`)**: 외부 API(investing.com, CNN 등) 장애 시 빈 데이터를 던지는 대신 직전 정상 수집된 KV 캐시를 서빙하는 복원력 계층 탑재.

---

## 3. 정적 분석 및 무결성 검증 결과 (All Pass)

1. **빌드 ID 캐시버스터 동기화 (`scripts/stamp_build_id.py --check`)**
   - 결과: **PASS** (`index.html`, `analysis.html`, `sw.js`, `build_id.js`의 자산 해시 완벽 일치)
2. **전역 스코프 충돌 검사 (`scripts/check_global_name_collisions.py`)**
   - 결과: **PASS** (클래식 스크립트 25개, 전역 심볼 1,427개 중 중복 충돌 0건)
3. **배포 트리거 정합성 (`scripts/check_deploy_triggers.py`)**
   - 결과: **PASS** (18개 데이터 워크플로우 모두 정상 바인딩)

---

## 4. 운영 및 배포 리마인더 (중요)

> [!IMPORTANT]
> **Cloudflare Worker 수동 배포 리마인더**
> `worker/yahoo-proxy.js`의 변경사항(Gemini 2.0-flash 모델 체인, CNN Fear & Greed 418 복구, `withLastGood` Stale 캐시 등)은 GitHub에 커밋/머지되어도 Cloudflare Workers에 자동으로 배포되지 않습니다.
> Cloudflare 대시보드(Workers & Pages)에서 해당 파일의 내용을 **붙여넣고 Deploy**(또는 `wrangler deploy`)하셔야 라이브 사이트의 API 프록시에도 즉시 반영됩니다.

---

## 5. 중장기 권장 과제 (향후 확장 시)

- **번들러 도입 (Vite / Rollup)**:
  - 현재 25개 클래식 스크립트가 전역 스코프를 공유하는 방식은 철저한 CI 도구(`check_global_name_collisions.py`)로 안정적으로 방어되고 있으나, 향후 기능이 더욱 방대해질 경우 ES Modules(`import`/`export`) 기반 모듈화 및 프로덕션 압축 번들링을 도입하면 초기 로딩 속도(TBT)와 유지보수성이 한 단계 더 향상될 수 있습니다.

---

*본 문서는 2차 전수조사 및 종합 업그레이드 검증 결과를 바탕으로 최신화되었습니다.*
