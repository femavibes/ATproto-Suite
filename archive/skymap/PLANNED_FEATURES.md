# SkyMap Planned Features

## Performance Optimizations

### Server-side Profile Caching
- **Priority:** Medium
- **Description:** Add Redis or in-memory cache on the server to cache Bluesky profile data (handles, avatars, display names) for list members
- **Benefits:**
  - Faster page loads for all users
  - Reduced API calls to Bluesky
  - Shared cache across all users
- **Implementation:**
  - Cache profiles for 1-24 hours (configurable)
  - Invalidation strategy for stale data
  - Fallback to Bluesky API if cache miss
- **Current Status:** Using client-side localStorage caching (1-hour expiration)

## Map Improvements

### Stacked Mutuals Markers
- **Priority:** Medium
- **Problem:** Multiple mutuals in the same city stack on top of each other, making it hard to see all of them
- **Potential Solutions:**
  1. **Marker Clustering** - Group nearby markers with count badge, click to zoom/expand
  2. **Spiderfying** - Click stacked markers to spread them in a circle (like Snapchat)
  3. **Offset/Jitter** - Add small random displacement to prevent perfect stacking
  4. **Stacked Avatars** - Show overlapping avatars like a deck of cards
  5. **Single Marker with Count** - One marker per city showing "3 mutuals", click for list
  6. **Grid Popup** - Single marker, click opens popup with grid of all avatars
- **Recommended:** Use Leaflet MarkerCluster (already loaded) with custom cluster icons showing avatar thumbnails
- **Current Status:** Mutuals markers stack perfectly on same coordinates

### Batch Geocoding
- **Priority:** High
- **Description:** Automatically geocode all cities on startup or via scheduled job
- **Benefits:**
  - All cities have coordinates for map display
  - Mutuals feature works for all locations
  - No manual geocoding needed
- **Implementation:**
  - Respect Nominatim rate limits (1 req/sec)
  - Run as background job
  - ~15 minutes for 864 cities
- **Current Status:** Manual geocoding via `/api/geocode` endpoint, 864 cities need coordinates


## Code Refactoring

### Admin Server.js Cleanup
- **Priority:** Medium
- **Problem:** `/root/skymap/services/admin/server.js` is massive and needs to be refactored into smaller, more manageable modules
- **Description:** Break down the monolithic server.js file into organized route handlers and middleware
- **Benefits:**
  - Easier to maintain and debug
  - Better code organization
  - Clearer separation of concerns
  - Easier to add new features
- **Potential Structure:**
  - `routes/locations.js` - Location CRUD operations
  - `routes/lists.js` - List management endpoints
  - `routes/feeds.js` - Feed generation and management
  - `routes/graze.js` - Graze integration endpoints
  - `routes/ingestion.js` - Ingestion monitoring
  - `routes/whitelist.js` - Admin user management
  - `middleware/auth.js` - Authentication middleware
  - `utils/database.js` - Database helper functions
- **Current Status:** All routes and logic in single server.js file

## Visual Enhancements

### Custom City Images ✅ COMPLETED
- **Priority:** High
- **Status:** ✅ Implemented
- **Description:** Display custom images for cities on map pins and popup cards
- **Implementation Details:**
  - Database columns added: `pin_image_url`, `card_image_url` in locations table
  - Pin images (48x48px) appear at zoom level 10+ using Leaflet custom icons
  - Card images (400x200px) display at top of city popup cards
  - Admin UI at `/images.html` for managing city images
  - Falls back to standard markers when no image is set or zoom < 10
- **See:** `CUSTOM_IMAGES_IMPLEMENTATION.md` for full details

### Custom User Profile Images ✅ COMPLETED
- **Priority:** Medium
- **Status:** ✅ Implemented
- **Description:** Allow users to set custom background/banner images for their profile cards on the map
- **Implementation Details:**
  - Database column added: `profile_card_image_url` in user_labels table
  - Banner images (400x150px) display at top of user popup cards
  - Works for both mutuals and explore users
  - Admin UI at `/images.html` for managing user profile images
  - Optional feature - only displays if URL is set
- **See:** `CUSTOM_IMAGES_IMPLEMENTATION.md` for full details

### Location Key Whitespace Fix (Mobile)
- **Priority:** Low
- **Status:** ⏳ Planned
- **Problem:** On mobile, when location keys (e.g., "US-KY-LouisvilleJeffersonCounty") wrap to multiple lines, there's whitespace to the left of the container. The container maintains a minimum width based on the original unwrapped text, even after wrapping.
- **Current Behavior:**
  - Location keys break after the second dash (e.g., "US-KY-<wbr>LouisvilleJeffersonCounty")
  - When text wraps, container maintains original single-line width
  - Whitespace appears on the left side of the wrapped text
  - Whitespace collapses when screen gets narrower (flex container forces shrink)
