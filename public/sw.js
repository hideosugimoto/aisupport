// Service Worker for PWA installability
// Strategy: NetworkFirst for all requests, static asset caching for performance

const CACHE_NAME = "ai-assistant-v2";
const STATIC_ASSETS = ["/", "/compare", "/history", "/cost", "/documents"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Skip non-same-origin and API requests (no caching)
  if (!request.url.startsWith(self.location.origin) || request.url.includes("/api/")) {
    return;
  }

  // Navigation and static assets: NetworkFirst
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && request.method === "GET") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Push notification handler
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || "",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      data: { url: data.url || "/" },
    };

    event.waitUntil(self.registration.showNotification(data.title || "AI意思決定アシスタント", options));
  } catch {
    // Ignore malformed push data
  }
});

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const rawUrl = event.notification.data?.url || "/";
  // Validate URL to prevent open redirect via malicious push payload
  const url = (rawUrl.startsWith("/") || rawUrl.startsWith(self.location.origin))
    ? rawUrl
    : "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus existing window if available
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      // Open new window
      return self.clients.openWindow(url);
    })
  );
});
