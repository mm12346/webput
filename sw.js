// Service Worker for FixFlow App (Vanilla Version - Patched for GitHub Pages)
console.log('Service Worker Loaded - v16.0');

// --- CACHE VERSION ---
// Incrementing the version number is crucial for triggering the 'activate' event
// and clearing out old caches.
const CACHE_NAME = 'fixflow-cache-v16.0'; 
const REPO_NAME = '/webput'; // << Your repository name on GitHub

// A list of files to cache for the application shell.
const urlsToCache = [
  `${REPO_NAME}/`,
  `${REPO_NAME}/index.html`,
  `${REPO_NAME}/manifest.json`,
  `${REPO_NAME}/icon-192.png`,
  `${REPO_NAME}/icon-512.png`
];

// --- INSTALL EVENT ---
// This event is triggered when the service worker is first installed.
self.addEventListener('install', event => {
  console.log('[SW] Install event');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app shell:', urlsToCache);
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Force the new service worker to activate immediately
  );
});

// --- ACTIVATE EVENT ---
// This event is triggered when the new service worker becomes active.
// It's the perfect place to clean up old caches.
self.addEventListener('activate', event => {
  console.log('[SW] Activate event');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => self.clients.claim()) // Take control of all open pages
  );
});

// --- FETCH EVENT ---
// Implements a "Network falling back to cache" strategy.
// This ensures users get the latest content when online, but the app still works offline.
self.addEventListener('fetch', event => {
  // We only want to handle GET requests.
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    // 1. Try to fetch from the network first.
    fetch(event.request)
      .then(networkResponse => {
        // If the fetch is successful, we should cache it for offline use.
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        // And return the response from the network.
        return networkResponse;
      })
      .catch(() => {
        // 2. If the network request fails (e.g., user is offline),
        // try to get the response from the cache.
        return caches.match(event.request);
      })
  );
});


// --- PUSH EVENT ---
// Listen for incoming push messages from the server.
self.addEventListener('push', event => {
  console.log('[SW] Push Received.');
  
  const data = event.data ? event.data.json() : {};
  
  const title = data.title || 'FixFlow Notification';
  const options = {
    body: data.body || 'You have a new update.',
    icon: `${REPO_NAME}/icon-192.png`, 
    badge: `${REPO_NAME}/icon-192.png`,
    data: {
      url: data.url || `${REPO_NAME}/` // URL to open when notification is clicked
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// --- NOTIFICATION CLICK EVENT ---
// Handle user clicking on the notification.
self.addEventListener('notificationclick', event => {
  event.notification.close(); // Close the notification

  // Open the app window or a specific URL from the push data.
  event.waitUntil(
    clients.openWindow(event.notification.data.url || `${REPO_NAME}/`)
  );
});
