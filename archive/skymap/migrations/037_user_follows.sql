-- Follow relationships between ATlas users
-- Updated when users visit mutuals page or via periodic sync
-- Used by Near You feed for follow/mutual boost scoring

CREATE TABLE IF NOT EXISTS user_follows (
  follower_did TEXT NOT NULL,
  followed_did TEXT NOT NULL,
  is_mutual BOOLEAN DEFAULT false,
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (follower_did, followed_did)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_followed ON user_follows(followed_did);
CREATE INDEX IF NOT EXISTS idx_user_follows_mutual ON user_follows(is_mutual) WHERE is_mutual = true;

COMMENT ON TABLE user_follows IS 'Follow relationships between ATlas users. Updated when users visit mutuals page or via periodic sync. Used by Near You feed for follow/mutual boost scoring.';
