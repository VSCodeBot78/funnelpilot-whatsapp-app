// Network-only service worker for optional installable test shortcut.
// Never cache chat history, budget status, account tokens or API responses.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", event => {
  if (event.request.method === "GET" && event.request.mode === "navigate") {
    event.respondWith(fetch(event.request));
  }
});
