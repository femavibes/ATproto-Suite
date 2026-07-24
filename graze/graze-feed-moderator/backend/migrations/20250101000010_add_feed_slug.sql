-- Add feed_slug column to feeds table
ALTER TABLE feeds ADD COLUMN feed_slug VARCHAR(255);

-- Create index for faster lookups
CREate INDEX idx_feeds_slug ON feeds(feed_slug);

-- Update existing feeds with slugs based on feed names (users can update these later)
UPDATE feeds SET feed_slug = LOWER(REPLACE(REPLACE(feed_display_name, ' ', '-'), '+', 'plus')) WHERE feed_slug IS NULL;