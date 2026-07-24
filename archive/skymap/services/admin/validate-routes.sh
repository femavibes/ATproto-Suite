#!/bin/bash
# Validates all admin endpoints are registered and responding
# A 302 (redirect to login) or 200 or 400/401/403 means the route EXISTS
# A 404 means the route is MISSING (bad)
# A 500 could mean route exists but has a bug, or server crashed

BASE="http://localhost:3009"
PASS=0
FAIL=0
ERRORS=""

check() {
  METHOD=$1
  PATH=$2
  EXPECT_MIN=$3  # minimum acceptable status (usually 200)
  EXPECT_MAX=$4  # maximum acceptable status (usually 403, since no auth)
  
  if [ "$METHOD" = "GET" ]; then
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$PATH")
  else
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X "$METHOD" -H "Content-Type: application/json" -d '{}' "$BASE$PATH")
  fi
  
  if [ "$STATUS" -ge "$EXPECT_MIN" ] && [ "$STATUS" -le "$EXPECT_MAX" ]; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  FAIL: $METHOD $PATH -> $STATUS (expected $EXPECT_MIN-$EXPECT_MAX)"
  fi
}

echo "=== ATlas Admin Route Validation ==="
echo ""

# Auth endpoints (no auth required for these)
check GET  "/api/auth/session" 200 200
check POST "/api/auth/login" 400 400
check POST "/api/auth/logout" 200 200

# Protected endpoints - expect 302 redirect to /login since we have no session
# Static/HTML pages
check GET "/" 200 302
check GET "/login" 200 200
check GET "/lists.html" 200 302
check GET "/whitelist.html" 200 302
check GET "/feeds.html" 200 302
check GET "/ingestion.html" 200 302
check GET "/users.html" 200 302
check GET "/location-display.html" 200 302
check GET "/eventmanager.html" 200 302
check GET "/interests.html" 200 302
check GET "/backups.html" 200 302
check GET "/refactor" 200 302
check GET "/favicon.ico" 200 204
check GET "/graze-session.js" 200 200

# API endpoints - all should return 302 (redirect) since no auth
# Locations
check GET  "/api/locations" 200 302
check GET  "/api/locations/test/users" 200 302
check GET  "/api/locations/test/check-user?handle=test" 200 302
check GET  "/api/locations/test/check-user-continued?handle=test" 200 302
check DELETE "/api/locations/test/users/test" 200 302
check DELETE "/api/locations/1/inactive-lists" 200 302

# Hashtags
check POST   "/api/hashtags" 200 302
check DELETE  "/api/hashtags" 200 302

# Config
check GET  "/api/config" 200 302
check POST "/api/config" 200 302

# Ingestion
check GET  "/api/ingestion/status" 200 302
check POST "/api/ingestion/update-feed-uri" 200 302
check POST "/api/ingestion/restart-listener" 200 302
check POST "/api/ingestion/reset-cursor" 200 302
check GET  "/api/ingestion/recent-activity" 200 302
check GET  "/api/ingestion/logs" 200 302

# Parsers
check POST "/api/parse-geoapify" 200 302
check POST "/api/parse-us" 200 302
check POST "/api/parse-canada" 200 302

# Lists
check POST   "/api/create-lists" 200 302
check POST   "/api/create-list/1" 200 302
check DELETE  "/api/lists/1" 200 302

# Graze
check GET  "/api/graze-nodes/CA" 200 302
check POST "/api/graze-feed" 200 302
check POST "/api/graze-login" 200 302
check GET  "/api/graze-session" 200 302
check GET  "/api/generate-hashtag-feed" 200 302
check GET  "/api/graze-feeds" 200 302
check DELETE "/api/graze-feeds/1" 200 302
check POST "/api/push-to-graze/CA" 200 302
check POST "/api/set-node-id" 200 302
check POST "/api/set-graze-component-id" 200 302
check POST "/api/push-all-to-graze" 200 302
check GET  "/api/graze-heatmap-node" 200 302
check POST "/api/push-heatmap-to-graze" 200 302
check POST "/api/update-feed" 200 302
check POST "/api/create-feed" 200 302

# Stats/regions/countries
check GET "/api/stats" 200 302
check GET "/api/countries" 200 302
check GET "/api/geoapify-countries" 200 302
check GET "/api/regions-by-country" 200 302
check GET "/api/regions" 200 302
check GET "/api/regions/CA/cities-without-lists" 200 302
check GET "/api/regions/CA/cities" 200 302
check GET "/api/cities-for-search" 200 302

# Users
check GET  "/api/all-locations" 200 302
check GET  "/api/user-labels?handle=test" 200 302
check POST "/api/admin/user-labels" 200 302
check DELETE "/api/admin/user-labels" 200 302
check POST "/api/admin/set-primary-location" 200 302
check POST "/api/admin/set-max-labels" 200 302
check POST "/api/admin/bulk-import-labels" 200 302
check GET  "/api/admin/all-users" 200 302

# Images
check POST "/api/admin/location-images" 200 302
check POST "/api/admin/user-profile-image" 200 302
check GET  "/api/image-requests" 200 302
check POST "/api/image-requests/1/approve" 200 302
check POST "/api/image-requests/1/deny" 200 302
check POST "/api/admin/upload-image" 200 302
check GET  "/api/admin/reported-images" 200 302
check POST "/api/admin/reported-images/1/review" 200 302

# Labels
check GET  "/api/admin/label-requests" 200 302
check POST "/api/admin/label-requests/1/review" 200 302

# Whitelist
check GET  "/api/whitelist" 200 302
check POST "/api/whitelist/add" 200 302
check POST "/api/whitelist/remove" 200 302

# Backups
check GET  "/api/backups" 200 302
check GET  "/api/backups/download?database=test&type=daily&filename=test" 200 302
check GET  "/api/backups/schedule" 200 302
check GET  "/api/backups/status" 200 302
check GET  "/api/backups/logs" 200 302
check POST "/api/backups/trigger" 200 302
check POST "/api/backups/schedule" 200 302

# Proxy
check GET "/api/proxy/web-directory/api/test" 200 302

# Already-extracted routes
check GET "/api/location-display" 200 302
check GET "/api/admin/interests" 200 302
check GET "/api/admin/interests/categories" 200 302

echo ""
echo "=== Results ==="
echo "PASS: $PASS"
echo "FAIL: $FAIL"
if [ $FAIL -gt 0 ]; then
  echo -e "\nFailures:$ERRORS"
fi
echo ""
