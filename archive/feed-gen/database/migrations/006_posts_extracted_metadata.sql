-- Extracted metadata columns for fast filtering/querying.
-- Canonical source remains record_json; these are denormalized hot fields.
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS facet_link_uris TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS facet_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS outline_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS embed_external_uri TEXT,
  ADD COLUMN IF NOT EXISTS embed_external_title TEXT,
  ADD COLUMN IF NOT EXISTS embed_external_description TEXT,
  ADD COLUMN IF NOT EXISTS embed_external_thumb_mime TEXT,
  ADD COLUMN IF NOT EXISTS embed_external_thumb_size BIGINT,
  ADD COLUMN IF NOT EXISTS embed_images_alt_texts TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS embed_video_alt_text TEXT,
  ADD COLUMN IF NOT EXISTS embed_video_mime TEXT,
  ADD COLUMN IF NOT EXISTS embed_video_size BIGINT,
  ADD COLUMN IF NOT EXISTS embed_video_aspect_width INTEGER,
  ADD COLUMN IF NOT EXISTS embed_video_aspect_height INTEGER,
  ADD COLUMN IF NOT EXISTS embed_media_images_alt_texts TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS embed_media_external_uri TEXT,
  ADD COLUMN IF NOT EXISTS embed_media_external_title TEXT,
  ADD COLUMN IF NOT EXISTS embed_media_external_description TEXT,
  ADD COLUMN IF NOT EXISTS bridgy_original_text TEXT;

CREATE INDEX IF NOT EXISTS idx_posts_facet_link_uris_gin ON posts USING GIN (facet_link_uris);
CREATE INDEX IF NOT EXISTS idx_posts_facet_tags_gin ON posts USING GIN (facet_tags);
CREATE INDEX IF NOT EXISTS idx_posts_outline_tags_gin ON posts USING GIN (outline_tags);
CREATE INDEX IF NOT EXISTS idx_posts_embed_external_uri ON posts(embed_external_uri);
CREATE INDEX IF NOT EXISTS idx_posts_embed_media_external_uri ON posts(embed_media_external_uri);
