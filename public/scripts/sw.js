const CACHE = 'matesito-public-1.3.7';
const ASSETS = ['/offline.html', '/modern.css', '/index.css', '/panels.css', '/res/logo.svg'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('matesito-public-') && key !== CACHE).map(key => caches.delete(key))))));
self.addEventListener('fetch', event => {
    const request = event.request, url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== self.location.origin) return;
    if (request.mode === 'navigate') {
        event.respondWith(fetch(request).catch(() => caches.match('/offline.html'))); return;
    }
    if (!ASSETS.includes(url.pathname) || url.search) return;
    event.respondWith(fetch(request).then(response => {
        if (response.ok && response.type === 'basic') { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy))); }
        return response;
    }).catch(() => caches.match(request)));
});
