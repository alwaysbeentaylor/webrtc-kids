# Quick Fix Checklist - Mobile Connection

## Railway URL
✅ **Backend URL:** `https://webrtc-kids-production.up.railway.app`

## Stap 1: Vercel Environment Variable Updaten

1. Ga naar Vercel → je project → **Settings** → **Environment Variables**
2. Zoek `VITE_BACKEND_URL` of maak een nieuwe aan
3. Zet de waarde naar: `https://webrtc-kids-production.up.railway.app`
   - **BELANGRIJK:** Geen trailing slash aan het einde!
   - Correct: `https://webrtc-kids-production.up.railway.app`
   - Fout: `https://webrtc-kids-production.up.railway.app/`
4. Klik **Save**
5. Vercel zal automatisch redeployen (wacht 1-2 minuten)

## Stap 2: Railway CORS Check

1. Ga naar Railway → je service → **Variables**
2. Check of `CLIENT_ORIGIN` correct is ingesteld:
   ```
   CLIENT_ORIGIN=https://webrtc-kids-waa3.vercel.app
   ```
   - **BELANGRIJK:** Exact overeenkomen met je Vercel URL
   - Geen trailing slash
   - Moet beginnen met `https://`

## Stap 3: Testen

1. **Wacht op Vercel redeploy** (check Vercel dashboard → Deployments)
2. **Refresh app op mobiel** (hard refresh: sluit app volledig)
3. **Check status indicator** (linksboven):
   - Groen = Verbonden ✅
   - Rood = Nog niet verbonden ❌
4. **Klik op status indicator** om details te zien:
   - Backend URL moet zijn: `https://webrtc-kids-production.up.railway.app`
   - Transport: `polling` of `websocket`
   - Device: `Mobiel (Android)` of `Mobiel (iOS)`

## Stap 4: Als het nog steeds niet werkt

### Check Railway Logs:
1. Railway dashboard → je service → **Logs**
2. Check voor:
   - `✅ Signaling server listening on port...`
   - Socket connections van mobiele devices
   - CORS errors

### Check Vercel Logs:
1. Vercel dashboard → je project → **Deployments**
2. Klik op laatste deployment → **Build Logs**
3. Check of `VITE_BACKEND_URL` correct is gebuild

### Test Backend Bereikbaarheid:
1. Open op mobiel: `https://webrtc-kids-production.up.railway.app`
2. Je zou een error moeten zien (normaal - server heeft geen root endpoint)
3. Als je "connection refused" ziet = server draait niet
4. Als je een error ziet = server draait wel ✅

## Belangrijke URLs

- **Railway Backend:** `https://webrtc-kids-production.up.railway.app`
- **Vercel Frontend:** `https://webrtc-kids-waa3.vercel.app` (of jouw Vercel URL)

## Environment Variables Checklist

### Railway Variables:
```
PORT=4000
NODE_ENV=production
CLIENT_ORIGIN=https://webrtc-kids-waa3.vercel.app
NIXPACKS_NO_INSTALL_DEV=false
NODE_VERSION=20
FIREBASE_SERVICE_ACCOUNT={...}
```

### Vercel Variables:
```
VITE_BACKEND_URL=https://webrtc-kids-production.up.railway.app
```

## Troubleshooting

**Probleem: Status blijft rood op mobiel**
- Check of `VITE_BACKEND_URL` correct is in Vercel
- Check of Railway server draait (Railway logs)
- Check of CORS correct is ingesteld (`CLIENT_ORIGIN` in Railway)

**Probleem: Backend URL toont oude Render URL**
- Vercel heeft nog niet gerebuild
- Wacht op nieuwe deployment
- Of force rebuild in Vercel

**Probleem: CORS errors**
- Check of `CLIENT_ORIGIN` exact overeenkomt met Vercel URL
- Geen trailing slash
- Moet `https://` zijn (niet `http://`)

