# Render Deployment Guide voor Backend

## Stap 1: Account aanmaken

1. Ga naar https://render.com
2. Klik op "Get Started for Free"
3. Maak een account (gebruik GitHub login voor makkelijke integratie)

## Stap 2: Nieuwe Web Service aanmaken

1. Klik op "New +" in de top rechts
2. Selecteer "Web Service"
3. Verbind je GitHub repository:
   - Klik op "Connect GitHub" als je nog niet verbonden bent
   - Selecteer je `webrtc-kids` repository
   - Klik "Connect"

## Stap 3: Service configureren

Vul de volgende instellingen in:

### Basic Settings:
- **Name**: `webrtc-kids-backend`
- **Region**: Kies het dichtstbijzijnde (bijv. Frankfurt voor Europa)
- **Branch**: `main` (of `master` als je die gebruikt)
- **Root Directory**: Laat leeg (of `server` als je alleen de server folder wilt deployen)
- **Runtime**: `Node`
- **Build Command**: 
  ```
  cd server && npm install && npm run build
  ```
- **Start Command**: 
  ```
  cd server && npm start
  ```

### Environment Variables:
Klik op "Add Environment Variable" en voeg deze toe:

1. **PORT** = `4000`
2. **CLIENT_ORIGIN** = Je Vercel frontend URL (bijv. `https://jouw-app.vercel.app`)
3. **NODE_ENV** = `production`

### Advanced Settings (optioneel):
- **Auto-Deploy**: `Yes` (automatisch deployen bij elke push)

## Stap 4: Deploy

1. Klik op "Create Web Service"
2. Wacht tot de build en deploy klaar zijn (kan 5-10 minuten duren)
3. Je krijgt een URL zoals: `https://webrtc-kids-backend.onrender.com`

## Stap 5: Backend URL updaten in Vercel

1. Ga naar je Vercel Dashboard
2. Ga naar Settings → Environment Variables
3. Update `VITE_BACKEND_URL` met je Render URL:
   - Key: `VITE_BACKEND_URL`
   - Value: `https://webrtc-kids-backend.onrender.com` (of jouw Render URL)
4. Redeploy je Vercel app

## Stap 6: Testen

1. Open je Vercel app
2. Open browser console (F12)
3. Log in
4. Check of je ziet: `✅✅✅ Socket.IO CONNECTED!`
5. Test of bellen werkt

## Belangrijk:

- **Render Free Tier**: 
  - Je app gaat "slapen" na 15 minuten inactiviteit
  - Eerste request kan 30-60 seconden duren (wake-up tijd)
  - Perfect voor development/testing, maar niet ideaal voor productie

- **Voor productie**: Overweeg Render's "Starter" plan ($7/maand) voor altijd-online service

## Troubleshooting:

- Als de build faalt: Check de logs in Render dashboard
- Als socket niet verbindt: Check of `CLIENT_ORIGIN` correct is ingesteld
- Als de app niet start: Check of `package.json` een `start` script heeft

