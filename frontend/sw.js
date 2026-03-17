const CACHE = "zdg-__SHA__";
const API_CACHE = "zdg-api-v1";
const TILES_CACHE = "zdg-tiles-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./map.html",
  "./login.html",
  "./register.html",
  "./parametres.html",
  "./mes-spots.html",
  "./profil.html",
  "./style/style.css",
  "./style/parametres.css",
  "./config.js",
  "./js/config.js",
  "./js/api.js",
  "./js/map.js",
  "./js/ui.js",
  "./js/main.js",
  "./assets/ZoneDeGrimpeIcon.png",
  "./assets/avatar-default.jpg",
  "./manifest.json"
];

// Max age for cached API responses (30 min)
const API_MAX_AGE = 30 * 60 * 1000;
// Max tiles in cache
const MAX_TILES = 500;

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE && k !== API_CACHE && k !== TILES_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  // Ignorer les requêtes non-HTTP (extensions Chrome, etc.)
  if (!e.request.url.startsWith("http")) return;

  const url = new URL(e.request.url);

  // ---- Map tiles: cache-first with limit ----
  if (url.hostname.includes("tile.openstreetmap")) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(async res => {
          if (res.ok) {
            const clone = res.clone();
            const cache = await caches.open(TILES_CACHE);
            // Evict old tiles if too many
            const keys = await cache.keys();
            if (keys.length > MAX_TILES) {
              await cache.delete(keys[0]);
            }
            cache.put(e.request, clone);
          }
          return res;
        }).catch(() => new Response("", { status: 503 }));
      })
    );
    return;
  }

  // ---- API: stale-while-revalidate for GET /api/spots ----
  if (url.hostname.includes("onrender.com") || url.hostname.includes("localhost")) {
    if (e.request.method === "GET" && url.pathname.includes("/api/spots") && !url.pathname.includes("pending")) {
      e.respondWith(staleWhileRevalidate(e.request));
      return;
    }
    // Other API calls: network only
    e.respondWith(
      fetch(e.request).catch(() => {
        // Try cache as fallback for GET requests
        if (e.request.method === "GET") {
          return caches.match(e.request).then(cached => cached || new Response('{"error":"offline"}', {
            status: 503,
            headers: { "Content-Type": "application/json" }
          }));
        }
        return new Response('{"error":"offline"}', {
          status: 503,
          headers: { "Content-Type": "application/json" }
        });
      })
    );
    return;
  }

  // ---- Google Fonts: cache-first ----
  if (url.hostname.includes("googleapis") || url.hostname.includes("gstatic")) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => new Response("", { status: 503 }));
      })
    );
    return;
  }

  // ---- App shell: cache-first, fallback to network ----
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok && e.request.method === "GET") {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match("./index.html"));
    })
  );
});

// Stale-while-revalidate: return cached immediately, update in background
async function staleWhileRevalidate(request) {
  const cache = await caches.open(API_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(async res => {
    if (res.ok) {
      // Store with timestamp header for expiration check
      const clone = res.clone();
      const headers = new Headers(clone.headers);
      headers.set("sw-cached-at", String(Date.now()));
      const body = await clone.blob();
      await cache.put(request, new Response(body, { status: clone.status, statusText: clone.statusText, headers }));
    }
    return res;
  }).catch(() => null);

  // Return cached if available and not too old, otherwise wait for network
  if (cached) {
    const cachedAt = Number(cached.headers.get("sw-cached-at") || 0);
    const isExpired = cachedAt && (Date.now() - cachedAt > API_MAX_AGE);

    if (!isExpired) {
      // Still trigger background update
      fetchPromise.catch(() => {});
      return cached;
    }
    // Expired: wait for network, fallback to stale cache
    const networkRes = await fetchPromise;
    if (networkRes) return networkRes;
    return cached;
  }

  const networkRes = await fetchPromise;
  if (networkRes) return networkRes;

  return new Response('{"error":"offline","features":[]}', {
    status: 503,
    headers: { "Content-Type": "application/json" }
  });
}
