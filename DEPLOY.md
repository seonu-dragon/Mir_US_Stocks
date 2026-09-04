# 웹사이트 배포 메모

이 프로젝트는 정적 사이트입니다. 서버 프로그램 없이 `index.html`, `app.js`, `styles.css`, `data/` 폴더만 올리면 동작합니다.

## 권장 구조

- `data/market_snapshot.json`: 첫 화면용 시장 데이터(브라우저가 fetch)
- `data/details/{TICKER}.json`: 종목 분석에서 필요할 때만 불러오는 상세 데이터

현재 구조에서는 첫 화면이 `market_snapshot.json`만 읽고, 종목 분석을 열 때 해당 종목의 JSON 상세 파일만 추가로 불러옵니다. `data/market_snapshot.js`는 `file://`로 직접 열 때의 폴백일 뿐이라 커밋하지 않습니다(로컬에서 `update_data.py`가 만들어 둡니다). 로컬 확인도 `file://` 직접 열기보다 `scripts/serve.ps1` 같은 로컬 서버 실행을 권장합니다.

## 캐시 버전

**손으로 갱신하지 마세요.** 자산(app.js/styles.css 등)을 바꿨으면 배포 전에 한 번:

```powershell
py scripts/stamp_build_id.py     # ?v= 를 파일 내용 md5 로, MIR_BUILD_ID·sw.js 폴백까지 일괄 스탬프
py scripts/stamp_build_id.py --check   # CI 용: 어긋남만 확인
```

과거 수동 갱신 시절 `?v=` 값이 5가지로 갈라진 채 2주간 방치된 사고가 있었습니다
(상세는 CLAUDE.md "배포 전 반드시" 참고).

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
| 04:43 | 국내 뉴스 Top 5 | `daily-korea-news.yml` |
| 05:05 | 미국 시장 스냅샷(+매크로·옵션·배당·컨센서스) | `daily-market-snapshot.yml` |
| 05:30 | 미국 실적 캘린더 | `daily-earnings-calendar.yml` |
| 05:34 | 미국 장마감 브리핑 | `us-close-briefing.yml` |
| 06:00 | 백악관 일정 | `white-house-schedule.yml` |
| 06:06 | 국내 개장 전 브리핑 | `korea-premarket-briefing.yml` |
| 13:17 | 미국 내부자 거래 | `insider-trades.yml` |
| 13:23 | 8-K 주요 공시 | `material-events.yml` |
| 13:28 | 액티비스트 13D/G | `activist-stakes.yml` |
| 13:33 | IPO 캘린더 | `ipo-calendar.yml` |
| 13:38 | 미국 의회 매매 | `congress-trades.yml` |
| 14:47 화·금 | 공매도 잔고 | `short-interest.yml` |
| 15:30 평일 | KR DART 공시 | `kr-disclosures.yml` |
| 15:42 | 국내 장마감 브리핑 + **KR 스냅샷(실제 일일 경로)** | `korea-close-briefing.yml` |
| 21:07 | 미국 개장 전 브리핑 | `us-premarket-briefing.yml` |
| 일요일 03:02 | 실적 이력(주간) | `weekly-earnings-history.yml` |
| 일요일 04:20 | S/R·돌파 통계 + sitemap(주간) | `weekly-edge-stats.yml` |
| 매월 5일 등 | 13F 포트폴리오(분기성) | `13f-quarterly-refresh.yml` |
| (dispatch 전용) | 국내 시장 스냅샷 단독 실행 | `daily-korea-market-snapshot.yml` |

각 워크플로우는 **자기만의 concurrency 그룹**(`mir-publish-${{ github.workflow }}`)을 갖습니다.
같은 워크플로우의 중복 실행만 직렬화하고, 서로 다른 워크플로우는 병렬로 돕니다 —
git push 충돌은 각 빌더의 `fetch → pull --rebase -X theirs → push` 재시도가 흡수합니다.
(과거에는 전부 `mir-data-publish` 하나를 공유했는데, GitHub 은 그룹당 **대기 슬롯이 1개**뿐이라
크론 밀집 시간대에 뒤에 온 run 이 앞의 대기 run 을 조용히 cancel 했습니다.
2026-07-17~22 사이 earnings calendar 6일 연속, US/KR 마감 브리핑 다수가 이렇게 미발행됐습니다.)

### 최초 설정 (한 번만)

1. **저장소는 Public 유지**
   - GitHub Pro가 없으면 Private 저장소에서 Pages를 공개로 유지할 수 없습니다.
   - 현재 저장소는 Public이며, API 키는 **Repository Secrets**에만 저장됩니다.

