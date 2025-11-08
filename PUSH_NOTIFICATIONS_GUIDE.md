# Push Notificaties Implementatie Guide

## Huidige Status

De huidige implementatie werkt **alleen wanneer de app open is** (ook in background). Wanneer de app volledig gesloten is, werkt het **niet** omdat:

1. **Socket verbinding gaat weg** - Wanneer de app gesloten is, stopt alle JavaScript en gaat de Socket.IO verbinding weg
2. **Geen push service** - Voor echte push notifications wanneer app gesloten is, heb je een push service nodig (Firebase Cloud Messaging, etc.)

## Wat Werkt Nu

✅ **Notificaties wanneer app open is** (ook in background tab)
- Service Worker kan notificaties tonen via message channel
- Werkt wanneer app in background tab staat

❌ **Notificaties wanneer app gesloten is**
- Werkt NIET omdat socket verbinding weg is
- Vereist Firebase Cloud Messaging of andere push service

## Oplossing: Firebase Cloud Messaging (FCM) Implementeren

Voor echte push notifications wanneer de app gesloten is, moet je Firebase Cloud Messaging implementeren:

### Stap 1: Firebase Cloud Messaging Setup

1. **Enable FCM in Firebase Console**
   - Ga naar Firebase Console → Project Settings → Cloud Messaging
   - Genereer een Web Push certificate key (VAPID key)

2. **Installeer Firebase SDK**
   ```bash
   npm install firebase
   ```

3. **Configureer FCM in je app**
   ```typescript
   import { getMessaging, getToken, onMessage } from 'firebase/messaging';
   
   // Initialize FCM
   const messaging = getMessaging();
   
   // Get FCM token
   const token = await getToken(messaging, {
     vapidKey: 'YOUR_VAPID_KEY'
   });
   
   // Send token to your server
   await sendTokenToServer(token);
   ```

### Stap 2: Server-Side Push Notificaties

Wanneer een call binnenkomt en de gebruiker offline is:

1. **Server detecteert offline gebruiker**
   ```typescript
   // In server.ts
   socket.on('call:offer', (data) => {
     const targetRoom = `user:${data.targetUserId}`;
     const roomExists = io.sockets.adapter.rooms.has(targetRoom);
     
     if (!roomExists) {
       // User is offline - send FCM push notification
       sendFCMPushNotification(data.targetUserId, {
         title: 'Nieuwe oproep',
         body: `Je hebt een oproep ontvangen van ${data.fromUserId}`,
         data: { fromUserId: data.fromUserId, type: 'call' }
       });
     } else {
       // User is online - send via socket
       io.to(targetRoom).emit('call:offer', data);
     }
   });
   ```

2. **FCM Push Service implementeren**
   ```typescript
   // In server (gebruik firebase-admin)
   import admin from 'firebase-admin';
   
   async function sendFCMPushNotification(userId: string, notification: any) {
     // Get FCM token from database
     const fcmToken = await getFCMTokenFromDatabase(userId);
     
     if (fcmToken) {
       await admin.messaging().send({
         token: fcmToken,
         notification: {
           title: notification.title,
           body: notification.body
         },
         data: notification.data
       });
     }
   }
   ```

### Stap 3: Service Worker voor FCM

Update `sw.js` om FCM messages te ontvangen:

```javascript
// In sw.js
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  // Your Firebase config
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Background message received:', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192.png',
    badge: '/icon-96.png',
    tag: payload.data?.tag || 'call',
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: payload.data
  };
  
  return self.registration.showNotification(notificationTitle, notificationOptions);
});
```

## Alternatieve Oplossing: Keep-Alive Service Worker

Als je geen Firebase Cloud Messaging wilt gebruiken, kun je proberen:

1. **Background Sync API** - Houdt service worker actief
2. **Periodic Background Sync** - Checkt periodiek voor nieuwe calls
3. **Web Push API** - Vereist nog steeds een push service

**Maar deze werken niet betrouwbaar op alle browsers/platforms.**

## Aanbeveling

Voor een betrouwbare oplossing wanneer de app gesloten is:

1. ✅ **Implementeer Firebase Cloud Messaging**
   - Werkt op alle platforms (Android, iOS, Desktop)
   - Betrouwbaar en gratis
   - Je gebruikt al Firebase, dus makkelijk te integreren

2. ✅ **Server-side push logic**
   - Detecteer wanneer gebruiker offline is
   - Stuur FCM push notification
   - Gebruiker krijgt notificatie en kan app openen

3. ✅ **Hybrid approach**
   - Als app open is → gebruik socket (sneller)
   - Als app gesloten is → gebruik FCM (betrouwbaar)

## Huidige Workaround

Totdat FCM is geïmplementeerd:

- ✅ Notificaties werken wanneer app open is (ook in background)
- ✅ Gebruikers kunnen app "toevoegen aan beginscherm" voor PWA
- ✅ Service Worker blijft actief wanneer app in background
- ❌ Werkt NIET wanneer app volledig gesloten is

**Laatste update:** 2024-12-19


