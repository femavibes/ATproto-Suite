# SkyMap Events Feature

## Overview
Allow users to create and discover local events (meetups, concerts, protests, etc.) on the SkyMap. Events appear as pins on the map and can be shared via unique links.

## Core Concept
Users log in → Create event → Get shareable link → Share link → Users RSVP via `@ATlas.city !attend [EVENTID]` → Event appears on map based on RSVP popularity (competing within same city)

## Status: MVP Implementation Complete ✅

- ✅ Design finalized
- ✅ Database schema (migration 008_events.sql)
- ✅ API endpoints (all implemented)
- ✅ Event creation page (Events tab)
- ✅ Event detail page (`/event/:eventId`)
- ✅ Map integration (event markers with toggle)
- ✅ Visibility/ranking system (RSVP density scoring)
- ✅ Bot !attend command handler
- ⏳ Testing and refinement

## Location Support

### 1. City-Based (Primary)
Use existing location keys from database:
```
US-OR-Portland
US-CA-San-Francisco
CA-ON-Toronto
```

### 2. Plus Codes (Exact Locations)
Support Google Plus Codes for precise locations:
```
87P8+QQ (8-11 character codes)
```
- Works anywhere in the world
- Short and shareable
- Free, open standard
- Library: `open-location-code` npm package

### 3. Map Click (MVP)
Click anywhere on map to set precise location → Event marker appears at exact coordinates

## Database Schema

```sql
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(10) UNIQUE NOT NULL, -- Short ID: "EVT-ABC123"
  
  -- Creator
  creator_did TEXT NOT NULL,
  creator_handle TEXT,
  
  -- Content
  title VARCHAR(200) NOT NULL,
  description TEXT,
  
  -- Timing
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  
  -- Location (city + precise coordinates)
  location_id INTEGER REFERENCES locations(id), -- City location
  latitude DECIMAL(10, 8) NOT NULL, -- Precise coordinates (from map click)
  longitude DECIMAL(11, 8) NOT NULL,
  location_name TEXT, -- Display name (e.g., "Portland, OR")
  
  -- Links (future: image_url for event poster)
  -- image_url TEXT, -- Event poster/image (post-launch)
  
  -- Status
  is_active BOOLEAN DEFAULT true, -- Event is active (not expired/deleted)
  is_visible BOOLEAN DEFAULT false, -- Shows on map when true (calculated)
  is_ended BOOLEAN DEFAULT false, -- Event has passed (>24h)
  
  -- Lifecycle
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP -- Soft delete
);

CREATE TABLE event_rsvps (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(10) NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  user_did TEXT NOT NULL,
  user_handle TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  created_at_relative_to_start TIMESTAMP, -- For calculating if RSVP was before/after event start
  UNIQUE(event_id, user_did) -- One RSVP per user per event
);

-- Indexes for performance
CREATE INDEX idx_events_active ON events(is_active, is_visible, start_time);
CREATE INDEX idx_events_location ON events(location_id);
CREATE INDEX idx_events_coords ON events(latitude, longitude);
CREATE INDEX idx_events_creator ON events(creator_did);
CREATE INDEX idx_events_upcoming ON events(start_time) WHERE is_active = true AND start_time > NOW();
CREATE INDEX idx_event_rsvps_event ON event_rsvps(event_id);
CREATE INDEX idx_event_rsvps_user ON event_rsvps(user_did);
```

## User Flow

### Creating an Event

1. **Login Required**
   - User must be authenticated
   - Uses existing session system

2. **Create Event Form**
   ```
   Title: [Max 200 chars]
   Description: [Text area]
   
   Location:
   - Select City: [Dropdown of cities]
   - Click on map to set precise location [Map interface]
     (Latitude/Longitude saved from map click)
   
   Start Date & Time: [Date picker + time]
   End Date & Time: [Required, max 24 hours from start]
   
   Constraints:
   - Max 2 months in advance
   - Max 24 hour duration
   
   [Create Event]
   ```

