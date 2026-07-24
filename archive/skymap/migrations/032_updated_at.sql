-- Add updated_at column for tracking when posts were last refreshed
-- This allows quoted posts to reset the 24-hour deletion clock

ALTER TABLE recent_posts ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Set updated_at to created_at for existing posts
UPDATE recent_posts SET updated_at = created_at WHERE updated_at IS NULL;

-- Make updated_at NOT NULL
ALTER TABLE recent_posts ALTER COLUMN updated_at SET NOT NULL;

-- Add index for efficient cleanup queries
CREATE INDEX idx_recent_posts_updated ON recent_posts(updated_at DESC);
