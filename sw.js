const BUILD_ID_FALLBACK = "20260701a";
let ACTIVE_CACHE_NAME = null;

const OFFLINE_ASSETS = [
  "./",
  "./index.html",
  "./build_id.js",
  "./market_config.js",
  "./app.js",
  "./styles.css",
  "./manifest.webmanifest",
  "./analysis.js",
  "./pattern_detectors_extended.js",
  "./data/ticker_aliases_ko.js",
  "./data/market_snapshot.js",
  "./data/market_snapshot.json",
  "./data/korea/market_snapshot.js",
  "./data/korea/market_snapshot.json",
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

function isDynamicAsset(pathname) {
  return (
    pathname.endsWith("/") ||
    pathname.endsWith("/index.html") ||
    pathname.endsWith("/sw.js") ||
    pathname.endsWith("/build_id.js") ||
    pathname.endsWith("/app.js") ||
    pathname.endsWith("/styles.css") ||
    pathname.endsWith("/manifest.webmanifest") ||
    pathname.includes("/data/market_snapshot") ||
    pathname.includes("/data/korea/market_snapshot") ||
    pathname.includes("/data/content_sources") ||
    /\.(js|css|json|webmanifest)$/.test(pathname)
  );
}

function isDetailData(pathname) {
  return pathname.includes("/data/details/") || pathname.includes("/data/korea/details/");
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);
  return cached || network || fetch(request);
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
      if (isDynamicAsset(url.pathname)) {
        return networkFirst(req, cacheName);
      }
      if (/\.(png|ico|jpg|jpeg|svg|webp)$/i.test(url.pathname)) {
        return staleWhileRevalidate(req, cacheName);
      }
      return networkFirst(req, cacheName);
    })
  );
});