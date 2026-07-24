# ✅ Ozone is Running!

## 🎯 Access URLs

- **Ozone UI:** https://feedmod.fema.monster/ozone
- **Health Check:** https://feedmod.fema.monster/ozone/xrpc/_health
- **Label Stream:** wss://feedmod.fema.monster/ozone/xrpc/com.atproto.label.subscribeLabels

## 🔑 Credentials

**Labeler Account:** `@feedmoderator.fema.monster`  
**Labeler DID:** `did:plc:p7j6hgyrgdmcemibtgl64eyq`  
**Admin Password:** `e1e3d41ec6398ffcb4c7f7bdf8f987d9`  
**App Password:** `eyrk-jjfm-zihz-h6m4` (configured)

## 📋 Next Steps

1. **Open Ozone UI:** https://feedmod.fema.monster/ozone
2. **Login** with `@feedmoderator.fema.monster` credentials
3. **Complete Setup Wizard:**
   - Step 1: Associate domain with DID
   - Step 2: Publish labeler record (makes it discoverable)

## ✅ What's Working

- ✅ Ozone service running
- ✅ PostgreSQL database initialized
- ✅ Nginx proxy configured with WebSocket support
- ✅ Integrated with feed-moderator at `/ozone` path
- ✅ Using existing Cloudflare tunnel (no router config needed!)
- ✅ App password configured in feed-moderator

## 🔍 Verify

```bash
# Check services
docker compose ps

# Test health
curl https://feedmod.fema.monster/ozone/xrpc/_health

# View logs
docker compose logs -f ozone
```

## 🎉 Benefits

- No separate tunnel needed
- No router/firewall configuration
- Integrated with existing infrastructure
- WebSocket support for real-time label streaming
- Ready for feed-moderator integration

## 🚀 Using Your Labeler

Once you complete the setup wizard:

1. Users can find your labeler in Bluesky app:
   - Settings → Moderation → Labelers
   - Search for `@feedmoderator.fema.monster`

2. You can apply labels via Ozone UI

3. Feed-moderator can consume labels automatically
