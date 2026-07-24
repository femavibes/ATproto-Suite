#!/bin/bash
# Update script for SkyMap VPS deployment
# Pulls latest code from git and restarts services as needed

# Don't exit on error - we'll handle errors manually
set +e

echo "🔄 Updating SkyMap from git..."

# Get project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# Skip git operations on postgres files by using sparse-checkout
if [ ! -f ".git/info/sparse-checkout" ]; then
    git config core.sparseCheckout true
    echo "/*" > .git/info/sparse-checkout
    echo "!ozone/postgres/" >> .git/info/sparse-checkout
    echo "!ozone/caddy/data/" >> .git/info/sparse-checkout
fi

# Pull latest changes without checking working tree
echo "📥 Pulling latest changes from git..."
PULL_SUCCESS=true
if ! GIT_OPTIONAL_LOCKS=0 git fetch origin master 2>&1 || \
   ! GIT_OPTIONAL_LOCKS=0 git reset --hard origin/master 2>&1; then
    PULL_SUCCESS=false
    echo "⚠️  Git pull had issues."
fi

if [ "$PULL_SUCCESS" = false ]; then
    echo "❌ Update failed. Please resolve conflicts manually."
    exit 1
fi

# Always rebuild to pick up code changes (no volume mounts)
echo "🏗️  Rebuilding Docker images..."
docker compose build

# Restart services
echo "🔄 Restarting services..."
docker compose up -d --force-recreate

echo ""
echo "✅ Update complete!"
echo ""
echo "Services status:"
docker compose ps --format "table {{.Service}}\t{{.Status}}"