3. **After Creation**
   ```
   ✅ Event Created!
   
   Share this link to promote your event:
   skymap.fema.monster/event/EVT-ABC123
   
   Your event needs 1 RSVP to appear on the map.
   Current RSVPs: 0
   
   [Copy Link] [Share on Bluesky] [Edit Event] [View on Map]
   ```

### Viewing an Event

**Event Page:** `/event/EVT-ABC123`
- Event details (title, description, time, location)
- Map showing precise location
- Creator info
- RSVP count
- Link to Bluesky composer with `@ATlas.city !attend EVT-ABC123` pre-filled
- "View on Map" button (opens SkyMap at that location)

**RSVP System:**
- Users click link → Opens Bluesky composer with `@ATlas.city !attend [EVENTID]`
- Bot processes `!attend` command → Adds RSVP to database
- One RSVP per user per event (tracked by user_did)
- RSVPs after event starts count 0.5x weight

### Map Display

**Event Markers:**
- Different icon/color from cities and users (e.g., 📍 orange/red)
- Only show events where `is_visible = true`
- Toggle button: "Show Events" (like mutuals/explore)
- Filter: Upcoming events only (start_time > NOW)

**Event Popup:**
```
┌─────────────────────────────────┐
│ 🎉 Bluesky Meetup               │
├─────────────────────────────────┤
│ 📅 Sat, Jan 20, 3:00 PM         │
│ 📍 Portland, OR                 │
│                                 │
│ Coffee and chat at Coava!       │
│                                 │
│ 👤 @alice.bsky.social           │
│                                 │
│ [View Details] [Get Directions] │
└─────────────────────────────────┘
```

## Visibility Logic

### RSVP-Based Competition System

Events compete for visibility within their city based on **RSVP Density Score**:

**Scoring Formula:**
```
Score = RSVPs / Duration (in hours)

Where:
- RSVPs = count of RSVPs
- Duration = (end_time - start_time) in hours
- RSVPs created after event starts count 0.5x weight
```

**Example:**
- Event A: 10 RSVPs, 2 hours = 5.0 score
- Event B: 20 RSVPs, 8 hours = 2.5 score
- Event A wins (higher score = more popular per hour)

**City Event Limits:**
- < 50K population: 2 events visible
- 50K-100K: 5 events
- 100K-250K: 10 events
- 250K-500K: 15 events
- 500K-1M: 20 events
- 1M+: 25 events

**Visibility Rules:**
1. Minimum 1 RSVP required to be visible (unless creator viewing their own event while logged in)
2. Only upcoming events (start_time > NOW)
3. Top N events by score are visible (N = city limit)
4. Events can be bumped if more popular event starts
5. When event ends (>24h), slot opens for next highest event
6. Visibility recalculated every 5 minutes
7. Multiple events can show simultaneously if within city limit

## Event Lifecycle

### Active Period
- Event is visible during its time window (start_time to end_time)
- Maximum duration: 24 hours
- After 24 hours, event is flagged `is_ended = true` but stays in database
- Users must create new event for future dates

### Editing
- Creators can edit events **before** start_time
- **Cannot edit** after event starts
- Event page remains accessible after event ends

### Deletion
- Soft delete: Set `deleted_at` timestamp
- Event page shows "This event was cancelled"
- Removed from map immediately
- Creators can delete anytime

### Creation Constraints
- Maximum 2 months in advance
- Maximum 24 hour duration

## API Endpoints

### Public Endpoints
```
GET  /api/events/map          - Get visible events for map display (with bounds)
GET  /api/events/:eventId     - Get event details (includes RSVP count)
```

### Authenticated Endpoints
```
POST   /api/events            - Create event (login required)
PUT    /api/events/:eventId   - Update event (creator only, before start_time)
DELETE /api/events/:eventId   - Delete event (creator only)
GET    /api/events/my-events  - Get user's events (login required)
POST   /api/events/:eventId/rsvp - Add RSVP (via bot, not direct API)
```

