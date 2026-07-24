-- Migration 020: Event Types System
-- Adds support for physical/digital/hybrid events, NSFW content, categories, links, and RSVP privacy

-- Add event type column
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS event_type VARCHAR(20) DEFAULT 'physical' 
CHECK (event_type IN ('physical', 'digital', 'hybrid'));

-- Make location fields nullable for digital events
-- Physical events: location_id required, coordinates required
-- Digital events: location_id optional, coordinates NULL
-- Hybrid events: location_id required, coordinates required
ALTER TABLE events 
ALTER COLUMN location_id DROP NOT NULL;

ALTER TABLE events 
ALTER COLUMN latitude DROP NOT NULL;

ALTER TABLE events 
ALTER COLUMN longitude DROP NOT NULL;

-- Add link fields for events
-- Primary join link (for digital/hybrid events - Zoom, Discord, Twitch, etc.)
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS join_url VARCHAR(500);

-- General website/link (for any event type - event website, ticketing, more info)
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS website_url VARCHAR(500);

-- Additional links as JSON (flexible for multiple platforms)
-- Structure: {"discord": "https://...", "twitch": "https://...", "tickets": "https://...", etc.}
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS links JSONB;

-- Add NSFW/content rating
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS is_nsfw BOOLEAN DEFAULT false;

ALTER TABLE events 
ADD COLUMN IF NOT EXISTS content_rating VARCHAR(10) DEFAULT 'general'
CHECK (content_rating IN ('general', 'mature', 'nsfw', '18+'));

-- Add event category (free-form text, no hardcoded list)
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS event_category VARCHAR(50);

-- RSVP list privacy setting
-- If false, RSVP list is only visible to event creator
-- If true, RSVP list is visible to everyone (default)
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS show_rsvp_list BOOLEAN DEFAULT true;

-- Add config for hybrid event visibility (which spaces they compete in)
-- JSON: {"competeInPhysical": true, "competeInDigital": true}
-- Default: both true (compete in both spaces)
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS hybrid_visibility_config JSONB DEFAULT '{"competeInPhysical": true, "competeInDigital": true}';

-- Update existing events to be 'physical' type and set defaults
UPDATE events 
SET event_type = 'physical' 
WHERE event_type IS NULL;

-- Set location_name to "Virtual" for digital events that have no location
-- (This will be handled in application code, but we can set a default)
-- Note: We'll handle this in the application layer when creating digital events

-- Update indexes
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_nsfw ON events(is_nsfw);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(event_category);
CREATE INDEX IF NOT EXISTS idx_events_show_rsvp_list ON events(show_rsvp_list);
CREATE INDEX IF NOT EXISTS idx_events_join_url ON events(join_url) WHERE join_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_website_url ON events(website_url) WHERE website_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_links ON events USING GIN(links) WHERE links IS NOT NULL;

-- Add constraint: if is_nsfw is true, content_rating must be 'nsfw' or '18+'
ALTER TABLE events 
ADD CONSTRAINT check_nsfw_rating 
CHECK (
  (is_nsfw = false) OR 
  (is_nsfw = true AND content_rating IN ('nsfw', '18+'))
);

-- Add constraint: digital events must have join_url
-- Note: We'll enforce this in application code for flexibility, but add a comment
-- ALTER TABLE events 
-- ADD CONSTRAINT check_digital_join_url 
-- CHECK (
--   (event_type != 'digital') OR 
--   (event_type = 'digital' AND join_url IS NOT NULL)
-- );

-- Add constraint: physical and hybrid events must have location_id and coordinates
-- Note: We'll enforce this in application code for flexibility
-- ALTER TABLE events 
-- ADD CONSTRAINT check_physical_location 
-- CHECK (
--   (event_type = 'digital') OR 
--   (event_type IN ('physical', 'hybrid') AND location_id IS NOT NULL AND latitude IS NOT NULL AND longitude IS NOT NULL)
-- );

-- Comments for documentation
COMMENT ON COLUMN events.event_type IS 'Event type: physical (in-person), digital (online only), or hybrid (both)';
COMMENT ON COLUMN events.join_url IS 'Primary link to join/attend event (required for digital/hybrid, optional for physical)';
COMMENT ON COLUMN events.website_url IS 'General website/link for event (optional for all types)';
COMMENT ON COLUMN events.links IS 'Additional links as JSON: {"discord": "...", "twitch": "...", etc.}';
COMMENT ON COLUMN events.is_nsfw IS 'Whether event contains NSFW content';
COMMENT ON COLUMN events.content_rating IS 'Content rating: general, mature, nsfw, or 18+';
COMMENT ON COLUMN events.event_category IS 'Event category (free-form text, e.g., livestream, meetup, workshop)';
COMMENT ON COLUMN events.show_rsvp_list IS 'If false, RSVP list only visible to event creator';
COMMENT ON COLUMN events.hybrid_visibility_config IS 'JSON config for hybrid events: {"competeInPhysical": true, "competeInDigital": true}';
