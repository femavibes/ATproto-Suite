-- Feed settings toggle system

-- Track when a user last changed settings via toggle (for served demotion grace period)
ALTER TABLE user_feed_settings ADD COLUMN IF NOT EXISTS settings_changed_at TIMESTAMP;

-- Feed settings posts: maps feed + settings hash to a Bluesky post URI
CREATE TABLE IF NOT EXISTS feed_settings_posts (
  id SERIAL PRIMARY KEY,
  feed_name VARCHAR(50) NOT NULL,
  settings_hash VARCHAR(64) NOT NULL,
  post_uri TEXT NOT NULL,
  post_text TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(feed_name, settings_hash)
);

-- Toggle config: defines which settings are quick-toggleable per feed
CREATE TABLE IF NOT EXISTS feed_toggle_config (
  id SERIAL PRIMARY KEY,
  feed_name VARCHAR(50) NOT NULL,
  setting_key VARCHAR(50) NOT NULL,
  options JSONB NOT NULL, -- e.g. ["all", "images", "text"]
  labels JSONB NOT NULL,  -- e.g. ["All", "Images Only", "Text Only"]
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  UNIQUE(feed_name, setting_key)
);
