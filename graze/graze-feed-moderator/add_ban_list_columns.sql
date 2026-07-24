-- Add ban list columns to feeds table
ALTER TABLE feeds 
ADD COLUMN IF NOT EXISTS global_ban_list TEXT,
ADD COLUMN IF NOT EXISTS feed_ban_list TEXT;