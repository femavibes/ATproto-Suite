-- Add avatar and display_name columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;