# Post Media Display Feature Implementation

## Overview
Implementation of displaying user handles, display names, avatars, and media content (images, videos, embeds) in post previews for both trending removals and recent removal history sections.

## Completed Work

### User Profile Display ✅
- **Backend**: Added `user_profiles` and `posts` tables for caching user data
- **Backend**: Implemented `getPostDetails()` method in `BlueskyService` to fetch and cache post author information
- **Backend**: Added automatic profile updates when data is missing or older than 1 day
- **Frontend**: Added post preview component showing:
  - User avatar (32px circular)
  - Display name and handle (@username)
  - Post text content
- **API Integration**: Uses public Bluesky API endpoint `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor={did}`

### Database Schema
```sql
CREATE TABLE user_profiles (
    id SERIAL PRIMARY KEY,
    did TEXT UNIQUE NOT NULL,
    handle TEXT,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    post_uri TEXT UNIQUE NOT NULL,
    author_id INTEGER REFERENCES user_profiles(id),
    text_content TEXT,
    created_at TIMESTAMP,
    images JSONB,
    videos JSONB,
    embeds JSONB,
    reply_to TEXT,
    quote_post TEXT,
    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Frontend Components
- Added post preview to both trending removals and recent removal history
- Styled with consistent design matching existing UI
- Responsive layout with proper spacing and typography

## Partially Implemented - Media Display

### Current Status
- **External Embeds**: Partially working - shows title, description, URL but thumbnail images are broken
- **Images**: Not displaying - shows nothing instead of actual images
- **Videos**: Not implemented
- **Quote Posts**: Not implemented

### Issues Identified

#### Blob URL Construction Problem
The current blob URL construction is incorrect. We attempted:
```javascript
// INCORRECT - doesn't work
`https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${authorDid}&cid=${cid}`
```

#### Correct URL Examples Found
**For Images:**
```
https://morel.us-east.host.bsky.network/xrpc/com.atproto.sync.getBlob?did=did:plc:23tlora5pl4dkfheztxlaz55&cid=bafkreigpueojri7dvijnykpzn2rco7ybuycvhhceg6tzzouszfoboi6dqu
```

**For External Embed Thumbnails:**
```
https://button.us-west.host.bsky.network/xrpc/com.atproto.sync.getBlob?did=did:plc:2254h6xrj5ludbbbwpg5zkhw&cid=bafkreie56wulkobvl3dfzp75ul2rqz2p3vkwdxixdhme2ljdkv3dlvnlvu
```

#### Data Structure Examples

**Image Embed Structure:**
```json
{
  "$type": "app.bsky.embed.images",
  "images": [{
    "alt": "A little black cat sitting next to a Kobo with the cover of Nine Goblins by T. Kingfisher displayed",
    "image": {
      "$type": "blob",
      "ref": {
        "$link": "bafkreigpueojri7dvijnykpzn2rco7ybuycvhhceg6tzzouszfoboi6dqu"
      },
      "mimeType": "image/jpeg",
      "size": 918459
    },
    "aspectRatio": {
      "width": 1505,
      "height": 2000
    }
  }]
}
```

**External Embed Structure:**
```json
{
  "$type": "app.bsky.embed.external",
  "external": {
    "uri": "https://msmagazine.com/2025/11/14/wnba-equal-pay-women-athletes-basketball-salary/",
    "thumb": {
      "$type": "blob",
      "ref": {
        "$link": "bafkreie56wulkobvl3dfzp75ul2rqz2p3vkwdxixdhme2ljdkv3dlvnlvu"
      },
      "mimeType": "image/jpeg",
      "size": 744551
    },
    "title": "Calling Foul: Breaking Down WNBA Pay and Why It Matters",
    "description": "Breaking Down WNBA Pay for Women Athletes and Why It Matters: a case study in systemic undervaluing of women's work"
  }
}
```

## TODO - Remaining Work

### 1. Fix Blob URL Construction
- Research correct AT Protocol blob endpoint discovery
- The URLs use different hostnames (morel.us-east, button.us-west) - need to determine how to resolve correct host
- May need to use AT Protocol's `com.atproto.sync.getBlob` with proper service discovery

### 2. Video Support
- Implement `app.bsky.embed.video` handling
- Video URLs likely follow different construction pattern than images
- Need to research video blob URL format and playback requirements

### 3. Quote Post Support
- Implement `app.bsky.embed.record` handling for quote posts
- Display quoted post content within the main post preview
- Handle nested embeds (quote posts with their own media)

### 4. Enhanced Media Display
- Add image galleries for multiple images
- Implement video controls and playback
- Add loading states and error handling for media
- Optimize image sizes (thumbnails vs full resolution)

### 5. Performance Optimizations
- Implement proper image lazy loading
- Add media caching strategies
- Optimize database queries for media-heavy posts

## Files Modified

### Backend
- `/backend/src/services/bluesky.ts` - Main implementation
- `/backend/src/routes/moderation.ts` - Added post details fetching to trending endpoint

### Frontend  
- `/frontend/src/views/Dashboard.vue` - Added post preview components and styling

### Database
- Added SQL migration for `user_profiles` and `posts` tables

## Notes
- User profile caching works correctly and automatically updates stale data
- Post text display is fully functional
- Media display framework is in place but URLs need fixing
- All embed types are detected and logged, just need proper URL construction