#!/bin/bash

OZONE_URL="http://localhost:3000"
PDS_URL="https://bsky.social"
HANDLE="atls.city"
PASSWORD="giad-atw2-urz4-palz"
TARGET_DID="did:plc:nyz2ssqxd3g72lpmdrfrsc74"
LABEL_VAL="us-or-corvallis"

echo "Logging in to local Ozone..."
SESSION=$(curl -s -X POST "$OZONE_URL/xrpc/com.atproto.server.createSession" \
  -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$HANDLE\",\"password\":\"$PASSWORD\"}")

ACCESS_TOKEN=$(echo $SESSION | grep -o '"accessJwt":"[^"]*' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "Login failed"
  exit 1
fi

echo "Logged in. Negating label via local Ozone..."

curl -v -X POST "$OZONE_URL/xrpc/tools.ozone.moderation.emitEvent" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"event\": {
      \"\$type\": \"tools.ozone.moderation.defs#modEventLabel\",
      \"createLabelVals\": [],
      \"negateLabelVals\": [\"$LABEL_VAL\"]
    },
    \"subject\": {
      \"\$type\": \"com.atproto.admin.defs#repoRef\",
      \"did\": \"$TARGET_DID\"
    },
    \"createdBy\": \"did:plc:l37i5se642dgeb7kmrdwoqv4\"
  }"

echo ""