### Query Parameters for /api/events/map
```
?bounds=north,south,east,west  - Filter by map bounds (required)
```

## Frontend Pages

### 1. Events List Page
`/events` - Browse all upcoming events
- Grid/list view
- Filter by location, date, type
- Search
- Sort by date, popularity, distance

### 2. Create Event Page
`/events/create` - Form to create new event
- Login required
- Title and description fields
- City selection dropdown
- Map interface to click precise location
- Date/time pickers (start and end, max 24h)
- Validation: max 2 months in advance, max 24h duration

### 3. Event Detail Page
`/event/:eventId` - Single event view
- Full details
- Map showing location
- Share buttons
- Edit/delete (if creator)

### 4. My Events Page
`/events/my-events` - User's created events
- List of events
- View counts, engagement stats
- Quick edit/delete

### 5. Map Integration
Update `skymap.html`:
- Add "Show Events" toggle button (like mutuals/explore buttons)
- Fetch and display event markers from `/api/events/map`
- Event markers use different icon/color (e.g., orange/red pin)
- Event popups with title, time, location, RSVP count
- Click to view full event page
- Only shows events where `is_visible = true` (top N per city)

## Viral Growth Strategy

### Promotion Loop
1. User creates event
2. Gets shareable link
3. Shares on Bluesky with link
4. People click link → Open Bluesky composer with `!attend` command
5. Users post `@ATlas.city !attend [EVENTID]`
6. Bot processes RSVP → RSVP count increases
7. At 1 RSVP → Event becomes eligible for visibility
8. Based on score, event appears on map if in top N for city
9. More visibility → More RSVPs → Higher score

### RSVP Incentive
- "Your event needs X more RSVPs to appear on the map!"
- Share link opens Bluesky composer with pre-filled `!attend` command
- Event page shows current RSVP count

## Future Enhancements

### Bot Integration - !attend Command
Bot processes `!attend` command from users:
```
@ATlas.city !attend EVT-ABC123
```
- Bot reads message, extracts event_id
- Validates event exists and is active
- Checks if user already RSVP'd (one per user per event)
- Adds RSVP to database with timestamp
- If RSVP is after event start_time, flagged for 0.5x weight
- Visibility recalculated on next cycle (every 5 min)

### Bot Integration - !event Command (Future)
Add `!event` command to command-bot:
```
@skymap.bsky.social !event US-OR-Portland "Meetup Saturday 3pm"
```
- Quick event creation via DM (post-launch feature)

### Event Types
Categorize events:
- 🎵 Concert/Music
- 🍺 Meetup/Social
- 📢 Protest/Rally
- 🎨 Art/Culture
- 🏃 Sports/Fitness
- 💼 Professional
- 🎓 Educational
- 🎉 Party/Festival

Different icons/colors per type.

### RSVP System (Already Implemented)
- RSVP via `!attend` command on Bluesky
- Show RSVP count on event page
- RSVP list (future: show attendees)
- Notifications (future: notify creator of new RSVPs)

### Recurring Events
- Weekly meetups
- Monthly events
- Auto-create instances

### Featured Events
- Paid promotion ($5-10)
- Instant visibility
- Highlighted on map
- Top of event list
- Revenue stream

### Event Discovery
- "Events Near Me" (based on user location)
- "Trending Events" (high engagement)
- "Recommended Events" (based on interests)
- Email/push notifications

### Analytics Dashboard
For event creators:
- View count over time
- Click-through rate
- Geographic distribution of viewers
- Referral sources

### Moderation Tools
- Report event (spam, inappropriate)
- Admin review queue
- Auto-flag suspicious events (new account, many events, etc.)
- Blacklist/whitelist users

## Technical Implementation

### Libraries Needed
- No additional libraries required for MVP
- Leaflet.js already loaded for map (skymap.html)
- Date handling: native JavaScript Date objects

