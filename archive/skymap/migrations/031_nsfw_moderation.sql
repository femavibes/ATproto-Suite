-- Migration 031: Add NSFW moderation fields to recent_posts
-- Stores moderation status from Bluesky's official moderation service

ALTER TABLE recent_posts ADD COLUMN IF NOT EXISTS is_nsfw BOOLEAN DEFAULT FALSE;
ALTER TABLE recent_posts ADD COLUMN IF NOT EXISTS moderation_checked_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_recent_posts_nsfw ON recent_posts(is_nsfw);
CREATE INDEX IF NOT EXISTS idx_recent_posts_moderation_check ON recent_posts(moderation_checked_at) WHERE moderation_checked_at IS NULL;

COMMENT ON COLUMN recent_posts.is_nsfw IS 'Whether post has NSFW labels from Bluesky moderation service';
COMMENT ON COLUMN recent_posts.moderation_checked_at IS 'When post was last checked for moderation labels';
