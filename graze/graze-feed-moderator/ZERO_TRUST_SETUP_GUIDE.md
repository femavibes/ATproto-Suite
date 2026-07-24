# Zero-Trust Authentication Setup Guide

## Overview

Feed-moderator now supports **zero-trust authentication mode** where your Bluesky credentials never leave your infrastructure. You run your own authentication proxy that provides session tokens to feed-moderator.

## Two Authentication Modes

### Traditional Mode (Default)
- Provide Bluesky app password during registration
- Password encrypted and stored on feed-moderator servers
- Simple, works immediately
- **For most users**

### Zero-Trust Mode (Optional)
- Register without providing Bluesky password
- Deploy your own authentication proxy
- Feed-moderator requests tokens from your proxy
- **You control when access is granted**
- **For technical users who want maximum security**

## Zero-Trust Setup

### Step 1: Register in Zero-Trust Mode

1. Go to feed-moderator registration page
2. Enter your Bluesky handle
3. Check **"Zero-Trust Mode (Advanced)"**
4. Create any password for your feed-moderator account (NOT your Bluesky password)
5. Complete registration

Your account is now in "pending" status - you need to configure your proxy.

### Step 2: Deploy Authentication Proxy

#### Using Docker (Recommended)

```bash
docker run -d \
  --name feedmod-auth-proxy \
  -p 3550:3550 \
  -e BLUESKY_HANDLE=yourhandle.bsky.social \
  -e BLUESKY_PASSWORD=your-app-password \
  -v feedmod-proxy-data:/app/data \
  --restart unless-stopped \
  feedmoderator/auth-proxy
```

#### Using Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'
services:
  auth-proxy:
    image: feedmoderator/auth-proxy
    container_name: feedmod-auth-proxy
    ports:
      - "3550:3550"
    environment:
      - BLUESKY_HANDLE=yourhandle.bsky.social
      - BLUESKY_PASSWORD=your-app-password
    volumes:
      - proxy-data:/app/data
    restart: unless-stopped

volumes:
  proxy-data:
```

Then run:
```bash
docker compose up -d
```

#### Manual Setup

```bash
cd user-decryption-service
npm install
export BLUESKY_HANDLE=yourhandle.bsky.social
export BLUESKY_PASSWORD=your-app-password
npm start
```

### Step 3: Get Your API Key

After starting the proxy, check the logs for your API key:

```bash
docker logs feedmod-auth-proxy
```

You'll see:
```
🔐 Zero-Trust Authentication Proxy running on port 3550
🌐 Your service URL: http://YOUR_IP:3550
🔑 Your API key: abc123def456...
👤 Bluesky handle: yourhandle.bsky.social
✅ Ready for zero-trust authentication!
```

Copy the API key.

### Step 4: Configure in Feed-Moderator

1. Log into feed-moderator
2. Go to **Settings → Credentials**
3. You'll see "Zero-Trust Authentication" section with status "Setup Required"
4. Enter:
   - **Proxy URL**: `http://YOUR_IP:3550` (or your domain)
   - **API Key**: The key from proxy logs
5. Click **"Configure Proxy"**
6. Status changes to "Active" ✅

Done! Feed-moderator now routes all operations through your proxy.

## How It Works

### Traditional Flow
```
User → Feed-Moderator → Decrypt Password → Graze/Bluesky APIs
```

### Zero-Trust Flow
```
User → Feed-Moderator → Your Proxy → Graze/Bluesky APIs
                    ↑
            (Never sees credentials)
```

When you remove a post:
1. Feed-moderator detects you're in zero-trust mode
2. Requests Graze session from your proxy
3. Your proxy authenticates with Graze using your credentials
4. Returns session cookie to feed-moderator
5. Feed-moderator uses cookie to remove post
6. Your proxy logs the operation

## Security Benefits

### Complete Control
- **Instant revocation**: Stop your proxy container = feed-moderator loses access
- **Audit trail**: Your proxy logs every operation with timestamp
- **No trust required**: Feed-moderator literally cannot access your account without your proxy

