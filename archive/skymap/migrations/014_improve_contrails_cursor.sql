-- Improve contrails cursor to use post URI instead of just time_us
-- This allows better backfilling and handles deleted posts better

-- Create table if it doesn't exist (for new deployments)
CREATE TABLE IF NOT EXISTS contrails_cursor (
  id INTEGER PRIMARY KEY DEFAULT 1,
  last_time_us BIGINT,
  last_post_uri TEXT,
  last_post_created_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add new columns if they don't exist
ALTER TABLE contrails_cursor 
  ADD COLUMN IF NOT EXISTS last_post_uri TEXT,
  ADD COLUMN IF NOT EXISTS last_post_created_at TIMESTAMP;

-- Create index on post_uri for faster lookups
CREATE INDEX IF NOT EXISTS idx_contrails_cursor_post_uri ON contrails_cursor(last_post_uri) WHERE last_post_uri IS NOT NULL;

-- Also create a table to track processed post URIs for deduplication
CREATE TABLE IF NOT EXISTS processed_post_uris (
  post_uri TEXT PRIMARY KEY,
  processed_at TIMESTAMP DEFAULT NOW(),
  location_id INTEGER,
  created_at TIMESTAMP
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_processed_post_uris_processed ON processed_post_uris(processed_at);
CREATE INDEX IF NOT EXISTS idx_processed_post_uris_created ON processed_post_uris(created_at);

-- Clean up old processed URIs (older than 7 days)
DELETE FROM processed_post_uris WHERE processed_at < NOW() - INTERVAL '7 days';