2. **Repository Secrets 등록** (워크플로우가 실제 참조하는 전체 목록)
   - Settings → Secrets and variables → Actions → New repository secret
   - `GEMINI_API_KEY` (브리핑·뉴스 Top 5)
   - `DART_API_KEY` (KR 공시·배당·수주·실적 계열 전반)
   - `FINNHUB_API_KEY` (US 밸류에이션 지표·애널리스트 컨센서스)
   - `KRX_ID` / `KRX_PW` (KRX 회원 로그인 — 국내 공매도 잔고)
   - `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` (국내 뉴스 검색)
   - `ECOS_API_KEY` (한국은행 ECOS 매크로 — korea-close-briefing)
   - `DATA_GO_KR_KEY` (공공데이터포털 — NPS 보유·기업집단·나라장터·관세청 계열)
   - `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` (브리핑 진행 알림 + 실패 통지)

3. **Cloudflare Worker 바인딩** (`worker/yahoo-proxy.js` 가 실제 사용하는 목록.
   워커는 머지해도 자동 반영되지 않는다 — 대시보드에 붙여넣는 수동 배포)
   - Secrets: `GEMINI_API_KEY`, `FINNHUB_API_KEY`, `NAVER_CLIENT_ID`,
     `NAVER_CLIENT_SECRET`, `COMMUNITY_ADMIN_KEY`, (선택) `GEMINI_MODEL`,
     (선택) `IP_HASH_SALT` — 신고·투표 중복 판정용 IP 해시 솔트(없으면 고정 기본값)
   - `GEMINI_MODEL` (선택, 변수·시크릿 어느 쪽이든): `/chat` 이 쓸 Gemini 모델 이름.
     지정하면 그 모델을 **맨 앞에** 두고, 없거나 그 모델이 404/400 "model not found"
     를 주면 기본 체인 `gemini-2.0-flash` → `gemini-1.5-flash` 순으로 한 번씩 더
     시도한다(그 외 오류 — 쿼터·키 — 는 바로 Workers AI 폴백). 새 모델로 바꿀 땐
     이 변수만 고치면 되고 코드 재배포는 필요 없다. 예: `gemini-2.5-flash`.
   - KV: `COMMUNITY_KV` (커뮤니티+클라우드 동기화), `MOVE_CACHE` (원인 분석·요약 캐시,
     IP 리밋 카운터, `lastgood:*` — fx·fng·indices·calendar 의 직전 정상값.
     업스트림(야후·CNN·investing.com)이 죽으면 7일 이내 값을 `stale: true, storedAt`
     마커와 함께 서빙한다. `MOVE_CACHE` 가 없으면 `COMMUNITY_KV` 를 대신 쓴다)
   - Workers AI 바인딩: `AI`
   - 관리자 호출은 `X-Admin-Key` 헤더로(쿼리 `adminKey=` 는 한 릴리스만 폴백 유지)
   - (선택) Durable Object: `COMMUNITY_DO` → class `CommunityStore`.
     **없어도 된다** — 없으면 커뮤니티는 지금까지처럼 `COMMUNITY_KV` 를 직접
     읽고 쓴다(동작 동일). 붙이면 `/community*` 전 요청이 인스턴스 하나로
     직렬화돼 동시 글쓰기가 서로를 덮어쓰지 않는다.
     · **Workers 유료 플랜($5/월)이 필요하고, 대시보드만으로는 만들 수 없다.**
       DO 클래스는 `wrangler.toml` 의 `[[migrations]]` 로만 생성되므로 최초 1회는
       `wrangler deploy` 가 필요하다(`worker/wrangler.toml` 에 스니펫이 있다).
     · 처음 요청 때 기존 `COMMUNITY_KV` 의 `community:v1:posts` / `:votes` 를
       DO storage 로 한 번 복사해 온다 — 기존 글은 유지된다.
     · 그 뒤로 정본은 DO storage 다. 바인딩을 다시 떼면 DO 로 들어간 글은
       사라진 것처럼 보이고 KV 스냅샷 시점으로 돌아간다(되돌리려면 그 점을 감안할 것).

   워커 자체 검증(네트워크 없이, 붙여넣기 전에 돌려 볼 것):

   ```powershell
   node worker/test_worker.mjs   # Node 18+
   ```

4. **Actions 권한 확인**
   - Settings → Actions → General → Workflow permissions → **Read and write permissions**

5. **워크플로 push 후 확인**
   - Actions 탭에서 각 워크플로를 `Run workflow`로 수동 테스트
   - 성공하면 GitHub Pages에 자동 반영됩니다.

### 키움 커뮤니티 글쓰기 (로컬 CLI)

GitHub Actions 파이프라인(`kiwoom_content_pipeline.yml`)은 2026-07-07 에 폐기했고,
지금은 **로컬 CLI** 로 돌립니다. 시작 프롬프트는
`SNS/Gemini_첫_프롬프트.md` Section 4, 흐름은 prepare_targets → AI 작성 →
publish_to_notion 입니다. Notion 연동(`NOTION_TOKEN` 등)은 레포 Secrets 가 아니라
로컬 `.env` 에만 필요합니다.

```powershell
python scripts/build_kiwoom_exports.py
python automation/main.py --batch domestic_morning
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