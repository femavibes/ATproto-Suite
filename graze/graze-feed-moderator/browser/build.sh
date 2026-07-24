#!/bin/bash

# Simple build script for Bluesky Feed Moderator Extension

echo "Building Bluesky Feed Moderator Extension..."

# Create build directory
mkdir -p build

# Copy all necessary files
cp manifest.json build/
cp content.js build/
cp popup.html build/
cp popup.js build/
cp background.js build/
cp styles.css build/
cp README.md build/
cp -r icons build/ 2>/dev/null || echo "No icons directory found, skipping..."

# Create a simple icon if none exists
if [ ! -d "build/icons" ]; then
  mkdir -p build/icons
  # Create placeholder icon files (you'll need to replace these with actual PNG files)
  echo "Creating placeholder icon files..."
  echo "Replace these with actual PNG icons:" > build/icons/README.txt
  echo "- icon16.png (16x16)" >> build/icons/README.txt
  echo "- icon48.png (48x48)" >> build/icons/README.txt
  echo "- icon128.png (128x128)" >> build/icons/README.txt
fi

# Create zip file for distribution
cd build
zip -r ../bluesky-moderator-extension.zip .
cd ..

echo "Extension built successfully!"
echo "Files are in the 'build' directory"
echo "Distribution zip: bluesky-moderator-extension.zip"
echo ""
echo "To install:"
echo "1. Open Chrome/Edge and go to chrome://extensions/"
echo "2. Enable 'Developer mode'"
echo "3. Click 'Load unpacked' and select the 'build' directory"