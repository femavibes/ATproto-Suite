#!/bin/bash

# Daily Content Bot Deployment Script

set -e

echo "🚀 Daily Content Bot Deployment"
echo "================================"

# Check if we're in the right directory
if [ ! -f "daily-content-bot.js" ]; then
    echo "❌ Error: daily-content-bot.js not found. Are you in the right directory?"
    exit 1
fi

# Initialize data files
echo "📁 Initializing data files..."
./init-data.sh

# Set proper permissions
echo "🔒 Setting up permissions..."
chmod 755 data uploads public
find data -type f -exec chmod 644 {} \; 2>/dev/null || true
find uploads -type f -exec chmod 644 {} \; 2>/dev/null || true

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found. Copying from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "📝 Please edit .env with your actual credentials before continuing."
        exit 1
    else
        echo "❌ Error: No .env.example found either. Please create .env file."
        exit 1
    fi
fi

# Choose deployment type
echo ""
echo "Choose deployment type:"
echo "1) Development (build locally)"
echo "2) Production (use GitHub image)"
read -p "Enter choice (1 or 2): " choice

case $choice in
    1)
        echo "🔨 Building and starting development environment..."
        docker-compose -f docker-compose.dev.yml down
        docker-compose -f docker-compose.dev.yml build --no-cache
        docker-compose -f docker-compose.dev.yml up -d
        ;;
    2)
        echo "📦 Starting production environment..."
        echo "⚠️  Make sure to update the image name in docker-compose.prod.yml"
        docker-compose -f docker-compose.prod.yml down
        docker-compose -f docker-compose.prod.yml pull
        docker-compose -f docker-compose.prod.yml up -d
        ;;
    *)
        echo "❌ Invalid choice. Exiting."
        exit 1
        ;;
esac

echo ""
echo "✅ Deployment complete!"
echo "🌐 Bot should be available at http://localhost:3000"
echo "📊 Check logs with: docker-compose logs -f daily-content-bot"
echo ""
echo "📋 Next steps:"
echo "   1. Visit http://localhost:3000 to configure the bot"
echo "   2. Add your Bluesky credentials in settings"
echo "   3. Import or add your quotes and words"
echo ""