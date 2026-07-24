-- Add app_password and password_type columns to user_profiles table

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS app_password TEXT,
ADD COLUMN IF NOT EXISTS password_type VARCHAR(10) DEFAULT 'basic';

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.app_password IS 'Encrypted app password for user authentication';
COMMENT ON COLUMN user_profiles.password_type IS 'Type of password: basic or app (Bluesky app password)';
