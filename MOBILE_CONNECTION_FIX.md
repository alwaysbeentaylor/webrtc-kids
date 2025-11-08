# Mobile Device Connection Troubleshooting

## Probleem
Gesprekken komen niet binnen op mobiele devices (Android en iPhone), terwijl desktop wel werkt.

## Oplossingen Geïmplementeerd

### 1. Socket.IO Transport Prioriteit voor Mobiel

**Probleem:** Mobiele browsers hebben soms problemen met WebSocket verbindingen, vooral op mobiele netwerken.

**Oplossing:** 
- Op mobiel: gebruik `polling` eerst, dan `websocket` (betrouwbaarder)
- Op desktop: gebruik `websocket` eerst, dan `polling` (sneller)

**Code:** `client/src/services/SocketService.ts`
```typescript
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const transports = isMobile ? ['polling', 'websocket'] : ['websocket', 'polling'];
```

### 2. Langere Timeouts voor Mobiel

**Probleem:** Mobiele netwerken hebben vaak langere latency en kunnen timeouts hebben.

**Oplossing:**
- Timeout op mobiel: 20 seconden (vs 10 seconden op desktop)
- Reconnect delay op mobiel: 2 seconden (vs 1 seconde op desktop)
- Max reconnect delay op mobiel: 10 seconden (vs 5 seconden op desktop)

**Code:** `client/src/services/SocketService.ts`
```typescript
timeout: isMobile ? 20000 : 10000,
reconnectionDelay: isMobile ? 2000 : 1000,
reconnectionDelayMax: isMobile ? 10000 : 5000,
```

### 3. Transport Upgrade Logging

**Toegevoegd:** Logging om te zien welk transport wordt gebruikt en wanneer upgrades plaatsvinden.

## Testen op Mobiel

### Stap 1: Check Browser Console

1. Open je app op mobiel device
2. Verbind je device met je computer (USB debugging voor Android, Safari Web Inspector voor iOS)
3. Open browser console
4. Check voor:
   - `isMobile: true`
   - `transports: ['polling', 'websocket']`
   - `✅ Socket.IO CONNECTED!` met `transport: 'polling'` of `transport: 'websocket'`

### Stap 2: Check Railway Logs

1. Ga naar Railway dashboard → Logs
2. Check voor:
   - Socket connections van mobiele devices
   - `✅ User joined their room:` berichten
   - Geen CORS errors

### Stap 3: Test Call Flow

1. Log in op desktop (device 1)
2. Log in op mobiel (device 2)
3. Check of beide devices verbonden zijn:
   - Desktop console: `✅ Socket.IO CONNECTED!`
   - Mobiel console: `✅ Socket.IO CONNECTED!`
4. Start call van desktop naar mobiel
5. Check Railway logs voor:
   - `📞📞📞 ========== CALL OFFER RECEIVED ==========`
   - `📤 Forwarding offer to room: user:...`
   - `Sockets in room: 1` (moet 1 zijn, niet 0)

## Mogelijke Problemen

### Probleem 1: Socket verbindt niet op mobiel

**Symptomen:**
- `❌ Socket connection error` in console
- `Backend niet bereikbaar` melding

**Oplossingen:**
- Check of `VITE_BACKEND_URL` correct is ingesteld in Vercel
- Check of Railway server draait (Railway logs)
- Check of CORS correct is ingesteld (Railway logs)
- Test of je Railway URL bereikbaar is op mobiel: open `https://jouw-railway-app.up.railway.app` in mobiele browser

### Probleem 2: Socket verbindt wel, maar gesprekken komen niet binnen

**Symptomen:**
- `✅ Socket.IO CONNECTED!` in console
- Maar geen `call:offer` events ontvangen

**Oplossingen:**
- Check of `join:user-room` wordt aangeroepen na connect
- Check Railway logs voor `✅ User joined their room:`
- Check of beide devices in hun eigen room zitten
- Check of `room:joined` ACK wordt ontvangen

### Probleem 3: CORS Errors op Mobiel

**Symptomen:**
- `CORS policy` errors in console
- Socket verbindt niet

**Oplossingen:**
- Check Railway `CLIENT_ORIGIN` environment variable
- Zorg dat het exact overeenkomt met je Vercel URL (geen trailing slash)
- Check Railway logs voor CORS logging

## Debugging Tips

### 1. Enable Verbose Logging

In `SocketService.ts`, alle logging is al aanwezig. Check console voor:
- `🔐🔐🔐 Establishing socket connection`
- `🔐🔐🔐 Connecting with options`
- `✅✅✅✅✅ Socket.IO CONNECTED!`
- `⬆️ Transport upgraded to:`

### 2. Check Railway Logs

Railway logs tonen:
- Socket connections
- Room joins
- Call offers/answers
- CORS checks

### 3. Test Transport Manually

Je kunt ook handmatig testen door in `SocketService.ts` tijdelijk te forceren:
```typescript
const transports = ['polling']; // Force polling only
```

## Best Practices

1. **Altijd polling eerst op mobiel** - Betrouwbaarder op mobiele netwerken
2. **Langere timeouts op mobiel** - Mobiele netwerken zijn langzamer
3. **Log transport type** - Helpt bij debugging
4. **Test op echte devices** - Niet alleen emulators

## Volgende Stappen

Als het nog steeds niet werkt:
1. Check Railway logs voor specifieke errors
2. Test met `polling` alleen (tijdelijk)
3. Check of beide devices dezelfde Railway URL gebruiken
4. Test met twee verschillende mobiele devices
5. Check of firewall/proxy niet blokkeert

