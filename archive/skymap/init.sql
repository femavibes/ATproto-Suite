-- SkyMap Database Schema

CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'US-OR-Portland' (city) or 'US-OR-Multnomah' (county)
    name VARCHAR(100) NOT NULL,
    region_code VARCHAR(10), -- State/Province/Region code
    region_name VARCHAR(50), -- State/Province/Region name
    country_code VARCHAR(2) DEFAULT 'US',
    population INTEGER,
    parent_id INTEGER REFERENCES locations(id),
    graze_component_id INTEGER, -- Graze custom node component ID
    created_at TIMESTAMP DEFAULT NOW(),
    -- Custom images (from migration 006)
    pin_image_url VARCHAR(500),
    card_image_url VARCHAR(500),
    -- Bounding boxes (from migration 007)
    bbox_south DECIMAL(10, 7),
    bbox_west DECIMAL(10, 7),
    bbox_north DECIMAL(10, 7),
    bbox_east DECIMAL(10, 7),
    -- Location types and counties (from migration 016)
    location_type VARCHAR(20) CHECK (location_type IN ('country', 'state', 'county', 'city')),
    county_code VARCHAR(10), -- County code/abbreviation (for easy lookup)
    county_name VARCHAR(100), -- Full county name (for easy lookup)
    -- Polygon geometry (from migration 017)
    geometry JSONB, -- GeoJSON polygon geometry for location boundaries (falls back to bbox_* if null)
    -- Display overrides (from migration 018)
    display_key VARCHAR(100), -- Override key for list URLs and Ozone labels (e.g., US-NY-NewYorkCity). Falls back to key if null.
    display_name VARCHAR(100) -- Override name for display purposes (e.g., New York City). Falls back to name if null.
);

CREATE TABLE user_labels (
    id SERIAL PRIMARY KEY,
    did VARCHAR(200) NOT NULL,
    location_id INTEGER REFERENCES locations(id),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    -- Custom profile card image (from migration 006)
    profile_card_image_url VARCHAR(500)
);

