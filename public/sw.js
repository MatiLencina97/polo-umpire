const CACHE_PREFIX = "polo-umpire-assistant-";
const CACHE = "polo-umpire-assistant-v0.27.5-r1-2026";
const OFFLINE_INDEX = "/__polo-umpire-offline-index.json";
const PACKAGE_CORE = [
  "/",
  "/manifest.webmanifest",
  "/logo.png",
  "/data/manifest.json",
  "/data/rules-2026.json",
  "/data/resources-2026.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];
const INSTALL_CORE = PACKAGE_CORE.filter((url) => url !== "/");
const REFRESH_WHEN_ONLINE = new Set([
  "/manifest.webmanifest",
  "/data/manifest.json",
  "/data/rules-2026.json",
  "/data/resources-2026.json",
]);

function localPath(value) {
  try {
    const url = new URL(value, self.location.origin);
    if (url.origin !== self.location.origin) return null;
    return url.pathname + url.search;
  } catch {
    return null;
  }
}

function uniqueLocalPaths(urls, includeCore = true) {
  const paths = [];
  for (const value of urls || []) {
    const path = localPath(value);
    if (path) paths.push(path);
  }
  return [...new Set([...(includeCore ? PACKAGE_CORE : []), ...paths])];
}

function shellAssetPaths(html) {
  const found = [];
  const attributePattern = /(?:src|href)=["']([^"']+)["']/gi;
  for (const match of html.matchAll(attributePattern)) {
    const path = localPath(match[1]);
    if (!path) continue;
    if (
      path.startsWith("/_next/") ||
      path.startsWith("/icons/") ||
      path === "/logo.png" ||
      path === "/manifest.webmanifest"
    ) {
      found.push(path);
    }
  }
  return [...new Set(found)];
}

async function missingInCache(cache, urls) {
  const checks = await Promise.all(urls.map(async (url) => ({
    url,
    cached: Boolean(await cache.match(url)),
  })));
  return checks.filter((item) => !item.cached).map((item) => item.url);
}

async function previousCacheNames() {
  const keys = (await caches.keys()).filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE);
  return keys.reverse();
}

async function matchPrevious(request) {
  for (const name of await previousCacheNames()) {
    const cache = await caches.open(name);
    const response = await cache.match(request);
    if (response) return response;
  }
  return undefined;
}

async function matchCurrentThenPrevious(request) {
  const current = await caches.open(CACHE);
  return (await current.match(request)) || (await matchPrevious(request));
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

async function existingOfflineStatus() {
  const cache = await caches.open(CACHE);
  const index = await readOfflineIndex(cache);
  if (!index?.urls?.length) {
    return { ready: false, verifiedAt: null, missing: [...PACKAGE_CORE] };
  }

  const missing = await missingInCache(cache, index.urls);
  return {
    ready: missing.length === 0,
    verifiedAt: index.verifiedAt,
    missing,
  };
}

async function fetchAndStore(cache, path, forceRefresh = false) {
  if (!forceRefresh && await cache.match(path)) return true;

  const response = await fetch(path, {
    cache: forceRefresh ? "reload" : "default",
    credentials: "same-origin",
  });
  if (!response.ok) return false;
  await cache.put(path, response.clone());
  return true;
}

async function warmOfflinePackage(urls) {
  const cache = await caches.open(CACHE);

  let shellResponse;
  let discoveredAssets = [];
  try {
    shellResponse = await fetch("/", { cache: "reload", credentials: "same-origin" });
    if (!shellResponse.ok) throw new Error("shell");
    const html = await shellResponse.clone().text();
    discoveredAssets = shellAssetPaths(html);
  } catch {
    // If there is no signal, keep using the last verified package instead of
    // turning a healthy offline installation into a failed update.
    return existingOfflineStatus();
  }

  const candidates = uniqueLocalPaths([
    ...urls,
    ...discoveredAssets,
  ]);
  const nonShell = candidates.filter((path) => path !== "/");
  let failed = false;

  for (const path of nonShell) {
    try {
      const ok = await fetchAndStore(cache, path, REFRESH_WHEN_ONLINE.has(path));
      if (!ok) failed = true;
    } catch {
      failed = true;
    }
  }

  const missingBeforeShell = await missingInCache(cache, nonShell);
  if (failed || missingBeforeShell.length > 0) {
    return {
      ready: false,
      verifiedAt: null,
      missing: missingBeforeShell,
    };
  }

  // Atomic cutover: only expose the new HTML shell after every asset it refers
  // to has been cached successfully.
  await cache.put("/", shellResponse.clone());

  const missing = await missingInCache(cache, candidates);
  const ready = missing.length === 0;
  const verifiedAt = ready ? await writeOfflineIndex(cache, candidates) : null;

  // Keep one previous complete package as a rollback/fallback.
  if (ready) await keepCurrentAndPreviousCache();

  return { ready, verifiedAt, missing };
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  // The HTML shell is intentionally excluded here; WARM_CACHE performs the
  // atomic shell+asset cutover after the client has loaded.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(INSTALL_CORE)));
});

self.addEventListener("activate", (event) => {
  // Never delete the previous cache just because a worker activated.
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
      event.ports[0].postMessage(await existingOfflineStatus());
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
      if (url.pathname === "/") {
        const cachedShell = await matchCurrentThenPrevious("/");
        if (cachedShell) return cachedShell;
      }

      // Non-root pages (for example /admin/feedback) must not be replaced by
      // the cached app shell while online.
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        const exactCached = await matchCurrentThenPrevious(request);
        return exactCached || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await matchCurrentThenPrevious(request);
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
