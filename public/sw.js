const CACHE = "umpire-polo-assistant-v0.18-2026";
const CORE = [
  "/",
  "/manifest.webmanifest",
  "/logo.png",
  "/data/manifest.json",
  "/data/rules-2026.json",
  "/data/resources-2026.json",
  "/logo.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "WARM_CACHE") {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      const urls = [...new Set([...(event.data.urls || []), ...CORE])];
      await Promise.all(urls.map(async (url) => {
        try { await cache.add(url); } catch { /* keep warming other assets */ }
      }));
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) => client.postMessage({ type: "OFFLINE_READY" }));
    })());
  }

  if (event.data?.type === "OFFLINE_STATUS" && event.ports?.[0]) {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      const checks = await Promise.all(CORE.map((url) => cache.match(url)));
      event.ports[0].postMessage({ ready: checks.every(Boolean) });
    })());
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        const cache = await caches.open(CACHE);
        cache.put("/", response.clone());
        return response;
      } catch {
        return (await caches.match("/")) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE);
        cache.put(request, response.clone());
      }
      return response;
    } catch {
      return Response.error();
    }
  })());
});
