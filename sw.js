const CACHE_NAME = "mir-us-stocks-v20260620q";

const OFFLINE_ASSETS = [
  "./assets/favicon.ico",
  "./assets/favicon-32.png",
  "./assets/apple-touch-icon.png",
  "./assets/mir-mascot.png"
];

function isDynamicAsset(pathname) {
  return (
    pathname.endsWith("/") ||
    pathname.endsWith("/index.html") ||
    pathname.endsWith("/sw.js") ||
    pathname.endsWith("/app.js") ||
    pathname.endsWith("/styles.css") ||
    pathname.endsWith("/manifest.webmanifest") ||
    pathname.includes("/data/market_snapshot") ||
    pathname.includes("/data/content_sources") ||
    /\.(js|css|json|webmanifest)$/.test(pathname)
  );
}

function isDetailData(pathname) {
  return pathname.includes("/data/details/");
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(OFFLINE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
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

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
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

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (isDetailData(url.pathname)) return;

  if (isDynamicAsset(url.pathname)) {
    event.respondWith(networkFirst(req));
    return;
  }

  if (/\.(png|ico|jpg|jpeg|svg|webp)$/i.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  event.respondWith(networkFirst(req));
});