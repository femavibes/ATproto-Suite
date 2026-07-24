#!/bin/bash

# Environment Configuration Verification Script
# This script checks if environment variables are properly configured

echo "=================================="
echo "Environment Configuration Check"
echo "=================================="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ ERROR: .env file not found!"
    echo "   Please create .env file from .env.example"
    exit 1
fi

echo "✅ .env file exists"
echo ""

# Check required environment variables
echo "Checking required environment variables..."
echo ""

required_vars=("BASE_URL" "ADMIN_URL" "APP_NAME" "BLUESKY_HANDLE" "BLUESKY_PASSWORD" "DATABASE_URL")

missing_vars=()

for var in "${required_vars[@]}"; do
    value=$(grep "^${var}=" .env | cut -d '=' -f2-)
    if [ -z "$value" ]; then
        echo "❌ $var: NOT SET"
        missing_vars+=("$var")
    else
        # Mask sensitive values
        if [[ "$var" == *"PASSWORD"* ]] || [[ "$var" == *"KEY"* ]]; then
            echo "✅ $var: ********"
        else
            echo "✅ $var: $value"
        fi
    fi
done

echo ""

if [ ${#missing_vars[@]} -gt 0 ]; then
    echo "❌ ERROR: Missing required variables: ${missing_vars[*]}"
    echo "   Please update .env file"
    exit 1
fi

echo "✅ All required variables are set"
echo ""

# Check if Docker containers are running
echo "Checking Docker containers..."
echo ""

containers=("skymap-web-directory-1" "skymap-admin-1" "skymap-postgres-1")

for container in "${containers[@]}"; do
    if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        echo "✅ $container: Running"
    else
        echo "❌ $container: Not running"
    fi
done

echo ""

# Check environment variables in running containers
echo "Checking environment variables in containers..."
echo ""

if docker ps --format '{{.Names}}' | grep -q "^skymap-web-directory-1$"; then
    echo "Web Directory Container:"
    docker exec skymap-web-directory-1 env | grep -E "^(BASE_URL|ADMIN_URL|APP_NAME)=" | while read line; do
        echo "  $line"
    done
    echo ""
fi

if docker ps --format '{{.Names}}' | grep -q "^skymap-admin-1$"; then
    echo "Admin Container:"
    docker exec skymap-admin-1 env | grep -E "^(BASE_URL|ADMIN_URL|APP_NAME)=" | while read line; do
        echo "  $line"
    done
    echo ""
fi

# Test endpoints
echo "Testing endpoints..."
echo ""

# Test web directory
if curl -s http://localhost:3008/api/bot-handle > /dev/null 2>&1; then
    handle=$(curl -s http://localhost:3008/api/bot-handle | grep -o '"handle":"[^"]*"' | cut -d'"' -f4)
    echo "✅ Web Directory API: Responding (handle: $handle)"
else
    echo "❌ Web Directory API: Not responding"
fi

# Test admin
if curl -s http://localhost:3009/api/auth/session > /dev/null 2>&1; then
    echo "✅ Admin API: Responding"
else
    echo "❌ Admin API: Not responding"
fi

echo ""
echo "=================================="
echo "Configuration check complete!"
echo "=================================="
echo ""

# Provide recommendations
echo "Recommendations:"
echo "1. If containers are not running: docker-compose up -d"
echo "2. If env vars are not loaded: docker-compose restart"
echo "3. If APIs are not responding: docker-compose logs -f"
echo ""
echo "For detailed troubleshooting, see SYNC_STRATEGY.md"
