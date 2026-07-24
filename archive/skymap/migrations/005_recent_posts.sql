-- Create recent_posts table for displaying posts on map
CREATE TABLE IF NOT EXISTS recent_posts (
  id SERIAL PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
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
  created_at TIMESTAMP NOT NULL,
  indexed_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_recent_posts_location_time ON recent_posts(location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recent_posts_location_likes ON recent_posts(location_id, like_count DESC);
CREATE INDEX IF NOT EXISTS idx_recent_posts_created ON recent_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recent_posts_indexed ON recent_posts(indexed_at DESC);

-- Clean up old posts (older than 24 hours) on migration
DELETE FROM recent_posts WHERE created_at < NOW() - INTERVAL '24 hours';
