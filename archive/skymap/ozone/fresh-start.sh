#!/bin/bash
set -e

echo "=== OZONE FRESH START ==="
echo ""
echo "This will completely reset Ozone with a NEW Bluesky account."
echo ""
echo "BEFORE RUNNING THIS:"
echo "1. Create a NEW Bluesky account (e.g., mylabeler.bsky.social)"
echo "2. Get the DID from: https://bsky.app/profile/[handle]"
echo "3. Save the account password somewhere safe"
echo ""
read -p "Have you created a new Bluesky account? (yes/no): " READY

if [ "$READY" != "yes" ]; then
    echo "Please create a new account first, then run this script again."
    exit 1
fi

echo ""
echo "=== Step 1: Stopping Ozone ==="
cd /ATlas/ozone
docker compose down

echo ""
echo "=== Step 2: Clearing Database ==="
rm -rf /ATlas/ozone/postgres/*
echo "Database cleared."

echo ""
echo "=== Step 3: Generating New Credentials ==="
NEW_SIGNING_KEY=$(openssl rand -hex 32)
NEW_ADMIN_PASSWORD=$(openssl rand -hex 16)
NEW_DB_PASSWORD=$(openssl rand -hex 16)

echo ""
echo "=== Step 4: Enter New Account Details ==="
read -p "Enter your NEW account DID (e.g., did:plc:xxxxx): " NEW_DID
read -p "Enter your NEW account handle (e.g., mylabeler.bsky.social): " NEW_HANDLE

echo ""
echo "=== Step 5: Backing Up Old Config ==="
cp ozone.env ozone.env.backup.$(date +%Y%m%d_%H%M%S)

echo ""
echo "=== Step 6: Creating New Configuration ==="
cat > ozone.env << EOF
OZONE_SERVER_DID=${NEW_DID}
OZONE_PUBLIC_URL=https://ozone.atls.city
OZONE_ADMIN_DIDS=${NEW_DID}
OZONE_ADMIN_PASSWORD=${NEW_ADMIN_PASSWORD}
OZONE_SIGNING_KEY_HEX=${NEW_SIGNING_KEY}
OZONE_DB_POSTGRES_URL=postgresql://postgres:${NEW_DB_PASSWORD}@localhost:5432/ozone
OZONE_DB_MIGRATE=1
OZONE_DID_PLC_URL=https://plc.directory
OZONE_APPVIEW_URL=https://api.bsky.app
OZONE_APPVIEW_DID=did:web:api.bsky.app
OZONE_LABEL_EMITTER_ENABLED=true
LOG_ENABLED=1
EOF

cat > postgres.env << EOF
POSTGRES_USER=postgres
POSTGRES_PASSWORD=${NEW_DB_PASSWORD}
POSTGRES_DB=ozone
EOF

echo ""
echo "=== Step 7: Saving Credentials ==="
cat > NEW-CREDENTIALS-FRESH.txt << EOF
=== OZONE FRESH START - $(date) ===

Labeler Account:
- DID: ${NEW_DID}
- Handle: ${NEW_HANDLE}
- Bluesky Password: [YOU NEED TO SAVE THIS YOURSELF]

Ozone Configuration:
- Signing Key: ${NEW_SIGNING_KEY}
- Admin Password: ${NEW_ADMIN_PASSWORD}
- Database Password: ${NEW_DB_PASSWORD}

URLs:
- Ozone Web UI: https://ozone.atls.city
- Public Labeler Endpoint: https://ozone.atls.city

Login to Ozone:
- Use your Bluesky handle: ${NEW_HANDLE}
- Use your Bluesky password (the one you created the account with)

IMPORTANT: Ozone authenticates through Bluesky, so you MUST use your
Bluesky account credentials to login to the Ozone web interface.
EOF

echo ""
echo "=== Step 8: Starting Ozone ==="
docker compose up -d

echo ""
echo "=== FRESH START COMPLETE! ==="
echo ""
echo "✓ Credentials saved to: /ATlas/ozone/NEW-CREDENTIALS-FRESH.txt"
echo ""
echo "IMPORTANT INFORMATION:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Labeler DID:     ${NEW_DID}"
echo "Labeler Handle:  ${NEW_HANDLE}"
echo "Signing Key:     ${NEW_SIGNING_KEY}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "NEXT STEPS:"
echo "1. Wait 30 seconds for containers to start"
echo "2. Check logs: docker compose logs -f ozone"
echo "3. Login at: https://ozone.atls.city"
echo "   - Use handle: ${NEW_HANDLE}"
echo "   - Use your Bluesky account password"
echo ""
echo "4. You need to set up the labeler service on your Bluesky account:"
echo "   - This tells Bluesky where to find your labeler"
echo "   - Endpoint should be: https://ozone.atls.city"
echo ""
