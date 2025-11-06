# Quick Start: Deploy naar Vercel

## Stap 1: Maak GitHub Repository (als je die nog niet hebt)

1. Maak een nieuwe repository op GitHub
2. Push je code:
   ```bash
   cd c:\Users\King\webrtc-kids
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/JOUW_USERNAME/webrtc-kids.git
   git push -u origin main
   ```

## Stap 2: Deploy Frontend naar Vercel

### Via Website (Makkelijkste):

1. **Ga naar**: https://vercel.com
2. **Login** met GitHub
3. **Klik "Add New Project"**
4. **Import je repository**: `webrtc-kids`
5. **Configureer**:
   - **Root Directory**: `client`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build` (automatisch)
   - **Output Directory**: `dist` (automatisch)
6. **Environment Variables**:
   - Klik "Environment Variables"
   - Voeg toe: `VITE_BACKEND_URL` = `https://jouw-backend-url.com`
   - (Voor nu kun je een ngrok URL gebruiken, zie Stap 3)
7. **Deploy**!

### Via CLI:

```bash
cd c:\Users\King\webrtc-kids\client
npm install -g vercel
vercel login
vercel
```

## Stap 3: Backend URL Setup

Je hebt 3 opties voor de backend:

### Optie A: Railway (Aanbevolen - Gratis)
1. Ga naar: https://railway.app
2. Login met GitHub
3. New Project → Deploy from GitHub repo
4. Selecteer je `server` folder
5. Railway geeft je een URL zoals: `https://webrtc-kids-server.railway.app`
6. Gebruik deze URL als `VITE_BACKEND_URL` in Vercel

### Optie B: Render (Gratis)
1. Ga naar: https://render.com
2. New → Web Service
3. Connect GitHub repo
4. Root Directory: `server`
5. Build Command: `npm install && npm run build`
6. Start Command: `npm start`
7. Gebruik de gegeven URL als `VITE_BACKEND_URL`

### Optie C: Ngrok (Voor development/testing)
1. Start backend lokaal: `cd server && npm run dev`
2. Start ngrok: `ngrok http 4000`
3. Kopieer HTTPS URL
4. Gebruik deze URL als `VITE_BACKEND_URL` in Vercel

## Stap 4: Update Environment Variable

Na het deployen van backend:

1. Ga naar Vercel Dashboard
2. Selecteer je project
3. Settings → Environment Variables
4. Update `VITE_BACKEND_URL` met je backend URL
5. Redeploy: Deployments → ... → Redeploy

## Klaar! 🎉

Je app is nu live op: `https://jouw-project.vercel.app`

Deze URL werkt overal ter wereld!

