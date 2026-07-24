#!/bin/bash

# Build the zero-trust authentication proxy Docker image

echo "🔨 Building zero-trust authentication proxy..."

docker build -t feedmoderator/auth-proxy:latest .

echo "✅ Build complete!"
echo ""
echo "To run the proxy:"
echo "docker run -d -p 3550:3550 \\"
echo "  -e BLUESKY_HANDLE=your-handle.bsky.social \\"
echo "  -e BLUESKY_PASSWORD=your-app-password \\"
echo "  -v feedmod-proxy-data:/app/data \\"
echo "  feedmoderator/auth-proxy:latest"
