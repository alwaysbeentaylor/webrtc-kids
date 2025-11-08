# Android WebRTC Troubleshooting Guide

## ⚠️ BELANGRIJK: Android-Specifieke Problemen

Android heeft unieke uitdagingen met WebRTC die niet voorkomen bij iOS of desktop browsers.

## Veelvoorkomende Android Problemen

### 1. Calls Werken Niet Tussen Android Devices

**Symptomen:**
- Call komt binnen maar kan niet worden opgenomen
- "Gesprek mislukt" error
- ICE connection blijft "checking" of gaat naar "failed"

**Oorzaken:**
- Android heeft restrictievere NAT/firewall settings
- TURN servers zijn niet bereikbaar
- ICE candidates worden niet correct uitgewisseld

**Oplossingen:**

1. **Check TURN Server Usage**
   ```javascript
   // Open browser console en zoek naar:
   "✅✅✅ TURN/RELAY candidate" // ✅ Goed - TURN wordt gebruikt
   "🧊 ICE candidate generated (type: host)" // ❌ Slecht - alleen directe connectie
   ```

2. **Check Firewall/Proxy Instellingen**
   - Android kan TURN servers blokkeren
   - Test met verschillende TURN servers
   - Check of poort 443 (HTTPS) bereikbaar is

3. **Check Network Type**
   - WiFi werkt vaak beter dan 4G/5G
   - Sommige Android devices hebben problemen met mobiele data
   - Test op beide netwerken

### 2. Langzame Verbinding Opzetten

**Symptomen:**
- Call duurt lang voordat deze wordt opgenomen
- ICE gathering duurt > 10 seconden
- "Checking" state blijft lang hangen

**Oorzaken:**
- Android heeft meer tijd nodig voor ICE gathering
- Trage netwerkverbinding
- Te veel TURN servers (kan vertragen)

**Oplossingen:**

1. **Verhoog Timeouts**
   ```typescript
   // Huidige timeouts zijn:
   - Call timeout: 90 seconden
   - ICE disconnected: 20 seconden (Android)
   // Als dit nog steeds te kort is, verhoog verder
   ```

2. **Check Network Speed**
   - Test met speedtest app
   - Trage netwerken hebben meer tijd nodig
   - Overweeg WiFi als 4G te traag is

3. **Reduce TURN Server Count**
   - Te veel TURN servers kunnen vertragen
   - Huidige configuratie heeft 6 servers
   - Test met minder servers als het te langzaam is

### 3. Verbinding Val Weg Tijdens Call

**Symptomen:**
- Call werkt eerst maar valt weg
- "Disconnected" state tijdens actieve call
- Audio/video stopt plotseling

**Oorzaken:**
- Network switching (WiFi ↔ 4G)
- TURN server verbinding verloren
- Battery optimization sluit verbinding

**Oplossingen:**

1. **Check Battery Optimization**
   ```javascript
   // Android kan apps sluiten voor batterijbesparing
   // Instellingen → Apps → [App] → Battery → Unrestricted
   ```

2. **Check Network Stability**
   - WiFi signal strength
   - 4G/5G signal strength
   - Network switching kan problemen veroorzaken

3. **Automatische Recovery**
   - Code heeft automatische recovery bij disconnected
   - Check logs voor recovery attempts
   - Als recovery faalt, probeer handmatig opnieuw te bellen

### 4. Geen Audio/Video

**Symptomen:**
- Call wordt opgenomen maar geen audio/video
- Zwart scherm tijdens call
- Microfoon werkt niet

**Oorzaken:**
- Permissions niet verleend
- Browser blokkeert media access
- Media tracks niet correct toegevoegd

**Oplossingen:**

1. **Check Permissions**
   ```javascript
   // Chrome: Settings → Site Settings → Camera/Microphone
   // Firefox: Settings → Privacy → Permissions → Camera/Microphone
   // Check of permissions zijn verleend voor de website
   ```

2. **Check Browser Console**
   ```javascript
   // Zoek naar errors zoals:
   "NotAllowedError" // Permission denied
   "NotFoundError" // Camera/microphone not found
   "NotReadableError" // Device already in use
   ```

