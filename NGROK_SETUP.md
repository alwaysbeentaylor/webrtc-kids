# Ngrok Setup Script

## Stap 1: Download ngrok
Ga naar: https://ngrok.com/download
Download voor Windows en pak uit.

## Stap 2: Maak account aan
Ga naar: https://dashboard.ngrok.com/signup
Maak een gratis account aan en kopieer je authtoken.

## Stap 3: Configureer ngrok
```bash
ngrok config add-authtoken JE_AUTH_TOKEN_HIER
```

## Stap 4: Start servers

### Terminal 1 - Backend:
```bash
cd c:\Users\King\webrtc-kids\server
npm run dev
```

### Terminal 2 - Frontend:
```bash
cd c:\Users\King\webrtc-kids\client
npm run dev
```

### Terminal 3 - Ngrok Frontend:
```bash
ngrok http 5173
```

### Terminal 4 - Ngrok Backend:
```bash
ngrok http 4000
```

## Stap 5: Gebruik de URLs
- Frontend URL: Gebruik de HTTPS URL van ngrok (bijv. https://abc123.ngrok-free.app)
- Backend URL: Gebruik de HTTPS URL van ngrok backend (bijv. https://xyz789.ngrok-free.app)

## Stap 6: Update SERVER_URL
Pas de SERVER_URL in App.tsx aan naar de backend ngrok URL.

