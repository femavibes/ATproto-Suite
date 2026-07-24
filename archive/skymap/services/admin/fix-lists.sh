#!/bin/bash

# Fix graze-nodes endpoint (line 342-370)
sed -i '342,370s/COALESCE(array_agg(bl.list_url ORDER BY bl.bucket_number) FILTER (WHERE bl.list_url IS NOT NULL), '"'"'{}'"'"') as list_urls,//' server.js
sed -i '342,370s/LEFT JOIN bluesky_lists bl ON l.id = bl.location_id AND bl.active = true//' server.js
sed -i '342,370s/SELECT list_url FROM bluesky_lists WHERE location_id = \$1 AND active = true ORDER BY bucket_number/SELECT hashtag FROM hashtag_mappings WHERE location_id = \$1/' server.js
sed -i '342,370s/const regionListUrls = regionListsResult.rows.map(row => row.list_url);/const regionListUrl = `at:\/\/did:web:lists.fema.monster\/app.bsky.graph.list\/${region.key}`;/' server.js
sed -i '371,385s/const defaultListUrl.*/const stateListEntries = [{\n      metadata: { title: `STATE.001` },\n      list_member: [regionListUrl, "in"]\n    }];/' server.js
sed -i 's/regionListUrls\[0\] || defaultListUrl/regionListUrl/g' server.js
sed -i 's/city.list_urls\[0\] || defaultListUrl/cityListUrl/g' server.js
sed -i '446,460s/const cityListEntries = city.list_urls.length.*/const cityListUrl = `at:\/\/did:web:lists.fema.monster\/app.bsky.graph.list\/${city.key}`;\n              const cityListEntries = [{\n                metadata: { title: `${city.key}.001` },\n                list_member: [cityListUrl, "in"]\n              }];/' server.js

echo "Fixed server.js"
