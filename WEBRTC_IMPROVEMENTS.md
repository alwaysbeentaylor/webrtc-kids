# WebRTC Verbeteringen & Android Troubleshooting Guide

## Overzicht
Dit document beschrijft alle WebRTC verbeteringen die zijn geïmplementeerd om betrouwbare calls tussen telefoons mogelijk te maken, met speciale aandacht voor Android-compatibiliteit.

## Belangrijkste Verbeteringen

### 1. ICE Candidate Buffer
**Probleem:** ICE candidates kunnen arriveren voordat `remoteDescription` is gezet, wat tot errors leidt.

**Oplossing:**
- Buffer voor inkomende ICE candidates toegevoegd (`pendingRemoteCandidates`)
- Candidates worden automatisch verwerkt zodra `remoteDescription` is gezet
- Voorkomt "Cannot add ICE candidate before remote description" errors

**Code locatie:** `WebRTCService.ts` - `handleIceCandidate()` method

### 2. Accept Flow Harmonization
**Probleem:** Answer werd automatisch verstuurd bij `handleIncomingOffer`, wat race conditions veroorzaakte.

**Oplossing:**
- Answer wordt NU alleen verstuurd wanneer `acceptCall()` expliciet wordt aangeroepen
- `handleIncomingOffer` zet alleen de peer connection op zonder automatisch te antwoorden
- Voorkomt timing issues en race conditions

**Code locatie:** `WebRTCService.ts` - `acceptCall()` en `handleIncomingOffer()` methods

### 3. Automatische ICE Restart & Retry
**Probleem:** Bij ICE failures werd de call direct als "failed" gemarkeerd zonder retry.

**Oplossing:**
- Automatische ICE restart bij `failed` state (max 2 retries)
- Retry mechanisme voor zowel outgoing als incoming calls
- Langere timeouts voor mobiele netwerken (15-20 seconden)
- Automatisch herstel bij `disconnected` state

**Code locatie:** `WebRTCService.ts` - `attemptIceRestart()` method en ICE connection state handlers

### 4. Verbeterde TURN Server Configuratie
**Probleem:** Te weinig TURN server opties, vooral voor Android NAT traversal.

**Oplossing:**
- 6 TURN servers (was 4) voor betere fallback
- Focus op poort 443 (TCP + UDP) voor firewall compatibiliteit
- Ook UDP poort 80 voor bredere compatibiliteit
- Meerdere providers (openrelay.metered.ca en relay.metered.ca)

**Code locatie:** `WebRTCService.ts` - `rtcConfig` property

### 5. Langere Timeouts voor Mobiele Netwerken
**Probleem:** Timeouts te kort voor mobiele netwerken die langzamer kunnen zijn.

**Oplossing:**
- Call timeout: 60s → 90s
- ICE disconnected timeout: 10-15s → 15-20s
- Meer tijd voor WiFi/4G switches en trage netwerken

**Code locatie:** `WebRTCService.ts` - `startCall()` en ICE connection state handlers

### 6. Socket Connect Retry & Room ACK
**Probleem:** Socket connectie kon falen zonder retry, en WebRTC listeners startten te vroeg.

**Oplossing:**
- Retry mechanisme voor socket connectie (3 pogingen met exponential backoff)
- Room join ACK verificatie voordat WebRTC listeners starten
- Betere error handling en logging

**Code locatie:** `SocketService.ts` - `connect()` en `joinUserRoom()` methods

### 7. Debug Overlay voor Development
**Oplossing:**
- Uitgebreide debug overlay in DEV mode
- Toont ICE connection state, candidate types, SDP status
- State history tracking voor troubleshooting

**Code locatie:** `CallScreen.tsx` - Debug overlay component

## Android-Specifieke Problemen & Oplossingen

### ⚠️ BELANGRIJK: Android WebRTC Issues

Android heeft unieke uitdagingen met WebRTC:

1. **Striktere NAT/Firewall Settings**
   - Android heeft vaak restrictievere NAT settings dan iOS
   - TURN servers zijn ESSENTIEEL voor Android NAT traversal
   - Zonder TURN servers werken calls vaak niet tussen Android devices

2. **Langzamere ICE Gathering**
   - Android heeft meer tijd nodig voor ICE candidate gathering
   - Timeouts moeten langer zijn (20s voor Android vs 15s voor andere platforms)
   - Meerdere retries zijn vaak nodig

3. **Network Switching**
   - Android devices wisselen vaker tussen WiFi/4G
   - Langere timeouts nodig (90s voor calls)
   - Automatische recovery bij disconnected state is cruciaal

### Android-Specifieke Code Aanpassingen

```typescript
// Detecteer Android
const isAndroid = /Android/i.test(navigator.userAgent);

// Langere timeouts voor Android
const timeout = isAndroid ? 20000 : 15000;

// Meer retries voor Android
if (isAndroid && isRelay) {
  console.log('✅✅✅ Android using TURN server (relay) - this is good for NAT traversal!');
}
```

### Android Troubleshooting Checklist

Als calls niet werken op Android:

