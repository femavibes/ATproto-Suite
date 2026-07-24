# ModMaster Zero-Trust Authentication Proxy

## What This Does

**Complete isolation**: ModMaster NEVER sees your Bluesky credentials.
- Your proxy authenticates with Graze/Bluesky
- Returns session tokens to ModMaster
- ModMaster uses tokens for operations
- You control when access is granted
- Full audit trail of all operations
- **Multi-user support**: One proxy can serve multiple ModMaster users
- **Isolated monitored accounts**: Each user's autoblock accounts are separate

## Quick Setup

### Single User:
```bash
docker run -d -p 3550:3550 \
  -e USER_1_IDENTIFIER=your-handle.bsky.social \
  -e USER_1_PASSWORD=your-app-password \
  -v modmaster-proxy-data:/app/data \
  ghcr.io/femavibes/modmaster-zero-trust-auth-proxy:latest
```

### With Monitored Accounts (for Autoblock):
```bash
docker run -d -p 3550:3550 \
  -e USER_1_IDENTIFIER=your-handle.bsky.social \
  -e USER_1_PASSWORD=your-main-app-password \
  -e USER_1_MONITORED=alt1.bsky.social:alt1-password,alt2.bsky.social:alt2-password \
  -v modmaster-proxy-data:/app/data \
  ghcr.io/femavibes/modmaster-zero-trust-auth-proxy:latest
```

### Multiple Users on Same Proxy:
```bash
docker run -d -p 3550:3550 \
  -e USER_1_IDENTIFIER=alice.bsky.social \
  -e USER_1_PASSWORD=alice-password \
  -e USER_1_MONITORED=alice-alt.bsky.social:alice-alt-password \
  -e USER_2_IDENTIFIER=bob.bsky.social \
  -e USER_2_PASSWORD=bob-password \
  -e USER_2_MONITORED=bob-alt1.bsky.social:bob-alt1-password,bob-alt2.bsky.social:bob-alt2-password \
  -v modmaster-proxy-data:/app/data \
  ghcr.io/femavibes/modmaster-zero-trust-auth-proxy:latest
```
**Note**: Each user can have their own monitored accounts - they are completely isolated.

### Manual Setup:
```bash
npm install
export USER_1_IDENTIFIER=your-handle.bsky.social
export USER_1_PASSWORD=your-app-password
npm start
```

## Get Your API Key

After starting, check the logs:
```bash
docker logs [container-id]
```

You'll see:
```
🔐 Zero-Trust Authentication Proxy running on port 3550
👤 Loaded user 1: your-handle.bsky.social (2 monitored accounts)
🔑 Your API key: abc123def456...
👥 Configured users: 1
✅ Ready for zero-trust authentication!
```

Copy this API key and enter it in ModMaster Settings.

## How It Works

1. **Deploy**: Run this proxy on your server with your Bluesky credentials
2. **Configure**: Enter proxy URL + API key in ModMaster Settings
3. **Operate**: ModMaster requests tokens, your proxy provides them
4. **Control**: Stop container = instant access revocation

## Configuration Format

### Main Account
- `USER_<number>_IDENTIFIER`: Your Bluesky handle or DID
- `USER_<number>_PASSWORD`: Your Bluesky app password

### Monitored Accounts (Optional - for Autoblock)
- `USER_<number>_MONITORED`: Comma-separated list of `handle:password` pairs
- Format: `alt1.bsky.social:password1,alt2.bsky.social:password2`
- Each monitored account needs its own Bluesky app password
- Monitored accounts are isolated per user

### Using DIDs (Recommended)
DIDs don't change if you change your handle:
```bash
-e USER_1_IDENTIFIER=did:plc:abc123xyz \
-e USER_1_MONITORED=did:plc:def456:password1,did:plc:ghi789:password2
```

## Security Benefits

- **Complete control** - Your credentials never leave your infrastructure
- **Instant revocation** - Stop container to revoke access immediately
- **Full audit trail** - Every operation logged with timestamp and reason
- **Zero trust** - ModMaster cannot access your account without your proxy
- **Multi-user isolation** - Each user's monitored accounts are completely separate
- **Flexible deployment** - One proxy can serve multiple ModMaster users

## Deployment Options

- **Home server** (Raspberry Pi, old laptop)
- **VPS** ($5/month DigitalOcean, Linode, etc.)
- **Cloud** (AWS, GCP, Azure)
- **Your existing server**

## Example URLs

After setup, use these in ModMaster Settings:
- `http://your-server-ip:3550`
- `https://proxy.yourdomain.com` (with reverse proxy)
- `http://192.168.1.100:3550` (home network)

## Commands

```bash
# Start
docker run -d --name modmaster-proxy -p 3550:3550 \
  -e USER_1_IDENTIFIER=you.bsky.social \
  -e USER_1_PASSWORD=your-app-password \
  ghcr.io/femavibes/modmaster-zero-trust-auth-proxy:latest

# View logs
docker logs modmaster-proxy

# Stop (revoke access)
docker stop modmaster-proxy

# Restart
docker restart modmaster-proxy
```

## What Gets Logged

Every operation is logged:
```
🔐 Graze session requested: POST_MODERATION
✅ Session provided for POST_MODERATION

🔐 Bluesky token requested: LIST_MANAGEMENT
✅ Tokens provided for LIST_MANAGEMENT
```

## Building from Source

```bash
git clone https://github.com/femavibes/modmaster-zero-trust-auth-proxy.git
cd modmaster-zero-trust-auth-proxy
docker build -t modmaster-proxy .
```

## Environment Variables (.env file)

Create a `.env` file for easier configuration:

```bash
# Single user with monitored accounts
USER_1_IDENTIFIER=alice.bsky.social
USER_1_PASSWORD=xxxx-xxxx-xxxx-xxxx
USER_1_MONITORED=alice-alt1.bsky.social:yyyy-yyyy-yyyy-yyyy,alice-alt2.bsky.social:zzzz-zzzz-zzzz-zzzz

# Multiple users (each with their own monitored accounts)
USER_2_IDENTIFIER=bob.bsky.social
USER_2_PASSWORD=aaaa-aaaa-aaaa-aaaa
USER_2_MONITORED=bob-alt.bsky.social:bbbb-bbbb-bbbb-bbbb

# Server config
PORT=3550
```

Then run:
```bash
docker run -d -p 3550:3550 --env-file .env \
  -v modmaster-proxy-data:/app/data \
  ghcr.io/femavibes/modmaster-zero-trust-auth-proxy:latest
```

## Docker Compose Example

```yaml
services:
  auth-proxy:
    image: ghcr.io/femavibes/modmaster-zero-trust-auth-proxy:latest
    ports:
      - "3550:3550"
    environment:
      - USER_1_IDENTIFIER=alice.bsky.social
      - USER_1_PASSWORD=alice-password
      - USER_1_MONITORED=alice-alt1.bsky.social:alt1-pass,alice-alt2.bsky.social:alt2-pass
      - USER_2_IDENTIFIER=bob.bsky.social
      - USER_2_PASSWORD=bob-password
      - USER_2_MONITORED=bob-alt.bsky.social:bob-alt-pass
    volumes:
      - proxy-data:/app/data
    restart: unless-stopped

volumes:
  proxy-data:
```
