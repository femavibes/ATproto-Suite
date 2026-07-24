# Ozone Reset Guide - New Account Setup

## What This Does
Resets your Ozone installation to work with a new Bluesky labeler account by:
- Clearing the database
- Generating a new signing key
- Updating configuration with new account DID

## Prerequisites
1. Create a NEW Bluesky account for your labeler (e.g., mylabeler.bsky.social)
2. Get the DID of this new account from: https://bsky.app/profile/[handle]
   - Click on the profile
   - Look in the URL or use a DID resolver

## Quick Reset (Automated)

```bash
cd /root/skymap/ozone
chmod +x reset-ozone.sh
./reset-ozone.sh
```

The script will:
- Stop containers
- Clear database
- Generate new signing key
- Prompt for your new account DID and handle
- Update all configuration files
- Restart Ozone

## Manual Reset (Step-by-Step)

### 1. Stop Ozone
```bash
cd /root/skymap/ozone
docker compose down
```

### 2. Clear Database
```bash
rm -rf /root/skymap/ozone/postgres/*
```

### 3. Generate New Signing Key
```bash
openssl rand -hex 32
```
Save this key - you'll need it!

### 4. Update ozone.env
Edit `/root/skymap/ozone/ozone.env` and replace:
- `OZONE_SERVER_DID` - Your new account's DID
- `OZONE_ADMIN_DIDS` - Same DID as above
- `OZONE_SIGNING_KEY_HEX` - The key from step 3
- `OZONE_ADMIN_PASSWORD` - Generate new: `openssl rand -hex 16`
- Update password in `OZONE_DB_POSTGRES_URL`

### 5. Update postgres.env
Edit `/root/skymap/ozone/postgres.env`:
```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=[same as in OZONE_DB_POSTGRES_URL]
POSTGRES_DB=ozone
```

### 6. Start Ozone
```bash
docker compose up -d
```

### 7. Check Logs
```bash
docker compose logs -f ozone
```

## Verification Steps

1. **Check Ozone is running:**
   ```bash
   docker compose ps
   ```

2. **Access Ozone UI:**
   - Go to: https://ozoneskymap.fema.monster
   - Login with your new DID and admin password

3. **Verify Labeler Service Record:**
   - Go to your Bluesky account profile
   - Check that a labeler service record exists
   - It should point to: https://ozoneskymap.fema.monster

4. **Test Reporting:**
   - Try reporting a post to your labeler from Bluesky
   - Check if it appears in Ozone

## Important Files

- `/root/skymap/ozone/ozone.env` - Main configuration
- `/root/skymap/ozone/postgres.env` - Database configuration
- `/root/skymap/ozone/compose.yaml` - Docker setup

## Troubleshooting

### "JWT signature does not match jwt issuer"
- The signing key doesn't match the DID
- Regenerate signing key and update ozone.env

### Can't access Ozone UI
- Check Cloudflare tunnel is running
- Check containers are up: `docker compose ps`
- Check logs: `docker compose logs`

### Labeler service record missing
- You need to create it via ATProto
- Or use the Bluesky app to set up labeler service

## Backup Your Credentials!

After reset, save these securely:
- Labeler DID
- Labeler Handle  
- Signing Key (OZONE_SIGNING_KEY_HEX)
- Admin Password (OZONE_ADMIN_PASSWORD)
- Database Password

## Current Configuration (Before Reset)

- DID: did:plc:hikdgxc7fic2hjekzn2ebrk3
- URL: https://ozoneskymap.fema.monster
- Signing Key: 46972a91a104096a75779733914b324fec28c51ed95ab824b97deb54ff7418ff
