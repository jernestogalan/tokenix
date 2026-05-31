/**
 * Tokenia Service Worker v8
 * Strategies:
 *  - HTML: Network-first, fallback to cache, then /offline.html
 *  - CSS/JS: Stale-while-revalidate
 *  - Fonts/images: Cache-first (long TTL)
 *  - API calls: Network-only (never cache)
 */

const CACHE_NAME  = 'tokenia-v8';
const OFFLINE_URL = '/offline.html';

const PRECACHE_ASSETS = [
  '/',
  '/offline.html',
  '/css/style.css?v=8',
  '/js/app.js?v=7',
  '/js/i18n-client.js?v=7',
  '/manifest.json',
  '/security.html',
  '/embed.html',
  '/api-docs.html',
];

// Install: precache critical assets + offline page
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch handler
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, cross-origin, and API requests
  if (request.method !== 'GET') return;
  if (!url.origin.includes(self.location.origin)) return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/admin/')) return;

  // HTML: Network-first → Cache → Offline
  if (request.destination === 'document' || request.headers.get('Accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // CSS/JS: Stale-while-revalidate
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(request).then(cached => {
          const fetched = fetch(request).then(response => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          }).catch(() => cached);
          return cached || fetched;
        })
      )
    );
    return;
  }

  // Fonts and images: Cache-first
  if (request.destination === 'font' || request.destination === 'image') {
    event.respondWith(
      caches.match(request).then(cached =>
        cached || fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
          }
          return response;
        })
      )
    );
  }
});

// Background sync for newsletter signups made while offline
self.addEventListener('sync', (event) => {
  if (event.tag === 'newsletter-sync') {
    event.waitUntil(syncNewsletterQueue());
  }
});

async function syncNewsletterQueue() {
  const queue = await getIDBQueue('newsletter');
  for (const item of queue) {
    try {
      await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      await removeFromIDBQueue('newsletter', item.id);
    } catch {}
  }
}

// Minimal IDB helpers for background sync queue
async function getIDBQueue(storeName) {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch { return []; }
}

async function removeFromIDBQueue(storeName, id) {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(id);
      tx.oncomplete = resolve;
    });
  } catch {}
}

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('tokenia-sw', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('newsletter')) {
        db.createObjectStore('newsletter', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = reject;
  });
}
