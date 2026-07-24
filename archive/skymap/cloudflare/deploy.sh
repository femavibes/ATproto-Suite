#!/bin/bash

# Deploy SkyMap services to Cloudflare Workers

echo "Deploying SkyMap Admin to Cloudflare..."
cd /root/skymap/cloudflare
npx wrangler deploy admin-worker.js --config wrangler-admin.toml

echo "Deploying SkyMap Web Directory to Cloudflare..."
npx wrangler deploy web-worker.js --config wrangler-web.toml

echo "Deployment complete!"
echo "Admin: https://admin.ozoneskymap.fema.monster"
echo "Directory: https://directory.ozoneskymap.fema.monster"