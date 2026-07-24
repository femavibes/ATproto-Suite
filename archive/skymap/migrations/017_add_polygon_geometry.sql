-- Migration 017: Add polygon geometry storage for locations
-- Stores GeoJSON polygons for countries, states, counties, and cities
-- Bounding boxes (bbox_*) remain as fallback for locations without polygon geometry

-- Add geometry column to store GeoJSON polygons
ALTER TABLE locations ADD COLUMN IF NOT EXISTS geometry JSONB;

-- Add index for geometry queries (GIN index for JSONB)
CREATE INDEX IF NOT EXISTS idx_locations_geometry ON locations USING GIN (geometry);

-- Add comment
COMMENT ON COLUMN locations.geometry IS 'GeoJSON polygon geometry for location boundaries. Falls back to bbox_* columns if null.';
