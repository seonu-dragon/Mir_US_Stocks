# 웹사이트 배포 메모

> **사람이 직접 해야 할 Cloudflare 설정은 [`mir_design/OWNER_TODO.md`](mir_design/OWNER_TODO.md) 에 순서대로 모아 둔다**
> (워커 재배포 · 워커 Secrets · Rate Limiting 바인딩 · Turnstile/Web Analytics 키 · R2 · 배포 후 확인 curl).
> 키·바인딩이 없으면 코드는 예전 동작 그대로다 — 설정은 그 문서대로 한 번에 하면 된다.

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
| 06:00 · 16:00 · 21:00 | 백악관 일정(하루 3회) | `white-house-schedule.yml` |
| 06:05 | 미국 시장 스냅샷(+매크로·옵션·배당·컨센서스) | `daily-market-snapshot.yml` |
| 06:06 | 국내 개장 전 브리핑 | `korea-premarket-briefing.yml` |
| 06:30 | 미국 실적 캘린더 | `daily-earnings-calendar.yml` |
| 06:34 | 미국 장마감 브리핑 | `us-close-briefing.yml` |
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
| 일요일 04:20 | 돌파·되돌림 통계 + 팩터 검증 + sitemap(주간) | `weekly-edge-stats.yml` |
| 매월 5일 15:05 · 2·5·8·11월 15일 15:10 | 13F 포트폴리오(크론 2개) | `13f-quarterly-refresh.yml` |
| 평일 22:00 (+ dispatch) | 국내 시장 스냅샷 백업 경로 | `daily-korea-market-snapshot.yml` |
| 매시 :17 | 배포 큐 좀비 run 감시(데이터 갱신 아님) | `pages-queue-watchdog.yml` |
| 매시 :41 | 정시 실행 감시 — mir-cron 이 놓친 예약 대신 실행(데이터 갱신 아님) | `cron-watchdog.yml` |

표의 시각은 **예약 시각(KST)** 이다. 2026-10-01 부터 예약은 GitHub `schedule:` 이 아니라
**Cloudflare 워커 `mir-cron`** 이 그 시각에 workflow_dispatch 로 깨운다(아래 "정시 실행 워커").
GitHub `schedule:` 은 5~8시간씩 늦게 출발했다(국내 마감 브리핑 15:42 예약 → 실측 21:24~23:25 KST).
전체 예약표는 `.github/mir-cron.json`(생성물), 원본은 각 워크플로우의 `# mir-cron:` 주석이다.

한 워크플로우가 이름값 하나만 돌리는 게 아니다 — **동반 빌더**가 같은 job 안에서 함께 돈다:

- `daily-market-snapshot.yml`: Finnhub 밸류에이션 · FRED 수익률곡선/매크로 · FINRA 일별
  공매도 · 옵션 통계 · 배당/실적 캘린더 · 연방계약 · COT · 국채경매 · SEC FTD ·
  위키 관심도 · WSB 감성 · 심리 게이지 · 애널리스트 컨센서스 → `update_data.py` →
  `build_market_history.py` → 신선도 게이트.
- `korea-close-briefing.yml`: ECOS 매크로 · 나라장터 · 관세청 → `update_korea_data.py`
  (= **국내 일일 스냅샷의 실제 경로**) → 투자자 수급·컨센서스 → 브리핑 → 신선도 게이트.
- `ipo-calendar.yml`: IPO 캘린더 + `build_us_dilution.py`(증자·희석).
- `weekly-edge-stats.yml`: JS↔PY 패턴 패리티 · 돌파/되돌림 통계 · 팩터 검증 · sitemap 재생성.
  **S/R 존중률 통계(`build_sr_stats.py`)는 2026-08-06 부로 주석 처리**됐다 — 검증 결론이
  '무작위 대비 엣지 없음'이라 산출물(`data/sr_stats.json`)을 아무도 읽지 않는다.
  필요하면 로컬에서 수동 실행한다.
- `daily-korea-market-snapshot.yml` 은 위 국내 마감 브리핑이 실패했을 때를 위한 **백업**
  경로라 ECOS·나라장터·관세청·신선도 스텝이 없다.

