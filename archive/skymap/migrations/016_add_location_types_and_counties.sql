-- Migration 016: Add location types, counties, and city-county relationships
-- Adds support for country, state, county, and city hierarchy with many-to-many city-county relationships

-- Add location_type column (nullable initially, will be set by parser)
ALTER TABLE locations ADD COLUMN IF NOT EXISTS location_type VARCHAR(20);
-- Add county fields (for easy lookup, but many-to-many relationship via city_counties table)
ALTER TABLE locations ADD COLUMN IF NOT EXISTS county_code VARCHAR(10);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS county_name VARCHAR(100);

-- Create city_counties junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS city_counties (
    city_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
    county_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
    PRIMARY KEY (city_id, county_id)
);

CREATE INDEX IF NOT EXISTS idx_city_counties_city ON city_counties(city_id);
CREATE INDEX IF NOT EXISTS idx_city_counties_county ON city_counties(county_id);
CREATE INDEX IF NOT EXISTS idx_locations_type ON locations(location_type);
CREATE INDEX IF NOT EXISTS idx_locations_county_code ON locations(county_code);

-- Update existing locations to have location_type based on current structure
-- States (parent_id IS NULL and region_code is set) -> location_type = 'state'
UPDATE locations SET location_type = 'state' WHERE parent_id IS NULL AND region_code IS NOT NULL AND location_type IS NULL;
-- Cities (parent_id IS NOT NULL and population IS NOT NULL) -> location_type = 'city'  
UPDATE locations SET location_type = 'city' WHERE parent_id IS NOT NULL AND population IS NOT NULL AND location_type IS NULL;
-- Set default for any remaining NULLs to 'city' (safest default)
UPDATE locations SET location_type = 'city' WHERE location_type IS NULL;

-- Add constraint to ensure location_type is valid (only if constraint doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_location_type'
    ) THEN
        ALTER TABLE locations ADD CONSTRAINT check_location_type CHECK (location_type IN ('country', 'state', 'county', 'city'));
    END IF;
END $$;
