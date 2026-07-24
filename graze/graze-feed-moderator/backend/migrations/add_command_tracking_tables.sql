-- Add tables for tracking post removals and restorations for command system

-- Table to track post removals (for restoration capability)
CREATE TABLE IF NOT EXISTS post_removals (
  id SERIAL PRIMARY KEY,
  post_uri TEXT NOT NULL,
  feed_id TEXT, -- NULL means 'all' feeds
  user_id INTEGER NOT NULL REFERENCES user_profiles(id),
  reason TEXT,
  removed_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(post_uri, feed_id, user_id)
);

-- Table to track post restorations (for audit trail)
CREATE TABLE IF NOT EXISTS post_restorations (
  id SERIAL PRIMARY KEY,
  post_uri TEXT NOT NULL,
  feed_id TEXT, -- NULL means 'all' feeds  
  user_id INTEGER NOT NULL REFERENCES user_profiles(id),
  reason TEXT,
  restored_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_post_removals_user_removed ON post_removals(user_id, removed_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_removals_post_uri ON post_removals(post_uri);
CREATE INDEX IF NOT EXISTS idx_post_restorations_user_restored ON post_restorations(user_id, restored_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_restorations_post_uri ON post_restorations(post_uri);

-- Add index for finding posts by account DID (for bulk operations)
CREATE INDEX IF NOT EXISTS idx_post_removals_account_did ON post_removals(post_uri) WHERE post_uri LIKE 'at://%';