# Fix for modmaster.fema.monster CORS/Login Issues

## Problem
The domain `modmaster.fema.monster` is currently routing to the feedmaster service (port 8000) instead of the feed-moderator service (port 8081), causing CORS issues and preventing login.

## Solution Options

### Option 1: Update Existing Tunnel (Recommended)
1. Go to Cloudflare Dashboard → Zero Trust → Access → Tunnels
2. Find your tunnel (ID: cac7bd5d-88c6-4672-95c8-a5cd92a7979b)
3. Edit the tunnel configuration
4. Change the route for `modmaster.fema.monster` from:
   - Current: `http://localhost:8000` (feedmaster)
   - To: `http://localhost:8081` (feed-moderator frontend)

### Option 2: Create Separate Tunnel
Create a new tunnel specifically for feed-moderator:

```yaml
# feed-moderator-tunnel.yml
tunnel: <new-tunnel-id>
credentials-file: /etc/cloudflared/<new-tunnel-id>.json

ingress:
  - hostname: "modmaster.fema.monster"
    service: http://localhost:8081
  - service: http_status:404
```

### Option 3: Local Reverse Proxy (Temporary)
Run nginx locally to proxy the domain:

```bash
# Install nginx if not already installed
sudo apt update && sudo apt install nginx

# Copy the config
sudo cp /root/feed-moderator/nginx-proxy.conf /etc/nginx/sites-available/modmaster
sudo ln -s /etc/nginx/sites-available/modmaster /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## Current Status
- Backend CORS has been fixed to allow modmaster.fema.monster
- Frontend is accessible but API calls fail due to routing issue
- Need to update tunnel configuration to route to port 8081

## Test After Fix
```bash
curl https://modmaster.fema.monster/api/health
# Should return: {"status":"ok","timestamp":"..."}
```