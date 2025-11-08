# Plan: Online Status en Push Notificaties Verbeteren

## Problemen

1. **Online status wordt false wanneer app in achtergrond gaat**
   - Wanneer gebruiker app wegklikt, wordt `isOnline` op `false` gezet
   - Andere gebruikers zien dan "niet online" terwijl gebruiker wel beschikbaar is
   - Dit gebeurt omdat `visibilitychange` event de status op false zet

2. **Push notificaties werken niet wanneer app gesloten is**
   - Bij Render werkten push notificaties wel wanneer app gesloten was
   - Nu worden ze niet ontvangen wanneer app volledig gesloten is
   - FCM token wordt mogelijk niet correct geregistreerd of service worker werkt niet

## Oplossingen

### 1. Online Status Verbeteren

**Probleem:** Online status wordt te snel op `false` gezet wanneer app in achtergrond gaat.

**Oplossing:**
- **Niet direct offline zetten** wanneer app in achtergrond gaat
- Gebruik een **timeout** (bijv. 5 minuten) voordat status op offline wordt gezet
- **Heartbeat mechanisme** om status actief te houden wanneer socket verbonden is
- Alleen offline zetten wanneer:
  - Socket verbinding is verbroken EN
  - Geen reconnect pogingen meer (na timeout)
  - App wordt volledig gesloten (beforeunload/unload event)

**Implementatie:**
1. Verwijder directe `updateOnlineStatus(false)` bij `visibilitychange`
2. Voeg heartbeat toe die elke 30 seconden status update wanneer socket verbonden is
3. Gebruik timeout van 5 minuten voordat status op offline wordt gezet
4. Update status alleen wanneer socket echt disconnected is (niet alleen app in achtergrond)

### 2. Push Notificaties Verbeteren

**Probleem:** Push notificaties werken niet wanneer app gesloten is.

**Oplossing:**
- **Service Worker heartbeat** verbeteren om actief te blijven
- **FCM token registratie** verbeteren en verifiëren
- **Background sync** gebruiken om FCM token te registreren wanneer app gesloten is
- **Server-side logging** verbeteren om te zien of push wordt verstuurd

**Implementatie:**
1. Service worker heartbeat verbeteren (elke 30 seconden)
2. FCM token registratie verifiëren in browser console
3. Service worker logging verbeteren om te zien of push events worden ontvangen
4. Server-side logging verbeteren om te zien of FCM push wordt verstuurd
5. Test met app volledig gesloten (niet alleen in achtergrond)

### 3. Specifieke Wijzigingen

#### Client-side (BubbleHome.tsx)
- Verwijder `updateOnlineStatus(false)` bij `visibilitychange`
- Voeg heartbeat toe die status update wanneer socket verbonden is
- Gebruik timeout voordat status op offline wordt gezet

#### Client-side (FamilyService.ts)
- Voeg heartbeat mechanisme toe voor online status
- Update status alleen wanneer socket echt disconnected is

#### Client-side (SocketService.ts)
- Verbeter heartbeat mechanisme
- Update online status wanneer socket verbindt/verbreekt

#### Client-side (Service Worker)
- Verbeter heartbeat mechanisme
- Verbeter FCM background message handling
- Voeg logging toe voor push events

#### Server-side (server.ts)
- Verbeter logging voor FCM push notifications
- Check of FCM token bestaat voordat push wordt verstuurd
- Log wanneer push wordt verstuurd en of deze succesvol is

## Stappen

1. ✅ Online status niet direct offline zetten bij visibilitychange
2. ✅ Heartbeat mechanisme toevoegen voor online status
3. ✅ Timeout toevoegen voordat status op offline wordt gezet
4. ✅ Service worker heartbeat verbeteren
5. ✅ FCM token registratie verifiëren en verbeteren
6. ✅ Server-side logging verbeteren voor FCM push
7. ✅ Testen met app volledig gesloten

## Testen

1. **Online Status:**
   - App openen → status moet "online" zijn
   - App wegklikken → status moet "online" blijven (niet direct offline)
   - Na 5 minuten → status moet "offline" worden (als socket disconnected)
   - App terug openen → status moet weer "online" worden

2. **Push Notificaties:**
   - App volledig sluiten (niet alleen in achtergrond)
   - Laat iemand je bellen
   - Je zou een push notificatie moeten ontvangen
   - Check browser console voor FCM token logs
   - Check server logs voor FCM push attempts

