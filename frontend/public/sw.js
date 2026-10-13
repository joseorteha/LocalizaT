// Service worker de LocalizaT: avisos push, instalación como app y apertura sin señal.
//
// Reglas de caché (pensadas para que nunca se quede una versión vieja):
// · Páginas de la app: primero la red; sin señal, la última página guardada.
// · /assets/* (archivos con huella en el nombre): se guardan y se reutilizan.
// · /api/, /admin/ y las fotos privadas: NUNCA se guardan.
const VERSION = "localizat-v2";
const SHELL = ["/", "/manifest.webmanifest", "/favicon.svg", "/icon-192.png", "/isotipo.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name !== VERSION) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // mapas y otros servicios: los maneja el navegador
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin/") || url.pathname.startsWith("/static/")) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) (await caches.open(VERSION)).put("/", response.clone());
        return response;
      } catch {
        return (await caches.match("/")) || Response.error();
      }
    })());
    return;
  }

  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/fonts/")) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) (await caches.open(VERSION)).put(request, response.clone());
      return response;
    })());
  }
});

self.addEventListener("push", (event) => {
  event.waitUntil(self.registration.showNotification("Posible coincidencia en LocalizaT", {
    body: "Hay un aviso compatible con tu reporte. Revísalo en tu espacio.",
    icon: "/icon-192.png",
    badge: "/favicon.svg",
    tag: "localizat-match",
    data: { url: "/mi-espacio?section=alerts" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = new URL("/mi-espacio?section=alerts", self.location.origin).href;
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((windowClient) => windowClient.url.startsWith(self.location.origin));
    if (existing) { await existing.navigate(url); await existing.focus(); }
    else await clients.openWindow(url);
  })());
});
