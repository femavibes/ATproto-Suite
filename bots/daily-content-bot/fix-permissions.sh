#!/bin/bash

# Fix permissions for daily-content-bot uploads
echo "Fixing permissions for daily-content-bot..."

# Create uploads directory if it doesn't exist
mkdir -p uploads public

# Set proper ownership and permissions
sudo chown -R 1000:1000 uploads public
chmod -R 755 uploads public

# Fix any existing uploaded files
if [ -d "uploads" ]; then
    find uploads -type f -exec chmod 644 {} \;
    find uploads -type d -exec chmod 755 {} \;
fi

echo "Permissions fixed!"
echo "Now rebuild and restart your container:"
echo "docker-compose down"
echo "docker-compose build --no-cache"
echo "docker-compose up -d"