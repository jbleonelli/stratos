/* Merlin PWA service worker — deliberately minimal, network-first.
 *
 * Why hand-rolled instead of Workbox/vite-plugin-pwa: those precache the
 * content-hashed build chunks at build time, which can serve STALE assets
 * after a deploy and fight (a) Vercel's content-hashing and (b) Merlin's own
 * "Update available" stale-chunk gate (App.jsx). This SW exists only to make
 * Merlin installable as a desktop/Chrome app — it never precaches a build
 * manifest, and the network always wins when online:
 *
 *   - Navigations (HTML): network-first → fresh index.html every time online;
 *     cached app shell only as an offline fallback.
 *   - /assets/* and /fonts/* : network-first, cached for offline + repeat
 *     loads. Safe because those filenames are content-hashed and immutable —
 *     a new build requests a new filename, so a cached chunk is never "stale"
 *     (and a 404 for a retired chunk passes straight through so the existing
 *     update gate still fires).
 *   - Everything else (Supabase, /api, cross-origin): passthrough, untouched.
 */

const CACHE = 'merlin-runtime-v1';
const SHELL = '/';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.add(SHELL)).catch(() => {}));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }
  // Only ever touch our own origin — never intercept Supabase / API / CDN.
  if (url.origin !== self.location.origin) return;

  // App navigations → network-first; offline → cached shell.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        // Keep the shell fresh for offline use.
        caches.open(CACHE).then((c) => c.put(SHELL, fresh.clone())).catch(() => {});
        return fresh;
      } catch {
        return (await caches.match(SHELL)) || Response.error();
      }
    })());
    return;
  }

  // Content-hashed build assets + fonts → network-first, cache for offline.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/fonts/')) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) {
          caches.open(CACHE).then((c) => c.put(req, fresh.clone())).catch(() => {});
        }
        return fresh;
      } catch {
        return (await caches.match(req)) || Response.error();
      }
    })());
    return;
  }

  // Default: passthrough to the network.
});

/* ─── Web Push (Merlin Mobile — mig 255 + api/push.ts) ─────────────────
 * Show a notification when a push arrives, and focus/open the worker app
 * on click. Payload (JSON): { title, body, url?, tag?, icon? }. */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Merlin', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Merlin';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/merlin-192.png',
    badge: '/icons/merlin-192.png',
    tag: data.tag || undefined,
    data: { url: data.url || '/?mobile=1' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/?mobile=1';
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of all) {
        if (c.url.includes('mobile') && 'focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })(),
  );
});
