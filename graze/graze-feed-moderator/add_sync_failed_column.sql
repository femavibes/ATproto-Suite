-- Add sync_failed column to track bans that failed to sync to Bluesky
ALTER TABLE banned_users ADD COLUMN IF NOT EXISTS sync_failed BOOLEAN DEFAULT false;
