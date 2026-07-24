-- Add avatar and display_name columns to banned_users table
ALTER TABLE banned_users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE banned_users ADD COLUMN IF NOT EXISTS display_name TEXT;