# 실시간 뉴스·차트 프록시 (Cloudflare Worker)

GitHub Pages는 정적 호스팅이라 방문자가 페이지를 열어도 서버에서 파이썬을 실행할 수 없습니다.
이 Worker는 Cloudflare 무료 요금제에서 돌아가며, 종목 분석 페이지를 열 때 야후 파이낸스
**뉴스와 실제 차트**를 그 자리에서 가져와 CORS 허용 JSON으로 돌려줍니다.

## 배포 (1회, 무료)

1. https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Worker**
2. 템플릿 코드를 지우고 [`yahoo-proxy.js`](./yahoo-proxy.js) 내용을 붙여넣은 뒤 **Deploy**
3. **Workers AI 바인딩 추가**(한국어 요약용, 무료 할당):
   워커 → **Settings** → **Bindings** → **Add** → **Workers AI** → 변수 이름 **`AI`** → **Deploy**
   - 바인딩이 없으면 뉴스·차트는 정상 동작하고 요약만 빈 값이 됩니다.
4. 배포된 주소 복사 (예: `https://mir-yahoo.yourname.workers.dev`)
5. 저장소의 `app.js`에서 아래 값을 그 주소로 변경 후 푸시:
   ```js
   const LIVE_DATA_PROXY = "https://mir-yahoo.yourname.workers.dev";
   ```

## 동작

- 호출: `GET https://<worker>/?ticker=NVDA`
- 응답: `{ "ticker": "NVDA", "news": [...], "chart": [[o,h,l,c,v], ...], "summary": "한국어 요약" }`
- `summary`는 Workers AI(`@cf/meta/llama-3.1-8b-instruct`)가 헤드라인을 한국어로 3~4문장 요약한 것입니다.
- 분석 페이지를 열면 프론트가 이 주소를 호출해 **뉴스를 실시간으로** 채우고,
  합성차트였던 종목(FLNT·STTK 등)도 **실제 차트로 자동 교체**합니다.
- 호출 실패 시에는 빌드 때 미리 저장해 둔 상세파일 뉴스로 자동 폴백합니다.
- Worker 응답은 엣지에서 15분 캐시되어 야후 호출 부담을 줄입니다.
- **실적 일정**(`?earnings_calendar=1`, 종목 상세 `earnings`)은 Yahoo `quoteSummary` API가
  쿠키+crumb 인증을 요구합니다. 실적이 비어 보이면 `yahoo-proxy.js`를 Cloudflare에 **재배포**하세요.

## 과거 가격 이벤트 원인 분석

- 호출: `GET https://<worker>/?ticker=TSLA&company=Tesla&move_analysis=1&date=2026-04-15&change=7.62`
- 먼저 이벤트 날짜 전후 2일의 뉴스를 검색하고, 결과가 부족하면 전후 7일까지 확대합니다.
- `FINNHUB_API_KEY` Secret이 있으면 Finnhub 과거 뉴스를 함께 사용하고, Google News RSS 날짜 검색을 기본 폴백으로 사용합니다. GDELT와 Yahoo는 추가 보완 자료로 합칩니다.
- 같은 날짜의 SPY·QQQ 등락과 거래량도 AI에 전달해 종목 고유 재료와 시장 전체 움직임을 구분합니다.
- 선택 사항: KV 바인딩을 변수 이름 `MOVE_CACHE`로 추가하면 종목·날짜별 분석을 30일 저장해 AI 호출을 줄입니다.

Cloudflare Dashboard에서 **Settings → Variables and Secrets**에 `FINNHUB_API_KEY`를 Secret으로 추가할 수 있습니다. 키가 없어도 Google News RSS 날짜 검색으로 동작하지만, Finnhub를 함께 쓰면 기업 뉴스 누락 가능성이 낮아집니다.
## 커뮤니티 게시판 (`/community`)

- **KV 바인딩 필수**: Worker → Settings → Bindings → Add → **KV namespace** → 변수 이름 **`COMMUNITY_KV`**
  - KV namespace를 새로 만들고(예: `mir-community`) 위 이름으로 연결한 뒤 **Deploy** 하세요.