> **미국 마감 계열 3개는 21시대 UTC 입니다(2026-09-15 변경).**
> `daily-market-snapshot` 21:05 · `daily-earnings-calendar` 21:30 ·
> `us-close-briefing` 21:34 UTC = KST 06:05 / 06:30 / 06:34.
> 예전 값(20:05 / 20:30 / 20:34 UTC)은 서머타임이 끝난 겨울(EST)에 **15:05 ET**,
> 즉 미국 정규장 마감 55분 전이었습니다. 그동안 무사했던 건 GitHub 크론 지연
> (실측 21:57~22:34 UTC) 덕분이지, 설정이 맞아서가 아니었습니다.
> 크론만으로는 서머타임을 따라갈 수 없어 스크립트 진입부에도 ET 게이트를
> 넣었습니다 — `sec_client.require_us_market_closed()` 가 평일 16:05 ET 이전이면
> exit 1 로 멈춥니다(`update_data.py`, `briefings/us_close/main.py`).
> 이 세 크론을 다시 20시대로 되돌리면 겨울에 장중 데이터가 '종가'로 발행됩니다.

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
   - `NAVER_APIHUB_KEY_ID` / `NAVER_APIHUB_KEY` (국내 뉴스 검색 — 네이버 클라우드 NAVER API Hub. 2026-07-31 부터
     개발자센터 검색 API 신규 신청이 막혀 이쪽으로 옮겼다. 키는 10자/40자. 옛 `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET`
     (20자/10자)도 남아 있으면 폴백으로 쓰지만 2027-06-30 종료) — `scripts/naver_search.py`
   - `ECOS_API_KEY` (한국은행 ECOS 매크로 — korea-close-briefing)
   - `DATA_GO_KR_KEY` (공공데이터포털 — NPS 보유·기업집단·나라장터·관세청 계열)
   - `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` (브리핑 진행 알림 + 실패 통지)
   - (선택) `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` + 리포 **변수**
     `MIR_R2_DETAILS`·`MIR_R2_DETAILS_SKIP_PAGES` — 종목 상세를 Cloudflare R2 로(기본 꺼짐, deploy-pages.yml).
     켜는 순서·CORS·되돌리기는 아래 'R2 종목 상세(details)' 절

