# Deploy naar Vercel via GitHub - Stap voor Stap

## Stap 1: GitHub Account & Repository

### 1.1 Maak GitHub account aan (als je die nog niet hebt)
- Ga naar: https://github.com/signup
- Maak een gratis account aan

### 1.2 Maak nieuwe repository aan
- Ga naar: https://github.com/new
- Repository name: `webrtc-kids` (of kies zelf)
- Description: "Video calling app for families"
- Public of Private (kies zelf)
- **NIET** "Initialize with README" aanvinken
- Klik "Create repository"

### 1.3 Push je code naar GitHub

Open PowerShell in `c:\Users\King\webrtc-kids`:

```bash
# Initialiseer git (als nog niet gedaan)
git init

# Voeg alle bestanden toe
git add .

# Maak eerste commit
git commit -m "Initial commit - WebRTC Kids app"

# Voeg GitHub remote toe (vervang JOUW_USERNAME)
git remote add origin https://github.com/JOUW_USERNAME/webrtc-kids.git

# Push naar GitHub
git branch -M main
git push -u origin main
```

**Let op**: Vervang `JOUW_USERNAME` met je GitHub username!

## Stap 2: Deploy Frontend naar Vercel

### 2.1 Login bij Vercel
- Ga naar: https://vercel.com
- Klik "Sign Up" of "Login"
- Kies "Continue with GitHub"
- Autoriseer Vercel om toegang te krijgen tot je GitHub

### 2.2 Import Project
- Klik "Add New Project"
- Selecteer je `webrtc-kids` repository
- Configureer:
  - **Root Directory**: `client` (belangrijk!)
  - **Framework Preset**: Vite (wordt automatisch gedetecteerd)
  - **Build Command**: `npm run build` (automatisch)
  - **Output Directory**: `dist` (automatisch)

### 2.3 Environment Variables
- Klik "Environment Variables"
- Voeg toe:
  - **Name**: `VITE_BACKEND_URL`
  - **Value**: `https://jouw-backend-url.com` (zie Stap 3)
  - **Environment**: Production, Preview, Development (alle drie aanvinken)

### 2.4 Deploy!
- Klik "Deploy"
- Wacht tot deployment klaar is
- Je krijgt een URL zoals: `https://webrtc-kids-client.vercel.app`

## Stap 3: Backend Deployen

Je hebt 3 opties:

### Optie A: Railway (Aanbevolen - Gratis, makkelijk)
1. Ga naar: https://railway.app
2. Login met GitHub
3. "New Project" → "Deploy from GitHub repo"
4. Selecteer je `webrtc-kids` repository
5. Configureer:
   - **Root Directory**: `server`
   - **Start Command**: `npm start`
   - **Build Command**: `npm install && npm run build`
6. Railway geeft je een URL zoals: `https://webrtc-kids-server.railway.app`
7. **Gebruik deze URL** als `VITE_BACKEND_URL` in Vercel

### Optie B: Render (Gratis)
1. Ga naar: https://render.com
2. Login met GitHub
3. "New" → "Web Service"
4. Connect je `webrtc-kids` repository
5. Configureer:
   - **Root Directory**: `server`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
6. Render geeft je een URL
7. Gebruik deze URL als `VITE_BACKEND_URL`

### Optie C: Ngrok (Voor nu, snel testen)
1. Start backend lokaal: `cd server && npm run dev`
2. Start ngrok: `ngrok http 4000`
3. Kopieer HTTPS URL
4. Gebruik deze URL als `VITE_BACKEND_URL` in Vercel

## Stap 4: Update Environment Variable

Na backend deployment:

1. Ga naar Vercel Dashboard
2. Selecteer je project
3. Settings → Environment Variables
4. Update `VITE_BACKEND_URL` met je backend URL
5. Ga naar Deployments → ... → Redeploy

## Stap 5: Klaar! 🎉

Je app is nu live op: `https://jouw-project.vercel.app`

Deze URL werkt overal ter wereld!

## Tips:
- Elke keer als je code pusht naar GitHub, deployt Vercel automatisch
- Je kunt meerdere environments hebben (production, preview, development)
- Backend moet altijd draaien voor de app om te werken

