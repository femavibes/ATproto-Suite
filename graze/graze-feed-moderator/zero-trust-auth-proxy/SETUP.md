# Zero-Trust Auth Proxy Setup

## Quick Start

1. **Copy the example environment file:**
```bash
cp .env.example .env
```

2. **Edit `.env` with your credentials:**
```bash
nano .env
```

Set your Bluesky handle and app password:
```env
BLUESKY_HANDLE=yourhandle.bsky.social
BLUESKY_PASSWORD=your-app-password-here
PORT=3550
```

3. **Start the proxy:**
```bash
docker compose up -d
```

4. **Get your API key:**
```bash
docker compose logs
```

Look for the line:
```
🔑 Your API key: abc123def456...
```

5. **Configure in feed-moderator:**
- Go to Settings → Credentials
- Enter proxy URL: `http://your-server-ip:3550`
- Enter the API key from step 4
- Click "Configure Zero-Trust Proxy"

## Commands

```bash
# Start
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down

# Restart
docker compose restart

# Stop and remove data
docker compose down -v
```

## Troubleshooting

**Can't connect from feed-moderator:**
- Check firewall allows port 3550
- Verify proxy is running: `docker compose ps`
- Check logs: `docker compose logs`

**Need to change Bluesky password:**
1. Edit `.env` file
2. Restart: `docker compose restart`

**Reset encryption key:**
1. Stop: `docker compose down`
2. Remove volume: `docker volume rm zero-trust-auth-proxy_proxy-data`
3. Start: `docker compose up -d`

## Security Notes

- Keep your `.env` file secure (never commit to git)
- The API key is generated on first start
- Encryption key is stored in the Docker volume
- All operations are logged with timestamps
