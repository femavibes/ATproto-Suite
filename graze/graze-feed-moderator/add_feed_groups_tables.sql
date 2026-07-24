-- Feed Groups System
-- Basic groups without moderator permissions (for now)

-- Feed groups (like "urbanism", "transit", "housing+", "all+")
CREATE TABLE IF NOT EXISTS feed_groups (
  id SERIAL PRIMARY KEY,
  owner_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  group_name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(owner_user_id, group_name)
);

-- Many-to-many: feeds can be in multiple groups
CREATE TABLE IF NOT EXISTS feed_group_members (
  feed_id TEXT REFERENCES feeds(feed_id) ON DELETE CASCADE,
  group_id INTEGER REFERENCES feed_groups(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(feed_id, group_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_feed_groups_owner ON feed_groups(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_feed_group_members_group ON feed_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_feed_group_members_feed ON feed_group_members(feed_id);