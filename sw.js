// ══════════════════════════════════════════════════════
// CBTS Service Worker — S281
// Enables: install prompt (Chrome/Edge), offline reading
// Strategy: network-first for content, cache-first for media
// ══════════════════════════════════════════════════════

const CACHE_NAME = 'cbts-v1';

// Core files pre-cached on install — keep this list small
const CORE_ASSETS = [
  './',
  './index.html',
  './play1-simon.json',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ── INSTALL — pre-cache core files ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE — clean old cache versions ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH — serve content ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET
  if (event.request.method !== 'GET') return;

  // Allow Google Fonts through; skip other cross-origin
  const isFont = url.hostname.includes('googleapis.com') ||
                 url.hostname.includes('gstatic.com');
  if (url.origin !== self.location.origin && !isFont) return;

  // ── Network-first: JSON + HTML ──
  // Always fetch latest content when online; fall back to cache offline.
  // This means GitHub Pages updates land immediately on next load.
  if (url.pathname.endsWith('.json') ||
      url.pathname.endsWith('.html') ||
      url.pathname.endsWith('/') ||
      url.pathname === '') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // ── Cache-first: everything else ──
  // Images (.webp, .png, .jpg), audio (.mp3), video (.mp4),
  // fonts, icons. Cached on first access, served from cache after.
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
