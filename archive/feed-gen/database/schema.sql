-- Bluesky Feed Platform Database Schema
-- PostgreSQL 16

-- Shared posts table (all matched posts)
CREATE TABLE posts (
  cid TEXT PRIMARY KEY,
  uri TEXT NOT NULL UNIQUE,
  text TEXT,
  author_did TEXT NOT NULL,
  
  -- Content metadata (from Jetstream)
  has_images BOOLEAN DEFAULT FALSE,
  has_video BOOLEAN DEFAULT FALSE,
  has_link BOOLEAN DEFAULT FALSE,
  language TEXT,
  post_type TEXT, -- 'post', 'reply', 'quote'
  reply_parent TEXT, -- Parent post URI if reply
  reply_root TEXT, -- Root post URI if reply
  
  -- Ingestion metadata
  source_type TEXT DEFAULT 'native', -- 'native', 'manual', 'module'
  source_module_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL,
  indexed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_posts_uri ON posts(uri);
CREATE INDEX idx_posts_author ON posts(author_did);
CREATE INDEX idx_posts_created ON posts(created_at DESC);

-- Post enrichment data (flexible JSONB storage)
CREATE TABLE post_enrichments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_cid TEXT REFERENCES posts(cid) ON DELETE CASCADE,
  enrichment_type TEXT NOT NULL, -- 'author_profile', 'engagement', 'video_metadata', 'labels', etc.
  source_endpoint TEXT, -- API endpoint or process used (e.g., 'app.bsky.actor.getProfile', 'ffmpeg')
  data JSONB NOT NULL, -- Flexible storage for any enrichment data
  enriched_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP, -- For data that should be refreshed
  UNIQUE(post_cid, enrichment_type)
);

CREATE INDEX idx_enrichments_post ON post_enrichments(post_cid);
CREATE INDEX idx_enrichments_type ON post_enrichments(enrichment_type);
CREATE INDEX idx_enrichments_expires ON post_enrichments(expires_at) WHERE expires_at IS NOT NULL;

-- Feed configuration
CREATE TABLE feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner_did TEXT,
  
  -- Ingestion settings
  use_native_ingestion BOOLEAN DEFAULT TRUE,
  keywords TEXT[], -- For Aho-Corasick
  
  -- Assignment rules (visual rule builder)
  assignment_rules JSONB NOT NULL DEFAULT '{"logic": "OR", "groups": []}'::jsonb,
  -- Format: {"logic": "OR", "groups": [...]}
  
  -- Settings
  retention_days INTEGER DEFAULT 30,
  is_public BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Feed assignments (which posts belong to which feeds)
CREATE TABLE feed_posts (
  feed_id UUID REFERENCES feeds(id) ON DELETE CASCADE,
  post_cid TEXT REFERENCES posts(cid) ON DELETE CASCADE,
  base_score INTEGER DEFAULT 0,
  assigned_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (feed_id, post_cid)
);

CREATE INDEX idx_feed_posts_feed ON feed_posts(feed_id, base_score DESC, assigned_at DESC);

-- Pinned posts (always show at top)
CREATE TABLE feed_pinned_posts (
  feed_id UUID REFERENCES feeds(id) ON DELETE CASCADE,
  post_cid TEXT,
  post_uri TEXT,
  position INTEGER, -- Order (1 = top)
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (feed_id, post_cid)
);

-- Rotating posts (cycle through a set)
CREATE TABLE feed_rotating_posts (
  feed_id UUID REFERENCES feeds(id) ON DELETE CASCADE,
  post_cid TEXT,
  post_uri TEXT,
  rotation_group TEXT DEFAULT 'default',
  weight INTEGER DEFAULT 1, -- Higher = shown more often
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (feed_id, post_cid)
);

-- Manual posts (user-added)
CREATE TABLE feed_manual_posts (
  feed_id UUID REFERENCES feeds(id) ON DELETE CASCADE,
  post_uri TEXT NOT NULL,
  added_at TIMESTAMP DEFAULT NOW(),
  added_by TEXT,
  notes TEXT,
  PRIMARY KEY (feed_id, post_uri)
);

-- User lists (private lists)
CREATE TABLE user_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_did TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  members TEXT[], -- Array of DIDs
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Modules
CREATE TABLE feed_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id UUID REFERENCES feeds(id) ON DELETE CASCADE,
  
  module_id TEXT NOT NULL,
  module_category TEXT NOT NULL,
  -- 'source', 'access_control', 'enrichment', 'scoring', 'injection', 'analytics'
  
  api_url TEXT NOT NULL,
  api_key TEXT, -- Encrypted
  config JSONB,
  
  execution_order INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_feed_modules_feed ON feed_modules(feed_id, execution_order);

-- Module marketplace
CREATE TABLE available_modules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  scope TEXT NOT NULL, -- 'global', 'feed', 'user'
  description TEXT,
  documentation_url TEXT,
  author_did TEXT,
  
  -- For enrichment modules: fields they provide
  provides_fields JSONB,
  -- [{"id": "sentiment", "label": "Sentiment", "type": "string", "options": [...]}]
  
  -- UI configuration
  config_schema JSONB,
  
  -- Performance
  avg_latency_ms INTEGER,
  max_latency_ms INTEGER,
  supports_batch BOOLEAN DEFAULT FALSE,
  max_batch_size INTEGER,
  
  -- Caching
  cache_enabled BOOLEAN DEFAULT TRUE,
  cache_ttl INTEGER, -- seconds
  
  -- Pricing
  pricing_model TEXT,
  base_cost DECIMAL(10,2),
  free_tier INTEGER,
  
  -- Stats
  total_installs INTEGER DEFAULT 0,
  rating DECIMAL(3,2),
  is_verified BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enrichment cache (global scope)
