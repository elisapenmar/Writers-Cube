// Writer's Cube service worker (Phase 1 baseline).
//
// Goals at this stage: make the app installable and keep the static shell fast / available
// offline. It deliberately does NOT cache authenticated HTML or API/auth traffic, so it can't
// serve stale signed-in pages or interfere with OAuth redirects and server actions. Rich
// document-level offline support is added in Phase 3 (offline + sync), which owns this file next.

const CACHE = "wc-static-v1";

// Only these same-origin GET paths are safe to cache (immutable build assets + public art).
function isCacheableAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/textures/") ||
    url.pathname.startsWith("/focus/") ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/manifest.webmanifest"
  );
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Never touch cross-origin (fonts CDN, Supabase, etc.) or auth/api routes.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/auth") || url.pathname.startsWith("/api")) return;

  // Navigations: network-first, fall back to an offline page only when truly offline.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          return (await caches.match("/offline.html")) || Response.error();
        }
      })(),
    );
    return;
  }

  // Static build assets / public art: stale-while-revalidate.
  if (isCacheableAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res && res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })(),
    );
  }
});
