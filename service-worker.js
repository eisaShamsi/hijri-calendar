/**
 * Service Worker — التقويم الهجري
 * Cache-first strategy for offline support
 */

const CACHE_NAME = 'hijri-calendar-v5.31';
const CORE_ASSETS = [
    './',
    './index.html',
    './style.css',
    './hijri.js',
    './prayer-times.js',
    './ai-client.js',
    './app.js',
    './manifest.json',
    './icon-192.svg',
    './icon-512.svg',
    './fonts/amiri-400-arabic.woff2',
    './fonts/amiri-400-latin.woff2',
    './fonts/amiri-700-arabic.woff2',
    './fonts/amiri-700-latin.woff2',
    './fonts/cairo-arabic.woff2',
    './fonts/cairo-latin.woff2',
];

// Install — precache core assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(CORE_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// Fetch — cache-first for local assets, network-first for external
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // External resources (fonts, CDN) — network-first
    if (url.origin !== self.location.origin) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Local assets — cache-first
    event.respondWith(
        caches.match(event.request)
            .then(cached => {
                if (cached) return cached;
                return fetch(event.request).then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                });
            })
    );
});
