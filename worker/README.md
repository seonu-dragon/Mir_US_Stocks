# 실시간 뉴스·차트 프록시 (Cloudflare Worker)

GitHub Pages는 정적 호스팅이라 방문자가 페이지를 열어도 서버에서 파이썬을 실행할 수 없습니다.
이 Worker는 Cloudflare 무료 요금제에서 돌아가며, 종목 분석 페이지를 열 때 야후 파이낸스
**뉴스와 실제 차트**를 그 자리에서 가져와 CORS 허용 JSON으로 돌려줍니다.

## 배포 (1회, 무료)

1. https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Worker**
2. 템플릿 코드를 지우고 [`yahoo-proxy.js`](./yahoo-proxy.js) 내용을 붙여넣은 뒤 **Deploy**
3. 배포된 주소 복사 (예: `https://mir-yahoo.yourname.workers.dev`)
4. 저장소의 `app.js`에서 아래 값을 그 주소로 변경 후 푸시:
   ```js
   const LIVE_DATA_PROXY = "https://mir-yahoo.yourname.workers.dev";
   ```

## 동작

- 호출: `GET https://<worker>/?ticker=NVDA`
- 응답: `{ "ticker": "NVDA", "news": [...], "chart": [[o,h,l,c,v], ...] }`
- 분석 페이지를 열면 프론트가 이 주소를 호출해 **뉴스를 실시간으로** 채우고,
  합성차트였던 종목(FLNT·STTK 등)도 **실제 차트로 자동 교체**합니다.
- 호출 실패 시에는 빌드 때 미리 저장해 둔 상세파일 뉴스로 자동 폴백합니다.
- Worker 응답은 엣지에서 15분 캐시되어 야후 호출 부담을 줄입니다.

## 보안(선택)

`yahoo-proxy.js`의 `ALLOW_ORIGIN`을 `"*"` 대신 본인 사이트로 제한할 수 있습니다:

```js
const ALLOW_ORIGIN = "https://seonu-dragon.github.io";
```
