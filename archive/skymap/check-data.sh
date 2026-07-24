#!/bin/bash
export PGPASSWORD=devpass
echo "=== HASHTAG MAPPINGS ==="
psql -h localhost -p 5435 -U dev -d skymap -c "SELECT h.hashtag, l.name, l.region_name FROM hashtag_mappings h JOIN locations l ON h.location_id = l.id WHERE l.name IN ('New York City', 'Portland', 'San Francisco', 'Los Angeles', 'Chicago', 'Seattle') ORDER BY l.name, h.hashtag;"

echo ""
echo "=== LOCATION POST STATS (7 day counts) ==="
psql -h localhost -p 5435 -U dev -d skymap -c "SELECT l.name, l.region_name, s.post_count_1h, s.post_count_6h, s.post_count_24h, s.post_count_7d, s.last_post_at FROM location_post_stats s JOIN locations l ON s.location_id = l.id WHERE l.name IN ('New York City', 'Portland', 'San Francisco', 'Los Angeles', 'Chicago', 'Seattle') ORDER BY s.post_count_7d DESC;"

echo ""
echo "=== ALL STATS WITH COUNTS > 0 ==="
psql -h localhost -p 5435 -U dev -d skymap -c "SELECT l.name, l.region_name, s.post_count_7d, s.last_post_at FROM location_post_stats s JOIN locations l ON s.location_id = l.id WHERE s.post_count_7d > 0 ORDER BY s.post_count_7d DESC LIMIT 20;"
