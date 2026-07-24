-- Near You feed user preferences
-- This table is owned by the Near You feed system, stored in ATlas Postgres for convenience
-- ATlas web directory provides the settings UI, feed system reads these values

CREATE TABLE IF NOT EXISTS user_feed_settings (
  user_did TEXT PRIMARY KEY,
  city_mode VARCHAR DEFAULT 'main',          -- 'main' | 'all' | 'exact'
  custom_radius_km INTEGER,                   -- NULL = system default (250km)
  self_post_visibility VARCHAR DEFAULT 'show', -- 'show' | 'hide'
  media_filter VARCHAR DEFAULT 'all',          -- 'all' | 'media_only' | 'text_only'
  alt_text_penalty REAL,                       -- NULL = system default (0.8). 0.0 = hide no-alt posts
  freshness_preference VARCHAR DEFAULT 'default', -- 'default' | 'fresh' | 'today' | 'catchup'
  min_engagement VARCHAR DEFAULT 'all',        -- 'all' | 'some' | 'popular'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE user_feed_settings IS 'Near You feed user preferences — managed by the feed system, not ATlas core';