3. **Cloudflare Worker 바인딩** (`worker/yahoo-proxy.js` 가 실제 사용하는 목록.
   워커는 머지해도 자동 반영되지 않는다 — 대시보드에 붙여넣는 수동 배포)
   - Secrets: `GEMINI_API_KEY`, `FINNHUB_API_KEY`, `NAVER_APIHUB_KEY_ID`, `NAVER_APIHUB_KEY`(없으면 옛 `NAVER_CLIENT_ID`,
     `NAVER_CLIENT_SECRET`), `COMMUNITY_ADMIN_KEY`, (선택) `GEMINI_MODEL`,
     **`IP_HASH_SALT`** — 신고·투표 중복 판정용 IP 해시 솔트. 이름만 "선택"이지
     **넣어야 한다**: 없으면 코드에 박힌 공개 문자열(`mir-community-v1`)이 쓰여
     해시에서 IPv4 원본을 전수 대입으로 즉시 복원할 수 있고, 그 해시는 관리자
     신고 조회 응답에 그대로 실린다(`worker/README.md` 참고)
   - `GEMINI_MODEL` (선택, 변수·시크릿 어느 쪽이든): `/chat` 이 쓸 Gemini 모델 이름.
     지정하면 그 모델을 **맨 앞에** 두고, 없거나 그 모델이 404/400 "model not found"
     를 주면 기본 체인 `gemini-2.5-flash` → `gemini-2.5-flash-lite` 순으로 한 번씩 더
     시도한다(그 외 오류 — 쿼터·키 — 는 바로 Workers AI 폴백). 새 모델로 바꿀 땐
     이 변수만 고치면 되고 코드 재배포는 필요 없다.
     · 2026-09-15 감사에서 옛 기본 체인 `gemini-2.0-flash`(2026-06-01 셧다운)·
       `gemini-1.5-flash`(2025-09 종료)가 **둘 다 죽어 있었다**. `GEMINI_MODEL` 이
       비어 있으면 /chat 마다 404 를 두 번 받고서야 Workers AI 로 넘어갔다.
       기본 체인이 또 낡으면 **코드를 고치기 전에 이 변수부터** 살아 있는 모델로 채울 것.
       모델이 은퇴할 때마다 여기와 `worker/yahoo-proxy.js` 의
       `GEMINI_FALLBACK_MODELS` 를 같이 고칠 것.
   - KV: `COMMUNITY_KV` (커뮤니티+클라우드 동기화), `MOVE_CACHE` (원인 분석·요약 캐시,
     IP 리밋 카운터, `lastgood:*` — fx·fng·indices·calendar 의 직전 정상값.
     업스트림(야후·CNN·investing.com)이 죽으면 7일 이내 값을 `stale: true, storedAt`
     마커와 함께 서빙한다. `MOVE_CACHE` 가 없으면 `COMMUNITY_KV` 를 대신 쓴다)
   - Workers AI 바인딩: `AI`
   - (선택, 2026-10-21) Secret `TURNSTILE_SECRET` — 있으면 커뮤니티 글·댓글·투표 POST 에 Turnstile 토큰
     (본문 `turnstileToken`) 검증 필수, 없으면 검증 생략. 사이트 키는 `market_config.js` 의 `MIR_CLOUDFLARE_DEFAULTS`.
   - (선택, 2026-10-21) Rate Limiting 바인딩 `RL_<버킷>`(RL_POST·RL_COMMENT·RL_VOTE·RL_LIKE 등) — 있으면 그 버킷은
     KV 카운터 대신 바인딩으로 센다. 없거나 실패하면 KV. 권장 한도표는 `mir_design/OWNER_TODO.md` C-1.
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

   **워커 재배포 시 새로 생기는 기능**(코드는 main 에 있지만 붙여넣기 전엔 꺼져 있다 — 프론트가 옛 워커의
   404 를 보고 조용히 숨긴다. 바인딩·시크릿 추가 없음):
   - 2026-10-21 `?symsearch=` 종목 검색 — 종목 분석 입력칸·⌘K 에서 로컬 후보가 3개 미만일 때 스냅샷 밖 종목(트레이딩뷰+야후)을 아래에 붙인다.
   - 2026-10-21 `?insights=` — 종목 상세 '비슷한 종목' 칩 + 지지/저항(US. 국내는 비슷한 종목만).
   - 2026-10-21 `?options=` — 종목 상세 '옵션 요약'(투자정보 더보기 안). 옵션 스냅샷(`data/options_stats`) 종목은 지금도 스냅샷으로 보이고, 그 밖의 미국 종목만 재배포 후 라이브.
   - 같은 배포에 야후 crumb 요청 헤더 수정(`Accept: */*` — json 이면 406)이 들어 있다. `?ticker=` 실적·`?options=` 가 crumb 을 쓴다.
   - 확인: `curl "https://mirusstocks.planbesides.workers.dev/?symsearch=palantir"` → `results` 배열, `?options=IONQ` → `expiries` 배열.

4. **Actions 권한 확인**
   - Settings → Actions → General → Workflow permissions → **Read and write permissions**

5. **워크플로 push 후 확인**
   - Actions 탭에서 각 워크플로를 `Run workflow`로 수동 테스트
   - 성공하면 GitHub Pages에 자동 반영됩니다.

### Web Push 알림 워커 (`worker/mir-push.js`, 2026-09-27)

관심·보유 종목 알림을 사이트를 닫아도 받게 하는 **별도 워커**(`mir-push`)다. yahoo-proxy 와 나눈 이유:
그 워커는 시세·뉴스·커뮤니티·챗봇을 한 파일로 붙여넣는데, 푸시는 크론·암호화·KV 쓰기가 붙는
다른 관심사라 여기서 난 오류·CPU 초과가 사이트 시세·커뮤니티를 같이 죽이지 않게 했다.
**머지해도 반영되지 않는다** — 아래를 사용자가 직접 한 번 해야 알림이 켜진다. 그 전까지 사이트의
'푸시 알림' 칸은 "준비 중"으로 숨겨져 있다(키·주소가 비어 있으면 자동으로).

1. **VAPID 키 생성**(로컬, 한 번): `node scripts/gen_vapid_keys.mjs`
   - 공개키·비밀키를 **화면에만** 출력한다. 비밀키는 파일·레포·채팅에 남기지 말고 3번에서 바로 붙여넣은 뒤 터미널을 닫는다.
   - 키를 바꾸면 기존 구독이 전부 무효가 된다(사용자가 알림을 껐다 켜야 함). 유출이 아니면 바꾸지 말 것.
