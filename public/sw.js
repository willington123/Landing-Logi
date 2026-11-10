// Konnexa: minimal service worker so phones offer "Instalar app".
// It caches nothing (the panel always shows live data); it only answers network requests as usual.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
// Tapping a notice opens (or focuses) the panel on that chat.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/crm';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.navigate(url).then((w) => (w || c).focus());
      return self.clients.openWindow(url);
    }),
  );
});
// A notice sent by the server (Konnexa can be closed). If the panel is open and in front on that chat, stay quiet.
self.addEventListener('push', (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch (e) {}
  const url = d.url || '/crm';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const watching = list.some((c) => c.visibilityState === 'visible' && c.focused && c.url.indexOf(url) !== -1);
      if (watching) return;
      return self.registration.showNotification(d.title || 'Konnexa', { body: d.body || '', icon: '/pwa/icon-192.png', badge: '/pwa/icon-192.png', tag: d.tag || url, renotify: true, data: { url } });
    }),
  );
});
