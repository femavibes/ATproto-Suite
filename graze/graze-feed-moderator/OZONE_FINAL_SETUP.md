# ✅ Ozone Setup - Final Step

Ozone is running on **port 3003** and needs a subdomain to work properly.

## 🎯 What You Need to Do

Add this route to your Cloudflare tunnel:

**Subdomain:** `ozone.feedmod.fema.monster` → **http://localhost:3003**

## 📋 How to Add the Route

### In Cloudflare Dashboard:

1. Go to https://one.dash.cloudflare.com
2. Navigate to **Networks** → **Tunnels**
3. Click on your tunnel (the one serving feedmod.fema.monster)
4. Click **Configure**
5. Go to **Public Hostname** tab
6. Click **Add a public hostname**
7. Fill in:
   - **Subdomain:** `ozone`
   - **Domain:** `feedmod.fema.monster`
   - **Type:** HTTP
   - **URL:** `localhost:3003`
8. Click **Save**

## ✅ After Adding Route

1. **Test:** `curl https://ozone.feedmod.fema.monster/xrpc/_health`
2. **Open:** https://ozone.feedmod.fema.monster
3. **Login** with `@feedmoderator.fema.monster`
4. **Complete** the 2-step setup wizard

## 🔑 Credentials

- **Labeler Account:** `@feedmoderator.fema.monster`
- **DID:** `did:plc:p7j6hgyrgdmcemibtgl64eyq`
- **Admin Password:** `e1e3d41ec6398ffcb4c7f7bdf8f987d9`
- **App Password:** `eyrk-jjfm-zihz-h6m4` (already configured)

## 🚀 Current Status

- ✅ Ozone running on port 3003
- ✅ Database initialized
- ✅ App password configured
- ✅ Keys generated
- ⏳ Waiting for Cloudflare tunnel route

## 🔍 Verify Locally

```bash
# Check Ozone is running
curl http://localhost:3003/xrpc/_health

# Should return: {"version":"0.1.159"}
```

Once you add the Cloudflare route, Ozone will be accessible at https://ozone.feedmod.fema.monster!
