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
- `POST /community/report` — 신고 `{ postId, clientId, reason? }`. 전체 숨김은 하지 않고 신고자 본인만 클라이언트에서 가림. 신고 로그만 적재.
- `GET /community/reports?adminKey=KEY` — **관리자 전용** 신고된 글+사유 목록
- `POST /community/vote` — 종목 투표 `{ ticker, choice(buy|sell|hold), clientId }`. **하루 1표**(같은 날 재투표 시 교체). 별도 KV 키에 35일 보관.
- `GET /community/votes?period=day|week|month&clientId=...` — 종목별 투표 순위(+ `myToday`)
- 프론트는 `LIVE_DATA_PROXY` 주소 뒤에 위 경로를 붙여 호출하며, 종목 토론 탭에서 약 12초마다 자동 새로고침합니다.

### 관리자(신고 내역) 설정 — 선택

- 신고된 글을 검토·삭제하려면 Worker → **Settings → Variables and Secrets**에 Secret **`COMMUNITY_ADMIN_KEY`**(아무 비밀 문자열)를 추가하고 **Deploy**.
- 그 뒤 사이트를 **`?cadmin=설정한키`**로 한 번 접속하면 해당 브라우저가 관리자로 기억되어, 종목 토론 상단에 **🛡 신고 내역** 패널(글 삭제 가능)이 표시됩니다.
- 키를 설정하지 않으면 신고 로그는 쌓이되 관리자 조회는 비활성화됩니다(`403`).

## 사이트 도우미 챗봇 (`POST /chat`)

- 같은 Worker에 챗봇 엔드포인트가 포함돼 있습니다. **추가 배포 없이** `yahoo-proxy.js`를
  다시 붙여넣어 Deploy 하면 됩니다(Workers AI `AI` 바인딩을 그대로 사용 → 추가 비용/키 없음).
- 호출: `POST https://<worker>/chat`  body: `{ "messages": [{ "role": "user", "content": "PER이 뭐야?" }] }`
- 응답: `{ "reply": "...", "model": "..." }`
- 사이트 사용법과 PER·ROE 등 금융 기본 용어를 한국어로 설명합니다. 시스템 프롬프트에
  사이트 구성·용어 사전이 들어 있어, 특정 종목 매수/매도 추천은 하지 않습니다.
- 프론트는 `app.js`의 `LIVE_DATA_PROXY` 주소 뒤에 `/chat`을 붙여 호출합니다(우하단 "💬 도우미").

## 보안(선택)

`yahoo-proxy.js`의 `ALLOW_ORIGIN`을 `"*"` 대신 본인 사이트로 제한할 수 있습니다:

```js
const ALLOW_ORIGIN = "https://seonu-dragon.github.io";
```