3. **Test Media Access**
   ```javascript
   // Test of media toegankelijk is:
   navigator.mediaDevices.getUserMedia({ video: true, audio: true })
     .then(stream => console.log('✅ Media access OK'))
     .catch(err => console.error('❌ Media access failed:', err));
   ```

## Android-Specifieke Code Checks

### Check 1: TURN Server Detection
```typescript
// In browser console tijdens call:
// Zoek naar deze logs:
"✅✅✅ TURN/RELAY candidate" // ✅ Goed
"🧊 ICE candidate generated (type: relay)" // ✅ Goed
"🧊 ICE candidate generated (type: host)" // ⚠️ Alleen directe connectie
```

### Check 2: ICE Connection State
```typescript
// Debug overlay toont:
// - ICE State: connected/completed ✅ Goed
// - ICE State: checking ⚠️ Nog bezig
// - ICE State: failed ❌ Probleem
```

### Check 3: Network Type
```typescript
// Check network type:
navigator.connection?.effectiveType // "4g", "3g", "slow-2g"
navigator.connection?.downlink // Bandwidth in Mbps
```

## Debugging Stappen voor Android

### Stap 1: Open Browser Console
1. Open Chrome op Android
2. Ga naar `chrome://inspect`
3. Selecteer je device
4. Open console tab

### Stap 2: Start Call
1. Start een call tussen twee Android devices
2. Monitor console logs
3. Zoek naar ICE candidate logs
4. Check TURN server usage

### Stap 3: Check Connection State
1. Kijk naar debug overlay (DEV mode)
2. Check ICE connection state
3. Check candidate types
4. Check SDP status

### Stap 4: Test TURN Servers
```javascript
// Test TURN server bereikbaarheid:
const pc = new RTCPeerConnection({
  iceServers: [{ urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' }]
});
pc.onicecandidate = (e) => {
  if (e.candidate) {
    console.log('Candidate:', e.candidate.candidate);
    if (e.candidate.candidate.includes('relay')) {
      console.log('✅ TURN server werkt!');
    }
  }
};
```

## Veelvoorkomende Android Browser Issues

### Chrome (Android)
- ✅ Beste WebRTC support
- ✅ Goede TURN server support
- ⚠️ Kan media permissions blokkeren
- ⚠️ Battery optimization kan verbinding sluiten

### Firefox (Android)
- ✅ Goede WebRTC support
- ⚠️ Minder goede TURN server support
- ⚠️ Kan problemen hebben met sommige TURN servers

### Samsung Internet
- ⚠️ Beperkte WebRTC support
- ⚠️ Kan problemen hebben met TURN servers
- ✅ Gebruik Chrome of Firefox voor beste resultaten

## Preventieve Maatregelen

### 1. Altijd TURN Servers Gebruiken
```typescript
// ✅ GOED: Meerdere TURN servers
iceServers: [
  { urls: 'turn:server:443' },
  { urls: 'turn:server:443?transport=tcp' },
  { urls: 'turn:server:80' }
]
```

### 2. Langere Timeouts voor Android
```typescript
// ✅ GOED: Langere timeouts
const timeout = isAndroid ? 20000 : 15000;
const callTimeout = 90000; // 90 seconden voor calls
```

### 3. Automatische Retries
```typescript
// ✅ GOED: Automatische retries
if (this.iceRestartCount < this.maxIceRestarts) {
  await this.attemptIceRestart();
}
```

### 4. Check Permissions
```typescript
// ✅ GOED: Check permissions voordat call start
const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
```

## Conclusie

Android heeft speciale aandacht nodig voor WebRTC:

1. **TURN servers zijn essentieel** - Zonder TURN werken calls vaak niet
2. **Langere timeouts zijn nodig** - Android heeft meer tijd nodig
3. **Automatische retries zijn cruciaal** - Eén failure betekent niet dat het niet werkt
4. **Permissions moeten expliciet zijn** - Check altijd permissions
5. **Network stability is belangrijk** - WiFi werkt vaak beter dan 4G

**Laatste update:** 2024-12-19


