const CACHE_NAME = "burgershot-cache-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./home.html",
  "./timbri.html",
  "./fatture.html",
  "./gestionale.html",
  "./style.css",
  "./app.js",
  "./logo.png",
  "./manifest.json"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => (k !== CACHE_NAME) ? caches.delete(k) : null)))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      // runtime cache for same-origin GET
      try {
        const url = new URL(req.url);
        if (req.method === "GET" && url.origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
      } catch {}
      return res;
    }))
  );
});
