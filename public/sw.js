/* ---------------------------------------------------------------------------
 * Hi Temp Mail — service worker (PWA)
 *
 * Strategies:
 *   /api/*            → never intercepted; the Mail.tm relay always hits the
 *                       network (mail must never be served from cache).
 *   navigations       → network-first, falling back to the cached page, then
 *                       to the branded offline page.
 *   static assets     → stale-while-revalidate (instant repeat loads).
 *
 * Bump VERSION to invalidate every cache after a deployment changes assets.
 * ------------------------------------------------------------------------- */

const VERSION = "v1";
const SHELL_CACHE = `htm-shell-${VERSION}`;
const ASSET_CACHE = `htm-asset-${VERSION}`;
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = [
  "/",
  "/landing.html",
  "/ar-tempmail.html",
  "/offline.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/logo.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/icon-maskable-192.png",
  "/icon-maskable-512.png",
  "/about.html",
  "/faq.html",
  "/privacy.html",
  "/disclaimer.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // cache: "reload" bypasses the HTTP cache so the shell is stored fresh
      await Promise.allSettled(
        PRECACHE_URLS.map((url) => cache.add(new Request(url, { cache: "reload" })))
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("htm-") && key !== SHELL_CACHE && key !== ASSET_CACHE
          )
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cross-origin (Google Fonts, Material Symbols) — let the browser handle it.
  if (url.origin !== self.location.origin) return;
  // The mail relay must never be cached or answered from cache.
  if (url.pathname.startsWith("/api/")) return;

  // --- Navigations: network-first → cache → offline page -------------------
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(SHELL_CACHE);
          cache.put(request, fresh.clone());
          return fresh;
        } catch (err) {
          const cached = await caches.match(request, { ignoreSearch: true });
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          return offline || Response.error();
        }
      })()
    );
    return;
  }

  // --- Static assets: stale-while-revalidate -------------------------------
  event.respondWith(
    (async () => {
      const cache = await caches.open(ASSET_CACHE);
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok && response.type === "basic") {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => undefined);
      return cached || (await network) || Response.error();
    })()
  );
});
