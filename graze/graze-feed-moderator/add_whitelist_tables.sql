CREATE TABLE IF NOT EXISTS user_whitelists (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  whitelisted_did TEXT NOT NULL,
  whitelisted_handle TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, whitelisted_did)
);

CREATE TABLE IF NOT EXISTS feed_whitelists (
  id SERIAL PRIMARY KEY,
  feed_id TEXT NOT NULL,
  whitelisted_did TEXT NOT NULL,
  whitelisted_handle TEXT,
  is_blacklist BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(feed_id, whitelisted_did)
);

CREATE INDEX IF NOT EXISTS idx_user_whitelists_user_id ON user_whitelists(user_id);
CREATE INDEX IF NOT EXISTS idx_user_whitelists_did ON user_whitelists(whitelisted_did);
CREATE INDEX IF NOT EXISTS idx_feed_whitelists_feed_id ON feed_whitelists(feed_id);
CREATE INDEX IF NOT EXISTS idx_feed_whitelists_did ON feed_whitelists(whitelisted_did);