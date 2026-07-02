// Hand-rolled service worker for Writer's Cube (Phase 1 PWA foundation).
//
// Deliberately minimal and dependency-free so it can't break against a new
// Next.js release. It does two things:
//   1. Makes the app installable + opens offline to a cached shell.
//   2. Serves an offline fallback page for never-visited routes.
//
// Real document offline (prose + project metadata) is Phase 3, handled in-app
// via Yjs + IndexedDB — NOT here. Bump VERSION to invalidate old caches.

// v3: navigation fallback must match ONLY the runtime (HTML) cache. v2 used the
// global caches.match, which could return an RSC payload cached under the same
// clean URL — the browser then rendered raw flight data / offered a download.
const VERSION = "wc-v3";
const PRECACHE = `wc-precache-${VERSION}`;
const RUNTIME = `wc-runtime-${VERSION}`;
// Next.js client-side navigations fetch an RSC payload instead of full HTML.
// Cached separately so moving between already-seen scenes works offline.
const RSC = `wc-rsc-${VERSION}`;

const PRECACHE_URLS = [
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== PRECACHE && key !== RUNTIME && key !== RSC)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Never touch cross-origin traffic (Google Fonts, Supabase realtime/storage,
  // the Anthropic API). Those must always hit the network.
  if (url.origin !== self.location.origin) return;

  // Client-side navigations: Next fetches an RSC payload (marked by the `_rsc`
  // search param / `RSC: 1` header) instead of full HTML. Network-first, cached
  // under the URL minus the volatile `_rsc` token, so tapping into a scene the
  // writer has already seen works offline. On a miss the fetch fails as it
  // would without a service worker, and Next falls back to a full navigation
  // (handled below: cached page, then offline.html).
  if (url.searchParams.has("_rsc") || request.headers.get("RSC") === "1") {
    event.respondWith(
      (async () => {
        const keyUrl = new URL(url);
        keyUrl.searchParams.delete("_rsc");
        const key = keyUrl.toString();
        try {
          const fresh = await fetch(request);
          if (fresh && fresh.status === 200 && !fresh.redirected) {
            const cache = await caches.open(RSC);
            cache.put(key, fresh.clone());
          }
          return fresh;
        } catch (err) {
          const cache = await caches.open(RSC);
          const cached = await cache.match(key);
          if (cached) return cached;
          throw err;
        }
      })(),
    );
    return;
  }

  // Page navigations: network-first so content stays fresh online, falling back
  // to the last-seen version of that page, then the generic offline shell.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          // Only cache clean, non-redirected 200s (skip auth redirects).
          if (fresh && fresh.status === 200 && !fresh.redirected) {
            const cache = await caches.open(RUNTIME);
            cache.put(request, fresh.clone());
          }
          return fresh;
        } catch {
          // Scope the lookup to the HTML cache: a global caches.match could hit
          // the RSC-payload cache (same URL key) and serve flight data as HTML.
          const runtime = await caches.open(RUNTIME);
          const cached = await runtime.match(request);
          if (cached) return cached;
          const precache = await caches.open(PRECACHE);
          return await precache.match("/offline.html");
        }
      })(),
    );
    return;
  }

  // Hashed static assets are immutable: cache-first for instant repeat loads.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME);
        const cached = await cache.match(request);
        if (cached) return cached;
        // Icons live in the precache; check it before hitting the network.
        const precache = await caches.open(PRECACHE);
        const pre = await precache.match(request);
        if (pre) return pre;
        const fresh = await fetch(request);
        if (fresh && fresh.status === 200) {
          cache.put(request, fresh.clone());
        }
        return fresh;
      })(),
    );
  }

  // Everything else (API routes, data) falls through to the network untouched.
});
