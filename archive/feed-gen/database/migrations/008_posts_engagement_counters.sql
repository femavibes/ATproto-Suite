-- Engagement counters used by engagement filters/scoring nodes.
-- These may be updated by enrichment workers over time.
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reply_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repost_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quote_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bookmark_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_posts_like_count ON posts(like_count);
CREATE INDEX IF NOT EXISTS idx_posts_reply_count ON posts(reply_count);
CREATE INDEX IF NOT EXISTS idx_posts_repost_count ON posts(repost_count);
CREATE INDEX IF NOT EXISTS idx_posts_quote_count ON posts(quote_count);
