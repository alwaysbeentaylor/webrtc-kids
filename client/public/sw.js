// Service Worker for Push Notifications
const CACHE_NAME = 'webrtc-kids-v1';

self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);
  
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Nieuwe oproep';
  const options = {
    body: data.body || 'Je hebt een oproep ontvangen',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-96.png',
    tag: data.tag || 'call',
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: data
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          return client.focus();
        }
      }
      // Otherwise open new window
      return clients.openWindow('/');
    })
  );
});

self.addEventListener('message', (event) => {
  console.log('Service Worker received message:', event.data);
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

