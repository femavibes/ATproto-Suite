# Zero-Trust Quick Start

## 30-Second Setup

### 1. Register
```
✓ Check "Zero-Trust Mode" during registration
✓ Use any password (NOT your Bluesky password)
```

### 2. Deploy Proxy
```bash
docker run -d -p 3550:3550 \
  -e BLUESKY_HANDLE=you.bsky.social \
  -e BLUESKY_PASSWORD=your-app-password \
  feedmoderator/auth-proxy
```

### 3. Get API Key
```bash
docker logs feedmod-auth-proxy | grep "API key"
```

### 4. Configure
```
Settings → Credentials → Enter proxy URL + API key → Done!
```

## Commands

```bash
# Start proxy
docker run -d --name feedmod-auth-proxy -p 3550:3550 \
  -e BLUESKY_HANDLE=you.bsky.social \
  -e BLUESKY_PASSWORD=your-app-password \
  feedmoderator/auth-proxy

# Check status
docker logs feedmod-auth-proxy

# Restart
docker restart feedmod-auth-proxy

# Stop (revoke access)
docker stop feedmod-auth-proxy

# View audit logs
docker logs feedmod-auth-proxy --tail 100
```

## What You Get

✅ **Complete control** - Your credentials never leave your server  
✅ **Instant revocation** - Stop container = access revoked  
✅ **Full audit trail** - Every operation logged with timestamp  
✅ **Zero trust** - Feed-moderator cannot access your account without your proxy  

## Status Indicators

- 🟡 **Pending** - Need to configure proxy
- 🟢 **Active** - Proxy connected and working
- 🔴 **Offline** - Proxy unreachable

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Cannot connect | Check proxy is running: `docker ps` |
| Invalid API key | Get new key: `docker logs feedmod-auth-proxy` |
| Operations failing | Check proxy logs for errors |

## Architecture

```
Traditional:  You → Feed-Moderator → Graze/Bluesky
Zero-Trust:   You → Feed-Moderator → Your Proxy → Graze/Bluesky
                                  ↑
                          (Never sees password)
```

## Full Documentation

See `ZERO_TRUST_SETUP_GUIDE.md` for complete details.
