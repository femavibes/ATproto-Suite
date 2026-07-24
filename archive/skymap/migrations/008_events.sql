-- Create events table
CREATE TABLE IF NOT EXISTS events (
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
  
  -- Status
  is_active BOOLEAN DEFAULT true, -- Event is active (not expired/deleted)
  is_visible BOOLEAN DEFAULT false, -- Shows on map when true (calculated)
  is_ended BOOLEAN DEFAULT false, -- Event has passed (>24h after end_time)
  
  -- Lifecycle
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP -- Soft delete
);

-- Create event_rsvps table
CREATE TABLE IF NOT EXISTS event_rsvps (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(10) NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  user_did TEXT NOT NULL,
  user_handle TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  created_at_relative_to_start TIMESTAMP, -- For calculating if RSVP was before/after event start
  UNIQUE(event_id, user_did) -- One RSVP per user per event
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_active ON events(is_active, is_visible, start_time);
CREATE INDEX IF NOT EXISTS idx_events_location ON events(location_id);
CREATE INDEX IF NOT EXISTS idx_events_coords ON events(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_events_creator ON events(creator_did);
-- Note: Cannot use NOW() in partial index, but idx_events_active covers upcoming events efficiently
CREATE INDEX IF NOT EXISTS idx_event_rsvps_event ON event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_user ON event_rsvps(user_did);
CREATE INDEX IF NOT EXISTS idx_events_event_id ON events(event_id);
