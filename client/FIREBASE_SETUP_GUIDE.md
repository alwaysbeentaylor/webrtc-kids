# Firebase Setup - Stap voor Stap

## Stap 1: Maak een Firebase Project aan

1. Ga naar: https://console.firebase.google.com/
2. Klik op **"Add project"** (of "Project toevoegen")
3. Geef je project een naam (bijvoorbeeld: "kid-safe-video")
4. Klik **"Continue"**
5. **Schakel Google Analytics uit** (optioneel, voor nu niet nodig)
6. Klik **"Create project"**
7. Wacht tot het project klaar is, klik **"Continue"**

## Stap 2: Voeg een Web App toe

1. In je Firebase project dashboard, klik op het **web icoon** (</>) naast "Add an app"
2. Geef je app een naam (bijvoorbeeld: "kid-safe-web")
3. **Schakel Firebase Hosting UIT** (niet nodig voor nu)
4. Klik **"Register app"**
5. **KOPIEER DE CONFIGURATIE CODE** die Firebase laat zien

Je ziet iets als dit:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "jouw-project.firebaseapp.com",
  projectId: "jouw-project-id",
  storageBucket: "jouw-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

## Stap 3: Vul de .env file in

1. Open: `C:\Users\King\webrtc-kids\client\.env`
2. Vervang de placeholder waarden met jouw Firebase configuratie:

```
VITE_FIREBASE_API_KEY=AIzaSy... (van apiKey)
VITE_FIREBASE_AUTH_DOMAIN=jouw-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=jouw-project-id
VITE_FIREBASE_STORAGE_BUCKET=jouw-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

**LET OP:** 
- Geen aanhalingstekens rond de waarden
- Geen spaties rond de = tekens
- Kopieer exact zoals het in Firebase staat

## Stap 4: Enable Email/Password Authentication

1. In Firebase Console, klik op **"Authentication"** in het linker menu
2. Klik op **"Get started"** (als je het voor het eerst opent)
3. Klik op **"Sign-in method"** tab
4. Klik op **"Email/Password"**
5. **Schakel "Enable" in** (eerste toggle)
6. Laat "Email link (passwordless sign-in)" UIT staan
7. Klik **"Save"**

## Stap 5: Herstart de Client Server

1. Stop de client server (Ctrl+C in de terminal)
2. Start hem opnieuw:
   ```bash
   cd C:\Users\King\webrtc-kids\client
   npm run dev
   ```

## Stap 6: Test het!

1. Vernieuw je browser (Ctrl + Shift + R)
2. Klik op "Registreer hier"
3. Vul een email en wachtwoord in (minimaal 6 karakters)
4. Klik "Account aanmaken"
5. Check je email inbox voor verificatie link
6. Klik op de verificatie link
7. Ververs de pagina
8. Log in met je email en wachtwoord

## Problemen?

**"Firebase: Error (auth/invalid-api-key)"**
- Check dat je .env file correct is ingevuld
- Check dat er geen spaties zijn rond = tekens
- Herstart de dev server na het aanpassen van .env

**"Email verificatie werkt niet"**
- Check je spam folder
- Klik op "Verstuur verificatie email opnieuw" in de app

**"Cannot connect to Firebase"**
- Check je internet verbinding
- Check dat je Firebase project bestaat en actief is

## Snelle Test (Zonder Firebase)

Als je snel de rest van de app wilt zien zonder Firebase setup, kan ik een demo mode maken die automatisch "inlogt". Laat me weten als je dat wilt!