### Visibility Recalculation
- Background job runs every 5 minutes
- Calculates RSVP density scores for all active events
- Determines top N events per city based on score
- Updates `is_visible` flag for events that should appear on map
- Events can appear/disappear as scores change

### Performance
- Index on `(is_active, is_visible, start_time)` for fast queries
- Paginate event lists
- Lazy load event markers on map (only visible bounds)
- CDN for event images

## Testing Checklist

- [ ] Create event with city + precise map click location
- [ ] Validate max 2 months in advance
- [ ] Validate max 24 hour duration
- [ ] Event page displays correctly
- [ ] Bluesky composer link pre-fills `!attend` command
- [ ] Bot processes `!attend` command correctly
- [ ] RSVP count increments
- [ ] One RSVP per user enforced
- [ ] RSVPs after event start count 0.5x
- [ ] Event becomes visible with 1+ RSVP (if in top N)
- [ ] Visibility recalculation works (every 5 min)
- [ ] City limits enforced correctly
- [ ] RSVP density score calculation correct
- [ ] Edit event before start works
- [ ] Edit event after start blocked
- [ ] Delete event works
- [ ] Events appear on map with toggle button
- [ ] Event popup works
- [ ] Share link works
- [ ] Past events (is_ended) hidden from map
- [ ] Creator can see own event when logged in (even if not visible)
- [ ] Mobile responsive
- [ ] Login required for creation
- [ ] Creator-only edit/delete

## Launch Plan

### Phase 1: MVP (Week 1)
- Database schema
- Create event form (city-based only)
- Event detail page
- Basic map display
- View tracking

### Phase 2: Plus Codes (Week 2)
- Add Plus Code support
- Coordinate resolution
- Map click to create (optional)

### Phase 3: Polish (Week 3)
- Event list page
- My events page
- Edit/delete functionality
- Image uploads
- Better styling

### Phase 4: Growth (Week 4)
- Share buttons
- Analytics
- Featured events
- Email notifications

## Success Metrics

- Events created per week
- Average views per event
- Conversion rate (views → map visibility)
- Share rate
- Click-through rate on external links
- User retention (creators come back)
- Map engagement (event clicks)

## Implementation Status

### ✅ Completed (MVP)
- ✅ Design finalized
- ✅ Database migration (`migrations/008_events.sql`) - tables created
- ✅ API endpoints - all implemented in `services/web-directory/server.js`
- ✅ Event creation page - Events tab in main navigation
- ✅ Event detail page - `/event/:eventId` route
- ✅ Map integration - event markers with toggle button
- ✅ Bot !attend command - implemented in `services/command-bot/index.js`
- ✅ Visibility recalculation system - runs every 5 minutes
- ✅ RSVP density scoring - calculates scores automatically
- ✅ City-based event limits - enforced in visibility calculation

### Future Features
- Event images (post-launch)
- External links (Eventbrite, etc.) - not needed for MVP
- Event types/categories
- Recurring events
- Featured/paid events
- My Events page (`/events/my-events`)
- Events list/browse page (`/events`)

## Implementation Details

### Database

**Migration:** `migrations/008_events.sql`
- `events` table with all fields
- `event_rsvps` table with unique constraint (event_id, user_did)
- All indexes created for performance

**Run Migration:**
```bash
docker exec -i skymap-postgres-1 psql -U dev -d skymap -h localhost -p 5435 < migrations/008_events.sql
```

### API Endpoints

**Location:** `services/web-directory/server.js`

**Public Endpoints:**
- `GET /api/events/map?north=&south=&east=&west=` - Get visible events for map bounds
- `GET /api/events/:eventId` - Get event details with RSVP count

**Authenticated Endpoints:**
- `POST /api/events` - Create event (requires login)
- `PUT /api/events/:eventId` - Update event (creator only, before start)
- `DELETE /api/events/:eventId` - Delete event (creator only)
- `GET /api/events/my-events` - Get user's events (requires login)

### Frontend Pages

**Events Tab:** `services/web-directory/public/events.html`
- Embedded in main site (Events tab)
- Event creation form with map for precise location
- Authentication check built-in

