-- Replace single post_source dropdown with 5 individual source toggles
-- All default to NULL (= use admin default, which defaults to true)

ALTER TABLE user_feed_settings ADD COLUMN IF NOT EXISTS source_atlas_users BOOLEAN DEFAULT NULL;
ALTER TABLE user_feed_settings ADD COLUMN IF NOT EXISTS source_hashtag_authors BOOLEAN DEFAULT NULL;
ALTER TABLE user_feed_settings ADD COLUMN IF NOT EXISTS source_follow_graph BOOLEAN DEFAULT NULL;
ALTER TABLE user_feed_settings ADD COLUMN IF NOT EXISTS source_hashtag_posts BOOLEAN DEFAULT NULL;
ALTER TABLE user_feed_settings ADD COLUMN IF NOT EXISTS source_community_surfaced BOOLEAN DEFAULT NULL;

-- Migrate existing post_source values to new columns
-- atlas_only: only atlas users were on, everything else off
UPDATE user_feed_settings SET
  source_atlas_users = true,
  source_hashtag_authors = false,
  source_follow_graph = false,
  source_hashtag_posts = false,
  source_community_surfaced = false
WHERE post_source = 'atlas_only';

-- hashtag_only: only hashtag posts were on
UPDATE user_feed_settings SET
  source_atlas_users = false,
  source_hashtag_authors = false,
  source_follow_graph = false,
  source_hashtag_posts = true,
  source_community_surfaced = false
WHERE post_source = 'hashtag_only';

-- 'both' or NULL: leave all as NULL (use admin defaults, which are all true)

-- Drop old column
ALTER TABLE user_feed_settings DROP COLUMN IF EXISTS post_source;
