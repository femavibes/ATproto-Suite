-- Add custom_media_types snapshot (stores user's settings page config for "Custom" button)
ALTER TABLE user_feed_settings ADD COLUMN IF NOT EXISTS custom_media_types varchar;

-- Add hide_menu support: users can hide the in-feed settings post
-- (stored as override: setting_key='hide_menu', setting_value='true')

-- Update toggle config: replace media_filter with media_mode, add include_nearby
-- Remove old media_filter entries
DELETE FROM feed_toggle_config WHERE setting_key = 'media_filter';

-- Remove old city_scope entries (will be re-added with 2 options instead of 3)
DELETE FROM feed_toggle_config WHERE setting_key = 'city_scope';

-- Insert new config for all feeds
INSERT INTO feed_toggle_config (feed_name, setting_key, options, labels, sort_order, active) VALUES
  ('near-you', 'city_scope', '["primary", "all"]', '["Primary", "All Cities"]', 1, true),
  ('near-you', 'include_nearby', '["yes", "no"]', '["+Nearby", "-Nearby"]', 2, true),
  ('near-you', 'media_mode', '["all", "images", "custom"]', '["All", "Images", "Custom"]', 3, true),
  ('near-you-live', 'city_scope', '["primary", "all"]', '["Primary", "All Cities"]', 1, true),
  ('near-you-live', 'include_nearby', '["yes", "no"]', '["+Nearby", "-Nearby"]', 2, true),
  ('near-you-live', 'media_mode', '["all", "images", "custom"]', '["All", "Images", "Custom"]', 3, true),
  ('near-you-video', 'city_scope', '["primary", "all"]', '["Primary", "All Cities"]', 1, true),
  ('near-you-video', 'include_nearby', '["yes", "no"]', '["+Nearby", "-Nearby"]', 2, true),
  ('near-you-video', 'media_mode', '["all", "images", "custom"]', '["All", "Images", "Custom"]', 3, true),
  ('near-you-test-a', 'city_scope', '["primary", "all"]', '["Primary", "All Cities"]', 1, true),
  ('near-you-test-a', 'include_nearby', '["yes", "no"]', '["+Nearby", "-Nearby"]', 2, true),
  ('near-you-test-a', 'media_mode', '["all", "images", "custom"]', '["All", "Images", "Custom"]', 3, true)
ON CONFLICT (feed_name, setting_key) DO UPDATE SET
  options = EXCLUDED.options,
  labels = EXCLUDED.labels,
  sort_order = EXCLUDED.sort_order,
  active = EXCLUDED.active;

-- Delete old settings posts (will be regenerated with new format)
DELETE FROM feed_settings_posts;

-- Clear old overrides that reference removed keys
DELETE FROM user_feed_setting_overrides WHERE setting_key IN ('media_filter');
