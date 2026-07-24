#!/bin/bash

# ModMaster Browser Extension Installer/Updater
# Usage: curl -sSL https://raw.githubusercontent.com/femavibes/modmaster-browser/main/install.sh | bash

set -e

REPO="femavibes/modmaster-browser"
INSTALL_DIR="$HOME/Downloads/modmaster-browser"

echo "🛡️ ModMaster Browser Extension Installer"
echo "========================================="

# Get latest release
echo "Fetching latest release..."
LATEST_TAG=$(curl -s "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')

if [ -z "$LATEST_TAG" ]; then
    echo "❌ Failed to get latest release"
    exit 1
fi

echo "Latest version: $LATEST_TAG"

# Download and extract
echo "Downloading extension..."
curl -L "https://github.com/$REPO/archive/refs/tags/$LATEST_TAG.zip" -o "/tmp/modmaster-browser.zip"

# Clean up old installation
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

# Extract
echo "Extracting..."
unzip -q "/tmp/modmaster-browser.zip" -d "/tmp/"
mv "/tmp/modmaster-browser-${LATEST_TAG#v}"/* "$INSTALL_DIR/"

# Clean up
rm "/tmp/modmaster-browser.zip"
rm -rf "/tmp/modmaster-browser-${LATEST_TAG#v}"

echo "✅ Extension downloaded to: $INSTALL_DIR"
echo ""
echo "📋 Next steps:"
echo "1. Open Chrome and go to chrome://extensions/"
echo "2. Enable 'Developer mode' (top right)"
echo "3. Click 'Load unpacked' and select: $INSTALL_DIR"
echo "4. Configure your API key in the extension popup"
echo ""
echo "🔄 To update later, just run this script again!"