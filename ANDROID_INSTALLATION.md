# Android Installatie Guide - PWA

Je app kan geïnstalleerd worden als Progressive Web App (PWA) op Android. Dit betekent dat het werkt als een normale app op je telefoon.

## Methode 1: Installeren via Chrome (Aanbevolen)

### Stap 1: Open de app in Chrome
1. Open **Chrome** op je Android telefoon
2. Ga naar je Vercel URL (bijv. `https://jouw-app.vercel.app`)
3. Log in en gebruik de app normaal

### Stap 2: Installeer de app
1. Chrome toont automatisch een **"Toevoegen aan startscherm"** banner onderaan
2. Of klik op het **menu** (3 puntjes rechtsboven)
3. Klik op **"Toevoegen aan startscherm"** of **"Installeren"**
4. Bevestig door op **"Toevoegen"** of **"Installeren"** te klikken

### Stap 3: Open de app
- De app verschijnt nu als een normale app op je startscherm
- Je kunt het openen zoals elke andere app
- Het heeft een eigen app-icoon en naam

## Methode 2: Via Chrome Menu

Als je de banner niet ziet:

1. Open Chrome op je Android telefoon
2. Ga naar je Vercel URL
3. Klik op het **menu** (3 puntjes rechtsboven)
4. Scroll naar beneden en klik op **"Toevoegen aan startscherm"**
5. Bevestig de installatie

## Methode 3: Via Instellingen

1. Open Chrome → Menu → **Instellingen**
2. Ga naar **Apps** → **App installeren**
3. Zoek je app in de lijst
4. Klik op **"Installeren"**

## Belangrijk voor Android:

### Vereisten:
- ✅ **HTTPS**: Je app draait al op HTTPS (Vercel)
- ✅ **Manifest**: `manifest.json` is al aanwezig
- ✅ **Service Worker**: Vercel serveert de app correct

### Permissies:
Wanneer je de app voor het eerst gebruikt:
- **Microfoon**: Toestemming nodig voor audio calls
- **Camera**: Toestemming nodig voor video calls
- Klik op **"Toestaan"** wanneer gevraagd

### Troubleshooting:

**Probleem: "Toevoegen aan startscherm" optie niet zichtbaar**
- Zorg dat je Chrome gebruikt (niet Samsung Internet of andere browsers)
- Update Chrome naar de nieuwste versie
- Check of je app HTTPS gebruikt (Vercel doet dit automatisch)

**Probleem: App werkt niet goed na installatie**
- Open de app opnieuw
- Check of je internetverbinding goed is
- Clear cache: Chrome → Instellingen → Apps → Jouw app → Opslag wissen

**Probleem: Camera/microfoon werkt niet**
- Check app permissies: Instellingen → Apps → Jouw app → Machtigingen
- Zorg dat Microfoon en Camera zijn ingeschakeld
- Herstart de app

## App Icoon Aanpassen

Als je het app-icoon wilt aanpassen:

1. Voeg een `icon.png` toe aan `client/public/` (192x192 of 512x512 pixels)
2. Update `manifest.json`:
```json
{
  "icons": [
    {
      "src": "/icon.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

## Voordelen van PWA op Android:

- ✅ Werkt als een normale app
- ✅ Offline mogelijkheden (als je service worker toevoegt)
- ✅ Snel en lichtgewicht
- ✅ Geen app store nodig
- ✅ Automatische updates via Vercel

## Native Android App (Geavanceerd)

Als je een echte native Android app wilt (via Google Play Store), kun je:
- **Capacitor** gebruiken om je React app te converteren naar native
- **React Native** gebruiken (vereist herschrijven van de app)

Voor nu is PWA de beste en snelste oplossing!



