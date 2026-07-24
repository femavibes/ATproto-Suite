# Ozone Integration Setup

Ozone is now integrated into feed-moderator at `/ozone` path.

## 🔑 Generated Credentials

**Admin Password:** `e1e3d41ec6398ffcb4c7f7bdf8f987d9`

**Labeler Account:** `@feedmoderator.fema.monster`  
**Labeler DID:** `did:plc:p7j6hgyrgdmcemibtgl64eyq`

## 🚀 Start Ozone

```bash
cd /root/feed-moderator
docker compose down
docker compose up -d --build
```

## 📋 Setup Steps

1. **Create App Password** for your labeler account:
   - Login to Bluesky as `@feedmoderator.fema.monster`
   - Go to Settings → App Passwords
   - Create new password (name it "Ozone")
   - Copy the password

2. **Update .env** with app password:
   ```bash
   nano /root/feed-moderator/.env
   # Update: LABELER_PASSWORD=your-app-password-here
   ```

3. **Restart services**:
   ```bash
   docker compose restart backend
   ```

4. **Access Ozone UI**:
   - Open: https://feedmod.fema.monster/ozone
   - Login with `@feedmoderator.fema.monster` credentials
   - Complete the 2-step setup wizard

## ✅ Verify Setup

```bash
# Check health
curl https://feedmod.fema.monster/ozone/xrpc/_health

# Check services
docker compose ps

# View logs
docker compose logs -f ozone
```

## 🔗 URLs

- **Ozone UI:** https://feedmod.fema.monster/ozone
- **Label Stream:** wss://feedmod.fema.monster/ozone/xrpc/com.atproto.label.subscribeLabels
- **Health Check:** https://feedmod.fema.monster/ozone/xrpc/_health

## 🎯 No Router Config Needed!

Since you're using Cloudflare tunnel, everything routes through your existing setup. No port forwarding or router changes required!
