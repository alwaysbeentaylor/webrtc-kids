# Vercel Deployment Guide

## Stap 1: Frontend deployen naar Vercel

1. **Installeer Vercel CLI** (optioneel, kan ook via website):
   ```bash
   npm install -g vercel
   ```

2. **Login bij Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy frontend**:
   ```bash
   cd c:\Users\King\webrtc-kids\client
   vercel
   ```
   
   Volg de instructies:
   - Link to existing project? N (nieuw project)
   - Project name: webrtc-kids-client (of kies zelf)
   - Directory: ./
   - Override settings? N

4. **Set environment variable voor backend URL**:
   ```bash
   vercel env add VITE_BACKEND_URL
   ```
   Voer je backend URL in (zie Stap 2)

5. **Redeploy na environment variable**:
   ```bash
   vercel --prod
   ```

## Stap 2: Backend deployen

Je hebt twee opties:

### Optie A: Backend ook naar Vercel (Serverless Functions)
- Maak een `api` folder in de client
- Converteer Express server naar Vercel serverless functions
- Meer werk, maar alles op één platform

### Optie B: Backend naar andere service (Railway, Render, etc.)
- Deploy backend naar Railway/Render/Heroku
- Gebruik die URL als `VITE_BACKEND_URL`

### Optie C: Backend lokaal houden + ngrok (voor development)
- Gebruik ngrok voor backend tunnel
- Zet ngrok URL als `VITE_BACKEND_URL` in Vercel

## Stap 3: Via Vercel Website (Makkelijker)

1. Ga naar: https://vercel.com
2. Login met GitHub/GitLab/Bitbucket
3. Klik "Add New Project"
4. Import je repository (of maak er een aan)
5. Root Directory: `client`
6. Build Command: `npm run build`
7. Output Directory: `dist`
8. Environment Variables:
   - `VITE_BACKEND_URL`: Je backend URL (ngrok of deployed backend)

## Na deployment:

Je krijgt een URL zoals: `https://webrtc-kids-client.vercel.app`

Deze URL werkt overal ter wereld!



