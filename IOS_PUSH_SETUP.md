# iOS Push Notificaties Setup

Voor iPhone/iOS zijn er specifieke stappen nodig om push notificaties te ontvangen.

## Belangrijke Vereisten

1. **iOS 16.4 of hoger** - Push notificaties werken alleen op iOS 16.4+
2. **PWA moet geïnstalleerd zijn** - De app MOET als PWA op het home screen staan (niet alleen in Safari)
3. **Notificatie toestemming** - Moet worden gegeven vanuit de geïnstalleerde PWA

## Stappen om Push Notificaties te Activeren op iPhone

### Stap 1: Installeer de App als PWA

1. **Open Safari** op je iPhone (NIET Chrome of andere browsers)
2. **Ga naar de app URL** (bijv. https://webrtc-kids-waa3.vercel.app)
3. **Tik op de deelknop** (vierkant met pijl omhoog) onderaan het scherm
4. **Scroll naar beneden** en tik op **"Zet op beginscherm"** of **"Add to Home Screen"**
5. **Geef de app een naam** (bijv. "Kids App")
6. **Tik op "Voeg toe"** of **"Add"**

### Stap 2: Open de App vanaf het Home Screen

1. **Sluit Safari volledig**
2. **Open de app** vanaf het home screen (niet vanuit Safari)
3. **Log in** als gebruiker (parent of child)
4. **Geef notificatie toestemming** wanneer gevraagd
   - Als je geen prompt ziet, ga naar: Instellingen > [App naam] > Notificaties > Zet aan

### Stap 3: Test Push Notificaties

1. **Sluit de app volledig** (swipe omhoog vanuit de app switcher)
2. **Laat iemand je bellen** vanaf een ander apparaat
3. **Je zou een push notificatie moeten ontvangen**

## Troubleshooting voor iOS

### Geen notificaties ontvangen?

1. **Check iOS versie**: Ga naar Instellingen > Algemeen > Info > Zorg dat je iOS 16.4+ hebt
2. **Check of app geïnstalleerd is**: De app moet op het home screen staan, niet alleen in Safari
3. **Check notificatie toestemming**: 
   - Instellingen > [App naam] > Notificaties
   - Zet "Toestaan" aan
4. **Open app vanuit home screen**: Niet vanuit Safari browser
5. **Check service worker**: 
   - Open app vanuit home screen
   - Open Safari DevTools (via Mac) of gebruik remote debugging
   - Check of service worker actief is

### App werkt niet als PWA?

- Zorg dat je Safari gebruikt (niet Chrome of andere browsers)
- Check dat manifest.json correct is geconfigureerd
- Probeer de app opnieuw te installeren

### Notificatie prompt verschijnt niet?

- Open de app vanuit het home screen (niet Safari)
- Log opnieuw in
- Check browser console voor errors
- Probeer notificatie toestemming handmatig te geven via Instellingen

## Belangrijke Notities

⚠️ **Push notificaties werken ALLEEN wanneer:**
- De app is geïnstalleerd als PWA op het home screen
- De app wordt geopend vanuit het home screen (niet vanuit Safari)
- iOS 16.4+ is geïnstalleerd
- Notificatie toestemming is gegeven

❌ **Push notificaties werken NIET wanneer:**
- De app wordt geopend in Safari browser (zonder PWA installatie)
- iOS versie is lager dan 16.4
- Notificatie toestemming is niet gegeven

## Test Checklist

- [ ] iOS 16.4+ geïnstalleerd
- [ ] App geïnstalleerd als PWA op home screen
- [ ] App geopend vanuit home screen (niet Safari)
- [ ] Ingelogd als gebruiker
- [ ] Notificatie toestemming gegeven
- [ ] Service worker actief (check in DevTools)
- [ ] FCM token verkregen (check browser console)
- [ ] App volledig gesloten
- [ ] Test call verstuurd vanaf ander apparaat
- [ ] Push notificatie ontvangen

## Extra Tips

- **Voor beste resultaten**: Gebruik Safari (niet Chrome) op iOS
- **Test eerst**: Test eerst of de app correct werkt wanneer open, voordat je test met gesloten app
- **Check logs**: Check server logs op Fly.io om te zien of FCM push wordt verstuurd
- **Browser console**: Open browser console (via Mac Safari DevTools) om FCM errors te zien

