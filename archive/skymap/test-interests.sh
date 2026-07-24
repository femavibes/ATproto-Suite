#!/bin/bash
# Interests System Test Script

echo "=== Testing Interests System ==="
echo ""

# Test 1: Check database schema
echo "Test 1: Database Schema"
docker exec skymap-postgres-1 psql -h localhost -p 5435 -U dev -d skymap -c "SELECT COUNT(*) as categories FROM interest_categories WHERE active = true;" 2>&1 | grep -A1 "categories"
docker exec skymap-postgres-1 psql -h localhost -p 5435 -U dev -d skymap -c "SELECT COUNT(*) as interests FROM interests WHERE active = true;" 2>&1 | grep -A1 "interests"
echo ""

# Test 2: Check AT Protocol proxy
echo "Test 2: AT Protocol Proxy - Interest Lists"
curl -s "http://localhost:3010/xrpc/app.bsky.graph.getList?list=at://did:web:lists.fema.monster/app.bsky.graph.list/photography" | jq -r '.name // "ERROR"'
echo ""

# Test 3: Check admin API
echo "Test 3: Admin API - List Categories"
curl -s "http://localhost:3009/api/admin/interests/categories" | jq 'length'
echo ""

# Test 4: Check public API
echo "Test 4: Public API - List Interests"
curl -s "http://localhost:3008/api/interests/public" | jq 'length'
echo ""

# Test 5: Check bot is running
echo "Test 5: Bot Status"
docker ps --filter "name=command-bot" --format "{{.Status}}" | head -1
echo ""

# Test 6: Sample interests by category
echo "Test 6: Sample Interests by Category"
docker exec skymap-postgres-1 psql -h localhost -p 5435 -U dev -d skymap -c "
SELECT ic.name as category, COUNT(i.id) as count 
FROM interest_categories ic 
LEFT JOIN interests i ON ic.id = i.category_id AND i.active = true 
WHERE ic.active = true 
GROUP BY ic.name 
ORDER BY ic.sort_order;" 2>&1 | grep -A10 "category"
echo ""

# Test 7: Check config values
echo "Test 7: Config Values"
docker exec skymap-postgres-1 psql -h localhost -p 5435 -U dev -d skymap -c "SELECT key, value FROM config WHERE key IN ('max_interests_per_user', 'max_tags_per_event');" 2>&1 | grep -A3 "key"
echo ""

echo "=== Test Complete ==="
