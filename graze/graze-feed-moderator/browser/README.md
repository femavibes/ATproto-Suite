# Bluesky Feed Moderator Extension

A browser extension that adds moderation controls directly to bsky.app.

## Features

- **Post-level moderation**: Ban users and remove posts directly from the timeline
- **Profile moderation**: Ban/unban users from profile pages
- **Feed targeting**: Choose specific feeds or apply to all feeds
- **Real-time notifications**: Get feedback on moderation actions

## Installation

1. Download or clone this extension
2. Open Chrome/Edge and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The extension icon should appear in your toolbar

## Setup

1. Click the extension icon in your toolbar
2. Get an API key from your Feed Moderator web app (Settings → API Keys)
3. Enter your API key and server URL in the extension popup
4. Click "Test Connection" to verify everything works
5. Visit bsky.app and start moderating!

## Usage

### On Posts
- Look for the 🛡️ button next to post actions
- Click to see moderation options:
  - Ban User (from global list)
  - Remove Post (from configured feeds)
  - Remove from All Feeds

### On Profiles
- Visit any profile page on bsky.app
- Look for the "🛡️ Feed Moderator" panel
- Use buttons to ban/unban from global or all feeds

## Security

- API keys are stored securely in browser sync storage
- All requests use HTTPS
- No sensitive data is logged or transmitted beyond your API calls

## Troubleshooting

- Make sure you have a valid API key from the web app
- Check that your server URL is correct (usually https://modmaster.fema.monster)
- Try refreshing bsky.app after changing settings
- Check browser console for any error messages