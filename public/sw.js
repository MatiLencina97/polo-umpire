const CACHE_PREFIX = "polo-umpire-assistant-";
const CACHE = "polo-umpire-assistant-v0.27-r2-2026";
const OFFLINE_INDEX = "/__polo-umpire-offline-index-v0.27-r2.json";
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

async function missingCached(cache, urls) {
  const checks = await Promise.all(urls.map(async (url) => ({
    url,
    cached: Boolean(await cache.match(url)),
  })));
  return checks.filter((item) => !item.cached).map((item) => item.url);
}

async function readOfflineIndex(cache) {
  const response = await cache.match(OFFLINE_INDEX);
  if (!response) return null;
  try {
    const payload = await response.json();
    return Array.isArray(payload?.urls)
      ? {
          urls: uniqueLocalPaths(payload.urls),
          verifiedAt: typeof payload.verifiedAt === "string" ? payload.verifiedAt : null,
        }
      : null;
  } catch {
    return null;
  }
}

async function writeOfflineIndex(cache, urls) {
  const verifiedAt = new Date().toISOString();
  await cache.put(
    OFFLINE_INDEX,
    new Response(JSON.stringify({ urls, verifiedAt }), {
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    }),
  );
  return verifiedAt;
}

async function keepCurrentAndPreviousCache() {
  const keys = (await caches.keys()).filter((key) => key.startsWith(CACHE_PREFIX));
  const stale = keys.filter((key) => key !== CACHE);
  const previous = stale.at(-1);
  await Promise.all(
    stale
      .filter((key) => key !== previous)
      .map((key) => caches.delete(key)),
  );
}

async function warmOfflinePackage(urls) {
  const cache = await caches.open(CACHE);
  const candidates = uniqueLocalPaths(urls);
  let failed = false;

  for (const url of candidates) {
    try {
      const cached = await cache.match(url);
      if (cached) continue;

      const response = await fetch(url, { cache: "reload", credentials: "same-origin" });
      if (!response.ok) {
        failed = true;
        continue;
      }
      await cache.put(url, response.clone());
    } catch {
      failed = true;
    }
  }

  const missing = await missingCached(cache, candidates);
  const ready = !failed && missing.length === 0;
  const verifiedAt = ready ? await writeOfflineIndex(cache, candidates) : null;

  // Never remove the previous working package until the new one is fully verified.
  if (ready) await keepCurrentAndPreviousCache();

  return { ready, verifiedAt, missing };
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
});

self.addEventListener("activate", (event) => {
  // Do not delete the previous cache here. A newly activated worker can still be
  // missing runtime JS/CSS chunks until the client finishes WARM_CACHE.
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "WARM_CACHE" || event.data?.type === "REPAIR_OFFLINE") {
    event.waitUntil((async () => {
      const result = await warmOfflinePackage(event.data.urls);
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) => client.postMessage({
        type: "OFFLINE_READY",
        ...result,
      }));
      event.ports?.[0]?.postMessage(result);
    })());
  }

  if (event.data?.type === "OFFLINE_STATUS" && event.ports?.[0]) {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      const index = await readOfflineIndex(cache);
      const missing = index?.urls?.length ? await missingCached(cache, index.urls) : [...CORE];
      const ready = Boolean(index?.urls?.length) && missing.length === 0;
      event.ports[0].postMessage({
        ready,
        verifiedAt: index?.verifiedAt ?? null,
        missing,
      });
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
      const cached = (await caches.match(request)) || (await caches.match("/"));

      if (cached) {
        // Launch from disk immediately. Refresh the shell in the background when online.
        event.waitUntil((async () => {
          try {
            const response = await fetch(request);
            if (response.ok) {
              const cache = await caches.open(CACHE);
              await cache.put(request.url === self.location.origin + "/" ? "/" : request, response.clone());
            }
          } catch {
            // Offline is expected.
          }
        })());
        return cached;
      }

      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        return Response.error();
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
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      return Response.error();
    }
  })());
});
