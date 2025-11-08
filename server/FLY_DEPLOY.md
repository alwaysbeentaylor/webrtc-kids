# Fly.io Deployment Guide

This guide explains how to deploy the WebRTC signaling server to Fly.io.

## Prerequisites

1. Install Fly CLI: https://fly.io/docs/getting-started/installing-flyctl/
2. Sign up for Fly.io: https://fly.io/app/sign-up
3. Login: `fly auth login`

## Initial Setup

1. Navigate to the server directory:
   ```bash
   cd server
   ```

2. Launch the app (this will create the app and prompt for configuration):
   ```bash
   fly launch
   ```
   
   When prompted:
   - **App name**: Use `webrtc-signaling-stg` (or your preferred name)
   - **Region**: Choose `ams` (Amsterdam) or nearest to your users
   - **Postgres/Redis**: No (we don't need these)
   - **Deploy now**: No (we'll set secrets first)

## Configure Environment Variables

Set the required secrets on Fly.io:

```bash
# Firebase Admin Service Account (same as Railway)
fly secrets set FIREBASE_SERVICE_ACCOUNT='<your-firebase-service-account-json>'

# Client origin (your Vercel URL)
fly secrets set CLIENT_ORIGIN='https://your-app.vercel.app'

# Optional: If you have multiple client origins, you can set multiple values
# The server will accept any HTTPS origin in production
```

To view current secrets:
```bash
fly secrets list
```

## Deploy

Deploy the app:
```bash
fly deploy
```

## Verify Deployment

1. Check logs:
   ```bash
   fly logs
   ```

2. Test health endpoint:
   ```bash
   curl https://webrtc-signaling-stg.fly.dev/health
   ```
   
   Should return: `{"ok":true,"service":"signaling-server"}`

3. Get your app URL:
   ```bash
   fly status
   ```
   
   Look for the hostname (e.g., `webrtc-signaling-stg.fly.dev`)

## Update Client Configuration

1. In Vercel, set the environment variable:
   ```
   VITE_BACKEND_URL=https://webrtc-signaling-stg.fly.dev
   ```

2. Redeploy the client on Vercel

3. Test the connection:
   - Open the app in browser
   - Check browser console for connection logs
   - Verify Socket.IO connects successfully
   - Test parent and child login

## Monitoring

- View logs: `fly logs`
- View app status: `fly status`
- SSH into VM: `fly ssh console`
- View metrics: `fly metrics`

## Scaling

The default configuration uses:
- 1 shared CPU
- 512MB RAM
- Auto-start/stop enabled (starts on first request)

To scale up:
```bash
# Scale to 2 VMs
fly scale count 2

# Increase memory
fly scale vm shared-cpu-1x --memory 1024

# Disable auto-stop (always running)
fly scale count 1 --vm-size shared-cpu-1x
```

## Troubleshooting

### Build fails
- Check Dockerfile syntax
- Verify Node.js version (should be 20)
- Check build logs: `fly logs --build`

### Connection issues
- Verify `CLIENT_ORIGIN` is set correctly
- Check CORS logs in `fly logs`
- Verify the app is running: `fly status`

### Authentication fails
- Check Firebase credentials: `fly secrets list`
- Verify `FIREBASE_SERVICE_ACCOUNT` JSON is valid
- Check server logs for auth errors: `fly logs | grep auth`

### Health check fails
- Verify `/health` endpoint returns `{ok: true}`
- Check if server is listening on PORT 8080
- Review health check logs: `fly logs | grep health`

## Rollback

If something goes wrong:
```bash
# List releases
fly releases

# Rollback to previous release
fly releases rollback <release-id>
```

## Production Checklist

Before going to production:
- [ ] Update app name to production name (e.g., `webrtc-signaling-prod`)
- [ ] Set `NODE_ENV=production` (already in fly.toml)
- [ ] Configure custom domain (optional)
- [ ] Set up monitoring/alerts
- [ ] Test parent and child authentication
- [ ] Test WebRTC calls end-to-end
- [ ] Verify CORS allows your production client URL
- [ ] Keep Railway running until Fly.io is fully verified

## Optional: Twilio TURN Servers

The client already includes free Metered.ca TURN servers. For production, you may want to use Twilio Network Traversal Service (NSTS) for better reliability:

1. Sign up for Twilio: https://www.twilio.com/
2. Enable Network Traversal Service in Twilio Console
3. Get your ICE servers URL and credentials
4. Update `client/src/services/WebRTCService.ts`:

```typescript
private readonly rtcConfig: RTCConfiguration = {
  iceServers: [
    // ... existing STUN servers ...
    // Twilio TURN servers (replace with your credentials)
    {
      urls: 'turn:global.turn.twilio.com:3478?transport=udp',
      username: 'your-twilio-username',
      credential: 'your-twilio-credential'
    },
    {
      urls: 'turn:global.turn.twilio.com:3478?transport=tcp',
      username: 'your-twilio-username',
      credential: 'your-twilio-credential'
    },
    {
      urls: 'turn:global.turn.twilio.com:443?transport=tcp',
      username: 'your-twilio-username',
      credential: 'your-twilio-credential'
    }
  ],
  // ... rest of config ...
};
```

Note: Twilio TURN servers use port 443/TCP which works well with restrictive firewalls.

## Optional: Custom Domain

To use a custom domain:
```bash
fly certs add your-domain.com
```

Then update DNS records as instructed by Fly.io.