- `GET /community` — 전체 글 목록 (`?ticker=NVDA` 종목 필터, `?limit=80`). 신고 내역(`reports`)은 응답에서 제외됨.
- `POST /community` — 글 등록 `{ author, ticker?, content, clientId }` (스팸 방지: 12초 쿨다운·중복·링크/금지어 차단)
- `DELETE /community` — 글 삭제 `{ id, clientId }` (본인 글) 또는 `{ id, adminKey }` (관리자)
- `POST /community/clear` — 본인 글 전체 삭제 `{ clientId }`
- `POST /community/comment` — 댓글 등록 `{ postId, author, content, clientId }` / `DELETE` 로 본인 댓글 삭제
- `POST /community/like` — 공감 토글 `{ postId, clientId }`
- `POST /community/report` — 신고 `{ postId, clientId, reason? }`. **서로 다른 신고자 3명**이 쌓이면 공개 목록에서 자동 숨김(작성자 본인·관리자에게는 `hiddenByReports` 와 함께 계속 보임).
  - 세는 단위는 **신고 건수가 아니라 서로 다른 신고자 수**다. 기준은 해시 IP(`IP_HASH_SALT`), 없으면 `clientId`.
    `clientId` 는 브라우저가 만드는 값이라 세 번 갈아 끼우면 아무 글이나 내릴 수 있었고, 앞단의 IP 리밋은
    KV 고정창(최종 일관성)이라 원자적 방어가 못 된다. 응답의 `reportCount` 도 같은 단위다.
- `GET /community/reports` — **관리자 전용** 신고된 글+사유 목록(`X-Admin-Key` 헤더, 구형 `?adminKey=` 폴백).
  `reportCount`=서로 다른 신고자 수, `reportEntries`=원본 건수, `hidden`=자동 숨김 여부.
- `POST /community/vote` — 종목 투표 `{ ticker, choice, clientId }`. **choice 는 `buy` / `sell` 두 가지뿐이다**
  (예전 문서에 있던 `hold` 는 워커가 받지 않는다 — `400 bad_choice`. 집계에서도 옛 '관망' 표는 총계에서 빠진다).
  - **하루 1표**(같은 날 재투표 시 교체). 여기서 "하루"의 경계는 **UTC 자정**이라 한국시간으로는
    **오전 9시에 리셋**된다. 국내 장중(09:00~15:30)은 같은 날로 묶이므로 실사용엔 문제가 없지만,
    KST 00:00~09:00 에 던진 표는 전날 몫으로 잡힌다.
  - clientId 는 위조 가능하므로 해시 IP 기준으로도 하루 1표다. 별도 KV 키에 35일 보관.
- `GET /community/votes?period=day|week|month&clientId=...` — 종목별 투표 순위(+ `myToday`)
- 프론트는 `LIVE_DATA_PROXY` 주소 뒤에 위 경로를 붙여 호출하며, 종목 토론 탭에서 약 12초마다 자동 새로고침합니다.

### 관리자(신고 내역) 설정 — 선택

- 신고된 글을 검토·삭제하려면 Worker → **Settings → Variables and Secrets**에 Secret **`COMMUNITY_ADMIN_KEY`**(아무 비밀 문자열)를 추가하고 **Deploy**.
- 그 뒤 사이트를 **`?cadmin=설정한키`**로 한 번 접속하면 해당 브라우저가 관리자로 기억되어, 종목 토론 상단에 **🛡 신고 내역** 패널(글 삭제 가능)이 표시됩니다.
- 키를 설정하지 않으면 신고 로그는 쌓이되 관리자 조회는 비활성화됩니다(`403`).
- 진단 라우트 `?earnings_probe=1`(야후 쿠키·crumb 상태)도 같은 관리자 키 뒤에 있습니다.
  키 없이 부르면 `403` 이고 야후를 호출하지 않습니다.

### `IP_HASH_SALT` — 선택이 아니라 사실상 필수

