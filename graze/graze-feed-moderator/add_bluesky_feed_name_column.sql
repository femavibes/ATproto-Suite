-- Add bluesky_feed_name column to feeds table
ALTER TABLE feeds ADD COLUMN bluesky_feed_name VARCHAR(255);

-- Add index for better performance
CREATE INDEX idx_feeds_bluesky_feed_name ON feeds(bluesky_feed_name);