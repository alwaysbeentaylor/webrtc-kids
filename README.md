# Kid-Safe Video Call App

## Quick Start (Testen)

### Stap 1: Firebase Setup (EENMALIG)

1. Ga naar https://console.firebase.google.com/
2. Maak een nieuw project aan (bijvoorbeeld "kid-safe-video")
3. Klik op het web icoon (</>) om een web app toe te voegen
4. Kopieer de configuratie die Firebase geeft

### Stap 2: Firebase Environment Configuratie

1. Ga naar de `client` folder:
   ```bash
   cd client
   ```

2. Kopieer `.env.example` naar `.env`:
   ```bash
   copy .env.example .env
   ```

3. Open `.env` en vul je Firebase configuratie in:
   ```
   VITE_FIREBASE_API_KEY=je-api-key-hier
   VITE_FIREBASE_AUTH_DOMAIN=je-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=je-project-id
   VITE_FIREBASE_STORAGE_BUCKET=je-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abc123
   ```

4. Enable Email/Password Authentication:
   - In Firebase Console: Authentication > Get started
   - Sign-in method > Email/Password > Enable

### Stap 3: Server Configuratie

1. Ga naar de `server` folder:
   ```bash
   cd ..\server
   ```

2. Open `.env` en vul je Firebase Project ID in:
   ```
   FIREBASE_PROJECT_ID=je-project-id
   ```

### Stap 4: Dependencies Installeren

**Server:**
```bash
cd server
npm install
```

**Client:**
```bash
cd client
npm install
```

### Stap 5: App Starten

Open **TWEE** terminal vensters:

**Terminal 1 - Server:**
```bash
cd webrtc-kids\server
npm run dev
```
Je zou moeten zien: `Signaling server listening on http://localhost:4000`

**Terminal 2 - Client:**
```bash
cd webrtc-kids\client
npm run dev
```
Je zou moeten zien: `Local: http://localhost:5173`

### Stap 6: Testen

1. Open je browser naar: http://localhost:5173
2. Je ziet het login scherm
3. Klik op "Registreer hier" om een account aan te maken
4. Vul email en wachtwoord in (minimaal 6 karakters)
5. Controleer je email inbox voor verificatie link
6. Klik op de verificatie link
7. Ververs de pagina in je browser
8. Je zou nu ingelogd moeten zijn en "Welkom, [jouw email]!" moeten zien
9. Klik op "Test Socket (ping)" om de socket connectie te testen
10. Open browser console (F12) om logs te zien

## Wat je nu ziet:

- ✅ Login/Registratie scherm (mooi vormgegeven)
- ✅ Email verificatie prompt
- ✅ Welkomstscherm na inloggen
- ✅ Socket connectie test knop
- ✅ Uitlog knop

## Troubleshooting

**Firebase foutmeldingen:**
- Zorg dat je `.env` bestand correct is ingevuld
- Check dat Email/Password auth is enabled in Firebase Console

**Socket connectie werkt niet:**
- Check dat beide servers draaien (server op poort 4000, client op poort 5173)
- Check browser console voor errors
- Check server terminal voor errors

**Email verificatie werkt niet:**
- Check je spam folder
- Klik op "Verstuur verificatie email opnieuw" in de app

## Volgende Features (nog te bouwen):

- WebRTC video calls
- Bellenblaas bubbels home scherm
- Parent/Child UI verschil
- Contact whitelist
- Locatie delen
- Call history
- Familie kaart

