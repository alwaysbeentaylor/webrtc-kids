# Push Notificaties Debug Guide

## Waarom push notificaties niet werken

Push notificaties in PWAs werken anders dan React Native. Hier zijn de belangrijkste verschillen en vereisten:

### Vereisten voor Push Notificaties

1. **VAPID Key** - Moet zijn ingesteld in Vercel environment variables
2. **Firebase Config** - Moet correct zijn in service worker
3. **Service Worker** - Moet actief zijn en Firebase Messaging ondersteunen
4. **Notificatie Toestemming** - Moet zijn gegeven
5. **FCM Token** - Moet worden verkregen en naar server gestuurd
6. **Server FCM** - Server moet Firebase Admin SDK gebruiken om push te sturen

## Checklist

### 1. VAPID Key Check

**In Vercel:**
- Ga naar Project Settings > Environment Variables
- Check of `VITE_FIREBASE_VAPID_KEY` is ingesteld
- Als niet: Ga naar Firebase Console > Project Settings > Cloud Messaging > Web Push certificates > Generate key pair

**In Browser Console:**
```javascript
// Check of VAPID key is beschikbaar
console.log('VAPID Key:', import.meta.env.VITE_FIREBASE_VAPID_KEY);
```

### 2. FCM Token Check

**In Browser Console (na login):**
```javascript
// Check of FCM token is verkregen
const token = await getToken(messaging, {
  vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
});
console.log('FCM Token:', token);
```

**Check of token naar server is gestuurd:**
- Open Network tab in browser DevTools
- Filter op `/api/fcm-token`
- Check of POST request is verstuurd met status 200

### 3. Service Worker Check

**In Browser Console:**
```javascript
// Check service worker status
navigator.serviceWorker.getRegistration().then(reg => {
  console.log('Service Worker:', reg);
  console.log('Active:', reg?.active);
  console.log('Installing:', reg?.installing);
  console.log('Waiting:', reg?.waiting);
});
```

**Check Firebase in Service Worker:**
- Open Service Worker console (Chrome: chrome://serviceworker-internals/)
- Check of Firebase is geïnitialiseerd
- Check of `messaging.onBackgroundMessage` is geregistreerd

### 4. Server FCM Check

**In Server Logs (Fly.io):**
```bash
# Check of FCM tokens worden opgeslagen
flyctl logs | grep "FCM token stored"

# Check of push wordt verstuurd
flyctl logs | grep "FCM push notification"
```

**Check Firebase Admin SDK:**
- Check of `FIREBASE_SERVICE_ACCOUNT` is ingesteld in Fly.io secrets
- Check of Firebase Admin SDK is geïnitialiseerd (geen errors in logs)

### 5. Test Push Notificatie

**Stappen:**
1. Log in als gebruiker A
2. Geef notificatie toestemming
3. Check browser console voor FCM token
4. Check server logs voor token storage
5. Sluit de app volledig (niet alleen tabblad)
6. Log in als gebruiker B op ander apparaat
7. Bel gebruiker A
8. Check of push notificatie wordt verstuurd (server logs)
9. Check of notificatie wordt ontvangen (gebruiker A apparaat)

## Veelvoorkomende Problemen

### 1. VAPID Key niet ingesteld
**Symptoom:** FCM token wordt niet verkregen
**Oplossing:** Voeg `VITE_FIREBASE_VAPID_KEY` toe aan Vercel environment variables

### 2. Service Worker Firebase Config incorrect
**Symptoom:** Service worker kan Firebase niet initialiseren
**Oplossing:** Update `sw.js` met correcte Firebase config

### 3. FCM Token niet naar server gestuurd
**Symptoom:** Server heeft geen FCM token voor gebruiker
**Oplossing:** Check `NotificationService.sendTokenToServer()` wordt aangeroepen

### 4. Server stuurt geen push
**Symptoom:** Server logs tonen geen push attempts
**Oplossing:** Check of `sendFCMPush()` wordt aangeroepen wanneer socket niet verbonden is

### 5. Push wordt verstuurd maar niet ontvangen
**Symptoom:** Server logs tonen succesvolle push, maar geen notificatie
**Oplossing:** 
- Check service worker is actief
- Check Firebase Messaging is geïnitialiseerd in service worker
- Check `messaging.onBackgroundMessage` is geregistreerd

## iOS Specifieke Vereisten

Voor iPhone/iOS:
1. **iOS 16.4+** vereist
2. **PWA moet zijn geïnstalleerd** op home screen (niet alleen in Safari)
3. **Notificatie toestemming** moet zijn gegeven vanuit geïnstalleerde PWA
4. **Service Worker** moet actief zijn

## Debug Commands

### Browser Console
```javascript
// Check FCM token
const messaging = getMessaging(firebaseApp);
const token = await getToken(messaging, {
  vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
});
console.log('FCM Token:', token);

// Check service worker
navigator.serviceWorker.getRegistration().then(reg => {
  console.log('SW:', reg);
});

// Check notification permission
console.log('Permission:', Notification.permission);
```

### Server Logs
```bash
# Fly.io logs
flyctl logs | grep -i fcm

# Check FCM token storage
flyctl logs | grep "FCM token stored"

# Check push sending
flyctl logs | grep "FCM push notification"
```

## Volgende Stappen

Als push notificaties nog steeds niet werken:

1. **Check alle bovenstaande punten**
2. **Test met browser console open** om errors te zien
3. **Check server logs** voor FCM errors
4. **Verify VAPID key** is correct
5. **Test op verschillende browsers/devices**