**Event Detail Page:** `services/web-directory/public/eventdetail.html`
- Route: `/event/:eventId`
- Shows event details, RSVP count, map
- Links to Bluesky composer for RSVP

### Map Integration

**File:** `services/web-directory/public/skymap.html`

**Features:**
- "Show Events" toggle button (orange/red markers with 🎉 emoji)
- Auto-updates events when map is moved/zoomed
- Event popups with:
  - Title (orange color)
  - Date/time
  - Location
  - Description
  - RSVP count
  - "View Details" link
  - "RSVP on Bluesky" button

### Bot Integration

**File:** `services/command-bot/index.js`

**Command:** `@ATlas.city !attend EVT-ABC123`

**Handler:** `handleAttendCommand()`
- Validates event exists and is active
- Prevents duplicate RSVPs (one per user per event)
- Records RSVP with timestamp
- Tracks if RSVP was before/after event start (for 0.5x weight)
- Replies with confirmation message

**Example Usage:**
```
User: @ATlas.city !attend EVT-ABC123
Bot: ✅ RSVP'd to "Bluesky Meetup"! The event will appear on the map based on RSVP popularity.
```

### Visibility System

**Function:** `recalculateEventVisibility()` in `services/web-directory/server.js`

**Runs:** Every 5 minutes (setInterval)

**Process:**
1. Fetch all active, upcoming events with RSVP counts
2. Calculate RSVP density score for each: `Score = RSVPs / Duration (hours)`
   - RSVPs after event starts count 0.5x weight
3. Group events by city
4. For each city, sort by score and take top N (based on city population)
5. Update `is_visible` flag for selected events
6. Mark events as `is_ended = true` if >24h after end_time

**City Event Limits:**
- < 50K population: 2 events
- 50K-100K: 5 events
- 100K-250K: 10 events
- 250K-500K: 15 events
- 500K-1M: 20 events
- 1M+: 25 events

**Visibility Threshold:** 0 (set for testing - events appear immediately)

### Routes

**Main Navigation:**
- Events tab added between Map and Check Labels

**Page Routes:**
- `/` - Main site with Events tab
- `/event/:eventId` - Event detail page

**API Routes:**
- See API Endpoints section above

## Usage Guide

### Creating an Event

1. **Login Required**
   - Click "Login" button (if not logged in)
   - Use Bluesky app password (not main password)

2. **Fill Event Form**
   - Go to Events tab
   - Enter title (max 200 chars)
   - Enter description (optional)
   - Select city from dropdown
   - Click map to set precise location
   - Set start and end date/time (max 24h duration, max 2 months in advance)

3. **Submit**
   - Click "Create Event"
   - Redirected to event detail page
   - Share event link to promote

### RSVPing to an Event

1. **Via Event Detail Page**
   - Click "Open Bluesky Composer to RSVP" button
   - Opens Bluesky with pre-filled `@ATlas.city !attend [EVENTID]`
   - Post the message

2. **Via Map**
   - Click event marker on map
   - Click "RSVP on Bluesky" in popup
   - Post the message

3. **Direct**
   - Post `@ATlas.city !attend EVT-ABC123` on Bluesky
   - Bot processes RSVP and replies with confirmation

### Viewing Events on Map

1. Go to Map tab
2. Click "Show Events" button
3. Event markers appear (orange/red with 🎉 emoji)
4. Click marker to see event details
5. Events auto-update when map is moved/zoomed

## Technical Notes

- RSVP-based system (not view-based) for better engagement tracking
- Events compete within cities, not globally
- Scoring system is flexible and can be changed in future
- Focus on simple MVP: title, description, city, precise location, time
- Bot integration for RSVPs via `!attend` command
- Visibility recalculated every 5 minutes in background
- Visibility threshold currently set to 0 for testing (change in `recalculateEventVisibility()`)
- Event markers use orange/red color (#ff6b35) to differentiate from cities/users