2. **워커 만들기**: Cloudflare 대시보드 → Workers & Pages → Create → Worker → 이름 `mir-push` →
   템플릿 코드를 지우고 **origin/main 의 `worker/mir-push.js` 전체**를 붙여넣고 Deploy.
   - 붙여넣기 전 확인: `node scripts/sync_push_worker.mjs --check && node worker/test_push.mjs`
     (EMBED 블록 = 루트 `my-digest-core.js`·`push-alerts-core.js` 원문. 원본을 고쳤으면 `node scripts/sync_push_worker.mjs` 후 커밋).
3. **Secrets**(워커 → Settings → Variables and Secrets → Secret):
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`(1번 출력), `VAPID_SUBJECT`(= `mailto:본인메일`, 푸시 서비스가 문제 시 연락하는 주소)
   - (선택, 변수) `PUSH_MAX_PER_RUN` — 실행당 최대 발송 수. 기본 10(무료 플랜 CPU 10ms 기준), 유료 플랜이면 40 까지.
4. **KV**: KV 네임스페이스 `mir-push`(이름 자유)를 새로 만들고 워커 → Settings → Bindings → KV namespace →
   변수 이름 **`PUSH_KV`** 로 연결.
   - (선택) **`SYNC_KV`** — yahoo-proxy 의 `COMMUNITY_KV` 와 **같은 네임스페이스**를 한 번 더 바인딩하면,
     사용자가 '클라우드 동기화 목록 자동 사용'을 켰을 때 크론이 `/sync/prefs` 값(다른 기기에서 바꾼 관심·보유·가설 목표가)을
     매번 다시 읽는다. 없으면 기기가 보낸 목록만 쓴다(목록이 바뀔 때마다 기기가 다시 보낸다).
5. **Cron Trigger**: 워커 → Settings → Triggers → Cron Triggers → **`*/30 * * * *`** 하나. 무엇을 할지는 코드가 정한다:
   미 정규장·국내 정규장 30분마다 ±N%·가격 도달 / KST 07:30(화~토) 미국 '오늘 내 주식은' 요약 + 실적 D-1 /
   KST 15:00 미국 8-K / KST 20:00(평일) 국내 요약 + DART 주요 공시.
6. **확인**: `curl https://mir-push.<계정>.workers.dev/push/health` → `"configured": true` 와 `vapidPublicKey` 가 1번 공개키인지.
7. **프런트 연결**(PR): `web-push.js` 맨 위 `MIR_PUSH_DEFAULTS` 에 `endpoint`(워커 주소)와 `vapidPublicKey`(**공개키만**)를
   넣고 `py scripts/stamp_build_id.py` → PR → 머지. 라이브에서 내 투자 › 보유·관심 › '푸시 알림' → '이 기기에서 알림 받기' →
   '테스트 알림'으로 도착 확인. 워커 로그(대시보드 → Logs)에는 발송·만료·실패가 있던 크론만 요약 한 줄이 찍힌다.

운영 메모
- 저장: KV `sub:<endpoint sha256 앞 32자>` = 구독 키·설정·목록·발송 상태. 사이트를 120일 안 열면 만료(열 때마다 7일 주기로 갱신).
  푸시 서비스가 404/410 을 주면 즉시 삭제. '알림 끄기'는 KV 에서도 지운다. 보유 수량은 요약을 켰을 때만, 동기화 clientId 는
  자동 사용을 켰을 때만 저장한다. IP 는 저장하지 않는다(리밋은 격리 메모리).
- 하루 상한: 구독별 1~12건(기본 6, 요약 포함). 상한에 걸린 알림은 보내지 않고 '보낸 것으로' 기록해 다음 날 몰려오지 않게 한다.
  한 크론에서 한 구독이 받는 알림은 시장별 1건(여러 조건은 한 알림의 여러 줄) + 요약.
- 무료 플랜 한도: 서브리퀘스트 50/실행(야후 spark 최대 8 + Pages 데이터 최대 8 + 발송), KV 쓰기 1,000/일(크론 48회 + 발송한 구독 수),
  CPU 10ms/실행. 발송 예산을 넘으면 다음 실행이 그 구독부터 잇는다(`cron:meta` 커서). 구독자가 수십 명을 넘으면 Workers Paid 로.
- 시세: 야후 v7 spark(range=1d) — 지연 시세이고 알림에 그렇게 적는다. 국내 코드는 기기가 알려 준 접미사, 없으면 .KS → .KQ 재시도.
  요약은 스냅샷(6MB) 대신 구독자 종목 시세로 만들어서 **업종 대비 비교가 빠진다**(사이트 카드에는 있다).
