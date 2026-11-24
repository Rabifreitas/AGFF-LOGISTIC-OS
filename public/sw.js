/* MOBI LOG OS — service worker: alertas Web Push de ofertas ao motorista. Sem cache offline (piloto). */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = { title: "MOBI LOG OS", body: "", url: "/app/driver", tag: "mobilog" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    /* payload vazio */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      renotify: true,
      requireInteraction: true,
      icon: "/brand/icon.png",
      badge: "/brand/mark.png",
      vibrate: [300, 100, 300, 100, 300],
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/app/driver", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.startsWith(self.location.origin) && "focus" in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
