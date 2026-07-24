-- Add feed_url column to feeds table
ALTER TABLE feeds ADD COLUMN feed_url TEXT;

-- Update existing feeds with URLs if they have slugs
-- This is a placeholder - actual URLs would need to be constructed with proper DIDs