- 공시·실적 일정·특징주 사유는 GitHub Pages 의 `data/*.json` 을 읽는다 — 배포가 멈추면 이 알림도 멈춘다.

### 정시 실행 워커 (`worker/mir-cron.js`, 2026-10-01)

GitHub `schedule:` 은 예약 시각을 지키지 않는다(2026-09 실측 5~8시간 지연 — 15:42 예약이 밤 10~11시에 출발).
반면 workflow_dispatch(= Run workflow 버튼)는 즉시 출발하므로, 예약 시각은 **별도 워커 `mir-cron`** 이 매분 깨어나
GitHub API 로 dispatch 한다. 워크플로우에는 `schedule:` 대신 `# mir-cron: "<UTC cron>"` 주석만 남긴다.
**머지해도 반영되지 않는다 — 아래를 사용자가 한 번 해야 한다.** 그 전까지는 `cron-watchdog.yml`(GitHub schedule, 매시)이
슬롯 후 90분이 지난 예약을 대신 돌린다(늦지만 빠지지는 않는다).

1. **GitHub 토큰**: github.com → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** →
   Generate new token. Repository access = **Only select repositories → Mir_US_Stocks**, Permissions → Repository →
   **Actions: Read and write**(Metadata: Read 는 자동). 만료일은 길게(최대 1년) — 만료되면 정시 실행이 멈추고 감시자 알림이 온다.
2. **워커 만들기**: Cloudflare 대시보드 → Workers & Pages → Create → Worker → 이름 `mir-cron` → 템플릿을 지우고
   **origin/main 의 `worker/mir-cron.js` 전체**를 붙여넣고 Deploy. (붙여넣기 전: `node scripts/sync_cron_worker.mjs --check && node worker/test_cron.mjs`)
3. **Secret**: 워커 → Settings → Variables and Secrets → `GITHUB_TOKEN` = 1번 토큰.
   (선택 변수 `GITHUB_REPO`(기본 seonu-dragon/Mir_US_Stocks), `GITHUB_REF`(기본 main))
4. **Cron Trigger**: 워커 → Settings → Trigger Events → Cron Triggers → **`* * * * *`**(매분) 하나.
   무엇을 언제 깨울지는 레포의 `.github/mir-cron.json` 이 정한다 — 워커가 10분마다 다시 읽으므로 예약을 바꿔도 재배포 불필요.
5. **확인**: `https://mir-cron.<계정>.workers.dev/health?token=1` → `"configured": true`, `"tokenOk": true`,
   `"scheduleSource": "remote"`, `next` 에 다음 예약 5개. 다음 예약 시각 직후 Actions 탭에 `workflow_dispatch` run 이 생기면 끝.

동작 메모
- 중복 방지(KV 없음): dispatch 전에 "슬롯 시각 이후 만들어진 run 이 있는지"를 본다. 사람이 먼저 돌렸어도 건너뛴다.
  실패하면 슬롯 후 1·3·7·15·30·60분에 다시 확인한다. run 조회가 실패하면 dispatch 하지 않는다(중복보다 지연이 낫다).
- 예약 슬롯마다 다른 잡을 돌리는 워크플로우(13F·company-info·market-calendar·국내 스냅샷 백업)는 workflow_dispatch 에
  `cron` 입력을 선언했고, 워커가 슬롯 cron 을 넘긴다. 잡 `if:` 는 `(github.event.schedule || inputs.cron)` 으로 슬롯을 판정한다.
  사람이 Run workflow 로 돌릴 땐 `cron` 을 비워 두면 예전 수동 실행과 같다.
- 예약을 추가·변경: 워크플로우 `on:` 에 `# mir-cron: "M H d m w"`(UTC) 주석 → `node scripts/sync_cron_worker.mjs` → 커밋.
  `schedule:` 을 새로 쓰면 CI 가 막는다(워커 dispatch + 늦은 schedule 로 하루 두 번 돈다). 감시자 두 개만 예외.
- 무료 플랜: 매분 실행 = 하루 1,440회(요청 한도 10만), 실행당 GitHub 호출은 확인할 슬롯이 있을 때만 몇 회.
- 로그: 워커 → Logs 에 dispatch·실패가 있던 분만 한 줄. 감시자가 대신 돌리면 텔레그램 "[Mir 정시 실행]" 알림.

