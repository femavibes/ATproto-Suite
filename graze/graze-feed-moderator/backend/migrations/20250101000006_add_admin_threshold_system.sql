-- Phase 1: Admin Threshold System
-- Create admin_defaults table and add sync columns

-- Create admin_defaults table
CREATE TABLE IF NOT EXISTS admin_defaults (
    id SERIAL PRIMARY KEY,
    threshold_type VARCHAR(50) NOT NULL CHECK (threshold_type IN ('global', 'feed')),
    category VARCHAR(50) NOT NULL,
    subcategory VARCHAR(50),
    post_threshold INTEGER NOT NULL CHECK (post_threshold >= 1 AND post_threshold <= 1000),
    user_ban_threshold INTEGER NOT NULL CHECK (user_ban_threshold >= 1 AND user_ban_threshold <= 1000),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(threshold_type, category, subcategory)
);

-- Add sync columns to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS sync_global_post_thresholds BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sync_global_ban_thresholds BOOLEAN DEFAULT false;

-- Add sync columns to feeds
ALTER TABLE feeds 
ADD COLUMN IF NOT EXISTS sync_feed_post_thresholds BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sync_feed_ban_thresholds BOOLEAN DEFAULT false;

-- Populate admin_defaults with current hardcoded values
-- Global thresholds (main categories)
INSERT INTO admin_defaults (threshold_type, category, subcategory, post_threshold, user_ban_threshold) VALUES
('global', 'spam', NULL, 3, 5),
('global', 'misleading', NULL, 3, 5),
('global', 'sexual', NULL, 3, 5),
('global', 'harassment', NULL, 3, 5),
('global', 'violence', NULL, 3, 5),
('global', 'child_safety', NULL, 3, 5),
('global', 'self_harm', NULL, 3, 5),
('global', 'rule', NULL, 3, 5),
('global', 'illegal', NULL, 3, 5)
ON CONFLICT (threshold_type, category, subcategory) DO NOTHING;

-- Global thresholds (subcategories - NULL to inherit from main)
INSERT INTO admin_defaults (threshold_type, category, subcategory, post_threshold, user_ban_threshold) VALUES
('global', 'misleading', 'spam', 3, 5),
('global', 'misleading', 'scam', 3, 5),
('global', 'misleading', 'bot', 3, 5),
('global', 'misleading', 'impersonation', 3, 5),
('global', 'misleading', 'elections', 3, 5),
('global', 'misleading', 'other', 3, 5),
('global', 'harassment', 'troll', 3, 5),
('global', 'harassment', 'targeted', 3, 5),
('global', 'harassment', 'hate_speech', 3, 5),
('global', 'harassment', 'doxxing', 3, 5),
('global', 'harassment', 'other', 3, 5),
('global', 'violence', 'animal', 3, 5),
('global', 'violence', 'threats', 3, 5),
('global', 'violence', 'graphic_content', 3, 5),
('global', 'violence', 'glorification', 3, 5),
('global', 'violence', 'trafficking', 3, 5),
('global', 'violence', 'other', 3, 5),
('global', 'sexual', 'unlabeled', 3, 5),
('global', 'sexual', 'abuse_content', 3, 5),
('global', 'sexual', 'ncii', 3, 5),
('global', 'sexual', 'deepfake', 3, 5),
('global', 'sexual', 'animal', 3, 5),
('global', 'sexual', 'other', 3, 5),
('global', 'child_safety', 'privacy', 3, 5),
('global', 'child_safety', 'harassment', 3, 5),
('global', 'self_harm', 'content', 3, 5),
('global', 'self_harm', 'ed', 3, 5),
('global', 'self_harm', 'stunts', 3, 5),
('global', 'self_harm', 'substances', 3, 5),
('global', 'self_harm', 'other', 3, 5),
('global', 'rule', 'site_security', 3, 5),
('global', 'rule', 'prohibited_sales', 3, 5),
('global', 'rule', 'ban_evasion', 3, 5),
('global', 'rule', 'other', 3, 5)
ON CONFLICT (threshold_type, category, subcategory) DO NOTHING;

-- Feed thresholds (main categories)
INSERT INTO admin_defaults (threshold_type, category, subcategory, post_threshold, user_ban_threshold) VALUES
('feed', 'spam', NULL, 3, 5),
('feed', 'misleading', NULL, 3, 5),
('feed', 'sexual', NULL, 3, 5),
('feed', 'harassment', NULL, 3, 5),
('feed', 'violence', NULL, 3, 5),
('feed', 'child_safety', NULL, 3, 5),
('feed', 'self_harm', NULL, 3, 5),
('feed', 'rule', NULL, 3, 5),
('feed', 'illegal', NULL, 3, 5)
ON CONFLICT (threshold_type, category, subcategory) DO NOTHING;

-- Feed thresholds (subcategories)
INSERT INTO admin_defaults (threshold_type, category, subcategory, post_threshold, user_ban_threshold) VALUES
('feed', 'misleading', 'spam', 3, 5),
('feed', 'misleading', 'scam', 3, 5),
('feed', 'misleading', 'bot', 3, 5),
('feed', 'misleading', 'impersonation', 3, 5),
('feed', 'misleading', 'elections', 3, 5),
('feed', 'misleading', 'other', 3, 5),
('feed', 'harassment', 'troll', 3, 5),
('feed', 'harassment', 'targeted', 3, 5),
('feed', 'harassment', 'hate_speech', 3, 5),
('feed', 'harassment', 'doxxing', 3, 5),
('feed', 'harassment', 'other', 3, 5)
ON CONFLICT (threshold_type, category, subcategory) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_defaults_type_category ON admin_defaults(threshold_type, category);
CREATE INDEX IF NOT EXISTS idx_admin_defaults_lookup ON admin_defaults(threshold_type, category, subcategory);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_admin_defaults_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_admin_defaults_updated_at
    BEFORE UPDATE ON admin_defaults
    FOR EACH ROW
    EXECUTE FUNCTION update_admin_defaults_updated_at();