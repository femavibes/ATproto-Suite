-- Track freshness of engagement counters on posts.
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS engagement_updated_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_posts_engagement_updated_at ON posts(engagement_updated_at);
