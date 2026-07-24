# Ozone Issues and Configuration Notes

## Current Status
Ozone is running but **login is broken** due to Bluesky rate limiting. The web UI is inaccessible.

## The Problem

### Rate Limiting Issue
- Ozone authenticates users through their Bluesky PDS (Personal Data Server)
- Every login attempt hits `bsky.social/xrpc/com.atproto.server.createSession`
- Bluesky has a rate limit: **100 requests per 5 minutes**
- We hit this limit from:
  1. Bulk labeling Utah accounts (each label tried to authenticate)
  2. Multiple failed login attempts to Ozone UI

### Authentication Flow
Ozone does NOT have standalone authentication. It always goes through:
1. User enters handle/DID + password
2. Ozone calls the user's PDS (Bluesky) to authenticate
3. If successful, Ozone creates a session

This means:
- Can't login when Bluesky is rate limiting you
- `OZONE_ADMIN_PASSWORD` in config is NOT used for web UI login
- DID + password still goes through Bluesky

## Current Configuration

### Ozone Instance Details
- **Labeler DID**: `did:plc:l37i5se642dgeb7kmrdwoqv4`
- **Labeler Handle**: `atls.city` (originally `skymap10000.bsky.social`)
- **Account Password**: `giad-atw2-urz4-palz`

### Signing Keys (CRITICAL - DO NOT LOSE)
**Labeler Signing Key**: `7c807ac8323af29ce7dd653cf22fa0121b4ad643b5038c69f899bfaf65891f31`
- This key signs labels
- Stored in: `/ATlas/ozone/NEW-CREDENTIALS-2.txt`
- Used in `OZONE_SIGNING_KEY_HEX` env var

**What the signing key does:**
- Signs labels that your labeler emits
- Cryptographically proves labels came from your labeler
- Cannot be used to update DID document

**What the signing key CANNOT do:**
- Update the DID document
- Change the labeler service endpoint
- Modify account settings

### DID Document vs Web Interface

**DID Document Labeler Endpoint**: `https://ozoneskymap.fema.monster`
- This is where Bluesky apps fetch labels FROM
- Stored in the DID document at `https://plc.directory/did:plc:l37i5se642dgeb7kmrdwoqv4`
- Hard to change (requires rotation key, not signing key)
- Current value:
```json
{
  "id": "#atproto_labeler",
  "type": "AtprotoLabeler",
  "serviceEndpoint": "https://ozoneskymap.fema.monster"
}
```

**Ozone Web Interface**: `https://ozone.atls.city`
- This is where YOU login to manage labels
- Can be any domain, just needs to match `OZONE_PUBLIC_URL`
- Served by nginx on port 443
- Config: `/etc/nginx/sites-available/ozone.atls.city.conf`

**Key Point**: These don't need to match! The web UI is just for admins. The DID endpoint is for public label fetching.

### Rotation Keys
Your DID has rotation keys that can update the DID document:
```
did:key:zQ3shhCGUqDKjStzuDxPkTxN6ujddP4RkEKJJouJGRRkaLGbg
did:key:zQ3shpKnbdPx3g3CmPf5cRVTPe1HtSwVn5ish3wSnDPQCbLJK
```

