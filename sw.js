const BUILD_ID_FALLBACK = "8261edca66";
let ACTIVE_CACHE_NAME = null;

// 내비게이션 셸만 미리 받는다. app.js/styles.css 같은 자산은 페이지가 ?v=<내용해시>
// 를 붙여 요청하므로 여기에 버전 없는 URL 로 넣어두면 캐시 키가 달라 영영 매칭되지
// 않는다(예전엔 그렇게 들어가 있었고, 순수 낭비였다). 그런 자산은 런타임에 cacheFirst
// 로 잡히고, 스냅샷(수 MB×4)도 첫 방문 때 런타임 캐시에 들어간다 — install 단계에서
// 24MB 를 받아두던 걸 없앴다.
// (2026-09-15) mir-mascot.png(220KB)은 어디서도 렌더하지 않는데 첫 방문마다 받아
// 왔다 — 뺐다. app.js 가 쓰는 건 mir-mascot-fly.png 로 다른 파일이고, 그건 런타임
// staleWhileRevalidate 로 잡힌다.
const OFFLINE_ASSETS = [
  "./",
  "./index.html",
  "./analysis.html",
  "./manifest.webmanifest",
  "./assets/favicon.ico",
  "./assets/favicon-32.png",
  "./assets/apple-touch-icon.png"
];

function parseBuildId(text) {
  const m = String(text || "").match(/MIR_BUILD_ID\s*=\s*"([^"]+)"/);
  return m ? m[1] : null;
}

async function ensureCacheName() {
  if (ACTIVE_CACHE_NAME) return ACTIVE_CACHE_NAME;
  try {
    const res = await fetch("./build_id.js", { cache: "no-store" });
    const text = await res.text();
    const id = parseBuildId(text) || BUILD_ID_FALLBACK;
    ACTIVE_CACHE_NAME = `mir-us-stocks-v${id}`;
  } catch (_) {
    ACTIVE_CACHE_NAME = `mir-us-stocks-v${BUILD_ID_FALLBACK}`;
  }
  return ACTIVE_CACHE_NAME;
}

function isDetailData(pathname) {
  return pathname.includes("/data/details/") || pathname.includes("/data/korea/details/");
}

// 캐시 쓰기는 실패해도 응답에 영향이 없어야 한다. put() 을 await 하지 않고 던져두면
// 같은 URL 을 동시에 요청했을 때 "Entry already exists" 로 거절되면서 잡을 곳이 없어
// unhandled rejection 이 된다(콘솔에 계속 찍히던 그 오류). 여기서 삼킨다.
function safePut(cache, request, response) {
  return cache.put(request, response).catch(() => {});
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      safePut(cache, request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

// ?v=<내용해시> 가 붙은 요청 전용. 해시가 URL 에 있으니 내용이 바뀌면 URL 이 바뀌고,
// 같은 URL 이면 내용도 같다 — 재검증 없이 캐시에서 즉시 준다(app.js 800KB 등).
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.status === 200) {
    safePut(cache, request, response.clone());
  }
  return response;
}

// 내비게이션(주소창·링크로 페이지를 여는 요청) 전용. 오프라인일 때 캐시에서
// 정확히 같은 URL 을 찾으면 그걸 주고, 없으면 쿼리를 무시하고 셸을 찾는다.
// 이 사이트의 모든 화면은 index.html?tab=… / analysis.html?t=… 처럼 쿼리로만
// 갈리는데, 프리캐시에는 쿼리 없는 "./index.html" 하나만 들어 있어서 예전엔
// 오프라인에서 탭 링크로 들어오면 전부 캐시 미스가 났다(2026-09-15 감사).
async function navigationFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      safePut(cache, request, response.clone());
    }
    return response;
  } catch (err) {
    const exact = await cache.match(request);
    if (exact) return exact;
    const shell = await cache.match(request, { ignoreSearch: true });
    if (shell) return shell;
    const home = await cache.match("./index.html", { ignoreSearch: true });
    if (home) return home;
    throw err;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        safePut(cache, request, response.clone());
      }
      return response;
    })
    .catch(() => null);
  if (cached) return cached;
  const response = await network;
  if (response) return response;
  // network 는 Promise 라 || 폴백이 절대 발동하지 않았고, 실패 시 null 이
  // respondWith 로 흘러갔다. 명시적 오프라인 응답으로 대체.
  return new Response("offline", { status: 503 });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    ensureCacheName()
      .then((name) => caches.open(name))
      .then((cache) => cache.addAll(OFFLINE_ASSETS).catch(() => Promise.resolve()))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    ensureCacheName()
      .then((name) => caches.keys().then((keys) => Promise.all(
        keys.filter((k) => k !== name).map((k) => caches.delete(k))
      )))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (isDetailData(url.pathname)) return;

  event.respondWith(
    ensureCacheName().then((cacheName) => {
      // data/ 아래 피처 데이터(insider·congress·13F·게이지…)는 ?v= 가 붙어 있어도
      // 불변이 아니다. app.js 의 featureDataSrc 가 ?v=MIR_BUILD_ID 를 붙이는데 이 ID 는
      // 코드 배포 때만 바뀌므로, cacheFirst 로 두면 재방문자는 다음 코드 배포까지
      // 처음 본 날짜의 데이터를 계속 본다(2026-08-07~09-03 실제 발생). 항상 네트워크 우선.
      if (url.pathname.includes("/data/")) {
        return networkFirst(req, cacheName);
      }
      // 페이지 이동은 쿼리를 무시한 셸 폴백까지 본다(위 navigationFirst 주석).
      if (req.mode === "navigate") {
        return navigationFirst(req, cacheName);
      }
      // 내용해시로 버전이 박힌 자산(app.js·styles.css 등)은 불변으로 취급 → 캐시 우선.
      if (url.searchParams.has("v")) {
        return cacheFirst(req, cacheName);
      }
      if (/\.(png|ico|jpg|jpeg|svg|webp)$/i.test(url.pathname)) {
        return staleWhileRevalidate(req, cacheName);
      }
      // 나머지(HTML, 스냅샷 JSON 등 버전 없는 URL)는 항상 최신 우선.
      return networkFirst(req, cacheName);
    })
  );
});