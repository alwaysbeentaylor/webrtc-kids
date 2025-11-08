# Railway.app Deployment Guide

## Waarom Railway?

Railway is ideaal voor deze WebRTC app omdat:
- ✅ Geen slaapstand (altijd online)
- ✅ Uitstekende WebSocket/Socket.IO ondersteuning
- ✅ Snelle performance
- ✅ Eenvoudige deployment via GitHub
- ✅ Automatische HTTPS
- ✅ Goede prijs/kwaliteit ($5-10/maand)

## Stap 1: Account aanmaken

1. Ga naar [railway.app](https://railway.app)
2. Meld je aan met GitHub
3. Je krijgt $5 gratis credit om te beginnen

## Stap 2: Nieuw Project aanmaken

1. Klik op "New Project"
2. Kies "Deploy from GitHub repo"
3. Selecteer je `webrtc-kids` repository
4. Railway detecteert automatisch dat het een Node.js project is

## Stap 3: Server Deployment

1. Railway zal automatisch de `server` folder detecteren
2. Als dat niet gebeurt:
   - Ga naar "Settings" → "Root Directory"
   - Zet op: `server`
3. Railway zal automatisch detecteren:
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
4. **BELANGRIJK:** Railway gebruikt standaard Node.js v18, maar Firebase vereist Node.js >=20
   - Het `.nvmrc` bestand in de `server` folder specificeert Node.js 20
   - Railway zou dit automatisch moeten detecteren
   - Als het niet werkt, voeg toe aan Railway Variables: `NODE_VERSION=20`

## Stap 4: Environment Variables instellen

### 4.1: Basis Variables

1. In je Railway project, klik op je **service** (de server die je net hebt aangemaakt)
2. Klik op de tab **"Variables"** bovenaan
3. Klik op **"+ New Variable"** of **"Raw Editor"** (rechtsboven)

Voeg deze variabelen toe (één per regel in Raw Editor, of één voor één met + New Variable):

```
PORT=4000
NODE_ENV=production
CLIENT_ORIGIN=https://jouw-frontend-url.vercel.app
NIXPACKS_NO_INSTALL_DEV=false
```

**Let op:** 
- Vervang `https://jouw-frontend-url.vercel.app` met je echte Vercel frontend URL!
- `NIXPACKS_NO_INSTALL_DEV=false` zorgt ervoor dat Railway ook devDependencies installeert (nodig voor TypeScript build)

### 4.2: Firebase Admin SDK Variables

**BELANGRIJK:** Je code gebruikt `FIREBASE_PROJECT_ID` en `FIREBASE_SERVICE_ACCOUNT_PATH` of individuele variabelen.

Je hebt twee opties:

#### Optie A: Service Account JSON als String (Aanbevolen)

1. Ga naar [Firebase Console](https://console.firebase.google.com)
2. Selecteer je project
3. Ga naar **⚙️ Project Settings** (tandwiel icoon linksonder)
4. Klik op de tab **"Service Accounts"**
5. Klik op **"Generate new private key"** (blauwe knop onderaan)
6. Er verschijnt een popup met een waarschuwing - klik op **"Generate key"** om te bevestigen
7. Een JSON bestand wordt automatisch gedownload (bijvoorbeeld `xoma-7c1d7-firebase-adminsdk-fbsvc-xxxxx.json`)

**BELANGRIJK:** Bewaar dit bestand veilig! Het bevat gevoelige credentials.

**In Railway:**

1. Ga terug naar Railway → je service → **Variables** tab → **Raw Editor**
2. Je hebt nu deze drie variabelen:
   ```
   PORT=4000
   NODE_ENV=production
   CLIENT_ORIGIN=https://webrtc-kids-waa3.vercel.app
   ```
3. Voeg een nieuwe regel toe onderaan:
   ```
   FIREBASE_SERVICE_ACCOUNT=
   ```
4. Plak de volledige JSON direct na het `=` teken. Je kunt het op twee manieren doen:

   **Methode 1: Als één regel (aanbevolen)**
   - Kopieer het hele JSON bestand (van `{` tot `}`)
   - Plak het direct na `FIREBASE_SERVICE_ACCOUNT=` op dezelfde regel
   - Het ziet er zo uit:
     ```
     FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"xoma-7c1d7","private_key_id":"01b2d613ed9a12ecbcf88a8daed6512bd4c6c1e5","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC66PVGfQGwYsI9\n...","client_email":"firebase-adminsdk-fbsvc@xoma-7c1d7.iam.gserviceaccount.com",...}
     ```

   **Methode 2: Multiline (als Methode 1 niet werkt)**
   - Railway accepteert ook multiline JSON
   - Plak het JSON zoals het is, maar zorg dat het op dezelfde regel begint:
     ```
     FIREBASE_SERVICE_ACCOUNT={
       "type": "service_account",
       "project_id": "xoma-7c1d7",
       ...
     }
     ```

5. Klik op **"Update Variables"** (paarse knop rechtsonder)
6. Railway zal automatisch redeployen
7. Check de **Logs** tab - je zou moeten zien: `✅ Firebase Admin initialized with FIREBASE_SERVICE_ACCOUNT`

**Voorbeeld van complete variables list:**
```
PORT=4000
NODE_ENV=production
CLIENT_ORIGIN=https://webrtc-kids-waa3.vercel.app
NIXPACKS_NO_INSTALL_DEV=false
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"jouw-project-id","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxxxx@jouw-project.iam.gserviceaccount.com",...}
```

**Tip:** Als je problemen hebt met het plakken:
- Gebruik de **Raw Editor** in Railway (niet de individuele variable editor)
- Zorg dat de JSON begint direct na `FIREBASE_SERVICE_ACCOUNT=` zonder spatie
- De `\n` characters in de `private_key` moeten behouden blijven (Railway doet dit automatisch)

#### Optie B: Individuele Variables (Als Optie A niet werkt)

Als je problemen hebt met de JSON string, gebruik dan individuele variabelen:

1. Open het Firebase Service Account JSON bestand
2. Zoek deze velden en kopieer ze:

**Variable 1:**
- **Name:** `FIREBASE_PROJECT_ID`
- **Value:** De waarde van `"project_id"` (bijvoorbeeld: `mijn-project-123`)

**Variable 2:**
- **Name:** `FIREBASE_PRIVATE_KEY`
- **Value:** De waarde van `"private_key"` - **BELANGRIJK:** Kopieer alles inclusief `-----BEGIN PRIVATE KEY-----` en `-----END PRIVATE KEY-----` en alle regels ertussen

**Variable 3:**
- **Name:** `FIREBASE_CLIENT_EMAIL`
- **Value:** De waarde van `"client_email"` (bijvoorbeeld: `firebase-adminsdk-xxxxx@mijn-project-123.iam.gserviceaccount.com`)

**Tip voor private_key:** 
- Als je het in Railway plakt, behoudt het automatisch de newlines (`\n`)
- Als je het via Raw Editor plakt, plak het precies zoals het is (met alle regels)

### 4.3: Controleren of het werkt

Na het toevoegen van alle variables:
1. Klik op **"Deploy"** of wacht tot Railway automatisch redeployt
2. Ga naar de **"Logs"** tab
3. Je zou moeten zien: `🚀 Starting server...` en `✅ Signaling server listening on...`
4. Als je errors ziet over Firebase, check of de variables correct zijn gezet

### Troubleshooting Environment Variables

**Probleem: "Firebase Admin SDK not initialized"**
- Check of `FIREBASE_SERVICE_ACCOUNT` correct is gezet (volledige JSON)
- Of check of alle individuele Firebase variables zijn gezet

**Probleem: "PORT already in use"**
- Railway stelt automatisch `PORT` in via `$PORT` environment variable
- Je kunt `PORT=4000` verwijderen, Railway gebruikt automatisch de juiste port
- Of gebruik `PORT=$PORT` om Railway's port te gebruiken

**Probleem: CORS errors**
- Check of `CLIENT_ORIGIN` exact overeenkomt met je frontend URL
- Zorg dat er geen trailing slash is: `https://app.vercel.app` (niet `https://app.vercel.app/`)

### Voorbeeld: Complete Variables List

**✅ Wat je nu al hebt (goed!):**
```
PORT=4000
NODE_ENV=production
CLIENT_ORIGIN=https://webrtc-kids-waa3.vercel.app
```

**➕ Voeg nu toe: Firebase variabelen**

Je hebt twee opties:

#### Optie A: Eén variabele met volledige JSON (Aanbevolen)

Voeg deze regel toe aan je Raw Editor:
```
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"jouw-project-id","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxxxx@jouw-project.iam.gserviceaccount.com",...}
```

**Hoe je dit krijgt:**
1. Ga naar [Firebase Console](https://console.firebase.google.com)
2. Selecteer je project
3. ⚙️ Project Settings → Service Accounts tab
4. Klik "Generate new private key"
5. Download het JSON bestand
6. Open het JSON bestand en kopieer ALLES (van `{` tot `}`)
7. Plak het in Railway als waarde van `FIREBASE_SERVICE_ACCOUNT`

**Uiteindelijk ziet het er zo uit:**
```
PORT=4000
NODE_ENV=production
CLIENT_ORIGIN=https://webrtc-kids-waa3.vercel.app
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"mijn-project-123",...}
```

#### Optie B: Drie aparte variabelen (Als Optie A niet werkt)

Voeg deze drie regels toe:
```
FIREBASE_PROJECT_ID=jouw-project-id
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@jouw-project.iam.gserviceaccount.com
```

**Uiteindelijk ziet het er zo uit:**
```
PORT=4000
NODE_ENV=production
CLIENT_ORIGIN=https://webrtc-kids-waa3.vercel.app
FIREBASE_PROJECT_ID=mijn-project-123
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@mijn-project-123.iam.gserviceaccount.com
```

**Na het toevoegen:**
1. Klik op **"Update Variables"** (paarse knop rechtsonder)
2. Railway zal automatisch redeployen
3. Check de **Logs** tab - je zou moeten zien: `✅ Firebase Admin initialized with...`

## Stap 5: Custom Domain (optioneel)

1. Ga naar "Settings" → "Networking"
2. Klik op "Generate Domain" voor een gratis Railway domain
3. Of voeg je eigen custom domain toe

## Stap 6: Frontend URL updaten

Update je frontend (Vercel) environment variable:
```
VITE_BACKEND_URL=https://jouw-railway-app.up.railway.app
```

**Hoe je je Railway URL vindt:**
1. Ga naar Railway dashboard → je service
2. Klik op "Settings" → "Networking"
3. Kopieer de "Public Domain" URL (bijvoorbeeld: `https://jouw-app.up.railway.app`)

**In Vercel:**
1. Ga naar je Vercel project → "Settings" → "Environment Variables"
2. Zoek `VITE_BACKEND_URL` of maak een nieuwe aan
3. Zet de waarde naar je Railway URL (bijvoorbeeld: `https://jouw-app.up.railway.app`)
4. Klik "Save"
5. Vercel zal automatisch redeployen

## Stap 7: Testen

### Test 1: Check Railway Logs

1. Ga naar Railway dashboard → je service → **"Logs"** tab
2. Je zou moeten zien:
   ```
   ✅ Firebase Admin initialized with FIREBASE_SERVICE_ACCOUNT
   🚀 Starting server...
   ✅ Signaling server listening on port 4000
   ```
3. Als je errors ziet, check de troubleshooting sectie hieronder

### Test 2: Test Server Bereikbaarheid

1. Open je browser en ga naar: `https://jouw-railway-app.up.railway.app`
2. Je zou een error moeten zien (dat is normaal - de server heeft geen root endpoint)
3. Of test met curl in terminal:
   ```bash
   curl https://jouw-railway-app.up.railway.app
   ```
4. Je zou een error moeten krijgen, maar geen "connection refused" - dat betekent dat de server draait

### Test 3: Test Socket.IO Verbinding

1. Open je frontend app (Vercel)
2. Open browser Developer Tools (F12) → Console tab
3. Log in met een account
4. Je zou moeten zien:
   ```
   🌐 Using VITE_BACKEND_URL: https://jouw-railway-app.up.railway.app
   🔌 Connecting to socket server...
   ✅ Socket connected successfully
   ```
5. Als je errors ziet over CORS of connection, check:
   - `CLIENT_ORIGIN` in Railway variables komt overeen met je Vercel URL
   - `VITE_BACKEND_URL` in Vercel komt overeen met je Railway URL

### Test 4: Test WebRTC Call

1. Open je app op twee verschillende devices (of twee browser tabs)
2. Log in met twee verschillende accounts
3. Start een call van device 1 naar device 2
4. Accepteer de call op device 2
5. Check of:
   - Audio/video werkt
   - Verbinding stabiel is
   - Geen errors in console

### Test 5: Check Railway Metrics

1. Ga naar Railway dashboard → je service → **"Metrics"** tab
2. Check:
   - CPU usage (zou laag moeten zijn als er geen actieve calls zijn)
   - Memory usage
   - Network traffic
3. Als je hoge CPU/memory ziet zonder actieve calls, kan er een probleem zijn

## Troubleshooting

**Server start niet:**
- Check Railway logs voor errors
- Check of alle environment variables correct zijn ingesteld
- Check of `NIXPACKS_NO_INSTALL_DEV=false` is ingesteld
- Check of `NODE_VERSION=20` is ingesteld

**Socket.IO verbindt niet:**
- Check of `CLIENT_ORIGIN` exact overeenkomt met je Vercel URL (geen trailing slash)
- Check of `VITE_BACKEND_URL` correct is ingesteld in Vercel
- Check browser console voor CORS errors
- Check Railway logs voor connection errors

**Firebase errors:**
- Check of `FIREBASE_SERVICE_ACCOUNT` correct is gezet (volledige JSON)
- Check Railway logs voor Firebase initialization errors
- Check of Firebase project ID correct is

**Calls werken niet:**
- Check browser console voor WebRTC errors
- Check Railway logs voor signaling errors
- Test met twee verschillende devices (niet twee tabs op dezelfde browser)
- Check of beide devices toegang hebben tot camera/microfoon

## Monitoring

**Railway Dashboard:**
- Logs: Real-time server logs
- Metrics: CPU, Memory, Network usage
- Deployments: Deployment history en status

**Browser Console:**
- Socket.IO connection status
- WebRTC connection status
- Errors en warnings

**Vercel Dashboard:**
- Frontend deployment status
- Environment variables
- Build logs

## Stap 7: Monitoring

Railway heeft ingebouwde monitoring:
- Logs zijn real-time beschikbaar
- Metrics voor CPU, RAM, Network
- Alerts kunnen worden ingesteld

## Pricing

**Hobby Plan ($5/maand):**
- $5 credit per maand
- Pay-as-you-go daarna ($0.000463/GB RAM per uur)
- Geschikt voor kleine tot middelgrote apps

**Voor deze app:**
- Verwacht ~$5-10/maand
- Hangt af van aantal gebruikers en verkeer
- Veel beter dan Render free tier

## Troubleshooting

**Socket.IO verbindt niet:**
- Check of `CLIENT_ORIGIN` correct is ingesteld
- Check Railway logs voor errors
- Zorg dat port 4000 beschikbaar is

**Build faalt:**
- Check of `package.json` scripts correct zijn
- Check Railway logs voor specifieke errors
- Zorg dat alle dependencies in `package.json` staan

**Performance issues:**
- Upgrade naar meer RAM in Railway settings
- Check Railway metrics voor bottlenecks
- Overweeg database caching

## Migratie van Render

1. Zet Railway op
2. Test grondig
3. Update frontend `VITE_BACKEND_URL`
4. Monitor voor 24 uur
5. Als alles goed gaat, stop Render service

## Tips

- Gebruik Railway's GitHub integration voor automatische deploys
- Monitor je usage in Railway dashboard
- Set up alerts voor hoge usage
- Railway heeft goede documentatie voor Node.js apps

