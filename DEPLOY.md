# 웹사이트 배포 메모

이 프로젝트는 정적 사이트입니다. 서버 프로그램 없이 `index.html`, `app.js`, `styles.css`, `data/` 폴더만 올리면 동작합니다.

## 권장 구조

- `data/market_snapshot.js`: 첫 화면용 가벼운 시장 데이터
- `data/details/{TICKER}.json`: 서버/웹 배포용 종목 상세 데이터
- `data/details/{TICKER}.js`: `index.html`을 직접 여는 file:// 환경용 상세 데이터

현재 구조에서는 첫 화면이 `market_snapshot.js`만 읽고, 종목 분석을 열 때 해당 종목의 상세 파일만 추가로 불러옵니다.

## 배포 선택지

1. GitHub Pages
   - 비용이 거의 없고 정적 사이트에 적합합니다.
   - 저장소에 파일을 올린 뒤 Pages를 켜면 모바일에서도 접속할 수 있습니다.

2. Netlify / Vercel
   - 폴더를 연결하면 자동 배포됩니다.
   - 커스텀 도메인 연결도 쉽습니다.

3. 개인 PC/서버
   - `scripts/serve.ps1`로 로컬 서버를 열 수 있습니다.
   - 같은 와이파이에서 모바일 접속을 하려면 방화벽과 로컬 IP 설정이 필요합니다.

## 업데이트 방식

스케줄러를 걸면 매일 한국 시간 오전 6시에 `scripts/update_data.py`를 실행해 새 데이터를 만들 수 있습니다. 배포 사이트까지 자동 반영하려면 이후 단계에서 GitHub Actions나 서버 업로드 스크립트를 붙이면 됩니다.
