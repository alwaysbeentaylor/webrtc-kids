# Firebase Setup Instructies

## Stap 1: Maak een Firebase project aan

1. Ga naar https://console.firebase.google.com/
2. Klik op "Add project" of selecteer een bestaand project
3. Volg de wizard om je project aan te maken

## Stap 2: Voeg een Web app toe

1. In je Firebase project, klik op het web icoon (</>)
2. Registreer je app met een naam (bijvoorbeeld "kid-safe-video")
3. Firebase geeft je configuratie code - kopieer die

## Stap 3: Configureer environment variabelen

1. Kopieer `.env.example` naar `.env` in de client folder
2. Vul de Firebase configuratie in vanuit stap 2

Je `.env` bestand zou er zo uit moeten zien:
```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

## Stap 4: Enable Authentication

1. In Firebase Console, ga naar "Authentication" > "Get started"
2. Klik op "Sign-in method"
3. Enable "Email/Password"
4. Klik op "Email/Password" en schakel "Enable" in

## Stap 5: Start de app

```bash
cd client
npm run dev
```

Je kunt nu een account aanmaken en inloggen!

