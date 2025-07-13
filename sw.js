// Service Worker for FixFlow App
console.log('Service Worker Loaded');

// เปลี่ยนเวอร์ชัน Cache ที่นี่เพื่อบังคับให้ Service Worker อัปเดตใหม่ทั้งหมด
const CACHE_NAME = 'fixflow-cache-v1.0'; 

// รายการไฟล์ที่ต้องการ Cache สำหรับการใช้งานแบบ Offline
// แก้ไขโดยใช้ Relative Path เพื่อให้ทำงานได้ถูกต้อง
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Event: install - ทำการ Cache ไฟล์หลักของแอป
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache and caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // บังคับให้ Service Worker ใหม่ทำงานทันที
  );
});

// Event: activate - ลบ Cache เก่าที่ไม่จำเป็นออกไป
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => self.clients.claim()) // ควบคุม Page ทั้งหมดทันที
  );
});

// Event: fetch - จัดการกับการร้องขอ (Request)
// จะพยายามหาใน Cache ก่อน ถ้าไม่เจอถึงจะไปดึงจาก Network
self.addEventListener('fetch', event => {
  // ไม่ต้อง Cache request ที่ไม่ใช่ GET
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then(response => {
      // ถ้าเจอใน Cache ให้ส่งกลับไปเลย
      if (response) {
        return response;
      }
      // ถ้าไม่เจอ ให้ไปดึงจาก Network
      return fetch(event.request).catch(() => {
        // หาก Network ล้มเหลว สามารถส่งหน้า Offline สำรองได้
        // ในที่นี้จะปล่อยให้ล้มเหลวไปก่อน
      });
    })
  );
});


// Event: push - รอรับ Push Notification จาก Server
self.addEventListener('push', event => {
  console.log('[Service Worker] Push Received.');
  
  const data = event.data ? event.data.json() : {};
  
  const title = data.title || 'FixFlow Notification';
  const options = {
    body: data.body || 'You have a new update.',
    icon: './icon-192.png', // ใช้ Relative Path
    badge: './icon-192.png', // ใช้ Relative Path
    data: {
      url: data.url || './' // URL ที่จะเปิดเมื่อคลิก Notification
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Event: notificationclick - จัดการเมื่อผู้ใช้คลิกที่ Notification
self.addEventListener('notificationclick', event => {
  event.notification.close(); // ปิด Notification ที่คลิก

  // เปิดหน้าต่างใหม่ไปยัง URL ที่กำหนดไว้ในข้อมูลของ Notification
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
