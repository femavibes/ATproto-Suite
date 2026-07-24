#!/bin/bash
# Nginx setup script for VPS deployment
# Run this on your VPS after deploying the codebase

set -e

echo "🔧 Setting up Nginx for SkyMap..."

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run with sudo"
    exit 1
fi

# Check if Nginx is installed
if ! command -v nginx &> /dev/null; then
    echo "📦 Installing Nginx..."
    apt update
    apt install nginx -y
else
    echo "✅ Nginx is already installed"
fi

# Get project directory (assumes script is in project root or scripts/)
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NGINX_DIR="$PROJECT_DIR/nginx"

if [ ! -d "$NGINX_DIR" ]; then
    echo "❌ Nginx config directory not found: $NGINX_DIR"
    exit 1
fi

# Copy configuration files
echo "📋 Copying Nginx configuration files..."
cp "$NGINX_DIR/ATls.city.conf" /etc/nginx/sites-available/
cp "$NGINX_DIR/lists.fema.monster.conf" /etc/nginx/sites-available/
cp "$NGINX_DIR/admin.ATls.city.conf" /etc/nginx/sites-available/ 2>/dev/null || echo "Note: admin.ATls.city.conf not found (optional)"

# Enable sites
echo "🔗 Enabling sites..."
ln -sf /etc/nginx/sites-available/ATls.city.conf /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/lists.fema.monster.conf /etc/nginx/sites-enabled/
if [ -f /etc/nginx/sites-available/admin.ATls.city.conf ]; then
    ln -sf /etc/nginx/sites-available/admin.ATls.city.conf /etc/nginx/sites-enabled/
fi

# Remove default Nginx site (optional)
if [ -f /etc/nginx/sites-enabled/default ]; then
    echo "🗑️  Removing default Nginx site..."
    rm /etc/nginx/sites-enabled/default
fi

# Test configuration
echo "🧪 Testing Nginx configuration..."
if nginx -t; then
    echo "✅ Nginx configuration is valid"
else
    echo "❌ Nginx configuration test failed"
    exit 1
fi

# Reload Nginx
echo "🔄 Reloading Nginx..."
systemctl reload nginx

echo ""
echo "✅ Nginx setup complete!"
echo ""
echo "Next steps:"
echo "1. Update DNS to point to this server's IP"
echo "2. Wait for DNS propagation (5-60 minutes)"
echo "3. Run SSL setup: sudo ./scripts/setup-ssl.sh"
echo ""
echo "Test with: curl http://localhost (should proxy to your app)"
