// Service Worker for FixFlow App (Vanilla Version - Patched for GitHub Pages)
console.log('Service Worker Loaded');

const CACHE_NAME = 'fixflow-cache-v10.0'; // เปลี่ยนเวอร์ชัน Cache เพื่อบังคับให้อัปเดต
const REPO_NAME = '/FixFlow'; // << ชื่อ Repository ของคุณบน GitHub

// A list of files to cache for the application shell, with correct paths
const urlsToCache = [
  `${REPO_NAME}/`,
  `${REPO_NAME}/index.html`,
  `${REPO_NAME}/manifest.json`,
  `${REPO_NAME}/icon-192.png`,
  `${REPO_NAME}/icon-512.png`
];

// Install event: cache application shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching app shell with correct paths');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Force the new service worker to activate
  );
});

// Activate event: clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => self.clients.claim()) // Take control of all pages
  );
});

// Fetch event: serve from cache first, then network
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request).then(response => {
      // If we have a match in the cache, return it
      if (response) {
        return response;
      }
      // Otherwise, fetch from the network
      return fetch(event.request).catch(() => {
        // If network fails, you can return a fallback offline page
        // For now, it will just fail, which is okay for this stage.
      });
    })
  );
});


// Push event: listen for incoming push messages
self.addEventListener('push', event => {
  console.log('[Service Worker] Push Received.');
  
  const data = event.data ? event.data.json() : {};
  
  const title = data.title || 'FixFlow Notification';
  const options = {
    body: data.body || 'You have a new update.',
    icon: `${REPO_NAME}/icon-192.png`, 
    badge: `${REPO_NAME}/icon-192.png`,
    data: {
      url: data.url || `${REPO_NAME}/`
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click event: handle user clicking on the notification
self.addEventListener('notificationclick', event => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data.url || `${REPO_NAME}/`)
  );
});
