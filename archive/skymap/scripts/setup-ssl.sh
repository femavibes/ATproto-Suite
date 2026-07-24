#!/bin/bash
# SSL certificate setup script for VPS deployment
# Run this AFTER DNS is pointing to your VPS and Nginx is configured

set -e

echo "🔒 Setting up SSL certificates..."

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run with sudo"
    exit 1
fi

# Check if Certbot is installed
if ! command -v certbot &> /dev/null; then
    echo "📦 Installing Certbot..."
    apt update
    apt install certbot python3-certbot-nginx -y
else
    echo "✅ Certbot is already installed"
fi

# Check DNS resolution
echo "🌐 Checking DNS resolution..."
if ! dig +short ATls.city | grep -q .; then
    echo "⚠️  Warning: ATls.city DNS may not be pointing to this server yet"
    echo "   Continuing anyway, but certificate may fail if DNS isn't ready"
fi

if ! dig +short lists.fema.monster | grep -q .; then
    echo "⚠️  Warning: lists.fema.monster DNS may not be pointing to this server yet"
    echo "   Continuing anyway, but certificate may fail if DNS isn't ready"
fi

# Get certificates
echo ""
echo "📜 Getting SSL certificate for ATls.city..."
certbot --nginx -d ATls.city -d www.ATls.city --non-interactive --agree-tos --email admin@ATls.city || {
    echo "❌ Failed to get certificate for ATls.city"
    echo "   Make sure DNS is pointing to this server and port 80 is accessible"
    exit 1
}

echo ""
echo "📜 Getting SSL certificate for lists.fema.monster..."
certbot --nginx -d lists.fema.monster --non-interactive --agree-tos --email admin@ATls.city || {
    echo "❌ Failed to get certificate for lists.fema.monster"
    echo "   Make sure DNS is pointing to this server and port 80 is accessible"
    exit 1
}

# Test auto-renewal
echo ""
echo "🧪 Testing certificate auto-renewal..."
certbot renew --dry-run

echo ""
echo "✅ SSL setup complete!"
echo ""
echo "Your sites should now be accessible via HTTPS:"
echo "  - https://ATls.city"
echo "  - https://lists.fema.monster"
echo ""
echo "Certificates will auto-renew. Test renewal with: sudo certbot renew --dry-run"
