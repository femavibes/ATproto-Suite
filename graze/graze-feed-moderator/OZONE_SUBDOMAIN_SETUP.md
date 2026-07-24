# Ozone Subdomain Setup

Ozone doesn't support running under a subpath (like `/ozone`). It needs to run at the root of a domain.

## 🔧 Solution: Use Subdomain

**Ozone URL:** `https://ozone.feedmod.fema.monster`

## 📋 Cloudflare Tunnel Configuration

You need to add a route in your Cloudflare tunnel for Ozone:

### Option 1: Cloudflare Dashboard

1. Go to Cloudflare Zero Trust dashboard
2. Navigate to Access → Tunnels
3. Edit your existing tunnel
4. Add a new public hostname:
   - **Subdomain:** `ozone`
   - **Domain:** `feedmod.fema.monster`
   - **Service:** `http://localhost:3003`

### Option 2: Config File

If using `cloudflared` config file, add:

```yaml
ingress:
  - hostname: ozone.feedmod.fema.monster
    service: http://localhost:3003
  - hostname: feedmod.fema.monster
    service: http://localhost:8081
  - service: http_status:404
```

Then restart tunnel:
```bash
cloudflared tunnel restart
```

## ✅ After Tunnel Setup

1. **Test:** `curl https://ozone.feedmod.fema.monster/xrpc/_health`
2. **Open:** https://ozone.feedmod.fema.monster
3. **Login** as `@feedmoderator.fema.monster`
4. **Complete** setup wizard

## 🔑 Credentials

- **Labeler:** `@feedmoderator.fema.monster`
- **DID:** `did:plc:p7j6hgyrgdmcemibtgl64eyq`
- **Admin Password:** `e1e3d41ec6398ffcb4c7f7bdf8f987d9`
- **App Password:** `eyrk-jjfm-zihz-h6m4`

## 🚀 Services

- **Ozone:** Port 3003 → https://ozone.feedmod.fema.monster
- **Feed Moderator:** Port 8081 → https://feedmod.fema.monster
- **Backend API:** Port 3001 (internal)
