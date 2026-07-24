#!/bin/bash

echo "=== Heatmap System Verification ==="
echo ""

echo "1. Checking database coordinates..."
COORDS=$(docker exec skymap-postgres-1 psql -U dev -d skymap -h localhost -p 5435 -t -c "SELECT COUNT(*) FROM locations WHERE latitude IS NOT NULL;")
echo "   Locations with coordinates: $COORDS"

echo ""
echo "2. Checking heatmap API..."
HEATMAP_COUNT=$(curl -s http://localhost:3008/api/heatmap-data?window=24h | python3 -c "import sys, json; print(len(json.load(sys.stdin)))" 2>/dev/null)
echo "   Heatmap locations returned: $HEATMAP_COUNT"

echo ""
echo "3. Sample heatmap data:"
curl -s http://localhost:3008/api/heatmap-data?window=24h | python3 -m json.tool | head -15

echo ""
echo "4. Checking web-directory service..."
docker ps --filter "name=web-directory" --format "   {{.Names}}: {{.Status}}"

echo ""
echo "5. Recent web-directory logs:"
docker logs skymap-web-directory-1 --tail 5 2>&1 | sed 's/^/   /'

echo ""
echo "=== Verification Complete ==="
echo ""
echo "Next: Open http://localhost:3008 and click Map tab, then 'Show Activity Heatmap'"
