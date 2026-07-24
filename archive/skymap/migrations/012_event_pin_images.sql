-- Add pin_image_url column to events table for marker images on the map
-- This is separate from image_url which is for event detail pages

ALTER TABLE events
ADD COLUMN IF NOT EXISTS pin_image_url VARCHAR(500);

CREATE INDEX IF NOT EXISTS idx_events_pin_image_url ON events(pin_image_url) WHERE pin_image_url IS NOT NULL;
