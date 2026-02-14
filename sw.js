/* Math Arcade - Offline-first Service Worker (cache everything for full offline play) */

importScripts("assets/js/games.js");

const VERSION = "v2026-02-14-score-and-stars-label-fix";
const CACHE_NAME = `math-arcade-${VERSION}`;

const CORE_ASSETS = [
  "./",
  "index.html",
  "settings.html",
  "manifest.webmanifest",
  "assets/css/arcade.css",
  "assets/css/mission.css",
  "assets/js/games.js",
  "assets/js/app.js",
  "assets/js/mission_core.js",
  "assets/icons/apple-touch-icon.png",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/favicon.svg"
];

const GAME_URLS = (typeof MATH_ARCADE_GAMES !== "undefined")
  ? MATH_ARCADE_GAMES.map(g => g.href)
  : [];

const PRECACHE_URLS = CORE_ASSETS.concat(GAME_URLS);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k.startsWith("math-arcade-") && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// Cache-first for same-origin navigations and assets
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET
  if (req.method !== "GET") return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req).then((resp) => {
        // Optionally populate runtime cache
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(req, copy).catch(() => {});
        }).catch(() => {});
        return resp;
      }).catch(() => {
        // If it's a navigation request, try to fall back to home
        if (req.mode === "navigate") return caches.match("index.html");
        return cached;
      });
    })
  );
});
