# Firebase Project Mismatch Fix

## Probleem
Sommige sockets authenticeren wel, andere krijgen "Token verification failed: Error: Invalid or expired token".

Dit betekent dat:
- ✅ Firebase Admin SDK IS geïnitialiseerd (anders zouden alle tokens falen)
- ❌ Er is een mismatch tussen het Firebase project op de client en server

## Oplossing

### Stap 1: Check Client Firebase Project ID

1. Ga naar Vercel → je project → **Settings** → **Environment Variables**
2. Check `VITE_FIREBASE_PROJECT_ID`
3. Dit moet zijn: `xoma-7c1d7`

### Stap 2: Check Server Firebase Project ID

1. Ga naar Railway → je service → **Variables**
2. Check `FIREBASE_SERVICE_ACCOUNT`
3. Open de JSON en check `project_id`
4. Dit moet ook zijn: `xoma-7c1d7`

### Stap 3: Als ze niet overeenkomen

**Probleem:** Client gebruikt project A, server gebruikt project B

**Oplossing:**
- Zorg dat beide hetzelfde project gebruiken (`xoma-7c1d7`)
- Of update beide naar hetzelfde project

## Check Railway Logs

Na de nieuwe deploy, check Railway logs voor:
- `🔍 Firebase Admin initialization check:` - toont welke variabelen aanwezig zijn
- `✅ Firebase Admin initialized with FIREBASE_SERVICE_ACCOUNT`
- `✅ Firebase project: xoma-7c1d7` (moet `xoma-7c1d7` zijn!)
- `🔍 Verifying token with Firebase project:` - moet `xoma-7c1d7` zijn

## Check Vercel Environment Variables

Zorg dat deze zijn ingesteld:
```
VITE_FIREBASE_PROJECT_ID=xoma-7c1d7
VITE_FIREBASE_API_KEY=... (jouw Firebase API key)
```

## Belangrijk

**Client en Server MOETEN hetzelfde Firebase project gebruiken!**

- Client project ID: `VITE_FIREBASE_PROJECT_ID` in Vercel
- Server project ID: `project_id` in `FIREBASE_SERVICE_ACCOUNT` in Railway

Als deze niet overeenkomen, zullen tokens niet werken!