신고·투표 중복 판정에 쓰는 IP 해시의 솔트입니다. **설정하지 않으면 코드에 박힌 공개
문자열(`mir-community-v1`)이 그대로 쓰이므로, 해시를 본 사람은 IPv4 전체 공간(43억)을
몇 분 만에 전수 대입해 원본 IP 를 복원할 수 있습니다.** 해시는 관리자 신고 조회 응답에
그대로 실려 나갑니다. Worker → **Settings → Variables and Secrets** 에 길고 임의적인
Secret 으로 넣으세요(값을 바꾸면 그 시점 이후 신고·투표의 중복 판정만 새로 시작됩니다).

## 사이트 도우미 챗봇 (`POST /chat`)

- 같은 Worker에 챗봇 엔드포인트가 포함돼 있습니다. **추가 배포 없이** `yahoo-proxy.js`를
  다시 붙여넣어 Deploy 하면 됩니다(Workers AI `AI` 바인딩을 그대로 사용 → 추가 비용/키 없음).
- 호출: `POST https://<worker>/chat`
  ```json
  {
    "messages": [{ "role": "user", "content": "삼성전자 최근 이슈가 뭐야?" }],
    "stockContext": "...",
    "market": "kr",
    "searchHints": { "tickers": ["005930"], "companies": ["삼성전자"] }
  }
  ```
- 응답: `{ "reply": "...", "model": "...", "rag": { "newsCount": 5, "sources": ["..."] } }`
- 사이트 사용법과 PER·ROE 등 금융 기본 용어를 한국어로 설명합니다. 시스템 프롬프트에
  사이트 구성·용어 사전이 들어 있어, 특정 종목 매수/매도 추천은 하지 않습니다.
- **뉴스 RAG (1단계)**: "왜 올랐어?", "최근 뉴스", "실적 이슈" 같은 질문이면 Worker가
  네이버 뉴스 Open API → (없으면) Google News RSS → 종목별 네이버/야후 뉴스 순으로
  관련 기사 3~6건을 검색해 LLM에 근거로 전달합니다.
- 프론트는 `app.js`의 `LIVE_DATA_PROXY` 주소 뒤에 `/chat`을 붙여 호출합니다(우하단 "💬 도우미").

### 챗봇 뉴스 RAG용 Secret (권장)

Worker → **Settings → Variables and Secrets**에 아래를 추가하면 국내 뉴스 검색 품질이 좋아집니다.
(SNS 자동화 파이프라인과 동일한 키)

- `NAVER_CLIENT_ID`
- `NAVER_CLIENT_SECRET`

키가 없어도 Google News RSS + 네이버 종목 뉴스 API 폴백으로 동작합니다.

## 보안(선택)

`yahoo-proxy.js`의 `ALLOW_ORIGIN`을 `"*"` 대신 본인 사이트로 제한할 수 있습니다:

```js
const ALLOW_ORIGIN = "https://seonu-dragon.github.io";
```

## LLM 경로 Origin 게이트

`/chat`, `?move_analysis=`, `?ticker=` 응답의 한국어 요약(summary) — 즉 **뉴런·Gemini
쿼터를 태우는 단계만** Origin 으로 막습니다. 시세·뉴스·차트·환율 등 나머지 데이터
프록시는 그대로 공개(`ALLOW_ORIGIN = "*"`)입니다.

- 허용: `https://seonu-dragon.github.io`, 그리고 **모든 포트**의
  `http://localhost:<port>` / `http://127.0.0.1:<port>`(로컬 서버·스모크 테스트).
- 거부: **Origin 헤더가 없는 요청**(curl 등 비브라우저), `Origin: null`(file://·
  샌드박스 iframe), 그 외 모든 사이트 → `403 {"error":"forbidden_origin"}`.
- 캐시(KV) 히트도 게이트 **뒤**에 있습니다. 허용되지 않은 호출자는 캐시된 요약도
  받지 못합니다.
- 예전에는 Origin 이 없으면 통과시켰고, 그래서 `curl` 한 줄로 캐시에 없는 티커마다
  LLM 이 새로 돌았습니다(2026-09-03 확인 후 수정).

## 커뮤니티 동시성 — Durable Object (선택)

