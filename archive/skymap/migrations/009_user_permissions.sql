-- User permission tiers (hierarchical: higher number = more permissions)
-- Tier 1: Default (basic permissions only, no images)
-- Tier 2: Can upload images (user images and event images) - includes Tier 1
-- Tier 3: Highest tier (includes all Tier 2 permissions + future admin features)

CREATE TABLE IF NOT EXISTS user_permissions (
  id SERIAL PRIMARY KEY,
  did TEXT NOT NULL UNIQUE,
  tier INTEGER DEFAULT 1 NOT NULL CHECK (tier IN (1, 2, 3)),
  granted_at TIMESTAMP DEFAULT NOW(),
  granted_by TEXT, -- Admin handle who granted the permission
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_did ON user_permissions(did);
CREATE INDEX IF NOT EXISTS idx_user_permissions_tier ON user_permissions(tier);

-- All existing users start at tier 1 (default)