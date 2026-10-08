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