1. ✅ **Check TURN Server Usage**
   - Open browser console (F12)
   - Zoek naar "TURN/RELAY candidate" logs
   - Als je alleen "host" of "srflx" candidates ziet, werkt TURN niet
   - **Oplossing:** Check firewall/proxy instellingen

2. ✅ **Check ICE Connection State**
   - Debug overlay toont ICE state
   - Als state "failed" blijft, probeer:
     - WiFi uitzetten en weer aanzetten
     - App herstarten
     - Andere TURN server proberen

3. ✅ **Check Network Conditions**
   - Android heeft meer tijd nodig bij trage netwerken
   - Timeouts zijn nu 90s voor calls, 20s voor ICE
   - Als dit nog steeds te kort is, verhoog verder

4. ✅ **Check Permissions**
   - Camera/microfoon permissies moeten expliciet zijn verleend
   - Check browser instellingen (Chrome: Settings → Site Settings → Camera/Microphone)

5. ✅ **Check Browser Version**
   - Oudere Android browsers hebben beperkte WebRTC support
   - Gebruik Chrome 90+ of Firefox 88+ voor beste resultaten

## Best Practices voor Toekomstige Ontwikkeling

### 1. Altijd TURN Servers Gebruiken
```typescript
// ✅ GOED: Meerdere TURN servers met verschillende poorten
iceServers: [
  { urls: 'turn:server:443' },           // HTTPS poort
  { urls: 'turn:server:443?transport=tcp' }, // TCP
  { urls: 'turn:server:80' },            // UDP fallback
]
```

### 2. Buffer ICE Candidates
```typescript
// ✅ GOED: Buffer candidates tot remoteDescription is gezet
if (!this.peerConnection.remoteDescription) {
  this.pendingRemoteCandidates.push(candidate);
  return;
}
```

### 3. Gebruik Retry Mechanismen
```typescript
// ✅ GOED: Automatische retries bij failures
if (this.iceRestartCount < this.maxIceRestarts) {
  await this.attemptIceRestart();
}
```

### 4. Langere Timeouts voor Mobiel
```typescript
// ✅ GOED: 90 seconden voor calls, 20 seconden voor ICE
const callTimeout = 90000; // Mobiele netwerken zijn langzamer
const iceTimeout = isAndroid ? 20000 : 15000;
```

### 5. Wacht op Room ACK
```typescript
// ✅ GOED: Wacht op room join ACK voordat WebRTC listeners starten
await socketService.joinUserRoom(); // Wacht op ACK
webrtcService.initializeListeners(); // Start daarna pas
```

## Veelvoorkomende Fouten om te Vermijden

### ❌ FOUT 1: Te Korte Timeouts
```typescript
// ❌ FOUT: 30 seconden is te kort voor mobiele netwerken
setTimeout(() => {
  this.updateCallState('failed');
}, 30000);
```

### ❌ FOUT 2: Geen Retry Mechanismen
```typescript
// ❌ FOUT: Direct failed bij eerste failure
if (state === 'failed') {
  this.updateCallState('failed'); // Te snel opgeven!
}
```

### ❌ FOUT 3: ICE Candidates Toevoegen voor Remote Description
```typescript
// ❌ FOUT: Candidate toevoegen voordat remoteDescription is gezet
await this.peerConnection.addIceCandidate(candidate); // Kan falen!
```

### ❌ FOUT 4: Automatisch Antwoorden
```typescript
// ❌ FOUT: Answer automatisch versturen in handleIncomingOffer
socketService.sendAnswer(fromUserId, answer); // Te vroeg!
```

### ❌ FOUT 5: Te Weinig TURN Servers
```typescript
// ❌ FOUT: Alleen STUN servers (werkt niet voor Android NAT)
iceServers: [
  { urls: 'stun:stun.l.google.com:19302' }
]
```

## Monitoring & Debugging

### Debug Overlay (DEV Mode)
- Toont ICE connection state
- Toont laatste candidate type (host/srflx/relay)
- Toont SDP status (local/remote)
- Toont connection state history

### Console Logging
- Zoek naar "🧊 ICE candidate" voor candidate info
- Zoek naar "✅✅✅ TURN/RELAY candidate" voor TURN usage
- Zoek naar "🔄 Attempting ICE restart" voor retry attempts
- Zoek naar "❌ ICE connection failed" voor failures

### Server Logging
- Server logt alle ICE candidate forwarding
- Toont candidate types (host/srflx/relay)
- Toont room existence checks

## Conclusie

De belangrijkste lessen:

1. **Android heeft TURN servers nodig** - Zonder TURN werken calls vaak niet
2. **Langere timeouts zijn essentieel** - Mobiele netwerken zijn langzamer
3. **Automatische retries zijn cruciaal** - Eén failure betekent niet dat het niet werkt
4. **ICE candidate buffering voorkomt errors** - Timing is belangrijk
5. **Room ACK verificatie voorkomt race conditions** - Wacht op bevestiging

**Laatste update:** 2024-12-19
**Commit:** 8223b82 - "Maak bellen betrouwbaarder..."

