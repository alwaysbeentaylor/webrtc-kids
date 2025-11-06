# Troubleshooting - Veelvoorkomende Foutmeldingen

## Server Foutmeldingen

### "Firebase Admin initialization warning" of "Invalid or expired token"

**Oorzaak:** Firebase Admin SDK kan niet verbinden met Firebase project.

**Oplossing:**
1. Zorg dat `server/.env` het juiste `FIREBASE_PROJECT_ID` bevat
2. Of gebruik een Firebase Service Account JSON bestand:
   - Ga naar Firebase Console > Project Settings > Service Accounts
   - Klik "Generate new private key"
   - Sla het bestand op als `server/service-account.json`
   - Voeg toe aan `server/.env`: `FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json`

### "Authentication failed" bij socket connectie

**Oorzaak:** Client stuurt geen geldige Firebase ID token mee.

**Oplossing:**
1. Check dat je ingelogd bent in de client app
2. Check dat je email geverifieerd is
3. Check browser console voor errors

### "Cannot find module" errors

**Oorzaak:** Dependencies niet geïnstalleerd.

**Oplossing:**
```bash
cd server
npm install
```

## Client Foutmeldingen

### "Firebase: Error (auth/invalid-api-key)"

**Oorzaak:** Firebase configuratie niet correct in `.env` bestand.

**Oplossing:**
1. Check `client/.env` bestand bestaat
2. Vul alle Firebase configuratie velden in
3. Zorg dat er geen spaties zijn rond de `=` tekens
4. Herstart de dev server na het aanpassen van `.env`

### "Firebase: Error (auth/email-already-in-use)"

**Oorzaak:** Email adres is al geregistreerd.

**Oplossing:**
- Gebruik een ander email adres, of
- Log in met het bestaande account

### "Firebase: Error (auth/weak-password)"

**Oorzaak:** Wachtwoord is te kort.

**Oplossing:**
- Gebruik minimaal 6 karakters

### Socket connectie werkt niet

**Oorzaak:** Server draait niet of verkeerde URL.

**Oplossing:**
1. Check dat server draait op poort 4000
2. Check `SERVER_URL` in client code (moet `http://localhost:4000` zijn)
3. Check browser console voor CORS errors

### "Module not found" errors

**Oorzaak:** Dependencies niet geïnstalleerd.

**Oplossing:**
```bash
cd client
npm install
```

## Algemene Problemen

### Poort al in gebruik

**Foutmelding:** `EADDRINUSE: address already in use`

**Oplossing:**
```bash
# Windows: zoek proces op poort 4000
netstat -ano | findstr :4000
# Kill het proces (vervang PID met het nummer)
taskkill /PID <PID> /F

# Of wijzig poort in server/.env
PORT=4001
```

### TypeScript compile errors

**Oplossing:**
```bash
cd server
npm run build
# Check output voor specifieke errors
```

### Browser console errors

**Meest voorkomend:**
- CORS errors → Check `CLIENT_ORIGIN` in `server/.env` komt overeen met je client URL
- Network errors → Check dat server draait
- Firebase errors → Check Firebase configuratie

## Debug Tips

1. **Check server logs:** Kijk naar terminal waar server draait
2. **Check browser console:** F12 > Console tab
3. **Check Network tab:** F12 > Network tab om HTTP requests te zien
4. **Test Firebase handmatig:** 
   ```javascript
   // In browser console na inloggen:
   firebase.auth().currentUser.getIdToken().then(console.log)
   ```

## Nog steeds problemen?

1. Check dat alle dependencies geïnstalleerd zijn (`npm install` in beide folders)
2. Check dat `.env` bestanden correct zijn ingevuld
3. Check dat Firebase project correct is geconfigureerd
4. Herstart beide servers (server + client)
5. Clear browser cache en hard refresh (Ctrl+Shift+R)

