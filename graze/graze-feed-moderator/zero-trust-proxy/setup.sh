#!/bin/bash

echo "🔐 Setting up your personal decryption service..."

# Generate secret key
USER_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Create .env file
cat > .env << EOF
USER_SECRET=${USER_SECRET}
PORT=3001
EOF

echo "✅ Generated your secret key"
echo "🔑 Secret: ${USER_SECRET}"
echo ""
echo "🚀 Starting your service..."

# Start with docker-compose
docker-compose up -d

echo ""
echo "✅ Your decryption service is running!"
echo "🌐 Service URL: http://$(curl -s ifconfig.me):3001"
echo "🏠 Local URL: http://localhost:3001"
echo ""
echo "📋 Next steps:"
echo "1. Test: curl http://localhost:3001/health"
echo "2. Give feed-moderator your service URL"
echo "3. Register with enhanced security enabled"