/**
 * 종목 상세 파일(data/details/<T>.json · data/korea/details/<T>.json)을 어디서 받을지 한 곳에서 정한다.
 *
 * 배경: 두 폴더가 배포 아티팩트의 80%라(CLAUDE.md '알려진 부채') Cloudflare R2 로 옮길 수 있게
 * 기능 플래그를 둔다. **detailsBase 가 빈 문자열이면 지금과 완전히 같다** — 요청 URL 은 예전과
 * 같은 상대 경로("data/details/NVDA.json")이고 fetch 도 한 번뿐이다.
 *
 * detailsBase 를 R2 공개 URL(예: "https://pub-xxxx.r2.dev" 또는 커스텀 도메인, 끝 슬래시 없이)로
 * 채우면 `${detailsBase}/data/details/NVDA.json` 을 먼저 요청한다(버킷 안 키가 레포 경로와 같다 —
 * deploy-pages.yml 'Sync details to R2' 스텝이 그렇게 올린다). R2 가 네트워크 오류·HTTP 오류
 * (404 포함)면 pagesFallback 이 true 일 때 Pages 상대 경로로 **한 번만** 다시 받는다 — 플래그 전환
 * 과도기(아직 업로드 안 된 파일, 버킷 CORS 미설정)에 화면이 비지 않게 하는 장치다.
 *
 * 켜는 순서·되돌리는 법은 DEPLOY.md 'R2 종목 상세(details)' 절. 키 정규화(국내 6자리 패딩, 미국
 * 대문자·예약어 _CON 등)는 호출하는 쪽 책임이고 여기서는 받은 키를 encodeURIComponent 만 한다.
 *
 * 서비스 워커: sw.js 는 상세 파일을 가로채지 않는다(같은 출처면 isDetailData 로 통과, R2 같은
 * 다른 출처는 출처 검사에서 통과). 즉 어느 쪽이든 브라우저 HTTP 캐시 + 네트워크이고 cacheFirst
 * 로 굳는 일이 없다.
 */
(function () {
  const DETAILS_CONFIG = {
    // 비어 있으면 Pages(지금 그대로). 예: "https://pub-0123456789abcdef.r2.dev"
    detailsBase: "",
    // detailsBase 가 있을 때 R2 실패 시 Pages 로 한 번 폴백. Pages 스테이징에서 details 를 뺀 뒤
    // (DEPLOY.md R2 절 3단계) 몇 주 지나 R2 가 안정적이면 false 로 바꿔 404 이중 요청을 없앨 수 있다.
    pagesFallback: true,
  };

  const DIRS = { us: "data/details", kr: "data/korea/details" };

  function currentMarket() {
    return window.MIR_MARKET_MODE === "kr" ? "kr" : "us";
  }

  // window.MIR_DETAILS_BASE(문자열)가 있으면 설정값보다 우선한다 — 스모크·Playwright 에서
  // 페이지 스크립트보다 먼저 주입해 R2 경로를 시험하는 용도. URL 쿼리로는 받지 않는다
  // (링크 하나로 남의 호스트 데이터를 화면에 띄우게 되므로).
  function detailsBase() {
    const override = window.MIR_DETAILS_BASE;
    const raw = typeof override === "string" ? override : DETAILS_CONFIG.detailsBase;
    return String(raw || "").trim().replace(/\/+$/, "");
  }

  // Pages 기준 상대 경로. 예전 각 파일의 `data/details/${encodeURIComponent(key)}.json` 과 같은 문자열.
  function mirDetailsPath(key, market) {
    const m = market === "kr" || market === "us" ? market : currentMarket();
    return `${DIRS[m]}/${encodeURIComponent(String(key == null ? "" : key))}.json`;
  }

  // 실제로 먼저 요청할 URL. detailsBase 가 비면 상대 경로 그대로.
  function mirDetailsUrl(key, market) {
    const rel = mirDetailsPath(key, market);
    const base = detailsBase();
    return base ? `${base}/${rel}` : rel;
  }

  // fetch 와 같은 Response 를 돌려준다(호출부의 res.ok / res.json() / res.text() 그대로).
  async function mirFetchDetail(key, market, init) {
    const rel = mirDetailsPath(key, market);
    const base = detailsBase();
    if (!base) return fetch(rel, init);
    const primary = `${base}/${rel}`;
    if (!DETAILS_CONFIG.pagesFallback) return fetch(primary, init);
    try {
      const res = await fetch(primary, init);
      if (res && res.ok) return res;
    } catch (_) {
      // 네트워크·CORS 오류 → 아래 Pages 폴백
    }
    return fetch(rel, init);
  }

  window.MirDetails = {
    config: DETAILS_CONFIG,
    base: detailsBase,
    path: mirDetailsPath,
    url: mirDetailsUrl,
    fetch: mirFetchDetail,
  };
  window.mirDetailsUrl = mirDetailsUrl;
  window.mirFetchDetail = mirFetchDetail;
})();
