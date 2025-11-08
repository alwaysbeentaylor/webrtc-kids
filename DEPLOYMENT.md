# Instructies om de app buiten je netwerk te gebruiken

## Optie 1: Ngrok (Snelste voor development)

1. Download ngrok: https://ngrok.com/download
2. Maak een gratis account aan op ngrok.com
3. Pak ngrok uit en voeg toe aan PATH, of gebruik vanaf de download locatie

4. Start je backend server:
   ```bash
   cd c:\Users\King\webrtc-kids\server
   npm run dev
   ```

5. Start je frontend server:
   ```bash
   cd c:\Users\King\webrtc-kids\client
   npm run dev
   ```

6. Start ngrok voor frontend (in een nieuwe terminal):
   ```bash
   ngrok http 5173
   ```

7. Start ngrok voor backend (in nog een nieuwe terminal):
   ```bash
   ngrok http 4000
   ```

8. Je krijgt twee URLs:
   - Frontend URL: https://xxxx-xxxx-xxxx.ngrok-free.app (gebruik deze!)
   - Backend URL: https://yyyy-yyyy-yyyy.ngrok-free.app

9. Pas SERVER_URL aan in App.tsx om de backend ngrok URL te gebruiken

## Optie 2: Deployen naar Vercel/Netlify (Permanent)

De app deployen naar een gratis hosting service zoals Vercel of Netlify.

## Optie 3: Cloudflare Tunnel (Gratis alternatief)

Gebruik Cloudflare Tunnel voor een gratis, permanente tunnel.



