# Firebase Cloud Messaging (FCM) Setup Guide

Deze guide helpt je om push notificaties te configureren zodat gebruikers oproepen kunnen ontvangen, zelfs wanneer de app gesloten is.

## Vereisten

1. Firebase project met Cloud Messaging ingeschakeld
2. VAPID key voor web push notificaties
3. Firebase Admin SDK geconfigureerd op de server

## Stap 1: Firebase Console Setup

1. Ga naar [Firebase Console](https://console.firebase.google.com/)
2. Selecteer je project
3. Ga naar **Project Settings** > **Cloud Messaging**
4. Scroll naar **Web Push certificates**
5. Klik op **Generate key pair** (als je nog geen VAPID key hebt)
6. Kopieer de **Key pair** (dit is je VAPID key)

## Stap 2: Client Environment Variables

Voeg de volgende environment variable toe aan je Vercel deployment (of andere hosting):

```
VITE_FIREBASE_VAPID_KEY=<jouw-vapid-key>
```

**Waar te vinden:**
- Vercel: Project Settings > Environment Variables
- Andere hosting: Check hun documentatie voor environment variables

## Stap 3: Service Worker Configuratie

De service worker (`client/public/sw.js`) is al geconfigureerd om FCM push events te verwerken. De Firebase configuratie wordt automatisch geladen vanuit de client.

## Stap 4: Server-side Configuratie

De server is al geconfigureerd om:
- FCM tokens op te slaan via `/api/fcm-token` endpoint
- Push notificaties te versturen wanneer een call offer wordt verstuurd

**Belangrijk:** Zorg ervoor dat Firebase Admin SDK correct is geconfigureerd op de server (zie `server/src/config/firebase-admin.ts`).

## Stap 5: Testen

1. **Deploy de client** met de nieuwe `VITE_FIREBASE_VAPID_KEY` environment variable
2. **Deploy de server** (zorg dat Firebase Admin SDK is geconfigureerd)
3. **Open de app** in een browser
4. **Geef notificatie toestemming** wanneer gevraagd
5. **Log in** als gebruiker (parent of child)
6. **Sluit de app** volledig (niet alleen het tabblad, maar sluit de browser)
7. **Laat iemand je bellen** vanaf een ander apparaat
8. **Je zou een push notificatie moeten ontvangen**, zelfs wanneer de app gesloten is

## Troubleshooting

### Geen push notificaties ontvangen

1. **Check browser console** voor FCM errors
2. **Verify VAPID key** is correct geconfigureerd
3. **Check service worker** is geregistreerd en actief
4. **Verify Firebase Admin SDK** is correct geconfigureerd op de server
5. **Check server logs** voor FCM token storage en push sending errors

### FCM token wordt niet verkregen

- Zorg dat notificatie toestemming is gegeven
- Check dat service worker is geregistreerd
- Verify VAPID key is correct

### Push notificaties werken niet wanneer app gesloten is

- Zorg dat de service worker correct is geconfigureerd
- Check dat Firebase Messaging is geïnitialiseerd in de service worker
- Verify dat de server push notificaties verstuurt (check server logs)

## Belangrijke Notities

- **VAPID key is vereist** voor web push notificaties
- **Service worker moet actief zijn** om push notificaties te ontvangen
- **Firebase Admin SDK** moet correct zijn geconfigureerd op de server
- **FCM tokens worden opgeslagen in memory** (niet persistent) - bij server restart moeten gebruikers opnieuw inloggen om token te registreren

## Volgende Stappen

Voor productie gebruik, overweeg:
- FCM tokens persistent op te slaan (database) in plaats van memory
- Token refresh handling wanneer tokens verlopen
- Error handling en retry logic voor failed push notifications