### R2 종목 상세(details) — 기능 플래그 (2026-10-21, 기본 꺼짐)

**왜**: `data/details`(US)와 `data/korea/details`(KR)가 Pages 배포 아티팩트의 대부분이다.
2026-10-21 HEAD 기준 git blob 합계 US 224.2MB / 7,247개, KR 206.3MB / 3,807개(2026-09-15 실측은
195MB·169MB, 아티팩트 456MB). 배포에는 700MB 가드가 있고 Pages 권장 한도는 1GB다(CLAUDE.md '알려진 부채').

**지금 상태**: 코드는 다 들어가 있고 **전부 꺼져 있다**. 아래를 하기 전까지 동작은 예전과 같다.

| 스위치 | 위치 | 기본 | 하는 일 |
|---|---|---|---|
| `MIR_R2_DETAILS` | GitHub 리포 **변수** | 없음 | `true` 면 Deploy Pages 가 details 를 R2 에 올린다(`Sync details to R2` 스텝) |
| `detailsBase` | `details-source.js` 의 `DETAILS_CONFIG` | `""` | 채우면 브라우저가 R2 에서 먼저 받고, 실패하면 Pages 로 한 번 폴백 |
| `MIR_DETAILS_BASE` | `worker/yahoo-proxy.js` 상수 | `""` | 워커 실적 이력 폴백이 R2 를 먼저 본다(워커는 수동 배포) |
| `MIR_R2_DETAILS_SKIP_PAGES` | GitHub 리포 **변수** | 없음 | `true` + 이번 run 의 R2 업로드 성공 + `detailsBase` 채워짐 → Pages 아티팩트에서 details 제외 |

R2 업로드가 실패한 run 은 `MIR_R2_DETAILS_SKIP_PAGES` 와 상관없이 details 를 Pages 에 그대로 싣는다(폴백).

#### 0. 준비(Cloudflare 대시보드)

1. **버킷 생성**: R2 → Create bucket. 이름 예: `mir-details`. 위치는 Automatic.
2. **공개 액세스**: 버킷 → Settings → Public access.
   - 권장: **Custom Domain** 연결(예: `details.<내 도메인>`; 도메인이 Cloudflare 존에 있어야 함).
   - 임시: **r2.dev 서브도메인** 허용 → `https://pub-<id>.r2.dev`. Cloudflare 가 r2.dev 는 개발용이고
     요청 제한이 걸린다고 안내하므로 운영은 커스텀 도메인으로.
