-- Migration 027: User Custom Nodes and Feeds
-- Allows users to create and manage custom nodes and feeds on Graze

-- User custom nodes table (no FK to users since we don't have a users table, just session)
CREATE TABLE IF NOT EXISTS user_custom_nodes (
  id SERIAL PRIMARY KEY,
  user_did TEXT NOT NULL,
  graze_component_id TEXT NOT NULL,
  node_name TEXT NOT NULL,
  node_description TEXT,
  manifest JSONB NOT NULL,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(user_did, graze_component_id)
);

CREATE INDEX IF NOT EXISTS idx_user_custom_nodes_user_did ON user_custom_nodes(user_did);
CREATE INDEX IF NOT EXISTS idx_user_custom_nodes_active ON user_custom_nodes(user_did, is_active);
CREATE INDEX IF NOT EXISTS idx_user_custom_nodes_expires ON user_custom_nodes(expires_at) 
  WHERE expires_at IS NOT NULL AND is_active = true;

-- User feeds table
CREATE TABLE IF NOT EXISTS user_feeds (
  id SERIAL PRIMARY KEY,
  user_did TEXT NOT NULL,
  custom_node_id INTEGER REFERENCES user_custom_nodes(id) ON DELETE SET NULL,
  graze_feed_id TEXT NOT NULL,
  feed_name TEXT NOT NULL,
  feed_description TEXT,
  feed_uri TEXT,
  feed_order TEXT DEFAULT 'new',
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(user_did, graze_feed_id)
);

CREATE INDEX IF NOT EXISTS idx_user_feeds_user_did ON user_feeds(user_did);
CREATE INDEX IF NOT EXISTS idx_user_feeds_active ON user_feeds(user_did, is_active);
CREATE INDEX IF NOT EXISTS idx_user_feeds_node ON user_feeds(custom_node_id);
CREATE INDEX IF NOT EXISTS idx_user_feeds_expires ON user_feeds(expires_at) 
  WHERE expires_at IS NOT NULL AND is_active = true;
