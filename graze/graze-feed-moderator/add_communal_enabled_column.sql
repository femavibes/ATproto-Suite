-- Add communal_enabled column to feeds table
-- This column controls whether communal moderation is enabled for a specific feed

ALTER TABLE feeds ADD COLUMN IF NOT EXISTS communal_enabled BOOLEAN DEFAULT false;

-- Add comment to document the column
COMMENT ON COLUMN feeds.communal_enabled IS 'Enables communal moderation for this feed, allowing multiple users to contribute to moderation decisions';
