const CACHE = "zdg-__SHA__";
const APP_SHELL = [
  "./",
  "./index.html",
  "./map.html",
  "./login.html",
  "./register.html",
  "./parametres.html",
  "./materiel.html",
  "./style/style.css",
  "./js/config.js",
  "./js/api.js",
  "./js/map.js",
  "./js/ui.js",
  "./assets/ZoneDeGrimpeIcon.png",
  "./assets/avatar-default.jpg"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // Réseau seul pour l'API et les tuiles de carte
  if (url.hostname.includes("onrender.com") ||
      url.hostname.includes("tile.openstreetmap") ||
      url.hostname.includes("googleapis") ||
      url.hostname.includes("gstatic")) {
    e.respondWith(fetch(e.request).catch(() => new Response("", { status: 503 })));
    return;
  }

  // Cache-first pour l'app shell
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok && e.request.method === "GET") {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }).catch(() => caches.match("./index.html"));
    })
  );
});
