-- Optional: full AT URI after registering app.bsky.feed.generator on Bluesky
ALTER TABLE feeds
  ADD COLUMN IF NOT EXISTS bluesky_feed_uri TEXT;
