#!/bin/bash

LABELER_DID="did:plc:l37i5se642dgeb7kmrdwoqv4"
PDS_URL="https://bsky.social"
HANDLE="atls.city"
PASSWORD="giad-atw2-urz4-palz"

# Login
echo "Logging in..."
SESSION=$(curl -s -X POST "$PDS_URL/xrpc/com.atproto.server.createSession" \
  -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$HANDLE\",\"password\":\"$PASSWORD\"}")

ACCESS_TOKEN=$(echo $SESSION | grep -o '"accessJwt":"[^"]*' | cut -d'"' -f4)
DID=$(echo $SESSION | grep -o '"did":"[^"]*' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "Login failed"
  echo "$SESSION"
  exit 1
fi

echo "Logged in as $DID"

# Query labels - try without uriPatterns to see what's required
echo "Fetching labels..."
LABELS=$(curl -s "$PDS_URL/xrpc/com.atproto.label.queryLabels?sources=$LABELER_DID" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "$LABELS" | jq .

echo ""
echo "To negate labels, you need to use the Ozone admin interface or AT Protocol SDK"
echo "Labels found above. Manual deletion required through proper labeler service."