CREATE TABLE enrichment_cache_global (
  post_cid TEXT,
  module_id TEXT,
  enriched_data JSONB,
  cached_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  PRIMARY KEY (post_cid, module_id)
);

CREATE INDEX idx_enrichment_global_expires ON enrichment_cache_global(expires_at);

-- Enrichment cache (feed scope)
CREATE TABLE enrichment_cache_feed (
  post_cid TEXT,
  feed_id UUID,
  module_id TEXT,
  enriched_data JSONB,
  cached_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  PRIMARY KEY (post_cid, feed_id, module_id)
);

CREATE INDEX idx_enrichment_feed_expires ON enrichment_cache_feed(expires_at);

-- Enrichment cache (user scope - rarely used)
CREATE TABLE enrichment_cache_user (
  post_cid TEXT,
  user_did TEXT,
  module_id TEXT,
  enriched_data JSONB,
  cached_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  PRIMARY KEY (post_cid, user_did, module_id)
);

CREATE INDEX idx_enrichment_user_expires ON enrichment_cache_user(expires_at);

-- Author cache (for rule evaluation)
CREATE TABLE author_cache (
  did TEXT PRIMARY KEY,
  handle TEXT,
  follower_count INTEGER,
  following_count INTEGER,
  created_at TIMESTAMP,
  cached_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_author_cache_updated ON author_cache(cached_at);

-- Jetstream cursor tracking (for resuming ingestion after restart)
CREATE TABLE jetstream_cursor (
  id INTEGER PRIMARY KEY DEFAULT 1, -- Single row
  cursor_seq INTEGER NOT NULL,
  cursor_time TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Insert initial cursor (will be updated by ingestion service)
INSERT INTO jetstream_cursor (cursor_seq, cursor_time) VALUES (0, NOW());

-- Feed project model + draft/live project graph support
CREATE TABLE IF NOT EXISTS feed_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner_did TEXT,
  assignment_rules_draft JSONB DEFAULT '{"version":2,"nodes":[],"edges":[]}'::jsonb,
  assignment_rules_live JSONB DEFAULT '{"version":2,"nodes":[],"edges":[]}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Ensure feeds has all project/publish/live logic columns
ALTER TABLE feeds
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES feed_projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS assignment_rules_draft JSONB,
  ADD COLUMN IF NOT EXISTS assignment_rules_live JSONB,
  ADD COLUMN IF NOT EXISTS bluesky_feed_uri TEXT,
  ADD COLUMN IF NOT EXISTS prefilter_hints JSONB;

UPDATE feeds
SET assignment_rules_draft = COALESCE(assignment_rules_draft, assignment_rules),
    assignment_rules_live = COALESCE(assignment_rules_live, assignment_rules),
    updated_at = NOW()
WHERE assignment_rules IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_feeds_project_slug_unique
  ON feeds(project_id, slug)
  WHERE project_id IS NOT NULL AND slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_feeds_project
  ON feeds(project_id);

-- Preserve Bluesky-native fields on posts for evaluator/node parity
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS langs TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS record_json JSONB,
  ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reply_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repost_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quote_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bookmark_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_updated_at TIMESTAMP,
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

CREATE INDEX IF NOT EXISTS idx_posts_langs_gin ON posts USING GIN (langs);
CREATE INDEX IF NOT EXISTS idx_posts_facet_link_uris_gin ON posts USING GIN (facet_link_uris);
CREATE INDEX IF NOT EXISTS idx_posts_facet_tags_gin ON posts USING GIN (facet_tags);
CREATE INDEX IF NOT EXISTS idx_posts_outline_tags_gin ON posts USING GIN (outline_tags);
CREATE INDEX IF NOT EXISTS idx_posts_embed_external_uri ON posts(embed_external_uri);
CREATE INDEX IF NOT EXISTS idx_posts_embed_media_external_uri ON posts(embed_media_external_uri);
CREATE INDEX IF NOT EXISTS idx_posts_like_count ON posts(like_count);
CREATE INDEX IF NOT EXISTS idx_posts_reply_count ON posts(reply_count);
CREATE INDEX IF NOT EXISTS idx_posts_repost_count ON posts(repost_count);
CREATE INDEX IF NOT EXISTS idx_posts_quote_count ON posts(quote_count);
CREATE INDEX IF NOT EXISTS idx_posts_engagement_updated_at ON posts(engagement_updated_at);

-- Cached external list memberships for author/mentions listUris
CREATE TABLE IF NOT EXISTS external_list_members (
  list_uri TEXT NOT NULL,
  member_did TEXT NOT NULL,
  member_handle TEXT,
  source_type TEXT DEFAULT 'list',
  refreshed_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (list_uri, member_did)
);

CREATE INDEX IF NOT EXISTS idx_external_list_members_list_uri ON external_list_members(list_uri);
CREATE INDEX IF NOT EXISTS idx_external_list_members_member_did ON external_list_members(member_did);

CREATE TABLE IF NOT EXISTS external_list_refresh_state (
  list_uri TEXT PRIMARY KEY,
  last_refreshed_at TIMESTAMP,
  last_error TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Track interaction records so delete events can decrement counters safely.
CREATE TABLE IF NOT EXISTS post_engagement_events (
  action_uri TEXT PRIMARY KEY,
  subject_post_uri TEXT NOT NULL,
  kind TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_engagement_events_subject ON post_engagement_events(subject_post_uri);
CREATE INDEX IF NOT EXISTS idx_post_engagement_events_kind ON post_engagement_events(kind);