게시글은 KV 키 하나(`community:v1:posts`)에 배열로 들어 있어, 두 요청이 겹치면 늦게
쓴 쪽이 먼저 쓴 쪽을 덮습니다. 완전한 해결은 단일 writer 인 Durable Object 입니다.

- 바인딩 이름 **`COMMUNITY_DO`** → 클래스 **`CommunityStore`**.
- **바인딩이 없으면 지금까지와 완전히 동일하게** KV + 버전 스탬프 재시도로 동작합니다
  (붙여넣기만 하고 DO 를 안 만들어도 아무것도 깨지지 않습니다).
- DO 는 **Workers 유료 플랜**이 필요하고, 클래스 생성이 `wrangler.toml` 의
  `[[migrations]]` 로만 되기 때문에 최초 1회는 `wrangler deploy` 가 필요합니다
  (`worker/wrangler.toml` 참고).
- 켜면 `/community*` 읽기·쓰기가 전부 인스턴스 하나로 직렬화되고, 첫 요청 때 기존 KV
  값을 DO storage 로 한 번 복사해 옵니다(기존 글 유지).

### `COMMUNITY_SERIALIZED` — 바인딩이 아니라 내부 플래그

`CommunityStore` 가 핸들러에 넘기는 **가짜 env 필드**입니다(대시보드에 넣는 값이 아닙니다).
DO 경로에서는 요청이 이미 한 줄로 직렬화되므로, 이 플래그가 켜져 있으면
`mutateVersionedList` 가 KV 용 write-then-verify 재시도(버전 스탬프 확인 + 3회 재시도)를
건너뛰고 **한 번만 읽고 한 번만 씁니다**. 같은 파일의 `COMMUNITY_KV` 도 DO storage 어댑터로
바꿔치기됩니다. 커뮤니티 저장 로직을 고칠 때 이 두 가지를 같이 보지 않으면, DO 경로에서만
글이 사라지거나 KV 경로에서만 덮어쓰기가 나는 식으로 한쪽이 조용히 깨집니다.

## 자체 검증

```bash
node --check worker/yahoo-proxy.js
node worker/test_worker.mjs      # Node 18+, 네트워크 없이 도는 65개 케이스
```

Origin 게이트·캐시 우회·`?model=` 관리자 제한·IP 리밋·DO/KV 동등성·동시 글쓰기와
2026-09-15 감사 수정분(지수 등락률 산수·부분 실패 lastgood·깨진 답 판정 4경로·모르는
경로 404 no-store·crumb 음성 캐시)을 인메모리 모의 env 로 확인합니다.
대시보드에 붙여넣기 전에 돌려 보세요.

## 캐시·응답 규약(2026-09-15 정리)

- `?ticker=` 와 `?move_analysis=` 응답에는 **`Vary: Origin`** 이 붙습니다. summary·analysis 가
  Origin 게이트 뒤라 같은 URL 이라도 호출자에 따라 내용이 다른데, 예전엔 `public, max-age=900`
  만 있어서 Origin 없는 호출이 만든 "요약 빈" 응답이 15분간 공유될 수 있었습니다.
- **모르는 경로는 `404 {"error":"not_found"}` + `Cache-Control: no-store`** 입니다(예전엔
  `400 missing ticker` 를 15분 캐시했습니다). `ticker` 는 16자로 잘립니다.
- `?fx=`·`?indices=` 는 기대 심볼의 **60% 미만**만 돌아오면 성공으로 보지 않습니다 —
  `lastgood:*` 를 조각으로 덮지 않고, 직전 정상값을 `stale: true` 로 서빙합니다
  (직전값이 없으면 모은 조각 + `partial: true`).
- 야후 crumb 부트스트랩이 실패하면 **5분간 음성 캐시**됩니다. 그동안 `earnings` 는 추가
  호출 없이 `null` 이고, `?earnings_calendar=` 배치도 바로 빈 배열을 돌려줍니다
  (무료 플랜 서브리퀘스트 상한 50 을 태우던 경로).
- `/sync/prefs` **PUT 은 허용 Origin 에서만** 받고, 값은 **180일 TTL** 로 저장하며, 크기
  제한 32KB 는 UTF-16 길이가 아니라 **바이트** 기준입니다.
