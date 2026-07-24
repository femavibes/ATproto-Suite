-- Migration 030: Add embed_data to recent_posts
-- Stores embed data (images, videos, external links) from posts

ALTER TABLE recent_posts ADD COLUMN IF NOT EXISTS embed_data JSONB;

CREATE INDEX IF NOT EXISTS idx_recent_posts_embed ON recent_posts USING GIN (embed_data) WHERE embed_data IS NOT NULL;

COMMENT ON COLUMN recent_posts.embed_data IS 'JSONB containing embed data: images, videos, external links from AT Protocol';
