// Service Worker for Push Notifications and Background Sync
importScripts('https://www.gstatic.com/firebasejs/12.5.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.5.0/firebase-messaging-compat.js');

const CACHE_NAME = 'webrtc-kids-v1';
const HEARTBEAT_INTERVAL = 60000; // 60 seconds (less frequent to avoid conflicts)

// Keep service worker alive with periodic wake-ups
let heartbeatInterval = null;

// Initialize Firebase in service worker
// Note: These values should match your Firebase config
const firebaseConfig = {
  apiKey: self.location.hostname === 'localhost' ? 'your-api-key' : undefined, // Will be set by client
  authDomain: undefined, // Will be set by client
  projectId: undefined, // Will be set by client
  storageBucket: undefined, // Will be set by client
  messagingSenderId: undefined, // Will be set by client
  appId: undefined // Will be set by client
};

// Initialize Firebase (will be configured by client)
let messaging = null;
try {
  firebase.initializeApp(firebaseConfig);
  messaging = firebase.messaging();
  console.log('✅ Firebase initialized in service worker');
} catch (error) {
  console.warn('⚠️ Firebase initialization in SW failed (will be configured by client):', error);
}

self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
    ])
  );
  
  // Start heartbeat to keep service worker alive
  startHeartbeat();
});

// Start heartbeat to keep service worker active
function startHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
  
  heartbeatInterval = setInterval(() => {
    // Send message to all clients to keep connection alive
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: 'HEARTBEAT', timestamp: Date.now() });
      });
    });
  }, HEARTBEAT_INTERVAL);
  
  console.log('✅ Heartbeat started');
}

// Handle push notifications (from FCM or push service)
self.addEventListener('push', (event) => {
  console.log('📬 Push notification received:', event);
  
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { body: event.data.text() };
    }
  }
  
  // Handle FCM payload format
  const notificationData = data.notification || data;
  const title = notificationData.title || data.title || 'Nieuwe oproep';
  const body = notificationData.body || data.body || 'Je hebt een oproep ontvangen';
  const icon = notificationData.icon || data.icon || '/icon-192.png';
  const callData = data.data || {};
  
  const options = {
    body: body,
    icon: icon,
    badge: '/icon-96.png',
    tag: callData.callId || data.tag || `call-${Date.now()}`,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    data: {
      ...callData,
      fromUserId: callData.fromUserId || data.fromUserId,
      targetUserId: callData.targetUserId || data.targetUserId
    },
    actions: [
      { action: 'answer', title: 'Beantwoorden' },
      { action: 'decline', title: 'Weigeren' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle FCM background messages (when app is closed)
if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    console.log('📬 FCM background message received:', payload);
    
    const notificationTitle = payload.notification?.title || 'Nieuwe oproep';
    const notificationOptions = {
      body: payload.notification?.body || 'Je hebt een oproep ontvangen',
      icon: payload.notification?.icon || '/icon-192.png',
      badge: '/icon-96.png',
      tag: payload.data?.callId || `call-${Date.now()}`,
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 200],
      data: payload.data || {},
      actions: [
        { action: 'answer', title: 'Beantwoorden' },
        { action: 'decline', title: 'Weigeren' }
      ]
    };
    
    return self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event);
  event.notification.close();
  
  const action = event.action;
  const notificationData = event.notification.data || {};
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it and send action
      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          // Send action to client
          if (action) {
            client.postMessage({
              type: 'NOTIFICATION_ACTION',
              action: action,
              data: notificationData
            });
          }
          return;
        }
      }
      // Otherwise open new window
      return self.clients.openWindow('/').then((client) => {
        if (client && action) {
          // Wait a bit for client to load, then send action
          setTimeout(() => {
            client.postMessage({
              type: 'NOTIFICATION_ACTION',
              action: action,
              data: notificationData
            });
          }, 1000);
        }
      });
    })
  );
});

// Handle messages from client (for showing notifications when app is open)
self.addEventListener('message', (event) => {
  console.log('📨 Service Worker received message:', event.data);
  
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    event.waitUntil(
      self.registration.showNotification(title, {
        ...options,
        requireInteraction: true,
        vibrate: [200, 100, 200, 100, 200]
      })
    );
  } else if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'KEEP_ALIVE') {
    // Client is asking to keep service worker alive
    startHeartbeat();
  }
});

// Background sync for keeping connection alive
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync:', event.tag);
  
  if (event.tag === 'keep-alive') {
    event.waitUntil(
      // Send heartbeat to all clients
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'HEARTBEAT', timestamp: Date.now() });
        });
      })
    );
  }
});

// Periodic background sync (if supported)
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', (event) => {
    console.log('⏰ Periodic sync:', event.tag);
    
    if (event.tag === 'keep-alive') {
      event.waitUntil(
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: 'HEARTBEAT', timestamp: Date.now() });
          });
        })
      );
    }
  });
}
