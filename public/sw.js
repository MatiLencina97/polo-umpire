const CACHE = "polo-umpire-assistant-v0.27-2026";
const OFFLINE_INDEX = "/__polo-umpire-offline-index-v0.27.json";
const CORE = [
  "/",
  "/manifest.webmanifest",
  "/logo.png",
  "/data/manifest.json",
  "/data/rules-2026.json",
  "/data/resources-2026.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

function uniqueLocalPaths(urls) {
  const paths = [];
  for (const value of urls || []) {
    try {
      const url = new URL(value, self.location.origin);
      if (url.origin !== self.location.origin) continue;
      paths.push(url.pathname + url.search);
    } catch {
      // Ignore malformed cache candidates.
    }
  }
  return [...new Set([...CORE, ...paths])];
}

async function allCached(cache, urls) {
  const checks = await Promise.all(urls.map((url) => cache.match(url)));
  return checks.every(Boolean);
}

async function readOfflineIndex(cache) {
  const response = await cache.match(OFFLINE_INDEX);
  if (!response) return null;
  try {
    const payload = await response.json();
    return Array.isArray(payload?.urls) ? uniqueLocalPaths(payload.urls) : null;
  } catch {
    return null;
  }
}

async function writeOfflineIndex(cache, urls) {
  await cache.put(
    OFFLINE_INDEX,
    new Response(JSON.stringify({ urls }), {
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    }),
  );
}

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
      const urls = uniqueLocalPaths(event.data.urls);
      let failed = false;

      await Promise.all(urls.map(async (url) => {
        try {
          const cached = await cache.match(url);
          if (!cached) await cache.add(url);
        } catch {
          failed = true;
        }
      }));

      const ready = !failed && await allCached(cache, urls);
      if (ready) await writeOfflineIndex(cache, urls);

      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) => client.postMessage({ type: "OFFLINE_READY", ready }));
    })());
  }

  if (event.data?.type === "OFFLINE_STATUS" && event.ports?.[0]) {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      const urls = await readOfflineIndex(cache);
      const ready = Boolean(urls?.length) && await allCached(cache, urls);
      event.ports[0].postMessage({ ready });
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
