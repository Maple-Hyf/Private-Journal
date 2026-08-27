const SHELL_CACHE = "private-journal-shell-v1.6.1-theme1";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith("private-journal-shell-") && key !== SHELL_CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if(event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isFirebaseSdk = url.origin === "https://www.gstatic.com" &&
                        url.pathname.includes("/firebasejs/");

  // Navigation/app shell: network first, cached fallback.
  if(isSameOrigin && event.request.mode === "navigate"){
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if(response && response.ok){
            const copy = response.clone();
            caches.open(SHELL_CACHE).then(cache => cache.put("./index.html", copy));
          }
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Same-origin static files and Firebase SDK modules:
  // serve cached copy immediately when available, then refresh cache online.
  if(isSameOrigin || isFirebaseSdk){
    event.respondWith(
      caches.match(event.request).then(cached => {
        const network = fetch(event.request)
          .then(response => {
            if(response && response.ok){
              const copy = response.clone();
              caches.open(SHELL_CACHE).then(cache => cache.put(event.request, copy));
            }
            return response;
          })
          .catch(() => cached);

        return cached || network;
      })
    );
  }
});
