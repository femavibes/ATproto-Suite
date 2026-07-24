-- Remove app_password column since we're using bsky_password for everything
ALTER TABLE user_profiles DROP COLUMN IF EXISTS app_password;