### What Feed-Moderator Sees
- ❌ Your Bluesky password: **Never**
- ✅ Temporary session tokens: **Only when your proxy provides them**
- ✅ Operation results: **Yes, to show you what happened**

### What Your Proxy Logs
```
🔓 DECRYPTION REQUEST [2024-01-15T10:30:45.123Z]
   User: yourhandle.bsky.social
   Reason: POST_MODERATION
   IP: 203.0.113.42
✅ Session provided for POST_MODERATION
```

## Proxy Management

### Check Proxy Status
```bash
docker logs feedmod-auth-proxy --tail 50
```

### Restart Proxy
```bash
docker restart feedmod-auth-proxy
```

### Stop Proxy (Revoke Access)
```bash
docker stop feedmod-auth-proxy
```

Feed-moderator will show "Proxy Offline" and operations will fail gracefully.

### Update Bluesky Password
```bash
docker stop feedmod-auth-proxy
docker rm feedmod-auth-proxy

# Run with new password
docker run -d \
  --name feedmod-auth-proxy \
  -p 3550:3550 \
  -e BLUESKY_HANDLE=yourhandle.bsky.social \
  -e BLUESKY_PASSWORD=new-app-password \
  -v feedmod-proxy-data:/app/data \
  --restart unless-stopped \
  feedmoderator/auth-proxy
```

## Troubleshooting

### "Cannot connect to proxy"
- Check proxy is running: `docker ps | grep feedmod-auth-proxy`
- Check firewall allows port 3550
- Verify URL is correct (include `http://`)

### "Invalid API key"
- Get fresh API key from logs: `docker logs feedmod-auth-proxy | grep "API key"`
- Re-enter in Settings

### "Proxy Offline" in Settings
- Proxy container stopped or crashed
- Check logs: `docker logs feedmod-auth-proxy`
- Restart: `docker restart feedmod-auth-proxy`

### Operations Failing
- Check proxy logs for errors
- Verify Bluesky credentials are correct
- Test proxy health: `curl http://YOUR_IP:3550/auth/status`

## Advanced: Public Access

To access your proxy from the internet:

### Option 1: Cloudflare Tunnel (Recommended)
```bash
cloudflared tunnel --url http://localhost:3550
```

### Option 2: Reverse Proxy (nginx)
```nginx
server {
    listen 443 ssl;
    server_name proxy.yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3550;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Then use `https://proxy.yourdomain.com` as your proxy URL.

## Switching Modes

### From Traditional to Zero-Trust
1. Deploy your authentication proxy
2. Go to Settings → Credentials
3. Configure proxy URL + API key
4. System automatically switches to zero-trust mode

### From Zero-Trust to Traditional
Currently not supported - contact support if needed.

## FAQ

**Q: Is zero-trust mode more secure?**
A: Yes, if you trust your own infrastructure more than feed-moderator's. Your credentials never leave your control.

**Q: What happens if my proxy goes offline?**
A: Operations fail gracefully with clear error messages. Nothing breaks permanently.

**Q: Can I use the same proxy for multiple accounts?**
A: No, each proxy is tied to one Bluesky account. Deploy separate proxies for multiple accounts.

**Q: Does this cost extra?**
A: No, zero-trust mode is free. You just need to run the proxy (minimal resources: ~50MB RAM).

**Q: Can I see what feed-moderator is doing?**
A: Yes! Your proxy logs every operation with timestamp, reason, and IP address.

**Q: Is this overkill for most users?**
A: Probably yes. Traditional mode is secure and simpler. Zero-trust is for users who want absolute control.

## Support

- Documentation: `/root/feed-moderator/ZERO_TRUST_AUTHENTICATION_ARCHITECTURE.md`
- Proxy source: `/root/feed-moderator/user-decryption-service/`
- Issues: GitHub issues or Discord

## Summary

Zero-trust mode gives you **complete control** over your Bluesky credentials:
- ✅ You run the authentication proxy
- ✅ You control when access is granted
- ✅ You can revoke access instantly
- ✅ You have full audit logs
- ✅ Feed-moderator never sees your password

Perfect for security-conscious users who want maximum control.
