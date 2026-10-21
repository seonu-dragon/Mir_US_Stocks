# 한 번에 할 일 — Cloudflare 설정 체크리스트(사람이 직접)

> 이 문서는 배포에 올라가지 않는다(`mir_design/` 은 rsync 제외).
> 코드는 전부 **키·바인딩이 없으면 예전 동작 그대로**로 머지돼 있다. 아래를 한 번에 하면 켜진다.
> 순서: **워커 재배포(A) → 바인딩·나머지 시크릿(B·C) → 프런트 키(D) 라이브 반영 → 마지막에 `TURNSTILE_SECRET`**.
> 프런트가 토큰을 보내는데 워커에 시크릿이 없으면 토큰은 그냥 무시된다(안 깨짐). 반대로 시크릿이 먼저
> 들어가고 프런트 키가 비어 있으면 그동안 글·댓글·투표가 막힌다. 그래서 시크릿은 맨 마지막이다.
>
> 섹션은 PR 이 추가될 때마다 메인 세션이 보강한다. 각 섹션 끝의 "출처 PR" 줄에 근거 PR 을 적는다.
> 값(키·토큰)은 이 문서에 **절대 쓰지 않는다** — 위치만 적는다.

워커 주소(현재 프런트가 부르는 곳): `https://mirusstocks.planbesides.workers.dev` (`app.js` 의 `LIVE_DATA_PROXY`)

---

## A. yahoo-proxy 워커 재배포

워커는 머지해도 반영되지 않는다(대시보드 붙여넣기 수동 배포). 아래 PR 이 **전부 main 에 머지된 뒤** 한 번만 하면 된다.

- [ ] 미반영 PR: #292 · #295 · #298 · #300 (이미 머지됨, 라이브 워커에는 아직 없음)
- [ ] 이번 라운드 PR: (메인 세션이 머지 후 번호 추가 — Cloudflare 플랫폼 PR, 데이터 라우트 ?symsearch ?insights ?options PR 등)

절차
1. 로컬에서 최신 main 받기 → 붙여넣기 전 검증:
   ```powershell
   git pull origin main
   node --check worker/yahoo-proxy.js
   node worker/test_worker.mjs
   ```
2. https://dash.cloudflare.com → **Workers & Pages** → 워커 `mirusstocks`(주소의 첫 부분) → 오른쪽 위 **Edit code**
3. 에디터 내용을 전부 지우고 main 의 `worker/yahoo-proxy.js` **전체**를 붙여넣기 → **Deploy**
4. 아래 F 의 확인 명령으로 새 코드가 떴는지 본다.

출처 PR: #292 · #295 · #298 · #300

---

## B. 워커 Secrets

위치: **Workers & Pages → mirusstocks → Settings → Variables and Secrets → Add** → Type **Secret** → 이름/값 → **Deploy**.
값은 레포 루트 `.env`(git 에 안 올라감)에서 복사한다. 이미 있는 것은 건너뛴다.

| 이름 | 필수? | 없으면 | 값 위치 |
|---|---|---|---|
| `NAVER_APIHUB_KEY_ID` | 권장 | 옛 `NAVER_CLIENT_ID/SECRET` → 그것도 없으면 Google News RSS 폴백 | `.env` 의 같은 이름 |
| `NAVER_APIHUB_KEY` | 권장 | 위와 같음 | `.env` 의 같은 이름 |
| `TURNSTILE_SECRET` | 선택 | 커뮤니티 쓰기 Turnstile 검증 생략(지금과 같음) | D-1 에서 만든 Turnstile 위젯의 **Secret Key** |
| `IP_HASH_SALT` | 사실상 필수 | 공개 기본 솔트 사용(DEPLOY.md 3번 참고) | 아무 긴 임의 문자열(새로 만들면 됨) |
| `COMMUNITY_ADMIN_KEY` · `GEMINI_API_KEY` · `FINNHUB_API_KEY` | 기존 | — | 이미 설정돼 있으면 그대로 |

- `TURNSTILE_SECRET` 을 넣으면 그 순간부터 글·댓글·투표 POST 는 토큰이 **필수**다. 그러니 D-2(프런트 사이트 키)
  PR 이 **라이브에 반영된 것을 확인한 뒤**(`curl -s https://seonu-dragon.github.io/Mir_US_Stocks/index.html | grep bundle.js`
  해시가 바뀌었는지) 맨 마지막에 넣는다. 되돌리려면 이 시크릿만 지우면 된다(즉시 검증 생략으로 돌아감).

출처 PR: (이번 Cloudflare 플랫폼 PR)

---

## C. 바인딩

위치: **Workers & Pages → mirusstocks → Settings → Bindings → Add**.

### C-1. Rate Limiting(선택)

- 이름이 `RL_<버킷>` 인 바인딩이 있으면 그 버킷은 KV 카운터 대신 Cloudflare Rate Limiting 으로 센다
  (KV 쓰기 0 — 무료 플랜 KV 쓰기 1,000/일을 리밋 카운터가 태우던 것을 덜어 준다). 없거나 실패하면 기존 KV 방식.
- **Add 목록에 "Rate limiting" 이 보이면** 거기서 만든다. 안 보이면 `worker/wrangler.toml` 하단 주석을 풀고
  `wrangler deploy` 로만 만들 수 있다(이때 같은 파일의 KV id 를 채우고, 무료 플랜이면 Durable Object 블록을 지울 것.
  대시보드에서 만든 일반 변수는 wrangler 배포 때 덮일 수 있으니 Secret 으로 둔다).
- 권장 한도(= 지금 코드의 KV 한도, 전부 period 60초). 필요한 것만 만들면 된다 — 위 4개가 효과가 가장 크다.

