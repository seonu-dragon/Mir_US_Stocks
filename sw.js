const BUILD_ID_FALLBACK = "db2109c12e";
let ACTIVE_CACHE_NAME = null;

// 내비게이션 셸만 미리 받는다. app.js/styles.css 같은 자산은 페이지가 ?v=<내용해시>
// 를 붙여 요청하므로 여기에 버전 없는 URL 로 넣어두면 캐시 키가 달라 영영 매칭되지
// 않는다(예전엔 그렇게 들어가 있었고, 순수 낭비였다). 그런 자산은 런타임에 cacheFirst
// 로 잡히고, 스냅샷(수 MB×4)도 첫 방문 때 런타임 캐시에 들어간다 — install 단계에서
// 24MB 를 받아두던 걸 없앴다.
const OFFLINE_ASSETS = [
  "./",
  "./index.html",
  "./analysis.html",
  "./manifest.webmanifest",
  "./assets/favicon.ico",
  "./assets/favicon-32.png",
  "./assets/apple-touch-icon.png",
  "./assets/mir-mascot.png"
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
      // 내용해시로 버전이 박힌 자산은 불변으로 취급 → 캐시 우선.
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