CREATE TABLE location_lists (
    id SERIAL PRIMARY KEY,
    location_id INTEGER REFERENCES locations(id),
    list_uri VARCHAR(500) NOT NULL,
    bucket_number INTEGER DEFAULT 1,
    member_count INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE config (
    key VARCHAR(50) PRIMARY KEY,
    value VARCHAR(200) NOT NULL
);

-- Default config
INSERT INTO config (key, value) VALUES ('min_population', '50000');

CREATE TABLE hashtag_mappings (
    id SERIAL PRIMARY KEY,
    location_id INTEGER REFERENCES locations(id),
    hashtag VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(location_id, hashtag)
);

-- Processed mentions to prevent duplicates
CREATE TABLE processed_mentions (
    id SERIAL PRIMARY KEY,
    mention_uri VARCHAR(500) UNIQUE NOT NULL,
    processed_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_user_labels_did ON user_labels(did);
CREATE INDEX idx_locations_key ON locations(key);
CREATE INDEX idx_locations_parent ON locations(parent_id);
CREATE INDEX idx_processed_mentions_uri ON processed_mentions(mention_uri);
-- Indexes for custom images (from migration 006)
CREATE INDEX idx_locations_pin_image ON locations(pin_image_url) WHERE pin_image_url IS NOT NULL;
CREATE INDEX idx_user_labels_profile_image ON user_labels(profile_card_image_url) WHERE profile_card_image_url IS NOT NULL;
-- Indexes for bounding boxes (from migration 007)
CREATE INDEX idx_locations_bbox ON locations(bbox_south, bbox_west, bbox_north, bbox_east);
-- Indexes for location types and counties (from migration 016)
CREATE INDEX idx_locations_type ON locations(location_type);
CREATE INDEX idx_locations_county_code ON locations(county_code);
-- Index for geometry (from migration 017)
CREATE INDEX idx_locations_geometry ON locations USING GIN (geometry);
-- Indexes for display overrides (from migration 018)
CREATE UNIQUE INDEX idx_locations_display_key_unique ON locations(display_key) WHERE display_key IS NOT NULL;
CREATE INDEX idx_locations_display_key ON locations(display_key) WHERE display_key IS NOT NULL;

-- City-County relationships (many-to-many) (from migration 016)
CREATE TABLE city_counties (
    city_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
    county_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
    PRIMARY KEY (city_id, county_id)
);

CREATE INDEX idx_city_counties_city ON city_counties(city_id);
CREATE INDEX idx_city_counties_county ON city_counties(county_id);

-- Bluesky Lists Management
CREATE TABLE bluesky_lists (
    id SERIAL PRIMARY KEY,
    location_id INTEGER REFERENCES locations(id),
    list_url TEXT NOT NULL,
    list_rkey TEXT NOT NULL,
    bucket_number INTEGER NOT NULL DEFAULT 1,
    member_count INTEGER NOT NULL DEFAULT 0,
    max_members INTEGER NOT NULL DEFAULT 3000,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(location_id, bucket_number)
);

CREATE INDEX idx_bluesky_lists_location_active ON bluesky_lists(location_id, active);
CREATE INDEX idx_bluesky_lists_member_count ON bluesky_lists(member_count);

-- Location post activity stats for heatmap
CREATE TABLE location_post_stats (
    location_id INTEGER PRIMARY KEY REFERENCES locations(id),
    post_count_1h INTEGER DEFAULT 0,
    post_count_6h INTEGER DEFAULT 0,
    post_count_24h INTEGER DEFAULT 0,
    post_count_7d INTEGER DEFAULT 0,
    last_post_at TIMESTAMP,
    last_updated TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_location_post_stats_updated ON location_post_stats(last_updated);
CREATE INDEX idx_location_post_stats_24h ON location_post_stats(post_count_24h DESC);

-- Rate limiting for Bluesky API
CREATE TABLE api_rate_limits (
    id SERIAL PRIMARY KEY,
    endpoint TEXT NOT NULL,
    last_call TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    call_count INTEGER DEFAULT 1,
    reset_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '1 hour'
);

-- Graze custom feeds
CREATE TABLE graze_feeds (
    id SERIAL PRIMARY KEY,
    graze_feed_id INTEGER UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    algorithm_uri TEXT,
    sticky_type VARCHAR(50) DEFAULT 'new',
    algorithm_manifest JSONB,
    metadata JSONB,
    is_hashtag_feed BOOLEAN DEFAULT false,
    published BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT false,
    public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Admin users whitelist (from migration 003)
CREATE TABLE admin_users (
    id SERIAL PRIMARY KEY,
    handle VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT true
);

CREATE INDEX idx_admin_users_handle ON admin_users(handle);
CREATE INDEX idx_admin_users_active ON admin_users(active);

-- Post events tracking (from migration 004)
CREATE TABLE post_events (
    id SERIAL PRIMARY KEY,
    location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_post_events_location_time ON post_events(location_id, created_at DESC);
CREATE INDEX idx_post_events_created_at ON post_events(created_at DESC);

-- Recent posts display (from migration 005)
CREATE TABLE recent_posts (
    id SERIAL PRIMARY KEY,
    location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
    post_uri TEXT NOT NULL UNIQUE,
    author_did TEXT NOT NULL,
    author_handle TEXT,
    author_avatar TEXT,
    author_display_name TEXT,
    post_text TEXT,
    like_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    repost_count INTEGER DEFAULT 0,
    has_media BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL,
    indexed_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL -- From migration 032: tracks when post was last refreshed (for 24hr purge)
);

CREATE INDEX idx_recent_posts_location_time ON recent_posts(location_id, created_at DESC);
CREATE INDEX idx_recent_posts_location_likes ON recent_posts(location_id, like_count DESC);
CREATE INDEX idx_recent_posts_created ON recent_posts(created_at DESC);
CREATE INDEX idx_recent_posts_indexed ON recent_posts(indexed_at DESC);
CREATE INDEX idx_recent_posts_updated ON recent_posts(updated_at DESC); -- From migration 032

-- Events and RSVPs (from migration 008, 011, 012)
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
    -- Images (from migrations 011, 012)
    image_url VARCHAR(500),
    pin_image_url VARCHAR(500),
    -- Status
    is_active BOOLEAN DEFAULT true, -- Event is active (not expired/deleted)
    is_visible BOOLEAN DEFAULT false, -- Shows on map when true (calculated)
    is_ended BOOLEAN DEFAULT false, -- Event has passed (>24h after end_time)
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

CREATE INDEX idx_events_active ON events(is_active, is_visible, start_time);
CREATE INDEX idx_events_location ON events(location_id);
CREATE INDEX idx_events_coords ON events(latitude, longitude);
CREATE INDEX idx_events_creator ON events(creator_did);
CREATE INDEX idx_events_event_id ON events(event_id);
CREATE INDEX idx_event_rsvps_event ON event_rsvps(event_id);
CREATE INDEX idx_event_rsvps_user ON event_rsvps(user_did);
CREATE INDEX idx_events_image_url ON events(image_url) WHERE image_url IS NOT NULL;
CREATE INDEX idx_events_pin_image_url ON events(pin_image_url) WHERE pin_image_url IS NOT NULL;

-- User permission tiers (from migration 009)
CREATE TABLE user_permissions (
    id SERIAL PRIMARY KEY,
    did TEXT NOT NULL UNIQUE,
    tier INTEGER DEFAULT 1 NOT NULL CHECK (tier IN (1, 2, 3)),
    granted_at TIMESTAMP DEFAULT NOW(),
    granted_by TEXT, -- Admin handle who granted the permission
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_permissions_did ON user_permissions(did);
CREATE INDEX idx_user_permissions_tier ON user_permissions(tier);

-- Image permission requests (from migration 010)
CREATE TABLE image_requests (
    id SERIAL PRIMARY KEY,
    did TEXT NOT NULL,
    handle TEXT,
    request_type TEXT NOT NULL DEFAULT 'tier2' CHECK (request_type IN ('tier2')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
    request_message TEXT, -- Optional message from user
    admin_notes TEXT, -- Notes from admin
    reviewed_by TEXT, -- Admin handle who reviewed
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_image_requests_did ON image_requests(did);
CREATE INDEX idx_image_requests_status ON image_requests(status);
CREATE INDEX idx_image_requests_created ON image_requests(created_at DESC);

-- URL shortener for event links (from migration 013)
CREATE TABLE short_urls (
    id SERIAL PRIMARY KEY,
    short_code VARCHAR(10) UNIQUE NOT NULL, -- e.g., "ABC123"
    full_url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP, -- Optional: can expire after some time
    click_count INTEGER DEFAULT 0
);

CREATE INDEX idx_short_urls_code ON short_urls(short_code);
CREATE INDEX idx_short_urls_expires ON short_urls(expires_at) WHERE expires_at IS NOT NULL;

-- Contrails cursor for post ingestion (from migration 014)
CREATE TABLE contrails_cursor (
    id INTEGER PRIMARY KEY DEFAULT 1,
    last_time_us BIGINT,
    last_post_uri TEXT,
    last_post_created_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_contrails_cursor_post_uri ON contrails_cursor(last_post_uri) WHERE last_post_uri IS NOT NULL;

-- Processed post URIs for deduplication (from migration 014)
CREATE TABLE processed_post_uris (
    post_uri TEXT PRIMARY KEY,
    processed_at TIMESTAMP DEFAULT NOW(),
    location_id INTEGER,
    created_at TIMESTAMP
);

CREATE INDEX idx_processed_post_uris_processed ON processed_post_uris(processed_at);
CREATE INDEX idx_processed_post_uris_created ON processed_post_uris(created_at);

-- Reported images for moderation (from migration 015)
CREATE TABLE reported_images (
    id SERIAL PRIMARY KEY,
    reporter_did TEXT NOT NULL,
    reporter_handle TEXT,
    image_url TEXT NOT NULL,
    image_type VARCHAR(20) NOT NULL, -- 'profile', 'event', 'pin'
    related_id INTEGER, -- user_labels.id, events.id, or locations.id
    reason VARCHAR(100), -- 'copyright', 'inappropriate', 'illegal', 'spam', 'other'
    details TEXT, -- Optional additional details
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'denied', 'resolved'
    reviewed_at TIMESTAMP,
    reviewed_by TEXT, -- admin DID
    review_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reported_images_status ON reported_images(status);
CREATE INDEX idx_reported_images_image_url ON reported_images(image_url);
CREATE INDEX idx_reported_images_image_type ON reported_images(image_type);
CREATE INDEX idx_reported_images_created_at ON reported_images(created_at DESC);

-- Event scoring configuration (from migration 019)
CREATE TABLE IF NOT EXISTS event_scoring_config (
  config_key VARCHAR(100) PRIMARY KEY,
  config_value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default values for event scoring
INSERT INTO event_scoring_config (config_key, config_value) VALUES
  ('absoluteWeight', '0.3'),
  ('densityWeight', '0.7'),
  ('useSquareRoot', 'true'),
  ('maxDensityScore', 'null'),
  ('minRSVPsForCompetition', '0'),
  ('applyMinWhenOversubscribed', 'true')
ON CONFLICT (config_key) DO NOTHING;

-- Comments for bounding box columns
COMMENT ON COLUMN locations.bbox_south IS 'Southern boundary of city bounding box';
COMMENT ON COLUMN locations.bbox_west IS 'Western boundary of city bounding box';
COMMENT ON COLUMN locations.bbox_north IS 'Northern boundary of city bounding box';
COMMENT ON COLUMN locations.bbox_east IS 'Eastern boundary of city bounding box';

-- Session table for persistent sessions (from migration 021)
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
)
WITH (OIDS=FALSE);

ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");


-- User settings for media and NSFW preferences (from migration 029)
CREATE TABLE IF NOT EXISTS user_settings (
  user_did TEXT PRIMARY KEY,
  show_media BOOLEAN DEFAULT FALSE,
  nsfw_preference TEXT DEFAULT 'hide' CHECK (nsfw_preference IN ('hide', 'blur', 'show')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_show_media ON user_settings(show_media);
CREATE INDEX IF NOT EXISTS idx_user_settings_nsfw ON user_settings(nsfw_preference);

-- Add updated_at trigger for user_settings
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_settings_updated_at();


-- Add embed_data column for media in posts (from migration 030)
ALTER TABLE recent_posts ADD COLUMN IF NOT EXISTS embed_data JSONB;
CREATE INDEX IF NOT EXISTS idx_recent_posts_embed ON recent_posts USING GIN (embed_data) WHERE embed_data IS NOT NULL;


-- Add NSFW moderation fields (from migration 031)
ALTER TABLE recent_posts ADD COLUMN IF NOT EXISTS is_nsfw BOOLEAN DEFAULT FALSE;
ALTER TABLE recent_posts ADD COLUMN IF NOT EXISTS moderation_checked_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_recent_posts_nsfw ON recent_posts(is_nsfw);
CREATE INDEX IF NOT EXISTS idx_recent_posts_moderation_check ON recent_posts(moderation_checked_at) WHERE moderation_checked_at IS NULL;


-- Create mutuals cache table for persistent storage (from migration 033)
CREATE TABLE IF NOT EXISTS mutuals_cache (
  user_did TEXT PRIMARY KEY,
  cache_data JSONB NOT NULL,
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mutuals_cache_cached_at ON mutuals_cache(cached_at);


-- Create explore users cache table (from migration 034)
CREATE TABLE IF NOT EXISTS explore_users_cache (
  cache_key TEXT PRIMARY KEY,
  cache_data JSONB NOT NULL,
  cached_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_explore_users_cache_cached_at ON explore_users_cache(cached_at);