3. **CORS**: 버킷 → Settings → CORS Policy → 아래 JSON. 사이트가 다른 출처(github.io)에서 `fetch` 하므로
   `Access-Control-Allow-Origin` 이 없으면 브라우저가 응답을 버린다(그때도 Pages 폴백으로 화면은 뜬다).
   로컬 검증 포트는 필요한 것만 넣는다.

   ```json
   [
     {
       "AllowedOrigins": [
         "https://seonu-dragon.github.io",
         "http://127.0.0.1:8113",
         "http://localhost:8113"
       ],
       "AllowedMethods": ["GET", "HEAD"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
4. **API 토큰**: R2 → Manage R2 API Tokens → Create API token.
   - Permissions: **Object Read & Write**
   - Specify bucket(s): **Apply to specific buckets only** → 위 버킷 하나
   - 만들면 나오는 **Access Key ID**, **Secret Access Key** 를 적어 둔다(다시 안 보여 준다).
   - **Account ID** 는 R2 개요 화면 오른쪽(엔드포인트 `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` 의 앞부분).

#### 1. GitHub 에 등록(업로드만 켜기 — 사이트는 아직 Pages 를 읽는다)

리포 Settings → Secrets and variables → Actions. 또는:

```powershell
gh secret set R2_ACCOUNT_ID        -R seonu-dragon/Mir_US_Stocks   # 프롬프트에 값 붙여넣기
gh secret set R2_ACCESS_KEY_ID     -R seonu-dragon/Mir_US_Stocks
gh secret set R2_SECRET_ACCESS_KEY -R seonu-dragon/Mir_US_Stocks
gh secret set R2_BUCKET            -R seonu-dragon/Mir_US_Stocks   # 예: mir-details
gh variable set MIR_R2_DETAILS --body true -R seonu-dragon/Mir_US_Stocks
```

**첫 전체 업로드**: Actions → Deploy Pages → Run workflow(입력 기본값 그대로) 또는
`gh workflow run deploy-pages.yml -R seonu-dragon/Mir_US_Stocks`. 따로 '전체 업로드' 모드는 없다 —
`rclone copy --checksum` 이 R2 에 없거나 내용이 다른 파일만 올리므로 첫 실행이 곧 전체 업로드다.
스텝 시간 제한이 8분이라 첫 회에 다 못 올리면 스텝만 실패하고(배포는 Pages 폴백으로 계속) 다음
배포가 이어서 올린다. 실행 요약에 `R2 details 동기화: 성공(copy)` 이 찍힐 때까지 반복.

확인:

```powershell
curl.exe -sI https://<공개 호스트>/data/details/NVDA.json            # 200, content-type: application/json
curl.exe -sI -H "Origin: https://seonu-dragon.github.io" https://<공개 호스트>/data/korea/details/005930.json
#   → access-control-allow-origin: https://seonu-dragon.github.io 가 있어야 한다
```

이후에는 데이터 워크플로우 → Deploy Pages 가 돌 때마다 바뀐 파일만 올라간다. 최근 커밋 실측으로
US 스냅샷 1회에 details 7,239개, KR 스냅샷 1회에 3,215~3,676개가 바뀌었다 — 그만큼이 run 마다 PUT
(Class A) 요청 수다. R2 무료 한도·요금은 Cloudflare R2 요금 페이지에서 이 수치와 비교할 것.

#### 2. 사이트를 R2 로(브라우저·워커)

1. `details-source.js` 의 `detailsBase` 에 공개 호스트를 넣는다(끝 슬래시 없이, 예 `"https://details.example.com"`).
2. `py scripts/stamp_build_id.py` → PR → 머지(CLAUDE.md 절차). 라이브에서 분석 페이지를 열어 개발자
   도구 Network 에 R2 호스트로 `data/details/<T>.json` 이 200 으로 오는지 본다. R2 가 실패하면
   자동으로 Pages 경로를 한 번 더 요청하므로 이 단계에서는 화면이 깨질 수 없다.
3. `worker/yahoo-proxy.js` 의 `MIR_DETAILS_BASE` 에도 같은 값 → 대시보드에 붙여넣기 배포(DEPLOY.md 3번).
   이걸 안 하면 3단계 뒤 워커의 실적 이력 폴백(`?ticker=` 의 earnings.history)이 비게 된다.

#### 3. Pages 아티팩트에서 details 빼기

```powershell
gh variable set MIR_R2_DETAILS_SKIP_PAGES --body true -R seonu-dragon/Mir_US_Stocks
gh workflow run deploy-pages.yml -R seonu-dragon/Mir_US_Stocks
```

실행 요약에 `R2 details: Pages 아티팩트에서 제외` 와 줄어든 `배포 아티팩트: N MB` 가 보이면 끝.
이 run 의 R2 업로드가 실패했거나 `detailsBase` 가 비어 있으면 경고만 남기고 details 를 그대로 싣는다.
몇 주 안정적이면 `details-source.js` 의 `pagesFallback` 을 `false` 로 바꿔 없는 종목의 404 이중
요청을 없앨 수 있다(선택).

가끔(분기 1회 정도) **정리**: Run workflow 에서 `r2_prune` 을 켜면 레포에 없는 객체(빠진 종목)를
지운다(`rclone sync`, 한 번에 최대 500개 — 넘으면 rclone 이 멈추고 스텝만 실패).

#### 되돌리기

- **즉시(사이트가 R2 문제로 이상할 때)**: `gh variable delete MIR_R2_DETAILS_SKIP_PAGES -R seonu-dragon/Mir_US_Stocks`
  → `gh workflow run deploy-pages.yml` 로 details 를 Pages 에 다시 싣는다. 프론트는 R2 실패 시 Pages
  로 폴백하므로 이것만으로 복구된다.
- **R2 를 안 쓰기**: `detailsBase` 를 `""` 로(스탬프 → PR → 머지), 워커 `MIR_DETAILS_BASE` 도 `""`,
  `gh variable delete MIR_R2_DETAILS` → 업로드 스텝이 돌지 않는다. 버킷·토큰은 대시보드에서 삭제.
- 순서가 중요하다: Pages 에서 details 를 뺀 상태(3단계)로 `detailsBase` 만 비우면 상세가 전부 404 가
  된다. 항상 **3단계 해제 → 2단계 해제 → 1단계 해제** 순.

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