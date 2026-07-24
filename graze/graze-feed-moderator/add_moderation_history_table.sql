-- Add moderation history table to track full timeline of actions
CREATE TABLE IF NOT EXISTS moderation_history (
  id SERIAL PRIMARY KEY,
  post_uri TEXT NOT NULL,
  action VARCHAR(50) NOT NULL,
  feed_id TEXT,
  moderator_did TEXT NOT NULL,
  reason TEXT,
  target_handle TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_moderation_history_post_uri ON moderation_history (post_uri);
CREATE INDEX IF NOT EXISTS idx_moderation_history_moderator_did ON moderation_history (moderator_did);
CREATE INDEX IF NOT EXISTS idx_moderation_history_created_at ON moderation_history (created_at);