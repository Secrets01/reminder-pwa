const CACHE_NAME = 'reminder-pwa-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/script.js',
  '/manifest.json'
];

// Установка SW и кэширование файлов
self.addEventListener('install', event => {
  console.log('📦 Service Worker установлен');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('💾 Файлы закэшированы');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Перехват запросов (Cache First стратегия)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(response => {
          // Не кэшируем небезопасные запросы
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          return response;
        });
      })
  );
});

// Активация и очистка старых кэшей
self.addEventListener('activate', event => {
  console.log('⚡ Service Worker активирован');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Удалён старый кэш:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Обработка кликов по уведомлениям
self.addEventListener('notificationclick', event => {
  console.log('🔔 Нажато уведомление:', event.notification.tag);
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // Если уже есть открытое окно, фокусируем его
        for (let client of windowClients) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        // Иначе открываем новое
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});

// Обработка показа уведомлений
self.addEventListener('notificationclose', event => {
  console.log('❌ Уведомление закрыто:', event.notification.tag);
});