-- Interest anchor system: replaces binary interest picks with slider-based anchors
-- anchor_value: -100 to +100 (null = auto-discovered, no manual setting)
-- learned_signals_enabled: global toggle for behavioral learning (default true)

-- Add anchor_value to user_interests
ALTER TABLE user_interests ADD COLUMN anchor_value integer;

-- Create table for interest anchors on sub-interests that user hasn't explicitly "added"
-- This allows users to set slider values on any interest without requiring the old binary add
CREATE TABLE IF NOT EXISTS user_interest_anchors (
  user_did text NOT NULL,
  interest_id integer NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
  anchor_value integer NOT NULL DEFAULT 0,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  PRIMARY KEY (user_did, interest_id)
);

CREATE INDEX idx_user_interest_anchors_did ON user_interest_anchors(user_did);

-- Add learned_signals_enabled to user_feed_settings (rename from inferred_interests_enabled for clarity)
-- Keep old column for backwards compat, add new one
ALTER TABLE user_feed_settings ADD COLUMN learned_signals_enabled boolean DEFAULT true;

-- Migrate existing inferred_interests_enabled values
UPDATE user_feed_settings SET learned_signals_enabled = inferred_interests_enabled WHERE inferred_interests_enabled IS NOT NULL;

-- Backfill: set anchor_value = 50 for all existing explicit interest picks (preserves current behavior)
UPDATE user_interests SET anchor_value = 50 WHERE anchor_value IS NULL;
