/* Service worker for the Yellow Pink Admin PWA (scope: /admin).
 * Job #1 is Web Push: show incoming admin notifications (new orders,
 * payment failures, low stock, reviews, returns) and focus/open the right
 * admin page on tap. No offline caching — the admin is live data and a
 * stale order list is worse than no order list. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Yellow Pink Admin', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Yellow Pink Admin';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/admin/icon-192.png',
      badge: '/admin/icon-192.png',
      // Same-kind notifications collapse (three orders in a minute
      // shouldn't stack three banners), the newest replaces the last.
      tag: data.tag || 'yp-admin',
      renotify: true,
      data: { url: data.url || '/admin/dashboard' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/admin/dashboard';
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const w of wins) {
        if (w.url.includes('/admin')) {
          await w.focus();
          if ('navigate' in w) return w.navigate(url);
          return undefined;
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
