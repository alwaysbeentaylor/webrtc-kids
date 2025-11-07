# Firestore Setup - CRITIEEL!

## Stap 1: Enable Firestore Database

1. Ga naar: https://console.firebase.google.com/project/xoma-7c1d7/firestore
2. Klik op **"Create database"**
3. Kies **"Start in test mode"** (voor nu - we deployen rules later)
4. Kies een locatie (bijvoorbeeld: `europe-west1`)
5. Klik **"Enable"**

## Stap 2: Deploy Firestore Rules

1. Installeer Firebase CLI (als je die nog niet hebt):
   ```bash
   npm install -g firebase-tools
   ```

2. Login bij Firebase:
   ```bash
   firebase login
   ```

3. Initialiseer Firebase in je project:
   ```bash
   cd C:\Users\King\webrtc-kids
   firebase init firestore
   ```
   - Kies je project: `xoma-7c1d7`
   - Gebruik `firestore.rules` als rules file
   - Gebruik `firestore.indexes.json` voor indexes (of maak leeg bestand)

4. Deploy de rules:
   ```bash
   firebase deploy --only firestore:rules
   ```

## Stap 3: Test opnieuw

Na het deployen van de rules zou de app moeten werken!

## Alternatief: Test Mode (tijdelijk)

Als je snel wilt testen zonder rules te deployen:
1. Laat Firestore in "test mode" staan
2. Dit geeft tijdelijk volledige toegang (niet voor productie!)

**WAARSCHUWING:** Test mode is onveilig - gebruik alleen voor development!





