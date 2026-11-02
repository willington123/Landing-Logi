// Konnexa: minimal service worker so phones offer "Instalar app".
// It caches nothing (the panel always shows live data); it only answers network requests as usual.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