- **Potential Solutions:**
  1. **JavaScript measurement** - Measure actual wrapped width and set container width dynamically
  2. **CSS-only approach** - Use `display: table` with `width: 1px` trick (tried, caused text to stack vertically)
  3. **Layout change** - Move location key below city name on mobile when it would wrap
  4. **Accept current behavior** - Whitespace is minimal and collapses when needed
- **Files Affected:** `services/web-directory/public/locations.html`
- **Current Status:** Issue documented, needs investigation for best solution

## Custom Maps & Events (FUTURE VISION)

### Feedmaker Custom Maps
- **Priority:** Low (Future Feature)
- **Description:** Allow feedmakers to create custom branded versions of SkyMap with their own data sources and event pins
- **URL Structure:** `skymap.fema.monster/username/maps/mapname`
- **Core Concept:**
  - Feedmakers get their own map instance
  - Uses their websocket feed for real-time data
  - Custom heatmap based on their feed's hashtag mappings
  - Event pins specific to their community
  - Monetization opportunity for feedmakers (not SkyMap ads)

### Technical Architecture:
- **Data Sources:**
  - Websocket connection to feedmaker's custom feed
  - Parse hashtag mappings for location data (same as current heatmap)
  - Real-time updates as posts come through feed
  - Event data from feedmaker's event management system
- **Database Schema:**
  - New `custom_maps` table:
    - `id`, `feedmaker_did`, `map_name`, `websocket_url`
    - `custom_settings` (JSON) - colors, branding, filters
    - `created_at`, `active`
  - New `map_events` table:
    - `id`, `custom_map_id`, `title`, `description`, `location_key`
    - `event_date`, `image_url`, `link_url`
    - `is_promoted` (BOOLEAN) - paid promotion flag
    - `created_by_did`, `created_at`

### Event Pins:
- **Purpose:** Allow feedmakers to promote community events on their custom map
- **Visual Design:**
  - Distinct icon/color from city and user pins (e.g., star, calendar icon)
  - Animated or pulsing for promoted events
  - Cluster by location if multiple events in same city
- **Popup Card:**
  - Event title and description
  - Date/time
  - Location (linked to city)
  - Event image/poster
  - RSVP or "Learn More" button
  - "Promoted" badge if paid
- **Monetization (Feedmaker-Level):**
  - Feedmakers can charge event organizers for promoted pins
  - Revenue goes to feedmaker, not SkyMap
  - SkyMap takes platform fee (10-20%) if facilitating payments
  - Keeps ads community-focused, not corporate

### Custom Map Features:
- **Branding:**
  - Custom color schemes
  - Feedmaker logo/name in header
  - Custom description text
- **Data Layers:**
  - Toggle between heatmap, user pins, event pins
  - Filter by hashtags from their feed
  - Time-based filters (last hour, day, week)
- **Sharing:**
  - Embeddable iframe for feedmaker's website
  - Social media preview cards
  - QR codes for physical events
- **Analytics (Premium):**
  - Map views and interactions
  - Popular locations in their community
  - Event engagement metrics

### Implementation Phases:
1. **Phase 1:** Proof of concept with single feedmaker
2. **Phase 2:** Self-service map creation interface
3. **Phase 3:** Event pin system
4. **Phase 4:** Monetization and payment processing
5. **Phase 5:** Analytics dashboard

### Benefits:
- **For Feedmakers:**
  - Engage their community with visual map
  - Promote events and meetups
  - Monetization opportunity
  - Differentiate their feed
- **For SkyMap:**
  - Platform growth through feedmaker adoption
  - Potential revenue from platform fees
  - Network effects (more maps = more users)
  - Positions SkyMap as infrastructure for Bluesky communities
- **For Users:**
  - Discover local events in their communities
  - See real-time activity in their interest areas
  - Connect with nearby community members

### Challenges:
- **Complexity:** Significant engineering effort
- **Moderation:** Need to moderate event content and images
- **Performance:** Multiple websocket connections and real-time updates
- **Scaling:** Each custom map is a separate instance
- **Support:** Feedmakers will need documentation and support

### Notes:
- This is a long-term vision, not immediate priority
- Start with core SkyMap features first
- Validate demand with feedmaker community before building
- Consider starting with static event pins before real-time websocket integration

## Testing & Validation

