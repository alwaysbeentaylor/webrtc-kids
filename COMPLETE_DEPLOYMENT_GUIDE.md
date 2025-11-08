# Complete Guide: GitHub + Vercel Deployment

## Stap 1: Installeer Git

1. **Download Git voor Windows**:
   - Ga naar: https://git-scm.com/download/win
   - Download en installeer (gebruik standaard instellingen)

2. **Verifieer installatie**:
   ```bash
   git --version
   ```

## Stap 2: Maak GitHub Account & Repository

### 2.1 GitHub Account
- Ga naar: https://github.com/signup
- Maak gratis account aan

### 2.2 Maak Repository
- Ga naar: https://github.com/new
- Repository name: `webrtc-kids`
- Kies Public of Private
- **NIET** "Initialize with README" aanvinken
- Klik "Create repository"

## Stap 3: Push Code naar GitHub

Open PowerShell in `c:\Users\King\webrtc-kids`:

```bash
# Configureer Git (eenmalig)
git config --global user.name "Jouw Naam"
git config --global user.email "jouw@email.com"

# Initialiseer repository
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

**Let op**: 
- Vervang `JOUW_USERNAME` met je GitHub username
- Je wordt gevraagd om GitHub username en password/token

## Stap 4: Deploy naar Vercel

### 4.1 Login bij Vercel
- Ga naar: https://vercel.com
- Klik "Sign Up" → "Continue with GitHub"
- Autoriseer Vercel

### 4.2 Import Project
- Klik "Add New Project"
- Selecteer `webrtc-kids` repository
- **Belangrijk**: Root Directory = `client`
- Framework wordt automatisch gedetecteerd (Vite)
- Klik "Deploy"

### 4.3 Environment Variable
- Ga naar Project Settings → Environment Variables
- Voeg toe: `VITE_BACKEND_URL` = `https://jouw-backend-url.com`
- (Zie Stap 5 voor backend URL)

## Stap 5: Backend Deployen

### Optie A: Railway (Aanbevolen)
1. Ga naar: https://railway.app
2. Login met GitHub
3. New Project → Deploy from GitHub repo
4. Selecteer `webrtc-kids`
5. Configureer:
   - Root Directory: `server`
   - Start Command: `npm start`
6. Kopieer de URL en gebruik als `VITE_BACKEND_URL`

### Optie B: Render
1. Ga naar: https://render.com
2. Login met GitHub
3. New → Web Service
4. Connect `webrtc-kids` repo
5. Root Directory: `server`
6. Build: `npm install && npm run build`
7. Start: `npm start`

## Stap 6: Update Vercel Environment Variable

1. Ga naar Vercel Dashboard
2. Project → Settings → Environment Variables
3. Update `VITE_BACKEND_URL` met je backend URL
4. Redeploy: Deployments → ... → Redeploy

## Klaar! 🎉

Je app is nu live op: `https://jouw-project.vercel.app`

Deze URL werkt overal ter wereld!



