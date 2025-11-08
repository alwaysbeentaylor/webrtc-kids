# Deploy naar Vercel ZONDER GitHub

## Stap 1: Login bij Vercel

```bash
vercel login
```

Dit opent je browser. Maak een Vercel account aan (gratis) of login.

## Stap 2: Deploy Frontend

```bash
cd c:\Users\King\webrtc-kids\client
vercel
```

Volg de vragen:
- Set up and deploy? **Y**
- Which scope? (Kies je account)
- Link to existing project? **N**
- What's your project's name? **webrtc-kids-client** (of kies zelf)
- In which directory is your code located? **./**
- Want to override settings? **N**

## Stap 3: Set Environment Variable

```bash
vercel env add VITE_BACKEND_URL
```

Kies:
- Environment: **Production** (en eventueel Preview/Development)
- Value: Je backend URL (ngrok of deployed backend)

## Stap 4: Deploy naar Production

```bash
vercel --prod
```

## Stap 5: Backend URL Setup

Voor de backend URL heb je 2 opties:

### Optie A: Ngrok (Snel voor nu)
1. Start backend: `cd ..\server && npm run dev`
2. Start ngrok: `ngrok http 4000`
3. Kopieer HTTPS URL
4. Gebruik deze als `VITE_BACKEND_URL`

### Optie B: Railway (Permanent, gratis)
1. Ga naar: https://railway.app
2. Login met email (geen GitHub nodig!)
3. New Project → Empty Project
4. Add Service → GitHub (of gebruik Railway CLI)
5. Of upload je server folder handmatig

## Na deployment:

Je krijgt een URL zoals: `https://webrtc-kids-client.vercel.app`

Deze URL werkt overal!



