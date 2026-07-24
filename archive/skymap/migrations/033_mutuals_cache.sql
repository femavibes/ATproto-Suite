-- Create mutuals cache table for persistent storage across restarts
CREATE TABLE IF NOT EXISTS mutuals_cache (
  user_did TEXT PRIMARY KEY,
  cache_data JSONB NOT NULL,
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_mutuals_cache_cached_at ON mutuals_cache(cached_at);
