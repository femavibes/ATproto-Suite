-- Add user_decrypt_url column to user_profiles table
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS user_decrypt_url TEXT;