#!/bin/bash
set -e

echo "=== Ozone Quick Credential Update ==="
echo "This updates signing key and DID WITHOUT wiping the database"
echo ""

# Prompt for new account details
echo "Enter your NEW Bluesky labeler account details:"
read -p "DID (e.g., did:plc:xxxxx): " NEW_DID
read -p "Handle (e.g., labeler.bsky.social): " NEW_HANDLE

# Generate new signing key
NEW_SIGNING_KEY=$(openssl rand -hex 32)
NEW_ADMIN_PASSWORD=$(openssl rand -hex 16)

# Backup old config
echo ""
echo "Backing up old configuration..."
cd /root/skymap/ozone
cp ozone.env ozone.env.backup.$(date +%Y%m%d_%H%M%S)

# Update ozone.env
echo "Updating ozone.env..."
sed -i "s|OZONE_SERVER_DID=.*|OZONE_SERVER_DID=${NEW_DID}|" ozone.env
sed -i "s|OZONE_ADMIN_DIDS=.*|OZONE_ADMIN_DIDS=${NEW_DID}|" ozone.env
sed -i "s|OZONE_SIGNING_KEY_HEX=.*|OZONE_SIGNING_KEY_HEX=${NEW_SIGNING_KEY}|" ozone.env
sed -i "s|OZONE_ADMIN_PASSWORD=.*|OZONE_ADMIN_PASSWORD=${NEW_ADMIN_PASSWORD}|" ozone.env

# Restart containers
echo ""
echo "Restarting Ozone..."
docker compose restart ozone

echo ""
echo "=== Update Complete! ==="
echo ""
echo "SAVE THESE CREDENTIALS:"
echo "----------------------"
echo "Labeler DID: ${NEW_DID}"
echo "Labeler Handle: ${NEW_HANDLE}"
echo "Signing Key: ${NEW_SIGNING_KEY}"
echo "Admin Password: ${NEW_ADMIN_PASSWORD}"
echo "Ozone URL: https://ozoneskymap.fema.monster"
echo ""
echo "Login at: https://ozoneskymap.fema.monster"
echo ""
