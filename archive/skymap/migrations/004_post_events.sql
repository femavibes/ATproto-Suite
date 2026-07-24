-- Create post_events table to track individual posts
CREATE TABLE IF NOT EXISTS post_events (
  id SERIAL PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for efficient time-based queries
CREATE INDEX IF NOT EXISTS idx_post_events_location_time ON post_events(location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_events_created_at ON post_events(created_at DESC);

-- Reset all existing counters to 0 (clean slate)
UPDATE location_post_stats 
SET post_count_1h = 0, 
    post_count_6h = 0, 
    post_count_24h = 0, 
    post_count_7d = 0,
    last_updated = NOW();
