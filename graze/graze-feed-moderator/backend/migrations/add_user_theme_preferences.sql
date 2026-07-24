-- Add theme preferences to user_profiles table
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS dark_mode BOOLEAN DEFAULT FALSE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS theme VARCHAR(50) DEFAULT 'default';