| 바인딩 이름 | limit / 60초 | 경로 |
|---|---|---|
| `RL_POST` | 3 | 글쓰기 |
| `RL_COMMENT` | 6 | 댓글 |
| `RL_VOTE` | 5 | 투표 |
| `RL_LIKE` | 30 | 공감 |
| `RL_REPORT` | 5 | 신고 |
| `RL_CLEAR` | 2 | 내 글 전체 삭제 |
| `RL_SYNC_PUT` | 10 | 클라우드 동기화 저장 |
| `RL_CHAT` · `RL_SUMMARY` | 10 | 챗봇 · 종목 요약 |
| `RL_MOVE` | 6 | 원인 분석 |
| `RL_EVNEWS` | 20 | 큰 등락일 뉴스 |

### C-2. 기존 바인딩(확인만)

`AI`(Workers AI) · `MOVE_CACHE`(KV) · `COMMUNITY_KV`(KV) · (선택) `COMMUNITY_DO`. 목록은 DEPLOY.md 3번.

출처 PR: (이번 Cloudflare 플랫폼 PR)

---

## D. 프런트 공개 키(PR 로 넣는다)

둘 다 **공개값**이라 레포에 커밋해도 된다. 넣는 곳은 `market_config.js` 맨 아래 `MIR_CLOUDFLARE_DEFAULTS`.
넣은 뒤 `py scripts/stamp_build_id.py` → PR → 머지(빈 값이면 아무 요청도 하지 않는다).

### D-1. Turnstile 위젯 만들기

1. https://dash.cloudflare.com → 왼쪽 메뉴 **Turnstile**(새 메뉴 구조에서는 **Application security → Turnstile**) → **Add widget**
2. Widget name: `mir-community` / Hostname: `seonu-dragon.github.io` (로컬 테스트도 할 거면 `localhost` 추가)
3. Widget mode: **Managed** → Create
4. 나오는 **Site Key** → D-2 의 `turnstileSiteKey`, **Secret Key** → B 의 `TURNSTILE_SECRET`

### D-2. 사이트 키 넣기

- `market_config.js` → `MIR_CLOUDFLARE_DEFAULTS.turnstileSiteKey: "<Site Key>"`
- 동작: 글 본문·댓글·투표 종목 칸에 처음 포커스할 때 위젯 스크립트를 받고, 보낼 때마다 토큰을 한 번 받아
  본문 `turnstileToken` 으로 싣는다. 위젯은 평소엔 안 보이고 사람 확인이 필요할 때만 화면 아래에 뜬다.

### D-3. Web Analytics 토큰

1. https://dash.cloudflare.com → **Analytics & Logs → Web Analytics** → **Add a site**
2. Hostname: `seonu-dragon.github.io` → Done → 나오는 JS 스니펫의 `data-cf-beacon='{"token": "…"}'` 에서 token 값만 복사
   (DNS 가 Cloudflare 가 아니므로 "자동 설정"이 아니라 JS 스니펫 방식이다)
3. `market_config.js` → `MIR_CLOUDFLARE_DEFAULTS.webAnalyticsToken: "<token>"`
- 동작: index·analysis 에서 `static.cloudflareinsights.com/beacon.min.js` 하나를 defer 로 넣는다. 쿠키 없음.
  로컬(localhost·127.0.0.1·file://)에선 넣지 않는다. 사이트에 CSP 가 없고 SW(`sw.js`)는 다른 출처 요청을
  건드리지 않아 충돌이 없다(2026-10-21 확인).

출처 PR: (이번 Cloudflare 플랫폼 PR)

---

## E. R2(자리만 — 다른 PR 이 준비 중)

- [ ] (메인 세션이 R2 PR 내용으로 채움: 버킷 이름, 바인딩 이름, 업로드 방식, 공개 URL/커스텀 도메인, 프런트 설정 위치)

출처 PR: (미정)

---

## F. 배포 후 확인(한 줄씩)

PowerShell 에서는 `curl` 대신 `curl.exe` 로 칠 것. `$W = "https://mirusstocks.planbesides.workers.dev"`.

```bash
W=https://mirusstocks.planbesides.workers.dev

# 1) 새 코드가 떴는지: 같은 요청 두 번 → 두 번째 응답 헤더에 X-Mir-Edge-Cache: HIT (같은 콜로일 때)
curl -s -D - -o /dev/null "$W/?fng=1" | grep -i x-mir-edge-cache
curl -s -D - -o /dev/null "$W/?fng=1" | grep -i x-mir-edge-cache

# 2) Turnstile 켜짐 확인(B 에서 TURNSTILE_SECRET 넣은 뒤): 토큰 없는 글쓰기 → 403 turnstile_required
#    (검증에서 막히므로 실제 글은 생기지 않는다)
curl -s -X POST "$W/community" -H "Content-Type: application/json" -d '{"clientId":"probe","content":"probe"}'

# 3) Turnstile 꺼짐(시크릿 없음)일 때는 위 요청을 보내지 말 것 — 진짜 글이 올라간다.
#    대신 읽기만 확인:
curl -s "$W/community?limit=1" | head -c 200

# 4) 데이터 라우트 기본 동작
curl -s "$W/?fx=1" | head -c 200
curl -s "$W/?indices=1" | head -c 200
```

- 사이트: 라이브에서 종목 토론 탭 → 글쓰기 한 번(사이트 키를 넣은 뒤라면 위젯이 필요할 때만 잠깐 뜬다).
- Web Analytics: 토큰을 넣고 배포한 뒤 몇 분 지나 대시보드 **Web Analytics** 에 방문이 잡히는지.
  브라우저 개발자 도구 Network 에 `beacon.min.js` 와 `cloudflareinsights.com/cdn-cgi/rum` 이 보이면 정상.

출처 PR: (이번 Cloudflare 플랫폼 PR)
