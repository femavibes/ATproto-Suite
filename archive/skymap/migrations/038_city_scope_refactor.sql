-- Refactor city_mode into two clearer settings: city_scope + include_nearby
ALTER TABLE user_feed_settings ADD COLUMN IF NOT EXISTS city_scope VARCHAR DEFAULT NULL;
ALTER TABLE user_feed_settings ADD COLUMN IF NOT EXISTS include_nearby VARCHAR DEFAULT NULL;

-- Migrate existing city_mode values to new columns
UPDATE user_feed_settings SET
  city_scope = CASE
    WHEN city_mode IN ('main', 'main_only') THEN 'primary'
    WHEN city_mode IN ('all', 'exact') THEN 'all'
    ELSE NULL
  END,
  include_nearby = CASE
    WHEN city_mode IN ('main', 'all') THEN 'yes'
    WHEN city_mode IN ('main_only', 'exact') THEN 'no'
    ELSE NULL
  END
WHERE city_mode IS NOT NULL AND city_mode != 'main';
