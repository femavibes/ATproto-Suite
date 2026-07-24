-- Migration 028: User Limits and Subscription Tiers
-- Allows per-user limits for custom nodes and feeds, supporting paid tiers

CREATE TABLE IF NOT EXISTS user_limits (
  user_did TEXT PRIMARY KEY,
  custom_node_limit INTEGER DEFAULT 3,
  feed_limit INTEGER DEFAULT 3,
  subscription_tier TEXT DEFAULT 'free',
  tier_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_limits_tier ON user_limits(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_user_limits_expires ON user_limits(tier_expires_at) 
  WHERE tier_expires_at IS NOT NULL;

-- Insert default limits for existing users (if any)
-- This will set 3/3 limits for anyone who has created nodes/feeds
INSERT INTO user_limits (user_did, custom_node_limit, feed_limit, subscription_tier)
SELECT DISTINCT user_did, 3, 3, 'free'
FROM user_custom_nodes
WHERE user_did NOT IN (SELECT user_did FROM user_limits)
ON CONFLICT (user_did) DO NOTHING;

INSERT INTO user_limits (user_did, custom_node_limit, feed_limit, subscription_tier)
SELECT DISTINCT user_did, 3, 3, 'free'
FROM user_feeds
WHERE user_did NOT IN (SELECT user_did FROM user_limits)
ON CONFLICT (user_did) DO NOTHING;
