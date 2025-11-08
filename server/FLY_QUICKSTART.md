# Fly.io Quick Start Commands

## Stap 1: Fly CLI Installeren (EENMALIG)

**Windows (PowerShell):**
```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

**Of download van:** https://fly.io/docs/getting-started/installing-flyctl/

## Stap 2: Inloggen op Fly.io (EENMALIG)

```powershell
fly auth login
```

Dit opent je browser om in te loggen.

## Stap 3: App Initialiseren (EENMALIG)

```powershell
cd server
fly launch --no-deploy
```

**Wanneer gevraagd:**
- App name: `webrtc-signaling-stg` (of druk Enter voor voorgestelde naam)
- Region: `ams` (Amsterdam) of kies dichtstbijzijnde
- Postgres: **N** (nee)
- Redis: **N** (nee)
- Deploy now: **N** (nee, we zetten eerst secrets)

## Stap 4: Secrets Instellen

**Vervang de waarden tussen `< >` met je echte waarden:**

```powershell
# Firebase Service Account (haal uit Railway of Firebase Console)
fly secrets set FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'

# Je Vercel URL (bijv. https://webrtc-kids-waa3.vercel.app)
fly secrets set CLIENT_ORIGIN='https://jouw-app.vercel.app'
```

**Tip:** Je kunt de Firebase JSON ook uit een bestand lezen:
```powershell
fly secrets set FIREBASE_SERVICE_ACCOUNT="$(Get-Content -Path path/to/firebase-key.json -Raw)"
```

## Stap 5: Deployen

```powershell
fly deploy
```

Dit kan 2-5 minuten duren.

## Stap 6: Verificeren

```powershell
# Check status
fly status

# Check logs
fly logs

# Test health endpoint
curl https://webrtc-signaling-stg.fly.dev/health
```

**Verwacht resultaat:** `{"ok":true,"service":"signaling-server"}`

## Stap 7: Client Bijwerken (Vercel Dashboard)

1. Ga naar Vercel Dashboard → Je project → Settings → Environment Variables
2. Voeg toe of update:
   - **Key:** `VITE_BACKEND_URL`
   - **Value:** `https://webrtc-signaling-stg.fly.dev` (of je app naam)
   - **Environment:** Production, Preview, Development (alle drie)
3. **Redeploy** je client app

## Handige Commando's

```powershell
# Logs bekijken (real-time)
fly logs

# App status
fly status

# Secrets bekijken
fly secrets list

# Secrets verwijderen (als nodig)
fly secrets unset SECRET_NAME

# SSH naar de VM
fly ssh console

# Metrics bekijken
fly metrics

# Rollback naar vorige versie
fly releases
fly releases rollback <release-id>
```

## Troubleshooting

**Build faalt:**
```powershell
fly logs --build
```

**App start niet:**
```powershell
fly logs
fly status
```

**Verbinding werkt niet:**
- Check of `CLIENT_ORIGIN` correct is ingesteld
- Check logs voor CORS errors: `fly logs | Select-String -Pattern "CORS"`
- Test health endpoint: `curl https://jouw-app.fly.dev/health`