### Ozone Label Backfill System
- **Priority:** High
- **Description:** Implement a retry/backfill system for Ozone label operations that fail due to outages or connectivity issues
- **Problem:** When Ozone is down or unreachable, label add/remove operations succeed in the database but fail to sync to the AT Protocol network. This creates inconsistency between local state and network state.
- **Solution:** Queue failed Ozone operations and retry them when Ozone becomes available
- **Implementation:**
  1. **Database Queue Table:**
     - `ozone_sync_queue` table with columns:
       - `id`, `operation_type` (add/remove), `did`, `label_key`
       - `attempts`, `last_attempt_at`, `created_at`
       - `status` (pending/completed/failed), `error_message`
  2. **Queue Operations:**
     - When Ozone call fails, insert into queue instead of just logging error
     - Mark as 'pending' with attempt count = 0
  3. **Background Worker:**
     - Cron job or separate service that runs every 5-15 minutes
     - Processes pending queue items in batches
     - Retries failed operations with exponential backoff
     - Max 5 retry attempts before marking as permanently failed
     - Logs success/failure for monitoring
  4. **Health Check:**
     - Ping Ozone health endpoint before processing queue
     - Skip processing if Ozone is still down
     - Alert admins if queue grows beyond threshold (e.g., 1000 items)
- **Benefits:**
  - Ensures eventual consistency between database and AT Protocol
  - No data loss during Ozone outages
  - Automatic recovery when service restored
  - Visibility into sync failures via queue table
- **Current Status:** Ozone failures are logged but not retried. Labels work locally but don't sync to network.
- **Files to Modify:**
  - Add migration for `ozone_sync_queue` table
  - Update `services/web-directory/server.js` label endpoints
  - Update `services/command-bot/index.js` Ozone functions
  - Create new `services/ozone-sync-worker/` service or cron job

### Contrails Listener Backfill Testing
- **Priority:** Medium
- **Description:** Fully test that the Contrails WebSocket sends historical posts when reconnecting after downtime, and that our deduplication correctly handles them
- **What to Test:**
  1. Stop the contrails-listener service for 10-30 minutes
  2. Restart the service
  3. Verify that posts from the downtime period are received and processed
  4. Check logs for `🕐 Processing historical post` messages
  5. Verify no duplicate posts are processed (check `processed_post_uris` table)
  6. Confirm heatmap stats are updated correctly with historical posts
- **Current Status:** 
  - Post URI cursor system implemented ✅
  - Database deduplication for historical posts ✅
  - Logging for historical posts added ✅
  - **Needs:** Actual test with downtime to verify WebSocket behavior
- **Notes:** The Contrails WebSocket may or may not send historical posts on reconnect - this needs to be verified through testing. If it doesn't, we'll need to implement a separate backfill mechanism using the AT Protocol API.

## User Experience Enhancements

### Direct Bluesky Posting with Markdown Support
- **Priority:** Medium
- **Description:** Allow users to post event shares directly to Bluesky from the SkyMap interface, with full markdown link support
- **Problem:** Currently, users must manually copy/paste event links. Bluesky web/mobile apps don't support markdown, but third-party clients do. Since users authenticate with Bluesky credentials, we can post on their behalf like a third-party client.
- **Benefits:**
  - Better UX: one-click posting instead of copy/paste
  - Markdown links work (e.g., `[RSVP here](url)` instead of plain URLs)
  - Cleaner event shares in Bluesky
  - Users don't need to leave SkyMap to share events
- **Implementation Requirements:**
  1. **Per-User Session Management:**
     - Store authenticated Bluesky sessions per user (separate from web app sessions)
     - Handle token refresh and expiration
     - Encrypt stored credentials/tokens securely
     - Handle credential rotation (user changes password, revokes access)
  2. **Bluesky API Integration:**
     - Use `agent.api.com.atproto.repo.createRecord()` to create posts
     - Support markdown in post text via Bluesky's facet system
     - Handle rate limiting (per-user and per-app)
     - Error handling (network failures, auth errors, Bluesky API errors)
  3. **User Interface:**
     - "Post to Bluesky" button on event detail page
     - Optional post preview before posting
     - Success/error feedback
     - Option to edit post text before posting
  4. **Security Considerations:**
     - Encrypt stored credentials/tokens in database
     - Secure session storage (encrypted cookies or database)
     - Handle edge cases (password changes, revoked access)
     - Never log or expose user credentials
- **Complexity Level:** Medium (6/10)
  - **Pros:** Already have user auth flow, ATProto API is straightforward, markdown support built into Bluesky facets
  - **Cons:** Per-user session management adds complexity, security considerations for credential storage, more error handling needed
- **Alternative (Simpler):** Generate markdown-formatted text and copy to clipboard for users to paste into their Bluesky client (supports markdown but requires manual step)
- **Current Status:** Users manually copy/paste event links. URL shortener implemented to make links cleaner, but still plain text (no markdown).
