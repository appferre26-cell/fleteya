// FleteYa · avisos con la app cerrada (Parte 8).
// Solo muestra avisos y abre la pantalla correcta al tocarlos; no guarda páginas en caché.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { cuerpo: e.data && e.data.text() }; }
  const titulo = d.titulo || "FleteYa";
  e.waitUntil(self.registration.showNotification(titulo, {
    body: d.cuerpo || "",
    icon: "/icono.png",
    badge: "/icono.png",
    tag: d.tag || "fleteya",
    renotify: true,
    requireInteraction: !!d.urgente,
    vibrate: d.urgente ? [400, 150, 400, 150, 600] : [200, 100, 200],
    data: { url: d.url || "/" },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil((async () => {
    const abiertas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of abiertas) {
      if (c.url === url || c.url.startsWith(url + "?")) return c.focus();
    }
    for (const c of abiertas) {
      if (new URL(c.url).pathname.split("/")[1] === new URL(url).pathname.split("/")[1] && "navigate" in c) {
        await c.navigate(url).catch(() => {});
        return c.focus();
      }
    }
    return self.clients.openWindow(url);
  })());
});
