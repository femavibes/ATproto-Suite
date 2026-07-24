#!/bin/bash
set -e

echo "=== Ozone Reset Script ==="
echo "This will reset your Ozone installation for a new labeler account"
echo ""

# Stop containers
echo "1. Stopping Ozone containers..."
cd /ATlas/ozone
docker compose down

# Clear database
echo "2. Clearing database..."
rm -rf /ATlas/ozone/postgres/*

# Generate new signing key
echo "3. Generating new signing key..."
NEW_SIGNING_KEY=$(openssl rand -hex 32)
echo "New signing key: $NEW_SIGNING_KEY"

# Prompt for new account details
echo ""
echo "4. Please provide your NEW Bluesky labeler account details:"
read -p "Enter the DID of your new account (e.g., did:plc:xxxxx): " NEW_DID
read -p "Enter the handle of your new account (e.g., labeler.bsky.social): " NEW_HANDLE

# Backup old config
echo ""
echo "5. Backing up old configuration..."
cp ozone.env ozone.env.backup.$(date +%Y%m%d_%H%M%S)

# Update ozone.env
echo "6. Updating ozone.env with new credentials..."
cat > ozone.env << EOF
# Labeler Account Configuration
OZONE_SERVER_DID=${NEW_DID}
OZONE_PUBLIC_URL=https://ozoneskymap.fema.monster
OZONE_ADMIN_DIDS=${NEW_DID}
OZONE_ADMIN_PASSWORD=$(openssl rand -hex 16)
OZONE_SIGNING_KEY_HEX=${NEW_SIGNING_KEY}
OZONE_DB_POSTGRES_URL=postgresql://postgres:$(openssl rand -hex 16)@localhost:5432/ozone
OZONE_DB_MIGRATE=1
OZONE_DID_PLC_URL=https://plc.directory
OZONE_APPVIEW_URL=https://api.bsky.app
OZONE_APPVIEW_DID=did:web:api.bsky.app
LOG_ENABLED=1
EOF

# Update postgres.env
echo "7. Updating postgres.env..."
POSTGRES_PASSWORD=$(grep "OZONE_DB_POSTGRES_URL" ozone.env | cut -d':' -f4 | cut -d'@' -f1)
cat > postgres.env << EOF
POSTGRES_USER=postgres
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=ozone
EOF

echo ""
echo "8. Starting Ozone with new configuration..."
docker compose up -d

echo ""
echo "=== Reset Complete! ==="
echo ""
echo "IMPORTANT: Save these credentials securely!"
echo "----------------------------------------"
echo "Labeler DID: ${NEW_DID}"
echo "Labeler Handle: ${NEW_HANDLE}"
echo "Signing Key: ${NEW_SIGNING_KEY}"
echo "Admin Password: $(grep OZONE_ADMIN_PASSWORD ozone.env | cut -d'=' -f2)"
echo "Ozone URL: https://ozoneskymap.fema.monster"
echo ""
echo "Next steps:"
echo "1. Wait for containers to start (check with: docker compose logs -f)"
echo "2. Log into Ozone at https://ozoneskymap.fema.monster"
echo "3. Verify the labeler service record exists on your Bluesky account"
echo "4. Test reporting from Bluesky"
echo ""
