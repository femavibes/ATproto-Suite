-- Fix admin_defaults table with correct report types structure

-- Clear existing data
DELETE FROM admin_defaults;

-- Insert correct global defaults with proper category/subcategory names
INSERT INTO admin_defaults (threshold_type, category, subcategory, post_threshold, user_ban_threshold) VALUES
-- Main categories
('global', 'misleading', NULL, 10, 15),
('global', 'harassment', NULL, 3, 8),
('global', 'violence', NULL, 3, 5),
('global', 'sexual', NULL, 3, 8),
('global', 'child-safety', NULL, 3, 3),
('global', 'self-harm', NULL, 3, 5),
('global', 'rule', NULL, 3, 8),
('global', 'other', NULL, 5, 15),

-- Misleading subcategories
('global', 'misleading', 'spam', 10, 15),
('global', 'misleading', 'scam', 10, 15),
('global', 'misleading', 'bot', 10, 15),
('global', 'misleading', 'impersonation', 10, 15),
('global', 'misleading', 'elections', 10, 15),
('global', 'misleading', 'other', 10, 15),

-- Harassment subcategories
('global', 'harassment', 'troll', 3, 8),
('global', 'harassment', 'targeted', 3, 8),
('global', 'harassment', 'hate-speech', 3, 8),
('global', 'harassment', 'doxxing', 3, 8),
('global', 'harassment', 'other', 3, 8),

-- Violence subcategories
('global', 'violence', 'animal', 3, 5),
('global', 'violence', 'threats', 3, 5),
('global', 'violence', 'graphic-content', 3, 5),
('global', 'violence', 'glorification', 3, 5),
('global', 'violence', 'trafficking', 3, 5),
('global', 'violence', 'other', 3, 5),

-- Sexual subcategories
('global', 'sexual', 'unlabeled', 3, 8),
('global', 'sexual', 'abuse-content', 3, 8),
('global', 'sexual', 'ncii', 3, 8),
('global', 'sexual', 'deepfake', 3, 8),
('global', 'sexual', 'animal', 3, 8),
('global', 'sexual', 'other', 3, 8),

-- Child safety subcategories
('global', 'child-safety', 'privacy', 3, 3),
('global', 'child-safety', 'harassment', 3, 3),

-- Self harm subcategories
('global', 'self-harm', 'content', 3, 5),
('global', 'self-harm', 'ed', 3, 5),
('global', 'self-harm', 'stunts', 3, 5),
('global', 'self-harm', 'substances', 3, 5),
('global', 'self-harm', 'other', 3, 5),

-- Rule breaking subcategories
('global', 'rule', 'site-security', 3, 8),
('global', 'rule', 'prohibited-sales', 3, 8),
('global', 'rule', 'ban-evasion', 3, 8),
('global', 'rule', 'other', 3, 8),

-- Other subcategory
('global', 'other', 'other', 5, 15),

-- Feed defaults (same structure)
('feed', 'misleading', NULL, 10, 15),
('feed', 'harassment', NULL, 3, 8),
('feed', 'violence', NULL, 3, 5),
('feed', 'sexual', NULL, 3, 8),
('feed', 'child-safety', NULL, 3, 3),
('feed', 'self-harm', NULL, 3, 5),
('feed', 'rule', NULL, 3, 8),
('feed', 'other', NULL, 5, 15),

-- Feed subcategories (subset for feeds)
('feed', 'misleading', 'spam', 10, 15),
('feed', 'misleading', 'scam', 10, 15),
('feed', 'misleading', 'bot', 10, 15),
('feed', 'misleading', 'impersonation', 10, 15),
('feed', 'misleading', 'elections', 10, 15),
('feed', 'misleading', 'other', 10, 15),

('feed', 'harassment', 'troll', 3, 8),
('feed', 'harassment', 'targeted', 3, 8),
('feed', 'harassment', 'hate-speech', 3, 8),
('feed', 'harassment', 'doxxing', 3, 8),
('feed', 'harassment', 'other', 3, 8);