-- Preserve Bluesky-native fields on posts for evaluator/node parity.
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS langs TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS record_json JSONB;

CREATE INDEX IF NOT EXISTS idx_posts_langs_gin ON posts USING GIN (langs);
