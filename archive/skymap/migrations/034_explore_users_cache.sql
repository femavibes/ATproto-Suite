-- Migration 034: Explore users cache table
-- Caches explore users data to reduce load time from 10-15 seconds to <1 second

CREATE TABLE IF NOT EXISTS explore_users_cache (
    cache_key TEXT PRIMARY KEY,
    cache_data JSONB NOT NULL,
    cached_at TIMESTAMP DEFAULT NOW()
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_explore_users_cache_cached_at ON explore_users_cache(cached_at);
