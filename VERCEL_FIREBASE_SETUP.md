# Firebase Environment Variables in Vercel

Als je de foutmelding "Er is een fout opgetreden" krijgt bij het inloggen, betekent dit waarschijnlijk dat Firebase niet is geconfigureerd in Vercel.

## Stap 1: Firebase Configuratie Ophalen

1. Ga naar [Firebase Console](https://console.firebase.google.com/)
2. Selecteer je project
3. Klik op het tandwiel ⚙️ naast "Project Overview"
4. Klik op "Project settings"
5. Scroll naar beneden naar "Your apps"
6. Klik op het web icoon `</>` (of maak een nieuwe web app aan)
7. Kopieer de Firebase configuratie waarden

Je ziet iets zoals:
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

## Stap 2: Environment Variables Toevoegen in Vercel

1. Ga naar je [Vercel Dashboard](https://vercel.com/dashboard)
2. Selecteer je project
3. Ga naar **Settings** → **Environment Variables**
4. Voeg de volgende variabelen toe (één voor één):

### Variabele 1:
- **Key**: `VITE_FIREBASE_API_KEY`
- **Value**: De `apiKey` waarde uit Firebase (bijv. `AIzaSy...`)
- **Environment**: Vink alle drie aan (Production, Preview, Development)

### Variabele 2:
- **Key**: `VITE_FIREBASE_AUTH_DOMAIN`
- **Value**: De `authDomain` waarde (bijv. `jouw-project.firebaseapp.com`)
- **Environment**: Vink alle drie aan

### Variabele 3:
- **Key**: `VITE_FIREBASE_PROJECT_ID`
- **Value**: De `projectId` waarde (bijv. `jouw-project-id`)
- **Environment**: Vink alle drie aan

### Variabele 4:
- **Key**: `VITE_FIREBASE_STORAGE_BUCKET`
- **Value**: De `storageBucket` waarde (bijv. `jouw-project.appspot.com`)
- **Environment**: Vink alle drie aan

### Variabele 5:
- **Key**: `VITE_FIREBASE_MESSAGING_SENDER_ID`
- **Value**: De `messagingSenderId` waarde (bijv. `123456789`)
- **Environment**: Vink alle drie aan

### Variabele 6:
- **Key**: `VITE_FIREBASE_APP_ID`
- **Value**: De `appId` waarde (bijv. `1:123456789:web:abc123`)
- **Environment**: Vink alle drie aan

## Stap 3: Redeploy

Na het toevoegen van alle variabelen:

1. Ga naar het tabblad **Deployments**
2. Klik op de drie puntjes (...) naast je laatste deployment
3. Klik op **Redeploy**
4. Wacht tot de deployment klaar is

## Stap 4: Testen

1. Open je Vercel URL
2. Probeer in te loggen
3. De foutmelding zou nu weg moeten zijn

## Belangrijk:

- **Alle variabelen moeten beginnen met `VITE_`** - dit is nodig zodat Vite ze beschikbaar maakt in de frontend code
- **Zorg dat je de juiste waarden kopieert** - geen extra quotes of spaties
- **Redeploy na het toevoegen** - environment variables worden alleen geladen tijdens de build

## Troubleshooting:

Als het nog steeds niet werkt:
1. Controleer of alle 6 variabelen zijn toegevoegd
2. Controleer of de waarden correct zijn (geen typos)
3. Controleer of je hebt gere-deployed na het toevoegen
4. Open de browser console (F12) en kijk naar eventuele Firebase errors

