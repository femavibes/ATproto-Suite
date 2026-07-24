# GitHub Repository Setup Instructions

## Step 1: Create GitHub Repository

1. Go to https://github.com
2. Click the "+" icon → "New repository"
3. Repository name: `bluesky-moderator-extension`
4. Description: `Browser extension for moderating Bluesky content directly from bsky.app`
5. Make it **Public** (so others can easily download)
6. Don't initialize with README (we already have one)
7. Click "Create repository"

## Step 2: Push Code to GitHub

Run these commands on your server:

```bash
cd /root/modmaster-browser

# Add your GitHub repo as remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/modmaster-browser.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step 3: Create First Release

1. Go to your GitHub repo page
2. Click "Releases" → "Create a new release"
3. Tag version: `v1.0.0`
4. Release title: `v1.0.0 - Initial Release`
5. Description:
   ```
   🎉 First release of Bluesky Feed Moderator Extension!
   
   ## Features
   - Ban users directly from posts and profiles
   - Remove posts from your feeds
   - Real-time notifications
   - Secure API key storage
   
   ## Installation
   1. Download the ZIP file below
   2. Extract it
   3. Go to chrome://extensions/
   4. Enable Developer mode
   5. Click "Load unpacked" and select the folder
   ```
6. Click "Publish release"

## Step 4: Easy Deployment Options

### Option A: Direct Download
Users can click "Code" → "Download ZIP" on your repo

### Option B: Releases (Recommended)
- GitHub Actions will automatically create ZIP files
- Users download from Releases page
- Cleaner and more professional

### Option C: Clone
```bash
git clone https://github.com/YOUR_USERNAME/modmaster-browser.git
```

## Step 5: Update README

After creating the repo, update the README.md file to replace:
- `YOUR_USERNAME` with your actual GitHub username
- Any other placeholder URLs

## Benefits of GitHub Hosting

✅ **Easy Downloads**: Users can download ZIP directly
✅ **Version Control**: Track changes and releases
✅ **Issues**: Users can report bugs
✅ **Automatic Builds**: GitHub Actions create release ZIPs
✅ **Professional**: Looks more trustworthy than random file sharing
✅ **Free**: GitHub is free for public repos

## Testing on Windows

Once uploaded to GitHub, you can:
1. Go to the repo on any Windows PC
2. Download ZIP
3. Extract and install in Chrome/Edge
4. Test all functionality

This is much easier than trying to transfer files manually!