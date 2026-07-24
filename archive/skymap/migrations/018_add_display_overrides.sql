-- Add display_key and display_name columns to locations table
-- These allow overriding the key and name used for list URLs and Ozone labels
-- while keeping the actual key matching Geoapify data

ALTER TABLE locations 
ADD COLUMN IF NOT EXISTS display_key VARCHAR(100),
ADD COLUMN IF NOT EXISTS display_name VARCHAR(100);

-- Add unique constraint on display_key (when not null)
-- This ensures no two locations can have the same display_key
CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_display_key_unique 
ON locations(display_key) 
WHERE display_key IS NOT NULL;

-- Add index for querying locations with display overrides
CREATE INDEX IF NOT EXISTS idx_locations_display_key ON locations(display_key) 
WHERE display_key IS NOT NULL;

-- Add comments
COMMENT ON COLUMN locations.display_key IS 'Override key for list URLs and Ozone labels (e.g., US-NY-NewYorkCity). Falls back to key if null.';
COMMENT ON COLUMN locations.display_name IS 'Override name for display purposes (e.g., New York City). Falls back to name if null.';
