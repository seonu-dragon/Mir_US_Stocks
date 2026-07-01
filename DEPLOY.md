# 웹사이트 배포 메모

이 프로젝트는 정적 사이트입니다. 서버 프로그램 없이 `index.html`, `app.js`, `styles.css`, `data/` 폴더만 올리면 동작합니다.

## 권장 구조

- `data/market_snapshot.js`: 첫 화면용 가벼운 시장 데이터
- `data/details/{TICKER}.json`: 종목 분석에서 필요할 때만 불러오는 상세 데이터

현재 구조에서는 첫 화면이 `market_snapshot.js`만 읽고, 종목 분석을 열 때 해당 종목의 JSON 상세 파일만 추가로 불러옵니다. 로컬 확인도 `file://` 직접 열기보다 `scripts/serve.ps1` 같은 로컬 서버 실행을 권장합니다.

## 캐시 버전

`build_id.js`의 `MIR_BUILD_ID`가 단일 기준입니다. 버전을 올릴 때 함께 갱신하세요.

- `index.html`, `analysis.html` — `?v=` 쿼리
- `sw.js` — `BUILD_ID` / `CACHE_NAME`

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

## GitHub Actions 자동 업데이트 (권장)

PC가 꺼져 있어도 GitHub 서버에서 데이터를 갱신하고 `data/`를 push합니다. 워크플로는 `.github/workflows/`에 있습니다.

| KST | 작업 | 워크플로 |
|---|---|---|
| 05:05 | 미국 시장 스냅샷 | `daily-market-snapshot.yml` |
| 06:00 | 미국 장마감 브리핑 | `us-close-briefing.yml` |
| 07:00 | 국내 개장 전 브리핑 | `korea-premarket-briefing.yml` |
| 15:30 | KR DART 공시 | `kr-disclosures.yml` |
| 15:40 | 국내 시장 스냅샷 | `daily-korea-market-snapshot.yml` |
| 15:42 | 국내 장마감 브리핑 | `korea-close-briefing.yml` |
| 21:00 | 미국 개장 전 브리핑 | `us-premarket-briefing.yml` |
| (일정) | 미국 내부자 거래 | `insider-trades.yml` |
| (일정) | 미국 의회 매매 | `congress-trades.yml` |
| (분기) | 13F 포트폴리오 | `13f-quarterly-refresh.yml` |
| (일정) | 공매도 | `short-interest.yml` |
| (일정) | 액티비스트 13D/G | `activist-stakes.yml` |
| (일정) | 8-K 주요 공시 | `material-events.yml` |
| (일정) | IPO 캘린더 | `ipo-calendar.yml` |
| (일정) | 백악관 일정 | `white-house-schedule.yml` |
| (주간) | 실적 이력 | `weekly-earnings-history.yml` |
| (일정) | 국내 카드뉴스 | `daily-korea-news.yml` |

모든 job은 `mir-data-publish` concurrency 그룹을 공유해 git push 충돌을 방지합니다.

### 최초 설정 (한 번만)

1. **저장소는 Public 유지**
   - GitHub Pro가 없으면 Private 저장소에서 Pages를 공개로 유지할 수 없습니다.
   - 현재 저장소는 Public이며, API 키는 **Repository Secrets**에만 저장됩니다.

2. **Repository Secrets 등록**
   - Settings → Secrets and variables → Actions → New repository secret
   - `GEMINI_API_KEY` (필수, 브리핑)
   - `DART_API_KEY` (선택, KR DART 공시)
   - `TELEGRAM_BOT_TOKEN` (선택, 관심종목 알림·진행 알림)
   - `TELEGRAM_CHAT_ID` (선택, 진행 알림용)
   - `NOTION_TOKEN` (키움 파이프라인, Notion Integration Secret)
   - `NOTION_DATABASE_ID` (키움 파이프라인, `cc26d8ab4b524db19cda74797c01e430`)
   - `SITE_BASE_URL` (키움 파이프라인, `https://seonu-dragon.github.io/Mir_US_Stocks`)

   일괄 등록: `gh auth login` 후 `.\scripts\setup_kiwoom_secrets.ps1`

3. **Cloudflare Worker Secrets** (커뮤니티·동기화·텔레그램)
   - `TELEGRAM_BOT_TOKEN` — `/alerts/telegram` 엔드포인트
   - `COMMUNITY_KV` — 커뮤니티 + 클라우드 동기화 KV 바인딩

4. **Actions 권한 확인**
   - Settings → Actions → General → Workflow permissions → **Read and write permissions**

5. **워크플로 push 후 확인**
   - Actions 탭에서 각 워크플로를 `Run workflow`로 수동 테스트
   - 성공하면 GitHub Pages에 자동 반영됩니다.

### 키움 커뮤니티 파이프라인 (Kiwoom Content Pipeline)

| KST | 배치 | 워크플로 |
|---|---|---|
| 07:00 | 국내 상승확률 스캐너 상위 5개 | `kiwoom_content_pipeline.yml` |
| 13:00 | 해외 스캐너 10 + 커뮤니티 언급 5 | `kiwoom_content_pipeline.yml` |

**Notion DB:** [Kiwoom Supporters Daily Posts](https://www.notion.so/cc26d8ab4b524db19cda74797c01e430)

**Notion Integration (최초 1회)**

1. [Notion Integrations](https://www.notion.so/my-integrations) → New integration → Internal
2. Secret 복사 → `.env`에 `NOTION_TOKEN="secret_..."` 추가
3. 위 Notion DB 페이지 → `...` → 연결 → Integration 추가

**로컬 테스트**

```powershell
python scripts/build_kiwoom_exports.py
python automation/main.py --batch domestic_morning
python automation/record_engagement.py --ticker NVDA --posted-url "https://..." --likes 5 --status "업로드 완료"
```

### 로컬 개발

- 브리핑 스크립트: `scripts/briefings/{korea_premarket,us_close,korea_close,us_premarket}/main.py`
- KR DART: `python scripts/build_kr_disclosures.py`
- 로컬에서는 저장소 루트 `.env` 파일 또는 환경변수로 API 키를 주입합니다.
- `.env`는 git에 올라가지 않습니다.

### Windows 작업 스케줄러 (백업용)

GitHub Actions가 기본입니다. PC가 항상 켜져 있을 때만 백업으로 `scripts/register_daily_update.ps1` 등을 사용하세요.

## 업데이트 방식 (레거시)

스케줄러를 걸면 매일 한국 시간 오전 5시에 `scripts/update_data.py`를 실행해 새 데이터를 만들 수 있습니다. GitHub Actions를 쓰면 이 단계는 서버에서 자동으로 처리됩니다.