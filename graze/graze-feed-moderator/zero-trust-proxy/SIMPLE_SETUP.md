# Simple Zero Trust Setup

## Quick Start

Edit your `.env` file:

```bash
# Main account - use handle or DID
BLUESKY_HANDLE=fema.monster
BLUESKY_PASSWORD=your-main-app-password

# Monitored accounts - comma-separated list
# Format: identifier:password,identifier:password
MONITORED_ACCOUNTS=alt1.bsky.social:xxxx-xxxx-xxxx-xxxx,alt2.bsky.social:yyyy-yyyy-yyyy-yyyy

# Port (default: 3550)
PORT=3550
```

Then restart:
```bash
docker compose restart
```

## That's It!

- Main account can use handle or DID
- Monitored accounts can use handle or DID
- Add as many monitored accounts as you want, separated by commas
- No complex environment variable names needed

## Example with Multiple Accounts

```bash
BLUESKY_HANDLE=fema.monster
BLUESKY_PASSWORD=main-pass

MONITORED_ACCOUNTS=alt1.bsky.social:pass1,alt2.bsky.social:pass2,did:plc:abc123:pass3,alt4.bsky.social:pass4
```

## In Feed Moderator UI

1. Add monitored account (with or without password)
2. Toggle "Use Zero Trust" ON
3. Done! The proxy handles authentication