**Problem**: We don't have the private keys for these rotation keys.
- These are generated when the Bluesky account was created
- Stored in Bluesky's PDS, not accessible to us
- Only way to use them: Login to Bluesky account and update through their UI (but Bluesky doesn't expose labeler endpoint updates in UI)

### Environment Configuration

Location: `/ATlas/ozone/ozone.env`

```bash
OZONE_SERVER_DID=did:plc:l37i5se642dgeb7kmrdwoqv4
OZONE_PUBLIC_URL=https://ozone.atls.city
OZONE_ADMIN_DIDS=did:plc:l37i5se642dgeb7kmrdwoqv4,did:plc:lptjvw6ut224kwrj7ub3sqbe
OZONE_ADMIN_PASSWORD=208022ff959105c20d4c76269206eeb6
OZONE_SIGNING_KEY_HEX=5ec7697f5e191907367671b0e03d807c897713c807d5f5a3611f66e8092e1bc2
OZONE_DB_POSTGRES_URL=postgresql://postgres:08b5407640c8bf0275895a3707809e8d@localhost:5432/ozone
OZONE_DB_MIGRATE=1
OZONE_DID_PLC_URL=https://plc.directory
OZONE_APPVIEW_URL=https://api.bsky.app
OZONE_APPVIEW_DID=did:web:api.bsky.app
OZONE_LABEL_EMITTER_ENABLED=true
LOG_ENABLED=1
```

**Note**: The `OZONE_SIGNING_KEY_HEX` in the current config doesn't match the one in NEW-CREDENTIALS-2.txt. This might be from an older setup.

### Docker Compose Setup

Location: `/ATlas/ozone/compose.yaml`

Services:
- **ozone**: Main Ozone service (port 3000)
- **postgres**: Database (port 5432, localhost only)
- **caddy**: Reverse proxy (was configured for `ozoneskymap.fema.monster`, now unused)
- **watchtower**: Auto-updates containers

**Current state**: 
- Ozone running on localhost:3000
- Nginx (not Caddy) proxies `ozone.atls.city` → localhost:3000
- Caddy is running but not being used (nginx takes precedence)

## The Original Problem: Utah Account Labeling

### What Happened
Tried to bulk label Utah accounts from admin panel at `admin.atls.city`. Got rate limit errors.

### Root Cause
Admin code at `/ATlas/services/admin/server.js` line ~2346:
```javascript
const agent = new AtpAgent({ service: 'https://bsky.social' });
await agent.login({
  identifier: process.env.BLUESKY_HANDLE,
  password: process.env.BLUESKY_PASSWORD
});

await agent.api.tools.ozone.moderation.emitEvent(...)
```

**Problem**: This code:
1. Authenticates with Bluesky for EVERY label
2. Calls Bluesky's Ozone API (not our local Ozone)
3. Hit rate limit after ~100 labels

### The Solution (Not Implemented Yet)
**Option 1**: Remove Ozone API calls entirely
- Just write labels to local database
- Don't call any external APIs
- Labels are stored in `user_labels` table

**Option 2**: Call local Ozone API
- Change `https://bsky.social` to `http://localhost:3000`
- Still need to authenticate (but locally)
- Ozone will emit labels with proper signatures

**Option 3**: Batch operations
- Collect all labels to add
- Make one authenticated session
- Add all labels in that session
- Stay under rate limits

## Credentials Summary

### Account: atls.city (did:plc:l37i5se642dgeb7kmrdwoqv4)
- **Handle**: `atls.city`
- **Password**: `giad-atw2-urz4-palz`
- **PDS**: `https://discina.us-west.host.bsky.network`

### Ozone Admin Access (when working)
- **URL**: `https://ozone.atls.city`
- **Login with**: `atls.city` + `giad-atw2-urz4-palz`
- **Or DID**: `did:plc:l37i5se642dgeb7kmrdwoqv4` + password (same result, still hits Bluesky)

### Database Access
- **Ozone DB**: `postgresql://postgres:08b5407640c8bf0275895a3707809e8d@localhost:5432/ozone`
- **App DB**: `postgresql://dev:devpass@localhost:5435/skymap`

### Signing Keys
- **Current (in config)**: `5ec7697f5e191907367671b0e03d807c897713c807d5f5a3611f66e8092e1bc2`
- **From credentials file**: `7c807ac8323af29ce7dd653cf22fa0121b4ad643b5038c69f899bfaf65891f31`
- **Note**: Mismatch needs investigation

## Previous Ozone Setup (OLD)

From `/ATlas/ozone/NEW-CREDENTIALS.txt`:
- **DID**: `did:plc:pyhdwmfctl6qbqjykyqch62g`
- **Handle**: `skymap-5000.bsky.social`
- **Signing Key**: `de4b6a8fb9ba0591fd513d31f9e4e319460bfe39307d9dc3482cb69d7a3a37de`
- **Admin Password**: `76d4ce717024f2a1587ad5878a09853d`

This was replaced on 2026-01-14 with the current setup.

## Network Configuration

### Nginx Config: `/etc/nginx/sites-available/ozone.atls.city.conf`
```nginx
server {
    listen 80;
    server_name ozone.atls.city;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ozone.atls.city;

    ssl_certificate /etc/letsencrypt/live/ozone.atls.city/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ozone.atls.city/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Caddy Config: `/ATlas/ozone/caddy/etc/caddy/Caddyfile`
```
ozone.atls.city {
  reverse_proxy http://localhost:3000
}
```
**Note**: Caddy config exists but nginx takes precedence since it's listening on port 443.

## How to Update DID Document (Theoretical)

To change the labeler endpoint from `ozoneskymap.fema.monster` to something else:

### Requirements
- Private key for one of the rotation keys, OR
- Access to Bluesky account to update through their API

### Method 1: Using Rotation Key (if we had it)
```javascript
const { Secp256k1Keypair } = require('@atproto/crypto');
const plc = require('@did-plc/lib');

const rotationKeyPrivate = 'PRIVATE_KEY_WE_DONT_HAVE';
const did = 'did:plc:l37i5se642dgeb7kmrdwoqv4';
const newEndpoint = 'https://ozone.atls.city';

const client = new plc.Client('https://plc.directory');
const keypair = await Secp256k1Keypair.import(Buffer.from(rotationKeyPrivate, 'hex'));

// Create update operation
const newOp = {
  type: 'plc_operation',
  prev: 'LAST_OPERATION_CID',
  services: {
    atproto_pds: {
      type: 'AtprotoPersonalDataServer',
      endpoint: 'https://discina.us-west.host.bsky.network'
    },
    atproto_labeler: {
      type: 'AtprotoLabeler',
      endpoint: newEndpoint  // NEW ENDPOINT HERE
    }
  },
  alsoKnownAs: ['at://atls.city'],
  rotationKeys: [...], // Keep existing
  verificationMethods: {...} // Keep existing
};

const signedOp = await plc.signOperation(newOp, keypair);
await client.sendOperation(did, signedOp);
```

### Method 2: Using Bluesky Account (what we tried)
We tried updating through the account but:
- Bluesky doesn't expose labeler endpoint updates in their UI
- Would need to use their API directly
- Still requires authentication (which is rate limited)

## Workarounds

### For Labeling (Recommended)
1. **Skip Ozone entirely** for bulk operations
2. Write labels directly to your database
3. Let Ozone serve them (it reads from DB)
4. No API calls = no rate limits

### For Ozone Web UI Access
1. **Wait 5-10 minutes** after last login attempt
2. Try logging in with `atls.city` + `giad-atw2-urz4-palz`
3. If rate limited again, wait longer
4. Consider using a VPN to get a different IP (rate limits are per-IP)

### For DID Document Updates
1. **Accept current endpoint**: `ozoneskymap.fema.monster` works fine
2. **Create new labeler**: Start fresh with new DID (lose all existing labels)
3. **Contact Bluesky support**: Ask them to update your DID document

## Files to Reference

- `/ATlas/ozone/ozone.env` - Main configuration
- `/ATlas/ozone/NEW-CREDENTIALS-2.txt` - Current credentials
- `/ATlas/ozone/NEW-CREDENTIALS.txt` - Old credentials
- `/ATlas/ozone/compose.yaml` - Docker setup
- `/ATlas/services/admin/server.js` - Admin panel code (line ~2346 has the problematic Bluesky API call)
- `/etc/nginx/sites-available/ozone.atls.city.conf` - Nginx config

## Next Steps

1. **Fix admin panel labeling** - Remove Bluesky API calls, write directly to database
2. **Investigate signing key mismatch** - Config has different key than credentials file
3. **Document label database schema** - So we can write labels without Ozone UI
4. **Consider alternatives to Ozone** - Maybe build our own simple labeler service

## Why Ozone Sucks

- No standalone authentication (always goes through Bluesky)
- Rate limits from Bluesky affect your own labeler
- Can't easily change domains/endpoints
- Complex setup with rotation keys we don't control
- Web UI is the only way to manage labels (no CLI)
- Documentation is sparse and assumes you're running on Bluesky's infrastructure

## Useful Commands

```bash
# Check Ozone logs
docker logs ozone --tail=50

# Restart Ozone
cd /ATlas/ozone && docker compose restart ozone

# Check Ozone status
cd /ATlas/ozone && docker compose ps

# View current DID document
curl -s "https://plc.directory/did:plc:l37i5se642dgeb7kmrdwoqv4" | jq .

# Check rate limit status (will fail if rate limited)
curl -s "https://bsky.social/xrpc/com.atproto.server.describeServer"
```

## Date of Last Update
2026-02-21
