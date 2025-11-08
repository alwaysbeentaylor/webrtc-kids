# Railway Build Fixes - Documentatie

## Probleem
Railway deployment faalde met verschillende errors:
1. `tsc: Permission denied` - TypeScript compiler kon niet worden uitgevoerd
2. Node.js versie mismatch - Firebase vereist Node.js >=20, maar Railway gebruikte v18
3. DevDependencies niet geïnstalleerd - TypeScript stond in devDependencies maar werd niet geïnstalleerd

## Oplossingen Geïmplementeerd

### 1. Node.js Versie Specificeren

**Probleem:** Railway gebruikte standaard Node.js v18, maar Firebase vereist Node.js >=20.

**Oplossing:** 
- `.nvmrc` bestand aangemaakt in `server/` folder met inhoud: `20`
- Railway detecteert automatisch `.nvmrc` en gebruikt de juiste Node.js versie
- Als backup: voeg `NODE_VERSION=20` toe aan Railway environment variables

**Bestand:** `server/.nvmrc`
```
20
```

### 2. DevDependencies Installeren

**Probleem:** Railway installeert standaard alleen production dependencies, maar TypeScript staat in devDependencies.

**Oplossing:**
- Voeg `NIXPACKS_NO_INSTALL_DEV=false` toe aan Railway environment variables
- Dit zorgt ervoor dat Railway ook devDependencies installeert tijdens de build

**Railway Environment Variable:**
```
NIXPACKS_NO_INSTALL_DEV=false
```

### 3. TypeScript Compiler Uitvoeren

**Probleem:** `tsc` binary had geen execute permissions in Docker container.

**Oplossing:**
- Gebruik `node` om TypeScript compiler direct uit te voeren
- In plaats van `tsc` of `npx tsc`, gebruik: `node node_modules/typescript/bin/tsc`

**Bestand:** `server/package.json`
```json
{
  "scripts": {
    "build": "node node_modules/typescript/bin/tsc",
    "start": "node dist/server.js"
  }
}
```

### 4. Railway Configuration

**Bestand:** `server/railway.json`
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install --include=dev && npm run build"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

## Complete Railway Environment Variables

Zorg dat deze variabelen zijn ingesteld in Railway:

```
PORT=4000
NODE_ENV=production
CLIENT_ORIGIN=https://jouw-frontend-url.vercel.app
NIXPACKS_NO_INSTALL_DEV=false
NODE_VERSION=20
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
```

## Best Practices voor Toekomstige Deployments

### 1. TypeScript Projects
- **ALTIJD** gebruik `node node_modules/typescript/bin/tsc` in plaats van `tsc` of `npx tsc` voor Railway builds
- Dit voorkomt permission denied errors in Docker containers

### 2. Node.js Versie
- **ALTIJD** maak een `.nvmrc` bestand aan in de root van je project folder
- Specificeer de minimale Node.js versie die je nodig hebt
- Voeg `NODE_VERSION` toe aan environment variables als backup

### 3. DevDependencies
- Als je build tools nodig hebt (zoals TypeScript), voeg `NIXPACKS_NO_INSTALL_DEV=false` toe
- Of verplaats build tools naar `dependencies` in plaats van `devDependencies` (minder ideaal)

### 4. Build Commands
- Gebruik `npm install --include=dev` in build commands om devDependencies te installeren
- Test altijd lokaal met `npm install --include=dev && npm run build` voordat je deployt

## Troubleshooting

### Build faalt met "Permission denied"
- **Oplossing:** Gebruik `node node_modules/typescript/bin/tsc` in plaats van `tsc`
- Check of `NIXPACKS_NO_INSTALL_DEV=false` is ingesteld

### Build faalt met "Unsupported engine"
- **Oplossing:** Check `.nvmrc` bestand en voeg `NODE_VERSION` environment variable toe
- Zorg dat Node.js versie voldoet aan requirements van alle packages

### Build faalt met "tsc not found"
- **Oplossing:** Zorg dat `NIXPACKS_NO_INSTALL_DEV=false` is ingesteld
- Check of TypeScript in `devDependencies` staat
- Of verplaats TypeScript naar `dependencies` als laatste redmiddel

## Checklist voor Nieuwe Deployments

- [ ] `.nvmrc` bestand aangemaakt met juiste Node.js versie
- [ ] `NODE_VERSION` environment variable ingesteld in Railway
- [ ] `NIXPACKS_NO_INSTALL_DEV=false` environment variable ingesteld
- [ ] Build script gebruikt `node node_modules/typescript/bin/tsc`
- [ ] `railway.json` heeft correcte build command
- [ ] Alle environment variables zijn ingesteld
- [ ] Build getest lokaal met `npm install --include=dev && npm run build`

## Belangrijke Bestanden

1. **`server/.nvmrc`** - Specificeert Node.js versie
2. **`server/package.json`** - Build script gebruikt `node node_modules/typescript/bin/tsc`
3. **`server/railway.json`** - Railway build configuration
4. **Railway Environment Variables** - `NIXPACKS_NO_INSTALL_DEV=false` en `NODE_VERSION=20`

## Notities

- Deze fixes zijn specifiek voor Railway.app met Nixpacks builder
- Andere hosting providers kunnen andere configuratie nodig hebben
- TypeScript als devDependency is normaal, maar Railway vereist extra configuratie
- Permission denied errors komen vaak voor in Docker containers - gebruik altijd `node` om executables uit te voeren

